/**
 * T1-4 — 캐릭터별 에피소드(호감도) 수집기.
 *
 * 1) nikke_list_v2 에서 캐릭터 resource_id를 뽑는다
 * 2) /roledata/{resource_id}-v2-{lang}.json 에서 attractive_scenario_list 를 읽는다
 *    — 여기에 에피소드 제목, 해금 호감도, 그리고 선행 에피소드(condition_scenario_group_id)가 있다
 * 3) /attractscene/{group_id}-{lang}.json 으로 본문을 받는다
 *
 *   node tools/blabla/fetch-episodes.mjs [--lang ko] [--force] [--limit N] [--index-only]
 *
 * 동시 요청 상한·캐시·재시도는 client.mjs가 처리한다 (CLAUDE.md 규칙).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Collector, formatBytes } from './client.mjs';
import { RAW_DIR } from './fetch-index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const NIKKE_LIST = '/character/{l_lang}/nikke_list_{lang}_v2.json';
const KNOWN_GAPS = new URL('./known-gaps.json', import.meta.url);
/** 빈 목록 보강 시 한 캐릭터당 최대 몇 편까지 찾아볼지. 현재 전원 5편이다. */
const MAX_PROBE = 8;
const roledataTemplate = (resourceId) => `/roledata/${resourceId}-v2-{lang}.json`;
const episodeTemplate = (groupId) => `/attractscene/${groupId}-{lang}.json`;

/** roledata 묶음에서 에피소드 목록을 평탄화한다. */
export function extractEpisodes(roledataResults) {
  const episodes = [];
  for (const { json } of roledataResults) {
    if (!json) continue;
    // roledata는 name_localkey가 평문 문자열이고, nikke_list는 { name } 객체다. 둘 다 받는다.
    const character =
      typeof json.name_localkey === 'string'
        ? json.name_localkey
        : (json.name_localkey?.name ?? String(json.resource_id ?? '?'));
    for (const ep of json.attractive_scenario_list ?? []) {
      episodes.push({
        groupId: ep.attractive_scenario_group_id,
        title: ep.scenario_title_locale,
        character,
        resourceId: json.resource_id,
        nameCode: ep.name_code,
        level: ep.attractive_level,
        // 게임이 직접 들고 있는 선행 조건. 에피소드 간 순서 엣지의 근거가 된다.
        requires: ep.condition_scenario_group_id ?? null,
        costume: ep.costume ?? 0,
      });
    }
  }
  return episodes;
}

/**
 * roledata가 에피소드를 비워둔 캐릭터를 slug로 직접 찾아 보강한다.
 * `_01`부터 올리다가 404가 나면 멈춘다.
 */
async function probeKnownGaps(collector) {
  const { attractiveSlugs } = JSON.parse(await fs.readFile(KNOWN_GAPS, 'utf8'));
  const found = [];

  for (const [slug, meta] of Object.entries(attractiveSlugs)) {
    for (let n = 1; n <= MAX_PROBE; n++) {
      const groupId = `${slug}`.startsWith('d_nikke_')
        ? slug
        : `d_nikke_${slug}_${String(n).padStart(2, '0')}`;
      const { json, missing } = await collector.fetchOne(episodeTemplate(groupId));
      if (missing || !json) break;
      found.push({
        groupId,
        title: null, // roledata에 없으므로 제목을 알 수 없다. 본문에서 유추해야 한다
        character: meta.character,
        resourceId: meta.resourceId,
        nameCode: null,
        level: null,
        requires: n > 1 ? `d_nikke_${slug}_${String(n - 1).padStart(2, '0')}` : null,
        costume: 0,
        source: 'known-gap',
      });
    }
  }
  return found;
}

async function main() {
  const { values } = parseArgs({
    options: {
      lang: { type: 'string', default: 'ko' },
      force: { type: 'boolean', default: false },
      limit: { type: 'string' },
      'index-only': { type: 'boolean', default: false },
    },
  });

  const collector = await new Collector({ rawDir: RAW_DIR, lang: values.lang, force: values.force }).init();

  const { json: nikkeList } = await collector.fetchOne(NIKKE_LIST);
  let characters = [...new Set((nikkeList ?? []).map((n) => n.resource_id))].filter(Boolean);
  if (values.limit) characters = characters.slice(0, Number(values.limit));
  console.log(`캐릭터 ${characters.length}명의 roledata 수집`);

  const roledata = await collector.fetchMany(characters.map(roledataTemplate), {
    onProgress: (done, total) => {
      if (done % 50 === 0 || done === total) console.log(`  roledata ${done}/${total}`);
    },
  });

  const episodes = extractEpisodes(roledata);

  // roledata가 비워둔 캐릭터를 보강한다 (known-gaps.json)
  const known = new Set(episodes.map((e) => e.groupId));
  const gapEpisodes = (await probeKnownGaps(collector)).filter((e) => !known.has(e.groupId));
  if (gapEpisodes.length) {
    const names = [...new Set(gapEpisodes.map((e) => e.character))].join(', ');
    console.log(`\n  roledata 누락 보강: ${gapEpisodes.length}편 (${names})`);
    episodes.push(...gapEpisodes);
  }

  const withRequires = episodes.filter((e) => e.requires).length;
  console.log(`\n에피소드 ${episodes.length}편 / 캐릭터 ${new Set(episodes.map((e) => e.character)).size}명`);
  console.log(`  선행 조건이 붙은 편: ${withRequires}`);

  const indexPath = path.join(RAW_DIR, 'episode-index.json');
  await fs.writeFile(
    indexPath,
    JSON.stringify({ lang: values.lang, generatedAt: new Date().toISOString(), episodes }, null, 2) + '\n',
  );
  console.log(`  목록 저장: ${path.relative(ROOT, indexPath)}`);

  if (values['index-only']) {
    await collector.saveManifest();
    return;
  }

  console.log(`\n에피소드 본문 수집 — 대상 ${episodes.length}편`);
  try {
    const results = await collector.fetchMany(
      episodes.map((e) => episodeTemplate(e.groupId)),
      {
        onProgress: (done, total) => {
          if (done % 100 === 0 || done === total) console.log(`  ${done}/${total}`);
        },
      },
    );
    const lines = results.reduce((sum, r) => sum + (r?.json?.records?.length ?? 0), 0);
    console.log(`\n본문 확인: ${results.filter((r) => r?.json).length}편 / 대사 ${lines.toLocaleString('ko-KR')}줄`);
  } finally {
    await collector.saveManifest();
  }

  const { fetched, cached, missing, bytes } = collector.stats;
  console.log(`\n완료: 수집 ${fetched} / 캐시 ${cached} / 없음 ${missing} (${formatBytes(bytes)})`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
