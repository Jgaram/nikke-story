/**
 * N2c — 업데이트 체크리스트 · 검사기(tools/update/checklist.mjs).
 * annotations/의 기록 파일 · 폴더는 모두 체크리스트 항목 하나에 들어야 한다(docs/update.md "늘어남 막기").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECKLIST, NOT_RECORDS, STAGES, MARKS_PATH, evaluate, findMark, itemById, loadEnv, mentions, parseUpdateItems, renderList } from '../tools/update/checklist.mjs';
import { READ1_PREFIXES, READ2_PREFIXES, parseOrder } from '../tools/records/order.mjs';
import { ORDER_PREFIXES } from '../tools/update.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANN = path.join(ROOT, 'annotations');

test('annotations/의 기록 파일 · 폴더마다 체크리스트 항목 하나 — 기록이 아닌 것은 NOT_RECORDS에 이유와', () => {
  const covered = new Set(CHECKLIST.flatMap((it) => it.files.map((f) => f.split('/')[0])));
  for (const name of fs.readdirSync(ANN)) {
    if (name.startsWith('.')) continue;
    assert.ok(covered.has(name) || NOT_RECORDS[name], `annotations/${name} — 체크리스트 항목(tools/update/checklist.mjs)의 files에 넣거나 NOT_RECORDS에 이유와 둔다`);
  }
  for (const it of CHECKLIST) for (const f of it.files) assert.ok(fs.existsSync(path.join(ANN, f)), `${it.id}: annotations/${f}가 없다`);
  for (const [name, why] of Object.entries(NOT_RECORDS)) {
    assert.ok(fs.existsSync(path.join(ANN, name)), `NOT_RECORDS ${name}가 없다 — 지운다`);
    assert.ok(!covered.has(name), `${name}는 항목에도 NOT_RECORDS에도 있다`);
    assert.ok(why.length > 4);
  }
});

test('항목 모양 — id 하나씩 · 단계 U1–U4 · auto는 check · 문서 절이 있다', () => {
  assert.equal(new Set(CHECKLIST.map((it) => it.id)).size, CHECKLIST.length);
  let last = 0;
  for (const it of CHECKLIST) {
    assert.ok(STAGES.includes(it.stage), it.id);
    assert.ok(STAGES.indexOf(it.stage) >= last, `${it.id} — 단계 차례대로 둔다`);
    last = STAGES.indexOf(it.stage);
    assert.ok(['unit', 'patch'].includes(it.scope), it.id);
    assert.ok(['auto', 'mark'].includes(it.how), it.id);
    if (it.how === 'auto') assert.equal(typeof it.check, 'function', it.id);
    const m = it.doc.match(/^(docs\/[\w-]+\.md)(?: "(.+)")?/);
    assert.ok(m, `${it.id} doc "${it.doc}"`);
    const text = fs.readFileSync(path.join(ROOT, m[1]), 'utf8');
    if (m[2]) assert.ok(text.split('\n').some((l) => /^#+ /.test(l) && l.includes(m[2])), `${it.id}: ${m[1]}에 절 "${m[2]}"가 없다`);
  }
  for (const st of STAGES) assert.match(renderList(), new RegExp(`^${st} `, 'm'));
});

test('표시 파일 annotations/checklist.json — 판단 항목에만, 단위 항목은 단위 키 · 패치 항목은 null, note 필수', () => {
  const d = JSON.parse(fs.readFileSync(MARKS_PATH, 'utf8'));
  assert.ok(Array.isArray(d.marks));
  for (const m of d.marks) {
    const it = itemById(m.item);
    assert.ok(it, `없는 항목 ${m.item}`);
    assert.equal(it.how, 'mark', `${m.item}는 자동 항목이라 표시로 채우지 않는다`);
    assert.equal(m.unit == null, it.scope === 'patch', `${m.item} unit`);
    assert.match(m.patch, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(typeof m.note === 'string' && m.note.trim().length >= 4, `${m.item} note`);
  }
});

test('U 읽기 항목 — 1회독 · 2회독 순서에 다 들고, 줄 끝 "패치 날짜"로 패치에 묶인다', () => {
  for (const list of [READ1_PREFIXES, READ2_PREFIXES, ORDER_PREFIXES]) assert.ok(list.includes('U'));
  const text = [
    '- [x] **R99** `char:870` — 9.1만 자',
    '- [ ] **U01** `fl:coin_rush_show_down` · `char:63` — 패치 2026-09-17 · 5.0만 자 · 4파트',
    '- [ ] **U02** ch49 · `sub:새_00` — 6만 자 · 패치 2026-10-08',
  ].join('\n');
  const u = parseUpdateItems(text);
  assert.deepEqual(u.map((x) => [x.session, x.key, x.patch]), [
    ['U01', 'fl:coin_rush_show_down', '2026-09-17'], ['U01', 'char:63', '2026-09-17'], ['U02', 'ch49', '2026-10-08'], ['U02', 'sub:새_00', '2026-10-08'],
  ]);
  assert.deepEqual(parseOrder(text, READ1_PREFIXES).sessions.map((s) => s.id), ['R99', 'U01', 'U02']);
});

test('판정 — 자동 · 기록 근거 · 표시 · 해당 없음 · 단계', () => {
  const unit = { key: 'event_x', scenes: new Set(['event_x_01']), held: false, inDb: true, updateItem: { session: 'U01' } };
  const main = { key: 'ch49', scenes: new Set(['ch49_01']), held: false, inDb: true, updateItem: { session: 'U01' } };
  const files = { 'links.json': { edges: [{ a: 'event_x', b: 'ch10' }] } };
  const env = {
    patch: { day: '2026-10-08', title: '10월 8일 업데이트 공지' }, patchUnits: [unit, main], unplaced: [], unordered: [],
    inScopeUnits: [], regions: new Map(), flEventFiles: [], flMap: {}, spineUnits: new Set(), threadQuestions: new Set(['Q1']),
    ds: { candidates: [{ unit: 'event_x', kind: 'question', role: 'def', id: 'Q1', status: '후보' }, { unit: 'event_x', kind: 'question', role: 'def', id: 'Q2', status: '기각' }] },
    json: (name) => files[name] ?? null,
    marks: [{ patch: '2026-10-08', unit: 'event_x', item: 'identity', note: '같은 사람 · 다른 사람 드러남 없음' }, { patch: '2026-10-08', unit: null, item: 'spine', note: '주년 · 하프 아님' }],
    read1: (k) => (k === 'event_x' ? [{ data: { unit: k, targets: [], date: '2026-10-20' } }] : []),
    read2: () => [],
    layerOf: () => null,
    fromUnits: () => [],
  };
  const r = evaluate(env);
  const row = (item, unit) => r.rows.find((x) => x.item === item && x.unit === unit);
  assert.equal(row('source', 'event_x').state, '채움');
  assert.equal(row('read1', 'event_x').state, '채움');
  assert.equal(row('read1', 'ch49').state, '빠짐');
  assert.equal(row('dictionary', 'event_x').state, '채움');
  assert.equal(row('read2', 'event_x').state, '빠짐');
  assert.equal(row('threads', 'event_x').state, '채움', '기각한 의문은 줄기에 안 들어도 된다');
  assert.equal(row('links', 'event_x').why, '기록 있음');
  assert.equal(row('links', 'ch49').state, '빠짐');
  assert.match(row('identity', 'event_x').why, /^표시: /);
  assert.equal(row('identity', 'ch49').state, '빠짐', '표시는 단위마다');
  assert.equal(row('spine', null).state, '채움');
  assert.equal(row('layer', 'ch49').state, '해당 없음', '메인 챕터는 층 판정이 없다');
  assert.equal(row('blurbs', 'ch49').state, '해당 없음');
  assert.equal(row('april-fools', null).state, '해당 없음');
  assert.equal(r.missing, r.rows.filter((x) => x.state === '빠짐').length);
  const u1 = evaluate(env, { stage: 'U1' });
  assert.ok(u1.rows.every((x) => x.stage === 'U1'));
  assert.equal(u1.missing, 0);
  assert.ok(!evaluate(env, { patchLevel: false }).rows.some((x) => x.unit === null));
  assert.ok(findMark(env.marks, { patch: '2026-10-08', unit: null, item: 'spine' }));
  assert.equal(findMark(env.marks, { patch: '2026-09-17', unit: null, item: 'spine' }), undefined);
});

test('판정 — DB에서 보는 패치 항목(출시 표 · 이름표 · 표본 정밀도, N2e)', () => {
  const check = (id, env) => itemById(id).check({ unplaced: [], ...env });
  for (const id of ['release', 'speakers', 'precision']) assert.equal(check(id, { undated: [], unclassifiedSpeakers: [], unmeasuredNames: [] }), null, id);
  assert.match(check('release', { undated: ['event_x'] }), /release-order/);
  assert.match(check('speakers', { unclassifiedSpeakers: ['경비원 A'] }), /경비원 A/);
  assert.match(check('precision', { unmeasuredNames: ['신'] }), /신/);
  assert.equal(itemById('layer').stage, 'U2', '층 판정은 2회독 전 — 층이 2회독 깊이를 정한다');
});

test('mentions — 단위 키 · 그 단위 씬 ID가 값으로 나오면', () => {
  assert.ok(mentions({ a: [{ scene: 'x_01' }] }, 'x', new Set(['x_01'])));
  assert.ok(mentions({ unit: 'x' }, 'x', new Set()));
  assert.ok(!mentions({ x: 'y', note: 'x 이야기' }, 'x', new Set()), '키 이름 · 문장 속 언급은 세지 않는다');
});

test('지금 데이터 — 패치 공통 자동 항목(지역 · 매핑 · 순서)이 채워져 있다', async () => {
  const env = await loadEnv({ units: [], today: '2026-10-14' });
  for (const id of ['regions', 'fl-map']) assert.equal(itemById(id).check(env), null, id);
  assert.deepEqual(env.unordered, [], '범위 안 단위는 모두 읽기 항목에 있다(새 단위는 U1이 U 항목으로)');
});
