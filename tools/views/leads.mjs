/**
 * X3f ① · X3f-1c — 주역 명단 초안(T3-6, docs/views.md 화면 1). 주역 = **뼈대 줄기의 주인**(줄기마다 그 줄기가 정체를 묻는 1–2명) + **카운터스 · 지휘관**(사용자, 2026-10-09).
 * 누가 주인인지는 Claude가 annotations/leads.json `threads[].owners` · `counters`에 근거와 함께 적는다 — 이 도구는 그 사람들의 자리(from) · 범위를 척추 축에서 기계로 세고,
 * 명단(Z<n>)과 견준다. 손으로 넣고 빼지 않는다(사용자) — 주인을 바꾸려면 owners를 고친다. 형식 · 쓰임은 docs/annotations.md "주역 명단".
 *
 *   node tools/views/leads.mjs            → data/views/leads/ (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/leads.mjs --example  예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   명단 · 한 사람: node tools/records.mjs leads [인물] · 주인 · 카운터스인데 명단에 없는 사람을 후보로: node tools/records.mjs leads --add
 *
 * 축(chapters) = 메인 챕터 + 척추 이벤트 · 사이드(annotations/spine.json 확정)를 읽는 순서대로 — 척추 단위도 메인 챕터처럼 한 자리로 센다(docs/importance.md 1절). 그래서 from에 척추 키가 올 수 있다.
 * 같은 인물 합침(X3f-1c): 확정 정체 연결(people.json same_as)의 인물은 한 사람으로 센다(신데렐라 = 아나키오르 = 거울 공주 …). 대표 = 뼈대 줄기 about에 먼저 나온 ID,
 *   없으면 말한 줄이 가장 많은 ID(tools/records/model.mjs sameAsGroups). 명단의 person은 대표 ID다.
 * 축의 자리 c · 인물 p마다 (원문은 읽지 않는다 — DB와 기록에서 센다):
 *   ⓐ lines    이름표로 말한 줄(lines.speaker_target ∈ p의 묶음, 2회독 암시 언급의 speaker 줄 포함). 지휘관은 Self 창. 몫 = 그 자리 대사(Speech · Self) 가운데
 *   ⓑ scenes   이름이 나온 씬(언급 DB scene_targets — 말함 · 이름 · 별칭, 2회독 암시 언급 포함). 몫 = 그 자리 씬 가운데
 *   ⓒ threads  뼈대 줄기 가운데 about에 p가 든 것의 기록(의문 · 사건 · 사실)이 그 자리에 있다
 *   ⓓ changes  그 자리의 2회독 인물 변화(D — 기준 · 변화). 근거 기록(records)에는 주인인 줄기 · about 줄기와 신념 · 기억 · 소속 · 신체 변화 앞 3건을 든다
 * 걸림(hit): 씬 몫 ≥ SCENE_SHARE · 대사 몫 ≥ LINE_SHARE · 나온 자리에 ⓓ가 있음(여기까지 '중심') · 이름이 나온 자리에 ⓒ가 있음 — 하나라도.
 * 구간(run): 걸린 자리를 차례로, 사이가 GAP자리 이하로 비면 잇는다. 걸린 자리 MIN_HITS 이상이고 구간의 절반 이상이 걸리면 '고른 구간'.
 * 초안(주인 · 카운터스만): from = 첫 고른 구간에서 처음 '중심'인 자리(줄기 기록에 이름만 걸린 자리는 잇기만 한다). 고른 구간이 없으면 처음 중심인 자리 → 처음 걸린 자리 → 주인인 줄기가 처음 제기된 자리.
 *   범위 = from부터 끝까지 걸린 자리가 WHOLE_SHARE 이상이면 메인 전체, 아니면 구간(from부터의 구간들). 지휘관은 플레이어 시점 인물이라 늘 걸린다(Self 창이 대사 몫).
 *   확신도 = 전체이고 고른 구간이 하나면 확실, 아니면 추정.
 * 초안은 출발점일 뿐이다 — 확정은 명단 파일에서(근거 · 이유 · 확신도). 주역은 내려가지 않는다 — 범위는 표시 · 근거용. 단계로 나누지 않는다(주역이면 원점 하나가 필수).
 * 같은 기록 · DB면 같은 결과다(정렬 끝까지 결정적). 원문 대사는 담지 않는다(수 · ID만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, compareIds, displayPath, isRecord, loadDataset, sameAsGroups, spineUnits } from '../records/model.mjs';
import { kindOfKey, loadOrder } from '../records/order.mjs';
import { mentionRows } from '../records/read2.mjs';
import { threadMembership } from '../records/threads.mjs';

export const LEADS_DIR = path.join(ROOT, 'data/views/leads');
export const SCENE_SHARE = 0.4;
export const LINE_SHARE = 0.1;
export const GAP = 2;
export const MIN_HITS = 3;
export const WHOLE_SHARE = 0.6;
export const COMMANDER = 'person:지휘관';
/** 근거 기록으로 드는 인물 변화의 측면 — 정체 · 동기(관계 · 성격은 곁 인물에도 흔하다) */
export const DEEP_ASPECTS = ['신념', '기억', '소속', '신체'];
/** 근거 기록으로 드는 인물 변화 수(줄기 뒤에) */
const DEEP_RECORDS = 3;

const arr = (x) => (Array.isArray(x) ? x : []);
/** 아크 표기 — "ch20-ch29" (한 자리면 "ch19") */
export const arcText = (a, b) => (a === b ? a : `${a}-${b}`);

/** 메인 챕터 — 읽는 순서대로 */
export function mainChapters(order) {
  const out = [];
  for (const it of order.items) if (kindOfKey(it.key) === '메인' && !out.includes(it.key)) out.push(it.key);
  return out;
}

/** 척추 축 — 메인 챕터 + 척추 이벤트 · 사이드를 읽는 순서대로 */
export function spineAxis(order, spine) {
  const out = [];
  for (const it of order.items) if ((kindOfKey(it.key) === '메인' || spine.has(it.key)) && !out.includes(it.key)) out.push(it.key);
  return out;
}

/**
 * 같은 인물 대표 고르기 — 뼈대 줄기 about에 먼저 나온 ID, 없으면 말한 줄이 많은 ID, 그래도 같으면 ID 순
 * @returns {{ canon: (p: string) => string, groups: Map<string, string[]> }} groups: 대표 → 묶음 전부
 */
export function identityCanon(ds, tm, linesOf) {
  const same = sameAsGroups(ds);
  const rank = new Map();
  let i = 0;
  for (const t of tm.threads) {
    if (t.weight !== '뼈대') continue;
    for (const a of arr(t.c.obj?.about)) if (String(a).startsWith('person:') && !rank.has(a)) rank.set(a, i++);
  }
  const groups = new Map();
  const canonOf = new Map();
  for (const [p, xs] of same) {
    if (canonOf.has(p)) continue;
    const best = [...xs].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || (linesOf(b) ?? 0) - (linesOf(a) ?? 0) || a.localeCompare(b))[0];
    for (const x of xs) canonOf.set(x, best);
    groups.set(best, xs);
  }
  return { canon: (p) => canonOf.get(p) ?? p, groups };
}

/**
 * 척추 축 자리마다 인물 신호
 * @returns {{ chapters: string[], totals: Map, persons: Map<string, object>, threads: object[], owners: Map<string, object>, counters: Set<string>, pool: Set<string>, groups: Map<string, string[]> }}
 *   persons.get(p) = { person, members[], role, byCh: Map<자리, {lines, lineShare, scenes, sceneShare, threads[], changes[], hit, center}>, threads[], owns[], changes[], deep[], runs[], draft }
 */
export function leadSignals(ds, ctx, order) {
  const spine = spineUnits(ds);
  const chapters = spineAxis(order, spine);
  const sceneCh = new Map();
  const totals = new Map();
  for (const ch of chapters) {
    const scenes = ctx.resolve(ch)?.scenes ?? [];
    for (const s of scenes) sceneCh.set(s, ch);
    totals.set(ch, { scenes: scenes.length, lines: 0 });
  }
  const all = (sql) => ctx.db.prepare(sql).all();
  const tm = threadMembership(ds);
  // 같은 인물 대표 — 말한 줄(게임 전체)로 가른다
  const linesAll = new Map(all("SELECT speaker_target t, count(*) n FROM lines WHERE window = 'Speech' AND speaker_target LIKE 'person:%' GROUP BY speaker_target").map((r) => [r.t, r.n]));
  const { canon, groups } = identityCanon(ds, tm, (p) => linesAll.get(p));
  const persons = new Map();
  const P = (p) => {
    if (!persons.has(p)) persons.set(p, { person: p, members: groups.get(p) ?? [p], role: '', byCh: new Map(), threads: [], owns: [], changes: [], deep: [] });
    return persons.get(p);
  };
  const C = (p, ch) => {
    const x = P(p);
    if (!x.byCh.has(ch)) x.byCh.set(ch, { lines: 0, lineShare: 0, scenes: new Set(), sceneShare: 0, threads: [], changes: [], hit: false, center: false });
    return x.byCh.get(ch);
  };
  for (const r of all("SELECT story_id, window, speaker_target t, count(*) n FROM lines WHERE window IN ('Speech', 'Self') GROUP BY story_id, window, speaker_target")) {
    const ch = sceneCh.get(r.story_id);
    if (!ch) continue;
    totals.get(ch).lines += r.n;
    const p = r.window === 'Self' ? COMMANDER : r.t;
    if (p && String(p).startsWith('person:')) C(canon(p), ch).lines += r.n;
  }
  for (const r of all("SELECT story_id, target FROM scene_targets WHERE target LIKE 'person:%'")) {
    const ch = sceneCh.get(r.story_id);
    if (ch) C(canon(r.target), ch).scenes.add(r.story_id);
  }
  // 2회독 암시 언급 — 이름 없이 가리킨 씬, speaker면 말한 줄
  for (const m of mentionRows(ds)) {
    const ch = sceneCh.get(m.scene);
    if (!ch || !String(m.target ?? '').startsWith('person:')) continue;
    const c = C(canon(m.target), ch);
    c.scenes.add(m.scene);
    if (m.speaker) c.lines += m.to_seq - m.from_seq + 1;
  }
  // 지휘관은 모든 자리에 있다(플레이어 시점)
  for (const ch of chapters) C(COMMANDER, ch);
  // ⓒ 뼈대 줄기 — about 인물마다, 그 줄기의 기록이 든 자리. 주인(owners)은 leads.json에서
  const leadsData = ds.leads?.data && typeof ds.leads.data === 'object' ? ds.leads.data : {};
  const ownersOf = new Map(arr(leadsData.threads).map((t) => [t?.thread, { owners: arr(t?.owners).map(canon), reason: t?.reason ?? '', confidence: t?.confidence ?? '' }]));
  const counters = new Set(arr(leadsData.counters).map(canon));
  const byId = new Map(ds.candidates.filter((c) => c.id && c.status !== '기각' && isRecord(c)).map((c) => [c.id, c]));
  const threads = [];
  for (const t of tm.threads) {
    if (t.weight !== '뼈대') continue;
    const chs = [...new Set([...t.questions, ...t.events, ...t.facts].map((id) => byId.get(id)?.unit).filter((u) => sceneCh.size && chapters.includes(u)))]
      .sort((a, b) => chapters.indexOf(a) - chapters.indexOf(b));
    const about = [...new Set(arr(t.c.obj?.about).filter((a) => String(a).startsWith('person:')).map(canon))];
    const own = ownersOf.get(t.id) ?? null;
    threads.push({ id: t.id, title: t.title, about, owners: own?.owners ?? [], ownerReason: own?.reason ?? '', ownerConfidence: own?.confidence ?? '', listed: Boolean(own), chapters: chs, first: chs[0] ?? null });
    for (const p of about) {
      P(p).threads.push(t.id);
      for (const ch of chs) C(p, ch).threads.push(t.id);
    }
    for (const p of own?.owners ?? []) {
      P(p).owns.push(t.id);
      for (const ch of chs) if (!C(p, ch).threads.includes(t.id)) C(p, ch).threads.push(t.id);
    }
  }
  // ⓓ 인물 변화(척추 축 안)
  for (const c of ds.candidates) {
    if (c.kind !== 'change' || !c.id || c.status === '기각' || !chapters.includes(c.unit)) continue;
    const p = c.obj?.person ? canon(c.obj.person) : null;
    if (!p) continue;
    P(p).changes.push(c.id);
    if (DEEP_ASPECTS.includes(c.obj?.aspect)) P(p).deep.push(c.id);
    C(p, c.unit).changes.push(c.id);
  }
  // 주역 후보 풀 = 주인 + 카운터스 · 지휘관
  const pool = new Set([...[...ownersOf.values()].flatMap((o) => o.owners), ...counters, COMMANDER]);
  for (const p of pool) P(p);
  for (const x of persons.values()) {
    x.changes.sort(compareIds);
    x.deep.sort(compareIds);
    x.owns = [...new Set(x.owns)].sort(compareIds);
    x.threads = [...new Set(x.threads)].sort(compareIds);
    x.role = [x.owns.length ? `${x.owns.join(' · ')}의 주인` : '', x.person === COMMANDER ? '지휘관' : counters.has(x.person) ? '카운터스' : ''].filter(Boolean).join(' · ');
    for (const [ch, c] of x.byCh) {
      const t = totals.get(ch);
      c.scenes = c.scenes.size;
      c.lineShare = t.lines ? c.lines / t.lines : 0;
      c.sceneShare = t.scenes ? c.scenes / t.scenes : 0;
      c.center = x.person === COMMANDER || c.sceneShare >= SCENE_SHARE || c.lineShare >= LINE_SHARE || ((c.scenes > 0 || c.lines > 0) && c.changes.length > 0);
      c.hit = c.center || (c.scenes > 0 && c.threads.length > 0);
    }
    x.runs = runsOf(chapters, x.byCh);
    x.draft = pool.has(x.person) ? draftOf(x, chapters, threads) : null;
  }
  return { chapters, totals, persons, threads, owners: ownersOf, counters, pool, groups };
}

/** 걸린 자리를 구간으로 — 사이가 GAP자리 이하로 비면 잇는다. even: 걸린 자리 MIN_HITS 이상 · 구간의 절반 이상 */
function runsOf(chapters, byCh) {
  const hits = chapters.filter((ch) => byCh.get(ch)?.hit);
  const runs = [];
  for (const ch of hits) {
    const last = runs.at(-1);
    if (last && chapters.indexOf(ch) - chapters.indexOf(last.to) <= GAP + 1) {
      last.to = ch;
      last.hits.push(ch);
    } else runs.push({ from: ch, to: ch, hits: [ch] });
  }
  for (const r of runs) {
    const span = chapters.indexOf(r.to) - chapters.indexOf(r.from) + 1;
    r.even = r.hits.length >= MIN_HITS && r.hits.length * 2 >= span;
  }
  return runs;
}

/** 초안(주인 · 카운터스) — { from, arcs[], scope, confidence, records[], reason }. from은 기계 그대로(손으로 앞당기지 않는다) */
function draftOf(x, chapters, threads) {
  const even = x.runs.filter((r) => r.even);
  const centers = chapters.filter((ch) => x.byCh.get(ch)?.center);
  const hitsAll = chapters.filter((ch) => x.byCh.get(ch)?.hit);
  const threadFirst = threads.filter((t) => x.owns.includes(t.id) && t.first).map((t) => t.first).sort((a, b) => chapters.indexOf(a) - chapters.indexOf(b))[0] ?? null;
  const from = even.length ? even[0].hits.find((ch) => x.byCh.get(ch).center) ?? even[0].hits[0] : centers[0] ?? hitsAll[0] ?? threadFirst ?? chapters[0];
  const how = even.length ? '첫 고른 구간의 처음 중심' : centers.length ? '처음 중심(고른 구간 없음)' : hitsAll.length ? '처음 걸림(중심 없음)' : threadFirst ? '주인인 줄기가 처음 제기된 자리(걸림 없음)' : '축 처음(신호 없음)';
  const after = chapters.slice(chapters.indexOf(from));
  const hits = after.filter((ch) => x.byCh.get(ch)?.hit).length;
  const whole = hits / after.length >= WHOLE_SHARE;
  // 구간은 from부터(줄기 기록에 이름만 걸린 앞 자리는 뺀다)
  const runs = x.runs.filter((r) => chapters.indexOf(r.to) >= chapters.indexOf(from));
  const arcs = whole ? [] : runs.length ? runs.map((r, i) => arcText(i ? r.from : from, r.to)) : [from];
  const lines = after.reduce((n, ch) => n + (x.byCh.get(ch)?.lines ?? 0), 0);
  const scenes = after.reduce((n, ch) => n + (x.byCh.get(ch)?.scenes ?? 0), 0);
  const records = [...x.owns, ...x.threads.filter((j) => !x.owns.includes(j)), ...x.deep.slice(0, DEEP_RECORDS)];
  const why = [x.role, x.changes.length ? `인물 변화 ${x.changes.length}(신념 · 기억 · 소속 · 신체 ${x.deep.length})` : ''].filter(Boolean).join(' · ');
  return {
    from, how, arcs, scope: whole ? '전체' : '구간', confidence: whole && even.length === 1 ? '확실' : '추정', records,
    reason: `${from}부터(${how}) 걸린 자리 ${hits}/${after.length}${even.length ? `(고른 구간 ${even.map((r, i) => `${arcText(i ? r.from : from, r.to)} ${r.hits.length}`).join(' · ')})` : ''} · 말한 줄 ${lines} · 이름이 나온 씬 ${scenes} — ${why}`,
  };
}

/** 한 사람의 축 띠 — 걸림 ●, 이름만 ·, 없음 공백 (10자리마다 sep — 표 안에서는 | 대신 ┆). 척추 이벤트 · 사이드 자리는 ◆(걸림) · ◇(이름만) · ‐(없음) */
export function stripOf(x, chapters, sep = '|') {
  return chapters.map((ch, i) => {
    const c = x.byCh.get(ch);
    const ev = kindOfKey(ch) !== '메인';
    const m = !c ? (ev ? '‐' : ' ') : c.hit ? (ev ? '◆' : '●') : c.scenes || c.lines ? (ev ? '◇' : '·') : (ev ? '‐' : ' ');
    return `${i && i % 10 === 0 ? sep : ''}${m}`;
  }).join('');
}

/** 한 사람의 자리별 표(records.mjs leads <인물>) */
export function renderPerson(x, chapters, { judgment = null } = {}) {
  const L = [];
  const head = judgment ? `${judgment.id} ${judgment.status ?? '?'} · ${judgment.obj?.from ?? '?'}부터 · ${arr(judgment.obj?.arcs).length ? `구간 ${judgment.obj.arcs.join(' · ')}` : '메인 전체'}${judgment.obj?.origin ? ` · 원점 ${judgment.obj.origin}` : ''} (${judgment.confidence ?? '?'}) — ${judgment.reason ?? ''}` : '명단에 없다';
  L.push(`■ ${x.person}${x.members.length > 1 ? ` (= ${x.members.filter((m) => m !== x.person).map((m) => m.replace('person:', '')).join(' · ')})` : ''} — ${head}`);
  L.push(`  역할: ${x.role || '줄기의 주인도 카운터스도 아니다(주역 밖)'}`);
  L.push(`  초안: ${x.draft ? `${x.draft.from}부터 · ${x.draft.scope === '전체' ? '메인 전체' : `구간 ${x.draft.arcs.join(' · ')}`} (${x.draft.confidence}) — ${x.draft.reason}` : '없음(주역 풀 밖)'}`);
  L.push(`  띠 ${chapters[0]}→${chapters.at(-1)}: [${stripOf(x, chapters)}]`);
  if (x.threads.length) L.push(`  뼈대 줄기(about): ${x.threads.join(' · ')}`);
  L.push('', '| 자리 | 말한 줄 (몫) | 이름이 나온 씬 (몫) | 뼈대 줄기 | 인물 변화 | 걸림 |', '|---|---:|---:|---|---|---|');
  for (const ch of chapters) {
    const c = x.byCh.get(ch);
    if (!c || (!c.lines && !c.scenes && !c.threads.length && !c.changes.length)) continue;
    L.push(`| ${ch} | ${c.lines} (${Math.round(c.lineShare * 100)}%) | ${c.scenes} (${Math.round(c.sceneShare * 100)}%) | ${c.threads.join(' ')} | ${c.changes.join(' ')} | ${c.hit ? (c.center ? '●' : '○') : ''} |`);
  }
  return L.join('\n');
}

/**
 * 명단(annotations/leads.json Z) + 초안을 한 표로
 * @returns {{ chapters, threads, rows, leads, drafts, missing: string[], extra: string[], roles: Map<string,string>, groups }}
 *   missing: 주인 · 카운터스인데 명단에 항목이 없는 인물(--add) · revive: 기각된 항목만 있는 인물(set Z… 확정으로 되살린다) · extra: 명단(기각 빼고)에 있는데 주인 · 카운터스가 아닌 인물(기각할 것)
 */
export function buildLeads(ds, ctx, order) {
  const sig = leadSignals(ds, ctx, order);
  const leads = ds.candidates.filter((c) => c.kind === 'lead' && c.id).sort((a, b) => compareIds(a.id, b.id));
  const listed = new Map(leads.filter((c) => c.status !== '기각').map((c) => [c.obj?.person, c]));
  const anyListed = new Set(leads.map((c) => c.obj?.person));
  const drafts = [...sig.persons.values()].filter((x) => x.draft)
    .sort((a, b) => sig.chapters.indexOf(a.draft.from) - sig.chapters.indexOf(b.draft.from) || a.person.localeCompare(b.person));
  // missing: 항목이 아예 없다(--add) · revive: 기각된 항목만 있다(ID는 그대로 두고 set Z… 확정으로 되살린다)
  const missing = drafts.filter((x) => !anyListed.has(x.person)).map((x) => x.person);
  const revive = drafts.filter((x) => anyListed.has(x.person) && !listed.has(x.person)).map((x) => x.person);
  const extra = [...listed.keys()].filter((p) => !sig.pool.has(p));
  const roles = new Map([...sig.persons.values()].filter((x) => x.role).map((x) => [x.person, x.role]));
  const rows = [];
  for (const x of sig.persons.values()) {
    for (const ch of sig.chapters) {
      const c = x.byCh.get(ch);
      if (!c || (!c.lines && !c.scenes && !c.threads.length && !c.changes.length)) continue;
      rows.push({ person: x.person, chapter: ch, lines: c.lines, line_share: c.lineShare.toFixed(3), scenes: c.scenes, scene_share: c.sceneShare.toFixed(3),
        threads: c.threads.join(' '), changes: c.changes.join(' '), hit: c.hit ? 1 : '' });
    }
  }
  rows.sort((a, b) => a.person.localeCompare(b.person) || sig.chapters.indexOf(a.chapter) - sig.chapters.indexOf(b.chapter));
  return { ...sig, rows, leads, drafts, missing, revive, extra, roles };
}

/** 사람이 읽는 보고서 — 명단 확인(X3f-2)에 쓴다 */
export function renderLeadsReport(v, { source = '' } = {}) {
  const L = [];
  L.push('# 주역 명단 (X3f ① · X3f-1c)', '');
  L.push(`출처: ${source} + ${v.leads[0]?.file ?? '(명단 파일 없음)'}(주역 Z · 줄기의 주인) · DB(말한 줄 · 언급 DB) — 규칙 tools/views/leads.mjs 머리말, 형식 · 쓰임 docs/annotations.md "주역 명단".`);
  L.push('주역 = 뼈대 줄기의 주인(줄기마다 1–2명) + 카운터스 · 지휘관(사용자, 2026-10-09). 같은 인물은 합쳤다. 자리(from) · 범위는 기계 그대로다.');
  L.push('뒤집기: 주인을 바꾸려면 `annotations/leads.json` `threads[].owners`(이유를 함께), 항목은 `node tools/records.mjs set Z… 기각|확정 --by 사용자 --note "…"`, 자리 · 범위는 `set Z… 확정 --by 사용자 --from ch20 --arcs "ch20-ch29"`(`--arcs 전체`) · 한 사람: `node tools/records.mjs leads <인물>`.', '');
  const live = v.leads.filter((c) => c.status !== '기각');
  L.push(`- 명단 ${live.length}(확정 ${live.filter((c) => c.status === '확정').length} · 후보 ${live.filter((c) => c.status === '후보').length}) · 기각 ${v.leads.length - live.length} · 주인 · 카운터스 풀 ${v.pool.size}` +
    `${v.missing.length ? ` · **풀에 있는데 명단에 없음 ${v.missing.length}**` : ''}${v.revive.length ? ` · **풀에 있는데 기각된 채 ${v.revive.length}(되살릴 것)**` : ''}${v.extra.length ? ` · **명단에 있는데 풀 밖 ${v.extra.length}(기각할 것)**` : ''}`, '');
  const byPerson = new Map(v.persons);
  const strip = (p) => (byPerson.get(p) ? `\`${stripOf(byPerson.get(p), v.chapters, '┆')}\`` : '');
  const name = (p) => {
    const x = byPerson.get(p);
    const base = String(p ?? '?').replace('person:', '');
    return x && x.members.length > 1 ? `${base} (= ${x.members.filter((m) => m !== p).map((m) => m.replace('person:', '')).join(' · ')})` : base;
  };
  L.push('## 명단', '', `띠: 축 ${v.chapters[0]} → ${v.chapters.at(-1)}(메인 챕터 + 척추 이벤트 · 사이드 ${v.chapters.length}자리), ● 걸린 자리 · \`·\` 이름만 나옴 · 척추 이벤트 · 사이드 자리는 ◆ · ◇ · ‐ · 10자리마다 \`┆\`. 범위가 구간이어도 주역에서 내려가지 않는다.`, '');
  L.push('원점: 주역 조항의 필수 — 정체 · 동기의 원점 사건이 처음 · 가장 온전히 나오는 메인 밖 단위(X3f-3이 정한다, 척추 안이면 그 척추 키, 없으면 "메인").', '');
  L.push('| ID | 인물 | 역할 | 주역이 되는 자리 | 범위 | 원점 | 확신도 | 띠 | 근거 · 이유 |', '|---|---|---|---|---|---|---|---|---|');
  for (const c of [...live].sort((a, b) => v.chapters.indexOf(a.obj?.from) - v.chapters.indexOf(b.obj?.from) || compareIds(a.id, b.id))) {
    const o = c.obj ?? {};
    L.push(`| ${c.id} | ${name(o.person)} | ${v.roles.get(o.person) ?? ''} | ${o.from ?? '?'} | ${arr(o.arcs).length ? `구간 ${o.arcs.join(' · ')}` : '메인 전체'} | ${o.origin ? `\`${o.origin}\`` : ''} | ${c.confidence ?? '?'}${arr(c.reviews).some((r) => r.by === '사용자') ? ' · 사용자' : ''}${c.status === '후보' ? ' · 후보' : ''} | ${strip(o.person)} | ${String(c.reason ?? '').replace(/\|/g, '/')} |`);
  }
  L.push('');
  L.push('## 뼈대 줄기의 주인 — 줄기마다 그 줄기가 정체를 묻는 1–2명 (Claude, annotations/leads.json threads)', '', '| 줄기 | 제목 | 주인 | 확신도 | 까닭 | about 인물 | 축에서 처음 제기 |', '|---|---|---|---|---|---|---|');
  for (const t of v.threads) {
    L.push(`| ${t.id} | ${t.title ?? ''} | ${t.owners.length ? t.owners.map((p) => p.replace('person:', '')).join(' · ') : t.listed ? '(없음)' : '**주인 항목 없음**'} | ${t.ownerConfidence} | ${String(t.ownerReason).replace(/\|/g, '/')} | ${t.about.map((p) => p.replace('person:', '')).join(' · ')} | ${t.chapters.length ? `${t.first} · ${t.chapters.length}자리` : '없음'} |`);
  }
  const cs = [...v.counters].filter((p) => p !== COMMANDER).map((p) => p.replace('person:', ''));
  L.push('', `카운터스(지휘관 포함): ${[...cs, '지휘관'].join(' · ')}`, '');
  if (v.groups.size) {
    L.push('## 합친 같은 인물 — 확정 정체 연결(people.json same_as)', '');
    for (const [p, xs] of [...v.groups].sort((a, b) => a[0].localeCompare(b[0]))) L.push(`- ${p.replace('person:', '')} = ${xs.filter((m) => m !== p).map((m) => m.replace('person:', '')).join(' · ')}`);
    L.push('');
  }
  const rejected = v.leads.filter((c) => c.status === '기각');
  if (rejected.length) {
    L.push('## 기각 — 주인도 카운터스도 아니거나 같은 인물에 합쳤다', '', '| ID | 인물 | 자리 | 띠 | 까닭 |', '|---|---|---|---|---|');
    for (const c of rejected) {
      const o = c.obj ?? {};
      const note = arr(c.reviews).at(-1)?.note ?? c.reason ?? '';
      L.push(`| ${c.id} | ${String(o.person ?? '?').replace('person:', '')} | ${o.from ?? '?'}부터${arr(o.arcs).length ? ` · ${o.arcs.join(' · ')}` : ''} | ${strip(o.person)} | ${String(note).replace(/\|/g, '/')} |`);
    }
    L.push('');
  }
  if (v.missing.length) {
    L.push('## 풀에 있는데 명단에 없음 — `records.mjs leads --add`로 후보를 더한 뒤 확정', '');
    for (const p of v.missing) {
      const d = byPerson.get(p).draft;
      L.push(`- ${p}(${v.roles.get(p) ?? ''}): ${d.from}부터 · ${d.scope}${d.arcs.length ? ` ${d.arcs.join(' · ')}` : ''} — ${d.reason}`);
    }
    L.push('');
  }
  if (v.revive.length) L.push('## 풀에 있는데 기각된 채 — `set Z… 확정 --by claude`로 되살릴 것(ID는 그대로)', '', v.revive.map((p) => `- ${p}`).join('\n'), '');
  if (v.extra.length) L.push('## 명단에 있는데 풀 밖 — 기각할 것', '', v.extra.map((p) => `- ${p}`).join('\n'), '');
  L.push('## 규칙 (tools/views/leads.mjs 머리말)', '',
    `- 걸림: 씬 몫 ≥ ${SCENE_SHARE} · 대사 몫 ≥ ${LINE_SHARE} · 이름이 나온 자리에 뼈대 줄기 기록이나 인물 변화가 있음. 지휘관은 늘 걸린다.`,
    `- 고른 구간: 사이가 ${GAP}자리 이하로 비면 잇고, 걸린 자리 ${MIN_HITS} 이상 · 구간의 절반 이상.`,
    `- from = 첫 고른 구간에서 처음 중심인 자리(없으면 처음 중심 → 처음 걸림 → 주인인 줄기의 첫 자리). 범위 = from부터 끝까지 걸린 자리 ${WHOLE_SHARE * 100}% 이상이면 메인 전체, 아니면 구간.`,
    '- 자리마다 수는 `chapters.csv`(인물 · 자리 · 말한 줄 · 몫 · 이름이 나온 씬 · 몫 · 뼈대 줄기 · 인물 변화 · 걸림).', '');
  return L.join('\n');
}

function csvCell(x) {
  const s = x == null ? '' : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
const COLUMNS = ['person', 'chapter', 'lines', 'line_share', 'scenes', 'scene_share', 'threads', 'changes', 'hit'];

export function writeLeadsViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'chapters.csv'), toCsv(v.rows, COLUMNS));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderLeadsReport(v, opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({ options: { example: { type: 'boolean' } } });
  const dir = opt.example ? EXAMPLE_DIR : READ1_DIR;
  const ds = loadDataset({ dir });
  if (ds.problems.length) {
    for (const p of ds.problems) console.error(`✗ ${p.file}: ${p.msg}`);
    process.exit(1);
  }
  const ctx = await openContext();
  const v = buildLeads(ds, ctx, loadOrder());
  ctx.close();
  const source = displayPath(dir) + '/';
  if (opt.example) console.log(renderLeadsReport(v, { source }));
  else {
    writeLeadsViews(v, LEADS_DIR, { source });
    console.log(`→ ${displayPath(LEADS_DIR)}/ (chapters.csv · report.md)`);
  }
  console.log(`명단 ${v.leads.filter((c) => c.status !== '기각').length} · 주인 · 카운터스 풀 ${v.pool.size} · 명단에 없음 ${v.missing.length} · 풀 밖 ${v.extra.length}`);
}
