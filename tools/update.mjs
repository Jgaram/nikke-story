/**
 * N2b — 업데이트 확인. "업데이트"의 첫 단계: 공지에서 출발한 패치 목록 → 단위마다 원문 있음 · 없음 → 패치마다 처리됨 · 준비 · 보류.
 * 확인은 스크립트만 한다(docs/update.md "나누기"). Claude는 리포트를 읽기만 한다.
 *
 *   node tools/update.mjs             공지 · 블라링크 · 금서고를 증분으로 받고(받는 도구를 차례로 부른다) 판정한다
 *   node tools/update.mjs --no-fetch  받지 않고 받아 둔 것만으로 판정한다
 *   node tools/update.mjs --today 2026-10-14   판정 기준일(기본: 오늘 KST) — 테스트 · 다시 보기용
 *
 * 받기: tools/notices/fetch.mjs → tools/blabla/update.mjs(블라링크 증분 + 금서고, 새 단위는 annotations/hold.json "업데이트 전"으로).
 *   블라링크 목록이 404면 exit 2로 멈춘다(번들에서 규칙 재추출 — docs/data-sources.md "난독화 규칙이 깨지면").
 * 판정(docs/update.md "확인" 3 · 4):
 *   - 패치 = 정기 업데이트 공지 하나(제목 "… 업데이트 공지", 개선사항 공지는 아니다). 출시(정식 서비스 오픈)는 패치 0.
 *     공지 밖에서 처음 나온 단위(다른 공지 · 손 보정)는 그 날짜 직전의 패치에 든다.
 *   - 단위: 메인 챕터(+ 그 챕터의 서브퀘스트 · 유실물 = 금서고에 그 챕터가 올랐나) · 이벤트 · 사이드 스토리 · 신규 니케(호감도).
 *     원문은 DB 단위(data/normalized/) + 들이지 않은 원문(annotations/hold.json)에서 찾는다. 이름 잇기는 release-order.mjs와 같다.
 *   - 이벤트에 스토리 표지(머리줄 "스토리 이벤트" · "Part N: STORY …" · "스토리 라인에 … 추가")가 없으면 스토리가 있는지 모른다 —
 *     이벤트가 끝나고 GRACE_DAYS일까지 원문이 없으면 "스토리 없음으로 봄"(막지 않는다). 그 전은 "기다림"(막는다).
 *   - 처리됨 = 원문 있는 단위가 모두 annotations/reading-order.md 항목에 있고 그 항목이 모두 [x]. 그 밖에 막는 것이 있으면 보류, 없으면 준비.
 *     원문 없는 옛 단위는 NO_SOURCE_OK(아래)만 막지 않는다.
 * 출력: data/release/updates.md(원문 없이 키 · 이름 · 날짜만 — 공개 레포).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadNotices } from './notices/text.mjs';
import { kstDay } from './notices/kdate.mjs';
import {
  updateDay, findLaunch, extractMain, extractEvents, matchEvents, extractDebuts, UnitMatcher, SIDE_HEAD_RE, PART_RE, nameKey, OVERRIDES,
} from './notices/release-order.mjs';
import { LIBRARY_KINDS, stemOf } from './normalize/library.mjs';
import { ensureDb } from './normalize/ensure-db.mjs';
import { parseOrder } from './records/order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NORMALIZED = path.join(ROOT, 'data/normalized');
const REPORT = path.join(ROOT, 'data/release/updates.md');
const HOLD_PATH = path.join(ROOT, 'annotations/hold.json');
const ORDER_PATH = path.join(ROOT, 'annotations/reading-order.md');
const LIBRARY_MANIFEST = path.join(ROOT, 'data/raw/forbidden-library/script-manifest.json');
const ARCHIVE_LIST = path.join(ROOT, 'data/raw/archive/ko/archive_list.json');
const ALIASES = path.join(ROOT, 'tools/notices/aliases.json');

/**
 * 표지 없는 이벤트를 기다리는 날 수(이벤트 끝에서). 금서고는 이벤트를 에필로그 뒤 몇 주 안에 올리고(COIN RUSH 9/17 출시 →
 * 10/06, 이벤트 끝 10/08보다 앞), 블라링크 아카이브는 해를 넘겨 들어온다(ABSOLUTE 2025-08 → 2026-10). 표지 없는 이벤트 중
 * 스토리가 있던 4개(First Affection · Nonsense Red · OUT OF UNIFORM · FOOL BURST DAY)는 모두 블라링크에만 있다 —
 * 아카이브를 기다리면 패치가 한 해 막힌다. 그래서 금서고 몫(몇 주)만 기다리고, 그 뒤 들어오면 늦게 들어온 단위로 한다(docs/update.md "보류").
 */
export const GRACE_DAYS = 28;

/** 읽기 항목 접두 — 1회독 R · RE, 2회독 P · M. 새 패치의 U 항목 모양은 N2c에서 정한다(정하면 여기에 더한다). */
export const ORDER_PREFIXES = ['R', 'RE', 'P', 'M'];

/**
 * 공지에 있는데 블라링크 · 금서고 어디에도 원문이 없는 옛 이벤트(docs/update.md "보류" — 그대로 둔다). 공지 이름의 nameKey.
 * data/release/report.md "공지에 나왔지만 스토리 데이터에 없는 이벤트"에서 COIN RUSH SHOWDOWN을 뺀 것.
 */
export const NO_SOURCE_OK = new Set(
  ['Re:CIPE FOR YOU', 'YOU CAN (NOT) EVADE.', 'SECOND QUEST', 'YES, MY COMMANDER', 'CHOCOLATE, PLEASE!', 'FOOL METAL PANIC!'].map(nameKey),
);

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
};
const pad2 = (n) => String(n).padStart(2, '0');
const addDays = (day, n) => new Date(Date.parse(day) + n * 86400_000).toISOString().slice(0, 10);

/** 정기 업데이트 공지인가 — "9월 17일 업데이트 공지", "만우절 이벤트 업데이트 공지". 개선사항 · 점검 안내는 아니다. */
export const isPatchNotice = (n) => /업데이트\s*공지/.test(n.title) && !/개선\s*사항/.test(n.title);

/** 들이지 않은 원문(hold.json)을 단위 모양으로 — 금서고 파일은 금서고 단위 ID, 블라링크 이벤트는 아카이브 이름. */
export function heldUnits(hold, { libraryTitles = new Map(), archiveNames = new Map() } = {}) {
  const out = [];
  for (const [key, v] of Object.entries(hold)) {
    if (key.startsWith('_')) continue;
    const slash = key.indexOf('/');
    if (slash > 0) {
      const kind = LIBRARY_KINDS[key.slice(0, slash)];
      if (!kind) continue;
      out.push({ id: `${kind.prefix}:${stemOf(key.slice(slash + 1))}`, source: kind.source, name: libraryTitles.get(key) ?? key, gameKey: null, held: v });
    } else if (key.startsWith('event_')) {
      out.push({ id: `held:${key}`, source: 'archive', idPrefix: key, name: archiveNames.get(key) ?? key, held: v });
    } else if (/^char:\d+$/.test(key)) {
      out.push({ id: key, source: 'episode', resourceId: Number(key.slice(5)), held: v });
    } else if (/^ch\d+$/.test(key)) {
      out.push({ id: key, source: 'main', chapter: Number(key.slice(2)), held: v });
    }
  }
  return out;
}

/** 이벤트 절에 스토리 표지가 있나 — 머리줄 "스토리 이벤트", 절 안 "Part N: STORY …", 공지 어디든 "스토리 라인에 <이름> … 추가". */
export function storyMarked(a) {
  const lines = a.notice.lines;
  if (/스토리\s*이벤트/.test(lines[a.from])) return true;
  if (lines.slice(a.from + 1, a.to).some((l) => PART_RE.test(l))) return true;
  const k = nameKey(a.name);
  return lines.some((l) => /스토리\s*라인에/.test(l) && /추가/.test(l) && nameKey(l).includes(k));
}

/**
 * 패치 목록과 단위 상태를 계산한다(받지 않는다 — 입력은 모두 인자).
 * @returns {{ patches: object[], unplaced: object[] }}
 */
export function buildPatches({ notices, categories, storyHasText, characters, aliases = {}, overrides = [], held = [], flChapters = new Set(), order, today }) {
  const launch = findLaunch(notices);
  const patchNotices = notices.filter(isPatchNotice);
  const patches = [{ id: 'launch', day: launch.day, title: launch.notice.title, notice: launch.notice, units: [] }];
  for (const n of patchNotices) patches.push({ id: n.id, day: updateDay(n), title: n.title, notice: n, units: [] });
  patches.sort((a, b) => a.day.localeCompare(b.day) || a.notice.publishedAt - b.notice.publishedAt);
  const byNotice = new Map(patches.map((p) => [p.notice.id, p]));
  /** 공지 · 날짜 → 패치: 패치 공지면 그것, 아니면 그 날짜 직전(같은 날 포함)의 패치 */
  const patchOf = (notice, day) => byNotice.get(notice?.id) ?? patches.filter((p) => p.day <= day).at(-1) ?? patches[0];
  const overrideOf = new Map(overrides.map((o) => [o.key, o]));
  const unplaced = [];

  const hasText = (cat) => (cat.held ? true : storyHasText.has(cat.id));
  const allCats = [...categories, ...held.filter((h) => h.source !== 'main' && h.source !== 'episode')];

  // 메인 — 공지 "N 챕터 신규 개방", 출시 때 열린 챕터는 출시. 서브퀘스트 · 유실물은 금서고에 그 챕터가 올랐는지로 본다
  const mainByNum = new Map();
  for (const c of categories.filter((x) => x.source === 'main')) {
    const num = Number(c.localeKey?.match(/chapter_name_(\d+)/)?.[1]);
    if (Number.isFinite(num)) mainByNum.set(num, c);
  }
  const heldMain = new Map(held.filter((h) => h.source === 'main').map((h) => [h.chapter, h]));
  const opened = extractMain(notices);
  const mainNums = new Set([...opened.keys(), ...mainByNum.keys(), ...heldMain.keys()]);
  for (const num of [...mainNums].sort((a, b) => a - b)) {
    const key = `ch${pad2(num)}`;
    const hit = opened.get(num);
    const patch = hit ? patchOf(hit.notice, hit.day) : launch.chapters && num <= launch.chapters.last ? patches[0] : null;
    const cat = mainByNum.get(num);
    const unit = {
      kind: 'main', key, name: `CHAPTER.${pad2(num)} ${cat?.name ?? ''}`.trim(),
      state: heldMain.has(num) ? '들이지 않음' : cat ? '있음' : '없음', held: heldMain.get(num)?.held,
    };
    if (!patch) {
      unplaced.push(unit);
      continue;
    }
    patch.units.push(unit);
    patch.units.push({ kind: 'sub', key: `${key} 서브퀘스트 · 유실물`, name: '금서고에 그 챕터', state: flChapters.has(num) ? '있음' : '없음' });
  }

  // 이벤트 · 사이드 스토리
  const place = (kind, announced, cats, eventAliases) => {
    const { best, unmatched } = matchEvents(announced, cats, eventAliases);
    for (const cat of cats) {
      let key = cat.source === 'archive' ? cat.idPrefix : cat.id;
      let state = cat.held ? '들이지 않음' : hasText(cat) ? '있음' : '없음';
      // 블라링크 본문이 없고 금서고가 대신하는 이벤트(fl:… gameKey) — 금서고 단위가 원문이다
      if (state === '없음' && cat.source === 'archive') {
        const sub = categories.find((c) => c.source === 'fl-event' && c.gameKey === cat.idPrefix);
        if (sub) [key, state] = [sub.id, '있음'];
      }
      const unit = { kind, key, name: cat.name ?? key, state, held: cat.held };
      const a = best.get(cat.id);
      if (a) {
        patchOf(a.notice, a.day).units.push({ ...unit, start: a.day, end: a.end?.day ?? null, marked: kind === 'event' ? storyMarked(a) : true });
      } else if (overrideOf.has(key)) {
        const o = overrideOf.get(key);
        patchOf(null, o.date).units.push({ ...unit, start: o.date, end: null, marked: true, note: '손 보정' });
      } else {
        unplaced.push(unit);
      }
    }
    const seen = new Set();
    for (const a of unmatched) {
      const k = nameKey(a.name);
      if (seen.has(k)) continue;
      seen.add(k);
      const marked = kind === 'event' ? storyMarked(a) : true;
      const end = a.end?.day ?? null;
      let state = '없음';
      if (NO_SOURCE_OK.has(k)) state = '원문 없는 옛 단위';
      else if (!marked) state = end && addDays(end, GRACE_DAYS) < today ? '스토리 없음으로 봄' : '기다림';
      patchOf(a.notice, a.day).units.push({ kind, key: null, name: a.name, state, start: a.day, end, marked });
    }
  };
  const eventCats = allCats.filter((c) => (c.source === 'archive' && !(c.held && c.held.금서고)) || (c.source === 'fl-event' && !c.gameKey));
  place('event', extractEvents(notices), eventCats, aliases.events ?? []);
  place('side', extractEvents(notices, [SIDE_HEAD_RE]), allCats.filter((c) => c.source === 'fl-side'), []);

  // 신규 니케(호감도) — 첫 등장. 공지에 등장이 없는 니케는 출시 로스터(손 보정이 있으면 그 날짜)
  const matcher = new UnitMatcher(characters, aliases.characters ?? []);
  const first = new Map();
  const unresolved = new Map();
  for (const notice of notices) {
    const { debuts, unresolved: miss } = extractDebuts(notice, matcher);
    for (const d of debuts) {
      const prev = first.get(d.unit.resourceId);
      const k = (x) => `${x.day}|${x.introduced ? 1 : 0}|${x.notice.publishedAt.toISOString()}`;
      if (!prev || k(d) < k(prev)) first.set(d.unit.resourceId, d);
    }
    for (const u of miss) if (!unresolved.has(nameKey(u.name))) unresolved.set(nameKey(u.name), u);
  }
  const episodeCats = new Map(categories.filter((c) => c.source === 'episode').map((c) => [c.resourceId, c]));
  const heldEpisodes = new Map(held.filter((h) => h.source === 'episode').map((h) => [h.resourceId, h]));
  const charById = new Map(characters.map((c) => [c.resourceId, c]));
  const rids = new Set([...first.keys(), ...episodeCats.keys(), ...heldEpisodes.keys()]);
  for (const rid of rids) {
    const key = `char:${rid}`;
    const h = heldEpisodes.get(rid);
    const unit = { kind: 'episode', key, name: charById.get(rid)?.name ?? key, state: h ? '들이지 않음' : episodeCats.has(rid) ? '있음' : '없음', held: h?.held };
    const d = first.get(rid);
    if (overrideOf.has(key)) patchOf(null, overrideOf.get(key).date).units.push({ ...unit, start: overrideOf.get(key).date, note: '손 보정' });
    else if (d) patchOf(d.notice, d.day).units.push({ ...unit, start: d.day });
    else patches[0].units.push({ ...unit, start: launch.day, note: '출시 로스터' });
  }
  for (const u of unresolved.values()) {
    patchOf(u.notice, updateDay(u.notice)).units.push({ kind: 'episode', key: null, name: u.name, state: '없음', note: '인물 표에 없는 이름' });
  }

  // 상태
  const items = order?.items ?? [];
  const itemsOf = new Map();
  for (const it of items) itemsOf.set(it.key, [...(itemsOf.get(it.key) ?? []), it]);
  const blocking = new Set(['없음', '기다림']);
  for (const p of patches) {
    for (const u of p.units) {
      if (u.state !== '있음' || !u.key || u.kind === 'sub') continue;
      const its = itemsOf.get(u.key) ?? [];
      u.read = its.length ? (its.every((it) => it.state === 'x') ? '읽음' : '읽는 중') : '안 읽음';
    }
    const missing = p.units.filter((u) => blocking.has(u.state));
    const present = p.units.filter((u) => u.state === '있음' || u.state === '들이지 않음');
    if (missing.length) p.status = '보류';
    else if (present.every((u) => u.kind === 'sub' || u.read === '읽음')) p.status = '처리됨';
    else p.status = '준비';
    p.missing = missing;
  }
  return { patches, unplaced };
}

/** 리포트 — 처리 안 된 패치(준비 · 보류)를 자세히, 처리된 패치는 개수만. */
export function renderReport({ patches, unplaced }, { today, fetched }) {
  const L = [];
  const label = { main: '메인', sub: '서브퀘스트 · 유실물', event: '이벤트', side: '사이드', episode: '호감도' };
  L.push('# 업데이트 확인', '');
  L.push(`\`node tools/update.mjs\` — 기준일 ${today}${fetched ? '' : ' · 받지 않고 판정(--no-fetch)'}. 손으로 고치지 않는다. 원문은 싣지 않는다.`, '');
  const open = patches.filter((p) => p.status !== '처리됨');
  const done = patches.filter((p) => p.status === '처리됨');
  const next = open.find((p) => p.status === '준비');
  L.push(`패치 ${patches.length} — 처리됨 ${done.length} · 준비 ${open.filter((p) => p.status === '준비').length} · 보류 ${open.filter((p) => p.status === '보류').length}`, '');
  L.push(`**다음 패치**: ${next ? `${next.day} ${next.title}` : '없음'}`, '');
  const held = open.filter((p) => p.status === '보류' && (!next || p.day < next.day));
  if (held.length) {
    L.push(`보류 중: ${held.map((p) => `${p.day} ${p.title} — ${p.missing.map((u) => u.key ?? u.name).join(' · ')}`).join(' / ')}`, '');
  }
  L.push('## 처리 안 된 패치', '');
  if (!open.length) L.push('없음.', '');
  for (const p of open) {
    L.push(`### ${p.day} ${p.title} — ${p.status}`, '');
    L.push('| 종류 | 단위 | 원문 | 읽기 | 날짜 · 메모 |', '|---|---|---|---|---|');
    for (const u of p.units) {
      const key = u.key ? `\`${u.key}\`` : '—';
      const memo = [u.start && `${u.start}${u.end ? `~${u.end}` : ''}`, u.marked === false && '스토리 표지 없음', u.note, u.held && `hold ${u.held.까닭}`].filter(Boolean).join(' · ');
      L.push(`| ${label[u.kind]} | ${key} ${u.name ?? ''} | ${u.state} | ${u.read ?? ''} | ${memo} |`);
    }
    L.push('');
  }
  L.push('## 처리된 패치', '');
  L.push(`${done.length}개 — ${done[0]?.day ?? '-'} ~ ${done.at(-1)?.day ?? '-'}.`, '');
  const late = done.flatMap((p) => p.units.filter((u) => u.state === '스토리 없음으로 봄').map((u) => `${p.day} ${u.name}`));
  if (late.length) L.push(`스토리 없음으로 본 이벤트(표지 없음 · 끝나고 ${GRACE_DAYS}일 넘게 원문 없음): ${late.join(' · ')}`, '');
  L.push('## 패치에 못 넣은 단위', '');
  L.push('원문은 있는데 공지 · 손 보정에서 날짜를 못 찾은 것. `tools/notices/aliases.json` · `annotations/release-overrides.json`으로 잇는다.', '');
  L.push(unplaced.length ? unplaced.map((u) => `\`${u.key}\` ${u.name}`).join(' · ') : '없음.', '');
  return L.join('\n');
}

/** 받아 둔 것을 읽어 buildPatches 입력을 만든다. */
export function loadInputs({ today }) {
  const categories = readJson(path.join(NORMALIZED, 'categories.json'), []);
  const stories = readJson(path.join(NORMALIZED, 'stories.json'), []);
  const storyHasText = new Set(stories.filter((s) => s.hasText).map((s) => s.categoryId));
  const characters = readJson(path.join(NORMALIZED, 'characters.json'), []);
  const manifest = readJson(LIBRARY_MANIFEST, []);
  const libraryTitles = new Map();
  const flChapters = new Set();
  for (const it of manifest) {
    const key = `${it.categoryKey}/${it.mainChapterFile}`;
    if (!libraryTitles.has(key)) libraryTitles.set(key, it.title);
    const m = it.categoryKey === 'main_story' && it.mainChapterFile.match(/chapter_(\d+)/);
    if (m) flChapters.add(Number(m[1]));
  }
  const archiveNames = new Map();
  for (const e of readJson(ARCHIVE_LIST, [])) {
    const id = JSON.stringify(e).match(/"(event_[A-Za-z0-9]+?)_/)?.[1];
    const name = e.name_localkey?.name ?? e.title ?? null;
    if (id && name && !archiveNames.has(id)) archiveNames.set(id, name);
  }
  const held = heldUnits(readJson(HOLD_PATH, {}), { libraryTitles, archiveNames });
  const order = fs.existsSync(ORDER_PATH) ? parseOrder(fs.readFileSync(ORDER_PATH, 'utf8'), ORDER_PREFIXES) : { items: [] };
  return {
    notices: loadNotices(), categories, storyHasText, characters, aliases: readJson(ALIASES, {}),
    overrides: readJson(OVERRIDES, {}).overrides ?? [], held, flChapters, order, today,
  };
}

function run(script, args = []) {
  console.log(`\n▶ node ${script} ${args.join(' ')}`.trimEnd());
  const r = spawnSync(process.execPath, [path.join(ROOT, script), ...args], { stdio: 'inherit', cwd: ROOT });
  return r.status ?? 1;
}

async function main() {
  const { values } = parseArgs({ options: { 'no-fetch': { type: 'boolean', default: false }, today: { type: 'string' } } });
  const today = values.today ?? kstDay(new Date());
  const fetched = !values['no-fetch'];
  if (fetched) {
    if (run('tools/notices/fetch.mjs')) process.exit(1);
    const code = run('tools/blabla/update.mjs');
    if (code === 2) {
      console.error('⚠ 블라링크 목록이 404 — 번들에서 규칙 재추출 필요(docs/data-sources.md "난독화 규칙이 깨지면"). 판정하지 않고 멈춘다.');
      process.exit(2);
    }
    if (code) process.exit(code);
  }
  await ensureDb({ log: () => {} });
  const result = buildPatches(loadInputs({ today }));
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, renderReport(result, { today, fetched }) + '\n');
  const count = (s) => result.patches.filter((p) => p.status === s).length;
  const next = result.patches.find((p) => p.status === '준비');
  console.log(`\n패치 ${result.patches.length} — 처리됨 ${count('처리됨')} · 준비 ${count('준비')} · 보류 ${count('보류')} · 패치에 못 넣은 단위 ${result.unplaced.length}`);
  console.log(`다음 패치: ${next ? `${next.day} ${next.title}` : '없음'}`);
  console.log(`리포트: ${path.relative(ROOT, REPORT)}`);
  if (fetched) console.log('data/raw/가 바뀌었으면 원본 레포에 먼저 push하고 포인터를 커밋한다(CLAUDE.md "브랜치 규칙").');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack ?? err);
    process.exit(1);
  });
}
