/**
 * data/nikke.db 질의 도구.
 *
 *   node tools/query.mjs search 니힐리스타          대사 전문 검색
 *   node tools/query.mjs search 랩쳐 --limit 20
 *   node tools/query.mjs story d_main_01_01_s       씬 하나의 대사 전문
 *   node tools/query.mjs links ch07 | d_main_07_01_s  관계선(X2) — 단위 · 씬에 붙은 엣지(선행 조건 · 다음 편 · 떡밥 · 대상 공유 · 수동), --type character · --min 2
 *                                                   (시트 엣지는 --sheet를 줄 때만)
 *   node tools/query.mjs speaker 라피                이름표(그 줄을 말한 인물)별 통계 — 갈래 · 가리키는 대상까지
 *   node tools/query.mjs who 라피                    인물 사전: 대상 · 이름 · 이어진 이름표 · 정체 연결 후보 (person:라피도 된다)
 *   node tools/query.mjs speakers 호칭               이름표 분류 목록 — 갈래별(니케|인물|랩쳐|호칭|비인물|미상|여럿|미분류)
 *   node tools/query.mjs terms                      비인물 사전(장소 · 조직 · 개념 · 사건 · 물건) — 대상별 범위 안 건수
 *   node tools/query.mjs terms org --names          종류 하나만, 이름(별칭 · 표기)별 건수 · 오탐 주의까지
 *   node tools/query.mjs who 방주                    대상 하나 — 비인물이면 이름별 건수 · 검색 규칙
 *   node tools/query.mjs sample 진 [--n 10] [--tsv]  언급 DB 표본 — 이름(대상 ID면 그 이름 전부)이 자동 언급으로 걸린 줄에서 결정적 표본 (정밀도 재기)
 *                                                  · = 그 대상이 말하는 단위의 줄. --in-unit이면 그 줄만(auto "unit" 재기)
 *   node tools/query.mjs appear 마리안 [--scenes]     씬별 대상 인덱스 — 나온 단위 · 씬(출시순), 처음 · 마지막 등장 (--how named · --from ch10 --to ch20)
 *   node tools/query.mjs targets ch07               씬 · 단위 하나에 나온 대상과 방식별 줄 수, ★ = 처음 등장 (--type person)
 *   node tools/query.mjs signals 라피 [--flags]      T4-8 자동 신호 — 단위별 이름표 · 존댓말 비율 · 지휘관 호칭, 바뀐 곳 ◆ (--flags 바뀐 단위만)
 *   node tools/query.mjs stats                      전체 집계
 *   node tools/query.mjs releases                   공개 순서(출시 순): 메인 · 사이드 스토리 · 이벤트 · 호감도 스토리
 *   node tools/query.mjs releases event --from 2024-01-01 --to 2024-12-31   종류 · 기간으로 좁히기
 *   node tools/query.mjs known ch20                 컷오프(X1a) — 그 자리까지 읽은 사람이 아는 사실 · 의문 (숫자 = 공개 자리, 날짜 = 그날까지)
 *   node tools/query.mjs known 2024-01-01 --thread J1 [--about 라피] [--list]   줄기 · 대상으로 좁혀 목록까지
 *   node tools/query.mjs grades ch38 [--list]       중요도 컷오프(X3f) — 그 자리까지 나온 메인 밖 단위의 그 자리 등급(필수 · 보강 · 참고 · 독립), 메인 자리(from) 앞이라 아직 낮은 단위
 *   node tools/query.mjs chrono event_redash        작중 연대기(X1b) — 단위의 작중 자리(판별 · 범위 · 상대 · 불명) · 시점 기록의 관계 · 조각 · 이 단위를 기준으로 삼은 기록 ·
 *                                                   좁힘 항목과 좁히기 단서(X1c — 시점 코드 · 메인에서 처음 나온 대상 · 메인에서 바뀐 인물)
 *   node tools/query.mjs chrono ch20 | @방주_밀봉     메인 챕터 · 시대 기준점 — 그 점 무렵(앞뒤 칸)에 놓인 단위 · 조각도. 인자 없이 = 요약
 *                                                   단위에는 출시순과 어긋남(X1d — 공개 당시 메인과 견줌)도 찍는다
 *   node tools/query.mjs chrono person:라피 | 라피   인물 변화의 작중 시점(X1d) — 2회독 기준 · 변화를 작중 순서로, 먼저 공개된 변화보다 작중 앞인 것(뒤바뀜) 표시
 *   node tools/query.mjs person 라피 [--list]        인물별 집계(X3d — 화면 5) — 등장(자동 + 암시 언급) · 단위별 등장 · 자주 함께 나온 인물 · 기록 · 줄기 · 변화 · 마무리 (--list 기록 ID 목록)
 *   node tools/query.mjs sql "SELECT ..."           임의 질의 (읽기 전용)
 *
 * 한국어 검색 전략은 docs/schema.md 참고. 기본은 FTS 접두 검색이다.
 * 분석 범위(결정 #5, annotations/scope.json): search · speaker · speakers · stats는 범위 안만 센다. --all이면 범위 밖(돌발 등)도 넣는다.
 * DB가 없거나 오래됐으면 열기 전에 새로 만든다 (tools/normalize/ensure-db.mjs).
 * 시트는 참고자료다. 시트 값(유형·★·선행)은 기본 출력에 섞지 않는다 (docs/reference-table.md).
 */
import { parseArgs } from 'node:util';
import { openDb } from './normalize/ensure-db.mjs';
import { appearances, contextOf, howLabel, loadPlaces, namePairs, placeText, sampleName } from './lib/mentions.mjs';

let db; // 명령을 확인한 뒤에 연다 — 오타 때문에 DB 빌드를 기다리지 않게
const all = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);

const oneLine = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * 한국어는 조사가 붙어 한 토큰이 되므로 접두 검색을 기본으로 쓴다.
 * 3글자 이상이면 trigram으로 어중 매칭까지 확인한다.
 */
function searchLines(keyword, limit, { everything = false } = {}) {
  const quoted = `"${keyword.replace(/"/g, '""')}"`;
  const scope = everything ? '' : 'AND s.in_scope = 1';
  const rows = all(
    `SELECT f.story_id, f.seq, s.title, s.source, l.speaker_name, l.text
       FROM lines_fts f
       JOIN lines   l ON l.story_id = f.story_id AND l.seq = f.seq
       JOIN stories s ON s.id = f.story_id
      WHERE lines_fts MATCH ? ${scope}
      LIMIT ?`,
    `${quoted}*`,
    limit,
  );
  const count = (table, q, where) =>
    one(`SELECT COUNT(*) n FROM ${table} f JOIN stories s ON s.id = f.story_id WHERE ${table} MATCH ? ${where}`, q).n;
  const total = count('lines_fts', `${quoted}*`, scope);
  const outside = everything ? 0 : count('lines_fts', `${quoted}*`, 'AND s.in_scope = 0');
  let mid = null;
  if ([...keyword].length >= 3) {
    const t = count('lines_tri', quoted, scope);
    if (t !== total) mid = t;
  }
  return { rows, total, mid, outside };
}

/** 비인물 대상의 이름별 건수 · 갈래(how) · 오탐 주의 · 검색에서 빼는 표기 */
function printTermNames(t, indent = '  ') {
  console.log(`${indent}범위 안 ${t.lines_in_scope ?? 0}줄 · 씬 ${t.stories_in_scope ?? 0}`);
  for (const x of all('SELECT * FROM target_names WHERE target_id = ? ORDER BY how <> \'표준명\', lines_in_scope DESC', t.id)) {
    const ex = JSON.parse(x.excludes ?? '[]');
    console.log(
      `${indent}  ${String(x.lines_in_scope ?? 0).padStart(5)}줄  ${x.name} (${x.how})` +
        (x.caution ? `  ⚠ ${x.caution}` : '') + (ex.length ? `  — 뺌: ${ex.join(' · ')}` : ''),
    );
  }
}

const commands = {
  search(args, values) {
    const keyword = args.join(' ');
    if (!keyword) return console.error('검색어가 필요합니다');
    const limit = Number(values.limit ?? 10);
    const { rows, total, mid, outside } = searchLines(keyword, limit, { everything: values.all });
    console.log(
      `"${keyword}" — 접두 검색 ${total}줄${mid !== null ? ` / trigram 어중 포함 ${mid}줄` : ''}` +
        (values.all ? ' (범위 밖 포함)' : outside ? ` (범위 안. 범위 밖 ${outside}줄 더 — --all)` : '') + '\n',
    );
    for (const r of rows) {
      console.log(`  [${r.source}] ${r.title ?? r.story_id}  (${r.story_id}#${r.seq})`); // #N = lines.seq — 기록의 근거 줄 번호 (docs/annotations.md)
      console.log(`    ${r.speaker_name ?? '—'}: ${oneLine(r.text)}`);
    }
    if (total > rows.length) console.log(`\n  … ${total - rows.length}줄 더 (--limit 으로 조절)`);
  },

  story(args) {
    const id = args[0];
    const s = one('SELECT * FROM stories WHERE id = ?', id);
    if (!s) return console.error(`없는 노드: ${id}`);
    const cat = s.category_id ? one('SELECT * FROM categories WHERE id = ?', s.category_id) : null;
    console.log(`${s.title ?? s.id}`);
    console.log(`  ${s.kind} / ${s.source}${cat?.name ? ` / ${cat.name}` : ''}`);
    if (!s.has_text) return console.log('\n  원문 대사가 없는 노드입니다');
    console.log(`  대사 ${s.line_count}줄\n`);
    for (const l of all('SELECT * FROM lines WHERE story_id = ? ORDER BY seq', id)) {
      console.log(`  ${String(l.seq).padStart(3)} ${(l.speaker_name ?? '—').padEnd(10)} ${oneLine(l.text)}`);
    }
  },

  /**
   * 관계선(X2) — 씬 · 단위에 붙은 엣지 전부(게임 · 다음 편 · 기록 · 대상 공유 · 수동). 규칙은 tools/views/links.mjs 머리말.
   * 시트 엣지(origin = 'sheet')는 시트 작성자의 판단이다. 분석에 섞이지 않게 --sheet를 줄 때만 따로 보여 준다
   */
  async links(args, values) {
    const id = args[0];
    if (!id) return console.error('씬 · 단위가 필요합니다: node tools/query.mjs links ch07 | d_main_07_01_s [--type character,keyword] [--min 2] [--sheet]');
    const { buildLinks, TYPE_ORDER, TYPE_LABEL } = await import('./views/links.mjs');
    const { openContext } = await import('./records/context.mjs');
    const { loadDataset } = await import('./records/model.mjs');
    const { loadOrder } = await import('./records/order.mjs');
    const ctx = await openContext(db);
    const v = buildLinks(loadDataset(), ctx, loadOrder());
    const types = values.type ? new Set(String(values.type).split(',').map((x) => x.trim())) : null;
    const min = Number(values.min ?? 0);
    const keep = (e) => (!types || types.has(e.type)) && (e.strength ?? 0) >= min;
    const typeRank = (t) => TYPE_ORDER.indexOf(t);
    const dia = (n) => '◆'.repeat(n ?? 0).padEnd(3);
    const label = (t) => TYPE_LABEL[t] ?? t;
    const names = (xs) => xs.split(' ').filter(Boolean).map((t) => t.split(':')[1] ?? t).join(' · ');
    const cut = (xs, n = 8) => (xs.length > n ? `${xs.slice(0, n).join(' ')} 외 ${xs.length - n}` : xs.join(' '));
    const isUnit = v.places.unitPos.has(id);
    if (isUnit) {
      const u = v.units.find((x) => x.unit === id);
      console.log(`${id} — ${u.kind} · 읽는 자리 ${u.order}${u.title ? ` · ${u.title}` : ''}`);
      console.log(`  이어진 단위 ${u.in_units + u.out_units}(앞 ${u.in_units} · 뒤 ${u.out_units}) · 세기 2 이상 ${u.strong_units}${u.isolated ? ' · 고립' : ''}`);
      if (u.center) console.log(`  중심 대상: ${names(u.center)}`);
      const show = (title, rows, other) => {
        console.log(`\n  ${title} ${rows.length}건`);
        for (const x of rows.sort((a, b) => typeRank(a.type) - typeRank(b.type) || b.strength - a.strength || (other(a) === other(b) ? 0 : v.places.unitPos.get(other(a)) - v.places.unitPos.get(other(b))))) {
          const what = x.type === 'character' || x.type === 'keyword' ? names(x.targets) : cut(x.records.split(' ').filter(Boolean));
          const extra = [x.count > 1 ? `${x.count}건` : '', x.unconfirmed ? `후보 ${x.unconfirmed}` : '', x.origins.includes('manual') ? '수동' : ''].filter(Boolean).join(' · ');
          console.log(`    ${label(x.type).padEnd(12)} ${dia(x.strength)} ${other(x).padEnd(28)} ${x[other === fromOf ? 'from_kind' : 'to_kind'].padEnd(5)} ${what}${extra ? `  (${extra})` : ''}`);
        }
      };
      const fromOf = (x) => x.from_unit;
      const toOf = (x) => x.to_unit;
      show('앞 (먼저 볼 것)', v.unitEdges.filter((x) => x.to_unit === id && keep(x)), fromOf);
      show('뒤 (이걸 보고 나서)', v.unitEdges.filter((x) => x.from_unit === id && keep(x)), toOf);
      const inner = v.edges.filter((e) => e.from_unit === id && e.to_unit === id && keep(e));
      if (inner.length) console.log(`\n  같은 단위 안 ${inner.length}건 — ${TYPE_ORDER.map((t) => [t, inner.filter((e) => e.type === t).length]).filter(([, n]) => n).map(([t, n]) => `${label(t)} ${n}`).join(' · ')} (씬으로: links <씬 ID>)`);
    } else {
      const s = one('SELECT title FROM stories WHERE id = ?', id);
      if (!s && !v.edges.some((e) => e.from_scene === id || e.to_scene === id)) return console.error(`없는 씬 · 단위: ${id} (단위 키는 read.mjs 키 — ch07 · event_redash · char:10)`);
      const unit = v.places.unitOf(id);
      console.log(`${id}${s?.title ? ` — ${s.title}` : ''}${unit ? ` · 단위 ${unit}` : ''}`);
      const line = (e, end) => {
        const what = e.target ? `${e.target.split(':')[1]}${e.note ? ` · ${e.note}` : ''}` : [e.record, e.act, e.point && `→ ${e.point}`].filter(Boolean).join(' ') || e.note;
        const sc = end === 'from' ? e.from_scene : e.to_scene;
        const un = end === 'from' ? e.from_unit : e.to_unit;
        const ln = end === 'from' ? e.from_line : e.to_line;
        return `    ${label(e.type).padEnd(12)} ${dia(e.strength)} ${`${sc}${ln !== '' && ln != null ? `#${ln}` : ''}`.padEnd(30)} ${(un ?? '-').padEnd(24)} ${what ?? ''}${e.status === '후보' ? '  (후보)' : ''}  [${e.origin}]`;
      };
      const sort = (a, b) => typeRank(a.type) - typeRank(b.type) || (a.from_order ?? 0) - (b.from_order ?? 0) || (a.to_order ?? 0) - (b.to_order ?? 0);
      const inc = v.edges.filter((e) => e.to_scene === id && keep(e)).sort(sort);
      const out = v.edges.filter((e) => e.from_scene === id && keep(e)).sort(sort);
      console.log(`\n  선행 (먼저 볼 것) ${inc.length}건`);
      for (const e of inc) console.log(line(e, 'from'));
      console.log(`\n  후속 (이걸 보고 나서) ${out.length}건`);
      for (const e of out) console.log(line(e, 'to'));
    }
    const ids = isUnit ? ctx.resolve(id)?.scenes ?? [] : [id];
    const marks = ids.map(() => '?').join(',');
    const sheet = ids.length ? all(`SELECT * FROM edges WHERE origin = 'sheet' AND (from_id IN (${marks}) OR to_id IN (${marks}))`, ...ids, ...ids) : [];
    if (values.sheet) {
      console.log(`\n  시트 참고(추천 선행 — 분석 입력 아님) ${sheet.length}건`);
      for (const e of sheet) console.log(`    ${dia(e.strength)} ${e.from_id} → ${e.to_id}  ${e.note ?? ''}`);
    } else if (sheet.length) console.log(`\n  (시트 참고 엣지 ${sheet.length}건은 뺐다 — 보려면 --sheet)`);
    console.log(`\n  표: data/views/links/ (scene-edges · unit-edges · units · centers) · 거르기 --type ${TYPE_ORDER.join(',')} · --min 2`);
  },

  speaker(args, values) {
    const name = args.join(' ');
    const scope = values.all ? '' : 'AND s.in_scope = 1';
    const r = one(
      `SELECT l.speaker_name, COUNT(*) lines, COUNT(DISTINCT l.story_id) scenes
         FROM lines l JOIN stories s ON s.id = l.story_id
        WHERE l.speaker_name = ? ${scope} GROUP BY l.speaker_name`, name);
    if (!r) {
      const near = all('SELECT DISTINCT speaker_name FROM lines WHERE speaker_name LIKE ? LIMIT 10', `%${name}%`);
      const outside = values.all ? null : one('SELECT lines FROM speakers WHERE name = ?', name);
      console.error(`그 이름표로 된 대사가 ${outside ? '범위 안에 ' : ''}없습니다: ${name}${outside ? ` (범위 밖 ${outside.lines}줄 — --all)` : ''}`);
      if (near.length) console.error('  비슷한 이름표:', near.map((x) => x.speaker_name).join(', '));
      return;
    }
    const sp = one('SELECT * FROM speakers WHERE name = ?', name);
    console.log(`${r.speaker_name} — 대사 ${r.lines}줄 / 씬 ${r.scenes}개${values.all ? ' (범위 밖 포함)' : ''}`);
    if (sp) {
      const ids = JSON.parse(sp.targets ?? '[]');
      console.log(`  갈래 ${sp.class ?? '미분류'}${ids.length ? ` → ${ids.join(', ')}` : ''}${sp.how ? `  (${sp.how})` : ''}`);
      if (sp.code_lines) console.log(`  코드로 푼 줄 ${sp.code_lines} — 화면 이름표는 "${name}"`);
      if (sp.note) console.log(`  메모: ${sp.note}`);
    }
    console.log('\n  출처별');
    for (const x of all(
      `SELECT s.source, COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id
        WHERE l.speaker_name = ? ${scope} GROUP BY s.source ORDER BY n DESC`, name)) {
      console.log(`    ${x.source.padEnd(9)} ${x.n}`);
    }
    console.log('\n  많이 나온 씬');
    for (const x of all(
      `SELECT s.title, s.source, COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id
        WHERE l.speaker_name = ? ${scope} GROUP BY l.story_id ORDER BY n DESC LIMIT 8`, name)) {
      console.log(`    ${String(x.n).padStart(4)}줄  [${x.source}] ${x.title}`);
    }
  },

  /** 인물 사전 — 대상 ID나 이름(표준명 · 니케 목록 이름 · 이름표)으로 찾는다 */
  who(args) {
    const q = args.join(' ');
    if (!q) return console.error('대상 ID(person:라피)나 이름이 필요합니다');
    const ids = new Set();
    if (one('SELECT 1 x FROM targets WHERE id = ?', q)) ids.add(q);
    for (const r of all('SELECT DISTINCT target_id FROM target_names WHERE name = ?', q)) ids.add(r.target_id);
    const label = one('SELECT * FROM speakers WHERE name = ?', q);
    for (const id of JSON.parse(label?.targets ?? '[]')) ids.add(id);
    if (!ids.size) {
      const near = all(
        `SELECT DISTINCT target_id, name FROM target_names WHERE name LIKE ? LIMIT 10`, `%${q}%`);
      if (label) {
        console.log(`"${q}"는 대상 없는 이름표다 — 갈래 ${label.class ?? '미분류'}${label.note ? ` · ${label.note}` : ''}`);
      } else console.error(`사전에 없습니다: ${q}`);
      if (near.length) console.error('  비슷한 이름:', near.map((x) => `${x.name}(${x.target_id})`).join(', '));
      for (const c of all('SELECT * FROM target_links WHERE a = ?', `이름표:${q}`)) {
        console.log(`  정체 연결 ${c.id ?? ''} [${c.status} · ${c.confidence}] ${c.a} ↔ ${c.b} — ${c.reason}`);
      }
      return;
    }
    const labelsOf = (id) =>
      all(`SELECT s.* FROM speakers s, json_each(s.targets) j WHERE j.value = ? ORDER BY s.lines_in_scope DESC`, id);
    for (const id of ids) {
      const t = one('SELECT * FROM targets WHERE id = ?', id);
      console.log(`${t.id}  ${t.name}  [${t.kind ?? t.type}]${t.origin ? `  — ${t.origin}에서` : ''}`);
      if (t.note) console.log(`  메모: ${t.note}`);
      if (t.type !== 'person') {
        printTermNames(t);
        console.log('');
        continue;
      }
      const chars = all('SELECT resource_id, name FROM characters WHERE target_id = ? ORDER BY resource_id', id);
      if (chars.length) console.log(`  니케 목록: ${chars.map((c) => `${c.name}(char:${c.resource_id})`).join(' · ')}`);
      const names = all("SELECT name, how FROM target_names WHERE target_id = ? AND how NOT IN ('표준명', '니케 목록')", id);
      if (names.length) console.log(`  이름: ${names.map((x) => `${x.name}(${x.how})`).join(' · ')}`);
      const labels = labelsOf(id);
      if (label && !JSON.parse(label.targets ?? '[]').includes(id)) {
        console.log(`  같은 이름의 이름표 "${q}"는 이 대상이 아니다 — 갈래 ${label.class ?? '미분류'}, 범위 안 ${label.lines_in_scope}줄`);
      }
      const coded = one(
        `SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id
          WHERE l.speaker_target = ? AND l.speaker_via = '코드' AND s.in_scope = 1`, id).n;
      console.log(`  이름표 ${labels.length}종${coded ? ` + 코드로 푼 줄 ${coded}` : ''}`);
      for (const x of labels) {
        console.log(`    ${x.name}  범위 안 ${x.lines_in_scope}줄${x.class === '여럿' ? ' (여럿이 함께)' : ''}${x.how === '분류' && x.note ? ` — ${x.note}` : ''}`);
      }
      for (const c of all('SELECT * FROM target_links WHERE a = ? OR b = ?', id, id)) {
        const ev = JSON.parse(c.evidence ?? '[]').map((e) => `${e.scene}#${e.lines.join(',')}`).join(' ');
        console.log(`  정체 연결 ${c.id ?? ''} [${c.status} · ${c.confidence}] ${c.a} ↔ ${c.b} — ${c.reason}${ev ? ` (근거 ${ev})` : ''}`);
      }
      console.log('');
    }
  },

  /** 비인물 사전 — 종류별 대상과 범위 안 건수. --names면 이름별 건수 · 오탐 주의 · 검색 규칙까지 */
  terms(args, values) {
    const type = args[0];
    const types = ['place', 'org', 'concept', 'incident', 'item'];
    if (type && !types.includes(type)) return console.error(`종류: ${types.join(' | ')}`);
    const limit = Number(values.limit ?? 200);
    const sum = all(`SELECT type, COUNT(*) n FROM targets WHERE type <> 'person' GROUP BY type`)
      .sort((x, y) => types.indexOf(x.type) - types.indexOf(y.type));
    const names = one(`SELECT COUNT(*) n, SUM(caution IS NOT NULL) c FROM target_names WHERE target_id NOT LIKE 'person:%'`);
    console.log(
      `비인물 사전 — 대상 ${sum.reduce((a, r) => a + r.n, 0)} (${sum.map((r) => `${r.type} ${r.n}`).join(' · ')}) · 이름 ${names.n} · 오탐 주의 ${names.c}` +
        '\n건수 = 범위 안 대사 줄 수 (씬 수). 사전: annotations/dictionary/, 규칙: docs/schema.md "비인물 사전"\n',
    );
    for (const ty of type ? [type] : types) {
      const rows = all(`SELECT * FROM targets WHERE type = ? ORDER BY lines_in_scope DESC, id`, ty);
      if (!rows.length) continue;
      console.log(`[${ty}] ${rows.length}`);
      for (const t of rows.slice(0, limit)) {
        const n = all(`SELECT name, how, caution FROM target_names WHERE target_id = ? AND how <> '표준명' ORDER BY lines_in_scope DESC`, t.id);
        const warn = one('SELECT COUNT(*) c FROM target_names WHERE target_id = ? AND caution IS NOT NULL', t.id).c;
        console.log(
          `  ${String(t.lines_in_scope ?? 0).padStart(5)}줄 (${String(t.stories_in_scope ?? 0).padStart(4)})  ${t.name}  [${t.kind ?? '-'}]` +
            (n.length && !values.names ? `  = ${n.map((x) => x.name).join(' · ')}` : '') + (warn ? '  ⚠' : ''),
        );
        if (values.names) printTermNames(t, '      ');
      }
      if (rows.length > limit) console.log(`  … ${rows.length - limit}개 더 (--limit)`);
      console.log('');
    }
    console.log('⚠ = 오탐 주의 이름이 있음 (흔한 말과 겹침 등). 대상 하나: node tools/query.mjs who <이름>');
  },

  /** 이름표 분류 목록 — 갈래를 주면 그 갈래만 */
  speakers(args, values) {
    const cls = args[0];
    const col = values.all ? 'lines' : 'lines_in_scope';
    const where = [`${col} > 0`];
    const params = [];
    if (cls === '미분류') where.push('class IS NULL');
    else if (cls) where.push('class = ?'), params.push(cls);
    const rows = all(`SELECT * FROM speakers WHERE ${where.join(' AND ')} ORDER BY ${col} DESC, name`, ...params);
    const limit = Number(values.limit ?? 50);
    console.log(`이름표 ${rows.length}종${cls ? ` (${cls})` : ''} — ${values.all ? '범위 밖 포함' : '범위 안'} 줄 수 순\n`);
    if (!cls) {
      for (const r of all(`SELECT class, COUNT(*) n, SUM(${col}) l FROM speakers WHERE ${col} > 0 GROUP BY class ORDER BY l DESC`)) {
        console.log(`  ${(r.class ?? '미분류').padEnd(4)} ${String(r.n).padStart(4)}종 ${String(r.l).padStart(7)}줄`);
      }
      return console.log('\n갈래를 주면 목록: node tools/query.mjs speakers 호칭');
    }
    for (const r of rows.slice(0, limit)) {
      const ids = JSON.parse(r.targets ?? '[]');
      console.log(`  ${String(r[col]).padStart(6)}줄  ${r.name}${ids.length && ids[0] !== `person:${r.name.replace(/\s+/g, '_')}` ? ` → ${ids.join(', ')}` : ''}`);
    }
    if (rows.length > limit) console.log(`\n  … ${rows.length - limit}종 더 (--limit)`);
  },

  stats(args, values) {
    const scope = values.all ? '' : 'WHERE in_scope = 1';
    console.log(`출처별 노드${values.all ? ' (범위 밖 포함)' : ' (분석 범위 안 — 범위 밖까지 보려면 --all)'}`);
    for (const r of all(
      `SELECT source, kind, COUNT(*) n, SUM(has_text) t, SUM(line_count) l
         FROM stories ${scope} GROUP BY source, kind ORDER BY n DESC`)) {
      console.log(`  ${r.source.padEnd(13)} ${r.kind.padEnd(11)} ${String(r.n).padStart(5)}개  원문 ${String(r.t).padStart(5)}  대사 ${String(r.l).padStart(7)}`);
    }
    const out = all('SELECT scope_note, COUNT(*) n, SUM(line_count) l FROM stories WHERE in_scope = 0 GROUP BY scope_note');
    if (out.length) {
      console.log('\n범위 밖 (annotations/scope.json)');
      for (const r of out) console.log(`  ${String(r.n).padStart(5)}개  대사 ${String(r.l).padStart(6)}  ${r.scope_note}`);
    }
    console.log('\n관계 엣지');
    for (const r of all('SELECT origin, type, COUNT(*) n FROM edges GROUP BY origin, type ORDER BY n DESC')) {
      const origin = r.origin === 'sheet' ? 'sheet(참고)' : r.origin;
      console.log(`  ${origin.padEnd(15)} ${r.type.padEnd(10)} ${r.n}`);
    }
    console.log('\n인물 사전 · 이름표 분류');
    const kinds = all("SELECT kind, COUNT(*) n FROM targets WHERE type = 'person' GROUP BY kind ORDER BY n DESC");
    console.log(`  대상 ${kinds.reduce((a, r) => a + r.n, 0)} (${kinds.map((r) => `${r.kind} ${r.n}`).join(' · ')})` +
      ` · 정체 연결 후보 ${one("SELECT COUNT(*) n FROM target_links WHERE status = '후보'").n}`);
    const col = values.all ? 'lines' : 'lines_in_scope';
    const sp = one(`SELECT COUNT(*) n, SUM(class IS NULL) u, SUM(${col}) l FROM speakers WHERE ${col} > 0`);
    console.log(`  이름표 ${sp.n}종 ${sp.l}줄 · 미분류 ${sp.u}종 — 갈래별은 node tools/query.mjs speakers`);
    const terms = all("SELECT type, COUNT(*) n FROM targets WHERE type <> 'person' GROUP BY type ORDER BY n DESC");
    console.log(`  비인물 사전 ${terms.reduce((a, r) => a + r.n, 0)} (${terms.map((r) => `${r.type} ${r.n}`).join(' · ')}) — node tools/query.mjs terms`);
    console.log('\n시트 참고 연결');
    // 원문 없는 행도 sheet: 자리표시 노드를 타깃으로 갖는다. 데이터 연결과 섞어 세면 "전부 연결"로 보인다
    const sr = one(
      `SELECT COUNT(*) n, SUM(target_id NOT LIKE 'sheet:%') t, SUM(target_id LIKE 'sheet:%') p,
              SUM(unresolved IS NOT NULL) u FROM sheet_rows`);
    console.log(`  행 ${sr.n} / 데이터 연결 ${sr.t} / 원문 없는 노드 ${sr.p} / 미해석 선행 있는 행 ${sr.u}`);
    const tot = one(`SELECT COUNT(*) n FROM lines l JOIN stories s ON s.id = l.story_id ${scope.replace('in_scope', 's.in_scope')}`);
    console.log(`\n대사 총 ${tot.n.toLocaleString('ko-KR')}줄${values.all ? '' : ' (범위 안)'}`);
  },

  /** 공개 순서. data/release/release-order.csv(tools/notices/release-order.mjs)를 실은 releases 테이블. */
  releases(args, opts) {
    const kinds = args.filter((a) => ['main', 'side', 'event', 'episode'].includes(a));
    const where = [];
    const params = [];
    if (kinds.length) where.push(`kind IN (${kinds.map(() => '?').join(',')})`), params.push(...kinds);
    if (opts.from) where.push('date >= ?'), params.push(opts.from);
    if (opts.to) where.push('date <= ?'), params.push(opts.to);
    const rows = all(
      `SELECT * FROM releases ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY date IS NULL, date, CASE kind WHEN 'main' THEN 0 WHEN 'side' THEN 1 WHEN 'event' THEN 2 ELSE 3 END, key`, ...params);
    if (!rows.length) return console.log('(결과 없음 — node tools/notices/release-order.mjs로 만든다)');
    const label = { main: '메인', side: '사이드', event: '이벤트', episode: '호감도' };
    const limit = Number(opts.limit ?? 0) || rows.length;
    let lastDate;
    for (const r of rows.slice(0, limit)) {
      if (r.date !== lastDate) {
        console.log(r.date ? `\n#${r.rank} ${r.date}` : '\n날짜 없음');
        lastDate = r.date;
      }
      const note = [r.basis !== '기간 줄' && r.basis !== '업데이트 날짜' ? r.basis : '', r.confidence === '추정' ? '추정' : '']
        .filter(Boolean).join(' · ');
      console.log(`  ${label[r.kind].padEnd(4)} ${r.key.padEnd(24)} ${r.name}${note ? `  (${note})` : ''}${r.parts ? `  [${r.parts}]` : ''}`);
    }
    if (rows.length > limit) console.log(`\n… ${rows.length - limit}줄 더 (--limit)`);
    console.log('\n근거(공지 · 인용 줄)는 data/release/release-order.csv, 공백은 data/release/report.md');
  },

  /**
   * 언급 DB 표본 정밀도 재기 — 이름(또는 대상 ID의 이름 전부)이 자동 언급으로 걸리는 줄에서 결정적 표본을 뽑는다.
   * 판정은 annotations/dictionary/mention-precision.json에 적는다(docs/schema.md "언급 DB").
   */
  sample(args, values) {
    if (!args.length) return console.error('이름이나 대상 ID가 필요합니다: node tools/query.mjs sample 진 [--n 10] [--seed 1] [--tsv]');
    const n = Number(values.n ?? 10);
    const seed = Number(values.seed ?? 1);
    if (values.tsv) console.log(['대상', '이름', '걸린 줄', '씬#줄', '이름표', '문맥', '판정'].join('\t'));
    for (const q of args) {
      const pairs = namePairs(db, q);
      if (!pairs.length) console.error(`사전에 없는 이름 · 대상: ${q}`);
      for (const p of pairs) {
        const { total, rows } = sampleName(db, p, { n, seed, inUnit: values['in-unit'] });
        if (values.tsv) {
          for (const r of rows) console.log([p.target_id, p.name, total, `${r.story_id}#${r.seq}`, r.speaker_name ?? r.window, contextOf(r, p.name), ''].join('\t'));
          continue;
        }
        const state = { off: ' — 자동에서 뺌', unit: ' — 말하는 단위 안만' }[p.mention_mode] ?? '';
        console.log(`${p.name} → ${p.target_id} (${p.how}) — 걸린 줄 ${total}${values['in-unit'] ? '(말하는 단위 안)' : ''}${p.precision ? ` · 표본 정밀도 ${p.precision}` : ''}${state}`);
        for (const r of rows) console.log(`  ${r.inUnit ? '·' : ' '} ${`${r.story_id}#${r.seq}`.padEnd(28)} ${(r.speaker_name ?? r.window ?? '').slice(0, 8).padEnd(8)} ${contextOf(r, p.name)}`);
      }
    }
  },

  /**
   * 씬별 대상 인덱스 — 대상이 나온 씬을 읽는 순서(출시순)로. 처음 · 마지막 등장(T3-3), 단위별 씬 수.
   * 2회독 되짚어 읽기가 필요한 씬만 찾을 때 쓴다. --scenes면 씬마다, --how speaks|named|alias로 방식 하나만.
   */
  async appear(args, values) {
    const q = args.join(' ');
    if (!q) return console.error('대상 ID나 이름이 필요합니다: node tools/query.mjs appear 마리안 [--scenes] [--how named] [--from 키] [--to 키]');
    const ids = q.includes(':') ? [q] : [...new Set([...namePairs(db, q).map((p) => p.target_id),
      ...JSON.parse(one('SELECT targets FROM speakers WHERE name = ?', q)?.targets ?? '[]')])];
    if (!ids.length) return console.error(`사전에 없는 이름 · 대상: ${q}`);
    const places = await loadPlaces(db);
    const fromPos = values.from ? places.unitPos.get(values.from) : null;
    const toPos = values.to ? places.unitPos.get(values.to) : null;
    if ((values.from && !fromPos) || (values.to && !toPos)) return console.error(`읽는 순서에 없는 단위: ${values.from ?? ''} ${values.to ?? ''}`);
    for (const id of ids) {
      const a = appearances(db, places, { target: id }).get(id);
      const t = one('SELECT name, kind FROM targets WHERE id = ?', id);
      if (!a) {
        console.log(`${id}  ${t?.name ?? ''} — 자동 언급 없음\n`);
        continue;
      }
      const ln = a.lines;
      console.log(`${id}  ${t?.name ?? ''} [${t?.kind ?? '-'}] — 씬 ${a.scenes.size} · 단위 ${a.units.size} · 말함 ${ln.speaks}줄 · 이름 ${ln.named}줄 · 다른 이름 ${ln.alias}줄` +
        (a.unplaced ? ` · 순서 밖 씬 ${a.unplaced}` : ''));
      console.log(`  처음 ${placeText(a.first)} · 처음 말함 ${placeText(a.firstSpeaks)} · 처음 이름 ${placeText(a.firstNamed)}`);
      console.log(`  마지막 ${placeText(a.last)}`);
      const how = values.how;
      const scenes = [...a.scenes].filter(([, s]) => s.pos && (!how || s[how] > 0))
        .filter(([, s]) => (!fromPos || s.pos[0] >= fromPos) && (!toPos || s.pos[0] <= toPos))
        .sort((x, y) => x[1].pos[0] - y[1].pos[0] || x[1].pos[1] - y[1].pos[1]);
      const fmt = (s) => ['speaks', 'named', 'alias'].filter((h) => s[h]).map((h) => `${howLabel(h)} ${s[h]}`).join(' · ');
      const limit = Number(values.limit ?? (values.scenes ? 200 : 80));
      if (values.scenes) {
        for (const [scene, s] of scenes.slice(0, limit)) console.log(`  ${places.unitOf(scene).padEnd(26)} ${`${scene}#${s.first_seq}`.padEnd(34)} ${fmt(s)}`);
        if (scenes.length > limit) console.log(`  … ${scenes.length - limit}씬 더 (--limit)`);
      } else {
        const byUnit = new Map();
        for (const [scene, s] of scenes) {
          const u = places.unitOf(scene);
          const b = byUnit.get(u) ?? byUnit.set(u, { n: 0, speaks: 0, named: 0, alias: 0, first: `${scene}#${s.first_seq}` }).get(u);
          b.n++;
          for (const h of ['speaks', 'named', 'alias']) b[h] += s[h];
        }
        const units = [...byUnit];
        for (const [u, b] of units.slice(0, limit)) console.log(`  ${u.padEnd(26)} 씬 ${String(b.n).padStart(3)}  ${fmt(b).padEnd(26)} 처음 ${b.first}`);
        if (units.length > limit) console.log(`  … ${units.length - limit}단위 더 (--limit)`);
      }
      console.log('');
    }
  },

  /** 씬 · 단위 하나에 나온 대상 — 방식별 줄 수. 이 자리가 그 대상의 처음 등장이면 ★ */
  async targets(args, values) {
    const key = args[0];
    if (!key) return console.error('씬 ID나 단위 키가 필요합니다: node tools/query.mjs targets d_main_07_01 | ch07');
    const places = await loadPlaces(db);
    const ctx = await (await import('./records/context.mjs')).openContext(db);
    const r = ctx.resolve(key);
    if (!r) return console.error(`모르는 씬 · 단위: ${key}`);
    const ph = r.scenes.map(() => '?').join(',');
    const rows = r.scenes.length ? all(`SELECT * FROM scene_targets WHERE story_id IN (${ph})`, ...r.scenes) : [];
    const agg = new Map();
    for (const x of rows) {
      const b = agg.get(x.target) ?? agg.set(x.target, { scenes: 0, speaks: 0, named: 0, alias: 0 }).get(x.target);
      b.scenes++;
      for (const h of ['speaks', 'named', 'alias']) b[h] += x[h];
    }
    const firsts = appearances(db, places);
    const type = values.type;
    const list = [...agg].filter(([id]) => !type || id.startsWith(`${type}:`))
      .sort((x, y) => y[1].speaks + y[1].named + y[1].alias - (x[1].speaks + x[1].named + x[1].alias));
    console.log(`${r.title} (${key}) — 씬 ${r.scenes.length} · 대상 ${list.length}${type ? ` (${type})` : ''}  ★ = 여기가 처음 등장(출시순)`);
    const limit = Number(values.limit ?? 60);
    for (const [id, b] of list.slice(0, limit)) {
      const f = firsts.get(id)?.first;
      const star = f && r.scenes.includes(f.scene) ? ' ★' : '';
      const name = one('SELECT name FROM targets WHERE id = ?', id)?.name ?? '';
      console.log(`  ${`${id}`.padEnd(24)} ${name.padEnd(10)} ${r.type === 'unit' ? `씬 ${String(b.scenes).padStart(2)}  ` : ''}` +
        ['speaks', 'named', 'alias'].filter((h) => b[h]).map((h) => `${howLabel(h)} ${b[h]}`).join(' · ') + star);
    }
    if (list.length > limit) console.log(`  … ${list.length - limit}대상 더 (--limit · --type person|place|org|concept|incident|item)`);
  },

  /** T4-8 자동 신호 — 인물 하나의 단위별 이름표 · 존댓말 비율 · 지휘관 호칭과 바뀐 곳(tools/views/signals.mjs). --flags면 표시된 단위만 */
  async signals(args, values) {
    const q = args.join(' ');
    if (!q) return console.error('인물 대상 ID나 이름이 필요합니다: node tools/query.mjs signals 라피 [--flags]');
    const ids = q.includes(':') ? [q] : [...new Set(namePairs(db, q).map((p) => p.target_id).filter((id) => id.startsWith('person:')))];
    if (!ids.length) return console.error(`사전에 없는 인물: ${q}`);
    const { buildSignals } = await import('./views/signals.mjs');
    for (const id of ids) {
      const { rows } = await buildSignals(db, { target: id });
      const shown = values.flags ? rows.filter((r) => r.flags) : rows;
      console.log(`${id} — 말한 단위 ${rows.length} · 표시 ${rows.filter((r) => r.flags).length}  (존댓말 = 존댓말 / (존댓말 + 반말) 문장)`);
      const limit = Number(values.limit ?? 120);
      for (const r of shown.slice(0, limit)) {
        console.log(`  ${String(r.order).padStart(3)} ${r.unit.padEnd(26)} ${String(r.lines).padStart(4)}줄  존댓말 ${r.polite_ratio === '' ? ' -  ' : `${Math.round(r.polite_ratio * 100)}%`.padStart(4)}` +
          `  ${r.address ? `호칭 ${r.address}` : ''}${r.labels.includes(' · ') || values.labels ? `  이름표 ${r.labels}` : ''}${r.flags ? `  ◆ ${r.flags}` : ''}`);
      }
      if (shown.length > limit) console.log(`  … ${shown.length - limit}단위 더 (--limit)`);
      console.log('');
    }
  },

  /**
   * 컷오프(X1a · T5-8) — 그 자리까지 읽은 사람이 아는 것: 사실(앎 · 뒤집힘 · 암시만) · 의문(열림 · 일부 · 풀림 · 암시만).
   * 자리 = 단위 키(그 단위의 공개 자리) · 숫자(공개 자리) · 날짜(그날까지). 같은 날 나온 단위는 다 읽은 것으로 본다(tools/views/reveal.mjs).
   */
  async known(args, values) {
    const q = args.join(' ');
    if (!q) return console.error('자리가 필요합니다: node tools/query.mjs known ch20 | 45 | 2024-01-01 [--thread J1] [--about person:라피] [--list]');
    const { openContext } = await import('./records/context.mjs');
    const { loadDataset } = await import('./records/model.mjs');
    const { loadOrder } = await import('./records/order.mjs');
    const { knownAt, releasePlaces, revealStages } = await import('./views/reveal.mjs');
    const ctx = await openContext(db);
    const order = loadOrder();
    const rel = releasePlaces(ctx, order);
    let T;
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) T = rel.ticks.filter((t) => t.date <= q).at(-1)?.tick ?? 0;
    else if (/^\d+$/.test(q)) T = Math.min(Number(q), rel.ticks.length);
    else T = rel.byUnit.get(q)?.tick ?? rel.byUnit.get(ctx.resolve(q)?.unit?.key)?.tick;
    if (T == null) return console.error(`읽는 순서에 없는 단위: ${q}`);
    let about = values.about;
    if (about && !about.includes(':')) about = one('SELECT id FROM targets WHERE name = ? ORDER BY id LIMIT 1', about)?.id ?? about;
    const st = revealStages(loadDataset(), ctx, order, rel);
    const k = knownAt(st, T, { thread: values.thread, about });
    const tk = rel.ticks[T - 1];
    console.log(T ? `공개 자리 ${T}/${rel.ticks.length} (${tk.date}${tk.main ? ` · 메인 ${tk.main}까지` : ''} · 이 자리 단위 ${tk.units.length}) — 같은 날 나온 단위는 다 읽은 것으로 본다`
      : `공개 자리 0 — ${q}에는 아직 나온 것이 없다`);
    if (values.thread || about) console.log(`필터: ${[values.thread, about].filter(Boolean).join(' · ')}`);
    const f = k.facts;
    const qs = k.questions;
    console.log(`사실: 앎 ${f.known.length} · 뒤집힘 ${f.reversed.length} · 암시만 ${f.hinted.length} · 아직 ${f.hidden}`);
    console.log(`의문: 열림 ${qs.open.length} · 일부 ${qs.partial.length} · 풀림 ${qs.solved.length} · 암시만 ${qs.hinted.length} · 아직 ${qs.hidden}`);
    if (!values.list && !values.thread && !about) return console.log('\n목록은 --list (줄기 · 대상으로 좁히기: --thread J1 · --about person:라피)');
    const limit = Number(values.limit ?? 40);
    const show = (label, rs, fmt) => {
      if (!rs.length) return;
      console.log(`\n[${label}] ${rs.length}`);
      for (const r of rs.slice(0, limit)) console.log(`  ${r.id.padEnd(6)} ${fmt(r)}  ${oneLine(r.text)}`);
      if (rs.length > limit) console.log(`  … ${rs.length - limit}건 더 (--limit)`);
    };
    const at = (t) => t !== '' && t <= T;
    show('의문 열림', qs.open, (r) => `제기 ${r.first_units}`);
    show('의문 일부', qs.partial, (r) => `제기 ${r.first_units}`);
    show('의문 풀림', qs.solved, (r) => `제기 ${r.first_units}`);
    show('의문 암시만', qs.hinted, () => '');
    show('사실 앎', f.known, (r) => `${r.first_units}${at(r.hint_tick) && r.hints_before ? ' · 앞서 암시' : ''}`);
    show('사실 뒤집힘', f.reversed, (r) => `${r.first_units} → ${r.replaced_by || '?'}`);
    show('사실 암시만', f.hinted, () => '');
    ctx.close();
  },

  /**
   * 중요도 컷오프(X3f ⑤) — 공개 자리 T에서 메인 밖 단위의 등급. 자리 읽기는 known과 같다. 규칙은 tools/views/importance.mjs 머리말(gradeAt).
   */
  async grades(args, values) {
    const q = args.join(' ');
    if (!q) return console.error('자리가 필요합니다: node tools/query.mjs grades ch38 | 97 | 2025-01-01 [--list]');
    const { openContext } = await import('./records/context.mjs');
    const { GRADES, loadDataset } = await import('./records/model.mjs');
    const { loadOrder, loadReadLayers } = await import('./records/order.mjs');
    const { releasePlaces } = await import('./views/reveal.mjs');
    const { buildImportance, gradeAt } = await import('./views/importance.mjs');
    const ctx = await openContext(db);
    const order = loadOrder();
    const rel = releasePlaces(ctx, order);
    let T;
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) T = rel.ticks.filter((t) => t.date <= q).at(-1)?.tick ?? 0;
    else if (/^\d+$/.test(q)) T = Math.min(Number(q), rel.ticks.length);
    else T = rel.byUnit.get(q)?.tick ?? rel.byUnit.get(ctx.resolve(q)?.unit?.key)?.tick;
    if (T == null) return console.error(`읽는 순서에 없는 단위: ${q}`);
    const v = buildImportance(loadDataset(), ctx, order, { readLayers: loadReadLayers() });
    const tk = rel.ticks[T - 1];
    console.log(T ? `공개 자리 ${T}/${rel.ticks.length} (${tk.date}${tk.main ? ` · 메인 ${tk.main}까지` : ''}) — 같은 날 나온 단위는 다 읽은 것으로 본다` : `공개 자리 0 — ${q}에는 아직 나온 것이 없다`);
    const out = v.units.map((u) => ({ u, g: gradeAt(u, T) })).filter((x) => x.g);
    console.log(`나온 메인 밖 단위 ${out.length}/${v.units.length}: ${GRADES.map((g) => `${g} ${out.filter((x) => x.g === g).length}`).join(' · ')}`);
    const lower = out.filter((x) => x.g !== x.u.grade);
    if (lower.length) console.log(`메인 자리 앞이라 아직 낮은 단위 ${lower.length}: ${lower.map((x) => `${x.u.unit} ${x.g}(→ ${x.u.from} ${x.u.grade})`).join(' · ')}`);
    if (values.list) {
      for (const g of GRADES) {
        const us = out.filter((x) => x.g === g);
        if (us.length) console.log(`\n${g} ${us.length}: ${us.map((x) => x.u.unit).join(' ')}`);
      }
    }
    ctx.close();
  },

  /**
   * 작중 연대기(X1b) — 시점 기록의 관계(at)로 계산한 작중 자리. 규칙은 tools/views/chrono.mjs 머리말.
   */
  async chrono(args, values) {
    const q = args.join(' ');
    const { openContext } = await import('./records/context.mjs');
    const { loadDataset } = await import('./records/model.mjs');
    const { loadOrder } = await import('./records/order.mjs');
    const { releasePlaces } = await import('./views/reveal.mjs');
    const { buildChronology } = await import('./views/timeline.mjs');
    const { changeTimeline, releaseDrift, unitSpans } = await import('./views/chrono-order.mjs');
    const ctx = await openContext(db);
    const rel = releasePlaces(ctx, loadOrder());
    const ds = loadDataset();
    const ch = buildChronology(ds, ctx, rel);
    const spans = unitSpans(ch);
    const drift = releaseDrift(ch, rel, spans);
    const unitKey = ctx.resolve(q)?.unit?.key;
    const { chronoClues } = await import('./views/chrono-clues.mjs');
    const clues = q ? chronoClues({ ctx, rel, ds, codes: ch.codes }) : new Map();
    ctx.close();
    const CLASSES = ['판별', '범위', '상대', '불명'];
    const count = (xs) => CLASSES.map((c) => `${c} ${xs.filter((r) => r.class === c).length}`).join(' · ');
    if (!q) {
      console.log(`작중 축 ${ch.points.length}점(시대 기준점 ${ch.points.filter((p) => p.era).length} + 메인 ${ch.points.filter((p) => !p.era).length}) · 시점 기록 ${ch.stats.times} · 관계 · 연수 ${ch.stats.relations}`);
      console.log(`단위 ${ch.rows.length}: ${count(ch.rows)} (기록 없음 ${ch.rows.filter((r) => !r.records).length})`);
      console.log(`조각 ${ch.pieces.length}: ${count(ch.pieces)}`);
      console.log(`모순 ${ch.contradictions.length} · 순환 ${ch.cycles.length} · 메인 챕터끼리 번호 순과 다른 기록 ${ch.mainNotes.length}`);
      const dr = [...drift.values()];
      console.log(`출시순과 어긋남(메인 밖): ${['과거', '앞', '맞음', '걸침', '뒤'].map((d) => `${d} ${dr.filter((x) => x.drift === d).length}`).join(' · ')} · 모름 ${ch.rows.filter((r) => r.kind !== '메인' && !drift.get(r.unit)?.drift).length}`);
      return console.log('\n단위 하나: node tools/query.mjs chrono <단위 키> · 그 점 무렵: chrono ch20 | @방주_밀봉 · 인물 변화: chrono person:라피 · 표: data/views/timeline/chrono.csv · 시안: chrono.md');
    }
    // 인물 — 2회독 인물 변화를 작중 순서로(X1d)
    const personId = q.startsWith('person:') ? q : !ch.points.some((p) => p.id === q) && !ch.rows.some((r) => r.unit === q || r.unit === unitKey)
      ? one("SELECT id FROM targets WHERE name = ? AND id LIKE 'person:%' ORDER BY id LIMIT 1", q)?.id : null;
    if (personId) {
      const ct = changeTimeline(ds, ch, spans, rel);
      const rs = ct.rows.filter((r) => r.person === personId);
      const pp = ct.persons.find((p) => p.person === personId);
      if (!rs.length) return console.error(`2회독 인물 변화가 없는 인물: ${personId}`);
      console.log(`${personId} — 기준 ${rs.filter((r) => r.act === '기준').length} · 변화 ${pp.changes} · 뒤바뀐 변화 ${pp.inverted} (작중 순서 — time이 없으면 드러난 단위의 자리)`);
      const lim = Number(values.limit ?? 200);
      const line = (r) => {
        const head = `${r.id} [${r.act} · ${r.aspect}${r.with ? `(${r.with.replace(/person:/g, '')})` : ''}]`;
        const where = `${r.place || r.class} · ${r.unit}(공개 ${r.tick})${r.source.startsWith('조각') ? ` ↺${r.time}` : ''}`;
        return `${String(r.seq).padStart(4)}. ${head} ${where}${r.inverted ? ` ◀ 먼저 공개된 ${r.inverted}보다 작중 앞` : ''} — ${oneLine(r.text).slice(0, 90)}`;
      };
      const placed = rs.filter((r) => r.seq !== '');
      for (const r of placed.slice(0, lim)) console.log(line(r));
      if (placed.length > lim) console.log(`  … ${placed.length - lim}줄 더 (--limit)`);
      const rest = rs.filter((r) => r.seq === '');
      if (rest.length) {
        console.log(`\n작중 자리 모름(단위가 상대 · 불명) ${rest.length} — 공개 순`);
        for (const r of rest.slice(0, lim)) console.log(`     ${r.id} [${r.act} · ${r.aspect}] ${r.unit}(공개 ${r.tick}) ${r.class} — ${oneLine(r.text).slice(0, 90)}`);
      }
      return console.log('\n표: data/views/timeline/chrono-changes.csv');
    }
    const times = new Map(ds.candidates.filter((c) => c.kind === 'time').map((c) => [c.id, c]));
    const relLine = (id) => {
      const t = times.get(id);
      const at = t?.obj?.at ?? [];
      const rels = [...at.map((r) => `${r[0]} ${r[1]}${r[2] ? ` (${r[2]})` : ''}`), ...(t?.obj?.years !== undefined ? [`연수 ${[].concat(t.obj.years).join('–')}년 전`] : [])];
      return `${id} [${t?.act ?? '?'}${t?.obj?.subject ? ` · ${t.obj.subject}` : ''}] ${rels.join('; ') || '(관계 없음)'} — ${oneLine(t?.text ?? '')}`;
    };
    const point = ch.points.find((p) => p.id === q);
    const row = ch.rows.find((r) => r.unit === q) ?? ch.rows.find((r) => r.unit === unitKey);
    if (!point && !row) return console.error(`작중 연대기에 없는 단위 · 기준점: ${q}`);
    if (row) {
      console.log(`${row.unit} (${row.kind}, 공개 자리 ${row.tick || '-'}) — ${row.class}${row.place ? ` · ${row.place}` : ''}${row.via ? ` (${row.via})` : ''}`);
      const d = drift.get(row.unit);
      if (d?.drift) console.log(`  출시순과 어긋남(X1d): 공개 당시 메인 ${d.release_main} — ${d.drift}${d.drift_gap !== '' ? ` (사이 챕터 ${d.drift_gap})` : ''}`);
      const recs = row.records ? row.records.split(' ') : [];
      const nw = ch.narrows.find((e) => e.unit === row.unit && !e.piece);
      if (!recs.length && !nw) console.log('시점 기록 · 좁힘 항목 없음 — 새 단위면 annotations/chronology.json units에 좁힘을 더한다(docs/annotations.md "좁힘")');
      const narrowLine = (e, pad) => {
        const at = [...(e.at ?? []).map((r) => `${r[0]} ${r[1]}${r[2] ? ` (${r[2]})` : ''}`), ...(e.years !== undefined ? [`연수 ${[].concat(e.years).join('–')}년 전`] : [])];
        console.log(`${pad}좁힘 [${e.confidence} · ${e.session}${e.by ? ` · ${e.by}` : ''}] ${at.join('; ') || '단서 없음 — 시점 불명'} — ${oneLine(e.reason ?? '')}`);
        if (e.basis?.length) console.log(`${pad}    근거 ${e.basis.join(' ')}`);
      };
      if (nw) narrowLine(nw, '  ');
      for (const id of recs) {
        const p = ch.pieces.find((x) => x.id === id);
        console.log(`  ${relLine(id)}`);
        const pn = ch.narrows.find((e) => e.piece === id);
        if (pn) narrowLine(pn, '      ');
        if (p) console.log(`      → 조각 ${p.class}${p.place ? ` · ${p.place}` : ''}`);
      }
      const others = ch.cons.filter((c) => c.b === `unit:${row.unit}` && !recs.includes(c.record) && c.record);
      if (others.length) {
        console.log(`\n이 단위를 기준으로 삼은 기록 ${others.length}`);
        for (const c of others.slice(0, Number(values.limit ?? 40))) {
          const u = ch.rows.find((r) => r.records.split(' ').includes(c.record));
          console.log(`  ${c.record} ${u?.unit ?? '?'}: ${c.rel} ${c.base}${u ? ` — ${u.class}${u.place ? ` · ${u.place}` : ''}` : ''}`);
        }
      }
    }
    const cl = row && clues.get(row.unit);
    if (cl && (cl.codes || cl.intro || cl.changes)) {
      console.log('\n단서(X1c — 기계적 신호, 해석이 아니다)');
      if (cl.codes) console.log(`  모습 코드  ${cl.codes}`);
      if (cl.intro) console.log(`  메인에서 처음 나온 대상  ${cl.intro}`);
      if (cl.changes) console.log(`  메인에서 바뀐 인물  ${cl.changes}`);
    }
    if (point) {
      const near = (lo, hi) => lo !== '' && hi !== '' && Number(lo) >= point.pos - 1 && Number(hi) <= point.pos + 1;
      const us = ch.rows.filter((r) => r.via !== '메인' && near(r.lo, r.hi));
      const ps = ch.pieces.filter((p) => near(p.lo, p.hi));
      console.log(`\n${q} 무렵(앞뒤 칸까지)에 놓인 단위 ${us.length} · 조각 ${ps.length}`);
      for (const r of us) console.log(`  ${r.unit.padEnd(28)} ${r.place}`);
      for (const p of ps) console.log(`  ${(`${p.id} ${p.unit}`).padEnd(28)} ${p.place} [${p.kind}]`);
    }
  },

  /**
   * 인물별 집계(X3d) — 규칙은 tools/views/persons.mjs 머리말. 표 전체는 data/views/persons/
   */
  async person(args, values) {
    const q = args.join(' ');
    if (!q) return console.error('인물이 필요합니다: node tools/query.mjs person 라피 | person:라피 [--list]');
    const id = q.startsWith('person:') ? q : one("SELECT id FROM targets WHERE name = ? AND id LIKE 'person:%' ORDER BY id LIMIT 1", q)?.id ?? `person:${q.replace(/\s+/g, '_')}`;
    const { openContext } = await import('./records/context.mjs');
    const { loadDataset } = await import('./records/model.mjs');
    const { loadOrder } = await import('./records/order.mjs');
    const { buildPersons } = await import('./views/persons.mjs');
    const ctx = await openContext(db);
    const v = buildPersons(loadDataset(), ctx, loadOrder());
    ctx.close();
    const p = v.persons.find((x) => x.target === id);
    if (!p) return console.error(`사전에 없는 인물: ${q}`);
    console.log(`${p.target} ${p.name}${p.common ? ` — 따로 두는 인물(${p.common}${p.spread ? `, 중심 단위 ${p.spread}` : ''})` : ''}${p.same_as ? ` · 같은 인물 ${p.same_as}` : ''}`);
    console.log(`등장: 씬 ${p.scenes} · 단위 ${p.units} · 말한 줄 ${p.speaker_lines} · 이름 줄 ${p.named_lines} · 암시 언급이 더한 줄 ${p.implied_lines}(암시로만 나온 씬 ${p.implied_scenes})`);
    console.log(`처음 ${p.first_unit || '-'}(공개 자리 ${p.first_tick || '-'}, ${p.first_scene || '-'}) · 처음 말함 ${p.first_speaks_unit || '-'} · 마지막 ${p.last_unit || '-'}(${p.last_tick || '-'})`);
    const us = v.personUnits.filter((r) => r.person === id);
    if (us.length) console.log(`단위별 등장(씬 수, 출시순): ${us.slice(0, 60).map((r) => `${r.unit} ${r.scenes}`).join(' · ')}${us.length > 60 ? ` … 외 ${us.length - 60}` : ''}`);
    const ps = v.pairs.filter((r) => r.a === id || r.b === id).map((r) => ({ ...r, other: r.a === id ? r.b : r.a, other_name: r.a === id ? r.b_name : r.a_name }));
    const shown = ps.filter((r) => r.other !== 'person:지휘관' && !r.same_as).slice(0, 15);
    console.log(`함께 나온 인물 ${p.partners}: ${shown.map((r) => `${r.other_name} ${r.scenes}씬(대화 ${r.talk_scenes})`).join(' · ') || '-'}`);
    console.log(`기록: 사실 ${p.facts}${p.reversed ? `(뒤집힘 ${p.reversed})` : ''} · 의문 ${p.questions}(열림 ${p.open} · 일부 ${p.partial} · 풀림 ${p.solved}) · 사건 ${p.events} · 떡밥 ${p.echoes} · 생활상 ${p.life}`);
    console.log(`줄기: ${p.threads || '-'}`);
    console.log(`변화: 기준 ${p.baselines} · 변화 ${p.changes}${p.aspects ? `(${p.aspects})` : ''} · 관계 상대로 ${p.with_others} · 뒤바뀜 ${p.inverted} — 작중 순서는 node tools/query.mjs chrono ${id}`);
    console.log(`마무리: ${p.closures || '-'}${p.merges ? ` · 합류 ${p.merges}` : ''}`);
    if (values.list) {
      const rs = v.personRecords.filter((r) => r.person === id);
      const kinds = ['사실', '의문', '사건', '떡밥', '생활상', '기준', '변화', '관계 상대', '마무리'].filter((k) => rs.some((r) => r.kind === k));
      for (const k of kinds) {
        const xs = rs.filter((r) => r.kind === k);
        console.log(`\n${k} ${xs.length}: ${xs.map((r) => `${r.record}${r.state ? `(${r.state})` : ''}@${r.unit}`).join(' ')}`);
      }
    }
  },

  sql(args) {
    const sql = args.join(' ');
    if (!/^\s*(select|with|explain|pragma)\b/i.test(sql)) return console.error('읽기 질의만 허용합니다');
    const rows = all(sql);
    if (!rows.length) return console.log('(결과 없음)');
    console.log(Object.keys(rows[0]).join('\t'));
    for (const r of rows.slice(0, 100)) console.log(Object.values(r).map((v) => oneLine(String(v ?? ''))).join('\t'));
    if (rows.length > 100) console.log(`… ${rows.length - 100}행 더`);
  },
};

const { values, positionals } = parseArgs({
  options: {
    limit: { type: 'string' }, sheet: { type: 'boolean' }, from: { type: 'string' }, to: { type: 'string' },
    all: { type: 'boolean' }, names: { type: 'boolean' }, n: { type: 'string' }, seed: { type: 'string' }, tsv: { type: 'boolean' },
    scenes: { type: 'boolean' }, 'in-unit': { type: 'boolean' }, flags: { type: 'boolean' }, labels: { type: 'boolean' }, how: { type: 'string' }, type: { type: 'string' },
    thread: { type: 'string' }, about: { type: 'string' }, list: { type: 'boolean' }, min: { type: 'string' },
  },
  allowPositionals: true,
});
const [cmd, ...rest] = positionals;
if (!cmd || !commands[cmd]) {
  console.error(`명령: ${Object.keys(commands).join(' | ')}`);
  console.error('예: node tools/query.mjs search 니힐리스타');
  process.exit(1);
}
db = await openDb().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
await commands[cmd](rest, values);
db.close();
