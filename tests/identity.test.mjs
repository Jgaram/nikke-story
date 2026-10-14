/**
 * 인물 = 실제 한 사람(W24a, 결정 #12) — 정체 연결 L은 같은 인물(same_as) · 다른 인물(split) 둘.
 * 검사기 · 실제 기록(L32 슈엔 · L33 한슨 = 머스탱 · L34 잉크 · L36 아버지 머스탱) · 집계(범위 줄을 실제 사람에) · 인계 ·
 * 기록은 그 장면에서 보인 이름으로(드러난 뒤에만 다른 인물 줄 근거의 b를 a로 — splitHits · actualDataset) · 화면 함수 · 내보낸 데이터.
 *
 *   node --test tests/identity.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { EXAMPLE_DIR, loadDataset, sameAsGroups, splits } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { identityRules, sourceTargets, splitWatch } from '../tools/records/focus.mjs';
import { actualDataset, familiarNames, homonymLabels, lineOwners, revealedPeople, splitHits, splitUnits } from '../tools/records/identity.mjs';
import { buildPersons, personScenes } from '../tools/views/persons.mjs';
import * as fmt from '../site/lib/format.js';
import { impKnown, recAt, recHas, rowAt } from '../site/lib/format.js';
import { scenePlaces } from '../tools/records/read2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const places = scenePlaces(order, ctx);
const sps = splitUnits(ds, db, places.unitOf);
const L = (id) => sps.find((x) => x.id === id);
const people = ds.candidates.filter((c) => c.people).map((c) => c.obj);
const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
const F = 'person:머스탱_한슨의_아버지';

test('검사기 — 다른 인물(split)은 인물끼리 · 다른 둘 · spans · 근거가 있어야 한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idt-'));
  const file = path.join(dir, '_people.json');
  const base = { status: '후보', confidence: '확실', reason: '시험', by: 'claude', evidence: [{ scene: 'd_main_09_06_s', lines: [22] }] };
  fs.writeFileSync(file, JSON.stringify({ candidates: [
    { id: 'L901', type: 'split', a: '이름표:???', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], ...base },
    { id: 'L902', type: 'split', a: 'person:시프티', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], ...base },
    { id: 'L903', type: 'split', a: 'person:슈엔', b: 'person:시프티', ...base },
    { id: 'L904', type: 'split', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_99' }, { scene: 'd_main_08_01', lines: [999] }], ...base },
    { id: 'L905', type: 'split', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_03', lines: [1] }], ...base },
    { id: 'L906', type: '사칭', a: 'person:슈엔', b: 'person:시프티', ...base },
    { id: 'L907', type: 'same_as', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], ...base },
    { id: 'L908', type: 'split', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], status: '후보', confidence: '확실', reason: '시험', by: 'claude' },
    { id: 'L909', type: 'impersonates', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], ...base },
  ] }));
  const { errors, warnings } = checkDataset(loadDataset({ dir: EXAMPLE_DIR, people: file }), ctx, order);
  fs.rmSync(dir, { recursive: true, force: true });
  const err = (id, re) => assert.ok(errors.some((e) => e.id === id && re.test(e.msg)), `${id} ${re}\n${errors.map((e) => `${e.id} ${e.msg}`).join('\n')}`);
  const warn = (id, re) => assert.ok(warnings.some((e) => e.id === id && re.test(e.msg)), `${id} ${re} 경고`);
  err('L901', /사전의 인물 ID/);
  err('L902', /같은 인물이다/);
  err('L903', /spans가 없다/);
  err('L904', /없는 씬 d_main_08_99/);
  err('L904', /없는 줄 d_main_08_01#999/);
  warn('L905', /옮길 줄이 없다/); // 08_03 #1에는 시프티가 없다
  err('L906', /type "사칭"/);
  warn('L907', /spans는 다른 인물\(type split\)에만/);
  err('L908', /evidence/);
  err('L909', /type "impersonates"/); // 옛 형식(W23)은 쓰지 않는다
});

test('실제 기록 — L32 · L34 다른 인물, L33 같은 인물 한슨 = 머스탱, L36 아버지 머스탱 ≠ 지금의 머스탱', () => {
  assert.deepEqual([L('L32').a, L('L32').b, L('L32').revealed, L('L32').status], ['person:슈엔', 'person:시프티', 'ch09', '확정']);
  assert.ok(L('L32').spans.some((s) => s.scene === 'd_main_09_06_s' && s.seqs.has(21) && !s.seqs.has(22)), '드러나기 전 줄만');
  assert.deepEqual([L('L34').a, L('L34').b, L('L34').revealed], ['person:잉크', 'person:클로이', 'event_icedragonsaga1']);
  assert.deepEqual([L('L36').a, L('L36').b, L('L36').revealed, L('L36').status], [F, 'person:머스탱', 'event_staranis1', '확정']);
  assert.ok(L('L36').inSpan('side:pretty_star_05', 9) && L('L36').inSpan('event_staranis2_05_s', 119) && !L('L36').inSpan('event_staranis2_05_s', 144), '자리를 넘기기 전까지만 아버지');
  assert.ok(!L('L36').spanUnits.has('ch04'), 'CH.04의 사장 머스탱은 지금의 머스탱(한슨)');
  const l33 = byId.get('L33').obj;
  assert.deepEqual([l33.type, l33.a, l33.b], ['same_as', 'person:한슨', 'person:머스탱']);
  assert.ok(sameAsGroups(ds).get('person:머스탱').includes('person:한슨'));
  assert.deepEqual(splits(ds).map((x) => x.id), ['L32', 'L34', 'L36']);
  // 아버지는 손으로 세운 인물 — 표준명은 같고(동명이인 — 화면은 ID 구분어) 검색 이름이 없다(이름 줄은 머스탱에게 잡히고 L36이 가른다)
  const t = ctx.db.prepare('SELECT name, kind FROM targets WHERE id = ?').get(F);
  assert.deepEqual({ ...t }, { name: '머스탱', kind: '인물' });
  assert.equal(ctx.db.prepare('SELECT COUNT(*) n FROM target_names WHERE target_id = ?').get(F).n, 0);
});

test('집계 — 범위 줄의 이름 주인 줄은 실제 사람에, 옮기기 전 모습(pre)을 남긴다', () => {
  const ps = personScenes(ctx, ds);
  for (const imp of splits(ds)) {
    for (const sp of imp.spans) {
      const bx = ps.get(imp.b)?.get(sp.scene);
      if (!bx?.pre) continue; // 기록 근거를 덮으려고 씬 전체로 잡은 회상 씬에는 b 줄이 없을 수 있다
      const ax = ps.get(imp.a)?.get(sp.scene);
      const inSpan = (n) => !sp.seqs || sp.seqs.has(n);
      assert.ok(![...bx.all].some(inSpan), `${imp.id} ${sp.scene}: 범위 안 ${imp.b} 줄이 남았다`);
      assert.ok(ax && [...bx.pre.all].filter(inSpan).every((n) => ax.all.has(n)), `${imp.id} ${sp.scene}: 실제 사람에 옮겼다`);
      assert.ok(ax.imp.has(imp.id) && bx.imp.has(imp.id));
    }
  }
  assert.ok(ps.get(F).get('side:pretty_star_05').speak.size > 0, 'PRETTY STAR의 사장 머스탱 줄은 아버지');
  assert.ok(ps.get('person:머스탱').get('d_main_04af_08').all.size > 0, 'CH.04의 머스탱은 머스탱(= 한슨) 그대로');
  const v = buildPersons(ds, ctx, order);
  const row = (p, u) => v.personUnits.find((r) => r.person === p && r.unit === u);
  assert.deepEqual([row('person:시프티', 'ch08').scenes, row('person:시프티', 'ch08').pre_scenes, row('person:시프티', 'ch08').imp], [0, 5, 'L32']);
  assert.deepEqual([row('person:슈엔', 'ch08').scenes, row('person:슈엔', 'ch08').pre_scenes], [5, 0]);
  for (const id of ['person:슈엔', 'person:시프티']) assert.equal(v.persons.find((p) => p.target === id).split, 'L32');
  assert.ok(v.personUnits.filter((r) => !r.imp).every((r) => r.pre_scenes === undefined));
});

test('인계 — focus는 범위 줄의 b를 a로 센다, 다른 인물 볼 줄은 이름 주인 줄 수 · 범위 안 수', () => {
  const id = identityRules(ctx, people);
  assert.ok(id.swap.get('d_main_08_01')?.some((x) => x.a === 'person:슈엔' && x.b === 'person:시프티'));
  const hits = sourceTargets(ctx, ['ch08'], { identity: true, links: people });
  assert.equal(hits.get('person:시프티'), undefined, 'ch08의 시프티 이름표 · 부름은 모두 슈엔');
  assert.ok(hits.get('person:슈엔') > 0);
  const [w] = splitWatch(ctx, ['ch08'], people);
  assert.equal(w.id, 'L32');
  assert.equal(w.inSpan, w.total);
  const [w2] = splitWatch(ctx, ['ch10'], people);
  assert.ok(w2 && w2.inSpan === 0 && w2.total > 0, 'ch10의 시프티는 범위 밖(진짜 시프티)');
  const ps = sourceTargets(ctx, ['side:pretty_star'], { identity: true, links: people });
  assert.ok(ps.get(F) > 0, '회상의 머스탱은 아버지');
  // 계산이 줄을 셀 때 — 범위 줄의 주인
  const own = lineOwners(sps);
  assert.equal(own.owner('side:pretty_star_05', 9, 'person:머스탱'), F);
  assert.equal(own.owner('d_main_04af_08', 3, 'person:머스탱'), 'person:머스탱');
  assert.ok(own.movedOut('d_main_08_01', 'person:시프티') && !own.movedOut('d_main_10_01', 'person:시프티'));
});

test('기록 — 그 장면에서 보인 이름으로 적는다, 드러난 뒤에만 다른 인물 줄 근거의 b를 a로', () => {
  assert.deepEqual(byId.get('F94').obj.about.filter((x) => x.startsWith('person:')), ['person:머스탱'], 'CH.04 사장 소개는 그 장면 이름 머스탱');
  assert.ok(byId.get('F234').obj.about.includes('person:시프티'), 'CH.08 오퍼레이터는 그 장면 이름 시프티');
  assert.ok(byId.get('Q291').obj.about.includes('person:머스탱'), "'당시의 머스탱'도 그 장면 이름");
  assert.deepEqual(splitHits(byId.get('F94'), sps), [], '지금의 머스탱 — 다른 인물 줄이 아니다');
  assert.deepEqual(splitHits(byId.get('F234'), sps).map((h) => [h.a, h.b, h.rev, h.all]), [['person:슈엔', 'person:시프티', 'ch09', true]]);
  assert.deepEqual(splitHits(byId.get('Q291'), sps).map((h) => [h.a, h.rev, h.all]), [[F, 'event_staranis1', true]], '근거의 머스탱 줄(#103)이 아버지 줄');
  const mixed = splitHits(byId.get('F2200'), sps);
  assert.ok(mixed.length === 1 && !mixed[0].all, '근거에 지금의 머스탱 줄과 아버지 줄이 함께 있으면 둘 다');
  assert.deepEqual(revealedPeople(byId.get('F2200').obj, mixed).about.filter((x) => x.startsWith('person:머스탱')).sort(), [F, 'person:머스탱'].sort());
  assert.equal(revealedPeople({ person: 'person:머스탱' }, mixed).person, 'person:머스탱', '한 사람 칸은 둘 다면 그대로');
  // 계산은 실제 사람으로(actualDataset) — 원본은 그대로
  const act = actualDataset(ds, ctx, order);
  assert.ok(act.candidates.find((c) => c.id === 'Q291').obj.about.includes(F));
  assert.ok(act.candidates.find((c) => c.id === 'F234').obj.about.includes('person:슈엔'));
  assert.equal(act.candidates.find((c) => c.id === 'F94'), byId.get('F94'), '걸리지 않은 기록은 그대로');
  assert.ok(byId.get('Q291').obj.about.includes('person:머스탱'), '원본은 그대로');
  assert.equal(actualDataset(ds, ctx, order), act, '같은 ds면 한 번만');
});

test('검사기 — 실제 기록은 조용하고, 드러나기 전 단위에 다른 이름 · 실제 사람으로 적으면 경고', () => {
  const real = checkDataset(ds, ctx, order);
  assert.deepEqual(real.errors, []);
  const mine = (r) => r.warnings.filter((w) => /그 장면에서 보인 이름|정체가 샌다/.test(w.msg));
  assert.deepEqual(mine(real), []);
  const swap = (id, from, to) => ({ ...ds, candidates: ds.candidates.map((c) => (c.id === id ? { ...c, obj: { ...c.obj, about: c.obj.about.map((x) => (x === from ? to : x)) } } : c)) });
  const w1 = mine(checkDataset(swap('F94', 'person:머스탱', 'person:한슨'), ctx, order));
  assert.ok(w1.some((w) => w.id === 'F94' && /같은 사람 person:머스탱로 나온다/.test(w.msg)), w1.map((w) => w.msg).join('\n'));
  const w2 = mine(checkDataset(swap('F234', 'person:시프티', 'person:슈엔'), ctx, order));
  assert.ok(w2.some((w) => w.id === 'F234' && /person:시프티의 이름으로만 나온다/.test(w.msg)), w2.map((w) => w.msg).join('\n'));
  const w3 = mine(checkDataset(swap('Q291', 'person:머스탱', F), ctx, order));
  assert.ok(w3.some((w) => w.id === 'Q291' && /이름으로만|정체가 샌다/.test(w.msg)), w3.map((w) => w.msg).join('\n'));
});

test('화면 — fmt.rowAt: 드러나기 전에는 pre(상대 없이), 뒤 · 전부 보기에는 옮긴 모습(실제 사람은 hid 풂)', () => {
  const R = (seen, all = false) => ({ all, seen: (u) => seen.includes(u) });
  const a = { unit: 'ch08', scenes: 5, lines: 51, speaker: 47, hid: 1, rev: 'ch09', as: ['person:시프티'], pre: { scenes: 0, lines: 0 } };
  const b = { unit: 'ch08', scenes: 0, lines: 0, rev: 'ch09', by: ['person:슈엔'], pre: { scenes: 5, lines: 51, speaker: 47, first_scene: 'd_main_08_01' } };
  const plain = { unit: 'ch01', scenes: 3, lines: 9 };
  assert.equal(rowAt(plain, R([])), plain);
  assert.deepEqual([rowAt(a, R(['ch08'])).scenes, rowAt(a, R(['ch08'])).speaker, rowAt(a, R(['ch08'])).as], [0, undefined, undefined]);
  assert.deepEqual([rowAt(b, R(['ch08'])).scenes, rowAt(b, R(['ch08'])).speaker, rowAt(b, R(['ch08'])).by], [5, 47, undefined]);
  assert.deepEqual([rowAt(a, R(['ch08', 'ch09'])).scenes, rowAt(a, R(['ch08', 'ch09'])).hid], [5, undefined]);
  assert.equal(rowAt(a, R([], true)).scenes, 5);
  assert.ok(impKnown({ rev: 'ch09' }, R(['ch09'])) && !impKnown({ rev: 'ch09' }, R(['ch08'])));
});

test('화면 — fmt.recAt · recHas: 기록은 드러난 뒤 모습으로 내보내고, 드러나기 전에는 a 자리에 b', () => {
  const r = { id: 'Q291', about: [F, 'org:테트라'], imp: [{ a: F, b: 'person:머스탱', rev: 'event_staranis1' }] };
  const before = { all: false, seen: (k) => k !== 'event_staranis1' };
  const after = { all: false, seen: () => true };
  assert.deepEqual(recAt(r, before).about, ['person:머스탱', 'org:테트라']);
  assert.equal(recAt(r, after), r);
  assert.ok(recHas(r, 'person:머스탱', before) && !recHas(r, F, before));
  assert.ok(recHas(r, F, after) && !recHas(r, 'person:머스탱', after));
  const both = { id: 'F2200', about: ['person:머스탱', F], imp: [{ a: F, b: 'person:머스탱', rev: 'event_staranis1' }] };
  assert.deepEqual(recAt(both, before).about, ['person:머스탱'], '둘 다인 기록은 드러나기 전에는 하나');
  assert.ok(recHas(both, 'person:머스탱', after) && recHas(both, F, after));
});

test('동명이인은 ID 구분어로 화면 이름을 가른다(같은 종류끼리, <종류>:<이름>은 그대로)', () => {
  const got = homonymLabels([
    { id: 'person:사쿠라', type: 'person', name: '사쿠라' },
    { id: 'person:사쿠라_콜라보', type: 'person', name: '사쿠라' },
    { id: 'person:스노우_화이트', type: 'person', name: '스노우 화이트' },
    { id: 'person:스노우_화이트_2', type: 'person', name: '스노우 화이트' },
    { id: 'place:에덴', type: 'place', name: '에덴' },
    { id: 'org:에덴', type: 'org', name: '에덴' },
    { id: 'person:x1', type: 'person', name: '홍' },
    { id: 'person:x2', type: 'person', name: '홍' },
  ]);
  assert.deepEqual(Object.fromEntries(got), { 'person:사쿠라_콜라보': '사쿠라 (콜라보)', 'person:스노우_화이트_2': '스노우 화이트 (2)', 'person:x1': '홍 (x1)', 'person:x2': '홍 (x2)' });
  fmt.use({ targets: new Map([[F, { id: F, type: 'person', name: '머스탱', label: '머스탱 (한슨의 아버지)' }]]) });
  assert.equal(fmt.targetName(F), '머스탱 (한슨의 아버지)');
});

test('소속 — 다른 인물 줄을 근거로 한 소속(imp)은 드러나기 전 이름 주인 쪽, 뒤에는 실제 사람 쪽에만', () => {
  const R = (seen, t = 150) => ({ all: false, t, seen: (u) => seen.includes(u), seenAny: (us) => us.some((u) => seen.includes(u)) });
  const t140 = { id: 'T140', org: 'org:테트라', act: '소속', role: 'CEO', tick: 142, unit: 'side:pretty_star' };
  const imp = (side) => ({ rev: 'event_staranis1', rev_tick: 144, side });
  fmt.use({ targets: new Map([['org:테트라', { id: 'org:테트라', type: 'org', name: '테트라', kind: '기업' }]]) });
  const b = { id: 'person:머스탱', affs: [{ ...t140, imp: imp('b') }] };
  const a = { id: F, affs: [{ ...t140, imp: imp('a') }] };
  const has = (p, x) => fmt.orgsAt(p, x).some((o) => o.org === 'org:테트라');
  assert.deepEqual([has(b, R(['side:pretty_star'])), has(a, R(['side:pretty_star']))], [true, false]);
  assert.deepEqual([has(b, R(['side:pretty_star', 'event_staranis1'])), has(a, R(['side:pretty_star', 'event_staranis1']))], [false, true]);
});

test('내보낸 데이터 — 같은 인물 한슨 = 머스탱, 아버지는 드러난 뒤에 따로, 기록 · 소속 · 인물 표', { skip: !fs.existsSync(path.join(ROOT, 'site/data/targets.json')) }, () => {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
  const T = new Map(read('targets.json').map((t) => [t.id, t]));
  const sameAt = (id, other) => T.get(id).same_as_unit?.[T.get(id).same_as?.indexOf(other)];
  assert.equal(sameAt('person:머스탱', 'person:한슨'), 'event_staranis1', '라피 = 피라처럼 드러나면 같은 인물');
  assert.equal(T.get(F).label, '머스탱 (한슨의 아버지)');
  assert.deepEqual(T.get(F).meet, ['event_staranis1'], '아버지는 드러나는 스토리부터 따로 나온다');
  assert.equal(T.get(F).affs.find((x) => x.id === 'T140')?.imp?.side, 'a');
  assert.equal(T.get('person:머스탱').affs.find((x) => x.id === 'T140')?.imp?.side, 'b');
  assert.ok(T.get('person:머스탱').affs.some((x) => x.id === 'T6' && !x.imp), 'CH.04의 테트라 CEO는 머스탱(= 한슨) 그대로');
  assert.ok(Object.values(T.get('person:머스탱')).every((v) => v !== undefined) && !('real_of' in T.get(F)), '옛 이름 승계(real_of)는 없다');
  const recs = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
  assert.deepEqual(recs.get('Q291').imp, [{ a: F, b: 'person:머스탱', rev: 'event_staranis1' }]);
  assert.ok(recs.get('Q291').about.includes(F) && !recs.get('Q291').about.includes('person:머스탱'), '기록 칸은 드러난 뒤 모습');
  assert.ok(recs.get('F2200').about.includes(F) && recs.get('F2200').about.includes('person:머스탱'), '둘 다');
  assert.equal(recs.get('F94').imp, undefined);
  const det = new Map(read('persons-detail.json').map((d) => [d.id, d]));
  assert.ok(det.get(F).records.includes('Q291') && det.get('person:머스탱').records.includes('Q291'), '아버지 · 드러나기 전 머스탱 양쪽');
  const P = new Map(read('persons.json').map((p) => [p.id, p]));
  assert.deepEqual(P.get('person:슈엔').imp, [{ id: 'L32', as: 'person:시프티', rev: 'ch09', units: ['ch08', 'ch09'] }]);
  assert.deepEqual(P.get('person:시프티').imp, [{ id: 'L32', by: 'person:슈엔', rev: 'ch09', units: ['ch08', 'ch09'] }]);
  assert.ok(P.get(F).imp?.some((x) => x.id === 'L36' && x.as === 'person:머스탱' && x.units.includes('side:pretty_star')));
  assert.ok(P.get('person:머스탱').imp?.some((x) => x.id === 'L36' && x.by === F));
  for (const d of read('persons-detail.json')) {
    for (const e of d.units) if (e.pre) assert.ok(e.rev && Boolean(e.as) !== Boolean(e.by), `${d.id} ${e.unit}: rev · as | by`);
  }
  // 화면 이름은 인물끼리 겹치지 않는다 — 새 동명이인 · 다른 인물도 이 규칙으로 갈린다
  const names = new Map();
  for (const t of T.values()) {
    if (t.type !== 'person') continue;
    const n = t.label ?? t.name;
    assert.ok(!names.has(n), `화면 이름 '${n}'이 ${names.get(n)} · ${t.id}에 겹친다`);
    names.set(n, t.id);
  }
});

test('기본 이름(W24b) — 최근 10편 표: 편마다 가장 많이 보인 이름에 한 표, 같으면 최근 줄 · 전체 줄 · ID', () => {
  const groups = new Map();
  const g = ['person:a', 'person:b', 'person:c'];
  for (const id of g) groups.set(id, g);
  const solo = ['person:z'];
  groups.set('person:z', solo);
  const rows = [];
  // a는 옛날에 많이(1–20편), b는 최근 10편 가운데 7편에서 더 많이 — 전체 수는 a가 크지만 기본 이름은 b
  for (let o = 1; o <= 20; o++) rows.push({ person: 'person:a', order: o, lines: 50 });
  for (let o = 21; o <= 30; o++) rows.push({ person: 'person:a', order: o, lines: o <= 23 ? 9 : 1 });
  for (let o = 21; o <= 30; o++) rows.push({ person: 'person:b', order: o, lines: o <= 23 ? 1 : 5 });
  rows.push({ person: 'person:c', order: 30, lines: 3 }, { person: 'person:z', order: 1, lines: 9 });
  const f = familiarNames(groups, rows);
  assert.deepEqual([f.get('person:b').rank, f.get('person:a').rank, f.get('person:c').rank], [1, 2, 3]);
  assert.equal(f.get('person:a').head, 'person:b');
  assert.deepEqual([f.get('person:b').votes, f.get('person:a').votes], [7, 3]);
  assert.equal(f.has('person:z'), false, '혼자인 인물은 묶음이 아니다');
  // 실제 — 그레이브(에이브 · 언노운 · 관짝이) · 마리안(모더니아) · 머스탱(한슨)
  const v = buildPersons(ds, ctx, order);
  const head = (id) => v.persons.find((p) => p.target === id).name_head;
  assert.equal(head('person:에이브'), 'person:그레이브');
  assert.equal(head('person:모더니아'), 'person:마리안');
  assert.equal(head('person:한슨'), 'person:머스탱');
  assert.equal(head('person:피라'), 'person:라피');
});
