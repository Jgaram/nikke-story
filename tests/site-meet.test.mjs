/**
 * 처음 나온 자리(W15b) — 아직 안 나온 인물 · 항목 · 다른 이름 · 시대 기준점을 그 자리에서 숨기는 데이터와 화면 함수.
 *   ① 내보내기: targets.json meet · name_meet · 다른 이름 meet(판 이름은 호감도 스토리), chrono.json 시대 기준점 meet
 *   ② common.mjs meetList — 체크 칸 스토리(척추 이벤트 · 사이드 · 준필수)가 아닌 첫 스토리까지 자른다
 *   ③ fmt.met · nameAt · aliasesAt · namesAt — 그 자리의 이름
 *
 *   node --test tests/site-meet.test.mjs   (site/data/가 없으면 ①은 건너뛴다 — node tools/site/export.mjs)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { meetList } from '../tools/site/export/common.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'site/data');
const fmt = await import('../site/lib/format.js');
const has = fs.existsSync(path.join(DATA, 'targets.json'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

/** state.reading()의 R을 흉내 낸다 — 체크 칸 스토리는 x 예외 우선, 그 밖은 tick ≤ t */
const mkR = (units, t, x = {}) => ({
  all: t == null, t,
  seen: (k) => t == null || (k in x ? x[k] : (units.get(k)?.tick ?? 0) <= t),
  seenAny(keys) { return t == null || keys.some((k) => this.seen(k)); },
});

test('meetList — 읽는 순서로 늘어놓고 체크 칸 스토리가 아닌 첫 스토리까지', () => {
  const units = [
    { key: 'ch01', kind: 'main', order: 1 }, { key: 'event_a', kind: 'event', spine: true, order: 2 },
    { key: 'side:b', kind: 'side', grade: '필수', order: 3 }, { key: 'sub:c', kind: 'sub', grade: '참고', order: 4 }, { key: 'ch02', kind: 'main', order: 5 },
  ];
  assert.deepEqual(meetList(['ch02', 'sub:c', 'event_a', 'side:b'], units), ['event_a', 'side:b', 'sub:c'], '척추 이벤트 · 준필수는 건너뛸 수 있어 다음 스토리까지');
  assert.deepEqual(meetList(['ch02', 'ch01'], units), ['ch01']);
  assert.equal(meetList(['없는키'], units), undefined);
});

test('targets.json — 이름이 처음 쓰인 자리(meet), 이름표 ???는 세지 않는다', { skip: !has }, () => {
  const targets = new Map(read('targets.json').map((t) => [t.id, t]));
  const units = new Map(read('units.json').map((u) => [u.key, u]));
  const tickOf = (keys) => Math.min(...keys.map((k) => units.get(k).tick));
  const lappy = targets.get('person:라피');
  assert.equal(lappy.meet[0], 'ch00', '라피는 CH.00부터');
  for (const t of targets.values()) for (const k of t.meet ?? []) assert.ok(units.has(k), `${t.id} meet ${k}`);
  const unmet = [...targets.values()].filter((t) => !t.meet).map((t) => t.id);
  assert.ok(unmet.length <= 10, `이름 자리가 없는 대상이 늘었다: ${unmet.join(' · ')}`);
  // 그레이브는 CH.28에 이름표 '???'로 먼저 말한다 — 이름이 나온 자리는 그 뒤
  assert.ok(tickOf(targets.get('person:그레이브').meet) > units.get('ch28').tick, '그레이브 — ???는 이름이 나온 것이 아니다');
  // 바이스리터는 '백기사'로 먼저 불린다 — 그 사이에는 백기사
  const w = targets.get('org:바이스리터');
  assert.ok(w.name_meet && tickOf(w.name_meet) > tickOf(w.meet), '표준명이 늦게 나오면 name_meet');
  // 판 이름은 그 판의 호감도 스토리(출시)부터
  const red = lappy.aliases.find((a) => a.name.includes(':') && a.how === '니케 목록');
  assert.ok(red?.meet?.[0]?.startsWith('char:'), `라피 판 이름 ${red?.name} — 호감도 스토리`);
  // 흔한 말이라 자동 줄에서 뺀 항목 이름(쉘터)은 그 항목을 다룬 기록의 스토리로 대신
  assert.ok(targets.get('place:쉘터')?.meet?.length, '쉘터 — 기록의 스토리로');
});

test('chrono.json — 시대 기준점마다 처음 드러난 스토리', { skip: !has }, () => {
  const units = new Map(read('units.json').map((u) => [u.key, u]));
  const eras = read('chrono.json').points.filter((p) => p.era);
  assert.equal(eras.length, 8);
  for (const p of eras) assert.ok(p.meet?.length && p.meet.every((k) => units.has(k)), `${p.id} meet`);
  const godFall = eras.find((p) => p.id === '@갓데스_폴');
  assert.ok(units.get(godFall.meet[0]).tick > 1, '갓데스 폴은 CH.00부터가 아니다');
});

test('fmt.met · nameAt · aliasesAt · namesAt — 그 자리에서 아는 이름만', () => {
  const units = new Map([['ch01', { key: 'ch01', tick: 1, order: 1 }], ['ch05', { key: 'ch05', tick: 5, order: 5 }], ['ch09', { key: 'ch09', tick: 9, order: 9 }], ['char:1', { key: 'char:1', tick: 7, order: 7 }]]);
  fmt.use({ units });
  const t = {
    id: 'org:바이스', name: '바이스', meet: ['ch01'], name_meet: ['ch05'],
    aliases: [{ name: '백기사', how: '별칭', meet: ['ch01'] }, { name: '바 이스', how: '표기' }, { name: '바이스 : 판', how: '니케 목록', meet: ['char:1'] }, { name: '말뚝', how: '별칭', never: true }],
  };
  const at = (n) => mkR(units, n);
  assert.equal(fmt.met(t, at(0)), false, 'CH.01 앞 — 아직 안 나옴');
  assert.equal(fmt.nameAt(t, at(0)), null);
  assert.deepEqual(fmt.namesAt(t, at(0)), []);
  assert.equal(fmt.nameAt(t, at(1)), '백기사', '표준명이 아직이면 먼저 나온 다른 이름');
  assert.deepEqual(fmt.aliasesAt(t, at(1)), [], '부르는 이름은 다른 이름에서 빼고, 표기는 표준명을 따른다');
  assert.equal(fmt.nameAt(t, at(5)), '바이스');
  assert.deepEqual(fmt.aliasesAt(t, at(5)).map((a) => a.name), ['백기사', '바 이스']);
  assert.deepEqual(fmt.aliasesAt(t, at(9)).map((a) => a.name), ['백기사', '바 이스', '바이스 : 판'], '판 이름은 호감도 스토리부터, 쓰인 곳 없는 이름(never)은 전부 보기에서만');
  assert.deepEqual(fmt.namesAt(t, at(5)), ['바이스', '백기사', '바 이스']);
  assert.deepEqual(fmt.aliasesAt(t, null).map((a) => a.name), ['백기사', '바 이스', '바이스 : 판', '말뚝'], '전부 보기 = 전부');
  assert.equal(fmt.met({ id: 'x', name: 'x' }, at(9)), false, 'meet 없는 대상은 읽는 중에는 늘 안 나옴');
  assert.equal(fmt.met({ id: 'x', name: 'x' }, null), true);
  // 체크 칸 스토리를 안 봤다고 하면 그 스토리로는 안 나옴
  const ev = { id: 'y', name: 'y', meet: ['ch01', 'ch05'] };
  assert.equal(fmt.met(ev, mkR(units, 1, { ch01: false })), false);
  assert.equal(fmt.met(ev, mkR(units, 5, { ch01: false })), true);
});

test('fmt.sceneTitle · sceneName — 장면 제목은 그 스토리를 봤을 때만(사용자, 2026-10-10)', () => {
  const units = new Map([['ch01', { key: 'ch01', tick: 1 }], ['ch40', { key: 'ch40', tick: 40 }]]);
  const scenes = new Map([['a', { id: 'a', unit: 'ch01', seq: 2, title: '재회' }], ['b', { id: 'b', unit: 'ch40', seq: 7, title: '인자 살해자' }]]);
  fmt.use({ units, scenes });
  let R = mkR(units, 1);
  fmt.useReading(() => R);
  assert.equal(fmt.sceneName('a'), '2장면 「재회」');
  assert.equal(fmt.sceneName('b'), '7장면', '안 본 스토리의 장면은 번호만');
  assert.equal(fmt.sceneTitle('b'), null);
  assert.equal(fmt.sceneLabel('b'), '7장면');
  R = mkR(units, null);
  assert.equal(fmt.sceneLabel('b'), '인자 살해자', '전부 보기면 제목');
  fmt.useReading(null);
});
