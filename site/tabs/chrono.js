/**
 * 탭 5 연대기 — W1 자리 표시. W6가 이 파일을 갈아 끼운다(화면 6: 공개순 · 작중순 전환, 판별 · 범위(띠) · 상대 · 시점 불명 · 회상 · 어긋남).
 * 지금은 units.json의 작중 자리(chrono) 분류 집계만.
 */
export const meta = { id: 'chrono', title: '연대기', blurb: '공개순 · 작중순 전환. 판별 단위는 제자리, 범위만 아는 단위는 띠, 시점 불명은 따로, 회상은 과거 자리에, 출시순과 어긋남 표시' };

export async function mount(root, ctx) {
  const { state, ui, fmt, idx } = ctx;
  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb),
    ui.notice('이 탭은 W6에서 그린다. 자료: timeline/chrono.csv · chrono-order.csv · chrono-pieces.csv → tools/site/export/chrono.mjs. 아래는 작중 자리 분류 집계 데모(컷오프 반영).', 'info')));
  const body = ui.el('div', {});
  root.append(ui.panel('작중 자리 분류', body));
  const apply = (s) => {
    ui.clear(body);
    const seen = idx.unitList.filter((u) => state.visible(u.tick, s.t));
    const tally = new Map();
    for (const u of seen) { const c = u.chrono?.class ?? '없음'; tally.set(c, (tally.get(c) ?? 0) + 1); }
    body.append(ui.el('dl', { class: 'kvs' }, ['판별', '범위', '상대', '불명', '없음'].filter((c) => tally.has(c)).map((c) =>
      ui.el('div', { class: 'kv' }, ui.el('dt', {}, fmt.CHRONO_CLASS[c] ?? c), ui.el('dd', {}, `${fmt.num(tally.get(c))}단위`)))));
    body.append(ui.el('p', { class: 'muted' }, `컷오프 ${fmt.tickLabel(s.t, { date: false })} 안 ${fmt.num(seen.length)}단위`));
  };
  apply(state.get());
  const off = state.subscribe((s, changed) => { if (changed.has('t')) apply(s); });
  return () => off();
}
