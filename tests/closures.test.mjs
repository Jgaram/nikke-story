/**
 * X3f-1d 빌드업 마무리 — (가) 긴 회수 · 복선의 답(tools/views/closures.mjs buildupMetrics) · 마무리 기록 O(annotations/closures.json) · 사슬 초안 · 판정 입력 ⑦.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { CLOSURE_TYPES, EXAMPLE_DIR, loadDataset, spineUnits } from '../tools/records/model.mjs';
import { kindOfKey, loadOrder } from '../tools/records/order.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { applyDecision } from '../tools/records/review.mjs';
import { read2Edges } from '../tools/records/read2.mjs';
import { buildRead1Views } from '../tools/views/read1.mjs';
import { layerSignals } from '../tools/views/layers.mjs';
import { spineMetrics } from '../tools/views/spine.mjs';
import { buildClosures, buildupMetrics, closureChains, draftClosure, renderClosuresReport } from '../tools/views/closures.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const { b, v } = buildClosures(ds, ctx, order);
const posOf = new Map();
for (const it of order.items) if (!posOf.has(it.key)) posOf.set(it.key, posOf.size);

test('(가) — 척추 선정 ⓒ와 같은 계산(이벤트 · 사이드마다 긴 회수 · 복선의 답 수가 같다)', () => {
  const sp = spineMetrics(ds, ctx, order);
  for (const u of sp.units) {
    const x = b.byUnit.get(u.unit);
    assert.deepEqual([x?.payoffList.length ?? 0, x?.answerList.length ?? 0], [u.payoffs, u.answers], u.unit);
  }
  // 긴 회수는 제기 뒤 gap칸 이상, 다른 단위 · 복선의 답은 다른 단위의 암시
  for (const [u, x] of b.byUnit) {
    for (const p of x.payoffList) assert.ok(p.gap >= b.gap && p.from !== u, `${u} ${p.root}`);
    for (const a of x.answerList) assert.ok(a.hints.length && a.hints.every((h) => !h.endsWith(`@${u}`)), `${u} ${a.root}`);
  }
  // 척추 표시 — 제기 단위 · 암시 단위가 척추인지
  const spine = spineUnits(ds);
  const isSpine = (u) => kindOfKey(u) === '메인' || spine.has(u);
  for (const x of b.byUnit.values()) {
    for (const p of x.payoffList) assert.equal(p.spine, isSpine(p.from));
    for (const a of x.answerList) assert.equal(a.spineHints, a.hints.filter((h) => isSpine(h.split('@')[1])).length);
  }
  // 칸 수 기본 = 척추 criteria.payoff_gap
  assert.equal(buildupMetrics(ds, ctx, order, { gap: 1000 }).rows.filter((r) => r.type === '긴 회수').length, 0);
});

test('사슬 초안 — 연작은 다음 편이 없는 편, 관계 · 성장은 변화 둘 이상 · 단위 둘 이상, 쌓인 자리는 끝보다 앞', () => {
  assert.ok(v.chains.length > 0);
  const types = new Set(v.chains.map((c) => c.type));
  for (const t of types) assert.ok(CLOSURE_TYPES.includes(t));
  const sequels = ds.candidates.filter((c) => c.kind === 'edge' && c.status === '확정' && c.obj?.type === 'sequel');
  for (const ch of v.chains) {
    assert.ok(ch.built.length, ch.key);
    if (ch.type === '연작') {
      assert.ok(!sequels.some((e) => e.obj.from === ch.end), `${ch.key}: 끝에 다음 편이 있다`);
      for (const u of ch.built) assert.ok(posOf.get(u) < posOf.get(ch.end), `${ch.key}: ${u}`);
    } else {
      assert.ok(ch.records.filter((r) => r.act === '변화').length >= 2 && ch.units.length >= 2, ch.key);
      const byId = new Map(ch.records.map((r) => [r.id, r]));
      for (const id of ch.built) assert.ok(posOf.get(byId.get(id).unit) < posOf.get(ch.end), `${ch.key}: ${id}`);
      for (const id of ch.closing) assert.equal(byId.get(id).unit, ch.end);
    }
  }
  // 관계는 양쪽 방향을 한 쌍으로 — 키가 겹치지 않는다
  assert.equal(new Set(v.chains.map((c) => c.key)).size, v.chains.length);
  // 네온의 신념은 ch02에서 쌓여 호감도 char:18에서 끝난다(척추가 쌓음, 끝은 척추 밖)
  const neon = v.chains.find((c) => c.key === '성장 person:네온 신념');
  assert.deepEqual([neon.end, neon.spineBuilt, neon.endSpine], ['char:18', true, false]);
});

test('마무리 기록 — 사슬마다 기록 하나, 검증기 오류 0, 초안 모양', () => {
  assert.equal(v.missing.length, 0, '기록 없는 사슬 — records.mjs closures --add');
  assert.ok(v.closures.every((x) => /^O\d+$/.test(x.c.id) && CLOSURE_TYPES.includes(x.type)));
  const res = checkDataset(ds, ctx, order);
  assert.deepEqual(res.errors.filter((e) => /closures/.test(e.file)), []);
  const ch = v.chains[0];
  const d = draftClosure(ch, 'O999');
  assert.deepEqual([d.id, d.type, d.chain, d.end, d.status], ['O999', ch.type, ch.key, ch.end, '후보']);
  assert.match(d.text, /^\(초안\)/);
  assert.match(renderClosuresReport(b, v), /^# 빌드업 마무리/);
});

test('set — 마무리 기록의 --type · --end · --closing · --built · --text, 다른 종류에는 막는다', () => {
  const o = ds.candidates.find((c) => c.kind === 'closure' && c.obj?.type === '관계');
  const r = applyDecision([o], '확정', { by: 'claude', date: '2026-10-09', session: 'X3f-1d', type: '갈등', text: '둘의 대립이 끝난다', closing: o.obj.closing.join(' '), built: o.obj.built.join(' ') });
  const val = r.perFile.get(o.file).changes[0].value;
  assert.deepEqual([val.type, val.text, val.status], ['갈등', '둘의 대립이 끝난다', '확정']);
  assert.match(val.reviews.at(-1).before, /종류 관계/);
  assert.throws(() => applyDecision([o], '확정', { type: '우정' }), /--type/);
  const k = ds.candidates.find((c) => c.kind === 'layer');
  assert.throws(() => applyDecision([k], '확정', { end: 'ch20' }), /마무리 기록/);
});

test('판정 입력 ⑦ — 척추 밖 단위에만, 척추가 쌓은 것만', () => {
  const views = buildRead1Views(ds, ctx, order);
  const sig = layerSignals(ds, views, read2Edges(ds, ctx, order), { closures: { b, v } });
  const spine = spineUnits(ds);
  for (const [u, s] of sig) {
    if (kindOfKey(u) === '메인' || spine.has(u)) {
      assert.equal(s.buildup.closures.length + s.buildup.payoffs.length + s.buildup.answers.length, 0, u);
      continue;
    }
    assert.ok(s.buildup.payoffs.every((p) => p.spine) && s.buildup.answers.every((a) => a.spineHints > 0), u);
  }
  const neon = sig.get('char:18').buildup.closures.find((x) => x.type === '성장');
  assert.ok(neon && neon.built.includes('ch02'));
  // closures 옵션이 없으면 ⑦은 비어 있다(척추 선정 계산 · B0b-2와 같다)
  const bare = layerSignals(ds, views, null);
  assert.ok([...bare.values()].every((s) => !s.buildup.closures.length && !s.buildup.payoffs.length));
});

test('예시 — tests/fixtures/read1/_closures.json(확정 연작 · 기각 성장 · 합류)', () => {
  const ex = loadDataset({ dir: EXAMPLE_DIR });
  const res = checkDataset(ex, ctx, order);
  assert.deepEqual(res.errors, []);
  const xs = ex.candidates.filter((c) => c.kind === 'closure');
  assert.deepEqual(xs.map((c) => [c.id, c.act, c.status]), [['O1', '연작', '확정'], ['O2', '성장', '기각'], ['O3', '관계', '확정']]);
  const ev = closureChains(ex, ctx, order);
  assert.deepEqual(ev.chains.map((c) => [c.key, c.closure?.id]), [['연작 sub:로망티스트_01', 'O1']]);
  assert.deepEqual(ev.merges.map((m) => [m.c.id, m.end, m.members, m.types]), [['H1', 'sub:로망티스트_01', ['O1', 'O3'], ['연작', '관계']]]);
  assert.deepEqual([...ev.mergeOf], [['O1', ['H1']], ['O3', ['H1']]]);
  // 검증기 — 끝이 다른 것 · 기각된 것 · 하나뿐인 묶음은 오류
  const h = ex.candidates.find((c) => c.id === 'H1');
  for (const [members, re] of [[['O1', 'O2'], /기각된 O2/], [['O1'], /둘 이상/], [['O1', 'O9'], /없는 마무리/]]) {
    h.obj = { ...h.obj, members };
    assert.ok(checkDataset(ex, ctx, order).errors.some((e) => e.id === 'H1' && re.test(e.msg)), String(members));
  }
  const o3 = ex.candidates.find((c) => c.id === 'O3');
  o3.obj = { ...o3.obj, end: 'sub:로망티스트_00' };
  h.obj = { ...h.obj, members: ['O1', 'O3'] };
  assert.ok(checkDataset(ex, ctx, order).errors.some((e) => e.id === 'H1' && /끝\(sub:로망티스트_00\)/.test(e.msg)));
});

test('합류 기록 — 한 결판에서 함께 끝난 확정 마무리를 묶고, 판정 입력 ⑦은 그대로', () => {
  const live = v.merges.filter((m) => m.c.status !== '기각');
  assert.ok(live.length > 0);
  const byId = new Map(v.closures.map((x) => [x.c.id, x]));
  for (const m of live) {
    assert.ok(m.members.length >= 2 && m.title, m.c.id);
    for (const id of m.members) assert.equal(byId.get(id).end, m.end, `${m.c.id} ${id}`);
    for (const id of m.members) assert.ok(v.mergeOf.get(id).includes(m.c.id));
  }
  // 한 마무리는 한 합류에만
  assert.ok([...v.mergeOf.values()].every((hs) => hs.length === 1));
  // STAR ANIS · BITTER SPICE — 같은 닫는 기록을 나눠 쓰는 셋의 관계가 한 합류로
  for (const [a, b2] of [['O67', 'O68'], ['O80', 'O82']]) assert.deepEqual(v.mergeOf.get(a), v.mergeOf.get(b2));
  // 묶어도 낱낱의 마무리(⑦의 입력)는 같다
  const bare = { ...ds, candidates: ds.candidates.filter((c) => c.kind !== 'merge') };
  const v0 = closureChains(bare, ctx, order);
  assert.deepEqual(v0.closures.map((x) => [x.c.id, x.end, x.spineBuilt]), v.closures.map((x) => [x.c.id, x.end, x.spineBuilt]));
  assert.equal(v0.merges.length, 0);
  assert.match(renderClosuresReport(b, v), /## 합류 — 한 결판에서 함께 끝난 마무리/);
});

test('set — 합류의 --members · --title · --end, 마무리의 --about, 다른 종류에는 막는다', () => {
  const h = ds.candidates.find((c) => c.kind === 'merge');
  const o = ds.candidates.find((c) => c.kind === 'closure' && c.obj?.type === '관계');
  const r = applyDecision([h], '확정', { by: 'claude', date: '2026-10-09', session: 'X3f-1g', members: h.obj.members.slice(0, 2).join(' '), title: '새 이름' });
  const val = r.perFile.get(h.file).changes[0].value;
  assert.deepEqual([val.title, val.members], ['새 이름', h.obj.members.slice(0, 2)]);
  assert.deepEqual(Object.keys(val).slice(0, 4), ['id', 'title', 'end', 'members']);
  const r2 = applyDecision([o], '확정', { by: 'claude', date: '2026-10-09', about: [...o.obj.about, 'person:라피'].join(' ') });
  assert.deepEqual(r2.perFile.get(o.file).changes[0].value.about, [...o.obj.about, 'person:라피']);
  assert.throws(() => applyDecision([o], '확정', { members: 'O1 O2' }), /합류 기록/);
  assert.throws(() => applyDecision([h], '확정', { about: 'person:라피' }), /마무리 기록/);
});
