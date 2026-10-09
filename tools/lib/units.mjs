/**
 * 읽기 단위 — 카테고리 하나(메인 챕터 · 아카이브 이벤트 · 돌발 건물 · 인물 · 금서고 단위)와 그 키.
 * tools/read.mjs와 tools/records.mjs(1회독 기록 도구)가 같은 키를 쓰도록 여기 둔다.
 *
 * 키: 메인 `ch07`(번호는 locale_key에서 — main:N의 N은 챕터 번호가 아니다) · 이벤트 `event_…`(id_prefix) ·
 * 돌발 `sudden:N` · 인물 `char:<resource_id>` · 금서고 `fl:` `side:` `sub:` `relic:` `erelic:`(카테고리 ID 그대로).
 * 이름은 게임 데이터에서 온다. 이벤트만 예외 — 게임 데이터에 표시명이 없어 시트 제목을 라벨로 빌려 쓴다(키는 event_… ID).
 */

export const pad2 = (n) => String(n).padStart(2, '0');

/** 금서고 단위(source fl-…)는 메인 순서에 넣기로 한 것(사이드 · 서브퀘스트 · 유실물)을 메인 뒤에, 이벤트 쪽은 이벤트 뒤에 둔다 */
export const SOURCE_ORDER = {
  main: 0, 'fl-side': 0.2, 'fl-subquest': 0.4, 'fl-relic': 0.6,
  archive: 1, 'fl-event': 1.2, 'fl-eventrelic': 1.4, sudden: 2, episode: 3,
};

export const KIND_LABEL = {
  main: '메인', archive: '이벤트', sudden: '돌발', episode: '인물',
  'fl-event': '이벤트(금서고)', 'fl-side': '사이드 스토리(금서고)', 'fl-subquest': '서브퀘스트(금서고)',
  'fl-relic': '유실물(금서고)', 'fl-eventrelic': '이벤트 유실물(금서고)',
};

export const isLibrary = (source) => Boolean(source?.startsWith('fl-'));

/**
 * categories 행 → 단위 목록(정렬됨). 단위: { cat, source, key, title, sort, names, num?, rid?, speaker?, library?, gameKey? }
 * @param {object[]} categories `SELECT * FROM categories`
 */
export function buildUnits(categories) {
  const units = categories.map((c) => {
    const u = { cat: c, source: c.source, sort: [SOURCE_ORDER[c.source] ?? 9, c.order_index ?? 0] };
    if (c.source === 'main') {
      const num = Number(c.locale_key?.match(/chapter_name_(\d+)/)?.[1]);
      Object.assign(u, { key: `ch${pad2(num)}`, num, title: `CHAPTER.${pad2(num)} ${c.name}`, sort: [0, num] });
      u.names = [c.name, u.title, u.key];
    } else if (c.source === 'archive') {
      Object.assign(u, { key: c.id_prefix, title: c.name ?? c.id_prefix });
      u.names = [c.name, c.id_prefix, c.id_prefix.replace(/^event_/, ''), c.id];
    } else if (c.source === 'sudden') {
      Object.assign(u, { key: c.id, title: c.name ?? c.id });
      u.names = [c.name, c.id];
    } else if (c.source === 'episode') {
      Object.assign(u, { key: `char:${c.resource_id}`, title: c.name, rid: c.resource_id, speaker: c.name });
      u.names = [c.name, u.key];
    } else if (isLibrary(c.source)) {
      Object.assign(u, { key: c.id, title: c.name ?? c.id, library: true, gameKey: c.game_key });
      u.names = [c.name, c.id, c.id.replace(/^[a-z]+:/, '')];
    }
    return u;
  }).filter((u) => u.key);
  units.sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1]);
  return units;
}
