/**
 * 탭 "인물" 데이터(W5) — 화면 5(docs/views.md "5. 인물별 집계")의 시안 표(data/views/persons/, X3d)를 사이트용 JSON으로.
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn } — docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 *
 *   persons.json          인물 387(사전 person: 전부) — 전체 기준 집계 + 정적 메타. 화면은 컷오프 · 층에 맞춰 persons-detail.json에서 다시 센다
 *     id · name · kind(갈래 — 니케 · 인물 · 랩쳐) · common(지휘관 · 흔한 대상) · spread · leads[](주역인 줄기 ID — 화면은 첫 스토리를 본 줄기만) · same_as[] · aliases[]
 *     scenes · units · lines · speaker_lines · named_lines · implied_lines · implied_scenes
 *     first_unit · first_tick · first_order · first_scene · first_how(이름표로 말함 · 이름 · 다른 이름 · 암시 언급) · first_speaks_unit · last_unit · last_tick · last_order
 *     facts · questions · open · partial · solved · reversed · events · echoes · life · records(다룬 기록 수) · threads[](J)
 *     baselines · changes · inverted · with_others · closures[](O) · merges[](H)
 *     imp[]      사칭(W23a — people.json impersonates) { id, as(이 인물이 행세한 인물) | by(이 인물로 행세한 인물), rev(드러난 스토리), units[](걸린 스토리) } — 화면은 rev를 읽었을 때만 보인다
 *                이름 승계(W23e — real)는 행세한 인물이 real(이름의 원래 주인)이고, b(독자가 알던 인물)에는 imp가 없다(드러나면 a와 같은 인물 — same_as)
 *   persons-detail.json   인물마다(등장 · 기록 · 변화가 하나라도 있는 381) { id, units[], records[], changes[], rel[] }
 *     units[]    등장 히트맵 — { unit, scenes, lines, speaker, implied, first_scene, hid } (자리 · 종류 · 층은 units.json에서. hid = 그 스토리에 이름이 안 쓰임 — '???'로만, W15f)
 *                사칭이 걸린 스토리(W23a — person-units.csv imp)는 + { rev(드러난 스토리), as[](이 인물이 행세한 인물) | by[](이 인물로 행세한 인물), pre{ scenes, lines, speaker, implied, first_scene } }.
 *                수치는 옮긴 뒤(사칭한 인물에), pre는 드러나기 전 모습 — 화면은 rev를 읽기 전에는 pre를 쓴다. 줄을 다 옮긴 스토리는 scenes 0 행(pre만)으로 남는다
 *     records[]  그 인물을 다룬 확정 기록 ID(person-records.csv — 사실 · 의문 정의, 사건, 떡밥, 생활상, 변화 · 기준 · 관계 상대, 마무리). 문장 · 자리는 records*.json에서
 *                사칭에 가려지는 기록(W23b — imp)은 이름표 주인 쪽에도 싣는다(records · changes · rel). 화면은 fmt.recHas(그 자리 모습)로 고른다. 그 변화 줄은 + { person(실제 인물), imp }
 *     changes[]  변화 타임라인(chrono-changes.csv) — { id, seq(작중 순서, 없으면 상대 · 불명), act, aspect, with, unit, tick, order, time, class, place, lo, hi, inverted[] }
 *                place는 단위(units.json chrono.place)와 다를 때만(시점 기록 · 조각으로 좁힌 변화)
 *     rel[]      관계 상대(W21 — relations.csv) — { with, recs[] } 쌍이 처음 나온 자리 순. recs = 변화 D(양쪽의 것) · 마무리 O(관계 사슬) · 합류 H의 확정 기록 ID를 읽는 자리 순으로.
 *                수 · 순위는 싣지 않는다 — 화면이 여기까지 읽음으로 아는 기록만 골라 상대마다 흐름 · 맺음을 보인다. 같은 씬 횟수(옛 persons-pairs.json)는 지웠다.
 *
 * 대사 본문 · 원문 파일 · 외부 참고 표는 읽지 않는다. 기록 문장은 여기 없다(records.json · records2.json의 것을 쓴다).
 */
import { impersonations } from '../../records/model.mjs';
import { impersonated } from '../../records/impersonation.mjs';
import { compact, list, num } from '../lib.mjs';

export const name = 'persons';

const FIRST_HOW = { speaks: '이름표로 말함', named: '이름', alias: '다른 이름' };

export async function run(ctx) {
  const { csv, warn, common } = ctx;
  const placeOf = common.placeOf;
  const targets = new Map(common.targets.filter((t) => t.type === 'person').map((t) => [t.id, t]));
  const recordIds = new Set(common.records.map((r) => r.id));
  const recOrder = new Map(common.records.map((r) => [r.id, r.order]));
  // 주역(줄기 주역)인 떡밥 — 화면은 그 떡밥의 첫 스토리를 봤을 때만 주역으로 센다(W15b — '주역만'을 그 자리 기준으로)
  const leadsOf = new Map();
  for (const j of common.threads) for (const o of j.owners ?? []) (leadsOf.get(o) ?? leadsOf.set(o, []).get(o)).push(j.id);

  // ── 입력 표 ──
  const personRows = csv('data/views/persons/persons.csv');
  const relRows = csv('data/views/persons/relations.csv');
  const unitRows = csv('data/views/persons/person-units.csv');
  const recRows = csv('data/views/persons/person-records.csv');
  const changeRows = csv('data/views/timeline/chrono-changes.csv');
  const mention = new Map(csv('data/views/mentions/targets.csv').map((r) => [r.target, r]));

  // ── 사칭(W23a) — person-units.csv와 같은 기록(기각 빼고). 후보면 알린다(화면은 확정처럼 쓴다) ──
  const imps = new Map(impersonations(ctx.records.ds).map((x) => [x.id, x]));
  for (const x of imps.values()) if (x.status !== '확정') warn({ where: 'persons', msg: `사칭 ${x.id}가 아직 후보다 — 화면이 확정처럼 쓴다` });
  const orderOf = (u) => placeOf.get(u)?.order ?? 1e9;
  const impOf = new Map(); // 인물 → [{ id, as | by, rev, units }]

  // ── 상세: 단위 등장 · 기록 · 변화 ──
  const detail = new Map();
  const slot = (id) => detail.get(id) ?? detail.set(id, { units: [], records: [], changes: [], rel: [] }).get(id);
  let hidden = 0;
  for (const r of unitRows) {
    if (!placeOf.has(r.unit)) { warn({ where: 'persons', msg: `단위 표에 없는 단위 ${r.unit} (${r.person})` }); continue; }
    // hid — 그 스토리에 이름(표준명 · 다른 이름 · 그 이름이 든 이름표)이 한 번도 안 쓰임 = '???' 등으로만 나왔다(W15f). 화면은 읽는 중에 이 스토리의 인물로 내지 않는다
    const hid = common.namedUnits && !common.namedUnits.get(r.person)?.has(r.unit) ? 1 : undefined;
    if (hid) hidden++;
    // 사칭 — 드러난 스토리(여럿이면 가장 늦은 것: 다 드러나야 옮긴 모습)와 상대, 드러나기 전 모습
    const xs = list(r.imp).map((id) => imps.get(id)).filter(Boolean);
    const imp = xs.length ? {
      rev: xs.map((x) => x.revealed).filter(Boolean).sort((a, b) => orderOf(b) - orderOf(a))[0],
      // 줄 표는 그 스토리에서 이름표 b로 말한 것이 누구인지 — 이름 승계(W23e)의 real 행(회상 속 제 줄)과 b 행에는 상대가 없다
      as: xs.filter((x) => x.a === r.person).map(impersonated), by: xs.filter((x) => x.b === r.person && !x.real).map((x) => x.a),
      pre: compact({ scenes: num(r.pre_scenes), lines: num(r.pre_lines), speaker: num(r.pre_speaker_lines) || undefined, implied: num(r.pre_implied_lines) || undefined, first_scene: r.pre_first_scene || undefined }),
    } : {};
    for (const x of xs) {
      // 이름 승계(W23e) — b(독자가 알던 인물)는 사칭의 상대가 아니고(드러나면 a와 같은 인물 — 머리의 '같은 인물'),
      // 행세당한 real의 걸린 스토리는 제 등장(회상)이 아니라 a가 행세한 스토리다(a 행에서 함께 모은다)
      if (x.real && x.b === r.person) continue;
      const add = (pid, side) => {
        const mine = impOf.get(pid) ?? impOf.set(pid, []).get(pid);
        const e = mine.find((m) => m.id === x.id) ?? mine[mine.push({ id: x.id, [side]: side === 'as' ? impersonated(x) : x.a, rev: x.revealed ?? undefined, units: [] }) - 1];
        e.units.push(r.unit);
      };
      if (x.a === r.person) {
        add(r.person, 'as');
        if (x.real) add(x.real, 'by');
      } else if (!x.real) add(r.person, 'by');
    }
    slot(r.person).units.push(compact({ unit: r.unit, scenes: num(r.scenes), lines: num(r.lines), speaker: num(r.speaker_lines) || undefined, implied: num(r.implied_lines) || undefined, first_scene: r.first_scene || undefined, hid, ...imp }));
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
  // 관계 상대 — 확정 기록만(후보 · 기각은 records*.json에 없다). 남는 기록이 없는 쌍은 싣지 않는다
  let relCut = 0;
  for (const r of relRows) {
    // 변화 · 맺음 · 합류를 합쳐 읽는 자리 순으로(같으면 relations.csv 차례 — D · O · H)
    const recs = [r.changes, r.closures, r.merges].flatMap(list).filter((id) => recordIds.has(id))
      .map((id, i) => ({ id, i, o: recOrder.get(id) ?? 1e9 })).sort((x, y) => x.o - y.o || x.i - y.i).map((x) => x.id);
    if (!recs.length) { relCut++; continue; }
    slot(r.a).rel.push({ with: r.b, recs });
    slot(r.b).rel.push({ with: r.a, recs });
  }
  if (relCut) warn({ where: 'persons', msg: `확정 기록이 없는 관계 쌍 ${relCut}개를 뺐다(relations.csv)` });
  // 사칭에 가려지는 기록(W23b — records*.json imp): 드러나기 전 모습으로도 싣는다 — 실제 인물(a) 목록에 더해 이름표 주인(b) 목록에도.
  // 화면은 fmt.recHas로 그 자리 모습에 그 인물이 있을 때만 보인다(변화 줄은 person · imp를 실어 기록이 오기 전에도 고른다)
  const recImp = new Map(common.records.filter((r) => r.imp).map((r) => [r.id, r.imp]));
  const faceOf = (x, imp) => imp.find((m) => m.a === x)?.b ?? x;
  for (const [pid, d] of [...detail]) {
    for (const id of d.records) for (const m of recImp.get(id) ?? []) if (m.a === pid && !slot(m.b).records.includes(id)) slot(m.b).records.push(id);
    for (const c of d.changes) {
      const imp = recImp.get(c.id);
      if (!imp) continue;
      Object.assign(c, { person: pid, imp });
      const face = faceOf(pid, imp);
      if (face !== pid && !slot(face).changes.some((x) => x.id === c.id)) slot(face).changes.push({ ...c });
    }
    for (const x of d.rel ?? []) {
      for (const id of x.recs) {
        const imp = recImp.get(id);
        if (!imp) continue;
        const [fa, fb] = [faceOf(pid, imp), faceOf(x.with, imp)];
        if (fa === pid && fb === x.with) continue;
        const rel = slot(fa).rel.find((y) => y.with === fb) ?? slot(fa).rel[slot(fa).rel.push({ with: fb, recs: [] }) - 1];
        if (!rel.recs.includes(id)) rel.recs.push(id);
      }
    }
  }
  for (const d of detail.values()) {
    if (!d.rel.length) delete d.rel;
    d.units.sort((a, b) => (placeOf.get(a.unit)?.order ?? 1e9) - (placeOf.get(b.unit)?.order ?? 1e9));
    d.changes.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.id).localeCompare(String(b.id)));
    for (const x of d.rel ?? []) x.recs.sort((a, b) => (recOrder.get(a) ?? 1e9) - (recOrder.get(b) ?? 1e9));
  }

  // ── 인물 표 ──
  const persons = personRows.map((r) => {
    const t = targets.get(r.target);
    if (!t) warn({ where: 'persons', msg: `사전(targets.json)에 없는 인물 ${r.target}` });
    const d = detail.get(r.target) ?? { units: [], records: [], changes: [], rel: [] };
    const m = mention.get(r.target);
    const firstHow = !r.first_unit ? undefined : m?.first_unit === r.first_unit && m?.first_scene === r.first_scene ? FIRST_HOW[m.first_how] ?? m.first_how : '암시 언급';
    return compact({
      id: r.target, name: r.name || t?.name, kind: t?.kind, common: r.common || undefined, spread: num(r.spread) || undefined, leads: leadsOf.get(r.target),
      same_as: t?.same_as, same_as_unit: t?.same_as_unit, aliases: t?.aliases?.map((a) => a.name),
      scenes: num(r.scenes), units: num(r.units), lines: num(r.lines), speaker_lines: num(r.speaker_lines), named_lines: num(r.named_lines),
      implied_lines: num(r.implied_lines) || undefined, implied_scenes: num(r.implied_scenes) || undefined,
      first_unit: r.first_unit || undefined, first_tick: num(r.first_tick), first_order: num(r.first_order), first_scene: r.first_scene || undefined, first_how: firstHow,
      first_speaks_unit: r.first_speaks_unit || undefined, last_unit: r.last_unit || undefined, last_tick: num(r.last_tick), last_order: num(r.last_order),
      facts: num(r.facts), questions: num(r.questions), open: num(r.open), partial: num(r.partial), solved: num(r.solved), reversed: num(r.reversed),
      events: num(r.events), echoes: num(r.echoes), life: num(r.life), records: d.records.length, threads: list(r.threads),
      baselines: num(r.baselines), changes: num(r.changes), inverted: num(r.inverted), with_others: num(r.with_others),
      closures: list(r.closures), merges: list(r.merges), imp: impOf.get(r.target)?.map(compact),
    });
  });
  const foolUnits = new Set(common.units.filter((u) => u.fool).map((u) => u.key));
  for (const p of persons) {
    const d = detail.get(p.id);
    if (!d) continue;
    const sum = (k) => d.units.reduce((n, u) => n + (u[k] ?? 0), 0);
    if (sum('scenes') !== (p.scenes ?? 0) || sum('lines') !== (p.lines ?? 0)) warn({ where: 'persons', msg: `${p.id}: 단위 표의 합(${sum('scenes')}씬 ${sum('lines')}줄)이 인물 표(${p.scenes}씬 ${p.lines}줄)와 다르다` });
    const counted = d.changes.filter((c) => !foolUnits.has(c.unit) && (!c.imp || c.person === p.id)).length; // 인물 표의 수는 만우절 단위를 뺐다(결정 #11). 사칭의 드러나기 전 모습 줄(W23b)은 실제 인물 몫
    if (counted !== (p.baselines ?? 0) + (p.changes ?? 0)) warn({ where: 'persons', msg: `${p.id}: 변화 타임라인 ${counted}건(만우절 빼고) ≠ 기준 ${p.baselines} + 변화 ${p.changes}` });
  }

  const details = persons.filter((p) => detail.has(p.id)).map((p) => ({ id: p.id, ...detail.get(p.id) }));
  return { files: { 'persons.json': persons, 'persons-detail.json': details } };
}
