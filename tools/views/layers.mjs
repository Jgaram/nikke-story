/**
 * 층 판정 · 중요도 시안 (B0b-2 · X3a · X3f-1c) — 척추 밖 단위마다 판정 입력(docs/views.md 화면 1)을 모으고, 기계적인 등급 시안 · 근거 후보를 낸다.
 * 시안일 뿐이다 — 가장 묵직한 한 건은 Claude가 골라 annotations/layers.json에 적고 확정한다(CLAUDE.md "해석이 필요한 기록").
 *
 * 척추(X3f-1b · 1c) = 메인 챕터 + annotations/spine.json의 확정 단위(이벤트 8 · 사이드 3 — tools/views/spine.mjs). 아래의 "메인"은 모두 척추를 뜻한다:
 *   척추 단위는 판정 입력을 모으지 않고(채점하지 않는다), 척추 이벤트 · 사이드와 이어진 기록은 메인 챕터와 이어진 기록과 같은 무게다(docs/importance.md 1절).
 *   spine 옵션으로 척추 집합을 바꿀 수 있다 — 척추 선정 계산(spine.mjs)은 빈 집합(메인 챕터만)으로 부른다.
 *
 * 입력(기록에서 기계적으로):
 *   ① 메인(척추)과 이어진 기록 — 1회독(바로잡기 포함): 메인의 의문 · 사실이 이 단위에서 회수 · 다시 드러남 · 뒤집힘(in), 이 단위의 것이 메인에서 그렇게 됨(out).
 *      2회독 떡밥(E, src 2 — X3a): 이 단위가 흘린 것이 메인에서 드러남(out 암시) · 메인이 이 단위의 것을 다시 꺼냄(out 재언급) ·
 *      메인이 흘린 것의 답이 여기서 드러남(in 암시) · 메인의 것을 여기서 다시 꺼냄(in 재언급 — 참고만, 시안에 안 쓴다)
 *   ② 곧바로 든 줄기 — 이 단위의 의문 정의 · 사건 · 곧바로 든 사실이 든 떡밥 줄기와 그 중요도.
 *      2회독 떡밥(echo)은 따로 — 가리킨 것(줄기 J · 사실 · 의문 · 사건)이 든 줄기. 암시만 시안에 쓴다(아직 열린 줄기의 복선), 재언급은 참고
 *   ③ about으로만 든 줄기 — 이 단위의 사실 정의가 about으로만 걸친 줄기(세계관 · 메인 인물 설명의 단서)
 *   ④ 줄기에 안 묶인 사실(X3f — 참고의 문턱 ③) — 이 단위의 사실 정의 가운데 어느 줄기에도 곧바로 들지 않은 것:
 *      세계(조직 · 장소 · 개념 · 사건 · 물건 대상이 about에 — 흔한 대상 COMMON_SHARE 넘는 것은 빼고) · 메인 인물(메인 사실 MAIN_PERSON_FACTS건 이상에 about으로 든 인물, 지휘관 빼고)
 *   ⑤ 주역 사연(X3f ①) — 주역 명단(annotations/leads.json, 기각 빼고)의 인물을 about으로 다룬 사실(줄기에 든 것도) · 그 인물의 신념 · 기억 · 소속 · 신체 변화(D).
 *      지휘관은 사실이 어디에나 걸려 변화(D)만 센다. 원점 단위는 주역마다 하나 — 고르는 것은 Claude(판정)
 *   참고(2회독): 줄기 인물(뼈대 · 보강 줄기의 about 인물)의 변화(D — 기억 · 소속 · 신체 · 신념) · 생활상(U) 주제별 수
 *   ⑥ 뒤 척추 의문(X3f-1c — 카드 4) 방향 규칙의 단서): 이 단위보다 뒤에 척추가 제기한 의문 가운데 이 단위의 사실 정의와 about 대상이 겹치는 것(읽는 순서로 뒤, 회수 사슬이 잇지 않는 것).
 *      판정은 `find <대상>`으로 문장을 맞댄다 — 이것은 어디를 볼지 가리키는 단서다
 *   ⑦ 빌드업 마무리(X3f-1d — tools/views/closures.mjs, closures 옵션으로 받는다): 척추가 쌓은 것이 여기서 끝난다 —
 *      (가) 긴 회수(척추가 제기한 의문을 제기 뒤 20칸 이상 지나 여기서 전부 회수) · 복선의 답(척추가 먼저 흘린 암시의 사실이 여기서 처음 밝혀짐),
 *      (나) · (다) 마무리 기록 O(연작 · 갈등 · 관계 · 성장 — 쌓인 자리에 척추가 있고 끝이 여기). (가)는 ①의 in 회수 · in 암시와 겹친다 — 오래 쌓였다는 표시다.
 *      O는 확정만 시안에 쓴다(후보는 보이기만). 지휘관과의 관계 마무리는 표시만 — 지휘관은 어디에나 있다(카드 3절 5)
 * 시안 규칙(X3f — 등급 넷): 뼈대 줄기의 메인 연결이 out · 전부 회수 · 뒤집음(2회독은 out 재언급 · in 암시)이면 필수 · 메인 연결이 있으면 보강 ·
 *   뼈대 · 보강 줄기에 곧바로 들면 보강(추정) · 척추가 쌓은 마무리 기록(확정, 지휘관 관계 빼고)이 있으면 보강(추정) · 뼈대 · 보강 줄기의 2회독 암시(열린 줄기의 복선 — X3f ④) · 뼈대 줄기 about 사실 2건 이상 ·
 *   줄기에 안 묶인 세계 · 메인 인물 사실 · 주역 사연 · 생활상 · 줄기 인물 변화가 있으면 참고(추정 — 메인이 말하지 않은 기록인지는 판정이 본다) · 그 밖은 독립.
 *   `draft1`은 2회독 없이(1회독 + 바로잡기만) 낸 시안 — 2회독이 시안을 바꾼 단위를 가린다.
 */
import { compareIds, isRecord, spineUnits } from '../records/model.mjs';
import { kindOfKey } from '../records/order.mjs';
import { threadMembership } from '../records/threads.mjs';

const W = { 뼈대: 0, 보강: 1, 독립: 2 };
/** 흔한 대상 — 메인 밖 단위의 이만큼 넘게 사실 about에 걸리면 세계 사실을 가리는 데 쓰지 않는다(지휘관 · 니케 · 방주 · 중앙 정부 · 카운터스 · 랩쳐 — 2026-10 실측) */
export const COMMON_SHARE = 0.08;
/** 메인 인물 — 메인 챕터 사실 정의 이만큼 이상에 about으로 든 인물 */
export const MAIN_PERSON_FACTS = 3;
const COMMANDER = 'person:지휘관';
const ACT_RANK = { reversal: 0, setup_payoff: 1, callback: 2 };
/** 참고로 보이는 인물 변화의 측면 — 배경 · 동기(관계 · 성격은 일상극에도 흔하다) */
export const CHANGE_ASPECTS = ['기억', '소속', '신체', '신념'];
/** ⑥ 뒤 척추 의문 — 단위마다 보이는 최대 수(대상이 겹치는 순서대로, 읽는 순서) */
export const LATER_QUESTIONS = 8;

/** 척추 단위의 이름 — 메인 챕터는 "메인 ch38", 척추 이벤트 · 사이드는 "척추 event_redash" */
export const refLabel = (u) => (kindOfKey(u) === '메인' ? `메인 ${u}` : `척추 ${u}`);

/**
 * @param {ReturnType<import('../records/model.mjs').loadDataset>} ds
 * @param {ReturnType<import('./read1.mjs').buildRead1Views>} views
 * @param {{ edges: object[] }|null} [r2] 2회독 떡밥 엣지(tools/records/read2.mjs read2Edges) — 없으면 1회독만(B0b-2와 같다)
 * @param {{ spine?: Set<string>, closures?: ReturnType<import('./closures.mjs').buildClosures>|null }} [opts] spine: 메인 챕터 밖 척추 단위(기본 annotations/spine.json 확정) — 빈 집합이면 메인 챕터만 기준(척추 선정 계산) ·
 *   closures: 빌드업 마무리(⑦) — 없으면 ⑦을 비운다
 * @returns {Map<string, object>} 단위 → { unit, kind, main[], direct[], echo[], about[], changes[], life{}, loose{world[], main[]}, leads[], later[], buildup{payoffs[], answers[], closures[]}, draft, draft1 }
 */
export function layerSignals(ds, views, r2 = null, { spine = spineUnits(ds), closures = null } = {}) {
  const tm = threadMembership(ds);
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각' && isRecord(c));
  const byId = new Map(live.map((c) => [c.id, c]));
  const liveAll = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byIdAll = new Map(liveAll.map((c) => [c.id, c]));
  const recUnit = new Map();
  for (const r of views.sceneEdges) {
    recUnit.set(r.record, r.to_unit);
    if (!recUnit.has(r.parent)) recUnit.set(r.parent, r.from_unit);
  }
  const unitOf = (c) => recUnit.get(c.id) ?? c.unit;
  const weightOf = (j) => tm.byId.get(j)?.weight ?? null;
  const threadsOf = (c) => {
    if (!c) return [];
    if (c.kind === 'thread') return tm.byId.has(c.id) ? [c.id] : [];
    if (c.role === 'event') return threadsOf(byId.get(c.parent));
    if (c.kind === 'question') return tm.ofQuestion.has(c.id) ? [tm.ofQuestion.get(c.id)] : [];
    if (c.kind === 'fact') return tm.ofFact.get(c.id) ?? [];
    return [];
  };
  const pointThreads = (e) => [...new Set((e?.obj?.points ?? []).flatMap((p) => threadsOf(byIdAll.get(p))))];
  // 기준(척추) — 메인 챕터 + 척추 이벤트 · 사이드. 이 안의 단위는 판정 입력을 모으지 않는다
  const isMain = (u) => kindOfKey(u) === '메인' || spine.has(u);
  const out = new Map();
  const S = (u) => {
    if (!out.has(u)) out.set(u, { unit: u, kind: kindOfKey(u), main: [], direct: [], echo: [], about: new Map(), changes: [], life: {}, loose: { world: [], main: [] }, leads: new Map(), later: [], buildup: emptyBuildup() });
    return out.get(u);
  };
  const pushMain = (unit, m) => S(unit).main.push({ ...m, weights: Object.fromEntries(m.threads.map((j) => [j, weightOf(j)])) });
  for (const r of views.sceneEdges) {
    if (!r.from_unit || !r.to_unit || isMain(r.from_unit) === isMain(r.to_unit)) continue;
    const [unit, dir] = isMain(r.from_unit) ? [r.to_unit, 'in'] : [r.from_unit, 'out'];
    // 단위의 기록: in이면 이 단위의 사건, out이면 이 단위에서 던진 의문 · 드러난 사실(부모)
    const own = dir === 'in' ? r.record : r.parent;
    pushMain(unit, { src: 1, dir, record: r.record, own, type: r.type, act: null, degree: r.degree, mainUnit: dir === 'in' ? r.from_unit : r.to_unit,
      threads: threadsOf(byId.get(r.parent)) });
  }
  // 2회독 떡밥 엣지 — 암시: 떡밥 씬 → 드러난 씬, 재언급: 드러난 씬 → 떡밥 씬
  for (const r of r2?.edges ?? []) {
    if (r.status === '기각' || !r.from_unit || !r.to_unit || isMain(r.from_unit) === isMain(r.to_unit)) continue;
    const echoUnit = r.act === '암시' ? r.from_unit : r.to_unit;
    const echoInMain = isMain(echoUnit);
    const unit = isMain(r.from_unit) ? r.to_unit : r.from_unit;
    const mainUnit = isMain(r.from_unit) ? r.from_unit : r.to_unit;
    const dir = echoInMain ? (r.act === '암시' ? 'in' : 'out') : (r.act === '암시' ? 'out' : 'in');
    // 단위의 기록: 떡밥이 이 단위에 있으면 그 떡밥, 메인에 있으면 이 단위의 가리킨 기록(의문이면 이 단위의 회수)
    let own = r.record;
    if (echoInMain) {
      const p = byId.get(r.point);
      const rec = p?.kind === 'question' && p.role === 'def' && unitOf(p) !== unit
        ? live.find((c) => c.role === 'event' && c.parent === p.id && c.act === '회수' && unitOf(c) === unit) : null;
      own = rec?.id ?? r.point;
    }
    const e = byIdAll.get(r.record);
    pushMain(unit, { src: 2, dir, record: r.record, own, type: r.type, act: r.act, degree: '', mainUnit,
      threads: [...new Set([...threadsOf(byIdAll.get(r.point)), ...(e?.obj?.points ?? []).filter((p) => tm.byId.has(p))])] });
  }
  // ④ · ⑤ — 흔한 대상 · 메인 인물 · 주역(X3f)
  const factDefs = live.filter((c) => c.kind === 'fact' && c.role === 'def' && c.unit);
  const aboutOf = (c) => (Array.isArray(c.obj?.about) ? c.obj.about : []);
  const spread = new Map();
  const mainFacts = new Map();
  for (const c of factDefs) {
    for (const a of new Set(aboutOf(c))) {
      if (isMain(c.unit)) mainFacts.set(a, (mainFacts.get(a) ?? 0) + 1);
      else (spread.get(a) ?? spread.set(a, new Set()).get(a)).add(c.unit);
    }
  }
  const outsideUnits = new Set(factDefs.filter((c) => !isMain(c.unit)).map((c) => c.unit)).size;
  const common = new Set([...spread].filter(([, us]) => us.size > outsideUnits * COMMON_SHARE).map(([a]) => a));
  const mainPersons = new Set([...mainFacts].filter(([a, n]) => a.startsWith('person:') && a !== COMMANDER && n >= MAIN_PERSON_FACTS).map(([a]) => a));
  const leads = new Set(ds.candidates.filter((c) => c.kind === 'lead' && c.status !== '기각' && c.obj?.person).map((c) => c.obj.person));
  const L = (u, p) => {
    const m = S(u).leads;
    if (!m.has(p)) m.set(p, { person: p, facts: [], deep: [] });
    return m.get(p);
  };
  for (const c of live) {
    if (c.kind === 'time') continue;
    const u = unitOf(c);
    if (!u || isMain(u)) continue;
    const js = threadsOf(c);
    for (const j of js) S(u).direct.push({ record: c.id, thread: j, weight: weightOf(j), role: c.role, kind: c.kind, fix: Boolean(c.fix) });
    if (c.kind === 'fact' && c.role === 'def') {
      for (const j of tm.ofFactAbout.get(c.id) ?? []) if (!js.includes(j)) S(u).about.set(j, (S(u).about.get(j) ?? 0) + 1);
      const about = aboutOf(c);
      if (!js.length) {
        if (about.some((a) => !a.startsWith('person:') && !common.has(a))) S(u).loose.world.push(c.id);
        if (about.some((a) => mainPersons.has(a))) S(u).loose.main.push(c.id);
      }
      for (const p of new Set(about)) if (leads.has(p) && p !== COMMANDER) L(u, p).facts.push(c.id);
    }
  }
  // 주역의 신념 · 기억 · 소속 · 신체 변화 — 2회독 기록이 있을 때만(시안 draft1에는 안 쓴다)
  if (r2) {
    for (const c of liveAll) {
      if (!c.read2 || c.kind !== 'change' || !c.unit || isMain(c.unit) || !CHANGE_ASPECTS.includes(c.obj?.aspect) || !leads.has(c.obj?.person)) continue;
      L(c.unit, c.obj.person).deep.push(c.id);
    }
  }
  if (r2) {
    // 줄기 인물 — 뼈대 · 보강 줄기의 about에 든 인물(어디에나 걸리는 인물은 줄기 about에 넣지 않는다 — docs/annotations.md "떡밥 줄기")
    const threadPersons = new Map();
    for (const t of tm.threads) {
      if (W[t.weight] > 1) continue;
      for (const a of t.c.obj?.about ?? []) if (String(a).startsWith('person:')) threadPersons.set(a, [...(threadPersons.get(a) ?? []), t.id]);
    }
    for (const c of liveAll) {
      if (!c.read2 || !c.unit || isMain(c.unit)) continue;
      if (c.kind === 'echo') {
        for (const j of pointThreads(c)) S(c.unit).echo.push({ record: c.id, thread: j, weight: weightOf(j), act: c.act });
      } else if (c.kind === 'change' && c.act === '변화' && CHANGE_ASPECTS.includes(c.obj?.aspect) && threadPersons.has(c.obj?.person)) {
        S(c.unit).changes.push({ record: c.id, person: c.obj.person, aspect: c.obj.aspect, threads: threadPersons.get(c.obj.person) });
      } else if (c.kind === 'life') {
        const life = S(c.unit).life;
        life[c.act ?? '?'] = (life[c.act ?? '?'] ?? 0) + 1;
      }
    }
  }
  // ⑥ 뒤 척추 의문 — 척추가 이 단위보다 뒤(읽는 순서)에 제기한 의문 가운데 이 단위 사실 정의의 about 대상이 겹치는 것
  const orderOf = new Map((views.units ?? []).map((u) => [u.unit, u.order]));
  const spineQs = live.filter((c) => c.kind === 'question' && c.role === 'def' && isMain(unitOf(c)) && orderOf.has(unitOf(c)))
    .map((c) => ({ id: c.id, unit: unitOf(c), order: orderOf.get(unitOf(c)), about: new Set(aboutOf(c).filter((a) => !common.has(a) && a !== COMMANDER)) }))
    .filter((q) => q.about.size).sort((a, b) => a.order - b.order || compareIds(a.id, b.id));
  for (const s of out.values()) {
    const pos = orderOf.get(s.unit);
    if (pos == null) continue;
    const mine = new Set(factDefs.filter((c) => unitOf(c) === s.unit).flatMap(aboutOf));
    for (const q of spineQs) {
      if (q.order <= pos) continue;
      const hit = [...q.about].filter((a) => mine.has(a));
      if (hit.length) s.later.push({ question: q.id, unit: q.unit, about: hit });
    }
  }
  // ⑦ 빌드업 마무리(X3f-1d) — 척추가 쌓은 것만. 척추 단위는 채점하지 않으니 모으지 않는다
  if (closures) {
    for (const [u, x] of closures.b.byUnit) {
      if (isMain(u)) continue;
      const payoffs = x.payoffList.filter((p) => p.spine);
      const answers = x.answerList.filter((a) => a.spineHints);
      if (payoffs.length || answers.length) Object.assign(S(u).buildup, { payoffs, answers });
    }
    for (const [u, xs] of closures.v.byEnd) {
      if (isMain(u)) continue;
      const mine = xs.filter((x) => x.spineBuilt).map((x) => ({
        id: x.c.id, type: x.type, status: x.c.status, span: x.span, built: x.builtUnits.filter((b) => b !== u), text: x.c.obj?.text ?? '', closing: x.c.obj?.closing ?? [],
        commander: x.type === '관계' && (x.c.obj?.about ?? []).includes(COMMANDER),
      }));
      if (mine.length) S(u).buildup.closures = mine;
    }
  }
  for (const s of out.values()) {
    s.about = [...s.about].map(([thread, n]) => ({ thread, weight: weightOf(thread), n })).sort((a, b) => W[a.weight] - W[b.weight] || b.n - a.n);
    // 주역 사연 — 사실 2건 이상이거나 깊은 변화가 있는 주역만(사실 한 건은 스침), 무거운 순
    s.leads = [...s.leads.values()].filter((x) => x.facts.length >= 2 || x.deep.length)
      .sort((a, b) => b.deep.length - a.deep.length || b.facts.length - a.facts.length || a.person.localeCompare(b.person));
    s.draft = draftOf(s);
    s.draft1 = draftOf(s, { read2: false });
  }
  return out;
}

const best = (xs) => (xs.length ? Math.min(...xs) : 9);
/** ⑦ 빌드업 마무리의 빈 값 */
const emptyBuildup = () => ({ payoffs: [], answers: [], closures: [] });
/** 시안에 쓰는 마무리 기록 — 확정 · 지휘관 관계 아님 */
const closureCounts = (x) => x.status === '확정' && !x.commander;

/** 판정 입력이 하나도 없는 단위의 신호 — layerSignals에 안 나오는 단위 */
export function emptySignal(unit, kind = kindOfKey(unit)) {
  const draft = { grade: '독립', basis: null, confidence: '확실', reason: '메인과 이어진 기록 · 줄기에 든 기록 · about으로 걸친 줄기가 없다' };
  return { unit, kind, main: [], direct: [], echo: [], about: [], changes: [], life: {}, loose: { world: [], main: [] }, leads: [], later: [], buildup: emptyBuildup(), draft, draft1: draft };
}

/** 메인 연결 한 줄을 사람이 읽는 말로 */
export function mainText(m) {
  if (m.src === 2) {
    const how = m.dir === 'out'
      ? (m.act === '암시' ? `이 단위가 흘린 것(${m.record})이 ${refLabel(m.mainUnit)}에서 드러남` : `${refLabel(m.mainUnit)}이 이 단위의 ${m.own}을 다시 꺼냄(${m.record})`)
      : (m.act === '암시' ? `${refLabel(m.mainUnit)}이 흘린 것(${m.record})의 답 ${m.own}이 여기서 드러남` : `${refLabel(m.mainUnit)}의 것을 여기서 다시 꺼냄(${m.record})`);
    return `2회독 ${m.act} — ${how}`;
  }
  return `${refLabel(m.mainUnit)}${m.dir === 'in' ? '의 기록을 여기서' : '이 이 단위의 기록을'} ${m.type === 'setup_payoff' ? `회수(${m.degree})` : m.type === 'reversal' ? '뒤집음' : '다시 드러냄'}`;
}

/** 시안에 쓰는 메인 연결인가 — 2회독 in 재언급(메인 것을 여기서 다시 꺼냄)은 참고만 */
const counts = (m) => !(m.src === 2 && m.dir === 'in' && m.act === '재언급');
/** 필수 쪽 연결인가 — 메인이 이 단위의 것을 딛고 가거나(out · 2회독 out 재언급) 메인의 의문 · 복선의 답이 여기 있다(전부 회수 · 뒤집음 · 2회독 in 암시) */
const heavy = (m) => (m.src === 2
  ? (m.dir === 'out' && m.act === '재언급') || (m.dir === 'in' && m.act === '암시')
  : m.dir === 'out' || m.degree === '전부' || m.type === 'reversal');

/** 기계 시안 — 등급 · 근거 후보 · 이유 · 확신도. read2: false면 2회독 입력(src 2 · echo)을 빼고 낸다 */
function draftOf(s, { read2 = true } = {}) {
  const mainW = (m) => best(m.threads.map((j) => W[m.weights[j]] ?? 9));
  const mains = s.main.filter((m) => counts(m) && (read2 || m.src !== 2));
  const strong = mains.filter((m) => mainW(m) === 0 && heavy(m))
    .sort((a, b) => a.src - b.src || (a.degree === '전부' ? 0 : 1) - (b.degree === '전부' ? 0 : 1) || ACT_RANK[a.type] - ACT_RANK[b.type]);
  const anyMain = [...mains].sort((a, b) => mainW(a) - mainW(b) || a.src - b.src || ACT_RANK[a.type] - ACT_RANK[b.type]);
  const roleRank = (d) => (d.role === 'event' ? 0 : d.kind === 'question' ? 1 : 2);
  const direct = [...s.direct].sort((a, b) => W[a.weight] - W[b.weight] || roleRank(a) - roleRank(b) || compareIds(a.record, b.record));
  const hints = read2 ? s.echo.filter((e) => e.act === '암시' && W[e.weight] <= 1).sort((a, b) => W[a.weight] - W[b.weight] || compareIds(a.record, b.record)) : [];
  const aboutSk = s.about.filter((a) => a.weight === '뼈대').reduce((n, a) => n + a.n, 0);
  if (strong.length) return { grade: '필수', basis: strong[0].own, confidence: '추정', reason: `${mainText(strong[0])} — 뼈대 줄기 ${strong[0].threads.join(' · ')}` };
  if (anyMain.length) return { grade: '보강', basis: anyMain[0].own, confidence: '추정', reason: `${mainText(anyMain[0])}${anyMain[0].threads.length ? ` — 줄기 ${anyMain[0].threads.join(' · ')}` : ''}` };
  if (direct.length && W[direct[0].weight] <= 1) return { grade: '보강', basis: direct[0].record, confidence: '추정', reason: `${direct[0].weight} 줄기 ${direct[0].thread}에 곧바로 든다` };
  const closing = read2 ? (s.buildup?.closures ?? []).filter(closureCounts) : [];
  if (closing.length) return { grade: '보강', basis: closing[0].closing[0] ?? null, confidence: '추정', reason: `척추가 쌓은 ${closing[0].type}의 끝 ${closing[0].id} — ${closing[0].built.slice(0, 4).join(' · ')}에서 쌓여 여기서 끝난다(${closing[0].span}칸)` };
  if (hints.length) return { grade: '참고', basis: hints[0].record, confidence: '추정', reason: `2회독 암시 — ${hints[0].weight} 줄기 ${hints[0].thread}의 복선(메인에 아직 빈틈이 없다 — X3f ④)` };
  if (aboutSk >= 2) {
    const a = s.about.find((x) => x.weight === '뼈대');
    return { grade: '참고', basis: a.thread, confidence: '추정', reason: `뼈대 줄기 ${a.thread}의 대상을 다룬 사실 ${aboutSk}건(about) — 세계관 · 메인 인물 설명인지 본다` };
  }
  const leads = read2 ? s.leads : s.leads.filter((x) => x.facts.length >= 2);
  const lifeN = read2 ? Object.values(s.life ?? {}).reduce((a, n) => a + n, 0) : 0;
  const changes = read2 ? s.changes.length : 0;
  const world = s.loose.world.length;
  const mainP = s.loose.main.length;
  if (leads.length || world || mainP || lifeN || changes) {
    const basis = leads[0]?.deep[0] ?? leads[0]?.facts[0] ?? s.loose.main[0] ?? s.loose.world[0] ?? s.changes[0]?.record ?? null;
    const parts = [
      leads.length ? `주역 사연 ${leads.map((x) => `${x.person.replace('person:', '')}×${x.facts.length + x.deep.length}`).join(' ')}` : '',
      world ? `세계 사실 ${world}` : '', mainP ? `메인 인물 사실 ${mainP}` : '', lifeN ? `생활상 ${lifeN}` : '', changes ? `줄기 인물 변화 ${changes}` : '',
    ].filter(Boolean);
    return { grade: '참고', basis, confidence: '추정', reason: `줄기에 안 묶인 기록 — ${parts.join(' · ')} — 메인이 말하지 않은 것인지 본다(참고의 문턱)` };
  }
  const indep = direct.find((d) => d.weight === '독립');
  const hint = s.about.length ? ` · about으로 ${s.about.map((a) => `${a.thread}×${a.n}`).join(' ')}` : '';
  return {
    grade: '독립', basis: indep?.thread ?? null, confidence: s.about.length ? '추정' : '확실',
    reason: `메인과 이어진 기록 · 뼈대 · 보강 줄기에 곧바로 든 기록 · 줄기에 안 묶인 세계 · 메인 인물 사실이 없다${indep ? ` — 독립 줄기 ${indep.thread}만` : ''}${hint}`,
  };
}

/** 시안 한 단위를 사람이 읽는 몇 줄로 (records.mjs layers <단위>) — judgment: 그 단위의 판정(K 후보), 있으면 맨 위에 */
export function renderSignals(s, byId, { width = 110, judgment = null, texts = 6, summary = null, spine = false } = {}) {
  const cut = (t) => (t.length > width ? `${t.slice(0, width)}…` : t);
  const textOf = (id) => {
    const c = byId.get(id);
    if (!c) return id;
    if (c.role === 'event') return `${id} ${c.act}${c.obj?.degree ? `(${c.obj.degree})` : ''} ${c.parent}: ${byId.get(c.parent)?.text ?? ''}`;
    if (c.kind === 'echo') return `${id} ${c.act} → ${(c.obj?.points ?? []).join(',')}: ${c.obj?.text ?? ''}`;
    if (c.kind === 'change') return `${id} ${c.obj?.person ?? '?'} ${c.obj?.aspect ?? ''}: ${c.obj?.before ?? ''} → ${c.obj?.after ?? ''}`;
    return `${id} ${c.text ?? ''}`;
  };
  const L = [];
  if (spine) L.push(`■ ${s.unit} [${s.kind}] 척추 — 채점하지 않는다(docs/importance.md 1절). 아래 판정은 척추에 들기 전 것으로, 척추에서 빼면 판정으로 돌아온다`);
  if (judgment) {
    const o = judgment.obj ?? {};
    const at = o.from ? ` · ${o.from}부터(그 앞 ${o.before ?? '-'})` : '';
    L.push(`■ ${s.unit} [${s.kind}] 판정 ${judgment.id} ${o.grade ?? '?'}${at} · 근거 ${o.basis ?? '없음'} (${judgment.status ?? '?'} · ${o.confidence ?? '?'}${o.asof ? ` · 기준 시점 ${o.asof}` : ''}) — ${judgment.reason ?? ''}`);
    L.push(`  시안 ${s.draft.grade} · 근거 ${s.draft.basis ?? '없음'} — ${s.draft.reason}${s.draft1 && s.draft1.grade !== s.draft.grade ? ` (2회독 없이: ${s.draft1.grade})` : ''}`);
  } else {
    L.push(`■ ${s.unit} [${s.kind}] 시안 ${s.draft.grade} · 근거 ${s.draft.basis ?? '없음'} — ${s.draft.reason}${s.draft1 && s.draft1.grade !== s.draft.grade ? ` (2회독 없이: ${s.draft1.grade})` : ''}`);
  }
  const m1 = s.main.filter((m) => m.src !== 2);
  const m2 = s.main.filter((m) => m.src === 2);
  if (m1.length) L.push(`  척추 연결: ${m1.map((m) => `${m.dir}:${m.record}${m.degree ? `(${m.degree})` : ''}@${m.mainUnit}[${m.threads.join('/')}]`).join(' ')}`);
  if (m2.length) L.push(`  척추 연결 2회독: ${m2.map((m) => `${m.dir} ${m.act} ${m.record}${m.own !== m.record ? `→${m.own}` : ''}@${m.mainUnit}[${m.threads.join('/')}]`).join(' ')}`);
  const dj = new Map();
  for (const d of s.direct) dj.set(d.thread, [...new Set([...(dj.get(d.thread) ?? []), d.record])]);
  if (dj.size) L.push(`  줄기: ${[...dj].map(([j, rs]) => `${j}(${s.direct.find((d) => d.thread === j).weight}) ${rs.slice(0, 6).join(',')}`).join(' · ')}`);
  const ej = new Map();
  for (const e of s.echo ?? []) {
    const k = `${e.thread}(${e.weight}) ${e.act}`;
    ej.set(k, [...new Set([...(ej.get(k) ?? []), e.record])]);
  }
  if (ej.size) L.push(`  2회독 떡밥: ${[...ej].map(([k, rs]) => `${k} ${rs.slice(0, 5).join(',')}${rs.length > 5 ? ` 외 ${rs.length - 5}` : ''}`).join(' · ')}`);
  if (s.about.length) L.push(`  about: ${s.about.map((a) => `${a.thread}(${a.weight})×${a.n}`).join(' ')}`);
  if (s.changes?.length) L.push(`  줄기 인물 변화(참고): ${s.changes.map((d) => `${d.record} ${d.person.replace('person:', '')} ${d.aspect}[${d.threads.join('/')}]`).join(' · ')}`);
  const life = Object.entries(s.life ?? {});
  if (life.length) L.push(`  생활상(참고): ${life.map(([t, n]) => `${t} ${n}`).join(' · ')}`);
  if (s.leads?.length) L.push(`  주역 사연: ${s.leads.map((x) => `${x.person.replace('person:', '')} 사실 ${x.facts.length}${x.deep.length ? ` · 변화 ${x.deep.join(',')}` : ''}`).join(' · ')}`);
  if (s.loose?.world.length || s.loose?.main.length) {
    L.push(`  줄기에 안 묶인 사실: 세계 ${s.loose.world.length}${s.loose.world.length ? `(${s.loose.world.slice(0, 6).join(',')}${s.loose.world.length > 6 ? ' …' : ''})` : ''} · 메인 인물 ${s.loose.main.length}${s.loose.main.length ? `(${s.loose.main.slice(0, 6).join(',')}${s.loose.main.length > 6 ? ' …' : ''})` : ''}`);
  }
  if (s.later?.length) {
    const xs = s.later.slice(0, LATER_QUESTIONS);
    L.push(`  뒤 척추 의문(대상 겹침 — 회수 사슬이 잇지 않는다, find로 맞댄다): ${xs.map((q) => `${q.question}@${q.unit}[${q.about.map((a) => a.replace(/^\w+:/, '')).join(',')}]`).join(' ')}${s.later.length > xs.length ? ` 외 ${s.later.length - xs.length}` : ''}`);
  }
  const bu = s.buildup ?? emptyBuildup();
  if (bu.payoffs.length || bu.answers.length || bu.closures.length) {
    const parts = [
      bu.payoffs.length ? `긴 회수 ${bu.payoffs.length}(${bu.payoffs.slice(0, 4).map((p) => `${p.root}@${p.from} ${p.gap}칸`).join(' · ')}${bu.payoffs.length > 4 ? ' …' : ''})` : '',
      bu.answers.length ? `복선의 답 ${bu.answers.length}(${bu.answers.slice(0, 4).map((a) => `${a.root}←척추 암시 ${a.spineHints}`).join(' · ')}${bu.answers.length > 4 ? ' …' : ''})` : '',
      ...bu.closures.map((x) => `${x.id} ${x.type}${x.commander ? '(지휘관)' : ''} [${x.status}] ${x.built.slice(0, 4).join(' · ')}${x.built.length > 4 ? ' …' : ''} → 여기 ${x.span}칸${x.status === '확정' ? ` — ${x.text}` : ''}`),
    ].filter(Boolean);
    L.push(`  빌드업 마무리(척추가 쌓음): ${parts.join(' · ')}`);
  }
  if (summary) L.push(`  요약(1회독): ${summary}`);
  const hints = (s.echo ?? []).filter((e) => e.act === '암시' && W[e.weight] <= 1).map((e) => e.record);
  const ids = [...new Set([s.draft.basis, judgment?.obj?.basis, ...s.main.map((m) => m.own), ...s.main.filter((m) => m.src === 2).map((m) => m.record),
    ...s.direct.map((d) => d.record), ...hints, ...(s.leads ?? []).flatMap((x) => [...x.deep, ...x.facts]), ...(s.loose?.main ?? []), ...(s.loose?.world ?? [])]
    .filter((x) => x && !/^J\d/.test(x)))].slice(0, texts);
  for (const id of ids) L.push(`   ${cut(textOf(id))}`);
  return L.join('\n');
}
