/**
 * X3f-1b · 1c 척추 — annotations/spine.json(B) · 선정 계산(tools/views/spine.mjs) · 척추 자리(from) · find --spine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, ROOT, loadDataset, sameAsGroups, spineUnits } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { checkDataset, splitArc } from '../tools/records/check.mjs';
import { computeLayers } from '../tools/records/layers.mjs';
import { DEFAULT_CRITERIA, renderSpineReport, spineMetrics } from '../tools/views/spine.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });

test('척추 집합 — spine.json 확정 11(이벤트 8 · 사이드 3), 모두 읽기 순서의 이벤트 · 사이드', () => {
  const spine = spineUnits(ds);
  assert.equal(spine.size, 11);
  assert.deepEqual([...spine].filter((u) => u.startsWith('side:')).sort(), ['side:eden_spear', 'side:mudfish', 'side:pretty_star']);
  assert.ok(['event_overzone', 'event_redash', 'event_lastkingdom1', 'event_oldtales1', 'event_goddessfall1', 'event_staranis1', 'event_footstepwalkrun1', 'fl:ark_guardian'].every((u) => spine.has(u)));
  assert.ok(ds.candidates.filter((c) => c.kind === 'spine').every((c) => /^B\d+$/.test(c.id) && c.spineUnit && c.obj.gate));
  // 층 — 척추 단위는 1층, 판정 K는 남는다
  const lay = computeLayers(ds, order);
  for (const u of spine) assert.deepEqual([lay.byUnit.get(u).spine, lay.byUnit.get(u).layer, Boolean(lay.byUnit.get(u).judgment)], [true, 1, true], u);
});

test('척추 선정 계산 — X3f-1b가 손으로 센 수와 같다 · 어긋남 0 · 손잡이', () => {
  const v = spineMetrics(ds, ctx, order);
  assert.deepEqual(v.criteria, DEFAULT_CRITERIA);
  const m = (u) => {
    const x = v.byUnit.get(u);
    return [x.skeleton, x.payoffs, x.answers, x.main];
  };
  // data/views/importance/spine-candidates.md 선정 결과 표(ⓐ · ⓒ 긴 회수 · 복선의 답 · ⓑ)
  assert.deepEqual(m('event_overzone'), [9, 1, 1, 11]);
  assert.deepEqual(m('event_redash'), [8, 0, 5, 9]);
  assert.deepEqual(m('event_lastkingdom1'), [6, 0, 4, 5]);
  assert.deepEqual(m('event_oldtales1'), [6, 0, 3, 16]);
  assert.deepEqual(m('event_unbreakablesphere1'), [7, 0, 2, 2]);
  assert.deepEqual(m('event_goddessfall1'), [26, 1, 8, 29]);
  assert.deepEqual(m('event_staranis1'), [0, 3, 9, 18]);
  assert.deepEqual(m('event_newyearnewsword'), [0, 1, 1, 5]);
  assert.deepEqual(m('event_footstepwalkrun1'), [14, 3, 2, 22]);
  assert.deepEqual(m('fl:ark_guardian'), [19, 4, 6, 26]);
  assert.deepEqual(m('side:mudfish'), [4, 0, 2, 11]);
  assert.deepEqual(m('side:pretty_star'), [4, 1, 5, 10]);
  const gate = v.units.filter((u) => u.judgment);
  assert.equal(gate.length, 17);
  assert.deepEqual(gate.filter((u) => u.mismatch), [], '판정(B)과 계산이 어긋나지 않는다');
  assert.ok(gate.every((u) => u.pass === (u.status === '확정')));
  assert.ok(!v.byUnit.get('event_wisdomspring').judgment && v.byUnit.get('event_wisdomspring').skeleton >= 3, '문 밖 이벤트는 넘어도 척추가 아니다');
  const rep = renderSpineReport(v);
  assert.match(rep, /척추 11\(이벤트 8 · 사이드 3\) · 문 안이지만 미달 6 · 계산과 어긋남 0/);
  assert.match(rep, /ⓑ를 빼면.*`event_unbreakablesphere1`\(들어옴\)/);
  assert.match(rep, /ⓐ · ⓒ를 빼면.*`event_newyearnewsword`\(들어옴\)/);
});

test('척추 자리 — 판정 K · 주역 Z의 from · arcs에 척추 키, 척추 단위의 판정은 자리 경고 없음', () => {
  const spine = spineUnits(ds);
  const keys = new Set(['ch20', 'ch29', 'event_redash', 'fl:ark_guardian', 'side:eden_spear']);
  assert.deepEqual(splitArc('ch20-ch29', keys), ['ch20', 'ch29']);
  assert.deepEqual(splitArc('ch19', new Set(['ch19'])), ['ch19', null]);
  assert.deepEqual(splitArc('event_redash-ch29', keys), ['event_redash', 'ch29']);
  assert.deepEqual(splitArc('side:eden_spear-fl:ark_guardian', keys), ['side:eden_spear', 'fl:ark_guardian']);
  assert.equal(splitArc('ch05-ch99', keys), null);
  // 실제 명단 — 주역의 from · arcs에 척추 키가 있고 검증기는 오류 0
  const live = ds.candidates.filter((c) => c.kind === 'lead' && c.status !== '기각');
  assert.ok(live.some((c) => spine.has(c.obj.from)), '척추 이벤트 · 사이드부터 주역이 되는 사람이 있다');
  const { errors } = checkDataset(ds, ctx, order);
  assert.deepEqual(errors, []);
  // 예시 데이터 — 척추 파일 없이도 돈다(spineKeys = 메인 챕터)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spine-'));
  for (const f of fs.readdirSync(EXAMPLE_DIR)) fs.cpSync(path.join(EXAMPLE_DIR, f), path.join(dir, f), { recursive: true });
  const ex = loadDataset({ dir });
  assert.equal(spineUnits(ex).size, 0);
  const r = checkDataset(ex, ctx, order);
  assert.deepEqual(r.errors, []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('같은 인물 묶음 — 확정 same_as의 인물 쌍을 묶는다', () => {
  const g = sameAsGroups(ds);
  assert.deepEqual(g.get('person:아나키오르'), ['person:거울_공주', 'person:신데렐라', 'person:아나키오르']);
  assert.deepEqual(g.get('person:모더니아'), ['person:마리안', 'person:모더니아']);
  assert.equal(g.get('person:지휘관'), undefined);
});

test('records.mjs — find --spine · E의 points · leads 원점 칸 · review B', () => {
  const all = node(['tools/records.mjs', 'find', '오스왈드']);
  const sp = node(['tools/records.mjs', 'find', '오스왈드', '--spine']);
  assert.equal(sp.status, 0, sp.stderr);
  // 기록 줄(ID로 시작)의 단위만 — "→" 줄은 떡밥이 가리킨 기록이라 척추 밖 단위일 수 있다
  const units = (out) => new Set(out.split('\n').filter((l) => /^[A-Z]\d/.test(l)).map((l) => l.match(/ — (\S+)$/)?.[1]).filter(Boolean));
  const spine = spineUnits(ds);
  assert.ok([...units(sp.stdout)].every((u) => /^ch\d/.test(u) || spine.has(u) || u.endsWith('.json')), [...units(sp.stdout)].join(' '));
  assert.ok(units(all.stdout).size > units(sp.stdout).size, '--spine은 척추 안 기록만');
  assert.match(sp.stdout, /^E\d+ \[확정\] 떡밥 암시 .*\n    → /m, '2회독 떡밥은 가리킨 기록(points)을 같이 보인다');
  const leads = node(['tools/records.mjs', 'leads']);
  assert.match(leads.stdout, /Z\d+ \[확정 · \S+\] person:라피 ch00부터 · 전체 · 원점 event_footstepwalkrun1 — J2의 주인 · 카운터스/);
  assert.match(leads.stdout, /person:퀸 side:eden_spear부터/);
  const one = node(['tools/records.mjs', 'leads', '신데렐라']);
  assert.match(one.stdout, /■ person:신데렐라 \(= 거울_공주 · 아나키오르\) — Z31 확정/);
  assert.match(one.stdout, /역할: J12의 주인/);
  const b = node(['tools/records.mjs', 'review', 'B7', '--brief']);
  assert.match(b.stdout, /B7 \[확정 · 추정\] event_staranis1 문 3\.5주년/);
});
