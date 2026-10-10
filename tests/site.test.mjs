/**
 * 사이트 내보내기(W1) — 내보낸 JSON에 본문 칼럼 · 긴 인용이 없고, 건수가 manifest와 맞는지. 인용 검사 · 정적 서버도 여기서 본다.
 *
 *   node --test
 *
 * 내보내기는 임시 디렉터리(--out)로 돌린다 — site/data/는 건드리지 않는다. DB 읽기만이라 몇 초다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { exportSite } from '../tools/site/export.mjs';
import { QUOTE_WARN, pick, publishText, quoteWarnings, quotesIn } from '../tools/site/lib.mjs';
import { handle } from '../tools/site/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 씬 · 줄 객체에 있으면 안 되는 키 — 대사 본문 칼럼 이름(docs/schema.md "테이블"). 기록 객체의 text는 우리 문장이라 허용 */
const FORBIDDEN_SCENE_KEYS = ['text', 'quest_name', 'scenario_localkey', 'speaker_name', 'speaker_id', 'description'];
/** 내보내기 소스에 글자 그대로 있으면 안 되는 것 — 본문 칼럼 · 외부 참고 표 · 원문 경로 */
const FORBIDDEN_SOURCE = [/quest_name/, /scenario_localkey/, /sheet_rows/, /sheet_[a-z]/, /FROM\s+lines\b/i, /JOIN\s+lines\b/i, /lines\.text/, /data\/raw\//, /imported\//];

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-site-'));
const db = await openDb();
const result = await exportSite({ out, db });
test.after(() => {
  db.close();
  fs.rmSync(out, { recursive: true, force: true });
});
const read = (f) => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
const walk = (v, fn, p = '') => {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, fn, `${p}[${i}]`));
  else if (v && typeof v === 'object') { fn(v, p); for (const [k, x] of Object.entries(v)) walk(x, fn, `${p}.${k}`); }
};

test('내보낸 JSON이 모두 파싱되고 manifest의 건수와 맞는다', () => {
  const m = read('manifest.json');
  assert.ok(m.built_at && m.inputs && m.files);
  for (const [file, info] of Object.entries(m.files)) {
    const data = read(file);
    if (typeof info.count === 'number') assert.equal(Array.isArray(data) ? data.length : 1, info.count, file);
    else for (const [k, n] of Object.entries(info.count)) assert.equal(Array.isArray(data[k]) ? data[k].length : 1, n, `${file} ${k}`);
  }
  assert.equal(m.warnings, result.warnings.length);
});

test('단위 481 · 공개 자리 158 · 씬 단위 매핑 · 키 이름은 영문 소문자', () => {
  const units = read('units.json');
  const ticks = read('ticks.json');
  const scenes = read('scenes.json');
  assert.equal(units.length, 481);
  assert.equal(ticks.length, 158);
  const keys = new Set(units.map((u) => u.key));
  assert.equal(keys.size, 481);
  for (const u of units) {
    assert.ok(u.kind && u.title && u.order && u.tick && u.date, u.key);
    assert.ok(['main', 'event', 'side', 'sub', 'relic', 'erelic', 'episode', 'elevator'].includes(u.kind), `${u.key} ${u.kind}`);
    assert.ok(['메인', '척추', '필수', '보강', '참고', '독립'].includes(u.grade), `${u.key} ${u.grade}`);
    assert.ok([1, 2, 3].includes(u.layer), `${u.key} layer ${u.layer}`);
  }
  assert.equal(units.find((u) => u.key === 'ch07').title, 'CH.07 재회');
  // 원문 출처(금서고 · 블라링크)는 사이트에 싣지 않는다 — 호감도 제목엔 편수를 붙이지 않는다(종류 칩으로 안다)
  assert.ok(units.every((u) => u.library === undefined && u.replaces === undefined));
  assert.ok(units.filter((u) => u.kind === 'episode').every((u) => !/호감도/.test(u.title)));
  assert.ok(units.filter((u) => u.grade === '척추').length >= 10);
  assert.ok(scenes.length > 3900);
  for (const s of scenes) assert.ok(keys.has(s.unit), `${s.id} → ${s.unit}`);
  assert.equal(scenes.filter((s) => s.unit === 'd_ex_elevator_01').length, 1);
  assert.equal(ticks[0].main, 'ch00');
  assert.ok(ticks.every((t) => t.upto && Array.isArray(t.units) && t.units.length === t.count));
  const unitScenes = new Map();
  for (const s of scenes) unitScenes.set(s.unit, (unitScenes.get(s.unit) ?? 0) + 1);
  for (const u of units) assert.equal(u.scenes, unitScenes.get(u.key) ?? 0, `${u.key} scenes`);
  walk([units, ticks, scenes, read('records.json'), read('threads.json'), read('targets.json')], (o, p) => {
    for (const k of Object.keys(o)) assert.match(k, /^[a-z][a-z0-9_]*$/, `${p}.${k}`);
  });
});

test('호감도 초상 face — 그 스토리의 니케 판(이격 · 코스튬 포함) 그림, 받은 파일만', () => {
  const eps = read('units.json').filter((u) => u.kind === 'episode');
  for (const u of eps) {
    const rid = /^char:(\d+)$/.exec(u.key)?.[1];
    if (!u.face) continue;
    assert.equal(u.face, `c${rid.padStart(3, '0')}`, u.key);
    assert.ok(fs.existsSync(path.join(ROOT, 'site/img/people', `${u.face}.png`)), `${u.face}.png 없음`);
  }
  // 이격은 원래 니케 그림이 아니라 제 판(길로틴 : 윈터 슬레이어 → c182)
  assert.equal(eps.find((u) => u.key === 'char:182')?.face, 'c182');
  assert.ok(read('units.json').every((u) => u.kind === 'episode' || !u.face), '호감도 밖에는 face가 없다');
});

test('씬 · 줄 객체에 본문 칼럼 이름이 없다 (기록의 text는 우리 문장)', () => {
  const scenes = read('scenes.json');
  for (const s of scenes) for (const k of FORBIDDEN_SCENE_KEYS) assert.ok(!(k in s), `${s.id}.${k}`);
  const units = read('units.json');
  for (const u of units) for (const k of FORBIDDEN_SCENE_KEYS) assert.ok(!(k in u), `${u.key}.${k}`);
  // 기록 · 줄기 · 대상 객체에도 원문 칼럼 이름은 없다(text · note · reason은 우리 글)
  walk([read('records.json'), read('records2.json'), read('threads.json'), read('targets.json'), read('slips.json')], (o, p) => {
    for (const k of ['quest_name', 'scenario_localkey', 'speaker_name', 'window']) assert.ok(!(k in o), `${p}.${k}`);
  });
});

test('확정 기록만 · 공통 칸 · 종류 코드', () => {
  const r1 = read('records.json');
  const r2 = read('records2.json');
  const kinds1 = new Set(r1.map((r) => r.kind));
  const kinds2 = new Set(r2.map((r) => r.kind));
  assert.deepEqual([...kinds1].sort(), ['F', 'F-k', 'Q', 'Q-k', 'S']);
  assert.deepEqual([...kinds2].sort(), ['D', 'E', 'H', 'I', 'O', 'U']);
  const ids = new Set();
  for (const r of [...r1, ...r2]) {
    assert.ok(r.id && r.kind && r.unit && r.tick && r.order, JSON.stringify(r).slice(0, 80));
    assert.ok(!ids.has(r.id), `중복 ${r.id}`);
    ids.add(r.id);
    assert.ok(!('status' in r), `${r.id} status`);
    if (r.kind !== 'O' && r.kind !== 'H') assert.ok(r.scene && Array.isArray(r.evidence) && r.evidence.length, `${r.id} 근거`);
  }
  const q = r1.find((r) => r.id === 'Q1');
  assert.equal(q.state, '풀림');
  assert.ok(q.first_tick && q.solved_tick);
  // 단계별 단위(reveals.csv) — 메인이 다시 밝힌 사실은 know_units에 두 곳, 하나뿐이면 싣지 않는다
  const f40 = r1.find((r) => r.id === 'F40');
  assert.deepEqual(f40.know_units, ['ch02', 'ch07']);
  assert.ok(r1.filter((r) => r.kind === 'F' || r.kind === 'Q').every((r) => !r.know_units || r.know_units.length > 1 || r.know_units[0] !== r.unit));
  assert.ok(q.solved_units?.length);
  const f1 = r1.find((r) => r.id === 'F1');
  assert.equal(f1.state, '뒤집힘');
  const rev = r1.find((r) => r.id === 'F1-2');
  assert.equal(rev.act, '뒤집음');
  assert.equal(rev.parent, 'F1');
  assert.equal(rev.replaced_by, 'F14');
  const d = r2.find((r) => r.kind === 'D' && r.act === '변화');
  assert.ok(d.person && d.aspect && d.before && d.after);
  const th = read('threads.json');
  assert.equal(th.threads[0].id, 'J1');
  assert.ok(th.threads[0].questions.length >= 10 && th.threads[0].owners.length);
  assert.ok(th.relations.every((g) => g.from && g.to && g.type));
  const targets = read('targets.json');
  assert.ok(targets.find((t) => t.id === 'person:라피').aliases.length);
  assert.ok(targets.find((t) => t.id === 'person:모더니아').same_as.includes('person:마리안'));
});

test('따옴표 인용 — 40자 초과는 경고 목록에 잡히고, 자르지 않는다', () => {
  const quoteWarns = result.warnings.filter((w) => w.length);
  assert.ok(quoteWarns.every((w) => w.length > QUOTE_WARN && w.where));
  // 실제 기록에 있는 긴 인용(F2145 text 94자)이 경고에 잡혀 있고 그대로 실렸다
  assert.ok(quoteWarns.some((w) => w.where === 'F2145 text'));
  const f2145 = read('records.json').find((r) => r.id === 'F2145');
  assert.ok(quotesIn(f2145.text).some((q) => [...q.inner].length > 80));
});

test('인용 검사 함수 — 픽스처', () => {
  const long = '가'.repeat(50);
  const veryLong = '나'.repeat(100);
  const text = `앞말 “${long}” 가운데 '짧은 인용' 끝 "${veryLong}" 끝`;
  const warns = quoteWarnings(text, 'X1');
  assert.deepEqual(warns.map((w) => w.length), [50, 100]);
  assert.equal(warns[0].where, 'X1');
  assert.equal(publishText(text, 'X1'), text, '긴 인용도 자르지 않는다');
  assert.deepEqual(quoteWarnings("don't say 'ok'"), [], '아포스트로피는 따옴표가 아니다');
  const got = [];
  assert.equal(publishText('짧다', 'w', (w) => got.push(w)), '짧다');
  assert.equal(got.length, 0);
  assert.equal(publishText(null, 'w'), null);
  assert.deepEqual(pick({ id: 'a', text: '본문', title: 't', n: null }, ['id', 'title', 'n']), { id: 'a', title: 't' });
});

test('내보내기 소스에 본문 칼럼 · 외부 참고 표 · 원문 경로 이름이 없다', () => {
  const dir = path.join(ROOT, 'tools/site');
  const files = [];
  const walkDir = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walkDir(p); else if (p.endsWith('.mjs')) files.push(p); } };
  walkDir(dir);
  assert.ok(files.length >= 9);
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const re of FORBIDDEN_SOURCE) assert.ok(!re.test(src), `${path.relative(ROOT, f)}: ${re}`);
  }
  // 브라우저 쪽도 본문을 요청하지 않는다 — d3는 lib/d3.js 한 곳에서만, 고정 버전
  const site = path.join(ROOT, 'site');
  const js = [];
  const walkJs = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory() && e.name !== 'data') walkJs(p); else if (p.endsWith('.js')) js.push(p); } };
  walkJs(site);
  for (const f of js) {
    const src = fs.readFileSync(f, 'utf8');
    if (!f.endsWith('lib/d3.js')) assert.ok(!/https?:\/\//.test(src.replace(/\/\/.*$/gm, '')), `${path.relative(ROOT, f)}: 외부 URL`);
  }
  assert.match(fs.readFileSync(path.join(site, 'lib/d3.js'), 'utf8'), /d3@7\.9\.0\/\+esm/);
});

test('정적 서버 — MIME · no-cache · 404 · 루트 밖 거절', async () => {
  const root = path.join(ROOT, 'site');
  const req = (url) => new Promise((resolve) => {
    const res = { headers: null, status: null, body: '', writeHead(s, h) { this.status = s; this.headers = h; }, end(b) { if (b) this.body += b; resolve(this); } };
    const r = { url, method: 'HEAD' };
    handle(root, r, res);
  });
  const index = await req('/');
  assert.equal(index.status, 200);
  assert.match(index.headers['Content-Type'], /text\/html/);
  assert.equal(index.headers['Cache-Control'], 'no-cache');
  assert.match((await req('/lib/state.js')).headers['Content-Type'], /javascript/);
  assert.match((await req('/style.css')).headers['Content-Type'], /text\/css/);
  assert.equal((await req('/없는파일.json')).status, 404);
  assert.ok([403, 404].includes((await req('/..%2F..%2FCLAUDE.md')).status), '루트 밖');
});

test('스토리 종류 아이콘 — style.css가 가리키는 그림이 site/img/kinds/에 있다', () => {
  const css = fs.readFileSync(path.join(ROOT, 'site/style.css'), 'utf8');
  const rules = [...css.matchAll(/\.kind-icon\[data-kind="(\w+)"\][^}]*url\(([^)]+)\)/g)];
  assert.deepEqual(rules.map((m) => m[1]).sort(), ['elevator', 'episode', 'erelic', 'event', 'relic', 'side', 'sub']);
  for (const [, kind, url] of rules) assert.ok(fs.existsSync(path.join(ROOT, 'site', url)), `${kind}: ${url} 없음`);
});
