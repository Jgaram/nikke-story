/**
 * 인물 = 실제 한 사람(W24a, 결정 #12) — 정체 연결 L 두 가지의 계산. docs/annotations.md "같은 사람 · 다른 사람".
 *
 *   같은 인물(same_as)  두 이름이 한 사람이다 — 묶음은 model.mjs sameAsGroups. 드러나기 전 화면에서는 따로 보인다.
 *   다른 인물(split)    이름 b로 잡힌 줄 가운데 spans는 실제로 다른 사람 a다(사칭 · 같은 이름의 다른 사람 · 착각).
 *
 * 드러나는 자리는 둘 다 근거(evidence) 첫 씬의 단위다. 기록은 그 장면에서 보인 이름으로 적는다(지금의 머스탱이 한 일 → person:머스탱) —
 * 그래서 드러나기 전 화면 · 계산(주요 인물 · 주역 · 판정 …)은 적힌 그대로 쓴다. 드러난 뒤에만 다른 인물 줄을 근거로 한 기록의 b를 a로 본다(splitHits).
 */
import { expandLines, splits } from './model.mjs';
import { mentionRows, scenePlaces } from './read2.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const getOr = (m, k, mk) => m.get(k) ?? m.set(k, mk()).get(k);

/** 기록이 다루는 인물 — about · person · with · target */
export function peopleOf(o) {
  if (!o || typeof o !== 'object') return [];
  return [...arr(o.about), ...(typeof o.person === 'string' ? [o.person] : []), ...arr(typeof o.with === 'string' ? [o.with] : o.with), ...(typeof o.target === 'string' ? [o.target] : [])]
    .filter((x) => typeof x === 'string');
}

/** 근거의 (씬, 줄) 쌍 */
const evidenceLines = (ev) => arr(ev).flatMap((e) => (typeof e?.scene === 'string' ? expandLines(e.lines).seqs.map((n) => [e.scene, n]) : []));

/**
 * 대상마다 잡힌 줄 — 언급 DB 자동 줄(이름표로 말함 · 이름 · 다른 이름) ∪ 2회독 암시 언급. Map(대상 → Map(씬 → Set(줄)))
 * @param {object} ds loadDataset
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {Set<string>} targets 이 대상들만
 */
export function targetLines(ds, db, targets) {
  const out = new Map();
  const add = (t, scene, from, to) => {
    if (!targets.has(t)) return;
    const s = getOr(getOr(out, t, () => new Map()), scene, () => new Set());
    for (let n = from; n <= to; n++) s.add(n);
  };
  const stmt = db.prepare('SELECT story_id AS scene, seq_from, seq_to FROM mentions WHERE target = ?');
  for (const t of targets) for (const r of stmt.all(t)) add(t, r.scene, r.seq_from, r.seq_to);
  for (const r of mentionRows(ds)) add(r.target, r.scene, r.from_seq, r.to_seq);
  return out;
}

/**
 * 다른 인물 L마다 범위 · 단위 — { id, a, b, spans, evidence, revealed, inSpan(scene, n), spanUnits, ownUnits, bLines }
 *   revealed  드러나는 단위 = 근거 첫 씬의 단위(없으면 null — 읽는 중에는 늘 드러나지 않음)
 *   ownUnits  a가 범위 밖에서 제 이름으로 나오는 단위 — 그 단위에서는 a로 적어도 드러나기 전에 새지 않는다
 *   bLines    Map(씬 → Set(줄)) — b로 잡힌 줄(기록의 b가 범위 줄의 b인지 가른다)
 * @param {object} ds loadDataset
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {(scene: string) => string|null} unitOf 씬 → 단위 키
 */
export function splitUnits(ds, db, unitOf) {
  const Ls = splits(ds);
  const lines = targetLines(ds, db, new Set(Ls.flatMap((L) => [L.a, L.b])));
  return Ls.map((L) => {
    const span = new Map(L.spans.map((s) => [s.scene, s.seqs]));
    const inSpan = (scene, n) => span.has(scene) && (span.get(scene) === null || span.get(scene).has(n));
    const spanUnits = new Set(L.spans.map((s) => unitOf(s.scene)).filter(Boolean));
    const ownUnits = new Set();
    for (const [scene, seqs] of lines.get(L.a) ?? []) {
      const u = unitOf(scene);
      if (u && !ownUnits.has(u) && [...seqs].some((n) => !inSpan(scene, n))) ownUnits.add(u);
    }
    const first = L.evidence.find((e) => typeof e?.scene === 'string')?.scene;
    return { ...L, revealed: first ? unitOf(first) : null, inSpan, spanUnits, ownUnits, bLines: lines.get(L.b) ?? new Map() };
  });
}

/**
 * 기록이 다른 인물 줄을 근거로 b를 다루나(W24a) — 드러난 뒤에는 그 기록의 b가 a다. [{ id, a, b, rev, all }]
 * 근거 가운데 b로 잡힌 줄(없으면 근거 줄 전부)이 범위에 걸리면 맞다: 모두 범위 안이면 all(b → a), 범위 밖 줄도 있으면 둘 다(b · a).
 * @param {{ obj?: object, evidence?: object[] }} c 후보(loadDataset) — 근거는 c.evidence ?? c.obj.evidence
 * @param {ReturnType<typeof splitUnits>} sps
 */
export function splitHits(c, sps) {
  const people = new Set(peopleOf(c?.obj));
  const ev = evidenceLines(c?.evidence ?? c?.obj?.evidence);
  if (!ev.length) return [];
  const out = [];
  for (const L of sps) {
    if (!people.has(L.b) || people.has(L.a)) continue;
    const named = ev.filter(([s, n]) => L.bLines.get(s)?.has(n));
    const look = named.length ? named : ev;
    const inside = look.filter(([s, n]) => L.inSpan(s, n)).length;
    if (inside) out.push({ id: L.id, a: L.a, b: L.b, rev: L.revealed, all: inside === look.length });
  }
  return out;
}

/**
 * 드러난 뒤 모습 — 기록 obj의 인물 칸에서 b를 a로(all) 또는 b 곁에 a를 더한다(둘 다). 한 사람 칸(person · target)은 all일 때만 바꾼다.
 * @param {object} o 기록 obj
 * @param {ReturnType<typeof splitHits>} hits
 */
export function revealedPeople(o, hits) {
  const one = (x) => hits.find((h) => h.b === x && h.all)?.a ?? x;
  const many = (xs) => [...new Set(xs.flatMap((x) => { const h = hits.find((y) => y.b === x); return !h ? [x] : h.all ? [h.a] : [x, h.a]; }))];
  const out = {};
  if (Array.isArray(o?.about)) out.about = many(o.about);
  if (typeof o?.person === 'string') out.person = one(o.person);
  if (Array.isArray(o?.with)) out.with = many(o.with);
  else if (typeof o?.with === 'string') out.with = one(o.with);
  if (typeof o?.target === 'string') out.target = one(o.target);
  return out;
}

/**
 * 동명이인 화면 이름(W23d) — 같은 종류(type)에서 표준명이 겹치는 대상은 ID 구분어로 가른다: `person:사쿠라_콜라보` → '사쿠라 (콜라보)'.
 * ID가 `<종류>:<이름>`인 대상은 이름 그대로. ID가 이름으로 시작하지 않으면 ID 전체를 구분어로. 겹치지 않으면 빈 Map.
 * @param {{ id: string, type: string, name: string }[]} targets
 * @returns {Map<string, string>} 대상 ID → 화면 이름(구분어가 붙는 것만)
 */
export function homonymLabels(targets) {
  const groups = new Map();
  for (const t of targets) {
    if (!t?.name) continue;
    getOr(groups, `${t.type}\u0000${t.name}`, () => []).push(t);
  }
  const out = new Map();
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const t of g) {
      const bare = String(t.id).replace(/^[a-z]+:/, '');
      const base = t.name.replace(/ /g, '_');
      if (bare === base) continue;
      const tail = bare.startsWith(`${base}_`) ? bare.slice(base.length + 1) : bare;
      out.set(t.id, `${t.name} (${tail.replace(/_/g, ' ')})`);
    }
  }
  return out;
}

const actualCache = new WeakMap();
/**
 * 실제 사람으로 본 기록 묶음(W24a) — 계산(주요 인물 · 주역 · 마무리 사슬 · 관계선 · 판정 시안)은 드러난 뒤 모습으로 센다:
 * 다른 인물 줄을 근거로 b를 다룬 기록은 a의 것(회상 속 아버지 머스탱의 관계 변화는 아버지의 것 — 지금의 머스탱과 같은 사람으로 접지 않는다).
 * 같은 인물(same_as)은 부르는 쪽이 묶음(sameAsGroups)으로 합친다. 인물 탭 · 화면은 적힌 그대로 두고 그 자리 모습을 고른다(내보내기 imp).
 * 읽기 순서 · DB가 없으면(예시) 그대로. 같은 ds면 한 번만 계산한다. 바꾼 후보는 + actual(splitHits)
 * @param {object} ds loadDataset
 * @param {object} ctx openContext()
 * @param {{ items: {key:string}[] }} order 1회독 순서
 */
export function actualDataset(ds, ctx, order) {
  if (!ds || !order || !ctx?.db) return ds;
  if (actualCache.has(ds)) return actualCache.get(ds);
  const sps = splitUnits(ds, ctx.db, scenePlaces(order, ctx).unitOf);
  let changed = false;
  const candidates = ds.candidates.map((c) => {
    if (c.kind === 'link' || c.kind === 'mention') return c; // 암시 언급의 줄은 집계가 범위로 옮긴다
    const hits = splitHits(c, sps);
    if (!hits.length) return c;
    changed = true;
    return { ...c, obj: { ...c.obj, ...revealedPeople(c.obj, hits) }, actual: hits };
  });
  const out = changed ? { ...ds, candidates } : ds;
  actualCache.set(ds, out);
  if (out !== ds) actualCache.set(out, out);
  return out;
}

/**
 * 줄의 실제 주인(W24a) — 이름 b로 잡힌 줄이 다른 인물 범위 안이면 a. 계산이 말한 줄 · 등장 씬을 셀 때 쓴다(인물 탭 집계는 tools/views/persons.mjs가 같은 범위로 옮긴다)
 * @param {ReturnType<typeof splitUnits>} sps
 * @returns {{ owner: (scene: string, seq: number, target: string) => string, movedOut: (scene: string, target: string) => boolean, spanScenes: { scene: string, a: string, b: string, inSpan: (n: number) => boolean, bSeqs: number[] }[] }}
 *   movedOut: 그 씬의 b 줄이 모두 범위 안이라 b는 그 씬에 실제로 없다 · spanScenes: 범위 씬마다 옮길 b 줄
 */
export function lineOwners(sps) {
  const by = new Map();
  const spanScenes = [];
  for (const L of sps) {
    for (const sp of L.spans) {
      const inSpan = (n) => L.inSpan(sp.scene, n);
      getOr(by, sp.scene, () => []).push({ a: L.a, b: L.b, inSpan });
      spanScenes.push({ scene: sp.scene, a: L.a, b: L.b, inSpan, bSeqs: [...(L.bLines.get(sp.scene) ?? [])].filter(inSpan) });
    }
  }
  const owner = (scene, seq, t) => by.get(scene)?.find((x) => x.b === t && x.inSpan(seq))?.a ?? t;
  const movedOut = (scene, t) => sps.some((L) => L.b === t && L.bLines.has(scene) && [...L.bLines.get(scene)].every((n) => L.inSpan(scene, n)));
  return { owner, movedOut, spanScenes };
}

/** 기본 이름을 정하는 창 — 그 사람이 나온 최근 몇 편(결정 #12) */
export const FAMILIAR_WINDOW = 10;

/**
 * 같은 인물 묶음의 기본 이름(W24b, 결정 #12) — 그 사람이 나온 최근 10편에서 가장 많이 보인 이름.
 * 편마다 그 편에서 줄(이름표로 말한 줄 · 이름 · 다른 이름 · 암시 언급 — 다른 인물 범위는 옮긴 뒤)이 가장 많은 이름에 한 표(같으면 ID 순 앞),
 * 순위는 최근 10편의 표 → 그 10편의 줄 → 전체 줄 → ID 순. 전체 수만 보면 인물이 바뀐 채 이야기가 이어져도 따라가지 못하고, 마지막 한 편만 보면
 * 잠깐 다른 이름으로 불릴 때마다 흔들린다(사용자, 2026-10-14). 새 스토리가 들어오면 다시 센다.
 * @param {Map<string, string[]>} groups sameAsGroups — 인물 → 같은 인물 전부
 * @param {{ person: string, order: number|string, lines: number|string }[]} unitRows 인물 × 단위(만우절 뺀 — person-units.csv)
 * @returns {Map<string, { head: string, rank: number, votes: number, recent: number, lines: number }>} 묶음에 든 인물 → 기본 이름(head) · 이 이름의 순위(1 = 기본) · 표 · 최근 줄 · 전체 줄
 */
export function familiarNames(groups, unitRows, window = FAMILIAR_WINDOW) {
  const out = new Map();
  const byPerson = new Map();
  for (const r of unitRows) if (Number(r.lines) > 0) getOr(byPerson, r.person, () => []).push(r);
  for (const members of new Set(groups.values())) {
    if (members.length < 2 || out.has(members[0])) continue;
    const units = new Map(); // 차례 → Map(이름 → 줄)
    for (const id of members) for (const r of byPerson.get(id) ?? []) getOr(units, Number(r.order), () => new Map()).set(id, Number(r.lines));
    const recent = [...units.keys()].sort((a, b) => a - b).slice(-window).map((o) => units.get(o));
    const stat = new Map(members.map((id) => [id, { id, votes: 0, recent: 0, lines: (byPerson.get(id) ?? []).reduce((s, r) => s + Number(r.lines), 0) }]));
    for (const u of recent) {
      const [top] = [...u].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
      stat.get(top[0]).votes++;
      for (const [id, n] of u) stat.get(id).recent += n;
    }
    const ranked = [...stat.values()].sort((x, y) => y.votes - x.votes || y.recent - x.recent || y.lines - x.lines || x.id.localeCompare(y.id));
    ranked.forEach((s, i) => out.set(s.id, { head: ranked[0].id, rank: i + 1, votes: s.votes, recent: s.recent, lines: s.lines }));
  }
  return out;
}
