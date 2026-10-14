/**
 * X3d 인물별 집계 — 등장 합치기(자동 줄 + 2회독 암시 언급, 줄 합집합) · 관계 쌍(W21) · 기록 집계 · 따로 두는 인물(tools/views/persons.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, impersonations, loadDataset } from '../tools/records/model.mjs';
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
  assert.deepEqual(again.relations, v.relations);
});

test('등장 — 줄 합집합: 자동 줄만 센 것 이상, 말한 줄 + 이름 줄 = 등장 줄, 단위 표와 합이 같다', () => {
  for (const p of v.persons) {
    assert.equal(p.speaker_lines + p.named_lines, p.lines, p.target);
    const us = v.personUnits.filter((r) => r.person === p.target);
    assert.equal(us.filter((r) => r.scenes).length, p.units, p.target); // scenes 0 행 = 사칭으로 줄을 다 옮긴 단위(W23a — pre_*만)
    assert.ok(us.every((r) => r.scenes || r.imp), `${p.target}: 빈 행은 사칭 단위뿐`);
    assert.equal(us.reduce((s, r) => s + r.scenes, 0), p.scenes, p.target);
    assert.equal(us.reduce((s, r) => s + r.lines, 0), p.lines, p.target);
  }
  // 암시 언급이 있는 인물은 그 씬이 등장에 든다
  const ps = personScenes(ctx, ds);
  // 사칭 범위(W23a · b)의 이름표 주인 줄은 사칭한 인물에게 옮겨 센다 — 그 암시 언급은 사칭한 인물의 등장에 든다
  const imps = impersonations(ds);
  const holder = (r) => imps.find((L) => L.b === r.target && L.spans.some((s) => s.scene === r.scene && (!s.seqs || s.seqs.has(r.from_seq))))?.a ?? r.target;
  for (const r of mentionRows(ds).filter((x) => x.target?.startsWith('person:')).slice(0, 200)) {
    const x = ps.get(holder(r))?.get(r.scene);
    assert.ok(x && x.all.has(r.from_seq) && x.implied.has(r.from_seq), `${r.record}`);
    if (r.speaker) assert.ok(x.speak.has(r.from_seq), `${r.record} speaker`);
  }
});

test('관계 쌍(W21) — 기록에서만: D 관계의 person ↔ with · O 관계 사슬 · 그 O의 합류 H, 같은 씬 횟수는 없다', () => {
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const key = (x, y) => (x < y ? `${x}\t${y}` : `${y}\t${x}`);
  const want = new Map();
  const add = (x, y, id) => (want.get(key(x, y)) ?? want.set(key(x, y), new Set()).get(key(x, y))).add(id);
  for (const c of live.filter((x) => x.kind === 'change' && x.obj?.aspect === '관계' && x.obj?.person?.startsWith('person:'))) {
    for (const w of c.obj.with ?? []) if (w.startsWith('person:') && w !== c.obj.person) add(c.obj.person, w, c.id);
  }
  for (const c of live.filter((x) => x.kind === 'closure')) {
    const m = /^관계 (\S+) ↔ (\S+)$/.exec(c.obj?.chain ?? '');
    if (m) add(m[1], m[2], c.id);
  }
  assert.equal(v.relations.length, want.size);
  for (const r of v.relations) {
    assert.ok(r.a < r.b, `${r.a} ${r.b}`);
    const ids = [r.changes, r.closures].join(' ').split(' ').filter(Boolean);
    assert.deepEqual(new Set(ids), want.get(`${r.a}\t${r.b}`), `${r.a} ${r.b}`);
    for (const h of r.merges.split(' ').filter(Boolean)) {
      const members = live.find((c) => c.id === h)?.obj?.members ?? [];
      assert.ok(members.some((o) => r.closures.split(' ').includes(o)), `${h} — 이 쌍의 결말을 묶은 합류`);
    }
    assert.ok(!('scenes' in r) && !('talk_scenes' in r), '같은 씬 횟수를 싣지 않는다');
  }
  // 인물 표의 관계 상대 수 = 그 인물이 낀 쌍(만우절 기록뿐인 쌍 빼고)
  for (const p of v.persons) assert.equal(p.relations, v.relations.filter((r) => !r.fool && (r.a === p.target || r.b === p.target)).length, p.target);
  assert.equal(byId.get('person:지휘관').common, '지휘관');
  assert.ok(v.relations.some((r) => r.a === 'person:마스트' && r.b === 'person:헬름' && r.merges.includes('H19')), '마스트 ↔ 헬름 — 결말 O159 · 합류 H19');
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
