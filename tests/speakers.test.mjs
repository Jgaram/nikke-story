/**
 * A1 · T2-7 일부 — 분석 범위 · 이름표 분류 검증.
 *
 *   node --test          (레포 루트에서 — tests/*.test.mjs를 찾아 돌린다)
 *
 * DB가 없거나 오래됐으면 먼저 만든다(ensure-db). 실패하면 무엇을 고칠지 메시지에 나온다:
 *   미분류 이름표 → annotations/dictionary/speakers.json에 갈래를 적는다
 *   없는 대상 · 후보 형식 → annotations/dictionary/people.json
 * 규칙은 docs/schema.md "분석 범위" · "대상 ID" · "이름표 분류".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { SPEAKERS_PATH, SPEAKER_CLASSES } from '../tools/normalize/dictionary.mjs';
import { expandLines } from '../tools/records/model.mjs';

const db = await openDb();
test.after(() => db.close());
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const list = (rows, f) => rows.slice(0, 20).map(f).join(', ') + (rows.length > 20 ? ` … 외 ${rows.length - 20}` : '');

test('분석 범위: 돌발은 엘리베이터 첫 스토리만 범위 안, 시트 참고 노드는 범위 밖', () => {
  assert.equal(one('SELECT COUNT(*) n FROM stories WHERE in_scope NOT IN (0, 1) OR in_scope IS NULL').n, 0);
  const sudden = all("SELECT id FROM stories WHERE source = 'sudden' AND in_scope = 1").map((r) => r.id);
  assert.deepEqual(sudden, ['d_ex_elevator_01']);
  assert.equal(one("SELECT COUNT(*) n FROM stories WHERE source = 'sheet' AND in_scope = 1").n, 0);
  const outNoNote = one('SELECT COUNT(*) n FROM stories WHERE in_scope = 0 AND scope_note IS NULL').n;
  assert.equal(outNoNote, 0, '범위 밖 노드에는 까닭(scope_note)이 있어야 한다');
  // 메인 · 이벤트 · 금서고 · 호감도 스토리는 전부 범위 안이다 (결정 #5)
  const out = all(
    "SELECT source, COUNT(*) n FROM stories WHERE in_scope = 0 AND source NOT IN ('sudden', 'sheet') GROUP BY source",
  );
  assert.deepEqual(out, [], `범위 밖이면 안 되는 출처: ${list(out, (r) => `${r.source} ${r.n}`)}`);
});

test('범위 안 미분류 이름표 0종', (t) => {
  const rows = all('SELECT name, lines_in_scope, note FROM speakers WHERE lines_in_scope > 0 AND class IS NULL ORDER BY lines_in_scope DESC');
  const total = one('SELECT COUNT(*) n, SUM(lines_in_scope) l FROM speakers WHERE lines_in_scope > 0');
  t.diagnostic(`범위 안 이름표 ${total.n}종 ${total.l}줄`);
  for (const r of all(
    'SELECT class, COUNT(*) n, SUM(lines_in_scope) l FROM speakers WHERE lines_in_scope > 0 GROUP BY class ORDER BY l DESC',
  )) {
    t.diagnostic(`  ${r.class ?? '미분류'} ${r.n}종 ${r.l}줄`);
  }
  assert.deepEqual(
    rows.map((r) => r.name),
    [],
    `speakers.json에 갈래를 적을 것: ${list(rows, (r) => `${r.name}(${r.lines_in_scope}줄${r.note ? `, ${r.note}` : ''})`)}`,
  );
});

test('범위 안 이름표 미매칭 줄 0줄 (T2-7)', () => {
  const n = one(
    `SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id
      WHERE s.in_scope = 1 AND l.speaker_name IS NOT NULL AND l.speaker_class IS NULL`,
  ).n;
  assert.equal(n, 0);
});

test('갈래 값이 정해진 것뿐이고, 대상이 있어야 하는 갈래는 있는 대상을 가리킨다', () => {
  const classes = all('SELECT DISTINCT speaker_class c FROM lines WHERE speaker_class IS NOT NULL').map((r) => r.c);
  for (const c of classes) assert.ok(SPEAKER_CLASSES.includes(c), `모르는 갈래 ${c}`);
  const noTarget = one(
    "SELECT COUNT(*) n FROM lines WHERE speaker_class IN ('니케', '인물', '랩쳐') AND speaker_target IS NULL",
  ).n;
  assert.equal(noTarget, 0, '니케 · 인물 · 랩쳐 줄은 대상이 있어야 한다');
  const dangling = all(
    `SELECT DISTINCT speaker_target t FROM lines
      WHERE speaker_target IS NOT NULL AND speaker_target NOT IN (SELECT id FROM targets)`,
  );
  assert.deepEqual(dangling, [], `없는 대상: ${list(dangling, (r) => r.t)}`);
  const badMembers = all("SELECT name, targets FROM speakers WHERE class = '여럿'").filter((r) => {
    const ids = JSON.parse(r.targets);
    return ids.length < 2 || ids.some((id) => !one('SELECT 1 x FROM targets WHERE id = ?', id));
  });
  assert.deepEqual(badMembers, [], `여럿 이름표의 대상이 둘 미만이거나 없다: ${list(badMembers, (r) => r.name)}`);
});

test('??? — 이름표 코드에 이름이 든 줄은 코드로 풀고, 화면 이름표는 ???로 남는다', (t) => {
  const coded = all(
    `SELECT l.speaker_id code, l.speaker_via via, l.speaker_target target, COUNT(*) n
       FROM lines l JOIN stories s ON s.id = l.story_id
      WHERE s.in_scope = 1 AND l.speaker_name = '???' AND l.speaker_id IS NOT NULL AND l.speaker_id <> 'unknown'
      GROUP BY 1, 2, 3`,
  );
  const unresolved = coded.filter((r) => r.via !== '코드' || !r.target);
  assert.deepEqual(unresolved, [], `코드 규칙이 없는 ??? 코드: ${list(unresolved, (r) => `${r.code}(${r.n}줄)`)}`);
  const resolved = coded.reduce((a, r) => a + r.n, 0);
  const rest = one(
    `SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id
      WHERE s.in_scope = 1 AND l.speaker_name = '???' AND l.speaker_class = '미상'`,
  ).n;
  t.diagnostic(`범위 안 ??? — 코드로 푼 줄 ${resolved} · 2회독 후보(코드 unknown 또는 코드 없음) ${rest}`);
  assert.ok(resolved > 0);
});

test('speakers.json에 데이터에 없는 이름표 · 코드 규칙이 없다', () => {
  const j = JSON.parse(fs.readFileSync(SPEAKERS_PATH, 'utf8'));
  const labels = Object.values(j.labels).flatMap((v) => (Array.isArray(v) ? v : Object.keys(v)));
  const seen = new Set(all('SELECT name FROM speakers').map((r) => r.name));
  const stale = labels.filter((l) => !seen.has(l));
  assert.deepEqual(stale, [], `데이터에 없는 이름표(지울 것): ${list(stale, (x) => x)}`);
  const staleCodes = (j.codes ?? []).filter(
    (r) => !one('SELECT 1 x FROM lines WHERE speaker_name = ? AND speaker_id = ? LIMIT 1', r.label, r.code),
  );
  assert.deepEqual(staleCodes, [], `데이터에 없는 코드 규칙: ${list(staleCodes, (r) => `${r.label}/${r.code}`)}`);
  const noteOnly = Object.keys(j.notes ?? {}).filter((k) => !seen.has(k));
  assert.deepEqual(noteOnly, [], `데이터에 없는 이름표의 메모: ${list(noteOnly, (x) => x)}`);
});

test('니케 목록(characters)의 모든 행이 인물 대상에 이어진다', () => {
  const rows = all('SELECT resource_id, name FROM characters WHERE target_id IS NULL OR target_id NOT IN (SELECT id FROM targets)');
  assert.deepEqual(rows, [], `대상 없는 니케: ${list(rows, (r) => `${r.name}(${r.resource_id})`)}`);
  // 동명이인(사쿠라 282 TETRA · 836 ABNORMAL)은 다른 대상이다
  const sakura = all("SELECT DISTINCT target_id t FROM characters WHERE name = '사쿠라'").map((r) => r.t).sort();
  assert.deepEqual(sakura, ['person:사쿠라', 'person:사쿠라_콜라보']);
});

test('대상 ID 형식 — <종류>:<표준명>, 공백 없음', () => {
  const bad = all("SELECT id FROM targets WHERE id NOT GLOB '[a-z]*:?*' OR id GLOB '* *' OR type <> substr(id, 1, instr(id, ':') - 1)");
  assert.deepEqual(bad, [], `형식이 틀린 대상 ID: ${list(bad, (r) => r.id)}`);
  const types = all('SELECT DISTINCT type FROM targets').map((r) => r.type);
  for (const ty of types) assert.ok(['person', 'place', 'org', 'concept', 'incident', 'item'].includes(ty), `모르는 종류 ${ty}`);
});

test('정체 연결 후보 — 상태 · 확신도 · 가리키는 것', () => {
  for (const r of all('SELECT * FROM target_links')) {
    const where = `${r.a} ↔ ${r.b}`;
    assert.ok(['후보', '확정', '기각'].includes(r.status), `${where}: 상태 ${r.status}`);
    assert.ok(['확실', '추정'].includes(r.confidence), `${where}: 확신도 ${r.confidence}`);
    assert.ok(r.reason, `${where}: 이유가 없다`);
    assert.ok(one('SELECT 1 x FROM targets WHERE id = ?', r.b), `${where}: 없는 대상 ${r.b}`);
    const a = r.a.startsWith('이름표:')
      ? one('SELECT 1 x FROM speakers WHERE name = ?', r.a.slice('이름표:'.length))
      : one('SELECT 1 x FROM targets WHERE id = ?', r.a);
    assert.ok(a, `${where}: 없는 ${r.a}`);
    for (const e of JSON.parse(r.evidence)) {
      // 줄 번호는 숫자나 "a-b" 범위 (docs/annotations.md "근거")
      const { seqs, problems } = expandLines(e.lines);
      assert.deepEqual(problems, [], `${where}: 근거 줄 표기 ${JSON.stringify(e.lines)}`);
      for (const seq of seqs) {
        assert.ok(one('SELECT 1 x FROM lines WHERE story_id = ? AND seq = ?', e.scene, seq), `${where}: 없는 근거 줄 ${e.scene}#${seq}`);
      }
    }
  }
});

test('노드의 줄 수(line_count)가 실제 대사 수와 같다 (T2-7)', () => {
  const bad = all(
    `SELECT s.id, s.line_count, COUNT(l.seq) n FROM stories s LEFT JOIN lines l ON l.story_id = s.id
      GROUP BY s.id HAVING s.line_count <> n`,
  );
  assert.deepEqual(bad, [], `줄 수가 다른 노드: ${list(bad, (r) => `${r.id}(${r.line_count}≠${r.n})`)}`);
});
