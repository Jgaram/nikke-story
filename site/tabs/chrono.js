/**
 * 탭 5 연대기(W6) — 화면 6 "작중 연대기"(docs/views.md 6절, 규칙 tools/views/chrono-order.mjs · chrono.mjs 머리말).
 * 스토리를 작중에서 일어난 순서(또는 출시 순서)로 늘어놓는다. 자리를 모르는 스토리는 억지로 끼우지 않고 따로 둔다.
 *
 * 쓰는 JSON
 *   chrono.json(이 탭 — tools/site/export/chrono.mjs): points[57](작중 축의 점 — 시대 기준점 8 + 메인 챕터 49, pos = 2i+1) · units[481](작중 자리 class · lo · hi · via · records · relations · narrow ·
 *     drift · drift_gap · seq · slot · parallel) · pieces[109](회상 장면 · 다른 때 장면) · narrows[366](좁힘 근거 — at · basis · reason · confidence)
 *   공용(idx): units.json(제목 · 종류 · 출시 시점 tick · 날짜 · 층)  ticks.json(출시 시점 라벨)
 *   자리 번호(slot): 점 i = 2i+1, 점 사이 칸 = 2i, 첫 점 앞 = 0, 마지막 점 뒤 = 2P → 칸 115개를 같은 폭으로 그린다. lo · hi가 없으면 그쪽 끝을 모르는 범위(열린 끝).
 *
 * URL 파라미터(p.*)
 *   view   list(목록, 기본) | band(띠 그림)
 *   by     kind이면 띠 그림 줄을 종류별로 묶는다
 *   kind   종류 필터(쉼표 — event,episode …), 없으면 전체
 *   find   제목 · 키 · 회상 장면 문장 안 낱말
 *   drift  1이면 출시순과 어긋난 것(과거 이야기 · 앞선 이야기 · 나중 이야기)만
 *
 * 그리는 규칙
 *   목록(작중순): 칸마다 묶는다(시대 기준점 · 메인 챕터 · 그 사이). 판별은 제자리, 범위는 앞 끝 칸(앞 끝을 모르면 뒤 끝 칸), 회상 장면은 따로 한 줄(한 스토리가 두 자리에).
 *     "여기까지 읽음" 선(자리 표시 — t의 메인 챕터로만 정한다): 컷오프 챕터 뒤 칸부터 위쪽 줄과 갈라 보인다 — 선 아래 줄은 읽은 것보다 작중으로 뒤인 이야기(앞질러 간 이야기).
 *     줄마다 출시 시점과 출시순과 비교(과거 이야기 · 앞선 이야기 · 같은 때 · 걸침 · 나중 이야기)를 보인다. 출시순 보기는 두지 않는다 — 출시순은 감상 순서 탭(사용자, 2026-10-10).
 *   띠 그림: 가로 = 작중 축(항상), 줄 = 스토리 하나. 시점 확정 = 점(칸 폭이 있으면 꽉 찬 막대), 대략 범위 = 반투명 막대(끝을 모르는 쪽은 흐려진다),
 *     회상 · 다른 때 장면 = 속 빈 표시(본체와 점선으로 이음). 색은 종류 색(--kind-*)만. 줄 순서는 작중순(계단).
 *   앞뒤만 앎 · 시점 불명은 목록 아래 접이식 칸에 따로.
 *   컷오프: 안 본 스토리(R = state.reading(s)의 R.seen(키) — 척추 이벤트 · 사이드는 '봤음' 예외를 따르고, 예외가 없으면 출시 시점 ≤ t)는 숨기고 "스포일러로 가린 스토리 N — 전부 보기". 층 · 필터로 가린 수도 따로. 모두 DOM을 다시 만들지 않고 hidden만 바꾼다(스크롤 · 선택 유지).
 *   종류 칩의 숫자 = 지금 보이는(여기까지 읽음 · 범위 · 찾기 · 어긋남 필터 안) 스토리 수. 목록에는 "읽은 곳으로" 버튼이 여기까지 읽음 선으로 보낸다.
 *   줄을 누르면 sel=unit:키 → 리더 + 줄 바로 아래에 "작중 자리" 카드(작중 자리 · 정한 방법 · 시점 기록 · 회상 장면 · 추정한 이유 · 출시 시점 · 출시순과 비교). 같은 줄을 다시 누르면 닫는다.
 */
export const meta = { id: 'chrono', title: '연대기', blurb: '작중 시간순' };

/** 화면 라벨 한 곳 — 레포 내부 용어는 여기서 사람 말로 바꾼다 */
const LABELS = {
  viewName: '보기', view: { list: '목록', band: '띠 그림' }, viewHint: { list: '시점마다 묶은 세로 목록', band: '가로 = 작중 시점, 줄 = 스토리' }, jump: '읽은 곳으로',
  find: '스토리 찾기', findPlaceholder: '제목 · 낱말로 찾기',
  driftOnly: '출시순과 어긋난 것만', driftOnlyHint: '과거 이야기 · 앞선 이야기 · 나중 이야기만 보인다',
  kindName: '종류', kindAll: '전체',
  pieceFlash: '회상 장면', pieceFlashHint: '회상 · 다른 때의 장면 — 한 스토리가 두 자리에 나온다',
  /** 출시순과 비교 — 글자 · 정의는 fmt.DRIFT · DRIFT_HELP, 여기는 기호와 강조 여부만 */
  drift: {
    과거: { glyph: '↞', strong: true }, 앞: { glyph: '←', strong: true }, 맞음: { glyph: '=', strong: false },
    걸침: { glyph: '~', strong: false }, 뒤: { glyph: '→', strong: true },
  },
  via: {
    메인: '메인 챕터 — 번호 순으로 고정',
    단위: '시간 단서로 정함',
    좁힘: '다른 스토리와의 관계로 좁힘',
    '단위 · 좁힘': '시간 단서 + 다른 스토리와의 관계로 좁힘',
    회상: '회상 장면의 시간 단서로 정함',
    조각: '여러 장면의 시간 단서로 정함',
    없음: '정할 단서가 없다',
  },
  era: '시대 기준점', eraZone: '시대', chapterZone: '메인 챕터',
  multi: '여러 자리', openEnd: '끝을 모름',
  parallel: (ch) => `${ch}와 병행`, parallelHint: '번호 순과 달리 앞 챕터와 같은 무렵에 벌어진 병행 줄거리',
  cutHint: '이 선 아래는 읽은 곳보다 작중으로 뒤의 이야기(앞질러 간 이야기)',
  hiddenLayer: (n) => `${n}개는 범위 밖`, hiddenFilter: (n) => `거른 스토리 ${n}`,
  shown: (n, total) => `${n} / ${total}`,
  emptyAll: '보이는 스토리가 없다', clearFilters: '필터 풀기',
  emptyPlaced: '자리가 정해진 스토리가 가려졌다 — 아래 앞뒤만 앎 · 시점 불명을 본다',
  noClue: '단서 없음', clueNone: '단서 없음',
  card: {
    place: '작중 시점', how: '정한 방법', records: '시점 단서', narrow: '추정한 이유', close: '닫기',
  },
  bandHead: '스토리', eraLegend: '시대 기준점',
};

const CLASS_ORDER = ['판별', '범위', '상대', '불명'];
const clip = (s, n) => { const a = [...String(s ?? '')]; return a.length > n ? `${a.slice(0, n).join('')}…` : a.join(''); };
const chNum = (id) => `CH.${String(id).replace(/^ch/, '')}`;
const REL_WORDS = new Set(['직후', '직전', '뒤', '전', '무렵', '중', '동시']);

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const { el } = ui;
  const chrono = await data.load('chrono');

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
  /** 자리 글 — 한 칸이면 그 칸, 범위면 'A 뒤 ~ B 전', 한쪽만 알면 'A 뒤 ~' / '~ B 전' */
  const spanText = (c) => {
    if (c.lo == null && c.hi == null) return '';
    if (c.lo != null && c.lo === c.hi) return slotName(c.lo);
    if (c.lo != null && c.hi != null) return `${loText(c.lo)} ~ ${hiText(c.hi)}`;
    return c.lo != null ? `${loText(c.lo)} ~` : `~ ${hiText(c.hi)}`;
  };
  const refText = (ref) => {
    if (/^ch\d+$/.test(ref)) return chNum(ref);
    const p = pointById.get(ref);
    if (p) return pointShort(p);
    const u = idx.units.get(ref);
    return u ? u.title : ref;
  };
  /** 'CH.41 뒤' — 관계 글의 '뒤 ch41; 전 ch02 (5년)'을 읽는 말로 */
  const relText = (str) => String(str ?? '').split('; ').filter(Boolean).map((part) => {
    const m = part.match(/^(\S+) (\S+)(.*)$/);
    return m && REL_WORDS.has(m[1]) ? `${refText(m[2])} ${m[1]}${m[3]}` : part;
  }).map(fmt.prose).filter(Boolean).join(' · ');
  const atText = (at) => (at ?? []).map(([rel, ref, gap]) => `${refText(ref)} ${rel}${gap ? ` (${gap})` : ''}`).join(' · ');
  const relLabel = (tick) => fmt.tickLabel(tick, { date: false });
  const classLabel = (cls) => fmt.CHRONO_CLASS[cls] ?? cls;
  const pieceLabel = (kind) => (kind === '회상' ? LABELS.pieceFlash : fmt.TERM.piece);
  const driftLabel = (k) => fmt.DRIFT[k] ?? k;

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
  const kindCount = new Map(kindsPresent.map((k) => [k, units.filter((c) => c.u.kind === k).length]));

  // 작중순 줄 — 자리 있는 스토리의 '지금' + 회상 장면
  const storyEntries = [];
  for (const c of units) if (c.slot != null) storyEntries.push({ type: 'unit', c, seq: c.seq, slot: c.slot });
  for (const c of units) for (const p of c.pieces) if (p.slot != null) storyEntries.push({ type: 'piece', c, p, seq: p.seq, slot: p.slot });
  storyEntries.sort((a, b) => a.seq - b.seq);
  const looseUnits = units.filter((c) => c.slot == null);
  const loosePieces = [];
  for (const c of units) for (const p of c.pieces) if (p.slot == null) loosePieces.push({ type: 'piece', c, p });
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
  let counts = { shown: 0, cut: 0, layer: 0, filter: 0 };
  let cutSlot = null;
  let cutCh = null;

  // ══ 머리 · 도구 줄 ═══════════════════════════════════════════════════════
  root.append(el('div', { class: 'tab-head' }, el('h2', {}, meta.title)));
  const viewSeg = ui.segmented({ label: LABELS.viewName, options: Object.entries(LABELS.view).map(([value, label]) => ({ value, label, title: LABELS.viewHint[value] })), value: cur.view, onChange: (v) => setP('view', v === 'list' ? null : v) });
  const findBox = el('input', { type: 'search', class: 'cr-find', placeholder: LABELS.findPlaceholder, 'aria-label': LABELS.find, value: cur.find });
  let findTimer = null;
  findBox.addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(() => setP('find', findBox.value.trim() || null), 200); });
  const driftToggle = ui.toggle({ label: LABELS.driftOnly, checked: cur.drift, title: LABELS.driftOnlyHint, onChange: (v) => setP('drift', v ? '1' : null) });
  root.append(el('div', { class: 'toolbar cr-bar' }, el('span', { class: 'cr-seg' }, el('span', { class: 'ctl-name' }, LABELS.viewName), viewSeg.el), findBox, driftToggle));

  const kindBox = el('div', { class: 'cr-kinds', role: 'group', 'aria-label': LABELS.kindName });
  const allBtn = el('button', { type: 'button', class: 'cr-kindbtn cr-kindall', onClick: () => setP('kind', null) }, LABELS.kindAll);
  const kindBtns = new Map();
  const kindChips = new Map();
  kindBox.append(allBtn);
  for (const k of kindsPresent) {
    const chip = ui.chip('kind', k, `${fmt.KIND[k].label} ${fmt.num(kindCount.get(k))}`);
    const b = el('button', { type: 'button', class: 'cr-kindbtn', onClick: () => { const next = new Set(cur.kinds); if (next.has(k)) next.delete(k); else next.add(k); setP('kind', [...next].join(',') || null); } }, chip);
    kindBtns.set(k, b);
    kindChips.set(k, chip);
    kindBox.append(b);
  }
  root.append(kindBox);
  const syncKinds = () => {
    allBtn.setAttribute('aria-pressed', String(cur.kinds.size === 0));
    for (const [k, b] of kindBtns) {
      const on = cur.kinds.has(k);
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-off', cur.kinds.size > 0 && !on);
    }
  };

  const statusText = el('span', { class: 'cr-status-text' });
  const statusNote = el('span', { class: 'cr-status-note' });
  const jumpBtn = el('button', { type: 'button', class: 'btn cr-jump', onClick: () => document.querySelector('.cr-cutline:not([hidden])')?.scrollIntoView({ block: 'center' }) }, LABELS.jump);
  root.append(el('div', { class: 'cr-status', role: 'status', 'aria-live': 'polite' }, statusText, statusNote, jumpBtn));

  // 범례 — 모양 · 기호는 줄 · 띠 그림과 같다
  const legendItem = (icon, label, hint) => el('span', { class: 'cr-leg', title: hint }, icon, label);
  root.append(el('div', { class: 'cr-legend' },
    el('span', { class: 'cr-legend-group' }, ...CLASS_ORDER.slice(0, 2).map((cl) => legendItem(classIcon(cl), classLabel(cl), fmt.help('chrono', cl))),
      legendItem(classIcon('판별', true), LABELS.pieceFlash, LABELS.pieceFlashHint)),
    el('span', { class: 'cr-legend-group' }, el('span', { class: 'ctl-name' }, fmt.DRIFT_TITLE),
      ...fmt.DRIFT_ORDER.map((k) => legendItem(driftGlyph(k), driftLabel(k), fmt.help('drift', k))))));

  // ══ 작은 조각들 ═════════════════════════════════════════════════════════
  function classIcon(cls, isPiece = false) {
    if (cls === '상대') return el('i', { class: 'cr-ico cr-ico-text', 'aria-hidden': 'true' }, '⇄');
    if (cls === '불명') return el('i', { class: 'cr-ico cr-ico-text', 'aria-hidden': 'true' }, '?');
    return el('i', { class: ['cr-ico', cls === '범위' ? 'cr-ico-range' : 'cr-ico-dot', isPiece && 'is-piece'], 'aria-hidden': 'true' });
  }
  function driftGlyph(k) {
    return el('i', { class: `cr-dglyph cr-d-${k}`, 'aria-hidden': 'true' }, LABELS.drift[k].glyph);
  }
  const driftBadge = (c) => {
    const d = LABELS.drift[c.drift];
    if (!d) return null;
    const gap = (c.drift === '앞' || c.drift === '뒤') && c.drift_gap ? ` ${c.drift_gap}챕터` : '';
    return el('span', { class: ['cr-drift', `cr-d-${c.drift}`, d.strong && 'is-strong'], title: `${fmt.DRIFT_TITLE}: ${fmt.help('drift', c.drift)}` }, `${d.glyph} ${driftLabel(c.drift)}${gap}`);
  };
  const parallelBadge = (c) => (c.parallel ? el('span', { class: 'cr-par', title: LABELS.parallelHint }, LABELS.parallel(chNum(c.parallel.with))) : null);
  /** 기록 링크 — 글자는 기록 문장(줄임). ID는 화면에 내지 않는다(W13a) */
  const recLink = (id) => { const r = idx.records?.get(id); return ui.link(`record:${id}`, r ? clip(fmt.recordText(r), 40) : fmt.RECORD_KIND[String(id).replace(/\d.*$/, '')]?.label ?? '자세히'); };
  /** 글 속 기록 ID(F387 · S370 · J1)를 링크로 */
  const withLinks = (text) => fmt.prose(text); // 자유 문장은 한 함수를 거친다(W13a)
  /** 근거 ID — 기록 · 줄기 · 씬#줄 */
  const basisLink = (b) => {
    if (/^J\d+$/.test(b)) return ui.link(`thread:${b}`, idx.threads.get(b)?.title ?? fmt.TERM.thread);
    if (/^[A-Z](-[a-z])?\d+$/.test(b)) return recLink(b);
    const base = b.split('#')[0];
    const sceneId = [base, base.replace(/^ep:/, ''), `ep:${base}`].find((x) => idx.scenes.has(x));
    return sceneId ? ui.link(`scene:${sceneId}`, fmt.ref(sceneId)) : null;
  };
  const joinNodes = (nodes, sep = ' ') => nodes.flatMap((n, i) => (i ? [sep, n] : [n]));

  // ══ 줄 ═══════════════════════════════════════════════════════════════════
  /** 목록 줄 — mode: story(작중순) · loose(앞뒤만 앎 · 시점 불명) */
  function listRow(e, mode) {
    const { c } = e;
    const u = c.u;
    const piece = e.type === 'piece' ? e.p : null;
    const cls = piece ? piece.class : c.class;
    const target = piece ?? c;
    let spanCell = '';
    if (mode === 'loose') spanCell = relText(piece ? piece.relations : (c.relations || c.narrow)) || LABELS.noClue;
    else if (!piece && c.multi) spanCell = LABELS.multi;
    else if (cls === '판별' && target.lo != null && target.lo === target.hi && mode === 'story') spanCell = '';
    else spanCell = spanText(target) || (cls === '상대' || cls === '불명' ? classLabel(cls) : '');
    const row = el('div', { class: ['cr-row', piece && 'is-piece', `cls-${cls}`], dataset: { key: c.unit }, role: 'button', tabindex: 0 },
      el('span', { class: 'cr-kind' }, ui.chip('kind', u.kind)),
      el('span', { class: 'cr-name' },
        el('span', { class: 'cr-line' },
          el('span', { class: 'cr-ico-wrap', title: classLabel(cls) }, classIcon(cls, Boolean(piece))),
          el('span', { class: 'cr-title' }, u.title),
          piece ? el('span', { class: 'cr-ptag' }, pieceLabel(piece.kind)) : null,
          !piece ? parallelBadge(c) : null,
          !piece && mode !== 'loose' ? driftBadge(c) : null),
        fmt.prose(piece?.text) ? el('span', { class: 'cr-ptext' }, clip(fmt.prose(piece.text), 120)) : null),
      el('span', { class: 'cr-span', title: spanCell && !piece && cls === '범위' ? classLabel(cls) : null }, spanCell),
      el('span', { class: 'cr-rel', title: u.date ?? '' }, relLabel(u.tick), u.date ? el('span', { class: 'cr-date' }, ` · ${u.date}`) : null));
    return row;
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
    const row = el('div', { class: ['cg-row', `cls-${c.class}`], dataset: { key: c.unit }, role: 'button', tabindex: 0, 'aria-label': `${u.title} · ${classLabel(c.class)} ${spanText(c)}`.trim() });
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
    if (!marks.length) plot.append(el('span', { class: 'cg-none' }, classLabel(c.class)));
    row.append(
      el('div', { class: 'cg-label' }, el('span', { class: 'cg-title' }, u.title), c.drift && LABELS.drift[c.drift]?.strong ? driftGlyph(c.drift) : null, c.parallel ? el('span', { class: 'cg-par', title: LABELS.parallelHint }, '∥') : null),
      plot);
    return row;
  }

  // ══ 보기 만들기(처음 필요할 때 한 번 — 이후 hidden만 바꾼다) ═══════════════════
  const views = new Map();

  function groupShell(headNode, body) {
    return el('section', { class: 'cr-group' }, headNode, body);
  }
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
        const nameEl = el('span', { class: 'cr-gname' }, slotName(e.slot));
        const subEl = el('span', { class: 'cr-gsub' });
        const countEl = el('span', { class: 'cr-gcount' });
        const bodyEl = el('div', { class: 'cr-rows' });
        const head = el('header', { class: ['cr-ghead', point?.era && 'is-era', point && !point.era && 'is-main'] }, el('h3', {}, nameEl, subEl), countEl);
        let whyEl = null;
        if (point?.era) {
          subEl.textContent = `${LABELS.era}${point.years ? ` · 약 ${point.years}년 전` : ''}`;
          whyEl = el('div', { class: 'cr-why' }, withLinks(point.reason) ? el('p', {}, withLinks(point.reason)) : null, point.basis?.map(basisLink).filter(Boolean).length ? el('p', { class: 'cr-why-basis' }, fmt.TERM.evidence, ' ', joinNodes(point.basis.map(basisLink).filter(Boolean), ' · ')) : null);
          whyEl.hidden = true;
          head.append(el('button', { type: 'button', class: 'btn cr-whybtn', 'aria-expanded': 'false', onClick: (ev) => { whyEl.hidden = !whyEl.hidden; ev.currentTarget.setAttribute('aria-expanded', String(!whyEl.hidden)); } }, '설명'));
        }
        g = { slot: e.slot, point, el: groupShell(head, [whyEl, bodyEl]), body: bodyEl, countEl, rows: [] };
        groups.push(g);
        wrap.append(g.el);
      }
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
    const eraPoints = points.filter((p) => p.era);
    const firstMain = points.findIndex((p) => !p.era);
    // 머리: 영역 이름 + 시대 번호 + 챕터 눈금(고정)
    const axisEl = el('div', { class: 'cg-axis', 'aria-hidden': 'true' });
    const zone = (lo, hi, text, cls) => { const z = el('span', { class: `cg-zone ${cls}` }, text); z.style.left = `${(lo / SLOTS) * 100}%`; z.style.width = `${((hi - lo) / SLOTS) * 100}%`; return z; };
    const split = firstMain > 0 ? 2 * firstMain : 0;
    if (split) axisEl.append(zone(0, split, LABELS.eraZone, 'is-era'));
    axisEl.append(zone(split, SLOTS, LABELS.chapterZone, 'is-main'));
    for (const [i, p] of points.entries()) {
      const x = ((p.pos + 0.5) / SLOTS) * 100;
      let t = null;
      if (p.era) t = el('span', { class: 'cg-tick is-era', title: p.name }, String(i + 1));
      else {
        const n = Number(String(p.id).replace(/^ch/, ''));
        if (n % 5 === 0) t = el('span', { class: 'cg-tick', dataset: n % 10 === 0 ? { m10: '1' } : {} }, String(n).padStart(2, '0'));
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
    const source = byStory;
    const groups = [];
    const rows = [];
    const makeGroup = (label, items) => {
      const countEl = el('span', { class: 'cr-gcount' });
      const headEl = byKind ? el('div', { class: 'cg-ghead' }, label, countEl) : null;
      const g = { head: headEl, countEl, rows: [] };
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
    if (byKind) for (const k of kindsPresent) makeGroup(ui.chip('kind', k), source.filter((c) => c.u.kind === k));
    else makeGroup(null, source);
    const eraLegend = el('details', { class: 'cg-eras' }, el('summary', {}, `${LABELS.eraLegend} ${eraPoints.length}`),
      el('ol', {}, eraPoints.map((p, i) => el('li', {}, el('b', {}, `${i + 1}.`), ` ${p.name}${p.years ? ` · 약 ${p.years}년 전` : ''}`))));
    wrap.append(head, body, cutEl);
    return { kind: 'band', byKind, el: el('div', { class: 'cg-wrap' }, eraLegend, wrap), cg: wrap, cutEl, cutFlag, groups, rows, applied: -1 };
  }

  // 앞뒤만 앎 · 시점 불명 칸(작중순 아래)
  const looseView = (() => {
    const host = el('div', { class: 'cr-loose' });
    const parts = ['상대', '불명'].map((cls) => {
      const items = looseUnits.filter((c) => c.class === cls).map((c) => ({ type: 'unit', c }));
      const pcs = cls === '상대' ? loosePieces : [];
      const countEl = el('span', { class: 'cr-gcount' });
      const rowsEl = el('div', { class: 'cr-rows' });
      const rows = [];
      for (const e of [...items, ...pcs]) {
        const row = listRow(e, 'loose');
        rowsEl.append(row);
        rows.push({ el: row, key: e.c.unit });
      }
      const det = el('details', { class: 'cr-loose-part' }, el('summary', {}, el('span', { class: 'cr-ico-wrap' }, classIcon(cls)), el('b', {}, classLabel(cls)), countEl, el('span', { class: 'cr-loose-hint' }, fmt.help('chrono', cls))), rowsEl);
      host.append(det);
      return { cls, det, countEl, rows };
    });
    return { el: host, parts };
  })();
  const emptyBox = el('div', { class: 'cr-empty' });
  emptyBox.hidden = true;
  root.append(emptyBox);
  const viewHost = el('div', { class: 'cr-viewhost' });
  root.append(viewHost, looseView.el);

  // ══ 보이는 것 계산 · 반영 ═══════════════════════════════════════════════════
  const DRIFT_STRONG = new Set(Object.entries(LABELS.drift).filter(([, d]) => d.strong).map(([k]) => k));
  function computeVis(s) {
    const q = cur.find.toLowerCase();
    vis = new Map();
    counts = { shown: 0, cut: 0, layer: 0, filter: 0 };
    const perKind = new Map(kindsPresent.map((k) => [k, 0]));
    const rd = state.reading(s);
    for (const c of units) {
      const u = c.u;
      let r = 'ok';
      let otherOk = false; // 종류 필터만 빼고 통과하나(칩의 건수)
      if (!rd.seen(c.unit)) r = 'cut';
      else if (u.layer != null && !s.layers.includes(u.layer)) r = 'layer';
      else {
        otherOk = !((cur.drift && !DRIFT_STRONG.has(c.drift)) || (q && !c.search.includes(q)));
        if ((cur.kinds.size && !cur.kinds.has(u.kind)) || !otherOk) r = 'filter';
      }
      if (otherOk) perKind.set(u.kind, (perKind.get(u.kind) ?? 0) + 1);
      vis.set(c.unit, r);
      if (r === 'ok') counts.shown++; else counts[r]++;
    }
    for (const [k, chip] of kindChips) {
      const n = perKind.get(k) ?? 0;
      chip.textContent = `${fmt.KIND[k].label} ${fmt.num(n)}`;
      kindBtns.get(k).classList.toggle('is-zero', n === 0);
    }
    const tk = s.t == null ? null : idx.ticks.get(s.t);
    const chId = tk?.main ?? tk?.upto ?? null;
    cutSlot = chId && pointById.get(chId) ? pointById.get(chId).pos : null;
    cutCh = cutSlot != null ? chNum(chId) : null;
    visVersion++;
  }
  const isOk = (key) => vis.get(key) === 'ok';

  function refreshView(v, s) {
    if (v.applied === visVersion) return;
    v.applied = visVersion;
    for (const r of v.rows) r.el.hidden = !isOk(r.key);
    for (const g of v.groups) {
      const n = g.rows.reduce((a, r) => a + (r.el.hidden ? 0 : 1), 0);
      if (g.countEl) g.countEl.textContent = fmt.num(n);
      if (g.el) g.el.hidden = n === 0;
      if (g.head) g.head.hidden = n === 0;
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
    for (const part of looseView.parts) {
      for (const r of part.rows) r.el.hidden = !isOk(r.key);
      const n = part.rows.reduce((a, r) => a + (r.el.hidden ? 0 : 1), 0);
      part.countEl.textContent = fmt.num(n);
      part.det.hidden = n === 0;
    }
  }

  function currentView() {
    const key = `${cur.view}|${cur.view === 'band' ? cur.by : ''}`;
    if (!views.has(key)) views.set(key, cur.view === 'band' ? bandView(cur.by === 'kind') : listView());
    return views.get(key);
  }
  function showView({ scroll = false } = {}) {
    const v = currentView();
    if (viewHost.firstChild !== v.el) viewHost.replaceChildren(v.el);
    refreshView(v, state.get());
    syncSelection({ scroll });
  }

  function updateStatus(s) {
    const total = units.length;
    const parts = [];
    parts.push(LABELS.shown(fmt.num(counts.shown), fmt.num(total)));
    if (counts.filter) parts.push(LABELS.hiddenFilter(fmt.num(counts.filter)));
    statusText.textContent = parts.join(' · ');
    ui.clear(statusNote);
    if (counts.cut && s.t != null) statusNote.append(ui.hiddenNote(fmt.hiddenLabel(counts.cut), () => state.set({ t: null })));
    jumpBtn.hidden = !(cur.view === 'list' && cutSlot != null && counts.shown > 0);
    ui.clear(emptyBox);
    const placedShown = byStory.some((c) => isOk(c.unit));
    emptyBox.hidden = placedShown;
    if (!placedShown) {
      const msg = counts.shown === 0 ? LABELS.emptyAll : LABELS.emptyPlaced;
      const acts = [];
      if (counts.cut && s.t != null) acts.push(el('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: null }) }, `${fmt.hiddenLabel(counts.cut)} — ${fmt.TERM.showAll}`));
      if (counts.filter) acts.push(el('button', { type: 'button', class: 'btn', onClick: () => state.set({ p: { kind: null, find: null, drift: null } }) }, LABELS.clearFilters));
      emptyBox.append(el('span', {}, msg), ...acts);
    }
  }

  function applyAll(s, { layoutChanged = false } = {}) {
    computeVis(s);
    if (layoutChanged) showView({ scroll: true });
    else refreshView(currentView(), s);
    refreshLoose();
    updateStatus(s);
    syncSelection({ scroll: false });
  }

  // ══ 작중 자리 카드(선택한 줄 바로 아래) ═══════════════════════════════════════
  let cardEl = null;
  const kv = (rows) => el('dl', { class: 'kvs cr-kv' }, rows.filter(Boolean).flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
  function buildCard(key) {
    const c = byKey.get(key);
    const u = c.u;
    const placeNodes = c.class === '판별' || c.class === '범위'
      ? [el('span', { class: 'cr-ico-wrap' }, classIcon(c.class)), ` ${classLabel(c.class)} · `, c.multi ? `${LABELS.multi} — ${spanText(c)}` : spanText(c), c.lo == null || c.hi == null ? el('span', { class: 'muted' }, c.lo == null && c.hi == null ? '' : ` (${LABELS.openEnd})`) : null]
      : [el('span', { class: 'cr-ico-wrap' }, classIcon(c.class)), ` ${classLabel(c.class)} — ${fmt.help('chrono', c.class)}`];
    const records = c.records?.length
      ? [joinNodes(c.records.map(recLink)), c.relations ? el('div', { class: 'cr-rel-text' }, relText(c.relations)) : null]
      : null;
    const pieceList = c.pieces.length
      ? el('ul', { class: 'cr-plist' }, c.pieces.map((p) => el('li', {},
        el('span', { class: 'cr-ico-wrap' }, classIcon(p.class, true)), ' ', recLink(p.id), ' ',
        el('span', { class: 'cr-ptag' }, pieceLabel(p.kind)), ' ',
        el('span', { class: 'muted' }, p.slot != null ? spanText(p) : classLabel(p.class)),
        p.relations ? el('div', { class: 'cr-rel-text' }, relText(p.relations)) : null,
        fmt.prose(p.text) ? el('div', { class: 'cr-ptext' }, fmt.prose(p.text)) : null)))
      : null;
    const narrows = c.narrows.map((n) => el('div', { class: 'cr-narrow' },
      el('div', { class: 'cr-narrow-head' },
        n.piece ? [LABELS.pieceFlash, ' ', recLink(n.piece), ' · '] : null,
        n.at?.length ? el('b', {}, atText(n.at)) : el('b', { class: 'muted' }, LABELS.clueNone),
        ' ', n.confidence ? ui.chip('confidence', n.confidence) : null),
      withLinks(n.reason) ? el('p', { class: 'cr-reason' }, withLinks(n.reason)) : null,
      n.basis?.map(basisLink).filter(Boolean).length ? el('p', { class: 'cr-why-basis' }, fmt.TERM.evidence, ' ', joinNodes(n.basis.map(basisLink).filter(Boolean), ' · ')) : null));
    const d = LABELS.drift[c.drift];
    const mainCh = c.release_main ? chNum(c.release_main) : null;
    const driftSentence = d && ({
      과거: `출시 때(${mainCh} 시점)보다 앞선 과거의 이야기 — 메인 ${c.drift_gap}챕터 전`,
      앞: `출시 때(${mainCh} 시점)보다 ${c.drift_gap}챕터 앞선 이야기`,
      맞음: `출시 때(${mainCh} 시점)의 이야기와 같은 때`,
      걸침: `출시 때(${mainCh} 시점) 앞뒤에 걸치는 넓은 범위 — ${fmt.help('drift', '걸침')}`,
      뒤: `출시 때(${mainCh} 시점)에는 아직 나오지 않은 ${c.drift_gap}챕터 뒤의 이야기 — 앞질러 간 이야기`,
    })[c.drift];
    const close = el('button', { type: 'button', class: 'btn cr-card-close', 'aria-label': LABELS.card.close, onClick: () => state.set({ sel: '' }) }, LABELS.card.close);
    const card = el('section', { class: 'cr-card', 'aria-label': `${u.title} — ${LABELS.card.place}` },
      el('header', { class: 'cr-card-head' }, el('h3', {}, ui.chip('kind', u.kind), ' ', u.title), close),
      kv([
        [LABELS.card.place, placeNodes],
        [LABELS.card.how, LABELS.via[c.via ?? '없음'] ?? c.via],
        records ? [LABELS.card.records, records] : null,
        pieceList ? [fmt.TERM.piece, pieceList] : null,
        narrows.length ? [LABELS.card.narrow, narrows] : null,
        c.parallel ? [LABELS.parallel(chNum(c.parallel.with)), el('span', {}, LABELS.parallelHint, ' ', recLink(c.parallel.record))] : null,
        [fmt.TERM.release, [relLabel(u.tick), u.date ? ` · ${u.date}` : '', u.date_confidence === '추정' ? ' (추정)' : '']],
        d ? [fmt.DRIFT_TITLE, [driftBadge(c), ' ', driftSentence]] : null,
      ]));
    return card;
  }

  function syncSelection({ scroll }) {
    cardEl?.remove();
    cardEl = null;
    for (const n of root.querySelectorAll('.is-sel')) n.classList.remove('is-sel');
    if (!activeKey) return;
    const rows = [...root.querySelectorAll('.cr-row, .cg-row')].filter((r) => r.dataset.key === activeKey && r.offsetParent !== null);
    if (!rows.length) return;
    for (const r of rows) r.classList.add('is-sel');
    const target = rows.includes(lastRow) ? lastRow : rows[0];
    cardEl = buildCard(activeKey);
    target.after(cardEl);
    if (scroll) target.scrollIntoView({ block: 'center', behavior: 'auto' });
  }

  // ══ 줄 누르기 · 툴팁(위임) ═══════════════════════════════════════════════════
  const rowOf = (ev) => ev.target.closest?.('.cr-row, .cg-row');
  const pick = (row) => {
    lastRow = row;
    ownClick = true;
    try { state.set({ sel: activeKey === row.dataset.key && state.get().sel === `unit:${row.dataset.key}` ? '' : `unit:${row.dataset.key}` }); } finally { ownClick = false; }
  };
  const onClick = (ev) => { const row = rowOf(ev); if (row) pick(row); };
  const onKey = (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('.cr-row, .cg-row')) { ev.preventDefault(); pick(ev.target); } };
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
  function tipNode(c) {
    const u = c.u;
    // 추정으로 좁힌 자리만 그 이유를 한 줄 — 시간 단서 · 메인 챕터 자리는 설명 없이
    const guess = !c.records?.length && fmt.prose(c.narrows[0]?.reason) ? clip(fmt.prose(c.narrows[0].reason), 80) : null;
    return el('div', { class: 'cr-tip' },
      el('div', { class: 'cr-tip-title' }, u.title),
      el('div', {}, `${fmt.KIND[u.kind].label} · ${classLabel(c.class)}${spanText(c) ? ` · ${c.multi ? LABELS.multi : spanText(c)}` : ''}`),
      el('div', {}, `${relLabel(u.tick)}${u.date ? ` · ${u.date}` : ''}${c.drift ? ` · ${driftLabel(c.drift)}` : ''}`),
      guess ? el('div', { class: 'cr-tip-basis' }, guess) : null);
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
    if (changed.has('p') || changed.has('t') || changed.has('layers')) applyAll(s, { layoutChanged });
    if (changed.has('sel')) {
      const parsed = state.parseSel(s.sel);
      if (!s.sel) activeKey = null;
      else if (parsed?.type === 'unit') activeKey = byKey.has(parsed.id) ? parsed.id : null;
      syncSelection({ scroll: !ownClick });
    }
  });
  return () => {
    off();
    hideTip();
    clearTimeout(findTimer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', hideTip);
  };
}
