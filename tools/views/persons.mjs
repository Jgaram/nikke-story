/**
 * X3d — 인물별 집계(T3-8 · T4-8). 화면 5(docs/views.md "5. 인물별 집계")의 시안 표.
 *
 *   node tools/views/persons.mjs             → data/views/persons/ (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/persons.mjs --example   예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   인물 하나: node tools/query.mjs person 라피 [--list]
 *
 * 출력:
 *   persons.csv         인물마다(사전 person: 전부) — 등장(씬 · 단위 · 줄 · 처음/마지막) · 관계 상대 수 · 기록(사실 · 의문 · 사건 · 떡밥 · 생활상) · 줄기 · 변화 · 마무리 · 정체 연결
 *   relations.csv       관계 쌍 — 기록에서 온 인물 쌍(변화 D · 마무리 O · 합류 H의 ID, 처음/마지막 — W21)
 *   person-units.csv    인물 × 단위 — 등장 히트맵(씬 · 줄 · 말한 줄 · 암시 줄, 사칭이 걸린 단위는 imp · pre_* — 드러나기 전 모습)
 *   person-records.csv  인물 × 기록 — 그 인물을 다룬 기록 ID와 자리 · 상태 · 줄기(문장은 timeline/records.csv · chrono-changes.csv · closures/에)
 *   report.md           요약 · 순위 · 빈 곳
 *
 * 등장 = 언급 DB 자동 줄(speaks · named · alias, 빌드 — docs/schema.md "언급 DB") + 2회독 암시 언급(I — tools/records/read2.mjs mentionRows).
 *   합치기(T3-9 — 둘 다 두고 줄 합집합): (씬, 인물)마다 줄 집합을 합친다. 말한 줄 = 자동 speaks 줄 ∪ 암시 언급 speaker: true 줄(`???` 정체).
 *   암시 줄 = 암시 언급 줄 가운데 자동 줄에 없는 것(2회독이 더한 몫). 자리는 읽는 순서(출시순 한 줄 — docs/history/reading.md R), 공개 자리는 tools/views/reveal.mjs.
 *   사칭(W23a — people.json 정체 연결 impersonates, 기각 빼고): 범위(spans) 줄에서 b(이름표 · 이름 주인)로 잡힌 줄을 a(사칭한 인물)에게 옮겨 센다 — 수치는 사칭한 인물에.
 *   person-units.csv의 imp · pre_* = 그 단위의 사칭 L과 옮기기 전 모습(b는 옮긴 줄까지, a는 옮겨 받은 줄 없이 — 화면이 revealed 단위를 읽기 전에 보인다).
 *   줄을 다 옮긴 단위는 b 쪽에 scenes 0 · pre_*만 있는 행으로 남는다. persons.csv impersonation = 그 인물이 a나 b인 사칭 L.
 * 관계 쌍(W21 — 같은 씬 횟수 '함께 나옴'을 대신한다: 씬이 시나리오 파일 하나라 다른 시공간이 묶였다) = 기록이 이은 두 인물:
 *   변화 D 관계의 person ↔ with(어느 쪽의 변화든 그 쌍에) · 마무리 O의 관계 사슬(chain '관계 A ↔ B') · 그 O를 묶은 합류 H. 수 · 순위가 아니라 쌍마다 기록 ID를 읽는 자리 순으로.
 * 따로 두는 인물(common 칸 — 화면 기본값에서 숨기기 좋다):
 *   지휘관   플레이어라 어디에나 있다(links.mjs SKIP_TARGETS)
 *   흔한 대상 관계선(X2)과 같은 잣대 — 대상이 중심(links.mjs CENTER)인 단위가 읽기 단위의 COMMON_SHARE(10%)를 넘는다(spread 칸)
 * 기록(about — 해석은 기록에 이미 있다):
 *   사실 · 의문 = 정의의 about(공개 단계 뿌리 — reveal.mjs, 의문 끝 상태 열림 · 일부 · 풀림 · 사실 뒤집힘), 사건 = 회수 · 드러냄 · 뒤집음(부모 정의의 about을 물려받는다),
 *   떡밥 · 생활상 = 2회독 E · U의 about, 줄기 = 그 인물을 다룬 사실 · 의문이 든 줄기 ∪ 줄기 about에 그 인물,
 *   변화 = 2회독 D(person — 작중 순서 · 뒤바뀜은 chrono-order.mjs changeTimeline), 관계 상대 = D의 with,
 *   마무리 = O(about) · 합류 H(그 인물의 O를 묶은 것 · persons), 정체 연결 = 확정 same_as(sameAsGroups — 묶지 않고 칸으로만 단다).
 * 만우절 단위(결정 #11 — tools/lib/fools.mjs)는 숫자에서 뺀다: 등장 · 흔한 대상(분모 포함) · 기록 수 · 관계 상대 수. person-records.csv · relations.csv에는 fool 칸을 달아 남긴다(상세 표시).
 * 기각된 기록은 뺀다. 후보는 세되 unconfirmed 칸에 남긴다. 같은 기록이면 같은 결과다(정렬 끝까지 결정적). 원문 대사 · 기록 문장은 담지 않는다(ID · 이름 · 수만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, compareIds, displayPath, expandLines, impersonations, isRecord, loadDataset, sameAsGroups } from '../records/model.mjs';
import { kindOfKey, loadOrder } from '../records/order.mjs';
import { mentionRows, scenePlaces } from '../records/read2.mjs';
import { threadMembership } from '../records/threads.mjs';
import { COMMON_SHARE, SKIP_TARGETS, centerWhy, unitTargets } from './links.mjs';
import { releasePlaces, revealStages } from './reveal.mjs';
import { buildChronology } from './timeline.mjs';
import { changeTimeline, unitSpans } from './chrono-order.mjs';
import { toCsv } from './draft.mjs';
import { isAprilFools } from '../lib/fools.mjs';

export const PERSONS_DIR = path.join(ROOT, 'data/views/persons');
/** 순위 · 상대 표에 보일 수 */
const TOP = 30;

const COLUMNS = {
  persons: ['target', 'name', 'common', 'spread', 'scenes', 'units', 'lines', 'speaker_lines', 'named_lines', 'implied_lines', 'implied_scenes',
    'first_order', 'first_tick', 'first_unit', 'first_scene', 'first_speaks_unit', 'last_order', 'last_tick', 'last_unit',
    'relations', 'facts', 'questions', 'open', 'partial', 'solved', 'reversed', 'events', 'echoes', 'life',
    'threads', 'baselines', 'changes', 'aspects', 'with_others', 'inverted', 'closures', 'merges', 'same_as', 'impersonation', 'unconfirmed'],
  relations: ['a', 'b', 'a_name', 'b_name', 'changes', 'closures', 'merges', 'first_order', 'first_unit', 'last_order', 'last_unit', 'fool'],
  personUnits: ['person', 'order', 'tick', 'unit', 'kind', 'scenes', 'lines', 'speaker_lines', 'implied_lines', 'first_scene',
    'imp', 'pre_scenes', 'pre_lines', 'pre_speaker_lines', 'pre_implied_lines', 'pre_first_scene'],
  personRecords: ['person', 'record', 'kind', 'role', 'unit', 'order', 'tick', 'state', 'threads', 'with', 'status', 'fool'],
};
const FILES = { persons: 'persons.csv', relations: 'relations.csv', personUnits: 'person-units.csv', personRecords: 'person-records.csv' };

const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const isPerson = (x) => typeof x === 'string' && x.startsWith('person:');
const getOr = (m, k, mk) => m.get(k) ?? m.set(k, mk()).get(k);
const firstScene = (c) => arr(c.evidence)[0]?.scene ?? null;

/**
 * (씬, 인물)마다 합친 줄 — Map(인물 → Map(씬 → { all, speak, auto, implied: Set, pre?: 사칭이 드러나기 전 모습(같은 모양), imp?: Set(사칭 L) }))
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
  // 사칭(W23a — people.json impersonates) — 범위 줄에서 b(이름표 · 이름 주인)로 잡힌 줄을 a(사칭한 인물)에게 옮긴다.
  // 옮기기 전 모습을 pre에 남긴다 — 화면은 드러난 단위(revealed)를 읽기 전에는 이것을 보인다(b는 옮긴 줄까지, a는 옮겨 받은 줄 없이)
  const copy = (x) => ({ all: new Set(x.all), speak: new Set(x.speak), auto: new Set(x.auto), implied: new Set(x.implied) });
  // 이름 승계(W23e — real이 있는 사칭)는 범위 밖에서 b로 잡힌 줄(회상 속 진짜 머스탱)을 real에게 옮긴다 — b(독자가 알던 인물)에는 드러나기 전 모습만 남는다
  for (const imp of impersonations(ds)) {
    if (!ctx.targetIds.has(imp.a) || !ctx.targetIds.has(imp.b)) continue;
    const moves = imp.spans.map((span) => ({ scene: span.scene, to: imp.a, has: (n) => !span.seqs || span.seqs.has(n) }));
    if (imp.real && ctx.targetIds.has(imp.real)) {
      const span = new Map(imp.spans.map((x) => [x.scene, x.seqs]));
      for (const scene of out.get(imp.b)?.keys() ?? []) {
        const seqs = span.get(scene);
        if (seqs === null) continue;
        moves.push({ scene, to: imp.real, has: (n) => !seqs?.has(n) });
      }
    }
    for (const { scene, to, has } of moves) {
      const bx = out.get(imp.b)?.get(scene);
      const moved = bx ? [...bx.all].filter(has) : [];
      if (!moved.length) continue;
      const ax = slot(to, scene);
      bx.pre ??= copy(bx);
      if (!ax.pre) {
        // a의 드러나기 전 모습 — 옮겨 받을 줄은 a 자신의 자동 줄이 아니면 뺀다(그 줄의 2회독 speaker 암시 언급도 사칭이 드러나야 안다)
        ax.pre = copy(ax);
        for (const n of moved) if (!ax.auto.has(n)) for (const k of ['all', 'speak', 'implied']) ax.pre[k].delete(n);
      }
      for (const n of moved) {
        ax.all.add(n);
        for (const k of ['speak', 'auto', 'implied']) if (bx[k].has(n)) ax[k].add(n);
        for (const k of ['all', 'speak', 'auto', 'implied']) bx[k].delete(n);
      }
      for (const x of [ax, bx]) (x.imp ??= new Set()).add(imp.id);
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
  const counted = [...places.unitPos.keys()].filter((u) => !isAprilFools(u)).length; // 분모 — 만우절 단위 빼고
  const commonLimit = Math.round(counted * COMMON_SHARE);
  const commonOf = (t) => (SKIP_TARGETS.has(t) ? '지휘관' : (spread.get(t) ?? 0) > commonLimit ? '흔한 대상' : '');

  // ── 등장 ──
  const ps = personScenes(ctx, ds);
  const app = new Map(); // 인물 → 집계
  const unitRows = [];
  for (const [t, scenes] of [...ps].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!ctx.targetIds.has(t)) {
      problems.push(`사전에 없는 인물: ${t}`);
      continue;
    }
    const a = { scenes: 0, units: new Map(), lines: 0, speak: 0, named: 0, implied: 0, impliedScenes: 0, first: null, last: null, firstSpeaks: null, unplaced: 0, imp: new Set() };
    const placed = [];
    for (const [s, x] of scenes) {
      if (isAprilFools(places.unitOf(s))) continue; // 만우절 — 등장에서 뺀다
      const p = places.posOf(s);
      if (!p) {
        a.unplaced++;
        continue;
      }
      const lo = Math.min(...(x.all.size ? x.all : x.pre?.all ?? [0]));
      placed.push({ s, x, pos: [...p, lo], unit: places.unitOf(s) });
    }
    placed.sort((m, n) => m.pos[0] - n.pos[0] || m.pos[1] - n.pos[1] || m.pos[2] - n.pos[2]);
    const blankUnit = () => ({ scenes: 0, lines: 0, speak: 0, implied: 0, first_scene: '' });
    const addScene = (u, s, x) => {
      if (!x.all.size) return;
      u.scenes++;
      u.lines += x.all.size;
      u.speak += x.speak.size;
      u.implied += [...x.implied].filter((n) => !x.auto.has(n)).length;
      u.first_scene ||= s;
    };
    for (const { s, x, unit, pos } of placed) {
      // 드러나기 전 모습(pre — 사칭 W23a)은 단위 행에만 따로 센다. 인물 수치는 옮긴 뒤(사칭한 인물에)
      const u = getOr(a.units, unit, () => ({ ...blankUnit(), pre: blankUnit(), imp: new Set() }));
      addScene(u.pre, s, x.pre ?? x);
      for (const id of x.imp ?? []) {
        u.imp.add(id);
        a.imp.add(id);
      }
      if (!x.all.size) continue; // 사칭으로 줄을 다 옮긴 씬 — 드러나기 전 모습에만 있다
      addScene(u, s, x);
      a.scenes++;
      a.lines += x.all.size;
      a.speak += x.speak.size;
      a.named += [...x.all].filter((n) => !x.speak.has(n)).length;
      a.implied += [...x.implied].filter((n) => !x.auto.has(n)).length;
      if (!x.auto.size) a.impliedScenes++;
      a.first ??= { scene: s, unit, pos };
      a.last = { scene: s, unit, pos };
      if (x.speak.size && !a.firstSpeaks) a.firstSpeaks = { scene: s, unit };
    }
    app.set(t, a);
    for (const [u, r] of a.units) {
      const imp = r.imp.size ? { imp: [...r.imp].sort(compareIds).join(' '), pre_scenes: r.pre.scenes, pre_lines: r.pre.lines, pre_speaker_lines: r.pre.speak, pre_implied_lines: r.pre.implied, pre_first_scene: r.pre.first_scene } : {};
      unitRows.push({ person: t, order: orderOf(u), tick: tickOf(u), unit: u, kind: kindOfKey(u), scenes: r.scenes, lines: r.lines, speaker_lines: r.speak, implied_lines: r.implied, first_scene: r.first_scene, ...imp });
    }
  }

  const groups = sameAsGroups(ds);

  // ── 기록 ──
  const recRows = [];
  const R = new Map(); // 인물 → 기록 집계
  const blank = () => ({ facts: 0, questions: 0, open: 0, partial: 0, solved: 0, reversed: 0, events: 0, echoes: 0, life: 0,
    threads: new Set(), baselines: 0, changes: 0, aspects: new Map(), withOthers: 0, inverted: 0, closures: new Set(), merges: new Set(), unconfirmed: 0 });
  const rec = (t) => getOr(R, t, blank);
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byId = new Map(live.map((c) => [c.id, c]));
  const mem = threadMembership(ds);
  const rootOf = new Map(st.roots.map((r) => [r.id, r]));
  // 만우절 단위의 기록 — 줄은 남기고(fool 칸) 수에서는 뺀다. 그 몫은 sink에 센다(버림)
  const fool = (c) => isAprilFools(c.kind === 'closure' ? c.closureEnd ?? c.obj?.end : c.unit);
  const sink = blank();
  const cnt = (t, c) => (fool(c) ? sink : rec(t));
  const push = (t, c, kind, role, extra = {}) => {
    const unit = c.unit ?? '';
    recRows.push({ person: t, record: c.id, kind, role, unit, order: orderOf(unit), tick: tickOf(unit), state: '', threads: '', with: '', status: c.status ?? '', fool: fool(c) ? 1 : '', ...extra });
    if (c.status !== '확정') rec(t).unconfirmed++;
  };
  for (const c of live.filter(isRecord).sort((a, b) => compareIds(a.id, b.id))) {
    if ((c.kind === 'fact' || c.kind === 'question') && c.role === 'def') {
      const root = rootOf.get(c.id);
      const threads = c.kind === 'fact' ? mem.ofFact.get(c.id) ?? [] : mem.ofQuestion.has(c.id) ? [mem.ofQuestion.get(c.id)] : [];
      for (const t of new Set(arr(c.obj?.about).filter(isPerson))) {
        const r = cnt(t, c);
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
        cnt(t, c).events++;
        push(t, c, '사건', c.act ?? '');
      }
    }
  }
  for (const th of mem.threads) for (const t of arr(th.c.obj?.about).filter(isPerson)) rec(t).threads.add(th.id);
  for (const c of live.filter((x) => x.kind === 'echo' || x.kind === 'life').sort((a, b) => compareIds(a.id, b.id))) {
    for (const t of new Set(arr(c.obj?.about).filter(isPerson))) {
      cnt(t, c)[c.kind === 'echo' ? 'echoes' : 'life']++;
      push(t, c, c.kind === 'echo' ? '떡밥' : '생활상', c.act ?? c.obj?.topic ?? '', { unit: c.unit });
    }
  }
  const ctById = new Map(ct.rows.map((r) => [r.id, r]));
  for (const c of live.filter((x) => x.kind === 'change' && isPerson(x.obj?.person)).sort((a, b) => compareIds(a.id, b.id))) {
    const t = c.obj.person;
    const r = cnt(t, c);
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
      cnt(w, c).withOthers++;
      push(w, c, '관계 상대', c.obj.aspect ?? '', { with: t });
    }
  }
  const mergeOf = new Map();
  for (const h of live.filter((x) => x.kind === 'merge')) for (const o of arr(h.obj?.members)) mergeOf.set(o, h.id);
  for (const c of live.filter((x) => x.kind === 'closure').sort((a, b) => compareIds(a.id, b.id))) {
    const unit = c.closureEnd ?? c.obj?.end ?? '';
    for (const t of new Set(arr(c.obj?.about).filter(isPerson))) {
      cnt(t, c).closures.add(c.id);
      if (mergeOf.has(c.id)) cnt(t, c).merges.add(mergeOf.get(c.id));
      push(t, c, '마무리', c.obj?.type ?? '', { unit, order: orderOf(unit), tick: tickOf(unit), state: mergeOf.get(c.id) ?? '' });
    }
  }
  // ── 관계 쌍(W21) — 변화 D 관계의 person ↔ with · 마무리 O의 관계 사슬 · 그 O를 묶은 합류 H ──
  const rels = new Map();
  const relOf = (x, y) => {
    const [a, b] = x < y ? [x, y] : [y, x];
    return getOr(rels, `${a}\t${b}`, () => ({ a, b, recs: [], merges: new Set() }));
  };
  const recOrder = (c) => Number(orderOf(c.kind === 'closure' ? c.closureEnd ?? c.obj?.end : c.unit)) || 1e9;
  for (const c of live.filter((x) => x.kind === 'change' && isPerson(x.obj?.person) && x.obj.aspect === '관계')) {
    for (const w of new Set(arr(c.obj.with).filter(isPerson))) if (w !== c.obj.person) relOf(c.obj.person, w).recs.push(c);
  }
  for (const c of live.filter((x) => x.kind === 'closure')) {
    const m = /^관계 (\S+) ↔ (\S+)$/.exec(c.obj?.chain ?? '');
    if (!m || !isPerson(m[1]) || !isPerson(m[2]) || m[1] === m[2]) continue;
    const r = relOf(m[1], m[2]);
    r.recs.push(c);
    if (mergeOf.has(c.id)) r.merges.add(mergeOf.get(c.id));
  }
  const relRows = [...rels.values()].map((r) => {
    const xs = r.recs.sort((x, y) => recOrder(x) - recOrder(y) || compareIds(x.id, y.id));
    const unitOf = (c) => (c.kind === 'closure' ? c.closureEnd ?? c.obj?.end : c.unit) ?? '';
    const first = unitOf(xs[0]);
    const last = unitOf(xs.at(-1));
    const ids = (k) => xs.filter((c) => c.kind === k).map((c) => c.id).join(' ');
    return {
      a: r.a, b: r.b, a_name: short(r.a), b_name: short(r.b), changes: ids('change'), closures: ids('closure'), merges: [...r.merges].sort(compareIds).join(' '),
      first_order: orderOf(first), first_unit: first, last_order: orderOf(last), last_unit: last, fool: xs.every(fool) ? 1 : '',
    };
  }).sort((x, y) => (Number(x.first_order) || 1e9) - (Number(y.first_order) || 1e9) || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  const relCount = new Map(); // 만우절 기록뿐인 쌍은 세지 않는다(결정 #11)
  for (const r of relRows) if (!r.fool) for (const t of [r.a, r.b]) relCount.set(t, (relCount.get(t) ?? 0) + 1);

  recRows.sort((a, b) => a.person.localeCompare(b.person) || (Number(a.order) || 1e9) - (Number(b.order) || 1e9) || compareIds(a.record, b.record) || a.kind.localeCompare(b.kind));

  // ── 인물 표 ──
  const ASPECTS = ['성격', '관계', '소속', '신체', '신념', '기억'];
  const rows = persons.map(({ id, name }) => {
    const a = app.get(id);
    const r = R.get(id) ?? rec(id);
    return {
      target: id, name, common: commonOf(id), spread: spread.get(id) ?? 0,
      scenes: a?.scenes ?? 0, units: a ? [...a.units.values()].filter((u) => u.scenes).length : 0, lines: a?.lines ?? 0, speaker_lines: a?.speak ?? 0, named_lines: a?.named ?? 0,
      implied_lines: a?.implied ?? 0, implied_scenes: a?.impliedScenes ?? 0,
      first_order: a?.first?.pos[0] ?? '', first_tick: a?.first ? tickOf(a.first.unit) : '', first_unit: a?.first?.unit ?? '', first_scene: a?.first?.scene ?? '',
      first_speaks_unit: a?.firstSpeaks?.unit ?? '', last_order: a?.last?.pos[0] ?? '', last_tick: a?.last ? tickOf(a.last.unit) : '', last_unit: a?.last?.unit ?? '',
      relations: relCount.get(id) ?? 0,
      facts: r.facts, questions: r.questions, open: r.open, partial: r.partial, solved: r.solved, reversed: r.reversed, events: r.events, echoes: r.echoes, life: r.life,
      threads: [...r.threads].sort(compareIds).join(' '), baselines: r.baselines, changes: r.changes,
      aspects: ASPECTS.filter((x) => r.aspects.has(x)).map((x) => `${x} ${r.aspects.get(x)}`).join(' · '), with_others: r.withOthers, inverted: r.inverted,
      closures: [...r.closures].sort(compareIds).join(' '), merges: [...r.merges].sort(compareIds).join(' '),
      same_as: (groups.get(id) ?? []).filter((x) => x !== id).join(' '), impersonation: a ? [...a.imp].sort(compareIds).join(' ') : '', unconfirmed: r.unconfirmed,
    };
  }).sort((x, y) => y.scenes - x.scenes || y.facts + y.questions - (x.facts + x.questions) || x.target.localeCompare(y.target));
  unitRows.sort((x, y) => x.person.localeCompare(y.person) || x.order - y.order);
  for (const id of R.keys()) if (!nameOf.has(id)) problems.push(`기록이 가리키는 인물이 사전에 없다: ${id}`);
  return { persons: rows, relations: relRows, personUnits: unitRows, personRecords: recRows, commonLimit, units: counted, problems };
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
  const R2 = v.relations.filter((r) => !r.fool);
  L.push(`- 관계 쌍(기록에서 — 변화 D 관계 · 마무리 O 관계 사슬 · 합류 H) ${R2.length}(지휘관이 낀 쌍 ${R2.filter((r) => r.a === 'person:지휘관' || r.b === 'person:지휘관').length} · 맺음 있는 쌍 ${R2.filter((r) => r.closures).length} · 합류에 든 쌍 ${R2.filter((r) => r.merges).length}), 관계 상대가 있는 인물 ${P.filter((p) => p.relations).length}.`);
  const withRec = P.filter((p) => p.facts + p.questions + p.echoes + p.life + p.baselines + p.changes);
  L.push(`- 기록이 다룬 인물 ${withRec.length} — 사실 ${sum('facts')} · 의문 ${sum('questions')}(열림 ${sum('open')} · 일부 ${sum('partial')} · 풀림 ${sum('solved')}) · 사건 ${sum('events')} · 떡밥 ${sum('echoes')} · 생활상 ${sum('life')} (기록 하나가 여러 인물을 다루면 인물마다 센다).`);
  L.push(`- 변화 — 인물 ${P.filter((p) => p.baselines + p.changes).length} · 기준 ${sum('baselines')} · 변화 ${sum('changes')}(작중 순서가 뒤바뀐 변화 ${sum('inverted')}) · 관계 상대로 나온 수 ${sum('with_others')}. 마무리가 있는 인물 ${P.filter((p) => p.closures).length} · 합류 결판에 든 인물 ${P.filter((p) => p.merges).length}.`);
  L.push(`- 줄기에 관여한 인물 ${P.filter((p) => p.threads).length}. 확정 전 기록을 센 인물 ${P.filter((p) => p.unconfirmed).length}.`);
  const impUnits = v.personUnits.filter((u) => u.imp);
  L.push(`- 사칭(정체 연결 impersonates — 이름표 주인 줄을 사칭한 인물에 옮겨 셈): ${[...new Set(impUnits.flatMap((u) => u.imp.split(' ')))].sort(compareIds).join(' · ') || '없음'}` +
    `${impUnits.length ? ` — 걸린 인물 × 단위 ${impUnits.length}(줄을 다 옮겨 드러나기 전 모습만 남은 것 ${impUnits.filter((u) => !u.scenes).length})` : ''}.`, '');

  const table = (title, xs, cols, head) => {
    L.push(`## ${title}`, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
    for (const p of xs) L.push(`| ${cols.map((c) => (typeof c === 'function' ? c(p) : p[c])).join(' | ')} |`);
    L.push('');
  };
  table(`등장 순위 (따로 두는 인물 빼고 위 ${TOP})`, plain.slice(0, TOP),
    ['name', 'scenes', 'units', 'speaker_lines', (p) => `${p.first_unit}(${p.first_tick})`, (p) => `${p.last_unit}(${p.last_tick})`, 'relations'],
    ['인물', '씬', '단위', '말한 줄', '처음(공개 자리)', '마지막', '관계 상대']);
  table('따로 두는 인물', P.filter((p) => p.common),
    ['name', 'common', 'spread', 'scenes', 'units', 'speaker_lines', 'relations'], ['인물', '왜', '중심 단위', '씬', '단위', '말한 줄', '관계 상대']);
  const byRec = [...P].filter((p) => p.facts + p.questions).sort((a, b) => b.facts + b.questions - (a.facts + a.questions) || a.target.localeCompare(b.target));
  table(`기록 순위 (사실 + 의문 위 ${TOP})`, byRec.slice(0, TOP),
    ['name', 'facts', 'questions', 'open', 'events', 'echoes', (p) => p.threads.split(' ').filter(Boolean).length, 'changes', (p) => p.closures.split(' ').filter(Boolean).length],
    ['인물', '사실', '의문', '열림', '사건', '떡밥', '줄기', '변화', '마무리']);
  const byChange = [...P].filter((p) => p.changes).sort((a, b) => b.changes - a.changes || a.target.localeCompare(b.target));
  table(`변화 순위 (위 ${TOP})`, byChange.slice(0, TOP), ['name', 'baselines', 'changes', 'aspects', 'with_others', 'inverted', 'closures', 'merges'],
    ['인물', '기준', '변화', '측면', '관계 상대', '뒤바뀜', '마무리', '합류']);
  const nIds = (x) => x.split(' ').filter(Boolean).length;
  const byRel = [...v.relations].filter((r) => !r.fool).sort((x, y) => nIds(y.changes) - nIds(x.changes) || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  table(`관계 쌍 (변화 많은 위 ${TOP})`, byRel.slice(0, TOP),
    ['a_name', 'b_name', (r) => nIds(r.changes), (r) => r.closures || '-', (r) => r.merges || '-', (r) => `${r.first_unit} → ${r.last_unit}`], ['인물', '인물', '변화', '맺음', '합류', '처음 → 마지막']);

  L.push('## 빈 곳', '');
  const thin = seen.filter((p) => !p.common && !(p.facts + p.questions + p.echoes + p.life + p.baselines + p.changes));
  L.push(`- 등장했지만 다룬 기록이 하나도 없는 인물 ${thin.length}/${seen.length}(${pct(thin.length, seen.length)}) — 씬 많은 순: ${thin.slice(0, 15).map((p) => `${p.name} ${p.scenes}`).join(' · ')}${thin.length > 15 ? ' …' : ''}. 등장만 보인다.`);
  const noApp = P.filter((p) => !p.scenes && p.facts + p.questions + p.changes);
  L.push(`- 기록은 있는데 등장 줄이 없는 인물 ${noApp.length}${noApp.length ? ` — ${noApp.map((p) => p.name).join(' · ')}` : ''} (이름이 안 걸리는 인물 — 언급 DB 사전 몫).`);
  const solo = seen.filter((p) => !p.common && p.changes + p.baselines && !p.relations);
  L.push(`- 변화 기록은 있는데 관계 상대가 없는 인물 ${solo.length}${solo.length ? ` — ${solo.slice(0, 15).map((p) => p.name).join(' · ')}${solo.length > 15 ? ' …' : ''}` : ''}.`);
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
  console.log(`인물 ${v.persons.length} · 등장 ${v.persons.filter((p) => p.scenes).length} · 관계 쌍 ${v.relations.length} · 기록 줄 ${v.personRecords.length}${v.problems.length ? ` · 문제 ${v.problems.length}` : ''}`);
}
