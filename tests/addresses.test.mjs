/**
 * 호칭 기록(annotations/addresses.json, W22) — 형식은 docs/annotations.md "호칭 기록".
 * 예시는 tests/fixtures/read1/_addresses.json. 실장판 · 음성 대사는 DB characters · character_voices와 대조한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { EXAMPLE_DIR, ROOT, loadDataset, nextIds } from '../tools/records/model.mjs';
import { applyDecision, renderCandidate, select, writeDecisions } from '../tools/records/review.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const READ2_EXAMPLE = path.join(ROOT, 'tests/fixtures/read2');
const list = (xs) => xs.slice(0, 12).map((x) => `${x.file}${x.id ? ` ${x.id}` : ''}: ${x.msg}`).join('\n');
const addrErrors = (r) => r.errors.filter((e) => /addresses/.test(e.file));
const copyExample = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'addr-'));
  for (const f of fs.readdirSync(EXAMPLE_DIR)) fs.copyFileSync(path.join(EXAMPLE_DIR, f), path.join(dir, f));
  return dir;
};

test('예시 호칭 기록이 검증기를 통과하고, 실제 기록(있으면)도 통과한다', () => {
  const ex = checkDataset(loadDataset({ dir: EXAMPLE_DIR, read2: READ2_EXAMPLE }), ctx, null);
  assert.deepEqual(addrErrors(ex), [], list(addrErrors(ex)));
  assert.deepEqual(ex.warnings.filter((e) => /addresses/.test(e.file)), []);
  const r = checkDataset(loadDataset(), ctx, null);
  assert.deepEqual(addrErrors(r), [], list(addrErrors(r)));
});

test('호칭 기록을 읽는다 — 종류 · 문장 · 다음 번호 · 고르기(종류 이름 · 범위)', () => {
  const ds = loadDataset({ dir: EXAMPLE_DIR, read2: READ2_EXAMPLE });
  const as = ds.candidates.filter((c) => c.addr);
  assert.deepEqual(as.map((c) => c.id), ['A1', 'A2', 'A3']);
  assert.ok(as.every((c) => c.kind === 'addr' && c.unit === null));
  assert.equal(as[1].text, 'person:네온 (rid 11) → 스승님');
  assert.equal(nextIds(ds).A, 'A4');
  assert.deepEqual(select(ds, ['호칭']).picked.map((c) => c.id), ['A1', 'A2', 'A3']);
  assert.deepEqual(select(ds, ['A2..A3']).picked.map((c) => c.id).sort(), ['A2', 'A3']);
  assert.deepEqual(select(ds, ['T1..T2']).picked.map((c) => c.id).sort(), ['T1', 'T2']);
  const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
  const brief = renderCandidate(as[0], ctx, byId, { brief: true });
  assert.match(brief, /^A1 \[확정 · 확실\] 호칭 person:라피 \(rid 10\) → 지휘관 — 음성 c010_Lobby_Touch_2/);
  const full = renderCandidate(as[0], ctx, byId, {});
  assert.match(full, /음성 c010_Lobby_Touch_2 \(rid 10 · /);
});

test('검증기가 잡는다 — 없는 실장판 · 다른 판의 인물 · 남의 음성 · 근거 없음 · 긴 호칭 · 같은 실장판 둘', () => {
  const dir = copyExample();
  const file = path.join(dir, '_addresses.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const base = { reason: 'x', confidence: '확실', status: '후보' };
  d.addresses.push(
    { id: 'A4', rid: 999999, person: 'person:라피', address: '지휘관', voice: ['c010_Lobby_Touch_1'], ...base },
    { id: 'A5', rid: 11, person: 'person:라피', address: '지휘관', voice: ['c010_Lobby_Touch_1', 'c999_없는_음성'], ...base },
    { id: 'A6', rid: 16, person: 'person:라피', address: '', ...base },
    { id: 'A7', rid: 10, person: 'person:라피', address: '가'.repeat(21), also: ['가'.repeat(21)], voice: ['c010_Lobby_Touch_1'], ...base },
    { id: 'A8', rid: '10', person: 'person:라피', address: '지휘관', voice: [], evidence: [{ scene: 'ep:d_nikke_rapi_redhood_01', lines: [99999] }], ...base },
  );
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  const r = checkDataset(loadDataset({ dir, read2: READ2_EXAMPLE }), ctx, null);
  const errs = (id) => r.errors.filter((e) => e.id === id).map((e) => e.msg).join(' | ');
  const warns = (id) => r.warnings.filter((e) => e.id === id).map((e) => e.msg).join(' | ');
  assert.match(errs('A4'), /rid 999999: DB characters에 없는/);
  assert.match(errs('A5'), /rid 11\(네온\)의 인물은 person:네온/);
  assert.match(errs('A5'), /c010_Lobby_Touch_1는 rid 10의 음성 대사/);
  assert.match(errs('A5'), /없는 음성 대사 c999_없는_음성/);
  assert.match(errs('A5'), /rid 11의 호칭 기록이 둘이다 — A2/);
  assert.match(errs('A6'), /address/);
  assert.match(errs('A6'), /근거가 없다/);
  assert.match(errs('A6'), /rid 16의 호칭 기록이 둘이다 — A3/);
  assert.match(errs('A7'), /address가 21자/);
  assert.match(warns('A7'), /also에 address/);
  assert.match(errs('A7'), /rid 10의 호칭 기록이 둘이다 — A1/);
  assert.match(errs('A8'), /rid "10"/);
  assert.match(errs('A8'), /없는 줄/);
});

test('기각된 기록은 같은 실장판 겹침에 들지 않는다', () => {
  const dir = copyExample();
  const file = path.join(dir, '_addresses.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  d.addresses.push({ id: 'A4', rid: 11, person: 'person:네온', address: '사부', voice: ['c011_Lobby_Touch_1'], reason: 'x', confidence: '추정', status: '기각',
    reviews: [{ decision: '기각', by: 'claude', date: '2026-10-14', session: '예시' }] });
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  const r = checkDataset(loadDataset({ dir, read2: READ2_EXAMPLE }), ctx, null);
  assert.deepEqual(addrErrors(r), [], list(addrErrors(r)));
});

test('set으로 호칭 기록을 확정한다 — 검토 기록이 붙고 파일의 그 항목만 바뀐다', () => {
  const dir = copyExample();
  const ds = loadDataset({ dir, read2: READ2_EXAMPLE });
  const { picked, explicit } = select(ds, ['A3']);
  assert.equal(picked[0]?.kind, 'addr');
  const r = applyDecision(picked, '확정', { by: 'claude', date: '2026-10-14', session: 'W22', note: '예시', explicit });
  writeDecisions(ds, r.perFile);
  const data = JSON.parse(fs.readFileSync(path.join(dir, '_addresses.json'), 'utf8'));
  assert.equal(data.addresses[2].status, '확정');
  assert.equal(data.addresses[2].reviews.at(-1).by, 'claude');
  assert.equal(data.addresses[2].reviews.at(-1).session, 'W22');
  assert.equal(data.addresses[1].status, '후보');
  const after = checkDataset(loadDataset({ dir, read2: READ2_EXAMPLE }), ctx, null);
  assert.deepEqual(addrErrors(after), [], list(addrErrors(after)));
});
