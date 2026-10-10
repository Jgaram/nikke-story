/**
 * 사이트 탭 "인물"(W5) — 내보낸 persons*.json의 모양, 쌍 by[]의 합이 시안 표(pairs.csv)와 같은지, 탭의 합산 함수가 여기까지 읽음을 따르는지(범위 칸은 늘 셋 다라 쓰지 않는다 — W13c).
 *
 *   node --test tests/site-persons.test.mjs
 *
 * site/data/를 그대로 읽는다(내보내기를 다시 돌리지 않는다 — `node tools/site/export.mjs --only persons` 뒤에 본다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bucketOf, pairTotals } from '../site/tabs/persons.js';
import { readCsv } from '../tools/site/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const persons = read('persons.json');
const detail = read('persons-detail.json');
const pairs = read('persons-pairs.json');
const units = read('units.json');
const unitByKey = new Map(units.map((u) => [u.key, u]));
const personIds = new Set(persons.map((p) => p.id));
const extras = new Set(units.filter((u) => u.kind !== 'main' && (u.spine || u.grade === '필수')).map((u) => u.key)); // 체크 칸 스토리 — 척추 이벤트 · 사이드 + 준필수(W15b)

test('persons.json — 인물 386, 중복 없음, 이름 · 집계 칸', () => {
  assert.equal(persons.length, 386);
  assert.equal(personIds.size, persons.length);
  for (const p of persons) {
    assert.ok(p.id.startsWith('person:') && p.name, p.id);
    assert.ok(Number.isFinite(p.scenes) && Number.isFinite(p.lines), p.id);
    assert.ok(!('text' in p) && !('quest_name' in p), `${p.id}: 본문 칼럼 없음`);
  }
  assert.deepEqual(persons.filter((p) => p.common).map((p) => p.name).sort(), ['네온', '라피', '아니스', '지휘관']);
});

test('persons-detail.json — 히트맵 단위는 단위 표에 있고 읽는 순서대로, 합이 인물 표와 같다', () => {
  const byId = new Map(persons.map((p) => [p.id, p]));
  for (const d of detail) {
    const p = byId.get(d.id);
    assert.ok(p, d.id);
    let last = 0;
    let scenes = 0;
    let lines = 0;
    for (const e of d.units) {
      const u = unitByKey.get(e.unit);
      assert.ok(u, `${d.id} ${e.unit}`);
      assert.ok(u.order >= last, `${d.id}: 읽는 순서`);
      last = u.order;
      scenes += e.scenes;
      lines += e.lines;
    }
    assert.equal(scenes, p.scenes, `${d.id} 씬`);
    assert.equal(lines, p.lines, `${d.id} 줄`);
    assert.equal(d.changes.length, (p.baselines ?? 0) + (p.changes ?? 0), `${d.id} 변화`);
    for (const c of d.changes) assert.ok(['기준', '변화'].includes(c.act) && c.aspect && unitByKey.has(c.unit), `${d.id} ${c.id}`);
  }
});

test('persons-pairs.json — by[] = [자리, 범위, 씬, 대화, 스토리(, 체크 칸 스토리 키)]의 합이 pairs.csv와 같다', () => {
  const csv = new Map(readCsv(path.join(ROOT, 'data/views/persons/pairs.csv')).map((r) => [`${r.a}\t${r.b}`, r]));
  assert.equal(pairs.length, csv.size);
  for (const pr of pairs) {
    assert.ok(personIds.has(pr.a) && personIds.has(pr.b) && pr.a < pr.b, `${pr.a} ${pr.b}`);
    const row = csv.get(`${pr.a}\t${pr.b}`);
    assert.ok(row, `${pr.a} ${pr.b}`);
    for (const x of pr.by) {
      assert.ok(x.length === 5 || (x.length === 6 && extras.has(x[5]) && unitByKey.get(x[5]).tick === x[0]), `${pr.a} ${pr.b} by 칸 ${JSON.stringify(x)}`);
    }
    const tot = pairTotals(pr.by, null);
    assert.equal(tot.scenes, Number(row.scenes), `${pr.a} ${pr.b} 씬`);
    assert.equal(tot.talk, Number(row.talk_scenes), `${pr.a} ${pr.b} 대화`);
    for (let i = 1; i < pr.by.length; i++) assert.ok(pr.by[i][0] >= pr.by[i - 1][0], '자리순');
  }
});

test('pairTotals — 여기까지 읽음이 합을 줄인다(범위 칸은 보지 않는다)', () => {
  const by = [[1, 1, 2, 1, 1], [3, 2, 4, 3, 2], [3, 3, 1, 0, 1], [9, 1, 5, 5, 1]];
  assert.deepEqual(pairTotals(by, null), { scenes: 12, talk: 9, units: 5 });
  assert.deepEqual(pairTotals(by, 3), { scenes: 7, talk: 4, units: 4 });
  assert.deepEqual(pairTotals(by, 0), { scenes: 0, talk: 0, units: 0 });
});

/** state.reading()의 R을 흉내 낸다 — 척추 이벤트 · 사이드는 x 예외 우선, 그 밖은 tick ≤ t */
const mkR = (t, x = {}) => {
  const seen = (k) => (extras.has(k) && k in x ? x[k] : (unitByKey.get(k)?.tick ?? 0) <= t);
  return { all: false, t, x, seen, seenAny: (ks) => ks.some(seen) };
};

test('pairTotals(by, R) — 예외가 없으면 자리 규칙과 같고, 척추 이벤트 · 사이드 칸은 봤음 예외를 따른다', () => {
  for (const t of [1, 55, 119, 144]) {
    const R = mkR(t);
    for (const pr of pairs) assert.deepEqual(pairTotals(pr.by, R), pairTotals(pr.by, t), `${pr.a} ${pr.b} @${t}`);
  }
  assert.deepEqual(pairTotals([[1, 1, 2, 1, 1]], { all: true }), { scenes: 2, talk: 1, units: 1 });
  const by = [[1, 1, 2, 1, 1], [5, 1, 3, 2, 1, 'ev_a'], [5, 1, 1, 0, 1], [9, 1, 4, 4, 1, 'ev_b'], [9, 1, 7, 7, 1]];
  const fake = (t, x) => ({ all: false, t, seen: (k) => (k in x ? x[k] : { ev_a: 5, ev_b: 9 }[k] <= t) });
  assert.deepEqual(pairTotals(by, fake(5, {})), { scenes: 6, talk: 3, units: 3 });
  assert.deepEqual(pairTotals(by, fake(5, { ev_a: false })), { scenes: 3, talk: 1, units: 2 });
  assert.deepEqual(pairTotals(by, fake(5, { ev_b: true })), { scenes: 10, talk: 7, units: 4 }, 't 뒤라도 봤다고 체크한 칸은 더한다');
});

test('bucketOf — 말한 줄 수 5단계(0은 말한 줄 없음)', () => {
  assert.deepEqual([0, 1, 4, 5, 19, 20, 59, 60, 179, 180, 900].map(bucketOf), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
