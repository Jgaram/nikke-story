/**
 * 바뀐 모습(사용자, 2026-10-10 — 어디까지 봤냐에 따라 초상화가 바뀐다). 원문 이름표 코드(speaker — `rapi` · `rapi_red`)가 그 줄의 초상화다.
 *
 *   node tools/views/portrait-forms.mjs   → data/views/portraits/forms.csv (커밋한다 — 사이트 export common이 읽는다)
 *
 * 메인 챕터마다(공개 자리순) 그 인물의 마지막 줄 코드(끝의 _op · _op_l/_r/_c는 자리 · 연출만 다른 같은 그림이라 뗀다)를
 * annotations/portraits.json `forms`(코드 → 아이콘)로 잇고, 없는 코드는 기본 아이콘(site/img/people/index.json)으로 본다.
 * 아이콘이 바뀌는 곳만 한 줄씩 남긴다(target · tick · unit · code · icon). forms 코드가 나온 인물만 본다. 원문 대사는 담지 않는다(코드 · ID만).
 * 아이콘을 받는 것은 tools/site/portraits.mjs, 화면은 docs/views.md "인물 아이콘".
 */
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from '../normalize/ensure-db.mjs';
import { buildUnits } from '../lib/units.mjs';
import { ROOT } from '../records/model.mjs';
import { parseCsv } from '../normalize/csv.mjs';
import { toCsv } from './draft.mjs';

const OUT = path.join(ROOT, 'data/views/portraits/forms.csv');
const COLUMNS = ['target', 'tick', 'unit', 'code', 'icon'];
export const stripForm = (code) => code.replace(/_op(_[lrc])?$/, '');

export function formSteps({ lines, mainScenes, forms, icons }) {
  const who = new Set(lines.filter((r) => stripForm(r.c) in forms).map((r) => r.t));
  const last = new Map(); // scene → target → code(그 씬의 마지막 줄)
  for (const r of lines) if (who.has(r.t)) (last.get(r.story_id) ?? last.set(r.story_id, new Map()).get(r.story_id)).set(r.t, stripForm(r.c));
  const rows = [];
  for (const t of [...who].sort()) {
    const base = icons[t];
    if (!base) continue;
    let cur = base;
    for (const { unit, tick, scenes } of mainScenes) {
      let code = null;
      for (const s of scenes) code = last.get(s)?.get(t) ?? code;
      if (!code) continue;
      const icon = forms[code]?.icon ?? base;
      if (icon !== cur) { rows.push({ target: t, tick, unit, code, icon }); cur = icon; }
    }
  }
  return rows;
}

async function main() {
  const { forms = {} } = JSON.parse(fs.readFileSync(path.join(ROOT, 'annotations/portraits.json'), 'utf8'));
  const icons = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/img/people/index.json'), 'utf8'));
  const tick = new Map(parseCsv(fs.readFileSync(path.join(ROOT, 'data/views/timeline/units.csv'), 'utf8')).map((r) => [r.unit, Number(r.tick)]));
  const db = await openDb();
  const units = buildUnits(db.prepare('SELECT * FROM categories').all()).filter((u) => /^ch\d+$/.test(u.key) && tick.has(u.key));
  const scenesOf = db.prepare('SELECT id FROM stories WHERE category_id = ? ORDER BY order_index, id');
  const mainScenes = units.map((u) => ({ unit: u.key, tick: tick.get(u.key), scenes: scenesOf.all(u.cat.id).map((s) => s.id) }))
    .sort((a, b) => a.tick - b.tick || a.unit.localeCompare(b.unit, 'en', { numeric: true }));
  const lines = db.prepare('SELECT story_id, speaker_id c, speaker_target t FROM lines WHERE speaker_target IS NOT NULL AND speaker_id IS NOT NULL ORDER BY story_id, seq').all();
  db.close();
  const unused = Object.keys(forms).filter((c) => !lines.some((r) => stripForm(r.c) === c));
  if (unused.length) console.log(`⚠ 원문에 없는 모습 코드: ${unused.join(' ')}`);
  const rows = formSteps({ lines, mainScenes, forms, icons });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, toCsv(rows, COLUMNS));
  console.log(`메인 챕터 ${mainScenes.length} · 모습이 바뀌는 인물 ${new Set(rows.map((r) => r.target)).size} · 바뀜 ${rows.length} → ${path.relative(ROOT, OUT)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main().catch((e) => { console.error(e); process.exit(1); });
