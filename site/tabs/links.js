/**
 * 탭 2 연결(W3) — 화면 2 "스토리 간 연결"(docs/views.md 2절, 규칙 docs/schema.md "관계선").
 * 팬의 질문: 이 스토리는 어디와, 왜 이어지나. 스토리 하나를 가운데 두고 앞뒤로 이어진 스토리를 보는 것이 기본(이웃)이고, 필터로 줄인 전체(전체)와 연작 사슬(연작)도 본다.
 * 선을 누르면 그 선의 장면 → 장면과 "왜 이어졌나" 한 문장이 아래에 나온다.
 *
 * 쓰는 JSON
 *   links.json(이 탭 — tools/site/export/links.mjs): edges[3,370](스토리 쌍 × 선 종류 — from → to는 읽는 순서 · count 연결된 씬 수 · strength 1–3 · origin ·
 *     records · targets · threads · weak 약한 연결 수 · note) · chains[](메인 밖 다음 편 사슬) · targets[](중심 항목 — common = 자주 나오는 인물 · 항목)
 *   links-scenes.json(씬 엣지 6,257 — 선 하나의 근거. 선을 누를 때 처음 받는다): type · s · from/fl · to/tl · fu/tu · record · act · point · target · fb/tb · note
 *   공용(idx): units(제목 · 종류 · 출시 시점) · scenes(씬 제목) · ticks · threads · targets, 기록 문장은 처음 근거를 보일 때 idx.withRecords()로 받는다
 *
 * URL 파라미터(p.*) — 기본값이면 URL에서 뺀다
 *   m    ego(이웃, 기본) | net(전체) | chain(연작)
 *   ck   중심 스토리를 고를 스토리 종류(1단계). 없으면 전부. 가운데 후보 · 기본 가운데를 그 종류로 좁힌다(가운데를 직접 고르면 그 스토리가 우선)
 *   c    이웃 보기의 가운데 스토리 키. 없으면 지금 필터 · 여기까지 읽음에서 가장 많이 이어진 스토리(탭 안을 만지면 그 스토리를 c에 못박는다, 다른 탭에서 sel=unit:키를 들고 들어오면 그 스토리)
 *   n    이웃 보기에서 고른 앞/뒤 스토리 키(아래 근거의 대상). 없으면 가장 센 연결의 스토리
 *   pr   전체 보기에서 고른 선 "from>to"
 *   lt   고른 선 종류(sequel · setup_payoff · callback · reversal · character · keyword), 없으면 그 쌍의 전부
 *   ty   보일 선 종류(쉼표) 또는 all. 없으면 이웃 보기는 전부, 전체 보기는 이야기 연결 넷(다음 편 · 떡밥→회수 · 다시 언급 · 뒤집힘)
 *   s    세기 1(전부) | 2(보통 이상, 기본) | 3(강함) — 화면 말은 '세기'(연결 강도라는 판정 말은 쓰지 않는다 — W13e)
 *   tg   인물 · 항목 ID(예 person:라피). 이 항목이 걸린 선만. 고를 수 있는 후보는 지금 가운데 · 필터에서 보이는 선에 걸린 것만
 *   th   떡밥 ID(예 J1). 이 떡밥에 걸린 선만
 *   kd   보일 스토리 종류(쉼표). 없으면 전부. 이웃 보기에서는 가운데 말고 이웃에만 건다
 *   nn   전체 보기에서 그릴 스토리 수 150(기본 80)
 *   mm   1이면 전체 보기에 메인끼리의 선도 그린다(기본은 뺀다 — 메인 챕터 사이 선이 전체의 4분의 1이라 나머지가 가려진다)
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13e)
 *   스토리 쌍 하나 + 선 종류 하나 = 선 하나(links.json edges 한 줄). 방향은 늘 읽는 순서(출시순 한 줄)라 왼쪽 → 오른쪽이다.
 *   색 = 선 종류(이 그림의 축 — 다음 편 파랑 · 떡밥→회수 주황 · 다시 언급 청록 · 뒤집힘 빨강, dataviz 검증 팔레트 순서 [빨강 파랑 주황 청록], 같은 인물 · 같은 소재는 회색 실선 · 점선),
 *   굵기 = 연결된 씬 수(세기 2 이상만 볼 때는 약한 연결 weak를 뺀 수 — 범례 글은 없다). 이 탭에는 스토리 종류 색이 없다 —
 *   종류는 회색 글자로 쓰고 전체 보기에서는 가로 띠(행)가 종류다(색 두 갈래가 겹치지 않게).
 *   작업 흔적은 화면에 내지 않는다: 만든 방법(키 규칙 · 기록 · 직접 확정 · 게임 조건), 세기 이름, 씬 · 선 · 이웃 개수, 근거 칸 수(말한 줄 · 이름 줄), 기록 ID.
 *     '추정'만 예외로 단다(해석이 추정일 때만). 개수는 '더 보기 (N)'과 스포일러 안내뿐.
 *   카드 = 제목(메인은 굵은 CH 표기) + 회색 작은 글자(종류 · 자리 — 메인은 제목이 다 말하므로 없다) + 선 종류 단추(선 견본 + 이름).
 *   자주 나오는 인물 · 항목(links.json targets.common)만 나눈 연결은 세기 1이라 기본(세기 2 이상)에서 빠진다. 그 항목을 인물 · 항목 필터로 고르면 풀린다.
 *   안 본 스토리(state.reading().seen — 메인 자리 t + 척추 이벤트 · 사이드 예외 x, 출시 자리로 정하지 않는다)의 선은 숨기고
 *   개수만 보인다("스포일러로 가린 N"). 선 · 근거는 양 끝 스토리를 다 봤을 때만, 인물 · 항목 · 떡밥 필터 후보도 그런 선에서만. 안 본 스토리를 가운데로 둘 수 없다.
 *   이웃 보기: 가운데 카드 + 앞(먼저 나온)·뒤(뒤에 나온) 스토리 카드, 선은 카드 사이 곡선. 한쪽 8장씩 연결이 센 순(이야기 연결 → 세기 → 씬 수)으로 뽑아 출시순으로 놓고 "더 보기".
 *   전체 보기: 행 = 스토리 종류, 가로 = 출시순, 점 = 스토리(크기 = 이어진 스토리 수). 이야기 연결(다음 편 · 떡밥→회수 · 다시 언급 · 뒤집힘)만 기본, 많이 이어진 80편만 그리고 "150편까지"로 넓힌다(상한 150).
 *   연작: links.json chains를 첫 편의 스토리 종류로 묶는다. 처음 안 본 편부터 뒤는 가리고 첫 편이 가려진 사슬은 개수만 센다. 직접 읽고 이은 연작의 까닭 문장만 접이 안에(키로 이은 '다음 편'은 당연해서 쓰지 않는다).
 *   카드를 누르면 sel=unit:키(리더 패널)와 그 쌍의 근거, 카드의 "중심으로" 단추 또는 더블클릭이면 그 스토리가 가운데가 된다.
 *   가운데 카드는 스크롤을 따라 붙고(sticky) 선의 가운데 쪽 끝이 따라 움직인다. 640px 아래에서는 앞 → 가운데 → 뒤를 세로 한 줄로 접고 선 대신 선 종류 단추로 본다.
 *   근거: 선 종류별 구역, 한 줄 = 장면 → 장면(제목에 두 스토리가 있으니 장면 이름만 — fmt.sceneName) + "왜 이어졌나" 한 문장(whyOf):
 *     떡밥 회수 = 풀린 의문의 문장(일부만 풀렸으면 '일부 회수'), 복선 · 다시 언급 · 드러남 · 뒤집힘 = 그 기록 문장(없으면 가리키는 사실 · 의문), 직접 이은 연작 = 그 까닭(fmt.prose),
 *     같은 인물 · 소재 = 두 장면에 함께 나온 이름(같은 장면 쌍은 한 줄로 묶는다), 키로 이은 다음 편 = 문장 없음. 문장은 기록으로 가는 링크(ID는 안 보인다).
 *     선에 마우스를 올리면 말풍선에 그 선의 한 문장(edgeWhy). 세기 설정으로 가린 약한 연결은 "약한 연결도 보기" 단추만.
 *   이 스토리 안의 연결(접이): 같은 스토리 안 장면 → 장면. 한 스토리 안 선행(호감도 1편 → 2편)은 당연해서 뺀다.
 *
 * 리더 패널 "관계선" 칸 잇는 법(공용 reader.js — 부모가 한다): data.load('links-scenes') → 씬 ID로 e.from === id || e.to === id,
 *   스토리 키로 e.fu === key || e.tu === key(같은 스토리 안은 fu === tu). 선 종류 e.type, 근거 줄 e.fl · e.tl, 기록 e.record. 이 탭 열기: #tab=links&p.c=<스토리 키>.
 */
export const meta = { id: 'links', title: '연결', blurb: '스토리 사이의 연결 — 이웃 · 전체 · 연작' };

/** 이 탭 말(fmt에 없는 것만) — 고칠 때는 여기 한 곳만. 팬이 묻는 말만 쓴다(만든 방법 · 판정 말 · 작업량 숫자는 없다 — W13e) */
const LABELS = {
  mode: { ego: '이웃', net: '전체', chain: '연작' },
  modeLabel: '보기',
  modeHelp: { ego: '스토리 하나와 앞뒤로 이어진 스토리', net: '전체 연결을 출시순으로', chain: '다음 편으로 이어지는 연작' },
  centerKind: '스토리 종류',
  centerKindAll: '전체 종류',
  center: '중심 스토리',
  centerPh: '스토리 이름으로 찾기',
  filters: '필터',
  centerTop: '많이 이어진 스토리',
  centerNone: '찾는 스토리가 없다',
  target: '인물 · 항목',
  targetPh: '인물 · 항목 찾기',
  targetClear: '인물 · 항목 필터 지우기',
  targetTop: '많이 걸린 항목',
  thread: '떡밥',
  threadAll: '떡밥 전체',
  lineKind: '선 종류',
  kindFilter: '스토리 종류',
  strength: '세기',
  strengthOpts: (common) => [
    { value: '1', label: '전부', title: `${common}만 겹치는 것까지` },
    { value: '2', label: '보통 이상', title: `${common}만 겹치는 것은 뺀다` },
    { value: '3', label: '강함', title: '바로 이어지는 다음 편 · 확실한 떡밥 연결만' },
  ],
  beforeHead: '먼저 나온 스토리',
  afterHead: '뒤에 나온 스토리',
  centerMark: '가운데',
  recenter: '중심으로',
  recenterTitle: '이 스토리를 가운데로 놓고 보기',
  more: (n) => `더 보기 (${n})`,
  noNeighbors: '이 스토리와 이어진 스토리가 없다',
  noNeighborsFiltered: '필터에 걸리는 연결이 없다',
  allHidden: '이어진 스토리가 모두 스포일러로 가려져 있다',
  resetFilters: '필터 풀기',
  centerHidden: '이 스토리는 아직 안 읽은 스토리라 가렸다',
  detailTitle: '이어진 장면',
  allTypes: '전체',
  weakShow: '약한 연결도 보기',
  inner: '이 스토리 안의 연결',
  partial: '일부 회수',
  netCap: (n) => `많이 이어진 ${n}편만 그렸다`,
  netWide: (n) => `${n}편까지 보기`,
  netMainMain: '메인끼리의 선도 그리기',
  netTop: '가장 많이 이어진 스토리',
  netSel: '고른 스토리',
  netEgo: '이웃 보기',
  netHint: '선을 누르면 이어진 장면이 아래에 나온다',
  netEmpty: '그릴 연결이 없다',
  netAria: '스토리 연결 그림',
  axis: '출시순 →',
  asTable: '표로 보기',
  colFrom: '앞 스토리',
  colTo: '뒤 스토리',
  chainBranch: '갈래 있음',
  chainEmpty: '보일 연작이 없다',
  chainLen: (n) => `${n}편`,
  chainHiddenTail: (n) => `뒤 ${n}편은 스포일러로 가렸다`,
  chainNotes: '이어지는 까닭',
  svgOff: '그림을 그리지 못했다 — 카드의 선 종류 단추로 이어진 장면을 볼 수 있다.',
  loadingEvidence: '불러오는 중…',
  noRows: '이 조건에 맞는 장면이 없다',
};

/** 선 종류별 이야기 연결 정도 — 카드를 뽑는 순서와 색 구분에 쓴다 */
const WEIGHT = { sequel: 5, reversal: 4, setup_payoff: 4, callback: 3, character: 2, keyword: 1, prereq: 1 };
const STORY_TYPES = new Set(['sequel', 'setup_payoff', 'callback', 'reversal']);
const TYPE_IDS = ['sequel', 'setup_payoff', 'callback', 'reversal', 'character', 'keyword'];
const TYPE_CLASS = { sequel: 'sequel', setup_payoff: 'payoff', callback: 'callback', reversal: 'reversal', character: 'character', keyword: 'keyword', prereq: 'prereq' };

const STEP = 8; // 한쪽에 처음 보이는 카드 수 · 더 보기 한 번의 수
const ROW_STEP = 12; // 근거 목록에서 한 번에 보이는 장면 줄 수
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
  /** 메인 제목의 'CH.12'를 굵게(.ch — 감상 순서와 같은 표기) */
  const chTitle = (u) => {
    const m = u.kind === 'main' ? /^(CH\.\d+)\s*(.*)$/.exec(u.title) : null;
    return m ? [h('span', { class: 'ch' }, m[1]), m[2] ? ` ${m[2]}` : null] : u.title;
  };
  /** 제목 아래 회색 글자 — 종류 · 자리. 메인은 제목(CH.12 …)이 다 말하므로 없다(같은 말을 두 번 쓰지 않는다) */
  const metaText = (u) => (u.kind === 'main' ? null : `${kindLabel(u.kind)} · ${when(u)}`);
  const metaLine = (u) => (u.kind === 'main' ? null : h('div', { class: 'lk-node-meta' }, kindLabel(u.kind), h('span', { class: 'lk-dot' }, '·'), when(u)));

  // 인물 · 항목 필터 후보 — 선에 걸린 항목, 걸린 선 수 순
  const targetUse = new Map();
  for (const e of edges) for (const t of e.targets) targetUse.set(t, (targetUse.get(t) ?? 0) + 1);
  const targetList = [...targetUse].map(([id, n]) => ({ id, n, name: fmt.targetName(id), type: idx.targets.get(id)?.type, common: commonSet.has(id) }))
    .sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'ko'));
  // 떡밥 필터 후보
  const threadUse = new Map();
  for (const e of edges) for (const t of e.threads) threadUse.set(t, (threadUse.get(t) ?? 0) + 1);
  const threadList = [...threadUse].map(([id, n]) => ({ id, n, title: idx.threads.get(id)?.title ?? id }))
    .sort((x, y) => x.title.localeCompare(y.title, 'ko'));
  /**
   * 인물 · 항목 · 떡밥 필터 후보 — 지금 가운데(이웃 보기) · 선 종류 · 세기 · 스토리 종류 · 읽은 자리에서 실제로 보이는 선에 걸린 것만.
   * 인물 후보는 고른 떡밥을, 떡밥 후보는 고른 인물 · 항목을 따른다(자기 자신의 필터는 후보를 줄이지 않는다). 걸린 선 수 순.
   */
  const candidatesFor = (F) => {
    const ctr = F.mode === 'ego' ? (F.center ? units.get(F.center) : bestCenter(F, degreesCached(F))) : null;
    const tu = new Map();
    const hu = new Map();
    for (const e of edges) {
      if (F.types && !F.types.has(e.type)) continue;
      if (!inCut(F, e.a) || !inCut(F, e.b)) continue;
      if (F.mode === 'ego') {
        if (!ctr || (e.from !== ctr.key && e.to !== ctr.key)) continue;
        if (!kindOk(F, e.from === ctr.key ? e.b : e.a)) continue;
      } else if (F.kinds && !F.kinds.has(e.a.kind) && !F.kinds.has(e.b.kind)) continue;
      if (!F.th || e.threads.includes(F.th)) for (const t of e.targets) if (e.strength >= F.minS || commonSet.has(t)) tu.set(t, (tu.get(t) ?? 0) + 1);
      if ((!F.tg || e.targets.includes(F.tg)) && (e.strength >= F.minS || relaxed(F, e))) for (const t of e.threads) hu.set(t, (hu.get(t) ?? 0) + 1);
    }
    const targets = targetList.filter((t) => tu.has(t.id)).map((t) => ({ ...t, n: tu.get(t.id) })).sort((x, y) => y.n - x.n || x.name.localeCompare(y.name, 'ko'));
    const threads = threadList.filter((t) => hu.has(t.id)).map((t) => ({ ...t, n: hu.get(t.id) }));
    return { targets, threads };
  };
  /** 여기까지 읽음 서명 — t와 척추 이벤트 · 사이드 예외(x)를 같이 담는다(캐시 · 다시 그리기 판단) */
  const cutSig = (R) => (R.all ? 'all' : `${R.t}|${Object.entries(R.x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${v ? '' : '-'}${k}`).join(',')}`);
  let cand = { targets: [], threads: [] }; // syncControls가 필터가 바뀔 때마다 다시 센다

  // ── 필터 (URL 파라미터 → F) ──
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
      ck: kindsPresent.includes(p.ck) ? p.ck : null,
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
      R: state.reading(s), // 여기까지 읽음 — 스토리마다 R.seen(키)
      cut: cutSig(state.reading(s)),
    };
  }
  /** 그 스토리를 봤나(여기까지 읽음 안) — 출시 자리가 아니라 스토리 단위(척추 이벤트 · 사이드 예외 x 반영) */
  const inCut = (F, u) => F.R.seen(u.key);
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
  const structSig = (F) => JSON.stringify([F.mode, F.ck, F.types && [...F.types], F.minS, F.tg, F.th, F.kinds && [...F.kinds], F.cut, F.wide, F.mm]);

  /** 스토리별 이어진 이웃 수(지금 필터 · 컷오프 · 범위 안, 종류 필터는 이웃에만) — 기본 가운데 · 후보 순서에 쓴다 */
  function degrees(F) {
    const nb = new Map();
    for (const e of edges) {
      if (!passEdge(e, F)) continue;
      if (!inCut(F, e.a) || !inCut(F, e.b)) continue;
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
      if (!u || !inCut(F, u) || (F.ck && u.kind !== F.ck)) continue;
      if (!best || set.size > best.n || (set.size === best.n && u.order < best.u.order)) best = { u, n: set.size };
    }
    if (best) return best.u;
    // 이어진 스토리가 하나도 안 보이면(컷오프가 이를 때) 가장 먼저 나온 스토리 — 가려진 이웃 수를 알려 줄 수 있다
    return idx.unitList.filter((u) => inCut(F, u) && (!F.ck || u.kind === F.ck)).sort((x, y) => x.order - y.order)[0] ?? null;
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

  // 탭 안 조작은 지금 가운데 스토리를 URL에 못박는다 — 가운데를 고른 적이 없으면(기본 가운데) 필터를 만질 때 가운데가 딴 스토리로 바뀌지 않게
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
  /** 기록으로 가는 링크 — ID는 화면에 내지 않는다(W13a). 문장을 아직 못 받았을 때만 '자세히' */
  const recordLink = (id) => (id && /^[A-Z]+\d/.test(id) && !/^Y\d/.test(id) ? ui.link(`record:${id}`, '자세히', { class: 'lk-rid' }) : null);
  /** 장면 링크 — 근거 머리에 두 스토리 이름이 있으니 장면 이름만('7장면 「…」') */
  const sceneLink = (id) => {
    const title = sceneTitle(id);
    if (!idx.scenes.has(id)) return h('span', { class: 'lk-scene' }, title ?? id); // 애장품 등 씬 목록에 없는 끝점
    return h('span', { class: 'lk-scene' }, ui.link(`scene:${id}`, fmt.sceneName(id), { title: fmt.ref(id) }));
  };

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
          h('span', { class: 'lk-opt-main' }, it.label), it.sub ? h('span', { class: 'lk-opt-sub' }, it.sub) : null);
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
      const pool = idx.unitList.filter((u) => inCut(F, u) && (!F.ck || u.kind === F.ck));
      const n = (u) => nb.get(u.key)?.size ?? 0;
      let items;
      if (!q) {
        items = pool.filter((u) => n(u) > 0).sort((x, y) => n(y) - n(x) || x.order - y.order).slice(0, 12)
          .map((u) => ({ value: u.key, label: u.title, sub: metaText(u), group: LABELS.centerTop }));
      } else {
        const f = fold(q);
        items = pool.map((u) => ({ u, k: fold(u.title).indexOf(f), k2: fold(u.key).indexOf(f) }))
          .filter((x) => x.k >= 0 || x.k2 >= 0)
          .sort((x, y) => (x.k === 0 ? 0 : 1) - (y.k === 0 ? 0 : 1) || n(y.u) - n(x.u) || x.u.order - y.u.order).slice(0, 30)
          .map(({ u }) => ({ value: u.key, label: u.title, sub: metaText(u), dim: !n(u) }));
      }
      return { items, empty: LABELS.centerNone };
    },
    onPick: (key) => state.set({ p: { c: key, n: null, lt: null, pr: null } }),
  });
  // 1단계: 스토리 종류(고르면 가운데를 그 종류의 가장 많이 이어진 스토리로 옮긴다 — 2단계에서 다른 스토리를 고른다)
  const kindSelect = h('select', { class: 'lk-select', 'aria-label': LABELS.centerKind, onChange: (e) => setP({ ck: e.target.value || null, c: null, n: null, lt: null, pr: null }) });
  const rebuildKindOptions = () => {
    const nb = degreesCached(F);
    const cnt = new Map();
    for (const u of idx.unitList) if (inCut(F, u) && nb.get(u.key)?.size) cnt.set(u.kind, (cnt.get(u.kind) ?? 0) + 1);
    kindSelect.replaceChildren(h('option', { value: '' }, LABELS.centerKindAll),
      ...kindsPresent.map((k) => h('option', { value: k, disabled: !cnt.get(k) && F.ck !== k }, kindLabel(k))));
    kindSelect.value = F.ck ?? '';
  };

  // 인물 · 항목 고르기
  const targetCombo = combobox({
    label: LABELS.target,
    placeholder: LABELS.targetPh,
    clearable: true,
    onClear: () => setP({ tg: null }),
    options: (q) => {
      let items;
      const toItem = (t, group) => ({ value: t.id, label: t.name, sub: fmt.TARGET_TYPE[t.type] ?? '', dim: t.common, group });
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
    h('option', { value: '' }, LABELS.threadAll));
  const rebuildThreadOptions = () => {
    const list = F.th && !cand.threads.some((t) => t.id === F.th) ? [...cand.threads, { id: F.th, title: idx.threads.get(F.th)?.title ?? F.th, n: 0 }] : cand.threads;
    threadSelect.replaceChildren(h('option', { value: '' }, LABELS.threadAll), ...list.map((t) => h('option', { value: t.id }, t.title)));
  };

  // 세기
  const strengthSeg = ui.segmented({ label: LABELS.strength, options: LABELS.strengthOpts(TERM.commonTargets), value: '2', onChange: (v) => setP({ s: v === '2' ? null : v, n: null, lt: null }) });

  // 모드
  const modeSeg = ui.segmented({
    label: LABELS.modeLabel,
    options: ['ego', 'net', 'chain'].map((m) => ({ value: m, label: LABELS.mode[m], title: LABELS.modeHelp[m] })),
    value: 'ego',
    onChange: (v) => state.set({ p: { m: v === 'ego' ? null : v, n: null, lt: null, pr: null } }),
  });

  // 켜고 끄는 칩 묶음 — 전부 켜짐이면 파라미터를 지운다. 개수는 쓰지 않고, 지금 보기에 하나도 없는 종류만 흐리게(예외만)
  function toggleChips({ items, name, getSel, onChange }) {
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
      } }, it.key ?? null, h('span', { class: 'lk-chip-label' }, it.label));
      buttons.set(it.id, b);
      wrap.append(b);
    }
    return {
      el: wrap,
      /** n: 종류별 선 수(Map) — 주면 0인 칩을 흐리게, null이면 흐림을 푼다, 안 주면 그대로 */
      sync(sel, n) {
        for (const [id, b] of buttons) {
          b.setAttribute('aria-pressed', String(!sel || sel.has(id)));
          if (n !== undefined) b.classList.toggle('is-zero', Boolean(n) && !n.get(id));
        }
      },
    };
  }
  const typeChips = toggleChips({
    items: typesPresent.map((t) => ({ id: t, label: typeLabel(t), title: typeHelp(t), cls: `lk-t-${TYPE_CLASS[t]}`, key: typeKey(t) })),
    name: LABELS.lineKind,
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
  // 좁은 화면에서는 가운데 스토리만 두고 나머지 필터는 접는다(lk-collapsible)
  const filterBtn = h('button', { type: 'button', class: 'btn lk-filter-toggle', 'aria-expanded': 'false', onClick: () => {
    const on = controls.classList.toggle('is-open');
    filterBtn.setAttribute('aria-expanded', String(on));
  } }, LABELS.filters, h('span', { class: 'lk-filter-n' }));
  const barMain = h('div', { class: 'lk-bar lk-bar-main' },
    field(LABELS.centerKind, kindSelect, 'lk-field-ckind'),
    field(LABELS.center, centerCombo.el, 'lk-field-center'),
    filterBtn,
    field(LABELS.target, targetCombo.el, 'lk-field-target lk-collapsible'),
    field(LABELS.thread, threadSelect, 'lk-field-thread lk-collapsible'));
  const barFilter = h('div', { class: 'lk-bar lk-bar-filter lk-collapsible' },
    field(LABELS.lineKind, typeChips.el, 'lk-field-types'),
    field(LABELS.strength, strengthSeg.el, 'lk-field-strength'),
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
  let F = readF(state.get()); // 지금 필터
  let sig = ''; // 마지막으로 그린 구조 서명
  let view = null; // 이웃 보기 상태: { center, groups, shown, active, limit, el, svg, ... }
  let netView = null;
  const limit = { key: null, before: STEP, after: STEP };
  let detailToken = 0;
  let alive = true;

  const resetFilters = () => setP({ ty: null, s: null, tg: null, th: null, kd: null, mm: null, nn: null, n: null, lt: null, pr: null });
  function emptyState(text, { filtered = false } = {}) {
    return h('div', { class: 'lk-empty-state' },
      h('p', {}, text),
      h('div', { class: 'lk-empty-actions' },
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
      body.append(emptyState(LABELS.centerHidden));
      summary.replaceChildren(); // 빈 상태 상자에 같은 단추가 있다
      centerCombo.set('');
      setTypeCounts(null);
      return;
    }
    if (!c) c = bestCenter(F, nb);
    if (!c) {
      body.append(emptyState(LABELS.noNeighborsFiltered, { filtered: filtered(F) }));
      summary.replaceChildren();
      centerCombo.set('');
      setTypeCounts(null);
      return;
    }
    centerCombo.set(c.title);
    if (limit.key !== c.key) { limit.key = c.key; limit.before = STEP; limit.after = STEP; }
    const all = groupsOf(c.key, F);
    const shown = all.filter((g) => inCut(F, g.unit) && kindOk(F, g.unit));
    const hiddenCut = all.filter((g) => !inCut(F, g.unit) && kindOk(F, g.unit)).length;
    // 선 종류 칩 — 종류 필터만 빼고 세어 하나도 없는 종류를 흐리게
    const counts = new Map();
    for (const g of groupsOf(c.key, { ...F, types: null })) if (inCut(F, g.unit) && kindOk(F, g.unit)) for (const e of g.edges) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
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
    view = { center: c, shown, activeKey, before, after, hiddenCut };

    // 요약 줄은 스포일러 안내뿐 — 이웃 · 선 개수와 범례 글은 싣지 않는다(작업량 숫자 · 당연한 설명)
    summary.replaceChildren();

    if (!shown.length) {
      summary.replaceChildren();
      body.append(emptyState(hiddenCut && !filtered(F) ? LABELS.allHidden : filtered(F) ? LABELS.noNeighborsFiltered : LABELS.noNeighbors, { filtered: filtered(F) }));
      view.empty = true;
      renderDetail();
      return;
    }

    const box = h('div', { class: 'lk-ego' });
    const colBefore = h('section', { class: 'lk-col lk-before', 'aria-label': LABELS.beforeHead });
    const colAfter = h('section', { class: 'lk-col lk-after', 'aria-label': LABELS.afterHead });
    const fillCol = (col, side, arr, lim, headText) => {
      col.append(h('h3', { class: 'lk-col-head' }, headText));
      const ol = h('ol', { class: 'lk-rows' });
      for (const g of take(arr, lim)) ol.append(h('li', { class: 'lk-row' }, nodeCard(g, activeKey)));
      col.append(ol);
      const rest = arr.length - ol.children.length;
      if (rest > 0) col.append(h('button', { type: 'button', class: 'btn lk-more', onClick: () => { limit[side] += STEP; renderEgo(); } }, LABELS.more(rest)));
      if (!arr.length) col.append(h('p', { class: 'lk-col-empty muted' }, '—'));
    };
    fillCol(colBefore, 'before', before, limit.before, LABELS.beforeHead);
    fillCol(colAfter, 'after', after, limit.after, LABELS.afterHead);
    const mid = h('section', { class: 'lk-mid', 'aria-label': LABELS.centerMark }, centerCard(c));
    box.append(colBefore, mid, colAfter);
    body.append(box);
    view.el = box;
    if (d3) view.svg = d3.select(box).insert('svg', ':first-child').attr('class', 'lk-lines').attr('aria-hidden', 'true');
    else body.append(ui.notice(LABELS.svgOff, 'warn'));
    layoutEgo();
    renderDetail();
  }

  function centerCard(u) {
    return h('div', { class: 'lk-center' },
      h('div', { class: 'lk-center-tag' }, LABELS.centerMark),
      h('div', { class: 'lk-center-title' }, ui.link(`unit:${u.key}`, chTitle(u), { title: u.title })),
      metaLine(u));
  }

  function nodeCard(g, activeKey) {
    const u = g.unit;
    const card = h('div', { class: ['lk-node', g.key === activeKey ? 'is-active' : ''], dataset: { key: g.key, side: g.side } });
    card.append(...[
      h('div', { class: 'lk-node-top' },
        h('button', { type: 'button', class: 'lk-title', title: u.title, onClick: () => pickNeighbor(g.key, null) }, chTitle(u)),
        h('button', { type: 'button', class: 'lk-recenter', title: LABELS.recenterTitle, 'aria-label': `${u.title} — ${LABELS.recenterTitle}`, onClick: (e) => { e.stopPropagation(); recenter(g.key); } }, LABELS.recenter, ui.icon('arrow'))),
      metaLine(u),
      h('div', { class: 'lk-tchips' }, g.edges.map((e) => h('button', {
        type: 'button', dataset: { type: e.type },
        class: ['lk-tchip', `lk-t-${TYPE_CLASS[e.type]}`],
        title: typeHelp(e.type),
        onClick: (ev) => { ev.stopPropagation(); pickNeighbor(g.key, e.type); },
      }, typeKey(e.type), typeLabel(e.type))))].filter(Boolean)); // 메인은 회색 줄(metaLine)이 없다
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
    state.set({ ...(state.get().sel ? { sel: `unit:${key}` } : {}), p: { m: null, c: key, n: null, lt: null, pr: null, ...(F.ck && units.get(key)?.kind !== F.ck ? { ck: null } : {}) } });
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
          const line = v.svg.append('path').attr('class', `lk-line lk-t-${TYPE_CLASS[e.type]}${active ? ' is-active' : ''}`)
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

  /**
   * 선 하나의 "왜 이어졌나" 한 문장(말풍선) — 직접 이은 연작은 그 까닭, 기록에서 나온 선은 첫 기록 문장(기록을 받은 뒤에만),
   * 같은 인물 · 소재는 함께 나온 이름(자주 나오는 인물은 뒤로), 키로 이은 다음 편은 없음(당연하다)
   */
  function edgeWhy(e) {
    if (e.origin === 'manual') return clip(fmt.prose(e.note), 90) || null;
    if (e.type === 'character' || e.type === 'keyword') {
      const ids = [...e.targets].sort((x, y) => Number(commonSet.has(x)) - Number(commonSet.has(y)));
      return ids.length ? `${ids.slice(0, 4).map(fmt.targetName).join(' · ')}${ids.length > 4 ? ' …' : ''}` : null;
    }
    if (e.origin === 'record' && idx.hasRecords) {
      for (const id of e.records) { const s = sentenceOf(id); if (s) return clip(s.text, 90); }
    }
    return null;
  }
  function lineTip(e) {
    const why = edgeWhy(e);
    return h('div', { class: 'lk-tip-body' },
      h('div', { class: 'lk-tip-title' }, `${e.a.title} → ${e.b.title}`),
      h('div', { class: 'muted' }, typeLabel(e.type)),
      why ? h('div', {}, why) : null);
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

  /**
   * 기록 하나 → 근거 줄의 한 문장 { id, text, part } — 회수는 풀린 의문의 문장(일부만 풀렸으면 part),
   * 그 밖(복선 · 다시 언급 · 드러남 · 뒤집힘)은 그 기록 문장, 없으면 alt(가리키는 사실 · 의문). 링크는 문장의 기록으로
   */
  function sentenceOf(id, alt) {
    const r = idx.records?.get(id);
    if (!r) return null;
    if (r.kind === 'Q-k') {
      const q = idx.records.get(r.parent);
      const t = q && fmt.recordText(q);
      if (t) return { id: q.id, text: t, part: r.degree === '일부' };
    }
    const t = fmt.recordText(r);
    if (t) return { id, text: t };
    const a = alt ? idx.records.get(alt) : null;
    const ta = a && fmt.recordText(a);
    return ta ? { id: alt, text: ta } : null;
  }
  /** 문장 자리를 채운다 — 기록 파일(6MB)은 처음 근거를 볼 때 받는다. 못 받으면 '자세히' 링크가 남는다 */
  function fillRecords(scope) {
    if (!idx.hasRecords) return;
    for (const el of scope.querySelectorAll('[data-rec]:not([data-filled])')) {
      el.dataset.filled = '1';
      const s = sentenceOf(el.dataset.rec, el.dataset.alt);
      if (!s) continue;
      el.replaceChildren(ui.link(`record:${s.id}`, clip(s.text, 140), { class: 'lk-why-text' }), ...(s.part ? [' ', h('span', { class: 'lk-part' }, LABELS.partial)] : []));
    }
  }
  let recordsAsked = false;
  function wantRecords(scope) {
    if (idx.hasRecords) { fillRecords(scope); return; }
    if (recordsAsked) { idx.withRecords?.().then(() => alive && fillRecords(scope)); return; }
    recordsAsked = true;
    idx.withRecords?.().then(() => { if (alive) { fillRecords(detail); fillRecords(inner); } }).catch(() => {});
  }

  /**
   * 근거 줄의 "왜 이어졌나" 한 문장. 직접 이은 연작 = 그 까닭(fmt.prose), 같은 인물 · 소재 = 두 장면에 함께 나온 이름,
   * 기록에서 나온 선 = sentenceOf(기록을 받으면 채운다), 키로 이은 다음 편 · 게임 선행 조건 = 없음(당연하다). 해석이 추정이면 '추정'만 단다
   */
  function whyOf(r) {
    const guess = r.confidence === '추정' ? [' ', ui.chip('confidence', '추정')] : null;
    if (r.origin === 'manual') {
      const t = fmt.prose(r.note);
      return t ? h('p', { class: 'lk-why' }, t, guess) : null;
    }
    if (r.type === 'character' || r.type === 'keyword') {
      const ids = r.targets ?? (r.target ? [r.target] : []);
      return ids.length ? h('div', { class: 'lk-why lk-names' }, ids.map((id, i) => [i ? ' · ' : null, idx.targets.has(id) ? ui.link(`target:${id}`, fmt.targetName(id)) : fmt.targetName(id)])) : null;
    }
    if (r.origin !== 'record' || !r.record || /^Y/.test(r.record)) return null;
    return h('div', { class: 'lk-why' }, h('span', { dataset: { rec: r.record, alt: r.point ?? '' } }, recordLink(r.record)), guess);
  }
  /** 같은 인물 · 소재 줄은 같은 장면 쌍끼리 한 줄로 묶는다(이름만 늘어놓는다 — 세기 높은 이름부터) */
  function mergeNames(rows) {
    const out = [];
    const at = new Map();
    for (const r of rows) {
      if (r.type !== 'character' && r.type !== 'keyword') { out.push(r); continue; }
      const k = `${r.type}\t${r.from}\t${r.to}`;
      const m = at.get(k);
      if (m) { m.list.push(r); m.s = Math.max(m.s, r.s); continue; }
      const nr = { ...r, list: [r] };
      at.set(k, nr);
      out.push(nr);
    }
    for (const r of at.values()) {
      r.targets = r.list.sort((x, y) => y.s - x.s || fmt.targetName(x.target).localeCompare(fmt.targetName(y.target), 'ko')).map((x) => x.target).filter(Boolean);
    }
    return out;
  }

  /** 근거 한 줄 — 장면 → 장면 + 한 문장 */
  function evRow(r) {
    return h('li', { class: 'lk-ev' },
      h('div', { class: 'lk-ev-scenes' },
        sceneLink(r.from),
        h('span', { class: 'lk-ev-arrow', 'aria-hidden': 'true' }, ui.icon('arrow')),
        sceneLink(r.to)),
      whyOf(r));
  }

  /** 근거 목록 하나(선 종류 구역) — 더 보기는 구역마다 */
  function evSection(type, rows, limKey, again = renderDetail) {
    const lim = rowLimits.get(limKey) ?? ROW_STEP;
    const sec = h('section', { class: ['lk-dsec', `lk-t-${TYPE_CLASS[type] ?? 'prereq'}`] },
      h('h4', { class: 'lk-dsec-head', title: typeHelp(type) }, typeKey(type), typeLabel(type)));
    const ol = h('ol', { class: 'lk-evs' });
    for (const r of rows.slice(0, lim)) ol.append(evRow(r));
    sec.append(ol);
    if (rows.length > lim) sec.append(h('button', { type: 'button', class: 'btn lk-more', onClick: () => { rowLimits.set(limKey, lim + ROW_STEP); again(); } }, LABELS.more(fmt.num(rows.length - lim))));
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
    const head = () => h('header', { class: 'lk-dh' },
      h('h3', { class: 'lk-dtitle' }, ui.link(`unit:${pair.from.key}`, chTitle(pair.from)), h('span', { class: 'lk-darrow', 'aria-hidden': 'true' }, ui.icon('arrow')), ui.link(`unit:${pair.to.key}`, chTitle(pair.to))));
    if (!scenesP) { ui.clear(detail); detail.append(head(), ui.spinner(LABELS.loadingEvidence)); }
    let sc;
    try { sc = await loadScenes(); } catch (err) { if (token === detailToken) { ui.clear(detail); detail.append(ui.notice(err.message, 'error')); } return; }
    if (token !== detailToken || !alive) return;

    const relaxedAny = F.tg && commonSet.has(F.tg);
    const allRows = sc.pair.get(`${pair.from.key}\t${pair.to.key}`) ?? [];
    const typesHere = pair.edges.map((e) => e.type);
    const rowOk = (r) => typesHere.includes(r.type) && (r.s >= F.minS || relaxedAny) && (!F.tg || !r.target || r.target === F.tg);
    const rows = mergeNames(allRows.filter(rowOk));
    const weak = allRows.some((r) => typesHere.includes(r.type) && !rowOk(r) && r.s < F.minS);
    const byType = new Map();
    for (const r of rows) (byType.get(r.type) ?? byType.set(r.type, []).get(r.type)).push(r);
    const shownTypes = typesHere.filter((t) => byType.has(t));
    const sel = F.lt && byType.has(F.lt) ? F.lt : null;

    ui.clear(detail);
    detail.append(head());
    if (shownTypes.length > 1) {
      const tabs = h('div', { class: 'lk-dtabs', role: 'group', 'aria-label': LABELS.lineKind });
      const tab = (id, label, key) => h('button', { type: 'button', class: ['lk-chip', id ? `lk-t-${TYPE_CLASS[id]}` : '', 'lk-dtab'], 'aria-pressed': String((sel ?? '') === (id ?? '')), onClick: () => setP({ lt: id }) }, key ?? null, label);
      tabs.append(tab(null, LABELS.allTypes));
      for (const t of shownTypes) tabs.append(tab(t, typeLabel(t), typeKey(t)));
      detail.append(tabs);
    }
    const show = sel ? [sel] : shownTypes;
    if (!rows.length) detail.append(h('p', { class: 'lk-norows muted' }, LABELS.noRows));
    for (const t of show) detail.append(evSection(t, byType.get(t), `${pairKey}|${t}`));
    if (weak) detail.append(h('p', { class: 'lk-dfoot' }, h('button', { type: 'button', class: 'btn lk-btn', onClick: () => setP({ s: '1' }) }, LABELS.weakShow)));
    wantRecords(detail);
  }

  // ── 이 스토리 안의 연결 (같은 스토리 안 장면 → 장면 — 한 스토리 안 선행 1편 → 2편은 당연해서 뺀다) ──
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
    const rows = (sc.inner.get(key) ?? []).filter((r) => r.type !== 'prereq');
    const summ = inner.querySelector('summary');
    if (!rows.length) { inner.hidden = true; return; }
    const types = TYPE_IDS.filter((t) => rows.some((r) => r.type === t));
    summ.replaceChildren(LABELS.inner, h('span', { class: 'lk-inner-types muted' }, types.map(typeLabel).join(' · ')));
    const paint = () => {
      const bodyEl = inner.querySelector('.lk-inner-body');
      if (bodyEl.dataset.key === key) return;
      bodyEl.dataset.key = key;
      ui.clear(bodyEl);
      for (const t of types) {
        const list = mergeNames(rows.filter((r) => r.type === t).sort((x, y) => y.s - x.s));
        bodyEl.append(evSection(t, list, `inner|${key}|${t}`, () => { bodyEl.dataset.key = ''; paint(); }));
      }
      wantRecords(inner);
    };
    inner.ontoggle = () => { if (inner.open) paint(); };
    if (inner.open) paint();
  }

  // ── 전체 보기: 행 = 스토리 종류, 가로 = 출시순 ──
  function renderNet() {
    ui.clear(body);
    body.className = 'lk-body lk-body-net';
    view = null;
    netView = null;
    const mainMain = (e) => e.a.kind === 'main' && e.b.kind === 'main';
    const pool = (f, cutOn) => edges.filter((e) => (f.mm || !mainMain(e)) && passEdge(e, f) && kindOk(f, e.a) && kindOk(f, e.b) && (!cutOn || (inCut(f, e.a) && inCut(f, e.b))));
    const nodesOf = (es) => { const s = new Set(); for (const e of es) { s.add(e.from); s.add(e.to); } return s; };
    const es0 = pool(F, true);
    const hiddenCut = nodesOf(pool(F, false)).size - nodesOf(es0).size;
    const counts = new Map(); // 선 종류 칩 — 하나도 없는 종류를 흐리게
    for (const e of pool({ ...F, types: null }, true)) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    setTypeCounts(counts);

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

    // 요약 줄은 스포일러 안내뿐(스토리 · 선 개수와 범례 글은 싣지 않는다)
    summary.replaceChildren();

    if (!es.length) {
      summary.replaceChildren();
      body.append(emptyState(LABELS.netEmpty, { filtered: filtered(F) }));
      renderDetail();
      return;
    }
    if (!d3) { body.append(ui.notice(LABELS.svgOff, 'warn')); return; }
    // 그림 위 한 줄 — 많이 이어진 N편만 그렸을 때 그 말과 넓히기 단추, 메인끼리의 선 켜기
    body.append(h('div', { class: 'lk-nettools' },
      capped ? h('span', { class: 'lk-cap' }, LABELS.netCap(fmt.num(cap)),
        !F.wide && total > NET_CAP ? [' ', h('button', { type: 'button', class: 'btn lk-btn', onClick: () => setP({ nn: '150' }) }, LABELS.netWide(NET_CAP_MAX))] : null) : null,
      ui.toggle({ label: LABELS.netMainMain, checked: F.mm, onChange: (on) => setP({ mm: on ? '1' : null, pr: null }) })));

    // 자리 잡기
    const W = Math.max(520, (body.clientWidth || 900) - 2);
    const LEFT = 92;
    const RIGHT = 18;
    const TOP = 30;
    const ROW = 20;
    const orders = idx.unitList.filter((u) => inCut(F, u)).map((u) => u.order);
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
    const svg = d3.select(wrap).append('svg').attr('class', 'lk-netsvg').attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', LABELS.netAria);
    // 행 띠 + 이름
    for (const [i, l] of lanes.entries()) {
      svg.append('rect').attr('class', `lk-lane${i % 2 ? ' is-alt' : ''}`).attr('x', 0).attr('y', l.top).attr('width', W).attr('height', l.h);
      svg.append('text').attr('class', 'lk-lane-label').attr('x', 10).attr('y', l.top + 20).text(kindLabel(l.kind));
    }
    // 가로 눈금 — 메인 챕터 10개마다
    const gAxis = svg.append('g').attr('class', 'lk-axis');
    gAxis.append('text').attr('class', 'lk-axis-title').attr('x', 10).attr('y', 18).text(LABELS.axis);
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
      .attr('class', (e) => `lk-nedge lk-t-${TYPE_CLASS[e.type]}${selPair === `${e.from}>${e.to}` && (!F.lt || F.lt === e.type) ? ' is-active' : ''}`)
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
  /** 그림 대신 읽는 표 — 정렬 · 쪽 나눔, 줄을 누르면 근거가 아래에 나온다(센 연결부터) */
  function netTable(es) {
    const holder = h('div', { class: 'lk-nettable' });
    const det = ui.details(LABELS.asTable, holder, { class: 'lk-nettable-wrap' });
    let built = false;
    det.addEventListener('toggle', () => {
      if (!det.open || built) return;
      built = true;
      const rows = [...es].sort((x, y) => y.strength - x.strength || effCount(y, F) - effCount(x, F) || x.a.order - y.a.order)
        .map((e) => ({ id: e.id, e, from: e.a.title, to: e.b.title, type: e.type }));
      const tbl = ui.table({
        rowKey: 'id', pageSize: 20, rows, empty: LABELS.netEmpty,
        onRow: (r) => setP({ pr: `${r.e.from}>${r.e.to}`, lt: r.type, n: null }),
        columns: [
          { key: 'from', label: LABELS.colFrom, render: (r) => ui.link(`unit:${r.e.from}`, r.from) },
          { key: 'to', label: LABELS.colTo, render: (r) => ui.link(`unit:${r.e.to}`, r.to) },
          { key: 'type', label: LABELS.lineKind, nowrap: true, render: (r) => h('span', { class: `lk-t-${TYPE_CLASS[r.type]}` }, typeKey(r.type), ' ', typeLabel(r.type)), sort: (x, y) => (typeRank.get(x.type) ?? 9) - (typeRank.get(y.type) ?? 9) },
        ],
      });
      holder.append(tbl.el);
    });
    return det;
  }
  function nodeTip(d) {
    return h('div', { class: 'lk-tip-body' },
      h('div', { class: 'lk-tip-title' }, d.unit.title),
      metaText(d.unit) ? h('div', { class: 'muted' }, metaText(d.unit)) : null);
  }
  /** 전체 보기 아래 한 줄 — 고른(없으면 가장 많이 이어진) 스토리와 이웃 보기 단추, 사용법 한 줄 */
  function renderNetBar() {
    const nv = netView;
    if (!nv?.bar) return;
    const picked = selUnit() && nv.keepSet.has(selUnit()) ? selUnit() : null;
    const k = picked ?? nv.topKey;
    ui.clear(nv.bar);
    if (k && nv.keepSet.has(k)) {
      const u = units.get(k);
      nv.bar.append(h('span', { class: 'lk-netsel' }, h('span', { class: 'ctl-name' }, picked ? LABELS.netSel : LABELS.netTop), ' ', ui.link(`unit:${k}`, u.title), metaText(u) ? [' ', h('span', { class: 'lk-kind' }, metaText(u))] : null),
        h('button', { type: 'button', class: 'btn lk-btn', onClick: () => recenter(k) }, LABELS.netEgo));
    }
    nv.bar.append(h('span', { class: 'muted lk-nethint' }, LABELS.netHint));
  }

  // ── 연작 ──
  /** 연작을 첫 편의 스토리 종류로 묶는다(이벤트 · 서브퀘스트 …) — 만든 방법(직접 확정 · 키 규칙)으로 나누지 않는다 */
  function renderChain() {
    ui.clear(body);
    body.className = 'lk-body lk-body-chain';
    view = null;
    netView = null;
    const ok = (u) => inCut(F, u);
    const groups = new Map(fmt.KIND_ORDER.map((k) => [k, []]));
    let hiddenChains = 0;
    for (const ch of links.chains) {
      const us = ch.units.map((k) => units.get(k)).filter(Boolean);
      if (!us.length) continue;
      if (!ok(us[0])) { hiddenChains++; continue; }
      let cutAt = us.findIndex((u) => !ok(u));
      if (cutAt < 0) cutAt = us.length;
      const shown = us.slice(0, cutAt);
      const keys = new Set(shown.map((u) => u.key));
      const es = ch.edges.filter((e) => keys.has(e.from) && keys.has(e.to));
      (groups.get(us[0].kind) ?? groups.set(us[0].kind, []).get(us[0].kind)).push({ ch, shown, es, tail: us.length - cutAt });
    }
    summary.replaceChildren();
    if (![...groups.values()].some((g) => g.length)) { summary.replaceChildren(); body.append(emptyState(LABELS.chainEmpty, { cut: hiddenChains })); return; }
    for (const [kind, items] of groups) {
      if (!items.length) continue;
      items.sort((x, y) => x.shown[0].order - y.shown[0].order);
      body.append(h('h3', { class: 'lk-chain-group' }, kindLabel(kind)));
      const wrap = h('div', { class: 'lk-chains' });
      for (const item of items) wrap.append(chainCard(item));
      body.append(wrap);
    }
  }
  /** 연작 카드 — 편 수 + 편 사슬. 까닭 문장은 직접 읽고 이은 연작만(키로 이은 '다음 편'은 당연하다), 갈래가 있으면 어느 편에서 갈렸는지 접이 안에 */
  function chainCard({ ch, shown, es, tail }) {
    const flow = h('ol', { class: 'lk-flow' });
    if (ch.linear) {
      shown.forEach((u, i) => {
        if (i > 0) flow.append(h('li', { class: 'lk-conn', 'aria-hidden': 'true' }, h('i', { class: 'lk-key lk-t-sequel' })));
        flow.append(h('li', { class: 'lk-chain-node' }, chainNode(u)));
      });
    }
    const why = (e) => (e.origin === 'manual' ? fmt.prose(e.note) : '');
    const noteEdges = ch.linear ? es.filter(why) : es;
    const noteRows = noteEdges.map((e) => h('li', { class: 'lk-chain-note' },
      h('span', { class: 'lk-chain-pair' }, units.get(e.from)?.title, h('span', { class: 'lk-darrow' }, ui.icon('arrow')), units.get(e.to)?.title),
      why(e) ? h('p', { class: 'lk-note' }, why(e)) : null));
    return h('article', { class: 'lk-chain' },
      h('header', { class: 'lk-chain-head' }, h('strong', {}, LABELS.chainLen(fmt.num(shown.length))), ch.linear ? null : h('span', { class: 'muted' }, LABELS.chainBranch)),
      ch.linear ? flow : h('ol', { class: 'lk-flow lk-flow-tree' }, shown.map((u) => h('li', { class: 'lk-chain-node' }, chainNode(u)))),
      tail > 0 ? h('p', { class: 'lk-chain-tail muted' }, LABELS.chainHiddenTail(tail)) : null,
      noteRows.length ? ui.details(LABELS.chainNotes, h('ul', { class: 'lk-chain-notes' }, noteRows), { open: !ch.linear }) : null);
  }
  function chainNode(u) {
    const key = u.key;
    return h('div', { class: ['lk-node', selUnit() === key ? 'is-sel' : ''], dataset: { key } },
      h('div', { class: 'lk-node-top' },
        h('button', { type: 'button', class: 'lk-title', title: u.title, onClick: () => state.set({ sel: `unit:${key}` }) }, chTitle(u)),
        h('button', { type: 'button', class: 'lk-recenter', title: LABELS.recenterTitle, 'aria-label': `${u.title} — ${LABELS.recenterTitle}`, onClick: () => recenter(key) }, LABELS.recenter, ui.icon('arrow'))),
      metaLine(u));
  }

  // ── 그리기 · 갱신 ──
  const p0 = () => state.get().p ?? {};
  function setTypeCounts(counts) { typeChips.sync(F.types, counts); }
  function syncControls() {
    modeSeg.set(F.mode);
    strengthSeg.set(String(F.minS));
    targetCombo.set(F.tg ? fmt.targetName(F.tg) : '');
    cand = candidatesFor(F);
    rebuildThreadOptions();
    rebuildKindOptions();
    threadSelect.value = F.th ?? '';
    kindChips.sync(F.kinds);
    typeChips.sync(F.types);
    const chain = F.mode === 'chain';
    controls.hidden = chain;
    barMain.querySelector('.lk-field-center').hidden = F.mode !== 'ego';
    barMain.querySelector('.lk-field-ckind').hidden = F.mode !== 'ego';
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
  /** 컷오프 · 필터가 바뀔 때 — 스크롤이 튀지 않게 높이를 잠시 붙잡고 다시 그린다 */
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
    if (changed.has('p') || changed.has('t')) refresh();
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
