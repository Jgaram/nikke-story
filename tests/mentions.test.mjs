/**
 * B2 — 언급 DB 자동 줄(speaks · named · alias) · 표본 정밀도 · 자동 신호 검증. 규칙은 docs/schema.md "언급 DB".
 *
 *   node --test
 *
 * 실패하면: 표본 정밀도 파일 → annotations/dictionary/mention-precision.json(기준과 맞지 않는 auto · 없는 이름),
 * 검색 규칙 → tools/normalize/mentions.mjs(PERSON_TAIL · compilePersonNames).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { COMMANDER, MENTION_MODES, PERSON_TAIL, PRECISION_FLOOR, SELF_WINDOWS, compilePersonNames, loadPrecision } from '../tools/normalize/mentions.mjs';
import { lineStyles, sentenceStyle } from '../tools/views/signals.mjs';

const db = await openDb();
test.after(() => db.close());
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);
const list = (rows, f) => rows.slice(0, 20).map(f).join(', ') + (rows.length > 20 ? ` … 외 ${rows.length - 20}` : '');

test('꼬리 규칙: 조사 · 호칭 접미 · 서술격은 이름, 이름으로 시작하는 다른 낱말은 아니다', () => {
  for (const ok of ['', '는', '가', '의', '에게', '한테도', '님', '님이', '씨가', '야', '아', '였어', '이었어', '잖아', '라고', '이라면', '답지', '들은', '입니다']) {
    assert.ok(PERSON_TAIL.test(ok), `꼬리 "${ok}"는 이름이어야 한다`);
  }
  for (const no of ['짜', '심', '로봇', '가지', '스트', '니까는요요', '브가']) assert.ok(!PERSON_TAIL.test(no), `꼬리 "${no}"는 이름이 아니다`);
});

test('인물 검색기: 낱말 앞 · 꼬리 · 가장 긴 이름 · 비인물이 덮으면 뺌 · except', () => {
  const m = compilePersonNames(
    [{ key: '진', name: '진' }, { key: '그레이', name: '그레이' }, { key: '그레이브', name: '그레이브' }, { key: '하퍼', name: '하퍼' },
      { key: '볼트', name: '볼트', excludes: ['볼트 주니어'] }, { key: '스노우 화이트', name: '스노우 화이트' }],
    ['엘리시온 하퍼'],
  );
  const hit = (t) => [...m(t).hits].sort();
  assert.deepEqual(hit('진짜? 진은 어디 갔어'), ['진']);
  assert.deepEqual(hit('그레이브가 왔다'), ['그레이브']);
  assert.deepEqual(hit('엘리시온 하퍼의 글'), []);
  assert.deepEqual(hit('볼트 주니어가 짖었다. 볼트도.'), ['볼트']);
  assert.deepEqual(hit('스노우  화이트님이'), ['스노우 화이트']);
  assert.deepEqual(hit('아진은'), []);
});

test('말투: ㅂ니다 · 요는 존댓말, 다 · 야는 반말, 그러니까 · 명사는 아니다', () => {
  assert.equal(sentenceStyle('합니다'), 'polite');
  assert.equal(sentenceStyle('갑니까'), 'polite');
  assert.equal(sentenceStyle('그래요'), 'polite');
  assert.equal(sentenceStyle('그러니까'), null);
  assert.equal(sentenceStyle('간다'), 'plain');
  assert.equal(sentenceStyle('라피'), null);
  assert.deepEqual(lineStyles('알겠어요. 가자! …지휘관'), ['polite', 'plain', null]);
});

test('언급 DB: 자동 줄이 사전 대상만 가리키고, 덩어리가 바르고, 범위 안에만 있다', () => {
  const unknown = all('SELECT DISTINCT m.target FROM mentions m LEFT JOIN targets t ON t.id = m.target WHERE t.id IS NULL');
  assert.deepEqual(unknown, [], `사전에 없는 대상: ${list(unknown, (r) => r.target)}`);
  const bad = one('SELECT COUNT(*) n FROM mentions WHERE seq_to < seq_from OR lines <> seq_to - seq_from + 1').n;
  assert.equal(bad, 0, '줄 덩어리 범위와 줄 수가 어긋난다');
  const out = one('SELECT COUNT(*) n FROM mentions m JOIN stories s ON s.id = m.story_id WHERE s.in_scope = 0').n;
  assert.equal(out, 0, '범위 밖 씬에 자동 줄이 있다');
  const hows = all('SELECT DISTINCT how FROM mentions').map((r) => r.how).sort();
  assert.deepEqual(hows, ['alias', 'named', 'speaks']);
  // 같은 (씬, 대상, 방식, 경로)의 덩어리는 서로 겹치거나 붙지 않는다 — 붙었으면 한 덩어리여야 한다
  const touch = one(`SELECT COUNT(*) n FROM mentions a JOIN mentions b ON a.story_id = b.story_id AND a.target = b.target AND a.how = b.how
    AND a.via IS b.via AND a.rowid < b.rowid AND b.seq_from <= a.seq_to + 1 AND a.seq_from <= b.seq_to + 1`).n;
  assert.equal(touch, 0, '이어 붙여야 할 덩어리가 나뉘어 있다');
});

test('speaks = 이름표로 푼 줄 + 여럿 이름표 + 지휘관 Self 창 (범위 안)', () => {
  const spoken = one(`SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 AND l.speaker_target IS NOT NULL`).n;
  const group = one(`SELECT COALESCE(SUM(json_array_length(k.targets)), 0) n FROM lines l JOIN stories s ON s.id = l.story_id JOIN speakers k ON k.name = l.speaker_name
    WHERE s.in_scope = 1 AND l.speaker_target IS NULL AND l.speaker_class = '여럿'`).n;
  const self = one(`SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 AND l.speaker_name IS NULL
    AND l.window IN (${[...SELF_WINDOWS].map((w) => `'${w}'`).join(',')})`).n;
  assert.equal(one("SELECT SUM(lines) n FROM mentions WHERE how = 'speaks'").n, spoken + group + self);
  assert.equal(one("SELECT SUM(lines) n FROM mentions WHERE how = 'speaks' AND via = '창'").n, self);
  assert.equal(one("SELECT COUNT(DISTINCT target) n FROM mentions WHERE via = '창'").n, 1);
  assert.equal(one("SELECT target FROM mentions WHERE via = '창' LIMIT 1").target, COMMANDER);
  // 미상 이름표(???)는 누구에게도 잇지 않는다 — 정체는 2회독 암시 언급
  const unknownSpeaks = one(`SELECT COUNT(*) n FROM mentions m JOIN lines l ON l.story_id = m.story_id AND l.seq BETWEEN m.seq_from AND m.seq_to
    WHERE m.how = 'speaks' AND l.speaker_class = '미상'`).n;
  assert.equal(unknownSpeaks, 0);
});

test('씬별 대상 인덱스(scene_targets) = 언급 DB 합', () => {
  const a = one('SELECT SUM(speaks) s, SUM(named) n, SUM(alias) a, COUNT(*) c FROM scene_targets');
  const b = all('SELECT how, SUM(lines) l FROM mentions GROUP BY how');
  const by = Object.fromEntries(b.map((r) => [r.how, r.l]));
  assert.deepEqual([a.s, a.n, a.a], [by.speaks, by.named, by.alias]);
  assert.equal(a.c, one('SELECT COUNT(*) n FROM (SELECT DISTINCT story_id, target FROM mentions)').n);
});

test('표본 정밀도 파일: 사전에 있는 이름 · 기준(80%)과 맞는 auto · 결정이 DB에 실림', () => {
  const p = loadPrecision();
  const names = new Map(all('SELECT target_id, name, mention_mode, precision FROM target_names').map((r) => [`${r.target_id}\t${r.name}`, r]));
  const wrong = [];
  for (const e of p.names) {
    const k = `${e.target}\t${e.name}`;
    const row = names.get(k);
    if (!row) wrong.push(`${e.target} ${e.name}: 사전에 없다`);
    if (!MENTION_MODES.includes(e.auto)) wrong.push(`${e.name}: auto ${e.auto}`);
    if (!(e.sample > 0 && e.correct >= 0 && e.correct <= e.sample)) wrong.push(`${e.name}: 표본 ${e.correct}/${e.sample}`);
    const full = e.correct / e.sample >= PRECISION_FLOOR;
    const unit = e.unit ? e.unit.correct / e.unit.sample >= PRECISION_FLOOR : false;
    const expect = full ? 'all' : unit ? 'unit' : 'off';
    if (e.auto !== expect) wrong.push(`${e.name}: auto ${e.auto} — 기준으로는 ${expect} (${e.correct}/${e.sample}${e.unit ? ` · 단위 ${e.unit.correct}/${e.unit.sample}` : ''})`);
    if (row && row.mention_mode !== e.auto) wrong.push(`${e.name}: DB ${row.mention_mode} ≠ 파일 ${e.auto}`);
    if (e.unit && !e.target.startsWith('person:')) wrong.push(`${e.name}: unit은 인물만`);
  }
  assert.deepEqual(wrong, [], wrong.slice(0, 20).join('\n'));
  // 인물 이름은 걸린 줄이 있으면 모두 재야 한다(B2) — 새 이름이 들어오면 표본을 뜬다
  const measured = new Set(p.names.map((e) => `${e.target}\t${e.name}`));
  const unmeasured = all("SELECT target_id, name, lines_in_scope FROM target_names WHERE target_id LIKE 'person:%' AND lines_in_scope > 0")
    .filter((r) => !measured.has(`${r.target_id}\t${r.name}`));
  assert.deepEqual(unmeasured, [], `표본 정밀도를 안 잰 인물 이름 — node tools/query.mjs sample <이름> 으로 재서 mention-precision.json에: ${list(unmeasured, (r) => `${r.name}(${r.lines_in_scope})`)}`);
});

test('쓰는 법: off 이름은 자동 줄이 없고, unit 이름은 그 인물이 말하는 단위 안에만 있다', () => {
  const off = all("SELECT target_id, name FROM target_names WHERE mention_mode = 'off'");
  const offRows = off.filter((n) => one("SELECT COUNT(*) c FROM mentions WHERE target = ? AND how <> 'speaks' AND (name = ? OR name LIKE ? OR name LIKE ?)", n.target_id, n.name, `${n.name} · %`, `% · ${n.name}`).c > 0
    && one('SELECT COUNT(*) c FROM target_names WHERE target_id = ? AND name <> ? AND mention_mode <> \'off\'', n.target_id, n.name).c === 0);
  assert.deepEqual(offRows, [], `off인데 자동 줄이 있다: ${list(offRows, (n) => n.name)}`);
  const outside = all(`SELECT m.target, m.story_id FROM mentions m JOIN target_names n ON n.target_id = m.target AND n.mention_mode = 'unit'
      AND (m.name = n.name OR m.name LIKE n.name || ' · %' OR m.name LIKE '% · ' || n.name)
      JOIN stories s ON s.id = m.story_id
    WHERE m.how <> 'speaks' AND NOT EXISTS (SELECT 1 FROM mentions x JOIN stories y ON y.id = x.story_id
      WHERE x.target = m.target AND x.how = 'speaks' AND y.category_id = s.category_id)`);
  assert.deepEqual(outside, [], `unit 이름이 말하지 않는 단위에 걸렸다: ${list(outside, (r) => `${r.target} ${r.story_id}`)}`);
});

test('미상 이름표 줄 진행률: speaker: true 암시 언급의 근거 줄만 센다, 기각은 빼고', async () => {
  const { openContext } = await import('../tools/records/context.mjs');
  const { unknownSpeakerProgress } = await import('../tools/records/read2.mjs');
  const ctx = await openContext(db);
  const [a, b] = all(`SELECT l.story_id, l.seq FROM lines l JOIN stories s ON s.id = l.story_id
    WHERE s.in_scope = 1 AND l.speaker_class = '미상' ORDER BY l.story_id, l.seq LIMIT 2`);
  const unit = ctx.unitOfScene(a.story_id).key;
  const before = unknownSpeakerProgress({ candidates: [] }, ctx).get(unit);
  const ds = {
    candidates: [
      { kind: 'mention', status: '확정', obj: { target: 'person:라피', speaker: true }, evidence: [{ scene: a.story_id, lines: [a.seq] }] },
      { kind: 'mention', status: '기각', obj: { target: 'person:라피', speaker: true }, evidence: [{ scene: b.story_id, lines: [b.seq] }] },
      { kind: 'mention', status: '확정', obj: { target: 'person:라피' }, evidence: [{ scene: b.story_id, lines: [b.seq] }] },
    ],
  };
  const after = unknownSpeakerProgress(ds, ctx).get(unit);
  assert.equal(before.done, 0);
  assert.equal(after.total, before.total);
  assert.equal(after.done, 1);
  const total = [...unknownSpeakerProgress({ candidates: [] }, ctx).values()].reduce((s, x) => s + x.total, 0);
  assert.equal(total, one("SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id WHERE s.in_scope = 1 AND l.speaker_class = '미상'").n);
});
