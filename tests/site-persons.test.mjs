/**
 * 사이트 탭 "인물"(W5) — 내보낸 persons*.json의 모양, 관계 상대 rel[]이 시안 표(relations.csv)와 같은지(W21 — 같은 씬 횟수 '함께 나옴'은 지웠다).
 *
 *   node --test tests/site-persons.test.mjs
 *
 * site/data/를 그대로 읽는다(내보내기를 다시 돌리지 않는다 — `node tools/site/export.mjs --only persons` 뒤에 본다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bucketOf } from '../site/tabs/persons.js';
import { readCsv } from '../tools/site/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const persons = read('persons.json');
const detail = read('persons-detail.json');
const records = new Map([...read('records.json'), ...read('records2.json')].map((r) => [r.id, r]));
const units = read('units.json');
const unitByKey = new Map(units.map((u) => [u.key, u]));
const personIds = new Set(persons.map((p) => p.id));

test('persons.json — 인물 387, 중복 없음, 이름 · 집계 칸', () => {
  assert.equal(persons.length, 387); // 아버지 머스탱(다른 인물 L36 — 손으로 세운 같은 이름의 다른 사람)
  assert.equal(personIds.size, persons.length);
  for (const p of persons) {
    assert.ok(p.id.startsWith('person:') && p.name, p.id);
    assert.ok(Number.isFinite(p.scenes) && Number.isFinite(p.lines), p.id);
    assert.ok(!('text' in p) && !('quest_name' in p), `${p.id}: 본문 칼럼 없음`);
  }
  assert.deepEqual(persons.filter((p) => p.common).map((p) => p.name).sort(), ['네온', '라피', '아니스', '지휘관']);
});

test('persons-detail.json — 히트맵 단위는 단위 표에 있고 읽는 순서대로, 합이 인물 표와 같다', () => {
  const byId = new Map(persons.map((p) => [p.id, p]));
  for (const d of detail) {
    const p = byId.get(d.id);
    assert.ok(p, d.id);
    let last = 0;
    let scenes = 0;
    let lines = 0;
    for (const e of d.units) {
      const u = unitByKey.get(e.unit);
      assert.ok(u, `${d.id} ${e.unit}`);
      assert.ok(u.order >= last, `${d.id}: 읽는 순서`);
      last = u.order;
      scenes += e.scenes;
      lines += e.lines;
    }
    assert.equal(scenes, p.scenes, `${d.id} 씬`);
    assert.equal(lines, p.lines, `${d.id} 줄`);
    assert.ok(d.units.every((e) => !unitByKey.get(e.unit).fool), `${d.id} — 만우절 단위의 등장은 세지 않는다(결정 #11)`);
    // 변화는 목록에 남기고 수에서만 뺀다. 다른 인물 줄을 근거로 한 변화(W24a — imp)는 이름 주인 쪽에도 실린다(person = 실제 사람) — 그 줄은 실제 사람의 수에만
    const own = d.changes.filter((c) => !c.imp || c.person === d.id);
    const counted = own.filter((c) => !unitByKey.get(c.unit)?.fool).length;
    assert.equal(counted, (p.baselines ?? 0) + (p.changes ?? 0), `${d.id} 변화`);
    for (const c of d.changes.filter((x) => x.imp && x.person !== d.id)) assert.ok(c.imp.some((m) => m.a === c.person && m.b === d.id), `${d.id} ${c.id} — 드러나기 전 모습만 이 인물`);
    for (const c of d.changes) assert.ok(['기준', '변화'].includes(c.act) && c.aspect && unitByKey.has(c.unit), `${d.id} ${c.id}`);
  }
});

test('rel[] — 관계 상대는 relations.csv의 쌍을 양쪽에, 확정 기록만 읽는 자리 순으로(수 · 순위 없음)', () => {
  const csv = readCsv(path.join(ROOT, 'data/views/persons/relations.csv'));
  const want = new Map();
  const add = (a, b, id) => (want.get(`${a}\t${b}`) ?? want.set(`${a}\t${b}`, new Set()).get(`${a}\t${b}`)).add(id);
  // 다른 인물 줄을 근거로 한 기록(W24a — imp)은 드러나기 전 모습의 쌍에도 실린다
  const face = (x, r) => r.imp?.find((m) => m.a === x)?.b ?? x;
  const facePeople = (r) => [r.person, ...(r.with ?? [])].map((x) => face(x, r));
  for (const r of csv) {
    const ids = [r.changes, r.closures, r.merges].join(' ').split(' ').filter((id) => id && records.has(id));
    for (const id of ids) {
      add(r.a, r.b, id);
      add(r.b, r.a, id);
      const rec = records.get(id);
      const [fa, fb] = [face(r.a, rec), face(r.b, rec)];
      if (fa !== r.a || fb !== r.b) { add(fa, fb, id); add(fb, fa, id); }
    }
  }
  let n = 0;
  for (const d of detail) {
    for (const x of d.rel ?? []) {
      n++;
      assert.ok(personIds.has(x.with) && x.with !== d.id, `${d.id} ${x.with}`);
      assert.deepEqual(Object.keys(x).sort(), ['recs', 'with'], '상대 · 기록 ID만(수 · 순위 없음)');
      assert.deepEqual(new Set(x.recs), want.get(`${d.id}\t${x.with}`), `${d.id} ${x.with}`);
      for (let i = 1; i < x.recs.length; i++) assert.ok(records.get(x.recs[i]).order >= records.get(x.recs[i - 1]).order, `${d.id} ${x.with} 읽는 자리 순`);
      for (const id of x.recs) {
        const r = records.get(id);
        assert.ok(['D', 'O', 'H'].includes(r.kind), id);
        const ppl = [r.person, ...(r.with ?? [])];
        const both = (xs) => xs.includes(d.id) && xs.includes(x.with);
        if (r.kind === 'D') assert.ok(r.aspect === '관계' && (both(ppl) || both(facePeople(r))), `${id} — 두 사람 사이의 변화`);
      }
    }
  }
  assert.equal(n, want.size);
  assert.ok(!fs.existsSync(path.join(ROOT, 'site/data/persons-pairs.json')), '옛 함께 나옴 표는 지웠다');
  assert.ok(persons.every((p) => !('partners' in p)), '함께 나온 인물 수는 싣지 않는다');
});

test('bucketOf — 말한 줄 수 5단계(0은 말한 줄 없음)', () => {
  assert.deepEqual([0, 1, 4, 5, 19, 20, 59, 60, 179, 180, 900].map(bucketOf), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
