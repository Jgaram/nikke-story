/**
 * X3g-1b — 감정 기준의 주요 인물(docs/importance.md 3절 "결정적 순간" ③ · ④): 결정적 순간이 여기에만 장면으로 있으면 **필수**까지 오르는 인물.
 * 주역 명단(annotations/leads.json — 원점 조항용, 뼈대 줄기가 정체를 묻는 사람)과 따로 둔다. 감정의 무게는 "척추를 읽은 사람이 그 인물에게 무엇을 쌓았나"다 —
 * 정체를 묻는지가 아니라, 척추가 그 인물에게 오래 머물고 그 인물이 바뀌는 것을 보여 줬는지. 고르는 것은 Claude(annotations/majors.json C<n> —
 * 확정 = 주요 인물 · 기각 = 띠 안이지만 끊는 선 아래), 사용자는 기준(criteria)을 조율하고 항목을 뒤집는다(`set C… 확정|기각 --by 사용자`). 형식은 docs/annotations.md "주요 인물".
 *
 *   node tools/views/majors.mjs                 → data/views/importance/majors.md · majors.csv (커밋한다 — tools/views/draft.mjs도 같이 부른다)
 *   node tools/views/majors.mjs --example       예시 기록(tests/fixtures/read1)으로 보고서만 찍는다
 *   node tools/views/majors.mjs --add [인물]     띠 안인데 항목이 없는 인물(인물을 주면 그 사람 — 띠 밖이어도)을 명단 파일에 후보로 더한다
 *
 * 재는 것 — 척추(메인 챕터 + annotations/spine.json 확정 단위)에서, 같은 인물(확정 정체 연결)은 합쳐(대표 = tools/views/leads.mjs identityCanon). 원문은 읽지 않는다 — DB와 기록에서:
 *   출현 scenes   그 인물이 이름표로 말한 씬(lines.speaker_target, 지휘관은 Self 창, 2회독 암시 언급의 speaker 줄 포함) — 척추가 그 인물에게 머문 양.
 *                 자리(챕터 · 이벤트) 수가 아니라 씬으로 센다 — 메인 챕터는 잘게, 척추 이벤트는 한 덩어리로 끊겨 자리 수는 종류 · 편 수에 휘둘린다.
 *                 말한 줄이 아니라 씬으로 센다 — 줄은 말 많은 인물 · 긴 대화에 휘둘린다. 이름만 나온 씬은 뺀다 — 화면에 없어도 불리는 인물이 있다.
 *   변화 changes  척추의 2회독 인물 변화 D(act 변화 · 측면 EMOTION_ASPECTS — 결정적 순간 후보와 같은 거름, 지휘관과의 관계는 뺌, 기각 빼고) — 척추가 보여 준 그 인물의 변화.
 *                 **줄로 접어 센다** — 자리 · 측면(관계면 상대)마다 하나. 한 자리 안에서 같은 측면이 여러 걸음으로 적힌 것(한 이벤트에 신념 변화 아홉)은
 *                 이야기가 아니라 기록의 잘기다 — 접으면 척추 이벤트 · 사이드의 씬당 변화가 메인의 1.9배에서 1.5배로 준다(2026-10-10). 기록 수 그대로는 변형으로 본다.
 *   점수 score    = √(출현 × 변화). 둘 다 있어야 한다 — 오래 나와도 바뀌지 않는 인물(교신 · 안내 역)과 잠깐 나와 크게 바뀌는 인물(한 편의 주인공)은 둘 다 낮다.
 *                 곱이라 한쪽을 두 배로 해도 같은 만큼 오른다(단위가 다른 둘을 무게 없이 합친다).
 * 주요 인물 = 점수 ≥ criteria.score(지금까지의 척추 전체로).
 * from(감정 필수의 `--from`) = 척추 자리를 읽는 순서로 출현 · 변화를 쌓아, 그 자리까지 읽은 몫으로 줄인 문턱(문턱 × 그 자리까지의 척추 씬 ÷ 척추 씬 전체)을
 *   점수가 넘고 **그 뒤 내내 넘는** 첫 자리. 점수는 척추가 길어지는 만큼 자라므로(두 재료가 다 쌓인다) 문턱을 그대로 대면 ch10을 읽은 사람과 ch48을 읽은 사람을 같은 자로 잰다 —
 *   몫으로 줄여 "그때까지 읽은 척추의 주요 인물"을 묻는다. 그 뒤 내내 — 한 자리에서 잠깐 튀는 것(첫 챕터의 큰 순간 하나)은 자리가 아니다. 등급은 내려가지 않는다(카드 4절).
 * 띠 = 점수 ≥ criteria.score × criteria.band — 명단 파일에 항목으로 적는다(선 아래도 — 사용자가 뒤집을 수 있게). 선 아래 항목의 from은 문턱 대신 그 인물의 점수로 같은 셈을 한 자리.
 * 끊는 선(X3g-1b): 점수를 높은 순으로 놓고 이웃 비(앞/뒤)가 가장 큰 자리. 문턱은 그 틈 안에 둔다 — 틈 양쪽 어디에 둬도 같은 명단.
 * 견고성 — 같은 꼴(√(머문 양 × 바뀐 양))로 재료를 바꾼 변형 VARIANTS에서 위 n명이 같은지 · 가장 큰 끊김이 어디인지를 보고서에 적는다(휘둘리는지 점검).
 * 어긋남: 판정(C)이 계산과 다르다(확정인데 선 아래 · 기각인데 선 위 · 확정의 from이 계산과 다름). 사용자가 뒤집은 것은 어긋남이 아니다.
 * 같은 기록 · DB면 같은 결과다(정렬 끝까지 결정적). 원문 대사는 담지 않는다(수 · ID만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openContext } from '../records/context.mjs';
import { formatJson } from '../records/json.mjs';
import { EXAMPLE_DIR, MAJORS_PATH, READ1_DIR, ROOT, compareIds, displayPath, loadDataset, nextIds, today } from '../records/model.mjs';
import { kindOfKey, loadOrder } from '../records/order.mjs';
import { mentionRows } from '../records/read2.mjs';
import { IMPORTANCE_DIR } from './importance.mjs';
import { EMOTION_ASPECTS } from './layers.mjs';
import { COMMANDER, leadSignals } from './leads.mjs';

/** 기준값 기본 — annotations/majors.json criteria가 이긴다. score: 주요 인물 문턱(점수) · band: 명단에 적는 띠(문턱의 몫) */
export const DEFAULT_CRITERIA = { score: 32, band: 0.5 };
/** 끊김을 찾는 순위 범위 — 위 넷(지휘관 · 카운터스처럼 어디에나 있는 인물)과 꼬리는 빼고 본다 */
const GAP_RANGE = [4, 30];
const arr = (x) => (Array.isArray(x) ? x : []);
const round1 = (x) => Math.round(x * 10) / 10;
const isSpineEvent = (ch) => kindOfKey(ch) !== '메인';

/**
 * 견고성 변형 — 같은 꼴, 재료만 바꾼다. 각 변형이 무엇에 휘둘리는지를 함께 적는다(보고서 "무엇에 휘둘리나").
 * p = 인물 행, k = 척추 이벤트 · 사이드의 변화 밀도 보정 몫(메인 밀도 / 이벤트 밀도)
 */
export const VARIANTS = [
  { key: 'named', label: '이름 씬 × 변화', sways: '이름만 불린 씬도 센다 — 화면에 없어도 자주 불리는 인물이 오른다', f: (p) => Math.sqrt(p.named * p.changes) },
  { key: 'lines', label: '말한 줄 × 변화', sways: '말 많은 인물 · 긴 대화(분량)', f: (p) => Math.sqrt((p.lines / 10) * p.changes) },
  { key: 'records', label: '말한 씬 × 변화 기록 수(접지 않음)', sways: '한 자리에 같은 측면을 여러 걸음으로 적은 기록의 잘기', f: (p) => Math.sqrt(p.scenes * p.records) },
  { key: 'density', label: '말한 씬 × 변화(종류 밀도 보정)', sways: '척추 이벤트 · 사이드의 변화가 씬당 더 촘촘한 것(종류)을 메인 밀도로 맞춤', f: (p, k) => Math.sqrt(p.scenes * (p.changesMain + k * p.changesEv)) },
  { key: 'places', label: '말한 씬 × 변화가 있는 자리', sways: '한 자리에 변화가 몰린 인물이 내려간다 — 자리는 메인이 잘다(편 수)', f: (p) => Math.sqrt(p.scenes * p.changePlaces) },
  { key: 'deep', label: '말한 씬 × 변화(관계 뺌)', sways: '관계 변화는 상대마다 하나라 상대가 많은 인물이 오른다 — 그걸 뺌', f: (p) => Math.sqrt(p.scenes * p.changesDeep) },
  { key: 'center', label: '중심 자리 × 변화', sways: '주역 초안의 중심 자리(씬 몫 · 대사 몫) — 자리 수라 종류 · 편 수에 휘둘린다', f: (p) => Math.sqrt(p.center * 10 * p.changes) },
];

/** 점수 목록에서 끊김 — 순위 범위 안 이웃 비가 큰 순 */
export function gapsOf(values, [lo, hi] = GAP_RANGE) {
  const s = [...values].filter((v) => v > 0).sort((a, b) => b - a);
  const out = [];
  for (let i = lo; i < Math.min(hi, s.length - 1); i++) out.push({ at: i + 1, ratio: s[i] / s[i + 1], above: s[i], below: s[i + 1] });
  return out.sort((a, b) => b.ratio - a.ratio || a.at - b.at);
}

/**
 * 인물마다 출현 · 변화 · 점수 · from, 판정과의 어긋남, 변형별 견고성
 * @param {ReturnType<typeof loadDataset>} ds
 * @param {object} ctx openContext()
 * @param {{ items: {key:string}[] }} order 1회독 순서
 */
export function majorMetrics(ds, ctx, order) {
  const criteria = { ...DEFAULT_CRITERIA, ...Object.fromEntries(Object.entries(ds.majors?.data?.criteria ?? {}).filter(([k]) => k in DEFAULT_CRITERIA)) };
  const L = leadSignals(ds, ctx, order);
  const chapters = L.chapters;
  const pos = new Map(chapters.map((ch, i) => [ch, i]));
  const canonOf = new Map();
  for (const [rep, xs] of L.groups) for (const x of xs) canonOf.set(x, rep);
  const canon = (p) => canonOf.get(p) ?? p;
  const CMD = canon(COMMANDER);
  const P = new Map();
  const S = (g) => {
    if (!P.has(g)) P.set(g, { person: g, members: L.groups.get(g) ?? [g], speak: new Map(), changeList: [], named: 0, lines: 0, center: 0 });
    return P.get(g);
  };
  // 출현 — 말한 씬(자리마다)
  const sceneCh = new Map();
  const totals = { scenesMain: 0, scenesEv: 0 };
  const perCh = new Map();
  for (const ch of chapters) {
    const scenes = ctx.resolve(ch)?.scenes ?? [];
    for (const s of scenes) sceneCh.set(s, ch);
    perCh.set(ch, scenes.length);
    totals[isSpineEvent(ch) ? 'scenesEv' : 'scenesMain'] += scenes.length;
  }
  // 그 자리까지 읽은 척추의 몫(씬) — from의 줄인 문턱
  const allScenes = totals.scenesMain + totals.scenesEv;
  const share = [];
  let acc = 0;
  for (const ch of chapters) share.push(allScenes ? (acc += perCh.get(ch)) / allScenes : 1);
  const spoke = (g, ch, scene) => {
    const x = S(g);
    if (!x.speak.has(ch)) x.speak.set(ch, new Set());
    x.speak.get(ch).add(scene);
  };
  for (const r of ctx.db.prepare("SELECT DISTINCT story_id, window, speaker_target t FROM lines WHERE window IN ('Speech', 'Self')").all()) {
    const ch = sceneCh.get(r.story_id);
    if (!ch) continue;
    const p = r.window === 'Self' ? COMMANDER : r.t;
    if (p && String(p).startsWith('person:')) spoke(canon(p), ch, r.story_id);
  }
  for (const m of mentionRows(ds)) {
    const ch = sceneCh.get(m.scene);
    if (ch && m.speaker && String(m.target ?? '').startsWith('person:')) spoke(canon(m.target), ch, m.scene);
  }
  // 변화 — 척추의 2회독 인물 변화 D(결정적 순간 후보와 같은 거름)
  const persons = (xs) => arr(xs).filter((p) => String(p).startsWith('person:'));
  for (const c of ds.candidates) {
    if (!c.read2 || c.kind !== 'change' || c.act !== '변화' || !c.id || c.status === '기각' || !pos.has(c.unit)) continue;
    const o = c.obj ?? {};
    if (!EMOTION_ASPECTS.includes(o.aspect) || !String(o.person ?? '').startsWith('person:')) continue;
    const g = canon(o.person);
    if (o.aspect === '관계' && (g === CMD || persons(o.with).map(canon).includes(CMD))) continue;
    S(g).changeList.push({ id: c.id, unit: c.unit, aspect: o.aspect, line: [c.unit, o.aspect, ...(o.aspect === '관계' ? persons(o.with).map(canon).sort() : [])].join('|') });
  }
  // 변형 재료 — 주역 초안의 자리별 수(이름 씬 · 말한 줄 · 중심)
  for (const [g, x] of L.persons) {
    if (!P.has(g)) continue;
    const y = P.get(g);
    for (const c of x.byCh.values()) {
      y.named += c.scenes;
      y.lines += c.lines;
      if (c.center) y.center++;
    }
  }
  const rows = [];
  for (const x of P.values()) {
    const scenesBy = (f) => [...x.speak].filter(([ch]) => f(ch)).reduce((n, [, s]) => n + s.size, 0);
    const scenes = scenesBy(() => true);
    x.changeList.sort((a, b) => pos.get(a.unit) - pos.get(b.unit) || compareIds(a.id, b.id));
    // 변화 줄 — 자리 · 측면(관계면 상대)마다 첫 기록 하나
    const firstOf = new Map();
    for (const d of x.changeList) if (!firstOf.has(d.line)) firstOf.set(d.line, d);
    const lineList = [...firstOf.values()];
    const changes = lineList.length;
    const score = Math.sqrt(scenes * changes);
    if (!score) continue;
    // from — 읽는 순서로 쌓아, 그 자리까지의 몫으로 줄인 문턱을 그 뒤 내내 넘는 첫 자리. 선 아래면 문턱 대신 그 인물의 점수로
    const goal = Math.min(criteria.score, score);
    let cs = 0;
    let cd = 0;
    const above = chapters.map((ch, i) => {
      cs += x.speak.get(ch)?.size ?? 0;
      cd += lineList.filter((d) => d.unit === ch).length;
      return Math.sqrt(cs * cd) >= goal * share[i] - 1e-9;
    });
    let from = null;
    for (let i = chapters.length - 1; i >= 0 && above[i]; i--) from = chapters[i];
    rows.push({
      person: x.person, members: x.members, scenes, scenesMain: scenesBy((ch) => !isSpineEvent(ch)), scenesEv: scenesBy(isSpineEvent),
      changes, changesMain: lineList.filter((d) => !isSpineEvent(d.unit)).length, changesEv: lineList.filter((d) => isSpineEvent(d.unit)).length,
      changesDeep: lineList.filter((d) => d.aspect !== '관계').length, changePlaces: new Set(lineList.map((d) => d.unit)).size, records: x.changeList.length,
      aspects: Object.fromEntries(EMOTION_ASPECTS.map((a) => [a, lineList.filter((d) => d.aspect === a).length]).filter(([, n]) => n)),
      changeIds: lineList.map((d) => d.id), recordIds: x.changeList.map((d) => d.id), named: x.named, lines: x.lines, center: x.center,
      score, pass: score >= criteria.score, band: score >= criteria.score * criteria.band, from,
    });
  }
  rows.sort((a, b) => b.score - a.score || a.person.localeCompare(b.person));
  rows.forEach((r, i) => (r.rank = i + 1));
  // 종류 밀도 — 척추 씬 100마다 변화 줄
  const chMain = rows.reduce((n, r) => n + r.changesMain, 0);
  const chEv = rows.reduce((n, r) => n + r.changesEv, 0);
  const density = { main: totals.scenesMain ? (100 * chMain) / totals.scenesMain : 0, ev: totals.scenesEv ? (100 * chEv) / totals.scenesEv : 0 };
  const k = density.ev ? density.main / density.ev : 1;
  // 판정과 맞대기
  const judged = new Map();
  for (const c of ds.candidates) if (c.kind === 'major' && c.id && c.obj?.person) judged.set(canon(c.obj.person), c);
  for (const r of rows) {
    const j = judged.get(r.person) ?? null;
    r.judgment = j;
    r.status = j?.status ?? '';
    r.byUser = arr(j?.reviews).some((x) => x.by === '사용자');
    r.mismatch = Boolean(j) && !r.byUser && ['확정', '기각'].includes(j.status) && ((j.status === '확정') !== r.pass || (j.status === '확정' && j.obj?.from !== r.from));
  }
  const byPerson = new Map(rows.map((r) => [r.person, r]));
  // 판정은 있는데 점수가 0인 인물(사용자가 더한 사람 등)
  const orphans = [...judged.entries()].filter(([g]) => !byPerson.has(g)).map(([g, c]) => ({ person: g, judgment: c }));
  const majors = rows.filter((r) => r.pass);
  const n = majors.length;
  const names = new Set(majors.map((r) => r.person));
  const variants = VARIANTS.map((v) => {
    const vals = rows.map((r) => ({ person: r.person, v: v.f(r, k) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v || a.person.localeCompare(b.person));
    const top = new Set(vals.slice(0, n).map((x) => x.person));
    return { ...v, top: vals.slice(0, n + 6), in: [...top].filter((p) => !names.has(p)), out: [...names].filter((p) => !top.has(p)), gaps: gapsOf(vals.map((x) => x.v)).slice(0, 3) };
  });
  return { criteria, chapters, rows, byPerson, orphans, majors, gaps: gapsOf(rows.map((r) => r.score)).slice(0, 4), variants, density, k, totals };
}

const nm = (p) => String(p).replace(/^person:/, '');
const aspectsText = (a) => Object.entries(a).map(([k, n]) => `${k} ${n}`).join(' · ');

/** 사람이 읽는 보고서 */
export function renderMajorsReport(v, { source = '' } = {}) {
  const c = v.criteria;
  const band = v.rows.filter((r) => r.band || r.judgment);
  const L = [];
  L.push('# 주요 인물 — 계산 (X3g-1b)', '');
  L.push(`출처: ${source}(판정 C — annotations/majors.json) — 규칙 tools/views/majors.mjs 머리말, 뜻 docs/importance.md 3절 "결정적 순간" ③ · ④.`);
  L.push(`주요 인물 = 점수 √(말한 씬 × 변화 줄) ≥ ${c.score} — 결정적 순간이 여기에만 장면으로 있으면 필수까지. 띠 = 점수 ≥ ${round1(c.score * c.band)}(명단에 적는 범위). 뒤집기: \`node tools/records.mjs set C… 확정|기각 --by 사용자 --note "…"\`.`, '');
  L.push(`- 주요 인물 ${v.majors.length} · 띠 ${v.rows.filter((r) => r.band).length} · 판정 ${band.filter((r) => r.judgment).length + v.orphans.length} · 어긋남 ${v.rows.filter((r) => r.mismatch).length} · 띠 안인데 항목 없음 ${v.rows.filter((r) => r.band && !r.judgment).length}`);
  L.push(`- 척추 씬 ${v.totals.scenesMain + v.totals.scenesEv}(메인 ${v.totals.scenesMain} · 척추 이벤트 · 사이드 ${v.totals.scenesEv}) · 변화 줄 씬 100마다 메인 ${round1(v.density.main)} · 척추 이벤트 · 사이드 ${round1(v.density.ev)}`, '');
  L.push('## 띠 안 인물', '');
  L.push('| 순위 | ID | 인물 | 말한 씬(메인 · 이벤트) | 변화 줄(메인 · 이벤트) — 측면 · 기록 수 | 점수 | from | 계산 | 판정 | 어긋남 |', '|---:|---|---|---:|---:|---:|---|---|---|---|');
  for (const r of band) {
    const j = r.judgment;
    const st = j ? `${j.status}${r.byUser ? '(사용자)' : ''}` : '(항목 없음)';
    const fromNote = j?.status === '확정' && j.obj?.from && j.obj.from !== r.from ? ` (판정 ${j.obj.from})` : '';
    L.push(`| ${r.rank} | ${j?.id ?? ''} | ${nm(r.person)}${r.members.length > 1 ? ` (= ${r.members.filter((m) => m !== r.person).map(nm).join(' · ')})` : ''} | ${r.scenes} (${r.scenesMain} · ${r.scenesEv}) | ${r.changes} (${r.changesMain} · ${r.changesEv}) — ${aspectsText(r.aspects)} · 기록 ${r.records} | ${round1(r.score)} | ${r.from ?? ''}${fromNote} | ${r.pass ? '주요 인물' : '선 아래'} | ${st} | ${r.mismatch ? '⚠' : ''} |`);
  }
  for (const o of v.orphans) L.push(`| — | ${o.judgment.id} | ${nm(o.person)} | 0 | 0 | 0 | ${o.judgment.obj?.from ?? ''} | 선 아래 | ${o.judgment.status} | |`);
  L.push('', '## 끊는 선 — 점수의 틈', '');
  L.push(`점수를 높은 순으로 놓고 ${GAP_RANGE[0] + 1}–${GAP_RANGE[1]}위에서 이웃 비(앞 ÷ 뒤)가 큰 자리(위 넷은 어디에나 있는 인물이라 뺀다):`, '');
  for (const g of v.gaps) L.push(`- 위 ${g.at}명 뒤 — ${round1(g.above)} → ${round1(g.below)} (비 ${g.ratio.toFixed(2)})`);
  const g0 = v.gaps[0];
  if (g0) L.push('', `문턱 ${c.score}${g0.below < c.score && c.score <= g0.above ? `은 가장 큰 틈(${round1(g0.below)}–${round1(g0.above)}) 안 — 틈 안 어디에 둬도 같은 ${g0.at}명이다.` : `은 가장 큰 틈(${round1(g0.below)}–${round1(g0.above)}) 밖이다 — 문턱 근처에서 명단이 흔들린다(조율 때 본다).`}`);
  L.push('', '## 무엇에 휘둘리나 — 재료를 바꾼 변형', '');
  L.push(`같은 꼴 √(머문 양 × 바뀐 양)에서 재료만 바꿔 위 ${v.majors.length}명이 같은지 본다. 종류 밀도 보정 몫 ${v.k.toFixed(2)}(메인 밀도 ÷ 척추 이벤트 · 사이드 밀도).`, '');
  L.push(`| 변형 | 휘둘림 | 위 ${v.majors.length}명 | 큰 끊김(위 n명 뒤 · 비) | 그 아래 여섯 |`, '|---|---|---|---|---|');
  for (const x of v.variants) {
    const same = !x.in.length && !x.out.length;
    L.push(`| ${x.label} | ${x.sways} | ${same ? '같다' : `다르다 — 들어옴 ${x.in.map(nm).join(' · ')} · 빠짐 ${x.out.map(nm).join(' · ')}`} | ${x.gaps.map((g) => `${g.at}명 ${g.ratio.toFixed(2)}`).join(' · ')} | ${x.top.slice(v.majors.length).map((t) => nm(t.person)).join(' · ')} |`);
  }
  L.push('', '## 주요 인물의 변화 줄 — 줄마다 첫 기록', '');
  for (const r of v.majors) L.push(`- ${nm(r.person)} — ${r.changeIds.join(' ')}`);
  return L.join('\n') + '\n';
}

function csvCell(x) {
  const s = x == null ? '' : String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const COLUMNS = ['rank', 'person', 'judgment', 'status', 'scenes', 'scenes_main', 'scenes_ev', 'changes', 'changes_main', 'changes_ev', 'change_places', 'changes_deep', 'records', 'named', 'lines', 'center', 'score', 'from', 'pass', 'band', 'mismatch'];
export function writeMajorsViews(v, outDir, opts) {
  fs.mkdirSync(outDir, { recursive: true });
  const rows = v.rows.map((r) => ({
    ...r, judgment: r.judgment?.id ?? '', scenes_main: r.scenesMain, scenes_ev: r.scenesEv, changes_main: r.changesMain, changes_ev: r.changesEv,
    change_places: r.changePlaces, changes_deep: r.changesDeep, score: round1(r.score), pass: r.pass ? 1 : '', band: r.band ? 1 : '', mismatch: r.mismatch ? 1 : '',
  }));
  fs.writeFileSync(path.join(outDir, 'majors.csv'), [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'majors.md'), renderMajorsReport(v, opts));
  return ['majors.csv', 'majors.md'];
}

/** 명단 파일에 넣을 후보 항목(계산 그대로) */
export function draftMajor(r, id, criteria) {
  const reason = `(계산) 말한 씬 ${r.scenes}(메인 ${r.scenesMain} · 척추 이벤트 · 사이드 ${r.scenesEv}) · 변화 줄 ${r.changes}(${aspectsText(r.aspects)} — 기록 ${r.records}) · 점수 ${round1(r.score)} ${r.pass ? '≥' : '<'} ${criteria.score}`;
  return { id, person: r.person, ...(r.from ? { from: r.from } : {}), scenes: r.scenes, changes: r.changes, score: round1(r.score), reason, confidence: '추정', status: '후보' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: opt, positionals } = parseArgs({ allowPositionals: true, options: { example: { type: 'boolean' }, dir: { type: 'string' }, out: { type: 'string' }, add: { type: 'boolean' } } });
  const dir = path.resolve(ROOT, opt.example ? EXAMPLE_DIR : opt.dir ?? READ1_DIR);
  let ds = loadDataset({ dir });
  for (const p of ds.problems) console.error(`⚠ ${p.file}: ${p.msg}`);
  const ctx = await openContext();
  const order = loadOrder();
  let v = majorMetrics(ds, ctx, order);
  if (opt.add) {
    const want = positionals[0] ? (positionals[0].startsWith('person:') ? positionals[0] : `person:${positionals[0]}`) : null;
    const pick = want ? v.rows.filter((r) => r.person === want || r.members.includes(want)) : v.rows.filter((r) => r.band && !r.judgment);
    if (want && !pick.length) {
      console.error(`${want} — 척추에서 말한 씬과 변화가 둘 다 있는 인물이 아니다(점수 0). 항목은 손으로 더한다(docs/annotations.md "주요 인물")`);
      process.exit(1);
    }
    const fresh = pick.filter((r) => !r.judgment);
    if (!fresh.length) console.log(want ? `${want} — 이미 항목이 있다(${pick[0].judgment.id})` : '띠 안인데 항목이 없는 인물이 없다');
    else {
      const file = ds.majors?.path ?? (dir === path.resolve(READ1_DIR) ? MAJORS_PATH : path.join(dir, '_majors.json'));
      const data = ds.majors?.data ?? { session: 'X3g-1b', by: 'claude', date: today(), criteria: { ...DEFAULT_CRITERIA }, majors: [] };
      if (!Array.isArray(data.majors)) data.majors = [];
      let n = Number(nextIds(ds).C.slice(1));
      for (const r of fresh) data.majors.push(draftMajor(r, `C${n++}`, v.criteria));
      fs.writeFileSync(file, formatJson(data));
      console.log(`${displayPath(file)}에 후보 ${fresh.length}건을 더했다 — ${fresh.map((r) => nm(r.person)).join(' · ')} (근거를 보고 set C… 확정|기각)`);
      ds = loadDataset({ dir });
      v = majorMetrics(ds, ctx, order);
    }
  }
  const source = displayPath(dir) + '/';
  if (dir === path.resolve(READ1_DIR) || opt.out) {
    const out = opt.out ? path.resolve(ROOT, opt.out) : IMPORTANCE_DIR;
    const files = writeMajorsViews(v, out, { source });
    console.log(`${displayPath(out)}/ ← ${files.join(' · ')}`);
  } else console.log(renderMajorsReport(v, { source }));
  const mm = v.rows.filter((r) => r.mismatch);
  console.log(`주요 인물 ${v.majors.length}(계산) · 띠 ${v.rows.filter((r) => r.band).length} · 어긋남 ${mm.length}${mm.length ? ` — ${mm.map((r) => `${r.judgment.id} ${nm(r.person)}`).join(' · ')}` : ''}`);
  ctx.close();
}
