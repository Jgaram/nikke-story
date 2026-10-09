/**
 * 탭 6 세계 — W1 자리 표시. W7이 이 파일을 갈아 끼운다(화면 4 개념 쪽: 개념 · 사건 · 물건 · 조직 · 장소 사전 + 생활상 분류별 목록).
 * 지금은 targets.json의 비인물 대상을 종류별 표로 — 누르면 리더가 연다(sel target:place:방주).
 */
export const meta = { id: 'world', title: '세계', blurb: '개념 · 사건 · 물건 · 조직 · 장소 사전 + 생활상(분류별 목록). 개념 → 다룬 사실 · 단위 · 줄기' };

export async function mount(root, ctx) {
  const { state, ui, fmt, idx } = ctx;
  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb),
    ui.notice('이 탭은 W7에서 그린다. 아래는 사전 데모 — 대상을 누르면 리더 패널에 사전 메모 · 기록이 나온다. 생활상 목록은 W7의 world.json이 든다.', 'info')));
  const types = ['place', 'org', 'concept', 'incident', 'item'];
  const seg = ui.segmented({ label: '종류', options: [{ value: 'all', label: '전체' }, ...types.map((t) => ({ value: t, label: fmt.TARGET_TYPE[t] }))], value: state.param('world', 'type') ?? 'all', onChange: (v) => state.setParam('world', 'type', v === 'all' ? null : v) });
  root.append(ui.el('div', { class: 'toolbar' }, seg.el));
  const tbl = ui.table({
    rowKey: 'id',
    pageSize: 60,
    onRow: (t) => state.set({ sel: `target:${t.id}` }),
    columns: [
      { key: 'type', label: '종류', render: (t) => ui.chip('plain', t.type, fmt.TARGET_TYPE[t.type] ?? t.type) },
      { key: 'name', label: '이름', render: (t) => ui.link(`target:${t.id}`, t.name) },
      { key: 'kind', label: '갈래' },
      { key: 'aliases', label: '다른 이름', sortable: false, render: (t) => (t.aliases ?? []).map((a) => a.name).join(' · ') },
      { key: 'stories', label: '씬', num: true, render: (t) => fmt.num(t.stories ?? 0) },
      { key: 'note', label: '메모', sortable: false, render: (t) => ui.el('span', { class: 'muted' }, t.note ?? '') },
    ],
  });
  root.append(tbl.el);
  const apply = (s) => {
    const type = s.p.type ?? 'all';
    tbl.update(idx.targetList.filter((t) => t.type !== 'person' && (type === 'all' || t.type === type)));
    seg.set(type);
  };
  apply(state.get());
  const off = state.subscribe((s, changed) => {
    if (changed.has('p')) apply(s);
    if (changed.has('sel')) { const sel = state.parseSel(s.sel); tbl.setSelected(sel?.type === 'target' ? sel.id : null); }
  });
  return () => off();
}
