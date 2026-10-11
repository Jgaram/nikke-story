/**
 * 시점별 판(W15c) — 떡밥 제목 · 요약을 "어느 스토리까지 본 사람에게 무엇을 보이나"로 여럿 쓴다. 형식과 쓰는 기준은 docs/annotations.md "시점별 판".
 * CLI는 tools/versions.mjs. 떡밥 줄기의 title · text(annotations/threads.json)는 결말을 아는 자리에서 쓴 분석용 이름이라 그대로 두고, 화면은 판을 보인다.
 *
 * 파일 = annotations/versions/<대상 파일 이름>.json — { subject: 'thread:J1', versions: [판 …] }. 판은 읽는 순서대로
 *   { at, title, text, src, session, by, date, status, reviews[] }
 *   at   = 이 판이 보이기 시작하는 스토리(단위 키). 화면은 앞 판들의 at까지 다 본(seen) 판 가운데 가장 뒤 판을 고른다(fmt.versionAt) —
 *          체크 칸 스토리(척추 이벤트 · 사이드 · 준필수)를 안 고른 독자는 그 at의 판에서 멈춘다(뒤 판은 앞 판들의 내용 위에 쓴다).
 *          첫 판의 at은 그 떡밥이 처음 나온 스토리(threads.json first_unit) — 그 앞에서는 떡밥이 '아직 나오지 않음'.
 *   src  = 쓸 때 본 떡밥 흐름의 지문 — at까지(읽는 순서) 떡밥이 움직인 자리(threads-flow.json points · echoes의 기록 · 단계 · 스토리).
 *          기록이 바뀌어(2회독 바로잡기 · 신작) at 앞의 흐름이 달라지면 '낡음' — 내보내기가 그 판부터 빼고 화면은 그 앞 판으로 돌아간다(덜 아는 쪽이라 새지 않는다).
 * 글은 at까지의 스토리 내용만 — 뒤 스토리 이름(laterNames) · at 뒤에 처음 나오는 대상 이름(targets.json meet · name_meet · 다른 이름 meet)은 오류.
 * 사전 설명(W15e)도 같은 꼴 — subject가 비인물 대상 ID(place:방주 · org:… · concept:… · incident:… · item:…)이고 판은 { at, text, … }(제목 없음 —
 *   이름은 W15b fmt.nameAt이 고른다). 첫 판의 at = 항목이 처음 나온 자리(targets.json meet의 마지막 — 체크 칸이 아닌 첫 스토리),
 *   src = at까지 항목을 다룬 기록(about)의 [기록, 단위]. 화면은 fmt.noteAt.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, fileNameFor } from '../records/model.mjs';
import { COMMON_WORDS } from '../synopsis/model.mjs';
import { laterNames, textProblems, titledUnit } from '../blurbs/model.mjs';

export const VERSION_DIR = path.join(ROOT, 'annotations/versions');
export const SITE_DATA = path.join(ROOT, 'site/data');
export const SUBJECTS = { thread: '떡밥', concept: '사전', incident: '사전', item: '사전', org: '사전', place: '사전' };
/** 사전 설명 대상 종류(W15e) — 세계 탭 항목 */
export const DICT_KINDS = new Set(['concept', 'incident', 'item', 'org', 'place']);
export const STATUSES = ['후보', '확정', '기각'];
export const DECIDERS = ['claude']; // 실무는 Claude만 — 사용자는 기준에 피드백(CLAUDE.md "일하는 법")

export const LIMITS = {
  title: [2, 30], // 권장 글자 수(벗어나면 경고) — '퍼펙트' 같은 짧은 이름도 된다
  titleMax: 40, // 넘으면 오류
  text: [25, 120],
  textMax: 200, // 줄기 text와 같은 상한(docs/annotations.md "떡밥 줄기")
  sentences: 2,
  versions: 6, // 넘으면 경고 — 판은 떡밥의 큰 고비에서만 나눈다
};
/** 사전 설명(W15e) — 지금 분석용 설명이 중앙값 43자 · 가장 긴 것 108자 */
export const DICT_LIMITS = { text: [10, 100], textMax: 160, sentences: 2, versions: 4 };

const arr = (x) => (Array.isArray(x) ? x : []);
const sha = (v) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 10);

export const versionPath = (subject, dir = VERSION_DIR) => path.join(dir, fileNameFor(subject));
export const subjectKind = (subject) => String(subject ?? '').split(':')[0];
export const threadId = (subject) => (subjectKind(subject) === 'thread' ? String(subject).slice('thread:'.length) : null);
export const isDict = (subject) => DICT_KINDS.has(subjectKind(subject));
/** 사전 항목이 처음 나온 자리 — meet의 마지막(체크 칸이 아닌 첫 스토리 — 그 앞 체크 칸을 안 골라도 여기서는 만난다). meet가 없으면 null */
export const dictFirst = (t) => (Array.isArray(t?.meet) && t.meet.length ? t.meet.at(-1) : null);

/** 떡밥이 움직인 자리 — threads-flow.json 줄기의 roots[].points · echoes를 읽는 순서로 [{ r, s, u, o }] */
export function flowPoints(flow) {
  const out = [];
  for (const root of arr(flow?.roots)) for (const p of arr(root.points)) out.push({ r: p.r, s: p.s, u: p.u, o: p.o, root: root.id, a: p.a });
  for (const p of arr(flow?.echoes)) out.push({ r: p.r, s: p.s, u: p.u, o: p.o, root: null });
  return out.sort((a, b) => (a.o ?? 1e9) - (b.o ?? 1e9) || String(a.r).localeCompare(String(b.r)));
}

/** 사전 항목을 다룬 기록(about) — 읽는 순서로 [{ r, u, o, rec }] */
export function dictRecords(id, C) {
  const out = [];
  for (const rec of arr(C.aboutOf?.get(id))) {
    const o = C.units.get(rec.unit)?.order;
    if (o != null) out.push({ r: rec.id, u: rec.unit, o, rec });
  }
  return out.sort((a, b) => a.o - b.o || String(a.r).localeCompare(String(b.r), 'en', { numeric: true }));
}

/** 판 지문 — at까지(읽는 순서 order 이하) 떡밥이 움직인 자리 · 사전 항목을 다룬 기록. at이 없는 단위면 null */
export function srcHash(subject, at, C) {
  const me = C.units.get(at)?.order;
  if (isDict(subject)) return me == null || !C.targetMap?.has(subject) ? null : sha(dictRecords(subject, C).filter((p) => p.o <= me).map((p) => [p.r, p.u]));
  const id = threadId(subject);
  if (!id || me == null || !C.flow[id]) return null;
  return sha(flowPoints(C.flow[id]).filter((p) => p.o != null && p.o <= me).map((p) => [p.r, p.s, p.u]));
}

/** 내용 지문 — 확정한 뒤 판(자리 · 제목 · 요약 · 지문)이 바뀌었는지 본다 */
export const contentHash = (v) => sha([v?.at ?? '', v?.title ?? '', v?.text ?? '', v?.src ?? '', ...(v?.side ? ['side', v.until ?? ''] : [])]); // 곁 판 칸은 있을 때만(W15f — 옛 지문 그대로)

/** 판 하나의 상태 — changed = 확정 뒤 고침, stale = 쓴 뒤 at 앞의 흐름이 바뀜. 내보내기는 ok만 */
export function stateOf(v, cur) {
  const reviews = arr(v?.reviews);
  const lastConfirm = [...reviews].reverse().find((r) => r?.decision === '확정') ?? null;
  const hash = contentHash(v);
  const changed = v?.status === '확정' && (!lastConfirm || lastConfirm.hash !== hash);
  const stale = cur == null || v?.src !== cur;
  return { status: v?.status ?? '후보', hash, changed, stale, ok: v?.status === '확정' && !changed && !stale };
}

/**
 * 원본 — 사이트 데이터(내보낸 것). 내보내기는 파일을 다시 읽지 않고 sourcesFrom을 부른다.
 * @returns {{ units: Map, threads: Map, flow: object, targets: object[], names: Map<string, {order, unit, target}>, sameAs: object[] }}
 */
export function loadSources(dir = SITE_DATA) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return sourcesFrom({
    units: read('units.json'), threads: read('threads.json'), flow: read('threads-flow.json'), targets: read('targets.json'), records: [...read('records.json'), ...read('records2.json')],
  });
}

/** records = 확정 기록(records.json + records2.json) — 사전 판의 지문 · 입력에 쓴다(없으면 사전 판은 지문이 빈 목록) */
export function sourcesFrom({ units: unitList, threads, flow, targets, records = [] }) {
  const units = new Map(arr(unitList).map((u) => [u.key, u]));
  const C = { units, threads: new Map(arr(threads?.threads).map((t) => [t.id, t])), flow: flow ?? {}, targets: arr(targets) };
  C.targetMap = new Map(C.targets.map((t) => [t.id, t]));
  C.names = nameIndex(C.targets, units);
  C.nameUnits = nameUnits(C.targets);
  // 체크 칸 스토리(사이트 state.checkable과 같다 — 메인이 아니고 척추이거나 준필수) · 제목으로 불리는 스토리(같은 제목은 묶어서)
  C.checkable = new Set([...units.values()].filter((u) => u.kind !== 'main' && (u.spine || u.grade === '필수')).map((u) => u.key));
  C.titled = new Map();
  for (const u of units.values()) if (titledUnit(u)) (C.titled.get(u.title) ?? C.titled.set(u.title, []).get(u.title)).push(u.key);
  C.aboutOf = new Map();
  for (const r of arr(records)) for (const id of arr(r?.about)) if (DICT_KINDS.has(subjectKind(id))) (C.aboutOf.get(id) ?? C.aboutOf.set(id, []).get(id)).push(r);
  return C;
}

/**
 * 이름 → 처음 쓰인 자리(W15b 처음 나온 자리 — 화면이 이름을 보이기 시작하는 곳). 같은 이름을 여러 대상이 쓰면 가장 앞.
 * 표준명은 name_meet(표준명이 늦게 나오는 대상) 또는 meet, 다른 이름은 제 meet(없으면 표준명과 같이), never(쓰인 곳 없음)는 끝까지 모름.
 */
export function nameIndex(targets, units) {
  const out = new Map();
  const first = (keys) => {
    let best = null;
    for (const k of arr(keys)) {
      const o = units.get(k)?.order;
      if (o != null && (!best || o < best.order)) best = { order: o, unit: k };
    }
    return best;
  };
  const put = (name, at, target) => {
    const n = String(name ?? '').trim();
    if ([...n].length < 2 || /^[?？…\s]+$/.test(n)) return;
    const v = at ? { ...at, target } : { order: Infinity, unit: null, target };
    const cur = out.get(n);
    if (!cur || v.order < cur.order) out.set(n, v);
  };
  for (const t of targets) {
    const met = first(t.meet);
    const named = t.name_never ? null : t.name_meet ? first(t.name_meet) : met;
    put(t.name, named, t.id);
    for (const a of arr(t.aliases)) put(a.name, a.never ? null : a.meet ? first(a.meet) : named, t.id);
  }
  return out;
}

/**
 * 그 자리 뒤에 처음 쓰이는 대상 이름 — 글에 들었나. 스포일러 이름 검사(synopsis spoilerProblems)와 같은 빼기:
 * 앞에 나온 더 긴 이름 · 흔한 낱말 안에 든 것, 앞이 한글 음절이라 낱말 속 글자인 것, 영문 낱말 속 글자인 것, 두 글자 한글 이름 뒤에 조사가 아닌 글자가 붙은 것.
 * @returns {string[]} '모더니아(CH.06에서 처음)' 꼴
 */
export function lateNames(text, order, names, units) {
  const t = String(text ?? '');
  const early = [];
  const late = [];
  // 그 자리까지의 스토리 제목에 든 이름은 독자가 제목으로 안다(W15f — 대사에 늦게 쓰여도 오류 아님. 체크 칸 스토리 제목은 need가 본다)
  const titles = [...(units?.values?.() ?? [])].filter((u) => u.order != null && u.order <= order && u.title).map((u) => u.title);
  for (const [name, f] of names) (f.order > order && !titles.some((x) => x.includes(name)) ? late : early).push(name);
  const covered = [];
  for (const name of [...early, ...COMMON_WORDS]) for (let i = t.indexOf(name); i >= 0; i = t.indexOf(name, i + 1)) covered.push([i, i + name.length]);
  const hits = [];
  for (const name of late) {
    for (let i = t.indexOf(name); i >= 0; i = t.indexOf(name, i + 1)) {
      if (covered.some(([a, b]) => a <= i && i + name.length <= b && b - a > name.length)) continue;
      if (i > 0 && /[가-힣]/.test(t[i - 1]) && /^[가-힣]/.test(name)) continue;
      if (/^[A-Za-z]/.test(name) && (/[A-Za-z]/.test(t[i - 1] ?? '') || /[A-Za-z]/.test(t[i + name.length] ?? ''))) continue;
      // 두 글자 한글 이름은 뒤가 낱말 끝 · 조사일 때만('리스크'의 '리스' · '사라진'의 '사라'는 아니다 — spoiler-check findWord와 같은 규칙)
      if ([...name].length === 2 && /[가-힣]$/.test(name) && /[\p{L}\p{N}]/u.test(t[i + name.length] ?? '') && !/[은는이가을를의와과도만에께한로으랑야아씨님들]/u.test(t[i + name.length])) continue;
      const f = names.get(name);
      hits.push(`${name}(${f.unit ? `${units.get(f.unit)?.title ?? f.unit}에서 처음` : '쓰인 곳 없음'})`);
      break;
    }
  }
  return hits;
}

/**
 * 이름 → 그 이름을 아는 스토리 전부(W15f — 판의 need). 표준명은 name_meet 또는 meet, 다른 이름은 제 meet(없으면 표준명과 같이), never는 없음([]).
 * 같은 이름을 여러 대상이 쓰면 합친다(어느 쪽이든 그 낱말을 안다).
 */
export function nameUnits(targets) {
  const out = new Map();
  const put = (name, keys) => {
    const n = String(name ?? '').trim();
    if ([...n].length < 2 || /^[?？…\s]+$/.test(n)) return;
    const s = out.get(n) ?? out.set(n, new Set()).get(n);
    for (const k of arr(keys)) s.add(k);
  };
  for (const t of arr(targets)) {
    const named = t.name_never ? [] : t.name_meet ?? t.meet ?? [];
    put(t.name, named);
    for (const a of arr(t.aliases)) put(a.name, a.never ? [] : a.meet ?? named);
  }
  return out;
}

/**
 * 글에 든 대상 이름 — lateNames와 같은 낱말 규칙(더 긴 이름 · 흔한 낱말 속, 앞이 한글 음절, 영문 낱말 속, 두 글자 한글 이름 뒤 조사 아닌 글자는 아님).
 * @param {Iterable<string>} names
 * @returns {string[]}
 */
export function namesIn(text, names) {
  const t = String(text ?? '');
  const list = [...names].filter((n) => t.includes(n)).sort((a, b) => b.length - a.length);
  const covered = [];
  for (const w of COMMON_WORDS) for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + 1)) covered.push([i, i + w.length]);
  const hits = [];
  for (const name of list) {
    let hit = false;
    for (let i = t.indexOf(name); i >= 0; i = t.indexOf(name, i + 1)) {
      if (covered.some(([a, b]) => a <= i && i + name.length <= b && b - a > name.length)) continue;
      if (i > 0 && /[가-힣]/.test(t[i - 1]) && /^[가-힣]/.test(name)) continue;
      if (/^[A-Za-z]/.test(name) && (/[A-Za-z]/.test(t[i - 1] ?? '') || /[A-Za-z]/.test(t[i + name.length] ?? ''))) continue;
      if ([...name].length === 2 && /[가-힣]$/.test(name) && /[\p{L}\p{N}]/u.test(t[i + name.length] ?? '') && !/[은는이가을를의와과도만에께한로으랑야아씨님들]/u.test(t[i + name.length])) continue;
      covered.push([i, i + name.length]);
      hit = true;
    }
    if (hit) hits.push(name);
  }
  return hits;
}

/**
 * 판을 보려면 봐야 하는 스토리 묶음(W15f) — 글(제목 · 요약)에 든 대상 이름 · 스토리 이름마다 '그것을 아는 스토리' 묶음, 판의 at들만 보고
 * 체크 칸 스토리(척추 이벤트 · 사이드 · 준필수 — 게임에서 아무 때나 본다)를 안 고른 독자도 늘 아는 묶음은 뺀다.
 * lateNames는 읽는 순서로만 재서, 앞 체크 칸 스토리에서만 먼저 쓰인 이름(J1 GODDESS FALL 판의 '퀸 인자' ← LAST KINGDOM)을 놓친다 — 화면 fmt.versionAt이 이것으로 멈춘다.
 * @param {string[]} texts 판의 제목 · 요약
 * @param {string[]} ats 이 판을 보는 독자가 늘 본 at들 — 앞 본판들 + 이 판(곁 판은 제 at만 더한다)
 * @param {{ units: Map, nameUnits: Map, checkable: Set }} C
 * @returns {string[][] | undefined} 묶음마다 스토리 키(하나라도 보면 됨) — 없으면 undefined
 */
export function versionNeed(texts, ats, C) {
  const chain = new Set(ats);
  const floor = Math.max(1, ...ats.filter((k) => !C.checkable.has(k)).map((k) => C.units.get(k)?.tick ?? 0));
  const sure = (k) => chain.has(k) || (!C.checkable.has(k) && (C.units.get(k)?.tick ?? Infinity) <= floor);
  const groups = new Map();
  const add = (keys) => {
    const g = [...new Set(keys)].filter((k) => C.units.has(k));
    if (g.some(sure)) return;
    g.sort((a, b) => (C.units.get(a).order ?? 0) - (C.units.get(b).order ?? 0));
    groups.set(g.join(' '), g);
  };
  for (const text of texts) {
    for (const n of namesIn(text, C.nameUnits.keys())) add([...C.nameUnits.get(n)]);
    for (const m of String(text ?? '').matchAll(/CH\.(\d+)/g)) add([`ch${m[1].padStart(2, '0')}`]);
    for (const [title, keys] of C.titled) if (String(text ?? '').includes(title)) add(keys);
  }
  return groups.size ? [...groups.values()] : undefined;
}

/** 정체 연결(same_as)이 드러나기 전에 두 이름을 한 글에 같이 썼나 — 경고(같은 인물이라는 말이 없으면 괜찮을 수 있다) */
function sameAsEarly(text, order, C) {
  const out = [];
  for (const t of C.targets) {
    arr(t.same_as).forEach((other, i) => {
      if (t.id > other) return;
      const reveal = C.units.get(arr(t.same_as_unit)[i])?.order;
      const o = C.targets.find((x) => x.id === other);
      if (reveal == null || reveal <= order || !o) return;
      if (String(text).includes(t.name) && String(text).includes(o.name)) out.push(`${t.name} · ${o.name}(같은 인물이라는 것은 ${C.units.get(t.same_as_unit[i])?.title ?? '뒤'}에서 드러난다)`);
    });
  }
  return out;
}

/**
 * 파일 하나 검사 — 원문 없이 되는 것 전부(칸 · 자리 · 길이 · 금지 꼴 · 뒤 스토리 이름 · 뒤 대상 이름 · 지문). 원문 겹침 · DB 이름 경고는 CLI가.
 * @param {object} f 파일 내용 { subject, versions }
 * @param {ReturnType<typeof sourcesFrom>} C
 * @returns {{ errors: string[], warnings: string[] }} 판 메시지 앞에 '판 <at>:'
 */
export function checkFile(f, C) {
  const errors = [];
  const warnings = [];
  const kind = subjectKind(f?.subject);
  if (!(kind in SUBJECTS)) return { errors: [`모르는 대상 — ${f?.subject} (${Object.keys(SUBJECTS).map((k) => `${k}:…`).join(' · ')})`], warnings };
  const S = specOf(f.subject, C);
  if (S.error) return { errors: [S.error], warnings };
  for (const k of Object.keys(f)) if (!['subject', 'versions', 'no_side'].includes(k)) errors.push(`모르는 칸 — ${k}`);
  // no_side(W15f) — 곁 판 후보 경고를 검토해 '필요 없음'으로 정한 체크 칸 스토리 { <단위>: 이유 }
  const noSide = f.no_side ?? {};
  if (typeof noSide !== 'object' || Array.isArray(noSide)) errors.push('no_side는 { 단위: 이유 }');
  else for (const [k, why] of Object.entries(noSide)) if (!C.units.has(k) || typeof why !== 'string' || !why.trim()) errors.push(`no_side ${k}: 단위 · 이유가 있어야 한다`);
  const vs = arr(f.versions);
  if (!vs.length) return { errors: [...errors, '판이 없다'], warnings };
  if (vs.length > S.limits.versions) warnings.push(`판이 ${vs.length}개 — 큰 고비에서만 나눈다(${S.limits.versions}개 안쪽)`);
  const { first, lastOrder, moved } = S;
  const live = vs.filter((v) => v?.status !== '기각' && !v?.side); // 곁 판(side — W15f)은 첫 판 규칙 밖
  if (first && live[0] && live[0].at !== first) errors.push(`첫 판의 at은 ${S.firstWhat}(${first} ${C.units.get(first)?.title ?? ''})여야 한다 — 지금 ${live[0].at}`);
  let prev = null;
  const ats = new Set();
  for (const [i, v] of vs.entries()) {
    const where = `판 ${v?.at ?? i + 1}`;
    const E = (m) => errors.push(`${where}: ${m}`);
    const W = (m) => warnings.push(`${where}: ${m}`);
    if (!v || typeof v !== 'object') { E('판이 객체가 아니다'); continue; }
    for (const k of ['at', 'session', 'by', 'date', 'src']) if (typeof v[k] !== 'string' || !v[k]) E(`${k}가 없다`);
    if (!STATUSES.includes(v.status)) E(`status는 ${STATUSES.join(' · ')} 가운데 하나`);
    const u = C.units.get(v.at);
    if (v.at && !u) { E(`at이 단위가 아니다 — ${v.at}`); continue; }
    if (ats.has(v.at)) E('같은 at의 판이 둘');
    ats.add(v.at);
    // 곁 판(W15f) — 체크 칸 스토리에서만 드러난 것을 그 칸을 본 독자에게만. 안 본 독자는 건너뛰고(멈추지 않는다), 본 독자는 until(뒤 본판의 at — 그 내용을 다 담는 판)까지 이것을 본다
    if ('side' in v && v.side !== true) E('side는 true만');
    if (v.side && u && C.checkable && !C.checkable.has(v.at)) E('곁 판(side)은 체크 칸 스토리(척추 이벤트 · 사이드 · 준필수)에만');
    if ('until' in v && !v.side) E('until은 곁 판에만');
    if (v.side && v.until != null) {
      const w = vs.find((x) => x?.at === v.until && !x.side && x.status !== '기각');
      if (!w || (C.units.get(w.at)?.order ?? -1) <= (u?.order ?? Infinity)) E(`until은 뒤 본판의 at이어야 한다 — ${v.until}`);
    }
    if (prev && u && u.order <= prev.order) E(`판은 읽는 순서대로 — 앞 판(${prev.key})보다 뒤여야 한다`);
    if (u && u.order > lastOrder) E(`떡밥이 마지막으로 움직인 스토리(${S.last}) 뒤다`);
    if (u && !moved.has(v.at)) W(S.unmoved);
    if (u) prev = u;
    const cur = srcHash(f.subject, v.at, C);
    if (cur && v.src !== cur && v.status !== '기각') W(`쓴 뒤 이 자리까지의 ${S.dict ? '항목을 다룬 기록' : '떡밥 흐름'}이 바뀌었다(낡음 — 화면은 앞 판) — 입력을 다시 보고 고쳐 \`new … --refresh\` 뒤 확정`);
    const ctx = { part: 'versions', unit: v.at, units: C.units, laterHint: '판의 글은 at까지의 스토리 내용만' };
    if (S.dict && typeof v.title === 'string' && v.title.trim()) E('사전 판에는 title을 두지 않는다 — 이름은 W15b(fmt.nameAt)가 고른다');
    for (const [k, range, max, sentences] of S.fields) {
      const s = typeof v[k] === 'string' ? v[k].trim() : '';
      if (!s) { (v.status === '확정' ? E : W)(`${k}가 비었다`); continue; }
      const r = textProblems(s, { ...ctx, range, max, sentences });
      r.errors.forEach((m) => E(`${k}: ${m}`));
      r.warnings.forEach((m) => W(`${k}: ${m}`));
      if (u) {
        const late = lateNames(s, u.order, C.names, C.units);
        if (late.length) E(`${k}: 이 자리 뒤에 처음 쓰이는 이름 — ${late.join(' · ')}`);
        const same = sameAsEarly(s, u.order, C);
        if (same.length) W(`${k}: 정체가 드러나기 전에 두 이름을 함께 — ${same.join(' · ')}`);
      }
    }
    if (k2(vs[i - 1]) && k2(vs[i - 1]) === k2(v)) W('앞 판과 제목 · 요약이 같다 — 판을 나눌 까닭이 없다');
    const st = stateOf(v, cur);
    if (st.changed) E(`확정한 뒤 판이 바뀌었다 — 다시 검토해 확정 (마지막 확정 지문 ${arr(v.reviews).filter((r) => r?.decision === '확정').at(-1)?.hash ?? '없음'} · 지금 ${st.hash})`);
    for (const [j, r] of arr(v.reviews).entries()) {
      if (!STATUSES.includes(r?.decision)) E(`reviews[${j}]: decision이 이상하다`);
      if (!DECIDERS.includes(r?.by)) E(`reviews[${j}]: by는 ${DECIDERS.join(' · ')}`);
    }
  }
  // 곁 판 후보(W15f) — 첫 본판 앞 체크 칸 스토리에 이 항목의 사실 기록이 있는데 판이 없다: 그 칸을 본 독자는 이름만 보고 설명은 빈다.
  // 찾기는 자동, 쓰기는 손으로 — 곁 판(new --at <단위> --side)을 쓰거나, 필요 없으면 no_side에 이유를 적는다
  if (S.dict && C.checkable && live[0] && noSide && typeof noSide === 'object') {
    const firstOrder = C.units.get(live[0].at)?.order ?? Infinity;
    const has = new Set(vs.filter((v) => v?.status !== '기각').map((v) => v?.at));
    const cand = new Map();
    for (const p of dictRecords(f.subject, C)) {
      if (p.o >= firstOrder || !C.checkable.has(p.u) || has.has(p.u) || noSide[p.u] || p.rec?.kind !== 'F') continue;
      (cand.get(p.u) ?? cand.set(p.u, []).get(p.u)).push(p.r);
    }
    for (const [u, rs] of cand) warnings.push(`곁 판 후보: ${u}(${C.units.get(u)?.title ?? ''} — 체크 칸)에 사실 기록 ${rs.join(' · ')} — 곁 판을 쓰거나(new --at ${u} --side) 필요 없으면 no_side에 이유`);
  }
  return { errors, warnings };
}
const k2 = (v) => (v ? `${v.title ?? ''}\u0000${v.text ?? ''}` : '');

/**
 * 대상 종류별 검사 틀 — 첫 판 자리 · 마지막 자리 · 움직인 스토리 · 글 칸 · 한도.
 * 떡밥: 첫 판 = first_unit, 마지막 = last_unit, 움직임 = 흐름(points · echoes). 사전: 첫 판 = 처음 나온 자리(dictFirst), 마지막 없음, 움직임 = 다룬 기록이 있는 스토리 · meet.
 */
function specOf(subject, C) {
  const kind = subjectKind(subject);
  if (DICT_KINDS.has(kind)) {
    const t = C.targetMap?.get(subject);
    if (!t) return { error: `사전 항목이 없다 — ${subject}` };
    const first = dictFirst(t);
    if (!first) return { error: `처음 나온 자리(meet)가 없는 항목 — 판을 둘 수 없다(전부 보기에서만 분석용 설명) — ${subject}` };
    return {
      dict: true, first, firstWhat: '항목이 처음 나온 자리(meet의 마지막 — 체크 칸이 아닌 첫 스토리)', lastOrder: Infinity, last: null,
      moved: new Set([...dictRecords(subject, C).map((p) => p.u), ...arr(t.meet)]),
      unmoved: '이 스토리에서 항목을 다룬 기록이 없다 — 판은 항목에 대해 새로 알게 되는 자리에서 나눈다',
      limits: DICT_LIMITS, fields: [['text', DICT_LIMITS.text, DICT_LIMITS.textMax, DICT_LIMITS.sentences]],
    };
  }
  const id = threadId(subject);
  const th = C.threads.get(id);
  if (!th) return { error: `떡밥이 없다 — ${id}` };
  return {
    dict: false, first: th.first_unit, firstWhat: '떡밥이 처음 나온 스토리', lastOrder: C.units.get(th.last_unit)?.order ?? Infinity, last: th.last_unit,
    moved: new Set(flowPoints(C.flow[id]).map((p) => p.u)),
    unmoved: '이 스토리에서 떡밥이 움직이지 않는다(제기 · 회수 · 암시가 없다) — 판은 움직인 자리에서 나눈다',
    limits: LIMITS, fields: [['title', LIMITS.title, LIMITS.titleMax, null], ['text', LIMITS.text, LIMITS.textMax, LIMITS.sentences]],
  };
}

/**
 * 파일 전부. 이름이 `_`로 시작하면 뺀다.
 * @returns {{ list: {file, path, data}[], bySubject: Map<string, object>, problems: {file, msg}[] }}
 */
export function loadVersions(dir = VERSION_DIR) {
  const list = [];
  const problems = [];
  const bySubject = new Map();
  if (!fs.existsSync(dir)) return { list, bySubject, problems };
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
    const p = path.join(dir, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (err) {
      problems.push({ file: f, msg: `JSON이 깨졌다 — ${err.message}` });
      continue;
    }
    const item = { file: f, path: p, data };
    list.push(item);
    if (typeof data?.subject !== 'string') problems.push({ file: f, msg: 'subject가 없다' });
    else if (bySubject.has(data.subject)) problems.push({ file: f, msg: `같은 대상의 파일이 둘 — ${bySubject.get(data.subject).file}` });
    else if (f !== fileNameFor(data.subject)) problems.push({ file: f, msg: `파일 이름이 대상과 다르다 — ${fileNameFor(data.subject)}` });
    else bySubject.set(data.subject, item);
  }
  return { list, bySubject, problems };
}

/**
 * 화면에 싣는 판 — 앞에서부터 확정 · 고치지 않음 · 낡지 않음 · 검사 오류 없는 판이 이어지는 데까지 [{ at, title, text }](읽는 순서). 기각한 판은 건너뛴다.
 * 성하지 않은 판에서 끊는다 — 뒤 판은 앞 판들의 내용 위에 쓰므로(화면은 앞 판들의 at을 다 봐야 뒤 판을 보인다 — fmt.versionAt) 중간이 빠지면 뒤도 싣지 않는다.
 * 빠진 판은 화면이 그 앞 판을 보인다(덜 아는 쪽이라 새지 않는다).
 */
export function publishable(f, C) {
  const { errors } = checkFile(f, C);
  const bad = new Set(errors.map((m) => /^판 ([^:]+):/.exec(m)?.[1]).filter(Boolean));
  const fileBad = errors.some((m) => !m.startsWith('판 '));
  if (fileBad) return { list: [], errors };
  const list = [];
  for (const v of arr(f.versions)) {
    if (v?.status === '기각') continue;
    const ok = stateOf(v, srcHash(f.subject, v.at, C)).ok && !bad.has(v.at);
    if (!ok && v.side) continue; // 곁 판은 빠져도 본판 줄기는 이어진다
    if (!ok) break;
    const side = v.side ? { side: true, ...(v.until ? { until: v.until } : {}) } : {};
    list.push(isDict(f.subject) ? { at: v.at, text: v.text.trim(), ...side } : { at: v.at, title: v.title.trim(), text: v.text.trim(), ...side });
  }
  return { list, errors };
}

/** 겹침 · 스포일러 검사용 글 — [[어디, 글, at]] */
export const shownTexts = (f) => arr(f?.versions).flatMap((v) => ['title', 'text'].filter((k) => typeof v?.[k] === 'string' && v[k].trim()).map((k) => [`판 ${v.at} ${k}`, v[k], v.at]));
