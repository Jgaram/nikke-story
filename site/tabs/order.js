/**
 * 탭 1 읽기 순서(W2) — 화면 1 "스토리 중요도 분류"(docs/views.md 1절, 판정 카드 docs/importance.md).
 * 첫 쓸모: "CH.N까지 읽었으면 다음에 뭘 읽나" — 여기까지 읽음 T에서 그 시점의 등급(필수 → 추천 → 참고 → 독립)으로 묶은 메인 밖 스토리 목록.
 *
 * 쓰는 JSON
 *   order.json(이 탭 — tools/site/export/order.mjs): units[421](판정 단위 — 등급 · 출시 시점 · from · before · basis · reason · trail · 떡밥 · 주역) · spine[60](본편 자리) · leads[20](주역 명단) · counts
 *   order-detail.json(분류 카드를 처음 열 때 받는다): units{키 → { history, basis_text, reviews }} · notes[]
 *   공용(idx): units.json(종류 · 제목 · 글자 수 · 범위) · ticks.json(출시 시점 라벨)
 *
 * URL 파라미터(p.*)
 *   mode   list(목록, 기본) | map(지도)
 *   kind   종류 거르개(event · episode · sub · relic · side · erelic · elevator), 없으면 전체
 *   find   제목 · 키 · 이유 안 낱말 검색
 *   rows   지도의 행: grade(등급별, 기본) | kind(종류별)
 *   leads  1이면 주역 명단을 펼친다
 *
 * 그리는 규칙
 *   그 시점의 등급 gradeAt(u, T) — tools/views/importance.mjs와 같다: T가 없으면(전부 보기) 최종 등급, T < 출시 시점이면 아직 없음(가림),
 *     from 시점이 있고 T < from 시점이면 그 앞 등급(before), 그 밖은 최종 등급. 내려가는 일은 없다.
 *   여기까지 읽음 뒤 스토리(tick > T) · 범위 거르개 밖 스토리는 숨기고 개수만 보인다("스포일러로 가린 N — 전부 보기").
 *   목록: 등급별 묶음 표(묶음 제목 옆 ⓘ = 등급 뜻). 한 줄 = 출시 시점 · 종류 · 제목(+ 뒤에 오를 등급) · 왜 이 등급인가(근거 메모 ID 줄 + 이유 한 줄 말줄임) · 글자 · 범위.
 *     390px 폭에서는 카드형(출시 시점 · 종류 · 제목 / 근거)으로 접는다.
 *   지도: 본편 60곳(메인 49 + 본편 이벤트 8 · 사이드 3)을 가로축으로, 스토리를 그 출시 시점 ≤ 인 마지막 본편 칸에 점으로. 행 = 등급 또는 종류(칸마다 점 수에 맞춘 높이),
 *     행 이름은 SVG 밖 HTML 열(자르지 않는다), 축 라벨은 가로 `CH.07` — 겹치면 건너뛴다(전부는 호버). 점 색 = 그 시점의 등급(파랑 램프), 점 크기는 같다.
 *     나중에 등급이 오르는 점은 오를 등급 색 테두리. 본편 스토리는 축에 표시만(채점하지 않는다). 축을 누르면 그 시점까지 읽은 것으로 둔다.
 *   스토리를 누르면 sel=unit:키 → 리더 패널 + (넓은 화면에서) 아래에 붙는 분류 카드(등급 · 등급 변화 · 왜 이 등급인가 · 이유 · 떡밥 · 주역 · 분류가 바뀐 기록).
 *   색은 등급 램프(--grade-*)만 — 종류는 칩 · 행 이름으로 (종류 색과 등급 색을 한 차트에 같이 쓰지 않는다).
 *   키보드: 점 421개를 모두 탭 정지점으로 만들지 않는다(축 60칸만 tabindex 0) — 같은 내용을 목록 모드의 표(줄마다 초점)가 준다.
 *   표 → 카드형 행은 화면이 아니라 묶음 폭(컨테이너 쿼리 840px)으로 접힌다 — 리더 패널이 열려 본문이 좁아져도 가로로 넘치지 않는다.
 *   용어는 fmt(GRADE · LAYER · TERM · help · hiddenLabel · ref)에서 가져오고, 없는 말만 아래 LABELS에 둔다.
 */
import { gradeAt, plain } from '../lib/format.js';

export const meta = { id: 'order', title: '읽기 순서', blurb: '여기까지 읽었다면 다음에 읽을 스토리' };

/** fmt에 없는 화면 말 — 고칠 때는 여기 한 곳만 */
const LABELS = {
  title: '읽기 순서',
  view: '보기', list: '목록', map: '지도',
  kind: '종류', allKinds: '전체',
  find: '제목 · 이유 검색', findAria: '스토리 검색',
  count: (rows, total) => `${rows} / ${total}`,
  cols: { release: '출시 시점', kind: '종류', title: '스토리', why: '왜 이 등급인가', chars: '글자', scope: '범위' },
  noBasis: '근거 메모 없음',
  riseTo: (at, grade) => `→ ${at}부터 ${grade}`, riseSince: (at) => `${at}부터`, riseBefore: (at, grade) => `${at} 앞에서는 ${grade}`,
  rowsGrade: '등급별', rowsKind: '종류별', rows: '행',
  legendSpine: { main: '본편 챕터', event: '본편 이벤트', side: '본편 사이드' }, legendRise: '테두리 = 나중에 오를 등급',
  mapHint: '점을 누르면 분류 · 아래 축을 누르면 그 시점까지 읽은 것으로 둔다',
  mapAria: (n, rows) => `본편 ${n}곳을 가로축으로, 스토리 ${rows}개를 등급 색 점으로 단 지도`,
  afterCut: '아직 안 읽음', axisGo: '누르면 여기까지 읽은 것으로 둔다',
  emptyEarly: (at, next) => `${at}까지는 메인 밖 스토리가 아직 없다${next ? ` — ${next}부터 나온다` : ''}.`, goNext: (at) => `${at}까지 읽음으로`, emptyFilter: '거르개에 맞는 스토리가 없다.',
  clearFilter: '거르개 풀기', outScope: '범위 밖',
  leads: '주역', leadsHelp: '스토리의 주인 · 카운터스 · 지휘관 — 주역마다 첫 이야기(정체 · 동기의 원점이 처음, 가장 온전히 나오는 메인 밖 스토리) 하나가 필수다',
  leadCols: { person: '인물', from: '주역이 되는 시점', origin: '첫 이야기', arcs: '범위', basis: '근거', conf: '확신' },
  inMain: '메인 안', notYet: '아직', leadsEmpty: '여기까지 읽음 안에 주역이 되는 인물이 없다',
  card: '분류', cardClose: '닫기',
  rows2: {
    grade: '등급', why: '왜 이 등급인가', reason: '이유', judg: '분류', threads: '떡밥', lead: '주역', origins: '첫 이야기', endings: '결말', history: '분류가 바뀐 기록',
    release: '출시 시점', climbs: '여기서 등급이 오르는 스토리', touched: '여기에 닿는 스토리', touch: '닿는 본편',
  },
  none: '없음', noBasisLong: '없음 — 본편이 말하지 않은 세계 · 본편 인물 메모가 없다(독립)',
  after: (at) => `여기까지 읽음 뒤 — ${at}에 나온다`, reviews: (n) => `검토 기록 ${n}`, before: '그 전: ', asof: '기준일', scene: '씬',
  trailNone: '바뀐 적 없다',
};
const GRADES = ['필수', '보강', '참고', '독립'];

const DOT_R = 4; // 점 반지름(지름 8px — dataviz 최소)
const STEP = DOT_R * 2 + 1; // 점 사이 간격
const COL_MIN = 20; // 본편 한 칸의 최소 너비(점 둘이 나란히)
const LANE_MIN = 40; // 행 최소 높이(행 이름 두 줄이 들어간다)
const LANE_PAD = 8;
const AXIS_H = 46; // 축(표시 + 라벨) 높이
const AXIS_LABEL_W = 36; // `CH.07` 한 라벨이 차지하는 폭(11px 숫자 + 여백)
const SVGNS = 'http://www.w3.org/2000/svg';

export { gradeAt }; // 계산은 lib/format.js 한 곳(리더의 분류 칸도 같이 쓴다)

const clip = (s, n) => (typeof s === 'string' && [...s].length > n ? `${[...s].slice(0, n).join('')}…` : s ?? '');
/** SVG 요소 만들기(d3 없이도 지도가 그려진다) */
function S(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
}
const isLibrary = (scene) => /^(side|sub|relic|erelic|fl):/.test(scene ?? '');

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const wait = ui.spinner();
  root.append(wait);
  const order = await data.load('order');
  wait.remove();
  const TERM = fmt.TERM;
  const gl = (g) => fmt.GRADE[g]?.label ?? g;
  const judged = order.units.map((j) => ({ ...j, unit: idx.units.get(j.key) })).filter((j) => j.unit);
  const judgedByKey = new Map(judged.map((j) => [j.key, j]));
  const spine = order.spine.map((s) => ({ ...s, unit: idx.units.get(s.key) })).filter((s) => s.unit);
  const spineByKey = new Map(spine.map((s) => [s.key, s]));
  const spineTicks = spine.map((s) => s.tick);
  /** 출시 시점 → 본편 칸(그 시점 ≤ 인 마지막 본편 스토리) */
  const colOf = (tick) => {
    let lo = 0; let hi = spineTicks.length - 1; let ans = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (spineTicks[mid] <= tick) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };
  const kindsPresent = fmt.KIND_ORDER.filter((k) => judged.some((j) => j.unit.kind === k));
  const spineLabel = (key) => (spineByKey.get(key)?.unit.kind === 'main' ? fmt.tickShort(spineByKey.get(key).tick) : fmt.unitTitle(key));
  const recId = (id) => (/^J\d/.test(id) ? ui.link(`thread:${id}`, id) : ui.link(`record:${id}`, id));
  /** 문장 속 메모 ID(F48 · Q36 · J2 · D18 …)를 링크로 */
  const withLinks = (text) => String(text ?? '').split(/\b([FQSIEDUOH]\d+|J\d+)\b/).map((p, i) => (i % 2 ? recId(p) : plain(p)));
  let curT = state.get().t;

  // ── 머리 · 도구 줄 ──
  root.append(ui.el('div', { class: 'tab-head order-head' }, ui.el('h2', {}, LABELS.title)));
  const status = ui.el('span', { class: 'order-status', role: 'status', 'aria-live': 'polite' });
  const modeSeg = ui.segmented({ label: LABELS.view, options: [{ value: 'list', label: LABELS.list }, { value: 'map', label: LABELS.map }], value: state.param('order', 'mode') ?? 'list', onChange: (v) => state.setParam('order', 'mode', v === 'list' ? null : v) });
  const kindSeg = ui.segmented({ label: LABELS.kind, options: [{ value: 'all', label: LABELS.allKinds }, ...kindsPresent.map((k) => ({ value: k, label: fmt.KIND[k].label, title: fmt.help('kind', k) }))], value: state.param('order', 'kind') ?? 'all', onChange: (v) => state.setParam('order', 'kind', v === 'all' ? null : v) });
  const find = ui.el('input', { type: 'search', class: 'order-find', placeholder: LABELS.find, 'aria-label': LABELS.findAria, value: state.param('order', 'find') ?? '' });
  let findTimer = null;
  let findPending = false; // 입력 뒤 URL에 싣기 전 — 그 사이 다른 거르개가 바뀌어도 입력칸을 되돌리지 않는다
  find.addEventListener('input', () => {
    clearTimeout(findTimer);
    findPending = true;
    findTimer = setTimeout(() => { findPending = false; state.setParam('order', 'find', find.value.trim() || null); }, 200);
  });
  root.append(ui.el('div', { class: 'toolbar order-toolbar' }, modeSeg.el, ui.el('div', { class: 'order-kinds' }, kindSeg.el), find, status));
  const emptyBox = ui.el('div', { class: 'order-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);

  // ── 목록 ──
  const listView = ui.el('div', { class: 'order-list' });
  const riseNote = (j) => {
    if (!j.from_tick) return null;
    const at = spineLabel(j.from);
    if (curT == null) return ui.el('div', { class: 'order-rise' }, LABELS.riseBefore(at, gl(j.before ?? j.grade)));
    if (curT < j.from_tick) return ui.el('div', { class: 'order-rise is-future', title: `${at}에서 이 스토리를 다루기 시작하면 ${gl(j.grade)}` }, LABELS.riseTo(at, gl(j.grade)));
    return ui.el('div', { class: 'order-rise' }, LABELS.riseSince(at));
  };
  const basisRef = (j) => ui.el('div', { class: 'order-ref' },
    j.basis ? [recId(j.basis), j.basis_scene ? [' · ', ui.el('span', { class: 'order-scene' }, fmt.ref(j.basis_scene, j.basis_line))] : null] : ui.el('span', { class: 'muted' }, LABELS.noBasis),
    isLibrary(j.basis_scene) ? ui.el('span', { class: 'order-fl', title: fmt.TERM_HELP?.library }, TERM.library) : null);
  const columns = () => [
    { key: 'tick', label: LABELS.cols.release, width: '6.6em', nowrap: true, render: (j) => ui.el('span', { title: fmt.tickLabel(j.tick) }, fmt.tickShort(j.tick)), sort: (a, b) => a.tick - b.tick || a.unit.order - b.unit.order },
    { key: 'kind', label: LABELS.cols.kind, width: '9.2em', render: (j) => ui.chip('kind', j.unit.kind), sort: (a, b) => fmt.KIND_ORDER.indexOf(a.unit.kind) - fmt.KIND_ORDER.indexOf(b.unit.kind) },
    { key: 'title', label: LABELS.cols.title, width: '17em', render: (j) => ui.el('div', { class: 'order-title' }, ui.link(`unit:${j.key}`, j.unit.title), riseNote(j)), sort: (a, b) => a.unit.title.localeCompare(b.unit.title, 'ko') },
    { key: 'why', label: LABELS.cols.why, sortable: false, render: (j) => {
      // 한 줄로 줄이고(CSS 말줄임) 전문은 title · 분류 카드 · 리더 패널에 — 칸마다 초점이 생기지 않게 ui.tooltip 대신 title
      return ui.el('div', { class: 'order-basis' }, basisRef(j), ui.el('div', { class: 'order-why', title: j.reason ? plain(j.reason) : null }, plain(j.reason ?? '')));
    } },
    { key: 'chars', label: LABELS.cols.chars, width: '6em', num: true, render: (j) => fmt.num(j.unit.chars), sort: (a, b) => (a.unit.chars ?? 0) - (b.unit.chars ?? 0) },
    { key: 'layer', label: LABELS.cols.scope, width: '5.6em', render: (j) => (j.unit.layer ? ui.chip('layer', j.unit.layer) : ''), sort: (a, b) => (a.unit.layer ?? 9) - (b.unit.layer ?? 9) },
  ];
  const groups = new Map();
  for (const g of GRADES) {
    const countEl = ui.el('span', { class: 'order-group-count' });
    const info = ui.el('button', { type: 'button', class: 'order-info', 'aria-label': `${gl(g)} — ${fmt.help('grade', g)}` }, 'i');
    ui.tooltip(info, fmt.help('grade', g));
    const head = ui.el('h3', { class: 'order-group-head' }, ui.chip('grade', g), countEl, info);
    const tbl = ui.table({ rowKey: 'key', pageSize: 40, onRow: (j) => state.set({ sel: `unit:${j.key}` }), columns: columns(), empty: LABELS.none });
    const sec = ui.el('section', { class: 'order-group', 'data-grade': g }, head, tbl.el);
    groups.set(g, { sec, countEl, tbl });
    listView.append(sec);
  }
  root.append(listView);

  // ── 지도 ──
  const mapView = ui.el('div', { class: 'order-mapview' });
  mapView.hidden = true;
  const rowsSeg = ui.segmented({ label: LABELS.rows, options: [{ value: 'grade', label: LABELS.rowsGrade }, { value: 'kind', label: LABELS.rowsKind }], value: state.param('order', 'rows') ?? 'grade', onChange: (v) => state.setParam('order', 'rows', v === 'grade' ? null : v) });
  const mapHint = ui.el('button', { type: 'button', class: 'order-info', 'aria-label': LABELS.mapHint }, 'i');
  ui.tooltip(mapHint, LABELS.mapHint);
  const mark = (cls, label) => ui.el('span', { class: 'legend-item' }, ui.el('i', { class: `order-mark ${cls}`, 'aria-hidden': 'true' }), label);
  const mapLegend = ui.el('div', { class: 'order-legend' },
    ui.legend(GRADES.map((g) => ({ label: gl(g), color: fmt.GRADE[g].color }))),
    ui.el('div', { class: 'legend' }, mark('order-mark-main', LABELS.legendSpine.main), mark('order-mark-event', LABELS.legendSpine.event), mark('order-mark-side', LABELS.legendSpine.side), mark('order-mark-ring', LABELS.legendRise), mapHint));
  mapView.append(ui.el('div', { class: 'toolbar order-maptools' }, rowsSeg.el, mapLegend));
  const laneCol = ui.el('div', { class: 'order-lanes' });
  const mapScroll = ui.el('div', { class: 'order-map' });
  const svg = S('svg', { class: 'order-svg', role: 'img' });
  mapScroll.append(svg);
  mapView.append(ui.el('div', { class: 'order-mapbox' }, laneCol, mapScroll));
  root.append(mapView);

  // ── 주역 명단(접이식) ──
  const leadsTbl = ui.table({
    rowKey: 'id', pageSize: 0, onRow: (l) => state.set({ sel: `person:${l.person}` }),
    columns: [
      { key: 'person', label: LABELS.leadCols.person, render: (l) => ui.link(`person:${l.person}`, fmt.targetName(l.person)), sort: (a, b) => fmt.targetName(a.person).localeCompare(fmt.targetName(b.person), 'ko') },
      { key: 'from_tick', label: LABELS.leadCols.from, num: true, render: (l) => [ui.link(`unit:${l.from}`, spineLabel(l.from)), l.from_tick != null ? ui.el('span', { class: 'muted' }, ` (${fmt.tickShort(l.from_tick)})`) : null] },
      { key: 'origin', label: LABELS.leadCols.origin, sortable: false, render: (l) => (l.origin === '메인' ? ui.el('span', { class: 'muted' }, LABELS.inMain) : l.origin ? ui.link(`unit:${l.origin}`, fmt.unitTitle(l.origin)) : ui.el('span', { class: 'muted' }, LABELS.notYet)) },
      { key: 'arcs', label: LABELS.leadCols.arcs, sortable: false, render: (l) => (l.arcs ?? []).map((a) => a.split('-').map(spineLabel).join('–')).join(' · ') },
      { key: 'records', label: LABELS.leadCols.basis, sortable: false, render: (l) => ui.el('span', { class: 'order-ids' }, (l.records ?? []).map((r, i) => [i ? ' ' : null, recId(r)])) },
      { key: 'confidence', label: LABELS.leadCols.conf, render: (l) => ui.chip('confidence', l.confidence) },
    ],
    empty: LABELS.leadsEmpty,
  });
  const leadsHidden = ui.el('p', { class: 'muted order-leads-note' });
  const leadsHelp = ui.el('button', { type: 'button', class: 'order-info', 'aria-label': LABELS.leadsHelp }, 'i');
  ui.tooltip(leadsHelp, LABELS.leadsHelp);
  const leadsBox = ui.details([`${LABELS.leads} ${order.leads.length} `, leadsHelp], [leadsHidden, leadsTbl.el], { open: state.param('order', 'leads') === '1', class: 'order-leads' });
  leadsBox.addEventListener('toggle', () => state.setParam('order', 'leads', leadsBox.open ? '1' : null));
  root.append(leadsBox);

  // ── 분류 카드(선택한 스토리) ──
  const card = ui.el('section', { class: 'order-card panel', 'aria-label': LABELS.card });
  card.hidden = true;
  root.append(card);

  // ── 거르기 ──
  const match = (j, s) => {
    const kind = s.p.kind ?? 'all';
    if (kind !== 'all' && j.unit.kind !== kind) return false;
    const q = (s.p.find ?? '').toLowerCase();
    if (q && !`${j.unit.title} ${j.key} ${plain(j.reason ?? '')}`.toLowerCase().includes(q)) return false;
    return true;
  };
  let current = { rows: [], T: null };
  const clearFilters = () => state.set({ p: { kind: null, find: null } }, { replace: true });
  const apply = (s) => {
    const T = s.t;
    curT = T;
    const inCut = judged.filter((j) => state.visible(j.tick, T));
    const inLayer = inCut.filter((j) => j.unit.layer == null || s.layers.includes(j.unit.layer));
    const rows = inLayer.filter((j) => match(j, s));
    current = { rows, T };
    const hiddenCut = judged.length - inCut.length;
    const hiddenLayer = inCut.length - inLayer.length;
    ui.clear(status);
    status.append(ui.el('span', { class: 'order-count' }, LABELS.count(fmt.num(rows.length), fmt.num(judged.length))));
    if (hiddenCut) status.append(' ', ui.hiddenNote(fmt.hiddenLabel(hiddenCut), () => state.set({ t: null })));
    if (hiddenLayer) status.append(' · ', ui.el('span', { class: 'muted' }, `${LABELS.outScope} ${fmt.num(hiddenLayer)}`));
    // 목록
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    for (const [g, { sec, countEl, tbl }] of groups) {
      const list = rows.filter((j) => gradeAt(j, T) === g).sort((a, b) => a.tick - b.tick || a.unit.order - b.unit.order);
      countEl.textContent = fmt.num(list.length);
      sec.hidden = list.length === 0;
      tbl.update(list);
      tbl.setSelected(selKey);
    }
    const empty = rows.length === 0;
    emptyBox.hidden = !empty;
    if (empty) {
      ui.clear(emptyBox);
      if (inCut.length === 0 && T != null) {
        // 여기까지 읽음 안에 스토리가 없다 — 처음 나오는 시점으로 가는 단추를 준다
        const first = judged.filter((j) => (j.unit.layer == null || s.layers.includes(j.unit.layer)) && match(j, s)).reduce((m, j) => Math.min(m, j.tick), Infinity);
        const at = Number.isFinite(first) ? fmt.tickShort(first) : null;
        emptyBox.append(ui.notice(LABELS.emptyEarly(fmt.tickShort(T), at)), at ? ui.el('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: first }) }, LABELS.goNext(at)) : null, ui.el('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: null }) }, TERM.showAll));
      } else emptyBox.append(ui.notice(LABELS.emptyFilter), ui.el('button', { type: 'button', class: 'btn', onClick: clearFilters }, LABELS.clearFilter));
    }
    // 주역 명단
    const leadRows = order.leads.filter((l) => state.visible(l.from_tick, T)).sort((a, b) => (a.from_tick ?? 0) - (b.from_tick ?? 0));
    leadsTbl.update(leadRows);
    leadsHidden.textContent = leadRows.length < order.leads.length ? fmt.hiddenLabel(order.leads.length - leadRows.length) : '';
    leadsHidden.hidden = !leadsHidden.textContent;
    // 모드 · 지도
    const mode = s.p.mode ?? 'list';
    modeSeg.set(mode);
    kindSeg.set(s.p.kind ?? 'all');
    rowsSeg.set(s.p.rows ?? 'grade');
    if (!findPending && find.value !== (s.p.find ?? '') && document.activeElement !== find) find.value = s.p.find ?? '';
    listView.hidden = mode !== 'list' || empty;
    mapView.hidden = mode !== 'map' || empty;
    if (mode === 'map' && !empty) drawMap(s);
  };

  // ── 지도 그리기 ──
  let lastColW = 0;
  const drawMap = (s) => {
    const { rows, T } = current;
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    const byKind = (s.p.rows ?? 'grade') === 'kind';
    const lanes = byKind ? kindsPresent.map((k) => ({ id: k, label: fmt.KIND[k].label, help: fmt.help('kind', k) })) : GRADES.map((g) => ({ id: g, label: gl(g), help: fmt.help('grade', g) }));
    const laneOf = (j) => (byKind ? j.unit.kind : gradeAt(j, T));
    const n = spine.length;
    const pad = 12;
    const avail = (mapScroll.clientWidth || root.clientWidth || 900) - pad * 2;
    const colW = Math.max(COL_MIN, Math.floor(avail / n));
    lastColW = colW;
    const perRow = Math.max(1, Math.floor((colW - 2) / STEP));
    const width = pad * 2 + colW * n;
    const colX = (i) => pad + i * colW;
    // 칸 · 행 쌓기
    const stacks = new Map(lanes.map((l) => [l.id, new Map()]));
    for (const j of rows) {
      const m = stacks.get(laneOf(j));
      if (!m) continue;
      const col = colOf(j.tick);
      (m.get(col) ?? m.set(col, []).get(col)).push(j);
    }
    const geom = [];
    let y = 0;
    for (const lane of lanes) {
      const m = stacks.get(lane.id);
      let maxRows = 0; let count = 0;
      for (const items of m.values()) { items.sort((a, b) => a.tick - b.tick || a.unit.order - b.unit.order); maxRows = Math.max(maxRows, Math.ceil(items.length / perRow)); count += items.length; }
      const h = Math.max(LANE_MIN, LANE_PAD * 2 + maxRows * STEP);
      geom.push({ ...lane, y0: y, h, count });
      y += h;
    }
    const axisY = y;
    const height = axisY + AXIS_H;
    const cutCol = T == null ? n - 1 : colOf(T);

    // 행 이름(HTML 열 — SVG 안에 두면 잘린다)
    ui.clear(laneCol);
    laneCol.style.height = `${height}px`;
    for (const g of geom) {
      const lab = ui.el('div', { class: ['order-lane-label', g.count ? '' : 'is-empty'], style: { top: `${g.y0}px`, height: `${g.h}px` } }, ui.el('b', {}, g.label), ui.el('span', { class: 'order-lane-count' }, fmt.num(g.count)));
      if (g.help) lab.title = g.help;
      laneCol.append(lab);
    }

    svg.replaceChildren();
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', LABELS.mapAria(n, rows.length));
    // 행 바탕 · 밑줄
    for (const [i, g] of geom.entries()) {
      if (i % 2 === 0) svg.append(S('rect', { class: 'order-lane-band', x: 0, y: g.y0, width, height: g.h, fill: 'none' }));
      svg.append(S('line', { class: 'order-lane-line', x1: 0, x2: width, y1: g.y0 + g.h, y2: g.y0 + g.h, stroke: 'none' }));
    }
    // 여기까지 읽음 뒤 칸
    if (cutCol < n - 1) {
      const x0 = colX(cutCol + 1);
      svg.append(S('rect', { class: 'order-after', x: x0, y: 0, width: width - x0, height: axisY, fill: 'none' }));
      svg.append(S('line', { class: 'order-cutline', x1: x0, x2: x0, y1: 0, y2: axisY + 8, stroke: 'none' }));
      svg.append(S('text', { class: 'order-cuttext', x: x0 + 5, y: 12, fill: 'currentColor' }, LABELS.afterCut));
    }
    // 축 — 표시 + 가로 라벨(겹치면 건너뛴다)
    svg.append(S('line', { class: 'order-axis', x1: 0, x2: width, y1: axisY, y2: axisY, stroke: 'none' }));
    let labelRight = -Infinity;
    for (const [i, sp] of spine.entries()) {
      const cx = colX(i) + colW / 2;
      const kind = sp.unit.kind === 'main' ? 'is-main' : sp.unit.kind === 'side' ? 'is-side' : 'is-event';
      const g = S('g', { class: `order-col ${kind} ${i > cutCol ? 'is-after' : ''} ${i === cutCol && T != null ? 'is-cut' : ''}`, transform: `translate(${cx},${axisY})`, tabindex: 0, role: 'button', 'aria-label': `${sp.unit.title} — ${LABELS.axisGo}` });
      g.append(S('rect', { class: 'order-col-hit', x: -colW / 2, y: 0, width: colW, height: AXIS_H, fill: 'transparent' }));
      if (kind === 'is-main') g.append(S('line', { class: 'order-tick', y1: 0, y2: 7, stroke: 'none' }));
      else if (kind === 'is-side') g.append(S('rect', { class: 'order-glyph', x: -3.5, y: 3, width: 7, height: 7, fill: 'none' }));
      else g.append(S('rect', { class: 'order-glyph', x: -3.5, y: 3, width: 7, height: 7, fill: 'none', transform: 'rotate(45 0 6.5)' }));
      if (kind === 'is-main' && cx - AXIS_LABEL_W / 2 >= labelRight + 2) {
        g.append(S('text', { class: 'order-col-label', y: 24, 'text-anchor': 'middle', fill: 'currentColor' }, fmt.tickShort(sp.tick)));
        labelRight = cx + AXIS_LABEL_W / 2;
      }
      ui.tooltip(g, () => ui.el('div', { class: 'order-tip' }, ui.el('div', { class: 'order-tip-title' }, sp.unit.title), ui.el('div', {}, fmt.tickLabel(sp.tick)), ui.el('div', { class: 'order-tip-basis' }, LABELS.axisGo)));
      const go = () => state.set({ t: sp.tick });
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      svg.append(g);
    }
    // 점
    const dots = S('g', { class: 'order-dots' });
    for (const lane of geom) {
      for (const [col, items] of stacks.get(lane.id)) {
        for (const [k, j] of items.entries()) {
          const sub = k % perRow;
          const row = Math.floor(k / perRow);
          const cx = colX(col) + colW / 2 + (sub - (Math.min(perRow, items.length - row * perRow) - 1) / 2) * STEP;
          const cy = lane.y0 + lane.h - LANE_PAD - DOT_R - row * STEP;
          const g = gradeAt(j, T);
          const rises = Boolean(j.from_tick && T != null && T < j.from_tick);
          const c = S('circle', { class: `order-dot ${rises ? 'is-rise' : ''} ${j.key === selKey ? 'is-selected' : ''}`, cx, cy, r: DOT_R, 'data-key': j.key, tabindex: -1, role: 'button', 'aria-label': `${j.unit.title} · ${fmt.KIND[j.unit.kind].label} · ${gl(g)}` });
          c.style.fill = fmt.GRADE[g]?.color ?? 'var(--grade-none)';
          if (rises) c.style.setProperty('--rise', fmt.GRADE[j.grade]?.color ?? 'var(--grade-none)');
          ui.tooltip(c, () => tooltipBody(j, T));
          const go = () => state.set({ sel: `unit:${j.key}` });
          c.addEventListener('click', go);
          c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          dots.append(c);
        }
      }
    }
    svg.append(dots);
    // 읽은 자리(여기까지 읽음 칸)가 가로 스크롤 밖이면 보이는 곳으로 옮긴다
    if (T != null) {
      const x = colX(cutCol) + colW;
      if (x > mapScroll.scrollLeft + mapScroll.clientWidth || x < mapScroll.scrollLeft) mapScroll.scrollLeft = Math.max(0, x - mapScroll.clientWidth * 0.7);
    }
  };
  const tooltipBody = (j, T) => {
    const g = gradeAt(j, T);
    const rises = j.from_tick && T != null && T < j.from_tick;
    return ui.el('div', { class: 'order-tip' },
      ui.el('div', { class: 'order-tip-title' }, j.unit.title),
      ui.el('div', {}, `${fmt.KIND[j.unit.kind].label} · ${fmt.tickLabel(j.tick)} · ${fmt.num(j.unit.chars)}자`),
      ui.el('div', {}, [gl(g), rises ? ` ${LABELS.riseTo(spineLabel(j.from), gl(j.grade))}` : j.from_tick ? ` (${LABELS.riseSince(spineLabel(j.from))})` : '']),
      ui.el('div', { class: 'order-tip-basis' }, j.basis ? `${j.basis}${j.basis_scene ? ` ${fmt.ref(j.basis_scene, j.basis_line)}` : ''} — ${clip(plain(j.reason), 110)}` : clip(plain(j.reason ?? LABELS.noBasis), 110)));
  };

  // ── 분류 카드 ──
  const kv = (rows) => ui.el('dl', { class: 'order-kv' }, rows.filter(Boolean).flatMap(([k, v]) => [ui.el('dt', {}, k), ui.el('dd', {}, v)]));
  const detail = () => data.load('order-detail');
  const renderCard = (s) => {
    const sel = state.parseSel(s.sel);
    const key = sel?.type === 'unit' ? sel.id : null;
    const j = key ? judgedByKey.get(key) : null;
    const sp = key && !j ? spineByKey.get(key) : null;
    ui.clear(card);
    card.dataset.key = key ?? '';
    if (!j && !sp) { card.hidden = true; return; }
    card.hidden = false;
    const close = ui.el('button', { type: 'button', class: 'btn order-card-close', 'aria-label': LABELS.cardClose, onClick: () => state.set({ sel: '' }) }, ui.icon('close'));
    const R = LABELS.rows2;
    if (sp) {
      const climbs = judged.filter((x) => x.from === sp.key && x.from_tick);
      const touched = judged.filter((x) => x.from === sp.key && !x.from_tick);
      const list = (xs, tail) => xs.map((x, i) => [i ? ' · ' : null, ui.link(`unit:${x.key}`, x.unit.title), tail?.(x)]);
      card.append(ui.el('div', { class: 'panel-head' }, ui.el('h3', {}, ui.chip('kind', sp.unit.kind), ' ', ui.link(`unit:${sp.key}`, sp.unit.title)), close),
        kv([[R.grade, ui.chip('grade', sp.unit.kind === 'main' ? '메인' : '척추')],
          [R.release, [fmt.tickLabel(sp.tick), ' · ', ui.link(`tick:${sp.tick}`, fmt.unitTitle(sp.key))]],
          climbs.length ? [R.climbs, list(climbs, (x) => ui.el('span', { class: 'muted' }, ` ${gl(x.before)} → ${gl(x.grade)}`))] : null,
          touched.length ? [R.touched, list(touched, (x) => ui.el('span', { class: 'muted' }, ` ${gl(x.grade)}`))] : null,
          climbs.length || touched.length ? null : [R.touched, ui.el('span', { class: 'muted' }, LABELS.none)]]));
      return;
    }
    const T = s.t;
    const g = gradeAt(j, T);
    const gradeRow = [ui.chip('grade', g ?? j.grade)];
    if (g == null) gradeRow.push(' ', ui.el('span', { class: 'order-spoiler' }, LABELS.after(fmt.tickLabel(j.tick, { date: false }))));
    else if (g !== j.grade) gradeRow.push(' ', ui.el('span', {}, '→ ', ui.link(`unit:${j.from}`, spineLabel(j.from)), '부터 ', ui.chip('grade', j.grade)));
    else if (j.from_tick) gradeRow.push(' ', ui.el('span', { class: 'muted' }, T == null ? LABELS.riseBefore(spineLabel(j.from), gl(j.before ?? j.grade)) : LABELS.riseSince(spineLabel(j.from))));
    const basisText = ui.el('div', { class: 'order-basis-text' });
    const basisRow = j.basis ? [recId(j.basis), j.basis_kind ? [' ', ui.chip('record', j.basis_kind)] : null, j.basis_scene ? [' ', ui.link(`scene:${j.basis_scene}`, fmt.ref(j.basis_scene, j.basis_line))] : null,
      isLibrary(j.basis_scene) ? [' ', ui.el('span', { class: 'order-fl' }, TERM.library)] : null, basisText] : ui.el('span', { class: 'muted' }, LABELS.noBasisLong);
    const histBox = ui.el('div', { class: 'order-history' }, j.trail ? j.trail.map((x, i) => [i ? ' → ' : null, ui.chip('grade', x)]) : ui.el('span', { class: 'muted' }, LABELS.trailNone));
    card.append(
      ui.el('div', { class: 'panel-head' }, ui.el('h3', {}, ui.chip('kind', j.unit.kind), ' ', ui.link(`unit:${j.key}`, j.unit.title), ui.el('span', { class: 'muted order-card-sub' }, ` · ${fmt.tickLabel(j.tick)} · ${fmt.num(j.unit.chars)}자 · ${fmt.num(j.unit.scenes)}${LABELS.scene}`)), close),
      kv([
        [T == null ? R.grade : TERM.gradeAt, gradeRow],
        [R.why, basisRow],
        [R.reason, j.reason ? withLinks(j.reason) : ui.el('span', { class: 'muted' }, LABELS.none)],
        [R.judg, [j.confidence ? ui.chip('confidence', j.confidence) : null, ' ', j.unit.layer ? ui.chip('layer', j.unit.layer) : null, j.asof ? ui.el('span', { class: 'muted' }, ` · ${LABELS.asof} ${j.asof}`) : null]],
        j.from && !j.from_tick ? [R.touch, ui.link(`unit:${j.from}`, spineLabel(j.from))] : null,
        j.threads?.length ? [R.threads, j.threads.map((t, i) => [i ? ' · ' : null, ui.link(`thread:${t}`, idx.threads.get(t)?.title ?? t)])] : null,
        j.origin_of?.length || j.lead_facts ? [R.lead, [j.origin_of?.length ? [ui.el('b', {}, `${R.origins}: `), j.origin_of.map((p, i) => [i ? ' · ' : null, ui.link(`person:${p}`, fmt.targetName(p))]), ' '] : null, j.lead_facts ? ui.el('span', { class: 'muted' }, plain(j.lead_facts)) : null]] : null,
        j.closures ? [R.endings, withLinks(j.closures)] : null,
        [R.history, histBox],
      ]));
    // 근거 문장 · 검토 기록은 따로 받는다(처음 한 번)
    detail().then((d) => {
      if (card.dataset.key !== key) return;
      const x = d.units?.[key];
      if (!x) return;
      if (x.basis_text) basisText.textContent = x.basis_text;
      if (x.reviews?.length) {
        const items = x.reviews.map((r) => ui.el('li', {}, ui.el('span', { class: 'mono' }, `${r.session} ${r.date}`), ` ${r.decision}`,
          r.note != null ? ui.el('span', { class: 'muted' }, ` — ${plain(d.notes?.[r.note] ?? '')}`) : null,
          r.before ? ui.el('div', { class: 'order-review-before muted' }, LABELS.before, ...withLinks(r.before)) : null));
        histBox.append(ui.details(LABELS.reviews(x.reviews.length), ui.el('ul', { class: 'order-reviews' }, items)));
      }
    }).catch(() => { /* 검토 기록을 못 받아도 카드는 쓴다 */ });
  };

  // ── 상태 ──
  apply(state.get());
  renderCard(state.get());
  const off = state.subscribe((s, changed) => {
    if (changed.has('t') || changed.has('layers') || changed.has('p')) { apply(s); renderCard(s); }
    else if (changed.has('sel')) {
      const sel = state.parseSel(s.sel);
      const key = sel?.type === 'unit' ? sel.id : null;
      for (const { tbl } of groups.values()) tbl.setSelected(key);
      for (const c of svg.querySelectorAll('.order-dot')) c.classList.toggle('is-selected', c.dataset.key === key);
      renderCard(s);
    }
  });
  let resizeTimer = null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (mapView.hidden || !mapScroll.clientWidth) return;
    const colW = Math.max(COL_MIN, Math.floor((mapScroll.clientWidth - 8) / spine.length));
    if (colW === lastColW) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawMap(state.get()), 120);
  }) : null;
  ro?.observe(mapScroll);
  detail().catch(() => {}); // 분류 카드를 열기 전에 받아 둔다
  return () => { off(); ro?.disconnect(); clearTimeout(findTimer); clearTimeout(resizeTimer); };
}
