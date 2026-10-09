/**
 * B1a — 2회독 기록 형식(암시 언급 I · 떡밥 E · 인물 변화 D · 생활상 U) · 1회독 바로잡기 · 수동 엣지(Y, T4-3) · 병합 규칙(T4-4).
 *
 *   node --test          (레포 루트에서)
 *
 * 예시(tests/fixtures/read2/ · read1/_links.json, 바로잡기는 read1/sub.로망티스트_01.json Q4)가 통과하고,
 * 일부러 망가뜨린 기록은 검증기가 잡는지, 2회독 기록에서 엣지 · 언급 DB 줄이 기계적으로 나오는지 본다. 형식 · 규칙은 docs/annotations.md "2회독 기록".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { EXAMPLE_DIR, ROOT, isRecord, loadDataset, read2DirFor } from '../tools/records/model.mjs';
import { READ2_PREFIXES, loadOrder } from '../tools/records/order.mjs';
import { mentionRows, mergeEdges, parseCite, read2Edges } from '../tools/records/read2.mjs';
import { applyDecision, progressReport2, reviewPages, select, writeDecisions } from '../tools/records/review.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const order2 = loadOrder(READ2_PREFIXES);
const list = (xs) => xs.slice(0, 12).map((x) => `${x.file}${x.id ? ` ${x.id}` : ''}: ${x.msg}`).join('\n');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });

/** 예시(1회독 · 2회독)를 임시 디렉터리 <tmp>/read1 · <tmp>/read2에 복사한다 */
function tempCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'read2-'));
  fs.cpSync(EXAMPLE_DIR, path.join(root, 'read1'), { recursive: true });
  fs.cpSync(read2DirFor(EXAMPLE_DIR), path.join(root, 'read2'), { recursive: true });
  return { root, dir: path.join(root, 'read1'), dir2: path.join(root, 'read2') };
}

test('2회독 예시 — 네 종류 · 바로잡기 · 수동 엣지가 실리고, 1회독 도구에는 섞이지 않는다', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  assert.equal(path.basename(ds.dir2), 'read2');
  const { errors, warnings } = checkDataset(ds, ctx, order, { order2 });
  assert.deepEqual([...errors, ...warnings], [], list([...errors, ...warnings]));
  const kinds = new Set(ds.candidates.filter((c) => c.read2 || c.links).map((c) => `${c.kind}:${c.act}`));
  for (const k of ['mention:언급', 'echo:암시', 'echo:재언급', 'change:기준', 'change:변화', 'life:일상 · 문화', 'edge:sequel', 'edge:character 지움']) assert.ok(kinds.has(k), `예시에 ${k}가 없다`);
  // 2회독 파일은 files2에만 — 1회독 진행률 · 인계 파일이 보는 files에는 없다
  assert.ok(ds.files2.every((f) => f.name.startsWith('read2/')));
  assert.ok(!ds.files.some((f) => f.name.startsWith('read2/')));
  assert.ok(ds.candidates.filter((c) => c.read2 || c.links).every((c) => !isRecord(c)));
  // 바로잡기로 더한 1회독 항목은 1회독 기록이다 — 자기 session(M12)을 단다
  const q4 = ds.candidates.find((c) => c.id === 'Q4');
  assert.ok(isRecord(q4) && q4.fix && q4.session === 'M12');
  // 2회독 되짚기 메모 — V 번호를 1회독과 함께 쓰고, 아직 2회독하지 않은 단위로 넘긴다
  assert.deepEqual(ds.revisits.filter((v) => v.read2).map((v) => [v.id, v.unit]), [['V2', 'sub:로망티스트_00']]);
  assert.deepEqual(ds.revisitDone.filter((v) => v.read2).map((v) => [v.id, v.unit]), [['V2', 'sub:로망티스트_01']]);
});

test('검증기가 잡는다 — 2회독 파일 칸 · 한 씬 · 가리키는 기록 · 읽는 순서 · 측면 · 수동 엣지 · 바로잡기 session', () => {
  const { root, dir, dir2 } = tempCopy();
  const el = path.join(dir2, 'd_ex_elevator_01.json');
  const e = readJson(el);
  e.facts = [];                                                     // 1회독 칸
  e.mentions.push(
    { id: 'I7', target: 'person:없는인물', evidence: [{ scene: 'd_ex_elevator_01', lines: ['12'] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'I8', target: 'place:방주', speaker: true, evidence: [{ scene: 'd_ex_elevator_01', lines: [83] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'I9', target: 'incident:갓데스_폴', evidence: [{ scene: 'd_ex_elevator_01', lines: [78] }], reason: '겹침', confidence: '확실', status: '후보' },
  );
  e.echoes.push(
    { id: 'E7', act: '암시', text: 'x', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }, { scene: 'sub:로망티스트_00', lines: [1] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'E8', act: '복선', points: ['F99', 'S2'], text: 'x', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'E9', act: '암시', points: ['F5'], text: '드러난 뒤', evidence: [{ scene: 'd_ex_elevator_01', lines: [90] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'E10', act: '재언급', points: ['F4'], text: '드러나기 전', evidence: [{ scene: 'd_ex_elevator_01', lines: [90] }], reason: 'x', confidence: '확실', status: '후보' },
  );
  e.changes.push(
    { id: 'D7', person: 'place:방주', aspect: '기분', act: '변화', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'D8', person: 'person:네온', aspect: '관계', act: '변화', before: 'a', after: 'b', time: 'S99', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }], reason: 'x', confidence: '확실', status: '후보' },
  );
  e.life.push({ id: 'U7', topic: '음식', text: 'x', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }], reason: 'x', confidence: '확실', status: '후보' });
  e.session = 'R02';
  writeJson(el, e);
  const ro = path.join(dir2, 'sub.로망티스트_00.json');
  const r0 = readJson(ro);
  r0.changes.push({ id: 'D9', person: 'person:로망티스트', aspect: '성격', act: '기준', text: '두 번째 기준', evidence: [{ scene: 'sub:로망티스트_00', lines: [25] }], reason: 'x', confidence: '확실', status: '후보' });
  // 관계 기준은 상대마다 하나 — 상대가 다르면 경고 없고, 같으면 경고(P1)
  const relBase = (id, w) => ({ id, person: 'person:로망티스트', aspect: '관계', act: '기준', with: [w], text: '관계 기준', evidence: [{ scene: 'sub:로망티스트_00', lines: [25] }], reason: 'x', confidence: '확실', status: '후보' });
  r0.changes.push(relBase('D10', 'person:지휘관'), relBase('D11', 'person:라피'), relBase('D12', 'person:지휘관'));
  writeJson(ro, r0);
  const links = readJson(path.join(dir, '_links.json'));
  links.edges.push({ id: 'Y7', type: 'same_arc', from: 'ch99', to: 'ch99', strength: 5, reason: 'x', confidence: '확실', status: '후보' });
  writeJson(path.join(dir, '_links.json'), links);
  const r1 = path.join(dir, 'sub.로망티스트_01.json');
  const d1 = readJson(r1);
  d1.questions.find((q) => q.id === 'Q4').session = 'R17';
  writeJson(r1, d1);

  const { errors, warnings } = checkDataset(loadDataset({ dir }), ctx, order, { order2 });
  const has = (xs, id, re) => assert.ok(xs.some((x) => (id === null || x.id === id) && re.test(x.msg)), `${id} ${re} 이(가) 없다\n${list(xs)}`);
  has(errors, null, /2회독 파일에 1회독 칸\(facts\)/);
  has(errors, null, /session "R02" — 2회독 세션/);
  has(errors, 'I7', /target: 없는 대상/);
  has(errors, 'I7', /줄 번호 "12".*줄 하나는 숫자로/);
  has(errors, 'I8', /speaker: true는 인물/);
  has(warnings, 'I9', /I1와 같은 대상 · 같은 줄/);
  has(errors, 'E7', /씬이 2개다 — 2회독 기록은 한 기록 = 한 씬/);
  has(errors, 'E7', /points\(가리키는/);
  has(errors, 'E8', /act "복선"/);
  has(errors, 'E8', /points: 없는 기록 "F99"/);
  has(errors, 'E8', /points: 없는 기록 "S2"/);
  has(warnings, 'E9', /암시가 F5의 드러남.*보다 뒤다/);
  has(warnings, 'E10', /재언급이 F4.*보다 앞이다/);
  has(errors, 'D7', /person: 인물 대상 ID/);
  has(errors, 'D7', /aspect "기분"/);
  has(errors, 'D7', /before\(전/);
  has(warnings, 'D8', /관계 변화에는 with/);
  has(errors, 'D8', /time: 없는 기록 "S99"/);
  has(warnings, 'D9', /기준이 또 있다 — D1/);
  has(warnings, 'D12', /관계\(person:지휘관\)의 기준이 또 있다 — D10/);
  assert.ok(!warnings.some((x) => x.id === 'D11' && /기준이 또/.test(x.msg)), '상대가 다른 관계 기준은 경고하지 않는다');
  has(warnings, 'U7', /새 주제 "음식"/);
  has(errors, 'Y7', /type "same_arc"/);
  has(errors, 'Y7', /from: 모르는 ch99/);
  has(errors, 'Y7', /strength는 1 · 2 · 3/);
  has(errors, 'Q4', /session "R17" — 항목의 session은 2회독 바로잡기에만/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('엣지 — 떡밥 기록에서 setup_payoff · callback이 기계적으로 나온다 (끝점 = 근거의 첫 씬, 방향 = 읽는 순서)', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const { edges, problems } = read2Edges(ds, ctx, order);
  const short = edges.map((r) => `${r.record} ${r.act}→${r.point} ${r.type} ${r.from_scene} → ${r.to_scene}`);
  assert.deepEqual(short, [
    'E1 암시→Q3 setup_payoff d_ex_elevator_01 → d_ex_elevator_01', // 의문을 가리키는 암시는 회수(Q3-2)의 씬으로 — 줄기 J2는 씬 엣지가 없다
    'E2 암시→F4 setup_payoff sub:로망티스트_00 → sub:로망티스트_01',
    'E3 재언급→F2 callback sub:로망티스트_00 → sub:로망티스트_01',
  ]);
  assert.deepEqual(problems, []);
  assert.ok(edges.every((r) => r.from_order <= r.to_order));
  assert.deepEqual(edges.map((r) => r.status), ['확정', '후보', '후보'], '후보로 만든 엣지는 상태를 남긴다');
});

test('언급 DB 줄 — 암시 언급은 이어진 줄 덩어리마다 implied 한 줄', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  assert.deepEqual(mentionRows(ds), [
    { scene: 'd_ex_elevator_01', from_seq: 76, to_seq: 80, target: 'incident:갓데스_폴', how: 'implied', speaker: false, record: 'I1', confidence: '확실', status: '후보' },
  ]);
});

test('수동 엣지 병합 (T4-4) — 수동이 이기고 자동값은 보존한다, drop은 지우되 남긴다, 기각은 없는 것', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const manual = ds.candidates.filter((c) => c.kind === 'edge');
  const auto = [
    { from: 'sub:로망티스트_00', to: 'sub:로망티스트_01', type: 'sequel', strength: 2, origin: 'auto', note: '키 순서' },
    { from: 'd_ex_elevator_01', to: 'sub:로망티스트_00', type: 'character', strength: 1, origin: 'auto' },
    { from: 'ch00', to: 'ch01', type: 'sequel', strength: 3, origin: 'auto' },
  ];
  const { edges, dropped, unmatched } = mergeEdges(auto, manual);
  const seq = edges.find((e) => e.from === 'sub:로망티스트_00');
  assert.equal(seq.origin, 'manual');
  assert.equal(seq.strength, 3);
  assert.equal(seq.record, 'Y1');
  assert.deepEqual(seq.auto, [auto[0]], '자동값은 auto에 그대로');
  assert.ok(!edges.some((e) => e.type === 'character'), 'drop한 자동 엣지는 빠진다');
  assert.deepEqual(dropped.map((d) => [d.type, d.dropped_by, d.origin]), [['character', 'Y2', 'auto']], '지운 자동 엣지는 dropped에 남는다');
  assert.ok(edges.some((e) => e.from === 'ch00' && e.origin === 'auto'), '수동이 없는 자동 엣지는 그대로');
  assert.deepEqual(unmatched, []);
  // 기각된 수동 엣지는 없는 것으로 — 자동이 그대로 산다
  const rejected = manual.map((m) => ({ ...m, status: '기각' }));
  assert.deepEqual(mergeEdges(auto, rejected).edges, auto);
  // 지울 자동 엣지가 없으면 unmatched
  assert.equal(mergeEdges([], manual).unmatched.length, 1);
});

test('바로잡기 — set --confidence · --evidence는 후보 하나를 고치고 고치기 전 값을 검토 기록에 남긴다', () => {
  const { root, dir } = tempCopy();
  let ds = loadDataset({ dir });
  const f2 = ds.candidates.find((c) => c.id === 'F2');
  const res = applyDecision([f2], '확정', { by: 'claude', session: 'M05', date: '2026-10-05', confidence: '추정', evidence: 'sub:로망티스트_00#33-34' });
  writeDecisions(ds, res.perFile);
  ds = loadDataset({ dir });
  const o = ds.candidates.find((c) => c.id === 'F2').obj;
  assert.equal(o.confidence, '추정');
  assert.deepEqual(o.evidence, [{ scene: 'sub:로망티스트_00', lines: ['33-34'] }]);
  assert.deepEqual(o.reviews.at(-1), { decision: '확정', by: 'claude', date: '2026-10-05', session: 'M05', before: '확신도 확실 · 근거 sub:로망티스트_00#32-34' });
  assert.deepEqual(checkDataset(ds, ctx, order, { order2 }).errors, []);
  // 2회독 기록도 같은 길로 — 파일 이름은 read2/…
  const e2 = ds.candidates.find((c) => c.id === 'E2');
  writeDecisions(ds, applyDecision([e2], '기각', { by: 'claude', session: 'M05', note: '예시' }).perFile);
  assert.equal(loadDataset({ dir }).candidates.find((c) => c.id === 'E2').status, '기각');
  assert.throws(() => applyDecision([f2, e2], '확정', { evidence: 'x#1' }), /후보 하나에만/);
  assert.throws(() => applyDecision([f2], '확정', { confidence: '아마' }), /--confidence/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('인용 표기 → 근거 — 숫자 하나는 숫자, 범위는 문자열', () => {
  assert.deepEqual(parseCite('d_main_01_01_s#12,20-25 sub:로망티스트_00#3'), [
    { scene: 'd_main_01_01_s', lines: [12, '20-25'] }, { scene: 'sub:로망티스트_00', lines: [3] },
  ]);
  assert.throws(() => parseCite('d_main_01_01_s'), /씬#줄/);
  assert.throws(() => parseCite('a#1,x'), /숫자나 a-b/);
});

test('리뷰 고르기 — 2회독 세션 · 종류 · 범위, 바로잡기는 자기 세션으로 잡힌다', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const ids = (tokens) => select(ds, tokens).picked.map((c) => c.id).sort();
  assert.deepEqual(ids(['M12']), ['D2', 'D3', 'E3', 'Q4']);
  assert.deepEqual(ids(['떡밥']), ['E1', 'E2', 'E3']);
  assert.deepEqual(ids(['E2..E3']), ['E2', 'E3']);
  assert.deepEqual(ids(['엣지']), ['Y1', 'Y2']);
  assert.deepEqual(ids(['sub:로망티스트_00', '변화']), ['D1']);
  const brief = reviewPages(select(ds, ['M12']).picked, ds, ctx, order, { brief: true })[0];
  assert.match(brief, /^D3 \[후보 · 추정\] 변화 person:로망티스트 관계\(person:지휘관\): 낚싯대를 구해 달라는 메신저 의뢰인 → /m);
  assert.match(brief, /^E3 \[후보 · 확실\] 떡밥\(재언급\) .* ⇢ F2 — sub:로망티스트_01#112-116$/m);
  const full = reviewPages(select(ds, ['D2']).picked, ds, ctx, order, {})[0];
  assert.match(full, /작중 시점: S1 /);
  assert.match(full, /계기:\n근거 sub:로망티스트_01#89-93/);
});

test('new — 1회독 기록이 있는 단위는 2회독 뼈대(세션은 P · M 순서), 진행률', () => {
  const { root, dir, dir2 } = tempCopy();
  fs.rmSync(path.join(dir2, 'd_ex_elevator_01.json'));
  const r = node(['tools/records.mjs', 'new', 'd_ex_elevator_01', '--dir', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /만듦: .*read2\/d_ex_elevator_01\.json — 2회독 M02/);
  const made = readJson(path.join(dir2, 'd_ex_elevator_01.json'));
  assert.deepEqual(Object.keys(made), ['_comment', 'unit', 'session', 'by', 'date', 'mentions', 'echoes', 'changes', 'life']);
  assert.match(made._comment, /"lines": \[12, "20-25"\]/);
  const again = node(['tools/records.mjs', 'new', 'd_ex_elevator_01', '--dir', dir]);
  assert.notEqual(again.status, 0);
  const report = progressReport2(loadDataset({ dir }), order2);
  assert.match(report, /^# 2회독 진행 — 읽음 3\/\d+ 단위/);
  assert.match(report, /## M12 — 읽음 1\/\d+ · 기록 3 \(암시 언급 0 · 떡밥 1 · 인물 변화 2 · 생활상 0\) · 검토 0% · 바로잡기 1/);
  fs.rmSync(root, { recursive: true, force: true });
});
