/**
 * 읽기 순서 스냅숏 — 순서 원본을 옮기거나 고칠 때 파서 결과가 틀어지지 않았는지 본다.
 *
 *   node tools/records/order-snapshot.mjs write                 지금 결과를 기준(tests/fixtures/reading-order.json)으로 쓴다
 *   node tools/records/order-snapshot.mjs check                 지금 결과를 기준과 똑같은지 견준다 — 다르면 차이를 보이고 exit 1
 *   node tools/records/order-snapshot.mjs check --prefix        기준 뒤에 덧붙은 것(신작 N3)은 허용하고 기준 몫만 견준다
 *   node tools/records/order-snapshot.mjs check --files a.md,b.md   ORDER_PATHS 대신 이 파일들로 견준다(옮기기 전 새 파일 확인)
 *
 * 견주는 것: 1회독 항목(지역 자리 옮기기 전 · 뒤) · 1회독 세션 · 2회독 항목 · 2회독 세션 · 2회독 층.
 * 항목은 `세션|상태|키|파트` 한 줄, 차례가 곧 index다. 지역 자리 옮긴 뒤 차례는 --prefix에서 보지 않는다(새 서브퀘스트가 앞 챕터 블록에 끼어든다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORDER_PATHS, READ1_PREFIXES, READ2_PREFIXES, loadOrder, loadReadLayers } from './order.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SNAPSHOT_PATH = path.join(ROOT, 'tests/fixtures/reading-order.json');

const itemLine = (it) => `${it.session}|${it.state}|${it.key}|${it.parts ?? ''}`;
const sessionLine = (s) => `${s.id}|${s.state}|${s.keys.join(' ')}`;

/** 파서 결과를 견줄 수 있는 문자열 목록으로 */
export function snapshotOrder(files = ORDER_PATHS) {
  const raw1 = loadOrder(READ1_PREFIXES, files, { region: false });
  const placed1 = loadOrder(READ1_PREFIXES, files);
  const raw2 = loadOrder(READ2_PREFIXES, files);
  return {
    read1: raw1.items.map(itemLine),
    read1Placed: placed1.items.map(itemLine),
    sessions1: raw1.sessions.map(sessionLine),
    read2: raw2.items.map(itemLine),
    sessions2: raw2.sessions.map(sessionLine),
    layers: [...loadReadLayers(files)].map(([k, l]) => `${k}|${l}`),
  };
}

/**
 * 기준과 지금을 견준다.
 * @param {{ prefix?: boolean }} opt prefix — 기준 몫(앞부분)만 같으면 된다. 층은 기준의 키가 같은 층으로 다 있으면 된다
 * @returns {string[]} 차이 설명(없으면 빈 배열)
 */
export function compareSnapshot(base, cur, { prefix = false } = {}) {
  const out = [];
  for (const name of Object.keys(base)) {
    const a = base[name];
    const b = cur[name] ?? [];
    if (name === 'read1Placed' && prefix) continue;
    if (name === 'layers' && prefix) {
      const have = new Set(b);
      const miss = a.filter((x) => !have.has(x));
      if (miss.length) out.push(`${name}: 기준의 ${miss.length}개가 없거나 층이 다르다 — 처음: ${miss[0]}`);
      continue;
    }
    const n = Math.min(a.length, b.length);
    const i = [...Array(n).keys()].find((k) => a[k] !== b[k]);
    if (i !== undefined) out.push(`${name}[${i}]: 기준 ${a[i]} · 지금 ${b[i]}`);
    else if (b.length < a.length) out.push(`${name}: 지금 ${b.length}개 < 기준 ${a.length}개 — 처음 빠진 것: ${a[b.length]}`);
    else if (!prefix && b.length > a.length) out.push(`${name}: 지금 ${b.length}개 > 기준 ${a.length}개 — 처음 더해진 것: ${b[a.length]}`);
  }
  return out;
}

/** 한 줄에 한 항목인 JSON — 바뀐 곳이 git diff에서 줄로 보이게 */
function writeSnapshot(snap, file = SNAPSHOT_PATH) {
  const body = Object.entries(snap)
    .map(([k, v]) => `  ${JSON.stringify(k)}: [\n${v.map((x) => `    ${JSON.stringify(x)}`).join(',\n')}\n  ]`)
    .join(',\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `{\n${body}\n}\n`);
}

export function loadSnapshot(file = SNAPSHOT_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const counts = (s) => Object.entries(s).map(([k, v]) => `${k} ${v.length}`).join(' · ');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const fi = rest.indexOf('--files');
  const files = fi >= 0 ? rest[fi + 1].split(',').map((f) => path.resolve(ROOT, f)) : ORDER_PATHS;
  const cur = snapshotOrder(files);
  if (cmd === 'write') {
    writeSnapshot(cur);
    console.log(`기준을 썼다 — ${path.relative(ROOT, SNAPSHOT_PATH)}: ${counts(cur)}`);
  } else if (cmd === 'check') {
    const diffs = compareSnapshot(loadSnapshot(), cur, { prefix: rest.includes('--prefix') });
    console.log(`읽은 파일: ${files.map((f) => path.relative(ROOT, f)).join(' + ')}\n지금: ${counts(cur)}`);
    if (diffs.length) {
      console.log(`기준과 다르다 ${diffs.length}곳:\n${diffs.map((d) => `  - ${d}`).join('\n')}`);
      process.exit(1);
    }
    console.log('기준과 같다.');
  } else {
    console.log('쓰는 법: node tools/records/order-snapshot.mjs write | check [--prefix] [--files a.md,b.md]');
    process.exit(2);
  }
}
