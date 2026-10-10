/**
 * 탭 "연결" 데이터(W3) — data/views/links/(tools/views/links.mjs, X2)의 관계선을 사이트용 JSON 둘로 내보낸다.
 * 규칙은 docs/schema.md "관계선" · 화면은 docs/views.md 화면 2. 원문 · 기록 문장은 싣지 않는다(ID · 대상 · 수 · 우리가 쓴 메모만).
 *
 *   links.json         { edges, chains, targets }
 *     edges[]   단위 쌍 × 타입(3,370) — from · to(단위 키, 읽는 순서 앞 → 뒤) · type(prereq · sequel · setup_payoff · callback · reversal · character · keyword) ·
 *               count(씬 엣지 수 = 선 굵기) · strength(1–3) · origin(auto · record · manual · game-condition) · records[](기록 ID) · targets[](대상 ID —
 *               대상 공유는 그 대상, 기록 엣지는 기록의 about) · hid[](대상 공유인데 한쪽 스토리에 이름이 안 쓰인 대상 — W15f, 읽는 중에는 뺀다) · threads[](기록의 줄기) · unconfirmed(후보로 만든 수, 0이면 칸 없음) · note(까닭 한 줄 — 수동 연작의 reason · 자동 규칙 이름) ·
 *               weak(count 중 세기 1인 씬 엣지 수 = 자주 나오는 대상만 나눈 것, 0이면 칸 없음 — 세기 2 이상만 볼 때 선 굵기에서 뺀다)
 *     chains[]  연작 — 메인 밖 sequel 엣지의 연결 성분. units[](읽는 순서) · edges[{ from, to, strength, origin, record, note }] · linear(갈래 없는 한 줄이면 true)
 *     targets[] 중심 대상 — id · spread(그 대상이 중심인 단위 수) · common(흔한 대상 = 읽기 단위의 10%를 넘음 → 화면 기본값에서 숨김)
 *   links-scenes.json  씬 엣지(6,257) — 선 하나의 근거. type · origin · s(세기) · from · fl(앞 씬 · 줄) · to · tl(뒤 씬 · 줄) · fu · tu(앞 · 뒤 단위) ·
 *               record · act · point(기록 엣지) · target · fb · tb(대상 공유 — 앞 · 뒤 단위에서 중심인 까닭) · hid(1 = 대상 공유인데 한쪽 스토리에 그 이름이 안 쓰임 — W15f) · confidence · status · note
 *               씬으로 찾기: e.from === id || e.to === id, 단위로: e.fu === key || e.tu === key, 단위 쌍은 (fu, tu). 애장품 씬(fav:…)은 scenes.json에 없다(prereq → 애장품 21).
 *
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)". DB는 열지 않는다(CSV + 공용 기록만).
 */
import { COMMON_SHARE, TYPE_ORDER } from '../../views/links.mjs';
import { compact, list, num, publishText } from '../lib.mjs';

export const name = 'links';

export async function run(ctx) {
  const { csv, warn, common } = ctx;
  const text = (v, where) => publishText(v, where, warn) || undefined;
  const unitKeys = new Set(common.units.map((u) => u.key));
  const orderOf = new Map(common.units.map((u) => [u.key, u.order]));
  const kindOf = new Map(common.units.map((u) => [u.key, u.kind]));
  const sceneIds = new Set(common.scenes.map((s) => s.id));
  const recordById = new Map(common.records.map((r) => [r.id, r]));
  // 대상 공유(같은 인물 · 소재) 선인데 그 대상의 이름이 한쪽 스토리에 한 번도 안 쓰임('???'로만 · 암시 언급만) — 그 등장을 이 대상으로 내면 정체가 샌다(W15f).
  // 씬 엣지는 hid: 1, 단위 엣지는 hid[](그런 대상) — 화면은 읽는 중에 뺀다
  const shared = (type) => type === 'character' || type === 'keyword';
  const nameless = (t, u) => Boolean(common.namedUnits && t && u && !common.namedUnits.get(t)?.has(u));
  const typeRank = new Map(TYPE_ORDER.map((t, i) => [t, i]));

  // ── 기록 → 대상 · 줄기 (사건 · 재언급은 뿌리 기록의 about을 물려받는다) ──
  const aboutOf = (id) => {
    const r = recordById.get(id);
    if (!r) return [];
    const own = Array.isArray(r.about) ? r.about : [];
    if (own.length) return own;
    const parent = r.parent ? recordById.get(r.parent) : null;
    return Array.isArray(parent?.about) ? parent.about : [];
  };
  const threadsOf = (id) => {
    const r = recordById.get(id);
    const own = Array.isArray(r?.threads) ? r.threads : [];
    if (own.length || !r?.parent) return own;
    const parent = recordById.get(r.parent);
    return Array.isArray(parent?.threads) ? parent.threads : [];
  };

  // ── 씬 엣지 ──
  const sceneRows = csv('data/views/links/scene-edges.csv');
  let unknownScene = 0;
  let unknownRecord = 0;
  const scenes = sceneRows.map((r) => {
    if (!sceneIds.has(r.from_scene) || !sceneIds.has(r.to_scene)) unknownScene++;
    if (r.record && !/^Y\d+$/.test(r.record) && !recordById.has(r.record)) unknownRecord++;
    return compact({
      type: r.type, origin: r.origin, s: num(r.strength),
      from: r.from_scene, fl: num(r.from_line), to: r.to_scene, tl: num(r.to_line), fu: r.from_unit, tu: r.to_unit,
      record: r.record || undefined, act: r.act || undefined, point: r.point || undefined, target: r.target || undefined,
      fb: r.from_basis || undefined, tb: r.to_basis || undefined,
      hid: shared(r.type) && (nameless(r.target, r.from_unit) || nameless(r.target, r.to_unit)) ? 1 : undefined,
      confidence: r.confidence || undefined, status: r.status === '후보' ? '후보' : undefined,
      note: text(r.note, `links ${r.from_scene}→${r.to_scene} note`),
    });
  });
  if (unknownScene) warn({ where: 'links-scenes', msg: `scenes.json에 없는 씬이 끝점인 씬 엣지 ${unknownScene}건(애장품 fav: 등) — 그대로 싣는다` });
  if (unknownRecord) warn({ where: 'links-scenes', msg: `공용 기록에 없는 기록 ID가 달린 씬 엣지 ${unknownRecord}건` });

  // 단위 쌍 · 타입마다 까닭 한 줄(수동 연작의 reason · 자동 규칙 이름) — 첫 메모
  const noteOf = new Map();
  for (const e of scenes) {
    if (!e.note || e.note === '흔한 대상' || /^(일부|전부)? ?·? ?답 /.test(e.note)) continue;
    const k = `${e.fu}\t${e.tu}\t${e.type}`;
    if (!noteOf.has(k)) noteOf.set(k, e.note);
  }

  // 단위 쌍 · 타입마다 세기 1인 씬 엣지 수(자주 나오는 대상만 나눈 약한 연결)
  const weakOf = new Map();
  for (const e of scenes) {
    if (e.s !== 1 || e.fu === e.tu) continue;
    const k = `${e.fu}\t${e.tu}\t${e.type}`;
    weakOf.set(k, (weakOf.get(k) ?? 0) + 1);
  }

  // ── 단위 엣지 ──
  const unitRows = csv('data/views/links/unit-edges.csv');
  let unknownUnit = 0;
  const edges = unitRows.map((r) => {
    if (!unitKeys.has(r.from_unit) || !unitKeys.has(r.to_unit)) unknownUnit++;
    const records = list(r.records);
    const targets = new Set(list(r.targets));
    const hid = shared(r.type) ? [...targets].filter((t) => nameless(t, r.from_unit) || nameless(t, r.to_unit)).sort() : [];
    const threads = new Set();
    for (const id of records) {
      for (const t of aboutOf(id)) targets.add(t);
      for (const j of threadsOf(id)) threads.add(j);
    }
    return compact({
      from: r.from_unit, to: r.to_unit, type: r.type, count: num(r.count), strength: num(r.strength), origin: r.origins.split(/\s+/)[0],
      records, targets: [...targets].sort(), hid: hid.length ? hid : undefined, threads: [...threads].sort(), unconfirmed: num(r.unconfirmed) || undefined,
      note: noteOf.get(`${r.from_unit}\t${r.to_unit}\t${r.type}`),
      weak: weakOf.get(`${r.from_unit}\t${r.to_unit}\t${r.type}`) || undefined,
    });
  });
  if (unknownUnit) warn({ where: 'links', msg: `units.json에 없는 단위가 끝점인 단위 엣지 ${unknownUnit}건` });
  edges.sort((a, b) => (orderOf.get(a.from) ?? 1e9) - (orderOf.get(b.from) ?? 1e9) || (orderOf.get(a.to) ?? 1e9) - (orderOf.get(b.to) ?? 1e9) || (typeRank.get(a.type) ?? 9) - (typeRank.get(b.type) ?? 9));

  // ── 연작(메인 밖 sequel 사슬 — 연결 성분) ──
  const seq = edges.filter((e) => e.type === 'sequel' && !(kindOf.get(e.from) === 'main' && kindOf.get(e.to) === 'main'));
  const parent = new Map();
  const find = (k) => {
    if (!parent.has(k)) parent.set(k, k);
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r);
    for (let x = k; x !== r;) { const nx = parent.get(x); parent.set(x, r); x = nx; }
    return r;
  };
  for (const e of seq) parent.set(find(e.from), find(e.to));
  const groups = new Map();
  for (const e of seq) {
    const root = find(e.from);
    (groups.get(root) ?? groups.set(root, []).get(root)).push(e);
  }
  const chains = [...groups.values()].map((es) => {
    const units = [...new Set(es.flatMap((e) => [e.from, e.to]))].sort((a, b) => (orderOf.get(a) ?? 1e9) - (orderOf.get(b) ?? 1e9));
    const outs = new Map();
    const ins = new Map();
    for (const e of es) {
      outs.set(e.from, (outs.get(e.from) ?? 0) + 1);
      ins.set(e.to, (ins.get(e.to) ?? 0) + 1);
    }
    const linear = units.every((u) => (outs.get(u) ?? 0) <= 1 && (ins.get(u) ?? 0) <= 1);
    const sorted = [...es].sort((a, b) => (orderOf.get(a.from) ?? 1e9) - (orderOf.get(b.from) ?? 1e9) || (orderOf.get(a.to) ?? 1e9) - (orderOf.get(b.to) ?? 1e9));
    return compact({
      units, linear: linear ? true : undefined,
      edges: sorted.map((e) => compact({ from: e.from, to: e.to, strength: e.strength, origin: e.origin, record: e.records?.[0], note: e.note })),
    });
  }).sort((a, b) => (orderOf.get(a.units[0]) ?? 1e9) - (orderOf.get(b.units[0]) ?? 1e9));

  // ── 중심 대상(흔한 대상 표시) ──
  const centerRows = csv('data/views/links/centers.csv');
  const spreadOf = new Map();
  for (const r of centerRows) spreadOf.set(r.target, Math.max(spreadOf.get(r.target) ?? 0, num(r.spread) ?? 0));
  const commonMin = Math.floor(common.units.length * COMMON_SHARE);
  const targets = [...spreadOf].map(([id, spread]) => compact({ id, spread, common: spread > commonMin ? true : undefined }))
    .sort((a, b) => b.spread - a.spread || a.id.localeCompare(b.id, 'ko'));

  return { files: { 'links.json': { edges, chains, targets }, 'links-scenes.json': scenes } };
}
