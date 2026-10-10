import test from 'node:test';
import assert from 'node:assert/strict';
import { formSteps, stripForm } from '../tools/views/portrait-forms.mjs';

test('바뀐 모습 — 챕터의 마지막 줄 코드로, 바뀌는 곳만 · _op는 같은 그림', () => {
  assert.equal(stripForm('rapi_op_l'), 'rapi');
  assert.equal(stripForm('rapi_red_op'), 'rapi_red');
  const mainScenes = [
    { unit: 'ch01', tick: 1, scenes: ['a'] },
    { unit: 'ch02', tick: 2, scenes: ['b', 'c'] },
    { unit: 'ch03', tick: 3, scenes: ['d'] },
    { unit: 'ch04', tick: 4, scenes: ['e'] },
  ];
  const L = (story_id, t, c) => ({ story_id, t, c });
  const lines = [
    L('a', 'p:라피', 'rapi'), L('a', 'p:아니스', 'anis'),
    L('b', 'p:라피', 'rapi_red'), L('c', 'p:라피', 'rapi_op'), // ch02 끝은 기본
    L('d', 'p:라피', 'rapi_red_op_r'),
    L('e', 'p:라피', 'rapi_x'), // 대응 없는 코드 = 기본
  ];
  const forms = { rapi_red: { icon: 'c016' } };
  const icons = { 'p:라피': 'c010', 'p:아니스': 'c012' };
  assert.deepEqual(formSteps({ lines, mainScenes, forms, icons }), [
    { target: 'p:라피', tick: 3, unit: 'ch03', code: 'rapi_red', icon: 'c016' },
    { target: 'p:라피', tick: 4, unit: 'ch04', code: 'rapi_x', icon: 'c010' },
  ]);
});
