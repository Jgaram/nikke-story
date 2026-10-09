/**
 * X1b 작중 연대기(tools/views/chrono.mjs) — 관계의 뜻 · 모순 · 순환 · 연수 · 단위 가르기를 작은 입력으로, 실제 기록은 문제 없이 계산되는지를 본다.
 * X1c 좁힘(annotations/chronology.json units) · 모습 코드(codes) · 단서표(chrono-clues.mjs)도 같이 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, loadDataset } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { chronology, chronologyProblems, loadChronology, timeShapeProblems, yearsRange } from '../tools/views/chrono.mjs';
import { chronoClues } from '../tools/views/chrono-clues.mjs';
import { releasePlaces } from '../tools/views/reveal.mjs';
import { buildChronology } from '../tools/views/timeline.mjs';

// 축: @A(100년 전)=1 · @B(연수 없음)=3 · @C(60년 전)=5 · ch00=7 · ch01=9 · ch02=11 · ch03=13, 끝 칸 14
const eras = [{ id: '@A', years: 100 }, { id: '@B', years: null }, { id: '@C', years: 60 }];
const mains = ['ch00', 'ch01', 'ch02', 'ch03'];
const keys = [...mains, 'ev1', 'ev2', 'ev3', 'ev4', 'ep1', 'ep2', 'ep3', 'relic1', 'ev5'];
const units = keys.map((u, i) => ({ unit: u, kind: mains.includes(u) ? '메인' : '이벤트', order: i + 1, tick: i + 1 }));
const resolveKey = (k) => (keys.includes(k) ? { unit: k, scene: false } : k.startsWith('scene:') ? { unit: k.slice(6), scene: true } : null);
const T = (id, unit, kind, at, extra = {}) => ({ id, unit, kind, at, status: '확정', text: id, ...extra });

const run = (times, narrows = []) => chronology({ times, eras, mains, units, resolveKey, narrows });
const row = (ch, u) => ch.rows.find((r) => r.unit === u);
const piece = (ch, id) => ch.pieces.find((p) => p.id === id);

test('관계 — 고정점 기준은 칸을 건너고, 고정되지 않은 노드 · 씬 기준은 같은 칸 안 앞뒤를 허용한다', () => {
  const ch = run([
    T('S1', 'ev1', '기준점', [['직후', 'ch01']]), // 그 사이 칸 ~ 다음 챕터
    T('S2', 'ev2', '기준점', [['뒤', 'ch01']]), // 한쪽만 — 범위
    T('S3', 'ev3', '기준점', [['뒤', 'ev1']]), // 노드 기준 — 칸을 올리지 않는다
    T('S4', 'ev4', '기준점', [['직후', 'scene:ch02']]), // 씬 기준 — 그 챕터 안 뒤 ~ 다음 칸
    T('S5', 'ev5', '기준점', [['뒤', 'ch00'], ['전', 'ch01']]),
  ]);
  assert.deepEqual(ch.problems, []);
  assert.deepEqual([row(ch, 'ev1').class, row(ch, 'ev1').place], ['판별', 'ch01–ch02 ~ ch02']);
  assert.deepEqual([row(ch, 'ev2').class, row(ch, 'ev2').place], ['범위', 'ch01–ch02 ~']);
  assert.deepEqual([row(ch, 'ev3').class, row(ch, 'ev3').place], ['범위', 'ch01–ch02 ~']);
  assert.deepEqual([row(ch, 'ev4').class, row(ch, 'ev4').place], ['판별', 'ch02 ~ ch02–ch03']);
  assert.deepEqual([row(ch, 'ev5').class, row(ch, 'ev5').place, row(ch, 'ev5').lo, row(ch, 'ev5').hi], ['판별', 'ch00–ch01', 8, 8]);
  assert.deepEqual([row(ch, 'ch02').class, row(ch, 'ch02').via], ['판별', '메인']);
  assert.equal(row(ch, 'ep1').class, '불명');
  assert.deepEqual([ch.contradictions, ch.cycles, ch.mainNotes], [[], [], []]);
});

test('모순 · 순환 · 메인 챕터끼리 — 모순은 관계 하나를 끄고 계산하고, 순환은 앞뒤 그래프에서 찾는다', () => {
  const ch = run([
    T('S1', 'ev1', '기준점', [['뒤', 'ch02'], ['전', 'ch01']]), // 빈 자리
    T('S2', 'ep1', '기준점', [['뒤', 'ep2']]),
    T('S3', 'ep2', '기준점', [['뒤', 'ep1']]), // 순환
    T('S4', 'ch03', '기준점', [['무렵', 'ch01']]), // 메인 번호 순과 다르다 — 모순이 아니다
    T('S5', 'ch02', '기준점', [['직후', 'ch01']]), // 번호 순 그대로 — 아무 일 없다
  ]);
  assert.equal(ch.contradictions.length, 1);
  assert.equal(ch.contradictions[0].record, 'S1');
  assert.equal(row(ch, 'ev1').class, '범위'); // 남은 관계 하나로
  assert.deepEqual(ch.cycles.map((c) => c.records), [['S2', 'S3']]);
  assert.deepEqual(ch.mainNotes.map((r) => r.record), ['S4']);
});

test('연수 · 조각 · 회상 — 연수는 시대 기준점 연수로 자리를 정하고, 단위의 지금이 없으면 조각 · 회상으로 가른다', () => {
  const ch = run([
    T('S1', 'ev1', '기준점', [['뒤', 'ch02']]),
    T('S2', 'ev1', '회상', [['전', 'ev1']], { years: 80 }), // @A(100) – @C(60) 사이 — @B를 끼고 두 칸
    T('S3', 'relic1', '회상', [['무렵', '@A']]), // 기록이 모두 회상 — 회상 조각으로
    T('S4', 'ep3', '회상', [['전', 'ep3']]), // 자기 지금만 기준 — 불명
    T('S5', 'ev2', '기준점', [['중', 'ch01']], { subject: '구간' }),
    T('S6', 'ev2', '기준점', [['중', 'ch03']], { subject: '구간' }), // 여러 자리
    T('S7', 'ev3', '기준점', [['전', 'ch00']], { years: [60, 0] }), // 지금까지 — 끝은 경계가 아니다
    T('S8', 'ev4', '기준점', [], { years: 120 }), // 첫 기준점보다 앞
  ]);
  assert.deepEqual(ch.problems, []);
  assert.deepEqual([piece(ch, 'S2').class, piece(ch, 'S2').place], ['판별', '@A–@B ~ @B–@C']);
  assert.deepEqual([row(ch, 'ev1').class, row(ch, 'ev1').via, row(ch, 'ev1').flashbacks], ['범위', '단위', 'S2']);
  assert.deepEqual([row(ch, 'relic1').class, row(ch, 'relic1').via, row(ch, 'relic1').place], ['판별', '회상', '@A 전 ~ @A–@B']);
  assert.deepEqual([row(ch, 'ep3').class, piece(ch, 'S4').class], ['불명', '상대']);
  assert.deepEqual([row(ch, 'ev2').class, row(ch, 'ev2').via, row(ch, 'ev2').place], ['판별', '조각', 'ch01 / ch03']);
  assert.deepEqual([row(ch, 'ev3').class, row(ch, 'ev3').place], ['판별', '@B–@C ~ @C–ch00']); // 60년 = @C 무렵, 지금 쪽 끝은 'ch00 전'이 막는다
  assert.deepEqual([row(ch, 'ev4').class, row(ch, 'ev4').place], ['범위', '~ @A 전']);
});

test('꼴 검사 — 관계 · 기준 · subject · years', () => {
  const ref = { eras: new Set(['@A']), times: new Map([['S1', { status: '확정' }], ['S2', { status: '기각' }]]), resolveKey };
  assert.deepEqual(timeShapeProblems({ id: 'S9', at: [['직후', 'ch01'], ['뒤', '@A', '두 해'], ['동시', 'S1'], ['무렵', 'scene:ch02']] }, ref), []);
  const bad = timeShapeProblems({ id: 'S1', subject: '무엇', years: [10, 20], at: [['사이', 'ch01'], ['뒤', '@Z'], ['뒤', 'S2'], ['뒤', 'S1'], ['뒤', 'nowhere'], ['뒤']] }, ref);
  assert.equal(bad.length, 8);
  assert.deepEqual([yearsRange(5), yearsRange([90, 78]), yearsRange([1, 2]), yearsRange(-1)], [[5, 5], [90, 78], null, null]);
});

test('좁힘 — 단위의 지금에 관계를 더하고, 단서 없음은 불명으로 남기며, 묶음은 함께 내려온다', () => {
  const N = (unit, at, extra = {}) => ({ unit, at, basis: ['F1'], reason: '이유', confidence: '추정', session: 'X1c-1', ...extra });
  const times = [
    T('S1', 'ep1', '기준점', [['뒤', 'ev1']]), // ev1에 기대는 호감도 — ev1이 축에 닿으면 함께 내려온다
    T('S2', 'ev2', '기준점', [['뒤', 'ch00']]),
  ];
  const before = run(times);
  assert.deepEqual([row(before, 'ev1').class, row(before, 'ep1').class], ['상대', '상대']);
  const ch = run(times, [
    N('ev1', [['뒤', 'ch01']]),
    N('ev2', [['전', 'ch02']]), // 자기 시점 기록과 함께
    N('ev3', []), // 단서 없음 — 시점 불명 확인
    N('ep2', [], { years: 60 }),
    N('ch02', [['뒤', 'ch01']]), // 메인은 좁히지 않는다
  ]);
  assert.deepEqual(ch.problems, ['좁힘:ch02: 메인 챕터는 좁히지 않는다(고정점)']);
  assert.deepEqual([row(ch, 'ev1').class, row(ch, 'ev1').via, row(ch, 'ev1').place, row(ch, 'ev1').narrow], ['범위', '좁힘', 'ch01–ch02 ~', '뒤 ch01']);
  assert.deepEqual([row(ch, 'ep1').class, row(ch, 'ep1').via, row(ch, 'ep1').narrow], ['범위', '단위', '']);
  assert.deepEqual([row(ch, 'ev2').class, row(ch, 'ev2').via, row(ch, 'ev2').place], ['판별', '단위 · 좁힘', 'ch00–ch01 ~ ch01–ch02']);
  assert.deepEqual([row(ch, 'ev3').class, row(ch, 'ev3').via, row(ch, 'ev3').narrow, row(ch, 'ev3').narrow_confidence], ['불명', '', '단서 없음', '추정']);
  assert.deepEqual([row(ch, 'ep2').class, row(ch, 'ep2').place, row(ch, 'ep2').narrow], ['판별', '@B–@C ~ @C–ch00', '연수 60년 전']);
  assert.equal(ch.narrows.length, 5);
  assert.equal(ch.stats.relations, 2);
  // 좁힘이 시점 기록과 부딪치면 모순으로 보인다
  const bad = run(times, [N('ev2', [['전', 'ch00']])]);
  assert.equal(bad.contradictions.length, 1);
});

test('조각 좁힘(piece) — 단위의 지금이 아니라 그 단위의 조각(구간)에 관계를 더한다', () => {
  const N = (unit, at, extra = {}) => ({ unit, at, basis: ['F1'], reason: '이유', confidence: '추정', session: 'X1c-3', ...extra });
  const times = [
    T('S1', 'ev4', '기준점', [['뒤', 'ch01']], { subject: '구간' }), // 한쪽만 아는 조각
    T('S2', 'ev4', '기준점', [['중', 'ch03']], { subject: '구간' }),
    T('S3', 'ev5', '기준점', [['뒤', 'ch00']]), // 단위의 지금 — 조각이 아니다
  ];
  const before = run(times);
  assert.deepEqual([piece(before, 'S1').class, piece(before, 'S1').place, row(before, 'ev4').place], ['범위', 'ch01–ch02 ~', 'ch01–ch02 ~ / ch03']);
  const ch = run(times, [
    N('ev4', [['전', 'S2']], { piece: 'S1' }),
    N('ev4', [], { piece: 'S2' }),
    N('ev4', []), // 같은 단위의 '지금' 항목과 함께 둘 수 있다
    N('ev5', [['전', 'ch01']], { piece: 'S3' }), // 조각이 아닌 시점 기록
    N('ev3', [['전', 'ch01']], { piece: 'S1' }), // 다른 단위의 조각
  ]);
  assert.deepEqual(ch.problems, ['좁힘:S1: piece는 ev3의 조각(구간 시점 기록)이어야 한다', '좁힘:S3: piece는 ev5의 조각(구간 시점 기록)이어야 한다']);
  assert.deepEqual([piece(ch, 'S1').class, piece(ch, 'S1').place, piece(ch, 'S1').narrow, piece(ch, 'S1').narrow_confidence], ['범위', 'ch01–ch02 ~ ch03', '전 S2', '추정']); // 조각 기준은 같은 칸 안 앞뒤를 허용
  assert.deepEqual([piece(ch, 'S2').narrow, row(ch, 'ev4').narrow, row(ch, 'ev4').via, row(ch, 'ev4').place], ['단서 없음', '단서 없음', '조각', 'ch01–ch02 ~ ch03 / ch03']);
  assert.equal(ch.narrows.length, 3); // 틀린 둘은 빠진다
});

test('좁힘 · 모습 코드 꼴 검사', () => {
  const ref = {
    eras: new Set(['@A']), resolveKey, ids: new Set(['F1', 'D2', 'S1']),
    times: new Map([['S1', { status: '확정', unit: 'ev1', obj: { kind: '기준점' } }], ['S3', { status: '확정', unit: 'ev2', obj: { kind: '기준점', subject: '구간' } }],
      ['S4', { status: '기각', unit: 'ev2', obj: { kind: '회상' } }]]),
    unitOf: (k) => resolveKey(k)?.unit ?? null, hasCode: (c) => c === 'rapi_red', targets: new Set(['person:라피']), mains: new Set(mains), reading: new Set(keys),
  };
  const good = {
    codes: [{ code: 'rapi_red', person: 'person:라피', meaning: '뜻', first: 'scene:ch02#3', at: [['뒤', 'ch02']], basis: ['D2'], reason: '이유', session: 'X1c-1' }],
    units: [
      { unit: 'ev1', at: [['뒤', 'ch01']], basis: ['F1', 'code:rapi_red', 'scene:ev1#3-5', 'ch01'], reason: '이유', confidence: '추정', session: 'X1c-1' },
      { unit: 'ev2', at: [], reason: '단서 없음', confidence: '확실', session: 'X1c-1' },
      { unit: 'ev2', piece: 'S3', at: [['전', 'ch02']], basis: ['F1'], reason: '조각', confidence: '추정', session: 'X1c-3' },
    ],
  };
  assert.deepEqual(chronologyProblems(good, ref), { errors: [], warnings: [] });
  const bad = {
    codes: [{ code: 'nope', person: 'person:없음', meaning: '', first: 'nowhere#1', at: 'x', reason: '이유', color: 1 }],
    units: [
      { unit: 'ev1', at: [['뒤', 'ev1']], basis: ['F9', 'code:anis_i', 'nowhere#1', 'scene:ev1#가'], reason: '', confidence: '아마', session: '' },
      { unit: 'ev1', at: [], reason: '둘째', confidence: '추정', session: 'X1c-1' },
      { unit: 'ch01', at: [['뒤', 'ch00']], basis: [], reason: '이유', confidence: '추정', session: 'X1c-1' },
      { unit: 'ghost', at: [], reason: '이유', confidence: '추정', session: 'X1c-1' },
      { unit: 'ev2', piece: 'S1', at: [], reason: '이유', confidence: '추정', session: 'X1c-3' },
      { unit: 'ev1', piece: 'S1', at: [], reason: '이유', confidence: '추정', session: 'X1c-3' },
      { unit: 'ev2', piece: 'S4', at: [], reason: '이유', confidence: '추정', session: 'X1c-3' },
      { unit: 'ev2', piece: 'S9', at: [], reason: '이유', confidence: '추정', session: 'X1c-3' },
      { unit: 'ev2', piece: 'S9', at: [], reason: '이유', confidence: '추정', session: 'X1c-3' },
    ],
  };
  const r = chronologyProblems(bad, ref);
  const msgs = r.errors.map((e) => `${e.id}: ${e.msg}`);
  for (const want of ['원문에 없는 모습 코드 nope', 'person은 사전의 인물 ID', 'meaning가 없다', 'first: 모르는 씬', 'at(이 코드가 말하는 때',
    '자기 단위(ev1)를 기준으로', '없는 기록 F9', 'codes에 없는 모습 코드 code:anis_i', '모르는 근거 nowhere#1', '줄 번호 꼴', 'reason(', 'confidence는', 'session(',
    '같은 단위의 항목이 둘이다', '메인 챕터는 좁히지 않는다', 'basis는 근거 글자 배열', '읽기 순서에 없는 단위 ghost',
    'piece: S1는 ev1의 시점 기록이다', 'piece: S1는 조각', '기각된 시점 기록 S4', '없는 시점 기록 "S9"', '같은 조각의 항목이 둘이다']) {
    assert.ok(msgs.some((m) => m.includes(want)), `${want} — ${msgs.join(' / ')}`);
  }
  assert.deepEqual(r.warnings.map((w) => w.msg), ['모르는 칸 "color" — 쓸 수 있는 칸: code · person · meaning · first · at · basis · reason · session · by · note']);
});

const db = await openDb();
const ctx = await openContext(db);
const rel = releasePlaces(ctx, loadOrder());
test.after(() => db.close());

test('실제 기록 — 모든 시점 기록이 구조화되었고, 문제 · 모순 · 순환이 없다', () => {
  const ds = loadDataset();
  const live = ds.candidates.filter((c) => c.kind === 'time' && c.status !== '기각');
  assert.ok(live.length > 0);
  assert.deepEqual(live.filter((c) => !Array.isArray(c.obj.at)).map((c) => c.id), []);
  const ch = buildChronology(ds, ctx, rel);
  assert.deepEqual(ch.problems, []);
  assert.deepEqual(ch.contradictions, []);
  assert.deepEqual(ch.cycles, []);
  // 병행 줄거리(ch43 · ch44 — 앞 챕터와 같은 무렵)만 메인 번호 순과 다르다
  assert.deepEqual(ch.mainNotes.map((r) => r.node).sort(), ['unit:ch43', 'unit:ch44']);
  assert.equal(ch.rows.length, rel.units.length);
  for (const r of ch.rows) {
    if (r.kind === '메인') assert.deepEqual([r.class, r.via], ['판별', '메인'], r.unit);
    if (r.class === '판별' && r.via === '단위') assert.ok(Number.isFinite(r.lo) && Number.isFinite(r.hi) && r.hi - r.lo <= 2, r.unit);
    if (!r.records) assert.ok(r.class === '불명' || ['단위', '메인', '좁힘'].includes(r.via), `${r.unit}: 기록 없는 단위는 메인이거나 남이 기준으로 삼았거나 좁혔을 때만 자리가 있다`);
    if (r.narrow && r.narrow !== '단서 없음') assert.ok(r.via.includes('좁힘') || r.class !== '불명', `${r.unit}: 좁힘이 있으면 자리가 생긴다`);
  }
  // 좁힘 · 모습 코드 — 근거 · 기준이 모두 있다(검증기와 같은 검사)
  const chron = loadChronology();
  assert.equal(ch.narrows.length, chron.units.length);
  const hasCode = db.prepare('SELECT 1 FROM lines WHERE speaker_id = ? LIMIT 1');
  const cp = chronologyProblems(chron, {
    eras: new Set(chron.eras.map((e) => e.id)), times: new Map(live.map((c) => [c.id, c])),
    resolveKey: (k) => { const x = ctx.resolve(k); return x ? { ...x, scene: x.type === 'scene' } : null; },
    unitOf: (k) => ctx.resolve(k)?.unit?.key ?? null, ids: new Set(ds.candidates.map((c) => c.id).filter(Boolean)), hasCode: (c) => !!hasCode.get(c),
    targets: ctx.targetIds, mains: new Set(rel.units.filter((u) => u.kind === '메인').map((u) => u.unit)), reading: new Set(rel.units.map((u) => u.unit)),
  });
  assert.deepEqual(cp.errors, []);
  // 단서표 — 메인 밖 단위마다 한 줄, 시점 코드는 표에 있는 것만
  const cl = chronoClues({ ctx, rel, ds, codes: chron.codes });
  assert.equal(cl.size, rel.units.filter((u) => u.kind !== '메인').length);
  const codeIds = new Set(chron.codes.map((c) => c.code));
  for (const v of cl.values()) for (const c of v.codes ? v.codes.split('; ') : []) assert.ok(codeIds.has(c.split('(')[0]), c);
  assert.ok(cl.get('event_footstepwalkrun1').codes.includes('rapi_red'));
  // 시대 기준점의 근거 기록은 있는 시점 기록이다
  const ids = new Set(live.map((c) => c.id));
  for (const e of ch.eras) for (const s of e.basis) assert.ok(ids.has(s), `${e.id}: 근거 ${s}`);
});

test('예시 — 기준점을 말하는 기록은 확인만 하고, 고정점에 닿지 않는 관계는 상대다', () => {
  const ch = buildChronology(loadDataset({ dir: EXAMPLE_DIR }), ctx, rel);
  assert.deepEqual(ch.problems, []);
  assert.deepEqual([ch.contradictions, ch.cycles], [[], []]);
  assert.deepEqual([row(ch, 'd_ex_elevator_01').class, row(ch, 'd_ex_elevator_01').place], ['범위', '@갓데스_폴 ~']);
  assert.equal(row(ch, 'sub:로망티스트_01').class, '상대');
  assert.equal(row(ch, 'sub:로망티스트_00').class, '상대');
});
