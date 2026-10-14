/**
 * 금서고 → 블라링크 단위 옮기기(tools/forbidden-library/convert.mjs) — 줄 맞춤 · 키 · 줄 번호 옮기기. 원문 없이 만든 계획으로.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { alignLines, rewriteText, remapBare } from '../tools/forbidden-library/convert.mjs';

test('줄 맞춤 — 문장부호 · 태그가 달라도 같은 줄, 끼어든 줄은 건너뛴다', () => {
  const { map } = alignLines(['흑··· 팔콘···!', '털썩-', '<b>임무</b> 종료다.'], ['흑… 팔콘…!', '고, 공주님…?', '털썩-', '임무 종료다.']);
  assert.deepEqual(map, [0, 2, 3]);
});

// 옛 씬 fl:x_00(3줄, 그대로) · fl:x_01(4줄, 1번부터 한 칸 밀림)
const plan = {
  unit: 'fl:x',
  key: 'event_x1',
  scenes: [
    { from: 'fl:x_00', to: 'event_x1_01_s', oldCount: 3, map: [0, 1, 2], moved: 0 },
    { from: 'fl:x_01', to: 'event_x1_01_e', oldCount: 4, map: [0, 2, 3, 4], moved: 3 },
  ],
};

test('키 · 씬 · 근거 줄 · 씬#줄을 옮긴다', () => {
  const src = '{ "unit": "fl:x", "evidence": [{ "scene": "fl:x_01", "lines": [0, "1-2"] }], "reason": "fl:x_01#1,2-3 · fl:x_00 · fl:xy" }';
  const { text } = rewriteText(src, plan);
  assert.equal(text, '{ "unit": "event_x1", "evidence": [{ "scene": "event_x1_01_e", "lines": [0, "2-3"] }], "reason": "event_x1_01_e#2,3-4 · event_x1_01_s · fl:xy" }');
});

test('그 단위 기록의 줄임 표기 · 씬 없이 쓴 #N', () => {
  const src = JSON.stringify({ unit: 'fl:x', facts: [{ evidence: [{ scene: 'fl:x_01', lines: [1] }], reason: '장면(01 #1-2), 회상(00) · 이어서(00–01) · #3' }] });
  const own = rewriteText(src, plan, { ownUnit: true }).text;
  const { text } = remapBare(own, plan);
  // #3은 바로 앞 씬(event_x1_01_e#…)의 옛 번호 → 4
  assert.equal(JSON.parse(text).facts[0].reason, '장면(event_x1_01_e#2-3), 회상(event_x1_01_s) · 이어서(event_x1_01_s–event_x1_01_e) · #4');
  const bare = remapBare(JSON.stringify({ unit: 'event_x1', facts: [{ evidence: [{ scene: 'event_x1_01_e', lines: [2] }], reason: '#1 대답' }] }), plan);
  assert.equal(JSON.parse(bare.text).facts[0].reason, '#2 대답'); // 앞 씬이 없으면 근거 씬 하나
});

test('범위 밖 줄은 멈춘다', () => {
  assert.throws(() => rewriteText('"fl:x_00#5"', plan), /범위 밖/);
});
