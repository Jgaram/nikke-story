/**
 * 탭 1 감상 순서(W2) — 화면 1 "스토리 중요도 분류"(docs/views.md 1절, 판정 카드 docs/importance.md).
 * 첫 쓸모: 스토리를 다 보지 않고 중요한 것만 빠르게 — 척추(메인 챕터 + 척추 이벤트 · 사이드)을 출시순 한 줄로 두고,
 *   등급 필터(기본 필수 · 추천)에 든 메인 밖 스토리를 그 사이사이 제자리(읽는 자리 units.json order)에 끼워 넣은 감상 순서.
 *
 * 쓰는 JSON
 *   order.json(이 탭 — tools/site/export/order.mjs): units[421](판정 단위 — 등급 · 출시 시점 · from · before · basis · reason · trail · 떡밥 · 주역) · spine[60](척추 자리) · leads[20](주역 명단 — 이 탭은 쓰지 않는다) · counts
 *   공용(idx): units.json(종류 · 제목 · 글자 수 · 범위) · ticks.json(출시 시점 라벨)
 *
 * URL 파라미터(p.*)
 *   g      등급 필터(쉼표 목록: 척추 · 필수 · 보강 · 참고 · 독립 — 화면 말로 필수 · 준필수 · 추천 · 참고 · 독립), 없으면 척추 · 필수 · 보강(DEFAULT_GRADES).
 *          척추를 끄면 척추 이벤트 · 사이드가 빠진다(메인 챕터는 등급이 아니라 종류 main으로만 거른다)
 *   k      종류 필터(쉼표 목록, 칩 순서 KIND_PICK_ORDER: main · side · event · episode · sub · relic · erelic · elevator), 없으면 유실물 둘(relic · erelic)을 뺀 전부 — 유실물은 사용자가 켜야 보인다.
 *          척추 줄도 종류를 따른다 — 이벤트를 끄면 필수 이벤트도 빠진다(사용자, 2026-10-10)
 *   find   제목 검색
 *   open   1이면 줄 안내를 모두 펼친다(도구 줄 '안내 펼치기'). 줄마다 펼침은 URL에 싣지 않는다
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13b)
 *   목록은 여기까지 읽음과 관계없이 전부 보인다(사용자, 2026-10-10 — 안 본 사람에게 어떤 순서로 볼지 알려 주는 안내라서). 등급은 최종 등급,
 *     여기까지 읽음은 자리 표시만 한다: 목록은 그 시점 ≤ 이고 본 마지막 척추 줄 아래 "여기까지 읽음" 구분 줄(cutRowAt).
 *     본 것 · 안 본 것은 출시 시점이 아니라 스토리마다 R = state.reading(s)로 정한다 — 척추 이벤트 · 사이드는 '봤음' 예외(x)를 따르고,
 *     예외가 없으면 R.seen(키) ≡ 출시 시점 ≤ t. 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드는 줄에 '안 봄' 표시.
 *   목록: 감상 순서 한 줄(ol). 척추 줄은 종류 필터(+ 척추 이벤트 · 사이드는 등급 '필수')에 들면 보이고, 그 사이에 필터에 든 메인 밖 스토리를 읽는 자리 순서대로 끼운다.
 *     메인 챕터 = 구획 줄(굵은 CH 표기 + 이름, 다른 표시 없음). 그 밖의 줄 = [호감도는 그 니케 초상] 제목 + 회색 작은 글자(등급 이름 · 종류 · 줄 안내 요약).
 *   줄 안내(guideOf — 사용자, 2026-10-10: 필수만 먼저 보는 사람도, 차근차근 다 보는 사람도 언제 · 무엇을 먼저 볼지 알게). 모든 등급, 메인 밖 줄마다.
 *     요약(늘 보임): 언제 — 'CH.27 전까지'(뒤 필수 스토리가 필수 · 권장 선행으로 쓰거나 판정 자리가 뒤, 없으면 뒤 스토리가 그렇게 씀 'BITTER SPICE 전까지') ·
 *       'CH.27에서 다시 나옴'(척추의 선택 선행만) · '언제든'(기대는 뒤 스토리 없음),
 *       'CH.12 보충'(판정 자리가 앞 — 그 빈틈을 채운다), '먼저 N편'(필수 · 권장 선행 수). 척추 줄은 '먼저 N편'만.
 *     펼침(줄 끝 단추, 기본 접힘 — 사용자 2026-10-10): 언제(이유) · 보충 · 먼저 볼 스토리(칸 · 왜) · 이 스토리를 이어받는 뒤 스토리. 새 해석 없이 판정(from) · 선행(pre)과 그 거꾸로에서 낸다.
 *     색은 등급 띠만(style.css .g-band): 준필수 = 굵은 띠 + 연한 바탕, 추천 = 얇은 띠, 참고 · 독립 = 띠 없이 회색 제목, 필수(척추) = 띠 없이 굵은 제목. 종류는 글자(색 없음).
 *     순번 · 날짜 · 글자 수는 싣지 않는다(날짜 · 분량은 리더). 이유(분석 문장)도 목록에는 없고 리더 분류 칸에만.
 *     선행: 앞 편(필수 선행)이 등급 필터로만 숨으면 그 줄을 흐리게 끼운다(ghostKeys — 이야기가 1 · 6 · 7로 끊기지 않게, 앞 편의 앞 편도).
 *     종류 · 찾기로 숨은 앞 편만 줄 아래 '먼저: 랩칠리언 5'로 이름을 적는다. 권장 · 선택 개수는 목록에 없다(리더 분류 칸에 전부).
 *     필터는 최종 등급으로 본다. 한 줄 한 칸이라 좁은 폭(390px)에서도 제목이 줄바꿈될 뿐 접지 않는다.
 *   스토리를 누르면 sel=unit:키 → 리더 패널 하나(사용자, 2026-10-10 — 따로 있던 분류 카드를 리더 분류 칸으로 합쳤다: 그 시점의 등급 gradeAt ·
 *     언제 읽나 · 선행 · 선행인 곳 · 이유 · 장면 · 이어지는 필수 스토리 · 주역 · 결말 — lib/reader.js classPanel).
 *   용어는 fmt(GRADE · help · ref)에서 가져오고, 없는 말만 아래 LABELS에 둔다.
 */
import { gradeAt } from '../lib/format.js';

export const meta = { id: 'order', title: '감상 순서', blurb: '메인 스토리 사이사이에 꼭 볼 스토리를 끼워 넣은 순서' };

/** fmt에 없는 화면 말 — 고칠 때는 여기 한 곳만 */
const LABELS = {
  title: '감상 순서',
  grade: '등급', kind: '종류',
  find: '제목 검색', findAria: '스토리 제목 검색',
  count: (n) => `${n}편`, countHelp: '지금 목록에 든 스토리 수(흐리게 끼운 앞 편은 빼고)',
  first: '먼저', firstHelp: '먼저 볼 앞 편 — 지금 필터로는 목록에 없다',
  ghost: (t) => `${t}의 앞 편`, ghostHelp: (t) => `${t}의 앞 편 — 등급 필터 밖이지만 이야기가 끊기지 않게 흐리게 끼워 두었다`,
  // 줄 안내(guideOf)
  openAll: '안내 펼치기', openAllHelp: '줄마다 언제 볼지 · 먼저 볼 스토리 · 이어지는 스토리를 모두 펼친다',
  more: '안내', moreHelp: '언제 볼지 · 먼저 볼 스토리 · 이어지는 스토리',
  when: '언제', fill: '보충', firstAll: '먼저', later: '이어짐',
  dueSoft: (at) => `${at}에서 다시 나옴`, anytime: '언제든',
  dueHelp: (at) => `뒤의 ${at}에서 이 스토리를 이어받는다 — 그 전에 보면 좋다`,
  dueWhy: (at, pre) => ` — ${at}의 ${pre} 선행`,
  softHelp: (at) => `${at}에서 이 스토리 일이 다시 나온다 — 봐 두면 좋지만 안 봐도 된다`, softWhy: ' — 봐 두면 좋지만 안 봐도 된다',
  anytimeHelp: '뒤 스토리가 이 스토리를 먼저 보라고 하지 않는다 — 목록 자리 뒤라면 언제 봐도 된다', anytimeWhy: ' — 뒤 스토리가 먼저 보라고 하지 않는다',
  fillShort: (at) => `${at} 보충`, fillHelp: (at) => `${at}에서 넘긴 빈틈을 채운다 — ${at} 뒤에 보면 좋다`, fillWhy: ' — 이 필수 스토리의 빈틈을 채운다(그 뒤에 보면 좋다)',
  firstN: (n) => `먼저 ${n}편`, firstNHelp: '먼저 보면 좋은 스토리(필수 · 권장 선행) — 펼치면 이름',
  laterMore: (n) => ` 외 ${n}편`,
  cutLine: (at) => `여기까지 읽음 · ${at}`, cutLineHelp: '이 아래가 다음에 볼 순서', goCut: '읽은 자리로', emptyFilter: '필터에 맞는 스토리가 없다.',
  clearFilter: '필터 풀기',
  unseen: '안 봄', unseenHelp: '여기까지 읽음 앞이지만 안 본 것으로 둔 스토리',
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


export { gradeAt }; // 계산은 lib/format.js 한 곳(리더의 분류 칸이 쓴다)

/** 선행 거꾸로 — Map(선행 키 → [[그것을 선행으로 쓰는 키, 칸, 왜]]) */
export function preRev(pre) {
  const rev = new Map();
  for (const [x, levels] of Object.entries(pre ?? {})) {
    for (const [level, list] of Object.entries(levels)) for (const [a, why] of list) {
      if (!rev.has(a)) rev.set(a, []);
      rev.get(a).push([x, level, why]);
    }
  }
  return rev;
}

/**
 * 줄 안내 — 판정(from) · 선행(order.json pre)과 그 거꾸로에서 기계적으로 낸다(새 해석 없음).
 *   ctx: { units: Map(키 → { order }), spine: Set(척추 키), pre, rev: preRev(pre), judged: Map(키 → { grade, from }) }
 *   due    기한 { key, level, why, soft } — 이 스토리보다 뒤에서 이 스토리에 기대는 것. 차례: 가장 앞의 척추 필수 · 권장 선행 또는 판정 자리(from)가 뒤 →
 *          없으면 가장 앞의 메인 밖 스토리 필수 · 권장 선행(뒤 편 등) → 없으면 척추의 선택 선행(soft, 다시 나옴). 판정 자리는 준필수 = 필수 · 추천 = 권장(PRE_HELP와 같은 세기)
 *   fill   보충 — 판정 자리(from)가 이 스토리보다 앞인 척추(그 빈틈을 채운다)
 *   first  먼저 볼 스토리 [[키, 칸, 왜]](pre 그대로) · later 이 스토리를 선행으로 쓰는 뒤 스토리 [[키, 칸, 왜]](읽는 자리 순, due로 쓴 척추는 뺀다)
 */
export function guideOf(key, { units, spine, pre, rev, judged }) {
  const pos = units.get(key)?.order ?? Infinity;
  const after = (k) => units.has(k) && units.get(k).order > pos;
  const byOrder = (a, b) => units.get(a[0]).order - units.get(b[0]).order;
  const j = judged.get(key);
  const cites = (rev.get(key) ?? []).filter(([x]) => after(x)).sort(byOrder);
  const cands = cites.filter(([x]) => spine.has(x));
  if (j?.from && spine.has(j.from) && after(j.from)) cands.push([j.from, j.grade === '필수' ? '필수' : '권장', 'judged']);
  cands.sort(byOrder);
  // 척추 기한이 먼저(필수 스토리만 따라 읽는 사람의 기한) — 없으면 메인 밖 스토리의 필수 · 권장 선행, 그것도 없으면 척추의 선택 선행
  const strong = cands.find(([, l]) => l !== '선택') ?? cites.find(([x, l]) => !spine.has(x) && l !== '선택');
  const soft = cands.find(([, l]) => l === '선택');
  const pick = strong ?? soft;
  const due = pick ? { key: pick[0], level: pick[1], why: pick[2], soft: !strong } : null;
  const fill = j?.from && j.from !== key && spine.has(j.from) && units.has(j.from) && !after(j.from) ? j.from : null;
  const seen = new Set(due ? [due.key] : []);
  const later = cites.filter(([x]) => !seen.has(x) && seen.add(x));
  const first = Object.entries(pre?.[key] ?? {}).flatMap(([level, list]) => list.filter(([a]) => units.has(a)).map(([a, why]) => [a, level, why]));
  return { due, fill, first, later };
}

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
  const gl = (g) => fmt.GRADE[g]?.label ?? g;
  const judged = order.units.map((j) => ({ ...j, unit: idx.units.get(j.key) })).filter((j) => j.unit);
  const judgedByKey = new Map(judged.map((j) => [j.key, j]));
  const spine = order.spine.map((s) => ({ ...s, unit: idx.units.get(s.key) })).filter((s) => s.unit);
  const spineByKey = new Map(spine.map((s) => [s.key, s]));
  const pre = order.pre ?? {};
  /** 거꾸로 — A가 선행인 스토리들 [X, 칸] */
  const kindsPresent = KIND_PICK_ORDER.filter((k) => judged.some((j) => j.unit.kind === k) || spine.some((sp) => sp.unit.kind === k));
  const spineLabel = (key) => (spineByKey.get(key)?.unit.kind === 'main' ? fmt.tickShort(spineByKey.get(key).tick) : fmt.unitTitle(key));
  // 줄 안내 — 필터와 상관없이 한 번 낸다
  const guideCtx = { units: idx.units, spine: new Set(spine.map((sp) => sp.key)), pre, rev: preRev(pre), judged: judgedByKey };
  const guides = new Map();
  const guide = (key) => { if (!guides.has(key)) guides.set(key, guideOf(key, guideCtx)); return guides.get(key); };
  const flipped = new Set(); // 줄마다 펼침을 '안내 펼치기'와 반대로 둔 키

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
  const openAll = () => state.param('order', 'open') === '1';
  const openToggle = ui.toggle({ label: LABELS.openAll, title: LABELS.openAllHelp, checked: openAll(), onChange: (v) => { flipped.clear(); state.setParam('order', 'open', v ? '1' : null); } });
  root.append(ui.el('div', { class: 'toolbar order-toolbar' }, gradePick.el, ui.el('div', { class: 'order-kinds' }, kindPick.el), find, openToggle, status));
  const emptyBox = ui.el('div', { class: 'order-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);

  // ── 목록(감상 순서 한 줄) ──
  const listView = ui.el('div', { class: 'order-list' });
  const listEl = ui.el('ol', { class: 'order-seq' });
  listView.append(listEl);
  const muted = (text) => ui.el('span', { class: 'order-why' }, text);
  const whyText = (w) => (w && w !== 'judged' ? fmt.PRE_WHY[w] ?? w : null); // '분류에서 짚음'은 판정 말이라 뺀다(리더 선행 칸과 같다)
  /** 줄 안내 요약 — 회색 작은 글자 줄에 잇는다. 척추 줄은 '먼저 N편'만 */
  const guideChips = (item) => {
    const gd = guide(item.key);
    const out = [];
    if (!item.spine) {
      if (gd.due && item.ghostOf === gd.due.key) { /* 'X의 앞 편'이 이미 말한다 */ } else if (gd.due && !gd.due.soft) out.push(ui.el('span', { class: 'order-guide is-due', title: LABELS.dueHelp(spineLabel(gd.due.key)) }, fmt.preOf(spineLabel(gd.due.key))));
      else if (gd.due) out.push(ui.el('span', { class: 'order-guide', title: LABELS.softHelp(spineLabel(gd.due.key)) }, LABELS.dueSoft(spineLabel(gd.due.key))));
      else out.push(ui.el('span', { class: 'order-guide', title: LABELS.anytimeHelp }, LABELS.anytime));
      if (gd.fill) out.push(ui.el('span', { class: 'order-guide', title: LABELS.fillHelp(spineLabel(gd.fill)) }, LABELS.fillShort(spineLabel(gd.fill))));
    }
    const n = gd.first.filter(([, l]) => l !== '선택').length;
    if (n) out.push(ui.el('span', { class: 'order-guide', title: LABELS.firstNHelp }, LABELS.firstN(n)));
    return out;
  };
  const hasDetail = (item) => { const gd = guide(item.key); return Boolean(gd.due || gd.fill || gd.first.length || gd.later.length); };
  /** 줄 안내 펼침 — 언제(이유) · 보충 · 먼저 볼 스토리 · 이어짐. 링크는 그 스토리를 리더로 연다 */
  const guideDetail = (item) => {
    const gd = guide(item.key);
    const line = (label, ...body) => ui.el('div', { class: 'order-guide-row' }, ui.el('span', { class: 'order-guide-key' }, label), ui.el('span', {}, body));
    const name = (k) => ui.link(`unit:${k}`, spineByKey.has(k) ? spineLabel(k) : fmt.unitTitle(k));
    const rows = [];
    if (!item.spine) {
      const at = gd.due ? spineLabel(gd.due.key) : null;
      if (gd.due && !gd.due.soft) rows.push(line(LABELS.when, fmt.preOf(at), muted(LABELS.dueWhy(at, fmt.PRE_LABEL[gd.due.level]) + (whyText(gd.due.why) ? `(${whyText(gd.due.why)})` : ''))));
      else if (gd.due) rows.push(line(LABELS.when, LABELS.dueSoft(at), muted(LABELS.softWhy)));
      else rows.push(line(LABELS.when, LABELS.anytime, muted(LABELS.anytimeWhy)));
      if (gd.fill) rows.push(line(LABELS.fill, name(gd.fill), muted(LABELS.fillWhy)));
    }
    if (gd.first.length) {
      rows.push(line(LABELS.firstAll, fmt.PRE_LEVEL.filter((l) => gd.first.some(([, x]) => x === l)).map((l) => ui.el('div', {},
        ui.el('b', { title: fmt.help('pre', l) }, `${fmt.PRE_LABEL[l]} `),
        gd.first.filter(([, x]) => x === l).map(([k, , w], i) => [i ? ' · ' : null, name(k), whyText(w) ? muted(` (${whyText(w)})`) : null])))));
    }
    if (gd.later.length) {
      const MAX = 8;
      rows.push(line(LABELS.later, gd.later.slice(0, MAX).map(([k, l, w], i) => [i ? ' · ' : null, name(k), muted(` (${[`${fmt.PRE_LABEL[l]} 선행`, whyText(w)].filter(Boolean).join(' · ')})`)]),
        gd.later.length > MAX ? muted(LABELS.laterMore(gd.later.length - MAX)) : null));
    }
    return ui.el('div', { class: 'order-guide-box', onClick: (e) => e.stopPropagation() }, rows);
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
    const icon = unit.kind === 'episode' ? ui.portrait(fmt.episodeIcon(unit), { size: 28, class: 'order-face' }) : null;
    // 흐리게 끼운 앞 편은 왜 끼웠는지를 먼저(등급 필터 밖이라 원래 등급만 보면 헷갈린다)
    const meta = [
      ghost ? ui.el('span', { class: 'order-ghost', title: LABELS.ghostHelp(fmt.unitTitle(item.ghostOf)) }, LABELS.ghost(fmt.unitTitle(item.ghostOf))) : null,
      ui.el('span', { class: 'g-label', title: fmt.help('grade', g) }, gl(g)),
      ui.el('span', { class: 'order-kind', title: fmt.help('kind', unit.kind) }, fmt.KIND[unit.kind]?.label ?? unit.kind),
      ...guideChips(item),
    ].filter(Boolean);
    // 줄 안내 펼침 — 줄 끝 단추(기본 접힘, '안내 펼치기'면 펼침). 펼칠 때 처음 만든다
    let box = null;
    const more = hasDetail(item) ? ui.el('button', { type: 'button', class: 'order-more', 'aria-expanded': 'false', title: LABELS.moreHelp,
      onClick: (e) => { e.stopPropagation(); if (flipped.has(key)) flipped.delete(key); else flipped.add(key); show(); },
      onKeydown: (e) => e.stopPropagation() }, LABELS.more) : null;
    const show = () => {
      const on = openAll() !== flipped.has(key);
      more.setAttribute('aria-expanded', String(on));
      if (on && !box) { box = guideDetail(item); li.append(box); }
      if (box) box.hidden = !on;
    };
    const li = ui.el('li', attrs,
      ui.el('span', { class: 'order-line' }, icon,
        ui.el('span', { class: 'order-title g-title' }, ui.link(`unit:${key}`, unit.title)),
        ui.el('span', { class: 'order-meta' }, meta.map((x, i) => [i ? ui.el('span', { class: 'order-sep', 'aria-hidden': 'true' }, '·') : null, x]),
          unseen ? ui.el('span', { class: 'order-unseen', title: LABELS.unseenHelp }, LABELS.unseen) : null),
        more),
      firstLine(key, inList));
    if (more) show();
    return li;
  };
  const markSelected = (key) => {
    for (const li of listEl.children) { const on = li.dataset.key === key; li.classList.toggle('is-selected', on); li.setAttribute('aria-current', on ? 'true' : 'false'); }
  };
  root.append(listView);

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
    const grades = gradePick.cur();
    const kinds = kindPick.cur();
    gradePick.sync();
    kindPick.sync();
    openToggle.set(openAll());
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

  // ── 상태 ──
  apply(state.get());
  const off = state.subscribe((s, changed) => {
    if (changed.has('t') || changed.has('p')) apply(s);
    else if (changed.has('sel')) {
      const sel = state.parseSel(s.sel);
      markSelected(sel?.type === 'unit' ? sel.id : null);
    }
  });
  return () => { off(); clearTimeout(findTimer); };
}
