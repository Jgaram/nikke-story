/**
 * X3f-1d — 빌드업 마무리(T3-6 · T4-8). 오래 쌓인 것이 어디서 끝나는가 — 판정 입력(⑦ — tools/views/layers.mjs) · 화면 3 떡밥 흐름 · 화면 5 인물 곡선(docs/views.md).
 * 사용자(2026-10-09): 기준 · 판정 입력이 새 사실 · 연결만 보고 빌드업의 마무리를 재지 않는다. 셋 다 중요하다 —
 *   (가) 오래 쌓인 의문 · 복선이 풀림 · (나) 연작 · 갈등의 결판 · (다) 인물 관계 · 성장의 끝.
 *
 *   node tools/views/closures.mjs             → data/views/closures/ (buildup.csv · closures.csv · chains.csv · merges.csv · report.md — 커밋한다, draft.mjs도 같이 부른다)
 *   node tools/views/closures.mjs --example   예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   단위 하나: node tools/records.mjs layers <단위> (⑦) · 사슬과 마무리 기록: node tools/records.mjs closures [O… | 단위] [--add]
 *
 * (가) 기계 — 척추 선정 ⓒ(tools/views/spine.mjs)와 같은 계산을 모든 단위로(공개 단계 — tools/views/reveal.mjs revealStages):
 *   긴 회수   다른 단위가 제기한 의문을 제기 뒤 공개 자리 gap칸(척추 criteria.payoff_gap, 기본 20) 이상 지나 여기서 전부 회수
 *   복선의 답  다른 단위가 먼저(rel 앞) 흘린 2회독 암시의 사실이 여기서 처음 밝혀짐
 *   줄마다 쌓은 쪽(제기 단위 · 암시 단위)이 척추인지 단다 — 판정 입력은 척추가 쌓은 것을 따로 센다(척추 = 메인 챕터 + annotations/spine.json 확정).
 * (나) · (다) 해석 — 마무리 기록 annotations/closures.json(O<n> — 형식 docs/annotations.md "마무리 기록"). 기계는 사슬(초안)만 낸다:
 *   연작   annotations/links.json 다음 편(sequel, 확정)으로 이은 사슬마다 마지막 편(뒤 편이 없는 편) — 쌓인 자리 = 앞 편들
 *   관계   2회독 인물 변화 D 관계 — 두 인물 쌍(양쪽 방향을 합친다)의 기록이 단위 둘 이상에 걸치고 변화가 둘 이상
 *   성장   D 성격 · 신념 — 인물 · 측면마다 같은 문턱
 *   초안의 끝 = 마지막 변화가 드러난 단위(닫는 기록 = 그 단위의 변화). 갈등은 기계로 가르지 않는다 — 관계 사슬 · 연작을 볼 때 Claude가 type을 갈등으로 고친다.
 *   Claude가 사슬마다 끝이 있는지 보고 확정(끝난 자리 · 닫는 기록 · 문장 고침) · 기각(아직 끝나지 않음 · 쌓인 것이 없음)한다(CLAUDE.md "해석이 필요한 기록").
 * 척추가 쌓은 마무리 = 쌓인 자리(built — 기록의 단위나 단위 키) 가운데 끝 단위가 아닌 척추 단위가 있다.
 * 합류(X3f-1g) — 한 결판(결전 · 무대 · 연작의 결판 편 · 한 니케의 호감도 마지막 편)에서 함께 끝난 마무리 기록 둘 이상을 합류 기록 H로 묶는다(annotations/closures.json merges, Claude가 확정).
 *   화면 3 · 5는 묶인 끝을 한 이야기의 끝 하나로 그린다 — 셋 이상의 관계(쌍 사슬마다 같은 닫는 기록)도 여기서 하나가 된다. 판정 입력 ⑦은 낱낱의 O를 그대로 센다(묶어도 수가 같다).
 * 같은 기록이면 같은 결과다(정렬 끝까지 결정적). 원문 대사는 담지 않는다 — 기록 문장(Claude가 쓴 요약)만.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, compareIds, displayPath, loadDataset, spineUnits } from '../records/model.mjs';
import { kindOfKey, loadOrder } from '../records/order.mjs';
import { comparePlace, recordPlace, scenePlaces } from '../records/read2.mjs';
import { releasePlaces, revealStages } from './reveal.mjs';

export const CLOSURES_DIR = path.join(ROOT, 'data/views/closures');
/** 마무리 기록의 종류 — (나) 연작 · 갈등, (다) 관계 · 성장 */
export const CLOSURE_TYPES = ['연작', '갈등', '관계', '성장'];
/** (다) 성장으로 보는 인물 변화 측면 */
export const GROWTH_ASPECTS = ['성격', '신념'];
/** 긴 회수의 기본 칸 수 — 척추 criteria.payoff_gap이 이긴다 */
export const DEFAULT_GAP = 20;
const arr = (x) => (Array.isArray(x) ? x : []);

/** 척추 단위인가 — 메인 챕터 + 척추 이벤트 · 사이드 */
export const spineTest = (spine) => (u) => kindOfKey(u) === '메인' || spine.has(u);

/**
 * (가) 단위마다 긴 회수 · 복선의 답
 * @returns {{ gap: number, rows: object[], byUnit: Map<string, { payoffList: object[], answerList: object[] }> }}
 *   payoffList[i] = { root, record, from, gap, spine(제기 단위가 척추) }, answerList[i] = { root, hints: ['E12@ch04' …], spineHints(척추 단위의 암시 수) }
 *   rows = 화면용 한 줄씩(buildup.csv)
 */
export function buildupMetrics(ds, ctx, order, { gap, spine = spineUnits(ds), rel = releasePlaces(ctx, order), st = revealStages(ds, ctx, order, rel) } = {}) {
  const g = gap ?? ds.spine?.data?.criteria?.payoff_gap ?? DEFAULT_GAP;
  const isSpine = spineTest(spine);
  const byRoot = new Map();
  for (const r of st.rows) (byRoot.get(r.root) ?? byRoot.set(r.root, []).get(r.root)).push(r);
  const byUnit = new Map();
  const U = (u) => byUnit.get(u) ?? byUnit.set(u, { payoffList: [], answerList: [] }).get(u);
  for (const [root, rows] of byRoot) {
    const first = rows.find((r) => r.stage === '제기' || r.stage === '처음 밝혀짐');
    if (!first) continue;
    if (rows[0].kind === '의문') {
      for (const r of rows) {
        if (r.stage !== '회수' || r.unit === first.unit || r.tick - first.tick < g) continue;
        U(r.unit).payoffList.push({ root, record: r.record, from: first.unit, gap: r.tick - first.tick, spine: isSpine(first.unit) });
      }
    } else {
      const hinted = rows.filter((r) => r.stage === '암시' && r.rel === '앞');
      if (!hinted.length) continue;
      for (const u of new Set(rows.filter((r) => r.stage === '처음 밝혀짐').map((r) => r.unit))) {
        const others = hinted.filter((h) => h.unit !== u);
        if (others.length) U(u).answerList.push({ root, hints: others.map((h) => `${h.record}@${h.unit}`), spineHints: others.filter((h) => isSpine(h.unit)).length });
      }
    }
  }
  const text = new Map(st.roots.map((r) => [r.id, r.text]));
  const rows = [];
  for (const [unit, v] of byUnit) {
    v.payoffList.sort((a, b) => compareIds(a.root, b.root));
    v.answerList.sort((a, b) => compareIds(a.root, b.root));
    const tick = rel.byUnit.get(unit)?.tick ?? '';
    for (const p of v.payoffList) rows.push({ unit, tick, type: '긴 회수', root: p.root, record: p.record, from: p.from, gap: p.gap, spine_built: p.spine ? 1 : '', hints: '', text: text.get(p.root) ?? '' });
    for (const a of v.answerList) rows.push({ unit, tick, type: '복선의 답', root: a.root, record: '', from: '', gap: '', spine_built: a.spineHints ? 1 : '', hints: a.hints.join(' '), text: text.get(a.root) ?? '' });
  }
  rows.sort((a, b) => (Number(a.tick) || 0) - (Number(b.tick) || 0) || String(a.unit).localeCompare(String(b.unit)) || a.type.localeCompare(b.type) || compareIds(a.root, b.root));
  return { gap: g, rows, byUnit };
}

/**
 * (나) · (다) 사슬(초안)과 마무리 기록(O)
 * @returns {{ chains: object[], closures: object[], byEnd: Map<string, object[]>, missing: object[], merges: object[], mergeOf: Map<string, string[]>, problems: string[] }}
 *   chains[i] = { key, type, about[], records[{id, act, unit, tick, text}], units[], built[], end, endTick, closing[], span, spineBuilt, endSpine, closure(O 후보|null) }
 *   closures[i] = { c(O 후보), type, end, endTick, builtUnits[], spineBuilt, span, chain }
 *   merges[i] = { c(H 후보), title, end, endTick, members[](O ID), types[], persons[](멤버 about 합 — 지휘관 빼고), span(멤버 가운데 가장 긴), spineBuilt } · mergeOf: O ID → 살아 있는 H ID들
 */
export function closureChains(ds, ctx, order, { spine = spineUnits(ds), rel = releasePlaces(ctx, order) } = {}) {
  const problems = [];
  const isSpine = spineTest(spine);
  const places = scenePlaces(order, ctx);
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byId = new Map(live.map((c) => [c.id, c]));
  const tickOf = (u) => rel.byUnit.get(u)?.tick ?? null;
  const posOf = (u) => rel.byUnit.get(u)?.order ?? Infinity;
  const chains = [];

  // 연작 — 다음 편 사슬의 마지막 편
  const next = new Map();
  const prev = new Map();
  for (const e of live.filter((c) => c.kind === 'edge' && c.status === '확정' && c.obj?.type === 'sequel' && !c.obj?.drop)) {
    (next.get(e.obj.from) ?? next.set(e.obj.from, new Set()).get(e.obj.from)).add(e.obj.to);
    (prev.get(e.obj.to) ?? prev.set(e.obj.to, new Set()).get(e.obj.to)).add(e.obj.from);
  }
  for (const sink of [...prev.keys()].filter((u) => !next.has(u))) {
    const seen = new Set();
    const stack = [...prev.get(sink)];
    while (stack.length) {
      const u = stack.pop();
      if (seen.has(u)) continue;
      seen.add(u);
      for (const p of prev.get(u) ?? []) stack.push(p);
    }
    const built = [...seen].sort((a, b) => posOf(a) - posOf(b) || a.localeCompare(b));
    chains.push({ key: `연작 ${sink}`, type: '연작', about: [], records: [], units: [...built, sink], built, end: sink, closing: [] });
  }

  // 관계 · 성장 — 인물 변화 D 사슬
  const groups = new Map();
  const add = (key, type, about, c) => (groups.get(key) ?? groups.set(key, { key, type, about, list: [] }).get(key)).list.push(c);
  for (const c of live.filter((x) => x.kind === 'change' && x.unit)) {
    const o = c.obj ?? {};
    if (!o.person) continue;
    // 관계는 상대마다(with는 배열 — 상대가 여럿이면 쌍마다 든다), 양쪽 방향을 한 쌍으로
    if (o.aspect === '관계') {
      for (const w of arr(o.with).filter((x) => x && x !== o.person)) {
        const about = [o.person, w].sort();
        add(`관계 ${about.join(' ↔ ')}`, '관계', about, c);
      }
    } else if (GROWTH_ASPECTS.includes(o.aspect)) add(`성장 ${o.person} ${o.aspect}`, '성장', [o.person], c);
  }
  for (const g of groups.values()) {
    const at = (c) => [posOf(c.unit), ...(recordPlace(places, c) ?? [Infinity]).slice(1)];
    g.list.sort((a, b) => comparePlace(at(a), at(b)) || compareIds(a.id, b.id));
    const changes = g.list.filter((c) => c.act === '변화');
    const units = [...new Set(g.list.map((c) => c.unit))];
    if (changes.length < 2 || units.length < 2) continue;
    const end = changes.at(-1).unit;
    const closing = changes.filter((c) => c.unit === end).map((c) => c.id);
    // 쌓인 자리 = 끝 단위보다 앞의 기록(끝 뒤에 적힌 기준 — 층별로 읽어 뒤에 만난 처음 모습 — 은 뺀다)
    const built = g.list.filter((c) => !closing.includes(c.id) && posOf(c.unit) <= posOf(end) && c.unit !== end).map((c) => c.id);
    chains.push({
      key: g.key, type: g.type, about: g.about, units, built, end, closing,
      records: g.list.map((c) => ({ id: c.id, act: c.act, unit: c.unit, tick: tickOf(c.unit), with: arr(c.obj?.with).join(' · '), person: c.obj?.person ?? '', aspect: c.obj?.aspect ?? '',
        text: c.obj?.text ?? (c.obj?.before && c.obj?.after ? `${c.obj.before} → ${c.obj.after}` : c.text ?? '') })),
    });
  }

  // 쌓인 자리의 단위 — 기록 ID면 그 기록의 단위, 단위 키면 그대로
  const unitOfItem = (x) => (byId.has(x) ? byId.get(x).unit ?? byId.get(x).spineUnit ?? null : rel.byUnit.has(x) ? x : null);
  const span = (builtUnits, end) => {
    const ts = builtUnits.map(tickOf).filter((t) => t != null);
    return ts.length && tickOf(end) != null ? tickOf(end) - Math.min(...ts) : '';
  };
  const recorded = ds.candidates.filter((c) => c.kind === 'closure' && c.id);
  const byChain = new Map();
  for (const c of recorded) if (c.obj?.chain) (byChain.get(c.obj.chain) ?? byChain.set(c.obj.chain, []).get(c.obj.chain)).push(c);
  for (const ch of chains) {
    ch.endTick = tickOf(ch.end);
    ch.span = span(ch.built.map(unitOfItem).filter(Boolean), ch.end);
    ch.spineBuilt = ch.built.map(unitOfItem).some((u) => u && u !== ch.end && isSpine(u));
    ch.endSpine = isSpine(ch.end);
    const rec = byChain.get(ch.key) ?? [];
    ch.closure = rec.find((c) => c.status !== '기각') ?? rec[0] ?? null;
  }
  chains.sort((a, b) => (a.endTick ?? Infinity) - (b.endTick ?? Infinity) || CLOSURE_TYPES.indexOf(a.type) - CLOSURE_TYPES.indexOf(b.type) || a.key.localeCompare(b.key));

  const closures = recorded.map((c) => {
    const o = c.obj ?? {};
    const builtUnits = [...new Set(arr(o.built).map(unitOfItem).filter(Boolean))];
    for (const x of arr(o.built)) if (!unitOfItem(x)) problems.push(`${c.id}: 쌓인 자리 ${x}가 기록도 단위도 아니다(기각됐거나 빠짐)`);
    return { c, type: o.type ?? '', end: o.end ?? '', endTick: tickOf(o.end), builtUnits, spineBuilt: builtUnits.some((u) => u !== o.end && isSpine(u)), span: span(builtUnits, o.end), chain: o.chain ?? '' };
  });
  closures.sort((a, b) => (a.endTick ?? Infinity) - (b.endTick ?? Infinity) || compareIds(a.c.id, b.c.id));
  const byEnd = new Map();
  for (const x of closures) if (x.c.status !== '기각') (byEnd.get(x.end) ?? byEnd.set(x.end, []).get(x.end)).push(x);
  const missing = chains.filter((ch) => !ch.closure);

  // 합류 — 한 결판에서 함께 끝난 마무리 기록 묶음
  const closureById = new Map(closures.map((x) => [x.c.id, x]));
  const mergeOf = new Map();
  const merges = ds.candidates.filter((c) => c.kind === 'merge' && c.id).map((c) => {
    const o = c.obj ?? {};
    const members = arr(o.members);
    const ms = members.map((id) => closureById.get(id)).filter(Boolean);
    for (const id of members) if (!closureById.has(id)) problems.push(`${c.id}: 함께 끝난 마무리 ${id}가 없다`);
    if (c.status !== '기각') for (const id of members) (mergeOf.get(id) ?? mergeOf.set(id, []).get(id)).push(c.id);
    const spans = ms.map((x) => x.span).filter((n) => n !== '');
    return {
      c, title: o.title ?? '', end: o.end ?? '', endTick: tickOf(o.end), members,
      types: [...new Set(ms.map((x) => x.type))].sort((a, b) => CLOSURE_TYPES.indexOf(a) - CLOSURE_TYPES.indexOf(b)),
      persons: [...new Set(ms.flatMap((x) => arr(x.c.obj?.about)))].filter((p) => p !== 'person:지휘관').sort(),
      span: spans.length ? Math.max(...spans) : '', spineBuilt: ms.some((x) => x.spineBuilt),
    };
  });
  merges.sort((a, b) => (a.endTick ?? Infinity) - (b.endTick ?? Infinity) || compareIds(a.c.id, b.c.id));
  return { chains, closures, byEnd, missing, merges, mergeOf, problems };
}

/** 사슬 하나를 마무리 기록 후보로 — records.mjs closures --add */
export function draftClosure(ch, id) {
  const reason = ch.type === '연작'
    ? `(초안) 다음 편 사슬 ${ch.built.join(' → ')} → ${ch.end}의 마지막 편`
    : `(초안) ${ch.records.length}건 · 단위 ${ch.units.length} · 변화 ${ch.records.filter((r) => r.act === '변화').length}, 마지막 변화 ${ch.closing.join(' ')}@${ch.end}`;
  const text = ch.type === '연작' ? `(초안) 연작 ${[...ch.built, ch.end].join(' → ')}의 결판` : `(초안) ${ch.key}의 끝`;
  return {
    id, type: ch.type, chain: ch.key, ...(ch.about.length ? { about: ch.about } : {}), text, built: ch.built, end: ch.end,
    ...(ch.closing.length ? { closing: ch.closing } : {}), reason, confidence: '추정', status: '후보',
  };
}

/** 사슬 하나 — 사람이 보는 줄들(review · closures 명령) */
export function renderChain(ch, { title = (u) => '' } = {}) {
  const L = [];
  L.push(`## ${ch.key}${ch.closure ? ` — ${ch.closure.id} ${ch.closure.status}` : ' — (기록 없음)'} · 끝 ${ch.end}${ch.endSpine ? '(척추)' : ''} · ${ch.span}칸${ch.spineBuilt ? ' · 척추가 쌓음' : ''}`);
  if (ch.type === '연작') L.push(`  편: ${[...ch.built, ch.end].map((u) => `${u}${title(u) ? ` ${title(u)}` : ''}`).join(' → ')}`);
  for (const r of ch.records) L.push(`  ${r.id} ${r.act} ${r.unit}@${r.tick ?? '?'}${r.with ? ` ${r.person}→${r.with}` : r.aspect ? ` ${r.aspect}` : ''} — ${r.text}`);
  return L.join('\n');
}

/** 보고서 */
export function renderClosuresReport(b, v, { source = '' } = {}) {
  const L = [];
  const live = v.closures.filter((x) => x.c.status !== '기각');
  const t = (s) => v.closures.filter((x) => x.c.status === s).length;
  L.push('# 빌드업 마무리 (X3f-1d)', '');
  L.push(`출처: ${source}(1회독 · 2회독 기록 · annotations/closures.json · links.json) — 규칙 tools/views/closures.mjs 머리말, 형식 docs/annotations.md "마무리 기록", 쓰는 곳 docs/views.md 화면 1 · 3 · 5.`, '');
  L.push(`- (가) 긴 회수(제기 뒤 ${b.gap}칸 이상 지나 전부 회수) ${b.rows.filter((r) => r.type === '긴 회수').length}줄 · 복선의 답 ${b.rows.filter((r) => r.type === '복선의 답').length}줄 — 단위 ${b.byUnit.size}. 척추가 쌓은 것 ${b.rows.filter((r) => r.spine_built).length}줄.`);
  L.push(`- (나) · (다) 사슬(초안) ${v.chains.length} — ${CLOSURE_TYPES.map((x) => `${x} ${v.chains.filter((c) => c.type === x).length}`).filter((s) => !/ 0$/.test(s)).join(' · ')} · 척추가 쌓음 ${v.chains.filter((c) => c.spineBuilt).length} · 기록 없음 ${v.missing.length}`);
  L.push(`- 마무리 기록(O) ${v.closures.length} — 확정 ${t('확정')} · 기각 ${t('기각')} · 후보 ${t('후보')}. 확정 · 후보 가운데 척추가 쌓고 척추 밖에서 끝남 ${live.filter((x) => x.spineBuilt && !spineTestEnd(x)).length}.`);
  const liveMerges = v.merges.filter((m) => m.c.status !== '기각');
  L.push(`- 합류 기록(H) ${v.merges.length} — 확정 ${v.merges.filter((m) => m.c.status === '확정').length} · 기각 ${v.merges.filter((m) => m.c.status === '기각').length} · 후보 ${v.merges.filter((m) => m.c.status === '후보').length}. 묶인 마무리 ${new Set(liveMerges.flatMap((m) => m.members)).size}.`, '');
  if (v.merges.length) {
    L.push('## 합류 — 한 결판에서 함께 끝난 마무리 (화면 3 · 5의 한 이야기의 끝)', '');
    L.push('| ID | 상태 | 끝 | 결판 | 마무리 | 종류 | 인물 | 문장 |', '|---|---|---|---|---|---|---|---|');
    for (const m of v.merges) {
      L.push(`| ${m.c.id} | ${m.c.status} | \`${m.end}\` | ${m.title.replace(/\|/g, '/')} | ${m.members.join(' ')} | ${m.types.join(' · ')} | ${m.persons.map((p) => p.replace(/^person:/, '')).join(' · ')} | ${String(m.c.obj?.text ?? '').replace(/\|/g, '/')} |`);
    }
    L.push('');
  }
  L.push('## (나) · (다) 마무리 기록 — 끝난 자리 순', '');
  L.push('| ID | 종류 | 상태 | 끝 | 쌓인 자리 | 칸 | 척추가 쌓음 | 합류 | 문장 |', '|---|---|---|---|---|---:|---|---|---|');
  for (const x of v.closures) {
    const o = x.c.obj ?? {};
    L.push(`| ${x.c.id} | ${x.type} | ${x.c.status} | \`${x.end}\` | ${x.builtUnits.filter((u) => u !== x.end).slice(0, 6).join(' · ')}${x.builtUnits.length > 7 ? ' …' : ''} | ${x.span} | ${x.spineBuilt ? '○' : ''} | ${(v.mergeOf.get(x.c.id) ?? []).join(' ')} | ${String(o.text ?? '').replace(/\|/g, '/')} |`);
  }
  if (!v.closures.length) L.push('| (없음) | | | | | | | | |');
  if (v.missing.length) {
    L.push('', `## 기록 없는 사슬 ${v.missing.length} — \`node tools/records.mjs closures --add\`로 후보를 만든다`, '');
    for (const ch of v.missing) L.push(`- ${ch.key} — 끝 \`${ch.end}\` · ${ch.span}칸${ch.spineBuilt ? ' · 척추가 쌓음' : ''}`);
  }
  L.push('', '## (가) 단위마다 긴 회수 · 복선의 답 — 척추 밖 단위는 판정 입력 ⑦에 뜬다', '');
  const units = [...b.byUnit.entries()].sort((a, c) => (v.tickOf(a[0]) ?? 0) - (v.tickOf(c[0]) ?? 0) || a[0].localeCompare(c[0]));
  for (const [u, x] of units) {
    const pay = x.payoffList.map((p) => `${p.root}(${p.from}${p.spine ? '·척추' : ''}, ${p.gap}칸 뒤 ${p.record})`).join(' · ');
    const ans = x.answerList.map((a) => `${a.root}(← ${a.hints.slice(0, 2).join(' ')}${a.hints.length > 2 ? ` 외 ${a.hints.length - 2}` : ''})`).join(' · ');
    L.push(`- \`${u}\`${v.isSpine(u) ? ' (척추)' : ''} — 긴 회수 ${x.payoffList.length}${pay ? `: ${pay}` : ''} · 복선의 답 ${x.answerList.length}${ans ? `: ${ans}` : ''}`);
  }
  if (v.problems.length) L.push('', '## 문제', '', ...v.problems.map((p) => `- ${p}`));
  return L.join('\n') + '\n';

  function spineTestEnd(x) {
    return v.isSpine(x.end);
  }
}

function csvCell(x) {
  const s = x == null ? '' : Array.isArray(x) ? x.join(' ') : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
const BUILDUP_COLUMNS = ['unit', 'tick', 'type', 'root', 'record', 'from', 'gap', 'hints', 'spine_built', 'text'];
const CLOSURE_COLUMNS = ['id', 'type', 'status', 'confidence', 'by', 'end', 'end_tick', 'built_units', 'span', 'spine_built', 'end_spine', 'closing', 'about', 'chain', 'merge', 'text', 'reason'];
const MERGE_COLUMNS = ['id', 'title', 'status', 'confidence', 'by', 'end', 'end_tick', 'members', 'types', 'persons', 'span', 'spine_built', 'text', 'reason'];
const CHAIN_COLUMNS = ['key', 'type', 'end', 'end_tick', 'span', 'spine_built', 'end_spine', 'units', 'records', 'closing', 'closure', 'status'];

export function writeClosuresViews(b, v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'buildup.csv'), csv(BUILDUP_COLUMNS, b.rows));
  fs.writeFileSync(path.join(outDir, 'closures.csv'), csv(CLOSURE_COLUMNS, v.closures.map((x) => {
    const o = x.c.obj ?? {};
    return { id: x.c.id, type: x.type, status: x.c.status, confidence: x.c.confidence, by: x.c.by, end: x.end, end_tick: x.endTick, built_units: x.builtUnits.filter((u) => u !== x.end),
      span: x.span, spine_built: x.spineBuilt ? 1 : '', end_spine: v.isSpine(x.end) ? 1 : '', closing: arr(o.closing), about: arr(o.about), chain: x.chain, merge: v.mergeOf.get(x.c.id) ?? [], text: o.text ?? '', reason: x.c.reason ?? '' };
  })));
  fs.writeFileSync(path.join(outDir, 'merges.csv'), csv(MERGE_COLUMNS, v.merges.map((m) => ({
    id: m.c.id, title: m.title, status: m.c.status, confidence: m.c.confidence, by: m.c.by, end: m.end, end_tick: m.endTick, members: m.members, types: m.types, persons: m.persons,
    span: m.span, spine_built: m.spineBuilt ? 1 : '', text: m.c.obj?.text ?? '', reason: m.c.reason ?? '' }))));
  fs.writeFileSync(path.join(outDir, 'chains.csv'), csv(CHAIN_COLUMNS, v.chains.map((ch) => ({ ...ch, end_tick: ch.endTick, spine_built: ch.spineBuilt ? 1 : '', end_spine: ch.endSpine ? 1 : '',
    records: ch.type === '연작' ? '' : ch.records.map((r) => r.id), closure: ch.closure?.id ?? '', status: ch.closure?.status ?? '' }))));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderClosuresReport(b, v, opts));
  return ['buildup.csv', 'closures.csv', 'chains.csv', 'merges.csv', 'report.md'];
}

/** 한 번에 — draft.mjs · records.mjs가 부른다 */
export function buildClosures(ds, ctx, order) {
  const spine = spineUnits(ds);
  const rel = releasePlaces(ctx, order);
  const b = buildupMetrics(ds, ctx, order, { spine, rel });
  const v = closureChains(ds, ctx, order, { spine, rel });
  v.isSpine = spineTest(spine);
  v.tickOf = (u) => rel.byUnit.get(u)?.tick ?? null;
  return { b, v };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({ options: { example: { type: 'boolean' }, dir: { type: 'string' }, out: { type: 'string' } } });
  const dir = path.resolve(ROOT, opt.example ? EXAMPLE_DIR : opt.dir ?? READ1_DIR);
  const ds = loadDataset({ dir });
  for (const p of ds.problems) console.error(`⚠ ${p.file}: ${p.msg}`);
  const ctx = await openContext();
  const order = loadOrder();
  const { b, v } = buildClosures(ds, ctx, order);
  const source = displayPath(dir) + '/';
  if (dir === path.resolve(READ1_DIR) || opt.out) {
    const out = opt.out ? path.resolve(ROOT, opt.out) : CLOSURES_DIR;
    const files = writeClosuresViews(b, v, out, { source });
    console.log(`${displayPath(out)}/ ← ${files.join(' · ')}`);
  } else console.log(renderClosuresReport(b, v, { source }));
  console.log(`(가) ${b.rows.length}줄 · 단위 ${b.byUnit.size} · 사슬 ${v.chains.length}(기록 없음 ${v.missing.length}) · 마무리 기록 ${v.closures.length} · 합류 기록 ${v.merges.length}`);
  ctx.close();
}
