/**
 * 탭 "인물" 데이터(W5) — 화면 5(docs/views.md "5. 인물별 집계")의 시안 표(data/views/persons/, X3d)를 사이트용 JSON으로.
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 *
 *   persons.json          인물 386(사전 person: 전부) — 전체 기준 집계 + 정적 메타. 화면은 컷오프 · 층에 맞춰 persons-detail.json에서 다시 센다
 *     id · name · kind(갈래 — 니케 · 인물 · 랩쳐) · common(지휘관 · 흔한 대상) · spread · owner(줄기 주역이면 true) · same_as[] · aliases[]
 *     scenes · units · lines · speaker_lines · named_lines · implied_lines · implied_scenes · partners
 *     first_unit · first_tick · first_order · first_scene · first_how(이름표로 말함 · 이름 · 다른 이름 · 암시 언급) · first_speaks_unit · last_unit · last_tick · last_order
 *     facts · questions · open · partial · solved · reversed · events · echoes · life · records(다룬 기록 수) · threads[](J)
 *     baselines · changes · inverted · with_others · closures[](O) · merges[](H)
 *   persons-detail.json   인물마다(등장 · 기록 · 변화가 하나라도 있는 381) { id, units[], records[], changes[] }
 *     units[]    등장 히트맵 — { unit, scenes, lines, speaker, implied, first_scene } (자리 · 종류 · 층은 units.json에서)
 *     records[]  그 인물을 다룬 확정 기록 ID(person-records.csv — 사실 · 의문 정의, 사건, 떡밥, 생활상, 변화 · 기준 · 관계 상대, 마무리). 문장 · 자리는 records*.json에서
 *     changes[]  변화 타임라인(chrono-changes.csv) — { id, seq(작중 순서, 없으면 상대 · 불명), act, aspect, with, unit, tick, order, time, class, place, lo, hi, inverted[] }
 *                place는 단위(units.json chrono.place)와 다를 때만(시점 기록 · 조각으로 좁힌 변화)
 *   persons-pairs.json    함께 나온 인물 쌍 7,174 — { a, b, first_unit, last_unit, common, same_as, by[] } (씬 · 대화 · 단위 수는 by[]의 합)
 *     by[] = [[공개 자리, 층, 씬, 둘 다 말한 씬, 단위(, 척추 이벤트 · 사이드 키)], …] 자리 · 층 순 — 여기까지 읽음에서는 본 칸만, 층 거르개에서는 그 층인 칸만 더한다(합은 pairs.csv와 같다 — 내보낼 때 검산)
 *           척추 이벤트 · 사이드(units.json spine이고 메인이 아닌 것 — '봤음' 예외 x가 걸린다)의 몫은 따로 떼어 여섯째 칸에 그 단위 키를 단다 → 화면은 R.seen(키), 그 밖 칸은 자리 ≤ t
 *     common은 한쪽이라도 자주 나오는 인물(지휘관 · 라피 · 아니스 · 네온)이면 true — 상대가 자주 나오는 인물인지는 persons.json의 common으로 본다
 *     자리별 나눔은 tools/views/persons.mjs personScenes(언급 DB의 메타 표 mentions — 씬 · 줄 번호 · 대상만, 본문 없음)로 다시 센다.
 *
 * 대사 본문 · 원문 파일 · 외부 참고 표는 읽지 않는다. 기록 문장은 여기 없다(records.json · records2.json의 것을 쓴다).
 */
import { personScenes } from '../../views/persons.mjs';
import { compact, list, num } from '../lib.mjs';

export const name = 'persons';

const FIRST_HOW = { speaks: '이름표로 말함', named: '이름', alias: '다른 이름' };

export async function run(ctx) {
  const { csv, warn, common } = ctx;
  const placeOf = common.placeOf;
  const targets = new Map(common.targets.filter((t) => t.type === 'person').map((t) => [t.id, t]));
  const recordIds = new Set(common.records.map((r) => r.id));
  const owners = new Set(common.threads.flatMap((j) => j.owners ?? []));

  // ── 입력 표 ──
  const personRows = csv('data/views/persons/persons.csv');
  const pairRows = csv('data/views/persons/pairs.csv');
  const unitRows = csv('data/views/persons/person-units.csv');
  const recRows = csv('data/views/persons/person-records.csv');
  const changeRows = csv('data/views/timeline/chrono-changes.csv');
  const mention = new Map(csv('data/views/mentions/targets.csv').map((r) => [r.target, r]));

  // ── 상세: 단위 등장 · 기록 · 변화 ──
  const detail = new Map();
  const slot = (id) => detail.get(id) ?? detail.set(id, { units: [], records: [], changes: [] }).get(id);
  for (const r of unitRows) {
    if (!placeOf.has(r.unit)) { warn({ where: 'persons', msg: `단위 표에 없는 단위 ${r.unit} (${r.person})` }); continue; }
    slot(r.person).units.push(compact({ unit: r.unit, scenes: num(r.scenes), lines: num(r.lines), speaker: num(r.speaker_lines) || undefined, implied: num(r.implied_lines) || undefined, first_scene: r.first_scene || undefined }));
  }
  let missing = 0;
  for (const r of recRows) {
    if (r.status !== '확정') continue;
    if (!recordIds.has(r.record)) { missing++; continue; }
    const d = slot(r.person);
    if (!d.records.includes(r.record)) d.records.push(r.record);
  }
  if (missing) warn({ where: 'persons', msg: `records*.json에 없는 기록 ${missing}줄을 뺐다(person-records.csv)` });
  const unitPlace = new Map(common.units.map((u) => [u.key, u.chrono?.place]));
  for (const r of changeRows) {
    slot(r.person).changes.push(compact({
      id: r.id, seq: num(r.seq), act: r.act, aspect: r.aspect, with: r.with || undefined, unit: r.unit, tick: num(r.tick), order: num(r.order),
      time: r.time || undefined, class: r.class, place: r.place && r.place !== unitPlace.get(r.unit) ? r.place : undefined, lo: num(r.lo), hi: num(r.hi), inverted: list(r.inverted),
    }));
  }
  for (const d of detail.values()) {
    d.units.sort((a, b) => (placeOf.get(a.unit)?.order ?? 1e9) - (placeOf.get(b.unit)?.order ?? 1e9));
    d.changes.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.id).localeCompare(String(b.id)));
  }

  // ── 인물 표 ──
  const persons = personRows.map((r) => {
    const t = targets.get(r.target);
    if (!t) warn({ where: 'persons', msg: `사전(targets.json)에 없는 인물 ${r.target}` });
    const d = detail.get(r.target) ?? { units: [], records: [], changes: [] };
    const m = mention.get(r.target);
    const firstHow = !r.first_unit ? undefined : m?.first_unit === r.first_unit && m?.first_scene === r.first_scene ? FIRST_HOW[m.first_how] ?? m.first_how : '암시 언급';
    return compact({
      id: r.target, name: r.name || t?.name, kind: t?.kind, common: r.common || undefined, spread: num(r.spread) || undefined, owner: owners.has(r.target) ? true : undefined,
      same_as: t?.same_as, same_as_unit: t?.same_as_unit, aliases: t?.aliases?.map((a) => a.name),
      scenes: num(r.scenes), units: num(r.units), lines: num(r.lines), speaker_lines: num(r.speaker_lines), named_lines: num(r.named_lines),
      implied_lines: num(r.implied_lines) || undefined, implied_scenes: num(r.implied_scenes) || undefined, partners: num(r.partners),
      first_unit: r.first_unit || undefined, first_tick: num(r.first_tick), first_order: num(r.first_order), first_scene: r.first_scene || undefined, first_how: firstHow,
      first_speaks_unit: r.first_speaks_unit || undefined, last_unit: r.last_unit || undefined, last_tick: num(r.last_tick), last_order: num(r.last_order),
      facts: num(r.facts), questions: num(r.questions), open: num(r.open), partial: num(r.partial), solved: num(r.solved), reversed: num(r.reversed),
      events: num(r.events), echoes: num(r.echoes), life: num(r.life), records: d.records.length, threads: list(r.threads),
      baselines: num(r.baselines), changes: num(r.changes), inverted: num(r.inverted), with_others: num(r.with_others),
      closures: list(r.closures), merges: list(r.merges),
    });
  });
  for (const p of persons) {
    const d = detail.get(p.id);
    if (!d) continue;
    const sum = (k) => d.units.reduce((n, u) => n + (u[k] ?? 0), 0);
    if (sum('scenes') !== (p.scenes ?? 0) || sum('lines') !== (p.lines ?? 0)) warn({ where: 'persons', msg: `${p.id}: 단위 표의 합(${sum('scenes')}씬 ${sum('lines')}줄)이 인물 표(${p.scenes}씬 ${p.lines}줄)와 다르다` });
    if (d.changes.length !== (p.baselines ?? 0) + (p.changes ?? 0)) warn({ where: 'persons', msg: `${p.id}: 변화 타임라인 ${d.changes.length}건 ≠ 기준 ${p.baselines} + 변화 ${p.changes}` });
  }

  // ── 쌍 — 공개 자리마다 다시 센다 ──
  const by = pairsByTick(ctx, targets);
  let mismatch = 0;
  const pairs = pairRows.map((r) => {
    const key = `${r.a}\t${r.b}`;
    const m = by.get(key);
    const rows = m ? [...m.values()].sort((x, y) => x.tick - y.tick || x.layer - y.layer || x.ex.localeCompare(y.ex)).map((v) => [v.tick, v.layer, v.scenes, v.talk, v.units.size, ...(v.ex ? [v.ex] : [])]) : [];
    const total = rows.reduce((n, x) => n + x[2], 0);
    if (total !== num(r.scenes)) mismatch++;
    return compact({ a: r.a, b: r.b, first_unit: r.first_unit, last_unit: r.last_unit, common: r.common ? true : undefined, same_as: r.same_as ? true : undefined, by: rows });
  });
  if (mismatch) warn({ where: 'persons', msg: `쌍 ${mismatch}개의 자리별 합이 pairs.csv의 씬 수와 다르다(언급 DB와 시안 표가 어긋남 — draft.mjs를 다시 돌린다)` });
  const csvKeys = new Set(pairRows.map((r) => `${r.a}\t${r.b}`));
  const extra = [...by.keys()].filter((k) => !csvKeys.has(k)).length;
  if (extra) warn({ where: 'persons', msg: `pairs.csv에 없는 쌍 ${extra}개가 언급 DB에 있다(싣지 않음)` });

  const details = persons.filter((p) => detail.has(p.id)).map((p) => ({ id: p.id, ...detail.get(p.id) }));
  return { files: { 'persons.json': persons, 'persons-detail.json': details, 'persons-pairs.json': pairs } };
}

/**
 * 같은 씬에 나온 인물 쌍을 공개 자리 · 층마다 — Map('a\tb' → Map('자리 층 예외키' → { tick, layer, ex, scenes, talk, units: Set })).
 * 척추 이벤트 · 사이드(spine이고 메인이 아닌 단위)는 '봤음' 예외(x)가 걸리므로 같은 자리 · 층의 다른 단위와 섞지 않고 ex = 그 단위 키로 뗀다.
 * 등장 = personScenes의 합집합(자동 줄 + 암시 언급), 둘 다 말한 씬 = 둘 다 speak 줄이 있는 씬 — tools/views/persons.mjs와 같은 규칙.
 */
function pairsByTick(ctx, targets) {
  const unitOfScene = new Map(ctx.common.scenes.map((s) => [s.id, s.unit]));
  const layerOfUnit = new Map(ctx.common.units.map((u) => [u.key, u.layer ?? 0]));
  const extra = new Set(ctx.common.units.filter((u) => u.spine && u.kind !== 'main').map((u) => u.key));
  const ps = personScenes({ db: ctx.db, targetIds: new Set(targets.keys()) }, ctx.records.ds);
  const members = new Map(); // 씬 → [{ t, talk }]
  for (const [t, scenes] of ps) {
    if (!targets.has(t)) continue;
    for (const [s, x] of scenes) (members.get(s) ?? members.set(s, []).get(s)).push({ t, talk: x.speak.size > 0 });
  }
  const out = new Map();
  for (const [s, ms] of members) {
    if (ms.length < 2) continue;
    const unit = unitOfScene.get(s);
    const tick = unit ? ctx.common.placeOf.get(unit)?.tick : null;
    if (tick == null) continue;
    ms.sort((x, y) => (x.t < y.t ? -1 : x.t > y.t ? 1 : 0));
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) {
        const key = `${ms[i].t}\t${ms[j].t}`;
        const m = out.get(key) ?? out.set(key, new Map()).get(key);
        const layer = layerOfUnit.get(unit) ?? 0;
        const ex = extra.has(unit) ? unit : '';
        const k = `${tick} ${layer} ${ex}`;
        const v = m.get(k) ?? m.set(k, { tick, layer, ex, scenes: 0, talk: 0, units: new Set() }).get(k);
        v.scenes++;
        if (ms[i].talk && ms[j].talk) v.talk++;
        v.units.add(unit);
      }
    }
  }
  return out;
}
