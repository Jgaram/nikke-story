/**
 * 상단 검색(W1) — 입력 하나로 스토리 · 인물 · 세계(대상) · 떡밥 · 분석 메모 문장 · 공개 개요(줄거리, W10). 대사 본문 검색은 없다(공개 규칙).
 * 메모 문장(records*.json) · 개요(synopsis.json)는 처음 검색할 때 받는다(지연 로드). 결과는 종류별 묶음, 최대 50건(줄거리는 10건), 입력 디바운스 150ms.
 * 줄거리 결과는 스토리 제목 + 맞은 곳 앞뒤 글 — 여기까지 읽음 뒤 스토리는 맞은 글을 보이지 않고 "스포일러"만 붙인다.
 * 키보드: ↑ ↓ 이동 · Enter 열기 · Esc 닫기. 고르면 `state.set({ sel, tab })` — unit → 감상 순서, person → 인물, target → 세계, thread → 떡밥, record → 지금 탭.
 *
 *   init({ input, container, state, data, fmt, ui })
 */
const MAX = 50;
const GROUPS = [
  ['unit', '스토리'], ['person', '인물'], ['target', '세계'], ['thread', '떡밥'], ['record', '분석 메모'], ['synopsis', '줄거리'],
];
const MAX_SYNOPSIS = 10;
const TAB_FOR = { unit: 'order', synopsis: 'order', person: 'persons', target: 'world', thread: 'threads' };

let entries = null;
let recordEntries = null;
let recordsLoading = null;
let synopsisEntries = null;
let synopsisLoading = null;

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, '');

export function init({ input, container, state, data, fmt, ui }) {
  let active = -1;
  let items = [];
  let timer = null;

  const build = (idx) => {
    entries = [];
    for (const u of idx.unitList) entries.push({ type: 'unit', sel: `unit:${u.key}`, label: u.title, sub: `${fmt.KIND[u.kind]?.label ?? u.kind} · ${fmt.tickShort(u.tick)}`, keys: [norm(u.title), norm(u.key), norm(u.name)] });
    for (const t of idx.targetList) {
      const type = t.type === 'person' ? 'person' : 'target';
      entries.push({ type, sel: `${type}:${t.id}`, label: t.name, sub: `${fmt.TARGET_TYPE[t.type] ?? t.type}${t.kind ? ` · ${t.kind}` : ''}`, keys: [norm(t.name), ...(t.aliases ?? []).map((a) => norm(a.name)), norm(t.id)] });
    }
    for (const j of idx.threadList) entries.push({ type: 'thread', sel: `thread:${j.id}`, label: j.title, sub: `${fmt.THREAD_WEIGHT[j.weight]?.label ?? j.weight} · 의문 ${j.questions?.length ?? 0}`, keys: [norm(j.title), norm(j.text), norm(j.id)] });
  };
  const buildRecords = (idx) => {
    recordEntries = idx.recordList.map((r) => ({ type: 'record', sel: `record:${r.id}`, label: fmt.recordText(r), sub: `${fmt.recordLabel(r)} · ${fmt.unitTitle(r.unit)}`, id: r.id, tick: r.tick, keys: [norm(r.id), norm(fmt.recordText(r))] }));
  };

  const buildSynopsis = (idx, list) => {
    synopsisEntries = list.map((x) => {
      const u = idx.units.get(x.key);
      const text = [x.logline, x.synopsis, ...Object.values(x.scenes ?? {})].join(' ');
      return { type: 'synopsis', sel: `unit:${x.key}`, label: u?.title ?? x.key, text, tick: u?.tick, keys: [norm(text)] };
    });
  };
  /** 줄거리에서 맞은 곳 앞뒤 — 띄어쓰기가 달라 못 찾으면 앞머리 */
  const snippet = (text, q) => {
    const i = text.toLowerCase().indexOf(String(q).trim().toLowerCase());
    const a = Math.max(0, i - 16);
    const s = i < 0 ? text.slice(0, 40) : text.slice(a, i + String(q).trim().length + 24);
    return `${i > 16 ? '…' : ''}${s.replace(/\s+/g, ' ')}…`;
  };

  const search = (q) => {
    const n = norm(q);
    if (!n) return [];
    const score = (e) => {
      let best = 0;
      for (const k of e.keys) {
        if (!k) continue;
        if (k === n) return 3;
        if (k.startsWith(n)) best = Math.max(best, 2);
        else if (k.includes(n)) best = Math.max(best, 1);
      }
      return best;
    };
    const hits = [];
    for (const e of [...entries, ...(recordEntries ?? [])]) {
      const s = score(e);
      if (s) hits.push({ e, s });
    }
    hits.sort((a, b) => b.s - a.s || GROUPS.findIndex((g) => g[0] === a.e.type) - GROUPS.findIndex((g) => g[0] === b.e.type) || a.e.label.length - b.e.label.length);
    // 줄거리는 따로 — 흔한 이름이면 수백 편이 맞아 다른 결과를 밀어내지 않게 읽는 순서로 MAX_SYNOPSIS까지
    const syn = n.length < 2 ? [] : (synopsisEntries ?? []).filter((e) => e.keys[0].includes(n)).slice(0, MAX_SYNOPSIS);
    return [...hits.slice(0, MAX).map((h) => h.e), ...syn];
  };

  const close = () => {
    container.hidden = true;
    ui.clear(container);
    items = [];
    active = -1;
    input.setAttribute('aria-expanded', 'false');
  };
  const choose = (e) => {
    const tab = TAB_FOR[e.type];
    state.set({ sel: e.sel, ...(tab ? { tab } : {}) });
    close();
  };
  const render = (q) => {
    const list = search(q);
    ui.clear(container);
    items = list;
    active = -1;
    if (!list.length && !recordsLoading && !synopsisLoading) {
      if (!q) return close();
      container.append(ui.empty('결과 없음'));
    }
    const t = state.get().t;
    let i = 0;
    for (const [type, label] of GROUPS) {
      const group = list.filter((e) => e.type === type);
      if (!group.length) continue;
      container.append(ui.el('div', { class: 'search-group', role: 'presentation' }, label));
      for (const e of group) {
        const k = i++;
        const after = e.tick != null && !state.visible(e.tick, t);
        const node = ui.el('div', { class: ['search-item', after ? 'after-cutoff' : ''], role: 'option', id: `search-opt-${k}`, 'aria-selected': 'false', dataset: { i: String(k) }, onMousedown: (ev) => { ev.preventDefault(); choose(e); } },
          ui.el('span', { class: 'search-label' }, e.label),
          ui.el('span', { class: 'search-sub' }, e.type === 'synopsis' ? (after ? '스포일러 — 여기까지 읽음 뒤 스토리' : snippet(e.text, q)) : e.sub, e.type !== 'synopsis' && after ? ' · 스포일러' : null, e.id ? [' · ', ui.el('span', { class: 'mono' }, e.id)] : null));
        container.append(node);
      }
    }
    if (recordsLoading || synopsisLoading) container.append(ui.spinner('불러오는 중…'));
    container.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const move = (d) => {
    const nodes = [...container.querySelectorAll('.search-item')];
    if (!nodes.length) return;
    active = (active + d + nodes.length) % nodes.length;
    nodes.forEach((n, i) => n.setAttribute('aria-selected', String(i === active)));
    nodes[active].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', nodes[active].id);
  };

  const run = async () => {
    const q = input.value;
    state.set({ q }, { replace: true });
    const idx = await data.index();
    if (!entries) build(idx);
    if (q && !recordEntries && !recordsLoading) {
      recordsLoading = idx.withRecords().then(() => { buildRecords(idx); recordsLoading = null; if (input.value) render(input.value); }).catch(() => { recordsLoading = null; });
    }
    if (q && !synopsisEntries && !synopsisLoading) {
      synopsisLoading = data.load('synopsis').then((list) => { buildSynopsis(idx, list); synopsisLoading = null; if (input.value) render(input.value); }).catch(() => { synopsisLoading = null; synopsisEntries = []; });
    }
    render(q);
  };

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', container.id);
  container.setAttribute('role', 'listbox');
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 150);
  });
  input.addEventListener('focus', () => { if (input.value) run(); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (container.hidden) run(); else move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { if (active >= 0 && items.length) { e.preventDefault(); const nodes = [...container.querySelectorAll('.search-item')]; const i = Number(nodes[active]?.dataset.i); if (items[i]) choose(items[i]); } }
    else if (e.key === 'Escape') { close(); input.blur(); }
  });
  const q0 = state.get().q;
  if (q0) input.value = q0;
}
