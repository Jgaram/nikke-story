/**
 * 2회독 기록(B1a)에서 기계적으로 나오는 것 — 씬의 읽는 자리 · 떡밥 기록(E)의 엣지 · 암시 언급(I)의 언급 DB 줄 · 수동 엣지 병합(T4-4).
 * 형식 · 규칙은 docs/annotations.md "2회독 기록", 엣지 타입은 docs/schema.md "엣지 타입".
 *
 * 떡밥 기록 → 엣지 (끝점은 근거의 첫 씬 — 1회독 사건과 같다, R99 형식 메모):
 *   암시   → 가리킨 사실 F<n>     setup_payoff  암시 씬 → 사실의 첫 씬(처음 기록한 드러냄)
 *          → 가리킨 의문 Q<n>     setup_payoff  암시 씬 → 회수마다 그 첫 씬 (회수가 없으면 엣지 없음 — 열린 떡밥)
 *          → 가리킨 사건 F/Q-k    setup_payoff  암시 씬 → 그 사건의 첫 씬
 *   재언급 → F<n> · Q<n> · 사건   callback      가리킨 기록의 첫 씬 → 재언급 씬
 *   줄기 J<n>만 가리키면 씬 엣지는 없다 — 떡밥 흐름 화면(줄기 소속)에만 든다.
 * 방향은 읽는 순서(출시순 한 줄)다. 거꾸로 가는 엣지는 problems에 올라가고, 검증기가 act를 의심하라고 경고한다.
 * 같은 기록이면 같은 결과다.
 */
import { compareIds, expandLines } from './model.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const firstScene = (c) => arr(c?.evidence)[0]?.scene ?? null;
const firstLine = (c) => expandLines(arr(c?.evidence)[0]?.lines ?? []).seqs[0] ?? 0;

/**
 * 씬 → 읽는 자리. 자리 = [단위 차례(1부터 — 1회독 순서, 출시순 한 줄), 단위 안 씬 차례]. 파트를 나눠 읽은 단위는 하나로 친다.
 * @param {{ items: {key:string}[] }} order 1회독 순서(docs/history/reading.md R) — 2회독(층별)이 아니라 출시순으로 잰다
 * @returns {{ unitOf: (scene:string)=>string|null, posOf: (scene:string)=>number[]|null, unitPos: Map<string, number> }}
 */
export function scenePlaces(order, ctx) {
  const unitPos = new Map();
  const place = new Map();
  for (const it of order.items) {
    if (!unitPos.has(it.key)) unitPos.set(it.key, unitPos.size + 1);
    (ctx.resolve(it.key)?.scenes ?? []).forEach((s, i) => {
      if (!place.has(s)) place.set(s, { unit: it.key, pos: [unitPos.get(it.key), i] });
    });
  }
  return {
    unitPos,
    unitOf: (scene) => place.get(scene)?.unit ?? null,
    posOf: (scene) => place.get(scene)?.pos ?? null,
  };
}

/** 두 자리 [단위, 씬, 줄] 비교 — 앞이면 음수 */
export function comparePlace(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** 기록 하나의 자리 — 근거 첫 씬의 자리 + 첫 줄. 범위 밖이면 null */
export function recordPlace(places, c) {
  const p = places.posOf(firstScene(c));
  return p ? [...p, firstLine(c)] : null;
}

/**
 * 떡밥 기록 하나의 엣지들 (기각된 것은 부르는 쪽이 뺀다)
 * @param {object} e 떡밥 후보(kind echo)
 * @param {Map<string, object>} byId 살아 있는(기각 아닌) 기록
 * @param {Map<string, object[]>} recoveriesOf 의문 ID → 살아 있는 회수 사건
 */
export function echoEdgesOf(e, byId, recoveriesOf, places) {
  const out = [];
  const here = firstScene(e);
  const add = (type, point, fromRec, toRec) => {
    const from = fromRec === e ? here : firstScene(fromRec);
    const to = toRec === e ? here : firstScene(toRec);
    const fp = recordPlace(places, fromRec);
    const tp = recordPlace(places, toRec);
    out.push({
      type, record: e.id, act: e.act, point, from_scene: from, to_scene: to, from_unit: places.unitOf(from), to_unit: places.unitOf(to),
      from_order: fp?.[0] ?? null, to_order: tp?.[0] ?? null, backwards: Boolean(fp && tp && comparePlace(fp, tp) > 0),
      confidence: e.confidence ?? '', status: e.status ?? '',
    });
  };
  for (const p of arr(e.obj?.points)) {
    const r = byId.get(p);
    // 사실 · 의문(정의 · 사건)만 씬 엣지가 된다 — 줄기만 가리키면 씬 엣지가 없다(그 밖은 검증기가 오류로 잡는다)
    if (!r || !['fact', 'question'].includes(r.kind) || r.read2) continue;
    if (e.act === '암시') {
      if (r.role === 'def' && r.kind === 'question') for (const q of recoveriesOf.get(r.id) ?? []) add('setup_payoff', p, e, q);
      else add('setup_payoff', p, e, r);
    } else if (e.act === '재언급') add('callback', p, r, e);
  }
  return out;
}

/**
 * 2회독 떡밥 기록(E)의 씬 → 씬 엣지 — 1회독 사건 엣지(tools/views/read1.mjs)와 같은 모양에 record · point · act를 단다
 * @returns {{ edges: object[], problems: string[] }}
 */
export function read2Edges(ds, ctx, order) {
  const places = scenePlaces(order, ctx);
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const byId = new Map(live.map((c) => [c.id, c]));
  const recoveriesOf = new Map();
  for (const c of live) if (c.role === 'event' && c.act === '회수' && c.parent) (recoveriesOf.get(c.parent) ?? recoveriesOf.set(c.parent, []).get(c.parent)).push(c);
  const edges = [];
  for (const e of live.filter((c) => c.kind === 'echo').sort((a, b) => compareIds(a.id, b.id))) edges.push(...echoEdgesOf(e, byId, recoveriesOf, places));
  const problems = edges.filter((r) => r.backwards).map((r) => `${r.record}(${r.act} → ${r.point}): 읽는 순서를 거슬러 간다(${r.from_unit} → ${r.to_unit})`);
  return { edges, problems };
}

/**
 * 암시 언급(I) → 언급 DB 줄(T3-9): 이어진 줄 덩어리마다 한 줄 { scene, from_seq, to_seq, target, how: 'implied', speaker, record, confidence, status }.
 * 자동 줄(speaks · named · alias)은 B2가 빌드에서 만든다 — 이 줄은 그 옆에 붙는다.
 */
export function mentionRows(ds) {
  const rows = [];
  for (const c of ds.candidates.filter((x) => x.kind === 'mention' && x.id && x.status !== '기각').sort((a, b) => compareIds(a.id, b.id))) {
    for (const ev of arr(c.evidence)) {
      const { seqs } = expandLines(ev?.lines);
      let run = null;
      const flush = () => {
        if (run) rows.push({ scene: ev.scene, from_seq: run[0], to_seq: run[1], target: c.obj?.target ?? null, how: 'implied', speaker: Boolean(c.obj?.speaker), record: c.id, confidence: c.confidence ?? '', status: c.status ?? '' });
      };
      for (const n of seqs) {
        if (run && n === run[1] + 1) run[1] = n;
        else {
          flush();
          run = [n, n];
        }
      }
      flush();
    }
  }
  return rows;
}

/**
 * 자동 엣지와 수동 엣지(annotations/links.json, Y<n>)를 합친다 — T4-4: 충돌하면 수동이 이기고 자동값은 보존한다.
 * 같은 엣지 = (from, to, type)이 같은 것. 자동 엣지는 같은 키가 여럿일 수 있다(다른 기록 · 대상이 같은 씬 쌍을 이음) — 모두 따로 둔다.
 * 수동 엣지의 끝점이 단위 키면(opts.isUnit) 자동 엣지의 from_unit · to_unit과 견준다(X2 — 단위 사이 관계를 한 번에 더하거나 지운다).
 *   - 수동만: origin manual로 더한다.
 *   - 둘 다: 수동 값(strength · note …)을 쓰고 걸린 자동 엣지를 모두 `auto`(배열)에 그대로 둔다 — 자리는 첫 자동 엣지 자리.
 *   - 수동 drop: 걸린 자동 엣지를 모두 지운다 — 지운 것은 dropped에 `dropped_by`와 함께 남는다(보존). 지울 자동 엣지가 없으면 unmatched.
 * 기각된 수동 엣지는 없는 것으로 친다. 후보는 합치되 status를 남긴다(확정값처럼 쓰지 않는다 — 관계선이 따로 표시한다).
 * @param {{from:string, to:string, type:string, from_unit?:string, to_unit?:string}[]} auto
 * @param {object[]} manual 수동 엣지 후보(kind edge) 또는 그 obj — { id, type, from, to, strength?, drop?, status }
 * @param {{ isUnit?: (key: string) => boolean }} [opts] 수동 끝점이 단위 키인가 (기본: 아니다 — from · to끼리 견준다)
 * @returns {{ edges: object[], dropped: object[], unmatched: object[] }}
 */
export function mergeEdges(auto, manual, { isUnit = () => false } = {}) {
  const sceneKey = (e) => `${e.from}\t${e.to}\t${e.type}`;
  const unitKey = (e) => `${e.from_unit ?? e.from}\t${e.to_unit ?? e.to}\t${e.type}`;
  let out = auto.map((a) => ({ ...a }));
  const dropped = [];
  const unmatched = [];
  const objs = manual.map((m) => (m?.obj && m.kind === 'edge' ? { ...m.obj, status: m.status } : m)).filter((m) => m && m.status !== '기각');
  for (const m of objs.sort((a, b) => compareIds(a.id ?? '', b.id ?? ''))) {
    const k = sceneKey(m);
    const keyOf = isUnit(m.from) && isUnit(m.to) ? unitKey : sceneKey;
    const hit = out.map((e, i) => (keyOf(e) === k ? i : -1)).filter((i) => i >= 0);
    const prev = hit.map((i) => out[i]);
    out = out.filter((_, i) => !hit.includes(i));
    if (m.drop) {
      if (prev.length) dropped.push(...prev.map((p) => ({ ...p, dropped_by: m.id, drop_status: m.status ?? '' })));
      else unmatched.push(m);
      continue;
    }
    const { drop, reviews, evidence, records, reason, confidence, by, note, ...vals } = m;
    const merged = { ...vals, origin: 'manual', record: m.id, status: m.status ?? '', note: note ?? reason ?? '' };
    const autos = prev.flatMap((p) => (p.origin === 'manual' ? p.auto ?? [] : [p]));
    if (autos.length) merged.auto = autos;
    out.splice(hit.length ? hit[0] : out.length, 0, merged);
  }
  return { edges: out, dropped, unmatched };
}

/**
 * 인용 표기 → 근거 배열: "d_main_01_01_s#12,20-25 sub:로망티스트_00#3" → [{ scene, lines: [12, "20-25"] }, …]
 * (리뷰 도구 set --evidence가 쓴다. 표기는 인계 파일 · 리뷰 화면의 `씬#줄`과 같다)
 */
export function parseCite(text) {
  const out = [];
  for (const tok of String(text ?? '').trim().split(/\s+/).filter(Boolean)) {
    const at = tok.lastIndexOf('#');
    if (at <= 0) throw new Error(`근거 "${tok}" — 씬#줄 모양(d_main_01_01_s#12,20-25)으로 쓴다`);
    const lines = tok.slice(at + 1).split(',').filter(Boolean).map((x) => {
      if (/^\d+$/.test(x)) return Number(x);
      if (/^\d+-\d+$/.test(x)) return x;
      throw new Error(`근거 "${tok}"의 줄 "${x}" — 숫자나 a-b`);
    });
    if (!lines.length) throw new Error(`근거 "${tok}"에 줄이 없다`);
    out.push({ scene: tok.slice(0, at), lines });
  }
  if (!out.length) throw new Error('근거가 비었다 — 씬#줄');
  return out;
}

/**
 * 미상 이름표 줄(`???` 등, lines.speaker_class = '미상') 가운데 2회독이 정체를 적은 줄 — 단위마다 { total, done }.
 * 정체를 적은 줄 = 기각 안 된 암시 언급(I) 중 `speaker: true`의 근거 줄. 자동 speaks는 미상 줄을 누구에게도 잇지 않으므로(B2) 이것이 남은 일이다.
 * @returns {Map<string, {total: number, done: number}>} 단위 키 → 수 (범위 안, 미상 줄이 있는 단위만)
 */
export function unknownSpeakerProgress(ds, ctx) {
  const unknown = new Map(); // `${scene}#${seq}` → 단위 키
  for (const r of ctx.db.prepare("SELECT l.story_id, l.seq FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 AND l.speaker_class = '미상'").all()) {
    const u = ctx.unitOfScene(r.story_id)?.key;
    if (u) unknown.set(`${r.story_id}#${r.seq}`, u);
  }
  const out = new Map();
  for (const u of unknown.values()) (out.get(u) ?? out.set(u, { total: 0, done: 0 }).get(u)).total++;
  const done = new Set();
  for (const c of ds.candidates.filter((x) => x.kind === 'mention' && x.status !== '기각' && x.obj?.speaker)) {
    for (const ev of arr(c.evidence)) {
      for (const n of expandLines(ev?.lines).seqs) {
        const k = `${ev?.scene}#${n}`;
        if (unknown.has(k) && !done.has(k)) {
          done.add(k);
          out.get(unknown.get(k)).done++;
        }
      }
    }
  }
  return out;
}
