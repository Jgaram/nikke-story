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
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13b)
 *   목록은 여기까지 읽음과 관계없이 전부 보인다(사용자, 2026-10-10 — 안 본 사람에게 어떤 순서로 볼지 알려 주는 안내라서). 등급은 최종 등급,
 *     여기까지 읽음은 자리 표시만 한다: 목록은 그 시점 ≤ 이고 본 마지막 척추 줄 아래 "여기까지 읽음" 구분 줄(cutRowAt).
 *     본 것 · 안 본 것은 출시 시점이 아니라 스토리마다 R = state.reading(s)로 정한다 — 척추 이벤트 · 사이드는 '봤음' 예외(x)를 따르고,
 *     예외가 없으면 R.seen(키) ≡ 출시 시점 ≤ t. 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드는 줄에 '안 봄' 표시.
 *   목록: 감상 순서 한 줄(ol). 척추 줄은 종류 필터(+ 척추 이벤트 · 사이드는 등급 '필수')에 들면 보이고, 그 사이에 필터에 든 메인 밖 스토리를 읽는 자리 순서대로 끼운다.
 *     메인 챕터 = 구획 줄(굵은 CH 표기 + 이름, 아래에 '먼저 볼 것'만 — 메인 밖 줄과 같은 기준, 사용자 2026-10-10). 그 밖의 줄 = [호감도는 그 니케 초상] 제목 + 회색 작은 글자(등급 이름 · 종류 · 줄 안내 요약).
 *   줄 안내(fmt.guideOf — 사용자, 2026-10-10: 처음 보는 사람의 가이드 — 필수만 먼저 보는 사람도, 차근차근 다 보는 사람도). 모든 등급, 메인 밖 줄 · 척추 줄(메인 챕터는 '먼저 볼 것'만).
 *     두 방향 하나씩만: '먼저 볼 것: CH.12 · 랩칠리언 1'(줄 아래 — 최소 선행: 판정 자리가 앞인 척추 + 필수 선행) · 'CH.27 전까지'(회색 글자 줄 — 뒤에서 이 스토리를
 *     필수 · 권장 선행으로 쓰는 가장 앞 척추, 없으면 메인 밖 스토리). 둘 다 없으면 목록 자리 뒤 언제든(머리 아래 한 줄 설명). 왜 선행인가(떡밥 → 회수 · 다시 언급 등)는
 *     스포일러가 될 수 있어 싣지 않는다(사용자, 2026-10-10). 흐리게 끼운 앞 편은 'X의 앞 편'이 기한을 말하므로 기한을 다시 쓰지 않는다.
 *     색은 등급 띠만(style.css .g-band): 준필수 = 굵은 띠 + 연한 바탕, 추천 = 얇은 띠, 참고 · 독립 = 띠 없이 회색 제목, 필수(척추) = 띠 없이 굵은 제목. 종류는 글자(색 없음).
 *     순번 · 날짜 · 글자 수는 싣지 않는다(날짜 · 분량은 리더). 이유(분석 문장)도 목록에는 없고 리더 분류 칸에만.
 *     선행: 앞 편(필수 선행)이 등급 필터로만 숨으면 그 줄을 흐리게 끼운다(ghostKeys — 이야기가 1 · 6 · 7로 끊기지 않게, 앞 편의 앞 편도).
 *     권장 · 선택 선행은 목록에 없다(리더 분류 칸에 전부).
 *     필터는 최종 등급으로 본다. 한 줄 한 칸이라 좁은 폭(390px)에서도 제목이 줄바꿈될 뿐 접지 않는다.
 *   스토리를 누르면 sel=unit:키 → 리더 패널 하나(사용자, 2026-10-10 — 따로 있던 분류 카드를 리더 분류 칸으로 합쳤다: 그 시점의 등급 gradeAt ·
 *     언제 읽나 · 선행 · 선행인 곳 · 이유 · 장면 · 이어지는 필수 스토리 · 주역 · 결말 — lib/reader.js classPanel).
 *   용어는 fmt(GRADE · help · ref)에서 가져오고, 없는 말만 아래 LABELS에 둔다.
 */
import { gradeAt, guideOf, preRev } from '../lib/format.js';

export const meta = { id: 'order', title: '감상 순서', blurb: '메인 스토리 사이사이에 꼭 볼 스토리를 끼워 넣은 순서' };

/** fmt에 없는 화면 말 — 고칠 때는 여기 한 곳만 */
const LABELS = {
  title: '감상 순서',
  grade: '등급', kind: '종류',
  find: '제목 검색', findAria: '스토리 제목 검색',
  count: (n) => `${n}편`, countHelp: '지금 목록에 든 스토리 수(흐리게 끼운 앞 편은 빼고)',
  must: '먼저 볼 것', mustHelp: '이 스토리 전에 꼭 볼 스토리 — 앞 편이거나, 이 스토리가 빈틈을 채우는 필수 스토리',
  dueHelp: (at) => `뒤의 ${at}에서 이 스토리를 이어받는다 — 그 전에 보면 좋다`,
  guideNote: "'먼저 볼 것'은 이 스토리 전에 꼭 볼 스토리, 'CH.27 전까지'는 그 스토리가 이 스토리를 이어받으니 그 전에 보라는 뜻이다. 목록 자리(출시순)대로 보면 둘 다 지켜지고, 표시가 없으면 목록 자리 뒤 언제 봐도 된다.",
  ghost: (t) => `${t}의 앞 편`, ghostHelp: (t) => `${t}의 앞 편 — 등급 필터 밖이지만 이야기가 끊기지 않게 흐리게 끼워 두었다`,
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


export { gradeAt, guideOf, preRev }; // 계산은 lib/format.js 한 곳(리더의 분류 칸이 쓴다)

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
  root.append(ui.el('p', { class: 'order-note' }, LABELS.guideNote));
  const emptyBox = ui.el('div', { class: 'order-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);

  // ── 목록(감상 순서 한 줄) ──
  const listView = ui.el('div', { class: 'order-list' });
  const listEl = ui.el('ol', { class: 'order-seq' });
  listView.append(listEl);
  /** 'CH.27 전까지' — 회색 글자 줄에. 흐리게 끼운 앞 편은 'X의 앞 편'이 이미 말한다 */
  const dueText = (item) => {
    const d = guide(item.key).due;
    if (!d || item.spine || item.ghostOf === d.key) return null;
    return ui.el('span', { class: 'order-due', title: LABELS.dueHelp(spineLabel(d.key)) }, fmt.preOf(spineLabel(d.key)));
  };
  /** '먼저 볼 것: CH.12 · 랩칠리언 1' — 줄 아래 한 줄(최소 선행). 링크는 그 스토리를 리더로 연다 */
  const mustLine = (key) => {
    const must = guide(key).must;
    if (!must.length) return null;
    return ui.el('span', { class: 'order-pre', title: LABELS.mustHelp, onClick: (e) => e.stopPropagation() }, `${LABELS.must}: `,
      must.map((k, i) => [i ? ' · ' : null, ui.link(`unit:${k}`, spineByKey.has(k) ? spineLabel(k) : fmt.unitTitle(k))]));
  };
  /** 'CH.07 재회' → 굵은 CH 표기 + 이름 */
  const chTitle = (title) => { const m = /^(CH\.\d+)\s*(.*)$/.exec(title); return m ? [ui.el('span', { class: 'ch' }, m[1]), m[2] ? ` ${m[2]}` : null] : title; };
  /** 감상 순서의 한 줄. 척추이면 item.spine, 흐리게 끼운 앞 편이면 item.ghostOf(부른 줄의 키) */
  const seqRow = (item, unseen = false) => {
    const { key, unit } = item;
    const go = () => state.set({ sel: `unit:${key}` });
    const attrs = { class: 'order-row', dataset: { key }, tabindex: 0, role: 'button', onClick: go, onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } };
    if (item.spine && unit.kind === 'main') {
      attrs.class = 'order-row is-main';
      return ui.el('li', attrs, ui.el('span', { class: 'order-line' }, ui.el('span', { class: 'order-title' }, ui.link(`unit:${key}`, chTitle(unit.title)))), mustLine(key));
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
      dueText(item),
    ].filter(Boolean);
    return ui.el('li', attrs,
      ui.el('span', { class: 'order-line' }, icon,
        ui.el('span', { class: 'order-title g-title' }, ui.link(`unit:${key}`, unit.title)),
        ui.el('span', { class: 'order-meta' }, meta.map((x, i) => [i ? ui.el('span', { class: 'order-sep', 'aria-hidden': 'true' }, '·') : null, x]),
          unseen ? ui.el('span', { class: 'order-unseen', title: LABELS.unseenHelp }, LABELS.unseen) : null)),
      mustLine(key));
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
    // 감상 순서: 척추(종류 필터 + 메인 밖은 등급 '척추') + 고른 등급(최종 등급)의 메인 밖 스토리 + 등급 필터로만 숨은 앞 편(흐리게), 읽는 자리 순서
    const spineOn = grades.includes('척추');
    const spineRows = spine.filter((sp) => kinds.includes(sp.unit.kind) && (sp.unit.kind === 'main' || spineOn) && findOk(sp, s)).map((sp) => ({ ...sp, spine: true }));
    const extras = judged.filter((j) => grades.includes(j.grade) && match(j, s, kinds));
    const shown = [...spineRows, ...extras];
    const ghosts = ghostKeys(shown.map((x) => x.key), pre, (k) => judgedByKey.has(k) && match(judgedByKey.get(k), s, kinds));
    const seq = [...shown, ...[...ghosts].map(([k, by]) => ({ ...judgedByKey.get(k), ghostOf: by }))].sort((a, b) => a.unit.order - b.unit.order || a.tick - b.tick);
    ui.clear(status);
    status.append(ui.el('span', { class: 'order-count', title: LABELS.countHelp }, LABELS.count(fmt.num(shown.length))));
    // 목록
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    // 여기까지 읽음 구분 줄 — 그 시점 ≤ 이고 본 마지막 척추 줄 아래(이 아래가 다음에 볼 순서)
    const cutAt = cutRowAt(seq, cut, rd);
    // 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드 — 줄에 '안 봄'(예외가 없으면 없다)
    const lis = seq.map((x, i) => seqRow(x, x.spine && i < cutAt && !rd.seen(x.key)));
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
