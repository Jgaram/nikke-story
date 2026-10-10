/**
 * 스포일러 새는 곳 점검(W15) — 헤드리스 크로미움으로 사이트를 띄워, 여기까지 읽음 뒤의 것이 화면에 글자로 보이는지 센다.
 * 표준 라이브러리만 — 크로미움은 DevTools 프로토콜(CDP)로 Node 22 내장 WebSocket이 몬다.
 *
 *   node tools/site/spoiler-check.mjs                       # 기본 컷오프 CH.00 · CH.10 · CH.20 × 여섯 탭 + 리더 + 검색
 *   node tools/site/spoiler-check.mjs --t 1,11 --tabs threads,world --out /tmp/spoil.txt
 *   CHROME=/path/to/chromium node tools/site/spoiler-check.mjs
 *
 * 무엇을 '새는 것'으로 세나(화면의 보이는 글자 — #main · #reader · 검색 결과의 innerText, 보이는 SVG 글자, title · aria-label):
 *   줄거리   안 본 스토리(R.seen 거짓)의 한 줄 소개(synopsis.json logline) 앞 20자.
 *   스토리   (--titles일 때만) 안 본 스토리의 제목 — 제목은 감상 순서 탭이 다 보이는 공개 정보라 기본은 세지 않는다.
 *            인물 이름과 같은 제목(호감도 스토리)은 빼고, 감상 순서 탭의 #main도 뺀다.
 *   기록     모르는 기록(R.known 거짓)의 문장 앞 24자.
 *   떡밥     아직 시작 안 한 떡밥(첫 스토리를 안 봄)의 제목.
 *   관계     떡밥끼리 관계 설명 가운데 근거 기록을 하나도 모르는 것.
 *   대상     아직 이름이 안 나온 인물 · 항목(fmt.met 거짓)의 표준명(W15b) — 앞 글자가 낱말 안이면 세지 않는다. 스토리 제목과 같은 이름(호감도)은 --titles일 때만.
 *   다른이름 나온 대상의 다른 이름 가운데 그 자리에서 모르는 것(fmt.aliasesAt 밖, 3자 이상).
 *   시대     드러나기 전 시대 기준점(chrono.json points[].meet)의 이름.
 *   다른 대상의 아는 이름 · 보이는 게임 소속 칩의 조직 이름과 같은 글자는 세지 않고, 대상 · 다른이름 · 시대는 공개 글(스토리 · 장면 제목 — --titles면 스토리 제목은 남김,
 *   fmt *_HELP 도움말)을 지우고 본다.
 * 접힌 '스포일러 보기'(닫힌 details) 안은 세지 않는다 — 설계대로 가린 것이다(innerText에 안 들고, title · aria-label은 닫힌 details 안이면 뺀다).
 * 출력: 칸(장면)마다 새는 수 · 앞 몇 건. --out이면 전부를 그 파일에. 새는 것이 있으면 종료 코드 1.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { serve } from './serve.mjs';

const { values: args } = parseArgs({
  options: {
    t: { type: 'string', default: '1,11,26' },
    tabs: { type: 'string', default: 'order,links,threads,chrono,persons,world' },
    out: { type: 'string' },
    port: { type: 'string', default: '0' },
    wait: { type: 'string', default: '3000' },
    show: { type: 'string', default: '5' },
    titles: { type: 'boolean', default: false },
  },
});
const CHROME = process.env.CHROME || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('크로미움을 못 찾았다 — CHROME=경로로 알려 준다'); process.exit(2); }
const WAIT = Number(args.wait);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 리더로 열어 볼 것 — 뒤에 나오는 떡밥 · 인물 · 항목 · 스토리(컷오프가 낮으면 가려져야 한다)
const READER_SELS = ['thread:J1', 'thread:J3', 'thread:J5', 'person:person:모더니아', 'person:person:그레이브', 'target:concept:퀸_인자', 'target:org:바이스리터', 'unit:ch40', 'scene:d_main_41_01'];
const SEARCHES = ['모더니아', '릴리스', '레드 후드', '크라운', '퀸', '그레이브', '바이스리터'];

// ── 화면 안에서 도는 점검 ──
const PROBE = async (skipMain, titles) => {
  const st = await import('/lib/state.js');
  const R = st.reading(st.get());
  const get = async (n) => (await fetch(`/data/${n}.json`)).json();
  const fmt = await import('/lib/format.js');
  const [units, targets, threads, rec1, rec2, synopsis, chrono] = await Promise.all(['units', 'targets', 'threads', 'records', 'records2', 'synopsis', 'chrono'].map(get));
  const names = new Set(targets.map((t) => t.name));
  const txt = [];
  const roots = [skipMain ? null : '#main', '#reader:not([hidden])', '#search-results:not([hidden])'].filter(Boolean);
  // 닫힌 '스포일러 보기'(details) 안 — 크롬은 닫힌 details 내용도 상자가 있어(content-visibility) getClientRects로는 못 거른다. summary는 보인다
  const folded = (el) => {
    for (let d = el.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
      if (!d.querySelector(':scope > summary')?.contains(el)) return true;
    }
    return false;
  };
  const shown = (el) => el.getClientRects().length && !folded(el);
  for (const sel of roots) {
    const root = document.querySelector(sel);
    if (!root) continue;
    txt.push(root.innerText);
    for (const el of root.querySelectorAll('svg text')) if (shown(el)) txt.push(el.textContent);
    for (const el of root.querySelectorAll('[title], [aria-label]')) if (shown(el)) txt.push(el.getAttribute('title') ?? '', el.getAttribute('aria-label') ?? '');
  }
  const all = txt.join('\n');
  const around = (i, n) => all.slice(Math.max(0, i - 24), i + n + 16).replace(/\s+/g, ' ');
  const hits = [];
  const unitSeen = (k) => R.seen(k);
  if (titles) for (const u of units) {
    if (unitSeen(u.key) || !u.title || u.title.length < 4 || names.has(u.title)) continue;
    const i = all.indexOf(u.title);
    if (i >= 0) hits.push(`스토리 ${u.key} … ${around(i, u.title.length)}`);
  }
  for (const x of synopsis) {
    if (unitSeen(x.key) || !x.logline || x.logline.length < 20) continue;
    const i = all.indexOf(x.logline.slice(0, 20));
    if (i >= 0) hits.push(`줄거리 ${x.key} … ${around(i, 20)}`);
  }
  const recs = new Map([...rec1, ...rec2].map((r) => [r.id, r]));
  for (const r of recs.values()) {
    if (R.known(r) || !r.text || r.text.length < 24) continue;
    const k = r.text.slice(0, 24);
    const i = all.indexOf(k);
    if (i >= 0) hits.push(`기록 ${r.id} … ${around(i, 24)}`);
  }
  for (const g of threads.relations ?? []) {
    if (!g.text || g.text.length < 16 || (g.basis ?? []).some((b) => recs.has(b) && R.known(recs.get(b)))) continue;
    const i = all.indexOf(g.text.slice(0, 16));
    if (i >= 0) hits.push(`관계 ${g.id} … ${around(i, 16)}`);
  }
  for (const j of threads.threads ?? threads) {
    if (!j.first_unit || unitSeen(j.first_unit)) continue;
    const i = all.indexOf(j.title);
    if (i >= 0) hits.push(`떡밥 ${j.id} … ${around(i, j.title.length)}`);
  }
  // 대상 · 다른 이름 · 시대(W15b) — 그 자리에서 아는 이름은 다른 대상의 것이라도 세지 않는다. 게임 소속 칩의 조직 이름(출시 = 공개, W12d)도 아는 이름
  const knownNames = new Set(targets.flatMap((t) => fmt.namesAt(t, R)));
  for (const t of targets) if (fmt.met(t, R)) for (const o of fmt.orgsAt(t, R.all ? null : R.t)) knownNames.add(o.name);
  // 공개 글은 지우고 본다 — 스토리 · 장면 제목(감상 순서 탭 · 리더 장면 칸에 다 보인다, --titles면 남김) · 도움말(*_HELP — 스토리 종류 설명의 '금서고' · '전초기지')
  let bare = all;
  const scenes = titles ? [] : await get('scenes');
  const masks = [...(titles ? [] : units.map((u) => u.title)), ...scenes.map((x) => x.title), ...Object.entries(fmt).filter(([k]) => k.endsWith('_HELP')).flatMap(([, v]) => Object.values(v))];
  for (const m of masks.filter((x) => typeof x === 'string' && x.length >= 2).sort((a, b) => b.length - a.length)) bare = bare.split(m).join(' '.repeat(m.length));
  /** 낱말 첫머리로 나온 곳(앞 글자가 한글 · 영문 · 숫자가 아님) — 아는 더 긴 이름 속(그레이 ⊂ 그레이브)은 빼고 */
  const longer = [...knownNames];
  const findWord = (w) => {
    for (let i = bare.indexOf(w); i >= 0; i = bare.indexOf(w, i + 1)) {
      if (i > 0 && /[\p{L}\p{N}]/u.test(bare[i - 1])) continue;
      // 두 글자 이름은 뒤가 낱말 끝 · 조사일 때만('사라졌나'의 '사라'는 아니다)
      if ([...w].length === 2 && /[\p{L}\p{N}]/u.test(bare[i + w.length] ?? '') && !/[은는이가을를의와과도만에께한로으랑야아씨님들]/u.test(bare[i + w.length])) continue;
      if (longer.some((k) => k !== w && k.includes(w) && all.startsWith(k, i - k.indexOf(w)))) continue; // 지운 글(제목)이 긴 이름 속에 걸칠 수 있어 원문 글로 본다
      return i;
    }
    return -1;
  };
  for (const t of targets) {
    if (fmt.met(t, R)) {
      for (const a of t.aliases ?? []) {
        if ([...a.name].length < 3 || knownNames.has(a.name) || fmt.aliasesAt(t, R).some((x) => x.name === a.name)) continue;
        const i = findWord(a.name);
        if (i >= 0) hits.push(`다른이름 ${t.id} ${a.name} … ${around(i, a.name.length)}`);
      }
      continue;
    }
    if ([...t.name].length < 2 || knownNames.has(t.name)) continue;
    const i = findWord(t.name);
    if (i >= 0) hits.push(`대상 ${t.id} … ${around(i, t.name.length)}`);
  }
  for (const p of chrono.points.filter((x) => x.era)) {
    if (R.all || (p.meet ?? []).some((k) => R.seen(k))) continue;
    const name = p.name.replace(/\s*\(.*?\)/g, '').trim();
    const i = bare.indexOf(name);
    if (i >= 0 && !knownNames.has(name)) hits.push(`시대 ${p.id} … ${around(i, name.length)}`);
  }
  return { t: R.t, hits };
};

// ── CDP ──
async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { send, close: () => ws.close() };
}

const server = await serve({ port: Number(args.port) });
const base = `http://127.0.0.1:${server.address().port}`;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'spoil-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--window-size=1400,1000', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\S+)/); if (m) res(m[1]); });
  chrome.on('exit', () => rej(new Error('크로미움이 바로 끝났다')));
});
const c = await cdp(wsUrl);
const { result: { targetId } } = await c.send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await c.send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => c.send(m, p, sessionId);
await S('Page.enable');
await S('Runtime.enable');

let n = 0;
const evaluate = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? '평가 실패');
  return r.result?.result?.value;
};
const open = async (hash) => { await S('Page.navigate', { url: `${base}/?n=${++n}#${hash}` }); await sleep(WAIT); };
const probe = (skipMain = false) => evaluate(`(${PROBE})(${skipMain}, ${args.titles})`);

const report = [];
let total = 0;
const note = (name, r) => {
  total += r.hits.length;
  report.push(`== ${name} — ${r.hits.length}`, ...r.hits.map((h) => `  ${h}`));
  console.log(`${r.hits.length ? '✗' : '✓'} ${name} — ${r.hits.length}`);
  for (const h of r.hits.slice(0, Number(args.show))) console.log(`    ${h}`);
};

try {
  for (const t of args.t.split(',')) {
    for (const tab of args.tabs.split(',')) {
      await open(`tab=${tab}&t=${t}`);
      note(`t=${t} ${tab}`, await probe(tab === 'order'));
    }
    for (const sel of READER_SELS) {
      await open(`tab=world&t=${t}&sel=${encodeURIComponent(sel)}`);
      note(`t=${t} 리더 ${sel}`, await probe(true));
    }
    await open(`tab=world&t=${t}`);
    for (const q of SEARCHES) {
      await evaluate(`(() => { const i = document.querySelector('#search'); i.focus(); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await sleep(WAIT);
      note(`t=${t} 검색 '${q}'`, await probe(true));
    }
  }
} finally {
  c.close();
  const gone = new Promise((r) => chrome.once('exit', r));
  chrome.kill();
  await Promise.race([gone, sleep(3000)]);
  server.close();
  try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 }); } catch { /* 임시 폴더 — 남아도 된다 */ }
}
if (args.out) fs.writeFileSync(args.out, `${report.join('\n')}\n`);
console.log(`\n새는 것 ${total}건${args.out ? ` → ${args.out}` : ''}`);
process.exit(total ? 1 : 0);
