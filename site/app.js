/**
 * 부팅(W1) — URL 상태 복원 → 상단 바(검색 · 여기까지 읽음 단추 + 팝업) · 탭 nav(첫 방문이면 여기까지 읽음 팝업이 뜬다) → 탭 모듈 동적 import → mount. 리더 패널은 sel로 연다.
 * 탭 모듈 규약 · ctx는 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)". 화면에 보이는 말은 lib/format.js의 라벨을 쓴다.
 */
import * as state from './lib/state.js';
import * as data from './lib/data.js';
import * as fmt from './lib/format.js';
import * as ui from './lib/ui.js';
import * as reader from './lib/reader.js';
import * as search from './lib/search.js';

const TAB_META = fmt.TAB_ORDER.map((id) => ({ id, title: fmt.TAB[id].title, hint: fmt.TAB[id].hint }));
const $ = (sel) => document.querySelector(sel);

// ── 여기까지 읽음(컷오프) — 상단은 지금 값을 보이는 단추 하나, 누르면 팝업(dialog). 첫 방문이면 팝업이 저절로 뜬다 ──
// 팝업: 메인은 순서대로 보니 슬라이더 + 이전 · 다음 챕터 단추 하나로, 척추 이벤트 · 사이드는 순서 없이 볼 수 있어 따로 체크(사용자, 2026-10-10)
// 팝업 안에서 바꾼 값은 초안(draft)이다 — [확인]을 눌러야 적용하고, 더 많이 보이게 되는 쪽이면 한 번 더 묻는다(사용자, 2026-10-10)
// 마지막 메인 뒤에 나온 스토리가 있으면 '사이트 수록분 끝까지'를 챕터 단추 · 눈금의 한 자리로 둔다 — 인게임 최신과 헷갈리지 않게(사용자, 2026-10-10)
const FV_LATER_KEY = 'nikke-story.fv-later';
function cutoffControl(idx, firstVisit) {
  const wrap = $('#cutoff');
  const V = fmt.FIRST_VISIT;
  const first = idx.tickList[0]?.tick ?? 1;
  const last = idx.tickList.at(-1)?.tick ?? 1;
  const lastMain = idx.mainTicks.at(-1);
  const latest = lastMain && last > lastMain.tick ? last : null; // 마지막 메인 뒤 수록분 끝 자리(없으면 null — 메인이 마지막 업데이트일 때)
  const afterMain = latest ? idx.tickList.filter((t) => t.tick > lastMain.tick).reduce((n, t) => n + (t.units?.length ?? 0), 0) : 0;
  const stops = [...idx.mainTicks.map((m) => m.tick), ...(latest ? [latest] : [])];
  const extras = state.checkExtras();
  const short = (t) => (t == null ? fmt.TERM.showAll : t === latest ? V.latestShort : idx.ticks.get(t)?.main ? fmt.tickShort(t) : fmt.tickLabel(t, { date: false }));
  const pick = (s) => ({ t: s.t ?? null, x: { ...(s.x ?? {}) } });
  let draft = pick(state.get());

  // 상단 단추
  const value = ui.el('span', { class: 'cutoff-value' });
  const extraEl = ui.el('span', { class: 'cutoff-extra' });
  const dateEl = ui.el('span', { class: 'cutoff-date' });
  const btn = ui.el('button', { type: 'button', class: 'cutoff-btn', 'aria-haspopup': 'dialog', title: fmt.TERM_HELP.cutoff },
    ui.el('span', { class: 'cutoff-stack' },
      ui.el('span', { class: 'cutoff-name' }, fmt.TERM.cutoff),
      ui.el('span', { class: 'cutoff-read' }, value, extraEl, dateEl)),
    ui.el('span', { class: 'cutoff-caret', 'aria-hidden': 'true' }, '▾'));
  wrap.append(btn);

  // 팝업
  const dlg = ui.el('dialog', { class: 'cutoff-dlg', 'aria-labelledby': 'cutoff-dlg-title' });
  const close = (chosen) => {
    if (firstVisit && !chosen) { try { sessionStorage.setItem(FV_LATER_KEY, '1'); } catch { /* 없음 */ } }
    firstVisit = false;
    if (dlg.open) dlg.close();
  };
  // 초안 적용 — 첫 방문이면 바꾸지 않았어도 지금 값을 고른 것으로 남긴다
  const apply = () => {
    const s = state.get();
    if (draft.t !== (s.t ?? null) || JSON.stringify(draft.x) !== JSON.stringify(s.x ?? {})) state.set({ t: draft.t, x: draft.x });
    else if (firstVisit) state.set({ t: s.t ?? null });
    close(true);
  };
  // 초안이 지금보다 새로 보이게 하는 스토리 수 — 0이면(같거나 줄이기) 묻지 않는다
  const newlySeen = () => {
    const R0 = state.reading(state.get());
    const R1 = state.reading(draft);
    let n = 0;
    for (const u of idx.unitList) if (!R0.seen(u.key) && R1.seen(u.key)) n++;
    return n;
  };
  const confirmFrom = ui.el('b');
  const confirmTo = ui.el('b');
  const confirmMsg = ui.el('p', { class: 'cutoff-confirm-msg' }, V.confirmMsg);
  const confirmMove = ui.el('div', { class: 'cutoff-confirm-move' },
    ui.el('span', { class: 'cutoff-confirm-cell' }, ui.el('span', { class: 'muted' }, V.confirmFrom), confirmFrom),
    ui.el('span', { class: 'cutoff-confirm-arrow', 'aria-hidden': 'true' }, '→'),
    ui.el('span', { class: 'cutoff-confirm-cell is-to' }, ui.el('span', { class: 'muted' }, V.confirmTo), confirmTo));
  const confirmSub = ui.el('p', { class: 'cutoff-confirm-sub muted' });
  const confirmBack = ui.el('button', { type: 'button', class: 'btn', onClick: () => showConfirm(false) }, V.confirmBack);
  const confirmOk = ui.el('button', { type: 'button', class: 'btn btn-guard', onClick: apply }, V.confirmOk);
  const confirmPane = ui.el('div', { class: 'cutoff-confirm', hidden: true, role: 'alertdialog', 'aria-labelledby': 'cutoff-confirm-title' },
    ui.el('h2', { id: 'cutoff-confirm-title' }, V.confirmTitle), confirmMsg, confirmMove, confirmSub,
    ui.el('div', { class: 'cutoff-dlg-foot' }, ui.el('span', { class: 'cutoff-foot-gap' }), confirmBack, confirmOk));
  const label = (s) => {
    const t = s.t ?? null;
    const base = t == null ? fmt.TERM.showAll : t === latest ? V.latest : fmt.tickLabel(t, { date: false });
    const { plus, minus } = exDiff(s);
    return t != null && (plus || minus) ? `${base} ${V.exBadge(plus, minus)}` : base;
  };
  const commit = () => {
    const n = newlySeen();
    if (!n) { apply(); return; }
    confirmFrom.textContent = label(state.get());
    confirmTo.textContent = label(draft);
    confirmSub.textContent = V.confirmSub(n);
    showConfirm(true);
  };

  const slider = ui.el('input', { type: 'range', id: 'cutoff-slider', min: first, max: last, step: 1, 'aria-label': V.mainAria });
  const list = ui.el('datalist', { id: 'cutoff-marks' }, stops.map((t) => ui.el('option', { value: t, label: t === latest ? V.latest : fmt.tickShort(t) })));
  slider.setAttribute('list', 'cutoff-marks');
  const nowName = ui.el('b', { class: 'cutoff-now-name' });
  const nowSub = ui.el('span', { class: 'cutoff-now-sub muted' });
  const setDraft = (patch) => { draft = { ...draft, ...patch }; draft.x = state.normalizeX(draft.x, draft.t); syncDraft(); };
  const stepBtn = (dir) => ui.el('button', { type: 'button', class: 'btn cutoff-step', 'aria-label': dir < 0 ? V.prev : V.next, title: dir < 0 ? V.prev : V.next, onClick: () => {
    const cur = draft.t ?? last;
    const to = dir < 0 ? [...stops].reverse().find((m) => m < cur) ?? first : stops.find((m) => m > cur) ?? last;
    setDraft({ t: to });
  } }, dir < 0 ? '‹' : '›');
  const prevBtn = stepBtn(-1);
  const nextBtn = stepBtn(1);
  // 사이트 수록분 끝 — 늘 둔다(하단 [전부 보기]를 대신한다, 사용자 2026-10-10). 메인이 마지막이면 그 챕터 자리
  const endSub = latest ? `${fmt.tickShort(lastMain.tick)} 뒤 ${afterMain}편` : fmt.tickShort(last);
  const latestBtn = ui.el('button', { type: 'button', class: 'btn cutoff-latest', title: V.latestHelp(endSub, idx.ticks.get(last)?.date ?? ''), onClick: () => setDraft({ t: last }) },
    V.latest, ui.el('span', { class: 'muted' }, ` · ${endSub}`));
  // 칸 — 종류로 픽업 이벤트(필그림 · 오버스펙 픽업) · 사이드(W16a) · 이벤트 · 호감도(W16b, 사용자 2026-10-14). 메인 위치와 상관없이 고른다(게임에서 아무 때나 볼 수 있다).
  // 이벤트 유실물 · 미니게임은 칸이 없고 딸린 이벤트를 따른다(state.pickable). 갈래마다 [모두 선택] [모두 해제] — x에 갈래 통째(@갈래)로 적는다
  // 칸 · 갈래 머리에도 감상 순서와 같은 종류 표식(이벤트 ◇ · 주년 · 신년 · 여름 이벤트 ✦ · 주년 케이크 · 사이드 · 호감도는 니케 초상)
  const exIcon = (u) => {
    if (!u) return null;
    // 호감도는 감상 순서 줄처럼 그 니케 초상(없으면 종류 아이콘) — 칸이 193이라 lazy로 접힌 묶음을 열 때 받는다
    const face = u.kind === 'episode' ? fmt.episodeIcon(u) : null;
    return face ? ui.portrait(face, { size: 22, class: 'cutoff-ex-face' }) : ui.kindIcon(u.kind, { size: 15, unit: u, class: 'cutoff-ex-icon' });
  };
  const deco = (n) => { if (n) { n.removeAttribute('role'); n.removeAttribute('aria-label'); n.setAttribute('aria-hidden', 'true'); } return n; }; // 머리 글자가 이름이라 그림은 장식
  const HEAD_ICON = { major: { kind: 'event', pickup: true }, side: { kind: 'side' }, event: { kind: 'event' }, episode: { kind: 'episode' } };
  const headIcon = (g) => (HEAD_ICON[g] ? deco(ui.kindIcon(HEAD_ICON[g].kind, { size: 15, pickup: HEAD_ICON[g].pickup })) : null);
  const box = (e) => {
    const input = ui.el('input', { type: 'checkbox', dataset: { key: e.key } });
    input.addEventListener('change', () => setDraft({ t: draft.t ?? last, x: { ...draft.x, [e.key]: input.checked } }));
    const u = idx.units.get(e.key);
    const at = idx.ticks.get(e.tick)?.upto;
    return ui.el('label', { class: 'cutoff-ex' }, input,
      ui.el('span', { class: 'cutoff-ex-title' }, exIcon(u), u?.title ?? e.key),
      ui.el('span', { class: 'cutoff-ex-sub muted' }, at ? `${fmt.tickShort(idx.mainTicks.find((m) => m.main === at)?.tick)} 뒤` : ''));
  };
  const groupBoxes = new Map(state.GROUPS.map((g) => [g, extras.filter((e) => e.group === g).map(box)]));
  const boxes = [...groupBoxes.values()].flat();
  const counts = new Map(); // 갈래 → 본 것 n/N 글
  const setGroup = (g, on) => {
    const x = Object.fromEntries(Object.entries(draft.x).filter(([k]) => idx.units.get(k)?.group !== g));
    setDraft({ t: draft.t ?? last, x: { ...x, [`@${g}`]: on } });
  };
  // 이벤트 · 호감도는 칸이 많아 접어 둔다(머리에 본 것 수). 픽업 이벤트 · 사이드는 펼친다
  const exSec = (g) => {
    const list = groupBoxes.get(g);
    if (!list.length) return null;
    const G = V.groups[g];
    const count = ui.el('span', { class: 'cutoff-sec-count muted' });
    counts.set(g, count);
    const acts = ui.el('span', { class: 'cutoff-sec-acts' },
      ui.el('button', { type: 'button', class: 'link-btn', onClick: () => setGroup(g, true) }, V.allOn),
      ui.el('button', { type: 'button', class: 'link-btn', onClick: () => setGroup(g, false) }, V.allOff));
    const grid = ui.el('div', { class: 'cutoff-exs' }, list);
    if (G.fold) return ui.el('details', { class: 'details cutoff-sec cutoff-fold' }, ui.el('summary', {}, headIcon(g), G.head, count), ui.el('div', { class: 'cutoff-fold-acts' }, acts), grid);
    return ui.el('section', { class: 'cutoff-sec' }, ui.el('h3', {}, ui.el('span', { class: 'cutoff-sec-name' }, headIcon(g), G.head), G.hint ? ui.el('span', { class: 'cutoff-sec-hint muted' }, G.hint) : null, count, acts), grid);
  };
  /** 메인 위치(t)와 다르게 고른 스토리 수 — 더 본 것(t 뒤인데 봄) · 안 본 것(t 안인데 안 봄) */
  const exDiff = (s) => {
    const t = s.t ?? null;
    if (t == null) return { plus: 0, minus: 0 };
    const R = state.reading(s);
    let plus = 0;
    let minus = 0;
    for (const e of extras) {
      const dflt = e.tick == null || e.tick <= t;
      if (R.seen(e.key) && !dflt) plus++;
      else if (!R.seen(e.key) && dflt) minus++;
    }
    return { plus, minus };
  };
  const laterBtn = ui.el('button', { type: 'button', class: 'btn btn-quiet', onClick: () => close(false) }, V.later);
  const okBtn = ui.el('button', { type: 'button', class: 'btn btn-guard', onClick: commit }, V.ok);
  const editPane = ui.el('div', { class: 'cutoff-edit' },
    ui.el('div', { class: 'cutoff-dlg-head' },
      ui.el('h2', { id: 'cutoff-dlg-title' }, V.ask),
      ui.el('button', { type: 'button', class: 'btn cutoff-dlg-x', 'aria-label': V.close, onClick: () => close(false) }, ui.icon('close'))),
    ui.el('p', { class: 'cutoff-dlg-help muted' }, V.help),
    ui.el('section', { class: 'cutoff-sec' },
      ui.el('h3', {}, V.mainHead),
      ui.el('div', { class: 'cutoff-now' }, prevBtn, ui.el('output', { for: 'cutoff-slider', class: 'cutoff-now-read' }, nowName, nowSub), nextBtn),
      slider, list, ui.el('div', { class: 'cutoff-latest-row' }, latestBtn)),
    ui.el('p', { class: 'cutoff-ex-help muted' }, V.exHint),
    state.GROUPS.map(exSec),
    ui.el('div', { class: 'cutoff-dlg-foot' }, ui.el('span', { class: 'cutoff-foot-gap' }), laterBtn, okBtn),
    ui.el('p', { class: 'cutoff-ai' }, fmt.AI_NOTE.full));
  dlg.append(editPane, confirmPane);
  document.body.append(dlg);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(false); });
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (!confirmPane.hidden) showConfirm(false); // 재확인 중 Esc는 고르던 화면으로 돌아간다
    else close(false);
  });
  function showConfirm(on) {
    confirmPane.hidden = !on;
    editPane.hidden = on;
    dlg.setAttribute('aria-labelledby', on ? 'cutoff-confirm-title' : 'cutoff-dlg-title');
    (on ? confirmOk : okBtn).focus();
  }

  const fill = (v) => slider.style.setProperty('--fill', `${last > first ? ((v - first) / (last - first)) * 100 : 0}%`);
  const showNow = (t) => {
    if (t == null) { nowName.textContent = fmt.TERM.showAll; nowSub.textContent = ''; return; }
    const tk = idx.ticks.get(t);
    const mainAt = tk?.main ?? tk?.upto;
    nowName.textContent = t === latest ? V.latest : tk?.main ? fmt.unitTitle(tk.main) : fmt.tickLabel(t, { date: false });
    nowSub.textContent = [tk?.main ? null : mainAt ? `${fmt.unitTitle(mainAt)} 뒤` : null, tk?.date].filter(Boolean).join(' · ');
    slider.setAttribute('aria-valuetext', t === latest ? `${V.latest} · ${tk?.date ?? ''}` : fmt.tickLabel(t));
    fill(t);
  };
  // 팝업 안 — 초안을 보인다
  function syncDraft() {
    const t = draft.t;
    const R = state.reading(draft);
    slider.value = t ?? last;
    showNow(t);
    prevBtn.disabled = t != null && t <= first;
    nextBtn.disabled = t == null || t >= last;
    latestBtn.setAttribute('aria-pressed', String(t === last));
    for (const b of boxes) {
      const input = b.querySelector('input');
      input.checked = R.seen(input.dataset.key);
      const tick = idx.units.get(input.dataset.key)?.tick;
      b.classList.toggle('is-diff', t != null && input.checked !== (tick == null || tick <= t)); // 메인 위치와 다르게 고른 칸 — 제목 뒤 점
    }
    for (const [g, el] of counts) {
      const list = extras.filter((e) => e.group === g);
      el.textContent = V.groupCount(list.filter((e) => R.seen(e.key)).length, list.length);
    }
  }
  // 상단 단추 — 적용된 값을 보인다
  const sync = (s) => {
    const t = s.t;
    value.textContent = short(t);
    const { plus, minus } = exDiff(s);
    extraEl.textContent = t != null && (plus || minus) ? V.exBadge(plus, minus) : '';
    extraEl.title = extraEl.textContent ? V.exBadgeHelp(plus, minus) : '';
    dateEl.textContent = t == null ? '' : idx.ticks.get(t)?.date ?? '';
    btn.classList.toggle('is-off', t == null);
    btn.setAttribute('aria-label', `${fmt.TERM.cutoff}: ${t == null ? fmt.TERM.showAll : t === latest ? V.latest : fmt.tickLabel(t)}${extraEl.textContent ? ` (${extraEl.textContent})` : ''} — ${V.open}`);
  };
  slider.addEventListener('input', () => showNow(Number(slider.value)));
  slider.addEventListener('change', () => setDraft({ t: Number(slider.value) }));
  const open = () => {
    laterBtn.hidden = !firstVisit;
    draft = pick(state.get());
    showConfirm(false);
    syncDraft();
    dlg.showModal();
    slider.focus();
  };
  btn.addEventListener('click', () => open());
  // 탭의 'CH.xx까지 읽음으로' 같은 단추 — 더 보이게 되면 바로 재확인 화면으로, 아니면 그대로 적용
  state.onAskCutoff((patch) => {
    const s = state.get();
    draft = pick({ t: 't' in patch ? patch.t : s.t, x: 'x' in patch ? patch.x : s.x });
    draft.x = state.normalizeX(draft.x, draft.t);
    if (!newlySeen()) { state.set({ t: draft.t, x: draft.x }); return; }
    laterBtn.hidden = true;
    syncDraft();
    dlg.showModal();
    commit();
  });
  sync(state.get());
  state.subscribe((s, changed) => { if (changed.has('t')) sync(s); });

  let later = false;
  try { later = Boolean(sessionStorage.getItem(FV_LATER_KEY)); } catch { /* 없음 */ }
  if (firstVisit && !later) open();
  else firstVisit = false;
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
  $('#ai-note').textContent = fmt.AI_NOTE.full;
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

async function boot() {
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
  fmt.useReading(() => state.reading());
  const ch00 = idx.mainTicks.find((t) => t.main === 'ch00')?.tick ?? idx.tickList[0]?.tick ?? 1;
  const firstVisit = !state.cutoffChosen(); // init이 URL에 t를 쓰기 전에 본다
  state.configure({ units: idx.units });
  state.init({ defaultCutoff: ch00 });
  cutoffControl(idx, firstVisit);
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
    else if (changed.has('t') && s.sel) reader.open(s.sel); // 여기까지 읽음이 바뀌면 리더의 가림도 다시
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
