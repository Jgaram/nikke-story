/**
 * 공용 데이터(W1) — 모든 탭 · 리더 패널 · 검색이 쓴다. 파일 이름 · 칸은 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 *
 *   units.json     읽기 단위 481(돌발 제외, 엘리베이터 포함 — data/views/timeline/units.csv의 집합)
 *   ticks.json     공개 자리 158 — 컷오프 슬라이더의 눈금
 *   scenes.json    씬 메타(ID · 단위 · 순서 · 제목 · 줄 수 · 파트) — 본문 없음
 *   records.json   확정 기록 1회독(F · Q · F-k · Q-k · S), records2.json 2회독 + 마무리(I · E · D · U · O · H)
 *   threads.json   줄기 60 + 관계 44
 *   targets.json   사전 대상(인물 · 장소 · 조직 · 개념 · 사건 · 물건) + 별칭 + 정체 연결
 *   slips.json     설정 오류 추정 메모(기록 파일 slips)
 *
 * DB에서는 허용 칼럼만 SELECT한다(아래 STORY_COLUMNS) — 본문 칼럼은 이름조차 이 파일에 없다.
 */
import { kindOfKey } from '../../records/order.mjs';
import { compact, evidenceOut, firstRef, list, num, pick, publishText } from '../lib.mjs';

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
    if (u?.source === 'episode') return `${u.cat.name} (호감도 ${scenesOf.get(key)?.length ?? 0}편)`;
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
    const ev = events.get(key);
    const scs = scenesOf.get(key) ?? [];
    const grade = kind === 'main' ? '메인' : spine.has(key) ? '척추' : im?.grade || null;
    return compact({
      key, kind, title: title(key), name: kind === 'main' ? u.cat.name : undefined, num: kind === 'main' ? u.num : undefined,
      order: num(r.order), tick: num(r.tick), date: r.date, date_confidence: r.confidence || undefined, via: r.via || undefined,
      grade, layer: num(r2?.layer), chars: num(r2?.chars), scenes: scs.length, lines: scs.reduce((n, s) => n + (s.lines ?? 0), 0),
      chrono: ch ? compact({ class: ch.class, place: ch.place, lo: num(ch.lo), hi: num(ch.hi), release_main: ch.release_main, drift: ch.drift }) : undefined,
      library: u?.library || key.startsWith('sub:') ? true : undefined,
      replaces: u?.gameKey || ev?.substitute || undefined,
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
  const sameAs = new Map();
  for (const l of all("SELECT a, b FROM target_links WHERE status = '확정' AND type = 'same_as'")) {
    (sameAs.get(l.a) ?? sameAs.set(l.a, []).get(l.a)).push(l.b);
    (sameAs.get(l.b) ?? sameAs.set(l.b, []).get(l.b)).push(l.a);
  }
  const targets = all(`SELECT ${TARGET_COLUMNS.join(', ')} FROM targets ORDER BY type, id`).map((t) => {
    const r = pick(t, TARGET_COLUMNS);
    return compact({
      id: r.id, type: r.type, name: r.name, kind: r.kind, note: text(r.note, `${r.id} note`), aliases: names.get(r.id),
      same_as: sameAs.get(r.id), lines: r.lines_in_scope || undefined, stories: r.stories_in_scope || undefined,
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
