/**
 * 사이트 내보내기(W1) — data/views/ CSV · DB · annotations/ 기록 → site/data/*.json + manifest.json.
 * 규칙 · 파일 배치 · 칸은 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)", 공개 규칙은 CLAUDE.md "저작물 취급".
 *
 *   node tools/site/export.mjs                        # 전부 → site/data/
 *   node tools/site/export.mjs --only order,links     # 그 탭 모듈만 다시 쓴다(공용 데이터는 늘 계산하되 쓰지 않는다)
 *   node tools/site/export.mjs --out /tmp/x           # 다른 곳에(테스트)
 *   node tools/site/export.mjs --warnings 경로         # 경고 전부를 파일로(기본은 앞 20줄만 보인다)
 *
 * 대사 본문은 읽지 않는다 — 모듈은 tools/site/lib.mjs의 pick()으로 허용 칼럼만 고른다. 기록 문장 속 따옴표 인용은
 * 40자를 넘으면 경고(사람이 본다). 자르지 않는다. 내보낸 뒤 `node tools/check-quotes.mjs`로 원문과 겹침을 다시 본다.
 *
 * 모듈 규약: tools/site/export/<name>.mjs가 `name`과 `run(ctx) → { files: { '<이름>.json': 값 } }`을 내보낸다.
 * ctx = { db, csv(path), records, units, unitByKey, common, out, warn }. common이 먼저 돌고 ctx.common에 공용 데이터를 둔다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { openDb } from '../normalize/ensure-db.mjs';
import { buildUnits } from '../lib/units.mjs';
import { ROOT, inputsFingerprint, loadRecords, readCsv, writeJson } from './lib.mjs';

const MODULES = ['common', 'order', 'links', 'threads', 'persons', 'chrono', 'world', 'synopsis'];
export const SITE_DATA = path.join(ROOT, 'site/data');

/**
 * 내보내기 본체 — 테스트도 이것을 부른다.
 * @param {{ out?: string, only?: string[] | null, db?: import('node:sqlite').DatabaseSync, log?: (s: string) => void }} opts
 * @returns {Promise<{ manifest: object, warnings: object[], files: Record<string, number> }>}
 */
export async function exportSite({ out = SITE_DATA, only = null, db = null, log = () => {} } = {}) {
  const own = !db;
  if (!db) db = await openDb();
  const warnings = [];
  let records = null;
  const ctx = {
    db,
    csv: readCsv,
    get records() { return (records ??= loadRecords()); },
    units: buildUnits(db.prepare('SELECT * FROM categories').all()),
    out,
    common: null,
    warn: (w) => warnings.push(typeof w === 'string' ? { where: '', msg: w } : w),
  };
  ctx.unitByKey = new Map(ctx.units.map((u) => [u.key, u]));
  const files = {};
  const counts = {};
  try {
    fs.mkdirSync(out, { recursive: true });
    for (const name of MODULES) {
      const mod = await import(`./export/${name}.mjs`);
      const t0 = Date.now();
      const result = await mod.run(ctx);
      const write = !only || only.includes(name) || (name === 'common' && !only.length);
      for (const [file, value] of Object.entries(result?.files ?? {})) {
        const count = Array.isArray(value) ? value.length
          : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])) : 1;
        counts[file] = { count, module: name };
        if (write) files[file] = writeJson(path.join(out, file), value);
      }
      log(`${name}: ${Object.keys(result?.files ?? {}).length}파일 ${Date.now() - t0}ms${write ? '' : ' (쓰지 않음)'}`);
    }
    if (ctx.records?.problems?.length) for (const p of ctx.records.problems) ctx.warn({ where: p.file, msg: p.msg });
    const prev = readManifest(out);
    const manifest = {
      built_at: new Date().toISOString(),
      inputs: inputsFingerprint(db),
      db_built_at: db.prepare("SELECT value FROM meta WHERE key = 'built_at'").get()?.value ?? null,
      last_date: ctx.common?.units?.reduce((m, u) => (u.date > m ? u.date : m), '') || null,
      files: Object.fromEntries(Object.entries(counts).map(([f, c]) => [f, { ...c, bytes: files[f] ?? prev?.files?.[f]?.bytes ?? null }])),
      warnings: warnings.length,
    };
    writeJson(path.join(out, 'manifest.json'), manifest);
    return { manifest, warnings, files };
  } finally {
    if (own) db.close();
  }
}

function readManifest(out) {
  try {
    return JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const { values } = parseArgs({
    options: { only: { type: 'string' }, out: { type: 'string' }, warnings: { type: 'string' }, quiet: { type: 'boolean', default: false } },
  });
  const only = values.only ? values.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (only) for (const n of only) if (!MODULES.includes(n)) throw new Error(`모르는 모듈: ${n} (${MODULES.join(' · ')})`);
  const out = values.out ? path.resolve(values.out) : SITE_DATA;
  const t0 = Date.now();
  const { manifest, warnings, files } = await exportSite({ out, only, log: values.quiet ? () => {} : (s) => console.log(s) });
  const mb = (n) => `${(n / 1024 / 1024).toFixed(2)}MB`;
  console.log(`\n→ ${path.relative(ROOT, out) || out}/ (${Date.now() - t0}ms)`);
  for (const [f, c] of Object.entries(manifest.files)) {
    const count = typeof c.count === 'object' ? Object.entries(c.count).map(([k, v]) => `${k} ${v}`).join(' · ') : c.count;
    console.log(`  ${f.padEnd(14)} ${String(count).padStart(6)}건 ${files[f] != null ? mb(files[f]) : '(그대로)'}`);
  }
  if (warnings.length) {
    const quotes = warnings.filter((w) => w.length);
    const others = warnings.filter((w) => !w.length);
    console.log(`\n경고 ${warnings.length}건 — 따옴표 인용 ${quotes.length}건(40자 초과) · 그 밖 ${others.length}건`);
    for (const w of others) console.log(`  ${w.where ? `${w.where}: ` : ''}${w.msg}`);
    const shown = quotes.sort((a, b) => b.length - a.length).slice(0, values.warnings ? 0 : 20);
    for (const w of shown) console.log(`  ${w.where} ${w.length}자 ${w.quote}`);
    if (quotes.length > shown.length) console.log(`  … 나머지 ${quotes.length - shown.length}건${values.warnings ? '' : ' (--warnings 경로 로 전부)'}`);
    if (values.warnings) {
      fs.writeFileSync(values.warnings, `${warnings.map((w) => (w.length ? `${w.where}\t${w.length}\t${w.quote}` : `${w.where}\t${w.msg}`)).join('\n')}\n`);
      console.log(`  → ${values.warnings}`);
    }
  }
  console.log('\n다음: node tools/check-quotes.mjs (원문과 40자 이상 겹침 검사)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
