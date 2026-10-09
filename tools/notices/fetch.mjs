/**
 * 공식 공지(패치노트) 수집기 — 출시 순서(T3-7)의 원본.
 *
 * 공식 사이트(nikke-kr.com)의 소식 페이지는 껍데기이고, 공지는 Level Infinite의 information-feeds CMS가
 * JSON POST로 준다. 2022-11-04 출시 이후 정기 업데이트 공지가 전부 여기 있다.
 * 방식은 nikke-analysis의 collect/notices.py(official)를 따랐다. 네이버 라운지는 쓰지 않는다 —
 * 스토리 개방은 공식 공지로 충분하다(사용자, 2026-09-28).
 *
 *   node tools/notices/fetch.mjs            새 공지 · 제목이 바뀐 공지 · 최근 45일 공지만 본문을 받는다
 *   node tools/notices/fetch.mjs --force    전부 다시 받는다
 *
 * 저장: data/raw/notices/official/<content_id>.json  (본문 요청 응답 그대로)
 *       data/raw/notices/index.json                   (공지 목록: 제목 · 게시 시각 · 칼럼 · 내용 해시)
 * 본문은 내용(제목 · 게시 시각 · 본문)이 바뀔 때만 다시 쓴다. 응답에는 조회수 같은 매번 바뀌는 값이 있어
 * 바이트를 비교하면 모든 공지가 바뀐 것처럼 보인다. 바뀐 게 없으면 index.json도 건드리지 않는다.
 *
 * 요청 규칙은 CDN 규칙(CLAUDE.md)과 같은 태도로: 한 번에 하나씩, 요청 사이 1초,
 * 실패하면 지수 백오프(1s → 2s → 4s) 최대 3회.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const NOTICES_DIR = path.join(ROOT, 'data/raw/notices');
export const OFFICIAL_DIR = path.join(NOTICES_DIR, 'official');
export const INDEX_PATH = path.join(NOTICES_DIR, 'index.json');

const API = 'https://na-community.playerinfinite.com/api/gpts.information_feeds_svr.InformationFeedsSvr';
const ORIGIN = 'https://www.nikke-kr.com';
const GAME_ID = '16';
const LANGUAGE = 'ko';

// CMS가 알려 주는 칼럼 이름(raw_label_name). id는 실행 때 찾고, 목록을 못 읽으면 아래 값을 쓴다.
const PRIMARY_LABEL = 'official_news';
const SECONDARY_LABELS = ['NOTICE', 'NEWS'];
const FALLBACK_IDS = { official_news: 309, NOTICE: 892, NEWS: 496 };
const PAGE_SIZE = 50;
const RECHECK_DAYS = 45;

const DELAY_MS = 1000;
const RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 사이트의 CMS SDK가 보내는 헤더. 없으면 API가 "데이터 없음"으로 답한다. */
const HEADERS = {
  'Content-Type': 'application/json;charset=utf-8',
  'X-GameId': GAME_ID,
  'X-AreaId': 'na',
  'X-Source': 'pc_web',
  'X-Language': LANGUAGE,
  Origin: ORIGIN,
  Referer: ORIGIN + '/',
};

let lastRequestAt = 0;

/** POST 하나. 요청 사이 간격을 지키고, 실패하면 지수 백오프로 다시 한다. */
async function post(method, body) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(`${API}/${method}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} — ${method}`);
        continue;
      }
      const text = await res.text();
      return { text, json: JSON.parse(text) };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`${RETRIES + 1}회 시도 실패: ${method}\n  ${lastError?.message ?? lastError}`);
}

/** 공지에서 뜻이 있는 부분(제목 · 게시 시각 · 본문)의 해시. */
export function digestOf(detail) {
  const stable = JSON.stringify([detail.title ?? '', String(detail.pub_timestamp ?? ''), detail.content ?? '']);
  return crypto.createHash('sha256').update(stable).digest('hex');
}

async function resolveLabels(notes) {
  let primaries = [];
  try {
    primaries = (await post('GetLabelList', {})).json?.data?.primary_label_list ?? [];
  } catch (err) {
    notes.push(`칼럼 목록을 못 읽음(${err.message}) — 기본 id를 쓴다`);
  }
  const primary = primaries.find((p) => p.raw_label_name === PRIMARY_LABEL);
  if (!primary) {
    if (primaries.length) notes.push(`칼럼 ${PRIMARY_LABEL}이 없음 — 기본 id를 쓴다`);
    return {
      primaryId: FALLBACK_IDS[PRIMARY_LABEL],
      secondary: Object.fromEntries(SECONDARY_LABELS.map((n) => [n, FALLBACK_IDS[n]])),
    };
  }
  const secondary = {};
  for (const name of SECONDARY_LABELS) {
    const match = (primary.secondary_label_list ?? []).find((s) => s.raw_label_name === name);
    if (!match) notes.push(`칼럼 ${name}이 없음 — 기본 id를 쓴다`);
    secondary[name] = match ? Number(match.label_id) : FALLBACK_IDS[name];
  }
  return { primaryId: Number(primary.label_id), secondary };
}

/** 한 칼럼의 공지 목록 전부(최신순). */
async function listColumn(primaryId, secondaryId) {
  const items = [];
  let offset = 0;
  for (;;) {
    const { json } = await post('GetContentByLabel', {
      gameid: GAME_ID,
      language: [LANGUAGE],
      offset,
      get_num: PAGE_SIZE,
      primary_label_id: primaryId,
      secondary_label_id: secondaryId,
    });
    const data = json?.data ?? {};
    const batch = data.info_content ?? [];
    items.push(...batch);
    const total = Number(data.total_num ?? 0);
    const next = data.next_offset;
    if (!batch.length || items.length >= total || next == null || next === offset) break;
    offset = Number(next);
  }
  return items;
}

export async function readIndex() {
  try {
    return JSON.parse(await fs.readFile(INDEX_PATH, 'utf8'));
  } catch {
    return { version: 1, source: `${ORIGIN} (information-feeds CMS)`, updatedAt: null, notices: {} };
  }
}

async function main() {
  const { values: args } = parseArgs({ options: { force: { type: 'boolean', default: false } } });
  const index = await readIndex();
  const notes = [];

  console.log('공식 공지 목록을 읽는다…');
  const { primaryId, secondary } = await resolveLabels(notes);
  const listed = new Map();
  for (const [name, secondaryId] of Object.entries(secondary)) {
    const items = await listColumn(primaryId, secondaryId);
    console.log(`  ${name}: ${items.length}건`);
    for (const item of items) {
      const id = String(item.content_id ?? '');
      if (!id) continue;
      if (!listed.has(id)) listed.set(id, { item, columns: [] });
      listed.get(id).columns.push(name);
    }
  }
  if (!listed.size) throw new Error('공지 목록이 비어 있다 — CMS 규약이 바뀌었을 수 있다');

  const cutoff = Math.floor(Date.now() / 1000) - RECHECK_DAYS * 86400;
  const queue = [...listed.entries()]
    .sort((a, b) => Number(a[1].item.pub_timestamp ?? 0) - Number(b[1].item.pub_timestamp ?? 0))
    .filter(([id, { item }]) => {
      const prev = index.notices[id];
      return args.force || !prev || prev.title !== item.title || Number(item.pub_timestamp ?? 0) >= cutoff;
    });
  console.log(`목록 ${listed.size}건 · 본문 확인 ${queue.length}건`);

  await fs.mkdir(OFFICIAL_DIR, { recursive: true });
  let written = 0;
  let changed = false;
  for (const [i, [id, { columns }]] of queue.entries()) {
    const { text, json } = await post('GetContentInfoById', { content_id: id, gameid: GAME_ID, language: [LANGUAGE] });
    const detail = json?.data ?? {};
    if (!detail.content_id) {
      notes.push(`${id}: 본문 요청이 빈 응답`);
      continue;
    }
    const digest = digestOf(detail);
    const prev = index.notices[id];
    const entry = {
      title: detail.title ?? '',
      pubTimestamp: Number(detail.pub_timestamp ?? 0),
      columns: columns.sort(),
      digest,
      fetchedAt: prev?.digest === digest ? prev.fetchedAt : new Date().toISOString(),
    };
    if (prev?.digest !== digest) {
      await fs.writeFile(path.join(OFFICIAL_DIR, `${id}.json`), text.endsWith('\n') ? text : text + '\n');
      written++;
      console.log(`  [${prev ? '수정' : '신규'}] ${new Date(entry.pubTimestamp * 1000).toISOString().slice(0, 10)} ${entry.title}`);
    }
    if (JSON.stringify(prev) !== JSON.stringify(entry)) {
      index.notices[id] = entry;
      changed = true;
    }
    if ((i + 1) % 50 === 0) console.log(`  … ${i + 1}/${queue.length}`);
  }

  for (const note of notes) console.log(`  참고: ${note}`);
  if (!changed) {
    console.log('새로 받은 공지 없음 — 파일을 건드리지 않았다');
    return;
  }
  index.updatedAt = new Date().toISOString();
  index.notices = Object.fromEntries(
    Object.entries(index.notices).sort((a, b) => a[1].pubTimestamp - b[1].pubTimestamp || a[0].localeCompare(b[0])),
  );
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  console.log(`본문 ${written}건 저장 · 목록 ${Object.keys(index.notices).length}건 → ${path.relative(ROOT, NOTICES_DIR)}/`);
  console.log('출시 순서를 다시 뽑으려면: node tools/notices/release-order.mjs');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
