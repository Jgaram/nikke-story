/**
 * B0a — 1회독 기록만으로 뽑는 시각화 시안. 다섯 화면(docs/views.md) 가운데 1회독 기록에서 바로 나오는 칸을 표로 편다.
 * 원문은 읽지 않는다(글자 수만 DB에서 센다). 시트는 쓰지 않는다(docs/reference-table.md).
 *
 * 규칙(모두 기계적이다 — 새 해석을 하지 않는다):
 *   - 기각된 기록은 뺀다. 후보는 넣되 status 칸에 남긴다(확정값처럼 쓰지 않는다 — X2가 따로 표시한다).
 *   - 엣지는 사건 하나에 하나: 의문 회수 Q<n>-k → setup_payoff, 사실 다시 드러냄 F<n>-k → callback, 사실 뒤집음 → reversal.
 *     끝점은 근거의 첫 씬 — from = 정의(Q<n> · F<n>)의 첫 씬, to = 사건의 첫 씬(B1 형식 메모, R99).
 *   - 씬의 단위 = 그 씬을 읽은 읽기 단위(docs/history/reading.md R 항목의 키). 파트를 나눠 읽은 단위는 하나로 합친다.
 *   - 읽는 순서 = R 항목 순서(출시순 한 줄). 단위의 자리는 그 단위가 처음 나온 자리(1부터).
 *   - 단위 → 단위 엣지는 (from, to, 타입)마다 사건 수를 센다. 같은 단위 안의 사건은 단위 그래프에서 빼고 따로 센다.
 *   - 의문 상태: 회수 중 `전부`가 있으면 풀림, 회수가 있으면 일부, 없으면 열림(인계 파일과 같다).
 *   - 메인과 이어진 기록(메인 밖 단위만): in = 메인에서 던진 의문 · 드러난 사실이 이 단위에서 회수 · 다시 드러남 · 뒤집힘,
 *     out = 이 단위의 의문 · 사실이 메인에서 회수 · 다시 드러남 · 뒤집힘. 메인은 중요도를 매기지 않아 비운다(사용자, 2026-10-04).
 *   - 대상별 수: 사실 · 의문 정의의 about. 사건(회수 · 드러냄 · 뒤집음)은 about이 없어 부모 정의의 about을 물려받는다.
 *     대상 목록은 about · 새 대상(targets) · 정체 연결(확정 · 후보)에 나온 것.
 * 같은 기록이면 같은 결과다(정렬 끝까지 결정적).
 */
import { kindOfKey } from '../records/order.mjs';
import { compareIds, isRecord } from '../records/model.mjs';
import { computeLayers } from '../records/layers.mjs';
import { threadMembership } from '../records/threads.mjs';

export const EDGE_OF_ACT = { 회수: 'setup_payoff', 드러냄: 'callback', 뒤집음: 'reversal' };
/** 드문 대상 — about으로 다룬 단위가 이 수 이하인 대상(빈 곳 재기에만 쓴다) */
export const RARE_TARGET_UNITS = 10;

const arr = (x) => (Array.isArray(x) ? x : []);
const firstScene = (c) => arr(c?.evidence)[0]?.scene ?? null;
const aboutOf = (c) => arr(c?.obj?.about).filter((x) => typeof x === 'string');
const inc = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

/**
 * @param {object} ds loadDataset()
 * @param {object} ctx openContext()
 * @param {object} order loadOrder()
 */
export function buildRead1Views(ds, ctx, order) {
  // ── 단위 · 씬 ──
  const unitPos = new Map(); // 단위 키 → { order, session }
  const sceneUnit = new Map(); // 씬 → 읽기 단위 키
  for (const it of order.items) {
    if (!unitPos.has(it.key)) unitPos.set(it.key, { order: unitPos.size + 1, session: it.session });
    for (const s of ctx.resolve(it.key)?.scenes ?? []) if (!sceneUnit.has(s)) sceneUnit.set(s, it.key);
  }
  const unitOf = (scene) => (scene ? sceneUnit.get(scene) ?? ctx.unitOfScene(scene)?.key ?? null : null);
  const posOf = (unit) => unitPos.get(unit)?.order ?? null;

  const charsByScene = new Map(
    ctx.db.prepare('SELECT s.id id, SUM(LENGTH(l.text)) n FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 GROUP BY s.id')
      .all().map((r) => [r.id, r.n ?? 0]),
  );
  const charsOf = (unit) => (ctx.resolve(unit)?.scenes ?? []).reduce((a, s) => a + (charsByScene.get(s) ?? 0), 0);
  const targetInfo = new Map(ctx.db.prepare('SELECT id, type, name FROM targets').all().map((t) => [t.id, t]));

  // ── 기록 ──
  const live = ds.candidates.filter((c) => c.status !== '기각' && isRecord(c));
  const byId = new Map(live.map((c) => [c.id, c]));
  const facts = live.filter((c) => c.kind === 'fact' && c.role === 'def');
  const questions = live.filter((c) => c.kind === 'question' && c.role === 'def');
  const events = live.filter((c) => c.role === 'event').sort((a, b) => compareIds(a.id, b.id));
  const times = live.filter((c) => c.kind === 'time');
  const eventsOf = new Map();
  for (const e of events) {
    if (!eventsOf.has(e.parent)) eventsOf.set(e.parent, []);
    eventsOf.get(e.parent).push(e);
  }
  const recUnit = (c) => unitOf(firstScene(c)) ?? c.unit;
  const qState = (q) => {
    const ans = (eventsOf.get(q.id) ?? []).filter((e) => e.act === '회수');
    return ans.some((e) => e.obj?.degree === '전부') ? '풀림' : ans.length ? '일부' : '열림';
  };

  // ── 씬 → 씬 엣지 ──
  const { sceneEdges, problems } = read1Edges(ds, unitOf, posOf);

  // ── 단위 → 단위 엣지 ──
  const ueMap = new Map();
  let internal = 0;
  for (const r of sceneEdges) {
    if (r.from_unit === r.to_unit) {
      internal++;
      continue;
    }
    const k = `${r.from_unit}\t${r.to_unit}\t${r.type}`;
    if (!ueMap.has(k)) ueMap.set(k, { from_unit: r.from_unit, to_unit: r.to_unit, type: r.type, count: 0, records: [], unconfirmed: 0 });
    const x = ueMap.get(k);
    x.count++;
    x.records.push(r.record);
    if (r.status !== '확정') x.unconfirmed++;
  }
  const unitEdges = [...ueMap.values()].map((x) => ({
    ...x, from_order: posOf(x.from_unit), to_order: posOf(x.to_unit), from_kind: kindOfKey(x.from_unit), to_kind: kindOfKey(x.to_unit),
    records: x.records.join(' '),
  })).sort((a, b) => (a.from_order ?? 1e9) - (b.from_order ?? 1e9) || (a.to_order ?? 1e9) - (b.to_order ?? 1e9) || a.type.localeCompare(b.type));

  // ── 단위별 ──
  const per = new Map([...unitPos.keys()].map((k) => [k, {
    facts: 0, questions: 0, reveals: 0, reversals: 0, payoffs: 0, times: 0, new_targets: 0,
    asked_open: 0, asked_partial: 0, asked_solved: 0, out_units: new Set(), in_units: new Set(), slips: 0, unconfirmed: 0,
  }]));
  const rowOf = (unit) => per.get(unit) ?? null;
  const strayUnits = new Set();
  const bump = (unit, field) => {
    const r = rowOf(unit);
    if (r) r[field]++;
    else strayUnits.add(unit);
  };
  for (const f of facts) bump(recUnit(f), 'facts');
  for (const q of questions) {
    bump(recUnit(q), 'questions');
    const s = qState(q);
    bump(recUnit(q), s === '풀림' ? 'asked_solved' : s === '일부' ? 'asked_partial' : 'asked_open');
  }
  for (const e of events) bump(recUnit(e), e.act === '회수' ? 'payoffs' : e.act === '뒤집음' ? 'reversals' : 'reveals');
  for (const t of times) bump(recUnit(t), 'times');
  for (const c of live) if (c.status !== '확정' && rowOf(recUnit(c))) rowOf(recUnit(c)).unconfirmed++;
  for (const t of ds.targets) if (rowOf(t.unit)) rowOf(t.unit).new_targets++;
  for (const f of ds.files) if (rowOf(f.data?.unit)) rowOf(f.data.unit).slips += arr(f.data.slips).length;
  for (const r of unitEdges) {
    rowOf(r.from_unit)?.out_units.add(r.to_unit);
    rowOf(r.to_unit)?.in_units.add(r.from_unit);
  }
  // 메인과 이어진 기록 — 메인 밖 단위의 중요도 판정 입력(docs/views.md 화면 1). 메인 단위는 채점하지 않아 비워 둔다
  const isMain = (u) => kindOfKey(u) === '메인';
  const mainLinks = new Map();
  for (const r of sceneEdges) {
    if (isMain(r.from_unit) === isMain(r.to_unit)) continue;
    const [unit, dir] = isMain(r.from_unit) ? [r.to_unit, 'in'] : [r.from_unit, 'out'];
    if (!mainLinks.has(unit)) mainLinks.set(unit, []);
    mainLinks.get(unit).push({ dir, record: r.record, type: r.type, degree: r.degree, main: dir === 'in' ? r.from_unit : r.to_unit });
  }
  const mainCols = (unit) => {
    if (isMain(unit)) return { main_in: '', main_out: '', main_records: '' };
    const ls = mainLinks.get(unit) ?? [];
    return {
      main_in: ls.filter((l) => l.dir === 'in').length, main_out: ls.filter((l) => l.dir === 'out').length,
      main_records: ls.map((l) => `${l.dir}:${l.record}${l.degree ? `(${l.degree})` : ''}@${l.main}`).join(' '),
    };
  };
  // 떡밥 줄기(B0b) — 단위의 줄기 = 그 단위의 기록(의문 정의 · 사건 · 곧바로 든 사실 정의)이 든 줄기. 소속은 tools/records/threads.mjs
  const tm = threadMembership(ds);
  const WEIGHT_RANK = { 뼈대: 0, 보강: 1, 독립: 2 };
  const unitThreads = new Map(); // 단위 → Map(줄기 → { q, e, f })
  const touch = (c, j, k) => {
    const u = c ? recUnit(c) : null;
    if (!u) return;
    if (!unitThreads.has(u)) unitThreads.set(u, new Map());
    const m = unitThreads.get(u);
    if (!m.has(j)) m.set(j, { q: 0, e: 0, f: 0 });
    m.get(j)[k]++;
  };
  for (const t of tm.threads) {
    for (const q of t.questions) touch(byId.get(q), t.id, 'q');
    for (const e of t.events) touch(byId.get(e), t.id, 'e');
    for (const f of t.facts) touch(byId.get(f), t.id, 'f');
  }
  const threadCols = (unit) => {
    const m = unitThreads.get(unit);
    if (!m) return { threads: '', thread_weight: '' };
    const ids = [...m.keys()].sort(compareIds);
    const weights = ids.map((j) => tm.byId.get(j).weight).filter((w) => w in WEIGHT_RANK).sort((a, b) => WEIGHT_RANK[a] - WEIGHT_RANK[b]);
    return {
      threads: ids.map((j) => `${j}:${['q', 'e', 'f'].filter((k) => m.get(j)[k]).map((k) => `${k}${m.get(j)[k]}`).join('')}`).join(' '),
      thread_weight: weights[0] ?? '',
    };
  };
  // 2회독 층(B0b-2) — 판정 파일(annotations/layers.json)의 등급 · 근거와 계산한 층. 판정이 없으면 비운다
  const lay = computeLayers(ds, order);
  const layerCols = (unit) => {
    const l = lay.byUnit.get(unit);
    return { grade: l?.grade ?? '', layer: l?.layer ?? '', layer_basis: l?.basis ?? '', layer_status: l?.judgment ? l.status ?? '' : '',
      layer_id: l?.judgment?.id ?? '', layer_reason: l?.judgment?.reason ?? '', layer_over: l?.judgment?.obj?.layer ? l.ruleLayer : '' };
  };
  const units = [...per].map(([unit, r]) => {
    const chars = charsOf(unit);
    const records = r.facts + r.questions + r.reveals + r.reversals + r.payoffs;
    return {
      order: posOf(unit), unit, session: unitPos.get(unit).session, kind: kindOfKey(unit), title: ctx.resolve(unit)?.title ?? unit, chars,
      facts: r.facts, questions: r.questions, reveals: r.reveals, reversals: r.reversals, payoffs: r.payoffs, times: r.times,
      new_targets: r.new_targets, asked_open: r.asked_open, asked_partial: r.asked_partial, asked_solved: r.asked_solved,
      in_units: r.in_units.size, out_units: r.out_units.size, records, per_10k: chars ? Math.round((records / chars) * 1e5) / 10 : 0,
      slips: r.slips, unconfirmed: r.unconfirmed,
      ...mainCols(unit), ...threadCols(unit), ...layerCols(unit),
    };
  });
  const relationCount = new Map();
  for (const c of ds.candidates) {
    if (c.kind !== 'relation' || c.status === '기각') continue;
    for (const j of new Set([c.obj?.a, c.obj?.b])) inc(relationCount, j);
  }
  const threadRows = tm.threads.map((t) => {
    const us = [...unitThreads].filter(([, m]) => m.has(t.id)).map(([u]) => u).sort((a, b) => (posOf(a) ?? 1e9) - (posOf(b) ?? 1e9));
    const states = t.questions.map((q) => qState(byId.get(q)));
    return {
      id: t.id, weight: t.weight ?? '', status: t.c.status ?? '', title: t.title ?? '', questions: t.questions.length,
      open: states.filter((x) => x === '열림').length, partial: states.filter((x) => x === '일부').length, solved: states.filter((x) => x === '풀림').length,
      events: t.events.length, facts: t.facts.length, about_facts: t.aboutFacts.length, units: us.length, main_units: us.filter(isMain).length,
      first_unit: us[0] ?? '', first_order: us.length ? posOf(us[0]) : '', last_unit: us.at(-1) ?? '', last_order: us.length ? posOf(us.at(-1)) : '',
      relations: relationCount.get(t.id) ?? 0, text: t.c.obj?.text ?? '',
    };
  });

  // ── 의문별 (떡밥 흐름 시안) ──
  const questionRows = questions.map((q) => {
    const unit = recUnit(q);
    const pay = (eventsOf.get(q.id) ?? []).filter((e) => e.act === '회수');
    const payUnits = [...new Set(pay.map(recUnit))];
    const last = Math.max(...payUnits.map(posOf).filter((x) => x != null), -Infinity);
    return {
      id: q.id, unit, order: posOf(unit), scene: firstScene(q), state: qState(q), payoffs: pay.map((e) => `${e.id}:${e.obj?.degree ?? ''}`).join(' '),
      payoff_units: payUnits.join(' '), answers: [...new Set(pay.map((e) => e.obj?.answer).filter(Boolean))].join(' '),
      span: Number.isFinite(last) && posOf(unit) != null ? last - posOf(unit) : '', about: aboutOf(q).join(' '), status: q.status ?? '', text: q.text ?? '',
    };
  }).sort((a, b) => compareIds(a.id, b.id));

  // ── 대상별 (인물별 집계 · 개념 시안) ──
  const tg = new Map();
  const T = (id) => {
    if (!tg.has(id)) tg.set(id, { facts: 0, questions: 0, open: 0, events: 0, units: new Set(), introduced: [], links: 0 });
    return tg.get(id);
  };
  for (const f of facts) for (const t of new Set(aboutOf(f))) {
    T(t).facts++;
    T(t).units.add(recUnit(f));
  }
  for (const q of questions) for (const t of new Set(aboutOf(q))) {
    T(t).questions++;
    if (qState(q) === '열림') T(t).open++;
    T(t).units.add(recUnit(q));
  }
  for (const e of events) for (const t of new Set(aboutOf(byId.get(e.parent)))) {
    T(t).events++;
    T(t).units.add(recUnit(e));
  }
  for (const t of ds.targets) if (t.obj?.target) T(t.obj.target).introduced.push(t.unit);
  for (const c of ds.candidates) {
    if (c.kind !== 'link' || c.status === '기각') continue;
    for (const side of [c.obj?.a, c.obj?.b]) if (typeof side === 'string' && /^[a-z]+:/.test(side) && !side.startsWith('이름표:')) T(side).links++;
  }
  const targets = [...tg].map(([id, r]) => {
    const us = [...r.units].filter(Boolean).sort((a, b) => (posOf(a) ?? 1e9) - (posOf(b) ?? 1e9));
    const info = targetInfo.get(id);
    return {
      target: id, type: info?.type ?? id.split(':')[0], name: info?.name ?? id.replace(/^[a-z]+:/, ''),
      facts: r.facts, questions: r.questions, open_questions: r.open, events: r.events, units: us.length,
      first_unit: us[0] ?? '', first_order: us.length ? posOf(us[0]) : '', last_unit: us.at(-1) ?? '', last_order: us.length ? posOf(us.at(-1)) : '',
      introduced_in: r.introduced.join(' '), links: r.links,
    };
  }).sort((a, b) => b.facts + b.questions - (a.facts + a.questions) || a.target.localeCompare(b.target));

  // ── 설정 오류 추정 (slips) — 엣지가 아니다. 단위 메모로 남긴다 ──
  const slips = ds.files.flatMap((f) => arr(f.data?.slips).map((text) => ({ unit: f.data.unit, order: posOf(f.data.unit), text })))
    .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));

  // ── 빈 곳을 재는 수 ──
  const unitsInFile = new Set(ds.files.map((f) => f.data?.unit).filter(Boolean));
  const crossEvidence = facts.concat(questions).filter((c) => new Set(arr(c.evidence).map((e) => unitOf(e.scene))).size > 1);
  const answerElsewhere = events.filter((e) => e.act === '회수' && byId.get(e.obj?.answer) && recUnit(byId.get(e.obj.answer)) !== recUnit(e));
  // 이어진 단위가 없는 단위가 about 대상을 다른 단위와 나누는가 — 대상 공유 엣지(character · keyword, X2)로 이어질 몫
  const unitTargets = new Map();
  for (const c of facts.concat(questions)) for (const t of aboutOf(c)) {
    const u = recUnit(c);
    if (!unitTargets.has(u)) unitTargets.set(u, new Set());
    unitTargets.get(u).add(t);
  }
  const unitsPerTarget = new Map();
  for (const ts of unitTargets.values()) for (const t of ts) inc(unitsPerTarget, t);
  const isolated = units.filter((u) => !u.in_units && !u.out_units);
  const sharing = (max) => isolated.filter((u) => [...(unitTargets.get(u.unit) ?? [])].some((t) => unitsPerTarget.get(t) > 1 && unitsPerTarget.get(t) <= max)).length;
  const gaps = {
    isolated: isolated.length,
    isolatedSharingRare: sharing(RARE_TARGET_UNITS),
    isolatedSharingAny: sharing(Infinity),
    defsWithoutAbout: facts.concat(questions).filter((c) => !aboutOf(c).length).length,
    multiSceneFacts: facts.filter((f) => new Set(arr(f.evidence).map((e) => e.scene)).size > 1).length,
    crossUnitEvidence: crossEvidence.length,
    answerElsewhere: answerElsewhere.length,
    internalEdges: internal,
    unitsWithoutFile: [...unitPos.keys()].filter((k) => !unitsInFile.has(k)),
    strayUnits: [...strayUnits].sort(),
    timeRefs: tally(times.map((t) => refKind(t.obj?.ref))),
  };

  return { units, sceneEdges, unitEdges, questions: questionRows, targets, threads: threadRows, slips, gaps, problems,
    totals: { facts: facts.length, questions: questions.length, events: events.length, times: times.length,
      unconfirmed: live.filter((c) => c.status !== '확정').length, units: units.length } };
}

/**
 * 1회독 사건 엣지 — 사건 하나에 하나: 의문 회수 Q<n>-k → setup_payoff, 사실 다시 드러냄 F<n>-k → callback, 뒤집음 → reversal.
 * 끝점은 근거의 첫 씬(from = 정의의 첫 씬, to = 사건의 첫 씬). 기각된 기록은 뺀다. 관계선(X2, tools/views/links.mjs)도 이것을 쓴다.
 * @param {object} ds loadDataset()
 * @param {(scene: string|null) => string|null} unitOf 씬 → 읽기 단위
 * @param {(unit: string|null) => number|null} posOf 단위 → 읽는 자리
 * @returns {{ sceneEdges: object[], problems: string[] }}
 */
export function read1Edges(ds, unitOf, posOf) {
  const live = ds.candidates.filter((c) => c.status !== '기각' && isRecord(c));
  const byId = new Map(live.map((c) => [c.id, c]));
  const events = live.filter((c) => c.role === 'event').sort((a, b) => compareIds(a.id, b.id));
  const recUnit = (c) => unitOf(firstScene(c)) ?? c.unit;
  const sceneEdges = [];
  const problems = [];
  for (const e of events) {
    const p = byId.get(e.parent);
    if (!p) {
      problems.push(`${e.id}: 부모 ${e.parent}가 없다(기각됐거나 빠짐)`);
      continue;
    }
    const type = EDGE_OF_ACT[e.act];
    if (!type) {
      problems.push(`${e.id}: 모르는 act ${e.act}`);
      continue;
    }
    const fu = recUnit(p);
    const tu = recUnit(e);
    sceneEdges.push({
      type, record: e.id, parent: p.id, from_scene: firstScene(p), to_scene: firstScene(e), from_unit: fu, to_unit: tu,
      from_order: posOf(fu), to_order: posOf(tu), degree: e.obj?.degree ?? '', answer: e.obj?.answer ?? e.obj?.replacedBy ?? '',
      confidence: e.confidence ?? '', status: e.status ?? '',
    });
  }
  const backwards = sceneEdges.filter((r) => r.from_order != null && r.to_order != null && r.from_order > r.to_order);
  for (const r of backwards) problems.push(`${r.record}: 읽는 순서를 거슬러 간다(${r.from_unit} ${r.from_order} → ${r.to_unit} ${r.to_order})`);
  return { sceneEdges, problems };
}

function refKind(ref) {
  if (!ref) return '없음';
  if (/^[FQSL]\d/.test(ref)) return '기록 ID';
  if (/^(person|place|org|concept|incident|item):/.test(ref)) return '대상';
  return '단위 · 씬';
}

function tally(list) {
  const m = new Map();
  for (const x of list) inc(m, x);
  return Object.fromEntries([...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}
