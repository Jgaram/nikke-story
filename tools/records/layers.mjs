/**
 * 2회독 층 (B0b-2) — annotations/layers.json의 층 판정(K<n>)과 단위 종류로 층을 계산한다. 형식 · 규칙은 docs/annotations.md "층 판정".
 *
 * 판정 파일에 적는 것은 메인 밖 단위마다 등급(필수 · 보강 · 참고 · 독립)과 그 근거 한 건(basis)뿐이다. 층은 여기서 계산한다:
 *   - 메인 · 척추 이벤트 · 사이드(annotations/spine.json, X3f-1c) → 1층 (채점하지 않는다 — 척추 단위의 판정 K는 "척추" 표시로 남는다)
 *   - 서브퀘스트 · 유실물 · 엘리베이터       → 1층 (챕터와 함께 읽는다 — 등급은 따로 남는다)
 *   - 사이드 · 이벤트                        → 필수 · 보강 1층 · 참고 · 독립 2층, 독립이면서 1회독 기록이 2건 이하(일상극)면 3층
 *   - 이벤트 유실물                          → 그 이벤트의 층 (필수면 1층)
 *   - 호감도                                → 필수 1층 · 보강 · 참고 2층 · 독립 3층
 * 참고(X3f)는 2층이다 — 메인과 줄로 이어지지 않아 1층("줄기에 걸린 이벤트 · 사이드")은 아니고, 세계 · 메인 인물을 더 알게 되므로 일상극(3층)도 아니다.
 * 2회독이 끝나 층은 읽은 층으로 묶여 있다(X3a) — 이 규칙은 새 단위(N3)와 검증기의 경고에만 쓰인다.
 * 판정에 `layer`가 있으면 그것이 이긴다(사용자가 층만 뒤집을 때 — note에 까닭).
 * 기각된 판정은 없는 것으로 친다. 후보는 넣되 상태를 그대로 둔다(확정값처럼 쓰는 쪽이 거른다).
 */
import { GRADES, LAYERS, isRecord, spineUnits } from './model.mjs';
import { kindOfKey } from './order.mjs';

/** 이벤트 유실물 → 그 이벤트 (읽기 순서에서 이벤트 바로 뒤에 읽는다) */
export const ERELIC_EVENT = {
  'erelic:white_memory': 'event_overzone',
  'erelic:red_ash_lost': 'event_redash',
  'erelic:red_ash_mini': 'event_redash',
  'erelic:old_tales_dialog': 'event_oldtales1',
  'erelic:old_tales_lost': 'event_oldtales1',
  'erelic:old_tales_mini_memory': 'event_oldtales1',
  'erelic:unbreakable_sphere_dialog': 'event_unbreakablesphere1',
  'erelic:unbreakable_sphere_lost': 'event_unbreakablesphere1',
  'erelic:goddess_fall_mini': 'event_goddessfall1',
};

/** 기록이 이 수 이하인 독립 이벤트는 일상극으로 3층 (호감도 3층과 같은 기준 — 사용자, 2026-10-04 "기록이 거의 없는 일상극") */
export const FEW_RECORDS = 2;

/** 층 규칙에 쓰는 단위 종류 — kindOfKey에 이벤트 유실물을 가른다 */
export function layerKind(key) {
  if (String(key).startsWith('erelic:')) return '이벤트 유실물';
  return kindOfKey(key);
}

/**
 * 규칙으로 정한 층
 * @param {{ key: string, grade: string|null, records: number, eventLayer?: number|null }} u
 * @returns {number|null} 판정이 없어 못 정하면 null
 */
export function ruleLayer({ key, grade, records, eventLayer = null, spine = false }) {
  const kind = layerKind(key);
  if (spine || kind === '메인' || kind === '서브퀘스트' || kind === '유실물' || kind === '그 밖') return 1;
  if (!GRADES.includes(grade)) return null;
  if (kind === '이벤트 유실물') return grade === '필수' ? 1 : eventLayer ?? (grade === '보강' ? 1 : 2);
  if (kind === '사이드' || kind === '이벤트') return grade === '독립' ? (records <= FEW_RECORDS ? 3 : 2) : grade === '참고' ? 2 : 1;
  return { 필수: 1, 보강: 2, 참고: 2, 독립: 3 }[grade];
}

/** 단위의 1회독 기록 수 — 사실 · 의문 정의와 사건(시점은 빼고), 기각은 뺀다 */
export function recordCounts(ds) {
  const n = new Map();
  for (const c of ds.candidates) {
    if (!c.id || c.status === '기각' || !isRecord(c) || c.kind === 'time' || !c.unit) continue;
    n.set(c.unit, (n.get(c.unit) ?? 0) + 1);
  }
  return n;
}

/**
 * 읽기 단위마다 등급 · 층
 * @param {ReturnType<import('./model.mjs').loadDataset>} ds
 * @param {{ items: {key:string}[] }} order 1회독 순서(docs/history/reading.md R) — 단위 목록과 읽는 차례
 * @returns {{ units: object[], byUnit: Map<string, object>, missing: string[], doubled: string[] }} missing: 1회독 기록이 있는데 판정이 없는 메인 밖 단위
 *   units[i] = { key, kind, order, records, judgment(후보 객체|null), grade, basis, ruleLayer, layer, status, spine } — spine: 척추 단위(채점 밖, 1층)
 */
export function computeLayers(ds, order) {
  const spine = spineUnits(ds);
  const keys = [];
  for (const it of order.items) if (!keys.includes(it.key)) keys.push(it.key);
  const counts = recordCounts(ds);
  const judged = new Map();
  const doubled = [];
  for (const c of ds.candidates) {
    if (c.kind !== 'layer' || c.status === '기각' || !c.layerUnit) continue;
    if (judged.has(c.layerUnit)) doubled.push(c.layerUnit);
    else judged.set(c.layerUnit, c);
  }
  const units = keys.map((key, i) => {
    const j = judged.get(key) ?? null;
    return {
      key, kind: layerKind(key), order: i + 1, records: counts.get(key) ?? 0, judgment: j, spine: spine.has(key),
      grade: layerKind(key) === '메인' ? null : j?.obj?.grade ?? null, basis: j?.obj?.basis ?? null, status: j?.status ?? null,
    };
  });
  const byUnit = new Map(units.map((u) => [u.key, u]));
  // 이벤트 유실물은 이벤트의 층을 따르므로 이벤트부터
  const fill = (u) => {
    if (u.layer !== undefined) return u.layer;
    const ev = ERELIC_EVENT[u.key] ? byUnit.get(ERELIC_EVENT[u.key]) : null;
    u.ruleLayer = ruleLayer({ key: u.key, grade: u.grade, records: u.records, eventLayer: ev ? fill(ev) : null, spine: u.spine });
    const over = u.judgment?.obj?.layer;
    u.layer = LAYERS.includes(over) ? over : u.ruleLayer;
    return u.layer;
  };
  for (const u of units) fill(u);
  // 판정이 없는 단위 — 1회독 기록 파일이 있는(읽은) 메인 밖 단위만 센다
  const read = new Set(ds.files.map((f) => f.data?.unit).filter(Boolean));
  const missing = units.filter((u) => u.kind !== '메인' && !u.judgment && read.has(u.key)).map((u) => u.key);
  return { units, byUnit, missing, doubled };
}
