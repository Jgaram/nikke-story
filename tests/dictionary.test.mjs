/**
 * A2 · T3-2 — 비인물 사전(지역 · 장소 / 조직 · 세력 / 개념 · 설정 / 사건 / 물건) 검증.
 *
 *   node --test          (레포 루트에서 — tests/*.test.mjs를 찾아 돌린다)
 *
 * DB가 없거나 오래됐으면 먼저 만든다(ensure-db). 실패하면 annotations/dictionary/{places,orgs,concepts,incidents,items}.json을 고친다.
 * 형식 · 검색 규칙은 docs/schema.md "비인물 사전".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { compileNames, loadTerms, TARGET_TYPES, TERM_FILES } from '../tools/normalize/dictionary.mjs';

const db = await openDb();
test.after(() => db.close());
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const list = (rows, f) => rows.slice(0, 20).map(f).join(', ') + (rows.length > 20 ? ` … 외 ${rows.length - 20}` : '');
const { entries, problems } = loadTerms();
const TERM = "type <> 'person'";

/** 범위 안 대사에서 한 표기를 사전과 같은 규칙으로 센다 */
function countInScope(name, excludes = []) {
  const match = compileNames([{ key: 1, name, excludes }]);
  const like = `%${name.split(' ')[0]}%`;
  return all(
    `SELECT l.text FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 AND l.text LIKE ?`,
    like,
  ).filter((r) => match(r.text).size).length;
}

test('사전 파일 형식 — 문제 0건, 파일마다 제 종류의 ID만', (t) => {
  assert.deepEqual(problems, [], `사전 파일 문제: ${list(problems, (x) => x)}`);
  for (const [type, file] of Object.entries(TERM_FILES)) {
    const mine = entries.filter((e) => e.file === file);
    t.diagnostic(`${file}: ${TARGET_TYPES[type]} ${mine.length}`);
    assert.ok(mine.length > 0, `${file}에 항목이 없다`);
    for (const e of mine) assert.ok(e.id.startsWith(`${type}:`), `${file}: ${e.id}`);
  }
});

test('사전 항목이 전부 DB 대상이 되고, 비인물 대상은 전부 사전에서 왔다', () => {
  const ids = new Set(all(`SELECT id FROM targets WHERE ${TERM}`).map((r) => r.id));
  const missing = entries.filter((e) => !ids.has(e.id));
  assert.deepEqual(missing.map((e) => e.id), [], '빌드에서 빠진 항목');
  const extra = [...ids].filter((id) => !entries.some((e) => e.id === id));
  assert.deepEqual(extra, [], '사전 파일에 없는 비인물 대상');
  const kindless = all(`SELECT id FROM targets WHERE ${TERM} AND (kind IS NULL OR kind = '')`);
  assert.deepEqual(kindless, [], `갈래(kind)가 없는 대상: ${list(kindless, (r) => r.id)}`);
});

test('모든 이름이 범위 안에서 1줄 이상 잡힌다 — 추측한 표기는 조용히 0건이 된다', (t) => {
  const zero = all(
    `SELECT n.target_id, n.name FROM target_names n JOIN targets t ON t.id = n.target_id
      WHERE t.${TERM} AND COALESCE(n.lines_in_scope, 0) = 0`,
  );
  const s = one(
    `SELECT COUNT(DISTINCT n.target_id) t, COUNT(*) n, SUM(n.how <> '표준명') a, SUM(n.caution IS NOT NULL) c
       FROM target_names n JOIN targets t ON t.id = n.target_id WHERE t.${TERM}`,
  );
  t.diagnostic(`비인물 대상 ${s.t} · 이름 ${s.n} (표준명 밖 ${s.a}) · 오탐 주의 ${s.c}`);
  for (const r of all(
    `SELECT type, COUNT(*) n, SUM(lines_in_scope) l FROM targets WHERE ${TERM} GROUP BY type ORDER BY n DESC`,
  )) {
    t.diagnostic(`  ${TARGET_TYPES[r.type]} ${r.n} — 범위 안 언급 ${r.l}줄(대상마다 센 합)`);
  }
  assert.deepEqual(zero, [], `범위 안 0건인 이름(표기 확인): ${list(zero, (r) => `${r.name}(${r.target_id})`)}`);
});

test('대상 건수는 이름 건수들의 합집합이다', () => {
  const bad = all(
    `SELECT t.id, t.lines_in_scope tl, t.stories_in_scope ts, MAX(n.lines_in_scope) mx, SUM(n.lines_in_scope) sm
       FROM targets t JOIN target_names n ON n.target_id = t.id WHERE t.${TERM}
      GROUP BY t.id HAVING tl < mx OR tl > sm OR ts < 1 OR ts > tl`,
  );
  assert.deepEqual(bad, [], `건수가 맞지 않는 대상: ${list(bad, (r) => `${r.id}(${r.tl} · 이름 최대 ${r.mx} · 합 ${r.sm})`)}`);
});

test('검색 규칙이 FTS 접두 검색과 같다 — 규칙(except) 없는 한글 이름 · not_scenes 씬은 빼고', () => {
  const notScenes = new Map(entries.filter((e) => e.not_scenes?.length).map((e) => [e.id, e.not_scenes]));
  const rows = all(
    `SELECT n.name, n.target_id, n.lines_in_scope js FROM target_names n JOIN targets t ON t.id = n.target_id
      WHERE t.${TERM} AND n.excludes IS NULL`,
  ).filter((r) => /^[가-힣 ]+$/.test(r.name));
  assert.ok(rows.length > 50);
  const bad = rows
    .map(({ target_id: id, ...r }) => {
      // not_scenes(동음 — 다른 것) 씬은 FTS에서도 뺀다: 씬 ID 그대로, 끝이 *이면 앞머리
      const ns = notScenes.get(id) ?? [];
      const cond = ns.map((x) => (x.endsWith('*') ? 'f.story_id NOT LIKE ?' : 'f.story_id <> ?')).map((c) => ` AND ${c}`).join('');
      const args = ns.map((x) => (x.endsWith('*') ? `${x.slice(0, -1).replace(/[%_]/g, '\\$&')}%` : x));
      return {
        ...r,
        fts: one(
          `SELECT COUNT(*) c FROM lines_fts f JOIN stories s ON s.id = f.story_id WHERE lines_fts MATCH ? AND s.in_scope = 1${cond.replace(/NOT LIKE \?/g, "NOT LIKE ? ESCAPE '\\'")}`,
          `"${r.name}"*`, ...args,
        ).c,
      };
    })
    .filter((r) => r.fts !== r.js);
  assert.deepEqual(bad, [], `사전 건수 ≠ FTS: ${list(bad, (r) => `${r.name} ${r.js}/${r.fts}`)}`);
});

test('같은 이름이 두 대상에 걸리지 않는다 (비인물끼리 · 비인물 ↔ 인물)', () => {
  const dup = all(
    `SELECT n.name, GROUP_CONCAT(DISTINCT n.target_id) ids FROM target_names n
      GROUP BY n.name HAVING COUNT(DISTINCT n.target_id) > 1
         AND SUM(n.target_id NOT LIKE 'person:%') > 0`,
  );
  assert.deepEqual(dup, [], `여러 대상에 걸린 이름: ${list(dup, (r) => `${r.name}(${r.ids})`)}`);
});

test('틀린 표기(wrong)는 이름에 없고, 범위 안에서 거의 나오지 않는다', (t) => {
  const bad = [];
  let n = 0;
  for (const e of entries) {
    const total = one('SELECT lines_in_scope l FROM targets WHERE id = ?', e.id)?.l ?? 0;
    for (const w of e.wrong ?? []) {
      n++;
      const c = countInScope(w);
      if (one('SELECT 1 x FROM target_names WHERE name = ?', w) || c * 20 > total) bad.push(`${w}(${c}줄, ${e.id} ${total}줄)`);
    }
  }
  t.diagnostic(`틀린 표기 ${n}개 확인`);
  assert.deepEqual(bad, [], '틀린 표기가 이름에 있거나 5% 넘게 나온다 — 표기를 다시 잰다');
});

test('근거(evidence) 줄이 있고, 그 대상의 이름이 들어 있다', () => {
  const bad = [];
  for (const e of entries) {
    const names = e.names.map((x) => x.name);
    for (const ev of e.evidence ?? []) {
      for (const seq of ev.lines) {
        const row = one('SELECT text FROM lines WHERE story_id = ? AND seq = ?', ev.scene, seq);
        if (!row) bad.push(`${e.id}: 없는 줄 ${ev.scene}#${seq}`);
        else if (!names.some((x) => row.text.replace(/\s+/g, ' ').includes(x))) bad.push(`${e.id}: ${ev.scene}#${seq}에 이름이 없다`);
      }
    }
  }
  assert.deepEqual(bad, [], list(bad, (x) => x));
});

test('확인된 시드 표기 (docs/schema.md "키워드 표기 주의")가 사전에 있고 틀린 추측은 0건', () => {
  for (const seed of ['랩쳐', '방주', '중앙 정부', '테트라', '미실리스', '필그림', '엘리시온', '헬레틱']) {
    const r = one(
      `SELECT n.lines_in_scope l FROM target_names n JOIN targets t ON t.id = n.target_id WHERE t.${TERM} AND n.name = ?`,
      seed,
    );
    assert.ok(r?.l > 0, `시드 ${seed}가 사전에 없거나 0건`);
  }
  for (const w of ['헤레틱', '니힐리스터', '랩처', '오버스펙']) assert.equal(countInScope(w), 0, `${w}가 범위 안에 나온다`);
});

test('표기를 나누는 항목(shares — 장소이자 조직)은 검색 이름 없이 대상만 둔다', () => {
  const shared = entries.filter((e) => e.shares);
  assert.ok(shared.some((e) => e.id === 'org:에덴'), 'org:에덴 ↔ place:에덴');
  for (const e of shared) {
    assert.equal(one('SELECT COUNT(*) n FROM target_names WHERE target_id = ?', e.id).n, 0, `${e.id}는 이름을 두지 않는다`);
    assert.ok(one('SELECT 1 x FROM target_names WHERE target_id = ? AND name = ?', e.shares, e.name), `${e.name}은 ${e.shares}의 이름`);
  }
});
