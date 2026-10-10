/**
 * 팬용 문장 입력 묶음 — 쓰는 사람이 볼 것: 그 단위의 자리 · 화면에 이미 있는 한 줄 소개 · 판정(분석용 원문) ·
 * 판정 속 ID와 단위를 문장 · 제목으로 푼 것(그 스토리 앞인지 뒤인지 — 뒤는 자리만 쓴다). 원문 대사는 넣지 않는다.
 * 데이터는 사이트로 내보낸 것(site/data)만 읽는다 — loadContext.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PARTS, SITE_DATA, loadSources, srcHash } from './model.mjs';

/** 입력에 쓸 사이트 데이터 — 원본(loadSources) + 기록 · 줄기 · 개요 · 자리 */
export function loadContext(dir = SITE_DATA) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const src = loadSources(dir);
  const records = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
  const threads = new Map((read('threads.json').threads ?? []).map((t) => [t.id, t]));
  const logline = new Map(read('synopsis.json').map((s) => [s.key, s.logline]));
  const ticks = new Map(read('ticks.json').map((t) => [t.tick, t]));
  const judgment = new Map([...src.why.values()].filter((u) => u.judgment).map((u) => [u.judgment, u.key]));
  const points = new Map((src.chrono.points ?? []).map((p) => [p.id, p]));
  // 제목으로 불리는 단위(척추 이벤트 · 사이드 — 'OVER ZONE') — 판정 글이 키 대신 제목을 쓴다
  const titled = [...src.units.values()].filter((u) => u.kind !== 'main' && /^[A-Z][A-Z0-9 .,'!&:-]{4,}$/.test(u.title ?? ''));
  return { ...src, records, threads, logline, ticks, judgment, points, titled };
}

const chLabel = (k) => (/^ch\d+$/.test(k ?? '') ? `CH.${k.slice(2)}` : k);

/** 공개 자리 이름 — 'CH.06' (메인과 같은 자리) · 'CH.06 이후' */
export function tickName(tick, C) {
  const t = C.ticks.get(Number(tick));
  if (!t) return '?';
  return t.main ? chLabel(t.main) : t.upto ? `${chLabel(t.upto)} 이후` : '?';
}

/** 다른 단위가 이 단위의 앞인가 뒤인가(읽는 순서) */
function rel(key, other, C) {
  if (!other) return '';
  if (other === key) return '이 스토리';
  const a = C.units.get(key)?.order;
  const b = C.units.get(other)?.order;
  if (a == null || b == null) return '?';
  return b < a ? '앞' : '뒤 — 자리만';
}
const unitName = (k, C) => {
  const u = C.units.get(k);
  return u ? `${u.title}` : k;
};

/** 기록 문장 — 인물 변화(D)는 text 대신 앞 → 뒤 상태로 적힌 것이 있다 */
const recordText = (r) => r.text ?? (r.before || r.after ? `${r.person ? `${r.person.replace(/^person:/, '').replace(/_/g, ' ')} ` : ''}${r.aspect ?? ''} ${r.act ?? ''}: ${r.before ?? '?'} → ${r.after ?? '?'}` : '?');

/** 글 속 ID · 단위 키 · 제목을 풀어 줄로 */
function expand(key, texts, C) {
  const seen = new Set();
  const out = [];
  const body = texts.filter(Boolean).join(' \n ');
  for (const m of body.matchAll(/(?<![A-Za-z0-9])([FQSDEUIOHKJT]\d+)(?![A-Za-z0-9])/g)) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    if (id.startsWith('K')) {
      const u = C.judgment.get(id);
      out.push(`  ${id} 판정 → ${u ? `${unitName(u, C)} [${rel(key, u, C)}]` : '?'}`);
    } else if (id.startsWith('J')) {
      const t = C.threads.get(id);
      out.push(`  ${id} 떡밥 「${t?.title ?? '?'}」`);
    } else {
      const r = C.records.get(id);
      out.push(r ? `  ${id} [${unitName(r.unit, C)} · ${rel(key, r.unit, C)}] ${recordText(r)}` : `  ${id} (사이트 기록에 없음)`);
    }
  }
  const keys = new Set();
  for (const m of body.matchAll(/\b(ch\d{2}|char:\d+|(?:sub|relic|erelic|side|fl):[^\s,.·)('"]+|event_[A-Za-z0-9_]+)/g)) keys.add(m[1]);
  for (const u of C.titled) if (body.includes(u.title)) keys.add(u.key);
  for (const k of keys) if (k !== key && C.units.has(k)) out.push(`  ${k} = ${unitName(k, C)} (공개 ${tickName(C.units.get(k).tick, C)}) [${rel(key, k, C)}]`);
  for (const m of body.matchAll(/@[\p{L}\p{N}_]+/gu)) {
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    const p = C.points.get(m[0]);
    out.push(`  ${m[0]} = ${p ? `${p.name}${p.years ? ` (약 ${p.years}년 전)` : ''}` : '?'}`);
  }
  return out;
}

/**
 * @param {string} key 단위 키
 * @param {'why'|'when'} part
 * @param {ReturnType<typeof loadContext>} C
 * @returns {string}
 */
export function buildInput(key, part, C) {
  const u = C.units.get(key);
  const lines = [];
  const head = `═ ${PARTS[part]} — ${key} 「${u?.title ?? '?'}」 · 읽는 순서 ${u?.order ?? '?'} · 공개 ${u ? tickName(u.tick, C) : '?'}`;
  lines.push(head);
  const ll = C.logline.get(key);
  lines.push(`한 줄 소개(화면에 이미 있다 — 되풀이하지 않는다): ${ll ?? '(없음)'}`);
  if (part === 'why') {
    const j = C.why.get(key);
    if (!j) return `${head}\n(분류 단위가 아니다)`;
    const GL = { 필수: '준필수', 보강: '추천', 참고: '참고', 독립: '독립' };
    lines.push(`등급: ${GL[j.grade] ?? j.grade}${j.confidence === '추정' ? ' (추정)' : ''}${j.path ? ` · 자리에 따라 ${j.path}` : ''}${j.before ? ` — 그 앞 자리는 ${GL[j.before] ?? j.before}` : ''}`);
    if (j.from) lines.push(`딛는 필수 스토리: ${unitName(j.from, C)} (공개 ${tickName(j.from_tick ?? C.units.get(j.from)?.tick, C)}) [${rel(key, j.from, C)}]`);
    lines.push('판정 이유(분석용 — 옮기지 말고 팬 말로):', `  ${j.reason}`);
    if (j.basis) lines.push(`결정 장면 기록: ${j.basis}`);
    if (j.lead_facts) lines.push(`주역 사연: ${j.lead_facts}`);
    if (j.threads?.length) lines.push(`걸린 떡밥: ${j.threads.map((t) => `${t} 「${C.threads.get(t)?.title ?? '?'}」`).join(' · ')}`);
    const ex = expand(key, [j.reason, j.basis], C);
    if (ex.length) lines.push('판정 속 ID · 단위:', ...ex);
    lines.push(`src: ${srcHash('why', j)}`);
  } else {
    const ns = C.when.get(key);
    if (!ns) return `${head}\n(연대기 카드에 추정한 이유가 뜨지 않는 단위다)`;
    for (const n of ns) {
      const at = (n.at ?? []).map(([r, ref, gap]) => `${ref.startsWith('@') ? C.points.get(ref)?.name ?? ref : unitName(ref, C)} ${r}${gap ? ` (${gap})` : ''}`).join(' · ');
      lines.push(`화면 자리(굵게 뜬다): ${at}`, '추정 이유(분석용 — 옮기지 말고 팬 말로):', `  ${n.reason}`);
      if (n.basis?.length) lines.push(`근거: ${n.basis.join(' · ')}`);
      const refs = (n.at ?? []).map(([, ref]) => ref);
      const ex = expand(key, [n.reason, (n.basis ?? []).join(' '), refs.join(' ')], C);
      if (ex.length) lines.push('이유 속 ID · 단위:', ...ex);
    }
    lines.push(`src: ${srcHash('when', ns)}`);
  }
  return lines.join('\n');
}
