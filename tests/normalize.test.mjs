/**
 * T2-7 — 정규화 결과 검증: 씬 수 · 대사 수가 원본(data/raw/)과 같은가. 이름표 미매칭은 tests/speakers.test.mjs(범위 안 미분류 0종 · 0줄).
 *
 *   node --test
 *
 * 원본을 정규화와 따로 센다 — 블라링크 씬 파일(scene_detail_*.json)의 records · 호감도 스토리 파일(attractscene)의 records ·
 * 금서고 원문의 하위 챕터(`@@@SCRIPT_ID:`). 수가 어긋나면 수집이 빠졌거나(파일) 정규화가 줄을 버린 것이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../tools/normalize/ensure-db.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'data/raw');
const db = await openDb();
test.after(() => db.close());
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const list = (rows, f) => rows.slice(0, 20).map(f).join(', ') + (rows.length > 20 ? ` … 외 ${rows.length - 20}` : '');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('블라링크 씬: 원본 파일마다 대사 있는 노드 하나, 줄 수가 records 수와 같다', () => {
  const dir = path.join(RAW, 'scene/ko');
  const raw = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^scene_detail_(.+)\.json$/);
    if (m) raw.set(m[1], (readJson(path.join(dir, f)).scenario_group_id?.records?.value ?? []).length);
  }
  const rows = all("SELECT id, has_text, line_count FROM stories WHERE source IN ('main', 'archive', 'sudden')");
  const withText = rows.filter((r) => r.has_text);
  const noFile = withText.filter((r) => !raw.has(r.id));
  assert.deepEqual(noFile, [], `원본 파일 없이 대사가 있는 노드: ${list(noFile, (r) => r.id)}`);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const orphan = [...raw.keys()].filter((id) => !byId.get(id)?.has_text);
  assert.deepEqual(orphan, [], `노드가 안 된 원본 파일: ${list(orphan, (id) => id)}`);
  const wrong = withText.filter((r) => r.line_count !== raw.get(r.id));
  assert.deepEqual(wrong, [], `줄 수가 원본과 다른 씬: ${list(wrong, (r) => `${r.id} ${r.line_count}≠${raw.get(r.id)}`)}`);
  assert.equal(withText.length, raw.size);
});

test('호감도 스토리: 원본 파일마다 노드 하나, 줄 수가 records 수와 같다', () => {
  const dir = path.join(RAW, 'attractscene');
  const raw = new Map();
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)-ko\.json$/);
    if (m) raw.set(`ep:${m[1]}`, (readJson(path.join(dir, f)).records ?? []).length);
  }
  const rows = all("SELECT id, has_text, line_count FROM stories WHERE source = 'episode' AND has_text = 1");
  assert.equal(rows.length, raw.size, `대사 있는 호감도 스토리 ${rows.length} ≠ 원본 파일 ${raw.size}`);
  const wrong = rows.filter((r) => r.line_count !== raw.get(r.id));
  assert.deepEqual(wrong, [], `원본과 다른 호감도 스토리: ${list(wrong, (r) => `${r.id} ${r.line_count}≠${raw.get(r.id) ?? '파일 없음'}`)}`);
});

test('금서고: 하위 챕터(@@@SCRIPT_ID) 하나 = 씬 하나, 출처 ID가 겹치지 않는다', () => {
  const ids = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.txt')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/^@@@SCRIPT_ID:[ \t]*(.+?)[ \t\r]*$/gm)) ids.push(m[1]);
    }
  };
  walk(path.join(RAW, 'forbidden-library/scripts'));
  const rows = all("SELECT id, source_ref, has_text FROM stories WHERE source LIKE 'fl-%'");
  assert.equal(rows.length, ids.length, `금서고 씬 ${rows.length} ≠ 원본 하위 챕터 ${ids.length}`);
  assert.equal(new Set(rows.map((r) => r.source_ref)).size, rows.length, '출처 ID(source_ref)가 겹친다');
  const missing = [...new Set(ids)].filter((id) => !rows.some((r) => r.source_ref === id));
  assert.deepEqual(missing, [], `씬이 안 된 하위 챕터: ${list(missing, (x) => x)}`);
});

test('대사 수: 노드의 line_count 합 = lines 줄 수, 노드마다 seq가 0부터 빈틈없다', () => {
  const sum = one('SELECT SUM(line_count) n FROM stories').n;
  const n = one('SELECT COUNT(*) n FROM lines').n;
  assert.equal(sum, n);
  const gaps = all(`SELECT s.id, s.line_count, COUNT(l.seq) c, MIN(l.seq) lo, MAX(l.seq) hi FROM stories s JOIN lines l ON l.story_id = s.id
    GROUP BY s.id HAVING c <> s.line_count OR lo <> 0 OR hi <> c - 1`);
  assert.deepEqual(gaps, [], `seq가 어긋난 노드: ${list(gaps, (r) => `${r.id}(${r.c}줄 ${r.lo}–${r.hi})`)}`);
  const textless = one("SELECT COUNT(*) n FROM stories WHERE has_text = 0 AND line_count <> 0").n;
  assert.equal(textless, 0, '대사 없는 노드에 줄 수가 있다');
});
