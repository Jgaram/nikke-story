/**
 * A3 · T4-5 · T4-6 — 1회독 기록 형식 · 검증기 · 리뷰 도구 · 인계 파일.
 *
 *   node --test          (레포 루트에서)
 *
 * 예시(tests/fixtures/read1/)가 오류 · 경고 없이 통과하고, 일부러 망가뜨린 기록은 검증기가 잡는지 본다.
 * 실제 기록(annotations/read1/)도 오류가 없고 인계 파일이 최신이어야 한다 — 기록을 고친 뒤 `node tools/records.mjs handoff`.
 * 형식 · 규칙은 docs/annotations.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { jumpTargets, renderLine } from '../tools/lib/render.mjs';
import { openContext } from '../tools/records/context.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { parseSpans, replaceValues } from '../tools/records/edit.mjs';
import { buildHandoff, staleHandoff, writeHandoff, FILE_MAX, FIRST_MAX } from '../tools/records/handoff.mjs';
import { pickFacts, sourceTargets } from '../tools/records/focus.mjs';
import { EXAMPLE_DIR, LINKS_PATH, READ1_DIR, READ2_DIR, ROOT, expandLines, fileNameFor, isDeferred, loadDataset, nextIds } from '../tools/records/model.mjs';
import { threadMembership } from '../tools/records/threads.mjs';
import { computeLayers, ruleLayer } from '../tools/records/layers.mjs';
import { loadOrder, parseOrder, parseReadLayers } from '../tools/records/order.mjs';
import { applyDecision, evidenceLines, renderCandidate, reviewPages, select, writeDecisions } from '../tools/records/review.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const list = (xs) => xs.slice(0, 12).map((x) => `${x.file}${x.id ? ` ${x.id}` : ''}: ${x.msg}`).join('\n');

/** 예시를 임시 디렉터리에 복사한다 — 고쳐 보는 테스트가 레포 파일을 건드리지 않게 */
function tempCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'read1-'));
  for (const f of fs.readdirSync(EXAMPLE_DIR)) fs.copyFileSync(path.join(EXAMPLE_DIR, f), path.join(dir, f));
  return dir;
}
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });

test('read.mjs --num: 줄 앞 #N이 DB lines.seq다 (블라링크 · 금서고)', () => {
  for (const scene of ['d_ex_elevator_01', 'sub:로망티스트_00']) {
    const r = node(['tools/read.mjs', scene, '--num']);
    assert.equal(r.status, 0, r.stderr);
    const out = r.stdout.split('\n');
    const at = out.findIndex((l) => l.startsWith(`## ${scene}`));
    assert.ok(at >= 0, `${scene} 씬 머리줄이 없다`);
    const ls = ctx.lines(scene);
    const want = ls.map((l) => renderLine(l, jumpTargets(ls), { num: true })).filter(Boolean);
    assert.deepEqual(out.slice(at + 1, at + 1 + want.length), want);
    for (const [i, l] of want.entries()) assert.ok(l.startsWith(`#${ls[i].seq} `), `${scene}: ${l.slice(0, 30)}`);
  }
});

test('읽는 순서 — 읽기 순서의 R 항목(출시순 한 줄)을 차례로, 모든 키가 풀린다', () => {
  const r01 = order.items.filter((it) => it.session === 'R01').map((it) => it.key);
  assert.deepEqual(r01, ['ch00', 'ch01', 'ch02', 'sub:칠리페퍼_00', 'sub:테트라_커넥트_00', 'ch03', 'sub:세르반_00', 'ch04', 'ch05', 'sub:중앙_정부_공식__00', 'ch06']);
  const bad = order.items.filter((it) => !ctx.resolve(it.key)?.inScope);
  assert.deepEqual(bad.map((it) => `${it.session} ${it.key}`), [], '풀리지 않거나 범위 밖인 키');
  const split = order.items.filter((it) => it.parts).map((it) => `${it.key}@${it.parts}`);
  assert.ok(split.includes('event_staranis1@1-3') && split.includes('event_staranis1@4-6'), split.join(' '));
  // 출시순: 오픈 날 ch16 · 출시 로스터 호감도 스토리가 첫 이벤트(No Caller ID)보다 앞, ch17은 그 뒤
  const at = (k) => order.items.findIndex((it) => it.key === k);
  assert.ok(at('ch16') < at('char:10') && at('char:10') < at('event_nocallerid') && at('event_nocallerid') < at('ch17'));
  const keys = order.items.map((it) => `${it.key}@${it.parts ?? ''}`);
  assert.equal(new Set(keys).size, keys.length, '순서에 같은 단위가 두 번 나온다');
  // (= …) 설명 속 키는 뺀다
  const { items } = parseOrder('- [ ] **RE30** `fl:boom_the_ghost`(= `event_boomtheghost1` 본문) — 7.3만 자');
  assert.deepEqual(items.map((it) => it.key), ['fl:boom_the_ghost']);
});

test('근거 줄 표기 — 숫자 · "a-b" 범위', () => {
  assert.deepEqual(expandLines([3, '5-7', 3]).seqs, [3, 5, 6, 7]);
  assert.ok(expandLines(['7-5']).problems.length);
  assert.ok(expandLines([-1]).problems.length);
  assert.ok(expandLines([]).problems.length);
  assert.equal(fileNameFor('sub:로망티스트_00'), 'sub.로망티스트_00.json');
  assert.equal(fileNameFor('event_staranis1', '4-6'), 'event_staranis1.p4.json');
});

test('예시 기록이 오류 · 경고 없이 통과한다', (t) => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const { errors, warnings } = checkDataset(ds, ctx, order);
  assert.deepEqual(errors, [], list(errors));
  assert.deepEqual(warnings, [], list(warnings));
  const kinds = new Set(ds.candidates.map((c) => `${c.section}:${c.act}`));
  for (const k of ['facts:드러냄', 'questions:제기', 'events:회수', 'events:뒤집음', 'times:기준점', 'candidates:같은 인물', 'threads:독립', 'relations:맞물림', 'units:독립', 'units:보강']) assert.ok(kinds.has(k), `예시에 ${k}가 없다`);
  assert.ok(ds.candidates.some((c) => c.evidence?.some((e) => e.scene.startsWith('sub:'))), '금서고 씬 예시');
  assert.ok(ds.candidates.some((c) => c.evidence?.some((e) => e.scene.startsWith('d_'))), '블라링크 씬 예시');
  const n = nextIds(ds);
  assert.deepEqual([n.F, n.Q, n.S, n.V, n.L, n.J, n.G, n.K, n.eventOf('F2'), n.eventOf('F5')], ['F8', 'Q5', 'S3', 'V3', 'L2', 'J3', 'G2', 'K4', 'F2-3', 'F5-2']);
  assert.deepEqual([n.I, n.E, n.D, n.U, n.Y, n.T], ['I2', 'E4', 'D4', 'U2', 'Y3', 'T3'], '2회독 · 수동 엣지 · 소속 번호');
  t.diagnostic(`예시: 파일 ${ds.files.length} · 후보 ${ds.candidates.length}`);
});

test('검증기가 잡는다 — 없는 씬 · 줄, 상태 오타, 필수 칸, 기각된 것을 가리키는 참조 …', () => {
  const dir = tempCopy();
  const p = (f) => path.join(dir, f);
  const a = readJson(p('d_ex_elevator_01.json'));
  a.facts[0].evidence = [{ scene: 'd_ex_elevator_99', lines: [1] }];
  a.facts[1].evidence = [{ scene: 'd_ex_elevator_01', lines: [95, '9-3'] }];
  a.facts[2].status = '확정됨';
  a.facts[2].confidence = '확실함';
  delete a.questions[0].reason;
  a.questions[0].confidance = '확실';
  a.times[0].kind = '미래';
  a.times[0].ref = 'incident:없는_사건';
  a.events[0].answer = 'F99';
  a.events.push({ id: 'F5-2', act: '암시', evidence: [{ scene: 'd_ex_elevator_01', lines: [1] }], reason: 'x', confidence: '추정', status: '후보' });
  a.summary = '';
  writeJson(p('d_ex_elevator_01.json'), a);
  const b = readJson(p('sub.로망티스트_00.json'));
  b.facts[1].status = '기각'; // F2를 검토 기록 없이 기각 — F2-2(기각)는 괜찮지만 상태를 손으로 바꾼 것은 잡는다
  b.facts.push({ ...b.facts[1], id: 'F1', status: '후보' }); // 겹치는 ID
  b.targets.push({ target: 'person:없는_인물', evidence: [{ scene: 'sub:로망티스트_00', lines: [0] }], note: 'x' });
  b.facts[0].reviews[0].decision = '확정함';
  writeJson(p('sub.로망티스트_00.json'), b);
  const c = readJson(p('sub.로망티스트_01.json'));
  c.revisitDone.push({ id: 'V9', note: 'x' });
  c.events[0].status = '후보';
  delete c.events[1].answer;
  writeJson(p('sub.로망티스트_01.json'), c);
  // 이름이 틀린 파일 · 범위 밖 단위
  writeJson(p('ch99.json'), { unit: 'd_ex_gym_01', session: 'R01', by: 'claude', summary: 'x' });

  const ds = loadDataset({ dir });
  const { errors, warnings } = checkDataset(ds, ctx, order);
  const has = (file, id, re) => assert.ok(errors.some((e) => e.file === file && (id === null || e.id === id) && re.test(e.msg)), `${file} ${id ?? ''} ${re} 오류가 없다\n${list(errors)}`);
  has('d_ex_elevator_01.json', 'F5', /없는 씬 d_ex_elevator_99/);
  has('d_ex_elevator_01.json', 'F6', /없는 줄 d_ex_elevator_01#95/);
  has('d_ex_elevator_01.json', 'F6', /범위 9-3/);
  has('d_ex_elevator_01.json', 'F7', /상태 "확정됨"/);
  has('d_ex_elevator_01.json', 'F7', /확신도 "확실함"/);
  has('d_ex_elevator_01.json', 'Q3', /이유\(reason\)가 없다/);
  has('d_ex_elevator_01.json', 'S2', /kind "미래"/);
  has('d_ex_elevator_01.json', 'S2', /ref: 모르는 incident:없는_사건/);
  has('d_ex_elevator_01.json', 'Q3-2', /answer: 없는 사실 F99/);
  has('d_ex_elevator_01.json', 'F5-2', /암시는 2회독 몫/);
  has('d_ex_elevator_01.json', null, /summary/);
  has('sub.로망티스트_00.json', 'F2', /검토 기록\(reviews\)이 없다/);
  has('sub.로망티스트_00.json', 'F1', /ID가 겹친다/);
  has('sub.로망티스트_00.json', 'person:없는_인물', /사전에 없는 대상/);
  has('sub.로망티스트_00.json', 'F1', /결정 "확정함"/);
  has('sub.로망티스트_01.json', 'V9', /없는 되짚기 메모/);
  has('sub.로망티스트_01.json', 'Q2-2', /answer/);
  has('ch99.json', null, /파일 이름은 d_ex_gym_01.json/);
  has('ch99.json', null, /분석 범위 밖/);
  assert.ok(warnings.some((w) => w.id === 'Q3' && /모르는 칸 "confidance"/.test(w.msg)), '모르는 칸 경고');

  // 기각된 의문을 가리키는 회수 기록
  const fresh = readJson(path.join(EXAMPLE_DIR, 'd_ex_elevator_01.json'));
  fresh.questions[0].status = '기각';
  fresh.questions[0].reviews = [{ decision: '기각', by: 'claude', date: '2026-09-29' }];
  writeJson(p('d_ex_elevator_01.json'), fresh);
  for (const f of ['sub.로망티스트_00.json', 'sub.로망티스트_01.json', 'ch99.json']) fs.rmSync(p(f));
  const r2 = checkDataset(loadDataset({ dir }), ctx, order);
  assert.ok(r2.errors.some((e) => e.id === 'Q3-2' && /기각된 Q3를 가리킨다/.test(e.msg)), list(r2.errors));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('리뷰 화면 — 근거 줄에 ▶, 앞뒤 문맥, 미룬 후보가 먼저, 긴 범위는 줄인다', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const byId = new Map(ds.candidates.map((c) => [c.id, c]));
  const f5 = renderCandidate(byId.get('F5'), ctx, byId, { context: 2 });
  assert.match(f5, /^### F5 · 사실 · 후보 · 확실 — d_ex_elevator_01 \(R02 · claude\)/);
  assert.match(f5, /\n {2}▶ #22 라피: 70년 전\./);
  assert.match(f5, /\n {4}#20 /, '앞 문맥 2줄');
  assert.match(f5, /\n {4}#34 /, '뒤 문맥 2줄');
  const q = renderCandidate(byId.get('Q1-2'), ctx, byId);
  assert.match(q, /의문 Q1 로망티스트는 지상의 낚시 포인트를 찾아낼까\?/);
  assert.match(q, /답이 된 사실: F3 /);
  const long = evidenceLines(ctx, { scene: 'sub:로망티스트_01', lines: ['45-93'] }, 1);
  assert.ok(long.some((l) => /줄임/.test(l)) && long.length < 20, long.join('\n'));
  const pages = reviewPages(ds.candidates.filter((c) => c.status === '후보'), ds, ctx, order, {});
  assert.equal(pages.length, 1);
  assert.ok(pages[0].indexOf('### L1') < pages[0].indexOf('### F5'), '보류된 L1이 먼저');
  const brief = reviewPages(ds.candidates, ds, ctx, order, { brief: true })[0].split('\n').filter((l) => /^[FQSLJGKZBCOHIEDUYT]\d/.test(l));
  assert.equal(brief.length, ds.candidates.length, '간단히 보기는 후보마다 한 줄');
  const sel = select(ds, ['F3..F5', '의문']);
  assert.deepEqual(sel.picked.map((c) => c.id), [], '범위는 사실만인데 의문으로 거르면 비어야 한다');
  assert.deepEqual(select(ds, ['F3..F5']).picked.map((c) => c.id).sort(), ['F3', 'F4', 'F5']);
  assert.deepEqual(select(ds, ['R31', '의문']).picked.map((c) => c.id).sort(), ['Q1-2', 'Q2', 'Q2-2']);
});

test('결정 반영 — 고른 후보 객체만 고치고, 누가 · 언제를 남긴다', () => {
  const dir = tempCopy();
  let ds = loadDataset({ dir });
  const before = fs.readFileSync(path.join(dir, 'sub.로망티스트_00.json'), 'utf8');
  const pick = (ids) => ds.candidates.filter((c) => ids.includes(c.id));
  assert.throws(() => applyDecision(pick(['F2']), '확정', { by: '사용자' }), /claude뿐/, '기록은 Claude만 정한다');
  let r = applyDecision(pick(['F2', 'Q1']), '확정', { by: 'claude', date: '2026-10-01', session: 'RV1', note: '원문 그대로' });
  writeDecisions(ds, r.perFile);
  const after = fs.readFileSync(path.join(dir, 'sub.로망티스트_00.json'), 'utf8');
  const data = JSON.parse(after);
  assert.equal(data.facts[1].status, '확정');
  assert.deepEqual(data.facts[1].reviews, [{ decision: '확정', by: 'claude', date: '2026-10-01', session: 'RV1', note: '원문 그대로' }]);
  assert.equal(data.questions[0].status, '확정');
  // 고친 객체 밖은 글자 하나 다르지 않다
  const spans = parseSpans(before);
  const f2 = spans.entries.find((e) => e.key === 'facts').node.items[1];
  assert.equal(after.slice(0, f2.start), before.slice(0, f2.start));
  assert.equal(after.slice(after.indexOf('"questions"') - 4, after.indexOf('"questions"')), before.slice(before.indexOf('"questions"') - 4, before.indexOf('"questions"')));

  // 단위로 고르면 후보만 바꾸고, 보류는 상태를 두고 기록만 남긴다
  ds = loadDataset({ dir });
  r = applyDecision(ds.candidates.filter((c) => c.unit === 'sub:로망티스트_01'), '보류', { explicit: false, date: '2026-10-01' });
  assert.ok(r.skipped.some((x) => x.c.id === 'F2-2'), '기각된 F2-2는 건너뛴다');
  writeDecisions(ds, r.perFile);
  ds = loadDataset({ dir });
  assert.ok(ds.candidates.filter((c) => c.unit === 'sub:로망티스트_01' && c.status === '후보').every(isDeferred));
  assert.throws(() => applyDecision(pick(['F3', 'F4']), '확정', { text: 'x' }), /하나에만/);
  r = applyDecision(ds.candidates.filter((c) => c.id === 'F3'), '확정', { text: '고친 문장', date: '2026-10-01' });
  writeDecisions(ds, r.perFile);
  const f3 = readJson(path.join(dir, 'sub.로망티스트_01.json')).facts[0];
  assert.equal(f3.text, '고친 문장');
  assert.equal(f3.reviews.at(-1).before, '로망티스트가 지상에서 낚시 포인트를 찾아 지휘관에게 알려 주었다');
  const { errors } = checkDataset(loadDataset({ dir }), ctx, order);
  assert.deepEqual(errors, [], list(errors));

  // 명령 한 줄 — 기각하면 그것을 가리키는 기록을 알려 주고 종료 코드 1
  const cli = node(['tools/records.mjs', 'set', 'Q3', '기각', '--note', '테스트', '--dir', dir]);
  assert.equal(cli.status, 1, cli.stdout + cli.stderr);
  assert.match(cli.stdout, /기각 1: Q3/);
  assert.match(cli.stdout, /Q3-2: 기각된 Q3를 가리킨다/);
  // Q3을 든 줄기 J2, J2를 잇는 관계 G1도 같이 기각해야 오류가 없다
  const half = node(['tools/records.mjs', 'set', 'Q3-2', '기각', '--dir', dir]);
  assert.equal(half.status, 1, half.stdout + half.stderr);
  assert.match(half.stdout, /J2: questions: 기각된 Q3를 가리킨다/);
  const ok = node(['tools/records.mjs', 'set', 'J2', 'G1', '기각', '--dir', dir]);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /고친 파일: .*_threads\.json/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('떡밥 줄기 — 소속 계산 · 검증기 · 리뷰 고르기', () => {
  let ds = loadDataset({ dir: EXAMPLE_DIR });
  const m = threadMembership(ds);
  const j1 = m.byId.get('J1');
  const j2 = m.byId.get('J2');
  assert.deepEqual([j1.questions, j1.events, j1.facts, j1.aboutFacts], [['Q1', 'Q2', 'Q4'], ['Q1-2', 'Q2-2'], ['F3', 'F4'], ['F2']],
    '의문 → 회수 → 답, about은 곧바로 든 사실을 빼고(F4) 기각된 사건(F2-2)도 뺀다');
  assert.deepEqual([j2.questions, j2.facts, j2.aboutFacts], [['Q3'], ['F5', 'F7'], ['F6']], '직접 넣은 사실(F5) + 답(F7), about으로 F6');
  assert.equal(m.ofQuestion.get('Q3'), 'J2');
  assert.deepEqual(select(ds, ['줄기']).picked.map((c) => c.id), ['J1', 'J2']);
  assert.deepEqual(select(ds, ['J1..J2', 'G1']).picked.map((c) => c.id).sort(), ['G1', 'J1', 'J2']);
  assert.match(renderCandidate(ds.candidates.find((c) => c.id === 'J2'), ctx, new Map(ds.candidates.map((c) => [c.id, c]))), /의문 Q3 엘리베이터에 함께 탄/);

  const dir = tempCopy();
  const t = readJson(path.join(dir, '_threads.json'));
  t.threads[1].questions.push('Q1', 'Q99'); // 두 줄기에 든 의문 · 없는 의문
  t.threads[1].weight = '핵심';
  t.threads[0].questions = ['Q2']; // Q1이 J2로만 — 겹침은 안 나지만 위에서 Q1을 J2에 넣었다
  t.threads.push({ id: 'J3', title: 'x', text: 'x', weight: '독립', questions: [], reason: 'x', confidence: '추정', status: '후보' });
  t.relations[0].b = 'J9';
  t.relations[0].evidence = ['F99'];
  t.relations.push({ id: 'G2', type: '원인', a: 'J1', b: 'J1', evidence: [], reason: 'x', confidence: '추정', status: '후보' });
  writeJson(path.join(dir, '_threads.json'), t);
  ds = loadDataset({ dir });
  const { errors } = checkDataset(ds, ctx, order);
  const has = (id, re) => assert.ok(errors.some((e) => e.file.endsWith('_threads.json') && e.id === id && re.test(e.msg)), `${id} ${re} 오류가 없다
${list(errors)}`);
  has('J2', /없는 의문 Q99/);
  has('J2', /weight "핵심"/);
  has('J3', /의문\(questions\)도 사실\(facts\)도 없다/);
  has('G1', /없는 줄기 J9/);
  has('G1', /근거 "F99": 없는 기록/);
  has('G2', /a와 b가 같은 줄기다/);
  has('G2', /근거\(evidence\)가 없다/);
  t.threads[0].questions = ['Q1', 'Q2'];
  writeJson(path.join(dir, '_threads.json'), t);
  const again = checkDataset(loadDataset({ dir }), ctx, order);
  assert.ok(again.errors.some((e) => e.id === 'J2' && /Q1가 두 줄기에 든다/.test(e.msg)), list(again.errors));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('층 판정 — 규칙 · 계산 · 검증기 · set --grade', () => {
  // 규칙: 메인 · 서브퀘스트 · 유실물은 1층, 이벤트는 필수 · 보강 1층 · 독립 2층(기록 2건 이하 3층), 호감도는 등급대로, 이벤트 유실물은 이벤트를 따른다
  const L = (key, grade, records = 5, eventLayer = null) => ruleLayer({ key, grade, records, eventLayer });
  assert.deepEqual([L('ch07', null), L('sub:롬_00', '독립'), L('relic:장보기목록', '독립'), L('d_ex_elevator_01', '보강')], [1, 1, 1, 1]);
  assert.deepEqual([L('event_redash', '필수'), L('fl:absolute', '보강'), L('event_hightechtoy', '독립'), L('event_fullfoolday', '독립', 2)], [1, 1, 2, 3]);
  assert.deepEqual([L('char:10', '필수'), L('char:10', '보강'), L('char:10', '독립', 0)], [1, 2, 3]);
  assert.deepEqual([L('erelic:red_ash_lost', '보강', 5, 2), L('erelic:red_ash_lost', '필수', 5, 2), L('side:mudfish', '독립', 1)], [2, 1, 3]);
  // 참고(X3f)는 2층 — 일상극(3층)이 아니고 줄기에 걸린 1층도 아니다. 서브퀘스트 · 유실물은 등급과 상관없이 1층
  assert.deepEqual([L('event_hightechtoy', '참고', 1), L('char:10', '참고'), L('sub:롬_00', '참고'), L('erelic:red_ash_lost', '참고', 5, 1)], [2, 2, 1, 1]);
  assert.equal(L('char:10', null), null, '판정이 없으면 층도 없다');

  let ds = loadDataset({ dir: EXAMPLE_DIR });
  const lay = computeLayers(ds, order);
  const at = (k) => lay.byUnit.get(k);
  assert.deepEqual([at('sub:로망티스트_00').layer, at('sub:로망티스트_01').layer, at('sub:로망티스트_01').ruleLayer, at('d_ex_elevator_01').grade], [1, 2, 1, '보강'],
    'layer 칸은 규칙 층을 뒤집는다');
  assert.deepEqual([at('ch07').layer, at('ch07').grade], [1, null], '메인은 채점하지 않고 1층');
  assert.deepEqual(lay.missing, [], '기록이 있는 메인 밖 단위는 모두 판정됐다');
  assert.equal(at('char:10').layer, null, '안 읽은 단위는 판정도 층도 없다');
  assert.deepEqual(select(ds, ['층']).picked.map((c) => c.id), ['K1', 'K2', 'K3']);
  const byId = new Map(ds.candidates.map((c) => [c.id, c]));
  assert.match(renderCandidate(byId.get('K2'), ctx, byId, { brief: true, layers: lay }), /독립 → 2층\(규칙 1층을 뒤집음\) — 근거 Q1-2/);

  const dir = tempCopy();
  const f = readJson(path.join(dir, '_layers.json'));
  f.units.push(
    { id: 'K4', unit: 'ch07', grade: '독립', reason: 'x', confidence: '확실', status: '후보' },
    { id: 'K5', unit: 'sub:로망티스트_00', grade: '핵심', reason: 'x', confidence: '확실', status: '후보' },
    { id: 'K6', unit: 'char:10', grade: '보강', reason: 'x', confidence: '확실', status: '후보' },
    { id: 'K7', unit: 'char:11', grade: '필수', basis: 'F99', layer: 5, reason: 'x', confidence: '확실', status: '후보' },
    { id: 'K8', unit: 'event_없음', grade: '독립', basis: 'F1', reason: 'x', confidence: '확실', status: '후보' },
    // 메인 자리(X3f ⑤) — from · before는 필수 · 보강에만, before는 더 가벼운 등급이고 from과 같이
    { id: 'K9', unit: 'char:11', grade: '독립', from: 'ch20', reason: 'x', confidence: '확실', status: '기각' },
    { id: 'K10', unit: 'char:12', grade: '보강', basis: 'F1', from: 'ch99', before: '필수', reason: 'x', confidence: '확실', status: '기각' },
    { id: 'K11', unit: 'char:13', grade: '보강', basis: 'F1', before: '참고', reason: 'x', confidence: '확실', status: '기각' },
  );
  writeJson(path.join(dir, '_layers.json'), f);
  const z = readJson(path.join(dir, '_leads.json'));
  z.leads.push(
    { id: 'Z3', person: 'person:라피', from: 'ch02', reason: 'x', confidence: '확실', status: '후보' },
    { id: 'Z4', person: 'person:없는사람', from: 'ch99', arcs: ['ch05-ch03', '20장'], origin: 'ch07', records: ['F99'], confidence: '확실', status: '후보' },
    // 원점(X3f ①) — 판정이 있는 메인 밖 단위(필수여야 한다)나 "메인"
    { id: 'Z5', person: 'person:아니스', from: 'ch00', origin: 'sub:로망티스트_01', reason: 'x', confidence: '확실', status: '후보' },
    { id: 'Z6', person: 'person:네온', from: 'ch01', origin: 'event_redash', reason: 'x', confidence: '확실', status: '후보' },
    { id: 'Z7', person: 'person:지휘관', from: 'ch00', origin: '메인', reason: 'x', confidence: '확실', status: '후보' },
  );
  writeJson(path.join(dir, '_leads.json'), z);
  ds = loadDataset({ dir });
  const { errors, warnings } = checkDataset(ds, ctx, order);
  const has = (id, re) => assert.ok(errors.some((e) => e.file.endsWith('_layers.json') && e.id === id && re.test(e.msg)), `${id} ${re} 오류가 없다
${list(errors)}`);
  has('K4', /메인\(ch07\)은 채점하지 않는다/);
  has('K5', /grade "핵심"/);
  has('K6', /근거 한 건\(basis/);
  has('K7', /basis: 없는 기록 F99/);
  has('K7', /layer 5/);
  has('K8', /읽기 순서에 없는 단위 event_없음/);
  has('K9', /from · before는 필수 · 보강 판정에만/);
  has('K10', /from "ch99"/);
  has('K10', /before 필수는 등급 보강보다 가벼워야/);
  has('K11', /before만 있고 from이 없다/);
  const hasZ = (id, re) => assert.ok(errors.some((e) => e.file.endsWith('_leads.json') && e.id === id && re.test(e.msg)), `${id} ${re} 오류가 없다
${list(errors)}`);
  hasZ('Z3', /person:라피의 주역 항목이 둘이다/);
  hasZ('Z4', /person "person:없는사람"/);
  hasZ('Z4', /from "ch99"/);
  hasZ('Z4', /arcs ch05-ch03: 앞이 뒤보다 늦다/);
  hasZ('Z4', /arcs "20장"/);
  hasZ('Z4', /records: 없는 기록 F99/);
  hasZ('Z4', /이유\(reason\)가 없다/);
  hasZ('Z4', /origin "ch07" — 메인 밖 읽기 단위 키/);
  hasZ('Z6', /origin event_redash에 판정\(K\)이 없다/);
  assert.ok(!errors.some((e) => e.id === 'Z7'), '메인 밖 원점이 없으면 "메인"');
  assert.ok(warnings.some((w) => w.id === 'Z5' && /원점 sub:로망티스트_01\(K2\)이 독립 — 주역 조항의 원점은 필수/.test(w.msg)), list(warnings));
  assert.ok(errors.some((e) => e.id === null && /sub:로망티스트_00의 층 판정이 둘 이상/.test(e.msg)), list(errors));
  assert.ok(warnings.some((w) => w.id === 'K8' && /basis F1는 sub:로망티스트_00의 기록/.test(w.msg)), list(warnings));
  fs.rmSync(dir, { recursive: true, force: true });

  // 기준이 바뀌어 등급을 다시 판정한다 — 고치기 전 값이 검토 기록에 남고, --by를 안 주면 claude
  const dir2 = tempCopy();
  const cli = node(['tools/records.mjs', 'set', 'K3', '확정', '--grade', '필수', '--note', '테스트', '--dir', dir2]);
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  const k3 = readJson(path.join(dir2, '_layers.json')).units.find((u) => u.id === 'K3');
  assert.deepEqual([k3.grade, k3.status, k3.reviews.at(-1).before, k3.reviews.at(-1).by], ['필수', '확정', '등급 보강', 'claude']);
  const bad = node(['tools/records.mjs', 'set', 'F1', '확정', '--grade', '필수', '--dir', dir2]);
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stderr, /판정\(K<n>\) 하나에만/);
  // 다시 판정(X3a) — 근거 · 이유 · 기준 시점을 바꾸면 고치기 전 값이 남고, 다른 세션이 다시 보면 바뀐 게 없어도 검토 기록이 남는다
  const re = node(['tools/records.mjs', 'set', 'K3', '확정', '--basis', 'F6', '--reason', '새 이유', '--asof', '2026-10-01', '--session', 'X3b', '--by', 'claude', '--dir', dir2]);
  assert.equal(re.status, 0, re.stdout + re.stderr);
  const k3b = readJson(path.join(dir2, '_layers.json')).units.find((u) => u.id === 'K3');
  assert.deepEqual([k3b.basis, k3b.reason, k3b.asof, k3b.reviews.at(-1).session], ['F6', '새 이유', '2026-10-01', 'X3b']);
  assert.match(k3b.reviews.at(-1).before, /^근거 F5 · 기준 시점 없음 · 이유 갓데스 폴/);
  const again = node(['tools/records.mjs', 'set', 'K3', '확정', '--session', 'X3c', '--by', 'claude', '--note', '그대로', '--dir', dir2]);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  const k3c = readJson(path.join(dir2, '_layers.json')).units.find((u) => u.id === 'K3');
  assert.deepEqual([k3c.reviews.length, k3c.reviews.at(-1).session, k3c.reviews.at(-1).before], [k3b.reviews.length + 1, 'X3c', undefined], '다시 봄 — 검토 기록만 더한다');
  const same = node(['tools/records.mjs', 'set', 'K3', '확정', '--session', 'X3c', '--by', 'claude', '--dir', dir2]);
  assert.match(same.stdout, /건너뜀 1/, '같은 세션이 또 보면 건너뛴다');
  // 등급을 바꿔 규칙 층이 달라지면 읽은 층으로 묶는다 — --layer와 함께 준 --note는 판정의 note(까닭)에도 남는다
  const relayer = node(['tools/records.mjs', 'set', 'K3', '확정', '--layer', '2', '--session', 'X3d', '--by', 'claude', '--note', '2회독은 2층에서 읽음', '--dir', dir2]);
  assert.equal(relayer.status, 0, relayer.stdout + relayer.stderr);
  const k3d = readJson(path.join(dir2, '_layers.json')).units.find((u) => u.id === 'K3');
  assert.deepEqual([k3d.layer, k3d.note, k3d.reviews.at(-1).before], [2, '2회독은 2층에서 읽음', '층 규칙']);
  const badAsof = node(['tools/records.mjs', 'set', 'K3', '확정', '--asof', '10월', '--dir', dir2]);
  assert.equal(badAsof.status, 1);
  assert.match(badAsof.stderr, /--asof는 YYYY-MM-DD/);
  // 네 등급 · 메인 자리(X3f) — --grade 참고, --from · --before는 형식의 칸 자리에 끼우고 고치기 전 값이 남는다. 빈 값은 칸을 지운다
  const at2 = node(['tools/records.mjs', 'set', 'K3', '확정', '--grade', '필수', '--from', 'ch30', '--before', '독립', '--session', 'X3f-2', '--by', 'claude', '--dir', dir2]);
  assert.equal(at2.status, 0, at2.stdout + at2.stderr);
  const k3e = readJson(path.join(dir2, '_layers.json')).units.find((u) => u.id === 'K3');
  assert.deepEqual([k3e.grade, k3e.from, k3e.before], ['필수', 'ch30', '독립']);
  assert.deepEqual(Object.keys(k3e).slice(0, 6), ['id', 'unit', 'grade', 'basis', 'from', 'before'], '칸 순서는 형식(FIELDS.layer)대로');
  assert.equal(k3e.reviews.at(-1).before, '메인 자리 ch20 · 그 앞 등급 참고', '등급은 앞에서 이미 필수');
  const toRef = node(['tools/records.mjs', 'set', 'K3', '확정', '--grade', '참고', '--from', '', '--before', '', '--session', 'X3f-3', '--by', 'claude', '--dir', dir2]);
  assert.equal(toRef.status, 0, toRef.stdout + toRef.stderr);
  const k3f = readJson(path.join(dir2, '_layers.json')).units.find((u) => u.id === 'K3');
  assert.deepEqual([k3f.grade, 'from' in k3f, 'before' in k3f], ['참고', false, false]);
  const badBefore = node(['tools/records.mjs', 'set', 'K3', '확정', '--before', '가끔', '--dir', dir2]);
  assert.match(badBefore.stderr, /--before는 필수 · 보강 · 참고 · 독립/);
  const badFrom = node(['tools/records.mjs', 'set', 'F1', '확정', '--from', 'ch20', '--dir', dir2]);
  assert.match(badFrom.stderr, /--from · --before는 판정\(K<n>\) 하나에만/);
  // 주역(Z) — --from · --arcs(전체면 지운다)
  const lead = node(['tools/records.mjs', 'set', 'Z2', '확정', '--from', 'ch01', '--arcs', '전체', '--session', 'X3f-1', '--by', 'claude', '--dir', dir2]);
  assert.equal(lead.status, 0, lead.stdout + lead.stderr);
  const z2 = readJson(path.join(dir2, '_leads.json')).leads.find((x) => x.id === 'Z2');
  assert.deepEqual([z2.status, z2.from, 'arcs' in z2, z2.reviews.at(-1).before], ['확정', 'ch01', false, '메인 자리 ch00 · 범위 ch00-ch01 ch13-ch14']);
  const arcs = node(['tools/records.mjs', 'set', 'Z2', '확정', '--arcs', 'ch01-ch02 ch13', '--dir', dir2]);
  assert.equal(arcs.status, 0, arcs.stdout + arcs.stderr);
  assert.deepEqual(readJson(path.join(dir2, '_leads.json')).leads.find((x) => x.id === 'Z2').arcs, ['ch01-ch02', 'ch13']);
  const badArcs = node(['tools/records.mjs', 'set', 'K1', '확정', '--arcs', 'ch01', '--dir', dir2]);
  assert.match(badArcs.stderr, /--arcs · --origin · --records는 주역\(Z<n>\) 하나에만/);
  const origin = node(['tools/records.mjs', 'set', 'Z1', '확정', '--origin', 'd_ex_elevator_01', '--session', 'X3f-3', '--by', 'claude', '--dir', dir2]);
  assert.equal(origin.status, 0, origin.stdout + origin.stderr);
  const z1 = readJson(path.join(dir2, '_leads.json')).leads.find((x) => x.id === 'Z1');
  assert.deepEqual([z1.origin, Object.keys(z1).indexOf('origin') < Object.keys(z1).indexOf('reason'), z1.reviews.at(-1).before], ['d_ex_elevator_01', true, '원점 없음']);
  fs.rmSync(dir2, { recursive: true, force: true });

  // 2회독에서 읽은 층으로 묶는다(X3a) — 판정의 층이 읽은 층과 다르면 경고
  const readLayers = new Map([['sub:로망티스트_01', 1], ['d_ex_elevator_01', 1]]);
  const w2 = checkDataset(loadDataset({ dir: EXAMPLE_DIR }), ctx, order, { readLayers }).warnings;
  assert.ok(w2.some((w) => w.id === 'K2' && /2회독은 1층에서 읽었는데 판정의 층이 2층/.test(w.msg)), list(w2));
  assert.ok(!w2.some((w) => w.id === 'K3' && /읽었는데/.test(w.msg)), '같은 층이면 경고하지 않는다');
});

test('2회독에서 읽은 층 — docs/history/reading.md P · M의 #### N층 머리줄', () => {
  const text = ['### P · M. 2회독', '#### 1층 — …', '- [x] **P1 👤 파일럿** ch00–01 · `sub:a_00` — 1만 자', '- [x] **M01** `sub:a_01` — 1만 자',
    '#### 2층 — …', '- [ ] **M02** `event_x` `char:10` — 2만 자', '### X. 분석', '- [ ] **M99** `char:11` — 머리줄 밖'].join('\n');
  const r = parseReadLayers(text);
  assert.deepEqual(Object.fromEntries(r), { ch00: 1, ch01: 1, 'sub:a_00': 1, 'sub:a_01': 1, event_x: 2, 'char:10': 2 });
});

test('JSON 부분 고쳐 쓰기 — 다른 곳의 모양을 그대로 둔다', () => {
  const text = '{\n  "a": [1, 2],\n  "list": [\n    { "id": "F1", "x": 1 },\n    {\n      "id": "F2",\n      "x": 2\n    }\n  ]\n}\n';
  const out = replaceValues(text, [{ path: ['list', 1], value: { id: 'F2', x: 3, reviews: [{ decision: '확정' }] } }]);
  assert.deepEqual(JSON.parse(out).list[1], { id: 'F2', x: 3, reviews: [{ decision: '확정' }] });
  assert.ok(out.startsWith('{\n  "a": [1, 2],\n  "list": [\n    { "id": "F1", "x": 1 },\n    {'), out);
});

test('인계 파일 — 목록 · 세션 요약 · 먼저 읽을 것(열린 의문 · 직전 세션 · 이번 항목 맞춤), 기각 뺌, 크기 상한, 같은 기록이면 같은 파일', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR });
  const built = buildHandoff(ds, ctx, order);
  assert.deepEqual([...built.files.keys()].sort(), ['HANDOFF.md', 'handoff/R02.md', 'handoff/R17.md', 'handoff/R31.md', 'handoff/facts.md', 'handoff/focus.md',
    'handoff/index.md', 'handoff/questions-solved.md', 'handoff/questions.md', 'handoff/recent.md']);
  assert.deepEqual(built.firstNames, ['HANDOFF.md', 'handoff/questions.md', 'handoff/recent.md', 'handoff/focus.md']);
  const facts = built.files.get('handoff/facts.md');
  assert.match(facts, /- F1 ✓ /);
  assert.doesNotMatch(facts, /F2-2/, '기각된 뒤집음은 뺀다');
  assert.match(built.files.get('handoff/R31.md'), /설정 오류 추정:\n- 예시 — 1편은 옥살이/);
  const qs = built.files.get('handoff/questions.md');
  const head = built.files.get('HANDOFF.md');
  assert.match(built.files.get('handoff/questions-solved.md'), /## 풀린 의문 — R17\n- Q1 .* 풀림 → F3 \(Q1-2 sub:로망티스트_01\)/);
  assert.doesNotMatch(qs, /- Q1 /, '풀린 의문은 먼저 읽을 것에서 뺀다');
  assert.match(qs, /## 일부 풀린 의문 — R02\n- Q3 /);
  const recent = built.files.get('handoff/recent.md');
  assert.match(recent, /^# 직전 세션 사실 — R31\n/);
  const focus = built.files.get('handoff/focus.md');
  assert.match(focus, /^# 이번 항목 맞춤 — R01 원문 대상의 앞 사실\n/);
  assert.match(focus, /원문에 많이 나오는 대상\(줄 수, 상위 20\): 라피 /);
  assert.match(head, /\| handoff\/focus\.md \| 이번 항목\(R01\) 원문 대상의 앞 사실 \d+건 \|/);
  assert.match(head, /다음: \*\*R01\*\*/);
  assert.match(head, /다음 번호: 사실 F8 · 의문 Q5 · 시점 S3 · 되짚기 V3 · 정체 연결 L2/);
  assert.ok(built.firstTotal <= FIRST_MAX);
  assert.deepEqual([...buildHandoff(ds, ctx, order).files], [...built.files], '두 번 만들면 같아야 한다');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'));
  writeHandoff(built, dir);
  assert.deepEqual(staleHandoff(built, dir), []);
  fs.writeFileSync(path.join(dir, 'handoff', 'R99.md'), 'old');
  assert.deepEqual(staleHandoff(built, dir), ['handoff/R99.md (옛 파일)']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('이번 항목 맞춤 — 원문 대상 뽑기 · 사실 고르기(드문 대상 먼저 · 예산 · 결정적)', () => {
  const hits = sourceTargets(ctx, ['ch00']);
  assert.ok(hits.get('person:라피') > 0 && hits.get('person:아니스') > 0, '이름표로 잡힌다');
  assert.deepEqual([...sourceTargets(ctx, ['ch00'])], [...hits], '같은 원문이면 같은 결과');
  const f = (id, about) => ({ id, obj: { about } });
  const facts = [f('F1', ['person:a']), f('F2', ['person:a']), f('F3', ['person:a']), f('F4', ['person:b']), f('F5', ['person:c']), f('F6', ['person:a', 'person:b'])];
  const h = new Map([['person:a', 100], ['person:b', 30]]); // a: log2(101)/4 ≈ 1.66 · b: log2(31)/2 ≈ 2.48
  const all = pickFacts(facts, facts, h, 1e9, () => 10);
  assert.deepEqual(all.picked.map((p) => p.fact.id), ['F6', 'F4', 'F1', 'F2', 'F3'], '드문 대상(b) 사실이 먼저, 원문에 없는 대상(c)은 빠진다');
  assert.equal(all.picked[0].best, 'person:b');
  const some = pickFacts(facts, facts, h, 25, () => 10);
  assert.deepEqual([some.picked.length, some.total, some.left], [2, 20, 3], '예산을 넘기 전까지만');
});

test('실제 기록(annotations/read1/) — 오류 없음 · 인계 파일 최신 · 정체 연결 후보 ID', (t) => {
  const ds = loadDataset({ dir: READ1_DIR });
  const { errors, warnings } = checkDataset(ds, ctx, order);
  assert.deepEqual(errors, [], `${list(errors)}\n→ node tools/records.mjs check`);
  const built = buildHandoff(ds, ctx, order);
  assert.deepEqual(staleHandoff(built, READ1_DIR), [], '인계 파일이 오래됐다 → node tools/records.mjs handoff');
  assert.ok(built.firstTotal <= FIRST_MAX, `먼저 읽을 것 ${built.firstTotal}자 — ${FIRST_MAX}자 안쪽이어야 한다`);
  for (const [name, text] of built.files) assert.ok([...text].length <= FILE_MAX || name === 'HANDOFF.md', `${name}이 ${FILE_MAX}자를 넘는다`);
  const links = ds.candidates.filter((c) => c.people);
  assert.ok(links.length >= 5 && links.every((c) => /^L\d+$/.test(c.id)), 'people.json 후보마다 id L<n>');
  const idsInDb = db.prepare('SELECT id FROM target_links ORDER BY id').all().map((r) => r.id);
  assert.deepEqual(idsInDb, links.map((c) => c.id).sort(), 'DB target_links.id');
  t.diagnostic(`실제 기록: 파일 ${ds.files.length} · 후보 ${ds.candidates.length - links.length} · 경고 ${warnings.length} · 먼저 읽을 것 ${built.firstTotal}자`);
});

test('1회독 · 2회독 기록 · 떡밥 줄기 · 층 판정 · 수동 엣지는 DB 빌드 입력이 아니다 — 고쳐도 DB를 다시 만들지 않는다', async () => {
  const { inputsFingerprint } = await import('../tools/normalize/ensure-db.mjs');
  const madeRead2 = !fs.existsSync(READ2_DIR);
  if (madeRead2) fs.mkdirSync(READ2_DIR, { recursive: true });
  const before = inputsFingerprint();
  const probe = path.join(READ1_DIR, '_fingerprint_probe.tmp');
  const probe2 = path.join(READ2_DIR, '_fingerprint_probe.tmp');
  const linksProbe = fs.existsSync(LINKS_PATH) ? null : LINKS_PATH;
  fs.writeFileSync(probe, 'x');
  fs.writeFileSync(probe2, 'x');
  if (linksProbe) fs.writeFileSync(linksProbe, '{}');
  const sides = ['annotations/threads.json', 'annotations/layers.json'].map((p) => path.join(ROOT, p));
  const st = sides.map((p) => fs.statSync(p));
  try {
    assert.equal(inputsFingerprint(), before);
    sides.forEach((p, i) => fs.utimesSync(p, st[i].atime, new Date(st[i].mtimeMs + 60_000))); // 떡밥 줄기 · 층 판정도 빌드 입력이 아니다
    assert.equal(inputsFingerprint(), before);
  } finally {
    fs.rmSync(probe, { force: true });
    fs.rmSync(probe2, { force: true });
    if (linksProbe) fs.rmSync(linksProbe, { force: true });
    if (madeRead2) fs.rmSync(READ2_DIR, { recursive: true, force: true });
    sides.forEach((p, i) => fs.utimesSync(p, st[i].atime, st[i].mtime));
  }
});
