/**
 * T3-7 — 공개 순서(출시 순): 메인 챕터 · 사이드 스토리 · 이벤트 스토리 · 호감도 스토리를 공식 공지에서 날짜로 줄 세운다.
 *
 *   node tools/notices/release-order.mjs
 *
 * 입력: data/raw/notices/ (tools/notices/fetch.mjs가 받은 공식 공지) + 정규화 결과(단위 목록)
 * 출력: data/release/release-order.csv  한 줄 = 한 단위(챕터 · 이벤트 · 인물). 날짜순, 같은 날은 같은 순위
 *       data/release/report.md          공지에서 못 찾은 것 · 스토리 데이터에 없는 것 · 못 읽은 이름
 *
 * 읽는 규칙(모두 기계적이다 — 해석이 필요한 판단은 하지 않는다):
 *   - 출시일: 제목에 "정식 서비스 오픈"이 든 공지의 게시일(KST). 출시 때 열린 챕터 수는 출시 전 개발자 노트의
 *     "N챕터까지 준비" 줄에서 읽는다.
 *   - 메인: "메인 시나리오 N 챕터와 M 챕터가 신규 개방" 줄 → 그 공지의 업데이트 날짜(제목 "4월 23일 업데이트 공지").
 *   - 이벤트: "(신규) 스토리 이벤트 : 이름" · "스페셜 이벤트 : 이름" · "… 콜라보 이벤트 - 이름" · "이벤트 미션 [이름]"
 *     머리줄 → 그 절의 첫 기간 줄의
 *     시작일. 기간 줄이 없으면 업데이트 날짜. 한 단위 한 줄이고 첫 개방일을 쓴다. "Part N: STORY …" 파트 개방일은
 *     parts 칸에 참고로 남긴다(사용자, 2026-09-28).
 *     이름은 게임 ID(event_…)로 잇고, 안 이어지는 것은 tools/notices/aliases.json의 events(근거 포함)로 잇는다.
 *     표시명은 시트 제목을 빌린 라벨이라 잇는 데 쓰지 않는다(docs/reference-table.md).
 *     블라링크에 없는 이벤트는 금서고 단위(fl:…)의 금서고 목록 제목으로 잇는다. `2X2 LOVE 1부/2부`처럼 부가 나뉜 것은
 *     공지 한 줄에 모두 잇는다. 블라링크 이벤트를 대신하는 금서고 단위(game_key 있음)는 따로 줄을 두지 않는다.
 *   - 사이드 스토리: "사이드 스토리 - 이름" 머리줄 → 이벤트와 같은 식(첫 기간 줄, 없으면 업데이트 날짜).
 *     금서고 단위(side:…)의 제목으로 잇는다. 서브퀘스트 · 유실물은 공지에 개방 기록이 없어 넣지 않는다.
 *   - 호감도 스토리: 니케가 처음 모집(합류 · 참전)된 날 = 그 니케의 호감도 스토리가 열린 날로 본다.
 *     nikke-analysis build/releases.py의 규칙을 옮겼다: 번호 붙은 절마다 주인공(괄호 이름 또는 "SSR 니케 X")을 잡고,
 *     "…모집/픽업/획득 기간:" 줄의 시작일이 첫 등장이다. 재합류 · 선택 모집은 첫 등장이 아니다. 기간 없이 새로
 *     소개된 니케(이벤트 보상 등)는 업데이트 날짜. 공지에 도입 기록이 없는 니케는 출시 로스터로 보고 "추정"을 단다.
 *   - 공지로 날짜를 얻지 못하는 단위는 annotations/release-overrides.json의 손 보정(근거 포함)을 쓴다.
 *   - 같은 날은 같은 순위다(사용자, 2026-09-28). 같은 날 안의 나열 순서(메인 → 이벤트 → 인물)는 보기용일 뿐이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNotices } from './text.mjs';
import { findPoints, findSpanStarts, kstDay, stampKey } from './kdate.mjs';
import { ensureDb } from '../normalize/ensure-db.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NORMALIZED = path.join(ROOT, 'data/normalized');
export const RELEASE_DIR = path.join(ROOT, 'data/release');
export const RELEASE_CSV = path.join(RELEASE_DIR, 'release-order.csv');
const REPORT_MD = path.join(RELEASE_DIR, 'report.md');
const ALIASES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'aliases.json');
export const OVERRIDES = path.join(ROOT, 'annotations/release-overrides.json');

export const COLUMNS = [
  'rank', 'date', 'kind', 'key', 'category_id', 'name', 'basis', 'confidence', 'parts',
  'notice_id', 'notice_title', 'evidence',
];
const KIND_ORDER = { main: 0, side: 1, event: 2, episode: 3 };

// ── 공통 ────────────────────────────────────────────────────────────────

/** 번호 붙은 절 머리: "1. 신규 니케", "1.1 SSR 니케 [...]", "2-1. ...", "1) ...". (analysis와 같은 식) */
const HEADING_RE = /^\s*(?<num>\d{1,2}(?:[.\-]\d{1,2})*)(?:\s*[.)）]\s*|\s+)(?<rest>\S.*)$/;
const STRIP_RE = /[\s:：・·.,\-–—_'"()\[\]{}!?/\\]+/g;

/** 이름 비교 키: NFKC · 소문자 · 공백과 문장부호 제거. (analysis normalize_name과 같은 식) */
export const nameKey = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(STRIP_RE, '');

/** 업데이트 공지가 말하는 업데이트 날짜 — 제목의 날짜("4월 25일 업데이트 공지"), 없으면 게시일. */
function updateDay(notice) {
  const pub = kstDay(notice.publishedAt);
  return findPoints(notice.title, pub)[0]?.day ?? pub;
}

const clip = (s, n = 160) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** 줄에서 첫 날짜: 구간이면 시작, 아니면 첫 날짜. */
function firstStamp(line, refDay) {
  return findSpanStarts(line, refDay)[0] ?? findPoints(line, refDay)[0] ?? null;
}

// ── 출시일 · 메인 ──────────────────────────────────────────────────────

function findLaunch(notices) {
  const n = notices.find((x) => x.title.includes('정식 서비스 오픈'));
  if (!n) throw new Error('출시 공지("정식 서비스 오픈")를 찾지 못했다');
  const day = kstDay(n.publishedAt);
  let chapters = null;
  for (const pre of notices.filter((x) => kstDay(x.publishedAt) <= day)) {
    for (const line of pre.lines) {
      const m = line.match(/(\d{1,2})\s*챕터까지\s*준비/);
      if (m) chapters = { last: Number(m[1]), notice: pre, line };
    }
  }
  return { day, notice: n, chapters };
}

const MAIN_OPEN_RE = /메인\s*시나리오\s*(?<list>\d{1,2}(?:\s*(?:챕터)?\s*(?:와|과|및|,)\s*\d{1,2})*)\s*챕터가\s*신규\s*개방/;

function extractMain(notices) {
  const found = new Map(); // 챕터 번호 → { day, notice, line }
  for (const notice of notices) {
    for (const line of notice.lines) {
      const m = line.match(MAIN_OPEN_RE);
      if (!m) continue;
      const day = updateDay(notice);
      for (const num of m.groups.list.match(/\d{1,2}/g).map(Number)) {
        const prev = found.get(num);
        if (!prev || day < prev.day) found.set(num, { day, notice, line });
      }
    }
  }
  return found;
}

// ── 이벤트 ─────────────────────────────────────────────────────────────

const EVENT_HEAD_RES = [
  /^(?:[(（]?\d{1,2}(?:[.\-]\d{1,2})*\s*[.)）]?\s*)?(?:신규\s*)?(?:풀\s*보이스\s*|연애\s*시뮬레이션\s*)?(?:스토리|스페셜|스폐셜)\s*이벤트\s*[:：]\s*(?<name>.+)$/,
  /^(?:[(（]?\d{1,2}(?:[.\-]\d{1,2})*\s*[.)）]?\s*)?.{0,24}콜라보\s*이벤트\s*[-–:：]\s*(?<name>.+)$/,
  /^(?:[(（]?\d{1,2}(?:[.\-]\d{1,2})*\s*[.)）]?\s*)?.{0,10}이벤트\s*미션\s*\[(?<name>[^\]]+)\]\s*$/,
];
const SIDE_HEAD_RE = /^(?:[(（]?\d{1,2}(?:[.\-]\d{1,2})*\s*[.)）]?\s*)?사이드\s*스토리\s*[-–:：]\s*(?<name>.+)$/;
const PERIOD_LINE_RE = /(기간|오픈\s*시간|시작\s*시간)\s*[:：]/;
const PART_RE = /Part\s*(?<no>\d)\s*[:：]\s*(?<label>STORY\s*[IVX\d]+)/i;

/** "하이테크 토이(HIGHTECH TOY)" → 전체 · 괄호 안 · 괄호 밖을 모두 후보로. */
function nameCandidates(raw) {
  const out = [raw];
  const m = raw.match(/^(?<out>[^()（）]+)[(（](?<in>[^()（）]+)[)）]\s*$/);
  if (m) out.push(m.groups.in, m.groups.out);
  return out;
}

function eventHeading(line, heads = EVENT_HEAD_RES) {
  if (/(수정|개선|변경|추가)(하였|했|되었|됐)?습니다|현상/.test(line)) return null; // 개선사항 줄
  for (const re of heads) {
    const m = line.match(re);
    if (m) return m.groups.name.trim();
  }
  return null;
}

/** 이벤트(기본) 또는 사이드 스토리(heads = [SIDE_HEAD_RE]) 머리줄을 찾아 첫 개방일을 뽑는다 */
function extractEvents(notices, heads = EVENT_HEAD_RES) {
  const announced = []; // { name, day, time, basis, notice, evidence, parts[] }
  for (const notice of notices) {
    const refDay = kstDay(notice.publishedAt);
    const { lines } = notice;
    for (let i = 0; i < lines.length; i++) {
      const name = eventHeading(lines[i], heads);
      if (!name) continue;
      let start = null;
      let evidence = lines[i];
      const parts = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (HEADING_RE.test(line) || eventHeading(line, heads)) break;
        const part = line.match(PART_RE);
        if (part) {
          const dateLine = lines.slice(j + 1, j + 3).find((l) => PERIOD_LINE_RE.test(l));
          const s = dateLine && firstStamp(dateLine, refDay);
          if (s) parts.push(`${part.groups.label.replace(/\s+/g, ' ').toUpperCase()} ${s.day}`);
          continue;
        }
        if (!start && PERIOD_LINE_RE.test(line)) {
          const s = firstStamp(line, refDay);
          if (s) [start, evidence] = [s, line];
        }
      }
      announced.push({
        name,
        day: start?.day ?? updateDay(notice),
        time: start?.time ?? null,
        basis: start ? '기간 줄' : '업데이트 날짜',
        notice,
        evidence: start ? `${lines[i]} / ${evidence}` : lines[i],
        parts,
      });
    }
  }
  return announced;
}

/**
 * 공지 이름 → 단위. 아카이브 이벤트는 게임 ID로, 금서고 단위(이벤트 · 사이드 스토리)는 금서고 목록 제목으로 잇는다.
 * 한 이름이 여러 단위에 이어질 수 있다 — 금서고의 `2X2 LOVE 1부`와 `2부`는 공지 한 줄(2X2 LOVE)에 둘 다 이어진다.
 */
function matchEvents(announced, cats, aliases) {
  const byKey = new Map();
  const put = (k, cat) => {
    if (!k || !cat) return;
    if (!byKey.has(k)) byKey.set(k, []);
    if (!byKey.get(k).includes(cat)) byKey.get(k).push(cat);
  };
  for (const cat of cats.filter((c) => c.source === 'archive')) {
    const id = cat.idPrefix.replace(/^event_/, '');
    put(nameKey(id), cat); // event_BunnyX777 — 끝 숫자가 이름인 것
    put(nameKey(id.replace(/\d+$/, '')), cat); // event_miraclesnow1 — 끝 숫자가 붙은 것
  }
  for (const cat of cats.filter((c) => c.source !== 'archive')) {
    put(nameKey(cat.name), cat);
    put(nameKey(cat.name.replace(/\s*\d+\s*부$/, '')), cat); // 2X2 LOVE 1부 · 2부
  }
  for (const a of aliases) put(nameKey(a.notice), cats.find((c) => c.idPrefix === a.id || c.id === a.id));
  const best = new Map(); // category id → announcement
  const unmatched = [];
  for (const a of announced) {
    const hit = nameCandidates(a.name).map((c) => byKey.get(nameKey(c))).find(Boolean);
    if (!hit) {
      unmatched.push(a);
      continue;
    }
    for (const cat of hit) {
      const prev = best.get(cat.id);
      if (!prev || stampKey(a) < stampKey(prev)) best.set(cat.id, a);
    }
  }
  return { best, unmatched };
}

// ── 인물 (analysis build/releases.py) ──────────────────────────────────

const WINDOW_RE = /(?<label>[^:：\n]{0,30}(?:모집|획득|픽업)[^:：\n]{0,12}기간)\s*[:：]\s*(?<value>.+)/;
const BRACKET_RE = /\[([^\[\]]{1,40})\]/g;
const MARKER_RE = /(?<rarity>SSR|SR|R)\s*(?:니케|캐릭터|필그림)\s*\[?/;
const UNBRACKETED_MARKER_RE = /(?<rarity>SSR|SR|R)\s*(?:니케|캐릭터|필그림)\s*(?!\[)/g;
const GRADE_LINE_RE = /(?<rarity>SSR|SR|R)\s*등급의\s*니케/;
const QUOTED_RE = /[‘'"“]([^’'"”]{1,20})[’'"”]/g;
const JOIN_WORDS = ['합류', '참전'];
const REJOIN_WORDS = ['재합류', '재모집', '복각', '다시 합류'];
const NOT_DEBUT_SECTION_WORDS = ['코스튬', '패키지', '상품'];

const isJoinLine = (line) => JOIN_WORDS.some((w) => line.includes(w));
const isDebutSection = (title) =>
  title.includes('신규') && (title.includes('니케') || title.includes('캐릭터')) &&
  !NOT_DEBUT_SECTION_WORDS.some((w) => title.includes(w));

class UnitMatcher {
  constructor(characters, aliases) {
    this.byKey = new Map(); // 이름 키 → [character]
    const add = (key, c) => {
      if (!key) return;
      const list = this.byKey.get(key) ?? [];
      if (!list.includes(c)) list.push(c);
      this.byKey.set(key, list);
    };
    for (const c of characters) add(nameKey(c.name), c);
    const byId = new Map(characters.map((c) => [c.resourceId, c]));
    for (const a of aliases) if (byId.has(a.resourceId)) add(nameKey(a.notice), byId.get(a.resourceId));
    // 긴 이름부터 — "홍련 : 흑영"이 "홍련"보다 먼저 맞게
    this.keys = [...this.byKey.keys()].sort((a, b) => b.length - a.length);
  }

  /** 이름 하나 → 인물. 이름이 겹치면(사쿠라) 앞에 붙은 등급 표시(SSR/SR)로 가른다. */
  resolve(name, rarity) {
    const list = this.byKey.get(nameKey(name)) ?? [];
    if (list.length === 1) return list[0];
    const narrowed = rarity ? list.filter((c) => c.rarity === rarity) : [];
    return narrowed.length === 1 ? narrowed[0] : null;
  }

  subject(line) {
    const missing = [];
    for (const m of line.matchAll(BRACKET_RE)) {
      const before = line.slice(0, m.index).slice(-14);
      const rarity = before.match(MARKER_RE)?.groups.rarity;
      const unit = this.resolve(m[1], rarity);
      if (unit) return { unit, missing: [] };
      // 등급 표시 바로 뒤의 괄호 이름만 알리 가치가 있다(코스튬 · 보스 · 메뉴 경로는 아니다)
      if (MARKER_RE.test(before + '[')) missing.push(m[1]);
    }
    for (const m of line.matchAll(UNBRACKETED_MARKER_RE)) {
      const tail = nameKey(line.slice(m.index + m[0].length, m.index + m[0].length + 40));
      const key = this.keys.find((k) => tail.startsWith(k));
      const unit = key && this.resolve(key, m.groups.rarity);
      if (unit) return { unit, missing: [] };
    }
    return { unit: null, missing };
  }
}

function extractDebuts(notice, matcher) {
  const debuts = []; // { unit, day, time, basis, notice, evidence }
  const unresolved = [];
  const refDay = kstDay(notice.publishedAt);
  const st = { subject: null, intro: '', section: '', windows: 0, evidence: '' };

  const debutContext = () =>
    !REJOIN_WORDS.some((w) => st.intro.includes(w)) && (isDebutSection(st.section) || isJoinLine(st.intro));
  const close = () => {
    // 창 없이 새로 소개된 니케는 이벤트 · 출석 보상 등 — 업데이트와 함께 들어왔다
    if (st.subject && st.windows === 0 && debutContext()) {
      debuts.push({ unit: st.subject, day: updateDay(notice), time: null, basis: '업데이트 날짜', introduced: true, notice, evidence: st.evidence });
    }
  };
  const open = (unit, intro, evidence) => Object.assign(st, { subject: unit, intro: unit ? intro : '', windows: 0, evidence });

  for (const line of notice.lines) {
    const h = line.match(HEADING_RE);
    if (h) {
      close();
      if (!/[.\-]/.test(h.groups.num)) st.section = h.groups.rest;
      const { unit, missing } = matcher.subject(h.groups.rest);
      open(unit, h.groups.rest, line);
      unresolved.push(...missing.map((name) => ({ name, notice, line })));
      continue;
    }
    // 모집이 아닌 길로 들어온 니케: "'길티', '신', '퀀시'는 모두 SSR 등급의 니케이며, 모집을 통해 획득하실 수 없습니다."
    if (GRADE_LINE_RE.test(line) && !REJOIN_WORDS.some((w) => line.includes(w))) {
      for (const m of line.matchAll(QUOTED_RE)) {
        const unit = matcher.resolve(m[1], line.match(GRADE_LINE_RE).groups.rarity);
        if (unit) debuts.push({ unit, day: updateDay(notice), time: null, basis: '업데이트 날짜', introduced: true, notice, evidence: line });
      }
    }
    if (!st.subject && isJoinLine(line)) {
      const { unit, missing } = matcher.subject(line);
      open(unit, line, line);
      unresolved.push(...missing.map((name) => ({ name, notice, line })));
    } else if (st.subject && isJoinLine(line) && !isJoinLine(st.intro)) {
      st.intro = line;
    }
    const w = line.match(WINDOW_RE);
    if (!w || !st.subject) continue;
    const start = findSpanStarts(w.groups.value, refDay)[0];
    if (!start) continue;
    st.windows++;
    if (w.groups.label.includes('선택 모집') || !debutContext()) continue;
    debuts.push({ unit: st.subject, day: start.day, time: start.time, basis: '기간 줄', introduced: false, notice, evidence: `${st.evidence} / ${line}` });
  }
  close();
  return { debuts, unresolved };
}

// ── 조립 ────────────────────────────────────────────────────────────────

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function buildReleaseOrder({ log = console.log } = {}) {
  await ensureDb({ log: () => {} });
  const categories = readJson(path.join(NORMALIZED, 'categories.json'));
  const characters = readJson(path.join(NORMALIZED, 'characters.json'));
  const aliasFile = fs.existsSync(ALIASES) ? readJson(ALIASES) : {};
  const aliases = aliasFile.characters ?? [];
  const eventAliases = aliasFile.events ?? [];
  const notices = loadNotices();
  const launch = findLaunch(notices);
  const src = (n) => ({ notice_id: n.id, notice_title: n.title });

  const rows = [];
  const report = { mainMissing: [], sideMissing: [], eventMissing: [], eventUnmatched: [], charLaunch: [], unresolved: [] };

  // 메인
  const opened = extractMain(notices);
  for (const cat of categories.filter((c) => c.source === 'main')) {
    const num = Number(cat.localeKey?.match(/chapter_name_(\d+)/)?.[1]);
    const key = `ch${String(num).padStart(2, '0')}`;
    const base = { kind: 'main', key, category_id: cat.id, name: `CHAPTER.${String(num).padStart(2, '0')} ${cat.name ?? ''}`.trim(), parts: '' };
    const hit = opened.get(num);
    if (hit) {
      rows.push({ ...base, date: hit.day, basis: '업데이트 날짜', confidence: '확실', ...src(hit.notice), evidence: hit.line });
    } else if (launch.chapters && num <= launch.chapters.last) {
      rows.push({ ...base, date: launch.day, basis: '출시일', confidence: '확실', ...src(launch.chapters.notice), evidence: launch.chapters.line });
    } else {
      rows.push({ ...base, date: '', basis: '', confidence: '', notice_id: '', notice_title: '', evidence: '' });
      report.mainMissing.push(key);
    }
  }

  // 사이드 스토리 (금서고 단위 side:…)
  const sideCats = categories.filter((c) => c.source === 'fl-side');
  const sideBest = matchEvents(extractEvents(notices, [SIDE_HEAD_RE]), sideCats, []).best;
  for (const cat of sideCats) {
    const a = sideBest.get(cat.id);
    const base = { kind: 'side', key: cat.id, category_id: cat.id, name: cat.name, parts: '' };
    if (a) {
      rows.push({ ...base, date: a.day, basis: a.basis, confidence: '확실', ...src(a.notice), evidence: a.evidence });
    } else {
      rows.push({ ...base, date: '', basis: '', confidence: '', notice_id: '', notice_title: '', evidence: '' });
      report.sideMissing.push(cat);
    }
  }

  // 이벤트 — 블라링크 아카이브 + 블라링크에 없는 금서고 이벤트(블라링크 이벤트를 대신하는 것은 빼고)
  const eventCats = categories.filter((c) => c.source === 'archive' || (c.source === 'fl-event' && !c.gameKey));
  const announced = extractEvents(notices);
  const { best, unmatched } = matchEvents(announced, eventCats, eventAliases);
  for (const cat of eventCats) {
    const a = best.get(cat.id);
    const key = cat.source === 'archive' ? cat.idPrefix : cat.id;
    const base = { kind: 'event', key, category_id: cat.id, name: cat.name ?? key };
    if (a) {
      rows.push({ ...base, date: a.day, basis: a.basis, confidence: '확실', parts: a.parts.join('; '), ...src(a.notice), evidence: a.evidence });
    } else {
      rows.push({ ...base, date: '', basis: '', confidence: '', parts: '', notice_id: '', notice_title: '', evidence: '' });
      report.eventMissing.push(cat);
    }
  }
  const seenUnmatched = new Set();
  for (const a of unmatched) {
    const k = nameKey(a.name);
    if (seenUnmatched.has(k)) continue;
    seenUnmatched.add(k);
    report.eventUnmatched.push(a);
  }

  // 호감도 스토리 — 인물의 첫 등장
  const matcher = new UnitMatcher(characters, aliases);
  const firstDebut = new Map();
  const unresolvedSeen = new Set();
  for (const notice of notices) {
    const { debuts, unresolved } = extractDebuts(notice, matcher);
    for (const d of debuts) {
      const prev = firstDebut.get(d.unit.resourceId);
      // 같은 날이면 실제 모집 기간이 "업데이트 날짜" 대체값보다 앞선다
      const k = (x) => `${stampKey(x)}|${x.introduced ? 1 : 0}|${x.notice.publishedAt.toISOString()}`;
      if (!prev || k(d) < k(prev)) firstDebut.set(d.unit.resourceId, d);
    }
    for (const u of unresolved) {
      const k = nameKey(u.name);
      if (unresolvedSeen.has(k)) continue;
      unresolvedSeen.add(k);
      report.unresolved.push(u);
    }
  }
  const charById = new Map(characters.map((c) => [c.resourceId, c]));
  for (const cat of categories.filter((c) => c.source === 'episode')) {
    const c = charById.get(cat.resourceId);
    const d = firstDebut.get(cat.resourceId);
    const base = { kind: 'episode', key: cat.id, category_id: cat.id, name: c?.name ?? cat.name, parts: '' };
    if (d) {
      rows.push({ ...base, date: d.day, basis: d.basis, confidence: '확실', ...src(d.notice), evidence: d.evidence });
    } else {
      rows.push({ ...base, date: launch.day, basis: '출시 로스터', confidence: '추정', ...src(launch.notice), evidence: '공지에 도입 기록이 없다 — 출시 때부터 있던 니케로 본다' });
      report.charLaunch.push(base);
    }
  }

  // 손 보정 — 공식 공지로 날짜를 얻지 못하는 단위 (annotations/release-overrides.json)
  report.overrides = [];
  const overrides = fs.existsSync(OVERRIDES) ? readJson(OVERRIDES).overrides ?? [] : [];
  for (const o of overrides) {
    const row = rows.find((r) => r.key === o.key);
    if (!row) {
      report.overrides.push({ ...o, name: '(없는 키)', before: '' });
      continue;
    }
    const before = row.date ? `${row.date} (${row.basis})` : '날짜 없음';
    report.overrides.push({ ...o, name: row.name, before, conflict: row.date && !['출시 로스터'].includes(row.basis) && row.date !== o.date });
    Object.assign(row, { date: o.date, basis: '손 보정', confidence: o.confidence ?? '추정', notice_id: '', notice_title: '', evidence: o.source ?? '' });
  }
  const overridden = new Set(overrides.map((o) => o.key));
  report.mainMissing = report.mainMissing.filter((k) => !overridden.has(k));
  report.eventMissing = report.eventMissing.filter((c) => !overridden.has(c.idPrefix ?? c.id));
  report.sideMissing = report.sideMissing.filter((c) => !overridden.has(c.id));
  report.charLaunch = report.charLaunch.filter((r) => !overridden.has(r.key));

  // 순위: 같은 날 = 같은 순위(빽빽한 순위). 날짜 없는 줄은 맨 뒤, 순위 없음
  const numOf = (r) => (r.kind === 'main' ? Number(r.key.slice(2)) : 0);
  rows.sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999') ||
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
    numOf(a) - numOf(b) ||
    a.name.localeCompare(b.name, 'ko'));
  let rank = 0;
  let lastDate = null;
  for (const r of rows) {
    if (!r.date) {
      r.rank = '';
      continue;
    }
    if (r.date !== lastDate) [rank, lastDate] = [rank + 1, r.date];
    r.rank = rank;
  }
  for (const r of rows) r.evidence = clip(r.evidence ?? '');

  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  fs.writeFileSync(RELEASE_CSV, [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
  fs.writeFileSync(REPORT_MD, renderReport(rows, report, launch, notices.length));

  const count = (k) => rows.filter((r) => r.kind === k && r.date).length;
  const total = (k) => rows.filter((r) => r.kind === k).length;
  log(`메인 ${count('main')}/${total('main')} · 사이드 ${count('side')}/${total('side')} · 이벤트 ${count('event')}/${total('event')} · 호감도 ${count('episode')}/${total('episode')}` +
    ` (그중 출시 로스터 추정 ${report.charLaunch.length}) · 순위 ${rank}개 날짜`);
  log(`→ ${path.relative(ROOT, RELEASE_CSV)}, ${path.relative(ROOT, REPORT_MD)}`);
  return { rows, report };
}

function renderReport(rows, report, launch, noticeCount) {
  const lines = [];
  const dated = rows.filter((r) => r.date);
  const kinds = ['main', 'side', 'event', 'episode'];
  const label = { main: '메인 챕터', side: '사이드 스토리(금서고)', event: '이벤트(금서고 fl: 포함)', episode: '호감도 스토리(인물)' };
  lines.push('# 출시 순서 — 수집 보고', '');
  lines.push('`node tools/notices/release-order.mjs`가 만든다. 손으로 고치지 않는다.', '');
  lines.push(`공식 공지 ${noticeCount}건 · 출시일 ${launch.day} ("${launch.notice.title}")`, '');
  lines.push('| 종류 | 단위 | 날짜 있음 | 기간 줄 | 업데이트 날짜 | 출시일 · 출시 로스터 | 손 보정 |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const k of kinds) {
    const all = rows.filter((r) => r.kind === k);
    const by = (b) => all.filter((r) => r.basis === b).length;
    lines.push(`| ${label[k]} | ${all.length} | ${all.filter((r) => r.date).length} | ${by('기간 줄')} | ${by('업데이트 날짜')} | ${by('출시일') + by('출시 로스터')} | ${by('손 보정')} |`);
  }
  lines.push('', `서로 다른 날짜(순위) ${new Set(dated.map((r) => r.date)).size}개 · 첫 날 ${dated[0]?.date ?? '-'} · 마지막 날 ${dated.at(-1)?.date ?? '-'}`, '');

  lines.push('## 공지에서 날짜를 못 찾은 단위', '');
  if (!report.mainMissing.length && !report.sideMissing.length && !report.eventMissing.length) lines.push('없음.');
  for (const k of report.mainMissing) lines.push(`- 메인 ${k}`);
  for (const c of report.sideMissing) lines.push(`- 사이드 스토리 ${c.id} (${c.name})`);
  for (const c of report.eventMissing) lines.push(`- 이벤트 ${c.idPrefix ?? c.id} (${c.name})`);
  lines.push('');

  lines.push('## 출시 로스터로 본 인물 (추정)', '');
  lines.push('공지에 도입(합류 · 참전 · 신규 니케) 기록이 없어 출시 때부터 있던 니케로 봤다. 출시 뒤에 나왔는데 공지가',
    '남아 있지 않은 니케가 섞여 있을 수 있다.', '');
  lines.push(report.charLaunch.length ? report.charLaunch.map((r) => `${r.name}(${r.key})`).join(' · ') : '없음.', '');

  lines.push('## 공지에 나왔지만 스토리 데이터(블라링크 · 금서고)에 없는 이벤트', '');
  lines.push('블라링크 아카이브에도 금서고에도 원문이 없는 이벤트다(스토리 없는 미니게임 이벤트일 수 있다). 순서표에는 없다.',
    '있는 이벤트인데 이름이 달라 못 이은 것이면 `tools/notices/aliases.json`의 events에 근거와 함께 잇는다.', '');
  if (!report.eventUnmatched.length) lines.push('없음.');
  for (const a of report.eventUnmatched.sort((x, y) => x.day.localeCompare(y.day))) {
    lines.push(`- ${a.day} ${a.name} — ${a.notice.title}`);
  }
  lines.push('');

  lines.push('## 손 보정', '');
  lines.push('`annotations/release-overrides.json`에서 넣은 날짜. 공지로 날짜가 나오게 되면 보정 줄을 지운다.', '');
  if (!report.overrides.length) lines.push('없음.');
  for (const o of report.overrides) {
    lines.push(`- ${o.key} ${o.name}: ${o.date} (${o.confidence ?? '추정'}) ← 공지 결과 ${o.before}${o.conflict ? ' **⚠ 공지 날짜와 다르다**' : ''}`);
  }
  lines.push('');

  lines.push('## 못 읽은 인물 이름', '');
  lines.push('등급 표시("SSR 니케") 뒤 괄호 이름인데 인물 목록에 없는 것. 필요하면 `tools/notices/aliases.json`의 characters에 잇는다.', '');
  if (!report.unresolved.length) lines.push('없음.');
  for (const u of report.unresolved) lines.push(`- [${u.name}] — ${u.notice.title}: ${clip(u.line, 100)}`);
  lines.push('');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildReleaseOrder().catch((err) => {
    console.error(err.stack ?? err);
    process.exit(1);
  });
}
