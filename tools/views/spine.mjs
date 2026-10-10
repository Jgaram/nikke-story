/**
 * X3f-1b · 1c — 척추 선정 계산(T3-6, docs/importance.md 1절). 척추 = 메인 ch00–ch48 + 게임이 큰 이야기로 내놓은 이벤트 · 사이드 가운데
 * 메인의 뼈대를 메인과 함께 나르는 것. 고르는 것은 Claude(annotations/spine.json B<n> — 확정 = 척추 · 기각 = 문 안이지만 미달), 사용자는 기준을 조율 · 뒤집는다.
 *
 *   node tools/views/spine.mjs             → data/views/importance/spine.md · spine.csv (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/spine.mjs --example   예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *
 * 문 · 셋의 수(단위마다 — 원문은 읽지 않는다, 기록 · 줄기 · 공개 자리에서 기계로):
 *   문   큰 이야기로 내놓음 — 주년 · 반주년 · 연말 · 신년 업데이트의 스토리 이벤트(공식 공지 data/raw/notices/, 근거는 spine.json notice)와 사이드 스토리.
 *        공지는 기계로 읽지 않는다 — 문 안 단위는 Claude가 spine.json에 적는다(신작마다). 문 밖 이벤트는 무거워도 척추가 아니다(필수와 겹치지 않게).
 *   ⓐ   뼈대 줄기를 움직인다 — 이 단위의 기록 가운데 뼈대 줄기에 곧바로 든 것(tools/views/layers.mjs direct, 줄기마다 셈) ≥ criteria.skeleton
 *   ⓒ   빌드업을 마무리한다 — 긴 회수: 다른 단위가 제기한 의문을 제기 뒤 공개 자리 criteria.payoff_gap칸 이상 지나 여기서 전부 회수 ≥ criteria.payoffs,
 *        또는 복선의 답: 다른 단위가 먼저 흘린 2회독 암시(rel 앞)의 사실이 여기서 처음 밝혀짐 ≥ criteria.answers (tools/views/reveal.mjs revealStages)
 *   ⓑ   메인과 서로 기댄다 — 메인 챕터와 이어진 기록(1회독 in · out, 2회독 out 암시 · 재언급 · in 암시 — layers.mjs main, 척추를 빈 집합으로 두고 센다) ≥ criteria.main
 *   척추 = 문 ∧ (ⓐ ∨ ⓒ) ∧ ⓑ. 기준값은 annotations/spine.json criteria(기본 3 · 20칸 · 2 · 5 · 3). 문턱은 날이 서 있지 않다(ⓐ 1–6 · ⓑ 3–5 · ⓒ 15–30칸 · 2–9 어디든 같은 결과 — 2026-10-09).
 * 보고서: 문 안 단위마다 수 · 통과 여부 · 판정(B)과 어긋남(사용자가 뒤집은 것은 어긋남이 아니다) · 문 밖에서 기준을 넘는 이벤트(문을 빼면 들어올 것) · 기준을 바꾸면 달라지는 것.
 * 같은 기록이면 같은 결과다(정렬 끝까지 결정적). 원문 대사는 담지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { EXAMPLE_DIR, READ1_DIR, ROOT, compareIds, displayPath, loadDataset } from '../records/model.mjs';
import { loadOrder } from '../records/order.mjs';
import { layerKind } from '../records/layers.mjs';
import { read2Edges } from '../records/read2.mjs';
import { buildRead1Views } from './read1.mjs';
import { layerSignals } from './layers.mjs';
import { releasePlaces, revealStages } from './reveal.mjs';
import { IMPORTANCE_DIR } from './importance.mjs';
import { buildupMetrics } from './closures.mjs';

/** 기준값 기본 — annotations/spine.json criteria가 이긴다 */
export const DEFAULT_CRITERIA = { skeleton: 3, main: 3, payoff_gap: 20, payoffs: 2, answers: 5 };
/** 시안에 쓰는 메인 연결(2회독 in 재언급은 참고만 — layers.mjs와 같다) */
const counted = (m) => !(m.src === 2 && m.dir === 'in' && m.act === '재언급');

/**
 * 척추 후보 셋의 수 — 이벤트 · 사이드 단위마다(이벤트 유실물은 뺀다)
 * @param {ReturnType<typeof loadDataset>} ds
 * @param {object} ctx openContext()
 * @param {{ items: {key:string}[] }} order 1회독 순서
 * @returns {{ criteria: object, units: object[], byUnit: Map<string, object> }}
 *   units[i] = { unit, kind, title, tick, gate, judgment(B 후보|null), status, skeleton, skeletonBy{J:n}, main, mainIn, mainOut, payoffs, payoffList[], answers, answerList[], pass, mismatch }
 */
export function spineMetrics(ds, ctx, order) {
  const criteria = { ...DEFAULT_CRITERIA, ...Object.fromEntries(Object.entries(ds.spine?.data?.criteria ?? {}).filter(([k]) => k in DEFAULT_CRITERIA)) };
  const views = buildRead1Views(ds, ctx, order);
  // ⓐ · ⓑ는 메인 챕터만 기준으로 센다(척추를 빈 집합으로) — 척추끼리 서로 기대어 셈이 돌지 않게
  const signals = layerSignals(ds, views, read2Edges(ds, ctx, order), { spine: new Set() });
  const rel = releasePlaces(ctx, order);
  // ⓒ — 긴 회수 · 복선의 답(X3f-1d가 모든 단위로 넓혔다 — tools/views/closures.mjs buildupMetrics, 같은 계산)
  const bm = buildupMetrics(ds, ctx, order, { gap: criteria.payoff_gap, spine: new Set(), rel, st: revealStages(ds, ctx, order, rel) });
  const payoffs = new Map([...bm.byUnit].map(([u, x]) => [u, x.payoffList]));
  const answers = new Map([...bm.byUnit].map(([u, x]) => [u, x.answerList]));
  const judged = new Map(ds.candidates.filter((c) => c.kind === 'spine' && c.spineUnit).map((c) => [c.spineUnit, c]));
  const units = [];
  const seen = new Set();
  for (const it of order.items) {
    const key = it.key;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = layerKind(key);
    if (kind !== '이벤트' && kind !== '사이드') continue;
    const s = signals.get(key);
    const skeletonBy = {};
    for (const d of s?.direct ?? []) if (d.weight === '뼈대') skeletonBy[d.thread] = (skeletonBy[d.thread] ?? 0) + 1;
    const main = (s?.main ?? []).filter(counted);
    const j = judged.get(key) ?? null;
    const u = {
      unit: key, kind, title: ctx.resolve(key)?.title ?? '', tick: rel.byUnit.get(key)?.tick ?? '', gate: j?.obj?.gate ?? '', judgment: j, status: j?.status ?? '',
      skeleton: Object.values(skeletonBy).reduce((a, n) => a + n, 0), skeletonBy,
      main: main.length, mainIn: main.filter((m) => m.dir === 'in').length, mainOut: main.filter((m) => m.dir === 'out').length,
      payoffs: (payoffs.get(key) ?? []).length, payoffList: (payoffs.get(key) ?? []).sort((a, b) => compareIds(a.root, b.root)),
      answers: (answers.get(key) ?? []).length, answerList: (answers.get(key) ?? []).sort((a, b) => compareIds(a.root, b.root)),
    };
    u.buildup = u.payoffs >= criteria.payoffs || u.answers >= criteria.answers;
    u.pass = Boolean(j) && (u.skeleton >= criteria.skeleton || u.buildup) && u.main >= criteria.main;
    // 어긋남 — 문 안 단위의 판정(확정 = 척추)이 계산과 다르다
    u.mismatch = Boolean(j) && (j.status === '확정') !== u.pass && j.status !== '후보';
    units.push(u);
  }
  return { criteria, units, byUnit: new Map(units.map((u) => [u.unit, u])) };
}

const yes = (b) => (b ? '○' : '·');
/** 사람이 읽는 보고서 */
export function renderSpineReport(v, { source = '' } = {}) {
  const c = v.criteria;
  const gate = v.units.filter((u) => u.judgment);
  const L = [];
  L.push('# 척추 선정 — 계산 (X3f-1b · 1c)', '');
  L.push(`출처: ${source}(판정 B — annotations/spine.json) — 규칙 tools/views/spine.mjs 머리말, 뜻 docs/importance.md 1절, 처음 고른 기록 data/views/importance/spine-candidates.md.`);
  L.push(`척추 = 문 ∧ (ⓐ 뼈대 기록 ≥ ${c.skeleton} ∨ ⓒ 긴 회수 ≥ ${c.payoffs}(제기 뒤 ${c.payoff_gap}칸 이상) · 복선의 답 ≥ ${c.answers}) ∧ ⓑ 메인 연결 ≥ ${c.main}. 뒤집기: \`node tools/records.mjs set B… 확정|기각 --by 사용자 --note "…"\`, 기준은 spine.json criteria.`, '');
  const spine = gate.filter((u) => u.status === '확정');
  L.push(`- 척추 ${spine.length}(이벤트 ${spine.filter((u) => u.kind === '이벤트').length} · 사이드 ${spine.filter((u) => u.kind === '사이드').length}) · 문 안이지만 미달 ${gate.filter((u) => u.status === '기각').length} · 계산과 어긋남 ${gate.filter((u) => u.mismatch).length}`, '');
  L.push('## 문 안 단위', '');
  L.push('| ID | 단위 | 문 | ⓐ 뼈대 | ⓒ 긴 회수 · 복선의 답 | ⓑ 메인 in · out | 계산 | 판정 | 어긋남 | 이유 |', '|---|---|---|---:|---:|---:|---|---|---|---|');
  for (const u of gate) {
    const sk = Object.entries(u.skeletonBy).sort((a, b) => compareIds(a[0], b[0])).map(([j, n]) => `${j}×${n}`).join(' ');
    L.push(`| ${u.judgment.id} | \`${u.unit}\` ${u.title} | ${u.gate} | ${u.skeleton}${sk ? ` (${sk})` : ''} | ${u.payoffs} · ${u.answers} | ${u.main} (${u.mainIn} · ${u.mainOut}) | ${u.pass ? '넘음' : '미달'} | ${u.status === '확정' ? '**척추**' : u.status === '기각' ? '빼고 판정' : u.status} | ${u.mismatch ? '⚠' : ''} | ${String(u.judgment.reason ?? '').replace(/\|/g, '/')} |`);
  }
  L.push('', '## 문 밖에서 기준을 넘는 것 — 문을 빼면 들어올 이벤트 · 사이드 (척추가 아니다 — 판정 단위로 필수 · 보강을 받는다)', '');
  const outside = v.units.filter((u) => !u.judgment && (u.skeleton >= c.skeleton || u.buildup) && u.main >= c.main);
  L.push('| 단위 | ⓐ 뼈대 | ⓒ 긴 회수 · 복선의 답 | ⓑ 메인 연결 |', '|---|---:|---:|---:|');
  for (const u of outside) L.push(`| \`${u.unit}\` ${u.title} | ${u.skeleton} | ${u.payoffs} · ${u.answers} | ${u.main} |`);
  if (!outside.length) L.push('| (없음) | | | |');
  L.push('', '## 기준을 바꾸면 달라지는 것 — 조율할 손잡이', '');
  const without = (f) => gate.filter((u) => f(u) !== (u.status === '확정')).map((u) => `\`${u.unit}\`${f(u) ? '(들어옴)' : '(빠짐)'}`);
  L.push(`- ⓑ를 빼면(문 + ⓐ 또는 ⓒ만): ${without((u) => u.skeleton >= c.skeleton || u.buildup).join(' · ') || '그대로'}`);
  L.push(`- ⓐ · ⓒ를 빼면(문 + ⓑ만): ${without((u) => u.main >= c.main).join(' · ') || '그대로'}`);
  L.push(`- ⓒ를 빼면(문 + ⓐ + ⓑ): ${without((u) => u.skeleton >= c.skeleton && u.main >= c.main).join(' · ') || '그대로'}`);
  L.push(`- 문 안을 통째로 넣으면(기준 없이): ${without(() => true).join(' · ') || '그대로'}`);
  L.push(`- 문을 빼면(기준만): 위 "문 밖에서 기준을 넘는 것" ${outside.length}이 더 들어온다 — 지금 필수 대부분이 척추로 올라가 척추와 필수가 겹친다. 그래서 문을 뒀다.`);
  L.push('', '## ⓒ 빌드업 마무리 — 척추 단위마다 긴 회수 · 복선의 답 (X3f-1d가 판정 입력 · 화면에 띄운다)', '');
  for (const u of gate.filter((x) => x.payoffs || x.answers)) {
    const pay = u.payoffList.map((p) => `${p.root}(${p.from}, ${p.gap}칸 뒤 ${p.record})`).join(' · ');
    const ans = u.answerList.map((a) => `${a.root}(← ${a.hints.slice(0, 2).join(' ')}${a.hints.length > 2 ? ` 외 ${a.hints.length - 2}` : ''})`).join(' · ');
    L.push(`- \`${u.unit}\` — 긴 회수 ${u.payoffs}${pay ? `: ${pay}` : ''}${ans ? ` · 복선의 답 ${u.answers}: ${ans}` : ` · 복선의 답 ${u.answers}`}`);
  }
  return L.join('\n') + '\n';
}

function csvCell(x) {
  const s = x == null ? '' : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const COLUMNS = ['unit', 'kind', 'title', 'tick', 'judgment', 'status', 'gate', 'skeleton', 'skeleton_by', 'payoffs', 'answers', 'main', 'main_in', 'main_out', 'pass', 'mismatch'];
export function writeSpineViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  const rows = v.units.map((u) => ({ ...u, judgment: u.judgment?.id ?? '', skeleton_by: Object.entries(u.skeletonBy).map(([j, n]) => `${j}×${n}`).join(' '), pass: u.pass ? 1 : '', mismatch: u.mismatch ? 1 : '' }));
  fs.writeFileSync(path.join(outDir, 'spine.csv'), [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'spine.md'), renderSpineReport(v, opts));
  return ['spine.csv', 'spine.md'];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt } = parseArgs({ options: { example: { type: 'boolean' }, dir: { type: 'string' }, out: { type: 'string' } } });
  const dir = path.resolve(ROOT, opt.example ? EXAMPLE_DIR : opt.dir ?? READ1_DIR);
  const ds = loadDataset({ dir });
  for (const p of ds.problems) console.error(`⚠ ${p.file}: ${p.msg}`);
  const ctx = await openContext();
  const order = loadOrder();
  const v = spineMetrics(ds, ctx, order);
  const source = displayPath(dir) + '/';
  if (dir === path.resolve(READ1_DIR) || opt.out) {
    const out = opt.out ? path.resolve(ROOT, opt.out) : IMPORTANCE_DIR;
    const files = writeSpineViews(v, out, { source });
    console.log(`${displayPath(out)}/ ← ${files.join(' · ')}`);
  } else console.log(renderSpineReport(v, { source }));
  const gate = v.units.filter((u) => u.judgment);
  console.log(`척추 ${gate.filter((u) => u.status === '확정').length} · 문 안 ${gate.length} · 어긋남 ${gate.filter((u) => u.mismatch).length}${gate.filter((u) => u.mismatch).length ? ` — ${gate.filter((u) => u.mismatch).map((u) => u.unit).join(' ')}` : ''}`);
  ctx.close();
}
