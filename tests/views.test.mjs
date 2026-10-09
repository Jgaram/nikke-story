/**
 * B0a 시안(tools/views/) — 1회독 기록에서 엣지 · 단위별 · 의문별 · 대상별 표를 뽑는다. C1 — 2회독 기록을 얹은 시안.
 * 예시 기록(tests/fixtures/read1 · read2)으로 규칙을, 실제 기록으로 문제가 없는지를 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, loadDataset } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { buildRead1Views } from '../tools/views/read1.mjs';
import { buildRead2Views } from '../tools/views/read2.mjs';
import { renderRead2Report, renderReport, toCsv } from '../tools/views/draft.mjs';

const db = await openDb();
const ctx = await openContext(db);
const order = loadOrder();
test.after(() => db.close());

test('예시 — 사건 하나에 엣지 하나, 기각 뺌, 후보는 표시, 같은 단위 안 사건은 단위 그래프에서 뺀다', () => {
  const v = buildRead1Views(loadDataset({ dir: EXAMPLE_DIR }), ctx, order);
  assert.deepEqual(v.problems, []);
  // F2-2(뒤집음)는 기각 — 엣지가 없다
  assert.deepEqual(v.sceneEdges.map((e) => `${e.record} ${e.type} ${e.from_scene}>${e.to_scene}`), [
    'Q1-2 setup_payoff sub:로망티스트_00>sub:로망티스트_01',
    'Q2-2 setup_payoff sub:로망티스트_01>sub:로망티스트_01',
    'Q3-2 setup_payoff d_ex_elevator_01>d_ex_elevator_01',
  ]);
  assert.equal(v.unitEdges.length, 1);
  const [ue] = v.unitEdges;
  assert.equal(`${ue.from_unit}>${ue.to_unit} ${ue.type} ${ue.count} ${ue.unconfirmed}`, 'sub:로망티스트_00>sub:로망티스트_01 setup_payoff 1 1');
  assert.ok(ue.from_order < ue.to_order, '엣지 방향 = 읽는 순서');
  assert.equal(v.gaps.internalEdges, 2);
  // 의문 상태: 전부 회수 → 풀림, 일부 → 일부
  assert.deepEqual(v.questions.map((q) => `${q.id} ${q.state}`), ['Q1 풀림', 'Q2 풀림', 'Q3 일부', 'Q4 열림']);
  const unit = (k) => v.units.find((u) => u.unit === k);
  assert.equal(unit('sub:로망티스트_00').out_units, 1);
  assert.equal(unit('sub:로망티스트_01').in_units, 1);
  assert.equal(unit('sub:로망티스트_01').payoffs, 2);
  assert.equal(unit('sub:로망티스트_01').reversals, 0, '기각된 뒤집음은 세지 않는다');
  const rom = v.targets.find((t) => t.target === 'person:로망티스트');
  assert.equal(`${rom.facts} ${rom.units} ${rom.first_unit} ${rom.introduced_in}`, '2 2 sub:로망티스트_00 sub:로망티스트_00');
  // 같은 기록이면 같은 결과
  const again = buildRead1Views(loadDataset({ dir: EXAMPLE_DIR }), ctx, order);
  assert.equal(renderReport(again, { source: 'x' }), renderReport(v, { source: 'x' }));
  assert.equal(toCsv(again.units, Object.keys(again.units[0])), toCsv(v.units, Object.keys(v.units[0])));
});

test('실제 기록 — 문제 없음, 엣지는 읽는 순서로만 간다, 사건 수 = 엣지 수', () => {
  const ds = loadDataset();
  const v = buildRead1Views(ds, ctx, order);
  assert.deepEqual(v.problems, []);
  assert.deepEqual(v.gaps.strayUnits, []);
  assert.deepEqual(v.gaps.unitsWithoutFile, []);
  const events = ds.candidates.filter((c) => c.role === 'event' && c.status !== '기각');
  assert.equal(v.sceneEdges.length, events.length);
  assert.ok(v.unitEdges.every((e) => e.from_order < e.to_order));
  assert.equal(new Set(v.units.map((u) => u.unit)).size, v.units.length);
  // 메인과 이어진 기록 — 메인은 채점하지 않아 비우고, 메인 밖 단위의 in · out 합 = 메인을 넘나드는 엣지 수
  const isMain = (u) => /^ch\d/.test(u);
  assert.ok(v.units.filter((u) => u.kind === '메인').every((u) => u.main_in === '' && u.main_out === ''));
  const crossing = v.sceneEdges.filter((e) => isMain(e.from_unit) !== isMain(e.to_unit)).length;
  assert.equal(v.units.reduce((a, u) => a + (Number(u.main_in) || 0) + (Number(u.main_out) || 0), 0), crossing);
});

test('2회독을 얹은 시안 (C1) — 예시: 단위 엣지는 1회독 · 2회독을 따로 세고, 세션 · 인물 · 바로잡기가 기계적으로 나온다', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const v1 = buildRead1Views(ds, ctx, order);
  const v = buildRead2Views(ds, ctx, order, v1);
  assert.deepEqual(v.problems, []);
  const t = v.totals;
  assert.equal(`${t.mentions} ${t.hints} ${t.callbacks} ${t.baselines} ${t.changes} ${t.life} ${t.fixesAdded} ${t.read2Units}`, '1 2 1 1 3 1 1 3');
  // E1은 같은 단위 안(엘리베이터)이라 단위 그래프에서 빠지고, E2 · E3이 1회독 엣지 옆에 붙는다
  assert.deepEqual(v.unitEdges.map((e) => `${e.from_unit}>${e.to_unit} ${e.type} ${e.read1} ${e.read2}`), [
    'sub:로망티스트_00>sub:로망티스트_01 callback 0 1',
    'sub:로망티스트_00>sub:로망티스트_01 setup_payoff 1 1',
  ]);
  assert.equal(v.gaps.internal2, 1);
  assert.deepEqual(v.sessions.map((x) => `${x.session} ${x.units} ${x.records}`), ['M02 1 2', 'M05 1 3', 'M12 1 3']);
  const unit = (k) => v.units.find((u) => u.unit === k);
  assert.equal(unit('sub:로망티스트_01').fixes, 1, '바로잡기로 더한 Q4');
  assert.equal(unit('sub:로망티스트_01').records2, 3);
  // 인물 변화 타임라인은 인물 · 읽는 자리 순, 관계 상대도 센다
  assert.deepEqual(v.changes.map((c) => `${c.id} ${c.act}`), ['D1 기준', 'D3 변화', 'D2 변화']);
  const rom = v.persons.find((p) => p.target === 'person:로망티스트');
  assert.equal(`${rom.baselines} ${rom.changes} ${rom.aspects}`, '1 1 성격 1 · 관계 1');
  assert.equal(v.persons.find((p) => p.target === 'person:지휘관').partner, 1);
  // 같은 기록이면 같은 결과
  const again = buildRead2Views(loadDataset({ dir: EXAMPLE_DIR }), ctx, order, buildRead1Views(loadDataset({ dir: EXAMPLE_DIR }), ctx, order));
  assert.equal(renderRead2Report(v1, again, { source: 'x' }), renderRead2Report(v1, v, { source: 'x' }));
});

test('2회독을 얹은 시안 (C1) — 실제 기록: 문제 없음, 단위 엣지는 읽는 순서로만, 1회독 몫은 1회독 시안과 같다', () => {
  const ds = loadDataset();
  const v1 = buildRead1Views(ds, ctx, order);
  const v = buildRead2Views(ds, ctx, order, v1);
  assert.deepEqual(v.problems, []);
  assert.ok(v.unitEdges.every((e) => e.from_order < e.to_order));
  assert.equal(v.unitEdges.reduce((a, e) => a + e.read1, 0), v1.unitEdges.reduce((a, e) => a + e.count, 0));
  assert.equal(v.units.length, v1.units.length);
  assert.ok(v.units.every((u) => u.in_all >= u.in1 && u.out_all >= u.out1), '2회독은 이어짐을 더하기만 한다');
  const read2 = ds.candidates.filter((c) => c.read2 && c.id && c.status !== '기각');
  assert.equal(v.units.reduce((a, u) => a + u.records2, 0), read2.length, '단위별 2회독 기록 합 = 살아 있는 2회독 기록');
});
