/**
 * 끝맺음 검사(docs/annotations.md "끝맺음") — 관형형 · 연결어미 · 조사로 끊긴 문장은 잡고, "~다" · 명사 맺음 · 인용은 통과시킨다.
 *
 *   node --test tests/endings.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { unfinishedEnding } from '../tools/records/check.mjs';

const CUT = {
  관형형: ["적이라는 외침에 '속였구나'라 덤비는", '엉뚱한 신입을 믿어 주려던', '기억을 잃은', '출소하면 같이 가자고 약속한', '서 있기도 힘든', '이 된', '글러트니의 입 앞에 멈춰 선', '기억 조각이 돌아온'],
  연결어미: ['거짓말로 무언가를 이루고 싶지 않다며', '둘이 이부 자매라서', '피나에게 멈추지 않겠다고'],
  조사: ['속으로 마리안을'],
};
for (const [kind, list] of Object.entries(CUT)) {
  test(`잡는다 — ${kind}`, () => {
    for (const s of list) assert.equal(unfinishedEnding(s), kind, s);
  });
}

test('통과 — "~다" · 명사 맺음 · 인용 · 끝 괄호', () => {
  for (const s of [
    '영원히 함께해 달라고 말한다.', '…덤비는 니케', '출소하면 같이 낚시를 가자고 약속하는 사이', '달아나는 콤과 그 원한', '레비가 사는 마을',
    '기억이 온전한 인간', '낚싯대를 구해 달라는 메신저 의뢰인', "짐을 털어놓고 '앞으로도 영원히 함께해 줘요'", '과격한 액션용 바디(02#96 · 03#44)',
    '침식되어 콜드 슬립에 보관됨', '무엇이 있었나', '장난', 'EOD',
  ]) assert.equal(unfinishedEnding(s), null, s);
  assert.equal(unfinishedEnding(undefined), null);
});
