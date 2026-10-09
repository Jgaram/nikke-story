/**
 * T1-5 — 아카이브 이벤트 메타데이터: 이벤트마다 이름 · 아카이브 순서 · 공개일 · 파트(STORY I · II) · 씬 배열.
 * 원본은 data/raw/archive/ko/archive_list.json(앨범 항목 62 — 항목 하나 = 이벤트 하나). 빌드(tools/normalize/build.mjs)는 이벤트 → 씬만 싣고
 * 파트 묶음은 버리므로 여기서 다시 편다. 이름은 공지(DB releases) → 시트 라벨(categories.name) 순 — 게임 데이터에는 표시명이 없다.
 * 금서고 이벤트(fl:)는 아카이브에 없어 이름 · 공개일 · 씬 수만 붙는다. 본문 없는 블라링크 이벤트를 대신하는 금서고 단위는 `substitute`로 잇는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../records/model.mjs';

export const ARCHIVE_LIST = path.join(ROOT, 'data/raw/archive/ko/archive_list.json');

const arr = (x) => (Array.isArray(x) ? x : []);

/** 노드 아래 씬(scenario_group_id) — 원본 순서 그대로 */
function walkScenes(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.scenario_group_id === 'string') out.push({ id: node.scenario_group_id, title: node.scenario_name_localkey?.scenario_name ?? null });
  for (const v of Object.values(node)) walkScenes(v, out);
  return out;
}

/**
 * @param {object} ctx openContext()
 * @param {Map<string, object>} [byUnit] releasePlaces().byUnit — 읽는 자리 · 공개 자리
 * @param {string} [file] archive_list.json
 * @returns {{ events: object[], scenes: object[] }}
 *   events[i] = { order, tick, unit, source, archive_order, archive_id, event_id, type, name, date, parts, release_parts, scenes, scenes_text, substitute, prefab }
 *   scenes[i] = { unit, part_order, part, seq, scene, title, has_text, lines }
 */
export function archiveEvents(ctx, byUnit = new Map(), file = ARCHIVE_LIST) {
  const raw = Object.values(JSON.parse(fs.readFileSync(file, 'utf8')));
  const rel = new Map(ctx.db.prepare('SELECT category_id, key, name, date, parts FROM releases').all().map((r) => [r.key, r]));
  const cats = new Map(ctx.db.prepare("SELECT id, name, id_prefix FROM categories WHERE source = 'archive'").all().map((c) => [c.id, c]));
  const subOf = new Map(ctx.units.filter((u) => u.gameKey).map((u) => [u.gameKey, u.key]));
  const events = [];
  const scenes = [];
  raw.forEach((entry, i) => {
    const eventId = entry.record_main_archive_event_id?.value ?? entry.id;
    const cat = cats.get(`archive:${eventId}`);
    if (!cat) return; // 씬이 없는 항목(빌드도 건너뛴다)
    const key = cat.id_prefix;
    const groups = arr(entry.record_main_archive_event_id?.event?.child?.value);
    const parts = [];
    let seq = 0;
    groups.forEach((g, gi) => {
      const list = walkScenes(g);
      const name = g.story?.name_value ?? '';
      const order = g.value?.archive_story_progress_group_order ?? gi + 1;
      parts.push(`${name || '(파트 없음)'} ${list.length}`);
      for (const s of list) {
        const st = ctx.story(s.id);
        scenes.push({ unit: key, part_order: order, part: name, seq: ++seq, scene: s.id, title: s.title ?? '', has_text: st?.has_text ?? '', lines: st?.line_count ?? '' });
      }
    });
    const special = groups.find((g) => g.story?.album?.scene?.event_name_localkey)?.story.album.scene;
    const sub = subOf.get(key) ?? '';
    const reading = sub || key;
    const r = rel.get(key);
    const mine = scenes.filter((s) => s.unit === key);
    events.push({
      order: byUnit.get(reading)?.order ?? '', tick: byUnit.get(reading)?.tick ?? '', unit: reading, source: '아카이브',
      archive_order: i + 1, archive_id: entry.id, event_id: eventId, type: special ? '특별 이벤트' : '스토리 이벤트',
      name: r?.name ?? cat.name ?? '', date: r?.date ?? '', parts: parts.join(' · '), release_parts: r?.parts ?? '',
      scenes: mine.length, scenes_text: mine.filter((s) => s.has_text === 1).length, substitute: sub ? key : '', prefab: special?.ui_prefab ?? '',
    });
  });
  // 금서고에만 있는 이벤트 — 아카이브 순서가 없다
  const seen = new Set(events.map((e) => e.unit));
  for (const u of ctx.units.filter((x) => x.source === 'fl-event' && !seen.has(x.key))) {
    const r = rel.get(u.key);
    const n = ctx.db.prepare('SELECT COUNT(*) n, SUM(has_text) t FROM stories WHERE category_id = ?').get(u.cat.id);
    events.push({
      order: byUnit.get(u.key)?.order ?? '', tick: byUnit.get(u.key)?.tick ?? '', unit: u.key, source: '금서고',
      archive_order: '', archive_id: '', event_id: '', type: '', name: r?.name ?? u.title ?? '', date: r?.date ?? '', parts: '', release_parts: r?.parts ?? '',
      scenes: n.n, scenes_text: n.t ?? 0, substitute: '', prefab: '',
    });
  }
  events.sort((a, b) => (a.order || 1e9) - (b.order || 1e9) || (a.archive_order || 1e9) - (b.archive_order || 1e9) || a.unit.localeCompare(b.unit));
  return { events, scenes };
}
