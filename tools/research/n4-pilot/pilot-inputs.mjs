/**
 * N4 파일럿 입력 생성기 (연구용 — docs/reread-method.md 9절). 지금 기록(annotations/read1 · threads.json)으로
 *   A. 자리별 열린 의문(P0 평문 전체) · 단위 맞춤 목록(P1 — 낱말 겹침 + 줄기 경유) · 원문 · 직전 줄거리
 *   C. 줄기별 회수 감사 입력(줄기의 의문 전부 + 줄기 대상의 뒤 사실 + 의문별 낱말 겹침 사실)
 *   B. 아크 인계(앞 단위 요약)
 * 를 만든다. 실무 도구가 아니다 — 모델이 바뀌어 파일럿을 다시 돌릴 때 쓴다(README.md).
 *
 *   node tools/research/n4-pilot/pilot-inputs.mjs <출력 디렉터리>   (DB가 있어야 한다 — ensure-db.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadOrder } from '../../records/order.mjs';
import { loadDataset } from '../../records/model.mjs';
import { openContext } from '../../records/context.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : (() => { console.error('쓰는 법: node tools/research/n4-pilot/pilot-inputs.mjs <출력 디렉터리>'); process.exit(1); })();
fs.mkdirSync(OUT, { recursive: true });
const order = loadOrder();
const pos = new Map();
for (const it of order.items) if (!pos.has(it.key)) pos.set(it.key, it.index);
const ds = loadDataset();
const live = ds.candidates.filter((c) => c.id && c.status !== '기각' && ['facts', 'questions', 'events'].includes(c.section) && !c.file.startsWith('read2/'));
const facts = live.filter((c) => c.section === 'facts');
const questions = live.filter((c) => c.section === 'questions');
const events = live.filter((c) => c.section === 'events');
const threads = ds.threads.data.threads;
const threadOf = new Map();
for (const t of threads) for (const q of t.questions ?? []) threadOf.set(q, t);
const ctx = await openContext();

const ev = (c) => (c.obj?.evidence ?? []).map((e) => `${e.scene}#${(e.lines ?? []).join(',')}`).join(' ');
const where = (c) => `${c.unit} ${ev(c)}`;

// 자리 p 앞까지의 의문 상태
function stateAsOf(q, p) {
  const ans = events.filter((e) => e.parent === q.id && e.act === '회수' && (p == null || pos.get(e.unit) < p));
  if (ans.some((e) => e.obj?.degree === '전부')) return { state: '풀림', ans };
  if (ans.length) return { state: '일부', ans };
  return { state: '열림', ans };
}
function openAsOf(p) {
  return questions.filter((q) => (p == null || pos.get(q.unit) < p)).map((q) => ({ q, ...stateAsOf(q, p) })).filter((x) => x.state !== '풀림');
}
const qLine = ({ q, state, ans }) => `- ${q.id} ${q.text} · ${where(q)}${ans.length ? ' · ' + ans.map((e) => `일부 → ${e.obj?.answer} (${e.id} ${e.unit})`).join(' · ') : ''}`;
function renderFlat(list, title) {
  const bySession = new Map();
  for (const x of list) (bySession.get(x.q.session) ?? bySession.set(x.q.session, []).get(x.q.session)).push(x);
  const out = [`# ${title}`, '', `의문 ${list.length}건 — 열림 ${list.filter((x) => x.state === '열림').length} · 일부 풀림 ${list.filter((x) => x.state === '일부').length}. \`일부 → F7 (Q3-2 단위)\`: 회수 기록과 답이 된 사실 ID. 새로 풀리는 것을 보면 회수를 적는다.`, ''];
  for (const [s, xs] of bySession) { out.push(`## 열린 의문 — ${s}`); for (const x of xs) out.push(qLine(x)); out.push(''); }
  return out.join('\n');
}

// 낱말 겹침 점수
const STOP = new Set(['무엇', '누구', '어떻게', '어떤', '무슨', '어디', '언제', '정말', '지휘관', '니케', '랩쳐', '방주', '지상', '인간', '사람', '이야기', '때문', '관계', '그것', '이것', '자신', '자기', '이유', '까닭', '존재', '사실', '사건', '까지', '부터', '어느', '모두', '다시', '지금', '과연', '아직', '다른', '같은', '있나', '없나', '하나', '되나', '했나', '인가', '뜻', '무엇인가', '누구인가', '카운터스', '라피', '아니스', '네온', '마리안']);
const PART = /(에게서|으로써|으로서|에서는|에서도|에게는|에게도|한테서|한테는|으로는|으로도|이라는|이라고|이라서|이라면|이라도|이었나|이었다|였나|였다|은|는|이|가|을|를|의|에|에서|로|으로|과|와|도|만|에게|께|한테|부터|까지|이고|이며|이나|나|야|라|란|든|인|인지|이란|들|이다|다|했나|하나|되나|인가|인데|이지만|지만|라고|라는|라면)$/;
function tokens(text) {
  const raw = text.replace(/[^가-힣A-Za-z0-9.]+/g, ' ').split(' ').filter((t) => t.length >= 2);
  const set = new Set();
  for (let t of raw) {
    let s = t;
    for (let i = 0; i < 2; i++) { const m = s.match(PART); if (m && s.length - m[0].length >= 2) s = s.slice(0, s.length - m[0].length); }
    if (s.length >= 2 && !STOP.has(s)) set.add(s);
  }
  return [...set];
}
const unitText = new Map();
for (const u of ctx.units) { const r = ctx.resolve(u.key); if (!r) continue; unitText.set(u.key, r.scenes.map((s) => ctx.lines(s).map((l) => l.text).join('\n')).join('\n')); }
const dfCache = new Map();
function df(tok) {
  if (dfCache.has(tok)) return dfCache.get(tok);
  let n = 0; for (const t of unitText.values()) if (t.includes(tok)) n++;
  dfCache.set(tok, n); return n;
}
const N = unitText.size;
function score(text, target) {
  const hits = [];
  let s = 0;
  for (const tok of tokens(text)) {
    if (!target.includes(tok)) continue;
    const d = df(tok) || 1; const w = Math.log(N / d); if (w <= 0.3) continue; s += w; hits.push(tok);
  }
  return { s, hits };
}
function unitTargets(key) {
  const out = execFileSync('node', ['tools/query.mjs', 'targets', key], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 });
  return new Set(out.split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((t) => /^[a-z_]+:/.test(t)));
}
function readText(key, part) {
  const args = ['tools/read.mjs', key, '--num']; if (part) args.push('--part', String(part));
  return execFileSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
}

const UBIQ = new Set(['person:지휘관', 'concept:니케', 'place:방주', 'concept:랩쳐', 'place:지상', 'org:카운터스', 'person:라피', 'person:아니스', 'person:네온', 'concept:헬레틱', 'org:중앙_정부']);
// ── A. 자리별 열린 의문 ──
const A = [
  { key: 'sub:든_셀_00', part: null, bench: ['Q10'] },
  { key: 'ch39', part: 2, bench: ['Q144'] },
  { key: 'ch48', part: 1, bench: ['Q20', 'Q63'] },
];
for (const a of A) {
  const dir = path.join(OUT, 'A', a.key.replace(/[:]/g, '_')); fs.mkdirSync(dir, { recursive: true });
  const p = pos.get(a.key);
  const list = openAsOf(p);
  const text = readText(a.key, a.part);
  fs.writeFileSync(path.join(dir, 'text.md'), text);
  fs.writeFileSync(path.join(dir, 'questions-all.md'), renderFlat(list, `열린 의문 — ${a.key} 앞까지 (읽는 자리 ${p})`));
  const scored = list.map((x) => ({ ...x, ...score(x.q.text, text) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const top = scored.slice(0, 30);
  const ut = unitTargets(a.key);
  const touched = threads.filter((t) => (t.about ?? []).some((id) => ut.has(id) && !UBIQ.has(id)));
  const inThread = new Set(touched.flatMap((t) => t.questions ?? []));
  const viaThread = list.filter((x) => inThread.has(x.q.id) && !top.includes(x));
  const out = [`# 이 단위 맞춤 열린 의문 — ${a.key}${a.part ? ` 파트 ${a.part}` : ''}`, '', `열린 · 일부 풀린 의문 ${list.length}건 가운데 (1) 이 원문과 낱말이 겹치는 것 상위 ${top.length}(겹친 낱말 순), (2) 이 단위에 나오는 대상을 다루는 떡밥 줄기(${touched.map((t) => t.id).join(' · ')})에 든 의문 ${viaThread.length}. 기계가 고른 것이라 겹침이 우연일 수 있고, 여기 없는 의문이 이 단위에서 풀릴 수도 있다 — 전체 목록은 questions-all.md.`, '', '## (1) 낱말이 겹치는 의문'];
  for (const x of top) out.push(`${qLine(x)} — 겹침: ${x.hits.join(' · ')}`);
  out.push('', '## (2) 이 단위의 대상을 다루는 줄기에 든 의문');
  for (const t of touched) { const xs = viaThread.filter((x) => (t.questions ?? []).includes(x.q.id)); if (!xs.length) continue; out.push(`### ${t.id} ${t.title} — ${t.text}`); for (const x of xs) out.push(qLine(x)); }
  fs.writeFileSync(path.join(dir, 'questions-matched.md'), out.join('\n') + '\n');
  const benchRank = a.bench.map((b) => `${b}: 낱말 ${scored.findIndex((x) => x.q.id === b) + 1}/${scored.length}${inThread.has(b) ? ' · 줄기 ○' : ' · 줄기 ✗'}`);
  console.log(`A ${a.key} 자리 ${p} · 열린 ${list.length} (${[...fs.readFileSync(path.join(dir, 'questions-all.md'), 'utf8')].length}자) · 맞춤 ${top.length}+${viaThread.length} (${[...out.join('\n')].length}자) · 원문 ${[...text].length}자 · 기준 사례 ${benchRank.join(', ')}`);
}

// ── C. 줄기별 회수 대조 입력 ──
const openNow = openAsOf(null);
const factText = new Map(facts.map((f) => [f.id, f]));
const qOf = new Map(openNow.map((x) => [x.q.id, x]));
const byPos = (a, b) => pos.get(a.unit) - pos.get(b.unit) || a.id.localeCompare(b.id, undefined, { numeric: true });
let seed = 20261104; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr, n) => { const a = [...arr]; const r = []; while (a.length && r.length < n) r.push(a.splice(Math.floor(rnd() * a.length), 1)[0]); return r; };
const benchT = ['J27', 'J16', 'J1', threadOf.get('Q14')?.id].filter(Boolean);
const others = threads.filter((t) => !benchT.includes(t.id) && (t.questions ?? []).filter((q) => qOf.has(q)).length >= 4);
const pickedT = [...benchT.map((id) => threads.find((t) => t.id === id)), ...pick(others, 3)];
fs.mkdirSync(path.join(OUT, 'C'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'B'), { recursive: true });
const cIndex = [];
for (const t of pickedT) {
  const tAbout = new Set((t.about ?? []).filter((id) => !UBIQ.has(id)));
  const qs = (t.questions ?? []).map((id) => questions.find((q) => q.id === id)).filter(Boolean).sort(byPos);
  const firstPos = Math.min(...qs.map((q) => pos.get(q.unit)));
  const inThread = facts.filter((f) => pos.get(f.unit) > firstPos && (f.obj?.about ?? []).some((id) => tAbout.has(id)));
  const extra = new Map();
  for (const q of qs) { const x = qOf.get(q.id); if (!x) continue; const qp = pos.get(q.unit);
    const sc = facts.filter((f) => pos.get(f.unit) > qp && !inThread.includes(f)).map((f) => ({ f, ...score(q.text, f.text) })).filter((y) => y.s >= 1.5).sort((a, b) => b.s - a.s).slice(0, 8);
    for (const y of sc) extra.set(y.f.id, { f: y.f, hits: y.hits, q: q.id }); }
  const all = [...inThread.map((f) => ({ f, tag: '◆' })), ...[...extra.values()].map((y) => ({ f: y.f, tag: `(${y.q} 낱말: ${y.hits.join(' · ')})` }))].sort((a, b) => byPos(a.f, b.f));
  const out = [`# 줄기 ${t.id} ${t.title} — 회수 대조`, '', `줄기 문장: ${t.text}`, `대상: ${(t.about ?? []).join(' · ')} · 무게 ${t.weight}`, '', `## 이 줄기의 의문 (${qs.length}건 — 열림 · 일부가 판정 대상, 풀림은 참고)`];
  for (const q of qs) { const x = qOf.get(q.id); const st = x ? x.state : '풀림';
    const ans = events.filter((e) => e.parent === q.id && e.act === '회수');
    out.push(`- ${q.id} [${st}] ${q.text} · ${where(q)}${ans.length ? ' · 적힌 회수: ' + ans.map((e) => `${e.obj?.answer}(${e.unit}, ${e.obj?.degree})`).join(', ') : ''}`); }
  out.push('', `## 뒤 사실 — 출시순 (${all.length}건. ◆ = 줄기 대상을 다루는 사실, 괄호 = 어느 의문과 낱말이 겹치는지)`);
  for (const { f, tag } of all) out.push(`- ${f.id} ${tag} ${f.text} · ${f.unit}`);
  const file = path.join(OUT, 'C', `${t.id}.md`); fs.writeFileSync(file, out.join('\n') + '\n');
  const n = [...out.join('\n')].length;
  cIndex.push({ thread: t.id, title: t.title, open: qs.filter((q) => qOf.has(q.id)).map((q) => q.id), facts: all.length, chars: n, file });
  console.log(`C ${t.id} ${t.title} — 의문 ${qs.length}(열린 ${qs.filter((q) => qOf.has(q.id)).length}) · 뒤 사실 ${all.length} · ${n}자`);
}
fs.writeFileSync(path.join(OUT, 'C', 'index.json'), JSON.stringify(cIndex, null, 1));
for (const [q, f] of [['Q10', 'F242'], ['Q144', 'F2058'], ['Q144', 'F2584'], ['Q20', 'F2837'], ['Q63', 'F2837'], ['Q14', 'F336']]) {
  const t = threadOf.get(q); const txt = fs.readFileSync(path.join(OUT, 'C', `${t.id}.md`), 'utf8'); console.log(`  ${q} ${f} ${txt.includes(`- ${f} `) ? '포함' : '빠짐'} (${t.id})`); }

// ── B. 아크 인계 (앞 단위 요약) ──
const chapters = ['ch00', 'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06', 'ch07', 'ch08', 'ch09', 'ch10', 'ch11', 'ch12', 'ch13'];
const summ = (k) => JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/read1', `${k}.json`), 'utf8'));
for (let i = 8; i <= 13; i++) {
  const upto = chapters.slice(0, i);
  const lines = ['# 앞 단위 줄거리 (앞 세션의 단위 요약 — 원문 대신 읽는다)', ''];
  for (const k of upto) { const r = summ(k); lines.push(`## ${k} · ${ctx.resolve(k)?.title ?? ''}`, r.summary, ''); }
  fs.writeFileSync(path.join(OUT, 'B', `before-ch${String(i).padStart(2, '0')}.md`), lines.join('\n'));
}
console.log('B 인계 파일 before-ch08…13 — 글자 수', [8, 9, 10, 11, 12, 13].map((i) => [...fs.readFileSync(path.join(OUT, 'B', `before-ch${String(i).padStart(2, '0')}.md`), 'utf8')].length).join(' · '));
