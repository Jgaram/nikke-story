/**
 * 사이트 탭 "읽기 순서"(W2) — 내보낸 order.json · order-detail.json의 모양, 탭의 등급 계산이 원천(tools/views/importance.mjs gradeAt)과 같은지.
 *
 *   node --test tests/site-order.test.mjs
 *
 * site/data/를 그대로 읽는다(내보내기를 다시 돌리지 않는다 — `node tools/site/export.mjs --only order` 뒤에 본다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeAt as siteGradeAt } from '../site/tabs/order.js';
import { gradeAt as toolGradeAt } from '../tools/views/importance.mjs';
import { gradeTrail } from '../tools/site/export/order.mjs';
import { readCsv } from '../tools/site/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const order = read('order.json');
const detail = read('order-detail.json');
const ticks = read('ticks.json');
const GRADES = ['필수', '보강', '참고', '독립'];

test('order.json — 판정 단위 · 본편 · 주역의 모양', () => {
  assert.equal(order.units.length, order.counts.judged);
  assert.equal(order.spine.length, order.counts.spine);
  assert.equal(order.leads.length, order.counts.leads);
  assert.equal(GRADES.reduce((n, g) => n + order.counts.grade[g], 0), order.units.length);
  const keys = new Set();
  for (const u of order.units) {
    assert.ok(GRADES.includes(u.grade), u.key);
    assert.ok(Number.isFinite(u.tick), u.key);
    assert.ok(!keys.has(u.key), `중복 ${u.key}`);
    keys.add(u.key);
    if (u.from_tick != null) assert.ok(u.before && GRADES.includes(u.before), `${u.key}: 오르는 단위는 앞 등급이 있다`);
    // 큰 칼럼은 order-detail.json으로 뺐다 — 첫 화면 파일에 남아 있으면 안 된다
    for (const k of ['history', 'reviews', 'basis_text']) assert.ok(!(k in u), `${u.key}: ${k}는 order-detail.json에 있다`);
  }
  for (let i = 1; i < order.spine.length; i++) assert.ok(order.spine[i].tick >= order.spine[i - 1].tick, '본편은 출시 시점순');
});

test('order-detail.json — 모든 키가 order.json에 있고 검토 기록의 메모 번호가 유효하다', () => {
  const keys = new Set(order.units.map((u) => u.key));
  for (const [key, d] of Object.entries(detail.units)) {
    assert.ok(keys.has(key), key);
    for (const r of d.reviews ?? []) if (r.note != null) assert.ok(detail.notes[r.note] != null, `${key} note ${r.note}`);
  }
});

test('탭의 gradeAt은 원천(importance.mjs gradeAt)과 모든 출시 시점에서 같다', () => {
  const rows = new Map(readCsv('data/views/importance/units.csv').map((r) => [r.unit, r]));
  let checked = 0;
  for (const u of order.units) {
    const row = rows.get(u.key);
    assert.ok(row, u.key);
    for (const t of ticks) {
      assert.equal(siteGradeAt(u, t.tick), toolGradeAt(row, t.tick), `${u.key} @${t.tick}`);
      checked++;
    }
    assert.equal(siteGradeAt(u, null), u.grade, '전부 보기는 최종 등급');
  }
  assert.ok(checked > 10000);
});

test('gradeTrail — 이력 문자열에서 등급이 바뀐 순서만 뽑는다', () => {
  assert.deepEqual(gradeTrail('B0b-2 독립 · X3c 그대로 → X3f-6a 참고'), ['독립', '참고']);
  assert.deepEqual(gradeTrail('B0b-2 독립 → X3b 보강 → X3f-6a 참고'), ['독립', '보강', '참고']);
  assert.equal(gradeTrail('B0b-2 참고 · X3c 그대로 · X3f-6a 그대로'), undefined);
  assert.equal(gradeTrail(''), undefined);
  assert.equal(gradeTrail(undefined), undefined);
  // order.json의 trail은 이력 문자열에서 온다 — 마지막 등급이 최종 등급과 같다
  for (const u of order.units) if (u.trail) assert.equal(u.trail.at(-1), u.grade, u.key);
});
