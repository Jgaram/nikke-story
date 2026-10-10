/**
 * X3g-1b 주요 인물 — annotations/majors.json(C) · 계산(tools/views/majors.mjs) · 검증기 · 감정 재료 ⑧이 확정 항목만 쓰는지.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { EXAMPLE_DIR, ROOT, loadDataset, nextIds } from '../tools/records/model.mjs';
import { loadOrder } from '../tools/records/order.mjs';
import { checkDataset } from '../tools/records/check.mjs';
import { read2Edges } from '../tools/records/read2.mjs';
import { buildRead1Views } from '../tools/views/read1.mjs';
import { layerSignals } from '../tools/views/layers.mjs';
import { DEFAULT_CRITERIA, VARIANTS, gapsOf, majorMetrics, renderMajorsReport } from '../tools/views/majors.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });

test('끊김 — 순위 범위 안 이웃 비가 큰 순', () => {
  const g = gapsOf([100, 90, 80, 70, 60, 50, 20, 18, 17], [1, 8]);
  assert.deepEqual([g[0].at, g[0].above, g[0].below], [6, 50, 20]);
  assert.ok(g.every((x, i) => i === 0 || x.ratio <= g[i - 1].ratio));
  assert.deepEqual(gapsOf([5, 0, 0], [0, 5]), [], '0은 뺀다');
});

test('주요 인물 계산 — 명단(확정)과 같다 · 어긋남 0 · 문턱은 가장 큰 틈 안', () => {
  const v = majorMetrics(ds, ctx, order);
  assert.equal(v.criteria.score, ds.majors?.data?.criteria?.score ?? DEFAULT_CRITERIA.score);
  const confirmed = ds.candidates.filter((c) => c.kind === 'major' && c.status === '확정').map((c) => c.obj.person).sort();
  assert.deepEqual(v.majors.map((r) => r.person).sort(), confirmed, '계산 = 확정 항목');
  assert.deepEqual(v.rows.filter((r) => r.mismatch).map((r) => r.judgment.id), [], '어긋남 0');
  assert.deepEqual(v.rows.filter((r) => r.band && !r.judgment).map((r) => r.person), [], '띠 안 인물은 모두 항목이 있다');
  const g0 = v.gaps[0];
  assert.ok(g0.below < v.criteria.score && v.criteria.score <= g0.above, `문턱 ${v.criteria.score}이 가장 큰 틈(${g0.below}–${g0.above}) 안 — 신작 뒤 틈이 옮겨 가면 다시 본다`);
  // 점수 · 줄 · from
  for (const r of v.rows) {
    assert.ok(Math.abs(r.score - Math.sqrt(r.scenes * r.changes)) < 1e-9);
    assert.ok(r.changes <= r.records && r.changes === r.changesMain + r.changesEv && r.scenes === r.scenesMain + r.scenesEv);
    assert.ok(r.from && v.chapters.includes(r.from), `${r.person} from은 척추 자리`);
  }
  for (const c of ds.candidates.filter((x) => x.kind === 'major' && x.status === '확정')) assert.equal(c.obj.from, v.byPerson.get(c.obj.person).from, `${c.id} from = 계산`);
  // 변형 — 같은 꼴에서 재료만 바꾼다(보고서에 위 n명의 차이 · 끊김)
  assert.equal(v.variants.length, VARIANTS.length);
  assert.ok(v.variants.every((x) => Array.isArray(x.in) && Array.isArray(x.out) && x.in.length === x.out.length));
  const rep = renderMajorsReport(v);
  assert.match(rep, /## 끊는 선/);
  assert.match(rep, /## 무엇에 휘둘리나/);
});

test('변화 줄 — 자리 · 측면(관계면 상대)마다 하나, 지휘관과의 관계 · 성격 · 기준은 안 센다', () => {
  const v = majorMetrics(ds, ctx, order);
  const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
  for (const r of v.rows.slice(0, 12)) {
    const keys = r.changeIds.map((id) => {
      const c = byId.get(id);
      assert.ok(c.kind === 'change' && c.act === '변화' && c.obj.aspect !== '성격' && v.chapters.includes(c.unit), `${id}`);
      assert.ok(!(c.obj.aspect === '관계' && [c.obj.person, ...(c.obj.with ?? [])].includes('person:지휘관')), `${id} — 지휘관과의 관계는 뺀다`);
      return [c.unit, c.obj.aspect, c.obj.aspect === '관계' ? (c.obj.with ?? []).join('+') : ''].join('|');
    });
    assert.equal(new Set(keys).size, keys.length, `${r.person} — 줄마다 첫 기록 하나`);
  }
});

test('감정 재료 ⑧ — 주요 인물은 확정 항목만(기각하면 척추 인물로 내려간다)', () => {
  const views = buildRead1Views(ds, ctx, order);
  const r2 = read2Edges(ds, ctx, order);
  const off = { ...ds, candidates: ds.candidates.map((c) => (c.kind === 'major' ? { ...c, status: '기각' } : c)) };
  const sig = layerSignals(off, views, r2);
  const all = [...sig.values()].flatMap((s) => s.emotion.moments);
  assert.ok(all.length > 0);
  assert.ok(all.every((m) => m.cls === '척추 인물' && m.grade === '보강'), '주요 인물이 없으면 상한은 보강뿐');
});

test('검증기 — 같은 인물 둘 · 사전 밖 인물 · 확정인데 from 없음 · 척추 밖 from', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'majors-'));
  const file = path.join(dir, 'majors.json');
  const majors = [
    { id: 'C1', person: 'person:마리안', from: 'ch01', reason: '…', status: '확정' },
    { id: 'C2', person: 'person:모더니아', reason: '…', status: '기각' },
    { id: 'C3', person: 'person:없는_인물', reason: '…', status: '기각' },
    { id: 'C4', person: 'person:라피', reason: '…', status: '확정' },
    { id: 'C5', person: 'person:아니스', from: 'char:1', reason: '…', status: '기각' },
    { id: 'C6', person: 'person:네온', from: 'ch02', scenes: '많다', status: '기각' },
  ];
  // 공통 칸(확신도 · 검토 기록)은 갖춘다 — 주요 인물 칸의 오류만 본다
  const review = (o) => ({ ...o, confidence: '추정', reviews: [{ decision: o.status, by: 'claude', date: '2026-10-10', session: 'X3g-1b' }] });
  fs.writeFileSync(file, JSON.stringify({ by: 'claude', criteria: { score: 32 }, majors: majors.map(review) }));
  const t = loadDataset({ majors: file });
  const { errors } = checkDataset(t, ctx, order);
  const mine = errors.filter((e) => /^C\d$/.test(e.id ?? ''));
  const ids = (re) => [...new Set(mine.filter((e) => re.test(e.msg)).map((e) => e.id))];
  assert.deepEqual(ids(/항목이 둘/), ['C2'], '마리안 = 모더니아');
  assert.deepEqual(ids(/사전의 인물 ID/), ['C3']);
  assert.deepEqual(ids(/^from/), ['C4', 'C5']);
  assert.deepEqual(ids(/scenes는 수/), ['C6']);
  assert.deepEqual(ids(/이유\(reason\)/), ['C6']);
  assert.ok(!mine.some((e) => e.id === 'C1'));
  assert.equal(nextIds(t).C, 'C7');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('예시 데이터 · records.mjs — 예시 명단은 오류 0 · review "주요 인물" · set --from', () => {
  const ex = loadDataset({ dir: EXAMPLE_DIR });
  assert.equal(ex.candidates.filter((c) => c.kind === 'major').length, 2);
  assert.deepEqual(checkDataset(ex, ctx, order).errors, []);
  const r = node(['tools/records.mjs', 'review', '주요 인물', '--status', '전부', '--brief', '--example']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /C1 \[확정 · 확실\] person:라피 ch00부터/);
  assert.match(r.stdout, /C2 \[기각 · 추정\] person:마리안/);
  // --from은 주요 인물 하나에도 쓴다(--before는 판정에만)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'majors-ex-'));
  for (const f of fs.readdirSync(EXAMPLE_DIR)) fs.cpSync(path.join(EXAMPLE_DIR, f), path.join(dir, f), { recursive: true });
  const byUser = node(['tools/records.mjs', 'set', 'C2', '확정', '--by', '사용자', '--dir', dir]);
  assert.notEqual(byUser.status, 0, '--by 사용자는 받지 않는다 — 기록은 Claude만 정한다');
  const set = node(['tools/records.mjs', 'set', 'C2', '확정', '--from', 'ch01', '--note', '테스트', '--dir', dir]);
  assert.equal(set.status, 0, set.stderr);
  const after = JSON.parse(fs.readFileSync(path.join(dir, '_majors.json'), 'utf8')).majors[1];
  assert.deepEqual([after.status, after.from, after.reviews.at(-1).by], ['확정', 'ch01', 'claude']);
  const bad = node(['tools/records.mjs', 'set', 'C2', '확정', '--before', '참고', '--dir', dir]);
  assert.notEqual(bad.status, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
