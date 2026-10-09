/**
 * SessionStart 훅 — 원문 서브모듈(data/raw/)을 받고, data/nikke.db가 없거나 입력이 바뀌었으면 만든다.
 * DB 판단과 빌드는 tools/normalize/ensure-db.mjs가 한다.
 *
 *   node .claude/hooks/ensure-db.mjs
 *
 * 클라우드 컨테이너는 매번 빈 채로 시작하고, 원문은 private 서브모듈(Jgaram/nikke-story-raw), DB는 git에서 빠져 있다(117MB).
 * 그래서 원격 세션에서만 돈다. 로컬에서는 `git clone --recurse-submodules`로 받고, query.mjs·read.mjs가 DB를 열기 전에 같은 확인을 한다.
 * 서브모듈은 main에 붙여 둔다(분리된 HEAD면 수집 뒤 커밋이 떠돈다 — CLAUDE.md "브랜치 규칙").
 * 한 일이 있을 때만 몇 줄을 남기고, 실패해도 세션을 막지 않는다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureDb } from '../../tools/normalize/ensure-db.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = 'data/raw';
const RAW_REPO = 'Jgaram/nikke-story-raw';

const git = (args, timeout = 30_000) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (args, timeout) => {
  try {
    return git(args, timeout);
  } catch {
    return null;
  }
};

const note = (text) =>
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } }) + '\n');

/** 서브모듈을 받고 main에 붙인다. 알릴 말 목록과 원문이 있는지를 돌려준다. */
function ensureRaw() {
  const notes = [];
  if (!existsSync(path.join(ROOT, RAW, 'manifest.json'))) {
    if (tryGit(['submodule', 'update', '--init', RAW], 180_000) === null || !existsSync(path.join(ROOT, RAW, 'manifest.json'))) {
      notes.push(
        `[원문] ${RAW}/ 서브모듈(${RAW_REPO}, private)을 받지 못했다 — 원문 · DB가 필요한 작업은 못 한다. ` +
          `add_repo로 ${RAW_REPO}를 세션에 붙인 뒤 \`node .claude/hooks/ensure-db.mjs\`를 다시 돌린다. 안 되면 사용자에게 알린다.`,
      );
      return { notes, ok: false };
    }
    notes.push(`[원문] ${RAW}/ 서브모듈을 받았다.`);
  }
  const sub = (args, timeout) => tryGit(['-C', RAW, ...args], timeout);
  if (sub(['branch', '--show-current']) !== 'main') {
    sub(['fetch', '--quiet', 'origin', '+refs/heads/main:refs/remotes/origin/main'], 60_000);
    const head = sub(['rev-parse', 'HEAD']);
    const tip = sub(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']);
    if (head && head === tip) sub(['checkout', '--quiet', '-B', 'main', 'refs/remotes/origin/main']);
    else {
      notes.push(
        `[원문] ${RAW}/의 포인터(${head?.slice(0, 8)})가 원본 레포 main(${tip?.slice(0, 8) ?? '?'})과 달라 main에 붙이지 않았다. ` +
          '포인터만 늦은 것이면 `git -C data/raw checkout -B main origin/main && git add data/raw`로 맞춰 커밋한다.',
      );
    }
  }
  return { notes, ok: true };
}

if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  const raw = ensureRaw();
  const notes = [...raw.notes];
  if (raw.ok) {
    try {
      const r = await ensureDb({ log: () => {} });
      if (r.built) {
        const warnings = r.warnings?.length ? `\n빌드 경고:\n${r.warnings.map((w) => `  ${w}`).join('\n')}` : '';
        notes.push(`[DB] data/nikke.db를 새로 만들었다 (${r.reason}, ${r.seconds}초).${warnings}`);
      }
    } catch (err) {
      notes.push(`[DB] data/nikke.db 자동 생성 실패 — 직접 돌려 원인을 볼 것: node tools/normalize/ensure-db.mjs\n${err.message}`);
    }
  }
  if (notes.length) note(notes.join('\n'));
}
