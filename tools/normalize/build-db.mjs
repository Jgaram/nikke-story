/**
 * T2-3 — 정규화 결과를 SQLite로 적재한다. 전문 검색은 FTS5.
 *
 *   node tools/normalize/build-db.mjs
 *
 * 출력: data/nikke.db
 * 스키마는 docs/schema.md. build.mjs를 먼저 돌려야 한다.
 * 보통은 직접 돌리지 않는다 — tools/normalize/ensure-db.mjs가 필요할 때 build.mjs와 함께 돌린다.
 *
 * 옆 파일(data/nikke.db-building)에 다 만든 뒤 이름을 바꿔 끼운다.
 * 만드는 도중에 다른 프로세스가 조회해도 반쯤 만든 DB를 보지 않는다.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { parseCsv } from './csv.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NORM = path.join(ROOT, 'data/normalized');
const DB_PATH = path.join(ROOT, 'data/nikke.db');
const TMP_PATH = `${DB_PATH}-building`;
const RELEASE_CSV = path.join(ROOT, 'data/release/release-order.csv');

const load = async (name) => JSON.parse(await fs.readFile(path.join(NORM, name), 'utf8'));
const loadMaybe = async (name) => load(name).catch(() => null);
const removeWithSidecars = (p) =>
  Promise.all(['', '-wal', '-shm', '-journal'].map((s) => fs.rm(`${p}${s}`, { force: true })));

const SCHEMA = `
PRAGMA journal_mode = WAL;

-- 빌드 정보. inputs는 build.mjs가 입력을 읽기 전에 뜬 지문이다 (ensure-db.mjs가 비교한다)
CREATE TABLE meta (
  key           TEXT PRIMARY KEY,
  value         TEXT
);

CREATE TABLE categories (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  name          TEXT,
  locale_key    TEXT,
  id_prefix     TEXT,
  resource_id   INTEGER,
  sheet_title   TEXT,
  sheet_type    TEXT,
  game_key      TEXT,               -- 금서고 이벤트가 대신하는 블라링크 이벤트 키(event_forrest 등). 모르면 NULL
  order_index   INTEGER
);

CREATE TABLE stories (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,      -- scene | episode | favorite | placeholder
  source        TEXT NOT NULL,      -- main | sudden | archive | episode | equip | sheet
                                    -- 금서고: fl-event | fl-side | fl-subquest | fl-relic | fl-eventrelic
  category_id   TEXT REFERENCES categories(id),
  title         TEXT,
  order_index   INTEGER,
  is_hidden     INTEGER DEFAULT 0,
  has_text      INTEGER DEFAULT 0,
  line_count    INTEGER DEFAULT 0,
  sheet_type    TEXT,               -- 메인|에피소드|이벤트|퀘스트|사이드|애장품
  sheet_title   TEXT,
  release_date  TEXT,
  importance    TEXT,
  accessibility TEXT,
  character     TEXT,
  resource_id   INTEGER,
  attractive_level INTEGER,
  owner         TEXT,
  rarity        TEXT,
  description   TEXT,
  source_ref    TEXT,               -- 원 출처의 ID (금서고 SCRIPT_ID)
  in_scope      INTEGER NOT NULL DEFAULT 1,  -- 분석 범위(결정 #5, annotations/scope.json). 통계 · 자동 기록은 1만 본다
  scope_note    TEXT                -- 범위 밖인 까닭 (범위 안이면 NULL)
);
CREATE INDEX idx_stories_category ON stories(category_id);
CREATE INDEX idx_stories_scope    ON stories(in_scope);
CREATE INDEX idx_stories_source   ON stories(source);
CREATE INDEX idx_stories_sheet    ON stories(sheet_type);
CREATE INDEX idx_stories_release  ON stories(release_date);

CREATE TABLE lines (
  story_id      TEXT NOT NULL REFERENCES stories(id),
  seq           INTEGER NOT NULL,
  speaker_id    TEXT,               -- 원본 화자 코드. 창 종류가 들어간 가짜 화자(Self 등)는 NULL
  speaker_name  TEXT,
  text          TEXT NOT NULL,
  window        TEXT,               -- Speech | Self(지휘관) | Monologue | Narration | Choice | Input
                                    -- 금서고: Unknown(서술·독백 구분 없음) | Document(유실물) | Messenger | MessengerSelf | MessengerStart | Route
  jump_to       INTEGER,            -- 선택지·분기가 뛰는 같은 씬의 seq
  speaker_target TEXT,              -- 이름표가 가리키는 대상(person:…). 여럿 · 호칭 · 비인물 · 미상 · 미분류는 NULL
  speaker_class TEXT,               -- 이름표 갈래: 니케 | 인물 | 랩쳐 | 호칭 | 비인물 | 미상 | 여럿. 미분류는 NULL
  speaker_via   TEXT,               -- 이름표 | 코드 (코드 = 화면 이름표 대신 이름표 코드로 푼 줄, 예: ??? + unknown_grave)
  PRIMARY KEY (story_id, seq)
) WITHOUT ROWID;
CREATE INDEX idx_lines_speaker ON lines(speaker_id);
CREATE INDEX idx_lines_target  ON lines(speaker_target);
CREATE INDEX idx_lines_speaker_name ON lines(speaker_name);  -- 인물 단위 읽기(read.mjs char)가 표시명으로 찾는다

CREATE TABLE characters (
  resource_id   INTEGER PRIMARY KEY,
  name          TEXT,
  name_code     INTEGER,
  corporation   TEXT,
  class         TEXT,
  rarity        TEXT,
  target_id     TEXT                -- 인물 대상 (person:…). 같은 인물의 다른 판('라피 : 레드 후드')은 같은 대상
);
CREATE INDEX idx_characters_name ON characters(name);

-- 대상 사전 (A1 인물 · A2 비인물). ID는 <종류>:<표준명> — docs/schema.md "대상 ID"
CREATE TABLE targets (
  id            TEXT PRIMARY KEY,   -- person:라피 · place:… (공백은 _)
  type          TEXT NOT NULL,      -- person | place | org | concept | incident | item
  name          TEXT NOT NULL,      -- 표준명
  kind          TEXT,               -- 갈래 — 인물: 니케 | 인물 | 랩쳐 / 비인물: 도시 · 기업 · 스쿼드 · 존재 …(사전 파일에 적은 것)
  resource_ids  TEXT,               -- 니케 목록(characters) resource_id들 (JSON 배열)
  origin        TEXT,               -- 니케 목록 | 이름표 | 사전 (어디서 만들어졌나)
  note          TEXT,
  lines_in_scope   INTEGER,         -- 이름(들) 중 하나가 나온 범위 안 대사 줄 수. 인물은 언급 DB 자동 줄에 쓰는 이름만(B2)
  stories_in_scope INTEGER          -- 비인물: 그 줄들이 있는 씬 수
);
CREATE TABLE target_names (
  target_id     TEXT NOT NULL,
  name          TEXT NOT NULL,
  how           TEXT,               -- 표준명 | 니케 목록 | 정식 명칭 | 약칭 | 별칭 | 표기 | 영문 | 이명
  caution       TEXT,               -- 오탐 주의 사유 (흔한 말 · 다른 것과 겹침). 없으면 NULL
  excludes      TEXT,               -- 검색에서 뺄 더 긴 표기 (JSON 배열, 없으면 NULL) — 아크 ↔ 아크레인저
  lines_in_scope INTEGER,           -- 이 이름이 나온 범위 안 대사 줄 수 (검색 규칙은 docs/schema.md "비인물 사전", 인물은 꼬리 규칙까지 — "언급 DB")
  mention_mode  TEXT,               -- 언급 DB 자동 줄에 쓰는 법: all(어디서나) | unit(그 인물이 말하는 단위 안만) | off(뺌) — annotations/dictionary/mention-precision.json
  precision     TEXT                -- 표본 정밀도 "맞음/표본"(+ " · 단위 맞음/표본"). 재지 않았으면 NULL
);
CREATE INDEX idx_target_names_name ON target_names(name);
CREATE INDEX idx_target_names_target ON target_names(target_id);

-- 이름표 분류: 이름표 한 종류 = 한 행 (annotations/dictionary/speakers.json + 니케 목록)
CREATE TABLE speakers (
  name          TEXT PRIMARY KEY,   -- 이름표 (lines.speaker_name)
  class         TEXT,               -- 니케 | 인물 | 랩쳐 | 호칭 | 비인물 | 미상 | 여럿. 미분류는 NULL
  targets       TEXT,               -- 대상 ID들 (JSON 배열, 여럿이면 둘 이상)
  how           TEXT,               -- 니케 목록(이름 그대로) | 분류(speakers.json) | 모호(동명이인)
  note          TEXT,
  lines         INTEGER,            -- 그 이름표로 된 줄 수 (전체)
  lines_in_scope INTEGER,           -- 그중 범위 안
  code_lines    INTEGER             -- 그중 코드 규칙으로 푼 줄
);

-- 정체 연결 후보 (annotations/dictionary/people.json candidates). 확정 · 기각은 사용자가 한다
CREATE TABLE target_links (
  id            TEXT,               -- 후보 ID L<n> (리뷰 도구 tools/records.mjs가 이 ID로 확정 · 기각한다)
  type          TEXT NOT NULL,      -- same_as
  a             TEXT NOT NULL,      -- 대상 ID 또는 이름표:<이름표>
  b             TEXT NOT NULL,      -- 대상 ID
  status        TEXT NOT NULL,      -- 후보 | 확정 | 기각
  confidence    TEXT,               -- 확실 | 추정
  reason        TEXT,
  evidence      TEXT,               -- JSON [{scene, lines}]
  recorder      TEXT                -- 기록자
);

-- 언급 DB (T3-9 · B2): 어느 씬의 어느 줄에 어떤 대상이 어떻게 나오나. 자동 줄만 싣는다(tools/normalize/mentions.mjs) —
-- 2회독 암시 언급(I)은 기록 도구가 annotations/read2/에서 바로 읽는다(tools/records/read2.mjs mentionRows)
CREATE TABLE mentions (
  story_id      TEXT NOT NULL,
  seq_from      INTEGER NOT NULL,   -- 이어진 줄 덩어리 (lines.seq)
  seq_to        INTEGER NOT NULL,
  target        TEXT NOT NULL,      -- 대상 ID
  how           TEXT NOT NULL,      -- speaks(이름표로 말함) | named(이름 그대로) | alias(약칭 · 별칭 · 이명)
  via           TEXT,               -- speaks: 이름표 | 코드 | 창(지휘관 Self) / named · alias: 이름
  name          TEXT,               -- 덩어리에 나온 이름표 · 이름 (여럿이면 ' · ')
  lines         INTEGER NOT NULL,   -- 덩어리 줄 수
  speaker       INTEGER NOT NULL,   -- 그 줄을 말한 사람이 이 대상인가 (speaks = 1)
  origin        TEXT NOT NULL,      -- auto
  confidence    TEXT,               -- 확실 (자동)
  status        TEXT                -- 확정 (자동)
);
CREATE INDEX idx_mentions_story  ON mentions(story_id, seq_from);
CREATE INDEX idx_mentions_target ON mentions(target, how);

CREATE TABLE favorites (
  item_id       INTEGER PRIMARY KEY,
  name          TEXT,
  name_code     INTEGER,
  owner         TEXT,
  rare          TEXT
);

-- 방향은 읽는 순서다: from을 먼저 보면 to를 이해할 수 있다
CREATE TABLE edges (
  from_id       TEXT NOT NULL,
  to_id         TEXT NOT NULL,
  type          TEXT NOT NULL,      -- prereq | sequel | setup_payoff | callback | reversal | character | keyword (docs/schema.md "엣지 타입")
  strength      INTEGER,            -- 1~3 (시트 ◆ 개수)
  origin        TEXT NOT NULL,      -- game-condition | auto | record | manual | sheet
  note          TEXT
);
CREATE INDEX idx_edges_from ON edges(from_id);
CREATE INDEX idx_edges_to   ON edges(to_id);
CREATE INDEX idx_edges_type ON edges(type, origin);

CREATE TABLE sheet_rows (
  row_index     INTEGER PRIMARY KEY,
  release_date  TEXT,
  sheet_type    TEXT,
  accessibility TEXT,
  importance    TEXT,
  title         TEXT,
  prereq_raw    TEXT,
  is_legend     INTEGER,
  unreviewed    INTEGER,
  notes         TEXT,
  target_kind   TEXT,
  target_id     TEXT,
  unresolved    TEXT
);

-- 공개 순서(출시 순). data/release/release-order.csv를 그대로 싣는다 (tools/notices/release-order.mjs가 만든다)
CREATE TABLE releases (
  category_id  TEXT PRIMARY KEY,   -- categories.id (main:N · archive:N · char:N)
  kind         TEXT NOT NULL,      -- main / side / event / episode
  key          TEXT NOT NULL,      -- read.mjs 키 (ch07 · side:mudfish · event_… · fl:absolute · char:10)
  name         TEXT,
  rank         INTEGER,            -- 같은 날 = 같은 순위. 날짜가 없으면 NULL
  date         TEXT,               -- YYYY-MM-DD (KST)
  basis        TEXT,               -- 기간 줄 / 업데이트 날짜 / 출시일 / 출시 로스터 / 손 보정
  confidence   TEXT,               -- 확실 / 추정
  parts        TEXT,               -- 이벤트 파트 개방일(참고)
  notice_id    TEXT,
  notice_title TEXT,
  evidence     TEXT
);
CREATE INDEX idx_releases_order ON releases(date, kind);

-- 한국어 검색은 두 갈래로 간다. 자세한 이유는 docs/schema.md.
-- unicode61은 공백 단위로 토큰을 만들기 때문에 조사가 붙은 '랩쳐가'를 한 토큰으로 색인한다.
-- 그래서 MATCH '랩쳐'는 0건이고 MATCH '랩쳐*'(접두)는 전부 잡힌다.
-- 단어 앞이 아니면 접두로도 못 잡으므로 아래 trigram 테이블이 필요하다.
CREATE VIRTUAL TABLE lines_fts USING fts5(
  text,
  story_id UNINDEXED,
  seq      UNINDEXED,
  tokenize = 'unicode61'
);

-- 진짜 부분 문자열 검색용. 3글자 이상 질의만 유효하다 (trigram 제약).
CREATE VIRTUAL TABLE lines_tri USING fts5(
  text,
  story_id UNINDEXED,
  seq      UNINDEXED,
  tokenize = 'trigram'
);
`;

async function main() {
  await removeWithSidecars(TMP_PATH);

  const db = new DatabaseSync(TMP_PATH);
  db.exec(SCHEMA);
  console.log('스키마 생성');

  const insert = (table, cols) =>
    db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
  const n = (v) => (v === undefined || v === '' ? null : v);
  const one = (sql) => db.prepare(sql).get();
  const b = (v) => (v ? 1 : 0);

  const bulk = (label, rows, stmt, map) => {
    db.exec('BEGIN');
    for (const r of rows) stmt.run(...map(r));
    db.exec('COMMIT');
    console.log(`  ${label.padEnd(12)} ${rows.length.toLocaleString('ko-KR').padStart(9)}`);
  };

  // build-info.json이 없으면(예전 build.mjs 결과) 지문을 비워 둔다 → ensure-db가 다시 만든다
  const info = await loadMaybe('build-info.json');
  const metaStmt = insert('meta', ['key', 'value']);
  metaStmt.run('inputs', info?.inputs ?? null);
  metaStmt.run('normalized_at', info?.builtAt ?? null);
  metaStmt.run('built_at', new Date().toISOString());

  const categories = await load('categories.json');
  bulk('categories', categories,
    insert('categories', ['id','source','name','locale_key','id_prefix','resource_id','sheet_title','sheet_type','game_key','order_index']),
    (c) => [c.id, c.source, n(c.name), n(c.localeKey), n(c.idPrefix), n(c.resourceId), n(c.sheetTitle), n(c.sheetType), n(c.gameKey), c.orderIndex ?? 0]);

  const stories = await load('stories.json');
  bulk('stories', stories,
    insert('stories', ['id','kind','source','category_id','title','order_index','is_hidden','has_text','line_count',
      'sheet_type','sheet_title','release_date','importance','accessibility','character','resource_id','attractive_level','owner','rarity','description','source_ref',
      'in_scope','scope_note']),
    (s) => [s.id, s.kind, s.source, n(s.categoryId), n(s.title), s.orderIndex ?? 0, b(s.isHidden), b(s.hasText), s.lineCount ?? 0,
      n(s.sheetType), n(s.sheetTitle), n(s.releaseDate), n(s.importance), n(s.accessibility),
      n(s.character), n(s.resourceId), n(s.attractiveLevel), n(s.owner), n(s.rarity), n(s.description), n(s.sourceRef),
      s.inScope ?? 1, n(s.scopeNote)]);

  const characters = await load('characters.json');
  bulk('characters', characters,
    insert('characters', ['resource_id','name','name_code','corporation','class','rarity','target_id']),
    (c) => [c.resourceId, n(c.name), n(c.nameCode), n(c.corporation), n(c.klass), n(c.rarity), n(c.targetId)]);

  const targets = (await loadMaybe('targets.json')) ?? [];
  bulk('targets', targets,
    insert('targets', ['id','type','name','kind','resource_ids','origin','note','lines_in_scope','stories_in_scope']),
    (t) => [t.id, t.type, t.name, n(t.kind), t.resourceIds?.length ? JSON.stringify(t.resourceIds) : null, n(t.origin), n(t.note),
      n(t.linesInScope), n(t.storiesInScope)]);

  const targetNames = (await loadMaybe('target-names.json')) ?? [];
  bulk('target_names', targetNames,
    insert('target_names', ['target_id','name','how','caution','excludes','lines_in_scope','mention_mode','precision']),
    (x) => [x.targetId, x.name, n(x.how), n(x.caution), x.excludes?.length ? JSON.stringify(x.excludes) : null, n(x.linesInScope),
      n(x.mentionMode), n(x.precision)]);

  const speakers = (await loadMaybe('speakers.json')) ?? [];
  bulk('speakers', speakers,
    insert('speakers', ['name','class','targets','how','note','lines','lines_in_scope','code_lines']),
    (x) => [x.name, n(x.cls), JSON.stringify(x.targets ?? []), n(x.how), n(x.note), x.lines, x.linesInScope, x.codeLines]);

  const mentions = (await loadMaybe('mentions.json')) ?? [];
  bulk('mentions', mentions,
    insert('mentions', ['story_id','seq_from','seq_to','target','how','via','name','lines','speaker','origin','confidence','status']),
    (m) => [m.storyId, m.seqFrom, m.seqTo, m.target, m.how, n(m.via), n(m.name), m.lines, m.how === 'speaks' ? 1 : 0, 'auto', '확실', '확정']);
  // 씬별 대상 인덱스 — 씬 × 대상마다 방식별 줄 수 · 처음 나온 줄. 2회독 되짚어 읽기 · 첫 등장(query.mjs appear) · 인물별 집계가 쓴다
  db.exec(`CREATE TABLE scene_targets AS
    SELECT story_id, target,
           SUM(CASE WHEN how = 'speaks' THEN lines ELSE 0 END) AS speaks,
           SUM(CASE WHEN how = 'named'  THEN lines ELSE 0 END) AS named,
           SUM(CASE WHEN how = 'alias'  THEN lines ELSE 0 END) AS alias,
           MIN(seq_from) AS first_seq
      FROM mentions GROUP BY story_id, target`);
  db.exec('CREATE INDEX idx_scene_targets_target ON scene_targets(target)');
  db.exec('CREATE INDEX idx_scene_targets_story ON scene_targets(story_id)');
  console.log(`  scene_targets ${one('SELECT COUNT(*) n FROM scene_targets').n.toLocaleString('ko-KR').padStart(9)}`);

  const targetLinks = (await loadMaybe('target-links.json')) ?? [];
  bulk('target_links', targetLinks,
    insert('target_links', ['id','type','a','b','status','confidence','reason','evidence','recorder']),
    (x) => [n(x.id), x.type, x.a, x.b, x.status, n(x.confidence), n(x.reason), JSON.stringify(x.evidence ?? []), n(x.by)]);

  const favorites = await load('favorites.json');
  bulk('favorites', favorites,
    insert('favorites', ['item_id','name','name_code','owner','rare']),
    (f) => [f.itemId, n(f.name), n(f.nameCode), n(f.owner), n(f.rare)]);

  const edges = await load('edges.json');
  bulk('edges', edges,
    insert('edges', ['from_id','to_id','type','strength','origin','note']),
    (e) => [e.from, e.to, e.type, n(e.strength), e.origin, n(e.note)]);

  const sheetRows = await load('sheet-rows.json');
  bulk('sheet_rows', sheetRows,
    insert('sheet_rows', ['row_index','release_date','sheet_type','accessibility','importance','title','prereq_raw',
      'is_legend','unreviewed','notes','target_kind','target_id','unresolved']),
    (r) => [r.rowIndex, n(r.releaseDate), n(r.sheetType), n(r.accessibility), n(r.importance), r.title, n(r.prereqRaw),
      b(r.isLegend), b(r.unreviewed), r.notes?.length ? JSON.stringify(r.notes) : null,
      n(r.target?.kind), n(r.target?.storyId ?? r.target?.categoryId),
      r.unresolved?.length ? JSON.stringify(r.unresolved) : null]);

  const releases = await fs.readFile(RELEASE_CSV, 'utf8').then(parseCsv).catch(() => []);
  bulk('releases', releases,
    insert('releases', ['category_id','kind','key','name','rank','date','basis','confidence','parts','notice_id','notice_title','evidence']),
    (r) => [r.category_id, r.kind, r.key, n(r.name), r.rank === '' ? null : Number(r.rank), n(r.date), n(r.basis), n(r.confidence),
      n(r.parts), n(r.notice_id), n(r.notice_title), n(r.evidence)]);

  const lines = await load('lines.json');
  const lineStmt = insert('lines', ['story_id','seq','speaker_id','speaker_name','text','window','jump_to','speaker_target','speaker_class','speaker_via']);
  const ftsStmt = insert('lines_fts', ['text','story_id','seq']);
  const triStmt = insert('lines_tri', ['text','story_id','seq']);
  db.exec('BEGIN');
  for (const l of lines) {
    lineStmt.run(l.storyId, l.seq, n(l.speakerId), n(l.speakerName), l.text ?? '', n(l.window), l.jumpTo ?? null,
      n(l.speakerTarget), n(l.speakerClass), n(l.speakerVia));
    if (l.text) {
      ftsStmt.run(l.text, l.storyId, l.seq);
      triStmt.run(l.text, l.storyId, l.seq);
    }
  }
  db.exec('COMMIT');
  console.log(`  lines        ${lines.length.toLocaleString('ko-KR').padStart(9)}  (FTS5 unicode61 + trigram 색인)`);

  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.exec('ANALYZE');
  // 적재는 WAL이 빠르지만, 다 만든 뒤에는 읽기만 한다. 롤백 저널로 돌려 -wal/-shm 없이 파일 하나로 만든다
  db.exec('PRAGMA journal_mode = DELETE');
  db.close();

  // 예전 WAL 형식 DB의 곁파일이 남아 있으면 새 DB와 섞이지 않게 치우고 바꿔 끼운다
  await Promise.all(['-wal', '-shm'].map((s) => fs.rm(`${DB_PATH}${s}`, { force: true })));
  await fs.rename(TMP_PATH, DB_PATH);

  const { size } = await fs.stat(DB_PATH);
  console.log(`\n${path.relative(ROOT, DB_PATH)} — ${(size / (1 << 20)).toFixed(1)}MB`);
}

await main();
