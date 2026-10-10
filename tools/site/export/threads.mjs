/**
 * 탭 "떡밥" 데이터(W4) — 화면 3(줄기 하나의 흐름) · 화면 4(줄기 · 개념 지도). 공용 threads.json(줄기 60 · 관계 44)은 그대로 쓰고,
 * 이 모듈은 두 파일을 더 낸다. 규칙은 docs/views.md "3. 떡밥 하나가 풀려 온 흐름" · "4. 개념 · 떡밥끼리의 관계" · "공개 축".
 *
 *   threads-flow.json   { <줄기 ID>: { roots[], echoes[], units[] } } — 줄기마다 곧바로 든 의문(Q) · 사실(F)의 단계 줄(data/views/timeline/reveals.csv)
 *     roots[]   id · kind(Q · F) · text · unit · tick · order · about(기록의 대상 — 떡밥 묶음 거르기 W15d, fmt.threadRoots) · state(끝 상태) · first_tick · hint_tick · partial_tick · solved_tick · reversed_tick · replaced_by · hints · units
 *               · know_units · hint_units · partial_units · solved_units · reversed_units(단계별 단위 — 공용 records.json과 같은 칸, 있을 때만. 화면이 fmt.stateAt(뿌리, R)로 단위마다 본다)
 *               points[]: r(기록 ID) · s(단계: 제기 · 암시 · 재언급 · 일부 회수 · 회수 · 처음 밝혀짐 · 보강 · 뒤집힘) · u(단위) · t(공개 자리) · o(읽는 자리) · sc(씬) · ln(줄)
 *                         · rel(뿌리 첫 자리와 견줘 앞 · 뒤 — 동시는 칸 없음) · a(답 사실 · 바꾼 사실) · c('추정'일 때만) · bu(빌드업 마무리: 긴 회수 · 복선의 답) · from(쌓은 쪽)
 *     echoes[]  줄기(J)만 가리키는 2회독 떡밥 E — r · s · u · t · o · sc · ln · about (뿌리 줄이 없어 reveals에 없는 것)
 *     units[]   이 줄기의 단계가 놓인 단위 키(흐름의 열)
 *   threads-map.json    { concepts[], edges[], pairs[], relations{}, closures[], merges[], chrono{} }
 *     concepts[]  줄기와 이어진 비인물 대상(links/thread-targets.csv) — id · type · name · threads(걸친 줄기 수) · records
 *     edges[]     줄기 ↔ 개념 — j · target · records · own(줄기 자신의 about) · sample[](기록 ID) · tick(근거 기록의 가장 앞 공개 자리)
 *                 · units[](근거 기록을 알게 되는 단위 — 사실 · 의문은 know_units, 그 밖은 unit. 공개 자리순, 하나라도 봤으면 보인다)
 *     pairs[]     개념 ↔ 개념(links/target-pairs.csv) — a · b · records · units
 *     relations   { <G ID>: { tick, units[] } } — 줄기 ↔ 줄기 관계의 근거 기록 가장 앞 자리 · 근거를 알게 되는 단위(edges와 같은 규칙, 컷오프용)
 *     closures[]  연작 · 갈등의 결말 O(closures/closures.csv) — id · type · end · end_tick · built[] · closing[] · about[] · merge · text · threads[](붙는 줄기) · how
 *     merges[]    합류 H(closures/merges.csv) — id · title · end · end_tick · members[] · types[] · persons[] · text · threads[]
 *     chrono{}    흐름 · 결말에 든 스토리의 작중 순서(timeline/chrono-order.csv의 '지금' 줄) — <단위 키>: { seq(작중 순서, 상대 · 불명은 칸 없음) · class(판별 · 범위 · 상대 · 불명) · drift(출시순과 비교) }
 *
 * 결말 · 합류를 줄기에 붙이는 규칙(Claude, W4 — 마무리 기록에는 줄기 칸이 없다):
 *   (가) 인물 · 단위: 결말의 인물(about)이 줄기의 주역 · about과 겹치고, 끝 · 쌓인 단위 가운데 하나가 줄기의 단위에 든다.
 *   (나) 단위만: 인물이 없는 연작은 끝 단위와 쌓인 단위 하나 이상이 모두 줄기의 단위에 들 때.
 *   합류 H는 멤버 결말이 붙은 줄기 + (끝 단위가 줄기에 들고 인물이 겹치는 줄기). how 칸에 (가) · (나)를 남긴다.
 * 대사 본문 · DB lines · 외부 참고 표는 읽지 않는다 — data/views CSV · 공용 데이터 · 기록 문장(publishText로 인용 검사)만.
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 */
import { compact, firstRef, list, num, publishText } from '../lib.mjs';

export const name = 'threads';

const STAGES = ['제기', '암시', '재언급', '일부 회수', '회수', '처음 밝혀짐', '보강', '뒤집힘'];

export async function run(ctx) {
  const { csv, warn, common } = ctx;
  const text = (v, where) => publishText(v, where, warn);
  const recById = new Map(common.records.map((r) => [r.id, r]));
  const tickOfRec = (id) => recById.get(id)?.tick ?? null;
  const minTick = (ids) => {
    const ts = ids.map(tickOfRec).filter((t) => t != null);
    return ts.length ? Math.min(...ts) : null;
  };
  /** 근거 기록들을 알게 되는 단위(사실 · 의문은 know_units — 없으면 [unit], 그 밖은 unit) — 공개 자리순. 화면은 R.seenAny로 본다 */
  const knowUnits = (ids) => {
    const us = new Set();
    for (const id of ids) {
      const r = recById.get(id);
      if (!r) continue;
      for (const u of (r.kind === 'F' || r.kind === 'Q') && r.know_units ? r.know_units : r.unit ? [r.unit] : []) us.add(u);
    }
    const out = [...us].sort((a, b) => (common.placeOf.get(a)?.order ?? 1e9) - (common.placeOf.get(b)?.order ?? 1e9));
    return out.length ? out : undefined;
  };
  const STAGE_UNITS = ['know_units', 'hint_units', 'partial_units', 'solved_units', 'reversed_units'];
  const targetById = new Map(common.targets.map((t) => [t.id, t]));

  // ── 흐름: 줄기별 뿌리 · 단계 줄 ──
  const roots = new Map(csv('data/views/timeline/records.csv').map((r) => [r.id, r]));
  const reveals = csv('data/views/timeline/reveals.csv').filter((r) => r.status === '확정');
  const byRoot = new Map();
  for (const r of reveals) {
    if (!STAGES.includes(r.stage)) { warn({ where: `threads ${r.root}`, msg: `모르는 단계 ${r.stage}` }); continue; }
    (byRoot.get(r.root) ?? byRoot.set(r.root, []).get(r.root)).push(r);
  }
  const buildup = csv('data/views/closures/buildup.csv');
  const buildupOf = new Map();
  for (const b of buildup) (buildupOf.get(b.root) ?? buildupOf.set(b.root, []).get(b.root)).push(b);

  const pointOut = (r) => {
    const rec = recById.get(r.record);
    const p = compact({
      r: r.record, s: r.stage, u: r.unit, t: num(r.tick), o: num(r.order), sc: r.scene || rec?.scene, ln: rec?.line,
      rel: r.rel === '동시' ? undefined : r.rel || undefined, a: r.answer || undefined, c: r.confidence === '추정' ? '추정' : undefined,
    });
    return p;
  };
  const rootOut = (id) => {
    const row = roots.get(id);
    const rec = recById.get(id);
    if (!row || !rec) { warn({ where: `threads ${id}`, msg: '뿌리 기록이 timeline/records.csv 또는 공용 기록에 없다' }); return null; }
    const points = (byRoot.get(id) ?? []).map(pointOut);
    for (const b of buildupOf.get(id) ?? []) {
      const hit = points.find((p) => (b.record ? p.r === b.record : p.s === '처음 밝혀짐' && p.u === b.unit));
      if (!hit) { warn({ where: `threads ${id}`, msg: `빌드업 마무리 ${b.type}@${b.unit}에 맞는 단계 줄이 없다` }); continue; }
      hit.bu = b.type;
      const from = b.from || b.hints;
      if (from) hit.from = from;
      if (b.gap) hit.gap = num(b.gap);
    }
    points.sort((a, b) => (a.o ?? 1e9) - (b.o ?? 1e9) || String(a.sc).localeCompare(String(b.sc)) || (a.ln ?? 0) - (b.ln ?? 0));
    return compact({
      id, kind: row.kind === '의문' ? 'Q' : 'F', text: text(row.text, `${id} text`), unit: rec.unit, tick: rec.tick, order: rec.order, about: rec.about?.length ? rec.about : undefined,
      state: row.state || undefined, first_tick: num(row.first_tick), hint_tick: num(row.hint_tick), partial_tick: num(row.partial_tick),
      solved_tick: num(row.solved_tick), reversed_tick: num(row.reversed_tick), replaced_by: row.replaced_by || undefined,
      hints: num(row.hints) || undefined, units: num(row.units) || undefined,
      ...Object.fromEntries(STAGE_UNITS.filter((k) => rec[k]?.length).map((k) => [k, rec[k]])), points,
    });
  };

  // 줄기(J)만 가리키는 2회독 떡밥 — 뿌리 줄이 없어 reveals에 빠진 것
  const echoesOf = new Map();
  for (const c of ctx.records.confirmed) {
    if (c.kind !== 'echo' || !Array.isArray(c.obj?.points)) continue;
    const js = c.obj.points.filter((p) => /^J\d+$/.test(String(p)));
    if (!js.length || js.length !== c.obj.points.length) continue;
    const place = common.placeOf.get(c.unit) ?? {};
    const { scene, line } = firstRef(c.evidence);
    const about = recById.get(c.id)?.about;
    for (const j of js) (echoesOf.get(j) ?? echoesOf.set(j, []).get(j)).push(compact({ r: c.id, s: c.act, u: c.unit, t: place.tick, o: place.order, sc: scene, ln: line, about: about?.length ? about : undefined }));
  }

  const flow = {};
  const threadUnits = new Map();
  const threadPersons = new Map();
  for (const th of common.threads) {
    const ids = [...(th.questions ?? []), ...(th.facts ?? [])];
    const rootsOut = ids.map(rootOut).filter(Boolean);
    const echoes = echoesOf.get(th.id) ?? [];
    const unitSet = new Set([...rootsOut.flatMap((r) => r.points.map((p) => p.u)), ...echoes.map((e) => e.u)].filter(Boolean));
    const units = [...unitSet].sort((a, b) => (common.placeOf.get(a)?.order ?? 1e9) - (common.placeOf.get(b)?.order ?? 1e9));
    threadUnits.set(th.id, unitSet);
    threadPersons.set(th.id, new Set([...(th.owners ?? []), ...(th.about ?? [])].filter((a) => String(a).startsWith('person:'))));
    flow[th.id] = compact({ roots: rootsOut, echoes, units });
  }

  // ── 지도: 줄기 ↔ 개념 · 개념 ↔ 개념 · 관계 자리 ──
  const tt = csv('data/views/links/thread-targets.csv');
  const conceptAgg = new Map();
  const edges = tt.map((r) => {
    const sample = list(r.sample);
    const agg = conceptAgg.get(r.target) ?? conceptAgg.set(r.target, { id: r.target, type: r.type, threads: 0, records: 0 }).get(r.target);
    agg.threads += 1;
    agg.records += num(r.records) ?? 0;
    return compact({ j: r.thread, target: r.target, records: num(r.records), own: r.thread_about === '줄기' ? true : undefined, sample, tick: minTick(sample), units: knowUnits(sample) });
  });
  const concepts = [...conceptAgg.values()].map((c) => {
    const t = targetById.get(c.id);
    if (!t) warn({ where: `threads ${c.id}`, msg: '사전에 없는 대상' });
    return compact({ ...c, name: t?.name ?? c.id.split(':').pop().replace(/_/g, ' ') });
  }).sort((a, b) => b.threads - a.threads || b.records - a.records || a.id.localeCompare(b.id));
  const conceptIds = new Set(concepts.map((c) => c.id));
  const pairs = csv('data/views/links/target-pairs.csv')
    .filter((p) => conceptIds.has(p.a) && conceptIds.has(p.b))
    .map((p) => compact({ a: p.a, b: p.b, records: num(p.records), units: num(p.units) }));
  const relations = Object.fromEntries(common.relations.map((g) => [g.id, compact({ tick: minTick(g.basis ?? []), units: knowUnits(g.basis ?? []) })]));

  // ── 결말 · 합류 → 줄기에 붙인다 ──
  const attach = (unitsOfC, persons, { needBuilt = false, end = null, built = [] } = {}) => {
    const out = [];
    for (const th of common.threads) {
      const tu = threadUnits.get(th.id);
      const tp = threadPersons.get(th.id);
      const unitHit = unitsOfC.some((u) => tu.has(u));
      const personHit = persons.some((p) => tp.has(p));
      if (persons.length && unitHit && personHit) out.push([th.id, '인물·단위']);
      else if (!persons.length && needBuilt && end && tu.has(end) && built.some((u) => tu.has(u))) out.push([th.id, '단위']);
    }
    return out;
  };
  const closureRows = csv('data/views/closures/closures.csv').filter((c) => c.status === '확정' && (c.type === '연작' || c.type === '갈등'));
  const closures = closureRows.map((c) => {
    const built = list(c.built_units);
    const about = list(c.about);
    const hits = attach([c.end, ...built], about.filter((a) => a.startsWith('person:')), { needBuilt: true, end: c.end, built });
    return compact({
      id: c.id, type: c.type, end: c.end, end_tick: num(c.end_tick), built, closing: list(c.closing), about, merge: c.merge || undefined,
      text: text(c.text, `${c.id} text`), threads: hits.map(([j]) => j), how: hits.length ? [...new Set(hits.map(([, h]) => h))].join(' · ') : undefined,
    });
  });
  const closureThreads = new Map(closures.map((c) => [c.id, c.threads ?? []]));
  const merges = csv('data/views/closures/merges.csv').filter((m) => m.status === '확정').map((m) => {
    const members = list(m.members);
    const persons = list(m.persons);
    const js = new Set(members.flatMap((o) => closureThreads.get(o) ?? []));
    for (const [j] of attach([m.end], persons)) js.add(j);
    return compact({ id: m.id, title: m.title, end: m.end, end_tick: num(m.end_tick), members, types: list(m.types), persons, text: text(m.text, `${m.id} text`), threads: [...js] });
  });

  // ── 작중 순서: 흐름 · 결말에 든 스토리만 ──
  const used = new Set([...Object.values(flow).flatMap((f) => f.units ?? []), ...closures.flatMap((c) => [c.end, ...c.built]), ...merges.map((m) => m.end)].filter(Boolean));
  const chrono = {};
  for (const r of csv('data/views/timeline/chrono-order.csv')) {
    if (r.type !== '지금' || !used.has(r.unit)) continue;
    chrono[r.unit] = compact({ seq: num(r.seq), class: r.class || undefined, drift: r.drift || undefined });
  }
  return { files: { 'threads-flow.json': flow, 'threads-map.json': { concepts, edges, pairs, relations, closures, merges, chrono } } };
}
