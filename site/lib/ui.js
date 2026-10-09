/**
 * 공용 컴포넌트(W1) — 접근성(키보드 · aria) 기본값 포함. 스타일은 style.css의 같은 이름 클래스.
 *
 *   configure({ navigate })                     link()가 쓸 이동 함수(app.js가 state.set({ sel })를 넘긴다)
 *   el(tag, attrs, ...children)                 attrs: class · id · dataset{} · style{} · aria-* · on<Event>(함수) · 그 밖 속성. children: 문자열 · 노드 · 배열 · null
 *   clear(node)
 *   chip(kind, value, label?)                   kind: 'kind' | 'grade' | 'layer' | 'state' | 'record' | 'confidence' | 'plain' → span.chip (색은 CSS 변수, 글자·툴팁은 format.js의 라벨 · 정의)
 *   legend(items)                               [{ label, color }] → div.legend
 *   table({ columns, rows, sortable, pageSize, onRow, rowKey, selected, empty, caption }) → { el, update(rows), setSelected(key) }
 *       columns: [{ key, label, num, nowrap, render(row) → 노드|문자열, sort(a, b), sortable, width, title }]  — num이면 오른쪽 정렬 · 숫자 정렬, nowrap이면 줄 안 바꿈
 *   link(sel, label, attrs?)                    리더 패널 안 · 탭 안 이동 링크(a[href=#…], 클릭 → navigate(sel))
 *   tooltip(target, content)                    hover · focus에 뜨는 말풍선(content: 문자열 · 노드 · 함수)
 *   panel(title, body, { actions, class })      section.panel
 *   details(summary, body, { open, class })     접는 블록
 *   empty(text, action?) · spinner(text) · notice(text, kind)     empty의 action = { label, onClick } → 문구 옆 링크 모양 버튼
 *   hiddenNote(text, onShowAll, { action })     "● 스포일러로 가린 N [전부 보기]" 한 줄 — 모든 탭이 같은 모양으로 쓴다(text는 fmt.hiddenLabel(n)). action = 단추 글자(기본 "전부 보기")
 *   toggle({ label, checked, onChange, id })    스위치(role=switch)
 *   segmented({ options: [{ value, label, title? }], value, onChange, label }) → { el, set(value) }
 *   icon(name, attrs?)                          인라인 SVG 아이콘(search · close · sun · moon · auto · arrow · chevron) → span.icon
 */
import * as fmt from './format.js';

let navigate = (sel) => {
  location.hash = `#sel=${sel}`;
};
export function configure(opts = {}) {
  if (typeof opts.navigate === 'function') navigate = opts.navigate;
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  append(node, children);
  return node;
}
function append(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

const CHIP_VAR = {
  kind: (v) => `var(--kind-${v})`,
  grade: (v) => `var(--grade-${{ 필수: 'must', 보강: 'support', 참고: 'ref', 독립: 'standalone', 척추: 'spine', 메인: 'main' }[v] ?? 'none'})`,
  layer: (v) => `var(--layer-${v})`,
  state: (v) => `var(--state-${{ 열림: 'open', 일부: 'partial', 풀림: 'solved', 뒤집힘: 'reversed', 암시만: 'hint', 아직: 'none', 앎: 'known' }[v] ?? 'none'})`,
};
const CHIP_TEXT = {
  kind: (v) => fmt.KIND[v]?.label,
  grade: (v) => fmt.GRADE[v]?.label,
  layer: (v) => fmt.LAYER[v]?.label,
  state: (v) => fmt.STATE[v]?.label,
  record: (v) => fmt.RECORD_KIND[v]?.label,
};
export function chip(kind, value, label) {
  const text = label ?? CHIP_TEXT[kind]?.(value) ?? String(value ?? '');
  const tip = kind === 'plain' ? '' : fmt.help(kind, value);
  const node = el('span', { class: ['chip', `chip-${kind}`, kind === 'confidence' && value === '추정' ? 'chip-dashed' : ''], dataset: { value: String(value ?? '') }, title: tip || null }, text);
  const color = CHIP_VAR[kind]?.(value);
  if (color) node.style.setProperty('--chip', color);
  return node;
}

export function legend(items) {
  return el('div', { class: 'legend', role: 'list' }, items.map((it) =>
    el('span', { class: 'legend-item', role: 'listitem' }, el('i', { class: 'swatch', style: { background: it.color }, 'aria-hidden': 'true' }), it.label)));
}

export function link(sel, label, attrs = {}) {
  return el('a', {
    href: `#sel=${sel}`, class: ['link', attrs.class], title: attrs.title, dataset: { sel },
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      navigate(sel);
    },
  }, label ?? sel);
}

export function panel(title, body, { actions = null, class: cls = '' } = {}) {
  return el('section', { class: ['panel', cls] },
    title ? el('header', { class: 'panel-head' }, el('h3', {}, title), actions) : null,
    el('div', { class: 'panel-body' }, body));
}
export function details(summary, body, { open = false, class: cls = '' } = {}) {
  return el('details', { class: ['details', cls], open }, el('summary', {}, summary), el('div', { class: 'details-body' }, body));
}
/** 빈 상태 — 짧은 문구 + 선택적 행동 버튼(action: { label, onClick }) 예: empty('가린 스토리 120', { label: '전부 보기', onClick }) */
export const empty = (text = '없음', action = null) => el('div', { class: 'empty' }, text, action ? [' ', el('button', { type: 'button', class: 'link-btn', onClick: action.onClick }, action.label)] : null);
export const spinner = (text = '불러오는 중…') => el('div', { class: 'spinner', role: 'status', 'aria-live': 'polite' }, el('i', { 'aria-hidden': 'true' }), text);
export const notice = (text, kind = 'info') => el('div', { class: ['notice', `notice-${kind}`], role: kind === 'error' ? 'alert' : 'status' }, text);

/** 스포일러(여기까지 읽음 뒤) · 범위 밖으로 가린 것의 안내 — 점 + 글 + 작은 단추. 탭마다 따로 만들지 않는다 */
export function hiddenNote(text, onShowAll, { action = null } = {}) {
  return el('span', { class: 'hidden-note' },
    el('span', { class: 'hn-text' }, text),
    onShowAll ? el('button', { type: 'button', class: 'btn btn-sm hn-btn', onClick: onShowAll }, action ?? fmt.TERM.showAll) : null);
}

export function toggle({ label, checked = false, onChange, id, title } = {}) {
  const input = el('input', { type: 'checkbox', role: 'switch', id, 'aria-checked': String(checked) });
  input.checked = checked;
  input.addEventListener('change', () => {
    input.setAttribute('aria-checked', String(input.checked));
    onChange?.(input.checked);
  });
  const node = el('label', { class: 'toggle', title }, input, el('span', { class: 'toggle-track', 'aria-hidden': 'true' }), el('span', { class: 'toggle-label' }, label));
  node.set = (v) => {
    input.checked = v;
    input.setAttribute('aria-checked', String(v));
  };
  return node;
}

export function segmented({ options, value, onChange, label } = {}) {
  const node = el('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const buttons = new Map();
  const set = (v, fire = false) => {
    for (const [val, b] of buttons) {
      const on = val === v;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (fire) onChange?.(v);
  };
  for (const o of options) {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: 'seg', title: o.title, onClick: () => set(o.value, true) }, o.label);
    b.addEventListener('keydown', (e) => {
      const keys = [...buttons.keys()];
      const i = keys.indexOf(o.value);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const v = keys[(i + 1) % keys.length]; set(v, true); buttons.get(v).focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const v = keys[(i - 1 + keys.length) % keys.length]; set(v, true); buttons.get(v).focus(); }
    });
    buttons.set(o.value, b);
    node.append(b);
  }
  set(value ?? options[0]?.value);
  return { el: node, set: (v) => set(v, false) };
}

const ICONS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
};
/** 인라인 SVG 아이콘 — 색은 currentColor, 크기는 1em. 장식이라 aria-hidden */
export function icon(name, attrs = {}) {
  const t = document.createElement('template');
  t.innerHTML = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] ?? ''}</svg>`;
  const svg = t.content.firstElementChild;
  return el('span', { class: ['icon', `icon-${name}`, attrs.class], 'aria-hidden': 'true' }, svg);
}

export function tooltip(target, content) {
  let tip = null;
  const show = () => {
    if (tip) return;
    const body = typeof content === 'function' ? content() : content;
    if (!body) return;
    tip = el('div', { class: 'tooltip', role: 'tooltip', id: `tip-${Math.random().toString(36).slice(2, 8)}` }, body);
    document.body.append(tip);
    target.setAttribute('aria-describedby', tip.id);
    const r = target.getBoundingClientRect();
    const w = tip.offsetWidth;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.bottom + 6 + tip.offsetHeight > window.innerHeight ? r.top - tip.offsetHeight - 6 : r.bottom + 6;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  const hide = () => {
    if (!tip) return;
    tip.remove();
    tip = null;
    target.removeAttribute('aria-describedby');
  };
  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);
  target.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
  if (!target.hasAttribute('tabindex') && !/^(a|button|input|select|textarea)$/i.test(target.tagName)) target.tabIndex = 0;
  return hide;
}

/**
 * 표 — 정렬(머리글 버튼, aria-sort) · 페이지 · 고정 머리글(CSS) · 숫자 오른쪽 정렬 · 줄 선택(onRow · selected).
 * rows를 바꾸려면 update(rows). 선택 표시는 setSelected(rowKey 값).
 */
export function table({ columns, rows = [], sortable = true, pageSize = 50, onRow = null, rowKey = null, selected = null, empty: emptyText = '없음', caption = null } = {}) {
  let data = rows;
  let sortKey = null;
  let sortDir = 1;
  let page = 0;
  let selectedKey = selected;
  const keyOf = (r, i) => (rowKey ? (typeof rowKey === 'function' ? rowKey(r) : r[rowKey]) : i);

  const wrap = el('div', { class: 'table-wrap' });
  const tbl = el('table', { class: 'table' });
  const thead = el('thead');
  const tbody = el('tbody');
  const foot = el('div', { class: 'table-foot' });
  if (caption) tbl.append(el('caption', {}, caption));
  tbl.append(thead, tbody);
  wrap.append(tbl, foot);

  const headRow = el('tr');
  for (const c of columns) {
    const canSort = sortable && c.sortable !== false;
    const th = el('th', { scope: 'col', class: [c.num ? 'num' : '', canSort ? 'sortable' : ''], style: c.width ? { width: c.width } : null, title: c.title });
    if (canSort) {
      th.append(el('button', { type: 'button', class: 'th-btn', onClick: () => sortBy(c.key) }, c.label, el('span', { class: 'sort-mark', 'aria-hidden': 'true' })));
    } else th.append(c.label);
    headRow.append(th);
  }
  thead.append(headRow);

  const compare = (c) => {
    if (c.sort) return c.sort;
    if (c.num) return (a, b) => (Number(a[c.key] ?? -Infinity) - Number(b[c.key] ?? -Infinity));
    return (a, b) => String(a[c.key] ?? '').localeCompare(String(b[c.key] ?? ''), 'ko');
  };
  function sorted() {
    if (!sortKey) return data;
    const c = columns.find((x) => x.key === sortKey);
    if (!c) return data;
    const cmp = compare(c);
    return [...data].sort((a, b) => sortDir * cmp(a, b));
  }
  function sortBy(key) {
    if (sortKey === key) sortDir = -sortDir;
    else { sortKey = key; sortDir = 1; }
    page = 0;
    render();
  }
  function render() {
    for (const th of headRow.children) {
      const c = columns[[...headRow.children].indexOf(th)];
      th.setAttribute('aria-sort', sortKey === c.key ? (sortDir > 0 ? 'ascending' : 'descending') : 'none');
    }
    clear(tbody);
    const list = sorted();
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, pages - 1);
    const slice = pageSize ? list.slice(page * pageSize, (page + 1) * pageSize) : list;
    if (!total) tbody.append(el('tr', {}, el('td', { colspan: columns.length, class: 'empty-cell' }, emptyText)));
    for (const [i, r] of slice.entries()) {
      const key = keyOf(r, page * pageSize + i);
      const tr = el('tr', { class: [onRow ? 'clickable' : '', selectedKey != null && key === selectedKey ? 'selected' : ''], dataset: { key: String(key) }, tabindex: onRow ? 0 : null, 'aria-selected': onRow ? String(key === selectedKey) : null });
      for (const c of columns) {
        const v = c.render ? c.render(r) : r[c.key];
        tr.append(el('td', { class: [c.num ? 'num' : '', c.nowrap ? 'nowrap' : ''] }, v == null ? '' : v));
      }
      if (onRow) {
        tr.addEventListener('click', (e) => { if (!e.target.closest('a, button')) onRow(r, e); });
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(r, e); } });
      }
      tbody.append(tr);
    }
    clear(foot);
    if (pageSize && total > pageSize) {
      foot.append(
        el('button', { type: 'button', class: 'btn', disabled: page === 0, onClick: () => { page--; render(); } }, '이전'),
        el('span', { class: 'table-count' }, `${num(page * pageSize + 1)}–${num(Math.min(total, (page + 1) * pageSize))} / ${num(total)}건`),
        el('button', { type: 'button', class: 'btn', disabled: page >= pages - 1, onClick: () => { page++; render(); } }, '다음'),
      );
    }
  }
  render();
  return {
    el: wrap,
    update(rows) { data = rows; render(); },
    setSelected(key) {
      selectedKey = key;
      for (const tr of tbody.children) {
        const on = tr.dataset.key === String(key);
        tr.classList.toggle('selected', on);
        if (tr.hasAttribute('aria-selected')) tr.setAttribute('aria-selected', String(on));
      }
    },
    sortBy,
  };
}
const num = (n) => Number(n).toLocaleString('ko-KR');
