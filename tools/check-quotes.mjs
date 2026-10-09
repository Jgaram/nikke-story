/**
 * 공개 레포에 올라갈 파일에서 원문과 길게 겹치는 구간을 찾는다 — CLAUDE.md "저작물 취급".
 *
 *   node tools/check-quotes.mjs            # 40자 이상 겹침이 있으면 목록을 보이고 종료 코드 1
 *   node tools/check-quotes.mjs --min 30   # 기준 길이를 바꾼다
 *   node tools/check-quotes.mjs --top 20   # 기준과 상관없이 가장 긴 겹침 20개를 보인다
 *
 * 대상: git이 추적하는 파일 + 아직 추가 안 한 새 파일(.gitignore 제외), `data/raw/`(private 서브모듈) 빼고.
 * 방법: DB `lines.text`(블라링크 · 금서고 원문)를 공백을 지운 16자 창으로 해시해 두고, 파일에서 연속으로 맞는 가장 긴 구간을 잰다.
 * 한글이 12자 미만인 창은 버린다(이름 · 숫자 · 기호뿐인 흔한 조각이 걸리지 않게).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './normalize/ensure-db.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIN = 16;
const HANGUL_MIN = 12;
export const QUOTE_LIMIT = 40;

const squeeze = (s) => s.replace(/\s+/g, '');
const hangul = (s) => (s.match(/[가-힣]/g) ?? []).length;
function fnv(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619);
  return x >>> 0;
}

/** 원문 16자 창의 해시 모음. */
export function sourceWindows(db) {
  const set = new Set();
  for (const { text } of db.prepare('SELECT text FROM lines WHERE length(text) >= ?').iterate(WIN)) {
    const t = squeeze(text);
    for (let i = 0; i + WIN <= t.length; i++) {
      const w = t.slice(i, i + WIN);
      if (hangul(w) >= HANGUL_MIN) set.add(fnv(w));
    }
  }
  return set;
}

/** 공개 대상 파일 목록(레포 기준 경로). */
export function publicFiles() {
  const out = execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
  });
  return [...new Set(out.split('\n'))].filter((f) => f && f !== 'data/raw' && !f.startsWith('data/raw/'));
}

/** 파일마다 원문과 겹치는 가장 긴 구간(공백 뺀 글자 수)과 그 조각. 겹침이 없는 파일은 뺀다. */
export function longestOverlaps(windows, files = publicFiles()) {
  const found = [];
  for (const f of files) {
    const abs = path.join(ROOT, f);
    let text;
    try {
      if (!statSync(abs).isFile()) continue;
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    const t = squeeze(text);
    let run = 0;
    let best = 0;
    let end = 0;
    for (let i = 0; i + WIN <= t.length; i++) {
      if (windows.has(fnv(t.slice(i, i + WIN)))) {
        run++;
        if (run > best) [best, end] = [run, i + WIN];
      } else run = 0;
    }
    if (best) {
      const length = best + WIN - 1;
      found.push({ file: f, length, sample: t.slice(end - length, end) });
    }
  }
  return found.sort((a, b) => b.length - a.length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? Number(process.argv[i + 1]) : null;
  };
  const min = arg('--min') ?? QUOTE_LIMIT;
  const top = arg('--top');
  const db = await openDb();
  const found = longestOverlaps(sourceWindows(db));
  db.close();
  const shown = top ? found.slice(0, top) : found.filter((o) => o.length >= min);
  for (const o of shown) console.log(`${o.length}자\t${o.file}\t${o.sample.slice(0, 60)}`);
  const over = found.filter((o) => o.length >= min).length;
  console.log(`\n파일 ${found.length}개에 원문 겹침 · ${min}자 이상 ${over}개 · 최장 ${found[0]?.length ?? 0}자`);
  if (over) {
    console.log('→ 인용을 줄이고 씬 ID · 줄 번호로 근거를 댄다(CLAUDE.md "저작물 취급"). 원문 파일이면 data/raw/ 서브모듈이나 git 제외 경로로 옮긴다.');
    process.exit(1);
  }
}
