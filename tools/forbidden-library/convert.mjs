/**
 * 금서고 → 블라링크 단위 옮기기 (N2a2) — 금서고 이벤트 단위(`fl:<파일>`)로 쓴 기록을 블라링크 이벤트 키로 옮긴다.
 *
 *   node tools/forbidden-library/convert.mjs event_absolute1            미리보기: 씬 대응 · 줄 맞춤 · 옮길 곳 수 (아무것도 안 고친다)
 *   node tools/forbidden-library/convert.mjs event_absolute1 --write    옮긴다
 *
 * 어느 금서고 파일인지는 annotations/hold.json의 그 키(`금서고` 칸, 전환 대기) → 없으면 매핑(forbidden-library-events.json)에서 그 키를 가진 파일.
 * 블라링크 쪽 원문(data/raw/scene/)이 받아져 있어야 한다.
 *
 * 맞추기
 *   - 씬: 블라링크 아카이브 순서와 금서고 파일 안 순서를 짝짓는다. 씬 수가 같고 짝마다 줄이 반 넘게 맞으면 순서대로, 아니면 줄이 가장 많이 맞는 씬으로.
 *   - 줄: 대사 텍스트로 맞춘다 — 태그 · 공백 · 문장부호(`···` ↔ `…`)를 걷고 글자 쌍이 반 넘게 같으면 같은 줄로 보고 순서를 지키며 정렬한다(LCS).
 *     못 맞춘 줄은 가까운 맞춘 줄에서 같은 거리만큼 떨어진 줄로(씬 범위 안).
 *
 * 옮기는 것(--write) — annotations/ 아래 .json · .md 전부(hold.json · 매핑 빼고)
 *   1. `fl:<파일>_NN#줄` → `<블라링크 씬>#<옮긴 줄>`(범위 · 쉼표 목록도), `{ "scene": "fl:…_NN", "lines": [...] }` → 씬 · 줄 둘 다
 *   2. 나머지 `fl:<파일>_NN` → 블라링크 씬, `fl:<파일>` → 블라링크 키
 *   3. 그 단위의 기록 파일(맨 위 `unit`이 그 단위인 .json) 문장 안 줄임 표기 — `13 #30-33` · `04#49` → 씬 ID#옮긴 줄, `(03)` · `(01–02)` → 씬 ID.
 *      씬 없이 `#N`만 쓴 곳은 바로 앞 씬을 모르니 그대로 두고, 줄이 바뀐 씬이 있으면 알린다(사람이 본다).
 *   4. 파일 이름 `fl.<파일>*.json` → `<블라링크 키>*.json`
 *   5. hold.json의 그 키를 지우고 매핑의 null을 키로
 *   6. 확정 지문 — 개요(synopsis) · 판(versions) · 한 줄(blurbs)의 확정 검토 지문이 옮기기 전 내용과 맞았으면 옮긴 내용의 지문으로 바꾼다
 *      (키만 바뀌었으니 다시 검토할 것이 없다). `src`(위 판정 · 흐름의 지문)는 DB · 사이트 데이터를 다시 만든 뒤 각 도구의 `--refresh`로.
 * 뒤 단계(출시 순서 · 다시 뽑기 · 낡은 판 확정 · 테스트)는 docs/update.md "확인" 2 "기록 옮기기".
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readLibrary, stemOf } from '../normalize/library.mjs';
import { contentHash as synopsisHash } from '../synopsis/model.mjs';
import { contentHash as versionHash } from '../versions/model.mjs';
import { contentHash as blurbHash } from '../blurbs/model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = path.join(ROOT, 'data/raw');
const ANN = path.join(ROOT, 'annotations');
const HOLD_PATH = path.join(ANN, 'hold.json');
const MAP_PATH = path.join(ANN, 'forbidden-library-events.json');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- 원문 ----

/** 블라링크 이벤트 하나의 씬(아카이브 순서)과 줄 — build.mjs readArchiveList · readSceneLines와 같은 순서 · seq */
export function blablaScenes(key) {
  const walk = (n, o = []) => {
    if (!n || typeof n !== 'object') return o;
    if (typeof n.scenario_group_id === 'string') o.push(n.scenario_group_id);
    for (const v of Object.values(n)) walk(v, o);
    return o;
  };
  for (const entry of readJson(path.join(RAW, 'archive/ko/archive_list.json'))) {
    const ids = [...new Set(walk(entry))];
    const prefix = ids[0]?.match(/^event_([A-Za-z0-9]+)/)?.[1];
    if (!ids.length || `event_${prefix}` !== key) continue;
    return ids.map((id) => {
      const p = path.join(RAW, `scene/ko/scene_detail_${id}.json`);
      const recs = fs.existsSync(p) ? readJson(p).scenario_group_id?.records?.value ?? [] : [];
      return { id, lines: recs.map((r) => r.quest_name ?? '') };
    });
  }
  return null;
}

/** 금서고 단위 하나의 씬과 줄 — DB에 있든 없든(hold) 빌드가 만들 그대로 */
export function libraryScenes(unit) {
  const lib = readLibrary({ blablaHasText: () => false });
  const scenes = lib.stories.filter((s) => s.categoryId === unit).sort((a, b) => a.orderIndex - b.orderIndex);
  const by = new Map(scenes.map((s) => [s.id, []]));
  for (const l of lib.lines) by.get(l.storyId)?.push(l);
  return scenes.map((s) => ({ id: s.id, lines: by.get(s.id).sort((a, b) => a.seq - b.seq).map((l) => l.text ?? '') }));
}

/** 블라링크 키 → 금서고 파일(카테고리/파일) */
export function libraryFileOf(key) {
  const hold = fs.existsSync(HOLD_PATH) ? readJson(HOLD_PATH) : {};
  if (hold[key]?.금서고) return hold[key].금서고;
  return Object.entries(readJson(MAP_PATH)).find(([k, v]) => !k.startsWith('_') && v === key)?.[0] ?? null;
}

// ---- 맞추기 ----

const norm = (t) =>
  String(t)
    .replace(/<[^>]*>|\{[^}]*\}/g, '')
    .replace(/·{2,}/g, '…')
    .replace(/[\s.,!?…~'"“”‘’·\-—:[\]]/g, '');
const bigrams = (s) => {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
  return m;
};
/** 0–1 — 같으면 1, 글자 쌍 겹침(Dice) */
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let x = 0;
  for (const [k, v] of A) x += Math.min(v, B.get(k) ?? 0);
  return (2 * x) / (a.length - 1 + b.length - 1);
}
const SAME = 0.5;

/** 순서를 지키는 정렬 — 옛 줄 i → 새 줄(맞춘 것) 또는 null, 맞춘 줄의 같음 정도 */
export function alignLines(oldLines, newLines) {
  const a = oldLines.map(norm);
  const b = newLines.map(norm);
  const n = a.length;
  const m = b.length;
  const S = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const P = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = S[i - 1][j];
      let p = 1;
      if (S[i][j - 1] > best) [best, p] = [S[i][j - 1], 2];
      const s = similarity(a[i - 1], b[j - 1]);
      if (s >= SAME && S[i - 1][j - 1] + s > best) [best, p] = [S[i - 1][j - 1] + s, 3];
      S[i][j] = best;
      P[i][j] = p;
    }
  }
  const map = new Array(n).fill(null);
  const score = new Array(n).fill(0);
  for (let i = n, j = m; i > 0 && j > 0; ) {
    if (P[i][j] === 3) {
      map[i - 1] = j - 1;
      score[i - 1] = similarity(a[i - 1], b[j - 1]);
      i--;
      j--;
    } else if (P[i][j] === 1) i--;
    else j--;
  }
  return { map, score };
}

/** 못 맞춘 줄을 가까운 맞춘 줄에서 같은 거리로 채운다 */
function fillNearest(map, newCount) {
  const out = [...map];
  const how = map.map((v) => (v == null ? null : 'text'));
  for (let i = 0; i < map.length; i++) {
    if (map[i] != null) continue;
    let p = i - 1;
    while (p >= 0 && map[p] == null) p--;
    let q = i + 1;
    while (q < map.length && map[q] == null) q++;
    const guess = p >= 0 && (q >= map.length || i - p <= q - i) ? map[p] + (i - p) : q < map.length ? map[q] - (q - i) : i;
    out[i] = Math.max(0, Math.min(newCount - 1, guess));
    how[i] = 'near';
  }
  return { map: out, how };
}

/** 씬 짝 + 줄 대응 */
export function buildPlan(key) {
  const file = libraryFileOf(key);
  if (!file) throw new Error(`${key}: hold.json 전환 대기에도 매핑에도 이 키의 금서고 파일이 없다`);
  const unit = `fl:${stemOf(path.basename(file))}`;
  const olds = libraryScenes(unit);
  const news = blablaScenes(key);
  if (!olds.length) throw new Error(`${unit}: 금서고 원문이 없다(data/raw/forbidden-library/scripts/${file})`);
  if (!news?.length) throw new Error(`${key}: 블라링크 아카이브에 이 이벤트가 없다`);
  if (news.some((s) => !s.lines.length)) throw new Error(`${key}: 본문 없는 씬 — ${news.filter((s) => !s.lines.length).map((s) => s.id).join(' · ')}`);

  const hits = (o, nw) => alignLines(o.lines, nw.lines).map.filter((v) => v != null).length;
  const byOrder = olds.length === news.length && olds.every((o, i) => hits(o, news[i]) * 2 > o.lines.length);
  const warnings = [];
  const scenes = olds.map((o, i) => {
    let to = news[i];
    if (!byOrder) {
      const ranked = news.map((nw) => [nw, hits(o, nw)]).sort((x, y) => y[1] - x[1]);
      to = ranked[0][0];
      if (ranked[0][1] * 2 <= o.lines.length) warnings.push(`${o.id} → ${to.id}: 줄이 반도 안 맞는다(${ranked[0][1]}/${o.lines.length})`);
    }
    const { map: raw, score } = alignLines(o.lines, to.lines);
    const { map, how } = fillNearest(raw, to.lines.length);
    return {
      from: o.id,
      to: to.id,
      oldCount: o.lines.length,
      newCount: to.lines.length,
      map,
      how,
      exact: score.filter((s) => s === 1).length,
      similar: score.filter((s) => s > 0 && s < 1).length,
      near: how.filter((h) => h === 'near').length,
      moved: map.filter((v, k) => v !== k).length,
    };
  });
  const dup = scenes.map((s) => s.to).filter((t, i, arr) => arr.indexOf(t) !== i);
  if (dup.length) warnings.push(`블라링크 씬 하나에 금서고 씬 둘 이상: ${[...new Set(dup)].join(' · ')}`);
  return { key, file, unit, byOrder, scenes, warnings };
}

// ---- 옮기기 ----

/** "12" · "20-25" · 숫자 → 새 줄 표기(범위는 양 끝을 옮긴다) */
function mapLineSpec(spec, sc) {
  const one = (n) => {
    const v = Number(n);
    if (!Number.isInteger(v) || v < 0 || v >= sc.oldCount) throw new Error(`${sc.from}#${n}: 범위 밖 줄(${sc.oldCount}줄)`);
    return sc.map[v];
  };
  const m = String(spec).match(/^(\d+)-(\d+)$/);
  if (m) {
    const a = one(m[1]);
    const b = one(m[2]);
    return a === b ? String(a) : `${a}-${b}`;
  }
  return String(one(spec));
}
const mapSpecList = (list, sc) => list.split(',').map((p) => mapLineSpec(p.trim(), sc)).join(',');

/**
 * 텍스트 하나를 옮긴다. ownUnit이면 그 단위의 기록 파일 — 문장 안 줄임 표기(`13 #30-33` · `(03)`)도.
 * @returns {{ text, n }} n = 바꾼 곳 수
 */
export function rewriteText(text, plan, { ownUnit = false } = {}) {
  const { unit, key } = plan;
  const sceneOf = new Map(plan.scenes.map((s) => [s.from, s]));
  const byNum = new Map(plan.scenes.map((s) => [Number(s.from.slice(unit.length + 1)), s]));
  const U = escRe(unit);
  let n = 0;
  let t = text;
  // 1. { "scene": "fl:…_NN", "lines": [ … ] }
  t = t.replace(new RegExp(`("scene"\\s*:\\s*")(${U}_\\d+)("\\s*,\\s*"lines"\\s*:\\s*\\[)([^\\]]*)(\\])`, 'g'), (all, a, id, b, body, c) => {
    const sc = sceneOf.get(id);
    if (!sc) throw new Error(`${id}: 없는 씬`);
    n++;
    const lines = body.replace(/"(\d+)-(\d+)"|"(\d+)"|(\d+)/g, (tok, r1, r2, s1, num) => {
      if (r1 != null) return `"${mapLineSpec(`${r1}-${r2}`, sc)}"`;
      if (s1 != null) return `"${mapLineSpec(s1, sc)}"`;
      return mapLineSpec(num, sc);
    });
    return `${a}${sc.to}${b}${lines}${c}`;
  });
  // 1. fl:…_NN#줄
  t = t.replace(new RegExp(`${U}_(\\d+)#(\\d+(?:-\\d+)?(?:,\\d+(?:-\\d+)?)*)`, 'g'), (all, num, spec) => {
    const sc = sceneOf.get(`${unit}_${num}`);
    if (!sc) throw new Error(`${unit}_${num}: 없는 씬`);
    n++;
    return `${sc.to}#${mapSpecList(spec, sc)}`;
  });
  // 2. 씬 · 단위 키
  t = t.replace(new RegExp(`${U}_(\\d+)(?![\\w#])`, 'g'), (all, num) => {
    const sc = sceneOf.get(`${unit}_${num}`);
    if (!sc) throw new Error(`${unit}_${num}: 없는 씬`);
    n++;
    return sc.to;
  });
  t = t.replace(new RegExp(`${U}(?!\\w)`, 'g'), () => {
    n++;
    return key;
  });
  if (!ownUnit) return { text: t, n };
  // 3. 줄임 표기 — 두 자리 씬 번호(그 단위 씬 수 안)
  const scene = (d) => (d.length === 2 || d.length === 3 ? byNum.get(Number(d)) : null);
  t = t.replace(/(?<![\w#:.\-–])(\d{2,3})( ?)#(\d+(?:-\d+)?(?:,\s?\d+(?:-\d+)?)*)/g, (all, d, sp, spec) => {
    const sc = scene(d);
    if (!sc) return all;
    n++;
    return `${sc.to}#${spec.split(',').map((p) => (p.startsWith(' ') ? ' ' : '') + mapLineSpec(p.trim(), sc)).join(',')}`;
  });
  t = t.replace(/\((\d{2,3})(?:([–-])(\d{2,3}))?\)/g, (all, d1, dash, d2) => {
    const a = scene(d1);
    const b = d2 ? scene(d2) : null;
    if (!a || (d2 && !b)) return all;
    n++;
    return b ? `(${a.to}${dash}${b.to})` : `(${a.to})`;
  });
  return { text: t, n };
}

function walkFiles(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walkFiles(p, out);
    else if (/\.(json|md)$/.test(f)) out.push(p);
  }
  return out;
}

/** 확정 검토 지문 — 옛 내용과 맞던 지문 → 옮긴 내용의 지문 (옛 지문 → 새 지문 쌍) */
function restampPairs(rel, before, after) {
  const pairs = [];
  const swap = (reviews, oldH, newH) => {
    for (const r of Array.isArray(reviews) ? reviews : []) if (r?.decision === '확정' && r.hash === oldH && oldH !== newH) pairs.push([oldH, newH]);
  };
  if (rel.startsWith('synopsis/') && !path.basename(rel).startsWith('_')) swap(after.reviews, synopsisHash(before), synopsisHash(after));
  if (rel.startsWith('versions/')) (after.versions ?? []).forEach((v, i) => swap(v.reviews, versionHash(before.versions?.[i]), versionHash(v)));
  if (rel.startsWith('blurbs/')) {
    for (const k of Object.keys(after)) {
      if (after[k] && typeof after[k] === 'object' && !Array.isArray(after[k])) swap(after[k].reviews, blurbHash(before[k]), blurbHash(after[k]));
    }
  }
  return pairs;
}

/**
 * 3의 나머지 — 씬 없이 `#N`만 쓴 줄(옛 번호). 그 문자열에서 바로 앞에 쓴 씬(`<씬>#…`), 없으면 그 기록의 근거 씬이 하나뿐일 때 그 씬으로 본다.
 * 앞에 쓴 씬이 이 단위 밖이면 건드리지 않는다. 어느 씬인지 모르는데 그 기록 근거에 줄이 바뀐 씬이 있으면 알린다.
 * @returns {{ text, n, unknown: string[] }}
 */
export function remapBare(text, plan) {
  const byTo = new Map(plan.scenes.map((s) => [s.to, s]));
  const moved = new Set(plan.scenes.filter((s) => s.moved).map((s) => s.to));
  const edits = [];
  const unknown = [];
  const remapString = (str, fallback, evMoved) =>
    str.replace(/([A-Za-z][\w:.]*_[\w]*?)#(?=\d)|(?<![\w\-–#])#(\d+(?:-\d+)?)/g, (all, scene, spec, off) => {
      if (scene != null) {
        remapString.cur = byTo.get(scene) ?? null;
        remapString.seen = true;
        return all;
      }
      const sc = remapString.seen ? remapString.cur : fallback ? byTo.get(fallback) : null;
      if (!sc) {
        if (evMoved && !remapString.seen) unknown.push(`${str.slice(Math.max(0, off - 30), off + 12)}`);
        return all;
      }
      return `#${mapLineSpec(spec, sc)}`;
    });
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const ev = [...(Array.isArray(node.evidence) ? node.evidence : []), ...(Array.isArray(node.trigger) ? node.trigger : [])].map((e) => e?.scene).filter(Boolean);
    const own = [...new Set(ev)];
    const fallback = own.length === 1 && byTo.has(own[0]) ? own[0] : null;
    const evMoved = own.some((s) => moved.has(s));
    for (const v of Object.values(node)) {
      if (typeof v === 'string') {
        remapString.cur = null;
        remapString.seen = false;
        const nv = remapString(v, fallback, evMoved);
        if (nv !== v) edits.push([v, nv]);
      } else visit(v);
    }
  };
  visit(JSON.parse(text));
  let t = text;
  for (const [a, b] of edits) {
    const from = JSON.stringify(a);
    if (!t.includes(from)) throw new Error(`줄 번호를 고칠 문자열을 파일에서 못 찾았다: ${from.slice(0, 60)}`);
    t = t.replace(from, () => JSON.stringify(b));
  }
  return { text: t, n: edits.length, unknown };
}

export function applyPlan(plan) {
  const report = { files: [], renamed: [], restamped: 0, bare: 0, unknown: [] };
  const oldBase = plan.unit.replace(/[:/\\?*"<>|]/g, '.');
  const skip = new Set([HOLD_PATH, MAP_PATH]);
  for (const p of walkFiles(ANN)) {
    if (skip.has(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(plan.unit)) continue;
    const rel = path.relative(ANN, p);
    let before = null;
    let own = false;
    if (p.endsWith('.json')) {
      before = JSON.parse(src);
      own = before?.unit === plan.unit;
    }
    let { text, n } = rewriteText(src, plan, { ownUnit: own });
    if (before) {
      if (own) {
        const b = remapBare(text, plan);
        text = b.text;
        report.bare += b.n;
        report.unknown.push(...b.unknown.map((u) => `${rel}: …${u}`));
      }
      for (const [a, b] of restampPairs(rel, before, JSON.parse(text))) {
        text = text.replaceAll(`"hash": "${a}"`, `"hash": "${b}"`);
        report.restamped++;
      }
      if (JSON.stringify(JSON.parse(text)).includes(plan.unit)) throw new Error(`${rel}: 옮긴 뒤에도 ${plan.unit}이 남았다`);
    }
    fs.writeFileSync(p, text);
    report.files.push(`${rel} ${n}`);
    const base = path.basename(p);
    if (base === `${oldBase}.json` || base.startsWith(`${oldBase}.p`)) {
      const to = path.join(path.dirname(p), plan.key + base.slice(oldBase.length));
      if (fs.existsSync(to)) throw new Error(`${path.relative(ANN, to)}: 이미 있다`);
      fs.renameSync(p, to);
      report.renamed.push(`${rel} → ${path.relative(ANN, to)}`);
    }
  }
  // 5. hold · 매핑
  const hold = JSON.parse(fs.readFileSync(HOLD_PATH, 'utf8'));
  if (hold[plan.key]) {
    delete hold[plan.key];
    fs.writeFileSync(HOLD_PATH, `${JSON.stringify(hold, null, 2)}\n`);
  }
  const mapText = fs.readFileSync(MAP_PATH, 'utf8');
  const re = new RegExp(`("${escRe(plan.file)}"\\s*:\\s*)null`);
  if (re.test(mapText)) fs.writeFileSync(MAP_PATH, mapText.replace(re, `$1"${plan.key}"`));
  return report;
}

// ---- CLI ----

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { write: { type: 'boolean' } } });
  const key = positionals[0];
  if (!key) {
    console.error('쓰는 법: node tools/forbidden-library/convert.mjs <블라링크 이벤트 키> [--write]');
    process.exit(1);
  }
  const plan = buildPlan(key);
  console.log(`${plan.unit} (${plan.file}) → ${key} — 씬 ${plan.scenes.length}, 짝 ${plan.byOrder ? '순서대로' : '줄이 가장 많이 맞는 씬'}`);
  let tot = { lines: 0, exact: 0, similar: 0, near: 0, moved: 0 };
  for (const s of plan.scenes) {
    tot = { lines: tot.lines + s.oldCount, exact: tot.exact + s.exact, similar: tot.similar + s.similar, near: tot.near + s.near, moved: tot.moved + s.moved };
    const flag = s.near || s.moved ? `  ← 같음 ${s.exact} · 닮음 ${s.similar} · 가까운 줄 ${s.near} · 번호 바뀜 ${s.moved}` : '';
    console.log(`  ${s.from} (${s.oldCount}줄) → ${s.to} (${s.newCount}줄)${flag}`);
  }
  console.log(`줄 ${tot.lines}: 같음 ${tot.exact} · 닮음 ${tot.similar} · 가까운 줄 ${tot.near} — 번호 바뀜 ${tot.moved}`);
  for (const w of plan.warnings) console.log(`⚠ ${w}`);

  // 옮길 곳 (미리보기는 고치지 않고 센다)
  const hits = [];
  for (const p of walkFiles(ANN)) {
    if (p === HOLD_PATH || p === MAP_PATH) continue;
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(plan.unit)) continue;
    let own = false;
    if (p.endsWith('.json')) own = JSON.parse(src)?.unit === plan.unit;
    hits.push(`${path.relative(ANN, p)} ${rewriteText(src, plan, { ownUnit: own }).n}${own ? ' (단위 기록 — 줄임 표기도)' : ''}`);
  }
  console.log(`\n옮길 파일 ${hits.length}:`);
  for (const h of hits) console.log(`  ${h}`);
  if (!values.write) {
    console.log('\n미리보기 — 옮기려면 --write');
    return;
  }
  if (plan.warnings.length) {
    console.error('\n경고가 있어 옮기지 않는다 — 씬 짝을 확인한다');
    process.exit(1);
  }
  const r = applyPlan(plan);
  console.log(`\n옮겼다: 파일 ${r.files.length} · 이름 바꿈 ${r.renamed.length} · 확정 지문 ${r.restamped} · 씬 없이 쓴 #N 고친 문자열 ${r.bare}`);
  for (const x of r.renamed) console.log(`  ${x}`);
  if (r.unknown.length) {
    console.log(`\n씬을 모르는 #N ${r.unknown.length} — 근거에 줄이 바뀐 씬이 있다. 어느 씬인지 보고 손으로 고친다:`);
    for (const b of r.unknown) console.log(`  ${b}`);
  }
  console.log(`\nhold.json ${plan.key} 지움 · 매핑 ${plan.file} → ${plan.key}`);
  console.log('다음: docs/update.md "확인" 2 "기록 옮기기"의 뒤 단계 — release-order · 다시 뽑기 · 낡은 판 확정 · node --test');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
