/**
 * X1d 작중 연대기 ③(tools/views/chrono-order.mjs) — 출시순과 어긋남 · 앞뒤 기록 쌍 · 작중 순서 · 인물 변화의 작중 시점 · 공개 단계를 작중 축으로.
 * 작은 입력으로 규칙을, 실제 기록으로 표가 빠짐없이 나오는지를 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { loadDataset } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { chronology } from '../tools/views/chrono.mjs';
import { changeTimeline, chronoOrder, prequelPairs, releaseDrift, revealChrono, unitSpans } from '../tools/views/chrono-order.mjs';
import { buildTimelineViews, renderChronoList } from '../tools/views/timeline.mjs';

// 축: @A(100년 전)=1 · @B=3 · @C(60년 전)=5 · ch00=7 · ch01=9 · ch02=11 · ch03=13
const eras = [{ id: '@A', years: 100 }, { id: '@B', years: null }, { id: '@C', years: 60 }];
const mains = ['ch00', 'ch01', 'ch02', 'ch03'];
// [단위, 공개 자리] — 읽는 순서대로. 자리 3 · 5 · 7 · 8 · 9는 메인 챕터가 없는 날
const seqs = [['ch00', 1], ['ch01', 2], ['ev1', 3], ['ep0', 3], ['ch02', 4], ['ev2', 5], ['ev3', 5], ['ch03', 6], ['ev4', 7], ['ev5', 7], ['ep1', 8], ['ep2', 9], ['relic1', 9]];
const units = seqs.map(([u, t], i) => ({ unit: u, kind: mains.includes(u) ? '메인' : '이벤트', order: i + 1, tick: t }));
const rel = {
  byUnit: new Map(units.map((u) => [u.unit, u])),
  ticks: Array.from({ length: 9 }, (_, i) => ({ tick: i + 1, date: `2024-01-0${i + 1}`, main: units.find((u) => u.tick === i + 1 && u.kind === '메인')?.unit ?? '' })),
};
const keys = seqs.map(([u]) => u);
const resolveKey = (k) => (keys.includes(k) ? { unit: k, scene: false } : null);
const T = (id, unit, kind, at, extra = {}) => ({ id, unit, kind, at, status: '확정', text: id, ...extra });
const times = [
  T('S1', 'ev1', '기준점', [['동시', 'ch01']]), // 공개 당시 메인 ch01 그대로 — 맞음
  T('S11', 'ev1', '회상', [['전', '@A']]), // 회상 조각 — 축 맨 앞
  T('S2', 'ep0', '기준점', [['뒤', 'ch02']]), // 공개 당시 ch01인데 ch02 뒤 — 뒤
  T('S3', 'ev2', '기준점', [['뒤', 'ch00'], ['전', 'ch01']]), // 공개 당시 ch02, 작중 ch00–ch01 — 앞 2
  T('S4', 'ev3', '기준점', [['전', '@C']]), // 메인 앞 — 과거
  T('S5', 'ev4', '기준점', [['뒤', 'ch01']]), // 한쪽만 — 걸침
  T('S6', 'ep1', '기준점', [['뒤', 'ev5']]), // 상대
  T('S7', 'ev4', '기준점', [['뒤', 'relic1']], { subject: '단위' }), // relic1(늦게 공개)이 작중 앞 — 앞뒤 쌍
  T('S9', 'ep2', '기준점', [['중', '@B']], { subject: '구간' }), // 여러 자리 조각
  T('S10', 'ep2', '기준점', [['동시', 'ch02']], { subject: '구간' }),
];
const ch = chronology({ times, eras, mains, units, resolveKey });
const spans = unitSpans(ch);
const drift = releaseDrift(ch, rel, spans);

test('작중 구간 — 단위 노드는 lo · hi, 조각으로 가른 단위는 조각들을 감싸고 열쇠는 가장 앞 조각', () => {
  assert.deepEqual(ch.problems, []);
  assert.deepEqual([spans.get('ev2').lo, spans.get('ev2').hi, spans.get('ev2').key], [8, 8, 8]);
  assert.deepEqual([spans.get('ev3').lo, spans.get('ev3').hi, spans.get('ev3').key], [-Infinity, 4, 4]);
  assert.deepEqual([spans.get('ep2').lo, spans.get('ep2').hi, spans.get('ep2').key, spans.get('ep2').multi], [3, 11, 3, true]);
  assert.equal(spans.get('ev5').lo, null);
});

test('어긋남 — 공개 당시 메인과 견줘 과거 · 앞 · 맞음 · 걸침 · 뒤, 메인 · 상대 · 불명은 빈 칸', () => {
  const d = (u) => [drift.get(u).release_main, drift.get(u).drift, drift.get(u).drift_gap];
  assert.deepEqual(d('ev1'), ['ch01', '맞음', '']);
  assert.deepEqual(d('ep0'), ['ch01', '뒤', 1]);
  assert.deepEqual(d('ev2'), ['ch02', '앞', 2]);
  assert.deepEqual(d('ev3'), ['ch02', '과거', 3]);
  assert.deepEqual(d('ev4'), ['ch03', '걸침', '']);
  assert.deepEqual(d('ep2'), ['ch03', '앞', 1]); // 감싸는 구간 끝(ch02)이 ch03 앞
  for (const u of ['ch02', 'ev5', 'ep1', 'relic1']) assert.equal(drift.get(u).drift, '', u);
});

test('앞뒤 기록 쌍 — 단위의 지금끼리 앞뒤 관계에서 작중 앞 단위가 더 늦게 공개된 것만', () => {
  assert.deepEqual(prequelPairs(ch, rel).map((p) => [p.earlier, p.later, p.record]), [['relic1', 'ev4', 'S7']]);
});

test('작중 순서 — 열쇠 → 뒤 끝 → 판별 먼저, 조각은 따로 한 줄, 상대 · 불명은 끝에(남이 기준으로 삼은 ev5도 상대)', () => {
  const co = chronoOrder(ch, rel, spans, drift);
  assert.equal(co.length, units.length + ch.pieces.length);
  const placed = co.filter((r) => r.seq !== '');
  assert.deepEqual(placed.map((r) => r.seq), placed.map((_, i) => i + 1));
  assert.deepEqual(placed.slice(0, 4).map((r) => r.entry), ['S11', 'S9', 'ep2', 'ev3']);
  assert.deepEqual(co.filter((r) => r.seq === '').map((r) => `${r.entry} ${r.class}`), ['ev5 상대', 'ep1 상대', 'relic1 상대']);
  // 메인 챕터는 제자리, 범위는 앞 끝 칸
  assert.ok(placed.findIndex((r) => r.entry === 'ch01') < placed.findIndex((r) => r.entry === 'ev4'));
  assert.equal(placed.find((r) => r.entry === 'ev4').slot, 10);
  assert.equal(co.find((r) => r.entry === 'S11').type, '회상');
});

test('인물 변화의 작중 시점 — time이 조각이면 조각 자리, 없으면 드러난 단위, 먼저 공개된 변화보다 작중 앞이면 뒤바뀜', () => {
  const C = (id, unit, act, obj) => ({ id, kind: 'change', unit, act, status: '확정', obj: { person: 'person:갑', aspect: '관계', ...obj } });
  const ds = {
    candidates: [
      ...times.map((t) => ({ id: t.id, kind: 'time', unit: t.unit, act: t.kind, status: t.status, obj: { subject: t.subject } })),
      C('D1', 'ev4', '변화', { before: '가', after: '나' }),
      C('D2', 'ep2', '변화', { before: '다', after: '라', time: 'S9' }),
      C('D3', 'ch01', '기준', { text: '처음' }),
      C('D4', 'ev5', '변화', { before: '마', after: '바' }),
      { ...C('D5', 'ev1', '변화', {}), status: '기각' },
    ],
  };
  const ct = changeTimeline(ds, ch, spans, rel);
  assert.deepEqual(ct.rows.map((r) => [r.id, r.seq, r.source]), [['D2', 1, '조각 S9'], ['D3', 2, '단위'], ['D1', 3, '단위'], ['D4', '', '단위']]);
  assert.equal(ct.rows.find((r) => r.id === 'D2').inverted, 'D1');
  assert.equal(ct.rows.find((r) => r.id === 'D1').inverted, '');
  assert.deepEqual(ct.persons.map((p) => [p.person, p.changes, p.placed, p.inverted]), [['person:갑', 3, 2, 1]]);
});

test('공개 단계를 작중 축으로 — 작중 첫 단위 · 앞당김(사실) · 회수 먼저(의문)', () => {
  const R = (root, kind, act, stage, unit) => ({ root, kind, act, stage, unit, record: `${root}-${unit}` });
  const st = {
    rows: [
      R('F1', '사실', '드러냄', '처음 밝혀짐', 'ch03'), R('F1', '사실', '드러냄', '보강', 'ep2'),
      R('F2', '사실', '드러냄', '처음 밝혀짐', 'ev5'), R('F2', '사실', '드러냄', '보강', 'ev2'),
      R('Q1', '의문', '제기', '제기', 'ch02'), R('Q1', '의문', '회수', '회수', 'ev2'),
    ],
    roots: [{ id: 'F1', kind: '사실' }, { id: 'F2', kind: '사실' }, { id: 'Q1', kind: '의문' }],
  };
  const rc = revealChrono(st, spans);
  const root = (id) => rc.roots.find((r) => r.id === id);
  assert.deepEqual([root('F1').chrono_first_units, root('F1').chrono_shift], ['ep2', '앞당김']);
  assert.deepEqual([root('F2').chrono_first_units, root('F2').chrono_shift], ['ev2', '']); // 처음 밝혀짐의 자리를 모르면 견주지 않는다
  assert.deepEqual([root('Q1').chrono_first_units, root('Q1').chrono_shift], ['ch02', '회수 먼저']);
  assert.deepEqual(rc.rows.map((r) => r.chrono_place), ['ch03', spans.get('ep2').place, '', 'ch00–ch01', 'ch02', 'ch00–ch01']);
});

const db = await openDb();
const ctxReal = await openContext(db);
test.after(() => db.close());

test('실제 기록 — 단위마다 지금 한 줄 · 조각마다 한 줄, 인물 변화는 기각 뺀 D 모두, 메인은 어긋나지 않는다', () => {
  const ds = loadDataset();
  const v = buildTimelineViews(ds, ctxReal, loadOrder());
  assert.deepEqual(v.problems, []);
  assert.equal(v.corder.length, v.chrono.length + v.pieces.length);
  assert.deepEqual(v.corder.filter((r) => r.type === '지금').map((r) => r.unit).sort(), v.chrono.map((r) => r.unit).sort());
  const placed = v.corder.filter((r) => r.seq !== '');
  assert.deepEqual(placed.map((r) => r.seq), placed.map((_, i) => i + 1));
  for (let i = 1; i < placed.length; i++) assert.ok(placed[i - 1].slot <= placed[i].slot, placed[i].entry);
  for (const r of v.corder.filter((x) => x.seq === '')) assert.ok(['상대', '불명'].includes(r.class), r.entry);
  for (const r of v.chrono) {
    assert.ok(['', '과거', '앞', '맞음', '걸침', '뒤'].includes(r.drift), r.unit);
    if (r.kind === '메인' || ['상대', '불명'].includes(r.class)) assert.equal(r.drift, '', r.unit);
    else assert.ok(r.release_main, r.unit);
  }
  const liveD = ds.candidates.filter((c) => c.kind === 'change' && c.id && c.status !== '기각');
  assert.equal(v.changes.length, liveD.length);
  assert.ok(v.changes.every((r) => r.seq === '' || r.place !== ''));
  assert.equal(v.rows.length, v.st.rows.length);
  assert.ok(v.roots.every((r) => r.kind === '사실' ? ['', '앞당김'].includes(r.chrono_shift) : ['', '회수 먼저'].includes(r.chrono_shift)));
  // 화면 6 시안 — 메인 챕터마다 머리말 하나
  const md = renderChronoList(v, { source: 'x' });
  for (const m of v.chrono.filter((r) => r.kind === '메인')) assert.match(md, new RegExp(`^## ${m.unit} — 공개`, 'm'), m.unit);
});
