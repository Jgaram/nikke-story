/**
 * 부팅(W1) — URL 상태 복원 → 상단 바(검색 · 컷오프 · 층 · 테마) · 탭 nav → 탭 모듈 동적 import → mount. 리더 패널은 sel로 연다.
 * 탭 모듈 규약 · ctx는 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 */
import * as state from './lib/state.js';
import * as data from './lib/data.js';
import * as fmt from './lib/format.js';
import * as ui from './lib/ui.js';
import * as reader from './lib/reader.js';
import * as search from './lib/search.js';

const TAB_META = [
  { id: 'order', title: '읽기 순서' },
  { id: 'links', title: '연결' },
  { id: 'threads', title: '떡밥' },
  { id: 'persons', title: '인물' },
  { id: 'chrono', title: '연대기' },
  { id: 'world', title: '세계' },
];
const THEME_KEY = 'nikke-story.theme';
const $ = (sel) => document.querySelector(sel);

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'light' || theme === 'dark') html.dataset.theme = theme;
  else delete html.dataset.theme;
  const btn = $('#theme-btn');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☾ 다크' : theme === 'light' ? '☼ 라이트' : '◐ 자동';
    btn.title = `테마: ${theme === 'dark' ? '다크' : theme === 'light' ? '라이트' : 'OS 설정'} — 눌러서 바꾼다`;
  }
}
function themeButton() {
  const btn = $('#theme-btn');
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch { /* 없음 */ }
  applyTheme(theme);
  btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : theme === 'light' ? null : 'dark';
    try { theme ? localStorage.setItem(THEME_KEY, theme) : localStorage.removeItem(THEME_KEY); } catch { /* 없음 */ }
    applyTheme(theme);
  });
}

function cutoffControl(idx) {
  const wrap = $('#cutoff');
  const first = idx.tickList[0]?.tick ?? 1;
  const last = idx.tickList.at(-1)?.tick ?? 1;
  const slider = ui.el('input', { type: 'range', id: 'cutoff-slider', min: first, max: last, step: 1, 'aria-label': '스포일러 컷오프 — 공개 자리' });
  const label = ui.el('output', { for: 'cutoff-slider', class: 'cutoff-label' });
  const all = ui.toggle({ label: '전부 보기', id: 'cutoff-all', title: '컷오프를 끈다 — 모든 자리의 기록을 보인다' });
  const list = ui.el('datalist', { id: 'cutoff-marks' }, idx.mainTicks.map((t) => ui.el('option', { value: t.tick, label: fmt.tickShort(t.tick) })));
  slider.setAttribute('list', 'cutoff-marks');
  const sync = (s) => {
    const off = s.t == null;
    slider.disabled = off;
    if (!off) slider.value = s.t;
    label.textContent = off ? '전부 보기 (컷오프 끔)' : fmt.tickLabel(s.t);
    all.set(off);
  };
  slider.addEventListener('input', () => { label.textContent = fmt.tickLabel(Number(slider.value)); });
  slider.addEventListener('change', () => state.set({ t: Number(slider.value) }));
  all.querySelector('input').addEventListener('change', (e) => state.set({ t: e.target.checked ? null : state.lastCutoff() }));
  wrap.append(ui.el('span', { class: 'ctl-name' }, '컷오프'), slider, list, label, all);
  sync(state.get());
  state.subscribe((s, changed) => { if (changed.has('t')) sync(s); });
}

function layerControl() {
  const wrap = $('#layers');
  wrap.append(ui.el('span', { class: 'ctl-name' }, '층'));
  const boxes = new Map();
  for (const l of state.ALL_LAYERS) {
    const input = ui.el('input', { type: 'checkbox', id: `layer-${l}`, value: l });
    const lab = ui.el('label', { class: 'layer-box', for: `layer-${l}`, title: `${l}층을 보인다 / 숨긴다` }, input, ui.chip('layer', l));
    input.addEventListener('change', () => {
      const on = [...boxes].filter(([, b]) => b.checked).map(([k]) => k);
      state.set({ layers: on.length ? on : state.ALL_LAYERS });
    });
    boxes.set(l, input);
    wrap.append(lab);
  }
  const sync = (s) => { for (const [l, b] of boxes) b.checked = s.layers.includes(l); };
  sync(state.get());
  state.subscribe((s, changed) => { if (changed.has('layers')) sync(s); });
}

function tabNav() {
  const nav = $('#tabs');
  const buttons = new Map();
  for (const t of TAB_META) {
    const b = ui.el('a', { href: `#tab=${t.id}`, role: 'tab', class: 'tab', id: `tab-${t.id}`, 'aria-controls': 'main', 'aria-selected': 'false', onClick: (e) => { e.preventDefault(); state.set({ tab: t.id }); } }, t.title);
    b.addEventListener('keydown', (e) => {
      const ids = TAB_META.map((x) => x.id);
      const i = ids.indexOf(t.id);
      if (e.key === 'ArrowRight') { e.preventDefault(); state.set({ tab: ids[(i + 1) % ids.length] }); buttons.get(ids[(i + 1) % ids.length]).focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); state.set({ tab: ids[(i - 1 + ids.length) % ids.length] }); buttons.get(ids[(i - 1 + ids.length) % ids.length]).focus(); }
    });
    buttons.set(t.id, b);
    nav.append(b);
  }
  const sync = (s) => {
    for (const [id, b] of buttons) {
      const on = id === s.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('active', on);
    }
  };
  sync(state.get());
  state.subscribe((s, changed) => { if (changed.has('tab')) sync(s); });
}

function footer(idx) {
  const m = idx.manifest;
  const f = $('#data-basis');
  if (!m) { f.textContent = '데이터 기준: manifest 없음'; return; }
  const files = Object.values(m.files ?? {});
  const n = (name) => m.files?.[name]?.count;
  f.textContent = `데이터 기준: ${m.built_at?.slice(0, 10) ?? '?'} 내보냄 · 마지막 공개일 ${m.last_date ?? '?'} · 단위 ${n('units.json') ?? '?'} · 공개 자리 ${n('ticks.json') ?? '?'} · 씬 ${n('scenes.json') ?? '?'} · 기록 ${(n('records.json') ?? 0) + (n('records2.json') ?? 0)} · 파일 ${files.length}`;
}

let unmount = null;
let mounting = null;
async function mountTab(ctx) {
  const tab = state.get().tab;
  const main = $('#main');
  const token = Symbol(tab);
  mounting = token;
  if (unmount) { try { unmount(); } catch (err) { console.error('탭 정리 오류', err); } unmount = null; }
  ui.clear(main);
  main.className = `main tab-${tab}`;
  main.setAttribute('aria-labelledby', `tab-${tab}`);
  main.append(ui.spinner('탭 불러오는 중…'));
  try {
    const mod = await import(`./tabs/${tab}.js`);
    if (mounting !== token) return;
    ui.clear(main);
    document.title = `${mod.meta?.title ?? tab} — NIKKE 스토리 지도`;
    unmount = (await mod.mount(main, ctx)) ?? null;
  } catch (err) {
    if (mounting !== token) return;
    ui.clear(main);
    main.append(ui.notice(`탭을 불러오지 못했다: ${err.message}`, 'error'));
    console.error(err);
  }
}

async function boot() {
  themeButton();
  ui.configure({ navigate: (sel) => state.set({ sel }) });
  const main = $('#main');
  main.append(ui.spinner('데이터 불러오는 중…'));
  const d3Promise = import('./lib/d3.js').catch((err) => { console.warn('d3를 불러오지 못했다 — 그래프 탭은 안 그려진다', err); return null; });
  let idx;
  try {
    idx = await data.index();
  } catch (err) {
    ui.clear(main);
    main.append(ui.notice(`데이터를 불러오지 못했다: ${err.message} — node tools/site/export.mjs로 site/data/를 만들었는지, 정적 서버(node tools/site/serve.mjs)로 열었는지 본다`, 'error'));
    return;
  }
  fmt.use(idx);
  const ch00 = idx.mainTicks.find((t) => t.main === 'ch00')?.tick ?? idx.tickList[0]?.tick ?? 1;
  state.init({ defaultCutoff: ch00 });
  cutoffControl(idx);
  layerControl();
  tabNav();
  footer(idx);
  reader.init({ root: $('#reader'), state, data, fmt, ui });
  search.init({ input: $('#search'), container: $('#search-results'), state, data, fmt, ui });
  const d3 = await d3Promise;
  if (!d3) $('#d3-notice').hidden = false;
  const ctx = { state, data, fmt, ui, reader, d3, idx };
  await mountTab(ctx);
  const s0 = state.get();
  if (s0.sel) reader.open(s0.sel);
  state.subscribe((s, changed) => {
    if (changed.has('tab')) mountTab(ctx);
    if (changed.has('sel')) { if (s.sel) reader.open(s.sel); else reader.close(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader.isOpen() && !e.target.closest('#search')) state.set({ sel: '' });
    if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); $('#search').focus(); }
  });
}

boot().catch((err) => {
  console.error(err);
  const main = $('#main');
  ui.clear(main);
  main.append(ui.notice(`부팅 오류: ${err.message}`, 'error'));
});
