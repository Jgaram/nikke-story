/**
 * 탭 떡밥(W4) — 커밋된 site/data/threads-*.json의 모양과 지도 배치(결정적 · 겹침 없음), 탭 소스의 정적 검사.
 * DB 없이 돈다(커밋된 JSON만 읽는다). 내보내기 자체의 검사는 tests/site.test.mjs.
 *
 *   node --test tests/site-threads.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8'));
const flow = read('threads-flow.json');
const map = read('threads-map.json');
const threads = read('threads.json');
const units = new Map(read('units.json').map((u) => [u.key, u]));
const STAGES = new Set(['제기', '암시', '재언급', '일부 회수', '회수', '처음 밝혀짐', '보강', '뒤집힘']);

test('흐름 — 떡밥 60개 모두, 뿌리마다 단계 점이 있고 단계 · 자리 · 스토리가 알려진 값이다', () => {
  assert.equal(Object.keys(flow).length, threads.threads.length);
  for (const th of threads.threads) {
    const f = flow[th.id];
    assert.ok(f, `${th.id} 흐름이 없다`);
    assert.equal(f.roots.length, (th.questions?.length ?? 0) + (th.facts?.length ?? 0), `${th.id} 뿌리 수`);
    for (const r of f.roots) {
      assert.ok(['Q', 'F'].includes(r.kind), `${r.id} 종류`);
      assert.ok(r.text, `${r.id} 문장`);
      assert.ok(r.points.length >= 1, `${r.id}에 단계 점이 없다`);
      for (const p of r.points) {
        assert.ok(STAGES.has(p.s), `${r.id} 모르는 단계 ${p.s}`);
        assert.ok(Number.isFinite(p.t) && Number.isFinite(p.o), `${r.id} ${p.r} 자리`);
        assert.ok(units.has(p.u), `${r.id} ${p.r} 스토리 ${p.u}`);
        if (p.sc) assert.ok(Number.isFinite(p.ln), `${p.r} 줄 번호`);
        if (p.bu) assert.ok(['복선의 답', '긴 회수'].includes(p.bu), `${p.r} 빌드업 종류`);
      }
      // 점은 읽는 자리 순
      for (let i = 1; i < r.points.length; i++) assert.ok(r.points[i - 1].o <= r.points[i].o, `${r.id} 점 순서`);
    }
  }
});

test('지도 — 항목 · 선 · 결말 · 합류가 서로 가리키는 것이 있고, 작중 순서가 흐름의 스토리를 덮는다', () => {
  const ids = new Set(threads.threads.map((t) => t.id));
  const concepts = new Set(map.concepts.map((c) => c.id));
  for (const e of map.edges) { assert.ok(ids.has(e.j), `선 ${e.j}`); assert.ok(concepts.has(e.target), `선 ${e.target}`); }
  for (const p of map.pairs) { assert.ok(concepts.has(p.a) && concepts.has(p.b), '항목 짝'); }
  for (const g of threads.relations) assert.ok(g.id in map.relations, `관계 ${g.id} 근거 자리`);
  for (const c of map.closures) for (const j of c.threads ?? []) assert.ok(ids.has(j), `${c.id} → ${j}`);
  for (const m of map.merges) {
    for (const j of m.threads ?? []) assert.ok(ids.has(j), `${m.id} → ${j}`);
    assert.ok(m.members.length >= 1);
  }
  const need = new Set(Object.values(flow).flatMap((f) => f.units ?? []));
  for (const u of need) assert.ok(u in map.chrono, `작중 순서에 ${u}가 없다`);
  for (const [u, c] of Object.entries(map.chrono)) {
    assert.ok(units.has(u), `chrono ${u}`);
    if (c.class === '판별' || c.class === '범위') assert.ok(c.seq == null || Number.isFinite(c.seq));
    if (c.class === '상대' || c.class === '불명') assert.equal(c.seq, undefined, `${u} 상대 · 불명은 작중 순서가 없다`);
  }
});

test('내보낸 JSON에 대사 본문 칼럼 이름이 없다', () => {
  for (const f of ['threads-flow.json', 'threads-map.json']) {
    const raw = fs.readFileSync(path.join(ROOT, 'site/data', f), 'utf8');
    assert.ok(!/quest_name|scenario_localkey|speaker_name/.test(raw), `${f}에 본문 칼럼이 있다`);
  }
});

test('지도 배치 — 결정적이고, 관계 있는 떡밥이 겹치지 않고 모두 그림 안에 있다', async () => {
  const { _layoutMap } = await import('../site/tabs/threads.js');
  const W = ['뼈대', '보강', '독립'];
  const list = threads.threads.slice().sort((a, b) => W.indexOf(a.weight) - W.indexOf(b.weight) || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const a = _layoutMap(list, threads.relations);
  const b = _layoutMap(list, threads.relations);
  assert.deepEqual(a.nodes.map((d) => [d.x, d.y]), b.nodes.map((d) => [d.x, d.y]), '같은 입력이면 같은 배치');
  const all = [...a.nodes, ...a.grid];
  assert.equal(all.length, list.length);
  assert.equal(new Set(all.map((d) => d.id)).size, list.length, '떡밥마다 노드 하나');
  for (const d of all) {
    assert.ok(d.x - d.r >= 0 && d.x + d.r <= 330 && d.y - d.r >= 0 && d.y + d.r <= a.height + 1, `${d.id} 그림 밖 (${d.x.toFixed(0)}, ${d.y.toFixed(0)})`);
  }
  for (let i = 0; i < a.nodes.length; i++) {
    for (let j = i + 1; j < a.nodes.length; j++) {
      const p = a.nodes[i];
      const q = a.nodes[j];
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= p.r + q.r, `${p.id} · ${q.id} 겹침`);
    }
  }
  // 핵심 떡밥에는 이름이 붙는다(보조 · 곁가지는 자리가 모자라면 툴팁으로)
  const core = a.nodes.filter((d) => d.weight === '뼈대');
  assert.ok(core.filter((d) => d.labelAt).length >= core.length - 1, '핵심 떡밥 라벨');
});

test('탭 소스 — 본문 칼럼 · innerHTML · 레포 내부 말(화자)이 없다', () => {
  for (const f of ['site/tabs/threads.js', 'tools/site/export/threads.mjs']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/quest_name|scenario_localkey|sheet_rows|FROM\s+lines\b|data\/raw\//.test(src.replace(/\/\*\*[\s\S]*?\*\//g, '')), `${f}: 금지 참조`);
  }
  const tab = fs.readFileSync(path.join(ROOT, 'site/tabs/threads.js'), 'utf8');
  assert.ok(!/innerHTML|insertAdjacentHTML|eval\(/.test(tab), 'innerHTML');
  assert.ok(!/화자/.test(tab), '"화자"라는 말은 쓰지 않는다');
});
