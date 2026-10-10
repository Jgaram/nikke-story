/**
 * 공개 개요 도구(W8) — 사이트에 싣는 스토리별 한 줄 소개 · 줄거리 · 씬 한 줄. 형식 · 규칙은 docs/annotations.md "공개 개요".
 *
 *   node tools/synopsis.mjs new ch00                 입력 묶음(1회독 요약 · 씬 한 줄 · 사실 · 의문 · 사건 · 바로잡기 · 기각)을 찍고,
 *                                                    개요 파일이 없으면 틀(annotations/synopsis/ch00.json, 후보)을 만든다
 *   node tools/synopsis.mjs check [단위 …] [--all]   검사 — 오류가 있으면 종료 코드 1. --all이면 빠진 단위 · 확정 안 된 단위도 경고
 *   node tools/synopsis.mjs set ch00 확정 [--by claude|사용자] [--note …] [--session W9a]   검토 기록(지문 포함)
 *   node tools/synopsis.mjs progress [W9a]           종류별 · 묶음별 진행률, 묶음을 주면 그 단위 목록과 상태
 *   node tools/synopsis.mjs batch [--max 80000] [--write]   W9 묶음 — 갈래(메인 · 이벤트 · 작은 단위 · 호감도)마다 출시순으로 입력 분량 max씩
 *
 * 해석이 필요한 기록이라 후보 → Claude가 단위마다 검토해 확정한다(CLAUDE.md "해석이 필요한 기록"). 사용자가 마지막으로 결정한 단위는
 * --by claude로 바꾸지 않는다. 확정한 뒤 문장을 고치면 지문이 달라져 검사가 오류를 내고 내보내기가 뺀다 — 다시 set 한다.
 * 원문은 저작물이다 — 입력 묶음은 기록만 보이고, 원문 겹침은 해시로만 잰다(CLAUDE.md "저작물 취급").
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openDb } from './normalize/ensure-db.mjs';
import { parseCsv } from './normalize/csv.mjs';
import { openContext } from './records/context.mjs';
import { formatJson } from './records/json.mjs';
import { ROOT, loadDataset, today } from './records/model.mjs';
import { READ1_PREFIXES, loadOrder } from './records/order.mjs';
import { scenePlaces } from './records/read2.mjs';
import { sourceWindows } from './check-quotes.mjs';
import { buildInput } from './synopsis/input.mjs';
import {
  BATCHES_FILE, DECIDERS, GROUPS, KIND_LABEL, SYNOPSIS_DIR, checkSynopsis, contentHash, loadSynopses, nameFirsts, overlapProblems, planBatches,
  spoilerProblems, stateOf, synopsisPath, unitKind,
} from './synopsis/model.mjs';

const USAGE = `공개 개요 도구 (tools/synopsis.mjs) — 형식 · 규칙: docs/annotations.md "공개 개요"
  new <단위>                       입력 묶음을 찍고, 개요 파일이 없으면 틀을 만든다(후보)
  check [단위 …] [--all]           검사 (오류 → 종료 코드 1) · --all은 빠진 단위 · 확정 안 된 단위도
  set <단위 …> <확정|기각|후보> [--by claude|사용자] [--note 메모] [--session W9a]
  progress [W9a]                   진행률 · 묶음의 단위 목록
  batch [--max 80000] [--write]    W9 묶음 계산 (--write면 annotations/synopsis/${BATCHES_FILE}에 쓴다)
공통: --dir <개요 디렉터리>(테스트)`;

const { values: opt, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dir: { type: 'string' },
    all: { type: 'boolean' },
    by: { type: 'string' },
    note: { type: 'string' },
    session: { type: 'string' },
    date: { type: 'string' },
    max: { type: 'string' },
    write: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});
const DIR = opt.dir ? path.resolve(opt.dir) : SYNOPSIS_DIR;
const [cmd, ...args] = positionals;
const rel = (p) => path.relative(ROOT, p);

/** 읽는 순서 · 공개일 · DB — 무거운 것은 처음 쓸 때 한 번 */
let envCache = null;
async function env() {
  if (envCache) return envCache;
  const db = await openDb();
  const ctx = await openContext(db);
  const order = loadOrder(READ1_PREFIXES);
  const places = scenePlaces(order, ctx);
  const keys = [...places.unitPos.keys()];
  const timeline = path.join(ROOT, 'data/views/timeline/units.csv');
  const units = new Map(fs.existsSync(timeline) ? parseCsv(fs.readFileSync(timeline, 'utf8')).map((r) => [r.unit, r]) : []);
  envCache = { db, ctx, order, places, keys, units, ds: null };
  return envCache;
}
const dataset = (e) => (e.ds ??= loadDataset());
const readBatches = () => {
  const p = path.join(DIR, BATCHES_FILE);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};
const batchOf = (batches, key) => batches?.batches?.find((b) => b.units.includes(key))?.id ?? null;

async function cmdNew() {
  const key = args[0];
  if (!key) throw new Error('단위 키를 준다 — 예: node tools/synopsis.mjs new ch00');
  const e = await env();
  if (!e.places.unitPos.has(key)) throw new Error(`읽는 순서에 없는 단위: ${key}`);
  const text = buildInput(key, { ds: dataset(e), ctx: e.ctx, places: e.places, units: e.units });
  console.log(text);
  const p = synopsisPath(key, DIR);
  if (fs.existsSync(p)) {
    console.log(`\n(개요 파일이 이미 있다 — ${rel(p)})`);
    return;
  }
  const scenes = e.ctx.resolve(key)?.scenes ?? [];
  const skeleton = {
    unit: key,
    session: opt.session ?? batchOf(readBatches(), key) ?? 'W8',
    by: 'claude',
    date: opt.date ?? today(),
    logline: '',
    synopsis: '',
    scenes: scenes.length > 1 || unitKind(key) === 'episode' ? scenes.map((scene) => ({ scene, text: '' })) : [],
    status: '후보',
    reviews: [],
  };
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(p, formatJson(skeleton));
  console.log(`\n→ 틀을 만들었다: ${rel(p)} (씬 한 줄 칸 ${skeleton.scenes.length} — 필요 없으면 지운다)`);
}

async function cmdCheck() {
  const e = await env();
  const set = loadSynopses(DIR);
  const pickUnits = args.length ? new Set(args) : null;
  const firsts = nameFirsts(e.db, e.places);
  const windows = sourceWindows(e.db);
  let errors = 0;
  let warnings = 0;
  const say = (where, list, mark) => {
    for (const m of list) console.log(`${mark} ${where}: ${m}`);
  };
  for (const p of set.problems) {
    errors++;
    console.log(`✗ ${p.file}: ${p.msg}`);
  }
  for (const item of set.list) {
    const s = item.data;
    if (pickUnits && !pickUnits.has(s?.unit)) continue;
    const where = s?.unit ?? item.file;
    const known = e.places.unitPos.has(s?.unit);
    const res = [checkSynopsis(s, { scenes: known ? e.ctx.resolve(s.unit)?.scenes ?? null : null })];
    if (!known) res.push({ errors: [`읽는 순서에 없는 단위 — ${s?.unit}`], warnings: [] });
    if (item.file !== path.basename(synopsisPath(s?.unit ?? '', DIR))) res.push({ errors: [`파일 이름이 단위와 다르다 — ${path.basename(synopsisPath(s?.unit ?? '', DIR))}`], warnings: [] });
    res.push(overlapProblems(s, windows));
    res.push(spoilerProblems(s, e.places.unitPos.get(s?.unit), firsts));
    for (const r of res) {
      errors += r.errors.length;
      warnings += r.warnings.length;
      say(where, r.errors, '✗');
      say(where, r.warnings, '⚠');
    }
  }
  const counts = tally(e, set);
  if (opt.all) {
    for (const key of e.keys) {
      const s = set.byUnit.get(key)?.data;
      if (!s) { warnings++; console.log(`⚠ ${key}: 개요가 없다`); } else if (s.status !== '확정') { warnings++; console.log(`⚠ ${key}: ${s.status}`); }
    }
  }
  console.log(`\n개요 ${counts.files}/${e.keys.length} · 확정 ${counts.ok}${counts.changed ? ` · 확정 뒤 고침 ${counts.changed}` : ''} · 후보 ${counts.draft} · 기각 ${counts.rejected} — 오류 ${errors} · 경고 ${warnings}`);
  if (errors) process.exitCode = 1;
}

function tally(e, set) {
  const c = { files: 0, ok: 0, changed: 0, draft: 0, rejected: 0 };
  for (const item of set.list) {
    if (!e.places.unitPos.has(item.data?.unit)) continue;
    c.files++;
    const st = stateOf(item.data);
    if (st.ok) c.ok++;
    else if (st.changed) c.changed++;
    else if (st.status === '기각') c.rejected++;
    else c.draft++;
  }
  return c;
}

async function cmdSet() {
  const decision = args.at(-1);
  const keys = args.slice(0, -1);
  if (!['확정', '기각', '후보'].includes(decision) || !keys.length) throw new Error('예: node tools/synopsis.mjs set ch00 확정 --note "…"');
  const by = opt.by ?? 'claude';
  if (!DECIDERS.includes(by)) throw new Error(`--by는 ${DECIDERS.join(' · ')}`);
  const e = await env();
  const set = loadSynopses(DIR);
  const firsts = decision === '확정' ? nameFirsts(e.db, e.places) : null;
  const windows = decision === '확정' ? sourceWindows(e.db) : null;
  let failed = 0;
  for (const key of keys) {
    const item = set.byUnit.get(key);
    if (!item) { console.log(`✗ ${key}: 개요 파일이 없다 — new ${key}`); failed++; continue; }
    const s = item.data;
    const st = stateOf(s);
    if (by === 'claude' && st.lastBy === '사용자') { console.log(`✗ ${key}: 사용자가 마지막으로 결정했다(${st.last.decision} ${st.last.date}) — Claude는 바꾸지 않는다`); failed++; continue; }
    if (decision === '확정') {
      // 확정 전에 검사 — 오류가 있으면 확정하지 않는다(경고는 보이고 통과)
      const rs = [checkSynopsis({ ...s, status: '확정', reviews: [] }, { scenes: e.ctx.resolve(key)?.scenes ?? null }), overlapProblems(s, windows), spoilerProblems(s, e.places.unitPos.get(key), firsts)];
      const errs = rs.flatMap((r) => r.errors).filter((m) => !m.startsWith('확정한 뒤'));
      for (const m of rs.flatMap((r) => r.warnings)) console.log(`⚠ ${key}: ${m}`);
      if (errs.length) { for (const m of errs) console.log(`✗ ${key}: ${m}`); failed++; continue; }
    }
    const review = { decision, by, date: opt.date ?? today(), session: opt.session ?? s.session ?? 'W8' };
    if (decision === '확정') review.hash = contentHash(s);
    if (opt.note) review.note = opt.note;
    s.status = decision;
    s.reviews = [...(Array.isArray(s.reviews) ? s.reviews : []), review];
    fs.writeFileSync(item.path, formatJson(s));
    console.log(`✓ ${key}: ${decision} (${by}${review.hash ? ` · 지문 ${review.hash}` : ''})`);
  }
  if (failed) process.exitCode = 1;
}

async function cmdProgress() {
  const e = await env();
  const set = loadSynopses(DIR);
  const batches = readBatches();
  const label = (key) => {
    const s = set.byUnit.get(key)?.data;
    if (!s) return '없음';
    const st = stateOf(s);
    return st.ok ? '확정' : st.changed ? '확정 뒤 고침' : st.status;
  };
  if (args[0]) {
    const b = batches?.batches?.find((x) => x.id === args[0]);
    if (!b) throw new Error(`묶음이 없다: ${args[0]} (batch --write로 만든다)`);
    const rows = b.units.map((k) => [k, label(k)]);
    const next = rows.find(([, l]) => l !== '확정');
    console.log(`${b.id} — ${b.label} · ${b.units.length}단위 · 입력 ${b.size.toLocaleString('ko-KR')}자 · 확정 ${rows.filter(([, l]) => l === '확정').length}`);
    for (const [k, l] of rows) console.log(`  ${l === '확정' ? '✓' : l === '없음' ? '·' : '~'} ${k.padEnd(28)} ${e.ctx.resolve(k)?.title ?? ''} — ${l}`);
    console.log(next ? `\n다음: node tools/synopsis.mjs new ${next[0]}` : '\n이 묶음은 다 확정했다');
    return;
  }
  const byKind = new Map();
  for (const key of e.keys) {
    const k = unitKind(key);
    const m = byKind.get(k) ?? byKind.set(k, { n: 0, ok: 0, other: 0 }).get(k);
    m.n++;
    const l = label(key);
    if (l === '확정') m.ok++;
    else if (l !== '없음') m.other++;
  }
  console.log('종류별 — 확정 / 전체 (쓰는 중)');
  for (const [k, m] of byKind) console.log(`  ${KIND_LABEL[k].padEnd(8)} ${m.ok}/${m.n}${m.other ? ` (${m.other})` : ''}`);
  if (batches?.batches?.length) {
    console.log('\n묶음별');
    for (const b of batches.batches) {
      const ok = b.units.filter((k) => label(k) === '확정').length;
      console.log(`  ${b.id.padEnd(5)} ${String(ok).padStart(3)}/${String(b.units.length).padEnd(3)} ${b.label} ${b.first} … ${b.last}`);
    }
  }
  const c = tally(e, set);
  console.log(`\n전체 확정 ${c.ok}/${e.keys.length}${c.changed ? ` · 확정 뒤 고침 ${c.changed}` : ''}`);
}

async function cmdBatch() {
  const e = await env();
  const max = Number(opt.max ?? 80_000);
  const ds = dataset(e);
  const units = e.keys.map((key) => ({ key, order: e.places.unitPos.get(key), size: [...(buildInput(key, { ds, ctx: e.ctx, places: e.places, units: e.units }) ?? '')].length }));
  const batches = planBatches(units, max);
  for (const g of GROUPS) {
    const list = units.filter((u) => g.kinds.includes(unitKind(u.key)));
    console.log(`${g.label}: ${list.length}단위 · 입력 ${list.reduce((a, u) => a + u.size, 0).toLocaleString('ko-KR')}자`);
  }
  console.log('');
  for (const b of batches) console.log(`${b.id.padEnd(5)} ${b.label.padEnd(18)} ${String(b.units.length).padStart(3)}단위 ${b.size.toLocaleString('ko-KR').padStart(7)}자  ${b.first} … ${b.last}`);
  if (opt.write) {
    const p = path.join(DIR, BATCHES_FILE);
    fs.mkdirSync(DIR, { recursive: true });
    const out = { _comment: 'W9 묶음 — node tools/synopsis.mjs batch --write가 만든다. 단위 목록은 이 파일이 정본이다(입력 분량이 바뀌어도 그대로)', max, date: opt.date ?? today(), batches: batches.map(({ id, group, label, size, first, last, units: us }) => ({ id, group, label, size, first, last, units: us })) };
    fs.writeFileSync(p, formatJson(out));
    console.log(`\n→ ${rel(p)}`);
  }
}

const COMMANDS = { new: cmdNew, check: cmdCheck, set: cmdSet, progress: cmdProgress, batch: cmdBatch };
if (opt.help || !COMMANDS[cmd]) {
  console.log(USAGE);
  if (!opt.help && cmd) process.exitCode = 1;
} else {
  try {
    await COMMANDS[cmd]();
  } catch (err) {
    console.error(`오류: ${err.message}`);
    process.exitCode = 1;
  } finally {
    envCache?.db.close();
  }
}
