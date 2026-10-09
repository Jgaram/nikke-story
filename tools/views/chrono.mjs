/**
 * X1b — 작중 연대기 ①: 시점 기록(1회독 파일 times의 subject · at · years)을 작중 축 위 자리로 계산한다.
 * 형식은 docs/annotations.md "작중 연대기", 화면은 docs/views.md 화면 6. 원문은 읽지 않는다. 시트는 쓰지 않는다.
 * 관계 · 기준은 Claude가 기록 문장을 읽고 구조화한 것(X1b 확정, 사용자가 뒤집는다)이고, 여기서는 기계적으로 계산만 한다.
 *
 * 작중 축 — 점(point)을 차례로 늘어놓는다: 시대 기준점(annotations/chronology.json eras, 과거 → 지금) + 메인 챕터(ch00 → ch48, 번호 순).
 *   메인 챕터를 번호 순에 고정한 것은 가정이다(게임이 챕터를 차례로 연다 — 기록 대부분이 'CH.N 직후'). 기록이 이와 다르게 말하는 곳
 *   (ch43 · ch44가 앞 챕터와 '같은 무렵')은 모순이 아니라 "메인 챕터끼리" 목록으로 따로 보인다.
 *   자리(pos): 점 i = 2i+1, 점 i-1과 점 i 사이 칸 = 2i, 첫 점 앞 = 0, 마지막 점 뒤 = 2P. 모르는 끝은 ±∞.
 *
 * 노드 — 기록이 자리를 정하는 것:
 *   단위 노드(unit:<키>) — subject '단위'(기준점의 기본값): 그 단위의 '지금'. 메인 챕터는 고정점이다.
 *   조각 노드(S<n>) — subject '구간'(회상의 기본값): 그 기록의 근거 장면(회상 구간 · 단위 안 다른 때).
 *   시대 기준점(@…) — subject '@…': 기준점 자체를 말하는 기록(연수 근거). 고정점이라 확인만 한다.
 *
 * 관계 at = [[관계, 기준, 간격?], …] — 모두 만족해야 한다(교집합). 기준: 단위 키 · 씬 ID · 시점 기록 ID(S<n>) · 시대 기준점(@…).
 *   기준이 고정점(시대 기준점 · 메인 챕터 키)이면 칸을 건너 엄격하게 — 'ch20 뒤'는 ch20 무렵이 아니다:
 *     직후  b < x ≤ 다음 점(b+1 ~ b+2 — 그 사이 칸이나 다음 챕터 첫머리)      직전  이전 점 ≤ x < b(b-2 ~ b-1)
 *     뒤    x > b      전  x < b      동시 · 중  x = b      무렵  |x - b| ≤ 1(b와 앞뒤 칸)
 *   기준이 고정되지 않은 노드(단위 · 조각)이거나 씬(그 단위 안 한 때)이면 같은 칸 안의 앞뒤일 수 있어 칸을 올리지 않는다:
 *     직후  b ≤ x ≤ b+1    뒤  x ≥ b    직전  b-1 ≤ x ≤ b    전  x ≤ b    동시 · 중  x = b    무렵  |x - b| ≤ 1
 *   점 하나로 보므로 중은 동시와 표시만 다르다. 간격(gap)은 표시용 글이다.
 *   연수(years — 지금에서 몇 년 전, 수 또는 [처음, 끝])만 시대 기준점의 years로 자리를 정한다.
 *
 * 계산 — 자리 구간 [lo, hi]를 제약 전파로 좁힌다(고정점에서 시작해 관계를 따라 양쪽으로).
 *   1) 유한 구간 [0, 2P]로 전파해 모순(빈 구간 · 고정점 어김)을 찾는다. 모순을 만든 관계 하나를 끄고 다시 — 모순이 없을 때까지.
 *      칸 안 앞뒤는 칸을 올리지 않으므로 순환(A 뒤 B · B 뒤 A)은 따로 — 앞뒤 관계 그래프의 강한 연결 요소에 앞뒤 선이 들면 순환이다.
 *   2) 남은 관계로 ±∞에서 다시 전파한다 — 고정점에 닿는 경계만 남는다.
 *   판별 = 폭(hi - lo) ≤ 2(한 점 무렵 · 이웃한 두 점 사이) · 범위 = 경계가 있으나 더 넓음 · 상대 = 관계는 있으나 고정점에 닿지 않음(다른 단위와의 앞뒤만) ·
 *   불명 = 관계 없음. 단위는 단위 노드로, 단위 노드에 관계가 없으면 기준점 조각들(구간)로 가른다 — 조각이 모두 판별이면 판별(여러 자리).
 *   기록이 모두 회상인 단위(과거 문서인 유실물 · 옛이야기만 하는 호감도 스토리)는 회상 조각들로 가른다(via 회상 — '지금' 틀은 모른다).
 * 좁힘(X1c) — 시점 기록이 없거나 모자란 단위는 annotations/chronology.json units의 항목(관계 · 근거 · 이유 · 확신도, Claude 확정)이
 *   그 단위의 '지금'(단위 노드)에 관계를 더한다. 원문에서 나온 시점 기록과 섞지 않으려고 따로 둔다(X1b 인계). 관계가 없는 항목(at = [])은
 *   "단서 없음 — 시점 불명"을 확인했다는 표시다. 좁힘이 있으면 via에 '좁힘'이 붙는다(자기 시점 기록과 함께면 '단위 · 좁힘').
 *   piece(S…)가 있는 항목은 단위의 '지금'이 아니라 그 단위의 조각(구간 시점 기록)에 관계를 더한다(X1c-3 — 한쪽만 아는 조각의 반대쪽 경계).
 *   모습 코드(codes)는 시점과 이어진 코드의 뜻 — 좁힘의 근거(code:<코드>)로만 쓰고 계산에는 넣지 않는다(이벤트 의상처럼 시점과 무관한 코드가 있다).
 * 기각된 기록은 뺀다. 같은 기록이면 같은 결과.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CHRONOLOGY_PATH, CONFIDENCES, READ1_DIR, TIME_RELS, TIME_SUBJECTS, compareIds, displayPath } from '../records/model.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const INF = Infinity;

/** [x.lo ≥ b.lo + a, x.hi ≤ b.hi + b, b.lo ≥ x.lo + c, b.hi ≤ x.hi + d] — null = 그 쪽 제약 없음 */
const OFFSETS = {
  // 기준이 고정점
  strict: { 직후: [1, 2, -2, -1], 뒤: [1, null, null, -1], 직전: [-2, -1, 1, 2], 전: [null, -1, 1, null], 동시: [0, 0, 0, 0], 중: [0, 0, 0, 0], 무렵: [-1, 1, -1, 1] },
  // 기준이 고정되지 않은 노드 · 씬
  loose: { 직후: [0, 1, -1, 0], 뒤: [0, null, null, 0], 직전: [-1, 0, 0, 1], 전: [null, 0, 0, null], 동시: [0, 0, 0, 0], 중: [0, 0, 0, 0], 무렵: [-1, 1, -1, 1] },
};
/** 앞뒤 관계 그래프의 선 — 순환 찾기. [앞 → 뒤가 b → x인가, 엄격한가] */
const ORDER_EDGES = { 직후: 'bx', 뒤: 'bx', 직전: 'xb', 전: 'xb', 동시: '=', 중: '=' };

/**
 * 시대 기준점 파일. 기본 디렉터리면 annotations/chronology.json, 다른 디렉터리(예시)면 그 안의 `_chronology.json`(없으면 빈 목록)
 * @returns {{ eras: object[], codes: object[], units: object[], by: string|null, name: string|null, problems: string[] }}
 */
export function loadChronology(dir = READ1_DIR) {
  const p = path.resolve(dir) === path.resolve(READ1_DIR) ? CHRONOLOGY_PATH : path.join(dir, '_chronology.json');
  if (!fs.existsSync(p)) return { eras: [], codes: [], units: [], by: null, name: null, problems: [] };
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { eras: arr(d.eras), codes: arr(d.codes), units: arr(d.units), by: d.by ?? null, name: displayPath(p), problems: [] };
  } catch (err) {
    return { eras: [], codes: [], units: [], by: null, name: displayPath(p), problems: [`${displayPath(p)}: JSON이 깨졌다 — ${err.message}`] };
  }
}

/** 좁힘 항목(units) · 모습 코드(codes)의 칸 */
export const NARROW_FIELDS = ['unit', 'piece', 'at', 'years', 'basis', 'reason', 'confidence', 'session', 'by', 'date', 'note'];
export const CODE_FIELDS = ['code', 'person', 'meaning', 'first', 'at', 'basis', 'reason', 'session', 'by', 'note'];
const BASIS_RECORD = /^[A-Z]\d+(-\d+)?$/;

/**
 * chronology.json의 모습 코드(codes) · 좁힘(units) 검사 — 검증기(records check)가 부른다.
 * 근거(basis)는 기록 ID(F · Q · S · D · E · I · U …) · `code:<모습 코드>`(codes에 있어야) · 씬 ID나 `씬#줄` · 단위 키.
 * @param {{ codes: object[], units: object[] }} chron
 * @param {{ eras: Set<string>, times: Map<string, object>, resolveKey: (k: string) => object|null, unitOf: (k: string) => string|null,
 *   ids: Set<string>, hasCode: (c: string) => boolean, targets: Set<string>, mains: Set<string>, reading: Set<string>|null }} ref
 * @returns {{ errors: { id: string, msg: string }[], warnings: { id: string, msg: string }[] }}
 */
export function chronologyProblems(chron, ref) {
  const errors = [];
  const warnings = [];
  const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
  const codeIds = new Set(arr(chron.codes).map((c) => c?.code));
  const unknownFields = (o, fields, id) => {
    for (const k of Object.keys(o)) if (!fields.includes(k)) warnings.push({ id, msg: `모르는 칸 "${k}" — 쓸 수 있는 칸: ${fields.join(' · ')}` });
  };
  const checkBasis = (basis, id, required) => {
    if (basis === undefined && !required) return;
    if (!Array.isArray(basis) || (required && !basis.length) || !basis.every(isStr)) {
      errors.push({ id, msg: 'basis는 근거 글자 배열 — 기록 ID · code:<모습 코드> · 씬 ID(#줄) · 단위 키' });
      return;
    }
    for (const b of basis) {
      if (BASIS_RECORD.test(b)) {
        if (!ref.ids.has(b)) errors.push({ id, msg: `basis: 없는 기록 ${b}` });
      } else if (b.startsWith('code:')) {
        if (!codeIds.has(b.slice(5))) errors.push({ id, msg: `basis: codes에 없는 모습 코드 ${b}` });
      } else {
        const [key, lines] = b.split('#');
        if (!ref.resolveKey(key)) errors.push({ id, msg: `basis: 모르는 근거 ${b} — 기록 ID · code:<코드> · 씬 ID(#줄) · 단위 키` });
        else if (lines !== undefined && !/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(lines)) errors.push({ id, msg: `basis: 줄 번호 꼴 ${b} — 씬#12 · 씬#3-5` });
      }
    }
  };
  const checkAt = (o, id, self) => {
    for (const m of timeShapeProblems({ at: o.at, years: o.years }, ref)) errors.push({ id, msg: m });
    if (!Array.isArray(o.at)) return;
    for (const r of o.at) if (Array.isArray(r) && self && ref.unitOf(r[1]) === self && !ref.resolveKey(r[1])?.scene) errors.push({ id, msg: `at: 자기 단위(${self})를 기준으로 삼았다` });
  };

  const seenCodes = new Set();
  arr(chron.codes).forEach((c, i) => {
    const id = `codes[${i}]${c?.code ? ` ${c.code}` : ''}`;
    if (!c || typeof c !== 'object') return errors.push({ id, msg: '항목이 객체가 아니다' });
    unknownFields(c, CODE_FIELDS, id);
    if (!isStr(c.code)) errors.push({ id, msg: 'code(모습 코드 — lines.speaker_id)가 없다' });
    else if (seenCodes.has(c.code)) errors.push({ id, msg: '같은 코드가 둘이다' });
    else if (!ref.hasCode(c.code)) errors.push({ id, msg: `원문에 없는 모습 코드 ${c.code}` });
    seenCodes.add(c.code);
    if (!isStr(c.person) || !ref.targets.has(c.person)) errors.push({ id, msg: `person은 사전의 인물 ID — ${JSON.stringify(c.person)}` });
    for (const k of ['meaning', 'first', 'reason']) if (!isStr(c[k])) errors.push({ id, msg: `${k}가 없다` });
    if (isStr(c.first) && !ref.resolveKey(c.first.split('#')[0])) errors.push({ id, msg: `first: 모르는 씬 ${c.first}` });
    if (!Array.isArray(c.at)) errors.push({ id, msg: 'at(이 코드가 말하는 때 — 관계 배열)이 없다' });
    else checkAt(c, id, null);
    checkBasis(c.basis, id, false);
  });

  const seenUnits = new Set();
  arr(chron.units).forEach((e, i) => {
    const id = `units[${i}]${e?.unit ? ` ${e.unit}` : ''}${e?.piece ? ` ${e.piece}` : ''}`;
    if (!e || typeof e !== 'object') return errors.push({ id, msg: '항목이 객체가 아니다' });
    unknownFields(e, NARROW_FIELDS, id);
    if (!isStr(e.unit)) return errors.push({ id, msg: 'unit(읽기 단위 키)이 없다' });
    const key = e.piece === undefined ? e.unit : `${e.unit} ${e.piece}`;
    if (seenUnits.has(key)) errors.push({ id, msg: e.piece === undefined ? '같은 단위의 항목이 둘이다 — 하나로 합친다' : '같은 조각의 항목이 둘이다 — 하나로 합친다' });
    seenUnits.add(key);
    if (e.piece !== undefined) {
      // 조각(X1c-3) — 단위의 '지금'이 아니라 그 단위의 구간 시점 기록(조각)에 관계를 더한다
      const t = isStr(e.piece) ? ref.times.get(e.piece) : null;
      const obj = t?.obj ?? t;
      if (!t) errors.push({ id, msg: `piece: 없는 시점 기록 ${JSON.stringify(e.piece)}` });
      else if (t.unit !== e.unit) errors.push({ id, msg: `piece: ${e.piece}는 ${t.unit}의 시점 기록이다` });
      else if (t.status === '기각') errors.push({ id, msg: `piece: 기각된 시점 기록 ${e.piece}` });
      else if (subjectOf(obj) !== '구간') errors.push({ id, msg: `piece: ${e.piece}는 조각(subject 구간 · 회상)이 아니다 — 단위의 '지금'은 piece 없이 쓴다` });
    }
    if (ref.mains.has(e.unit)) errors.push({ id, msg: '메인 챕터는 좁히지 않는다(작중 축의 고정점)' });
    else if (ref.reading ? !ref.reading.has(e.unit) : !ref.resolveKey(e.unit)) errors.push({ id, msg: `읽기 순서에 없는 단위 ${e.unit}` });
    if (!Array.isArray(e.at)) errors.push({ id, msg: 'at이 없다 — 관계 배열, 단서가 없으면 []' });
    else checkAt(e, id, e.unit);
    checkBasis(e.basis, id, Array.isArray(e.at) && (e.at.length > 0 || e.years !== undefined));
    if (!isStr(e.reason)) errors.push({ id, msg: 'reason(왜 이렇게 좁혔나 · 왜 단서가 없나)이 없다' });
    if (!CONFIDENCES.includes(e.confidence)) errors.push({ id, msg: `confidence는 ${CONFIDENCES.join(' · ')}` });
    if (!isStr(e.session)) errors.push({ id, msg: 'session(정한 항목 — X1c-1 …)이 없다' });
  });
  return { errors, warnings };
}

/** 시점 기록의 subject — 없으면 kind로(기준점 → 단위, 회상 → 구간) */
export const subjectOf = (t) => t.subject ?? (t.kind === '회상' ? '구간' : '단위');

/** years(수 또는 [처음, 끝]) → [처음, 끝] — 잘못되면 null */
export function yearsRange(y) {
  if (typeof y === 'number' && y >= 0) return [y, y];
  if (Array.isArray(y) && y.length === 2 && y.every((v) => typeof v === 'number' && v >= 0) && y[0] >= y[1]) return [y[0], y[1]];
  return null;
}

/**
 * 시점 기록 하나의 at · subject · years 꼴 검사(기준이 있는지는 resolve로). 검증기(records check)와 계산이 같이 쓴다.
 * @param {object} t 시점 기록 객체
 * @param {{ eras: Set<string>, times: Map<string, object>, resolveKey: (k: string) => object|null }} ref
 * @returns {string[]} 문제
 */
export function timeShapeProblems(t, ref) {
  const out = [];
  const subj = t.subject;
  if (subj !== undefined && !TIME_SUBJECTS.includes(subj) && !(typeof subj === 'string' && ref.eras.has(subj))) {
    out.push(`subject는 ${TIME_SUBJECTS.join(' · ')} · 시대 기준점(@…) 가운데 하나 — ${JSON.stringify(subj)}`);
  }
  if (t.years !== undefined && !yearsRange(t.years)) out.push('years는 지금에서 몇 년 전인지 — 수나 [처음, 끝](처음 ≥ 끝 ≥ 0)');
  if (t.at === undefined) return out;
  if (!Array.isArray(t.at)) return [...out, 'at은 [[관계, 기준, 간격?], …] 배열'];
  t.at.forEach((r, i) => {
    const w = `at[${i}]`;
    if (!Array.isArray(r) || r.length < 2 || r.length > 3 || !r.every((v) => typeof v === 'string' && v)) {
      out.push(`${w}: [관계, 기준, 간격?] — 글자들`);
      return;
    }
    const [rel, base] = r;
    if (!TIME_RELS.includes(rel)) out.push(`${w}: 모르는 관계 ${rel} — ${TIME_RELS.join(' · ')}`);
    if (base.startsWith('@')) {
      if (!ref.eras.has(base)) out.push(`${w}: 모르는 시대 기준점 ${base} — annotations/chronology.json eras`);
    } else if (/^S\d+$/.test(base)) {
      const s = ref.times.get(base);
      if (!s) out.push(`${w}: 없는 시점 기록 ${base}`);
      else if (s.status === '기각' && t.status !== '기각') out.push(`${w}: 기각된 ${base}를 가리킨다`);
      else if (base === t.id) out.push(`${w}: 자기 자신을 기준으로 삼았다`);
    } else if (!ref.resolveKey(base)) out.push(`${w}: 모르는 기준 ${base} — 단위 키 · 씬 ID · 시점 기록 ID · 시대 기준점`);
  });
  return out;
}

/**
 * @param {{
 *   times: { id: string, unit: string, kind: string, subject?: string, at?: any[], years?: any, status?: string, text?: string }[],
 *   eras: { id: string, name?: string, years?: number|null }[],
 *   mains: string[],
 *   units: { unit: string, kind: string, order: number, tick: number }[],
 *   resolveKey: (key: string) => ({ unit: string, scene: boolean }|null),
 *   narrows?: { unit: string, at: any[], years?: any, confidence?: string }[],
 * }} input — narrows: 좁힘 항목(annotations/chronology.json units, X1c)
 */
export function chronology({ times, eras, mains, units, resolveKey, narrows = [] }) {
  const problems = [];
  const live = times.filter((t) => t.status !== '기각');
  const timeById = new Map(live.map((t) => [t.id, t]));

  // 축
  const points = [
    ...eras.map((e) => ({ id: e.id, label: e.id, years: typeof e.years === 'number' ? e.years : null, era: true })),
    ...mains.map((k) => ({ id: k, label: k, years: null, era: false })),
  ];
  const P = points.length;
  points.forEach((p, i) => (p.pos = 2 * i + 1));
  const pointPos = new Map(points.map((p) => [p.id, p.pos]));
  const MAX = 2 * P;
  const label = (pos) => {
    if (pos === -INF || pos === INF) return '…';
    if (pos % 2 === 1) return points[(pos - 1) / 2].label;
    if (pos <= 0) return `${points[0]?.label ?? '?'} 전`;
    if (pos >= MAX) return `${points[P - 1]?.label ?? '?'} 뒤`;
    return `${points[pos / 2 - 1].label}–${points[pos / 2].label}`;
  };
  const place = (lo, hi) => {
    if (lo === -INF && hi === INF) return '';
    if (lo === hi) return label(lo);
    if (lo === -INF) return `~ ${label(hi)}`;
    if (hi === INF) return `${label(lo)} ~`;
    return `${label(lo)} ~ ${label(hi)}`;
  };

  // 연수 → 자리 구간. 연수가 있는 시대 기준점 + ch00(0년) 사이에서 찾는다
  const yearMarks = [...points.filter((p) => p.era && p.years != null).map((p) => ({ pos: p.pos, years: p.years }))];
  if (mains.length) yearMarks.push({ pos: pointPos.get(mains[0]), years: 0 });
  // 축 끝(첫 기준점 앞 · 지금 뒤)은 경계가 아니다 — ±∞
  const yearPos = (y) => {
    if (!yearMarks.length) return [-INF, INF];
    if (y > yearMarks[0].years) return [-INF, yearMarks[0].pos - 1];
    for (let i = 0; i < yearMarks.length; i++) {
      const a = yearMarks[i];
      if (y === a.years) return [a.pos - 1, i === yearMarks.length - 1 ? INF : a.pos + 1];
      const b = yearMarks[i + 1];
      if (b && y < a.years && y > b.years) return [a.pos + 1, b.pos - 1];
    }
    return [yearMarks.at(-1).pos - 1, INF];
  };

  // 노드
  const nodes = new Map();
  const node = (id, init = {}) => {
    if (!nodes.has(id)) nodes.set(id, { id, fixed: false, cons: 0, ...init });
    return nodes.get(id);
  };
  for (const p of points) node(p.era ? p.id : `unit:${p.id}`, { fixed: true, pos: p.pos, unit: p.era ? null : p.id, type: p.era ? '시대' : '메인' });
  const subjectNode = (t) => {
    const s = subjectOf(t);
    if (s === '구간') return node(t.id, { type: t.kind === '회상' ? '회상' : '구간', unit: t.unit, record: t });
    if (typeof s === 'string' && s.startsWith('@')) return nodes.get(s) ?? null;
    return node(`unit:${t.unit}`, { type: '단위', unit: t.unit });
  };
  const baseNode = (base) => {
    if (base.startsWith('@')) return nodes.has(base) ? { n: nodes.get(base), loose: false } : null;
    if (/^S\d+$/.test(base)) {
      const s = timeById.get(base);
      return s ? { n: subjectNode(s), loose: false } : null;
    }
    const r = resolveKey(base);
    if (!r) return null;
    return { n: node(`unit:${r.unit}`, { type: '단위', unit: r.unit }), loose: r.scene };
  };

  const cons = [];
  /** 기록(시점 기록 · 좁힘 항목) 하나의 관계 · 연수를 노드 x의 제약으로 */
  const addRelations = (rid, x, at, years, narrow) => {
    arr(at).forEach((r, i) => {
      if (!Array.isArray(r) || !OFFSETS.strict[r[0]]) {
        problems.push(`${rid} at[${i}]: 모르는 관계 ${JSON.stringify(r?.[0])}`);
        return;
      }
      const [rel, base, gap = ''] = r;
      const b = baseNode(base);
      if (!b) {
        problems.push(`${rid} at[${i}]: 모르는 기준 ${base}`);
        return;
      }
      if (b.n === x) {
        if (!b.loose) problems.push(`${rid} at[${i}]: 자기 노드(${x.id})를 기준으로 삼았다${narrow ? '' : ' — subject를 구간으로'}`);
        return; // 같은 단위 안 씬을 기준으로 단위 자신을 놓는 관계는 아무것도 정하지 않는다
      }
      const loose = b.loose || !b.n.fixed;
      cons.push({ id: `${rid}#${i}`, record: rid, rel, base, gap, x: x.id, b: b.n.id, loose, narrow, o: OFFSETS[loose ? 'loose' : 'strict'][rel] });
    });
    const yr = years !== undefined ? yearsRange(years) : null;
    if (years !== undefined && !yr) problems.push(`${rid}: years 꼴이 틀렸다`);
    if (yr) {
      const lo = yearPos(yr[0])[0];
      const hi = yearPos(yr[1])[1];
      cons.push({ id: `${rid}#years`, record: rid, rel: '연수', base: yr[0] === yr[1] ? `${yr[0]}년 전` : `${yr[0]}–${yr[1]}년 전`, gap: '', x: x.id, b: null, narrow, lo, hi });
    }
  };
  const sorted = [...live].sort((a, b) => compareIds(a.id, b.id));
  for (const t of sorted) {
    const x = subjectNode(t);
    if (!x) {
      problems.push(`${t.id}: 모르는 subject ${t.subject}`);
      continue;
    }
    x.records ??= [];
    x.records.push(t.id);
    addRelations(t.id, x, t.at, t.years, false);
  }
  // 좁힘(X1c) — 단위의 '지금'에 관계를 더한다. 기록 ID 대신 '좁힘:<단위>'.
  // piece가 있으면 그 조각(단위의 구간 시점 기록)에 더한다 — '좁힘:<S…>'(X1c-3)
  const narrowOf = new Map();
  const pieceNarrowOf = new Map();
  for (const e of [...arr(narrows)].sort((a, b) => compareIds(String(a?.unit), String(b?.unit)) || (a?.piece ? (b?.piece ? compareIds(a.piece, b.piece) : 1) : b?.piece ? -1 : 0))) {
    if (!e?.unit) continue;
    const rid = `좁힘:${e.piece ?? e.unit}`;
    const map = e.piece ? pieceNarrowOf : narrowOf;
    const key = e.piece ?? e.unit;
    let x;
    if (e.piece) {
      const t = timeById.get(e.piece);
      if (!t || t.unit !== e.unit || subjectOf(t) !== '구간') {
        problems.push(`${rid}: piece는 ${e.unit}의 조각(구간 시점 기록)이어야 한다`);
        continue;
      }
      x = subjectNode(t);
    }
    if (map.has(key)) {
      problems.push(`${rid}: 항목이 둘이다`);
      continue;
    }
    map.set(key, e);
    if (!e.piece) {
      x = node(`unit:${e.unit}`, { type: '단위', unit: e.unit });
      if (x.fixed) {
        problems.push(`${rid}: 메인 챕터는 좁히지 않는다(고정점)`);
        continue;
      }
    }
    addRelations(rid, x, e.at, e.years, true);
  }
  for (const c of cons) {
    nodes.get(c.x).cons++;
    if (c.b) nodes.get(c.b).cons++;
  }

  // 전파 — 모순이 나면 { con, why }
  const run = (finite) => {
    for (const n of nodes.values()) {
      if (n.fixed) [n.lo, n.hi] = [n.pos, n.pos];
      else [n.lo, n.hi] = finite ? [0, MAX] : [-INF, INF];
    }
    for (let guard = 0; ; guard++) {
      if (guard > 100000) throw new Error('작중 연대기 전파가 끝나지 않는다');
      let changed = false;
      for (const c of cons) {
        if (c.off) continue;
        const x = nodes.get(c.x);
        const tighten = (n, side, v) => {
          if (side === 'lo' ? v <= n.lo : v >= n.hi) return null;
          if (n.fixed) return `${n.id}는 ${label(n.pos)}에 고정인데 ${side === 'lo' ? `${label(v)} 이후` : `${label(v)} 이전`}여야 한다`;
          n[side] = v;
          changed = true;
          if (n.lo > n.hi) return `${n.id}의 자리가 비었다`;
          return null;
        };
        let why = null;
        if (!c.b) {
          why = tighten(x, 'lo', c.lo) ?? tighten(x, 'hi', c.hi);
        } else {
          const b = nodes.get(c.b);
          const [a1, a2, a3, a4] = c.o;
          if (a1 != null) why ??= tighten(x, 'lo', b.lo + a1);
          if (a2 != null) why ??= tighten(x, 'hi', b.hi + a2);
          if (a3 != null) why ??= tighten(b, 'lo', x.lo + a3);
          if (a4 != null) why ??= tighten(b, 'hi', x.hi + a4);
        }
        if (why) return { con: c, why };
      }
      if (!changed) return null;
    }
  };
  const conflicts = [];
  for (let k = 0; k <= cons.length; k++) {
    const bad = run(true);
    if (!bad) break;
    bad.con.off = true;
    conflicts.push(bad);
  }
  run(false);

  // 순환 — 앞뒤 선(뒤 · 전 · 직후 · 직전)과 같은 때 선(동시 · 중)으로 그래프를 만들어, 앞뒤 선이 든 강한 연결 요소를 찾는다
  const cycles = [];
  {
    const adj = new Map();
    const edges = [];
    const add = (a, b, c) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push(b);
      edges.push({ a, b, c });
    };
    for (const c of cons) {
      if (c.off || !c.b || !ORDER_EDGES[c.rel]) continue;
      const e = ORDER_EDGES[c.rel];
      if (e === '=') {
        add(c.x, c.b, null);
        add(c.b, c.x, null);
      } else if (e === 'bx') add(c.b, c.x, c);
      else add(c.x, c.b, c);
    }
    // Tarjan
    let idx = 0;
    const index = new Map();
    const low = new Map();
    const stack = [];
    const on = new Set();
    const comp = new Map();
    const strong = (v) => {
      index.set(v, idx);
      low.set(v, idx++);
      stack.push(v);
      on.add(v);
      for (const w of adj.get(v) ?? []) {
        if (!index.has(w)) {
          strong(w);
          low.set(v, Math.min(low.get(v), low.get(w)));
        } else if (on.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      }
      if (low.get(v) === index.get(v)) {
        let w;
        do {
          w = stack.pop();
          on.delete(w);
          comp.set(w, v);
        } while (w !== v);
      }
    };
    for (const v of [...adj.keys()].sort()) if (!index.has(v)) strong(v);
    const byComp = new Map();
    for (const e of edges) {
      if (!e.c || comp.get(e.a) !== comp.get(e.b)) continue;
      const k = comp.get(e.a);
      if (!byComp.has(k)) byComp.set(k, []);
      byComp.get(k).push(e.c);
    }
    for (const cs of byComp.values()) {
      const recs = [...new Set(cs.map((c) => c.record))].sort(compareIds);
      cycles.push({ records: recs, nodes: [...new Set(cs.flatMap((c) => [c.x, c.b]))].sort(), relations: cs.map((c) => `${c.record}: ${c.x} ${c.rel} ${c.base}`) });
    }
  }

  const classOf = (n) => {
    if (n.fixed) return '판별';
    if (n.lo === -INF && n.hi === INF) return n.cons ? '상대' : '불명';
    return n.hi - n.lo <= 2 ? '판별' : '범위';
  };
  const relText = (rec) => cons.filter((c) => c.record === rec && !c.off).map((c) => `${c.rel} ${c.base}${c.gap ? ` (${c.gap})` : ''}`);
  const num = (v) => (Number.isFinite(v) ? v : '');

  // 모순 · 메인 챕터끼리
  const isMainNode = (id) => nodes.get(id)?.type === '메인';
  const mainNotes = [];
  const contradictions = [];
  for (const { con: c, why } of conflicts) {
    const x = nodes.get(c.x);
    const b = c.b ? nodes.get(c.b) : null;
    const row = { record: c.record, rel: c.rel, base: c.base, gap: c.gap, node: c.x, node_place: place(x.lo, x.hi), base_place: b ? place(b.lo, b.hi) : '', why };
    if (isMainNode(c.x) && b && isMainNode(c.b)) mainNotes.push(row);
    else contradictions.push(row);
  }

  // 조각
  const pieces = [];
  for (const n of nodes.values()) {
    if (n.type !== '구간' && n.type !== '회상') continue;
    const t = n.record;
    const pe = pieceNarrowOf.get(n.id);
    pieces.push({ id: n.id, unit: t.unit, kind: t.kind, class: classOf(n), place: place(n.lo, n.hi), lo: num(n.lo), hi: num(n.hi),
      years: t.years !== undefined ? [].concat(t.years).join('–') : '', relations: relText(n.id).join('; '),
      narrow: pe ? relText(`좁힘:${n.id}`).join('; ') || (arr(pe.at).length || pe.years !== undefined ? '(모두 꺼짐)' : '단서 없음') : '',
      narrow_confidence: pe?.confidence ?? '', text: t.text ?? '' });
  }
  pieces.sort((a, b) => compareIds(a.id, b.id));

  // 단위
  const recordsOf = new Map();
  for (const t of sorted) {
    if (!recordsOf.has(t.unit)) recordsOf.set(t.unit, []);
    recordsOf.get(t.unit).push(t);
  }
  const rows = [];
  const seen = new Set();
  const unitRow = (u) => {
    seen.add(u.unit);
    const n = nodes.get(`unit:${u.unit}`);
    const recs = recordsOf.get(u.unit) ?? [];
    const own = pieces.filter((p) => p.unit === u.unit);
    const present = own.filter((p) => p.kind !== '회상');
    const back = own.filter((p) => p.kind === '회상');
    let cls = '불명';
    let where = '';
    let via = '';
    let lo = '';
    let hi = '';
    const live = (c) => !c.off;
    const ownRel = n && cons.some((c) => live(c) && c.x === n.id && !c.narrow);
    const ownNarrow = n && cons.some((c) => live(c) && c.x === n.id && c.narrow);
    const otherRel = n && cons.some((c) => live(c) && c.b === n.id && nodes.get(c.x).unit !== u.unit);
    // 자기 단위의 '지금'만 기준으로 삼은 회상(…년 전 · 전)은 그 '지금'을 모르면 아무것도 정하지 않는다
    const selfOnly = (p) => cons.filter((c) => live(c) && c.x === p.id).every((c) => !c.b || c.b === `unit:${u.unit}`);
    const fromPieces = (ps, how) => {
      const cs = ps.map((p) => (p.class === '상대' && selfOnly(p) ? '불명' : p.class));
      if (cs.every((c) => c === '불명')) return false;
      cls = cs.every((c) => c === '판별') ? '판별' : cs.some((c) => c === '판별' || c === '범위') ? '범위' : '상대';
      where = ps.map((p) => p.place).filter(Boolean).join(' / ');
      via = how;
      return true;
    };
    const fromNode = () => ([cls, where, via, lo, hi] = [classOf(n), place(n.lo, n.hi), '단위', num(n.lo), num(n.hi)]);
    // 차례: 메인 → 자기 관계(단위 subject) → 기준점 조각 → 남이 이 단위를 기준으로 삼은 관계 → 기록이 모두 회상이면 회상 조각
    if (n?.type === '메인') [cls, where, via, lo, hi] = ['판별', u.unit, '메인', n.pos, n.pos];
    else if (ownRel || ownNarrow) {
      fromNode();
      via = ownRel && ownNarrow ? '단위 · 좁힘' : ownNarrow ? '좁힘' : '단위';
    }
    else if (present.length && fromPieces(present, '조각'));
    else if (otherRel) fromNode();
    else if (recs.length && recs.every((t) => t.kind === '회상')) fromPieces(back, '회상');
    const e = narrowOf.get(u.unit);
    const narrow = !e ? '' : relText(`좁힘:${u.unit}`).join('; ') || (arr(e.at).length || e.years !== undefined ? '(모두 꺼짐)' : '단서 없음');
    rows.push({ order: u.order ?? '', tick: u.tick ?? '', unit: u.unit, kind: u.kind ?? '', class: cls, place: where, lo, hi, via,
      records: recs.map((t) => t.id).join(' '), pieces: present.map((p) => p.id).join(' '), flashbacks: back.map((p) => p.id).join(' '),
      relations: n?.records ? n.records.flatMap((id) => relText(id)).join('; ') : '', narrow, narrow_confidence: e?.confidence ?? '' });
  };
  for (const u of units) if (!seen.has(u.unit)) unitRow(u);
  // 읽기 순서 밖인데 기록 · 관계가 있는 단위
  for (const n of nodes.values()) if (n.unit && !seen.has(n.unit) && n.type === '단위') {
    problems.push(`${n.unit}: 읽기 순서에 없는 단위가 시점 기록에 나온다`);
    unitRow({ unit: n.unit });
  }

  return {
    points: points.map((p) => ({ id: p.id, pos: p.pos, years: p.years ?? '', era: p.era })),
    rows, pieces, contradictions, cycles, mainNotes, cons, problems,
    label, place,
    narrows: [...narrowOf.values(), ...pieceNarrowOf.values()],
    stats: { times: live.length, withAt: live.filter((t) => arr(t.at).length || t.years !== undefined).length, relations: cons.filter((c) => !c.narrow).length,
      narrowRelations: cons.filter((c) => c.narrow).length, off: conflicts.length },
  };
}
