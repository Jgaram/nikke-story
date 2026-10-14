/**
 * 사칭(people.json 정체 연결 impersonates)이 걸린 기록의 그 자리 모습 (W23b, 2026-10-14) — docs/annotations.md "사칭 기록".
 *
 * 기록은 실제 인물로 적는다(지금의 머스탱이 한 일 → about person:한슨). 그대로 보이면 드러나기 전에 정체가 새므로
 * 화면은 드러난 단위(revealed)를 읽기 전에는 사칭한 인물(a) 자리에 이름표 주인(b)을 보인다 — 가리는 기록:
 *   a를 다루고(about · person · with · target) 기록 단위가 사칭 범위가 걸린 단위(spanUnits)이면서
 *   a가 제 이름으로 나오는 단위(ownUnits — 범위 밖에 a의 언급이 있는 단위)가 아닌 것.
 * PRETTY STAR처럼 a가 제 이름으로도 나오는 단위의 기록은 그 a가 진짜 a라서 가리지 않는다(그 단위의 범위 줄을 근거로 쓴 기록은 검사가 경고).
 */
import { impersonations } from './model.mjs';
import { mentionRows, scenePlaces } from './read2.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);

/** 기록이 다루는 인물 — about · person · with · target */
export function peopleOf(o) {
  if (!o || typeof o !== 'object') return [];
  return [...arr(o.about), ...(typeof o.person === 'string' ? [o.person] : []), ...arr(o.with), ...(typeof o.target === 'string' ? [o.target] : [])]
    .filter((x) => typeof x === 'string');
}

/**
 * 사칭 L마다 범위 · 단위 — { id, a, b, revealed, spans, inSpan(scene, n), spanUnits, ownUnits }
 * @param {object} ds loadDataset
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {(scene: string) => string|null} unitOf 씬 → 단위 키(scenePlaces)
 */
export function impersonationUnits(ds, db, unitOf) {
  const implied = mentionRows(ds);
  const stmt = db.prepare('SELECT story_id AS scene, seq_from, seq_to FROM mentions WHERE target = ?');
  return impersonations(ds).map((L) => {
    const span = new Map(L.spans.map((s) => [s.scene, s.seqs]));
    const inSpan = (scene, n) => span.has(scene) && (span.get(scene) === null || span.get(scene).has(n));
    const spanUnits = new Set(L.spans.map((s) => unitOf(s.scene)).filter(Boolean));
    const ownUnits = new Set();
    const rows = [...stmt.all(L.a), ...implied.filter((m) => m.target === L.a).map((m) => ({ scene: m.scene, seq_from: m.from_seq, seq_to: m.to_seq }))];
    for (const m of rows) {
      const u = unitOf(m.scene);
      if (!u || ownUnits.has(u)) continue;
      for (let n = m.seq_from; n <= m.seq_to; n++) if (!inSpan(m.scene, n)) { ownUnits.add(u); break; }
    }
    return { ...L, inSpan, spanUnits, ownUnits };
  });
}

/**
 * 기록 하나의 가림 — 드러나기 전에는 a 자리에 b를 보인다. [{ id, a, b, rev }] (없으면 빈 배열)
 * @param {{ unit?: string|null, obj?: object }} c 후보(loadDataset)
 * @param {ReturnType<typeof impersonationUnits>} imps
 */
export function masksOf(c, imps) {
  if (!c?.unit) return [];
  const people = new Set(peopleOf(c.obj));
  return imps.filter((L) => people.has(L.a) && L.spanUnits.has(c.unit) && !L.ownUnits.has(c.unit))
    .map((L) => ({ id: L.id, a: L.a, b: L.b, rev: L.revealed }));
}

/** 기록 obj의 인물 칸을 가린 모습(드러나기 전) — about · person · with · target에서 a → b(겹치면 하나로) */
export function maskedPeople(o, masks) {
  const swap = (x) => masks.find((m) => m.a === x)?.b ?? x;
  const uniq = (xs) => [...new Set(xs.map(swap))];
  const out = {};
  if (Array.isArray(o?.about)) out.about = uniq(o.about);
  if (typeof o?.person === 'string') out.person = swap(o.person);
  if (Array.isArray(o?.with)) out.with = uniq(o.with);
  if (typeof o?.target === 'string') out.target = swap(o.target);
  return out;
}

const faceCache = new WeakMap();
/**
 * 드러나기 전 모습으로 바꾼 기록 묶음(W23c) — 중요도로 이어지는 계산(주요 인물 · 주역 · 마무리 사슬 · 관계선 · 판정 시안)은 이름표 주인으로 센다:
 * 독자가 감정 · 궁금증을 쌓는 것은 그 이름의 인물이고(머스탱이라는 사장), 실제 인물로 세면 드러나기 전 스토리의 등급이 정체 공개에 끌려간다.
 * 인물 탭 · 기록 화면은 실제 인물로 적고 그 자리 모습만 가린다(masksOf · 화면 fmt.recAt) — 둘을 섞지 않는다. 같은 ds면 한 번만 계산한다.
 * 가린 후보는 + faced(masks). 읽기 순서 · DB가 없으면(예시) 그대로.
 */
export function faceDataset(ds, ctx, order) {
  if (!ds || !order || !ctx?.db) return ds;
  if (faceCache.has(ds)) return faceCache.get(ds);
  const places = scenePlaces(order, ctx);
  const imps = impersonationUnits(ds, ctx.db, places.unitOf);
  let changed = false;
  const candidates = ds.candidates.map((c) => {
    const ms = masksOf(c, imps);
    if (!ms.length) return c;
    changed = true;
    return { ...c, obj: { ...c.obj, ...maskedPeople(c.obj, ms) }, faced: ms };
  });
  const out = changed ? { ...ds, candidates } : ds;
  faceCache.set(ds, out);
  if (out !== ds) faceCache.set(out, out);
  return out;
}
