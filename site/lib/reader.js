/**
 * 씬 리더 패널(W1) — 오른쪽 aside. 어느 탭에서든 노드 · 선 · 기록을 누르면 `state.set({ sel })`로 열린다.
 * 원문 전문은 없다(공개 규칙). 화면 말은 팬이 묻는 것만(docs/views.md "화면 문구는 간결하게", W13d) — 기록 ID · 작업량 숫자(순번 · 장면 수 · 줄 · 글자 수) ·
 * 판정 말은 싣지 않고, 근거 추적은 링크로만 남긴다. 이 파일의 화면 말은 아래 LABELS 한 곳, 공용 말은 format.js(fmt)에서 가져온다.
 *
 *   init({ root, state, data, fmt, ui })   app.js가 부팅 때 한 번
 *   open(sel)                              sel = state의 sel 형식(unit: · scene: · record: · person: · target: · thread: · tick:)
 *   close() · isOpen()
 *
 * 스토리 패널(팬의 질문 순서 — 무슨 이야기 · 누가 나오나 · 언제 읽나):
 *   머리 = [호감도는 그 니케 초상] 제목 + 회색 한 줄(등급 이름 — 띠 색 글자 · 종류 · 출시 날짜). 순번 · 분량은 없다(날짜만 — 감상 순서 목록이 날짜를 리더로 보냈다).
 *   → 줄거리(synopsis.json — 한 줄 소개 · 줄거리, 머리에 'AI 정리' 표지) → 나오는 인물(persons-detail.json — 그 스토리에서 말한 인물 초상 줄, 많이 말한 순, 지휘관은 뺀다)
 *   → 분류(order.json — 그 시점 등급 · 언제 읽나 'CH.44 전까지'(fmt.guideOf — 감상 순서 줄과 같은 기한) · 선행(이름만 — 왜 선행인가는 스포일러가 될 수 있어 뺀다) ·
 *     작중 순(과거 · 앞선 · 나중 이야기일 때만) · 이유(blurbs.json 팬용 문장 — gate를 봤으면 later까지, 없거나 낡았으면 fmt.reasonText 판정 문장 —
 *     뒤 필수 스토리로 오른 스토리의 판정 문장은 그 스토리를 안 봤으면 스포일러 접이))
 *   → 접힌 칸: 이어진 스토리(links-scenes.json — 펼 때 처음 받는다, 상대 스토리마다 한 줄 + 왜 이어졌나 한 줄) · 떡밥
 *   → 장면 목록(씬 한 줄이 있으면 제목 아래) → 접힌 기록 칸(사실 · 의문 …) → 설정 오류 의심.
 * 씬 패널: 제목 + 회색 한 줄(스토리 · 판 · 호감도 Lv), 씬 한 줄(공개 개요), 앞뒤 장면, 연결(그 씬의 선 — 상대 장면 · 스토리 · 왜), 기록.
 * 인물 패널: 인물 탭 머리와 같은 머리 — 초상 · 이름 · 소속 마크 · 다른 이름 · '처음 등장 CH.00 추락' 하나(말이 없을 때만 '이름만 나옴' · '등장만').
 *   숫자 · 갈래 칩 · 사전 설명은 싣지 않는다. 기록은 접어 둔다.
 * 항목(세계) 패널: 이름 + 회색 종류 · 갈래, 사전 설명, 다른 이름 · 같은 항목 · 나온 스토리 N편(본 것만). 떡밥 패널: 설명 · 그 시점 의문 상태 · 처음 나온 곳.
 * 개요가 없는 스토리 · 씬은 줄거리 칸을 그리지 않는다. 인물 · 떡밥 · 세계 항목 패널: 해당 탭에서 보기 링크. 탭 링크는 탭을 바꾸고 리더를 닫는다.
 * "여기까지 읽음" 뒤의 것은 지우지 않고 가린다 — 흐리게 + "여기까지 읽음 뒤 — 스포일러 보기" 펼치기.
 * 패널 안 링크는 모두 ui.link(sel) → state.set({ sel })이라 뒤로 가기가 된다.
 */
let root = null;
let state = null;
let data = null;
let fmt = null;
let ui = null;
let current = null;
let lastIdx = null; // 마지막으로 연 색인 — recLink가 기록 문장을 찾는다
const idx0 = () => lastIdx;

/** 이 파일의 화면 말 — 고칠 때는 여기 한 곳만(공용 말은 fmt) */
const LABELS = {
  aria: '상세',
  close: '닫기', closeTip: '닫기 (Esc)',
  notFound: '찾을 수 없음', cantOpen: '열 수 없음', unknownSel: (sel) => `알 수 없는 선택: ${sel}`, error: '오류',
  synopsis: '줄거리',
  people: '나오는 인물',
  more: (n) => `더 보기 (${n})`,
  release: (when) => `${when} 출시`,
  grade: '등급',
  whenRead: '언제 읽나', passed: ' · 지남', passedHelp: '그 스토리를 이미 봤다 — 지금 봐도 넘긴 빈틈이 채워진다',
  pre: '선행',
  preFor: '이 스토리가 선행인 곳',
  basisScene: '장면', touch: '이어지는 필수 스토리', lead: '주역', origin: '첫 이야기', endings: '결말',
  afterGrade: '여기까지 읽음 뒤에 나온 스토리',
  riseSince: (at) => `${at}부터`, riseBefore: (at, grade) => `${at} 앞에서는 ${grade}`,
  linked: '이어진 스토리',
  linkedEmpty: '이어진 스토리 없음',
  sceneLinks: '연결',
  sceneLinksEmpty: '이 장면에 걸린 연결 없음',
  linksFail: (msg) => `연결을 불러오지 못함 — ${msg}`,
  sameUnit: '이 스토리 안',
  inRangeNone: '여기까지 읽은 범위엔 없음',
  none: '없음',
  scenes: '장면',
  noScenes: '장면 없음',
  move: '이동',
  slips: '설정 오류 의심',
  hiddenStory: (at) => `여기까지 읽음(${at}) 뒤에 나온 스토리 — 아래는 스포일러일 수 있다`,
  skippedStory: '안 봤다고 고른 스토리 — 아래는 스포일러일 수 있다',
  hiddenThread: '아직 나오지 않은 떡밥',
  hiddenThreadNote: (at) => `여기까지 읽음(${at}) 뒤에 나오는 떡밥 — 이름 · 내용은 스포일러`,
  hiddenPerson: '아직 나오지 않은 인물',
  hiddenItem: '아직 나오지 않은 항목',
  hiddenTargetNote: (at) => `여기까지 읽음(${at}) 안에서는 아직 이름이 나오지 않았다 — 이름 · 내용은 스포일러`,
  spoiler: (n) => `여기까지 읽음 뒤 — 스포일러 보기${n != null ? ` (${n})` : ''}`,
  aliases: '다른 이름',
  first: '처음 등장',
  nameOnly: '이름만 나옴',
  appearOnly: '등장만',
  samePerson: '같은 인물',
  sameItem: '같은 항목',
  firstAt: '처음 나온 곳',
  unitsN: (n) => `나온 스토리 ${n}편`,
  state: '상태',
  related: '관련',
  relations: '다른 떡밥과의 관계',
  // 기록 패널
  before: '이전', after: '이후', changedAt: '바뀐 장면', when: '때', years: '연도',
  question: '의문', fact: '사실', answer: '답', replacedBy: '대신 알려진 사실',
  story: '이야기', via: '거쳐 온 곳', endAt: '끝난 곳', members: '함께 맺는 것', points: '가리키는 것',
  guessWhy: '추정한 이유', flow: '이어진 흐름', where: '나온 곳', scene: '장면',
  tickUnits: '이때 나온 스토리',
  noTick: '자리를 찾을 수 없음',
};

export function init(deps) {
  ({ root, state, data, fmt, ui } = deps);
  root.setAttribute('aria-label', LABELS.aria);
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
    if (parsed.type === 'unit' || parsed.type === 'scene') await Promise.all([loadSynopsis(), loadBlurbs()]);
    if (parsed.type === 'person') await loadPeople(); // 인물 머리의 '처음 등장' — 인물 탭과 같은 파일
    if (['unit', 'record', 'thread'].includes(parsed.type)) await loadFlow(); // 떡밥 묶음 거르기(W15d)
    if (current !== sel) return; // 그새 다른 것을 골랐다
    ui.clear(root);
    const render = RENDER[parsed.type];
    if (!render) {
      root.append(head(LABELS.cantOpen), ui.empty(LABELS.unknownSel(sel)));
      return;
    }
    render(parsed.id, idx);
    root.scrollTop = 0;
    root.querySelector('.reader-close')?.focus({ preventScroll: true });
  } catch (err) {
    ui.clear(root);
    root.append(head(LABELS.error), ui.notice(err.message, 'error'));
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
let guideCtx = null; // fmt.guideOf 재료(척추 · 선행 거꾸로) — 분류 칸 '언제 읽나'가 감상 순서 줄의 기한과 같게
async function loadOrder() {
  if (orderMap) return orderMap;
  try {
    const o = await data.load('order');
    orderMap = new Map(o.units.map((j) => [j.key, j]));
    preMap = o.pre ?? {};
    guideCtx = { spine: new Set(o.spine.map((s) => s.key)), pre: preMap, rev: fmt.preRev(preMap), judged: orderMap };
  } catch {
    orderMap = new Map(); // 못 받아도 리더는 쓴다
  }
  return orderMap;
}

let flowMap = null;
let flowReady = null;
/** threads-flow.json — 떡밥 묶음 거르기(fmt.threadBundle — W15d)의 재료. 못 받으면 묶음은 떡밥 전체를 아는 자리에서만 보인다 */
const loadFlow = () => (flowReady ??= data.load('threads-flow').then((f) => { flowMap = f; return f; }).catch(() => { flowMap = {}; return flowMap; }));
/** 떡밥의 그 자리 묶음 — { roots, echoes, whole }. 흐름을 못 받았으면 빈 묶음(떡밥 전체를 아는 자리면 전부) */
const bundleOf = (j, R) => fmt.threadBundle(j, flowMap?.[j.id] ?? { roots: [], echoes: [] }, R);
/** 그 자리에서 본 묶음(fmt.threadTies) — 기록 · 스토리가 그 떡밥과 이어진 줄 아나 */
const tiesOf = (j, R) => fmt.threadTies(j, flowMap?.[j.id] ?? { roots: [], echoes: [] }, R);
/** 기록이 그 떡밥과 이어진 줄 그 자리에서 아나 — 아는 묶음 뿌리이거나, 그 본 단계 줄 · 본 복선의 기록 */
function tiedRecord(r, j, R) {
  const t = tiesOf(j, R);
  return t.started && (t.whole || t.ids.has(r.id));
}
/** 스토리가 그 떡밥과 이어진 줄 그 자리에서 아나 — 아는 묶음 뿌리의 본 단계 · 본 복선이 그 스토리에 있다 */
function tiedUnit(key, j, R) {
  const t = tiesOf(j, R);
  return t.started && (t.whole || t.units.has(key));
}

let detailReady = null;
/** order-detail.json — 등급을 정한 기록 문장(basis_text). 분류 칸의 '장면' 줄을 그린 뒤 채운다 */
const loadDetail = () => (detailReady ??= data.load('order-detail').catch(() => null));
let preForMap = null;
/** 이 스토리를 선행으로 둔 스토리들(order.json pre 뒤집기) — [스토리 키, 단계] */
function preForOf(key) {
  if (!preForMap) {
    preForMap = new Map();
    for (const [k, p] of Object.entries(preMap)) for (const l of fmt.PRE_LEVEL) for (const [a] of p[l] ?? []) (preForMap.get(a) ?? preForMap.set(a, []).get(a)).push([k, l]);
  }
  return preForMap.get(key) ?? [];
}
let personByName = null;
/** 주역 — 첫 이야기인 인물 + 이 스토리에 사실 · 변화가 있는 주역(lead_facts '네온(ch01) 사실 3 / …'의 이름만 — 개수는 싣지 않는다) */
function leadsOf(j, idx) {
  personByName ??= new Map(idx.targetList.filter((t) => t.type === 'person').map((t) => [t.name, t]));
  const names = String(j.lead_facts ?? '').split(/\s*\/\s*/).map((x) => x.replace(/\(.*$/, '').trim()).filter(Boolean);
  const ids = [...new Set([...(j.origin_of ?? []), ...names.map((n) => personByName.get(n)?.id).filter(Boolean)])];
  return ids.map((p, i) => [i ? ' · ' : null, ui.link(`person:${p}`, fmt.targetName(p)), j.origin_of?.includes(p) ? ui.el('span', { class: 'muted' }, ` (${LABELS.origin})`) : null]);
}
/** 결말 — closures 'O9(관계 · 지휘관 · 확정) O14(갈등 · 확정)' → 결말 기록 링크(글자는 갈래 '관계' · '갈등', ID는 내지 않는다) */
const endingsOf = (j) => [...String(j.closures ?? '').matchAll(/(?<![A-Za-z0-9])(O\d+)\(([^()·]+)/g)]
  .map(([, id, aspect], i) => [i ? ' · ' : null, ui.link(`record:${id}`, aspect.trim())]);

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

let blurbMap = null;
let blurbReady = null;
/** blurbs.json(팬용 문장 — 확정되고 낡지 않은 것만) — 스토리 키 → { why?, when? }. 못 받거나 없는 칸은 거른 판정 문장을 보인다 */
function loadBlurbs() {
  return (blurbReady ??= data.load('blurbs').then((list) => {
    blurbMap = new Map(list.map((x) => [x.key, x]));
  }).catch(() => { /* 없어도 판정 문장으로 */ }));
}

let people = null; // { byUnit(스토리 → [{ id, speaker, lines, implied }]), byPerson(인물 → 같은 줄들) }
let peopleReady = null;
/** persons-detail.json(인물 탭과 같은 파일) — 스토리별 나온 인물 · 인물별 처음 등장. 못 받으면 칸을 그리지 않는다 */
function loadPeople() {
  return (peopleReady ??= data.load('persons-detail').then((list) => {
    const byUnit = new Map();
    const byPerson = new Map();
    for (const p of list) {
      const rows = (p.units ?? []).map((x) => ({ id: p.id, unit: x.unit, speaker: x.speaker ?? 0, lines: x.lines ?? 0, implied: x.implied ?? 0 }));
      byPerson.set(p.id, rows);
      for (const r of rows) (byUnit.get(r.unit) ?? byUnit.set(r.unit, []).get(r.unit)).push(r);
    }
    people = { byUnit, byPerson };
  }).catch(() => { /* 없어도 리더는 쓴다 */ }));
}


/** 공개 개요 칸 — 여기까지 읽음 뒤 스토리면 접어서 가린다 */
function synopsisPanel(key, hidden) {
  const x = synopsisMap?.get(key);
  if (!x) return null;
  const body = [ui.el('p', { class: 'rd-logline' }, x.logline), ...x.synopsis.split(/\n\s*\n/).map((t) => ui.el('p', { class: 'rd-synopsis' }, t.trim()))];
  const ai = ui.el('span', { class: 'ai-tag', title: fmt.AI_NOTE.full }, fmt.AI_NOTE.tag);
  return ui.panel(LABELS.synopsis, hidden ? ui.details(spoilerSummary(), body, { class: 'spoiler' }) : body, { class: 'rd-synopsis-panel', actions: ai });
}

const PEOPLE_CAP = 12; // 먼저 보이는 초상 수 — 나머지는 "더 보기"
/** 나오는 인물 — 그 스토리에서 말한 인물(많이 말한 순, 지휘관은 어디에나 나와서 뺀다). 파일이 오면 채운다. 여기까지 읽음 뒤 스토리면 접어서 가린다 */
function peoplePanel(key, hidden, idx) {
  const body = ui.el('div', { class: 'rd-people-wrap' });
  const panel = ui.panel(LABELS.people, hidden ? ui.details(spoilerSummary(), body, { class: 'spoiler' }) : body, { class: 'rd-people-panel' });
  panel.hidden = true;
  const sel = current;
  loadPeople().then(() => {
    if (current !== sel || !people) return;
    // 본 스토리면 그 자리에서 이름이 나온 인물만, 그 자리의 이름으로('???'로만 말한 인물은 뺀다 — W15b). 접은 스토리는 전부
    const R = hidden ? null : state.reading();
    const list = (people.byUnit.get(key) ?? []).filter((r) => r.speaker > 0 && r.id !== 'person:지휘관' && idx.targets.has(r.id) && fmt.met(idx.targets.get(r.id), R)).sort((a, b) => b.speaker - a.speaker);
    if (!list.length) return;
    const T = state.get().t;
    const face = (r) => {
      const t = idx.targets.get(r.id);
      const icon = fmt.iconAt(t, T);
      const name = fmt.nameAt(t, R) ?? t.name;
      return ui.link(`person:${r.id}`, [
        icon ? ui.portrait(icon, { size: 44, class: 'rd-face' }) : ui.el('span', { class: 'rd-face rd-face-blank', 'aria-hidden': 'true' }, [...name][0]),
        ui.el('span', { class: 'rd-person-name' }, name)], { class: 'rd-person', title: name });
    };
    const first = list.slice(0, PEOPLE_CAP);
    const rest = list.slice(PEOPLE_CAP);
    put(body, ui.el('div', { class: 'rd-people' }, first.map(face)),
      rest.length ? ui.details(LABELS.more(rest.length), ui.el('div', { class: 'rd-people' }, rest.map(face))) : null);
    panel.hidden = false;
  });
  return panel;
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
const clipText = (s, n) => ([...String(s ?? '')].length > n ? `${[...s].slice(0, n).join('')}…` : String(s ?? ''));

/** 기록으로 가는 링크 — 글자는 기록 문장(줄임), ID가 아니다 */
function recLink(id, n = 48) {
  const r = idx0()?.records?.get(id);
  return ui.link(`record:${id}`, r ? clipText(fmt.recordText(r) || fmt.recordLabel(r), n) : fmt.RECORD_KIND[String(id).replace(/\d.*$/, '')]?.label ?? '자세히');
}
/**
 * 왜 이어졌나 — 선들(센 것부터) 가운데 기록이 있으면 그 문장(누르면 기록), 같은 인물 · 소재 선이면 그 이름들. 다음 편 · 선행처럼 종류 이름으로 아는 선은 쓰지 않는다.
 * 강도 · 장면 쌍 수 · 자동 메모('흔한 대상' 같은 작업 말)는 싣지 않는다
 */
function linkWhy(edges, idx) {
  const rec = edges.find((e) => e.record && idx.records?.has(e.record));
  if (rec) return recLink(rec.record, 70);
  const targets = [...new Set(edges.map((e) => e.target).filter(Boolean))];
  if (!targets.length) return null;
  return [joinNodes(targets.slice(0, 4).map((t) => ui.link(`${t.startsWith('person:') ? 'person' : 'target'}:${t}`, fmt.targetName(t)))), targets.length > 4 ? ' …' : null];
}

/** 선들을 선 종류별로 묶어 그린다 — rows: [{ type, node, s, n, order }]. 종류마다 LINK_CAP줄, 나머지는 접는다 */
function linkGroups(rows) {
  const out = [];
  for (const type of fmt.LINK_TYPE_ORDER) {
    const list = rows.filter((r) => r.type === type).sort((a, b) => b.s - a.s || b.n - a.n || a.order - b.order);
    if (!list.length) continue;
    const h = ui.el('h4', { class: 'rd-type', title: fmt.help('link', type) }, fmt.LINK_TYPE[type].label);
    const first = list.slice(0, LINK_CAP);
    const rest = list.slice(LINK_CAP);
    out.push(ui.el('div', { class: 'rd-group' }, h,
      ui.el('ul', { class: 'rd-links' }, first.map((r) => r.node)),
      rest.length ? ui.details(LABELS.more(rest.length), ui.el('ul', { class: 'rd-links' }, rest.map((r) => r.node))) : null));
  }
  return out;
}

/** 연결 칸을 채운다 — 컷오프 뒤 상대는 스포일러 접이로 */
function fillLinks(body, rows, emptyText) {
  ui.clear(body);
  if (!rows.length) { body.append(ui.empty(emptyText)); return; }
  const before = rows.filter((r) => !r.after);
  const after = rows.filter((r) => r.after);
  if (before.length) body.append(...linkGroups(before)); else body.append(ui.empty(LABELS.inRangeNone));
  if (after.length) body.append(ui.details(spoilerSummary(after.length), linkGroups(after), { class: 'spoiler' }));
}

/** 스토리 패널의 연결: 상대 스토리마다 한 줄(선 종류별) + 가장 센 선의 '왜' */
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
    const sorted = [...g.edges].sort((a, b) => b.s - a.s || (b.record ? 1 : 0) - (a.record ? 1 : 0));
    const u = idx.units.get(g.other);
    const self = g.other === key;
    const after = Boolean(u) && !state.seen(u.key);
    const why = linkWhy(sorted, idx);
    const node = ui.el('li', { class: ['rd-link', after ? 'after-cutoff' : ''] },
      ui.el('div', { class: 'rd-link-main' },
        self ? ui.el('span', {}, LABELS.sameUnit) : (u ? ui.link(`unit:${g.other}`, u.title) : ui.el('span', {}, fmt.unitTitle(g.other))),
        u && !self && u.kind !== 'main' ? ui.el('span', { class: 'rd-link-meta' }, fmt.KIND[u.kind]?.label ?? u.kind) : null),
      why ? ui.el('div', { class: 'rd-link-ev' }, why) : null);
    return { type: g.type, node, s: sorted[0].s, n: g.edges.length, order: u?.order ?? 9999, after };
  });
}

/** 씬 패널의 연결: 선 하나가 한 줄 — 상대 장면 · 상대 스토리 + 왜 */
function sceneLinkRows(id, edges, idx) {
  return edges.map((e) => {
    const mine = e.from === id;
    const other = mine ? e.to : e.from;
    const otherUnit = mine ? e.tu : e.fu;
    const sc = idx.scenes.get(other);
    const u = idx.units.get(otherUnit);
    const hidden = Boolean(u) && !state.seen(u.key);
    const node = ui.el('li', { class: ['rd-link', hidden ? 'after-cutoff' : ''] },
      ui.el('div', { class: 'rd-link-main' },
        sc ? ui.link(`scene:${other}`, fmt.sceneLabel(other)) : ui.el('span', {}, fmt.ref(other)),
        u ? ui.el('span', { class: 'rd-link-meta' }, ui.link(`unit:${otherUnit}`, u.title)) : null),
      linkWhy([e], idx) ? ui.el('div', { class: 'rd-link-ev' }, linkWhy([e], idx)) : null);
    return { type: e.type, node, s: e.s, n: 1, order: u?.order ?? 9999, after: hidden };
  });
}

/** 연결을 body에 채운다 — links-scenes.json이 오면(받는 동안 spinner) */
function loadLinksInto(body, idx, { sel, pick, build, emptyText }) {
  ui.clear(body);
  body.append(ui.spinner());
  loadLinks().then((li) => {
    if (current !== sel) return;
    fillLinks(body, build(pick(li), idx), emptyText);
  }).catch((err) => {
    if (current !== sel) return;
    ui.clear(body);
    body.append(ui.empty(LABELS.linksFail(err.message)));
  });
}

/** 접는 칸 — 펼 때 처음 그린다(build(body)). 패널과 같은 모양의 머리 */
function fold(title, build, { open = false, cls = '' } = {}) {
  const body = ui.el('div', { class: 'rd-fold-body' });
  const d = ui.el('details', { class: ['panel', 'rd-fold', cls], open }, ui.el('summary', { class: 'rd-fold-head' }, ui.el('h3', {}, title)), body);
  let built = false;
  const fill = () => { if (built || !d.open) return; built = true; build(body); };
  d.addEventListener('toggle', fill);
  if (open) fill();
  return d;
}

/** 'CH.07 재회' → 굵은 CH 표기 + 이름 */
const chTitle = (title) => { const m = /^(CH\.\d+)\s*(.*)$/.exec(title ?? ''); return m ? [ui.el('span', { class: 'ch' }, m[1]), m[2] ? ` ${m[2]}` : null] : title; };
/** 등급 → 띠 색 글자 꾸밈(style.css .g-label) — 참고 · 독립은 회색, 필수(척추)는 잉크 */
const GRADE_TONE = { 참고: 'is-quiet', 독립: 'is-quiet', 척추: 'is-spine' };

/** 스토리 머리의 회색 한 줄 — 등급 이름(그 시점) · 종류(메인은 빼고) · 출시 날짜(메인은 날짜만 — 제목에 CH가 있다) */
function unitSub(u, j) {
  const g = u.kind === 'main' ? null : j ? fmt.gradeAt(j, state.reading()) : (u.grade === '척추' ? '척추' : null);
  const date = u.date ?? idx0()?.ticks.get(u.tick)?.date ?? null;
  const when = u.kind === 'main' ? date : [fmt.tickShort(u.tick), date].filter(Boolean).join(' · ');
  const parts = [
    g ? ui.el('span', { class: ['g-label', 'rd-grade', GRADE_TONE[g] ?? ''], title: fmt.help('grade', g) }, fmt.GRADE[g]?.label ?? g) : null,
    u.kind !== 'main' ? ui.el('span', { title: fmt.help('kind', u.kind) }, fmt.KIND[u.kind]?.label ?? u.kind) : null,
    when ? ui.el('span', {}, LABELS.release(when)) : null,
  ].filter(Boolean);
  return parts.length ? joinDots(parts) : null;
}

/** 작중 순 — 출시 무렵과 다른 때의 이야기(과거 · 앞선 · 나중)일 때만. 같은 무렵 · 가리기 어려움 · 시점 판정 말은 쓰지 않는다 */
function chronoRow(u) {
  const c = u.chrono;
  if (!c?.drift || !['과거', '앞', '뒤'].includes(c.drift)) return null;
  return row(fmt.TERM.chronoPlace, [tip(fmt.DRIFT[c.drift] ?? c.drift, fmt.help('drift', c.drift)), c.place ? ui.el('span', { class: 'muted' }, ` · ${fmt.placeLabel(c.place)}`) : null]);
}

/** 스토리 패널의 분류 칸 — 그 시점 등급 · 언제 읽나 · 선행 · 작중 순(예외만) · 이유. 메인은 등급을 쓰지 않는다(당연하다) */
function classPanel(u, idx, hidden) {
  const j = orderMap?.get(u.key);
  const action = state.get().tab === 'order' ? null : tabAction('order', {}, { sel: `unit:${u.key}` }); // 감상 순서 탭 안에서는 자기 탭 링크를 달지 않는다
  const p = preMap[u.key];
  // 선행 스토리 — 칸마다 한 줄(필수 · 권장 · 선택), 스토리 이름만. 왜 선행인가(떡밥 → 회수 · 다시 언급 등)는 스포일러가 될 수 있어 싣지 않는다(사용자, 2026-10-10)
  const preRow = p ? row(LABELS.pre, fmt.PRE_LEVEL.filter((l) => p[l]?.length).map((l) => ui.el('div', {},
    ui.el('b', { title: fmt.help('pre', l) }, `${fmt.PRE_LABEL[l]} `),
    p[l].map(([k], i) => [i ? ' · ' : null, ui.link(`unit:${k}`, fmt.unitTitle(k))])))) : null;
  const back = preForOf(u.key).filter(([x]) => state.seen(x));
  const preForRow = back.length ? row(LABELS.preFor, back.map(([x, l], i) => [i ? ' · ' : null, ui.link(`unit:${x}`, fmt.unitTitle(x)), ui.el('span', { class: 'muted' }, ` ${fmt.PRE_LABEL[l]}`)])) : null;
  const chrono = chronoRow(u);
  if (!j) {
    const rows = [preRow, preForRow, chrono].filter(Boolean);
    if (u.grade === '척추') return ui.panel(fmt.TERM.judgment, [ui.el('div', { class: 'chips' }, ui.chip('grade', '척추')), rows.length ? kv(rows) : null], { actions: action });
    return rows.length ? ui.panel(fmt.TERM.judgment, kv(rows), { actions: action }) : null;
  }
  const t = T();
  const g = fmt.gradeAt(j, state.reading());
  const spineName = (k) => { const s = idx.units.get(k); return s?.kind === 'main' ? fmt.tickShort(s.tick) : fmt.unitTitle(k); };
  // 등급 칩 + (추정일 때만) 점선 '추정' — 확실은 당연해서 쓰지 않는다
  const gradeRow = [ui.chip('grade', g ?? j.grade), j.confidence === '추정' ? [' ', ui.chip('confidence', '추정')] : null];
  if (g == null) gradeRow.push(' ', ui.el('span', { class: 'muted' }, LABELS.afterGrade));
  else if (g !== j.grade) gradeRow.push(' ', ui.el('span', { class: 'muted' }, ['→ ', ui.link(`unit:${j.from}`, spineName(j.from)), '부터 '], ui.chip('grade', j.grade)));
  else if (j.from_tick) gradeRow.push(' ', ui.el('span', { class: 'muted' }, t == null ? LABELS.riseBefore(spineName(j.from), fmt.GRADE[j.before ?? j.grade]?.label) : LABELS.riseSince(spineName(j.from))));
  // 이유 = 팬용 문장(W14 — 뒤 스토리 내용은 gate를 봤을 때만 later로 붙는다, 줄이지 않는다), 없거나 낡았으면 판정 과정 마디를 걷은 판정 문장(W13b — 90자로 줄여 접는다)
  const blurb = blurbMap?.get(u.key)?.why;
  const full = blurb ? fmt.blurbText(blurb, state.seen) : fmt.reasonText(j.reason ?? '');
  const short = blurb ? full : clipText(full, 90);
  const before = j.from && idx.units.has(j.from) && u.order < idx.units.get(j.from).order;
  const due = guideCtx ? fmt.guideOf(u.key, { ...guideCtx, units: idx.units }).due : null; // 감상 순서 줄의 'CH.27 전까지'와 같은 기한
  // 그 기한 스토리를 이미 봤으면 '· 지남'(감상 순서 줄과 같다 — 본 것은 사람이 정하는 메인 챕터 · 팝업 체크 칸 스토리만)
  const dueUnit = due && idx.units.get(due.key);
  const duePassed = Boolean(dueUnit && (dueUnit.kind === 'main' || state.checkable(due.key)) && state.get().t != null && state.seen(due.key));
  // 판정 문장은 최종 등급의 것이라, 뒤 필수 스토리로 오른 스토리면 그 스토리를 안 본 사람에게 뒤 내용이 보인다 — 스포일러 접이로
  const lateReason = !blurb && full && !hidden && before && !state.seen(j.from);
  // 여기까지 읽음 뒤 스토리는 이유도 아래 내용 칸과 함께 스포일러 접이 하나에 넣는다
  const reason = !full || hidden ? null
    : lateReason ? ui.details(spoilerSummary(), ui.el('div', { class: 'rd-why-full' }, full), { class: 'spoiler' })
      : short === full ? ui.el('div', {}, full) : ui.details(short, ui.el('div', { class: 'rd-why-full' }, full));
  // 감상 순서 카드에 있던 칸(W13 — 카드를 리더 하나로 합쳤다): 장면(등급을 정한 기록의 장면 + 그 기록 문장) · 이어지는 필수 스토리 · 주역 · 결말
  const basisText = ui.el('div', { class: 'rd-basis-text' });
  const sel = current;
  if (j.basis) loadDetail().then((d) => { const x = d?.units?.[u.key]; if (current === sel && x?.basis_text) basisText.textContent = fmt.prose(x.basis_text); });
  const leads = leadsOf(j, idx);
  const endings = endingsOf(j);
  const story = [
    hidden && full ? row(fmt.TERM.basis, ui.el('div', { class: 'rd-why-full' }, full)) : null,
    j.basis ? row(j.basis_scene ? LABELS.basisScene : fmt.RECORD_KIND[j.basis_kind]?.label ?? LABELS.basisScene, [j.basis_scene ? ui.link(`scene:${j.basis_scene}`, fmt.ref(j.basis_scene)) : null, basisText]) : null,
    j.from && !j.from_tick && !before && idx.units.has(j.from) ? row(LABELS.touch, ui.link(`unit:${j.from}`, spineName(j.from))) : null,
    leads.length ? row(LABELS.lead, leads) : null,
    endings.length ? row(LABELS.endings, endings) : null,
  ].filter(Boolean);
  return ui.panel(fmt.TERM.judgment, [kv([
    row(t == null ? LABELS.grade : fmt.TERM.gradeAt, ui.el('span', {}, gradeRow)),
    due ? row(LABELS.whenRead, [ui.link(`unit:${due.key}`, fmt.preOf(spineName(due.key))), duePassed ? ui.el('span', { class: 'muted', title: LABELS.passedHelp }, LABELS.passed) : null]) : null,
    preRow,
    preForRow,
    chrono,
    row(fmt.TERM.basis, reason),
    ...(hidden ? [] : story),
  ]), hidden && story.length ? ui.details(spoilerSummary(), kv(story), { class: 'spoiler' }) : null], { actions: action });
}

/**
 * 스토리에 걸린 떡밥 — 이 스토리 기록 · 분류가 짚은 떡밥. 떡밥이 아직 안 나왔거나(fmt.threadStarted), 이 스토리가 그 떡밥과 이어진 줄
 * 그 자리에서 모르면(묶음 안 뿌리 · 복선의 단계가 이 스토리에 없음 — W15d) 스포일러 접이로
 */
function unitThreads(key, recs, idx) {
  const ids = new Set(orderMap?.get(key)?.threads ?? []);
  for (const r of recs) for (const j of r.threads ?? []) ids.add(j);
  const list = [...ids].map((id) => idx.threads.get(id)).filter(Boolean)
    .sort((a, b) => (fmt.majorThread(b) ? 1 : 0) - (fmt.majorThread(a) ? 1 : 0) || (a.first_order ?? 0) - (b.first_order ?? 0));
  const R = state.reading();
  const shownJ = (j) => fmt.threadStarted(j, R) && tiedUnit(key, j, R);
  return { before: list.filter(shownJ), after: list.filter((j) => !shownJ(j)) };
}
/** 떡밥 한 줄 — 이름은 그 자리 판(fmt.threadLabel). folded면 스포일러 접이 안이라 떡밥 전체 이름(마지막 판 · 분석용) */
const threadLine = (j, folded = false) => ui.el('li', { class: 'rd-thread' }, ui.link(`thread:${j.id}`, fmt.threadLabel(j, folded ? null : state.reading())),
  fmt.majorThread(j) ? ui.el('span', { class: 'rd-link-meta', title: fmt.help('weight', j.weight) }, ` ${fmt.majorThread(j)}`) : null);

const needsRecords = (type) => ['scene', 'record', 'unit', 'person', 'target', 'thread'].includes(type);

function head(title, chips = [], sub = null, pic = null) {
  return ui.el('header', { class: 'reader-head' },
    pic,
    ui.el('div', { class: 'reader-title' },
      title ? ui.el('h2', {}, title) : null,
      sub ? ui.el('div', { class: 'reader-sub' }, sub) : null,
      chips.filter(Boolean).length ? ui.el('div', { class: 'chips' }, chips) : null),
    ui.el('button', { type: 'button', class: 'btn reader-close', 'aria-label': LABELS.close, title: LABELS.closeTip, onClick: () => state.set({ sel: '' }) }, ui.icon('close')));
}
/** null을 건너뛰는 append(네이티브 append는 null을 글자 "null"로 만든다) */
const put = (node, ...kids) => { for (const k of kids) if (k != null && k !== false) node.append(k); return node; };
const row = (k, v) => (v == null || v === '' || (Array.isArray(v) && !v.length) ? null : ui.el('div', { class: 'kv' }, ui.el('dt', {}, k), ui.el('dd', {}, v)));
const kv = (rows) => ui.el('dl', { class: 'kvs' }, rows);
const T = () => state.get().t;
const tip = (text, title) => ui.el('span', { title }, text);
/** 링크 목록을 ' · '로 이어 붙인다 */
const joinNodes = (nodes) => nodes.map((n, i) => [i ? ' · ' : null, n]);
/** 회색 한 줄 조각을 가는 점으로 잇는다 */
const joinDots = (nodes) => nodes.map((n, i) => [i ? ui.el('span', { class: 'rd-sep', 'aria-hidden': 'true' }, '·') : null, n]);
/** "여기까지 읽음 뒤" 스포일러 접힘의 제목 */
const spoilerSummary = (n) => LABELS.spoiler(n);
const cutoffName = () => fmt.tickShort(T());

/** 기록 한 줄 — 종류 칩 · 추정 · 상태 · 문장(누르면 자세히) · 장면 링크. ID는 내지 않는다. "여기까지 읽음" 뒤면 흐리게 */
function recordLine(r, { showUnit = false, kind = true } = {}) {
  const hidden = !state.known(r);
  const st = fmt.stateAt(r, state.reading());
  return ui.el('li', { class: ['record-line', hidden ? 'after-cutoff' : ''] },
    ui.el('div', { class: 'chips' },
      kind ? ui.chip('record', r.kind, fmt.recordLabel(r)) : null,
      r.confidence === '추정' ? ui.chip('confidence', '추정') : null,
      st && st !== '앎' ? ui.chip('state', st) : null),
    ui.el('div', { class: 'record-text' }, ui.link(`record:${r.id}`, fmt.recordText(r) || fmt.recordLabel(r), { class: 'record-open' })),
    ui.el('div', { class: 'record-ref' },
      showUnit && r.unit ? [ui.link(`unit:${r.unit}`, fmt.unitTitle(r.unit)), ' · '] : null,
      r.evidence?.length ? joinNodes([...new Set(r.evidence.map((e) => e.scene))].map((sc) => ui.link(`scene:${sc}`, fmt.refIn(sc, r.unit)))) : null));
}

/** 기록 목록을 "여기까지 읽음" 앞 · 뒤로 갈라 그린다 — 뒤는 details 안 */
function recordList(records, opts = {}) {
  if (!records?.length) return ui.empty(LABELS.none);
  const R = state.reading();
  const order = (r) => (fmt.RECORD_ORDER.indexOf(r.kind) + 1 || 99);
  const sorted = [...records].sort((a, b) => order(a) - order(b) || (a.line ?? 0) - (b.line ?? 0) || String(a.id).localeCompare(String(b.id)));
  // opts.shown — 아는 기록 가운데 더 거를 것(떡밥 묶음 밖 — W15d). 걸린 것은 모르는 기록과 함께 접이에
  const before = sorted.filter((r) => R.known(r) && (!opts.shown || opts.shown(r)));
  const after = sorted.filter((r) => !before.includes(r));
  return ui.el('div', { class: 'record-lists' },
    before.length ? ui.el('ul', { class: 'records' }, before.map((r) => recordLine(r, opts))) : ui.empty(LABELS.inRangeNone),
    after.length ? ui.details(spoilerSummary(after.length), ui.el('ul', { class: 'records' }, after.map((r) => recordLine(r, opts))), { class: 'spoiler' }) : null);
}

/** 기록 묶음의 패널 이름 — 묶음 말(분석 메모) 대신 든 종류 이름을 늘어놓는다(W13 용어표): '사실 · 의문 · 변화' */
const kindsTitle = (records) => {
  const kinds = [...new Set((records ?? []).map((r) => r.kind))].sort((a, b) => fmt.RECORD_ORDER.indexOf(a) - fmt.RECORD_ORDER.indexOf(b));
  return [...new Set(kinds.map((k) => fmt.RECORD_KIND[k]?.label ?? k))].join(' · ');
};

/** 인물의 처음 등장(여기까지 읽음 안 — 본 스토리 가운데 가장 앞) + 그 스토리에서 말이 없을 때만 '이름만 나옴'(이름은 나옴) · '등장만'(이름 없이 모습만). 인물 탭 머리(quietOf)와 같은 규칙 */
function firstAppearance(pid, idx) {
  const rows = people?.byPerson.get(pid) ?? [];
  const R = state.reading();
  const seen = rows.filter((x) => idx.units.has(x.unit) && R.seen(x.unit));
  if (!seen.length) return null;
  const first = seen.reduce((a, b) => ((idx.units.get(a.unit).order ?? 0) <= (idx.units.get(b.unit).order ?? 0) ? a : b));
  return { unit: first.unit, how: first.speaker > 0 ? null : first.lines > 0 ? LABELS.nameOnly : LABELS.appearOnly };
}

/**
 * 사전 설명 — fmt.prose 뒤에 사전 작업 메모 문장('아크'(낱말 앞 539줄)는 … · 별칭으로 두지 않았다 · speakers.json …)을 문장째 뺀다.
 * 세계 탭은 내보낼 때 같은 문장을 걷는다(tools/site/export/world.mjs cleanNote) — targets.json 설명은 안 걷혀 와서 여기서 한 번 더
 */
const NOTE_WORK = /1회독|2회독|Q-[A-Z]*\d*-?\d+|RV\d|speakers\.json|별칭으로|약칭으로|넣지 않았|두지 않았|대상은 따로|낱말 앞/; // world.mjs cleanNote와 같은 말
const noteText = (raw) => String(fmt.prose(raw) ?? '').split(/(?<=[.)])\s+(?=[^\s)])/).filter((x) => x.trim() && !NOTE_WORK.test(x)).join(' ').trim();
/** 그 자리 사전 설명(W15e — fmt.noteAt 판). 판이 없으면 전부 보기에서만 분석용 설명(작업 문장을 걷은 것) */
const noteAtText = (t) => fmt.noteAt(t, state.reading(), noteText(t.note) || null);

/** 시간 단서 한 칸 [관계, 기준 키, 간격] → 'CH.01 침식 직전 · 46시간' */
const atText = (a) => {
  if (!Array.isArray(a)) return fmt.prose(String(a));
  const [rel, key, span] = a;
  const name = idx0()?.units.has(key) ? fmt.unitTitle(key) : fmt.prose(String(key ?? ''));
  return [name, rel].filter(Boolean).join(' ') + (span ? ` · ${span}` : '');
};
/** 바뀐 장면 — 계기 [{ scene, lines }] → 장면 링크(줄 번호는 내지 않는다) */
const sceneLinks = (list) => (Array.isArray(list) ? joinNodes([...new Set(list.map((x) => x?.scene).filter(Boolean))].map((sc) => ui.link(`scene:${sc}`, fmt.ref(sc)))) : fmt.prose(list));

const RENDER = {
  unit(key, idx) {
    const u = idx.units.get(key);
    if (!u) return root.append(head(LABELS.notFound), ui.empty(LABELS.notFound));
    const hidden = !state.seen(u.key);
    const j = orderMap?.get(key);
    // 머리 그림 — 호감도는 니케 초상, 메인 밖 다른 종류는 종류 아이콘을 같은 크기 원 안에(사용자, 2026-10-10)
    const icon = fmt.episodeIcon(u);
    const kindPic = icon ? null : ui.kindIcon(u.kind, { size: 30 });
    const pic = icon ? ui.portrait(icon, { size: 56, class: 'reader-pic rd-face' }) : kindPic ? ui.el('span', { class: 'reader-pic rd-face rd-kind-pic' }, kindPic) : null;
    root.append(head(u.kind === 'main' ? chTitle(u.title) : u.title, [], unitSub(u, j), pic));
    // 메인 위치 앞에 나왔는데 안 봤으면 '안 봤다고 고른 스토리'(척추 이벤트 · 사이드 체크)
    if (hidden) root.append(ui.notice(state.visible(u.tick) ? LABELS.skippedStory : LABELS.hiddenStory(cutoffName()), 'warn'));
    const syn = synopsisPanel(key, hidden);
    if (syn) root.append(syn);
    root.append(peoplePanel(key, hidden, idx));
    const cls = classPanel(u, idx, hidden);
    if (cls) root.append(cls);
    const scenes = idx.scenesOf.get(key) ?? [];
    const recs = idx.recordsOfUnit.get(key) ?? [];
    // 이어진 스토리 · 떡밥은 접어 둔다 — 이어진 스토리는 펼 때 links-scenes.json을 받는다
    const sel = current;
    root.append(fold(LABELS.linked, (body) => {
      body.append(ui.el('div', { class: 'rd-open' }, tabLink('links', { c: key })));
      const box = ui.el('div', { class: 'rd-lazy' });
      // '왜'가 이 스토리의 기록 문장이라 여기까지 읽음 뒤 스토리면 통째로 가린다
      body.append(hidden ? ui.details(spoilerSummary(), box, { class: 'spoiler' }) : box);
      loadLinksInto(box, idx, { sel, pick: (li) => li.byUnit.get(key) ?? [], build: (edges) => unitLinkRows(key, edges, idx), emptyText: LABELS.linkedEmpty });
    }));
    const th = unitThreads(key, recs, idx);
    if (th.before.length || th.after.length) {
      root.append(fold(fmt.TERM.thread, (body) => put(body,
        th.before.length ? ui.el('ul', { class: 'plain' }, th.before.map((j) => threadLine(j))) : ui.empty(LABELS.inRangeNone),
        th.after.length ? ui.details(spoilerSummary(th.after.length), ui.el('ul', { class: 'plain' }, th.after.map((j) => threadLine(j, true))), { class: 'spoiler' }) : null)));
    }
    // 장면 — 번호 · 제목(+ 판 · 호감도 Lv) + 씬 한 줄. 줄 수는 싣지 않는다
    root.append(ui.panel(LABELS.scenes, scenes.length ? ui.el('ol', { class: 'scene-list' }, scenes.map((s) =>
      ui.el('li', {}, ui.link(`scene:${s.id}`, fmt.sceneTitle(s.id) ? `${s.seq}. ${fmt.sceneTitle(s.id)}` : fmt.sceneName(s.id)), s.part || s.level ? ui.el('span', { class: 'muted' }, ` ${[s.part, s.level ? `Lv.${s.level}` : null].filter(Boolean).join(' · ')}`) : null,
        !hidden && sceneLineMap?.get(s.id) ? ui.el('div', { class: 'rd-scene-line' }, sceneLineMap.get(s.id)) : null))) : ui.empty(LABELS.noScenes)));
    if (recs.length) root.append(fold(kindsTitle(recs), (body) => body.append(recordList(recs))));
    slipsPanel(idx.slipsOf.get(key), hidden);
  },

  scene(id, idx) {
    const s = idx.scenes.get(id);
    if (!s) return root.append(head(LABELS.notFound), ui.empty(LABELS.notFound));
    const u = idx.units.get(s.unit);
    const recs = idx.recordsOf.get(id) ?? [];
    const sub = joinDots([u ? ui.link(`unit:${u.key}`, u.title) : null, s.part ? ui.el('span', {}, s.part) : null, s.level ? ui.el('span', {}, `Lv.${s.level}`) : null].filter(Boolean));
    root.append(head(fmt.sceneLabel(id), [], sub.length ? sub : null));
    const line = sceneLineMap?.get(id);
    if (line) {
      const p = ui.el('p', { class: 'rd-logline' }, line);
      root.append(u && !state.seen(u.key) ? ui.details(spoilerSummary(), p, { class: 'spoiler' }) : p);
    }
    const siblings = idx.scenesOf.get(s.unit) ?? [];
    const prev = siblings[s.seq - 2];
    const next = siblings[s.seq];
    if (prev || next) {
      root.append(ui.panel(null, kv([
        row(LABELS.move, ui.el('span', { class: 'nav' }, prev ? ui.link(`scene:${prev.id}`, `← ${fmt.sceneLabel(prev.id)}`) : null, prev && next ? ' · ' : null, next ? ui.link(`scene:${next.id}`, `${fmt.sceneLabel(next.id)} →`) : null)),
      ])));
    }
    const body = ui.el('div', { class: 'rd-lazy' });
    const spoil = u && !state.seen(u.key); // '왜'가 이 장면의 기록 문장 — 여기까지 읽음 뒤면 가린다
    root.append(ui.panel(LABELS.sceneLinks, spoil ? ui.details(spoilerSummary(), body, { class: 'spoiler' }) : body, { actions: u ? tabAction('links', { c: u.key }) : null }));
    loadLinksInto(body, idx, { sel: current, pick: (li) => li.byScene.get(id) ?? [], build: (edges) => sceneLinkRows(id, edges, idx), emptyText: LABELS.sceneLinksEmpty });
    if (recs.length) root.append(ui.panel(kindsTitle(recs), recordList(recs)));
    slipsPanel((idx.slipsOf.get(s.unit) ?? []).filter((x) => !x.scenes?.length || x.scenes.includes(id)), spoil);
  },

  record(id, idx) {
    const r = idx.records?.get(id);
    if (!r) return root.append(head(LABELS.notFound), ui.empty(LABELS.notFound));
    const hidden = !state.known(r);
    const st = fmt.stateAt(r, state.reading());
    root.append(head(fmt.recordLabel(r), [r.confidence === '추정' ? ui.chip('confidence', '추정') : null, st && st !== '앎' ? ui.chip('state', st) : null]));
    const recLinks = (ids) => ids?.length ? ui.el('ul', { class: 'plain' }, ids.map((c) => ui.el('li', {}, recLink(c)))) : null;
    const body = ui.el('div', {});
    body.append(ui.el('p', { class: 'record-full' }, fmt.recordText(r)));
    if (r.kind === 'D' && r.act === '변화') body.append(kv([row(LABELS.before, fmt.prose(r.before)), row(LABELS.after, fmt.prose(r.after)), row(LABELS.changedAt, r.trigger ? sceneLinks(r.trigger) : null), row(fmt.TERM.chronoPlace, r.time ? recLink(r.time) : null)]));
    // 시간 단서 — '때'(기준 스토리 + 관계 + 간격)와 연도만. 기준 · 대상 칸(작업 말)은 싣지 않는다
    if (r.kind === 'S') body.append(kv([row(LABELS.when, Array.isArray(r.at) && r.at.length ? r.at.map(atText).join(' · ') : null), row(LABELS.years, r.years)]));
    if (r.kind === 'Q-k' || r.kind === 'F-k') body.append(kv([row(r.kind === 'Q-k' ? LABELS.question : LABELS.fact, r.parent ? recLink(r.parent) : null), row(LABELS.answer, r.answer ? recLink(r.answer) : null), row(LABELS.replacedBy, r.replaced_by ? recLink(r.replaced_by) : null)]));
    if (r.kind === 'F' || r.kind === 'Q') {
      const at = (x) => (x != null ? fmt.tickLabel(x) : null);
      body.append(kv(r.kind === 'Q'
        ? [row(fmt.ACT.제기, at(r.first_tick)), row(fmt.ACT.암시, at(r.hint_tick)), row(fmt.ACT.일부, at(r.partial_tick)), row(fmt.ACT.회수, at(r.solved_tick)), row(LABELS.state, fmt.STATE[r.state]?.label ?? r.state)]
        : [row(fmt.ACT.암시, at(r.hint_tick)), row(fmt.ACT['처음 밝혀짐'], at(r.first_tick)), row(fmt.ACT.뒤집힘, r.reversed_tick != null ? [at(r.reversed_tick), r.replaced_by ? [' → ', recLink(r.replaced_by)] : null] : null)]));
    }
    if (r.kind === 'O') {
      // 결말의 흐름 '관계 person:세르반 ↔ person:지휘관' → 칸 이름 = 갈래(관계 · 갈등 · 성장), 값 = 누구의 이야기
      const m = /^(\S+)\s+(.+)$/.exec(String(r.chain ?? ''));
      const chainRow = m ? row(m[1], fmt.prose(m[2])) : row(LABELS.story, fmt.prose(r.chain));
      body.append(kv([chainRow, row(LABELS.via, r.built?.length ? joinNodes(r.built.map((b) => (/^[A-Z]\d/.test(b) ? recLink(b) : ui.link(`unit:${b}`, fmt.unitTitle(b))))) : null), row(fmt.ACT.회수, recLinks(r.closing)), row(LABELS.endAt, r.end ? ui.link(`unit:${r.end}`, fmt.unitTitle(r.end)) : null)]));
    }
    if (r.kind === 'H') body.append(kv([row(LABELS.endAt, r.end ? ui.link(`unit:${r.end}`, fmt.unitTitle(r.end)) : null), row(LABELS.members, recLinks(r.members))]));
    if (r.points?.length) body.append(kv([row(LABELS.points, recLinks(r.points))]));
    if (r.evidence?.length) body.append(ui.panel(LABELS.scene, ui.el('ul', { class: 'plain' }, [...new Set(r.evidence.map((e) => e.scene))].map((sc) => ui.el('li', {}, ui.link(`scene:${sc}`, fmt.ref(sc)))))));
    // 해석 이유는 추정일 때만 — 확실한 기록은 문장만으로 읽힌다. 못 바꾸는 이유 문장은 내지 않는다
    if (r.confidence === '추정' && fmt.prose(r.reason)) body.append(ui.panel(LABELS.guessWhy, ui.el('p', { class: 'reason' }, fmt.prose(r.reason))));
    if (r.about?.length) body.append(ui.panel(LABELS.related, ui.el('p', {}, joinNodes(r.about.map((a) => ui.link(`${a.startsWith('person:') ? 'person' : 'target'}:${a}`, fmt.targetName(a)))))));
    if (r.threads?.length) {
      // 이 기록이 그 떡밥과 이어진 줄 그 자리에서 알 때만 이름으로(떡밥 묶음 — W15d), 아니면 스포일러 접이에
      const R = state.reading();
      const js = r.threads.map((j) => idx.threads.get(j)).filter(Boolean);
      const tied = js.filter((j) => fmt.threadStarted(j, R) && tiedRecord(r, j, R));
      const rest = js.filter((j) => !tied.includes(j));
      body.append(ui.panel(fmt.TERM.thread, [
        tied.length ? ui.el('p', {}, joinNodes(tied.map((j) => ui.link(`thread:${j.id}`, fmt.threadLabel(j, R))))) : ui.empty(LABELS.inRangeNone),
        rest.length ? ui.details(spoilerSummary(), ui.el('p', {}, joinNodes(rest.map((j) => ui.link(`thread:${j.id}`, fmt.threadLabel(j, null))))), { class: 'spoiler' }) : null,
      ]));
    }
    const rootId = r.parent ?? ((r.kind === 'F' || r.kind === 'Q') ? r.id : null);
    if (rootId) {
      const rootRec = idx.records.get(rootId);
      const events = idx.eventsOf.get(rootId) ?? [];
      const others = [rootRec, ...events].filter((x) => x && x.id !== r.id);
      if (others.length) body.append(ui.panel(LABELS.flow, recordList(others, { showUnit: true })));
    }
    body.append(ui.panel(LABELS.where, kv([row(fmt.TERM.unit, r.unit ? ui.link(`unit:${r.unit}`, fmt.unitTitle(r.unit)) : null), row(LABELS.scene, r.scene ? ui.link(`scene:${r.scene}`, fmt.sceneName(r.scene)) : null), row(fmt.TERM.release, r.tick != null ? fmt.tickLabel(r.tick) : null)])));
    if (hidden) root.append(ui.details(spoilerSummary(), body, { class: 'spoiler' }));
    else root.append(body);
  },

  person(id, idx) {
    return RENDER.target(id, idx);
  },
  /** 인물 · 항목 — 인물은 인물 탭 머리와 같은 머리(초상 · 이름 · 소속 마크 · 다른 이름 · 처음 등장), 항목은 이름 + 회색 종류 · 갈래 + 사전 설명 */
  target(id, idx) {
    const t = idx.targets.get(id);
    if (!t) return root.append(head(LABELS.notFound), ui.empty(LABELS.notFound));
    const isPerson = t.type === 'person';
    const R = state.reading();
    // 아직 안 나온 인물 · 항목(이름이 쓰인 스토리를 안 봄) — 머리는 '아직 나오지 않은 …'만, 이름 · 초상부터 전부 스포일러 접이에(W15b — 떡밥 패널과 같게)
    const shown = fmt.met(t, R);
    if (!shown) {
      root.append(head(isPerson ? LABELS.hiddenPerson : LABELS.hiddenItem));
      root.append(ui.notice(LABELS.hiddenTargetNote(cutoffName()), 'warn'));
    }
    const out = shown ? root : ui.el('div', {});
    const RR = shown ? R : null; // 접이 안은 전부 보기와 같게 — 표준명 · 다른 이름 전부
    const same = fmt.sameAsKnown(t, R);
    const sameRow = same.length ? joinNodes(same.map((s) => ui.link(`${s.startsWith('person:') ? 'person' : 'target'}:${s}`, fmt.targetName(s)))) : null;
    const aliasList = fmt.aliasesAt(t, RR);
    const aliases = aliasList.length ? aliasList.map((a) => a.name).join(' · ') : null;
    const name = fmt.nameAt(t, RR) ?? t.name;
    const recs = idx.recordsAbout.get(id) ?? [];
    if (isPerson) {
      out.append(shown ? head(name, [ui.orgMarks(fmt.orgsAt(t, T(), { past: true }), { size: 16 })], null, ui.portrait(fmt.iconAt(t, T()), { size: 56, class: 'reader-pic' })) : ui.el('p', {}, ui.el('strong', {}, name)));
      const fa = firstAppearance(id, idx);
      out.append(ui.panel(null, kv([
        row(LABELS.aliases, aliases),
        row(LABELS.first, fa ? [ui.link(`unit:${fa.unit}`, fmt.unitTitle(fa.unit)), fa.how ? ui.el('span', { class: 'muted' }, ` · ${fa.how}`) : null] : null),
        row(LABELS.samePerson, sameRow),
      ]), { class: 'rd-person-head' }));
      out.append(ui.el('div', { class: 'rd-open' }, tabLink('persons', { who: id })));
    } else {
      const sub = [fmt.TARGET_TYPE[t.type] ?? t.type, t.kind].filter(Boolean).join(' · ');
      out.append(shown ? head(name, [], sub) : ui.el('p', {}, ui.el('strong', {}, name), ui.el('span', { class: 'muted' }, ` · ${sub}`)));
      out.append(ui.el('div', { class: 'rd-open' }, tabLink('world', { item: id })));
      const seenUnits = new Set(recs.map((r) => r.unit).filter((k) => k && state.seen(k)));
      out.append(ui.panel(null, [
        noteAtText(t) ? ui.el('p', { class: 'rd-note' }, noteAtText(t)) : null,
        kv([row(LABELS.aliases, aliases), row(LABELS.sameItem, sameRow)]),
        seenUnits.size ? ui.el('p', { class: 'rd-facts-line' }, LABELS.unitsN(fmt.num(seenUnits.size))) : null,
      ]));
    }
    if (recs.length) {
      const CAP = 200; // 넘으면 앞 200개 + 탭 링크(전체는 그 탭)
      out.append(fold(kindsTitle(recs), (body) => put(body, recordList(recs.slice(0, CAP), { showUnit: true }),
        recs.length > CAP ? ui.el('div', { class: 'rd-open' }, isPerson ? tabLink('persons', { who: id }) : tabLink('world', { item: id })) : null)));
    }
    if (!shown) root.append(ui.details(spoilerSummary(), out, { class: 'spoiler' }));
  },

  thread(id, idx) {
    const j = idx.threads.get(id);
    if (!j) return root.append(head(LABELS.notFound), ui.empty(LABELS.notFound));
    // 아직 안 나온 떡밥(fmt.threadStarted — 판이 있으면 첫 판의 at) — 머리는 '아직 나오지 않은 떡밥'만, 이름부터 전부 스포일러 접이에(W15a · W15d)
    const R = state.reading();
    const started = fmt.threadStarted(j, R);
    // 이름 · 요약은 그 자리 판(fmt.threadAt — W15d). 접이 안(아직 안 나옴)은 떡밥 전체 이름
    const at = fmt.threadAt(j, started ? R : null);
    const title = fmt.threadLabel(j, started ? R : null);
    if (!started) {
      root.append(head(LABELS.hiddenThread));
      root.append(ui.notice(LABELS.hiddenThreadNote(cutoffName()), 'warn'));
    }
    const out = started ? root : ui.el('div', {});
    const sub = joinDots([fmt.majorThread(j) ? ui.el('span', { title: fmt.help('weight', j.weight) }, fmt.majorThread(j)) : null].filter(Boolean));
    out.append(started ? head(title, [j.confidence === '추정' ? ui.chip('confidence', '추정') : null], sub.length ? sub : null) : ui.el('p', {}, ui.el('strong', {}, title)));
    out.append(ui.el('div', { class: 'rd-open' }, tabLink('threads', { j: id })));
    // 의문 · 사실은 떡밥 묶음(fmt.threadBundle — 그 자리에서 이 떡밥과 이어진 줄 아는 것, W15d)만 늘어놓고, 나머지는 recordList가 접이에
    const tiedIds = new Set(started ? bundleOf(j, R).roots.map((x) => x.id) : []);
    const recsOf = (ids) => (ids ?? []).map((x) => idx.records?.get(x)).filter(Boolean);
    const qs = recsOf(j.questions);
    const fs = recsOf(j.facts);
    // 상태 — 여기까지 읽음 안에서 아는 의문(묶음 안)만 센다(미해결 · 일부 회수 · 회수). 전체 수(스포일러)는 싣지 않는다
    const n = { 열림: 0, 일부: 0, 풀림: 0 };
    for (const q of qs) { if (!R.known(q) || !tiedIds.has(q.id)) continue; const s = fmt.stateAt(q, R); if (s in n) n[s]++; }
    const stateRow = Object.values(n).some(Boolean) ? joinNodes(Object.entries(n).filter(([, v]) => v).map(([k, v]) => ui.el('span', {}, ui.chip('state', k), ` ${v}`))) : null;
    const first = j.first_unit && idx.units.has(j.first_unit) && state.seen(j.first_unit) ? j.first_unit : null;
    // 관련 · 주역 — 그 자리에서 부르는 이름(fmt.nameAt — W15b). 아직 안 나온 대상은 빼고, 떡밥 전체를 아는 자리가 아니면
    // 묶음 안 아는 뿌리가 다루는 대상만(관련 칸도 묶음이다 — W15d). 접이 안(아직 안 나온 떡밥)은 전부 보기 이름
    const RN = started ? R : null;
    const whole = !started || at?.whole;
    const aboutNow = whole ? new Set() : tiesOf(j, R).about;
    const nameLinks = (ids, type) => {
      const ok = (ids ?? []).filter((a) => whole || aboutNow.has(a)).map((a) => [a, idx.targets.get(a)]).filter(([, t]) => !t || fmt.nameAt(t, RN));
      return ok.length ? joinNodes(ok.map(([a, t]) => ui.link(`${type ?? (a.startsWith('person:') ? 'person' : 'target')}:${a}`, t ? fmt.nameAt(t, RN) : fmt.targetName(a)))) : null;
    };
    const text = fmt.prose(at?.text ?? '');
    out.append(ui.panel(null, [
      text ? ui.el('p', {}, text) : null,
      kv([
        row(LABELS.state, stateRow),
        row(LABELS.firstAt, first ? ui.link(`unit:${first}`, fmt.unitTitle(first)) : null),
        row(LABELS.related, nameLinks(j.about)),
        row(fmt.TERM.lead, nameLinks(j.owners, 'person')),
      ]),
    ]));
    // 칸 이름이 종류라 줄마다 종류 칩을 되풀이하지 않는다. 묶음 밖은 아는 기록이라도 접이에(개수 없이)
    const bundled = (list) => recordList(list, { showUnit: true, kind: false, shown: (x) => !started || at?.whole || tiedIds.has(x.id) });
    if (qs.length) out.append(ui.panel(LABELS.question, bundled(qs)));
    if (fs.length) out.append(ui.panel(LABELS.fact, bundled(fs)));
    // 다른 떡밥과의 관계 — 근거 기록을 하나라도 알면 보이고(떡밥 탭 관계도와 같은 규칙), 아니면 접이에(W15a)
    const rels = idx.relations.filter((g) => g.from === id || g.to === id);
    if (rels.length) {
      const relLine = (g) => {
        const other = g.from === id ? g.to : g.from;
        return ui.el('li', { class: 'rd-thread' }, ui.link(`thread:${other}`, fmt.threadLabelOf(other, relKnown(g) && started ? R : null)), ui.el('span', { class: 'rd-link-meta' }, ` ${g.type}`),
          fmt.relText(g, R) ? ui.el('div', { class: 'muted' }, fmt.relText(g, R)) : null);
      };
      const relKnown = (g) => R.all || (g.basis ?? []).some((b) => { const r = idx.records?.get(b); return r && R.known(r); });
      const before = rels.filter(relKnown);
      const after = rels.filter((g) => !relKnown(g));
      out.append(ui.panel(LABELS.relations, [
        before.length ? ui.el('ul', { class: 'plain' }, before.map(relLine)) : ui.empty(LABELS.inRangeNone),
        after.length ? ui.details(spoilerSummary(after.length), ui.el('ul', { class: 'plain' }, after.map(relLine)), { class: 'spoiler' }) : null,
      ]));
    }
    if (!started) root.append(ui.details(spoilerSummary(), out, { class: 'spoiler' }));
  },

  tick(id, idx) {
    const t = idx.ticks.get(Number(id));
    if (!t) return root.append(head(LABELS.notFound), ui.empty(LABELS.noTick));
    root.append(head(fmt.tickLabel(t.tick)));
    root.append(ui.panel(LABELS.tickUnits, ui.el('ul', { class: 'plain' }, t.units.map((k) => {
      const u = idx.units.get(k);
      return ui.el('li', {}, u ? [ui.link(`unit:${k}`, u.title), u.kind !== 'main' ? ui.el('span', { class: 'rd-link-meta' }, ` ${fmt.KIND[u.kind]?.label ?? u.kind}`) : null] : fmt.unitTitle(k));
    }))));
  },
};

/** 설정 오류 의심 — 바꿀 수 있는 문장만(fmt.prose) */
function slipsPanel(slips, hidden = false) {
  const texts = (slips ?? []).map((s) => fmt.prose(s.text)).filter(Boolean);
  if (!texts.length) return;
  const list = ui.el('ul', { class: 'plain' }, texts.map((t) => ui.el('li', { class: 'slip' }, t)));
  root.append(ui.panel(LABELS.slips, hidden ? ui.details(spoilerSummary(), list, { class: 'spoiler' }) : list)); // 여기까지 읽음 뒤 스토리면 접는다(W15a)
}
