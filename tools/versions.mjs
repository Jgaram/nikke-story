/**
 * 시점별 판 도구(W15c) — 떡밥 제목 · 요약(W15c · W15d), 사전 설명(W15e)을 읽은 자리마다 따로. 형식 · 쓰는 기준은 docs/annotations.md "시점별 판".
 *
 *   node tools/versions.mjs new <J… | thread:J… | place:방주 …> [--at <단위>] [--refresh] [--full]
 *                                                                           입력 묶음을 찍고, 파일이 없으면 첫 판 틀(후보)을 만든다.
 *                                                                           --at = 그 자리에 판 틀을 더한다 · --refresh = 낡은 판의 지문을 지금 것으로(후보로) ·
 *                                                                           --full = 사전 항목의 다룬 기록을 전부 문장째(기본은 앞 60건)
 *   node tools/versions.mjs check [대상 …] [--all]                          검사 — 오류면 종료 코드 1. --all이면 판이 없는 떡밥 · 사전 항목 수도
 *   node tools/versions.mjs set <대상> <at …> <확정|기각|후보> [--note …] [--session W15c]
 *   node tools/versions.mjs progress                                        중요도별 진행률
 *
 * 해석이 필요한 기록이라 후보 → Claude가 판마다 검토해 확정한다(CLAUDE.md "해석이 필요한 기록"). 확정 뒤 판을 고치면 지문이 달라져 오류 — 다시 set 한다.
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
import { buildInput, loadContext } from './versions/input.mjs';
import { DECIDERS, DICT_KINDS, STATUSES, VERSION_DIR, checkFile, contentHash, dictFirst, isDict, loadVersions, shownTexts, srcHash, stateOf, subjectKind, versionPath } from './versions/model.mjs';

const USAGE = `시점별 판 도구 (tools/versions.mjs) — 형식 · 기준: docs/annotations.md "시점별 판"
  new <J… | thread:J… | place:방주 …> [--at 단위] [--refresh] [--full]   입력 묶음 + 틀(후보)
  check [대상 …] [--all]                        검사 (오류 → 종료 코드 1)
  set <대상> <at …> <확정|기각|후보> [--note 메모] [--session W15c]
  progress                                      진행률
공통: --dir <디렉터리>(테스트) · --data <사이트 데이터 디렉터리>(테스트)`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string' },
    data: { type: 'string' },
    at: { type: 'string' },
    refresh: { type: 'boolean' },
    full: { type: 'boolean' },
    all: { type: 'boolean' },
    by: { type: 'string' },
    note: { type: 'string' },
    session: { type: 'string' },
    date: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});
const DIR = opt.dir ? path.resolve(opt.dir) : VERSION_DIR;
const [cmd, ...args] = positionals;
const rel = (p) => path.relative(ROOT, p);
const subjectOf = (s) => (/^J\d+$/.test(s) ? `thread:${s}` : s);

let C = null;
const ctx = () => (C ??= loadContext(opt.data ? path.resolve(opt.data) : undefined));
/** 원문 겹침 · DB 이름 경고에 쓰는 DB · 읽는 자리 — 무거워서 처음 쓸 때 한 번 */
let heavy = null;
async function env() {
  if (heavy) return heavy;
  const db = await openDb();
  const places = scenePlaces(loadOrder(READ1_PREFIXES), await openContext(db));
  heavy = { db, places, firsts: nameFirsts(db, places), windows: sourceWindows(db) };
  return heavy;
}
const write = (p, f) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, formatJson({ subject: f.subject, versions: f.versions }));
};
/** 원문 겹침(오류) · DB에서 처음 나온 이름(경고) — 판마다 그 at 자리로 */
function heavyProblems(f, e) {
  const out = [overlapProblems(f, e.windows, shownTexts(f).map(([w, t]) => [w, t]))];
  for (const [w, t, at] of shownTexts(f)) out.push(spoilerProblems(f, e.places.unitPos.get(at), e.firsts, [[w, t]]));
  return out;
}
const blank = (subject, at) => ({ at, ...(isDict(subject) ? {} : { title: '' }), text: '', src: srcHash(subject, at, ctx()), session: opt.session ?? 'W15c', by: 'claude', date: opt.date ?? today(), status: '후보', reviews: [] });
const orderOf = (k) => ctx().units.get(k)?.order ?? 1e9;

function cmdNew() {
  if (!args.length) throw new Error('대상을 준다 — 예: node tools/versions.mjs new J30');
  for (const [i, raw] of args.entries()) {
    const subject = subjectOf(raw);
    const first = isDict(subject) ? dictFirst(ctx().targetMap.get(subject)) : ctx().threads.get(subject.replace(/^thread:/, ''))?.first_unit;
    if (isDict(subject) ? !ctx().targetMap.has(subject) : !ctx().threads.has(subject.replace(/^thread:/, ''))) throw new Error(`${isDict(subject) ? '사전 항목' : '떡밥'}이 없다 — ${raw}`);
    if (!first) throw new Error(`처음 나온 자리가 없다 — ${raw} (판을 둘 수 없다)`);
    const p = versionPath(subject, DIR);
    const f = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { subject, versions: [] };
    const notes = [];
    if (!f.versions.length) { f.versions.push(blank(subject, first)); notes.push(`첫 판 틀(${first})`); }
    if (opt.at) {
      if (!ctx().units.has(opt.at)) throw new Error(`단위가 아니다 — ${opt.at}`);
      if (f.versions.some((v) => v.at === opt.at)) notes.push(`${opt.at} 판은 이미 있다`);
      else { f.versions.push(blank(subject, opt.at)); f.versions.sort((a, b) => orderOf(a.at) - orderOf(b.at)); notes.push(`판 틀(${opt.at})`); }
    }
    for (const v of f.versions) {
      const cur = srcHash(subject, v.at, ctx());
      if (!cur || v.src === cur) continue;
      if (opt.refresh) { v.src = cur; v.status = '후보'; notes.push(`${v.at} 지문 새로 — 후보로`); } else notes.push(`${v.at}은 흐름이 바뀌었다(낡음) — 고친 뒤 --refresh`);
    }
    if (i) console.log('\n' + '─'.repeat(40) + '\n');
    console.log(buildInput(subject, f, ctx(), { full: opt.full }));
    write(p, f);
    console.log(`\n→ ${rel(p)}${notes.length ? ` — ${notes.join(' · ')}` : ''}`);
  }
}

async function cmdCheck() {
  const set = loadVersions(DIR);
  const pick = args.length ? new Set(args.map(subjectOf)) : null;
  const e = await env();
  let errors = 0;
  let warnings = 0;
  for (const p of set.problems) { errors++; console.log(`✗ ${p.file}: ${p.msg}`); }
  for (const item of set.list) {
    const f = item.data;
    if (pick && !pick.has(f?.subject)) continue;
    const where = f?.subject ?? item.file;
    for (const r of [checkFile(f, ctx()), ...heavyProblems(f, e)]) {
      errors += r.errors.length;
      warnings += r.warnings.length;
      for (const m of r.errors) console.log(`✗ ${where}: ${m}`);
      for (const m of r.warnings) console.log(`⚠ ${where}: ${m}`);
    }
  }
  const t = tally(set);
  const d = tallyDict(set);
  if (opt.all && t.none) { warnings++; console.log(`⚠ 판이 없는 떡밥 ${t.none}`); }
  if (opt.all && d.none) { warnings++; console.log(`⚠ 판이 없는 사전 항목 ${d.none}`); }
  const line = (x) => `판 ${x.ok} 확정${x.draft ? ` · 후보 ${x.draft}` : ''}${x.stale ? ` · 낡음 ${x.stale}` : ''}${x.changed ? ` · 확정 뒤 고침 ${x.changed}` : ''}`;
  console.log(`\n떡밥 ${t.files}/${t.n} · ${line(t)} | 사전 ${d.files}/${d.n} · ${line(d)} — 오류 ${errors} · 경고 ${warnings}`);
  if (errors) process.exitCode = 1;
}

/** { n(떡밥), files(판이 있는 떡밥), done(판이 전부 확정인 떡밥), ok · draft · stale · changed · rejected(판), none, by(중요도 → {n, done}) } */
function tally(set) {
  const t = { n: 0, files: 0, done: 0, ok: 0, draft: 0, stale: 0, changed: 0, rejected: 0, none: 0, by: new Map() };
  for (const th of ctx().threads.values()) {
    const g = t.by.get(th.weight) ?? t.by.set(th.weight, { n: 0, done: 0 }).get(th.weight);
    t.n++;
    g.n++;
    const f = set.bySubject.get(`thread:${th.id}`)?.data;
    if (!f?.versions?.length) { t.none++; continue; }
    t.files++;
    if (countFile(f, t)) { t.done++; g.done++; }
  }
  return t;
}

/** 판 셈 하나 — 파일의 판들을 t에 더하고, 전부 확정이면 true */
function countFile(f, t) {
  let all = true;
  for (const v of f.versions) {
    const st = stateOf(v, srcHash(f.subject, v.at, ctx()));
    if (st.ok) t.ok++;
    else if (st.status === '기각') t.rejected++;
    else { all = false; if (st.changed) t.changed++; else if (st.stale) t.stale++; else t.draft++; }
  }
  return all;
}

/** 사전 설명(W15e) — 분석용 설명이 있고 처음 나온 자리가 있는 비인물 항목. by = 종류 → {n, done} */
function tallyDict(set) {
  const t = { n: 0, files: 0, done: 0, ok: 0, draft: 0, stale: 0, changed: 0, rejected: 0, none: 0, by: new Map() };
  for (const x of ctx().targets) {
    if (!DICT_KINDS.has(subjectKind(x.id)) || !x.note || !dictFirst(x)) continue;
    const g = t.by.get(x.type) ?? t.by.set(x.type, { n: 0, done: 0 }).get(x.type);
    t.n++;
    g.n++;
    const f = set.bySubject.get(x.id)?.data;
    if (!f?.versions?.length) { t.none++; continue; }
    t.files++;
    if (countFile(f, t)) { t.done++; g.done++; }
  }
  return t;
}

async function cmdSet() {
  const decision = args.at(-1);
  const subject = subjectOf(args[0] ?? '');
  const ats = args.slice(1, -1);
  if (!STATUSES.includes(decision) || !ats.length) throw new Error('예: node tools/versions.mjs set J30 char:222 확정 --note "…"');
  const by = opt.by ?? 'claude';
  if (!DECIDERS.includes(by)) throw new Error(`--by는 ${DECIDERS.join(' · ')}`);
  const item = loadVersions(DIR).bySubject.get(subject);
  if (!item) throw new Error(`판 파일이 없다 — new ${subject}`);
  const f = item.data;
  const e = decision === '확정' ? await env() : null;
  let failed = 0;
  for (const at of ats) {
    const v = f.versions.find((x) => x.at === at);
    if (!v) { console.log(`✗ ${subject}: ${at} 판이 없다`); failed++; continue; }
    const cur = srcHash(subject, at, ctx());
    if (decision === '확정') {
      // 확정 전에 검사 — 이 판의 오류가 있으면 확정하지 않는다(경고는 보이고 통과). 낡은 판은 --refresh부터
      if (stateOf(v, cur).stale) { console.log(`✗ ${subject} ${at}: 흐름이 바뀌었다 — 고친 뒤 new ${subject} --refresh`); failed++; continue; }
      const one = { ...f, versions: f.versions.map((x) => (x === v ? { ...v, status: '확정', reviews: [{ decision: '확정', by, hash: contentHash(v) }] } : x)) };
      const mine = (m) => m.startsWith(`판 ${at}:`) || !m.startsWith('판 ');
      const rs = [checkFile(one, ctx()), ...heavyProblems({ ...one, versions: [v] }, e)];
      for (const m of rs.flatMap((r) => r.warnings).filter(mine)) console.log(`⚠ ${subject}: ${m}`);
      const errs = rs.flatMap((r) => r.errors).filter(mine);
      if (errs.length) { for (const m of errs) console.log(`✗ ${subject}: ${m}`); failed++; continue; }
    }
    const review = { decision, by, date: opt.date ?? today(), session: opt.session ?? v.session ?? 'W15c' };
    if (decision === '확정') review.hash = contentHash(v);
    if (opt.note) review.note = opt.note;
    v.status = decision;
    v.reviews = [...(Array.isArray(v.reviews) ? v.reviews : []), review];
    console.log(`✓ ${subject} ${at}: ${decision} (${by}${review.hash ? ` · 지문 ${review.hash}` : ''})`);
  }
  write(item.path, f);
  if (failed) process.exitCode = 1;
}

function cmdProgress() {
  const t = tally(loadVersions(DIR));
  console.log(`떡밥 ${t.done}/${t.n} 판 전부 확정 · 판 있음 ${t.files} · 판 확정 ${t.ok} · 후보 ${t.draft} · 낡음 ${t.stale} · 확정 뒤 고침 ${t.changed} · 기각 ${t.rejected}`);
  console.log(`  ${[...t.by].map(([g, m]) => `${g} ${m.done}/${m.n}`).join(' · ')}`);
  const d = tallyDict(loadVersions(DIR));
  console.log(`사전 ${d.done}/${d.n} 판 전부 확정 · 판 있음 ${d.files} · 판 확정 ${d.ok} · 후보 ${d.draft} · 낡음 ${d.stale} · 확정 뒤 고침 ${d.changed} · 기각 ${d.rejected}`);
  console.log(`  ${[...d.by].map(([g, m]) => `${g} ${m.done}/${m.n}`).join(' · ')}`);
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
