/**
 * 팬용 문장(W14) — 검사 규칙 · 판정 지문(낡음) · 확정 지문 · 실제 파일. docs/annotations.md "팬용 문장".
 *
 *   node --test
 *
 * 원문 겹침 · 스포일러는 공개 개요와 같은 함수(tests/synopsis.test.mjs)라 여기서는 실제 파일의 칸 · 지문만 본다.
 * 실제 파일의 원문 겹침(20자 경고) · 스포일러 경고는 `node tools/blurbs.mjs check`가 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLURB_DIR, LIMITS, STANDALONE_TEXT, blurbPath, checkBlurb, checkEntry, contentHash, laterNames, loadBlurbs, loadSources, sentenceCount, shownTexts, srcHash, stateOf,
} from '../tools/blurbs/model.mjs';

const JUDGED = { key: 'sub:세르반_03', grade: '보강', from: 'ch44', reason: '척추 ch44에서 … (F349)' };
const NARROWS = [{ unit: 'char:171', at: [['전', 'ch21']], reason: '파피용이 … (D218)', confidence: '추정' }];
const SOURCES = { why: new Map([[JUDGED.key, JUDGED]]), when: new Map([['char:171', NARROWS]]) };
const entry = (text, src = srcHash('why', JUDGED)) => ({ text, src, session: 'W14a', by: 'claude', date: '2026-10-10', status: '후보', reviews: [] });
const confirm = (e, by = 'claude') => ({ ...e, status: '확정', reviews: [...e.reviews, { decision: '확정', by, date: '2026-10-10', session: 'W14a', hash: contentHash(e) }] });
const GOOD = '버닝엄 부사령관은 지휘관을 엔더슨 쪽 사람으로 보면서도, 정부군을 움직일 수 없는 아들 일만은 지휘관에게 맡긴다.';
const UNITS = new Map([
  ['ch06', { key: 'ch06', kind: 'main', title: 'CH.06 순례', order: 40 }],
  ['sub:세르반_03', { key: 'sub:세르반_03', kind: 'sub', title: '세르반 4', order: 77 }],
  ['ch44', { key: 'ch44', kind: 'main', title: 'CH.44 행보', order: 400 }],
  ['event_goddessfall1', { key: 'event_goddessfall1', kind: 'event', title: 'GODDESS FALL', order: 380 }],
  ['char:200', { key: 'char:200', kind: 'episode', title: '루피', order: 105 }],
]);

test('맞는 문장은 오류 · 경고가 없다', () => {
  const b = { unit: JUDGED.key, why: confirm(entry(GOOD)) };
  assert.deepEqual(checkBlurb(b, SOURCES), { errors: [], warnings: [] });
  assert.equal(stateOf(b.why, srcHash('why', JUDGED)).ok, true);
});

test('판정 말 · ID · 단위 키는 오류다 — 화면 말(필수 스토리)로', () => {
  for (const bad of ['척추 ch44가 이 장면을 딛는다 — 버닝엄과 지휘관의 인연이 여기서 시작된다고 볼 수 있다.', '등급을 정한 장면 — 버닝엄 부사령관이 아들 일로 지휘관에게 연락하는 이야기다.',
    '버닝엄 부사령관은 [정부군]을 움직일 수 없어, 아들 일만은 엔더슨 쪽 사람인 지휘관에게 맡긴다.',
    'F349가 말하듯 버닝엄 부사령관은 세르반의 아버지이고, 지휘관에게 아들 구출을 맡긴다.']) {
    const r = checkEntry('why', entry(bad), srcHash('why', JUDGED));
    assert.ok(r.errors.length, bad);
  }
  assert.deepEqual(checkEntry('why', entry('필수 스토리 CH.44 전에 알아 두면 좋은, 버닝엄 부사령관과 지휘관이 얽히는 첫 이야기다.'), srcHash('why', JUDGED)).errors, []);
});

test('길이 — 권장 밖은 경고, 상한을 넘으면 오류 · 문장은 두 개까지(CH.44의 점은 세지 않는다)', () => {
  const cur = srcHash('why', JUDGED);
  assert.ok(checkEntry('why', entry('짧다. CH.44 전.'), cur).warnings.some((m) => m.includes('권장')));
  assert.ok(checkEntry('why', entry('가'.repeat(LIMITS.max + 1)), cur).errors.some((m) => m.includes(`${LIMITS.max}자`)));
  assert.equal(sentenceCount('CH.44 전에 본다. 그 뒤 CH.45로 간다.'), 2);
  assert.ok(checkEntry('why', entry('버닝엄이 나온다. 지휘관이 간다. 세르반을 구한다. 그리고 CH.44 전에 본다.'), cur).warnings.some((m) => m.includes('문장')));
});

test('판정이 바뀌면 낡음 — 경고 · 내보내기에서 빠짐, 확정 뒤 문장을 고치면 오류', () => {
  const e = confirm(entry(GOOD));
  const changedJudgment = srcHash('why', { ...JUDGED, reason: '다시 판정한 이유' });
  const st = stateOf(e, changedJudgment);
  assert.equal(st.stale, true);
  assert.equal(st.ok, false);
  assert.ok(checkEntry('why', e, changedJudgment).warnings.some((m) => m.includes('낡음')));
  const edited = { ...e, text: `${GOOD} 더함` };
  assert.ok(checkEntry('why', edited, srcHash('why', JUDGED)).errors.some((m) => m.includes('확정한 뒤')));
});

test('화면에 그 칸이 없는 단위 · 모르는 칸은 오류', () => {
  assert.ok(checkBlurb({ unit: 'ch00', why: entry(GOOD) }, SOURCES).errors.some((m) => m.includes('화면에 이 칸이 없다')));
  assert.ok(checkBlurb({ unit: JUDGED.key, how: entry(GOOD) }, SOURCES).errors.some((m) => m.includes('모르는 칸')));
  const when = { ...entry('파피용이 방주 중앙 정부에서 율하를 놀리는 모습이라, 파피용의 처지로 보아 CH.21 전의 일로 본다.', srcHash('when', NARROWS)) };
  assert.deepEqual(checkBlurb({ unit: 'char:171', when }, SOURCES).errors, []);
  assert.deepEqual(shownTexts({ unit: 'char:171', when }).map(([w]) => w), ['when']);
});

test('뒤 스토리 이름은 오류 — 메인 챕터 · 제목 단위, 앞 스토리 · 호감도 제목(인물 이름)은 된다', () => {
  assert.deepEqual(laterNames('CH.44 전에 알아 두면 좋다 — GODDESS FALL과 이어진다', 'sub:세르반_03', UNITS).sort(), ['CH.44', 'GODDESS FALL']);
  assert.deepEqual(laterNames('CH.06에서 말한 이야기 — 루피도 나온다', 'sub:세르반_03', UNITS), []);
  const cur = srcHash('why', JUDGED);
  const r = checkEntry('why', entry('버닝엄 부사령관과 지휘관이 직접 얽히는 것은 이 이야기부터다 — CH.44 전에 알아 두면 좋다.'), cur, { unit: JUDGED.key, units: UNITS });
  assert.ok(r.errors.some((m) => m.includes('뒤 스토리 이름')));
});

test('본 사람용 짧은 이유(later) — gate가 뒤 스토리여야 하고, gate까지 이름은 되고 그 뒤는 오류 · 뒤 필수 스토리로 오른 단위는 확정에 꼭', () => {
  const cur = srcHash('why', JUDGED);
  const o = { unit: JUDGED.key, units: UNITS };
  const withLater = (later, gate) => ({ ...entry(GOOD), later, gate });
  assert.deepEqual(checkEntry('why', withLater('CH.44에서 버닝엄이 아들의 일로 지휘관을 믿는 까닭이 이 이야기다.', 'ch44'), cur, o).errors, []);
  assert.ok(checkEntry('why', withLater('CH.44에서 버닝엄이 지휘관을 믿는다.', 'ch06'), cur, o).errors.some((m) => m.includes('gate가 이 스토리보다 앞')));
  assert.ok(checkEntry('why', withLater('GODDESS FALL과 CH.44에서 이어진다.', 'event_goddessfall1'), cur, o).errors.some((m) => m.includes('later: 뒤 스토리 이름 — CH.44')));
  assert.ok(checkEntry('why', withLater('CH.44에서 이어진다.', undefined), cur, o).errors.some((m) => m.includes('gate')));
  assert.ok(checkEntry('why', confirm(entry(GOOD)), cur, { ...o, needLater: true }).errors.some((m) => m.includes('later · gate')));
  assert.ok(checkEntry('why', entry(GOOD), cur, { ...o, needLater: true }).warnings.some((m) => m.includes('later · gate')));
  // later가 바뀌면 지문이 바뀐다 — 없으면 예전 지문 그대로
  assert.notEqual(contentHash(withLater('가', 'ch44')), contentHash(withLater('나', 'ch44')));
  assert.equal(contentHash(entry(GOOD)), contentHash({ ...entry(GOOD), later: undefined }));
});

test('독립 고정 문장 — 길이 검사 밖, 독립 밖에 쓰면 오류', () => {
  const cur = srcHash('why', JUDGED);
  assert.deepEqual(checkEntry('why', entry(STANDALONE_TEXT), cur, { grade: '독립' }), { errors: [], warnings: [] });
  assert.ok(checkEntry('why', entry(STANDALONE_TEXT), cur, { grade: '보강' }).errors.some((m) => m.includes('고정 문장')));
});

test('실제 파일 — 깨진 파일 · 오류 없음, 확정은 지문이 맞고 판정과 이어진다', () => {
  if (!fs.existsSync(BLURB_DIR)) return;
  const set = loadBlurbs();
  assert.deepEqual(set.problems, []);
  const sources = loadSources();
  for (const item of set.list) {
    const b = item.data;
    assert.equal(item.file, path.basename(blurbPath(b.unit)), `${item.file}: 파일 이름`);
    const r = checkBlurb(b, sources);
    assert.deepEqual(r.errors, [], `${b.unit}: ${r.errors.join(' / ')}`);
  }
});
