/**
 * X3d — 인물별 집계(T3-8 · T4-8). 화면 5(docs/views.md "5. 인물별 집계")의 시안 표.
 *
 *   node tools/views/persons.mjs             → data/views/persons/ (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/persons.mjs --example   예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   인물 하나: node tools/query.mjs person 라피 [--list]
 *
 * 출력:
 *   persons.csv         인물마다(사전 person: 전부) — 등장(씬 · 단위 · 줄 · 처음/마지막) · 함께 나온 인물 · 기록(사실 · 의문 · 사건 · 떡밥 · 생활상) · 줄기 · 변화 · 마무리 · 정체 연결
 *   pairs.csv           함께 나옴 — 같은 씬에 나온 인물 쌍(씬 · 단위 수 · 둘 다 말한 씬 · 처음/마지막)
 *   person-units.csv    인물 × 단위 — 등장 히트맵(씬 · 줄 · 말한 줄 · 암시 줄)
 *   person-records.csv  인물 × 기록 — 그 인물을 다룬 기록 ID와 자리 · 상태 · 줄기(문장은 timeline/records.csv · chrono-changes.csv · closures/에)
 *   report.md           요약 · 순위 · 빈 곳
 *
 * 등장 = 언급 DB 자동 줄(speaks · named · alias, 빌드 — docs/schema.md "언급 DB") + 2회독 암시 언급(I — tools/records/read2.mjs mentionRows).
 *   합치기(T3-9 — 둘 다 두고 줄 합집합): (씬, 인물)마다 줄 집합을 합친다. 말한 줄 = 자동 speaks 줄 ∪ 암시 언급 speaker: true 줄(`???` 정체).
 *   암시 줄 = 암시 언급 줄 가운데 자동 줄에 없는 것(2회독이 더한 몫). 자리는 읽는 순서(출시순 한 줄 — docs/history/reading.md R), 공개 자리는 tools/views/reveal.mjs.
 * 함께 나옴 = 같은 씬에 두 인물 다 등장(위 합집합). 둘 다 말한 씬(대화)은 따로 센다.
 * 따로 두는 인물(common 칸 — 화면 기본값에서 숨기기 좋다):
 *   지휘관   플레이어라 어디에나 있다(links.mjs SKIP_TARGETS)
 *   흔한 대상 관계선(X2)과 같은 잣대 — 대상이 중심(links.mjs CENTER)인 단위가 읽기 단위의 COMMON_SHARE(10%)를 넘는다(spread 칸)
 * 기록(about — 해석은 기록에 이미 있다):
 *   사실 · 의문 = 정의의 about(공개 단계 뿌리 — reveal.mjs, 의문 끝 상태 열림 · 일부 · 풀림 · 사실 뒤집힘), 사건 = 회수 · 드러냄 · 뒤집음(부모 정의의 about을 물려받는다),
 *   떡밥 · 생활상 = 2회독 E · U의 about, 줄기 = 그 인물을 다룬 사실 · 의문이 든 줄기 ∪ 줄기 about에 그 인물,
 *   변화 = 2회독 D(person — 작중 순서 · 뒤바뀜은 chrono-order.mjs changeTimeline), 관계 상대 = D의 with,
 *   마무리 = O(about) · 합류 H(그 인물의 O를 묶은 것 · persons), 정체 연결 = 확정 same_as(sameAsGroups — 묶지 않고 칸으로만 단다).
 * 기각된 기록은 뺀다. 후보는 세되 unconfirmed 칸에 남긴다. 같은 기록이면 같은 결과다(정렬 끝까지 결정적). 원문 대사 · 기록 문장은 담지 않는다(ID · 이름 · 수만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, compareIds, displayPath, expandLines, isRecord, loadDataset, sameAsGroups } from '../records/model.mjs';
import { kindOfKey, loadOrder } from '../records/order.mjs';
import { mentionRows, scenePlaces } from '../records/read2.mjs';
import { threadMembership } from '../records/threads.mjs';
import { COMMON_SHARE, SKIP_TARGETS, centerWhy, unitTargets } from './links.mjs';
import { releasePlaces, revealStages } from './reveal.mjs';
import { buildChronology } from './timeline.mjs';
import { changeTimeline, unitSpans } from './chrono-order.mjs';
import { toCsv } from './draft.mjs';

export const PERSONS_DIR = path.join(ROOT, 'data/views/persons');
/** 순위 · 상대 표에 보일 수 */
const TOP = 30;

const COLUMNS = {
  persons: ['target', 'name', 'common', 'spread', 'scenes', 'units', 'lines', 'speaker_lines', 'named_lines', 'implied_lines', 'implied_scenes',
    'first_order', 'first_tick', 'first_unit', 'first_scene', 'first_speaks_unit', 'last_order', 'last_tick', 'last_unit',
    'partners', 'top_partners', 'facts', 'questions', 'open', 'partial', 'solved', 'reversed', 'events', 'echoes', 'life',
    'threads', 'baselines', 'changes', 'aspects', 'with_others', 'inverted', 'closures', 'merges', 'same_as', 'unconfirmed'],
  pairs: ['a', 'b', 'a_name', 'b_name', 'scenes', 'units', 'talk_scenes', 'first_order', 'first_unit', 'last_order', 'last_unit', 'common', 'same_as'],
  personUnits: ['person', 'order', 'tick', 'unit', 'kind', 'scenes', 'lines', 'speaker_lines', 'implied_lines', 'first_scene'],
  personRecords: ['person', 'record', 'kind', 'role', 'unit', 'order', 'tick', 'state', 'threads', 'with', 'status'],
};
const FILES = { persons: 'persons.csv', pairs: 'pairs.csv', personUnits: 'person-units.csv', personRecords: 'person-records.csv' };

const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const isPerson = (x) => typeof x === 'string' && x.startsWith('person:');
const getOr = (m, k, mk) => m.get(k) ?? m.set(k, mk()).get(k);
const firstScene = (c) => arr(c.evidence)[0]?.scene ?? null;

/**
 * (씬, 인물)마다 합친 줄 — Map(인물 → Map(씬 → { all: Set, speak: Set, implied: Set }))
 */
export function personScenes(ctx, ds) {
  const out = new Map();
  const slot = (t, s) => getOr(getOr(out, t, () => new Map()), s, () => ({ all: new Set(), speak: new Set(), auto: new Set(), implied: new Set() }));
  for (const r of ctx.db.prepare("SELECT story_id, seq_from, seq_to, target, how FROM mentions WHERE target LIKE 'person:%'").all()) {
    const x = slot(r.target, r.story_id);
    for (let n = r.seq_from; n <= r.seq_to; n++) {
      x.all.add(n);
      x.auto.add(n);
      if (r.how === 'speaks') x.speak.add(n);
    }
  }
  for (const r of mentionRows(ds)) {
    if (!isPerson(r.target) || !ctx.targetIds.has(r.target)) continue;
    const x = slot(r.target, r.scene);
    for (let n = r.from_seq; n <= r.to_seq; n++) {
      x.all.add(n);
      x.implied.add(n);
      if (r.speaker) x.speak.add(n);
    }
  }
  return out;
}

/**
 * @param {object} ds loadDataset()
 * @param {object} ctx openContext()
 * @param {object} order loadOrder() — 1회독 순서(출시순 한 줄)
 * @param {{ rel?: object, st?: object, ct?: object }} [pre] 이미 뽑은 공개 자리 · 공개 단계 · 변화 타임라인(draft.mjs가 timeline에서 넘긴다)
 */
export function buildPersons(ds, ctx, order, pre = {}) {
  const places = scenePlaces(order, ctx);
  const rel = pre.rel ?? releasePlaces(ctx, order);
  const st = pre.st ?? revealStages(ds, ctx, order, rel);
  const ct = pre.ct ?? (() => {
    const ch = buildChronology(ds, ctx, rel);
    return changeTimeline(ds, ch, unitSpans(ch), rel);
  })();
  const tickOf = (u) => rel.byUnit.get(u)?.tick ?? '';
  const orderOf = (u) => places.unitPos.get(u) ?? '';
  const persons = ctx.db.prepare("SELECT id, name FROM targets WHERE type = 'person' ORDER BY id").all();
  const nameOf = new Map(persons.map((p) => [p.id, p.name]));
  const short = (id) => nameOf.get(id) ?? id.replace(/^person:/, '');
  const problems = [];

  // ── 흔한 대상 (links.mjs와 같은 잣대) ──
  const { per, total } = unitTargets(ds, ctx, places);
  const spread = new Map();
  for (const [u, m] of per) for (const [t, x] of m) if (isPerson(t) && centerWhy(t, x, total.get(u) ?? 0)) spread.set(t, (spread.get(t) ?? 0) + 1);
  const commonLimit = Math.round(places.unitPos.size * COMMON_SHARE);
  const commonOf = (t) => (SKIP_TARGETS.has(t) ? '지휘관' : (spread.get(t) ?? 0) > commonLimit ? '흔한 대상' : '');

  // ── 등장 ──
  const ps = personScenes(ctx, ds);
  const app = new Map(); // 인물 → 집계
  const sceneMembers = new Map(); // 씬 → [{ t, talk }]
  const unitRows = [];
  for (const [t, scenes] of [...ps].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!ctx.targetIds.has(t)) {
      problems.push(`사전에 없는 인물: ${t}`);
      continue;
    }
    const a = { scenes: 0, units: new Map(), lines: 0, speak: 0, named: 0, implied: 0, impliedScenes: 0, first: null, last: null, firstSpeaks: null, unplaced: 0 };
    const placed = [];
    for (const [s, x] of scenes) {
      const p = places.posOf(s);
      if (!p) {
        a.unplaced++;
        continue;
      }
      const lo = Math.min(...x.all);
      placed.push({ s, x, pos: [...p, lo], unit: places.unitOf(s) });
    }
    placed.sort((m, n) => m.pos[0] - n.pos[0] || m.pos[1] - n.pos[1] || m.pos[2] - n.pos[2]);
    for (const { s, x, unit, pos } of placed) {
      a.scenes++;
      a.lines += x.all.size;
      a.speak += x.speak.size;
      a.named += [...x.all].filter((n) => !x.speak.has(n)).length;
      const onlyImplied = [...x.implied].filter((n) => !x.auto.has(n)).length;
      a.implied += onlyImplied;
      if (!x.auto.size) a.impliedScenes++;
      const u = getOr(a.units, unit, () => ({ scenes: 0, lines: 0, speak: 0, implied: 0, first_scene: s }));
      u.scenes++;
      u.lines += x.all.size;
      u.speak += x.speak.size;
      u.implied += onlyImplied;
      a.first ??= { scene: s, unit, pos };
      a.last = { scene: s, unit, pos };
      if (x.speak.size && !a.firstSpeaks) a.firstSpeaks = { scene: s, unit };
      getOr(sceneMembers, s, () => []).push({ t, talk: x.speak.size > 0 });
    }
    app.set(t, a);
    for (const [u, r] of a.units) {
      unitRows.push({ person: t, order: orderOf(u), tick: tickOf(u), unit: u, kind: kindOfKey(u), scenes: r.scenes, lines: r.lines, speaker_lines: r.speak, implied_lines: r.implied, first_scene: r.first_scene });
    }
  }

  // ── 함께 나옴 ──
  const groups = sameAsGroups(ds);
  const sameAs = (a, b) => (groups.get(a) ?? []).includes(b);
  const pairs = new Map();
  for (const [s, ms] of [...sceneMembers].sort((x, y) => {
    const p = places.posOf(x[0]);
    const q = places.posOf(y[0]);
    return p[0] - q[0] || p[1] - q[1];
  })) {
    ms.sort((x, y) => x.t.localeCompare(y.t));
    const unit = places.unitOf(s);
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const key = `${ms[i].t}\t${ms[j].t}`;
        const p = getOr(pairs, key, () => ({ a: ms[i].t, b: ms[j].t, scenes: 0, units: new Set(), talk: 0, first: unit, last: unit }));
        p.scenes++;
        p.units.add(unit);
        if (ms[i].talk && ms[j].talk) p.talk++;
        p.last = unit;
      }
    }
  }
  const pairRows = [...pairs.values()].map((p) => ({
    a: p.a, b: p.b, a_name: short(p.a), b_name: short(p.b), scenes: p.scenes, units: p.units.size, talk_scenes: p.talk,
    first_order: orderOf(p.first), first_unit: p.first, last_order: orderOf(p.last), last_unit: p.last,
    common: [commonOf(p.a), commonOf(p.b)].filter(Boolean).length ? [...new Set([commonOf(p.a), commonOf(p.b)].filter(Boolean))].join(' · ') : '',
    same_as: sameAs(p.a, p.b) ? '같은 인물' : '',
  })).sort((x, y) => y.scenes - x.scenes || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  const partnersOf = new Map();
  for (const p of pairRows) {
    if (p.same_as) continue;
    getOr(partnersOf, p.a, () => []).push({ t: p.b, n: p.scenes });
    getOr(partnersOf, p.b, () => []).push({ t: p.a, n: p.scenes });
  }

  // ── 기록 ──
  const recRows = [];
  const R = new Map(); // 인물 → 기록 집계
  const rec = (t) => getOr(R, t, () => ({ facts: 0, questions: 0, open: 0, partial: 0, solved: 0, reversed: 0, events: 0, echoes: 0, life: 0,
    threads: new Set(), baselines: 0, changes: 0, aspects: new Map(), withOthers: 0, inverted: 0, closures: new Set(), merges: new Set(), unconfirmed: 0 }));
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byId = new Map(live.map((c) => [c.id, c]));
  const mem = threadMembership(ds);
  const rootOf = new Map(st.roots.map((r) => [r.id, r]));
  const push = (t, c, kind, role, extra = {}) => {
    const unit = c.unit ?? '';
    recRows.push({ person: t, record: c.id, kind, role, unit, order: orderOf(unit), tick: tickOf(unit), state: '', threads: '', with: '', status: c.status ?? '', ...extra });
    if (c.status !== '확정') rec(t).unconfirmed++;
  };
  for (const c of live.filter(isRecord).sort((a, b) => compareIds(a.id, b.id))) {
    if ((c.kind === 'fact' || c.kind === 'question') && c.role === 'def') {
      const root = rootOf.get(c.id);
      const threads = c.kind === 'fact' ? mem.ofFact.get(c.id) ?? [] : mem.ofQuestion.has(c.id) ? [mem.ofQuestion.get(c.id)] : [];
      for (const t of new Set(arr(c.obj?.about).filter(isPerson))) {
        const r = rec(t);
        if (c.kind === 'fact') {
          r.facts++;
          if (root?.state === '뒤집힘') r.reversed++;
        } else {
          r.questions++;
          if (root?.state === '풀림') r.solved++;
          else if (root?.state === '일부') r.partial++;
          else r.open++;
        }
        for (const j of threads) r.threads.add(j);
        push(t, c, c.kind === 'fact' ? '사실' : '의문', '정의', { state: root?.state ?? '', threads: threads.join(' '), unit: root?.first_units?.split(' ')[0] || c.unit });
      }
    } else if (c.role === 'event' && c.parent) {
      for (const t of new Set(arr(byId.get(c.parent)?.obj?.about).filter(isPerson))) {
        rec(t).events++;
        push(t, c, '사건', c.act ?? '');
      }
    }
  }
  for (const th of mem.threads) for (const t of arr(th.c.obj?.about).filter(isPerson)) rec(t).threads.add(th.id);
  for (const c of live.filter((x) => x.kind === 'echo' || x.kind === 'life').sort((a, b) => compareIds(a.id, b.id))) {
    for (const t of new Set(arr(c.obj?.about).filter(isPerson))) {
      rec(t)[c.kind === 'echo' ? 'echoes' : 'life']++;
      push(t, c, c.kind === 'echo' ? '떡밥' : '생활상', c.act ?? c.obj?.topic ?? '', { unit: c.unit });
    }
  }
  const ctById = new Map(ct.rows.map((r) => [r.id, r]));
  for (const c of live.filter((x) => x.kind === 'change' && isPerson(x.obj?.person)).sort((a, b) => compareIds(a.id, b.id))) {
    const t = c.obj.person;
    const r = rec(t);
    const with_ = arr(c.obj.with).filter(isPerson);
    if (c.act === '기준') r.baselines++;
    else {
      r.changes++;
      r.aspects.set(c.obj.aspect ?? '?', (r.aspects.get(c.obj.aspect ?? '?') ?? 0) + 1);
      if (ctById.get(c.id)?.inverted) r.inverted++;
    }
    push(t, c, c.act === '기준' ? '기준' : '변화', c.obj.aspect ?? '', { with: with_.join(' ') });
    for (const w of with_) {
      if (w === t) continue;
      rec(w).withOthers++;
      push(w, c, '관계 상대', c.obj.aspect ?? '', { with: t });
    }
  }
  const mergeOf = new Map();
  for (const h of live.filter((x) => x.kind === 'merge')) for (const o of arr(h.obj?.members)) mergeOf.set(o, h.id);
  for (const c of live.filter((x) => x.kind === 'closure').sort((a, b) => compareIds(a.id, b.id))) {
    const unit = c.closureEnd ?? c.obj?.end ?? '';
    for (const t of new Set(arr(c.obj?.about).filter(isPerson))) {
      rec(t).closures.add(c.id);
      if (mergeOf.has(c.id)) rec(t).merges.add(mergeOf.get(c.id));
      push(t, c, '마무리', c.obj?.type ?? '', { unit, order: orderOf(unit), tick: tickOf(unit), state: mergeOf.get(c.id) ?? '' });
    }
  }
  recRows.sort((a, b) => a.person.localeCompare(b.person) || (Number(a.order) || 1e9) - (Number(b.order) || 1e9) || compareIds(a.record, b.record) || a.kind.localeCompare(b.kind));

  // ── 인물 표 ──
  const ASPECTS = ['성격', '관계', '소속', '신체', '신념', '기억'];
  const rows = persons.map(({ id, name }) => {
    const a = app.get(id);
    const r = R.get(id) ?? rec(id);
    const partners = (partnersOf.get(id) ?? []).sort((x, y) => y.n - x.n || x.t.localeCompare(y.t));
    const named = partners.filter((x) => !SKIP_TARGETS.has(x.t));
    return {
      target: id, name, common: commonOf(id), spread: spread.get(id) ?? 0,
      scenes: a?.scenes ?? 0, units: a?.units.size ?? 0, lines: a?.lines ?? 0, speaker_lines: a?.speak ?? 0, named_lines: a?.named ?? 0,
      implied_lines: a?.implied ?? 0, implied_scenes: a?.impliedScenes ?? 0,
      first_order: a?.first?.pos[0] ?? '', first_tick: a?.first ? tickOf(a.first.unit) : '', first_unit: a?.first?.unit ?? '', first_scene: a?.first?.scene ?? '',
      first_speaks_unit: a?.firstSpeaks?.unit ?? '', last_order: a?.last?.pos[0] ?? '', last_tick: a?.last ? tickOf(a.last.unit) : '', last_unit: a?.last?.unit ?? '',
      partners: named.length, top_partners: named.slice(0, 5).map((x) => `${short(x.t)} ${x.n}`).join(' · '),
      facts: r.facts, questions: r.questions, open: r.open, partial: r.partial, solved: r.solved, reversed: r.reversed, events: r.events, echoes: r.echoes, life: r.life,
      threads: [...r.threads].sort(compareIds).join(' '), baselines: r.baselines, changes: r.changes,
      aspects: ASPECTS.filter((x) => r.aspects.has(x)).map((x) => `${x} ${r.aspects.get(x)}`).join(' · '), with_others: r.withOthers, inverted: r.inverted,
      closures: [...r.closures].sort(compareIds).join(' '), merges: [...r.merges].sort(compareIds).join(' '),
      same_as: (groups.get(id) ?? []).filter((x) => x !== id).join(' '), unconfirmed: r.unconfirmed,
    };
  }).sort((x, y) => y.scenes - x.scenes || y.facts + y.questions - (x.facts + x.questions) || x.target.localeCompare(y.target));
  unitRows.sort((x, y) => x.person.localeCompare(y.person) || x.order - y.order);
  for (const id of R.keys()) if (!nameOf.has(id)) problems.push(`기록이 가리키는 인물이 사전에 없다: ${id}`);
  return { persons: rows, pairs: pairRows, personUnits: unitRows, personRecords: recRows, commonLimit, units: places.unitPos.size, problems };
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');

/** report.md — 숫자 · ID · 이름만. 같은 기록이면 같은 글 */
export function renderPersonsReport(v, { source }) {
  const P = v.persons;
  const seen = P.filter((p) => p.scenes);
  const plain = seen.filter((p) => !p.common);
  const L = [];
  L.push('# 인물별 집계 (X3d) — 화면 5 시안', '');
  L.push(`기록: \`${source}\` + 언급 DB 자동 줄 · 2회독 암시 언급. 규칙은 \`tools/views/persons.mjs\` 머리말, 화면은 docs/views.md "5. 인물별 집계". 인물 하나는 \`node tools/query.mjs person <이름>\`.`, '');
  L.push('## 한눈에', '');
  const sum = (k, xs = P) => xs.reduce((s, p) => s + (Number(p[k]) || 0), 0);
  L.push(`- 사전 인물 ${P.length} · 등장한 인물 ${seen.length} (등장 없음 ${P.length - seen.length}: ${P.filter((p) => !p.scenes).map((p) => p.name).join(' · ') || '-'}).`);
  L.push(`- 따로 두는 인물: 지휘관 + 흔한 대상 ${P.filter((p) => p.common === '흔한 대상').length}(중심인 단위 > ${v.commonLimit}/${v.units} — ${P.filter((p) => p.common === '흔한 대상').map((p) => `${p.name} ${p.spread}`).join(' · ')}).`);
  L.push(`- 등장 줄 ${sum('lines').toLocaleString('ko-KR')} — 말한 줄 ${sum('speaker_lines').toLocaleString('ko-KR')} · 이름 · 다른 이름 ${sum('named_lines').toLocaleString('ko-KR')}. 2회독 암시 언급이 더한 줄 ${sum('implied_lines')} · 암시로만 나온 씬 ${sum('implied_scenes')}(인물 ${P.filter((p) => p.implied_scenes).length}).`);
  L.push(`- 함께 나옴 — 인물 쌍 ${v.pairs.length.toLocaleString('ko-KR')}(2씬 이상 ${v.pairs.filter((p) => p.scenes >= 2).length.toLocaleString('ko-KR')} · 10씬 이상 ${v.pairs.filter((p) => p.scenes >= 10).length}), 지휘관 · 흔한 대상이 낀 쌍 ${v.pairs.filter((p) => p.common).length.toLocaleString('ko-KR')}, 같은 인물(정체 연결) 쌍 ${v.pairs.filter((p) => p.same_as).length}.`);
  const withRec = P.filter((p) => p.facts + p.questions + p.echoes + p.life + p.baselines + p.changes);
  L.push(`- 기록이 다룬 인물 ${withRec.length} — 사실 ${sum('facts')} · 의문 ${sum('questions')}(열림 ${sum('open')} · 일부 ${sum('partial')} · 풀림 ${sum('solved')}) · 사건 ${sum('events')} · 떡밥 ${sum('echoes')} · 생활상 ${sum('life')} (기록 하나가 여러 인물을 다루면 인물마다 센다).`);
  L.push(`- 변화 — 인물 ${P.filter((p) => p.baselines + p.changes).length} · 기준 ${sum('baselines')} · 변화 ${sum('changes')}(작중 순서가 뒤바뀐 변화 ${sum('inverted')}) · 관계 상대로 나온 수 ${sum('with_others')}. 마무리가 있는 인물 ${P.filter((p) => p.closures).length} · 합류 결판에 든 인물 ${P.filter((p) => p.merges).length}.`);
  L.push(`- 줄기에 관여한 인물 ${P.filter((p) => p.threads).length}. 확정 전 기록을 센 인물 ${P.filter((p) => p.unconfirmed).length}.`, '');

  const table = (title, xs, cols, head) => {
    L.push(`## ${title}`, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
    for (const p of xs) L.push(`| ${cols.map((c) => (typeof c === 'function' ? c(p) : p[c])).join(' | ')} |`);
    L.push('');
  };
  table(`등장 순위 (따로 두는 인물 빼고 위 ${TOP})`, plain.slice(0, TOP),
    ['name', 'scenes', 'units', 'speaker_lines', (p) => `${p.first_unit}(${p.first_tick})`, (p) => `${p.last_unit}(${p.last_tick})`, 'partners', (p) => p.top_partners.replace(/ · /g, ', ')],
    ['인물', '씬', '단위', '말한 줄', '처음(공개 자리)', '마지막', '함께 나온 인물', '자주 함께']);
  table('따로 두는 인물', P.filter((p) => p.common),
    ['name', 'common', 'spread', 'scenes', 'units', 'speaker_lines', 'partners'], ['인물', '왜', '중심 단위', '씬', '단위', '말한 줄', '함께 나온 인물']);
  const byRec = [...P].filter((p) => p.facts + p.questions).sort((a, b) => b.facts + b.questions - (a.facts + a.questions) || a.target.localeCompare(b.target));
  table(`기록 순위 (사실 + 의문 위 ${TOP})`, byRec.slice(0, TOP),
    ['name', 'facts', 'questions', 'open', 'events', 'echoes', (p) => p.threads.split(' ').filter(Boolean).length, 'changes', (p) => p.closures.split(' ').filter(Boolean).length],
    ['인물', '사실', '의문', '열림', '사건', '떡밥', '줄기', '변화', '마무리']);
  const byChange = [...P].filter((p) => p.changes).sort((a, b) => b.changes - a.changes || a.target.localeCompare(b.target));
  table(`변화 순위 (위 ${TOP})`, byChange.slice(0, TOP), ['name', 'baselines', 'changes', 'aspects', 'with_others', 'inverted', 'closures', 'merges'],
    ['인물', '기준', '변화', '측면', '관계 상대', '뒤바뀜', '마무리', '합류']);
  table(`함께 나옴 (따로 두는 인물 빼고 위 ${TOP})`, v.pairs.filter((p) => !p.common && !p.same_as).slice(0, TOP),
    ['a_name', 'b_name', 'scenes', 'units', 'talk_scenes', (p) => `${p.first_unit} → ${p.last_unit}`], ['인물', '인물', '씬', '단위', '둘 다 말함', '처음 → 마지막']);

  L.push('## 빈 곳', '');
  const thin = seen.filter((p) => !p.common && !(p.facts + p.questions + p.echoes + p.life + p.baselines + p.changes));
  L.push(`- 등장했지만 다룬 기록이 하나도 없는 인물 ${thin.length}/${seen.length}(${pct(thin.length, seen.length)}) — 씬 많은 순: ${thin.slice(0, 15).map((p) => `${p.name} ${p.scenes}`).join(' · ')}${thin.length > 15 ? ' …' : ''}. 등장 · 함께 나옴만 보인다.`);
  const noApp = P.filter((p) => !p.scenes && p.facts + p.questions + p.changes);
  L.push(`- 기록은 있는데 등장 줄이 없는 인물 ${noApp.length}${noApp.length ? ` — ${noApp.map((p) => p.name).join(' · ')}` : ''} (이름이 안 걸리는 인물 — 언급 DB 사전 몫).`);
  const solo = seen.filter((p) => !p.partners);
  L.push(`- 함께 나온 인물이 없는(지휘관만) 인물 ${solo.length}${solo.length ? ` — ${solo.slice(0, 15).map((p) => p.name).join(' · ')}${solo.length > 15 ? ' …' : ''}` : ''}.`);
  const imp = [...P].filter((p) => p.implied_scenes).sort((a, b) => b.implied_scenes - a.implied_scenes);
  L.push(`- 2회독 암시 언급으로만 나온 씬이 많은 인물: ${imp.slice(0, 10).map((p) => `${p.name} ${p.implied_scenes}`).join(' · ') || '-'} — 자동 줄만으로는 등장이 모자랐던 곳.`, '');
  if (v.problems.length) L.push('## 문제', '', ...v.problems.map((p) => `- ${p}`), '');
  return L.join('\n');
}

export function writePersonsViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [k, f] of Object.entries(FILES)) fs.writeFileSync(path.join(outDir, f), toCsv(v[k], COLUMNS[k]));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderPersonsReport(v, opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({ options: { example: { type: 'boolean' } } });
  const dir = opt.example ? EXAMPLE_DIR : READ1_DIR;
  const ds = loadDataset({ dir });
  if (ds.problems.length) {
    for (const p of ds.problems) console.error(`✗ ${p.file}: ${p.msg}`);
    process.exit(1);
  }
  const ctx = await openContext();
  const v = buildPersons(ds, ctx, loadOrder());
  ctx.close();
  const source = displayPath(dir) + '/';
  if (opt.example) console.log(renderPersonsReport(v, { source }));
  else {
    writePersonsViews(v, PERSONS_DIR, { source });
    console.log(`→ ${displayPath(PERSONS_DIR)}/ (${Object.values(FILES).join(' · ')} · report.md)`);
  }
  console.log(`인물 ${v.persons.length} · 등장 ${v.persons.filter((p) => p.scenes).length} · 쌍 ${v.pairs.length} · 기록 줄 ${v.personRecords.length}${v.problems.length ? ` · 문제 ${v.problems.length}` : ''}`);
}
