/**
 * B2 — 언급 DB 자동 줄(speaks · named · alias)로 뽑는 등장 시안. 화면 5(인물별 집계) · 화면 1의 "등장"과 T3-3(첫 등장 = 도입 지점).
 *
 *   node tools/views/mentions.mjs        → data/views/mentions/ (커밋한다)
 *
 * 출력:
 *   targets.csv   대상별 — 등장 씬 수 · 단위 수 · 방식별 줄 수 · 처음 등장(아무 방식) · 처음 말함 · 처음 이름 · 마지막 등장 · 자동에서 뺀 이름 · 표본 정밀도
 *   units.csv     단위별 — 나온 대상 수(인물 · 비인물) · 처음 등장한 대상 수 · 미상 이름표 줄 수(2회독이 정체를 적을 줄)
 *   report.md     요약 · 표본 정밀도 · 자동에서 뺀 이름 · 처음 등장이 많은 단위
 * 읽는 순서는 1회독 순서(출시순 한 줄, docs/history/reading.md R). 2회독 암시 언급(I)은 아직 싣지 않는다 — X3이 tools/records/read2.mjs mentionRows로 합친다.
 * 원문 대사는 담지 않는다(이름 · 씬 ID · 수만).
 */
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../normalize/ensure-db.mjs';
import { appearances, loadPlaces } from '../lib/mentions.mjs';
import { kindOfKey } from '../records/order.mjs';
import { toCsv } from './draft.mjs';
import { ROOT } from '../records/model.mjs';

export const MENTIONS_DIR = path.join(ROOT, 'data/views/mentions');

const COLUMNS = {
  targets: ['target', 'type', 'kind', 'name', 'scenes', 'units', 'speaks', 'named', 'alias',
    'first_order', 'first_unit', 'first_scene', 'first_seq', 'first_how', 'first_speaks_unit', 'first_named_unit',
    'last_order', 'last_unit', 'last_scene', 'excluded_names', 'unit_names', 'precision'],
  units: ['order', 'unit', 'kind', 'scenes', 'persons', 'terms', 'new_persons', 'new_terms', 'unknown_lines'],
};

export async function buildMentionViews(db) {
  const places = await loadPlaces(db);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const app = appearances(db, places);
  const targets = new Map(all('SELECT id, type, kind, name FROM targets').map((t) => [t.id, t]));
  const names = new Map();
  for (const n of all('SELECT target_id, name, how, mention_mode, precision, lines_in_scope FROM target_names')) {
    (names.get(n.target_id) ?? names.set(n.target_id, []).get(n.target_id)).push(n);
  }

  const targetRows = [];
  for (const [id, t] of targets) {
    const a = app.get(id);
    const ns = names.get(id) ?? [];
    const row = {
      target: id, type: t.type, kind: t.kind, name: t.name,
      scenes: a?.scenes.size ?? 0, units: a?.units.size ?? 0,
      speaks: a?.lines.speaks ?? 0, named: a?.lines.named ?? 0, alias: a?.lines.alias ?? 0,
      first_order: a?.first?.pos[0] ?? '', first_unit: a?.first?.unit ?? '', first_scene: a?.first?.scene ?? '', first_seq: a?.first?.seq ?? '', first_how: a?.first?.how ?? '',
      first_speaks_unit: a?.firstSpeaks?.unit ?? '', first_named_unit: a?.firstNamed?.unit ?? '',
      last_order: a?.last?.pos[0] ?? '', last_unit: a?.last?.unit ?? '', last_scene: a?.last?.scene ?? '',
      excluded_names: ns.filter((n) => n.mention_mode === 'off').map((n) => n.name).join(' · '),
      unit_names: ns.filter((n) => n.mention_mode === 'unit').map((n) => n.name).join(' · '),
      precision: ns.filter((n) => n.precision).map((n) => `${n.name} ${n.precision}`).join(' · '),
    };
    targetRows.push(row);
  }
  targetRows.sort((x, y) => (Number(x.first_order) || 1e9) - (Number(y.first_order) || 1e9) || x.target.localeCompare(y.target));

  // 단위별 — 나온 대상 · 처음 등장 · 미상 이름표 줄
  const unitRows = new Map();
  for (const [key, pos] of places.unitPos) unitRows.set(key, { order: pos, unit: key, kind: kindOfKey(key), scenes: 0, persons: new Set(), terms: new Set(), new_persons: 0, new_terms: 0, unknown_lines: 0 });
  for (const [id, a] of app) {
    const person = id.startsWith('person:');
    for (const u of a.units.keys()) unitRows.get(u)?.[person ? 'persons' : 'terms'].add(id);
    if (a.first) unitRows.get(a.first.unit)[person ? 'new_persons' : 'new_terms']++;
  }
  const sceneUnit = new Map();
  for (const r of all("SELECT l.story_id, COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 AND l.speaker_class = '미상' GROUP BY l.story_id")) {
    const u = places.unitOf(r.story_id);
    if (u) unitRows.get(u).unknown_lines += r.n;
  }
  for (const s of all("SELECT id FROM stories WHERE in_scope = 1 AND has_text = 1")) {
    const u = places.unitOf(s.id);
    if (u) {
      unitRows.get(u).scenes++;
      sceneUnit.set(s.id, u);
    }
  }
  const units = [...unitRows.values()].map((u) => ({ ...u, persons: u.persons.size, terms: u.terms.size }));

  const precision = all(`SELECT n.target_id, n.name, n.how, n.precision, n.mention_mode, n.lines_in_scope FROM target_names n
    WHERE n.precision IS NOT NULL ORDER BY n.mention_mode DESC, n.target_id, n.name`);
  const totals = all("SELECT how, COUNT(*) rows_, SUM(lines) lines FROM mentions GROUP BY how");
  return { targetRows, units, precision, totals, unplaced: [...app.values()].reduce((a, x) => a + x.unplaced, 0) };
}

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '-');

export function renderReport(v) {
  const L = [];
  const by = Object.fromEntries(v.totals.map((t) => [t.how, t]));
  const persons = v.targetRows.filter((r) => r.type === 'person');
  const terms = v.targetRows.filter((r) => r.type !== 'person');
  L.push('# 언급 DB 자동 줄 — 등장 시안 (B2)', '');
  L.push('다시 뽑기: `node tools/views/mentions.mjs`. 규칙은 docs/schema.md "언급 DB", 조회는 `node tools/query.mjs appear <대상>` · `targets <씬|단위>` · `sample <이름>`.', '');
  L.push('## 요약', '');
  L.push('| 방식 | 행(줄 덩어리) | 줄 |', '|---|---:|---:|');
  for (const h of ['speaks', 'named', 'alias']) L.push(`| ${h} | ${(by[h]?.rows_ ?? 0).toLocaleString('ko-KR')} | ${(by[h]?.lines ?? 0).toLocaleString('ko-KR')} |`);
  L.push('');
  const seen = (rows) => rows.filter((r) => r.scenes > 0).length;
  L.push(`- 대상 ${v.targetRows.length} 가운데 자동 줄이 있는 것: 인물 ${seen(persons)}/${persons.length} · 비인물 ${seen(terms)}/${terms.length}.`);
  const neverSpoke = persons.filter((r) => r.scenes > 0 && !r.speaks);
  L.push(`- 말하지 않고 이름으로만 나오는 인물 ${neverSpoke.length}: ${neverSpoke.sort((a, b) => b.named + b.alias - a.named - a.alias).slice(0, 20).map((r) => `${r.name}(${r.named + r.alias})`).join(' · ')}${neverSpoke.length > 20 ? ' …' : ''}`);
  const silent = persons.filter((r) => !r.scenes);
  L.push(`- 자동 줄이 없는 인물 ${silent.length} — 범위 밖에서만 나오거나, 이름표 · 이름이 사전과 다르거나, 이름을 자동에서 뺐다.`);
  if (v.unplaced) L.push(`- 읽는 순서에 없는 씬의 등장 ${v.unplaced}건(처음 · 마지막에서 빠짐).`);
  L.push('');

  L.push('## 표본 정밀도', '');
  L.push('이름마다 자동 언급으로 걸린 줄에서 결정적 표본을 떠(`query.mjs sample`, seed 1) 그 대상이 맞는지 판정했다. 판정 · 결정은 annotations/dictionary/mention-precision.json.', '');
  const measured = v.precision;
  const parse = (p) => p.split(' · ')[0].split('/').map(Number);
  const sumOf = (rows) => rows.reduce((a, r) => { const [c, n] = parse(r.precision); return [a[0] + c, a[1] + n]; }, [0, 0]);
  const sum = sumOf(measured);
  const all = measured.filter((r) => r.mention_mode === 'all');
  const allSum = sumOf(all);
  L.push(`- 잰 이름 ${measured.length} · 표본 ${sum[1]}줄 · 맞음 ${sum[0]} (${pct(sum[0], sum[1])}). 어디서나 쓰는 이름(all ${all.length})만: ${allSum[0]}/${allSum[1]} (${pct(allSum[0], allSum[1])}).`);
  L.push('- 기준(PRECISION_FLOOR 80%): 표본 정밀도가 80% 이상이면 all, 밑이면 그 인물이 말하는 단위 안의 표본(seed 2)이 80% 이상일 때 unit, 아니면 off.', '');
  for (const [mode, title] of [['off', '자동에서 뺀 이름'], ['unit', '말하는 단위 안에서만 쓰는 이름']]) {
    const xs = measured.filter((r) => r.mention_mode === mode);
    L.push(`### ${title} ${xs.length}`, '');
    if (!xs.length) continue;
    L.push('| 대상 | 이름 | 정밀도 | 걸린 줄 |', '|---|---|---|---:|');
    for (const r of xs) L.push(`| ${r.target_id} | ${r.name} | ${r.precision} | ${r.lines_in_scope ?? 0} |`);
    L.push('');
  }
  const low = all.filter((r) => { const [c, n] = parse(r.precision); return n && c / n < 0.9; });
  if (low.length) L.push(`- all인데 정밀도 90% 밑 ${low.length}: ${low.map((r) => `${r.name}(${r.precision})`).join(' · ')}`, '');

  L.push('## 처음 등장이 많은 단위', '');
  L.push('| 자리 | 단위 | 종류 | 처음 나온 인물 | 처음 나온 비인물 | 나온 인물 |', '|---:|---|---|---:|---:|---:|');
  for (const u of [...v.units].sort((a, b) => b.new_persons + b.new_terms - a.new_persons - a.new_terms || a.order - b.order).slice(0, 15)) {
    L.push(`| ${u.order} | ${u.unit} | ${u.kind} | ${u.new_persons} | ${u.new_terms} | ${u.persons} |`);
  }
  L.push('');
  const unknown = v.units.reduce((a, u) => a + u.unknown_lines, 0);
  L.push('## 미상 이름표 줄', '');
  L.push(`범위 안 미상 이름표 줄 ${unknown} — 단위별 수는 units.csv \`unknown_lines\`. 자동 \`speaks\`로는 누구에게도 잇지 않는다(\`???\`는 매번 다른 사람). 2회독이 암시 언급(\`speaker: true\`)으로 정체를 적고, 진행률은 \`node tools/records.mjs progress --read2\`.`, '');
  return L.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = await openDb();
  const v = await buildMentionViews(db);
  fs.mkdirSync(MENTIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(MENTIONS_DIR, 'targets.csv'), toCsv(v.targetRows, COLUMNS.targets));
  fs.writeFileSync(path.join(MENTIONS_DIR, 'units.csv'), toCsv(v.units.sort((a, b) => a.order - b.order), COLUMNS.units));
  fs.writeFileSync(path.join(MENTIONS_DIR, 'report.md'), renderReport(v));
  console.log(`data/views/mentions/ — 대상 ${v.targetRows.length} · 단위 ${v.units.length}`);
  db.close();
}
