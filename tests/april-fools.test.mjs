/**
 * 만우절 단위(결정 #11 — annotations/april-fools.json · tools/lib/fools.mjs) — 목록이 4월 1일 이벤트와 맞고, 숫자 집계에서 빠졌는지.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { ROOT } from '../tools/records/model.mjs';
import { readCsv } from '../tools/site/lib.mjs';
import { APRIL_FOOLS_PATH, aprilFoolUnits, isAprilFools, isAprilFoolsScene } from '../tools/lib/fools.mjs';

const db = await openDb();
const list = JSON.parse(fs.readFileSync(APRIL_FOOLS_PATH, 'utf8'));

test('목록 = 출시일이 4월 1일인 이벤트 — 새 만우절 이벤트가 들어오면 목록에 넣는다', () => {
  const april = db.prepare("SELECT key, date FROM releases WHERE kind = 'event' AND substr(date, 6, 5) = '04-01' ORDER BY date").all();
  assert.deepEqual(april.map((r) => r.key), list.units.map((u) => u.unit));
  for (const u of list.units) assert.equal(april.find((r) => r.key === u.unit)?.date, u.date, u.unit);
  for (const u of list.units) {
    const cat = db.prepare('SELECT source FROM categories WHERE id_prefix = ?').get(u.unit);
    assert.equal(cat?.source, 'archive', `${u.unit} — 아카이브 이벤트`);
  }
});

test('함수 — 단위 키 · 씬 ID', () => {
  assert.equal(aprilFoolUnits().size, list.units.length);
  assert.ok(isAprilFools('event_liarsend'));
  assert.ok(!isAprilFools('event_liarsend_01') && !isAprilFools('ch01') && !isAprilFools(null));
  assert.ok(isAprilFoolsScene('event_fullfoolday_03') && isAprilFoolsScene('event_fullfoolday_end'));
  assert.ok(!isAprilFoolsScene('event_footstepwalkrun1_01') && !isAprilFoolsScene(''));
  for (const u of list.units) {
    const scenes = db.prepare("SELECT id FROM stories WHERE id LIKE ? || '_%' AND kind = 'scene'").all(u.unit);
    assert.ok(scenes.length && scenes.every((s) => isAprilFoolsScene(s.id)), u.unit);
  }
});

test('숫자 집계에서 빠졌다 — 인물 등장 · 쌍 · 판정 표 · 다른 단위와의 연결 선', () => {
  const csv = (f) => readCsv(path.join(ROOT, 'data/views', f));
  assert.ok(csv('persons/person-units.csv').every((r) => !isAprilFools(r.unit)), '인물 × 단위');
  assert.ok(csv('persons/pairs.csv').every((r) => !isAprilFools(r.first_unit) && !isAprilFools(r.last_unit)), '함께 나옴');
  assert.ok(csv('importance/units.csv').every((r) => !isAprilFools(r.unit)), '판정 표');
  assert.ok(csv('links/unit-edges.csv').every((r) => isAprilFools(r.from_unit) === isAprilFools(r.to_unit)), '연결 선은 만우절끼리만');
  assert.ok(csv('links/centers.csv').every((r) => !isAprilFools(r.unit)), '중심 대상');
  assert.ok(csv('persons/person-records.csv').some((r) => r.fool === '1'), '기록은 남기고 fool 칸으로 표시');
});
