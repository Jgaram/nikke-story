/**
 * 씬 리더 패널(W1) — 오른쪽 aside. 어느 탭에서든 노드 · 선 · 메모를 누르면 `state.set({ sel })`로 열린다.
 * 원문 전문은 없다(공개 규칙) — 메타 · 분석 메모 · 근거 `씬 ID 12줄` · 설정 오류 의심 메모만. 라벨은 전부 format.js에서 가져온다.
 *
 *   init({ root, state, data, fmt, ui })   app.js가 부팅 때 한 번
 *   open(sel)                              sel = state의 sel 형식(unit: · scene: · record: · person: · target: · thread: · tick:)
 *   close() · isOpen()
 *
 * 스토리 패널: 맨 위 공개 개요(synopsis.json — 한 줄 소개 · 줄거리, W8) · 분류(order.json — 등급 · 왜 이 등급인가 · 감상 순서 탭 링크) ·
 *   연결(links-scenes.json — 선 종류별 상대 스토리 · 근거 줄 · 분석 메모 · 강도, 처음 열 때 받는다) · 씬 목록(씬 한 줄이 있으면 제목 아래).
 * 씬 패널: 씬 한 줄(공개 개요) · 연결(그 씬의 선). 개요가 없는 스토리 · 씬은 칸을 그리지 않는다. 인물 · 떡밥 · 세계 항목 패널: 해당 탭에서 보기 링크. 탭 링크는 탭을 바꾸고 리더를 닫는다.
 * "여기까지 읽음" 뒤의 메모는 지우지 않고 가린다 — 흐리게 + "여기까지 읽음 뒤 — 스포일러 보기" 펼치기.
 * 패널 안 링크는 모두 ui.link(sel) → state.set({ sel })이라 뒤로 가기가 된다. 메모 ID(F203 등)는 근거 줄에 작은 모노스페이스로만.
 */
let root = null;
let state = null;
let data = null;
let fmt = null;
let ui = null;
let current = null;
let lastIdx = null; // 마지막으로 연 색인 — recLink가 기록 문장을 찾는다
const idx0 = () => lastIdx;

export function init(deps) {
  ({ root, state, data, fmt, ui } = deps);
  root.setAttribute('aria-label', '상세');
}
export const isOpen = () => Boolean(current);

export function close() {
  current = null;
  root.hidden = true;
  ui.clear(root);
  document.body.classList.remove('reader-open');
}

export async function open(sel) {
  const parsed = state.parseSel(sel);
  if (!parsed) return close();
  current = sel;
  root.hidden = false;
  document.body.classList.add('reader-open');
  ui.clear(root);
  root.append(head(''), ui.spinner());
  try {
    const idx = await data.index();
    lastIdx = idx;
    if (needsRecords(parsed.type)) {
      if (!idx.hasRecords) {
        await idx.withRecords();
      }
    }
    if (parsed.type === 'unit') await loadOrder(); // 분류 칸 — 작은 파일(order.json)이라 같이 기다린다
    if (parsed.type === 'unit' || parsed.type === 'scene') await loadSynopsis();
    if (current !== sel) return; // 그새 다른 것을 골랐다
    ui.clear(root);
    const render = RENDER[parsed.type];
    if (!render) {
      root.append(head('열 수 없음'), ui.empty(`알 수 없는 선택: ${sel}`));
      return;
    }
    render(parsed.id, idx);
    root.scrollTop = 0;
    root.querySelector('.reader-close')?.focus({ preventScroll: true });
  } catch (err) {
    ui.clear(root);
    root.append(head('오류'), ui.notice(err.message, 'error'));
  }
}

// ── 다른 탭으로 · 연결 · 분류 ──
/** "OO 탭에서 보기" — 탭을 바꾸고 그 탭의 파라미터(p)·선택(sel)을 싣는다. sel이 없으면 리더는 닫는다 */
function tabLink(tab, p = {}, { sel = '' } = {}) {
  const href = `#tab=${tab}${sel ? `&sel=${encodeURIComponent(sel)}` : ''}${Object.entries(p).map(([k, v]) => `&p.${k}=${encodeURIComponent(v)}`).join('')}`;
  return ui.el('a', {
    href, class: 'link tab-link', title: fmt.TAB[tab]?.hint,
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      state.set({ tab, p, sel });
    },
  }, fmt.openInTab(tab), ui.icon('arrow'));
}
/** 패널 머리 오른쪽에 다는 "OO 탭에서 보기" */
const tabAction = (tab, p, opts) => ui.el('span', { class: 'panel-action' }, tabLink(tab, p, opts));

let orderMap = null;
let preMap = {};
async function loadOrder() {
  if (orderMap) return orderMap;
  try {
    const o = await data.load('order');
    orderMap = new Map(o.units.map((j) => [j.key, j]));
    preMap = o.pre ?? {};
  } catch {
    orderMap = new Map(); // 못 받아도 리더는 쓴다
  }
  return orderMap;
}

let synopsisMap = null;
let sceneLineMap = null;
let synopsisReady = null;
/** synopsis.json(공개 개요 — 확정된 것만) — 스토리 키 → 개요, 씬 ID → 한 줄. 못 받으면 칸을 그리지 않는다 */
function loadSynopsis() {
  return (synopsisReady ??= data.load('synopsis').then((list) => {
    synopsisMap = new Map(list.map((x) => [x.key, x]));
    sceneLineMap = new Map(list.flatMap((x) => Object.entries(x.scenes ?? {})));
  }).catch(() => { /* 개요가 없어도 리더는 쓴다 */ }));
}

/** 공개 개요 칸 — 여기까지 읽음 뒤 스토리면 접어서 가린다 */
function synopsisPanel(key, hidden) {
  const x = synopsisMap?.get(key);
  if (!x) return null;
  const body = [ui.el('p', { class: 'rd-logline' }, x.logline), ...x.synopsis.split(/\n\s*\n/).map((t) => ui.el('p', { class: 'rd-synopsis' }, t.trim()))];
  const ai = ui.el('span', { class: 'ai-tag', title: fmt.AI_NOTE.full }, fmt.AI_NOTE.tag);
  return ui.panel('줄거리', hidden ? ui.details(spoilerSummary(), body, { class: 'spoiler' }) : body, { class: 'rd-synopsis-panel', actions: ai });
}

let linkIndex = null;
/** links-scenes.json — 처음 열 때 한 번 받아 씬 · 스토리별로 색인한다 */
async function loadLinks() {
  if (linkIndex) return linkIndex;
  const list = await data.load('links-scenes');
  const byScene = new Map();
  const byUnit = new Map();
  const push = (m, k, e) => { if (k == null) return; const a = m.get(k); if (a) a.push(e); else m.set(k, [e]); };
  for (const e of list) {
    push(byScene, e.from, e);
    if (e.to !== e.from) push(byScene, e.to, e);
    push(byUnit, e.fu, e);
    if (e.tu !== e.fu) push(byUnit, e.tu, e);
  }
  linkIndex = { byScene, byUnit };
  return linkIndex;
}

const LINK_CAP = 5; // 선 종류마다 먼저 보이는 줄 수 — 나머지는 "더 보기"
const levelText = (s) => fmt.LINK_LEVEL[s] ?? '';
const clipText = (s, n) => ([...String(s ?? '')].length > n ? `${[...s].slice(0, n).join('')}…` : String(s ?? ''));

/** 선 한 줄의 근거 — 장면 → 장면(기록 ID는 화면에 내지 않는다 — W13a) */
function linkEvidence(e, idx) {
  const scene = (id) => (idx.scenes.get(id) ? ui.link(`scene:${id}`, fmt.ref(id)) : ui.el('span', {}, fmt.ref(id)));
  return [scene(e.from), ' → ', scene(e.to)];
}
/** 기록으로 가는 링크 — 글자는 기록 문장(줄임), ID가 아니다 */
function recLink(id) {
  const r = idx0()?.records?.get(id);
  return ui.link(`record:${id}`, r ? clipText(fmt.recordText(r) || fmt.recordLabel(r), 48) : fmt.RECORD_KIND[String(id).replace(/\d.*$/, '')]?.label ?? '자세히');
}

/** 선들을 선 종류별로 묶어 그린다 — rows: [{ type, node, s, n, order }]. 종류마다 LINK_CAP줄, 나머지는 접는다 */
function linkGroups(rows) {
  const out = [];
  for (const type of fmt.LINK_TYPE_ORDER) {
    const list = rows.filter((r) => r.type === type).sort((a, b) => b.s - a.s || b.n - a.n || a.order - b.order);
    if (!list.length) continue;
    const head = ui.el('h4', { class: 'rd-type', title: fmt.help('link', type) }, fmt.LINK_TYPE[type].label, ui.el('span', { class: 'muted' }, ` ${list.length}`));
    const first = list.slice(0, LINK_CAP);
    const rest = list.slice(LINK_CAP);
    out.push(ui.el('div', { class: 'rd-group' }, head,
      ui.el('ul', { class: 'rd-links' }, first.map((r) => r.node)),
      rest.length ? ui.details(`더 보기 (${rest.length})`, ui.el('ul', { class: 'rd-links' }, rest.map((r) => r.node))) : null));
  }
  return out;
}

/** 연결 칸을 채운다 — 컷오프 뒤 상대는 스포일러 접이로 */
function fillLinks(body, rows, emptyText) {
  ui.clear(body);
  if (!rows.length) { body.append(ui.empty(emptyText)); return; }
  const before = rows.filter((r) => !r.after);
  const after = rows.filter((r) => r.after);
  if (before.length) body.append(...linkGroups(before)); else body.append(ui.empty('여기까지 읽은 범위엔 없음'));
  if (after.length) body.append(ui.details(spoilerSummary(after.length), linkGroups(after), { class: 'spoiler' }));
}

/** 스토리 패널의 연결: 상대 스토리마다 한 줄(선 종류별) — 가장 센 선의 근거 */
function unitLinkRows(key, edges, idx) {
  const groups = new Map(); // `${type}|${other}` → { type, other, edges[] }
  for (const e of edges) {
    const other = e.fu === key ? e.tu : e.fu;
    if (other === key && e.type === 'prereq') continue; // 한 스토리 안 순서(호감도 1편 → 2편 …)는 연결이 아니다
    const id = `${e.type}|${other}`;
    const g = groups.get(id);
    if (g) g.edges.push(e); else groups.set(id, { type: e.type, other, edges: [e] });
  }
  return [...groups.values()].map((g) => {
    const best = [...g.edges].sort((a, b) => b.s - a.s || (b.record ? 1 : 0) - (a.record ? 1 : 0) || (b.fl != null ? 1 : 0) - (a.fl != null ? 1 : 0))[0];
    const u = idx.units.get(g.other);
    const self = g.other === key;
    const s = best.s;
    const node = ui.el('li', { class: ['rd-link', u && !state.seen(u.key) ? 'after-cutoff' : ''] },
      ui.el('div', { class: 'rd-link-main' },
        self ? ui.el('span', {}, '이 스토리 안') : (u ? ui.link(`unit:${g.other}`, u.title) : ui.el('span', { class: 'mono' }, g.other)),
        ui.el('span', { class: 'rd-link-meta' }, `${levelText(s)}${g.edges.length > 1 ? ` · 장면 ${g.edges.length}쌍` : ''}`)),
      ui.el('div', { class: 'rd-link-ev' }, linkEvidence(best, idx), g.edges.length > 1 ? ui.el('span', { class: 'muted' }, ` 외 ${g.edges.length - 1}`) : null));
    return { type: g.type, node, s, n: g.edges.length, order: u?.order ?? 9999, after: Boolean(u) && !state.seen(u.key) };
  });
}

/** 씬 패널의 연결: 선 하나가 한 줄 — 상대 씬 · 상대 스토리 · 내 줄 ↔ 상대 줄 */
function sceneLinkRows(id, edges, idx) {
  return edges.map((e) => {
    const mine = e.from === id;
    const other = mine ? e.to : e.from;
    const otherUnit = mine ? e.tu : e.fu;
    const sc = idx.scenes.get(other);
    const u = idx.units.get(otherUnit);
    const hidden = Boolean(u) && !state.seen(u.key);
    const ev = [];
    const node = ui.el('li', { class: ['rd-link', hidden ? 'after-cutoff' : ''] },
      ui.el('div', { class: 'rd-link-main' },
        sc ? ui.link(`scene:${other}`, sc.title ?? other) : ui.el('span', { class: 'mono' }, other),
        u ? ui.el('span', { class: 'rd-link-meta' }, [ui.link(`unit:${otherUnit}`, u.title), ` · ${levelText(e.s)}`]) : ui.el('span', { class: 'rd-link-meta' }, levelText(e.s))),
      ev.length ? ui.el('div', { class: 'rd-link-ev' }, ev) : null);
    return { type: e.type, node, s: e.s, n: 1, order: u?.order ?? 9999, after: hidden };
  });
}

/** 연결 패널 — 자리를 먼저 잡고(spinner) links-scenes.json이 오면 채운다. 제목의 숫자 = 줄 수 */
function linksPanel(idx, { sel, tabAct, pick, build, emptyText }) {
  const body = ui.el('div', { class: 'rd-lazy' }, ui.spinner());
  const panel = ui.panel('연결', body, { actions: tabAct });
  root.append(panel);
  loadLinks().then((li) => {
    if (current !== sel) return;
    const rows = build(pick(li), idx);
    panel.querySelector('h3').textContent = rows.length ? `연결 ${rows.length}` : '연결';
    fillLinks(body, rows, emptyText);
  }).catch((err) => {
    if (current !== sel) return;
    ui.clear(body);
    body.append(ui.empty(`연결을 불러오지 못함 — ${err.message}`));
  });
}

/** 스토리 패널의 분류 칸 — 메인 · 척추는 "필수" 표시만, 나머지는 그 시점 등급 · 이유 */
function classPanel(u, idx) {
  const j = orderMap?.get(u.key);
  const action = tabAction('order', {}, { sel: `unit:${u.key}` });
  const p = preMap[u.key];
  // 선행 스토리 — 칸마다 한 줄(필수 · 권장 · 선택), 스토리 이름 + 왜
  const preRow = p ? row('선행', fmt.PRE_LEVEL.filter((l) => p[l]?.length).map((l) => ui.el('div', {},
    ui.el('b', { title: fmt.help('pre', l) }, `${fmt.PRE_LABEL[l]} `),
    p[l].map(([k, w], i) => [i ? ' · ' : null, ui.link(`unit:${k}`, fmt.unitTitle(k)), ui.el('span', { class: 'muted' }, ` (${fmt.PRE_WHY[w] ?? w})`)])))) : null;
  if (!j) {
    if (u.grade === '메인' || u.grade === '척추') return ui.panel(fmt.TERM.judgment, [ui.el('div', { class: 'chips' }, ui.chip('grade', '척추')), preRow ? kv([preRow]) : null], { actions: action });
    return null;
  }
  const t = T();
  const g = fmt.gradeAt(j, state.reading());
  const spineName = (k) => { const s = idx.units.get(k); return s?.kind === 'main' ? fmt.tickShort(s.tick) : fmt.unitTitle(k); };
  const gradeRow = [ui.chip('grade', g ?? j.grade)];
  if (g == null) gradeRow.push(' ', ui.el('span', { class: 'muted' }, '여기까지 읽음 뒤에 나온 스토리'));
  else if (g !== j.grade) gradeRow.push(' ', ui.el('span', { class: 'muted' }, ['→ ', ui.link(`unit:${j.from}`, spineName(j.from)), '부터 '], ui.chip('grade', j.grade)));
  else if (j.from_tick) gradeRow.push(' ', ui.el('span', { class: 'muted' }, t == null ? `${spineName(j.from)} 앞에서는 ${fmt.GRADE[j.before ?? j.grade]?.label}` : `${spineName(j.from)}부터`));
  const full = fmt.reasonText(j.reason ?? ''); // 판정 과정 마디는 걷는다(W13b — 감상 순서 카드와 같다)
  const short = clipText(full, 90);
  const why = full ? (short === full ? ui.el('div', {}, full) : ui.details(short, ui.el('div', { class: 'rd-why-full' }, full))) : null;
  return ui.panel(fmt.TERM.judgment, kv([
    row(t == null ? '등급' : fmt.TERM.gradeAt, ui.el('span', {}, gradeRow)),
    j.from && idx.units.has(j.from) && u.order < idx.units.get(j.from).order ? row('선행인 곳', ui.link(`unit:${j.from}`, fmt.preOf(spineName(j.from)))) : null,
    preRow,
    row(fmt.TERM.basis, why),
  ]), { actions: action });
}

const needsRecords = (type) => ['scene', 'record', 'unit', 'person', 'target', 'thread'].includes(type);

function head(title, chips = [], sub = null, pic = null) {
  return ui.el('header', { class: 'reader-head' },
    pic,
    ui.el('div', { class: 'reader-title' },
      title ? ui.el('h2', {}, title) : null,
      sub ? ui.el('div', { class: 'reader-sub' }, sub) : null,
      chips.length ? ui.el('div', { class: 'chips' }, chips) : null),
    ui.el('button', { type: 'button', class: 'btn reader-close', 'aria-label': '닫기', title: '닫기 (Esc)', onClick: () => state.set({ sel: '' }) }, ui.icon('close')));
}
const row = (k, v) => (v == null || v === '' ? null : ui.el('div', { class: 'kv' }, ui.el('dt', {}, k), ui.el('dd', {}, v)));
const kv = (rows) => ui.el('dl', { class: 'kvs' }, rows);
const T = () => state.get().t;
const tip = (text, title) => ui.el('span', { title }, text);
/** 링크 목록을 ' · '로 이어 붙인다 */
const joinNodes = (nodes) => nodes.map((n, i) => [i ? ' · ' : null, n]);
/** "여기까지 읽음 뒤" 스포일러 접힘의 제목 */
const spoilerSummary = (n) => `여기까지 읽음 뒤 — 스포일러 보기${n != null ? ` (${n})` : ''}`;
const cutoffName = () => fmt.tickShort(T());

/** 기록 한 줄 — 종류 칩 · 확신도 · 문장(누르면 자세히) · 장면 링크. ID는 내지 않는다. "여기까지 읽음" 뒤면 흐리게 */
function recordLine(r, { showUnit = false } = {}) {
  const hidden = !state.known(r);
  const st = fmt.stateAt(r, state.reading());
  return ui.el('li', { class: ['record-line', hidden ? 'after-cutoff' : ''] },
    ui.el('div', { class: 'chips' },
      ui.chip('record', r.kind, fmt.recordLabel(r)),
      r.confidence === '추정' ? ui.chip('confidence', '추정') : null,
      st && st !== '앎' ? ui.chip('state', st) : null),
    ui.el('div', { class: 'record-text' }, ui.link(`record:${r.id}`, fmt.recordText(r) || fmt.recordLabel(r), { class: 'record-open' })),
    ui.el('div', { class: 'record-ref' },
      showUnit && r.unit ? [ui.link(`unit:${r.unit}`, fmt.unitTitle(r.unit)), ' · '] : null,
      r.evidence?.length ? joinNodes([...new Set(r.evidence.map((e) => e.scene))].map((sc) => ui.link(`scene:${sc}`, fmt.refIn(sc, r.unit)))) : null));
}

/** 기록 목록을 "여기까지 읽음" 앞 · 뒤로 갈라 그린다 — 뒤는 details 안 */
function recordList(records, opts = {}) {
  if (!records?.length) return ui.empty('없음');
  const R = state.reading();
  const order = (r) => (fmt.RECORD_ORDER.indexOf(r.kind) + 1 || 99);
  const sorted = [...records].sort((a, b) => order(a) - order(b) || (a.line ?? 0) - (b.line ?? 0) || String(a.id).localeCompare(String(b.id)));
  const before = sorted.filter((r) => R.known(r));
  const after = sorted.filter((r) => !R.known(r));
  return ui.el('div', { class: 'record-lists' },
    before.length ? ui.el('ul', { class: 'records' }, before.map((r) => recordLine(r, opts))) : ui.empty('여기까지 읽은 범위엔 없음'),
    after.length ? ui.details(spoilerSummary(after.length), ui.el('ul', { class: 'records' }, after.map((r) => recordLine(r, opts))), { class: 'spoiler' }) : null);
}

/** 기록 묶음의 패널 이름 — 묶음 말(분석 메모) 대신 든 종류 이름을 늘어놓는다(W13 용어표): '사실 · 의문 · 변화' */
const kindsTitle = (records) => {
  const kinds = [...new Set((records ?? []).map((r) => r.kind))].sort((a, b) => fmt.RECORD_ORDER.indexOf(a) - fmt.RECORD_ORDER.indexOf(b));
  return [...new Set(kinds.map((k) => fmt.RECORD_KIND[k]?.label ?? k))].join(' · ');
};

const chronoText = (u) => {
  const c = u.chrono;
  if (!c) return null;
  return [
    tip(fmt.CHRONO_CLASS[c.class] ?? c.class, fmt.help('chrono', c.class)),
    c.place ? ` · ${fmt.placeLabel(c.place)}` : null,
    c.drift ? [` · ${fmt.DRIFT_TITLE}: `, tip(fmt.DRIFT[c.drift] ?? c.drift, fmt.help('drift', c.drift))] : null,
  ];
};

const gradeChip = (u) => (u.grade && u.grade !== '메인' ? ui.chip('grade', u.grade) : null);

const RENDER = {
  unit(key, idx) {
    const u = idx.units.get(key);
    if (!u) return root.append(head('찾을 수 없음'), ui.empty('스토리를 찾을 수 없음'));
    const hidden = !state.seen(u.key);
    root.append(head(u.title, [ui.chip('kind', u.kind), gradeChip(u)]));
    // 메인 위치 앞에 나왔는데 안 봤으면 '안 봤다고 고른 스토리'(척추 이벤트 · 사이드 체크)
    if (hidden) root.append(ui.notice(state.visible(u.tick) ? '안 봤다고 고른 스토리 — 아래는 스포일러일 수 있다' : `여기까지 읽음(${cutoffName()}) 뒤에 나온 스토리 — 아래는 스포일러일 수 있다`, 'warn'));
    const syn = synopsisPanel(key, hidden);
    if (syn) root.append(syn);
    const scenes = idx.scenesOf.get(key) ?? [];
    const recs = idx.recordsOfUnit.get(key) ?? [];
    root.append(ui.panel(null, kv([
      row(fmt.TERM.order, `${u.order}번째 / ${idx.unitList.length}`),
      row(fmt.TERM.release, u.tick != null ? `${fmt.tickLabel(u.tick)}${u.date_confidence === '추정' ? ' (날짜 추정)' : ''}${u.via === '딸림' ? ' · 딸린 챕터 기준' : ''}` : null),
      row(fmt.TERM.chronoPlace, chronoText(u)),
      row('분량', `${u.scenes}장면 · ${fmt.num(u.lines)}줄${u.chars != null ? ` · ${fmt.num(u.chars)}자` : ''}`),
    ])));
    const cls = classPanel(u, idx);
    if (cls) root.append(cls);
    linksPanel(idx, { sel: current, tabAct: tabAction('links', { c: key }), pick: (li) => li.byUnit.get(key) ?? [], build: (edges) => unitLinkRows(key, edges, idx), emptyText: '이어진 스토리 없음' });
    root.append(ui.panel(`장면 ${scenes.length}`, scenes.length ? ui.el('ol', { class: 'scene-list' }, scenes.map((s) =>
      ui.el('li', {}, ui.link(`scene:${s.id}`, `${s.seq}. ${s.title ?? s.id}`), ui.el('span', { class: 'muted' }, ` ${s.lines}줄${s.part ? ` · ${s.part}` : ''}${s.level ? ` · Lv.${s.level}` : ''}`),
        !hidden && sceneLineMap?.get(s.id) ? ui.el('div', { class: 'rd-scene-line' }, sceneLineMap.get(s.id)) : null))) : ui.empty('장면 없음')));
    if (recs.length) root.append(ui.panel(kindsTitle(recs), recs.length > 80 ? ui.el('p', { class: 'muted' }, '장면을 고르면 그 장면의 것만 나온다') : recordList(recs)));
    slipsPanel(idx.slipsOf.get(key));
  },

  scene(id, idx) {
    const s = idx.scenes.get(id);
    if (!s) return root.append(head('찾을 수 없음'), ui.empty('장면을 찾을 수 없음'));
    const u = idx.units.get(s.unit);
    const recs = idx.recordsOf.get(id) ?? [];
    root.append(head(s.title ?? fmt.sceneName(id), [u ? ui.chip('kind', u.kind) : null]));
    const line = sceneLineMap?.get(id);
    if (line) {
      const p = ui.el('p', { class: 'rd-logline' }, line);
      root.append(u && !state.seen(u.key) ? ui.details(spoilerSummary(), p, { class: 'spoiler' }) : p);
    }
    const siblings = idx.scenesOf.get(s.unit) ?? [];
    const prev = siblings[s.seq - 2];
    const next = siblings[s.seq];
    root.append(ui.panel(null, kv([
      row(fmt.TERM.unit, u ? ui.link(`unit:${u.key}`, u.title) : s.unit),
      row('순서', `${s.seq} / ${siblings.length}${s.part ? ` · ${s.part}` : ''}${s.level ? ` · Lv.${s.level}` : ''}`),
      row('분량', `${fmt.num(s.lines)}줄${s.has_text === 0 ? ' (본문 없음)' : ''}`),
      row(fmt.TERM.release, u?.tick != null ? fmt.tickLabel(u.tick) : null),
      row('이동', ui.el('span', { class: 'nav' }, prev ? ui.link(`scene:${prev.id}`, `← ${prev.title ?? prev.id}`) : null, prev && next ? ' · ' : null, next ? ui.link(`scene:${next.id}`, `${next.title ?? next.id} →`) : null)),
    ])));
    linksPanel(idx, { sel: current, tabAct: u ? tabAction('links', { c: u.key }) : null, pick: (li) => li.byScene.get(id) ?? [], build: (edges) => sceneLinkRows(id, edges, idx), emptyText: '이 씬에 걸린 연결 없음' });
    if (recs.length) root.append(ui.panel(kindsTitle(recs), recordList(recs)));
    slipsPanel((idx.slipsOf.get(s.unit) ?? []).filter((x) => !x.scenes?.length || x.scenes.includes(id)));
  },

  record(id, idx) {
    const r = idx.records?.get(id);
    if (!r) return root.append(head('찾을 수 없음'), ui.empty('찾을 수 없음'));
    const hidden = !state.known(r);
    const st = fmt.stateAt(r, state.reading());
    root.append(head(fmt.recordLabel(r), [r.confidence === '추정' ? ui.chip('confidence', '추정') : null, st && st !== '앎' ? ui.chip('state', st) : null]));
    const recLinks = (ids) => ids?.length ? ui.el('ul', { class: 'plain' }, ids.map((c) => ui.el('li', {}, recLink(c)))) : null;
    const body = ui.el('div', {});
    body.append(ui.el('p', { class: 'record-full' }, fmt.recordText(r)));
    if (r.kind === 'D' && r.act === '변화') body.append(kv([row('이전', fmt.prose(r.before)), row('이후', fmt.prose(r.after)), row('계기', fmt.prose(r.trigger)), row(fmt.TERM.chronoPlace, r.time ? recLink(r.time) : null)]));
    if (r.kind === 'S') body.append(kv([row('시간 관계', Array.isArray(r.at) ? r.at.map((a) => (Array.isArray(a) ? a.join(' ') : String(a))).join(' · ') : null), row('기준', fmt.prose(r.ref)), row('대상', r.subject), row('연도', r.years)]));
    if (r.kind === 'Q-k' || r.kind === 'F-k') body.append(kv([row(r.kind === 'Q-k' ? '의문' : '사실', r.parent ? recLink(r.parent) : null), row('답', r.answer ? recLink(r.answer) : null), row('회수 정도', r.degree), row('대신 알려진 사실', r.replaced_by ? recLink(r.replaced_by) : null)]));
    if (r.kind === 'F' || r.kind === 'Q') {
      const at = (x) => (x != null ? fmt.tickLabel(x) : null);
      body.append(kv(r.kind === 'Q'
        ? [row(fmt.ACT.제기, at(r.first_tick)), row(fmt.ACT.암시, at(r.hint_tick)), row(fmt.ACT.일부, at(r.partial_tick)), row(fmt.ACT.회수, at(r.solved_tick)), row('현재 상태', fmt.STATE[r.state]?.label ?? r.state)]
        : [row(fmt.ACT.암시, at(r.hint_tick)), row(fmt.ACT['처음 밝혀짐'], at(r.first_tick)), row(fmt.ACT.뒤집힘, r.reversed_tick != null ? [at(r.reversed_tick), r.replaced_by ? [' → ', recLink(r.replaced_by)] : null] : null)]));
    }
    if (r.kind === 'O') body.append(kv([row('흐름', fmt.prose(r.chain)), row('쌓인 곳', r.built?.length ? joinNodes(r.built.map((b) => (/^[A-Z]\d/.test(b) ? recLink(b) : ui.link(`unit:${b}`, fmt.unitTitle(b))))) : null), row(fmt.ACT.회수, recLinks(r.closing)), row('끝난 곳', r.end ? ui.link(`unit:${r.end}`, fmt.unitTitle(r.end)) : null)]));
    if (r.kind === 'H') body.append(kv([row('끝난 곳', r.end ? ui.link(`unit:${r.end}`, fmt.unitTitle(r.end)) : null), row('함께 맺는 것', recLinks(r.members))]));
    if (r.points?.length) body.append(kv([row('가리키는 것', recLinks(r.points))]));
    if (r.evidence?.length) body.append(ui.panel('장면', ui.el('ul', { class: 'plain' }, [...new Set(r.evidence.map((e) => e.scene))].map((sc) => ui.el('li', {}, ui.link(`scene:${sc}`, fmt.ref(sc)))))));
    // 해석 이유는 추정일 때만 — 확실한 기록은 문장만으로 읽힌다. 못 바꾸는 이유 문장은 내지 않는다
    if (r.confidence === '추정' && fmt.prose(r.reason)) body.append(ui.panel('추정한 이유', ui.el('p', { class: 'reason' }, fmt.prose(r.reason))));
    if (r.about?.length) body.append(ui.panel('관련', ui.el('p', {}, joinNodes(r.about.map((a) => ui.link(`${a.startsWith('person:') ? 'person' : 'target'}:${a}`, fmt.targetName(a)))))));
    if (r.threads?.length) body.append(ui.panel(fmt.TERM.thread, ui.el('p', {}, joinNodes(r.threads.map((j) => ui.link(`thread:${j}`, idx.threads.get(j)?.title ?? j))))));
    const rootId = r.parent ?? ((r.kind === 'F' || r.kind === 'Q') ? r.id : null);
    if (rootId) {
      const rootRec = idx.records.get(rootId);
      const events = idx.eventsOf.get(rootId) ?? [];
      const others = [rootRec, ...events].filter((x) => x && x.id !== r.id);
      if (others.length) body.append(ui.panel('이어진 흐름', recordList(others, { showUnit: true })));
    }
    body.append(ui.panel('나온 곳', kv([row(fmt.TERM.unit, r.unit ? ui.link(`unit:${r.unit}`, fmt.unitTitle(r.unit)) : null), row('장면', r.scene ? ui.link(`scene:${r.scene}`, fmt.sceneName(r.scene)) : null), row(fmt.TERM.release, r.tick != null ? fmt.tickLabel(r.tick) : null)])));
    if (hidden) root.append(ui.details(spoilerSummary(), body, { class: 'spoiler' }));
    else root.append(body);
  },

  person(id, idx) {
    return RENDER.target(id, idx);
  },
  target(id, idx) {
    const t = idx.targets.get(id);
    if (!t) return root.append(head('찾을 수 없음'), ui.empty('항목을 찾을 수 없음'));
    root.append(head(t.name, [ui.chip('plain', t.type, fmt.TARGET_TYPE[t.type] ?? t.type), t.kind ? ui.chip('plain', t.kind, t.kind) : null, t.type === 'person' ? ui.orgMarks(fmt.orgsAt(t, T(), { past: true }), { size: 16 }) : null], null, ui.portrait(fmt.iconAt(t, T()), { size: 56, class: 'reader-pic' })));
    root.append(ui.el('div', { class: 'rd-open' }, t.type === 'person' ? tabLink('persons', { who: id }) : tabLink('world', { item: id })));
    const recs = idx.recordsAbout.get(id) ?? [];
    const units = new Set(recs.map((r) => r.unit).filter(Boolean));
    root.append(ui.panel(null, kv([
      row('다른 이름', t.aliases?.length ? t.aliases.map((a) => a.name).join(' · ') : null),
      row('같은 인물 · 항목', fmt.sameAsKnown(t, state.reading()).length ? joinNodes(fmt.sameAsKnown(t, state.reading()).map((s) => ui.link(`${s.startsWith('person:') ? 'person' : 'target'}:${s}`, fmt.targetName(s)))) : null),
      row('설명', fmt.prose(t.note)),
      row('나온 스토리', units.size ? `${fmt.num(units.size)}편` : null),
    ])));
    if (recs.length) root.append(ui.panel(kindsTitle(recs), recs.length > 200 ? [ui.el('p', { class: 'muted' }, `앞 200개만 — 전체는 ${t.type === 'person' ? '인물' : '세계'} 탭에서`), recordList(recs.slice(0, 200), { showUnit: true })] : recordList(recs, { showUnit: true })));
  },

  thread(id, idx) {
    const j = idx.threads.get(id);
    if (!j) return root.append(head('찾을 수 없음'), ui.empty('떡밥을 찾을 수 없음'));
    root.append(head(j.title, [fmt.majorThread(j) ? ui.chip('plain', j.weight, fmt.majorThread(j)) : null, j.confidence === '추정' ? ui.chip('confidence', '추정') : null]));
    root.append(ui.el('div', { class: 'rd-open' }, tabLink('threads', { j: id })));
    root.append(ui.panel(null, [
      ui.el('p', {}, fmt.prose(j.text)),
      kv([
        row('의문', `${j.questions?.length ?? 0} (${fmt.STATE.열림.label} ${j.open ?? 0} · ${fmt.STATE.일부.label} ${j.partial ?? 0} · ${fmt.STATE.풀림.label} ${j.solved ?? 0})`),
        row('사실', j.facts?.length || null),
        row(fmt.TERM.unit, j.units != null ? `${j.units}${j.first_unit ? ` — ${fmt.unitTitle(j.first_unit)} → ${j.last_unit ? fmt.unitTitle(j.last_unit) : ''}` : ''}` : null),
        row('관련', j.about?.length ? joinNodes(j.about.map((a) => ui.link(`${a.startsWith('person:') ? 'person' : 'target'}:${a}`, fmt.targetName(a)))) : null),
        row(fmt.TERM.lead, j.owners?.length ? joinNodes(j.owners.map((a) => ui.link(`person:${a}`, fmt.targetName(a)))) : null),
      ]),
    ]));
    const qs = (j.questions ?? []).map((q) => idx.records?.get(q)).filter(Boolean);
    const fs = (j.facts ?? []).map((f) => idx.records?.get(f)).filter(Boolean);
    root.append(ui.panel(`의문 ${qs.length}`, recordList(qs, { showUnit: true })));
    root.append(ui.panel(`사실 ${fs.length}`, recordList(fs, { showUnit: true })));
    const rels = idx.relations.filter((g) => g.from === id || g.to === id);
    root.append(ui.panel(`다른 떡밥과의 관계 ${rels.length}`, rels.length ? ui.el('ul', { class: 'plain' }, rels.map((g) => {
      const other = g.from === id ? g.to : g.from;
      return ui.el('li', {}, ui.chip('plain', g.type, g.type), ' ', ui.link(`thread:${other}`, idx.threads.get(other)?.title ?? other), fmt.prose(g.text) ? ui.el('div', { class: 'muted' }, fmt.prose(g.text)) : null);
    })) : ui.empty('없음')));
  },

  tick(id, idx) {
    const t = idx.ticks.get(Number(id));
    if (!t) return root.append(head('찾을 수 없음'), ui.empty('자리를 찾을 수 없음'));
    root.append(head(fmt.tickLabel(t.tick)));
    root.append(ui.panel(`이 시점에 나온 스토리 ${t.units.length}`, ui.el('ul', { class: 'plain' }, t.units.map((k) => {
      const u = idx.units.get(k);
      return ui.el('li', {}, u ? [ui.chip('kind', u.kind), ' ', ui.link(`unit:${k}`, u.title)] : k);
    }))));
  },
};

/** 설정 오류 의심 — 바꿀 수 있는 문장만(fmt.prose) */
function slipsPanel(slips) {
  const texts = (slips ?? []).map((s) => fmt.prose(s.text)).filter(Boolean);
  if (!texts.length) return;
  root.append(ui.panel('설정 오류 의심', ui.el('ul', { class: 'plain' }, texts.map((t) => ui.el('li', { class: 'slip' }, t)))));
}
