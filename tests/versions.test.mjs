/**
 * 시점별 판(W15c) — 떡밥 제목 · 요약을 읽은 자리마다 따로. docs/annotations.md "시점별 판".
 *   ① 검사: 첫 판 자리 · 읽는 순서 · 마지막 스토리 뒤 · 뒤 스토리 이름 · 그 자리 뒤에 처음 쓰이는 대상 이름(다른 이름 · 표준명이 늦은 대상) · 정체 연결
 *   ② 지문: at 앞의 흐름이 바뀌면 낡음(뒤는 상관없음) · 확정 뒤 고치면 오류 · 내보내기는 확정 · 성한 판만
 *   ③ 실제 파일 · 내보낸 versions.json · 화면 fmt.versionAt · threadAt
 *
 *   node --test tests/versions.test.mjs   (site/data/가 없으면 실제 데이터 쪽은 건너뛴다 — node tools/site/export.mjs)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run as exportVersions } from '../tools/site/export/versions.mjs';
import { fileNameFor } from '../tools/records/model.mjs';
import {
  SITE_DATA, VERSION_DIR, checkFile, contentHash, dictFirst, isDict, lateNames, loadSources, loadVersions, nameIndex, publishable, sourcesFrom, srcHash, stateOf,
} from '../tools/versions/model.mjs';

const fmt = await import('../site/lib/format.js');

// 작은 세계 — 홍련 호감도(앞)에서 떡밥이 나오고 뒤 이벤트에서 장화가 처음 나온다
const UNITS = [
  { key: 'ch14', kind: 'main', title: 'CH.14 여행', order: 10, tick: 1 },
  { key: 'char:222', kind: 'episode', title: '홍련', order: 20, tick: 2 },
  { key: 'erelic:red_ash_lost', kind: 'erelic', title: 'RED ASH 돌발 스토리', order: 30, tick: 3 },
  { key: 'event_newyearnewsword', kind: 'event', title: 'NEW YEAR, NEW SWORD', order: 40, tick: 4 },
  { key: 'ch45', kind: 'main', title: 'CH.45 죗값', order: 45, tick: 4 },
  { key: 'ch46', kind: 'main', title: 'CH.46 신생', order: 50, tick: 5 },
  { key: 'ch48', kind: 'main', title: 'CH.48 재탄', order: 60, tick: 6 },
];
const THREADS = { threads: [{ id: 'J30', title: '홍련과 장화', text: '…', weight: '보강', first_unit: 'char:222', last_unit: 'ch46' }] };
const FLOW = {
  J30: {
    roots: [{ id: 'Q90', points: [
      { r: 'Q90', s: '제기', u: 'char:222', o: 20 },
      { r: 'Q90-2', s: '일부 회수', u: 'erelic:red_ash_lost', o: 30, a: 'F1181' },
      { r: 'Q90-3', s: '회수', u: 'event_newyearnewsword', o: 40, a: 'F1238' },
    ] }, { id: 'Q300', points: [{ r: 'Q300-2', s: '일부 회수', u: 'ch46', o: 50 }] }],
    echoes: [{ r: 'E1', s: '재언급', u: 'ch48', o: 60 }],
  },
};
const TARGETS = [
  { id: 'person:홍련', name: '홍련', meet: ['ch14'] },
  { id: 'person:장화', name: '장화', meet: ['event_newyearnewsword'] },
  { id: 'org:바이스리터', name: '바이스리터', meet: ['ch14'], name_meet: ['ch46'], aliases: [{ name: '백기사', how: '별칭', meet: ['ch14'] }, { name: '말뚝 이름', how: '별칭', never: true }] },
  { id: 'person:아나키오르', name: '아나키오르', meet: ['ch14'], same_as: ['person:신데렐라'], same_as_unit: ['ch46'] },
  { id: 'person:신데렐라', name: '신데렐라', meet: ['ch14'], same_as: ['person:아나키오르'], same_as_unit: ['ch46'] },
];
const C = sourcesFrom({ units: UNITS, threads: THREADS, flow: FLOW, targets: TARGETS });
const S = 'thread:J30';
const ver = (at, title, text) => ({ at, title, text, src: srcHash(S, at, C), session: 'W15c', by: 'claude', date: '2026-10-10', status: '후보', reviews: [] });
const confirm = (v) => ({ ...v, status: '확정', reviews: [...v.reviews, { decision: '확정', by: 'claude', date: '2026-10-10', session: 'W15c', hash: contentHash(v) }] });
const GOOD = [
  ver('char:222', '홍련 — 약속, 아니 저주', '홍련은 전멸한 근접전 스쿼드의 유일한 생존자인가 — 검을 휘둘러야 한다는 약속은 누구와 맺은 무엇인가.'),
  ver('event_newyearnewsword', '홍련과 장화', '홍련은 무엇을 짊어졌나 — 제 검으로 벤 언니 장화, 서로를 베어 사라진 스쿼드, 마지막 말.'),
];
const file = (versions) => ({ subject: S, versions });

test('맞는 판은 오류 · 경고가 없다', () => {
  assert.deepEqual(checkFile(file(GOOD), C), { errors: [], warnings: [] });
});

test('첫 판은 떡밥이 처음 나온 스토리 · 판은 읽는 순서대로 · 마지막으로 움직인 스토리 뒤는 오류', () => {
  assert.ok(checkFile(file([GOOD[1]]), C).errors.some((m) => m.includes('첫 판의 at')));
  assert.ok(checkFile(file([GOOD[0], GOOD[1], ver('erelic:red_ash_lost', '홍련 — 궤멸한 부대', '홍련은 내전으로 궤멸한 극비 근접전 부대에서 홀로 남았다 — 그 부대에 무슨 일이 있었나.')]), C).errors.some((m) => m.includes('읽는 순서대로')));
  assert.ok(checkFile(file([...GOOD, ver('ch48', '홍련과 장화', '홍련은 무엇을 짊어졌나 — 언니의 검과 마지막 말, 그 뒤에 남은 것.')]), C).errors.some((m) => m.includes('마지막으로 움직인')));
  assert.ok(checkFile(file([GOOD[0], ver('ch99', '?', '?')]), C).errors.some((m) => m.includes('단위가 아니다')));
  // 떡밥이 움직이지 않은 스토리에 판 — 경고
  const still = checkFile(file([...GOOD, ver('ch45', '홍련과 장화 — 그 뒤', '홍련은 무엇을 짊어졌나 — 언니의 검과 마지막 말, 그 뒤에 남은 것.')]), C);
  assert.deepEqual(still.errors, []);
  assert.ok(still.warnings.some((m) => m.includes('떡밥이 움직이지 않는다')));
});

test('그 자리 뒤에 처음 쓰이는 대상 이름은 오류 — 표준명이 늦은 대상은 먼저 나온 다른 이름만, 쓰인 곳 없는 이름은 늘', () => {
  const bad = checkFile(file([ver('char:222', '홍련과 장화', '홍련은 언니 장화와 무슨 약속을 했나 — 검을 휘둘러야 한다는 약속은 무엇인가.'), GOOD[1]]), C);
  assert.ok(bad.errors.some((m) => m.includes('장화(NEW YEAR, NEW SWORD에서 처음)')), bad.errors.join('\n'));
  const N = nameIndex(TARGETS, C.units);
  assert.deepEqual(lateNames('백기사가 지킨다', 20, N, C.units), []);
  assert.deepEqual(lateNames('바이스리터가 지킨다', 20, N, C.units), ['바이스리터(CH.46 신생에서 처음)']);
  assert.deepEqual(lateNames('바이스리터가 지킨다', 50, N, C.units), []);
  assert.deepEqual(lateNames('말뚝 이름이 나온다', 60, N, C.units), ['말뚝 이름(쓰인 곳 없음)']);
  // 낱말 속 글자는 이름이 아니다(앞이 한글 음절)
  assert.deepEqual(lateNames('그장화', 20, N, C.units), []);
});

test('뒤 스토리 이름 · 판정 말 · 길이는 오류, 정체가 드러나기 전 두 이름을 함께 쓰면 경고', () => {
  const r = checkFile(file([ver('char:222', '홍련 — CH.46의 약속', '척추 스토리에서 홍련이 검을 휘둘러야 한다는 약속은 누구와 맺은 무엇인가 — 전멸한 스쿼드의 생존자.'), GOOD[1]]), C);
  assert.ok(r.errors.some((m) => m.includes('뒤 스토리 이름 — CH.46')));
  assert.ok(r.errors.some((m) => m.includes('판정 말')));
  assert.ok(checkFile(file([ver('char:222', '가'.repeat(41), '홍련은 무엇을 짊어졌나 — 검을 휘둘러야 한다는 약속은 누구와 맺은 무엇인가.'), GOOD[1]]), C).errors.some((m) => m.includes('41자')));
  const w = checkFile(file([ver('char:222', '홍련 — 약속', '아나키오르와 신데렐라 곁에서 홍련은 무엇을 짊어졌나 — 검을 휘둘러야 한다는 약속은 무엇인가.'), GOOD[1]]), C);
  assert.ok(w.warnings.some((m) => m.includes('정체가 드러나기 전')));
});

test('지문 — at 앞의 흐름이 바뀌면 낡음, 뒤가 바뀌는 것은 상관없다 · 확정 뒤 고치면 오류', () => {
  const before = srcHash(S, 'char:222', C);
  const more = structuredClone(FLOW);
  more.J30.roots[1].points.push({ r: 'Q300-3', s: '회수', u: 'ch46', o: 50 });
  assert.equal(srcHash(S, 'char:222', sourcesFrom({ units: UNITS, threads: THREADS, flow: more, targets: TARGETS })), before);
  more.J30.echoes.push({ r: 'E9', s: '암시', u: 'char:222', o: 20 });
  const C2 = sourcesFrom({ units: UNITS, threads: THREADS, flow: more, targets: TARGETS });
  assert.notEqual(srcHash(S, 'char:222', C2), before);
  const v = confirm(GOOD[0]);
  assert.equal(stateOf(v, srcHash(S, v.at, C)).ok, true);
  assert.equal(stateOf(v, srcHash(S, v.at, C2)).stale, true);
  assert.ok(checkFile(file([v, GOOD[1]]), C2).warnings.some((m) => m.includes('낡음')));
  const edited = { ...v, text: `${v.text} 덧붙임.` };
  assert.ok(checkFile(file([edited, GOOD[1]]), C).errors.some((m) => m.includes('확정한 뒤 판이 바뀌었다')));
});

test('내보낼 판 — 앞에서부터 확정 · 성한 판이 이어지는 데까지, 빠진 판은 화면이 그 앞 판을 보인다', () => {
  const a = confirm(GOOD[0]);
  const b = confirm(GOOD[1]);
  assert.deepEqual(publishable(file([a, b]), C).list.map((v) => v.at), ['char:222', 'event_newyearnewsword']);
  assert.deepEqual(publishable(file([a, GOOD[1]]), C).list.map((v) => v.at), ['char:222']);
  // 중간 판이 성하지 않으면 거기서 끊는다(뒤 판은 앞 판 위에 쓴다) · 기각한 판은 건너뛴다
  assert.deepEqual(publishable(file([GOOD[0], b]), C).list, []);
  assert.deepEqual(publishable(file([a, { ...GOOD[1], at: 'erelic:red_ash_lost', src: srcHash(S, 'erelic:red_ash_lost', C), status: '기각' }, b]), C).list.map((v) => v.at), ['char:222', 'event_newyearnewsword']);
  assert.deepEqual(publishable(file([a, { ...b, title: '홍련과 장화 — 고침' }]), C).list.map((v) => v.at), ['char:222']);
  assert.deepEqual(publishable({ subject: 'thread:J99', versions: [a] }, C).list, []);
});

test('내보내기 모듈 — 디렉터리의 판 파일을 versions.json으로', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-'));
  try {
    fs.writeFileSync(path.join(dir, fileNameFor(S)), JSON.stringify(file([confirm(GOOD[0]), confirm(GOOD[1])])));
    fs.writeFileSync(path.join(dir, 'thread.J1.json'), JSON.stringify({ subject: 'thread:J30', versions: [] }));
    const warnings = [];
    const ctx = { versionDir: dir, common: { units: UNITS }, made: { 'units.json': UNITS, 'threads.json': THREADS, 'threads-flow.json': FLOW, 'targets.json': TARGETS }, warn: (w) => warnings.push(w) };
    const out = (await exportVersions(ctx)).files['versions.json'];
    assert.deepEqual(Object.keys(out.threads), ['J30']);
    assert.deepEqual(out.threads.J30[1], { at: 'event_newyearnewsword', title: GOOD[1].title, text: GOOD[1].text });
    assert.ok(warnings.some((w) => /파일 이름이 대상과 다르다|같은 대상의 파일이 둘/.test(w.msg)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('화면 fmt.versionAt · threadAt — 앞 판들의 at을 다 본 마지막 판, 판이 없으면 끝까지 봤을 때만 분석용 이름', () => {
  const units = new Map(UNITS.map((u) => [u.key, u]));
  const R = (t, x = {}) => ({ all: t == null, seen: (k) => t == null || (k in x ? x[k] : (units.get(k)?.tick ?? 99) <= t) });
  const j = { ...THREADS.threads[0], v: [{ at: 'char:222', title: 'A', text: 'a' }, { at: 'event_newyearnewsword', title: 'B', text: 'b' }] };
  assert.equal(fmt.threadAt(j, R(1)).title, null); // 아직 안 나옴
  assert.equal(fmt.threadAt(j, R(3)).title, 'A');
  assert.deepEqual(fmt.threadAt(j, R(4)), { title: 'B', text: 'b', at: 'event_newyearnewsword', of: 2, started: true, whole: (units.get(j.last_unit)?.tick ?? 99) <= 4 });
  assert.equal(fmt.threadAt(j, R(null)).title, 'B');
  // 체크 칸 예외 — 앞 판들의 at을 다 봐야 뒤 판(뒤 판은 앞 판 내용 위에 쓴다). 앞 판 스토리를 안 골랐으면 거기서 멈춘다
  assert.equal(fmt.threadAt(j, R(3, { event_newyearnewsword: true })).title, 'B');
  assert.equal(fmt.threadAt(j, R(1, { event_newyearnewsword: true })).title, null);
  assert.equal(fmt.threadAt(j, R(5, { 'char:222': false })).title, null);
  const bare = { ...THREADS.threads[0] };
  assert.equal(fmt.threadAt(bare, R(4)).title, null);
  assert.equal(fmt.threadAt(bare, R(5)).title, '홍련과 장화');
  assert.equal(fmt.threadAt(bare, R(null)).title, '홍련과 장화');
  assert.equal(fmt.versionAt([], R(5)), null);
});

// 사전 설명(W15e) — 같은 꼴, 제목 없이 설명만. 첫 판 = 항목이 처음 나온 자리(meet의 마지막), 지문 = at까지 항목을 다룬 기록
const DT = [
  ...TARGETS,
  { id: 'item:세븐스_드워프', type: 'item', name: '세븐스 드워프', note: '…', meet: ['char:222', 'ch45'] }, // char:222(체크 칸) 뒤 ch45가 처음 나온 자리
  { id: 'org:에덴', type: 'org', name: '에덴', note: '…' }, // meet 없음 — 판을 둘 수 없다
];
const DREC = [
  { id: 'F1', kind: 'F', unit: 'ch45', about: ['item:세븐스_드워프'], text: '…' },
  { id: 'F2', kind: 'F', unit: 'ch48', about: ['item:세븐스_드워프', 'person:홍련'], text: '…' },
];
const DC = sourcesFrom({ units: UNITS, threads: THREADS, flow: FLOW, targets: DT, records: DREC });
const DS = 'item:세븐스_드워프';
const dver = (at, text, extra = {}) => ({ at, text, src: srcHash(DS, at, DC), session: 'W15e', by: 'claude', date: '2026-10-10', status: '후보', reviews: [], ...extra });

test('사전 판 — 첫 판은 처음 나온 자리(meet의 마지막) · 제목은 오류 · 뒤 이름 오류 · meet 없는 항목은 판을 둘 수 없다', () => {
  assert.equal(isDict(DS), true);
  assert.equal(dictFirst(DC.targetMap.get(DS)), 'ch45');
  const ok = { subject: DS, versions: [dver('ch45', '스노우 화이트가 들고 다니는 무기라는 것만 안다.'), dver('ch48', '홍련이 손본 무기로 드러났다 — 누가 처음 만들었나.')] };
  assert.deepEqual(checkFile(ok, DC), { errors: [], warnings: [] });
  const early = checkFile({ subject: DS, versions: [dver('char:222', '스노우 화이트가 들고 다니는 무기라는 것만 안다.')] }, DC);
  assert.ok(early.errors.some((m) => /첫 판의 at은 항목이 처음 나온 자리/.test(m)));
  const titled = checkFile({ subject: DS, versions: [dver('ch45', '스노우 화이트가 들고 다니는 무기라는 것만 안다.', { title: '무기' })] }, DC);
  assert.ok(titled.errors.some((m) => /title을 두지 않는다/.test(m)));
  const late = checkFile({ subject: DS, versions: [dver('ch45', '바이스리터가 들고 다니던 무기라는 것만 안다고 한다.')] }, DC);
  assert.ok(late.errors.some((m) => /이 자리 뒤에 처음 쓰이는 이름 — 바이스리터/.test(m)));
  const quiet = checkFile({ subject: DS, versions: [dver('ch45', '스노우 화이트가 들고 다니는 무기라는 것만 안다.'), dver('ch46', '스노우 화이트가 들고 다니는 무기 — 이름의 뜻은 모른다.')] }, DC);
  assert.ok(quiet.warnings.some((m) => /판 ch46: 이 스토리에서 항목을 다룬 기록이 없다/.test(m)));
  assert.match(checkFile({ subject: 'org:에덴', versions: [] }, DC).errors[0], /처음 나온 자리\(meet\)가 없는 항목/);
});

test('사전 판 지문 — at까지 항목을 다룬 기록이 바뀌면 낡음, 뒤 기록은 상관없다 · 내보내면 { at, text }', async () => {
  const v1 = dver('ch45', '스노우 화이트가 들고 다니는 무기라는 것만 안다.');
  const more = sourcesFrom({ units: UNITS, threads: THREADS, flow: FLOW, targets: DT, records: [...DREC, { id: 'F3', kind: 'F', unit: 'ch45', about: [DS], text: '…' }] });
  assert.notEqual(srcHash(DS, 'ch45', more), v1.src);
  const after = sourcesFrom({ units: UNITS, threads: THREADS, flow: FLOW, targets: DT, records: [...DREC, { id: 'F4', kind: 'F', unit: 'ch48', about: [DS], text: '…' }] });
  assert.equal(srcHash(DS, 'ch45', after), v1.src);
  const done = { ...v1, status: '확정', reviews: [{ decision: '확정', by: 'claude', hash: contentHash(v1) }] };
  assert.deepEqual(publishable({ subject: DS, versions: [done] }, DC).list, [{ at: 'ch45', text: v1.text }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-'));
  try {
    fs.writeFileSync(path.join(dir, fileNameFor(DS)), JSON.stringify({ subject: DS, versions: [done] }));
    const ctx = { versionDir: dir, common: { units: UNITS }, made: { 'units.json': UNITS, 'threads.json': THREADS, 'threads-flow.json': FLOW, 'targets.json': DT, 'records.json': DREC }, warn: () => {} };
    const out = (await exportVersions(ctx)).files['versions.json'];
    assert.deepEqual(out.targets, { [DS]: [{ at: 'ch45', text: v1.text }] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('화면 fmt.noteAt — 그 자리 판의 설명, 판이 없으면 전부 보기에서만 분석용 설명', () => {
  const units = new Map(UNITS.map((u) => [u.key, u]));
  const R = (t, x = {}) => ({ all: t == null, seen: (k) => t == null || (k in x ? x[k] : (units.get(k)?.tick ?? 99) <= t) });
  const t = { id: DS, note: '분석용', v: [{ at: 'ch45', text: '첫 설명' }, { at: 'ch48', text: '뒤 설명' }] };
  assert.equal(fmt.noteAt(t, R(3)), null);
  assert.equal(fmt.noteAt(t, R(4)), '첫 설명');
  assert.equal(fmt.noteAt(t, R(6)), '뒤 설명');
  assert.equal(fmt.noteAt(t, R(null)), '뒤 설명');
  const bare = { id: DS, note: '분석용' };
  assert.equal(fmt.noteAt(bare, R(6)), null);
  assert.equal(fmt.noteAt(bare, R(null)), '분석용');
  assert.equal(fmt.noteAt(bare, R(null), '걷은 설명'), '걷은 설명');
});

const hasData = fs.existsSync(path.join(SITE_DATA, 'threads-flow.json'));

test('실제 파일 — 깨진 파일 · 오류 없음, 확정 판은 지문이 맞다', { skip: !hasData && 'site/data 없음' }, () => {
  const real = loadSources();
  const set = loadVersions(VERSION_DIR);
  assert.deepEqual(set.problems, []);
  for (const { file: f, data } of set.list) {
    const r = checkFile(data, real);
    assert.deepEqual(r.errors, [], `${f}\n${r.errors.join('\n')}`);
    for (const v of data.versions) if (v.status === '확정') assert.equal(stateOf(v, srcHash(data.subject, v.at, real)).ok, true, `${f} ${v.at}`);
  }
});

test('내보낸 versions.json — 확정 판과 같고, 판마다 그 자리 뒤 이름이 없다', { skip: !hasData && 'site/data 없음' }, () => {
  const real = loadSources();
  const out = JSON.parse(fs.readFileSync(path.join(SITE_DATA, 'versions.json'), 'utf8'));
  const set = loadVersions(VERSION_DIR);
  for (const { data } of set.list) {
    const id = data.subject.replace(/^thread:/, '');
    const got = isDict(data.subject) ? out.targets?.[data.subject] : out.threads[id];
    assert.deepEqual(got ?? [], publishable(data, real).list, `${id} — node tools/site/export.mjs`);
  }
  for (const [id, list] of Object.entries(out.targets ?? {})) {
    assert.equal(list[0].at, dictFirst(real.targetMap.get(id)), `${id} 첫 판`);
    for (const v of list) assert.deepEqual(lateNames(v.text, real.units.get(v.at).order, real.names, real.units), [], `${id} ${v.at}: ${v.text}`);
  }
  for (const [id, list] of Object.entries(out.threads)) {
    assert.equal(list[0].at, real.threads.get(id).first_unit, `${id} 첫 판`);
    for (const v of list) {
      const o = real.units.get(v.at).order;
      for (const t of [v.title, v.text]) assert.deepEqual(lateNames(t, o, real.names, real.units), [], `${id} ${v.at}: ${t}`);
    }
  }
});
