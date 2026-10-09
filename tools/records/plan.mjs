/**
 * 출시순 한 줄 읽기 순서 → 세션 묶음 초안 (SESSIONS.md R · P · M 항목을 만들 때 쓴 생성기, 2026-09-29).
 * 순서의 원본은 SESSIONS.md 하나다 — 이 스크립트는 초안 두 파일을 쓸 뿐이고, 항목을 붙여 넣고 인계 메모를 다는 건 손으로 한다.
 *
 *   node tools/records/plan.mjs <출력 디렉터리>    → plan-R.md(1회독, 끝난 R01 몫 빼고 R02부터) · plan-M.md(2회독, P1 파일럿 + M01…)
 *   node tools/records/plan.mjs <출력 디렉터리> --layers  → plan-M.md를 2회독 층별로(B0b-2): 1층(P1 + M…) → C1 → 2층 → 3층, 층 안은 출시순
 *     층은 annotations/layers.json의 판정 + tools/records/layers.mjs 규칙(확정 · 후보 모두 — 기각은 뺀다). 층이 없는 단위가 있으면 멈춘다.
 *
 * 입력: data/release/release-order.csv(공개일) · annotations/subquest-regions.json · annotations/relic-regions.json · read.mjs list(분량).
 * 규칙: 같은 날은 메인(챕터마다 딸린 서브퀘스트 · 유실물, ch07 뒤 엘리베이터) → 사이드 → 이벤트(딸린 이벤트 유실물) → 호감도 스토리.
 * 세션당 10만 자(read.mjs list 기준) 이하로 앞에서부터 채운다. 챕터 + 딸린 것, 이벤트 + 이벤트 유실물은 되도록 한 세션에 둔다.
 * 10만 자가 넘는 단위만 파트로 나눈다.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const S = process.argv[2] ?? (console.error("출력 디렉터리를 준다: node tools/records/plan.mjs <디렉터리> [--layers]"), process.exit(1));
const BY_LAYERS = process.argv.includes('--layers');
const run = (a) => execFileSync('node', ['tools/read.mjs', ...a], { encoding: 'utf8', maxBuffer: 1 << 26 });
const num = (s) => Number(s.replace(/,/g, ''));
// 단위 크기 · 파트
const size = new Map();
for (const k of ['main', 'event', 'side', 'char', 'erelic', 'relic', 'sub']) {
  for (const l of run(['list', k]).split('\n')) {
    const m = l.match(/^(\S+) .* ([\d,]+)자 · (\d+)파트(?: \(금서고\))?$/);
    if (m) size.set(m[1], { chars: num(m[2]), parts: Number(m[3]) });
  }
}
const sceneSize = (key) => { const h = run([key]).split('\n')[0]; return { chars: num(h.match(/([\d,]+)자/)[1]), parts: 1 }; };
const sub = JSON.parse(fs.readFileSync('annotations/subquest-regions.json', 'utf8')).scenes;
const rel = JSON.parse(fs.readFileSync('annotations/relic-regions.json', 'utf8')).relics;
const eventKey = { event_forrest: 'fl:for_rest', event_boomtheghost1: 'fl:boom_the_ghost' };
const erelicAfter = { event_overzone: ['erelic:white_memory'], event_redash: ['erelic:red_ash_lost', 'erelic:red_ash_mini'],
  event_oldtales1: ['erelic:old_tales_dialog', 'erelic:old_tales_lost', 'erelic:old_tales_mini_memory'],
  event_unbreakablesphere1: ['erelic:unbreakable_sphere_dialog', 'erelic:unbreakable_sphere_lost'], event_goddessfall1: ['erelic:goddess_fall_mini'] };
// csv
const rows = fs.readFileSync('data/release/release-order.csv', 'utf8').trim().split('\n').slice(1)
  .map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((s) => s.replace(/,$/, '')))
  .map((c) => ({ rank: Number(c[0]), date: c[1], kind: c[2], key: c[3] }));
const kindRank = { main: 0, side: 1, event: 2, episode: 3 };
rows.sort((a, b) => a.rank - b.rank || kindRank[a.kind] - kindRank[b.kind]);
const items = [];
const push = (key, kind, date, sz) => items.push({ key, kind, date, ...(sz ?? size.get(key) ?? (() => { throw new Error('크기 없음 ' + key); })()) });
for (const r of rows) {
  if (r.kind === 'main') {
    push(r.key, 'main', r.date);
    const ch = Number(r.key.slice(2));
    for (const s of sub.filter((s) => s.chapter === ch)) push(s.id, 'sub', r.date, sceneSize(s.id));
    for (const x of rel.filter((x) => x.chapter === ch)) push(x.id, 'relic', r.date);
    if (ch === 7) push('d_ex_elevator_01', 'sudden', r.date, sceneSize('d_ex_elevator_01'));
  } else if (r.kind === 'event') {
    const k = eventKey[r.key] ?? r.key;
    push(k, 'event', r.date);
    for (const e of erelicAfter[r.key] ?? []) push(e, 'erelic', r.date);
  } else push(r.key, r.kind, r.date);
}
// 검사: 빠진 단위
const seen = new Set(items.map((i) => i.key));
const subUnits = new Set(sub.map((s) => s.id.replace(/_\d\d$/, '')));
const missing = [...size.keys()].filter((k) => !seen.has(k) && !subUnits.has(k));
if (missing.length) console.log('순서에 없는 단위:', missing.join(' '));
// 큰 단위는 파트로 쪼갠다
const LIMIT = 100000;
const pieces = [];
for (const it of items) {
  if (it.chars <= LIMIT) { pieces.push(it); continue; }
  const n = Math.ceil(it.chars / LIMIT); const per = Math.ceil(it.parts / n);
  for (let a = 1; a <= it.parts; a += per) { const b = Math.min(it.parts, a + per - 1);
    pieces.push({ ...it, range: [a, b], chars: Math.round((it.chars * (b - a + 1)) / it.parts), parts: b - a + 1 }); }
}
// 묶음: 챕터 + 딸린 서브퀘스트 · 유실물, 이벤트 + 이벤트 유실물, 한 서브퀘스트의 씬들은 되도록 한 세션에 둔다
const blocks = (list) => { const bs = [];
  for (const p of list) { const last = bs[bs.length - 1];
    const follows = last && !p.range && (['sub', 'relic', 'sudden'].includes(p.kind) && ['main', 'sub', 'relic', 'sudden'].includes(last[0].kind) && !last[0].range
      || p.kind === 'erelic' && ['event', 'erelic'].includes(last[0].kind));
    if (follows) last.push(p); else bs.push([p]); }
  // 한도를 넘는 묶음은 도로 푼다
  return bs.flatMap((b) => (b.reduce((a, p) => a + p.chars, 0) > LIMIT ? b.map((p) => [p]) : [b])); };
const pack = (list, firstLimit) => { const ss = []; let cur = []; let sum = 0; let lim = firstLimit ?? LIMIT;
  for (const b of blocks(list)) { const c = b.reduce((a, p) => a + p.chars, 0);
    if (cur.length && sum + c > lim) { ss.push(cur); cur = []; sum = 0; lim = LIMIT; } cur.push(...b); sum += c; }
  if (cur.length) ss.push(cur); return ss; };
const fmt = (ps) => { const out = []; let i = 0;
  while (i < ps.length) { const p = ps[i];
    if (p.kind === 'main' && !p.range) { let j = i; while (j + 1 < ps.length && ps[j + 1].kind === 'main' && !ps[j + 1].range && Number(ps[j + 1].key.slice(2)) === Number(ps[j].key.slice(2)) + 1) j++;
      out.push({ g: 'main', t: j > i ? `${p.key}–${ps[j].key.slice(2)}` : p.key }); i = j + 1; continue; }
    const t = `\`${p.key}\`${p.range ? ` 파트 ${p.range[0]}–${p.range[1]}` : ''}${p.key.startsWith('fl:for_rest') ? '(= `event_forrest` 본문)' : p.key.startsWith('fl:boom_the_ghost') ? '(= `event_boomtheghost1` 본문)' : ''}`;
    const last = out[out.length - 1]; if (last && last.g === p.kind) last.t += ' ' + t; else out.push({ g: p.kind, t }); i++; }
  const chars = ps.reduce((a, p) => a + p.chars, 0), parts = ps.reduce((a, p) => a + p.parts, 0);
  const dates = [...new Set(ps.map((p) => p.date))]; const d = dates.length > 1 ? `${dates[0]}~${dates.at(-1)}` : dates[0];
  return `${out.map((o) => o.t).join(' · ')} — ${(chars / 10000).toFixed(1)}만 자 · ${parts}파트 · ${d}`; };
const done = new Set(['ch00','ch01','ch02','ch03','ch04','ch05','ch06','sub:칠리페퍼_00','sub:테트라_커넥트_00','sub:세르반_00','sub:중앙_정부_공식__00']);
const rest = pieces.filter((p) => !done.has(p.key));
const R = pack(rest);
fs.writeFileSync(`${S}/plan-R.md`, R.map((ps, i) => `- [ ] **R${String(i + 2).padStart(2, '0')}** ${fmt(ps)}`).join('\n') + '\n');
// 2회독: 파일럿(≈4만) 뒤 M01…
let mSessions = 0;
if (!BY_LAYERS) {
  const P = pack(pieces, 50000);
  mSessions = P.length;
  fs.writeFileSync(`${S}/plan-M.md`, [`- [ ] **P1 2회독 파일럿** ${fmt(P[0])}`, ...P.slice(1).map((ps, i) => `- [ ] **M${String(i + 1).padStart(2, '0')}** ${fmt(ps)}`)].join('\n') + '\n');
} else {
  // 층별(B0b-2): 층마다 출시순으로 따로 묶는다 — 1층 첫 묶음이 파일럿 P1, 1층 끝에 C1(중간 점검)
  const { loadDataset } = await import('./model.mjs');
  const { loadOrder } = await import('./order.mjs');
  const { computeLayers } = await import('./layers.mjs');
  const lay = computeLayers(loadDataset(), loadOrder());
  const layerOf = (key) => lay.byUnit.get(key)?.layer ?? null;
  const none = [...new Set(pieces.filter((p) => !layerOf(p.key)).map((p) => p.key))];
  if (none.length) { console.error(`층이 없는 단위 ${none.length}: ${none.slice(0, 10).join(' ')} — records.mjs layers --add 뒤 판정`); process.exit(1); }
  const out = [];
  let m = 0;
  const label = { 1: '1층', 2: '2층', 3: '3층' };
  for (const n of [1, 2, 3]) {
    const list = pieces.filter((p) => layerOf(p.key) === n);
    const chars = list.reduce((a, p) => a + p.chars, 0);
    const P = pack(list, n === 1 ? 50000 : undefined);
    out.push('', `#### ${label[n]} — ${new Set(list.map((p) => p.key)).size}단위 · ${(chars / 10000).toFixed(1)}만 자 · ${P.length}세션`, '');
    P.forEach((ps, i) => out.push(n === 1 && i === 0 ? `- [ ] **P1 2회독 파일럿** ${fmt(ps)}` : `- [ ] **M${String(++m).padStart(2, '0')}** ${fmt(ps)}`));
    if (n === 1) out.push('- [ ] **C1 👤 1층 끝 중간 점검**');
  }
  fs.writeFileSync(`${S}/plan-M.md`, out.join('\n').trimStart() + '\n');
  mSessions = m + 1;
}
const tot = (k) => items.filter((i) => i.kind === k).reduce((a, i) => a + i.chars, 0);
console.log('항목', items.length, 'R 세션', R.length, 'M 세션(P1 포함)', mSessions, '합계', items.reduce((a, i) => a + i.chars, 0), Object.fromEntries(['main','sub','relic','event','erelic','side','episode','sudden'].map((k) => [k, tot(k)])));
