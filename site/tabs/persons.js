/**
 * 탭 4 인물(W5) — 화면 5 "인물별 집계"(docs/views.md 5절, 시안 표 data/views/persons/ — X3d).
 * 첫 쓸모: 인물 하나(기본 라피)의 "언제 나왔고, 누구와 같이 나왔고, 어떻게 바뀌었고, 무엇이 아직 풀리지 않았나".
 * 화면: 왼쪽 인물 목록(찾기 · 갈래 · 주역 · 정렬) + 오른쪽 상세(머리 · 여섯 접는 칸). 도구줄의 [전체 표]는 인물 386을 한 표로(머리글로 정렬).
 *
 * 쓰는 JSON
 *   persons.json          인물 386 — 전체 기준 집계 + 갈래(kind) · common(자주 나오는 인물) · owner(주역) · same_as · aliases · first_how
 *   persons-detail.json   인물마다 { units[](히트맵: 스토리 · 씬 · 줄 · 말한 줄), records[](확정 기록 ID), changes[](변화 타임라인: 작중 순서 seq · 측면 · 처음 모습/바뀜 · 상대 · 출시순과 반대) }
 *   persons-pairs.json    함께 나온 쌍 7,174 — by[] = [출시 시점, 범위(층), 같이 나온 장면, 대화한 장면, 스토리](처음 열 때 받는다)
 *   공용(idx)             units(읽는 순서 · 출시 시점 · 범위) · ticks · targets · threads · records(6MB — 열 때 받아 오면 기록 칸이 채워진다)
 *   기록 문장 · 전 → 후 · 계기는 records*.json의 것을 쓴다(persons*.json에는 문장이 없다). 원문 본문은 어디에도 없다.
 *
 * URL 파라미터(p.*)
 *   who    고른 인물(person:라피). 없으면 리더에서 연 인물 → 라피 → 목록 첫 인물. 리더에서 인물을 누르면 따라온다
 *   view   table이면 전체 표, 없으면 인물별
 *   find   인물 · 다른 이름 찾기      kind  갈래(니케 · 인물 · 랩쳐)      lead  1이면 주역만      sort  목록 정렬(scenes 기본 · speak · open · changes · first · name)
 *   net    함께 나온 인물 보기(list 기본 | graph 관계도)      common  1이면 자주 나오는 인물(지휘관 · 라피 · 아니스 · 네온)도 포함
 *   us     나온 스토리 칸의 정렬(없으면 감상 순서 | speak 많이 말한 순)
 *   fq     사실 · 의문 칸의 탭(q 의문 기본 | f 사실 | k 밝혀진 순간 | e 복선)      chg  release면 변화를 출시순으로(없으면 작중 순서)
 *   접힌 칸은 URL이 아니라 localStorage(nikke-story.persons.fold)에 남긴다 — 처음에는 결말 · 떡밥만 접혀 있다(건수는 접어도 보인다).
 *
 * 그리는 규칙
 *   여기까지 읽음과 범위(layers)는 모든 숫자 · 목록 · 그림에 걸린다 — 안 본 스토리(R.seen — 메인 위치 t + 척추 이벤트 · 사이드 '봤음' 예외 x)의 등장 · 변화와
 *     모르는 기록(R.known — 사실 · 의문은 know_units 중 하나라도 봤으면 앎)은 빼고 센다(persons-detail.json에서 다시 센다). 쌍은 by[]의 칸마다(척추 이벤트 · 사이드 칸은 그 키로) 본다.
 *     자리(tick)는 히트맵의 '아직 안 읽은 부분' 빗금(t 뒤) 같은 위치에만 쓴다 — t 앞이어도 안 봤다고 체크한 스토리 칸은 빗금 칸으로 그린다.
 *   뺀 개수는 도구줄 아래 한 줄에 "스포일러로 가린 …"으로 모으고 [전부 보기]를 단다(범위 밖은 따로). 아직 나오지 않은 인물은 목록에서 빠지고, 주소로 들어오면 안내만 보인다.
 *   같은 인물(정체 연결)은 밝혀지는 자리를 따로 갖고 있지 않아 컷오프로 거를 수 없다 — 읽는 중(t 켬)에는 "스포일러" 접이로 감춘다.
 *   등장 칸 = 히트맵(흐름) 아래에 나온 스토리 제목 목록: 종류(메인 · 이벤트 · 호감도 …)마다 묶고, 앞 점 색 = 말한 줄 수(히트맵과 같은 구간), 회색 = 이름만.
 *     종류마다 많으면(메인 36 · 그 밖 20 초과) 앞 24 · 12개만 보이고 [더 보기]로 그 종류를 다 편다. 정렬은 감상 순서 또는 많이 말한 순.
 *   히트맵: 가로 = 읽는 순서(출시순) 481칸을 폭에 맞춰 줄여 그린다, 줄 = 스토리 종류, 칸 색 = 말한 줄 수(파랑 한 색 5단계, 절대 구간 — 인물끼리 견줄 수 있다),
 *     회색 = 이름만 나온 스토리, 빗금 = 아직 안 읽은 부분. 칸에 올리면 스토리 · 줄 수, 누르면 리더.
 *   함께 나온 인물: 같이 나온 장면(막대 전체)과 그중 대화한 장면(진한 부분). 자주 나오는 인물은 기본으로 뺀다(토글에 숨긴 수).
 *     관계도는 가운데가 고른 인물, 가장자리가 같이 나온 상위 N명(좁으면 10), 선 굵기 · 점 크기 = 같이 나온 장면, 가는 곡선 = 상대끼리 같이 나온 장면(3장면 이상, 가장 센 것의 1/4 이상),
 *     같이 나온 상대끼리 이웃하게 둘러 세운다. 같은 인물 쌍은 뺀다. 상대를 누르면 그 인물로 옮긴다.
 *   변화: 줄 = 측면(성격 · 관계 · 소속 · 신체 · 신념 · 기억), 가로 = 작중 순서(또는 출시순)의 차례 — 간격은 시간이 아니라 차례다. ● 바뀜 · ○ 처음 모습 · 노란 테두리 = 출시순과 반대
 *     (먼저 공개된 변화보다 작중으로 앞) · 깃발 = 결말(그 변화에서 이야기가 끝난다). 시점을 못 정한 변화는 맨 뒤에 점선 뒤로 모은다. 띠 = 같은 스토리, 아래 글자 = 공개된 챕터.
 *     목록은 같은 차례, 점과 줄이 서로 강조된다. 전 → 후 · 계기 씬 · 근거(기록 ID 씬 줄).
 *   사실 · 의문 · 떡밥 · 결말은 확정 기록만(후보 · 기각은 export가 싣지 않는다). 의문은 미해결을 맨 위에 묶는다. 기록 ID는 근거 표시에서만 작게.
 *   함께 나온 인물의 막대 · 숫자는 쌍 집계라 씬 목록으로는 내려가지 않는다(툴팁에 장면 · 대화 · 스토리 수).
 */
export const meta = { id: 'persons', title: '인물', blurb: '인물별 등장 · 함께 나온 인물 · 변화 · 결말' };

const NS = 'http://www.w3.org/2000/svg';
/** 화면 말 중 fmt에 아직 없는 것 — 한 곳에 모아 둔다 */
const LABELS = {
  loading: '인물 불러오는 중…',
  recordsLoading: '기록 불러오는 중…',
  view: { person: '인물별', table: '전체 표' },
  find: '인물 · 다른 이름 찾기',
  all: '전체',
  leadOnly: '주역만',
  leadHelp: '떡밥의 중심이 되는 인물만',
  sort: { scenes: '등장 씬', speak: '말한 줄', open: '미해결 의문', changes: '바뀜', first: '처음 등장', name: '이름' },
  sortLabel: '정렬',
  pick: '인물 고르기',
  people: (n) => `${n}명`,
  none: '찾는 인물이 없다 — 찾기를 비우거나 갈래를 전체로 바꾼다.',
  noneCut: '아직 나온 인물이 없다 — 여기까지 읽음을 올리거나 전부 보기를 켠다.',
  hiddenPerson: '인물',
  hiddenRec: '분석 메모',
  trigger: '계기',
  axisNote: '아래 글자 = 변화가 공개된 챕터',
  hiddenOut: '범위 밖',
  notYet: '아직 나오지 않은 인물이다.',
  notYetHelp: '여기까지 읽음을 올리거나 전부 보기를 켜면 볼 수 있다.',
  alias: '다른 이름',
  same: '같은 인물',
  openDict: '사전에서 보기',
  stat: { scenes: '등장 씬', speak: '말한 줄', recs: '분석 메모', threads: '떡밥', changes: '바뀜' },
  first: '처음 등장',
  last: '마지막 등장',
  firstHow: { '이름표로 말함': '직접 말함', 이름: '이름만 나옴', '다른 이름': '다른 이름으로', '암시 언급': '숨은 등장' },
  sec: { heat: '등장', partners: '함께 나온 인물', changes: '변화', closure: '결말', records: '사실 · 의문', threads: '떡밥' },
  units: (n) => `${n}스토리`,
  heatHint: '가로 = 감상 순서 · 칸 · 점 색 = 말한 줄 수 · 칸이나 제목을 누르면 스토리를 연다',
  heatBuckets: ['1–4줄', '5–19', '20–59', '60–179', '180줄 이상'],
  nameOnly: '이름만 나옴',
  unread: '아직 안 읽은 부분',
  us: { order: '감상 순서', speak: '많이 말한 순' },
  usSpoke: (n) => `말함 ${n}`,
  usFold: '접기',
  noAppear: '여기까지 읽은 곳에는 등장이 없다.',
  net: { list: '목록', graph: '관계도' },
  commonIncl: '자주 나오는 인물 포함',
  commonHelp: '지휘관 · 라피 · 아니스 · 네온은 어디에나 나와서 기본으로 뺀다',
  withNone: '여기까지 읽은 곳에서 함께 나온 인물이 없다.',
  talkPart: '그중 대화한 장면',
  more: (n) => `더 보기 (${n})`,
  fq: { q: '의문', f: '사실', k: '밝혀진 순간', e: '복선' },
  fqEmpty: { q: '의문이 없다.', f: '사실 기록이 없다.', k: '밝혀지거나 회수된 순간이 없다.', e: '복선 기록이 없다.' },
  chg: { story: '작중 순서', release: '출시순' },
  chgOrder: '순서',
  chgEmpty: '여기까지 읽은 곳에는 변화 기록이 없다.',
  chgLegend: { change: '바뀜', base: '처음 모습', inv: '출시순과 반대', end: '결말' },
  unplaced: '시점을 못 정한 변화',
  closureEmpty: '여기까지 읽은 곳에는 이 인물의 결말이 없다.',
  togetherEnd: '함께 맺음',
  built: (n) => `쌓인 변화 ${n}`,
  threadsEmpty: '이 인물과 이어진 떡밥이 없다.',
  threadStat: { q: '의문', f: '사실', e: '복선' },
  needRecords: '기록을 받는 중이다.',
  recordsFail: '기록을 받지 못했다 — 새로고침하면 다시 시도한다.',
};
const ASPECTS = ['성격', '관계', '소속', '신체', '신념', '기억'];
const BUCKETS = [1, 5, 20, 60, 180];
const FOLD_KEY = 'nikke-story.persons.fold';
/** 처음엔 접어 두는 칸 — 건수만 보이고 눌러서 연다 */
const CLOSED_BY_DEFAULT = ['closure', 'threads'];
const PAGE = 12;

const sv = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v);
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
};
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 기억 못 해도 동작한다 */ } };
const clip = (s, n) => (typeof s === 'string' && [...s].length > n ? `${[...s].slice(0, n).join('')}…` : s ?? '');
const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);
const bucketOf = (n) => BUCKETS.reduce((b, lo, i) => (n >= lo ? i + 1 : b), 0);
const cmpKo = (a, b) => String(a).localeCompare(String(b), 'ko');

/**
 * 쌍의 by[](= [출시 시점, 범위, 같이 나온 장면, 대화한 장면, 스토리(, 척추 이벤트 · 사이드 키)])를 여기까지 읽음 · 범위 layers로 더한다.
 * T: state.reading()의 R(키가 있는 칸은 R.seen(키), 없는 칸은 자리 ≤ R.t) · 숫자(자리 ≤ T) · null(끔)
 */
export function pairTotals(by, T, layers) {
  let scenes = 0; let talk = 0; let units = 0;
  const R = T != null && typeof T === 'object' ? (T.all ? null : T) : null;
  const t = R ? R.t : typeof T === 'object' ? null : T;
  for (const [tick, layer, sc, tk, un, ex] of by) {
    if (R && ex) { if (!R.seen(ex)) continue; } else if (t != null && tick > t) { if (!R) break; continue; }
    if (layer && !layers.includes(layer)) continue;
    scenes += sc; talk += tk; units += un;
  }
  return { scenes, talk, units };
}
/** 말한 줄 수의 히트맵 단계(0 = 말한 줄 없음) */
export { bucketOf };

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const el = ui.el;
  const TERM = fmt.TERM ?? {};
  const T_UNIT = TERM.unit ?? '스토리';
  const T_COMMON = TERM.commonTargets ?? '자주 나오는 인물';
  const T_TOGETHER = TERM.togetherScenes ?? '같이 나온 장면';
  const T_TALK = TERM.talkScenes ?? '대화한 장면';
  const T_LEAD = TERM.lead ?? '주역';
  const T_INV = TERM.inverted ?? '출시순과 반대';
  const OPEN = fmt.STATE?.열림?.label ?? '미해결';

  root.append(el('div', { class: 'tab-head' }, el('h2', {}, meta.title)));
  const loading = ui.spinner(LABELS.loading);
  root.append(loading);
  let persons;
  let detailArr;
  try {
    [persons, detailArr] = await Promise.all([data.load('persons'), data.load('persons-detail')]);
  } catch (err) {
    loading.replaceWith(ui.notice(err.message, 'error'));
    return () => {};
  }
  loading.remove();

  const P = new Map(persons.map((p) => [p.id, p]));
  const D = new Map(detailArr.map((d) => [d.id, d]));
  const hay = new Map(persons.map((p) => [p.id, [p.name, ...(p.aliases ?? []), ...(p.same_as ?? []).map(fmt.targetName)].join(' ').toLowerCase()]));
  const kinds = [...new Set(persons.map((p) => p.kind).filter(Boolean))].sort((a, b) => (b === '니케') - (a === '니케') || cmpKo(a, b));
  const maxOrder = idx.unitList.reduce((m, u) => Math.max(m, u.order ?? 0), 0);

  // ── 컷오프 · 범위 ──
  let V = { T: null, layers: [1, 2, 3], R: state.reading() }; // T는 자리(빗금 · 안내)에만, 가리기는 R(스토리마다)로
  const hideMemo = new Map();
  /** 스토리가 가려지는 이유: 'cut'(여기까지 읽음 뒤) · 'layer'(범위 밖) · null */
  const hideWhy = (unitKey) => {
    if (hideMemo.has(unitKey)) return hideMemo.get(unitKey);
    const u = idx.units.get(unitKey);
    const why = !u ? null : !V.R.seen(unitKey) ? 'cut' : u.layer != null && !V.layers.includes(u.layer) ? 'layer' : null;
    hideMemo.set(unitKey, why);
    return why;
  };
  const recWhy = (r) => (!V.R.known(r) ? 'cut' : hideWhy(r.unit) === 'layer' ? 'layer' : null);

  // ── 기록 · 쌍(처음 필요할 때) ──
  const recs = () => (idx.hasRecords ? idx.records : null);
  let pairsP = null;
  let pmCache = null;
  const pairsIndex = () => {
    pairsP ??= data.load('persons-pairs').then((arr) => {
      const partnersOf = new Map();
      const pairMap = new Map();
      for (const pr of arr) {
        pairMap.set(`${pr.a}\t${pr.b}`, pr);
        push(partnersOf, pr.a, { o: pr.b, pair: pr });
        push(partnersOf, pr.b, { o: pr.a, pair: pr });
      }
      pmCache = { partnersOf, pairMap };
      return pmCache;
    });
    pairsP.catch(() => { pairsP = null; });
    return pairsP;
  };
  const pairOf = (pm, x, y) => pm.pairMap.get(x < y ? `${x}\t${y}` : `${y}\t${x}`);
  const pairStat = (pr) => pairTotals(pr.by, V.R, V.layers);

  // ── 인물마다 지금 기준 집계 ──
  let agg = new Map();
  let defaultWho = 'person:라피';
  const recompute = () => {
    const s = state.get();
    V = { T: s.t, layers: s.layers, R: state.reading(s) };
    hideMemo.clear();
    agg = new Map();
    const R = recs();
    for (const p of persons) {
      const d = D.get(p.id);
      const a = { scenes: 0, lines: 0, speak: 0, units: 0, cut: 0, out: 0, firstUnit: null, firstOrder: Infinity, lastUnit: null, lastOrder: 0,
        changes: 0, baselines: 0, chCut: 0, recs: null, open: null, threadN: null, recCut: 0, hasData: Boolean(d) };
      if (d) {
        for (const e of d.units) {
          const why = hideWhy(e.unit);
          if (why === 'cut') { a.cut++; continue; }
          if (why === 'layer') { a.out++; continue; }
          a.scenes += e.scenes; a.lines += e.lines; a.speak += e.speaker ?? 0; a.units++;
          const o = idx.units.get(e.unit)?.order ?? 0;
          if (o < a.firstOrder) { a.firstOrder = o; a.firstUnit = e.unit; }
          if (o >= a.lastOrder) { a.lastOrder = o; a.lastUnit = e.unit; }
        }
        for (const c of d.changes) {
          const why = hideWhy(c.unit);
          if (why === 'cut') a.chCut++;
          else if (!why) (c.act === '변화' ? a.changes++ : a.baselines++);
        }
        if (R) {
          a.recs = 0; a.open = 0;
          const threads = new Set();
          for (const id of d.records) {
            const r = R.get(id);
            if (!r) continue;
            const why = recWhy(r);
            if (why === 'cut') { a.recCut++; continue; }
            if (why) continue;
            a.recs++;
            if (r.kind === 'Q' && fmt.stateAt(r, V.R) === '열림') a.open++;
            for (const j of r.threads ?? []) threads.add(j);
          }
          a.threadN = threads.size;
        }
      }
      a.visible = a.scenes > 0 || (a.recs ?? 0) > 0 || a.changes + a.baselines > 0;
      agg.set(p.id, a);
    }
    const lappy = agg.get('person:라피');
    defaultWho = lappy?.visible ? 'person:라피' : [...persons].filter((p) => agg.get(p.id).visible).sort((x, y) => agg.get(y.id).scenes - agg.get(x.id).scenes)[0]?.id ?? 'person:라피';
  };

  // ── 골라 쓰는 상태 ──
  const prm = (k) => state.param('persons', k);
  const whoId = () => {
    const w = prm('who');
    if (w && P.has(w)) return w;
    const sel = state.parseSel(state.get().sel);
    if (sel?.type === 'person' && P.has(sel.id)) return sel.id;
    return defaultWho;
  };
  const selectPerson = (id, { replace = false } = {}) => {
    const patch = { p: { who: id } };
    if (state.parseSel(state.get().sel)?.type === 'person') patch.sel = `person:${id}`;
    if (prm('view') === 'table') patch.p.view = null;
    state.set(patch, { replace });
  };
  const personLink = (id, label) => el('a', {
    href: `#tab=persons&p.who=${id}`, class: 'link pm-plink', title: P.get(id) ? `${label ?? P.get(id).name} — 이 탭에서 보기` : null,
    onClick: (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); if (P.has(id)) selectPerson(id); else state.set({ sel: `person:${id}` }); },
  }, label ?? fmt.targetName(id));
  const unitLink = (key, label) => ui.link(`unit:${key}`, label ?? fmt.unitTitle(key));
  const atLabel = (tick) => `${fmt.tickShort(tick)} 시점`;

  // ── 도구줄 ──
  const modeSeg = ui.segmented({ label: '보기', options: [{ value: 'person', label: LABELS.view.person }, { value: 'table', label: LABELS.view.table }], value: prm('view') === 'table' ? 'table' : 'person', onChange: (v) => state.setParam('persons', 'view', v === 'table' ? 'table' : null, { replace: false }) });
  const find = el('input', { type: 'search', class: 'pm-find', placeholder: LABELS.find, 'aria-label': LABELS.find, value: prm('find') ?? '' });
  let findTimer = null;
  find.addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => state.setParam('persons', 'find', find.value.trim() || null), 180); });
  const kindSeg = ui.segmented({ label: '갈래', options: [{ value: 'all', label: LABELS.all }, ...kinds.map((k) => ({ value: k, label: k }))], value: prm('kind') ?? 'all', onChange: (v) => state.setParam('persons', 'kind', v === 'all' ? null : v) });
  const leadToggle = ui.toggle({ label: LABELS.leadOnly, checked: prm('lead') === '1', title: LABELS.leadHelp, onChange: (v) => state.setParam('persons', 'lead', v ? '1' : null) });
  const bar = el('div', { class: 'toolbar pm-bar' }, modeSeg.el, find, kindSeg.el, leadToggle);
  const note = el('div', { class: 'pm-note', role: 'status', 'aria-live': 'polite' });
  root.append(bar, note);

  // ── 목록 · 표 ──
  const sortSel = el('select', { class: 'pm-select', 'aria-label': LABELS.sortLabel, onChange: () => state.setParam('persons', 'sort', sortSel.value === 'scenes' ? null : sortSel.value) },
    Object.entries(LABELS.sort).map(([v, l]) => el('option', { value: v }, `${LABELS.sortLabel}: ${l}`)));
  const listCount = el('span', { class: 'pm-listcount muted' });
  const listEl = el('div', { class: 'pm-list', role: 'listbox', tabindex: 0, 'aria-label': meta.title });
  const pickBtn = el('button', { type: 'button', class: 'btn pm-pick', 'aria-expanded': 'false', onClick: () => { const open = listBox.classList.toggle('is-open'); pickBtn.setAttribute('aria-expanded', String(open)); } });
  const listBox = el('aside', { class: 'pm-listbox', 'aria-label': LABELS.pick }, pickBtn, el('div', { class: 'pm-listpanel' }, el('div', { class: 'pm-listhead' }, sortSel, listCount), listEl));
  const detail = el('section', { class: 'pm-detail', 'aria-label': '인물 상세' });
  const body = el('div', { class: 'pm-body' }, listBox, detail);

  const tblCols = [
    { key: 'name', label: meta.title, render: (r) => [personLink(r.id, r.name), r.p.common ? [' ', ui.chip('plain', T_COMMON, '자주')] : null], sort: (a, b) => cmpKo(a.name, b.name) },
    { key: 'kind', label: '갈래', render: (r) => r.kind ?? '', sort: (a, b) => cmpKo(a.kind ?? '', b.kind ?? '') },
    { key: 'scenes', label: LABELS.stat.scenes, num: true, render: (r) => fmt.num(r.scenes) },
    { key: 'speak', label: LABELS.stat.speak, num: true, render: (r) => fmt.num(r.speak) },
    { key: 'units', label: T_UNIT, num: true, render: (r) => fmt.num(r.units) },
    { key: 'recs', label: TERM.note ?? LABELS.stat.recs, num: true, render: (r) => (r.recs == null ? '…' : fmt.num(r.recs)) },
    { key: 'open', label: `${OPEN} 의문`, num: true, render: (r) => (r.open == null ? '…' : r.open || '') },
    { key: 'threads', label: LABELS.stat.threads, num: true, render: (r) => (r.threads == null ? '…' : r.threads || '') },
    { key: 'changes', label: LABELS.stat.changes, num: true, render: (r) => r.changes || '' },
    { key: 'firstOrder', label: LABELS.first, nowrap: true, render: (r) => {
      const u = r.firstUnit ? idx.units.get(r.firstUnit) : null;
      return u ? [unitLink(u.key, u.title), u.kind === 'main' ? null : el('span', { class: 'muted' }, ` · ${atLabel(u.tick)}`)] : '';
    }, sort: (a, b) => a.firstOrder - b.firstOrder },
  ];
  const tbl = ui.table({ rowKey: 'id', pageSize: 60, columns: tblCols, onRow: (r) => selectPerson(r.id), empty: LABELS.none });
  const tableBox = el('div', { class: 'pm-tablebox' }, tbl.el);
  tbl.sortBy('scenes'); tbl.sortBy('scenes'); // 등장 씬 많은 순
  const wrap = el('div', { class: 'pm-wrap' }, body, tableBox);
  root.append(wrap);

  let rowsNow = [];
  let hiddenPersons = 0;
  const buildRows = () => {
    const find_ = (prm('find') ?? '').trim().toLowerCase();
    const kind = prm('kind') ?? 'all';
    const lead = prm('lead') === '1';
    const sort = Object.hasOwn(LABELS.sort, prm('sort')) ? prm('sort') : 'scenes';
    hiddenPersons = 0;
    const rows = [];
    for (const p of persons) {
      const a = agg.get(p.id);
      if (!a.visible) { if (a.hasData && (a.cut || a.recCut || a.chCut)) hiddenPersons++; continue; }
      if (kind !== 'all' && p.kind !== kind) continue;
      if (lead && !p.owner) continue;
      if (find_ && !hay.get(p.id).includes(find_)) continue;
      rows.push({ id: p.id, p, a, name: p.name, kind: p.kind, scenes: a.scenes, speak: a.speak, units: a.units, recs: a.recs, open: a.open, threads: a.threadN, changes: a.changes, firstOrder: a.firstOrder, firstUnit: a.firstUnit });
    }
    const keyOf = { scenes: (r) => -r.scenes, speak: (r) => -r.speak, open: (r) => -(r.open ?? 0), changes: (r) => -r.changes, first: (r) => r.firstOrder, name: () => 0 };
    const k = keyOf[sort];
    rows.sort((x, y) => k(x) - k(y) || (sort === 'name' ? cmpKo(x.name, y.name) : y.scenes - x.scenes || cmpKo(x.name, y.name)));
    rowsNow = rows;
    return sort;
  };
  const metricOf = (r, sort) => {
    switch (sort) {
      case 'speak': return fmt.num(r.speak);
      case 'open': return r.open == null ? '…' : r.open || '–';
      case 'changes': return r.changes || '–';
      case 'first': return r.firstUnit ? fmt.tickShort(idx.units.get(r.firstUnit)?.tick) : '–';
      default: return fmt.num(r.scenes);
    }
  };
  const renderList = (sort) => {
    sortSel.value = sort;
    const top = listEl.scrollTop;
    const who = whoId();
    const frag = document.createDocumentFragment();
    for (const [i, r] of rowsNow.entries()) {
      frag.append(el('div', { class: ['pm-item', r.id === who ? 'is-sel' : ''], role: 'option', id: `pm-opt-${i}`, 'aria-selected': String(r.id === who), dataset: { id: r.id, i } },
        ui.portrait(fmt.iconAt(idx.targets.get(r.id), V.T), { size: 24, class: 'pm-item-pic' }) ?? el('span', { class: 'pm-item-pic' }),
        el('span', { class: 'pm-item-name' }, r.name),
        r.kind ? el('span', { class: 'pm-item-kind' }, r.kind) : null,
        el('span', { class: 'pm-item-metric' }, metricOf(r, sort))));
    }
    listEl.replaceChildren(frag);
    if (!rowsNow.length) listEl.append(el('div', { class: 'empty pm-empty' }, hiddenPersons ? LABELS.noneCut : LABELS.none));
    listEl.scrollTop = top;
    listCount.textContent = LABELS.people(fmt.num(rowsNow.length));
  };
  const markListSel = () => {
    const who = whoId();
    let cur = null;
    for (const it of listEl.children) {
      const on = it.dataset.id === who;
      it.classList.toggle('is-sel', on);
      it.setAttribute('aria-selected', String(on));
      if (on) cur = it;
    }
    if (cur) listEl.setAttribute('aria-activedescendant', cur.id || '');
    return cur;
  };
  const scrollSelIntoView = () => {
    const cur = listEl.querySelector('.is-sel');
    if (!cur) return;
    const top = cur.offsetTop; const bot = top + cur.offsetHeight;
    if (top < listEl.scrollTop) listEl.scrollTop = top - 4;
    else if (bot > listEl.scrollTop + listEl.clientHeight) listEl.scrollTop = bot - listEl.clientHeight + 4;
  };
  listEl.addEventListener('click', (e) => {
    const it = e.target.closest('.pm-item');
    if (!it) return;
    selectPerson(it.dataset.id);
    listBox.classList.remove('is-open');
    pickBtn.setAttribute('aria-expanded', 'false');
  });
  listEl.addEventListener('keydown', (e) => {
    const keys = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 };
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    if (!rowsNow.length) return;
    const i = rowsNow.findIndex((r) => r.id === whoId());
    const j = e.key === 'Home' || (i < 0 && keys[e.key] > 0) ? 0 : e.key === 'End' || i < 0 ? rowsNow.length - 1 : Math.max(0, Math.min(rowsNow.length - 1, i + keys[e.key]));
    selectPerson(rowsNow[j].id, { replace: true });
  });

  // ── 숨김 안내 한 줄 ──
  const renderNote = () => {
    ui.clear(note);
    const parts = [];
    const view = prm('view') === 'table' ? 'table' : 'person';
    const a = agg.get(whoId());
    if (!V.R.all) {
      if (hiddenPersons) parts.push(`${LABELS.hiddenPerson} ${fmt.num(hiddenPersons)}`);
      if (view === 'person' && a?.visible) {
        if (a.cut) parts.push(`${T_UNIT} ${fmt.num(a.cut)}`);
        if (a.recCut) parts.push(`${LABELS.hiddenRec} ${fmt.num(a.recCut)}`);
        if (a.chCut) parts.push(`${LABELS.sec.changes} ${fmt.num(a.chCut)}`);
      }
    }
    const out = view === 'person' && a?.visible ? a.out : 0;
    if (parts.length) note.append(ui.hiddenNote(`${TERM.spoiler ?? '스포일러'}로 가린 ${parts.join(' · ')}`, () => state.set({ t: null })));
    if (out) note.append(el('span', { class: 'muted pm-out' }, `${parts.length ? ' · ' : ''}${LABELS.hiddenOut} ${T_UNIT} ${fmt.num(out)}`));
    note.hidden = !note.childNodes.length;
  };

  // ── 상세: 접는 칸 ──
  let foldPref = {};
  try { foldPref = JSON.parse(lsGet(FOLD_KEY) ?? '{}') ?? {}; } catch { foldPref = {}; }
  const isOpen = (key) => foldPref[key] ?? !CLOSED_BY_DEFAULT.includes(key);
  const tokens = {};
  const sections = [];
  const makeSection = (key, title, render, count) => {
    const countEl = el('span', { class: 'pm-count' });
    const bodyEl = el('div', { class: 'pm-sec-body' });
    const det = ui.details(el('span', { class: 'pm-sec-sum' }, el('span', { class: 'pm-sec-title' }, title), countEl), bodyEl, { open: isOpen(key), class: `pm-sec pm-sec-${key}` });
    const sec = { key, det, body: bodyEl, countEl, render, count, dirty: true };
    det.addEventListener('toggle', () => {
      foldPref[key] = det.open;
      lsSet(FOLD_KEY, JSON.stringify(foldPref));
      if (det.open && sec.dirty) paintSection(sec);
    });
    sections.push(sec);
    return sec;
  };
  const paintSection = (sec) => {
    const p = P.get(whoId());
    const a = agg.get(p.id);
    if (sec.count) sec.countEl.textContent = sec.count(p, a) ?? '';
    if (!sec.det.open) { sec.dirty = true; return; }
    sec.dirty = false;
    tokens[sec.key] = (tokens[sec.key] ?? 0) + 1;
    const out = sec.render(p, a, sec, tokens[sec.key]);
    if (out?.then) out.then(markSel); else markSel();
  };
  const stale = (sec, tk) => tokens[sec.key] !== tk;
  const showMore = (n, onClick) => el('button', { type: 'button', class: 'btn pm-more', onClick }, LABELS.more(fmt.num(n)));

  // 호버 말풍선(히트맵용) — 한 개를 돌려 쓴다
  const tipEl = el('div', { class: 'tooltip pm-tip', role: 'tooltip' });
  tipEl.hidden = true;
  document.body.append(tipEl);
  const showTip = (x, y, nodes) => {
    tipEl.replaceChildren(...nodes);
    tipEl.hidden = false;
    const w = tipEl.offsetWidth; const h = tipEl.offsetHeight;
    tipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2))}px`;
    tipEl.style.top = `${y + 18 + h > window.innerHeight ? y - h - 12 : y + 18}px`;
  };
  const hideTip = () => { tipEl.hidden = true; };

  // ── 상세 머리 ──
  const head = el('div', { class: 'pm-head' });
  const recById = (id) => recs()?.get(id) ?? null;
  let recsError = false;
  let disposed = false;
  const recsPending = () => (recsError ? ui.notice(LABELS.recordsFail, 'warn') : ui.spinner(LABELS.recordsLoading));
  const renderHead = () => {
    ui.clear(head);
    const p = P.get(whoId());
    const a = agg.get(p.id);
    const u = (k) => idx.units.get(k);
    const stat = (label, value, tone) => el('div', { class: ['pm-stat', tone ? `is-${tone}` : ''] }, el('div', { class: 'pm-stat-v' }, value), el('div', { class: 'pm-stat-l' }, label));
    const chips = [p.kind ? ui.chip('plain', p.kind) : null, p.common ? ui.chip('plain', T_COMMON, T_COMMON) : null, p.owner ? ui.chip('plain', T_LEAD, T_LEAD) : null];
    chips[1]?.setAttribute('title', LABELS.commonHelp);
    chips[2]?.setAttribute('title', LABELS.leadHelp);
    head.append(el('div', { class: 'pm-title' }, ui.portrait(fmt.iconAt(idx.targets.get(p.id), V.T), { size: 64, class: 'pm-title-pic' }), el('h3', {}, p.name), el('div', { class: 'chips' }, chips), el('span', { class: 'pm-title-link' }, ui.link(`person:${p.id}`, LABELS.openDict))));
    const sub = [];
    if (a.visible) {
      if (p.aliases?.length) sub.push(el('span', {}, el('span', { class: 'muted' }, `${LABELS.alias} `), p.aliases.join(' · ')));
      if (p.same_as?.length) {
        const links = p.same_as.map((s, i) => [i ? ' · ' : null, P.has(s) ? personLink(s) : ui.link(`person:${s}`, fmt.targetName(s))]);
        // 같은 인물(정체 연결)은 밝혀지는 자리를 따로 갖고 있지 않아 컷오프로 거를 수 없다 — 읽는 중이면 접어 둔다
        sub.push(V.R.all ? el('span', {}, el('span', { class: 'muted' }, `${LABELS.same} `), links)
          : ui.details(`${LABELS.same} (${TERM.spoiler ?? '스포일러'})`, links, { class: 'spoiler pm-same' }));
      }
    }
    if (sub.length) head.append(el('div', { class: 'pm-sub' }, sub.flatMap((x, i) => [i ? el('span', { class: 'pm-sep' }, '·') : null, x])));
    if (!a.visible) {
      head.append(ui.notice(`${LABELS.notYet} ${LABELS.notYetHelp}`, 'info'), el('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: null }) }, TERM.showAll ?? '전부 보기'));
      return;
    }
    head.append(el('div', { class: 'pm-stats' },
      stat(LABELS.stat.scenes, fmt.num(a.scenes)),
      stat(LABELS.stat.speak, fmt.num(a.speak)),
      stat(TERM.note ?? LABELS.stat.recs, a.recs == null ? '…' : fmt.num(a.recs)),
      stat(`${OPEN} 의문`, a.open == null ? '…' : fmt.num(a.open), a.open ? 'open' : null),
      stat(LABELS.stat.threads, a.threadN == null ? '…' : fmt.num(a.threadN)),
      stat(LABELS.stat.changes, fmt.num(a.changes))));
    const firstU = a.firstUnit ? u(a.firstUnit) : null;
    const lastU = a.lastUnit ? u(a.lastUnit) : null;
    const how = a.firstUnit && a.firstUnit === p.first_unit ? LABELS.firstHow[p.first_how] ?? p.first_how : null;
    head.append(el('div', { class: 'pm-span' },
      firstU ? el('span', {}, el('span', { class: 'muted' }, `${LABELS.first} `), unitLink(a.firstUnit), el('span', { class: 'muted' }, ` · ${atLabel(firstU.tick)}${how ? ` · ${how}` : ''}`)) : null,
      lastU && a.lastUnit !== a.firstUnit ? el('span', {}, el('span', { class: 'muted' }, `${LABELS.last} `), unitLink(a.lastUnit), el('span', { class: 'muted' }, ` · ${atLabel(lastU.tick)}`)) : null));
  };

  // ── 칸마다 쓰는 고르기(건수와 그림이 같은 것을 센다) ──
  /** 이 인물을 다룬 확정 기록 중 여기까지 읽음 · 범위 안인 것(기록이 오기 전에는 null) */
  const mineRecs = (p) => {
    const R = recs();
    if (!R) return null;
    return (D.get(p.id)?.records ?? []).map((id) => R.get(id)).filter((r) => r && !recWhy(r));
  };
  const visibleChanges = (p) => (D.get(p.id)?.changes ?? []).filter((c) => !hideWhy(c.unit));
  const partnerRows = (p, pm) => {
    const incl = prm('common') === '1';
    const all = (pm.partnersOf.get(p.id) ?? [])
      .filter(({ pair }) => !pair.same_as)
      .map(({ o, pair }) => ({ id: o, po: P.get(o), st: pairStat(pair), pair }))
      .filter((x) => x.po && x.st.scenes > 0)
      .sort((x, y) => y.st.scenes - x.st.scenes || y.st.talk - x.st.talk || cmpKo(x.po.name, y.po.name));
    return { all, list: incl ? all : all.filter((x) => !x.po.common), commons: all.filter((x) => x.po.common).length, incl };
  };
  const threadRows = (p, mine) => {
    const map = new Map();
    const slot = (j) => map.get(j) ?? map.set(j, { q: 0, open: 0, f: 0, e: 0 }).get(j);
    for (const r of mine) {
      for (const j of r.threads ?? []) {
        const s_ = slot(j);
        if (r.kind === 'Q') { s_.q++; if (fmt.stateAt(r, V.R) === '열림') s_.open++; } else if (r.kind === 'F') s_.f++; else if (r.kind === 'E') s_.e++;
      }
    }
    for (const j of idx.threadList) if ((j.about?.includes(p.id) || j.owners?.includes(p.id)) && !map.has(j.id) && !hideWhy(j.first_unit)) slot(j.id);
    const rank = { 뼈대: 0, 보강: 1, 독립: 2 };
    return [...map.entries()].map(([id, s_]) => ({ id, s: s_, j: idx.threads.get(id) })).filter((x) => x.j && !hideWhy(x.j.first_unit))
      .sort((x, y) => (rank[x.j.weight] ?? 3) - (rank[y.j.weight] ?? 3) || (y.j.owners?.includes(p.id) ? 1 : 0) - (x.j.owners?.includes(p.id) ? 1 : 0) || (y.s.q + y.s.f + y.s.e) - (x.s.q + x.s.f + x.s.e));
  };
  const recGroups = (mine) => {
    const by = { q: mine.filter((r) => r.kind === 'Q'), f: mine.filter((r) => r.kind === 'F'), k: mine.filter((r) => r.kind === 'F-k' || r.kind === 'Q-k'), e: mine.filter((r) => r.kind === 'E') };
    for (const k of Object.keys(by)) by[k].sort((x, y) => (x.order ?? 0) - (y.order ?? 0) || String(x.id).localeCompare(String(y.id), 'en', { numeric: true }));
    return by;
  };

  // ── 칸 1: 등장 — 히트맵(흐름) + 나온 스토리 제목 목록 ──
  // 목록은 종류마다 묶어 제목을 늘어놓는다. 많으면 종류마다 앞 몇 개만(정렬 기준대로) 보이고 [더 보기]로 편다.
  const usLimit = new Map();
  const usFirst = (k, n) => (n <= (k === 'main' ? 36 : 20) ? n : k === 'main' ? 24 : 12);
  const usSeg = ui.segmented({ label: '나온 스토리 정렬', options: [{ value: 'order', label: LABELS.us.order }, { value: 'speak', label: LABELS.us.speak }], value: prm('us') === 'speak' ? 'speak' : 'order', onChange: (v) => state.setParam('persons', 'us', v === 'speak' ? 'speak' : null) });
  const storyRows = (p) => (D.get(p.id)?.units ?? []).filter((e) => !hideWhy(e.unit) && idx.units.has(e.unit));
  /** 등장 칸 아래의 제목 목록 — 히트맵과 같은 등장을 종류마다 글로 늘어놓는다 */
  const storyList = (p, box) => {
    const rows = storyRows(p);
    if (!rows.length) return;
    const bySpeak = prm('us') === 'speak';
    const byKind = new Map();
    for (const e of rows) push(byKind, idx.units.get(e.unit).kind, e);
    const ord = (e) => idx.units.get(e.unit).order ?? 0;
    box.append(el('div', { class: 'toolbar pm-sectools pm-us-tools' }, usSeg.el,
      el('span', { class: 'pm-us-sum muted' }, fmt.KIND_ORDER.filter((k) => byKind.has(k)).map((k) => `${fmt.KIND[k].label} ${fmt.num(byKind.get(k).length)}`).join(' · '))));
    for (const k of [...fmt.KIND_ORDER, ...[...byKind.keys()].filter((x) => !fmt.KIND_ORDER.includes(x))]) {
      const list = byKind.get(k);
      if (!list) continue;
      list.sort(bySpeak ? (x, y) => (y.speaker ?? 0) - (x.speaker ?? 0) || y.lines - x.lines || ord(x) - ord(y) : (x, y) => ord(x) - ord(y));
      const spoke = list.filter((e) => (e.speaker ?? 0) > 0).length;
      const first = usFirst(k, list.length);
      const limit = usLimit.get(k) ?? first;
      const ul = el('ul', { class: `pm-us-list${k === 'main' ? ' is-main' : ''}` });
      for (const e of list.slice(0, limit)) {
        const u = idx.units.get(e.unit);
        const b = bucketOf(e.speaker ?? 0);
        ul.append(el('li', { class: ['pm-us-item', b ? '' : 'is-name'], dataset: { sel: `unit:${e.unit}` }, title: `${u.title} · ${atLabel(u.tick)} · ${b ? `${LABELS.stat.speak} ${fmt.num(e.speaker)}` : LABELS.nameOnly} · ${e.scenes}씬` },
          el('i', { class: `pm-sw ${b ? `pm-b${b}` : 'pm-name'}`, 'aria-hidden': 'true' }), unitLink(e.unit), b ? el('span', { class: 'pm-us-n muted' }, fmt.num(e.speaker)) : null));
      }
      const grp = el('div', { class: 'pm-us-group' },
        el('div', { class: 'pm-us-head' }, el('i', { class: 'pm-us-kind', style: { background: fmt.KIND[k]?.color ?? 'var(--ink-3)' }, 'aria-hidden': 'true' }),
          el('strong', {}, fmt.KIND[k]?.label ?? k), el('span', { class: 'muted' }, ` ${fmt.num(list.length)}${spoke < list.length ? ` · ${LABELS.usSpoke(fmt.num(spoke))}` : ''}`)), ul);
      if (list.length > limit) grp.append(showMore(list.length - limit, () => { usLimit.set(k, list.length); paintSection(secHeat); }));
      else if (limit > first) grp.append(el('button', { type: 'button', class: 'btn pm-more', onClick: () => { usLimit.delete(k); paintSection(secHeat); } }, LABELS.usFold));
      box.append(grp);
    }
  };

  const secHeat = makeSection('heat', LABELS.sec.heat, (p, a, sec) => {
    ui.clear(sec.body);
    const d = D.get(p.id);
    const present = new Map((d?.units ?? []).map((e) => [e.unit, e]));
    const W = Math.max(280, sec.body.clientWidth || 640);
    const compact = W < 520;
    const kindList = fmt.KIND_ORDER.filter((k) => idx.unitList.some((u) => u.kind === k));
    const LW = compact ? 80 : 88;
    const cw = (W - LW - 6) / maxOrder;
    const RH = compact ? 12 : 14; const GAP = 4; const TOP = 4; const AX = 22;
    const H = TOP + kindList.length * (RH + GAP) + AX;
    const rowY = (k) => TOP + kindList.indexOf(k) * (RH + GAP);
    const xOf = (order) => LW + (order - 1) * cw;
    const svg = sv('svg', { class: 'pm-heat', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${p.name} ${LABELS.sec.heat}: ${LABELS.units(a.units)}` });
    svg.append(sv('defs', {}, sv('pattern', { id: 'pm-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, sv('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'pm-hatch-line' }))));
    // 줄 이름 · 기본 칸
    for (const k of kindList) {
      svg.append(sv('text', { class: 'pm-svg-label', x: LW - 8, y: rowY(k) + RH / 2, 'text-anchor': 'end', 'dominant-baseline': 'central' }, fmt.KIND[k].label));
    }
    let bg = '';
    let skip = ''; // t 앞인데 안 봤다고 체크한 스토리 칸(빗금)
    let maxVis = 0; // 메인 위치 t까지의 마지막 읽는 자리(빗금 띠의 시작 — 자리라 tick으로)
    const cells = new Map(kindList.map((k) => [k, []]));
    for (const u of idx.unitList) {
      const why = hideWhy(u.key);
      const before = state.visible(u.tick, V.T);
      if (before) maxVis = Math.max(maxVis, u.order);
      const x = xOf(u.order); const y = rowY(u.kind);
      if (y == null || Number.isNaN(y)) continue;
      const w = Math.max(cw - 0.25, 0.9);
      if (why === 'cut') { if (before) skip += `M${x.toFixed(2)} ${y}h${w.toFixed(2)}v${RH}h${(-w).toFixed(2)}z`; continue; }
      if (why === 'layer') continue;
      bg += `M${x.toFixed(2)} ${y}h${w.toFixed(2)}v${RH}h${(-w).toFixed(2)}z`;
      if (present.has(u.key)) cells.get(u.kind)?.push({ x, w: Math.max(cw - 0.2, u.kind === 'main' ? 2.6 : 1.5), y, u, e: present.get(u.key) });
    }
    // 읽은 곳 뒤(빗금 띠를 먼저 깔고 — t 뒤라도 봤다고 체크한 스토리 칸은 그 위에 그린다)
    if (V.T != null && maxVis < maxOrder) {
      const x0 = xOf(maxVis + 1);
      svg.append(sv('rect', { class: 'pm-unread', x: x0, y: TOP - 2, width: W - 6 - x0, height: kindList.length * (RH + GAP) }));
    }
    svg.append(sv('path', { class: 'pm-heat-bg', d: bg }));
    if (skip) svg.append(sv('path', { class: 'pm-unread', d: skip }));
    if (V.T != null && maxVis < maxOrder && W - 6 - xOf(maxVis + 1) > 90) {
      const x0 = xOf(maxVis + 1);
      svg.append(sv('text', { class: 'pm-svg-note', x: (x0 + W - 6) / 2, y: TOP + (kindList.length * (RH + GAP)) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, LABELS.unread));
    }
    // 축 — 메인 챕터 10단위
    const axisY = TOP + kindList.length * (RH + GAP) + 2;
    svg.append(sv('line', { class: 'pm-axis', x1: LW, x2: W - 6, y1: axisY, y2: axisY }));
    let lastLabel = -99;
    for (const u of idx.unitList) {
      if (u.kind !== 'main') continue;
      const n = Number(u.num ?? String(u.key).replace(/^ch/, ''));
      if (!(n % 10 === 0 || u.order === 1)) continue;
      const x = xOf(u.order) + cw / 2;
      svg.append(sv('line', { class: 'pm-axis-tick', x1: x, x2: x, y1: axisY, y2: axisY + 4 }));
      if (x - lastLabel >= 38) { svg.append(sv('text', { class: 'pm-svg-label pm-axis-label', x, y: axisY + 15, 'text-anchor': 'middle' }, `CH.${String(n).padStart(2, '0')}`)); lastLabel = x; }
    }
    // 사람이 나온 칸
    const cursor = sv('rect', { class: 'pm-cursor', height: RH + 2, rx: 1 });
    cursor.style.display = 'none';
    const g = sv('g', { class: 'pm-cells' });
    for (const k of kindList) {
      for (const c of cells.get(k)) {
        const speak = c.e.speaker ?? 0;
        const b = bucketOf(speak);
        g.append(sv('rect', { class: b ? `pm-cell pm-b${b}` : 'pm-cell pm-name', x: c.x, y: c.y, width: c.w, height: RH, 'data-sel': `unit:${c.u.key}` }));
      }
    }
    svg.append(g, cursor);
    const nearest = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W; const py = ((ev.clientY - r.top) / r.height) * H;
      const row = kindList[Math.floor((py - TOP) / (RH + GAP))];
      if (!row || py - TOP - kindList.indexOf(row) * (RH + GAP) > RH + GAP / 2) return null;
      let best = null; let bd = Math.max(3.5, cw * 1.6);
      for (const c of cells.get(row)) { const dd = Math.abs(c.x + c.w / 2 - px); if (dd <= bd) { bd = dd; best = c; } }
      return best;
    };
    let hot = null;
    const tipFor = (c) => {
      const e = c.e;
      return [el('div', { class: 'pm-tip-title' }, c.u.title),
        el('div', {}, `${fmt.KIND[c.u.kind].label} · ${atLabel(c.u.tick)}`),
        el('div', {}, `${LABELS.stat.speak} ${fmt.num(e.speaker ?? 0)}${(e.lines - (e.speaker ?? 0)) > 0 ? ` · ${LABELS.nameOnly} ${fmt.num(e.lines - (e.speaker ?? 0))}줄` : ''} · ${e.scenes}씬`)];
    };
    svg.addEventListener('pointermove', (ev) => {
      const c = nearest(ev);
      hot = c;
      if (!c) { hideTip(); cursor.style.display = 'none'; svg.style.cursor = 'default'; return; }
      cursor.setAttribute('x', c.x - 0.8); cursor.setAttribute('y', c.y - 1); cursor.setAttribute('width', c.w + 1.6);
      cursor.style.display = '';
      svg.style.cursor = 'pointer';
      showTip(ev.clientX, ev.clientY, tipFor(c));
    });
    svg.addEventListener('pointerleave', () => { hot = null; hideTip(); cursor.style.display = 'none'; });
    svg.addEventListener('click', (ev) => { const c = nearest(ev) ?? hot; if (c) state.set({ sel: `unit:${c.u.key}` }); });
    const frame = el('div', { class: 'pm-heat-frame' }, svg);
    if (!a.units) { sec.body.append(ui.empty(LABELS.noAppear)); return; }
    sec.body.append(frame, ui.legend([...LABELS.heatBuckets.map((l, i) => ({ label: l, color: `var(--pm-${i + 1})` })), { label: LABELS.nameOnly, color: 'var(--pm-name)' }]),
      el('div', { class: 'pm-hint muted' }, LABELS.heatHint));
    storyList(p, sec.body);
  }, (p, a) => LABELS.units(fmt.num(a.units)));

  // ── 칸 2: 함께 나온 인물 ──
  const netSeg = ui.segmented({ label: '보기', options: [{ value: 'list', label: LABELS.net.list }, { value: 'graph', label: LABELS.net.graph }], value: prm('net') === 'graph' ? 'graph' : 'list', onChange: (v) => state.setParam('persons', 'net', v === 'graph' ? 'graph' : null) });
  const commonToggle = ui.toggle({ label: LABELS.commonIncl, checked: prm('common') === '1', title: LABELS.commonHelp, onChange: (v) => state.setParam('persons', 'common', v ? '1' : null) });
  let partnerLimit = PAGE + 4;
  const secPartners = makeSection('partners', LABELS.sec.partners, async (p, a, sec, tk) => {
    ui.clear(sec.body);
    sec.body.append(ui.spinner());
    let pm;
    try { pm = await pairsIndex(); } catch (err) { if (!stale(sec, tk)) { ui.clear(sec.body); sec.body.append(ui.notice(err.message, 'error')); } return; }
    if (stale(sec, tk)) return;
    const { list, commons, incl } = partnerRows(p, pm);
    ui.clear(sec.body);
    commonToggle.querySelector('.toggle-label').textContent = `${LABELS.commonIncl}${!incl && commons ? ` (${commons})` : ''}`;
    sec.body.append(el('div', { class: 'toolbar pm-sectools' }, netSeg.el, commons || incl ? commonToggle : null));
    if (!list.length) { sec.body.append(ui.empty(LABELS.withNone)); return; }
    const mode = prm('net') === 'graph' ? 'graph' : 'list';
    if (mode === 'graph') drawGraph(sec, p, list, pm);
    else drawPartnerList(sec, list);
  }, (p) => (pmCache ? LABELS.people(fmt.num(partnerRows(p, pmCache).list.length)) : ''));
  const drawPartnerList = (sec, list) => {
    const max = list[0].st.scenes;
    const ul = el('ul', { class: 'pm-partners' });
    for (const x of list.slice(0, partnerLimit)) {
      ul.append(el('li', { class: 'pm-partner' },
        el('span', { class: 'pm-partner-name' }, personLink(x.id), x.po.kind && x.po.kind !== '니케' ? el('span', { class: 'muted pm-partner-kind' }, ` ${x.po.kind}`) : null),
        el('span', { class: 'pm-bar-track', title: `${T_TOGETHER} ${x.st.scenes} · ${T_TALK} ${x.st.talk} · ${T_UNIT} ${x.st.units}` },
          el('span', { class: 'pm-bar-fill', style: { width: `${(x.st.scenes / max) * 100}%` } }, el('span', { class: 'pm-bar-talk', style: { width: `${x.st.scenes ? (x.st.talk / x.st.scenes) * 100 : 0}%` } }))),
        el('span', { class: 'pm-partner-n' }, fmt.num(x.st.scenes), el('span', { class: 'muted' }, ` · ${fmt.num(x.st.talk)}`))));
    }
    sec.body.append(ul);
    if (list.length > partnerLimit) sec.body.append(showMore(list.length - partnerLimit, () => { partnerLimit += 20; paintSection(sec); }));
    sec.body.append(ui.legend([{ label: T_TOGETHER, color: 'var(--pm-3)' }, { label: LABELS.talkPart, color: 'var(--pm-5)' }]));
  };
  const drawGraph = (sec, p, list, pm) => {
    const W = Math.max(280, sec.body.clientWidth || 640);
    const compact = W < 520;
    const H = compact ? 350 : 400;
    const padX = compact ? 66 : 96;
    const n = Math.min(list.length, compact ? 10 : 16);
    const items = list.slice(0, n);
    const cx = W / 2; const cy = H / 2;
    const R = Math.max(72, Math.min(W / 2 - padX, H / 2 - 30));
    const pp = (x, y) => (x.id === y.id ? 0 : pairStat(pairOf(pm, x.id, y.id) ?? { by: [] }).scenes);
    const w = new Map();
    for (const x of items) for (const y of items) if (x.id < y.id) w.set(`${x.id}\t${y.id}`, pp(x, y));
    const tie = (x, y) => w.get(x.id < y.id ? `${x.id}\t${y.id}` : `${y.id}\t${x.id}`) ?? 0;
    // 서로 많이 같이 나온 상대끼리 이웃하게 둘러 세운다
    const rest = items.slice(1);
    const ring = [items[0]];
    while (rest.length) {
      const last = ring.at(-1);
      let bi = 0; let bs = -1;
      rest.forEach((c, i) => { const sc = tie(last, c) + c.st.scenes * 0.001; if (sc > bs) { bs = sc; bi = i; } });
      ring.push(rest.splice(bi, 1)[0]);
    }
    const maxS = items[0].st.scenes;
    const pos = ring.map((x, i) => { const ang = -Math.PI / 2 + Math.PI / n + (i * 2 * Math.PI) / n; return { x, ang, px: cx + R * Math.cos(ang), py: cy + R * Math.sin(ang), r: 5 + 7 * Math.sqrt(x.st.scenes / maxS) }; });
    const svg = sv('svg', { class: 'pm-graph', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': `${p.name} ${LABELS.sec.partners} ${LABELS.net.graph}` });
    // 상대끼리 선
    const ppEdges = [];
    for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) { const s = tie(pos[i].x, pos[j].x); if (s >= 3) ppEdges.push({ i, j, s }); }
    ppEdges.sort((x, y) => y.s - x.s);
    const maxPP = ppEdges[0]?.s ?? 1;
    const ppKeep = ppEdges.filter((e) => e.s >= Math.max(3, maxPP * 0.25)).slice(0, n + 4);
    const gE = sv('g', { class: 'pm-edges' });
    for (const e of ppKeep) {
      const A = pos[e.i]; const B = pos[e.j];
      const qx = cx + ((A.px + B.px) / 2 - cx) * 0.3; const qy = cy + ((A.py + B.py) / 2 - cy) * 0.3;
      gE.append(sv('path', { class: 'pm-edge pm-edge-pp', d: `M${A.px} ${A.py}Q${qx} ${qy} ${B.px} ${B.py}`, 'stroke-width': (0.8 + 2.4 * Math.sqrt(e.s / maxPP)).toFixed(2), 'data-a': A.x.id, 'data-b': B.x.id }));
    }
    for (const A of pos) gE.append(sv('line', { class: 'pm-edge pm-edge-c', x1: cx, y1: cy, x2: A.px, y2: A.py, 'stroke-width': (1 + 4 * Math.sqrt(A.x.st.scenes / maxS)).toFixed(2), 'data-a': A.x.id }));
    svg.append(gE);
    const gN = sv('g', { class: 'pm-nodes' });
    for (const A of pos) {
      const cosA = Math.cos(A.ang); const sinA = Math.sin(A.ang);
      const lx = A.px + (A.r + 6) * cosA; const ly = A.py + (A.r + 6) * sinA;
      const anchor = cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle';
      const g = sv('g', { class: 'pm-node', tabindex: 0, role: 'button', 'aria-label': `${A.x.po.name} — ${T_TOGETHER} ${A.x.st.scenes}`, 'data-id': A.x.id },
        sv('circle', { class: 'pm-node-hit', cx: A.px, cy: A.py, r: Math.max(A.r + 6, 14) }),
        sv('circle', { class: 'pm-node-dot', cx: A.px, cy: A.py, r: A.r }),
        sv('text', { class: 'pm-node-label', x: lx, y: ly, 'text-anchor': anchor, 'dominant-baseline': sinA > 0.55 ? 'hanging' : sinA < -0.55 ? 'auto' : 'central' }, clip(A.x.po.name, compact ? 5 : 8)));
      ui.tooltip(g, () => el('div', {}, el('div', { class: 'pm-tip-title' }, A.x.po.name), el('div', {}, `${T_TOGETHER} ${fmt.num(A.x.st.scenes)} · ${T_TALK} ${fmt.num(A.x.st.talk)}`), el('div', {}, `${T_UNIT} ${fmt.num(A.x.st.units)}`)));
      const go = () => selectPerson(A.x.id);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      g.addEventListener('mouseenter', () => svg.classList.add('has-hot') || svg.querySelectorAll(`[data-a="${CSS.escape(A.x.id)}"],[data-b="${CSS.escape(A.x.id)}"]`).forEach((n_) => n_.classList.add('is-hot')) || g.classList.add('is-hot'));
      g.addEventListener('mouseleave', () => { svg.classList.remove('has-hot'); svg.querySelectorAll('.is-hot').forEach((n_) => n_.classList.remove('is-hot')); });
      gN.append(g);
    }
    const cw_ = Math.max(36, [...p.name].length * 14 + 16);
    gN.append(sv('circle', { class: 'pm-center', cx, cy, r: 14 }), sv('rect', { class: 'pm-center-pill', x: cx - cw_ / 2, y: cy + 18, width: cw_, height: 22, rx: 11 }),
      sv('text', { class: 'pm-center-label', x: cx, y: cy + 29, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, p.name));
    svg.append(gN);
    sec.body.append(el('div', { class: 'pm-graph-frame' }, svg), ui.legend([{ label: `${T_TOGETHER} — 선 굵기 · 점 크기`, color: 'var(--pm-4)' }, { label: '상대끼리 같이 나온 장면', color: 'var(--line-2)' }]),
      list.length > n ? el('div', { class: 'pm-hint muted' }, `상위 ${n}명 — 나머지 ${list.length - n}명은 목록에서 본다`) : null);
  };

  // ── 칸 3: 변화 타임라인 ──
  const chgSeg = ui.segmented({ label: LABELS.chgOrder, options: [{ value: 'story', label: LABELS.chg.story, title: fmt.TERM?.chronoPlace }, { value: 'release', label: LABELS.chg.release }], value: prm('chg') === 'release' ? 'release' : 'story', onChange: (v) => state.setParam('persons', 'chg', v === 'release' ? 'release' : null) });
  let chgLimit = 15;
  const closureOf = (d) => {
    const R = recs();
    const ends = new Map();
    if (!R) return ends;
    for (const id of d.records) {
      const r = R.get(id);
      if (r?.kind !== 'O' || recWhy(r)) continue;
      for (const c of r.closing ?? []) ends.set(c, r);
    }
    return ends;
  };
  const changeBody = (c, r) => {
    if (!r) return null;
    return c.act === '변화' ? `${r.before ?? '?'} → ${r.after ?? '?'}` : r.text ?? '';
  };
  const secChanges = makeSection('changes', LABELS.sec.changes, (p, a, sec) => {
    ui.clear(sec.body);
    const d = D.get(p.id);
    const vis = visibleChanges(p);
    if (!vis.length) { sec.body.append(ui.empty(LABELS.chgEmpty)); return; }
    const mode = prm('chg') === 'release' ? 'release' : 'story';
    const cmpId = (x, y) => String(x.id).localeCompare(String(y.id), 'en', { numeric: true });
    const list = [...vis].sort(mode === 'story'
      ? (x, y) => (x.seq ?? 1e9) - (y.seq ?? 1e9) || x.order - y.order || cmpId(x, y)
      : (x, y) => x.order - y.order || (x.seq ?? 1e9) - (y.seq ?? 1e9) || cmpId(x, y));
    const R = recs();
    const ends = closureOf(d);
    const aspects = [...ASPECTS.filter((x) => list.some((c) => c.aspect === x)), ...[...new Set(list.map((c) => c.aspect))].filter((x) => !ASPECTS.includes(x))];
    const unplacedAt = mode === 'story' ? list.findIndex((c) => c.seq == null) : -1;
    sec.body.append(el('div', { class: 'toolbar pm-sectools' }, chgSeg.el));

    // 그림
    const W = Math.max(280, sec.body.clientWidth || 640);
    const LW = W < 520 ? 40 : 52; const PR = 10; const LH = 26; const TOP = 22; const AX = 22;
    const cols = list.length + (unplacedAt >= 0 ? 1 : 0);
    const step = Math.max(5, Math.min(22, (W - LW - PR) / cols));
    const SW = Math.max(W, LW + PR + step * cols);
    const H = TOP + aspects.length * LH + AX;
    const colX = (i) => LW + step * (i + (unplacedAt >= 0 && i >= unplacedAt ? 1 : 0)) + step / 2;
    const svg = sv('svg', { class: 'pm-chg', width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', 'aria-label': `${p.name} ${LABELS.sec.changes} ${list.length}` });
    // 같은 스토리끼리 띠
    let gs = 0;
    const groups = [];
    list.forEach((c, i) => {
      if (i > 0 && (c.unit !== list[i - 1].unit)) { groups.push({ from: gs, to: i - 1, unit: list[i - 1].unit }); gs = i; }
      if (i === list.length - 1) groups.push({ from: gs, to: i, unit: c.unit });
    });
    groups.forEach((g, k) => {
      if (k % 2) svg.append(sv('rect', { class: 'pm-band', x: colX(g.from) - step / 2, y: TOP - 8, width: colX(g.to) - colX(g.from) + step, height: aspects.length * LH + 8 }));
    });
    aspects.forEach((asp, i) => {
      const y = TOP + i * LH + LH / 2;
      svg.append(sv('line', { class: 'pm-lane', x1: LW, x2: SW - PR, y1: y, y2: y }), sv('text', { class: 'pm-svg-label', x: LW - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'central' }, asp));
    });
    if (unplacedAt >= 0) {
      const x = LW + step * unplacedAt;
      svg.append(sv('line', { class: 'pm-gap', x1: x + step / 2, x2: x + step / 2, y1: TOP - 8, y2: TOP + aspects.length * LH }),
        sv('text', { class: 'pm-svg-note', x: x + step + 4, y: TOP - 10, 'text-anchor': 'start' }, LABELS.unplaced));
    }
    // 축 — 메인 챕터 이름(그 변화가 공개된 곳)
    let lastX = -99;
    for (const g of groups) {
      const u = idx.units.get(g.unit);
      if (u?.kind !== 'main') continue;
      const x = (colX(g.from) + colX(g.to)) / 2;
      if (x - lastX < 40) continue;
      lastX = x;
      svg.append(sv('text', { class: 'pm-svg-label pm-axis-label', x, y: TOP + aspects.length * LH + 15, 'text-anchor': 'middle' }, fmt.tickShort(u.tick)));
    }
    const gD = sv('g', { class: 'pm-dots' });
    list.forEach((c, i) => {
      const x = colX(i); const y = TOP + aspects.indexOf(c.aspect) * LH + LH / 2;
      const inv = c.inverted?.length;
      const g = sv('g', { class: ['pm-dot', c.act === '변화' ? 'is-change' : 'is-base', inv ? 'is-inv' : '', ends.has(c.id) ? 'is-end' : ''].filter(Boolean).join(' '), tabindex: 0, role: 'button', 'data-cid': c.id, 'data-sel': `record:${c.id}`,
        'aria-label': `${c.aspect} ${fmt.CHANGE_ACT[c.act] ?? c.act} — ${fmt.unitTitle(c.unit)}` });
      if (inv) g.append(sv('circle', { class: 'pm-dot-inv', cx: x, cy: y, r: 7.5 }));
      if (ends.has(c.id)) g.append(sv('path', { class: 'pm-flag', d: `M${x} ${y - 6}V${y - 15}l7 3.2l-7 3.2` }));
      g.append(sv('circle', { class: 'pm-dot-hit', cx: x, cy: y, r: Math.max(8, step / 2) }), sv('circle', { class: 'pm-dot-mark', cx: x, cy: y, r: 4.5 }));
      ui.tooltip(g, () => changeTip(c, recById(c.id), ends.get(c.id)));
      g.addEventListener('click', () => state.set({ sel: `record:${c.id}` }));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); state.set({ sel: `record:${c.id}` }); } });
      g.addEventListener('mouseenter', () => hotRow(c.id, true));
      g.addEventListener('mouseleave', () => hotRow(c.id, false));
      gD.append(g);
    });
    svg.append(gD);
    const key = (w, h, kids, label) => el('span', { class: 'pm-key' }, sv('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` }, kids), ` ${label}`);
    sec.body.append(el('div', { class: 'pm-chg-frame' }, svg),
      el('div', { class: 'pm-legend2 muted' },
        key(14, 14, sv('circle', { cx: 7, cy: 7, r: 4.5, class: 'pm-key-change' }), LABELS.chgLegend.change),
        key(14, 14, sv('circle', { cx: 7, cy: 7, r: 4.5, class: 'pm-key-base' }), LABELS.chgLegend.base),
        key(18, 18, [sv('circle', { cx: 9, cy: 9, r: 7.5, class: 'pm-key-inv' }), sv('circle', { cx: 9, cy: 9, r: 4.5, class: 'pm-key-change' })], T_INV),
        ends.size ? key(14, 16, sv('path', { class: 'pm-key-flag', d: 'M3 15V2l8 3.4L3 8.8' }), LABELS.chgLegend.end) : null,
        el('span', { class: 'pm-axis-note' }, LABELS.axisNote)));

    // 목록
    const ul = el('ol', { class: 'pm-changes', start: 1 });
    list.slice(0, chgLimit).forEach((c, i) => {
      const r = R?.get(c.id);
      const text = changeBody(c, r);
      const cls = fmt.CHRONO_CLASS?.[c.class];
      ul.append(el('li', { class: ['pm-change', c.act === '변화' ? 'is-change' : 'is-base'], dataset: { cid: c.id, sel: `record:${c.id}` }, tabindex: 0, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel: `record:${c.id}` }); },
        onMouseenter: () => hotDot(c.id, true), onMouseleave: () => hotDot(c.id, false), onFocus: () => hotDot(c.id, true), onBlur: () => hotDot(c.id, false),
        onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); state.set({ sel: `record:${c.id}` }); } } },
      el('span', { class: 'pm-change-n' }, i + 1),
      el('div', { class: 'pm-change-main' },
        el('div', { class: 'pm-change-head' },
          ui.chip('plain', c.aspect), ' ', el('span', { class: 'pm-act' }, fmt.CHANGE_ACT[c.act] ?? c.act),
          c.with ? [' ', el('span', { class: 'muted' }, '→'), ' ', P.has(c.with) ? personLink(c.with) : ui.link(`target:${c.with}`, fmt.targetName(c.with))] : null,
          inv_(c), ends.has(c.id) ? [' ', el('span', { class: 'pm-tag is-end', title: fmt.help?.('record', 'O') }, fmt.RECORD_KIND.O.label)] : null,
          cls && c.class !== '판별' ? [' ', el('span', { class: 'pm-tag', title: fmt.help?.('chrono', c.class) }, cls)] : null),
        text ? el('div', { class: 'pm-change-text' }, text) : el('div', { class: 'pm-change-text muted' }, R ? '' : LABELS.needRecords),
        el('div', { class: 'pm-change-meta muted' }, unitLink(c.unit), ` · ${atLabel(c.tick)}`, ' · ', el('span', { class: 'mono' }, c.id), r?.scene ? ` · ${fmt.sceneName(r.scene)}` : '',
          r?.trigger?.length ? [` · ${LABELS.trigger} `, el('span', {}, fmt.evidence(r.trigger))] : null))));
    });
    sec.body.append(ul);
    if (list.length > chgLimit) sec.body.append(showMore(list.length - chgLimit, () => { chgLimit += 25; paintSection(sec); }));
  }, (p) => fmt.num(visibleChanges(p).length));
  function inv_(c) {
    return c.inverted?.length ? [' ', el('span', { class: 'pm-tag is-inv', title: `먼저 공개된 변화 ${c.inverted.length}개보다 작중으로 앞선다` }, T_INV)] : null;
  }
  function changeTip(c, r, endRec) {
    const bodyText = changeBody(c, r);
    return el('div', { class: 'pm-ctip' },
      el('div', { class: 'pm-tip-title' }, `${c.aspect} · ${fmt.CHANGE_ACT[c.act] ?? c.act}${c.with ? ` · ${fmt.targetName(c.with)}` : ''}`),
      bodyText ? el('div', {}, clip(bodyText, 120)) : null,
      el('div', { class: 'pm-tip-sub' }, `${fmt.unitTitle(c.unit)} · ${atLabel(c.tick)}`),
      c.inverted?.length ? el('div', { class: 'pm-tip-sub' }, `${T_INV} — 먼저 공개된 변화 ${c.inverted.length}개보다 작중으로 앞`) : null,
      endRec ? el('div', { class: 'pm-tip-sub' }, `${fmt.RECORD_KIND.O.label} — ${clip(endRec.text, 60)}`) : null,
      el('div', { class: 'pm-tip-sub' }, `${c.id}${r?.scene ? ` · ${fmt.sceneName(r.scene)}` : ''}`));
  }
  function hotDot(cid, on) {
    secChanges.body.querySelector(`.pm-dot[data-cid="${CSS.escape(cid)}"]`)?.classList.toggle('is-hot', on);
  }
  function hotRow(cid, on) {
    for (const n of secChanges.body.querySelectorAll(`.pm-change[data-cid="${CSS.escape(cid)}"]`)) n.classList.toggle('is-hot', on);
  }

  // ── 칸 4: 결말 ──
  const secClosure = makeSection('closure', LABELS.sec.closure, (p, a, sec) => {
    ui.clear(sec.body);
    const R = recs();
    const mine = mineRecs(p);
    if (!mine) { sec.body.append(recsPending()); return; }
    const os = mine.filter((r) => r.kind === 'O').sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
    const hs = mine.filter((r) => r.kind === 'H').sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
    if (!os.length && !hs.length) { sec.body.append(ui.empty(LABELS.closureEmpty)); return; }
    const ul = el('ul', { class: 'pm-closures' });
    for (const r of os) {
      ul.append(el('li', { class: 'pm-closure', dataset: { sel: `record:${r.id}` }, tabindex: 0, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel: `record:${r.id}` }); },
        onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); state.set({ sel: `record:${r.id}` }); } } },
      el('div', { class: 'pm-change-head' }, ui.chip('plain', r.type ?? fmt.RECORD_KIND.O.label), ' ', r.confidence === '추정' ? ui.chip('confidence', '추정') : null),
      el('div', { class: 'pm-change-text' }, r.text),
      el('div', { class: 'pm-change-meta muted' }, unitLink(r.unit), ` · ${atLabel(r.tick)}`, r.built?.length ? ` · ${LABELS.built(r.built.length)}` : '', ' · ', el('span', { class: 'mono' }, r.id))));
    }
    sec.body.append(ul);
    if (hs.length) {
      const hl = el('ul', { class: 'pm-closures' });
      for (const h of hs) {
        const others = new Set();
        for (const oid of h.members ?? []) for (const t of R.get(oid)?.about ?? []) if (t.startsWith('person:') && t !== p.id) others.add(t);
        hl.append(el('li', { class: 'pm-closure', dataset: { sel: `record:${h.id}` }, tabindex: 0, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel: `record:${h.id}` }); },
          onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); state.set({ sel: `record:${h.id}` }); } } },
        el('div', { class: 'pm-change-head' }, el('strong', {}, h.title ?? LABELS.togetherEnd)),
        el('div', { class: 'pm-change-text' }, h.text),
        others.size ? el('div', { class: 'pm-with' }, [...others].map((t, i) => [i ? ' · ' : null, P.has(t) ? personLink(t) : ui.link(`person:${t}`, fmt.targetName(t))])) : null,
        el('div', { class: 'pm-change-meta muted' }, unitLink(h.unit), ` · ${atLabel(h.tick)} · `, el('span', { class: 'mono' }, h.id))));
      }
      sec.body.append(el('h4', { class: 'pm-subhead' }, `${LABELS.togetherEnd} ${hs.length}`), hl);
    }
  }, (p) => { const m = mineRecs(p); const n = m ? m.filter((r) => r.kind === 'O' || r.kind === 'H').length : 0; return n ? fmt.num(n) : ''; });

  // ── 칸 5: 사실 · 의문 ──
  const fqSeg = (counts) => ui.segmented({ label: LABELS.sec.records, options: ['q', 'f', 'k', 'e'].map((k) => ({ value: k, label: `${LABELS.fq[k]} ${counts[k]}` })), value: ['q', 'f', 'k', 'e'].includes(prm('fq')) ? prm('fq') : 'q', onChange: (v) => state.setParam('persons', 'fq', v === 'q' ? null : v) });
  const fqLimit = { q: PAGE, f: PAGE, k: PAGE, e: PAGE };
  const secRecords = makeSection('records', LABELS.sec.records, (p, a, sec) => {
    ui.clear(sec.body);
    const mine = mineRecs(p);
    if (!mine) { sec.body.append(recsPending()); return; }
    const by = recGroups(mine);
    const openN = by.q.filter((r) => fmt.stateAt(r, V.R) === '열림').length;
    const tab = ['q', 'f', 'k', 'e'].includes(prm('fq')) ? prm('fq') : 'q';
    const seg = fqSeg(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, fmt.num(v.length)])));
    sec.body.append(el('div', { class: 'toolbar pm-sectools' }, seg.el, openN ? el('span', { class: 'pm-open-note' }, el('i', { class: 'pm-dot-open', 'aria-hidden': 'true' }), `${OPEN} ${openN}`) : null));
    const list = by[tab];
    if (!list.length) { sec.body.append(ui.empty(LABELS.fqEmpty[tab])); return; }
    const row = (r) => {
      const st = r.kind === 'Q' || r.kind === 'F' ? fmt.stateAt(r, V.R) : null;
      const showState = st && tab !== 'q' && (r.kind === 'Q' || st === '뒤집힘' || st === '암시만');
      const label = tab === 'k' || tab === 'e' ? (r.kind === 'E' ? fmt.ACT[r.act] ?? fmt.RECORD_KIND.E.label : fmt.recordLabel(r)) : null;
      return el('li', { class: ['pm-rec', st === '열림' ? 'is-open' : ''], dataset: { sel: `record:${r.id}` }, tabindex: 0, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel: `record:${r.id}` }); },
        onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); state.set({ sel: `record:${r.id}` }); } } },
      el('div', { class: 'pm-rec-text' }, showState ? [ui.chip('state', st), ' '] : null, label ? [el('span', { class: 'pm-act' }, label), ' '] : null, fmt.recordText(r)),
      el('div', { class: 'pm-rec-meta muted' }, unitLink(r.unit), ` · ${atLabel(r.tick)} · `, el('span', { class: 'mono' }, r.id), r.scene ? ` · ${fmt.sceneName(r.scene)}` : '', r.confidence === '추정' ? [' ', ui.chip('confidence', '추정')] : null));
    };
    const limit = fqLimit[tab];
    const shown = list.slice(0, limit);
    const ul = el('ul', { class: 'pm-recs' });
    if (tab === 'q') {
      // 상태별로 묶는다 — 미해결이 맨 위. 정렬이 상태 묶음 먼저라 보이는 몫도 상태순으로 고른다
      const order = ['열림', '일부', '풀림', '암시만'];
      const sorted = [...list].sort((x, y) => order.indexOf(fmt.stateAt(x, V.R)) - order.indexOf(fmt.stateAt(y, V.R)) || (x.order ?? 0) - (y.order ?? 0));
      const take = sorted.slice(0, limit);
      const g2 = new Map(order.map((s) => [s, []]));
      for (const r of take) (g2.get(fmt.stateAt(r, V.R)) ?? g2.get('암시만')).push(r);
      for (const [s, rs] of g2) {
        if (!rs.length) continue;
        const total = sorted.filter((r) => fmt.stateAt(r, V.R) === s).length;
        ul.append(el('li', { class: 'pm-group' }, `${fmt.STATE[s]?.label ?? s} ${total}`));
        for (const r of rs) ul.append(row(r));
      }
      sec.body.append(ul);
      if (sorted.length > limit) sec.body.append(showMore(sorted.length - limit, () => { fqLimit[tab] += 15; paintSection(sec); }));
      return;
    }
    for (const r of shown) ul.append(row(r));
    sec.body.append(ul);
    if (list.length > limit) sec.body.append(showMore(list.length - limit, () => { fqLimit[tab] += 15; paintSection(sec); }));
  }, (p) => { const m = mineRecs(p); if (!m) return ''; const by = recGroups(m); return `${LABELS.fq.q} ${fmt.num(by.q.length)} · ${LABELS.fq.f} ${fmt.num(by.f.length)}`; });

  // ── 칸 6: 떡밥 ──
  const secThreads = makeSection('threads', LABELS.sec.threads, (p, a, sec) => {
    ui.clear(sec.body);
    const mine = mineRecs(p);
    if (!mine) { sec.body.append(recsPending()); return; }
    const rows = threadRows(p, mine);
    if (!rows.length) { sec.body.append(ui.empty(LABELS.threadsEmpty)); return; }
    const ul = el('ul', { class: 'pm-threads' });
    for (const { id, s, j } of rows) {
      const parts = [s.q ? `${LABELS.threadStat.q} ${s.q}${s.open ? ` (${OPEN} ${s.open})` : ''}` : null, s.f ? `${LABELS.threadStat.f} ${s.f}` : null, s.e ? `${LABELS.threadStat.e} ${s.e}` : null].filter(Boolean);
      ul.append(el('li', { class: 'pm-thread', dataset: { sel: `thread:${id}` }, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel: `thread:${id}` }); } },
        el('div', { class: 'pm-thread-head' }, ui.chip('plain', fmt.THREAD_WEIGHT[j.weight]?.label ?? j.weight, fmt.THREAD_WEIGHT[j.weight]?.label ?? j.weight), ' ',
          j.owners?.includes(p.id) ? [ui.chip('plain', T_LEAD, T_LEAD), ' '] : null, ui.link(`thread:${id}`, j.title)),
        parts.length ? el('div', { class: 'pm-change-meta muted' }, parts.join(' · ')) : null));
      ul.lastChild.firstChild.firstChild.setAttribute('title', fmt.help?.('weight', j.weight) ?? '');
    }
    sec.body.append(ul);
  }, (p) => { const m = mineRecs(p); return m ? (threadRows(p, m).length || '') + '' : ''; });

  // ── 상세 조립 ──
  detail.append(head, ...sections.map((s) => s.det));
  const renderDetail = () => {
    renderHead();
    const a = agg.get(whoId());
    for (const sec of sections) {
      sec.det.hidden = !a?.visible;
      if (a?.visible) { sec.dirty = true; paintSection(sec); }
    }
    for (const k of Object.keys(fqLimit)) fqLimit[k] = PAGE;
    partnerLimit = PAGE + 4;
    usLimit.clear();
    chgLimit = 15;
  };

  // ── 표시 전환 ──
  const renderViewMode = () => {
    const table = prm('view') === 'table';
    body.hidden = table;
    tableBox.hidden = !table;
    modeSeg.set(table ? 'table' : 'person');
    kindSeg.set(prm('kind') ?? 'all');
    leadToggle.set(prm('lead') === '1');
    if (find.value !== (prm('find') ?? '') && document.activeElement !== find) find.value = prm('find') ?? '';
  };
  const renderRows = () => {
    const sort = buildRows();
    renderList(sort);
    tbl.update(rowsNow);
    tbl.setSelected(whoId());
    pickBtn.replaceChildren(el('span', { class: 'pm-pick-label muted' }, `${LABELS.pick}`), el('strong', {}, P.get(whoId())?.name ?? ''), el('span', { class: 'pm-pick-chev', 'aria-hidden': 'true' }, '▾'));
  };
  const markSel = () => {
    const sel = state.get().sel;
    for (const n of root.querySelectorAll('[data-sel]')) n.classList.toggle('is-picked', n.dataset.sel === sel);
  };
  const renderAll = () => {
    recompute();
    renderViewMode();
    renderRows();
    renderNote();
    renderDetail();
    markSel();
  };

  // ── 상태 구독 ──
  let prevP = { ...state.get().p };
  let prevSel = state.get().sel;
  const off = state.subscribe((s, changed) => {
    if (s.tab !== 'persons') return;
    if (changed.has('t') || changed.has('layers')) { renderAll(); prevP = { ...s.p }; return; }
    let rerender = false;
    if (changed.has('sel')) {
      const sel = state.parseSel(s.sel);
      const pv = state.parseSel(prevSel);
      if (sel?.type === 'person' && P.has(sel.id) && sel.id !== prm('who') && !(pv?.type === 'person' && pv.id === sel.id)) {
        prevSel = s.sel;
        state.setParam('persons', 'who', sel.id, { replace: true });
        return;
      }
      prevSel = s.sel;
      markSel();
    }
    if (changed.has('p')) {
      const was = prevP;
      const diff = (k) => was[k] !== s.p[k];
      prevP = { ...s.p };
      if (diff('view') || diff('find') || diff('kind') || diff('lead') || diff('sort')) { renderViewMode(); renderRows(); renderNote(); }
      if (diff('who')) {
        renderViewMode(); markListSel(); scrollSelIntoView(); tbl.setSelected(whoId());
        pickBtn.replaceChildren(el('span', { class: 'pm-pick-label muted' }, LABELS.pick), el('strong', {}, P.get(whoId())?.name ?? ''), el('span', { class: 'pm-pick-chev', 'aria-hidden': 'true' }, '▾'));
        renderNote(); renderDetail(); rerender = true;
        const top = head.getBoundingClientRect().top;
        const stick = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 56) + 44 + 8;
        if (top < stick) window.scrollTo({ top: window.scrollY + top - stick - 8 });
      }
      if (!rerender) {
        if (diff('net') || diff('common')) { netSeg.set(prm('net') === 'graph' ? 'graph' : 'list'); commonToggle.set(prm('common') === '1'); paintSection(secPartners); }
        if (diff('fq')) paintSection(secRecords);
        if (diff('us')) { usSeg.set(prm('us') === 'speak' ? 'speak' : 'order'); paintSection(secHeat); }
        if (diff('chg')) { chgSeg.set(prm('chg') === 'release' ? 'release' : 'story'); paintSection(secChanges); }
      }
    }
  });

  // 폭이 바뀌면 그림만 다시(히트맵 · 관계도 · 변화)
  let lastW = detail.clientWidth;
  let rz = null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const w = detail.clientWidth;
    if (!w || Math.abs(w - lastW) < 12) return;
    lastW = w;
    clearTimeout(rz);
    rz = setTimeout(() => { if (agg.get(whoId())?.visible) for (const s of [secHeat, secChanges]) paintSection(s); if (prm('net') === 'graph') paintSection(secPartners); }, 140);
  }) : null;
  ro?.observe(detail);

  renderAll();
  pairsIndex().then(() => {
    if (disposed) return;
    const p = P.get(whoId());
    if (p && agg.get(p.id)?.visible) secPartners.countEl.textContent = secPartners.count(p) ?? '';
  }).catch((err) => console.warn('함께 나온 인물 표를 받지 못했다', err));
  if (!idx.hasRecords) {
    idx.withRecords().then(() => { if (!disposed) renderAll(); })
      .catch((err) => { console.warn('기록을 받지 못했다', err); recsError = true; if (!disposed) for (const sec of [secRecords, secClosure, secThreads]) if (sec.det.open) paintSection(sec); });
  }
  setTimeout(scrollSelIntoView, 0);

  return () => {
    disposed = true;
    off();
    ro?.disconnect();
    clearTimeout(findTimer); clearTimeout(rz);
    tipEl.remove();
  };
}
