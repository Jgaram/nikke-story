/**
 * 공용 데이터(W1) — 모든 탭 · 리더 패널 · 검색이 쓴다. 파일 이름 · 칸은 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 *
 *   units.json     읽기 단위 481(돌발 제외, 엘리베이터 포함 — data/views/timeline/units.csv의 집합)
 *   ticks.json     공개 자리 158 — 컷오프 슬라이더의 눈금
 *   scenes.json    씬 메타(ID · 단위 · 순서 · 제목 · 줄 수 · 파트) — 본문 없음
 *   records.json   확정 기록 1회독(F · Q · F-k · Q-k · S), records2.json 2회독 + 마무리(I · E · D · U · O · H)
 *                  사실 · 의문은 단계별 단위(reveals.csv): know_units(처음 밝혀짐 · 보강 · 제기 — 없으면 [unit]) · hint_units · reversed_units · partial_units · solved_units
 *   threads.json   줄기 60 + 관계 44
 *   targets.json   사전 대상(인물 · 장소 · 조직 · 개념 · 사건 · 물건) + 별칭 + 정체 연결 + 인물 아이콘(icon — site/img/people/{icon}.png)
 *                  + 바뀐 모습(icons — [[공개 자리, 아이콘], …]: 그 메인 챕터부터 이 아이콘, 앞은 icon)
 *                  + 소속 마크(인물 orgs — 실장 니케의 지금 소속(게임 데이터, tick = 공개 자리), affs — 확정 소속 기록 T(공개 자리 tick · 근거 단위 unit — '지난 소속'은 화면에서 전 소속), 조직 mark — site/img/orgs/{mark}.png)
 *   slips.json     설정 오류 추정 메모(기록 파일 slips)
 *
 * DB에서는 허용 칼럼만 SELECT한다(아래 STORY_COLUMNS) — 본문 칼럼은 이름조차 이 파일에 없다.
 */
import fs from 'node:fs';
import { kindOfKey } from '../../records/order.mjs';
import { ROOT, compact, evidenceOut, firstRef, list, num, pick, publishText } from '../lib.mjs';
import { INDEX_FILE as ICONS_FILE, IMG_DIR } from '../portraits.mjs';
/** 소속 마크 색인 — tools/blabla/marks.mjs가 만든다(게임 데이터를 읽는 쪽은 그 도구, 여기는 색인만) */
const ORGS_FILE = `${ROOT}/site/img/orgs/index.json`;

export const name = 'common';

/** stories에서 읽는 칼럼 — 이 밖의 칸은 읽지 않는다(docs/schema.md "테이블") */
const STORY_COLUMNS = ['id', 'kind', 'source', 'category_id', 'title', 'order_index', 'has_text', 'line_count', 'attractive_level'];
const TARGET_COLUMNS = ['id', 'type', 'name', 'kind', 'note', 'lines_in_scope', 'stories_in_scope'];

/** 단위 키 → 종류 ID(format.js KIND와 짝) */
export function kindId(key) {
  if (/^ch\d/.test(key)) return 'main';
  if (key.startsWith('sub:')) return 'sub';
  if (key.startsWith('erelic:')) return 'erelic';
  if (key.startsWith('relic:')) return 'relic';
  if (key.startsWith('side:')) return 'side';
  if (key.startsWith('event_') || key.startsWith('fl:')) return 'event';
  if (key.startsWith('char:')) return 'episode';
  if (key.startsWith('d_ex_elevator')) return 'elevator';
  return 'other';
}

/** 기록 종류 코드(format.js RECORD_KIND와 짝) — 후보의 kind · role에서 */
function recordKind(c) {
  if (c.kind === 'fact') return c.role === 'event' ? 'F-k' : 'F';
  if (c.kind === 'question') return c.role === 'event' ? 'Q-k' : 'Q';
  return { time: 'S', mention: 'I', echo: 'E', change: 'D', life: 'U', closure: 'O', merge: 'H' }[c.kind] ?? null;
}
const READ1_KINDS = new Set(['F', 'Q', 'F-k', 'Q-k', 'S']);

export async function run(ctx) {
  const { db, csv, warn } = ctx;
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const unitByKey = new Map(ctx.units.map((u) => [u.key, u]));
  const unitByCat = new Map(ctx.units.map((u) => [u.cat.id, u]));

  // ── 입력 표 ──
  const unitRows = csv('data/views/timeline/units.csv');
  const tickRows = csv('data/views/timeline/ticks.csv');
  const importance = new Map(csv('data/views/importance/units.csv').map((r) => [r.unit, r]));
  const read2 = new Map(csv('data/views/read2/units.csv').map((r) => [r.unit, r]));
  const chrono = new Map(csv('data/views/timeline/chrono.csv').map((r) => [r.unit, r]));
  const events = new Map(csv('data/views/timeline/events.csv').map((r) => [r.unit, r]));
  const eventScenes = new Map(csv('data/views/timeline/event-scenes.csv').map((r) => [r.scene, r]));
  const roots = new Map(csv('data/views/timeline/records.csv').map((r) => [r.id, r]));
  // 단계별 단위 — 여기까지 읽음이 '본 스토리 목록'일 때(척추 이벤트 · 사이드를 건너뛸 수 있다) 앎 · 상태를 단위로 계산한다
  const STAGE_KEY = { '처음 밝혀짐': 'know_units', 보강: 'know_units', 제기: 'know_units', 암시: 'hint_units', 뒤집힘: 'reversed_units', '일부 회수': 'partial_units', 회수: 'solved_units' };
  const stageUnits = new Map();
  for (const r of csv('data/views/timeline/reveals.csv')) {
    const key = STAGE_KEY[r.stage];
    if (!key || !r.unit) continue;
    const m = stageUnits.get(r.root) ?? stageUnits.set(r.root, {}).get(r.root);
    (m[key] ??= new Set()).add(r.unit);
  }
  const threadRows = new Map(csv('data/views/read1/threads.csv').map((r) => [r.id, r]));
  const unitKeys = new Set(unitRows.map((r) => r.unit));
  const placeOf = new Map(unitRows.map((r) => [r.unit, { tick: num(r.tick), order: num(r.order), date: r.date }]));

  // ── 씬 메타(본문 없음) → 단위 ──
  // 읽기 단위는 카테고리(메인 챕터 · 이벤트 · 인물 · 유실물 …)이거나 씬 하나(서브퀘스트 · 엘리베이터)다.
  const stories = all(`SELECT ${STORY_COLUMNS.join(', ')} FROM stories WHERE kind IN ('scene', 'episode') AND in_scope = 1 ORDER BY category_id, order_index, id`)
    .map((s) => pick(s, STORY_COLUMNS));
  const unitOfScene = (s) => (unitKeys.has(s.id) ? s.id : unitKeys.has(unitByCat.get(s.category_id)?.key) ? unitByCat.get(s.category_id).key : null);
  const scenesOf = new Map();
  const scenes = [];
  let skipped = 0;
  for (const s of stories) {
    const unit = unitOfScene(s);
    if (!unit) { skipped++; continue; } // 금서고로 대신된 블라링크 이벤트의 본문 없는 씬
    const seq = (scenesOf.get(unit)?.length ?? 0) + 1;
    const ev = eventScenes.get(s.id);
    const scene = compact({
      id: s.id, unit, seq, title: s.title ?? null, lines: s.line_count ?? 0, has_text: s.has_text === 0 ? 0 : undefined,
      part: ev?.part || undefined, level: s.kind === 'episode' ? s.attractive_level ?? undefined : undefined,
    });
    scenes.push(scene);
    (scenesOf.get(unit) ?? scenesOf.set(unit, []).get(unit)).push(scene);
  }
  if (skipped) warn({ where: 'scenes', msg: `단위에 안 드는 씬 ${skipped}개를 뺐다(금서고로 대신된 블라링크 이벤트의 본문 없는 씬)` });
  scenes.sort((a, b) => (placeOf.get(a.unit)?.order ?? 1e9) - (placeOf.get(b.unit)?.order ?? 1e9) || a.seq - b.seq);
  const storyById = new Map(stories.map((s) => [s.id, s]));

  // ── 척추 ──
  const spine = new Set(ctx.records.confirmed.filter((c) => c.kind === 'spine' && c.spineUnit).map((c) => c.spineUnit));

  // ── 단위 ──
  const title = (key) => {
    const u = unitByKey.get(key);
    if (u?.source === 'main') return `CH.${String(u.num).padStart(2, '0')} ${u.cat.name}`;
    if (u?.source === 'archive') return events.get(key)?.name || u.title;
    if (u?.source === 'episode') return u.cat.name;
    if (u) return u.title;
    const s = storyById.get(key);
    if (!s) return key;
    const cat = unitByCat.get(s.category_id);
    const catName = cat?.cat?.name;
    if (!catName || cat.source === 'sudden') return s.title ?? key;
    return s.title && s.title.startsWith(catName) ? s.title : `${catName} · ${s.title ?? key}`;
  };
  const units = unitRows.map((r) => {
    const key = r.unit;
    const u = unitByKey.get(key);
    const kind = kindId(key);
    const im = importance.get(key);
    const r2 = read2.get(key);
    const ch = chrono.get(key);
    const scs = scenesOf.get(key) ?? [];
    const grade = kind === 'main' ? '메인' : spine.has(key) ? '척추' : im?.grade || null;
    return compact({
      key, kind, title: title(key), name: kind === 'main' ? u.cat.name : undefined, num: kind === 'main' ? u.num : undefined,
      order: num(r.order), tick: num(r.tick), date: r.date, date_confidence: r.confidence || undefined, via: r.via || undefined,
      grade, layer: num(r2?.layer), chars: num(r2?.chars), scenes: scs.length, lines: scs.reduce((n, s) => n + (s.lines ?? 0), 0),
      chrono: ch ? compact({ class: ch.class, place: ch.place, lo: num(ch.lo), hi: num(ch.hi), release_main: ch.release_main, drift: ch.drift }) : undefined,
      judgment: im?.judgment || undefined, spine: spine.has(key) ? true : undefined,
    });
  });

  // ── 공개 자리 ──
  let upto = null;
  const ticks = tickRows.map((r) => {
    if (r.main) upto = r.main;
    return compact({ tick: num(r.tick), date: r.date, main: r.main || undefined, upto: upto ?? undefined, count: num(r.count), units: list(r.units) });
  });

  // ── 기록(확정만) ──
  const text = (v, where) => publishText(v, where, warn);
  const threadsOfRoot = (id) => list(roots.get(id)?.threads);
  const rootOf = (c) => (c.role === 'event' ? c.parent : c.id);
  const records1 = [];
  const records2 = [];
  const threadsOfPoints = (points) => [...new Set((Array.isArray(points) ? points : []).flatMap((p) => threadsOfRoot(String(p).replace(/-\d+$/, ''))))];
  for (const c of ctx.records.confirmed) {
    const kind = recordKind(c);
    if (!kind) continue;
    const o = c.obj ?? {};
    const unit = c.unit ?? c.closureEnd ?? null;
    const place = placeOf.get(unit) ?? {};
    const { scene, line } = firstRef(c.evidence);
    const where = `${c.id}`;
    const rec = {
      id: c.id, kind, unit, scene, line, evidence: evidenceOut(c.evidence),
      text: kind === 'I' || kind === 'D' ? text(o.text, `${where} text`) : text(c.text, `${where} text`),
      about: Array.isArray(o.about) ? o.about : undefined, confidence: c.confidence, tick: place.tick, order: place.order,
      reason: text(c.reason, `${where} reason`), user: c.by === '사용자' ? true : undefined,
    };
    if (kind === 'F' || kind === 'Q') {
      const r = roots.get(c.id);
      Object.assign(rec, {
        threads: threadsOfRoot(c.id), state: r?.state || undefined, first_tick: num(r?.first_tick), hint_tick: num(r?.hint_tick),
        reinforce: num(r?.reinforce) || undefined, callbacks: num(r?.callbacks) || undefined, reversed_tick: num(r?.reversed_tick),
        replaced_by: r?.replaced_by || undefined, partial_tick: num(r?.partial_tick), solved_tick: num(r?.solved_tick), last_tick: num(r?.last_tick),
        root_units: num(r?.units) || undefined,
      });
      // 단계별 단위(공개 자리순) — know_units가 [unit] 하나뿐이면 싣지 않는다(읽는 쪽이 [unit]으로 본다)
      const su = stageUnits.get(c.id) ?? {};
      const byPlace = (set) => (set ? [...set].sort((a, b) => (placeOf.get(a)?.order ?? 0) - (placeOf.get(b)?.order ?? 0)) : undefined);
      const know = byPlace(su.know_units);
      if (know && !(know.length === 1 && know[0] === unit)) rec.know_units = know;
      for (const k of ['hint_units', 'reversed_units', 'partial_units', 'solved_units']) if (su[k]) rec[k] = byPlace(su[k]);
    } else if (kind === 'F-k' || kind === 'Q-k') {
      Object.assign(rec, { act: c.act, parent: c.parent, answer: o.answer, degree: o.degree, replaced_by: o.replacedBy, threads: threadsOfRoot(c.parent) });
    } else if (kind === 'S') {
      Object.assign(rec, { time_kind: o.kind, ref: o.ref, subject: o.subject, at: Array.isArray(o.at) ? o.at : undefined, years: o.years });
    } else if (kind === 'I') {
      Object.assign(rec, { target: o.target, speaker: o.speaker ? true : undefined, about: [o.target] });
    } else if (kind === 'E') {
      Object.assign(rec, { act: c.act, points: o.points, threads: threadsOfPoints(o.points) });
    } else if (kind === 'D') {
      Object.assign(rec, {
        person: o.person, aspect: o.aspect, act: c.act, before: text(o.before, `${where} before`), after: text(o.after, `${where} after`),
        with: Array.isArray(o.with) ? o.with : undefined, trigger: text(o.trigger, `${where} trigger`), time: o.time, points: o.points,
        about: [o.person, ...(Array.isArray(o.with) ? o.with : [])].filter(Boolean), threads: threadsOfPoints(o.points),
      });
    } else if (kind === 'U') {
      Object.assign(rec, { topic: o.topic, points: o.points, threads: threadsOfPoints(o.points) });
    } else if (kind === 'O') {
      Object.assign(rec, { type: o.type, chain: o.chain, built: o.built, end: o.end, closing: o.closing });
    } else if (kind === 'H') {
      Object.assign(rec, { title: o.title, end: o.end, members: o.members });
    }
    (READ1_KINDS.has(kind) ? records1 : records2).push(compact(rec));
  }
  const sortRec = (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.scene).localeCompare(String(b.scene)) || (a.line ?? 0) - (b.line ?? 0);
  records1.sort(sortRec);
  records2.sort(sortRec);

  // ── 줄기 · 관계 ──
  const leadThreads = ctx.records.ds.leads?.data?.threads ?? [];
  const ownersOf = new Map(leadThreads.map((t) => [t.thread, Array.isArray(t.owners) ? t.owners : []]));
  const threads = ctx.records.membership.threads.map((t) => {
    const o = t.c.obj ?? {};
    const row = threadRows.get(t.id);
    return compact({
      id: t.id, title: o.title, text: text(o.text, `${t.id} text`), weight: o.weight, status: t.c.status, confidence: o.confidence,
      questions: t.questions, facts: t.facts, about: Array.isArray(o.about) ? o.about : undefined, owners: ownersOf.get(t.id),
      open: num(row?.open), partial: num(row?.partial), solved: num(row?.solved), events: num(row?.events), units: num(row?.units),
      first_unit: row?.first_unit || undefined, first_order: num(row?.first_order), last_unit: row?.last_unit || undefined, last_order: num(row?.last_order),
    });
  });
  const relations = ctx.records.confirmed.filter((c) => c.kind === 'relation').map((c) => {
    const o = c.obj ?? {};
    return compact({ id: c.id, type: o.type, from: o.a, to: o.b, text: text(o.text, `${c.id} text`), basis: Array.isArray(o.evidence) ? o.evidence : undefined, confidence: o.confidence });
  });

  // ── 사전 대상 ──
  const names = new Map();
  for (const n of all('SELECT target_id, name, how FROM target_names')) {
    if (n.how === '표준명') continue;
    (names.get(n.target_id) ?? names.set(n.target_id, []).get(n.target_id)).push({ name: n.name, how: n.how });
  }
  // 같은 인물(정체 연결) — 밝혀지는 자리 = 근거 첫 씬이 든 단위(same_as_unit, same_as와 같은 순서). 화면은 그 단위를 읽었을 때만 보인다
  const sameAs = new Map();
  const sameAsUnit = new Map();
  for (const l of all("SELECT a, b, evidence FROM target_links WHERE status = '확정' AND type = 'same_as'")) {
    const { scene } = firstRef(JSON.parse(l.evidence || '[]'));
    const unit = scenes.find((s) => s.id === scene)?.unit ?? null;
    if (!unit) warn({ where: 'same_as', msg: `${l.a} = ${l.b}: 근거 씬 ${scene ?? '없음'}의 단위가 없다 — 읽는 중에는 늘 숨는다` });
    for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) {
      (sameAs.get(x) ?? sameAs.set(x, []).get(x)).push(y);
      (sameAsUnit.get(x) ?? sameAsUnit.set(x, []).get(x)).push(unit);
    }
  }
  // 인물 아이콘(W11) — tools/site/portraits.mjs가 받아 둔 것만. 없으면 칸을 비운다
  const icons = fs.existsSync(ICONS_FILE) ? JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8')) : {};
  // 바뀐 모습 — tools/views/portrait-forms.mjs가 메인 챕터마다 정한 것(data/views/portraits/forms.csv). 받아 둔 아이콘만
  const iconForms = new Map();
  const FORMS_CSV = 'data/views/portraits/forms.csv';
  for (const r of fs.existsSync(`${ROOT}/${FORMS_CSV}`) ? csv(FORMS_CSV) : []) {
    if (!fs.existsSync(`${IMG_DIR}/${r.icon}.png`)) { warn({ where: 'portraits', msg: `${r.target} 모습 ${r.icon}을 받지 않았다 — node tools/site/portraits.mjs` }); continue; }
    (iconForms.get(r.target) ?? iconForms.set(r.target, []).get(r.target)).push([num(r.tick), r.icon]);
  }
  // 소속 마크 — tools/blabla/marks.mjs가 모은 게임 소속(실장 니케의 지금 소속)과 받아 둔 마크, 확정 소속 기록(T — annotations/affiliations.json)
  const marks = fs.existsSync(ORGS_FILE) ? JSON.parse(fs.readFileSync(ORGS_FILE, 'utf8')) : null;
  if (!marks) warn({ where: 'orgs', msg: '소속 마크가 없다 — node tools/blabla/marks.mjs' });
  const markOfOrg = new Map();
  for (const [sec, type] of [['corporations', 'corp'], ['squads', 'squad']]) for (const m of Object.values(marks?.[sec] ?? {})) if (m.org && m.icon && !markOfOrg.has(m.org)) markOfOrg.set(m.org, m.icon);
  const sceneUnit = new Map(scenes.map((s) => [s.id, s.unit]));
  const affsOf = new Map();
  for (const c of ctx.records.confirmed.filter((x) => x.kind === 'affil')) {
    const o = c.obj ?? {};
    const { scene } = firstRef(c.evidence);
    const place = placeOf.get(sceneUnit.get(scene)) ?? {};
    if (place.tick == null) warn({ where: 'orgs', msg: `${c.id}: 근거 씬 ${scene}의 공개 자리가 없다` });
    (affsOf.get(o.person) ?? affsOf.set(o.person, []).get(o.person)).push(compact({
      id: c.id, org: o.org, act: o.act, role: o.role ? text(o.role, `${c.id} role`) : undefined, tick: place.tick, order: place.order, unit: sceneUnit.get(scene), confidence: c.confidence,
    }));
  }
  // 게임 시작 로스터(affiliations.json game.launch — 사용자 확인): 호감도 단위가 없어도 출시 자리를 맨 처음(1)으로 본다
  const launch = new Set(JSON.parse(fs.readFileSync(`${ROOT}/annotations/affiliations.json`, 'utf8')).game?.launch?.resource_ids ?? []);
  const gameOrgs = new Map();
  if (marks) {
    const chars = all('SELECT resource_id, name, target_id FROM characters WHERE target_id IS NOT NULL ORDER BY resource_id');
    const tname = new Map(all("SELECT id, name FROM targets WHERE type = 'person'").map((t) => [t.id, t.name]));
    // 표준명과 같은 이름의 판을 먼저 — 다른 판(이노센트 데이즈 등)의 소속이 다르면 via(판 이름)를 붙여 뒤에
    chars.sort((a, b) => (b.name === tname.get(b.target_id)) - (a.name === tname.get(a.target_id)) || a.resource_id - b.resource_id);
    for (const c of chars) {
      const [corp, squad] = marks.chars[String(c.resource_id)] ?? [];
      if (!corp) continue;
      const list = gameOrgs.get(c.target_id) ?? gameOrgs.set(c.target_id, []).get(c.target_id);
      const via = list.length && c.name !== tname.get(c.target_id) ? c.name : undefined;
      for (const [type, code, m] of [['corp', corp, marks.corporations[corp]], ['squad', squad, marks.squads[squad]]]) {
        if (!m) { warn({ where: 'orgs', msg: `${c.name}: 모르는 게임 코드 ${code}` }); continue; }
        // 공개 자리(W12d — docs/annotations.md "게임 소속의 공개 자리"): 원문에 이름이 없는 소속(null)은 0(늘), 아니면
        // 그 판의 출시(호감도 단위 char:<rid> — 프로필에 소속이 보인다)와 그 조직의 확정 기록 T(소속 · 합류) 가운데 이른 것. 둘 다 없으면 칸을 비운다(전부 보기에서만)
        const rel = placeOf.get(`char:${c.resource_id}`)?.tick ?? (launch.has(c.resource_id) ? 1 : undefined);
        const recTicks = (affsOf.get(c.target_id) ?? []).filter((a) => m.org && a.org === m.org && (a.act === '소속' || a.act === '합류') && a.tick != null).map((a) => a.tick);
        const tick = m.org ? (rel != null || recTicks.length ? Math.min(rel ?? Infinity, ...recTicks) : undefined) : 0;
        const same = list.find((x) => x.type === type && x.name === m.name);
        if (same) { if (tick != null && (same.tick == null || tick < same.tick)) same.tick = tick; continue; }
        list.push(compact({ type, org: m.org ?? undefined, name: m.name, mark: m.icon, via, tick }));
      }
    }
  }
  // 같은 인물(정체 연결)의 다른 이름 — 소속 기록은 대표 ID 하나에만 적는다(docs/annotations.md "소속 기록"). 기록도 게임 소속도 없는 이름(레비 ↔ 레비아탄)은
  // 대표의 기록을 빌려 보이되, 정체가 밝혀지는 단위(same_as_unit)보다 앞서 보이지 않게 그 자리로 늦춘다(from = 기록을 적은 이름). 게임 소속이 있는 판(모더니아)은 게임 데이터 그대로
  for (const [id, others] of sameAs) {
    if (!id.startsWith('person:') || affsOf.has(id) || gameOrgs.has(id)) continue;
    const lent = [];
    others.forEach((o, i) => {
      const reveal = placeOf.get(sameAsUnit.get(id)?.[i]);
      if (!reveal?.tick || !affsOf.has(o)) return;
      for (const a of affsOf.get(o)) lent.push({ ...a, tick: Math.max(a.tick ?? 0, reveal.tick), order: Math.max(a.order ?? 0, reveal.order ?? 0), from: o });
    });
    if (lent.length) affsOf.set(id, lent);
  }
  for (const l of affsOf.values()) l.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.id.localeCompare(b.id, 'en', { numeric: true }));
  const targets = all(`SELECT ${TARGET_COLUMNS.join(', ')} FROM targets ORDER BY type, id`).map((t) => {
    const r = pick(t, TARGET_COLUMNS);
    return compact({
      id: r.id, type: r.type, name: r.name, kind: r.kind, note: text(r.note, `${r.id} note`), aliases: names.get(r.id),
      same_as: sameAs.get(r.id), same_as_unit: sameAsUnit.get(r.id), lines: r.lines_in_scope || undefined, stories: r.stories_in_scope || undefined, icon: icons[r.id], icons: iconForms.get(r.id),
      orgs: gameOrgs.get(r.id), affs: affsOf.get(r.id), mark: r.type === 'org' ? markOfOrg.get(r.id) : undefined,
    });
  });

  // ── 설정 오류 추정 메모 ──
  const slips = [];
  for (const f of ctx.records.ds.files) {
    const d = f.data;
    if (!Array.isArray(d?.slips) || !d.slips.length) continue;
    for (const s of d.slips) {
      if (typeof s !== 'string') continue;
      const sceneIds = [...new Set((s.match(/\b(?:d_[a-z0-9_]+|event_[A-Za-z0-9_]+|ep:[a-z0-9_]+|(?:fl|side|sub|relic|erelic):[^\s#),·]+)/g) ?? []).filter((id) => storyById.has(id)))];
      slips.push(compact({ unit: d.unit, tick: placeOf.get(d.unit)?.tick, scenes: sceneIds, text: text(s, `${d.unit} slips`) }));
    }
  }

  ctx.common = { units, ticks, scenes, records: [...records1, ...records2], threads, relations, targets, slips, scenesOf, placeOf, kindOf: kindOfKey };
  return {
    files: {
      'units.json': units, 'ticks.json': ticks, 'scenes.json': scenes, 'records.json': records1, 'records2.json': records2,
      'threads.json': { threads, relations }, 'targets.json': targets, 'slips.json': slips,
    },
  };
}
