/**
 * B0a — 1회독 기록만으로 시각화 시안을 뽑는다. 무엇을 보여 줄지(다섯 화면)와 칸의 출처는 docs/views.md.
 *
 *   node tools/views/draft.mjs                 → data/views/read1/ (커밋한다)
 *   node tools/views/draft.mjs --example       예시 기록(tests/fixtures/read1)으로 — 결과는 --out을 줄 때만 쓴다
 *   node tools/views/draft.mjs --dir <기록 디렉터리> --out <출력 디렉터리>
 *
 * 출력:
 *   units.csv        단위별 — 읽는 자리 · 글자 수 · 사실 · 의문 · 회수 · 드러냄 · 뒤집음 · 새 대상 · 의문 상태 · 이어진 단위 수 · 줄기 · 등급 · 2회독 층
 *   scene-edges.csv  씬 → 씬 엣지 — 사건(회수 · 드러냄 · 뒤집음) 하나에 하나
 *   unit-edges.csv   단위 → 단위 엣지 — (from, to, 타입)마다 사건 수
 *   questions.csv    의문별 — 상태 · 회수 · 답 · 걸린 거리(읽는 자리 차이) · about
 *   targets.csv      대상별 — about으로 센 사실 · 의문 · 사건 · 나온 단위 · 처음/마지막 단위
 *   threads.csv      떡밥 줄기별(B0b) — 중요도 · 의문 상태 · 든 사실 · 걸친 단위 · 관계 수
 *   report.md        요약 · 종류별 표 · 빈 곳
 *   layers.md        2회독 층 표(B0b-2) — 층 · 종류별로 단위 · 등급 · 근거 한 건 · 이유 (사용자가 훑어보는 곳)
 * 규칙은 tools/views/read1.mjs 머리말. 기록 문장(사실 · 의문)은 Claude가 쓴 요약이고 원문 대사는 담지 않는다.
 *
 * C1 — 2회독 기록을 얹은 시안도 같이 뽑는다 → data/views/read2/ (규칙은 tools/views/read2.mjs 머리말):
 *   units.csv        단위별 — 2회독 기록 수(암시 언급 · 정체 · 암시 · 재언급 · 기준 · 변화 · 생활상 · 바로잡기) · 만 자당 · 이어진 단위 수(1회독 → 합친 것)
 *   scene-edges.csv  2회독 떡밥 엣지(암시 → setup_payoff, 재언급 → callback)
 *   unit-edges.csv   단위 → 단위 엣지 — 1회독 · 2회독 수를 따로
 *   sessions.csv     2회독 세션별 촘촘함 — 만 자당 기록 · 추정 비율
 *   threads.csv      떡밥 줄기별 — 2회독 암시 · 재언급 수, 2회독이 줄기에 더한 단위
 *   changes.csv      인물 변화 타임라인(출시순)
 *   persons.csv      인물별 — 기준 · 변화 · 측면 · 관계 상대로 나온 수 · 암시 언급 · 정체 줄
 *   life.csv         세계 생활상
 *   report.md        화면별로 2회독이 더한 것 · 촘촘함 · 남은 빈 곳
 *
 * X1a — 공개 축(공개 자리 · 진실 공개 단계 · 컷오프 · 이벤트 메타데이터) · X1b–X1d — 작중 연대기(작중 자리 · 출시순과 어긋남 · 작중 순서 · 인물 변화의 작중 시점)도 같이 뽑는다
 *   → data/views/timeline/ (tools/views/timeline.mjs)
 *
 * X2 — 관계선(스토리 사이 엣지 한 목록 — 게임 · 다음 편 · 기록 · 대상 공유 · 수동)도 같이 뽑는다 → data/views/links/ (tools/views/links.mjs)
 *
 * X3 — 중요도 판정 시안 표(판정 · 기준 시점 · 이력 · 2회독을 얹은 시안 · 다시 볼 단위)도 같이 뽑는다 → data/views/importance/ (tools/views/importance.mjs)
 * X3f-1c — 척추 선정 계산(문 · ⓐ · ⓒ · ⓑ)도 같은 디렉터리에 → spine.md · spine.csv (tools/views/spine.mjs)
 * X3g-1b — 주요 인물 계산(말한 씬 × 변화 줄 · 끊는 선 · 변형)도 같은 디렉터리에 → majors.md · majors.csv (tools/views/majors.mjs)
 * X3f-1d — 빌드업 마무리((가) 긴 회수 · 복선의 답 · (나) · (다) 마무리 기록과 사슬)도 같이 뽑는다 → data/views/closures/ (tools/views/closures.mjs)
 * X3d — 인물별 집계(등장 합치기 · 함께 나옴 · 기록 · 줄기 · 변화 · 마무리 — 화면 5)도 같이 뽑는다 → data/views/persons/ (tools/views/persons.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, GRADES, READ1_DIR, ROOT, displayPath, loadDataset } from '../records/model.mjs';
import { KIND_ORDER, loadOrder, loadReadLayers } from '../records/order.mjs';
import { RARE_TARGET_UNITS, buildRead1Views } from './read1.mjs';
import { buildRead2Views } from './read2.mjs';
import { TIMELINE_DIR, buildTimelineViews, renderTimelineReport, writeTimelineViews } from './timeline.mjs';
import { LINKS_DIR, buildLinks, renderLinksReport, writeLinksViews } from './links.mjs';
import { IMPORTANCE_DIR, buildImportance, renderImportanceReport, writeImportanceViews } from './importance.mjs';
import { LEADS_DIR, buildLeads, renderLeadsReport, writeLeadsViews } from './leads.mjs';
import { renderSpineReport, spineMetrics, writeSpineViews } from './spine.mjs';
import { majorMetrics, renderMajorsReport, writeMajorsViews } from './majors.mjs';
import { CLOSURES_DIR, buildClosures, renderClosuresReport, writeClosuresViews } from './closures.mjs';
import { PERSONS_DIR, buildPersons, renderPersonsReport, writePersonsViews } from './persons.mjs';

export const VIEWS_DIR = path.join(ROOT, 'data/views/read1');
export const VIEWS2_DIR = path.join(ROOT, 'data/views/read2');

const COLUMNS = {
  units: ['order', 'unit', 'session', 'kind', 'title', 'chars', 'facts', 'questions', 'payoffs', 'reveals', 'reversals', 'times', 'new_targets',
    'asked_open', 'asked_partial', 'asked_solved', 'in_units', 'out_units', 'records', 'per_10k', 'slips', 'unconfirmed', 'main_in', 'main_out', 'main_records', 'threads', 'thread_weight',
    'grade', 'layer', 'layer_basis', 'layer_status'],
  sceneEdges: ['type', 'record', 'parent', 'from_scene', 'to_scene', 'from_unit', 'to_unit', 'from_order', 'to_order', 'degree', 'answer', 'confidence', 'status'],
  unitEdges: ['from_unit', 'to_unit', 'type', 'count', 'unconfirmed', 'from_order', 'to_order', 'from_kind', 'to_kind', 'records'],
  questions: ['id', 'unit', 'order', 'scene', 'state', 'payoffs', 'payoff_units', 'answers', 'span', 'about', 'status', 'text'],
  targets: ['target', 'type', 'name', 'facts', 'questions', 'open_questions', 'events', 'units', 'first_unit', 'first_order', 'last_unit', 'last_order',
    'introduced_in', 'links'],
  threads: ['id', 'weight', 'status', 'title', 'questions', 'open', 'partial', 'solved', 'events', 'facts', 'about_facts', 'units', 'main_units',
    'first_unit', 'first_order', 'last_unit', 'last_order', 'relations', 'text'],
};
const FILES = { units: 'units.csv', sceneEdges: 'scene-edges.csv', unitEdges: 'unit-edges.csv', questions: 'questions.csv', targets: 'targets.csv', threads: 'threads.csv' };
const COLUMNS2 = {
  units: ['order', 'unit', 'kind', 'layer', 'grade', 'read2', 'session2', 'chars', 'implied', 'speaker', 'hints', 'callbacks', 'baselines', 'changes', 'life', 'fixes',
    'records2', 'per_10k2', 'records1', 'per_10k1', 'in1', 'out1', 'in_all', 'out_all', 'main_in1', 'main_out1', 'main_in_all', 'main_out_all', 'unknown_lines', 'unknown_done'],
  sceneEdges: ['type', 'record', 'act', 'point', 'from_scene', 'to_scene', 'from_unit', 'to_unit', 'from_order', 'to_order', 'confidence', 'status'],
  unitEdges: ['from_unit', 'to_unit', 'type', 'count', 'read1', 'read2', 'from_order', 'to_order', 'from_kind', 'to_kind', 'records'],
  sessions: ['session', 'units', 'chars', 'records', 'per_10k', 'mentions', 'echoes', 'changes', 'life', 'fixes', 'guess', 'guess_pct'],
  threads: ['id', 'weight', 'title', 'hints', 'callbacks', 'thread_only', 'units1', 'units_all', 'added_units', 'added'],
  changes: ['id', 'person', 'name', 'aspect', 'act', 'with', 'before', 'after', 'text', 'unit', 'order', 'scene', 'trigger_scene', 'trigger_unit', 'time', 'points', 'confidence', 'status'],
  persons: ['target', 'name', 'baselines', 'changes', 'aspects', 'partner', 'implied', 'speaker_lines', 'echoes_about', 'life_about', 'change_units', 'first_order', 'last_order', 'facts1', 'questions1'],
  life: ['id', 'topic', 'unit', 'order', 'scene', 'about', 'points', 'text', 'confidence', 'status'],
};
const FILES2 = { units: 'units.csv', sceneEdges: 'scene-edges.csv', unitEdges: 'unit-edges.csv', sessions: 'sessions.csv', threads: 'threads.csv',
  changes: 'changes.csv', persons: 'persons.csv', life: 'life.csv' };

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';

const TYPE_LABEL = { setup_payoff: '회수(setup_payoff)', callback: '드러냄(callback)', reversal: '뒤집음(reversal)' };
const KIND_SHORT = { 메인: '메인', 서브퀘스트: '서브', 유실물: '유실물', 사이드: '사이드', 이벤트: '이벤트', 호감도: '호감도', '그 밖': '그 밖' };

/** report.md — 숫자와 ID만. 같은 기록이면 같은 글 */
export function renderReport(v, { source }) {
  const L = [];
  const t = v.totals;
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  const sum = (rows, f) => rows.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  const byType = new Map();
  for (const e of v.sceneEdges) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);

  L.push('# 1회독 시안 — 다섯 화면에서 거꾸로 (B0a)', '');
  L.push(`\`node tools/views/draft.mjs\`가 만든다(손으로 고치지 않는다). 입력: ${source} · docs/history/reading.md R 항목 순서 · DB(글자 수 · 대상 이름).`);
  L.push('무엇을 보여 줄지 · 칸의 출처 · 이 결과에서 본 빈 곳은 [docs/views.md](../../../docs/views.md). 시트는 쓰지 않았다.', '');
  L.push('## 한눈에', '');
  L.push(`- 단위 ${t.units}(파트를 나눠 읽은 단위는 하나로) · 사실 ${t.facts} · 의문 ${t.questions} · 사건 ${t.events} · 시점 ${t.times} — 기각 뺌, 확정 아닌 기록 ${t.unconfirmed}.`);
  L.push(`- 씬 → 씬 엣지 ${v.sceneEdges.length}: ${[...byType].map(([k, n]) => `${TYPE_LABEL[k] ?? k} ${n}`).join(' · ')}.`);
  L.push(`- 단위 → 단위 엣지 ${v.unitEdges.length}쌍(타입별) — 같은 단위 안 사건 ${v.gaps.internalEdges}건은 단위 그래프에서 뺐다.`);
  const isolated = v.units.filter((u) => !u.in_units && !u.out_units);
  const empty = v.units.filter((u) => !u.records);
  L.push(`- 이어진 단위가 없는 단위 ${isolated.length}/${t.units} (${pct(isolated.length, t.units)}) · 사실 · 의문 · 사건이 하나도 없는 단위 ${empty.length}.`, '');

  // 종류별
  L.push('## 종류별', '');
  L.push('| 종류 | 단위 | 글자 | 사실 | 의문 | 회수 | 드러냄 · 뒤집음 | 새 대상 | 기록 0 | 연결 0 | 만 자당 기록 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of KIND_ORDER) {
    const us = v.units.filter((u) => u.kind === k);
    if (!us.length) continue;
    const chars = sum(us, 'chars');
    const recs = sum(us, 'records');
    L.push(`| ${k} | ${us.length} | ${(chars / 1e4).toFixed(1)}만 | ${sum(us, 'facts')} | ${sum(us, 'questions')} | ${sum(us, 'payoffs')} | ${sum(us, 'reveals') + sum(us, 'reversals')} | ${sum(us, 'new_targets')} | ${us.filter((u) => !u.records).length} | ${us.filter((u) => !u.in_units && !u.out_units).length} | ${chars ? ((recs / chars) * 1e4).toFixed(1) : '-'} |`);
  }
  L.push('', '기록 = 사실 + 의문 + 회수 + 드러냄 + 뒤집음(시점 · 새 대상 빼고). 글자 = 범위 안 대사 본문 글자 수.', '');

  // 종류 → 종류
  L.push('## 종류 → 종류 엣지 (단위 → 단위, 사건 수)', '');
  const kinds = KIND_ORDER.filter((k) => v.units.some((u) => u.kind === k));
  const mat = new Map();
  for (const e of v.unitEdges) mat.set(`${e.from_kind}>${e.to_kind}`, (mat.get(`${e.from_kind}>${e.to_kind}`) ?? 0) + e.count);
  L.push(`| from ＼ to | ${kinds.map((k) => KIND_SHORT[k]).join(' | ')} |`, `|---|${kinds.map(() => '---:').join('|')}|`);
  for (const a of kinds) L.push(`| ${KIND_SHORT[a]} | ${kinds.map((b) => mat.get(`${a}>${b}`) ?? '').join(' | ')} |`);
  L.push('', 'from = 의문 · 사실이 처음 기록된 단위, to = 회수 · 다시 드러냄 · 뒤집음이 기록된 단위.', '');

  // 위 단위들
  const top = (rows, score, n, fmt) => rows.slice().sort((a, b) => score(b) - score(a) || a.order - b.order).slice(0, n).map(fmt);
  L.push('## 기록이 많은 단위 (위 15)', '');
  L.push('| 자리 | 단위 | 종류 | 사실 | 의문 | 회수 | 드러냄 · 뒤집음 | 새 대상 | 이어진 단위 (앞 · 뒤) |', '|---:|---|---|---:|---:|---:|---:|---:|---|');
  L.push(...top(v.units, (u) => u.records, 15, (u) => `| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.facts} | ${u.questions} | ${u.payoffs} | ${u.reveals + u.reversals} | ${u.new_targets} | ${u.in_units} · ${u.out_units} |`), '');
  L.push('## 이어진 단위가 많은 단위 (위 15)', '');
  L.push('| 자리 | 단위 | 종류 | 앞에서 오는 단위 | 뒤로 가는 단위 | 기록 |', '|---:|---|---|---:|---:|---:|');
  L.push(...top(v.units, (u) => u.in_units + u.out_units, 15, (u) => `| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.in_units} | ${u.out_units} | ${u.records} |`), '');
  // 메인 밖 단위 — 메인과 이어진 기록 (중요도 판정 입력)
  const outside = v.units.filter((u) => u.kind !== '메인');
  const linked = outside.filter((u) => u.main_in || u.main_out);
  L.push('## 메인 밖 단위 — 메인과 이어진 기록 (중요도 판정 입력)', '');
  L.push('중요도는 "메인 · 세계관을 이해하는 데 꼭 알아야 하는가"를 **가장 묵직한 한 건**으로 판정하고, 메인은 채점하지 않는다(사용자, 2026-10-04 — docs/views.md 화면 1).',
    '아래는 판정이 아니라 입력이다: in = 메인의 의문 · 사실이 여기서 회수 · 다시 드러남 · 뒤집힘, out = 여기의 의문 · 사실이 메인에서 그렇게 됨.', '');
  L.push(`메인과 이어진 기록이 있는 메인 밖 단위 ${linked.length}/${outside.length} — ` + KIND_ORDER.filter((k) => k !== '메인')
    .map((k) => [k, outside.filter((u) => u.kind === k)]).filter(([, us]) => us.length)
    .map(([k, us]) => `${k} ${us.filter((u) => u.main_in || u.main_out).length}/${us.length}`).join(' · '), '');
  L.push('| 자리 | 단위 | 종류 | in · out | 기록 (in/out:ID(정도)@메인) |', '|---:|---|---|---|---|');
  L.push(...linked.slice().sort((a, b) => b.main_in + b.main_out - (a.main_in + a.main_out) || a.order - b.order).slice(0, 20)
    .map((u) => `| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.main_in} · ${u.main_out} | ${u.main_records} |`), '');
  L.push(`(위 20 — 전체는 units.csv의 main_in · main_out · main_records)`, '');

  L.push('## 이벤트 · 사이드 · 호감도 중 이어진 단위가 많은 것 (위 10)', '');
  L.push('| 자리 | 단위 | 종류 | 앞 · 뒤 | 기록 |', '|---:|---|---|---|---:|');
  L.push(...top(v.units.filter((u) => ['이벤트', '사이드', '호감도'].includes(u.kind)), (u) => u.in_units + u.out_units, 10,
    (u) => `| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.in_units} · ${u.out_units} | ${u.records} |`), '');

  // 의문
  const qs = v.questions;
  const st = (s) => qs.filter((q) => q.state === s).length;
  L.push('## 의문 — 떡밥 흐름 시안', '');
  L.push(`의문 ${qs.length} — 열림 ${st('열림')} · 일부 풀림 ${st('일부')} · 풀림 ${st('풀림')}. 회수가 다른 단위에서 난 의문 ${qs.filter((q) => q.payoff_units && q.payoff_units.split(' ').some((u) => u !== q.unit)).length}.`, '');
  L.push('| 종류(제기) | 의문 | 열림 | 일부 | 풀림 |', '|---|---:|---:|---:|---:|');
  for (const k of KIND_ORDER) {
    const list = qs.filter((q) => v.units.find((u) => u.unit === q.unit)?.kind === k);
    if (list.length) L.push(`| ${k} | ${list.length} | ${list.filter((q) => q.state === '열림').length} | ${list.filter((q) => q.state === '일부').length} | ${list.filter((q) => q.state === '풀림').length} |`);
  }
  L.push('', '오래 걸려 풀린 의문 (마지막 회수까지 읽는 자리 차이, 위 10):', '');
  L.push(...qs.filter((q) => q.span !== '').sort((a, b) => b.span - a.span || a.order - b.order).slice(0, 10)
    .map((q) => `- ${q.id} \`${q.unit}\` → ${q.payoff_units.split(' ').map((u) => `\`${u}\``).join(' ')} · ${q.span}칸 · ${q.state}`), '');

  // 떡밥 줄기 (B0b)
  if (v.threads.length) {
    const W = ['뼈대', '보강', '독립'];
    L.push('## 떡밥 줄기 — 흐름 · 관계 시안 (B0b)', '');
    L.push(`줄기 ${v.threads.length} — ${W.map((w) => `${w} ${v.threads.filter((t) => t.weight === w).length}`).join(' · ')}. 줄기 파일 annotations/threads.json, 소속 계산 tools/records/threads.mjs.`, '');
    L.push('| 중요도 | 줄기 | 의문 | 열림 | 곧바로 든 사실 | about으로 든 사실 | 걸친 단위 (메인) |', '|---|---:|---:|---:|---:|---:|---:|');
    for (const w of W) {
      const ts = v.threads.filter((t) => t.weight === w);
      if (ts.length) L.push(`| ${w} | ${ts.length} | ${sum(ts, 'questions')} | ${sum(ts, 'open')} | ${sum(ts, 'facts')} | ${sum(ts, 'about_facts')} | ${sum(ts, 'units')} (${sum(ts, 'main_units')}) |`);
    }
    L.push('', '뼈대 줄기:', '');
    L.push(...v.threads.filter((t) => t.weight === '뼈대')
      .map((t) => `- ${t.id} ${t.title} — 의문 ${t.questions}(열림 ${t.open}) · 사실 ${t.facts} · 단위 ${t.units}(메인 ${t.main_units}) · 관계 ${t.relations} · \`${t.first_unit}\` → \`${t.last_unit}\``), '');
    const byW = (w) => v.units.filter((u) => u.kind !== '메인' && u.thread_weight === w).length;
    const outside = v.units.filter((u) => u.kind !== '메인');
    L.push(`메인 밖 단위 ${outside.length} 가운데 기록이 뼈대 줄기에 든 단위 ${byW('뼈대')} · 보강까지 ${byW('보강')} · 독립 줄기만 ${byW('독립')} · 줄기 없음 ${outside.filter((u) => !u.threads).length} (층 나누기 입력 — 단위의 기록이 줄기에 들었는지만 본다).`, '');
  }

  // 2회독 층 (B0b-2)
  if (v.units.some((u) => u.layer !== '')) {
    const kinds = [...new Set(v.units.map((u) => u.kind))];
    const cell = (us) => (us.length ? `${us.length} · ${(sum(us, 'chars') / 10000).toFixed(1)}만 자` : '');
    const outside = v.units.filter((u) => u.kind !== '메인');
    L.push('## 2회독 층 · 중요도 첫 시안 (B0b-2)', '');
    L.push('메인 밖 단위마다 등급(필수 · 보강 · 참고 · 독립)과 그것을 정한 한 건을 annotations/layers.json에 적고, 층은 종류 + 등급으로 계산한다(tools/records/layers.mjs).',
      `등급: ${GRADES.map((g) => `${g} ${outside.filter((u) => u.grade === g).length}`).join(' · ')}${outside.some((u) => !u.grade) ? ` · 판정 없음 ${outside.filter((u) => !u.grade).length}` : ''}.`, '');
    L.push('| 종류 | 1층 | 2층 | 3층 |', '|---|---:|---:|---:|');
    for (const k of KIND_ORDER.filter((x) => kinds.includes(x))) {
      const us = v.units.filter((u) => u.kind === k);
      L.push(`| ${k} | ${[1, 2, 3].map((n) => cell(us.filter((u) => u.layer === n))).join(' | ')} |`);
    }
    L.push(`| 합 | ${[1, 2, 3].map((n) => cell(v.units.filter((u) => u.layer === n))).join(' | ')} |`, '');
    const must = outside.filter((u) => u.grade === '필수');
    if (must.length) L.push(`필수: ${must.map((u) => `\`${u.unit}\`(${u.layer_basis})`).join(' · ')}`, '');
  }

  // 대상
  const tt = new Map();
  for (const r of v.targets) tt.set(r.type, (tt.get(r.type) ?? 0) + 1);
  L.push('## 대상 — 인물별 집계 · 개념 시안 (about)', '');
  L.push(`기록(about · 새 대상 · 정체 연결)에 나온 대상 ${v.targets.length}: ${[...tt].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}.`, '');
  for (const [type, label, n] of [['person', '인물', 20], ['concept', '개념', 12], ['org', '조직', 8], ['place', '장소', 8]]) {
    const rows = v.targets.filter((r) => r.type === type).slice(0, n);
    if (!rows.length) continue;
    L.push(`${label} (사실 + 의문 순, 위 ${n}): ${rows.map((r) => `${r.name} ${r.facts}·${r.questions}(열림 ${r.open_questions})`).join(' / ')}`, '');
  }
  const persons = v.targets.filter((r) => r.type === 'person');
  const thin = persons.filter((r) => r.facts + r.questions <= 2).length;
  L.push(`인물 ${persons.length}명 중 사실 + 의문 2건 이하 ${thin}명 (${pct(thin, persons.length)}).`, '');

  // 빈 곳
  const g = v.gaps;
  L.push('## 빈 곳 — docs/views.md "빈 곳"이 이 숫자를 쓴다', '');
  L.push('| 무엇 | 수 |', '|---|---:|');
  L.push(`| about이 빈 사실 · 의문 정의 | ${g.defsWithoutAbout} / ${t.facts + t.questions} |`);
  L.push(`| 근거가 여러 씬인 사실 정의 | ${g.multiSceneFacts} / ${t.facts} |`);
  L.push(`| 근거가 여러 단위에 걸친 사실 · 의문 정의 (사건 없이 숨은 연결) | ${g.crossUnitEvidence} |`);
  L.push(`| 회수의 답(사실)이 다른 단위에 있는 것 | ${g.answerElsewhere} |`);
  L.push(`| 같은 단위 안 사건 (단위 그래프에서 빠짐) | ${g.internalEdges} |`);
  L.push(`| 이어진 단위가 없는 단위 중 about 대상을 다른 단위와 나누는 것 — 드문 대상(${RARE_TARGET_UNITS}단위 이하) · 아무 대상 | ${g.isolatedSharingRare} · ${g.isolatedSharingAny} / ${g.isolated} |`);
  L.push(`| 시점 기준(ref) | ${Object.entries(g.timeRefs).map(([k, n]) => `${k} ${n}`).join(' · ')} |`);
  L.push(`| 기록 파일이 없는 단위 | ${g.unitsWithoutFile.length}${g.unitsWithoutFile.length ? ` (${g.unitsWithoutFile.slice(0, 10).join(' ')})` : ''} |`);
  L.push('');
  L.push('이어진 단위가 없는 단위(종류별): ' + KIND_ORDER.map((k) => [k, v.units.filter((u) => u.kind === k)]).filter(([, us]) => us.length)
    .map(([k, us]) => `${k} ${us.filter((u) => !u.in_units && !u.out_units).length}/${us.length}`).join(' · '), '');

  // 설정 오류
  L.push(`## 설정 오류 추정 (slips ${v.slips.length}) — 엣지로 올리지 않는다(docs/schema.md "엣지 타입")`, '');
  L.push(...v.slips.map((s) => `- \`${s.unit}\` — ${s.text}`), '');

  if (v.problems.length || g.strayUnits.length) {
    L.push('## 문제', '');
    L.push(...v.problems.map((p) => `- ${p}`), ...g.strayUnits.map((u) => `- 읽는 순서에 없는 단위에 기록이 있다: ${u}`), '');
  }
  return L.join('\n');
}

export function writeViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [k, f] of Object.entries(FILES)) fs.writeFileSync(path.join(outDir, f), toCsv(v[k], COLUMNS[k]));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(v, opts));
  if (v.units.some((u) => u.layer !== '')) fs.writeFileSync(path.join(outDir, 'layers.md'), renderLayers(v, opts));
}

/** 층 표 — 층마다 종류별로, 읽는 자리 순. 이유는 Claude가 쓴 판정 문장(원문 대사가 아니다) */
export function renderLayers(v, { source }) {
  const cell = (t) => String(t ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ');
  const L = [`# 2회독 층 표 (B0b-2) — ${source}`, '',
    '메인 밖 단위마다 등급(필수 · 보강 · 독립)과 그것을 정한 한 건(근거)을 annotations/layers.json에 적고, 층은 종류 + 등급으로 계산한다.',
    '규칙: 메인 · 서브퀘스트 · 유실물 1층 / 사이드 · 이벤트 필수 · 보강 1층, 독립 2층(기록 2건 이하 일상극 3층) / 이벤트 유실물은 그 이벤트 / 호감도 필수 1층 · 보강 2층 · 독립 3층.',
    '뒤집기: `node tools/records.mjs set <K…> 확정 --by 사용자 --grade 보강 --note "…"` (층만은 `--layer 2`). 형식 · 규칙은 docs/annotations.md "층 판정".',
    '다시 뽑기: `node tools/views/draft.mjs`.', ''];
  const kinds = KIND_ORDER.filter((k) => v.units.some((u) => u.kind === k));
  for (const n of [1, 2, 3]) {
    const us = v.units.filter((u) => u.layer === n);
    L.push(`## ${n}층 — ${us.length}단위 · ${(us.reduce((a, u) => a + u.chars, 0) / 10000).toFixed(1)}만 자`, '');
    for (const k of kinds) {
      const ks = us.filter((u) => u.kind === k);
      if (!ks.length) continue;
      if (k === '메인') {
        L.push(`### 메인 ${ks.length} — 채점하지 않는다`, '', ks.map((u) => `\`${u.unit}\``).join(' '), '');
        continue;
      }
      const g = (x) => ks.filter((u) => u.grade === x).length;
      L.push(`### ${k} ${ks.length} — 필수 ${g('필수')} · 보강 ${g('보강')} · 독립 ${g('독립')}`, '');
      L.push('| 자리 | 판정 | 단위 | 제목 | 등급 | 근거 | 이유 |', '|---:|---|---|---|---|---|---|');
      for (const u of ks) {
        const over = u.layer_over ? ` (규칙 ${u.layer_over}층을 뒤집음)` : '';
        L.push(`| ${u.order} | ${u.layer_id} | \`${u.unit}\` | ${cell(u.title)} | ${u.grade}${over} | ${u.layer_basis || '—'} | ${cell(u.layer_reason)} |`);
      }
      L.push('');
    }
  }
  return L.join('\n');
}

/** read2/report.md — 화면별로 2회독이 더한 것 · 촘촘함 · 남은 빈 곳. 숫자와 ID만, 같은 기록이면 같은 글 */
export function renderRead2Report(v1, v2, { source }) {
  const L = [];
  const t = v2.totals;
  const g = v2.gaps;
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');
  const sum = (rows, f) => rows.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  const read = v2.units.filter((u) => u.read2);
  const layers = [...new Set(read.map((u) => u.layer))].filter((x) => x !== '').sort();
  const iso1 = (us) => us.filter((u) => !u.in1 && !u.out1).length;
  const isoAll = (us) => us.filter((u) => !u.in_all && !u.out_all).length;
  const e1 = v1.sceneEdges.length;
  const byType = (rows) => ['setup_payoff', 'callback', 'reversal'].map((k) => [k, rows.filter((r) => r.type === k).length]);

  L.push('# 2회독을 얹은 시안 — 1회독 + 2회독 (C1)', '');
  L.push(`\`node tools/views/draft.mjs\`가 만든다(손으로 고치지 않는다). 입력: ${source} · 2회독 기록 · docs/history/reading.md R 항목 순서(출시순 한 줄) · DB.`);
  L.push('1회독만의 시안은 [../read1/report.md](../read1/report.md), 화면 · 칸의 출처는 [docs/views.md](../../../docs/views.md). 시트는 쓰지 않았다.', '');
  L.push('## 한눈에', '');
  L.push(`- 2회독한 단위 ${read.length}/${v2.units.length}${layers.length ? ` (층 ${layers.join(' · ')})` : ''} · 원문 ${(sum(read, 'chars') / 1e4).toFixed(1)}만 자.`);
  L.push(`- 2회독 기록 ${t.mentions + t.echoes + t.changes + t.life}: 암시 언급 ${t.mentions}(\`???\` 정체 ${t.speaker}) · 떡밥 ${t.echoes}(암시 ${t.hints} · 재언급 ${t.callbacks}) · 인물 변화 ${t.changes}(기준 ${t.baselines} · 변화 ${t.changes - t.baselines}) · 생활상 ${t.life}. 추정 ${t.guess}(${pct(t.guess, t.mentions + t.echoes + t.changes + t.life)}) · 기각 ${t.rejected} · 확정 아닌 기록 ${t.unconfirmed}.`);
  L.push(`- 1회독 바로잡기: 더한 항목 ${t.fixesAdded} · 2회독이 다시 본 1회독 기록(검토 기록) ${t.fixesReviewed}.`);
  L.push(`- 2회독 기록 1만 자당 ${(sum(read, 'records2') / sum(read, 'chars') * 1e4).toFixed(1)}건 — 같은 단위의 1회독 기록은 ${(sum(read, 'records1') / sum(read, 'chars') * 1e4).toFixed(1)}건.`, '');

  // 화면 1
  const out1 = read.filter((u) => u.kind !== '메인');
  const mainLinked1 = out1.filter((u) => Number(u.main_in1) || Number(u.main_out1));
  const mainLinkedAll = out1.filter((u) => Number(u.main_in_all) || Number(u.main_out_all));
  L.push('## 화면 1 · 중요도 — 메인과 이어진 메인 밖 단위', '');
  L.push(`2회독한 메인 밖 단위 ${out1.length} 가운데 메인과 기록으로 이어진 단위: 1회독 ${mainLinked1.length} → 2회독 더해 ${mainLinkedAll.length}.`, '');
  L.push('| 등급 | 단위 | 1회독 | + 2회독 |', '|---|---:|---:|---:|');
  for (const gr of GRADES) {
    const us = out1.filter((u) => u.grade === gr);
    if (us.length) L.push(`| ${gr} | ${us.length} | ${us.filter((u) => Number(u.main_in1) || Number(u.main_out1)).length} | ${us.filter((u) => Number(u.main_in_all) || Number(u.main_out_all)).length} |`);
  }
  L.push('', '2회독으로 메인과 처음 이어진 단위 (메인과 오가는 엣지 수 순, 위 15):', '');
  const newly = mainLinkedAll.filter((u) => !mainLinked1.includes(u))
    .sort((a, b) => b.main_in_all + b.main_out_all - (a.main_in_all + a.main_out_all) || a.order - b.order);
  L.push('| 자리 | 단위 | 종류 | 등급 | in · out |', '|---:|---|---|---|---|');
  L.push(...newly.slice(0, 15).map((u) => `| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.grade} | ${u.main_in_all} · ${u.main_out_all} |`));
  L.push('', `(모두 ${newly.length} — units.csv의 main_in_all · main_out_all. 등급은 층 판정(B0b-2) 그대로다 — 다시 판정은 X3.)`, '');

  // 화면 2
  L.push('## 화면 2 · 스토리 간 연결', '');
  L.push(`- 씬 엣지: 1회독 ${e1}(${byType(v1.sceneEdges).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}) + 2회독 ${v2.sceneEdges.length}(${byType(v2.sceneEdges).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}).`);
  L.push(`- 단위 → 단위 엣지(타입별 쌍): 1회독 ${v1.unitEdges.length} → 합쳐 ${v2.unitEdges.length}. 2회독 엣지 중 같은 단위 안 ${g.internal2}건은 단위 그래프에서 뺐다.`);
  L.push(`- 이어진 단위가 없는 단위: 2회독한 단위 ${read.length} 중 ${iso1(read)} → ${isoAll(read)} · 전체 ${v2.units.length} 중 ${iso1(v2.units)} → ${isoAll(v2.units)}(2회독이 아직 안 읽은 단위의 사실을 재언급해 이어진 것 포함).`, '');
  L.push('| 종류 | 2회독한 단위 | 연결 0 (1회독) | 연결 0 (+ 2회독) |', '|---|---:|---:|---:|');
  for (const k of KIND_ORDER) {
    const us = read.filter((u) => u.kind === k);
    if (us.length) L.push(`| ${k} | ${us.length} | ${iso1(us)} | ${isoAll(us)} |`);
  }
  const kinds = KIND_ORDER.filter((k) => v2.units.some((u) => u.kind === k));
  const mat = new Map();
  for (const e of v2.unitEdges) if (e.read2) mat.set(`${e.from_kind}>${e.to_kind}`, (mat.get(`${e.from_kind}>${e.to_kind}`) ?? 0) + e.read2);
  L.push('', '2회독 엣지만 — 종류 → 종류 (엣지 수):', '');
  L.push(`| from ＼ to | ${kinds.map((k) => KIND_SHORT[k]).join(' | ')} |`, `|---|${kinds.map(() => '---:').join('|')}|`);
  for (const a of kinds) L.push(`| ${KIND_SHORT[a]} | ${kinds.map((b) => mat.get(`${a}>${b}`) ?? '').join(' | ')} |`);
  L.push('', '이어진 단위가 많아진 단위 (합친 앞 · 뒤 단위 수 − 1회독, 위 10):', '');
  const grow = read.map((u) => ({ ...u, d: u.in_all + u.out_all - u.in1 - u.out1 })).filter((u) => u.d > 0).sort((a, b) => b.d - a.d || a.order - b.order);
  L.push('| 자리 | 단위 | 종류 | 앞 · 뒤 (1회독) | 앞 · 뒤 (합침) |', '|---:|---|---|---|---|');
  L.push(...grow.slice(0, 10).map((u) => `| ${u.order} | \`${u.unit}\` | ${u.kind} | ${u.in1} · ${u.out1} | ${u.in_all} · ${u.out_all} |`), '');

  // 화면 3
  const W = ['뼈대', '보강', '독립'];
  L.push('## 화면 3 · 떡밥 흐름 — 줄기에 더해진 암시 · 재언급', '');
  L.push('| 줄기 중요도 | 줄기 | 암시 | 재언급 | 걸친 단위 1회독 → 합침 | 2회독이 더한 단위 |', '|---|---:|---:|---:|---|---:|');
  for (const w of W) {
    const ts = v2.threads.filter((x) => x.weight === w);
    if (ts.length) L.push(`| ${w} | ${ts.length} | ${sum(ts, 'hints')} | ${sum(ts, 'callbacks')} | ${sum(ts, 'units1')} → ${sum(ts, 'units_all')} | ${sum(ts, 'added_units')} |`);
  }
  const quiet = v2.threads.filter((x) => !x.hints && !x.callbacks);
  L.push('', `2회독 떡밥이 하나도 안 걸린 줄기 ${quiet.length}: ${quiet.map((x) => `${x.id}(${x.weight})`).join(' · ') || '없음'}.`, '');
  L.push('2회독이 더한 단위가 많은 줄기 (위 10):', '');
  L.push(...v2.threads.slice().sort((a, b) => b.added_units - a.added_units || compareIdsLoose(a.id, b.id)).slice(0, 10)
    .map((x) => `- ${x.id} ${x.weight} ${x.title} — 암시 ${x.hints} · 재언급 ${x.callbacks} · 단위 ${x.units1} → ${x.units_all}`), '');
  L.push(`- 떡밥 ${t.echoes} 중 줄기에 곧바로 안 드는 것 ${g.noThread} — 그중 about으로도 안 닿는 것 ${g.noThreadEvenAbout}. 줄기에 안 든 설정 · 사건 사실을 가리키는 재언급 · 암시다(화면 2 연결에는 든다).`);
  L.push(`- 열린 의문(회수 없음)을 가리키는 암시 ${g.openHints} — 회수가 없어 엣지가 없다(열린 떡밥). 씬 엣지가 하나도 안 나온 떡밥 ${g.noEdge}(줄기만 · 열린 의문만 가리킴).`, '');

  // 화면 4
  const topics = new Map();
  for (const r of v2.life) topics.set(r.topic, (topics.get(r.topic) ?? 0) + 1);
  const about = new Map();
  for (const r of v2.life) for (const a of r.about.split(' ').filter(Boolean)) about.set(a, (about.get(a) ?? 0) + 1);
  L.push('## 화면 4 · 개념 — 곁 패널(세계 생활상)', '');
  L.push(`생활상 ${t.life}: ${[...topics].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')}.`, '');
  L.push(`많이 걸린 대상(about, 위 12): ${[...about].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([k, n]) => `${k.replace(/^[a-z]+:/, '')} ${n}`).join(' · ')}.`);
  L.push(`생활상 중 1회독 사실 · 줄기를 가리키는 것(points) ${v2.life.filter((r) => r.points).length}.`, '');

  // 화면 5
  const P = v2.persons;
  const changed = P.filter((p) => p.baselines + p.changes);
  L.push('## 화면 5 · 인물별 — 변화 타임라인 · 암시 언급', '');
  L.push(`- 인물 변화가 있는 인물 ${changed.length}명 · 변화(기준 빼고) ${t.changes - t.baselines}건이 ${changed.filter((p) => p.changes).length}명에게. 측면: ${aspectTally(v2.changes)}.`);
  L.push(`- 변화 가운데 작중 시점(time) 없는 것 ${g.changesWithoutTime} · 기준 없이 변화만 있는 (인물, 측면) ${g.changesWithoutBaseline}(기준은 다른 층에서 나올 수 있다).`);
  L.push(`- 암시 언급 ${t.mentions}(인물 ${sum(P, 'implied')}). \`???\` 등 미상 이름표 줄: 2회독한 단위 ${sum(read, 'unknown_lines')}줄 중 정체 적음 ${sum(read, 'unknown_done')}줄.`, '');
  L.push('변화가 많은 인물 (기준 + 변화, 위 20):', '');
  L.push('| 인물 | 기준 | 변화 | 측면 | 관계 상대로 | 단위 | 1회독 사실 · 의문 |', '|---|---:|---:|---|---:|---:|---|');
  L.push(...changed.slice(0, 20).map((p) => `| ${p.name} | ${p.baselines} | ${p.changes} | ${p.aspects} | ${p.partner} | ${p.change_units} | ${p.facts1} · ${p.questions1} |`), '');
  const one = changed.filter((p) => p.baselines + p.changes === 1).length;
  L.push(`기록이 하나뿐인 인물 ${one}/${changed.length} · 2–4건 ${changed.filter((p) => p.baselines + p.changes >= 2 && p.baselines + p.changes <= 4).length} · 5건 이상 ${changed.filter((p) => p.baselines + p.changes >= 5).length}.`, '');

  // 촘촘함
  L.push('## 촘촘함 — 2회독 기록이 너무 잘거나 성긴가', '');
  L.push('| 종류 | 단위 | 만 자 | 2회독 기록 | 만 자당 | 암시 언급 | 떡밥 | 인물 변화 | 생활상 | 기록 0 단위 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const k of KIND_ORDER) {
    const us = read.filter((u) => u.kind === k);
    if (!us.length) continue;
    const ch = sum(us, 'chars');
    L.push(`| ${k} | ${us.length} | ${(ch / 1e4).toFixed(1)} | ${sum(us, 'records2')} | ${(sum(us, 'records2') / ch * 1e4).toFixed(1)} | ${sum(us, 'implied') + sum(us, 'speaker')} | ${sum(us, 'hints') + sum(us, 'callbacks')} | ${sum(us, 'baselines') + sum(us, 'changes')} | ${sum(us, 'life')} | ${us.filter((u) => !u.records2).length} |`);
  }
  L.push('', '세션별 (만 자당 기록 · 추정 비율 — 세션이 지나며 기준이 흐르는지 본다):', '');
  L.push('| 세션 | 단위 | 만 자 | 기록 | 만 자당 | 암시 언급 | 떡밥 | 인물 변화 | 생활상 | 바로잡기 | 추정 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  L.push(...v2.sessions.map((x) => `| ${x.session} | ${x.units} | ${(x.chars / 1e4).toFixed(1)} | ${x.records} | ${x.per_10k} | ${x.mentions} | ${x.echoes} | ${x.changes} | ${x.life} | ${x.fixes} | ${x.guess_pct}% |`), '');
  const dens = v2.sessions.map((x) => x.per_10k).sort((a, b) => a - b);
  if (dens.length) L.push(`세션 만 자당: 가장 낮음 ${dens[0]} · 가운데 ${dens[Math.floor(dens.length / 2)]} · 가장 높음 ${dens.at(-1)}.`, '');
  const big = read.filter((u) => u.chars >= 20000);
  if (big.length) {
    const bd = big.slice().sort((a, b) => a.per_10k2 - b.per_10k2);
    L.push(`2만 자 이상 단위 ${big.length} — 만 자당 가장 성긴 5: ${bd.slice(0, 5).map((u) => `\`${u.unit}\` ${u.per_10k2}`).join(' · ')} / 가장 촘촘한 5: ${bd.slice(-5).reverse().map((u) => `\`${u.unit}\` ${u.per_10k2}`).join(' · ')}.`, '');
  }

  if (v2.problems.length) L.push('## 문제', '', ...v2.problems.map((p) => `- ${p}`), '');
  return L.join('\n');
}

const compareIdsLoose = (a, b) => (Number(String(a).slice(1)) || 0) - (Number(String(b).slice(1)) || 0);
function aspectTally(rows) {
  const m = new Map();
  for (const r of rows) if (r.act === '변화') m.set(r.aspect, (m.get(r.aspect) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
}

export function writeViews2(v1, v2, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [k, f] of Object.entries(FILES2)) fs.writeFileSync(path.join(outDir, f), toCsv(v2[k], COLUMNS2[k]));
  fs.writeFileSync(path.join(outDir, 'report.md'), renderRead2Report(v1, v2, opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({ options: { example: { type: 'boolean' }, dir: { type: 'string' }, out: { type: 'string' } } });
  const dir = opt.dir ? path.resolve(opt.dir) : opt.example ? EXAMPLE_DIR : READ1_DIR;
  const out = opt.out ? path.resolve(opt.out) : dir === READ1_DIR ? VIEWS_DIR : null;
  const ds = loadDataset({ dir });
  if (ds.problems.length) {
    for (const p of ds.problems) console.error(`✗ ${p.file}: ${p.msg}`);
    process.exit(1);
  }
  const ctx = await openContext();
  const order = loadOrder();
  const v = buildRead1Views(ds, ctx, order);
  const v2 = buildRead2Views(ds, ctx, order, v);
  const v3 = buildTimelineViews(ds, ctx, order);
  const v4 = buildLinks(ds, ctx, order);
  const v5 = buildImportance(ds, ctx, order, { readLayers: dir === READ1_DIR ? loadReadLayers() : null });
  const v6 = buildLeads(ds, ctx, order);
  const v7 = spineMetrics(ds, ctx, order);
  const v10 = majorMetrics(ds, ctx, order);
  const v8 = buildClosures(ds, ctx, order);
  const v9 = buildPersons(ds, ctx, order, { rel: v3.rel, st: v3.st, ct: { rows: v3.changes } });
  ctx.close();
  const source = displayPath(dir) + '/';
  if (out) {
    writeViews(v, out, { source });
    console.log(`→ ${displayPath(out)}/ (${Object.values(FILES).join(' · ')} · report.md)`);
    const out2 = out === VIEWS_DIR ? VIEWS2_DIR : path.join(out, 'read2');
    writeViews2(v, v2, out2, { source });
    console.log(`→ ${displayPath(out2)}/ (${Object.values(FILES2).join(' · ')} · report.md)`);
    const out3 = out === VIEWS_DIR ? TIMELINE_DIR : path.join(out, 'timeline');
    writeTimelineViews(v3, out3, { source });
    console.log(`→ ${displayPath(out3)}/ (공개 축 X1a · 작중 연대기 X1b–X1d — tools/views/timeline.mjs)`);
    const out4 = out === VIEWS_DIR ? LINKS_DIR : path.join(out, 'links');
    writeLinksViews(v4, out4, { source });
    console.log(`→ ${displayPath(out4)}/ (관계선 X2 — tools/views/links.mjs)`);
    const out5 = out === VIEWS_DIR ? IMPORTANCE_DIR : path.join(out, 'importance');
    writeImportanceViews(v5, out5, { source });
    console.log(`→ ${displayPath(out5)}/ (중요도 판정 X3 — tools/views/importance.mjs)`);
    writeSpineViews(v7, out5, { source });
    console.log(`→ ${displayPath(out5)}/spine.md (척추 선정 계산 X3f-1c — tools/views/spine.mjs)`);
    writeMajorsViews(v10, out5, { source });
    console.log(`→ ${displayPath(out5)}/majors.md (주요 인물 계산 X3g-1b — tools/views/majors.mjs)`);
    const out6 = out === VIEWS_DIR ? LEADS_DIR : path.join(out, 'leads');
    writeLeadsViews(v6, out6, { source });
    console.log(`→ ${displayPath(out6)}/ (주역 명단 X3f — tools/views/leads.mjs)`);
    const out7 = out === VIEWS_DIR ? CLOSURES_DIR : path.join(out, 'closures');
    writeClosuresViews(v8.b, v8.v, out7, { source });
    console.log(`→ ${displayPath(out7)}/ (빌드업 마무리 X3f-1d — tools/views/closures.mjs)`);
    const out8 = out === VIEWS_DIR ? PERSONS_DIR : path.join(out, 'persons');
    writePersonsViews(v9, out8, { source });
    console.log(`→ ${displayPath(out8)}/ (인물별 집계 X3d — tools/views/persons.mjs)`);
  } else console.log(renderReport(v, { source }) + '\n' + renderRead2Report(v, v2, { source }) + '\n' + renderTimelineReport(v3, { source }) + '\n' + renderLinksReport(v4, { source }) +
    '\n' + renderImportanceReport(v5, { source }) + '\n' + renderSpineReport(v7, { source }) + '\n' + renderMajorsReport(v10, { source }) + '\n' + renderLeadsReport(v6, { source }) + '\n' + renderClosuresReport(v8.b, v8.v, { source }) + '\n' + renderPersonsReport(v9, { source }));
  console.log(`단위 ${v.totals.units} · 씬 엣지 ${v.sceneEdges.length} · 단위 엣지 ${v.unitEdges.length} · 의문 ${v.questions.length} · 대상 ${v.targets.length}${v.problems.length ? ` · 문제 ${v.problems.length}` : ''}`);
  console.log(`2회독 — 단위 ${v2.totals.read2Units} · 씬 엣지 ${v2.sceneEdges.length} · 합친 단위 엣지 ${v2.unitEdges.length} · 인물 변화 ${v2.totals.changes}${v2.problems.length ? ` · 문제 ${v2.problems.length}` : ''}`);
}
