/**
 * N2d — 늦게 들어온 단위의 출시 자리(tools/records/order.mjs placeLate · tools/update/late.mjs lateAnchors).
 * docs/update.md "늦게 들어온 단위".
 *
 *   node --test tests/late.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { READ1_PREFIXES, parseLateAnchors, parseOrder, placeLate } from '../tools/records/order.mjs';
import { anchorProblems, lateAnchors, unitRanks } from '../tools/update/late.mjs';

const ORDER = [
  '- [x] **R98** `fl:a` · `char:1` — 9만 자 · 2파트 · 2026-08-13',
  '- [x] **R99** `fl:b` · `char:2` `char:3` `char:4` — 9만 자 · 4파트 · 2026-09-03~2026-09-24',
];
const PATCHES = [
  { day: '2026-08-13', units: [{ kind: 'event', key: 'fl:a' }, { kind: 'episode', key: 'char:1' }] },
  { day: '2026-09-03', units: [{ kind: 'event', key: 'fl:b' }, { kind: 'episode', key: 'char:2' }] },
  { day: '2026-09-17', units: [{ kind: 'event', key: 'held:fl:late' }, { kind: 'episode', key: 'char:3' }, { kind: 'episode', key: 'char:4' }] },
  { day: '2026-10-08', units: [{ kind: 'episode', key: 'char:5' }] },
];
const ranks = unitRanks(PATCHES);
const keysOf = (text) => placeLate(parseOrder(text, READ1_PREFIXES), parseLateAnchors(text)).items.map((it) => it.key);

test('자리 키 앞으로 끼운다 — 항목 줄은 끝에 그대로, 출시순 한 줄에서만', () => {
  const text = [...ORDER, '- [ ] **U01** `fl:late` — 패치 2026-09-17 · 자리 `char:3` 앞 · 2만 자 · 2파트'].join('\n');
  assert.deepEqual(keysOf(text), ['fl:a', 'char:1', 'fl:b', 'char:2', 'fl:late', 'char:3', 'char:4']);
  assert.deepEqual(parseOrder(text, READ1_PREFIXES).items.map((it) => it.key).at(-1), 'fl:late');
  const idx = placeLate(parseOrder(text, READ1_PREFIXES), parseLateAnchors(text)).items.map((it) => it.index);
  assert.deepEqual(idx, [0, 1, 2, 3, 4, 5, 6]);
});

test('자리 없는 U 항목 · 없는 자리 키는 그대로 끝에', () => {
  assert.equal(keysOf([...ORDER, '- [ ] **U01** `char:5` — 패치 2026-10-08 · 1만 자'].join('\n')).at(-1), 'char:5');
  assert.equal(keysOf([...ORDER, '- [ ] **U01** `fl:late` — 패치 2026-09-17 · 자리 `char:9` 앞'].join('\n')).at(-1), 'fl:late');
});

test('써야 할 자리 — 출시가 늦은 첫 단위(같은 패치 안 차례까지), 늦지 않으면 없음', () => {
  const late = lateAnchors([...ORDER, '- [ ] **U01** `fl:late` — 패치 2026-09-17 · 2만 자'].join('\n'), ranks, new Map());
  assert.deepEqual(late.map((r) => [r.session, r.expected, r.written]), [['U01', 'char:3', null]]);
  assert.equal(anchorProblems(late).length, 1);
  const ok = lateAnchors([...ORDER, '- [ ] **U01** `fl:late` — 패치 2026-09-17 · 자리 `char:3` 앞 · 2만 자'].join('\n'), ranks, new Map());
  assert.deepEqual(anchorProblems(ok), []);
  const normal = lateAnchors([...ORDER, '- [ ] **U01** `char:5` — 패치 2026-10-08 · 자리 `char:4` 앞'].join('\n'), ranks, new Map());
  assert.equal(normal[0].expected, null);
  assert.match(anchorProblems(normal)[0], /늦게 들어온 단위가 아니다/);
});

test('보류 중 뒤 패치를 먼저 한 뒤 들어온 단위 — 앞 U 항목 앞에, 같은 패치의 U 항목끼리는 서로 늦지 않다', () => {
  const text = [...ORDER,
    '- [x] **U01** `char:5` — 패치 2026-10-08 · 1만 자',
    '- [ ] **U02** `fl:late` — 패치 2026-09-17 · 자리 `char:3` 앞 · 2만 자'].join('\n');
  const rows = lateAnchors(text, ranks, new Map());
  assert.deepEqual(rows.map((r) => [r.session, r.expected]), [['U01', null], ['U02', 'char:3']]);
  const split = [...ORDER.map((l) => l.replace(' `char:3` `char:4`', '')),
    '- [ ] **U01** `fl:late` `char:3` — 패치 2026-09-17 · 2만 자',
    '- [ ] **U02** `char:4` — 패치 2026-09-17 · 1만 자'].join('\n');
  assert.deepEqual(lateAnchors(split, ranks, new Map()).map((r) => r.expected), [null, null]);
});
