/**
 * X1a 공개 축(tools/views/reveal.mjs · events.mjs · timeline.mjs) — 공개 자리 · 진실 공개 단계 · 컷오프 · 이벤트 메타데이터.
 * 예시 기록(tests/fixtures/read1 · read2)으로 규칙을, 실제 기록 · 데이터로 문제가 없는지를 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, loadDataset } from '../tools/records/model.mjs';
import { kindOfKey, loadOrder } from '../tools/records/order.mjs';
import { archiveEvents } from '../tools/views/events.mjs';
import { knownAt, releasePlaces, revealStages } from '../tools/views/reveal.mjs';
import { buildTimelineViews, renderTimelineReport } from '../tools/views/timeline.mjs';

const db = await openDb();
const ctx = await openContext(db);
const order = loadOrder();
const rel = releasePlaces(ctx, order);
test.after(() => db.close());

test('공개 자리 — 같은 날 = 같은 자리, 같은 날 메인 챕터는 차례로, 공개일 없는 단위는 앞 공개 단위에 딸린다', () => {
  assert.deepEqual(rel.problems, []);
  assert.equal(rel.units.length, new Set(order.items.map((it) => it.key)).size);
  // 출시 첫날 CH.00–16은 챕터마다 한 자리, 그날 호감도 스토리는 마지막 챕터(ch16) 자리
  const launch = rel.ticks.filter((t) => t.date === rel.ticks[0].date);
  assert.deepEqual(launch.map((t) => t.main), Array.from({ length: 17 }, (_, i) => `ch${String(i).padStart(2, '0')}`));
  assert.ok(rel.units.filter((u) => u.kind === '호감도' && u.date === rel.ticks[0].date).every((u) => u.tick === 17));
  for (let i = 1; i < rel.units.length; i++) {
    const [a, b] = [rel.units[i - 1], rel.units[i]];
    assert.ok(b.tick === a.tick || b.tick === a.tick + 1, `${b.unit}: 자리는 하나씩만 오른다`);
    assert.ok(b.date >= a.date, `${b.unit}: 공개일은 읽는 순서로 줄지 않는다`);
    // 자리가 오르면 날짜가 바뀌거나 메인 챕터다. 날짜가 바뀌면 자리가 오른다
    if (b.tick > a.tick) assert.ok(b.date !== a.date || b.kind === '메인', `${b.unit}: 같은 날인데 자리가 올랐다`);
    if (b.date !== a.date) assert.ok(b.tick > a.tick);
  }
  // 딸린 단위는 서브퀘스트 · 유실물 · 엘리베이터뿐이고, 물려받은 단위는 공개일이 있다
  const attached = rel.units.filter((u) => u.via === '딸림');
  assert.deepEqual([...new Set(attached.map((u) => u.kind))].sort(), ['그 밖', '서브퀘스트', '유실물']);
  assert.ok(attached.every((u) => rel.byUnit.get(u.from)?.via === '공개일' && rel.byUnit.get(u.from).tick === u.tick));
  // 본문 없는 블라링크 이벤트를 대신하는 금서고 단위도 공개일이 있다
  assert.equal(rel.byUnit.get('fl:for_rest').via, '공개일');
});

test('예시 — 단계: 암시 · 처음 밝혀짐 · 재언급 / 제기 · 일부 회수 · 회수, 기각은 뺀다', () => {
  const st = revealStages(loadDataset({ dir: EXAMPLE_DIR }), ctx, order, rel);
  assert.deepEqual(st.problems, []);
  assert.deepEqual(st.rows.map((r) => `${r.root} ${r.record} ${r.stage} ${r.rel}`), [
    'F1 F1 처음 밝혀짐 동시',
    'F2 F2 처음 밝혀짐 동시',
    'F2 E3 재언급 뒤', // F2-2 뒤집음은 기각 — 줄이 없다
    'F3 F3 처음 밝혀짐 동시',
    'F4 E2 암시 앞',
    'F4 F4 처음 밝혀짐 동시',
    'F5 F5 처음 밝혀짐 동시',
    'F6 F6 처음 밝혀짐 동시',
    'F7 F7 처음 밝혀짐 동시',
    'Q1 Q1 제기 동시',
    'Q1 Q1-2 회수 뒤',
    'Q2 Q2 제기 동시',
    'Q2 Q2-2 회수 동시',
    'Q3 E1 암시 동시',
    'Q3 Q3 제기 동시',
    'Q3 Q3-2 일부 회수 동시',
    'Q4 Q4 제기 동시',
  ]);
  const r = (id) => st.byRoot.get(id);
  assert.equal(`${r('F4').hints_before} ${r('F4').hint_tick < r('F4').first_tick}`, '1 true');
  assert.deepEqual(['Q1', 'Q2', 'Q3', 'Q4'].map((id) => r(id).state), ['풀림', '풀림', '일부', '열림']);
  // 컷오프 — 로망티스트_00(자리 26)까지: F1 · F2를 알고 F4는 암시만, Q1은 열림
  const T = rel.byUnit.get('sub:로망티스트_00').tick;
  const k = knownAt(st, T);
  assert.deepEqual(k.facts.known.map((x) => x.id), ['F1', 'F2', 'F5', 'F6', 'F7']);
  assert.deepEqual(k.facts.hinted.map((x) => x.id), ['F4']);
  assert.deepEqual([k.questions.open, k.questions.partial, k.questions.solved].map((xs) => xs.map((x) => x.id).join(' ')), ['Q1', 'Q3', '']);
  assert.equal(k.facts.hidden + k.questions.hidden, 3); // F3 · Q2 · Q4
  const end = knownAt(st, rel.ticks.length);
  assert.deepEqual(end.questions.solved.map((x) => x.id), ['Q1', 'Q2']);
  assert.deepEqual(knownAt(st, T, { thread: 'J1' }).questions.open.map((x) => x.id), ['Q1']);
});

test('실제 기록 — 문제 없음, 사실마다 처음 밝혀짐 · 의문마다 제기 하나 이상, 기록 수가 맞는다, 컷오프는 자리를 따라 늘기만 한다', () => {
  const ds = loadDataset();
  const st = revealStages(ds, ctx, order, rel);
  assert.deepEqual(st.problems, []);
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const factDefs = live.filter((c) => c.kind === 'fact' && c.role === 'def' && !c.read2);
  const qDefs = live.filter((c) => c.kind === 'question' && c.role === 'def' && !c.read2);
  assert.equal(st.roots.filter((r) => r.kind === '사실').length, factDefs.length);
  assert.equal(st.roots.filter((r) => r.kind === '의문').length, qDefs.length);
  assert.ok(st.roots.every((r) => r.first_tick !== ''));
  const reversals = live.filter((c) => c.role === 'event' && c.act === '뒤집음').length;
  assert.equal(st.rows.filter((r) => r.stage === '뒤집힘').length, reversals);
  const events = live.filter((c) => c.role === 'event' && ['fact', 'question'].includes(c.kind)).length;
  assert.equal(st.rows.filter((r) => !['암시', '재언급'].includes(r.stage)).length, factDefs.length + qDefs.length + events);
  // 암시는 사실이 처음 밝혀진 자리보다 뒤일 수 없다 — 뒤라면 뒤 드러냄(F<n>-k)을 가리킨 것
  for (const r of st.rows.filter((x) => x.kind === '사실' && x.stage === '암시' && x.rel === '뒤')) assert.match(r.point, /-\d+$/, r.record);
  let prev = null;
  for (const t of [1, 17, 40, 80, 120, rel.ticks.length]) {
    const k = knownAt(st, t);
    const n = [k.facts.known.length + k.facts.reversed.length, k.questions.solved.length, k.facts.hidden];
    if (prev) assert.ok(n[0] >= prev[0] && n[1] >= prev[1] && n[2] <= prev[2], `자리 ${t}`);
    prev = n;
  }
});

test('이벤트 메타데이터 (T1-5) — 읽기 순서의 이벤트마다 한 줄, 아카이브 씬 배열 = DB 아카이브 씬', () => {
  const { events, scenes } = archiveEvents(ctx, rel.byUnit);
  const reading = rel.units.filter((u) => kindOfKey(u.unit) === '이벤트').map((u) => u.unit).sort();
  assert.deepEqual(events.map((e) => e.unit).sort(), reading);
  assert.equal(scenes.length, db.prepare("SELECT COUNT(*) n FROM stories WHERE source = 'archive'").get().n);
  assert.ok(events.every((e) => e.order && e.tick && e.date));
  assert.ok(events.filter((e) => e.source === '아카이브').every((e) => e.scenes === scenes.filter((s) => s.unit === (e.substitute || e.unit)).length));
  assert.deepEqual(events.filter((e) => e.substitute).map((e) => `${e.substitute}>${e.unit}`).sort(), ['event_boomtheghost1>fl:boom_the_ghost', 'event_forrest>fl:for_rest']);
  // 파트는 STORY · STORY I · STORY II(특별 이벤트는 이름 없음), 씬 순서는 1부터 빈틈없이
  assert.deepEqual([...new Set(scenes.map((s) => s.part))].sort(), ['', 'STORY', 'STORY I', 'STORY II']);
  for (const e of events.filter((x) => x.source === '아카이브')) {
    const seqs = scenes.filter((s) => s.unit === (e.substitute || e.unit)).map((s) => s.seq);
    assert.deepEqual(seqs, seqs.map((_, i) => i + 1), e.unit);
  }
});

test('시안 — 같은 기록이면 같은 보고서', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const a = renderTimelineReport(buildTimelineViews(ds, ctx, order), { source: 'x' });
  const b = renderTimelineReport(buildTimelineViews(ds, ctx, order), { source: 'x' });
  assert.equal(a, b);
  assert.match(a, /## 문제\n\n없음\./);
});
