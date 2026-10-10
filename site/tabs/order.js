/**
 * 탭 1 감상 순서(W2) — 화면 1 "스토리 중요도 분류"(docs/views.md 1절, 판정 카드 docs/importance.md).
 * 첫 쓸모: 스토리를 다 보지 않고 중요한 것만 빠르게 — 척추(메인 챕터 + 척추 이벤트 · 사이드)을 출시순 한 줄로 두고,
 *   등급 거르개(기본 필수 · 추천)에 든 메인 밖 스토리를 그 사이사이 제자리(읽는 자리 units.json order)에 끼워 넣은 감상 순서.
 *
 * 쓰는 JSON
 *   order.json(이 탭 — tools/site/export/order.mjs): units[421](판정 단위 — 등급 · 출시 시점 · from · before · basis · reason · trail · 떡밥 · 주역) · spine[60](척추 자리) · leads[20](주역 명단 — 이 탭은 쓰지 않는다) · counts
 *   order-detail.json(분류 카드를 처음 열 때 받는다): units{키 → { history, basis_text, reviews }} · notes[]
 *   synopsis.json(공개 개요 — 분류 카드 머리 아래 한 줄 소개, W8): [{ key, logline, … }] — 여기까지 읽음 안 스토리만, 없으면 그리지 않는다
 *   공용(idx): units.json(종류 · 제목 · 글자 수 · 범위) · ticks.json(출시 시점 라벨)
 *
 * URL 파라미터(p.*)
 *   mode   list(목록, 기본) | map(지도)
 *   g      등급 거르개(쉼표 목록: 필수 · 보강 · 참고 · 독립), 없으면 필수 · 보강(DEFAULT_GRADES) — 지도에도 쓴다
 *   k      종류 거르개(쉼표 목록: event · episode · sub · relic · side · erelic · elevator), 없으면 유실물 둘(relic · erelic)을 뺀 전부 — 유실물은 사용자가 켜야 보인다
 *   find   제목 · 키 · 이유 안 낱말 검색
 *   rows   지도의 행: grade(등급별, 기본) | kind(종류별)
 *
 * 그리는 규칙
 *   목록 · 지도는 여기까지 읽음과 관계없이 전부 보인다(사용자, 2026-10-10 — 안 본 사람에게 어떤 순서로 볼지 알려 주는 안내라서). 등급은 최종 등급,
 *     여기까지 읽음은 자리 표시만 한다: 목록은 그 시점 ≤ 이고 본 마지막 척추 줄 아래 "여기까지 읽음" 구분 줄(cutRowAt), 지도는 그 뒤 칸을 옅게.
 *     본 것 · 안 본 것은 출시 시점이 아니라 스토리마다 R = state.reading(s)로 정한다 — 척추 이벤트 · 사이드는 '봤음' 예외(x)를 따르고,
 *     예외가 없으면 R.seen(키) ≡ 출시 시점 ≤ t. 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드는 줄에 '안 봄' 표시 · 옅게, 지도 축에는 속 빈 표시.
 *     범위 거르개 밖 스토리는 숨기고 개수만 보인다.
 *   분류 카드는 여기까지 읽음을 따른다 — 그 시점의 등급 gradeAt(u, R)(tools/views/importance.mjs와 같다: 전부 보기면 최종 등급, 안 본 스토리면 아직 없음,
 *     from 시점이 있고 t < from 시점이면 그 앞 등급(before), 그 밖은 최종 등급), 안 본 스토리는 한 줄 소개를 안 그리고 이유 · 떡밥 등은 "스포일러 보기" 접이 안에.
 *     '이 스토리가 선행인 곳'도 본 스토리만 든다.
 *   목록: 감상 순서 한 줄(ol). 척추 줄(메인 챕터는 굵은 구분 줄, 척추 이벤트 · 사이드는 '필수' 칩)은 늘 보이고, 그 사이에 거르개에 든 메인 밖 스토리를
 *     읽는 자리 순서대로 들여 끼운다. 한 줄 = 순번 · 등급 · 종류 · 제목(+ 뒤에 오를 등급) · 글자. 이유(분석 문장)는 목록에 싣지 않고 분류 카드 · 리더에만(사용자 — 목록이 설명으로 길어진다).
 *     거르개는 최종 등급으로 본다. 본문 폭이 좁으면(컨테이너 쿼리 640px) 순번 | 칩 · 글자 / 제목으로 접는다.
 *   지도: 척추 60곳(메인 49 + 척추 이벤트 8 · 사이드 3)을 가로축으로, 스토리를 그 출시 시점 ≤ 인 마지막 척추 칸에 점으로. 행 = 등급 또는 종류(칸마다 점 수에 맞춘 높이),
 *     행 이름은 SVG 밖 HTML 열(자르지 않는다), 축 라벨은 가로 `CH.07` — 겹치면 건너뛴다(전부는 호버). 점 색 = 최종 등급(파랑 램프), 점 크기는 같다.
 *     척추 스토리는 축에 표시만(채점하지 않는다). 축을 누르면 그 시점까지 읽은 것으로 둔다.
 *   스토리를 누르면 sel=unit:키 → 리더 패널 + (넓은 화면에서) 아래에 붙는 분류 카드(등급 · 등급 변화 · 이유 · 관련 메모 · 떡밥 · 주역 · 분류가 바뀐 기록).
 *   색은 등급 램프(--grade-*)만 — 종류는 칩 · 행 이름으로 (종류 색과 등급 색을 한 차트에 같이 쓰지 않는다).
 *   키보드: 점 421개를 모두 탭 정지점으로 만들지 않는다(축 60칸만 tabindex 0) — 같은 내용을 목록 모드의 표(줄마다 초점)가 준다.
 *   표 → 카드형 행은 화면이 아니라 묶음 폭(컨테이너 쿼리 840px)으로 접힌다 — 리더 패널이 열려 본문이 좁아져도 가로로 넘치지 않는다.
 *   용어는 fmt(GRADE · LAYER · TERM · help · hiddenLabel · ref)에서 가져오고, 없는 말만 아래 LABELS에 둔다.
 */
import { gradeAt, plain } from '../lib/format.js';

export const meta = { id: 'order', title: '감상 순서', blurb: '메인 스토리 사이사이에 꼭 볼 스토리를 끼워 넣은 순서' };

/** fmt에 없는 화면 말 — 고칠 때는 여기 한 곳만 */
const LABELS = {
  title: '감상 순서',
  lede: '메인 스토리를 순서대로 두고, 고른 등급의 스토리를 그 사이사이 볼 자리에 끼워 넣었다. 기본은 필수 · 추천만 — 등급 · 종류를 켜면 늘어난다.',
  view: '보기', list: '목록', map: '지도',
  grade: '등급', kind: '종류',
  find: '제목 · 이유 검색', findAria: '스토리 검색',
  count: (n, chars) => `${n}편 · ${chars}자`, countHelp: '지금 목록에 든 스토리 수(필수 스토리 포함)와 대사 글자 수',
  extras: (n) => `필수 밖 ${n}`,
  preOfHelp: (at) => `${at}을 보기 전에 보면 좋다`, pre: '선행', riseSince: (at) => `${at}부터`, riseBefore: (at, grade) => `${at} 앞에서는 ${grade}`,
  rowsGrade: '등급별', rowsKind: '종류별', rows: '행',
  legendSpine: { main: '메인 챕터', event: '필수 이벤트', side: '필수 사이드' },
  mapHint: '점을 누르면 분류 · 아래 축을 누르면 그 시점까지 읽은 것으로 둔다',
  mapAria: (n, rows) => `필수 스토리 ${n}곳을 가로축으로, 스토리 ${rows}개를 등급 색 점으로 단 지도`,
  afterCut: '아직 안 읽음', axisGo: '누르면 여기까지 읽은 것으로 둔다',
  cutLine: (at) => `여기까지 읽음 · ${at}`, cutLineHelp: '이 아래가 다음에 볼 순서', goCut: '읽은 자리로', emptyFilter: '거르개에 맞는 스토리가 없다.',
  clearFilter: '거르개 풀기', outScope: '범위 밖',
  card: '분류', cardClose: '닫기',
  rows2: {
    grade: '등급', why: '관련 메모', reason: '이유', judg: '분류', threads: '떡밥', lead: '주역', origins: '첫 이야기', endings: '결말', history: '분류가 바뀐 기록',
    pre: '선행 스토리', preFor: '이 스토리가 선행인 곳', release: '출시 시점', touch: '닿는 필수 스토리',
  },
  none: '없음',
  after: (at) => `여기까지 읽음 뒤 — ${at}에 나온다`, unseen: '안 봄', unseenHelp: '여기까지 읽음 앞이지만 안 본 것으로 둔 스토리', spoiler: '여기까지 읽음 뒤 — 스포일러 보기', reviews: (n) => `검토 기록 ${n}`, before: '그 전: ', asof: '기준일', scene: '씬',
  trailNone: '바뀐 적 없다',
};
const GRADES = ['필수', '보강', '참고', '독립'];
const DEFAULT_GRADES = ['필수', '보강']; // 중요한 것만 빠르게 — 사용자가 참고 · 독립을 켠다
const OFF_KINDS = ['relic', 'erelic']; // 유실물은 기본으로 뺀다(사용자, 2026-10-09)
/** 쉼표 목록 파라미터 → 고른 값(없으면 기본값). 모르는 값은 버린다 */
const listParam = (v, all, dflt) => (v == null ? dflt : v.split(',').filter((x) => all.includes(x)));

const DOT_R = 4; // 점 반지름(지름 8px — dataviz 최소)
const STEP = DOT_R * 2 + 1; // 점 사이 간격
const COL_MIN = 20; // 척추 한 칸의 최소 너비(점 둘이 나란히)
const LANE_MIN = 40; // 행 최소 높이(행 이름 두 줄이 들어간다)
const LANE_PAD = 8;
const AXIS_H = 46; // 축(표시 + 라벨) 높이
const AXIS_LABEL_W = 36; // `CH.07` 한 라벨이 차지하는 폭(11px 숫자 + 여백)
const SVGNS = 'http://www.w3.org/2000/svg';

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

const clip = (s, n) => (typeof s === 'string' && [...s].length > n ? `${[...s].slice(0, n).join('')}…` : s ?? '');
/** SVG 요소 만들기(d3 없이도 지도가 그려진다) */
function S(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
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
  const spineTicks = spine.map((s) => s.tick);
  const pre = order.pre ?? {};
  /** 거꾸로 — A가 선행인 스토리들 [X, 칸] */
  const preFor = new Map();
  for (const [x, row] of Object.entries(pre)) for (const l of fmt.PRE_LEVEL) for (const [a] of row[l] ?? []) (preFor.get(a) ?? preFor.set(a, []).get(a)).push([x, l]);
  /** 출시 시점 → 척추 칸(그 시점 ≤ 인 마지막 척추 스토리) */
  const colOf = (tick) => {
    let lo = 0; let hi = spineTicks.length - 1; let ans = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (spineTicks[mid] <= tick) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };
  const kindsPresent = fmt.KIND_ORDER.filter((k) => judged.some((j) => j.unit.kind === k));
  const spineLabel = (key) => (spineByKey.get(key)?.unit.kind === 'main' ? fmt.tickShort(spineByKey.get(key).tick) : fmt.unitTitle(key));
  const recId = (id) => (/^J\d/.test(id) ? ui.link(`thread:${id}`, id) : ui.link(`record:${id}`, id));
  /** 문장 속 메모 ID(F48 · Q36 · J2 · D18 …)를 링크로 */
  const withLinks = (text) => String(text ?? '').split(/\b([FQSIEDUOH]\d+|J\d+)\b/).map((p, i) => (i % 2 ? recId(p) : plain(p)));
  let curR = state.reading(state.get()); // 지금 읽은 데까지(스토리마다 봤나) — apply가 바꾼다

  // ── 머리 · 도구 줄 ──
  root.append(ui.el('div', { class: 'tab-head order-head' }, ui.el('h2', {}, LABELS.title)), ui.el('p', { class: 'order-lede muted' }, LABELS.lede));
  const status = ui.el('span', { class: 'order-status', role: 'status', 'aria-live': 'polite' });
  const modeSeg = ui.segmented({ label: LABELS.view, options: [{ value: 'list', label: LABELS.list }, { value: 'map', label: LABELS.map }], value: state.param('order', 'mode') ?? 'list', onChange: (v) => state.setParam('order', 'mode', v === 'list' ? null : v) });
  /** 여러 개를 켜고 끄는 칩 줄(aria-pressed). 기본값과 같으면 URL에서 지운다 */
  const picks = ({ label, param, options, dflt }) => {
    const btns = new Map();
    const box = ui.el('div', { class: 'order-picks', role: 'group', 'aria-label': label }, ui.el('span', { class: 'order-picks-label' }, label));
    const cur = () => listParam(state.param('order', param), options.map((o) => o.value), dflt);
    for (const o of options) {
      const b = ui.el('button', { type: 'button', class: 'order-pick', 'aria-pressed': 'false', title: o.title, dataset: { v: o.value } }, o.dot ? ui.el('i', { class: 'order-pick-dot', style: { background: o.dot }, 'aria-hidden': 'true' }) : null, o.label);
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
  const gradePick = picks({ label: LABELS.grade, param: 'g', dflt: DEFAULT_GRADES, options: GRADES.map((g) => ({ value: g, label: gl(g), title: fmt.help('grade', g), dot: fmt.GRADE[g].color })) });
  const kindDefault = kindsPresent.filter((k) => !OFF_KINDS.includes(k));
  const kindPick = picks({ label: LABELS.kind, param: 'k', dflt: kindDefault, options: kindsPresent.map((k) => ({ value: k, label: fmt.KIND[k].label, title: fmt.help('kind', k) })) });
  const find = ui.el('input', { type: 'search', class: 'order-find', placeholder: LABELS.find, 'aria-label': LABELS.findAria, value: state.param('order', 'find') ?? '' });
  let findTimer = null;
  let findPending = false; // 입력 뒤 URL에 싣기 전 — 그 사이 다른 거르개가 바뀌어도 입력칸을 되돌리지 않는다
  find.addEventListener('input', () => {
    clearTimeout(findTimer);
    findPending = true;
    findTimer = setTimeout(() => { findPending = false; state.setParam('order', 'find', find.value.trim() || null); }, 200);
  });
  root.append(ui.el('div', { class: 'toolbar order-toolbar' }, modeSeg.el, gradePick.el, ui.el('div', { class: 'order-kinds' }, kindPick.el), find, status));
  const emptyBox = ui.el('div', { class: 'order-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);

  // ── 목록(감상 순서 한 줄) ──
  const listView = ui.el('div', { class: 'order-list' });
  const listEl = ui.el('ol', { class: 'order-seq' });
  listView.append(listEl);
  /** 'CH.30 선행' — 판정이 짚은 척추 자리(from)의 선행이다. 등급이 그 자리부터 오르면 툴팁에 */
  const preOfChip = (j) => {
    // 척추가 이 스토리보다 앞이면(출시 전 척추가 닿는 자리) 선행이 아니다 — prereqsOf와 같은 규칙
    if (!j.from || !spineByKey.has(j.from) || !(j.unit.order < spineByKey.get(j.from).unit.order)) return null;
    const at = spineLabel(j.from);
    let tip = LABELS.preOfHelp(at);
    if (j.from_tick) tip += ` · ${LABELS.riseBefore(at, gl(j.before ?? j.grade))}`;
    return ui.el('span', { class: 'order-preof', title: tip }, fmt.preOf(at));
  };
  /** 선행 한 줄 — 꼭(키 필수)은 이름으로, 권장 · 선택은 개수만(전부는 분류 카드 · 리더) */
  const preLine = (key) => {
    const p = pre[key];
    if (!p) return null;
    const parts = [];
    if (p.필수?.length) parts.push([ui.el('b', { title: fmt.help('pre', '필수') }, `${fmt.PRE_LABEL.필수} `), p.필수.map(([k], i) => [i ? ', ' : null, ui.link(`unit:${k}`, fmt.unitTitle(k))])]);
    for (const l of ['권장', '선택']) if (p[l]?.length) parts.push(ui.el('span', { title: fmt.help('pre', l) }, `${fmt.PRE_LABEL[l]} ${p[l].length}`));
    return ui.el('span', { class: 'order-pre', onClick: (e) => e.stopPropagation() }, `${LABELS.pre} `, parts.map((x, i) => [i ? ' · ' : null, x]));
  };
  /** 감상 순서의 한 줄. 척추이면 sp, 메인 밖이면 j */
  const seqRow = (item, n, unseen = false) => {
    const { key, unit } = item;
    const go = () => state.set({ sel: `unit:${key}` });
    const attrs = { class: 'order-row', dataset: { key }, tabindex: 0, role: 'button', title: fmt.tickLabel(item.tick), onClick: go, onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } };
    const num = ui.el('span', { class: 'order-n' }, String(n));
    const chars = ui.el('span', { class: 'order-chars' }, fmt.num(unit.chars));
    if (item.spine) {
      const isMain = unit.kind === 'main';
      attrs.class = `order-row ${isMain ? 'is-main' : 'is-spine'}${unseen ? ' is-unseen' : ''}`;
      return ui.el('li', attrs, num,
        ui.el('span', { class: 'order-badges' }, isMain ? null : ui.chip('grade', '척추'), isMain ? null : ui.chip('kind', unit.kind),
          unseen ? ui.el('span', { class: 'order-unseen', title: LABELS.unseenHelp }, LABELS.unseen) : null),
        ui.el('span', { class: 'order-title' }, ui.link(`unit:${key}`, unit.title), preLine(key)), chars);
    }
    const g = item.grade;
    attrs.class = 'order-row is-extra';
    return ui.el('li', attrs, num,
      ui.el('span', { class: 'order-badges' }, ui.chip('grade', g), ui.chip('kind', unit.kind)),
      ui.el('span', { class: 'order-title' }, ui.link(`unit:${key}`, unit.title), preOfChip(item), preLine(key)),
      chars);
  };
  const markSelected = (key) => {
    for (const li of listEl.children) { const on = li.dataset.key === key; li.classList.toggle('is-selected', on); li.setAttribute('aria-current', on ? 'true' : 'false'); }
  };
  root.append(listView);

  // ── 지도 ──
  const mapView = ui.el('div', { class: 'order-mapview' });
  mapView.hidden = true;
  const rowsSeg = ui.segmented({ label: LABELS.rows, options: [{ value: 'grade', label: LABELS.rowsGrade }, { value: 'kind', label: LABELS.rowsKind }], value: state.param('order', 'rows') ?? 'grade', onChange: (v) => state.setParam('order', 'rows', v === 'grade' ? null : v) });
  const mapHint = ui.el('button', { type: 'button', class: 'order-info', 'aria-label': LABELS.mapHint }, 'i');
  ui.tooltip(mapHint, LABELS.mapHint);
  const mark = (cls, label) => ui.el('span', { class: 'legend-item' }, ui.el('i', { class: `order-mark ${cls}`, 'aria-hidden': 'true' }), label);
  const mapLegend = ui.el('div', { class: 'order-legend' },
    ui.legend(GRADES.map((g) => ({ label: gl(g), color: fmt.GRADE[g].color }))),
    ui.el('div', { class: 'legend' }, mark('order-mark-main', LABELS.legendSpine.main), mark('order-mark-event', LABELS.legendSpine.event), mark('order-mark-side', LABELS.legendSpine.side), mapHint));
  mapView.append(ui.el('div', { class: 'toolbar order-maptools' }, rowsSeg.el, mapLegend));
  const laneCol = ui.el('div', { class: 'order-lanes' });
  const mapScroll = ui.el('div', { class: 'order-map' });
  const svg = S('svg', { class: 'order-svg', role: 'img' });
  mapScroll.append(svg);
  mapView.append(ui.el('div', { class: 'order-mapbox' }, laneCol, mapScroll));
  root.append(mapView);

  // ── 분류 카드(선택한 스토리) ──
  const card = ui.el('section', { class: 'order-card panel', 'aria-label': LABELS.card });
  card.hidden = true;
  root.append(card);

  // ── 거르기 ──
  const findOk = (x, s) => {
    const q = (s.p.find ?? '').toLowerCase();
    return !q || `${x.unit.title} ${x.key} ${plain(x.reason ?? '')}`.toLowerCase().includes(q);
  };
  const match = (j, s, kinds) => kinds.includes(j.unit.kind) && findOk(j, s);
  let current = { rows: [], cut: null };
  const clearFilters = () => state.set({ p: { g: null, k: null, find: null } }, { replace: true });
  const apply = (s) => {
    const cut = s.t; // 여기까지 읽음 — 목록 · 지도는 거르지 않고 자리만 표시한다
    const rd = state.reading(s);
    curR = rd;
    const grades = gradePick.cur();
    const kinds = kindPick.cur();
    gradePick.sync();
    kindPick.sync();
    const inLayer = judged.filter((j) => j.unit.layer == null || s.layers.includes(j.unit.layer));
    const rows = inLayer.filter((j) => match(j, s, kinds));
    // 감상 순서: 척추(늘) + 고른 등급(최종 등급)의 메인 밖 스토리, 읽는 자리 순서
    const spineRows = spine.filter((sp) => findOk(sp, s)).map((sp) => ({ ...sp, spine: true }));
    const extras = rows.filter((j) => grades.includes(j.grade));
    current = { rows: extras, cut }; // 지도도 같은 거르개
    const seq = [...spineRows, ...extras].sort((a, b) => a.unit.order - b.unit.order || a.tick - b.tick);
    const hiddenLayer = judged.length - inLayer.length;
    const mode = s.p.mode ?? 'list';
    ui.clear(status);
    if (mode === 'list') {
      const chars = seq.reduce((m, x) => m + (x.unit.chars ?? 0), 0);
      const cnt = ui.el('span', { class: 'order-count', title: LABELS.countHelp }, LABELS.count(fmt.num(seq.length), fmt.num(chars)));
      status.append(cnt, ' ', ui.el('span', { class: 'muted' }, `(${LABELS.extras(fmt.num(extras.length))})`));
    } else status.append(ui.el('span', { class: 'order-count' }, `${fmt.num(extras.length)} / ${fmt.num(judged.length)}`));
    if (hiddenLayer) status.append(' · ', ui.el('span', { class: 'muted' }, `${LABELS.outScope} ${fmt.num(hiddenLayer)}`));
    // 목록
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    // 여기까지 읽음 구분 줄 — 그 시점 ≤ 이고 본 마지막 척추 줄 아래(이 아래가 다음에 볼 순서)
    const cutAt = cutRowAt(seq, cut, rd);
    // 구분 줄 위인데 안 봄으로 둔 척추 이벤트 · 사이드 — 줄에 '안 봄'(예외가 없으면 없다)
    const lis = seq.map((x, i) => seqRow(x, i + 1, x.spine && i < cutAt && !rd.seen(x.key)));
    if (cutAt >= 0 && cutAt < seq.length - 1) {
      lis.splice(cutAt + 1, 0, ui.el('li', { class: 'order-cutrow', title: LABELS.cutLineHelp, dataset: { key: '' } }, ui.el('span', {}, LABELS.cutLine(fmt.tickShort(cut)))));
      status.append(' · ', ui.el('button', { type: 'button', class: 'link-btn', onClick: () => listEl.querySelector('.order-cutrow')?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, LABELS.goCut));
    }
    listEl.replaceChildren(...lis);
    markSelected(selKey);
    const empty = mode === 'list' ? seq.length === 0 : extras.length === 0;
    emptyBox.hidden = !empty;
    if (empty) {
      ui.clear(emptyBox);
      emptyBox.append(ui.notice(LABELS.emptyFilter), ui.el('button', { type: 'button', class: 'btn', onClick: clearFilters }, LABELS.clearFilter));
    }
    // 모드 · 지도
    modeSeg.set(mode);
    rowsSeg.set(s.p.rows ?? 'grade');
    if (!findPending && find.value !== (s.p.find ?? '') && document.activeElement !== find) find.value = s.p.find ?? '';
    listView.hidden = mode !== 'list' || empty;
    mapView.hidden = mode !== 'map' || empty;
    if (mode === 'map' && !empty) drawMap(s);
  };

  // ── 지도 그리기 ──
  let lastColW = 0;
  const drawMap = (s) => {
    const { rows, cut } = current;
    const sel = state.parseSel(s.sel);
    const selKey = sel?.type === 'unit' ? sel.id : null;
    const byKind = (s.p.rows ?? 'grade') === 'kind';
    const lanes = byKind ? kindsPresent.map((k) => ({ id: k, label: fmt.KIND[k].label, help: fmt.help('kind', k) })) : GRADES.filter((g) => gradePick.cur().includes(g)).map((g) => ({ id: g, label: gl(g), help: fmt.help('grade', g) }));
    const laneOf = (j) => (byKind ? j.unit.kind : j.grade);
    const n = spine.length;
    const pad = 12;
    const avail = (mapScroll.clientWidth || root.clientWidth || 900) - pad * 2;
    const colW = Math.max(COL_MIN, Math.floor(avail / n));
    lastColW = colW;
    const perRow = Math.max(1, Math.floor((colW - 2) / STEP));
    const width = pad * 2 + colW * n;
    const colX = (i) => pad + i * colW;
    // 칸 · 행 쌓기
    const stacks = new Map(lanes.map((l) => [l.id, new Map()]));
    for (const j of rows) {
      const m = stacks.get(laneOf(j));
      if (!m) continue;
      const col = colOf(j.tick);
      (m.get(col) ?? m.set(col, []).get(col)).push(j);
    }
    const geom = [];
    let y = 0;
    for (const lane of lanes) {
      const m = stacks.get(lane.id);
      let maxRows = 0; let count = 0;
      for (const items of m.values()) { items.sort((a, b) => a.tick - b.tick || a.unit.order - b.unit.order); maxRows = Math.max(maxRows, Math.ceil(items.length / perRow)); count += items.length; }
      const h = Math.max(LANE_MIN, LANE_PAD * 2 + maxRows * STEP);
      geom.push({ ...lane, y0: y, h, count });
      y += h;
    }
    const axisY = y;
    const height = axisY + AXIS_H;
    const cutCol = cut == null ? n - 1 : colOf(cut);

    // 행 이름(HTML 열 — SVG 안에 두면 잘린다)
    ui.clear(laneCol);
    laneCol.style.height = `${height}px`;
    for (const g of geom) {
      const lab = ui.el('div', { class: ['order-lane-label', g.count ? '' : 'is-empty'], style: { top: `${g.y0}px`, height: `${g.h}px` } }, ui.el('b', {}, g.label), ui.el('span', { class: 'order-lane-count' }, fmt.num(g.count)));
      if (g.help) lab.title = g.help;
      laneCol.append(lab);
    }

    svg.replaceChildren();
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('aria-label', LABELS.mapAria(n, rows.length));
    // 행 바탕 · 밑줄
    for (const [i, g] of geom.entries()) {
      if (i % 2 === 0) svg.append(S('rect', { class: 'order-lane-band', x: 0, y: g.y0, width, height: g.h, fill: 'none' }));
      svg.append(S('line', { class: 'order-lane-line', x1: 0, x2: width, y1: g.y0 + g.h, y2: g.y0 + g.h, stroke: 'none' }));
    }
    // 여기까지 읽음 뒤 칸
    if (cutCol < n - 1) {
      const x0 = colX(cutCol + 1);
      svg.append(S('rect', { class: 'order-after', x: x0, y: 0, width: width - x0, height: axisY, fill: 'none' }));
      svg.append(S('line', { class: 'order-cutline', x1: x0, x2: x0, y1: 0, y2: axisY + 8, stroke: 'none' }));
      svg.append(S('text', { class: 'order-cuttext', x: x0 + 5, y: 12, fill: 'currentColor' }, LABELS.afterCut));
    }
    // 축 — 표시 + 가로 라벨(겹치면 건너뛴다)
    svg.append(S('line', { class: 'order-axis', x1: 0, x2: width, y1: axisY, y2: axisY, stroke: 'none' }));
    let labelRight = -Infinity;
    for (const [i, sp] of spine.entries()) {
      const cx = colX(i) + colW / 2;
      const kind = sp.unit.kind === 'main' ? 'is-main' : sp.unit.kind === 'side' ? 'is-side' : 'is-event';
      // is-after = 여기까지 읽음 뒤 자리(위치), is-unseen = 그 앞인데 안 봄으로 둔 척추 이벤트 · 사이드(속 빈 표시 — 예외가 없으면 없다)
      const unseen = i <= cutCol && !curR.seen(sp.key);
      const g = S('g', { class: `order-col ${kind} ${i > cutCol ? 'is-after' : ''} ${unseen ? 'is-unseen' : ''} ${i === cutCol && cut != null ? 'is-cut' : ''}`, transform: `translate(${cx},${axisY})`, tabindex: 0, role: 'button', 'aria-label': `${sp.unit.title} — ${LABELS.axisGo}` });
      g.append(S('rect', { class: 'order-col-hit', x: -colW / 2, y: 0, width: colW, height: AXIS_H, fill: 'transparent' }));
      if (kind === 'is-main') g.append(S('line', { class: 'order-tick', y1: 0, y2: 7, stroke: 'none' }));
      else if (kind === 'is-side') g.append(S('rect', { class: 'order-glyph', x: -3.5, y: 3, width: 7, height: 7, fill: 'none' }));
      else g.append(S('rect', { class: 'order-glyph', x: -3.5, y: 3, width: 7, height: 7, fill: 'none', transform: 'rotate(45 0 6.5)' }));
      if (kind === 'is-main' && cx - AXIS_LABEL_W / 2 >= labelRight + 2) {
        g.append(S('text', { class: 'order-col-label', y: 24, 'text-anchor': 'middle', fill: 'currentColor' }, fmt.tickShort(sp.tick)));
        labelRight = cx + AXIS_LABEL_W / 2;
      }
      ui.tooltip(g, () => ui.el('div', { class: 'order-tip' }, ui.el('div', { class: 'order-tip-title' }, sp.unit.title), ui.el('div', {}, fmt.tickLabel(sp.tick), unseen ? ` · ${LABELS.unseen}` : ''), ui.el('div', { class: 'order-tip-basis' }, LABELS.axisGo)));
      const go = () => state.set({ t: sp.tick });
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      svg.append(g);
    }
    // 점
    const dots = S('g', { class: 'order-dots' });
    for (const lane of geom) {
      for (const [col, items] of stacks.get(lane.id)) {
        for (const [k, j] of items.entries()) {
          const sub = k % perRow;
          const row = Math.floor(k / perRow);
          const cx = colX(col) + colW / 2 + (sub - (Math.min(perRow, items.length - row * perRow) - 1) / 2) * STEP;
          const cy = lane.y0 + lane.h - LANE_PAD - DOT_R - row * STEP;
          const g = j.grade;
          const c = S('circle', { class: `order-dot ${j.key === selKey ? 'is-selected' : ''}`, cx, cy, r: DOT_R, 'data-key': j.key, tabindex: -1, role: 'button', 'aria-label': `${j.unit.title} · ${fmt.KIND[j.unit.kind].label} · ${gl(g)}` });
          c.style.fill = fmt.GRADE[g]?.color ?? 'var(--grade-none)';
          ui.tooltip(c, () => tooltipBody(j));
          const go = () => state.set({ sel: `unit:${j.key}` });
          c.addEventListener('click', go);
          c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          dots.append(c);
        }
      }
    }
    svg.append(dots);
    // 읽은 자리(여기까지 읽음 칸)가 가로 스크롤 밖이면 보이는 곳으로 옮긴다
    if (cut != null) {
      const x = colX(cutCol) + colW;
      if (x > mapScroll.scrollLeft + mapScroll.clientWidth || x < mapScroll.scrollLeft) mapScroll.scrollLeft = Math.max(0, x - mapScroll.clientWidth * 0.7);
    }
  };
  const tooltipBody = (j) => {
    const g = j.grade;
    return ui.el('div', { class: 'order-tip' },
      ui.el('div', { class: 'order-tip-title' }, j.unit.title),
      ui.el('div', {}, `${fmt.KIND[j.unit.kind].label} · ${fmt.tickLabel(j.tick)} · ${fmt.num(j.unit.chars)}자`),
      ui.el('div', {}, [gl(g), j.from_tick ? ` (${LABELS.riseBefore(spineLabel(j.from), gl(j.before ?? j.grade))})` : '']),
      j.reason ? ui.el('div', { class: 'order-tip-basis' }, clip(plain(j.reason), 110)) : null);
  };

  // ── 분류 카드 ──
  const preRows = (key) => {
    const R = LABELS.rows2;
    const p = pre[key];
    const lines = p ? fmt.PRE_LEVEL.filter((l) => p[l]?.length).map((l) => ui.el('div', { class: 'order-pre-line' },
      ui.el('b', { title: fmt.help('pre', l) }, `${fmt.PRE_LABEL[l]} `),
      p[l].map(([k, why], i) => [i ? ' · ' : null, ui.link(`unit:${k}`, fmt.unitTitle(k)), ui.el('span', { class: 'muted' }, ` (${fmt.PRE_WHY[why] ?? why})`)]))) : [];
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
      card.append(ui.el('div', { class: 'panel-head' }, ui.el('h3', {}, ui.chip('kind', sp.unit.kind), ' ', ui.link(`unit:${sp.key}`, sp.unit.title)), close),
        loglineBox(sp.key, rd),
        kv([[R.grade, [ui.chip('grade', sp.unit.kind === 'main' ? '메인' : '척추'), rd.seen(sp.key) || rd.t == null || sp.tick > rd.t ? null : [' ', ui.el('span', { class: 'order-unseen', title: LABELS.unseenHelp }, LABELS.unseen)]]],
          [R.release, [fmt.tickLabel(sp.tick), ' · ', ui.link(`tick:${sp.tick}`, fmt.unitTitle(sp.key))]],
          ...preRows(sp.key)]));
      return;
    }
    const g = gradeAt(j, rd);
    const gradeRow = [ui.chip('grade', g ?? j.grade)];
    if (g == null) gradeRow.push(' ', ui.el('span', { class: 'order-spoiler' }, LABELS.after(fmt.tickLabel(j.tick, { date: false }))));
    else if (g !== j.grade) gradeRow.push(' ', ui.el('span', {}, '→ ', ui.link(`unit:${j.from}`, spineLabel(j.from)), '부터 ', ui.chip('grade', j.grade)));
    else if (j.from_tick) gradeRow.push(' ', ui.el('span', { class: 'muted' }, rd.all ? LABELS.riseBefore(spineLabel(j.from), gl(j.before ?? j.grade)) : LABELS.riseSince(spineLabel(j.from))));
    const basisText = ui.el('div', { class: 'order-basis-text' });
    const basisRow = j.basis ? [recId(j.basis), j.basis_kind ? [' ', ui.chip('record', j.basis_kind)] : null, j.basis_scene ? [' ', ui.link(`scene:${j.basis_scene}`, fmt.ref(j.basis_scene))] : null, basisText] : null;
    const histBox = ui.el('div', { class: 'order-history' }, j.trail ? j.trail.map((x, i) => [i ? ' → ' : null, ui.chip('grade', x)]) : ui.el('span', { class: 'muted' }, LABELS.trailNone));
    // 여기까지 읽음 뒤 스토리 — 목록에는 보이지만 이유 · 떡밥 · 주역 · 결말 같은 내용은 접어 가린다
    const after = g == null;
    const rest = [
      j.reason ? [R.reason, withLinks(j.reason)] : null,
      basisRow ? [R.why, basisRow] : null,
      [R.judg, [j.confidence ? ui.chip('confidence', j.confidence) : null, ' ', j.unit.layer ? ui.chip('layer', j.unit.layer) : null, j.asof ? ui.el('span', { class: 'muted' }, ` · ${LABELS.asof} ${j.asof}`) : null]],
      j.from && !j.from_tick ? [R.touch, ui.link(`unit:${j.from}`, spineLabel(j.from))] : null,
      j.threads?.length ? [R.threads, j.threads.map((t, i) => [i ? ' · ' : null, ui.link(`thread:${t}`, idx.threads.get(t)?.title ?? t)])] : null,
      j.origin_of?.length || j.lead_facts ? [R.lead, [j.origin_of?.length ? [ui.el('b', {}, `${R.origins}: `), j.origin_of.map((p, i) => [i ? ' · ' : null, ui.link(`person:${p}`, fmt.targetName(p))]), ' '] : null, j.lead_facts ? ui.el('span', { class: 'muted' }, plain(j.lead_facts)) : null]] : null,
      j.closures ? [R.endings, withLinks(j.closures)] : null,
      [R.history, histBox],
    ];
    card.append(
      ui.el('div', { class: 'panel-head' }, ui.el('h3', {}, ui.chip('kind', j.unit.kind), ' ', ui.link(`unit:${j.key}`, j.unit.title), ui.el('span', { class: 'muted order-card-sub' }, ` · ${fmt.tickLabel(j.tick)} · ${fmt.num(j.unit.chars)}자 · ${fmt.num(j.unit.scenes)}${LABELS.scene}`)), close),
      loglineBox(j.key, rd),
      kv([[rd.all || after ? R.grade : TERM.gradeAt, gradeRow], ...preRows(j.key), ...(after ? [] : rest)]),
      after ? ui.details(LABELS.spoiler, kv(rest), { class: 'order-spoiler-rows' }) : null);
    // 관련 메모 문장 · 검토 기록은 따로 받는다(처음 한 번)
    detail().then((d) => {
      if (card.dataset.key !== key) return;
      const x = d.units?.[key];
      if (!x) return;
      if (x.basis_text) basisText.textContent = x.basis_text;
      if (x.reviews?.length) {
        const items = x.reviews.map((r) => ui.el('li', {}, ui.el('span', { class: 'mono' }, `${r.session} ${r.date}`), ` ${r.decision}`,
          r.note != null ? ui.el('span', { class: 'muted' }, ` — ${plain(d.notes?.[r.note] ?? '')}`) : null,
          r.before ? ui.el('div', { class: 'order-review-before muted' }, LABELS.before, ...withLinks(r.before)) : null));
        histBox.append(ui.details(LABELS.reviews(x.reviews.length), ui.el('ul', { class: 'order-reviews' }, items)));
      }
    }).catch(() => { /* 검토 기록을 못 받아도 카드는 쓴다 */ });
  };

  // ── 상태 ──
  apply(state.get());
  renderCard(state.get());
  const off = state.subscribe((s, changed) => {
    if (changed.has('t') || changed.has('layers') || changed.has('p')) { apply(s); renderCard(s); }
    else if (changed.has('sel')) {
      const sel = state.parseSel(s.sel);
      const key = sel?.type === 'unit' ? sel.id : null;
      markSelected(key);
      for (const c of svg.querySelectorAll('.order-dot')) c.classList.toggle('is-selected', c.dataset.key === key);
      renderCard(s);
    }
  });
  let resizeTimer = null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    if (mapView.hidden || !mapScroll.clientWidth) return;
    const colW = Math.max(COL_MIN, Math.floor((mapScroll.clientWidth - 8) / spine.length));
    if (colW === lastColW) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawMap(state.get()), 120);
  }) : null;
  ro?.observe(mapScroll);
  detail().catch(() => {}); // 분류 카드를 열기 전에 받아 둔다
  return () => { off(); ro?.disconnect(); clearTimeout(findTimer); clearTimeout(resizeTimer); };
}
