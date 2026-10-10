/**
 * 원문 서브모듈(data/raw/)이 있는가 — 없으면 DB를 쓰는 테스트가 모두 실패한다. 그 실패들의 까닭을 한 줄로 먼저 보인다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAW_MISSING, rawReady } from '../tools/normalize/ensure-db.mjs';

test('원문 서브모듈(data/raw/)을 받아 두었다', () => {
  assert.ok(rawReady(), RAW_MISSING);
});
