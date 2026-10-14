/**
 * 사칭(W23a) — people.json 정체 연결 type impersonates: 검사기 · 집계(이름표 주인 줄을 사칭한 인물에) · 인계 규칙(focus swap · 사칭 볼 줄) ·
 * 화면 함수(fmt.rowAt · impKnown) · 내보낸 persons*.json. 실제 기록은 L32(슈엔 → 시프티, CH.08–09, 드러남 CH.09)로 본다.
 * W23b: L33(한슨 → 머스탱) · 실제 인물로 적은 기록의 가림(masksOf · fmt.recAt · recHas) · 계산은 이름표 주인으로(faceDataset — W23c).
 *
 *   node --test tests/impersonation.test.mjs
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
import { EXAMPLE_DIR, impersonations, loadDataset } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { identityRules, impersonationWatch, sourceTargets } from '../tools/records/focus.mjs';
import { buildPersons, personScenes } from '../tools/views/persons.mjs';
import { impKnown, recAt, recHas, rowAt } from '../site/lib/format.js';
import { faceDataset, impersonationUnits, masksOf } from '../tools/records/impersonation.mjs';
import { scenePlaces } from '../tools/records/read2.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const imps = impersonations(ds);
const people = ds.candidates.filter((c) => c.people).map((c) => c.obj);

test('검사기 — 사칭은 인물끼리 · 다른 둘 · spans · revealed가 있어야 한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-'));
  const file = path.join(dir, '_people.json');
  const base = { status: '후보', confidence: '확실', reason: '시험', by: 'claude', evidence: [{ scene: 'd_main_09_06_s', lines: [22] }] };
  fs.writeFileSync(file, JSON.stringify({ candidates: [
    { id: 'L901', type: 'impersonates', a: '이름표:???', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], revealed: 'ch09', ...base },
    { id: 'L902', type: 'impersonates', a: 'person:시프티', b: 'person:시프티', spans: [{ scene: 'd_main_08_01' }], revealed: 'ch09', ...base },
    { id: 'L903', type: 'impersonates', a: 'person:슈엔', b: 'person:시프티', ...base },
    { id: 'L904', type: 'impersonates', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_99' }, { scene: 'd_main_08_01', lines: [999] }], revealed: 'ch99', ...base },
    { id: 'L905', type: 'impersonates', a: 'person:슈엔', b: 'person:시프티', spans: [{ scene: 'd_main_08_03' }], revealed: 'ch07', ...base },
    { id: 'L906', type: '사칭', a: 'person:슈엔', b: 'person:시프티', ...base },
    { id: 'L907', type: 'same_as', a: 'person:슈엔', b: 'person:시프티', revealed: 'ch09', ...base },
  ] }));
  const { errors, warnings } = checkDataset(loadDataset({ dir: EXAMPLE_DIR, people: file }), ctx, order);
  fs.rmSync(dir, { recursive: true, force: true });
  const err = (id, re) => assert.ok(errors.some((e) => e.id === id && re.test(e.msg)), `${id} ${re}\n${errors.map((e) => `${e.id} ${e.msg}`).join('\n')}`);
  const warn = (id, re) => assert.ok(warnings.some((e) => e.id === id && re.test(e.msg)), `${id} ${re} 경고`);
  err('L901', /사전의 인물 ID/);
  err('L902', /같은 인물이다/);
  err('L903', /spans가 없다/);
  err('L903', /revealed가 없다/);
  err('L904', /없는 씬 d_main_08_99/);
  err('L904', /없는 줄 d_main_08_01#999/);
  err('L904', /읽기 순서에 없는 단위 ch99/);
  warn('L905', /옮길 줄이 없다/); // 08_03에는 시프티가 없다
  warn('L905', /첫 단위보다 앞/);
  err('L906', /type "사칭"/);
  warn('L907', /사칭\(type impersonates\)에만/);
});

test('실제 사칭 기록 — L32 슈엔 → 시프티(드러남 ch09), 확정', () => {
  const l = imps.find((x) => x.id === 'L32');
  assert.ok(l, 'L32');
  assert.equal(l.a, 'person:슈엔');
  assert.equal(l.b, 'person:시프티');
  assert.equal(l.revealed, 'ch09');
  assert.equal(l.status, '확정');
  assert.ok(l.spans.some((s) => s.scene === 'd_main_08_01' && s.seqs === null), '씬 전체');
  assert.ok(l.spans.some((s) => s.scene === 'd_main_09_06_s' && s.seqs.has(21) && !s.seqs.has(22)), '드러나기 전 줄만');
});

test('집계 — 범위 줄의 이름표 주인 줄은 사칭한 인물에, 옮기기 전 모습(pre)을 남긴다', () => {
  const ps = personScenes(ctx, ds);
  for (const imp of imps) {
    for (const sp of imp.spans) {
      const bx = ps.get(imp.b)?.get(sp.scene);
      const ax = ps.get(imp.a)?.get(sp.scene);
      const inSpan = (n) => !sp.seqs || sp.seqs.has(n);
      assert.ok(![...(bx?.all ?? [])].some(inSpan), `${imp.id} ${sp.scene}: 범위 안 ${imp.b} 줄이 남았다`);
      assert.ok(bx?.pre && [...bx.pre.all].some(inSpan), `${imp.id} ${sp.scene}: 이름표 주인의 드러나기 전 모습`);
      assert.ok(ax && [...bx.pre.all].filter(inSpan).every((n) => ax.all.has(n)), `${imp.id} ${sp.scene}: 사칭한 인물에 옮겼다`);
      assert.ok(ax.imp.has(imp.id) && bx.imp.has(imp.id));
    }
  }
  const v = buildPersons(ds, ctx, order);
  const row = (p, u) => v.personUnits.find((r) => r.person === p && r.unit === u);
  assert.deepEqual([row('person:시프티', 'ch08').scenes, row('person:시프티', 'ch08').pre_scenes, row('person:시프티', 'ch08').imp], [0, 5, 'L32']);
  assert.deepEqual([row('person:슈엔', 'ch08').scenes, row('person:슈엔', 'ch08').pre_scenes], [5, 0]);
  assert.ok(row('person:슈엔', 'ch09').pre_scenes < row('person:슈엔', 'ch09').scenes);
  for (const id of ['person:슈엔', 'person:시프티']) assert.equal(v.persons.find((p) => p.target === id).impersonation, 'L32');
  // 사칭이 없는 단위 행에는 pre 칸이 없다
  assert.ok(v.personUnits.filter((r) => !r.imp).every((r) => r.pre_scenes === undefined));
});

test('인계 — focus는 범위 줄의 b를 a로 센다, 사칭 볼 줄은 이름표 주인 줄 수 · 범위 안 수', () => {
  const id = identityRules(ctx, people);
  assert.ok(id.swap.get('d_main_08_01')?.some((x) => x.a === 'person:슈엔' && x.b === 'person:시프티'));
  const hits = sourceTargets(ctx, ['ch08'], { identity: true, links: people });
  assert.equal(hits.get('person:시프티'), undefined, 'ch08의 시프티 이름표 · 부름은 모두 슈엔');
  assert.ok(hits.get('person:슈엔') > 0);
  const [w] = impersonationWatch(ctx, ['ch08'], people);
  assert.equal(w.id, 'L32');
  assert.equal(w.inSpan, w.total);
  const [w2] = impersonationWatch(ctx, ['ch10'], people);
  assert.ok(w2 && w2.inSpan === 0 && w2.total > 0, 'ch10의 시프티는 범위 밖(진짜 시프티)');
});

test('화면 — fmt.rowAt: 드러나기 전에는 pre(상대 없이), 뒤 · 전부 보기에는 옮긴 모습(사칭한 쪽은 hid 풂)', () => {
  const R = (seen, all = false) => ({ all, seen: (u) => seen.includes(u) });
  const a = { unit: 'ch08', scenes: 5, lines: 51, speaker: 47, hid: 1, rev: 'ch09', as: ['person:시프티'], pre: { scenes: 0, lines: 0 } };
  const b = { unit: 'ch08', scenes: 0, lines: 0, rev: 'ch09', by: ['person:슈엔'], pre: { scenes: 5, lines: 51, speaker: 47, first_scene: 'd_main_08_01' } };
  const plain = { unit: 'ch01', scenes: 3, lines: 9 };
  assert.equal(rowAt(plain, R([])), plain);
  assert.deepEqual([rowAt(a, R(['ch08'])).scenes, rowAt(a, R(['ch08'])).speaker, rowAt(a, R(['ch08'])).as], [0, undefined, undefined]);
  assert.deepEqual([rowAt(b, R(['ch08'])).scenes, rowAt(b, R(['ch08'])).speaker, rowAt(b, R(['ch08'])).by], [5, 47, undefined]);
  assert.deepEqual([rowAt(a, R(['ch08', 'ch09'])).scenes, rowAt(a, R(['ch08', 'ch09'])).hid], [5, undefined]);
  assert.deepEqual(rowAt(b, R(['ch08', 'ch09'])).by, ['person:슈엔']);
  assert.equal(rowAt(a, R([], true)).scenes, 5);
  assert.equal(rowAt(a, null).scenes, 5, 'R이 없으면 다 안다');
  assert.ok(impKnown({ rev: 'ch09' }, R(['ch09'])) && !impKnown({ rev: 'ch09' }, R(['ch08'])));
});

test('내보낸 데이터 — 사칭 행은 rev · as 또는 by · pre, persons.json imp는 양쪽에', () => {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
  const detail = read('persons-detail.json');
  const persons = new Map(read('persons.json').map((p) => [p.id, p]));
  for (const d of detail) {
    for (const e of d.units) {
      if (!e.pre) {
        assert.ok(e.scenes > 0 && !e.rev && !e.as && !e.by, `${d.id} ${e.unit}: 사칭 없는 행`);
        continue;
      }
      assert.ok(e.rev && Boolean(e.as) !== Boolean(e.by), `${d.id} ${e.unit}: rev · as | by`);
      assert.ok(persons.get(d.id).imp?.some((x) => x.units.includes(e.unit)), `${d.id} ${e.unit}: persons.json imp`);
    }
  }
  assert.deepEqual(persons.get('person:슈엔').imp, [{ id: 'L32', as: 'person:시프티', rev: 'ch09', units: ['ch08', 'ch09'] }]);
  assert.deepEqual(persons.get('person:시프티').imp, [{ id: 'L32', by: 'person:슈엔', rev: 'ch09', units: ['ch08', 'ch09'] }]);
});

test('W23b — L33 한슨 → 머스탱(드러남 STAR ANIS), 회상의 진짜 머스탱은 범위 밖', () => {
  const L = imps.find((x) => x.id === 'L33');
  assert.ok(L && L.a === 'person:한슨' && L.b === 'person:머스탱' && L.revealed === 'event_staranis1' && L.status === '확정');
  const span = new Map(L.spans.map((s) => [s.scene, s.seqs]));
  assert.ok(span.has('d_main_04af_08') && span.get('d_main_04af_08') === null, 'CH.04의 사장 머스탱은 한슨');
  assert.ok(!span.has('side:pretty_star_13') && !span.has('event_staranis1_03_s'), '회상의 진짜 머스탱');
  assert.ok(span.get('event_staranis2_05_s').has(144) && !span.get('event_staranis2_05_s').has(119) && !span.get('event_staranis2_05_s').has(149), '바뀌는 자리 · 머스탱 흉내 줄');
});

test('W23b — 기록은 실제 인물로, 드러나기 전에는 이름표 주인으로 가린다(a가 제 이름으로 나오는 단위는 가리지 않음)', () => {
  const places = scenePlaces(order, ctx);
  const units = impersonationUnits(ds, db, places.unitOf);
  const L = units.find((x) => x.id === 'L33');
  assert.ok(L.ownUnits.has('side:pretty_star') && L.ownUnits.has('event_staranis1') && !L.ownUnits.has('ch04'));
  const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
  assert.deepEqual(byId.get('F94').obj.about.filter((x) => x.startsWith('person:')), ['person:한슨'], 'CH.04 사장 소개는 한슨');
  assert.deepEqual(masksOf(byId.get('F94'), units).map((m) => [m.a, m.b, m.rev]), [['person:한슨', 'person:머스탱', 'event_staranis1']]);
  assert.equal(masksOf(byId.get('F2544'), units).length, 0, 'PRETTY STAR의 이사 한슨은 가리지 않는다');
  assert.ok(byId.get('F2200').obj.about.includes('person:머스탱') && !byId.get('F2200').obj.about.includes('person:한슨'), "'당시의 머스탱'은 진짜 머스탱");
  assert.ok(byId.get('Q42').obj.about.includes('person:슈엔'), 'CH.08 오퍼레이터 감시 의문은 슈엔(L32)');
  // 계산은 이름표 주인으로
  const faced = faceDataset(ds, ctx, order);
  assert.ok(faced.candidates.find((c) => c.id === 'F94').obj.about.includes('person:머스탱'));
  assert.ok(ds.candidates.find((c) => c.id === 'F94').obj.about.includes('person:한슨'), '원본은 그대로');
});

test('W23b — 화면 fmt.recAt · recHas: 드러난 스토리를 읽기 전에는 이름표 주인', () => {
  const r = { id: 'D1', person: 'person:한슨', with: ['person:아니스'], about: ['person:한슨', 'person:아니스'], imp: [{ a: 'person:한슨', b: 'person:머스탱', rev: 'event_staranis1' }] };
  const before = { all: false, seen: (k) => k !== 'event_staranis1' };
  const after = { all: false, seen: () => true };
  assert.equal(recAt(r, before).person, 'person:머스탱');
  assert.deepEqual(recAt(r, before).about, ['person:머스탱', 'person:아니스']);
  assert.equal(recAt(r, after), r);
  assert.ok(recHas(r, 'person:머스탱', before) && !recHas(r, 'person:한슨', before));
  assert.ok(recHas(r, 'person:한슨', after) && !recHas(r, 'person:머스탱', after));
  assert.ok(recHas({ id: 'F1', about: ['person:라피'] }, 'person:라피', before), '가림 없는 기록은 그대로');
  assert.ok(impKnown(r.imp[0], null), '전부 보기는 드러난 뒤');
});

test('W23b — 내보낸 기록 imp · 인물 상세는 이름표 주인 쪽에도 싣는다', { skip: !fs.existsSync(path.join(ROOT, 'site/data/records.json')) }, () => {
  const recs = [...JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/records.json'), 'utf8')), ...JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/records2.json'), 'utf8'))];
  const f94 = recs.find((r) => r.id === 'F94');
  assert.deepEqual(f94.imp, [{ a: 'person:한슨', b: 'person:머스탱', rev: 'event_staranis1' }]);
  const det = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/persons-detail.json'), 'utf8')).map((d) => [d.id, d]));
  assert.ok(det.get('person:한슨').records.includes('F94') && det.get('person:머스탱').records.includes('F94'));
  const c = det.get('person:머스탱').changes.find((x) => x.id === 'D42');
  assert.ok(c && c.person === 'person:한슨' && c.imp?.length, 'CH.04 첫 모습(D42)은 드러나기 전 머스탱 쪽에도');
});
