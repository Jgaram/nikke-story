/**
 * tools/check-doc-headings.mjs — 소제목만 더한 것은 통과시키고, 본문이 바뀐 것은 잡는다.
 *
 *   node --test tests/doc-headings.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compareKeepHeadings } from '../tools/check-doc-headings.mjs';

const BASE = [
  '## 큰 절', '', '머리 문단.', '', '**실행법** — 이렇게 돌린다.', '', '**상단 바**', '- 줄 하나', '  이어지는 줄',
  '', '```', '코드 안 줄', '```', '', '| 표 | 칸 |', '|---|---|', '| a | b |', '', '## 다음 절', '끝 줄.',
].join('\n');
const lines = BASE.split('\n');
const edit = (fn) => { const c = [...lines]; fn(c); return c.join('\n'); };
const at = (s) => lines.indexOf(s);

test('그대로면 통과', () => {
  assert.deepEqual(compareKeepHeadings(BASE, BASE), { problems: [], inserted: [], converted: [] });
});

const PASS = {
  '소제목을 끼움': (c) => c.splice(at('**실행법** — 이렇게 돌린다.'), 0, '### 실행', ''),
  '굵은 줄을 같은 글자의 소제목으로': (c) => { c[at('**상단 바**')] = '### 상단 바'; },
  '빈 줄을 더하고 뺌': (c) => { c.splice(at('머리 문단.'), 0, ''); c.splice(at('| 표 | 칸 |') + 1, 0, ''); c.splice(at('## 다음 절') + 1, 1); },
};
for (const [name, fn] of Object.entries(PASS)) {
  test(`통과 — ${name}`, () => {
    assert.deepEqual(compareKeepHeadings(BASE, edit(fn)).problems, []);
  });
}

const CATCH = {
  '본문 글자 하나를 바꿈': (c) => { c[at('- 줄 하나')] = '- 줄 둘'; },
  '본문 줄을 지움': (c) => { c.splice(at('  이어지는 줄'), 1); },
  '본문 줄 둘의 차례를 바꿈': (c) => { const i = at('| a | b |'); const j = at('| 표 | 칸 |'); [c[i], c[j]] = [c[j], c[i]]; },
  '본문 줄을 더함': (c) => c.splice(at('끝 줄.'), 0, '새로 쓴 문장.'),
  '굵은 줄을 다른 글자의 소제목으로': (c) => { c[at('**상단 바**')] = '### 상단 바 · 팝업'; },
  '기존 절의 단계를 바꿈': (c) => { c[at('## 다음 절')] = '### 다음 절'; },
  '코드 블록 안에 소제목을 끼움': (c) => c.splice(at('코드 안 줄'), 0, '### 안'),
  '끝 줄을 지움': (c) => { c.pop(); },
  '굵은 줄을 지움': (c) => { c.splice(at('**상단 바**'), 1); },
};
for (const [name, fn] of Object.entries(CATCH)) {
  test(`잡는다 — ${name}`, () => {
    assert.ok(compareKeepHeadings(BASE, edit(fn)).problems.length > 0, '바뀐 본문을 못 잡았다');
  });
}
