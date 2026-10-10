/**
 * 시점별 판 입력 묶음 — 쓰는 사람이 볼 것: 분석용 이름(결말을 아는 자리 — 옮기지 않는다) · 처음 나온 스토리 · 떡밥이 움직인 자리를 읽는 순서로
 * (단계 · 기록 문장 — 의문의 답은 답 사실 문장까지) · 글에 쓸 이름이 처음 쓰이는 자리 · 지금 판. 원문 대사는 넣지 않는다.
 * 데이터는 사이트로 내보낸 것(site/data)만 읽는다 — loadContext.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE_DATA, dictFirst, dictRecords, flowPoints, isDict, loadSources, srcHash, stateOf, threadId } from './model.mjs';

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
  L.push(`처음 나온 스토리(첫 판 at): ${unitLine(th.first_unit, C)} · 마지막으로 움직인 스토리: ${unitLine(th.last_unit, C)}`);
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
  L.push('## 지금 판');
  const vs = Array.isArray(file?.versions) ? file.versions : [];
  if (!vs.length) L.push('  (없음)');
  for (const v of vs) L.push(`  ${v.at} [${stateOf(v, srcHash(subject, v.at, C)).status}] ${v.title} — ${v.text}`);
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
export function buildDictInput(subject, file, C, { full = false } = {}) {
  const t = C.targetMap.get(subject);
  if (!t) throw new Error(`사전 항목이 없다 — ${subject}`);
  const w = C.world?.get(subject);
  const L = [];
  L.push(`# ${subject} 사전 설명 시점별 판 입력 — ${t.name}${t.kind ? ` (${t.kind})` : ''}`);
  L.push(`분석용 설명(전부 아는 자리에서 쓴 것 — 판 글에 그대로 옮기지 않는다): ${w?.note ?? t.note ?? '(없음)'}`);
  const first = dictFirst(t);
  L.push(`처음 나온 자리(첫 판 at): ${first ? unitLine(first, C) : '없음 — 판을 둘 수 없다'}${arr(t.meet).length > 1 ? ` · 그 앞 체크 칸 스토리: ${t.meet.slice(0, -1).map((k) => unitLine(k, C)).join(' · ')}` : ''}`);
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
  L.push('## 지금 판');
  const vs = Array.isArray(file?.versions) ? file.versions : [];
  if (!vs.length) L.push('  (없음)');
  for (const v of vs) L.push(`  ${v.at} [${stateOf(v, srcHash(subject, v.at, C)).status}] ${v.text}`);
  return L.join('\n');
}
const arr = (x) => (Array.isArray(x) ? x : []);
