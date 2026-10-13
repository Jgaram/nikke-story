/**
 * 손 문서가 다시 쌓이지 않게 — docs/operations.md "기록".
 *   ① SESSIONS.md에는 남은 일만 — 끝난 항목(`[x]`) · 건너뛴 항목(`[-]`)은 지우고 인계는 docs/history/의 월별 기록에.
 *   ② 매 세션 읽는 문서의 길이 상한 — SESSIONS.md · CLAUDE.md · `.claude/rules/`.
 *      걸리면 상한을 올리지 말고 끝난 것을 기록으로, 자세한 것을 주제 문서로 옮긴다.
 *
 *   node --test tests/docs-budget.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** 글자 수 — 한국어 1자 ≈ 1토큰이라 바이트가 아니라 글자로 센다 */
const chars = (s) => [...s].length;

/** 상한(글자). 2026-10-13 정리 뒤 크기: SESSIONS 약 2천 · CLAUDE 약 2.5천 · rules 합 약 1.8천 */
const LIMIT = { 'SESSIONS.md': 8000, 'CLAUDE.md': 2800, rulesEach: 1500, rulesTotal: 4000 };

const HOWTO = '끝난 것은 지우고 인계를 docs/history/의 월별 기록에, 자세한 것은 주제 문서로 옮긴다(docs/operations.md "기록")';

test('SESSIONS.md — 끝난 항목이 남아 있지 않다', () => {
  const left = read('SESSIONS.md').split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => /^\s*- \[[xX-]\]/.test(l));
  assert.deepEqual(left.map(({ l, n }) => `${n}: ${l.slice(0, 60)}`), [],
    `SESSIONS.md에 끝난 항목 ${left.length}개 — ${HOWTO}. 읽기 항목(R · RE · P · M)은 SESSIONS.md가 아니라 annotations/reading-order.md에 둔다.`);
});

for (const f of ['SESSIONS.md', 'CLAUDE.md']) {
  test(`${f} — ${LIMIT[f]}자 이하`, () => {
    const n = chars(read(f));
    assert.ok(n <= LIMIT[f], `${f}가 ${n}자(상한 ${LIMIT[f]}) — ${HOWTO}.`);
  });
}

test('.claude/rules/ — 파일마다 · 합계 상한', () => {
  const dir = path.join(ROOT, '.claude/rules');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')) : [];
  let total = 0;
  for (const f of files) {
    const n = chars(read(`.claude/rules/${f}`));
    total += n;
    assert.ok(n <= LIMIT.rulesEach, `.claude/rules/${f}가 ${n}자(상한 ${LIMIT.rulesEach}) — 자세한 것은 주제 문서에 두고 가리킨다.`);
  }
  assert.ok(total <= LIMIT.rulesTotal, `.claude/rules/ 합계 ${total}자(상한 ${LIMIT.rulesTotal}).`);
});

test('.claude/rules/ — 경로(paths)가 있는 규칙만 둔다', () => {
  // paths 없는 규칙은 매 세션 늘 붙는다 — 그런 규칙은 CLAUDE.md에 한 줄로 둔다
  const dir = path.join(ROOT, '.claude/rules');
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const head = read(`.claude/rules/${f}`).match(/^---\n([\s\S]*?)\n---/);
    assert.ok(head && /^paths:/m.test(head[1]), `.claude/rules/${f}에 paths 머리말이 없다`);
  }
});
