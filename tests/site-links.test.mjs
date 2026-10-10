// 탭 "연결"(W3) — 내보낸 links.json · links-scenes.json의 정합성과 탭 모듈 소스의 정적 검사
// (내보내기 전체를 다시 돌리지 않고 site/data/를 읽는다 — 내보내기 자체는 tests/site.test.mjs가 본다)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const links = read('links.json');
const scenes = read('links-scenes.json');
const units = read('units.json');
const unitByKey = new Map(units.map((u) => [u.key, u]));
const TYPES = ['prereq', 'sequel', 'setup_payoff', 'callback', 'reversal', 'character', 'keyword'];
const ORIGINS = ['auto', 'record', 'manual', 'game-condition'];

test('links.json — 스토리 쌍 엣지는 읽는 순서 앞 → 뒤, 종류 · 세기 · 건수가 맞는 범위', () => {
  assert.ok(links.edges.length > 3000);
  const seen = new Set();
  for (const e of links.edges) {
    const a = unitByKey.get(e.from);
    const b = unitByKey.get(e.to);
    assert.ok(a && b, `없는 스토리 ${e.from} → ${e.to}`);
    assert.ok(a.order < b.order, `읽는 순서가 거꾸로 ${e.from} → ${e.to}`);
    assert.ok(TYPES.includes(e.type), e.type);
    assert.ok(ORIGINS.includes(e.origin), e.origin);
    assert.ok(e.strength >= 1 && e.strength <= 3);
    assert.ok(e.count >= 1);
    assert.ok((e.weak ?? 0) < e.count || e.strength === 1, `약한 연결이 전부인데 세기 ${e.strength}: ${e.from} → ${e.to} ${e.type}`);
    const k = `${e.from}\t${e.to}\t${e.type}`;
    assert.ok(!seen.has(k), `중복 선 ${k}`);
    seen.add(k);
  }
});

test('links.json — 단위 엣지의 count · strength가 씬 엣지(links-scenes.json)와 같다', () => {
  const cnt = new Map();
  const max = new Map();
  const weak = new Map();
  for (const r of scenes) {
    if (r.fu === r.tu) continue;
    const k = `${r.fu}\t${r.tu}\t${r.type}`;
    cnt.set(k, (cnt.get(k) ?? 0) + 1);
    max.set(k, Math.max(max.get(k) ?? 0, r.s));
    if (r.s === 1) weak.set(k, (weak.get(k) ?? 0) + 1);
  }
  for (const e of links.edges) {
    const k = `${e.from}\t${e.to}\t${e.type}`;
    assert.equal(e.count, cnt.get(k), `count ${k}`);
    assert.equal(e.strength, max.get(k), `strength ${k}`);
    assert.equal(e.weak ?? 0, weak.get(k) ?? 0, `weak ${k}`);
  }
});

test('links.json — 연작 사슬 · 중심 항목', () => {
  assert.ok(links.chains.length >= 30);
  const sequels = new Set(links.edges.filter((e) => e.type === 'sequel').map((e) => `${e.from}\t${e.to}`));
  for (const c of links.chains) {
    assert.ok(c.units.length >= 2);
    for (const k of c.units) assert.ok(unitByKey.has(k), k);
    for (const e of c.edges) assert.ok(sequels.has(`${e.from}\t${e.to}`), `사슬 엣지가 다음 편 엣지에 없다 ${e.from} → ${e.to}`);
  }
  assert.ok(links.targets.some((t) => t.common), '자주 나오는 항목 표시가 있다');
  for (const t of links.targets) assert.ok(t.spread >= 1);
});

test('links-scenes.json — 씬 엣지에 본문 칼럼이 없다 · 이름 있는 칸만', () => {
  const allowed = new Set(['type', 'origin', 's', 'from', 'fl', 'to', 'tl', 'fu', 'tu', 'record', 'act', 'point', 'target', 'fb', 'tb', 'confidence', 'status', 'note', 'hid']);
  for (const r of scenes) {
    for (const k of Object.keys(r)) assert.ok(allowed.has(k), `허용 밖 칸 ${k}`);
    assert.ok(TYPES.includes(r.type));
    if (r.note) assert.ok([...r.note].length <= 400, '메모는 우리가 쓴 한두 문장');
  }
});

test('탭 모듈 소스 — meta · mount 규약, 외부 URL · 본문 칼럼 이름 없음', () => {
  const dir = path.join(ROOT, 'site/tabs');
  const js = fs.readFileSync(path.join(dir, 'links.js'), 'utf8');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.match(js, /export const meta = \{ id: 'links'/);
  assert.match(js, /export async function mount\(root, ctx\)/);
  assert.ok(!/https?:\/\//.test(code), '외부 URL');
  assert.ok(!/quest_name|scenario_localkey|sheet_rows/.test(js), '본문 칼럼 · 외부 참고 표 이름');
  assert.ok(!/^\s*import\s/m.test(code), '탭은 import 없이 ctx로 받는다');
  assert.ok(!/innerHTML/.test(code), '데이터를 innerHTML로 넣지 않는다');
  const css = fs.readFileSync(path.join(dir, 'links.css'), 'utf8');
  // 모든 규칙은 .tab-links 아래(말풍선 · 토큰 선언 제외)
  const bad = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')[0].trim()).filter((sel) => sel && !/^(@media|@keyframes|:root|\.tab-links|\.tooltip\.lk-tip|\.lk-tip)/.test(sel) && !/^\s*$/.test(sel));
  assert.deepEqual(bad.filter((s) => !s.startsWith(':root') && !s.startsWith('.tab-links')), []);
});

test('탭 화면 말 — 근거 줄에 작업 흔적(만든 방법 · 세기 이름 · 근거 칸 수 · 후보 · 층)이 없다 (W13e)', () => {
  const js = fs.readFileSync(path.join(ROOT, 'site/tabs/links.js'), 'utf8');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const w of ['연결 강도', '직접 확정', '게임 선행 조건', '키 · 게임 순서', '말한 줄', '씬 연결', '확정 전 후보', 'TERM.strength', 'layers', 'inRange']) {
    assert.ok(!code.includes(w), `links.js에 '${w}'`);
  }
});
