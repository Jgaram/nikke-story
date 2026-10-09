/**
 * 공개 레포에 원문이 길게 들어가지 않았는지 — CLAUDE.md "저작물 취급".
 *
 *   node --test
 *
 * 실패하면: 목록의 파일에서 인용을 40자 미만으로 줄이고 씬 ID · 줄 번호로 근거를 댄다.
 * 원문을 뽑은 파일이면 data/raw/(private 서브모듈)나 git 제외 경로로 옮긴다. 자세히는 `node tools/check-quotes.mjs`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { QUOTE_LIMIT, longestOverlaps, sourceWindows } from '../tools/check-quotes.mjs';

test(`커밋 대상 파일에 원문과 ${QUOTE_LIMIT}자 이상 겹치는 구간이 없다`, async () => {
  const db = await openDb();
  try {
    const over = longestOverlaps(sourceWindows(db)).filter((o) => o.length >= QUOTE_LIMIT);
    assert.deepEqual(over.map((o) => `${o.file} (${o.length}자)`), []);
  } finally {
    db.close();
  }
});
