/**
 * 공개 개요(W8) — 파일 읽기 · 검사 · 입력 묶음 · 묶음 나누기. 형식과 규칙은 docs/annotations.md "공개 개요".
 * CLI는 tools/synopsis.mjs, 사이트 내보내기는 tools/site/export/synopsis.mjs가 이 파일을 쓴다.
 *
 * 개요 파일 = annotations/synopsis/<단위 파일 이름>.json (이름이 `_`로 시작하면 뺀다 — `_batches.json`은 W9 묶음표).
 * 원문(대사 본문)은 입력 묶음에 넣지 않는다 — 1회독 기록(요약 · 씬 한 줄 · 사실 · 의문 · 사건 · 시점 · 대상)만.
 * 원문 겹침 검사만 DB `lines.text`를 해시로 본다(tools/check-quotes.mjs와 같은 방법).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { quotesIn } from '../site/lib.mjs';
import { ROOT, fileNameFor } from '../records/model.mjs';
import { overlapIn } from '../check-quotes.mjs';

export const SYNOPSIS_DIR = path.join(ROOT, 'annotations/synopsis');
export const BATCHES_FILE = '_batches.json';
export const STATUSES = ['후보', '확정', '기각'];
export const DECIDERS = ['claude', '사용자'];

/** 종류 — 사이트 units.json의 kind와 같은 이름 */
export function unitKind(key) {
  if (/^ch\d+$/.test(key)) return 'main';
  if (key.startsWith('char:')) return 'episode';
  if (key.startsWith('event_') || key.startsWith('fl:')) return 'event';
  if (key.startsWith('side:')) return 'side';
  if (key.startsWith('erelic:')) return 'erelic';
  if (key.startsWith('sub:')) return 'sub';
  if (key.startsWith('relic:')) return 'relic';
  if (key.startsWith('d_ex_elevator')) return 'elevator';
  return 'other';
}
export const KIND_LABEL = { main: '메인', event: '이벤트', side: '사이드', erelic: '이벤트 유실물', sub: '서브퀘스트', relic: '유실물', episode: '호감도', elevator: '돌발', other: '그 밖' };

/**
 * W9 묶음의 갈래 — 이 순서로 나눈다(사이트에서 가장 많이 볼 메인부터). 갈래 안은 출시순(읽는 순서).
 * 엘리베이터는 메인과 같이 읽혔으므로(ch07 뒤) 메인 갈래에 둔다.
 */
export const GROUPS = [
  { id: 'main', label: '메인 + 돌발', kinds: ['main', 'elevator'] },
  { id: 'story', label: '이벤트 · 사이드 · 이벤트 유실물', kinds: ['event', 'side', 'erelic'] },
  { id: 'small', label: '서브퀘스트 · 유실물', kinds: ['sub', 'relic'] },
  { id: 'episode', label: '호감도 스토리', kinds: ['episode'] },
];

/** 길이 · 인용 한도 (docs/annotations.md "공개 개요") */
export const LIMITS = {
  logline: 80,
  scene: 100,
  quote: 20, // 따옴표 안 글자
  quotes: 2, // 개요 하나(한 줄 소개 · 줄거리 · 씬 한 줄 전부)의 따옴표 수
  overlapWarn: 20, // 원문과 이어서 겹치는 글자(공백 뺌)
  overlapError: 40,
  /** 줄거리 [최소, 최대] — 호감도는 다섯 편 전체의 흐름(편마다는 scenes), 서브퀘스트 · 유실물은 짧게 */
  synopsis: { main: [300, 1000], event: [200, 800], side: [200, 800], erelic: [150, 600], episode: [100, 400], sub: [60, 400], relic: [60, 400], elevator: [150, 600], other: [60, 600] },
};

/** 화면에 내면 안 되는 꼴 — 오류. 작업 말은 경고 */
export const FORBIDDEN = [
  { re: /\b(?:d_main|d_ex|d_nikke|event)_[a-z0-9_]+/gi, what: '씬 · 단위 ID' },
  { re: /\b(?:ch\d{2}|char:\d+|(?:sub|relic|erelic|side|fl|ep|person|place|concept|org|incident|item|object|thread):[^\s,.·)]+)/g, what: '단위 · 대상 키' },
  { re: /#\d+/g, what: '줄 번호' },
  { re: /(?<![A-Za-z0-9])[FQSVLIEDUKZBOHJYG]\d+(?:-\d+)?(?![A-Za-z0-9])/g, what: '기록 ID' },
  { re: /(?<![A-Za-z0-9])(?:RE|RV|R|P|M|W|X|B|A|N)\d+[a-z]?(?:-\d+[a-z]?)?(?![A-Za-z0-9])/g, what: '세션 이름' },
];
/** 금지 꼴에 걸리지만 게임 안 용어인 것 — 금지 꼴 검사 전에 지운다 */
export const GAME_TERMS = [/E2\s?크리스탈/g, /X1\s?온리\s?원/g, /(?<![A-Za-z0-9])(?:A2|N102)(?![A-Za-z0-9])/g];
/** 뒤 이름을 품은 흔한 낱말 — 앞에 나온 이름처럼 덮어서 스포일러로 잡지 않는다(사라지다 속 사라) */
export const COMMON_WORDS = ['사라지', '사라진', '사라졌', '사라질', '사라짐', '사라져', '라이플', '라이벌', '승리의 여신', '레이드', '레이디', '레이더', '베이킹', '리스트', '레이저', '조이스틱', '부부 연기', 'X레이',
  // 세는 말 마리(W10)
  ...['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열', '몇', '여러'].map((n) => `${n} 마리`)];
export const WORK_WORDS = /[12]회독|되짚기|바로잡기|확신도|\((?:추정|확실)\)|후보로|판정 카드|볼 거리/g;

const arr = (x) => (Array.isArray(x) ? x : []);
const chars = (s) => [...String(s ?? '')].length;

/** 내용 지문 — 확정한 뒤 문장이 바뀌었는지 본다 */
export function contentHash(s) {
  const body = JSON.stringify([s?.logline ?? '', s?.synopsis ?? '', arr(s?.scenes).map((x) => [x?.scene ?? '', x?.text ?? ''])]);
  return crypto.createHash('sha1').update(body).digest('hex').slice(0, 10);
}

/** 단위 키 → 개요 파일 경로 */
export const synopsisPath = (unit, dir = SYNOPSIS_DIR) => path.join(dir, fileNameFor(unit));

/**
 * 개요 파일 전부. 이름이 `_`로 시작하면 뺀다.
 * @returns {{ dir, list: object[], byUnit: Map<string, object>, problems: {file, msg}[] }} list 항목 = { file, path, data }
 */
export function loadSynopses(dir = SYNOPSIS_DIR) {
  const list = [];
  const problems = [];
  const byUnit = new Map();
  if (!fs.existsSync(dir)) return { dir, list, byUnit, problems };
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
    if (typeof data?.unit !== 'string') problems.push({ file: f, msg: 'unit이 없다' });
    else if (byUnit.has(data.unit)) problems.push({ file: f, msg: `같은 단위의 개요가 둘 — ${byUnit.get(data.unit).file}` });
    else byUnit.set(data.unit, item);
  }
  return { dir, list, byUnit, problems };
}

/**
 * 상태 한눈에 — 마지막 확정의 지문과 지금 지문이 다르면 changed(확정 뒤 고침 — 다시 검토해야 한다).
 * 내보내기는 `ok`(확정 · 고치지 않음)만 싣는다.
 */
export function stateOf(s) {
  const reviews = arr(s?.reviews);
  const last = reviews.at(-1) ?? null;
  const lastConfirm = [...reviews].reverse().find((r) => r?.decision === '확정') ?? null;
  const hash = contentHash(s);
  const changed = s?.status === '확정' && (!lastConfirm || lastConfirm.hash !== hash);
  return { status: s?.status ?? '후보', last, lastBy: last?.by ?? null, hash, changed, ok: s?.status === '확정' && !changed };
}

/**
 * 원문 없이 되는 검사 — 칸 · 길이 · 금지 꼴 · 작업 말 · 따옴표 · 씬. 원문 겹침 · 스포일러는 따로(overlapProblems · spoilerProblems).
 * @param {object} s 개요 파일 내용
 * @param {{ scenes?: string[] | null, file?: string }} [opt] scenes = 그 단위의 씬 ID(없으면 씬 소속은 안 본다)
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkSynopsis(s, { scenes = null } = {}) {
  const errors = [];
  const warnings = [];
  const unit = s?.unit;
  const kind = unitKind(String(unit ?? ''));
  for (const k of ['unit', 'session', 'by', 'date']) if (typeof s?.[k] !== 'string' || !s[k]) errors.push(`${k}가 없다`);
  if (!STATUSES.includes(s?.status)) errors.push(`status는 ${STATUSES.join(' · ')} 가운데 하나`);
  const logline = typeof s?.logline === 'string' ? s.logline.trim() : '';
  const synopsis = typeof s?.synopsis === 'string' ? s.synopsis.trim() : '';
  // 빈 틀(후보)은 쓰는 중 — 칸이 비었다고 오류로 하지 않고 경고로만
  const draft = s?.status === '후보';
  if (!logline) (draft ? warnings : errors).push('logline(한 줄 소개)이 비었다');
  else if (chars(logline) > LIMITS.logline) errors.push(`logline이 ${chars(logline)}자 — ${LIMITS.logline}자 안쪽`);
  if (!synopsis) (draft ? warnings : errors).push('synopsis(줄거리)가 비었다');
  else {
    const [lo, hi] = LIMITS.synopsis[kind] ?? LIMITS.synopsis.other;
    const n = chars(synopsis);
    if (n > hi) warnings.push(`synopsis가 ${n}자 — ${KIND_LABEL[kind]}는 ${lo}–${hi}자`);
    else if (n < lo) warnings.push(`synopsis가 ${n}자 — ${KIND_LABEL[kind]}는 ${lo}–${hi}자`);
  }
  const seen = new Set();
  const sceneSet = scenes ? new Set(scenes) : null;
  if (s?.scenes != null && !Array.isArray(s.scenes)) errors.push('scenes는 배열 [{scene, text}]');
  for (const [i, x] of arr(s?.scenes).entries()) {
    const at = `scenes[${i}]`;
    if (typeof x?.scene !== 'string' || !x.scene) { errors.push(`${at}: scene이 없다`); continue; }
    if (seen.has(x.scene)) errors.push(`${at}: 같은 씬이 두 번 — ${x.scene}`);
    seen.add(x.scene);
    if (sceneSet && !sceneSet.has(x.scene)) errors.push(`${at}: 이 단위의 씬이 아니다 — ${x.scene}`);
    const t = typeof x.text === 'string' ? x.text.trim() : '';
    if (!t) errors.push(`${at}: text가 비었다`);
    else if (chars(t) > LIMITS.scene) warnings.push(`${at}: ${chars(t)}자 — ${LIMITS.scene}자 안쪽`);
  }
  // 화면에 뜨는 글 — 금지 꼴 · 작업 말 · 따옴표
  const texts = [['logline', logline], ['synopsis', synopsis], ...arr(s?.scenes).map((x, i) => [`scenes[${i}]`, typeof x?.text === 'string' ? x.text : ''])];
  let quoteCount = 0;
  for (const [where, t] of texts) {
    if (!t) continue;
    const plain = GAME_TERMS.reduce((x, re) => x.replace(re, ' '), t);
    for (const f of FORBIDDEN) {
      const hits = [...new Set(plain.match(f.re) ?? [])];
      if (hits.length) errors.push(`${where}: 화면 글에 넣지 않는 꼴(${f.what}) — ${hits.slice(0, 3).join(' · ')}`);
    }
    const work = [...new Set(t.match(WORK_WORDS) ?? [])];
    if (work.length) warnings.push(`${where}: 작업 말 — ${work.join(' · ')}`);
    for (const q of quotesIn(t)) {
      quoteCount++;
      if (chars(q.inner) > LIMITS.quote) warnings.push(`${where}: 따옴표 안이 ${chars(q.inner)}자 — 이름 · 용어 · 짧은 말(${LIMITS.quote}자 안쪽)만`);
    }
  }
  if (quoteCount > LIMITS.quotes) warnings.push(`따옴표가 ${quoteCount}번 — 개요 하나에 ${LIMITS.quotes}번 이하`);
  const st = stateOf(s);
  if (st.changed) errors.push(`확정한 뒤 문장이 바뀌었다 — 다시 검토해 \`set ${unit} 확정\` (마지막 확정 지문 ${arr(s?.reviews).filter((r) => r?.decision === '확정').at(-1)?.hash ?? '없음'} · 지금 ${st.hash})`);
  for (const [i, r] of arr(s?.reviews).entries()) {
    if (!['확정', '기각', '후보'].includes(r?.decision)) errors.push(`reviews[${i}]: decision이 이상하다`);
    if (!DECIDERS.includes(r?.by)) errors.push(`reviews[${i}]: by는 ${DECIDERS.join(' · ')}`);
  }
  return { errors, warnings };
}

/** 화면에 뜨는 글 전부 — 겹침 · 스포일러 검사용 */
export const shownTexts = (s) => [
  ['logline', s?.logline ?? ''],
  ['synopsis', s?.synopsis ?? ''],
  ...arr(s?.scenes).map((x, i) => [`scenes[${i}]`, x?.text ?? '']),
].filter(([, t]) => typeof t === 'string' && t);

/** 원문 겹침 — windows = check-quotes sourceWindows(db) */
export function overlapProblems(s, windows) {
  const errors = [];
  const warnings = [];
  for (const [where, t] of shownTexts(s)) {
    const o = overlapIn(windows, t);
    if (!o) continue;
    if (o.length >= LIMITS.overlapError) errors.push(`${where}: 원문과 ${o.length}자 겹친다 — ${o.sample.slice(0, 30)}`);
    else if (o.length >= LIMITS.overlapWarn) warnings.push(`${where}: 원문과 ${o.length}자 겹친다 — ${o.sample.slice(0, 30)} (우리 문장으로)`);
  }
  return { errors, warnings };
}

/**
 * 이름마다 처음 나오는 자리(읽는 순서) — 언급 DB(mentions)의 name(이름표 · 이름 · 별칭). 스포일러 경고에 쓴다.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ unitPos: Map<string, number>, unitOf: Function }} places tools/records/read2.mjs scenePlaces
 * @returns {Map<string, { order: number, unit: string }>}
 */
export function nameFirsts(db, places) {
  const first = new Map();
  // 같은 대상의 표기 갈래(점 · 띄어쓰기 · 대소문자만 다른 것 — ACPU · A.C.P.U. · A.C.P.U)는 처음 나온 자리를 나눈다(W10)
  const spelling = new Map();
  const keysOf = new Map();
  const earlier = (m, k, v) => {
    const cur = m.get(k);
    if (!cur || v.order < cur.order) m.set(k, v);
  };
  for (const r of db.prepare('SELECT story_id, target, name FROM mentions').iterate()) {
    const unit = places.unitOf(r.story_id);
    if (!unit) continue;
    const order = places.unitPos.get(unit);
    for (const raw of String(r.name ?? '').split(' · ')) {
      const name = raw.trim();
      if (chars(name) < 2 || /^[?？…\s]+$/.test(name)) continue;
      earlier(first, name, { order, unit });
      const key = `${r.target}\u0000${spellingKey(name)}`;
      earlier(spelling, key, { order, unit });
      if (!keysOf.has(name)) keysOf.set(name, new Set());
      keysOf.get(name).add(key);
    }
  }
  for (const [name, keys] of keysOf) for (const key of keys) earlier(first, name, spelling.get(key));
  return first;
}

/** 표기 갈래를 하나로 — 점 · 가운뎃점 · 띄어쓰기를 빼고 소문자로 */
export const spellingKey = (name) => name.replace(/[.\s·]/g, '').toLowerCase();

/**
 * 스포일러 경고 — 그 단위(읽는 순서 order) 뒤에 처음 나오는 이름이 화면 글에 들었나.
 * 앞에 나온 더 긴 이름 안에 든 것(예: 앞 이름 「A의 B」 속 B) · 흔한 낱말(COMMON_WORDS) 안에 든 것 ·
 * 바로 앞에 한글 음절이 붙어 낱말 속 글자인 것(하이브 속 이브, 크리스탈 속 리스) · 영문 낱말 속 글자(DIVA 속 IV)는 뺀다.
 */
export function spoilerProblems(s, order, firsts) {
  const warnings = [];
  if (order == null) return { errors: [], warnings };
  const early = [];
  const late = [];
  for (const [name, f] of firsts) (f.order > order ? late : early).push([name, f]);
  for (const [where, t] of shownTexts(s)) {
    const covered = [];
    for (const name of [...early.map(([n]) => n), ...COMMON_WORDS]) for (let i = t.indexOf(name); i >= 0; i = t.indexOf(name, i + 1)) covered.push([i, i + name.length]);
    const hits = [];
    for (const [name, f] of late) {
      for (let i = t.indexOf(name); i >= 0; i = t.indexOf(name, i + 1)) {
        if (covered.some(([a, b]) => a <= i && i + name.length <= b && b - a > name.length)) continue;
        if (i > 0 && /[가-힣]/.test(t[i - 1]) && /^[가-힣]/.test(name)) continue;
        if (/^[A-Za-z]/.test(name) && (/[A-Za-z]/.test(t[i - 1] ?? '') || /[A-Za-z]/.test(t[i + name.length] ?? ''))) continue;
        hits.push(`${name}(${f.order}번째 ${f.unit}에서 처음)`);
        break;
      }
    }
    if (hits.length) warnings.push(`${where}: 이 단위 뒤에 처음 나오는 이름 — ${hits.join(' · ')}`);
  }
  return { errors: [], warnings };
}

/**
 * W9 묶음 — 갈래(GROUPS)마다 읽는 순서대로 입력 분량을 쌓아 max를 넘기 전에 끊는다. 이름은 W9a부터 차례로.
 * @param {{ key: string, order: number, size: number }[]} units
 * @returns {{ id: string, group: string, label: string, units: string[], size: number, first: string, last: string }[]}
 */
export function planBatches(units, max = 80_000, { prefix = 'W9' } = {}) {
  const out = [];
  for (const g of GROUPS) {
    const list = units.filter((u) => g.kinds.includes(unitKind(u.key))).sort((a, b) => a.order - b.order);
    if (!list.length) continue;
    // 고르게 — 묶음 수 n을 정하고, n개 이하로 나뉘는 가장 작은 상한을 이분 탐색으로 찾아 그 상한으로 앞에서부터 채운다.
    // 그 상한이 max를 넘으면 n을 늘린다(한 단위가 max보다 크면 그 단위 혼자 한 묶음)
    const sizes = list.map((u) => u.size);
    const total = sizes.reduce((a, b) => a + b, 0);
    let n = Math.max(1, Math.ceil(total / max));
    let cap = minCap(sizes, n);
    while (cap > max && n < list.length && cap > Math.max(...sizes)) cap = minCap(sizes, ++n);
    let cur = [];
    let size = 0;
    for (const u of list) {
      if (cur.length && size + u.size > cap) {
        out.push(batchOf(g, cur, size));
        cur = [];
        size = 0;
      }
      cur.push(u);
      size += u.size;
    }
    if (cur.length) out.push(batchOf(g, cur, size));
  }
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  return out.map((b, i) => ({ id: `${prefix}${letters[i]}`, ...b }));
}

const batchOf = (g, cur, size) => ({ group: g.id, label: g.label, units: cur.map((u) => u.key), size, first: cur[0].key, last: cur.at(-1).key });

/** 순서를 지킨 채 n개 이하로 나눌 때 가장 큰 묶음의 최솟값 */
function minCap(sizes, n) {
  const count = (cap) => {
    let k = 1;
    let s = 0;
    for (const x of sizes) {
      if (s && s + x > cap) { k++; s = 0; }
      s += x;
    }
    return k;
  };
  let lo = Math.max(...sizes);
  let hi = sizes.reduce((a, b) => a + b, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (count(mid) <= n) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
