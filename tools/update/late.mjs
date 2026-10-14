/**
 * N2d — 늦게 들어온 단위(docs/update.md "늦게 들어온 단위"). 보류됐던 원문이 뒤 패치를 읽은 다음에 들어오면
 * 그 단위의 U 항목은 읽기 순서 파일 끝에 붙지만, 출시순 한 줄에서는 출시 자리로 끼운다(U 항목 줄의 `자리 \`키\` 앞` — order.mjs placeLate).
 *
 *   node tools/update/late.mjs <단위 키 | U 항목 ID>   자리(써야 할 자리 키 · 쓴 자리 키) · 먼저 읽은 뒤 단위 · 옮길 거리 후보
 *   node tools/update/late.mjs <…> --out <파일>        같은 것을 파일로(큰 출력)
 *
 * 자리 = 출시순 한 줄에서 이 단위보다 출시가 늦은 첫 단위(같은 패치의 U 항목은 빼고) 바로 앞. 출시 차례는 공지 패치(tools/update.mjs)의
 * (패치 날짜, 패치 안 차례 — 이벤트 · 사이드 · 호감도 차례)다. 그런 단위가 없으면 늦게 들어온 단위가 아니다(자리를 쓰지 않는다).
 * 옮길 거리 후보 — 자리 뒤에 있으면서 이미 읽은 단위(먼저 읽은 뒤 단위)의 기록 가운데, 이 단위가 먼저 드러냈을 수 있는 것:
 *   새 대상(targets — "처음 나왔다") 중 이 단위 원문에 나오는 것 · 이 단위 원문의 대상을 다룬 사실 · 의문(focus 점수 순) · 화면 글의 '처음'.
 * 기계가 고른 후보일 뿐이다 — 이 단위의 1회독을 쓴 뒤 하나씩 원문과 견줘 Claude가 옮길지 정한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { READ1_PREFIXES, loadRegions, parseLateAnchors, parseOrder, placeByRegion, placeLate } from '../records/order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ANN = path.join(ROOT, 'annotations');
const ORDER_PATH = path.join(ANN, 'reading-order.md');

/** 출시 차례 — 단위 키 → [패치 날짜, 패치 안 차례]. 공지 패치에 없는 단위(서브퀘스트 · 유실물 등)는 없다 */
export function unitRanks(patches) {
  const out = new Map();
  for (const p of patches) {
    p.units.forEach((u, i) => {
      if (!u.key || u.kind === 'sub') return;
      const key = u.key.replace(/^held:/, '');
      if (!out.has(key)) out.set(key, [p.day, i]);
    });
  }
  return out;
}

const cmpRank = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);

/** U 항목 → 패치 날짜(줄의 ` — ` 뒤 `패치 YYYY-MM-DD`) */
function updatePatches(text) {
  const out = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^- \[.\] \*\*(U\d+[a-z]?)[^*]*\*\*.* — .*?패치 (\d{4}-\d{2}-\d{2})/);
    if (m) out.set(m[1], m[2]);
  }
  return out;
}

/**
 * U 항목마다 자리 — 써야 할 자리 키(expected, 없으면 null = 늦지 않음)와 쓴 자리 키(written).
 * 써야 할 자리는 다른 U 항목의 자리는 반영한 출시순 한 줄에서 잰다.
 * @param {string} text 읽기 순서 파일 내용
 * @param {Map<string, [string, number]>} ranks unitRanks
 * @param {Map<string, number>} [regions] 지역(기본 = annotations/의 지역 파일)
 * @returns {{ session: string, patch: string|null, keys: string[], written: string|null, expected: string|null }[]}
 */
export function lateAnchors(text, ranks, regions = loadRegions()) {
  const raw = parseOrder(text, READ1_PREFIXES);
  const placedByRegion = placeByRegion(raw, regions);
  const anchors = parseLateAnchors(text);
  const patchOf = updatePatches(text);
  const out = [];
  for (const s of raw.sessions.filter((x) => /^U\d/.test(x.id))) {
    const others = new Map([...anchors].filter(([id]) => id !== s.id));
    const order = placeLate(placedByRegion, others);
    const patch = patchOf.get(s.id) ?? null;
    const samePatch = new Set([...patchOf].filter(([, d]) => d === patch).map(([id]) => id));
    const mine = s.keys.map((k) => ranks.get(k)).filter(Boolean).sort(cmpRank)[0] ?? null;
    let expected = null;
    if (mine) {
      for (const it of order.items) {
        if (samePatch.has(it.session) || it.session === s.id) continue;
        const r = ranks.get(it.key);
        if (r && cmpRank(r, mine) > 0) {
          expected = it.key;
          break;
        }
      }
    }
    out.push({ session: s.id, patch, keys: s.keys, written: anchors.get(s.id) ?? null, expected });
  }
  return out;
}

/** 자리 문제 한 줄씩 — 체크리스트 order 항목이 쓴다 */
export function anchorProblems(rows) {
  const out = [];
  for (const r of rows) {
    if (r.expected && r.written !== r.expected) out.push(`${r.session} 자리 — 줄의 ' — ' 뒤에 "자리 \`${r.expected}\` 앞"${r.written ? `(지금 ${r.written})` : ''} — node tools/update/late.mjs ${r.session}`);
    else if (!r.expected && r.written) out.push(`${r.session} 자리 \`${r.written}\` 앞 — 출시가 늦은 단위가 앞에 없어 늦게 들어온 단위가 아니다(자리를 지운다)`);
  }
  return out;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, today: { type: 'string' } } });
  if (!positionals.length) throw new Error('쓰는 법: node tools/update/late.mjs <단위 키 | U 항목 ID> [--out 파일]');
  const { buildPatches, loadInputs } = await import('../update.mjs');
  const { kstDay } = await import('../notices/kdate.mjs');
  const { patches } = buildPatches(loadInputs({ today: values.today ?? kstDay(new Date()) }));
  const ranks = unitRanks(patches);
  const text = fs.readFileSync(ORDER_PATH, 'utf8');
  const rows = lateAnchors(text, ranks);
  const want = positionals[0];
  const row = rows.find((r) => r.session === want || r.keys.includes(want));
  if (!row) throw new Error(`${want} — U 항목에 없다(먼저 annotations/reading-order.md "업데이트"에 U 항목을 단다)`);

  const L = [];
  L.push(`# 늦게 들어온 단위 — ${row.session} ${row.keys.join(' ')} (패치 ${row.patch ?? '?'})`, '');
  if (!row.expected) {
    L.push('출시가 늦은 단위가 앞에 없다 — 늦게 들어온 단위가 아니다. 보통 U 항목으로 읽는다.');
    if (row.written) L.push(`⚠ 줄에 자리 \`${row.written}\` 앞이 있다 — 지운다.`);
    finish(L, values.out);
    return;
  }
  L.push(`자리: \`${row.expected}\` 앞 — U 항목 줄 ` + '` — `' + ` 뒤에 \`자리 \\\`${row.expected}\\\` 앞\`을 단다. 지금: ${row.written ? `\`${row.written}\` 앞${row.written === row.expected ? ' ✓' : ' ✗'}` : '없음 ✗'}`);

  // 먼저 읽은 뒤 단위 — 자리 뒤에 있으면서 이 U 항목보다 먼저 읽은 항목(옛 항목 · 앞 U 항목)의 단위
  const raw = parseOrder(text, READ1_PREFIXES);
  const anchors = parseLateAnchors(text);
  anchors.set(row.session, row.expected);
  const order = placeLate(placeByRegion(raw, loadRegions()), anchors);
  const sessionAt = new Map(raw.sessions.map((s, i) => [s.id, i]));
  const mineAt = sessionAt.get(row.session);
  const start = order.items.findIndex((it) => it.session === row.session);
  const later = [...new Set(order.items.slice(start).filter((it) => it.session !== row.session && sessionAt.get(it.session) < mineAt).map((it) => it.key))];
  L.push('', `## 먼저 읽은 뒤 단위 ${later.length}개`, '', later.length ? later.map((k) => `\`${k}\``).join(' ') : '없음');
  L.push('이 단위들의 기록은 이 단위보다 뒤 자리다 — 이 단위 기록의 근거 · 사건 parent로 쓰지 않는다(검증기 "읽는 순서를 거슬러 간다").');

  const { openContext } = await import('../records/context.mjs');
  const { loadDataset } = await import('../records/model.mjs');
  const { sourceTargets, pickFacts } = await import('../records/focus.mjs');
  const ctx = await openContext();
  const ds = loadDataset();
  const hits = sourceTargets(ctx, row.keys);
  const laterSet = new Set(later);
  const unitOfFile = new Map(ds.files.map((f) => [f.name, f.data?.unit]));

  const tg = ds.targets.filter((t) => laterSet.has(unitOfFile.get(t.file)) && hits.has(t.obj?.target));
  L.push('', `## 새 대상 후보 ${tg.length}건 — 뒤 단위가 "처음 나왔다"로 적은 대상 중 이 단위 원문에 나오는 것`, '');
  L.push('이 단위가 먼저 소개하면 이 단위 targets로 옮기고 뒤 단위 줄은 지운다(검증기 "새 대상이 두 번 나온다").');
  for (const t of tg) L.push(`- ${t.obj.target} — \`${unitOfFile.get(t.file)}\` · 이 단위 원문 ${hits.get(t.obj.target)}줄 · ${t.obj.note ?? ''}`);

  const defs = ds.candidates.filter((c) => c.role === 'def' && c.status !== '기각' && (c.kind === 'fact' || c.kind === 'question'));
  const pool = defs.filter((c) => laterSet.has(c.unit));
  const { picked, left } = pickFacts(defs, pool, hits, 12_000, (c) => [...String(c.text ?? '')].length + 40);
  L.push('', `## 사실 · 의문 후보 ${picked.length}건${left ? ` (예산 밖 ${left}건)` : ''} — 이 단위 원문의 대상을 다룬 뒤 단위 기록(점수 순)`, '');
  L.push('이 단위가 같은 것을 먼저 드러내면(제기하면) 이 단위 기록이 드러냄 · 제기가 되고, 뒤 단위 기록은 다시 드러남 · 회수 사건으로 고친다(조용히 — 늦게 읽었다는 말 없이).');
  for (const { fact: c } of picked) L.push(`- ${c.id} \`${c.unit}\` ${c.kind === 'fact' ? '사실' : '의문'} — ${c.text}`);

  const words = [];
  for (const key of later) {
    const base = key.replace(/[:/\\?*"<>|]/g, '.');
    for (const dir of ['synopsis', 'blurbs']) {
      const f = path.join(ANN, dir, `${base}.json`);
      if (!fs.existsSync(f)) continue;
      const walk = (v, at) => {
        if (typeof v === 'string') {
          if (v.includes('처음') && !/^(src|hash|date|session|by|status)$/.test(at.at(-1) ?? '')) words.push(`- \`${key}\` ${dir}/${base}.json ${at.join('.')}`);
        } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, [...at, String(i)]));
        else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'reviews') walk(x, [...at, k]);
      };
      walk(JSON.parse(fs.readFileSync(f, 'utf8')), []);
    }
  }
  for (const c of ds.candidates.filter((x) => x.kind === 'layer' && laterSet.has(x.layerUnit) && String(x.reason ?? '').includes('처음'))) words.push(`- \`${c.layerUnit}\` layers.json ${c.id} reason`);
  L.push('', `## 화면 글의 '처음' ${words.length}곳 — 뒤 단위 공개 개요 · 팬용 문장 · 판정 이유`, '');
  L.push('이 단위가 먼저 보여 준 것을 "처음"이라 했으면 고친다(공개 개요 · 팬용 문장은 다시 확정).');
  L.push(...words);
  ctx.close();
  finish(L, values.out);
}

function finish(lines, out) {
  const text = `${lines.join('\n')}\n`;
  if (out) {
    fs.writeFileSync(out, text);
    console.log(`썼다: ${out} (${[...text].length.toLocaleString('ko-KR')}자)`);
  } else process.stdout.write(text);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack ?? err);
    process.exit(2);
  });
}
