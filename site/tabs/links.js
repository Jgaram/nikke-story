/**
 * 탭 2 연결(W3) — 화면 2 "스토리 간 연결"(docs/views.md 2절, 규칙 docs/schema.md "관계선").
 * 스토리 하나를 가운데 두고 앞뒤로 이어진 스토리를 보는 것이 기본(이웃)이고, 거르개로 줄인 전체(전체)와 연작 사슬(연작)도 본다.
 * 선을 누르면 그 선을 만든 분석 메모와 근거 줄(씬 → 씬)이 아래에 나온다.
 *
 * 쓰는 JSON
 *   links.json(이 탭 — tools/site/export/links.mjs): edges[3,370](스토리 쌍 × 선 종류 — from → to는 읽는 순서 · count 연결된 씬 수 · strength 1–3 · origin ·
 *     records · targets · threads · weak 약한 연결 수 · note) · chains[](메인 밖 다음 편 사슬) · targets[](중심 항목 — common = 자주 나오는 인물 · 항목)
 *   links-scenes.json(씬 엣지 6,257 — 선 하나의 근거. 선을 누를 때 처음 받는다): type · s · from/fl · to/tl · fu/tu · record · act · point · target · fb/tb · note
 *   공용(idx): units(제목 · 종류 · 출시 시점 · 범위) · scenes(씬 제목) · ticks · threads · targets, 분석 메모 문장은 처음 근거를 보일 때 idx.withRecords()로 받는다
 *
 * URL 파라미터(p.*) — 기본값이면 URL에서 뺀다
 *   m    ego(이웃, 기본) | net(전체) | chain(연작)
 *   c    이웃 보기의 가운데 스토리 키. 없으면 지금 거르개 · 컷오프에서 가장 많이 이어진 스토리(탭 안을 만지면 그 스토리를 c에 못박는다, 다른 탭에서 sel=unit:키를 들고 들어오면 그 스토리)
 *   n    이웃 보기에서 고른 앞/뒤 스토리 키(아래 근거의 대상). 없으면 가장 센 연결의 스토리
 *   pr   전체 보기에서 고른 선 "from>to"
 *   lt   고른 선 종류(sequel · setup_payoff · callback · reversal · character · keyword), 없으면 그 쌍의 전부
 *   ty   보일 선 종류(쉼표) 또는 all. 없으면 이웃 보기는 전부, 전체 보기는 이야기 연결 넷(다음 편 · 떡밥→회수 · 다시 언급 · 뒤집힘)
 *   s    연결 강도 1(전부) | 2(보통 이상, 기본) | 3(강함)
 *   tg   인물 · 항목 ID(예 person:라피). 이 항목이 걸린 선만
 *   th   떡밥 ID(예 J1). 이 떡밥에 걸린 선만
 *   kd   보일 스토리 종류(쉼표). 없으면 전부. 이웃 보기에서는 가운데 말고 이웃에만 건다
 *   nn   전체 보기에서 그릴 스토리 수 150(기본 80)
 *   mm   1이면 전체 보기에 메인끼리의 선도 그린다(기본은 뺀다 — 메인 챕터 사이 선이 전체의 4분의 1이라 나머지가 가려진다)
 *
 * 그리는 규칙
 *   스토리 쌍 하나 + 선 종류 하나 = 선 하나(links.json edges 한 줄). 방향은 늘 읽는 순서(출시순 한 줄)라 왼쪽 → 오른쪽이다.
 *   색 = 선 종류(다음 편 파랑 · 떡밥→회수 주황 · 다시 언급 청록 · 뒤집힘 빨강 — dataviz 검증 팔레트 순서 [빨강 파랑 주황 청록], 같은 인물 · 같은 소재는 회색 실선 · 점선),
 *   굵기 = 연결된 씬 수(세기 2 이상만 볼 때는 약한 연결 weak를 뺀 수), 점선(긴 점선) = 확정 전 후보. 이 탭에는 스토리 종류 색이 없다 —
 *   종류는 글자로 쓰고 전체 보기에서는 가로 띠(행)가 종류다(색 두 갈래가 겹치지 않게).
 *   자주 나오는 인물 · 항목(links.json targets.common)만 나눈 연결은 세기 1이라 기본(세기 2 이상)에서 빠진다. 그 항목을 인물 · 항목 거르개로 고르면 풀린다.
 *   컷오프(t) 뒤 스토리와 범위(layers) 밖 스토리의 선은 숨기고 개수만 보인다("스포일러로 가린 N"). 컷오프 뒤 스토리를 가운데로 둘 수 없다.
 *   이웃 보기: 가운데 카드 + 앞(먼저 나온)·뒤(이어지는) 스토리 카드, 선은 카드 사이 곡선. 한쪽 8장씩 연결이 센 순(이야기 연결 → 세기 → 씬 수)으로 뽑아 출시순으로 놓고 "더 보기".
 *   전체 보기: 행 = 스토리 종류, 가로 = 읽는 순서, 점 = 스토리(크기 = 이어진 스토리 수). 이야기 연결(다음 편 · 떡밥→회수 · 다시 언급 · 뒤집힘)만 기본, 많이 이어진 상위 80개만 그리고 "150개까지"로 넓힌다(상한 150).
 *   연작: links.json chains. 컷오프 뒤 편은 가리고 첫 편이 가려진 사슬은 개수만 센다.
 *   카드를 누르면 sel=unit:키(리더 패널)와 그 쌍의 씬 → 씬 근거(분석 메모 문장 · 근거 줄), 카드의 "중심으로" 단추 또는 더블클릭이면 그 스토리가 가운데가 된다.
 *   가운데 카드는 스크롤을 따라 붙고(sticky) 선의 가운데 쪽 끝이 따라 움직인다. 640px 아래에서는 앞 → 가운데 → 뒤를 세로 한 줄로 접고 선 대신 선 종류 단추로 본다.
 *   근거 목록: 선 종류별 구역, 씬마다 "앞 씬 → 뒤 씬(씬 제목 · 씬 ID · 줄)" + 분석 메모 문장 + 가리키는 의문 · 사실 + 답. 세기 설정으로 가린 약한 연결은 개수와 "약한 연결까지 보기".
 *
 * 리더 패널 "관계선" 칸 잇는 법(공용 reader.js — 부모가 한다): data.load('links-scenes') → 씬 ID로 e.from === id || e.to === id,
 *   스토리 키로 e.fu === key || e.tu === key(같은 스토리 안은 fu === tu). 선 종류 e.type, 근거 줄 e.fl · e.tl, 분석 메모 e.record. 이 탭 열기: #tab=links&p.c=<스토리 키>.
 */
export const meta = { id: 'links', title: '연결', blurb: '스토리 사이의 연결 — 이웃 · 전체 · 연작' };

/** 이 탭 말(fmt에 없는 것만). 용어 → 사람 말 대응은 docs 2차 지시 기준 */
const LABELS = {
  mode: { ego: '이웃', net: '전체', chain: '연작' },
  modeHelp: { ego: '스토리 하나를 가운데 두고 앞뒤로 이어진 스토리를 본다', net: '거르개로 줄인 전체 연결을 읽는 순서 위에 본다', chain: '다음 편으로 이어지는 연작 사슬' },
  center: '중심 스토리',
  centerPh: '스토리 이름으로 찾기',
  filters: '거르개',
  centerTop: '많이 이어진 스토리',
  centerNone: '찾는 스토리가 없다',
  target: '인물 · 항목',
  targetPh: '인물 · 항목 찾기',
  targetClear: '인물 · 항목 거르개 지우기',
  targetTop: '많이 걸린 항목',
  thread: '떡밥',
  threadAll: '떡밥 전체',
  lineKind: '선 종류',
  kindFilter: '스토리 종류',
  strength: [
    { value: '1', label: '전부', title: '{common} · 항목만 나눈 약한 연결까지' },
    { value: '2', label: '보통 이상', title: '추정한 연결 · 중심으로 나온 같은 인물 · 소재 · 떨어진 연작부터' },
    { value: '3', label: '강함', title: '곧바로 이어지는 다음 편 · 확실한 {note}만' },
  ],
  level: { 1: '약함', 2: '보통', 3: '강함' },
  levelHelp: { 1: '{common} · 항목만 나눈 연결', 2: '추정한 연결 · 중심으로 나온 같은 인물 · 소재 · 떨어진 연작', 3: '곧바로 이어지는 다음 편 · 확실한 {note}' },
  before: '앞',
  after: '뒤',
  beforeHead: '앞 — 먼저 나온 스토리',
  afterHead: '뒤 — 이어서 나온 스토리',
  centerMark: '가운데',
  recenter: '중심으로',
  recenterTitle: '이 스토리를 가운데로 놓고 보기',
  more: (n) => `더 보기 (${n})`,
  neighbors: '이어진 스토리',
  lines: '선',
  hiddenRange: (n) => `범위 설정에서 빠진 스토리 ${n}`,
  showAll: '전부 보기',
  widthKey: '굵기 = 연결된 씬 수',
  flowKey: '왼쪽 → 오른쪽이 읽는 순서',
  candKey: '긴 점선 = 확정 전 후보',
  noNeighbors: '이 스토리와 이어진 스토리가 없다',
  noNeighborsFiltered: '거르개에 걸리는 연결이 없다',
  allHidden: '이어진 스토리가 모두 스포일러로 가려져 있다',
  resetFilters: '거르개 풀기',
  centerHidden: '이 스토리는 아직 안 읽은 스토리라 가렸다',
  detailTitle: '이어진 장면',
  allTypes: '전체',
  sceneRows: (n) => `씬 연결 ${n}`,
  weakHidden: (n) => `연결 강도 설정으로 가린 약한 연결 ${n}`,
  weakShow: '약한 연결까지 보기',
  first: '앞 씬',
  second: '뒤 씬',
  inner: '이 스토리 안의 연결',
  origin: { auto: '자동 규칙', record: '', manual: '직접 확정', 'game-condition': '게임 선행 조건' }, // record는 mount에서 TERM.note로
  originHelp: { auto: '키 · 게임 순서 · 중심 항목으로 기계가 이은 것', record: '원문을 읽고 남긴 {note}에서 나온 것', manual: '직접 읽고 확정한 연작', 'game-condition': '게임이 먼저 보게 하는 선행 조건' },
  conf: { 확실: '확실', 추정: '추정' },
  candidate: '후보',
  answer: '답',
  partial: '일부 회수',
  whole: '회수',
  pointOf: { Q: '의문', F: '사실' },
  both: '앞·뒤',
  shared: '중심 까닭',
  netCap: (shown, total) => `많이 이어진 상위 ${shown}개 스토리만 그렸다 (전체 ${total})`,
  netReduce: '줄이기',
  netMainMain: (n) => `메인끼리의 선 ${n}`,
  netTop: '가장 많이 이어진 스토리',
  netWide: (n) => `${n}개까지 보기`,
  netStrong: '강함만',
  netStoryOnly: '이야기 연결만',
  netHint: '스토리를 누르면 연결이 강조되고, 선을 누르면 이어진 장면이 아래에 나온다 · 두 번 누르면 그 스토리의 이웃 보기',
  netEmpty: '그릴 연결이 없다',
  asTable: '표로 보기',
  colFrom: '앞 스토리',
  colTo: '뒤 스토리',
  colCount: '씬 수',
  colLevel: '강도',
  netSel: '고른 스토리',
  netNodes: '스토리',
  chainGroup: { manual: '직접 확정한 연작 — 이벤트 · 사이드', auto: '키 · 게임 순서로 이은 연작 — 서브퀘스트 · 유실물' },
  chainEmpty: '보일 연작이 없다',
  chainCount: (n) => `연작 ${n}`,
  chainHiddenTail: (n) => `이어지는 ${n}편은 아직 안 읽은 스토리라 가렸다`,
  chainNotes: '연결 까닭',
  svgOff: '그래프 라이브러리(d3)를 못 받아 선을 그리지 못한다 — 카드의 선 종류 단추로 이어진 장면은 볼 수 있다.',
  loadingEvidence: '불러오는 중…',
  noRows: '이 조건에 맞는 씬 연결이 없다',
  rowMore: (n) => `씬 연결 더 보기 (${n})`,
};

/** 선 종류별 이야기 연결 정도 — 카드를 뽑는 순서와 색 구분에 쓴다 */
const WEIGHT = { sequel: 5, reversal: 4, setup_payoff: 4, callback: 3, character: 2, keyword: 1, prereq: 1 };
const STORY_TYPES = new Set(['sequel', 'setup_payoff', 'callback', 'reversal']);
const TYPE_IDS = ['sequel', 'setup_payoff', 'callback', 'reversal', 'character', 'keyword'];
const TYPE_CLASS = { sequel: 'sequel', setup_payoff: 'payoff', callback: 'callback', reversal: 'reversal', character: 'character', keyword: 'keyword', prereq: 'prereq' };

const STEP = 8; // 한쪽에 처음 보이는 카드 수 · 더 보기 한 번의 수
const ROW_STEP = 12; // 근거 목록에서 한 번에 보이는 씬 연결 수
const NET_CAP = 80; // 전체 보기에서 처음 그리는 스토리 수 — 더 보면 NET_CAP_MAX까지
const NET_CAP_MAX = 150; // 전체 보기의 스토리 수 상한
const STACK_WIDTH = 640; // 이웃 보기가 한 줄(세로)로 접히는 너비

const clip = (s, n) => (typeof s === 'string' && [...s].length > n ? `${[...s].slice(0, n).join('')}…` : s ?? '');
const fold = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');
const lineW = (count) => Math.min(8, 1.6 + Math.sqrt(Math.max(1, count)) * 1.5);
const netW = (count) => Math.min(3, 0.9 + Math.sqrt(Math.max(1, count)) * 0.45);

export async function mount(root, ctx) {
  const { state, data, fmt, ui, d3, idx } = ctx;
  const h = ui.el;
  const TERM = fmt.TERM;
  const links = await data.load('links');

  // ── 색인 ──
  const units = idx.units;
  const edges = links.edges
    .map((e, id) => ({ ...e, id, a: units.get(e.from), b: units.get(e.to), targets: e.targets ?? [], threads: e.threads ?? [], records: e.records ?? [] }))
    .filter((e) => e.a && e.b);
  const adj = new Map();
  for (const e of edges) {
    (adj.get(e.from) ?? adj.set(e.from, []).get(e.from)).push(e);
    (adj.get(e.to) ?? adj.set(e.to, []).get(e.to)).push(e);
  }
  const commonSet = new Set(links.targets.filter((t) => t.common).map((t) => t.id));
  const typeRank = new Map(TYPE_IDS.map((t, i) => [t, i]));
  const typesPresent = TYPE_IDS.filter((t) => edges.some((e) => e.type === t));
  const kindsPresent = fmt.KIND_ORDER.filter((k) => edges.some((e) => e.a.kind === k || e.b.kind === k));
  const typeLabel = (t) => fmt.LINK_TYPE[t]?.label ?? t;
  const typeHelp = (t) => fmt.help('link', t);
  const kindLabel = (k) => fmt.KIND[k]?.label ?? k;
  const when = (u) => fmt.tickLabel(u.tick, { date: false });
  const sceneTitle = (id) => idx.scenes.get(id)?.title;
  const actLabel = (a) => fmt.ACT[a] ?? a;
  const ORIGIN = { ...LABELS.origin, record: TERM.note };
  const fill = (t) => t.replace('{common}', TERM.commonTargets).replace('{note}', TERM.note);

  // 인물 · 항목 거르개 후보 — 선에 걸린 항목, 걸린 선 수 순
  const targetUse = new Map();
  for (const e of edges) for (const t of e.targets) targetUse.set(t, (targetUse.get(t) ?? 0) + 1);
  const targetList = [...targetUse].map(([id, n]) => ({ id, n, name: fmt.targetName(id), type: idx.targets.get(id)?.type, common: commonSet.has(id) }))
    .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'ko'));
  // 떡밥 거르개 후보
  const threadUse = new Map();
  for (const e of edges) for (const t of e.threads) threadUse.set(t, (threadUse.get(t) ?? 0) + 1);
  const threadList = [...threadUse].map(([id, n]) => ({ id, n, title: idx.threads.get(id)?.title ?? id }))
    .sort((x, y) => x.title.localeCompare(y.title, 'ko'));
  /** 거르개 후보는 여기까지 읽음 안(양 끝 스토리가 보이는) 선에 걸린 것만 — 이름 · 떡밥 제목이 스포일러라서 */
  const candidatesFor = (T) => {
    if (T == null) return { targets: targetList, threads: threadList };
    const tu = new Map();
    const hu = new Map();
    for (const e of edges) {
      if (e.a.tick != null && e.a.tick > T) continue;
      if (e.b.tick != null && e.b.tick > T) continue;
      for (const t of e.targets) tu.set(t, (tu.get(t) ?? 0) + 1);
      for (const t of e.threads) hu.set(t, (hu.get(t) ?? 0) + 1);
    }
    return {
      targets: targetList.filter((t) => tu.has(t.id)).map((t) => ({ ...t, n: tu.get(t.id) })).sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'ko')),
      threads: threadList.filter((t) => hu.has(t.id)).map((t) => ({ ...t, n: hu.get(t.id) })),
    };
  };
  let cand = candidatesFor(state.get().t);
  let candT = state.get().t;

  // ── 거르개 (URL 파라미터 → F) ──
  const listParam = (v, allowed) => {
    if (!v) return null;
    const set = new Set(String(v).split(',').filter((x) => allowed.includes(x)));
    return set.size && set.size < allowed.length ? set : null;
  };
  function readF(s) {
    const p = s.p ?? {};
    const mode = p.m === 'net' || p.m === 'chain' ? p.m : 'ego';
    // 전체 보기는 이야기 연결(다음 편 · 떡밥 · 다시 언급 · 뒤집힘)만 기본 — 같은 인물 · 소재까지 얹으면 선이 뭉쳐 읽을 수 없다. 전부 켜면 ty=all
    const types = p.ty === 'all' ? null : listParam(p.ty, typesPresent) ?? (mode === 'net' ? new Set(typesPresent.filter((t) => STORY_TYPES.has(t))) : null);
    return {
      mode,
      center: units.has(p.c) ? p.c : null,
      n: p.n || null,
      pr: p.pr || null,
      lt: TYPE_IDS.includes(p.lt) || p.lt === 'prereq' ? p.lt : null,
      types,
      minS: [1, 2, 3].includes(Number(p.s)) ? Number(p.s) : 2,
      tg: targetUse.has(p.tg) ? p.tg : null,
      th: threadUse.has(p.th) ? p.th : null,
      kinds: listParam(p.kd, kindsPresent),
      wide: p.nn === '150',
      mm: p.mm === '1',
      T: s.t,
      layers: s.layers,
    };
  }
  const inCut = (F, u) => F.T == null || u.tick == null || u.tick <= F.T;
  const inRange = (F, u) => u.layer == null || F.layers.includes(u.layer);
  const kindOk = (F, u) => !F.kinds || F.kinds.has(u.kind);
  /** 자주 나오는 항목을 고르면 그 항목의 약한 연결(세기 1)도 보인다 */
  const relaxed = (F, e) => F.tg && commonSet.has(F.tg) && e.targets.includes(F.tg);
  function passEdge(e, F) {
    if (F.types && !F.types.has(e.type)) return false;
    if (F.tg && !e.targets.includes(F.tg)) return false;
    if (F.th && !e.threads.includes(F.th)) return false;
    return e.strength >= F.minS || relaxed(F, e);
  }
  /** 선 굵기 — 세기 2 이상만 볼 때는 약한 연결을 뺀다 */
  const effCount = (e, F) => (F.minS >= 2 && !relaxed(F, e) ? Math.max(1, e.count - (e.weak ?? 0)) : e.count);
  const structSig = (F) => JSON.stringify([F.mode, F.types && [...F.types], F.minS, F.tg, F.th, F.kinds && [...F.kinds], F.T, F.layers, F.wide, F.mm]);

  /** 스토리별 이어진 이웃 수(지금 거르개 · 컷오프 · 범위 안, 종류 거르개는 이웃에만) — 기본 가운데 · 후보 순서에 쓴다 */
  function degrees(F) {
    const nb = new Map();
    for (const e of edges) {
      if (!passEdge(e, F)) continue;
      if (!inCut(F, e.a) || !inCut(F, e.b) || !inRange(F, e.a) || !inRange(F, e.b)) continue;
      if (F.kinds && !F.kinds.has(e.a.kind) && !F.kinds.has(e.b.kind)) continue;
      (nb.get(e.from) ?? nb.set(e.from, new Set()).get(e.from)).add(e.to);
      (nb.get(e.to) ?? nb.set(e.to, new Set()).get(e.to)).add(e.from);
    }
    return nb;
  }
  function bestCenter(F, nb) {
    let best = null;
    for (const [k, set] of nb) {
      const u = units.get(k);
      if (!u || !inCut(F, u) || !inRange(F, u)) continue;
      if (!best || set.size > best.n || (set.size === best.n && u.order < best.u.order)) best = { u, n: set.size };
    }
    if (best) return best.u;
    // 이어진 스토리가 하나도 안 보이면(컷오프가 이를 때) 가장 먼저 나온 스토리 — 가려진 이웃 수를 알려 줄 수 있다
    return idx.unitList.filter((u) => inCut(F, u) && inRange(F, u)).sort((x, y) => x.order - y.order)[0] ?? null;
  }

  // ── 이웃 묶기 (가운데 스토리 하나) ──
  function groupsOf(key, F) {
    const map = new Map();
    for (const e of adj.get(key) ?? []) {
      if (!passEdge(e, F)) continue;
      const before = e.to === key;
      const other = before ? e.a : e.b;
      let g = map.get(other.key);
      if (!g) map.set(other.key, (g = { key: other.key, unit: other, side: before ? 'before' : 'after', edges: [], weight: 0, strength: 0, count: 0 }));
      g.edges.push(e);
      g.weight = Math.max(g.weight, WEIGHT[e.type] ?? 1);
      g.strength = Math.max(g.strength, e.strength);
      g.count += effCount(e, F);
    }
    for (const g of map.values()) g.edges.sort((x, y) => (typeRank.get(x.type) ?? 9) - (typeRank.get(y.type) ?? 9));
    return [...map.values()];
  }
  const byScore = (x, y) => y.weight - x.weight || y.strength - x.strength || y.count - x.count || x.unit.order - y.unit.order;
  const byOrder = (x, y) => x.unit.order - y.unit.order;

  // 탭 안 조작은 지금 가운데 스토리를 URL에 못박는다 — 가운데를 고른 적이 없으면(기본 가운데) 거르개를 만질 때 가운데가 딴 스토리로 바뀌지 않게
  const pinC = () => (F.mode === 'ego' && !F.center && view?.center ? { c: view.center.key } : {});
  const setP = (p, extra = {}) => state.set({ ...extra, p: { ...pinC(), ...p } });

  // ── 작은 도구 ──
  /** 포인터를 따라다니는 말풍선 */
  const tipNode = h('div', { class: 'tooltip lk-tip', role: 'tooltip' });
  tipNode.hidden = true;
  document.body.append(tipNode);
  function showTip(evt, content) {
    ui.clear(tipNode);
    tipNode.append(content);
    tipNode.hidden = false;
    moveTip(evt);
  }
  function moveTip(evt) {
    const w = tipNode.offsetWidth;
    const hgt = tipNode.offsetHeight;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, evt.clientX + 14));
    const y = evt.clientY + 18 + hgt > window.innerHeight ? Math.max(8, evt.clientY - hgt - 12) : evt.clientY + 18;
    tipNode.style.left = `${x}px`;
    tipNode.style.top = `${y}px`;
  }
  const hideTip = () => { tipNode.hidden = true; };

  /** 선 종류 키 — 색 · 굵기 견본 */
  const typeKey = (t) => h('i', { class: `lk-key lk-t-${TYPE_CLASS[t]}`, 'aria-hidden': 'true' });
  /** 기록 ID 칩(근거 표시) */
  const recordLink = (id) => (id && /^[A-Z]+\d/.test(id) && !/^Y\d/.test(id) ? ui.link(`record:${id}`, id, { class: 'mono lk-rid' }) : id ? h('span', { class: 'mono lk-rid' }, id) : null);
  const sceneLink = (id) => {
    const title = sceneTitle(id);
    if (!idx.scenes.has(id)) return h('span', { class: 'lk-scene' }, title ?? id); // 애장품 등 씬 목록에 없는 끝점
    return h('span', { class: 'lk-scene' }, ui.link(`scene:${id}`, fmt.ref(id)));
  };
  const kindText = (u) => h('span', { class: 'lk-kind' }, kindLabel(u.kind));

  // ── 콤보박스 (검색해서 고르는 입력) ──
  let comboSeq = 0;
  function combobox({ label, placeholder, options, onPick, clearable = false, onClear = null }) {
    const id = `lk-combo-${++comboSeq}`;
    const input = h('input', { type: 'text', class: 'lk-input', role: 'combobox', 'aria-expanded': 'false', 'aria-autocomplete': 'list', 'aria-controls': `${id}-list`, 'aria-label': label, autocomplete: 'off', spellcheck: 'false', placeholder });
    const list = h('ul', { class: 'lk-list', id: `${id}-list`, role: 'listbox', 'aria-label': label });
    list.hidden = true;
    const clearBtn = clearable ? h('button', { type: 'button', class: 'lk-clear', 'aria-label': LABELS.targetClear, title: LABELS.targetClear, onClick: () => { onClear?.(); } }, ui.icon('close')) : null;
    if (clearBtn) clearBtn.hidden = true;
    const wrap = h('div', { class: 'lk-combo' }, input, clearBtn, list);
    let shown = [];
    let active = -1;
    let typed = false;
    let text = '';
    const setActive = (i) => {
      active = i;
      [...list.children].forEach((li, k) => { li.setAttribute('aria-selected', String(k === i)); if (k === i) li.scrollIntoView({ block: 'nearest' }); });
      if (i >= 0) input.setAttribute('aria-activedescendant', list.children[i]?.id ?? ''); else input.removeAttribute('aria-activedescendant');
    };
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); };
    function open() {
      const q = typed ? input.value.trim() : '';
      const res = options(q);
      shown = res.items;
      ui.clear(list);
      let lastGroup = null;
      shown.forEach((it, i) => {
        if (it.group && it.group !== lastGroup) { list.append(h('li', { class: 'lk-group', role: 'presentation' }, it.group)); lastGroup = it.group; }
        const li = h('li', { class: ['lk-opt', it.dim ? 'is-dim' : ''], role: 'option', id: `${id}-o${i}`, 'aria-selected': 'false' },
          h('span', { class: 'lk-opt-main' }, it.label), it.sub ? h('span', { class: 'lk-opt-sub' }, it.sub) : null, it.n != null ? h('span', { class: 'lk-opt-n' }, it.n) : null);
        li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
        li.addEventListener('mousemove', () => { if (active !== i) setActive(i); });
        list.append(li);
      });
      if (!shown.length) list.append(h('li', { class: 'lk-empty', role: 'presentation' }, res.empty ?? LABELS.centerNone));
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      setActive(shown.length && typed ? 0 : -1);
    }
    function pick(i) {
      const it = shown[i];
      if (!it) return;
      close();
      typed = false;
      input.blur();
      onPick(it.value, it);
    }
    input.addEventListener('focus', () => { typed = false; input.select(); open(); });
    input.addEventListener('input', () => { typed = true; open(); });
    input.addEventListener('blur', () => { close(); typed = false; input.value = text; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); setActive(Math.min(shown.length - 1, active + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
      else if (e.key === 'Enter') { if (!list.hidden && active >= 0) { e.preventDefault(); pick(active); } }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); input.value = text; input.blur(); }
    });
    return {
      el: wrap,
      set(t) { text = t ?? ''; if (document.activeElement !== input) input.value = text; if (clearBtn) clearBtn.hidden = !text; },
    };
  }

  // 중심 스토리 고르기
  const degCache = { sig: '', nb: null };
  const degreesCached = (F) => {
    const sig = structSig(F);
    if (degCache.sig !== sig) { degCache.sig = sig; degCache.nb = degrees(F); }
    return degCache.nb;
  };
  const centerCombo = combobox({
    label: LABELS.center,
    placeholder: LABELS.centerPh,
    options: (q) => {
      const F = readF(state.get());
      const nb = degreesCached(F);
      const pool = idx.unitList.filter((u) => inCut(F, u) && inRange(F, u));
      const n = (u) => nb.get(u.key)?.size ?? 0;
      let items;
      if (!q) {
        items = pool.filter((u) => n(u) > 0).sort((x, y) => n(y) - n(x) || x.order - y.order).slice(0, 12)
          .map((u) => ({ value: u.key, label: u.title, sub: `${kindLabel(u.kind)} · ${when(u)}`, n: n(u), group: LABELS.centerTop }));
      } else {
        const f = fold(q);
        items = pool.map((u) => ({ u, k: fold(u.title).indexOf(f), k2: fold(u.key).indexOf(f) }))
          .filter((x) => x.k >= 0 || x.k2 >= 0)
          .sort((x, y) => (x.k === 0 ? 0 : 1) - (y.k === 0 ? 0 : 1) || n(y.u) - n(x.u) || x.u.order - y.u.order).slice(0, 30)
          .map(({ u }) => ({ value: u.key, label: u.title, sub: `${kindLabel(u.kind)} · ${when(u)}`, n: n(u) || '', dim: !n(u) }));
      }
      return { items, empty: LABELS.centerNone };
    },
    onPick: (key) => state.set({ p: { c: key, n: null, lt: null, pr: null } }),
  });

  // 인물 · 항목 고르기
  const targetCombo = combobox({
    label: LABELS.target,
    placeholder: LABELS.targetPh,
    clearable: true,
    onClear: () => setP({ tg: null }),
    options: (q) => {
      let items;
      const toItem = (t, group) => ({ value: t.id, label: t.name, sub: fmt.TARGET_TYPE[t.type] ?? '', n: t.n, dim: t.common, group });
      if (!q) {
        const top = cand.targets.filter((t) => !t.common).slice(0, 10).map((t) => toItem(t, LABELS.targetTop));
        const common = cand.targets.filter((t) => t.common).map((t) => toItem(t, TERM.commonTargets));
        items = [...top, ...common];
      } else {
        const f = fold(q);
        items = cand.targets.filter((t) => fold(t.name).includes(f)).slice(0, 30).map((t) => toItem(t));
      }
      return { items, empty: LABELS.centerNone };
    },
    onPick: (id) => setP({ tg: id, n: null, lt: null, pr: null }),
  });

  // 떡밥 고르기
  const threadSelect = h('select', { class: 'lk-select', 'aria-label': LABELS.thread, onChange: (e) => setP({ th: e.target.value || null, n: null, lt: null, pr: null }) },
    h('option', { value: '' }, LABELS.threadAll),
    cand.threads.map((t) => h('option', { value: t.id }, `${t.title} (${t.n})`)));
  const rebuildThreadOptions = () => threadSelect.replaceChildren(h('option', { value: '' }, LABELS.threadAll), ...cand.threads.map((t) => h('option', { value: t.id }, `${t.title} (${t.n})`)));

  // 연결 강도
  const strengthSeg = ui.segmented({ label: TERM.strength, options: LABELS.strength.map((o) => ({ ...o, title: fill(o.title) })), value: '2', onChange: (v) => setP({ s: v === '2' ? null : v, n: null, lt: null }) });

  // 모드
  const modeSeg = ui.segmented({
    label: '보기',
    options: ['ego', 'net', 'chain'].map((m) => ({ value: m, label: LABELS.mode[m], title: LABELS.modeHelp[m] })),
    value: 'ego',
    onChange: (v) => state.set({ p: { m: v === 'ego' ? null : v, n: null, lt: null, pr: null } }),
  });

  // 켜고 끄는 칩 묶음 — 전부 켜짐이면 파라미터를 지운다
  function toggleChips({ items, name, getSel, onChange, counts = false }) {
    const wrap = h('div', { class: 'lk-chips', role: 'group', 'aria-label': name });
    const buttons = new Map();
    for (const it of items) {
      const b = h('button', { type: 'button', class: ['lk-chip', it.cls], 'aria-pressed': 'true', title: it.title, onClick: () => {
        const cur = getSel();
        const all = items.map((x) => x.id);
        const next = new Set(cur ?? all);
        if (cur == null) { next.clear(); next.add(it.id); } // 전부 켜진 상태에서 누르면 그것만
        else if (next.has(it.id)) next.delete(it.id);
        else next.add(it.id);
        onChange(next.size === 0 || next.size === all.length ? null : [...next]);
      } }, it.key ?? null, h('span', { class: 'lk-chip-label' }, it.label), counts ? h('span', { class: 'lk-chip-n' }) : null);
      buttons.set(it.id, b);
      wrap.append(b);
    }
    return {
      el: wrap,
      sync(sel, n = null) {
        for (const [id, b] of buttons) {
          b.setAttribute('aria-pressed', String(!sel || sel.has(id)));
          const c = b.querySelector('.lk-chip-n');
          if (c && n) { c.textContent = fmt.num(n.get(id) ?? 0); b.classList.toggle('is-zero', !(n.get(id) ?? 0)); }
        }
      },
    };
  }
  const typeChips = toggleChips({
    items: typesPresent.map((t) => ({ id: t, label: typeLabel(t), title: typeHelp(t), cls: `lk-t-${TYPE_CLASS[t]}`, key: typeKey(t) })),
    name: LABELS.lineKind,
    counts: true,
    getSel: () => readF(state.get()).types,
    onChange: (list) => setP({ ty: list ? list.join(',') : state.get().p.m === 'net' ? 'all' : null, n: null, lt: null, pr: null }),
  });
  const kindChips = toggleChips({
    items: kindsPresent.map((k) => ({ id: k, label: kindLabel(k), title: fmt.help('kind', k) })),
    name: LABELS.kindFilter,
    getSel: () => readF(state.get()).kinds,
    onChange: (list) => setP({ kd: list && list.join(','), n: null, lt: null }),
  });

  // ── 화면 뼈대 ──
  const field = (name, node, cls = '') => h('div', { class: ['lk-field', cls] }, h('span', { class: 'lk-lab' }, name), node);
  // 좁은 화면에서는 가운데 스토리만 두고 나머지 거르개는 접는다(lk-collapsible)
  const filterBtn = h('button', { type: 'button', class: 'btn lk-filter-toggle', 'aria-expanded': 'false', onClick: () => {
    const on = controls.classList.toggle('is-open');
    filterBtn.setAttribute('aria-expanded', String(on));
  } }, LABELS.filters, h('span', { class: 'lk-filter-n' }));
  const barMain = h('div', { class: 'lk-bar lk-bar-main' },
    field(LABELS.center, centerCombo.el, 'lk-field-center'),
    filterBtn,
    field(LABELS.target, targetCombo.el, 'lk-field-target lk-collapsible'),
    field(LABELS.thread, threadSelect, 'lk-field-thread lk-collapsible'));
  const barFilter = h('div', { class: 'lk-bar lk-bar-filter lk-collapsible' },
    field(LABELS.lineKind, typeChips.el, 'lk-field-types'),
    field(TERM.strength, strengthSeg.el, 'lk-field-strength'),
    field(LABELS.kindFilter, kindChips.el, 'lk-field-kinds'));
  const controls = h('div', { class: 'lk-controls' }, barMain, barFilter);
  const summary = h('div', { class: 'lk-sum', 'aria-live': 'polite' });
  const body = h('div', { class: 'lk-body' });
  const detail = h('section', { class: 'lk-detail', 'aria-label': LABELS.detailTitle });
  detail.hidden = true;
  const inner = h('details', { class: 'details lk-inner' });
  inner.hidden = true;
  root.append(h('div', { class: 'lk-head' }, h('h2', { class: 'sr-only' }, meta.title), modeSeg.el), controls, summary, body, detail, inner);

  // 실행 중 상태
  let F = readF(state.get()); // 지금 거르개
  let sig = ''; // 마지막으로 그린 구조 서명
  let view = null; // 이웃 보기 상태: { center, groups, shown, active, limit, el, svg, ... }
  let netView = null;
  const limit = { key: null, before: STEP, after: STEP };
  let detailToken = 0;
  let rowLimit = { key: '', n: ROW_STEP };
  let alive = true;

  const resetFilters = () => setP({ ty: null, s: null, tg: null, th: null, kd: null, mm: null, nn: null, n: null, lt: null, pr: null });
  const showAll = () => state.set({ t: 'all' });
  /** 숨김 안내 한 줄(컷오프 · 범위) + 행동 단추 */
  function hiddenNote(cut, range) {
    const out = [];
    if (cut > 0) out.push(ui.hiddenNote(fmt.hiddenLabel(cut), showAll));
    if (range > 0) out.push(h('span', { class: 'lk-hidden lk-hidden-range' }, LABELS.hiddenRange(range)));
    return out;
  }
  function emptyState(text, { cut = 0, filtered = false } = {}) {
    return h('div', { class: 'lk-empty-state' },
      h('p', {}, text),
      h('div', { class: 'lk-empty-actions' },
        cut > 0 ? h('button', { type: 'button', class: 'btn', onClick: showAll }, `${fmt.hiddenLabel(cut)} — ${LABELS.showAll}`) : null,
        filtered ? h('button', { type: 'button', class: 'btn', onClick: resetFilters }, LABELS.resetFilters) : null));
  }
  const filtered = (f) => Boolean((f.types && f.mode !== 'net') || f.minS !== 2 || f.tg || f.th || f.kinds);

  // ── 이웃 보기 ──
  function renderEgo() {
    ui.clear(body);
    body.className = 'lk-body lk-body-ego';
    view = null;
    const nb = degreesCached(F);
    let c = F.center ? units.get(F.center) : null;
    if (c && !inCut(F, c)) {
      body.append(emptyState(LABELS.centerHidden, { cut: 1 }));
      summary.replaceChildren(...hiddenNote(1, 0));
      centerCombo.set('');
      setTypeCounts(null);
      return;
    }
    if (!c) c = bestCenter(F, nb);
    if (!c) {
      const cutAll = degreesCached({ ...F, T: null }); // 컷오프를 풀면 보일 스토리
      body.append(emptyState(LABELS.noNeighborsFiltered, { cut: cutAll.size ? cutAll.size : 0, filtered: filtered(F) }));
      summary.replaceChildren();
      centerCombo.set('');
      setTypeCounts(null);
      return;
    }
    centerCombo.set(c.title);
    if (limit.key !== c.key) { limit.key = c.key; limit.before = STEP; limit.after = STEP; }
    const okNeighbor = (g) => inRange(F, g.unit) && kindOk(F, g.unit);
    const all = groupsOf(c.key, F);
    const shown = all.filter((g) => inCut(F, g.unit) && okNeighbor(g));
    const hiddenCut = all.filter((g) => !inCut(F, g.unit) && okNeighbor(g)).length;
    const hiddenRange = all.filter((g) => inCut(F, g.unit) && !inRange(F, g.unit) && kindOk(F, g.unit)).length;
    // 선 종류 칩의 건수 — 종류 거르개만 빼고 센 것
    const counts = new Map();
    for (const g of groupsOf(c.key, { ...F, types: null })) if (inCut(F, g.unit) && okNeighbor(g)) for (const e of g.edges) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    setTypeCounts(counts);

    const sorted = [...shown].sort(byScore);
    const activeKey = F.n && shown.some((g) => g.key === F.n) ? F.n : sorted[0]?.key ?? null;
    const bySide = (side) => sorted.filter((g) => g.side === side);
    const before = bySide('before');
    const after = bySide('after');
    const take = (arr, lim) => {
      const out = arr.slice(0, lim);
      const act = arr.find((g) => g.key === activeKey);
      if (act && !out.includes(act)) out.push(act);
      return out.sort(byOrder);
    };
    const lineCount = shown.reduce((n, g) => n + g.edges.length, 0);
    view = { center: c, shown, activeKey, before, after, hiddenCut, hiddenRange };

    summary.replaceChildren(
      h('span', { class: 'lk-sum-main' },
        h('strong', {}, c.title), ' ', kindText(c), ' ', h('span', { class: 'muted' }, when(c)), ' — ',
        `${LABELS.neighbors} ${fmt.num(shown.length)}`, h('span', { class: 'muted' }, ` (${LABELS.before} ${fmt.num(before.length)} · ${LABELS.after} ${fmt.num(after.length)})`),
        ' · ', `${LABELS.lines} ${fmt.num(lineCount)}`),
      ...hiddenNote(hiddenCut, hiddenRange),
      h('span', { class: 'lk-legend-note' }, LABELS.widthKey, ' · ', LABELS.flowKey));

    if (!shown.length) {
      body.append(emptyState(hiddenCut && !filtered(F) ? LABELS.allHidden : filtered(F) ? LABELS.noNeighborsFiltered : LABELS.noNeighbors, { cut: hiddenCut, filtered: filtered(F) }));
      view.empty = true;
      renderDetail();
      return;
    }

    const box = h('div', { class: 'lk-ego' });
    const colBefore = h('section', { class: 'lk-col lk-before', 'aria-label': LABELS.beforeHead });
    const colAfter = h('section', { class: 'lk-col lk-after', 'aria-label': LABELS.afterHead });
    const fillCol = (col, side, arr, lim, headText) => {
      col.append(h('h3', { class: 'lk-col-head' }, headText, h('span', { class: 'lk-col-n' }, fmt.num(arr.length))));
      const ol = h('ol', { class: 'lk-rows' });
      for (const g of take(arr, lim)) ol.append(h('li', { class: 'lk-row' }, nodeCard(g, activeKey)));
      col.append(ol);
      const rest = arr.length - ol.children.length;
      if (rest > 0) col.append(h('button', { type: 'button', class: 'btn lk-more', onClick: () => { limit[side] += STEP; renderEgo(); } }, LABELS.more(rest)));
      if (!arr.length) col.append(h('p', { class: 'lk-col-empty muted' }, '—'));
    };
    fillCol(colBefore, 'before', before, limit.before, LABELS.beforeHead);
    fillCol(colAfter, 'after', after, limit.after, LABELS.afterHead);
    const mid = h('section', { class: 'lk-mid', 'aria-label': LABELS.centerMark }, centerCard(c, before.length, after.length));
    box.append(colBefore, mid, colAfter);
    body.append(box);
    view.el = box;
    if (d3) view.svg = d3.select(box).insert('svg', ':first-child').attr('class', 'lk-lines').attr('aria-hidden', 'true');
    else body.append(ui.notice(LABELS.svgOff, 'warn'));
    layoutEgo();
    renderDetail();
  }

  function centerCard(u, nBefore, nAfter) {
    return h('div', { class: 'lk-center' },
      h('div', { class: 'lk-center-tag' }, LABELS.centerMark),
      h('div', { class: 'lk-center-title' }, ui.link(`unit:${u.key}`, u.title, { title: u.title })),
      h('div', { class: 'lk-node-meta' }, kindText(u), h('span', { class: 'lk-dot' }, '·'), when(u)),
      h('div', { class: 'lk-center-stats muted' }, `${LABELS.before} ${fmt.num(nBefore)} · ${LABELS.after} ${fmt.num(nAfter)}`));
  }

  function nodeCard(g, activeKey) {
    const u = g.unit;
    const card = h('div', { class: ['lk-node', g.key === activeKey ? 'is-active' : ''], dataset: { key: g.key, side: g.side } });
    card.append(
      h('div', { class: 'lk-node-top' },
        h('button', { type: 'button', class: 'lk-title', title: u.title, onClick: () => pickNeighbor(g.key, null) }, u.title),
        h('button', { type: 'button', class: 'lk-recenter', title: LABELS.recenterTitle, 'aria-label': `${u.title} — ${LABELS.recenterTitle}`, onClick: (e) => { e.stopPropagation(); recenter(g.key); } }, LABELS.recenter, ui.icon('arrow'))),
      h('div', { class: 'lk-node-meta' }, kindText(u), h('span', { class: 'lk-dot' }, '·'), when(u)),
      h('div', { class: 'lk-tchips' }, g.edges.map((e) => h('button', {
        type: 'button', dataset: { type: e.type },
        class: ['lk-tchip', `lk-t-${TYPE_CLASS[e.type]}`, e.unconfirmed ? 'is-cand' : ''],
        title: `${typeHelp(e.type)} · ${TERM.strength} ${LABELS.level[e.strength]}`,
        onClick: (ev) => { ev.stopPropagation(); pickNeighbor(g.key, e.type); },
      }, typeKey(e.type), typeLabel(e.type), h('span', { class: 'lk-x' }, `×${fmt.num(effCount(e, F))}`), e.unconfirmed ? h('span', { class: 'lk-cand' }, LABELS.candidate) : null))));
    card.addEventListener('click', (e) => { if (!e.target.closest('button, a')) pickNeighbor(g.key, null); });
    card.addEventListener('dblclick', () => recenter(g.key));
    card.addEventListener('mouseenter', () => hoverKey(g.key, true));
    card.addEventListener('mouseleave', () => hoverKey(g.key, false));
    return card;
  }
  function pickNeighbor(key, type) {
    setP({ n: key, lt: type, pr: null }, { sel: `unit:${key}` });
  }
  function recenter(key) {
    // 리더가 열려 있으면 새 가운데 스토리를 같이 보여 준다
    state.set({ ...(state.get().sel ? { sel: `unit:${key}` } : {}), p: { m: null, c: key, n: null, lt: null, pr: null } });
    window.scrollTo?.({ top: Math.max(0, root.getBoundingClientRect().top + window.scrollY - 120), behavior: 'auto' });
  }
  function hoverKey(key, on) {
    if (!view?.svg) return;
    view.svg.selectAll('.lk-line').classed('is-hover', function () { return on && this.dataset.key === key; });
  }

  /** 선을 카드 가장자리에 맞춰 다시 그린다(레이아웃이 바뀔 때). 가운데 카드가 스크롤을 따라 붙으므로 가운데 쪽 끝은 updatePorts가 따로 옮긴다 */
  function layoutEgo() {
    const v = view;
    if (!v?.el) return;
    const stack = v.el.clientWidth < STACK_WIDTH;
    v.el.classList.toggle('is-stack', stack);
    if (!v.svg) return;
    v.svg.selectAll('*').remove();
    v.defs = [];
    if (stack) { v.svg.attr('width', 0).attr('height', 0); return; }
    const cr = v.el.getBoundingClientRect();
    v.svg.attr('width', cr.width).attr('height', v.el.scrollHeight);
    for (const side of ['before', 'after']) {
      const nodes = [...v.el.querySelectorAll(`.lk-node[data-side="${side}"]`)];
      nodes.forEach((card, i) => {
        const g = v.shown.find((x) => x.key === card.dataset.key);
        if (!g) return;
        const r = card.getBoundingClientRect();
        const ny = r.top - cr.top + Math.min(r.height / 2, 30);
        const nx = side === 'before' ? r.right - cr.left : r.left - cr.left;
        const ws = g.edges.map((e) => lineW(effCount(e, F)));
        const total = ws.reduce((x, y) => x + y, 0) + 2 * (ws.length - 1);
        let cur = -total / 2;
        g.edges.forEach((e, j) => {
          const off = cur + ws[j] / 2;
          cur += ws[j] + 2;
          const active = g.key === v.activeKey && (!F.lt || F.lt === e.type);
          const line = v.svg.append('path').attr('class', `lk-line lk-t-${TYPE_CLASS[e.type]}${e.unconfirmed ? ' is-cand' : ''}${active ? ' is-active' : ''}`)
            .attr('stroke-width', ws[j]).attr('data-key', g.key).attr('data-type', e.type);
          const hit = v.svg.append('path').attr('class', 'lk-hit').attr('data-key', g.key).attr('data-type', e.type)
            .on('mouseenter', (ev) => { hoverKey(g.key, true); showTip(ev, lineTip(e)); })
            .on('mousemove', (ev) => moveTip(ev))
            .on('mouseleave', () => { hoverKey(g.key, false); hideTip(); })
            .on('click', () => { hideTip(); pickNeighbor(g.key, e.type); });
          v.defs.push({ side, i, n: nodes.length, nx, ny, off, line: line.node(), hit: hit.node() });
        });
      });
    }
    updatePorts();
  }
  /** 가운데 카드의 지금 자리에 선의 가운데 쪽 끝을 맞춘다 — 스크롤 · 크기 변화마다 */
  function updatePorts() {
    const v = view;
    if (!v?.defs?.length) return;
    const cr = v.el.getBoundingClientRect();
    const mr = v.el.querySelector('.lk-center').getBoundingClientRect();
    const portTop = mr.top - cr.top + 16;
    const portBot = mr.bottom - cr.top - 16;
    for (const d of v.defs) {
      const py = d.n === 1 ? (portTop + portBot) / 2 : portTop + ((d.i + 0.5) / d.n) * (portBot - portTop);
      const px = d.side === 'before' ? mr.left - cr.left : mr.right - cr.left;
      const [x1, y1, x2, y2] = d.side === 'before' ? [d.nx, d.ny + d.off, px, py + d.off] : [px, py + d.off, d.nx, d.ny + d.off];
      const xm = (x1 + x2) / 2;
      const path = `M${x1},${y1}C${xm},${y1} ${xm},${y2} ${x2},${y2}`;
      d.line.setAttribute('d', path);
      d.hit.setAttribute('d', path);
    }
  }

  function lineTip(e) {
    return h('div', { class: 'lk-tip-body' },
      h('div', { class: 'lk-tip-title' }, `${e.a.title} → ${e.b.title}`),
      h('div', {}, typeLabel(e.type), ' · ', `${LABELS.sceneRows(fmt.num(e.count))}`, ' · ', `${TERM.strength} ${LABELS.level[e.strength]}`),
      e.records.length ? h('div', { class: 'lk-tip-rec' }, `${TERM.evidence}: `, h('span', { class: 'mono' }, e.records.slice(0, 4).join(' · ') + (e.records.length > 4 ? ' …' : ''))) : null,
      e.note && e.origin !== 'manual' && e.note !== '흔한 대상' ? h('div', { class: 'muted' }, clip(e.note, 60)) : null);
  }

  /** 선택(sel) · 고른 이웃만 바뀔 때 — 카드와 선의 강조만 갱신한다 */
  function updateEgoActive() {
    if (!view?.el) return false;
    const selKey = selUnit();
    const exists = F.n ? view.shown.some((g) => g.key === F.n) : false;
    const activeKey = exists ? F.n : view.shown.slice().sort(byScore)[0]?.key ?? null;
    view.activeKey = activeKey;
    for (const card of view.el.querySelectorAll('.lk-node')) {
      card.classList.toggle('is-active', card.dataset.key === activeKey);
      card.classList.toggle('is-sel', card.dataset.key === selKey);
      for (const b of card.querySelectorAll('.lk-tchip')) b.classList.toggle('is-on', card.dataset.key === activeKey && F.lt === b.dataset.type);
    }
    if (view.svg) {
      view.svg.selectAll('.lk-line').classed('is-active', function () { return this.dataset.key === activeKey && (!F.lt || F.lt === this.dataset.type); });
    }
    return true;
  }
  const selUnit = () => {
    const p = state.parseSel(state.get().sel);
    return p?.type === 'unit' ? p.id : null;
  };

  // ── 근거: 고른 쌍의 씬 → 씬 연결 ──
  let scenesP = null;
  function loadScenes() {
    scenesP ??= data.load('links-scenes').then((list) => {
      const pair = new Map();
      const innerM = new Map();
      const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
      for (const r of list) {
        if (r.fu === r.tu) push(innerM, r.fu, r);
        else push(pair, `${r.fu}\t${r.tu}`, r);
      }
      for (const arr of pair.values()) arr.sort((x, y) => (typeRank.get(x.type) ?? 9) - (typeRank.get(y.type) ?? 9) || y.s - x.s);
      return { pair, inner: innerM };
    });
    return scenesP;
  }

  /** 지금 근거를 보일 쌍 { from, to, edges } — 이웃 보기는 가운데 + 고른 이웃, 전체 보기는 고른 선 */
  function currentPair() {
    if (F.mode === 'ego') {
      if (!view || view.empty || !view.activeKey) return null;
      const g = view.shown.find((x) => x.key === view.activeKey);
      if (!g) return null;
      return g.side === 'before' ? { from: g.unit, to: view.center, edges: g.edges } : { from: view.center, to: g.unit, edges: g.edges };
    }
    if (F.mode === 'net' && F.pr) {
      const [a, b] = F.pr.split('>');
      const from = units.get(a);
      const to = units.get(b);
      if (!from || !to || !inCut(F, from) || !inCut(F, to)) return null;
      const es = (adj.get(a) ?? []).filter((e) => e.from === a && e.to === b && passEdge(e, F));
      return es.length ? { from, to, edges: es } : null;
    }
    return null;
  }

  /** 분석 메모 문장 자리를 채운다 — 기록 파일(6MB)은 처음 근거를 볼 때 받는다 */
  function fillRecords(scope) {
    if (!idx.hasRecords) return;
    for (const el of scope.querySelectorAll('[data-rec]:not([data-filled])')) {
      const r = idx.records.get(el.dataset.rec);
      el.dataset.filled = '1';
      if (!r) continue;
      const text = clip(fmt.recordText(r), 120);
      const prefix = el.dataset.prefix;
      const label = !prefix ? fmt.recordLabel(r) : prefix === '→' ? `→ ${fmt.recordLabel(r)}` : prefix;
      el.replaceChildren(h('span', { class: 'lk-why-label' }, label), ' ', text ? h('span', { class: 'lk-why-text' }, text) : null, ' ', recordLink(el.dataset.rec));
    }
  }
  let recordsAsked = false;
  function wantRecords(scope) {
    if (idx.hasRecords) { fillRecords(scope); return; }
    if (recordsAsked) { idx.withRecords?.().then(() => alive && fillRecords(scope)); return; }
    recordsAsked = true;
    idx.withRecords?.().then(() => { if (alive) { fillRecords(detail); fillRecords(inner); } }).catch(() => {});
  }
  const recLine = (id, prefix) => h('div', { class: 'lk-why', dataset: { rec: id, prefix: prefix ?? '' } }, prefix ? h('span', { class: 'lk-why-label' }, prefix) : null, ' ', recordLink(id));

  /** 기록이 만든 선의 "왜" — 메모 문장 + 가리키는 의문 · 사실 + 답 */
  function whyOf(r) {
    if (r.origin === 'manual') return [h('p', { class: 'lk-note' }, fmt.plain(r.note ?? ''))];
    if (r.origin === 'game-condition') return [];
    if (r.type === 'character' || r.type === 'keyword') {
      const basis = (s) => String(s ?? '').replace(/말함 (\d+)줄/, '말한 줄 $1').replace(/이름 (\d+)줄/, '이름 $1줄');
      return [h('div', { class: 'lk-why' },
        h('span', { class: 'lk-why-label' }, fmt.TARGET_TYPE[idx.targets.get(r.target)?.type] ?? LABELS.target), ' ',
        r.target && idx.targets.has(r.target) ? ui.link(`target:${r.target}`, fmt.targetName(r.target)) : fmt.targetName(r.target),
        r.note === '흔한 대상' ? h('span', { class: 'lk-weak' }, ` ${TERM.commonTargets}`) : null),
      r.fb || r.tb ? h('div', { class: 'lk-basis muted' }, [r.fb ? `${LABELS.before} — ${basis(r.fb)}` : null, r.tb ? `${LABELS.after} — ${basis(r.tb)}` : null].filter(Boolean).join('  ·  ')) : null].filter(Boolean);
    }
    const out = [];
    const rec = r.record && !/^Y/.test(r.record) ? r.record : null;
    const isQk = rec && r.type === 'setup_payoff' && r.act === '회수';
    if (rec && !isQk) out.push(recLine(rec));
    if (r.point && r.point !== rec) out.push(recLine(r.point, isQk ? null : '→'));
    const ans = /(일부|전부)?\s*·?\s*답\s+(\S+)/.exec(r.note ?? '');
    if (ans) out.push(recLine(ans[2], `${r.type === 'reversal' ? '바뀐 사실' : LABELS.answer}${ans[1] === '일부' ? ` · ${LABELS.partial}` : ''}`));
    else if (r.note && r.note !== '흔한 대상') out.push(h('div', { class: 'lk-why muted' }, /^known-gap/.test(r.note) ? '빠진 조건을 번호 순서로 추정' : clip(r.note, 120)));
    return out;
  }

  function evRow(r) {
    const act = r.act ? actLabel(r.act) : null;
    return h('li', { class: 'lk-ev' },
      h('div', { class: 'lk-ev-top' },
        act ? h('span', { class: 'lk-act' }, act) : null,
        r.confidence === '추정' ? ui.chip('confidence', '추정') : null,
        r.status === '후보' ? h('span', { class: 'chip chip-plain chip-dashed' }, LABELS.candidate) : null,
        h('span', { class: 'lk-origin muted', title: fill(LABELS.originHelp[r.origin] ?? '') }, ORIGIN[r.origin] ?? r.origin),
        r.s ? h('span', { class: 'lk-lvl muted', title: fill(LABELS.levelHelp[r.s]) }, `${TERM.strength} ${LABELS.level[r.s]}`) : null),
      h('div', { class: 'lk-ev-scenes' },
        h('span', { class: 'lk-end' }, h('span', { class: 'lk-end-tag' }, LABELS.first), sceneLink(r.from)),
        h('span', { class: 'lk-ev-arrow', 'aria-hidden': 'true' }, ui.icon('arrow')),
        h('span', { class: 'lk-end' }, h('span', { class: 'lk-end-tag' }, LABELS.second), sceneLink(r.to))),
      ...whyOf(r));
  }

  /** 근거 목록 하나(선 종류 구역) — 더 보기는 구역마다 */
  function evSection(type, rows, limKey, again = renderDetail) {
    const lim = rowLimits.get(limKey) ?? ROW_STEP;
    const sec = h('section', { class: ['lk-dsec', `lk-t-${TYPE_CLASS[type] ?? 'prereq'}`] },
      h('h4', { class: 'lk-dsec-head', title: typeHelp(type) }, typeKey(type), typeLabel(type), h('span', { class: 'lk-col-n' }, fmt.num(rows.length))));
    const ol = h('ol', { class: 'lk-evs' });
    for (const r of rows.slice(0, lim)) ol.append(evRow(r));
    sec.append(ol);
    if (rows.length > lim) sec.append(h('button', { type: 'button', class: 'btn lk-more', onClick: () => { rowLimits.set(limKey, lim + ROW_STEP); again(); } }, LABELS.rowMore(fmt.num(rows.length - lim))));
    return sec;
  }
  const rowLimits = new Map();
  let detailPairKey = '';

  async function renderDetail() {
    const token = ++detailToken;
    const pair = currentPair();
    if (!pair) { detail.hidden = true; ui.clear(detail); detailPairKey = ''; return; }
    detail.hidden = false;
    const pairKey = `${pair.from.key}>${pair.to.key}`;
    if (pairKey !== detailPairKey) { rowLimits.clear(); detailPairKey = pairKey; }
    if (!scenesP) { ui.clear(detail); detail.append(h('div', { class: 'lk-dh' }, h('h3', { class: 'lk-dtitle' }, pair.from.title, ' → ', pair.to.title)), ui.spinner(LABELS.loadingEvidence)); }
    let sc;
    try { sc = await loadScenes(); } catch (err) { if (token === detailToken) { ui.clear(detail); detail.append(ui.notice(err.message, 'error')); } return; }
    if (token !== detailToken || !alive) return;

    const relaxedAny = F.tg && commonSet.has(F.tg);
    const allRows = sc.pair.get(`${pair.from.key}\t${pair.to.key}`) ?? [];
    const typesHere = pair.edges.map((e) => e.type);
    const rowOk = (r) => typesHere.includes(r.type) && (r.s >= F.minS || relaxedAny) && (!F.tg || !r.target || r.target === F.tg);
    const rows = allRows.filter(rowOk);
    const weak = allRows.filter((r) => typesHere.includes(r.type) && !rowOk(r) && r.s < F.minS).length;
    const byType = new Map();
    for (const r of rows) (byType.get(r.type) ?? byType.set(r.type, []).get(r.type)).push(r);
    const shownTypes = typesHere.filter((t) => byType.has(t));
    const sel = F.lt && byType.has(F.lt) ? F.lt : null;

    ui.clear(detail);
    detail.append(h('header', { class: 'lk-dh' },
      h('h3', { class: 'lk-dtitle' }, ui.link(`unit:${pair.from.key}`, pair.from.title), h('span', { class: 'lk-darrow', 'aria-hidden': 'true' }, ui.icon('arrow')), ui.link(`unit:${pair.to.key}`, pair.to.title)),
      h('div', { class: 'lk-dsub muted' }, `${when(pair.from)} → ${when(pair.to)}`, ' · ', LABELS.sceneRows(fmt.num(rows.length)))));
    if (shownTypes.length > 1) {
      const tabs = h('div', { class: 'lk-dtabs', role: 'group', 'aria-label': LABELS.lineKind });
      const tab = (id, label, n, key) => h('button', { type: 'button', class: ['lk-chip', id ? `lk-t-${TYPE_CLASS[id]}` : '', 'lk-dtab'], 'aria-pressed': String((sel ?? '') === (id ?? '')), onClick: () => setP({ lt: id }) }, key ?? null, label, h('span', { class: 'lk-chip-n' }, fmt.num(n)));
      tabs.append(tab(null, LABELS.allTypes, rows.length));
      for (const t of shownTypes) tabs.append(tab(t, typeLabel(t), byType.get(t).length, typeKey(t)));
      detail.append(tabs);
    }
    const show = sel ? [sel] : shownTypes;
    if (!rows.length) detail.append(h('p', { class: 'lk-norows muted' }, LABELS.noRows));
    for (const t of show) detail.append(evSection(t, byType.get(t), `${pairKey}|${t}`));
    if (weak > 0) detail.append(h('p', { class: 'lk-dfoot muted' }, LABELS.weakHidden(fmt.num(weak)), ' ', h('button', { type: 'button', class: 'btn lk-btn', onClick: () => setP({ s: '1' }) }, LABELS.weakShow)));
    wantRecords(detail);
  }

  // ── 이 스토리 안의 연결 (같은 스토리 안 씬 → 씬) ──
  let innerKey = '';
  async function renderInner() {
    if (F.mode !== 'ego' || !view?.center) { inner.hidden = true; innerKey = ''; return; }
    const key = view.center.key;
    inner.hidden = false;
    if (innerKey !== key) {
      innerKey = key;
      ui.clear(inner);
      inner.open = false;
      inner.append(h('summary', {}, LABELS.inner));
      inner.append(h('div', { class: 'details-body lk-inner-body' }));
    }
    const sc = await loadScenes().catch(() => null);
    if (!sc || !alive || innerKey !== key) return;
    const rows = sc.inner.get(key) ?? [];
    const summ = inner.querySelector('summary');
    if (!rows.length) { inner.hidden = true; return; }
    const counts = new Map();
    for (const r of rows) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    summ.replaceChildren(LABELS.inner, h('span', { class: 'lk-col-n' }, fmt.num(rows.length)),
      h('span', { class: 'lk-inner-types muted' }, [...counts].sort((x, y) => (typeRank.get(x[0]) ?? -1) - (typeRank.get(y[0]) ?? -1)).map(([t, n]) => `${typeLabel(t)} ${fmt.num(n)}`).join(' · ')));
    const paint = () => {
      const bodyEl = inner.querySelector('.lk-inner-body');
      if (bodyEl.dataset.key === key) return;
      bodyEl.dataset.key = key;
      ui.clear(bodyEl);
      const byType = new Map();
      for (const r of rows) (byType.get(r.type) ?? byType.set(r.type, []).get(r.type)).push(r);
      for (const t of ['prereq', ...TYPE_IDS]) if (byType.has(t)) bodyEl.append(evSection(t, byType.get(t), `inner|${key}|${t}`, () => { bodyEl.dataset.key = ''; paint(); }));
      wantRecords(inner);
    };
    inner.ontoggle = () => { if (inner.open) paint(); };
    if (inner.open) paint();
  }

  // ── 전체 보기: 행 = 스토리 종류, 가로 = 읽는 순서 ──
  function renderNet() {
    ui.clear(body);
    body.className = 'lk-body lk-body-net';
    view = null;
    netView = null;
    const mainMain = (e) => e.a.kind === 'main' && e.b.kind === 'main';
    const pool = (f, cutOn) => edges.filter((e) => (f.mm || !mainMain(e)) && passEdge(e, f) && inRange(f, e.a) && inRange(f, e.b) && kindOk(f, e.a) && kindOk(f, e.b) && (!cutOn || (inCut(f, e.a) && inCut(f, e.b))));
    const nodesOf = (es) => { const s = new Set(); for (const e of es) { s.add(e.from); s.add(e.to); } return s; };
    const es0 = pool(F, true);
    const hiddenCut = nodesOf(pool(F, false)).size - nodesOf(es0).size;
    const counts = new Map();
    for (const e of pool({ ...F, types: null }, true)) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    setTypeCounts(counts);
    const mmCount = F.mm ? 0 : pool({ ...F, mm: true }, true).filter(mainMain).length;

    const stat = new Map();
    for (const e of es0) {
      for (const [k, other] of [[e.from, e.to], [e.to, e.from]]) {
        const s = stat.get(k) ?? stat.set(k, { nb: new Set(), w: 0, before: new Set(), after: new Set() }).get(k);
        s.nb.add(other);
        s.w += effCount(e, F);
        (k === e.from ? s.after : s.before).add(other);
      }
    }
    let keep = [...stat.keys()];
    const total = keep.length;
    const cap = F.wide ? NET_CAP_MAX : NET_CAP;
    const capped = total > cap;
    if (capped) {
      keep.sort((a, b) => stat.get(b).nb.size - stat.get(a).nb.size || stat.get(b).w - stat.get(a).w || units.get(a).order - units.get(b).order);
      keep = keep.slice(0, cap);
    }
    const keepSet = new Set(keep);
    const es = es0.filter((e) => keepSet.has(e.from) && keepSet.has(e.to));
    const deg = new Map(keep.map((k) => [k, 0]));
    for (const e of es) { deg.set(e.from, deg.get(e.from) + 1); deg.set(e.to, deg.get(e.to) + 1); }

    summary.replaceChildren(
      h('span', { class: 'lk-sum-main' }, `${LABELS.netNodes} ${fmt.num(keep.length)} · ${LABELS.lines} ${fmt.num(es.length)}`),
      ...hiddenNote(hiddenCut, 0),
      h('span', { class: 'lk-legend-note' }, LABELS.widthKey, ' · ', LABELS.flowKey));

    if (!es.length) {
      body.append(emptyState(LABELS.netEmpty, { cut: hiddenCut, filtered: filtered(F) }));
      renderDetail();
      return;
    }
    if (capped) {
      body.append(h('div', { class: 'notice notice-warn lk-cap' },
        h('span', {}, LABELS.netCap(cap, total)), ' ',
        !F.wide && total > NET_CAP ? h('button', { type: 'button', class: 'btn lk-btn', onClick: () => setP({ nn: '150' }) }, LABELS.netWide(NET_CAP_MAX)) : null, ' ',
        F.minS < 3 ? h('button', { type: 'button', class: 'btn lk-btn', onClick: () => setP({ s: '3' }) }, `${LABELS.netReduce}: ${LABELS.netStrong}`) : null, ' ',
        !F.types || [...F.types].some((t) => !STORY_TYPES.has(t)) ? h('button', { type: 'button', class: 'btn lk-btn', onClick: () => setP({ ty: [...STORY_TYPES].filter((t) => typesPresent.includes(t)).join(',') }) }, `${LABELS.netReduce}: ${LABELS.netStoryOnly}`) : null));
    }
    if (!d3) { body.append(ui.notice(LABELS.svgOff, 'warn')); return; }
    body.append(h('div', { class: 'lk-nettools' }, ui.toggle({ label: LABELS.netMainMain(fmt.num(F.mm ? pool({ ...F, mm: true }, true).filter(mainMain).length : mmCount)), checked: F.mm, onChange: (on) => setP({ mm: on ? '1' : null, pr: null }) })));

    // 자리 잡기
    const W = Math.max(520, (body.clientWidth || 900) - 2);
    const LEFT = 92;
    const RIGHT = 18;
    const TOP = 30;
    const ROW = 20;
    const orders = idx.unitList.filter((u) => inCut(F, u) && inRange(F, u)).map((u) => u.order);
    const sx = d3.scaleLinear().domain([Math.min(...orders), Math.max(...orders)]).range([LEFT, W - RIGHT]);
    const laneKinds = fmt.KIND_ORDER.filter((k) => keep.some((key) => units.get(key).kind === k));
    const pos = new Map();
    const lanes = [];
    let yCursor = TOP;
    for (const kind of laneKinds) {
      const ks = keep.filter((key) => units.get(key).kind === kind).sort((a, b) => units.get(a).order - units.get(b).order);
      const rows = [];
      for (const key of ks) {
        const u = units.get(key);
        const r = 4 + Math.min(4.5, Math.sqrt(deg.get(key)) * 0.7);
        const x = sx(u.order);
        let i = rows.findIndex((right) => x - r - 2 >= right);
        if (i < 0) { i = rows.length; rows.push(-Infinity); }
        rows[i] = x + r + 2;
        pos.set(key, { x, r, row: i, kind, key });
      }
      const hgt = Math.max(1, rows.length) * ROW + 12;
      for (const key of ks) { const p = pos.get(key); p.y = yCursor + 6 + p.row * ROW + ROW / 2; }
      lanes.push({ kind, top: yCursor, h: hgt });
      yCursor += hgt;
    }
    const H = yCursor + 6;

    const wrap = h('div', { class: 'lk-net' });
    const svg = d3.select(wrap).append('svg').attr('class', 'lk-netsvg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', `${LABELS.netNodes} ${keep.length} · ${LABELS.lines} ${es.length}`);
    // 행 띠 + 이름
    for (const [i, l] of lanes.entries()) {
      svg.append('rect').attr('class', `lk-lane${i % 2 ? ' is-alt' : ''}`).attr('x', 0).attr('y', l.top).attr('width', W).attr('height', l.h);
      svg.append('text').attr('class', 'lk-lane-label').attr('x', 10).attr('y', l.top + 20).text(kindLabel(l.kind));
    }
    // 가로 눈금 — 메인 챕터 10개마다
    const gAxis = svg.append('g').attr('class', 'lk-axis');
    gAxis.append('text').attr('class', 'lk-axis-title').attr('x', 10).attr('y', 18).text(`${TERM.order} →`);
    for (const u of idx.unitList) {
      if (u.kind !== 'main' || u.num == null || u.num % 10 !== 0 || !inCut(F, u)) continue;
      const x = sx(u.order);
      gAxis.append('line').attr('x1', x).attr('x2', x).attr('y1', 24).attr('y2', H).attr('class', 'lk-axis-line');
      gAxis.append('text').attr('x', x).attr('y', 18).attr('text-anchor', 'middle').text(`CH.${String(u.num).padStart(2, '0')}`);
    }
    // 선 — 약한 종류부터 그려 이야기 연결이 위로
    const gE = svg.append('g').attr('class', 'lk-nedges');
    const drawOrder = [...es].sort((a, b) => (WEIGHT[a.type] ?? 0) - (WEIGHT[b.type] ?? 0) || a.strength - b.strength);
    const pathOf = (e) => {
      const p1 = pos.get(e.from);
      const p2 = pos.get(e.to);
      const xm = (p1.x + p2.x) / 2;
      if (p1.kind === p2.kind) {
        const bulge = Math.min(34, Math.abs(p2.x - p1.x) * 0.22 + 6);
        return `M${p1.x},${p1.y}Q${xm},${Math.min(p1.y, p2.y) - bulge} ${p2.x},${p2.y}`;
      }
      return `M${p1.x},${p1.y}C${xm},${p1.y} ${xm},${p2.y} ${p2.x},${p2.y}`;
    };
    const selPair = F.pr;
    const edgeSel = gE.selectAll('path.lk-nedge').data(drawOrder).join('path')
      .attr('class', (e) => `lk-nedge lk-t-${TYPE_CLASS[e.type]}${e.unconfirmed ? ' is-cand' : ''}${selPair === `${e.from}>${e.to}` && (!F.lt || F.lt === e.type) ? ' is-active' : ''}`)
      .attr('d', pathOf).attr('stroke-width', (e) => netW(effCount(e, F)));
    const gHit = svg.append('g').attr('class', 'lk-nhits');
    gHit.selectAll('path').data(drawOrder).join('path').attr('class', 'lk-nhit').attr('d', pathOf)
      .on('mouseenter', (ev, e) => showTip(ev, lineTip(e)))
      .on('mousemove', (ev) => moveTip(ev))
      .on('mouseleave', hideTip)
      .on('click', (ev, e) => { hideTip(); state.set({ p: { pr: `${e.from}>${e.to}`, lt: e.type, n: null } }); });
    // 점 + 몇 개의 이름
    const gN = svg.append('g').attr('class', 'lk-nnodes');
    const nodeData = keep.map((k) => ({ key: k, ...pos.get(k), unit: units.get(k), st: stat.get(k), deg: deg.get(k) }));
    const nodeSel = gN.selectAll('g.lk-nnode').data(nodeData).join('g').attr('class', 'lk-nnode').attr('data-key', (d) => d.key).attr('transform', (d) => `translate(${d.x},${d.y})`);
    nodeSel.append('circle').attr('class', 'lk-nhit-dot').attr('r', (d) => d.r + 6);
    nodeSel.append('circle').attr('class', 'lk-ndot').attr('r', (d) => d.r);
    nodeSel
      .on('mouseenter', (ev, d) => { netHighlight(d.key); showTip(ev, nodeTip(d)); })
      .on('mousemove', (ev) => moveTip(ev))
      .on('mouseleave', () => { netHighlight(null); hideTip(); })
      .on('click', (ev, d) => { hideTip(); state.set({ sel: `unit:${d.key}`, p: { pr: null, lt: null } }); })
      .on('dblclick', (ev, d) => { hideTip(); recenter(d.key); });
    // 이름표 — 많이 이어진 순으로 겹치지 않는 것만
    const placed = [];
    const gL = svg.append('g').attr('class', 'lk-nlabels');
    for (const d of [...nodeData].sort((a, b) => b.deg - a.deg).slice(0, 14)) {
      const text = clip(d.unit.title, 14);
      const w = [...text].length * 7.4 + 6;
      const box = { x0: d.x + d.r + 3, x1: d.x + d.r + 3 + w, y0: d.y - 8, y1: d.y + 8 };
      if (box.x1 > W - 4 || placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue;
      placed.push(box);
      gL.append('text').attr('class', 'lk-nlabel').attr('x', box.x0).attr('y', d.y + 4).text(text);
    }
    body.append(wrap);
    const bar = h('div', { class: 'lk-netbar' });
    body.append(bar);
    netView = { svg, edgeSel, nodeSel, gL, keep, keepSet, es, stat, bar, W };

    const topKey = keep.reduce((best, k) => (best == null || deg.get(k) > deg.get(best) ? k : best), null);
    netView.topKey = topKey;
    function netHighlight(key) {
      const k = key ?? (selUnit() && keepSet.has(selUnit()) ? selUnit() : topKey);
      const on = k && keepSet.has(k);
      edgeSel.classed('is-dim', (e) => on && e.from !== k && e.to !== k).classed('is-hi', (e) => on && (e.from === k || e.to === k));
      const nbs = on ? stat.get(k).nb : null;
      nodeSel.classed('is-dim', (d) => on && d.key !== k && !nbs.has(d.key)).classed('is-sel', (d) => d.key === k);
    }
    netView.highlight = netHighlight;
    netHighlight(null);
    renderNetBar();
    body.append(netTable(es));
    renderDetail();
  }
  /** 그림 대신 읽는 표 — 정렬 · 쪽 나눔, 줄을 누르면 근거가 아래에 나온다 */
  function netTable(es) {
    const holder = h('div', { class: 'lk-nettable' });
    const det = ui.details(`${LABELS.asTable} · ${LABELS.lines} ${fmt.num(es.length)}`, holder, { class: 'lk-nettable-wrap' });
    let built = false;
    det.addEventListener('toggle', () => {
      if (!det.open || built) return;
      built = true;
      const rows = [...es].sort((x, y) => y.strength - x.strength || effCount(y, F) - effCount(x, F) || x.a.order - y.a.order)
        .map((e) => ({ id: e.id, e, from: e.a.title, to: e.b.title, type: e.type, count: effCount(e, F), strength: e.strength }));
      const tbl = ui.table({
        rowKey: 'id', pageSize: 20, rows, empty: LABELS.netEmpty,
        onRow: (r) => setP({ pr: `${r.e.from}>${r.e.to}`, lt: r.type, n: null }),
        columns: [
          { key: 'from', label: LABELS.colFrom, render: (r) => ui.link(`unit:${r.e.from}`, r.from) },
          { key: 'to', label: LABELS.colTo, render: (r) => ui.link(`unit:${r.e.to}`, r.to) },
          { key: 'type', label: LABELS.lineKind, nowrap: true, render: (r) => h('span', { class: `lk-t-${TYPE_CLASS[r.type]}` }, typeKey(r.type), ' ', typeLabel(r.type)), sort: (x, y) => (typeRank.get(x.type) ?? 9) - (typeRank.get(y.type) ?? 9) },
          { key: 'count', label: LABELS.colCount, num: true },
          { key: 'strength', label: LABELS.colLevel, num: true, render: (r) => LABELS.level[r.strength] },
        ],
      });
      holder.append(tbl.el);
    });
    return det;
  }
  function nodeTip(d) {
    return h('div', { class: 'lk-tip-body' },
      h('div', { class: 'lk-tip-title' }, d.unit.title),
      h('div', {}, kindLabel(d.unit.kind), ' · ', when(d.unit)),
      h('div', {}, `${LABELS.neighbors} ${fmt.num(d.st.nb.size)}`, h('span', { class: 'muted' }, ` (${LABELS.before} ${fmt.num(d.st.before.size)} · ${LABELS.after} ${fmt.num(d.st.after.size)})`)));
  }
  /** 전체 보기 아래 한 줄 — 고른 스토리와 이웃 보기로 가는 단추, 없으면 사용법 */
  function renderNetBar() {
    const nv = netView;
    if (!nv?.bar) return;
    const picked = selUnit() && nv.keepSet.has(selUnit()) ? selUnit() : null;
    const k = picked ?? nv.topKey;
    const st = k && nv.keepSet.has(k) ? nv.stat.get(k) : null;
    ui.clear(nv.bar);
    if (st) {
      const u = units.get(k);
      nv.bar.append(h('span', { class: 'lk-netsel' }, h('span', { class: 'ctl-name' }, picked ? LABELS.netSel : LABELS.netTop), ' ', ui.link(`unit:${k}`, u.title), ' ', kindText(u), ' ', h('span', { class: 'muted' }, `${when(u)} · ${LABELS.neighbors} ${fmt.num(st.nb.size)} (${LABELS.before} ${fmt.num(st.before.size)} · ${LABELS.after} ${fmt.num(st.after.size)})`)),
        h('button', { type: 'button', class: 'btn lk-btn', onClick: () => recenter(k) }, `${LABELS.mode.ego} — ${LABELS.recenter}`));
    }
    nv.bar.append(h('span', { class: 'muted lk-nethint' }, LABELS.netHint));
  }

  // ── 연작 ──
  function renderChain() {
    ui.clear(body);
    body.className = 'lk-body lk-body-chain';
    view = null;
    netView = null;
    const ok = (u) => inCut(F, u) && inRange(F, u);
    const groups = { manual: [], auto: [] };
    let hiddenChains = 0;
    let unitCount = 0;
    for (const ch of links.chains) {
      const us = ch.units.map((k) => units.get(k)).filter(Boolean);
      if (!us.length) continue;
      if (!ok(us[0])) { hiddenChains++; continue; }
      let cutAt = us.findIndex((u) => !ok(u));
      if (cutAt < 0) cutAt = us.length;
      const shown = us.slice(0, cutAt);
      const keys = new Set(shown.map((u) => u.key));
      const es = ch.edges.filter((e) => keys.has(e.from) && keys.has(e.to));
      unitCount += shown.length;
      groups[ch.edges.some((e) => e.origin === 'manual') ? 'manual' : 'auto'].push({ ch, shown, es, tail: us.length - cutAt });
    }
    const shownChains = groups.manual.length + groups.auto.length;
    summary.replaceChildren(
      h('span', { class: 'lk-sum-main' }, `${LABELS.chainCount(fmt.num(shownChains))} · ${LABELS.netNodes} ${fmt.num(unitCount)}`),
      ...hiddenNote(hiddenChains, 0));
    if (!shownChains) { body.append(emptyState(LABELS.chainEmpty, { cut: hiddenChains })); return; }
    for (const kind of ['manual', 'auto']) {
      if (!groups[kind].length) continue;
      body.append(h('h3', { class: 'lk-chain-group' }, LABELS.chainGroup[kind], h('span', { class: 'lk-col-n' }, fmt.num(groups[kind].length))));
      const wrap = h('div', { class: 'lk-chains' });
      for (const item of groups[kind]) wrap.append(chainCard(item));
      body.append(wrap);
    }
  }
  function chainCard({ ch, shown, es, tail }) {
    const first = shown[0];
    const last = shown[shown.length - 1];
    const edgeBetween = (a, b) => es.find((e) => e.from === a.key && e.to === b.key);
    const flow = h('ol', { class: 'lk-flow' });
    if (ch.linear) {
      shown.forEach((u, i) => {
        if (i > 0) {
          const e = edgeBetween(shown[i - 1], u);
          flow.append(h('li', { class: 'lk-conn', 'aria-hidden': 'true', title: e ? `${ORIGIN[e.origin] ?? e.origin} · ${TERM.strength} ${LABELS.level[e.strength]}` : '' },
            h('i', { class: `lk-key lk-t-sequel${e?.strength < 3 ? ' is-weakish' : ''}` }), e ? h('span', { class: 'lk-conn-lvl' }, LABELS.level[e.strength]) : null));
        }
        flow.append(h('li', { class: 'lk-chain-node' }, chainNode(u)));
      });
    }
    const notes = es.filter((e) => e.note);
    const noteRows = es.map((e) => h('li', { class: 'lk-chain-note' },
      h('span', { class: 'lk-chain-pair' }, units.get(e.from)?.title, h('span', { class: 'lk-darrow' }, ui.icon('arrow')), units.get(e.to)?.title),
      ' ', h('span', { class: 'muted' }, `${ORIGIN[e.origin] ?? e.origin} · ${TERM.strength} ${LABELS.level[e.strength]}`),
      e.note ? h('p', { class: 'lk-note' }, fmt.plain(e.note)) : null,
      e.record ? h('span', { class: 'mono lk-rid' }, e.record) : null));
    return h('article', { class: 'lk-chain' },
      h('header', { class: 'lk-chain-head' }, h('strong', {}, `${fmt.num(shown.length)}편`), ch.linear ? null : h('span', { class: 'muted' }, '갈래 있음'),
        h('span', { class: 'muted' }, `${first.title}${shown.length > 1 ? ` … ${last.title}` : ''}`)),
      ch.linear ? flow : h('ol', { class: 'lk-flow lk-flow-tree' }, shown.map((u) => h('li', { class: 'lk-chain-node' }, chainNode(u)))),
      tail > 0 ? h('p', { class: 'lk-chain-tail muted' }, LABELS.chainHiddenTail(tail)) : null,
      ch.linear && !notes.length ? null : ui.details(`${LABELS.chainNotes} ${fmt.num(es.length)}`, h('ul', { class: 'lk-chain-notes' }, noteRows), { open: !ch.linear }));
  }
  function chainNode(u) {
    const key = u.key;
    return h('div', { class: ['lk-node', selUnit() === key ? 'is-sel' : ''], dataset: { key } },
      h('div', { class: 'lk-node-top' },
        h('button', { type: 'button', class: 'lk-title', title: u.title, onClick: () => state.set({ sel: `unit:${key}` }) }, u.title),
        h('button', { type: 'button', class: 'lk-recenter', title: LABELS.recenterTitle, 'aria-label': `${u.title} — ${LABELS.recenterTitle}`, onClick: () => recenter(key) }, LABELS.recenter, ui.icon('arrow'))),
      h('div', { class: 'lk-node-meta' }, kindText(u), h('span', { class: 'lk-dot' }, '·'), when(u)));
  }

  // ── 그리기 · 갱신 ──
  const p0 = () => state.get().p ?? {};
  function setTypeCounts(counts) { typeChips.sync(F.types, counts); }
  function syncControls() {
    modeSeg.set(F.mode);
    strengthSeg.set(String(F.minS));
    targetCombo.set(F.tg ? fmt.targetName(F.tg) : '');
    if (candT !== F.T) { candT = F.T; cand = candidatesFor(F.T); rebuildThreadOptions(); }
    threadSelect.value = F.th ?? '';
    kindChips.sync(F.kinds);
    typeChips.sync(F.types);
    const chain = F.mode === 'chain';
    controls.hidden = chain;
    barMain.querySelector('.lk-field-center').hidden = F.mode !== 'ego';
    filterBtn.classList.toggle('is-solo', F.mode !== 'ego');
    const active = [F.mode === 'net' ? Boolean(p0().ty) : Boolean(F.types), F.minS !== 2, Boolean(F.tg), Boolean(F.th), Boolean(F.kinds)].filter(Boolean).length;
    const badge = filterBtn.querySelector('.lk-filter-n');
    badge.textContent = active ? ` ${active}` : '';
  }
  function render() {
    detailToken++;
    if (F.mode === 'ego') { netView = null; renderEgo(); renderInner(); }
    else {
      view = null;
      inner.hidden = true;
      innerKey = '';
      if (F.mode === 'net') renderNet(); else { detail.hidden = true; ui.clear(detail); setTypeCounts(null); renderChain(); }
    }
  }
  /** 컷오프 · 거르개가 바뀔 때 — 스크롤이 튀지 않게 높이를 잠시 붙잡고 다시 그린다 */
  function refresh(force = false) {
    if (!alive) return;
    F = readF(state.get());
    syncControls();
    const nextSig = `${structSig(F)}|${F.mode === 'ego' ? F.center ?? '' : ''}`;
    if (force || nextSig !== sig) {
      sig = nextSig;
      const hgt = body.offsetHeight;
      body.style.minHeight = `${hgt}px`;
      render();
      requestAnimationFrame(() => { body.style.minHeight = ''; });
      return;
    }
    // 고른 이웃 · 선만 바뀐 경우
    if (F.mode === 'ego') { updateEgoActive(); renderDetail(); }
    else if (F.mode === 'net') {
      netView?.edgeSel?.classed('is-active', (e) => F.pr === `${e.from}>${e.to}` && (!F.lt || F.lt === e.type));
      netView?.highlight?.(null);
      renderNetBar();
      renderDetail();
    }
  }
  function syncSelection() {
    if (F.mode === 'ego' && view?.el) {
      const k = selUnit();
      for (const card of view.el.querySelectorAll('.lk-node')) card.classList.toggle('is-sel', card.dataset.key === k);
    } else if (F.mode === 'net' && netView) {
      netView.highlight?.(null);
      renderNetBar();
    } else if (F.mode === 'chain') {
      const k = selUnit();
      for (const card of body.querySelectorAll('.lk-node')) card.classList.toggle('is-sel', card.dataset.key === k);
    }
  }

  const off = state.subscribe((s, changed) => {
    if (!alive || s.tab !== meta.id) return;
    if (changed.has('p') || changed.has('t') || changed.has('layers')) refresh();
    else if (changed.has('sel')) syncSelection();
  });
  let resizeTimer = null;
  let lastWidth = 0;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const w = body.clientWidth;
    if (!alive || !w) return;
    if (F.mode === 'ego') layoutEgo();
    else if (F.mode === 'net' && Math.abs(w - lastWidth) > 24) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (alive && F.mode === 'net') renderNet(); }, 160);
    }
    lastWidth = w;
  }) : null;
  ro?.observe(body);
  let scrollQueued = false;
  const onScroll = () => {
    if (scrollQueued || F.mode !== 'ego') return;
    scrollQueued = true;
    requestAnimationFrame(() => { scrollQueued = false; if (alive) updatePorts(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // 다른 탭에서 스토리를 고른 채 들어오면 그 스토리가 가운데
  {
    const s0 = state.get();
    const sp = state.parseSel(s0.sel);
    if (!s0.p.c && !s0.p.m && sp?.type === 'unit' && units.has(sp.id)) state.set({ p: { c: sp.id } }, { replace: true });
  }
  refresh(true);
  (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 800)))(() => { if (alive) loadScenes().catch(() => {}); });

  return () => {
    alive = false;
    off();
    window.removeEventListener('scroll', onScroll);
    ro?.disconnect();
    clearTimeout(resizeTimer);
    tipNode.remove();
  };
}
