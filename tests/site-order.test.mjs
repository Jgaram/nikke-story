/**
 * 사이트 탭 "읽기 순서"(W2) — 내보낸 order.json · order-detail.json의 모양, 탭의 등급 계산이 원천(tools/views/importance.mjs gradeAt)과 같은지.
 *
 *   node --test tests/site-order.test.mjs
 *
 * site/data/를 그대로 읽는다(내보내기를 다시 돌리지 않는다 — `node tools/site/export.mjs --only order` 뒤에 본다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeAt as siteGradeAt, cutRowAt, ghostKeys, guideOf, preRev } from '../site/tabs/order.js';
import * as siteState from '../site/lib/state.js';
import { gradeAt as toolGradeAt } from '../tools/views/importance.mjs';
import { gradeTrail } from '../tools/site/export/order.mjs';
import { readCsv } from '../tools/site/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const order = read('order.json');
const detail = read('order-detail.json');
const ticks = read('ticks.json');
const GRADES = ['필수', '보강', '참고', '독립'];

test('order.json — 판정 단위 · 척추 · 주역의 모양', () => {
  assert.equal(order.units.length, order.counts.judged);
  assert.equal(order.spine.length, order.counts.spine);
  assert.equal(order.leads.length, order.counts.leads);
  assert.equal(GRADES.reduce((n, g) => n + order.counts.grade[g], 0), order.units.length);
  const keys = new Set();
  for (const u of order.units) {
    assert.ok(GRADES.includes(u.grade), u.key);
    assert.ok(Number.isFinite(u.tick), u.key);
    assert.ok(!keys.has(u.key), `중복 ${u.key}`);
    keys.add(u.key);
    if (u.from_tick != null) assert.ok(u.before && GRADES.includes(u.before), `${u.key}: 오르는 단위는 앞 등급이 있다`);
    // 큰 칼럼은 order-detail.json으로 뺐다 — 첫 화면 파일에 남아 있으면 안 된다
    for (const k of ['history', 'reviews', 'basis_text']) assert.ok(!(k in u), `${u.key}: ${k}는 order-detail.json에 있다`);
  }
  for (let i = 1; i < order.spine.length; i++) assert.ok(order.spine[i].tick >= order.spine[i - 1].tick, '척추는 출시 시점순');
});

test('order-detail.json — 모든 키가 order.json에 있고 검토 기록의 메모 번호가 유효하다', () => {
  const keys = new Set(order.units.map((u) => u.key));
  for (const [key, d] of Object.entries(detail.units)) {
    assert.ok(keys.has(key), key);
    for (const r of d.reviews ?? []) if (r.note != null) assert.ok(detail.notes[r.note] != null, `${key} note ${r.note}`);
  }
});

test('탭의 gradeAt은 원천(importance.mjs gradeAt)과 모든 출시 시점에서 같다', () => {
  const rows = new Map(readCsv('data/views/importance/units.csv').map((r) => [r.unit, r]));
  let checked = 0;
  for (const u of order.units) {
    const row = rows.get(u.key);
    assert.ok(row, u.key);
    for (const t of ticks) {
      assert.equal(siteGradeAt(u, t.tick), toolGradeAt(row, t.tick), `${u.key} @${t.tick}`);
      checked++;
    }
    assert.equal(siteGradeAt(u, null), u.grade, '전부 보기는 최종 등급');
  }
  assert.ok(checked > 10000);
});

test('gradeTrail — 이력 문자열에서 등급이 바뀐 순서만 뽑는다', () => {
  assert.deepEqual(gradeTrail('B0b-2 독립 · X3c 그대로 → X3f-6a 참고'), ['독립', '참고']);
  assert.deepEqual(gradeTrail('B0b-2 독립 → X3b 보강 → X3f-6a 참고'), ['독립', '보강', '참고']);
  assert.equal(gradeTrail('B0b-2 참고 · X3c 그대로 · X3f-6a 그대로'), undefined);
  assert.equal(gradeTrail(''), undefined);
  assert.equal(gradeTrail(undefined), undefined);
  // order.json의 trail은 이력 문자열에서 온다 — 마지막 등급이 최종 등급과 같다
  for (const u of order.units) if (u.trail) assert.equal(u.trail.at(-1), u.grade, u.key);
});

test('prereqsOf — 앞 편은 필수 · 분류가 짚은 자리는 필수/권장 · 떡밥은 권장/선택, 메인 챕터 · 뒤 단위는 선행이 아니다, 척추 이벤트는 기댄 메인 챕터의 필수', async () => {
  const { prereqsOf } = await import('../tools/site/export/order.mjs');
  const units = new Map([
    ['ch01', { order: 1, kind: 'main' }], ['a', { order: 2, kind: 'sub' }], ['b', { order: 3, kind: 'sub' }],
    ['ev', { order: 4, kind: 'event', spine: true }], ['c', { order: 5, kind: 'event' }], ['ch02', { order: 6, kind: 'main' }],
  ]);
  const edges = [
    { from_unit: 'a', to_unit: 'b', type: 'sequel', strength: '3' },
    { from_unit: 'a', to_unit: 'c', type: 'setup_payoff', strength: '3' },
    { from_unit: 'b', to_unit: 'c', type: 'callback', strength: '3' },
    { from_unit: 'a', to_unit: 'c', type: 'callback', strength: '2' }, // 같은 짝은 높은 칸 하나
    { from_unit: 'ev', to_unit: 'c', type: 'setup_payoff', strength: '3' }, // 척추 이벤트도 같은 규칙(메인 챕터만 차례로 본다고 둔다)
    { from_unit: 'ch01', to_unit: 'c', type: 'setup_payoff', strength: '3' }, // 메인 챕터는 선행으로 세지 않는다
    { from_unit: 'ev', to_unit: 'ch02', type: 'callback', strength: '3' }, // 척추 이벤트가 기댄 첫 메인 챕터 → 필수(spine)
    { from_unit: 'c', to_unit: 'b', type: 'setup_payoff', strength: '3' }, // 뒤 단위는 선행이 아니다
    { from_unit: 'a', to_unit: 'ch02', type: 'setup_payoff', strength: '3' }, // 척추 X — 판정이 안 짚은 떡밥은 선택
    { from_unit: 'a', to_unit: 'c', type: 'keyword', strength: '2' },
  ];
  const judged = [{ key: 'c', grade: '보강', from: 'ch02' }, { key: 'b', grade: '필수', from: 'ch02' }];
  const pre = prereqsOf(edges, judged, units);
  assert.deepEqual(pre.b, { 필수: [['a', 'sequel']] });
  assert.deepEqual(pre.c, { 권장: [['a', 'setup_payoff'], ['ev', 'setup_payoff']], 선택: [['b', 'callback']] });
  assert.deepEqual(pre.ch02, { 필수: [['b', 'judged'], ['ev', 'spine']], 권장: [['c', 'judged']], 선택: [['a', 'setup_payoff']] });
});

test('order.json pre — 선행은 모두 앞 단위이고 메인 챕터가 아니다, 척추 이벤트 · 사이드는 기댄 메인 챕터의 필수', () => {
  const units = new Map(read('units.json').map((u) => [u.key, u]));
  for (const [x, row] of Object.entries(order.pre)) {
    for (const l of Object.keys(row)) {
      assert.ok(['필수', '권장', '선택'].includes(l), `${x} ${l}`);
      for (const [a] of row[l]) {
        assert.ok(units.get(a).order < units.get(x).order, `${a} → ${x}`);
        assert.ok(units.get(a).kind !== 'main', `${a} 메인 챕터`);
      }
    }
  }
  // 메인만 보는 사람도 안내받게(사용자, 2026-10-10) — CH.43은 ARK GUARDIAN에 기댄다
  const key = (t) => [...units.values()].find((u) => u.title === t).key;
  assert.ok(order.pre.ch43.필수.some(([a, w]) => a === key('ARK GUARDIAN') && w === 'spine'));
});

// 여기까지 읽음 판정 묶음(state.reading) — units.json으로 설정해 둔다(브라우저 밖에서도 configure · reading은 돈다)
const unitsJson = read('units.json');
siteState.configure({ units: new Map(unitsJson.map((u) => [u.key, u])) });
const extrasJson = unitsJson.filter((u) => u.spine && u.kind !== 'main');

test('예외가 없으면 gradeAt(u, R) · R.seen은 출시 시점 규칙(gradeAt(u, t) · tick ≤ t)과 같다', () => {
  for (const t of ticks) {
    const R = siteState.reading({ t: t.tick, x: {} });
    for (const u of order.units) assert.equal(siteGradeAt(u, R), siteGradeAt(u, t.tick), `${u.key} @${t.tick}`);
    for (const u of unitsJson) if (u.tick != null) assert.equal(R.seen(u.key), u.tick <= t.tick, `${u.key} @${t.tick}`);
  }
  const all = siteState.reading({ t: null, x: {} });
  for (const u of order.units) assert.equal(siteGradeAt(u, all), u.grade);
});

test('cutRowAt — 예외가 없으면 tick ≤ cut인 마지막 척추 줄, 안 봄으로 둔 끝 척추 이벤트는 구분 줄 아래로', () => {
  const units = new Map(unitsJson.map((u) => [u.key, u]));
  // 감상 순서처럼: 척추 전부 + 판정 단위 몇 개, 읽는 자리 순서
  const seq = [...order.spine.map((s) => ({ ...s, spine: true })), ...order.units.slice(0, 40)]
    .map((x) => ({ ...x, unit: units.get(x.key) })).sort((a, b) => a.unit.order - b.unit.order || a.tick - b.tick);
  const old = (cut) => { let at = -1; seq.forEach((x, i) => { if (x.spine && x.tick <= cut) at = i; }); return at; };
  for (const t of ticks) assert.equal(cutRowAt(seq, t.tick, siteState.reading({ t: t.tick, x: {} })), old(t.tick), `@${t.tick}`);
  assert.equal(cutRowAt(seq, null, siteState.reading({ t: null, x: {} })), -1);
  // 척추 이벤트 바로 뒤에 t를 두고 그것을 안 봄으로 — 구분 줄이 그 앞 척추 줄로 올라간다
  const ev = extrasJson.find((e) => seq.some((x, i) => x.key === e.key && i > 0));
  const i = seq.findIndex((x) => x.key === ev.key);
  const t = ev.tick;
  const atDefault = cutRowAt(seq, t, siteState.reading({ t, x: {} }));
  const atUnseen = cutRowAt(seq, t, siteState.reading({ t, x: { [ev.key]: false } }));
  assert.equal(atDefault, i, '기본은 그 이벤트 줄 아래');
  assert.ok(atUnseen < i, '안 봄이면 그 줄 위');
  // 뒤에 나왔지만 봤음으로 둔 것은 자리를 옮기지 않는다
  const later = extrasJson.find((e) => e.tick > t);
  if (later) assert.equal(cutRowAt(seq, t, siteState.reading({ t, x: { [later.key]: true } })), atDefault);
});

test('ghostKeys — 기본 필터(필수 · 준필수 · 추천, 유실물 뺌)에서 등급으로만 숨은 앞 편을 앞 편의 앞 편까지 끼운다', () => {
  const units = new Map(unitsJson.map((u) => [u.key, u]));
  const judged = new Map(order.units.map((j) => [j.key, j]));
  const kinds = ['main', 'side', 'event', 'episode', 'sub', 'elevator'];
  const shown = [...order.spine.filter((s) => kinds.includes(units.get(s.key).kind)).map((s) => s.key),
    ...order.units.filter((j) => ['필수', '보강'].includes(j.grade) && kinds.includes(units.get(j.key).kind)).map((j) => j.key)];
  const pass = (k) => judged.has(k) && kinds.includes(units.get(k).kind);
  const ghosts = ghostKeys(shown, order.pre, pass);
  const title = (k) => units.get(k).title;
  const pairs = new Set([...ghosts].map(([a, by]) => `${title(by)} ← ${title(a)}`));
  // 이야기가 끊기던 넷(SESSIONS W13b) — 랩칠리언 6 ← 5는 5 ← 4 ← 3 ← 2까지 거슬러 간다
  for (const p of ['랩칠리언 6 ← 랩칠리언 5', '세르반 2 ← 세르반 1', '세르반 4 ← 세르반 3', 'BITTER SPICE ← B-SIDE IDOL', '랩칠리언 3 ← 랩칠리언 2']) assert.ok(pairs.has(p), p);
  for (const [a, by] of ghosts) {
    assert.ok(!shown.includes(a), `${a}: 이미 보이는 줄`);
    assert.ok(['참고', '독립'].includes(judged.get(a).grade), `${a}: 등급 필터 밖`);
    assert.ok(order.pre[by].필수.some(([k, w]) => k === a && w === 'sequel'), `${a}: ${by}의 앞 편`);
    assert.ok(units.get(a).order < units.get(by).order, `${a}: 앞에 온다`);
  }
  // 종류로 숨은 것은 끼우지 않는다
  assert.equal(ghostKeys(shown, order.pre, (k) => pass(k) && units.get(k).kind !== 'sub').size < ghosts.size, true);
  assert.equal(ghostKeys([], order.pre, pass).size, 0);
  // 메인만(등급 칩 모두 끔): 준필수(CH.48 ← SECOND AFFECTION)처럼 판정으로 기대는 것은 끼우지 않는다 — '먼저 볼 것'이 말한다
  const mains = order.spine.filter((s) => units.get(s.key).kind === 'main').map((s) => s.key);
  assert.equal(ghostKeys(mains, order.pre, pass).size, 0);
});

test('guideOf — 먼저 볼 것 = 판정 자리가 앞인 척추 + 필수 선행, 기한 = 뒤의 필수 · 권장 선행(척추 먼저), 선택 선행은 둘 다 아니다', () => {
  const units = new Map([['ch01', { order: 1 }], ['a', { order: 2 }], ['b', { order: 3 }], ['ch02', { order: 4 }], ['c', { order: 5 }], ['ch03', { order: 6 }]]);
  const spine = new Set(['ch01', 'ch02', 'ch03']);
  const pre = { b: { 필수: [['a', 'sequel']], 권장: [['ch01', 'judged']] }, ch03: { 권장: [['a', 'setup_payoff']] }, ch02: { 선택: [['b', 'callback']] }, c: { 선택: [['b', 'callback']] } };
  const judged = new Map([['a', { grade: '참고' }], ['b', { grade: '보강', from: 'ch01' }], ['c', { grade: '보강', from: 'ch03' }]]);
  const ctx = { units, spine, pre, rev: preRev(pre), judged };
  assert.deepEqual(guideOf('a', ctx), { must: [], due: { key: 'ch03', level: '권장' } }, '뒤 편(b)보다 척추 기한이 먼저');
  assert.deepEqual(guideOf('b', ctx), { must: ['ch01', 'a'], due: null }, '판정 자리(앞) + 앞 편, 권장은 넣지 않는다 · 선택 선행(ch02 · c)은 기한이 아니다');
  assert.deepEqual(guideOf('c', ctx).due, { key: 'ch03', level: '권장' }, '판정 자리가 뒤면 기한(추천 = 권장)');
  assert.deepEqual(guideOf('a', { ...ctx, pre: { b: pre.b }, rev: preRev({ b: pre.b }) }).due, { key: 'b', level: '필수' }, '척추 기한이 없으면 메인 밖 뒤 편');
});

test('guideOf — 실제 데이터: 짚었던 줄(B-SIDE IDOL · 길로틴 · 랩칠리언 1)과 모든 판정 단위의 모양', () => {
  const units = new Map(unitsJson.map((u) => [u.key, u]));
  const ctx = { units, spine: new Set(order.spine.map((s) => s.key)), pre: order.pre, rev: preRev(order.pre), judged: new Map(order.units.map((j) => [j.key, j])) };
  const byTitle = (t) => unitsJson.find((u) => u.title === t).key;
  assert.equal(guideOf('fl:b-side_idol', ctx).due?.key, 'fl:bitter_spice', 'B-SIDE IDOL은 BITTER SPICE 전까지(앞 편)');
  assert.deepEqual(guideOf('fl:bitter_spice', ctx).must, ['event_staranis1', 'fl:b-side_idol'], 'BITTER SPICE는 STAR ANIS(판정 자리) · B-SIDE IDOL(앞 편) 먼저');
  assert.ok(guideOf(byTitle('길로틴'), ctx).must.includes('ch12'), '길로틴은 CH.12 먼저');
  assert.equal(guideOf(byTitle('랩칠리언 1'), ctx).due?.key, 'ch27', '랩칠리언 1은 CH.27 전까지');
  // 메인 챕터도 같은 기준(필수 선행만) — CH.48은 SECOND AFFECTION(준필수), CH.27의 추천(권장 선행)은 먼저 볼 것이 아니다
  assert.deepEqual(guideOf('ch48', ctx).must, [byTitle('SECOND AFFECTION')]);
  assert.deepEqual(guideOf('ch27', ctx).must, []);
  assert.equal(guideOf(byTitle('ARK GUARDIAN'), ctx).due?.key, 'ch43', '척추 이벤트도 기한 — ARK GUARDIAN은 CH.43 전까지');
  for (const j of order.units) {
    const g = guideOf(j.key, ctx);
    const pos = units.get(j.key).order;
    if (g.due) assert.ok(units.get(g.due.key).order > pos, `${j.key}: 기한은 뒤`);
    for (const k of g.must) assert.ok(units.get(k).order < pos, `${j.key}: 먼저 볼 것 ${k}는 앞`);
    // 판정 자리가 뒤면('CH.27 전까지') 그대로 기한이거나 더 앞선 척추 기한
    if (j.from && ctx.spine.has(j.from) && units.get(j.from).order > pos) assert.ok(g.due && units.get(g.due.key).order <= units.get(j.from).order, `${j.key}: 판정 자리 기한`);
  }
});

test('탭 소스(감상 순서 · 연대기): 스토리를 숨기거나 등급을 정할 때 출시 시점(visible · 숫자 T)을 쓰지 않는다', () => {
  for (const f of ['site/tabs/order.js', 'site/tabs/chrono.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/state\.visible\(/.test(src), `${f}: state.visible`);
    assert.ok(!/(gradeAt|stateAt)\([^)]*,\s*(T|s\.t|curT)\)/.test(src), `${f}: 숫자 T로 등급 · 상태`);
    assert.ok(/state\.reading\(/.test(src), `${f}: state.reading을 쓴다`);
  }
});
