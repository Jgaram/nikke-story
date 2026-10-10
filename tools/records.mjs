/**
 * 1회독 · 2회독 기록 도구 — 기록 파일 만들기 · 검증기 · 리뷰 도구 · 진행률 · 인계 파일. 형식과 규칙은 docs/annotations.md.
 *
 *   node tools/records.mjs new ch00                   기록 파일 뼈대 — 1회독 기록이 없으면 annotations/read1/ch00.json,
 *                                                     있으면 2회독 annotations/read2/ch00.json. 세션은 읽기 순서(docs/history/reading.md R · P/M)에서
 *   node tools/records.mjs next [F12]                 다음 번호 (사실 F · 의문 Q · 시점 S · 되짚기 V · 정체 연결 L, 사건 F12-2, 2회독 I · E · D · U, 수동 엣지 Y)
 *   node tools/records.mjs find 기억                  사실 · 의문 · 시점 문장에서 찾기 — 이미 있는 사실인지 볼 때
 *   node tools/records.mjs check                      검증기 — 오류가 있으면 종료 코드 1. 인계 파일이 오래됐는지도 본다
 *   node tools/records.mjs handoff                    인계 파일을 다시 만든다 (1회독 annotations/read1/HANDOFF.md · handoff/, 2회독 annotations/read2/HANDOFF.md · handoff/)
 *   node tools/records.mjs review [ch00|R01|F12|사실 …] 후보를 근거 줄 · 앞뒤 문맥과 함께 (기본: 상태가 후보인 것 전부)
 *   node tools/records.mjs set F3 F5 Q2-2 확정 --note "…"   채팅으로 받은 결정 반영 (확정 · 기각 · 보류 · 후보)
 *   node tools/records.mjs set F12 확정 --confidence 확실 --evidence "d_main_01_01_s#12,20-25" --session P1   2회독 바로잡기
 *   node tools/records.mjs progress [--all] [--read2] 단위별 진행률 (읽음 · 후보 · 검토) — 2회독 파일이 있으면 2회독도
 *   node tools/records.mjs layers [단위 키 …] [--add]   층 표 (annotations/layers.json) · 단위의 판정과 판정 입력(2회독 포함, --read1이면 1회독만) · 판정 없는 단위에 시안 더하기
 *   node tools/records.mjs leads [인물 …] [--add]      주역 명단 (annotations/leads.json, X3f) · 한 사람의 메인 챕터별 신호 · 명단에 없는 초안을 후보로 더하기
 *   node tools/records.mjs closures [O… | 단위 …] [--add] [--all]   마무리 기록 (annotations/closures.json, X3f-1d) · 사슬 초안 · 기록 없는 사슬을 후보로 더하기
 *
 * 공통: --example = --dir tests/fixtures/read1 (예시 — 실제 기록과 섞이지 않는다) · --dir <기록 디렉터리>
 * 해석이 필요한 기록은 후보다. 확정 · 기각은 사용자가 하고 이 도구(set)가 적는다 (CLAUDE.md "해석이 필요한 기록은 후보로만").
 * 원문은 저작물이다. 리뷰 출력(근거 줄)을 레포 밖에 게시하지 않는다 (CLAUDE.md "저작물 취급").
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { checkDataset, formatProblems } from './records/check.mjs';
import { openContext } from './records/context.mjs';
import { buildHandoff, staleHandoff, writeHandoff } from './records/handoff.mjs';
import { buildHandoff2 } from './records/handoff2.mjs';
import { formatJson } from './records/json.mjs';
import {
  CLOSURES_PATH, DECISIONS, EXAMPLE_DIR, GRADES, KINDS, LAYERS, LAYERS_PATH, LEADS_PATH, READ1_DIR, READ2_DIR, ROOT, compareIds, displayPath, fileNameFor, isRecord, loadDataset, nextIds, today,
  spineUnits,
} from './records/model.mjs';
import { computeLayers, layerKind } from './records/layers.mjs';
import { emptySignal, layerSignals, renderSignals } from './views/layers.mjs';
import { buildLeads, renderPerson } from './views/leads.mjs';
import { buildClosures, draftClosure, renderChain } from './views/closures.mjs';
import { buildRead1Views } from './views/read1.mjs';
import { read2Edges, unknownSpeakerProgress } from './records/read2.mjs';
import { READ2_PREFIXES, findItem, kindOfKey, loadOrder } from './records/order.mjs';
import {
  applyDecision, filterStatus, progressReport, progressReport2, reviewPages, select, sortCandidates, statusLabel, tally, writeDecisions,
} from './records/review.mjs';

const USAGE = `1회독 · 2회독 기록 도구 (tools/records.mjs) — 형식 · 규칙: docs/annotations.md
  new <키> [--session R01|M03] [--parts 4-6]   기록 파일 뼈대 — 1회독 기록이 없으면 annotations/read1/<키>.json, 있으면 2회독 annotations/read2/<키>.json
  next [F12|Q3]                           다음 번호
  find <낱말>                             사실 · 의문 · 시점 · 요약에서 찾기
  check                                   검증기 (오류 → 종료 코드 1) + 인계 파일이 최신인지
  handoff                                 인계 파일 다시 만들기 (1회독 annotations/read1/ · 2회독 annotations/read2/)
  review [ID|범위 F3..F9|단위 키|세션|종류 …] [--status 후보|확정|기각|보류|전부] [--kind-order] [--context N] [--brief] [--page N]
  set <ID|범위|단위 키|세션 …> <확정|기각|보류|후보> [--note 메모] [--session M03] [--text 고친 문장] [--date YYYY-MM-DD]
      판정(K)은 --grade 필수|보강|참고|독립 · --basis <기록 ID> · --reason <이유> · --asof YYYY-MM-DD(기준 시점) · --layer 1|2|3 (규칙 층을 뒤집거나 읽은 층으로 묶을 때 — --note에 까닭)
        · --from ch38(메인이 이 단위를 딛기 시작하는 챕터 — 필수 · 보강) · --before 참고|독립(그 앞 자리의 등급) — 빈 값("")은 지운다
      주역(Z)은 --from ch19(주역이 되는 챕터) · --arcs "ch20-ch29 ch44-ch48"(아크 범위, 전체면 --arcs 전체) · --origin <단위 키>|메인(원점 — 그 판정은 필수)
      마무리(O)는 --type 연작|갈등|관계|성장 · --end <끝난 단위> · --closing "D400 F12"(닫는 기록) · --built "D1 D2 ch20"(쌓인 자리) · --about "person:A person:B"(셋 이상의 관계면 셋 다) · --text 문장
      합류(H)는 --members "O1 O2"(함께 끝난 마무리) · --title 결판 이름 · --end <함께 끝난 단위> · --text 문장
      판정은 다른 --session이 다시 보면 바뀐 게 없어도 검토 기록이 남는다(다시 판정 이력)
      2회독 바로잡기: --confidence 확실|추정 · --evidence "씬#12,20-25 씬2#3" (후보 하나, 고치기 전 값은 검토 기록에 남는다)
  progress [--all] [--read2]              단위별 진행률 (2회독 파일이 있거나 --read2면 2회독도)
  layers [단위 키 …] [--add] [--read1] [--summary]   층 표 · 단위의 판정과 판정 입력(메인 연결 · 줄기 · about, 2회독 떡밥 · 줄기 인물 변화 · 생활상,
                                          줄기에 안 묶인 세계 · 메인 인물 사실 · 주역 사연 · 빌드업 마무리 · 감정 재료)과 시안 · --summary는 1회독 요약까지 · 판정 없는 단위에 시안(후보) 더하기
  leads [인물 …] [--add]                  주역 명단(X3f) · 한 사람의 메인 챕터별 신호(말한 줄 · 이름이 나온 씬 · 뼈대 줄기 · 인물 변화) · 명단에 없는 초안을 후보로 더하기
  closures [O… | H… | 단위 …] [--add] [--all]  마무리 기록(X3f-1d) · 사슬(초안 — 연작 · 인물 변화 관계 · 성장)과 그 기록 · 합류 기록(H — X3f-1g) · 기록 없는 사슬을 후보로 더하기 · --all은 사슬 전부
공통: --example(예시 tests/fixtures/read1) · --dir <디렉터리> · --out <인계 파일 디렉터리>(handoff · check, 기본 = 기록 디렉터리 — 2회독 인계는 그 안 read2/)`;

const { values: opt, positionals } = parseArgs({
  options: {
    example: { type: 'boolean' },
    dir: { type: 'string' },
    out: { type: 'string' },
    session: { type: 'string' },
    parts: { type: 'string' },
    status: { type: 'string' },
    context: { type: 'string' },
    page: { type: 'string' },
    max: { type: 'string' },
    brief: { type: 'boolean' },
    'kind-order': { type: 'boolean' },
    note: { type: 'string' },
    by: { type: 'string' },
    text: { type: 'string' },
    date: { type: 'string' },
    all: { type: 'boolean' },
    add: { type: 'boolean' },
    grade: { type: 'string' },
    layer: { type: 'string' },
    confidence: { type: 'string' },
    evidence: { type: 'string' },
    read2: { type: 'boolean' },
    read1: { type: 'boolean' },
    summary: { type: 'boolean' },
    spine: { type: 'boolean' },
    basis: { type: 'string' },
    reason: { type: 'string' },
    asof: { type: 'string' },
    from: { type: 'string' },
    before: { type: 'string' },
    origin: { type: 'string' },
    arcs: { type: 'string' },
    records: { type: 'string' },
    type: { type: 'string' },
    end: { type: 'string' },
    closing: { type: 'string' },
    built: { type: 'string' },
    about: { type: 'string' },
    members: { type: 'string' },
    title: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

const fail = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const [cmd, ...args] = positionals;
if (opt.help || !cmd) {
  console.log(USAGE);
  process.exit(cmd ? 0 : 1);
}
const COMMANDS = ['new', 'next', 'find', 'check', 'handoff', 'review', 'set', 'progress', 'layers', 'leads', 'closures'];
if (!COMMANDS.includes(cmd)) fail(`모르는 명령 ${cmd}\n\n${USAGE}`);

const DIR = path.resolve(ROOT, opt.example ? EXAMPLE_DIR : opt.dir ?? READ1_DIR);
const isReal = DIR === path.resolve(READ1_DIR);
/** 인계 파일을 쓰는 곳 — 실제 기록이면 기록 디렉터리, 예시면 --out을 줄 때만. 2회독 인계는 실제면 annotations/read2, --out이면 그 안 read2/ */
const OUT = opt.out ? path.resolve(ROOT, opt.out) : isReal ? DIR : null;
const OUT2 = opt.out ? path.join(path.resolve(ROOT, opt.out), 'read2') : isReal ? READ2_DIR : null;
const rel = displayPath;

const order = loadOrder();
const order2 = loadOrder(READ2_PREFIXES);
let ds = loadDataset({ dir: DIR });
const needsDb = !['next', 'find'].includes(cmd);
const ctx = needsDb ? await openContext().catch((err) => fail(err.message)) : null;

const exitWith = (code) => {
  ctx?.close();
  process.exit(code);
};

const validate = () => checkDataset(ds, ctx, order, { order2 });

/** 인계 파일을 다시 쓴다(1회독 · 2회독) — 부르는 쪽이 검증 오류가 없음을 확인한 뒤에 부른다. 예시 데이터는 --out을 줄 때만 */
function refreshHandoff() {
  if (!OUT) return null;
  const built = buildHandoff(ds, ctx, order);
  const built2 = buildHandoff2(ds, ctx, order, order2);
  const written = [...writeHandoff(built, OUT).map((w) => path.join(OUT, w)), ...writeHandoff(built2, OUT2).map((w) => path.join(OUT2, w))];
  console.log(written.length ? `인계 파일 ${written.length}개 고침: ${written.slice(0, 12).map(rel).join(' · ')}${written.length > 12 ? ' …' : ''}` : '인계 파일: 바뀐 것 없음');
  for (const w of [...built.warnings, ...built2.warnings]) console.log(`⚠ ${w}`);
  return { built, built2 };
}

switch (cmd) {
  case 'new': {
    const key = args[0] ?? fail('new <단위 키> — 예: node tools/records.mjs new ch00');
    const r = ctx.resolve(key) ?? fail(`없는 단위 · 씬 키 ${key} — read.mjs 키를 쓴다 (node tools/read.mjs list)`);
    if (!r.inScope) fail(`분석 범위 밖 ${key}`);
    const parts = opt.parts ?? null;
    if (parts !== null && !/^\d+-\d+$/.test(parts)) fail('--parts는 "4-6"처럼');
    const EVIDENCE_HINT = '근거 예: "evidence": [{ "scene": "씬 ID", "lines": [12, "20-25"] }] — 줄 하나는 숫자, 범위만 문자열. 줄 번호는 read.mjs --num의 #N';
    // 1회독 기록이 있는 단위는 2회독 파일을 만든다 (파트는 2회독이 다르게 묶기도 해서 단위 키로 본다)
    if (ds.files.some((f) => f.data?.unit === key)) {
      if (!ds.dir2) fail(`2회독 기록 디렉터리가 없다 — 실제 기록(annotations/read1) · 예시(--example)에서만 2회독 파일을 만든다`);
      const item2 = findItem(order2, key, parts);
      const session = opt.session ?? item2?.session ?? fail(`2회독 읽기 순서(P · M)에서 ${key}${parts ? ` 파트 ${parts}` : ''}를 못 찾았다 — --session M03처럼 준다`);
      const file = path.join(ds.dir2, fileNameFor(key, parts));
      if (fs.existsSync(file)) fail(`이미 있다: ${rel(file)} — 한 단위에 2회독 파일 하나. 이어 쓰려면 그 파일을 고친다`);
      const data = {
        _comment: `2회독 — 한 기록 = 한 씬. ${EVIDENCE_HINT}. 1회독 바로잡기는 annotations/read1/의 이 단위 파일에 항목마다 "session": "${session}"을 달아 적는다(docs/annotations.md "2회독 기록")`,
        unit: key,
      };
      if (parts) data.parts = parts;
      Object.assign(data, { session, by: 'claude', date: today(), mentions: [], echoes: [], changes: [], life: [] });
      fs.mkdirSync(ds.dir2, { recursive: true });
      fs.writeFileSync(file, formatJson(data));
      const n = nextIds(ds);
      console.log(`만듦: ${rel(file)} — 2회독 ${session} · ${r.title}`);
      console.log(`다음 번호: 암시 언급 ${n.I} · 떡밥 ${n.E} · 인물 변화 ${n.D} · 생활상 ${n.U} | 바로잡기 사실 ${n.F} · 의문 ${n.Q} · 시점 ${n.S}`);
      console.log(`근거 줄 번호는 node tools/read.mjs ${key}${parts ? ` --part ${parts.split('-')[0]}` : ''} --num 의 #N. 다 쓰면 check → handoff → 커밋.`);
      break;
    }
    const item = findItem(order, key, parts);
    const session = opt.session ?? item?.session ?? fail(`읽기 순서에서 ${key}${parts ? ` 파트 ${parts}` : ''}를 못 찾았다 — --session R01처럼 준다`);
    const file = path.join(DIR, fileNameFor(key, parts));
    if (fs.existsSync(file)) fail(`이미 있다: ${rel(file)} — 한 단위에 파일 하나. 이어 쓰려면 그 파일을 고친다`);
    const data = { _comment: EVIDENCE_HINT, unit: key };
    if (parts) data.parts = parts;
    Object.assign(data, { session, by: 'claude', date: today(), summary: '' });
    // 파트를 나눠 읽는 단위는 어느 씬까지 읽을지 파트가 정하므로 자리를 넣지 않는다 — 읽은 씬만 적는다
    const sceneSlots = r.scenes.length > 1 && !parts;
    if (sceneSlots) data.scenes = r.scenes.map((scene) => ({ scene, text: '' }));
    Object.assign(data, { facts: [], questions: [], events: [], times: [], targets: [], revisit: [] });
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file, formatJson(data));
    const n = nextIds(ds);
    const slotNote = sceneSlots ? ` · 씬 ${r.scenes.length}개 한 줄 요약 자리(안 쓰면 scenes를 지운다)` : parts ? ' · 파트 단위라 씬 한 줄 요약은 읽은 씬만 scenes에 더한다' : '';
    console.log(`만듦: ${rel(file)} — ${session} · ${r.title}${slotNote}`);
    console.log(`다음 번호: 사실 ${n.F} · 의문 ${n.Q} · 시점 ${n.S} · 되짚기 ${n.V} · 정체 연결 ${n.L}`);
    console.log(`근거 줄 번호는 node tools/read.mjs ${key}${parts ? ` --part ${parts.split('-')[0]}` : ''} --num 의 #N. 다 쓰면 check → handoff → 커밋.`);
    break;
  }

  case 'next': {
    const n = nextIds(ds);
    if (args.length) {
      for (const a of args) {
        if (!/^[FQ]\d+$/.test(a)) fail(`next ${a}: 사실 · 의문 ID(F12 · Q3)를 준다`);
        if (!ds.candidates.some((c) => c.id === a)) console.log(`${a}: 아직 없는 사실 · 의문이다`);
        console.log(`${a}의 다음 사건: ${n.eventOf(a)}`);
      }
    } else {
      console.log(`다음 번호: 사실 ${n.F} · 의문 ${n.Q} · 시점 ${n.S} · 되짚기 ${n.V} · 정체 연결 ${n.L} · 줄기 ${n.J} · 줄기 관계 ${n.G} · 층 판정 ${n.K} · 주역 ${n.Z} · 척추 ${n.B} · 마무리 ${n.O} (${rel(DIR)})`);
      console.log(`2회독: 암시 언급 ${n.I} · 떡밥 ${n.E} · 인물 변화 ${n.D} · 생활상 ${n.U} · 수동 엣지 ${n.Y} · 볼 거리 ${n.W} · 소속 ${n.T}`);
    }
    break;
  }

  case 'find': {
    const q = args.join(' ').trim() || fail('find <낱말> [--spine]');
    // --spine: 척추(메인 챕터 + annotations/spine.json 확정 단위)의 기록만 — 판정에서 "척추가 스스로 말했는지"를 훑을 때(docs/importance.md 3절)
    const spineSet = spineUnits(ds);
    const inSpine = (u) => Boolean(u) && (kindOfKey(u) === '메인' || spineSet.has(u));
    const hits = sortCandidates(ds.candidates.filter((c) => c.id && (!opt.spine || inSpine(c.unit)) && [c.text, c.reason, c.note].some((s) => typeof s === 'string' && s.includes(q))), order);
    const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
    const cut = (t, n = 100) => (t.length > n ? `${t.slice(0, n)}…` : t);
    for (const c of hits) {
      const ev = c.role === 'event' ? ` ${c.act} ${c.parent}${c.obj?.answer ? ` → ${c.obj.answer}` : ''}` : '';
      const text = c.text ?? (c.role === 'event' ? byId.get(c.parent)?.text ?? '' : '');
      console.log(`${c.id} [${statusLabel(c)}] ${KINDS[c.kind]?.label}${c.kind === 'echo' ? ` ${c.act ?? ''}` : ''}${ev} ${text} — ${c.unit ?? c.file}`);
      // 2회독 떡밥(E)은 가리킨 기록(points)을 같이 보인다 — 척추 연결을 확인할 때 한 번 더 찾지 않게(X3f-1c)
      if (c.kind === 'echo') {
        for (const pid of Array.isArray(c.obj?.points) ? c.obj.points : []) {
          const pc = byId.get(pid);
          const pt = pc ? (pc.text ?? (pc.role === 'event' ? `${pc.act} ${pc.parent}: ${byId.get(pc.parent)?.text ?? ''}` : pc.obj?.title ?? '')) : '(없는 기록)';
          console.log(`    → ${pid} ${cut(pt)}${pc?.unit ? ` — ${pc.unit}` : ''}`);
        }
      }
    }
    const sums = ds.files.filter((f) => typeof f.data?.summary === 'string' && f.data.summary.includes(q) && (!opt.spine || inSpine(f.data.unit)));
    for (const f of sums) console.log(`요약 ${f.data.unit}: …${f.data.summary.slice(Math.max(0, f.data.summary.indexOf(q) - 40), f.data.summary.indexOf(q) + 60)}…`);
    if (!hits.length && !sums.length) console.log(`'${q}' — 없음${opt.spine ? '(척추 안)' : ''}`);
    break;
  }

  case 'check': {
    const res = validate();
    const t = tally(ds.candidates.filter((c) => c.id && isRecord(c)));
    console.log(`검증: ${rel(DIR)} — 기록 파일 ${ds.files.length} · 후보 ${t.all}(사실 ${t.fact} · 의문 ${t.question} · 사건 ${t.event} · 시점 ${t.time}) · ` +
      `새 대상 ${ds.targets.length} · 되짚기 ${ds.revisits.length} · 정체 연결 ${ds.candidates.filter((c) => c.people).length}${ds.people ? `(${ds.people.name})` : ''}` +
      `${ds.threads ? ` · 줄기 ${tally(ds.candidates.filter((c) => c.kind === 'thread')).all} · 줄기 관계 ${tally(ds.candidates.filter((c) => c.kind === 'relation')).all}(${ds.threads.name})` : ''}` +
      `${ds.layers ? ` · 층 판정 ${tally(ds.candidates.filter((c) => c.kind === 'layer')).all}(${ds.layers.name})` : ''}` +
      `${ds.closures ? ` · 마무리 ${tally(ds.candidates.filter((c) => c.kind === 'closure')).all}(${ds.closures.name})` : ''}`);
    if (ds.watch) console.log(`2회독 볼 거리: ${ds.watchItems.length}(${ds.watch.name})`);
    if (ds.files2.length || ds.links) {
      const t2 = tally(ds.candidates.filter((c) => c.read2 && c.id));
      const fixes = ds.candidates.filter((c) => c.fix && c.id).length;
      console.log(`2회독: 파일 ${ds.files2.length} · 기록 ${t2.all}(암시 언급 ${t2.mention} · 떡밥 ${t2.echo} · 인물 변화 ${t2.change} · 생활상 ${t2.life}) · 바로잡기로 더한 1회독 항목 ${fixes}` +
        `${ds.links ? ` · 수동 엣지 ${tally(ds.candidates.filter((c) => c.kind === 'edge')).all}(${ds.links.name})` : ''}`);
    }
    for (const l of formatProblems(res)) console.log(l);
    console.log(`오류 ${res.errors.length} · 경고 ${res.warnings.length}`);
    if (OUT && !res.errors.length) {
      const built = buildHandoff(ds, ctx, order);
      const built2 = buildHandoff2(ds, ctx, order, order2);
      const stale = [...staleHandoff(built, OUT).map((x) => `read1 ${x}`), ...staleHandoff(built2, OUT2).map((x) => `read2 ${x}`)];
      console.log(stale.length ? `⚠ 인계 파일이 오래됐다 (${stale.slice(0, 5).join(' · ')}${stale.length > 5 ? ' …' : ''}) → node tools/records.mjs handoff`
        : `인계 파일: 최신 · 먼저 읽을 것 1회독 ${built.firstTotal.toLocaleString('ko-KR')}자 · 2회독 ${built2.firstTotal.toLocaleString('ko-KR')}자`);
      for (const w of [...built.warnings, ...built2.warnings]) console.log(`⚠ ${w}`);
    }
    exitWith(res.errors.length ? 1 : 0);
    break;
  }

  case 'handoff': {
    if (!OUT) fail('예시 데이터의 인계 파일은 --out <디렉터리>로 받는다(레포 안 실제 인계 파일과 섞이지 않게)');
    const res = validate();
    if (res.errors.length) {
      for (const l of formatProblems({ errors: res.errors, warnings: [] })) console.log(l);
      fail(`오류 ${res.errors.length} — 고친 뒤 다시 만든다 (node tools/records.mjs check)`);
    }
    const { built, built2 } = refreshHandoff();
    console.log(`1회독 먼저 읽을 것: ${built.firstNames.join(' · ')} — ${built.firstTotal.toLocaleString('ko-KR')}자`);
    console.log(`2회독 먼저 읽을 것(${built2.next?.session ?? '순서 끝'}): ${built2.firstNames.join(' · ')} — ${built2.firstTotal.toLocaleString('ko-KR')}자 (${rel(OUT2)})`);
    break;
  }

  case 'review': {
    const { picked, explicit, unknown } = select(ds, args);
    if (unknown.length) fail(`모르는 것: ${unknown.join(' · ')} — 후보 ID(F12 · Q3-2 · S1 · L2 · I3 · E1 · D2 · U4 · Y1) · 범위(F3..F9) · 기록이 있는 단위 키 · 세션(R01 · P1) · 종류(${Object.values(KINDS).map((k) => k.label).join(' · ')})`);
    const status = opt.status ?? (explicit ? '전부' : '후보');
    let list;
    try {
      list = filterStatus(picked, status);
    } catch (err) {
      fail(err.message);
    }
    const t = tally(list);
    const context = Number(opt.context ?? 2);
    const max = Number(opt.max ?? 20_000);
    const pages = list.length ? reviewPages(list, ds, ctx, order, { context, brief: opt.brief, byKind: opt['kind-order'], max }) : [];
    const want = Number(opt.page ?? 1);
    if (pages.length && (!Number.isInteger(want) || want < 1 || want > pages.length)) fail(`쪽은 1~${pages.length}`);
    const scope = args.length ? args.join(' ') : '전부';
    const t2 = t.mention + t.echo + t.change + t.life + t.edge ? ` · 2회독 암시 언급 ${t.mention} · 떡밥 ${t.echo} · 인물 변화 ${t.change} · 생활상 ${t.life}${t.edge ? ` · 수동 엣지 ${t.edge}` : ''}` : '';
    console.log(`# 후보 리뷰 — ${scope} · 상태 ${status} · ${list.length}건 (사실 ${t.fact} · 의문 ${t.question} · 사건 ${t.event} · 시점 ${t.time} · 정체 ${t.link}${t2})${pages.length > 1 ? ` · 쪽 ${want}/${pages.length}` : ''}${opt.example ? ' · 예시 데이터' : ''}`);
    console.log('반영: node tools/records.mjs set <ID …> 확정|기각|보류 [--note "…"] — 범위 F3..F9, 단위 키 · 세션(그 안의 후보 전부)도 된다');
    if (!opt.brief) console.log('표기: `▶` 근거 줄 · `#N` 줄 번호(lines.seq) · 나머지는 read.mjs 표기. 결정 기록은 `검토:` 줄');
    if (!list.length) {
      console.log('\n고른 후보가 없다');
      break;
    }
    console.log(`\n${pages[want - 1]}`);
    if (want < pages.length) console.log(`\n— 쪽 ${want}/${pages.length} 끝. 다음: node tools/records.mjs ${cmd} ${args.join(' ')}${opt.status ? ` --status ${opt.status}` : ''}${opt.example ? ' --example' : ''} --page ${want + 1}`.replace(/\s+/g, ' '));
    break;
  }

  case 'set': {
    const decision = args.at(-1);
    if (!DECISIONS.includes(decision)) fail(`set <ID …> <${DECISIONS.join('|')}> — 마지막 낱말이 결정이어야 한다`);
    const tokens = args.slice(0, -1);
    if (!tokens.length) fail('어느 후보인지 준다 — ID · 범위 F3..F9 · 단위 키 · 세션');
    const { picked, explicit, unknown } = select(ds, tokens);
    if (unknown.length) fail(`모르는 것: ${unknown.join(' · ')} — 아무것도 바꾸지 않았다`);
    if (!picked.length) fail('고른 후보가 없다 — 아무것도 바꾸지 않았다');
    if (opt.date && !/^\d{4}-\d{2}-\d{2}$/.test(opt.date)) fail('--date는 YYYY-MM-DD');
    let result;
    try {
      result = applyDecision(sortCandidates(picked, order), decision, {
        by: opt.by ?? 'claude', date: opt.date ?? today(), session: opt.session ?? null, note: opt.note ?? null,
        text: opt.text ?? null, grade: opt.grade ?? null, layer: opt.layer !== undefined ? Number(opt.layer) : null,
        basis: opt.basis ?? null, reason: opt.reason ?? null, asof: opt.asof ?? null,
        confidence: opt.confidence ?? null, evidence: opt.evidence ?? null, from: opt.from ?? null, before: opt.before ?? null, origin: opt.origin ?? null,
        arcs: opt.arcs ?? null, records: opt.records ?? null, type: opt.type ?? null, end: opt.end ?? null, closing: opt.closing ?? null, built: opt.built ?? null,
        about: opt.about ?? null, members: opt.members ?? null, title: opt.title ?? null, explicit,
      });
    } catch (err) {
      fail(err.message);
    }
    const written = writeDecisions(ds, result.perFile);
    const byTo = new Map();
    for (const x of result.changed) (byTo.get(x.to) ?? byTo.set(x.to, []).get(x.to)).push(x.c.id);
    const idList = (ids) => (ids.length > 40 ? `${ids.slice(0, 10).join(' ')} … ${ids.slice(-5).join(' ')}` : ids.join(' '));
    for (const [to, ids] of byTo) console.log(`${to} ${ids.length}: ${idList(ids.sort(compareIds))}`);
    if (result.skipped.length) console.log(`건너뜀 ${result.skipped.length}: ${result.skipped.slice(0, 20).map((x) => `${x.c.id}(${x.why})`).join(' ')}${result.skipped.length > 20 ? ' …' : ''}`);
    if (written.length) console.log(`고친 파일: ${written.join(' · ')}`);
    // 다시 읽어 검증 — 기각한 후보를 가리키는 기록이 남았는지
    ds = loadDataset({ dir: DIR });
    const res = validate();
    if (res.errors.length) {
      for (const l of formatProblems({ errors: res.errors, warnings: [] })) console.log(l);
      console.log(`✗ 오류 ${res.errors.length} — 기각한 후보를 가리키는 기록은 같이 기각하거나(set <ID> 기각) 고친다`);
      exitWith(1);
    }
    if (written.length) refreshHandoff();
    break;
  }

  case 'progress': {
    console.log(progressReport(ds, ctx, order, { all: opt.all }));
    if (ds.files2.length || opt.read2) console.log(`\n${progressReport2(ds, order2, { all: opt.all, unknown: unknownSpeakerProgress(ds, ctx) })}`);
    if (opt.example) console.log('(예시 데이터 — 실제 진행률이 아니다)');
    break;
  }

  case 'layers': {
    const views = buildRead1Views(ds, ctx, order);
    // 2회독 기록이 있으면 판정 입력에 얹는다(X3a) — --read1이면 1회독만(B0b-2와 같다)
    // ⑦ 빌드업 마무리(X3f-1d) — 2회독 기록을 얹을 때만(--read1이면 B0b-2와 같다)
    const withRead2 = ds.files2.length && !opt.read1;
    const signals = layerSignals(ds, views, withRead2 ? read2Edges(ds, ctx, order) : null, { closures: withRead2 ? buildClosures(ds, ctx, order) : null });
    const signalOf = (unit) => signals.get(unit) ?? emptySignal(unit, layerKind(unit));
    if (args.length) {
      const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
      const lay0 = computeLayers(ds, order);
      for (const u of args) {
        if (!order.items.some((it) => it.key === u)) fail(`읽기 순서에 없는 단위 ${u}`);
        // --summary: 1회독 요약(파트로 나눈 단위는 파트마다) — 생활상이 없는 단위의 참고 문턱을 1회독으로 볼 때(X3f)
        const summary = opt.summary ? ds.files.filter((f) => f.data?.unit === u && f.data.summary).map((f) => `${f.data.parts ? `[파트 ${f.data.parts}] ` : ''}${f.data.summary}`).join(' / ') || '(없음)' : null;
        console.log(renderSignals(signalOf(u), byId, { judgment: lay0.byUnit.get(u)?.judgment ?? null, summary, spine: Boolean(lay0.byUnit.get(u)?.spine) }));
      }
      break;
    }
    let lay = computeLayers(ds, order);
    if (opt.add) {
      if (!lay.missing.length) {
        console.log('판정 없는 메인 밖 단위가 없다');
        break;
      }
      const file = ds.layers?.path ?? (isReal ? LAYERS_PATH : path.join(DIR, '_layers.json'));
      const data = ds.layers?.data ?? { session: opt.session ?? 'B0b-2', by: 'claude', date: today(), units: [] };
      if (!Array.isArray(data.units)) data.units = [];
      let k = Number(nextIds(ds).K.slice(1));
      for (const unit of lay.missing) {
        const d = signalOf(unit).draft;
        data.units.push({ id: `K${k++}`, unit, grade: d.grade, ...(d.basis ? { basis: d.basis } : {}), reason: `(시안) ${d.reason}`, confidence: d.confidence, status: '후보' });
      }
      fs.writeFileSync(file, formatJson(data));
      console.log(`${rel(file)}에 시안 ${lay.missing.length}건을 더했다 (후보 — 단위마다 가장 묵직한 한 건을 골라 고친 뒤 set … 확정)`);
      ds = loadDataset({ dir: DIR });
      lay = computeLayers(ds, order);
    }
    const chars = new Map(views.units.map((u) => [u.unit, u.chars]));
    const KIND_ROWS = ['메인', '서브퀘스트', '유실물', '그 밖', '사이드', '이벤트', '이벤트 유실물', '호감도'];
    const kinds = [...new Set([...KIND_ROWS, ...lay.units.map((u) => u.kind)])].filter((k) => lay.units.some((u) => u.kind === k));
    const cell = (us) => (us.length ? `${us.length} (${(us.reduce((a, u) => a + (chars.get(u.key) ?? 0), 0) / 10000).toFixed(1)}만 자)` : '');
    const t = tally(ds.candidates.filter((c) => c.kind === 'layer'));
    console.log(`# 2회독 층 — ${ds.layers?.name ?? '(판정 파일 없음)'} · 판정 ${t.all}(확정 ${t.확정} · 기각 ${t.기각} · 남음 ${t.후보})${lay.missing.length ? ` · 판정 없음 ${lay.missing.length}` : ''}`);
    console.log('');
    console.log(`| 종류 | ${LAYERS.map((n) => `${n}층`).join(' | ')} | 층 없음 |`);
    console.log(`|---|${LAYERS.map(() => '---:').join('|')}|---:|`);
    for (const k of kinds) {
      const us = lay.units.filter((u) => u.kind === k);
      console.log(`| ${k} | ${LAYERS.map((n) => cell(us.filter((u) => u.layer === n))).join(' | ')} | ${cell(us.filter((u) => !u.layer))} |`);
    }
    console.log(`| 합 | ${LAYERS.map((n) => cell(lay.units.filter((u) => u.layer === n))).join(' | ')} | ${cell(lay.units.filter((u) => !u.layer))} |`);
    const grades = GRADES.map((g) => `${g} ${lay.units.filter((u) => u.grade === g).length}`).join(' · ');
    console.log(`\n메인 밖 등급: ${grades} — 단위별: node tools/records.mjs review 층 --status 전부 --brief · 판정 입력: node tools/records.mjs layers <단위 키>`);
    break;
  }

  case 'leads': {
    let v = buildLeads(ds, ctx, order);
    if (args.length) {
      for (const a of args) {
        const p = a.startsWith('person:') ? a : `person:${a}`;
        const x = v.persons.get(p);
        if (!x) fail(`메인 챕터에 나온 적 없는 인물 ${p}`);
        console.log(renderPerson(x, v.chapters, { judgment: v.leads.find((c) => c.obj?.person === p && c.status !== '기각') ?? v.leads.find((c) => c.obj?.person === p) ?? null }));
      }
      break;
    }
    if (opt.add) {
      if (!v.missing.length) {
        console.log('명단에 없는 초안이 없다');
        break;
      }
      const file = ds.leads?.path ?? (isReal ? LEADS_PATH : path.join(DIR, '_leads.json'));
      const data = ds.leads?.data ?? { session: opt.session ?? 'X3f-1', by: 'claude', date: today(), leads: [] };
      if (!Array.isArray(data.leads)) data.leads = [];
      let z = Number(nextIds(ds).Z.slice(1));
      for (const p of v.missing) {
        const d = v.persons.get(p).draft;
        data.leads.push({ id: `Z${z++}`, person: p, from: d.from, ...(d.arcs.length ? { arcs: d.arcs } : {}), ...(d.records.length ? { records: d.records } : {}),
          reason: `(초안) ${d.reason}`, confidence: d.confidence, status: '후보' });
      }
      fs.writeFileSync(file, formatJson(data));
      console.log(`${rel(file)}에 초안 ${v.missing.length}명을 더했다 (후보 — 근거를 보고 set Z… 확정 · 기각, --from · --arcs로 고친다)`);
      ds = loadDataset({ dir: DIR });
      v = buildLeads(ds, ctx, order);
    }
    const live = v.leads.filter((c) => c.status !== '기각');
    console.log(`# 주역 명단 — ${ds.leads?.name ?? '(명단 파일 없음)'} · ${live.length}명(확정 ${live.filter((c) => c.status === '확정').length}) · 기각 ${v.leads.length - live.length} · 초안 후보 ${v.drafts.length}${v.missing.length ? ` · 명단에 없는 초안 ${v.missing.length}(--add)` : ''}`);
    console.log('');
    for (const c of live.sort((a, b) => v.chapters.indexOf(a.obj?.from) - v.chapters.indexOf(b.obj?.from) || compareIds(a.id, b.id))) {
      const o = c.obj ?? {};
      const why = v.roles?.get(o.person) ?? '';
      console.log(`${c.id} [${c.status} · ${c.confidence ?? '?'}] ${o.person} ${o.from}부터 · ${Array.isArray(o.arcs) && o.arcs.length ? `아크 ${o.arcs.join(' · ')}` : '전체'} · 원점 ${o.origin ?? '(아직)'}${why ? ` — ${why}` : ''}`);
    }
    console.log('\n한 사람: node tools/records.mjs leads <인물> · 표: data/views/leads/report.md (node tools/views/leads.mjs)');
    break;
  }

  case 'closures': {
    // 마무리 기록(X3f-1d) — 사슬(초안)과 기록. 형식 docs/annotations.md "마무리 기록", 규칙 tools/views/closures.mjs 머리말
    let { v } = buildClosures(ds, ctx, order);
    const title = (u) => ctx.resolve(u)?.title ?? '';
    // 합류 기록(X3f-1g) 한 줄 + 묶인 마무리 문장
    const mergeLines = (m) => [
      `## ${m.c.id} 합류 [${m.c.status}] ${m.title} — 끝 ${m.end} · 마무리 ${m.members.length}(${m.types.join(' · ')})${m.spineBuilt ? ' · 척추가 쌓음' : ''}`, `  ${m.c.obj?.text ?? ''}`,
      ...m.members.map((id) => {
        const x = v.closures.find((y) => y.c.id === id);
        return `  ${id} ${x ? `${x.type} [${x.c.status}] ${x.c.obj?.text ?? ''}` : '(없는 기록)'}`;
      }), ''];
    if (args.length) {
      for (const a of args) {
        const merge = v.merges.find((m) => m.c.id === a);
        if (merge) {
          console.log(mergeLines(merge).join('\n'));
          continue;
        }
        const rec = v.closures.filter((x) => x.c.id === a);
        const chains = rec.length ? v.chains.filter((ch) => ch.key === rec[0].chain) : v.chains.filter((ch) => ch.end === a || ch.key.includes(a));
        const ends = rec.length ? rec : v.closures.filter((x) => x.end === a);
        if (!chains.length && !ends.length) fail(`${a}: 마무리 기록 ID도, 사슬이 끝나는 단위도, 사슬 키의 낱말도 아니다`);
        for (const ch of chains) console.log(renderChain(ch, { title }), '\n');
        for (const x of ends.filter((x) => !chains.some((ch) => ch.key === x.chain))) {
          const o = x.c.obj ?? {};
          console.log(`## ${x.c.id} ${x.type} [${x.c.status}] — 끝 ${x.end} · 쌓인 자리 ${x.builtUnits.join(' · ')} · ${x.span}칸${x.spineBuilt ? ' · 척추가 쌓음' : ''}\n  ${o.text ?? ''}\n`);
        }
        const hs = new Set([...rec.flatMap((x) => v.mergeOf.get(x.c.id) ?? []), ...v.merges.filter((m) => m.end === a && m.c.status !== '기각').map((m) => m.c.id)]);
        for (const h of hs) console.log(rec.length ? `합류: ${h} ${v.merges.find((m) => m.c.id === h)?.title ?? ''} (closures ${h})\n` : mergeLines(v.merges.find((m) => m.c.id === h)).join('\n'));
      }
      break;
    }
    if (opt.add) {
      if (!v.missing.length) {
        console.log('기록 없는 사슬이 없다');
        break;
      }
      const file = ds.closures?.path ?? (isReal ? CLOSURES_PATH : path.join(DIR, '_closures.json'));
      const data = ds.closures?.data ?? { session: opt.session ?? 'X3f-1d', by: 'claude', date: today(), closures: [] };
      if (!Array.isArray(data.closures)) data.closures = [];
      let n = Number(nextIds(ds).O.slice(1));
      // 척추가 쌓은 사슬을 앞 번호로(판정 입력에 드는 것부터 확정한다), 그 안은 끝난 자리 순
      for (const ch of [...v.missing.filter((x) => x.spineBuilt), ...v.missing.filter((x) => !x.spineBuilt)]) data.closures.push(draftClosure(ch, `O${n++}`));
      fs.writeFileSync(file, formatJson(data));
      console.log(`${rel(file)}에 사슬 ${v.missing.length}개를 후보로 더했다 — 사슬마다 끝이 있는지 보고 set O… 확정 --text "…" [--type 갈등 · --end · --closing · --built] 또는 기각`);
      ds = loadDataset({ dir: DIR });
      ({ v } = buildClosures(ds, ctx, order));
    }
    const t = (s) => v.closures.filter((x) => x.c.status === s).length;
    console.log(`# 마무리 기록 — ${ds.closures?.name ?? '(파일 없음)'} · ${v.closures.length}(확정 ${t('확정')} · 기각 ${t('기각')} · 후보 ${t('후보')}) · 사슬 ${v.chains.length}${v.missing.length ? ` · 기록 없는 사슬 ${v.missing.length}(--add)` : ''}`);
    const types = [...new Set(v.chains.map((ch) => ch.type))];
    for (const ty of types) {
      const cs = v.chains.filter((ch) => ch.type === ty);
      console.log(`- ${ty} ${cs.length} — 척추가 쌓고 척추 밖에서 끝남 ${cs.filter((ch) => ch.spineBuilt && !ch.endSpine).length} · 척추가 쌓고 척추에서 끝남 ${cs.filter((ch) => ch.spineBuilt && ch.endSpine).length} · 척추 밖에서 쌓임 ${cs.filter((ch) => !ch.spineBuilt).length}`);
    }
    if (v.merges.length) {
      const live = v.merges.filter((m) => m.c.status !== '기각');
      console.log(`- 합류 ${v.merges.length}(확정 ${v.merges.filter((m) => m.c.status === '확정').length}) — 묶인 마무리 ${new Set(live.flatMap((m) => m.members)).size}: ${live.map((m) => `${m.c.id} ${m.title}(${m.members.length})`).join(' · ')}`);
    }
    if (opt.all) {
      console.log('');
      for (const ch of v.chains) console.log(`${ch.closure ? `${ch.closure.id} [${ch.closure.status}]` : '(기록 없음)'} ${ch.key} — 끝 ${ch.end} · ${ch.span}칸${ch.spineBuilt ? ' · 척추가 쌓음' : ''}${ch.endSpine ? ' · 끝 척추' : ''}`);
    }
    console.log('\n사슬 · 기록 보기: node tools/records.mjs closures <O… | H… | 끝 단위 | 사슬 낱말> · 표: data/views/closures/report.md (node tools/views/closures.mjs)');
    break;
  }
}
exitWith(0);

