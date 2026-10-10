/**
 * 탭 4 인물(W5) — 화면 5 "인물별 집계"(docs/views.md 5절, 시안 표 data/views/persons/ — X3d).
 * 첫 쓸모: 인물 하나(기본 라피)가 "누구고, 어디 나왔고, 누구와 같이 나왔고, 어떻게 바뀌었고, 무엇이 아직 풀리지 않았나".
 * 화면: 왼쪽 인물 목록(찾기 · 갈래 · 주역 · 정렬) + 오른쪽 상세(머리 · 접는 칸). 도구줄의 [인물 도감]은 초상 격자를 기업 · 스쿼드로 묶어 보인다.
 *
 * 쓰는 JSON
 *   persons.json          인물 386(사전 person: 전부) — 정적 메타(갈래 kind · common · leads(주역인 떡밥) · same_as · aliases) + 전체 기준 집계(화면은 다시 센다)
 *                         이름이 아직 안 나온 인물(fmt.met — targets.json meet)은 목록 · 도감 · 함께 나온 인물에서 빼고, 이름 · 다른 이름 · 찾기는 그 자리의 것(fmt.nameAt · aliasesAt · namesAt — W15b)
 *   persons-detail.json   등장 · 기록 · 변화가 하나라도 있는 인물 381 — { units[](등장: 스토리 · 씬 · 줄 · 말한 줄), records[](확정 기록 ID), changes[](변화: 작중 순서 seq · 측면 · 처음 모습/바뀜 · 상대 · 출시순과 반대) }
 *   persons-pairs.json    함께 나온 쌍 — by[] = [출시 시점, 범위, 같이 나온 장면, 대화한 장면, 스토리(, 체크 칸 스토리 키 — 척추 이벤트 · 사이드 · 준필수)](처음 열 때 받는다)
 *   공용(idx)             units(읽는 순서 · 출시 시점) · ticks · targets(초상 · 소속) · threads · records(6MB — 열 때 받아 오면 기록 칸이 채워진다)
 *   기록 문장 · 전 → 후는 records*.json의 것을 쓴다(persons*.json에는 문장이 없다). 원문 본문은 어디에도 없다.
 *
 * URL 파라미터(p.*)
 *   who    고른 인물(person:라피). 없으면 리더에서 연 인물 → 라피 → 목록 첫 인물. 리더에서 인물을 누르면 따라온다
 *   view   dex면 인물 도감(옛 주소의 table도 도감), 없으면 인물별
 *   find   인물 · 다른 이름 찾기      kind  갈래(니케 · 인물 · 랩쳐)      lead  1이면 주역만(첫 스토리를 본 떡밥의 주역 — W15b)      sort  목록 · 도감 정렬(없으면 많이 나온 순 | first 처음 등장 순 | name 이름순)
 *   net    함께 나온 인물 보기(list 기본 | graph 관계도)      common  1이면 어디에나 나오는 인물(persons.json common — 지휘관 · 라피 · 아니스 · 네온)도 포함
 *   us     나온 스토리 목록의 정렬(없으면 감상 순서 | speak 많이 말한 순)
 *   fq     사실 · 의문 칸의 탭(q 의문 기본 | f 사실 | k 밝혀짐 · 회수 | e 복선 — 든 것이 있는 탭만 보인다)      chg  release면 변화를 출시순으로(없으면 작중 순)
 *   접힌 칸은 URL이 아니라 localStorage(nikke-story.persons.fold)에 남긴다 — 처음에는 결말 · 떡밥만 접혀 있다.
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13c)
 *   여기까지 읽음은 모든 목록 · 그림에 걸린다 — 안 본 스토리(R.seen — 메인 위치 t + 척추 이벤트 · 사이드 '봤음' 예외 x)의 등장 · 변화와
 *     모르는 기록(R.known — 사실 · 의문은 know_units 중 하나라도 봤으면 앎)은 뺀다(persons-detail.json에서 다시 센다). 쌍은 by[]의 칸마다(척추 이벤트 · 사이드 칸은 그 키로) 본다.
 *     자리(tick)는 히트맵의 '아직 안 읽은 부분' 빗금(t 뒤) · 초상(fmt.iconAt) · 소속(fmt.orgsAt)에만 쓴다 — t 앞이어도 안 봤다고 체크한 스토리 칸은 빗금 칸으로 그린다.
 *   가린 것은 도구줄 아래 한 줄에 "스포일러로 가린 인물 N명 · 스토리 N편"으로 모으고 [전부 보기]를 단다. 아직 나오지 않은 인물은 목록에서 빠지고, 주소로 들어오면 안내만 보인다.
 *   작업 흔적은 싣지 않는다: 기록 ID · 작업량 숫자(말한 줄 · 기록 수 · 씬 · 순번) · 판정 용어(시점 확정 · 대략 범위 …) · 만든 방법 설명. 근거는 링크로만(누르면 장면).
 *   종류 · 갈래 · 측면은 회색 글자(색 없음), 스토리 링크는 메인이면 굵은 CH 표기, 그 밖은 제목 + 회색 종류(호감도 제목은 니케 이름뿐이라).
 *   목록: [초상] 이름 + 소속 마크(마크만). 정렬은 많이 나온 순(등장 장면) · 처음 등장 순 · 이름순 — 숫자는 보이지 않는다.
 *   인물 도감: 목록과 같은 인물(찾기 · 갈래 · 주역 · 정렬을 따른다)을 초상 칸으로. 묶음 = 그 자리의 소속(fmt.orgsAt — 공개 자리를 지난 게임 소속 + 확정 소속 기록, 다른 판(via) 소속은 뺀다).
 *     스쿼드는 게임 스쿼드 → 사전 스쿼드 → 그 밖의 무리(정부 · 단체 …) 순으로 하나. 스쿼드 멤버의 기업이 하나면 그 기업 아래, 여럿이면(카운터스 등) 맨 앞 '여러 기업에서 모인 스쿼드'
 *     (멤버 칸에 기업 마크), 기업이 없으면 '기업 밖'. 기업만 드러난 인물은 그 기업 끝 '그 밖', 소속이 안 드러난 인물은 맨 끝(초상 없는 인물은 이름만).
 *     기업 순서는 게임 마크 순(엘리시온 · 미실리스 · 테트라 · 필그림 · 앱노멀), 스쿼드 순서는 정렬 기준으로 가장 앞선 멤버 순. 칸을 누르면 인물별 보기로.
 *   머리: 초상(얼굴이 없으면 이름 첫 글자) · 이름(+ 회색 갈래 — 니케 · 랩쳐만, '인물'은 탭 이름과 같아 쓰지 않는다) · 소속 마크 · 다른 이름 · 같은 인물 ·
 *     "처음 등장 [스토리]" 하나. 그 첫 스토리에서 말이 없을 때만 '이름만 나옴'(이름은 나옴) · '등장만'(이름 없이 모습만)을 덧붙인다(말함은 당연해서 쓰지 않는다).
 *     같은 인물(정체 연결)은 밝혀지는 단위(근거 첫 씬 — same_as_unit)를 읽었으면 보이고, 아니면 있다는 것 자체를 보이지 않는다.
 *   칸은 든 것이 없으면 통째로 숨긴다(기록이 오기 전에는 기록 칸을 '불러오는 중'으로 둔다). 칸 머리의 수는 등장(N편) · 함께 나온 인물(N명)만.
 *   등장: 히트맵 — 가로 = 읽는 순서(출시순) 481칸을 폭에 맞춰 줄여 그린다, 줄 = 스토리 종류(종류가 축이라 줄 이름은 종류), 칸 색 = 말한 양(파랑 한 색 5단계,
 *     절대 구간 — 인물끼리 견줄 수 있다), 회색 = 이름만 나온 스토리, 빗금 = 아직 안 읽은 부분. 범례는 '말 적음 → 말 많음' 띠(숫자 없음). 칸에 올리면 제목 · 종류, 누르면 리더.
 *     그 아래 나온 스토리 제목 목록: 종류마다 묶고, 앞 점 색 = 말한 양(히트맵과 같은 구간). 종류마다 많으면(메인 36 · 그 밖 20 초과) 앞 24 · 12개만 보이고 [더 보기].
 *   함께 나온 인물: [초상] 이름 + 막대(같이 나온 장면, 진한 부분 = 그중 대화한 장면 — 숫자 없음). 어디에나 나오는 인물(common)은 기본으로 빼고 토글 글자에 그 이름을 적는다.
 *     관계도는 가운데가 고른 인물, 가장자리가 같이 나온 상위 N명(좁으면 10), 선 굵기 · 점 크기 = 같이 나온 장면, 가는 곡선 = 상대끼리 같이 나온 장면(3장면 이상, 가장 센 것의 1/4 이상),
 *     같이 나온 상대끼리 이웃하게 둘러 세운다. 같은 인물 쌍은 뺀다. 상대를 누르면 그 인물로 옮긴다.
 *   변화: 그림 — 줄 = 측면(성격 · 관계 · 소속 · 신체 · 신념 · 기억), 가로 = 작중 순(또는 출시순)의 차례. ● 바뀜 · ○ 처음 모습 · 노란 테두리 = 출시순과 반대
 *     (먼저 공개된 변화보다 작중으로 앞) · 깃발 = 결말. 때를 모르는 변화는 맨 뒤 점선 뒤로. 띠 = 같은 스토리, 아래 글자 = 공개된 챕터.
 *     목록은 같은 차례를 스토리(챕터)마다 묶는다(순번 없음) — 묶음 머리 = 스토리 링크, 줄 = 바뀜/처음 모습 · 회색 측면 · 상대 · 전 → 후. 점과 줄이 서로 강조된다.
 *   사실 · 의문 · 떡밥 · 결말은 확정 기록만(후보 · 기각은 export가 싣지 않는다). 의문은 미해결을 맨 위에 묶는다. 줄 아래는 스토리 링크(+ 추정일 때만 '추정').
 *   떡밥 줄 = 제목 + 회색 '주요 떡밥' · '주역' + 이 인물의 미해결 의문이 있으면 '미해결'.
 */
export const meta = { id: 'persons', title: '인물', blurb: '인물별 등장 · 함께 나온 인물 · 변화 · 결말' };

const NS = 'http://www.w3.org/2000/svg';
/** 화면 말 중 fmt에 없는 것 — 고칠 때는 여기 한 곳만 */
const LABELS = {
  loading: '인물 불러오는 중…',
  pending: '불러오는 중…',
  pendingFail: '받지 못했다 — 새로고침하면 다시 시도한다.',
  view: { person: '인물별', dex: '인물 도감' },
  viewLabel: '보기',
  find: '인물 · 다른 이름 찾기',
  kindLabel: '갈래',
  all: '전체',
  leadOnly: '주역만',
  leadHelp: '떡밥의 중심이 되는 인물만',
  leadTag: '이 떡밥의 중심 인물',
  sort: { scenes: '많이 나온 순', first: '처음 등장 순', name: '이름순' },
  sortLabel: '정렬',
  pick: '인물 고르기',
  people: (n) => `${n}명`,
  none: '찾는 인물이 없다 — 찾기를 비우거나 갈래를 전체로 바꾼다.',
  noneCut: '아직 나온 인물이 없다 — 위의 여기까지 읽음을 올리면 보인다.',
  notYet: '아직 나오지 않은 인물이다.',
  notYetName: '아직 나오지 않은 인물',
  notYetHelp: '위의 여기까지 읽음을 올리면 볼 수 있다.',
  detail: '인물 상세',
  alias: '다른 이름',
  same: '같은 인물',
  first: '처음 등장',
  quiet: { named: '이름만 나옴', seen: '등장만' },
  quietHelp: { named: '이 스토리에서는 말하지 않고 이름만 나온다', seen: '이 스토리에서는 이름 없이 모습만 나온다' },
  plinkHelp: (name) => `${name} — 이 탭에서 보기`,
  sec: { heat: '등장', partners: '함께 나온 인물', changes: '변화', closure: '결말', records: '사실 · 의문', threads: '떡밥' },
  stories: (n) => `${n}편`,
  ramp: { few: '말 적음', many: '말 많음' },
  nameOnly: '이름만 나옴',
  unread: '아직 안 읽은 부분',
  usLabel: '나온 스토리 정렬',
  us: { order: '감상 순서', speak: '많이 말한 순' },
  usFold: '접기',
  net: { list: '목록', graph: '관계도' },
  commonIncl: (names) => `${names} 포함`,
  withNone: '여기까지 읽은 곳에서 함께 나온 인물이 없다.',
  together: '함께 나옴',
  talk: '대화함',
  more: (n) => `더 보기 (${n})`,
  fq: { q: '의문', f: '사실', k: '밝혀짐 · 회수', e: '복선' },
  chg: { story: '작중 순', release: '출시순' },
  chgOrder: '순서',
  chgLegend: { change: '바뀜', base: '처음 모습', end: '결말' },
  invHelp: '먼저 공개된 변화보다 작중으로는 앞선 일',
  unplaced: '언제인지 모름',
  togetherEnd: '함께 맺음',
  dex: { label: '인물 도감', mixed: '여러 기업에서 모인 스쿼드', outside: '기업 밖', other: '그 밖', none: '소속이 드러나지 않은 인물' },
};
const ASPECTS = ['성격', '관계', '소속', '신체', '신념', '기억'];
const BUCKETS = [1, 5, 20, 60, 180];
const FOLD_KEY = 'nikke-story.persons.fold';
/** 처음엔 접어 두는 칸 — 눌러서 연다 */
const CLOSED_BY_DEFAULT = ['closure', 'threads'];
const PAGE = 12;
const DEX_VIEWS = ['dex', 'table']; // table = 옛 '전체 표' 주소

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
 * 쌍의 by[](= [출시 시점, 범위, 같이 나온 장면, 대화한 장면, 스토리(, 척추 이벤트 · 사이드 키)])를 여기까지 읽음으로 더한다(범위 칸은 쓰지 않는다 — 늘 셋 다).
 * T: state.reading()의 R(키가 있는 칸은 R.seen(키), 없는 칸은 자리 ≤ R.t) · 숫자(자리 ≤ T) · null(끔)
 */
export function pairTotals(by, T) {
  let scenes = 0; let talk = 0; let units = 0;
  const R = T != null && typeof T === 'object' ? (T.all ? null : T) : null;
  const t = R ? R.t : typeof T === 'object' ? null : T;
  for (const [tick, , sc, tk, un, ex] of by) {
    if (R && ex) { if (!R.seen(ex)) continue; } else if (t != null && tick > t) { if (!R) break; continue; }
    scenes += sc; talk += tk; units += un;
  }
  return { scenes, talk, units };
}
/** 말한 줄 수의 히트맵 단계(0 = 말한 줄 없음) */
export { bucketOf };

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const el = ui.el;
  const TERM = fmt.TERM;
  const T_LEAD = TERM.lead;
  const T_INV = TERM.inverted;
  const OPEN = fmt.STATE.열림.label;

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
  /** 찾기 글 — 그 자리에서 아는 이름 · 다른 이름만(W15b, fmt.namesAt) */
  const hayOf = (p) => fmt.namesAt(idx.targets.get(p.id) ?? p, V.R).join(' ').toLowerCase();
  /** 그 자리에서 부르는 이름(fmt.nameAt — 표준명이 아직이면 먼저 나온 다른 이름) */
  const nameOf = (id) => fmt.nameAt(idx.targets.get(id), V.R) ?? P.get(id)?.name ?? fmt.targetName(id);
  const kinds = [...new Set(persons.map((p) => p.kind).filter(Boolean))].sort((a, b) => (b === '니케') - (a === '니케') || cmpKo(a, b));
  const commonIds = persons.filter((p) => p.common).map((p) => p.id); // 어디에나 나오는 인물(지휘관 · 라피 · 아니스 · 네온) — 함께 나온 인물에서 기본으로 뺀다
  const maxOrder = idx.unitList.reduce((m, u) => Math.max(m, u.order ?? 0), 0);

  // ── 여기까지 읽음 ──
  let V = { T: null, R: state.reading() }; // T는 자리(빗금 · 초상 · 소속)에만, 가리기는 R(스토리마다)로
  const hideMemo = new Map();
  /** 안 본 스토리인가(여기까지 읽음 뒤 · 안 봤다고 체크) — 모르는 키는 가리지 않는다 */
  const hidden = (unitKey) => {
    if (hideMemo.has(unitKey)) return hideMemo.get(unitKey);
    const on = idx.units.has(unitKey) && !V.R.seen(unitKey);
    hideMemo.set(unitKey, on);
    return on;
  };
  const recHidden = (r) => !V.R.known(r);

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
  const pairStat = (pr) => pairTotals(pr.by, V.R);

  // ── 인물마다 지금 기준 집계(목록 정렬 · 보이나 · 머리의 처음 등장) ──
  let agg = new Map();
  let defaultWho = 'person:라피';
  const recompute = () => {
    const s = state.get();
    V = { T: s.t, R: state.reading(s) };
    hideMemo.clear();
    agg = new Map();
    const R = recs();
    for (const p of persons) {
      const d = D.get(p.id);
      const a = { scenes: 0, units: 0, cut: 0, firstUnit: null, firstEntry: null, firstOrder: Infinity, changes: 0, chCut: 0, recs: null, recCut: 0, hasData: Boolean(d) };
      if (d) {
        for (const e of d.units) {
          if (hidden(e.unit)) { a.cut++; continue; }
          a.scenes += e.scenes; a.units++;
          const o = idx.units.get(e.unit)?.order ?? 0;
          if (o < a.firstOrder) { a.firstOrder = o; a.firstUnit = e.unit; a.firstEntry = e; }
        }
        for (const c of d.changes) { if (hidden(c.unit)) a.chCut++; else a.changes++; }
        if (R) {
          a.recs = 0;
          for (const id of d.records) {
            const r = R.get(id);
            if (!r) continue;
            if (recHidden(r)) a.recCut++; else a.recs++;
          }
        }
      }
      // 이름이 나온 인물만(W15b — 이름표 '???'나 암시 언급으로만 나온 인물은 아직 안 나옴)
      a.met = fmt.met(idx.targets.get(p.id), V.R);
      a.visible = a.met && (a.scenes > 0 || (a.recs ?? 0) > 0 || a.changes > 0);
      agg.set(p.id, a);
    }
    const lappy = agg.get('person:라피');
    defaultWho = lappy?.visible ? 'person:라피' : [...persons].filter((p) => agg.get(p.id).visible).sort((x, y) => agg.get(y.id).scenes - agg.get(x.id).scenes)[0]?.id ?? 'person:라피';
  };

  // ── 골라 쓰는 상태 ──
  const prm = (k) => state.param('persons', k);
  const isDex = () => DEX_VIEWS.includes(prm('view'));
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
    if (prm('view')) patch.p.view = null;
    state.set(patch, { replace });
  };
  const personLink = (id, label) => el('a', {
    href: `#tab=persons&p.who=${id}`, class: 'link pm-plink', title: P.get(id) ? LABELS.plinkHelp(label ?? nameOf(id)) : null,
    onClick: (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); if (P.has(id)) selectPerson(id); else state.set({ sel: `person:${id}` }); },
  }, label ?? nameOf(id));
  /** 'CH.07 재회' → 굵은 CH 표기 + 이름 */
  const chTitle = (title) => { const m = /^(CH\.\d+)\s*(.*)$/.exec(title); return m ? [el('span', { class: 'ch' }, m[1]), m[2] ? ` ${m[2]}` : null] : title; };
  /** 스토리 링크 — 메인은 굵은 CH 표기, 그 밖은 제목 + 회색 종류(호감도 제목은 니케 이름뿐이라 종류가 있어야 안다) */
  const storyRef = (key) => {
    const u = idx.units.get(key);
    if (!u) return fmt.unitTitle(key);
    return el('span', { class: 'pm-story' }, ui.link(`unit:${key}`, u.kind === 'main' ? chTitle(u.title) : u.title),
      u.kind === 'main' ? null : el('span', { class: 'pm-kind', title: fmt.help('kind', u.kind) }, fmt.KIND[u.kind]?.label ?? u.kind));
  };
  /** 얼굴 — 그 자리 모습의 초상, 없으면 이름 첫 글자 칸(머리 · 도감) */
  const face = (id, size, cls) => ui.portrait(fmt.iconAt(idx.targets.get(id), V.T), { size, class: cls })
    ?? el('span', { class: ['pm-noface', cls], style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` }, 'aria-hidden': 'true' }, [...(nameOf(id) ?? '?')][0]);
  /** 그 스토리에서 말이 없으면 '이름만 나옴' · '등장만'(말했으면 null — 당연해서 쓰지 않는다) */
  const quietOf = (e) => (!e || (e.speaker ?? 0) > 0 ? null : e.lines > 0 ? 'named' : 'seen');

  // ── 도구줄 ──
  const modeSeg = ui.segmented({ label: LABELS.viewLabel, options: [{ value: 'person', label: LABELS.view.person }, { value: 'dex', label: LABELS.view.dex }], value: isDex() ? 'dex' : 'person', onChange: (v) => state.setParam('persons', 'view', v === 'dex' ? 'dex' : null, { replace: false }) });
  const find = el('input', { type: 'search', class: 'pm-find', placeholder: LABELS.find, 'aria-label': LABELS.find, value: prm('find') ?? '' });
  let findTimer = null;
  find.addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => state.setParam('persons', 'find', find.value.trim() || null), 180); });
  const kindSeg = ui.segmented({ label: LABELS.kindLabel, options: [{ value: 'all', label: LABELS.all }, ...kinds.map((k) => ({ value: k, label: k }))], value: prm('kind') ?? 'all', onChange: (v) => state.setParam('persons', 'kind', v === 'all' ? null : v) });
  const leadToggle = ui.toggle({ label: LABELS.leadOnly, checked: prm('lead') === '1', title: LABELS.leadHelp, onChange: (v) => state.setParam('persons', 'lead', v ? '1' : null) });
  const bar = el('div', { class: 'toolbar pm-bar' }, modeSeg.el, find, kindSeg.el, leadToggle);
  root.append(bar);

  // ── 목록 · 도감 ──
  const sortSel = el('select', { class: 'pm-select', 'aria-label': LABELS.sortLabel, onChange: () => state.setParam('persons', 'sort', sortSel.value === 'scenes' ? null : sortSel.value) },
    Object.entries(LABELS.sort).map(([v, l]) => el('option', { value: v }, `${LABELS.sortLabel}: ${l}`)));
  const listCount = el('span', { class: 'pm-listcount muted' });
  const listEl = el('div', { class: 'pm-list', role: 'listbox', tabindex: 0, 'aria-label': meta.title });
  const pickBtn = el('button', { type: 'button', class: 'btn pm-pick', 'aria-expanded': 'false', onClick: () => { const open = listBox.classList.toggle('is-open'); pickBtn.setAttribute('aria-expanded', String(open)); } });
  const listBox = el('aside', { class: 'pm-listbox', 'aria-label': LABELS.pick }, pickBtn, el('div', { class: 'pm-listpanel' }, el('div', { class: 'pm-listhead' }, sortSel, listCount), listEl));
  const detail = el('section', { class: 'pm-detail', 'aria-label': LABELS.detail });
  const body = el('div', { class: 'pm-body' }, listBox, detail);
  const dexBox = el('div', { class: 'pm-dex', 'aria-label': LABELS.dex.label });
  const wrap = el('div', { class: 'pm-wrap' }, body, dexBox);
  root.append(wrap);

  let rowsNow = [];
  let hiddenPersons = 0;
  /** 주역인가 — 주역인 떡밥 가운데 첫 스토리를 본 것이 있으면(W15b — 그 자리 기준) */
  const leadNow = (p) => (p.leads ?? []).some((j) => { const th = idx.threads.get(j); return th && !hidden(th.first_unit); });
  const buildRows = () => {
    const find_ = (prm('find') ?? '').trim().toLowerCase();
    const kind = prm('kind') ?? 'all';
    const lead = prm('lead') === '1';
    const sort = Object.hasOwn(LABELS.sort, prm('sort')) ? prm('sort') : 'scenes';
    hiddenPersons = 0;
    const rows = [];
    for (const p of persons) {
      const a = agg.get(p.id);
      if (!a.visible) { if (a.hasData && (a.cut || a.recCut || a.chCut || !a.met)) hiddenPersons++; continue; }
      if (kind !== 'all' && p.kind !== kind) continue;
      if (lead && !leadNow(p)) continue;
      if (find_ && !hayOf(p).includes(find_)) continue;
      rows.push({ id: p.id, p, a, name: nameOf(p.id), scenes: a.scenes, firstOrder: a.firstOrder });
    }
    const keyOf = { scenes: (r) => -r.scenes, first: (r) => r.firstOrder, name: () => 0 };
    const k = keyOf[sort];
    rows.sort((x, y) => k(x) - k(y) || (sort === 'name' ? cmpKo(x.name, y.name) : y.scenes - x.scenes || cmpKo(x.name, y.name)));
    rowsNow = rows;
    return sort;
  };
  const renderList = (sort) => {
    sortSel.value = sort;
    const top = listEl.scrollTop;
    const who = whoId();
    const frag = document.createDocumentFragment();
    for (const [i, r] of rowsNow.entries()) {
      frag.append(el('div', { class: ['pm-item', r.id === who ? 'is-sel' : ''], role: 'option', id: `pm-opt-${i}`, 'aria-selected': String(r.id === who), dataset: { id: r.id, i } },
        ui.portrait(fmt.iconAt(idx.targets.get(r.id), V.T), { size: 24, class: 'pm-item-pic' }) ?? el('span', { class: 'pm-item-pic' }),
        el('span', { class: 'pm-item-who' }, el('span', { class: 'pm-item-name' }, r.name), ui.orgMarks(fmt.orgsAt(idx.targets.get(r.id), V.T, { past: true }), { size: 14, bare: true }))));
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

  // ── 인물 도감: 그 자리의 소속으로 묶은 초상 칸 ──
  const orgKey = (o) => o.org ?? o.name;
  /** 묶을 소속 하나씩 — 기업 하나 · 스쿼드 하나(게임 스쿼드 → 사전 스쿼드 → 그 밖의 무리). 다른 판(via) 소속은 뺀다 */
  const groupOf = (id) => {
    const os = fmt.orgsAt(idx.targets.get(id), V.T).filter((o) => !o.via);
    const squads = os.filter((o) => o.type === 'squad');
    const squad = squads.find((o) => o.source === 'game') ?? squads.find((o) => idx.targets.get(o.org)?.kind === '스쿼드') ?? squads[0] ?? null;
    return { corp: os.find((o) => o.type === 'corp') ?? null, squad };
  };
  const dexCard = (r, who, corp) => el('button', { type: 'button', class: ['pm-dex-card', r.id === who ? 'is-sel' : ''], dataset: { id: r.id }, title: r.name },
    face(r.id, 56, 'pm-dex-face'),
    el('span', { class: 'pm-dex-name' }, r.name),
    corp ? ui.orgMarks([corp], { size: 14, bare: true, class: 'pm-dex-corp' }) : null);
  const renderDex = () => {
    if (!isDex()) return;
    const who = whoId();
    const blocks = new Map(); // 스쿼드 → { squad, corps, members }
    const corpOnly = new Map(); // 기업 → 멤버(스쿼드가 안 드러남)
    const corps = new Map();
    const none = [];
    for (const r of rowsNow) {
      const { corp, squad } = groupOf(r.id);
      if (corp) corps.set(orgKey(corp), corp);
      if (squad) {
        const b = blocks.get(orgKey(squad)) ?? blocks.set(orgKey(squad), { squad, corps: new Map(), members: [] }).get(orgKey(squad));
        b.members.push({ r, corp });
        if (corp) b.corps.set(orgKey(corp), corp);
      } else if (corp) push(corpOnly, orgKey(corp), { r, corp: null });
      else none.push(r);
    }
    const sections = new Map([['mixed', { title: LABELS.dex.mixed, blocks: [], mixed: true }]]);
    for (const [k, corp] of [...corps].sort(([, x], [, y]) => cmpKo(x.mark ?? `~${x.name}`, y.mark ?? `~${y.name}`))) sections.set(k, { corp, blocks: [] });
    sections.set('outside', { title: LABELS.dex.outside, blocks: [] });
    for (const b of blocks.values()) sections.get(b.corps.size === 1 ? [...b.corps.keys()][0] : b.corps.size ? 'mixed' : 'outside').blocks.push(b);
    for (const [k, members] of corpOnly) sections.get(k).blocks.push({ squad: null, members });
    const out = [];
    for (const s of sections.values()) {
      if (!s.blocks.length) continue;
      out.push(el('section', { class: 'pm-dex-sec' },
        el('h3', { class: 'pm-dex-head' }, s.corp ? ui.orgMarks([s.corp], { size: 20 }) : s.title),
        el('div', { class: 'pm-dex-blocks' }, s.blocks.map((b) => el('div', { class: 'pm-dex-block' },
          el('div', { class: 'pm-dex-bhead' }, b.squad ? ui.orgMarks([b.squad], { size: 16 }) : el('span', { class: 'pm-dex-other' }, LABELS.dex.other)),
          el('div', { class: 'pm-dex-grid' }, b.members.map(({ r, corp }) => dexCard(r, who, s.mixed ? corp : null))))))));
    }
    if (none.length) {
      const withFace = none.filter((r) => fmt.iconAt(idx.targets.get(r.id), V.T));
      const noFace = none.filter((r) => !fmt.iconAt(idx.targets.get(r.id), V.T));
      out.push(el('section', { class: 'pm-dex-sec' }, el('h3', { class: 'pm-dex-head' }, LABELS.dex.none),
        withFace.length ? el('div', { class: 'pm-dex-grid' }, withFace.map((r) => dexCard(r, who))) : null,
        noFace.length ? el('p', { class: 'pm-dex-names' }, noFace.map((r, i) => [i ? el('span', { class: 'pm-sep', 'aria-hidden': 'true' }, '·') : null, el('button', { type: 'button', class: ['link-btn pm-dex-card is-name', r.id === who ? 'is-sel' : ''], dataset: { id: r.id } }, r.name)])) : null));
    }
    dexBox.replaceChildren(...out);
    if (!out.length) dexBox.append(ui.empty(hiddenPersons ? LABELS.noneCut : LABELS.none));
  };
  dexBox.addEventListener('click', (e) => {
    const it = e.target.closest('.pm-dex-card');
    if (it) selectPerson(it.dataset.id);
  });


  // ── 상세: 접는 칸 ──
  let foldPref = {};
  try { foldPref = JSON.parse(lsGet(FOLD_KEY) ?? '{}') ?? {}; } catch { foldPref = {}; }
  const isOpen = (key) => foldPref[key] ?? !CLOSED_BY_DEFAULT.includes(key);
  const tokens = {};
  const sections = [];
  /** has(p, a) — 든 것이 없으면 칸을 숨긴다. count(p, a) — 칸 머리 오른쪽 글자(등장 · 함께 나온 인물만) */
  const makeSection = (key, title, render, { count = null, has = null } = {}) => {
    const countEl = el('span', { class: 'pm-count' });
    const bodyEl = el('div', { class: 'pm-sec-body' });
    const det = ui.details(el('span', { class: 'pm-sec-sum' }, el('span', { class: 'pm-sec-title' }, title), countEl), bodyEl, { open: isOpen(key), class: `pm-sec pm-sec-${key}` });
    const sec = { key, det, body: bodyEl, countEl, render, count, has, dirty: true };
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
  /** 누르면 그 기록(리더가 장면을 보인다)으로 가는 줄 */
  const recRow = (cls, sel, ...kids) => el('li', { class: cls, dataset: { sel }, tabindex: 0, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel }); },
    onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); state.set({ sel }); } } }, ...kids);
  const guess = (r) => (r.confidence === '추정' ? ui.chip('confidence', '추정') : null);

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

  // ── 상세 머리: 얼굴 · 이름 · 소속 · 다른 이름 · 처음 등장 ──
  const head = el('div', { class: 'pm-head' });
  const recById = (id) => recs()?.get(id) ?? null;
  let recsError = false;
  let disposed = false;
  const recsPending = () => (recsError ? ui.notice(LABELS.pendingFail, 'warn') : ui.spinner(LABELS.pending));
  const renderHead = () => {
    ui.clear(head);
    const p = P.get(whoId());
    const a = agg.get(p.id);
    const tg = idx.targets.get(p.id);
    const facts = [];
    if (a.visible) {
      const aliases = fmt.aliasesAt(tg, V.R).map((x) => x.name); // 그 자리에서 아는 다른 이름만(W15b)
      if (aliases.length) facts.push(el('div', { class: 'pm-fact' }, el('span', { class: 'pm-fact-l' }, LABELS.alias), el('span', {}, aliases.join(' · '))));
      // 같은 인물(정체 연결)은 밝혀지는 단위를 읽었을 때만 — 안 읽었으면 있다는 것 자체를 보이지 않는다
      const same = fmt.sameAsKnown(p, V.R);
      if (same.length) facts.push(el('div', { class: 'pm-fact' }, el('span', { class: 'pm-fact-l' }, LABELS.same), el('span', {}, same.map((s, i) => [i ? ' · ' : null, P.has(s) ? personLink(s) : ui.link(`person:${s}`, fmt.targetName(s))]))));
      if (a.firstUnit) {
        const q = quietOf(a.firstEntry);
        facts.push(el('div', { class: 'pm-fact' }, el('span', { class: 'pm-fact-l' }, LABELS.first), storyRef(a.firstUnit),
          q ? el('span', { class: 'pm-kind pm-quiet', title: LABELS.quietHelp[q] }, LABELS.quiet[q]) : null));
      }
    }
    // 아직 이름이 안 나온 인물(주소로 골랐을 때) — 이름 · 초상 · 소속 대신 안내만(W15b)
    const named = a.met;
    head.append(el('div', { class: 'pm-title' },
      named ? face(p.id, 72, 'pm-title-pic') : el('span', { class: ['pm-noface', 'pm-title-pic'], style: { width: '72px', height: '72px', fontSize: '29px' }, 'aria-hidden': 'true' }, '?'),
      el('div', { class: 'pm-title-main' },
        el('div', { class: 'pm-title-name' }, el('h3', {}, named ? nameOf(p.id) : LABELS.notYetName), named && p.kind && p.kind !== '인물' ? el('span', { class: 'pm-kind' }, p.kind) : null),
        named ? ui.orgMarks(fmt.orgsAt(tg, V.T, { past: true }), { size: 18, class: 'pm-title-orgs' }) : null,
        facts.length ? el('div', { class: 'pm-facts' }, facts) : null)));
    if (!a.visible) head.append(ui.notice(`${LABELS.notYet} ${LABELS.notYetHelp}`, 'info'));
  };

  // ── 칸마다 쓰는 고르기(칸을 숨길지와 그림이 같은 것을 본다) ──
  /** 이 인물을 다룬 확정 기록 중 여기까지 읽음 안인 것(기록이 오기 전에는 null) */
  const mineRecs = (p) => {
    const R = recs();
    if (!R) return null;
    return (D.get(p.id)?.records ?? []).map((id) => R.get(id)).filter((r) => r && !recHidden(r));
  };
  const visibleChanges = (p) => (D.get(p.id)?.changes ?? []).filter((c) => !hidden(c.unit));
  const partnerRows = (p, pm) => {
    const incl = prm('common') === '1';
    const all = (pm.partnersOf.get(p.id) ?? [])
      .filter(({ pair }) => !pair.same_as)
      .map(({ o, pair }) => ({ id: o, po: P.get(o), st: pairStat(pair), pair }))
      .filter((x) => x.po && x.st.scenes > 0 && agg.get(x.id)?.met)
      .sort((x, y) => y.st.scenes - x.st.scenes || y.st.talk - x.st.talk || cmpKo(nameOf(x.id), nameOf(y.id)));
    const present = new Set(all.filter((x) => x.po.common).map((x) => x.id));
    return { all, list: incl ? all : all.filter((x) => !x.po.common), commons: commonIds.filter((id) => present.has(id)), incl };
  };
  const threadRows = (p, mine) => {
    const map = new Map();
    const slot = (j) => map.get(j) ?? map.set(j, { n: 0, open: 0 }).get(j);
    for (const r of mine) {
      for (const j of r.threads ?? []) {
        const s_ = slot(j);
        if (r.kind === 'Q' || r.kind === 'F' || r.kind === 'E') s_.n++;
        if (r.kind === 'Q' && fmt.stateAt(r, V.R) === '열림') s_.open++;
      }
    }
    for (const j of idx.threadList) if ((j.about?.includes(p.id) || j.owners?.includes(p.id)) && !map.has(j.id) && !hidden(j.first_unit)) slot(j.id);
    const rank = { 뼈대: 0, 보강: 1, 독립: 2 };
    return [...map.entries()].map(([id, s_]) => ({ id, s: s_, j: idx.threads.get(id) })).filter((x) => x.j && !hidden(x.j.first_unit))
      .sort((x, y) => (rank[x.j.weight] ?? 3) - (rank[y.j.weight] ?? 3) || (y.j.owners?.includes(p.id) ? 1 : 0) - (x.j.owners?.includes(p.id) ? 1 : 0) || y.s.n - x.s.n);
  };
  const recGroups = (mine) => {
    const by = { q: mine.filter((r) => r.kind === 'Q'), f: mine.filter((r) => r.kind === 'F'), k: mine.filter((r) => r.kind === 'F-k' || r.kind === 'Q-k'), e: mine.filter((r) => r.kind === 'E') };
    for (const k of Object.keys(by)) by[k].sort((x, y) => (x.order ?? 0) - (y.order ?? 0) || String(x.id).localeCompare(String(y.id), 'en', { numeric: true }));
    return by;
  };
  const closures = (mine) => ({
    os: mine.filter((r) => r.kind === 'O').sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
    hs: mine.filter((r) => r.kind === 'H').sort((x, y) => (x.order ?? 0) - (y.order ?? 0)),
  });

  // ── 칸 1: 등장 — 히트맵(흐름) + 나온 스토리 제목 목록 ──
  // 목록은 종류마다 묶어 제목을 늘어놓는다. 많으면 종류마다 앞 몇 개만(정렬 기준대로) 보이고 [더 보기]로 편다.
  const usLimit = new Map();
  const usFirst = (k, n) => (n <= (k === 'main' ? 36 : 20) ? n : k === 'main' ? 24 : 12);
  const usSeg = ui.segmented({ label: LABELS.usLabel, options: [{ value: 'order', label: LABELS.us.order }, { value: 'speak', label: LABELS.us.speak }], value: prm('us') === 'speak' ? 'speak' : 'order', onChange: (v) => state.setParam('persons', 'us', v === 'speak' ? 'speak' : null) });
  const storyRows = (p) => (D.get(p.id)?.units ?? []).filter((e) => !hidden(e.unit) && idx.units.has(e.unit));
  /** 등장 칸 아래의 제목 목록 — 히트맵과 같은 등장을 종류마다 글로 늘어놓는다(앞 점 = 말한 양) */
  const storyList = (p, box) => {
    const rows = storyRows(p);
    if (!rows.length) return;
    const bySpeak = prm('us') === 'speak';
    const byKind = new Map();
    for (const e of rows) push(byKind, idx.units.get(e.unit).kind, e);
    const ord = (e) => idx.units.get(e.unit).order ?? 0;
    box.append(el('div', { class: 'toolbar pm-sectools pm-us-tools' }, usSeg.el));
    for (const k of [...fmt.KIND_ORDER, ...[...byKind.keys()].filter((x) => !fmt.KIND_ORDER.includes(x))]) {
      const list = byKind.get(k);
      if (!list) continue;
      list.sort(bySpeak ? (x, y) => (y.speaker ?? 0) - (x.speaker ?? 0) || y.lines - x.lines || ord(x) - ord(y) : (x, y) => ord(x) - ord(y));
      const first = usFirst(k, list.length);
      const limit = usLimit.get(k) ?? first;
      const ul = el('ul', { class: `pm-us-list${k === 'main' ? ' is-main' : ''}` });
      for (const e of list.slice(0, limit)) {
        const u = idx.units.get(e.unit);
        const b = bucketOf(e.speaker ?? 0);
        ul.append(el('li', { class: ['pm-us-item', b ? '' : 'is-name'], dataset: { sel: `unit:${e.unit}` }, title: u.title },
          el('i', { class: `pm-sw ${b ? `pm-b${b}` : 'pm-name'}`, 'aria-hidden': 'true' }), ui.link(`unit:${e.unit}`, k === 'main' ? chTitle(u.title) : u.title)));
      }
      const grp = el('div', { class: 'pm-us-group' }, el('div', { class: 'pm-us-head', title: fmt.help('kind', k) }, fmt.KIND[k]?.label ?? k), ul);
      if (list.length > limit) grp.append(showMore(list.length - limit, () => { usLimit.set(k, list.length); paintSection(secHeat); }));
      else if (limit > first) grp.append(el('button', { type: 'button', class: 'btn pm-more', onClick: () => { usLimit.delete(k); paintSection(secHeat); } }, LABELS.usFold));
      box.append(grp);
    }
  };
  /** 말한 양 범례 — 숫자 없이 옅음 → 진함 띠 + 이름만 나옴 */
  const ramp = () => el('div', { class: 'pm-ramp' },
    el('span', {}, LABELS.ramp.few),
    el('span', { class: 'pm-ramp-bar', 'aria-hidden': 'true' }, BUCKETS.map((_, i) => el('i', { class: `pm-sw pm-b${i + 1}` }))),
    el('span', {}, LABELS.ramp.many),
    el('span', { class: 'pm-ramp-name' }, el('i', { class: 'pm-sw pm-name', 'aria-hidden': 'true' }), LABELS.nameOnly));

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
    const svg = sv('svg', { class: 'pm-heat', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${nameOf(p.id)} ${LABELS.sec.heat}: ${LABELS.stories(fmt.num(a.units))}` });
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
      const before = state.visible(u.tick, V.T);
      if (before) maxVis = Math.max(maxVis, u.order);
      const x = xOf(u.order); const y = rowY(u.kind);
      if (y == null || Number.isNaN(y)) continue;
      const w = Math.max(cw - 0.25, 0.9);
      if (hidden(u.key)) { if (before) skip += `M${x.toFixed(2)} ${y}h${w.toFixed(2)}v${RH}h${(-w).toFixed(2)}z`; continue; }
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
        const b = bucketOf(c.e.speaker ?? 0);
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
      const q = quietOf(c.e);
      return [el('div', { class: 'pm-tip-title' }, c.u.title), el('div', {}, [fmt.KIND[c.u.kind].label, q ? LABELS.quiet[q] : null].filter(Boolean).join(' · '))];
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
    sec.body.append(el('div', { class: 'pm-heat-frame' }, svg), ramp());
    storyList(p, sec.body);
  }, { count: (p, a) => LABELS.stories(fmt.num(a.units)), has: (p, a) => a.units > 0 });

  // ── 칸 2: 함께 나온 인물 ──
  const netSeg = ui.segmented({ label: LABELS.viewLabel, options: [{ value: 'list', label: LABELS.net.list }, { value: 'graph', label: LABELS.net.graph }], value: prm('net') === 'graph' ? 'graph' : 'list', onChange: (v) => state.setParam('persons', 'net', v === 'graph' ? 'graph' : null) });
  const commonToggle = ui.toggle({ label: '', checked: prm('common') === '1', onChange: (v) => state.setParam('persons', 'common', v ? '1' : null) });
  let partnerLimit = PAGE + 4;
  const secPartners = makeSection('partners', LABELS.sec.partners, async (p, a, sec, tk) => {
    ui.clear(sec.body);
    sec.body.append(ui.spinner());
    let pm;
    try { pm = await pairsIndex(); } catch (err) { if (!stale(sec, tk)) { ui.clear(sec.body); sec.body.append(ui.notice(err.message, 'error')); } return; }
    if (stale(sec, tk)) return;
    const { list, commons } = partnerRows(p, pm);
    ui.clear(sec.body);
    // 어디에나 나와서 기본으로 빼는 인물 — 설명 대신 토글 글자에 이름을 적는다
    commonToggle.querySelector('.toggle-label').textContent = LABELS.commonIncl(commons.map((id) => nameOf(id)).join(' · '));
    sec.body.append(el('div', { class: 'toolbar pm-sectools' }, netSeg.el, commons.length ? commonToggle : null));
    if (!list.length) { sec.body.append(ui.empty(LABELS.withNone)); return; }
    const mode = prm('net') === 'graph' ? 'graph' : 'list';
    if (mode === 'graph') drawGraph(sec, p, list, pm);
    else drawPartnerList(sec, list);
  }, { count: (p) => (pmCache ? LABELS.people(fmt.num(partnerRows(p, pmCache).list.length)) : ''), has: (p, a) => a.units > 0 });
  const drawPartnerList = (sec, list) => {
    const max = list[0].st.scenes;
    const ul = el('ul', { class: 'pm-partners' });
    for (const x of list.slice(0, partnerLimit)) {
      ul.append(el('li', { class: 'pm-partner' },
        el('span', { class: 'pm-partner-name' }, ui.portrait(fmt.iconAt(idx.targets.get(x.id), V.T), { size: 22, class: 'pm-partner-pic' }) ?? el('span', { class: 'pm-partner-pic' }), personLink(x.id)),
        el('span', { class: 'pm-bar-track', 'aria-hidden': 'true' },
          el('span', { class: 'pm-bar-fill', style: { width: `${(x.st.scenes / max) * 100}%` } }, el('span', { class: 'pm-bar-talk', style: { width: `${x.st.scenes ? (x.st.talk / x.st.scenes) * 100 : 0}%` } })))));
    }
    sec.body.append(ul);
    if (list.length > partnerLimit) sec.body.append(showMore(list.length - partnerLimit, () => { partnerLimit += 20; paintSection(sec); }));
    sec.body.append(ui.legend([{ label: LABELS.together, color: 'var(--pm-3)' }, { label: LABELS.talk, color: 'var(--pm-5)' }]));
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
    const svg = sv('svg', { class: 'pm-graph', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': `${nameOf(p.id)} ${LABELS.sec.partners} ${LABELS.net.graph}` });
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
      const g = sv('g', { class: 'pm-node', tabindex: 0, role: 'button', 'aria-label': nameOf(A.x.id), 'data-id': A.x.id },
        sv('circle', { class: 'pm-node-hit', cx: A.px, cy: A.py, r: Math.max(A.r + 6, 14) }),
        sv('circle', { class: 'pm-node-dot', cx: A.px, cy: A.py, r: A.r }),
        sv('text', { class: 'pm-node-label', x: lx, y: ly, 'text-anchor': anchor, 'dominant-baseline': sinA > 0.55 ? 'hanging' : sinA < -0.55 ? 'auto' : 'central' }, clip(nameOf(A.x.id), compact ? 5 : 8)));
      ui.tooltip(g, nameOf(A.x.id));
      const go = () => selectPerson(A.x.id);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      g.addEventListener('mouseenter', () => svg.classList.add('has-hot') || svg.querySelectorAll(`[data-a="${CSS.escape(A.x.id)}"],[data-b="${CSS.escape(A.x.id)}"]`).forEach((n_) => n_.classList.add('is-hot')) || g.classList.add('is-hot'));
      g.addEventListener('mouseleave', () => { svg.classList.remove('has-hot'); svg.querySelectorAll('.is-hot').forEach((n_) => n_.classList.remove('is-hot')); });
      gN.append(g);
    }
    const cw_ = Math.max(36, [...nameOf(p.id)].length * 14 + 16);
    gN.append(sv('circle', { class: 'pm-center', cx, cy, r: 14 }), sv('rect', { class: 'pm-center-pill', x: cx - cw_ / 2, y: cy + 18, width: cw_, height: 22, rx: 11 }),
      sv('text', { class: 'pm-center-label', x: cx, y: cy + 29, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, nameOf(p.id)));
    svg.append(gN);
    sec.body.append(el('div', { class: 'pm-graph-frame' }, svg));
  };

  // ── 칸 3: 변화 — 그림 + 스토리(챕터)마다 묶은 목록 ──
  const chgSeg = ui.segmented({ label: LABELS.chgOrder, options: [{ value: 'story', label: LABELS.chg.story }, { value: 'release', label: LABELS.chg.release }], value: prm('chg') === 'release' ? 'release' : 'story', onChange: (v) => state.setParam('persons', 'chg', v === 'release' ? 'release' : null) });
  let chgLimit = 15;
  const closureOf = (d) => {
    const R = recs();
    const ends = new Map();
    if (!R) return ends;
    for (const id of d.records) {
      const r = R.get(id);
      if (r?.kind !== 'O' || recHidden(r)) continue;
      for (const c of r.closing ?? []) ends.set(c, r);
    }
    return ends;
  };
  const changeBody = (c, r) => {
    if (!r) return null;
    return c.act === '변화' ? `${fmt.prose(r.before) || '?'} → ${fmt.prose(r.after) || '?'}` : fmt.prose(r.text);
  };
  const withLink = (c) => (c.with ? (P.has(c.with) ? personLink(c.with) : ui.link(`target:${c.with}`, fmt.targetName(c.with))) : null);
  const secChanges = makeSection('changes', LABELS.sec.changes, (p, a, sec) => {
    ui.clear(sec.body);
    const d = D.get(p.id);
    const vis = visibleChanges(p);
    if (!vis.length) return;
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
    const svg = sv('svg', { class: 'pm-chg', width: SW, height: H, viewBox: `0 0 ${SW} ${H}`, role: 'img', 'aria-label': `${nameOf(p.id)} ${LABELS.sec.changes}` });
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
    const key = (w, h, kids, label) => el('span', { class: 'pm-key' }, sv('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' }, kids), ` ${label}`);
    sec.body.append(el('div', { class: 'pm-chg-frame' }, svg),
      el('div', { class: 'pm-legend2 muted' },
        key(14, 14, sv('circle', { cx: 7, cy: 7, r: 4.5, class: 'pm-key-change' }), LABELS.chgLegend.change),
        key(14, 14, sv('circle', { cx: 7, cy: 7, r: 4.5, class: 'pm-key-base' }), LABELS.chgLegend.base),
        list.some((c) => c.inverted?.length) ? key(18, 18, [sv('circle', { cx: 9, cy: 9, r: 7.5, class: 'pm-key-inv' }), sv('circle', { cx: 9, cy: 9, r: 4.5, class: 'pm-key-change' })], T_INV) : null,
        ends.size ? key(14, 16, sv('path', { class: 'pm-key-flag', d: 'M3 15V2l8 3.4L3 8.8' }), LABELS.chgLegend.end) : null));

    // 목록 — 같은 차례를 스토리(챕터)마다 묶는다. 작중 순에서 때를 모르는 변화는 맨 뒤에 따로
    const box = el('div', { class: 'pm-changes' });
    let rowsEl = null;
    let curUnit = null;
    list.slice(0, chgLimit).forEach((c, i) => {
      if (i === unplacedAt) { box.append(el('div', { class: 'pm-chg-gap' }, LABELS.unplaced)); curUnit = null; }
      if (c.unit !== curUnit) {
        curUnit = c.unit;
        rowsEl = el('ul', { class: 'pm-chg-rows' });
        box.append(el('div', { class: 'pm-chg-group' }, el('div', { class: 'pm-chg-where' }, storyRef(c.unit)), rowsEl));
      }
      const text = changeBody(c, R?.get(c.id));
      const row = recRow(['pm-change', c.act === '변화' ? 'is-change' : 'is-base'], `record:${c.id}`,
        el('div', { class: 'pm-change-head' },
          el('span', { class: 'pm-act' }, fmt.CHANGE_ACT[c.act] ?? c.act),
          el('span', { class: 'pm-kind' }, c.aspect),
          c.with ? withLink(c) : null,
          c.inverted?.length ? el('span', { class: 'pm-tag is-inv', title: LABELS.invHelp }, T_INV) : null,
          ends.has(c.id) ? el('span', { class: 'pm-tag is-end', title: fmt.help('record', 'O') }, fmt.RECORD_KIND.O.label) : null),
        text ? el('div', { class: 'pm-change-text' }, text) : R ? null : el('div', { class: 'pm-change-text muted' }, LABELS.pending));
      row.dataset.cid = c.id;
      row.addEventListener('mouseenter', () => hotDot(c.id, true));
      row.addEventListener('mouseleave', () => hotDot(c.id, false));
      row.addEventListener('focus', () => hotDot(c.id, true));
      row.addEventListener('blur', () => hotDot(c.id, false));
      rowsEl.append(row);
    });
    sec.body.append(box);
    if (list.length > chgLimit) sec.body.append(showMore(list.length - chgLimit, () => { chgLimit += 25; paintSection(sec); }));
  }, { has: (p) => visibleChanges(p).length > 0 });
  function changeTip(c, r, endRec) {
    const bodyText = changeBody(c, r);
    return el('div', { class: 'pm-ctip' },
      el('div', { class: 'pm-tip-title' }, `${c.aspect} · ${fmt.CHANGE_ACT[c.act] ?? c.act}${c.with ? ` · ${fmt.targetName(c.with)}` : ''}`),
      bodyText ? el('div', {}, clip(bodyText, 120)) : null,
      el('div', { class: 'pm-tip-sub' }, fmt.unitTitle(c.unit)),
      c.inverted?.length ? el('div', { class: 'pm-tip-sub' }, `${T_INV} — ${LABELS.invHelp}`) : null,
      endRec ? el('div', { class: 'pm-tip-sub' }, `${fmt.RECORD_KIND.O.label} — ${clip(fmt.recordText(endRec), 60)}`) : null);
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
    const { os, hs } = closures(mine);
    if (os.length) {
      sec.body.append(el('ul', { class: 'pm-closures' }, os.map((r) => recRow('pm-closure', `record:${r.id}`,
        r.type || guess(r) ? el('div', { class: 'pm-change-head' }, r.type ? el('span', { class: 'pm-kind' }, r.type) : null, guess(r)) : null,
        el('div', { class: 'pm-change-text' }, fmt.prose(r.text)),
        el('div', { class: 'pm-change-meta' }, storyRef(r.unit))))));
    }
    if (hs.length) {
      const hl = el('ul', { class: 'pm-closures' });
      for (const h of hs) {
        const others = new Set();
        for (const oid of h.members ?? []) for (const t of R.get(oid)?.about ?? []) if (t.startsWith('person:') && t !== p.id) others.add(t);
        hl.append(recRow('pm-closure', `record:${h.id}`,
          el('div', { class: 'pm-change-head' }, el('strong', {}, h.title ? fmt.prose(h.title) : LABELS.togetherEnd)),
          el('div', { class: 'pm-change-text' }, fmt.prose(h.text)),
          others.size ? el('div', { class: 'pm-with' }, [...others].map((t, i) => [i ? ' · ' : null, P.has(t) ? personLink(t) : ui.link(`person:${t}`, fmt.targetName(t))])) : null,
          el('div', { class: 'pm-change-meta' }, storyRef(h.unit))));
      }
      sec.body.append(os.length ? el('h4', { class: 'pm-subhead' }, LABELS.togetherEnd) : null, hl);
    }
  }, { has: (p) => { const m = mineRecs(p); if (!m) return true; const { os, hs } = closures(m); return os.length + hs.length > 0; } });

  // ── 칸 5: 사실 · 의문 ──
  const FQ = ['q', 'f', 'k', 'e'];
  const fqLimit = { q: PAGE, f: PAGE, k: PAGE, e: PAGE };
  const secRecords = makeSection('records', LABELS.sec.records, (p, a, sec) => {
    ui.clear(sec.body);
    const mine = mineRecs(p);
    if (!mine) { sec.body.append(recsPending()); return; }
    const by = recGroups(mine);
    const tabs = FQ.filter((k) => by[k].length); // 든 것이 있는 탭만
    if (!tabs.length) return;
    const tab = tabs.includes(prm('fq')) ? prm('fq') : tabs[0];
    if (tabs.length > 1) {
      const seg = ui.segmented({ label: LABELS.sec.records, options: tabs.map((k) => ({ value: k, label: LABELS.fq[k] })), value: tab, onChange: (v) => state.setParam('persons', 'fq', v === 'q' ? null : v) });
      sec.body.append(el('div', { class: 'toolbar pm-sectools' }, seg.el));
    }
    const list = by[tab];
    const row = (r) => {
      const st = r.kind === 'Q' || r.kind === 'F' ? fmt.stateAt(r, V.R) : null;
      const showState = st && tab !== 'q' && (r.kind === 'Q' || st === '뒤집힘' || st === '암시만');
      const label = tab === 'k' || tab === 'e' ? (r.kind === 'E' ? fmt.ACT[r.act] ?? fmt.RECORD_KIND.E.label : fmt.recordLabel(r)) : null;
      return recRow(['pm-rec', st === '열림' ? 'is-open' : ''], `record:${r.id}`,
        el('div', { class: 'pm-rec-text' }, showState ? [ui.chip('state', st), ' '] : null, label ? [el('span', { class: 'pm-act' }, label), ' '] : null, fmt.recordText(r)),
        el('div', { class: 'pm-rec-meta' }, storyRef(r.unit), guess(r)));
    };
    const limit = fqLimit[tab];
    const ul = el('ul', { class: 'pm-recs' });
    if (tab === 'q') {
      // 상태별로 묶는다 — 미해결이 맨 위. 정렬이 상태 묶음 먼저라 보이는 몫도 상태순으로 고른다
      const order = ['열림', '일부', '풀림', '암시만'];
      const sorted = [...list].sort((x, y) => order.indexOf(fmt.stateAt(x, V.R)) - order.indexOf(fmt.stateAt(y, V.R)) || (x.order ?? 0) - (y.order ?? 0));
      const g2 = new Map(order.map((s) => [s, []]));
      for (const r of sorted.slice(0, limit)) (g2.get(fmt.stateAt(r, V.R)) ?? g2.get('암시만')).push(r);
      for (const [s, rs] of g2) {
        if (!rs.length) continue;
        ul.append(el('li', { class: 'pm-group' }, fmt.STATE[s]?.label ?? s));
        for (const r of rs) ul.append(row(r));
      }
      sec.body.append(ul);
      if (sorted.length > limit) sec.body.append(showMore(sorted.length - limit, () => { fqLimit[tab] += 15; paintSection(sec); }));
      return;
    }
    for (const r of list.slice(0, limit)) ul.append(row(r));
    sec.body.append(ul);
    if (list.length > limit) sec.body.append(showMore(list.length - limit, () => { fqLimit[tab] += 15; paintSection(sec); }));
  }, { has: (p) => { const m = mineRecs(p); if (!m) return true; const by = recGroups(m); return FQ.some((k) => by[k].length); } });

  // ── 칸 6: 떡밥 ──
  const secThreads = makeSection('threads', LABELS.sec.threads, (p, a, sec) => {
    ui.clear(sec.body);
    const mine = mineRecs(p);
    if (!mine) { sec.body.append(recsPending()); return; }
    const ul = el('ul', { class: 'pm-threads' });
    for (const { id, s, j } of threadRows(p, mine)) {
      const major = fmt.majorThread(j);
      ul.append(el('li', { class: 'pm-thread', dataset: { sel: `thread:${id}` }, onClick: (e) => { if (!e.target.closest('a')) state.set({ sel: `thread:${id}` }); } },
        el('div', { class: 'pm-thread-head' }, ui.link(`thread:${id}`, j.title),
          major ? el('span', { class: 'pm-kind', title: fmt.help('weight', j.weight) }, major) : null,
          j.owners?.includes(p.id) ? el('span', { class: 'pm-kind', title: LABELS.leadTag }, T_LEAD) : null,
          s.open ? el('span', { class: 'pm-open' }, el('i', { class: 'pm-dot-open', 'aria-hidden': 'true' }), OPEN) : null)));
    }
    sec.body.append(ul);
  }, { has: (p) => { const m = mineRecs(p); return !m || threadRows(p, m).length > 0; } });

  // ── 상세 조립 ──
  detail.append(head, ...sections.map((s) => s.det));
  const renderDetail = () => {
    renderHead();
    const p = P.get(whoId());
    const a = agg.get(p.id);
    for (const k of Object.keys(fqLimit)) fqLimit[k] = PAGE;
    partnerLimit = PAGE + 4;
    usLimit.clear();
    chgLimit = 15;
    for (const sec of sections) {
      sec.det.hidden = !a?.visible || (sec.has && !sec.has(p, a));
      if (!sec.det.hidden) { sec.dirty = true; paintSection(sec); }
    }
  };

  // ── 표시 전환 ──
  const renderViewMode = () => {
    const dex = isDex();
    body.hidden = dex;
    dexBox.hidden = !dex;
    modeSeg.set(dex ? 'dex' : 'person');
    kindSeg.set(prm('kind') ?? 'all');
    leadToggle.set(prm('lead') === '1');
    if (find.value !== (prm('find') ?? '') && document.activeElement !== find) find.value = prm('find') ?? '';
  };
  const pickLabel = () => pickBtn.replaceChildren(el('span', { class: 'pm-pick-label muted' }, LABELS.pick), el('strong', {}, P.get(whoId())?.name ?? ''), el('span', { class: 'pm-pick-chev', 'aria-hidden': 'true' }, '▾'));
  const renderRows = () => {
    const sort = buildRows();
    renderList(sort);
    renderDex();
    pickLabel();
  };
  const markSel = () => {
    const sel = state.get().sel;
    for (const n of root.querySelectorAll('[data-sel]')) n.classList.toggle('is-picked', n.dataset.sel === sel);
  };
  const renderAll = () => {
    recompute();
    renderViewMode();
    renderRows();
    renderDetail();
    markSel();
  };

  // ── 상태 구독 ──
  let prevP = { ...state.get().p };
  let prevSel = state.get().sel;
  const off = state.subscribe((s, changed) => {
    if (s.tab !== 'persons') return;
    if (changed.has('t')) { renderAll(); prevP = { ...s.p }; return; }
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
      if (diff('view') || diff('find') || diff('kind') || diff('lead') || diff('sort')) { renderViewMode(); renderRows(); }
      if (diff('who')) {
        renderViewMode(); markListSel(); scrollSelIntoView(); pickLabel();
        renderDetail(); rerender = true;
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
    rz = setTimeout(() => { if (agg.get(whoId())?.visible) for (const s of [secHeat, secChanges]) if (!s.det.hidden) paintSection(s); if (prm('net') === 'graph' && !secPartners.det.hidden) paintSection(secPartners); }, 140);
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
