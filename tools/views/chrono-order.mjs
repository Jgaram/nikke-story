/**
 * X1d — 작중 연대기 ③: 작중 자리(chrono.mjs)를 공개 축(reveal.mjs)과 견주고, 작중 순서로 늘어놓는다. 화면은 docs/views.md 화면 6.
 * 원문은 읽지 않는다. 새 해석을 하지 않는다 — 작중 자리 · 공개 자리 · 기록에서 기계적으로 낸다(규칙은 Claude가 정했다, X1d).
 *
 * 단위의 작중 구간(span) — chrono.csv의 lo · hi(빈 칸 = 그쪽 끝을 모름 → ±∞). 조각 · 회상으로 가른 단위(여러 자리)는 그 조각들을 감싸는 구간.
 *   상대 · 불명은 구간이 없다(작중 축에 닿지 않음).
 *
 * 어긋남(drift) — 단위의 작중 구간을 공개 당시 메인(그 단위의 공개 자리까지 나온 마지막 메인 챕터, 자리 m)과 견준다:
 *   과거 — 작중 축의 메인 앞(시대 기준점 쪽)에서만 일어남         앞 — 공개 당시 메인보다 확실히 앞(hi < m — 프리퀄)
 *   맞음 — 공개 당시 메인과 그 뒤 칸 안(m ≤ lo, hi ≤ m+1)         걸침 — 그 칸에 걸치지만 더 넓은 범위(앞 · 뒤 어느 쪽인지 모름)
 *   뒤 — 아직 안 나온 챕터 뒤(lo > m+1) — 앞질러 간 이야기(출시 캐릭터 호감도처럼 메인이 풀린 뒤에야 상황을 알게 된다, 사용자 2026-10-08)
 *   (빈 칸) — 메인 챕터 · 상대 · 불명
 *   gap = 그 사이 메인 챕터 수(앞: hi < 자리 ≤ m인 챕터, 뒤: m < 자리 ≤ lo인 챕터).
 * 앞뒤 기록 쌍(pairs) — 시점 기록 · 좁힘의 관계 가운데 단위의 '지금'끼리(조각 · 회상 빼고) 앞뒤를 말하는 것에서, 작중 앞 단위가 더 늦게 공개된 쌍.
 * 작중 순서(order) — 단위의 '지금'과 조각(구간 · 회상)을 한 줄로: 정렬 열쇠 = 구간의 앞 끝(모르면 뒤 끝) → 뒤 끝 → 판별 먼저 → 공개 자리 → 읽는 자리 → 키.
 *   범위는 앞 끝에 놓인다('~ ch20'처럼 앞 끝을 모르면 뒤 끝에). 상대 · 불명은 순서 없이 끝에 따로(seq 빈 칸).
 * 인물 변화의 작중 시점(changes) — 2회독 인물 변화 D(기준 · 변화)마다: time(S…)이 있으면 그 시점 기록의 자리(단위면 단위 구간, 구간 · 회상이면 조각),
 *   없으면 기록이 있는 단위(드러난 단위)의 구간. 인물마다 작중 순서로 늘어놓고, 먼저 공개된 변화보다 작중으로 확실히 앞인 변화(뒤바뀜)를 센다.
 * 공개 단계를 작중 축으로(reveals) — 공개 단계 줄마다 그 단위의 작중 구간. 뿌리마다:
 *   사실 — 작중 첫 드러냄(드러냄 줄 가운데 작중으로 다른 드러냄보다 확실히 뒤가 아닌 것의 단위), 앞당김 = 공개 순 처음 밝혀짐보다 작중으로 확실히 앞인 드러냄이 있다.
 *   의문 — 작중 첫 제기, 회수 먼저 = 제기보다 작중으로 확실히 앞인 회수(일부 · 전부)가 있다.
 *   '확실히 앞' = 앞 줄의 hi < 뒤 줄의 lo(두 구간이 겹치면 모른다). 구간이 없는 줄은 견주지 않는다.
 * 같은 입력이면 같은 결과.
 */
import { compareIds } from '../records/model.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const INF = Infinity;
const CLASS_RANK = { 판별: 0, 범위: 1, 상대: 2, 불명: 3 };
const num = (v) => (Number.isFinite(v) ? v : '');

/** chrono 행 · 조각의 lo · hi 칸 → 수(빈 칸 = ±∞). 상대 · 불명은 null */
function spanOf(r) {
  if (r.class !== '판별' && r.class !== '범위') return null;
  const lo = r.lo === '' || r.lo == null ? -INF : Number(r.lo);
  const hi = r.hi === '' || r.hi == null ? INF : Number(r.hi);
  if (lo === -INF && hi === INF) return null;
  return { lo, hi };
}

/** 정렬 열쇠 — 앞 끝(모르면 뒤 끝) */
const sortKey = (s) => (s.lo === -INF ? s.hi : s.lo);

/**
 * 단위마다 작중 구간 — 단위 노드로 가른 단위는 그 lo · hi, 조각 · 회상으로 가른 단위는 그 조각들을 감싸는 구간(양쪽 끝을 다 모를 수 있다)
 * key = 작중 순서의 정렬 열쇠 — 여러 조각이면 가장 앞 조각의 열쇠
 * @returns {Map<string, { class, place, lo, hi, key, multi }>}
 */
export function unitSpans(ch) {
  const pieceById = new Map(ch.pieces.map((p) => [p.id, p]));
  const out = new Map();
  for (const r of ch.rows) {
    let s = null;
    let multi = false;
    if (r.via === '조각' || r.via === '회상') {
      const ids = (r.via === '조각' ? r.pieces : r.flashbacks).split(' ').filter(Boolean);
      const ss = ids.map((id) => pieceById.get(id)).filter(Boolean).map(spanOf).filter(Boolean);
      if (ss.length) {
        s = { lo: Math.min(...ss.map((x) => x.lo)), hi: Math.max(...ss.map((x) => x.hi)), key: Math.min(...ss.map(sortKey)) };
        multi = ss.length > 1;
      }
    } else if ((s = spanOf(r))) s.key = sortKey(s);
    out.set(r.unit, s ? { class: r.class, place: r.place, lo: s.lo, hi: s.hi, key: s.key, multi } : { class: r.class, place: r.place, lo: null, hi: null, key: null, multi });
  }
  return out;
}

/** 공개 자리 → 그 자리까지 나온 마지막 메인 챕터 키 */
function releaseMains(rel) {
  const out = new Map();
  let last = '';
  for (const t of rel.ticks) {
    if (t.main) last = t.main;
    out.set(t.tick, last);
  }
  return out;
}

/**
 * 어긋남 — 단위마다 공개 당시 메인 · 어긋남 · 사이 챕터 수
 * @returns {Map<string, { release_main, drift, drift_gap }>}
 */
export function releaseDrift(ch, rel, spans = unitSpans(ch)) {
  const posOf = new Map(ch.points.map((p) => [p.id, p.pos]));
  const mainPoints = ch.points.filter((p) => !p.era);
  const firstMain = mainPoints[0]?.pos ?? 0;
  const mainAt = releaseMains(rel);
  const out = new Map();
  for (const r of ch.rows) {
    const u = rel.byUnit.get(r.unit);
    const rm = u ? mainAt.get(u.tick) ?? '' : '';
    const s = spans.get(r.unit);
    let drift = '';
    let gap = '';
    if (r.kind !== '메인' && rm && s?.lo != null) {
      const m = posOf.get(rm);
      const between = (a, b) => mainPoints.filter((p) => p.pos > a && p.pos <= b).length;
      if (s.hi < firstMain) [drift, gap] = ['과거', between(s.hi, m)];
      else if (s.hi < m) [drift, gap] = ['앞', between(s.hi, m)];
      else if (s.lo > m + 1) [drift, gap] = ['뒤', between(m, s.lo)];
      else if (s.lo >= m && s.hi <= m + 1) drift = '맞음';
      else drift = '걸침';
    }
    out.set(r.unit, { release_main: rm, drift, drift_gap: gap });
  }
  return out;
}

/**
 * 앞뒤 기록 쌍 — 단위의 '지금'끼리 앞뒤를 말하는 관계 가운데 작중 앞 단위가 더 늦게 공개된 것
 * @returns {object[]} { record, earlier, later, rel, base, earlier_tick, later_tick, narrow }
 */
export function prequelPairs(ch, rel) {
  const isUnitNode = (id) => id?.startsWith('unit:');
  const mains = new Set(ch.rows.filter((r) => r.kind === '메인').map((r) => r.unit));
  const out = [];
  const seen = new Set();
  for (const c of ch.cons) {
    if (c.off || !c.b || !isUnitNode(c.x) || !isUnitNode(c.b)) continue;
    const dir = { 직후: 'bx', 뒤: 'bx', 직전: 'xb', 전: 'xb' }[c.rel];
    if (!dir) continue;
    const xu = c.x.slice(5);
    const bu = c.b.slice(5);
    if (xu === bu || mains.has(xu) || mains.has(bu)) continue; // 메인과의 관계는 어긋남(drift)이 본다
    const [earlier, later] = dir === 'bx' ? [bu, xu] : [xu, bu];
    const te = rel.byUnit.get(earlier)?.tick;
    const tl = rel.byUnit.get(later)?.tick;
    if (te == null || tl == null || te <= tl) continue;
    const k = `${earlier}>${later}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ record: c.record, earlier, later, rel: c.rel, base: c.base, earlier_tick: te, later_tick: tl, narrow: !!c.narrow });
  }
  return out.sort((a, b) => a.later_tick - b.later_tick || a.earlier_tick - b.earlier_tick || compareIds(a.record, b.record));
}

/** 작중 순서 비교 — 열쇠 → 뒤 끝 → 판별 먼저. 무한끼리의 차는 0으로 */
const diff = (a, b) => (a === b ? 0 : a - b);
function compareSpan(a, b) {
  return diff(a.key, b.key) || diff(a.hi, b.hi) || (CLASS_RANK[a.class] ?? 9) - (CLASS_RANK[b.class] ?? 9);
}

/**
 * 작중 순서 — 화면 6 시안. 단위의 '지금'(entry = 단위 키)과 조각(entry = S…)을 한 줄로
 * @returns {object[]} { seq, entry, unit, kind, type, class, place, lo, hi, slot, order, tick, release_main, drift, drift_gap, via, text }
 */
export function chronoOrder(ch, rel, spans = unitSpans(ch), drift = releaseDrift(ch, rel, spans)) {
  const rows = [];
  for (const r of ch.rows) {
    const u = rel.byUnit.get(r.unit);
    const s = spans.get(r.unit);
    const d = drift.get(r.unit) ?? {};
    // 조각으로 가른 단위(여러 자리)는 조각들도 제자리에 따로 나오고, 단위 줄은 가장 앞 조각 자리에 둔다
    rows.push({ entry: r.unit, unit: r.unit, kind: r.kind, type: '지금', class: r.class, place: r.place, lo: s?.lo ?? null, hi: s?.hi ?? null, key: s?.key ?? null,
      order: u?.order ?? '', tick: u?.tick ?? '', release_main: d.release_main ?? '', drift: d.drift ?? '', drift_gap: d.drift_gap ?? '', via: r.via, text: '' });
  }
  for (const p of ch.pieces) {
    const u = rel.byUnit.get(p.unit);
    const s = spanOf(p);
    rows.push({ entry: p.id, unit: p.unit, kind: u?.kind ?? '', type: p.kind === '회상' ? '회상' : '구간', class: p.class, place: p.place,
      lo: s?.lo ?? null, hi: s?.hi ?? null, key: s ? sortKey(s) : null, order: u?.order ?? '', tick: u?.tick ?? '', release_main: '', drift: '', drift_gap: '', via: '', text: p.text });
  }
  const placed = rows.filter((r) => r.key != null);
  const rest = rows.filter((r) => r.key == null);
  const tie = (a, b) => (a.tick || 0) - (b.tick || 0) || (a.order || 0) - (b.order || 0) || (a.type === '지금' ? 0 : 1) - (b.type === '지금' ? 0 : 1) || compareIds(a.entry, b.entry);
  placed.sort((a, b) => compareSpan(a, b) || tie(a, b));
  rest.sort((a, b) => (CLASS_RANK[a.class] ?? 9) - (CLASS_RANK[b.class] ?? 9) || tie(a, b));
  placed.forEach((r, i) => {
    r.seq = i + 1;
    r.slot = r.key;
  });
  for (const r of rest) [r.seq, r.slot] = ['', ''];
  return [...placed, ...rest].map(({ key, ...r }) => ({ ...r, lo: r.lo == null ? '' : num(r.lo), hi: r.hi == null ? '' : num(r.hi), slot: r.slot === '' ? '' : num(r.slot) }));
}

/**
 * 인물 변화의 작중 시점 — 2회독 D(기준 · 변화)마다 작중 구간과 인물별 작중 순서
 * @param {object} ds loadDataset()
 * @param {object} ch chronology()
 * @param {Map} spans unitSpans()
 * @param {{ byUnit: Map }} rel releasePlaces()
 * @returns {{ rows: object[], persons: object[] }}
 *   rows[i] = { person, seq, id, act, aspect, with, text, unit, order, tick, time, source, class, place, lo, hi, inverted }
 *   persons[i] = { person, changes, placed, inverted, examples[] } — inverted = 먼저 공개된 같은 인물의 변화보다 작중으로 확실히 앞인 변화 수
 */
export function changeTimeline(ds, ch, spans, rel) {
  const pieceById = new Map(ch.pieces.map((p) => [p.id, p]));
  const timeById = new Map(ds.candidates.filter((c) => c.kind === 'time' && c.status !== '기각').map((c) => [c.id, c]));
  const eraPos = new Map(ch.points.filter((p) => p.era).map((p) => [p.id, p.pos]));
  const live = ds.candidates.filter((c) => c.kind === 'change' && c.id && c.status !== '기각' && c.obj?.person);
  const rows = live.map((c) => {
    const u = rel.byUnit.get(c.unit);
    const tid = typeof c.obj.time === 'string' ? c.obj.time : '';
    const t = tid ? timeById.get(tid) : null;
    let s = null;
    let source = '단위';
    if (t) {
      const subj = t.obj?.subject ?? (t.act === '회상' ? '구간' : '단위');
      if (subj === '구간') {
        const p = pieceById.get(tid);
        s = p ? { class: p.class, place: p.place, ...(spanOf(p) ?? { lo: null, hi: null }) } : null;
        source = `조각 ${tid}`;
      } else if (subj.startsWith('@')) {
        const pos = eraPos.get(subj);
        s = pos ? { class: '판별', place: subj, lo: pos, hi: pos } : null;
        source = `기준점 ${tid}`;
      } else {
        s = spans.get(t.unit) ?? null;
        source = t.unit === c.unit ? `단위 ${tid}` : `단위 ${tid}(${t.unit})`;
      }
    } else s = spans.get(c.unit) ?? null;
    // 여러 조각을 감싸 양쪽 끝을 다 모르는 단위는 한 자리에 놓을 수 없다
    if (s && s.lo === -INF && s.hi === INF) s = { ...s, lo: null, hi: null };
    const text = c.act === '변화' ? `${c.obj.before ?? '?'} → ${c.obj.after ?? '?'}` : c.obj.text ?? '';
    return { person: c.obj.person, id: c.id, act: c.act ?? '', aspect: c.obj.aspect ?? '', with: arr(c.obj.with).join(' '), text, unit: c.unit,
      order: u?.order ?? '', tick: u?.tick ?? '', time: tid, source, class: s?.class ?? '불명', place: s?.place ?? '',
      _lo: s?.lo ?? null, _hi: s?.hi ?? null };
  });
  const byPerson = new Map();
  for (const r of rows) (byPerson.get(r.person) ?? byPerson.set(r.person, []).get(r.person)).push(r);
  const out = [];
  const persons = [];
  for (const [person, rs] of [...byPerson].sort((a, b) => a[0].localeCompare(b[0]))) {
    const placed = rs.filter((r) => r._lo != null);
    const rest = rs.filter((r) => r._lo == null);
    const tie = (a, b) => (a.act === '기준' ? 0 : 1) - (b.act === '기준' ? 0 : 1) || (a.tick || 0) - (b.tick || 0) || (a.order || 0) - (b.order || 0) || compareIds(a.id, b.id);
    const sp = (r) => ({ key: sortKey({ lo: r._lo, hi: r._hi }), hi: r._hi, class: r.class });
    placed.sort((a, b) => compareSpan(sp(a), sp(b)) || tie(a, b));
    rest.sort((a, b) => (a.tick || 0) - (b.tick || 0) || (a.order || 0) - (b.order || 0) || compareIds(a.id, b.id));
    // 뒤바뀜 — 먼저 공개된 변화(공개 자리가 더 앞)보다 작중으로 확실히 앞인 변화
    const changes = placed.filter((r) => r.act === '변화');
    const examples = [];
    for (const b of changes) {
      const before = changes.filter((a) => a.tick < b.tick && b._hi < a._lo);
      b.inverted = before.map((a) => a.id).join(' ');
      if (before.length) examples.push({ id: b.id, unit: b.unit, source: b.source, over: before.map((a) => a.id) });
    }
    placed.forEach((r, i) => (r.seq = i + 1));
    for (const r of rest) r.seq = '';
    for (const r of [...placed, ...rest]) out.push({ ...r, lo: r._lo == null ? '' : num(r._lo), hi: r._hi == null ? '' : num(r._hi), inverted: r.inverted ?? '' });
    persons.push({ person, changes: rs.filter((r) => r.act === '변화').length, placed: changes.length, inverted: examples.length, examples });
  }
  for (const r of out) {
    delete r._lo;
    delete r._hi;
  }
  return { rows: out, persons };
}

/**
 * 공개 단계를 작중 축으로 — 줄마다 단위의 작중 구간을, 뿌리마다 작중 첫 단위 · 앞당김(사실) · 회수 먼저(의문)를 더한 새 표
 * @param {{ rows: object[], roots: object[] }} st revealStages()
 * @returns {{ rows: object[], roots: object[] }}
 */
export function revealChrono(st, spans) {
  const sp = (u) => spans.get(u);
  const rows = st.rows.map((r) => {
    const s = sp(r.unit);
    return { ...r, chrono_place: s?.place ?? '', chrono_lo: s?.lo == null ? '' : num(s.lo), chrono_hi: s?.hi == null ? '' : num(s.hi) };
  });
  const byRoot = new Map();
  for (const r of st.rows) (byRoot.get(r.root) ?? byRoot.set(r.root, []).get(r.root)).push(r);
  const before = (a, b) => a.hi < b.lo; // 확실히 앞
  const roots = st.roots.map((root) => {
    const ls = (byRoot.get(root.id) ?? []).map((r) => ({ r, s: sp(r.unit) })).filter((x) => x.s?.lo != null);
    const isFact = root.kind === '사실';
    const opens = ls.filter((x) => (isFact ? x.r.act === '드러냄' : x.r.act === '제기'));
    const minimal = opens.filter((x) => !opens.some((y) => y !== x && before(y.s, x.s)));
    const units = [...new Set(minimal.map((x) => x.r.unit))];
    let shift = '';
    if (isFact) {
      const firsts = opens.filter((x) => x.r.stage === '처음 밝혀짐');
      // 공개 순 처음 밝혀짐이 모두 구간이 있어야 견준다
      const allFirst = (byRoot.get(root.id) ?? []).filter((r) => r.stage === '처음 밝혀짐');
      if (firsts.length && firsts.length === allFirst.length && opens.some((x) => x.r.stage !== '처음 밝혀짐' && firsts.every((f) => before(x.s, f.s)))) shift = '앞당김';
    } else {
      const allOpen = (byRoot.get(root.id) ?? []).filter((r) => r.act === '제기');
      if (opens.length && opens.length === allOpen.length && ls.some((x) => x.r.act === '회수' && opens.every((o) => before(x.s, o.s)))) shift = '회수 먼저';
    }
    return { ...root, chrono_first_units: units.join(' '), chrono_shift: shift };
  });
  return { rows, roots };
}
