/**
 * W16a — 픽업 이벤트(필그림 · 오버스펙 픽업 이벤트): 종류 갈래(units.json group)의 '픽업 이벤트'.
 *
 *   node tools/notices/major-events.mjs
 *
 * 입력: 공식 공지(data/raw/notices — 받아 둔 캐시만, 요청하지 않는다) · 게임 니케 목록(data/raw/character/ko/nikke_list_v2.json) ·
 *       data/release/release-order.csv(출시 순서) · DB 대사 줄(픽업 니케가 그 이벤트에 나오나)
 * 출력: data/release/major-events.csv  한 줄 = 픽업 니케 하나 × 후보 이벤트 하나(뽑힌 것 major=1, 떨어진 것은 이유와 함께 0)
 *
 * 규칙(모두 기계적이다 — 해석하지 않는다. 사용자 2026-10-14: 주년 · 신년 · 여름의 1% 픽업 이벤트를 따로 표시, 중요도 판정은 그대로):
 *   - 픽업 니케 = 게임 데이터 소속이 PILGRIM인 니케 + 공지에서 [오버스펙] 표시가 붙은 신규 니케("SSR 니케 [이름]" 절).
 *   - 첫 모집일 = release-order.csv의 호감도 줄 날짜(재모집은 첫 모집이 아니다). 출시 로스터(출시일)는 픽업 이벤트가 없어 후보가 안 생긴다.
 *   - 후보 = 첫 모집일 D에 대해 출시일이 D-12일 ~ D+3일인 이벤트(신년 픽업은 1월 1일, 이벤트는 12월 말에 연다 — 2023 · 2024 · 2026 신년).
 *   - 후보 가운데 픽업 니케 이름(전체 이름 · ' : ' 앞 본래 이름 · 뒤 판 이름)이 이름표 · 대사에 든 줄이 가장 많은 이벤트 하나를 고른다.
 *     MIN_LINES줄 미만이면 아무것도 고르지 않는다(픽업 니케가 안 나오는 같은 철 이벤트 — BRAND NEW YEAR · CHERRY BLOSSOM).
 *   - 이벤트 유실물 · 미니게임 · 필드 대화(erelic:)는 딸린 이벤트를 따른다 — 내보내기(tools/site/export/common.mjs)가 읽는 순서에서 바로 앞 이벤트로 잇는다.
 * 결정 docs/decisions.md #10 · 문서 docs/views.md "픽업 이벤트 · 종류 갈래".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNotices } from './text.mjs';
import { RELEASE_DIR, RELEASE_CSV } from './release-order.mjs';
import { openDb } from '../normalize/ensure-db.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NIKKE_LIST = path.join(ROOT, 'data/raw/character/ko/nikke_list_v2.json');
export const MAJOR_CSV = path.join(RELEASE_DIR, 'major-events.csv');
export const COLUMNS = ['event', 'event_date', 'event_name', 'major', 'pickup', 'pickup_kind', 'pickup_date', 'lines', 'note'];
const WINDOW = { before: 12, after: 3 };
const MIN_LINES = 50;
/** 게임 출시일(한국 2022-11-04) — 주년 · 반주년(annivOf)의 기준 */
export const LAUNCH = '2022-11-04';
const ANNIV_DAYS = 15;

/**
 * 주년 · 반주년 — 이벤트 출시일이 출시일에서 반년 단위 자리(N주년 · N.5주년) ±15일 안이면 그 수(1 · 1.5 …), 아니면 null.
 * 기계 규칙이다: 지금 픽업 이벤트 12편 가운데 7편이 들고, 모두 공지가 그 주년(1 · 2 · 3주년 · 하프 0.5 · 1.5 · 2.5 · 3.5주년)으로 소개한다(2026-10-14 확인).
 * @param {string} date YYYY-MM-DD
 */
export function annivOf(date) {
  const d = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(d)) return null;
  const [y, m, day] = LAUNCH.split('-').map(Number);
  for (let half = 1; half <= 40; half++) {
    const mark = Date.UTC(y, m - 1 + half * 6, day);
    if (Math.abs(d - mark) <= ANNIV_DAYS * 86400e3) return half / 2;
    if (mark - d > ANNIV_DAYS * 86400e3) break;
  }
  return null;
}

/** CSV 한 줄 → 칸(따옴표 칸 지원) */
export function parseCsvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
const readCsv = (file) => {
  const [head, ...rows] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const cols = parseCsvLine(head);
  return rows.map((l) => Object.fromEntries(parseCsvLine(l).map((v, i) => [cols[i], v])));
};
const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

/** 픽업 이벤트 표 읽기 — 내보내기 · 테스트가 쓴다. 돌려주는 것: Map(이벤트 키 → 픽업 니케 이름[]) */
export function loadMajorEvents(file = MAJOR_CSV) {
  const out = new Map();
  if (!fs.existsSync(file)) return out;
  for (const r of readCsv(file)) if (r.major === '1') (out.get(r.event) ?? out.set(r.event, []).get(r.event)).push(r.pickup);
  return out;
}

/** 공지의 [오버스펙] 표시 → 그 절의 니케 이름들(가장 가까운 앞 "SSR 니케 [이름]") */
export function overspecNames(notices) {
  const names = new Set();
  for (const n of notices) {
    let last = null;
    for (const line of n.lines) {
      const m = /SSR\s*니케\s*\[([^\]]+)\]/.exec(line);
      if (m) last = m[1].trim();
      if (line.includes('[오버스펙]') && last) names.add(last);
    }
  }
  return names;
}

/** 이름 → 찾을 낱말들: 전체 · ' : ' 앞 본래 이름 · 뒤 판 이름 */
const nameParts = (name) => [...new Set([name, ...name.split(/\s*:\s*/)].map((s) => s.trim()).filter((s) => s.length >= 2))];

const day = (s) => Date.parse(`${s}T00:00:00Z`) / 864e5;

async function main() {
  const pilgrim = new Set(JSON.parse(fs.readFileSync(NIKKE_LIST, 'utf8')).filter((x) => x.corporation === 'PILGRIM').map((x) => x.name_localkey?.name).filter(Boolean));
  const overspec = overspecNames(loadNotices());
  const rows = readCsv(RELEASE_CSV);
  const events = rows.filter((r) => r.kind === 'event');
  const picks = rows.filter((r) => r.kind === 'episode' && (pilgrim.has(r.name) || overspec.has(r.name)));
  const missing = [...overspec].filter((n) => !rows.some((r) => r.kind === 'episode' && r.name === n));
  const db = await openDb();
  const scenesOf = db.prepare(`SELECT s.id FROM stories s JOIN categories c ON c.id = s.category_id WHERE c.id_prefix = ? OR c.id = ?`);
  // 본문 없는 블라링크 이벤트를 대신하는 금서고 단위(game_key) — 단위 키도 그쪽(BOOM! THE GHOST! → fl:boom_the_ghost)
  const libraryOf = new Map(db.prepare(`SELECT id, game_key FROM categories WHERE game_key IS NOT NULL AND game_key <> ''`).all().map((r) => [r.game_key, r.id]));
  const unitKey = (key) => libraryOf.get(key) ?? key;
  const countIn = (key, words) => {
    const ids = scenesOf.all(unitKey(key), unitKey(key)).map((r) => r.id);
    if (!ids.length) return 0;
    const like = words.map(() => '(l.speaker_name LIKE ? OR l.text LIKE ?)').join(' OR ');
    const sql = `SELECT COUNT(*) n FROM lines l WHERE l.story_id IN (${ids.map(() => '?').join(',')}) AND (${like})`;
    return db.prepare(sql).get(...ids, ...words.flatMap((w) => [`%${w}%`, `%${w}%`])).n;
  };
  const out = [];
  for (const p of picks) {
    const d = day(p.date);
    const cands = events.filter((e) => day(e.date) >= d - WINDOW.before && day(e.date) <= d + WINDOW.after)
      .map((e) => ({ e, lines: countIn(e.key, nameParts(p.name)) }))
      .sort((a, b) => b.lines - a.lines);
    const best = cands[0] && cands[0].lines >= MIN_LINES ? cands[0] : null;
    for (const c of cands) {
      const major = c === best;
      const note = major ? '' : best ? `같은 철 ${best.e.name}에 더 많이 나온다` : `픽업 니케가 ${MIN_LINES}줄 미만`;
      out.push({ event: unitKey(c.e.key), event_date: c.e.date, event_name: c.e.name, major: major ? 1 : 0, pickup: p.name,
        pickup_kind: pilgrim.has(p.name) ? '필그림' : '오버스펙', pickup_date: p.date, lines: c.lines, note });
    }
  }
  db.close?.();
  out.sort((a, b) => a.pickup_date.localeCompare(b.pickup_date) || b.major - a.major || a.event_date.localeCompare(b.event_date));
  fs.writeFileSync(MAJOR_CSV, [COLUMNS.join(','), ...out.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
  const major = new Map();
  for (const r of out) if (r.major) (major.get(r.event_name) ?? major.set(r.event_name, []).get(r.event_name)).push(r.pickup);
  console.log(`픽업 이벤트 ${major.size}편 — 픽업 니케 ${picks.length}명(필그림 ${picks.filter((p) => pilgrim.has(p.name)).length} · 오버스펙 ${picks.filter((p) => !pilgrim.has(p.name)).length})`);
  for (const [e, ps] of major) console.log(`  ${e} ← ${ps.join(' · ')}`);
  for (const r of out.filter((x) => !x.major)) console.log(`  (뺌) ${r.event_name} ← ${r.pickup}: ${r.note}`);
  if (missing.length) console.log(`⚠ 출시 순서에 없는 오버스펙 니케: ${missing.join(' · ')}`);
  console.log(`→ ${path.relative(ROOT, MAJOR_CSV)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
