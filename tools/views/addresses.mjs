/**
 * W22 — 실장판(니케 목록 한 행 = 한 판)마다 지휘관 호칭 후보를 센다. 해석이 아니다 — Claude가 근거를 보고 호칭 기록(A — annotations/addresses.json)으로 확정한다.
 *
 *   node tools/views/addresses.mjs                  → data/views/addresses/candidates.csv (커밋한다 — 낱말 · 수 · 첫 근거 ID만, 대사 본문 없음)
 *   node tools/views/addresses.mjs --dump <dir>     + 판마다 근거 줄 파일 <dir>/<rid>.md (대사 본문이 든다 — scratchpad에만, 커밋하지 않는다)
 *   node tools/views/addresses.mjs --rid 10,16      판 몇 개만
 *
 * 출처 셋(그 판의 니케가 말한 줄만 — 지휘관 Self · 서술은 빼고, 만우절 단위(결정 #11)는 세지 않는다):
 *   voice    음성 대사(DB character_voices — roledata) — 판마다 다르다. 근거 = speech_id
 *   episode  그 판의 호감도 스토리(char:<rid>) · 애장품 스토리(stories.resource_id = rid) — 판마다 다르다. 근거 = 씬#줄
 *   story    그 밖의 범위 안 스토리에서 같은 인물(대상)이 말한 줄 — 같은 인물의 판끼리 같다. 근거 = 씬#줄
 * 낱말 = 지휘관을 부를 법한 말(signals.mjs ADDRESS — 경계 규칙은 인물 이름과 같다) + 그 밖에 '…님'으로 끝나는 낱말(남을 부르는 것도 섞인다 — 판정이 가린다).
 * 한 줄에 같은 낱말이 여러 번이어도 1로 센다(줄 수).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openDb } from '../normalize/ensure-db.mjs';
import { COMMANDER, compilePersonNames } from '../normalize/mentions.mjs';
import { loadPlaces } from '../lib/mentions.mjs';
import { isAprilFools } from '../lib/fools.mjs';
import { toCsv } from './draft.mjs';
import { ADDRESS } from './signals.mjs';
import { ROOT } from '../records/model.mjs';

export const ADDRESSES_DIR = path.join(ROOT, 'data/views/addresses');
export const COLUMNS = ['rid', 'name', 'target', 'source', 'word', 'lines', 'first'];
/** 덤프에서 출처 story의 낱말마다 보일 줄 수 */
const STORY_SAMPLE = 6;
/** '…님' 낱말 — 앞이 한글이 아닌 자리에서 시작하는 한글 1–6자 + 님 */
const NIM = /(?<![가-힣])([가-힣]{1,6}님)/g;

/** 한 줄 → 호칭 후보 낱말들(Set) */
export function addressWords(text, matchAddress) {
  const words = new Set(matchAddress(text).hits);
  for (const m of String(text).matchAll(NIM)) if (![...words].some((w) => w.endsWith('님') && m[1].endsWith(w))) words.add(m[1]);
  return words;
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ rids?: number[] }} [opt]
 * @returns {Promise<{ rows: object[], versions: object[] }>} rows = candidates.csv 행, versions = 판마다 { rid, name, target, voice[], episode[], story[] }(덤프용 — 본문 포함)
 */
export async function buildAddresses(db, { rids } = {}) {
  const places = await loadPlaces(db);
  const matchAddress = compilePersonNames(ADDRESS.map((a) => ({ key: a, name: a })));
  let chars = db.prepare('SELECT resource_id rid, name, target_id target FROM characters WHERE target_id IS NOT NULL ORDER BY resource_id').all();
  if (rids?.length) chars = chars.filter((c) => rids.includes(c.rid));
  const voiceStmt = db.prepare('SELECT speech_id id, kind, level, text FROM character_voices WHERE resource_id = ? ORDER BY ord');
  // 판 전용 스토리(호감도 · 애장품)
  const ownStory = new Map(db.prepare('SELECT id, resource_id rid FROM stories WHERE resource_id IS NOT NULL AND in_scope = 1').all().map((s) => [s.id, s.rid]));
  const lineStmt = db.prepare(
    `SELECT l.story_id story, l.seq, l.text FROM lines l JOIN stories s ON s.id = l.story_id
      WHERE s.in_scope = 1 AND l.speaker_target = ? AND l.speaker_target <> ? ORDER BY s.order_index, l.story_id, l.seq`,
  );
  const linesOf = new Map(); // target → 줄(만우절 뺌)
  const rows = [];
  const versions = [];
  for (const c of chars) {
    if (!linesOf.has(c.target)) {
      linesOf.set(c.target, lineStmt.all(c.target, COMMANDER).filter((l) => {
        const unit = places.unitOf(l.story);
        return !(unit && isAprilFools(unit));
      }));
    }
    const v = { rid: c.rid, name: c.name, target: c.target, voice: [], episode: [], story: [] };
    for (const x of voiceStmt.all(c.rid)) v.voice.push({ cite: x.id, kind: x.kind, level: x.level, text: x.text, words: addressWords(x.text, matchAddress) });
    for (const l of linesOf.get(c.target)) {
      const own = ownStory.get(l.story);
      if (own !== undefined && own !== c.rid) continue; // 다른 판의 호감도 · 애장품 — 그 판 몫
      (own === c.rid ? v.episode : v.story).push({ cite: `${l.story}#${l.seq}`, text: l.text, words: addressWords(l.text, matchAddress) });
    }
    for (const source of ['voice', 'episode', 'story']) {
      const tally = new Map(); // word → { lines, first }
      for (const x of v[source]) for (const w of x.words) {
        const t = tally.get(w) ?? tally.set(w, { lines: 0, first: x.cite }).get(w);
        t.lines++;
      }
      for (const [word, t] of [...tally].sort((a, b) => b[1].lines - a[1].lines || a[0].localeCompare(b[0]))) {
        rows.push({ rid: c.rid, name: c.name, target: c.target, source, word, lines: t.lines, first: t.first });
      }
    }
    versions.push(v);
  }
  return { rows, versions };
}

/** 판 하나의 근거 줄 파일(대사 본문 — scratchpad 전용) */
export function dumpVersion(v) {
  const out = [`# ${v.rid} ${v.name} (${v.target})`, ''];
  out.push(`## 음성 대사 ${v.voice.length}줄 — 전부`);
  for (const x of v.voice) out.push(`- ${x.cite} [${x.kind ?? ''}${x.level ? ` · 호감도 ${x.level}` : ''}] ${x.text.replace(/\s+/g, ' ')}`);
  const hitLines = (list) => list.filter((x) => x.words.size);
  out.push('', `## 호감도 · 애장품 스토리 — 이 판 니케의 줄 ${v.episode.length} 가운데 호칭 후보가 든 줄`);
  for (const x of hitLines(v.episode)) out.push(`- ${x.cite} {${[...x.words].join(', ')}} ${x.text.replace(/\s+/g, ' ')}`);
  out.push('', `## 그 밖의 스토리(같은 인물 — 판끼리 같다) — 줄 ${v.story.length}, 낱말마다 앞 ${STORY_SAMPLE}줄`);
  const seen = new Map();
  for (const x of hitLines(v.story)) {
    const ws = [...x.words].filter((w) => (seen.get(w) ?? 0) < STORY_SAMPLE);
    if (!ws.length) continue;
    for (const w of ws) seen.set(w, (seen.get(w) ?? 0) + 1);
    out.push(`- ${x.cite} {${[...x.words].join(', ')}} ${x.text.replace(/\s+/g, ' ')}`);
  }
  const total = new Map();
  for (const x of v.story) for (const w of x.words) total.set(w, (total.get(w) ?? 0) + 1);
  out.push('', `낱말별 줄 수(그 밖의 스토리): ${[...total].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join(' · ') || '없음'}`);
  return out.join('\n') + '\n';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({ options: { dump: { type: 'string' }, rid: { type: 'string' } } });
  const rids = values.rid ? values.rid.split(',').map(Number) : undefined;
  const db = await openDb();
  const { rows, versions } = await buildAddresses(db, { rids });
  if (!rids) {
    fs.mkdirSync(ADDRESSES_DIR, { recursive: true });
    fs.writeFileSync(path.join(ADDRESSES_DIR, 'candidates.csv'), toCsv(rows, COLUMNS));
    console.log(`data/views/addresses/candidates.csv ${rows.length}행 (판 ${versions.length})`);
  }
  if (values.dump) {
    fs.mkdirSync(values.dump, { recursive: true });
    for (const v of versions) fs.writeFileSync(path.join(values.dump, `${v.rid}.md`), dumpVersion(v));
    console.log(`근거 줄 ${versions.length}판 → ${values.dump} (대사 본문 — 커밋하지 않는다)`);
  }
  db.close();
}
