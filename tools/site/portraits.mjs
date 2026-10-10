/**
 * 인물 아이콘(W11) — 대상(person:*) ↔ nikke-db 아이콘을 잇고, 필요한 아이콘만 site/img/people/에 받는다.
 * 출처 · 조건은 docs/data-sources.md 9절, 잇는 규칙은 annotations/portraits.json 머리말, 사이트 쪽은 docs/views.md "인물 아이콘".
 *
 *   node tools/site/portraits.mjs            # 잇기 → 없는 아이콘만 받기 → site/img/people/index.json
 *   node tools/site/portraits.mjs --dry      # 받지 않고 대응만 본다
 *   node tools/site/portraits.mjs --refresh  # l2d.json(이름표)을 다시 받는다(새 NPC가 생겼을 때)
 *
 * 요청 규칙(docs/data-sources.md "0. 요청 규칙"을 따른다): 동시 4개, 받은 파일은 다시 받지 않음, 지수 백오프 3회, 404는 기록만.
 * 받은 뒤 `node tools/site/export.mjs --only common`으로 targets.json에 icon 칸을 싣는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { openDb } from '../normalize/ensure-db.mjs';
import { ROOT } from './lib.mjs';

const RAW = 'https://raw.githubusercontent.com/Nikke-db';
const L2D_URL = `${RAW}/nikke-db-vue/main/src/utils/json/l2d.json`;
const iconUrl = (id) => `${RAW}/Nikke-db.github.io/main/images/sprite/si_${id}_00_s.png`;
const L2D_CACHE = path.join(ROOT, 'data/normalized/nikke-db/l2d.json');
const MAP_FILE = path.join(ROOT, 'annotations/portraits.json');
export const IMG_DIR = path.join(ROOT, 'site/img/people');
export const INDEX_FILE = path.join(IMG_DIR, 'index.json');
const CONCURRENCY = 4;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 받기 — 404는 null, 그 밖 실패는 1s → 2s → 4s 백오프 뒤 던진다 */
async function get(url) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i >= 3) throw new Error(`${url} — ${err.message}`);
      await sleep(1000 * 2 ** i);
    }
  }
}

async function loadL2d(refresh) {
  if (!refresh && fs.existsSync(L2D_CACHE)) return JSON.parse(fs.readFileSync(L2D_CACHE, 'utf8'));
  const buf = await get(L2D_URL);
  if (!buf) throw new Error(`l2d.json을 찾을 수 없다: ${L2D_URL}`);
  fs.mkdirSync(path.dirname(L2D_CACHE), { recursive: true });
  fs.writeFileSync(L2D_CACHE, buf);
  return JSON.parse(buf.toString('utf8'));
}

/** 같은 이름의 아이콘이 여럿이면 기본판(밑줄 없음) → 짧은 ID → 앞 번호 */
const byBase = (a, b) => a.includes('_') - b.includes('_') || a.length - b.length || a.localeCompare(b);

/**
 * 대상마다 아이콘 후보(앞이 우선)와 어떻게 이었는지.
 * @returns {{ rows: { id: string, name: string, cands: string[], how: string, conf?: string, why?: string }[], problems: string[] }}
 */
export function resolve(db, l2d, manual) {
  const problems = [];
  const persons = db.prepare("SELECT id, name, resource_ids FROM targets WHERE type = 'person'").all();
  const known = new Set(persons.map((p) => p.id));
  for (const id of Object.keys(manual)) if (!known.has(id)) problems.push(`portraits.json: 사전에 없는 대상 ${id}`);
  const names = new Map();
  for (const n of db.prepare('SELECT target_id, name FROM target_names').all()) {
    if (!names.has(n.target_id)) names.set(n.target_id, new Set());
    names.get(n.target_id).add(n.name);
  }
  const charName = new Map(db.prepare('SELECT resource_id, name FROM characters').all().map((c) => [c.resource_id, c.name]));
  const byKo = new Map();
  for (const x of l2d) {
    if (!x.ko || !/^c\d+(_\d+)?$/.test(x.id)) continue;
    if (!byKo.has(x.ko)) byKo.set(x.ko, []);
    byKo.get(x.ko).push(x.id);
  }
  const rows = [];
  for (const p of persons) {
    const m = manual[p.id];
    if (m) {
      rows.push({ id: p.id, name: p.name, cands: m.icon ? [m.icon] : [], how: '대응표', conf: m.conf, why: m.why });
      continue;
    }
    const rids = JSON.parse(p.resource_ids || '[]');
    if (rids.length) {
      // 표준명과 같은 이름의 판(라피 — 레드 후드가 아니라)을 먼저, 나머지는 resource_id 순
      const sorted = [...rids].sort((a, b) => (charName.get(b) === p.name) - (charName.get(a) === p.name) || a - b);
      rows.push({ id: p.id, name: p.name, cands: sorted.map((r) => `c${String(r).padStart(3, '0')}`), how: 'resource_id' });
      continue;
    }
    const ids = [...new Set([p.name, ...(names.get(p.id) ?? [])].flatMap((n) => byKo.get(n) ?? []))].sort(byBase);
    if (ids.length) rows.push({ id: p.id, name: p.name, cands: ids, how: '한국어 이름' });
  }
  return { rows, problems };
}

async function main() {
  const { values } = parseArgs({ options: { dry: { type: 'boolean', default: false }, refresh: { type: 'boolean', default: false } } });
  const manual = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')).map;
  const l2d = await loadL2d(values.refresh);
  const db = await openDb();
  const { rows, problems } = resolve(db, l2d, manual);
  db.close();
  for (const p of problems) console.log(`⚠ ${p}`);

  fs.mkdirSync(IMG_DIR, { recursive: true });
  const has = (id) => fs.existsSync(path.join(IMG_DIR, `${id}.png`));
  const index = {};
  const missing = [];
  const stats = { cached: 0, fetched: 0, notFound: 0 };
  const queue = [...rows];
  async function worker() {
    for (let r; (r = queue.shift()); ) {
      for (const id of r.cands) {
        if (has(id)) { stats.cached++; index[r.id] = id; break; }
        if (values.dry) { index[r.id] = id; break; }
        const buf = await get(iconUrl(id));
        // nikke-db Pages는 없는 파일에도 200(HTML)을 주므로 PNG 머리로 한 번 더 본다
        if (!buf || !buf.subarray(0, 4).equals(PNG)) { stats.notFound++; continue; }
        fs.writeFileSync(path.join(IMG_DIR, `${id}.png`), buf);
        stats.fetched++;
        index[r.id] = id;
        break;
      }
      if (!index[r.id] && r.cands.length) missing.push(`${r.name}(${r.cands.join('/')})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  const by = (how) => rows.filter((r) => r.how === how && index[r.id]).length;
  console.log(`인물 ${rows.length}명 후보 → 아이콘 ${Object.keys(sorted).length}명 (resource_id ${by('resource_id')} · 한국어 이름 ${by('한국어 이름')} · 대응표 ${by('대응표')})`);
  console.log(`받음 ${stats.fetched} · 이미 있음 ${stats.cached} · 없음 ${stats.notFound}`);
  if (missing.length) console.log(`아이콘을 못 받은 대상 ${missing.length}: ${missing.join(' · ')}`);
  const multi = rows.filter((r) => r.how === '한국어 이름' && r.cands.length > 1);
  if (multi.length) console.log(`한국어 이름이 여럿 — 앞 것을 씀: ${multi.map((r) => `${r.name}→${index[r.id]}(${r.cands.join('/')})`).join(' · ')}`);
  if (values.dry) return;
  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(sorted, null, 1)}\n`);
  const used = new Set(Object.values(sorted));
  const stale = fs.readdirSync(IMG_DIR).filter((f) => f.endsWith('.png') && !used.has(f.slice(0, -4)));
  if (stale.length) console.log(`쓰지 않는 아이콘 ${stale.length}: ${stale.join(' ')} (지우려면 손으로)`);
  const bytes = fs.readdirSync(IMG_DIR).reduce((s, f) => s + fs.statSync(path.join(IMG_DIR, f)).size, 0);
  console.log(`→ ${path.relative(ROOT, INDEX_FILE)} · 폴더 ${(bytes / 1024 / 1024).toFixed(2)}MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
