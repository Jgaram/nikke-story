/**
 * T2-2/T2-4/T2-8 — 원본 JSON을 정규화한다.
 *
 * 입력: data/raw/ (수집기 결과 — 블라링크 + 금서고) + annotations/ (시트, 별칭, 금서고 이벤트 매핑, 분석 범위, 인물 사전)
 * 출력: data/normalized/*.json
 *
 *   node tools/normalize/build.mjs
 *
 * 스키마와 ID 규칙은 docs/schema.md. 핵심만:
 *   - 대사 본문 필드가 씬은 quest_name, 호감도 스토리(episode)는 scenario_localkey다
 *   - 모든 값이 { value: ... } 래퍼로 한 겹 싸여 있다
 *   - 씬 ID는 대소문자를 구분한다 (event_BunnyX777)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePrereq } from './parse-prereq.mjs';
import { parseCsv } from './csv.mjs';
import { readLibrary } from './library.mjs';
import { inputsFingerprint } from './ensure-db.mjs';
import { applyScope, buildDictionary, countTermMentions, resolveSpeakers, TARGET_TYPES } from './dictionary.mjs';
import { buildMentions } from './mentions.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'data/raw');
const OUT = path.join(ROOT, 'data/normalized');
const LANG = 'ko';

const readJson = async (rel) => JSON.parse(await fs.readFile(path.join(RAW, rel), 'utf8'));
const readJsonMaybe = async (rel) => {
  try {
    return await readJson(rel);
  } catch {
    return null;
  }
};

/** 중첩된 곳에서 scenario_group_id를 순서대로 끌어낸다 (Set이 아니라 배열 — 순서가 의미를 갖는다) */
function walkScenes(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.scenario_group_id === 'string') {
    out.push({
      id: node.scenario_group_id,
      title: node.scenario_name_localkey?.scenario_name ?? null,
    });
  }
  for (const v of Object.values(node)) walkScenes(v, out);
  return out;
}

/** scene_list / sudden_list 공통 구조: 카테고리 배열 → 씬 배열 */
function readSceneList(list, source) {
  const categories = [];
  const stories = [];
  for (const cat of list) {
    const name = cat.sub_category_name_localkey?.chapter_name ?? null;
    const key = cat.sub_category_name_localkey?.value ?? null;
    const categoryId = `${source}:${cat.id}`;
    categories.push({
      id: categoryId,
      source,
      name,
      localeKey: key,
      orderIndex: categories.length,
    });
    const scenes = cat.sub_category_id?.scenes?.value ?? [];
    scenes.forEach((s, i) => {
      stories.push({
        id: s.value.scenario_group_id,
        kind: 'scene',
        source,
        categoryId,
        title: s.scenario_name_localkey?.scenario_name ?? null,
        orderIndex: i,
        isHidden: Boolean(s.value.is_hidden),
      });
    });
  }
  return { categories, stories };
}

/**
 * archive_list는 62개 앨범 항목 안에 이벤트 씬을 중첩해 품고 있다.
 * 항목 하나 = 이벤트 하나로 보고 묶는다. 이벤트 표시명은 데이터에 없으므로
 * 씬 ID의 접두를 임시 이름으로 쓰고, 시트 조인에서 실제 제목으로 덮는다.
 */
function readArchiveList(list) {
  const categories = [];
  const stories = [];
  const seen = new Set();

  for (const entry of list) {
    const scenes = walkScenes(entry);
    if (!scenes.length) continue;
    const eventId = entry.record_main_archive_event_id?.value ?? entry.id;
    // 접두는 대소문자를 보존한다 — event_BunnyX777
    const prefix = scenes[0].id.match(/^event_([A-Za-z0-9]+)/)?.[1] ?? String(eventId);
    const categoryId = `archive:${eventId}`;
    categories.push({
      id: categoryId,
      source: 'archive',
      name: null,
      idPrefix: `event_${prefix}`,
      eventId,
      orderIndex: categories.length,
    });
    scenes.forEach((s, i) => {
      if (seen.has(s.id)) return;
      seen.add(s.id);
      stories.push({
        id: s.id,
        kind: 'scene',
        source: 'archive',
        categoryId,
        title: s.title,
        orderIndex: i,
        isHidden: false,
      });
    });
  }
  return { categories, stories };
}

/**
 * 원본이 화자 칸(speaker)에 창 종류를 그대로 넣은 가짜 화자. 사람이 아니므로 speakerId에서 뺀다.
 * 창 종류는 window에 그대로 남는다. `Self`는 지휘관(플레이어) 대사다.
 */
const PSEUDO_SPEAKERS = new Set(['Self', 'Monologue', 'Narration', 'Choice']);
const speakerCode = (v) => (v && !PSEUDO_SPEAKERS.has(v) ? v : null);

/**
 * 선택지·분기의 jump_target(레코드 id)을 같은 씬 안의 seq로 바꾼다.
 * 선택지(Choice)는 그 선택의 응답이 시작하는 줄로, 분기 끝 줄은 합류 지점으로 뛴다.
 */
const seqIndex = (records, idOf) => new Map(records.map((r, i) => [idOf(r), i]));
const jumpStats = { total: 0, missing: 0 };
function jumpSeq(seqOf, target) {
  if (!target) return null;
  jumpStats.total++;
  if (!seqOf.has(target)) jumpStats.missing++; // 같은 씬 밖을 가리키면 버린다 (2026-09 기준 0건)
  return seqOf.get(target) ?? null;
}

/** 씬 본문. 대사 본문 필드가 quest_name이다 */
async function readSceneLines(storyId) {
  const j = await readJsonMaybe(`scene/${LANG}/scene_detail_${storyId}.json`);
  if (!j) return null;
  const records = j.scenario_group_id?.records?.value ?? [];
  const seqOf = seqIndex(records, (r) => r.value?.id);
  return {
    title: j.scene_name ?? null,
    lines: records.map((r, i) => ({
      seq: i,
      speakerId: speakerCode(r.value?.speaker),
      speakerName: r.speaker?.name_localkey?.character_name ?? null,
      text: r.quest_name ?? '',
      window: r.value?.speech_window ?? null,
      jumpTo: jumpSeq(seqOf, r.value?.jump_target),
    })),
  };
}

/** 호감도 스토리(episode) 본문. 여기는 scenario_localkey가 본문이고, 이름표는 speaker_detail.name_localkey다 */
async function readEpisodeLines(groupId) {
  const j = await readJsonMaybe(`attractscene/${groupId}-${LANG}.json`);
  if (!j) return null;
  const records = j.records ?? [];
  const seqOf = seqIndex(records, (r) => r.id);
  return {
    lines: records.map((r, i) => ({
      seq: i,
      speakerId: speakerCode(r.speaker),
      speakerName: r.speaker_detail?.name_localkey ?? null,
      text: r.scenario_localkey ?? '',
      window: r.speech_window ?? null,
      jumpTo: jumpSeq(seqOf, r.jump_target),
    })),
  };
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '');

async function main() {
  // 입력을 읽기 전에 지문을 뜬다. 읽는 도중 입력이 바뀌면 DB에 남는 지문이 달라져 ensure-db가 다시 만든다
  const inputs = inputsFingerprint();
  await fs.mkdir(OUT, { recursive: true });
  console.log('원본 읽기');

  const [mainList, suddenList, archiveList, nikkeList, favoriteRareMap] = await Promise.all([
    readJson(`scene/${LANG}/scene_list.json`),
    readJson(`scene/${LANG}/sudden_list.json`),
    readJson(`archive/${LANG}/archive_list.json`),
    readJson(`character/${LANG}/nikke_list_v2.json`),
    readJson('equip/favorite_rare_map.json'),
  ]);
  const episodeIndex = (await readJson('episode-index.json')).episodes;

  // ---- 카테고리 & 씬 노드 ----
  const m = readSceneList(mainList, 'main');
  const s = readSceneList(suddenList, 'sudden');
  const a = readArchiveList(archiveList);

  const categories = [...m.categories, ...s.categories, ...a.categories];
  const stories = [...m.stories, ...s.stories, ...a.stories];
  console.log(`  카테고리 ${categories.length} / 씬 ${stories.length}`);

  // ---- 씬 본문 ----
  const lines = [];
  let withText = 0;
  for (const story of stories) {
    const body = await readSceneLines(story.id);
    if (!body) { story.hasText = 0; story.lineCount = 0; continue; }
    withText++;
    story.hasText = 1;
    story.lineCount = body.lines.length;
    if (body.title && !story.title) story.title = body.title;
    for (const l of body.lines) lines.push({ storyId: story.id, ...l });
  }
  console.log(`  씬 본문 ${withText}/${stories.length} · 대사 ${lines.length.toLocaleString('ko-KR')}줄`);

  // ---- 금서고(보조 출처): 사이드 스토리 · 서브퀘스트 · 유실물 · 이벤트 유실물 · 블라링크에 원문이 없는 이벤트 ----
  // 블라링크 아카이브에 원문이 있는 이벤트는 금서고 것을 쓰지 않는다 — 블라링크가 이긴다 (library.mjs)
  const archiveWithText = new Set(
    a.categories.filter((c) => stories.some((st) => st.categoryId === c.id && st.hasText)).map((c) => c.idPrefix),
  );
  const lib = readLibrary({ blablaHasText: (key) => archiveWithText.has(key) });
  categories.push(...lib.categories);
  stories.push(...lib.stories);
  for (const l of lib.lines) lines.push(l);
  const libBySource = {};
  for (const c of lib.categories) libBySource[c.source] = (libBySource[c.source] ?? 0) + 1;
  console.log(
    `  금서고 ${lib.categories.length}단위 (${Object.entries(libBySource).map(([k, v]) => `${k} ${v}`).join(' · ')})` +
      ` · 씬 ${lib.stories.length} · 대사 ${lib.lines.length.toLocaleString('ko-KR')}줄` +
      (lib.skipped.length ? ` · 블라링크에 있어 뺀 이벤트 ${lib.skipped.length}` : ''),
  );
  if (lib.notes.length) {
    console.log(`  ⚠ 금서고 형식 문제 ${lib.notes.length}건`);
    for (const n of lib.notes.slice(0, 10)) console.log(`    ${n}`);
  }

  // ---- 캐릭터 ----
  const characters = nikkeList.map((n) => ({
    resourceId: n.resource_id,
    name: n.name_localkey?.name ?? null,
    nameCode: n.name_code,
    corporation: n.corporation ?? null,
    klass: n.class ?? null,
    rarity: n.original_rare ?? null,
  }));
  const charByRid = new Map(characters.map((c) => [c.resourceId, c]));
  const charByCode = new Map();
  for (const c of characters) if (!charByCode.has(c.nameCode)) charByCode.set(c.nameCode, c);

  // ---- 호감도 스토리(episode) 노드 & 본문 ----
  const episodeByGroup = new Map();
  for (const ep of episodeIndex) {
    const id = `ep:${ep.groupId}`;
    const categoryId = `char:${ep.resourceId}`;
    if (!categories.some((c) => c.id === categoryId)) {
      categories.push({
        id: categoryId,
        source: 'episode',
        name: ep.character,
        resourceId: ep.resourceId,
        orderIndex: categories.length,
      });
    }
    const body = await readEpisodeLines(ep.groupId);
    const story = {
      id,
      kind: 'episode',
      source: 'episode',
      categoryId,
      title: ep.title,
      orderIndex: ep.level ?? 0,
      isHidden: false,
      hasText: body ? 1 : 0,
      lineCount: body?.lines.length ?? 0,
      character: ep.character,
      resourceId: ep.resourceId,
      attractiveLevel: ep.level ?? null,
      requires: ep.requires ?? null,
    };
    stories.push(story);
    episodeByGroup.set(ep.groupId, story);
    for (const l of body?.lines ?? []) lines.push({ storyId: id, ...l });
  }
  const epLines = lines.filter((l) => l.storyId.startsWith('ep:'));
  const epNamed = epLines.filter((l) => l.speakerName).length;
  console.log(
    `  호감도 스토리 ${episodeIndex.length}편 · 대사 ${epLines.length.toLocaleString('ko-KR')}줄` +
      ` (이름표 있음 ${epNamed.toLocaleString('ko-KR')}줄)`,
  );
  const jumpNote = jumpStats.missing ? ` — ⚠ 같은 씬에서 못 찾은 대상 ${jumpStats.missing}개` : '';
  console.log(`  선택지·분기 이동 ${jumpStats.total.toLocaleString('ko-KR')}개${jumpNote}`);

  // ---- 애장품 노드 ----
  const favoriteIds = Object.values(favoriteRareMap).flat();
  const favorites = [];
  for (const fid of favoriteIds) {
    const j = await readJsonMaybe(`equip/${LANG}/favorite_${fid}.json`);
    if (!j) continue;
    const owner = charByCode.get(j.name_code) ?? null;
    favorites.push({ itemId: fid, name: j.name_localkey, nameCode: j.name_code, owner: owner?.name ?? null, rare: j.favorite_rare });
    stories.push({
      id: `fav:${fid}`,
      kind: 'favorite',
      source: 'equip',
      categoryId: owner ? `char:${owner.resourceId}` : null,
      title: j.name_localkey,
      orderIndex: 0,
      isHidden: false,
      hasText: 0,       // 애장품에는 대사 데이터가 없다 (docs/coverage.md)
      lineCount: 0,
      description: j.description_localkey ?? null,
      nameCode: j.name_code ?? null,
      owner: owner?.name ?? null,
      resourceId: owner?.resourceId ?? null,
      rarity: j.favorite_rare,
    });
  }
  console.log(`  애장품 ${favorites.length}종 (대사 없음)`);

  // ---- 시트 조인 (참고용) ----
  // 시트는 참고자료다(docs/reference-table.md). 여기서 붙이는 유형·★·선행·출시일은 나중에 비교해 보려고
  // 연결만 해 두는 값이고, 분석의 입력이나 정답이 아니다. 시트와 데이터가 다르면 데이터를 따른다.
  const sheetCsv = await fs.readFile(path.join(ROOT, 'data/raw/imported/story-relations-sheet.csv'), 'utf8');
  const aliases = JSON.parse(await fs.readFile(path.join(ROOT, 'annotations/aliases.json'), 'utf8'));
  const sheetRows = parseCsv(sheetCsv).filter((r) => r['유형']);

  /**
   * 비교 키: 대소문자·공백·문장부호를 무시한다. 시트 제목에는 `D.ARK HERO`, `CLAY, MORE!`,
   * `Queen's Order`, `BOW-WOW PARADISE`처럼 문장부호가 들어가는데 씬 ID 접두(event_darkhero)에는 없다.
   * `_`만은 남긴다 — 아카이브 접두(`event_…`)도 이 키로 바꿔 비교하므로, 지우면 접두 매칭이 통째로 깨진다.
   */
  const nk = (x) => (x ?? '').replace(/[^\p{L}\p{N}_]/gu, '').toLowerCase();
  const charAliasToRid = new Map(aliases.characters.map((x) => [nk(x.sheet), x.resourceId]));
  // 이벤트 별칭: idPrefix(블라링크 아카이브) 또는 library(금서고 단위 키)로 잇는다
  const eventAlias = new Map(aliases.events.map((x) => [nk(x.sheet), x]));
  const favAliasToId = new Map((aliases.favorites ?? []).map((x) => [nk(x.sheet), x.itemId]));
  const titleFixes = new Map(
    Object.entries(aliases.prereqTitleFixes ?? {}).filter(([k]) => k !== '_comment').map(([k, v]) => [nk(k), v]),
  );
  const freeform = new Set((aliases.prereqFreeform?.items ?? []).map(nk));

  /**
   * 선행 칼럼의 표기로 만들어 볼 후보들을 넓은 것부터 좁은 것 순으로 낸다.
   * 원문을 먼저 시도하는 게 중요하다 — `YOU CAN (NOT) EVADE`처럼
   * 괄호가 제목의 일부인 경우가 있어서, 괄호를 먼저 떼면 매칭이 깨진다.
   */
  function prereqTitleCandidates(raw) {
    const base = raw.trim();
    const out = [base];
    const fixed = titleFixes.get(nk(base));
    if (fixed) out.push(fixed);
    const noPart = base.replace(/\s*\(?\s*[12]부\s*\)?\s*$/, '').trim();
    if (noPart !== base) {
      out.push(noPart);
      const f2 = titleFixes.get(nk(noPart));
      if (f2) out.push(f2);
    }
    // 괄호 주석 제거는 마지막 수단이다
    const noParen = base.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (noParen && noParen !== base) {
      out.push(noParen);
      const f3 = titleFixes.get(nk(noParen));
      if (f3) out.push(f3);
    }
    return [...new Set(out)].filter(Boolean);
  }

  const catByPrefix = new Map(a.categories.map((c) => [nk(c.idPrefix), c]));
  const libByName = new Map(lib.categories.map((c) => [nk(c.name), c]));
  const libById = new Map(lib.categories.map((c) => [c.id, c]));
  const catByChapterNum = new Map();
  const chapterNumByName = new Map();
  for (const c of m.categories) {
    const n = c.localeKey?.match(/chapter_name_(\d+)/)?.[1];
    if (n === undefined) continue;
    catByChapterNum.set(Number(n), c);
    if (c.name) chapterNumByName.set(c.name, Number(n));
  }
  /** 시트의 챕터 표기에서 번호/이름 충돌을 잡아낸다. 자동 교정하지 않고 보고한다 */
  const dataIssues = [];
  const ridByCharName = new Map();
  for (const ep of episodeIndex) if (!ridByCharName.has(nk(ep.character))) ridByCharName.set(nk(ep.character), ep.resourceId);
  const favByName = new Map(favorites.map((f) => [nk(f.name), f]));
  const favById = new Map(favorites.map((f) => [f.itemId, f]));

  /** 시트 제목 → 이 프로젝트의 노드 또는 카테고리 */
  function resolveSheetTitle(title, type) {
    const key = nk(title);

    // `CHAPTER.07 재회`, `CHAPTER.7 재회`, `CHAPTER 46 신생` 모두 받는다. 번호가 권위다.
    const chapter = title.match(/CHAPTER\.?\s*(\d+)\s*(.*)$/i);
    if (chapter) {
      const num = Number(chapter[1]);
      // 이름 비교에서는 괄호 주석을 뗀다. `CHAPTER.32 전진 (예외적으로…)`을 충돌로 보지 않게
      const givenName = chapter[2].replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      const cat = catByChapterNum.get(num);
      if (cat) {
        if (givenName && cat.name && givenName !== cat.name) {
          dataIssues.push({
            kind: 'chapter-name-mismatch',
            text: title,
            byNumber: `CHAPTER.${String(num).padStart(2, '0')} ${cat.name}`,
            byName: chapterNumByName.has(givenName)
              ? `CHAPTER.${String(chapterNumByName.get(givenName)).padStart(2, '0')} ${givenName}`
              : null,
          });
        }
        return { kind: 'category', categoryId: cat.id, name: cat.name };
      }
    }

    if (type === '에피소드') {
      const rid = charAliasToRid.get(key) ?? ridByCharName.get(key);
      if (rid !== undefined) return { kind: 'category', categoryId: `char:${rid}`, resourceId: rid };
    }

    if (type === '애장품') {
      const fav = favByName.get(key) ?? favById.get(favAliasToId.get(key));
      if (fav) return { kind: 'story', storyId: `fav:${fav.itemId}` };
    }

    // 이벤트·퀘스트·사이드: 별칭 우선, 없으면 접두 매칭
    const alias = eventAlias.get(key);
    if (alias) {
      const cat = alias.idPrefix ? catByPrefix.get(nk(alias.idPrefix)) : libById.get(alias.library);
      if (cat) return { kind: 'category', categoryId: cat.id };
    }
    for (const [pk, cat] of catByPrefix) {
      const bare = pk.replace(/^event_/, '');
      const stripped = bare.replace(/\d+$/, '');
      if (key === bare || key === stripped || (key.length >= 4 && (key.startsWith(stripped) || stripped.startsWith(key)))) {
        return { kind: 'category', categoryId: cat.id };
      }
    }
    // 금서고 단위(사이드 스토리 · 블라링크에 없는 이벤트 등)는 제목이 같을 때만 잇는다
    const lib = libByName.get(key);
    if (lib) return { kind: 'category', categoryId: lib.id };
    return null;
  }

  /** 시트 제목 목록에 없는 표기(`CHAPTER.9 비밀` 등)를 resolveSheetTitle로 직접 해석한다 */
  function resolveLooseTitle(title) {
    for (const type of ['메인', '에피소드', '애장품', '이벤트']) {
      const t = resolveSheetTitle(title, type);
      if (t) return { target: t };
    }
    return null;
  }

  const storyById = new Map(stories.map((x) => [x.id, x]));
  const catById = new Map(categories.map((x) => [x.id, x]));
  const sheetOut = [];
  const edges = [];
  const titleToTarget = new Map();   // 선행 파싱용: 시트 제목 → 타깃
  let joined = 0;

  for (const [i, r] of sheetRows.entries()) {
    const type = r['유형'];
    const target = resolveSheetTitle(r['제목'], type);
    if (target) joined++;

    // 시트 메타데이터를 노드에 얹는다
    const apply = (st) => {
      st.sheetType = type;
      st.releaseDate = r['출시일'] || null;
      st.importance = r['중요도'] || null;
      st.accessibility = r['접근성'] || null;
      st.sheetTitle = r['제목'];
    };
    if (target?.kind === 'story') apply(storyById.get(target.storyId));
    if (target?.kind === 'category') {
      const cat = catById.get(target.categoryId);
      if (cat) { cat.sheetTitle = r['제목']; cat.sheetType = type; if (!cat.name) cat.name = r['제목']; }
      for (const st of stories) if (st.categoryId === target.categoryId) apply(st);
    }

    // 원문 없는 시트 전용 노드
    let placeholderId = null;
    if (!target) {
      placeholderId = `sheet:${slug(r['제목'])}`;
      if (!storyById.has(placeholderId)) {
        const st = {
          id: placeholderId, kind: 'placeholder', source: 'sheet', categoryId: null,
          title: r['제목'], orderIndex: 0, isHidden: false, hasText: 0, lineCount: 0,
        };
        apply(st);
        stories.push(st);
        storyById.set(placeholderId, st);
      }
    }

    const parsed = parsePrereq(r['추천 선행 스토리']);
    sheetOut.push({
      rowIndex: i,
      releaseDate: r['출시일'] || null,
      sheetType: type,
      accessibility: r['접근성'] || null,
      importance: r['중요도'] || null,
      title: r['제목'],
      prereqRaw: r['추천 선행 스토리'] || null,
      isLegend: parsed.isLegend,
      unreviewed: parsed.unreviewed,
      notes: parsed.notes,
      target: target ?? (placeholderId ? { kind: 'story', storyId: placeholderId } : null),
      unresolved: [],
    });
    titleToTarget.set(nk(r['제목']), sheetOut.at(-1));
  }
  console.log(`  시트(참고) ${sheetRows.length}행 → 데이터 연결 ${joined} / 시트에만 있는 이름 ${sheetRows.length - joined}`);

  // 데이터에 있을 법한데 안 붙은 시트 행. 참고용 연결이라 경고(⚠)는 아니고 표기 차이 확인용으로 보여만 준다
  const likelyInData = (r) => ['메인', '에피소드', '애장품'].includes(r.sheetType) || r.accessibility === '아카이브O';
  const missed = sheetOut.filter((r) => likelyInData(r) && r.target?.storyId?.startsWith('sheet:'));
  if (missed.length) {
    console.log(`  시트(참고) 행 중 데이터에 있을 법한데 안 붙은 것 ${missed.length}건 — 표기 차이면 annotations/aliases.json`);
    for (const r of missed) console.log(`    [${r.sheetType}/${r.accessibility ?? '-'}] ${r.title}`);
  }

  // ---- 엣지: 게임이 들고 있는 호감도 스토리 선행 조건 ----
  let gameEdges = 0;
  let inferredEdges = 0;
  for (const ep of episodeIndex) {
    if (!ep.requires) continue;
    const from = `ep:${ep.requires}`;
    const to = `ep:${ep.groupId}`;
    if (!storyById.has(from) || !storyById.has(to)) continue;
    const inferred = ep.source === 'known-gap';
    edges.push({
      from, to, type: 'prereq', strength: 3,
      origin: inferred ? 'auto' : 'game-condition',
      note: inferred ? 'known-gap 보강 시 번호 순서로 추정' : 'condition_scenario_group_id',
    });
    if (inferred) inferredEdges++; else gameEdges++;
  }

  // ---- 엣지: 시트의 추천 선행 스토리 ----
  const targetIdsOf = (t) => {
    if (!t) return [];
    if (t.kind === 'story') return [t.storyId];
    return stories.filter((x) => x.categoryId === t.categoryId).map((x) => x.id);
  };
  let sheetEdges = 0;
  for (const row of sheetOut) {
    if (row.isLegend || !row.target) continue;
    const parsed = parsePrereq(row.prereqRaw);
    for (const item of parsed.items) {
      if (freeform.has(nk(item.title))) { row.notes.push(item.title); continue; }
      let src = null;
      for (const cand of prereqTitleCandidates(item.title)) {
        src = titleToTarget.get(nk(cand)) ?? resolveLooseTitle(cand);
        if (src?.target) break;
      }
      if (!src?.target) { row.unresolved.push(item.title); continue; }
      // 카테고리 단위 관계는 카테고리 대표(첫 씬)끼리 잇는다. 씬 단위 폭발을 막는다.
      const [fromId] = targetIdsOf(src.target);
      const [toId] = targetIdsOf(row.target);
      if (!fromId || !toId || fromId === toId) continue;
      edges.push({
        from: fromId, to: toId, type: 'prereq', strength: item.strength,
        origin: 'sheet', note: `${'◆'.repeat(item.strength)} ${item.title} → ${row.title}`,
      });
      sheetEdges++;
    }
  }
  // ---- 엣지: 애장품 → 소유 캐릭터 (name_code로 확정) ----
  let ownerEdges = 0;
  for (const st of stories) {
    if (st.kind !== 'favorite' || !st.resourceId) continue;
    const [firstEpisode] = stories.filter((x) => x.categoryId === `char:${st.resourceId}` && x.kind === 'episode');
    if (!firstEpisode) continue;
    edges.push({
      from: firstEpisode.id, to: st.id, type: 'character', strength: 3,
      origin: 'game-condition', note: `애장품 소유: ${st.owner} (name_code ${st.nameCode ?? '?'})`,
    });
    ownerEdges++;
  }
  console.log(`  엣지: 애장품 소유 ${ownerEdges}`);

  const unresolvedCount = sheetOut.reduce((n, r) => n + r.unresolved.length, 0);
  console.log(`  엣지: 게임 확정 ${gameEdges} / 추정 ${inferredEdges} / 시트(참고) ${sheetEdges} (미해석 항목 ${unresolvedCount})`);
  if (dataIssues.length) console.log(`  시트와 데이터 표기가 다른 곳 ${dataIssues.length}건(참고, 데이터를 따름) → data-issues.json`);

  // ---- 분석 범위 (결정 #5) ----
  // 범위 밖도 노드 · 대사는 그대로 둔다(read.mjs로 읽힌다). 통계 · 자동 기록 · 이름표 분류 검사만 범위 안을 본다
  const scope = applyScope(stories);
  const inScopeCount = stories.filter((x) => x.inScope).length;
  console.log(
    `  분석 범위: 안 ${inScopeCount} / 밖 ${stories.length - inScopeCount}` +
      (Object.keys(scope.out).length ? ` (${Object.entries(scope.out).map(([k, v]) => `${k.split(' — ')[0]} ${v}`).join(' · ')})` : ''),
  );

  // ---- 인물 사전 · 이름표 분류 (A1 · T2-6) ----
  const dict = buildDictionary({ characters });
  for (const c of characters) c.targetId = dict.ridTarget.get(c.resourceId) ?? null;
  const speakerTable = resolveSpeakers(lines, stories, dict);
  const targets = [...dict.targets.values()];
  const persons = targets.filter((t) => t.type === 'person');
  const kindCount = {};
  for (const t of persons) kindCount[t.kind] = (kindCount[t.kind] ?? 0) + 1;
  const scoped = speakerTable.filter((r) => r.linesInScope);
  const unresolved = scoped.filter((r) => !r.cls);
  console.log(
    `  인물 사전: 대상 ${persons.length} (${Object.entries(kindCount).map(([k, v]) => `${k} ${v}`).join(' · ')})` +
      ` · 정체 연결 후보 ${dict.links.length}` +
      ` · 이름표 ${speakerTable.length}종 (범위 안 ${scoped.length}종)`,
  );
  if (unresolved.length) {
    const n = unresolved.reduce((a, r) => a + r.linesInScope, 0);
    console.log(`  ⚠ 범위 안 미분류 이름표 ${unresolved.length}종 ${n}줄 → annotations/dictionary/speakers.json`);
    for (const r of unresolved.slice(0, 10)) console.log(`    ${r.name} (${r.linesInScope}줄)${r.note ? ` — ${r.note}` : ''}`);
  }
  // ---- 비인물 사전 · 범위 안 건수 (A2 · T3-2) ----
  const termCount = countTermMentions(lines, stories, dict);
  const termTargets = targets.filter((t) => t.type !== 'person');
  const typeCount = {};
  for (const t of termTargets) typeCount[t.type] = (typeCount[t.type] ?? 0) + 1;
  const termNames = dict.names.filter((x) => !x.targetId.startsWith('person:'));
  console.log(
    `  비인물 사전: 대상 ${termTargets.length} (${Object.entries(typeCount).map(([k, v]) => `${TARGET_TYPES[k]} ${v}`).join(' · ')})` +
      ` · 이름 ${termNames.length} (오탐 주의 ${termNames.filter((x) => x.caution).length})`,
  );
  if (termCount.zero.length) {
    console.log(`  ⚠ 범위 안 0건인 이름 ${termCount.zero.length}개 — 추측한 표기인지 확인 → annotations/dictionary/`);
    for (const x of termCount.zero.slice(0, 10)) console.log(`    ${x.name} (${x.targetId})`);
  }
  // ---- 언급 DB 자동 줄 (B2 · T3-9) ----
  const mentions = buildMentions(lines, stories, dict, speakerTable);
  const fmt = (x) => (x ?? 0).toLocaleString('ko-KR');
  console.log(
    `  언급 DB 자동 줄: ${fmt(mentions.rows.length)}행 — 말함 ${fmt(mentions.stats.byHow.speaks)}줄 · 이름 ${fmt(mentions.stats.byHow.named)}줄 · 다른 이름 ${fmt(mentions.stats.byHow.alias)}줄` +
      ` (자동에서 뺀 이름 ${mentions.stats.excluded.length})`,
  );
  dict.problems.push(...mentions.problems);
  if (dict.problems.length) {
    console.log(`  ⚠ 사전 문제 ${dict.problems.length}건`);
    for (const p of dict.problems.slice(0, 10)) console.log(`    ${p}`);
  }

  // ---- 출력 ----
  const write = async (name, data) => {
    await fs.writeFile(path.join(OUT, name), JSON.stringify(data, null, 1) + '\n');
    const { size } = await fs.stat(path.join(OUT, name));
    console.log(`  ${name.padEnd(18)} ${(size / 1024).toFixed(0).padStart(7)}KB`);
  };
  console.log('\n출력');
  await write('categories.json', categories);
  await write('stories.json', stories);
  await write('characters.json', characters);
  await write('favorites.json', favorites);
  await write('edges.json', edges);
  await write('sheet-rows.json', sheetOut);
  await write('lines.json', lines);
  await write('data-issues.json', dataIssues);
  await write('targets.json', targets);
  await write('target-names.json', dict.names);
  await write('speakers.json', speakerTable);
  await write('target-links.json', dict.links);
  await write('mentions.json', mentions.rows);
  await write('build-info.json', { inputs, builtAt: new Date().toISOString() });

  const withTextTotal = stories.filter((x) => x.hasText).length;
  console.log(
    `\n완료: 노드 ${stories.length} (원문 있음 ${withTextTotal} / 없음 ${stories.length - withTextTotal})` +
      ` · 대사 ${lines.length.toLocaleString('ko-KR')}줄 · 엣지 ${edges.length}`,
  );
}

await main();
