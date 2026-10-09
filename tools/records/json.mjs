/**
 * JSON을 사람이 읽기 좋게 쓴다 — 짧은 배열 · 객체는 한 줄에, 길면 펼친다(prettier와 비슷한 모양).
 * 기록 파일 · people.json을 도구가 고쳐 쓸 때 손으로 쓴 모양과 가깝게 두어 diff를 작게 한다.
 */

/** 한 줄 폭 상한 — 이보다 길면 펼친다 */
export const WIDTH = 160;

function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  if (v && typeof v === 'object') {
    const e = Object.entries(v).filter(([, x]) => x !== undefined);
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(v);
}

/**
 * @param {unknown} v
 * @param {string} indent 지금 들여쓰기
 * @param {number} used 이 줄에서 값 앞에 이미 쓴 글자 수(들여쓰기 뺀 키 · 쉼표 몫)
 */
export function format(v, indent, used) {
  const one = inline(v);
  if (!v || typeof v !== 'object') return one;
  if ([...indent].length + used + [...one].length + 1 <= WIDTH) return one;
  const inner = `${indent}  `;
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[\n${v.map((x) => `${inner}${format(x, inner, 0)}`).join(',\n')}\n${indent}]`;
  }
  const e = Object.entries(v).filter(([, x]) => x !== undefined);
  if (!e.length) return '{}';
  return `{\n${e.map(([k, x]) => {
    const key = `${JSON.stringify(k)}: `;
    return `${inner}${key}${format(x, inner, [...key].length)}`;
  }).join(',\n')}\n${indent}}`;
}

/** 파일로 쓸 문자열 (끝에 줄바꿈) */
export const formatJson = (v) => `${format(v, '', 0)}\n`;
