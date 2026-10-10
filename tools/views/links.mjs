/**
 * X2 — 관계선(T3-5): 스토리 사이 엣지를 한 목록으로 모은다. 타입 · origin은 docs/schema.md "엣지 타입", 화면은 docs/views.md 화면 2.
 *
 *   node tools/views/links.mjs            → data/views/links/ (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/links.mjs --example  예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   조회: node tools/query.mjs links <씬 | 단위> [--type character] [--min 2]
 *
 * 엣지는 모두 씬 → 씬이고 방향은 읽는 순서(출시순 한 줄 — docs/history/reading.md R)다. 단위 → 단위는 (from 단위, to 단위, 타입)마다 센 것(같은 단위 안은 뺀다).
 * 출처 다섯 (규칙은 모두 기계적이다 — 해석은 기록 · 수동 엣지 파일에 이미 있다):
 *   게임     DB edges(빌드가 원본에서 만든다) — prereq(호감도 스토리 조건 · 빠진 조건 번호 순 추정) · character(애장품 소유). 시트 엣지(sheet)는 싣지 않는다
 *   sequel   키 · 게임 순서(auto) — 메인 다음 챕터(번호 순) · 서브퀘스트 다음 편(`sub:<이름>_NN` → NN+1) · 유실물 전 → 후(`…-전` → `…-후`) ·
 *            이벤트 → 그 이벤트 유실물(ERELIC_EVENT). 끝점 = 앞 단위의 마지막 씬 → 뒤 단위의 첫 씬.
 *            이벤트 · 사이드 연작은 키로 모른다 — 수동 엣지(annotations/links.json, Claude 확정)
 *   기록     1회독 사건(회수 → setup_payoff · 드러냄 → callback · 뒤집음 → reversal — read1Edges) · 2회독 떡밥(암시 → setup_payoff · 재언급 → callback — read2Edges).
 *            origin record, 기록 ID · 상태를 단다 — 확정 전 후보는 status 칸에 남고 보고서 · 조회가 따로 표시한다
 *   대상 공유 character(인물) · keyword(비인물) — 대상이 단위의 '중심'(CENTER)이면 그 대상이 중심인 바로 앞 단위와 잇는다(대상마다 사슬).
 *            지휘관(플레이어)은 뺀다. 끝점 = 앞 단위에서 대상이 마지막으로 나온 씬 → 뒤 단위에서 처음 나온 씬
 *   수동     annotations/links.json(Y<n>) — mergeEdges(수동이 이기고 자동값은 auto에 보존, drop은 dropped에). 끝점이 단위 키면 단위 쌍으로 견준다
 *
 * 중심(CENTER) — 단위 U에서 대상 T가 중심이다 = 아래 하나:
 *   - U의 기록 2건 이상이 T를 다룬다 — 1회독 사실 · 의문(정의)의 about, 2회독 떡밥 · 생활상의 about, 인물 변화의 person
 *   - 인물: T가 U에서 이름표로 5줄 이상, U의 말한 줄(지휘관 빼고)의 10% 이상을 말한다 — 2회독 암시 언급(speaker)도 말한 줄로 센다
 *   - 비인물: T의 이름(named · alias)이 U에 5줄 이상 나온다
 * 세기(strength 1–3 — "앞 단위를 먼저 볼 만한 정도"):
 *   3 게임 조건 · 다음 편(sequel auto · 수동 3) · 확실한 기록 / 2 추정 기록 · 연작이지만 사이가 떨어진 다음 편(수동 2) · 대상 공유 / 1 흔한 대상 공유.
 *   흔한 대상 = 중심인 단위(spread 칸)가 읽기 단위의 COMMON_SHARE(10%)를 넘는 대상 — note '흔한 대상', 화면 기본값에서 숨기기 좋다.
 * 같은 기록이면 같은 결과다(정렬 끝까지 결정적). 기록 문장 · 원문 대사는 담지 않는다(ID · 대상 · 수만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, compareIds, displayPath, expandLines, isRecord, loadDataset } from '../records/model.mjs';
import { KIND_ORDER, kindOfKey, loadOrder } from '../records/order.mjs';
import { mentionRows, mergeEdges, read2Edges, scenePlaces } from '../records/read2.mjs';
import { ERELIC_EVENT } from '../records/layers.mjs';
import { threadMembership } from '../records/threads.mjs';
import { read1Edges } from './read1.mjs';

export const LINKS_DIR = path.join(ROOT, 'data/views/links');
export const TYPE_ORDER = ['prereq', 'sequel', 'setup_payoff', 'callback', 'reversal', 'character', 'keyword'];
export const TYPE_LABEL = {
  prereq: '선행 조건', sequel: '다음 편', setup_payoff: '떡밥 → 회수', callback: '다시 드러냄 · 재언급', reversal: '뒤집힘', character: '같은 인물', keyword: '같은 대상',
};
/** 중심 기준 — 머리말 */
export const CENTER = { records: 2, speaks: 5, share: 0.1, named: 5 };
/** 흔한 대상 — 중심인 단위가 읽기 단위의 이 몫을 넘는 대상(니케 · 방주 · 라피 …). 대상 공유 세기 1 */
export const COMMON_SHARE = 0.1;
/** 대상 공유에서 빼는 대상 — 지휘관은 플레이어라 어디에나 있다 */
export const SKIP_TARGETS = new Set(['person:지휘관']);
const RECORD_ACT = { setup_payoff: '회수', callback: '드러냄', reversal: '뒤집음' };

const COLUMNS = {
  sceneEdges: ['type', 'origin', 'strength', 'from_scene', 'from_line', 'to_scene', 'to_line', 'from_unit', 'to_unit', 'from_order', 'to_order',
    'record', 'act', 'point', 'target', 'spread', 'from_basis', 'to_basis', 'confidence', 'status', 'note'],
  unitEdges: ['from_unit', 'to_unit', 'type', 'count', 'strength', 'origins', 'unconfirmed', 'records', 'targets', 'from_order', 'to_order', 'from_kind', 'to_kind'],
  units: ['order', 'unit', 'kind', 'in_units', 'out_units', 'strong_units', 'sequel', 'records_units', 'shared_units', 'isolated', 'isolated_strong',
    'record_only_isolated', 'main_in', 'main_out', 'main_units', 'center', 'title'],
  threadTargets: ['thread', 'weight', 'title', 'target', 'type', 'records', 'thread_about', 'sample'],
  targetPairs: ['a', 'b', 'a_type', 'b_type', 'records', 'units', 'sample'],
  centers: ['unit', 'order', 'target', 'type', 'records', 'speaks', 'share', 'named', 'spread', 'why'],
  dropped: ['type', 'origin', 'from_scene', 'to_scene', 'from_unit', 'to_unit', 'record', 'target', 'dropped_by', 'drop_status'],
};
const FILES = { sceneEdges: 'scene-edges.csv', unitEdges: 'unit-edges.csv', units: 'units.csv', centers: 'centers.csv', dropped: 'dropped.csv',
  threadTargets: 'thread-targets.csv', targetPairs: 'target-pairs.csv' };
/** 개념 ↔ 개념 선 — 같은 기록의 about에 이만큼 이상 함께 나온 쌍만 */
export const PAIR_MIN = 2;

const arr = (x) => (Array.isArray(x) ? x : []);
const firstScene = (c) => arr(c?.evidence)[0]?.scene ?? null;
const firstLine = (c) => expandLines(arr(c?.evidence)[0]?.lines ?? []).seqs[0] ?? 0;
const typeRank = (t) => (TYPE_ORDER.indexOf(t) + 1) || 99;
const cmpRecord = (a, b) => (a && b ? compareIds(a, b) : a ? 1 : b ? -1 : 0);

/** 단위 키 → 다음 편 단위 키 (키 · 게임 순서로만 아는 것). 메인은 번호 순 */
export function keySequels(units) {
  const set = new Set(units);
  const out = [];
  const mains = units.filter((u) => /^ch\d+$/.test(u)).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  for (let i = 1; i < mains.length; i++) out.push({ from: mains[i - 1], to: mains[i], note: '다음 챕터' });
  for (const u of units) {
    const m = u.match(/^(sub:.+)_(\d+)$/);
    if (m) {
      const next = `${m[1]}_${String(Number(m[2]) + 1).padStart(m[2].length, '0')}`;
      if (set.has(next)) out.push({ from: u, to: next, note: '서브퀘스트 다음 편' });
    }
    if (u.startsWith('relic:') && u.endsWith('-전') && set.has(`${u.slice(0, -2)}-후`)) out.push({ from: u, to: `${u.slice(0, -2)}-후`, note: '유실물 전 → 후' });
    if (ERELIC_EVENT[u] && set.has(ERELIC_EVENT[u])) out.push({ from: ERELIC_EVENT[u], to: u, note: '이벤트 → 이벤트 유실물' });
  }
  return out;
}

/**
 * 단위마다 대상의 중심 여부 — 언급 DB 자동 줄 + 2회독 암시 언급 + 기록의 대상
 * @returns {{ per: Map<string, Map<string, object>>, total: Map<string, number> }} per: 단위 → 대상 → { speaks, named, records:Set, first, last }
 */
export function unitTargets(ds, ctx, places) {
  const per = new Map();
  const total = new Map();
  const slot = (unit, target) => {
    const m = per.get(unit) ?? per.set(unit, new Map()).get(unit);
    return m.get(target) ?? m.set(target, { speaks: 0, named: 0, records: new Set(), first: null, last: null }).get(target);
  };
  const see = (x, scene, seq) => {
    const p = places.posOf(scene);
    if (!p) return;
    const at = { scene, seq, pos: [...p, seq] };
    const cmp = (a, b) => a.pos[0] - b.pos[0] || a.pos[1] - b.pos[1] || a.pos[2] - b.pos[2];
    if (!x.first || cmp(at, x.first) < 0) x.first = at;
    if (!x.last || cmp(at, x.last) > 0) x.last = at;
  };
  const add = (scene, seq, target, how, lines) => {
    const unit = places.unitOf(scene);
    if (!unit || !ctx.targetIds.has(target)) return;
    const x = slot(unit, target);
    if (how === 'speaks') {
      x.speaks += lines;
      if (!SKIP_TARGETS.has(target)) total.set(unit, (total.get(unit) ?? 0) + lines);
    } else x.named += lines;
    see(x, scene, seq);
  };
  for (const r of ctx.db.prepare('SELECT story_id, seq_from, how, lines, target FROM mentions').all()) add(r.story_id, r.seq_from, r.target, r.how, r.lines);
  for (const r of mentionRows(ds)) add(r.scene, r.from_seq, r.target, r.speaker ? 'speaks' : 'named', r.to_seq - r.from_seq + 1);
  for (const c of ds.candidates) {
    if (!c.id || c.status === '기각') continue;
    const o = c.obj ?? {};
    let ts = [];
    if ((c.kind === 'fact' || c.kind === 'question') && c.role === 'def' && isRecord(c)) ts = arr(o.about);
    else if (c.kind === 'echo' || c.kind === 'life') ts = arr(o.about);
    else if (c.kind === 'change') ts = [o.person];
    const scene = firstScene(c);
    const unit = places.unitOf(scene);
    if (!unit) continue;
    for (const t of new Set(ts.filter((x) => typeof x === 'string' && ctx.targetIds.has(x)))) {
      const x = slot(unit, t);
      x.records.add(c.id);
      see(x, scene, firstLine(c));
    }
  }
  return { per, total };
}

/** 중심인가 — 까닭(why) 또는 null */
export function centerWhy(target, x, unitTotal) {
  if (SKIP_TARGETS.has(target)) return null;
  const why = [];
  if (x.records.size >= CENTER.records) why.push('기록');
  if (target.startsWith('person:')) {
    if (x.speaks >= CENTER.speaks && x.speaks / Math.max(1, unitTotal) >= CENTER.share) why.push('말함');
  } else if (x.named >= CENTER.named) why.push('이름');
  return why.length ? why.join('+') : null;
}

const basisOf = (x, total, person) => [
  x.records.size ? `기록 ${x.records.size}` : '',
  person && x.speaks ? `말함 ${x.speaks}줄(${Math.round((100 * x.speaks) / Math.max(1, total))}%)` : '',
  x.named ? `이름 ${x.named}줄` : '',
].filter(Boolean).join(' · ');

/**
 * @param {object} ds loadDataset()
 * @param {object} ctx openContext()
 * @param {object} order loadOrder() — 1회독 순서(출시순 한 줄)
 */
export function buildLinks(ds, ctx, order) {
  const places = scenePlaces(order, ctx);
  const units = [...places.unitPos.keys()];
  const posOf = (u) => places.unitPos.get(u) ?? null;
  const scenesOf = new Map(units.map((u) => [u, (ctx.resolve(u)?.scenes ?? []).filter((s) => places.unitOf(s) === u)]));
  const problems = [];
  const raw = [];
  const push = (e) => raw.push({ from_line: '', to_line: '', record: '', act: '', point: '', target: '', spread: '', from_basis: '', to_basis: '', confidence: '', status: '', note: '', ...e });

  // ── 게임 (DB) ──
  for (const e of ctx.db.prepare("SELECT * FROM edges WHERE origin <> 'sheet' ORDER BY rowid").all()) {
    push({ type: e.type, origin: e.origin, strength: e.strength ?? 3, from_scene: e.from_id, to_scene: e.to_id, note: e.note ?? '' });
  }
  // ── sequel (키 · 게임 순서) ──
  for (const s of keySequels(units)) {
    push({ type: 'sequel', origin: 'auto', strength: 3, from_scene: scenesOf.get(s.from).at(-1), to_scene: scenesOf.get(s.to)[0], from_unit: s.from, to_unit: s.to, note: s.note });
  }
  // ── 기록 ──
  const r1 = read1Edges(ds, places.unitOf, posOf);
  problems.push(...r1.problems.map((p) => `1회독 — ${p}`));
  for (const e of r1.sceneEdges) {
    push({
      type: e.type, origin: 'record', strength: e.confidence === '추정' ? 2 : 3, from_scene: e.from_scene, to_scene: e.to_scene, from_unit: e.from_unit, to_unit: e.to_unit,
      record: e.record, act: RECORD_ACT[e.type], point: e.parent, confidence: e.confidence, status: e.status,
      note: [e.degree, e.answer ? `답 ${e.answer}` : ''].filter(Boolean).join(' · '),
    });
  }
  const r2 = read2Edges(ds, ctx, order);
  problems.push(...r2.problems.map((p) => `2회독 — ${p}`));
  for (const e of r2.edges) {
    push({
      type: e.type, origin: 'record', strength: e.confidence === '추정' ? 2 : 3, from_scene: e.from_scene, to_scene: e.to_scene, from_unit: e.from_unit, to_unit: e.to_unit,
      record: e.record, act: e.act, point: e.point, confidence: e.confidence, status: e.status,
    });
  }
  // ── 대상 공유 ──
  const { per, total } = unitTargets(ds, ctx, places);
  const centerRows = [];
  const chains = new Map(); // 대상 → [단위] (읽는 순서)
  for (const u of units) {
    for (const [t, x] of [...(per.get(u) ?? [])].sort((a, b) => a[0].localeCompare(b[0]))) {
      const why = centerWhy(t, x, total.get(u) ?? 0);
      if (!why) continue;
      (chains.get(t) ?? chains.set(t, []).get(t)).push(u);
      centerRows.push({ unit: u, order: posOf(u), target: t, x, why });
    }
  }
  const spreadOf = (t) => chains.get(t)?.length ?? 0;
  const common = Math.round(units.length * COMMON_SHARE);
  for (const [t, us] of chains) {
    const person = t.startsWith('person:');
    const spread = us.length;
    for (let i = 1; i < us.length; i++) {
      const a = per.get(us[i - 1]).get(t);
      const b = per.get(us[i]).get(t);
      push({
        type: person ? 'character' : 'keyword', origin: 'auto', strength: spread > common ? 1 : 2,
        from_scene: a.last?.scene ?? scenesOf.get(us[i - 1]).at(-1), from_line: a.last?.seq ?? '', to_scene: b.first?.scene ?? scenesOf.get(us[i])[0], to_line: b.first?.seq ?? '',
        from_unit: us[i - 1], to_unit: us[i], target: t, spread,
        from_basis: basisOf(a, total.get(us[i - 1]) ?? 0, person), to_basis: basisOf(b, total.get(us[i]) ?? 0, person),
        note: spread > common ? '흔한 대상' : '',
      });
    }
  }
  // ── 수동 (annotations/links.json) ──
  const isUnit = (k) => places.unitPos.has(k);
  const manual = ds.candidates.filter((c) => c.kind === 'edge');
  const auto = raw.map((e) => ({ ...e, from: e.from_scene, to: e.to_scene, from_unit: e.from_unit ?? places.unitOf(e.from_scene), to_unit: e.to_unit ?? places.unitOf(e.to_scene) }));
  const merged = mergeEdges(auto, manual, { isUnit });
  const edges = [];
  for (const e of merged.edges) {
    const { from, to, auto: autos, ...rest } = e;
    if (e.origin === 'manual') {
      const unitLevel = isUnit(from) && isUnit(to);
      const fu = unitLevel ? from : places.unitOf(from);
      const tu = unitLevel ? to : places.unitOf(to);
      const m = manual.find((c) => c.id === e.record);
      edges.push({
        from_line: '', to_line: '', act: '', point: '', target: '', spread: '', from_basis: '', to_basis: '',
        type: e.type, origin: 'manual', strength: e.strength ?? 2, record: e.record, status: e.status, confidence: m?.confidence ?? '',
        from_scene: unitLevel ? scenesOf.get(from)?.at(-1) ?? from : from, to_scene: unitLevel ? scenesOf.get(to)?.[0] ?? to : to, from_unit: fu, to_unit: tu,
        note: [e.note, autos?.length ? `자동 ${autos.length}건을 이김` : ''].filter(Boolean).join(' · '),
      });
    } else edges.push({ ...rest, from_unit: rest.from_unit ?? null, to_unit: rest.to_unit ?? null });
  }
  for (const e of edges) {
    e.from_order = posOf(e.from_unit);
    e.to_order = posOf(e.to_unit);
    if (e.from_order != null && e.to_order != null && e.from_order > e.to_order && e.origin !== 'record') {
      problems.push(`${e.type} ${e.record || e.target || ''} ${e.from_unit} → ${e.to_unit}: 읽는 순서를 거슬러 간다`.replace(/\s+/g, ' '));
    }
  }
  for (const m of merged.unmatched) problems.push(`수동 ${m.id}(drop ${m.type} ${m.from} → ${m.to}): 지울 자동 엣지가 없다`);
  const cmpEdge = (a, b) => (a.from_order ?? 1e9) - (b.from_order ?? 1e9) || (a.to_order ?? 1e9) - (b.to_order ?? 1e9) || typeRank(a.type) - typeRank(b.type)
    || cmpRecord(a.record, b.record) || String(a.target).localeCompare(String(b.target))
    || String(a.from_scene).localeCompare(String(b.from_scene)) || String(a.to_scene).localeCompare(String(b.to_scene));
  edges.sort(cmpEdge);

  // ── 단위 → 단위 ──
  const ue = new Map();
  let internal = 0;
  let unplaced = 0;
  for (const e of edges) {
    if (!e.from_unit || !e.to_unit) {
      unplaced++;
      continue;
    }
    if (e.from_unit === e.to_unit) {
      internal++;
      continue;
    }
    const k = `${e.from_unit}\t${e.to_unit}\t${e.type}`;
    if (!ue.has(k)) ue.set(k, { from_unit: e.from_unit, to_unit: e.to_unit, type: e.type, count: 0, strength: 0, origins: new Set(), unconfirmed: 0, records: [], targets: [] });
    const x = ue.get(k);
    x.count++;
    x.strength = Math.max(x.strength, e.strength ?? 0);
    x.origins.add(e.origin);
    if (e.status === '후보') x.unconfirmed++;
    if (e.record) x.records.push(e.record);
    if (e.target) x.targets.push(e.target);
  }
  const unitEdges = [...ue.values()].map((x) => ({
    ...x, origins: [...x.origins].sort().join(' '), records: [...new Set(x.records)].join(' '), targets: [...new Set(x.targets)].join(' '),
    from_order: posOf(x.from_unit), to_order: posOf(x.to_unit), from_kind: kindOfKey(x.from_unit), to_kind: kindOfKey(x.to_unit),
  })).sort((a, b) => a.from_order - b.from_order || a.to_order - b.to_order || typeRank(a.type) - typeRank(b.type));

  // ── 단위별 ──
  const nb = new Map(units.map((u) => [u, { all: new Set(), strong: new Set(), sequel: new Set(), rec: new Set(), shared: new Set(), in: new Set(), out: new Set() }]));
  for (const x of unitEdges) {
    for (const [u, v, dir] of [[x.from_unit, x.to_unit, 'out'], [x.to_unit, x.from_unit, 'in']]) {
      const n = nb.get(u);
      if (!n) continue;
      n.all.add(v);
      n[dir].add(v);
      if (x.strength >= 2) n.strong.add(v);
      if (x.type === 'sequel') n.sequel.add(v);
      if (x.origins.includes('record')) n.rec.add(v);
      if (x.type === 'character' || x.type === 'keyword') n.shared.add(v);
    }
  }
  const centersOf = new Map();
  for (const c of centerRows) (centersOf.get(c.unit) ?? centersOf.set(c.unit, []).get(c.unit)).push(c);
  const centerLabel = (u) => (centersOf.get(u) ?? [])
    .sort((a, b) => spreadOf(a.target) - spreadOf(b.target) || a.target.localeCompare(b.target)).slice(0, 6).map((c) => c.target).join(' ');
  // 화면 1 판정 입력 ① — 메인 밖 단위와 메인 사이의 기록 엣지(in = 메인 → 여기, out = 여기 → 메인). 메인은 채점하지 않아 비운다
  const mainRec = new Map();
  const isMain = (u) => kindOfKey(u) === '메인';
  for (const e of edges) {
    if (e.origin !== 'record' || !e.from_unit || !e.to_unit || isMain(e.from_unit) === isMain(e.to_unit)) continue;
    const [u, dir, m] = isMain(e.from_unit) ? [e.to_unit, 'in', e.from_unit] : [e.from_unit, 'out', e.to_unit];
    const x = mainRec.get(u) ?? mainRec.set(u, { in: 0, out: 0, mains: new Set() }).get(u);
    x[dir]++;
    x.mains.add(m);
  }
  const unitRows = units.map((u) => {
    const n = nb.get(u);
    const mr = mainRec.get(u);
    return {
      order: posOf(u), unit: u, kind: kindOfKey(u), in_units: n.in.size, out_units: n.out.size, strong_units: n.strong.size, sequel: n.sequel.size,
      records_units: n.rec.size, shared_units: n.shared.size, isolated: n.all.size ? '' : '고립', isolated_strong: n.strong.size ? '' : '고립',
      record_only_isolated: n.rec.size ? '' : '고립', main_in: isMain(u) ? '' : mr?.in ?? 0, main_out: isMain(u) ? '' : mr?.out ?? 0,
      main_units: isMain(u) ? '' : [...(mr?.mains ?? [])].sort((a, b) => posOf(a) - posOf(b)).join(' '), center: centerLabel(u), title: ctx.resolve(u)?.title ?? '',
    };
  });
  const centers = centerRows.map((c) => ({
    unit: c.unit, order: c.order, target: c.target, type: c.target.split(':')[0], records: c.x.records.size, speaks: c.x.speaks,
    share: c.target.startsWith('person:') ? Math.round((100 * c.x.speaks) / Math.max(1, total.get(c.unit) ?? 0)) : '', named: c.x.named, spread: spreadOf(c.target), why: c.why,
  }));
  const dropped = merged.dropped.map((d) => ({ ...d, from_scene: d.from, to_scene: d.to }));
  const sources = { read2: ds.dir2 ? `${displayPath(ds.dir2)}/` : null, links: ds.links?.name ?? null };
  const cl = conceptLinks(ds, ctx, places);
  return { edges, sceneEdges: edges, unitEdges, units: unitRows, centers, dropped, unmatched: merged.unmatched, chains, common, internal, unplaced, problems, places, sources,
    threadTargets: cl.threadTargets, targetPairs: cl.targetPairs };
}

/**
 * 화면 4(개념 · 떡밥끼리의 관계)의 선 — 스토리 사이 엣지가 아니라 줄기 · 대상 사이(docs/views.md 화면 4). 비인물 대상만.
 *   줄기 ↔ 대상: 줄기에 든 기록(의문 · 곧바로 든 사실 · 그 줄기를 가리킨 2회독 떡밥)의 about을 센다. 줄기 자신의 about이면 thread_about.
 *   대상 ↔ 대상: 같은 기록(1회독 사실 · 의문 정의, 2회독 떡밥 · 생활상)의 about에 함께 나온 수 — PAIR_MIN 이상인 쌍만.
 */
export function conceptLinks(ds, ctx, places) {
  const isConcept = (t) => typeof t === 'string' && ctx.targetIds.has(t) && !t.startsWith('person:');
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byId = new Map(live.map((c) => [c.id, c]));
  const aboutOf = (c) => [...new Set(arr(c?.obj?.about).filter(isConcept))];
  const tm = threadMembership(ds);
  const threadsOfPoint = (p) => {
    if (/^J\d+$/.test(p)) return tm.byId.has(p) ? [p] : [];
    const def = String(p).replace(/-\d+$/, '');
    if (def.startsWith('Q')) return tm.ofQuestion.has(def) ? [tm.ofQuestion.get(def)] : [];
    return tm.ofFact.get(def) ?? [];
  };
  const echoesOf = new Map();
  for (const e of live.filter((c) => c.kind === 'echo')) {
    for (const j of new Set(arr(e.obj?.points).flatMap(threadsOfPoint))) (echoesOf.get(j) ?? echoesOf.set(j, []).get(j)).push(e.id);
  }
  const threadTargets = [];
  for (const t of tm.threads) {
    const recs = [...t.questions, ...t.facts, ...(echoesOf.get(t.id) ?? [])].map((id) => byId.get(id)).filter(Boolean);
    const own = new Set(arr(t.c.obj?.about).filter(isConcept));
    const per = new Map([...own].map((x) => [x, []]));
    for (const c of recs) for (const x of aboutOf(c)) (per.get(x) ?? per.set(x, []).get(x)).push(c.id);
    for (const [x, ids] of [...per].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
      threadTargets.push({ thread: t.id, weight: t.weight ?? '', title: t.title ?? '', target: x, type: x.split(':')[0], records: ids.length,
        thread_about: own.has(x) ? '줄기' : '', sample: ids.sort(compareIds).slice(0, 6).join(' ') });
    }
  }
  const pairs = new Map();
  for (const c of live) {
    const ok = ((c.kind === 'fact' || c.kind === 'question') && c.role === 'def' && isRecord(c)) || c.kind === 'echo' || c.kind === 'life';
    if (!ok) continue;
    const xs = aboutOf(c).sort();
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        const k = `${xs[i]}\t${xs[j]}`;
        const p = pairs.get(k) ?? pairs.set(k, { a: xs[i], b: xs[j], ids: [], units: new Set() }).get(k);
        p.ids.push(c.id);
        const u = places.unitOf(firstScene(c));
        if (u) p.units.add(u);
      }
    }
  }
  const targetPairs = [...pairs.values()].filter((p) => p.ids.length >= PAIR_MIN)
    .map((p) => ({ a: p.a, b: p.b, a_type: p.a.split(':')[0], b_type: p.b.split(':')[0], records: p.ids.length, units: p.units.size, sample: p.ids.sort(compareIds).slice(0, 6).join(' ') }))
    .sort((x, y) => y.records - x.records || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  return { threadTargets, targetPairs };
}

/** 고립 단위 수 — 이어진 단위가 하나도 없는 것. pick(edge)인 단위 엣지만 본다 */
function isolatedCount(v, pick) {
  const seen = new Set();
  for (const x of v.unitEdges) if (pick(x)) seen.add(x.from_unit).add(x.to_unit);
  return v.units.filter((u) => !seen.has(u.unit));
}

const tallyBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
};
const kindTally = (us) => {
  const m = tallyBy(us, (u) => u.kind);
  return KIND_ORDER.filter((k) => m.has(k)).map((k) => `${k} ${m.get(k)}`).join(' · ') || '없음';
};

/** report.md — 숫자와 ID만. 같은 기록이면 같은 글 */
export function renderLinksReport(v, { source }) {
  const L = [];
  L.push('# 관계선 — 스토리 사이 엣지 (X2)', '');
  const srcs = [source, v.sources?.read2, v.sources?.links].filter(Boolean).map((x) => `\`${x}\``).join(' · ');
  L.push(`다시 뽑기: \`node tools/views/links.mjs\`(\`draft.mjs\`가 같이 부른다). 기록: ${srcs}, 자동: DB edges · 언급 DB.`);
  L.push('규칙은 tools/views/links.mjs 머리말, 타입은 docs/schema.md "엣지 타입", 화면은 docs/views.md 화면 2. 조회 `node tools/query.mjs links <씬|단위>`.', '');

  L.push('## 요약', '');
  const origins = ['game-condition', 'auto', 'record', 'manual'];
  L.push(`| 타입 | ${origins.join(' | ')} | 씬 엣지 | 단위 쌍 | 후보 |`, `|---|${origins.map(() => '---:').join('|')}|---:|---:|---:|`);
  for (const t of TYPE_ORDER) {
    const es = v.edges.filter((e) => e.type === t);
    const c = tallyBy(es, (e) => e.origin);
    L.push(`| \`${t}\` ${TYPE_LABEL[t]} | ${origins.map((o) => c.get(o) ?? 0).join(' | ')} | ${es.length} | ${v.unitEdges.filter((x) => x.type === t).length} | ${es.filter((e) => e.status === '후보').length} |`);
  }
  L.push('', `- 씬 엣지 ${v.edges.length} · 단위 쌍(타입별) ${v.unitEdges.length} · 같은 단위 안 ${v.internal}(단위 그래프에서 뺌 — 호감도 스토리 조건은 모두 한 인물 안) · 읽기 단위 밖 끝점 ${v.unplaced}(애장품 \`fav:\` 등).`);
  const unconf = v.edges.filter((e) => e.status === '후보');
  L.push(`- 확정 전 후보로 만든 엣지 ${unconf.length}${unconf.length ? ` — ${[...tallyBy(unconf, (e) => e.type)].map(([t, n]) => `${t} ${n}`).join(' · ')}. 화면 · 조회는 '후보'로 따로 표시한다` : ' — 기록 · 수동 엣지가 모두 확정이다'}.`);
  L.push(`- 세기: ${[3, 2, 1].map((s) => `${s} = ${v.edges.filter((e) => e.strength === s).length}`).join(' · ')} — 3 게임 조건 · 다음 편 · 확실한 기록, 2 추정 기록 · 대상 공유, 1 흔한 대상 공유.`, '');

  L.push('## 고립 — 이어진 단위가 없는 단위', '');
  const steps = [
    ['기록만(1회독 + 2회독)', (x) => x.origins.includes('record')],
    ['+ 다음 편(sequel)', (x) => x.origins.includes('record') || x.type === 'sequel'],
    ['+ 대상 공유(character · keyword) = 전부', () => true],
    ['세기 2 이상만', (x) => x.strength >= 2],
  ];
  L.push('| 엣지 | 고립 | 종류별 |', '|---|---:|---|');
  for (const [name, pick] of steps) {
    const iso = isolatedCount(v, pick);
    L.push(`| ${name} | ${iso.length}/${v.units.length} | ${kindTally(iso)} |`);
  }
  const isoAll = isolatedCount(v, () => true);
  if (isoAll.length) L.push('', `전부를 넣어도 고립: ${isoAll.map((u) => `\`${u.unit}\``).join(' · ')}.`);
  const isoStrong = isolatedCount(v, (x) => x.strength >= 2);
  if (isoStrong.length) L.push('', `세기 2 이상으로 고립(흔한 대상만 나눔): ${isoStrong.map((u) => `\`${u.unit}\``).join(' · ')}.`);
  L.push('');

  L.push('## 대상 공유 — 중심 · 사슬', '');
  const ch = [...v.chains];
  const persons = ch.filter(([t]) => t.startsWith('person:'));
  const why = tallyBy(v.centers, (c) => c.why);
  L.push(`- 중심(단위 × 대상) ${v.centers.length} — ${[...why].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}. 대상 ${ch.length}(인물 ${persons.length} · 비인물 ${ch.length - persons.length}), 두 단위 이상 ${ch.filter(([, us]) => us.length > 1).length}.`);
  const common = ch.filter(([, us]) => us.length > v.common).sort((a, b) => b[1].length - a[1].length);
  L.push(`- 흔한 대상(중심인 단위 ${v.common} 넘음 — 읽기 단위의 ${COMMON_SHARE * 100}%, 세기 1 · note '흔한 대상') ${common.length}: ${common.map(([t, us]) => `${t.split(':')[1]} ${us.length}`).join(' · ')}.`);
  const linked = ch.filter(([, us]) => us.length > 1 && us.length <= v.common);
  L.push(`- 그 밖 두 단위 이상에서 중심인 대상 ${linked.length}(세기 2) — 사슬 엣지 ${linked.reduce((n, [, us]) => n + us.length - 1, 0)}. 한 단위에서만 중심인 대상 ${ch.filter(([, us]) => us.length === 1).length}은 엣지가 없다.`, '');

  L.push('## 개념 · 떡밥 지도 (화면 4)', '');
  const tt = v.threadTargets;
  L.push(`- 줄기 ↔ 대상(비인물) ${tt.length} — 줄기 ${new Set(tt.map((r) => r.thread)).size} · 대상 ${new Set(tt.map((r) => r.target)).size}, 줄기 자신의 about ${tt.filter((r) => r.thread_about).length}. \`thread-targets.csv\`.`);
  L.push(`- 대상 ↔ 대상(같은 기록의 about에 ${PAIR_MIN}번 이상) ${v.targetPairs.length}쌍 — 많이 함께 나온 쌍: ${v.targetPairs.slice(0, 8).map((p) => `${p.a.split(':')[1]} · ${p.b.split(':')[1]} ${p.records}`).join(' / ')}. \`target-pairs.csv\`.`, '');

  L.push('## 메인과 이어진 기록 (화면 1 판정 입력 ①)', '');
  const outside = v.units.filter((u) => u.kind !== '메인');
  const linkedMain = outside.filter((u) => u.main_in || u.main_out);
  L.push(`- 메인 밖 ${outside.length} 가운데 메인과 기록 엣지로 이어진 단위 ${linkedMain.length} — ${kindTally(linkedMain)}. \`units.csv\` \`main_in\` · \`main_out\` · \`main_units\`(X3 판정 입력).`, '');

  L.push('## 종류 → 종류 (단위 쌍)', '');
  const groups = [['기록', (x) => x.origins.includes('record')], ['다음 편', (x) => x.type === 'sequel'], ['대상 공유 2+', (x) => (x.type === 'character' || x.type === 'keyword') && x.strength >= 2]];
  for (const [name, pick] of groups) {
    const m = tallyBy(v.unitEdges.filter(pick), (x) => `${x.from_kind} → ${x.to_kind}`);
    L.push(`- ${name}: ${[...m].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}`);
  }
  L.push('');

  L.push('## 이어진 단위가 많은 메인 밖 단위', '');
  const top = v.units.filter((u) => u.kind !== '메인').sort((a, b) => b.strong_units - a.strong_units || a.order - b.order).slice(0, 12);
  L.push('| 자리 | 단위 | 종류 | 세기 2+ 이웃 | 기록 이웃 | 대상 공유 이웃 | 중심 대상 |', '|---:|---|---|---:|---:|---:|---|');
  for (const u of top) L.push(`| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.strong_units} | ${u.records_units} | ${u.shared_units} | ${u.center} |`);
  L.push('');

  L.push('## 수동 엣지 (annotations/links.json)', '');
  const man = v.edges.filter((e) => e.origin === 'manual');
  L.push(`- 실린 것 ${man.length}${man.length ? ` — ${[...tallyBy(man, (e) => `${e.type} ${e.strength}`)].map(([k, n]) => `${k}: ${n}`).join(' · ')}` : ''} · 지운 자동 엣지 ${v.dropped.length} · 못 맞춘 drop ${v.unmatched.length}.`);
  for (const e of man.filter((x) => x.type === 'sequel')) L.push(`  - ${e.record} \`${e.from_unit}\` → \`${e.to_unit}\` (세기 ${e.strength}${e.status !== '확정' ? ` · ${e.status}` : ''})`);
  L.push('');
  if (v.problems.length) L.push('## 문제', '', ...v.problems.map((p) => `- ${p}`), '');
  return L.join('\n');
}

function csvCell(x) {
  const s = x == null ? '' : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

export function writeLinksViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [k, f] of Object.entries(FILES)) fs.writeFileSync(path.join(outDir, f), toCsv(v[k], COLUMNS[k]));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderLinksReport(v, opts));
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
  const v = buildLinks(ds, ctx, loadOrder());
  ctx.close();
  const source = displayPath(dir) + '/';
  if (opt.example) console.log(renderLinksReport(v, { source }));
  else {
    writeLinksViews(v, LINKS_DIR, { source });
    console.log(`→ ${displayPath(LINKS_DIR)}/ (${Object.values(FILES).join(' · ')} · report.md)`);
  }
  console.log(`씬 엣지 ${v.edges.length} · 단위 쌍 ${v.unitEdges.length} · 고립 ${v.units.filter((u) => u.isolated).length}${v.problems.length ? ` · 문제 ${v.problems.length}` : ''}`);
}
