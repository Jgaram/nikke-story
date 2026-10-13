/**
 * 문서에 소제목만 더했는지 본다 — 절을 소제목으로 나눌 때 본문이 한 글자도 바뀌지 않았음을 확인한다.
 *
 *   node tools/check-doc-headings.mjs docs/views.md [--base HEAD]
 *
 * 바꾸기 전(git의 base 판)과 지금 파일을 줄 단위로 견준다. 허용하는 것은 셋뿐이다:
 *   ① 새 `#` 소제목 줄을 끼워 넣음(코드 블록 밖에서만) ② 굵은 글씨만 있는 줄(`**X**`)을 같은 글자의 소제목(`### X`)으로 바꿈 ③ 빈 줄.
 * 그 밖의 줄은 모두 같은 차례로 똑같아야 한다 — 글자가 바뀌거나 빠지거나 차례가 바뀌거나 본문 줄이 더해지면 문제로 보인다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADING = /^(#{2,6}) (.+?)\s*$/;
const BOLD_ONLY = /^\*\*([^*]+)\*\*\s*$/;

/**
 * @returns {{ problems: string[], inserted: string[], converted: string[] }}
 */
export function compareKeepHeadings(before, after) {
  const b = before.split('\n').map((l, i) => ({ l: l.trimEnd(), n: i + 1 })).filter((x) => x.l !== '');
  const a = after.split('\n').map((l, i) => ({ l: l.trimEnd(), n: i + 1 }));
  const problems = [];
  const inserted = [];
  const converted = [];
  let p = 0;
  let fence = false;
  for (const { l, n } of a) {
    if (/^```/.test(l)) fence = !fence;
    if (l === '') continue;
    const cur = b[p];
    if (cur && l === cur.l) { p++; continue; }
    const h = l.match(HEADING);
    const bold = cur?.l.match(BOLD_ONLY);
    if (h && bold && bold[1].trim() === h[2]) { converted.push(`${n}: ${l}`); p++; continue; }
    if (h && !fence) { inserted.push(`${n}: ${l}`); continue; }
    problems.push(`지금 ${n}줄이 기준과 다르다 — 지금: ${l.slice(0, 60)} · 기준 ${cur ? `${cur.n}줄: ${cur.l.slice(0, 60)}` : '(끝)'}`);
    return { problems, inserted, converted };
  }
  if (p < b.length) problems.push(`기준 ${b[p].n}줄부터 ${b.length - p}줄이 지금 없다 — 처음: ${b[p].l.slice(0, 60)}`);
  return { problems, inserted, converted };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((x) => !x.startsWith('--'));
  const bi = args.indexOf('--base');
  const base = bi >= 0 ? args[bi + 1] : 'HEAD';
  if (!file) {
    console.log('쓰는 법: node tools/check-doc-headings.mjs <문서> [--base HEAD]');
    process.exit(2);
  }
  const rel = path.relative(ROOT, path.resolve(file));
  const before = execFileSync('git', ['show', `${base}:${rel}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const r = compareKeepHeadings(before, fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  console.log(`${rel} — 기준 ${base}: 더한 소제목 ${r.inserted.length} · 굵은 줄 → 소제목 ${r.converted.length}`);
  for (const x of [...r.inserted.map((s) => `  + ${s}`), ...r.converted.map((s) => `  ~ ${s}`)]) console.log(x);
  if (r.problems.length) {
    console.log(`본문이 바뀌었다:\n${r.problems.map((s) => `  - ${s}`).join('\n')}`);
    process.exit(1);
  }
  console.log('본문은 그대로다(소제목 · 빈 줄만 달라짐).');
}
