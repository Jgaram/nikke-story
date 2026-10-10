/**
 * 탭 5 연대기(W6) — 화면 6의 자료를 `site/data/chrono.json` 하나로 내보낸다. 규칙은 docs/views.md 화면 6 · tools/views/chrono-order.mjs 머리말.
 * 원문 · DB `lines`는 읽지 않는다 — data/views/timeline/ CSV(X1b–X1d 계산 결과)와 annotations/chronology.json(시대 기준점 · 좁힘, Claude 확정)만 쓴다.
 * 단위의 공개 자리 · 제목 · 종류는 공용 units.json에 있으므로 여기 다시 싣지 않는다(브라우저가 idx.units로 잇는다).
 *
 * chrono.json = {
 *   points[57]   작중 축의 점 — 시대 기준점 8(chronology.json eras 순서) + 메인 챕터 49(번호 순). { pos(= 2i+1), id, era(시대면 true), name, years(지금에서 몇 년 전), basis[](시점 기록 ID), reason,
 *                meet[](시대만 — 처음 드러난 스토리: 근거 · 그 기준점을 든 시점 기록의 스토리, common.mjs meetList. 화면은 R.seenAny(meet) 앞에서 이름 · 햇수를 숨긴다 — W15b) }
 *                자리(pos) 규칙은 chrono.mjs와 같다: 점 i = 2i+1, 점 i-1과 i 사이 칸 = 2i, 첫 점 앞 = 0, 마지막 점 뒤 = 2P. 칸 라벨은 브라우저가 만든다.
 *   units[481]   단위의 '지금' — { unit, class(판별 · 범위 · 상대 · 불명), place(작중 자리 글 — chrono.csv 그대로), lo, hi(여러 조각이면 감싸는 구간), via(메인 · 단위 · 조각 · 회상 · 좁힘 · 단위 · 좁힘),
 *                records[](자리를 정한 시점 기록 S), pieces[] · flashbacks[](조각 ID), relations(관계 글), narrow(좁힘 관계 글) · narrow_confidence, release_main(공개 당시 메인), drift(과거 · 앞 · 맞음 · 걸침 · 뒤), drift_gap,
 *                seq(작중 순서 — 상대 · 불명은 없음), slot(놓이는 칸 pos), multi(여러 자리), parallel{with, record}(메인 — 다른 챕터와 같은 무렵인 병행 줄거리: 상대 키 · 근거 시점 기록) }
 *   pieces[109]  조각(회상 · 기준점 구간 — 단위의 '지금'과 다른 때) — { id(S…), unit, kind(회상 · 기준점), class, place, lo, hi, years, relations, narrow · narrow_confidence, text, seq, slot }
 *   narrows[366] 좁힘 항목(chronology.json units — Claude 확정) — { unit, piece, at[[관계, 기준, 간격?]], years, basis[], reason, confidence, session, note }. at이 없으면(빈 배열은 compact가 뺀다) "단서 없음 — 시점 불명"을 확인한 표시
 * }
 * 기록 · 이유 문장은 publishText로 인용을 검사한다. 축의 점 수와 CSV의 lo · hi 범위가 맞는지, 판별 단위의 place가 같은 축 라벨인지 확인해 어긋나면 경고한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, compact, list, num, publishText } from '../lib.mjs';
import { kindId, meetList } from './common.mjs';

export const name = 'chrono';

const CHRONOLOGY = path.join(ROOT, 'annotations/chronology.json');

/** 점 i 사이 칸 라벨 — chrono.mjs label()과 같은 규칙(검증용) */
function labelOf(points, pos) {
  const P = points.length;
  if (pos % 2 === 1) return points[(pos - 1) / 2]?.id ?? '?';
  if (pos <= 0) return `${points[0]?.id ?? '?'} 전`;
  if (pos >= 2 * P) return `${points[P - 1]?.id ?? '?'} 뒤`;
  return `${points[pos / 2 - 1].id}–${points[pos / 2].id}`;
}

export async function run(ctx) {
  const { csv, warn, common } = ctx;
  const text = (v, where) => publishText(v, where, warn);

  // ── 작중 축 — 시대 기준점 + 메인 챕터(번호 순) ──
  const chron = JSON.parse(fs.readFileSync(CHRONOLOGY, 'utf8'));
  const eras = Array.isArray(chron.eras) ? chron.eras : [];
  const mains = common.units.filter((u) => u.kind === 'main').sort((a, b) => a.num - b.num);
  const points = [
    ...eras.map((e) => compact({ id: e.id, era: true, name: e.name, years: typeof e.years === 'number' ? e.years : undefined, basis: Array.isArray(e.basis) ? e.basis : undefined, reason: text(e.reason, `${e.id} reason`) })),
    ...mains.map((u) => ({ id: u.key, name: u.name })),
  ].map((p, i) => ({ pos: 2 * i + 1, ...p }));
  const maxPos = 2 * points.length;
  const posOf = new Map(points.map((p) => [p.id, p.pos]));
  // 시대 기준점이 처음 드러난 자리(W15b) — 근거 시점 기록(basis)과 그 기준점을 기준 · 때로 든 시점 기록 S의 스토리. 그 앞에서는 이름 · 햇수를 숨긴다
  const recById = new Map(common.records.map((r) => [r.id, r]));
  for (const p of points) {
    if (!p.era) continue;
    const refers = common.records.filter((r) => r.kind === 'S' && JSON.stringify([r.ref ?? null, r.at ?? null]).includes(`"${p.id}"`));
    const keys = [...(p.basis ?? []).map((id) => recById.get(id)?.unit), ...refers.map((r) => r.unit)].filter(Boolean);
    p.meet = meetList(keys, common.units);
    if (!p.meet) warn({ where: 'chrono', msg: `시대 기준점 ${p.id}: 드러난 스토리를 못 찾았다 — 읽는 중에는 이름을 늘 숨긴다` });
  }

  // ── 입력 표 ──
  const rows = csv('data/views/timeline/chrono.csv');
  const orderRows = csv('data/views/timeline/chrono-order.csv');
  const pieceRows = csv('data/views/timeline/chrono-pieces.csv');
  const orderOf = new Map(orderRows.map((r) => [`${r.type === '지금' ? 'u' : 'p'}:${r.entry}`, r]));
  const timesOf = new Map();
  for (const s of common.records) if (s.kind === 'S' && s.time_kind === '기준점' && s.unit) (timesOf.get(s.unit) ?? timesOf.set(s.unit, []).get(s.unit)).push(s);
  const checkPos = (v, where) => {
    const n = num(v);
    if (n == null) return undefined;
    if (!Number.isInteger(n) || n < 0 || n > maxPos) warn({ where, msg: `작중 자리 ${n}가 축(0–${maxPos}) 밖이다 — 축의 점 수가 CSV와 다른가` });
    return n;
  };

  // ── 단위 ──
  let mismatch = 0;
  const units = rows.map((r) => {
    const o = orderOf.get(`u:${r.unit}`);
    const where = `chrono ${r.unit}`;
    if (!o) warn({ where, msg: 'chrono-order.csv에 없다' });
    const lo = checkPos(o?.lo ?? r.lo, where);
    const hi = checkPos(o?.hi ?? r.hi, where);
    if (r.class === '판별' && lo != null && lo === hi && r.place !== labelOf(points, lo)) mismatch++;
    const relations = r.relations || undefined;
    // 메인 챕터끼리 번호 순과 다른 기록(ch43 · ch44 — 앞 챕터와 같은 무렵) → 병행 표시. 그 챕터의 기준점 시점 기록이 다른 메인과 '무렵 · 동시'를 말하는 것
    let parallel;
    if (r.kind === '메인') {
      for (const s of timesOf.get(r.unit) ?? []) {
        const a = (s.at ?? []).find((x) => /^(무렵|동시|중)$/.test(x[0]) && posOf.has(x[1]) && x[1] !== r.unit && !x[1].startsWith('@'));
        if (a) { parallel = { with: a[1], record: s.id }; break; }
      }
    }
    return compact({
      unit: r.unit, class: r.class, place: r.place || undefined, lo, hi, via: r.via || undefined,
      records: list(r.records), pieces: list(r.pieces), flashbacks: list(r.flashbacks), relations,
      narrow: r.narrow || undefined, narrow_confidence: r.narrow_confidence || undefined,
      release_main: r.release_main || undefined, drift: r.drift || undefined, drift_gap: num(r.drift_gap) ?? undefined,
      seq: num(o?.seq) ?? undefined, slot: num(o?.slot) ?? undefined,
      multi: r.place?.includes(' / ') ? true : undefined, parallel,
    });
  });
  if (mismatch) warn({ where: 'chrono', msg: `판별 단위 ${mismatch}개의 place가 축 라벨과 다르다 — 축의 점(시대 기준점 · 메인 챕터) 순서를 chrono.mjs와 맞출 것` });
  const unitKeys = new Set(units.map((u) => u.unit));
  for (const u of common.units) if (!unitKeys.has(u.key)) warn({ where: `chrono ${u.key}`, msg: 'chrono.csv에 없는 단위' });
  for (const u of units) if (!kindId(u.unit) || kindId(u.unit) === 'other') warn({ where: `chrono ${u.unit}`, msg: '종류를 모르는 단위 키' });

  // ── 조각 ──
  const pieces = pieceRows.map((r) => {
    const o = orderOf.get(`p:${r.id}`);
    const where = `chrono piece ${r.id}`;
    if (!o) warn({ where, msg: 'chrono-order.csv에 없다' });
    return compact({
      id: r.id, unit: r.unit, kind: r.kind, class: r.class, place: r.place || undefined,
      lo: checkPos(r.lo, where), hi: checkPos(r.hi, where), years: r.years || undefined, relations: r.relations || undefined,
      narrow: r.narrow || undefined, narrow_confidence: r.narrow_confidence || undefined,
      text: text(r.text, `${where} text`), seq: num(o?.seq) ?? undefined, slot: num(o?.slot) ?? undefined,
    });
  });

  // ── 좁힘(X1c — Claude 확정) ──
  const narrows = (Array.isArray(chron.units) ? chron.units : []).map((n) => compact({
    unit: n.unit, piece: n.piece || undefined, at: Array.isArray(n.at) ? n.at : [], years: n.years ?? undefined,
    basis: Array.isArray(n.basis) ? n.basis : undefined, reason: text(n.reason, `narrow ${n.unit} reason`),
    confidence: n.confidence, session: n.session || undefined, note: text(n.note, `narrow ${n.unit} note`),
  }));
  for (const n of narrows) if (!unitKeys.has(n.unit)) warn({ where: `narrow ${n.unit}`, msg: '좁힘 항목의 단위가 chrono.csv에 없다' });
  for (const n of narrows) for (const a of n.at ?? []) if (typeof a[1] === 'string' && a[1].startsWith('@') && !posOf.has(a[1])) warn({ where: `narrow ${n.unit}`, msg: `모르는 시대 기준점 ${a[1]}` });

  return { files: { 'chrono.json': { points, units, pieces, narrows } } };
}
