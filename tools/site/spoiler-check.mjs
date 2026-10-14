/**
 * 스포일러 새는 곳 점검(W15) — 헤드리스 크로미움으로 사이트를 띄워, 여기까지 읽음 뒤의 것이 화면에 글자로 보이는지 센다.
 * 표준 라이브러리만 — 크로미움은 DevTools 프로토콜(CDP)로 Node 22 내장 WebSocket이 몬다.
 *
 *   node tools/site/spoiler-check.mjs                       # 기본 컷오프 CH.00 · CH.10 · CH.20 × 여섯 탭 + 리더 + 검색
 *   node tools/site/spoiler-check.mjs --t 1,11 --tabs threads,world --out /tmp/spoil.txt
 *   CHROME=/path/to/chromium node tools/site/spoiler-check.mjs
 *   node tools/site/spoiler-check.mjs --root <사이트 폴더>      # site/ 말고 다른 사본을 띄운다(고치기 전 · 뒤 비교)
 *   node tools/site/spoiler-check.mjs --skip                   # 체크 칸 스토리(사이드 · 픽업 이벤트)를 다 끈 독자(W15f)
 *   node tools/site/spoiler-check.mjs --skip-all               # 고를 수 있는 스토리를 다 끈 독자(이벤트 · 호감도까지 — 메인 갈래만 본 독자, W16b)
 *   node tools/site/spoiler-check.mjs --readers base,skip,skip-all   # 세 독자를 크로미움 한 번에(이름 앞에 [독자])
 *   --jobs N(함께 띄우는 페이지, 기본 CPU 수 · 많아야 6) · --timing(오래 걸린 화면) · --quiet · --cap — 기다리는 법 · 시간은 docs/tools.md "스포일러 점검"
 * 화면마다 새 문서로 띄우고, 고정 대기 대신 할 일(네트워크 · fetch · 짧은 타이머 · rAF · idle)이 다 끝나고 DOM이 잠잠해질 때 점검한다.
 *
 * 무엇을 '새는 것'으로 세나(화면의 보이는 글자 — #main · #reader · 검색 결과의 innerText, 보이는 SVG 글자, title · aria-label):
 *   줄거리   안 본 스토리(R.seen 거짓)의 한 줄 소개(synopsis.json logline) 앞 20자.
 *   스토리   (--titles일 때만) 안 본 스토리의 제목 — 제목은 감상 순서 탭이 다 보이는 공개 정보라 기본은 세지 않는다.
 *            인물 이름과 같은 제목(호감도 스토리)은 빼고, 감상 순서 탭의 #main도 뺀다.
 *   기록     모르는 기록(R.known 거짓)의 문장 앞 24자.
 *   떡밥     아직 시작 안 한 떡밥(fmt.threadStarted 거짓 — 판이 있으면 첫 판의 at, 없으면 첫 스토리를 안 봄)의 분석용 제목 · 판 제목.
 *   떡밥판   시작한 떡밥이 그 자리 판(fmt.threadAt)이 아닌 제목 · 요약으로 보이는 것(W15d) — 분석용 제목 · 요약 앞 20자(그 자리 글이 그것이 아닐 때) · 뒤 판의 제목 · 요약.
 *            지금 보이는 떡밥 제목들은 지우고 본다(앞 판 제목이 뒤 판 제목 속에 들 수 있다).
 *   사전     비인물 항목의 사전 설명이 그 자리 판(fmt.noteAt — W15e)이 아닌 글로 보이는 것 — 분석용 설명(world.json note) 앞 16자(그 자리 글에 들지 않을 때) ·
 *            뒤 판 설명 앞 16자. 사전 설명 자리(.w-note · .rd-note)에서만 찾는다. 전부 보기는 세지 않는다.
 *   묶음     떡밥 하나를 보는 화면(떡밥 탭 흐름 — p.j, 리더 thread:J)에 그 떡밥과 이어진 줄 아직 모르는 의문 · 사실(fmt.threadBundle 밖)의 문장 앞 16자(W15d).
 *   관계     떡밥끼리 관계 설명 가운데 근거 기록을 하나도 모르는 것.
 *   대상     아직 이름이 안 나온 인물 · 항목(fmt.met 거짓)의 표준명(W15b) — 앞 글자가 낱말 안이면 세지 않는다. 스토리 제목과 같은 이름(호감도)은 --titles일 때만.
 *   다른이름 나온 대상의 다른 이름 가운데 그 자리에서 모르는 것(fmt.aliasesAt 밖, 3자 이상).
 *   시대     드러나기 전 시대 기준점(chrono.json points[].meet)의 이름.
 *   결말     떡밥 탭 흐름(p.j)의 결말 · 함께 맺음 줄 가운데 이 떡밥에 든다는 것을 아직 모르는 것(fmt.threadTies units 밖)의 문장 앞 16자(W15f).
 *   떡밥갈래 연결 탭 떡밥 필터(p.th · 가운데 p.c)에서 이웃으로 보이는 스토리인데, 가운데와의 그 떡밥 선에 아는 기록(threadTies ids)이 하나도 없는 것(W15f).
 *   이름없음 그 스토리에 이름이 안 쓰인 등장('???'로만 · 암시 언급만 — persons-detail hid)이 리더 '나오는 인물' · 인물 탭 등장 목록(p.who)에 보이는 것(W15f).
 *   사칭     드러나기 전(사칭 W23a — 드러난 스토리 rev를 안 봄) 스토리에서 사칭한 인물을 리더 '나오는 인물' · 인물 탭 등장 목록에 낸 것, 그 인물 탭에 보인 사칭 표 · 머리 '사칭' 줄.
 *            W23b: 사칭에 가려지는 기록(imp)이 그 자리 모습으로는 다른 인물 것인데 인물 탭에 보인 것(사칭 기록).
 *            W23d · W24a: 다른 인물(split)의 실제 사람을 가르는 화면 이름(label — persons.json imp as)이 드러나기 전에 보인 것(사칭이름).
 *   장면     안 본 스토리의 장면 제목이 장면 이름 꼴('「제목」' · '7. 제목')로 나온 것(4자 이상) — 게임도 읽기 전에는 안 보인다(사용자, 2026-10-10).
 *   다른 대상의 아는 이름 · 보이는 게임 소속 칩의 조직 이름과 같은 글자는 세지 않고, 대상 · 다른이름 · 시대 · 장면은 공개 글(스토리 제목 — --titles면 남김,
 *   본 스토리의 장면 제목, fmt *_HELP 도움말)을 지우고 본다.
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
    wait: { type: 'string', default: '3000' }, // 이만큼 안에 불리는 setTimeout은 끝날 때까지 기다린다(전의 고정 대기 길이)
    quiet: { type: 'string', default: '300' }, // 할 일이 없고 DOM이 이만큼 안 바뀌면 다 그린 것
    cap: { type: 'string', default: '30000' }, // 한 화면을 이보다 오래 기다리면 경고하고 점검한다
    jobs: { type: 'string' }, // 함께 돌리는 페이지 수(기본 CPU 수, 많아야 6)
    readers: { type: 'string' }, // base,skip,skip-all — 여럿이면 한 번 띄워 같이 돈다
    timing: { type: 'boolean', default: false },
    show: { type: 'string', default: '5' },
    titles: { type: 'boolean', default: false },
    root: { type: 'string' },
    skip: { type: 'boolean', default: false },
    'skip-all': { type: 'boolean', default: false },
  },
});
const CHROME = process.env.CHROME || ['/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('크로미움을 못 찾았다 — CHROME=경로로 알려 준다'); process.exit(2); }
const WAIT = Number(args.wait);
const QUIET = Number(args.quiet);
const CAP = Number(args.cap);
const POLL = 50;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 리더로 열어 볼 것 — 뒤에 나오는 떡밥 · 인물 · 항목 · 스토리(컷오프가 낮으면 가려져야 한다)
const READER_SELS = ['thread:J1', 'thread:J3', 'thread:J5', 'person:person:모더니아', 'person:person:그레이브', 'target:concept:퀸_인자', 'target:org:바이스리터', 'unit:ch40', 'scene:d_main_41_01'];
const SEARCHES = ['모더니아', '릴리스', '레드 후드', '크라운', '퀸', '그레이브', '바이스리터', '마리안', '지휘관'];
// 떡밥 탭 흐름을 따로 열어 볼 떡밥(p.j) — 판이 있는 뼈대 · 보강 몇(W15d 묶음 · 판 점검). 기본 떡밥 탭은 J1
const THREAD_TAB = ['J3', 'J7', 'J21'];
// 연결 탭 떡밥 필터(p.th) × 가운데(p.c) — 선의 떡밥 갈래가 묶음을 타나(W15f)
// (고치기 전 새던 곳 — J16 ch01–ch04 · J15 ch06–ch12 · J5 ch14–ch17 · J10 MUDFISH · J18 FOOTSTEP–ch39)
const LINKS_TH = [['J1', 'ch05'], ['J16', 'ch01'], ['J15', 'ch12'], ['J5', 'ch17'], ['J10', 'side:mudfish'], ['J18', 'ch39']];
// 인물 탭 등장 목록 · 리더 '나오는 인물' — 이름 없이('???') 나온 스토리가 그 인물의 등장으로 보이나(W15f)
const PERSONS_WHO = ['person:그레이브', 'person:슈엔', 'person:시프티', 'person:스노우_화이트', 'person:한슨', 'person:머스탱', 'person:머스탱_한슨의_아버지']; // 슈엔 · 시프티 — 다른 인물 L32(드러남 CH.09), 한슨 = 머스탱(L33) · 아버지 머스탱 — L36(드러남 STAR ANIS)
const READER_UNITS = ['unit:ch28', 'unit:ch29', 'unit:ch08', 'unit:ch04'];

// ── 화면 안에서 도는 점검 ──
const PROBE = async (skipMain, titles, focus) => {
  const st = await import('/lib/state.js');
  const R = st.reading(st.get());
  const get = async (n) => (await fetch(`/data/${n}.json`)).json();
  const fmt = await import('/lib/format.js');
  const idx = await (await import('/lib/data.js')).index(); // 떡밥 판(j.v)이 붙은 색인 — 화면과 같은 것
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
  // 떡밥(W15a) · 떡밥판 · 묶음(W15d) — 떡밥 이름은 화면과 같은 색인(idx.threads — 판 j.v)으로 본다
  const jList = idx.threadList;
  // 지금 보이는 떡밥 이름(앞 판 제목이 뒤 판 제목 속에 든다) · 스토리 제목(공개 글 — '트레저 헌터'는 떡밥 이름이자 스토리 제목, --titles면 남김)은 지우고 본다
  let bareJ = all;
  const jMasks = [...jList.map((j) => fmt.threadAt(j, R)?.title), ...(titles ? [] : units.map((u) => u.title))];
  for (const m of jMasks.filter((x) => x && x.length >= 2).sort((a, b) => b.length - a.length)) bareJ = bareJ.split(m).join(' '.repeat(m.length));
  // 그 자리에서 아는 대상 이름과 같은 떡밥 이름('트레저 헌터' · '방주 아동 보호 센터')은 이름이 보인 것이라 세지 않는다
  const knownJ = new Set(targets.flatMap((t) => fmt.namesAt(t, R)));
  const findJ = (k) => (k && k.length >= 4 && !knownJ.has(k) ? bareJ.indexOf(k) : -1);
  for (const j of jList) {
    const a = fmt.threadAt(j, R);
    const vs = Array.isArray(j.v) ? j.v : [];
    if (!a.started) {
      for (const k of new Set([j.title, ...vs.map((v) => v.title)])) {
        const i = findJ(k);
        if (i >= 0) { hits.push(`떡밥 ${j.id} … ${around(i, k.length)}`); break; }
      }
      continue;
    }
    if (R.all) continue;
    const pick = vs.findIndex((v) => v.at === a.at && v.title === a.title);
    const later = vs.slice(pick + 1);
    const keys = [
      ...(a.title !== j.title ? [['제목', j.title]] : []), ...(a.text !== j.text && j.text ? [['요약', j.text.slice(0, 20)]] : []),
      ...later.flatMap((v) => [['뒤 판 제목', v.title], ['뒤 판 요약', String(v.text ?? '').slice(0, 20)]]),
    ];
    for (const [what, k] of keys) {
      if (k === a.title || (a.text && a.text.startsWith(k))) continue;
      const i = findJ(k);
      if (i >= 0) hits.push(`떡밥판 ${j.id} ${what} … ${around(i, k.length)}`);
    }
  }
  // 사전 설명(W15e) — 그 자리 판(fmt.noteAt)이 아닌 설명(분석용 · 뒤 판)이 보이나
  // 사전 설명이 그려지는 자리(세계 탭 .w-note · 리더 .rd-note)에서만 찾는다 — 화면 전체에서 찾으면 같은 말로 시작하는
  // 다른 글(연대기 기준점 문장 등 — t=158 연대기의 S324와 T.T.STAR 분석용 설명)을 사전 설명으로 잘못 센다
  if (!R.all) {
    const world = await get('world');
    const noteAll = roots.flatMap((sel) => [...(document.querySelector(sel)?.querySelectorAll('.w-note, .rd-note') ?? [])])
      .filter(shown).map((el) => el.innerText).join('\n');
    for (const e of world.entries ?? []) {
      const t = idx.targets.get(e.id);
      if (!t) continue;
      const now = fmt.noteAt(t, R) ?? '';
      const vs = Array.isArray(t.v) ? t.v : [];
      const pick = vs.findIndex((v) => fmt.prose(v.text) === now);
      const keys = [['분석용', e.note], ...vs.slice(pick + 1).map((v) => ['뒤 판', v.text])].map(([w, x]) => [w, String(fmt.prose(x ?? '') ?? '').slice(0, 16)]);
      for (const [what, k] of keys) {
        if (k.length < 12 || now.includes(k)) continue; // 그 자리 글 속에 든 것(분석용 설명 마디를 판이 그대로 쓴 것)은 보인 것이 맞다
        const i = noteAll.indexOf(k);
        if (i >= 0) { hits.push(`사전 ${e.id} ${what} … ${noteAll.slice(Math.max(0, i - 24), i + k.length + 16).replace(/\s+/g, ' ')}`); break; }
      }
    }
  }
  if (focus && idx.threads.has(focus) && !R.all) {
    const j = idx.threads.get(focus);
    const flow = (await get('threads-flow'))[focus] ?? { roots: [] };
    const keep = new Set(fmt.threadBundle(j, flow, R).roots.map((r) => r.id));
    for (const r of flow.roots) {
      if (keep.has(r.id) || ['아직', '암시만'].includes(fmt.stateAt(r, R))) continue;
      const texts = [fmt.prose(r.text), recs.has(r.id) ? fmt.recordText(recs.get(r.id)) : ''].filter((x) => x && x.length >= 16);
      const i = texts.map((x) => all.indexOf(x.slice(0, 16))).find((k) => k >= 0) ?? -1;
      if (i >= 0) hits.push(`묶음 ${focus} ${r.id} … ${around(i, 16)}`);
    }
  }
  // 결말(W15f) — 떡밥 탭 흐름의 결말 · 함께 맺음 줄은 그 결말이 이 떡밥에 든다는 것을 알 때만(fmt.threadTies units — 떡밥 전체를 알거나 결말 스토리에 아는 단계 · 복선)
  if (focus && idx.threads.has(focus) && !R.all && document.querySelector('.thr-flow')) {
    const map = await get('threads-map');
    const ties = fmt.threadTies(idx.threads.get(focus), (await get('threads-flow'))[focus] ?? { roots: [] }, R);
    for (const c of [...map.closures, ...map.merges]) {
      if (!c.threads?.includes(focus) || !R.seen(c.end)) continue;
      if (ties.whole || [c.end, ...(c.built ?? [])].some((u) => ties.units.has(u))) continue;
      const k = ((c.members ? c.title : fmt.prose(c.text)) || '').slice(0, 16); // 함께 맺음 줄은 제목, 결말 줄은 문장을 단다
      const i = k.length >= 8 ? all.indexOf(k) : -1;
      if (i >= 0) hits.push(`결말 ${focus} ${c.id} … ${around(i, 16)}`);
    }
  }
  // 떡밥갈래(W15f) — 연결 탭 떡밥 필터(p.th)에서 이웃으로 보이는 스토리는, 가운데와의 선 가운데 그 떡밥의 아는 기록(threadTies ids)이 든 것이 있어야 한다
  const lk = document.querySelector('.lk-node.is-active, .lk-node') ? (await import('/lib/state.js')).param('links', 'th') : null;
  if (lk && !R.all && idx.threads.has(lk)) {
    const links = await get('links');
    const ties = fmt.threadTies(idx.threads.get(lk), (await get('threads-flow'))[lk] ?? { roots: [] }, R);
    const center = (await import('/lib/state.js')).param('links', 'c');
    for (const card of document.querySelectorAll('#main .lk-node[data-key]')) {
      const k = card.dataset.key;
      if (!center || k === center) continue;
      const es = links.edges.filter((e) => ((e.from === center && e.to === k) || (e.to === center && e.from === k)) && (e.threads ?? []).includes(lk));
      if (!es.length) continue;
      if (!es.some((e) => ties.whole || (e.records ?? []).some((r) => ties.ids.has(r)))) hits.push(`떡밥갈래 ${lk} ${center}–${k}`);
    }
  }
  // 이름없음(W15f) — 그 스토리에 이름이 안 쓰인 등장('???'로만 · 암시 언급만 — persons-detail hid)을 그 인물의 등장으로 낸 것: 리더 '나오는 인물' · 인물 탭 등장 목록
  // 사칭(W23a) — 드러나기 전(fmt.impKnown 거짓) 스토리에서 그 자리 모습(fmt.rowAt)으로는 없는 등장(사칭한 인물)을 낸 것 · 드러나기 전에 보인 사칭 표 · 머리 '사칭' 줄
  if (!R.all) {
    const det = await get('persons-detail');
    const rows = det.map((p) => [p.id, p.units.map((u) => fmt.rowAt(u, R))]);
    const hid = new Set(rows.flatMap(([id, us]) => us.filter((u) => u.hid).map((u) => `${id}|${u.unit}`)));
    const pre = (u) => u.pre && !fmt.impKnown(u, R);
    const quiet = new Set(rows.flatMap(([id, us]) => us.filter((u) => pre(u) && !(u.speaker > 0)).map((u) => `${id}|${u.unit}`))); // 리더는 말한 인물만
    const absent = new Set(rows.flatMap(([id, us]) => us.filter((u) => pre(u) && !u.scenes).map((u) => `${id}|${u.unit}`)));
    const sel = (await import('/lib/state.js')).get().sel ?? '';
    if (sel.startsWith('unit:')) {
      const u = sel.slice(5);
      for (const a of document.querySelectorAll('#reader .rd-people-panel a[data-sel^="person:"]')) {
        if (!shown(a)) continue;
        const pid = a.dataset.sel.slice(7);
        if (hid.has(`${pid}|${u}`)) hits.push(`이름없음 리더 ${u} ${pid}`);
        if (quiet.has(`${pid}|${u}`)) hits.push(`사칭 리더 ${u} ${pid}`);
      }
    }
    const who = (await import('/lib/state.js')).param('persons', 'who');
    if (who) {
      for (const li of document.querySelectorAll('#main .pm-us-item[data-sel^="unit:"]')) {
        const u = li.dataset.sel.slice(5);
        if (hid.has(`${who}|${u}`)) hits.push(`이름없음 인물 ${who} ${u}`);
        if (absent.has(`${who}|${u}`)) hits.push(`사칭 인물 ${who} ${u}`);
      }
      const me = (await get('persons')).find((p) => p.id === who);
      if (!(me?.imp ?? []).some((x) => fmt.impKnown(x, R))) {
        for (const c of document.querySelectorAll('#main .pm-imp')) if (shown(c)) hits.push(`사칭 표 ${who} ${c.textContent}`);
        for (const c of document.querySelectorAll('#main .pm-fact-l')) if (shown(c) && c.textContent === '사칭') hits.push(`사칭 머리 ${who}`);
      }
      // 사칭 기록(W23b) — 실제 인물로 적힌 기록(imp)이 그 자리 모습(fmt.recAt)으로는 이 인물 것이 아닌데 인물 탭에 보인 것
      const recs = new Map([...(await get('records')), ...(await get('records2'))].filter((r) => r.imp).map((r) => [r.id, r]));
      const seenRec = new Set();
      for (const a of document.querySelectorAll('#main [data-sel^="record:"]')) {
        const id = a.dataset.sel.slice(7);
        const r = recs.get(id);
        if (!r || seenRec.has(id) || !shown(a)) continue;
        seenRec.add(id);
        if (!fmt.recHas(r, who, R)) hits.push(`사칭 기록 ${who} ${id}`);
      }
    }
  }
  // 사칭이름(W23d · W24a) — 다른 인물(split)의 실제 사람을 가르는 화면 이름(label — '머스탱 (한슨의 아버지)')이 드러나기 전에 보인 것
  const splitRev = new Map((await get('persons')).flatMap((p) => (p.imp ?? []).filter((x) => x.as).map((x) => [p.id, x])));
  for (const t of targets) {
    if (!splitRev.has(t.id) || !t.label || fmt.impKnown(splitRev.get(t.id), R)) continue;
    const i = all.indexOf(t.label);
    if (i >= 0) hits.push(`사칭이름 ${t.id} ${t.label} … ${around(i, t.label.length)}`);
  }
  // 대상 · 다른 이름 · 시대(W15b) — 그 자리에서 아는 이름은 다른 대상의 것이라도 세지 않는다. 게임 소속 칩의 조직 이름(출시 = 공개, W12d)도 아는 이름
  const knownNames = new Set(targets.flatMap((t) => fmt.namesAt(t, R)));
  for (const t of targets) if (fmt.met(t, R)) for (const o of fmt.orgsAt(t, R.all ? null : R.t)) knownNames.add(o.name);
  // 공개 글은 지우고 본다 — 스토리 제목(감상 순서 탭에 다 보인다, --titles면 남김) · 본 스토리의 장면 제목 · 도움말(*_HELP — 스토리 종류 설명의 '금서고' · '전초기지')
  // 안 본 스토리의 장면 제목은 공개가 아니다(게임도 읽기 전에는 안 보인다 — 사용자 2026-10-10) — 아래 '장면'으로 센다
  let bare = all;
  const scenes = await get('scenes');
  const masks = [...(titles ? [] : units.map((u) => u.title)), ...scenes.filter((x) => unitSeen(x.unit)).map((x) => x.title), ...Object.entries(fmt).filter(([k]) => k.endsWith('_HELP')).flatMap(([, v]) => Object.values(v))];
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
  const titleSet = new Set(units.map((u) => u.title));
  for (const x of scenes) {
    if (unitSeen(x.unit) || !x.title || [...x.title].length < 4 || titleSet.has(x.title) || knownNames.has(x.title)) continue;
    // 장면 이름 꼴로 나온 것만 — '7장면 「제목」' · 장면 목록 '7. 제목'(같은 말이 떡밥 제목 · 기록 문장에 우연히 들 수 있다)
    const i = [`「${x.title}」`, `${x.seq}. ${x.title}`].map((k) => bare.indexOf(k)).find((j) => j >= 0) ?? -1;
    if (i >= 0) hits.push(`장면 ${x.id} … ${around(i, x.title.length + 2)}`);
  }
  for (const p of chrono.points.filter((x) => x.era)) {
    if (R.all || (p.meet ?? []).some((k) => R.seen(k))) continue;
    const name = p.name.replace(/\s*\(.*?\)/g, '').trim();
    const i = bare.indexOf(name);
    if (i >= 0 && !knownNames.has(name)) hits.push(`시대 ${p.id} … ${around(i, name.length)}`);
  }
  return { t: R.t, hits };
};

// ── 다 그렸나(조건 대기) ──
// 고정 sleep 대신, 페이지 시작 전에 심은 계수기로 '할 일이 다 끝나고 잠잠하다'를 본다 — 네트워크(CDP Network, 모듈 import 포함)
// · fetch와 그 본문 읽기 · 짧은 setTimeout(LIMIT ms 이하 — 전의 고정 대기 안에 불렸을 것) · requestAnimationFrame · requestIdleCallback이
// 하나도 안 남고, DOM이 QUIET ms 동안 안 바뀌면 다 그린 것. 전의 3초보다 늦게 끝나는 일(기록 6MB 받기 등)도 끝까지 기다린다.
const INSTRUMENT = (LIMIT) => {
  const W = window;
  let pend = 0;
  let last = performance.now();
  const bump = () => { last = performance.now(); };
  const live = { t: new Set(), r: new Set(), i: new Set() };
  const wrap = (setName, clearName, bag, short) => {
    const set0 = W[setName];
    const clr0 = W[clearName];
    if (!set0) return;
    W[setName] = function (fn, ms, ...rest) {
      if (typeof fn !== 'function' || !short(ms)) return set0.call(W, fn, ms, ...rest);
      const id = set0.call(W, (...a) => { bag.delete(id); bump(); return fn(...a); }, ms, ...rest);
      bag.add(id);
      return id;
    };
    if (clr0) W[clearName] = function (id) { bag.delete(id); return clr0.call(W, id); };
  };
  wrap('setTimeout', 'clearTimeout', live.t, (ms) => (Number(ms) || 0) <= LIMIT);
  wrap('requestAnimationFrame', 'cancelAnimationFrame', live.r, () => true);
  wrap('requestIdleCallback', 'cancelIdleCallback', live.i, () => true);
  const track = (p) => { pend++; return p.finally(() => { pend--; bump(); }); };
  const f0 = W.fetch;
  W.fetch = function (...a) { return track(f0.apply(this, a)); };
  for (const m of ['json', 'text', 'arrayBuffer', 'blob']) {
    const m0 = Response.prototype[m];
    Response.prototype[m] = function (...a) { return track(m0.apply(this, a)); };
  }
  new MutationObserver(bump).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  W.__spoilBusy = () => ({ busy: pend + live.t.size + live.r.size + live.i.size, quiet: performance.now() - last, ready: document.readyState === 'complete' });
};

// ── CDP ──
async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const wait = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
    else if (d.method) for (const f of listeners) f(d);
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; wait.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  return { send, on: (f) => listeners.add(f), close: () => ws.close() };
}

// 독자 — --readers가 없으면 --skip · --skip-all로 하나를 고른다(전과 같다)
const READERS = (args.readers ?? (args['skip-all'] ? 'skip-all' : args.skip ? 'skip' : 'base')).split(',').map((x) => x.trim()).filter(Boolean);
for (const r of READERS) if (!['base', 'skip', 'skip-all'].includes(r)) { console.error(`--readers: 모르는 독자 ${r} (base · skip · skip-all)`); process.exit(2); }
const JOBS = Math.max(1, Number(args.jobs ?? Math.min(6, os.availableParallelism())));

const server = await serve({ port: Number(args.port), ...(args.root ? { root: path.resolve(args.root) } : {}) });
const base = `http://127.0.0.1:${server.address().port}`;
const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'spoil-'));
// 여러 페이지를 함께 돌리므로 뒤에 있는 창도 타이머 · 그리기를 늦추지 않게 한다
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--window-size=1400,1000',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\S+)/); if (m) res(m[1]); });
  chrome.on('exit', () => rej(new Error('크로미움이 바로 끝났다')));
});
const c = await cdp(wsUrl);

/** 페이지(창) 하나 — 화면을 차례로 띄우고, 다 그릴 때까지 기다리고, 점검한다 */
async function newPage() {
  const { result: { targetId } } = await c.send('Target.createTarget', { url: 'about:blank', newWindow: true, width: 1400, height: 1000 });
  const { result: { sessionId } } = await c.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => c.send(m, p, sessionId);
  const net = new Set();
  let netAt = Date.now();
  c.on((d) => {
    if (d.sessionId !== sessionId) return;
    const rid = d.params?.requestId;
    if (d.method === 'Network.requestWillBeSent') net.add(rid);
    else if (d.method === 'Network.loadingFinished' || d.method === 'Network.loadingFailed') net.delete(rid);
    else return;
    netAt = Date.now();
  });
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Network.enable');
  await S('Page.addScriptToEvaluateOnNewDocument', { source: `(${INSTRUMENT})(${WAIT})` });
  const evaluate = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? '평가 실패');
    return r.result?.result?.value;
  };
  let n = 0;
  const settle = async (name) => {
    const t0 = Date.now();
    for (;;) {
      await sleep(POLL);
      let b = null;
      try { b = await evaluate('window.__spoilBusy?.() ?? null'); } catch { /* 새 문서로 넘어가는 중 */ }
      if (b && b.ready && !b.busy && !net.size && b.quiet >= QUIET && Date.now() - netAt >= QUIET) return Date.now() - t0;
      if (Date.now() - t0 > CAP) {
        console.error(`⚠ ${name} — ${CAP}ms 안에 잠잠해지지 않았다(${b ? `할 일 ${b.busy} · ready ${b.ready}` : '계수기 없음'} · 네트워크 ${net.size}) — 그대로 점검한다`);
        return Date.now() - t0;
      }
    }
  };
  return {
    evaluate,
    settle,
    open: async (hash, x, name) => { await S('Page.navigate', { url: `${base}/?n=${++n}#${hash}${x}` }); return settle(name); },
    close: () => c.send('Target.closeTarget', { targetId }),
  };
}

/** 떡밥 탭이 지금 그리는 떡밥 — 목록에서 고른 줄(없으면 p.j) */
const THREAD_NOW = `(async () => { const st = await import('/lib/state.js'); return document.querySelector('.thr-listrow.is-sel')?.dataset.j ?? st.param('threads', 'j') ?? 'J1'; })()`;
const probe = (pg, skipMain = false, focus = null) => pg.evaluate(`(${PROBE})(${skipMain}, ${args.titles}, ${JSON.stringify(focus)})`);
// --skip — 체크 칸 스토리(units.json check — 사이드 · 픽업 이벤트, W16a)를 다 끈 독자(W15f). 딸린 유실물 키는 state가 버리고 딸린 이벤트의 칸을 따른다. 게임에서 아무 때나 보는 스토리라, 거기서만 먼저 나온 것이 메인만 본 독자에게 새는지
const unitsJson = JSON.parse(fs.readFileSync(path.join(args.root ?? path.resolve(import.meta.dirname, '../../site'), 'data/units.json'), 'utf8'));
const checkKeys = unitsJson.filter((u) => u.check);
// --skip-all(W16b) — 갈래 통째 안 봄(state.js 압축 형식 '-@갈래')
const xFor = (reader, t) => (t === 'all' ? '' : reader === 'skip-all' ? `&x=${encodeURIComponent('-@major,-@side,-@event,-@episode')}`
  : reader === 'skip' ? `&x=${encodeURIComponent(checkKeys.filter((u) => u.tick <= Number(t)).map((u) => `-${u.key}`).join(','))}` : '');

// 할 일 목록 — 화면 하나가 일 하나(새 문서로 띄운다). 검색은 전처럼 세계 탭 한 문서에서 차례로 친다(앞 검색이 받은 기록 · 줄거리를 이어 쓴다)
const tabs = args.tabs.split(',');
const jobs = [];
for (const reader of READERS) {
  const pre = READERS.length > 1 ? `[${reader}] ` : '';
  for (const t of args.t.split(',')) {
    const x = xFor(reader, t);
    const screen = (name, hash, how) => jobs.push({ x, run: async (pg) => [[`${pre}${name}`, await pg.open(hash, x, `${pre}${name}`), await how(pg)]] });
    for (const tab of tabs) {
      screen(`t=${t} ${tab}`, `tab=${tab}&t=${t}`, async (pg) => probe(pg, tab === 'order', tab === 'threads' ? await pg.evaluate(THREAD_NOW) : null));
      if (tab === 'threads') for (const j of THREAD_TAB) screen(`t=${t} threads ${j}`, `tab=threads&t=${t}&p.j=${j}`, async (pg) => probe(pg, false, await pg.evaluate(THREAD_NOW)));
    }
    if (tabs.includes('links')) for (const [j, cc] of LINKS_TH) screen(`t=${t} links ${j} ${cc}`, `tab=links&t=${t}&p.th=${j}&p.c=${encodeURIComponent(cc)}`, (pg) => probe(pg, false));
    if (tabs.includes('persons')) for (const who of PERSONS_WHO) screen(`t=${t} persons ${who}`, `tab=persons&t=${t}&p.who=${encodeURIComponent(who)}`, (pg) => probe(pg, false));
    for (const sel of [...READER_SELS, ...READER_UNITS]) screen(`t=${t} 리더 ${sel}`, `tab=world&t=${t}&sel=${encodeURIComponent(sel)}`, (pg) => probe(pg, true, sel.startsWith('thread:') ? sel.slice(7) : null));
    jobs.push({
      x,
      run: async (pg) => {
        const out = [];
        let ms = await pg.open(`tab=world&t=${t}`, x, `${pre}t=${t} 검색`);
        for (const q of SEARCHES) {
          await pg.evaluate(`(() => { const i = document.querySelector('#search'); i.focus(); i.value = ${JSON.stringify(q)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
          ms += await pg.settle(`${pre}t=${t} 검색 '${q}'`);
          out.push([`${pre}t=${t} 검색 '${q}'`, ms, await probe(pg, true)]);
          ms = 0;
        }
        return out;
      },
    });
  }
}

const report = [];
let total = 0;
const waits = [];
const note = (name, r) => {
  total += r.hits.length;
  report.push(`== ${name} — ${r.hits.length}`, ...r.hits.map((h) => `  ${h}`));
  console.log(`${r.hits.length ? '✗' : '✓'} ${name} — ${r.hits.length}`);
  for (const h of r.hits.slice(0, Number(args.show))) console.log(`    ${h}`);
};

const started = Date.now();
const pages = [];
try {
  // 일은 여럿이 함께 돌리되, 출력 · 보고서는 목록 차례대로 낸다
  const done = new Array(jobs.length);
  let shown = 0;
  let next = 0;
  const flush = () => { for (; shown < jobs.length && done[shown]; shown++) for (const [name, , r] of done[shown]) note(name, r); };
  const worker = async () => {
    const pg = await newPage();
    pages.push(pg);
    for (let i = next++; i < jobs.length; i = next++) {
      const t0 = Date.now();
      done[i] = await jobs[i].run(pg);
      waits.push({ name: done[i][0][0], ms: Date.now() - t0, wait: done[i].reduce((a, [, w]) => a + w, 0), screens: done[i].length });
      flush();
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));
} finally {
  for (const pg of pages) await pg.close().catch(() => {});
  c.close();
  const gone = new Promise((r) => chrome.once('exit', r));
  chrome.kill();
  await Promise.race([gone, sleep(3000)]);
  server.close();
  try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 3 }); } catch { /* 임시 폴더 — 남아도 된다 */ }
}
if (args.out) fs.writeFileSync(args.out, `${report.join('\n')}\n`);
const screens = waits.reduce((a, w) => a + w.screens, 0);
const sum = (k) => waits.reduce((a, w) => a + w[k], 0);
console.log(`\n새는 것 ${total}건${args.out ? ` → ${args.out}` : ''}`);
console.log(`걸린 시간 ${((Date.now() - started) / 1000).toFixed(1)}초 — 화면 ${screens}개 · 페이지 ${JOBS}개 함께 · 화면당 ${(sum('ms') / screens / 1000).toFixed(2)}초(그리기 대기 ${(sum('wait') / screens / 1000).toFixed(2)}초)`);
if (args.timing) for (const w of [...waits].sort((a, b) => b.ms - a.ms).slice(0, 10)) console.log(`  ${(w.ms / 1000).toFixed(2)}초 (대기 ${(w.wait / 1000).toFixed(2)}) ${w.name}${w.screens > 1 ? ` 외 ${w.screens - 1}` : ''}`);
process.exit(total ? 1 : 0);
