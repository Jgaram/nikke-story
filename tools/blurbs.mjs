/**
 * 팬용 문장 도구(W14) — 분류 이유 · 연대기 추정 이유를 화면용 한두 문장으로. 형식 · 쓰는 기준은 docs/annotations.md "팬용 문장".
 *
 *   node tools/blurbs.mjs new <단위 …> [--part why|when] [--refresh]   입력 묶음을 찍고, 칸이 없으면 틀(후보)을 만든다.
 *                                                                       --refresh = 판정이 바뀐(낡은) 칸의 지문을 지금 것으로 바꾸고 후보로 되돌린다
 *   node tools/blurbs.mjs check [단위 …] [--all]                       검사 — 오류면 종료 코드 1. --all이면 빠진 칸 수도
 *   node tools/blurbs.mjs set <단위 …> <why|when> <확정|기각|후보> [--by claude|사용자] [--note …] [--session W14b]
 *   node tools/blurbs.mjs progress                                      칸 · 등급(종류)별 진행률
 *
 * 해석이 필요한 기록이라 후보 → Claude가 단위마다 검토해 확정한다(CLAUDE.md "해석이 필요한 기록"). 사용자가 마지막으로 결정한 칸은
 * --by claude로 바꾸지 않는다. 확정 뒤 문장을 고치면 지문이 달라져 오류 — 다시 set 한다. 원문은 해시로만 잰다(겹침 검사).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openDb } from './normalize/ensure-db.mjs';
import { openContext } from './records/context.mjs';
import { formatJson } from './records/json.mjs';
import { ROOT, today } from './records/model.mjs';
import { READ1_PREFIXES, loadOrder } from './records/order.mjs';
import { scenePlaces } from './records/read2.mjs';
import { sourceWindows } from './check-quotes.mjs';
import { nameFirsts, overlapProblems, spoilerProblems } from './synopsis/model.mjs';
import { buildInput, loadContext } from './blurbs/input.mjs';
import { BLURB_DIR, DECIDERS, PARTS, STATUSES, blurbPath, checkBlurb, contentHash, loadBlurbs, shownTexts, srcHash, stateOf } from './blurbs/model.mjs';

const USAGE = `팬용 문장 도구 (tools/blurbs.mjs) — 형식 · 기준: docs/annotations.md "팬용 문장"
  new <단위 …> [--part why|when] [--refresh]   입력 묶음 + 틀(후보)
  check [단위 …] [--all]                        검사 (오류 → 종료 코드 1)
  set <단위 …> <why|when> <확정|기각|후보> [--by claude|사용자] [--note 메모] [--session W14b]
  progress                                      진행률
공통: --dir <디렉터리>(테스트) · --data <사이트 데이터 디렉터리>(테스트)`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string' },
    data: { type: 'string' },
    part: { type: 'string' },
    refresh: { type: 'boolean' },
    all: { type: 'boolean' },
    by: { type: 'string' },
    note: { type: 'string' },
    session: { type: 'string' },
    date: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});
const DIR = opt.dir ? path.resolve(opt.dir) : BLURB_DIR;
const [cmd, ...args] = positionals;
const rel = (p) => path.relative(ROOT, p);
const PART_KEYS = Object.keys(PARTS);

let C = null;
const ctx = () => (C ??= loadContext(opt.data ? path.resolve(opt.data) : undefined));
/** 겹침 · 스포일러에 쓰는 DB · 읽는 자리 — 무거워서 처음 쓸 때 한 번 */
let heavy = null;
async function env() {
  if (heavy) return heavy;
  const db = await openDb();
  const places = scenePlaces(loadOrder(READ1_PREFIXES), await openContext(db));
  heavy = { db, places, firsts: nameFirsts(db, places), windows: sourceWindows(db) };
  return heavy;
}
const write = (p, b) => {
  const out = { unit: b.unit };
  for (const k of PART_KEYS) if (b[k]) out[k] = b[k];
  for (const k of Object.keys(b)) if (!(k in out)) out[k] = b[k];
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, formatJson(out));
};
const partsOf = (key) => PART_KEYS.filter((p) => ctx()[p].has(key));
const curSrc = (part, key) => srcHash(part, ctx()[part].get(key));

function cmdNew() {
  if (!args.length) throw new Error('단위 키를 준다 — 예: node tools/blurbs.mjs new sub:세르반_03');
  if (opt.part && !PART_KEYS.includes(opt.part)) throw new Error(`--part는 ${PART_KEYS.join(' · ')}`);
  for (const [i, key] of args.entries()) {
    const parts = opt.part ? [opt.part] : partsOf(key);
    if (!parts.length) throw new Error(`${key}: 분류 단위도 아니고 연대기 추정 이유도 없다`);
    const p = blurbPath(key, DIR);
    const b = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { unit: key };
    const notes = [];
    for (const part of parts) {
      if (i || part !== parts[0]) console.log('\n' + '─'.repeat(40) + '\n');
      console.log(buildInput(key, part, ctx()));
      const cur = curSrc(part, key);
      if (!cur) continue;
      if (!b[part]) {
        b[part] = { text: '', src: cur, session: opt.session ?? 'W14', by: 'claude', date: opt.date ?? today(), status: '후보', reviews: [] };
        notes.push(`${part} 틀`);
      } else if (b[part].src !== cur) {
        if (opt.refresh) {
          b[part].src = cur;
          b[part].status = '후보';
          notes.push(`${part} 지문 새로 — 후보로`);
        } else notes.push(`${part}는 판정이 바뀌었다(낡음) — 고친 뒤 --refresh`);
      } else notes.push(`${part}: ${stateOf(b[part], cur).status}`);
    }
    write(p, b);
    console.log(`\n→ ${rel(p)} — ${notes.join(' · ')}`);
  }
}

async function cmdCheck() {
  const set = loadBlurbs(DIR);
  const pick = args.length ? new Set(args) : null;
  const e = await env();
  let errors = 0;
  let warnings = 0;
  for (const p of set.problems) { errors++; console.log(`✗ ${p.file}: ${p.msg}`); }
  for (const item of set.list) {
    const b = item.data;
    if (pick && !pick.has(b?.unit)) continue;
    const where = b?.unit ?? item.file;
    const res = [checkBlurb(b, ctx())];
    if (item.file !== path.basename(blurbPath(b?.unit ?? '', DIR))) res.push({ errors: [`파일 이름이 단위와 다르다 — ${path.basename(blurbPath(b?.unit ?? '', DIR))}`], warnings: [] });
    const texts = shownTexts(b);
    res.push(overlapProblems(b, e.windows, texts), spoilerProblems(b, e.places.unitPos.get(b?.unit), e.firsts, texts));
    for (const r of res) {
      errors += r.errors.length;
      warnings += r.warnings.length;
      for (const m of r.errors) console.log(`✗ ${where}: ${m}`);
      for (const m of r.warnings) console.log(`⚠ ${where}: ${m}`);
    }
  }
  const t = tally(set);
  if (opt.all) for (const part of PART_KEYS) if (t[part].none) { warnings++; console.log(`⚠ ${PARTS[part]}: 안 쓴 단위 ${t[part].none}`); }
  console.log(`\n${PART_KEYS.map((p) => `${PARTS[p]} ${t[p].ok}/${t[p].n} 확정${t[p].draft ? ` · 후보 ${t[p].draft}` : ''}${t[p].stale ? ` · 낡음 ${t[p].stale}` : ''}${t[p].changed ? ` · 확정 뒤 고침 ${t[p].changed}` : ''}`).join(' / ')} — 오류 ${errors} · 경고 ${warnings}`);
  if (errors) process.exitCode = 1;
}

/** 칸마다 { n(화면에 뜨는 단위), ok, draft, stale, changed, rejected, none } — group(key)로 더 나눈 것은 by */
function tally(set, group = null) {
  const out = {};
  for (const part of PART_KEYS) {
    const t = { n: 0, ok: 0, draft: 0, stale: 0, changed: 0, rejected: 0, none: 0, by: new Map() };
    for (const key of ctx()[part].keys()) {
      const g = group ? group(part, key) : null;
      const m = g ? t.by.get(g) ?? t.by.set(g, { n: 0, ok: 0 }).get(g) : null;
      t.n++;
      if (m) m.n++;
      const e = set.byUnit.get(key)?.data?.[part];
      if (!e) { t.none++; continue; }
      const st = stateOf(e, curSrc(part, key));
      if (st.ok) { t.ok++; if (m) m.ok++; } else if (st.status === '기각') t.rejected++;
      else if (st.changed) t.changed++;
      else if (st.stale) t.stale++;
      else t.draft++;
    }
    out[part] = t;
  }
  return out;
}

async function cmdSet() {
  const decision = args.at(-1);
  const part = args.at(-2);
  const keys = args.slice(0, -2);
  if (!STATUSES.includes(decision) || !PART_KEYS.includes(part) || !keys.length) throw new Error('예: node tools/blurbs.mjs set sub:세르반_03 why 확정 --note "…"');
  const by = opt.by ?? 'claude';
  if (!DECIDERS.includes(by)) throw new Error(`--by는 ${DECIDERS.join(' · ')}`);
  const set = loadBlurbs(DIR);
  const e = decision === '확정' ? await env() : null;
  let failed = 0;
  for (const key of keys) {
    const item = set.byUnit.get(key);
    const entry = item?.data?.[part];
    if (!entry) { console.log(`✗ ${key}: ${part} 칸이 없다 — new ${key} --part ${part}`); failed++; continue; }
    const st = stateOf(entry, curSrc(part, key));
    if (by === 'claude' && st.lastBy === '사용자') { console.log(`✗ ${key}: 사용자가 마지막으로 결정했다(${st.last.decision} ${st.last.date}) — Claude는 바꾸지 않는다`); failed++; continue; }
    if (decision === '확정') {
      // 확정 전에 검사 — 오류가 있으면 확정하지 않는다(경고는 보이고 통과). 낡은 칸은 --refresh부터
      if (st.stale) { console.log(`✗ ${key}: ${part}는 판정이 바뀌었다 — 고친 뒤 new ${key} --part ${part} --refresh`); failed++; continue; }
      const one = { unit: key, [part]: { ...entry, status: '확정', reviews: [{ decision: '확정', by, hash: contentHash(entry) }] } };
      const texts = shownTexts(one);
      const rs = [checkBlurb(one, ctx()), overlapProblems(one, e.windows, texts), spoilerProblems(one, e.places.unitPos.get(key), e.firsts, texts)];
      for (const m of rs.flatMap((r) => r.warnings)) console.log(`⚠ ${key}: ${m}`);
      const errs = rs.flatMap((r) => r.errors);
      if (errs.length) { for (const m of errs) console.log(`✗ ${key}: ${m}`); failed++; continue; }
    }
    const review = { decision, by, date: opt.date ?? today(), session: opt.session ?? entry.session ?? 'W14' };
    if (decision === '확정') review.hash = contentHash(entry);
    if (opt.note) review.note = opt.note;
    entry.status = decision;
    entry.reviews = [...(Array.isArray(entry.reviews) ? entry.reviews : []), review];
    write(item.path, item.data);
    console.log(`✓ ${key} ${part}: ${decision} (${by}${review.hash ? ` · 지문 ${review.hash}` : ''})`);
  }
  if (failed) process.exitCode = 1;
}

function cmdProgress() {
  const set = loadBlurbs(DIR);
  const GL = { 필수: '준필수', 보강: '추천', 참고: '참고', 독립: '독립' };
  const group = (part, key) => (part === 'why' ? GL[ctx().why.get(key).grade] ?? '?' : ctx().units.get(key)?.kind ?? '?');
  const t = tally(set, group);
  for (const part of PART_KEYS) {
    const x = t[part];
    console.log(`${PARTS[part]} ${x.ok}/${x.n} 확정 · 후보 ${x.draft} · 낡음 ${x.stale} · 확정 뒤 고침 ${x.changed} · 기각 ${x.rejected} · 없음 ${x.none}`);
    console.log(`  ${[...x.by].map(([g, m]) => `${g} ${m.ok}/${m.n}`).join(' · ')}`);
  }
}

try {
  if (opt.help || !cmd) console.log(USAGE);
  else if (cmd === 'new') cmdNew();
  else if (cmd === 'check') await cmdCheck();
  else if (cmd === 'set') await cmdSet();
  else if (cmd === 'progress') cmdProgress();
  else throw new Error(`모르는 명령: ${cmd}\n${USAGE}`);
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
}
