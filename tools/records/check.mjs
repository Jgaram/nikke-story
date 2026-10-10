/**
 * 검증기 — 1회독 기록(annotations/read1/*.json)과 정체 연결 후보(people.json candidates) · 떡밥 줄기(threads.json) · 층 판정(layers.json) · 주역 명단(leads.json),
 * 2회독 기록(annotations/read2/*.json — 암시 언급 · 떡밥 · 인물 변화 · 생활상) · 수동 엣지(links.json) · 2회독 볼 거리(watch.json)를 원문 · 사전과 대조한다.
 * 잡는 것: 없는 씬 ID · 줄 번호, 상태 · 확신도 · 결정 값 오타, 필수 칸 누락, 모르는 칸(오타), ID 모양 · 겹침,
 * 없는 사실 · 의문 · 대상을 가리키는 참조, 기각된 항목을 가리키는 참조, 검토 기록과 어긋난 상태.
 * 오류는 고쳐야 커밋한다. 경고는 확인만 한다(되짚어 읽기로 다른 단위의 씬을 근거로 든 것 등).
 */
import path from 'node:path';
import { oneLine } from '../lib/render.mjs';
import { computeLayers, layerKind } from './layers.mjs';
import {
  AFFIL_ACTS, ASPECTS, CHANGE_ACTS, CLOSURE_TYPES, CONFIDENCES, DECISIONS, DEGREES, ECHO_ACTS, EDGE_TYPES, FACT_ACTS, FIELDS, FROM_GRADES, GRADES, ID, LAYERS, LIFE_TOPICS, QUESTION_ACTS,
  READ1_DIR, READ2_SECTIONS, RELATION_TYPES, STATUSES, THREAD_WEIGHTS, TIME_KINDS, WATCH_KINDS, expandLines, fileNameFor, isRecord, sameAsGroups, spineUnits, statusFromReviews,
} from './model.mjs';
import { READ2_PREFIXES, findItem, kindOfKey, loadOrder, loadReadLayers, partsOverlap } from './order.mjs';

/** 아크 표기("ch20-ch29" · "ch19" · "event_redash-ch30")를 척추 자리 키 둘로 — 키가 아니면 null */
export function splitArc(text, keys) {
  if (keys.has(text)) return [text, null];
  const parts = text.split('-');
  for (let i = 1; i < parts.length; i++) {
    const a = parts.slice(0, i).join('-');
    const b = parts.slice(i).join('-');
    if (keys.has(a) && keys.has(b)) return [a, b];
  }
  return null;
}
import { echoEdgesOf, scenePlaces } from './read2.mjs';
import { chronologyProblems, loadChronology, subjectOf, timeShapeProblems } from '../views/chrono.mjs';

/** 단위 요약 · 씬 한 줄 · 사실 문장이 이보다 길면 경고한다 — 인계 파일 크기 때문 */
export const LIMITS = { summary: 1500, sceneLine: 150, text: 200 };

const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const SECTION_LABEL = {
  facts: '사실', questions: '의문', events: '사건', times: '시점', candidates: '정체 연결', threads: '줄기', relations: '줄기 관계', units: '층 판정', leads: '주역', spine: '척추', majors: '주요 인물', closures: '마무리', merges: '합류',
  mentions: '암시 언급', echoes: '떡밥', changes: '인물 변화', life: '생활상', edges: '수동 엣지', affiliations: '소속',
};
/** 2회독 세션 모양 — P1 · M03 */
const READ2_SESSION = new RegExp(`^(?:${READ2_PREFIXES.join('|')})\\d+[a-z]?$`);

/**
 * @param {ReturnType<import('./model.mjs').loadDataset>} ds
 * @param {Awaited<ReturnType<import('./context.mjs').openContext>>} ctx
 * @param {{ items: object[] } | null} order 1회독 읽기 순서 (없으면 순서 검사를 건너뛴다)
 * @param {{ order2?: { items: object[] } | null }} [opts] order2: 2회독 순서(P · M) — 없으면 order가 있을 때 읽기 순서 파일에서 읽는다
 * @returns {{ errors: {file:string, id:string|null, msg:string}[], warnings: {file:string, id:string|null, msg:string}[] }}
 */
export function checkDataset(ds, ctx, order = null, { order2, readLayers } = {}) {
  if (order2 === undefined) order2 = order ? loadOrder(READ2_PREFIXES) : null;
  // 2회독에서 읽은 층(읽기 순서) — 실제 기록일 때만 견준다(예시 기록은 읽기 순서의 층과 따로 논다)
  if (readLayers === undefined) readLayers = order && path.resolve(ds.dir) === path.resolve(READ1_DIR) ? loadReadLayers() : null;
  const errors = [];
  const warnings = [];
  const err = (file, id, msg) => errors.push({ file, id: id ?? null, msg });
  const warn = (file, id, msg) => warnings.push({ file, id: id ?? null, msg });
  for (const p of ds.problems) err(p.file, null, p.msg);
  // 작중 연대기(X1b) — 시점 기록 at의 기준: 시대 기준점 · 시점 기록 · 단위 키 · 씬 ID
  const chron = loadChronology(ds.dir);
  for (const m of chron.problems) err(chron.name, null, m);
  const timeRef = {
    eras: new Set(chron.eras.map((e) => e?.id)),
    times: new Map(ds.candidates.filter((c) => c.kind === 'time' && c.id).map((c) => [c.id, c])),
    resolveKey: (k) => ctx.resolve(k),
  };

  const unknown = (obj, fields, report) => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) if (!fields.includes(k)) report(`모르는 칸 "${k}" — 오타인지 본다 (쓸 수 있는 칸: ${fields.join(' · ')})`);
  };

  /** 근거 확인. unitScenes가 있으면 그 밖의 씬은 경고. oneScene이면 씬이 하나여야 한다(2회독 기록 — 한 기록 = 한 씬) */
  function checkEvidence(ev, where, id, unitScenes, unitKey, { required = true, oneScene = false, field = 'evidence' } = {}) {
    if (ev === undefined || (Array.isArray(ev) && !ev.length)) {
      if (required) err(where, id, `근거(${field})가 없다 — [{ "scene": 씬 ID, "lines": [12, "20-25"] }] (줄 하나는 숫자, 범위만 문자열)`);
      return;
    }
    if (!Array.isArray(ev)) return err(where, id, `${field}는 배열이어야 한다`);
    if (oneScene) {
      const scenes = new Set(ev.map((e) => e?.scene));
      if (scenes.size > 1) err(where, id, `${field}의 씬이 ${scenes.size}개다 — 2회독 기록은 한 기록 = 한 씬(씬마다 따로 적는다)`);
    }
    for (const e of ev) {
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        err(where, id, `근거 ${JSON.stringify(e)}: { "scene": …, "lines": […] } 모양이어야 한다`);
        continue;
      }
      unknown(e, ['scene', 'lines'], (m) => warn(where, id, `근거 ${e.scene ?? '?'}: ${m}`));
      const st = ctx.story(e.scene);
      if (!st) {
        err(where, id, `없는 씬 ${e.scene} — read.mjs 머리말의 씬 ID(금서고는 sub:…_00 같은 씬 키)를 쓴다`);
        continue;
      }
      if (st.kind !== 'scene' && st.kind !== 'episode') err(where, id, `${e.scene}는 씬이 아니다(${st.kind})`);
      if (st.in_scope !== 1) err(where, id, `분석 범위 밖 씬 ${e.scene} — ${st.scope_note ?? ''}`);
      const { seqs, problems } = expandLines(e.lines);
      for (const p of problems) err(where, id, `근거 ${e.scene}: ${p}${/^줄 번호 "\d+"/.test(p) ? ' — 줄 하나는 숫자로(12), 범위만 문자열("20-25")' : ''}`);
      const ls = ctx.lines(e.scene);
      const bad = seqs.filter((n) => n >= ls.length);
      if (bad.length) err(where, id, `없는 줄 ${e.scene}#${bad.join(',')} — 이 씬은 #0–#${ls.length - 1}`);
      const empty = seqs.filter((n) => n < ls.length && !oneLine(ls[n].text));
      if (empty.length) warn(where, id, `본문 없는 줄 ${e.scene}#${empty.join(',')}`);
      if (unitScenes && !unitScenes.includes(e.scene)) {
        warn(where, id, `이 파일의 단위(${unitKey}) 밖 씬 ${e.scene} — 되짚어 읽기로 찾은 것이면 note에 적는다`);
      }
    }
  }

  function checkReviews(c, where) {
    const reviews = c.obj?.reviews;
    if (reviews === undefined) {
      if (STATUSES.includes(c.status) && c.status !== '후보') {
        err(where, c.id, `상태가 ${c.status}인데 검토 기록(reviews)이 없다 — 확정 · 기각은 리뷰 도구(set)로만 바꾼다`);
      }
      return;
    }
    if (!Array.isArray(reviews)) return err(where, c.id, 'reviews는 배열이어야 한다');
    reviews.forEach((r, i) => {
      const at = `검토 ${i + 1}`;
      if (!r || typeof r !== 'object') return err(where, c.id, `${at}: 객체여야 한다`);
      unknown(r, FIELDS.review, (m) => warn(where, c.id, `${at}: ${m}`));
      if (!DECISIONS.includes(r.decision)) err(where, c.id, `${at}: 결정 "${r.decision}" — ${DECISIONS.join(' · ')} 중 하나`);
      if (r.by !== 'claude') err(where, c.id, `${at}: by는 "claude"뿐이다 — 기록은 Claude가 정한다(CLAUDE.md "일하는 법")`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '')) err(where, c.id, `${at}: 날짜(date)는 YYYY-MM-DD`);
    });
    const expect = statusFromReviews(reviews);
    if (STATUSES.includes(c.status) && c.status !== expect) {
      err(where, c.id, `상태 ${c.status}가 검토 기록의 결과(${expect})와 다르다 — 상태는 리뷰 도구로 바꾼다`);
    }
  }

  function checkCommon(c, where) {
    if (!isStr(c.reason)) err(where, c.id, '이유(reason)가 없다');
    if (!CONFIDENCES.includes(c.confidence)) err(where, c.id, `확신도 "${c.confidence ?? ''}" — ${CONFIDENCES.join(' · ')} 중 하나`);
    if (!STATUSES.includes(c.status)) err(where, c.id, `상태 "${c.status ?? ''}" — ${STATUSES.join(' · ')} 중 하나`);
    if (c.by !== 'claude') err(where, c.id, '기록자(by)는 "claude"뿐이다 — 후보나 파일에 "by": "claude"');
    checkReviews(c, where);
  }

  const checkAbout = (c, where) => {
    const about = c.obj?.about;
    if (about === undefined) return;
    if (!Array.isArray(about)) return err(where, c.id, 'about은 대상 ID 배열이어야 한다');
    for (const t of about) if (!ctx.targetIds.has(t)) err(where, c.id, `없는 대상 ${t} — 사전(annotations/dictionary/)에 먼저 더한다`);
  };

  // ── 2회독 기록 (B1a) ──
  /** 2회독 기록이 가리키는 기록 ID — allow: 받는 종류(fact · question · event · thread · time) */
  let unitPosCache = null;
  const unitOrderPos = () => {
    if (!unitPosCache) {
      unitPosCache = new Map();
      for (const it of order?.items ?? []) if (!unitPosCache.has(it.key)) unitPosCache.set(it.key, unitPosCache.size + 1);
    }
    return unitPosCache;
  };
  const refRecord = (c, where, id, field, allow) => {
    const r = isStr(id) ? byId.get(id) : null;
    const kindOf = (x) => (x.role === 'event' ? 'event' : x.kind);
    if (!r || !allow.includes(kindOf(r))) {
      const label = { fact: '사실 F<n>', question: '의문 Q<n>', event: '사건 F<n>-k · Q<n>-k', thread: '줄기 J<n>', time: '시점 S<n>' };
      err(where, c.id, `${field}: 없는 기록 ${JSON.stringify(id)} — ${allow.map((a) => label[a]).join(' · ')}를 쓴다`);
      return null;
    }
    if (r.status === '기각' && c.status !== '기각') err(where, c.id, `${field}: 기각된 ${id}를 가리킨다`);
    return r;
  };
  const checkTargets = (c, where, ids, field) => {
    if (!Array.isArray(ids) || !ids.every(isStr)) return err(where, c.id, `${field}는 대상 ID 배열이어야 한다`);
    for (const t of ids) if (!ctx.targetIds.has(t)) err(where, c.id, `${field}: 없는 대상 ${t} — 사전(annotations/dictionary/)에 먼저 더한다`);
  };
  const POINT_KINDS = ['fact', 'question', 'event', 'thread'];
  let places = null;
  let recoveriesOf = null;
  let liveById = null;
  const mentionSeen = new Map(); // 대상 \t 씬 → [{ id, seqs }]
  const baselines = new Map(); // 인물 \t 측면 → 기준 ID

  function checkRead2(c, where, u) {
    const o = c.obj;
    const shape = { mention: [ID.mention, 'I<번호> (암시 언급)'], echo: [ID.echo, 'E<번호> (떡밥)'], change: [ID.change, 'D<번호> (인물 변화)'], life: [ID.life, 'U<번호> (생활상)'] }[c.kind];
    if (!shape[0].test(c.id)) err(where, c.id, `ID 모양이 틀렸다 — ${shape[1]}`);
    unknown(o, FIELDS[c.kind], (m) => warn(where, c.id, m));
    if (o.pass !== undefined && ![1, 2].includes(o.pass)) err(where, c.id, 'pass는 1(네 측면을 한 번에) · 2(측면 하나씩 다시 훑어 더함)');
    checkEvidence(o.evidence, where, c.id, u?.scenes, u?.key, { oneScene: true });
    const textOk = (field, label) => {
      if (!isStr(o[field])) err(where, c.id, `${label}(${field})이 없다`);
      else if (o[field].length > LIMITS.text) warn(where, c.id, `${field}가 ${o[field].length}자 — 한 문장(${LIMITS.text}자 안쪽)으로`);
    };
    const points = (required) => {
      if (o.points === undefined) {
        if (required) err(where, c.id, 'points(가리키는 사실 · 의문 · 사건 · 줄기 ID — 하나 이상)가 없다');
        return;
      }
      if (!Array.isArray(o.points) || !o.points.length) return err(where, c.id, 'points는 기록 ID 배열이다(F12 · Q3 · Q3-2 · J1)');
      for (const p of o.points) refRecord(c, where, p, 'points', POINT_KINDS);
    };
    if (c.kind === 'mention') {
      if (!isStr(o.target) || !ctx.targetIds.has(o.target)) err(where, c.id, `target: 없는 대상 ${o.target ?? ''} — 사전 ID(person:라피 · place:방주 …)`);
      if (o.speaker !== undefined && typeof o.speaker !== 'boolean') err(where, c.id, 'speaker는 true/false — 그 줄을 말한 사람이 이 대상이면 true(`???` 이름표의 정체)');
      if (o.speaker && isStr(o.target) && !o.target.startsWith('person:')) err(where, c.id, 'speaker: true는 인물(person:)에만');
      const ev = Array.isArray(o.evidence) ? o.evidence[0] : null;
      if (ev && ctx.story(ev.scene) && isStr(o.target)) {
        const ls = ctx.lines(ev.scene);
        const { seqs } = expandLines(ev.lines);
        if (o.speaker) {
          const narr = seqs.filter((n) => n < ls.length && ['Narration', 'Monologue'].includes(ls[n].window));
          if (narr.length) warn(where, c.id, `서술 · 독백 줄 #${narr.join(',')}에 speaker: true — 말한 줄만(대사창 이름표가 있는 줄)`);
          const known = seqs.filter((n) => n < ls.length && ls[n].speaker_target === o.target);
          if (known.length) warn(where, c.id, `#${known.join(',')}는 이름표가 이미 ${o.target}로 잇는다 — 자동(speaks, B2)이 잡는다`);
        }
        const k = `${o.target}\t${ev.scene}`;
        for (const prev of mentionSeen.get(k) ?? []) {
          if (c.status !== '기각' && seqs.some((n) => prev.seqs.includes(n))) warn(where, c.id, `${prev.id}와 같은 대상 · 같은 줄을 또 적었다`);
        }
        if (c.status !== '기각') (mentionSeen.get(k) ?? mentionSeen.set(k, []).get(k)).push({ id: c.id, seqs });
      }
    } else if (c.kind === 'echo') {
      if (!ECHO_ACTS.includes(o.act)) err(where, c.id, `act "${o.act ?? ''}" — ${ECHO_ACTS.join(' · ')} 중 하나`);
      textOk('text', '무엇을 흘렸나 · 다시 꺼냈나 한 문장');
      points(true);
      if (o.about !== undefined) checkTargets(c, where, o.about, 'about');
      // 읽는 순서 — 암시는 가리킨 것이 드러나기(회수되기) 전, 재언급은 드러난(제기된) 뒤
      if (order && ECHO_ACTS.includes(o.act) && Array.isArray(o.points)) {
        places ??= scenePlaces(order, ctx);
        if (!recoveriesOf) {
          liveById = new Map([...byId].filter(([, x]) => x.status !== '기각'));
          recoveriesOf = new Map();
          for (const x of liveById.values()) if (x.role === 'event' && x.act === '회수' && x.parent) (recoveriesOf.get(x.parent) ?? recoveriesOf.set(x.parent, []).get(x.parent)).push(x);
        }
        for (const r of echoEdgesOf(c, liveById, recoveriesOf, places)) {
          if (r.backwards) warn(where, c.id, o.act === '암시'
            ? `암시가 ${r.point}의 드러남(${r.to_scene})보다 뒤다 — 이미 드러난 것을 다시 꺼낸 것이면 재언급`
            : `재언급이 ${r.point}(${r.from_scene})보다 앞이다 — 드러나기 전에 흘린 것이면 암시`);
        }
      }
    } else if (c.kind === 'change') {
      if (!isStr(o.person) || !o.person.startsWith('person:') || !ctx.targetIds.has(o.person)) err(where, c.id, `person: 인물 대상 ID(person:라피)여야 한다 — ${o.person ?? '(없음)'}`);
      if (!ASPECTS.includes(o.aspect)) err(where, c.id, `aspect "${o.aspect ?? ''}" — ${ASPECTS.join(' · ')} 중 하나`);
      if (!CHANGE_ACTS.includes(o.act)) err(where, c.id, `act "${o.act ?? ''}" — ${CHANGE_ACTS.join(' · ')} 중 하나`);
      if (o.act === '기준') {
        textOk('text', '처음 모습 한 문장');
        for (const k of ['before', 'after', 'trigger']) if (o[k] !== undefined) warn(where, c.id, `기준에는 ${k}를 쓰지 않는다 — 바뀌었으면 변화로`);
        if (c.status !== '기각' && isStr(o.person) && isStr(o.aspect)) {
          // 관계는 상대마다 따로 — 유니 → 미하라와 유니 → 지휘관은 다른 기준이다(P1)
          const rel = o.aspect === '관계' && Array.isArray(o.with) && o.with.length ? `\t${[...o.with].sort().join(',')}` : '';
          const k = `${o.person}\t${o.aspect}${rel}`;
          if (baselines.has(k)) warn(where, c.id, `${o.person} ${o.aspect}${rel ? `(${o.with.join(' · ')})` : ''}의 기준이 또 있다 — ${baselines.get(k)}. 인물 · 측면(관계는 상대)마다 기준 하나(출시순으로 더 앞선 모습이면 그쪽을 남기고 다른 하나는 기각)`);
          else baselines.set(k, c.id);
        }
      } else if (o.act === '변화') {
        for (const [k, label] of [['before', '전'], ['after', '후']]) {
          if (!isStr(o[k])) err(where, c.id, `변화에는 ${k}(${label} — 짧은 구절)가 있어야 한다`);
          else if (o[k].length > LIMITS.text) warn(where, c.id, `${k}가 ${o[k].length}자 — 짧게`);
        }
        if (o.text !== undefined && !isStr(o.text)) err(where, c.id, 'text를 쓰면 비우지 않는다');
      }
      if (o.with !== undefined) checkTargets(c, where, o.with, 'with');
      else if (o.aspect === '관계') warn(where, c.id, '관계 변화에는 with(상대 대상 ID)를 적는다');
      if (o.trigger !== undefined) checkEvidence(o.trigger, where, c.id, null, null, { oneScene: true, field: 'trigger' });
      if (o.time !== undefined) refRecord(c, where, o.time, 'time', ['time']);
      points(false);
    } else if (c.kind === 'life') {
      if (!isStr(o.topic)) err(where, c.id, `topic(주제)이 없다 — ${LIFE_TOPICS.join(' · ')} …`);
      else if (!LIFE_TOPICS.includes(o.topic)) warn(where, c.id, `새 주제 "${o.topic}" — 늘리려면 tools/records/model.mjs LIFE_TOPICS와 docs/annotations.md에 더한다 (지금: ${LIFE_TOPICS.join(' · ')})`);
      textOk('text', '그려진 모습 한 문장');
      if (o.about !== undefined) checkTargets(c, where, o.about, 'about');
      points(false);
    }
    checkCommon(c, where);
  }

  /** 수동 엣지 (T4-3) — 끝점은 씬 ID나 읽기 단위 키, 같은 단계끼리 */
  /** 소속 기록(T) — 인물 · 조직은 사전 ID, act · 근거 씬 필수, records는 인물 변화 D · 사실 F */
  function checkAffil(c, where) {
    const o = c.obj;
    if (!ID.affil.test(c.id)) err(where, c.id, 'ID 모양이 틀렸다 — T<번호> (소속)');
    unknown(o, FIELDS.affil, (m) => warn(where, c.id, m));
    if (!isStr(o.person) || !o.person.startsWith('person:') || !ctx.targetIds.has(o.person)) err(where, c.id, `person ${JSON.stringify(o.person ?? '')} — 사전의 인물 ID(person:…)`);
    if (!isStr(o.org) || !o.org.startsWith('org:') || !ctx.targetIds.has(o.org)) err(where, c.id, `org ${JSON.stringify(o.org ?? '')} — 사전의 조직 ID(org:…, annotations/dictionary/orgs.json에 먼저 더한다)`);
    if (!AFFIL_ACTS.includes(o.act)) err(where, c.id, `act "${o.act ?? ''}" — ${AFFIL_ACTS.join(' · ')} 중 하나`);
    if (o.role !== undefined && (!isStr(o.role) || o.role.length > 30)) err(where, c.id, 'role은 조직 안 자리를 짧게(30자 안쪽) — 없으면 칸을 지운다');
    if (o.records !== undefined) {
      if (!Array.isArray(o.records) || !o.records.length) err(where, c.id, 'records는 근거 기록 ID 배열(D · F)');
      else for (const id of o.records) {
        const r = isStr(id) ? byId.get(id) : null;
        if (!r || !(r.kind === 'change' || (r.kind === 'fact' && r.role !== 'event'))) err(where, c.id, `records: 없는 기록 ${JSON.stringify(id)} — 인물 변화 D<n> · 사실 F<n>`);
        else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `records: 기각된 ${id}를 가리킨다`);
        else if (r.kind === 'change' && isStr(o.person) && r.obj?.person !== o.person) warn(where, c.id, `records: ${id}는 ${r.obj?.person}의 변화다(이 기록은 ${o.person})`);
      }
    }
    checkEvidence(o.evidence, where, c.id, null, null);
    checkCommon(c, where);
  }

  function checkEdge(c, where) {
    const o = c.obj;
    if (!ID.edge.test(c.id)) err(where, c.id, 'ID 모양이 틀렸다 — Y<번호> (수동 엣지)');
    unknown(o, FIELDS.edge, (m) => warn(where, c.id, m));
    if (!EDGE_TYPES.includes(o.type)) err(where, c.id, `type "${o.type ?? ''}" — ${EDGE_TYPES.join(' · ')} 중 하나 (docs/schema.md "엣지 타입")`);
    const level = {};
    for (const side of ['from', 'to']) {
      const r = isStr(o[side]) ? ctx.resolve(o[side]) : null;
      if (!r) err(where, c.id, `${side}: 모르는 ${o[side] ?? '(없음)'} — 씬 ID나 읽기 단위 키(read.mjs 키)`);
      else {
        level[side] = r.type;
        if (!r.inScope) warn(where, c.id, `${side}: 분석 범위 밖 ${o[side]}`);
      }
    }
    if (level.from && level.to && level.from !== level.to) warn(where, c.id, `from은 ${level.from === 'scene' ? '씬' : '단위'}, to는 ${level.to === 'scene' ? '씬' : '단위'}다 — 같은 단계끼리 잇는다(병합은 같은 끝점끼리 비교한다)`);
    if (isStr(o.from) && o.from === o.to) err(where, c.id, 'from과 to가 같다');
    if (o.strength !== undefined && ![1, 2, 3].includes(o.strength)) err(where, c.id, 'strength는 1 · 2 · 3');
    if (o.drop !== undefined && typeof o.drop !== 'boolean') err(where, c.id, 'drop은 true/false — true면 같은 (from, to, type)의 자동 엣지를 지운다');
    if (o.records !== undefined) {
      if (!Array.isArray(o.records) || !o.records.length) err(where, c.id, 'records는 근거 기록 ID 배열');
      else for (const id of o.records) refRecord(c, where, id, 'records', ['fact', 'question', 'event', 'thread', 'time']);
    }
    // 방향은 읽는 순서다(X2) — 단위끼리 이을 때 뒤에서 앞으로 가면 알린다
    if (order && level.from === 'unit' && level.to === 'unit') {
      const pos = unitOrderPos();
      if (pos.has(o.from) && pos.has(o.to) && pos.get(o.from) > pos.get(o.to)) warn(where, c.id, `읽는 순서를 거슬러 간다(${o.from} ${pos.get(o.from)} → ${o.to} ${pos.get(o.to)}) — from이 먼저 읽는 단위다`);
    }
    checkEvidence(o.evidence, where, c.id, null, null, { required: false });
    checkCommon(c, where);
  }

  // ── 파일 ──
  const fileUnit = new Map(); // 파일 이름 → { key, scenes }
  for (const f of ds.files) {
    const d = f.data;
    if (!d) continue;
    unknown(d, FIELDS.file, (m) => warn(f.name, null, m));
    // 설정 오류 추정 — 원문끼리 어긋나 제작 쪽 실수로 보이는 곳. 한 줄 메모만 (docs/annotations.md "설정 오류")
    if (d.slips !== undefined) {
      if (!Array.isArray(d.slips) || !d.slips.every(isStr)) err(f.name, null, 'slips는 문장 배열이다 — ["F12와 어긋남: … (d_main_20_03 #41)"]');
      else for (const x of d.slips) if (x.length > 300) warn(f.name, null, `slips 한 줄이 ${x.length}자 — 300자 안쪽으로`);
    }
    let scenes = null;
    if (!isStr(d.unit)) err(f.name, null, '필수 칸 unit(읽기 단위 키 — ch00 · sub:칠리페퍼_00 · event_… 등)이 없다');
    else {
      const r = ctx.resolve(d.unit);
      if (!r) err(f.name, null, `없는 단위 · 씬 키 ${d.unit} — read.mjs 키를 쓴다`);
      else {
        scenes = r.scenes;
        if (!r.inScope) err(f.name, null, `분석 범위 밖 단위 ${d.unit}`);
      }
      const want = fileNameFor(d.unit, d.parts ?? null);
      if (f.name !== want) err(f.name, null, `파일 이름은 ${want}여야 한다 (unit · parts에서 정해진다)`);
    }
    if (d.parts !== undefined && d.parts !== null && !/^\d+-\d+$/.test(String(d.parts))) err(f.name, null, `parts "${d.parts}" — "4-6"처럼 쓴다`);
    if (!isStr(d.session)) err(f.name, null, '필수 칸 session(순서 항목 — R01 · RE32 …)이 없다');
    else if (!/^[A-Z]+\d+[a-z]?$/.test(d.session)) err(f.name, null, `session "${d.session}" — R01 · RE32처럼 쓴다`);
    else if (order && isStr(d.unit)) {
      const item = findItem(order, d.unit, d.parts ?? null);
      if (!item) warn(f.name, null, `읽기 순서에 없는 단위${d.parts ? `(파트 ${d.parts})` : ''} — 순서 밖 기록이면 괜찮다`);
      else if (item.session !== d.session) warn(f.name, null, `읽기 순서에서는 ${item.session} 항목의 단위다 (파일은 ${d.session})`);
    }
    if (d.by !== 'claude') err(f.name, null, '필수 칸 by(기록자)는 "claude"뿐이다');
    if (d.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '')) err(f.name, null, 'date는 YYYY-MM-DD');
    if (!isStr(d.summary)) err(f.name, null, '필수 칸 summary(단위 요약 — 작업 메모)가 비었다');
    else if (d.summary.length > LIMITS.summary) warn(f.name, null, `summary가 ${d.summary.length}자 — ${LIMITS.summary}자 안쪽으로 줄인다(인계 파일 크기)`);
    for (const sec of ['facts', 'questions', 'events', 'times', 'targets', 'scenes', 'revisit', 'revisitDone']) {
      if (d[sec] !== undefined && !Array.isArray(d[sec])) err(f.name, null, `${sec}는 배열이어야 한다`);
    }
    fileUnit.set(f.name, { key: d.unit, scenes });
  }

  // ── 2회독 파일 ──
  const read1Units = new Set(ds.files.map((f) => f.data?.unit).filter(Boolean));
  for (const f of ds.files2 ?? []) {
    const d = f.data;
    if (!d) continue;
    unknown(d, FIELDS.file2, (m) => warn(f.name, null, m));
    const read1Secs = ['summary', 'scenes', 'facts', 'questions', 'events', 'times', 'targets'].filter((k) => d[k] !== undefined);
    if (read1Secs.length) {
      err(f.name, null, `2회독 파일에 1회독 칸(${read1Secs.join(' · ')})이 있다 — 1회독 바로잡기는 그 단위의 1회독 파일(annotations/read1/)에 항목마다 "session"을 달아 적는다`);
    }
    if (d.slips !== undefined && (!Array.isArray(d.slips) || !d.slips.every(isStr))) err(f.name, null, 'slips는 문장 배열이다');
    let scenes = null;
    if (!isStr(d.unit)) err(f.name, null, '필수 칸 unit(읽기 단위 키)이 없다');
    else {
      const r = ctx.resolve(d.unit);
      if (!r) err(f.name, null, `없는 단위 · 씬 키 ${d.unit} — read.mjs 키를 쓴다`);
      else {
        scenes = r.scenes;
        if (!r.inScope) err(f.name, null, `분석 범위 밖 단위 ${d.unit}`);
      }
      const want = fileNameFor(d.unit, d.parts ?? null);
      if (f.base !== want) err(f.name, null, `파일 이름은 ${want}여야 한다 (unit · parts에서 정해진다)`);
      if (!read1Units.has(d.unit) && ds.files.length) warn(f.name, null, `1회독 기록이 없는 단위 ${d.unit} — 2회독은 1회독 기록을 들고 읽는다`);
    }
    if (d.parts !== undefined && d.parts !== null && !/^\d+-\d+$/.test(String(d.parts))) err(f.name, null, `parts "${d.parts}" — "7-12"처럼 쓴다`);
    if (!isStr(d.session)) err(f.name, null, '필수 칸 session(2회독 순서 항목 — P1 · M03 …)이 없다');
    else if (!READ2_SESSION.test(d.session)) err(f.name, null, `session "${d.session}" — 2회독 세션(P1 · M03 …)을 쓴다`);
    else if (order2 && isStr(d.unit)) {
      const item = findItem(order2, d.unit, d.parts ?? null);
      if (!item) warn(f.name, null, `2회독 읽기 순서에 없는 단위${d.parts ? `(파트 ${d.parts})` : ''} — 순서 밖 기록이면 괜찮다`);
      else if (item.session !== d.session) warn(f.name, null, `읽기 순서에서는 ${item.session} 항목의 단위다 (파일은 ${d.session})`);
    }
    if (d.by !== 'claude') err(f.name, null, '필수 칸 by(기록자)는 "claude"뿐이다');
    if (d.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '')) err(f.name, null, 'date는 YYYY-MM-DD');
    for (const sec of [...Object.keys(READ2_SECTIONS), 'revisit', 'revisitDone']) if (d[sec] !== undefined && !Array.isArray(d[sec])) err(f.name, null, `${sec}는 배열이어야 한다`);
    fileUnit.set(f.name, { key: d.unit, scenes });
  }

  // ── 씬 한 줄 요약 ──
  for (const s of ds.scenes) {
    const o = s.obj;
    const u = fileUnit.get(s.file);
    unknown(o, FIELDS.scene, (m) => warn(s.file, null, `scenes ${s.index + 1}: ${m}`));
    if (!o || !isStr(o.scene)) {
      err(s.file, null, `scenes ${s.index + 1}: scene(씬 ID)이 없다`);
      continue;
    }
    if (u?.scenes && !u.scenes.includes(o.scene)) err(s.file, null, `scenes: ${o.scene}는 이 단위(${u.key})의 씬이 아니다`);
    if (!isStr(o.text)) err(s.file, null, `scenes: ${o.scene}의 한 줄 요약(text)이 비었다`);
    else if (o.text.length > LIMITS.sceneLine) warn(s.file, null, `scenes: ${o.scene} 요약이 ${o.text.length}자 — 한 줄(${LIMITS.sceneLine}자 안쪽)로`);
  }

  // ── 후보 ──
  const seen = new Map();
  const byId = new Map();
  for (const c of ds.candidates) {
    const where = c.file;
    const label = SECTION_LABEL[c.section] ?? c.section;
    if (!c.obj || typeof c.obj !== 'object') {
      err(where, null, `${label} ${c.index + 1}번째가 객체가 아니다`);
      continue;
    }
    if (!isStr(c.id)) {
      err(where, null, `${label} ${c.index + 1}번째: id가 없다${c.people ? ' — people.json 후보에도 id(L<n>)를 붙인다' : ''}`);
      continue;
    }
    if (seen.has(c.id)) err(where, c.id, `ID가 겹친다 — ${seen.get(c.id)}에도 있다`);
    else seen.set(c.id, where);
    byId.set(c.id, c);
  }
  const arr = (x) => (Array.isArray(x) ? x : []);
  // 메인 자리(X3f) — 메인 챕터 키 · 읽는 순서의 자리, 주역 명단(기각 빼고 인물 → Z)
  const mainKeys = new Set((order?.items ?? []).filter((it) => kindOfKey(it.key) === '메인').map((it) => it.key));
  // 척추 자리(X3f-1c) — 메인 챕터 + annotations/spine.json 확정 단위. 판정 K의 from · 주역 Z의 from · arcs에 쓸 수 있다
  const spineOnly = spineUnits(ds);
  const spineKeys = new Set([...mainKeys, ...spineOnly]);
  const spineSeen = new Map();
  // 주역 명단의 줄기 주인 · 카운터스(X3f-1c) — 주역 = 뼈대 줄기의 주인 + 카운터스 · 지휘관
  const leadsData = ds.leads?.data && typeof ds.leads.data === 'object' ? ds.leads.data : null;
  const ownerOf = new Map();
  for (const t of arr(leadsData?.threads)) for (const p of arr(t?.owners)) (ownerOf.get(p) ?? ownerOf.set(p, []).get(p)).push(t.thread);
  const counters = new Set(arr(leadsData?.counters));
  const leadPool = new Set([...ownerOf.keys(), ...counters]);
  const orderPos = new Map();
  for (const it of order?.items ?? []) if (!orderPos.has(it.key)) orderPos.set(it.key, orderPos.size);
  const orderAt = (k) => orderPos.get(k) ?? Infinity;
  const judgedOf = new Map(ds.candidates.filter((c) => c.kind === 'layer' && c.status !== '기각' && isStr(c.obj?.unit)).map((c) => [c.obj.unit, c]));
  const leadPersons = new Map();
  // 주요 인물(X3g-1b) — 같은 인물 묶음(확정 정체 연결)마다 항목 하나
  const sameGroups = sameAsGroups(ds);
  const majorSeen = new Map();
  const closureChains = new Map();
  const mergedIn = new Map();

  for (const c of ds.candidates) {
    if (!c.obj || typeof c.obj !== 'object' || !isStr(c.id)) continue;
    const where = c.file;
    const o = c.obj;
    const u = fileUnit.get(c.file);
    const idOk = (re, shape) => {
      if (!re.test(c.id)) err(where, c.id, `ID 모양이 틀렸다 — ${shape}`);
    };
    if (isRecord(c) && (o.act === '암시' || o.kind === '암시')) err(where, c.id, '암시는 2회독 몫이다(결정 #8) — 1회독 파일에는 드러냄 · 뒤집음 · 제기 · 회수만 적는다. 암시는 2회독 파일 echoes(E)에');
    // 2회독 바로잡기로 1회독 파일에 더한 항목 — 자기 session은 그 단위를 읽는 2회독 세션이다
    if (isRecord(c) && o.session !== undefined) {
      if (!isStr(o.session) || !READ2_SESSION.test(o.session)) err(where, c.id, `session "${o.session}" — 항목의 session은 2회독 바로잡기에만, 2회독 세션(P1 · M03 …)을 쓴다`);
      else if (order2 && u?.key) {
        // 2회독은 파트를 1회독과 다르게 묶기도 한다(1회독 7–9 · 10–12 → 2회독 7–12) — 1회독 파트의 첫 파트를 품은 2회독 항목
        const parts = ds.files.find((f) => f.name === c.file)?.data?.parts ?? null;
        const start = parts ? Number(String(parts).split('-')[0]) : null;
        const within = (x) => {
          if (start === null || !x.parts) return start === null && !x.parts;
          const [a, b] = x.parts.split('-').map(Number);
          return start >= a && start <= b;
        };
        const it = order2.items.find((x) => x.key === u.key && within(x)) ?? order2.items.find((x) => x.key === u.key);
        if (it && it.session !== o.session) warn(where, c.id, `바로잡기 session ${o.session} — 이 단위는 2회독 ${it.session} 항목에서 읽는다`);
      }
    }

    if (c.section === 'facts' || c.section === 'questions') {
      const isFact = c.section === 'facts';
      idOk(isFact ? /^F\d+$/ : /^Q\d+$/, isFact ? 'F<번호> (사실)' : 'Q<번호> (의문)');
      unknown(o, isFact ? FIELDS.fact : FIELDS.question, (m) => warn(where, c.id, m));
      if (o.act !== undefined && o.act !== '암시') err(where, c.id, `정의에는 act를 쓰지 않는다 — ${isFact ? '처음 드러냄' : '제기'}으로 본다. 뒤 기록은 events에 ${c.id}-2처럼`);
      if (!isStr(c.text)) err(where, c.id, `${isFact ? '사실' : '의문'} 문장(text)이 없다`);
      else if (c.text.length > LIMITS.text) warn(where, c.id, `text가 ${c.text.length}자 — 한 문장(${LIMITS.text}자 안쪽)으로`);
      checkEvidence(o.evidence, where, c.id, u?.scenes, u?.key);
      checkAbout(c, where);
      checkCommon(c, where);
    } else if (c.section === 'events') {
      const m = c.id.match(ID.event);
      if (!m) {
        err(where, c.id, 'ID 모양이 틀렸다 — 사건은 <사실 · 의문 ID>-<번호> (F12-2 · Q3-2), 번호는 2부터');
        continue;
      }
      if (Number(m[3]) < 2) err(where, c.id, '사건 번호는 2부터다 — 1은 정의(처음 드러냄 · 제기)다');
      const isFact = m[1] === 'F';
      const refFact = (id, field) => {
        const f = byId.get(id);
        if (!f || f.section !== 'facts') err(where, c.id, `${field}: 없는 사실 ${id}`);
        else if (f.status === '기각' && c.status !== '기각') err(where, c.id, `${field}: 기각된 사실 ${id}를 가리킨다`);
      };
      unknown(o, isFact ? FIELDS.factEvent : FIELDS.questionEvent, (msg) => warn(where, c.id, msg));
      const acts = isFact ? FACT_ACTS : QUESTION_ACTS;
      if (o.act !== '암시' && !acts.includes(o.act)) err(where, c.id, `act "${o.act ?? ''}" — ${isFact ? '사실' : '의문'}의 사건은 ${acts.join(' · ')}`);
      const parent = byId.get(c.parent);
      if (!parent || (parent.section !== 'facts' && parent.section !== 'questions')) {
        err(where, c.id, `없는 ${isFact ? '사실' : '의문'} ${c.parent}를 가리킨다 — 먼저 정의(${c.parent})가 있어야 한다`);
      } else if (parent.status === '기각' && c.status !== '기각') {
        err(where, c.id, `기각된 ${c.parent}를 가리킨다 — 이 기록도 기각하거나 ${isFact ? '다른 사실로' : '다른 의문으로'} 옮긴다`);
      }
      if (isFact) {
        if (o.replacedBy !== undefined) {
          if (o.act !== '뒤집음') err(where, c.id, 'replacedBy는 뒤집음에만 쓴다');
          refFact(o.replacedBy, 'replacedBy');
        }
      } else {
        if (!isStr(o.answer)) err(where, c.id, '회수에는 answer(답이 된 사실 ID)가 있어야 한다');
        else refFact(o.answer, 'answer');
        if (!DEGREES.includes(o.degree)) err(where, c.id, `degree "${o.degree ?? ''}" — ${DEGREES.join(' · ')} 중 하나`);
      }
      if (o.text !== undefined && !isStr(o.text)) err(where, c.id, 'text를 쓰면 비우지 않는다');
      checkEvidence(o.evidence, where, c.id, u?.scenes, u?.key);
      checkCommon(c, where);
    } else if (c.section === 'times') {
      idOk(/^S\d+$/, 'S<번호> (작중 시점)');
      unknown(o, FIELDS.time, (m) => warn(where, c.id, m));
      if (!TIME_KINDS.includes(o.kind)) err(where, c.id, `kind "${o.kind ?? ''}" — ${TIME_KINDS.join(' · ')} 중 하나`);
      if (!isStr(c.text)) err(where, c.id, '시점 문장(text)이 없다 — "CH.20 직후", "70년 전 회상" 같은 것');
      if (o.ref !== undefined) {
        const refs = Array.isArray(o.ref) ? o.ref : [o.ref];
        for (const r of refs) {
          if (!isStr(r)) {
            err(where, c.id, 'ref는 단위 키 · 씬 ID · 대상 ID · 후보 ID(문자열이나 그 배열)');
            continue;
          }
          const cand = byId.get(r);
          if (cand) {
            if (cand.status === '기각' && c.status !== '기각') err(where, c.id, `ref: 기각된 ${r}를 가리킨다`);
          } else if (!ctx.resolve(r) && !ctx.targetIds.has(r)) err(where, c.id, `ref: 모르는 ${r} — 단위 키 · 씬 ID · 대상 ID · 후보 ID`);
        }
      }
      for (const m of timeShapeProblems({ ...o, status: c.status }, timeRef)) err(where, c.id, m);
      if (o.at === undefined && c.status !== '기각') {
        warn(where, c.id, 'at이 없다 — 관계 · 기준으로 구조화해야 작중 연대기(X1)에 들어간다(docs/annotations.md "작중 연대기"). 관계가 없으면 []');
      } else if (subjectOf(o) === '단위' && Array.isArray(o.at) && o.at.some((r) => Array.isArray(r) && r[1] === c.unit)) {
        err(where, c.id, `at: 자기 단위(${c.unit})를 기준으로 삼았다 — 단위 안 다른 때를 말하면 subject를 구간으로`);
      }
      checkEvidence(o.evidence, where, c.id, u?.scenes, u?.key);
      checkCommon(c, where);
    } else if (c.read2) {
      checkRead2(c, where, u);
    } else if (c.section === 'edges') {
      checkEdge(c, where);
    } else if (c.section === 'affiliations') {
      checkAffil(c, where);
    } else if (c.section === 'candidates') {
      idOk(ID.link, 'L<번호> (정체 연결)');
      unknown(o, FIELDS.link, (m) => warn(where, c.id, m));
      checkEvidence(o.evidence, where, c.id, null, null, { required: false });
      checkCommon(c, where);
    } else if (c.section === 'threads') {
      idOk(ID.thread, 'J<번호> (떡밥 줄기)');
      unknown(o, FIELDS.thread, (m) => warn(where, c.id, m));
      if (!isStr(o.title)) err(where, c.id, '줄기 이름(title)이 없다 — 짧은 이름 하나');
      if (!isStr(o.text)) err(where, c.id, '줄기 문장(text)이 없다 — 이 줄기가 다루는 수수께끼 한 문장');
      else if (o.text.length > LIMITS.text) warn(where, c.id, `text가 ${o.text.length}자 — 한 문장(${LIMITS.text}자 안쪽)으로`);
      if (!THREAD_WEIGHTS.includes(o.weight)) err(where, c.id, `weight "${o.weight ?? ''}" — ${THREAD_WEIGHTS.join(' · ')} 중 하나`);
      for (const sec of ['questions', 'facts']) {
        if (o[sec] !== undefined && !(Array.isArray(o[sec]) && o[sec].every(isStr))) err(where, c.id, `${sec}는 ID 문자열 배열이어야 한다`);
      }
      if (!Array.isArray(o.questions) || !o.questions.length) {
        if (!Array.isArray(o.facts) || !o.facts.length) err(where, c.id, '줄기에 든 의문(questions)도 사실(facts)도 없다');
      }
      const refMember = (id, want, label) => {
        const r = byId.get(id);
        if (!r || r.section !== want) err(where, c.id, `${label}: 없는 ${want === 'questions' ? '의문' : '사실'} ${id} — 정의 ID(Q<n> · F<n>)를 쓴다`);
        else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `${label}: 기각된 ${id}를 가리킨다 — 빼거나 줄기도 기각한다`);
      };
      for (const q of Array.isArray(o.questions) ? o.questions : []) if (isStr(q)) refMember(q, 'questions', 'questions');
      for (const f of Array.isArray(o.facts) ? o.facts : []) if (isStr(f)) refMember(f, 'facts', 'facts');
      checkAbout(c, where);
      checkCommon(c, where);
    } else if (c.section === 'relations') {
      idOk(ID.relation, 'G<번호> (줄기 관계)');
      unknown(o, FIELDS.relation, (m) => warn(where, c.id, m));
      if (!RELATION_TYPES.includes(o.type)) err(where, c.id, `type "${o.type ?? ''}" — ${RELATION_TYPES.join(' · ')} 중 하나`);
      for (const side of ['a', 'b']) {
        const t = byId.get(o[side]);
        if (!isStr(o[side]) || !t || t.section !== 'threads') err(where, c.id, `${side}: 없는 줄기 ${o[side] ?? ''} — J<번호>`);
        else if (t.status === '기각' && c.status !== '기각') err(where, c.id, `${side}: 기각된 줄기 ${o[side]}를 가리킨다`);
      }
      if (isStr(o.a) && o.a === o.b) err(where, c.id, 'a와 b가 같은 줄기다');
      if (o.text !== undefined && !isStr(o.text)) err(where, c.id, 'text를 쓰면 비우지 않는다');
      if (!Array.isArray(o.evidence) || !o.evidence.length) err(where, c.id, '근거(evidence)가 없다 — 관계를 보여 주는 기록 ID 배열(F12 · Q3-2 …)');
      else {
        for (const id of o.evidence) {
          const r = isStr(id) ? byId.get(id) : null;
          if (!r || r.people || r.threads || r.layers) err(where, c.id, `근거 ${JSON.stringify(id)}: 없는 기록 — 사실 · 의문 · 사건 ID를 쓴다`);
          else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `근거: 기각된 ${id}를 가리킨다`);
        }
      }
      checkCommon(c, where);
    } else if (c.section === 'units') {
      idOk(ID.layer, 'K<번호> (층 판정)');
      unknown(o, FIELDS.layer, (m) => warn(where, c.id, m));
      if (!isStr(o.unit)) err(where, c.id, '판정하는 단위(unit)가 없다 — 읽기 단위 키');
      else if (order && !order.items.some((it) => it.key === o.unit)) err(where, c.id, `unit: 읽기 순서에 없는 단위 ${o.unit}`);
      else if (layerKind(o.unit) === '메인') err(where, c.id, `unit: 메인(${o.unit})은 채점하지 않는다 — 늘 1층`);
      if (!GRADES.includes(o.grade)) err(where, c.id, `grade "${o.grade ?? ''}" — ${GRADES.join(' · ')} 중 하나`);
      if (o.basis === undefined || o.basis === null) {
        if (o.grade !== '독립') err(where, c.id, `${o.grade} 판정에는 근거 한 건(basis — 기록 ID나 줄기 ID)이 있어야 한다`);
      } else if (!isStr(o.basis)) err(where, c.id, 'basis는 기록 ID나 줄기 ID 문자열 하나');
      else {
        const r = byId.get(o.basis);
        if (!r || r.people || r.layers || r.kind === 'relation' || r.kind === 'time') err(where, c.id, `basis: 없는 기록 ${o.basis} — 사실 · 의문 · 사건 · 줄기 ID를 쓴다`);
        else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `basis: 기각된 ${o.basis}를 가리킨다`);
        else if (!r.threads && isStr(o.unit) && r.unit !== o.unit) warn(where, c.id, `basis ${o.basis}는 ${r.unit ?? '?'}의 기록이다 — 판정하는 단위(${o.unit})의 기록을 든다`);
        // 감정 기준(X3g — docs/importance.md 3절 "결정적 순간"): 감정으로 오른 판정의 근거는 그 결정적 순간의 인물 변화 D(마무리 O면 그 닫는 기록 D)
        else if (/^감정 —/.test(c.reason ?? '') && r.kind !== 'change') warn(where, c.id, `감정으로 오른 판정(reason "감정 — …")의 basis ${o.basis}는 인물 변화 D가 아니다 — 결정적 순간의 D(마무리 O면 닫는 기록 D)를 든다`);
      }
      // 기준 시점(X3a) — 판정이 반영한 스토리의 마지막 공개일
      if (o.asof !== undefined && !(isStr(o.asof) && /^\d{4}-\d{2}-\d{2}$/.test(o.asof))) err(where, c.id, `asof ${JSON.stringify(o.asof)} — YYYY-MM-DD(판정이 반영한 스토리의 마지막 공개일)`);
      else if (o.asof === undefined && c.status === '확정') warn(where, c.id, '확정 판정에 기준 시점(asof)이 없다 — set … --asof YYYY-MM-DD');
      if (o.layer !== undefined) {
        if (!LAYERS.includes(o.layer)) err(where, c.id, `layer ${JSON.stringify(o.layer)} — ${LAYERS.join(' · ')} 중 하나(규칙과 다른 층으로 뒤집을 때만 쓴다)`);
        else if (!isStr(o.note)) warn(where, c.id, 'layer로 규칙 층을 뒤집으면 note에 까닭을 적는다');
      }
      // 메인 자리(X3f ⑤) — from: 메인이 이 단위를 딛기 시작하는 챕터, before: 그 앞 자리의 등급(더 가볍다)
      if (o.from !== undefined || o.before !== undefined) {
        if (!FROM_GRADES.includes(o.grade)) err(where, c.id, `from · before는 ${FROM_GRADES.join(' · ')} 판정에만 — ${o.grade}에는 지운다(set ${c.id} 확정 --from "" --before "")`);
        if (o.from !== undefined && !(isStr(o.from) && spineKeys.has(o.from))) err(where, c.id, `from ${JSON.stringify(o.from)} — 메인 챕터 키(ch38)나 척추 이벤트 · 사이드 키(annotations/spine.json 확정)`);
        if (o.before !== undefined && !GRADES.includes(o.before)) err(where, c.id, `before ${JSON.stringify(o.before)} — ${GRADES.join(' · ')} 중 하나`);
        else if (o.before !== undefined && GRADES.indexOf(o.before) <= GRADES.indexOf(o.grade)) err(where, c.id, `before ${o.before}는 등급 ${o.grade}보다 가벼워야 한다(그 앞 자리의 등급)`);
        if (o.before !== undefined && o.from === undefined) err(where, c.id, 'before만 있고 from이 없다 — 메인이 이 단위를 딛기 시작하는 챕터(--from)를 같이 적는다');
        else if (o.from !== undefined && o.before === undefined && order && spineKeys.has(o.from) && isStr(o.unit) && orderAt(o.from) > orderAt(o.unit)) {
          warn(where, c.id, `from ${o.from}가 단위(${o.unit})보다 뒤인데 그 앞 자리의 등급(before)이 없다 — --before 참고|독립`);
        }
      } else if (FROM_GRADES.includes(o.grade) && c.status === '확정' && !spineOnly.has(o.unit) && arr(o.reviews).some((r) => /^(X3f|N3)/.test(r?.session ?? ''))) {
        warn(where, c.id, `${o.grade} 판정에 메인 자리(from)가 없다 — 메인이 이 단위를 딛기 시작하는 챕터(--from ch38)와 그 앞 등급(--before)을 적는다(X3f ⑤)`);
      }
      checkCommon(c, where);
    } else if (c.section === 'leads') {
      idOk(ID.lead, 'Z<번호> (주역)');
      unknown(o, FIELDS.lead, (m) => warn(where, c.id, m));
      if (!isStr(o.person) || !String(o.person).startsWith('person:') || !ctx.targetIds.has(o.person)) err(where, c.id, `person ${JSON.stringify(o.person ?? '')} — 사전의 인물 ID(person:…)`);
      else if (c.status !== '기각') {
        if (leadPersons.has(o.person)) err(where, c.id, `${o.person}의 주역 항목이 둘이다 — ${leadPersons.get(o.person)}에도 있다(틀린 것은 기각)`);
        else leadPersons.set(o.person, c.id);
      }
      if (!(isStr(o.from) && spineKeys.has(o.from))) err(where, c.id, `from ${JSON.stringify(o.from ?? '')} — 주역이 되는 척추 자리(메인 챕터 ch19나 척추 이벤트 · 사이드 키)`);
      // 새 기준(X3f-1c): 주역은 뼈대 줄기의 주인(leads.json threads[].owners)과 카운터스(counters)뿐 — 손으로 넣지 않는다
      if (c.status !== '기각' && leadsData && (ownerOf.size || counters.size) && isStr(o.person) && !leadPool.has(o.person)) {
        err(where, c.id, `${o.person}은 뼈대 줄기의 주인도 카운터스도 아니다 — 주역은 leads.json threads[].owners · counters뿐(주인을 바꾸려면 그 줄기의 owners를 고친다)`);
      }
      if (o.arcs !== undefined) {
        if (!Array.isArray(o.arcs) || !o.arcs.length) err(where, c.id, 'arcs는 아크 범위 배열(["ch20-ch29"]) — 메인 전체면 칸을 지운다');
        else {
          for (const a of o.arcs) {
            const m = splitArc(String(a), spineKeys);
            if (!m) err(where, c.id, `arcs ${JSON.stringify(a)} — "ch20-ch29" · "ch19" · "event_redash-ch30"처럼 척추 자리 키로`);
            else if (m[1] && orderAt(m[1]) < orderAt(m[0])) err(where, c.id, `arcs ${a}: 앞이 뒤보다 늦다`);
          }
          const first = splitArc(String(o.arcs[0]), spineKeys)?.[0];
          if (isStr(o.from) && first && spineKeys.has(o.from) && orderAt(first) < orderAt(o.from)) warn(where, c.id, `첫 아크(${o.arcs[0]})가 주역이 되는 자리(${o.from})보다 앞이다`);
        }
      }
      // 원점(X3f ①) — 메인 밖 읽기 단위 하나, 메인 밖에 없으면 "메인". 그 단위의 판정은 필수, 메인 자리는 주역이 되는 챕터부터
      if (o.origin !== undefined) {
        const j = judgedOf.get(o.origin);
        if (o.origin === '메인') { /* 메인 밖 원점 없음 */ } else if (!isStr(o.origin) || !orderPos.has(o.origin) || mainKeys.has(o.origin)) {
          err(where, c.id, `origin ${JSON.stringify(o.origin)} — 메인 밖 읽기 단위 키(원점 단위)나 "메인"(메인 밖 원점 없음)`);
        } else if (spineOnly.has(o.origin)) { /* 원점이 척추 이벤트 · 사이드 안 — "메인"과 같은 뜻, 따로 필수 판정은 없다(카드 3절 2) */ } else if (!j) err(where, c.id, `origin ${o.origin}에 판정(K)이 없다`);
        else if (c.status !== '기각') {
          if (j.obj?.grade !== '필수') warn(where, c.id, `원점 ${o.origin}(${j.id})이 ${j.obj?.grade} — 주역 조항의 원점은 필수(set ${j.id} 확정 --grade 필수 --from ${o.from ?? 'ch…'})`);
          else if (spineKeys.has(o.from) && spineKeys.has(j.obj?.from) && orderAt(j.obj.from) < orderAt(o.from)) {
            warn(where, c.id, `원점 ${o.origin}(${j.id})의 메인 자리 ${j.obj.from}가 주역이 되는 챕터(${o.from})보다 앞이다 — 주역 조항은 주역이 된 뒤부터`);
          }
        }
      }
      for (const id of arr(o.records)) {
        const r = byId.get(id);
        if (!r || r.people || r.layers || r.leads || r.kind === 'relation') err(where, c.id, `records: 없는 기록 ${id} — 줄기 · 사실 · 의문 · 사건 · 인물 변화 ID`);
        else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `records: 기각된 ${id}를 가리킨다`);
      }
      if (!isStr(c.reason)) err(where, c.id, '이유(reason)가 없다 — 메인 챕터별 근거(말한 줄 · 이름이 나온 씬 · 뼈대 줄기 · 인물 변화)와 주역으로 본 까닭');
      checkCommon(c, where);
    } else if (c.section === 'spine') {
      // 척추(X3f-1b · 1c) — 문 안 단위마다 하나: 확정 = 척추, 기각 = 문 안이지만 미달
      idOk(ID.spine, 'B<번호> (척추)');
      unknown(o, FIELDS.spine, (m) => warn(where, c.id, m));
      if (!isStr(o.unit)) err(where, c.id, '척추 단위(unit)가 없다 — 읽기 단위 키');
      else if (order && !orderPos.has(o.unit)) err(where, c.id, `unit: 읽기 순서에 없는 단위 ${o.unit}`);
      else if (!['이벤트', '사이드'].includes(kindOfKey(o.unit)) || String(o.unit).startsWith('erelic:')) err(where, c.id, `unit ${o.unit}: 척추는 이벤트 · 사이드만(메인은 늘 척추, 이벤트 유실물 · 연작의 다른 편은 판정 단위 — docs/importance.md 1절)`);
      else if (c.status !== '기각') {
        if (spineSeen.has(o.unit)) err(where, c.id, `${o.unit}의 척추 항목이 둘이다 — ${spineSeen.get(o.unit)}에도 있다`);
        else spineSeen.set(o.unit, c.id);
      }
      if (!isStr(o.gate)) err(where, c.id, '문(gate)이 없다 — 공지가 소개한 말(1주년 · 신년 …)이나 "사이드"');
      if (o.notice !== undefined && !isStr(o.notice)) err(where, c.id, 'notice는 공지 근거 문자열(게시일 · 제목 · 말)');
      if (!isStr(c.reason)) err(where, c.id, '이유(reason)가 없다 — 문 · ⓐ 뼈대 기록 · ⓒ 마무리 · ⓑ 메인 연결 수와 까닭(tools/views/spine.mjs)');
      checkCommon(c, where);
    } else if (c.section === 'majors') {
      // 주요 인물(X3g-1b) — 인물(같은 인물 묶음)마다 하나: 확정 = 주요 인물(결정적 순간 → 필수), 기각 = 띠 안이지만 끊는 선 아래
      idOk(ID.major, 'C<번호> (주요 인물)');
      unknown(o, FIELDS.major, (m) => warn(where, c.id, m));
      if (!isStr(o.person) || !String(o.person).startsWith('person:') || !ctx.targetIds.has(o.person)) err(where, c.id, `person ${JSON.stringify(o.person ?? '')} — 사전의 인물 ID(person:…)`);
      else {
        const g = sameGroups.get(o.person)?.[0] ?? o.person;
        if (majorSeen.has(g)) err(where, c.id, `${o.person}의 주요 인물 항목이 둘이다 — ${majorSeen.get(g)}에도 있다(같은 인물은 대표 ID 하나로)`);
        else majorSeen.set(g, c.id);
      }
      if (c.status === '확정' && !(isStr(o.from) && spineKeys.has(o.from))) err(where, c.id, `from ${JSON.stringify(o.from ?? '')} — 주요 인물이 되는 척추 자리(메인 챕터 ch19나 척추 이벤트 · 사이드 키)`);
      else if (o.from !== undefined && !(isStr(o.from) && spineKeys.has(o.from))) err(where, c.id, `from ${JSON.stringify(o.from)} — 척추 자리 키`);
      for (const k of ['scenes', 'changes', 'score']) if (o[k] !== undefined && typeof o[k] !== 'number') err(where, c.id, `${k}는 수(tools/views/majors.mjs가 센 값)`);
      if (!isStr(c.reason)) err(where, c.id, '이유(reason)가 없다 — 말한 씬 · 변화 · 점수와 끊는 선(tools/views/majors.mjs)');
      checkCommon(c, where);
    } else if (c.section === 'closures') {
      // 마무리 기록(X3f-1d) — 쌓인 자리(built) → 끝난 자리(end · closing). 형식 docs/annotations.md "마무리 기록"
      idOk(ID.closure, 'O<번호> (마무리)');
      unknown(o, FIELDS.closure, (m) => warn(where, c.id, m));
      if (!CLOSURE_TYPES.includes(o.type)) err(where, c.id, `type "${o.type ?? ''}" — ${CLOSURE_TYPES.join(' · ')} 중 하나`);
      if (!isStr(o.text)) err(where, c.id, '문장(text)이 없다 — 무엇이 어떻게 끝났나 한 문장');
      else if (c.status === '확정' && /^\(초안\)/.test(o.text)) warn(where, c.id, '확정인데 문장이 초안 그대로다 — set … --text로 고친다');
      const endOk = isStr(o.end) && (!order || orderPos.has(o.end));
      if (!isStr(o.end)) err(where, c.id, '끝난 단위(end)가 없다 — 읽기 단위 키');
      else if (!endOk) err(where, c.id, `end: 읽기 순서에 없는 단위 ${o.end}`);
      const sideRec = (r) => r.people || r.threads || r.layers || r.leads || r.spine || r.majors || r.closures || r.links;
      if (!Array.isArray(o.built) || !o.built.length) err(where, c.id, '쌓인 자리(built)가 없다 — 기록 ID(사실 · 의문 · 사건 · 인물 변화 · 떡밥 · 생활상)나 단위 키(연작의 앞 편) 배열');
      else {
        for (const x of o.built) {
          const r = isStr(x) ? byId.get(x) : null;
          let at = null;
          if (r) {
            if (sideRec(r)) err(where, c.id, `built ${x}: 기록 ID(사실 · 의문 · 사건 · 인물 변화 · 떡밥 · 생활상)나 단위 키를 쓴다`);
            else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `built: 기각된 ${x}를 가리킨다`);
            at = r.unit;
          } else if (isStr(x) && orderPos.has(x)) {
            at = x;
            if (x === o.end) warn(where, c.id, `built에 끝 단위 ${x}가 있다 — 끝 단위의 기록은 closing에`);
          } else err(where, c.id, `built ${JSON.stringify(x)}: 없는 기록 · 단위`);
          if (at && endOk && orderAt(at) > orderAt(o.end)) warn(where, c.id, `built ${x}(${at})가 끝(${o.end})보다 뒤다`);
        }
      }
      if (o.closing !== undefined && !Array.isArray(o.closing)) err(where, c.id, 'closing은 기록 ID 배열(끝난 단위의 닫는 기록)');
      for (const x of arr(o.closing)) {
        const r = isStr(x) ? byId.get(x) : null;
        if (!r || sideRec(r)) err(where, c.id, `closing ${JSON.stringify(x)}: 없는 기록 — 끝난 단위의 사실 · 사건 · 인물 변화 · 떡밥 ID`);
        else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `closing: 기각된 ${x}를 가리킨다`);
        else if (isStr(o.end) && r.unit !== o.end) warn(where, c.id, `closing ${x}는 ${r.unit ?? '?'}의 기록이다 — 끝 단위(${o.end})의 기록을 든다`);
        if (arr(o.built).includes(x)) err(where, c.id, `${x}가 built와 closing에 함께 있다`);
      }
      if (o.chain !== undefined && !isStr(o.chain)) err(where, c.id, 'chain은 사슬 초안 키 문자열(tools/views/closures.mjs)');
      else if (isStr(o.chain) && c.status !== '기각') {
        if (closureChains.has(o.chain)) warn(where, c.id, `같은 사슬(${o.chain})의 마무리 기록이 또 있다 — ${closureChains.get(o.chain)}`);
        else closureChains.set(o.chain, c.id);
      }
      checkAbout(c, where);
      checkCommon(c, where);
    } else if (c.section === 'merges') {
      // 합류 기록(X3f-1g) — 한 결판(end)에서 함께 끝난 마무리 기록 둘 이상. 형식 docs/annotations.md "합류 기록"
      idOk(ID.merge, 'H<번호> (합류)');
      unknown(o, FIELDS.merge, (m) => warn(where, c.id, m));
      if (!isStr(o.title)) err(where, c.id, '결판 이름(title)이 없다 — GODDESS FALL 결전 · 토브의 호감도처럼');
      if (!isStr(o.text)) err(where, c.id, '문장(text)이 없다 — 무엇이 함께 끝났나 한 문장');
      const endOk = isStr(o.end) && (!order || orderPos.has(o.end));
      if (!isStr(o.end)) err(where, c.id, '함께 끝난 단위(end)가 없다 — 읽기 단위 키');
      else if (!endOk) err(where, c.id, `end: 읽기 순서에 없는 단위 ${o.end}`);
      if (!Array.isArray(o.members) || o.members.length < 2) err(where, c.id, '함께 끝난 마무리(members)는 O ID 둘 이상의 배열');
      else {
        if (new Set(o.members).size !== o.members.length) err(where, c.id, 'members에 같은 O가 두 번 있다');
        for (const x of o.members) {
          const r = isStr(x) ? byId.get(x) : null;
          if (!r || r.kind !== 'closure') err(where, c.id, `members ${JSON.stringify(x)}: 없는 마무리 기록(O)`);
          else if (r.status === '기각' && c.status !== '기각') err(where, c.id, `members: 기각된 ${x}를 가리킨다`);
          else if (isStr(o.end) && r.obj?.end !== o.end) err(where, c.id, `members ${x}의 끝(${r.obj?.end ?? '?'})이 합류의 끝(${o.end})과 다르다 — 한 결판에서 함께 끝난 것만 묶는다`);
          if (r && c.status !== '기각') {
            if (mergedIn.has(x)) warn(where, c.id, `${x}가 다른 합류(${mergedIn.get(x)})에도 있다 — 한 결판에 하나`);
            else mergedIn.set(x, c.id);
          }
        }
      }
      checkCommon(c, where);
    }
  }
  // 주역 명단의 줄기 주인(X3f-1c) — 뼈대 줄기마다 주인 항목, 주인은 2명 이하 · 사전의 인물, 주인 · 카운터스마다 주역 항목
  if (leadsData && (ownerOf.size || counters.size)) {
    const where = ds.leads.name;
    const skeleton = ds.candidates.filter((c) => c.kind === 'thread' && c.status !== '기각' && c.obj?.weight === '뼈대').map((c) => c.id);
    const listed = new Set(arr(leadsData.threads).map((t) => t?.thread));
    for (const j of skeleton) if (!listed.has(j)) warn(where, j, `뼈대 줄기 ${j}의 주인 항목(threads[].owners)이 없다 — 주인이 없으면 owners: []로 적고 이유를 단다`);
    for (const t of arr(leadsData.threads)) {
      const id = t?.thread ?? '?';
      unknown(t ?? {}, FIELDS.leadThread, (m) => warn(where, id, m));
      if (!skeleton.includes(id)) err(where, id, `threads[].thread ${JSON.stringify(id)} — 확정된 뼈대 줄기 ID(J…)`);
      if (!Array.isArray(t?.owners)) err(where, id, 'owners는 인물 ID 배열(줄기의 주인 1–2명, 없으면 [])');
      else {
        if (t.owners.length > 2) err(where, id, `owners ${t.owners.length}명 — 줄기의 주인은 1–2명(그 줄기가 정체를 묻는 사람)`);
        for (const p of t.owners) if (!isStr(p) || !String(p).startsWith('person:') || !ctx.targetIds.has(p)) err(where, id, `owners ${JSON.stringify(p)} — 사전의 인물 ID(person:…)`);
      }
      if (!isStr(t?.reason)) err(where, id, '주인을 고른 이유(reason)가 없다 — 줄기 제목 · 의문이 묻는 사람');
    }
    for (const p of counters) if (!isStr(p) || !String(p).startsWith('person:') || !ctx.targetIds.has(p)) err(where, 'counters', `counters ${JSON.stringify(p)} — 사전의 인물 ID(person:…)`);
    for (const p of leadPool) if (!leadPersons.has(p)) warn(where, p, `${p}은 줄기의 주인 · 카운터스인데 주역 항목(Z)이 없다 — node tools/records.mjs leads --add`);
  }

  // ── 마무리 기록 파일 (X3f-1d) ──
  if (ds.closures?.data) {
    const d = ds.closures.data;
    if (typeof d !== 'object' || Array.isArray(d)) err(ds.closures.name, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.closuresFile, (m) => warn(ds.closures.name, null, m));
      if (d.closures !== undefined && !Array.isArray(d.closures)) err(ds.closures.name, null, 'closures는 배열이어야 한다');
      if (d.merges !== undefined && !Array.isArray(d.merges)) err(ds.closures.name, null, 'merges는 배열이어야 한다');
    }
  }

  // ── 주역 명단 파일 ──
  if (ds.leads?.data) {
    const d = ds.leads.data;
    if (typeof d !== 'object' || Array.isArray(d)) err(ds.leads.name, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.leadsFile, (m) => warn(ds.leads.name, null, m));
      if (d.leads !== undefined && !Array.isArray(d.leads)) err(ds.leads.name, null, 'leads는 배열이어야 한다');
    }
  }

  // ── 주요 인물 파일(X3g-1b) ──
  if (ds.majors?.data) {
    const d = ds.majors.data;
    if (typeof d !== 'object' || Array.isArray(d)) err(ds.majors.name, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.majorsFile, (m) => warn(ds.majors.name, null, m));
      if (d.majors !== undefined && !Array.isArray(d.majors)) err(ds.majors.name, null, 'majors는 배열이어야 한다');
      if (d.criteria !== undefined && (typeof d.criteria !== 'object' || Array.isArray(d.criteria) || Object.values(d.criteria).some((v) => typeof v !== 'number'))) err(ds.majors.name, null, 'criteria는 { 이름: 수 } 객체(tools/views/majors.mjs DEFAULT_CRITERIA)');
    }
  }

  // ── 층 판정 파일 ──
  if (ds.layers?.data) {
    const d = ds.layers.data;
    const where = ds.layers.name;
    if (typeof d !== 'object' || Array.isArray(d)) err(where, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.layersFile, (m) => warn(where, null, m));
      if (d.units !== undefined && !Array.isArray(d.units)) err(where, null, 'units는 배열이어야 한다');
      if (order) {
        const lay = computeLayers(ds, order);
        for (const k of lay.doubled) err(where, null, `${k}의 층 판정이 둘 이상이다 — 단위 하나에 판정 하나(틀린 것은 기각)`);
        if (lay.missing.length) warn(where, null, `층 판정이 없는 메인 밖 단위 ${lay.missing.length} — ${lay.missing.slice(0, 8).join(' ')}${lay.missing.length > 8 ? ' …' : ''} (records.mjs layers --add)`);
        // 2회독이 끝난 뒤 등급을 다시 판정해도 층은 읽은 층으로 묶는다(X3a)
        for (const u of lay.units) {
          const read = readLayers?.get(u.key);
          if (!read || !u.layer || u.layer === read || !u.judgment) continue;
          warn(where, u.judgment.id, `${u.key}: 2회독은 ${read}층에서 읽었는데 판정의 층이 ${u.layer}층이다 — 등급을 바꿨으면 set ${u.judgment.id} 확정 --layer ${read} --note "2회독은 ${read}층에서 읽음"으로 묶는다`);
        }
      }
    }
  }

  // ── 줄기 파일 ──
  if (ds.threads?.data) {
    const d = ds.threads.data;
    const where = ds.threads.name;
    if (typeof d !== 'object' || Array.isArray(d)) err(where, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.threadsFile, (m) => warn(where, null, m));
      for (const sec of ['threads', 'relations']) if (d[sec] !== undefined && !Array.isArray(d[sec])) err(where, null, `${sec}는 배열이어야 한다`);
      // 의문 하나는 줄기 하나 — 기각되지 않은 의문은 모두 줄기에 든다
      const owner = new Map();
      for (const t of ds.candidates.filter((x) => x.section === 'threads' && x.status !== '기각')) {
        for (const q of Array.isArray(t.obj?.questions) ? t.obj.questions : []) {
          if (owner.has(q)) err(where, t.id, `${q}가 두 줄기에 든다 — ${owner.get(q)}에도 있다. 의문 하나는 줄기 하나(가까운 줄기는 관계로 잇는다)`);
          else owner.set(q, t.id);
        }
      }
      const loose = ds.candidates.filter((x) => x.section === 'questions' && x.status !== '기각' && isStr(x.id) && !owner.has(x.id)).map((x) => x.id);
      if (loose.length) warn(where, null, `줄기에 안 든 의문 ${loose.length}건 — ${loose.slice(0, 12).join(' ')}${loose.length > 12 ? ' …' : ''}`);
      const pairs = new Map();
      for (const r of ds.candidates.filter((x) => x.section === 'relations' && x.status !== '기각')) {
        const k = [r.obj?.a, r.obj?.b].sort().join('~');
        if (pairs.has(k)) warn(where, r.id, `같은 두 줄기의 관계가 또 있다 — ${pairs.get(k)}. 한 쌍에는 가장 강한 관계 하나`);
        else pairs.set(k, r.id);
      }
    }
  }

  // ── 수동 엣지 파일 ──
  if (ds.links?.data) {
    const d = ds.links.data;
    const where = ds.links.name;
    if (typeof d !== 'object' || Array.isArray(d)) err(where, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.linksFile, (m) => warn(where, null, m));
      if (d.edges !== undefined && !Array.isArray(d.edges)) err(where, null, 'edges는 배열이어야 한다');
      const keys = new Map();
      for (const e of ds.candidates.filter((x) => x.section === 'edges' && x.links && x.status !== '기각')) {
        const k = `${e.obj?.from}\t${e.obj?.to}\t${e.obj?.type}`;
        if (keys.has(k)) warn(where, e.id, `같은 (from, to, type) 수동 엣지가 또 있다 — ${keys.get(k)}`);
        else keys.set(k, e.id);
      }
    }
  }

  // ── 소속 기록 파일 — game 대응(게임 코드 → org ID 또는 null)과 같은 (인물, 조직, act) 겹침 ──
  if (ds.affiliations?.data) {
    const d = ds.affiliations.data;
    const where = ds.affiliations.name;
    if (typeof d !== 'object' || Array.isArray(d)) err(where, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.affiliationsFile, (m) => warn(where, null, m));
      if (d.affiliations !== undefined && !Array.isArray(d.affiliations)) err(where, null, 'affiliations는 배열이어야 한다');
      const g = d.game ?? {};
      for (const sec of ['corporations', 'squads']) {
        const m = g[sec];
        if (m === undefined) continue;
        if (!m || typeof m !== 'object' || Array.isArray(m)) { err(where, null, `game.${sec}는 { 게임 코드: org ID | null } 객체`); continue; }
        for (const [code, id] of Object.entries(m)) {
          if (id === null) continue;
          if (!isStr(id) || !id.startsWith('org:') || !ctx.targetIds.has(id)) err(where, null, `game.${sec}.${code}: ${JSON.stringify(id)} — 사전의 조직 ID(org:…)나 null(원문에 이름이 없음)`);
        }
      }
      if (g.launch !== undefined && (!g.launch || !Array.isArray(g.launch.resource_ids) || !g.launch.resource_ids.every(Number.isInteger))) err(where, null, 'game.launch는 { resource_ids: [정수 …] } — 게임 시작 로스터');
      const keys = new Map();
      for (const e of ds.candidates.filter((x) => x.affil && x.status !== '기각')) {
        const k = `${e.obj?.person}\t${e.obj?.org}\t${e.obj?.act}\t${JSON.stringify(e.obj?.evidence?.[0]?.scene ?? null)}`;
        if (keys.has(k)) warn(where, e.id, `같은 (인물, 조직, act, 근거 씬) 소속 기록이 또 있다 — ${keys.get(k)}`);
        else keys.set(k, e.id);
      }
    }
  }

  // ── 2회독 볼 거리 (B1b) — 작업 메모라 상태 · 검토는 없다. 단위 · 근거 · 가리키는 기록만 원문 · 기록과 대조한다 ──
  if (ds.watch?.data) {
    const d = ds.watch.data;
    const where = ds.watch.name;
    if (typeof d !== 'object' || Array.isArray(d)) err(where, null, '파일 전체가 객체({ … })여야 한다');
    else {
      unknown(d, FIELDS.watchFile, (m) => warn(where, null, m));
      if (d.items !== undefined && !Array.isArray(d.items)) err(where, null, 'items는 배열이어야 한다');
    }
    const watchIds = new Set();
    const orderKeys = order ? new Set(order.items.map((it) => it.key)) : null;
    for (const w of ds.watchItems) {
      const o = w.obj;
      if (!o || typeof o !== 'object' || Array.isArray(o)) {
        err(where, null, `items ${w.index + 1}번째가 객체가 아니다`);
        continue;
      }
      unknown(o, FIELDS.watch, (m) => warn(where, o.id ?? null, m));
      if (!isStr(o.id) || !ID.watch.test(o.id)) {
        err(where, null, `items ${w.index + 1}번째: id는 W<번호>`);
        continue;
      }
      if (watchIds.has(o.id)) err(where, o.id, 'ID가 겹친다');
      watchIds.add(o.id);
      const r = isStr(o.unit) ? ctx.resolve(o.unit) : null;
      if (!r) err(where, o.id, `없는 단위 ${o.unit ?? ''} — read.mjs 키(ch00 · sub:칠리페퍼_00 · char:10 …)`);
      else if (orderKeys && !orderKeys.has(o.unit)) err(where, o.id, `읽기 순서에 없는 단위 ${o.unit}`);
      const itemsOf = order ? order.items.filter((it) => it.key === o.unit) : [];
      if (o.parts !== undefined) {
        if (!/^\d+-\d+$/.test(String(o.parts))) err(where, o.id, 'parts는 "4-6"처럼 — 1회독 파트');
        else if (order && !itemsOf.some((it) => it.parts && partsOverlap(it.parts, o.parts))) err(where, o.id, `${o.unit}에 겹치는 파트의 읽기 항목이 없다 — parts ${o.parts}`);
      } else if (itemsOf.length > 1) warn(where, o.id, `${o.unit}는 파트를 나눠 읽는다 — parts를 적으면 그 파트 차례에만 붙는다(없으면 모든 파트)`);
      if (!WATCH_KINDS.includes(o.kind)) err(where, o.id, `종류(kind) "${o.kind ?? ''}" — ${WATCH_KINDS.join(' · ')} 중 하나(무엇으로 적을 거리인가)`);
      if (!isStr(o.text)) err(where, o.id, '무엇을 볼지(text)가 없다');
      else if (o.text.length > LIMITS.text) warn(where, o.id, `text가 ${o.text.length}자 — ${LIMITS.text}자 안쪽으로`);
      if (!isStr(o.from)) err(where, o.id, '출처(from)가 없다 — "R62 인계" · "char.162.json Q246 이유"처럼');
      // 근거 — 메모가 씬만 가리키기도 해서 줄(lines)은 없어도 된다
      if (o.evidence !== undefined) {
        if (!Array.isArray(o.evidence) || !o.evidence.length) err(where, o.id, 'evidence는 [{ "scene": 씬 ID, "lines": [12, "20-25"] }] 배열 — 줄은 없어도 된다');
        else {
          for (const e of o.evidence) {
            if (!e || typeof e !== 'object' || Array.isArray(e)) {
              err(where, o.id, `근거 ${JSON.stringify(e)}: { "scene": … } 모양이어야 한다`);
              continue;
            }
            unknown(e, ['scene', 'lines'], (m) => warn(where, o.id, `근거 ${e.scene ?? '?'}: ${m}`));
            if (!ctx.story(e.scene)) {
              err(where, o.id, `없는 씬 ${e.scene}`);
              continue;
            }
            if (r && !r.scenes.includes(e.scene)) err(where, o.id, `단위 ${o.unit} 밖 씬 ${e.scene}`);
            if (e.lines === undefined) continue;
            const { seqs, problems } = expandLines(e.lines);
            for (const p of problems) err(where, o.id, `근거 ${e.scene}: ${p}`);
            const n = ctx.lines(e.scene).length;
            const bad = seqs.filter((x) => x >= n);
            if (bad.length) err(where, o.id, `없는 줄 ${e.scene}#${bad.join(',')} — 이 씬은 #0–#${n - 1}`);
          }
        }
      }
      if (o.points !== undefined) {
        if (!Array.isArray(o.points) || !o.points.length) err(where, o.id, 'points는 기록 ID 배열이다(F12 · Q3 · Q3-2 · J1)');
        else for (const p of o.points) refRecord({ id: o.id, status: '후보' }, where, p, 'points', POINT_KINDS);
      }
    }
  }

  // ── 새 대상 ──
  const firstSeen = new Map();
  for (const t of ds.targets) {
    const o = t.obj;
    const u = fileUnit.get(t.file);
    if (!o || typeof o !== 'object') {
      err(t.file, null, `targets ${t.index + 1}번째가 객체가 아니다`);
      continue;
    }
    unknown(o, FIELDS.target, (m) => warn(t.file, o.target ?? null, `targets: ${m}`));
    if (!isStr(o.target)) {
      err(t.file, null, `targets ${t.index + 1}번째: target(대상 ID)이 없다`);
      continue;
    }
    if (!ctx.targetIds.has(o.target)) err(t.file, o.target, '사전에 없는 대상 — annotations/dictionary/에 먼저 더하고(표기는 실측) 여기에는 ID만 적는다');
    if (!isStr(o.note)) err(t.file, o.target, '새 대상에는 note(누구 · 무엇인지 한 줄)가 있어야 한다');
    if (o.new !== undefined && typeof o.new !== 'boolean') err(t.file, o.target, 'new는 true/false (이 세션에서 사전에 새로 더했으면 true)');
    checkEvidence(o.evidence, t.file, o.target, u?.scenes, u?.key);
    if (firstSeen.has(o.target)) warn(t.file, o.target, `새 대상이 두 번 나온다 — ${firstSeen.get(o.target)}에도 있다`);
    else firstSeen.set(o.target, t.file);
  }

  // ── 되짚기 메모 ──
  const revisitIds = new Map();
  for (const r of ds.revisits) {
    const o = r.obj;
    unknown(o, FIELDS.revisit, (m) => warn(r.file, r.id, `revisit: ${m}`));
    if (!o || !isStr(o.id) || !ID.revisit.test(o.id)) {
      err(r.file, null, `revisit ${r.index + 1}번째: id는 V<번호>`);
      continue;
    }
    if (revisitIds.has(o.id) || seen.has(o.id)) err(r.file, o.id, `ID가 겹친다 — ${revisitIds.get(o.id) ?? seen.get(o.id)}에도 있다`);
    revisitIds.set(o.id, r.file);
    if (!isStr(o.text)) err(r.file, o.id, '되짚기 메모(text)가 비었다 — 무엇 · 어디');
    if (o.where !== undefined && !(Array.isArray(o.where) && o.where.every(isStr))) err(r.file, o.id, 'where는 문자열 배열(씬 ID · 단위 키)');
  }
  const closed = new Map();
  for (const r of ds.revisitDone) {
    const o = r.obj;
    unknown(o, FIELDS.revisitDone, (m) => warn(r.file, r.id, `revisitDone: ${m}`));
    if (!o || !isStr(o.id)) {
      err(r.file, null, `revisitDone ${r.index + 1}번째: id가 없다`);
      continue;
    }
    if (!revisitIds.has(o.id)) err(r.file, o.id, `없는 되짚기 메모 ${o.id}를 닫는다`);
    if (closed.has(o.id)) warn(r.file, o.id, `${o.id}를 두 번 닫는다 — ${closed.get(o.id)}에서도 닫았다`);
    closed.set(o.id, r.file);
    if (!isStr(o.note)) err(r.file, o.id, '닫는 메모(note)가 없다 — 무엇을 했는지 한 줄');
  }

  // 작중 연대기 ② — 모습 코드(codes) · 좁힘(units) (X1c)
  if (chron.name) {
    const hasCode = ctx.db.prepare('SELECT 1 FROM lines WHERE speaker_id = ? LIMIT 1');
    const cp = chronologyProblems(chron, {
      ...timeRef,
      unitOf: (k) => ctx.resolve(k)?.unit?.key ?? null,
      resolveKey: (k) => {
        const r = ctx.resolve(k);
        return r ? { ...r, scene: r.type === 'scene' } : null;
      },
      ids: new Set(ds.candidates.map((c) => c.id).filter(Boolean)),
      hasCode: (c) => !!hasCode.get(c),
      targets: ctx.targetIds,
      mains: new Set(ctx.units.map((u) => u.key).filter((k) => /^ch\d+$/.test(k))),
      reading: order ? new Set(order.items.map((it) => it.key)) : null,
    });
    for (const p of cp.errors) err(chron.name, p.id, p.msg);
    for (const p of cp.warnings) warn(chron.name, p.id, p.msg);
  }

  return { errors, warnings };
}

/** 검사 결과를 사람이 읽는 줄로 */
export function formatProblems({ errors, warnings }, { limit = 60 } = {}) {
  const line = (x, mark) => `${mark} ${x.file}${x.id ? ` ${x.id}` : ''}: ${x.msg}`;
  const out = [];
  for (const x of errors.slice(0, limit)) out.push(line(x, '✗'));
  if (errors.length > limit) out.push(`✗ … 오류 ${errors.length - limit}건 더`);
  for (const x of warnings.slice(0, limit)) out.push(line(x, '⚠'));
  if (warnings.length > limit) out.push(`⚠ … 경고 ${warnings.length - limit}건 더`);
  return out;
}
