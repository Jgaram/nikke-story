/**
 * B1b — 2회독 인계 파일(annotations/read2/HANDOFF.md · handoff/) · 2회독 볼 거리(annotations/watch.json).
 *
 *   node --test          (레포 루트에서)
 *
 * 예시(tests/fixtures/read1 · read2, 볼 거리는 read1/_watch.json)로 다음 세션 단위의 지도(볼 거리 · 되짚기 · 1회독 기록과 그 뒤 · 걸친 줄기)와
 * 원문 대상(정체 연결로 넓힌 것)이 나오는지, 볼 거리 검증기, 실제 2회독 인계 파일이 최신인지 본다. 형식 · 규칙은 docs/annotations.md "2회독 인계 파일".
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
import { identityRules, sourceTargets } from '../tools/records/focus.mjs';
import { FILE_MAX, FIRST_MAX, staleHandoff } from '../tools/records/handoff.mjs';
import { STATE_MAX, THREAD_LEVELS, buildHandoff2 } from '../tools/records/handoff2.mjs';
import { EXAMPLE_DIR, READ1_DIR, READ2_DIR, ROOT, loadDataset, nextIds, read2DirFor } from '../tools/records/model.mjs';
import { READ2_PREFIXES, loadOrder, parseOrder, partsOverlap } from '../tools/records/order.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const list = (xs) => xs.slice(0, 12).map((x) => `${x.file}${x.id ? ` ${x.id}` : ''}: ${x.msg}`).join('\n');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

/** 예시를 <tmp>/read1 · <tmp>/read2에 복사한다 */
function tempCopy() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff2-'));
  fs.cpSync(EXAMPLE_DIR, path.join(root, 'read1'), { recursive: true });
  fs.cpSync(read2DirFor(EXAMPLE_DIR), path.join(root, 'read2'), { recursive: true });
  return { root, dir: path.join(root, 'read1'), dir2: path.join(root, 'read2') };
}
/** 예시 단위로 짠 2회독 순서 — M05의 sub:로망티스트_01을 아직 안 읽은 것으로 둔다 */
const order2 = parseOrder([
  '- [x] **M02** `d_ex_elevator_01` — 예시',
  '- [~] **M05** `sub:로망티스트_00` `sub:로망티스트_01` — 예시',
].join('\n'), READ2_PREFIXES);

test('파트 겹침 — 1회독 · 2회독 파트 묶음이 달라도 겹치면 같은 차례', () => {
  assert.equal(partsOverlap('7-12', '7-9'), true);
  assert.equal(partsOverlap('7-12', '10-12'), true);
  assert.equal(partsOverlap('7-12', '1-6'), false);
  assert.equal(partsOverlap('1-3', '4-6'), false);
  assert.equal(partsOverlap(null, '1-3'), true, '파트 없음 = 단위 전체');
  assert.equal(partsOverlap('4-6', null), true);
});

test('볼 거리 — 예시가 실리고 검증기를 통과한다(후보 목록에는 섞이지 않는다), 다음 번호 W', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  assert.deepEqual(ds.watchItems.map((w) => w.id), ['W1', 'W2']);
  assert.ok(!ds.candidates.some((c) => /^W\d/.test(c.id ?? '')), '볼 거리는 후보가 아니다');
  assert.equal(nextIds(ds).W, 'W3');
  const { errors, warnings } = checkDataset(ds, ctx, order);
  assert.deepEqual(errors, [], list(errors));
  assert.deepEqual(warnings.filter((w) => w.file.includes('watch')), [], list(warnings));
});

test('볼 거리 검증기가 잡는다 — ID · 단위 · 단위 밖 씬 · 줄 · 종류 · 출처 · 가리키는 기록 · 파트', () => {
  const { root, dir } = tempCopy();
  const file = path.join(dir, '_watch.json');
  const w = readJson(file);
  const base = w.items[1];
  w.items.push(
    { ...base, id: 'X1' },
    { ...base, id: 'W3', unit: 'sub:없는단위_00' },
    { ...base, id: 'W4', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }] },
    { ...base, id: 'W5', evidence: [{ scene: 'sub:로망티스트_01', lines: [9999] }] },
    { ...base, id: 'W6', kind: '사실' },
    { ...base, id: 'W7', from: '' },
    { ...base, id: 'W8', points: ['F999999'] },
    { ...base, id: 'W9', parts: '1-3' },
    { ...base, id: 'W2' },
    { ...base, id: 'W10', evidence: [{ scene: 'sub:로망티스트_01' }], points: undefined },
  );
  writeJson(file, w);
  const { errors } = checkDataset(loadDataset({ dir }), ctx, order);
  const msgs = errors.filter((e) => e.file.includes('watch')).map((e) => `${e.id ?? ''} ${e.msg}`);
  const has = (re) => assert.ok(msgs.some((m) => re.test(m)), `${re} 없음:\n${msgs.join('\n')}`);
  has(/id는 W<번호>/);
  has(/^W3 없는 단위 sub:없는단위_00/);
  has(/^W4 단위 sub:로망티스트_01 밖 씬 d_ex_elevator_01/);
  has(/^W5 없는 줄 sub:로망티스트_01#9999/);
  has(/^W6 종류\(kind\) "사실"/);
  has(/^W7 출처\(from\)가 없다/);
  has(/^W8 points: 없는 기록 "F999999"/);
  has(/^W9 sub:로망티스트_01에 겹치는 파트의 읽기 항목이 없다 — parts 1-3/);
  has(/^W2 ID가 겹친다/);
  assert.ok(!msgs.some((m) => m.startsWith('W10')), `줄 없는 근거 · points 없음은 괜찮다:\n${msgs.join('\n')}`);
  fs.rmSync(root, { recursive: true, force: true });
});

test('정체 연결로 대상 넓히기 — 같은 인물 무리는 대표 하나로, 이름표 연결은 근거 씬 안에서만, `???` 줄은 2회독 기록으로만', () => {
  const link = { type: 'same_as', a: 'person:모더니아', b: 'person:마리안', status: '확정', evidence: [] };
  const id = identityRules(ctx, [link]);
  assert.equal(id.canon('person:모더니아'), 'person:마리안');
  assert.equal(id.canon('person:라피'), 'person:라피');
  assert.deepEqual(id.members.get('person:마리안'), ['person:마리안', 'person:모더니아']);
  const plain = sourceTargets(ctx, ['ch07']);
  const wide = sourceTargets(ctx, ['ch07'], { identity: true, links: [link] });
  assert.ok(plain.get('person:모더니아') > 0, 'ch07에는 모더니아가 나온다');
  assert.ok(!wide.has('person:모더니아'), '이명은 대표로 센다');
  assert.ok(wide.get('person:마리안') >= Math.max(plain.get('person:마리안') ?? 0, plain.get('person:모더니아')));
  assert.equal(identityRules(ctx, [{ ...link, status: '기각' }]).canon('person:모더니아'), 'person:모더니아', '기각된 연결은 쓰지 않는다');
  // 이름표 연결 — 근거 씬에서만 그 이름표를 그 인물로 친다(`노인` 같은 이름표는 씬마다 다른 사람일 수 있다)
  const scene = db.prepare("SELECT story_id FROM lines WHERE speaker_name = '노인' AND story_id LIKE 'event_ce006%' ORDER BY story_id LIMIT 1").get().story_id;
  const label = { type: 'same_as', a: '이름표:노인', b: 'person:헤르민', status: '확정', evidence: [{ scene, lines: [0] }] };
  const before = sourceTargets(ctx, ['event_ce006'], { identity: true, links: [] }).get('person:헤르민') ?? 0;
  const after = sourceTargets(ctx, ['event_ce006'], { identity: true, links: [label] }).get('person:헤르민') ?? 0;
  assert.ok(after > before, `근거 씬의 이름표 '노인' 줄이 헤르민으로 잡힌다 (${before} → ${after})`);
  const elsewhere = { ...label, evidence: [{ scene: 'd_ex_elevator_01', lines: [0] }] };
  assert.equal(sourceTargets(ctx, ['event_ce006'], { identity: true, links: [elsewhere] }).get('person:헤르민') ?? 0, before, '근거 씬 밖에서는 안 잡는다');
  // `???` · 미상 이름표 줄은 매번 다른 사람이다 — 연결의 근거 줄에 들어 있어도 그 인물로 치지 않는다(근거 줄은 정체를 보여 줄 뿐 — 남자의 목소리가 읽는 뉴스 등)
  const cited = { type: 'same_as', a: 'person:모더니아', b: 'person:마리안', status: '확정', evidence: [{ scene: 'd_main_07_06_e', lines: ['21-35'] }] };
  assert.equal(identityRules(ctx, [cited]).byLine.size, 0, '근거 줄로 미상 줄의 정체를 정하지 않는다');
  const read2 = new Map([['d_main_07_06_e\t22', ['person:마리안']]]);
  assert.deepEqual(identityRules(ctx, [cited], read2).byLine.get('d_main_07_06_e\t22'), ['person:마리안'], '2회독 암시 언급 speaker: true만 줄의 정체가 된다');
});

test('정체 볼 줄 — 다음 단위의 미상 이름표 줄을 씬 · 이름표별로 보인다(2회독이 읽어 정할 것)', () => {
  // 엘리베이터는 M02가 이미 2회독했다 — 빈 2회독 디렉터리로 안 읽은 단위로 만든다(읽은 단위는 인계에서 빠진다)
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'read2-empty-'));
  const ds = loadDataset({ dir: READ1_DIR, read2: empty });
  fs.rmSync(empty, { recursive: true, force: true });
  const o2 = parseOrder('- [ ] **M02** `d_ex_elevator_01` — 예시', READ2_PREFIXES);
  const next = buildHandoff2(ds, ctx, order, o2).files.get('handoff/next.md');
  const n = db.prepare("SELECT COUNT(*) n FROM lines WHERE story_id = 'd_ex_elevator_01' AND speaker_class = '미상'").get().n;
  assert.ok(n > 0);
  assert.match(next, new RegExp(`^정체 볼 줄 — 미상 이름표 ${n}줄\\(2회독이 적은 것 0\\)`, 'm'));
  assert.match(next, /^- d_ex_elevator_01 \?\?\? #\d[\d,-]*$/m);
});

test('줄기 절 줄이기 — 큰 세션도 먼저 읽을 것이 상한 안쪽(풀린 의문은 ID만 · 결말 사실을 줄인다)', () => {
  const ds = loadDataset({ dir: READ1_DIR });
  const o2 = loadOrder(READ2_PREFIXES);
  for (const sid of ['M01', 'M02']) {
    const i = o2.items.findIndex((it) => it.session === sid);
    if (i < 0) continue;
    const b = buildHandoff2(ds, ctx, order, { items: o2.items.slice(i), sessions: o2.sessions });
    assert.ok(b.firstTotal <= FIRST_MAX, `${sid} 먼저 읽을 것 ${b.firstTotal}자`);
    // 지금까지 2회독 기록(인물 변화 · 생활상)은 STATE_MAX 안쪽 — 2회독이 쌓여도 줄여 적는다
    const focus = b.files.get('handoff/focus.md');
    const state = focus.includes('## 앞뒤 사실') ? focus.slice(0, focus.indexOf('## 앞뒤 사실')) : focus;
    const at = state.search(/^## (인물 변화|생활상) 지금까지/m);
    if (at >= 0) assert.ok([...state.slice(at)].length <= STATE_MAX + 2, `${sid} 지금까지 2회독 기록 ${[...state.slice(at)].length}자`);
    const next = [...b.files].filter(([k]) => k.startsWith('handoff/next')).map(([, v]) => v).join('\n');
    if (/줄기 절을 줄였다/.test(next)) assert.match(next, /^- 풀린 의문\(문장은 handoff\/threads\.md\): /m);
  }
  const level0 = THREAD_LEVELS[0];
  assert.deepEqual(level0, { factsMax: 8, solvedText: true }, '줄이지 않을 때는 풀린 의문도 문장째 · 결말 8건');
});

test('2회독 인계 — 다음 세션 단위 지도 · 원문 대상 · 줄기, 읽은 단위는 빼고, 같은 기록이면 같은 파일', () => {
  const { root, dir, dir2 } = tempCopy();
  fs.rmSync(path.join(dir2, 'sub.로망티스트_01.json'));
  const ds = loadDataset({ dir });
  const built = buildHandoff2(ds, ctx, order, order2);
  assert.deepEqual(built.firstNames, ['HANDOFF.md', 'handoff/next.md', 'handoff/focus.md']);
  assert.ok([...built.files.keys()].includes('handoff/threads.md') && [...built.files.keys()].includes('handoff/index.md'));
  assert.deepEqual(built.next, { session: 'M05', items: ['sub:로망티스트_01'] });
  const head = built.files.get('HANDOFF.md');
  assert.match(head, /다음: \*\*M05\*\* — ~~sub:로망티스트_00~~ · sub:로망티스트_01/);
  assert.match(head, /- 읽은 단위 2\/3 /);
  assert.match(head, /다음 번호: 암시 언급 I2 · 떡밥 E3 · 인물 변화 D2 · 생활상 U2/);
  assert.match(head, /- J1 /);
  const next = built.files.get('handoff/next.md');
  assert.match(next, /^## sub:로망티스트_01 · .* · 1회독 R31$/m);
  assert.match(next, /^- W2 \[변화\] 예시 — .* · sub:로망티스트_01#101-104 → Q2 \(예시 R31 인계/m, '볼 거리');
  assert.doesNotMatch(next, /W1 /, '다른 단위의 볼 거리는 안 붙는다');
  assert.match(next, /^- V2 \(M05 sub:로망티스트_00\) /m, '앞 2회독 세션이 넘긴 되짚기');
  assert.match(next, /^- Q2 .* · 풀림$/m);
  assert.match(next, /^ {2}→ 풀림 F4 .*\(Q2-2\): /m, '던진 의문의 답과 그 문장');
  assert.match(next, /^- Q1-2 .*Q1 회수\(전부\) → F3.* · \(Q1: /m, '앞 의문을 푼 사건은 그 의문 문장과 함께');
  assert.doesNotMatch(next, /F2-2/, '기각된 사건은 뺀다');
  assert.match(next, /^## 줄기 J1 .* — 걸친 단위 sub:로망티스트_01$/m);
  assert.match(next, /^- Q2 풀림 → F4 · sub:로망티스트_01 — 위 단위 절$/m, '이번 세션 단위의 의문은 줄여 적는다');
  assert.match(next, /^- Q1 풀림 .*\? → F3 · sub:로망티스트_00$/m, '앞 단위의 의문은 문장째');
  const focus = built.files.get('handoff/focus.md');
  assert.match(focus, /^# 원문 대상 — M05 /);
  assert.match(focus, /^## 인물 변화 지금까지 — 1건/m, '읽은 단위의 인물 변화(D1)가 다음 단위에 보인다');
  assert.match(focus, /^- D1 /m);
  assert.ok(built.firstTotal <= FIRST_MAX);
  for (const [name, text] of built.files) assert.ok([...text].length <= FILE_MAX || name === 'HANDOFF.md', `${name}이 ${FILE_MAX}자를 넘는다`);
  assert.deepEqual([...buildHandoff2(loadDataset({ dir }), ctx, order, order2).files], [...built.files], '두 번 만들면 같아야 한다');
  fs.rmSync(root, { recursive: true, force: true });
});

test('2회독 인계 — 순서가 끝나면 빈 지도, records.mjs handoff --example --out이 1회독 · 2회독을 함께 쓴다', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const done = buildHandoff2(ds, ctx, order, order2);
  assert.equal(done.next, null, '예시 2회독 파일이 다 있으면 순서 끝');
  assert.match(done.files.get('HANDOFF.md'), /다음: 2회독 순서 끝/);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff2-cli-'));
  const r = spawnSync(process.execPath, ['tools/records.mjs', 'handoff', '--example', '--out', out], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(out, 'HANDOFF.md')) && fs.existsSync(path.join(out, 'read2', 'HANDOFF.md')), r.stdout);
  assert.match(r.stdout, /2회독 먼저 읽을 것/);
  fs.rmSync(out, { recursive: true, force: true });
});

test('실제 2회독 인계 파일(annotations/read2/) — 최신 · 크기 상한 · 볼 거리 검증', () => {
  const ds = loadDataset({ dir: READ1_DIR });
  const built = buildHandoff2(ds, ctx, order, loadOrder(READ2_PREFIXES));
  assert.deepEqual(staleHandoff(built, READ2_DIR), [], '2회독 인계 파일이 오래됐다 → node tools/records.mjs handoff');
  assert.ok(built.firstTotal <= FIRST_MAX, `2회독 먼저 읽을 것 ${built.firstTotal}자 — ${FIRST_MAX}자 안쪽이어야 한다`);
  for (const [name, text] of built.files) assert.ok([...text].length <= FILE_MAX || name === 'HANDOFF.md', `${name}이 ${FILE_MAX}자를 넘는다`);
  assert.ok(ds.watchItems.length >= 80 && ds.watchItems.every((w) => /^W\d+$/.test(w.id)), '볼 거리 W<n>');
});
