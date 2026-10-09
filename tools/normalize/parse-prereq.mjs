/**
 * 시트 `추천 선행 스토리` 칼럼 파서.
 *
 * 문법과 범례 의미는 docs/schema.md 참고. 요약:
 *   ◆◆◆ A / B ◆◆ C ◆ D      →  A,B는 강도3 / C는 2 / D는 1
 *   X                         →  선행 없음
 *   ?                         →  미검토
 *
 * 범례 문장은 legend.json으로 제외한다. 걸러내지 않으면
 * '무조건 선행으로 봐야 함'이라는 스토리가 생긴다.
 */
import fs from 'node:fs';

const LEGEND = JSON.parse(
  fs.readFileSync(new URL('./legend.json', import.meta.url), 'utf8'),
).excludeExact.map((s) => s.trim());

/** 같은 등급 안에서 항목을 나누는 구분자 */
const SPLIT = /\s*(?:\/|또는)\s*/;

/**
 * @returns {{ items: {title: string, strength: number}[], noPrereq: boolean,
 *             unreviewed: boolean, notes: string[], isLegend: boolean }}
 */
export function parsePrereq(raw) {
  const text = (raw ?? '').trim();
  const empty = { items: [], noPrereq: false, unreviewed: false, notes: [], isLegend: false };

  if (!text) return empty;
  if (LEGEND.includes(text)) return { ...empty, isLegend: true };

  const items = [];
  const notes = [];
  let unreviewed = false;

  // ◆ 묶음으로 자른다. 첫 조각은 ◆ 앞에 붙은 텍스트(X, ? 등)다.
  const parts = text.split(/(◆+)/).filter((s) => s !== '');
  let head = parts[0]?.startsWith('◆') ? '' : (parts.shift() ?? '');

  head = head.trim();
  if (head) {
    // `X`, `X 목단`, `? 내가 아직...` 처럼 기호 + 자유 메모가 온다
    const noPrereq = /^X\b/i.test(head);
    if (/^\?/.test(head)) unreviewed = true;
    const rest = head.replace(/^[X?]\s*/i, '').trim();
    if (rest) notes.push(rest);
    if (noPrereq && parts.length === 0) {
      return { items: [], noPrereq: true, unreviewed, notes, isLegend: false };
    }
  }

  for (let i = 0; i < parts.length; i += 2) {
    const marks = parts[i];
    if (!marks?.startsWith('◆')) continue;
    const strength = Math.min(marks.length, 3);
    const body = (parts[i + 1] ?? '').trim();
    for (const piece of body.split(SPLIT)) {
      const title = piece.trim().replace(/[,·]+$/, '');
      if (title) items.push({ title, strength });
    }
  }

  return { items, noPrereq: items.length === 0 && /^X\b/i.test(head), unreviewed, notes, isLegend: false };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cases = [
    '◆◆◆ ARK GUARDIAN ◆◆ CHAPTER.42 유일 / FOOTSTEP, WALK, RUN ◆ COIN IN RUSH / CHAPTER.44 행보',
    '◆◆◆WORDLESS / OLD TALES / CHAPTER.34 계승 ◆◆ MUDFISH / CHAPTER.36 배신 ◆ WISDOM SPRING',
    'X',
    'X 목단',
    '◆◆ CHAPTER.07 재회 ◆ 맥스웰',
    '◆◆◆ 무조건 선행으로 봐야 함.',
    '◆ 이전 콜라보 스토리 중 아무거나 / CHAPTER.10 동료',
    '',
  ];
  for (const c of cases) {
    const r = parsePrereq(c);
    console.log(`\n입력: ${c || '(빈 값)'}`);
    console.log(
      '  →',
      r.isLegend ? '범례 (제외)' : r.noPrereq ? '선행 없음' : r.items.map((i) => `${'◆'.repeat(i.strength)}${i.title}`).join(' | ') || '(항목 없음)',
      r.notes.length ? `/ 메모: ${r.notes.join('; ')}` : '',
      r.unreviewed ? '/ 미검토' : '',
    );
  }
}
