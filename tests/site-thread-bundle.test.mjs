/**
 * 떡밥 그 자리 이름 · 묶음(W15d) — 화면이 떡밥 이름 · 요약 · 의문 · 사실을 그 자리 기준으로 보이는가.
 *   ① 화면 함수: fmt.threadStarted · threadLabel(자리 글) · threadBundle(묶음 거르기 — 처음 스토리 · 제목 속 이름 · 답으로 이어짐)
 *   ② 데이터: threads-flow.json 뿌리 · 복선의 about(내보내기 W15d), 실제 떡밥에서 묶음이 새지 않는가(J1 — CH.05 '병원의 소녀')
 *   ③ 소스: site/에서 떡밥 이름 · 요약(threads.json title · text)을 fmt 밖에서 바로 쓰지 않는다
 *   ④ fmt.unknownNameIn · relText — 떡밥끼리 관계 설명 속 모르는 이름(근거 스토리를 봐도 이름은 뒤에 나올 수 있다)
 *
 *   node --test tests/site-thread-bundle.test.mjs   (site/data/가 없으면 ②는 건너뛴다 — node tools/site/export.mjs)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'site/data');
const fmt = await import('../site/lib/format.js');
const has = fs.existsSync(path.join(DATA, 'threads-flow.json'));
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

/** state.reading()의 R을 흉내 낸다 — 체크 칸 스토리는 x 예외 우선, 그 밖은 tick ≤ t */
const mkR = (units, t, x = {}) => ({
  all: t == null, t,
  seen: (k) => t == null || (k in x ? x[k] : (units.get(k)?.tick ?? 1e9) <= t),
  seenAny(keys) { return t == null || keys.some((k) => this.seen(k)); },
});

// ── ① 화면 함수(만든 자료) ──
const U = new Map([['ch01', 1], ['ch02', 2], ['side:x', 3], ['ch03', 4], ['ch04', 5]].map(([key, tick], i) => [key, { key, tick, order: i + 1 }]));
const T = new Map([
  { id: 'person:가', type: 'person', name: '가람', meet: ['ch01'] },
  { id: 'person:나', type: 'person', name: '나래', meet: ['ch02'] },
  { id: 'person:다', type: 'person', name: '다온', meet: ['ch03'] },
  { id: 'concept:침', type: 'concept', name: '침식', meet: ['ch01'] },
].map((t) => [t.id, t]));
const J = {
  id: 'J9', title: '가람 — 침식 · 다온의 정체', text: '분석용 요약', first_unit: 'ch01', last_unit: 'ch04', about: ['person:가', 'person:다'], owners: ['person:가'],
  v: [{ at: 'ch01', title: '가람 — 침식', text: '가람은 왜' }, { at: 'side:x', title: '가람 — 침식 · 나래', text: '나래는' }, { at: 'ch04', title: '가람 — 다온', text: '다온은' }],
};
const F = {
  roots: [
    { id: 'Q1', kind: 'Q', first_tick: 1, unit: 'ch01', about: ['person:가'], text: '가람은 왜 쓰러졌나', points: [{ r: 'Q1', s: '제기', u: 'ch01' }, { r: 'Q1-2', s: '회수', u: 'ch03', a: 'F5' }] },
    { id: 'Q2', kind: 'Q', first_tick: 1, unit: 'ch02', about: ['person:나'], text: '병원의 소녀는 누구인가', points: [{ r: 'Q2', s: '제기', u: 'ch02' }] },
    { id: 'Q3', kind: 'Q', first_tick: 1, unit: 'ch02', about: ['concept:침'], text: '침식은 누가 심었나', points: [{ r: 'Q3', s: '제기', u: 'ch02' }] },
    { id: 'F5', kind: 'F', first_tick: 1, unit: 'ch03', about: ['person:다'], text: '다온이 쓰러뜨렸다', points: [{ r: 'F5', s: '처음 밝혀짐', u: 'ch03' }] },
    { id: 'Q6', kind: 'Q', first_tick: 1, unit: 'ch03', about: ['person:다'], text: '그 소녀는 가람과 무슨 사이인가', points: [{ r: 'Q6', s: '제기', u: 'ch03' }] },
  ],
  echoes: [{ r: 'E1', s: '암시', u: 'ch02', about: ['person:나'] }, { r: 'E2', s: '암시', u: 'ch02', about: ['concept:침'] }],
};

test('fmt.threadStarted · threadLabel — 판 규칙(첫 판 at · 체크 칸)으로 나왔나, 제목이 없으면 자리 글', () => {
  fmt.use({ units: U, targets: T, threads: new Map([[J.id, J]]) });
  const bare = { ...J, v: undefined };
  assert.equal(fmt.threadStarted(J, mkR(U, 0)), false);
  assert.equal(fmt.threadStarted(J, mkR(U, 1)), true);
  assert.equal(fmt.threadStarted(bare, mkR(U, 1)), true, '판이 없으면 첫 스토리');
  assert.equal(fmt.threadStarted(J, mkR(U, null)), true);
  assert.equal(fmt.threadLabel(J, mkR(U, 0)), fmt.THREAD_SLOT.notYet);
  assert.equal(fmt.threadLabel(J, mkR(U, 2)), '가람 — 침식');
  assert.equal(fmt.threadLabel(J, mkR(U, 4, { 'side:x': false })), '가람 — 침식', '체크 칸 판을 안 골랐으면 그 앞 판');
  assert.equal(fmt.threadLabel(bare, mkR(U, 2)), fmt.THREAD_SLOT.untitled, '판이 없으면 끝까지 보기 전에는 자리 글');
  assert.equal(fmt.threadLabel(bare, mkR(U, 5)), '가람 — 침식 · 다온의 정체');
  assert.equal(fmt.threadLabelOf('J9', mkR(U, 3)), '가람 — 침식 · 나래');
  assert.equal(fmt.threadLabelOf('J404', mkR(U, 3)), fmt.THREAD_SLOT.notYet);
  assert.equal(fmt.threadText(J, mkR(U, 1)), '가람은 왜');
  const a = fmt.threadAt(J, mkR(U, 5));
  assert.equal(a.whole, true, '마지막 스토리를 보고 마지막 판까지면 떡밥 전체를 안다');
  assert.equal(fmt.threadAt(J, mkR(U, 5, { 'side:x': false })).whole, false);
  // 문장 속 떡밥 ID도 그 자리 이름으로(prose — 읽음 판정이 묶이면)
  fmt.useReading(() => mkR(U, 1));
  assert.match(fmt.prose('J9가 시작된다'), /「가람」/);
  fmt.useReading(() => mkR(U, 0));
  assert.doesNotMatch(fmt.prose('J9가 시작된다'), /가람/);
  fmt.useReading(null);
});

test('fmt.threadBundle — 처음 스토리 · 제목 속 이름 · 답으로 이어진 것만, 떡밥 전체를 알면 전부', () => {
  fmt.use({ units: U, targets: T, threads: new Map([[J.id, J]]) });
  const ids = (b) => b.roots.map((r) => r.id).sort();
  assert.deepEqual(ids(fmt.threadBundle(J, F, mkR(U, 0))), [], '아직 안 나온 떡밥은 묶음도 없다');
  // ch02까지: 제목 '가람 — 침식' — Q1(처음 스토리) · Q3(침식을 다룸) · Q6(문장에 '가람' — 아직 안 나왔지만 묶음 판정은 단계와 따로, 화면이 stateAt으로 거른다).
  // Q2(나래 — 병원의 소녀)는 이 떡밥과 이어진 줄 모른다
  let b = fmt.threadBundle(J, F, mkR(U, 2));
  assert.deepEqual(ids(b), ['Q1', 'Q3', 'Q6']);
  assert.deepEqual(b.echoes.map((e) => e.r), ['E2']);
  // side:x를 보면 제목에 나래 — Q2가 든다
  assert.deepEqual(ids(fmt.threadBundle(J, F, mkR(U, 3))), ['Q1', 'Q2', 'Q3', 'Q6']);
  // ch03(side:x 안 봄): 제목은 그대로 '가람 — 침식' — Q1의 회수 답 F5가 답으로 이어지고, Q6은 문장에 '가람'이 있어 든다. Q2는 아직
  assert.deepEqual(ids(fmt.threadBundle(J, F, mkR(U, 4, { 'side:x': false }))), ['F5', 'Q1', 'Q3', 'Q6']);
  // 판이 없으면 제목이 없어 처음 스토리 · 답으로만
  const bare = { ...J, v: undefined };
  assert.deepEqual(ids(fmt.threadBundle(bare, F, mkR(U, 4))), ['F5', 'Q1']);
  // 떡밥 전체를 아는 자리 · 전부 보기
  assert.equal(fmt.threadBundle(J, F, mkR(U, 5)).whole, true);
  assert.equal(fmt.threadBundle(J, F, mkR(U, null)).roots.length, F.roots.length);
  assert.equal(fmt.threadBundle(bare, F, mkR(U, 5)).roots.length, F.roots.length);
});

// ── ② 실제 자료 ──
test('threads-flow.json — 뿌리 · 복선에 기록의 about이 실린다(묶음 거르기 재료)', { skip: !has }, () => {
  const flow = read('threads-flow.json');
  const recs = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
  let n = 0;
  for (const f of Object.values(flow)) {
    for (const x of [...f.roots, ...(f.echoes ?? []).map((e) => ({ ...e, id: e.r }))]) {
      const want = recs.get(x.id)?.about;
      if (want?.length) { assert.deepEqual(x.about, want, x.id); n += 1; }
    }
  }
  assert.ok(n > 100);
});

test('실제 떡밥 — 묶음은 뿌리의 부분이고, 안 나온 떡밥은 비고, 끝까지 보면 전부. J1의 CH.05 병원의 소녀는 CH.10에서 안 보인다', { skip: !has }, () => {
  const units = new Map(read('units.json').map((u) => [u.key, u]));
  const targets = new Map(read('targets.json').map((t) => [t.id, t]));
  const threads = read('threads.json').threads.map((j) => ({ ...j }));
  const versions = fs.existsSync(path.join(DATA, 'versions.json')) ? read('versions.json') : { threads: {} };
  for (const j of threads) if (versions.threads?.[j.id]) j.v = versions.threads[j.id];
  const byId = new Map(threads.map((j) => [j.id, j]));
  fmt.use({ units, targets, threads: byId });
  const flow = read('threads-flow.json');
  for (const t of [1, 11, 26, 60, null]) {
    const R = mkR(units, t);
    for (const j of threads) {
      const b = fmt.threadBundle(j, flow[j.id], R);
      const all = new Set(flow[j.id].roots.map((r) => r.id));
      assert.ok(b.roots.every((r) => all.has(r.id)), `${j.id} t=${t}`);
      if (!fmt.threadStarted(j, R)) assert.equal(b.roots.length, 0, `${j.id} t=${t} 안 나온 떡밥`);
      if (t == null) assert.equal(b.roots.length, all.size);
      // 판이 없는 떡밥은 끝까지 보기 전에는 처음 스토리의 뿌리와 답으로 이어진 것만
      if (!j.v?.length && !b.whole) {
        for (const r of b.roots) {
          const viaAnswer = flow[j.id].roots.some((x) => (x.points ?? []).some((p) => R.seen(p.u) && ((p.a === r.id) || (x.id === r.id && p.a))));
          assert.ok(r.unit === j.first_unit || viaAnswer, `${j.id} ${r.id} t=${t}`);
        }
      }
    }
  }
  const j1 = byId.get('J1');
  if (j1?.v?.length && flow.J1.roots.some((r) => r.id === 'Q20')) {
    const tick = (k) => units.get(k).tick;
    const at10 = fmt.threadBundle(j1, flow.J1, mkR(units, tick('ch10'))).roots.map((r) => r.id);
    assert.ok(at10.includes('Q1'), '처음 스토리의 의문');
    assert.ok(!at10.includes('Q20'), 'CH.05 병원의 소녀 — 마리안과 이어진다는 물음이 서기 전');
    const at13 = fmt.threadBundle(j1, flow.J1, mkR(units, tick('ch13'))).roots.map((r) => r.id);
    if (flow.J1.roots.some((r) => r.id === 'Q63')) assert.ok(at13.includes('Q63'), 'CH.13 — 마리안과 관계있나를 묻는 의문은 든다');
  }
});

// ── ③ 소스 ──
test('site/ 소스 — 떡밥 이름 · 요약은 fmt(threadAt · threadLabel)로만, 분석용 title · text를 바로 쓰지 않는다', () => {
  const files = ['site/app.js', ...['lib', 'tabs'].flatMap((d) => fs.readdirSync(path.join(ROOT, 'site', d)).filter((f) => f.endsWith('.js') && f !== 'format.js' && f !== 'd3.js').map((f) => `site/${d}/${f}`))];
  const bad = /threads\.get\([^)]*\)\??\.(?:title|text)\b|\b(?:j|th)\.(?:title|text)\b|threadList\.map\([^)]*\.title/;
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    src.split('\n').forEach((line, i) => assert.ok(!bad.test(line), `${f}:${i + 1} 떡밥 이름을 바로 쓴다 — fmt.threadLabel · threadAt으로`));
  }
  const uses = (f, re) => assert.match(fs.readFileSync(path.join(ROOT, f), 'utf8'), re, f);
  uses('site/tabs/threads.js', /fmt\.threadBundle/);
  uses('site/tabs/threads.js', /fmt\.threadLabel/);
  uses('site/lib/reader.js', /fmt\.threadBundle/);
  uses('site/lib/search.js', /fmt\.threadAt/);
  for (const f of ['site/tabs/links.js', 'site/tabs/persons.js', 'site/tabs/world.js', 'site/tabs/chrono.js']) uses(f, /fmt\.threadLabel/);
  // 떡밥 '시작'은 판 규칙으로 — 첫 스토리만 보는 옛 판정(state.seen(j.first_unit))이 남지 않는다
  for (const f of ['site/lib/reader.js', 'site/lib/search.js', 'site/tabs/world.js', 'site/tabs/persons.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, f), 'utf8'), /\|\|\s*(?:state|c\.R|R)\.seen\((?:j|th)\.first_unit\)|!hidden\((?:th|j|x\.j)\.first_unit\)|R\.seen\(e\.first\)/, f);
  }
});

test('fmt.threadTies — 본 것만: 아는 묶음 뿌리 · 그 본 단계 줄 · 본 복선, 아직 모르는 뿌리의 복선은 안 든다', () => {
  fmt.use({ units: U, targets: T, threads: new Map([[J.id, J]]) });
  const F2 = { roots: [...F.roots, { id: 'Q7', kind: 'Q', unit: 'ch04', about: ['person:가'], text: '가람은 돌아오나', first_tick: 5, hint_tick: 2, hint_units: ['ch02'],
    points: [{ r: 'E9', s: '암시', u: 'ch02', rel: '앞' }, { r: 'Q7', s: '제기', u: 'ch04' }] }], echoes: F.echoes };
  const t2 = fmt.threadTies(J, F2, mkR(U, 2));
  assert.equal(t2.started, true);
  assert.ok(t2.ids.has('Q1') && t2.ids.has('Q3') && t2.ids.has('E2'));
  assert.ok(!t2.ids.has('E9') && !t2.units.has('ch04'), 'Q7은 아직 안 나와 그 복선 E9도 이 떡밥의 것으로 안 보인다');
  assert.ok(!t2.ids.has('Q6'), '묶음에 들어도 아직 모르는 뿌리는 안 든다');
  assert.deepEqual([...t2.about].sort(), ['concept:침', 'person:가']);
  const t5 = fmt.threadTies(J, F2, mkR(U, 5));
  assert.ok(t5.whole && t5.ids.has('E9') && t5.units.has('ch02'));
  assert.equal(fmt.threadTies(J, F2, mkR(U, 0)).started, false);
});

test('fmt.unknownNameIn · relText — 그 자리에서 모르는 이름이 든 관계 설명은 가린다(낱말 첫머리 · 두 글자는 조사 앞만)', () => {
  fmt.use({ units: U, targets: T, threads: new Map([[J.id, J]]) });
  const R1 = mkR(U, 1);
  assert.equal(fmt.unknownNameIn('가람이 침식을 막는다', R1), null);
  assert.equal(fmt.unknownNameIn('가람은 다온의 손에 맞물린다', R1), '다온');
  assert.equal(fmt.unknownNameIn('나래와 가람', R1), '나래');
  assert.equal(fmt.unknownNameIn('나래와 가람', mkR(U, 2)), null);
  assert.equal(fmt.unknownNameIn('다온하다', R1), null, '두 글자 이름은 뒤가 낱말 안이면 아니다');
  assert.equal(fmt.unknownNameIn('나래와 가람', mkR(U, null)), null, '전부 보기');
  assert.equal(fmt.relText({ text: '다온이 가람을 부른다' }, R1), '');
  assert.equal(fmt.relText({ text: '가람이 침식을 막는다' }, R1), fmt.prose('가람이 침식을 막는다'));
});
