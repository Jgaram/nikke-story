/**
 * 탭 2 연결 — W1 자리 표시. W3가 이 파일을 갈아 끼운다(화면 2: 단위 그래프 → 씬, 타입 · 인물 · 대상 · 줄기 · 층 · 세기 거르개, 선 → 기록 · 근거 줄).
 * 자료는 tools/site/export/links.mjs가 만든다(data/views/links/ → links.json). ctx.d3가 null이면 CDN을 못 받은 것이다.
 */
export const meta = { id: 'links', title: '연결', blurb: '단위 그래프(줌인하면 씬). 타입 · 인물 · 대상 · 줄기 · 층 · 세기 거르개. 선 → 만든 기록 · 근거 줄' };

export async function mount(root, ctx) {
  const { ui, fmt, idx, d3 } = ctx;
  root.append(ui.el('div', { class: 'tab-head' }, ui.el('h2', {}, meta.title), ui.el('p', { class: 'blurb' }, meta.blurb),
    ui.notice('이 탭은 W3에서 그린다. 관계선 데이터(links.json)는 tools/site/export/links.mjs가 만든다 — 지금은 비어 있다.', 'info')));
  root.append(ui.panel('지금 있는 것', ui.el('dl', { class: 'kvs' },
    ui.el('div', { class: 'kv' }, ui.el('dt', {}, 'd3'), ui.el('dd', {}, d3 ? `v${d3.version} — 준비됨` : 'CDN에서 못 받음')),
    ui.el('div', { class: 'kv' }, ui.el('dt', {}, '단위'), ui.el('dd', {}, fmt.num(idx.unitList.length))),
    ui.el('div', { class: 'kv' }, ui.el('dt', {}, '씬'), ui.el('dd', {}, fmt.num(idx.scenes.size))),
    ui.el('div', { class: 'kv' }, ui.el('dt', {}, '관계선'), ui.el('dd', {}, 'W3 — data/views/links/scene-edges.csv · unit-edges.csv')))));
  return () => {};
}
