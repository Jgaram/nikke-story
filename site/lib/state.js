/**
 * URL 상태(W1) — 해시 하나에 모든 상태를 싣는다: `#tab=order&t=20&layers=1,2&q=라피&sel=unit:ch07&p.kind=event`
 * 링크를 복사하면 같은 화면이 열리고, 뒤로 가기가 된다(set은 history를 쌓고, replace는 덮는다).
 *
 * 키
 *   tab     order | links | threads | chrono | persons | world
 *   t       컷오프 공개 자리(숫자) · 'all'(끔). 처음 열면 CH.00의 자리(공개 사이트라 기본 켬 — W0). 바꾼 값은 localStorage에 남아 다음 방문에 쓴다
 *   x       척추 이벤트 · 사이드(units.json spine이고 메인이 아닌 것)의 '봤음' 예외 '키,-키'(앞에 -면 안 봄) — 기본은 t를 따르고(tick ≤ t면 봤음), 여기 적힌 것만 다르다.
 *           순서대로 안 보는 사람(뉴비)을 위해(사용자, 2026-10-10). t가 바뀌면 새 기본과 같아진 예외는 지운다. localStorage에도 남는다
 *   layers  늘 [1, 2, 3] — 범위 필터는 뺐다(URL의 layers는 무시)
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
 *   visible(tick) → boolean          컷오프 안인가(t가 null이면 늘 true) — 단위 · 기록이 아니라 자리만 있을 때(축 · 눈금)
 *   configure({ units })             부팅 때 한 번 — idx.units(키 → { tick, kind, spine })
 *   seen(unitKey) → boolean          그 스토리를 봤나: 전부 보기면 늘 · 척추 이벤트 · 사이드는 x 예외 우선 · 그 밖은 tick ≤ t(모르는 키 · tick 없음은 봤음)
 *   seenAny(keys) → boolean          하나라도 봤나
 *   known(record) → boolean          그 기록을 아나: 사실 · 의문은 know_units(없으면 [unit]) 중 하나라도 봤으면, 그 밖은 seen(unit)(unit 없으면 visible(tick))
 *   reading(s?) → R                  { all, t, x, seen, seenAny, known } — fmt.stateAt(r, R) · fmt.gradeAt(u, R)에 T 대신 넘긴다
 *   spineExtras() → [{ key, tick }]  척추 이벤트 · 사이드(팝업 체크 칸)
 *   askCutoff({ t?, x? })            탭에서 여기까지 읽음을 바꿀 때 — 팝업의 재확인을 거친다(onAskCutoff(fn)로 app.js가 받는다)
 *   normalizeX(x, t)                 x에서 t의 기본과 같은 예외를 뺀 것(set과 같은 정리 — 팝업 초안)
 *   구독자의 changed에 't'가 있으면 t나 x가 바뀐 것이다(여기까지 읽음이 바뀜). x만 바뀌어도 't'와 'x'가 같이 든다
 *   cutoffChosen()                   URL에 t가 실려 왔거나 localStorage에 고른 컷오프가 있나 — init() **전에** 불러야 한다(init이 URL에 t를 쓴다). 첫 방문 선택 바가 쓴다
 */
export const TABS = ['order', 'links', 'threads', 'chrono', 'persons', 'world'];
export const ALL_LAYERS = [1, 2, 3];
const STORAGE_T = 'nikke-story.t';
const STORAGE_X = 'nikke-story.x';

let state = { tab: 'order', t: null, x: {}, layers: ALL_LAYERS, q: '', sel: '', p: {} };
let units = new Map();
let extras = []; // 척추 이벤트 · 사이드 [{ key, tick }]
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

/** 'x' 문자열 'a,-b' ↔ { a: true, b: false }(앞에 '-'면 안 봄, 없으면 봄 — '+'는 URL에서 공백이 되어 안 쓴다). 척추 이벤트 · 사이드 키만(units를 받기 전에는 다 받는다) */
function parseX(v) {
  const out = {};
  if (v == null || v === '') return out;
  for (const part of String(v).split(',')) {
    const off = part.startsWith('-');
    const key = off ? part.slice(1) : part.replace(/^\+/, '');
    if (!key) continue;
    if (extras.length && !extras.some((e) => e.key === key)) continue;
    out[key] = !off;
  }
  return out;
}
const xString = (x) => Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${v ? '' : '-'}${k}`).join(',');
/** t의 기본과 같은 예외는 지운다 */
function pruneX(x, t) {
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    const u = units.get(k);
    const dflt = t == null || u?.tick == null || u.tick <= t;
    if (v !== dflt) out[k] = v;
  }
  return out;
}
function readStorageX() {
  try { return parseX(localStorage.getItem(STORAGE_X)); } catch { return {}; }
}
function writeStorageX(x) {
  try { const v = xString(x); v ? localStorage.setItem(STORAGE_X, v) : localStorage.removeItem(STORAGE_X); } catch { /* 없음 */ }
}

function parseT(v) {
  if (v === 'all') return null;
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}
// 범위(층) 필터는 상단 바에서 뺐다(사용자, 2026-10-10 — 탭의 등급 · 종류 필터와 겹친다). 늘 셋 다 — 옛 URL의 layers는 무시한다.
function parseLayers() { return ALL_LAYERS; }

function parseHash(hash) {
  const sp = new URLSearchParams(hash.replace(/^#/, ''));
  const p = {};
  for (const [k, v] of sp) if (k.startsWith('p.') && k.length > 2) p[k.slice(2)] = v;
  const t = parseT(sp.get('t'));
  return {
    tab: TABS.includes(sp.get('tab')) ? sp.get('tab') : 'order',
    t: t === undefined ? undefined : t,
    x: sp.has('x') ? parseX(sp.get('x')) : undefined,
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
  if (s.t != null && Object.keys(s.x).length) sp.set('x', xString(s.x));
  if (s.q) sp.set('q', s.q);
  if (s.sel) sp.set('sel', s.sel);
  for (const [k, v] of Object.entries(s.p)) if (v != null && v !== '') sp.set(`p.${k}`, String(v));
  return `#${sp.toString().replace(/(%[0-9A-F]{2})+/gi, (m) => { try { const d = decodeURIComponent(m); return /[&=#%+?\s]/.test(d) ? m : d; } catch { return m; } })}`;
}

function diff(a, b) {
  const changed = new Set();
  for (const k of ['tab', 't', 'q', 'sel']) if (a[k] !== b[k]) changed.add(k);
  if (xString(a.x) !== xString(b.x)) changed.add('x').add('t'); // 탭은 't'만 들어도 여기까지 읽음을 다시 그린다
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
  const t = parsed.t !== undefined ? parsed.t : stored !== undefined ? stored : defaultCutoff;
  // x: URL에 t가 있으면 URL의 x(없으면 예외 없음), 아니면 저장된 x
  const x = pruneX(parsed.t !== undefined ? parsed.x ?? {} : readStorageX(), t);
  state = { ...parsed, t, x };
  history.replaceState(null, '', toHash(state));
  window.addEventListener('hashchange', () => {
    const prev = state;
    const next = parseHash(location.hash);
    const nt = next.t === undefined ? prev.t : next.t;
    state = { ...next, t: nt, x: pruneX(next.x ?? (next.t === undefined ? prev.x : {}), nt) };
    notify(prev);
  });
  return get();
}

export function get() {
  return { ...state, x: { ...state.x }, layers: [...state.layers], p: { ...state.p } };
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
  if ('x' in patch || 't' in patch) {
    const x = 'x' in patch ? (typeof patch.x === 'string' ? parseX(patch.x) : { ...(patch.x ?? {}) }) : next.x;
    next.x = pruneX(x, next.t);
    writeStorageX(next.x);
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

export function configure({ units: u } = {}) {
  units = u instanceof Map ? u : new Map();
  extras = [...units.values()].filter((x) => x.spine && x.kind !== 'main').map((x) => ({ key: x.key, tick: x.tick })).sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));
}
/** 탭에서 여기까지 읽음을 바꾸는 단추는 set 대신 이것을 부른다 — 상단 팝업이 받아 더 보이게 되면 재확인을 거친다(사용자, 2026-10-10). 받는 쪽이 없으면 바로 set */
let cutoffAsker = null;
export const onAskCutoff = (fn) => { cutoffAsker = fn; };
export function askCutoff(patch) {
  if (cutoffAsker) cutoffAsker(patch);
  else set(patch);
}
/** x에서 t의 기본과 같은 예외를 뺀 것 — set이 하는 정리와 같다(팝업 초안이 쓴다) */
export const normalizeX = (x, t) => pruneX(x ?? {}, t);
export const spineExtras = () => extras.map((e) => ({ ...e }));

/** 여기까지 읽음 판정 묶음 — s를 주면 그 상태로(구독자가 받은 snapshot) */
export function reading(s = state) {
  const t = s.t;
  const x = s.x ?? {};
  const all = t == null;
  const seen = (key) => {
    if (all) return true;
    if (key != null && key in x) return x[key];
    const u = units.get(key);
    return u?.tick == null || u.tick <= t;
  };
  const seenAny = (keys) => all || (Array.isArray(keys) && keys.some(seen));
  const known = (r) => {
    if (all || !r) return true;
    if (r.kind === 'F' || r.kind === 'Q') return seenAny(r.know_units ?? (r.unit ? [r.unit] : [])) || (!r.unit && !r.know_units && visible(r.tick, t));
    return r.unit ? seen(r.unit) : visible(r.tick, t);
  };
  return { all, t, x, seen, seenAny, known };
}
export const seen = (key) => reading().seen(key);
export const seenAny = (keys) => reading().seenAny(keys);
export const known = (r) => reading().known(r);

/** 처음 방문인가의 반대 — URL의 t 또는 저장된 컷오프가 있다. init() 전에만 뜻이 있다 */
export function cutoffChosen() {
  if (parseT(new URLSearchParams(location.hash.replace(/^#/, '')).get('t')) !== undefined) return true;
  return readStorage() !== undefined;
}

/** 컷오프를 끄기 전의 값(전부 보기를 풀 때 돌아갈 자리) */
export function lastCutoff() {
  const stored = readStorage();
  return typeof stored === 'number' ? stored : defaultCutoff;
}
export const defaults = () => ({ cutoff: defaultCutoff });
