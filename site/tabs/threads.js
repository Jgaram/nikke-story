/**
 * 탭 3 떡밥 — W1 자리 표시. W4가 이 파일을 갈아 끼운다(화면 3 · 4: 줄기 지도 + 줄기 하나의 제기 → 암시 → 일부 회수 → 회수 · 뒤집음 흐름, 축 공개순 · 작중순).
 * 지금은 threads.json의 줄기 60을 표로 — 줄기를 누르면 리더가 연다(sel thread:J1).
 */
export const meta = { id: 'threads', title: '떡밥', blurb: '줄기 지도(줄기 ↔ 줄기 · 줄기 ↔ 개념) + 줄기 하나의 제기 → 암시 → 일부 회수 → 회수 · 뒤집음 흐름. 열린 의문 강조' };

export async function mount(root, ctx) {
  const { state, ui, fmt, idx } = ctx;
  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb),
    ui.notice('이 탭은 W4에서 그린다. 아래는 줄기 목록 데모 — 줄기를 누르면 리더 패널에 의문 · 사실 · 관계가 나온다.', 'info')));
  const tbl = ui.table({
    rowKey: 'id',
    pageSize: 0,
    onRow: (j) => state.set({ sel: `thread:${j.id}` }),
    columns: [
      { key: 'id', label: 'ID', width: '4em', render: (j) => ui.el('code', {}, j.id), sort: (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)) },
      { key: 'weight', label: '무게', render: (j) => ui.chip('plain', j.weight, j.weight) },
      { key: 'title', label: '줄기', render: (j) => ui.link(`thread:${j.id}`, j.title) },
      { key: 'open', label: '열림', num: true },
      { key: 'partial', label: '일부', num: true },
      { key: 'solved', label: '풀림', num: true },
      { key: 'units', label: '단위', num: true },
      { key: 'first_unit', label: '처음', render: (j) => (j.first_unit ? fmt.unitTitle(j.first_unit) : '') },
      { key: 'last_unit', label: '마지막', render: (j) => (j.last_unit ? fmt.unitTitle(j.last_unit) : '') },
    ],
  });
  tbl.update(idx.threadList);
  root.append(tbl.el);
  const off = state.subscribe((s, changed) => { if (changed.has('sel')) { const sel = state.parseSel(s.sel); tbl.setSelected(sel?.type === 'thread' ? sel.id : null); } });
  return () => off();
}
