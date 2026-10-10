/**
 * 원문 읽기 — 챕터·이벤트·돌발·인물 단위로 대사를 뽑는다.
 * 사람이 보는 화면이 아니라 Claude가 스토리를 조사할 때 읽는 출력이다. 짧게 쓰고, 모든 항목에 키를 붙인다.
 *
 *   node tools/read.mjs list [main|event|side|sub|relic|erelic|sudden|char]  목차 — 키 · 씬 수 · 글자 수 · 파트 수
 *   node tools/read.mjs ch07                 메인 CHAPTER.07         (= chapter 7, chapter 재회)
 *   node tools/read.mjs event_nocallerid     이벤트                  (= event nocallerid)
 *   node tools/read.mjs sudden:22            돌발(전초기지 건물)      (= sudden 커맨드 센터)
 *   node tools/read.mjs char:10              인물 — 다른 곳에서 말한 씬 목록 + 호감도 스토리 전문 (= char 라피)
 *   node tools/read.mjs char:10 --lines      그 인물이 말한 대사만, 앞 문맥과 함께 (--context N, 기본 1)
 *   node tools/read.mjs d_main_07_01         씬 하나, 앞뒤 씬 키와 함께 (ep:… 호감도 스토리 편도)
 *   node tools/read.mjs side:mudfish         금서고 단위 — side:(사이드 스토리) · sub:(서브퀘스트) · relic:(유실물) ·
 *                                            erelic:(이벤트 유실물) · fl:(블라링크에 없는 이벤트). 씬은 side:mudfish_03
 *   node tools/read.mjs ch44 --part 2        긴 단위는 파트로 나뉜다. 머리말에 파트 수가 나온다
 *   node tools/read.mjs ch00 --num           줄마다 줄 번호(#N = DB lines.seq)를 붙인다 — 1회독 · 2회독은 이것으로 읽고
 *                                            근거를 `씬 ID#N`으로 적는다(docs/annotations.md). 글자 수 · 파트 경계는 --num 기준으로 다시 잰다
 *
 * 출력에 나오는 키(ch07, event_…, sudden:N, char:N, 씬 ID)는 그대로 다시 넣으면 된다 — 링크처럼 따라간다.
 * 파트는 씬 경계에서 고르게 나누고 MAX_CHARS를 넘지 않는다. Bash 출력 한도 안에서 한 번에 읽힌다.
 *
 * 용어: 이름표 = 대사창에 뜨는, 그 줄을 말한 인물 이름(speaker_name). 서술자가 아니다 —
 * 서술은 3인칭(Narration)이거나 지휘관 1인칭 독백(Monologue)이다. 호감도 스토리 = 니케별 개인 스토리 5편(데이터 episode).
 * 금서고 단위는 팬 사이트가 뽑은 원문이다(docs/data-sources.md "0. 요청 규칙"). 서술·독백 구분과 게임 씬 ID가 없고, 머리말에 출처를 적는다.
 * 시트 값(유형·★·선행·출시일)은 보여 주지 않는다. 시트는 참고자료이고 분석은 원문에서 독립적으로 한다 (CLAUDE.md).
 * 원문은 저작물이다. 이 출력을 레포 밖에 게시하지 않는다 (CLAUDE.md "저작물 취급").
 */
import { parseArgs } from 'node:util';
import { openDb } from './normalize/ensure-db.mjs';
import { LEGEND, LIBRARY_LEGEND, NUM_LEGEND, jumpTargets, oneLine, renderLine } from './lib/render.mjs';
import { KIND_LABEL, buildUnits, isLibrary, pad2 } from './lib/units.mjs';

/** 파트 하나의 최대 글자 수 (머리말 제외) */
const MAX_CHARS = 20_000;

const USAGE = `원문 읽기 (tools/read.mjs)
  list [main|event|side|sub|relic|erelic|sudden|char]   목차 — 키 · 씬 수 · 글자 수 · 파트 수
  <키>                            ch07 · event_nocallerid · sudden:22 · char:10 · char:마리안 · d_main_07_01
                                  금서고: side:mudfish · sub:칠리페퍼 · relic:어느남자의수기 · erelic:old_tales_dialog · fl:absolute
  chapter|event|side|sub|relic|erelic|sudden|char <이름>  이름·번호로 찾기
옵션: --part N · --num(줄마다 줄 번호 #N — 1회독 · 2회독은 이것으로 읽는다) · --lines(인물이 말한 대사만) · --context N ·
      --speaker <이름표> · --max <글자 수>`;

const { values: opt, positionals } = parseArgs({
  options: {
    part: { type: 'string' },
    max: { type: 'string' },
    lines: { type: 'boolean' },
    num: { type: 'boolean' },
    context: { type: 'string' },
    speaker: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

if (opt.help || !positionals.length) {
  console.log(USAGE);
  process.exit(positionals.length ? 0 : 1);
}
const MAX = Number(opt.max ?? MAX_CHARS);
if (!(MAX >= 2000)) fail('--max는 2000 이상이어야 한다');
const CONTEXT = Number(opt.context ?? 1);
if (!(CONTEXT >= 0)) fail('--context는 0 이상이어야 한다');

const db = await openDb().catch((err) => fail(err.message));
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);

const fmt = (n) => n.toLocaleString('ko-KR');
/** 이름 비교 키 — build.mjs의 nk()와 같다 (대소문자·공백·문장부호 무시, `_`는 남김) */
const nk = (x) => (x ?? '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();

// ── 단위 ────────────────────────────────────────────────────────────────────
// 단위 = 카테고리 하나. 메인 챕터 · 아카이브 이벤트 · 돌발 건물 · 인물(호감도 스토리 카테고리).
// 주의: main:N의 N은 챕터 번호가 아니다(main:8 = CHAPTER.07). 번호는 locale_key에서 온다.
// 이름은 게임 데이터에서 온다. 이벤트만 예외 — 게임 데이터에 표시명이 없어 시트 제목을 라벨로 빌려 쓴다(키는 event_… ID).

const units = buildUnits(all('SELECT * FROM categories'));
const unitByCat = new Map(units.map((u) => [u.cat.id, u]));
const unitsOf = (source) => units.filter((u) => u.source === source);
/** 블라링크 이벤트(본문 없음)를 대신하는 금서고 단위 */
const mirrorOf = (u) => (u?.source === 'archive' ? units.find((x) => x.gameKey && x.gameKey === u.key) : null);
const libraryNote = (st) =>
  `출처: 금서고(nikkeforbiddenlibrary.com) — 팬 사이트가 뽑은 원문. 서술·독백 구분과 게임 씬 ID가 없다` +
  (st?.source_ref ? ` · 금서고 ID ${st.source_ref}` : '');

const storiesOf = (catId) => all('SELECT * FROM stories WHERE category_id = ? ORDER BY order_index, id', catId);
/**
 * 분석 범위(결정 #5, annotations/scope.json) 안내. 범위 밖도 읽히지만 1회독 · 후보 · 통계에서는 뺀다.
 * 단위 안에 범위 안 씬이 일부만 있으면(돌발 엘리베이터) 그 씬을 알려 준다
 */
function scopeNote(stories) {
  const out = stories.filter((s) => s.in_scope === 0);
  if (!out.length) return null;
  const inside = stories.filter((s) => s.in_scope !== 0).map((s) => s.id);
  const why = out[0].scope_note ?? '';
  return inside.length
    ? `분석 범위 밖 씬이 섞여 있다 — 범위 안: ${inside.join(' · ')} (${why})`
    : `분석 범위 밖 — ${why}. 읽을 수는 있지만 1회독 · 후보 · 통계에서 뺀다`;
}
const linesOf = (storyId) =>
  all('SELECT seq, speaker_id, speaker_name, text, window, jump_to FROM lines WHERE story_id = ? ORDER BY seq', storyId);

// ── 대사 렌더링 ─────────────────────────────────────────────────────────────


function sceneHead(st, note) {
  return `## ${st.id}${st.title ? ` · ${oneLine(st.title)}` : ''}${note ? ` (${note})` : ''}`;
}

/** 씬 하나 = 블록 하나. 파트는 블록 경계에서 자른다 */
function sceneBlock(st, note) {
  const head = sceneHead(st, note);
  const library = isLibrary(st.source);
  if (!st.has_text) return { id: st.id, library, text: `${head} — 본문 없음\n` };
  const ls = linesOf(st.id);
  const targets = jumpTargets(ls);
  const body = ls.map((l) => renderLine(l, targets, { num: opt.num })).filter(Boolean);
  return { id: st.id, library, text: `${head}\n${body.join('\n')}\n` };
}

// ── 파트 나누기 ─────────────────────────────────────────────────────────────

/** max를 넘는 블록은 줄 단위로 쪼갠다. 2026-09 기준 가장 긴 씬도 1만 자 안쪽이라 드물다 */
function splitBlock(block, max) {
  const [head, ...rest] = block.text.trimEnd().split('\n');
  const out = [];
  let cur = [head];
  let size = head.length + 1;
  for (const line of rest) {
    if (size + line.length + 1 > max && cur.length > 1) {
      out.push({ id: block.id, library: block.library, text: `${cur.join('\n')}\n` });
      cur = [`${head} (이어서)`];
      size = cur[0].length + 1;
    }
    cur.push(line);
    size += line.length + 1;
  }
  out.push({ id: block.id, library: block.library, text: `${cur.join('\n')}\n` });
  return out;
}

/** 앞에서부터 cap까지 채워 자른다 */
function fillParts(pieces, cap) {
  const parts = [];
  let cur = [];
  let size = 0;
  for (const p of pieces) {
    const len = p.text.length + 1;
    if (cur.length && size + len > cap) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += len;
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/**
 * 블록을 파트로 묶는다. max까지 채우면 파트 수가 가장 적게 나오고, 그 파트 수를 지키는 가장 작은 상한을
 * 이분 탐색으로 찾아 다시 채우면 크기가 고르게 된다. 결과는 입력에 대해 결정적이라 --part N이 늘 같은 곳을 가리킨다.
 */
function splitParts(blocks, max) {
  const pieces = blocks.flatMap((b) => (b.text.length + 1 <= max ? [b] : splitBlock(b, max)));
  const count = fillParts(pieces, max).length;
  const total = pieces.reduce((n, p) => n + p.text.length + 1, 0);
  let lo = Math.ceil(total / count);
  let hi = max;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fillParts(pieces, mid).length <= count) hi = mid;
    else lo = mid + 1;
  }
  return fillParts(pieces, lo);
}

const partsText = (part) => part.map((p) => p.text).join('\n');
const blocksSize = (blocks) => blocks.reduce((n, b) => n + b.text.length + 1, 0);

/** 다음 파트를 부를 때 붙일 옵션 (--part 빼고 그대로) */
function carryFlags() {
  const f = [];
  if (opt.num) f.push('--num');
  if (opt.lines) f.push('--lines');
  if (opt.context !== undefined) f.push(`--context ${opt.context}`);
  if (opt.speaker) f.push(`--speaker "${opt.speaker}"`);
  if (opt.max) f.push(`--max ${opt.max}`);
  return f.length ? ` ${f.join(' ')}` : '';
}

function printParts(key, heading, extra, blocks) {
  const parts = splitParts(blocks, MAX);
  const want = Number(opt.part ?? 1);
  if (!Number.isInteger(want) || want < 1 || want > parts.length) fail(`${key}: 파트는 1~${parts.length}이다`);
  const part = parts[want - 1];
  const out = [`# ${key} · ${heading} · ${fmt(blocksSize(blocks))}자 · 파트 ${want}/${parts.length}`];
  out.push(...extra.filter(Boolean));
  if (parts.length > 1) {
    const first = part[0].id;
    const last = part.at(-1).id;
    out.push(`이 파트: ${first}${first !== last ? ` → ${last}` : ''}`);
  }
  out.push(opt.num ? `${LEGEND} · ${NUM_LEGEND}` : LEGEND);
  if (part.some((p) => p.library)) out.push(LIBRARY_LEGEND);
  out.push('', partsText(part));
  if (want < parts.length) out.push(`— 파트 ${want}/${parts.length} 끝. 다음: node tools/read.mjs ${key} --part ${want + 1}${carryFlags()}`);
  else if (parts.length > 1) out.push(`— 마지막 파트 (${parts.length}/${parts.length})`);
  process.stdout.write(`${out.join('\n')}\n`);
}

// ── 단위별 출력 ─────────────────────────────────────────────────────────────

function neighbors(u) {
  const same = unitsOf(u.source);
  const i = same.indexOf(u);
  const links = [];
  if (i > 0) links.push(`이전: ${same[i - 1].key}`);
  if (i < same.length - 1) links.push(`다음: ${same[i + 1].key}`);
  return links.join(' · ') || null;
}

function categoryBlocks(u) {
  const stories = storiesOf(u.cat.id).filter((s) => s.kind === 'scene' || s.kind === 'episode');
  return { stories, blocks: stories.map((s) => sceneBlock(s)) };
}

function readCategory(u) {
  const { stories, blocks } = categoryBlocks(u);
  const withText = stories.filter((s) => s.has_text).length;
  const textNote = withText < stories.length ? ` (본문 있음 ${withText})` : '';
  const extra = [neighbors(u), scopeNote(stories)];
  if (u.library) extra.unshift(libraryNote() + (u.gameKey ? ` · 블라링크 ${u.gameKey}(본문 없음)를 대신한다` : ''));
  const mirror = mirrorOf(u);
  if (mirror) extra.unshift(`본문은 금서고에 있다: node tools/read.mjs ${mirror.key}`);
  printParts(u.key, `${u.title} — ${KIND_LABEL[u.source]} · 씬 ${stories.length}${textNote}`, extra, blocks);
}

// ── 인물 ────────────────────────────────────────────────────────────────────
// 인물은 이름표(그 줄을 말한 인물 이름)로 찾는다. 서술(3인칭·지휘관 독백) 속에만 나오거나
// 이름이 불리기만 한 장면은 잡히지 않는다.

/** 비슷한 이름표. `라피 : 레드 후드`처럼 이명이 붙은 캐릭터는 대사의 이름표가 다를 수 있다 */
function similarLabels(name) {
  const bits = name.split(/\s*[:：]\s*/).map((s) => s.trim()).filter((s) => [...s].length >= 2);
  if (!bits.length) return [];
  const cond = bits.map(() => 'speaker_name LIKE ?').join(' OR ');
  return all(
    `SELECT speaker_name, COUNT(*) n FROM lines WHERE (${cond}) AND speaker_name <> ?
      GROUP BY speaker_name ORDER BY n DESC LIMIT 8`,
    ...bits.map((b) => `%${b}%`),
    name,
  );
}

/** 이 이름표로 말한 씬을 단위별로 묶는다. 순서는 메인(챕터 번호) → 이벤트 → 돌발 → 호감도 스토리 */
function appearances(speaker, excludeCatId) {
  const rows = all(
    `SELECT s.id, s.category_id, s.order_index, COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id
      WHERE l.speaker_name = ? GROUP BY s.id`,
    speaker,
  ).filter((r) => r.category_id !== excludeCatId);
  const byCat = new Map();
  for (const r of rows) {
    if (!byCat.has(r.category_id)) byCat.set(r.category_id, []);
    byCat.get(r.category_id).push(r);
  }
  const groups = [...byCat].map(([catId, scenes]) => ({
    unit: unitByCat.get(catId),
    catId,
    scenes: scenes.sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id)),
  }));
  const sortOf = (g) => g.unit?.sort ?? [9, 0];
  groups.sort((a, b) => sortOf(a)[0] - sortOf(b)[0] || sortOf(a)[1] - sortOf(b)[1]);
  return groups;
}

function appearanceBlock(speaker, groups, excluded) {
  const scenes = groups.reduce((n, g) => n + g.scenes.length, 0);
  const lineCount = groups.reduce((n, g) => n + g.scenes.reduce((m, s) => m + s.n, 0), 0);
  const scope = excluded ? ', 자기 호감도 스토리 제외' : '';
  if (!groups.length) return { id: '말한 씬 목록', text: `## 말한 씬 목록 — 이름표 '${speaker}'의 대사 없음${scope}\n` };
  const rows = groups.map((g) => {
    const label = g.unit ? `${g.unit.key} ${g.unit.title}` : g.catId ?? '(카테고리 없음)';
    const n = g.scenes.reduce((m, s) => m + s.n, 0);
    return `${label} — ${g.scenes.length}씬 ${n}줄: ${g.scenes.map((s) => `${s.id}·${s.n}`).join(' ')}`;
  });
  const head = `## 말한 씬 목록 — 이름표 '${speaker}'${scope} · ${groups.length}단위 ${scenes}씬 ${fmt(lineCount)}줄 (씬ID·줄 수)`;
  return { id: '말한 씬 목록', text: `${head}\n${rows.join('\n')}\n` };
}

/** 그 인물이 말한 대사만, 앞 문맥 CONTEXT줄과 함께. 떨어진 구간 사이는 ⋯ */
function speakerLineBlocks(speaker, groups) {
  const blocks = [];
  for (const g of groups) {
    for (const sc of g.scenes) {
      const st = one('SELECT * FROM stories WHERE id = ?', sc.id);
      const ls = linesOf(sc.id);
      const keep = new Set();
      ls.forEach((l, i) => {
        if (l.speaker_name !== speaker) return;
        for (let k = Math.max(0, i - CONTEXT); k <= i; k++) keep.add(k);
      });
      const out = [];
      let prev = -1;
      for (const i of [...keep].sort((a, b) => a - b)) {
        if (prev >= 0 && i > prev + 1) out.push('⋯');
        const r = renderLine(ls[i], new Set(), { jumps: false, num: opt.num });
        if (r) out.push(r);
        prev = i;
      }
      const note = g.unit ? `${g.unit.key} ${g.unit.title}` : null;
      blocks.push({ id: sc.id, text: `${sceneHead(st, note)}\n${out.join('\n')}\n` });
    }
  }
  return blocks;
}

function readChar(u) {
  const speaker = opt.speaker ?? u.speaker;
  const stories = u.cat ? storiesOf(u.cat.id) : [];
  const episodes = stories.filter((s) => s.kind === 'episode');
  const favs = stories.filter((s) => s.kind === 'favorite');
  const extra = [];
  if (u.rid) extra.push(`인물: ${charInfo(u.rid)}`);
  for (const f of favs) extra.push(`애장품: ${f.id} ${f.title} — ${oneLine(f.description).slice(0, 160)}`);
  const similar = similarLabels(speaker);
  extra.push(
    `이름표 '${speaker}'로 찾음 (--speaker로 바꿀 수 있다)` +
      (similar.length ? ` · 비슷한 이름표: ${similar.map((s) => `${s.speaker_name}(${s.n})`).join(', ')}` : ''),
  );

  if (opt.lines) {
    const groups = appearances(speaker, null);
    const blocks = speakerLineBlocks(speaker, groups);
    if (!blocks.length) fail(`이름표 '${speaker}'로 된 대사가 없다`);
    const n = groups.reduce((m, g) => m + g.scenes.reduce((k, s) => k + s.n, 0), 0);
    printParts(u.key, `${u.title} — 말한 대사 모음 · ${blocks.length}씬 ${fmt(n)}줄 · 앞 문맥 ${CONTEXT}줄`, extra, blocks);
    return;
  }
  const groups = appearances(speaker, u.cat?.id ?? null);
  const blocks = [appearanceBlock(speaker, groups, Boolean(u.cat)), ...episodes.map((s) => sceneBlock(s))];
  const scenes = groups.reduce((n, g) => n + g.scenes.length, 0);
  const summary = u.cat
    ? `인물 · 호감도 스토리 ${episodes.length}편 · 다른 곳에서 말한 씬 ${scenes}`
    : `인물(호감도 스토리 없음) · 말한 씬 ${scenes}`;
  printParts(u.key, `${u.title} — ${summary}`, [...extra, neighbors(u)], blocks);
}

/** 게임 데이터(characters)의 인물 정보 한 줄 */
function charInfo(rid) {
  const c = one('SELECT * FROM characters WHERE resource_id = ?', rid);
  return c ? `rid ${c.resource_id} · ${[c.corporation, c.class, c.rarity].filter(Boolean).join(' · ')}` : `rid ${rid}`;
}

// ── 씬 하나 ─────────────────────────────────────────────────────────────────

function readStory(st) {
  const u = st.category_id ? unitByCat.get(st.category_id) : null;
  const extra = [];
  if (u) {
    const ids = storiesOf(u.cat.id).filter((s) => s.kind === st.kind).map((s) => s.id);
    const i = ids.indexOf(st.id);
    extra.push(`단위: ${u.key} ${u.title} · ${i + 1}/${ids.length}`);
    const nav = [];
    if (i > 0) nav.push(`이전: ${ids[i - 1]}`);
    if (i >= 0 && i < ids.length - 1) nav.push(`다음: ${ids[i + 1]}`);
    if (nav.length) extra.push(nav.join(' · '));
    const mirror = mirrorOf(u);
    if (mirror && !st.has_text) extra.push(`본문은 금서고에 있다: node tools/read.mjs ${mirror.key}`);
  }
  if (isLibrary(st.source)) extra.push(libraryNote(st));
  extra.push(scopeNote([st]));
  if (st.kind === 'favorite' || st.kind === 'placeholder') {
    const what = st.kind === 'favorite' ? '애장품' : '시트에만 있는 이름(참고)';
    const out = [`# ${st.id} · ${st.title ?? ''} — ${what} · 원문 없음`, ...extra.filter(Boolean)];
    if (st.owner) out.push(`소유: ${st.owner}`);
    if (st.description) out.push(`설명: ${oneLine(st.description)}`);
    out.push('관계: node tools/query.mjs links ' + st.id);
    process.stdout.write(`${out.join('\n')}\n`);
    return;
  }
  printParts(st.id, `${oneLine(st.title) || '(제목 없음)'} — 씬 · ${st.line_count}줄`, extra, [sceneBlock(st)]);
}

// ── 목차 ────────────────────────────────────────────────────────────────────

function unitStats(u) {
  if (u.source === 'episode') {
    const episodes = storiesOf(u.cat.id).filter((s) => s.kind === 'episode');
    const groups = appearances(u.speaker, u.cat.id);
    const blocks = [appearanceBlock(u.speaker, groups, true), ...episodes.map((s) => sceneBlock(s))];
    const scenes = groups.reduce((n, g) => n + g.scenes.length, 0);
    return { scenes: episodes.length, withText: episodes.filter((s) => s.has_text).length, size: blocksSize(blocks), parts: splitParts(blocks, MAX).length, elsewhere: scenes };
  }
  const { stories, blocks } = categoryBlocks(u);
  return { scenes: stories.length, withText: stories.filter((s) => s.has_text).length, size: blocksSize(blocks), parts: splitParts(blocks, MAX).length };
}

const LIST_KINDS = {
  main: ['main'], side: ['fl-side'], sub: ['fl-subquest'], relic: ['fl-relic'],
  event: ['archive', 'fl-event'], erelic: ['fl-eventrelic'], sudden: ['sudden'], char: ['episode'],
};
const LIST_LABEL = {
  main: '메인', side: '사이드 스토리(금서고)', sub: '서브퀘스트(금서고)', relic: '유실물(금서고)',
  event: '이벤트', erelic: '이벤트 유실물(금서고)', sudden: '돌발', char: '인물',
};
const unitsOfKind = (kind) => units.filter((u) => LIST_KINDS[kind].includes(u.source));

function listKind(kind) {
  if (!LIST_KINDS[kind]) fail(`목차 종류: ${Object.keys(LIST_KINDS).join(' | ')}`);
  const source = LIST_KINDS[kind][0];
  const rows = unitsOfKind(kind).map((u) => ({ u, s: unitStats(u) }));
  const tot = rows.reduce((a, { s }) => ({ scenes: a.scenes + s.scenes, size: a.size + s.size, parts: a.parts + s.parts }), { scenes: 0, size: 0, parts: 0 });
  const out = [
    `# ${LIST_LABEL[kind]} — ${rows.length}단위 · 씬 ${fmt(tot.scenes)} · ${fmt(tot.size)}자 · 파트 ${tot.parts} (파트당 ≤${fmt(MAX)}자)`,
    `키를 그대로 넣으면 읽는다: node tools/read.mjs ${rows[0]?.u.key ?? '<키>'}`,
  ];
  if (rows.some(({ u }) => u.library)) out.push('금서고 단위는 팬 사이트가 뽑은 원문이다 — 서술·독백 구분과 게임 씬 ID가 없다');
  const kindStories = all(
    `SELECT id, in_scope, scope_note FROM stories WHERE source = ? AND kind IN ('scene', 'episode') ORDER BY id`, source);
  const scopeLine = scopeNote(kindStories);
  if (scopeLine) out.push(scopeLine);
  for (const { u, s } of rows) {
    const mirror = mirrorOf(u);
    const body =
      s.withText === 0 ? `본문 없음${mirror ? ` → 금서고 ${mirror.key}` : ''}` : `${fmt(s.size)}자 · ${s.parts}파트`;
    const scenes = source === 'episode' ? `호감도 스토리 ${s.scenes}편 · 다른 곳 ${s.elsewhere}씬` : `씬 ${s.scenes}${s.withText < s.scenes && s.withText ? `(본문 ${s.withText})` : ''}`;
    out.push(`${u.key} ${u.title} · ${scenes} · ${body}${u.source === 'fl-event' ? ' (금서고)' : ''}`);
  }
  if (source === 'episode') {
    // 호감도 스토리가 없는 인물(마리안, 엔더슨 등)도 이름표로 부를 수 있다
    const known = new Set(rows.map(({ u }) => u.speaker));
    const npcs = all(
      `SELECT speaker_name, COUNT(*) n, COUNT(DISTINCT story_id) sc FROM lines
        WHERE speaker_name IS NOT NULL GROUP BY speaker_name HAVING n >= 100 ORDER BY n DESC`,
    ).filter((r) => !known.has(r.speaker_name));
    out.push('', `## 호감도 스토리가 없는 이름표 (대사 100줄 이상, ${npcs.length}개) — 말한 씬 목록·대사 모음만 있다`);
    out.push(npcs.map((r) => `char:${r.speaker_name}(${fmt(r.n)}줄/${r.sc}씬)`).join(' · '));
  }
  process.stdout.write(`${out.join('\n')}\n`);
}

function listAll() {
  const out = [`# 원문 목차 — 파트당 ≤${fmt(MAX)}자`];
  for (const kind of Object.keys(LIST_KINDS)) {
    const source = LIST_KINDS[kind][0];
    const rows = unitsOfKind(kind).map(unitStats);
    const size = rows.reduce((n, s) => n + s.size, 0);
    const parts = rows.reduce((n, s) => n + s.parts, 0);
    const scenes = rows.reduce((n, s) => n + s.scenes, 0);
    out.push(`${LIST_LABEL[kind]} ${rows.length}단위 · ${source === 'episode' ? '호감도 스토리' : '씬'} ${fmt(scenes)} · ${fmt(size)}자 · 파트 ${parts} — node tools/read.mjs list ${kind}`);
  }
  out.push('키: ch07 · event_nocallerid · sudden:22 · char:10 · char:마리안 · d_main_07_01 (씬) — 그대로 넣으면 읽는다');
  out.push('금서고 키: side:mudfish · sub:칠리페퍼 · relic:어느남자의수기 · erelic:old_tales_dialog · fl:absolute (씬은 끝에 _NN)');
  process.stdout.write(`${out.join('\n')}\n`);
}

// ── 키 해석 ─────────────────────────────────────────────────────────────────

/**
 * 이름으로 단위를 찾는다. 정확히 같은 것 → 이름에 질의가 들어 있는 것 순.
 * 반대 방향(질의에 이름이 들어 있음)은 보지 않는다 — `마리안`이 `마리`(콜라보)에 걸린다.
 */
function candidates(list, q, { partial = true } = {}) {
  const k = nk(q);
  if (!k) return [];
  const exact = list.filter((u) => u.names.some((n) => n && nk(n) === k));
  if (exact.length || !partial) return exact;
  return list.filter((u) => u.names.some((n) => n && nk(n).includes(k)));
}

/** 호감도 스토리가 없는 인물은 이름표로 단위를 만든다 */
function speakerUnit(name) {
  const r = one('SELECT speaker_name FROM lines WHERE speaker_name = ? LIMIT 1', name);
  return r ? { source: 'speaker', key: `char:${name}`, title: name, speaker: name } : null;
}

/** 인물: resource_id → 이름이 같은 캐릭터 → 이름표가 같은 인물(NPC) → 이름 일부 순으로 찾는다 */
function resolveChar(q) {
  if (/^\d+$/.test(q)) return unitsOf('episode').find((u) => String(u.rid) === q) ?? fail(`char:${q} — 그런 resource_id의 호감도 스토리가 없다`);
  const chars = unitsOf('episode');
  const exact = candidates(chars, q, { partial: false });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) ambiguous(q, exact);
  const sp = speakerUnit(q);
  if (sp) return sp;
  const found = candidates(chars, q);
  if (found.length === 1) return found[0];
  if (found.length > 1) ambiguous(q, found);
  const near = all('SELECT speaker_name, COUNT(*) n FROM lines WHERE speaker_name LIKE ? GROUP BY speaker_name ORDER BY n DESC LIMIT 10', `%${q}%`);
  fail(`'${q}'에 맞는 인물이 없다${near.length ? ` — 비슷한 이름표: ${near.map((r) => `char:${r.speaker_name}(${r.n})`).join(' · ')}` : ''}`);
}

/** 후보가 여럿이면 키와 함께 늘어놓는다. 인물은 게임 데이터(소속·클래스)로 구분이 가게 한다 — 사쿠라가 둘이다 */
function ambiguous(q, list) {
  const rows = list.slice(0, 20).map((u) => `  ${u.key}  ${u.title}${u.rid ? ` (${charInfo(u.rid)})` : ''}`);
  fail(`'${q}'에 맞는 단위가 ${list.length}개다. 키로 다시 부를 것:\n${rows.join('\n')}`);
}

function findStory(id) {
  return one('SELECT * FROM stories WHERE id = ?', id) ?? one('SELECT * FROM stories WHERE lower(id) = lower(?)', id);
}

function resolve(args) {
  const [head, ...rest] = args;
  const q = rest.join(' ').trim();
  const kinds = { chapter: 'main', ch: 'main', event: 'event', sudden: 'sudden', side: 'side', sub: 'sub', relic: 'relic', erelic: 'erelic' };
  if (head === 'char') return q ? resolveChar(q) : fail('char 뒤에 이름이나 resource_id가 필요하다');
  if (head === 'scene') return findStory(q) ?? fail(`없는 씬: ${q}`);
  if (kinds[head]) {
    if (!q) fail(`${head} 뒤에 이름이나 번호가 필요하다`);
    const list = unitsOfKind(kinds[head]);
    if (kinds[head] === 'main' && /^\d+$/.test(q)) return list.find((u) => u.num === Number(q)) ?? fail(`CHAPTER.${pad2(q)}가 없다 (00~${pad2(list.at(-1).num)})`);
    const found = candidates(list, q);
    if (found.length === 1) return found[0];
    if (found.length > 1) ambiguous(q, found);
    fail(`'${q}'에 맞는 ${LIST_LABEL[kinds[head]]} 단위가 없다 — node tools/read.mjs list ${kinds[head]}`);
  }

  const key = args.join(' ').trim();
  const ch = key.match(/^(?:ch|chapter)[\s.:_-]*(\d+)$/i);
  if (ch) return unitsOf('main').find((u) => u.num === Number(ch[1])) ?? fail(`CHAPTER.${pad2(ch[1])}가 없다`);
  const charKey = key.match(/^char:(.+)$/);
  if (charKey) return resolveChar(charKey[1].trim());
  const byUnitKey = units.find((u) => u.key === key || u.cat.id === key) ?? units.find((u) => u.key.toLowerCase() === key.toLowerCase());
  const story = findStory(key);
  if (story) return story; // 씬 ID가 이벤트 접두(event_…)로 시작해도 씬이 먼저다
  if (byUnitKey) return byUnitKey;
  const exact = candidates(units, key, { partial: false });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) ambiguous(key, exact);
  const sp = speakerUnit(key);
  if (sp) return sp;
  const found = candidates(units, key);
  if (found.length === 1) return found[0];
  if (found.length > 1) ambiguous(key, found);
  fail(`'${key}'를 못 찾았다. 목차: node tools/read.mjs list\n\n${USAGE}`);
}

// ── 진입점 ──────────────────────────────────────────────────────────────────

if (positionals[0] === 'list') {
  if (positionals[1]) listKind(positionals[1]);
  else listAll();
} else {
  const target = resolve(positionals);
  if (target.kind && target.id) readStory(target); // stories 행
  else if (target.source === 'episode' || target.source === 'speaker') readChar(target);
  else readCategory(target);
}
db.close();
