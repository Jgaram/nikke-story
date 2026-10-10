/**
 * 탭 5 연대기(W6) — 화면 6 "작중 연대기"(docs/views.md 6절, 규칙 tools/views/chrono-order.mjs · chrono.mjs 머리말).
 * 스토리를 작중에서 일어난 순서로 늘어놓는다. 작중 때를 모르는 스토리는 억지로 끼우지 않고 아래에 따로 둔다.
 *
 * 쓰는 JSON
 *   blurbs.json(팬용 문장 — 카드의 추정한 이유, 못 받으면 판정 문장)
 *   chrono.json(이 탭 — tools/site/export/chrono.mjs): points[57](작중 축의 점 — 시대 기준점 8 + 메인 챕터 49, pos = 2i+1) · units[481](작중 자리 class · lo · hi · via · records · relations · narrow ·
 *     drift · drift_gap · seq · slot · parallel) · pieces[109](회상 장면 · 다른 때 장면) · narrows[366](좁힘 근거 — at · basis · reason · confidence)
 *   공용(idx): units.json(제목 · 종류 · 출시 시점 tick)  ticks.json(출시 시점 라벨)  records(카드의 장면 글 — 없으면 받은 뒤 카드를 다시 그린다)
 *   자리 번호(slot): 점 i = 2i+1, 점 사이 칸 = 2i, 첫 점 앞 = 0, 마지막 점 뒤 = 2P → 칸 115개를 같은 폭으로 그린다. lo · hi가 없으면 그쪽 끝을 모르는 범위(열린 끝).
 *
 * URL 파라미터(p.*)
 *   view   list(목록, 기본) | band(띠 그림)
 *   by     kind이면 띠 그림 줄을 종류별로 묶는다(URL로만)
 *   kind   종류 필터(쉼표 — event,episode …), 없으면 전체
 *   find   제목 · 키 · 회상 장면 문장 안 낱말
 *   drift  1이면 출시순과 어긋난 것(키 과거 · 앞 · 뒤)만 — 이때만 줄마다 '출시 때 메인 · 몇 챕터 어긋났나'를 보인다
 *
 * 그리는 규칙(화면 말은 팬이 묻는 것만 — docs/views.md "화면 문구는 간결하게", W13e)
 *   목록(작중순): 칸마다 묶는다(시대 기준점 · 메인 챕터 · 그 사이). 메인 챕터 칸은 머리가 곧 그 챕터 줄(굵은 CH 표기 + 이름, 누르면 챕터)이라
 *     메인 줄을 따로 두지 않는다 — 챕터를 안 봤거나 걸렀으면 머리는 'CH.30'만. 시대 칸 머리는 이름 + '약 N년 전'.
 *     판별은 제자리, 범위는 앞 끝 칸(앞 끝을 모르면 뒤 끝 칸), 회상 장면은 따로 한 줄(한 스토리가 두 자리에).
 *     줄 = 제목 + 회색 작은 글자(종류 · 회상 · 칸 하나가 아닐 때만 자리 — 양 끝을 알면 칸 머리가 앞 끝이라 '~ CH.24 전', 한쪽만 알면 'CH.13 뒤' · 'CH.24 전'). 칸 · 줄에 개수 · 출시 날짜 · 확정 정도는 싣지 않는다(날짜는 리더).
 *     출시순과 비교는 drift=1일 때만 줄에 'CH.12 때 출시 · 3챕터 앞'(색 없이 글자). 같은 때 · 걸침은 화면에 내지 않는다(예외만).
 *     "여기까지 읽음" 선(자리 표시 — t의 메인 챕터로만 정한다): 컷오프 챕터 뒤 칸부터 위쪽 줄과 갈라 보인다 — 선 아래 줄은 읽은 것보다 작중으로 뒤인 이야기.
 *   띠 그림: 가로 = 작중 축, 줄 = 스토리 하나. 때가 정해짐 = 점(칸 폭이 있으면 꽉 찬 막대), 범위 = 반투명 막대(끝을 모르는 쪽은 흐려진다),
 *     회상 · 다른 때 장면 = 속 빈 표시(본체와 점선으로 이음). 색은 종류 색(--kind-*)만 — 종류 칩의 점이 그 범례, 모양 범례는 셋(이때 · 이 무렵 어딘가 · 회상 장면).
 *     축 머리: 메인 이전(시대 기준점 — 숫자 없는 눈금, 이름은 툴팁) · 메인 챕터(5 단위 숫자). 줄 순서는 작중순(계단). 툴팁 = 제목 · 종류 · 작중 때.
 *   작중 때를 모르는 스토리(키 상대 · 불명)는 목록 아래 접이식 한 칸(읽는 순서) — 줄에 다른 스토리와의 앞뒤가 있으면 그것만.
 *   컷오프: 안 본 스토리(R = state.reading(s)의 R.seen(키) — 척추 이벤트 · 사이드는 '봤음' 예외를 따르고, 예외가 없으면 출시 시점 ≤ t)는 숨긴다(가린 개수는 내지 않는다).
 *     모두 DOM을 다시 만들지 않고 hidden만 바꾼다(스크롤 · 선택 유지). 머리에 지금 보이는 편 수 · 목록이면 "읽은 자리로"(여기까지 읽음 선으로).
 *   줄을 누르면 sel=unit:키 → 리더 + 줄 바로 아래 카드: 작중 순 · 장면(시점 기록 문장 링크) · 회상 장면 · 추정한 이유(추정인 좁힘만) · 출시(어긋난 것만).
 *     추정한 이유 = blurbs.json 팬용 문장(gate를 봤으면 later까지 — 좁힘이 여럿이어도 한 덩어리), 없거나 낡았으면 좁힘마다 거른 판정 문장(whyText).
 *     근거 링크는 여기까지 읽음 뒤 스토리(기록 · 씬의 스토리, 떡밥은 처음 나온 스토리)의 것을 숨긴다.
 *     정한 방법 · 확신도 · 출시 날짜 · 기록 ID는 싣지 않는다. 같은 줄을 다시 누르면 닫는다.
 *   자유 문장(추정 이유 · 회상 장면 글)은 cprose = 시대 기준점 ID → 이름(앞손질) + fmt.prose + 모습 코드(rapi_red) · 씬 줄임(45_03) 걷기(뒷손질 — 조사가 붙어 못 걷으면 그 마디를 뺀다).
 */
export const meta = { id: 'chrono', title: '연대기', blurb: '작중 순으로 본 스토리' };

/** 화면 라벨 한 곳 — 레포 내부 용어는 여기서 사람 말로 바꾼다(나머지는 fmt) */
const LABELS = {
  viewName: '보기', view: { list: '목록', band: '띠 그림' }, jump: '읽은 자리로',
  find: '스토리 찾기', findPlaceholder: '제목 · 낱말 검색',
  driftOnly: '출시순과 어긋난 것만', driftOnlyHint: '출시 때의 메인보다 앞선 때나 뒤의 때를 그린 스토리만 — 줄마다 언제 나왔는지 함께 보인다',
  kindName: '종류', kindAll: '전체',
  count: (n) => `${n}편`,
  /** 띠 그림의 모양 범례 — [글자, 툴팁] */
  legend: {
    dot: ['이때', '작중 때가 정해진 이야기'],
    range: ['이 무렵 어딘가', '앞뒤 경계 사이 어딘가 — 흐려지는 쪽은 끝을 모른다'],
    piece: ['회상 장면', '회상 · 다른 때의 장면 — 한 스토리가 두 자리에 나온다'],
  },
  pieceTag: { 회상: '회상', other: '다른 때' },
  yearsAgo: (y) => `약 ${y}년 전`,
  zone: { era: '메인 이전', main: '메인 챕터' },
  multi: '여러 때에 걸친 이야기',
  sameTime: '같은 때', during: '동안',
  parallel: (chWa) => `${chWa} 같은 무렵`, parallelHint: '번호 순과 달리 앞 챕터와 같은 무렵에 벌어진 병행 줄거리',
  cutHint: '이 선 아래는 읽은 곳보다 작중으로 뒤의 이야기',
  emptyAll: '보이는 스토리가 없다', clearFilters: '필터 풀기',
  emptyPlaced: '작중 때를 아는 스토리가 가려졌다 — 아래 목록을 본다',
  unknown: '알 수 없음',
  loose: '작중 때를 모르는 이야기', looseHint: '단서가 없거나 다른 스토리와의 앞뒤만 안다',
  /** 출시순과 비교 — 줄(짧게) · 카드(문장). ch = 출시 때의 메인 챕터, n = 몇 챕터 */
  drift: {
    과거: (ch) => `${ch} 때 출시 · 메인 이전 이야기`,
    앞: (ch, n) => `${ch} 때 출시 · ${n}챕터 앞`,
    뒤: (ch, n) => `${ch} 때 출시 · ${n}챕터 뒤`,
  },
  driftLong: {
    과거: (ch) => `${ch} 때 나왔지만 메인 스토리가 시작되기 전의 이야기`,
    앞: (ch, n) => `${ch} 때 나왔지만 메인으로 ${n}챕터 앞선 때의 이야기`,
    뒤: (ch, n) => `${ch} 때 나왔지만 메인보다 ${n}챕터 뒤의 이야기 — 앞질러 간다`,
  },
  card: { scenes: '장면', narrow: '추정한 이유', release: '출시', close: '닫기' },
  bandHead: '스토리',
};

const clip = (s, n) => { const a = [...String(s ?? '')]; return a.length > n ? `${a.slice(0, n).join('')}…` : a.join(''); };
const chNum = (id) => `CH.${String(id).replace(/^ch/, '')}`;
const REL_WORDS = new Set(['직후', '직전', '뒤', '전', '무렵', '중', '동시']);
/** 출시순과 어긋남으로 치는 것(키) — 같은 때 · 걸침은 빼고 */
const DRIFT_STRONG = new Set(['과거', '앞', '뒤']);
/** 받침이 있으면 '과', 없으면 '와'(숫자는 읽는 소리로) */
const wa = (w) => {
  const ch = String(w).trim().at(-1) ?? '';
  const code = ch.charCodeAt(0);
  const batchim = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : /\d/.test(ch) ? '0136784'.includes(ch) : false;
  return `${w}${batchim ? '과' : '와'}`;
};
/** fmt.prose 뒤에 남는 작업 흔적 — 모습 코드(rapi_red · neon_v) · 씬 줄임(45_03) */
const CODE = /(?<![A-Za-z0-9_])(?:[a-z]+(?:_[a-z0-9]+)+|\d{2}_\d{2})(?![A-Za-z0-9_])/;
const CODE_G = new RegExp(CODE.source, 'g');
/** 추정 이유의 판정 과정 마디(상한 · 하한 · 단서 유무 · 모습 코드 말) — fmt.dropClauses로 그 마디만 뺀다. '이상한' · '수상한'은 그냥 말 */
const WHY_JUDGE = /(?<![이수앙상고])(?:상한|하한)|단서가 없|코드(?:가|를|로|는) /;

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const { el } = ui;
  const chrono = await data.load('chrono');
  // 팬용 문장(W14 — 확정되고 낡지 않은 것만) — 없으면 거른 판정 문장(whyText)
  const blurbs = new Map((await data.load('blurbs').catch(() => [])).map((x) => [x.key, x]));

  // ══ 모델 ══════════════════════════════════════════════════════════════
  const points = chrono.points;
  const P = points.length;
  const SLOTS = 2 * P + 1;
  const pointById = new Map(points.map((p) => [p.id, p]));
  const pointShort = (p) => (p.era ? p.name.replace(/\s*\(.*?\)/g, '').trim() : chNum(p.id));
  /** 칸 이름 — 점이면 점 이름, 사이면 'A–B 사이' */
  const slotName = (pos) => {
    if (pos % 2 === 1) return pointShort(points[(pos - 1) / 2]);
    if (pos <= 0) return `${pointShort(points[0])} 전`;
    if (pos >= 2 * P) return `${pointShort(points[P - 1])} 뒤`;
    return `${pointShort(points[pos / 2 - 1])}–${pointShort(points[pos / 2])} 사이`;
  };
  const loText = (lo) => (lo === 0 ? `${pointShort(points[0])} 전` : lo % 2 === 0 ? `${pointShort(points[lo / 2 - 1])} 뒤` : `${pointShort(points[(lo - 1) / 2])}부터`);
  const hiText = (hi) => (hi >= 2 * P ? `${pointShort(points[P - 1])} 뒤` : hi % 2 === 0 ? `${pointShort(points[hi / 2])} 전` : `${pointShort(points[(hi - 1) / 2])}까지`);
  /** 자리 글 — 한 칸이면 그 칸, 범위면 'A 뒤 ~ B 전', 한쪽만 알면 'A 뒤' / 'B 전' */
  const spanText = (c) => {
    if (c.lo == null && c.hi == null) return '';
    if (c.lo != null && c.lo === c.hi) return slotName(c.lo);
    if (c.lo != null && c.hi != null) return `${loText(c.lo)} ~ ${hiText(c.hi)}`;
    return c.lo != null ? loText(c.lo) : hiText(c.hi);
  };
  const isOneSlot = (c) => c.lo != null && c.lo === c.hi;

  const byKey = new Map();
  for (const c of chrono.units) {
    const u = idx.units.get(c.unit);
    if (u) byKey.set(c.unit, { ...c, u, pieces: [], narrows: [] });
  }
  for (const p of chrono.pieces) byKey.get(p.unit)?.pieces.push(p);
  for (const n of chrono.narrows) byKey.get(n.unit)?.narrows.push(n);
  const units = [...byKey.values()];
  for (const c of units) c.search = `${c.u.title} ${c.unit} ${c.pieces.map((p) => p.text ?? '').join(' ')}`.toLowerCase();
  const kindsPresent = fmt.KIND_ORDER.filter((k) => units.some((c) => c.u.kind === k));
  /** 시점 기록 ID(S169) → 그 장면(조각)이나 스토리 — 관계 글의 기준이 기록일 때 이름으로 */
  const pieceById = new Map(chrono.pieces.map((p) => [p.id, p]));
  const recUnit = new Map();
  for (const c of chrono.units) for (const id of c.records ?? []) recUnit.set(id, c.unit);

  /** 관계의 기준 → 이름: 챕터 · 시대 기준점 · 스토리(호감도는 '… 호감도') · 시점 기록(그 장면의 때, 없으면 그 스토리) */
  const refText = (ref) => {
    if (/^ch\d+$/.test(ref)) return chNum(ref);
    const p = pointById.get(ref);
    if (p) return pointShort(p);
    const piece = pieceById.get(ref);
    if (piece && (piece.lo != null || piece.hi != null)) return spanText(piece);
    const key = idx.units.has(ref) ? ref : recUnit.get(ref) ?? piece?.unit;
    const u = key ? idx.units.get(key) : null;
    return u ? `${u.title}${u.kind === 'episode' ? ` ${fmt.KIND.episode.label}` : ''}` : null;
  };
  /** 'CH.41 뒤' · 'MIRACLE SNOW와 같은 때' · 'CH.21 동안' */
  const relPhrase = (rel, ref, rest = '') => {
    const name = refText(ref);
    if (!name) return '';
    if (rel === '동시') return `${wa(name)} ${LABELS.sameTime}${rest}`;
    return `${name} ${rel === '중' ? LABELS.during : rel}${rest}`;
  };
  /** 관계 글 '뒤 ch41; 전 ch02 (5년)' → 읽는 말. '단서 없음'은 내지 않는다 */
  const relText = (str) => String(str ?? '').split('; ').filter((x) => x && x !== '단서 없음').map((part) => {
    const m = part.match(/^(\S+) (\S+)(.*)$/);
    return m && REL_WORDS.has(m[1]) ? relPhrase(m[1], m[2], m[3]) : cprose(part);
  }).filter(Boolean).join(' · ');
  const atText = (at) => (at ?? []).map(([rel, ref, gap]) => relPhrase(rel, ref, gap ? ` (${gap})` : '')).filter(Boolean).join(' · ');
  /** 자유 문장 — 시대 기준점 ID → 이름, fmt.prose, 모습 코드 걷기(조사가 붙은 코드는 그 마디째 뺀다) */
  const whyText = (text) => fmt.dropClauses(cprose(text), WHY_JUDGE);
  function cprose(text) {
    const pre = String(text ?? '')
      .replace(/[—~]?\s*(직후|직전|뒤|전|무렵) (@[\p{L}\p{N}_]+)/gu, (m, rel, id) => (pointById.has(id) ? `${pointShort(pointById.get(id))} ${rel}` : m))
      .replace(/@[\p{L}\p{N}_]+/gu, (id) => (pointById.has(id) ? pointShort(pointById.get(id)) : id));
    const s = fmt.prose(pre).replace(/\s?\(([^()]*)\)/g, (m, inner) => {
      if (/^\s*[a-z]+\s*$/.test(inner)) return ''; // '(rapi)'
      if (!CODE.test(inner)) return m;
      const rest = inner.replace(CODE_G, '').replace(/^[\s,·—–-]+|[\s,·—–-]+$/g, '');
      return /[\p{L}\p{N}]/u.test(rest) ? `${m.startsWith(' ') ? ' ' : ''}(${rest})` : '';
    });
    if (!CODE.test(s)) return s;
    const glued = new RegExp(`${CODE.source}(?=[가-힣])`);
    const bare = new RegExp(`\\s?${CODE.source}(?=[\\s(),.]|$)`, 'g');
    return s.split(/(?<=\.)\s+/).map((sen) => {
      const kept = sen.split(/\s+—\s+/).filter((cl) => !glued.test(cl)).map((cl) => cl.replace(bare, '')).join(' — ');
      return /\.$/.test(sen) && kept && !/[.?!]$/.test(kept) ? `${kept}.` : kept;
    }).filter((x) => [...x.replace(/[^가-힣]/g, '')].length >= 6).join(' ').replace(/\s{2,}/g, ' ').trim();
  }

  // 작중순 줄 — 자리 있는 스토리의 '지금' + 회상 장면. 메인 챕터의 '지금'은 그 칸 머리가 대신한다
  const storyEntries = [];
  for (const c of units) if (c.slot != null) storyEntries.push({ type: 'unit', c, seq: c.seq, slot: c.slot });
  for (const c of units) for (const p of c.pieces) if (p.slot != null) storyEntries.push({ type: 'piece', c, p, seq: p.seq, slot: p.slot });
  storyEntries.sort((a, b) => a.seq - b.seq);
  const looseEntries = [];
  for (const c of units) if (c.slot == null) looseEntries.push({ type: 'unit', c });
  for (const c of units) for (const p of c.pieces) if (p.slot == null) looseEntries.push({ type: 'piece', c, p });
  looseEntries.sort((a, b) => a.c.u.order - b.c.u.order || (a.type === 'piece') - (b.type === 'piece'));
  const byStory = units.filter((c) => c.slot != null).sort((a, b) => a.seq - b.seq);

  // ══ 파라미터 · 상태 ═════════════════════════════════════════════════════
  const getP = (k) => state.param(meta.id, k);
  const setP = (k, v, opts) => state.setParam(meta.id, k, v, opts);
  const readParams = () => ({
    view: getP('view') === 'band' ? 'band' : 'list',
    by: getP('by') === 'kind' ? 'kind' : 'none',
    kinds: new Set((getP('kind') ?? '').split(',').filter((k) => kindsPresent.includes(k))),
    find: (getP('find') ?? '').trim(),
    drift: getP('drift') === '1',
  });
  let cur = readParams();
  const unitFromSel = (sel) => { const p = state.parseSel(sel); return p?.type === 'unit' && byKey.has(p.id) ? p.id : null; };
  let activeKey = unitFromSel(state.get().sel);
  let lastRow = null;
  let ownClick = false;
  let visVersion = 0;
  let vis = new Map();
  let counts = { shown: 0, cut: 0, filter: 0 };
  let cutSlot = null;
  let cutCh = null;
  let alive = true;
  /** 누를 수 있는 줄 — 목록 줄 · 띠 그림 줄 · 메인 챕터 칸 머리(챕터가 보일 때만 data-key) */
  const ROW_SEL = '.cr-row, .cg-row, .cr-ghead[data-key]';

  // ══ 머리 · 도구 줄 ═══════════════════════════════════════════════════════
  root.append(el('div', { class: 'tab-head' }, el('h2', {}, meta.title)));
  const viewSeg = ui.segmented({ label: LABELS.viewName, options: Object.entries(LABELS.view).map(([value, label]) => ({ value, label })), value: cur.view, onChange: (v) => setP('view', v === 'list' ? null : v) });
  const findBox = el('input', { type: 'search', class: 'cr-find', placeholder: LABELS.findPlaceholder, 'aria-label': LABELS.find, value: cur.find });
  let findTimer = null;
  findBox.addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => setP('find', findBox.value.trim() || null), 200); });
  const driftToggle = ui.toggle({ label: LABELS.driftOnly, checked: cur.drift, title: LABELS.driftOnlyHint, onChange: (v) => setP('drift', v ? '1' : null) });
  root.append(el('div', { class: 'toolbar cr-bar' }, viewSeg.el, findBox, driftToggle));

  // 종류 칩 — 점 색이 띠 그림의 종류 색(범례를 겸한다)
  const kindBox = el('div', { class: 'cr-kinds', role: 'group', 'aria-label': LABELS.kindName });
  const allBtn = el('button', { type: 'button', class: 'cr-pick', onClick: () => setP('kind', null) }, LABELS.kindAll);
  const kindBtns = new Map();
  kindBox.append(allBtn);
  for (const k of kindsPresent) {
    const b = el('button', { type: 'button', class: 'cr-pick', title: fmt.help('kind', k), onClick: () => { const next = new Set(cur.kinds); if (next.has(k)) next.delete(k); else next.add(k); setP('kind', [...next].join(',') || null); } },
      el('i', { class: 'cr-pick-dot', 'aria-hidden': 'true' }), fmt.KIND[k].label);
    b.style.setProperty('--c', `var(--kind-${k})`);
    kindBtns.set(k, b);
    kindBox.append(b);
  }
  root.append(kindBox);
  const syncKinds = () => {
    allBtn.setAttribute('aria-pressed', String(cur.kinds.size === 0));
    for (const [k, b] of kindBtns) b.setAttribute('aria-pressed', String(cur.kinds.has(k)));
    root.classList.toggle('cr-drift-on', cur.drift);
  };

  const statusText = el('span', { class: 'cr-count' });
  const jumpBtn = el('button', { type: 'button', class: 'btn cr-jump', onClick: () => root.querySelector('.cr-cutline:not([hidden])')?.scrollIntoView({ block: 'center' }) }, LABELS.jump);
  root.append(el('div', { class: 'cr-status', role: 'status', 'aria-live': 'polite' }, statusText, jumpBtn));

  // ══ 줄 ═══════════════════════════════════════════════════════════════════
  const sep = () => el('span', { class: 'cr-sep', 'aria-hidden': 'true' }, '·');
  /** 회색 작은 글자 줄 — 빈 것은 뺀다. tail(출시순 비교)은 제 구분점을 안에 품어 숨으면 같이 숨는다 */
  const metaLine = (items, tail = null) => {
    const xs = items.filter(Boolean);
    return xs.length ? el('span', { class: 'cr-meta' }, xs.flatMap((x, i) => (i ? [sep(), x] : [x])), tail) : null;
  };
  /** 'CH.07 재회' → 굵은 CH 표기 + 이름 */
  const chTitle = (title) => { const m = /^(CH\.\d+)\s*(.*)$/.exec(title); return m ? [el('span', { class: 'ch' }, m[1]), m[2] ? ` ${m[2]}` : null] : title; };
  const mainChOf = (c) => (c.release_main ? chNum(c.release_main) : fmt.tickShort(c.u.tick));
  const driftShort = (c) => (DRIFT_STRONG.has(c.drift) ? LABELS.drift[c.drift](mainChOf(c), c.drift_gap) : '');
  const pieceTag = (p) => LABELS.pieceTag[p.kind] ?? LABELS.pieceTag.other;
  /** 기록 링크 — 글자는 기록 문장(줄임). ID는 화면에 내지 않는다(W13a) */
  const recLink = (id, n = 60) => { const r = idx.records?.get(id); return ui.link(`record:${id}`, r ? clip(fmt.recordText(r), n) || fmt.TERM.piece : fmt.RECORD_KIND.S?.label ?? fmt.TERM.piece); };
  /** 근거가 든 스토리 — 기록 · 씬은 그 스토리, 떡밥은 처음 나온 스토리. 모르면 null */
  const basisUnit = (b) => {
    if (/^J\d+$/.test(b)) return idx.threads.get(b)?.first_unit ?? null;
    if (/^[A-Z](-[a-z])?\d+$/.test(b)) return idx.records?.get(b)?.unit ?? null;
    const base = b.split('#')[0];
    return idx.scenes.get([base, base.replace(/^ep:/, ''), `ep:${base}`].find((x) => idx.scenes.has(x)))?.unit ?? null;
  };
  /** 근거 — 기록 · 떡밥 · 씬#줄 → 링크(글자는 기록 문장 · 떡밥 제목 · 장면 이름) */
  const basisLink = (b) => {
    if (/^J\d+$/.test(b)) return ui.link(`thread:${b}`, idx.threads.get(b)?.title ?? fmt.TERM.thread);
    if (/^[A-Z](-[a-z])?\d+$/.test(b)) return idx.records?.get(b) ? recLink(b, 40) : null;
    const base = b.split('#')[0];
    const sceneId = [base, base.replace(/^ep:/, ''), `ep:${base}`].find((x) => idx.scenes.has(x));
    return sceneId ? ui.link(`scene:${sceneId}`, fmt.ref(sceneId)) : null;
  };
  const joinNodes = (nodes, s = ' · ') => nodes.flatMap((n, i) => (i ? [s, n] : [n]));

  /** 목록 줄 — mode: story(작중순) · loose(작중 때를 모름) */
  function listRow(e, mode) {
    const { c } = e;
    const u = c.u;
    const piece = e.type === 'piece' ? e.p : null;
    const target = piece ?? c;
    let when = '';
    if (mode === 'loose') when = relText(piece ? piece.relations : (c.relations || c.narrow));
    else if (target.lo != null && target.hi != null && target.lo === e.slot && target.lo !== target.hi) when = `~ ${hiText(target.hi)}`; // 칸 머리가 앞 끝이라 뒤 끝만
    else if (!isOneSlot(target)) when = spanText(target);
    const ptext = piece ? cprose(piece.text) : '';
    return el('div', { class: ['cr-row', piece && 'is-piece'], dataset: { key: c.unit }, role: 'button', tabindex: 0 },
      el('span', { class: 'cr-line' },
        el('span', { class: 'cr-title' }, chTitle(u.title)),
        metaLine([
          el('span', {}, fmt.KIND[u.kind]?.label ?? u.kind),
          piece ? el('span', { class: 'cr-ptag' }, pieceTag(piece)) : null,
          when ? el('span', {}, when) : null,
        ], !piece && mode === 'story' && driftShort(c) ? el('span', { class: 'cr-dmeta' }, sep(), driftShort(c)) : null)),
      ptext ? el('span', { class: 'cr-ptext' }, clip(ptext, 120)) : null);
  }

  /** 띠 그림 칸의 표시 — 점 · 막대 */
  function markNode(m) {
    const openL = m.lo == null;
    const openR = m.hi == null;
    const lo = m.lo ?? 0;
    const hi = m.hi ?? SLOTS - 1;
    const dot = !openL && !openR && lo === hi && m.cls === '판별';
    const n = el('span', { class: ['cg-mark', m.piece && 'is-piece', dot ? 'is-dot' : 'is-bar', m.cls === '범위' && 'is-range', openL && 'open-l', openR && 'open-r'] });
    if (dot) n.style.left = `${((lo + 0.5) / SLOTS) * 100}%`;
    else { n.style.left = `${(lo / SLOTS) * 100}%`; n.style.width = `${((hi - lo + 1) / SLOTS) * 100}%`; }
    return n;
  }
  function marksOf(c) {
    const marks = [];
    const bodyAbsent = c.via === '회상' || c.via === '조각';
    if (c.slot != null && !bodyAbsent) marks.push({ lo: c.lo, hi: c.hi, cls: c.class, piece: false });
    for (const p of c.pieces) {
      if (p.slot == null) continue;
      if (!bodyAbsent && c.slot != null && p.lo === c.lo && p.hi === c.hi) continue;
      marks.push({ lo: p.lo, hi: p.hi, cls: p.class, piece: true });
    }
    return marks;
  }
  function bandRow(c) {
    const u = c.u;
    const row = el('div', { class: 'cg-row', dataset: { key: c.unit }, role: 'button', tabindex: 0, 'aria-label': `${u.title} · ${spanText(c)}`.replace(/ · $/, '') });
    row.style.setProperty('--c', `var(--kind-${u.kind})`);
    const plot = el('div', { class: 'cg-plot' });
    const marks = marksOf(c);
    if (marks.length > 1) {
      const centers = marks.map((m) => ((m.lo ?? 0) + (m.hi ?? SLOTS - 1) + 1) / 2);
      const a = Math.min(...centers);
      const b = Math.max(...centers);
      const link = el('span', { class: 'cg-link' });
      link.style.left = `${(a / SLOTS) * 100}%`;
      link.style.width = `${((b - a) / SLOTS) * 100}%`;
      plot.append(link);
    }
    for (const m of marks) plot.append(markNode(m));
    row.append(
      el('div', { class: 'cg-label' }, el('span', { class: 'cg-title' }, u.title), c.parallel ? el('span', { class: 'cg-par', title: LABELS.parallelHint }, '∥') : null),
      plot);
    return row;
  }

  // ══ 보기 만들기(처음 필요할 때 한 번 — 이후 hidden만 바꾼다) ═══════════════════
  const views = new Map();

  function listView() {
    const wrap = el('div', { class: 'cr-list' });
    const groups = [];
    const rows = [];
    const cutline = el('div', { class: 'cr-cutline', title: LABELS.cutHint }, el('span', {}, fmt.TERM.cutoff), el('b', { class: 'cr-cutline-ch' }));
    cutline.hidden = true;
    let g = null;
    for (const e of storyEntries) {
      if (!g || g.slot !== e.slot) {
        const point = e.slot % 2 === 1 ? points[(e.slot - 1) / 2] : null;
        const isMain = point && !point.era;
        const bodyEl = el('div', { class: 'cr-rows' });
        const h3 = el('h3', {});
        let mainName = null;
        if (isMain) {
          const mu = idx.units.get(point.id);
          const c = byKey.get(point.id);
          mainName = el('span', { class: 'cr-gname' }, String(mu?.title ?? '').replace(/^CH\.\d+\s*/, ''),
            c?.parallel ? el('span', { class: 'cr-gsub', title: LABELS.parallelHint }, LABELS.parallel(wa(chNum(c.parallel.with)))) : null);
          h3.append(el('span', { class: 'ch' }, chNum(point.id)), mainName);
        } else if (point?.era) {
          h3.append(el('span', {}, point.name), point.years ? el('span', { class: 'cr-gsub' }, LABELS.yearsAgo(point.years)) : null);
        } else h3.append(el('span', {}, slotName(e.slot)));
        const head = el('header', { class: ['cr-ghead', point?.era && 'is-era', isMain && 'is-main'] }, h3);
        g = { slot: e.slot, point, mainKey: isMain && byKey.has(point.id) ? point.id : null, mainName, head, el: el('section', { class: 'cr-group' }, head, bodyEl), body: bodyEl, rows: [] };
        groups.push(g);
        wrap.append(g.el);
      }
      if (e.type === 'unit' && e.c.unit === g.mainKey) continue; // 메인 챕터의 '지금'은 칸 머리
      const row = listRow(e, 'story');
      g.body.append(row);
      const r = { el: row, key: e.c.unit };
      g.rows.push(r);
      rows.push(r);
    }
    return { kind: 'list', el: wrap, groups, rows, cutline, applied: -1 };
  }

  function bandView(byKind) {
    const wrap = el('div', { class: 'cg' });
    const firstMain = points.findIndex((p) => !p.era);
    // 머리: 영역 이름(메인 이전 · 메인 챕터) + 시대 눈금(숫자 없이 — 이름은 툴팁) + 챕터 눈금(5 단위)
    const axisEl = el('div', { class: 'cg-axis' });
    const zone = (lo, hi, text, cls) => { const z = el('span', { class: `cg-zone ${cls}`, 'aria-hidden': 'true' }, text); z.style.left = `${(lo / SLOTS) * 100}%`; z.style.width = `${((hi - lo) / SLOTS) * 100}%`; return z; };
    const split = firstMain > 0 ? 2 * firstMain : 0;
    if (split) axisEl.append(zone(0, split, LABELS.zone.era, 'is-era'));
    axisEl.append(zone(split, SLOTS, LABELS.zone.main, 'is-main'));
    for (const p of points) {
      const x = ((p.pos + 0.5) / SLOTS) * 100;
      let t = null;
      if (p.era) t = el('span', { class: 'cg-tick is-era', title: [p.name, p.years ? LABELS.yearsAgo(p.years) : null].filter(Boolean).join(' · ') });
      else {
        const n = Number(String(p.id).replace(/^ch/, ''));
        if (n % 5 === 0) t = el('span', { class: 'cg-tick', 'aria-hidden': 'true' }, String(n).padStart(2, '0'));
      }
      if (t) { t.style.left = `${x}%`; axisEl.append(t); }
    }
    const cutEl = el('div', { class: 'cg-cut', title: LABELS.cutHint });
    const cutFlag = el('span', { class: 'cg-cutflag', title: LABELS.cutHint }, fmt.TERM.cutoff);
    cutEl.hidden = true;
    cutFlag.hidden = true;
    axisEl.append(cutFlag);
    wrap.style.setProperty('--split', `${(split / SLOTS) * 100}%`);
    const head = el('div', { class: 'cg-head' }, el('div', { class: 'cg-corner' }, LABELS.bandHead), axisEl);
    const body = el('div', { class: 'cg-body' });
    const groups = [];
    const rows = [];
    const makeGroup = (k, items) => {
      const headEl = k ? el('div', { class: 'cg-ghead' }, el('i', { class: 'cr-pick-dot', 'aria-hidden': 'true' }), fmt.KIND[k].label) : null;
      headEl?.style.setProperty('--c', `var(--kind-${k})`);
      const g = { head: headEl, rows: [] };
      if (headEl) body.append(headEl);
      for (const c of items) {
        const row = bandRow(c);
        body.append(row);
        const r = { el: row, key: c.unit };
        g.rows.push(r);
        rows.push(r);
      }
      groups.push(g);
    };
    if (byKind) for (const k of kindsPresent) makeGroup(k, byStory.filter((c) => c.u.kind === k));
    else makeGroup(null, byStory);
    // 모양 범례 셋 — 색(종류)은 위 종류 칩의 점
    const icon = (k) => el('i', { class: ['cr-ico', k === 'range' ? 'cr-ico-range' : 'cr-ico-dot', k === 'piece' && 'is-piece'], 'aria-hidden': 'true' });
    const legend = el('div', { class: 'cr-legend' }, ['dot', 'range', 'piece'].map((k) => el('span', { class: 'cr-leg', title: LABELS.legend[k][1] }, icon(k), LABELS.legend[k][0])));
    wrap.append(head, body, cutEl);
    return { kind: 'band', byKind, el: el('div', { class: 'cg-wrap' }, legend, wrap), cg: wrap, cutEl, cutFlag, groups, rows, applied: -1 };
  }

  // 작중 때를 모르는 스토리(작중순 아래 접이식 한 칸)
  const looseView = (() => {
    const countEl = el('span', { class: 'cr-loose-count' });
    const rowsEl = el('div', { class: 'cr-rows' });
    const rows = [];
    for (const e of looseEntries) {
      const row = listRow(e, 'loose');
      rowsEl.append(row);
      rows.push({ el: row, key: e.c.unit });
    }
    const det = el('details', { class: 'cr-loose' }, el('summary', {}, el('b', {}, LABELS.loose), countEl, el('span', { class: 'cr-loose-hint' }, LABELS.looseHint)), rowsEl);
    return { el: det, countEl, rows };
  })();
  const emptyBox = el('div', { class: 'cr-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);
  const viewHost = el('div', { class: 'cr-viewhost' });
  root.append(viewHost, looseView.el);

  // ══ 보이는 것 계산 · 반영 ═══════════════════════════════════════════════════
  function computeVis(s) {
    const q = cur.find.toLowerCase();
    vis = new Map();
    counts = { shown: 0, cut: 0, filter: 0 };
    const perKind = new Map(kindsPresent.map((k) => [k, 0]));
    const rd = state.reading(s);
    for (const c of units) {
      let r = 'ok';
      let otherOk = false; // 종류 필터만 빼고 통과하나(칩을 흐리게 할지)
      if (!rd.seen(c.unit)) r = 'cut';
      else {
        otherOk = !((cur.drift && !DRIFT_STRONG.has(c.drift)) || (q && !c.search.includes(q)));
        if ((cur.kinds.size && !cur.kinds.has(c.u.kind)) || !otherOk) r = 'filter';
      }
      if (otherOk) perKind.set(c.u.kind, (perKind.get(c.u.kind) ?? 0) + 1);
      vis.set(c.unit, r);
      if (r === 'ok') counts.shown++; else counts[r]++;
    }
    for (const [k, b] of kindBtns) b.classList.toggle('is-zero', (perKind.get(k) ?? 0) === 0);
    const tk = s.t == null ? null : idx.ticks.get(s.t);
    const chId = tk?.main ?? tk?.upto ?? null;
    cutSlot = chId && pointById.get(chId) ? pointById.get(chId).pos : null;
    cutCh = cutSlot != null ? chNum(chId) : null;
    visVersion++;
  }
  const isOk = (key) => vis.get(key) === 'ok';

  function refreshView(v) {
    if (v.applied === visVersion) return;
    v.applied = visVersion;
    for (const r of v.rows) r.el.hidden = !isOk(r.key);
    for (const g of v.groups) {
      const mainOk = Boolean(g.mainKey) && isOk(g.mainKey);
      if (g.mainName) {
        // 메인 챕터 칸 머리 — 챕터가 보이면 이름을 달고 누를 수 있게, 아니면 'CH.30'만(안 본 챕터 이름은 스포일러)
        g.mainName.hidden = !mainOk;
        if (mainOk) { g.head.dataset.key = g.mainKey; g.head.setAttribute('role', 'button'); g.head.tabIndex = 0; }
        else { delete g.head.dataset.key; g.head.removeAttribute('role'); g.head.removeAttribute('tabindex'); }
      }
      const n = g.rows.reduce((a, r) => a + (r.el.hidden ? 0 : 1), 0) + (mainOk ? 1 : 0);
      if (g.el) g.el.hidden = n === 0;
      if (g.head && !g.el) g.head.hidden = n === 0;
    }
    if (v.kind === 'list') {
      // 여기까지 읽음 선 — 컷오프 챕터 뒤 칸의 첫 보이는 묶음 앞에
      v.cutline.hidden = true;
      if (cutSlot != null) {
        const visible = v.groups.filter((g) => !g.el.hidden);
        if (visible.length) {
          const after = visible.find((g) => g.slot > cutSlot);
          v.cutline.querySelector('.cr-cutline-ch').textContent = cutCh;
          if (after) after.el.before(v.cutline); else visible.at(-1).el.after(v.cutline);
          v.cutline.hidden = false;
        }
      }
    }
    if (v.kind === 'band') {
      v.cutEl.hidden = cutSlot == null;
      v.cutFlag.hidden = cutSlot == null;
      if (cutSlot != null) v.cg.style.setProperty('--x', String((cutSlot + 1) / SLOTS));
    }
  }
  function refreshLoose() {
    for (const r of looseView.rows) r.el.hidden = !isOk(r.key);
    const n = new Set(looseView.rows.filter((r) => !r.el.hidden).map((r) => r.key)).size;
    looseView.countEl.textContent = LABELS.count(fmt.num(n));
    looseView.el.hidden = n === 0;
  }

  function currentView() {
    const key = `${cur.view}|${cur.view === 'band' ? cur.by : ''}`;
    if (!views.has(key)) views.set(key, cur.view === 'band' ? bandView(cur.by === 'kind') : listView());
    return views.get(key);
  }
  function showView({ scroll = false } = {}) {
    const v = currentView();
    if (viewHost.firstChild !== v.el) viewHost.replaceChildren(v.el);
    refreshView(v);
    syncSelection({ scroll });
  }

  function updateStatus(s) {
    statusText.textContent = LABELS.count(fmt.num(counts.shown));
    jumpBtn.hidden = !(cur.view === 'list' && cutSlot != null && counts.shown > 0);
    ui.clear(emptyBox);
    const placedShown = byStory.some((c) => isOk(c.unit));
    emptyBox.hidden = placedShown;
    if (!placedShown) {
      const msg = counts.shown === 0 ? LABELS.emptyAll : LABELS.emptyPlaced;
      const acts = [];
      if (counts.filter) acts.push(el('button', { type: 'button', class: 'btn', onClick: () => state.set({ p: { kind: null, find: null, drift: null } }) }, LABELS.clearFilters));
      emptyBox.append(el('span', {}, msg), ...acts);
    }
  }

  function applyAll(s, { layoutChanged = false } = {}) {
    computeVis(s);
    if (layoutChanged) showView({ scroll: true });
    else refreshView(currentView());
    refreshLoose();
    updateStatus(s);
    syncSelection({ scroll: false });
  }

  // ══ 카드(선택한 줄 바로 아래) ═══════════════════════════════════════════════
  let cardEl = null;
  const kv = (rows) => el('dl', { class: 'kvs cr-kv' }, rows.filter(Boolean).flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
  /** 작중 순 칸 — 칸이면 그 이름(시대는 '약 N년 전'), 범위면 'A 뒤 ~ B 전', 모르면 앞뒤 관계 · '모름' */
  const placeText = (c) => {
    if (c.slot == null) return relText(c.relations || c.narrow) || LABELS.unknown;
    const p = isOneSlot(c) && c.lo % 2 === 1 ? points[(c.lo - 1) / 2] : null;
    return [p?.era && p.years ? `${spanText(c)} (${LABELS.yearsAgo(p.years)})` : spanText(c), c.multi ? LABELS.multi : null].filter(Boolean).join(' — ');
  };
  function buildCard(key) {
    const c = byKey.get(key);
    const u = c.u;
    // 장면 = 이 스토리 '지금'의 시점 기록(문장 링크), 회상 · 다른 때 장면은 따로
    const recNodes = (c.records ?? []).filter((id) => !c.pieces.some((p) => p.id === id)).map((id) => el('div', {}, recLink(id)));
    const shownPieces = c.pieces;
    const pieceList = shownPieces.length
      ? el('ul', { class: 'cr-plist' }, shownPieces.map((p) => el('li', {},
        el('span', { class: 'cr-pwhen' }, p.slot != null ? spanText(p) : relText(p.relations) || LABELS.unknown), ' ',
        ui.link(`record:${p.id}`, clip(cprose(p.text), 80) || pieceTag(p)))))
      : null;
    // 추정한 이유 — 추정으로 좁힌 것만(확실 · 단서 없음은 이유를 달지 않는다). 근거 링크는 여기까지 읽음 뒤 스토리의 것을 숨긴다(W14c)
    const rd = state.reading();
    const basisOf = (n) => (n.basis ?? []).filter((b) => { const k = basisUnit(b); return !k || rd.seen(k); });
    const shownNarrows = c.narrows.filter((n) => n.at?.length && n.confidence !== '확실');
    const blurb = blurbs.get(key)?.when;
    // 팬용 문장이 있으면 좁힘이 여럿이어도 한 덩어리(자리들 · 문장 하나 · 근거 모아서), 없으면 좁힘마다 거른 판정 문장
    const narrows = blurb && shownNarrows.length
      ? [el('div', { class: 'cr-narrow' },
        el('b', {}, [...new Set(shownNarrows.map((n) => atText(n.at)))].join(' · ')),
        el('p', { class: 'cr-reason' }, fmt.blurbText(blurb, rd.seen)),
        ((basis) => (basis.length ? el('p', { class: 'cr-why-basis' }, joinNodes(basis)) : null))([...new Set(shownNarrows.flatMap(basisOf))].map(basisLink).filter(Boolean)))]
      : shownNarrows.map((n) => {
        const basis = basisOf(n).map(basisLink).filter(Boolean);
        return el('div', { class: 'cr-narrow' },
          el('b', {}, atText(n.at)),
          whyText(n.reason) ? el('p', { class: 'cr-reason' }, whyText(n.reason)) : null,
          basis.length ? el('p', { class: 'cr-why-basis' }, joinNodes(basis)) : null);
      });
    const drift = DRIFT_STRONG.has(c.drift) ? LABELS.driftLong[c.drift](mainChOf(c), c.drift_gap) : null;
    const pieceHead = shownPieces.every((p) => p.kind === '회상') ? LABELS.legend.piece[0] : fmt.TERM.piece;
    const close = el('button', { type: 'button', class: 'btn cr-card-close', 'aria-label': LABELS.card.close, onClick: () => state.set({ sel: '' }) }, LABELS.card.close);
    return el('section', { class: 'cr-card', 'aria-label': `${u.title} — ${fmt.TERM.chronoPlace}` },
      el('header', { class: 'cr-card-head' }, el('h3', {}, chTitle(u.title), el('span', { class: 'cr-meta' }, fmt.KIND[u.kind]?.label ?? u.kind)), close),
      kv([
        [fmt.TERM.chronoPlace, [placeText(c), c.parallel ? [' ', el('span', { class: 'cr-par', title: LABELS.parallelHint }, LABELS.parallel(wa(chNum(c.parallel.with))))] : null]],
        recNodes.length ? [LABELS.card.scenes, recNodes] : null,
        pieceList ? [pieceHead, pieceList] : null,
        narrows.length ? [LABELS.card.narrow, narrows] : null,
        drift ? [LABELS.card.release, drift] : null,
      ]));
  }

  function syncSelection({ scroll }) {
    cardEl?.remove();
    cardEl = null;
    for (const n of root.querySelectorAll('.is-sel')) n.classList.remove('is-sel');
    if (!activeKey) return;
    const rows = [...root.querySelectorAll(ROW_SEL)].filter((r) => r.dataset.key === activeKey && r.offsetParent !== null);
    if (!rows.length) return;
    for (const r of rows) r.classList.add('is-sel');
    // 누른 줄 그대로, 링크로 왔으면 스토리 '지금'의 줄(회상 장면 줄 · 띠 그림 밖보다 먼저)
    const target = rows.includes(lastRow) ? lastRow : rows.find((r) => !r.classList.contains('is-piece')) ?? rows[0];
    cardEl = buildCard(activeKey);
    target.after(cardEl);
    if (scroll) target.scrollIntoView({ block: 'center', behavior: 'auto' });
    // 장면 글(기록 문장)은 기록을 받아야 보인다 — 아직이면 받은 뒤 카드를 다시 그린다
    if (!idx.hasRecords && idx.withRecords) {
      const want = activeKey;
      idx.withRecords().then(() => { if (alive && activeKey === want && cardEl) syncSelection({ scroll: false }); }).catch(() => {});
    }
  }

  // ══ 줄 누르기 · 툴팁(위임) ═══════════════════════════════════════════════════
  const rowOf = (ev) => ev.target.closest?.(ROW_SEL);
  const pick = (row) => {
    lastRow = row;
    ownClick = true;
    try { state.set({ sel: activeKey === row.dataset.key && state.get().sel === `unit:${row.dataset.key}` ? '' : `unit:${row.dataset.key}` }); } finally { ownClick = false; }
  };
  const onClick = (ev) => { const row = rowOf(ev); if (row && !ev.target.closest('a, .cr-card')) pick(row); };
  const onKey = (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.(ROW_SEL)) { ev.preventDefault(); pick(ev.target); } };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);

  let tipEl = null;
  let tipRow = null;
  const hideTip = () => { tipEl?.remove(); tipEl = null; tipRow = null; };
  const placeTip = (x, y) => {
    if (!tipEl) return;
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    tipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x + 14))}px`;
    tipEl.style.top = `${y + 18 + h > window.innerHeight ? Math.max(8, y - h - 12) : y + 18}px`;
  };
  /** 띠 그림 툴팁 — 제목 · 종류 · 작중 때(어긋난 것만 보기면 출시 때도) */
  function tipNode(c) {
    const u = c.u;
    return el('div', { class: 'cr-tip' },
      el('div', { class: 'cr-tip-title' }, u.title),
      el('div', {}, [fmt.KIND[u.kind].label, placeText(c)].filter(Boolean).join(' · ')),
      cur.drift && driftShort(c) ? el('div', {}, driftShort(c)) : null);
  }
  const showTip = (row, x, y) => {
    if (tipRow === row) return;
    hideTip();
    const c = byKey.get(row.dataset.key);
    if (!c) return;
    tipRow = row;
    tipEl = el('div', { class: 'tooltip cr-tooltip', role: 'tooltip' }, tipNode(c));
    document.body.append(tipEl);
    placeTip(x, y);
  };
  const onOver = (ev) => { const r = ev.target.closest?.('.cg-row'); if (r) showTip(r, ev.clientX, ev.clientY); else if (tipRow) hideTip(); };
  const onMove = (ev) => {
    if (!tipEl) { const r = ev.target.closest?.('.cg-row'); if (r) showTip(r, ev.clientX, ev.clientY); } // 스크롤로 사라진 말풍선을 다시 띄운다
    else placeTip(ev.clientX, ev.clientY);
  };
  const onFocus = (ev) => { const r = ev.target.closest?.('.cg-row'); if (r) { const b = r.getBoundingClientRect(); showTip(r, b.left + 40, b.top); } };
  viewHost.addEventListener('mouseover', onOver);
  viewHost.addEventListener('mousemove', onMove);
  viewHost.addEventListener('mouseleave', hideTip);
  viewHost.addEventListener('focusin', onFocus);
  viewHost.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  // ══ 시작 · 구독 ═════════════════════════════════════════════════════════════
  syncKinds();
  applyAll(state.get(), { layoutChanged: true });

  const off = state.subscribe((s, changed) => {
    let layoutChanged = false;
    if (changed.has('p')) {
      const prev = cur;
      cur = readParams();
      viewSeg.set(cur.view);
      driftToggle.set(cur.drift);
      if (document.activeElement !== findBox) findBox.value = cur.find;
      syncKinds();
      layoutChanged = prev.view !== cur.view || prev.by !== cur.by;
      if (layoutChanged) hideTip();
    }
    if (changed.has('p') || changed.has('t')) applyAll(s, { layoutChanged });
    if (changed.has('sel')) {
      const parsed = state.parseSel(s.sel);
      if (!s.sel) activeKey = null;
      else if (parsed?.type === 'unit') activeKey = byKey.has(parsed.id) ? parsed.id : null;
      syncSelection({ scroll: !ownClick });
    }
  });
  return () => {
    alive = false;
    root.classList.remove('cr-drift-on');
    off();
    hideTip();
    clearTimeout(findTimer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', hideTip);
  };
}
