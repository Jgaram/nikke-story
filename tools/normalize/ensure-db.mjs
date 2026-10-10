/**
 * data/nikke.db가 없거나 입력이 바뀌었으면 다시 만든다.
 *
 *   node tools/normalize/ensure-db.mjs           필요할 때만 만든다
 *   node tools/normalize/ensure-db.mjs --check   상태만 본다 (최신이면 종료 코드 0, 아니면 1)
 *   node tools/normalize/ensure-db.mjs --force   무조건 다시 만든다
 *
 * 입력은 data/raw/ · annotations/(1회독 · 2회독 기록 annotations/read1/ · read2/ · 떡밥 줄기 annotations/threads.json · 층 판정 annotations/layers.json · 주역 명단 annotations/leads.json · 척추 annotations/spine.json · 주요 인물 annotations/majors.json · 마무리 기록 annotations/closures.json · 수동 엣지 annotations/links.json · 2회독 볼 거리 annotations/watch.json · 공개 개요 annotations/synopsis/ · 팬용 문장 annotations/blurbs/ · 시점별 판 annotations/versions/ 빼고) · tools/normalize/ · data/release/다. 파일마다 경로·크기·수정 시각을 모아 해시한
 * 값(지문)을 build.mjs가 시작할 때 계산해 DB의 meta 테이블까지 넘기고, 여기서 지금 지문과 비교한다.
 * 내용이 아니라 stat만 보므로 3,300여 개 파일에 30ms 남짓이다.
 *
 * "없을 때만" 만들면 build.mjs나 raw가 바뀐 뒤에도 옛 DB가 옛 답을 조용히 낸다. 그래서 지문을 본다.
 * 도구(query.mjs, read.mjs)는 openDb()로, SessionStart 훅(.claude/hooks/ensure-db.mjs)은 ensureDb()로 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DB_PATH = path.join(ROOT, 'data/nikke.db');
/** 두 빌드가 동시에 data/normalized/를 덮어쓰지 않게 막는 잠금. `data/nikke.db-*`라 git에서 빠진다 */
const LOCK_PATH = `${DB_PATH}-lock`;
const INPUT_DIRS = ['data/raw', 'annotations', 'tools/normalize', 'data/release'];
/**
 * 입력 디렉터리 안이지만 빌드가 읽지 않는 곳. 1회독 기록(annotations/read1/)은 기록 도구(tools/records.mjs)가 JSON을 바로 읽는다 —
 * 읽기 · 리뷰 세션이 기록을 고칠 때마다 DB를 다시 만들지 않게 지문에서 뺀다. 빌드가 읽게 되면 여기서 지운다.
 * 공개 개요(annotations/synopsis/, W8) · 팬용 문장(annotations/blurbs/, W14) · 시점별 판(annotations/versions/, W15c)도 같다 — tools/synopsis.mjs · 사이트 내보내기가 바로 읽는다.
 */
const EXCLUDE_DIRS = new Set(['annotations/read1', 'annotations/read2', 'annotations/synopsis', 'annotations/blurbs', 'annotations/versions']);
/** 같은 까닭으로 뺀다 — 떡밥 줄기(B0b) · 층 판정(B0b-2) · 수동 엣지(B1a — DB에 싣지 않고 관계선 tools/views/links.mjs가 읽는다, X2) · 2회독 볼 거리(B1b) ·
 * 척추(X3f-1c) · 주요 인물(X3g-1b) · 마무리 기록(X3f-1d)도 기록 도구가 바로 읽는다 */
const EXCLUDE_FILES = new Set(['annotations/threads.json', 'annotations/layers.json', 'annotations/leads.json', 'annotations/links.json', 'annotations/watch.json',
  'annotations/spine.json', 'annotations/majors.json', 'annotations/closures.json']);
const STEPS = ['tools/normalize/build.mjs', 'tools/normalize/build-db.mjs'];
const LOCK_WAIT_MS = 5 * 60_000;
const LOCK_MAX_AGE_MS = 10 * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 원문 서브모듈(data/raw/, private Jgaram/nikke-story-raw)이 비었을 때의 안내. 클라우드 세션은 이 레포만 붙은 채로 시작하는 일이 있어
 * 시작 훅이 서브모듈을 못 받는다. 그대로 빌드하면 ENOENT로 터져 "원래 있던 실패"로 오인되므로 까닭과 해결법을 먼저 말한다.
 */
export const RAW_MISSING = '원문 없음 — data/raw/ 서브모듈이 비어 DB를 만들 수 없다. 코드 문제가 아니다. '
  + 'add_repo로 Jgaram/nikke-story-raw를 세션에 붙이고 `node .claude/hooks/ensure-db.mjs`를 돌린 뒤 다시 할 것. '
  + '이 상태의 테스트 실패를 "원래 있던 실패"로 넘기지 않는다(CLAUDE.md "원문 서브모듈")';

/** 원문 서브모듈을 받아 두었는가 */
export function rawReady() {
  return fs.existsSync(path.join(ROOT, 'data/raw/manifest.json'));
}

/** 입력 파일 전체의 지문. 경로 순으로 정렬해 디렉터리 순회 순서에 흔들리지 않게 한다 */
export function inputsFingerprint() {
  const entries = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!EXCLUDE_DIRS.has(path.relative(ROOT, p).split(path.sep).join('/'))) walk(p);
      } else if (e.isFile()) {
        if (EXCLUDE_FILES.has(path.relative(ROOT, p).split(path.sep).join('/'))) continue;
        const st = fs.statSync(p);
        entries.push(`${path.relative(ROOT, p)}\t${st.size}\t${Math.trunc(st.mtimeMs)}`);
      }
    }
  };
  for (const d of INPUT_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  entries.sort();
  return crypto.createHash('sha1').update(entries.join('\n')).digest('hex');
}

let sqlite = null;
/**
 * node:sqlite를 불러온다. Node 22는 처음 불러올 때 ExperimentalWarning 두 줄을 stderr에 찍어
 * 도구 출력마다 섞이므로 그 경고 하나만 걸러낸다. 정적 import로는 거를 틈이 없어 동적으로 부른다.
 */
export async function loadSqlite() {
  if (sqlite) return sqlite;
  const listeners = process.listeners('warning');
  process.removeAllListeners('warning');
  process.on('warning', (w) => {
    if (w.name === 'ExperimentalWarning' && /SQLite/i.test(w.message)) return;
    for (const l of listeners) l.call(process, w);
  });
  sqlite = await import('node:sqlite');
  return sqlite;
}

/** @returns {Promise<{ fresh: boolean, reason: string | null }>} */
export async function dbStatus() {
  const inputs = inputsFingerprint();
  if (!fs.existsSync(DB_PATH)) return { fresh: false, reason: 'DB 없음' };
  let stored;
  try {
    const { DatabaseSync } = await loadSqlite();
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    try {
      stored = db.prepare("SELECT value FROM meta WHERE key = 'inputs'").get()?.value ?? null;
    } finally {
      db.close();
    }
  } catch {
    return { fresh: false, reason: 'meta 없는 이전 형식이거나 읽을 수 없음' };
  }
  if (!stored) return { fresh: false, reason: '입력 지문 없음' };
  if (stored !== inputs) return { fresh: false, reason: '입력 변경' };
  return { fresh: true, reason: null };
}

/** 잠금을 잡은 프로세스가 죽었으면 true. 막 만들어져 pid를 아직 안 쓴 잠금은 살아 있는 것으로 본다 */
function lockIsStale() {
  try {
    const age = Date.now() - fs.statSync(LOCK_PATH).mtimeMs;
    if (age > LOCK_MAX_AGE_MS) return true; // pid가 재사용됐을 수도 있으니 나이로도 자른다
    const pid = Number.parseInt(fs.readFileSync(LOCK_PATH, 'utf8'), 10);
    if (!pid) return age > 30_000;
    process.kill(pid, 0);
    return false;
  } catch (err) {
    return err.code === 'ESRCH'; // ENOENT(이미 풀림)면 다시 잡으러 간다
  }
}

async function withLock(fn, log) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let waiting = false;
  for (;;) {
    try {
      fs.writeFileSync(LOCK_PATH, `${process.pid}\n`, { flag: 'wx' });
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    if (lockIsStale()) {
      fs.rmSync(LOCK_PATH, { force: true });
      continue;
    }
    if (Date.now() > deadline) throw new Error(`다른 빌드가 끝나지 않는다 (${path.relative(ROOT, LOCK_PATH)})`);
    if (!waiting) log('다른 프로세스가 data/nikke.db를 만드는 중이라 기다린다');
    waiting = true;
    await sleep(300);
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(LOCK_PATH, { force: true });
  }
}

/** build.mjs → build-db.mjs. 경고 줄(⚠)은 모아서 돌려준다 — 자동 빌드에서도 묻히지 않게 */
function build() {
  const warnings = [];
  for (const step of STEPS) {
    const r = spawnSync(process.execPath, ['--no-warnings', path.join(ROOT, step)], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 << 20,
    });
    if (r.status !== 0) {
      const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`
        .trim()
        .split('\n')
        .filter((l) => l.trim() && !/^Node\.js v\d/.test(l))
        .slice(-8)
        .join('\n');
      throw new Error(`${step} 실패 (${r.error?.message ?? `종료 코드 ${r.status ?? r.signal}`})\n${tail}`);
    }
    warnings.push(...`${r.stdout}\n${r.stderr}`.split('\n').filter((l) => l.includes('⚠')).map((l) => l.trim()));
  }
  return warnings;
}

/**
 * 필요하면 DB를 만든다. 동시에 여러 프로세스가 불러도 한 번만 만든다.
 * @param {{ force?: boolean, log?: (msg: string) => void }} [opts]
 * @returns {Promise<{ built: boolean, reason?: string, seconds?: string, warnings?: string[], fresh?: boolean }>}
 */
export async function ensureDb({ force = false, log = (m) => process.stderr.write(`${m}\n`) } = {}) {
  if (!force && (await dbStatus()).fresh) return { built: false };
  return withLock(async () => {
    // 잠금을 기다리는 사이에 다른 프로세스가 만들었을 수 있다
    let status = await dbStatus();
    if (!force && status.fresh) return { built: false };
    if (!rawReady()) throw new Error(RAW_MISSING);
    const reason = force ? '강제' : status.reason;
    log(`data/nikke.db 만드는 중 (${reason}) — 15초 남짓 걸린다`);
    const t0 = performance.now();
    let warnings = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      warnings = build();
      status = await dbStatus();
      if (status.fresh) break;
      // 만드는 사이에 입력이 바뀌었다 (예: 같은 세션 시작 훅이 main을 당겨 왔다)
      if (attempt === 0) log('만드는 사이에 입력이 바뀌어 한 번 더 만든다');
    }
    const seconds = ((performance.now() - t0) / 1000).toFixed(1);
    for (const w of warnings) log(w);
    log(status.fresh ? `data/nikke.db 준비됨 (${seconds}초)` : '⚠ 두 번 만들었는데도 입력이 계속 바뀐다. 끝난 뒤 다시 확인할 것');
    return { built: true, reason, seconds, warnings, fresh: status.fresh };
  }, log);
}

/** 최신 DB를 읽기 전용으로 연다. 없거나 오래됐으면 먼저 만든다 */
export async function openDb() {
  await ensureDb();
  const { DatabaseSync } = await loadSqlite();
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--check')) {
    const s = await dbStatus();
    console.log(s.fresh ? 'data/nikke.db 최신' : `data/nikke.db 다시 만들어야 함 (${s.reason})`);
    process.exit(s.fresh ? 0 : 1);
  }
  const r = await ensureDb({ force: args.has('--force'), log: (m) => console.log(m) });
  if (!r.built) console.log('data/nikke.db 최신 — 할 일 없음');
}
