/**
 * N2b — 업데이트 확인(tools/update.mjs)과 수집이 새 단위를 hold로 받는 것(tools/blabla/update.mjs holdNewUnits).
 *
 *   node --test tests/update.test.mjs
 *
 * 판정 규칙은 꾸민 공지로, 실제 데이터에는 "패치에 못 넣은 단위가 없다" · "원문 없는 옛 이벤트 6건이 그대로 잡힌다"만 본다
 * (새 패치가 들어와도 깨지지 않게 — 처리됨 · 보류 개수는 보지 않는다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPatches, heldUnits, storyMarked, isPatchNotice, loadInputs, NO_SOURCE_OK, GRACE_DAYS } from '../tools/update.mjs';
import { holdNewUnits } from '../tools/blabla/update.mjs';
import { parseOrder } from '../tools/records/order.mjs';
import { ensureDb } from '../tools/normalize/ensure-db.mjs';

const notice = (id, title, day, lines) => ({ id, title, publishedAt: new Date(`${day}T03:00:00Z`), lines });

const NOTICES = [
  notice('pre', '개발자 노트', '2022-10-20', ['출시 때는 2챕터까지 준비했습니다.']),
  notice('launch', '<승리의 여신: 니케> 정식 서비스 오픈 안내', '2022-11-04', ['오픈']),
  notice('p1', '11월 24일 업데이트 공지', '2022-11-21', [
    '1. 신규 니케',
    '1.1 SSR 니케 [에이]',
    'SSR 니케 [에이]가 특수 모집에 합류합니다.',
    '*특수 모집 기간: 2022년 11월 24일 서버 점검 종료 이후 ~ 2022년 12월 15일 4:59:59 (UTC+9)',
    '2. 신규 이벤트',
    '2.1 신규 스토리 이벤트 : MARKED ONE',
    '*이벤트 기간: 2022년 11월 24일 서버 점검 종료 이후 ~ 2022년 12월 15일 4:59:59 (UTC+9)',
    '2.2 스페셜 이벤트 : QUIET ONE',
    '*이벤트 기간: 2022년 11월 24일 서버 점검 종료 이후 ~ 2022년 12월 1일 4:59:59 (UTC+9)',
    '3. 메인 시나리오 3 챕터가 신규 개방됩니다.',
  ]),
  notice('p1fix', '11월 24일 업데이트 개선사항', '2022-11-24', ['고쳤습니다.']),
  notice('p2', '12월 8일 업데이트 공지', '2022-12-05', [
    '1. 신규 이벤트',
    '1.1 스페셜 이벤트 : LATE QUIET',
    '*이벤트 기간: 2022년 12월 8일 서버 점검 종료 이후 ~ 2022년 12월 20일 4:59:59 (UTC+9)',
    '1.2 스토리 라인 - LATE QUIET',
    '스토리 라인에 LATE QUIET이 추가됩니다.',
  ]),
];
const CATEGORIES = [
  { id: 'main:1', source: 'main', name: '하나', localeKey: 'Locale_Stage:chapter_name_0' },
  { id: 'main:2', source: 'main', name: '둘', localeKey: 'Locale_Stage:chapter_name_1' },
  { id: 'main:3', source: 'main', name: '셋', localeKey: 'Locale_Stage:chapter_name_2' },
  { id: 'main:4', source: 'main', name: '넷', localeKey: 'Locale_Stage:chapter_name_3' },
  { id: 'archive:1', source: 'archive', name: 'MARKED ONE', idPrefix: 'event_markedone' },
  { id: 'char:10', source: 'episode', name: '비', resourceId: 10 },
  { id: 'char:11', source: 'episode', name: '에이', resourceId: 11 },
];
const CHARACTERS = [{ resourceId: 10, name: '비', rarity: 'SSR' }, { resourceId: 11, name: '에이', rarity: 'SSR' }];
const ORDER = parseOrder([
  '- [x] **R01** ch00–02 · `char:10` — 1만 자',
  '- [x] **R02** ch03 · `event_markedone` — 1만 자',
  '- [ ] **M01** `char:11` — 1만 자',
].join('\n'), ['R', 'M']);

const run = (over = {}) => buildPatches({
  notices: NOTICES, categories: CATEGORIES, storyHasText: new Set(CATEGORIES.map((c) => c.id)), characters: CHARACTERS,
  flChapters: new Set([0, 1, 2, 3]), order: ORDER, today: '2022-12-10', ...over,
});

test('패치는 정기 업데이트 공지 하나 — 개선사항 공지는 아니다, 출시는 패치 0', () => {
  assert.equal(isPatchNotice(NOTICES[2]), true);
  assert.equal(isPatchNotice(NOTICES[3]), false);
  const { patches } = run();
  assert.deepEqual(patches.map((p) => p.id), ['launch', 'p1', 'p2']);
  assert.deepEqual(patches[0].units.filter((u) => u.kind === 'main').map((u) => u.key), ['ch00', 'ch01', 'ch02']);
  assert.equal(patches[0].status, '처리됨');
});

test('단위 상태 — 읽는 중이면 준비, 표지 없는 이벤트는 끝나고 기한 전이면 기다림(보류)', () => {
  const { patches } = run();
  const p1 = patches[1];
  const by = (name) => p1.units.find((u) => u.name === name || u.key === name);
  assert.equal(by('ch03').state, '있음');
  assert.equal(by('ch03 서브퀘스트 · 유실물').state, '있음');
  assert.equal(by('event_markedone').marked, true);
  assert.equal(by('char:11').read, '읽는 중');
  const quiet = by('QUIET ONE');
  assert.equal(quiet.marked, false);
  assert.equal(quiet.end, '2022-12-01');
  assert.equal(quiet.state, '기다림');
  assert.equal(p1.status, '보류');
  // 기한이 지나면 스토리 없음으로 보고 막지 않는다 — 남은 것은 읽는 중인 char:11이라 준비
  const later = run({ today: '2023-01-01' }).patches[1];
  assert.equal(later.units.find((u) => u.name === 'QUIET ONE').state, '스토리 없음으로 봄');
  assert.equal(later.status, '준비');
  assert.ok(GRACE_DAYS > 0);
});

test('스토리 표지 — 머리줄 · Part STORY · 스토리 라인에 추가', () => {
  const { patches } = run();
  const late = patches[2].units.find((u) => u.name === 'LATE QUIET');
  assert.equal(late.marked, true);
  assert.equal(late.state, '없음');
  assert.equal(patches[2].status, '보류');
  const n = notice('x', 'x', '2023-01-01', ['1.1 스페셜 이벤트 : FOO', 'Part 1: STORY I', '*이벤트 기간: 1월 1일 ~ 1월 9일']);
  assert.equal(storyMarked({ notice: n, name: 'FOO', from: 0, to: 3 }), true);
});

test('들이지 않은 원문(hold)도 원문 있음으로 친다 — 금서고 파일 · 블라링크 이벤트 · 호감도 · 메인', () => {
  const held = heldUnits({
    _설명: [],
    'event_stories/late_quiet.txt': { 까닭: '업데이트 전' },
    'char:12': { 까닭: '업데이트 전' },
    ch04: { 까닭: '업데이트 전' },
    event_zzz: { 까닭: '전환 대기', 금서고: 'event_stories/zzz.txt' },
  }, { libraryTitles: new Map([['event_stories/late_quiet.txt', 'LATE QUIET']]) });
  assert.deepEqual(held.map((h) => h.id), ['fl:late_quiet', 'char:12', 'ch04', 'held:event_zzz']);
  const { patches } = run({ held });
  const late = patches[2].units.find((u) => u.key === 'fl:late_quiet');
  assert.equal(late.state, '들이지 않음');
  assert.equal(patches[2].status, '준비');
});

test('수집이 새 단위를 hold "업데이트 전"으로 넣는다 — 이미 있는 키는 그대로, 블라링크 본문이 생긴 매핑은 전환 대기', () => {
  const hold = { event_old: { 까닭: '전환 대기', 금서고: 'event_stories/old.txt' } };
  const added = holdNewUnits(hold, {
    events: ['event_new1'], episodes: [63], chapters: ['ch49'],
    libraryFiles: ['sub_quests/새.txt', 'character_episodes/x.txt'],
    switched: [['event_stories/old.txt', 'event_old'], ['event_stories/boom.txt', 'event_boom1']], day: '2026-10-15',
  });
  assert.deepEqual(added, ['event_new1', 'char:63', 'ch49', 'sub_quests/새.txt', 'event_boom1']);
  assert.equal(hold['char:63'].까닭, '업데이트 전');
  assert.equal(hold.event_boom1.금서고, 'event_stories/boom.txt');
  assert.equal(hold.event_old.금서고, 'event_stories/old.txt');
});

test('실제 데이터 — 모든 원문 단위가 패치에 들고, 원문 없는 옛 이벤트 6건은 막지 않는다', async () => {
  await ensureDb({ log: () => {} });
  const { patches, unplaced } = buildPatches(loadInputs({ today: '2026-10-15' }));
  assert.deepEqual(unplaced.map((u) => u.key), [], '패치에 못 넣은 단위 — tools/notices/aliases.json · annotations/release-overrides.json으로 잇는다');
  const old = patches.flatMap((p) => p.units).filter((u) => u.state === '원문 없는 옛 단위');
  assert.equal(old.length, NO_SOURCE_OK.size);
  // 공지에서 한 단위가 두 패치에 들지 않는다
  const keys = patches.flatMap((p) => p.units).filter((u) => u.key).map((u) => u.key);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
});
