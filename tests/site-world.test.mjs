/**
 * 세계 탭(W7) — 내보낸 world.json의 짜임 · 사전 메모에서 작업 표기가 걷혔는지 · 탭 모듈 규약 · Pages 배포 워크플로.
 * 내보내기를 다시 돌리지 않고 커밋된 site/data/world.json을 읽는다(DB 없이 돈다). 파일이 낡았으면 `node tools/site/export.mjs --only world`.
 *
 *   node --test tests/site-world.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanNote } from '../tools/site/export/world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const world = read('world.json');
const records = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
const unitKeys = new Set(read('units.json').map((u) => u.key));

test('cleanNote — 근거 괄호 · 작업 문장 · 머리 · 꼬리를 걷는다', () => {
  assert.equal(cleanNote('니케 전용 병원(R02 sub:저스틴_00에서 더함)'), '니케 전용 병원');
  assert.equal(cleanNote('R03 ch12에서 더함 — 헬레틱의 파편을 부르는 이름. 나노머신 덩어리다'), '헬레틱의 파편을 부르는 이름. 나노머신 덩어리다');
  assert.equal(cleanNote('인류가 사는 도시(Ark). \'아크\'는 대부분 다른 이름의 앞머리라 별칭으로 넣지 않았다'), '인류가 사는 도시(Ark).');
  assert.equal(cleanNote('지상의 북부(d_main_04af_07#0 · #12–13, R01 ch04에서 더함)'), '지상의 북부');
  assert.equal(cleanNote('치어리더 팀(ep:d_nikke_bay_01#8). 가게처럼 쓰인다 — Q-A2-3'), '치어리더 팀.');
  assert.equal(cleanNote('필그림의 통칭(d_main_04af_07#6) — 별칭은 R01에서 더함'), '필그림의 통칭');
  assert.equal(cleanNote('무엇인지(물질 · 기술 · 계획)는 1회독이 적는다'), null);
  assert.equal(cleanNote(null), null);
  assert.equal(cleanNote('원문 그대로 짧은 메모'), '원문 그대로 짧은 메모');
});

test('world.json — 항목 225 · 생활상 449 · 분류 합 · 흔한 항목', () => {
  assert.ok(Array.isArray(world.entries) && Array.isArray(world.life) && Array.isArray(world.topics) && Array.isArray(world.hubs));
  assert.equal(world.entries.length, 225);
  assert.equal(world.life.length, 449);
  assert.equal(world.topics.reduce((s, t) => s + t.n, 0), world.life.length);
  const ids = new Set(world.entries.map((e) => e.id));
  assert.equal(ids.size, world.entries.length, '항목 ID 중복');
  for (const e of world.entries) {
    assert.match(e.id, /^(concept|incident|item|org|place):/, e.id);
    assert.equal(e.type, e.id.split(':')[0], e.id);
    assert.ok(e.name, e.id);
    assert.ok(Number.isInteger(e.facts) && Number.isInteger(e.questions), e.id);
  }
  for (const h of world.hubs) assert.ok(ids.has(h), `흔한 항목 ${h}`);
  assert.deepEqual(world.hubs.sort(), ['concept:니케', 'concept:랩쳐', 'org:중앙_정부', 'place:방주', 'place:지상']);
  // 사실 수 순으로 정렬되어 있다 — 탭이 기본 순서로 쓴다
  for (let i = 1; i < world.entries.length; i++) assert.ok((world.entries[i - 1].facts ?? 0) >= (world.entries[i].facts ?? 0), `정렬 ${i}`);
});

test('world.json — 기록 ID · 이웃 · 단위 키가 실제로 있다', () => {
  const ids = new Set(world.entries.map((e) => e.id));
  for (const e of world.entries) {
    for (const [kind, list] of Object.entries(e.recs ?? {})) {
      assert.ok(['F', 'Q', 'U', 'E', 'I', 'D'].includes(kind), `${e.id} 종류 ${kind}`);
      for (const [rid, tick, layer] of list) {
        const r = records.get(rid);
        assert.ok(r, `${e.id} → ${rid}`);
        assert.equal(r.kind, kind, `${rid} 종류`);
        assert.ok(r.about?.includes(e.id), `${rid}의 about에 ${e.id}가 없다`);
        assert.equal(tick, r.tick ?? null, `${rid} 출시 시점`);
        assert.ok(layer == null || [1, 2, 3].includes(layer), `${rid} 범위`);
      }
    }
    for (const nb of e.neighbors ?? []) {
      assert.ok(ids.has(nb.id), `${e.id} 이웃 ${nb.id}`);
      assert.ok(nb.n > 0 && nb.recs.length === nb.n, `${e.id}↔${nb.id} 수`);
    }
    for (const [key, n] of e.units ?? []) {
      assert.ok(unitKeys.has(key), `${e.id} 단위 ${key}`);
      assert.ok(n > 0);
    }
    assert.equal(e.facts, (e.recs?.F ?? []).length, `${e.id} 사실 수`);
    assert.equal(e.questions, (e.recs?.Q ?? []).length, `${e.id} 의문 수`);
  }
  // 이웃은 양쪽에서 같은 수로 보인다
  const nbOf = new Map(world.entries.map((e) => [e.id, new Map((e.neighbors ?? []).map((n) => [n.id, n.n]))]));
  for (const e of world.entries) for (const nb of e.neighbors ?? []) assert.equal(nbOf.get(nb.id).get(e.id), nb.n, `${e.id}↔${nb.id} 비대칭`);
  for (const l of world.life) {
    const r = records.get(l.id);
    assert.ok(r && r.kind === 'U', l.id);
    assert.equal(l.topic, r.topic);
    assert.ok(unitKeys.has(l.unit), `${l.id} 단위`);
    assert.ok(l.text && l.evidence?.length, `${l.id} 문장 · 근거`);
  }
});

test('world.json — recs의 아는 단위가 records.json(know_units · unit)과 같다 · 예외가 없으면 출시 시점 규칙과 같다', () => {
  const unitTick = new Map(read('units.json').map((u) => [u.key, u.tick]));
  const ticks = [...new Set([...unitTick.values()].filter((t) => t != null))].sort((a, b) => a - b);
  for (const e of world.entries) {
    for (const x of Object.values(e.recs ?? {}).flat()) {
      const r = records.get(x[0]);
      const want = (r.kind === 'F' || r.kind === 'Q') && r.know_units?.length ? r.know_units : r.unit ?? null;
      const got = typeof x[3] === 'number' ? e.units[x[3]]?.[0] : x[3];
      assert.deepEqual(got, want, `${e.id} ${x[0]} 아는 단위`);
      if (typeof want === 'string') assert.equal(typeof x[3], 'number', `${x[0]} 단위 하나는 units[] 자리로 줄인다`);
      // 예외(x)가 없을 때 '아는 단위 중 하나라도 tick ≤ t' ≡ '기록 tick ≤ t'
      const us = Array.isArray(want) ? want : want == null ? [] : [want];
      if (!us.length || x[1] == null) continue;
      const min = Math.min(...us.map((k) => unitTick.get(k) ?? -Infinity));
      for (const t of [x[1] - 1, x[1], min - 1, min]) if (ticks.includes(t)) assert.equal(min <= t, x[1] <= t, `${x[0]} t=${t}`);
    }
  }
});

test('world.json — 사전 메모에 작업 표기가 없다 · 본문 칼럼 이름이 없다', () => {
  const work = /\bR\d+\b|에서 더함|1회독|2회독|\bQ-[A-Z0-9]+-\d+|\bd_main_|\bep:d_|(?:^|\W)event_[a-z]+|speakers\.json|사용자\(RV/;
  const forbidden = ['quest_name', 'scenario_localkey', 'speaker_name', 'window'];
  const walk = (v, p) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { assert.ok(!forbidden.includes(k), `${p}.${k}`); walk(x, `${p}.${k}`); }
  };
  walk(world, 'world');
  for (const e of world.entries) {
    assert.ok(!work.test(e.note ?? ''), `${e.id} note: ${e.note}`);
    for (const a of e.aliases ?? []) assert.ok(!work.test(a.caution ?? ''), `${e.id} 주의: ${a.caution}`);
  }
});

test('탭 모듈 — meta · mount · 화면 라벨은 한 객체에 · 외부 URL 없음', async () => {
  const mod = await import('../site/tabs/world.js');
  assert.equal(mod.meta.id, 'world');
  assert.equal(typeof mod.mount, 'function');
  const src = fs.readFileSync(path.join(ROOT, 'site/tabs/world.js'), 'utf8');
  assert.match(src, /const LABELS = \{/);
  assert.ok(!/화자/.test(src), '"화자"라는 말은 쓰지 않는다');
  assert.ok(!/https?:\/\//.test(src.replace(/\/\/.*$/gm, '')), '외부 URL');
  const css = fs.readFileSync(path.join(ROOT, 'site/tabs/world.css'), 'utf8');
  for (const line of css.split('\n')) {
    const sel = line.match(/^(\.[\w-]+[^{]*)\{/)?.[1];
    if (sel && !sel.startsWith('.tab-world')) assert.fail(`world.css 선택자는 .tab-world 아래만: ${sel}`);
  }
});

test('Pages 워크플로 — 권한 · 버전 고정 · site만 · 서브모듈 안 받음', () => {
  const y = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert.match(y, /pages:\s*write/);
  assert.match(y, /id-token:\s*write/);
  assert.match(y, /workflow_dispatch/);
  assert.match(y, /'site\/\*\*'/);
  assert.match(y, /submodules:\s*false/);
  assert.match(y, /path:\s*site\s*$/m);
  for (const a of ['actions/checkout', 'actions/configure-pages', 'actions/upload-pages-artifact', 'actions/deploy-pages']) {
    assert.match(y, new RegExp(`${a}@v\\d+\\.\\d+\\.\\d+`), `${a} 버전 고정`);
  }
  assert.match(y, /quest_name/);
  assert.match(y, /scenario_localkey/);
  assert.match(y, /20 \* 1024 \* 1024/);
});
