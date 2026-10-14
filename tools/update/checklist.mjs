/**
 * N2c — 업데이트 체크리스트 · 검사기. 새 패치의 새 단위마다 해야 할 일의 **원본**이 이 파일의 CHECKLIST다(docs/update.md "체크리스트").
 * 피드백으로 새 기록 종류 · 소급 작업이 생기면 여기에 항목 하나를 더한다(docs/update.md "늘어남 막기") — 문서는 따로 고치지 않는다.
 *
 *   node tools/update/checklist.mjs --list                       체크리스트를 찍는다(단계 · 항목 · 다루는 파일 · 문서 절)
 *   node tools/update/checklist.mjs --patch 2026-09-17           그 패치의 새 단위마다 빠진 칸을 센다
 *   node tools/update/checklist.mjs --patch 2026-09-17 --stage U2   U2까지의 항목만 센다(세션 끝 점검)
 *   node tools/update/checklist.mjs --unit fl:coin_rush_show_down …   패치 없이 단위를 골라 센다(패치 단위 항목은 건너뛴다)
 *
 * 항목 하나 = { id, stage(U1–U4), scope(unit | patch), how, name, files(annotations/ 아래 — 테스트가 대조), doc(문서 절) }.
 *   how: auto — 데이터로 판정한다(빠지면 까닭).
 *        mark — 판단이 드는 일(해당 없음이 정상일 수 있다). 그 단위의 기록이 그 파일에 있으면(근거 씬 · 단위 키) 채움,
 *               없으면 annotations/checklist.json에 표시(`{ patch, unit, item, note }` — note에 무엇을 봤고 왜 없는지)가 있어야 채움.
 * 패치의 새 단위 = 공지 패치(tools/update.mjs)의 원문 있는 단위 가운데 옛 읽기 항목(R · RE · P · M)에 없는 것 + 그 패치의 U 읽기 항목 단위.
 * 범위 밖 단위는 뺀다. 처리됨은 tools/update.mjs가 계산한다 — 빠진 칸이 0이 된 뒤 U 읽기 항목을 [x]로 바꾼다(U4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseOrder } from '../records/order.mjs';
import { fileNameFor } from '../records/model.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ANN = path.join(ROOT, 'annotations');
export const MARKS_PATH = path.join(ANN, 'checklist.json');
const ORDER_PATH = path.join(ANN, 'reading-order.md');

export const STAGES = ['U1', 'U2', 'U3', 'U4'];
export const STAGE_NAMES = { U1: '준비', U2: '읽기', U3: '판정 · 화면 글', U4: '마감' };
/** 옛 읽기 항목 — 여기 든 단위는 업데이트 전에 읽었다 */
export const OLD_PREFIXES = ['R', 'RE', 'P', 'M'];
/** 업데이트 읽기 항목 접두(1회독 · 2회독을 한 항목에서) — order.mjs READ1_PREFIXES · READ2_PREFIXES에도 든다 */
export const UPDATE_PREFIX = 'U';

const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
};
const arr = (x) => (Array.isArray(x) ? x : []);
const isMain = (key) => /^ch\d+$/.test(key);

/** JSON 어디에든 단위 키나 그 단위의 씬 ID가 값으로 나오나 */
export function mentions(json, key, scenes) {
  let hit = false;
  const walk = (v) => {
    if (hit) return;
    if (typeof v === 'string') hit = v === key || scenes.has(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(json);
  return hit;
}

/** 폴더 안 JSON 파일 가운데 단위를 가리키는 것이 있나 */
const dirMentions = (dir, key, scenes) =>
  fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.json') && mentions(readJson(path.join(dir, f)), key, scenes));

/** 기록에서 찾는 근거 — mark 항목이 "그 단위 기록이 있다"로 채워지는 곳 */
const inFile = (name) => (env, u) => mentions(env.json(name), u.key, u.scenes);

/**
 * 체크리스트 — 차례가 곧 할 차례다. 문서 절은 형식 · 기준이 있는 곳.
 * check(env, u) → null(채움) | 문자열(빠진 까닭). mark 항목의 evidence(env, u|patchUnits) → true면 기록이 있어 채움.
 */
export const CHECKLIST = [
  // ── U1 준비 ──
  {
    id: 'source', stage: 'U1', scope: 'unit', how: 'auto', name: '원문 들이기 — hold 줄을 지우고 DB에 단위가 든다',
    files: ['hold.json'], doc: 'docs/update.md "보류"',
    check: (env, u) => (u.held ? 'annotations/hold.json에 아직 있다(들이지 않음)' : !u.inDb ? 'DB에 단위가 없다 — normalize/build' : null),
  },
  {
    id: 'release', stage: 'U1', scope: 'patch', how: 'auto', name: '출시 자리 — 공지 · 손 보정 · 별칭으로 모든 단위를 패치에 넣는다',
    files: ['release-overrides.json'], doc: 'docs/update.md "확인"',
    check: (env) => {
      const why = [];
      if (env.unplaced.length) why.push(`패치에 못 넣은 단위 ${env.unplaced.map((u) => u.key).join(' ')} — tools/notices/aliases.json · release-overrides.json`);
      // hold 줄을 지운 뒤 release-order를 안 돌리면 DB 출시 표에 단위가 없다 — 화면 자리 · 연대기 테스트가 앞 단위 자리를 물려받는다(N2e)
      const undated = (env.undated ?? []);
      if (undated.length) why.push(`DB 출시 표(releases)에 날짜가 없는 단위 ${undated.join(' ')} — node tools/notices/release-order.mjs 뒤 DB 다시 만들기`);
      return why.length ? why.join(' · ') : null;
    },
  },
  {
    id: 'regions', stage: 'U1', scope: 'patch', how: 'auto', name: '서브퀘스트 · 유실물 지역(근거 · 확신도)',
    files: ['subquest-regions.json', 'relic-regions.json'], doc: 'docs/decisions.md #9',
    check: (env) => {
      const miss = env.inScopeUnits
        .filter((u) => (u.key.startsWith('sub:') || u.key.startsWith('relic:')) && !env.regions.has(u.key))
        .flatMap((u) => u.scenes.filter((s) => !env.regions.has(s)));
      return miss.length ? `지역 없는 ${miss.join(' ')}` : null;
    },
  },
  {
    id: 'fl-map', stage: 'U1', scope: 'patch', how: 'auto', name: '금서고 이벤트 매핑(블라링크 키 · 없으면 null)',
    files: ['forbidden-library-events.json'], doc: 'docs/update.md "확인"',
    check: (env) => {
      const miss = env.flEventFiles.filter((k) => !(k in env.flMap));
      return miss.length ? `매핑 없는 금서고 이벤트 파일 ${miss.join(' ')}` : null;
    },
  },
  {
    id: 'order', stage: 'U1', scope: 'patch', how: 'auto', name: '읽기 항목 — 새 단위를 U 항목으로(annotations/reading-order.md "업데이트")',
    files: ['reading-order.md'], doc: 'docs/update.md "읽기 항목"',
    check: (env) => {
      const miss = [...env.patchUnits.filter((u) => !u.updateItem).map((u) => u.key), ...env.unordered];
      const late = env.lateProblems ?? []; // 늦게 들어온 단위의 출시 자리(N2d)
      return miss.length || late.length ? [miss.length ? `U 항목에 없는 단위 ${[...new Set(miss)].join(' ')}` : null, ...late].filter(Boolean).join(' · ') : null;
    },
  },
  // ── U2 읽기 ──
  {
    id: 'read1', stage: 'U2', scope: 'unit', how: 'auto', name: '1회독 층 read1/<키>.json — 줄거리 · F · Q · 사건 · 시점(at) · 대상 · 넘길 것',
    files: ['read1/'], doc: 'docs/annotations.md "1회독 기록 쓰는 법"',
    check: (env, u) => (env.read1(u.key).length ? null : '1회독 파일이 없다'),
  },
  {
    id: 'dictionary', stage: 'U2', scope: 'unit', how: 'auto', name: '새 이름 사전 — 1회독 targets 칸(새 대상이 없으면 [])',
    files: ['dictionary/'], doc: 'docs/annotations.md "새 대상과 사전"',
    check: (env, u) => {
      const fs1 = env.read1(u.key);
      return !fs1.length || fs1.some((f) => Array.isArray(f.data.targets)) ? null : '1회독 파일에 targets 칸이 없다 — 새 이름을 사전에 넣고 적는다(없으면 [])';
    },
  },
  {
    id: 'speakers', stage: 'U2', scope: 'patch', how: 'auto', name: '새 이름표 분류 — 범위 안 미분류 이름표 0(speakers.json 갈래)',
    files: ['dictionary/speakers.json'], doc: 'docs/schema.md "이름표 분류"',
    check: (env) => (env.unclassifiedSpeakers?.length ? `갈래 없는 이름표 ${env.unclassifiedSpeakers.join(' · ')} — annotations/dictionary/speakers.json` : null),
  },
  {
    id: 'precision', stage: 'U2', scope: 'patch', how: 'auto', name: '인물 이름 표본 정밀도 — 걸린 줄이 있는 새 인물 이름을 재서 mention-precision.json에',
    files: ['dictionary/mention-precision.json'], doc: 'docs/schema.md "언급 DB"',
    check: (env) => (env.unmeasuredNames?.length ? `표본 정밀도를 안 잰 인물 이름 ${env.unmeasuredNames.join(' · ')} — node tools/query.mjs sample <이름>` : null),
  },
  {
    id: 'layer', stage: 'U2', scope: 'unit', how: 'auto', name: '중요도 판정 — 1회독 뒤 records.mjs layers --add → 판정 카드 → 확정(층이 2회독 깊이를 정한다)',
    files: ['layers.json'], doc: 'docs/importance.md', when: (env, u) => !isMain(u.key),
    check: (env, u) => (env.layerOf(u.key)?.status === '확정' ? null : env.layerOf(u.key) ? '층 판정이 확정이 아니다' : '층 판정이 없다'),
  },
  {
    id: 'read2', stage: 'U2', scope: 'unit', how: 'auto', name: '2회독 층 read2/<키>.json — I · E(points) · D · U, 같은 세션에',
    files: ['read2/'], doc: 'docs/annotations.md "2회독 기록"',
    check: (env, u) => (env.read2(u.key).length ? null : '2회독 파일이 없다'),
  },
  {
    id: 'threads', stage: 'U2', scope: 'unit', how: 'auto', name: '떡밥 줄기 — 새 의문을 줄기에',
    files: ['threads.json'], doc: 'docs/annotations.md "떡밥 줄기"',
    check: (env, u) => {
      const miss = env.ds.candidates
        .filter((c) => c.unit === u.key && c.kind === 'question' && c.role === 'def' && c.status !== '기각' && !env.threadQuestions.has(c.id))
        .map((c) => c.id);
      return miss.length ? `줄기에 안 든 의문 ${miss.join(' ')}` : null;
    },
  },
  {
    id: 'identity', stage: 'U2', scope: 'unit', how: 'mark', name: '정체 연결 L — 같은 사람 · 다른 사람이 드러났나(앞 기록은 고치지 않는다)',
    files: ['dictionary/'], doc: 'docs/annotations.md "같은 사람 · 다른 사람"',
    evidence: (env, u) => mentions(env.json('dictionary/people.json'), u.key, u.scenes),
  },
  {
    id: 'late', stage: 'U2', scope: 'unit', how: 'mark', name: '늦게 들어온 단위 — 먼저 읽은 뒤 단위 기록에서 이 단위가 먼저 드러낸 것을 옮김(late.mjs 후보)',
    files: [], doc: 'docs/update.md "늦게 들어온 단위"', when: (env, u) => Boolean(env.isLate?.(u.key)),
  },
  {
    id: 'foreshadow', stage: 'U2', scope: 'unit', how: 'mark', name: '복선 거슬러 찾기 — 새로 드러난 것을 앞 단위에서(검색 · 언급 DB)',
    files: [], doc: 'docs/annotations.md "1회독 기록 쓰는 법"',
  },
  {
    id: 'chronology', stage: 'U2', scope: 'unit', how: 'mark', name: '연대기 좁힘 — 새 시점이 시대 기준점을 좁히나',
    files: ['chronology.json'], doc: 'docs/annotations.md "좁힘"', evidence: inFile('chronology.json'),
  },
  {
    id: 'links', stage: 'U2', scope: 'unit', how: 'mark', name: '수동 엣지 — 기록에서 안 나오는 관계(연작의 다음 편 등)',
    files: ['links.json'], doc: 'docs/schema.md "수동 엣지"', evidence: inFile('links.json'),
  },
  // ── U3 판정 · 화면 글 ──
  {
    id: 'rejudge', stage: 'U3', scope: 'unit', how: 'auto', name: '앞 단위 다시 판정 — 회수 · 다시 드러남 · 뒤집음의 앞 단위(안 바뀌어도 set으로 이력, 세션 N3)',
    files: ['layers.json'], doc: 'docs/annotations.md "중요도 판정"',
    check: (env, u) => {
      const since = env.read1(u.key).map((f) => f.data.date).filter(Boolean).sort()[0] ?? '';
      const miss = env.fromUnits(u.key).filter((k) => !arr(env.layerOf(k)?.reviews).some((r) => /^N3/.test(r?.session ?? '') && (r?.date ?? '') >= since));
      return miss.length ? `다시 판정(검토 세션 N3)이 없는 앞 단위 ${miss.join(' ')}` : null;
    },
  },
  {
    id: 'spine', stage: 'U3', scope: 'patch', how: 'mark', name: '척추 — 주년 · 하프 · 신년 등 척추 문인가',
    files: ['spine.json'], doc: 'docs/annotations.md "척추"', evidence: inFile('spine.json'),
  },
  {
    id: 'leads', stage: 'U3', scope: 'patch', how: 'mark', name: '주역 명단',
    files: ['leads.json'], doc: 'docs/annotations.md "주역 명단"', evidence: inFile('leads.json'),
  },
  {
    id: 'majors', stage: 'U3', scope: 'patch', how: 'mark', name: '주요 인물 — majors.mjs',
    files: ['majors.json'], doc: 'docs/annotations.md "주요 인물"', evidence: inFile('majors.json'),
  },
  {
    id: 'closures', stage: 'U3', scope: 'patch', how: 'mark', name: '빌드업 마무리 — closures --add, 새 사슬',
    files: ['closures.json'], doc: 'docs/annotations.md "마무리 기록"', evidence: inFile('closures.json'),
  },
  {
    id: 'affiliations', stage: 'U3', scope: 'unit', how: 'mark', name: '소속 T',
    files: ['affiliations.json'], doc: 'docs/annotations.md "소속 기록"', evidence: inFile('affiliations.json'),
  },
  {
    id: 'addresses', stage: 'U3', scope: 'unit', how: 'mark', name: '호칭 A',
    files: ['addresses.json'], doc: 'docs/annotations.md "호칭 기록"', evidence: inFile('addresses.json'),
  },
  {
    id: 'portraits', stage: 'U3', scope: 'unit', how: 'mark', name: '초상 · 모습 코드(NPC) · 새 스쿼드 마크',
    files: ['portraits.json'], doc: 'docs/views.md "공개 규칙 — 그림"', evidence: inFile('portraits.json'),
  },
  {
    id: 'april-fools', stage: 'U3', scope: 'patch', how: 'mark', name: '만우절 단위 표시',
    files: ['april-fools.json'], doc: 'docs/decisions.md #11', when: (env) => /만우절/.test(env.patch?.title ?? ''), evidence: inFile('april-fools.json'),
  },
  {
    id: 'synopsis', stage: 'U3', scope: 'unit', how: 'auto', name: '공개 개요 synopsis/ — 확정',
    files: ['synopsis/'], doc: 'docs/annotations.md "공개 개요"',
    check: (env, u) => {
      const d = readJson(path.join(ANN, 'synopsis', fileNameFor(u.key)));
      return d?.status === '확정' ? null : d ? '공개 개요가 확정이 아니다' : '공개 개요가 없다';
    },
  },
  {
    id: 'blurbs', stage: 'U3', scope: 'unit', how: 'auto', name: '팬용 문장 blurbs/ — why 확정(낡은 앞 칸은 --refresh)',
    files: ['blurbs/'], doc: 'docs/annotations.md "팬용 문장"', when: (env, u) => !isMain(u.key) && !env.spineUnits.has(u.key),
    check: (env, u) => {
      const d = readJson(path.join(ANN, 'blurbs', fileNameFor(u.key)));
      return d?.why?.status === '확정' ? null : d ? '팬용 문장 why가 확정이 아니다' : '팬용 문장이 없다';
    },
  },
  {
    id: 'versions', stage: 'U3', scope: 'patch', how: 'mark', name: '판 versions/ — 떡밥 · 사전 · 곁 판(refs), versions.mjs check 낡은 판 0',
    files: ['versions/'], doc: 'docs/annotations.md "시점별 판"', evidence: (env, u) => dirMentions(path.join(ANN, 'versions'), u.key, u.scenes),
  },
  // ── U4 마감 ──
  {
    id: 'regen', stage: 'U4', scope: 'patch', how: 'mark', name: '다시 뽑기 · 점검 — operations "지시 세션" 4 · spoiler-check --readers base,skip,skip-all · node --test',
    files: ['checklist.json'], doc: 'docs/operations.md "지시 세션"',
  },
];

/** annotations/ 안 기록이 아닌 것 — 체크리스트에 안 든다(테스트가 대조한다) */
export const NOT_RECORDS = {
  'README.md': '설명 문서',
  'aliases.json': '외부 참고 표 표기 잇기(T2-8) — 분석 · 신작과 상관없다',
  'scope.json': '분석 범위 규칙 — 새 단위는 규칙대로 들어간다(규칙을 바꿀 때만 고친다)',
  'watch.json': '2회독 볼 거리(B1b) — 끝난 2회독의 작업 메모, 신작은 같은 세션에 2회독한다',
};

const byId = new Map(CHECKLIST.map((it) => [it.id, it]));
export const itemById = (id) => byId.get(id) ?? null;

/** 체크리스트 목록 — docs/update.md "체크리스트"가 이 출력을 가리킨다 */
export function renderList() {
  const L = [];
  for (const st of STAGES) {
    L.push(`${st} ${STAGE_NAMES[st]}`);
    for (const it of CHECKLIST.filter((x) => x.stage === st)) {
      const files = it.files.length ? it.files.join(' · ') : '—';
      L.push(`  ${it.id.padEnd(13)} ${it.scope === 'unit' ? '단위' : '패치'} ${it.how === 'auto' ? '자동' : '표시'}  ${it.name}`);
      L.push(`  ${''.padEnd(13)} 파일 ${files} · ${it.doc}`);
    }
  }
  return L.join('\n');
}

/** U 읽기 항목 — 줄의 ` — ` 뒤에 `패치 YYYY-MM-DD`를 단다 */
export function parseUpdateItems(text) {
  const { items } = parseOrder(text, [UPDATE_PREFIX]);
  const patchOf = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(new RegExp(`^- \\[.\\] \\*\\*(${UPDATE_PREFIX}\\d+[a-z]?)[^*]*\\*\\*.* — .*?패치 (\\d{4}-\\d{2}-\\d{2})`));
    if (m) patchOf.set(m[1], m[2]);
  }
  return items.map((it) => ({ ...it, patch: patchOf.get(it.session) ?? null }));
}

/** 표시(annotations/checklist.json)를 고른다 — 패치 · 단위 · 항목이 맞는 것 */
export const findMark = (marks, { patch, unit, item }) =>
  marks.find((m) => m.item === item && (m.unit ?? null) === (unit ?? null) && (patch == null || m.patch === patch));

/**
 * 판정 — 단위 × 항목, 패치 × 항목. 입력은 모두 env에(테스트는 가짜 env를 준다).
 * @returns {{ rows: {item:string, unit:string|null, state:'채움'|'빠짐'|'해당 없음', why:string}[], missing:number }}
 */
export function evaluate(env, { stage = 'U4', patchLevel = true } = {}) {
  const upto = STAGES.indexOf(stage);
  const rows = [];
  const push = (it, unit, state, why = '') => rows.push({ item: it.id, stage: it.stage, unit, state, why });
  for (const it of CHECKLIST) {
    if (STAGES.indexOf(it.stage) > upto) continue;
    if (it.scope === 'patch' && !patchLevel) continue;
    const targets = it.scope === 'unit' ? env.patchUnits : [null];
    for (const u of targets) {
      if (it.when && !it.when(env, u)) {
        push(it, u?.key ?? null, '해당 없음');
        continue;
      }
      if (it.how === 'auto') {
        const why = it.check(env, u);
        push(it, u?.key ?? null, why ? '빠짐' : '채움', why ?? '');
        continue;
      }
      const ev = it.evidence && (u ? it.evidence(env, u) : env.patchUnits.some((x) => it.evidence(env, x)));
      if (ev) {
        push(it, u?.key ?? null, '채움', '기록 있음');
        continue;
      }
      const m = findMark(env.marks, { patch: env.patch?.day ?? null, unit: u?.key ?? null, item: it.id });
      push(it, u?.key ?? null, m ? '채움' : '빠짐', m ? `표시: ${m.note}` : '기록도 표시(annotations/checklist.json)도 없다');
    }
  }
  return { rows, missing: rows.filter((r) => r.state === '빠짐').length };
}

/** 받아 둔 것 · 기록 · DB에서 env를 만든다 */
export async function loadEnv({ patchDay = null, units = null, today }) {
  const { buildPatches, loadInputs } = await import('../update.mjs');
  const { loadDataset } = await import('../records/model.mjs');
  const { openContext } = await import('../records/context.mjs');
  const { loadRegions } = await import('../records/order.mjs');
  const ctx = await openContext();
  const ds = loadDataset();
  const orderText = fs.existsSync(ORDER_PATH) ? fs.readFileSync(ORDER_PATH, 'utf8') : '';
  const oldKeys = new Set(parseOrder(orderText, OLD_PREFIXES).items.map((it) => it.key));
  const updateItems = parseUpdateItems(orderText);
  const allOrdered = new Set([...oldKeys, ...updateItems.map((it) => it.key)]);
  const { patches, unplaced } = buildPatches(loadInputs({ today }));
  const { anchorProblems, lateAnchors, unitRanks } = await import('./late.mjs');

  let patch = null;
  let keys;
  if (patchDay) {
    patch = patches.find((p) => p.day === patchDay);
    if (!patch) throw new Error(`패치 ${patchDay}가 없다 — data/release/updates.md의 날짜를 쓴다`);
    keys = patch.units
      .filter((u) => u.key && u.kind !== 'sub' && (u.state === '있음' || u.state === '들이지 않음'))
      .map((u) => u.key.replace(/^held:/, ''))
      .filter((k) => !oldKeys.has(k));
    for (const it of updateItems) if (it.patch === patchDay) keys.push(it.key);
  } else keys = [...units];

  const hold = readJson(path.join(ANN, 'hold.json'), {});
  const heldIds = new Set();
  for (const k of Object.keys(hold)) {
    if (k.startsWith('_')) continue;
    const slash = k.indexOf('/');
    if (slash > 0) heldIds.add(`${{ event_stories: 'fl', side_stories: 'side', sub_quests: 'sub', lost_relics: 'relic', event_lost_relics: 'erelic' }[k.slice(0, slash)]}:${k.slice(slash + 1).replace(/\.txt$/, '')}`);
    else heldIds.add(k);
  }
  const patchUnits = [];
  for (const key of [...new Set(keys)]) {
    const r = ctx.resolve(key);
    if (r && !r.inScope) continue;
    patchUnits.push({ key, inDb: Boolean(r), held: heldIds.has(key), scenes: new Set(r?.scenes ?? []), updateItem: updateItems.find((it) => it.key === key) ?? null });
  }
  // 범위 안 · 본문 있는 단위(블라링크 껍데기만 있고 금서고가 본문인 이벤트는 뺀다) — 씬은 본문 있는 것만
  const inScopeUnits = [];
  for (const u of ctx.units) {
    const r = ctx.resolve(u.key);
    const scenes = (r?.scenes ?? []).filter((s) => ctx.story(s)?.has_text && ctx.story(s)?.in_scope === 1);
    if (r?.inScope && scenes.length) inScopeUnits.push({ key: u.key, scenes });
  }
  const jsonCache = new Map();
  const json = (name) => {
    if (!jsonCache.has(name)) jsonCache.set(name, readJson(path.join(ANN, name)));
    return jsonCache.get(name);
  };
  const threadQuestions = new Set(arr(ds.threads?.data?.threads).filter((t) => t?.status !== '기각').flatMap((t) => arr(t?.questions)));
  const defUnit = new Map(ds.candidates.filter((c) => c.role === 'def' && c.unit && c.id).map((c) => [c.id, c.unit]));
  const layers = new Map();
  for (const c of ds.candidates) if (c.kind === 'layer' && c.status !== '기각' && c.layerUnit) layers.set(c.layerUnit, c);
  const { spineUnits } = await import('../records/model.mjs');
  const spineSet = spineUnits(ds);
  const manifest = readJson(path.join(ROOT, 'data/raw/forbidden-library/script-manifest.json'), []);
  const flMap = readJson(path.join(ANN, 'forbidden-library-events.json'), {});
  const flEventFiles = [...new Set(manifest.filter((m) => m.categoryKey === 'event_stories').map((m) => `event_stories/${m.mainChapterFile}`))]
    .filter((k) => fs.existsSync(path.join(ROOT, 'data/raw/forbidden-library/scripts', k)));
  // DB에서 — 출시 표 날짜(출시 자리), 범위 안 미분류 이름표, 표본 정밀도를 안 잰 인물 이름(N2e — 테스트만 잡던 것)
  const q = (sql, ...p) => ctx.db.prepare(sql).all(...p);
  const dated = new Set(q('SELECT key FROM releases WHERE date IS NOT NULL').map((r) => r.key));
  const undated = patchUnits.filter((u) => u.inDb && /^(ch\d+$|side:|event_|fl:|char:)/.test(u.key) && !dated.has(u.key)).map((u) => u.key);
  const unclassifiedSpeakers = q('SELECT name FROM speakers WHERE lines_in_scope > 0 AND class IS NULL ORDER BY lines_in_scope DESC').map((r) => r.name);
  const { loadPrecision } = await import('../normalize/mentions.mjs');
  const measured = new Set(arr(loadPrecision().names).map((e) => `${e.target}\t${e.name}`));
  const unmeasuredNames = q("SELECT target_id, name FROM target_names WHERE target_id LIKE 'person:%' AND lines_in_scope > 0")
    .filter((r) => !measured.has(`${r.target_id}\t${r.name}`)).map((r) => r.name);
  ctx.close();
  // 늦게 들어온 단위(N2d) — 이 패치의 U 항목(단위로 고르면 그 단위가 든 U 항목)만
  const lateRows = lateAnchors(orderText, unitRanks(patches)).filter((r) => (patch ? r.patch === patch.day : r.keys.some((k) => keys.includes(k))));
  return {
    patch, patchUnits, undated, unclassifiedSpeakers, unmeasuredNames,
    lateProblems: anchorProblems(lateRows),
    isLate: (key) => lateRows.some((r) => r.expected && r.keys.includes(key)), unplaced, ds, spineUnits: spineSet, json, threadQuestions, flMap, flEventFiles, inScopeUnits,
    regions: loadRegions(),
    // 순서에 없는 단위 — 단위 키나 그 씬(서브퀘스트 · 엘리베이터는 씬 키로 읽는다)이 항목에 하나도 없다
    unordered: inScopeUnits.filter((u) => !allOrdered.has(u.key) && !u.scenes.some((s) => allOrdered.has(s))).map((u) => u.key),
    marks: arr(readJson(MARKS_PATH, {})?.marks),
    read1: (key) => ds.files.filter((f) => f.data?.unit === key),
    read2: (key) => (ds.files2 ?? []).filter((f) => f.data?.unit === key),
    layerOf: (key) => layers.get(key) ?? null,
    /** 이 단위의 사건(회수 · 다시 드러남 · 뒤집음)이 가리키는 앞 단위 */
    fromUnits: (key) => [...new Set(ds.candidates
      .filter((c) => c.unit === key && c.role === 'event' && c.status !== '기각' && c.parent)
      .map((c) => defUnit.get(c.parent))
      .filter((k) => k && k !== key && layers.has(k)))], // 판정이 있는 앞 단위만(메인 챕터는 판정이 없다)
  };
}

export function renderResult(env, result, { stage }) {
  const L = [];
  const head = env.patch ? `패치 ${env.patch.day} ${env.patch.title}` : '고른 단위';
  L.push(`${head} — 새 단위 ${env.patchUnits.length} · ${stage}까지 · 빠진 칸 ${result.missing}`);
  if (!env.patchUnits.length) L.push('  새 단위가 없다(옛 읽기 항목에 다 있거나 범위 밖).');
  const missing = result.rows.filter((r) => r.state === '빠짐');
  for (const unit of [null, ...env.patchUnits.map((u) => u.key)]) {
    const rs = missing.filter((r) => r.unit === unit);
    if (!rs.length) continue;
    L.push(`\n${unit ?? '(패치)'}`);
    for (const r of rs) L.push(`  ✗ ${r.stage} ${r.item} — ${r.why}`);
  }
  if (!missing.length) L.push('빠진 칸 없음.');
  return L.join('\n');
}

async function main() {
  const { values } = parseArgs({
    options: { list: { type: 'boolean' }, patch: { type: 'string' }, unit: { type: 'string', multiple: true }, stage: { type: 'string', default: 'U4' }, today: { type: 'string' } },
  });
  if (values.list || (!values.patch && !values.unit)) {
    console.log(renderList());
    return;
  }
  if (!STAGES.includes(values.stage)) throw new Error(`--stage는 ${STAGES.join(' · ')}`);
  const { kstDay } = await import('../notices/kdate.mjs');
  const env = await loadEnv({ patchDay: values.patch ?? null, units: values.unit ?? [], today: values.today ?? kstDay(new Date()) });
  const result = evaluate(env, { stage: values.stage, patchLevel: Boolean(env.patch) });
  console.log(renderResult(env, result, { stage: values.stage }));
  process.exitCode = result.missing ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack ?? err);
    process.exit(2);
  });
}
