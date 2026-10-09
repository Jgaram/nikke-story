/**
 * 탭 4 인물 — W1 자리 표시. W5가 이 파일을 갈아 끼운다(화면 5: 전체 표 → 인물 하나: 등장 히트맵 · 함께 나온 인물 · 사실 · 의문 · 줄기 · 변화 타임라인 · 마무리).
 * 지금은 targets.json의 인물을 나온 씬 수 순으로 — 누르면 리더가 연다(sel person:person:라피).
 */
export const meta = { id: 'persons', title: '인물', blurb: '전체 표(등장 · 기록 · 줄기) → 인물 하나: 등장 히트맵 · 함께 나온 인물 네트워크 · 사실 · 의문 · 줄기 · 변화 타임라인(작중 순서) · 마무리' };

export async function mount(root, ctx) {
  const { state, ui, fmt, idx } = ctx;
  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb),
    ui.notice('이 탭은 W5에서 그린다. 아래는 인물 사전 데모 — 인물을 누르면 리더 패널에 사전 · 기록이 나온다. 집계(등장 · 함께 나온 인물)는 W5의 persons.json이 든다.', 'info')));
  const persons = idx.targetList.filter((t) => t.type === 'person');
  const tbl = ui.table({
    rowKey: 'id',
    pageSize: 60,
    onRow: (t) => state.set({ sel: `person:${t.id}` }),
    columns: [
      { key: 'name', label: '인물', render: (t) => ui.link(`person:${t.id}`, t.name) },
      { key: 'kind', label: '갈래', render: (t) => (t.kind ? ui.chip('plain', t.kind, t.kind) : '') },
      { key: 'aliases', label: '다른 이름', sortable: false, render: (t) => (t.aliases ?? []).map((a) => a.name).join(' · ') },
      { key: 'stories', label: '씬', num: true, render: (t) => fmt.num(t.stories ?? 0) },
      { key: 'lines', label: '줄', num: true, render: (t) => fmt.num(t.lines ?? 0) },
      { key: 'same_as', label: '같은 인물', sortable: false, render: (t) => (t.same_as ?? []).map(fmt.targetName).join(' · ') },
    ],
  });
  tbl.update([...persons].sort((a, b) => (b.stories ?? 0) - (a.stories ?? 0)));
  root.append(tbl.el);
  const off = state.subscribe((s, changed) => { if (changed.has('sel')) { const sel = state.parseSel(s.sel); tbl.setSelected(sel?.type === 'person' ? sel.id : null); } });
  return () => off();
}
