/**
 * URL 상태(W1) — 해시 하나에 모든 상태를 싣는다: `#tab=order&t=20&layers=1,2&q=라피&sel=unit:ch07&p.kind=event`
 * 링크를 복사하면 같은 화면이 열리고, 뒤로 가기가 된다(set은 history를 쌓고, replace는 덮는다).
 *
 * 키
 *   tab     order | links | threads | persons | chrono | world
 *   t       컷오프 공개 자리(숫자) · 'all'(끔). 처음 열면 CH.00의 자리(공개 사이트라 기본 켬 — W0). 바꾼 값은 localStorage에 남아 다음 방문에 쓴다
 *   layers  층 거르개 '1,2' (없으면 셋 다)
 *   q       검색어
 *   sel     선택 '종류:ID' — unit:ch07 · scene:d_main_07_02 · record:F203 · person:person:라피 · target:place:방주 · thread:J1 · tick:20
 *           있으면 리더 패널이 열린다. 첫 콜론까지가 종류, 나머지가 ID(ID에 콜론이 있어도 된다)
 *   p.<key> 탭 자기 파라미터 — 지금 탭의 것. 탭을 바꾸면 지워진다(새 탭의 p를 patch에 같이 주면 그것이 남는다)
 *
 * API
 *   init({ defaultCutoff })          부팅 때 한 번 — URL · localStorage · 기본값을 합쳐 URL을 정리한다(replace)
 *   get()                            { tab, t, layers, q, sel, p } — t는 number | null(= 전부), layers는 number[], p는 { key: string }
 *   set(patch, { replace })          patch: { tab, t('all' | number | null), layers(array | 'a,b'), q, sel, p({ key: value } — value null이면 지움) }
 *   subscribe(fn) → unsubscribe      fn(state, changed: Set<'tab'|'t'|'layers'|'q'|'sel'|'p'>) — 바뀐 키만 들어 있다
 *   param(tab, key) / setParam(tab, key, value, { replace })   탭 파라미터(tab이 지금 탭이 아니면 undefined · 무시)
 *   parseSel(sel) → { type, id } | null,  makeSel(type, id)
 *   visible(tick) → boolean          컷오프 안인가(t가 null이면 늘 true)
 */
export const TABS = ['order', 'links', 'threads', 'persons', 'chrono', 'world'];
export const ALL_LAYERS = [1, 2, 3];
const STORAGE_T = 'nikke-story.t';

let state = { tab: 'order', t: null, layers: ALL_LAYERS, q: '', sel: '', p: {} };
let defaultCutoff = 1;
const listeners = new Set();

function readStorage() {
  try {
    const v = localStorage.getItem(STORAGE_T);
    if (v === 'all') return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}
function writeStorage(t) {
  try {
    localStorage.setItem(STORAGE_T, t == null ? 'all' : String(t));
  } catch {
    /* 사적 창 등 — 기억 못 해도 동작한다 */
  }
}

function parseT(v) {
  if (v === 'all') return null;
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}
function parseLayers(v) {
  if (Array.isArray(v)) return normLayers(v);
  if (v == null || v === '') return ALL_LAYERS;
  return normLayers(String(v).split(','));
}
function normLayers(xs) {
  const out = ALL_LAYERS.filter((l) => xs.map(Number).includes(l));
  return out.length ? out : ALL_LAYERS;
}

function parseHash(hash) {
  const sp = new URLSearchParams(hash.replace(/^#/, ''));
  const p = {};
  for (const [k, v] of sp) if (k.startsWith('p.') && k.length > 2) p[k.slice(2)] = v;
  const t = parseT(sp.get('t'));
  return {
    tab: TABS.includes(sp.get('tab')) ? sp.get('tab') : 'order',
    t: t === undefined ? undefined : t,
    layers: parseLayers(sp.get('layers')),
    q: sp.get('q') ?? '',
    sel: sp.get('sel') ?? '',
    p,
  };
}

function toHash(s) {
  const sp = new URLSearchParams();
  sp.set('tab', s.tab);
  sp.set('t', s.t == null ? 'all' : String(s.t));
  if (s.layers.length !== ALL_LAYERS.length) sp.set('layers', s.layers.join(','));
  if (s.q) sp.set('q', s.q);
  if (s.sel) sp.set('sel', s.sel);
  for (const [k, v] of Object.entries(s.p)) if (v != null && v !== '') sp.set(`p.${k}`, String(v));
  return `#${sp.toString().replace(/(%[0-9A-F]{2})+/gi, (m) => { try { const d = decodeURIComponent(m); return /[&=#%+?\s]/.test(d) ? m : d; } catch { return m; } })}`;
}

function diff(a, b) {
  const changed = new Set();
  for (const k of ['tab', 't', 'q', 'sel']) if (a[k] !== b[k]) changed.add(k);
  if (a.layers.join() !== b.layers.join()) changed.add('layers');
  if (JSON.stringify(a.p) !== JSON.stringify(b.p)) changed.add('p');
  return changed;
}

function notify(prev) {
  const changed = diff(prev, state);
  if (!changed.size) return;
  const snapshot = get();
  for (const fn of listeners) {
    try {
      fn(snapshot, changed);
    } catch (err) {
      console.error('state 구독자 오류', err);
    }
  }
}

/** 부팅 때 한 번. 그 뒤 hashchange(뒤로 가기)도 여기서 받는다 */
export function init({ defaultCutoff: d = 1 } = {}) {
  defaultCutoff = d;
  const parsed = parseHash(location.hash);
  const stored = readStorage();
  state = { ...parsed, t: parsed.t !== undefined ? parsed.t : stored !== undefined ? stored : defaultCutoff };
  history.replaceState(null, '', toHash(state));
  window.addEventListener('hashchange', () => {
    const prev = state;
    const next = parseHash(location.hash);
    state = { ...next, t: next.t === undefined ? prev.t : next.t };
    notify(prev);
  });
  return get();
}

export function get() {
  return { ...state, layers: [...state.layers], p: { ...state.p } };
}

export function set(patch, { replace = false } = {}) {
  const prev = state;
  const next = { ...state, p: { ...state.p } };
  if ('tab' in patch && TABS.includes(patch.tab) && patch.tab !== state.tab) {
    next.tab = patch.tab;
    next.p = {}; // 탭 파라미터는 탭의 것
  }
  if ('t' in patch) {
    const t = patch.t === null ? null : parseT(patch.t);
    if (t !== undefined) {
      next.t = t;
      writeStorage(t);
    }
  }
  if ('layers' in patch) next.layers = parseLayers(patch.layers);
  if ('q' in patch) next.q = patch.q ?? '';
  if ('sel' in patch) next.sel = patch.sel ?? '';
  if (patch.p && typeof patch.p === 'object') {
    for (const [k, v] of Object.entries(patch.p)) {
      if (v == null || v === '') delete next.p[k];
      else next.p[k] = String(v);
    }
  }
  state = next;
  const hash = toHash(state);
  if (hash !== location.hash) {
    if (replace) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
  }
  notify(prev);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function param(tab, key) {
  return state.tab === tab ? state.p[key] : undefined;
}
export function setParam(tab, key, value, opts = { replace: true }) {
  if (state.tab !== tab) return;
  set({ p: { [key]: value } }, opts);
}

export function parseSel(sel) {
  if (!sel || typeof sel !== 'string') return null;
  const i = sel.indexOf(':');
  if (i <= 0) return null;
  return { type: sel.slice(0, i), id: sel.slice(i + 1) };
}
export const makeSel = (type, id) => `${type}:${id}`;

/** 공개 자리 tick이 컷오프 안인가. tick이 없으면(공개일 모름) 보인다 */
export function visible(tick, t = state.t) {
  return t == null || tick == null || tick <= t;
}

/** 컷오프를 끄기 전의 값(전부 보기를 풀 때 돌아갈 자리) */
export function lastCutoff() {
  const stored = readStorage();
  return typeof stored === 'number' ? stored : defaultCutoff;
}
export const defaults = () => ({ cutoff: defaultCutoff });
