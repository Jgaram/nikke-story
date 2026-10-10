/**
 * 사이트 내보내기 공용 (W1) — CSV 읽기 · JSON 쓰기 · 인용 검사 · 허용 칼럼 고르기 · 기록 로딩.
 * 규칙은 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)" · CLAUDE.md "저작물 취급".
 *
 * 내보내기 모듈(tools/site/export/<name>.mjs)은 이 파일의 함수만으로 DB · CSV · 기록을 읽는다.
 * 대사 본문은 어디서도 읽지 않는다 — DB에서는 `pick()`의 허용 칼럼만, 기록에서는 우리가 쓴 문장만.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseCsv } from '../normalize/csv.mjs';
import { ROOT, loadDataset } from '../records/model.mjs';
import { threadMembership } from '../records/threads.mjs';

export { ROOT };

/** 따옴표 인용 길이 — 넘으면 경고(사람이 본다). 자르지 않는다 */
export const QUOTE_WARN = 40;

/** 레포 기준 경로(또는 절대 경로)의 CSV → 행 객체 배열 */
export function readCsv(file) {
  const p = path.isAbsolute(file) ? file : path.join(ROOT, file);
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

/** compact JSON으로 쓴다(끝 줄바꿈 하나). 쓴 바이트 수를 돌려준다 */
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify(data)}\n`;
  fs.writeFileSync(file, text);
  return Buffer.byteLength(text);
}

/** CSV 칸 → 숫자(빈 칸은 null, 숫자가 아니면 그대로) */
export function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

/** CSV의 공백으로 나뉜 목록 칸 → 배열 */
export const list = (v) => (typeof v === 'string' && v.trim() ? v.trim().split(/\s+/) : []);

/** 빈 값(null · undefined · '' · 빈 배열)을 뺀 객체 — JSON을 작게 */
export function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/**
 * 허용 칼럼만 고른다 — DB 행을 내보낼 때 쓴다. 허용 목록에 없는 칸은 값이 있어도 버린다(본문 칸은 처음부터 SELECT하지 않는다).
 * @param {object} row
 * @param {string[]} allow 허용 칼럼 이름
 * @param {Record<string,string>} [rename] 칼럼 → 내보낼 키
 */
export function pick(row, allow, rename = {}) {
  const out = {};
  for (const k of allow) {
    if (!(k in row)) continue;
    const v = row[k];
    if (v === null || v === undefined) continue;
    out[rename[k] ?? k] = v;
  }
  return out;
}

/** 짝이 있는 따옴표. 곧은 따옴표(" ')는 홀짝으로 짝짓는다 — 영문 단어 속 아포스트로피(don't)는 뺀다 */
const DIRECTED = [['“', '”'], ['‘', '’'], ['「', '」'], ['『', '』']];
const STRAIGHT = ['"', "'"];

/**
 * 글 속 따옴표 인용 목록 — [{ start, end, inner }] (start · end는 따옴표를 포함한 구간)
 * @param {string} text
 */
export function quotesIn(text) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  for (const [open, close] of DIRECTED) {
    let i = 0;
    while ((i = text.indexOf(open, i)) >= 0) {
      const j = text.indexOf(close, i + 1);
      if (j < 0) break;
      out.push({ start: i, end: j + 1, inner: text.slice(i + 1, j) });
      i = j + 1;
    }
  }
  for (const q of STRAIGHT) {
    const idx = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== q) continue;
      if (q === "'" && /[A-Za-z0-9]/.test(text[i - 1] ?? '') && /[A-Za-z]/.test(text[i + 1] ?? '')) continue;
      idx.push(i);
    }
    for (let k = 0; k + 1 < idx.length; k += 2) out.push({ start: idx[k], end: idx[k + 1] + 1, inner: text.slice(idx[k] + 1, idx[k + 1]) });
  }
  return out.sort((a, b) => a.start - b.start);
}

const chars = (s) => [...s].length;

/**
 * 인용이 QUOTE_WARN자를 넘는 곳 — 경고 목록. where는 호출자가 붙이는 자리 표시(기록 ID · 칸)
 * @returns {{ where: string, length: number, quote: string }[]}
 */
export function quoteWarnings(text, where = '', limit = QUOTE_WARN) {
  return quotesIn(text)
    .filter((q) => chars(q.inner) > limit)
    .map((q) => ({ where, length: chars(q.inner), quote: `${[...q.inner].slice(0, 30).join('')}…` }));
}

/**
 * 글 하나를 내보낼 모양으로 — 긴 인용 경고를 모은다(자르지 않는다 — 길이는 우리가 지킨다, 사용자 2026-10-10). warn(obj)은 export.mjs가 준다
 * @param {string|null|undefined} text
 * @param {string} where
 * @param {(w: { where: string, length: number, quote: string }) => void} [warn]
 */
export function publishText(text, where, warn) {
  if (typeof text !== 'string') return text ?? null;
  if (warn) for (const w of quoteWarnings(text, where)) warn(w);
  return text;
}

/**
 * 기록 로딩 래퍼 — annotations/ 전체(1회독 · 2회독 · 줄기 · 층 · 주역 · 척추 · 마무리 · 수동 엣지)를 한 번 읽는다.
 * ds.candidates의 모양은 tools/records/model.mjs collect() 머리말. 확정만 쓰려면 `confirmed`.
 */
export function loadRecords() {
  const ds = loadDataset();
  const membership = threadMembership(ds);
  const confirmed = ds.candidates.filter((c) => c.status === '확정');
  const byId = new Map(confirmed.filter((c) => c.id).map((c) => [c.id, c]));
  return { ds, membership, confirmed, byId, problems: ds.problems };
}

/** 근거 [{scene, lines}] → 첫 씬 · 첫 줄 번호. 줄은 숫자이거나 "12-17" 범위 문자열 */
export function firstRef(evidence) {
  const ev = Array.isArray(evidence) ? evidence[0] : null;
  if (!ev?.scene) return { scene: null, line: null };
  const first = Array.isArray(ev.lines) ? ev.lines[0] : null;
  const line = first == null ? null : Number(String(first).split('-')[0]);
  return { scene: ev.scene, line: Number.isFinite(line) ? line : null };
}

/** 근거를 내보낼 모양으로 — [{ scene, lines }] (lines는 숫자 · "a-b" 그대로). 기록 ID 배열(줄기 관계의 evidence)은 그대로 */
export function evidenceOut(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .filter((e) => e && typeof e === 'object' && e.scene)
    .map((e) => ({ scene: e.scene, lines: Array.isArray(e.lines) ? e.lines : [] }));
}

/** 입력 지문 — data/views · annotations · DB meta의 경로 · 크기 · 수정 시각(내용이 아니라 stat) */
export function inputsFingerprint(db) {
  const entries = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const st = fs.statSync(p);
        entries.push(`${path.relative(ROOT, p)}\t${st.size}\t${Math.trunc(st.mtimeMs)}`);
      }
    }
  };
  for (const d of ['data/views', 'annotations']) walk(path.join(ROOT, d));
  entries.sort();
  const meta = db ? db.prepare("SELECT value FROM meta WHERE key = 'inputs'").get()?.value ?? '' : '';
  return crypto.createHash('sha1').update(`${meta}\n${entries.join('\n')}`).digest('hex');
}
