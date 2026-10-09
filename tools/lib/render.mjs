/**
 * 대사 한 줄을 읽기 표기로 바꾼다 — tools/read.mjs와 tools/records.mjs(리뷰 도구)가 같이 쓴다.
 * 표기는 CLAUDE.md "원문 읽기"와 같다. 줄 번호 `#N`은 DB `lines.seq`(씬 안 0부터)다.
 */

export const oneLine = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

export const LEGEND =
  '표기: `이름: 대사`(이름표 = 말한 인물) · `지휘관:` 플레이어 대사 · `(독백)` 지휘관 1인칭 서술 · ' +
  '`* ` 3인칭 서술·효과음 · `▷` 선택지 · `→#N` 같은 씬 N번 줄로 이동(선택지는 그 응답, 그 밖은 분기 끝 → 합류) · ' +
  '`#N` 이동 도착 줄';

/** --num일 때 LEGEND 끝에 붙는다 */
export const NUM_LEGEND = '줄 앞 `#N` = 줄 번호(DB lines.seq, 씬 안 0부터) — 기록의 근거 줄은 이 번호로 쓴다';

export const LIBRARY_LEGEND =
  '금서고 원문: `~ ` 서술·독백 구분 없음 · `> ` 문서(유실물) · `✉` 메신저(`✉──` 대화방 시작) · ' +
  '`⇒` 고른 선택지에 따라 이어지는 씬 · `[연출]` 연출 명령 줄 · 씬 키는 금서고 파일 안 순서다(게임 씬 ID가 아니다)';

/** 이동(jump_to)이 도착하는 줄 번호들 — 그 줄 앞에 `#N`을 붙인다 */
export const jumpTargets = (ls) => new Set(ls.filter((l) => l.jump_to !== null).map((l) => l.jump_to));

/**
 * @param {{seq:number, speaker_id?:string|null, speaker_name?:string|null, text?:string|null, window?:string|null, jump_to?:number|null}} l
 * @param {Set<number>} targets 이동 도착 줄 (jumpTargets)
 * @param {{ jumps?: boolean, num?: boolean }} [opts] jumps: 이동 표시(`→#N` · 도착 `#N`), num: 모든 줄 앞에 `#N`
 * @returns {string|null} 본문이 없는 줄은 null (이동 도착 줄이거나 num이면 `#N ⋯`)
 */
export function renderLine(l, targets, { jumps = true, num = false } = {}) {
  if (l.window === 'Document') {
    // 유실물 본문은 들여쓰기(댓글 줄 `ㄴ` 등)를 살린다
    const doc = (l.text ?? '').replace(/\s*\n\s*/g, ' ').replace(/\s+$/, '');
    if (!doc.trim()) return num ? `#${l.seq} ⋯` : null;
    return `${num ? `#${l.seq} ` : ''}> ${doc}`;
  }
  const text = oneLine(l.text);
  const anchor = num || (jumps && targets.has(l.seq)) ? `#${l.seq} ` : '';
  if (!text) return anchor ? `${anchor}⋯` : null;
  const name = l.speaker_name ?? l.speaker_id;
  let body;
  switch (l.window) {
    case 'Self':
      body = `${name ?? '지휘관'}: ${text}`;
      break;
    case 'Monologue':
      body = name ? `${name}(독백): ${text}` : `(독백) ${text}`;
      break;
    case 'Narration':
      body = name ? `* ${name}: ${text}` : `* ${text}`;
      break;
    case 'Choice':
      body = `▷ ${text}`;
      break;
    case 'Input':
      body = `▷(입력) ${text}`;
      break;
    case 'Unknown':
      body = `~ ${text}`;
      break;
    case 'Messenger':
      body = `✉ ${name ?? '?'}: ${text}`;
      break;
    case 'MessengerSelf':
      body = `✉ 지휘관: ${text}`;
      break;
    case 'MessengerStart':
      body = `✉── ${text}`;
      break;
    case 'Route':
      body = `⇒ ${text}`;
      break;
    case 'Action':
      body = `[연출] ${text}`;
      break;
    default:
      body = name ? `${name}: ${text}` : text;
  }
  const jump = jumps && l.jump_to !== null && l.jump_to !== undefined ? ` →#${l.jump_to}` : '';
  return anchor + body + jump;
}
