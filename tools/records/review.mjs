/**
 * 리뷰 도구 — 후보를 근거 줄(앞뒤 문맥)과 함께 보여 주고, 채팅으로 받은 확정 · 기각 · 보류를 파일에 반영하고, 진행률을 낸다.
 * 확정 · 기각은 사용자가 한다(CLAUDE.md "해석이 필요한 기록은 후보로만"). 이 도구는 사용자의 결정을 받아 적을 뿐이다.
 */
import fs from 'node:fs';
import { jumpTargets, renderLine } from '../lib/render.mjs';
import { KIND_LABEL } from '../lib/units.mjs';
import { replaceValues } from './edit.mjs';
import { computeLayers } from './layers.mjs';
import {
  CLOSURE_TYPES, CONFIDENCES, DECISIONS, FIELDS, GRADES, ID, KINDS, KIND_BY_LABEL, LAYERS, SINGLE_PREFIX, STATUSES, citeAll, citeOf, compareIds, expandLines, isDeferred, isRecord, today,
} from './model.mjs';
import { findItem, kindTally } from './order.mjs';
import { parseCite } from './read2.mjs';

const SECTION_ORDER = {
  facts: 0, questions: 1, events: 2, times: 3, mentions: 4, echoes: 5, changes: 6, life: 7, candidates: 8, threads: 9, relations: 10, units: 11, leads: 12, spine: 13, majors: 14, edges: 15, closures: 16, merges: 17, affiliations: 18,
};

/** 순서 안의 자리 — 읽기 순서, 없으면 뒤로. 파트가 안 맞으면(2회독은 파트를 다르게 묶기도 한다) 그 단위의 첫 자리 */
export function orderIndex(order, unit, parts) {
  if (!unit) return Number.MAX_SAFE_INTEGER;
  return (findItem(order, unit, parts) ?? order.items.find((it) => it.key === unit))?.index ?? Number.MAX_SAFE_INTEGER - 1;
}
/** 단위에 딸리지 않은 후보 — 정체 연결 · 줄기 · 줄기 관계 · 층 판정 · 주역 · 주요 인물 · 수동 엣지 */
const isSide = (c) => Boolean(c.people || c.threads || c.layers || c.leads || c.spine || c.majors || c.closures || c.links || c.affil);

/** 후보를 읽는 순서로 — 단위(순서) → 1회독 기록(사실 · 의문 · 사건 · 시점) → 2회독 기록 → 파일 안 순서. 정체 연결 · 줄기 · 줄기 관계 · 층 판정 · 수동 엣지는 맨 뒤 ID 순 */
export function sortCandidates(list, order, { byKind = false } = {}) {
  const kindRank = { fact: 0, question: 1, time: 2, mention: 3, echo: 4, change: 5, life: 6, link: 7, thread: 8, relation: 9, layer: 10, lead: 11, spine: 12, major: 13, edge: 14, closure: 15, merge: 16, affil: 17 };
  return [...list].sort((a, b) =>
    (byKind ? kindRank[a.kind] - kindRank[b.kind] : 0) ||
    orderIndex(order, a.unit, a.parts) - orderIndex(order, b.unit, b.parts) ||
    (Boolean(a.read2) - Boolean(b.read2)) ||
    (a.file ?? '').localeCompare(b.file ?? '') ||
    (isSide(a) ? SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || compareIds(a.id, b.id) : 0) ||
    SECTION_ORDER[a.section] - SECTION_ORDER[b.section] ||
    a.index - b.index);
}

/** 상태 표시 — 보류는 `후보(보류)` */
export const statusLabel = (c) => (isDeferred(c) ? '후보(보류)' : c.status ?? '?');

/**
 * 고르기. 토큰: 후보 ID(F12 · Q3-2 · S1 · L2 · J3 · G1) · 범위(F3..F9 · J1..J20) · 단위 키(ch00 · sub:…_00) · 세션(R01 · B0b)
 * · 종류(사실 · 의문 · 시점 · 정체 · 줄기 · 줄기 관계)
 * @returns {{ picked: object[], explicit: boolean, unknown: string[] }} explicit: ID나 범위로 콕 집었는지(상태 거르기를 안 한다)
 */
export function select(ds, tokens) {
  const all = ds.candidates.filter((c) => c.id);
  const byId = new Map(all.map((c) => [c.id, c]));
  const units = new Set([...ds.files, ...(ds.files2 ?? [])].map((f) => f.data?.unit).filter(Boolean));
  const sessions = new Set([...all.map((c) => c.session), ...[...ds.files, ...(ds.files2 ?? [])].map((f) => f.data?.session)].filter(Boolean));
  const picked = new Set();
  const unknown = [];
  let explicit = false;
  let filtered = false;
  const kinds = [];
  for (const t of tokens) {
    const range = t.match(/^([FQSLJGKZBCOHIEDUY])(\d+)\.\.\1?(\d+)$/);
    if (byId.has(t)) {
      picked.add(byId.get(t));
      explicit = true;
    } else if (range) {
      const [, p, a, b] = range;
      const lo = Math.min(Number(a), Number(b));
      const hi = Math.max(Number(a), Number(b));
      const single = SINGLE_PREFIX[p] ? ID[SINGLE_PREFIX[p]] : null;
      for (const c of all) {
        const m = c.id.match(single ?? ID.def);
        const n = Number(single ? m?.[1] : m?.[2]);
        if (m && (single || m[1] === p) && n >= lo && n <= hi) picked.add(c);
      }
      explicit = true;
    } else if (units.has(t)) {
      for (const c of all) if (c.unit === t) picked.add(c);
      filtered = true;
    } else if (sessions.has(t)) {
      for (const c of all) if (c.session === t) picked.add(c);
      filtered = true;
    } else if (KIND_BY_LABEL[t] || KINDS[t]) {
      kinds.push(KIND_BY_LABEL[t] ?? t);
    } else unknown.push(t);
  }
  let list = explicit || filtered ? [...picked] : all;
  if (kinds.length) list = list.filter((c) => kinds.includes(c.kind));
  return { picked: list, explicit: explicit && !filtered, unknown };
}

/** 상태로 거르기 — 후보(기본, 보류 포함) · 보류 · 확정 · 기각 · 전부 */
export function filterStatus(list, status) {
  if (!status || status === '전부' || status === 'all') return list;
  if (status === '보류') return list.filter(isDeferred);
  if (!STATUSES.includes(status)) throw new Error(`--status는 ${[...STATUSES, '보류', '전부'].join(' · ')}`);
  return list.filter((c) => c.status === status);
}

// ── 한 후보 보여 주기 ────────────────────────────────────────────────

const unitLabel = (ctx, key) => {
  if (!key) return '';
  const r = ctx.resolve(key);
  if (!r) return key;
  const kind = r.unit ? KIND_LABEL[r.unit.source] ?? '' : '';
  return `${key} ${r.type === 'scene' ? r.title : r.unit?.title ?? ''}${kind ? ` — ${kind}` : ''}`.trim();
};

/** 근거 줄과 앞뒤 문맥. 긴 범위(9줄 넘게 이어진 근거)는 처음 3줄 · 끝 3줄만 보이고 가운데를 줄인다 */
export function evidenceLines(ctx, ev, context = 2) {
  const out = [];
  const st = ctx.story(ev?.scene);
  if (!st) return [`  (없는 씬 ${ev?.scene})`];
  const ls = ctx.lines(ev.scene);
  const { seqs } = expandLines(ev.lines);
  const valid = seqs.filter((n) => n < ls.length);
  const unit = ctx.unitOfScene(ev.scene);
  out.push(`근거 ${citeOf(ev)} · ${st.title ? `${st.title} · ` : ''}${unit ? `${unit.key}` : ''}${st.source?.startsWith('fl-') ? ' (금서고)' : ''}`);
  if (!valid.length) return [...out, '  (그런 줄이 없다)'];
  const mark = new Set(valid);
  const hidden = new Set();
  // 이어진 덩어리마다 길면 가운데를 숨긴다
  let run = [valid[0]];
  const runs = [];
  for (const n of valid.slice(1)) {
    if (n === run.at(-1) + 1) run.push(n);
    else {
      runs.push(run);
      run = [n];
    }
  }
  runs.push(run);
  for (const r of runs) if (r.length > 8) for (const n of r.slice(3, -3)) hidden.add(n);
  const show = new Set();
  for (const n of valid) {
    if (hidden.has(n)) continue;
    for (let k = Math.max(0, n - context); k <= Math.min(ls.length - 1, n + context); k++) if (!hidden.has(k)) show.add(k);
  }
  // 한 줄만 비는 틈은 `⋯` 대신 그 줄을 보인다
  for (const n of [...show]) if (!show.has(n + 1) && show.has(n + 2) && !hidden.has(n + 1)) show.add(n + 1);
  const targets = jumpTargets(ls);
  let prev = null;
  for (const n of [...show].sort((a, b) => a - b)) {
    if (prev !== null && n > prev + 1) {
      const gap = [];
      for (let k = prev + 1; k < n; k++) gap.push(k);
      const cut = gap.filter((k) => hidden.has(k));
      out.push(cut.length ? `      ⋯ 근거 #${cut[0]}–#${cut.at(-1)} ${cut.length}줄 줄임` : '      ⋯');
    }
    const text = renderLine(ls[n], targets, { num: true }) ?? `#${n} ⋯`;
    out.push(`${mark.has(n) ? '  ▶ ' : '    '}${text}`);
    prev = n;
  }
  return out;
}

const refText = (byId, id) => {
  const c = byId.get(id);
  if (!c) return `${id} (없음)`;
  return `${id} ${c.text ?? ''}${c.status !== '후보' ? ` [${c.status}]` : ''}`;
};

/**
 * @param {object} c 후보
 * @param {Map<string, object>} byId
 */
export function renderCandidate(c, ctx, byId, { context = 2, brief = false, layers = null } = {}) {
  const kind = KINDS[c.kind]?.label ?? c.kind;
  const act = c.role === 'event' ? ` ${c.act ?? '?'}${c.obj?.degree ? `(${c.obj.degree})` : ''}` : c.kind === 'time' ? ` ${c.act ?? ''}` : ['link', 'thread', 'relation', 'layer', 'lead', 'mention', 'echo', 'change', 'life', 'edge', 'closure', 'affil'].includes(c.kind) ? `(${c.act ?? ''})` : '';
  const where = isSide(c) ? c.file : `${c.unit ?? '?'}${c.parts ? ` 파트 ${c.parts}` : ''}${c.read2 ? ' 2회독' : ''}`;
  if (c.threads) return renderThreadItem(c, byId, { kind, act, where, brief });
  if (c.layers) return renderLayerItem(c, byId, { kind, act, where, brief, info: layers?.byUnit.get(c.layerUnit) ?? null });
  if (c.leads) return renderLeadItem(c, byId, { kind, act, where, brief });
  if (c.spine) return renderSpineItem(c, { kind, act, where, brief });
  if (c.majors) return renderMajorItem(c, { kind, where, brief });
  if (c.kind === 'merge') return renderMergeItem(c, byId, { kind, where, brief });
  if (c.closures) return renderClosureItem(c, byId, { kind, act, where, brief });
  if (c.read2 || c.links || c.affil) return renderRead2Item(c, ctx, byId, { kind, where, brief, context });
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  if (brief) {
    const target = c.obj?.answer ? ` → ${c.obj.answer}` : c.obj?.replacedBy ? ` → ${c.obj.replacedBy}` : '';
    const body = c.role === 'event' ? `${c.parent}${target} (${c.text ?? byId.get(c.parent)?.text ?? ''})` : c.text ?? '';
    return `${c.id} [${meta}] ${kind}${act} ${body} — ${citeAll(c.evidence) || where}`.replace(/\s+/g, ' ').trim();
  }
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where}${c.session ? ` (${c.session} · ${c.by ?? '?'})` : ` (${c.by ?? '?'})`}`];
  if (c.role === 'event') {
    out.push(`${c.kind === 'fact' ? '사실' : '의문'} ${refText(byId, c.parent)}`);
    if (c.text) out.push(`이번 기록: ${c.text}`);
    if (c.obj?.answer) out.push(`답이 된 사실: ${refText(byId, c.obj.answer)}`);
    if (c.obj?.replacedBy) out.push(`뒤집은 새 사실: ${refText(byId, c.obj.replacedBy)}`);
  } else {
    out.push(c.text ?? '(문장 없음)');
    if (c.kind === 'time' && c.obj?.ref) out.push(`기준: ${[].concat(c.obj.ref).join(' · ')}`);
  }
  if (c.obj?.about?.length) out.push(`대상: ${c.obj.about.join(' · ')}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  const evidence = Array.isArray(c.evidence) ? c.evidence : [];
  if (!evidence.length) out.push('근거: (아직 없음)');
  for (const ev of evidence) out.push(...evidenceLines(ctx, ev, context));
  for (const r of c.reviews ?? []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

/** 줄기 · 줄기 관계 — 근거가 씬 줄이 아니라 기록 ID다 */
function renderThreadItem(c, byId, { kind, act, where, brief }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const ids = (xs) => (Array.isArray(xs) ? xs : []);
  if (brief) {
    const tail = c.kind === 'thread' ? `의문 ${ids(o.questions).length}${ids(o.facts).length ? ` · 사실 ${ids(o.facts).length}` : ''}` : `근거 ${ids(o.evidence).join(' ')}`;
    return `${c.id} [${meta}] ${kind}${act} ${c.text ?? ''} — ${tail}`.replace(/\s+/g, ' ').trim();
  }
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  if (c.kind === 'thread') {
    out.push(`${o.title ?? '(이름 없음)'} — ${o.text ?? ''}`);
    for (const q of ids(o.questions)) out.push(`  의문 ${refText(byId, q)}`);
    for (const f of ids(o.facts)) out.push(`  사실 ${refText(byId, f)}`);
    if (ids(o.about).length) out.push(`대상: ${o.about.join(' · ')}`);
  } else {
    out.push(`${o.a ?? '?'} ${refText(byId, o.a).replace(/^\S+ /, '')}`);
    out.push(`  ${o.type ?? '?'} → ${o.b ?? '?'} ${refText(byId, o.b).replace(/^\S+ /, '')}`);
    if (o.text) out.push(o.text);
    for (const e of ids(o.evidence)) out.push(`  근거 ${refText(byId, e)}`);
  }
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of c.reviews ?? []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

/** 층 판정 — 등급과 근거 한 건, 계산한 층 */
function renderLayerItem(c, byId, { kind, act, where, brief, info }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const layer = info?.layer ? `${info.layer}층${info.ruleLayer && info.ruleLayer !== info.layer ? `(규칙 ${info.ruleLayer}층을 뒤집음)` : ''}` : '층 ?';
  const from = o.from ? ` · ${o.from}부터(그 앞 ${o.before ?? '?'})` : '';
  if (brief) return `${c.id} [${meta}] ${o.unit ?? '?'} ${o.grade ?? '?'}${from} → ${layer} — 근거 ${o.basis ?? '없음'} — ${c.reason ?? ''}`.replace(/\s+/g, ' ').trim();
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(`${o.unit ?? '?'} — ${o.grade ?? '?'}${from} → ${layer}${info ? ` · 1회독 기록 ${info.records}` : ''}`);
  out.push(`근거: ${o.basis ? refText(byId, o.basis) : '(없음 — 독립)'}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of c.reviews ?? []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

/** 주역(Z) — 인물 · 주역이 되는 챕터 · 범위 · 근거 기록 */
/** 마무리 기록(X3f-1d) — 쌓인 자리의 기록은 문장과 함께 */
function renderClosureItem(c, byId, { kind, act, where, brief }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const ids = (xs) => (Array.isArray(xs) ? xs : []);
  const closing = ids(o.closing).length ? ` (${ids(o.closing).join(' ')})` : '';
  if (brief) return `${c.id} [${meta}] ${kind}${act} ${o.text ?? ''} — 쌓임 ${ids(o.built).length} → ${o.end ?? '?'}${closing}`.replace(/\s+/g, ' ').trim();
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(o.text ?? '(문장 없음)');
  out.push(`끝: ${o.end ?? '?'}${closing}${o.chain ? ` · 사슬 ${o.chain}` : ''}${ids(o.about).length ? ` · 대상 ${o.about.join(' · ')}` : ''}`);
  for (const x of ids(o.built)) out.push(`  쌓임 ${byId.has(x) ? `${refText(byId, x)} @${byId.get(x).unit ?? '?'}` : `${x} (단위)`}`);
  for (const x of ids(o.closing)) out.push(`  닫음 ${refText(byId, x)} @${byId.get(x)?.unit ?? '?'}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of Array.isArray(c.reviews) ? c.reviews : []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

/** 합류 기록(X3f-1g) — 함께 끝난 마무리 기록을 문장과 함께 */
function renderMergeItem(c, byId, { kind, where, brief }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const members = Array.isArray(o.members) ? o.members : [];
  if (brief) return `${c.id} [${meta}] ${kind} ${o.title ?? ''} @${o.end ?? '?'} — ${members.join(' ')}`.replace(/\s+/g, ' ').trim();
  const out = [`### ${c.id} · ${kind} ${o.title ?? '(이름 없음)'} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(o.text ?? '(문장 없음)');
  out.push(`끝: ${o.end ?? '?'} · 함께 끝난 마무리 ${members.length}`);
  for (const x of members) out.push(`  ${x} ${byId.has(x) ? `(${byId.get(x).act ?? ''} · ${byId.get(x).status}) ${byId.get(x).text ?? ''}` : '(없는 기록)'}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of Array.isArray(c.reviews) ? c.reviews : []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

function renderSpineItem(c, { kind, act, where, brief }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  if (brief) return `${c.id} [${meta}] ${o.unit ?? '?'} 문 ${o.gate ?? '?'} — ${c.reason ?? ''}`.replace(/\s+/g, ' ').trim();
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(`${o.unit ?? '?'} — 문 ${o.gate ?? '?'}${c.status === '확정' ? ' · 척추(채점하지 않는다)' : c.status === '기각' ? ' · 문 안이지만 기준 미달(판정 단위)' : ''}`);
  if (o.notice) out.push(`공지: ${o.notice}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of Array.isArray(c.reviews) ? c.reviews : []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

function renderMajorItem(c, { kind, where, brief }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const nums = `말한 씬 ${o.scenes ?? '?'} · 변화 줄 ${o.changes ?? '?'} · 점수 ${o.score ?? '?'}`;
  if (brief) return `${c.id} [${meta}] ${o.person ?? '?'} ${o.from ?? '?'}부터 — ${c.reason ?? nums}`.replace(/\s+/g, ' ').trim();
  const out = [`### ${c.id} · ${kind} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(`${o.person ?? '?'} — ${c.status === '확정' ? `${o.from ?? '?'}부터 주요 인물(결정적 순간 → 필수)` : c.status === '기각' ? '띠 안이지만 끊는 선 아래(결정적 순간은 척추 인물이면 보강까지)' : '후보'} · ${nums}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of c.reviews ?? []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

function renderLeadItem(c, byId, { kind, act, where, brief }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const scope = Array.isArray(o.arcs) && o.arcs.length ? `아크 ${o.arcs.join(' · ')}` : '전체';
  const recs = Array.isArray(o.records) ? o.records : [];
  const origin = o.origin ? ` · 원점 ${o.origin}` : '';
  if (brief) return `${c.id} [${meta}] ${o.person ?? '?'} ${o.from ?? '?'}부터 · ${scope}${origin}${recs.length ? ` ⇢ ${recs.join(' ')}` : ''} — ${c.reason ?? ''}`.replace(/\s+/g, ' ').trim();
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(`${o.person ?? '?'} — ${o.from ?? '?'}부터 주역 · 범위 ${scope}${origin}`);
  for (const id of recs) out.push(`근거 기록: ${refText(byId, id)}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  for (const r of c.reviews ?? []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

/** 2회독 기록 · 수동 엣지 — 가리키는 기록은 문장과 함께 */
function renderRead2Item(c, ctx, byId, { kind, where, brief, context }) {
  const o = c.obj ?? {};
  const meta = `${statusLabel(c)} · ${c.confidence ?? '?'}`;
  const ids = (xs) => (Array.isArray(xs) ? xs : []);
  const act = c.act && !(c.kind === 'change' && c.act === '변화') ? `(${c.act})` : '';
  if (brief) {
    const pts = ids(o.points).length ? ` ⇢ ${ids(o.points).join(' ')}` : ids(o.records).length ? ` ⇢ ${ids(o.records).join(' ')}` : '';
    return `${c.id} [${meta}] ${kind}${act} ${c.text ?? ''}${pts} — ${citeAll(c.evidence) || where}`.replace(/\s+/g, ' ').trim();
  }
  const out = [`### ${c.id} · ${kind}${act} · ${meta} — ${where} (${c.session ?? '?'} · ${c.by ?? '?'})`];
  out.push(c.text ?? '(문장 없음)');
  if (c.kind === 'change') {
    if (o.act === '변화' && o.text) out.push(o.text);
    if (o.time) out.push(`작중 시점: ${refText(byId, o.time)}`);
  }
  if (c.kind === 'edge') out.push(`${o.drop ? '자동 엣지를 지운다' : `strength ${o.strength ?? '—'}`}`);
  for (const p of ids(o.points)) out.push(`  ⇢ ${refText(byId, p)}`);
  for (const p of ids(o.records)) out.push(`  근거 기록 ${refText(byId, p)}`);
  if (ids(o.about).length) out.push(`대상: ${o.about.join(' · ')}`);
  out.push(`이유: ${c.reason ?? '(없음)'}`);
  if (c.note) out.push(`메모: ${c.note}`);
  if (c.kind === 'change' && ids(o.trigger).length) {
    out.push('계기:');
    for (const ev of ids(o.trigger)) out.push(...evidenceLines(ctx, ev, context));
  }
  for (const ev of ids(c.evidence)) out.push(...evidenceLines(ctx, ev, context));
  for (const r of c.reviews ?? []) {
    out.push(`검토: ${r.date ?? '?'} ${r.decision ?? '?'} — ${r.by ?? '?'}${r.session ? ` (${r.session})` : ''}${r.note ? ` · ${r.note}` : ''}${r.before ? ` · 고치기 전: ${r.before}` : ''}`);
  }
  return out.join('\n');
}

/** 쪽 나누기 — 후보 경계에서 max 글자까지 */
export function paginate(blocks, max) {
  const pages = [];
  let cur = [];
  let size = 0;
  for (const b of blocks) {
    if (cur.length && size + b.length + 2 > max) {
      pages.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += b.length + 2;
  }
  if (cur.length) pages.push(cur);
  return pages;
}

/**
 * 리뷰 화면. 단위(또는 종류)가 바뀔 때마다 머리줄을 넣는다
 * @returns {string[]} 쪽들
 */
export function reviewPages(list, ds, ctx, order, { context = 2, brief = false, byKind = false, max = 20_000 } = {}) {
  const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
  const layers = list.some((c) => c.layers) ? computeLayers(ds, order) : null;
  const deferred = sortCandidates(list.filter(isDeferred), order, { byKind });
  const rest = sortCandidates(list.filter((c) => !isDeferred(c)), order, { byKind });
  const groupOf = (c) =>
    byKind ? KINDS[c.kind]?.label ?? c.kind : c.people ? `정체 연결 (${c.file})` : c.threads || c.layers || c.leads || c.spine || c.majors || c.links || c.affil ? `${KINDS[c.kind]?.label} (${c.file})` : `${unitLabel(ctx, c.unit)}${c.session ? ` · ${c.session}` : ''}${c.read2 ? ' 2회독' : ''}`;
  const blocks = [];
  if (deferred.length) {
    blocks.push(`## 미뤄 둔 후보 ${deferred.length} — 먼저 본다`);
    for (const c of deferred) blocks.push(renderCandidate(c, ctx, byId, { context, brief, layers }));
  }
  let group = null;
  for (const c of rest) {
    const g = groupOf(c);
    if (g !== group) {
      blocks.push(`## ${g}`);
      group = g;
    }
    blocks.push(renderCandidate(c, ctx, byId, { context, brief, layers }));
  }
  const sep = brief ? '\n' : '\n\n';
  return paginate(blocks, max).map((p) => p.join(sep));
}

// ── 결정 반영 ───────────────────────────────────────────────────────

/** 객체에 칸을 더할 때 형식의 칸 순서(FIELDS)대로 끼운다 — 없던 칸이 reviews 뒤로 가지 않게 */
function withField(obj, key, value, kind) {
  const order = FIELDS[kind] ?? [];
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(obj)) {
    if (!placed && k !== key && order.indexOf(k) > order.indexOf(key) && order.includes(key)) {
      out[key] = value;
      placed = true;
    }
    if (k === key) {
      out[key] = value;
      placed = true;
    } else out[k] = v;
  }
  if (!placed) out[key] = value;
  for (const k of Object.keys(obj)) delete obj[k];
  return out;
}

/**
 * 결정을 파일에 쓴다. explicit가 아니면(단위 · 세션으로 골랐으면) 상태가 후보인 것만 바꾼다.
 * @returns {{ changed: {c:object, from:string, to:string}[], skipped: {c:object, why:string}[], files: string[] }}
 */
export function applyDecision(list, decision, { by = 'claude', date = today(), session = null, note = null, text = null, grade = null, layer = null, basis = null, reason = null, asof = null, confidence = null, evidence = null, from = null, before: beforeGrade = null, origin = null, arcs = null, records = null, type = null, end = null, closing = null, built = null, about = null, members = null, title = null, explicit = true } = {}) {
  if (!DECISIONS.includes(decision)) throw new Error(`결정은 ${DECISIONS.join(' · ')} 중 하나`);
  if (text !== null && list.length !== 1) throw new Error('--text는 후보 하나에만 쓴다');
  if (evidence !== null && list.length !== 1) throw new Error('--evidence는 후보 하나에만 쓴다');
  if (confidence !== null && !CONFIDENCES.includes(confidence)) throw new Error(`--confidence는 ${CONFIDENCES.join(' · ')}`);
  // 근거를 고칠 수 있는 것은 씬 줄 근거를 가진 기록뿐이다 — 줄기 · 줄기 관계 · 층 판정은 근거가 기록 ID다
  if (evidence !== null && (list[0].threads || list[0].layers || list[0].leads || list[0].spine || list[0].majors)) throw new Error('--evidence는 씬 줄 근거가 있는 기록(사실 · 의문 · 사건 · 시점 · 정체 연결 · 2회독 기록 · 수동 엣지)에만');
  const evid = evidence === null ? null : typeof evidence === 'string' ? parseCite(evidence) : evidence;
  const citeText = (ev) => (Array.isArray(ev) ? ev.map(citeOf).join(' ') : '');
  if ((grade !== null || layer !== null || basis !== null || asof !== null) && (list.length !== 1 || list[0].kind !== 'layer')) throw new Error('--grade · --layer · --basis · --asof는 판정(K<n>) 하나에만 쓴다');
  if (reason !== null && list.length !== 1) throw new Error('--reason은 후보 하나에만 쓴다');
  if (asof !== null && !/^\d{4}-\d{2}-\d{2}$/.test(asof)) throw new Error('--asof는 YYYY-MM-DD (판정이 반영한 스토리의 마지막 공개일)');
  if (grade !== null && !GRADES.includes(grade)) throw new Error(`--grade는 ${GRADES.join(' · ')}`);
  // 메인 자리(X3f ⑤) — 판정(K): --from 메인 챕터 · --before 그 앞 등급, 주역(Z): --from 주역이 되는 챕터 · --arcs 아크 범위 · --origin 원점 단위
  // 빈 문자열("")은 칸을 지운다(--from "" — 메인 자리 없음)
  const kindOk = list.length === 1 && (list[0].kind === 'layer' || (['lead', 'major'].includes(list[0].kind) && beforeGrade === null));
  if ((from !== null || beforeGrade !== null) && !kindOk) throw new Error('--from · --before는 판정(K<n>) 하나에만(--from은 주역 Z<n> · 주요 인물 C<n> 하나에도) 쓴다');
  if ((arcs !== null || origin !== null || records !== null) && (list.length !== 1 || list[0].kind !== 'lead')) throw new Error('--arcs · --origin · --records는 주역(Z<n>) 하나에만 쓴다');
  // --records: 근거 기록 ID들(띄어서) — 줄기 · 사실 · 의문 · 사건 · 인물 변화. 빈 문자열은 칸을 지운다
  const recList = records === null ? null : String(records).split(/[\s,·]+/).filter(Boolean);
  // 척추 자리(X3f-1c) — from에는 메인 챕터 키나 척추 이벤트 · 사이드 키가 온다. 척추인지는 검증기가 본다(annotations/spine.json)
  if (from !== null && from !== '' && !/^(ch\d{2}|event_\w+|fl:[\w-]+|side:\w+)$/.test(from)) throw new Error('--from은 메인 챕터 키(ch38)나 척추 이벤트 · 사이드 키(event_redash · side:mudfish)');
  if (beforeGrade !== null && beforeGrade !== '' && !GRADES.includes(beforeGrade)) throw new Error(`--before는 ${GRADES.join(' · ')}`);
  const arcList = arcs === null ? null : arcs === '전체' || arcs === '' ? [] : String(arcs).split(/[\s,·]+/).filter(Boolean);
  // 척추 축(X3f-1c) — 구간 끝점에 척추 이벤트 · 사이드 키도 온다("event_redash-ch30"). 척추 키인지는 검증기가 본다
  for (const a of arcList ?? []) if (!/^[\w:.-]+$/.test(a)) throw new Error(`--arcs ${a}: "ch20-ch29" · "ch19" · "event_redash-ch30"처럼, 여럿은 띄어서(전체면 --arcs 전체)`);
  if (layer !== null && !LAYERS.includes(layer)) throw new Error(`--layer는 ${LAYERS.join(' · ')}`);
  // 마무리 기록(X3f-1d) — --type 종류 · --end 끝난 단위 · --closing 닫는 기록 · --built 쌓인 자리(기록 ID · 단위 키, 띄어서). 맞는지는 검증기가 본다
  if ((type !== null || closing !== null || built !== null || about !== null) && (list.length !== 1 || list[0].kind !== 'closure')) throw new Error('--type · --closing · --built · --about는 마무리 기록(O<n>) 하나에만 쓴다');
  // 합류 기록(X3f-1g) — --members 함께 끝난 마무리 기록(O, 띄어서) · --title 결판 이름 · --end 함께 끝난 단위
  if ((members !== null || title !== null) && (list.length !== 1 || list[0].kind !== 'merge')) throw new Error('--members · --title은 합류 기록(H<n>) 하나에만 쓴다');
  if (end !== null && (list.length !== 1 || !['closure', 'merge'].includes(list[0].kind))) throw new Error('--end는 마무리 기록(O<n>) · 합류 기록(H<n>) 하나에만 쓴다');
  if (type !== null && !CLOSURE_TYPES.includes(type)) throw new Error(`--type은 ${CLOSURE_TYPES.join(' · ')}`);
  const idList = (x) => (x === null ? null : String(x).split(/[\s,·]+/).filter(Boolean));
  const closingList = idList(closing);
  const builtList = idList(built);
  const aboutList = idList(about);
  const memberList = idList(members);
  const changed = [];
  const skipped = [];
  const perFile = new Map();
  for (const c of list) {
    if (!explicit && c.status !== '후보') {
      skipped.push({ c, why: `이미 ${c.status}` });
      continue;
    }
    const to = STATUSES.includes(decision) ? decision : c.status;
    const sameText = (text === null || text === c.obj.text) && (grade === null || grade === c.obj.grade) && (layer === null || layer === c.obj.layer) &&
      (basis === null || basis === c.obj.basis) && (reason === null || reason === c.obj.reason) && (asof === null || asof === c.obj.asof) &&
      (confidence === null || confidence === c.obj.confidence) && (evid === null || citeText(evid) === citeText(c.obj.evidence)) &&
      (from === null || (from || undefined) === c.obj.from) && (beforeGrade === null || (beforeGrade || undefined) === c.obj.before) && (origin === null || (origin || undefined) === c.obj.origin) &&
      (arcList === null || arcList.join(' ') === (Array.isArray(c.obj.arcs) ? c.obj.arcs : []).join(' ')) &&
      (recList === null || recList.join(' ') === (Array.isArray(c.obj.records) ? c.obj.records : []).join(' ')) &&
      (type === null || type === c.obj.type) && (end === null || end === c.obj.end) &&
      (closingList === null || closingList.join(' ') === (Array.isArray(c.obj.closing) ? c.obj.closing : []).join(' ')) &&
      (builtList === null || builtList.join(' ') === (Array.isArray(c.obj.built) ? c.obj.built : []).join(' ')) &&
      (aboutList === null || aboutList.join(' ') === (Array.isArray(c.obj.about) ? c.obj.about : []).join(' ')) &&
      (memberList === null || memberList.join(' ') === (Array.isArray(c.obj.members) ? c.obj.members : []).join(' ')) && (title === null || title === c.obj.title);
    if (decision === '보류' && c.status !== '후보') {
      skipped.push({ c, why: `보류는 후보에만 — 지금 ${c.status}. 되돌리려면 후보로` });
      continue;
    }
    // 바뀌는 게 없으면 건너뛴다. 보류된 후보를 '후보'로 두면 보류만 풀린다(검토 기록이 남는다)
    // 판정(K)은 다른 세션이 다시 보면 바뀐 게 없어도 검토 기록을 남긴다 — 다시 판정 이력(X3a, docs/annotations.md "중요도 판정")
    const lastSession = (Array.isArray(c.obj.reviews) ? c.obj.reviews : []).at(-1)?.session ?? null;
    const recheck = (c.kind === 'layer' || c.kind === 'lead' || c.kind === 'spine' || c.kind === 'major') && session && session !== lastSession && decision === '확정' && c.status === '확정';
    const noop = !recheck && sameText && (decision === '보류' ? isDeferred(c) : to === c.status && !(decision === '후보' && isDeferred(c)));
    if (noop) {
      skipped.push({ c, why: `이미 ${statusLabel(c)}` });
      continue;
    }
    const review = { decision, by, date };
    if (session) review.session = session;
    if (note) review.note = note;
    const obj = { ...c.obj };
    if (!sameText) {
      const before = [];
      if (text !== null && text !== obj.text) {
        before.push(obj.text);
        obj.text = text;
      }
      if (grade !== null && grade !== obj.grade) {
        before.push(`등급 ${obj.grade}`);
        obj.grade = grade;
      }
      if (layer !== null && layer !== obj.layer) {
        before.push(`층 ${obj.layer ?? '규칙'}`);
        obj.layer = layer;
        // 규칙 층을 뒤집은 까닭은 판정의 note에 둔다 — 검증기가 본다(docs/annotations.md "층 판정")
        if (note) obj.note = note;
      }
      if (basis !== null && basis !== obj.basis) {
        before.push(`근거 ${obj.basis ?? '없음'}`);
        obj.basis = basis;
      }
      if (asof !== null && asof !== obj.asof) {
        before.push(`기준 시점 ${obj.asof ?? '없음'}`);
        obj.asof = asof;
      }
      if (reason !== null && reason !== obj.reason) {
        before.push(`이유 ${obj.reason ?? '없음'}`);
        obj.reason = reason;
      }
      if (confidence !== null && confidence !== obj.confidence) {
        before.push(`확신도 ${obj.confidence ?? '없음'}`);
        obj.confidence = confidence;
      }
      if (evid !== null && citeText(evid) !== citeText(obj.evidence)) {
        before.push(`근거 ${citeText(obj.evidence) || '없음'}`);
        obj.evidence = evid;
      }
      // 메인 자리 · 주역 칸 — 빈 문자열은 지운다. 칸은 판정 · 주역 형식의 자리에 끼운다(withField)
      const setField = (key, value, label, show = (v) => v ?? '없음') => {
        const cur = obj[key];
        const next = value === '' || (Array.isArray(value) && !value.length) ? undefined : value;
        if (JSON.stringify(cur) === JSON.stringify(next)) return;
        before.push(`${label} ${show(cur)}`);
        if (next === undefined) delete obj[key];
        else Object.assign(obj, withField(obj, key, next, c.kind));
      };
      if (from !== null) setField('from', from, '메인 자리');
      if (beforeGrade !== null) setField('before', beforeGrade, '그 앞 등급');
      if (origin !== null) setField('origin', origin, '원점');
      if (arcList !== null) setField('arcs', arcList, '범위', (v) => (Array.isArray(v) && v.length ? v.join(' ') : '전체'));
      if (recList !== null) setField('records', recList, '근거 기록', (v) => (Array.isArray(v) && v.length ? v.join(' ') : '없음'));
      const list = (v) => (Array.isArray(v) && v.length ? v.join(' ') : '없음');
      if (type !== null) setField('type', type, '종류');
      if (end !== null) setField('end', end, '끝');
      if (closingList !== null) setField('closing', closingList, '닫는 기록', list);
      if (builtList !== null) setField('built', builtList, '쌓인 자리', list);
      if (aboutList !== null) setField('about', aboutList, '대상', list);
      if (memberList !== null) setField('members', memberList, '함께 끝난 마무리', list);
      if (title !== null) setField('title', title, '결판 이름');
      review.before = before.join(' · ');
    }
    // 칸 순서는 그대로 두고(status는 제자리) reviews는 끝에 붙는다
    obj.status = to;
    obj.reviews = [...(Array.isArray(c.obj.reviews) ? c.obj.reviews : []), review];
    if (!perFile.has(c.file)) perFile.set(c.file, { changes: [] });
    perFile.get(c.file).changes.push({ c, value: obj });
    changed.push({ c, from: statusLabel(c), to: decision === '보류' ? '후보(보류)' : to });
  }
  return { changed, skipped, perFile };
}

/** applyDecision 결과를 디스크에 쓴다 */
export function writeDecisions(ds, perFile) {
  const written = [];
  for (const [name, { changes }] of perFile) {
    const file = [...ds.files, ...(ds.files2 ?? [])].find((f) => f.name === name) ?? [ds.people, ds.threads, ds.layers, ds.leads, ds.spine, ds.majors, ds.closures, ds.links, ds.affiliations].find((x) => x?.name === name) ?? null;
    if (!file) throw new Error(`파일을 못 찾았다: ${name}`);
    const text = fs.readFileSync(file.path, 'utf8');
    if (text !== file.text) throw new Error(`${name}이(가) 읽은 뒤에 바뀌었다 — 다시 실행한다`);
    const out = replaceValues(text, changes.map(({ c, value }) => ({ path: [c.section, c.index], value })));
    fs.writeFileSync(file.path, out);
    written.push(name);
  }
  return written;
}

// ── 진행률 ──────────────────────────────────────────────────────────

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');

/** 후보 묶음의 집계 */
export function tally(list) {
  const t = { all: list.length, 후보: 0, 확정: 0, 기각: 0, 보류: 0, fact: 0, question: 0, event: 0, time: 0, link: 0, thread: 0, relation: 0, layer: 0, lead: 0, spine: 0, major: 0, closure: 0, merge: 0, mention: 0, echo: 0, change: 0, life: 0, edge: 0, affil: 0 };
  for (const c of list) {
    if (STATUSES.includes(c.status)) t[c.status]++;
    if (isDeferred(c)) t.보류++;
    if (c.role === 'event') t.event++;
    else t[c.kind]++;
  }
  t.done = t.확정 + t.기각;
  return t;
}

const tallyText = (t) =>
  `후보 ${t.all} (사실 ${t.fact} · 의문 ${t.question} · 사건 ${t.event} · 시점 ${t.time}) · 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}` +
  `${t.보류 ? `(보류 ${t.보류})` : ''} · 검토 ${pct(t.done, t.all)}`;

/**
 * 단위별 진행률. 순서(읽기 순서)의 항목마다 기록 파일이 있는지와 후보 검토 상태
 * @param {{ all?: boolean }} opts all이 아니면 기록이 있는 세션과 다음 세션만
 */
export function progressReport(ds, ctx, order, { all = false } = {}) {
  const fileOf = new Map();
  for (const f of ds.files) if (f.data?.unit) fileOf.set(`${f.data.unit}@${f.data.parts ?? ''}`, f);
  const cands = ds.candidates.filter((c) => c.id && isRecord(c));
  const byFile = new Map();
  for (const c of cands) (byFile.get(c.file) ?? byFile.set(c.file, []).get(c.file)).push(c);
  const items = order.items;
  const read = items.filter((it) => fileOf.has(`${it.key}@${it.parts ?? ''}`));
  const nextItem = items.find((it) => !fileOf.has(`${it.key}@${it.parts ?? ''}`)) ?? null;
  const out = [];
  const total = tally(cands);
  out.push(`# 1회독 진행 — 읽음 ${read.length}/${items.length} 단위 · ${tallyText(total)}`);
  const readOf = (xs) => xs.filter((it) => fileOf.has(`${it.key}@${it.parts ?? ''}`)).length;
  out.push(`${kindTally(items, (it) => fileOf.has(`${it.key}@${it.parts ?? ''}`))}${nextItem ? ` · 다음: ${nextItem.session} ${nextItem.key}${nextItem.parts ? ` 파트 ${nextItem.parts}` : ''}` : ' · 순서 끝'}`);
  const links = ds.candidates.filter((c) => c.people);
  if (links.length) {
    const t = tally(links);
    out.push(`정체 연결(${ds.people?.name}): ${t.all} — 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''}`);
  }
  for (const kind of ['thread', 'relation']) {
    const xs = ds.candidates.filter((c) => c.threads && c.kind === kind && c.id);
    if (!xs.length) continue;
    const t = tally(xs);
    out.push(`${KINDS[kind].label}(${ds.threads?.name}): ${t.all} — 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''}`);
  }
  const spine = ds.candidates.filter((c) => c.spine && c.id);
  if (spine.length) {
    const t = tally(spine);
    out.push(`척추(${ds.spine?.name}): 문 안 ${t.all} — 척추 ${t.확정} · 미달 ${t.기각} · 남음 ${t.후보}`);
  }
  const majors = ds.candidates.filter((c) => c.majors && c.id);
  if (majors.length) {
    const t = tally(majors);
    out.push(`주요 인물(${ds.majors?.name}): 띠 ${t.all} — 주요 인물 ${t.확정} · 선 아래 ${t.기각} · 남음 ${t.후보}`);
  }
  for (const [kind, label] of [['closure', '마무리 기록'], ['merge', '합류 기록']]) {
    const xs = ds.candidates.filter((c) => c.closures && c.kind === kind && c.id);
    if (!xs.length) continue;
    const t = tally(xs);
    out.push(`${label}(${ds.closures?.name}): ${t.all} — 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''}`);
  }
  const affils = ds.candidates.filter((c) => c.affil && c.id);
  if (affils.length) {
    const t = tally(affils);
    out.push(`소속 기록(${ds.affiliations?.name}): ${t.all} — 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''}`);
  }
  const leads = ds.candidates.filter((c) => c.leads && c.id);
  if (leads.length) {
    const t = tally(leads);
    out.push(`주역 명단(${ds.leads?.name}): ${t.all} — 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''}`);
  }
  const lays = ds.candidates.filter((c) => c.layers && c.id);
  if (lays.length) {
    const t = tally(lays);
    const lay = computeLayers(ds, order);
    const per = LAYERS.map((n) => `${n}층 ${lay.units.filter((u) => u.layer === n).length}`).join(' · ');
    out.push(`층 판정(${ds.layers?.name}): ${t.all} — 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''} · ${per}${lay.missing.length ? ` · 판정 없음 ${lay.missing.length}` : ''}`);
  }
  const shown = new Set(read.map((it) => it.session));
  if (nextItem) shown.add(nextItem.session);
  for (const s of order.sessions) {
    if (!all && !shown.has(s.id)) continue;
    const its = items.filter((it) => it.session === s.id);
    const sc = its.flatMap((it) => byFile.get(fileOf.get(`${it.key}@${it.parts ?? ''}`)?.name) ?? []);
    const st = tally(sc);
    out.push('', `## ${s.id} — 읽음 ${readOf(its)}/${its.length}${sc.length ? ` · ${tallyText(st)}` : ''}`);
    for (const it of its) {
      const f = fileOf.get(`${it.key}@${it.parts ?? ''}`);
      const key = `${it.key}${it.parts ? ` 파트 ${it.parts}` : ''}`;
      if (!f) {
        out.push(`- ${key} — 안 읽음`);
        continue;
      }
      const t = tally(byFile.get(f.name) ?? []);
      const short = `후보 ${t.all} · 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''} · 검토 ${pct(t.done, t.all)}`;
      out.push(`- ${key} — 읽음 ${f.data.date ?? ''} · ${short}`);
    }
  }
  const outside = ds.files.filter((f) => f.data?.unit && !items.some((it) => it.key === f.data.unit && (it.parts ?? null) === (f.data.parts ?? null)));
  if (outside.length) {
    out.push('', `## 순서 밖 기록 ${outside.length}`);
    for (const f of outside) out.push(`- ${f.data.unit} (${f.name}) — ${tallyText(tally(byFile.get(f.name) ?? []))}`);
  }
  if (!all) out.push('', `전체 순서: node tools/records.mjs progress --all`);
  return out.join('\n');
}


/**
 * 2회독 진행률 — 2회독 순서(docs/history/reading.md P · M)의 항목마다 2회독 파일이 있는지와 기록 수 · 검토 상태, 바로잡기로 더한 1회독 항목 수
 * @param {{ items: object[], sessions: object[] }} order2 loadOrder(READ2_PREFIXES)
 */
/**
 * @param {{ all?: boolean, unknown?: Map<string, {total: number, done: number}> }} opt unknown = 단위별 미상 이름표 줄 · 정체 적은 줄(read2.mjs unknownSpeakerProgress)
 */
export function progressReport2(ds, order2, { all = false, unknown = null } = {}) {
  const fileOf = new Map();
  for (const f of ds.files2 ?? []) if (f.data?.unit) fileOf.set(`${f.data.unit}@${f.data.parts ?? ''}`, f);
  const recs = ds.candidates.filter((c) => c.read2 && c.id);
  const byFile = new Map();
  for (const c of recs) (byFile.get(c.file) ?? byFile.set(c.file, []).get(c.file)).push(c);
  const fixes = ds.candidates.filter((c) => c.fix && c.id);
  const fixBySession = new Map();
  for (const c of fixes) fixBySession.set(c.session, (fixBySession.get(c.session) ?? 0) + 1);
  const has = (it) => fileOf.has(`${it.key}@${it.parts ?? ''}`);
  const items = order2.items;
  const nextItem = items.find((it) => !has(it)) ?? null;
  const t = tally(recs);
  const kinds = (x) => `암시 언급 ${x.mention} · 떡밥 ${x.echo} · 인물 변화 ${x.change} · 생활상 ${x.life}`;
  const out = [];
  out.push(`# 2회독 진행 — 읽음 ${items.filter(has).length}/${items.length} 단위 · 기록 ${t.all} (${kinds(t)}) · 확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보}${t.보류 ? `(보류 ${t.보류})` : ''} · 검토 ${pct(t.done, t.all)}`);
  const unk = (keys) => {
    if (!unknown) return null;
    const x = [...new Set(keys)].map((k) => unknown.get(k)).filter(Boolean).reduce((a, v) => ({ total: a.total + v.total, done: a.done + v.done }), { total: 0, done: 0 });
    return x.total ? `미상 이름표 줄 정체 적음 ${x.done}/${x.total}` : null;
  };
  const unkAll = unknown ? [...unknown.values()].reduce((a, v) => ({ total: a.total + v.total, done: a.done + v.done }), { total: 0, done: 0 }) : null;
  if (unkAll) out.push(`미상 이름표 줄(\`???\` 등) 정체 적음 ${unkAll.done}/${unkAll.total} — 2회독 암시 언급 speaker: true, 단위마다 인계 next.md "정체 볼 줄"`);
  out.push(`${kindTally(items, has)} · 바로잡기로 더한 1회독 항목 ${fixes.length}${nextItem ? ` · 다음: ${nextItem.session} ${nextItem.key}${nextItem.parts ? ` 파트 ${nextItem.parts}` : ''}` : ' · 순서 끝'}`);
  const shown = new Set(items.filter(has).map((it) => it.session));
  if (nextItem) shown.add(nextItem.session);
  for (const s of order2.sessions) {
    if (!all && !shown.has(s.id)) continue;
    const its = items.filter((it) => it.session === s.id);
    const sc = its.flatMap((it) => byFile.get(fileOf.get(`${it.key}@${it.parts ?? ''}`)?.name) ?? []);
    const st = tally(sc);
    const su = unk(its.map((it) => it.key));
    out.push('', `## ${s.id} — 읽음 ${its.filter(has).length}/${its.length}${sc.length ? ` · 기록 ${st.all} (${kinds(st)}) · 검토 ${pct(st.done, st.all)}` : ''}${fixBySession.get(s.id) ? ` · 바로잡기 ${fixBySession.get(s.id)}` : ''}${su ? ` · ${su}` : ''}`);
    for (const it of its) {
      const f = fileOf.get(`${it.key}@${it.parts ?? ''}`);
      const key = `${it.key}${it.parts ? ` 파트 ${it.parts}` : ''}`;
      const iu = unk([it.key]);
      if (!f) {
        out.push(`- ${key} — 안 읽음${iu ? ` · ${iu}` : ''}`);
        continue;
      }
      const x = tally(byFile.get(f.name) ?? []);
      out.push(`- ${key} — 읽음 ${f.data.date ?? ''} · 기록 ${x.all} (${kinds(x)}) · 남음 ${x.후보}${iu ? ` · ${iu}` : ''}`);
    }
  }
  if (!all) out.push('', '전체 순서: node tools/records.mjs progress --read2 --all');
  return out.join('\n');
}
