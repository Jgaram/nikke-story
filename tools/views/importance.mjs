/**
 * X3 — 중요도 판정 시안 표(T3-6, docs/views.md 화면 1). 판정(annotations/layers.json K<n>)과 판정 입력(tools/views/layers.mjs — 2회독 포함)을 한 표로 모으고,
 * 다시 볼 단위를 묶음으로 뽑고, 공개 자리마다 등급을 계산한다. 판정은 Claude가 근거를 보고 한다(CLAUDE.md "해석이 필요한 기록") — 이 표는 고르지 않는다.
 *
 *   node tools/views/importance.mjs            → data/views/importance/ (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/importance.mjs --example  예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   단위 하나: node tools/records.mjs layers <단위 키> [--summary] · 공개 자리 하나: node tools/query.mjs grades <ch20 | 45 | 날짜> [--list]
 *
 * 등급 넷(X3f — 사용자, 2026-10-09): 필수 · 보강 · 참고 · 독립. "이 단위를 안 보고 척추를 읽으면 어떤가"를 척추를 읽는 그 자리에서 묻는다.
 * 척추(X3f-1b · 1c) = 메인 챕터 + annotations/spine.json 확정 단위(이벤트 8 · 사이드 3 — tools/views/spine.mjs). 척추 단위는 채점하지 않는다 —
 *   시안 표에서 빼고(units에 없다 — 화면 1의 척추 줄) spine 목록에 따로 둔다. 그 단위의 판정(K)은 기각하지 않고 "척추" 표시로 남긴다(척추에서 빼면 판정으로 돌아온다).
 *   아래의 "메인"(메인 연결 · 메인이 딛음 · 메인 자리)은 모두 척추를 뜻한다 — 척추 이벤트 · 사이드와 이어진 기록은 메인 챕터와 같은 무게, from에 척추 키가 올 수 있다.
 * 자리별 등급(X3f ⑤): 필수 · 보강 판정은 메인이 이 단위를 딛기 시작하는 챕터(from)와 그 앞 자리의 등급(before)을 단다.
 *   공개 자리 T(query.mjs known과 같은 자리 — tools/views/reveal.mjs releasePlaces)에서 단위의 등급 = 아직 안 나왔으면 없음 ·
 *   T가 from 챕터의 자리보다 앞이면 before(없으면 등급) · 그 밖은 등급. 내려가는 자리는 없다(메인이 뒤에서 스스로 설명해도 그 자리에서 막힌 것은 그대로 — ②).
 *
 * 다시 볼 묶음(RECHECK — X3f 기준 바꿈 뒤 검토 기록(세션 X3f · N3, 또는 사용자)이 없는 판정. 앞 묶음이 이긴다):
 *   필수 다시     지금 필수 — 새 정의와 메인 자리(from · before)로
 *   주역 원점     주역(annotations/leads.json)의 사연 — 신념 · 기억 · 소속 · 신체 변화(D)나 그 주역을 다룬 사실 2건 이상. 주역마다 원점 하나가 필수(X3f ①).
 *                 원점(annotations/leads.json origin — 단위 키나 "메인")이 정해진 주역의 사연은 이 묶음에 안 든다 — 나머지 사연 조각은 등급의 묶음으로 간다
 *   메인이 딛음   메인이 이 단위의 것을 딛거나(1회독 out · 2회독 out 재언급) 메인 의문을 전부 회수 · 뒤집거나 메인 복선의 답이 여기(2회독 in 암시) — 줄기 무게와 상관없이 ·
 *                 메인이 쌓은 연작 · 갈등 · 관계 · 성장이 여기서 끝난다(마무리 기록 O 확정, 지휘관 관계 빼고 — X3f-1d, tools/views/closures.mjs)
 *   보강 다시     지금 보강 — 보강(메인의 빈틈) / 참고(열린 줄기의 복선 · 세계 · 곁 일화)로 가른다(X3f ④)
 *   참고 후보     지금 독립 — 줄기에 안 묶인 세계 · 메인 인물 사실 · 생활상 · 줄기 인물 변화 · 뼈대 · 보강 줄기 암시 · 뼈대 about이 있다(참고의 문턱 ③)
 *   독립 그대로   지금 독립 — 위 입력이 없다
 * 감정 기준 후보(X3g — 카드 3절 "결정적 순간", 판정 입력 ⑧ tools/views/layers.mjs emotionSignals) — 다시 볼 묶음과 따로 센다(이해 등급은 그대로 두고 올릴지만 본다):
 *   오름        감정 상한(주요 인물의 결정적 순간 필수 · 척추 인물 보강 — 주요 인물은 annotations/majors.json, X3g-1b)이 지금 등급보다 높다
 *   이른 자리   등급은 같은데 감정 쪽 from이 지금 from보다 이르다(카드 4절 — 그 등급에 처음 닿는 자리)
 *   검토 기록(세션 X3g · N3, 또는 사용자)이 있으면 다시 봄 — emotion.md 후보 표에서 빠진다. 후보 표는 공개 자리 순(X3g-3이 나눠 판정한다).
 * 같은 기록이면 같은 결과다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, GRADES, READ1_DIR, ROOT, displayPath, loadDataset, spineUnits } from '../records/model.mjs';
import { computeLayers, layerKind } from '../records/layers.mjs';
import { kindOfKey, loadOrder, loadReadLayers } from '../records/order.mjs';
import { read2Edges } from '../records/read2.mjs';
import { buildRead1Views } from './read1.mjs';
import { emptySignal, layerSignals } from './layers.mjs';
import { buildClosures } from './closures.mjs';
import { releasePlaces } from './reveal.mjs';

export const IMPORTANCE_DIR = path.join(ROOT, 'data/views/importance');
const W = { 뼈대: 0, 보강: 1, 독립: 2 };
const G = { 필수: 0, 보강: 1, 참고: 2, 독립: 3 };
/** 기준 바꿈(X3f) 뒤 다시 봄으로 치는 검토 세션 */
export const RECHECK_SESSION = /^(X3f|N3)/;
/** 감정 기준(X3g) 뒤 다시 봄으로 치는 검토 세션 */
export const EMOTION_SESSION = /^(X3g|N3)/;
const KIND_ROWS = ['서브퀘스트', '유실물', '그 밖', '사이드', '이벤트', '이벤트 유실물', '호감도'];
/** 다시 볼 묶음 — 이름 · 뜻 (머리말 RECHECK) */
export const RECHECK_GROUPS = [
  ['필수 다시', '지금 필수 — 새 정의와 척추 자리(--from · --before)로'],
  ['주역 원점', '필수 후보 — 원점(origin)이 아직 없는 주역의 사연(신념 · 기억 · 소속 · 신체 변화, 그 주역을 다룬 사실 2건 이상). 주역마다 원점 단위 하나가 필수(카드 3절 2), 나머지 사연 조각은 보강 · 참고'],
  ['메인이 딛음', '필수 후보 — 척추(메인 챕터 · 척추 이벤트 · 사이드)가 이 단위의 것을 딛거나 척추 의문을 전부 회수 · 뒤집는다(척추가 그 상황에서 시작하는 단위) · 척추가 쌓은 갈등 · 관계 · 성장이 여기서 끝난다(마무리 기록 — 판정 입력 ⑦)'],
  ['보강 다시', '지금 보강 — 보강(척추가 \'뭐 있나 보다\'로 넘긴 빈틈) / 참고(열린 줄기의 복선 · 세계 · 곁 일화)로 가른다(카드 3절 4)'],
  ['참고 후보', '지금 독립 — 줄기에 안 묶인 세계 · 척추 인물 사실 · 생활상 · 줄기 인물 변화 · 줄기 암시가 있다. 척추가 말하지 않은 기록이 하나 이상이면 참고(카드 3절 5)'],
  ['독립 그대로', '지금 독립 — 위 입력이 없다. 1회독 요약으로 확인하고 일괄로 다시 봄을 남긴다'],
];

const COLUMNS = ['order', 'unit', 'kind', 'title', 'judgment', 'grade', 'from', 'before', 'lead', 'pos', 'from_pos', 'grade_path', 'basis', 'confidence', 'status', 'asof',
  'last_session', 'history', 'by_user', 'draft', 'draft_basis', 'draft_read1', 'main1', 'main2', 'heavy', 'hints', 'changes', 'life', 'loose_world', 'loose_main', 'leads', 'buildup', 'closures',
  'read_layer', 'layer', 'recheck', 'rechecked', 'reason', 'emotion', 'emotion_from', 'emotion_from_pos', 'emotion_moments', 'emotion_check', 'emotion_done'];

const mainW = (m) => Math.min(9, ...m.threads.map((j) => W[m.weights[j]] ?? 9));
const counted2 = (m) => m.src === 2 && !(m.dir === 'in' && m.act === '재언급');
/** 메인이 딛는 연결 — 1회독 out · 전부 회수 · 뒤집음, 2회독 out 재언급 · in 암시(줄기 무게와 상관없이) */
const steps = (m) => (m.src === 2 ? (m.dir === 'out' && m.act === '재언급') || (m.dir === 'in' && m.act === '암시') : m.dir === 'out' || m.degree === '전부' || m.type === 'reversal');

/**
 * 다시 볼 까닭(X3f) — 머리말 RECHECK. 첫 까닭이 묶음이다
 * @param {string} grade 지금 판정의 등급
 * @param {object} s layerSignals의 단위 신호(2회독 포함)
 * @param {{ origins?: Set<string> }} [opts] origins: 원점(origin)이 이미 정해진 주역
 * @returns {string[]}
 */
export function recheckReasons(grade, s, { origins = new Set() } = {}) {
  const why = [];
  if (grade === '필수') why.push('필수 다시');
  if ((s.leads ?? []).some((x) => !origins.has(x.person))) why.push('주역 원점');
  // 척추가 쌓은 빌드업의 끝(X3f-1d) — 확정 마무리 기록만(후보는 확정값처럼 쓰지 않는다), 지휘관 관계는 빼고
  const closing = (s.buildup?.closures ?? []).some((x) => x.status === '확정' && !x.commander);
  if (s.main.some(steps) || closing) why.push('메인이 딛음');
  if (grade === '보강') why.push('보강 다시');
  if (grade === '독립' || grade === '참고') {
    const life = Object.values(s.life ?? {}).reduce((a, n) => a + n, 0);
    const hints = s.echo.some((e) => e.act === '암시' && W[e.weight] <= 1);
    const aboutSk = s.about.some((a) => a.weight === '뼈대');
    if (s.loose?.world.length || s.loose?.main.length || life || s.changes.length || hints || aboutSk || s.main.some((m) => m.src !== 2 || counted2(m))) why.push('참고 후보');
    else if (!why.length) why.push('독립 그대로');
  }
  return why;
}

/**
 * 감정 기준 후보(X3g) — 머리말 "감정 기준 후보"
 * @param {{ grade: string, pos: number|'', from_pos: number|'' }} row units.csv 한 줄(지금 판정)
 * @param {string|null} cap 감정 상한(판정 입력 ⑧의 grade)
 * @param {number|''} capPos 감정 쪽 from의 공개 자리(단위보다 뒤일 때만, 아니면 '')
 * @returns {'오름'|'이른 자리'|''}
 */
export function emotionCheck(row, cap, capPos) {
  if (!cap || !row.grade) return '';
  if (G[cap] < G[row.grade]) return '오름';
  if (cap === row.grade && row.from_pos && (!capPos || capPos < row.from_pos)) return '이른 자리';
  return '';
}

/**
 * 공개 자리 T에서 단위의 등급(X3f ⑤) — 아직 안 나왔으면 null, from 챕터 자리 앞이면 before(없으면 등급)
 * @param {{ grade: string, pos: number|'', from_pos: number|'', before: string }} u units.csv 한 줄
 */
export function gradeAt(u, T) {
  if (!u.grade || !u.pos || T < u.pos) return null;
  if (u.from_pos && T < u.from_pos) return u.before || u.grade;
  return u.grade;
}

/**
 * 판정의 이력 — 검토 기록(reviews)의 before에 남은 등급으로 거꾸로 편다. "B0b-2 독립 → X3b 보강", 바뀌지 않은 다시 봄은 "· X3c 그대로"
 * @param {object} obj 판정 객체(K)
 */
export function gradeHistory(obj) {
  const reviews = Array.isArray(obj?.reviews) ? obj.reviews : [];
  const grades = new Array(reviews.length).fill(null);
  let g = obj?.grade ?? '?';
  for (let i = reviews.length - 1; i >= 0; i--) {
    grades[i] = g;
    const m = String(reviews[i].before ?? '').match(/(?:^| · )등급 (\S+)/);
    if (m) g = m[1];
  }
  const parts = [];
  let last = null;
  let lastSession = null;
  reviews.forEach((r, i) => {
    const who = r.session ?? (r.by === '사용자' ? '사용자' : r.date ?? '?');
    if (last === null) parts.push(`${who} ${grades[i]}`);
    else if (grades[i] !== last) parts.push(`→ ${who}${r.by === '사용자' && r.session ? '(사용자)' : ''} ${grades[i]}`);
    else if (who !== lastSession) parts.push(`· ${who} 그대로`);
    last = grades[i];
    lastSession = who;
  });
  return parts.join(' ') || `${obj?.grade ?? '?'}`;
}

/**
 * @param {ReturnType<typeof loadDataset>} ds
 * @param {object} ctx openContext()
 * @param {{ items: {key:string}[] }} order 1회독 순서(출시순 한 줄)
 * @param {{ readLayers?: Map<string, number>|null }} [opts]
 */
export function buildImportance(ds, ctx, order, { readLayers = null } = {}) {
  const views = buildRead1Views(ds, ctx, order);
  const spine = spineUnits(ds);
  const signals = layerSignals(ds, views, read2Edges(ds, ctx, order), { spine, closures: buildClosures(ds, ctx, order) });
  const lay = computeLayers(ds, order);
  const spineJudged = new Map(ds.candidates.filter((c) => c.kind === 'spine' && c.status === '확정' && c.spineUnit).map((c) => [c.spineUnit, c]));
  const rel = releasePlaces(ctx, order);
  const tickOf = (k) => rel.byUnit.get(k)?.tick ?? '';
  const units = [];
  const missing = new Set(lay.missing);
  const leadFrom = new Map(ds.candidates.filter((c) => c.kind === 'lead' && c.status !== '기각' && c.obj?.person).map((c) => [c.obj.person, c.obj.from ?? '']));
  // 원점(X3f ①) — 주역 항목의 origin(단위 키 · "메인"). 단위 → 그 단위를 원점으로 둔 주역들
  const liveLeads = ds.candidates.filter((c) => c.kind === 'lead' && c.status !== '기각' && c.obj?.person);
  const origins = new Set(liveLeads.filter((c) => c.obj.origin).map((c) => c.obj.person));
  const originOf = new Map();
  for (const c of liveLeads) if (c.obj.origin && c.obj.origin !== '메인') (originOf.get(c.obj.origin) ?? originOf.set(c.obj.origin, []).get(c.obj.origin)).push(c.obj.person.replace('person:', ''));
  // 척추 — 채점하지 않는다. 지금 판정(K)은 "척추" 표시로 남긴다(기각하지 않는다)
  const spineRows = [];
  for (const u of lay.units) {
    if (u.kind === '메인' || (!u.judgment && !missing.has(u.key))) continue;
    if (spine.has(u.key)) {
      const o = u.judgment?.obj ?? {};
      spineRows.push({ order: u.order, unit: u.key, kind: layerKind(u.key), title: ctx.resolve(u.key)?.title ?? '', spine: spineJudged.get(u.key)?.id ?? '', gate: spineJudged.get(u.key)?.obj?.gate ?? '',
        judgment: u.judgment?.id ?? '', grade: o.grade ?? '', pos: tickOf(u.key), layer: u.layer ?? '' });
      continue;
    }
    const s = signals.get(u.key) ?? emptySignal(u.key);
    const j = u.judgment;
    const o = j?.obj ?? {};
    const reviews = Array.isArray(o.reviews) ? o.reviews : [];
    const rechecked = reviews.some((r) => RECHECK_SESSION.test(r.session ?? '') || r.by === '사용자');
    const why = u.grade ? recheckReasons(u.grade, s, { origins }) : ['판정 없음'];
    const pos = tickOf(u.key);
    const fromPos = o.from ? tickOf(o.from) : '';
    const row = {
      order: u.order, unit: u.key, kind: layerKind(u.key), title: ctx.resolve(u.key)?.title ?? '', judgment: j?.id ?? '', grade: u.grade ?? '',
      from: o.from ?? '', before: o.before ?? '', lead: (originOf.get(u.key) ?? []).join(' · '), pos, from_pos: fromPos && pos && fromPos > pos ? fromPos : '',
      basis: o.basis ?? '', confidence: o.confidence ?? '', status: j?.status ?? '', asof: o.asof ?? '', last_session: reviews.at(-1)?.session ?? '',
      history: j ? gradeHistory(o) : '', by_user: reviews.some((r) => r.by === '사용자') ? '사용자' : '',
      draft: s.draft.grade, draft_basis: s.draft.basis ?? '', draft_read1: s.draft1.grade,
      main1: s.main.filter((m) => m.src !== 2).length, main2: s.main.filter(counted2).length, heavy: s.main.filter(steps).length,
      hints: s.echo.filter((e) => e.act === '암시' && W[e.weight] <= 1).length, changes: s.changes.length,
      life: Object.values(s.life).reduce((a, n) => a + n, 0), loose_world: s.loose?.world.length ?? 0, loose_main: s.loose?.main.length ?? 0,
      leads: (s.leads ?? []).map((x) => `${x.person.replace('person:', '')}(${leadFrom.get(x.person) ?? ''}) 사실 ${x.facts.length}${x.deep.length ? ` · 변화 ${x.deep.length}` : ''}`).join(' / '),
      buildup: (s.buildup?.payoffs.length ?? 0) + (s.buildup?.answers.length ?? 0),
      closures: (s.buildup?.closures ?? []).map((x) => `${x.id}(${x.type}${x.commander ? ' · 지휘관' : ''} · ${x.status})`).join(' '),
      read_layer: readLayers?.get(u.key) ?? '', layer: u.layer ?? '',
      recheck: why.join(' · '), rechecked: rechecked ? '다시 봄' : '', reason: j?.reason ?? '',
    };
    row.grade_path = row.from_pos && row.before && row.before !== row.grade ? `${row.before} → ${row.from} ${row.grade}` : row.grade;
    // 감정 기준(X3g) — 판정 입력 ⑧
    const em = s.emotion ?? { moments: [], grade: null, from: null };
    const emPos = em.from ? tickOf(em.from) : '';
    Object.assign(row, {
      emotion: em.grade ?? '', emotion_from: em.from ?? '', emotion_from_pos: emPos && pos && emPos > pos ? emPos : '',
      emotion_moments: em.moments.map((m) => `${m.record} ${m.person.replace('person:', '')} ${m.aspect}(${m.cls})`).join(' · '),
      emotion_done: reviews.some((r) => EMOTION_SESSION.test(r.session ?? '') || r.by === '사용자') ? '다시 봄' : '',
    });
    row.emotion_check = emotionCheck(row, em.grade, row.emotion_from_pos);
    row.emotionList = em.moments;
    row.leadsList = s.leads ?? [];
    units.push(row);
  }
  const pending = units.filter((u) => u.recheck && !u.rechecked);
  // 메인 챕터 자리마다 등급 수 — 그 자리까지 나온 메인 밖 단위
  const chapters = [];
  for (const it of order.items) if (kindOfKey(it.key) === '메인' && !chapters.some((c) => c.key === it.key)) chapters.push({ key: it.key, tick: tickOf(it.key) });
  const atChapters = chapters.map((c) => {
    const counts = Object.fromEntries(GRADES.map((g) => [g, 0]));
    let lower = 0;
    for (const u of units) {
      const g = gradeAt(u, c.tick);
      if (!g) continue;
      counts[g]++;
      if (g !== u.grade) lower++;
    }
    return { ...c, counts, lower };
  });
  // 주역마다 사연이 든 단위(주역 원점 후보) — 무거운 순
  const byLead = new Map();
  for (const u of units) for (const x of u.leadsList) (byLead.get(x.person) ?? byLead.set(x.person, []).get(x.person)).push({ unit: u.unit, grade: u.grade, judgment: u.judgment, deep: x.deep.length, facts: x.facts.length, pos: u.pos });
  for (const xs of byLead.values()) xs.sort((a, b) => b.deep - a.deep || b.facts - a.facts || (a.pos || 0) - (b.pos || 0));
  const emotion = units.filter((u) => u.emotion).map((u) => ({ ...u, moments: u.emotionList }));
  for (const u of units) {
    delete u.leadsList;
    delete u.emotionList;
  }
  return { units, spine: spineRows, pending, emotion, chapters: atChapters, byLead, leadFrom, origins, ticks: rel.ticks.length, layersFile: ds.layers?.name ?? null, spineFile: ds.spine?.name ?? null,
    totals: { units: units.length, spine: spineRows.length, judged: units.filter((u) => u.judgment).length } };
}

/** 사람이 읽는 보고서 */
export function renderImportanceReport(v, { source = '' } = {}) {
  const L = [];
  const n = (f) => v.units.filter(f).length;
  const by = (g) => n((u) => u.grade === g);
  L.push('# 중요도 판정 — 시안 표 (X3)', '');
  L.push(`출처: ${source} + ${v.layersFile ?? '(판정 파일 없음)'}(판정 K) + ${v.spineFile ?? '(척추 파일 없음)'}(척추 B) — 규칙 tools/views/importance.mjs · tools/views/layers.mjs 머리말, 기준 docs/importance.md(판정 카드), 형식 docs/annotations.md "중요도 판정".`);
  L.push('단위 하나의 판정 · 시안 · 판정 입력: `node tools/records.mjs layers <단위 키> [--summary]`. 공개 자리 하나: `node tools/query.mjs grades <ch20>`. 등급을 뒤집기: `node tools/records.mjs set K… 확정 --by 사용자 --grade … --note "…"`.', '');
  const asof = new Map();
  for (const u of v.units) asof.set(u.asof || '없음', (asof.get(u.asof || '없음') ?? 0) + 1);
  L.push(`- 척추 ${v.spine.length}(이벤트 ${v.spine.filter((u) => u.kind === '이벤트').length} · 사이드 ${v.spine.filter((u) => u.kind === '사이드').length} — 채점하지 않는다, 아래 "척추") · 판정 단위 ${v.units.length} — ${GRADES.map((g) => `${g} ${by(g)}`).join(' · ')}${n((u) => !u.grade) ? ` · 판정 없음 ${n((u) => !u.grade)}` : ''}` +
    ` (확신도 추정 ${n((u) => u.confidence === '추정')} · 상태 확정 ${n((u) => u.status === '확정')})`);
  L.push(`- 기준 시점: ${[...asof].sort().map(([d, k]) => `${d} ${k}`).join(' · ')} · 사용자가 뒤집은 판정 ${n((u) => u.by_user)}`);
  L.push(`- 기준 바꿈(X3f) 뒤 다시 본 판정 ${n((u) => u.rechecked)} · 등급이 바뀐 판정 ${n((u) => /→/.test(u.history))} · 메인 자리(from)가 있는 판정 ${n((u) => u.from)}` +
    `(자리에 따라 바뀌는 단위 ${n((u) => u.grade_path !== u.grade)}) · 주역 원점인 단위 ${n((u) => u.lead)}(원점이 정해진 주역 ${v.origins.size}/${v.leadFrom.size}) · **다시 볼 단위 ${v.pending.length}**`, '');

  L.push('## 척추 — 메인 챕터와 함께 채점하지 않는 기준 (X3f-1b · 1c)', '');
  L.push('선정 기준 · 계산: data/views/importance/spine.md(`node tools/views/spine.mjs`). 판정 K는 척추에 들기 전 것 — 척추에서 빼면 판정으로 돌아온다. 뒤집기: `set B… 기각 --by 사용자`.', '');
  L.push('| 자리 | 단위 | 종류 | 문 | 척추 | 판정 K(척추 전) | 층 |', '|---:|---|---|---|---|---|---:|');
  for (const u of v.spine) L.push(`| ${u.order} | \`${u.unit}\` ${u.title} | ${u.kind} | ${u.gate} | ${u.spine} | ${u.judgment} ${u.grade} → 척추 | ${u.layer} |`);
  L.push('');
  L.push('## 종류 × 등급', '', `| 종류 | ${GRADES.join(' | ')} | 다시 볼 단위 |`, `|---|${GRADES.map(() => '---:').join('|')}|---:|`);
  for (const k of KIND_ROWS) {
    const us = v.units.filter((u) => u.kind === k);
    if (!us.length) continue;
    L.push(`| ${k} | ${GRADES.map((g) => us.filter((u) => u.grade === g).length || '').join(' | ')} | ${v.pending.filter((u) => u.kind === k).length || ''} |`);
  }
  L.push(`| 합 | ${GRADES.map((g) => by(g)).join(' | ')} | ${v.pending.length} |`, '');

  L.push('## 판정과 시안', '');
  const cmp = (a, b) => (G[a] ?? 9) - (G[b] ?? 9);
  L.push(`- 시안(2회독 포함)과 같은 등급 ${n((u) => u.grade && u.grade === u.draft)} · 판정이 시안보다 높음 ${n((u) => u.grade && cmp(u.grade, u.draft) < 0)} · 낮음 ${n((u) => u.grade && cmp(u.grade, u.draft) > 0)}` +
    ' — 시안은 출발점일 뿐이다(규칙 tools/views/layers.mjs 머리말 — 참고 시안은 "메인이 말하지 않은 기록인지"를 보지 못한다).');
  const tr = new Map();
  for (const u of v.units) tr.set(`${u.grade} → 시안 ${u.draft}`, (tr.get(`${u.grade} → 시안 ${u.draft}`) ?? 0) + 1);
  L.push(`- 판정 → 시안: ${[...tr].sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ${c}`).join(' · ')}`);
  L.push(`- 판정 입력(X3f): 줄기에 안 묶인 세계 사실이 있는 단위 ${n((u) => u.loose_world)} · 메인 인물 사실 ${n((u) => u.loose_main)} · 주역 사연 ${n((u) => u.leads)} · 생활상 ${n((u) => u.life)}` +
    ` · 메인이 딛는 연결 ${n((u) => u.heavy)}`);
  L.push(`- 빌드업 마무리(X3f-1d — 판정 입력 ⑦, 척추가 쌓음): 긴 회수 · 복선의 답이 있는 단위 ${n((u) => u.buildup)} · 마무리 기록(O)이 끝나는 단위 ${n((u) => u.closures)}` +
    `(확정 ${n((u) => /확정/.test(u.closures))}) — data/views/closures/report.md`, '');

  L.push('## 자리에 따라 바뀌는 단위 (X3f ⑤)', '');
  const moving = v.units.filter((u) => u.grade_path !== u.grade);
  if (!moving.length) L.push('없다 — 메인 자리(from)가 단위보다 뒤인 판정이 아직 없다.', '');
  else {
    L.push('| 자리 | 단위 | 판정 | 등급 (그 앞 → 메인 자리) | 공개 자리 → from 자리 |', '|---:|---|---|---|---|');
    for (const u of moving) L.push(`| ${u.order} | \`${u.unit}\` ${u.title} | ${u.judgment} | ${u.grade_path} | ${u.pos} → ${u.from_pos} |`);
    L.push('');
  }
  L.push('## 메인 챕터 자리마다 등급', '', `그 챕터까지 읽은 사람에게 그때까지 나온 판정 단위(척추 밖)의 등급(공개 자리 ${v.ticks}개 가운데 메인 챕터 자리 — 같은 날은 다 읽은 것으로). "그 앞 등급"은 from 자리 앞이라 아직 낮은 단위 수.`, '');
  L.push(`| 챕터 | 자리 | ${GRADES.join(' | ')} | 그 앞 등급 |`, `|---|---:|${GRADES.map(() => '---:').join('|')}|---:|`);
  for (const c of v.chapters) L.push(`| ${c.key} | ${c.tick} | ${GRADES.map((g) => c.counts[g] || '').join(' | ')} | ${c.lower || ''} |`);
  L.push('');

  L.push('## 다시 볼 묶음 — 기준 바꿈(X3f) 뒤 아직 다시 보지 않은 판정', '');
  if (!v.pending.length) L.push('없다 — 모두 다시 봤다.', '');
  const groupOf = (u) => u.recheck.split(' · ')[0];
  L.push('| 묶음 | 단위 | 뜻 |', '|---|---:|---|');
  for (const [g, what] of RECHECK_GROUPS) {
    const k = v.pending.filter((u) => groupOf(u) === g).length;
    if (k) L.push(`| ${g} | ${k} | ${what} |`);
  }
  L.push('');
  // 주역 원점 — 주역마다
  const leadPending = new Set(v.pending.filter((u) => groupOf(u) === '주역 원점').map((u) => u.unit));
  if (leadPending.size) {
    L.push('### 주역 원점 — 주역마다 사연이 든 단위 (변화 · 사실 순 — 원점 하나를 필수로)', '');
    L.push('원점(origin)이 아직 없는 주역만 — `set Z… 확정 --origin <단위 키>|메인`, 그 단위의 판정은 필수(--from 주역이 되는 챕터 이후).', '', '| 주역 (주역이 되는 챕터) | 단위 — 지금 등급 · 사실 · 변화 |', '|---|---|');
    for (const [p, xs] of [...v.byLead].filter(([p]) => !v.origins.has(p)).sort((a, b) => a[0].localeCompare(b[0]))) {
      L.push(`| ${p.replace('person:', '')} (${v.leadFrom.get(p) ?? '?'}) | ${xs.map((x) => `\`${x.unit}\` ${x.grade} ${x.facts}·${x.deep}`).join(' · ')} |`);
    }
    L.push('');
  }
  for (const [g] of RECHECK_GROUPS) {
    const us = v.pending.filter((u) => groupOf(u) === g);
    if (!us.length) continue;
    L.push(`### ${g} — ${us.length}`, '');
    if (g === '독립 그대로') {
      L.push(us.map((u) => `\`${u.unit}\``).join(' · '), '');
      continue;
    }
    L.push('| 자리 | 단위 | 종류 | 판정 | 시안 | 까닭 | 입력 (척추 연결 1회독 · 2회독 · 딛음 · 암시 · 변화 · 생활상 · 세계 · 척추 인물) |', '|---:|---|---|---|---|---|---|');
    for (const u of us) {
      L.push(`| ${u.order} | \`${u.unit}\` ${u.title} | ${u.kind} | ${u.judgment} ${u.grade}(${u.confidence}) | ${u.draft} | ${u.recheck} | ` +
        `${u.main1} · ${u.main2} · ${u.heavy} · ${u.hints} · ${u.changes} · ${u.life} · ${u.loose_world} · ${u.loose_main} |`);
    }
    L.push('');
  }
  const em = emotionCounts(v);
  L.push('## 감정 기준 후보 (X3g — 판정 입력 ⑧)', '');
  L.push(`결정적 순간 후보가 있는 판정 단위 ${v.emotion.length}(상한 필수 ${em.capMust} · 보강 ${em.capPlus}) · 후보 — 오름 ${em.up.length}(필수로 ${em.up.filter((u) => u.emotion === '필수').length} · 보강으로 ${em.up.filter((u) => u.emotion === '보강').length}) · 이른 자리 ${em.early.length}` +
    ` · 다시 봄 ${em.done.length} · **남음 ${em.left.length}** — 후보 표 data/views/importance/emotion.md(공개 자리 순), 기준 docs/importance.md 3절 "결정적 순간".`, '');
  const changed = v.units.filter((u) => /→/.test(u.history));
  L.push('## 이력 — 등급이 바뀐 판정', '');
  if (!changed.length) L.push('없다.', '');
  else L.push(...changed.map((u) => `- \`${u.unit}\` ${u.judgment}: ${u.history}`), '');
  L.push('## 다시 볼 묶음 (규칙 — tools/views/importance.mjs 머리말)', '', ...RECHECK_GROUPS.map(([g, what]) => `- ${g}: ${what}.`),
    '- 기준 바꿈 뒤 검토 기록(세션 X3f · N3, 또는 사용자)이 있으면 다시 봄 — 목록에서 빠진다. 앞 묶음이 이긴다.', '');
  return L.join('\n');
}

/** 감정 기준 후보 수 — 상한 · 오름 · 이른 자리 · 다시 봄 · 남음 */
function emotionCounts(v) {
  const cand = v.emotion.filter((u) => u.emotion_check);
  return {
    capMust: v.emotion.filter((u) => u.emotion === '필수').length, capPlus: v.emotion.filter((u) => u.emotion === '보강').length,
    up: cand.filter((u) => u.emotion_check === '오름'), early: cand.filter((u) => u.emotion_check === '이른 자리'),
    done: cand.filter((u) => u.emotion_done), left: cand.filter((u) => !u.emotion_done),
  };
}

/** 감정 기준 후보 표(X3g) — 공개 자리 순. X3g-3이 이 표를 나눠 판정한다 */
export function renderEmotionReport(v, { source = '' } = {}) {
  const L = [];
  const em = emotionCounts(v);
  const nm = (p) => String(p).replace(/^\w+:/, '');
  L.push('# 감정 기준 후보 — 결정적 순간 (X3g)', '');
  L.push(`출처: ${source} + 2회독 인물 변화 D · 마무리 기록 O · 주요 인물 명단(annotations/majors.json) — 거르기 규칙 tools/views/layers.mjs emotionSignals(판정 입력 ⑧), 기준 docs/importance.md 3절 "결정적 순간".`);
  L.push('결정적인지 · 여기에만 장면으로인지는 판정이 기록 문장으로 본다 — 이 표는 고르지 않는다. 단위 하나: `node tools/records.mjs layers <단위 키> --summary`(⑧ "감정 재료" 줄).', '');
  L.push(`- 결정적 순간 후보가 있는 판정 단위 ${v.emotion.length} — 상한 필수(주요 인물) ${em.capMust} · 보강(척추 인물만) ${em.capPlus}`);
  L.push(`- 후보 ${em.up.length + em.early.length}: 오름 ${em.up.length}(필수로 ${em.up.filter((u) => u.emotion === '필수').length} · 보강으로 ${em.up.filter((u) => u.emotion === '보강').length}) · 이른 자리 ${em.early.length}(같은 등급, 감정 쪽 from이 이르다)` +
    ` · 다시 봄(세션 X3g · N3 · 사용자) ${em.done.length} · **남음 ${em.left.length}**`);
  const tr = new Map();
  for (const u of em.up) tr.set(`${u.grade} → ${u.emotion}`, (tr.get(`${u.grade} → ${u.emotion}`) ?? 0) + 1);
  L.push(`- 오름 — 지금 등급 → 상한: ${[...tr].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}`);
  const kinds = new Map();
  for (const u of [...em.up, ...em.early]) kinds.set(u.kind, (kinds.get(u.kind) ?? 0) + 1);
  L.push(`- 후보 종류: ${[...kinds].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}`);
  const who = new Map();
  for (const u of [...em.up, ...em.early]) for (const p of new Set(u.moments.filter((m) => m.grade === u.emotion).map((m) => nm(m.major ?? m.person)))) who.set(p, (who.get(p) ?? 0) + 1);
  L.push(`- 후보의 주인(상한을 낸 인물 — 단위 수): ${[...who].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p, n]) => `${p} ${n}`).join(' · ') || '없음'}`, '');
  L.push('## 후보 — 공개 자리 순', '');
  L.push('상한 = 그 단위의 결정적 순간 후보 가운데 가장 높은 등급(주요 인물 필수 · 척추 인물 보강)과 그 등급에 처음 닿는 자리. 판정은 이해 등급과 둘 가운데 높은 쪽(카드 3절 3a · 4a).', '');
  L.push('| 공개 자리 | 단위 | 종류 | 지금 판정 | 상한 | 까닭 | 결정적 순간 후보 (주인 · 측면) | 다시 봄 |', '|---:|---|---|---|---|---|---|---|');
  const cand = [...em.up, ...em.early].sort((a, b) => (a.pos || 0) - (b.pos || 0) || a.order - b.order);
  for (const u of cand) {
    const ms = u.moments.map((m) => `${m.record} ${nm(m.person)} ${m.aspect}${m.cls === '주요 인물' ? '*' : ''}`).join(' · ');
    L.push(`| ${u.pos} | \`${u.unit}\` ${u.title} | ${u.kind} | ${u.judgment} ${u.grade_path}${u.from && !u.from_pos ? `(${u.from})` : ''} | ${u.emotion}${u.emotion_from ? ` · ${u.emotion_from}부터` : ''} | ${u.emotion_check} | ${ms} | ${u.emotion_done} |`);
  }
  L.push('', '`*` = 주요 인물의 것. 결정적 순간 후보가 있지만 상한이 지금 등급 이하인 단위(후보 아님):', '');
  const rest = v.emotion.filter((u) => !u.emotion_check).sort((a, b) => (a.pos || 0) - (b.pos || 0));
  L.push(rest.map((u) => `\`${u.unit}\` ${u.grade}`).join(' · ') || '없음', '');
  return L.join('\n');
}

function csvCell(x) {
  const s = x == null ? '' : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

export function writeImportanceViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'units.csv'), toCsv(v.units, COLUMNS));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderImportanceReport(v, opts));
  fs.writeFileSync(path.join(outDir, 'emotion.md'), renderEmotionReport(v, opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({ options: { example: { type: 'boolean' } } });
  const dir = opt.example ? EXAMPLE_DIR : READ1_DIR;
  const ds = loadDataset({ dir });
  if (ds.problems.length) {
    for (const p of ds.problems) console.error(`✗ ${p.file}: ${p.msg}`);
    process.exit(1);
  }
  const ctx = await openContext();
  const v = buildImportance(ds, ctx, loadOrder(), { readLayers: opt.example ? null : loadReadLayers() });
  ctx.close();
  const source = displayPath(dir) + '/';
  if (opt.example) console.log(renderImportanceReport(v, { source }));
  else {
    writeImportanceViews(v, IMPORTANCE_DIR, { source });
    console.log(`→ ${displayPath(IMPORTANCE_DIR)}/ (units.csv · report.md · emotion.md)`);
  }
  console.log(`메인 밖 ${v.units.length} · 판정 ${v.totals.judged} · 다시 볼 단위 ${v.pending.length}`);
}
