/**
 * 연대기 탭(W6) — site/data/chrono.json의 자리 규칙 · 단위 연결 · 본문 없음, 탭 모듈 소스의 금지 칼럼 · 화면 용어.
 * DB를 열지 않고 커밋된 site/data/만 읽는다(`node tools/site/export.mjs --only chrono`로 다시 뽑은 뒤 돌린다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const chrono = read('chrono.json');
const units = read('units.json');
const unitKeys = new Set(units.map((u) => u.key));

test('작중 축: 점 = 시대 기준점 + 메인 챕터, 자리 번호는 2i+1', () => {
  const mains = units.filter((u) => u.kind === 'main');
  assert.equal(chrono.points.length, chrono.points.filter((p) => p.era).length + mains.length);
  chrono.points.forEach((p, i) => assert.equal(p.pos, 2 * i + 1, p.id));
  const chapters = chrono.points.filter((p) => !p.era).map((p) => p.id);
  assert.deepEqual(chapters, mains.sort((a, b) => a.num - b.num).map((u) => u.key));
});

test('단위 · 조각의 자리가 축 안에 있고 분류와 맞는다', () => {
  const max = 2 * chrono.points.length;
  assert.equal(chrono.units.length, units.length);
  for (const c of chrono.units) {
    assert.ok(unitKeys.has(c.unit), c.unit);
    for (const v of [c.lo, c.hi]) if (v != null) assert.ok(Number.isInteger(v) && v >= 0 && v <= max, `${c.unit} ${v}`);
    if (c.class === '판별') assert.ok(c.lo != null && c.hi != null && c.lo <= c.hi, `${c.unit} 판별은 양쪽 끝이 있다`);
    if (c.class === '상대' || c.class === '불명') assert.equal(c.slot, undefined, `${c.unit} 상대 · 불명은 칸이 없다`);
    else assert.ok(c.slot != null && c.seq != null, `${c.unit} 놓인 단위는 칸 · 순서가 있다`);
    if (c.drift) assert.ok(['과거', '앞', '맞음', '걸침', '뒤'].includes(c.drift), `${c.unit} ${c.drift}`);
  }
  for (const p of chrono.pieces) {
    assert.ok(unitKeys.has(p.unit), p.id);
    for (const v of [p.lo, p.hi]) if (v != null) assert.ok(v >= 0 && v <= max, `${p.id} ${v}`);
  }
  for (const n of chrono.narrows) assert.ok(unitKeys.has(n.unit), n.unit);
});

test('chrono.json에 대사 본문 칼럼이 없다', () => {
  const bad = new Set(['quest_name', 'scenario_localkey', 'speaker_name']);
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { assert.ok(!bad.has(k), k); walk(x); }
  };
  walk(chrono);
});

test('탭 모듈 소스: 본문 칼럼 · 원문 경로를 쓰지 않고 화면 용어를 바꿔 쓴다', () => {
  for (const f of ['site/tabs/chrono.js', 'tools/site/export/chrono.mjs']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const re of [/quest_name/, /scenario_localkey/, /sheet_rows/, /data\/raw\//, /FROM\s+lines\b/i]) assert.ok(!re.test(src), `${f} ${re}`);
  }
  const tab = fs.readFileSync(path.join(ROOT, 'site/tabs/chrono.js'), 'utf8');
  assert.ok(!/화자/.test(tab));
  // 화면 라벨은 LABELS 한 곳(나머지는 fmt) — 거기에 레포 내부 용어를 그대로 쓰지 않는다
  const start = tab.indexOf('const LABELS = {');
  const labels = tab.slice(start, tab.indexOf('\n};', start));
  assert.ok(labels.length > 500);
  for (const w of ['공개 자리', '컷오프', '척추', '줄기', '이름표', '어긋남']) assert.ok(!labels.includes(w), `LABELS에 내부 용어 "${w}"`);
  // 판정 용어(시점 확정 · 대략 범위 · 정한 방법 …)는 화면에 내지 않는다(W13e) — 확정 정도 라벨 · 정의를 쓰지 않는다
  const code = tab.split('\n').filter((l) => !/^\s*(\/\*\*?|\*|\/\/)/.test(l)).join('\n'); // 주석 줄은 빼고
  assert.ok(!/CHRONO_CLASS|help\('chrono'|DRIFT_ORDER|정한 방법|시점 단서/.test(code), '연대기 탭에 판정 용어');
});
