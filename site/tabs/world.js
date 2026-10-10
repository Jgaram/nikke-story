/**
 * 탭 6 세계(W7) — 개념 · 사건 · 물건 · 조직 · 장소 사전(화면 4 개념 쪽)과 "세계의 모습"(생활상) 분류별 목록.
 *
 * 쓰는 JSON
 *   world.json(이 탭 — tools/site/export/world.mjs): entries[225](항목 — 메모 · 다른 이름 · 근거 · 집계 · recs{F|Q|U|E|I|D: [[기록 ID, 출시 시점, 범위, 아는 단위], …]} ·
 *     units[[단위 키, 기록 수], …] · neighbors[{id, n, recs[[기록 ID, 출시 시점], …]}] · threads[{id, n, about}] · hub) · life[449](세계의 모습 — 문장 · 분류 · 단위 · 근거) ·
 *     topics[{topic, n}] · hubs[](자주 나오는 항목) · hub_share
 *   공용(ctx.idx): units(제목 · 출시 시점) · ticks · threads(떡밥 제목 · 무게) · targets(이름) · records(사실 · 의문 문장 — 처음 보일 때 받는다)
 *
 * URL 파라미터(p.*)
 *   mode   dict(사전, 기본) | life(세계의 모습)
 *   item   사전에서 고른 항목 ID(없으면 니케 — 가림 상태면 목록 첫 항목)
 *   type   사전 종류 필터 concept | incident | item | org | place (없으면 전체)
 *   sort   사전 정렬 — 없으면 분류(종류)별 이름순, first면 나온 순서. 옛 값(facts · name · open)은 기본으로 읽는다
 *   find   찾기 낱말 — 사전은 이름 · 다른 이름 · 메모, 세계의 모습은 문장 · 항목 · 스토리
 *   topic  세계의 모습 분류 필터(없으면 분류별 묶음)
 *   hubs   1이면 함께 나온 항목에 자주 나오는 항목(니케 · 랩쳐 · 방주 …)도 넣는다
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13d)
 *   - 여기까지 읽음(state.reading — 메인 자리 t + 척추 이벤트 · 사이드 예외 x)을 모든 목록에 건다. 출시 자리가 아니라 스토리 단위로 본다:
 *     기록은 그 기록을 아는 스토리(recs의 아는 단위 — 사실 · 의문은 know_units)를 봤으면 보이고, 항목은 나온 곳(처음 나온 스토리 · 기록 · 처음 소개된 스토리)
 *     중 하나라도 봤으면 보인다. 아니면 목록에서 빠진다(가린 개수는 내지 않는다). 사실 · 의문 · 세계의 모습 · 함께 나온 항목 · 나온 스토리도
 *     안 본 기록 · 스토리는 빼고 같은 식으로 센다. 나온 곳을 알 수 없는 항목은 컷오프가 켜져 있으면 가린다. 출시 자리(tick0)는 '나온 순서' 정렬 · 안내 문구에만 쓴다.
 *     범위(층) 필터는 없다(W13a) — 층 검사는 걷었다.
 *     바뀌면 목록 · 상세를 다시 만들지 않고 줄만 갈아 끼운다(스크롤 · 접힘 · 찾기 낱말 유지).
 *   - 목록: 기본은 종류(개념 · 사건 · 물건 · 조직 · 장소)별 묶음 + 이름순, 줄 = 이름 + 회색 갈래(도시 · 스쿼드 …). 숫자 · 막대 · '자주 나옴' 꼬리표는 싣지 않는다.
 *     '나온 순서'로 고르면 묶음 없이 처음 나온 자리순(줄에 회색 'CH.01').
 *   - 상세 머리: 이름 + 회색 종류 · 갈래, 사전 설명, 다른 이름, "처음 나온 곳 · 나온 스토리 N편". 사실 · 의문 수 · 근거 장면 줄은 싣지 않는다.
 *     칸(사실 · 의문 · 세계의 모습 · 떡밥 · 함께 나온 항목 · 나온 스토리)은 줄이 있으면 열고, 가린 것만 있으면 접어 머리에 가린 수, 아무것도 없으면 칸을 그리지 않는다.
 *     칸 제목에 줄 수를 달지 않는다(사용자가 직접 연 · 접은 칸만 기억).
 *   - 줄(사실 · 의문 · 세계의 모습): 문장 + 회색 한 줄(스토리 · 장면 링크 — 이름은 한 번만, '추정'은 추정일 때만). 의문 칸 머리에 상태별 수(미해결 · 일부 회수 · 회수).
 *     떡밥 줄은 제목 + '주요 떡밥'(주요일 때만), 나온 스토리 줄은 제목 + 회색 종류(메인은 빼고). 기록 수는 싣지 않는다.
 *   - 열린 의문 = 그 자리에서 열림 또는 일부 회수인 의문(fmt.stateAt). 사실이 나중에 뒤집히면 "뒤집힘" 표시.
 *   - 함께 나온 항목: world.json의 이웃 기록 중 본 것만 센 수로 순서를 정한다(숫자는 싣지 않는다). 그림은 가운데 항목 + 많이 겹친 상위 10(고리 배치, 선 굵기 = 겹친 정도),
 *     목록은 이름 + 회색 종류. 자주 나오는 항목(니케 · 랩쳐 · 방주 …)은 그림 · 목록에서 기본으로 빼고 토글로 넣는다. 480px보다 좁으면 그림 없이 목록만.
 *   - 색은 공용 토큰(--accent · --state-* · --ink-*)만 쓴다. 종류(개념 · 사건 …)는 색 없이 회색 글자로.
 *   - 사실 · 의문 · 세계의 모습 줄을 누르면 리더(sel=record:ID), 스토리 · 장면 · 떡밥 링크는 unit: · scene: · thread:. 사전 메모의 작업 표기는 내보낼 때 걷는다(export 주석).
 */
export const meta = { id: 'world', title: '세계', blurb: '개념 · 사건 · 물건 · 조직 · 장소 사전과 세계의 모습' };

/** 화면 라벨 — 한 곳에 모은다(레포 용어는 화면 말로). 공용 fmt에 있는 것(종류 · 상태 · 시점)은 fmt에서 가져온다 */
const LABELS = {
  mode: { dict: '사전', life: '세계의 모습' },
  modeAria: '보기',
  all: '전체',
  findDict: '항목 찾기',
  findLife: '문장 찾기',
  sortAria: '정렬',
  sort: { group: '분류별', first: '나온 순서' },
  listAria: '항목 목록',
  count: (n) => `${n}개`,
  pickerHint: '다른 항목 고르기',
  first: '처음 나온 곳',
  unitsN: (n) => `나온 스토리 ${n}편`,
  aliases: '다른 이름',
  sec: { facts: '사실', questions: '의문', life: '세계의 모습', neighbors: '함께 나온 항목', units: '나온 스토리' },
  filterIn: '이 안에서 찾기',
  more: (n) => `더 보기 (${n})`,
  empty: { facts: '여기까지 읽은 범위에는 사실이 없다', questions: '여기까지 읽은 범위에는 의문이 없다', life: '이 항목이 어떻게 그려지는지는 아직 없다', threads: '이 항목이 걸린 떡밥이 아직 없다', neighbors: '함께 나온 항목이 아직 없다', units: '나온 스토리가 없다' },
  noMatch: (q) => `‘${q}’에 맞는 줄이 없다`,
  recordsLoading: '불러오는 중…',
  notYet: '아직 나오지 않은 항목이다',
  notYetNote: (when) => `${when}부터 나온다.`,
  skippedNote: '안 봤다고 고른 스토리에서 나온다.',
  noItem: '고를 항목이 없다',
  noItemHint: '찾기 낱말이나 종류를 풀면 보인다.',
  hubsToggle: '자주 나오는 항목 포함',
  graphAria: '함께 나온 항목 그림',
  lifeEmpty: (when) => `여기까지 읽은 범위에는 세계의 모습이 없다. ${when}부터 나온다.`,
  lifeEmptyAll: '조건에 맞는 문장이 없다',
  raiseTo: (when) => `${when}까지 읽음으로 올리기`,
  clearFilters: '필터 풀기',
  topicAria: '분류',
};

const TYPE_ORDER = ['concept', 'incident', 'item', 'org', 'place'];
const DEFAULT_ITEM = 'concept:니케';
const PAGE = { facts: 8, questions: 6, life: 5, threads: 8, neighbors: 10, units: 10, more: 20, groupLife: 5, flatLife: 30 };
const GRAPH = { max: 10, minWidth: 480, w: 600, h: 300 };
const NARROW = 780;
const SVG_NS = 'http://www.w3.org/2000/svg';

const clip = (s, n) => (typeof s === 'string' && [...s].length > n ? `${[...s].slice(0, n).join('')}…` : s ?? '');
const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s_·\-.,'"‘’“”()[\]]+/g, '');

export async function mount(root, ctx) {
  const { state, data, fmt, ui } = ctx;
  const h = ui.el;
  /** 원소가 null · 배열이어도 되는 append(네이티브 append는 null을 글자 "null"로 만든다) */
  const put = (node, ...kids) => { for (const k of kids.flat(Infinity)) if (k != null && k !== false) node.append(k); return node; };
  root.append(ui.spinner('불러오는 중…'));
  const idx = ctx.idx ?? (await data.index());
  const world = await data.load('world');
  ui.clear(root);

  // ── 색인 ──
  const entries = world.entries;
  const byId = new Map(entries.map((e) => [e.id, e]));
  const lifeById = new Map(world.life.map((l) => [l.id, l]));
  const hubs = new Set(world.hubs);
  const unitTick = (k) => idx.units.get(k)?.tick ?? null;
  /** 항목이 처음 나온 출시 시점 — 기록 · 처음 소개된 스토리 중 가장 이른 것('나온 순서' 정렬 · 안내 문구용). 어디에서도 못 찾으면 null */
  const tick0 = new Map();
  for (const e of entries) {
    const ts = [e.first_tick, ...Object.values(e.recs ?? {}).flatMap((l) => l.map((x) => x[1])), ...(e.introduced ?? []).map(unitTick)].filter((t) => t != null);
    tick0.set(e.id, ts.length ? Math.min(...ts) : null);
  }
  /** recs 한 줄 [ID, 출시 시점, 범위, 아는 단위]의 아는 단위 → 단위 키 · 키 배열 · null. 숫자면 그 항목 units[] 안 자리 */
  const recUnits = (e, x) => (typeof x[3] === 'number' ? e.units?.[x[3]]?.[0] ?? null : x[3] ?? null);
  /** 기록을 아나 — 아는 단위(배열이면 하나라도)를 봤으면. 단위가 없으면 출시 시점(state.reading().known과 같은 규칙) */
  const recKnown = (R, u, tick) => (R.all ? true : Array.isArray(u) ? R.seenAny(u) : u != null ? R.seen(u) : state.visible(tick, R.t));
  /** 항목이 나온 곳(공개 자리가 있는 스토리 · 기록) 중 하나라도 봤나 — 하나도 없으면 전부 보기일 때만 */
  const appearUnits = new Map();
  for (const e of entries) {
    const us = [e.first_unit, ...(e.introduced ?? [])].filter((k) => k != null && unitTick(k) != null);
    const rs = Object.values(e.recs ?? {}).flat().filter((x) => x[1] != null).map((x) => [recUnits(e, x), x[1]]);
    appearUnits.set(e.id, { us: [...new Set(us)], rs });
  }
  const appeared = (e, R) => {
    if (R.all) return true;
    const a = appearUnits.get(e.id);
    return a.us.some((k) => R.seen(k)) || a.rs.some(([u, tick]) => recKnown(R, u, tick));
  };
  /** 여기까지 읽음 서명 — t와 척추 이벤트 · 사이드 예외(x)(숫자 캐시 키) */
  const cutSig = (R) => (R.all ? 'all' : `${R.t}|${Object.entries(R.x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${v ? '' : '-'}${k}`).join(',')}`);
  const typeLabel = (t) => fmt.TARGET_TYPE[t] ?? t;
  const whenLabel = (tick) => fmt.tickLabel(tick, { date: false });
  const nameOf = (id) => byId.get(id)?.name ?? fmt.targetName(id);

  // ── 상태 읽기 ──
  /** c = { R(여기까지 읽음 — state.reading), sig } */
  const cutOf = (s = state.get()) => { const R = state.reading(s); return { R, sig: cutSig(R) }; };
  const paramsOf = (s = state.get()) => ({
    mode: s.p.mode === 'life' ? 'life' : 'dict',
    item: s.p.item ?? null,
    type: TYPE_ORDER.includes(s.p.type) ? s.p.type : null,
    sort: s.p.sort === 'first' ? 'first' : 'group',
    find: s.p.find ?? '',
    topic: s.p.topic ?? null,
    hubs: s.p.hubs === '1',
  });
  const setP = (patch, replace = true) => state.set({ p: patch }, { replace });
  let recordsReady = idx.hasRecords;

  /** [[id, tick, 범위, 아는 단위], …]를 여기까지 읽음으로 가른다. e를 주면 아는 단위의 숫자를 그 항목 units[]로 푼다(범위 칸은 쓰지 않는다 — 층 필터 없음) */
  function split(list, c, e = null) {
    const shown = [];
    let cutHidden = 0;
    for (const x of list) {
      if (recKnown(c.R, e ? recUnits(e, x) : x[3] ?? null, x[1])) shown.push(x);
      else cutHidden++;
    }
    return { shown, cutHidden };
  }

  // 항목이 보이나 — 여기까지 읽음이 바뀔 때만 다시 본다
  let viewKey = '';
  let views = new Map();
  function viewOf(e, c) {
    if (c.sig !== viewKey) { viewKey = c.sig; views = new Map(); }
    let v = views.get(e.id);
    if (v) return v;
    const cutOk = appeared(e, c.R);
    v = { e, cutOk, shown: cutOk };
    views.set(e.id, v);
    return v;
  }

  const byRecord = (a, b) => (a.tick ?? 0) - (b.tick ?? 0) || (a.order ?? 0) - (b.order ?? 0) || String(a.scene).localeCompare(String(b.scene)) || (a.line ?? 0) - (b.line ?? 0);

  // ── 작은 조각 ──
  const dots = (items) => items.filter(Boolean).flatMap((x, i) => (i ? [h('span', { class: 'w-dot', 'aria-hidden': 'true' }, '·'), x] : [x]));
  const kindText = (u) => (u && u.kind !== 'main' ? h('span', { class: 'w-kind', title: fmt.help('kind', u.kind) }, fmt.KIND[u.kind]?.label ?? u.kind) : null);
  const itemLink = (id) => {
    if (byId.has(id)) {
      return h('a', { href: '#', class: 'link w-about', dataset: { item: id }, onClick: (ev) => { ev.preventDefault(); gotoItem(id); } }, nameOf(id));
    }
    return ui.link(`${id.startsWith('person:') ? 'person' : 'target'}:${id}`, fmt.targetName(id), { class: 'w-about' });
  };
  const threadLink = (id) => {
    const j = idx.threads.get(id);
    if (!j) return null;
    return ui.link(`thread:${id}`, clip(j.title, 22), { class: 'w-thread', title: j.title });
  };
  const threadVisible = (id, c) => {
    const j = idx.threads.get(id);
    if (!j) return false;
    return unitTick(j.first_unit) == null || c.R.seen(j.first_unit);
  };

  /** 기록 한 줄(사실 · 의문 · 세계의 모습) — 누르면 리더. 회색 줄 = 스토리 · 장면(스토리 이름은 한 번만) */
  function recRow(r, c, { chips = [], showTopic = false, showAbout = false, about: aboutIds = null } = {}) {
    const u = idx.units.get(r.unit);
    const ev = r.evidence?.[0];
    const li = h('li', { class: 'w-rec', tabindex: 0, dataset: { id: r.id } },
      h('div', { class: 'w-rec-text' }, chips.length ? h('span', { class: 'chips w-rec-chips' }, chips) : null, fmt.recordText(r)),
      h('div', { class: 'w-meta' }, dots([
        showTopic && r.topic ? h('span', { class: 'w-kind' }, r.topic) : null,
        u ? ui.link(`unit:${r.unit}`, u.title, { class: 'w-unit' }) : null,
        ev ? ui.link(`scene:${ev.scene}`, u ? fmt.refIn(ev.scene, r.unit) : fmt.ref(ev.scene), { class: 'w-ref' }) : null,
        r.confidence === '추정' ? ui.chip('confidence', '추정') : null,
      ])),
      showAbout && aboutIds?.length ? h('div', { class: 'w-meta w-aboutline' }, aboutIds.map((a) => itemLink(a))) : null);
    const open = () => state.set({ sel: `record:${r.id}` });
    li.addEventListener('click', (ev) => { if (!ev.target.closest('a, button')) open(); });
    li.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === li) { ev.preventDefault(); open(); } });
    return li;
  }

  /**
   * 갱신되는 줄 목록 — 찾기 입력 · 더 보기를 스스로 들고 있어, refresh()는 줄만 다시 그린다.
   * get() → { items, cutHidden } / row(item) → li / text(item) → 찾기 대상 글 / refresh()는 센 수를 돌려준다.
   */
  function reactiveList({ get, row, text, size, empty, finder = true, lead = null }) {
    let limit = size;
    let q = '';
    const input = finder ? h('input', { type: 'search', class: 'w-input w-input-sm', placeholder: LABELS.filterIn, 'aria-label': LABELS.filterIn, autocomplete: 'off', spellcheck: 'false' }) : null;
    const bar = h('div', { class: 'w-rl-bar' }, input);
    const leadEl = h('div', { class: 'w-rl-lead' });
    const list = h('ul', { class: 'w-recs' });
    const foot = h('div', { class: 'w-rl-foot' });
    const el = h('div', { class: 'w-rl' }, bar, leadEl, list, foot);
    const api = { el, hidden: 0, loading: false, refresh: null };
    let timer = null;
    input?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { q = norm(input.value); limit = size; refresh(); }, 120);
    });
    function refresh() {
      const g = get();
      let items = g.items;
      if (q) items = items.filter((it) => norm(text(it)).includes(q));
      ui.clear(leadEl);
      if (lead) { const l = lead(g); if (l) leadEl.append(l); }
      ui.clear(list);
      for (const it of items.slice(0, limit)) list.append(row(it));
      ui.clear(foot);
      if (!items.length) foot.append(h('div', { class: 'empty' }, q ? LABELS.noMatch(input.value) : empty));
      if (items.length > limit) {
        foot.append(h('button', { type: 'button', class: 'btn', onClick: () => { limit += PAGE.more; refresh(); } }, LABELS.more(items.length - limit)));
      }
      if (input) bar.hidden = g.items.length <= size;
      api.hidden = g.cutHidden;
      api.loading = Boolean(g.loading);
      return g.items.length;
    }
    api.refresh = refresh;
    return api;
  }

  // ═══ 껍데기 ═══
  const app = h('div', { class: 'w-app' });
  root.append(app);
  const modeSeg = ui.segmented({
    label: LABELS.modeAria,
    options: [{ value: 'dict', label: LABELS.mode.dict }, { value: 'life', label: LABELS.mode.life }],
    value: paramsOf().mode,
    onChange: (v) => setP({ mode: v === 'dict' ? null : v }, false),
  });
  const findInput = h('input', { type: 'search', class: 'w-input', autocomplete: 'off', spellcheck: 'false', value: paramsOf().find });
  let findTimer = null;
  findInput.addEventListener('input', () => {
    clearTimeout(findTimer);
    if (narrow && paramsOf().mode === 'dict') picker.open = true;
    findTimer = setTimeout(() => setP({ find: findInput.value.trim() || null }), 140);
  });
  const head = h('div', { class: 'w-head' }, h('h2', { class: 'sr-only' }, meta.title), modeSeg.el, h('label', { class: 'w-find' }, ui.icon('search'), findInput));

  const dictView = h('div', { class: 'w-split' });
  const lifeView = h('div', { class: 'w-life' });
  app.append(head, dictView, lifeView);

  // ── 사전: 왼쪽 목록 ──
  const typeChips = h('div', { class: 'w-types', role: 'group', 'aria-label': '종류' });
  const sortSel = h('select', { class: 'w-select', 'aria-label': LABELS.sortAria, onChange: () => setP({ sort: sortSel.value === 'group' ? null : sortSel.value }) },
    Object.entries(LABELS.sort).map(([v, l]) => h('option', { value: v }, l)));
  const listCount = h('span', { class: 'w-count muted' });
  const listUl = h('ul', { class: 'w-items', role: 'listbox', 'aria-label': LABELS.listAria });
  const listNote = h('div', { class: 'w-list-note' });
  const listBody = h('div', { class: 'w-list-body' }, listUl, listNote);
  const pickerSum = h('summary', { class: 'w-picker-sum' });
  const listPanel = h('div', { class: 'w-list-panel' }, h('div', { class: 'w-list-top' }, typeChips, h('div', { class: 'w-list-tools' }, sortSel, listCount)), listBody);
  const picker = h('details', { class: 'w-picker', open: true }, pickerSum, listPanel);
  picker.addEventListener('toggle', () => { if (picker.open) scrollToSelected(); });
  const listCol = h('aside', { class: 'w-list' }, picker);
  const detailEl = h('section', { class: 'w-detail', 'aria-live': 'polite' });
  dictView.append(listCol, detailEl);
  const lifeBar = h('div', { class: 'w-topics', role: 'group', 'aria-label': LABELS.topicAria });
  const lifeList = h('div', { class: 'w-life-list' });
  lifeView.append(lifeBar, lifeList);

  // ═══ 사전 목록 ═══
  function effectiveItem(s = state.get()) {
    const P = paramsOf(s);
    if (P.item && byId.has(P.item)) return P.item;
    const c = cutOf(s);
    const d = byId.get(DEFAULT_ITEM);
    if (d && viewOf(d, c).shown) return d.id;
    return entries.find((e) => viewOf(e, c).shown)?.id ?? null;
  }
  function renderList() {
    const s = state.get();
    const P = paramsOf(s);
    const c = cutOf(s);
    const all = entries.map((e) => viewOf(e, c));
    const visible = all.filter((v) => v.shown);
    const q = norm(P.find);
    const matched = visible.filter((v) => !q || norm([v.e.name, v.e.id, v.e.kind, v.e.note, ...(v.e.aliases ?? []).map((a) => a.name)].join(' ')).includes(q));
    ui.clear(typeChips);
    // 종류 칩 — 숫자 없이 이름만(감상 순서 칩과 같다)
    const chip = (value, label) => h('button', { type: 'button', class: 'w-chip', 'aria-pressed': String((P.type ?? 'all') === value), onClick: () => setP({ type: value === 'all' ? null : value, item: P.item }) }, label);
    put(typeChips, chip('all', LABELS.all), TYPE_ORDER.filter((t) => matched.some((v) => v.e.type === t) || P.type === t).map((t) => chip(t, typeLabel(t))));
    const rows = matched.filter((v) => !P.type || v.e.type === P.type);
    const byName = (a, b) => a.e.name.localeCompare(b.e.name, 'ko');
    const byFirst = (a, b) => (tick0.get(a.e.id) ?? Infinity) - (tick0.get(b.e.id) ?? Infinity) || (a.e.first_order ?? 0) - (b.e.first_order ?? 0) || byName(a, b);
    rows.sort(P.sort === 'first' ? byFirst : (a, b) => TYPE_ORDER.indexOf(a.e.type) - TYPE_ORDER.indexOf(b.e.type) || byName(a, b));
    sortSel.value = P.sort;
    listCount.textContent = LABELS.count(fmt.num(rows.length));
    ui.clear(listUl);
    const grouped = P.sort === 'group' && !P.type; // 종류 하나로 거르면 묶음 머리가 필요 없다
    let lastType = null;
    for (const v of rows) {
      const e = v.e;
      if (grouped && e.type !== lastType) {
        lastType = e.type;
        listUl.append(h('li', { class: 'w-group-head', role: 'presentation' }, typeLabel(e.type)));
      }
      const t0 = tick0.get(e.id);
      listUl.append(h('li', { class: 'w-item', role: 'option', tabindex: -1, dataset: { id: e.id }, 'aria-selected': 'false' },
        h('span', { class: 'w-item-name' }, e.name),
        P.sort === 'first' && t0 != null ? h('span', { class: 'w-item-sub' }, fmt.tickShort(t0)) : null,
        e.kind ? h('span', { class: 'w-item-sub' }, e.kind) : null));
    }
    ui.clear(listNote);
    if (!rows.length) {
      put(listNote, h('div', { class: 'empty' }, LABELS.noItem, ' ', LABELS.noItemHint),
        P.find || P.type ? h('button', { type: 'button', class: 'btn', onClick: () => setP({ find: null, type: null }) }, LABELS.clearFilters) : null);
      if (P.find) findInput.value = P.find;
    }
    markSelected();
  }
  function markSelected() {
    const id = effectiveItem();
    let target = null;
    const items = listUl.querySelectorAll('.w-item');
    for (const li of items) {
      const on = li.dataset.id === id;
      li.setAttribute('aria-selected', String(on));
      li.classList.toggle('is-selected', on);
      li.tabIndex = on ? 0 : -1;
      if (on) target = li;
    }
    if (!target && items.length) items[0].tabIndex = 0;
    const e = byId.get(id);
    const known = e && viewOf(e, cutOf()).cutOk;
    ui.clear(pickerSum);
    put(pickerSum, h('span', { class: 'w-picker-name' }, known ? e.name : e ? LABELS.notYet : LABELS.noItem), known ? h('span', { class: 'muted' }, ` ${typeLabel(e.type)}`) : null, h('span', { class: 'w-picker-hint' }, LABELS.pickerHint));
    return target;
  }
  function scrollToSelected() {
    const li = listUl.querySelector('.is-selected');
    if (!li || !listBody.clientHeight) return;
    const top = li.offsetTop - listBody.clientHeight / 3;
    if (li.offsetTop < listBody.scrollTop || li.offsetTop + li.offsetHeight > listBody.scrollTop + listBody.clientHeight) listBody.scrollTop = Math.max(0, top);
  }
  function gotoItem(id) {
    state.set({ p: { mode: null, item: id } }, { replace: false });
  }
  listUl.addEventListener('click', (ev) => {
    const li = ev.target.closest('.w-item');
    if (li) gotoItem(li.dataset.id);
  });
  listUl.addEventListener('keydown', (ev) => {
    const li = ev.target.closest('.w-item');
    if (!li) return;
    const items = [...listUl.querySelectorAll('.w-item')];
    const i = items.indexOf(li);
    const move = (n) => { ev.preventDefault(); const t = items[Math.max(0, Math.min(items.length - 1, n))]; for (const x of items) x.tabIndex = -1; t.tabIndex = 0; t.focus(); };
    if (ev.key === 'ArrowDown') move(i + 1);
    else if (ev.key === 'ArrowUp') move(i - 1);
    else if (ev.key === 'Home') move(0);
    else if (ev.key === 'End') move(items.length - 1);
    else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); gotoItem(li.dataset.id); }
  });

  // ═══ 사전 상세 ═══
  const secOpen = new Map(); // 사용자가 직접 접거나 편 섹션만 기억한다. 나머지는 줄이 있으면 열고 없으면 접는다
  let detail = null; // { id, parts: Map(key → { part, sec, ... }), headerEl }
  /** 접는 칸 — 제목에 줄 수를 달지 않는다. 보이는 줄이 없으면 칸을 숨긴다(가린 개수는 내지 않는다) */
  function section(key, title, part, open) {
    const hEl = h('span', { class: 'w-sec-hidden' });
    const sum = h('summary', {}, h('span', { class: 'w-sec-title' }, title), hEl);
    const sec = h('details', { class: 'w-sec', dataset: { key }, open: secOpen.has(key) ? secOpen.get(key) : open }, sum, h('div', { class: 'w-sec-body' }, part.el));
    let touched = secOpen.has(key);
    sum.addEventListener('click', () => { touched = true; });
    sec.addEventListener('toggle', () => { if (touched) secOpen.set(key, sec.open); });
    return { sec, hEl, part, open, isTouched: () => touched };
  }
  function refreshPart(p) {
    const n = p.part.refresh();
    p.sec.hidden = !n && !p.part.loading; // 가린 것만 있는 칸은 숨긴다 — 가린 개수는 내지 않는다(사용자, 2026-10-10)
    if (!p.isTouched() && !p.part.loading) p.sec.open = n > 0 && p.open;
  }

  function buildDetail(e) {
    const parts = new Map();
    const id = e.id;
    // 사실
    const facts = reactiveList({
      size: PAGE.facts, empty: LABELS.empty.facts, text: (r) => r.text,
      get() {
        const c = cutOf();
        if (!recordsReady) return { items: [], cutHidden: 0, loading: true };
        const g = split(e.recs.F ?? [], c, e);
        const items = g.shown.map((x) => idx.records.get(x[0])).filter(Boolean).sort(byRecord);
        return { items, cutHidden: g.cutHidden };
      },
      lead: (g) => (g.loading ? ui.spinner(LABELS.recordsLoading) : null),
      row: (r) => { const c = cutOf(); return recRow(r, c, { chips: fmt.stateAt(r, c.R) === '뒤집힘' ? [ui.chip('state', '뒤집힘')] : [] }); },
    });
    parts.set('facts', section('facts', LABELS.sec.facts, facts, true));
    // 의문
    const qRank = { 열림: 0, 일부: 1, 풀림: 2 };
    const questions = reactiveList({
      size: PAGE.questions, empty: LABELS.empty.questions, text: (r) => r.text,
      get() {
        const c = cutOf();
        if (!recordsReady) return { items: [], cutHidden: 0, loading: true };
        const g = split(e.recs.Q ?? [], c, e);
        const items = g.shown.map((x) => idx.records.get(x[0])).filter(Boolean).map((r) => ({ r, st: fmt.stateAt(r, c.R) }))
          .sort((a, b) => (qRank[a.st] ?? 3) - (qRank[b.st] ?? 3) || byRecord(a.r, b.r));
        return { items, cutHidden: g.cutHidden };
      },
      lead: (g) => {
        if (g.loading) return ui.spinner(LABELS.recordsLoading);
        const n = { 열림: 0, 일부: 0, 풀림: 0 };
        for (const it of g.items) if (it.st in n) n[it.st]++;
        return g.items.length ? h('div', { class: 'w-qsum' }, ['열림', '일부', '풀림'].map((k) => (n[k] ? h('span', {}, ui.chip('state', k), ` ${n[k]}`) : null))) : null;
      },
      row: ({ r, st }) => {
        const c = cutOf();
        const tl = (r.threads ?? []).filter((j) => threadVisible(j, c)).map(threadLink).filter(Boolean);
        const li = recRow(r, c, { chips: st ? [ui.chip('state', st)] : [] });
        if (tl.length) li.append(h('div', { class: 'w-meta w-threads' }, tl));
        if (st === '열림' || st === '일부') li.classList.add('is-open');
        return li;
      },
    });
    parts.set('questions', section('questions', LABELS.sec.questions, questions, true));
    // 세계의 모습
    const life = reactiveList({
      size: PAGE.life, empty: LABELS.empty.life, text: (l) => l.text, finder: false,
      get() {
        const c = cutOf();
        const g = split(e.recs.U ?? [], c, e);
        const items = g.shown.map((x) => lifeById.get(x[0])).filter(Boolean).sort(byRecord);
        return { items, cutHidden: g.cutHidden };
      },
      row: (l) => recRow(l, cutOf(), { showTopic: true }),
    });
    parts.set('life', section('life', LABELS.sec.life, life, true));
    // 걸린 떡밥
    const threads = reactiveList({
      size: PAGE.threads, empty: LABELS.empty.threads, text: (t) => t.title, finder: false,
      get() {
        const c = cutOf();
        const count = new Map();
        if (recordsReady) {
          for (const x of Object.values(e.recs).flat()) {
            if (!recKnown(c.R, recUnits(e, x), x[1])) continue;
            for (const j of idx.records.get(x[0])?.threads ?? []) count.set(j, (count.get(j) ?? 0) + 1);
          }
        }
        const items = (e.threads ?? []).filter((t) => threadVisible(t.id, c))
          .map((t) => ({ ...t, n: recordsReady ? (count.get(t.id) ?? 0) : t.n, title: idx.threads.get(t.id)?.title ?? t.id, j: idx.threads.get(t.id) }))
          .filter((t) => t.n > 0 || t.about)
          .sort((a, b) => ({ 뼈대: 0, 보강: 1, 독립: 2 }[a.j?.weight] ?? 3) - ({ 뼈대: 0, 보강: 1, 독립: 2 }[b.j?.weight] ?? 3) || b.n - a.n);
        return { items, cutHidden: 0 };
      },
      // 제목 + '주요 떡밥'(주요일 때만 — 무게 칩 · 기록 수는 싣지 않는다)
      row: (t) => h('li', { class: 'w-thread-row' },
        ui.link(`thread:${t.id}`, t.title, { class: 'w-thread-title' }),
        fmt.majorThread(t.j) ? h('span', { class: 'w-kind', title: fmt.help('weight', t.j.weight) }, fmt.majorThread(t.j)) : null),
    });
    parts.set('threads', section('threads', fmt.TERM.thread, threads, false));
    // 함께 나온 항목
    parts.set('neighbors', section('neighbors', LABELS.sec.neighbors, neighborsPart(e), true));
    // 나온 스토리
    const units = reactiveList({
      size: PAGE.units, empty: LABELS.empty.units, text: (u) => idx.units.get(u[0])?.title ?? u[0], finder: true,
      get() {
        const c = cutOf();
        const all = (e.units ?? []).filter((u) => idx.units.has(u[0]));
        const items = all.filter((u) => c.R.seen(u[0]));
        return { items, cutHidden: all.length - items.length };
      },
      // 제목 + 회색 종류(메인은 제목이 CH라 뺀다)
      row: ([k]) => {
        const u = idx.units.get(k);
        return h('li', { class: 'w-unit-row' }, ui.link(`unit:${k}`, u.title), kindText(u));
      },
    });
    parts.set('units', section('units', LABELS.sec.units, units, false));
    return { id, parts, headerEl: h('header', { class: 'w-card' }) };
  }

  /** 상세 머리 — 이름 + 회색 종류 · 갈래, 설명, 다른 이름, '처음 나온 곳 · 나온 스토리 N편'(본 스토리만) */
  function fillHeader(d, e, v, c) {
    const el = d.headerEl;
    ui.clear(el);
    const seenUnits = (e.units ?? []).map((u) => u[0]).filter((k) => idx.units.has(k) && c.R.seen(k));
    // 처음 나온 곳 — 처음 나온 스토리를 봤으면 그것, 아니면 본 스토리 가운데 가장 앞(안 봄으로 둔 척추 이벤트 · 사이드)
    const firstKey = e.first_unit && idx.units.has(e.first_unit) && c.R.seen(e.first_unit) ? e.first_unit
      : [...seenUnits].sort((a, b) => (idx.units.get(a).order ?? 0) - (idx.units.get(b).order ?? 0))[0];
    const firstUnit = firstKey ? idx.units.get(firstKey) : null;
    put(el,
      h('div', { class: 'w-card-title' }, h('h3', {}, e.name), h('span', { class: 'w-card-kind' }, [typeLabel(e.type), e.kind].filter(Boolean).join(' · '))),
      fmt.prose(e.note) ? h('p', { class: 'w-note' }, fmt.prose(e.note)) : null,
      (e.aliases ?? []).length ? h('p', { class: 'w-aliases' }, h('span', { class: 'muted' }, `${LABELS.aliases} `), e.aliases.map((a, i) => [i ? ' · ' : null,
        h('span', { class: a.caution ? 'w-alias has-note' : 'w-alias', title: a.caution ?? undefined }, a.name, a.how ? h('span', { class: 'muted' }, ` (${a.how})`) : null)])) : null,
      firstUnit || seenUnits.length ? h('p', { class: 'w-facts-line' }, dots([
        firstUnit ? h('span', {}, h('span', { class: 'muted' }, `${LABELS.first} `), ui.link(`unit:${firstUnit.key}`, firstUnit.title)) : null,
        seenUnits.length ? h('span', {}, LABELS.unitsN(fmt.num(seenUnits.length))) : null,
      ])) : null);
  }

  /** 함께 나온 항목 — 그림(고리 배치) + 이름 목록(많이 겹친 순, 숫자는 싣지 않는다). 자주 나오는 항목은 토글을 켜야 그림 · 목록에 든다 */
  function neighborsPart(e) {
    const hubToggle = ui.toggle({ label: LABELS.hubsToggle, checked: paramsOf().hubs, onChange: (on) => setP({ hubs: on ? '1' : null }) });
    const figure = h('div', { class: 'w-figure' });
    const list = h('ul', { class: 'w-nb-list' });
    const foot = h('div', { class: 'w-rl-foot' });
    const tools = h('div', { class: 'w-rl-bar w-nb-tools' }, hubToggle);
    const el = h('div', { class: 'w-rl w-nb' }, tools, figure, list, foot);
    const api = { el, hidden: 0, loading: false, refresh: null };
    let limit = PAGE.neighbors;
    function neighborsAt(c) {
      // 이웃 기록은 이 항목 recs에도 있다 — 아는 단위를 거기서 찾는다
      const recOf = new Map(Object.values(e.recs).flat().map((x) => [x[0], x]));
      const out = [];
      for (const nb of e.neighbors ?? []) {
        const other = byId.get(nb.id);
        if (!other || !viewOf(other, c).shown) continue;
        const n = nb.recs.filter(([rid, tick]) => {
          const x = recOf.get(rid);
          return recKnown(c.R, x ? recUnits(e, x) : null, tick);
        }).length;
        if (n) out.push({ id: nb.id, e: other, n, hub: hubs.has(nb.id) });
      }
      return out.sort((a, b) => b.n - a.n || a.e.name.localeCompare(b.e.name, 'ko'));
    }
    function refresh() {
      const c = cutOf();
      const P = paramsOf();
      hubToggle.set(P.hubs);
      const items = neighborsAt(c);
      const shown = items.filter((x) => P.hubs || !x.hub);
      const maxN = Math.max(1, ...shown.map((x) => x.n));
      ui.clear(figure);
      ui.clear(list);
      ui.clear(foot);
      const drawable = shown.slice(0, GRAPH.max);
      if (drawable.length && detailEl.clientWidth >= GRAPH.minWidth) figure.append(drawGraph(e, drawable, maxN));
      for (const it of shown.slice(0, limit)) {
        list.append(h('li', {}, h('button', { type: 'button', class: 'w-nb-item', dataset: { id: it.id }, onClick: () => gotoItem(it.id) },
          it.e.name, h('span', { class: 'w-kind' }, typeLabel(it.e.type)))));
      }
      tools.hidden = !items.some((x) => x.hub);
      if (!shown.length) foot.append(h('div', { class: 'empty' }, LABELS.empty.neighbors));
      if (shown.length > limit) foot.append(h('button', { type: 'button', class: 'btn', onClick: () => { limit += PAGE.more; refresh(); } }, LABELS.more(shown.length - limit)));
      return items.length;
    }
    api.refresh = refresh;
    return api;
  }

  function drawGraph(center, items, maxN) {
    const { w, h: H } = GRAPH;
    const cx = w / 2;
    const cy = H / 2;
    const rx = 190;
    const ry = 98;
    const mk = (tag, attrs = {}, text) => {
      const n = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text != null) n.textContent = text;
      return n;
    };
    const svg = mk('svg', { viewBox: `0 0 ${w} ${H}`, class: 'w-graph', role: 'img', 'aria-label': `${center.name} — ${LABELS.graphAria}` });
    const edges = mk('g', { class: 'w-edges' });
    const nodes = mk('g', { class: 'w-nodes' });
    svg.append(edges, nodes);
    items.forEach((it, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / items.length;
      const x = cx + rx * Math.cos(a);
      const y = cy + ry * Math.sin(a);
      edges.append(mk('line', { x1: cx, y1: cy, x2: x, y2: y, 'stroke-width': (1.5 + 5 * (it.n / maxN)).toFixed(1), class: it.hub ? 'w-edge is-hub' : 'w-edge' }));
      const g = mk('g', { class: it.hub ? 'w-node is-hub' : 'w-node', tabindex: 0, role: 'button', 'aria-label': it.e.name });
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
      const lx = anchor === 'start' ? x + 11 : anchor === 'end' ? x - 11 : x;
      const ly = anchor === 'middle' ? (sin < 0 ? y - 12 : y + 20) : y + 4;
      g.append(mk('circle', { cx: x, cy: y, r: 16, class: 'w-hit' }), mk('circle', { cx: x, cy: y, r: 5.5, class: 'w-dot-node' }), mk('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'w-node-label' }, clip(it.e.name, 12)));
      ui.tooltip(g, () => h('div', {}, h('b', {}, it.e.name), h('div', {}, `${typeLabel(it.e.type)}${it.e.kind ? ` · ${it.e.kind}` : ''}`)));
      g.addEventListener('click', () => gotoItem(it.id));
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); gotoItem(it.id); } });
      nodes.append(g);
    });
    const cg = mk('g', { class: 'w-node is-center' });
    cg.append(mk('circle', { cx, cy, r: 9, class: 'w-dot-node' }), mk('text', { x: cx, y: cy + 28, 'text-anchor': 'middle', class: 'w-node-label is-center' }, clip(center.name, 14)));
    nodes.append(cg);
    return svg;
  }

  function renderDetail() {
    const s = state.get();
    const c = cutOf(s);
    const id = effectiveItem(s);
    ui.clear(detailEl);
    detail = null;
    const e = id && byId.get(id);
    if (!e) {
      detailEl.append(h('div', { class: 'empty' }, LABELS.noItem));
      return;
    }
    const v = viewOf(e, c);
    if (!v.cutOk) {
      const t0 = tick0.get(e.id);
      detailEl.append(h('div', { class: 'w-locked' }, h('h3', {}, LABELS.notYet), t0 != null ? h('p', { class: 'muted' }, state.visible(t0, c.R.t) ? LABELS.skippedNote : LABELS.notYetNote(whenLabel(t0))) : null));
      return;
    }
    detail = buildDetail(e);
    detailEl.append(detail.headerEl);
    for (const p of detail.parts.values()) detailEl.append(p.sec);
    refreshDetail();
  }
  /** 숫자 · 줄만 갈아 끼운다 */
  function refreshDetail() {
    if (!detail) return;
    const e = byId.get(detail.id);
    const c = cutOf();
    const v = viewOf(e, c);
    fillHeader(detail, e, v, c);
    for (const p of detail.parts.values()) refreshPart(p);
  }

  // ═══ 세계의 모습 ═══
  const lifeMore = new Map();
  function lifeRow(l, opts) {
    return recRow(l, cutOf(), { ...opts, showAbout: true, about: l.about });
  }
  function renderLife() {
    const s = state.get();
    const P = paramsOf(s);
    const c = cutOf(s);
    const q = norm(P.find);
    const g = split(world.life.map((l) => [l.id, l.tick, null, l.unit ?? null]), c);
    const pool = g.shown.map((x) => lifeById.get(x[0]));
    const text = (l) => norm([l.text, l.topic, idx.units.get(l.unit)?.title, ...(l.about ?? []).map(nameOf)].join(' '));
    const matched = q ? pool.filter((l) => text(l).includes(q)) : pool;
    const counts = new Map();
    for (const l of matched) counts.set(l.topic, (counts.get(l.topic) ?? 0) + 1);
    ui.clear(lifeBar);
    // 분류 칩 — 숫자 없이 이름만, 찾기에 걸린 줄이 없는 분류는 뺀다(고른 것은 남긴다)
    const chip = (value, label) => h('button', { type: 'button', class: 'w-chip', 'aria-pressed': String((P.topic ?? 'all') === value), onClick: () => setP({ topic: value === 'all' ? null : value }) }, label);
    put(lifeBar, chip('all', LABELS.all), world.topics.filter((t) => counts.get(t.topic) || P.topic === t.topic).map((t) => chip(t.topic, t.topic)));
    ui.clear(lifeList);
    const moreBtn = (key, left, step) => h('button', { type: 'button', class: 'btn', onClick: () => { lifeMore.set(key, (lifeMore.get(key) ?? step) + PAGE.more); renderLife(); } }, LABELS.more(left));
    if (!matched.length) {
      // 메인 자리를 올려서 보이게 되는 것 중 가장 이른 자리(척추 이벤트 · 사이드를 안 봄으로 둔 것은 t를 올려도 안 보여서 뺀다)
      const next = world.life.filter((l) => !recKnown(c.R, l.unit ?? null, l.tick) && l.tick > c.R.t && !(l.unit in c.R.x)).reduce((m, l) => Math.min(m, l.tick), Infinity);
      const hiddenByCut = !pool.length && Number.isFinite(next);
      lifeList.append(h('div', { class: 'w-empty' },
        h('p', { class: 'muted' }, hiddenByCut ? LABELS.lifeEmpty(whenLabel(next)) : LABELS.lifeEmptyAll),
        hiddenByCut ? h('button', { type: 'button', class: 'btn', onClick: () => state.askCutoff({ t: next }) }, LABELS.raiseTo(fmt.tickShort(next))) : null,
        !hiddenByCut && (P.find || P.topic) ? h('button', { type: 'button', class: 'btn', onClick: () => setP({ find: null, topic: null }) }, LABELS.clearFilters) : null));
      return;
    }
    if (P.topic) {
      const rows = matched.filter((l) => l.topic === P.topic);
      const lim = lifeMore.get('flat') ?? PAGE.flatLife;
      const ul = h('ul', { class: 'w-recs w-recs-life' }, rows.slice(0, lim).map((l) => lifeRow(l, {})));
      put(lifeList, ul, rows.length > lim ? moreBtn('flat', rows.length - lim, PAGE.flatLife) : null);
    } else {
      for (const t of world.topics) {
        const rows = matched.filter((l) => l.topic === t.topic);
        if (!rows.length) continue;
        const lim = lifeMore.get(t.topic) ?? PAGE.groupLife;
        lifeList.append(h('section', { class: 'w-group' },
          h('h3', {}, h('button', { type: 'button', class: 'w-linkbtn', onClick: () => setP({ topic: t.topic }) }, t.topic)),
          h('ul', { class: 'w-recs w-recs-life' }, rows.slice(0, lim).map((l) => lifeRow(l, {}))),
          rows.length > lim ? moreBtn(t.topic, rows.length - lim, PAGE.groupLife) : null));
      }
    }
  }

  // ═══ 모드 · 폭 ═══
  let narrow = null;
  function applyWidth() {
    const n = root.clientWidth > 0 && root.clientWidth < NARROW;
    if (n === narrow) return;
    narrow = n;
    app.classList.toggle('is-narrow', n);
    picker.open = !n;
    if (detail && !dictView.hidden) refreshDetail();
  }
  function applyMode() {
    const P = paramsOf();
    dictView.hidden = P.mode !== 'dict';
    lifeView.hidden = P.mode !== 'life';
    modeSeg.set(P.mode);
    findInput.placeholder = P.mode === 'dict' ? LABELS.findDict : LABELS.findLife;
    findInput.setAttribute('aria-label', findInput.placeholder);
  }
  function renderAll() {
    applyMode();
    const P = paramsOf();
    if (P.mode === 'dict') { renderList(); renderDetail(); scrollToSelected(); } else renderLife();
  }
  applyWidth();
  renderAll();
  findInput.value = paramsOf().find;

  // 기록(사실 · 의문 문장)은 처음 한 번 받는다 — 줄 목록은 받는 동안 "불러오는 중"
  if (!recordsReady) {
    idx.withRecords().then(() => {
      recordsReady = true;
      if (paramsOf().mode === 'dict') { renderList(); refreshDetail(); } else renderLife();
    }).catch((err) => {
      ui.clear(detailEl);
      detailEl.append(ui.notice(`기록을 받지 못했다: ${err.message}`, 'error'));
    });
  }

  // ═══ 상태 구독 — 바뀐 부분만 ═══
  let prev = paramsOf();
  const off = state.subscribe((s, changed) => {
    if (s.tab !== 'world') return;
    const P = paramsOf(s);
    const before = prev;
    prev = P;
    if (document.activeElement !== findInput && findInput.value !== P.find) findInput.value = P.find;
    if (P.mode !== before.mode) { renderAll(); return; }
    if (P.mode === 'life') {
      if (changed.has('t') || P.find !== before.find || P.topic !== before.topic) { lifeMore.clear(); renderLife(); }
      return;
    }
    const cutChanged = changed.has('t');
    if (cutChanged || P.find !== before.find || P.type !== before.type || P.sort !== before.sort) renderList();
    if (P.item !== before.item) {
      markSelected();
      scrollToSelected();
      renderDetail();
      if (narrow) picker.open = false;
      window.scrollTo({ top: 0 });
      return;
    }
    if (cutChanged) {
      const id = effectiveItem(s);
      const e = id && byId.get(id);
      const wasLocked = !detail;
      const nowLocked = !e || !viewOf(e, cutOf(s)).cutOk;
      if (wasLocked !== nowLocked || (detail && detail.id !== id)) renderDetail();
      else refreshDetail();
    } else if (P.hubs !== before.hubs && detail) {
      detail.parts.get('neighbors')?.part && refreshPart(detail.parts.get('neighbors'));
    }
  });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => applyWidth()) : null;
  ro?.observe(root);
  return () => { off(); ro?.disconnect(); clearTimeout(findTimer); };
}
