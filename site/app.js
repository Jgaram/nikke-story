/**
 * 부팅(W1) — URL 상태 복원 → 상단 바(검색 · 여기까지 읽음 · 범위 · 테마) · 탭 nav · 첫 방문 선택 바 → 탭 모듈 동적 import → mount. 리더 패널은 sel로 연다.
 * 탭 모듈 규약 · ctx는 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)". 화면에 보이는 말은 lib/format.js의 라벨을 쓴다.
 */
import * as state from './lib/state.js';
import * as data from './lib/data.js';
import * as fmt from './lib/format.js';
import * as ui from './lib/ui.js';
import * as reader from './lib/reader.js';
import * as search from './lib/search.js';

const TAB_META = fmt.TAB_ORDER.map((id) => ({ id, title: fmt.TAB[id].title, hint: fmt.TAB[id].hint }));
const THEME_KEY = 'nikke-story.theme';
const $ = (sel) => document.querySelector(sel);

// ── 테마 ──
const THEME_NAME = { dark: '다크', light: '라이트' };
function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'light' || theme === 'dark') html.dataset.theme = theme;
  else delete html.dataset.theme;
  const btn = $('#theme-btn');
  if (btn) {
    btn.replaceChildren(ui.icon(theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'auto'));
    const name = THEME_NAME[theme] ?? '자동';
    btn.title = `테마: ${name}`;
    btn.setAttribute('aria-label', `테마 바꾸기 (지금 ${name})`);
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

// ── 여기까지 읽음(컷오프) ──
function cutoffControl(idx) {
  const wrap = $('#cutoff');
  const first = idx.tickList[0]?.tick ?? 1;
  const last = idx.tickList.at(-1)?.tick ?? 1;
  const slider = ui.el('input', { type: 'range', id: 'cutoff-slider', min: first, max: last, step: 1, 'aria-label': fmt.TERM.cutoff });
  const value = ui.el('output', { for: 'cutoff-slider', class: 'cutoff-value' });
  const dateEl = ui.el('span', { class: 'cutoff-date' });
  const stack = ui.el('div', { class: 'cutoff-stack', title: fmt.TERM_HELP.cutoff },
    ui.el('span', { class: 'cutoff-name' }, fmt.TERM.cutoff),
    ui.el('span', { class: 'cutoff-read' }, value, dateEl));
  const all = ui.toggle({ label: fmt.TERM.showAll, id: 'cutoff-all', title: '켜면 모든 시점의 이야기를 본다 (스포일러 주의)' });
  const list = ui.el('datalist', { id: 'cutoff-marks' }, idx.mainTicks.map((t) => ui.el('option', { value: t.tick, label: fmt.tickShort(t.tick) })));
  slider.setAttribute('list', 'cutoff-marks');
  const fill = (v) => slider.style.setProperty('--fill', `${last > first ? ((v - first) / (last - first)) * 100 : 0}%`);
  const show = (t) => {
    if (t == null) {
      value.textContent = '전부';
      dateEl.textContent = '';
      slider.title = fmt.TERM.showAll;
      return;
    }
    const tk = idx.ticks.get(t);
    value.textContent = tk?.main ? fmt.tickShort(t) : fmt.tickLabel(t, { date: false });
    dateEl.textContent = tk?.date ?? '';
    slider.title = fmt.tickLabel(t);
    slider.setAttribute('aria-valuetext', fmt.tickLabel(t));
    fill(t);
  };
  const sync = (s) => {
    const off = s.t == null;
    slider.disabled = off;
    wrap.classList.toggle('is-off', off);
    if (!off) slider.value = s.t;
    show(s.t);
    all.set(off);
  };
  slider.addEventListener('input', () => show(Number(slider.value)));
  slider.addEventListener('change', () => state.set({ t: Number(slider.value) }));
  all.querySelector('input').addEventListener('change', (e) => state.set({ t: e.target.checked ? null : state.lastCutoff() }));
  wrap.append(stack, slider, list, all);
  sync(state.get());
  state.subscribe((s, changed) => { if (changed.has('t')) sync(s); });
}

// ── 범위(핵심 · 넓게 · 전부) ──
function scopeControl() {
  const wrap = $('#layers');
  const seg = ui.segmented({
    label: fmt.TERM.scope,
    value: fmt.scopeOf(state.get().layers),
    options: fmt.SCOPE.map((o) => ({ value: o.value, label: o.label, title: o.help })),
    onChange: (v) => state.set({ layers: fmt.SCOPE.find((o) => o.value === v).layers }),
  });
  wrap.append(ui.el('span', { class: 'ctl-name', title: fmt.TERM_HELP.scope }, fmt.TERM.scope), seg.el);
  state.subscribe((s, changed) => { if (changed.has('layers')) seg.set(fmt.scopeOf(s.layers)); });
}

// ── 첫 방문 선택 바 — 처음 열면 어디까지 읽었는지 묻는다(컷오프 기본이 CH.00이라 탭이 거의 비어 보인다) ──
const FV_LATER_KEY = 'nikke-story.fv-later';
function firstVisitBar(idx, wanted) {
  const bar = $('#first-visit');
  let later = false;
  try { later = Boolean(sessionStorage.getItem(FV_LATER_KEY)); } catch { /* 없음 */ }
  if (!wanted || later) return;
  const V = fmt.FIRST_VISIT;
  const hide = () => { bar.hidden = true; };
  const select = ui.el('select', { id: 'fv-select', class: 'fv-select', 'aria-label': V.pick },
    ui.el('option', { value: '', selected: true, disabled: true }, V.pick),
    idx.mainTicks.map((t) => ui.el('option', { value: t.tick }, fmt.unitTitle(t.main))));
  select.addEventListener('change', () => {
    if (!select.value) return;
    state.set({ t: Number(select.value) });
    hide();
  });
  bar.append(
    ui.el('span', { class: 'fv-ask' }, V.ask),
    ui.el('span', { class: 'fv-pick' }, select),
    ui.el('span', { class: 'fv-btns' },
      ui.el('button', { type: 'button', class: 'btn', title: V.allHelp, onClick: () => { state.set({ t: null }); hide(); } }, V.all),
      ui.el('button', { type: 'button', class: 'btn btn-quiet', onClick: () => {
        try { sessionStorage.setItem(FV_LATER_KEY, '1'); } catch { /* 없음 */ }
        hide();
      } }, V.later)));
  bar.hidden = false;
  // 위 슬라이더 · 다른 경로로 컷오프를 고르면 바는 할 일을 다 한 것
  state.subscribe((s, changed) => { if (changed.has('t')) hide(); });
}

// ── 탭 nav ──
function tabNav() {
  const nav = $('#tabs');
  const buttons = new Map();
  const ind = ui.el('span', { class: 'tab-ind', 'aria-hidden': 'true' });
  for (const t of TAB_META) {
    const b = ui.el('a', { href: `#tab=${t.id}`, role: 'tab', class: 'tab', id: `tab-${t.id}`, title: t.hint, 'aria-controls': 'main', 'aria-selected': 'false', onClick: (e) => { e.preventDefault(); state.set({ tab: t.id }); } }, t.title);
    b.addEventListener('keydown', (e) => {
      const ids = TAB_META.map((x) => x.id);
      const i = ids.indexOf(t.id);
      if (e.key === 'ArrowRight') { e.preventDefault(); state.set({ tab: ids[(i + 1) % ids.length] }); buttons.get(ids[(i + 1) % ids.length]).focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); state.set({ tab: ids[(i - 1 + ids.length) % ids.length] }); buttons.get(ids[(i - 1 + ids.length) % ids.length]).focus(); }
    });
    buttons.set(t.id, b);
    nav.append(b);
  }
  nav.append(ind);
  // 밑줄 — 활성 탭 아래로 미끄러진다
  const place = (reveal = false) => {
    const a = nav.querySelector('.tab.active');
    if (!a) return;
    ind.style.width = `${a.offsetWidth}px`;
    ind.style.transform = `translateX(${a.offsetLeft}px)`;
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2);
    if (reveal) requestAnimationFrame(() => ind.classList.add('ready'));
  };
  const sync = (s) => {
    for (const [id, b] of buttons) {
      const on = id === s.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('active', on);
    }
    place();
  };
  sync(state.get());
  place(true);
  window.addEventListener('resize', () => place());
  document.fonts?.ready?.then(() => place());
  state.subscribe((s, changed) => { if (changed.has('tab')) sync(s); });
}

function footer(idx) {
  const d = idx.manifest?.last_date;
  $('#data-basis').textContent = d ? `데이터 ${d} 기준` : '';
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
  main.append(ui.spinner());
  try {
    const mod = await import(`./tabs/${tab}.js`);
    if (mounting !== token) return;
    ui.clear(main);
    document.title = `${mod.meta?.title ?? tab} · ${fmt.TERM.site}`;
    unmount = (await mod.mount(main, ctx)) ?? null;
  } catch (err) {
    if (mounting !== token) return;
    ui.clear(main);
    main.append(ui.notice(`불러오지 못함: ${err.message}`, 'error'));
    console.error(err);
  }
}

// ── 처음 상태로 — 로고를 누르면 이 사이트가 남긴 기억(localStorage · sessionStorage의 nikke-story.*)을 지우고 첫 방문처럼 다시 연다 ──
const STORE_PREFIX = 'nikke-story.';
function resetButton() {
  const brand = $('.brand');
  if (!brand) return;
  brand.title = '처음 상태로 — 어디까지 읽음 · 테마 · 접은 칸을 지우고 첫 화면부터';
  brand.addEventListener('click', (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 새 탭 열기는 그대로
    e.preventDefault();
    for (const store of [() => localStorage, () => sessionStorage]) {
      try {
        const s = store();
        for (const k of Object.keys(s)) if (k.startsWith(STORE_PREFIX)) s.removeItem(k);
      } catch { /* 저장소가 없으면 지울 것도 없다 */ }
    }
    location.replace(location.pathname + location.search); // 해시(탭 · 거르개 · 선택)도 비운다
  });
}

async function boot() {
  themeButton();
  resetButton();
  ui.configure({ navigate: (sel) => state.set({ sel }) });
  const main = $('#main');
  main.append(ui.spinner());
  const d3Promise = import('./lib/d3.js').catch((err) => { console.warn('d3를 불러오지 못했다 — 그래프 탭은 안 그려진다', err); return null; });
  let idx;
  try {
    idx = await data.index();
  } catch (err) {
    ui.clear(main);
    main.append(ui.notice(`데이터를 불러오지 못함: ${err.message}`, 'error'));
    console.info('site/data/가 없으면 node tools/site/export.mjs로 만들고, 정적 서버(node tools/site/serve.mjs)로 연다');
    return;
  }
  fmt.use(idx);
  const ch00 = idx.mainTicks.find((t) => t.main === 'ch00')?.tick ?? idx.tickList[0]?.tick ?? 1;
  const firstVisit = !state.cutoffChosen(); // init이 URL에 t를 쓰기 전에 본다
  state.init({ defaultCutoff: ch00 });
  firstVisitBar(idx, firstVisit);
  cutoffControl(idx);
  scopeControl();
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
  main.append(ui.notice(`시작하지 못함: ${err.message}`, 'error'));
});
