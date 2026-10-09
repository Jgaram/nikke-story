/**
 * T1-2 — 인덱스 수집기.
 *
 * 카테고리 목록과 인물 테이블을 받아 data/raw/ 에 저장한다.
 * 씬 본문은 fetch-scenes.mjs가 이 인덱스를 읽어서 받는다.
 *
 *   node tools/blabla/fetch-index.mjs [--lang ko] [--force]
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Collector, formatBytes } from './client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const RAW_DIR = path.join(ROOT, 'data/raw');

export const INDEX_RESOURCES = [
  { template: '/scene/{lang}/scene_list_{lang}.json', label: '메인 스토리 목록', source: 'main' },
  { template: '/scene/{lang}/sudden_list_{lang}.json', label: '돌발 스토리 목록', source: 'sudden' },
  { template: '/archive/{lang}/archive_list_{lang}.json', label: '아카이브 목록', source: 'archive' },
  { template: '/character/{l_lang}/nikke_list_{lang}_v2.json', label: '니케 목록' },
  { template: '/character/character_id_map.json', label: '캐릭터 ID 매핑' },
  { template: '/character/scene_characeter_list_v2.json', label: '씬 등장 캐릭터' },
  { template: '/character/{lang}/character_face_list.json', label: '표정 리소스' },
  { template: '/equip/favorite_rare_map.json', label: '애장품 등급 매핑' },
];

/** 인덱스를 받아(또는 캐시에서 읽어) 템플릿별 결과를 돌려준다. */
export async function fetchIndexes(collector, { quiet = false } = {}) {
  const results = new Map();
  for (const resource of INDEX_RESOURCES) {
    const result = await collector.fetchOne(resource.template);
    results.set(resource.template, { ...resource, ...result });
    if (!quiet) {
      const mark = result.missing ? '없음' : result.cached ? '캐시' : '수집';
      const count = Array.isArray(result.json) ? `${result.json.length}건` : result.json ? 'object' : '-';
      console.log(`  [${mark}] ${resource.label.padEnd(16)} ${count.padStart(8)}  ${result.logical}`);
    }
  }
  return results;
}

/**
 * 애장품은 등급 매핑에서 ID를 얻어 개별 파일을 받는다.
 * 대사는 없지만(docs/coverage.md) 이름·설명·소유 캐릭터(name_code)가 필요하다.
 */
export async function fetchFavorites(collector, { quiet = false } = {}) {
  const { json: rareMap } = await collector.fetchOne('/equip/favorite_rare_map.json');
  const ids = Object.values(rareMap ?? {}).flat();
  const results = await collector.fetchMany(ids.map((id) => `/equip/{lang}/favorite_${id}.json`));
  const ok = results.filter((r) => r.json);
  if (!quiet) console.log(`  [애장품] ${ok.length}/${ids.length}종`);
  return ok.map((r) => r.json);
}

async function main() {
  const { values } = parseArgs({
    options: { lang: { type: 'string', default: 'ko' }, force: { type: 'boolean', default: false } },
  });

  console.log(`인덱스 수집 시작 (언어: ${values.lang}${values.force ? ', 강제 재수집' : ''})`);
  const collector = await new Collector({ rawDir: RAW_DIR, lang: values.lang, force: values.force }).init();

  try {
    await fetchIndexes(collector);
    await fetchFavorites(collector);
  } finally {
    await collector.saveManifest();
  }

  const { fetched, cached, missing, bytes } = collector.stats;
  console.log(`\n완료: 수집 ${fetched} / 캐시 ${cached} / 없음 ${missing} (${formatBytes(bytes)})`);
  console.log(`저장 위치: ${path.relative(ROOT, RAW_DIR)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
