/**
 * B2 — T4-8(인물 변화) 읽을 곳을 좁히는 자동 신호. 인물 × 단위(출시순)마다 이름표 · 말투(존댓말 · 반말) · 지휘관 호칭을 세고,
 * 앞 단위와 달라진 곳에 표시를 단다. 해석이 아니다 — 2회독이 표시된 단위를 읽고 인물 변화(D)로 적을지 정한다.
 *
 *   node tools/views/signals.mjs        → data/views/mentions/signals.csv · changes.csv (커밋한다)
 *   node tools/query.mjs signals 라피     인물 하나 — 단위별 표 + 표시
 *
 * 세는 법 (모두 그 인물이 이름표로 말한 줄 — 언급 DB speaks, 지휘관 Self는 빼고):
 *   - 이름표: 화면 이름표 그대로(`???`는 코드로 푼 줄이 `???(코드)`로 보인다). 앞 단위들에 없던 이름표가 나오면 표시.
 *   - 말투: 줄을 문장으로 나눠(. ! ? … ~ 줄바꿈) 문장 끝 낱말의 어미로 존댓말(요 · 죠 · ㅂ니다 · ㅂ니까 …) · 반말(다 · 야 · 어 · 지 · 냐 …) · 그 밖(명사 · 감탄사)을 가른다.
 *     존댓말 비율 = 존댓말 / (존댓말 + 반말). 판정한 문장이 MIN_SENTENCES 이상인 단위끼리 비교해 SHIFT 이상 달라지면 표시.
 *   - 호칭: 지휘관을 부를 법한 말(ADDRESS)의 수 — 인물 이름과 같은 경계 규칙(낱말 앞 · 꼬리 규칙 · 가장 긴 것). 누구를 부르는지는 안 가린다.
 *     `당신`을 뺀 호칭 가운데 MIN_ADDRESS번 이상 나온 가장 많은 것이 앞 단위의 그것과 다르면 표시.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../normalize/ensure-db.mjs';
import { COMMANDER, compilePersonNames } from '../normalize/mentions.mjs';
import { loadPlaces } from '../lib/mentions.mjs';
import { toCsv } from './draft.mjs';
import { MENTIONS_DIR } from './mentions.mjs';

export const ADDRESS = ['지휘관님', '지휘관', '주인님', '마스터', '오빠', '오라버니', '선배님', '선배', '형님', '아저씨', '선생님', '쌤', '보스', '여보', '당신'];
export const MIN_SENTENCES = 8;
export const SHIFT = 0.5;
export const MIN_ADDRESS = 3;

const isHangul = (c) => c >= '가' && c <= '힣';
const jong = (c) => (isHangul(c) ? (c.charCodeAt(0) - 0xac00) % 28 : -1);
const POLITE_END = /(?:요|용|염|죠|시오|소서|십쇼|세여|어여|와여|해여)$/;
const PLAIN_END = /(?:다|야|어|아|여|지|냐|니|자|라|해|래|게|네|군|나|까|걸|고|데|든|줘|봐|돼|와|워|져|쳐|켜|려|마|렴|세|랴|대|셈|임|음|함|됨)$/;

/** 문장 끝 낱말 → 'polite' | 'plain' | null */
export function sentenceStyle(word) {
  if (!word) return null;
  // ㅂ니다 · ㅂ니까 (합니다 · 입니까) — 그러니까 · 어디니까는 존댓말이 아니다
  const m = word.match(/(.)니[다까]$/);
  if (m && jong(m[1]) === 17) return 'polite';
  if (POLITE_END.test(word)) return 'polite';
  if (/니다$/.test(word)) return 'polite';
  if (/니까$/.test(word)) return null; // 그러니까 · 가니까 — 이음말
  if (PLAIN_END.test(word)) return 'plain';
  return null;
}

/** 대사 한 줄 → 문장별 말투 */
export function lineStyles(text) {
  const out = [];
  for (const part of String(text).split(/[.!?…~♪♡♥\n]+/)) {
    const words = part.match(/[가-힣]+/g);
    if (!words) continue;
    out.push(sentenceStyle(words.at(-1)));
  }
  return out;
}

/** @param {{ target?: string }} [opt] 인물 하나만 */
export async function buildSignals(db, { target } = {}) {
  const places = await loadPlaces(db);
  const lines = db.prepare(
    `SELECT l.story_id, l.seq, l.speaker_target t, l.speaker_name, l.speaker_via, l.text
       FROM lines l JOIN stories s ON s.id = l.story_id
      WHERE s.in_scope = 1 AND l.speaker_target IS NOT NULL AND l.speaker_target <> ? ${target ? 'AND l.speaker_target = ?' : ''}
      ORDER BY l.story_id, l.seq`,
  ).all(COMMANDER, ...(target ? [target] : []));
  const matchAddress = compilePersonNames(ADDRESS.map((a) => ({ key: a, name: a })));
  const names = new Map(db.prepare("SELECT id, name FROM targets WHERE type = 'person'").all().map((t) => [t.id, t.name]));
  const cells = new Map(); // `${t}\t${unit}` → 칸
  for (const l of lines) {
    const unit = places.unitOf(l.story_id);
    if (!unit) continue;
    const k = `${l.t}\t${unit}`;
    let c = cells.get(k);
    if (!c) cells.set(k, (c = { target: l.t, name: names.get(l.t) ?? l.t, unit, order: places.unitPos.get(unit), lines: 0, polite: 0, plain: 0, other: 0, labels: new Map(), address: new Map() }));
    c.lines++;
    for (const s of lineStyles(l.text)) c[s ?? 'other']++;
    const label = l.speaker_via === '코드' ? `${l.speaker_name}(코드)` : l.speaker_name;
    c.labels.set(label, (c.labels.get(label) ?? 0) + 1);
    for (const a of matchAddress(l.text).hits) c.address.set(a, (c.address.get(a) ?? 0) + 1);
  }
  const byTarget = new Map();
  for (const c of cells.values()) (byTarget.get(c.target) ?? byTarget.set(c.target, []).get(c.target)).push(c);

  const rows = [];
  const changes = [];
  const ratio = (c) => (c.polite + c.plain ? c.polite / (c.polite + c.plain) : null);
  const dominant = (c) => {
    const xs = [...c.address].filter(([a, n]) => a !== '당신' && n >= MIN_ADDRESS).sort((x, y) => y[1] - x[1]);
    return xs[0]?.[0] ?? null;
  };
  const pct = (r) => `${Math.round(r * 100)}%`;
  for (const [t, cs] of [...byTarget].sort((a, b) => a[0].localeCompare(b[0]))) {
    cs.sort((a, b) => a.order - b.order);
    const seenLabels = new Set();
    let lastStyle = null; // { unit, r }
    let lastAddr = null; // { unit, a }
    cs.forEach((c, i) => {
      const flags = [];
      for (const label of c.labels.keys()) {
        if (i > 0 && !seenLabels.has(label)) {
          flags.push(`이름표 ${label}`);
          changes.push({ target: t, name: c.name, order: c.order, unit: c.unit, signal: '이름표', before: [...seenLabels].join(' · '), after: label, since: '' });
        }
      }
      for (const label of c.labels.keys()) seenLabels.add(label);
      const r = ratio(c);
      if (r !== null && c.polite + c.plain >= MIN_SENTENCES) {
        if (lastStyle && Math.abs(r - lastStyle.r) >= SHIFT) {
          flags.push(`존댓말 ${pct(lastStyle.r)}→${pct(r)}`);
          changes.push({ target: t, name: c.name, order: c.order, unit: c.unit, signal: '말투', before: pct(lastStyle.r), after: pct(r), since: lastStyle.unit });
        }
        lastStyle = { unit: c.unit, r };
      }
      const a = dominant(c);
      if (a) {
        if (lastAddr && lastAddr.a !== a) {
          flags.push(`호칭 ${lastAddr.a}→${a}`);
          changes.push({ target: t, name: c.name, order: c.order, unit: c.unit, signal: '호칭', before: lastAddr.a, after: a, since: lastAddr.unit });
        }
        lastAddr = { unit: c.unit, a };
      }
      rows.push({
        target: t, name: c.name, order: c.order, unit: c.unit, lines: c.lines, polite: c.polite, plain: c.plain, other: c.other,
        polite_ratio: r === null ? '' : r.toFixed(2),
        labels: [...c.labels].sort((x, y) => y[1] - x[1]).map(([l, n]) => `${l} ${n}`).join(' · '),
        address: [...c.address].sort((x, y) => y[1] - x[1]).map(([l, n]) => `${l} ${n}`).join(' · '),
        flags: flags.join(' / '),
      });
    });
  }
  return { rows, changes };
}

export const SIGNAL_COLUMNS = {
  rows: ['target', 'name', 'order', 'unit', 'lines', 'polite', 'plain', 'other', 'polite_ratio', 'labels', 'address', 'flags'],
  changes: ['target', 'name', 'order', 'unit', 'signal', 'before', 'after', 'since'],
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = await openDb();
  const v = await buildSignals(db);
  fs.mkdirSync(MENTIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(MENTIONS_DIR, 'signals.csv'), toCsv(v.rows, SIGNAL_COLUMNS.rows));
  fs.writeFileSync(path.join(MENTIONS_DIR, 'changes.csv'), toCsv(v.changes.sort((a, b) => a.order - b.order || a.target.localeCompare(b.target)), SIGNAL_COLUMNS.changes));
  const by = {};
  for (const c of v.changes) by[c.signal] = (by[c.signal] ?? 0) + 1;
  console.log(`data/views/mentions/signals.csv ${v.rows.length}행 · changes.csv ${v.changes.length}행 (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · ')})`);
  db.close();
}
