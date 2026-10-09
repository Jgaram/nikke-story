/**
 * 공지 속 한국어 날짜 읽기. nikke-analysis util/kdate.py를 옮겼다.
 *
 * 날짜는 모두 KST 달력 날짜로 다룬다(시각은 순서를 가르는 데만 쓴다).
 * 연도 없는 날짜(`9월 3일`, `9/3`)는 기준일에서 가장 가까운 해로 본다.
 * 점·대시 날짜는 연도가 있을 때만 날짜로 본다 — `1.1` 같은 절 번호를 1월 1일로 읽지 않으려고.
 */

const WEEKDAY = String.raw`(?:\s*[(（]\s*[월화수목금토일]\s*[)）])?`;
const TIME = (p) => String.raw`(?:\s*(?<${p}H>\d{1,2})\s*[:：]\s*(?<${p}M>\d{2})(?:\s*[:：]\s*(?<${p}S>\d{2}))?)?`;
const MAINT = (p) =>
  String.raw`(?<${p}maint>\s*(?:서버\s*)?(?:점검|업데이트)\s*(?:종료|완료)?\s*(?:이후|후)|\s*서버\s*오픈\s*(?:이후|후))?`;

function datePattern(p) {
  return (
    String.raw`(?:(?<${p}y>20\d{2})\s*(?:년\s*(?<${p}m1>\d{1,2})\s*월\s*(?<${p}d1>\d{1,2})\s*일?` +
    String.raw`|[./-]\s*(?<${p}m2>\d{1,2})\s*[./-]\s*(?<${p}d2>\d{1,2})\s*일?)` +
    String.raw`|(?<${p}m3>\d{1,2})\s*(?:월\s*(?<${p}d3>\d{1,2})\s*일|/\s*(?<${p}d4>\d{1,2})\s*일?))` +
    WEEKDAY +
    TIME(p) +
    MAINT(p)
  );
}

const POINT_RE = new RegExp(datePattern('a'), 'g');
const RANGE_RE = new RegExp(
  datePattern('a') +
    String.raw`\s*(?:\(UTC\+9\)|（UTC\+9）)?\s*[~～〜]\s*` +
    String.raw`(?:(?<openEnd>추후\s*(?:안내|공지)|미정)|(?:` +
    datePattern('b') +
    String.raw`)|(?<tH>\d{1,2})\s*[:：]\s*(?<tM>\d{2})(?:\s*[:：]\s*(?<tS>\d{2}))?)`,
  'g',
);

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function validDay(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** KST 기준 날짜 문자열(YYYY-MM-DD). */
export function kstDay(date) {
  return new Date(date.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function pickYear(m, d, refDay) {
  const ref = Date.parse(refDay);
  const y0 = Number(refDay.slice(0, 4));
  let best = y0;
  let gap = Infinity;
  for (const y of [y0 - 1, y0, y0 + 1]) {
    if (!validDay(y, m, d)) continue;
    const g = Math.abs(Date.parse(isoDay(y, m, d)) - ref);
    if (g < gap) [best, gap] = [y, g];
  }
  return best;
}

/**
 * 날짜 하나. { day: 'YYYY-MM-DD', time: 'HH:MM:SS' | null, afterMaintenance: bool }
 * 시각이 없고 점검 뒤면 time은 null이다(점검이 끝나는 시각은 공지에 없다).
 */
function stampOf(g, p, refDay) {
  const m = Number(g[`${p}m1`] ?? g[`${p}m2`] ?? g[`${p}m3`]);
  const d = Number(g[`${p}d1`] ?? g[`${p}d2`] ?? g[`${p}d3`] ?? g[`${p}d4`]);
  if (!m || !d) return null;
  const y = g[`${p}y`] ? Number(g[`${p}y`]) : pickYear(m, d, refDay);
  if (!validDay(y, m, d)) return null;
  const h = g[`${p}H`];
  const time = h != null ? `${pad(Number(h))}:${g[`${p}M`]}:${g[`${p}S`] ?? '00'}` : null;
  return { day: isoDay(y, m, d), time, afterMaintenance: Boolean(g[`${p}maint`]) };
}

/** 글 속 `시작 ~ 끝` 구간들의 시작. 끝이 없는 구간(`~ 추후 안내`)도 센다. */
export function findSpanStarts(text, refDay) {
  const out = [];
  for (const m of text.matchAll(RANGE_RE)) {
    const s = stampOf(m.groups, 'a', refDay);
    if (s) out.push(s);
  }
  return out;
}

/** 글 속 날짜 전부(구간은 시작으로). */
export function findPoints(text, refDay) {
  const out = [];
  for (const m of text.matchAll(POINT_RE)) {
    const s = stampOf(m.groups, 'a', refDay);
    if (s) out.push(s);
  }
  return out;
}

/** 순서 비교용 키: 같은 날이면 시각 없는(점검 직후) 것이 앞이다. */
export const stampKey = (s) => `${s.day}T${s.time ?? '00:00:00'}`;
