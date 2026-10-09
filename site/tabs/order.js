/**
 * 탭 1 읽기 순서(W2) — 화면 1 "스토리 중요도 분류"(docs/views.md 1절, 판정 카드 docs/importance.md).
 * 첫 쓸모: "CH.N까지 읽었으면 다음에 뭘 읽나" — 컷오프 T에서 그 자리의 등급(필수 → 보강 → 참고 → 독립)으로 묶은 메인 밖 단위 목록.
 *
 * 쓰는 JSON
 *   order.json(이 탭 — tools/site/export/order.mjs): units[421](판정 단위 — 등급 · 자리 · from · before · basis · reason · 이력 · 줄기 · 주역) · spine[60](척추 자리) ·
 *                                                  leads[20](주역 명단) · review_notes[] · counts
 *   공용(idx): units.json(종류 · 제목 · 글자 수 · 층) · ticks.json(공개 자리 라벨)
 *
 * URL 파라미터(p.*)
 *   mode   list(목록, 기본) | map(지도)
 *   kind   종류 거르개(event · episode · sub · relic · side · erelic · elevator), 없으면 전체
 *   find   제목 · 키 · 이유 안 낱말 검색
 *   rows   지도의 행: grade(등급별, 기본) | kind(종류별)
 *   leads  1이면 주역 명단을 펼친다
 *
 * 그리는 규칙
 *   그 자리의 등급 gradeAt(u, T) — tools/views/importance.mjs와 같다: T가 없으면(전부 보기) 최종 등급, T < 공개 자리면 아직 없음(숨김),
 *     from 자리가 있고 T < from 자리면 그 앞 등급(before), 그 밖은 최종 등급. 내려가는 자리는 없다.
 *   컷오프 뒤 단위(tick > T) · 층 거르개 밖 단위는 숨기고 개수만 보인다("컷오프로 숨김 N").
 *   목록: 등급별 묶음 표(그 자리의 등급) — 자리 · 종류 · 제목 · 등급(뒤에 오르면 "→ CH.27부터 보강") · 근거(결정 근거 기록 → 씬#줄 + 이유 한 줄) · 글자 · 층.
 *   지도: 척추 60자리(메인 49 + 척추 이벤트 8 · 사이드 3)를 가로축으로, 판정 단위를 그 단위가 나온 자리(그 자리 ≤ 공개 자리인 마지막 척추 칸)에 점으로.
 *     행은 등급 또는 종류, 한 칸 안에서는 두 줄로 쌓는다. 점 색 = 그 자리의 등급(파랑 램프), 점 크기는 같다(60칸 × 22px에서 가변 크기는 잡음이 된다 — 글자 수는 툴팁 · 목록).
 *     뒤에 등급이 오르는 점은 최종 등급 색 테두리. 척추 단위는 축에 표시만(채점하지 않는다 — 색 없음). 축 라벨을 누르면 그 자리를 컷오프로 둔다.
 *   단위를 누르면 sel=unit:키 → 리더 패널 + 이 탭의 판정 카드(등급 · 자리별 경로 · 결정 근거 → 씬#줄 · 이유 · 줄기 · 주역 · 마무리 · 판정 이력).
 *   색은 등급 램프(--grade-*)만 — 종류는 칩 · 행 라벨로 (종류 색과 등급 색을 한 차트에 같이 쓰지 않는다).
 */
export const meta = { id: 'order', title: '읽기 순서', blurb: '척추(메인 챕터 + 척추 이벤트 · 사이드)를 가로축으로, 메인 밖 단위를 그 자리에 등급 색으로. "CH.N까지 읽었으면 다음에 뭘 읽나"' };

const GRADES = ['필수', '보강', '참고', '독립'];
/** 등급 뜻 한 줄(docs/importance.md 2절) */
const GRADE_MEANING = {
  필수: '안 보면 척추의 장면 · 인물을 따라갈 수 없다',
  보강: '따라가지만 "뭐 있나 보다"로 넘긴 빈틈이 남는다',
  참고: '빈틈은 없지만 세계나 척추 인물을 더 알게 된다',
  독립: '그 단위 안에서 끝나는 일상극',
};
const DOT_R = 4; // 점 반지름(지름 8px — dataviz 최소)
const DOT_STEP = 9; // 쌓는 간격
const MIN_COL = 22; // 척추 한 칸의 최소 너비(두 줄 쌓기)

/** 공개 자리 T에서의 등급(tools/views/importance.mjs gradeAt) — null이면 아직 안 나왔다 */
export function gradeAt(u, T) {
  if (T == null) return u.grade;
  if (T < u.tick) return null;
  if (u.from_tick && T < u.from_tick) return u.before ?? u.grade;
  return u.grade;
}

const clip = (s, n) => (typeof s === 'string' && [...s].length > n ? `${[...s].slice(0, n).join('')}…` : s ?? '');

export async function mount(root, ctx) {
  const { state, data, fmt, ui, d3, idx } = ctx;
  const order = await data.load('order');
  const judged = order.units.map((j) => ({ ...j, unit: idx.units.get(j.key) })).filter((j) => j.unit);
  const judgedByKey = new Map(judged.map((j) => [j.key, j]));
  const spine = order.spine.map((s) => ({ ...s, unit: idx.units.get(s.key) })).filter((s) => s.unit);
  const spineByKey = new Map(spine.map((s) => [s.key, s]));
  const spineTicks = spine.map((s) => s.tick);
  /** 공개 자리 → 척추 칸(그 자리 ≤ 공개 자리인 마지막 척추 단위) */
  const colOf = (tick) => {
    let lo = 0; let hi = spineTicks.length - 1; let ans = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (spineTicks[mid] <= tick) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };
  const kindsPresent = fmt.KIND_ORDER.filter((k) => judged.some((j) => j.unit.kind === k));
  const unitLabel = (key) => fmt.unitTitle(key);
  const spineLabel = (key) => (spineByKey.get(key)?.unit.kind === 'main' ? fmt.tickShort(spineByKey.get(key).tick) : unitLabel(key));

  // ── 머리 · 도구 줄 ──
  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb)));
  const guide = ui.el('p', { class: 'order-guide', role: 'status', 'aria-live': 'polite' });
  const hiddenNote = ui.el('span', { class: 'order-hidden' });
  const modeSeg = ui.segmented({ label: '보기', options: [{ value: 'list', label: '목록' }, { value: 'map', label: '지도' }], value: state.param('order', 'mode') ?? 'list', onChange: (v) => state.setParam('order', 'mode', v === 'list' ? null : v) });
  const kindSeg = ui.segmented({ label: '종류', options: [{ value: 'all', label: '전체' }, ...kindsPresent.map((k) => ({ value: k, label: fmt.KIND[k].label }))], value: state.param('order', 'kind') ?? 'all', onChange: (v) => state.setParam('order', 'kind', v === 'all' ? null : v) });
  const find = ui.el('input', { type: 'search', class: 'order-find', placeholder: '제목 · 이유 찾기', 'aria-label': '단위 찾기', value: state.param('order', 'find') ?? '' });
  let findTimer = null;
  find.addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => state.setParam('order', 'find', find.value.trim() || null), 200); });
  root.append(ui.el('div', { class: 'toolbar order-toolbar' }, modeSeg.el, kindSeg.el, find, hiddenNote));
  root.append(guide);
  root.append(ui.el('div', { class: 'toolbar order-legend' },
    ui.el('span', { class: 'ctl-name' }, '등급(그 자리)'), ui.legend(GRADES.map((g) => ({ label: g, color: fmt.GRADE[g].color }))),
    ui.el('span', { class: 'ctl-name' }, '척추'), ui.el('span', { class: 'legend' }, ui.el('span', { class: 'legend-item' }, ui.el('i', { class: 'order-mark order-mark-main', 'aria-hidden': 'true' }), '메인 챕터'), ui.el('span', { class: 'legend-item' }, ui.el('i', { class: 'order-mark order-mark-event', 'aria-hidden': 'true' }), '척추 이벤트'), ui.el('span', { class: 'legend-item' }, ui.el('i', { class: 'order-mark order-mark-side', 'aria-hidden': 'true' }), '척추 사이드')),
    ui.el('span', { class: 'legend-note' }, '척추는 채점하지 않는다 · 점 테두리 = 뒤에 오를 등급')));

  // ── 판정 카드(선택한 단위) ──
  const card = ui.el('section', { class: 'order-card panel', 'aria-label': '선택한 단위의 판정' });
  card.hidden = true;
  root.append(card);

  // ── 목록 ──
  const listView = ui.el('div', { class: 'order-list' });
  const gradeCol = (T) => ({
    key: 'grade', label: '등급', sort: (a, b) => (fmt.GRADE[gradeAt(a, T)]?.rank ?? 9) - (fmt.GRADE[gradeAt(b, T)]?.rank ?? 9) || a.tick - b.tick,
    render: (j) => {
      const g = gradeAt(j, T);
      const out = [ui.chip('grade', g)];
      if (j.from_tick && (T == null || T >= j.from_tick)) out.push(' ', ui.el('span', { class: 'order-rise muted', title: `${spineLabel(j.from)} 앞에서는 ${j.before ?? j.grade}` }, `${spineLabel(j.from)}부터`));
      else if (j.from_tick && T < j.from_tick) out.push(' ', ui.el('span', { class: 'order-rise', title: `${spineLabel(j.from)}가 이 단위를 딛기 시작하면 ${j.grade}` }, '→ ', ui.link(`unit:${j.from}`, spineLabel(j.from)), `부터 ${j.grade}`));
      return out;
    },
  });
  const basisLink = (j) => (!j.basis ? null : /^J\d/.test(j.basis) ? ui.link(`thread:${j.basis}`, j.basis) : ui.link(`record:${j.basis}`, j.basis));
  const columns = (T) => [
    { key: 'tick', label: '자리', num: true, width: '5em', render: (j) => ui.el('span', { title: fmt.tickLabel(j.tick) }, fmt.tickShort(j.tick)) },
    { key: 'kind', label: '종류', render: (j) => ui.chip('kind', j.unit.kind), sort: (a, b) => fmt.KIND_ORDER.indexOf(a.unit.kind) - fmt.KIND_ORDER.indexOf(b.unit.kind) },
    { key: 'title', label: '제목', render: (j) => ui.link(`unit:${j.key}`, j.unit.title), sort: (a, b) => a.unit.title.localeCompare(b.unit.title, 'ko') },
    gradeCol(T),
    { key: 'basis', label: '근거 — 결정 근거 기록 · 이유', sortable: false, render: (j) => ui.el('span', { class: 'order-basis', title: j.reason ?? '' },
      basisLink(j), j.basis_scene ? [' ', ui.el('span', { class: 'mono muted' }, fmt.ref(j.basis_scene, j.basis_line))] : null,
      j.reason ? [j.basis ? ' — ' : '', clip(j.reason, 90)] : (j.basis ? '' : ui.el('span', { class: 'muted' }, '근거 없음 — 등장 · 성격 · 일화만'))) },
    { key: 'chars', label: '글자', num: true, render: (j) => fmt.num(j.unit.chars), sort: (a, b) => (a.unit.chars ?? 0) - (b.unit.chars ?? 0) },
    { key: 'layer', label: '층', num: true, render: (j) => (j.unit.layer ? ui.chip('layer', j.unit.layer) : ''), sort: (a, b) => (a.unit.layer ?? 9) - (b.unit.layer ?? 9) },
  ];
  const groups = new Map();
  for (const g of GRADES) {
    const head = ui.el('h3', { class: 'order-group-head' });
    const tbl = ui.table({ rowKey: 'key', pageSize: 40, onRow: (j) => state.set({ sel: `unit:${j.key}` }), columns: columns(state.get().t), empty: '없음' });
    const sec = ui.el('section', { class: 'order-group', 'data-grade': g }, head, ui.el('p', { class: 'order-group-meaning muted' }, GRADE_MEANING[g]), tbl.el);
    groups.set(g, { sec, head, tbl });
    listView.append(sec);
  }
  const listEmpty = ui.el('div', { class: 'order-empty' });
  listEmpty.hidden = true;
  listView.append(listEmpty);
  root.append(listView);

  // ── 지도 ──
  const mapView = ui.el('div', { class: 'order-mapview' });
  mapView.hidden = true;
  const rowsSeg = ui.segmented({ label: '행', options: [{ value: 'grade', label: '등급별 행' }, { value: 'kind', label: '종류별 행' }], value: state.param('order', 'rows') ?? 'grade', onChange: (v) => state.setParam('order', 'rows', v === 'grade' ? null : v) });
  const mapNote = ui.el('span', { class: 'muted' }, '점 = 메인 밖 단위(그 단위가 나온 척추 자리) · 누르면 판정 · 축 라벨을 누르면 그 자리까지 읽은 것으로 둔다');
  mapView.append(ui.el('div', { class: 'toolbar' }, rowsSeg.el, mapNote));
  const mapScroll = ui.el('div', { class: 'order-map' });
  mapView.append(mapScroll);
  root.append(mapView);
  if (!d3) mapScroll.append(ui.notice('d3(CDN)를 불러오지 못해 지도를 그릴 수 없다 — 목록 보기는 된다.', 'warn'));

  // ── 주역 명단(접이식 곁 패널) ──
  const leadsTbl = ui.table({
    rowKey: 'id', pageSize: 0, onRow: (l) => state.set({ sel: `person:${l.person}` }),
    columns: [
      { key: 'person', label: '인물', render: (l) => ui.link(`person:${l.person}`, fmt.targetName(l.person)), sort: (a, b) => fmt.targetName(a.person).localeCompare(fmt.targetName(b.person), 'ko') },
      { key: 'from_tick', label: '주역이 되는 자리', num: true, render: (l) => [ui.link(`unit:${l.from}`, spineLabel(l.from)), l.from_tick != null ? ui.el('span', { class: 'muted' }, ` (${fmt.tickShort(l.from_tick)})`) : null] },
      { key: 'origin', label: '원점(필수)', sortable: false, render: (l) => (l.origin === '메인' ? ui.el('span', { class: 'muted' }, '메인 안') : l.origin ? ui.link(`unit:${l.origin}`, unitLabel(l.origin)) : ui.el('span', { class: 'muted' }, '아직')) },
      { key: 'arcs', label: '구간', sortable: false, render: (l) => (l.arcs ?? []).map((a) => a.split('-').map(spineLabel).join('–')).join(' · ') },
      { key: 'records', label: '근거', sortable: false, render: (l) => (l.records ?? []).map((r, i) => [i ? ' ' : null, /^J\d/.test(r) ? ui.link(`thread:${r}`, r) : ui.link(`record:${r}`, r)]) },
      { key: 'confidence', label: '확신', render: (l) => ui.chip('confidence', l.confidence) },
    ],
    empty: '컷오프 안에 주역이 되는 인물이 없다',
  });
  const leadsHidden = ui.el('p', { class: 'muted order-leads-note' });
  const leadsBox = ui.details(`주역 명단 ${order.leads.length} — 줄기의 주인 + 카운터스 · 지휘관`, [ui.el('p', { class: 'muted' }, '주역마다 원점(정체 · 동기의 원점 사건이 처음 · 가장 온전히 나오는 메인 밖 단위) 하나가 필수다(판정 카드 3절 2). 행을 누르면 인물 패널.'), leadsHidden, leadsTbl.el], { open: state.param('order', 'leads') === '1', class: 'order-leads' });
  leadsBox.addEventListener('toggle', () => state.setParam('order', 'leads', leadsBox.open ? '1' : null));
  root.append(leadsBox);

  // ── 거르기 ──
  const match = (j, s) => {
    const kind = s.p.kind ?? 'all';
    if (kind !== 'all' && j.unit.kind !== kind) return false;
    const q = (s.p.find ?? '').toLowerCase();
    if (q && !`${j.unit.title} ${j.key} ${j.reason ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  };
  let current = { rows: [], T: null };
  const apply = (s) => {
    const T = s.t;
    const inCut = judged.filter((j) => state.visible(j.tick, T));
    const inLayer = inCut.filter((j) => j.unit.layer == null || s.layers.includes(j.unit.layer));
    const rows = inLayer.filter((j) => match(j, s));
    current = { rows, T };
    const hiddenCut = judged.length - inCut.length;
    const hiddenLayer = inCut.length - inLayer.length;
    const hiddenFilter = inLayer.length - rows.length;
    const parts = [`컷오프로 숨김 ${fmt.num(hiddenCut)}`];
    if (hiddenLayer) parts.push(`층 거르개 ${fmt.num(hiddenLayer)}`);
    if (hiddenFilter) parts.push(`거르개 ${fmt.num(hiddenFilter)}`);
    hiddenNote.textContent = `${fmt.num(rows.length)} / ${fmt.num(judged.length)}단위 (${parts.join(' · ')})`;
    const counts = Object.fromEntries(GRADES.map((g) => [g, rows.filter((j) => gradeAt(j, T) === g).length]));
    const upto = T == null ? null : fmt.tickShort(T);
    guide.textContent = T == null
      ? `전부 보기 — 최종 등급으로 묶었다: 필수 ${counts.필수} · 보강 ${counts.보강} · 참고 ${counts.참고} · 독립 ${counts.독립}. 컷오프를 두면 그 자리의 등급으로 바뀐다(메인이 아직 딛지 않은 단위는 그 앞 등급).`
      : `${upto}까지 읽었으면 — 지금 읽을 만한 메인 밖 단위: 필수 ${counts.필수} · 보강 ${counts.보강} · 참고 ${counts.참고} · 독립 ${counts.독립}. 등급은 ${upto} 자리의 것 — 뒤에 오를 단위는 "→ …부터"로 표시.`;
    // 목록
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    let any = 0;
    for (const [g, { sec, head, tbl }] of groups) {
      const list = rows.filter((j) => gradeAt(j, T) === g).sort((a, b) => a.tick - b.tick || a.unit.order - b.unit.order);
      head.textContent = `${g} ${fmt.num(list.length)}`;
      sec.hidden = list.length === 0;
      any += list.length;
      tbl.update(list);
      tbl.setSelected(selKey);
    }
    listEmpty.hidden = any > 0;
    if (!any) {
      ui.clear(listEmpty);
      listEmpty.append(ui.notice(hiddenCut === judged.length ? `${upto ?? ''} 자리까지는 메인 밖 단위가 아직 없다 — 컷오프를 올리면 나온다.` : '거르개 · 층에 맞는 단위가 없다 — 종류를 전체로, 찾기를 비우거나, 층을 모두 켠다.', 'info'));
    }
    // 주역 명단
    const leadRows = order.leads.filter((l) => state.visible(l.from_tick, T)).sort((a, b) => (a.from_tick ?? 0) - (b.from_tick ?? 0));
    leadsTbl.update(leadRows);
    leadsHidden.textContent = leadRows.length < order.leads.length ? `컷오프로 숨김 ${order.leads.length - leadRows.length}(그 뒤에 주역이 되는 인물)` : '';
    // 모드 · 지도
    const mode = s.p.mode ?? 'list';
    modeSeg.set(mode);
    kindSeg.set(s.p.kind ?? 'all');
    rowsSeg.set(s.p.rows ?? 'grade');
    if (find.value !== (s.p.find ?? '') && document.activeElement !== find) find.value = s.p.find ?? '';
    listView.hidden = mode !== 'list';
    mapView.hidden = mode !== 'map';
    if (mode === 'map') drawMap(s);
  };

  // ── 지도 그리기 ──
  let mapWidth = 0;
  const drawMap = (s) => {
    if (!d3) return;
    const { rows, T } = current;
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    const byRows = s.p.rows ?? 'grade';
    const lanes = byRows === 'kind' ? kindsPresent.map((k) => ({ id: k, label: fmt.KIND[k].label })) : GRADES.map((g) => ({ id: g, label: g }));
    const laneOf = (j) => (byRows === 'kind' ? j.unit.kind : gradeAt(j, T));
    // 칸 · 레인 치수
    const marginL = 64; const marginR = 12; const marginT = 10; const marginB = 92;
    const avail = Math.max(320, (mapScroll.clientWidth || root.clientWidth || 900) - marginL - marginR);
    const colW = Math.max(MIN_COL, Math.floor(avail / spine.length));
    const width = marginL + colW * spine.length + marginR;
    mapWidth = width;
    const stacks = new Map(); // lane → col → items
    for (const lane of lanes) stacks.set(lane.id, new Map());
    for (const j of rows) {
      const lane = laneOf(j);
      if (!stacks.has(lane)) continue;
      const col = colOf(j.tick);
      const m = stacks.get(lane);
      (m.get(col) ?? m.set(col, []).get(col)).push(j);
    }
    const laneGeom = [];
    let y = marginT;
    for (const lane of lanes) {
      const m = stacks.get(lane.id);
      let maxRows = 0; let count = 0;
      for (const items of m.values()) { items.sort((a, b) => a.tick - b.tick || a.unit.order - b.unit.order); maxRows = Math.max(maxRows, Math.ceil(items.length / 2)); count += items.length; }
      const h = Math.max(28, maxRows * DOT_STEP + 12);
      laneGeom.push({ ...lane, y0: y, h, count });
      y += h;
    }
    const axisY = y;
    const height = axisY + marginB;
    const colX = (i) => marginL + i * colW;
    const cutCol = T == null ? spine.length - 1 : colOf(T);

    ui.clear(mapScroll);
    const svg = d3.create('svg').attr('class', 'order-svg').attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`).attr('role', 'img')
      .attr('aria-label', `척추 ${spine.length}자리 가로축에 메인 밖 단위 ${rows.length}개를 등급 색 점으로 단 지도`);
    // 컷오프 뒤 칸 바탕
    if (cutCol < spine.length - 1) {
      svg.append('rect').attr('class', 'order-after').attr('x', colX(cutCol + 1)).attr('y', marginT).attr('width', colX(spine.length) - colX(cutCol + 1)).attr('height', axisY - marginT);
      svg.append('line').attr('class', 'order-cutline').attr('x1', colX(cutCol + 1)).attr('x2', colX(cutCol + 1)).attr('y1', marginT - 4).attr('y2', axisY + 6);
      svg.append('text').attr('class', 'order-cuttext').attr('x', colX(cutCol + 1) + 4).attr('y', marginT + 11).text('컷오프 뒤');
    }
    // 레인
    for (const [i, lane] of laneGeom.entries()) {
      svg.append('line').attr('class', 'order-lane-line').attr('x1', marginL).attr('x2', width - marginR).attr('y1', lane.y0 + lane.h).attr('y2', lane.y0 + lane.h);
      const lab = svg.append('text').attr('class', 'order-lane-label').attr('x', marginL - 8).attr('y', lane.y0 + lane.h - 6).attr('text-anchor', 'end');
      lab.append('tspan').text(lane.label);
      lab.append('tspan').attr('class', 'order-lane-count').attr('dx', 3).text(lane.count);
      if (byRows === 'grade') lab.append('title').text(GRADE_MEANING[lane.id]);
      if (i % 2) svg.append('rect').attr('class', 'order-lane-band').attr('x', marginL).attr('y', lane.y0).attr('width', width - marginL - marginR).attr('height', lane.h).lower();
    }
    // 축
    svg.append('line').attr('class', 'order-axis').attr('x1', marginL).attr('x2', width - marginR).attr('y1', axisY).attr('y2', axisY);
    const axis = svg.append('g').attr('class', 'order-axis-labels');
    for (const [i, sp] of spine.entries()) {
      const cx = colX(i) + colW / 2;
      const g = axis.append('g').attr('class', `order-col ${i > cutCol ? 'is-after' : ''} ${sp.unit.kind === 'main' ? 'is-main' : sp.unit.kind === 'side' ? 'is-side' : 'is-event'}`).attr('transform', `translate(${cx},${axisY})`)
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${sp.unit.title} — 여기까지 읽은 것으로 둔다(${fmt.tickLabel(sp.tick)})`);
      if (sp.unit.kind === 'main') g.append('line').attr('class', 'order-tick').attr('y1', 0).attr('y2', 6);
      else if (sp.unit.kind === 'side') g.append('rect').attr('class', 'order-glyph').attr('x', -3.5).attr('y', 1).attr('width', 7).attr('height', 7);
      else g.append('rect').attr('class', 'order-glyph').attr('x', -3.5).attr('y', 1).attr('width', 7).attr('height', 7).attr('transform', 'translate(0,4.5) rotate(45)');
      g.append('text').attr('class', 'order-col-label').attr('transform', 'translate(-2,12) rotate(-62)').attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .text(sp.unit.kind === 'main' ? fmt.tickShort(sp.tick) : clip(sp.unit.title, 12));
      g.append('rect').attr('class', 'order-col-hit').attr('x', -colW / 2).attr('y', 0).attr('width', colW).attr('height', marginB - 4);
      g.append('title').text(`${sp.unit.title} · ${fmt.tickLabel(sp.tick)} — 누르면 여기까지 읽은 것으로`);
      const go = () => state.set({ t: sp.tick });
      g.on('click', go).on('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
    // 점
    const dots = svg.append('g').attr('class', 'order-dots');
    const two = colW >= MIN_COL;
    for (const lane of laneGeom) {
      const m = stacks.get(lane.id);
      for (const [col, items] of m) {
        for (const [k, j] of items.entries()) {
          const sub = two ? k % 2 : 0;
          const row = two ? Math.floor(k / 2) : k;
          const cx = colX(col) + colW / 2 + (two ? (sub ? DOT_R + 1 : -(DOT_R + 1)) : 0);
          const cy = lane.y0 + lane.h - 6 - DOT_R - row * DOT_STEP;
          const g = gradeAt(j, T);
          const rises = j.from_tick && T != null && T < j.from_tick;
          const c = dots.append('circle').attr('class', `order-dot ${rises ? 'is-rise' : ''} ${j.key === selKey ? 'is-selected' : ''}`).attr('cx', cx).attr('cy', cy).attr('r', DOT_R)
            .attr('data-key', j.key).attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${j.unit.title} · ${fmt.KIND[j.unit.kind].label} · ${g}`)
            .style('fill', fmt.GRADE[g]?.color ?? 'var(--grade-none)');
          if (rises) c.style('stroke', fmt.GRADE[j.grade]?.color ?? 'var(--grade-none)');
          const node = c.node();
          ui.tooltip(node, () => tooltipBody(j, T));
          const go = () => state.set({ sel: `unit:${j.key}` });
          node.addEventListener('click', go);
          node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        }
      }
    }
    mapScroll.append(svg.node());
  };
  const tooltipBody = (j, T) => {
    const g = gradeAt(j, T);
    const rises = j.from_tick && T != null && T < j.from_tick;
    return ui.el('div', { class: 'order-tip' },
      ui.el('div', { class: 'order-tip-title' }, j.unit.title),
      ui.el('div', {}, `${fmt.KIND[j.unit.kind].label} · ${fmt.tickLabel(j.tick)} · ${fmt.num(j.unit.chars)}자`),
      ui.el('div', {}, `등급 ${g}${rises ? ` → ${spineLabel(j.from)}부터 ${j.grade}` : j.from_tick ? ` (${spineLabel(j.from)}부터)` : ''}`),
      j.basis ? ui.el('div', { class: 'order-tip-basis' }, `${j.basis}${j.basis_scene ? ` ${fmt.ref(j.basis_scene, j.basis_line)}` : ''} — ${clip(j.reason, 110)}`) : ui.el('div', { class: 'order-tip-basis' }, clip(j.reason ?? '근거 없음', 110)));
  };

  // ── 판정 카드 ──
  const kv = (rows) => ui.el('dl', { class: 'order-kv' }, rows.filter(Boolean).flatMap(([k, v]) => [ui.el('dt', {}, k), ui.el('dd', {}, v)]));
  const recordLinks = (text) => {
    // 'O9(관계 · 지휘관 · 확정) · O12(…)' · 'J2 D18' 같은 문자열 속 기록 ID를 링크로
    const parts = String(text ?? '').split(/([A-Z]-?[a-z]?\d+(?:-\d+)?|\bJ\d+\b)/);
    return parts.map((p) => (/^J\d+$/.test(p) ? ui.link(`thread:${p}`, p) : /^[A-Z]\d/.test(p) ? ui.link(`record:${p}`, p) : p));
  };
  const renderCard = (s) => {
    const sel = state.parseSel(s.sel);
    const key = sel?.type === 'unit' ? sel.id : null;
    const j = key ? judgedByKey.get(key) : null;
    const sp = key && !j ? spineByKey.get(key) : null;
    ui.clear(card);
    if (!j && !sp) { card.hidden = true; return; }
    card.hidden = false;
    const close = ui.el('button', { type: 'button', class: 'btn order-card-close', 'aria-label': '판정 카드 닫기', onClick: () => state.set({ sel: '' }) }, '닫기');
    if (sp) {
      card.append(ui.el('div', { class: 'panel-head' }, ui.el('h3', {}, ui.chip('kind', sp.unit.kind), ' ', ui.link(`unit:${sp.key}`, sp.unit.title)), close),
        kv([['등급', [ui.chip('grade', sp.unit.kind === 'main' ? '메인' : '척추'), ' ', ui.el('span', { class: 'muted' }, '척추는 채점하지 않는다 — 다른 단위의 등급은 "이 단위를 안 보고 척추를 읽으면 어떤가"로 정한다')]],
          ['공개 자리', [fmt.tickLabel(sp.tick), ' · ', ui.link(`tick:${sp.tick}`, '그 자리의 단위')]],
          ['여기 딛는 단위', (() => { const list = judged.filter((x) => x.from === sp.key); return list.length ? list.map((x, i) => [i ? ' · ' : null, ui.link(`unit:${x.key}`, x.unit.title), ` (${x.before ?? '?'} → ${x.grade})`]) : ui.el('span', { class: 'muted' }, '없음'); })()]]));
      return;
    }
    const T = s.t;
    const g = gradeAt(j, T);
    const after = T != null && T < j.tick;
    const gradeRow = [ui.chip('grade', j.grade)];
    if (after) gradeRow.push(' ', ui.el('span', { class: 'order-spoiler' }, `컷오프 뒤 — ${fmt.tickLabel(j.tick, { date: false })}에 나온다`));
    else if (g !== j.grade) gradeRow.push(' ', ui.el('span', {}, `지금 자리(${fmt.tickShort(T)})에서는 `, ui.chip('grade', g), ' — ', ui.link(`unit:${j.from}`, spineLabel(j.from)), `가 이 단위를 딛기 시작하면 ${j.grade}`));
    else if (j.from_tick) gradeRow.push(' ', ui.el('span', { class: 'muted' }, `${spineLabel(j.from)}부터 — 그 앞에서는 ${j.before ?? j.grade}`));
    const basisRow = j.basis ? [basisLink(j), j.basis_kind ? [' ', ui.chip('record', j.basis_kind)] : null, j.basis_scene ? [' ', ui.link(`scene:${j.basis_scene}`, fmt.ref(j.basis_scene, j.basis_line))] : null,
      j.basis_text ? ui.el('div', { class: 'order-basis-text' }, j.basis_text) : null] : ui.el('span', { class: 'muted' }, '없음 — 척추가 말하지 않은 세계 · 척추 인물 기록이 없다(독립)');
    const reviews = (j.reviews ?? []).map((r) => ui.el('li', {}, ui.el('span', { class: 'mono' }, `${r.session} ${r.date}`), ` ${r.decision}`,
      r.note != null ? ui.el('span', { class: 'muted' }, ` — ${order.review_notes[r.note] ?? ''}`) : null,
      r.before ? ui.el('div', { class: 'order-review-before muted' }, '그 전: ', ...recordLinks(r.before)) : null));
    card.append(
      ui.el('div', { class: 'panel-head' }, ui.el('h3', {}, ui.chip('kind', j.unit.kind), ' ', ui.link(`unit:${j.key}`, j.unit.title), ui.el('span', { class: 'muted order-card-sub' }, ` · ${fmt.tickLabel(j.tick)} · ${fmt.num(j.unit.chars)}자 · ${fmt.num(j.unit.scenes)}씬`)), close),
      kv([
        ['등급', gradeRow],
        j.path ? ['자리별', [j.before ?? '?', ' → ', ui.link(`unit:${j.from}`, spineLabel(j.from)), ` ${j.grade}`, ui.el('span', { class: 'muted' }, ` (${j.from_tick != null ? fmt.tickLabel(j.from_tick, { date: false }) : ''}부터 — 내려가는 자리는 없다)`)]] : null,
        ['결정 근거', basisRow],
        ['이유', j.reason ? recordLinks(j.reason) : ui.el('span', { class: 'muted' }, '없음')],
        ['판정', [j.judgment ? ui.chip('plain', j.judgment) : null, ' ', j.confidence ? ui.chip('confidence', j.confidence) : null, ' ', ui.el('span', { class: 'muted' }, `기준 시점 ${j.asof ?? '?'} · 층 `), j.unit.layer ? ui.chip('layer', j.unit.layer) : null]],
        j.threads?.length ? ['줄기', j.threads.map((t, i) => [i ? ' · ' : null, ui.link(`thread:${t}`, `${t} ${idx.threads.get(t)?.title ?? ''}`.trim())])] : null,
        j.origin_of?.length || j.lead_facts ? ['주역', [j.origin_of?.length ? [ui.el('b', {}, '원점: '), j.origin_of.map((p, i) => [i ? ' · ' : null, ui.link(`person:${p}`, fmt.targetName(p))]), ' '] : null, j.lead_facts ? ui.el('span', { class: 'muted' }, `사연 조각 — ${j.lead_facts}`) : null]] : null,
        j.closures ? ['마무리', recordLinks(j.closures)] : null,
        ['이력', [ui.el('div', {}, j.history ?? ''), reviews.length ? ui.details(`검토 기록 ${reviews.length}`, ui.el('ul', { class: 'order-reviews' }, reviews)) : null]],
      ]));
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
      for (const c of mapScroll.querySelectorAll('.order-dot')) c.classList.toggle('is-selected', c.dataset.key === key);
      renderCard(s);
    }
  });
  let resizeTimer = null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (mapView.hidden) return;
    const w = (mapScroll.clientWidth || 0) - 76;
    if (Math.abs(Math.floor(w / spine.length) * spine.length + 76 - mapWidth) < MIN_COL) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawMap(state.get()), 120);
  }) : null;
  ro?.observe(mapView);
  return () => { off(); ro?.disconnect(); clearTimeout(findTimer); clearTimeout(resizeTimer); };
}
