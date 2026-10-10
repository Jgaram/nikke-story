/**
 * 시점별 판 입력 묶음 — 쓰는 사람이 볼 것: 분석용 이름(결말을 아는 자리 — 옮기지 않는다) · 처음 나온 스토리 · 떡밥이 움직인 자리를 읽는 순서로
 * (단계 · 기록 문장 — 의문의 답은 답 사실 문장까지) · 글에 쓸 이름이 처음 쓰이는 자리 · 지금 판. 원문 대사는 넣지 않는다.
 * 데이터는 사이트로 내보낸 것(site/data)만 읽는다 — loadContext.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SITE_DATA, flowPoints, loadSources, srcHash, stateOf, threadId } from './model.mjs';

/** 입력에 쓸 사이트 데이터 — 원본(loadSources) + 기록 */
export function loadContext(dir = SITE_DATA) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const C = loadSources(dir);
  C.records = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
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
export function buildInput(subject, file, C) {
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
