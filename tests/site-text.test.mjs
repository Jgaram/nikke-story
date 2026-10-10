/**
 * 사이트 화면 말(W13a) — 작업 흔적이 화면에 다시 생기지 않게.
 *   ① 사이트 소스의 화면 문자열에 금지어(`자동 규칙` · `분석 메모`)가 없다 — 주석은 빼고 본다. 아직 못 고친 탭은 PENDING(고친 세션이 지운다).
 *   ② 기록 ID를 글자로 내지 않는다 — ID를 링크 글자 · mono 칸으로 쓰는 꼴, rec-id 클래스.
 *   ③ fmt.prose — 화면에 내는 자유 문장은 이 함수를 거친다. 내보낸 데이터 문장 전부를 돌려 기록 ID · 키 · #줄이 남지 않는지 본다.
 *   ④ 자리 표기 — 'CH.17 이후'(CH.17+ · #12 · 시점 12 없음).
 *
 *   node --test tests/site-text.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = path.join(ROOT, 'site');
const fmt = await import('../site/lib/format.js');

/** 화면 금지어 — docs/views.md "화면 문구는 간결하게" · docs/site-cleanup.md 용어표 */
const BANNED = ['자동 규칙', '분석 메모'];
/** 아직 못 고친 곳 — 그 탭 세션(SESSIONS.md W13b–e)이 고치면서 여기서 지운다. 고쳤는데 남겨 두면 실패한다 */
const PENDING = {
  'site/tabs/links.js': ['자동 규칙', '분석 메모'], // W13e — 연결 근거 줄의 출처 말
  'site/tabs/persons.js': ['분석 메모'], // W13c — 숫자 타일 · 표 칸
};

function siteSources() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['data', 'img'].includes(e.name)) walk(p); }
      else if (/\.(js|html)$/.test(e.name) && e.name !== 'd3.js') out.push(p);
    }
  };
  walk(SITE);
  return out;
}
/** 주석을 뺀 코드 — 주석 줄(/** · * · //)과 줄 끝 '// …'(앞이 빈칸인 것 — 'https://'는 남는다), HTML 주석 */
function codeOnly(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\*\*?|\*|\/\/)/.test(l))
    .map((l) => l.replace(/\s\/\/\s.*$/, ''))
    .join('\n');
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

test('화면 문자열에 금지어가 없다 (주석 빼고, PENDING 탭만 예외)', () => {
  const found = [];
  for (const p of siteSources()) {
    const code = codeOnly(fs.readFileSync(p, 'utf8'));
    for (const w of BANNED) if (code.includes(w) && !PENDING[rel(p)]?.includes(w)) found.push(`${rel(p)}: ${w}`);
  }
  assert.deepEqual(found, []);
});

test('PENDING은 아직 남은 것만 — 고친 탭은 목록에서 지운다', () => {
  const stale = [];
  for (const [f, words] of Object.entries(PENDING)) {
    const code = codeOnly(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const w of words) if (!code.includes(w)) stale.push(`${f}: ${w}`);
  }
  assert.deepEqual(stale, [], '고쳤으면 tests/site-text.test.mjs PENDING에서 지운다');
});

test('기록 ID를 글자로 내지 않는다 — 링크 글자 · mono 칸 · rec-id', () => {
  const bad = [];
  const pats = [
    /link\(`record:\$\{([^}]+)\}`,\s*\1\s*[,)]/, // ui.link(`record:${r.id}`, r.id …)
    /link\(`thread:\$\{([^}]+)\}`,\s*\1\s*[,)]/, // 떡밥 ID(J12)를 글자로
    /class: '[^']*\bmono\b[^']*' \}, [\w.]*\b(?:id|record|basis|parent|answer)\b/, // el('span', { class: 'mono' }, r.id)
    /\brec-id\b|\bcr-recid\b/,
  ];
  for (const p of siteSources()) {
    const code = codeOnly(fs.readFileSync(p, 'utf8'));
    code.split('\n').forEach((line, i) => { for (const re of pats) if (re.test(line)) bad.push(`${rel(p)}:${i + 1} ${line.trim().slice(0, 90)}`); });
  }
  assert.deepEqual(bad, []);
});

test('fmt.plain은 없다 — 자유 문장은 fmt.prose 하나로', () => {
  assert.equal(fmt.plain, undefined);
  const bad = siteSources().filter((p) => /\bplain\(/.test(codeOnly(fs.readFileSync(p, 'utf8'))));
  assert.deepEqual(bad.map(rel), []);
});

// ── fmt.prose ──
const J = (f) => JSON.parse(fs.readFileSync(path.join(SITE, 'data', `${f}.json`), 'utf8'));
const units = J('units');
const scenes = J('scenes');
const threads = J('threads');
const targets = J('targets');
const ticks = J('ticks');
const useIdx = () => fmt.use({
  units: new Map(units.map((u) => [u.key, u])), scenes: new Map(scenes.map((s) => [s.id, s])), threads: new Map(threads.threads.map((j) => [j.id, j])),
  targets: new Map(targets.map((t) => [t.id, t])), ticks: new Map(ticks.map((t) => [t.tick, t])),
});

test('prose — 근거 표시를 걷고 키를 이름으로, 조사도 맞춘다', () => {
  useIdx();
  const ch07 = units.find((u) => u.key === 'ch07');
  assert.ok(ch07);
  assert.equal(fmt.prose('ch07을 보면'), 'CH.07을 보면');
  assert.equal(fmt.prose('슈가가 카운터스를 태우는 것은 CH.13(F331 · D106).'), '슈가가 카운터스를 태우는 것은 CH.13.');
  assert.equal(fmt.prose('어긋나지 않는다(06_e #47-59)'), '어긋나지 않는다');
  assert.equal(fmt.prose('척추가 말하지 않은 세계'), '필수 스토리가 말하지 않은 세계');
  assert.equal(fmt.prose('신데렐라 침식 앞(S180과 같은 때)'), '신데렐라 침식 앞'); // 괄호 속이 조사로 시작하면 괄호째
  assert.equal(fmt.prose('2세대가 실전에 나가기 전(신데렐라 침식 S180 앞)'), '2세대가 실전에 나가기 전(신데렐라 침식 앞)');
  assert.equal(fmt.prose('수정을 밀어낸다(R47 ch31에서 더함)'), '수정을 밀어낸다');
  assert.match(fmt.prose('J1의 고리'), /^「[^」]+」의 고리$/);
  // 작중 이름은 그대로
  assert.equal(fmt.prose('펑크 스트리트 E2 크리스탈 테러'), '펑크 스트리트 E2 크리스탈 테러');
  assert.equal(fmt.prose('[#000000]은 식스오의 코드네임'), '[#000000]은 식스오의 코드네임');
  // 못 바꾸는 문장은 빼고 나머지 문장만
  assert.equal(fmt.prose('처음 만나는 것은 CH.15(F387). 1회독도 같은 근거로 봤다(S370)'), '처음 만나는 것은 CH.15.');
  assert.equal(fmt.prose('ch18 F700이 말한다'), '');
  assert.equal(fmt.prose(''), '');
  assert.equal(fmt.prose(null), '');
});

test('prose — 내보낸 자유 문장 전부에 기록 ID · 스토리 키 · #줄 · 회독이 남지 않는다', () => {
  useIdx();
  const recs = [...J('records'), ...J('records2')];
  const chrono = J('chrono');
  const order = J('order');
  const texts = [
    ...recs.flatMap((r) => [r.text, r.reason, r.before, r.after]),
    ...chrono.narrows.map((n) => n.reason), ...chrono.points.map((n) => n.reason), ...chrono.pieces.map((n) => n.text),
    ...J('slips').map((x) => x.text), ...targets.map((t) => t.note), ...J('world').entries.map((e) => e.note),
    ...J('links').edges.map((e) => e.note), ...order.units.map((u) => u.reason), ...threads.threads.map((j) => j.text),
  ].filter((x) => typeof x === 'string' && x.trim());
  assert.ok(texts.length > 10000, `문장 ${texts.length}`);
  const left = [];
  const RE = [
    /(?<![A-Za-z0-9_:[\-.])(?:[FQSIEDUOHTR]\d+(?:-\d+)?|J\d+)(?![A-Za-z0-9_\-]| 크리스탈)/,
    /(?<![A-Za-z0-9_])(?:(?:fl|side|sub|relic|erelic|ep|char|sudden):[\p{L}\p{N}_]+|d_[a-z0-9_]+|event_[a-z0-9_]+|ch\d{2})/u,
    /(?<!\[)#\d/, /[12]회독/, /에서 더함/,
  ];
  for (const t of texts) {
    const out = fmt.prose(t);
    if (RE.some((re) => re.test(out))) left.push(out.slice(0, 80));
  }
  assert.deepEqual(left.slice(0, 5), []);
  // 기록 문장은 거의 다 살아야 한다 — 못 바꿔 빠지는 건 드물게
  const recTexts = recs.map((r) => r.text).filter(Boolean);
  const lost = recTexts.filter((t) => !fmt.prose(t)).length;
  assert.ok(lost <= 10, `기록 문장 ${recTexts.length} 가운데 못 낸 것 ${lost}`);
});

test('자리 표기 — CH.17 이후 · 메인은 CH.07(과 함께 출시 없음) · 자리 번호 없음', () => {
  useIdx();
  const main = ticks.find((t) => t.main);
  const between = ticks.find((t) => !t.main && t.upto);
  assert.equal(fmt.tickShort(main.tick), `CH.${main.main.slice(2)}`);
  assert.equal(fmt.tickShort(between.tick), `CH.${between.upto.slice(2)} 이후`);
  assert.equal(fmt.tickLabel(main.tick, { date: false }), `CH.${main.main.slice(2)}`);
  assert.doesNotMatch(fmt.tickLabel(main.tick), /함께 출시|다음 출시/);
  assert.equal(fmt.tickShort(99999), '');
  assert.equal(fmt.tickLabel(99999), '');
  for (const t of ticks) assert.doesNotMatch(`${fmt.tickShort(t.tick)} ${fmt.tickLabel(t.tick)}`, /\+|#|시점 \d/);
});
