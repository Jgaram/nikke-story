/**
 * blablalink CDN 수집 클라이언트.
 *
 * 요청 규칙은 docs/data-sources.md "0. 요청 규칙"에 있다. 요약하면:
 *   동시 요청 ≤ 4 / 로컬 캐시 우선 / 지수 백오프 재시도 / 404는 누락으로 기록.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { resourceUrl, formatLangPath } from './obfuscate.mjs';

/** docs/data-sources.md "0. 요청 규칙". 이 값을 올리지 말 것. */
export const MAX_CONCURRENCY = 4;

const RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const TIMEOUT_MS = 30_000;

/** 네트워크 응답이 한 번도 성공하지 못한 채 404가 이만큼 연속되면 규칙 파손으로 본다. */
const BREAKAGE_THRESHOLD = 8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** 일부 응답(archive_list 등)에 BOM이 붙어 온다. JSON.parse는 BOM을 못 읽는다. */
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

export class ObfuscationBrokenError extends Error {
  constructor(count) {
    super(
      `연속 ${count}건이 404이고 성공한 요청이 하나도 없습니다.\n` +
        `경로 난독화 규칙이 깨졌을 가능성이 높습니다. ` +
        `사이트 번들에서 규칙을 다시 추출해 tools/blabla/obfuscate.mjs를 갱신하세요.\n` +
        `절차: docs/data-sources.md`,
    );
    this.name = 'ObfuscationBrokenError';
  }
}

/** 동시 실행 수를 제한하는 워커 풀. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export class Collector {
  #manifest = { version: 1, updatedAt: null, entries: {}, missing: {} };
  #anySuccess = false;
  #consecutive404 = 0;

  constructor({ rawDir, lang = 'ko', force = false } = {}) {
    this.rawDir = rawDir;
    this.lang = lang;
    this.force = force;
    this.manifestPath = path.join(rawDir, 'manifest.json');
    this.stats = { fetched: 0, cached: 0, missing: 0, bytes: 0 };
  }

  async init() {
    await fs.mkdir(this.rawDir, { recursive: true });
    try {
      this.#manifest = JSON.parse(await fs.readFile(this.manifestPath, 'utf8'));
      this.#manifest.missing ??= {};
    } catch {
      /* 첫 실행 */
    }
    return this;
  }

  fileFor(logicalPath) {
    return path.join(this.rawDir, logicalPath.replace(/^\//, ''));
  }

  /** 템플릿 하나를 받아온다. 캐시가 있으면 네트워크를 타지 않는다. */
  async fetchOne(template) {
    const logical = formatLangPath(template, this.lang).replace(/^\//, '');
    const file = this.fileFor(logical);

    if (!this.force) {
      try {
        const json = JSON.parse(stripBom(await fs.readFile(file, 'utf8')));
        this.stats.cached++;
        return { logical, file, json, cached: true, missing: false };
      } catch {
        /* 캐시 없음 → 받는다 */
      }
    }

    const url = resourceUrl(template, this.lang);
    let lastError;

    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

        if (res.status === 404) {
          // 재시도하지 않는다. 실제로 없는 씬이 존재한다.
          this.#consecutive404++;
          if (!this.#anySuccess && this.#consecutive404 >= BREAKAGE_THRESHOLD) {
            throw new ObfuscationBrokenError(this.#consecutive404);
          }
          this.stats.missing++;
          this.#manifest.missing[logical] = { status: 404, checkedAt: new Date().toISOString() };
          return { logical, file, json: null, cached: false, missing: true };
        }

        if (!res.ok) {
          lastError = new Error(`HTTP ${res.status} — ${url}`);
          continue;
        }

        // BOM을 벗긴 본문을 저장한다. manifest의 sha256은 로컬 사본 기준이다.
        const text = stripBom(Buffer.from(await res.arrayBuffer()).toString('utf8'));
        const json = JSON.parse(text);
        const buf = Buffer.from(text, 'utf8');

        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, buf);

        this.#anySuccess = true;
        this.#consecutive404 = 0;
        this.stats.fetched++;
        this.stats.bytes += buf.length;
        delete this.#manifest.missing[logical];
        this.#manifest.entries[logical] = {
          url,
          fetchedAt: new Date().toISOString(),
          bytes: buf.length,
          sha256: sha256(buf),
        };
        return { logical, file, json, cached: false, missing: false };
      } catch (err) {
        if (err instanceof ObfuscationBrokenError) throw err;
        lastError = err;
      }
    }
    throw new Error(`${RETRIES + 1}회 시도 실패: ${logical}\n  ${lastError?.message ?? lastError}`);
  }

  /** 여러 템플릿을 동시 실행 상한을 지키며 받아온다. */
  async fetchMany(templates, { onProgress } = {}) {
    let done = 0;
    return pool(templates, MAX_CONCURRENCY, async (t) => {
      const result = await this.fetchOne(t);
      onProgress?.(++done, templates.length, result);
      return result;
    });
  }

  get missingPaths() {
    return Object.keys(this.#manifest.missing);
  }

  async saveManifest() {
    this.#manifest.updatedAt = new Date().toISOString();
    this.#manifest.lang = this.lang;
    await fs.mkdir(this.rawDir, { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(this.#manifest, null, 2) + '\n');
  }
}

/** 원본 JSON 어디에 묻혀 있든 scenario_group_id 문자열을 전부 끌어낸다. */
export function collectScenarioGroupIds(node, out = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.scenario_group_id === 'string') out.add(node.scenario_group_id);
  for (const value of Object.values(node)) collectScenarioGroupIds(value, out);
  return out;
}

export const formatBytes = (n) =>
  n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)}MB` : `${(n / 1024).toFixed(0)}KB`;
