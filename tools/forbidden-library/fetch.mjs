/**
 * 니갤 금서고(nikkeforbiddenlibrary.com) 수집기 — 블라링크에 없는 스토리의 보조 출처.
 *
 * 금서고는 팬이 게임에서 직접 뽑아 올리는 스토리 원문 사이트다(docs/data-sources.md "금서고").
 * 블라링크 아카이브에 없는 것만 받는다: 사이드 스토리 · 서브퀘스트(메신저) · 유실물 · 이벤트 유실물 전부와
 * 블라링크에 원문이 없는 이벤트. 블라링크에 있는 단위(메인 · 돌발 · 호감도 스토리 · 받아 둔 이벤트)는 받지 않는다.
 *
 *   node tools/forbidden-library/fetch.mjs           목록을 확인하고 없는 파일 · 버전이 바뀐 파일만 받는다
 *   node tools/forbidden-library/fetch.mjs --plan    목록만 확인하고 무엇을 받을지 보여 준다
 *   node tools/forbidden-library/fetch.mjs --force   고른 파일을 전부 다시 받는다
 *
 * 이벤트는 annotations/forbidden-library-events.json(금서고 파일 → 블라링크 이벤트 키)으로 고른다. 키가 null이거나 그 키의 원문이
 * 블라링크 raw에 없으면 받는다. 매핑에 없는 이벤트 파일은 받지 않고 "매핑 없음"으로 알린다.
 *
 * 저장: data/raw/forbidden-library/app-version.json      사이트 배포 시각
 *       data/raw/forbidden-library/script-manifest.json  전체 목록(배포 시각이 바뀔 때만 다시 받는다)
 *       data/raw/forbidden-library/scripts/<categoryKey>/<파일>  원문(받은 그대로)
 *       data/raw/forbidden-library/fetched.json          파일별로 받은 버전 · 시각 · 404
 *
 * 요청 규칙(CLAUDE.md "금서고 요청 규칙"): 한 번에 하나씩, 요청 사이 1초, 실패하면 지수 백오프
 * (1s → 2s → 4s) 최대 3회, 404는 다시 시도하지 않고 기록한다. mainChapterVersion이 바뀌지 않은 파일은
 * 다시 받지 않는다.
 */
import fs from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LIBRARY_DIR = path.join(ROOT, 'data/raw/forbidden-library');
export const SCRIPTS_DIR = path.join(LIBRARY_DIR, 'scripts');
export const MANIFEST_PATH = path.join(LIBRARY_DIR, 'script-manifest.json');
export const FETCHED_PATH = path.join(LIBRARY_DIR, 'fetched.json');
export const EVENTS_MAP_PATH = path.join(ROOT, 'annotations/forbidden-library-events.json');
const VERSION_PATH = path.join(LIBRARY_DIR, 'app-version.json');
const BLABLA_SCENE_DIR = path.join(ROOT, 'data/raw/scene/ko');

const SITE = 'https://nikkeforbiddenlibrary.com';

/** 통째로 받는 카테고리. 블라링크에 섹션 자체가 없다. */
export const FULL_CATEGORIES = ['side_stories', 'sub_quests', 'lost_relics', 'event_lost_relics'];
/** 블라링크에 없는 것만 골라 받는 카테고리. */
export const EVENT_CATEGORY = 'event_stories';

const DELAY_MS = 1000;
const RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

/** GET 하나. 요청 사이 간격을 지키고, 실패하면 지수 백오프로 다시 한다. 404는 null. */
async function get(urlPath) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(SITE + urlPath, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 404) return null;
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      // 정적 앱이라 없는 경로에 앱 페이지(HTML)를 200으로 돌려주기도 한다 — 원문이 아니므로 없음으로 친다.
      const type = res.headers.get('content-type') ?? '';
      const body = Buffer.from(await res.arrayBuffer());
      if (type.includes('text/html')) return null;
      return body;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`${RETRIES + 1}회 시도 실패: ${urlPath}\n  ${lastError?.message ?? lastError}`);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** 매니페스트 항목들을 파일 단위로 묶는다: `${categoryKey}/${mainChapterFile}` → { category, file, version, items } */
export function filesOf(manifest) {
  const files = new Map();
  for (const item of manifest) {
    const key = `${item.categoryKey}/${item.mainChapterFile}`;
    if (!files.has(key)) {
      files.set(key, { key, category: item.categoryKey, file: item.mainChapterFile, version: item.mainChapterVersion, items: [] });
    }
    files.get(key).items.push(item);
  }
  return files;
}

/** 블라링크 raw에 이 이벤트 키의 원문 씬이 하나라도 있는가. */
export function blablaHasText(eventKey) {
  if (!eventKey || !existsSync(BLABLA_SCENE_DIR)) return false;
  const prefix = `scene_detail_${eventKey}_`;
  return readdirSync(BLABLA_SCENE_DIR).some((name) => name.startsWith(prefix));
}

/** 받을 파일을 고른다. */
export function plan(files, eventsMap) {
  const wanted = [];
  const unmapped = [];
  const skipped = [];
  for (const f of files.values()) {
    if (FULL_CATEGORIES.includes(f.category)) {
      wanted.push({ ...f, reason: f.category });
    } else if (f.category === EVENT_CATEGORY) {
      if (!(f.key in eventsMap)) unmapped.push(f);
      else if (blablaHasText(eventsMap[f.key])) skipped.push({ ...f, blabla: eventsMap[f.key] });
      else wanted.push({ ...f, reason: eventsMap[f.key] ? `블라링크 원문 없음(${eventsMap[f.key]})` : '블라링크에 없음' });
    }
  }
  return { wanted, unmapped, skipped };
}

async function main() {
  const { values: args } = parseArgs({
    options: { plan: { type: 'boolean', default: false }, force: { type: 'boolean', default: false } },
  });
  await fs.mkdir(LIBRARY_DIR, { recursive: true });

  // 1. 배포 시각 → 바뀌었을 때만 매니페스트를 다시 받는다.
  const versionBody = await get('/app-version.json');
  if (!versionBody) throw new Error('app-version.json을 못 받았다 — 사이트 구조가 바뀌었을 수 있다');
  const siteVersion = JSON.parse(versionBody.toString('utf8')).version;
  const prevVersion = (await readJson(VERSION_PATH, {})).version;
  let manifest = await readJson(MANIFEST_PATH, null);
  if (!manifest || prevVersion !== siteVersion || args.force) {
    const body = await get('/script-manifest.json');
    if (!body) throw new Error('script-manifest.json을 못 받았다 — 사이트 구조가 바뀌었을 수 있다');
    manifest = JSON.parse(body.toString('utf8'));
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 1) + '\n');
    await fs.writeFile(VERSION_PATH, JSON.stringify({ version: siteVersion }, null, 2) + '\n');
    console.log(`목록을 받았다: 사이트 배포 ${siteVersion} · ${manifest.length}항목`);
  } else {
    console.log(`목록 그대로: 사이트 배포 ${siteVersion} · ${manifest.length}항목`);
  }

  // 2. 받을 파일을 고른다.
  const eventsMap = await readJson(EVENTS_MAP_PATH, {});
  delete eventsMap._설명;
  const files = filesOf(manifest);
  const { wanted, unmapped, skipped } = plan(files, eventsMap);
  const fetched = await readJson(FETCHED_PATH, { version: 1, files: {} });
  const queue = wanted.filter((f) => {
    const prev = fetched.files[f.key];
    return args.force || !prev || prev.version !== f.version;
  });

  const byCategory = {};
  for (const f of wanted) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  console.log(`고른 파일 ${wanted.length}개 (${Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(' · ')})`);
  console.log(`  블라링크에 있어 건너뜀: 이벤트 ${skipped.length}개 · 받을 것: ${queue.length}개`);
  if (unmapped.length) {
    console.log(`  매핑(annotations/forbidden-library-events.json)에 없는 이벤트 파일 ${unmapped.length}개 — 매핑을 적어야 받는다:`);
    for (const f of unmapped) console.log(`    ${f.key}  ${f.items[0]?.title ?? ''}`);
  }
  if (args.plan) {
    for (const f of queue) console.log(`  받을 것: ${f.key}  (${f.reason})  ${f.items[0]?.title ?? ''}`);
    return;
  }

  // 3. 받는다.
  let written = 0;
  let missing = 0;
  for (const [i, f] of queue.entries()) {
    const urlPath = `/scripts/${encodeURIComponent(f.category)}/${encodeURIComponent(f.file)}?v=${encodeURIComponent(f.version)}`;
    const body = await get(urlPath);
    if (!body) {
      fetched.files[f.key] = { version: f.version, missing: true, checkedAt: new Date().toISOString() };
      missing++;
      console.log(`  [없음] ${f.key}`);
      continue;
    }
    const out = path.join(SCRIPTS_DIR, f.category, f.file);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, body);
    fetched.files[f.key] = { version: f.version, bytes: body.length, fetchedAt: new Date().toISOString() };
    written++;
    if ((i + 1) % 20 === 0) console.log(`  … ${i + 1}/${queue.length}`);
  }

  if (!written && !missing) {
    console.log('새로 받은 파일 없음');
    return;
  }
  fetched.updatedAt = new Date().toISOString();
  fetched.files = Object.fromEntries(Object.entries(fetched.files).sort((a, b) => a[0].localeCompare(b[0])));
  await fs.writeFile(FETCHED_PATH, JSON.stringify(fetched, null, 2) + '\n');
  console.log(`원문 ${written}개 저장 · 없음 ${missing}개 → ${path.relative(ROOT, SCRIPTS_DIR)}/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
