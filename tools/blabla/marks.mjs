/**
 * 기업 · 스쿼드 마크 — 실장 니케의 지금 소속(게임 데이터)을 모으고, 필요한 마크만 블라링크 CDN에서 site/img/orgs/에 받는다.
 * 출처는 docs/data-sources.md 10절, 게임 코드 → 사전 조직 대응은 annotations/affiliations.json game, 사이트 쪽은 docs/views.md "소속 마크".
 *
 *   node tools/blabla/marks.mjs          # 소속 모으기 → 없는 마크만 받기 → site/img/orgs/index.json
 *   node tools/blabla/marks.mjs --dry    # 받지 않고 대응 · 빠진 코드만 본다
 *
 * 요청 규칙(docs/data-sources.md "0. 요청 규칙"): 동시 4개, 받은 파일은 다시 받지 않음, 지수 백오프 3회, 404는 기록만.
 * 받은 뒤 `node tools/site/export.mjs --only common`으로 targets.json 인물 행에 orgs 칸을 싣는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { CDN_BASE, obfuscatePath } from './obfuscate.mjs';
import { MAX_CONCURRENCY } from './client.mjs';
import { ROOT } from '../site/lib.mjs';

const ROLEDATA_DIR = path.join(ROOT, 'data/raw/roledata');
export const AFFIL_FILE = path.join(ROOT, 'annotations/affiliations.json');
export const IMG_DIR = path.join(ROOT, 'site/img/orgs');
export const INDEX_FILE = path.join(IMG_DIR, 'index.json');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** 기업 코드 → 한국어 이름 · 아이콘(icon/atlas_common_corp/icn_corp_0N — 블라링크 사이트 번들의 대응) */
export const CORPS = {
  ELYSION: { name: '엘리시온', icon: 'icn_corp_01' },
  MISSILIS: { name: '미실리스', icon: 'icn_corp_02' },
  TETRA: { name: '테트라', icon: 'icn_corp_03' },
  PILGRIM: { name: '필그림', icon: 'icn_corp_04' },
  ABNORMAL: { name: '앱노멀', icon: 'icn_corp_05' },
};
const corpPath = (icon) => `icon/atlas_common_corp/${icon}.png`;
const squadPath = (icon) => `icon/squad/${icon}.png`;

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

/**
 * 실장 니케의 지금 소속 — roledata(resource_id마다 하나)의 corporation · squad_detail.
 * @returns {{ chars: Record<string, [string, string]>, squads: Record<string, { name: string, icon: string }>, problems: string[] }}
 *   chars: resource_id → [기업 코드, 스쿼드 코드], squads: 스쿼드 코드 → 게임 이름(squad_name) · 아이콘 ID(resource_id)
 */
export function readGameAffiliations(dir = ROLEDATA_DIR) {
  const chars = {};
  const squads = {};
  const problems = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('-v2-ko.json')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const s = j.squad_detail;
    if (!CORPS[j.corporation]) problems.push(`${f}: 모르는 기업 코드 ${j.corporation}`);
    if (!s?.squad) { problems.push(`${f}: squad_detail이 없다`); continue; }
    chars[String(j.resource_id)] = [j.corporation, s.squad];
    const prev = squads[s.squad];
    if (prev && (prev.name !== s.squad_name || prev.icon !== s.resource_id)) problems.push(`스쿼드 ${s.squad}의 이름 · 아이콘이 니케마다 다르다`);
    squads[s.squad] = { name: s.squad_name, icon: s.resource_id };
  }
  return { chars, squads, problems };
}

/** 게임 코드 → 사전 조직 ID 대응(affiliations.json game)과 맞춰 본다 — 대응이 없는 코드 · 쓰이지 않는 대응 */
export function checkGameMap(game, map) {
  const problems = [];
  const corpMap = map?.corporations ?? {};
  const squadMap = map?.squads ?? {};
  for (const c of Object.keys(CORPS)) if (!(c in corpMap)) problems.push(`affiliations.json game.corporations에 ${c}가 없다(org ID나 null)`);
  for (const s of Object.keys(game.squads)) if (!(s in squadMap)) problems.push(`affiliations.json game.squads에 ${s}(${game.squads[s].name})가 없다(org ID나 null)`);
  for (const s of Object.keys(squadMap)) if (!game.squads[s]) problems.push(`affiliations.json game.squads ${s}: 게임 데이터에 없는 스쿼드`);
  return problems;
}

async function main() {
  const { values } = parseArgs({ options: { dry: { type: 'boolean', default: false } } });
  const game = readGameAffiliations();
  const map = JSON.parse(fs.readFileSync(AFFIL_FILE, 'utf8')).game ?? {};
  const problems = [...game.problems, ...checkGameMap(game, map)];
  for (const p of problems) console.log(`⚠ ${p}`);

  fs.mkdirSync(IMG_DIR, { recursive: true });
  const jobs = [
    ...Object.values(CORPS).map((c) => ({ icon: c.icon, path: corpPath(c.icon) })),
    ...[...new Set(Object.values(game.squads).map((s) => s.icon))].sort().map((icon) => ({ icon, path: squadPath(icon) })),
  ];
  const has = (icon) => fs.existsSync(path.join(IMG_DIR, `${icon}.png`));
  const stats = { cached: 0, fetched: 0 };
  const notFound = [];
  const queue = [...jobs];
  async function worker() {
    for (let j; (j = queue.shift()); ) {
      if (has(j.icon)) { stats.cached++; continue; }
      if (values.dry) continue;
      const buf = await get(`${CDN_BASE}/${obfuscatePath(j.path)}`);
      if (!buf || !buf.subarray(0, 4).equals(PNG)) { notFound.push(j.path); continue; }
      fs.writeFileSync(path.join(IMG_DIR, `${j.icon}.png`), buf);
      stats.fetched++;
    }
  }
  await Promise.all(Array.from({ length: MAX_CONCURRENCY }, worker));
  console.log(`마크 ${jobs.length}개(기업 ${Object.keys(CORPS).length} · 스쿼드 아이콘 ${jobs.length - Object.keys(CORPS).length}) — 받음 ${stats.fetched} · 이미 있음 ${stats.cached} · 없음(404) ${notFound.length}`);
  if (notFound.length) console.log(`없는 마크: ${notFound.join(' · ')}`);
  if (values.dry) return;

  // 받아 둔 마크만 싣는다 — 없으면 이름만 보인다
  const icon = (id) => (has(id) ? id : undefined);
  const index = {
    _comment: '기업 · 스쿼드 마크 — tools/blabla/marks.mjs가 만든다(손으로 고치지 않는다). chars: resource_id → [기업 코드, 스쿼드 코드]',
    corporations: Object.fromEntries(Object.entries(CORPS).map(([code, c]) => [code, { name: c.name, org: map.corporations?.[code] ?? null, icon: icon(c.icon) }])),
    squads: Object.fromEntries(Object.entries(game.squads).sort(([a], [b]) => a.localeCompare(b)).map(([code, s]) => [code, { name: s.name, org: map.squads?.[code] ?? null, icon: icon(s.icon) }])),
    chars: game.chars,
  };
  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 1)}\n`);
  const bytes = fs.readdirSync(IMG_DIR).reduce((s, f) => s + fs.statSync(path.join(IMG_DIR, f)).size, 0);
  console.log(`→ ${path.relative(ROOT, INDEX_FILE)} · 니케 ${Object.keys(game.chars).length} · 스쿼드 ${Object.keys(game.squads).length} · 폴더 ${(bytes / 1024 / 1024).toFixed(2)}MB`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
