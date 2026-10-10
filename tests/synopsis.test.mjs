/**
 * 공개 개요(W8) — 검사 규칙 · 확정 지문 · 원문 겹침 · 스포일러 경고 · W9 묶음 · 내보내기 · 실제 개요 파일. docs/annotations.md "공개 개요".
 *
 *   node --test
 *
 * 원문 겹침은 가짜 원문(테스트 안 문장)으로 본다 — DB가 없어도 돈다. 실제 개요 파일의 원문 겹침은 tests/quotes.test.mjs(40자)와
 * `node tools/synopsis.mjs check`(20자 경고)가 본다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sourceWindows } from '../tools/check-quotes.mjs';
import { run as exportSynopsis } from '../tools/site/export/synopsis.mjs';
import {
  LIMITS, checkSynopsis, contentHash, loadSynopses, overlapProblems, planBatches, spoilerProblems, stateOf, synopsisPath, unitKind,
} from '../tools/synopsis/model.mjs';

const SCENES = ['d_main_01_01_s', 'd_main_01_02'];
const good = () => ({
  unit: 'ch00',
  session: 'W8',
  by: 'claude',
  date: '2026-10-10',
  logline: '추락에서 살아난 신입 지휘관이 새 스쿼드를 맡는다.',
  synopsis: '수송기가 떨어지고 지휘관은 한 니케의 도움으로 살아난다. '.repeat(12).trim(),
  scenes: [{ scene: 'd_main_01_01_s', text: '수송기가 떨어진다' }, { scene: 'd_main_01_02', text: '랑데부 지점으로 걷는다' }],
  status: '후보',
  reviews: [],
});
const confirm = (s, by = 'claude') => ({ ...s, status: '확정', reviews: [...s.reviews, { decision: '확정', by, date: '2026-10-10', session: 'W8', hash: contentHash(s) }] });

test('맞는 개요는 오류 · 경고가 없다', () => {
  const r = checkSynopsis(confirm(good()), { scenes: SCENES });
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test('화면에 내면 안 되는 꼴은 오류다 — 씬 ID · 단위 키 · 줄 번호 · 기록 ID · 세션 이름', () => {
  for (const bad of ['d_main_01_02에서', 'char:180의', 'person:라피가', '#12줄', 'F12가 말하듯', 'Q3-2', 'M03 세션', 'X3f에서', 'event_nocallerid_01_s']) {
    const s = { ...good(), synopsis: `${good().synopsis} ${bad}` };
    assert.ok(checkSynopsis(s).errors.some((m) => m.includes('넣지 않는 꼴')), bad);
  }
  // 니케 이름 · 스쿼드 번호 · 기체 이름은 걸리지 않는다
  const ok = { ...good(), synopsis: `${good().synopsis} 스쿼드 04-F와 BA-01, AED, A.C.P.U.` };
  assert.deepEqual(checkSynopsis(ok).errors, []);
});

test('길이 · 빈 칸 — 한 줄 소개는 80자 넘으면 오류, 줄거리는 종류별 범위 밖이면 경고, 쓰는 중(후보)의 빈 칸은 경고', () => {
  assert.ok(checkSynopsis({ ...good(), logline: '가'.repeat(LIMITS.logline + 1) }).errors.some((m) => m.startsWith('logline이')));
  assert.ok(checkSynopsis({ ...good(), synopsis: '짧다.' }).warnings.some((m) => m.includes('메인는 300–1000자') || m.includes('300–1000')));
  const draft = checkSynopsis({ ...good(), logline: '', synopsis: '' });
  assert.deepEqual(draft.errors, []);
  assert.equal(draft.warnings.length, 2);
  assert.ok(checkSynopsis({ ...good(), status: '확정', logline: '' }).errors.some((m) => m.includes('logline')));
  assert.equal(unitKind('char:180'), 'episode');
  assert.equal(unitKind('fl:2x2_love_1ch'), 'event');
  assert.equal(unitKind('d_ex_elevator_01'), 'elevator');
});

test('씬 한 줄 — 그 단위의 씬만, 한 번씩, 빈 글 오류 · 100자 넘으면 경고', () => {
  const s = good();
  s.scenes = [{ scene: 'd_main_02_01', text: '다른 챕터' }, { scene: 'd_main_01_02', text: '' }, { scene: 'd_main_01_02', text: '가'.repeat(LIMITS.scene + 1) }];
  const r = checkSynopsis(s, { scenes: SCENES });
  assert.ok(r.errors.some((m) => m.includes('이 단위의 씬이 아니다')));
  assert.ok(r.errors.some((m) => m.includes('text가 비었다')));
  assert.ok(r.errors.some((m) => m.includes('같은 씬이 두 번')));
  assert.ok(r.warnings.some((m) => m.includes(`${LIMITS.scene}자 안쪽`)));
});

test('따옴표는 짧게 · 두 번까지, 작업 말은 경고', () => {
  const long = checkSynopsis({ ...good(), logline: '「이렇게 길고 긴 말을 따옴표 안에 그대로 옮겨 적으면」 안 된다' });
  assert.ok(long.warnings.some((m) => m.includes('따옴표 안이')));
  const many = checkSynopsis({ ...good(), logline: '「가」 「나」', scenes: [{ scene: 'd_main_01_02', text: '“다”' }] });
  assert.ok(many.warnings.some((m) => m.includes('따옴표가 3번')));
  const work = checkSynopsis({ ...good(), synopsis: `${good().synopsis} 이건 2회독에서 되짚기 할 일이다.` });
  assert.ok(work.warnings.some((m) => m.includes('작업 말')));
});

test('확정 지문 — 확정한 뒤 문장을 고치면 오류이고 ok가 아니다', () => {
  const s = confirm(good());
  assert.equal(stateOf(s).ok, true);
  const edited = { ...s, synopsis: `${s.synopsis} 한 문장 더.` };
  assert.equal(stateOf(edited).changed, true);
  assert.equal(stateOf(edited).ok, false);
  assert.ok(checkSynopsis(edited).errors.some((m) => m.startsWith('확정한 뒤')));
  assert.equal(stateOf(good()).ok, false);
  assert.equal(stateOf(confirm(good(), '사용자')).lastBy, '사용자');
});

test('원문 겹침 — 20자부터 경고, 40자부터 오류', () => {
  const source = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후';
  const fakeDb = { prepare: () => ({ iterate: () => [{ text: source }] }) };
  const windows = sourceWindows(fakeDb);
  const warn = overlapProblems({ ...good(), logline: `요약 ${source.slice(0, 24)} 끝` }, windows);
  assert.equal(warn.errors.length, 0);
  assert.equal(warn.warnings.length, 1);
  const err = overlapProblems({ ...good(), synopsis: `앞 ${source.slice(3, 48)} 뒤` }, windows);
  assert.equal(err.errors.length, 1);
  assert.deepEqual(overlapProblems(good(), windows), { errors: [], warnings: [] });
});

test('스포일러 경고 — 그 단위 뒤에 처음 나오는 이름, 앞 이름 속에 든 것은 빼고', () => {
  const firsts = new Map([['라피', { order: 1, unit: 'ch00' }], ['도로시', { order: 102, unit: 'char:221' }], ['후드', { order: 40, unit: 'ch20' }], ['레드 후드', { order: 3, unit: 'ch02' }]]);
  const s = { ...good(), synopsis: `${good().synopsis} 라피와 레드 후드, 그리고 도로시.` };
  const r = spoilerProblems(s, 10, firsts);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /도로시/);
  assert.doesNotMatch(r.warnings[0], /후드/);
  assert.deepEqual(spoilerProblems(s, 200, firsts).warnings, []);
});

test('W9 묶음 — 갈래 순서(메인 → 이벤트 → 작은 단위 → 호감도), 읽는 순서 유지, max 이하, 고르게', () => {
  const units = [
    ...Array.from({ length: 10 }, (_, i) => ({ key: `ch${String(i).padStart(2, '0')}`, order: i * 3 + 1, size: 10_000 })),
    { key: 'd_ex_elevator_01', order: 22, size: 2_000 },
    ...Array.from({ length: 6 }, (_, i) => ({ key: `event_e${i}`, order: i * 3 + 2, size: 15_000 })),
    { key: 'sub:a_00', order: 5, size: 500 },
    { key: 'relic:b', order: 7, size: 300 },
    ...Array.from({ length: 5 }, (_, i) => ({ key: `char:${i}`, order: i * 3 + 3, size: 4_000 })),
  ];
  const b = planBatches(units, 30_000);
  assert.deepEqual(b.map((x) => x.id), b.map((_, i) => `W9${'abcdefghijklmnopqrstuvwxyz'[i]}`));
  assert.deepEqual([...new Set(b.map((x) => x.group))], ['main', 'story', 'small', 'episode']);
  for (const x of b) assert.ok(x.size <= 30_000, `${x.id} ${x.size}`);
  const main = b.filter((x) => x.group === 'main');
  assert.equal(main.length, 4); // 102,000자 → 4묶음
  assert.ok(Math.max(...main.map((x) => x.size)) - Math.min(...main.map((x) => x.size)) <= 12_000); // 마지막만 작게 남지 않는다
  const flat = b.flatMap((x) => x.units);
  assert.equal(flat.length, units.length);
  assert.ok(flat.indexOf('ch09') < flat.indexOf('event_e0') && flat.indexOf('relic:b') < flat.indexOf('char:0'));
  // 갈래 안은 읽는 순서
  const orderOf = new Map(units.map((u) => [u.key, u.order]));
  for (const g of ['main', 'story', 'small', 'episode']) {
    const keys = b.filter((x) => x.group === g).flatMap((x) => x.units);
    assert.deepEqual(keys, [...keys].sort((x, y) => orderOf.get(x) - orderOf.get(y)));
  }
});

test('내보내기 — 확정 · 고치지 않은 개요만, 읽는 순서대로, 씬 한 줄은 씬 ID → 글', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nikke-synopsis-'));
  try {
    const write = (s) => fs.writeFileSync(synopsisPath(s.unit, dir), JSON.stringify(s));
    write(confirm(good()));
    write({ ...confirm({ ...good(), unit: 'ch01', scenes: [] }), synopsis: `${good().synopsis} 고침.` }); // 확정 뒤 고침
    write({ ...good(), unit: 'ch02', scenes: [] }); // 후보
    write(confirm({ ...good(), unit: 'char:180', scenes: [] }));
    fs.writeFileSync(path.join(dir, '_batches.json'), '{}'); // `_`로 시작하면 뺀다
    const warnings = [];
    const ctx = {
      synopsisDir: dir,
      warn: (w) => warnings.push(w),
      common: {
        units: [{ key: 'ch00', order: 1 }, { key: 'ch01', order: 2 }, { key: 'ch02', order: 3 }, { key: 'char:180', order: 93 }],
        scenesOf: new Map([['ch00', SCENES.map((id) => ({ id }))]]),
      },
    };
    const { files } = await exportSynopsis(ctx);
    const out = files['synopsis.json'];
    assert.deepEqual(out.map((x) => x.key), ['ch00', 'char:180']);
    assert.deepEqual(Object.keys(out[0]).sort(), ['key', 'logline', 'scenes', 'synopsis']);
    assert.deepEqual(out[0].scenes, { d_main_01_01_s: '수송기가 떨어진다', d_main_01_02: '랑데부 지점으로 걷는다' });
    assert.equal(out[1].scenes, undefined);
    assert.ok(warnings.some((w) => /확정한 뒤 고친 개요 1개/.test(w.msg)));
    // 1회독 요약 · 원문 칼럼을 읽지 않는다(주석은 빼고 코드만 본다)
    const src = fs.readFileSync(new URL('../tools/site/export/synopsis.mjs', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /read1|summary|lines\.text|quest_name|scenario_localkey/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('실제 개요 파일 — 깨진 파일 · 이름 어긋남 · 확정 뒤 고침 · 원문 없이 되는 검사의 오류가 없다', () => {
  const set = loadSynopses();
  assert.deepEqual(set.problems, []);
  for (const { file, data } of set.list) {
    assert.equal(file, path.basename(synopsisPath(data.unit)), file);
    const st = stateOf(data);
    assert.equal(st.changed, false, `${data.unit}: 확정한 뒤 고쳤다 — node tools/synopsis.mjs set ${data.unit} 확정`);
    assert.deepEqual(checkSynopsis(data).errors, [], data.unit);
  }
});
