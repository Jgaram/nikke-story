/**
 * 읽는 순서 — SESSIONS.md의 읽기 항목(R · RE …)에서 단위 키를 차례로 뽑는다.
 * 진행률 · 인계 파일 · 검증기가 "어느 세션이 어느 단위를 읽나"를 여기서 얻는다. 순서의 원본은 SESSIONS.md 하나다.
 *
 * 항목 모양 (SESSIONS.md "순서"):
 *   - [ ] **R01** ch00–02 · `sub:칠리페퍼_00` `sub:테트라_커넥트_00` · ch03 · … — 8.0만 자 · 12파트
 *   - [ ] **RE30** `fl:boom_the_ghost`(= `event_boomtheghost1` 본문) — …        (= …)는 설명이라 뺀다
 *   - [ ] **RE32** `event_arcanearchive` `event_staranis1` 파트 1–3 — …       파트를 나눠 읽는 단위
 *   - [ ] **P1 👤 2회독 파일럿** ch00–01 · …                                 굵은 글씨 안 이름은 건너뛴다
 * `chNN–MM`은 챕터 범위, 백틱 안은 read.mjs 키(단위 · 씬)다. ` — ` 뒤(분량)는 보지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SESSIONS_PATH = path.join(ROOT, 'SESSIONS.md');

/** 1회독 읽기 항목의 접두 — RV(리뷰)는 읽기 항목이 아니다 */
export const READ1_PREFIXES = ['R', 'RE'];
/** 2회독 읽기 항목의 접두 — 파일럿 P1 · 층별 M01 … (`#### 1층` 머리줄은 항목이 아니다) */
export const READ2_PREFIXES = ['P', 'M'];

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * @param {string} text SESSIONS.md 내용
 * @param {string[]} prefixes 항목 접두 (R · RE)
 * @returns {{ items: {session:string, state:string, key:string, parts:string|null, index:number}[], sessions: {id:string, state:string, keys:string[]}[] }}
 */
export function parseOrder(text, prefixes = READ1_PREFIXES) {
  const items = [];
  const sessions = [];
  // 굵은 글씨 안에 이름이 더 붙기도 한다: **P1 👤 2회독 파일럿**
  const head = new RegExp(`^- \\[(.)\\] \\*\\*((?:${prefixes.join('|')})\\d+[a-z]?)(?:\\s[^*]*)?\\*\\*(.*)$`);
  for (const line of text.split('\n')) {
    const m = line.match(head);
    if (!m) continue;
    const [, state, id, rest] = m;
    const body = rest.split(' — ')[0].replace(/\(=[^)]*\)/g, ' ');
    const keys = [];
    const tok = /`([^`]+)`(?:\s*파트\s*(\d+)\s*[–-]\s*(\d+))?|\bch(\d+)(?:\s*[–-]\s*(\d+))?/g;
    for (const t of body.matchAll(tok)) {
      if (t[1]) {
        const parts = t[2] ? `${Number(t[2])}-${Number(t[3])}` : null;
        keys.push({ key: t[1], parts });
      } else {
        const a = Number(t[4]);
        const b = t[5] !== undefined ? Number(t[5]) : a;
        for (let n = a; n <= b; n++) keys.push({ key: `ch${pad2(n)}`, parts: null });
      }
    }
    sessions.push({ id, state, keys: keys.map((k) => k.key) });
    for (const k of keys) items.push({ session: id, state, ...k, index: items.length });
  }
  return { items, sessions };
}

/**
 * 2회독에서 읽은 층 — SESSIONS.md P · M 목록의 `#### N층` 머리줄 아래 항목의 단위(X3a). 2회독이 끝난 뒤 등급을 다시 판정해도
 * 층은 읽은 층으로 묶는다(검증기가 견준다 — docs/annotations.md "중요도 판정").
 * @returns {Map<string, number>} 단위 키 → 층(1–3). 머리줄 밖 항목은 넣지 않는다
 */
export function parseReadLayers(text) {
  const out = new Map();
  let layer = null;
  const order = parseOrder(text, READ2_PREFIXES);
  const head = new RegExp(`^- \\[(.)\\] \\*\\*((?:${READ2_PREFIXES.join('|')})\\d+[a-z]?)(?:\\s[^*]*)?\\*\\*`);
  const sessionLayer = new Map();
  for (const line of text.split('\n')) {
    const h = line.match(/^#### (\d)층/);
    if (h) layer = Number(h[1]);
    else if (/^#{1,3} /.test(line)) layer = null;
    const m = line.match(head);
    if (m && layer) sessionLayer.set(m[2], layer);
  }
  for (const it of order.items) if (sessionLayer.has(it.session) && !out.has(it.key)) out.set(it.key, sessionLayer.get(it.session));
  return out;
}

/** SESSIONS.md에서 2회독에서 읽은 층. 파일이 없으면 빈 Map */
export function loadReadLayers(file = SESSIONS_PATH) {
  if (!fs.existsSync(file)) return new Map();
  return parseReadLayers(fs.readFileSync(file, 'utf8'));
}

/** 읽기 단위 키의 종류 — 진행률을 종류별로 나눠 보일 때 쓴다 (출시순 한 줄이라 세션 접두로는 못 나눈다) */
export const KIND_ORDER = ['메인', '서브퀘스트', '유실물', '사이드', '이벤트', '호감도', '그 밖'];
export function kindOfKey(key) {
  if (/^ch\d/.test(key)) return '메인';
  if (key.startsWith('sub:')) return '서브퀘스트';
  if (key.startsWith('relic:') || key.startsWith('erelic:')) return '유실물';
  if (key.startsWith('side:')) return '사이드';
  if (key.startsWith('event_') || key.startsWith('fl:')) return '이벤트';
  if (key.startsWith('char:')) return '호감도';
  return '그 밖';
}

/** 종류별 "읽음/전체" 한 줄. isRead(item) → boolean */
export function kindTally(items, isRead) {
  const t = new Map();
  for (const it of items) {
    const k = kindOfKey(it.key);
    const v = t.get(k) ?? [0, 0];
    v[1]++;
    if (isRead(it)) v[0]++;
    t.set(k, v);
  }
  return KIND_ORDER.filter((k) => t.has(k)).map((k) => `${k} ${t.get(k)[0]}/${t.get(k)[1]}`).join(' · ');
}

/** SESSIONS.md를 읽어 순서를 낸다. 파일이 없으면 빈 순서 */
export function loadOrder(prefixes = READ1_PREFIXES, file = SESSIONS_PATH) {
  if (!fs.existsSync(file)) return { items: [], sessions: [] };
  return parseOrder(fs.readFileSync(file, 'utf8'), prefixes);
}

/** (단위 키, 파트) → 순서 항목. 파트를 나눠 읽는 단위는 파트까지 맞아야 한다 */
export function findItem(order, key, parts = null) {
  return order.items.find((it) => it.key === key && (it.parts ?? null) === (parts ?? null)) ?? null;
}

/**
 * 파트 범위 두 개가 겹치나 — "4-6" · "7-12", 없으면(null) 단위 전체. 1회독과 2회독은 파트 묶음이 다를 수 있어
 * (fl:2x2_love_1ch 1회독 7–9 · 10–12 → 2회독 7–12) 2회독 항목의 1회독 기록 · 볼 거리를 겹침으로 찾는다
 */
export function partsOverlap(a, b) {
  if (!a || !b) return true;
  const [a1, a2] = String(a).split('-').map(Number);
  const [b1, b2] = String(b).split('-').map(Number);
  return a1 <= b2 && b1 <= a2;
}
