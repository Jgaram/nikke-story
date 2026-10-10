/**
 * 탭 "감상 순서" 데이터(W2) — 화면 1(docs/views.md "1. 스토리 중요도 분류", 판정 카드 docs/importance.md).
 *
 *   order.json        = { units[421], spine[60], leads[20], counts }                 — 첫 화면에 필요한 것(목록 · 지도 · 한 줄 근거)
 *   order-detail.json = { notes[], units: { <key>: { history, basis_text, reviews } } } — 분류 카드를 열 때만 받는다(판정 이력 · 근거 문장 · 검토 기록 — 전체의 3분의 1이라 뺐다)
 *
 *   units[]   판정 단위(척추 밖 — data/views/importance/units.csv 한 줄씩). 종류 · 제목 · 글자 수 · 층은 공용 units.json에 있으므로 싣지 않는다 — key로 잇는다.
 *             key · grade(필수 · 보강 · 참고 · 독립) · tick(공개 자리 = importance의 pos) · from(척추가 딛기 시작하는 자리의 단위 키) · from_tick · before(그 앞 자리의 등급) ·
 *             path('참고 → ch27 보강' — 자리에 따라 바뀌는 단위만) · basis(결정 근거 기록 ID) · basis_kind · basis_scene · basis_line ·
 *             reason(판정 이유) · confidence · asof(기준 시점) · judgment(K-ID) · trail(['독립', '참고'] — 판정 이력에서 등급이 바뀐 순서, 바뀐 적 없으면 없음) ·
 *             threads[](이 단위의 확정 기록이 든 줄기) ·
 *             lead_facts(주역 사연 조각 — '네온(ch01) 사실 3') · closures('O9(관계 · 지휘관 · 확정)') · origin_of[](이 단위가 원점인 주역 person ID)
 *   spine[]   척추 자리 60 = 메인 챕터 49 + 척추 이벤트 8 · 사이드 3(공용 units.json의 spine 표시) — key · tick · order, 공개 자리순
 *   leads[]   주역 명단(annotations/leads.json 확정) — id · person · from(주역이 되는 자리의 단위 키) · from_tick · origin(원점 단위 키 또는 '메인') · origin_tick · arcs[] · records[] · reason · confidence
 *   pre       { <단위 키>: { 필수: [[키, 왜]], 권장: [...], 선택: [...] } } — 선행 스토리(계산, PRE_RULES · prereqsOf). 선행이 없는 단위는 싣지 않는다
 *   counts    { grade: { 필수, 보강, 참고, 독립 }, judged, spine, leads, asof }
 *   detail    basis_text(결정 근거 기록의 우리 문장) · history('B0b-2 독립 · X3c 그대로 → X3f-6a 참고') ·
 *             reviews[{ session, date, decision, before, note }](검토 기록 — annotations/layers.json; note는 notes[]의 번호 — 같은 메모가 수백 번 반복돼 표로 뺐다)
 *
 * 자리별 등급은 사이트가 계산한다(tools/views/importance.mjs gradeAt와 같은 규칙): T < tick이면 아직 없음, from_tick이 있고 T < from_tick이면 before, 그 밖은 grade.
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)". 대사 본문 · DB lines 테이블은 읽지 않는다.
 */
import { compact, list, num, publishText } from '../lib.mjs';

export const name = 'order';

/** 판정 이력 문자열에서 등급이 바뀐 순서를 뽑는다 — 'B0b-2 독립 · X3c 그대로 → X3f-6a 참고' → ['독립', '참고'], 바뀐 적 없으면 undefined */
export function gradeTrail(history) {
  const grades = String(history ?? '').match(/필수|보강|참고|독립/g) ?? [];
  const trail = grades.filter((g, i) => i === 0 || g !== grades[i - 1]);
  return trail.length > 1 ? trail : undefined;
}

/**
 * 선행 스토리 계산(사용자 2026-10-10 — 판정 · 연결에서 계산, 새로 판정하지 않는다).
 * A가 X의 선행 = A가 X보다 앞(읽는 자리)이고 아래 중 하나. 여러 개에 걸리면 높은 칸 하나.
 *   필수  sequel(다음 편 — A가 X의 앞 편, X가 메인 챕터면 뺀다) · judged(A의 판정 from이 X이고 A가 필수)
 *   권장  judged(from이 X이고 A가 보강) · X가 메인 밖일 때 setup_payoff · reversal 강함(3)
 *   선택  callback 강함(3) · setup_payoff · callback 보통(2) · X가 척추일 때 setup_payoff · reversal 강함(3)(판정이 그 자리를 짚지 않았다)
 * 척추(메인 챕터 + 척추 이벤트 · 사이드)는 감상 순서에 늘 있으므로 A로 세지 않는다. 같은 인물 · 같은 대상(character · keyword)은 세지 않는다.
 * @param {{ from_unit, to_unit, type, strength }[]} edges  data/views/links/unit-edges.csv 줄
 * @param {{ key, grade, from }[]} judged  판정 단위
 * @param {Map<string, { order: number, kind: string, spine?: boolean }>} unitByKey
 */
export function prereqsOf(edges, judged, unitByKey) {
  const LEVEL = ['필수', '권장', '선택'];
  const isSpine = (k) => unitByKey.get(k)?.kind === 'main' || Boolean(unitByKey.get(k)?.spine);
  const ord = (k) => unitByKey.get(k)?.order ?? Infinity;
  const pre = new Map(); // X → Map(A → [level, why])
  const put = (x, a, level, why) => {
    if (a === x || isSpine(a) || !unitByKey.has(a) || !unitByKey.has(x) || !(ord(a) < ord(x))) return;
    const m = pre.get(x) ?? pre.set(x, new Map()).get(x);
    const had = m.get(a);
    if (!had || LEVEL.indexOf(level) < LEVEL.indexOf(had[0])) m.set(a, [level, why]);
  };
  for (const j of judged) {
    if (!j.from || !isSpine(j.from)) continue;
    if (j.grade === '필수') put(j.from, j.key, '필수', 'judged');
    else if (j.grade === '보강') put(j.from, j.key, '권장', 'judged');
  }
  for (const e of edges) {
    const a = e.from_unit; const x = e.to_unit; const st = Number(e.strength);
    const xSpine = isSpine(x);
    if (e.type === 'sequel') { if (unitByKey.get(x)?.kind !== 'main') put(x, a, '필수', 'sequel'); }
    else if ((e.type === 'setup_payoff' || e.type === 'reversal') && st >= 3) put(x, a, xSpine ? '선택' : '권장', e.type);
    else if (e.type === 'callback' && st >= 3) put(x, a, '선택', e.type);
    else if ((e.type === 'setup_payoff' || e.type === 'callback') && st === 2) put(x, a, '선택', e.type);
  }
  const out = {};
  for (const [x, m] of [...pre].sort((p, q) => ord(p[0]) - ord(q[0]))) {
    const row = {};
    for (const [a, [level, why]] of [...m].sort((p, q) => ord(p[0]) - ord(q[0]))) (row[level] ??= []).push([a, why]);
    out[x] = row;
  }
  return out;
}

export async function run(ctx) {
  const { csv, warn, common } = ctx;
  const text = (v, where) => publishText(v, where, warn);
  const placeOf = common.placeOf;
  const unitByKey = new Map(common.units.map((u) => [u.key, u]));
  const recordById = new Map(common.records.map((r) => [r.id, r]));

  // 이 단위의 확정 기록이 든 줄기(공용 기록의 threads 칸을 단위별로 모은다)
  const threadsOf = new Map();
  for (const r of common.records) {
    if (!r.unit || !Array.isArray(r.threads) || !r.threads.length) continue;
    const set = threadsOf.get(r.unit) ?? threadsOf.set(r.unit, new Set()).get(r.unit);
    for (const t of r.threads) set.add(t);
  }
  const threadOrder = new Map(common.threads.map((t, i) => [t.id, i]));
  const sortedThreads = (set) => [...(set ?? [])].sort((a, b) => (threadOrder.get(a) ?? 1e9) - (threadOrder.get(b) ?? 1e9));

  // 판정 이력(annotations/layers.json 검토 기록) — K-ID로 잇는다
  const judgments = new Map((ctx.records.ds.layers?.data?.units ?? []).map((k) => [k.id, k]));
  const reviewNotes = [];
  const noteIndex = new Map();
  const noteId = (note, where) => {
    if (typeof note !== 'string' || !note) return undefined;
    if (!noteIndex.has(note)) { noteIndex.set(note, reviewNotes.length); reviewNotes.push(text(note, where)); }
    return noteIndex.get(note);
  };
  const reviewsOf = (kid) => (judgments.get(kid)?.reviews ?? []).map((r) => compact({
    session: r.session, date: r.date, decision: r.decision, before: text(r.before, `${kid} review before`), note: noteId(r.note, `${kid} review note`),
  }));

  // 주역 명단(확정) — 원점 단위 → 주역
  const leadRows = (ctx.records.ds.leads?.data?.leads ?? []).filter((l) => l.status === '확정');
  const originOf = new Map();
  for (const l of leadRows) {
    if (!l.origin || l.origin === '메인') continue;
    (originOf.get(l.origin) ?? originOf.set(l.origin, []).get(l.origin)).push(l.person);
  }
  const tickOf = (key) => (key ? placeOf.get(key)?.tick ?? null : null);
  const leads = leadRows.map((l) => compact({
    id: l.id, person: l.person, from: l.from, from_tick: tickOf(l.from), origin: l.origin,
    origin_tick: l.origin && l.origin !== '메인' ? tickOf(l.origin) : undefined,
    arcs: Array.isArray(l.arcs) ? l.arcs : undefined, records: Array.isArray(l.records) ? l.records : undefined,
    reason: text(l.reason, `${l.id} reason`), confidence: l.confidence,
  }));

  // 판정 단위 421 — importance/units.csv
  const rows = csv('data/views/importance/units.csv');
  const counts = { 필수: 0, 보강: 0, 참고: 0, 독립: 0 };
  let missing = 0;
  const units = [];
  const detail = {};
  for (const r of rows) {
    const key = r.unit;
    if (!unitByKey.has(key)) { missing++; warn({ where: `order ${key}`, msg: '공용 단위 목록에 없는 판정 단위 — 건너뜀' }); continue; }
    if (!r.grade) { warn({ where: `order ${key}`, msg: '등급이 비어 있다' }); continue; }
    if (r.grade in counts) counts[r.grade]++;
    const basis = recordById.get(r.basis);
    if (r.basis && !basis && !/^J\d+$/.test(r.basis)) warn({ where: `order ${key}`, msg: `결정 근거 기록 ${r.basis}이 확정 기록에 없다` });
    const tick = num(r.pos);
    const fromTick = num(r.from_pos);
    units.push(compact({
      key, grade: r.grade, tick, from: r.from || undefined, from_tick: fromTick, before: r.before || undefined,
      path: r.grade_path && r.grade_path !== r.grade ? r.grade_path : undefined,
      basis: r.basis || undefined, basis_kind: basis?.kind, basis_scene: basis?.scene, basis_line: basis?.line,
      reason: text(r.reason, `${key} reason`), confidence: r.confidence || undefined, asof: r.asof || undefined,
      judgment: r.judgment || undefined, trail: gradeTrail(r.history),
      threads: sortedThreads(threadsOf.get(key)), lead_facts: r.leads || undefined, closures: r.closures || undefined,
      origin_of: originOf.get(key),
    }));
    const d = compact({ history: r.history || undefined, basis_text: basis ? text(basis.text, `${key} basis_text`) ?? undefined : undefined, reviews: r.judgment ? reviewsOf(r.judgment) : undefined });
    if (Object.keys(d).length) detail[key] = d;
  }
  units.sort((a, b) => (a.tick ?? 1e9) - (b.tick ?? 1e9) || (placeOf.get(a.key)?.order ?? 1e9) - (placeOf.get(b.key)?.order ?? 1e9));
  if (missing) warn({ where: 'order', msg: `공용 단위 목록에 없는 판정 단위 ${missing}` });

  // 척추 60자리 — 메인 챕터 + 척추 이벤트 · 사이드, 공개 자리순(같은 날은 읽는 자리순)
  const spine = common.units
    .filter((u) => u.kind === 'main' || u.spine)
    .map((u) => ({ key: u.key, tick: u.tick, order: u.order }))
    .sort((a, b) => a.tick - b.tick || a.order - b.order);

  const pre = prereqsOf(csv('data/views/links/unit-edges.csv'), units, unitByKey);

  const asof = [...new Set(units.map((u) => u.asof).filter(Boolean))].sort().at(-1);
  return {
    files: {
      'order.json': { units, spine, leads, pre, counts: { grade: counts, judged: units.length, spine: spine.length, leads: leads.length, asof } },
      'order-detail.json': { notes: reviewNotes, units: detail },
    },
  };
}
