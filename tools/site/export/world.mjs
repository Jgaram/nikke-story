/**
 * 탭 "세계" 데이터(W7) — 비인물 사전(개념 · 사건 · 물건 · 조직 · 장소) + 집계 + 이웃 + 줄기 + 생활상 → site/data/world.json
 *
 * 입력(원문 · 본문 칼럼은 읽지 않는다 — 사전 파일 · data/views CSV · ctx.common만):
 *   annotations/dictionary/{concepts,incidents,items,orgs,places}.json   사전 항목(메모 · 다른 이름 · 무엇인지 보여 주는 줄)
 *   data/views/read1/targets.csv       대상별 집계 — 사실 · 의문 · 열린 의문 · 사건 · 단위 · 처음/마지막 단위 · 처음 소개된 단위
 *   data/views/links/target-pairs.csv  대상 ↔ 대상(같은 기록의 about에 2번 이상) — 이웃 개념
 *   data/views/links/thread-targets.csv 줄기 ↔ 대상 — 걸린 줄기
 *   data/views/links/centers.csv       단위의 중심 대상 — spread(중심인 단위 수)로 "흔한 개념"(links.mjs COMMON_SHARE 10%와 같은 규칙)
 *   ctx.common.records                 확정 기록 — about으로 항목 ↔ 기록(사실 · 의문 · 생활상 · 떡밥 · 암시 언급 · 인물 변화)을 잇고, 생활상(U)은 문장째 싣는다
 *
 * world.json = { entries[], life[], topics[], hubs[], hub_share }
 *   entries[] (비인물 대상 225): id · type · name · kind · note · aliases[{name, how, caution}] · evidence[{scene, lines}](무엇인지 보여 주는 줄) ·
 *     stories · lines(이름 기준 범위 안 건수) · facts · questions · open(열린 의문) · events · units_n · first_unit · first_tick · first_order · introduced[] ·
 *     hub(흔한 개념이면 true) · spread · recs{ F|Q|U|E|I|D: [[기록 ID, 공개 자리, 층], …] }(컷오프 · 층 거르개 계산용 — 문장은 records*.json) ·
 *     units[[단위 키, 기록 수], …](읽는 자리 순) · neighbors[{ id, n, units, recs[[기록 ID, 공개 자리], …] }](함께 나온 기록 수 순) ·
 *     threads[{ id, n, about(줄기 자신의 about이면 true), sample[] }]
 *   life[] (생활상 449): id · topic · unit · tick · order · layer · scene · line · evidence · about[] · text · confidence · threads[]
 *   topics[] { topic, n } · hubs[] 흔한 개념 ID · hub_share 흔한 개념 기준(중심인 단위 몫)
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, compact, evidenceOut, list, num } from '../lib.mjs';

export const name = 'world';

/** 사전 파일 → 대상 종류(docs/schema.md "비인물 사전") */
const DICT_FILES = { concepts: 'concept', incidents: 'incident', items: 'item', orgs: 'org', places: 'place' };
/** 흔한 개념 — 중심인 단위가 읽기 단위의 이 몫을 넘는 대상(tools/views/links.mjs COMMON_SHARE와 같은 값 · 같은 뜻) */
export const HUB_SHARE = 0.1;
/** 항목에 잇는 기록 종류(about으로) — 문장은 싣지 않고 ID · 공개 자리 · 층만 */
const REC_KINDS = ['F', 'Q', 'U', 'E', 'I', 'D'];

/** 사전 파일 다섯을 읽어 id → 항목(메모 · 다른 이름 · 근거 줄) */
function readDictionary(warn) {
  const out = new Map();
  for (const [file, type] of Object.entries(DICT_FILES)) {
    const p = path.join(ROOT, 'annotations/dictionary', `${file}.json`);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (err) {
      warn({ where: 'world', msg: `사전 파일을 못 읽었다: ${file}.json — ${err.message}` });
      continue;
    }
    for (const e of data.entries ?? []) {
      if (!e?.id) continue;
      if (!e.id.startsWith(`${type}:`)) warn({ where: 'world', msg: `${file}.json의 ${e.id}는 ${type}: 접두가 아니다` });
      out.set(e.id, e);
    }
  }
  return out;
}

export async function run(ctx) {
  const { csv, common, warn } = ctx;
  if (!common) throw new Error('world: 공용 데이터(ctx.common)가 먼저 있어야 한다');
  const dict = readDictionary(warn);
  const unitInfo = new Map(common.units.map((u) => [u.key, u]));
  const placeOf = (key) => common.placeOf.get(key) ?? {};
  const layerOf = (key) => unitInfo.get(key)?.layer ?? null;

  // ── 항목 — 공용 대상 중 인물이 아닌 것. 사전 파일의 메모 · 다른 이름(caution 포함) · 근거 줄을 덧붙인다 ──
  const entries = new Map();
  for (const t of common.targets) {
    if (t.type === 'person') continue;
    const d = dict.get(t.id);
    if (!d) warn({ where: 'world', msg: `DB 대상 ${t.id}가 사전 파일에 없다(사전 메모 · 근거 줄 없이 싣는다)` });
    const aliases = Array.isArray(d?.names) && d.names.length
      ? d.names.map((n) => compact({ name: n.name, how: n.how, caution: n.caution || undefined }))
      : t.aliases;
    entries.set(t.id, {
      id: t.id, type: t.type, name: t.name, kind: t.kind ?? d?.kind, note: t.note ?? d?.note ?? null,
      aliases, evidence: evidenceOut(d?.evidence), stories: t.stories, lines: t.lines,
      recs: Object.fromEntries(REC_KINDS.map((k) => [k, []])), unitCount: new Map(), neighbors: [], threads: [],
    });
  }
  for (const id of dict.keys()) if (!entries.has(id)) warn({ where: 'world', msg: `사전 항목 ${id}가 DB 대상에 없다(DB를 다시 만들었는지 본다)` });

  // ── 1회독 집계(targets.csv) ──
  for (const r of csv('data/views/read1/targets.csv')) {
    const e = entries.get(r.target);
    if (!e) continue;
    Object.assign(e, {
      facts: num(r.facts) ?? 0, questions: num(r.questions) ?? 0, open: num(r.open_questions) ?? 0, events: num(r.events) ?? 0,
      units_n: num(r.units) ?? 0, first_unit: r.first_unit || null, first_order: num(r.first_order), first_tick: placeOf(r.first_unit).tick ?? null,
      last_unit: r.last_unit || null, introduced: list(r.introduced_in),
    });
  }

  // ── 기록 ↔ 항목(about) — ID · 공개 자리 · 층만. 생활상은 문장째 따로 ──
  const life = [];
  for (const r of common.records) {
    if (r.kind === 'U') {
      life.push(compact({
        id: r.id, topic: r.topic, unit: r.unit, tick: r.tick, order: r.order, layer: layerOf(r.unit), scene: r.scene, line: r.line,
        evidence: r.evidence, about: r.about, text: r.text, confidence: r.confidence, threads: r.threads,
      }));
    }
    if (!REC_KINDS.includes(r.kind) || !Array.isArray(r.about)) continue;
    for (const a of new Set(r.about)) {
      const e = entries.get(a);
      if (!e) continue;
      e.recs[r.kind].push([r.id, r.tick ?? null, layerOf(r.unit)]);
      if (r.unit) e.unitCount.set(r.unit, (e.unitCount.get(r.unit) ?? 0) + 1);
    }
  }
  life.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.scene).localeCompare(String(b.scene)) || (a.line ?? 0) - (b.line ?? 0));
  const recIndex = new Map(common.records.map((r) => [r.id, r]));
  for (const e of entries.values()) {
    // targets.csv의 사실 수와 about 집계가 어긋나면 알린다(기록이 바뀌었는데 draft를 안 돌린 경우)
    if (e.facts != null && e.facts !== e.recs.F.length) warn({ where: 'world', msg: `${e.id} 사실 수가 다르다: targets.csv ${e.facts} · about 집계 ${e.recs.F.length}(집계 쪽을 쓴다)` });
    e.facts = e.recs.F.length;
    e.questions = e.recs.Q.length;
    if (e.first_tick == null) {
      // targets.csv에 없는 항목(사실 · 의문이 없는 사전 항목) — 어느 기록이든 첫 자리
      const all = REC_KINDS.flatMap((k) => e.recs[k]);
      const first = all.filter((x) => x[1] != null).sort((a, b) => a[1] - b[1])[0];
      if (first) {
        const r = recIndex.get(first[0]);
        Object.assign(e, { first_unit: r?.unit ?? null, first_tick: first[1], first_order: r?.order ?? null });
      }
    }
  }

  // ── 이웃(target-pairs.csv) — 쌍마다 함께 나온 기록(about에 둘 다)을 ID · 공개 자리로 ──
  const pairRecs = (a, b) => {
    const ea = entries.get(a);
    const ids = new Set(REC_KINDS.flatMap((k) => ea.recs[k].map((x) => x[0])));
    const out = [];
    for (const k of REC_KINDS) for (const [id, tick] of entries.get(b).recs[k]) if (ids.has(id)) out.push([id, tick]);
    return out.sort((x, y) => (x[1] ?? 1e9) - (y[1] ?? 1e9) || String(x[0]).localeCompare(String(y[0])));
  };
  let pairMismatch = 0;
  for (const r of csv('data/views/links/target-pairs.csv')) {
    if (!entries.has(r.a) || !entries.has(r.b)) continue;
    const recs = pairRecs(r.a, r.b);
    const n = num(r.records) ?? recs.length;
    if (n !== recs.length) pairMismatch++;
    const units = num(r.units) ?? 0;
    entries.get(r.a).neighbors.push({ id: r.b, n: recs.length, units, recs });
    entries.get(r.b).neighbors.push({ id: r.a, n: recs.length, units, recs });
  }
  if (pairMismatch) warn({ where: 'world', msg: `대상 쌍 ${pairMismatch}개의 기록 수가 target-pairs.csv와 다르다(about 집계 쪽을 쓴다)` });

  // ── 걸린 줄기(thread-targets.csv) ──
  for (const r of csv('data/views/links/thread-targets.csv')) {
    const e = entries.get(r.target);
    if (!e) continue;
    e.threads.push(compact({ id: r.thread, n: num(r.records) ?? 0, about: r.thread_about ? true : undefined, sample: list(r.sample) }));
  }

  // ── 흔한 개념 — 중심인 단위(spread)가 읽기 단위의 HUB_SHARE를 넘는 대상(X2와 같은 규칙) ──
  const hubLimit = Math.round(common.units.length * HUB_SHARE);
  const spread = new Map();
  for (const r of csv('data/views/links/centers.csv')) if (entries.has(r.target)) spread.set(r.target, num(r.spread) ?? 0);
  const hubs = [];
  for (const e of entries.values()) {
    e.spread = spread.get(e.id) ?? 0;
    if (e.spread > hubLimit) { e.hub = true; hubs.push(e.id); }
  }

  // ── 내보낼 모양 ──
  const sortRecs = (xs) => xs.sort((a, b) => (a[1] ?? 1e9) - (b[1] ?? 1e9) || String(a[0]).localeCompare(String(b[0])));
  const out = [...entries.values()].map((e) => compact({
    id: e.id, type: e.type, name: e.name, kind: e.kind, note: e.note, aliases: e.aliases, evidence: e.evidence, stories: e.stories, lines: e.lines,
    facts: e.facts, questions: e.questions, open: e.open, events: e.events, units_n: e.unitCount.size,
    first_unit: e.first_unit, first_tick: e.first_tick, first_order: e.first_order, introduced: e.introduced,
    hub: e.hub, spread: e.spread || undefined,
    recs: Object.fromEntries(REC_KINDS.filter((k) => e.recs[k].length).map((k) => [k, sortRecs(e.recs[k])])),
    units: [...e.unitCount].sort((a, b) => (placeOf(a[0]).order ?? 1e9) - (placeOf(b[0]).order ?? 1e9)),
    neighbors: e.neighbors.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)),
    threads: e.threads.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)),
  }));
  out.sort((a, b) => (b.facts ?? 0) - (a.facts ?? 0) || a.name.localeCompare(b.name, 'ko'));
  const topicCount = new Map();
  for (const l of life) if (l.topic) topicCount.set(l.topic, (topicCount.get(l.topic) ?? 0) + 1);
  const topics = [...topicCount].map(([topic, n]) => ({ topic, n })).sort((a, b) => b.n - a.n || a.topic.localeCompare(b.topic, 'ko'));

  return { files: { 'world.json': { entries: out, life, topics, hubs, hub_share: HUB_SHARE } } };
}
