/**
 * 원문이 public 레포로 나가지 않게 막는 훅. 규칙 자체는 CLAUDE.md "저작물 취급"에 있다.
 *
 *   node .claude/hooks/no-raw-public.mjs pre-push   git push 전에, 나갈 커밋에 원문이 들었는지 본다
 *   node .claude/hooks/no-raw-public.mjs pre-mcp    GitHub MCP로 이 레포에 파일을 바로 쓰는 것을 막는다(검사를 건너뛰므로)
 *
 * 레포 안에 원문이 있는 것(받아 오기 · 뽑아 보기)은 괜찮다. 공개(push)되는 것만 막는다.
 * pre-push가 보는 것 — origin에 아직 없는 커밋(HEAD · main)에서 더해지거나 바뀐 파일마다:
 *   - 경로: data/raw/ 아래 파일(서브모듈 포인터 말고), data/normalized/, *.db · *.sqlite
 *   - 크기: 5MB 넘는 파일 (지금 가장 큰 추적 파일이 1.4MB, 원문 묶음 · DB는 수십 MB)
 *   - 내용: 원문(DB lines.text)과 40자 이상 겹치는 구간 — tools/check-quotes.mjs와 같은 잣대
 * 원문이 없어(서브모듈 · DB가 없어) 내용을 못 재면 막지 않고 알린다. 그 밖에 훅이 실패하면 막는다.
 * 원격 · 로컬 세션 모두에서 동작한다.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const REPO = 'jgaram/nikke-story'; // 이 레포(public). 원본 레포 nikke-story-raw는 막지 않는다
const MAX_BYTES = 5 << 20;
const BAD_PATH = [
  [/^data\/raw\//, 'data/raw/(private 서브모듈) 안 파일이 이 레포에 직접 들어 있다'],
  [/^data\/normalized\//, '정규화 결과(원문 전체)'],
  [/\.(db|sqlite3?)$/i, 'DB 파일(원문 전체)'],
];

const git = (args, opts = {}) =>
  execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd, maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const gitText = (args) => git(args, { encoding: 'utf8' }).trim();

const emit = (o) => process.stdout.write(JSON.stringify(o));
const deny = (reason) => emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });

/** 명령에 실제로 git push가 있는가. 따옴표 문자열 · 히어닥 본문(커밋 메시지 등)은 빼고 본다. */
function hasPush(command) {
  const code = command
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\s*(\n|$)/g, ' ')
    .replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, ' _ ');
  return /\bgit(?:\s+-C\s+\S+)?\s+push\b/.test(code);
}

/** origin에 아직 없는 커밋에서 더해지거나 바뀐 파일들: [{ path, mode, sha, commit }] (같은 내용은 한 번만). */
function outgoingFiles() {
  const heads = ['HEAD', 'refs/heads/main'].filter((r) => {
    try {
      gitText(['rev-parse', '--verify', '--quiet', r]);
      return true;
    } catch {
      return false;
    }
  });
  const commits = gitText(['rev-list', ...heads, '--not', '--remotes=origin']).split('\n').filter(Boolean);
  const seen = new Set();
  const files = [];
  for (const commit of commits) {
    const raw = gitText(['diff-tree', '-r', '-z', '--root', '--no-commit-id', '--no-renames', '--diff-filter=AMT', commit]);
    const parts = raw.split('\0');
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const [, mode, , sha] = parts[i].replace(/^:/, '').split(' ');
      const p = parts[i + 1];
      if (!p || seen.has(`${p}\0${sha}`)) continue;
      seen.add(`${p}\0${sha}`);
      files.push({ path: p, mode, sha, commit: commit.slice(0, 7) });
    }
  }
  return { commits: commits.length, files };
}

async function prePush(input) {
  if (!hasPush(input.tool_input?.command ?? '')) return;
  const { commits, files } = outgoingFiles();
  if (!files.length) return;

  const problems = [];
  const texts = [];
  for (const f of files) {
    if (f.mode === '160000') continue; // 서브모듈 포인터(data/raw)는 괜찮다
    const bad = BAD_PATH.find(([re]) => re.test(f.path));
    if (bad) {
      problems.push(`${f.path} (${f.commit}) — ${bad[1]}`);
      continue;
    }
    const size = Number(gitText(['cat-file', '-s', f.sha]));
    if (size > MAX_BYTES) {
      problems.push(`${f.path} (${f.commit}) — ${(size / 1048576).toFixed(1)}MB, 원문 묶음일 수 있다`);
      continue;
    }
    texts.push(f);
  }

  let warn = null;
  if (texts.length) {
    let windows;
    try {
      const { openDb } = await import(`${cwd}/tools/normalize/ensure-db.mjs`);
      const { sourceWindows } = await import(`${cwd}/tools/check-quotes.mjs`);
      const db = await openDb();
      try {
        windows = sourceWindows(db);
      } finally {
        db.close();
      }
    } catch (err) {
      warn = `⚠ 원문 DB를 열지 못해(${err.message.split('\n')[0]}) push할 커밋의 원문 겹침을 재지 못했습니다. 경로 · 크기만 확인했습니다.`;
    }
    if (windows) {
      const { overlapIn, QUOTE_LIMIT } = await import(`${cwd}/tools/check-quotes.mjs`);
      for (const f of texts) {
        const o = overlapIn(windows, git(['cat-file', 'blob', f.sha], { encoding: 'utf8' }));
        if (o && o.length >= QUOTE_LIMIT) problems.push(`${f.path} (${f.commit}) — 원문과 ${o.length}자 겹침: ${o.sample.slice(0, 30)}…`);
      }
    }
  }

  if (problems.length) {
    deny(
      `원문 공개 방지(CLAUDE.md "저작물 취급"): 이 레포는 public이다. push할 커밋 ${commits}개에 원문으로 보이는 것이 있다.\n` +
        problems.map((p) => `  - ${p}`).join('\n') +
        '\n인용은 40자 미만으로 줄이고 씬 ID · 줄 번호로 근거를 댄다. 원문 파일은 data/raw/(원본 레포)나 git 제외 경로로 옮긴다.\n' +
        '이미 커밋했다면 그 커밋을 고쳐(아직 push 전이라 rebase · amend로 히스토리에서 빼도 된다) 다시 push한다. 커밋을 지워도 나중 커밋으로만 고치면 히스토리에 남아 공개된다.',
    );
    return;
  }
  if (warn) emit({ systemMessage: warn });
}

function preMcp(input) {
  const t = input.tool_input ?? {};
  if (`${t.owner ?? ''}/${t.repo ?? ''}`.toLowerCase() !== REPO) return;
  deny(
    '원문 공개 방지(CLAUDE.md "저작물 취급"): 이 레포(public)에는 GitHub MCP로 파일을 바로 쓰지 않는다 — push 전 원문 검사를 건너뛴다. ' +
      '로컬에서 커밋하고 `git push origin main`으로 올린다.',
  );
}

const MODES = { 'pre-push': prePush, 'pre-mcp': preMcp };
const run = MODES[process.argv[2]];
if (run) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    /* 입력이 없으면 볼 것도 없다 */
  }
  try {
    await run(input);
  } catch (err) {
    deny(`원문 공개 방지 훅이 실패해 push를 멈췄다 (${err.message.split('\n')[0]}). 원인을 고치거나 사용자에게 알린다.`);
  }
}
