/**
 * 탭 1 감상 순서(W2) — 화면 1 "스토리 중요도 분류"(docs/views.md 1절, 판정 카드 docs/importance.md).
 * 첫 쓸모: 스토리를 다 보지 않고 중요한 것만 빠르게 — 척추(메인 챕터 + 척추 이벤트 · 사이드)을 출시순 한 줄로 두고,
 *   등급 필터(기본 필수 · 추천)에 든 메인 밖 스토리를 그 사이사이 제자리(읽는 자리 units.json order)에 끼워 넣은 감상 순서.
 *
 * 쓰는 JSON
 *   order.json(이 탭 — tools/site/export/order.mjs): units[421](판정 단위 — 등급 · 출시 시점 · from · before · basis · reason · trail · 떡밥 · 주역) · spine[60](척추 자리) · leads[20](주역 명단 — 이 탭은 쓰지 않는다) · counts
 *   order-detail.json(분류 카드를 처음 열 때 받는다): units{키 → { history, basis_text, reviews }} · notes[]
 *   synopsis.json(공개 개요 — 분류 카드 머리 아래 한 줄 소개, W8): [{ key, logline, … }] — 여기까지 읽음 안 스토리만, 없으면 그리지 않는다
 *   공용(idx): units.json(종류 · 제목 · 글자 수 · 범위) · ticks.json(출시 시점 라벨)
 *
 * URL 파라미터(p.*)
 *   g      등급 필터(쉼표 목록: 척추 · 필수 · 보강 · 참고 · 독립 — 화면 말로 필수 · 준필수 · 추천 · 참고 · 독립), 없으면 척추 · 필수 · 보강(DEFAULT_GRADES).
 *          척추를 끄면 척추 이벤트 · 사이드가 빠진다(메인 챕터는 등급이 아니라 종류 main으로만 거른다)
 *   k      종류 필터(쉼표 목록, 칩 순서 KIND_PICK_ORDER: main · side · event · episode · sub · relic · erelic · elevator), 없으면 유실물 둘(relic · erelic)을 뺀 전부 — 유실물은 사용자가 켜야 보인다.
 *          척추 줄도 종류를 따른다 — 이벤트를 끄면 필수 이벤트도 빠진다(사용자, 2026-10-10)
 *   find   제목 검색
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13b)
 *   목록은 여기까지 읽음과 관계없이 전부 보인다(사용자, 2026-10-10 — 안 본 사람에게 어떤 순서로 볼지 알려 주는 안내라서). 등급은 최종 등급,
 *     여기까지 읽음은 자리 표시만 한다: 목록은 그 시점 ≤ 이고 본 마지막 척추 줄 아래 "여기까지 읽음" 구분 줄(cutRowAt).
 *     본 것 · 안 본 것은 출시 시점이 아니라 스토리마다 R = state.reading(s)로 정한다 — 척추 이벤트 · 사이드는 '봤음' 예외(x)를 따르고,
 *     예외가 없으면 R.seen(키) ≡ 출시 시점 ≤ t. 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드는 줄에 '안 봄' 표시.
 *   분류 카드는 여기까지 읽음을 따른다 — 그 시점의 등급 gradeAt(u, R)(tools/views/importance.mjs와 같다: 전부 보기면 최종 등급, 안 본 스토리면 아직 없음,
 *     from 시점이 있고 t < from 시점이면 그 앞 등급(before), 그 밖은 최종 등급), 안 본 스토리는 한 줄 소개를 안 그리고 이유 · 떡밥 등은 "스포일러 보기" 접이 안에.
 *     '이 스토리가 선행인 곳'도 본 스토리만 든다.
 *   목록: 감상 순서 한 줄(ol). 척추 줄은 종류 필터(+ 척추 이벤트 · 사이드는 등급 '필수')에 들면 보이고, 그 사이에 필터에 든 메인 밖 스토리를 읽는 자리 순서대로 끼운다.
 *     메인 챕터 = 구획 줄(굵은 CH 표기 + 이름, 다른 표시 없음). 그 밖의 줄 = [호감도는 그 니케 초상] 제목 + 회색 작은 글자(등급 이름 · 종류 · 'CH.27 전까지').
 *     색은 등급 띠만(style.css .g-band): 준필수 = 굵은 띠 + 연한 바탕, 추천 = 얇은 띠, 참고 · 독립 = 띠 없이 회색 제목, 필수(척추) = 띠 없이 굵은 제목. 종류는 글자(색 없음).
 *     순번 · 날짜 · 글자 수는 싣지 않는다(날짜 · 분량은 리더). 이유(분석 문장)도 목록에는 없고 분류 카드 · 리더에만.
 *     선행: 앞 편(필수 선행)이 등급 필터로만 숨으면 그 줄을 흐리게 끼운다(ghostKeys — 이야기가 1 · 6 · 7로 끊기지 않게, 앞 편의 앞 편도).
 *     종류 · 찾기로 숨은 앞 편만 줄 아래 '먼저: 랩칠리언 5'로 이름을 적는다. 권장 · 선택 개수는 목록에 없다(분류 카드 · 리더에 전부).
 *     필터는 최종 등급으로 본다. 한 줄 한 칸이라 좁은 폭(390px)에서도 제목이 줄바꿈될 뿐 접지 않는다.
 *   스토리를 누르면 sel=unit:키 → 리더 패널 + (넓은 화면에서) 아래에 붙는 분류 카드(등급 · 이유 · 장면 · 선행 · 떡밥 · 주역 · 결말).
 *     카드에는 판정 흔적(확실/추정 칩 — 추정만 남긴다 · 기준일 · 분류가 바뀐 기록 · 기록 ID · 글자 수 · 장면 수)을 싣지 않는다. 이유는 fmt.reasonText(판정 과정 마디를 걷는다).
 *   용어는 fmt(GRADE · TERM · help · ref)에서 가져오고, 없는 말만 아래 LABELS에 둔다.
 */
import { gradeAt, prose, reasonText } from '../lib/format.js';

export const meta = { id: 'order', title: '감상 순서', blurb: '메인 스토리 사이사이에 꼭 볼 스토리를 끼워 넣은 순서' };

/** fmt에 없는 화면 말 — 고칠 때는 여기 한 곳만 */
const LABELS = {
  title: '감상 순서',
  grade: '등급', kind: '종류',
  find: '제목 검색', findAria: '스토리 제목 검색',
  count: (n) => `${n}편`, countHelp: '지금 목록에 든 스토리 수(흐리게 끼운 앞 편은 빼고)',
  preOfHelp: (at) => `${at}을 보기 전에 보면 좋다`, riseSince: (at) => `${at}부터`, riseBefore: (at, grade) => `${at} 앞에서는 ${grade}`,
  first: '먼저', firstHelp: '먼저 볼 앞 편 — 지금 필터로는 목록에 없다',
  ghost: '앞 편', ghostHelp: (t) => `${t}의 앞 편 — 등급 필터 밖이지만 이야기가 끊기지 않게 흐리게 끼워 두었다`,
  cutLine: (at) => `여기까지 읽음 · ${at}`, cutLineHelp: '이 아래가 다음에 볼 순서', goCut: '읽은 자리로', emptyFilter: '필터에 맞는 스토리가 없다.',
  clearFilter: '필터 풀기',
  card: '분류', cardClose: '닫기',
  rows2: {
    grade: '등급', reason: '이유', scene: '장면', threads: '떡밥', lead: '주역', origin: '첫 이야기', endings: '결말',
    pre: '선행 스토리', preFor: '이 스토리가 선행인 곳', touch: '이어지는 필수 스토리',
  },
  none: '없음',
  after: (at) => `여기까지 읽음 뒤 — ${at}에 나온다`, unseen: '안 봄', unseenHelp: '여기까지 읽음 앞이지만 안 본 것으로 둔 스토리', spoiler: '여기까지 읽음 뒤 — 스포일러 보기',
};
const GRADES = ['필수', '보강', '참고', '독립'];
const PICK_GRADES = ['척추', ...GRADES]; // 필터 칩 — 척추(화면 말 '필수')도 끌 수 있다(사용자, 2026-10-10)
const DEFAULT_GRADES = ['척추', '필수', '보강']; // 중요한 것만 빠르게 — 사용자가 참고 · 독립을 켠다
/** 등급 → 띠 클래스(style.css .g-band — 준필수 굵은 띠 · 추천 얇은 띠 · 참고 · 독립 회색). 필수(척추)는 띠 없이 굵은 제목 */
const BAND = { 필수: 'g-must', 보강: 'g-support', 참고: 'g-quiet', 독립: 'g-quiet' };
const OFF_KINDS = ['relic', 'erelic']; // 유실물은 기본으로 뺀다(사용자, 2026-10-09)
/** 종류 칩 순서(사용자, 2026-10-10) — 다른 탭의 KIND_ORDER와 따로 */
const KIND_PICK_ORDER = ['main', 'side', 'event', 'episode', 'sub', 'relic', 'erelic', 'elevator'];
/** 쉼표 목록 파라미터 → 고른 값(없으면 기본값). 모르는 값은 버린다 */
const listParam = (v, all, dflt) => (v == null ? dflt : v.split(',').filter((x) => all.includes(x)));


export { gradeAt }; // 계산은 lib/format.js 한 곳(리더의 분류 칸도 같이 쓴다)

/**
 * 여기까지 읽음 구분 줄을 넣을 자리 — seq(감상 순서) 안에서 출시 시점 ≤ cut이고 본(R.seen) 마지막 척추 줄의 번호(없으면 -1).
 * 예외(x)가 없으면 '출시 시점 ≤ cut인 마지막 척추 줄'과 같다. 안 봄으로 둔 척추 이벤트 · 사이드가 끝에 있으면 그 줄은 구분 줄 아래(다음에 볼 순서)로 간다.
 * 뒤에 나왔지만 봤음으로 둔 줄은 자리를 옮기지 않는다(구분 줄은 메인 챕터 자리 표시).
 */
export function cutRowAt(seq, cut, R) {
  let at = -1;
  if (cut == null) return at;
  seq.forEach((x, i) => { if (x.spine && x.tick <= cut && R.seen(x.key)) at = i; });
  return at;
}

/**
 * 흐리게 끼울 앞 편 — 보이는 줄(keys)의 필수 선행(order.json pre 필수 = 앞 편) 가운데 pass(키)가 참인 것(종류 · 찾기는 통과하고 등급 필터로만 숨은 것)을
 * 앞 편의 앞 편까지 거슬러 모은다. 돌려주는 것: Map(앞 편 키 → 그것을 부른 줄의 키)
 */
export function ghostKeys(keys, pre, pass) {
  const shown = new Set(keys);
  const out = new Map();
  const stack = [...keys];
  while (stack.length) {
    const k = stack.pop();
    for (const [a] of pre[k]?.필수 ?? []) {
      if (shown.has(a) || out.has(a) || !pass(a)) continue;
      out.set(a, k);
      stack.push(a);
    }
  }
  return out;
}

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const wait = ui.spinner();
  root.append(wait);
  const order = await data.load('order');
  wait.remove();
  const TERM = fmt.TERM;
  const gl = (g) => fmt.GRADE[g]?.label ?? g;
  const judged = order.units.map((j) => ({ ...j, unit: idx.units.get(j.key) })).filter((j) => j.unit);
  const judgedByKey = new Map(judged.map((j) => [j.key, j]));
  const spine = order.spine.map((s) => ({ ...s, unit: idx.units.get(s.key) })).filter((s) => s.unit);
  const spineByKey = new Map(spine.map((s) => [s.key, s]));
  const pre = order.pre ?? {};
  /** 거꾸로 — A가 선행인 스토리들 [X, 칸] */
  const preFor = new Map();
  for (const [x, row] of Object.entries(pre)) for (const l of fmt.PRE_LEVEL) for (const [a] of row[l] ?? []) (preFor.get(a) ?? preFor.set(a, []).get(a)).push([x, l]);
  const kindsPresent = KIND_PICK_ORDER.filter((k) => judged.some((j) => j.unit.kind === k) || spine.some((sp) => sp.unit.kind === k));
  const spineLabel = (key) => (spineByKey.get(key)?.unit.kind === 'main' ? fmt.tickShort(spineByKey.get(key).tick) : fmt.unitTitle(key));
  // 호감도 줄의 초상 — 스토리 키 char:180 → 아이콘 c180(사전 인물의 icon · 바뀐 모습 icons), 코스튬 판(c182)은 받은 그림이 없어 이름(' : ' 앞)의 인물 아이콘
  const persons = idx.targetList.filter((t) => t.type === 'person');
  const personByName = new Map(persons.map((t) => [t.name, t]));
  const iconOwner = new Map();
  for (const t of persons) { if (t.icon) iconOwner.set(t.icon, t); for (const [, ic] of t.icons ?? []) iconOwner.set(ic, t); }
  const episodeIcon = (unit) => {
    const n = /^char:(\d+)$/.exec(unit.key)?.[1];
    const code = n ? `c${n.padStart(3, '0')}` : null;
    return code && iconOwner.has(code) ? code : personByName.get(String(unit.title).split(' : ')[0])?.icon ?? null;
  };
  let curR = state.reading(state.get()); // 지금 읽은 데까지(스토리마다 봤나) — apply가 바꾼다

  // ── 머리 · 도구 줄 ──
  root.append(ui.el('div', { class: 'tab-head order-head' }, ui.el('h2', {}, LABELS.title)));
  const status = ui.el('span', { class: 'order-status', role: 'status', 'aria-live': 'polite' });
  /** 여러 개를 켜고 끄는 칩 줄(aria-pressed). 기본값과 같으면 URL에서 지운다 */
  const picks = ({ label, param, options, dflt }) => {
    const btns = new Map();
    const box = ui.el('div', { class: 'order-picks', role: 'group', 'aria-label': label }, ui.el('span', { class: 'order-picks-label' }, label));
    const cur = () => listParam(state.param('order', param), options.map((o) => o.value), dflt);
    for (const o of options) {
      const b = ui.el('button', { type: 'button', class: 'order-pick', 'aria-pressed': 'false', title: o.title, dataset: { v: o.value } }, o.band ? ui.el('i', { class: `order-pick-band ${o.band}`, 'aria-hidden': 'true' }) : null, o.label);
      b.addEventListener('click', () => {
        const on = new Set(cur());
        if (on.has(o.value)) on.delete(o.value); else on.add(o.value);
        const next = options.map((x) => x.value).filter((v) => on.has(v));
        const same = next.length === dflt.length && next.every((v) => dflt.includes(v));
        state.setParam('order', param, same ? null : next.join(',') || '-'); // '-' = 하나도 안 고름(기본값과 구별)
      });
      btns.set(o.value, b);
      box.append(b);
    }
    return { el: box, cur, sync: () => { const on = new Set(cur()); for (const [v, b] of btns) b.setAttribute('aria-pressed', String(on.has(v))); } };
  };
  const gradePick = picks({ label: LABELS.grade, param: 'g', dflt: DEFAULT_GRADES, options: PICK_GRADES.map((g) => ({ value: g, label: gl(g), title: fmt.help('grade', g), band: BAND[g] === 'g-quiet' ? null : BAND[g] })) });
  const kindDefault = kindsPresent.filter((k) => !OFF_KINDS.includes(k));
  const kindPick = picks({ label: LABELS.kind, param: 'k', dflt: kindDefault, options: kindsPresent.map((k) => ({ value: k, label: fmt.KIND[k].label, title: fmt.help('kind', k) })) });
  const find = ui.el('input', { type: 'search', class: 'order-find', placeholder: LABELS.find, 'aria-label': LABELS.findAria, value: state.param('order', 'find') ?? '' });
  let findTimer = null;
  let findPending = false; // 입력 뒤 URL에 싣기 전 — 그 사이 다른 필터가 바뀌어도 입력칸을 되돌리지 않는다
  find.addEventListener('input', () => {
    clearTimeout(findTimer);
    findPending = true;
    findTimer = setTimeout(() => { findPending = false; state.setParam('order', 'find', find.value.trim() || null); }, 200);
  });
  root.append(ui.el('div', { class: 'toolbar order-toolbar' }, gradePick.el, ui.el('div', { class: 'order-kinds' }, kindPick.el), find, status));
  const emptyBox = ui.el('div', { class: 'order-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);

  // ── 목록(감상 순서 한 줄) ──
  const listView = ui.el('div', { class: 'order-list' });
  const listEl = ui.el('ol', { class: 'order-seq' });
  listView.append(listEl);
  /** 'CH.30 전까지' — 판정이 짚은 척추 자리(from)가 이 스토리보다 뒤면 그 앞에 보면 좋다(prereqsOf와 같은 규칙) */
  const beforeText = (j) => {
    if (!j.from || !spineByKey.has(j.from) || !(j.unit.order < spineByKey.get(j.from).unit.order)) return null;
    const at = spineLabel(j.from);
    return ui.el('span', { class: 'order-before', title: LABELS.preOfHelp(at) }, fmt.preOf(at));
  };
  /** '먼저: 랩칠리언 5' — 앞 편 가운데 목록에 없는 것(종류 · 찾기로 숨음)만. 목록에 있으면(흐리게 끼운 것 포함) 바로 위에 보이니 쓰지 않는다 */
  const firstLine = (key, inList) => {
    const miss = (pre[key]?.필수 ?? []).filter(([k]) => !inList.has(k));
    if (!miss.length) return null;
    return ui.el('span', { class: 'order-pre', title: LABELS.firstHelp, onClick: (e) => e.stopPropagation() }, `${LABELS.first}: `, miss.map(([k], i) => [i ? ', ' : null, ui.link(`unit:${k}`, fmt.unitTitle(k))]));
  };
  /** 'CH.07 재회' → 굵은 CH 표기 + 이름 */
  const chTitle = (title) => { const m = /^(CH\.\d+)\s*(.*)$/.exec(title); return m ? [ui.el('span', { class: 'ch' }, m[1]), m[2] ? ` ${m[2]}` : null] : title; };
  /** 감상 순서의 한 줄. 척추이면 item.spine, 흐리게 끼운 앞 편이면 item.ghostOf(부른 줄의 키) */
  const seqRow = (item, inList, unseen = false) => {
    const { key, unit } = item;
    const go = () => state.set({ sel: `unit:${key}` });
    const attrs = { class: 'order-row', dataset: { key }, tabindex: 0, role: 'button', onClick: go, onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } };
    if (item.spine && unit.kind === 'main') {
      attrs.class = 'order-row is-main';
      return ui.el('li', attrs, ui.el('span', { class: 'order-line' }, ui.el('span', { class: 'order-title' }, ui.link(`unit:${key}`, chTitle(unit.title)))));
    }
    const ghost = Boolean(item.ghostOf);
    const g = item.spine ? '척추' : item.grade;
    attrs.class = ['order-row g-band', item.spine ? 'is-spine' : 'is-extra', ghost ? 'is-ghost g-quiet' : BAND[g] ?? '', unseen ? 'is-unseen' : ''].filter(Boolean).join(' ');
    const icon = unit.kind === 'episode' ? ui.portrait(episodeIcon(unit), { size: 28, class: 'order-face' }) : null;
    const meta = [
      ui.el('span', { class: 'g-label', title: fmt.help('grade', g) }, gl(g)),
      ui.el('span', { class: 'order-kind', title: fmt.help('kind', unit.kind) }, fmt.KIND[unit.kind]?.label ?? unit.kind),
      ghost ? ui.el('span', { class: 'order-kind', title: LABELS.ghostHelp(fmt.unitTitle(item.ghostOf)) }, LABELS.ghost) : null,
    ].filter(Boolean);
    return ui.el('li', attrs,
      ui.el('span', { class: 'order-line' }, icon,
        ui.el('span', { class: 'order-title g-title' }, ui.link(`unit:${key}`, unit.title)),
        ui.el('span', { class: 'order-meta' }, meta.map((x, i) => [i ? ui.el('span', { class: 'order-sep', 'aria-hidden': 'true' }, '·') : null, x]),
          item.spine ? null : beforeText(item),
          unseen ? ui.el('span', { class: 'order-unseen', title: LABELS.unseenHelp }, LABELS.unseen) : null)),
      firstLine(key, inList));
  };
  const markSelected = (key) => {
    for (const li of listEl.children) { const on = li.dataset.key === key; li.classList.toggle('is-selected', on); li.setAttribute('aria-current', on ? 'true' : 'false'); }
  };
  root.append(listView);

  // ── 분류 카드(선택한 스토리) ──
  const card = ui.el('section', { class: 'order-card panel', 'aria-label': LABELS.card });
  card.hidden = true;
  root.append(card);

  // ── 거르기 ──
  const findOk = (x, s) => {
    const q = (s.p.find ?? '').toLowerCase();
    return !q || String(x.unit.title).toLowerCase().includes(q);
  };
  const match = (j, s, kinds) => kinds.includes(j.unit.kind) && findOk(j, s);
  const clearFilters = () => state.set({ p: { g: null, k: null, find: null } }, { replace: true });
  const apply = (s) => {
    const cut = s.t; // 여기까지 읽음 — 목록은 거르지 않고 자리만 표시한다
    const rd = state.reading(s);
    curR = rd;
    const grades = gradePick.cur();
    const kinds = kindPick.cur();
    gradePick.sync();
    kindPick.sync();
    // 감상 순서: 척추(종류 필터 + 메인 밖은 등급 '척추') + 고른 등급(최종 등급)의 메인 밖 스토리 + 등급 필터로만 숨은 앞 편(흐리게), 읽는 자리 순서
    const spineOn = grades.includes('척추');
    const spineRows = spine.filter((sp) => kinds.includes(sp.unit.kind) && (sp.unit.kind === 'main' || spineOn) && findOk(sp, s)).map((sp) => ({ ...sp, spine: true }));
    const extras = judged.filter((j) => grades.includes(j.grade) && match(j, s, kinds));
    const shown = [...spineRows, ...extras];
    const ghosts = ghostKeys(shown.map((x) => x.key), pre, (k) => judgedByKey.has(k) && match(judgedByKey.get(k), s, kinds));
    const seq = [...shown, ...[...ghosts].map(([k, by]) => ({ ...judgedByKey.get(k), ghostOf: by }))].sort((a, b) => a.unit.order - b.unit.order || a.tick - b.tick);
    const inList = new Set(seq.map((x) => x.key));
    ui.clear(status);
    status.append(ui.el('span', { class: 'order-count', title: LABELS.countHelp }, LABELS.count(fmt.num(shown.length))));
    // 목록
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    // 여기까지 읽음 구분 줄 — 그 시점 ≤ 이고 본 마지막 척추 줄 아래(이 아래가 다음에 볼 순서)
    const cutAt = cutRowAt(seq, cut, rd);
    // 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드 — 줄에 '안 봄'(예외가 없으면 없다)
    const lis = seq.map((x, i) => seqRow(x, inList, x.spine && i < cutAt && !rd.seen(x.key)));
    if (cutAt >= 0 && cutAt < seq.length - 1) {
      lis.splice(cutAt + 1, 0, ui.el('li', { class: 'order-cutrow', title: LABELS.cutLineHelp, dataset: { key: '' } }, ui.el('span', {}, LABELS.cutLine(fmt.tickShort(cut)))));
      status.append(' · ', ui.el('button', { type: 'button', class: 'link-btn', onClick: () => listEl.querySelector('.order-cutrow')?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, LABELS.goCut));
    }
    listEl.replaceChildren(...lis);
    markSelected(selKey);
    const empty = seq.length === 0;
    emptyBox.hidden = !empty;
    if (empty) {
      ui.clear(emptyBox);
      emptyBox.append(ui.notice(LABELS.emptyFilter), ui.el('button', { type: 'button', class: 'btn', onClick: clearFilters }, LABELS.clearFilter));
    }
    if (!findPending && find.value !== (s.p.find ?? '') && document.activeElement !== find) find.value = s.p.find ?? '';
    listView.hidden = empty;
  };

  // ── 분류 카드 ──
  const preRows = (key) => {
    const R = LABELS.rows2;
    const p = pre[key];
    // 왜 선행인가는 앞 편 · 떡밥 → 회수처럼 이야기 말만 — '분류에서 짚음'(판정 말)은 쓰지 않는다
    const why = (w) => (w === 'judged' ? null : ui.el('span', { class: 'muted' }, ` (${fmt.PRE_WHY[w] ?? w})`));
    const lines = p ? fmt.PRE_LEVEL.filter((l) => p[l]?.length).map((l) => ui.el('div', { class: 'order-pre-line' },
      ui.el('b', { title: fmt.help('pre', l) }, `${fmt.PRE_LABEL[l]} `),
      p[l].map(([k, w], i) => [i ? ' · ' : null, ui.link(`unit:${k}`, fmt.unitTitle(k)), why(w)]))) : [];
    const back = (preFor.get(key) ?? []).filter(([x]) => curR.seen(x));
    return [
      [R.pre, lines.length ? lines : ui.el('span', { class: 'muted' }, LABELS.none)],
      back.length ? [R.preFor, back.map(([x, l], i) => [i ? ' · ' : null, ui.link(`unit:${x}`, fmt.unitTitle(x)), ui.el('span', { class: 'muted' }, ` ${fmt.PRE_LABEL[l]}`)])] : null,
    ];
  };
  const kv = (rows) => ui.el('dl', { class: 'order-kv' }, rows.filter(Boolean).flatMap(([k, v]) => [ui.el('dt', {}, k), ui.el('dd', {}, v)]));
  const detail = () => data.load('order-detail');
  let loglines = null;
  const synopsis = () => (loglines ??= data.load('synopsis').then((list) => new Map(list.map((x) => [x.key, x.logline]))));
  /** 한 줄 소개 — 카드를 그린 뒤 채운다. 여기까지 읽음 뒤 스토리는 비워 둔다(카드가 '뒤에 나온 스토리'라고 이미 말한다) */
  const loglineBox = (key, rd) => {
    const box = ui.el('p', { class: 'order-logline' });
    if (rd.seen(key)) synopsis().then((m) => { if (card.dataset.key === key && m.has(key)) box.textContent = m.get(key); }).catch(() => {});
    return box;
  };
  /** 카드 머리 — 제목 + 회색 종류 글자(종류는 색 없이) */
  const cardHead = (key, unit, close) => ui.el('div', { class: 'panel-head' }, ui.el('h3', {},
    unit.kind === 'episode' ? ui.portrait(episodeIcon(unit), { size: 28, class: 'order-face' }) : null,
    ui.link(`unit:${key}`, unit.kind === 'main' ? chTitle(unit.title) : unit.title), ' ',
    ui.el('span', { class: 'order-card-kind' }, fmt.KIND[unit.kind]?.label ?? unit.kind)), close);
  /** 주역 — 첫 이야기인 인물 + 이 스토리에 사실 · 변화가 있는 주역(lead_facts '네온(ch01) 사실 3 / …'의 이름만 — 개수는 싣지 않는다) */
  const leadsOf = (j) => {
    const names = String(j.lead_facts ?? '').split(/\s*\/\s*/).map((x) => x.replace(/\(.*$/, '').trim()).filter(Boolean);
    const ids = [...new Set([...(j.origin_of ?? []), ...names.map((n) => personByName.get(n)?.id).filter(Boolean)])];
    return ids.map((p, i) => [i ? ' · ' : null, ui.link(`person:${p}`, fmt.targetName(p)), j.origin_of?.includes(p) ? ui.el('span', { class: 'muted' }, ` (${LABELS.rows2.origin})`) : null]);
  };
  /** 결말 — closures 'O9(관계 · 지휘관 · 확정) O14(갈등 · 확정)' → 결말 기록 링크(글자는 갈래 '관계' · '갈등', ID는 내지 않는다) */
  const endingsOf = (j) => [...String(j.closures ?? '').matchAll(/(?<![A-Za-z0-9])(O\d+)\(([^()·]+)/g)]
    .map(([, id, aspect], i) => [i ? ' · ' : null, ui.link(`record:${id}`, aspect.trim())]);
  const renderCard = (s) => {
    const sel = state.parseSel(s.sel);
    const key = sel?.type === 'unit' ? sel.id : null;
    const j = key ? judgedByKey.get(key) : null;
    const sp = key && !j ? spineByKey.get(key) : null;
    ui.clear(card);
    card.dataset.key = key ?? '';
    if (!j && !sp) { card.hidden = true; return; }
    card.hidden = false;
    const close = ui.el('button', { type: 'button', class: 'btn order-card-close', 'aria-label': LABELS.cardClose, onClick: () => state.set({ sel: '' }) }, ui.icon('close'));
    const R = LABELS.rows2;
    const rd = state.reading(s);
    if (sp) {
      card.append(cardHead(sp.key, sp.unit, close),
        loglineBox(sp.key, rd),
        kv([[R.grade, [ui.chip('grade', sp.unit.kind === 'main' ? '메인' : '척추'), rd.seen(sp.key) || rd.t == null || sp.tick > rd.t ? null : [' ', ui.el('span', { class: 'order-unseen', title: LABELS.unseenHelp }, LABELS.unseen)]]],
          ...preRows(sp.key)]));
      return;
    }
    const g = gradeAt(j, rd);
    // 등급 칩 + (추정일 때만) 점선 '추정' — 확실은 당연해서 쓰지 않는다
    const gradeRow = [ui.chip('grade', g ?? j.grade), j.confidence === '추정' ? [' ', ui.chip('confidence', '추정')] : null];
    if (g == null) gradeRow.push(' ', ui.el('span', { class: 'order-spoiler' }, LABELS.after(fmt.tickLabel(j.tick, { date: false }))));
    else if (g !== j.grade) gradeRow.push(' ', ui.el('span', {}, '→ ', ui.link(`unit:${j.from}`, spineLabel(j.from)), '부터 ', ui.chip('grade', j.grade)));
    else if (j.from_tick) gradeRow.push(' ', ui.el('span', { class: 'muted' }, rd.all ? LABELS.riseBefore(spineLabel(j.from), gl(j.before ?? j.grade)) : LABELS.riseSince(spineLabel(j.from))));
    // 장면 — 등급을 정한 기록의 장면(누르면 장면)과 그 기록 문장(따로 받는다). 기록 ID · 종류 칩은 내지 않는다
    const basisText = ui.el('div', { class: 'order-basis-text' });
    const basisRow = j.basis ? [j.basis_scene ? R.scene : fmt.RECORD_KIND[j.basis_kind]?.label ?? R.scene, [j.basis_scene ? ui.link(`scene:${j.basis_scene}`, fmt.ref(j.basis_scene)) : null, basisText]] : null;
    // 여기까지 읽음 뒤 스토리 — 목록에는 보이지만 이유 · 떡밥 · 주역 · 결말 같은 내용은 접어 가린다
    const after = g == null;
    const reason = reasonText(j.reason);
    const leads = leadsOf(j);
    const endings = endingsOf(j);
    const rest = [
      reason ? [R.reason, reason] : null,
      basisRow,
      j.from && !j.from_tick && spineByKey.has(j.from) ? [R.touch, ui.link(`unit:${j.from}`, spineLabel(j.from))] : null,
      j.threads?.length ? [R.threads, j.threads.map((t, i) => [i ? ' · ' : null, ui.link(`thread:${t}`, idx.threads.get(t)?.title ?? t)])] : null,
      leads.length ? [R.lead, leads] : null,
      endings.length ? [R.endings, endings] : null,
    ];
    card.append(
      cardHead(j.key, j.unit, close),
      loglineBox(j.key, rd),
      kv([[rd.all || after ? R.grade : TERM.gradeAt, gradeRow], ...preRows(j.key), ...(after ? [] : rest)]));
    if (after) card.append(ui.details(LABELS.spoiler, kv(rest), { class: 'order-spoiler-rows' })); // append(null)은 'null' 글자를 넣는다
    // 기록 문장은 따로 받는다(처음 한 번). 검토 기록(세션 · 날짜 · 판정 입력)은 작업 로그라 화면에 내지 않는다(W13a)
    if (j.basis) detail().then((d) => {
      if (card.dataset.key !== key) return;
      const x = d.units?.[key];
      if (x?.basis_text) basisText.textContent = prose(x.basis_text);
    }).catch(() => { /* 못 받아도 카드는 쓴다 */ });
  };

  // ── 상태 ──
  apply(state.get());
  renderCard(state.get());
  const off = state.subscribe((s, changed) => {
    if (changed.has('t') || changed.has('p')) { apply(s); renderCard(s); }
    else if (changed.has('sel')) {
      const sel = state.parseSel(s.sel);
      const key = sel?.type === 'unit' ? sel.id : null;
      markSelected(key);
      renderCard(s);
    }
  });
  detail().catch(() => {}); // 분류 카드를 열기 전에 받아 둔다
  return () => { off(); clearTimeout(findTimer); };
}
