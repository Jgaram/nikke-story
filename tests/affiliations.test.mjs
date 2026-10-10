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
  for (const sec of ['corporations', 'squads']) for (const [code, id] of Object.entries(map[sec])) if (id !== null) assert.ok(orgs.has(id), `game.${sec}.${code}: 사전에 없는 ${id}`);
  // 게임 시작 로스터(game.launch)는 실장 니케 판이어야 한다
  for (const rid of map.launch?.resource_ids ?? []) assert.ok(game.chars[String(rid)], `game.launch: 실장 니케가 아닌 ${rid}`);
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

test('fmt.orgsAt — 게임 소속은 공개 자리부터 늘 남고, 기록은 그 위에 쌓으며 기록이 이탈시킨 조직만 뺀다(W12d)', async () => {
  const fmt = await import('../site/lib/format.js');
  const targets = new Map([
    ['org:카운터스', { id: 'org:카운터스', name: '카운터스', kind: '스쿼드', mark: 'icn_counters' }],
    ['org:엘리시온', { id: 'org:엘리시온', name: '엘리시온', kind: '기업', mark: 'icn_corp_01' }],
    ['org:중앙_정부', { id: 'org:중앙_정부', name: '중앙 정부', kind: '정부' }],
  ]);
  fmt.use({ targets });
  // 엘리시온은 출시(tick 17)부터, 카운터스는 원문(tick 2)부터, 이름 없는 게임 소속(org 없음)은 0 = 늘, tick 없음 = 전부 보기에서만
  const game = [
    { type: 'corp', org: 'org:엘리시온', name: '엘리시온', mark: 'icn_corp_01', tick: 17 },
    { type: 'squad', org: 'org:카운터스', name: '카운터스', mark: 'icn_counters', tick: 2 },
    { type: 'squad', name: '올드 테일즈', mark: 'icn_oldtales', tick: 0 },
    { type: 'squad', name: '판정 못 함', mark: 'icn_x' },
  ];
  const names = (p, t) => fmt.orgsAt(p, t).map((o) => o.name);
  assert.deepEqual(names({ orgs: game }, 1), ['올드 테일즈'], '공개 자리 앞은 숨김 — 원문에 이름 없는 소속만 늘');
  assert.deepEqual(names({ orgs: game }, 2), ['카운터스', '올드 테일즈']);
  assert.deepEqual(names({ orgs: game }, 17), ['엘리시온', '카운터스', '올드 테일즈'], '판정 못 한 쌍은 읽는 중에는 숨김');
  assert.deepEqual(names({ orgs: game }, null), ['엘리시온', '카운터스', '올드 테일즈', '판정 못 함'], '전부 보기 = 전부');
  assert.ok(fmt.orgsAt({ orgs: game }, 17).every((o) => o.source === 'game' && !('tick' in o)));
  const p = {
    orgs: game,
    affs: [
      { id: 'T1', org: 'org:중앙_정부', act: '소속', tick: 3, role: '부사령관' },
      { id: 'T2', org: 'org:카운터스', act: '이탈', tick: 10 },
      { id: 'T3', org: 'org:중앙_정부', act: '이탈', tick: 20 },
      { id: 'T4', org: 'org:카운터스', act: '합류', tick: 30, role: '대장' },
    ],
  };
  assert.deepEqual(fmt.orgsAt(p, 3).map((o) => [o.name, o.role, o.source]), [['카운터스', undefined, 'game'], ['올드 테일즈', undefined, 'game'], ['중앙 정부', '부사령관', 'record']], '기록이 다루지 않는 게임 소속은 그대로, 기록은 얹는다');
  assert.deepEqual(names(p, 10), ['올드 테일즈', '중앙 정부'], '기록이 이탈시킨 게임 소속은 빠진다');
  assert.deepEqual(names(p, 20), ['엘리시온', '올드 테일즈'], '기업이 앞');
  assert.deepEqual(fmt.orgsAt(p, 30).map((o) => [o.name, o.role, o.source]), [['엘리시온', undefined, 'game'], ['카운터스', '대장', 'game'], ['올드 테일즈', undefined, 'game']], '다시 들어가면 게임 소속 자리에 기록의 role을 붙여 하나로');
  assert.deepEqual(names(p, null), ['엘리시온', '카운터스', '올드 테일즈', '판정 못 함'], '전부 보기 = 게임 소속 전부 + 기록 전부');
  assert.match(fmt.orgTip({ name: '갓데스', via: '스노우 화이트 : 이노센트 데이즈', source: 'game' }), /갓데스 \(스노우 화이트 : 이노센트 데이즈\) · 게임 속 지금 소속/);
  assert.deepEqual(fmt.orgsAt({ affs: [{ id: 'T5', org: 'org:중앙_정부', act: '소속', tick: 7, from: 'person:레비아탄' }] }, 7).map((o) => o.from), ['레비아탄'], '같은 인물의 기록을 빌린 것은 적은 이름을 단다');
});

test('fmt.orgsAt past — 지난 소속 · 이탈한 조직은 전 소속으로 뒤에, 지금 소속과 같은 조직은 한 번만(W12e)', async () => {
  const fmt = await import('../site/lib/format.js');
  const targets = new Map([
    ['org:갓데스', { id: 'org:갓데스', name: '갓데스', kind: '스쿼드', mark: 'icn_goddess' }],
    ['org:인헤르트', { id: 'org:인헤르트', name: '인헤르트', kind: '스쿼드', mark: 'icn_inherit' }],
    ['org:테트라', { id: 'org:테트라', name: '테트라', kind: '기업', mark: 'icn_corp_03' }],
    ['org:실버건', { id: 'org:실버건', name: '실버건', kind: '스쿼드' }],
  ]);
  fmt.use({ targets, units: new Map([['ch10', { key: 'ch10', title: 'CH.10 동료' }], ['char:1', { key: 'char:1', kind: 'episode', title: '라푼젤' }]]) });
  const p = {
    orgs: [{ type: 'squad', org: 'org:인헤르트', name: '인헤르트', mark: 'icn_inherit', tick: 5 }],
    affs: [
      { id: 'T1', org: 'org:갓데스', act: '지난 소속', tick: 3, unit: 'char:1' },
      { id: 'T2', org: 'org:실버건', act: '소속', role: '사수', tick: 1 },
      { id: 'T3', org: 'org:실버건', act: '이탈', tick: 4, unit: 'ch10' },
      { id: 'T4', org: 'org:테트라', act: '지난 소속', role: '프로듀서', tick: 6, unit: 'ch10' },
      { id: 'T5', org: 'org:테트라', act: '합류', tick: 8 },
    ],
  };
  const view = (t) => fmt.orgsAt(p, t, { past: true }).map((o) => `${o.past ? '~' : ''}${o.name}`);
  assert.deepEqual(fmt.orgsAt(p, 2).map((o) => o.name), ['실버건'], '기본(past 없음)은 지금 소속만');
  assert.deepEqual(view(2), ['실버건'], '드러나기 전에는 전 소속도 안 보인다');
  assert.deepEqual(view(3), ['실버건', '~갓데스'], '지난 소속은 지금 소속 계산에 안 들고 뒤에');
  assert.deepEqual(view(5), ['인헤르트', '~갓데스', '~실버건'], '이탈한 조직도 전 소속');
  assert.deepEqual(view(6), ['인헤르트', '~테트라', '~갓데스', '~실버건'], '기업이 앞');
  assert.deepEqual(view(8), ['테트라', '인헤르트', '~갓데스', '~실버건'], '다시 들어가면 전 소속에서 빠진다(한 번만)');
  assert.deepEqual(view(null), ['테트라', '인헤르트', '~갓데스', '~실버건'], '전부 보기');
  const tip = (t, name) => fmt.orgTip(fmt.orgsAt(p, t, { past: true }).find((o) => o.name === name && o.past));
  assert.equal(tip(5, '갓데스'), '전 소속: 갓데스 · 드러난 곳 라푼젤 호감도');
  assert.equal(tip(5, '실버건'), '전 소속: 실버건 — 사수 · 나간 곳 CH.10 동료', '이탈한 조직은 마지막 자리 · 나간 곳');
  const same = { orgs: [{ type: 'squad', org: 'org:갓데스', name: '갓데스', via: '다른 판', tick: 1 }], affs: [{ id: 'T9', org: 'org:갓데스', act: '지난 소속', tick: 1 }] };
  assert.deepEqual(fmt.orgsAt(same, 1, { past: true }).map((o) => [o.name, Boolean(o.past)]), [['갓데스', true]], '지난 소속 T가 있는 게임 소속(다른 판)은 전 소속 칩으로 바뀐다(W12f)');
  assert.deepEqual(fmt.orgsAt(same, 1).map((o) => o.name), [], '지금 소속에서는 빠진다');
  const back = { ...same, affs: [...same.affs, { id: 'T10', org: 'org:갓데스', act: '합류', tick: 2 }] };
  assert.deepEqual(fmt.orgsAt(back, 2, { past: true }).map((o) => [o.name, Boolean(o.past)]), [['갓데스', false]], '다시 들어가면 지금 소속 한 번만');
});

test('지난 소속(W12e) — 실제 기록이 지금 소속 계산 · 게임 소속 공개 자리에 안 든다', () => {
  const file = path.join(ROOT, 'site/data/targets.json');
  if (!fs.existsSync(file)) return;
  const byId = new Map(JSON.parse(fs.readFileSync(file, 'utf8')).map((t) => [t.id, t]));
  const past = (p, org) => byId.get(p)?.affs?.find((a) => a.org === org && a.act === '지난 소속');
  assert.ok(past('person:도로시', 'org:갓데스')?.unit, '도로시의 갓데스는 지난 소속, 드러난 단위가 붙는다');
  assert.ok(past('person:에이브', 'org:V.T.C.')?.from === 'person:그레이브', '에이브는 대표 그레이브의 지난 소속을 빌린다');
});

test('게임 소속의 공개 자리(W12d · W15b) — export가 출시 · 기록에서 tick을 붙인다', () => {
  const file = path.join(ROOT, 'site/data/targets.json');
  if (!fs.existsSync(file)) return;
  const byId = new Map(JSON.parse(fs.readFileSync(file, 'utf8')).map((t) => [t.id, t]));
  const org = (p, name) => byId.get(p)?.orgs?.find((o) => o.name === name);
  assert.ok([...byId.values()].every((t) => (t.orgs ?? []).every((o) => o.tick !== 0)), '늘(0)인 게임 소속은 없다 — 원문에 이름 없는 소속(null)도 그 판의 출시부터(W15b)');
  assert.equal(org('person:모더니아', '헬레틱')?.tick, org('person:모더니아', '필그림')?.tick, '모더니아 헬레틱은 CH.00부터가 아니라 출시(필그림과 같은 자리)부터');
  assert.ok(org('person:그레이브', '올드 테일즈')?.tick > 1, '원문에 이름 없는 게임 소속도 출시부터');
  assert.equal(org('person:라피', '카운터스')?.tick, byId.get('person:라피').affs.find((a) => a.org === 'org:카운터스').tick, '원문 기록 T가 출시보다 이르면 그 자리');
  assert.ok(org('person:라피', '엘리시온')?.tick > org('person:라피', '카운터스').tick, '원문에서 안 드러나면 출시(호감도 단위)');
  assert.ok(byId.get('person:그레이브').affs.some((a) => a.org === 'org:빌런_연합' && a.act === '합류'), '그레이브 이동이 기록으로');
});
