/**
 * X2 관계선(tools/views/links.mjs) — 키로 아는 다음 편 · 중심 기준 · 수동 엣지 병합 · 실제 기록으로 뽑은 엣지의 불변식 · query.mjs links.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EDGE_TYPES, EXAMPLE_DIR, ROOT, loadDataset } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { mergeEdges, read2Edges } from '../tools/records/read2.mjs';
import { read1Edges } from '../tools/views/read1.mjs';
import { CENTER, SKIP_TARGETS, TYPE_ORDER, buildLinks, centerWhy, keySequels } from '../tools/views/links.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const v = buildLinks(ds, ctx, order);
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });

test('키로 아는 다음 편 — 메인은 번호 순, 서브퀘스트 다음 번호, 유실물 전 → 후, 이벤트 → 이벤트 유실물', () => {
  const units = ['ch00', 'sub:세르반_00', 'ch02', 'ch01', 'sub:세르반_01', 'sub:세르반_03', 'relic:특이랩쳐보고서-전', 'relic:특이랩쳐보고서-후',
    'event_redash', 'erelic:red_ash_lost', 'erelic:old_tales_lost', 'ch10'];
  const got = keySequels(units).map((s) => `${s.from} → ${s.to}`);
  assert.deepEqual(got, [
    'ch00 → ch01', 'ch01 → ch02', 'ch02 → ch10', // 빠진 챕터는 건너뛰어 다음 번호로
    'sub:세르반_00 → sub:세르반_01', // _01 → _03은 아니다(02가 없다)
    'relic:특이랩쳐보고서-전 → relic:특이랩쳐보고서-후',
    'event_redash → erelic:red_ash_lost', // old_tales는 그 이벤트가 목록에 없어 빠진다
  ]);
});

test('중심 기준 — 기록 2건 · 인물은 말한 줄 5줄 · 10%, 비인물은 이름 5줄, 지휘관은 늘 뺀다', () => {
  const x = (o) => ({ speaks: 0, named: 0, records: new Set(), ...o });
  assert.equal(centerWhy('person:라피', x({ records: new Set(['F1', 'F2']) }), 100), '기록');
  assert.equal(centerWhy('person:라피', x({ records: new Set(['F1']) }), 100), null);
  assert.equal(centerWhy('person:라피', x({ speaks: 10 }), 100), '말함');
  assert.equal(centerWhy('person:라피', x({ speaks: 9 }), 100), null, '10% 밑');
  assert.equal(centerWhy('person:라피', x({ speaks: 4 }), 10), null, '5줄 밑');
  assert.equal(centerWhy('person:라피', x({ named: 50 }), 100), null, '인물은 이름만으로는 중심이 아니다');
  assert.equal(centerWhy('place:방주', x({ named: CENTER.named }), 0), '이름');
  assert.equal(centerWhy('place:방주', x({ named: 5, records: new Set(['F1', 'F2']) }), 0), '기록+이름');
  for (const t of SKIP_TARGETS) assert.equal(centerWhy(t, x({ speaks: 999, records: new Set(['F1', 'F2']) }), 1000), null);
});

test('수동 엣지 병합 — 단위 키 끝점은 단위 쌍으로 견주고, 같은 키의 자동 엣지는 여럿이어도 모두 이기거나 지운다', () => {
  const isUnit = (k) => !k.includes('_0');
  const auto = [
    { from: 'a_01', to: 'b_01', from_unit: 'A', to_unit: 'B', type: 'character', target: 'person:갑', origin: 'auto' },
    { from: 'a_02', to: 'b_01', from_unit: 'A', to_unit: 'B', type: 'character', target: 'person:을', origin: 'auto' },
    { from: 'a_02', to: 'b_01', from_unit: 'A', to_unit: 'B', type: 'callback', record: 'F1-2', origin: 'record' },
    { from: 'a_02', to: 'b_01', from_unit: 'A', to_unit: 'B', type: 'callback', record: 'F3-2', origin: 'record' },
  ];
  const drop = mergeEdges(auto, [{ id: 'Y1', type: 'character', from: 'A', to: 'B', drop: true, status: '확정' }], { isUnit });
  assert.deepEqual(drop.dropped.map((d) => d.target), ['person:갑', 'person:을']);
  assert.equal(drop.edges.length, 2, '같은 씬 쌍의 기록 엣지 둘은 따로 남는다');
  const win = mergeEdges(auto, [{ id: 'Y2', type: 'callback', from: 'a_02', to: 'b_01', strength: 2, status: '후보' }], { isUnit });
  const m = win.edges.find((e) => e.origin === 'manual');
  assert.deepEqual(m.auto.map((a) => a.record), ['F1-2', 'F3-2']);
  assert.equal(m.status, '후보');
  assert.equal(win.edges.length, 3);
});

test('실제 기록 — 타입 · 세기 · 방향 · 기록 엣지 수가 맞고 시트 엣지는 없다', () => {
  assert.equal(v.problems.length, 0, v.problems.slice(0, 5).join('\n'));
  for (const e of v.edges) {
    assert.ok(EDGE_TYPES.includes(e.type), e.type);
    assert.notEqual(e.origin, 'sheet');
    assert.ok([1, 2, 3].includes(e.strength), `${e.type} ${e.record} 세기 ${e.strength}`);
    if (e.origin !== 'record' && e.from_order != null && e.to_order != null) assert.ok(e.from_order <= e.to_order, `${e.type} ${e.from_unit} → ${e.to_unit}`);
  }
  for (const x of v.unitEdges) assert.notEqual(x.from_unit, x.to_unit);
  assert.deepEqual(TYPE_ORDER.slice().sort(), EDGE_TYPES.slice().sort());
  // 기록 엣지 = 1회독 사건 + 2회독 떡밥 (수동이 이긴 것은 manual로 넘어간다)
  const places = v.places;
  const n1 = read1Edges(ds, places.unitOf, (u) => places.unitPos.get(u) ?? null).sceneEdges.length;
  const n2 = read2Edges(ds, ctx, order).edges.length;
  const recs = v.edges.filter((e) => e.origin === 'record').length;
  const droppedRecs = v.dropped.filter((d) => d.origin === 'record').length;
  // 수동 엣지가 기록 엣지를 이기면 그만큼 manual로 넘어간다 — 그런 수동 엣지가 없을 때만 딱 맞춘다
  if (!v.edges.some((e) => e.origin === 'manual' && ['setup_payoff', 'callback', 'reversal'].includes(e.type))) assert.equal(recs + droppedRecs, n1 + n2);
  // 메인 다음 챕터 48 · 게임 조건(호감도 스토리 772)은 모두 같은 단위 안
  assert.equal(v.edges.filter((e) => e.type === 'sequel' && e.note === '다음 챕터').length, 48);
  assert.ok(v.edges.filter((e) => e.type === 'prereq').every((e) => e.from_unit === e.to_unit));
});

test('실제 기록 — 대상 공유는 대상마다 중심인 단위의 사슬(중심 단위 수 − 1), 지휘관은 없다, 흔한 대상만 세기 1', () => {
  const shared = v.edges.filter((e) => (e.type === 'character' || e.type === 'keyword') && e.origin === 'auto');
  const byT = new Map();
  for (const e of shared) byT.set(e.target, (byT.get(e.target) ?? 0) + 1);
  for (const [t, us] of v.chains) assert.equal(byT.get(t) ?? 0, us.length - 1, t);
  assert.ok(!byT.has('person:지휘관'));
  for (const e of shared) {
    assert.equal(e.strength, e.spread > v.common ? 1 : 2, e.target);
    assert.equal(e.type, e.target.startsWith('person:') ? 'character' : 'keyword');
    assert.ok(e.from_order < e.to_order, `${e.target} ${e.from_unit} → ${e.to_unit}`);
  }
  // 사슬은 읽는 순서로 이웃한 중심 단위끼리 — 건너뛰지 않는다
  const rapi = v.chains.get('person:라피');
  const pairs = new Set(shared.filter((e) => e.target === 'person:라피').map((e) => `${e.from_unit}>${e.to_unit}`));
  for (let i = 1; i < rapi.length; i++) assert.ok(pairs.has(`${rapi[i - 1]}>${rapi[i]}`));
});

test('같은 기록이면 같은 결과', () => {
  const again = buildLinks(ds, ctx, order);
  assert.deepEqual(again.edges, v.edges);
  assert.deepEqual(again.unitEdges, v.unitEdges);
});

test('예시 기록 — 수동 sequel이 자동 다음 편을 이기고(자동값 보존) 후보 엣지는 상태가 남는다', () => {
  const ex = buildLinks(loadDataset({ dir: EXAMPLE_DIR }), ctx, order);
  const y1 = ex.edges.find((e) => e.record === 'Y1');
  assert.equal(y1.origin, 'manual');
  assert.equal(y1.from_unit, 'sub:로망티스트_00');
  assert.match(y1.note, /자동 1건을 이김/);
  assert.ok(!ex.edges.some((e) => e.origin === 'auto' && e.type === 'sequel' && e.from_unit === 'sub:로망티스트_00'));
  assert.ok(ex.edges.some((e) => e.origin === 'record' && e.status === '후보'));
});

test('query.mjs links — 단위는 앞 · 뒤 단위를 타입별로, 씬은 선행 · 후속을, --type으로 거른다', () => {
  const u = node(['tools/query.mjs', 'links', 'sub:세르반_01']);
  assert.equal(u.status, 0, u.stderr);
  assert.match(u.stdout, /앞 \(먼저 볼 것\)/);
  assert.match(u.stdout, /다음 편\s+◆◆◆ sub:세르반_00/);
  const s = node(['tools/query.mjs', 'links', 'd_main_07_01', '--type', 'sequel']);
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /다음 편\s+◆◆◆ d_main_06_08_e\s+ch06/);
  assert.doesNotMatch(s.stdout, /같은 인물/);
});

test('화면 4 · 화면 1 — 줄기 ↔ 대상 · 대상 ↔ 대상은 비인물만, 메인과 이어진 기록은 메인 밖 단위에만', () => {
  assert.ok(v.threadTargets.length && v.targetPairs.length);
  for (const r of v.threadTargets) assert.ok(!r.target.startsWith('person:') && /^J\d+$/.test(r.thread) && (r.records > 0 || r.thread_about), `${r.thread} ${r.target}`);
  for (const p of v.targetPairs) assert.ok(p.records >= 2 && p.a < p.b && !p.a.startsWith('person:') && !p.b.startsWith('person:'), `${p.a} ${p.b}`);
  for (const u of v.units) {
    if (u.kind === '메인') assert.equal(u.main_in, '');
    else assert.equal(typeof u.main_in, 'number');
  }
  assert.ok(v.units.some((u) => u.unit === 'fl:ark_guardian' && u.main_in > 0 && u.main_out > 0));
});
