/**
 * X3d 인물별 집계 — 등장 합치기(자동 줄 + 2회독 암시 언급, 줄 합집합) · 함께 나옴 · 기록 집계 · 따로 두는 인물(tools/views/persons.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, loadDataset } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { mentionRows } from '../tools/records/read2.mjs';
import { buildPersons, personScenes, renderPersonsReport } from '../tools/views/persons.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const v = buildPersons(ds, ctx, order);
const byId = new Map(v.persons.map((p) => [p.target, p]));

test('사전 인물 전부 한 줄 · 정렬 결정적 · 문제 없음', () => {
  const n = db.prepare("SELECT COUNT(*) n FROM targets WHERE type = 'person'").get().n;
  assert.equal(v.persons.length, n);
  assert.deepEqual(v.problems, []);
  const again = buildPersons(ds, ctx, order);
  assert.deepEqual(again.persons, v.persons);
  assert.deepEqual(again.pairs.slice(0, 50), v.pairs.slice(0, 50));
});

test('등장 — 줄 합집합: 자동 줄만 센 것 이상, 말한 줄 + 이름 줄 = 등장 줄, 단위 표와 합이 같다', () => {
  for (const p of v.persons) {
    assert.equal(p.speaker_lines + p.named_lines, p.lines, p.target);
    const us = v.personUnits.filter((r) => r.person === p.target);
    assert.equal(us.length, p.units, p.target);
    assert.equal(us.reduce((s, r) => s + r.scenes, 0), p.scenes, p.target);
    assert.equal(us.reduce((s, r) => s + r.lines, 0), p.lines, p.target);
  }
  // 암시 언급이 있는 인물은 그 씬이 등장에 든다
  const ps = personScenes(ctx, ds);
  for (const r of mentionRows(ds).filter((x) => x.target?.startsWith('person:')).slice(0, 200)) {
    const x = ps.get(r.target)?.get(r.scene);
    assert.ok(x && x.all.has(r.from_seq) && x.implied.has(r.from_seq), `${r.record}`);
    if (r.speaker) assert.ok(x.speak.has(r.from_seq), `${r.record} speaker`);
  }
});

test('함께 나옴 — 쌍은 ID 순 · 둘 다 말한 씬 ≤ 씬 · 쌍의 씬 ≤ 두 인물 각자의 씬', () => {
  for (const p of v.pairs) {
    assert.ok(p.a < p.b, `${p.a} ${p.b}`);
    assert.ok(p.talk_scenes <= p.scenes);
    assert.ok(p.units <= p.scenes);
    assert.ok(p.scenes <= byId.get(p.a).scenes && p.scenes <= byId.get(p.b).scenes, `${p.a} ${p.b}`);
  }
  // 지휘관 · 흔한 대상이 낀 쌍에 common 칸
  for (const p of v.pairs.slice(0, 300)) assert.equal(Boolean(p.common), [p.a, p.b].some((t) => byId.get(t).common), `${p.a} ${p.b}`);
  assert.equal(byId.get('person:지휘관').common, '지휘관');
});

test('기록 — about으로 센 사실 · 의문 수, 의문 상태 합 = 의문, 변화는 D의 person', () => {
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const facts = live.filter((c) => c.kind === 'fact' && c.role === 'def' && (c.obj?.about ?? []).includes('person:마리안')).length;
  assert.equal(byId.get('person:마리안').facts, facts);
  for (const p of v.persons) assert.equal(p.open + p.partial + p.solved, p.questions, p.target);
  const ch = live.filter((c) => c.kind === 'change' && c.obj?.person === 'person:라피');
  assert.equal(byId.get('person:라피').baselines + byId.get('person:라피').changes, ch.length);
  for (const r of v.personRecords) assert.ok(byId.has(r.person), r.person);
});

test('예시 기록으로도 돈다', () => {
  const ex = buildPersons(loadDataset({ dir: EXAMPLE_DIR }), ctx, order);
  assert.ok(renderPersonsReport(ex, { source: 'tests/fixtures/read1/' }).startsWith('# 인물별 집계'));
});
