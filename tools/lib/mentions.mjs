/**
 * 언급 DB(B2) 조회 — 표본 정밀도 뽑기 · 씬별 대상 인덱스 · 첫 등장. query.mjs(sample · appear · targets)와 tools/views/mentions.mjs가 쓴다.
 * 자동 줄은 빌드가 만든다(tools/normalize/mentions.mjs → DB mentions · scene_targets). 규칙은 docs/schema.md "언급 DB".
 */
import { compileNames } from '../normalize/dictionary.mjs';
import { compilePersonNames, SKIP_WINDOWS } from '../normalize/mentions.mjs';
import { openContext } from '../records/context.mjs';
import { loadOrder, READ1_PREFIXES } from '../records/order.mjs';
import { comparePlace, scenePlaces } from '../records/read2.mjs';

/** 결정적 섞기용 해시 (FNV-1a 32비트) */
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/** (대상 · 이름) 한 쌍 고르기 — 대상 ID면 그 대상 이름 전부, 이름이면 그 이름을 가진 대상 전부 */
export function namePairs(db, q) {
  const rows = q.includes(':')
    ? db.prepare('SELECT target_id, name, how, mention_mode, precision, lines_in_scope FROM target_names WHERE target_id = ? ORDER BY lines_in_scope DESC').all(q)
    : db.prepare('SELECT target_id, name, how, mention_mode, precision, lines_in_scope FROM target_names WHERE name = ?').all(q);
  return rows;
}

/**
 * 이름 하나가 자동 언급으로 걸리는 줄에서 표본을 뽑는다(정밀도 재기). 자동에서 뺀 이름(mention_mode off) · 단위 안만 쓰는 이름(unit)도 같은 규칙으로 찾는다.
 * 후보는 FTS 접두 검색으로 좁히고, 빌드와 같은 검색기(인물: 꼬리 규칙 · 가장 긴 이름)로 거른다. 같은 seed면 같은 표본이다.
 * 두 인물이 나누는 이름(`사쿠라`)은 빌드처럼 그 단위에서 말하는 쪽 하나에만 건다. inUnit이면 그 대상이 말하는 단위의 줄만 본다(`auto: "unit"` 재기).
 * @returns {{ total: number, rows: {story_id, seq, speaker_name, window, text, at: number, inUnit: boolean}[] }}
 */
export function sampleName(db, { target_id: target, name }, { n = 10, seed = 1, inUnit = false } = {}) {
  const names = db.prepare('SELECT target_id, name, excludes FROM target_names').all();
  const person = target.startsWith('person:');
  const me = names.find((x) => x.target_id === target && x.name === name);
  let test;
  if (person) {
    const match = compilePersonNames(
      names.filter((x) => x.target_id.startsWith('person:')).map((x) => ({ key: x, name: x.name, excludes: JSON.parse(x.excludes ?? '[]') })),
      names.filter((x) => !x.target_id.startsWith('person:')).map((x) => x.name),
    );
    test = (text) => match(text).hits.has(me);
  } else {
    const match = compileNames([{ key: me, name, excludes: JSON.parse(me.excludes ?? '[]') }]);
    test = (text) => match(text).has(me);
  }
  const quoted = `"${name.replace(/"/g, '""')}"*`;
  const cands = db.prepare(
    `SELECT l.story_id, l.seq, l.speaker_name, l.window, l.text
       FROM lines_fts f JOIN lines l ON l.story_id = f.story_id AND l.seq = f.seq JOIN stories s ON s.id = f.story_id
      WHERE lines_fts MATCH ? AND s.in_scope = 1`,
  ).all(quoted);
  const speaks = speakersByCategory(db);
  const catOf = db.prepare('SELECT category_id FROM stories WHERE id = ?');
  const owners = person ? names.filter((x) => x.name === name && x.target_id.startsWith('person:')).map((x) => x.target_id) : [target];
  const hits = [];
  for (const l of cands) {
    if (SKIP_WINDOWS.has(l.window) || !test(l.text)) continue;
    const here = speaks.get(catOf.get(l.story_id).category_id) ?? new Set();
    if (owners.length > 1) {
      const pick = owners.filter((id) => here.has(id));
      if (pick.length !== 1 || pick[0] !== target) continue;
    }
    l.inUnit = here.has(target);
    if (inUnit && !l.inUnit) continue;
    hits.push(l);
  }
  const rows = hits
    .map((l) => ({ ...l, h: fnv(`${seed}|${l.story_id}|${l.seq}`) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, n)
    .map((l) => ({ ...l, at: wordStart(l.text.replace(/\s+/g, ' '), name) }));
  return { total: hits.length, rows };
}

let speakCache = null;
/** 카테고리(단위) → 그 단위에서 말하는 대상들 (언급 DB speaks) */
export function speakersByCategory(db) {
  if (speakCache?.db === db) return speakCache.map;
  const map = new Map();
  for (const r of db.prepare("SELECT DISTINCT s.category_id c, m.target t FROM mentions m JOIN stories s ON s.id = m.story_id WHERE m.how = 'speaks'").all()) {
    (map.get(r.c) ?? map.set(r.c, new Set()).get(r.c)).add(r.t);
  }
  speakCache = { db, map };
  return map;
}

/** 낱말 앞에서 시작하는 첫 자리 (표본 보여 주기용) */
function wordStart(t, name) {
  let i = -1;
  while ((i = t.indexOf(name, i + 1)) !== -1) if (i === 0 || !/[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]/.test(t[i - 1])) return i;
  return t.indexOf(name);
}

/** 표본 한 줄의 앞뒤 문맥 — 이름을 【】로 감싼다 */
export function contextOf(row, name, width = 18) {
  const t = row.text.replace(/\s+/g, ' ');
  const i = Math.max(0, row.at);
  const a = Math.max(0, i - width);
  const b = Math.min(t.length, i + name.length + width);
  return `${a > 0 ? '…' : ''}${t.slice(a, i)}【${t.slice(i, i + name.length)}】${t.slice(i + name.length, b)}${b < t.length ? '…' : ''}`;
}

// ── 씬별 대상 인덱스 · 첫 등장 (T3-3) ─────────────────────────────────────

const HOW_LABEL = { speaks: '말함', named: '이름', alias: '다른 이름' };
export const howLabel = (h) => HOW_LABEL[h] ?? h;

/**
 * 대상마다 등장(언급 DB 자동 줄)을 읽는 순서(1회독 = 출시순 한 줄, tools/records/read2.mjs scenePlaces)로 모은다.
 * 등장 = 그 대상의 언급 줄(말함 · 이름 · 다른 이름)이 하나라도 있는 씬. 순서에 없는 씬(범위 밖 등)은 자리가 없어 처음 · 마지막에서 빠진다.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ unitOf: Function, posOf: Function }} places scenePlaces(order, ctx)
 * @param {{ target?: string }} [opt] 대상 하나만
 * @returns {Map<string, object>} 대상 → { scenes: Map(씬 → {speaks, named, alias, first_seq, pos}), units: Map(단위 → 씬 수), lines: {speaks, named, alias},
 *   first, last, firstSpeaks, firstNamed, unplaced } — first 등은 { scene, seq, how, unit, pos }
 */
export function appearances(db, places, { target } = {}) {
  const rows = target
    ? db.prepare('SELECT story_id, seq_from, how, lines, target FROM mentions WHERE target = ?').all(target)
    : db.prepare('SELECT story_id, seq_from, how, lines, target FROM mentions').all();
  const out = new Map();
  const better = (a, b) => !a || comparePlace(b.pos, a.pos) < 0;
  for (const r of rows) {
    let a = out.get(r.target);
    if (!a) out.set(r.target, (a = { scenes: new Map(), units: new Map(), lines: { speaks: 0, named: 0, alias: 0 }, first: null, last: null, firstSpeaks: null, firstNamed: null, unplaced: 0 }));
    a.lines[r.how] += r.lines;
    const p = places.posOf(r.story_id);
    let s = a.scenes.get(r.story_id);
    if (!s) {
      a.scenes.set(r.story_id, (s = { speaks: 0, named: 0, alias: 0, first_seq: r.seq_from, pos: p }));
      if (p) {
        const u = places.unitOf(r.story_id);
        a.units.set(u, (a.units.get(u) ?? 0) + 1);
      } else a.unplaced++;
    }
    s[r.how] += r.lines;
    s.first_seq = Math.min(s.first_seq, r.seq_from);
    if (!p) continue;
    const at = { scene: r.story_id, seq: r.seq_from, how: r.how, unit: places.unitOf(r.story_id), pos: [...p, r.seq_from] };
    if (better(a.first, at)) a.first = at;
    if (!a.last || comparePlace(at.pos, a.last.pos) > 0) a.last = at;
    if (r.how === 'speaks' && better(a.firstSpeaks, at)) a.firstSpeaks = at;
    if (r.how !== 'speaks' && better(a.firstNamed, at)) a.firstNamed = at;
  }
  return out;
}

/** 씬 → 읽는 자리 (1회독 순서 = 출시순 한 줄) */
export async function loadPlaces(db) {
  const ctx = await openContext(db);
  return scenePlaces(loadOrder(READ1_PREFIXES), ctx);
}

/** 자리 한 칸 글 — `ch07 d_main_07_01#3 (말함)` */
export const placeText = (at) => (at ? `${at.unit} ${at.scene}#${at.seq} (${howLabel(at.how)})` : '-');
