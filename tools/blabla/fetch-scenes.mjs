/**
 * T1-3 — 씬 본문 수집기.
 *
 * 인덱스(메인/돌발/아카이브)에서 scenario_group_id를 전부 끌어내
 * scene_detail_*.json 을 받아온다. 대사 본문이 여기 들어 있다.
 *
 *   node tools/blabla/fetch-scenes.mjs [--lang ko] [--source main,sudden,archive] [--force] [--limit N]
 *
 * 동시 요청 상한·캐시·재시도는 client.mjs가 처리한다 (docs/data-sources.md "0. 요청 규칙").
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Collector, collectScenarioGroupIds, formatBytes } from './client.mjs';
import { fetchIndexes, RAW_DIR } from './fetch-index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_ORDER = ['main', 'sudden', 'archive'];
const SOURCE_LABEL = { main: '메인', sudden: '돌발', archive: '아카이브' };

const sceneTemplate = (id) => `/scene/{lang}/scene_detail_${id}_{lang}.json`;

/**
 * 인덱스에서 씬 ID를 뽑아 출처별로 분류한다.
 * 같은 ID가 여러 인덱스에 있으면 먼저 나온 출처(메인 > 돌발 > 아카이브)로 친다.
 */
export function classifyScenes(indexResults) {
  const bySource = new Map(SOURCE_ORDER.map((s) => [s, []]));
  const seen = new Set();

  for (const source of SOURCE_ORDER) {
    const entry = [...indexResults.values()].find((r) => r.source === source);
    if (!entry?.json) continue;
    for (const id of collectScenarioGroupIds(entry.json)) {
      if (seen.has(id)) continue;
      seen.add(id);
      bySource.get(source).push(id);
    }
  }
  return bySource;
}

async function main() {
  const { values } = parseArgs({
    options: {
      lang: { type: 'string', default: 'ko' },
      source: { type: 'string', default: SOURCE_ORDER.join(',') },
      force: { type: 'boolean', default: false },
      limit: { type: 'string' },
    },
  });

  const wanted = values.source.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = wanted.filter((s) => !SOURCE_ORDER.includes(s));
  if (unknown.length) {
    console.error(`알 수 없는 출처: ${unknown.join(', ')} (가능: ${SOURCE_ORDER.join(', ')})`);
    process.exit(1);
  }

  const collector = await new Collector({ rawDir: RAW_DIR, lang: values.lang, force: values.force }).init();

  console.log(`인덱스 확인 (언어: ${values.lang})`);
  const indexResults = await fetchIndexes(collector, { quiet: true });
  const bySource = classifyScenes(indexResults);

  for (const source of SOURCE_ORDER) {
    const n = bySource.get(source).length;
    const mark = wanted.includes(source) ? '' : '  (건너뜀)';
    console.log(`  ${SOURCE_LABEL[source].padEnd(5)} ${String(n).padStart(5)}개 씬${mark}`);
  }

  // 출처 매핑을 남겨둔다. 누락 씬이 어느 인덱스에서 왔는지 되짚을 때 쓴다.
  await fs.writeFile(
    path.join(RAW_DIR, 'scene-ids.json'),
    JSON.stringify({ lang: values.lang, generatedAt: new Date().toISOString(), bySource: Object.fromEntries(bySource) }, null, 2) + '\n',
  );

  let targets = wanted.flatMap((s) => bySource.get(s).map((id) => ({ id, source: s })));
  if (values.limit) targets = targets.slice(0, Number(values.limit));

  console.log(`\n씬 본문 수집 시작 — 대상 ${targets.length}개${values.force ? ' (강제 재수집)' : ''}`);
  const started = Date.now();
  const sourceOf = new Map(targets.map((t) => [t.id, t.source]));
  const missing = [];

  try {
    const results = await collector.fetchMany(
      targets.map((t) => sceneTemplate(t.id)),
      {
        onProgress(done, total, result) {
          if (result.missing) {
            const id = result.logical.match(/scene_detail_(.+)\.json$/)?.[1] ?? result.logical;
            missing.push({ id, source: sourceOf.get(id) ?? '?' });
          }
          if (done % 100 === 0 || done === total) {
            const pct = ((done / total) * 100).toFixed(0).padStart(3);
            console.log(`  ${pct}%  ${done}/${total}`);
          }
        },
      },
    );
    reportLines(results);
  } finally {
    await collector.saveManifest();
  }

  const { fetched, cached, missing: missCount, bytes } = collector.stats;
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`\n완료 (${secs}초): 수집 ${fetched} / 캐시 ${cached} / 없음 ${missCount} (${formatBytes(bytes)})`);

  if (missing.length) {
    const bySource = missing.reduce((acc, m) => ((acc[m.source] = (acc[m.source] ?? 0) + 1), acc), {});
    const summary = Object.entries(bySource).map(([s, n]) => `${SOURCE_LABEL[s] ?? s} ${n}`).join(' / ');
    console.log(`\n누락 ${missing.length}건 — ${summary}`);
    console.log(`  예: ${missing.slice(0, 5).map((m) => m.id).join(', ')}`);
    console.log(`  전체 목록은 ${path.relative(ROOT, collector.manifestPath)} 의 missing 항목 참고`);
  }
}

/** 실제로 대사가 들어왔는지 눈으로 확인할 수 있게 요약한다. */
function reportLines(results) {
  let scenes = 0;
  let lines = 0;
  for (const r of results) {
    if (!r?.json) continue;
    scenes++;
    lines += r.json.scenario_group_id?.records?.value?.length ?? 0;
  }
  console.log(`\n본문 확인: 씬 ${scenes}개 / 대사 ${lines.toLocaleString('ko-KR')}줄`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
