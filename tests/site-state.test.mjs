/**
 * 사이트 여기까지 읽음(state.js) — 메인 위치 t + 체크 칸(사이드 · 주요 이벤트 — units.json check) 예외 x로 스토리 · 기록을 가리는 규칙.
 * 브라우저 전역(location · history · localStorage)은 최소로 흉내 낸다.
 *
 *   node --test tests/site-state.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.location = { hash: '' };
globalThis.history = { replaceState: (_, __, h) => { location.hash = h; }, pushState: (_, __, h) => { location.hash = h; } };
globalThis.window = { addEventListener() {} };

const state = await import('../site/lib/state.js');
const fmt = await import('../site/lib/format.js');

// 메인 셋(10 · 20 · 30) · 주요 이벤트 둘(15 · 25)과 ev_a에 딸린 유실물 · 그 밖 이벤트 하나(18) · 사이드 하나(22)
const units = new Map([
  ['ch01', { key: 'ch01', kind: 'main', tick: 10 }],
  ['ch02', { key: 'ch02', kind: 'main', tick: 20 }],
  ['ch03', { key: 'ch03', kind: 'main', tick: 30 }],
  ['ev_a', { key: 'ev_a', kind: 'event', tick: 15, group: 'major', check: 1 }],
  ['ev_a_lost', { key: 'ev_a_lost', kind: 'erelic', tick: 15, group: 'major', check: 1, parent: 'ev_a' }],
  ['ev_b', { key: 'ev_b', kind: 'event', tick: 25, group: 'major', check: 1 }],
  ['ev_c', { key: 'ev_c', kind: 'event', tick: 18, group: 'event', spine: true, grade: '필수' }],
  ['semi', { key: 'semi', kind: 'side', tick: 22, group: 'side', check: 1 }],
]);
state.configure({ units });
state.init({ defaultCutoff: 10 });

test('예외가 없으면 출시 자리 규칙과 같다', () => {
  state.set({ t: 20 });
  const R = state.reading();
  for (const [k, u] of units) assert.equal(R.seen(k), u.tick <= 20, k);
  assert.deepEqual(state.checkExtras().map((e) => [e.key, e.group]), [['ev_a', 'major'], ['semi', 'side'], ['ev_b', 'major']], '딸린 유실물은 칸이 없다');
  assert.deepEqual([...units.keys()].filter(state.checkable), ['ev_a', 'ev_a_lost', 'ev_b', 'semi'], '척추 · 준필수라도 check가 없으면 체크 칸이 아니다(ev_c)');
});

test('사이드 · 주요 이벤트는 체크 칸 — 메인만 보고 뒤늦게 챙기는 사람(메인 끝까지 · 사이드 · 주요 이벤트 모두 안 봄), 유실물은 딸린 이벤트를 따른다', () => {
  state.set({ t: 30, x: { ev_a: false, ev_b: false, semi: false } });
  const R = state.reading();
  assert.deepEqual(['ch03', 'ev_a', 'ev_a_lost', 'ev_b', 'semi', 'ev_c'].map(R.seen), [true, false, false, false, false, true]);
  assert.equal(state.reading({ t: 10, x: { ev_a: true } }).seen('ev_a_lost'), true, '딸린 이벤트를 켜면 유실물도 봤음');
  assert.equal(state.get().x.semi, false, 'x에 남는다');
  state.set({ t: 20, x: {} });
});

test('체크 칸은 따로 고른다 — 앞의 것을 끄고 뒤의 것을 켠다', () => {
  state.set({ t: 20, x: { ev_a: false, ev_b: true } });
  const R = state.reading();
  assert.equal(R.seen('ev_a'), false);
  assert.equal(R.seen('ev_b'), true);
  assert.equal(R.seen('ev_c'), true); // 체크 칸이 아닌 이벤트는 메인 위치를 따른다
  assert.match(location.hash, /x=-ev_a,ev_b|x=-ev_a%2Cev_b/);
  // 기록: 사실은 know_units 중 하나라도 봤으면 안다
  assert.equal(R.known({ kind: 'F', unit: 'ev_a' }), false);
  assert.equal(R.known({ kind: 'F', unit: 'ev_a', know_units: ['ev_a', 'ch02'] }), true);
  assert.equal(R.known({ kind: 'E', unit: 'ev_b' }), true);
});

test('메인 위치를 옮기면 기본과 같아진 예외는 지운다', () => {
  state.set({ t: 30 }); // ev_b는 이제 기본으로 봤음 → 예외 지움, ev_a 끔은 남는다
  assert.deepEqual(state.get().x, { ev_a: false });
  state.set({ t: null }); // 전부 보기는 늘 본다
  assert.equal(state.reading().seen('ev_a'), true);
});

test('stateAt · gradeAt이 reading을 받는다', () => {
  state.set({ t: 20, x: { ev_a: false } });
  const R = state.reading();
  const q = { kind: 'Q', unit: 'ch01', first_tick: 10, solved_tick: 15, solved_units: ['ev_a'] };
  assert.equal(fmt.stateAt(q, 20), '풀림'); // 출시 자리로는 풀림
  assert.equal(fmt.stateAt(q, R), '열림'); // 답이 나온 ev_a를 안 봤다
  const f = { kind: 'F', unit: 'ev_a', first_tick: 15, know_units: ['ev_a', 'ch03'] };
  assert.equal(fmt.stateAt(f, R), '아직');
  assert.equal(fmt.gradeAt({ key: 'ev_a', tick: 15, grade: '보강' }, R), null);
  assert.equal(fmt.gradeAt({ key: 'ev_c', tick: 18, grade: '보강', from_tick: 30, before: '참고' }, R), '참고');
});

test('stateAt — 처음(know_units)을 모르면 뒤 단계도 모른다(W15f — 체크 칸에서 던진 의문이 메인에서 일부 회수)', () => {
  const q = { kind: 'Q', unit: 'side', first_tick: 2, partial_tick: 5, partial_units: ['ch05'] };
  const R = (seen) => ({ all: false, t: 9, seen: (k) => seen.includes(k), seenAny(ks) { return ks.some((k) => seen.includes(k)); } });
  assert.equal(fmt.stateAt(q, R(['ch05'])), '아직');
  assert.equal(fmt.stateAt(q, R(['side', 'ch05'])), '일부');
  assert.equal(fmt.stateAt({ ...q, hint_tick: 1, hint_units: ['ch01'] }, R(['ch01', 'ch05'])), '암시만');
});
