/**
 * C1 — 1회독 시안(read1.mjs)에 2회독 기록(B1a — 암시 언급 I · 떡밥 E · 인물 변화 D · 생활상 U · 1회독 바로잡기)을 얹는다.
 * 다섯 화면(docs/views.md)에 2회독이 무엇을 더했는지와, 2회독 기록이 단위 · 세션마다 얼마나 촘촘한지를 표로 편다.
 * 원문은 읽지 않는다. 시트는 쓰지 않는다.
 *
 * 규칙(모두 기계적이다 — 새 해석을 하지 않는다):
 *   - 기각된 기록은 뺀다. 후보는 넣되 status 칸에 남긴다.
 *   - 떡밥 엣지는 tools/records/read2.mjs read2Edges(암시 → setup_payoff, 재언급 → callback). 단위 엣지는 1회독 사건 엣지와 합쳐
 *     (from, to, 타입)마다 1회독 · 2회독 수를 따로 센다. 같은 단위 안 엣지는 단위 그래프에서 뺀다(1회독과 같다).
 *   - 단위의 2회독 기록 = 그 단위 2회독 파일의 기록. 2회독 파일이 있는 단위를 "읽음"으로 친다.
 *   - 떡밥 기록의 줄기 = 가리킨 J<n>, 그리고 가리킨 의문 · 사실 · 사건이 곧바로 든 줄기(tools/records/threads.mjs — about으로만 든 사실은 뺀다).
 *   - 바로잡기 = 2회독 세션이 1회독 파일에 더한 항목(`session`) + 2회독 세션이 검토 기록을 남긴 1회독 기록(`set … --session M03`).
 *   - 인물 변화의 자리 = 근거 첫 씬의 읽는 자리(출시순 한 줄). 작중 시점 순 정렬은 X1.
 * 같은 기록이면 같은 결과다(정렬 끝까지 결정적).
 */
import { kindOfKey } from '../records/order.mjs';
import { ASPECTS, compareIds, expandLines, isRecord } from '../records/model.mjs';
import { comparePlace, read2Edges, recordPlace, scenePlaces, unknownSpeakerProgress } from '../records/read2.mjs';
import { threadMembership } from '../records/threads.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const firstScene = (c) => arr(c?.evidence)[0]?.scene ?? null;
const inc = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
const isRead2Session = (s) => /^[PM]\d/.test(String(s ?? ''));
const EVENT_ID = /^([FQ]\d+)-\d+$/;

/**
 * @param {object} ds loadDataset() — 1회독 + 2회독
 * @param {object} ctx openContext()
 * @param {object} order loadOrder() — 1회독 순서(출시순 한 줄)
 * @param {object} v1 buildRead1Views(ds, ctx, order)
 */
export function buildRead2Views(ds, ctx, order, v1) {
  const unitRow = new Map(v1.units.map((u) => [u.unit, u]));
  const posOf = (u) => unitRow.get(u)?.order ?? null;
  const places = scenePlaces(order, ctx);
  const targetInfo = new Map(ctx.db.prepare('SELECT id, type, name FROM targets').all().map((t) => [t.id, t]));
  const nameOf = (id) => targetInfo.get(id)?.name ?? String(id ?? '').replace(/^[a-z]+:/, '');

  const live2 = ds.candidates.filter((c) => c.read2 && c.id && c.status !== '기각').sort((a, b) => compareIds(a.id, b.id));
  const of = (kind) => live2.filter((c) => c.kind === kind);
  const mentions = of('mention');
  const echoes = of('echo');
  const changes = of('change');
  const life = of('life');
  // 단위 → 2회독 세션. 파트를 나눠 두 세션에 읽은 단위는 세션을 이어 한 묶음으로 센다(event_staranis1 = M48–M49)
  const sessionsOfUnit = new Map();
  for (const f of ds.files2) if (f.data?.unit) (sessionsOfUnit.get(f.data.unit) ?? sessionsOfUnit.set(f.data.unit, new Set()).get(f.data.unit)).add(f.data.session ?? '');
  const sessionKey = (x) => [x.startsWith('P') ? 0 : 1, Number(x.replace(/\D/g, '')) || 0];
  const bySession = (a, b) => comparePlace(sessionKey(a), sessionKey(b));
  const read2Units = new Map([...sessionsOfUnit].map(([u, ss]) => [u, [...ss].sort(bySession).join('–')]));
  const placeOf = (c) => recordPlace(places, c);
  const sortByPlace = (a, b) => comparePlace(placeOf(a) ?? [1e9], placeOf(b) ?? [1e9]) || compareIds(a.id, b.id);

  // ── 바로잡기 ──
  const rec1 = ds.candidates.filter((c) => c.id && isRecord(c));
  const fixesAdded = rec1.filter((c) => c.fix && c.status !== '기각');
  const fixesReviewed = rec1.filter((c) => !c.fix && arr(c.reviews).some((r) => isRead2Session(r?.session)));
  const fixUnit = new Map();
  for (const c of fixesAdded.concat(fixesReviewed)) inc(fixUnit, c.unit);

  // ── 엣지 ──
  const { edges: sceneEdges, problems } = read2Edges(ds, ctx, order);
  const ue = new Map();
  let internal2 = 0;
  const addUnitEdge = (r, src) => {
    if (!r.from_unit || !r.to_unit) return;
    if (r.from_unit === r.to_unit) {
      if (src === 'read2') internal2++;
      return;
    }
    const k = `${r.from_unit}\t${r.to_unit}\t${r.type}`;
    if (!ue.has(k)) ue.set(k, { from_unit: r.from_unit, to_unit: r.to_unit, type: r.type, read1: 0, read2: 0, records: [] });
    const x = ue.get(k);
    x[src]++;
    if (!x.records.includes(r.record)) x.records.push(r.record);
  };
  for (const r of v1.sceneEdges) addUnitEdge(r, 'read1');
  for (const r of sceneEdges) addUnitEdge(r, 'read2');
  const unitEdges = [...ue.values()].map((x) => ({
    ...x, count: x.read1 + x.read2, from_order: posOf(x.from_unit), to_order: posOf(x.to_unit),
    from_kind: kindOfKey(x.from_unit), to_kind: kindOfKey(x.to_unit), records: x.records.join(' '),
  })).sort((a, b) => (a.from_order ?? 1e9) - (b.from_order ?? 1e9) || (a.to_order ?? 1e9) - (b.to_order ?? 1e9) || a.type.localeCompare(b.type));

  const linked = new Map(); // 단위 → { in: Set, out: Set } (1회독 + 2회독)
  const L = (u) => linked.get(u) ?? linked.set(u, { in: new Set(), out: new Set() }).get(u);
  for (const e of unitEdges) {
    L(e.from_unit).out.add(e.to_unit);
    L(e.to_unit).in.add(e.from_unit);
  }
  const isMain = (u) => kindOfKey(u) === '메인';
  const mainLinks = new Map(); // 메인 밖 단위 → { in, out } 2회독 엣지 수
  for (const r of sceneEdges) {
    if (!r.from_unit || !r.to_unit || isMain(r.from_unit) === isMain(r.to_unit)) continue;
    const [u, dir] = isMain(r.from_unit) ? [r.to_unit, 'in'] : [r.from_unit, 'out'];
    const m = mainLinks.get(u) ?? mainLinks.set(u, { in: 0, out: 0 }).get(u);
    m[dir]++;
  }

  // ── 단위별 ──
  const unknown = unknownSpeakerProgress(ds, ctx);
  const count = new Map(); // 단위 → 칸 → 수
  const C = (u, k) => {
    if (!count.has(u)) count.set(u, new Map());
    inc(count.get(u), k);
  };
  for (const c of mentions) C(c.unit, c.obj?.speaker ? 'speaker' : 'implied');
  for (const c of echoes) C(c.unit, c.act === '암시' ? 'hints' : 'callbacks');
  for (const c of changes) C(c.unit, c.act === '기준' ? 'baselines' : 'changes');
  for (const c of life) C(c.unit, 'life');
  const n = (u, k) => count.get(u)?.get(k) ?? 0;
  const units = v1.units.map((u) => {
    const recs = ['implied', 'speaker', 'hints', 'callbacks', 'baselines', 'changes', 'life'].reduce((a, k) => a + n(u.unit, k), 0);
    const lk = linked.get(u.unit);
    const ml = mainLinks.get(u.unit);
    const unk = unknown.get(u.unit);
    return {
      order: u.order, unit: u.unit, kind: u.kind, layer: u.layer, grade: u.grade,
      read2: read2Units.has(u.unit) ? 1 : 0, session2: read2Units.get(u.unit) ?? '', chars: u.chars,
      implied: n(u.unit, 'implied'), speaker: n(u.unit, 'speaker'), hints: n(u.unit, 'hints'), callbacks: n(u.unit, 'callbacks'),
      baselines: n(u.unit, 'baselines'), changes: n(u.unit, 'changes'), life: n(u.unit, 'life'), fixes: fixUnit.get(u.unit) ?? 0,
      records2: recs, per_10k2: u.chars ? Math.round((recs / u.chars) * 1e5) / 10 : 0, records1: u.records, per_10k1: u.per_10k,
      in1: u.in_units, out1: u.out_units, in_all: lk?.in.size ?? 0, out_all: lk?.out.size ?? 0,
      main_in1: u.main_in, main_out1: u.main_out,
      main_in_all: isMain(u.unit) ? '' : (Number(u.main_in) || 0) + (ml?.in ?? 0), main_out_all: isMain(u.unit) ? '' : (Number(u.main_out) || 0) + (ml?.out ?? 0),
      unknown_lines: unk?.total ?? 0, unknown_done: unk?.done ?? 0,
    };
  });

  // ── 세션별 촘촘함 (P1 · M01 …) ──
  const sessions = new Map();
  for (const u of units.filter((x) => x.read2)) {
    const s = sessions.get(u.session2) ?? sessions.set(u.session2, { session: u.session2, units: 0, chars: 0, records: 0, mentions: 0, echoes: 0, changes: 0, life: 0, guess: 0, fixes: 0 }).get(u.session2);
    s.units++;
    s.chars += u.chars;
    s.records += u.records2;
    s.mentions += u.implied + u.speaker;
    s.echoes += u.hints + u.callbacks;
    s.changes += u.baselines + u.changes;
    s.life += u.life;
    s.fixes += u.fixes;
  }
  for (const c of live2) if (c.confidence === '추정' && sessions.has(read2Units.get(c.unit))) sessions.get(read2Units.get(c.unit)).guess++;
  const sessionRows = [...sessions.values()].sort((a, b) => bySession(a.session, b.session))
    .map((s) => ({ ...s, per_10k: s.chars ? Math.round((s.records / s.chars) * 1e5) / 10 : 0, guess_pct: s.records ? Math.round((s.guess / s.records) * 100) : 0 }));

  // ── 떡밥 줄기 ──
  const tm = threadMembership(ds);
  const threadsOfPoint = (p) => {
    if (/^J\d+$/.test(p)) return tm.byId.has(p) ? [p] : [];
    const m = String(p).match(EVENT_ID);
    const def = m ? m[1] : p;
    if (def.startsWith('Q')) return tm.ofQuestion.has(def) ? [tm.ofQuestion.get(def)] : [];
    return tm.ofFact.get(def) ?? [];
  };
  // about으로만 든 사실을 가리키면 그 줄기에 흐리게 든다(화면 3의 흐린 노드와 같다) — 세기만 한다
  const aboutThreadsOfPoint = (p) => tm.ofFactAbout.get(String(p).match(EVENT_ID)?.[1] ?? p) ?? [];
  const echoThreads = new Map(); // E → [J]
  for (const e of echoes) echoThreads.set(e.id, [...new Set(arr(e.obj?.points).flatMap(threadsOfPoint))].sort(compareIds));
  const live1 = new Map(rec1.filter((c) => c.status !== '기각').map((c) => [c.id, c]));
  const unitOfRec = (c) => places.unitOf(firstScene(c)) ?? c.unit;
  const threadRows = tm.threads.map((t) => {
    const units1 = new Set([...t.questions, ...t.events, ...t.facts].map((id) => live1.get(id)).filter(Boolean).map(unitOfRec));
    const es = echoes.filter((e) => echoThreads.get(e.id).includes(t.id));
    const units2 = new Set(es.map((e) => e.unit));
    const added = [...units2].filter((u) => !units1.has(u)).sort((a, b) => (posOf(a) ?? 1e9) - (posOf(b) ?? 1e9));
    return {
      id: t.id, weight: t.weight ?? '', title: t.title ?? '', hints: es.filter((e) => e.act === '암시').length, callbacks: es.filter((e) => e.act === '재언급').length,
      thread_only: es.filter((e) => arr(e.obj?.points).every((p) => /^J\d+$/.test(p))).length,
      units1: units1.size, units_all: new Set([...units1, ...units2]).size, added_units: added.length, added: added.join(' '),
    };
  });

  // ── 인물 변화 타임라인 ──
  const changeRows = changes.slice().sort((a, b) => String(a.obj?.person).localeCompare(String(b.obj?.person)) || sortByPlace(a, b)).map((c) => {
    const o = c.obj ?? {};
    const trig = arr(o.trigger)[0]?.scene ?? '';
    return {
      id: c.id, person: o.person ?? '', name: nameOf(o.person), aspect: o.aspect ?? '', act: c.act ?? '', with: arr(o.with).join(' '),
      before: o.before ?? '', after: o.after ?? '', text: o.text ?? '', unit: c.unit, order: posOf(c.unit) ?? '', scene: firstScene(c) ?? '',
      trigger_scene: trig, trigger_unit: trig ? places.unitOf(trig) ?? '' : '', time: o.time ?? '', points: arr(o.points).join(' '),
      confidence: c.confidence ?? '', status: c.status ?? '',
    };
  });

  // ── 인물별 ──
  const pp = new Map();
  const P = (id) => pp.get(id) ?? pp.set(id, { baselines: 0, changes: 0, aspects: new Map(), partner: 0, implied: 0, speakerLines: 0, echoes: 0, life: 0, units: new Set(), orders: [] }).get(id);
  const isPerson = (id) => typeof id === 'string' && id.startsWith('person:');
  for (const c of changes) {
    const o = c.obj ?? {};
    if (!isPerson(o.person)) continue;
    const r = P(o.person);
    r[c.act === '기준' ? 'baselines' : 'changes']++;
    inc(r.aspects, o.aspect ?? '?');
    r.units.add(c.unit);
    if (posOf(c.unit) != null) r.orders.push(posOf(c.unit));
    for (const w of arr(o.with)) if (isPerson(w)) P(w).partner++;
  }
  for (const c of mentions) {
    const t = c.obj?.target;
    if (!isPerson(t)) continue;
    P(t).implied++;
    if (c.obj?.speaker) for (const ev of arr(c.evidence)) P(t).speakerLines += expandLines(ev?.lines).seqs.length;
  }
  for (const c of echoes) for (const t of new Set(arr(c.obj?.about))) if (isPerson(t)) P(t).echoes++;
  for (const c of life) for (const t of new Set(arr(c.obj?.about))) if (isPerson(t)) P(t).life++;
  const t1 = new Map(v1.targets.map((t) => [t.target, t]));
  const persons = [...pp].map(([id, r]) => ({
    target: id, name: nameOf(id), baselines: r.baselines, changes: r.changes,
    aspects: ASPECTS.filter((a) => r.aspects.has(a)).map((a) => `${a} ${r.aspects.get(a)}`).join(' · '),
    partner: r.partner, implied: r.implied, speaker_lines: r.speakerLines, echoes_about: r.echoes, life_about: r.life,
    change_units: r.units.size, first_order: r.orders.length ? Math.min(...r.orders) : '', last_order: r.orders.length ? Math.max(...r.orders) : '',
    facts1: t1.get(id)?.facts ?? 0, questions1: t1.get(id)?.questions ?? 0,
  })).sort((a, b) => b.baselines + b.changes - (a.baselines + a.changes) || b.implied - a.implied || a.target.localeCompare(b.target));

  // ── 생활상 ──
  const lifeRows = life.slice().sort(sortByPlace).map((c) => ({
    id: c.id, topic: c.obj?.topic ?? '', unit: c.unit, order: posOf(c.unit) ?? '', scene: firstScene(c) ?? '', about: arr(c.obj?.about).join(' '),
    points: arr(c.obj?.points).join(' '), text: c.obj?.text ?? '', confidence: c.confidence ?? '', status: c.status ?? '',
  }));

  // ── 빈 곳을 재는 수 ──
  const qState = new Map(v1.questions.map((q) => [q.id, q.state]));
  const openHints = echoes.filter((e) => e.act === '암시' && arr(e.obj?.points).some((p) => /^Q\d+$/.test(p) && qState.get(p) === '열림'));
  const noThread = echoes.filter((e) => !echoThreads.get(e.id).length);
  const noEdge = echoes.filter((e) => !sceneEdges.some((r) => r.record === e.id));
  const gaps = {
    openHints: openHints.length, noThread: noThread.length,
    noThreadEvenAbout: noThread.filter((e) => !arr(e.obj?.points).some((p) => aboutThreadsOfPoint(p).length)).length, noEdge: noEdge.length, internal2,
    changesWithoutTime: changes.filter((c) => c.act === '변화' && !c.obj?.time).length,
    changesWithoutBaseline: [...new Set(changes.filter((c) => c.act === '변화').map((c) => `${c.obj?.person}\t${c.obj?.aspect}`))]
      .filter((k) => !changes.some((c) => c.act === '기준' && `${c.obj?.person}\t${c.obj?.aspect}` === k)).length,
    personsChanged: persons.filter((p) => p.baselines + p.changes).length,
  };

  return {
    units, sceneEdges, unitEdges, sessions: sessionRows, threads: threadRows, changes: changeRows, persons, life: lifeRows, gaps, problems,
    totals: {
      mentions: mentions.length, speaker: mentions.filter((c) => c.obj?.speaker).length, echoes: echoes.length,
      hints: echoes.filter((c) => c.act === '암시').length, callbacks: echoes.filter((c) => c.act === '재언급').length,
      changes: changes.length, baselines: changes.filter((c) => c.act === '기준').length, life: life.length,
      guess: live2.filter((c) => c.confidence === '추정').length, unconfirmed: live2.filter((c) => c.status !== '확정').length,
      rejected: ds.candidates.filter((c) => c.read2 && c.status === '기각').length,
      fixesAdded: fixesAdded.length, fixesReviewed: fixesReviewed.length, read2Units: read2Units.size,
    },
  };
}

