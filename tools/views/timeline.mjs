/**
 * X1a — 공개 축 시안: 공개 자리 · 진실 공개 단계 · 컷오프 · 이벤트 메타데이터(T1-5). 규칙은 tools/views/reveal.mjs · events.mjs 머리말,
 * 화면 · 칸은 docs/views.md "공개 축 (X1a)".
 * X1b — 작중 연대기 ①: 시점 기록의 관계(at)로 단위 · 조각의 작중 자리(판별 · 범위 · 상대 · 불명). 규칙은 tools/views/chrono.mjs 머리말, 화면 6.
 * X1d — 작중 연대기 ③: 출시순과 어긋남 · 작중 순서(화면 6 시안) · 인물 변화의 작중 시점 · 공개 단계를 작중 축으로. 규칙은 tools/views/chrono-order.mjs 머리말.
 *
 *   node tools/views/timeline.mjs            → data/views/timeline/ (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/timeline.mjs --example  예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *
 * 출력:
 *   units.csv         단위별 — 읽는 자리 · 공개 자리 · 공개일 · 공개일을 어디서 얻었나(공개일 · 딸림)
 *   ticks.csv         공개 자리별 — 날짜 · 그 자리의 메인 챕터 · 단위
 *   reveals.csv       사실 · 의문 한 줄 = 기록 하나 — 공개 단계(암시 · 처음 밝혀짐 · 보강 · 뒤집힘 / 제기 · 일부 회수 · 회수 · 재언급) · 자리 · 그 단위의 작중 자리(X1d)
 *   records.csv       사실 · 의문별 — 첫 자리 · 암시 · 보강 · 뒤집힘 · 회수 자리 · 줄기 (컷오프는 이 표를 자리로 거른다) · 작중 첫 단위 · 앞당김 · 회수 먼저(X1d)
 *   events.csv        이벤트별(T1-5) — 이름 · 아카이브 순서 · 공개일 · 파트 · 씬 수 · 본문 있는 씬 · 대신하는 금서고
 *   event-scenes.csv  이벤트 씬 배열 — 파트 · 순서 · 씬 ID · 제목 · 본문 유무
 *   chrono.csv        단위별 작중 자리(X1b) — 판별 · 범위 · 상대 · 불명, 자리(작중 축 라벨 · lo · hi), 무엇으로 정했나(메인 · 단위 · 조각 · 회상 · 좁힘), 조각 · 회상 기록,
 *                     좁힘(X1c — annotations/chronology.json units의 관계 · 확신도, '단서 없음' = 시점 불명 확인)
 *                     어긋남(X1d — 공개 당시 메인 · 과거 · 앞 · 맞음 · 걸침 · 뒤 · 사이 챕터 수)
 *   chrono-pieces.csv 조각별(구간 · 회상 — 단위의 '지금'과 다른 때) 작중 자리
 *   chrono-order.csv  작중 순서(X1d, 화면 6 시안) — 단위의 '지금'과 조각을 작중 순으로 한 줄로, 상대 · 불명은 끝에 따로
 *   chrono-changes.csv 인물 변화의 작중 시점(X1d) — 2회독 D(기준 · 변화)마다 작중 자리 · 인물별 작중 순서 · 뒤바뀜
 *   chrono.md         작중 순서를 작중 축의 점(시대 기준점 · 메인 챕터)마다 묶어 읽을 수 있게(화면 6 시안)
 *   chrono-clues.csv  메인 밖 단위별 좁히기 단서(X1c — 시점 코드 · 메인에서 처음 나온 대상 · 메인에서 바뀐 인물, tools/views/chrono-clues.mjs). 해석이 아니다
 *   report.md         요약
 * 기록 문장은 Claude가 쓴 요약이고 원문 대사는 담지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, displayPath, loadDataset } from '../records/model.mjs';
import { KIND_ORDER, loadOrder } from '../records/order.mjs';
import { chronology, loadChronology } from './chrono.mjs';
import { changeTimeline, chronoOrder, prequelPairs, releaseDrift, revealChrono, unitSpans } from './chrono-order.mjs';
import { chronoClues } from './chrono-clues.mjs';
import { archiveEvents } from './events.mjs';
import { knownAt, releasePlaces, revealStages } from './reveal.mjs';

export const TIMELINE_DIR = path.join(ROOT, 'data/views/timeline');

const COLUMNS = {
  units: ['order', 'tick', 'unit', 'kind', 'date', 'rank', 'via', 'from', 'basis', 'confidence'],
  ticks: ['tick', 'date', 'main', 'count', 'units'],
  rows: ['root', 'kind', 'record', 'stage', 'act', 'point', 'tick', 'date', 'order', 'unit', 'scene', 'rel', 'answer', 'confidence', 'status',
    'chrono_place', 'chrono_lo', 'chrono_hi'],
  roots: ['id', 'kind', 'first_tick', 'first_date', 'first_units', 'hints', 'hints_before', 'hint_tick', 'reinforce', 'callbacks', 'reversed_tick', 'replaced_by',
    'partial_tick', 'solved_tick', 'state', 'last_tick', 'units', 'threads', 'about', 'status', 'chrono_first_units', 'chrono_shift', 'text'],
  events: ['order', 'tick', 'unit', 'source', 'archive_order', 'archive_id', 'event_id', 'type', 'name', 'date', 'parts', 'release_parts', 'scenes', 'scenes_text', 'substitute', 'prefab'],
  scenes: ['unit', 'part_order', 'part', 'seq', 'scene', 'title', 'has_text', 'lines'],
  chrono: ['order', 'tick', 'unit', 'kind', 'class', 'place', 'lo', 'hi', 'via', 'records', 'pieces', 'flashbacks', 'relations', 'narrow', 'narrow_confidence',
    'release_main', 'drift', 'drift_gap'],
  pieces: ['id', 'unit', 'kind', 'class', 'place', 'lo', 'hi', 'years', 'relations', 'narrow', 'narrow_confidence', 'text'],
  clues: ['order', 'unit', 'kind', 'class', 'place', 'narrow', 'codes', 'intro', 'changes'],
  corder: ['seq', 'slot', 'entry', 'unit', 'kind', 'type', 'class', 'place', 'lo', 'hi', 'tick', 'order', 'release_main', 'drift', 'drift_gap', 'via', 'text'],
  changes: ['person', 'seq', 'id', 'act', 'aspect', 'with', 'unit', 'tick', 'order', 'time', 'source', 'class', 'place', 'lo', 'hi', 'inverted', 'text'],
};
const FILES = {
  units: 'units.csv', ticks: 'ticks.csv', rows: 'reveals.csv', roots: 'records.csv', events: 'events.csv', scenes: 'event-scenes.csv',
  chrono: 'chrono.csv', pieces: 'chrono-pieces.csv', clues: 'chrono-clues.csv', corder: 'chrono-order.csv', changes: 'chrono-changes.csv',
};

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

/** 시점 기록의 기준 키 → 읽기 단위. 씬이면 scene: true. 본문 없는 블라링크 이벤트는 대신하는 금서고 단위로 */
export function unitResolver(ctx, readingUnits) {
  const reading = new Set(readingUnits);
  const byGame = new Map(ctx.units.filter((u) => u.gameKey).map((u) => [u.gameKey, u.key]));
  return (key) => {
    if (reading.has(key)) return { unit: key, scene: false };
    const r = ctx.resolve(key);
    if (!r?.unit) return null;
    let u = r.unit.key;
    if (!reading.has(u) && byGame.has(u)) u = byGame.get(u);
    return { unit: u, scene: r.type === 'scene' };
  };
}

/** 작중 연대기(X1b) 입력을 데이터셋 · 공개 자리에서 모은다 */
export function buildChronology(ds, ctx, rel) {
  const chron = loadChronology(ds.dir);
  const times = ds.candidates.filter((c) => c.kind === 'time').map((c) => ({
    id: c.id, unit: c.unit, kind: c.act, status: c.status, text: c.text, subject: c.obj?.subject, at: c.obj?.at, years: c.obj?.years,
  }));
  const mains = rel.units.filter((u) => u.kind === '메인').map((u) => u.unit).sort();
  const ch = chronology({ times, eras: chron.eras, mains, units: rel.units, resolveKey: unitResolver(ctx, rel.units.map((u) => u.unit)), narrows: chron.units });
  ch.problems.unshift(...chron.problems);
  ch.source = chron.name;
  ch.eras = chron.eras;
  ch.codes = chron.codes;
  return ch;
}

/**
 * @returns {{ units, ticks, rows, roots, events, scenes, chrono, pieces, clues, corder, changes, rel, st, ch, x1d, problems }}
 */
export function buildTimelineViews(ds, ctx, order) {
  const rel = releasePlaces(ctx, order);
  const st = revealStages(ds, ctx, order, rel);
  const ev = archiveEvents(ctx, rel.byUnit);
  const ch = buildChronology(ds, ctx, rel);
  const cl = chronoClues({ ctx, rel, ds, codes: ch.codes });
  const clues = ch.rows.filter((r) => cl.has(r.unit)).map((r) => ({ ...r, ...cl.get(r.unit) }));
  const ticks = rel.ticks.map((t) => ({ ...t, count: t.units.length, units: t.units.join(' ') }));
  // X1d — 어긋남 · 작중 순서 · 인물 변화의 작중 시점 · 공개 단계를 작중 축으로
  const spans = unitSpans(ch);
  const drift = releaseDrift(ch, rel, spans);
  const corder = chronoOrder(ch, rel, spans, drift);
  const ct = changeTimeline(ds, ch, spans, rel);
  const rc = revealChrono(st, spans);
  const x1d = { spans, drift, pairs: prequelPairs(ch, rel), persons: ct.persons };
  return {
    units: rel.units, ticks, rows: rc.rows, roots: rc.roots, events: ev.events, scenes: ev.scenes,
    chrono: ch.rows.map((r) => ({ ...r, ...drift.get(r.unit) })), pieces: ch.pieces, clues, corder, changes: ct.rows,
    rel, st, ch, x1d, problems: [...rel.problems, ...st.problems, ...ch.problems.map((p) => `작중 연대기 — ${p}`)],
  };
}

/** report.md — 숫자와 ID만. 같은 기록이면 같은 글 */
export function renderTimelineReport(v, { source }) {
  const L = [];
  const count = (xs, f) => xs.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
  const facts = v.roots.filter((r) => r.kind === '사실');
  const qs = v.roots.filter((r) => r.kind === '의문');
  const tickOf = (u) => v.rel.byUnit.get(u)?.tick;
  const dateOf = (t) => v.rel.ticks[t - 1]?.date ?? '';

  L.push('# 공개 축 — 공개 자리 · 진실 공개 단계 · 컷오프 (X1a)', '');
  L.push(`\`node tools/views/timeline.mjs\`가 만든다(\`draft.mjs\`도 같이 부른다, 손으로 고치지 않는다). 입력: ${source} · 2회독 기록 · docs/history/reading.md R 항목 순서 · DB(releases · 아카이브 원본).`);
  L.push('규칙은 tools/views/reveal.mjs 머리말, 화면 · 칸은 [docs/views.md](../../../docs/views.md) "공개 축 (X1a)". 시트는 쓰지 않았다.', '');

  L.push('## 공개 자리', '');
  const launch = v.rel.ticks.filter((t) => t.date === v.rel.ticks[0].date);
  L.push(`- 단위 ${v.units.length} → 공개 자리 ${v.rel.ticks.length}(${v.rel.ticks[0].date} ~ ${v.rel.ticks.at(-1).date}). 같은 날 = 같은 자리, 같은 날 메인 챕터가 여럿이면 챕터마다 갈린다 — 출시 첫날 ${launch.length}자리(${launch[0].main}–${launch.at(-1).main.slice(2)}).`);
  const via = count(v.units, (u) => `${u.via} ${u.kind}`);
  L.push(`- 공개일: ${['메인', '사이드', '이벤트', '호감도'].map((k) => `${k} ${via.get(`공개일 ${k}`) ?? 0}`).join(' · ')}. 딸림(앞 공개 단위의 자리를 물려받음): ${['서브퀘스트', '유실물', '그 밖'].map((k) => `${k} ${via.get(`딸림 ${k}`) ?? 0}`).join(' · ')}.`);
  const guess = v.units.filter((u) => u.confidence === '추정');
  L.push(`- 공개일이 추정인 단위 ${guess.length}(${[...count(guess, (u) => u.basis)].map(([k, n]) => `${k || '-'} ${n}`).join(' · ')}) — 근거는 data/release/report.md.`);
  const big = [...v.rel.ticks].sort((a, b) => b.units.length - a.units.length || a.tick - b.tick).slice(0, 5);
  L.push(`- 단위가 많은 자리: ${big.map((t) => `${t.tick}(${t.date}${t.main ? ` ${t.main}` : ''}) ${t.units.length}`).join(' · ')}.`, '');

  L.push('## 진실 공개 단계', '');
  const stage = count(v.rows, (r) => `${r.kind} ${r.stage}`);
  const st = (k, s) => stage.get(`${k} ${s}`) ?? 0;
  L.push(`사실 ${facts.length} · 의문 ${qs.length}에 걸린 기록 ${v.rows.length}줄(기각 뺌).`, '');
  L.push('| 대상 | 단계 | 줄 | 뿌리 |', '|---|---|---:|---:|');
  const roots = (k, s) => new Set(v.rows.filter((r) => r.kind === k && r.stage === s).map((r) => r.root)).size;
  for (const s of ['암시', '처음 밝혀짐', '보강', '뒤집힘', '재언급']) L.push(`| 사실 | ${s} | ${st('사실', s)} | ${roots('사실', s)} |`);
  for (const s of ['암시', '제기', '일부 회수', '회수', '재언급']) L.push(`| 의문 | ${s} | ${st('의문', s)} | ${roots('의문', s)} |`);
  L.push('');
  const sim = facts.filter((r) => r.first_units.includes(' '));
  L.push(`- 같은 날 두 단위 이상에서 처음 밝혀진 사실 ${sim.length}${sim.length ? `: ${sim.slice(0, 8).map((r) => `${r.id}(${r.first_units.split(' ').join(' · ')})`).join(' · ')}${sim.length > 8 ? ' …' : ''}` : ''}.`);
  const hinted = facts.filter((r) => r.hints_before);
  L.push(`- 처음 밝혀지기 전에 암시된 사실 ${hinted.length}/${facts.length} · 뒤에 보강된 사실 ${facts.filter((r) => r.reinforce).length} · 뒤집힌 사실 ${facts.filter((r) => r.reversed_tick !== '').length}.`);
  const lead = hinted.map((r) => ({ r, gap: r.first_tick - r.hint_tick })).sort((a, b) => b.gap - a.gap || a.r.first_tick - b.r.first_tick || a.r.id.localeCompare(b.r.id));
  L.push(`- 암시에서 처음 밝혀짐까지 공개 자리 차이: 가운데 ${lead.length ? lead[Math.floor(lead.length / 2)].gap : '-'} · 30자리 이상 ${lead.filter((x) => x.gap >= 30).length}. 가장 먼 것:`, '');
  L.push('| 사실 | 첫 암시 | 처음 밝혀짐 | 자리 차이 | 줄기 |', '|---|---|---|---:|---|');
  for (const { r, gap } of lead.slice(0, 10)) {
    const h = v.rows.find((x) => x.root === r.id && x.stage === '암시');
    L.push(`| ${r.id} | ${h.unit} (${dateOf(r.hint_tick)}) | ${r.first_units} (${r.first_date}) | ${gap} | ${r.threads || '-'} |`);
  }
  L.push('');
  const qState = count(qs, (r) => r.state);
  L.push(`- 의문 끝 상태: 열림 ${qState.get('열림') ?? 0} · 일부 ${qState.get('일부') ?? 0} · 풀림 ${qState.get('풀림') ?? 0}. 제기 전에 암시된 의문 ${qs.filter((r) => r.hints_before).length}.`);
  const longQ = qs.filter((r) => r.solved_tick !== '').map((r) => ({ r, gap: r.solved_tick - r.first_tick })).sort((a, b) => b.gap - a.gap || a.r.id.localeCompare(b.r.id));
  L.push(`- 제기에서 회수(전부)까지 가장 먼 의문: ${longQ.slice(0, 6).map(({ r, gap }) => `${r.id}(${r.first_units} ${r.first_date} → ${dateOf(r.solved_tick)}, ${gap}자리)`).join(' · ')}.`, '');

  L.push('## 컷오프 — 메인 챕터까지 읽은 사람이 아는 것', '');
  L.push('그 챕터의 공개 자리까지(같은 날 나온 이벤트 · 호감도 스토리 포함). 사실: 앎 = 처음 밝혀짐이 그 자리까지(뒤집힘은 따로) · 암시만 = 암시는 있었고 아직 안 밝혀짐. 의문: 그때 상태.', '');
  L.push('| 챕터 | 자리 | 날짜 | 사실 앎 | 뒤집힘 | 암시만 | 의문 열림 | 일부 | 풀림 | 암시만 |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const t of v.rel.ticks.filter((x) => x.main)) {
    const k = knownAt(v.st, t.tick);
    L.push(`| ${t.main} | ${t.tick} | ${t.date} | ${k.facts.known.length} | ${k.facts.reversed.length} | ${k.facts.hinted.length} | ${k.questions.open.length} | ${k.questions.partial.length} | ${k.questions.solved.length} | ${k.questions.hinted.length} |`);
  }
  const lastTick = v.rel.ticks.length;
  const kEnd = knownAt(v.st, lastTick);
  L.push(`| (끝) | ${lastTick} | ${dateOf(lastTick)} | ${kEnd.facts.known.length} | ${kEnd.facts.reversed.length} | ${kEnd.facts.hinted.length} | ${kEnd.questions.open.length} | ${kEnd.questions.partial.length} | ${kEnd.questions.solved.length} | ${kEnd.questions.hinted.length} |`, '');
  L.push('질의: `node tools/query.mjs known <단위 키 | 공개 자리 | 날짜> [--thread J1] [--about person:라피] [--list]`.', '');

  L.push('## 이벤트 메타데이터 (T1-5)', '');
  const src = count(v.events, (e) => e.source);
  L.push(`- 이벤트 ${v.events.length}: 아카이브 ${src.get('아카이브') ?? 0}(스토리 ${v.events.filter((e) => e.type === '스토리 이벤트').length} · 특별 ${v.events.filter((e) => e.type === '특별 이벤트').length}) · 금서고에만 ${src.get('금서고') ?? 0}. 아카이브 씬 ${v.scenes.length} · 본문 없는 씬 ${v.scenes.filter((s) => s.has_text !== 1).length}.`);
  const parts = count(v.events.filter((e) => e.source === '아카이브'), (e) => e.parts.replace(/ \d+/g, ''));
  L.push(`- 파트: ${[...parts].map(([k, n]) => `${k} ${n}`).join(' · ')}. 금서고가 본문을 대신하는 아카이브 이벤트: ${v.events.filter((e) => e.substitute).map((e) => `${e.substitute} → ${e.unit}`).join(' · ') || '없음'}.`);
  L.push('- 아카이브 순서(`archive_order`)는 앨범 순서라 공개 순서와 다르다 — 공개 순서는 `order` · `tick`(공지).', '');

  L.push(...renderChronoSection(v), '');
  L.push(...renderChronoOrderSection(v), '');

  L.push('## 문제', '');
  if (!v.problems.length) L.push('없음.');
  for (const p of v.problems) L.push(`- ${p}`);
  L.push('', `종류: ${KIND_ORDER.map((k) => `${k} ${v.units.filter((u) => u.kind === k).length}`).join(' · ')}.`);
  return L.join('\n') + '\n';
}

/** report.md의 작중 연대기 절(X1b) — 숫자와 ID만 */
function renderChronoSection(v) {
  const ch = v.ch;
  const L = [];
  const count = (xs, f) => xs.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
  const CLASSES = ['판별', '범위', '상대', '불명'];
  L.push('## 작중 연대기 — 시점 기록 구조화 (X1b)', '');
  L.push(`시점 기록의 관계(\`at\` — Claude가 기록 문장을 구조화, 사용자가 뒤집는다)로 계산한다. 규칙은 tools/views/chrono.mjs 머리말, 형식은 docs/annotations.md "작중 연대기", 화면은 docs/views.md 화면 6. 시대 기준점: ${ch.source ?? '없음'}.`, '');
  const eras = ch.points.filter((p) => p.era);
  L.push(`- 작중 축: 시대 기준점 ${eras.length}(과거) + 메인 챕터 ${ch.points.length - eras.length}(지금 — 번호 순에 고정, 가정) = ${ch.points.length}점. 점 사이 칸까지 자리 ${2 * ch.points.length + 1}.`);
  if (eras.length) L.push(`  시대 기준점(앞 → 뒤, 어림 연수): ${eras.map((p) => `${p.id}${p.years !== '' ? ` ${p.years}년 전` : ''}`).join(' → ')} → ch00.`);
  const st = ch.stats;
  const yrs = ch.cons.filter((c) => c.rel === '연수' && !c.narrow).length;
  L.push(`- 시점 기록 ${st.times}(기각 뺌) — 관계 · 연수가 있는 기록 ${st.withAt} · 관계 없는 기록(at = []) ${st.times - st.withAt}. 관계 줄 ${st.relations - yrs} · 연수 ${yrs}.`);
  const pk = count(ch.pieces, (p) => `${p.kind} ${p.class}`);
  const pieceLine = (k) => `${k} ${ch.pieces.filter((p) => p.kind === k).length}(${CLASSES.map((c) => `${c} ${pk.get(`${k} ${c}`) ?? 0}`).join(' · ')})`;
  L.push(`- 조각(단위의 '지금'과 다른 때를 말하는 기록) ${ch.pieces.length}: ${pieceLine('기준점')} · ${pieceLine('회상')}.`, '');
  L.push('| 종류 | 단위 | 판별 | 범위 | 상대 | 불명 | 그중 기록 없음 |', '|---|---:|---:|---:|---:|---:|---:|');
  const kinds = [...new Set(ch.rows.map((r) => r.kind))];
  for (const k of [...KIND_ORDER.filter((x) => kinds.includes(x)), ...kinds.filter((x) => !KIND_ORDER.includes(x))]) {
    const rs = ch.rows.filter((r) => r.kind === k);
    const c = count(rs, (r) => r.class);
    L.push(`| ${k || '-'} | ${rs.length} | ${CLASSES.map((x) => c.get(x) ?? 0).join(' | ')} | ${rs.filter((r) => !r.records).length} |`);
  }
  const all = count(ch.rows, (r) => r.class);
  L.push(`| 합 | ${ch.rows.length} | ${CLASSES.map((x) => all.get(x) ?? 0).join(' | ')} | ${ch.rows.filter((r) => !r.records).length} |`, '');
  const via = count(ch.rows.filter((r) => r.via), (r) => r.via);
  L.push(`- 무엇으로 정했나: 메인 ${via.get('메인') ?? 0} · 단위(자기 관계 또는 남이 기준으로 삼음) ${via.get('단위') ?? 0} · 조각(기준점 구간들 — 여러 자리) ${via.get('조각') ?? 0} · 회상(기록이 모두 회상 — 과거 문서 · 옛이야기) ${via.get('회상') ?? 0}` +
    ` · 좁힘(X1c) ${via.get('좁힘') ?? 0} · 단위 · 좁힘 ${via.get('단위 · 좁힘') ?? 0}.`);
  const nr = ch.rows.filter((r) => r.narrow);
  const nc = count(nr, (r) => r.class);
  L.push(`- 좁힘(X1c — annotations/chronology.json units, Claude 확정) ${nr.length}단위: ${CLASSES.map((c) => `${c} ${nc.get(c) ?? 0}`).join(' · ')}` +
    `(그중 단서 없음 — 시점 불명 확인 ${nr.filter((r) => r.narrow === '단서 없음').length}) · 관계 줄 ${st.narrowRelations ?? 0} · 모습 코드 ${ch.codes?.length ?? 0}.`);
  L.push('- 판별 = 한 점 무렵이나 이웃한 두 점 사이(폭 2칸 이하) · 범위 = 경계가 있으나 더 넓음(\'CH.15 뒤\'처럼 한쪽만 아는 것 포함) · 상대 = 다른 단위와의 앞뒤만 있고 작중 축에 닿지 않음 · 불명 = 관계 없음.');
  const noRel = ch.rows.filter((r) => r.records && r.class === '불명');
  L.push(`- 기록은 있는데 불명 ${noRel.length}: ${noRel.map((r) => `${r.unit}(${r.records})`).join(' · ') || '없음'} — 계절 · 하루 같은 시점만 있거나 자기 단위의 '지금'을 기준으로 한 회상뿐이다. 기록 없는 단위와 함께 X1c가 좁힌다.`, '');
  L.push('### 메인 챕터끼리 — 번호 순과 다른 기록', '');
  L.push('메인 챕터는 번호 순에 고정했다. 기록이 이와 다르게 말하는 곳 — 모순이 아니라 병행(같은 무렵) 줄거리다.', '');
  if (!ch.mainNotes.length) L.push('없음.');
  for (const r of ch.mainNotes) L.push(`- ${r.record}: ${r.node.replace('unit:', '')} ${r.rel} ${r.base}`);
  L.push('', '### 모순 · 순환', '');
  if (!ch.contradictions.length && !ch.cycles.length) L.push('없음 — 관계를 모두 만족하는 자리가 있다.');
  for (const r of ch.contradictions) L.push(`- 모순 ${r.record}: ${r.node} ${r.rel} ${r.base} — ${r.why}(이 관계를 빼고 계산: ${r.node} ${r.node_place || '?'} · 기준 ${r.base_place || '?'})`);
  for (const c of ch.cycles) L.push(`- 순환 ${c.records.join(' · ')}: ${c.relations.join(' / ')}`);
  return L;
}

/** report.md의 X1d 절 — 어긋남 · 작중 순서 · 인물 변화 · 작중 공개. 숫자와 ID만 */
function renderChronoOrderSection(v) {
  const L = [];
  const count = (xs, f) => xs.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map());
  const ch = v.ch;
  const conf = new Map(v.units.map((u) => [u.unit, u]));
  L.push('## 작중 연대기 ③ — 출시순과 어긋남 · 작중 순서 · 인물 변화 · 작중 공개 (X1d)', '');
  L.push('작중 자리(위 절)를 공개 자리와 견주고 작중 순서로 늘어놓는다 — 새 해석 없이 계산만. 규칙은 tools/views/chrono-order.mjs 머리말,');
  L.push('표는 chrono.csv(release_main · drift · drift_gap) · chrono-order.csv · chrono-changes.csv · reveals.csv · records.csv(chrono_ 칸), 화면 6 시안은 [chrono.md](chrono.md).', '');

  L.push('### 출시순과 어긋남', '');
  const DR = ['과거', '앞', '맞음', '걸침', '뒤', ''];
  const label = (d) => d || '모름';
  const rs = v.chrono.filter((r) => r.kind !== '메인');
  L.push('공개 당시 메인 = 그 단위의 공개 자리까지 나온 마지막 메인 챕터. 과거 = 작중이 메인 앞(시대 기준점 쪽) · 앞 = 공개 당시 메인보다 확실히 앞(프리퀄) · 맞음 = 공개 당시 메인과 그 뒤 칸 안 · ' +
    '걸침 = 그 칸에 걸치는 더 넓은 범위 · 뒤 = 아직 안 나온 챕터 뒤 · 모름 = 상대 · 불명. 메인 챕터는 번호 순 고정이라 어긋나지 않는다(ch43 · ch44 병행만 위 "메인 챕터끼리").', '');
  L.push(`| 종류 | 단위 | ${DR.map(label).join(' | ')} |`, `|---|---:|${DR.map(() => '---:').join('|')}|`);
  const kinds = KIND_ORDER.filter((k) => k !== '메인' && rs.some((r) => r.kind === k));
  for (const k of [...kinds, ...[...new Set(rs.map((r) => r.kind))].filter((x) => !kinds.includes(x))]) {
    const xs = rs.filter((r) => r.kind === k);
    const c = count(xs, (r) => r.drift);
    L.push(`| ${k || '-'} | ${xs.length} | ${DR.map((d) => c.get(d) ?? 0).join(' | ')} |`);
  }
  const all = count(rs, (r) => r.drift);
  L.push(`| 합 | ${rs.length} | ${DR.map((d) => all.get(d) ?? 0).join(' | ')} |`, '');
  const fore = rs.filter((r) => r.drift === '앞').sort((a, b) => b.drift_gap - a.drift_gap || a.order - b.order);
  const gaps = count(fore, (r) => (r.drift_gap >= 10 ? '10+' : r.drift_gap >= 3 ? '3–9' : String(r.drift_gap)));
  L.push(`- 앞(프리퀄) ${fore.length} — 사이 챕터 ${['1', '2', '3–9', '10+'].map((g) => `${g} ${gaps.get(g) ?? 0}`).join(' · ')}:`);
  L.push(`  ${fore.map((r) => `${r.unit}(${r.place} · 공개 당시 ${r.release_main} · ${r.drift_gap})`).join(' · ')}.`);
  const past = rs.filter((r) => r.drift === '과거');
  L.push(`- 과거 ${past.length} — ${[...count(past, (r) => r.kind)].map(([k, n]) => `${k} ${n}`).join(' · ')}(유실물 문서 · 옛이야기 · 갓데스 시절): ${past.map((r) => r.unit).join(' · ')}.`);
  const ahead = rs.filter((r) => r.drift === '뒤').sort((a, b) => a.order - b.order);
  L.push(`- 뒤 ${ahead.length} — 공개 당시 아직 안 나온 챕터 뒤의 일(앞질러 간 이야기 — 메인이 풀린 뒤에야 상황을 알게 된다. 공개일이 추정이면 그것부터 의심한다): ` +
    `${ahead.map((r) => `${r.unit}(${r.place} · 공개 당시 ${r.release_main} · ${r.drift_gap}${conf.get(r.unit)?.confidence === '추정' ? ` · 공개일 추정 ${conf.get(r.unit).basis}` : ''})`).join(' · ') || '없음'}.`);
  const mid = count(rs.filter((r) => r.drift === '걸침'), (r) => (String(r.lo) === '' ? '앞 끝 모름' : String(r.hi) === '' ? '뒤 끝 모름' : '양쪽'));
  L.push(`- 걸침 ${all.get('걸침') ?? 0} — 한쪽만 아는 범위(앞 끝 모름 ${mid.get('앞 끝 모름') ?? 0} · 뒤 끝 모름 ${mid.get('뒤 끝 모름') ?? 0}) · 양쪽을 아는 넓은 범위 ${mid.get('양쪽') ?? 0}. 어긋났는지 모른다.`);
  const pairs = v.x1d.pairs;
  L.push(`- 메인 밖 단위끼리 앞뒤 기록이 공개 순과 반대인 쌍 ${pairs.length}${pairs.length ? `: ${pairs.map((p) => `${p.earlier}(공개 자리 ${p.earlier_tick})가 작중으로 ${p.later}(${p.later_tick}) 앞 — ${p.record} ${p.rel} ${p.base}`).join(' · ')}` : ''}.`, '');

  L.push('### 작중 순서 (화면 6 시안)', '');
  const co = v.corder;
  const placed = co.filter((r) => r.seq !== '');
  const tc = count(co, (r) => `${r.type} ${r.seq === '' ? '모름' : '놓임'}`);
  L.push(`- 줄 ${co.length} = 단위의 '지금' ${co.filter((r) => r.type === '지금').length}(놓임 ${tc.get('지금 놓임') ?? 0} · 상대 · 불명 ${tc.get('지금 모름') ?? 0}) + 조각 — 구간 ${co.filter((r) => r.type === '구간').length}(놓임 ${tc.get('구간 놓임') ?? 0}) · 회상 ${co.filter((r) => r.type === '회상').length}(놓임 ${tc.get('회상 놓임') ?? 0}).`);
  L.push('- 정렬: 구간의 앞 끝(모르면 뒤 끝) → 뒤 끝 → 판별 먼저 → 공개 자리. 범위는 앞 끝 자리에 놓인다. 상대 · 불명은 끝에 따로.', '');
  const firstMain = ch.points.find((p) => !p.era)?.pos ?? 0;
  const posOf = new Map(ch.points.map((p) => [p.id, p.pos]));
  const bands = [['ch00 전(시대 기준점)', -Infinity, firstMain - 1]];
  for (let a = 0; a < 50; a += 10) {
    const lo = posOf.get(`ch${String(a).padStart(2, '0')}`);
    if (lo == null) continue;
    const last = ch.points.filter((p) => !p.era && Number(p.id.slice(2)) <= a + 9).at(-1);
    bands.push([`ch${String(a).padStart(2, '0')}–${last.id.slice(2)}`, lo, last.pos + (last === ch.points.at(-1) ? Infinity : 1)]);
  }
  L.push('| 작중 칸 | 단위 판별 | 단위 범위 | 조각 판별 | 조각 범위 |', '|---|---:|---:|---:|---:|');
  for (const [name, lo, hi] of bands) {
    const xs = placed.filter((r) => r.slot >= lo && r.slot <= hi);
    const c = count(xs, (r) => `${r.type === '지금' ? '단위' : '조각'} ${r.class}`);
    L.push(`| ${name} | ${c.get('단위 판별') ?? 0} | ${c.get('단위 범위') ?? 0} | ${c.get('조각 판별') ?? 0} | ${c.get('조각 범위') ?? 0} |`);
  }
  L.push('', '(메인 챕터 49는 단위 판별에 든다. 범위는 앞 끝 칸에 센다.)', '');

  L.push('### 인물 변화의 작중 시점', '');
  const cr = v.changes;
  const src = count(cr, (r) => r.source.split(' ')[0]);
  const pl = count(cr, (r) => `${r.act} ${r.seq === '' ? '모름' : '놓임'}`);
  L.push(`- 2회독 인물 변화 ${cr.length}(기각 뺌 — 기준 ${cr.filter((r) => r.act === '기준').length} · 변화 ${cr.filter((r) => r.act === '변화').length}) · 인물 ${new Set(cr.map((r) => r.person)).size}.` +
    ` 작중 자리: 단위(시점 기록 time이 단위를 말함 · time 없음 → 드러난 단위) ${src.get('단위') ?? 0} · 조각(time이 구간 · 회상) ${src.get('조각') ?? 0}${src.get('기준점') ? ` · 기준점 ${src.get('기준점')}` : ''}.`);
  L.push(`- time 없는 것 ${cr.filter((r) => !r.time).length}(기준 ${cr.filter((r) => !r.time && r.act === '기준').length} · 변화 ${cr.filter((r) => !r.time && r.act === '변화').length})은 드러난 단위의 작중 자리를 쓴다.` +
    ` 놓임: 기준 ${pl.get('기준 놓임') ?? 0} · 변화 ${pl.get('변화 놓임') ?? 0}, 단위가 상대 · 불명이라 못 놓음: 기준 ${pl.get('기준 모름') ?? 0} · 변화 ${pl.get('변화 모름') ?? 0}.`);
  const inv = v.x1d.persons.filter((p) => p.inverted).sort((a, b) => b.inverted - a.inverted || a.person.localeCompare(b.person));
  const invAll = inv.reduce((s, p) => s + p.inverted, 0);
  const invSrc = count(inv.flatMap((p) => p.examples), (e) => e.source.split(' ')[0]);
  L.push(`- 뒤바뀐 변화(같은 인물의 먼저 공개된 변화보다 작중으로 확실히 앞) ${invAll} · 인물 ${inv.length} — 조각(회상 · 과거 구간)에서 드러난 것 ${invSrc.get('조각') ?? 0} · 단위(프리퀄 단위) ${invSrc.get('단위') ?? 0}.`, '');
  L.push('| 인물 | 변화 | 놓인 변화 | 뒤바뀐 변화 | 예(뒤바뀐 변화 · 단위 → 그보다 먼저 공개된 변화) |', '|---|---:|---:|---:|---|');
  for (const p of inv.slice(0, 15)) {
    L.push(`| ${p.person.replace('person:', '')} | ${p.changes} | ${p.placed} | ${p.inverted} | ${p.examples.slice(0, 2).map((e) => `${e.id} ${e.unit} → ${e.over.slice(0, 2).join(' ')}${e.over.length > 2 ? ' …' : ''}`).join(' / ')} |`);
  }
  if (inv.length > 15) L.push(`| (그 밖 ${inv.length - 15}명) | | | ${inv.slice(15).reduce((s, p) => s + p.inverted, 0)} | |`);
  L.push('', '인물 한 명: `node tools/query.mjs chrono person:라피` — 작중 순서로 기준 · 변화.', '');

  L.push('### 공개 단계를 작중 축으로', '');
  const rows = v.rows;
  L.push(`- 공개 단계 줄 ${rows.length} 가운데 그 단위의 작중 자리가 있는 줄 ${rows.filter((r) => r.chrono_lo !== '' || r.chrono_hi !== '').length}.` +
    ' 작중 첫 단위(records.csv chrono_first_units) = 드러냄(의문은 제기) 줄 가운데 작중으로 다른 줄보다 확실히 뒤가 아닌 것.');
  const shift = v.roots.filter((r) => r.chrono_shift === '앞당김');
  L.push(`- 앞당김(사실) ${shift.length} — 공개 순 처음 밝혀짐보다 작중으로 확실히 앞인 드러냄이 있다(작중 순으로 읽으면 더 앞 단위에서 밝혀진다): ` +
    `${shift.map((r) => `${r.id}(${r.first_units} → ${r.chrono_first_units})`).join(' · ') || '없음'}.`);
  const qs = v.roots.filter((r) => r.chrono_shift === '회수 먼저');
  const sp = v.x1d.spans;
  const ans = (r) => {
    const opens = rows.filter((x) => x.root === r.id && x.act === '제기').map((x) => sp.get(x.unit));
    const lo = Math.min(...opens.map((s) => s.lo));
    return [...new Set(rows.filter((x) => x.root === r.id && x.act === '회수' && sp.get(x.unit)?.hi < lo).map((x) => x.unit))].join(' ');
  };
  L.push(`- 회수 먼저(의문) ${qs.length} — 제기보다 작중으로 확실히 앞인 회수가 있다(과거 문서 · 프리퀄이 답을 담음): ${qs.map((r) => `${r.id}(${r.first_units} → ${ans(r)})`).join(' · ') || '없음'}.`);
  return L;
}

/** chrono.md — 화면 6 시안: 작중 순서를 작중 축의 점(시대 기준점 · 메인 챕터)과 그 사이 칸마다 묶는다. 기록 문장은 Claude가 쓴 요약 */
export function renderChronoList(v, { source }) {
  const ch = v.ch;
  const L = [];
  const dateOf = (t) => v.rel.ticks[t - 1]?.date ?? '';
  const short = (s, n = 50) => (s.length > n ? `${s.slice(0, n)}…` : s);
  L.push('# 작중 연대기 — 시간순 스토리 나열 (화면 6 시안, X1d)', '');
  L.push(`\`node tools/views/timeline.mjs\`가 만든다(손으로 고치지 않는다). 입력: ${source} · annotations/chronology.json · 공개 자리. 표는 chrono-order.csv, 규칙은 tools/views/chrono-order.mjs 머리말, 화면은 [docs/views.md](../../../docs/views.md) 화면 6.`, '');
  L.push('읽는 법 — 작중 축의 점(시대 기준점 · 메인 챕터)과 그 사이 칸마다 그 자리에서 시작하는 것을 모았다. 판별은 제자리에, 범위는 앞 끝 칸에 놓고 괄호에 범위를 적었다' +
    '(앞 끝을 모르는 `~ X`는 뒤 끝 칸에, 여러 자리는 가장 앞 자리에). `↺` 조각(회상 · 단위의 지금과 다른 구간 — 한 단위가 두 자리에 나온다).' +
    ' 어긋남: `◀N` 공개 당시 메인보다 N챕터 앞 · `▶N` 아직 안 나온 N챕터 뒤 · `⌛` 과거(메인 앞) — 걸침 · 맞음은 표시하지 않는다. 상대 · 불명은 끝에 따로.', '');
  const mark = (r) => (r.drift === '앞' ? ` ◀${r.drift_gap}` : r.drift === '뒤' ? ` ▶${r.drift_gap}` : r.drift === '과거' ? ' ⌛' : '');
  const line = (r) => {
    const rng = r.class === '범위' ? ` (${r.place})` : r.place.includes(' / ') ? ` (여러 자리 ${r.place})` : '';
    if (r.type === '지금') return `- ${r.unit} — ${r.kind} · ${r.class}${rng} · 공개 ${r.tick}(${dateOf(r.tick)})${mark(r)}`;
    return `- ↺ ${r.entry} ${r.unit} [${r.type}] — ${r.class}${rng} · ${short(r.text)}`;
  };
  const bySlot = new Map();
  for (const r of v.corder.filter((x) => x.seq !== '')) (bySlot.get(r.slot) ?? bySlot.set(r.slot, []).get(r.slot)).push(r);
  for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) {
    const rs = bySlot.get(slot);
    const lbl = ch.label(slot);
    const main = rs.find((r) => r.type === '지금' && r.kind === '메인');
    L.push(slot % 2 === 1 ? `## ${lbl}${main ? ` — 공개 ${main.tick}(${dateOf(main.tick)})` : ''}` : `### ${lbl}`, '');
    for (const r of rs) if (r !== main) L.push(line(r));
    L.push('');
  }
  const rest = v.corder.filter((x) => x.seq === '');
  for (const cls of ['상대', '불명']) {
    const xs = rest.filter((r) => r.class === cls);
    L.push(`## ${cls === '상대' ? '작중 축에 닿지 않음 — 상대(다른 단위와의 앞뒤만)' : '시점 불명'} ${xs.length}`, '');
    const kinds = [...new Set(xs.map((r) => (r.type === '지금' ? r.kind : `조각(${r.type})`)))];
    for (const k of kinds) {
      const ks = xs.filter((r) => (r.type === '지금' ? r.kind : `조각(${r.type})`) === k);
      L.push(`- ${k} ${ks.length}: ${ks.map((r) => (r.type === '지금' ? r.unit : `${r.entry} ${r.unit}`)).join(' · ')}`);
    }
    L.push('');
  }
  return L.join('\n');
}

export function writeTimelineViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [k, f] of Object.entries(FILES)) fs.writeFileSync(path.join(outDir, f), toCsv(v[k], COLUMNS[k]));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderTimelineReport(v, opts));
  fs.writeFileSync(path.join(outDir, 'chrono.md'), renderChronoList(v, opts));
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
  const v = buildTimelineViews(ds, ctx, loadOrder());
  ctx.close();
  const source = displayPath(dir) + '/';
  if (opt.example) console.log(renderTimelineReport(v, { source }));
  else {
    writeTimelineViews(v, TIMELINE_DIR, { source });
    console.log(`→ ${displayPath(TIMELINE_DIR)}/ (${Object.values(FILES).join(' · ')} · report.md · chrono.md)`);
  }
  console.log(`공개 자리 ${v.rel.ticks.length} · 사실 · 의문 ${v.roots.length} · 단계 줄 ${v.rows.length} · 이벤트 ${v.events.length}${v.problems.length ? ` · 문제 ${v.problems.length}` : ''}`);
}
