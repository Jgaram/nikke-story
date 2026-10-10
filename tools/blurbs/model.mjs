/**
 * 팬용 문장(W14) — 분류 이유 · 연대기 추정 이유를 화면용으로 새로 쓴 한두 문장. 형식과 쓰는 기준은 docs/annotations.md "팬용 문장".
 * CLI는 tools/blurbs.mjs. 판정 기록 원문(order.json `reason` · chrono.json narrows `reason`)은 분석용으로 그대로 두고, 이 문장이 화면에 대신 뜬다.
 *
 * 파일 = annotations/blurbs/<단위 파일 이름>.json — { unit, why?, when? }. 칸마다 { text, src, session, by, date, status, reviews[] }.
 *   why  = 분류 이유(리더 분류 칸 '이유') — 원본은 site/data/order.json units(척추 밖 421)
 *   when = 연대기 추정 이유(연대기 카드 '추정한 이유') — 원본은 site/data/chrono.json narrows 가운데 화면에 뜨는 것(자리 있음 · 추정)
 * src는 쓸 때 본 판정의 지문이다 — 판정이 바뀌면(다시 판정 · 신작) 지문이 어긋나 '낡음'이 되고 내보내기가 빼며 화면은 거른 판정 문장으로 돌아간다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { quotesIn } from '../site/lib.mjs';
import { ROOT, fileNameFor } from '../records/model.mjs';
import { FORBIDDEN, GAME_TERMS, WORK_WORDS } from '../synopsis/model.mjs';

export const BLURB_DIR = path.join(ROOT, 'annotations/blurbs');
export const SITE_DATA = path.join(ROOT, 'site/data');
export const PARTS = { why: '분류 이유', when: '연대기 추정 이유' };
export const STATUSES = ['후보', '확정', '기각'];
export const DECIDERS = ['claude', '사용자'];

export const LIMITS = {
  text: [40, 100], // 권장 글자 수(벗어나면 경고) — "한두 문장, 80자 안팎"
  max: 120, // 넘으면 오류
  sentences: 2,
  quote: 20, // 따옴표 안 글자
  quotes: 1, // 문장 하나의 따옴표 수
};

/** 이을 것이 없는 독립 스토리의 고정 문장(사용자, 2026-10-10) — 길이 검사를 받지 않는다. 독립 밖에는 못 쓴다 */
export const STANDALONE_TEXT = '필수 스토리와 얽히지 않는 이야기.';

/** 판정 말 — 화면 글에 넣지 않는다(오류). '필수 스토리'는 화면 말이라 된다 */
export const JUDGE_WORDS = /척추|잣대|문턱|판정|등급|준필수|상한|하한|빌드업|about|basis/g;
/** 작업 냄새 — 경고. 작품 속 물건(세이렌이 쓴 기록)처럼 맞는 말이면 그대로 둔다 */
export const SOFT_WORDS = /기록|근거|요지|단서|주요 인물|주역|사연 조각/g;

const arr = (x) => (Array.isArray(x) ? x : []);
const chars = (s) => [...String(s ?? '')].length;
const sha = (v) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 10);

/** 판정 지문 — why: 등급 · 딛는 자리 · 이유, when: 화면에 뜨는 좁힘들의 관계 · 이유 */
export function srcHash(part, source) {
  if (!source) return null;
  if (part === 'why') return sha([source.grade ?? '', source.from ?? '', source.reason ?? '']);
  return sha(arr(source).map((n) => [n.at ?? [], n.reason ?? '']));
}

/** 내용 지문 — 확정한 뒤 문장(또는 딛는 판정)이 바뀌었는지 본다 */
export const contentHash = (e) => sha([e?.text ?? '', e?.src ?? '']);

export const blurbPath = (unit, dir = BLURB_DIR) => path.join(dir, fileNameFor(unit));

/** 화면에 뜨는 좁힘 — 연대기 카드와 같은 거름(site/tabs/chrono.js: 자리 있음 · 확실 아님) */
export const shownNarrow = (n) => Array.isArray(n?.at) && n.at.length > 0 && n.confidence !== '확실';

/**
 * 원본 — 사이트 데이터(내보낸 것)에서 칸마다 단위 → 판정.
 * @returns {{ why: Map<string, object>, when: Map<string, object[]>, units: Map<string, object>, chrono: object, order: object }}
 */
export function loadSources(dir = SITE_DATA) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const order = read('order.json');
  const chrono = read('chrono.json');
  const units = new Map(read('units.json').map((u) => [u.key, u]));
  const why = new Map(arr(order.units).map((u) => [u.key, u]));
  const when = new Map();
  for (const n of arr(chrono.narrows)) if (shownNarrow(n)) (when.get(n.unit) ?? when.set(n.unit, []).get(n.unit)).push(n);
  return { why, when, units, chrono, order };
}

/**
 * 파일 전부. 이름이 `_`로 시작하면 뺀다.
 * @returns {{ list: {file, path, data}[], byUnit: Map<string, object>, problems: {file, msg}[] }}
 */
export function loadBlurbs(dir = BLURB_DIR) {
  const list = [];
  const problems = [];
  const byUnit = new Map();
  if (!fs.existsSync(dir)) return { list, byUnit, problems };
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
    else if (byUnit.has(data.unit)) problems.push({ file: f, msg: `같은 단위의 파일이 둘 — ${byUnit.get(data.unit).file}` });
    else byUnit.set(data.unit, item);
  }
  return { list, byUnit, problems };
}

/**
 * 칸 하나의 상태. changed = 확정 뒤 문장을 고침(다시 검토), stale = 쓴 뒤 판정이 바뀜(다시 쓴다). 내보내기는 ok만.
 * @param {object} e 칸(why · when)
 * @param {string | null} cur 지금 판정 지문(srcHash) — null이면 원본이 없다(화면에 그 칸이 없음)
 */
export function stateOf(e, cur) {
  const reviews = arr(e?.reviews);
  const last = reviews.at(-1) ?? null;
  const lastConfirm = [...reviews].reverse().find((r) => r?.decision === '확정') ?? null;
  const hash = contentHash(e);
  const changed = e?.status === '확정' && (!lastConfirm || lastConfirm.hash !== hash);
  const stale = cur == null || e?.src !== cur;
  return { status: e?.status ?? '후보', last, lastBy: last?.by ?? null, hash, changed, stale, ok: e?.status === '확정' && !changed && !stale };
}

/** 제목으로 불리는 단위인가(척추 이벤트 · 사이드 'OVER ZONE' 꼴) — 호감도 제목(인물 이름)은 이름 언급과 갈리지 않아 뺀다 */
export const titledUnit = (u) => u?.kind !== 'main' && /^[A-Z][A-Z0-9 .,'!&:-]{4,}$/.test(u?.title ?? '');

/**
 * 뒤 스토리 이름 — 그 단위보다 읽는 순서가 뒤인 메인 챕터('CH.44') · 제목 단위('GODDESS FALL')가 글에 들었나(사용자, 2026-10-10 — 이름도 암시도 안 쓴다).
 * @param {string} text
 * @param {string} unit
 * @param {Map<string, object> | undefined} units 사이트 units.json(key → { order, title, kind })
 * @returns {string[]} 걸린 이름
 */
export function laterNames(text, unit, units) {
  const me = units?.get(unit)?.order;
  if (me == null) return [];
  const hits = new Set();
  for (const m of String(text).matchAll(/CH\.(\d+)/g)) {
    const u = units.get(`ch${m[1].padStart(2, '0')}`);
    if (u && u.order > me) hits.add(`CH.${m[1]}`);
  }
  for (const u of units.values()) if (u.order > me && titledUnit(u) && String(text).includes(u.title)) hits.add(u.title);
  return [...hits];
}

/** 문장 수 — 마침표 · 물음표 · 느낌표 뒤가 끝이나 빈칸인 곳(CH.44의 점은 세지 않는다) */
export const sentenceCount = (t) => (String(t).trim().match(/[.?!…](?=\s|$)/g) ?? []).length || (String(t).trim() ? 1 : 0);

/**
 * 칸 하나 검사 — 원문 없이 되는 것(칸 · 길이 · 금지 꼴 · 판정 말 · 따옴표 · 지문). 원문 겹침 · 스포일러는 CLI가 synopsis 모델로.
 * @param {'why'|'when'} part
 * @param {object} e 칸
 * @param {string | null} cur 지금 판정 지문
 */
export function checkEntry(part, e, cur, { unit = null, units = null, grade = null } = {}) {
  const errors = [];
  const warnings = [];
  if (!e || typeof e !== 'object') return { errors: ['칸이 객체가 아니다'], warnings };
  for (const k of ['session', 'by', 'date', 'src']) if (typeof e[k] !== 'string' || !e[k]) errors.push(`${k}가 없다`);
  if (!STATUSES.includes(e.status)) errors.push(`status는 ${STATUSES.join(' · ')} 가운데 하나`);
  const text = typeof e.text === 'string' ? e.text.trim() : '';
  if (cur == null) errors.push(`화면에 이 칸이 없다 — ${part === 'why' ? '분류 단위(척추 밖)가 아니다' : '연대기 카드에 추정한 이유가 뜨지 않는 단위다'}`);
  else if (e.src !== cur && e.status !== '기각') warnings.push(`쓴 뒤 판정이 바뀌었다(낡음 — 화면은 거른 판정 문장) — 입력을 다시 보고 고쳐 \`new … --refresh\` 뒤 확정`);
  if (!text) (e.status === '확정' ? errors : warnings).push('text가 비었다');
  else if (text === STANDALONE_TEXT) {
    if (part !== 'why' || (grade && grade !== '독립')) errors.push('고정 문장은 이을 것이 없는 독립 스토리의 분류 이유에만');
  } else {
    const n = chars(text);
    if (n > LIMITS.max) errors.push(`${n}자 — ${LIMITS.max}자 안쪽(권장 ${LIMITS.text.join('–')})`);
    else if (n < LIMITS.text[0] || n > LIMITS.text[1]) warnings.push(`${n}자 — 권장 ${LIMITS.text.join('–')}자`);
    const sc = sentenceCount(text);
    if (sc > LIMITS.sentences) warnings.push(`${sc}문장 — 한두 문장`);
    const plain = GAME_TERMS.reduce((x, re) => x.replace(re, ' '), text);
    for (const f of FORBIDDEN) {
      const hits = [...new Set(plain.match(f.re) ?? [])];
      if (hits.length) errors.push(`화면 글에 넣지 않는 꼴(${f.what}) — ${hits.slice(0, 3).join(' · ')}`);
    }
    const later = laterNames(text, unit, units);
    if (later.length) errors.push(`뒤 스토리 이름 — ${later.join(' · ')} (그 스토리와 앞 스토리 내용만 — ${part === 'why' ? "읽는 때는 '언제 읽나' 줄이" : '자리는 카드의 굵은 줄이'} 말한다)`);
    const judge = [...new Set(text.match(JUDGE_WORDS) ?? [])];
    if (judge.length) errors.push(`판정 말 — ${judge.join(' · ')} (화면 말로: 척추 → 필수 스토리)`);
    const work = [...new Set([...(text.match(WORK_WORDS) ?? []), ...(text.match(SOFT_WORDS) ?? [])])];
    if (work.length) warnings.push(`작업 냄새 — ${work.join(' · ')} (작품 속 말이면 그대로)`);
    const qs = quotesIn(text);
    if (qs.length > LIMITS.quotes) warnings.push(`따옴표가 ${qs.length}번 — ${LIMITS.quotes}번 이하`);
    for (const q of qs) if (chars(q.inner) > LIMITS.quote) warnings.push(`따옴표 안이 ${chars(q.inner)}자 — 이름 · 용어 · 짧은 말(${LIMITS.quote}자 안쪽)만`);
  }
  const st = stateOf(e, cur);
  if (st.changed) errors.push(`확정한 뒤 문장이 바뀌었다 — 다시 검토해 확정 (마지막 확정 지문 ${arr(e.reviews).filter((r) => r?.decision === '확정').at(-1)?.hash ?? '없음'} · 지금 ${st.hash})`);
  for (const [i, r] of arr(e.reviews).entries()) {
    if (!STATUSES.includes(r?.decision)) errors.push(`reviews[${i}]: decision이 이상하다`);
    if (!DECIDERS.includes(r?.by)) errors.push(`reviews[${i}]: by는 ${DECIDERS.join(' · ')}`);
  }
  return { errors, warnings };
}

/**
 * 파일 하나 검사 — 칸마다 checkEntry, 모르는 칸 · 빈 파일.
 * @param {object} b 파일 내용
 * @param {{ why: Map, when: Map }} sources loadSources
 * @returns {{ errors: string[], warnings: string[] }} 메시지 앞에 칸 이름
 */
export function checkBlurb(b, sources) {
  const errors = [];
  const warnings = [];
  const parts = Object.keys(b ?? {}).filter((k) => k !== 'unit');
  for (const k of parts) if (!(k in PARTS)) errors.push(`모르는 칸 — ${k} (${Object.keys(PARTS).join(' · ')})`);
  if (!parts.some((k) => k in PARTS)) errors.push('칸이 없다');
  for (const part of Object.keys(PARTS)) {
    if (!b?.[part]) continue;
    const r = checkEntry(part, b[part], srcHash(part, sources[part].get(b.unit)), { unit: b.unit, units: sources.units, grade: sources.why.get(b.unit)?.grade ?? null });
    errors.push(...r.errors.map((m) => `${part}: ${m}`));
    warnings.push(...r.warnings.map((m) => `${part}: ${m}`));
  }
  return { errors, warnings };
}

/** 화면에 뜨는 글 — 겹침 · 스포일러 검사용([[어디, 글]]) */
export const shownTexts = (b) => Object.keys(PARTS).filter((p) => typeof b?.[p]?.text === 'string' && b[p].text).map((p) => [p, b[p].text]);
