/**
 * 읽기 순서가 틀어지지 않게 — tools/records/order-snapshot.mjs의 기준(tests/fixtures/reading-order.json)과 견준다.
 *   ① 지금 순서의 앞부분은 기준과 똑같다(뒤에 덧붙는 신작 N3만 허용).
 *   ② 검증기가 틀어짐을 실제로 잡는다 — 순서 원본을 일부러 바꾼 사본으로 본다.
 *
 *   node --test tests/reading-order.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ORDER_PATHS } from '../tools/records/order.mjs';
import { compareSnapshot, loadSnapshot, snapshotOrder } from '../tools/records/order-snapshot.mjs';

const base = loadSnapshot();

test('지금 읽기 순서의 기준 몫이 기준과 같다', () => {
  assert.deepEqual(compareSnapshot(base, snapshotOrder(), { prefix: true }), [],
    '읽기 순서가 기준과 다르다 — `node tools/records/order-snapshot.mjs check`로 차이를 본다. 일부러 바꾼 것이면 근거를 남기고 write로 기준을 새로 쓴다');
});

/** 순서 원본을 이어 붙인 글 — order.mjs readOrderText와 같게 */
const sourceText = ORDER_PATHS.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-order-'));
/** 글을 임시 파일 하나로 써서 그 파일로 스냅숏 */
function snapOf(text, name) {
  const f = path.join(tmp, `${name}.md`);
  fs.writeFileSync(f, text);
  return snapshotOrder([f]);
}
const lines = sourceText.split('\n');
const idx = (re, nth = 0) => lines.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0)[nth];
const edit = (fn) => { const c = [...lines]; fn(c); return c.join('\n'); };

test('검증기 — 바꾸지 않은 사본은 기준과 똑같다', () => {
  assert.deepEqual(compareSnapshot(base, snapOf(sourceText, 'same')), []);
});

const R = /^- \[.\] \*\*R\d/;
const M = /^- \[.\] \*\*M\d/;
const MUTATIONS = {
  '1회독 항목 둘의 차례를 바꿈': (c) => { const i = idx(R, 10); const j = idx(R, 11); [c[i], c[j]] = [c[j], c[i]]; },
  '1회독 항목 하나를 지움': (c) => { c.splice(idx(R, 20), 1); },
  '항목 안 키 하나를 바꿈': (c) => { const i = idx(/^- \[.\] \*\*R\d.*`event_/); c[i] = c[i].replace(/`event_([^`]+)`/, '`event_$1x`'); },
  '항목 상태를 바꿈': (c) => { const i = idx(M, 3); c[i] = c[i].replace(/^- \[.\]/, '- [ ]'); },
  '2회독 항목 하나를 지움': (c) => { c.splice(idx(M, 30), 1); },
  '층 머리줄 하나를 지움': (c) => { c.splice(idx(/^#### 2층/), 1); },
};
for (const [name, fn] of Object.entries(MUTATIONS)) {
  test(`검증기가 잡는다 — ${name}`, () => {
    const diffs = compareSnapshot(base, snapOf(edit(fn), name.replace(/\s/g, '_')));
    assert.ok(diffs.length > 0, '바꾼 사본인데 차이를 못 찾았다');
  });
}

test('순서 파일의 체크 칸 줄은 모두 읽기 항목으로 읽힌다 — 모양이 틀려 조용히 빠지는 줄이 없다', () => {
  const head = /^- \[.\] \*\*(?:R|RE|P|M|U)\d+[a-z]?(?:\s[^*]*)?\*\*/;
  const bad = ORDER_PATHS.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
    .map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => /^\s*- \[/.test(l) && !head.test(l))
    .map(({ l, n }) => `${path.basename(f)}:${n} ${l.slice(0, 50)}`));
  assert.deepEqual(bad, [], '항목 모양: `- [ ] **R01** ch00–02 · `키` … — 분량` (tools/records/order.mjs 머리말)');
});

test('SESSIONS.md에 읽기 항목이 없다 — 도구는 annotations/reading-order.md만 읽는다', () => {
  const left = fs.readFileSync(path.join(import.meta.dirname, '../SESSIONS.md'), 'utf8').split('\n')
    .filter((l) => /^\s*- \[.\] \*\*(?:R|RE|P|M)\d/.test(l));
  assert.deepEqual(left, [], '읽기 항목은 annotations/reading-order.md 그 절 끝에 덧붙인다');
});
