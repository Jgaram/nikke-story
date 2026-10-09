/**
 * 탭 1 읽기 순서 — W1 자리 표시. W2가 이 파일을 갈아 끼운다(화면 1: 척추 가로축 + 메인 밖 단위를 등급 색으로).
 * 지금은 units.json을 표로 — 컷오프 · 층 · 종류 거르개(p.kind) · 리더 · URL 상태가 실제로 도는지 W1이 검증하는 용도다.
 */
export const meta = { id: 'order', title: '읽기 순서', blurb: '척추(메인 챕터 + 척추 이벤트 · 사이드)를 가로축으로, 메인 밖 단위를 그 자리에 등급 색으로. "CH.N까지 읽었으면 다음에 뭘 읽나"' };

export async function mount(root, ctx) {
  const { state, ui, fmt, idx } = ctx;
  const units = idx.unitList;
  const kindOptions = [{ value: 'all', label: '전체' }, ...fmt.KIND_ORDER.map((k) => ({ value: k, label: fmt.KIND[k].label }))];

  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb),
    ui.notice('이 탭은 W2에서 그린다. 아래 표는 W1의 공용 컴포넌트 데모 — 컷오프 · 층 · 종류 거르개 · 리더 패널 · URL 상태를 확인한다.', 'info')));

  const count = ui.el('span', { class: 'count', role: 'status', 'aria-live': 'polite' });
  const seg = ui.segmented({ label: '종류', options: kindOptions, value: state.param('order', 'kind') ?? 'all', onChange: (v) => state.setParam('order', 'kind', v === 'all' ? null : v) });
  root.append(ui.el('div', { class: 'toolbar' }, seg.el, count));
  root.append(ui.el('div', { class: 'toolbar' }, ui.el('span', { class: 'ctl-name' }, '등급'), ui.legend(fmt.GRADE_ORDER.map((g) => ({ label: g, color: fmt.GRADE[g].color }))), ui.el('span', { class: 'ctl-name' }, '층'), ui.legend([1, 2, 3].map((l) => ({ label: fmt.LAYER[l].label, color: fmt.LAYER[l].color })))));

  const tbl = ui.table({
    rowKey: 'key',
    pageSize: 60,
    onRow: (u) => state.set({ sel: `unit:${u.key}` }),
    columns: [
      { key: 'order', label: '자리', num: true, width: '4em' },
      { key: 'tick', label: '공개', num: true, width: '7em', render: (u) => ui.el('span', { title: fmt.tickLabel(u.tick) }, fmt.tickShort(u.tick)) },
      { key: 'kind', label: '종류', render: (u) => ui.chip('kind', u.kind), sort: (a, b) => fmt.KIND_ORDER.indexOf(a.kind) - fmt.KIND_ORDER.indexOf(b.kind) },
      { key: 'title', label: '제목', render: (u) => ui.link(`unit:${u.key}`, u.title) },
      { key: 'grade', label: '등급', render: (u) => (u.grade ? ui.chip('grade', u.grade) : ''), sort: (a, b) => (fmt.GRADE[a.grade]?.rank ?? 9) - (fmt.GRADE[b.grade]?.rank ?? 9) },
      { key: 'layer', label: '층', render: (u) => (u.layer ? ui.chip('layer', u.layer) : ''), num: true },
      { key: 'scenes', label: '씬', num: true },
      { key: 'chars', label: '글자', num: true, render: (u) => fmt.num(u.chars) },
      { key: 'date', label: '공개일', nowrap: true },
    ],
    empty: '컷오프 · 거르개에 맞는 단위가 없다',
  });
  root.append(tbl.el);

  const apply = (s) => {
    const kind = s.p.kind ?? 'all';
    const rows = units.filter((u) => state.visible(u.tick, s.t) && (u.layer == null || s.layers.includes(u.layer)) && (kind === 'all' || u.kind === kind));
    const hiddenCut = units.filter((u) => !state.visible(u.tick, s.t)).length;
    const hiddenLayer = units.filter((u) => state.visible(u.tick, s.t) && u.layer != null && !s.layers.includes(u.layer)).length;
    tbl.update(rows);
    count.textContent = `${fmt.num(rows.length)} / ${fmt.num(units.length)}단위 (컷오프 뒤 숨김 ${fmt.num(hiddenCut)} · 층 거르개 ${fmt.num(hiddenLayer)})`;
    seg.set(kind);
    const sel = state.parseSel(s.sel);
    tbl.setSelected(sel?.type === 'unit' ? sel.id : null);
  };
  apply(state.get());
  const off = state.subscribe((s, changed) => {
    if (changed.has('t') || changed.has('layers') || changed.has('p')) apply(s);
    else if (changed.has('sel')) { const sel = state.parseSel(s.sel); tbl.setSelected(sel?.type === 'unit' ? sel.id : null); }
  });
  return () => off();
}
