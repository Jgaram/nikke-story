/**
 * X1a — 공개 축: 공개 자리 · 진실 공개 단계 · 컷오프("여기까지 읽은 사람이 아는 것"). 화면 · 칸은 docs/views.md "공개 축 (X1a)".
 * 원문은 읽지 않는다. 시트는 쓰지 않는다(docs/reference-table.md). 새 해석을 하지 않는다 — 기록과 공개일에서 기계적으로 낸다.
 *
 * 공개 자리(tick) — 같은 날 공개는 같은 자리(사용자: 같은 날 나온 단위끼리의 순서는 정하지 않았다 → 동시로 계산):
 *   - 읽는 순서(SESSIONS.md R 항목, 출시순 한 줄)를 따라가며 공개일(DB releases)이 바뀌면 자리를 하나 올린다.
 *   - 같은 날 메인 챕터가 여럿이면(출시 첫날 CH.00–16) 챕터마다 자리가 갈린다 — 게임이 챕터를 차례로 연다(게임 진행, 같은 날 순서를 고른 게 아니다).
 *   - 같은 날의 사이드 · 이벤트 · 호감도 스토리는 그날 마지막 챕터와 같은 자리다(그날 챕터가 없으면 그날 자리 하나).
 *   - 공개일이 없는 단위(서브퀘스트 · 유실물 · 엘리베이터 · 이벤트 유실물)는 읽는 순서에서 바로 앞 공개 단위(딸린 챕터 · 이벤트)의 자리를 물려받는다(결정 #9).
 *
 * 진실 공개 단계 — 기록하지 않고 여기서 계산한다(결정 #8, T4-2). 한 줄 = 기록 하나가 사실 · 의문 하나에 하는 일:
 *   사실(F<n>, 뿌리 = 정의):  드러냄(정의 · F<n>-k 드러냄) → 처음 밝혀짐 | 보강,  F<n>-k 뒤집음 → 뒤집힘,  2회독 E 암시 → 암시 · 재언급 → 재언급
 *     처음 밝혀짐 = 드러냄 가운데 공개 자리가 가장 앞인 것. 같은 자리의 다른 단위도 처음 밝혀짐(동시), 같은 단위 안 뒤 드러냄은 보강.
 *   의문(Q<n>):  정의 → 제기,  Q<n>-k 회수 일부 → 일부 회수 · 전부 → 회수,  E 암시 · 재언급 → 암시 · 재언급
 *   E가 사건(F<n>-k · Q<n>-k)을 가리키면 그 뿌리의 줄이 된다. 줄기(J)만 가리키는 E는 뿌리 줄이 없다(줄기 화면 몫).
 *   rel = 뿌리의 첫 자리(사실: 처음 밝혀짐 · 의문: 제기)와 견준 이 줄의 자리 — 앞 · 동시 · 뒤.
 * 기각된 기록은 뺀다. 후보는 넣되 status를 남긴다(확정값처럼 쓰지 않는다). 같은 기록이면 같은 결과(정렬 끝까지 결정적).
 */
import { compareIds, isRecord } from '../records/model.mjs';
import { kindOfKey } from '../records/order.mjs';
import { comparePlace, recordPlace, scenePlaces } from '../records/read2.mjs';
import { threadMembership } from '../records/threads.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const firstScene = (c) => arr(c?.evidence)[0]?.scene ?? null;

/**
 * 단위마다 읽는 자리 · 공개 자리 · 공개일
 * @param {object} ctx openContext()
 * @param {{ items: object[] }} order loadOrder() — 1회독 읽기 순서(R)
 * @returns {{ units: object[], byUnit: Map<string, object>, ticks: object[], problems: string[] }}
 *   units[i] = { order, unit, kind, tick, date, rank, basis, confidence, via: '공개일'|'딸림', from }
 *   ticks[i] = { tick, date, main, units[] } — main: 그 자리의 메인 챕터 키(없으면 '')
 */
export function releasePlaces(ctx, order) {
  const problems = [];
  const rows = ctx.db.prepare('SELECT key, kind, rank, date, basis, confidence FROM releases').all();
  const relOf = new Map(rows.map((r) => [r.key, r]));
  // 블라링크 이벤트가 본문 없이 금서고로 대신되면(event_forrest → fl:for_rest) 읽기 단위는 금서고 키다
  for (const u of ctx.units) if (u.gameKey && !relOf.has(u.key) && relOf.has(u.gameKey)) relOf.set(u.key, relOf.get(u.gameKey));
  const units = [];
  const byUnit = new Map();
  let tick = 0;
  let curDate = null;
  let mainSeen = false;
  let last = null; // 바로 앞 공개 단위
  for (const it of order.items) {
    if (byUnit.has(it.key)) continue; // 파트를 나눠 읽은 단위는 하나로
    const kind = kindOfKey(it.key);
    const r = relOf.get(it.key);
    let row;
    if (r?.date) {
      if (curDate && r.date < curDate) problems.push(`${it.key}: 공개일 ${r.date}이 앞 단위(${last?.unit} ${curDate})보다 이르다 — 읽는 순서와 공개일이 어긋난다`);
      if (r.date !== curDate) {
        tick++;
        curDate = r.date;
        mainSeen = false;
      } else if (kind === '메인' && mainSeen) tick++;
      if (kind === '메인') mainSeen = true;
      row = { unit: it.key, kind, tick, date: r.date, rank: r.rank, basis: r.basis ?? '', confidence: r.confidence ?? '', via: '공개일', from: '' };
      last = row;
    } else {
      if (!last) {
        problems.push(`${it.key}: 공개일이 없고 앞에 물려받을 공개 단위도 없다`);
        continue;
      }
      // 서브퀘스트 · 유실물(이벤트 유실물 포함) · 엘리베이터만 딸린다 — 나머지는 공개일이 있어야 한다
      if (['메인', '사이드', '이벤트', '호감도'].includes(kind)) problems.push(`${it.key}: 공개일이 없다(DB releases) — 앞 단위 ${last.unit}의 자리를 물려받았다`);
      row = { unit: it.key, kind, tick: last.tick, date: last.date, rank: last.rank, basis: '딸림', confidence: last.confidence, via: '딸림', from: last.unit };
    }
    row.order = byUnit.size + 1;
    byUnit.set(it.key, row);
    units.push(row);
  }
  const ticks = [];
  for (const u of units) {
    let t = ticks[u.tick - 1];
    if (!t) t = ticks[u.tick - 1] = { tick: u.tick, date: u.date, main: '', units: [] };
    t.units.push(u.unit);
    if (u.kind === '메인') t.main = u.unit;
  }
  return { units, byUnit, ticks, problems };
}

/**
 * 진실 공개 단계 — 사실 · 의문(뿌리)마다 그 기록들의 줄과 뿌리 요약
 * @param {object} ds loadDataset()
 * @param {object} ctx openContext()
 * @param {{ items: object[] }} order loadOrder()
 * @param {ReturnType<typeof releasePlaces>} [rel]
 * @returns {{ rows: object[], roots: object[], byRoot: Map<string, object>, problems: string[] }}
 */
export function revealStages(ds, ctx, order, rel = releasePlaces(ctx, order)) {
  const problems = [];
  const places = scenePlaces(order, ctx);
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byId = new Map(live.map((c) => [c.id, c]));
  const mem = threadMembership(ds);
  const rootOf = (c) => (c.role === 'event' ? byId.get(c.parent) ?? null : c);

  /** 기록의 자리 — 근거 첫 씬의 단위 · 공개 자리 · 읽는 자리 */
  const placeOf = (c) => {
    const scene = firstScene(c);
    const unit = places.unitOf(scene);
    const u = unit ? rel.byUnit.get(unit) : null;
    const pos = recordPlace(places, c);
    return u && pos ? { scene, unit, tick: u.tick, date: u.date, order: u.order, pos } : null;
  };

  // 뿌리마다 줄을 모은다
  const lines = new Map(); // 뿌리 ID → [{ c, act, point, place }]
  const push = (root, c, act, point) => {
    const place = placeOf(c);
    if (!place) {
      problems.push(`${c.id}: 근거 씬 ${firstScene(c) ?? '(없음)'}의 자리가 없다(읽는 순서 밖)`);
      return;
    }
    (lines.get(root.id) ?? lines.set(root.id, []).get(root.id)).push({ c, act, point, place });
  };
  for (const c of live.filter(isRecord)) {
    if (c.kind === 'fact' && c.role === 'def') push(c, c, '드러냄', '');
    else if (c.kind === 'question' && c.role === 'def') push(c, c, '제기', '');
    else if (c.role === 'event' && ['fact', 'question'].includes(c.kind)) {
      const root = rootOf(c);
      if (!root) problems.push(`${c.id}: 부모 ${c.parent}가 없다(기각됐거나 빠짐)`);
      else push(root, c, c.act, '');
    }
  }
  for (const e of live.filter((c) => c.kind === 'echo')) {
    const seen = new Set();
    for (const p of arr(e.obj?.points)) {
      const r = byId.get(p);
      if (!r || !['fact', 'question'].includes(r.kind) || !isRecord(r)) continue; // 줄기 · 사건 인물 등
      const root = rootOf(r);
      if (!root || seen.has(root.id)) continue; // 한 E가 같은 뿌리의 정의 · 사건을 함께 가리키면 한 줄
      seen.add(root.id);
      push(root, e, e.act, p);
    }
  }

  const rows = [];
  const roots = [];
  for (const [rootId, ls] of lines) {
    const root = byId.get(rootId);
    const isFact = root.kind === 'fact';
    ls.sort((a, b) => a.place.tick - b.place.tick || comparePlace(a.place.pos, b.place.pos) || compareIds(a.c.id, b.c.id));
    // 첫 자리: 사실은 드러냄 가운데 가장 앞, 의문은 제기
    const reveals = ls.filter((l) => (isFact ? l.act === '드러냄' : l.act === '제기'));
    const t0 = reveals.length ? reveals[0].place.tick : null;
    if (t0 == null) problems.push(`${rootId}: ${isFact ? '드러냄' : '제기'}이 없다`);
    const firstUnits = new Set();
    for (const l of ls) {
      let stage;
      if (isFact) {
        if (l.act === '드러냄') {
          // 같은 자리의 다른 단위는 동시에 처음 밝혀짐, 같은 단위 안 뒤 드러냄은 보강
          if (l.place.tick === t0 && !firstUnits.has(l.place.unit)) {
            stage = '처음 밝혀짐';
            firstUnits.add(l.place.unit);
          } else stage = '보강';
        } else if (l.act === '뒤집음') stage = '뒤집힘';
        else stage = l.act; // 암시 · 재언급
      } else if (l.act === '회수') stage = l.c.obj?.degree === '전부' ? '회수' : '일부 회수';
      else stage = l.act; // 제기 · 암시 · 재언급
      l.stage = stage;
      rows.push({
        root: rootId, kind: isFact ? '사실' : '의문', record: l.c.id, stage, act: l.act, point: l.point,
        tick: l.place.tick, date: l.place.date, order: l.place.order, unit: l.place.unit, scene: l.place.scene,
        rel: t0 == null ? '' : l.place.tick < t0 ? '앞' : l.place.tick === t0 ? '동시' : '뒤',
        answer: l.c.obj?.answer ?? l.c.obj?.replacedBy ?? '', confidence: l.c.confidence ?? '', status: l.c.status ?? '',
      });
    }
    const of = (s) => ls.filter((l) => l.stage === s);
    const firstTick = (s) => of(s)[0]?.place.tick ?? '';
    const threads = isFact ? mem.ofFact.get(rootId) ?? [] : mem.ofQuestion.has(rootId) ? [mem.ofQuestion.get(rootId)] : [];
    const hints = of('암시');
    const r = {
      id: rootId, kind: isFact ? '사실' : '의문', first_tick: t0 ?? '', first_date: t0 == null ? '' : rel.ticks[t0 - 1]?.date ?? '',
      first_units: [...new Set(ls.filter((l) => l.stage === (isFact ? '처음 밝혀짐' : '제기')).map((l) => l.place.unit))].join(' '),
      hints: hints.length, hints_before: hints.filter((l) => t0 != null && l.place.tick < t0).length, hint_tick: hints[0]?.place.tick ?? '',
      reinforce: of('보강').length, callbacks: of('재언급').length,
      reversed_tick: firstTick('뒤집힘'), replaced_by: of('뒤집힘').map((l) => l.c.obj?.replacedBy).filter(Boolean).join(' '),
      partial_tick: firstTick('일부 회수'), solved_tick: firstTick('회수'),
      state: isFact ? (of('뒤집힘').length ? '뒤집힘' : '') : of('회수').length ? '풀림' : of('일부 회수').length ? '일부' : '열림',
      last_tick: ls.at(-1).place.tick, units: new Set(ls.map((l) => l.place.unit)).size,
      threads: threads.join(' '), about: arr(root.obj?.about).join(' '), status: root.status ?? '', text: root.obj?.text ?? '',
    };
    roots.push(r);
  }
  roots.sort((a, b) => compareIds(a.id, b.id));
  rows.sort((a, b) => compareIds(a.root, b.root) || a.tick - b.tick || a.order - b.order || compareIds(a.record, b.record));
  return { rows, roots, byRoot: new Map(roots.map((r) => [r.id, r])), problems };
}

/**
 * 컷오프 — 공개 자리 T까지 읽은 사람이 아는 것(T5-8). 같은 자리(같은 날)는 다 읽은 것으로 본다.
 * @param {ReturnType<typeof revealStages>} st
 * @param {number} T 공개 자리
 * @param {{ thread?: string, about?: string }} [filter]
 */
export function knownAt(st, T, { thread, about } = {}) {
  const pick = (r) => (!thread || r.threads.split(' ').includes(thread)) && (!about || r.about.split(' ').includes(about));
  const at = (t) => t !== '' && t <= T;
  const facts = { known: [], reversed: [], hinted: [], hidden: 0 };
  const questions = { open: [], partial: [], solved: [], hinted: [], hidden: 0 };
  for (const r of st.roots.filter(pick)) {
    if (r.kind === '사실') {
      if (at(r.first_tick)) (at(r.reversed_tick) ? facts.reversed : facts.known).push(r);
      else if (at(r.hint_tick)) facts.hinted.push(r);
      else facts.hidden++;
    } else if (at(r.first_tick)) {
      (at(r.solved_tick) ? questions.solved : at(r.partial_tick) ? questions.partial : questions.open).push(r);
    } else if (at(r.hint_tick)) questions.hinted.push(r);
    else questions.hidden++;
  }
  return { facts, questions };
}
