/**
 * 탭 "떡밥" 데이터(W4) — W1에서는 빈 틀. W4가 채운다: 이 탭만 쓰는 JSON을 files에 넣는다(예 'threads.json').
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 * 공용 데이터(units · ticks · scenes · records · threads · targets)는 ctx.common에 이미 있다 — 다시 만들지 말고 가져다 쓴다.
 */
export const name = 'threads';

export async function run(ctx) {
  void ctx;
  return { files: {} };
}
