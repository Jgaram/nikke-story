/**
 * 탭 6 세계(W7) — 개념 · 사건 · 물건 · 조직 · 장소 사전(화면 4 개념 쪽)과 "세계의 모습"(생활상) 분류별 목록.
 *
 * 쓰는 JSON
 *   world.json(이 탭 — tools/site/export/world.mjs): entries[225](항목 — 메모 · 다른 이름 · 근거 · 집계 · recs{F|Q|U|E|I|D: [[기록 ID, 출시 시점, 범위], …]} ·
 *     units[[단위 키, 기록 수], …] · neighbors[{id, n, recs[[기록 ID, 출시 시점], …]}] · threads[{id, n, about}] · hub) · life[449](세계의 모습 — 문장 · 분류 · 단위 · 근거) ·
 *     topics[{topic, n}] · hubs[](자주 나오는 항목) · hub_share
 *   공용(ctx.idx): units(제목 · 출시 시점 · 범위) · ticks · threads(떡밥 제목 · 중요도) · targets(이름) · records(사실 · 의문 문장 — 처음 보일 때 받는다)
 *
 * URL 파라미터(p.*)
 *   mode   dict(사전, 기본) | life(세계의 모습)
 *   item   사전에서 고른 항목 ID(없으면 니케 — 가림 상태면 목록 첫 항목)
 *   type   사전 종류 거르개 concept | incident | item | org | place (없으면 전체)
 *   sort   사전 정렬 facts(기본, 사실 많은 순) | name | first | open
 *   find   찾기 낱말 — 사전은 이름 · 다른 이름 · 메모, 세계의 모습은 문장 · 항목 · 스토리
 *   topic  세계의 모습 분류 거르개(없으면 분류별 묶음)
 *   hubs   1이면 함께 나온 항목에 자주 나오는 항목도 넣는다
 *
 * 그리는 규칙
 *   - 여기까지 읽음(컷오프 t)과 범위(layers)를 모든 숫자 · 목록에 건다. 항목은 처음 나온 자리(= 기록 · 처음 소개된 스토리 중 가장 이른 출시 시점)가 t 뒤면 목록에서 빠지고
 *     "스포일러로 가림 N — 전부 보기"로 센다. 사실 · 의문 · 세계의 모습 · 함께 나온 항목 · 나온 스토리도 t 뒤 기록은 빼고 같은 식으로 센다.
 *     처음 나온 자리를 알 수 없는 항목은 컷오프가 켜져 있으면 가린다. 줄이 없는 섹션은 접고 머리에 가린 수를 적는다(사용자가 직접 연 · 접은 섹션만 기억).
 *     바뀌면 목록 · 상세를 다시 만들지 않고 숫자와 줄만 갈아 끼운다(스크롤 · 접힘 · 찾기 낱말 유지).
 *   - 열린 의문 = 그 자리에서 열림 또는 일부 회수인 의문(fmt.stateAt). 사실이 나중에 뒤집히면 "뒤집힘" 표시.
 *   - 함께 나온 항목: world.json의 이웃 기록 중 t 이내 · 범위 안만 센 수. 그림은 가운데 항목 + 많이 겹친 상위 10(고리 배치, 선 굵기 = 함께 나온 기록 수).
 *     자주 나오는 항목(니케 · 랩쳐 · 방주 …)은 그림에서 기본으로 빼고 목록에서는 흐리게 — 토글로 넣는다. 480px보다 좁으면 그림 없이 목록만.
 *   - 색은 공용 토큰(--accent · --state-* · --ink-*)만 쓴다. 종류(개념 · 사건 …)는 색 없이 글자 칩으로 — 5색 범주 팔레트를 새로 두지 않는다.
 *   - 사실 · 의문 · 세계의 모습 줄을 누르면 리더(sel=record:ID), 스토리 · 떡밥 링크는 unit: · thread:. 사전 메모의 작업 표기는 내보낼 때 걷는다(export 주석).
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
  sort: { facts: '사실 많은 순', name: '가나다순', first: '나온 순서', open: '열린 의문 순' },
  listAria: '항목 목록',
  count: (n) => `${n}개`,
  pickerHint: '다른 항목 고르기',
  hubTag: '자주 나옴',
  hubTip: '여러 스토리에 걸쳐 자주 나오는 항목',
  stats: { facts: '사실', questions: '의문', open: '열린 의문', units: '나온 스토리', first: '처음 나온 곳' },
  aliases: '다른 이름',
  sec: { facts: '사실', questions: '의문', life: '세계의 모습', neighbors: '함께 나온 항목', units: '나온 스토리' },
  filterIn: '이 안에서 찾기',
  more: (n) => `더 보기 (${n})`,
  empty: { facts: '여기까지 읽은 범위에는 사실이 없다', questions: '여기까지 읽은 범위에는 의문이 없다', life: '이 항목이 어떻게 그려지는지는 아직 없다', threads: '이 항목이 걸린 떡밥이 아직 없다', neighbors: '함께 나온 항목이 아직 없다', units: '나온 스토리가 없다' },
  noMatch: (q) => `‘${q}’에 맞는 줄이 없다`,
  unitCount: (n) => `기록 ${n}`,
  recordsLoading: '기록 불러오는 중…',
  notYet: '아직 나오지 않은 항목이다',
  notYetNote: (when) => `${when}부터 나온다.`,
  noItem: '고를 항목이 없다',
  noItemHint: '찾기 낱말이나 종류를 풀면 보인다.',
  neighborBy: (n) => `함께 나온 기록 ${n}`,
  hubsToggle: '자주 나오는 항목 포함',
  graphAria: '함께 나온 항목 그림',
  lifeEmpty: (when) => `여기까지 읽은 범위에는 세계의 모습이 없다. ${when}부터 나온다.`,
  lifeEmptyAll: '조건에 맞는 문장이 없다',
  raiseTo: (when) => `${when}까지 읽음으로 올리기`,
  clearFilters: '거르개 풀기',
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
  const unitLayer = (k) => idx.units.get(k)?.layer ?? null;
  /** 항목이 처음 나온 출시 시점 — 기록 · 처음 소개된 스토리 중 가장 이른 것. 어디에서도 못 찾으면 null(늘 보임) */
  const tick0 = new Map();
  for (const e of entries) {
    const ts = [e.first_tick, ...Object.values(e.recs ?? {}).flatMap((l) => l.map((x) => x[1])), ...(e.introduced ?? []).map(unitTick)].filter((t) => t != null);
    tick0.set(e.id, ts.length ? Math.min(...ts) : null);
  }
  const typeLabel = (t) => fmt.TARGET_TYPE[t] ?? t;
  const whenLabel = (tick) => fmt.tickLabel(tick, { date: false });
  const nameOf = (id) => byId.get(id)?.name ?? fmt.targetName(id);

  // ── 상태 읽기 ──
  const cutOf = (s = state.get()) => ({ T: s.t, layers: new Set(s.layers) });
  const paramsOf = (s = state.get()) => ({
    mode: s.p.mode === 'life' ? 'life' : 'dict',
    item: s.p.item ?? null,
    type: TYPE_ORDER.includes(s.p.type) ? s.p.type : null,
    sort: ['name', 'first', 'open'].includes(s.p.sort) ? s.p.sort : 'facts',
    find: s.p.find ?? '',
    topic: s.p.topic ?? null,
    hubs: s.p.hubs === '1',
  });
  const setP = (patch, replace = true) => state.set({ p: patch }, { replace });
  let recordsReady = idx.hasRecords;

  /** [[id, tick, layer], …]를 컷오프 · 범위로 가른다 */
  function split(list, c) {
    const shown = [];
    let cutHidden = 0;
    let layerHidden = 0;
    for (const x of list) {
      const okT = state.visible(x[1], c.T);
      const okL = x[2] == null || c.layers.has(x[2]);
      if (okT && okL) shown.push(x);
      else if (!okT) cutHidden++;
      else layerHidden++;
    }
    return { shown, cutHidden, layerHidden };
  }

  // 항목별 숫자 — 컷오프 · 범위 · 기록 로딩이 바뀔 때만 다시 센다
  let viewKey = '';
  let views = new Map();
  function viewOf(e, c) {
    const key = `${c.T}|${[...c.layers].join()}|${recordsReady}`;
    if (key !== viewKey) { viewKey = key; views = new Map(); }
    let v = views.get(e.id);
    if (v) return v;
    const F = split(e.recs.F ?? [], c);
    const Q = split(e.recs.Q ?? [], c);
    const all = Object.values(e.recs).flat();
    const t0 = tick0.get(e.id);
    const cutOk = t0 == null ? c.T == null : state.visible(t0, c.T);
    const layerOk = all.length === 0 || all.some((x) => x[2] == null || c.layers.has(x[2]));
    const open = recordsReady ? Q.shown.filter((x) => ['열림', '일부'].includes(fmt.stateAt(idx.records.get(x[0]), c.T))).length : null;
    v = { e, f: F.shown.length, q: Q.shown.length, open, cutOk, layerOk, shown: cutOk && layerOk };
    views.set(e.id, v);
    return v;
  }

  const byRecord = (a, b) => (a.tick ?? 0) - (b.tick ?? 0) || (a.order ?? 0) - (b.order ?? 0) || String(a.scene).localeCompare(String(b.scene)) || (a.line ?? 0) - (b.line ?? 0);

  // ── 작은 조각 ──
  const dots = (items) => items.filter(Boolean).flatMap((x, i) => (i ? [h('span', { class: 'w-dot', 'aria-hidden': 'true' }, '·'), x] : [x]));
  const hiddenNote = (cutHidden, layerHidden) => {
    if (!cutHidden && !layerHidden) return null;
    return h('div', { class: 'w-hidden' },
      cutHidden ? ui.hiddenNote(fmt.hiddenLabel(cutHidden), () => state.set({ t: null })) : null,
      layerHidden ? ui.hiddenNote(`${fmt.TERM.scope} 밖 ${fmt.num(layerHidden)}`, () => state.set({ layers: state.ALL_LAYERS }), { action: `${fmt.TERM.scope} 넓히기` }) : null);
  };
  const evidenceLinks = (ev, max = 3) => (ev ?? []).slice(0, max).map((x, i) => [i ? ' · ' : null, ui.link(`scene:${x.scene}`, fmt.ref(x.scene, x.lines), { class: 'mono w-ref' })]);
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
    const t = unitTick(j.first_unit);
    return t == null || state.visible(t, c.T);
  };

  /** 기록 한 줄(사실 · 의문 · 세계의 모습) — 누르면 리더 */
  function recRow(r, c, { chips = [], showTopic = false, showAbout = false, about: aboutIds = null } = {}) {
    const u = idx.units.get(r.unit);
    const ev = r.evidence?.[0];
    const li = h('li', { class: 'w-rec', tabindex: 0, dataset: { id: r.id } },
      h('div', { class: 'w-rec-text' }, chips.length ? h('span', { class: 'chips w-rec-chips' }, chips) : null, fmt.recordText(r)),
      h('div', { class: 'w-meta' }, dots([
        showTopic && r.topic ? ui.chip('plain', r.topic, r.topic) : null,
        u ? ui.link(`unit:${r.unit}`, u.title, { class: 'w-unit' }) : null,
        u && u.kind !== 'main' ? h('span', { class: 'muted' }, whenLabel(r.tick)) : null,
        r.confidence === '추정' ? ui.chip('confidence', '추정') : null,
        ev ? ui.link(`scene:${ev.scene}`, fmt.ref(ev.scene, ev.lines?.[0]), { class: 'mono w-ref' }) : null,
        ui.link(`record:${r.id}`, r.id, { class: 'mono w-ref' }),
      ])),
      showAbout && aboutIds?.length ? h('div', { class: 'w-meta w-aboutline' }, aboutIds.map((a) => itemLink(a))) : null);
    const open = () => state.set({ sel: `record:${r.id}` });
    li.addEventListener('click', (ev) => { if (!ev.target.closest('a, button')) open(); });
    li.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === li) { ev.preventDefault(); open(); } });
    return li;
  }

  /**
   * 갱신되는 줄 목록 — 찾기 입력 · 더 보기를 스스로 들고 있어, refresh()는 줄만 다시 그린다.
   * get() → { items, cutHidden, layerHidden } / row(item) → li / text(item) → 찾기 대상 글 / refresh()는 센 수를 돌려준다.
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
      const note = hiddenNote(g.cutHidden, g.layerHidden);
      if (note) foot.append(note);
      if (input) bar.hidden = g.items.length <= size;
      api.hidden = g.cutHidden + g.layerHidden;
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
  const sortSel = h('select', { class: 'w-select', 'aria-label': LABELS.sortAria, onChange: () => setP({ sort: sortSel.value === 'facts' ? null : sortSel.value }) },
    Object.entries(LABELS.sort).map(([v, l]) => h('option', { value: v }, l)));
  const listCount = h('span', { class: 'w-count muted' });
  const listUl = h('ul', { class: 'w-items', role: 'listbox', 'aria-label': LABELS.listAria });
  const listNote = h('div', { class: 'w-list-note' });
  const listBody = h('div', { class: 'w-list-body' }, listUl, listNote);
  const pickerSum = h('summary', { class: 'w-picker-sum' });
  const hiddenSlot = h('div', { class: 'w-list-hidden' });
  const listPanel = h('div', { class: 'w-list-panel' }, h('div', { class: 'w-list-top' }, typeChips, h('div', { class: 'w-list-tools' }, sortSel, listCount), hiddenSlot), listBody);
  const picker = h('details', { class: 'w-picker', open: true }, pickerSum, listPanel);
  picker.addEventListener('toggle', () => { if (picker.open) scrollToSelected(); });
  const listCol = h('aside', { class: 'w-list' }, picker);
  const detailEl = h('section', { class: 'w-detail', 'aria-live': 'polite' });
  dictView.append(listCol, detailEl);
  const lifeBar = h('div', { class: 'w-topics', role: 'group', 'aria-label': LABELS.topicAria });
  const lifeHidden = h('div', { class: 'w-life-hidden' });
  const lifeList = h('div', { class: 'w-life-list' });
  lifeView.append(lifeBar, lifeHidden, lifeList);

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
    const cutHidden = all.filter((v) => !v.cutOk).length;
    const layerHidden = all.filter((v) => v.cutOk && !v.layerOk).length;
    const q = norm(P.find);
    const counts = Object.fromEntries(TYPE_ORDER.map((t) => [t, 0]));
    const matched = visible.filter((v) => !q || norm([v.e.name, v.e.id, v.e.kind, v.e.note, ...(v.e.aliases ?? []).map((a) => a.name)].join(' ')).includes(q));
    for (const v of matched) counts[v.e.type]++;
    ui.clear(typeChips);
    const chip = (value, label, n) => h('button', { type: 'button', class: 'w-chip', 'aria-pressed': String((P.type ?? 'all') === value), onClick: () => setP({ type: value === 'all' ? null : value, item: P.item }) }, label, h('span', { class: 'w-chip-n' }, fmt.num(n)));
    put(typeChips, chip('all', LABELS.all, matched.length), TYPE_ORDER.map((t) => chip(t, typeLabel(t), counts[t])));
    const rows = matched.filter((v) => !P.type || v.e.type === P.type);
    const cmp = {
      facts: (a, b) => b.f - a.f || a.e.name.localeCompare(b.e.name, 'ko'),
      name: (a, b) => a.e.name.localeCompare(b.e.name, 'ko'),
      first: (a, b) => (tick0.get(a.e.id) ?? 0) - (tick0.get(b.e.id) ?? 0) || (a.e.first_order ?? 0) - (b.e.first_order ?? 0) || b.f - a.f,
      open: (a, b) => (b.open ?? 0) - (a.open ?? 0) || b.q - a.q || b.f - a.f,
    }[P.sort];
    rows.sort(cmp);
    sortSel.value = P.sort;
    listCount.textContent = LABELS.count(fmt.num(rows.length));
    const maxF = Math.max(1, ...rows.map((v) => v.f));
    ui.clear(listUl);
    for (const v of rows) {
      const e = v.e;
      listUl.append(h('li', { class: ['w-item', hubs.has(e.id) ? 'is-hub' : ''], role: 'option', tabindex: -1, dataset: { id: e.id }, 'aria-selected': 'false' },
        h('div', { class: 'w-item-main' },
          h('span', { class: 'w-item-name' }, e.name),
          h('span', { class: 'w-item-nums' },
            v.open ? h('span', { class: 'w-open', title: `${LABELS.stats.open} ${v.open}` }, h('i', { 'aria-hidden': 'true' }), v.open) : null,
            h('span', { class: 'w-facts', title: `${LABELS.stats.facts} ${v.f}` }, fmt.num(v.f)))),
        h('div', { class: 'w-item-sub' }, [typeLabel(e.type), e.kind, v.q ? `${LABELS.stats.questions} ${v.q}` : null].filter(Boolean).join(' · ')),
        h('div', { class: 'w-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.max(v.f ? 3 : 0, (v.f / maxF) * 100)}%` } }))));
    }
    ui.clear(listNote);
    if (!rows.length) {
      put(listNote, h('div', { class: 'empty' }, LABELS.noItem, ' ', LABELS.noItemHint),
        P.find || P.type ? h('button', { type: 'button', class: 'btn', onClick: () => setP({ find: null, type: null }) }, LABELS.clearFilters) : null);
      if (P.find) findInput.value = P.find;
    }
    ui.clear(hiddenSlot);
    put(hiddenSlot, hiddenNote(cutHidden, layerHidden));
    markSelected();
  }
  function markSelected() {
    const id = effectiveItem();
    let target = null;
    for (const li of listUl.children) {
      const on = li.dataset.id === id;
      li.setAttribute('aria-selected', String(on));
      li.classList.toggle('is-selected', on);
      li.tabIndex = on ? 0 : -1;
      if (on) target = li;
    }
    if (!target && listUl.firstElementChild) listUl.firstElementChild.tabIndex = 0;
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
    const items = [...listUl.children];
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
  function section(key, title, part, open) {
    const nEl = h('span', { class: 'w-sec-n' });
    const hEl = h('span', { class: 'w-sec-hidden' });
    const sum = h('summary', {}, h('span', { class: 'w-sec-title' }, title), nEl, hEl);
    const sec = h('details', { class: 'w-sec', dataset: { key }, open: secOpen.has(key) ? secOpen.get(key) : open }, sum, h('div', { class: 'w-sec-body' }, part.el));
    let touched = secOpen.has(key);
    sum.addEventListener('click', () => { touched = true; });
    sec.addEventListener('toggle', () => { if (touched) secOpen.set(key, sec.open); });
    return { sec, nEl, hEl, part, open, isTouched: () => touched };
  }
  function refreshPart(p) {
    const n = p.part.refresh();
    p.nEl.textContent = n != null ? fmt.num(n) : '';
    p.hEl.textContent = p.part.hidden ? `· ${fmt.hiddenLabel(p.part.hidden)}` : '';
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
        if (!recordsReady) return { items: [], cutHidden: 0, layerHidden: 0, loading: true };
        const g = split(e.recs.F ?? [], c);
        const items = g.shown.map((x) => idx.records.get(x[0])).filter(Boolean).sort(byRecord);
        return { items, cutHidden: g.cutHidden, layerHidden: g.layerHidden };
      },
      lead: (g) => (g.loading ? ui.spinner(LABELS.recordsLoading) : null),
      row: (r) => recRow(r, cutOf(), { chips: fmt.stateAt(r, state.get().t) === '뒤집힘' ? [ui.chip('state', '뒤집힘')] : [] }),
    });
    parts.set('facts', section('facts', LABELS.sec.facts, facts, true));
    // 의문
    const qRank = { 열림: 0, 일부: 1, 풀림: 2 };
    const questions = reactiveList({
      size: PAGE.questions, empty: LABELS.empty.questions, text: (r) => r.text,
      get() {
        const c = cutOf();
        if (!recordsReady) return { items: [], cutHidden: 0, layerHidden: 0, loading: true };
        const g = split(e.recs.Q ?? [], c);
        const T = c.T;
        const items = g.shown.map((x) => idx.records.get(x[0])).filter(Boolean).map((r) => ({ r, st: fmt.stateAt(r, T) }))
          .sort((a, b) => (qRank[a.st] ?? 3) - (qRank[b.st] ?? 3) || byRecord(a.r, b.r));
        return { items, cutHidden: g.cutHidden, layerHidden: g.layerHidden };
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
        const g = split((e.recs.U ?? []).map((x) => [x[0], x[1], x[2]]), c);
        const items = g.shown.map((x) => lifeById.get(x[0])).filter(Boolean).sort(byRecord);
        return { items, cutHidden: g.cutHidden, layerHidden: g.layerHidden };
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
            if (!state.visible(x[1], c.T) || !(x[2] == null || c.layers.has(x[2]))) continue;
            for (const j of idx.records.get(x[0])?.threads ?? []) count.set(j, (count.get(j) ?? 0) + 1);
          }
        }
        const items = (e.threads ?? []).filter((t) => threadVisible(t.id, c))
          .map((t) => ({ ...t, n: recordsReady ? (count.get(t.id) ?? 0) : t.n, title: idx.threads.get(t.id)?.title ?? t.id, j: idx.threads.get(t.id) }))
          .filter((t) => t.n > 0 || t.about)
          .sort((a, b) => ({ 뼈대: 0, 보강: 1, 독립: 2 }[a.j?.weight] ?? 3) - ({ 뼈대: 0, 보강: 1, 독립: 2 }[b.j?.weight] ?? 3) || b.n - a.n);
        return { items, cutHidden: 0, layerHidden: 0 };
      },
      row: (t) => h('li', { class: 'w-thread-row' },
        ui.link(`thread:${t.id}`, t.title, { class: 'w-thread-title' }),
        h('span', { class: 'w-meta' }, dots([t.j?.weight ? ui.chip('plain', t.j.weight, fmt.THREAD_WEIGHT[t.j.weight]?.label ?? t.j.weight) : null, t.n ? LABELS.unitCount(t.n) : null]))),
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
        const items = [];
        let cutHidden = 0;
        let layerHidden = 0;
        for (const u of all) {
          if (!state.visible(unitTick(u[0]), c.T)) cutHidden++;
          else if (!c.layers.has(unitLayer(u[0]))) layerHidden++;
          else items.push(u);
        }
        return { items, cutHidden, layerHidden };
      },
      row: ([k, n]) => {
        const u = idx.units.get(k);
        return h('li', { class: 'w-unit-row' }, ui.chip('kind', u.kind), ' ', ui.link(`unit:${k}`, u.title), ' ', h('span', { class: 'w-meta muted' }, `${LABELS.unitCount(n)} · ${whenLabel(u.tick)}`));
      },
    });
    parts.set('units', section('units', LABELS.sec.units, units, false));
    return { id, parts, headerEl: h('header', { class: 'w-card' }) };
  }

  function fillHeader(d, e, v, c) {
    const el = d.headerEl;
    ui.clear(el);
    const firstUnit = e.first_unit && idx.units.get(e.first_unit);
    const stat = (label, value, sub) => h('div', { class: 'w-stat' }, h('dt', {}, label), h('dd', {}, value, sub ? h('span', { class: 'w-stat-sub' }, sub) : null));
    put(el,
      h('div', { class: 'w-card-title' }, h('h3', {}, e.name), h('div', { class: 'chips' }, ui.chip('plain', e.type, typeLabel(e.type)), e.kind ? ui.chip('plain', e.kind, e.kind) : null,
        hubs.has(e.id) ? h('span', { title: LABELS.hubTip }, ui.chip('plain', 'hub', LABELS.hubTag)) : null)),
      e.note ? h('p', { class: 'w-note' }, e.note) : null,
      (e.aliases ?? []).length ? h('p', { class: 'w-aliases' }, h('span', { class: 'muted' }, `${LABELS.aliases} `), e.aliases.map((a, i) => [i ? ' · ' : null,
        h('span', { class: a.caution ? 'w-alias has-note' : 'w-alias', title: a.caution ?? undefined }, a.name, a.how ? h('span', { class: 'muted' }, ` (${a.how})`) : null)])) : null,
      e.evidence?.length ? h('p', { class: 'w-evidence' }, h('span', { class: 'muted' }, `${fmt.TERM.evidence} `), evidenceLinks(e.evidence)) : null,
      h('dl', { class: 'w-stats' },
        stat(LABELS.stats.facts, fmt.num(v.f)),
        stat(LABELS.stats.questions, fmt.num(v.q), v.open ? ` · ${LABELS.stats.open} ${v.open}` : null),
        stat(LABELS.stats.units, fmt.num(visibleUnitCount(e, c))),
        firstUnit && state.visible(firstUnit.tick, c.T) ? stat(LABELS.stats.first, ui.link(`unit:${firstUnit.key}`, firstUnit.title), firstUnit.kind === 'main' ? null : ` · ${whenLabel(firstUnit.tick)}`) : null));
  }
  const visibleUnitCount = (e, c) => (e.units ?? []).filter((u) => idx.units.has(u[0]) && state.visible(unitTick(u[0]), c.T) && c.layers.has(unitLayer(u[0]))).length;

  /** 함께 나온 항목 — 그림(고리 배치) + 순위 목록 */
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
      const layerOfRec = new Map(Object.values(e.recs).flat().map((x) => [x[0], x[2]]));
      const out = [];
      for (const nb of e.neighbors ?? []) {
        const other = byId.get(nb.id);
        if (!other || !viewOf(other, c).shown) continue;
        const n = nb.recs.filter(([rid, tick]) => state.visible(tick, c.T) && (layerOfRec.get(rid) == null || c.layers.has(layerOfRec.get(rid)))).length;
        if (n) out.push({ id: nb.id, e: other, n, hub: hubs.has(nb.id) });
      }
      return out.sort((a, b) => b.n - a.n || a.e.name.localeCompare(b.e.name, 'ko'));
    }
    function refresh() {
      const c = cutOf();
      const P = paramsOf();
      hubToggle.set(P.hubs);
      const items = neighborsAt(c);
      const maxN = Math.max(1, ...items.map((x) => x.n));
      ui.clear(figure);
      ui.clear(list);
      ui.clear(foot);
      const drawable = items.filter((x) => P.hubs || !x.hub).slice(0, GRAPH.max);
      if (drawable.length && detailEl.clientWidth >= GRAPH.minWidth) figure.append(drawGraph(e, drawable, maxN));
      for (const it of items.slice(0, limit)) {
        list.append(h('li', { class: ['w-nb-row', it.hub ? 'is-hub' : ''], tabindex: 0, dataset: { id: it.id }, onClick: () => gotoItem(it.id), onKeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); gotoItem(it.id); } } },
          h('span', { class: 'w-nb-name' }, it.e.name, it.hub ? h('span', { class: 'muted w-hubtag' }, ` · ${LABELS.hubTag}`) : null),
          h('span', { class: 'w-nb-type muted' }, typeLabel(it.e.type)),
          h('span', { class: 'w-bar w-nb-bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${(it.n / maxN) * 100}%` } })),
          h('span', { class: 'w-nb-n', title: LABELS.neighborBy(it.n) }, fmt.num(it.n))));
      }
      tools.hidden = !items.length;
      if (!items.length) foot.append(h('div', { class: 'empty' }, LABELS.empty.neighbors));
      if (items.length > limit) foot.append(h('button', { type: 'button', class: 'btn', onClick: () => { limit += PAGE.more; refresh(); } }, LABELS.more(items.length - limit)));
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
      const g = mk('g', { class: it.hub ? 'w-node is-hub' : 'w-node', tabindex: 0, role: 'button', 'aria-label': `${it.e.name} — ${LABELS.neighborBy(it.n)}` });
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
      const lx = anchor === 'start' ? x + 11 : anchor === 'end' ? x - 11 : x;
      const ly = anchor === 'middle' ? (sin < 0 ? y - 12 : y + 20) : y + 4;
      g.append(mk('circle', { cx: x, cy: y, r: 16, class: 'w-hit' }), mk('circle', { cx: x, cy: y, r: 5.5, class: 'w-dot-node' }), mk('text', { x: lx, y: ly, 'text-anchor': anchor, class: 'w-node-label' }, clip(it.e.name, 12)));
      ui.tooltip(g, () => h('div', {}, h('b', {}, it.e.name), h('div', {}, `${typeLabel(it.e.type)}${it.e.kind ? ` · ${it.e.kind}` : ''}`), h('div', {}, LABELS.neighborBy(it.n))));
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
      detailEl.append(h('div', { class: 'w-locked' }, h('h3', {}, LABELS.notYet), t0 != null ? h('p', { class: 'muted' }, LABELS.notYetNote(whenLabel(t0))) : null,
        h('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: null }) }, fmt.TERM.showAll)));
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
    const g = split(world.life.map((l) => [l.id, l.tick, l.layer]), c);
    const pool = g.shown.map((x) => lifeById.get(x[0]));
    const text = (l) => norm([l.text, l.topic, idx.units.get(l.unit)?.title, ...(l.about ?? []).map(nameOf)].join(' '));
    const matched = q ? pool.filter((l) => text(l).includes(q)) : pool;
    const counts = new Map();
    for (const l of matched) counts.set(l.topic, (counts.get(l.topic) ?? 0) + 1);
    ui.clear(lifeBar);
    const chip = (value, label, n) => h('button', { type: 'button', class: 'w-chip', 'aria-pressed': String((P.topic ?? 'all') === value), onClick: () => setP({ topic: value === 'all' ? null : value }) }, label, h('span', { class: 'w-chip-n' }, fmt.num(n)));
    put(lifeBar, chip('all', LABELS.all, matched.length), world.topics.map((t) => chip(t.topic, t.topic, counts.get(t.topic) ?? 0)));
    ui.clear(lifeList);
    ui.clear(lifeHidden);
    put(lifeHidden, hiddenNote(g.cutHidden, g.layerHidden));
    const moreBtn = (key, left, step) => h('button', { type: 'button', class: 'btn', onClick: () => { lifeMore.set(key, (lifeMore.get(key) ?? step) + PAGE.more); renderLife(); } }, LABELS.more(left));
    if (!matched.length) {
      const next = world.life.filter((l) => !state.visible(l.tick, c.T) && c.layers.has(l.layer)).reduce((m, l) => Math.min(m, l.tick), Infinity);
      const hiddenByCut = !pool.length && Number.isFinite(next);
      lifeList.append(h('div', { class: 'w-empty' },
        h('p', { class: 'muted' }, hiddenByCut ? LABELS.lifeEmpty(whenLabel(next)) : LABELS.lifeEmptyAll),
        hiddenByCut ? h('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: next }) }, LABELS.raiseTo(fmt.tickShort(next))) : null,
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
          h('h3', {}, h('button', { type: 'button', class: 'w-linkbtn', onClick: () => setP({ topic: t.topic }) }, t.topic), h('span', { class: 'w-sec-n' }, fmt.num(rows.length))),
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
      if (changed.has('t') || changed.has('layers') || P.find !== before.find || P.topic !== before.topic) { lifeMore.clear(); renderLife(); }
      return;
    }
    const cutChanged = changed.has('t') || changed.has('layers');
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
