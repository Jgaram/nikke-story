/**
 * 시점별 판 입력 묶음 — 쓰는 사람이 볼 것: 분석용 이름(결말을 아는 자리 — 옮기지 않는다) · 처음 나온 스토리 · 떡밥이 움직인 자리를 읽는 순서로
 * (단계 · 기록 문장 — 의문의 답은 답 사실 문장까지) · 글에 쓸 이름이 처음 쓰이는 자리 · 지금 판. 원문 대사는 넣지 않는다.
 * 데이터는 사이트로 내보낸 것(site/data)만 읽는다 — loadContext.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE_DATA, curSrc, dictFirst, dictRecords, flowPoints, isDict, loadSources, refKnown, refPool, stateOf, threadFirst, threadId } from './model.mjs';

/** 입력에 쓸 사이트 데이터 — 원본(loadSources) + 기록 */
export function loadContext(dir = SITE_DATA) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const C = loadSources(dir);
  C.records = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
  C.world = new Map((fs.existsSync(path.join(dir, 'world.json')) ? read('world.json').entries ?? [] : []).map((e) => [e.id, e]));
  return C;
}

/** 판을 나눌 만한 단계 — 떡밥의 물음이 새로 서거나 답이 드러나는 자리. 암시 · 재언급 · 보강은 판을 세우지 않는다 */
export const BREAK_STAGES = new Set(['제기', '처음 밝혀짐', '일부 회수', '회수', '뒤집힘']);

const unitLine = (k, C) => {
  const u = C.units.get(k);
  return u ? `[${u.order}] ${k} ${u.title}` : k;
};
const clip = (s, n = 160) => { const a = [...String(s ?? '')]; return a.length > n ? `${a.slice(0, n).join('')}…` : a.join(''); };

/** 글에 든 대상 이름 — 이름이 처음 쓰이는 자리(nameIndex)와 함께, 읽는 순서로 */
function namesIn(texts, C) {
  const body = texts.join('\n');
  const hits = [];
  for (const [name, f] of C.names) if (body.includes(name)) hits.push([name, f]);
  // 더 긴 이름에 든 짧은 이름은 뺀다(모더니아 속 모더 같은 것)
  return hits.filter(([n]) => !hits.some(([m]) => m !== n && m.includes(n))).sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]));
}

/**
 * @param {string} subject 'thread:J30'
 * @param {object | null} file 지금 판 파일(없으면 null)
 */
export function buildInput(subject, file, C, o = {}) {
  if (isDict(subject)) return buildDictInput(subject, file, C, o);
  const id = threadId(subject);
  const th = C.threads.get(id);
  if (!th) throw new Error(`떡밥이 없다 — ${subject}`);
  const pts = flowPoints(C.flow[id]);
  const L = [];
  L.push(`# ${id} 시점별 판 입력 — 중요도 ${th.weight}`);
  L.push(`분석용 이름(결말을 아는 자리에서 쓴 것 — 판 글에 그대로 옮기지 않는다): ${th.title}`);
  L.push(`분석용 요약: ${th.text}`);
  const first = threadFirst(th, C);
  L.push(`처음 나온 스토리(첫 판 at): ${unitLine(first, C)}${first !== th.first_unit ? ` — 그 앞 이벤트 · 호감도 ${unitLine(th.first_unit, C)}에서 먼저 나옴(곁 판으로)` : ''} · 마지막으로 움직인 스토리: ${unitLine(th.last_unit, C)}`);
  L.push('');
  L.push('## 흐름 — 읽는 순서. ★ = 판을 나눌 만한 자리(제기 · 처음 밝혀짐 · 회수 · 뒤집힘)');
  const byUnit = new Map();
  for (const p of pts) (byUnit.get(p.u) ?? byUnit.set(p.u, []).get(p.u)).push(p);
  const texts = [];
  for (const [u, list] of byUnit) {
    const star = list.some((p) => BREAK_STAGES.has(p.s)) ? '★ ' : '';
    L.push(`${star}${unitLine(u, C)}`);
    for (const p of list) {
      const r = C.records.get(p.r);
      const ans = p.a ? C.records.get(p.a) : null;
      const t = r?.text ?? (r?.answer ? C.records.get(r.answer)?.text : null) ?? '';
      texts.push(t, ans?.text ?? '');
      L.push(`  ${p.s} ${p.r}${p.root && p.root !== p.r ? ` (${p.root})` : ''}: ${clip(t)}${ans && ans.text !== t ? ` → 답 ${p.a}: ${clip(ans.text)}` : ans ? ` (답 ${p.a})` : ''}`);
    }
  }
  L.push('');
  L.push('## 이름이 처음 쓰이는 자리 — 판의 at이 이 자리보다 앞이면 그 이름은 쓰지 않는다(검사가 잡는다)');
  for (const [name, f] of namesIn([th.title, th.text, ...texts], C)) L.push(`  ${name} — ${f.unit ? unitLine(f.unit, C) : '쓰인 곳 없음'}`);
  L.push('');
  L.push(...refSection(subject, file, C, o.at));
  L.push('## 지금 판');
  const vs = Array.isArray(file?.versions) ? file.versions : [];
  if (!vs.length) L.push('  (없음)');
  for (const v of vs) L.push(`  ${v.at} [${stateOf(v, curSrc(subject, v, C)).status}] ${v.title} — ${v.text}${refLine(v)}`);
  return L.join('\n');
}

/** 기록 종류 이름 — 입력 묶음에 */
const KIND_NAME = { F: '사실', Q: '의문', U: '생활상', E: '사건', I: '암시', D: '인물 변화', T: '진실 공개', S: '작중 시점' };
/** 기록이 많은 항목(방주 · 갓데스 …)은 앞에서 이만큼만 문장째 — 뒤는 스토리마다 건수만(--full이면 전부) */
const DICT_RECORD_CAP = 60;

/**
 * 사전 설명 입력 묶음(W15e) — 분석용 설명(옮기지 않는다) · 처음 나온 자리 · 이름이 처음 쓰인 자리 · 무엇인지 보여 주는 줄 ·
 * 항목을 다룬 기록을 읽는 순서로(종류 · 문장) · 글에 든 이름이 처음 쓰이는 자리 · 지금 판.
 * @param {{ full?: boolean }} o full = 기록을 전부 문장째
 */
export function buildDictInput(subject, file, C, { full = false, at } = {}) {
  const t = C.targetMap.get(subject);
  if (!t) throw new Error(`사전 항목이 없다 — ${subject}`);
  const w = C.world?.get(subject);
  const L = [];
  L.push(`# ${subject} 사전 설명 시점별 판 입력 — ${t.name}${t.kind ? ` (${t.kind})` : ''}`);
  L.push(`분석용 설명(전부 아는 자리에서 쓴 것 — 판 글에 그대로 옮기지 않는다): ${w?.note ?? t.note ?? '(없음)'}`);
  const first = dictFirst(t, C);
  const before = arr(t.meet).slice(0, Math.max(0, arr(t.meet).indexOf(first)));
  L.push(`처음 나온 자리(첫 판 at): ${first ? unitLine(first, C) : '없음 — 판을 둘 수 없다'}${before.length ? ` · 그 앞 고를 수 있는 스토리(곁 판 자리): ${before.map((k) => unitLine(k, C)).join(' · ')}` : ''}`);
  if (t.name_meet) L.push(`표준명이 처음 쓰인 자리: ${t.name_meet.map((k) => unitLine(k, C)).join(' · ')} — 그 앞은 먼저 나온 다른 이름으로 부른다`);
  for (const a of arr(t.aliases)) L.push(`다른 이름: ${a.name}${a.how ? ` (${a.how})` : ''} — ${a.never ? '쓰인 곳 없음' : a.meet ? a.meet.map((k) => unitLine(k, C)).join(' · ') : '표준명과 같이'}`);
  const ev = arr(w?.evidence);
  if (ev.length) L.push(`무엇인지 보여 주는 줄(사전 근거 — 원문은 read.mjs로): ${ev.map((e) => `${e.scene}#${arr(e.lines).join(',')}`).join(' · ')}`);
  L.push('');
  const recs = dictRecords(subject, C);
  L.push(`## 다룬 기록 ${recs.length} — 읽는 순서. 판의 글은 at까지의 기록으로 쓴다`);
  const texts = [];
  const byUnit = new Map();
  for (const p of recs) (byUnit.get(p.u) ?? byUnit.set(p.u, []).get(p.u)).push(p);
  let shown = 0;
  for (const [u, list] of byUnit) {
    if (!full && shown >= DICT_RECORD_CAP) {
      const n = {};
      for (const p of list) n[p.rec.kind] = (n[p.rec.kind] ?? 0) + 1;
      L.push(`${unitLine(u, C)} — ${Object.entries(n).map(([k, c]) => `${KIND_NAME[k] ?? k} ${c}`).join(' · ')}`);
      continue;
    }
    L.push(unitLine(u, C));
    for (const p of list) {
      const r = p.rec;
      texts.push(r.text ?? '');
      L.push(`  ${KIND_NAME[r.kind] ?? r.kind} ${r.id}${r.scene ? ` (${r.scene}#${r.line ?? ''})` : ''}: ${clip(r.text, 180)}`);
      shown++;
    }
  }
  if (!full && shown < recs.length) L.push(`  … 앞 ${shown}건만 문장째 — 전부는 --full`);
  L.push('');
  L.push('## 이름이 처음 쓰이는 자리 — 판의 at이 이 자리보다 앞이면 그 이름은 쓰지 않는다(검사가 잡는다)');
  for (const [name, f] of namesIn([w?.note ?? t.note ?? '', ...texts], C)) L.push(`  ${name} — ${f.unit ? unitLine(f.unit, C) : '쓰인 곳 없음'}`);
  L.push('');
  L.push(...refSection(subject, file, C, at));
  L.push('## 지금 판');
  const vs = Array.isArray(file?.versions) ? file.versions : [];
  if (!vs.length) L.push('  (없음)');
  for (const v of vs) L.push(`  ${v.at} [${stateOf(v, curSrc(subject, v, C)).status}] ${v.text}${refLine(v)}`);
  return L.join('\n');
}
const arr = (x) => (Array.isArray(x) ? x : []);
const refLine = (v) => (Array.isArray(v.refs) ? `\n      근거 ${v.refs.join(' ') || '(없음)'}` : '\n      근거 —(refs 없음)');

/**
 * 근거 후보(W17) — 판마다 그 자리 독자가 아는 이 대상의 기록(F · Q · E)을, 앞 판 뒤에 새로 알게 된 것만. 판 글이 기대는 것을 골라 refs로(`versions.mjs refs`).
 * 그 자리 독자가 모르는 것(이벤트 · 호감도에서만 — 곁 판이면 든다 · 체크 칸에서만)은 따로 적는다. 뒤 자리 기록은 싣지 않는다.
 */
function refSection(subject, file, C, extraAt) {
  const vs = arr(file?.versions).filter((v) => v && v.status !== '기각');
  const list = [...vs.map((v) => ({ at: v.at, side: !!v.side }))];
  if (extraAt && !list.some((x) => x.at === extraAt)) list.push({ at: extraAt, side: false, extra: true });
  list.sort((a, b) => (C.units.get(a.at)?.order ?? 1e9) - (C.units.get(b.at)?.order ?? 1e9));
  const pool = refPool(subject, C);
  const L = ['## 근거 후보 — 판마다 그 자리 독자가 아는 이 대상의 기록(앞 판 뒤 새로). 글이 기대는 것을 refs로: node tools/versions.mjs refs <대상> <at> <ID …>'];
  const done = new Set();
  const mains = [];
  for (const x of list) {
    const chain = [...mains, x.at];
    const me = C.units.get(x.at)?.order ?? -Infinity;
    const ok = [];
    const side = [];
    const check = [];
    for (const p of pool) {
      if (p.o > me && !(p.rec.know_units ?? []).some((k) => (C.units.get(k)?.order ?? Infinity) <= me)) continue;
      const k = refKnown(p.rec, chain, x.at, C);
      if (k.known) { if (!done.has(p.id)) ok.push(p); }
      else if (k.skip.length) side.push(p);
      else if (k.check.length) check.push(p);
    }
    L.push(`판 ${x.at}${x.side ? '(곁 판)' : ''}${x.extra ? '(새 --at)' : ''} ${C.units.get(x.at)?.title ?? ''} — 새로 아는 근거 ${ok.length}`);
    for (const p of ok) L.push(`  ${p.id} [${p.rec.unit}] ${clip(p.rec.text ?? '', 90)}`);
    if (side.length) L.push(`  이벤트 · 호감도에서만 아는 것(곁 판에만): ${side.map((p) => `${p.id}[${p.rec.unit}]`).join(' ')}`);
    if (check.length) L.push(`  체크 칸에서만 아는 것(그 칸 판 · 곁 판에만): ${check.map((p) => `${p.id}[${p.rec.unit}]`).join(' ')}`);
    if (!x.side) { mains.push(x.at); for (const p of ok) done.add(p.id); }
  }
  L.push('');
  return L;
}
