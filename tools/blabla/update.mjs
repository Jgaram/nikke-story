/**
 * N2a — 증분 수집. 새 패치가 나오면 이것 하나로 원문을 받는다(docs/update.md "확인" 2).
 *
 *   node tools/blabla/update.mjs              블라링크 인덱스를 새로 받아 diff → 새 씬 · 새 호감도 · 앞서 404였던 것만 받고, 금서고를 맞춘다
 *   node tools/blabla/update.mjs --no-library 금서고는 건드리지 않는다
 *
 * 1. 인덱스(목록 · 인물 표)만 다시 받는다 — 바뀌었는지는 받아 봐야 안다. 씬 · roledata · 본문은 캐시 우선 그대로라
 *    요청은 새 scenario_group_id · 새 니케 · manifest의 missing(본문 없는 씬)에만 나간다.
 *    roledata는 에피소드가 비어 있던 것(출시 전에 받았을 수 있다)도 다시 본다.
 * 2. 금서고는 tools/forbidden-library/fetch.mjs와 같다 — 목록은 사이트 배포 시각이 바뀔 때만.
 * 3. 금서고 이벤트 매핑(annotations/forbidden-library-events.json)의 null과, 매핑에 안 든 블라링크 이벤트의 이름을 맞춰
 *    "전환 후보"를 띄운다. 확정은 Claude가 원문을 대조해 한다(묻지 않는다). 그 금서고 단위에 기록이 이미 있으면
 *    annotations/hold.json에 "전환 대기"로 두어 블라링크 쪽을 단위로 만들지 않고, 기록을 옮긴다(tools/forbidden-library/convert.mjs — hold 줄 · 매핑 null도 고친다).
 * 4. 새로 들어온 단위는 annotations/hold.json에 "업데이트 전"으로 넣는다(N2b) — 빌드가 빼므로 읽기 순서 · 출시 순서 테스트가
 *    깨지지 않고, 그 패치의 U1이 지우며 들인다. 새 블라링크 이벤트 · 새 니케의 호감도 · 새 메인 챕터(chNN) · 새 금서고 단위 파일.
 *    매핑에 키가 있는 금서고 이벤트에 블라링크 본문이 생기면(자동으로 돌아감) 그 키를 "전환 대기"로 넣는다 — 기록은 convert.mjs가 옮긴다.
 * 리포트: data/release/collect.md(원문 없이 키 · 개수만 — 공개 레포). 요청 규칙은 docs/data-sources.md "0. 요청 규칙".
 *
 * 블라링크가 경로 규칙을 바꾸면 ObfuscationBrokenError로 멈춘다 — 번들에서 규칙을 다시 뽑아야 한다(같은 문서 "난독화 규칙이 깨지면").
 */
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { Collector, ObfuscationBrokenError, collectScenarioGroupIds, formatBytes } from './client.mjs';
import { fetchIndexes, fetchFavorites, RAW_DIR } from './fetch-index.mjs';
import { collectScenes } from './fetch-scenes.mjs';
import { collectEpisodes } from './fetch-episodes.mjs';
import { syncLibrary, EVENTS_MAP_PATH, MANIFEST_PATH as LIBRARY_MANIFEST } from '../forbidden-library/fetch.mjs';
import { LIBRARY_KINDS } from '../normalize/library.mjs';

const HOLD_PATH = path.join(path.dirname(EVENTS_MAP_PATH), 'hold.json');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = path.join(ROOT, 'data/release/collect.md');
const ARCHIVE_LIST = path.join(RAW_DIR, 'archive/ko/archive_list.json');
const MAIN_LIST = path.join(RAW_DIR, 'scene/ko/scene_list.json');
const LIBRARY_FETCHED = path.join(RAW_DIR, 'forbidden-library/fetched.json');

/** 메인 챕터 키(chNN) — scene_list의 chapter_name_N(build.mjs와 같은 규칙). */
const mainChapters = (list) =>
  new Set((list ?? []).map((c) => c.sub_category_name_localkey?.value?.match(/chapter_name_(\d+)/)?.[1]).filter(Boolean).map((n) => `ch${n.padStart(2, '0')}`));

/**
 * 새로 들어온 단위를 hold에 넣는다(이미 있는 키는 그대로). 넣은 키 목록을 돌려준다.
 * @param {object} hold annotations/hold.json 내용(고친다)
 * @param {{events?: string[], episodes?: number[], chapters?: string[], libraryFiles?: string[], switched?: [string, string][], day: string}} found
 */
export function holdNewUnits(hold, { events = [], episodes = [], chapters = [], libraryFiles = [], switched = [], day }) {
  const added = [];
  const put = (key, value) => {
    if (hold[key]) return;
    hold[key] = value;
    added.push(key);
  };
  const before = (what) => ({ 까닭: '업데이트 전', '들이는 곳': '그 패치의 U1(docs/update.md "단계")', 근거: `${day} 증분 수집에서 새로 들어온 ${what}` });
  for (const k of events) put(k, before('블라링크 이벤트'));
  for (const rid of episodes) put(`char:${rid}`, before('니케의 호감도 스토리'));
  for (const k of chapters) put(k, before('메인 챕터'));
  for (const f of libraryFiles) if (LIBRARY_KINDS[f.split('/')[0]]) put(f, before('금서고 파일'));
  for (const [file, key] of switched) {
    put(key, { 까닭: '전환 대기', 금서고: file, '들이는 곳': `node tools/forbidden-library/convert.mjs ${key}`, 근거: `${day} 블라링크 본문이 새로 들어옴 — 매핑에 키가 있는 금서고 이벤트` });
  }
  return added;
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
};

/** archive_list 항목마다 이벤트 키(event_접두, build.mjs readArchiveList와 같은 규칙)와 씬 ID. */
export function archiveEvents(list) {
  const events = [];
  for (const entry of list ?? []) {
    const ids = [...collectScenarioGroupIds(entry)];
    if (!ids.length) continue;
    const prefix = ids.map((id) => id.match(/^event_([A-Za-z0-9]+)/)?.[1]).find(Boolean);
    if (!prefix) continue;
    events.push({ key: `event_${prefix}`, eventId: entry.record_main_archive_event_id?.value ?? entry.id, ids });
  }
  return events;
}

/** 이름 맞추기용 — 소문자 영숫자만, event_ 접두 · 끝 숫자 · .txt를 뗀다. */
const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/^event_stories\//, '')
    .replace(/\.txt$/, '')
    .replace(/^event_/, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/\d+$/, '');

/** 두 글자 묶음 Dice 계수(0–1). */
export function similarity(a, b) {
  const grams = (s) => {
    const out = new Map();
    for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  let common = 0;
  for (const [g, n] of A) common += Math.min(n, B.get(g) ?? 0);
  const total = Math.max(a.length - 1, 0) + Math.max(b.length - 1, 0);
  return total ? (2 * common) / total : 0;
}

/**
 * 전환 후보 — 매핑이 null인 금서고 이벤트 × 매핑 어디에도 없는 블라링크 이벤트(본문 있는 것) 중 이름이 닮은 쌍.
 * 닮음 0.5 이상, 또는 이번에 새로 생긴 블라링크 이벤트는 가장 닮은 것을 점수와 함께 띄운다.
 */
export function conversionCandidates({ eventsMap, titles, blablaEvents, newKeys = new Set(), hasText, pending = {} }) {
  const mapped = new Set([...Object.values(eventsMap).filter(Boolean), ...Object.keys(pending)]);
  const pendingFiles = new Set(Object.values(pending).map((p) => p?.금서고));
  const nulls = Object.entries(eventsMap).filter(([k, v]) => !k.startsWith('_') && v === null && !pendingFiles.has(k)).map(([k]) => k);
  const free = blablaEvents.filter((e) => !mapped.has(e.key) && hasText(e));
  const out = [];
  for (const e of free) {
    const scored = nulls
      .map((file) => {
        const score = Math.max(similarity(norm(e.key), norm(file)), similarity(norm(e.key), norm(titles.get(file))));
        return { file, title: titles.get(file) ?? '', score };
      })
      .sort((a, b) => b.score - a.score);
    const picks = scored.filter((c) => c.score >= 0.5);
    if (!picks.length && newKeys.has(e.key) && scored[0]) picks.push(scored[0]);
    for (const c of picks) out.push({ blabla: e.key, isNew: newKeys.has(e.key), ...c });
  }
  return { candidates: out, unmappedBlabla: free.map((e) => e.key) };
}

async function main() {
  const { values } = parseArgs({ options: { 'no-library': { type: 'boolean', default: false } } });
  const started = new Date();

  // 0. 지난 상태
  const before = {
    scenes: new Set(Object.values(readJson(path.join(RAW_DIR, 'scene-ids.json'), { bySource: {} }).bySource).flat()),
    episodes: new Set((readJson(path.join(RAW_DIR, 'episode-index.json'), { episodes: [] }).episodes).map((e) => e.groupId)),
    events: new Set(archiveEvents(readJson(ARCHIVE_LIST, [])).map((e) => e.key)),
    episodeRids: new Set((readJson(path.join(RAW_DIR, 'episode-index.json'), { episodes: [] }).episodes).map((e) => e.resourceId)),
    chapters: mainChapters(readJson(MAIN_LIST, [])),
    libraryFiles: new Set(Object.keys(readJson(LIBRARY_FETCHED, { files: {} }).files ?? {})),
  };
  const collector = await new Collector({ rawDir: RAW_DIR }).init();
  const missingBefore = new Set(collector.missingPaths);

  // 1. 인덱스만 다시 받는다
  console.log('블라링크 인덱스를 새로 받는다');
  let indexResults;
  try {
    collector.force = true;
    indexResults = await fetchIndexes(collector);
    collector.force = false;
    // 목록이 404면 받아 둔 것을 덮지 않았어도 아래가 빈 목록으로 scene-ids.json을 쓴다 — 여기서 멈춘다
    const lost = [...indexResults.values()].filter((r) => r.source && !r.json);
    if (lost.length) throw new ObfuscationBrokenError(lost.length);
    await fetchFavorites(collector, { quiet: true });

    // 2. 씬 · 호감도 — 캐시 우선이라 새 것과 앞서 없던 것만 받는다
    await collectScenes(collector, indexResults);
    console.log('');
    await collectEpisodes(collector, { recheckEmpty: true });
  } catch (err) {
    await collector.saveManifest();
    if (err instanceof ObfuscationBrokenError) {
      console.error(`\n⚠ 번들에서 규칙 재추출 필요 — ${err.message}`);
      process.exit(2);
    }
    throw err;
  }

  const after = {
    scenes: new Set(Object.values(readJson(path.join(RAW_DIR, 'scene-ids.json'), { bySource: {} }).bySource).flat()),
    episodes: readJson(path.join(RAW_DIR, 'episode-index.json'), { episodes: [] }).episodes,
    events: archiveEvents(readJson(ARCHIVE_LIST, [])),
  };
  const missingAfter = new Set(collector.missingPaths);
  const newScenes = [...after.scenes].filter((id) => !before.scenes.has(id));
  const newEpisodes = after.episodes.filter((e) => !before.episodes.has(e.groupId));
  const newEvents = after.events.filter((e) => !before.events.has(e.key));
  const recovered = [...missingBefore].filter((p) => !missingAfter.has(p));
  const sceneFile = (id) => path.join(RAW_DIR, `scene/ko/scene_detail_${id}.json`);
  const hasText = (e) => e.ids.some((id) => readJson(sceneFile(id), null));

  // 3. 금서고
  let library = null;
  if (!values['no-library']) {
    console.log('\n금서고');
    library = await syncLibrary();
  }

  // 4. 전환 후보
  const eventsMap = readJson(EVENTS_MAP_PATH, {});
  // 전환 대기(annotations/hold.json에서 금서고 파일이 붙은 블라링크 이벤트) — 이미 확정했으니 후보로 다시 띄우지 않는다
  const hold = Object.entries(readJson(HOLD_PATH, {})).filter(([k]) => !k.startsWith('_'));
  const pending = Object.fromEntries(hold.filter(([, v]) => v?.금서고));
  const titles = new Map();
  for (const item of readJson(LIBRARY_MANIFEST, [])) {
    const key = `${item.categoryKey}/${item.mainChapterFile}`;
    if (!titles.has(key)) titles.set(key, item.title);
  }
  const { candidates, unmappedBlabla } = conversionCandidates({
    eventsMap,
    titles,
    blablaEvents: after.events,
    newKeys: new Set(newEvents.map((e) => e.key)),
    hasText,
    pending,
  });
  // 키가 있는데 블라링크 원문이 이제 생긴 것 — 수집 · DB가 자동으로 블라링크로 돌아간다
  const switched = Object.entries(eventsMap)
    .filter(([k, v]) => v && !k.startsWith('_'))
    .filter(([, v]) => recovered.some((p) => p.includes(`scene_detail_${v}_`)));

  // 5. 새 단위는 hold "업데이트 전"으로 — 그 패치의 U1이 들인다
  const holdFile = readJson(HOLD_PATH, {});
  const holdAdded = holdNewUnits(holdFile, {
    // 매핑에 키가 있는 이벤트(금서고가 대신 읽힌 것)는 본문이 오면 전환 대기로 — 여기서는 뺀다
    events: newEvents.map((e) => e.key).filter((k) => !Object.values(eventsMap).includes(k)),
    episodes: [...new Set(newEpisodes.map((e) => e.resourceId))].filter((rid) => !before.episodeRids.has(rid)),
    chapters: [...mainChapters(readJson(MAIN_LIST, []))].filter((k) => !before.chapters.has(k)),
    libraryFiles: (library?.written ?? []).filter((k) => !before.libraryFiles.has(k)),
    switched,
    day: started.toISOString().slice(0, 10),
  });
  if (holdAdded.length) await fs.writeFile(HOLD_PATH, JSON.stringify(holdFile, null, 2) + '\n');

  // 6. 리포트
  const L = [];
  L.push('# 증분 수집 리포트');
  L.push('');
  L.push(`\`node tools/blabla/update.mjs\` 마지막 실행: ${started.toISOString().slice(0, 16).replace('T', ' ')} UTC. 원문은 싣지 않는다(키 · 개수만).`);
  L.push('');
  L.push('## 블라링크');
  L.push('');
  L.push(`- 새 씬 ${newScenes.length}${newScenes.length ? ` — ${summarize(newScenes)}` : ''}`);
  L.push(`- 새 이벤트 ${newEvents.length}${newEvents.length ? ` — ${newEvents.map((e) => `\`${e.key}\`(씬 ${e.ids.length}${hasText(e) ? '' : ' · 본문 없음'})`).join(' · ')}` : ''}`);
  L.push(`- 새 호감도 스토리 ${newEpisodes.length}${newEpisodes.length ? ` — ${[...new Set(newEpisodes.map((e) => e.character))].join(' · ')}` : ''}`);
  L.push(`- 앞서 없던 것 중 이번에 받음 ${recovered.length}${recovered.length ? ` — ${summarize(recovered.map(shortPath))}` : ''}`);
  L.push(`- 아직 없음 ${missingAfter.size}${missingAfter.size ? ` — ${summarize([...missingAfter].map(shortPath))}` : ''}`);
  L.push('');
  L.push('## 금서고');
  L.push('');
  if (!library) L.push('- 이번에는 보지 않았다(`--no-library`).');
  else {
    L.push(`- 사이트 배포 ${library.siteVersion}${library.listChanged ? ' — 바뀌어 목록을 다시 받았다' : ' — 그대로'}`);
    L.push(`- 받은 파일 ${library.written.length}${library.written.length ? ` — ${library.written.map((k) => `\`${k}\``).join(' · ')}` : ''}`);
    if (library.missing.length) L.push(`- 404 ${library.missing.length} — ${library.missing.map((k) => `\`${k}\``).join(' · ')}`);
    if (library.unmapped.length)
      L.push(`- 매핑에 없는 이벤트 파일 ${library.unmapped.length} — ${library.unmapped.map((f) => `\`${f.key}\`(${f.title})`).join(' · ')} → annotations/forbidden-library-events.json에 적어야 받는다`);
  }
  L.push('');
  L.push('## 들이지 않은 원문에 넣은 것');
  L.push('');
  L.push(holdAdded.length ? `- annotations/hold.json ${holdAdded.length} — ${holdAdded.map((k) => `\`${k}\`(${holdFile[k].까닭})`).join(' · ')}` : '- 없음.');
  L.push('');
  L.push('## 금서고 → 블라링크 전환');
  L.push('');
  L.push(`매핑 null ${Object.values(eventsMap).filter((v) => v === null).length}건(전환 대기 포함). 후보는 Claude가 두 원문을 대조해 확정하고 매핑의 null을 블라링크 키로 바꾼다(SESSIONS.md N2a).`);
  L.push('');
  const pendingKeys = Object.keys(pending);
  if (pendingKeys.length)
    L.push(`- 확정 · 기록 옮기기 전(annotations/hold.json — 블라링크 쪽은 단위로 안 만든다): ${pendingKeys.map((k) => `\`${k}\` ← \`${pending[k].금서고}\``).join(' · ')} → \`node tools/forbidden-library/convert.mjs <키>\``);
  if (switched.length) L.push(`- 블라링크 원문이 새로 들어와 자동으로 돌아감: ${switched.map(([k, v]) => `\`${k}\` → \`${v}\``).join(' · ')} — 그 금서고 단위에 기록이 있으면 \`node tools/forbidden-library/convert.mjs <키>\`로 옮긴다`);
  if (candidates.length) {
    L.push('- 전환 후보:');
    for (const c of candidates) L.push(`  - \`${c.blabla}\`${c.isNew ? '(새)' : ''} ↔ \`${c.file}\`(${c.title}) — 이름 닮음 ${c.score.toFixed(2)}`);
  } else L.push('- 전환 후보 없음.');
  L.push(`- 매핑에 안 든 블라링크 이벤트(본문 있음) ${unmappedBlabla.length}${unmappedBlabla.length ? ` — ${unmappedBlabla.map((k) => `\`${k}\``).join(' · ')}` : ''}`);
  L.push('');
  await fs.writeFile(REPORT, L.join('\n'));

  const { fetched, cached, bytes } = collector.stats;
  console.log(`\n요청 ${fetched}건 받음 (${formatBytes(bytes)}) · 캐시 ${cached}`);
  console.log(`새 씬 ${newScenes.length} · 새 이벤트 ${newEvents.length} · 새 호감도 ${newEpisodes.length} · 이번에 받은 누락 ${recovered.length} · 아직 없음 ${missingAfter.size}`);
  console.log(`전환 후보 ${candidates.length}${switched.length ? ` · 자동 전환 ${switched.length}` : ''} · hold에 넣음 ${holdAdded.length}`);
  console.log(`리포트: ${path.relative(ROOT, REPORT)}`);
  if (fetched || library?.written.length) console.log('data/raw/가 바뀌었다 — 원본 레포에 먼저 push하고 포인터를 커밋한다(CLAUDE.md "브랜치 규칙").');
}

const shortPath = (p) => p.replace(/^scene\/ko\/scene_detail_/, '').replace(/^attractscene\//, '').replace(/(-ko)?\.json$/, '');

/** 긴 ID 목록을 접두별 개수로 줄인다: event_foo 12 · d_main_40 8 … */
function summarize(ids) {
  const groups = new Map();
  for (const id of ids) {
    const g = id.match(/^(event_[A-Za-z0-9]+|d_main_\d+|d_nikke_[a-z0-9]+|[a-z]+_[A-Za-z0-9]+)/)?.[1] ?? id;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  return [...groups].map(([g, n]) => `\`${g}\` ${n}`).join(' · ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
