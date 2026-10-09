/**
 * X3e — 중요도 판정(X3f 확정)을 외부 참고 표(시트 ★)와 견준다. 참고로만 본다 — 어긋나도 판정을 고치지 않는다(docs/reference-table.md).
 *
 *   node tools/views/sheet-compare.mjs   → data/raw/imported/importance-compare.md (커밋한다)
 *
 * 분석 · 판정 세션은 이 도구와 결과를 열지 않는다(CLAUDE.md "외부 참고 표"). draft.mjs도 부르지 않는다 — 판정을 다 확정한 뒤(X3e · N3 마감)에만 돌린다.
 *
 * 짝짓기: 시트 행(sheet_rows — 범례 행 빼고) → 대상(category, story면 그 category) → 출시순 키(releases.key) → 판정 단위(data/views/importance/units.csv)
 *   · 척추(annotations/spine.json 확정). 블라링크 키가 금서고로 대신된 단위(event_forrest → fl:for_rest)는 annotations/forbidden-library-events.json으로 잇는다.
 * 견주는 짝: 필수 ↔ ★★★ · 보강 ↔ ★★ · 참고 ↔ ★ · 독립 ↔ 빈칸, 척추는 ★★★ 쪽(채점하지 않는 기준). 시트의 콜라보 · 만우절 표시는 등급이 아니라 따로 센다.
 * 메인 챕터는 채점하지 않아 뺀다. 서브퀘스트 · 유실물은 시트에 없다(짝 없음으로 센다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../records/model.mjs';
import { parseCsv } from '../normalize/csv.mjs';
import { openDb } from '../normalize/ensure-db.mjs';

const OUT = path.join(ROOT, 'data/raw/imported/importance-compare.md');
const STARS = ['★★★', '★★', '★', ''];
const MARKS = ['콜라보', '만우절'];
const GRADES = ['척추', '필수', '보강', '참고', '독립'];
const LEVEL = { 척추: 3, 필수: 3, 보강: 2, 참고: 1, 독립: 0, '★★★': 3, '★★': 2, '★': 1, '': 0 };

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const units = parseCsv(fs.readFileSync(path.join(ROOT, 'data/views/importance/units.csv'), 'utf8'));
const byUnit = new Map(units.map((u) => [u.unit, u]));
const spine = new Map(readJson('annotations/spine.json').spine.filter((b) => b.status === '확정').map((b) => [b.unit, b]));
const flBack = new Map(Object.entries(readJson('annotations/forbidden-library-events.json'))
  .filter(([k, v]) => !k.startsWith('_') && v).map(([k, v]) => [v, `fl:${path.basename(k, '.txt')}`]));

const db = await openDb();
const all = (sql, ...a) => db.prepare(sql).all(...a);
const releaseKey = new Map(all('SELECT category_id, key FROM releases').map((r) => [r.category_id, r.key]));
const storyCat = new Map(all('SELECT id, category_id FROM stories').map((s) => [s.id, s.category_id]));

const pairs = [], noUnit = [];
for (const r of all('SELECT * FROM sheet_rows WHERE COALESCE(is_legend, 0) = 0 ORDER BY row_index')) {
  if (r.sheet_type === '메인') continue;
  const cat = r.target_kind === 'story' ? (storyCat.get(r.target_id) ?? r.target_id) : r.target_id;
  let key = releaseKey.get(cat) ?? cat;
  if (!byUnit.has(key) && !spine.has(key) && flBack.has(key)) key = flBack.get(key);
  const star = r.importance ?? '';
  const grade = spine.has(key) ? '척추' : byUnit.get(key)?.grade;
  if (!grade) { noUnit.push({ key, star, title: r.title, type: r.sheet_type }); continue; }
  pairs.push({ key, star, grade, title: r.title, u: byUnit.get(key), b: spine.get(key) });
}
db.close?.();

const paired = new Set(pairs.map((p) => p.key));
const unpairedUnits = units.filter((u) => !paired.has(u.unit));
const count = (xs, f) => xs.reduce((m, x) => (m[f(x)] = (m[f(x)] ?? 0) + 1, m), {});
const graded = pairs.filter((p) => !MARKS.includes(p.star));
const gap = (p) => LEVEL[p.grade] - LEVEL[p.star];
const byGap = count(graded, gap);

const L = [];
L.push('# 중요도 판정 ↔ 외부 참고 표(시트 ★) 견줌 — X3e', '');
L.push('**참고로만 본다.** 판정(X3f 확정)은 원문 기록으로 했고, 시트를 입력 · 정답으로 쓰지 않았다. 어긋나도 판정을 고치지 않는다(docs/reference-table.md).');
L.push('분석 · 판정 세션은 이 파일을 열지 않는다. 만든 것: `node tools/views/sheet-compare.mjs`(판정 표 data/views/importance/units.csv + spine.json + DB sheet_rows).', '');
L.push('짝: 필수 ↔ ★★★ · 보강 ↔ ★★ · 참고 ↔ ★ · 독립 ↔ 빈칸, 척추는 ★★★ 쪽. 메인 챕터는 뺐다.', '');
L.push('## 교차표', '');
L.push(`| 판정 \\ 시트 | ${[...STARS.map((s) => s || '빈칸'), ...MARKS].join(' | ')} | 합 |`);
L.push(`|---|${[...STARS, ...MARKS].map(() => '---:').join('|')}|---:|`);
for (const g of GRADES) {
  const row = pairs.filter((p) => p.grade === g), c = count(row, (p) => p.star);
  L.push(`| ${g} | ${[...STARS, ...MARKS].map((s) => c[s] ?? '').join(' | ')} | ${row.length} |`);
}
const sc = count(pairs, (p) => p.star);
L.push(`| 합 | ${[...STARS, ...MARKS].map((s) => sc[s] ?? '').join(' | ')} | ${pairs.length} |`, '');
L.push(`- 짝지은 ${pairs.length}(척추 ${pairs.filter((p) => p.grade === '척추').length} · 판정 단위 ${pairs.length - pairs.filter((p) => p.grade === '척추').length}) — 시트가 등급을 단 ${graded.length} · 콜라보 · 만우절 표시 ${pairs.length - graded.length}.`);
L.push(`- 등급을 단 ${graded.length} 가운데 같은 칸 ${byGap[0] ?? 0} · 판정이 한 칸 위 ${byGap[1] ?? 0} · 두 칸 위 ${byGap[2] ?? 0} · 세 칸 위 ${byGap[3] ?? 0} · 한 칸 아래 ${byGap[-1] ?? 0} · 두 칸 아래 ${byGap[-2] ?? 0} · 세 칸 아래 ${byGap[-3] ?? 0}.`);
L.push(`- 판정 단위 가운데 시트에 없는 ${unpairedUnits.length}: ${Object.entries(count(unpairedUnits, (u) => u.kind)).map(([k, n]) => `${k} ${n}`).join(' · ')}.`);
L.push(`- 판정 단위로 못 이은 시트 행 ${noUnit.length}(범위 밖 콜라보 · 원문 없는 퀘스트): ${noUnit.map((x) => `${x.title}${x.star ? ` (${x.star})` : ''}`).join(' · ')}.`, '');

L.push('## 어긋난 칸 — 종류별', '');
L.push('| 판정 | 시트 | 수 | 종류 |', '|---|---|---:|---|');
const cells = count(graded.filter((p) => gap(p) !== 0), (p) => `${p.grade}|${p.star}`);
for (const [cell, n] of Object.entries(cells).sort((a, b) => b[1] - a[1])) {
  const [g, s] = cell.split('|');
  const kinds = count(graded.filter((p) => p.grade === g && p.star === s), (p) => p.u?.kind ?? '척추');
  L.push(`| ${g} | ${s || '빈칸'} | ${n} | ${Object.entries(kinds).map(([k, m]) => `${k} ${m}`).join(' · ')} |`);
}
L.push('');

const short = (t, n = 150) => (t.length > n ? `${t.slice(0, n)}…` : t);
const list = (title, f) => {
  const xs = graded.filter(f).sort((a, b) => Number(a.u?.order ?? 0) - Number(b.u?.order ?? 0));
  if (!xs.length) return;
  L.push(`## ${title} (${xs.length})`, '');
  for (const p of xs) L.push(`- \`${p.key}\` ${p.title} — 판정 ${p.grade}${p.u?.from ? `(from ${p.u.from})` : ''} · 시트 ${p.star || '빈칸'} · ${p.u?.judgment ?? p.b?.id}: ${short(p.u?.reason ?? p.b?.reason ?? '')}`);
  L.push('');
};
list('시트가 더 높은 것', (p) => gap(p) < 0);
list('판정이 두 칸 이상 높은 것', (p) => gap(p) >= 2);
list('판정 보강 · 시트 ★ (한 칸 위)', (p) => p.grade === '보강' && p.star === '★');
L.push('판정 참고 · 시트 빈칸(한 칸 위)은 수가 많아 목록을 싣지 않는다 — 위 "어긋난 칸" 표의 종류별 수 · data/views/importance/units.csv의 reason을 본다.', '');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${L.join('\n')}\n`);
console.log(`${path.relative(ROOT, OUT)} — 짝 ${pairs.length} · 같은 칸 ${byGap[0] ?? 0}/${graded.length}`);
