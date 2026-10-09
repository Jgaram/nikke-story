/**
 * 기록 도구가 DB에서 보는 것 — 단위 · 씬 · 대사 · 대상. 검증기 · 리뷰 도구 · 인계 파일이 같이 쓴다.
 * 1회독 기록(annotations/read1/)은 DB 빌드 입력이 아니다 — 도구가 JSON을 바로 읽고, DB는 원문 확인에만 쓴다.
 */
import { openDb } from '../normalize/ensure-db.mjs';
import { buildUnits } from '../lib/units.mjs';

/**
 * @param {import('node:sqlite').DatabaseSync} [db] 없으면 openDb()로 연다(없거나 오래됐으면 먼저 만든다)
 */
export async function openContext(db) {
  const own = !db;
  if (!db) db = await openDb();
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const units = buildUnits(all('SELECT * FROM categories'));
  const unitByKey = new Map(units.map((u) => [u.key, u]));
  const unitByCat = new Map(units.map((u) => [u.cat.id, u]));
  const stories = new Map(
    all('SELECT id, kind, source, category_id, title, order_index, has_text, line_count, in_scope, scope_note FROM stories').map((s) => [s.id, s]),
  );
  const targetIds = new Set(all('SELECT id FROM targets').map((r) => r.id));
  // 단위 안 씬 순서는 read.mjs와 같다(order_index, id — SQLite 정렬)
  const scenesByCat = new Map();
  for (const s of all("SELECT id, category_id FROM stories WHERE kind IN ('scene', 'episode') ORDER BY category_id, order_index, id")) {
    if (!scenesByCat.has(s.category_id)) scenesByCat.set(s.category_id, []);
    scenesByCat.get(s.category_id).push(s.id);
  }
  const lineCache = new Map();
  const stmtLines = db.prepare('SELECT seq, speaker_id, speaker_name, speaker_target, speaker_class, text, window, jump_to FROM lines WHERE story_id = ? ORDER BY seq');

  return {
    db,
    units,
    unitByKey,
    targetIds,
    story: (id) => stories.get(id) ?? null,
    /** 씬의 대사 전부 (seq 순) */
    lines(scene) {
      if (!lineCache.has(scene)) lineCache.set(scene, stmtLines.all(scene));
      return lineCache.get(scene);
    },
    /**
     * 읽기 키(단위 키 · 씬 키) → { key, type: 'unit'|'scene', unit, scenes[], title, inScope }. 모르면 null
     */
    resolve(key) {
      const u = unitByKey.get(key);
      if (u) {
        const scenes = scenesByCat.get(u.cat.id) ?? [];
        const inScope = scenes.some((id) => stories.get(id)?.in_scope === 1);
        return { key, type: 'unit', unit: u, scenes, title: u.title, inScope };
      }
      const s = stories.get(key);
      if (s && (s.kind === 'scene' || s.kind === 'episode')) {
        const unit = unitByCat.get(s.category_id) ?? null;
        return { key, type: 'scene', unit, scenes: [s.id], title: s.title ? `${unit?.title ?? ''} · ${s.title}`.replace(/^ · /, '') : unit?.title ?? key, inScope: s.in_scope === 1 };
      }
      return null;
    },
    /** 씬이 든 단위 */
    unitOfScene: (scene) => unitByCat.get(stories.get(scene)?.category_id) ?? null,
    close() {
      if (own) db.close();
    },
  };
}
