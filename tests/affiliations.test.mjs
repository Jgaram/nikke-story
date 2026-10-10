/**
 * 소속 기록(annotations/affiliations.json) · 소속 마크(tools/blabla/marks.mjs → site/img/orgs/) · 화면 계산(fmt.orgsAt).
 * 형식은 docs/annotations.md "소속 기록", 사이트 쪽은 docs/views.md "소속 마크".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { EXAMPLE_DIR, ROOT, loadDataset } from '../tools/records/model.mjs';
import { applyDecision, writeDecisions } from '../tools/records/review.mjs';
import { AFFIL_FILE, CORPS, INDEX_FILE, IMG_DIR, checkGameMap, readGameAffiliations } from '../tools/blabla/marks.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const READ2_EXAMPLE = path.join(ROOT, 'tests/fixtures/read2');
const list = (xs) => xs.slice(0, 12).map((x) => `${x.file}${x.id ? ` ${x.id}` : ''}: ${x.msg}`).join('\n');
const affilErrors = (r) => r.errors.filter((e) => /affiliations/.test(e.file));

test('게임 코드 → 사전 조직 대응이 게임 데이터의 기업 5 · 스쿼드 전부를 덮고, 조직 ID는 사전에 있다', () => {
  const game = readGameAffiliations();
  assert.deepEqual(game.problems, []);
  assert.ok(Object.keys(game.chars).length >= 200, `실장 니케 ${Object.keys(game.chars).length}`);
  assert.ok(Object.keys(game.squads).length >= 65, `스쿼드 ${Object.keys(game.squads).length}`);
  const map = JSON.parse(fs.readFileSync(AFFIL_FILE, 'utf8')).game;
  assert.deepEqual(checkGameMap(game, map), []);
  const orgs = new Set(db.prepare("SELECT id FROM targets WHERE type = 'org'").all().map((r) => r.id));
  for (const [sec, m] of Object.entries(map)) for (const [code, id] of Object.entries(m)) if (id !== null) assert.ok(orgs.has(id), `game.${sec}.${code}: 사전에 없는 ${id}`);
});

test('실제 소속 기록이 검증기를 통과한다', () => {
  const r = checkDataset(loadDataset(), ctx, null);
  assert.deepEqual(affilErrors(r), [], list(affilErrors(r)));
});

test('검증기가 잡는다 — 없는 인물 · 조직, act 오타, 근거 없음, 남의 변화 기록, 모르는 게임 대응', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'affil-'));
  for (const f of fs.readdirSync(EXAMPLE_DIR)) fs.copyFileSync(path.join(EXAMPLE_DIR, f), path.join(dir, f));
  const file = path.join(dir, '_affiliations.json');
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  d.game.squads.Nowhere = 'org:없는_스쿼드';
  d.affiliations.push(
    { id: 'T3', person: 'person:없는_사람', org: 'org:카운터스', act: '소속', evidence: [{ scene: 'd_ex_elevator_01', lines: [22] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'T4', person: 'person:라피', org: 'place:방주', act: '전출', evidence: [{ scene: 'd_ex_elevator_01', lines: [22] }], reason: 'x', confidence: '확실', status: '후보' },
    { id: 'T5', person: 'person:라피', org: 'org:카운터스', act: '합류', records: ['D1'], reason: 'x', confidence: '확실', status: '후보' },
  );
  fs.writeFileSync(file, JSON.stringify(d, null, 2));
  const r = checkDataset(loadDataset({ dir, read2: READ2_EXAMPLE }), ctx, null);
  const msgs = (id) => [...r.errors, ...r.warnings].filter((e) => e.id === id).map((e) => e.msg).join(' | ');
  assert.match(msgs('T3'), /person/);
  assert.match(msgs('T4'), /org/);
  assert.match(msgs('T4'), /act "전출"/);
  assert.match(msgs('T5'), /evidence|근거/);
  assert.match(msgs('T5'), /로망티스트의 변화/);
  assert.ok(r.errors.some((e) => /game\.squads\.Nowhere/.test(e.msg)), '사전에 없는 게임 대응');
});

test('set으로 소속 기록을 확정한다 — 검토 기록이 붙고 파일의 그 항목만 바뀐다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'affil-'));
  for (const f of fs.readdirSync(EXAMPLE_DIR)) fs.copyFileSync(path.join(EXAMPLE_DIR, f), path.join(dir, f));
  const ds = loadDataset({ dir, read2: READ2_EXAMPLE });
  const t2 = ds.candidates.filter((c) => c.id === 'T2');
  assert.equal(t2[0]?.kind, 'affil');
  const r = applyDecision(t2, '확정', { by: 'claude', date: '2026-10-10', session: 'W12b', note: '예시' });
  writeDecisions(ds, r.perFile);
  const data = JSON.parse(fs.readFileSync(path.join(dir, '_affiliations.json'), 'utf8'));
  assert.equal(data.affiliations[1].status, '확정');
  assert.equal(data.affiliations[1].reviews.at(-1).by, 'claude');
  assert.equal(data.affiliations[0].status, '확정');
  const after = checkDataset(loadDataset({ dir, read2: READ2_EXAMPLE }), ctx, null);
  assert.deepEqual(affilErrors(after), [], list(affilErrors(after)));
});

test('소속 마크 — 쓰이는 기업 · 스쿼드 마크가 다 받아져 있고 작다', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  assert.deepEqual(Object.keys(index.corporations).sort(), Object.keys(CORPS).sort());
  const used = new Set([...Object.values(index.corporations), ...Object.values(index.squads)].map((m) => m.icon));
  assert.ok(!used.has(undefined), '마크가 빠진 기업 · 스쿼드가 있다 — node tools/blabla/marks.mjs');
  for (const icon of used) {
    const f = path.join(IMG_DIR, `${icon}.png`);
    assert.ok(fs.existsSync(f), `${icon}.png 없음`);
    assert.ok(fs.statSync(f).size < 200_000, `${icon}.png가 크다`);
  }
  for (const [rid, [corp, squad]] of Object.entries(index.chars)) assert.ok(index.corporations[corp] && index.squads[squad], `resource_id ${rid}: ${corp} · ${squad}`);
});

test('fmt.orgsAt — 기록이 없으면 게임 데이터, 기록이 있으면 그 자리까지 쌓고 이탈은 뺀다', async () => {
  const fmt = await import('../site/lib/format.js');
  const targets = new Map([
    ['org:카운터스', { id: 'org:카운터스', name: '카운터스', kind: '스쿼드', mark: 'icn_counters' }],
    ['org:엘리시온', { id: 'org:엘리시온', name: '엘리시온', kind: '기업', mark: 'icn_corp_01' }],
    ['org:중앙_정부', { id: 'org:중앙_정부', name: '중앙 정부', kind: '정부' }],
  ]);
  fmt.use({ targets });
  const game = [{ type: 'corp', org: 'org:엘리시온', name: '엘리시온', mark: 'icn_corp_01' }, { type: 'squad', org: 'org:카운터스', name: '카운터스', mark: 'icn_counters' }];
  assert.deepEqual(fmt.orgsAt({ orgs: game }, 5).map((o) => [o.name, o.source]), [['엘리시온', 'game'], ['카운터스', 'game']]);
  const p = {
    orgs: game,
    affs: [
      { id: 'T1', org: 'org:중앙_정부', act: '소속', tick: 3, role: '부사령관' },
      { id: 'T2', org: 'org:카운터스', act: '합류', tick: 10 },
      { id: 'T3', org: 'org:중앙_정부', act: '이탈', tick: 20 },
      { id: 'T4', org: 'org:엘리시온', act: '합류', tick: 20 },
    ],
  };
  assert.deepEqual(fmt.orgsAt(p, 1).map((o) => o.source), ['game', 'game'], '첫 기록 앞은 게임 데이터');
  assert.deepEqual(fmt.orgsAt(p, 3).map((o) => [o.name, o.role, o.source]), [['중앙 정부', '부사령관', 'record']]);
  assert.deepEqual(fmt.orgsAt(p, 10).map((o) => o.name), ['중앙 정부', '카운터스']);
  assert.deepEqual(fmt.orgsAt(p, 20).map((o) => [o.name, o.type, o.mark]), [['엘리시온', 'corp', 'icn_corp_01'], ['카운터스', 'squad', 'icn_counters']], '이탈은 빼고 기업이 앞');
  assert.deepEqual(fmt.orgsAt(p, null).map((o) => o.name), ['엘리시온', '카운터스'], '전부 보기 = 기록 전부');
  assert.match(fmt.orgTip({ name: '갓데스', via: '스노우 화이트 : 이노센트 데이즈', source: 'game' }), /갓데스 \(스노우 화이트 : 이노센트 데이즈\) · 게임 데이터/);
  assert.deepEqual(fmt.orgsAt({ affs: [{ id: 'T5', org: 'org:중앙_정부', act: '소속', tick: 7, from: 'person:레비아탄' }] }, 7).map((o) => o.from), ['레비아탄'], '같은 인물의 기록을 빌린 것은 적은 이름을 단다');
});
