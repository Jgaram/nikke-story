/**
 * 탭 3 떡밥(W4) — 화면 3 "떡밥 하나가 풀려 온 흐름" + 화면 4 "떡밥 · 항목끼리의 관계"(docs/views.md 3 · 4절, 공개 축 36–57줄).
 * 첫 쓸모: 왼쪽에서 떡밥 하나를 고르면(기본 = 핵심 떡밥 J1) 오른쪽에 그 떡밥의 의문 · 사실이 한 줄씩 놓이고,
 * 던짐 → 복선 → 일부 회수 → 회수 · 뒤집힘이 읽은 순서(또는 작중 시간순) 축 위의 점과 선으로 이어진다. 안 풀린 의문은 오른쪽 끝까지 점선이 이어진다.
 *
 * 쓰는 JSON
 *   threads-flow.json (이 탭 — tools/site/export/threads.mjs)  { <떡밥 ID>: { roots[](의문 · 사실 + 단계 points[]), echoes[](떡밥 전체를 가리킨 복선), units[] } }
 *   threads-map.json  (이 탭)  concepts[] · edges[](떡밥 ↔ 항목) · pairs[](항목 ↔ 항목) · relations{}(관계 근거 자리) · closures[](연작 · 갈등 결말) · merges[](함께 맺음) · chrono{}(작중 순서)
 *   공용(idx): threads.json(떡밥 60 · 관계 44) · units.json(스토리 · 범위) · ticks.json · targets.json. 기록 문장(records*.json)은 첫 렌더 1.5초 뒤 한가할 때 받아 말풍선에 싣는다(못 받아도 근거 줄만으로 돈다).
 *
 * URL 파라미터(p.*)
 *   j       고른 떡밥 ID(없으면 J1, 아직 안 나왔으면 나온 것 중 첫째). sel=thread:J5로 들어와도 같다
 *   axis    story면 작중 시간순, 없으면 출시 순서
 *   f       흐름 거르개 — unsolved(안 풀린 의문) · solved(풀린 의문) · fact(사실), 없으면 전부
 *   map     지도 보기 — rel(떡밥끼리) · item(항목) · list(목록). 없으면 넓은 화면은 떡밥끼리, 좁은 화면(< 760px, 처음 열 때 한 번 판단)은 목록
 *   c       항목 보기에서 고른 항목 ID(target ID). 없으면 가장 많은 떡밥을 잇는 항목
 *   common  1이면 자주 나오는 항목(떡밥 9개 이상에 걸친 항목)도 보인다
 *   hints   1이면 복선만 나온 줄(첫 자리 앞이라 문장을 가린 줄)도 보인다. 기본은 접어 두고 개수만 보인다
 *   sort    목록 정렬 — open(미해결 많은 순) · start(먼저 나온 순), 없으면 중요도순
 *
 * 그리는 규칙
 *   여기까지 읽음 T: 의문 · 사실의 상태는 fmt.stateAt(뿌리, T)로 T에서 다시 계산한다. T 뒤 단계 · 스토리 열은 지우고 개수만 "스포일러로 가림"에 보인다.
 *     떡밥이 시작됐는가 = 뿌리 하나라도 첫 자리(첫 던짐 · 첫 밝혀짐)가 T 안. 시작 전 떡밥은 지도에서 이름 없는 점(자리는 그대로 — 슬라이더를 움직여도 배치가 튀지 않는다)이다.
 *     첫 자리 앞에 복선만 나온 뿌리("복선만")는 문장을 가린 줄로 접어 두고(p.hints), 범위(layers) 밖 스토리의 단계도 같이 가린다 —
 *     가린 개수는 맨 위에 "스포일러로 가림 · 떡밥 N · 이 떡밥의 단계 M"(전부 보기) / "범위 밖 …"(범위 전부)로 보인다.
 *   지도: 관계가 있는 떡밥(원인 · 맞물림 · 같은 진실 · 포함)만 결정적 힘 배치(핵심은 가운데, 보조는 바깥)로, 나머지는 아래 격자로. 노드 크기 · 색 = 중요도(핵심 > 보조 > 곁가지),
 *     속이 찬 정도 = 안 풀린 의문(미해결 + 일부 회수) 비율. 선 모양 = 관계 종류(원인 화살표 · 맞물림 가는 실선 · 같은 진실 이중선 · 포함 점선 화살표). 항목 보기는 항목 하나를 골라 그 항목을 다루는 떡밥을 잇는다.
 *   흐름: 의문 · 사실 한 줄(스윔레인) = 라벨 한 줄 + 아래 점 줄. 열 = 그 떡밥의 단계가 놓인 스토리(출시 순서 또는 작중 순서, 작중 시점을 모르는 스토리는 오른쪽에 따로).
 *     줄은 첫 점이 나온 열이 앞인 순(폭포 모양). 점 모양 = 단계(떡밥 던짐 · 복선 · 다시 언급 · 일부 회수 · 회수 · 처음 밝혀짐 · 다시 확인 · 뒤집힘), 색은 상태 토큰(--state-*).
 *     굵은 선 = 빌드업 마무리(긴 회수 · 복선의 답) — 복선이 처음 나온 자리부터 답까지. 끝 점은 고리. 작중순에서 공개와 반대로 가는 선은 점선 화살표.
 *     맨 아래: 이 떡밥에 붙은 결말(연작 · 갈등, ◇) · 함께 맺음(H, 큰 ◆ — 멤버 결말 줄과 세로선).
 *   점을 누르면 sel=record:ID, 줄 라벨은 그 뿌리 기록, 열 머리글은 스토리를 리더로 연다. "자세히"는 sel=thread:ID. 점 위 설명은 단계 · 스토리 · 출시 시점 · 근거(씬 줄) 한 줄.
 *
 * 외부 라이브러리 없음(배치는 이 파일의 힘 배치) — d3가 없어도 그려진다. 색은 style.css 토큰 + 이 탭 CSS의 --thr-* 토큰(라이트 · 다크).
 */
export const meta = { id: 'threads', title: '떡밥', blurb: '떡밥 하나가 던져진 뒤 복선을 거쳐 풀리거나 뒤집히는 흐름과, 떡밥 · 항목끼리의 관계' };

/** fmt에 없는 화면 말은 여기 한 곳에서만 고친다 */
const LABELS = {
  rel: '떡밥끼리', item: '항목', list: '목록', mapView: '지도 보기',
  axisPub: '출시 순서', axisStory: '작중 시간순', axisName: '가로축',
  filterAll: '전부', filterUnsolved: '안 풀린 의문', filterSolved: '풀린 의문', filterFact: '사실', filterName: '보기',
  q: '의문', f: '사실', echoLane: '떡밥 전체를 가리킨 복선', closureY: '연작의 결말', closureC: '갈등의 결말',
  maskedBar: (n) => `복선만 나온 줄 ${n}`, maskedShow: '보기', maskedHide: '숨기기',
  maskedQ: '아직 던져지지 않은 떡밥', maskedF: '아직 밝혀지지 않은 사실',
  details: '자세히', legend: '범례', sortName: '정렬', sortWeight: '중요도순', sortOpen: '미해결 많은 순', sortStart: '먼저 나온 순', pick: '떡밥 고르기',
  hiddenThreads: '떡밥', hiddenSteps: '이 떡밥의 단계', hiddenMemo: '스포일러로 가림',
  notStarted: '아직 시작하지 않은 떡밥', noneStarted: '여기까지 읽은 범위에는 아직 떡밥이 없다',
  startsAt: (t) => `${t}부터 나온다`, startsCount: (t, n) => `${t}부터 떡밥 ${n}개가 나온다`, raiseCutoff: (t) => `${t}까지 읽음으로`,
  stories: '스토리', unsolved: '미해결', itemsOf: '다루는 항목', related: '이어진 떡밥', moreItems: (n) => `+${n}`,
  noRelation: (n) => `관계가 없는 떡밥 ${n}`, ghost: '아직 안 나온 떡밥',
  commonItems: '자주 나오는 항목 포함', itemSearch: '항목 찾기', itemMore: '더 보기', itemNone: '조건에 맞는 항목이 없다',
  itemThreads: (n) => `떡밥 ${n}`, withItems: '함께 나오는 항목', openDict: '사전에서 보기',
  gapFirst: '처음 나온 자리보다 앞', answer: '답', long: '오래 걸린 회수', hintAnswer: '복선의 답',
  legendBuilt: '쌓인 이야기', legendEnd: '결말',
  legendBold: '굵은 선 = 긴 복선 · 오래 걸린 회수', legendOpen: '점선 = 아직 이어지는 중', legendBack: '점선 화살표 = 작중으로는 앞선 일이 나중에 공개',
  legendWeight: '중요도', legendFill: '속이 찬 정도 = 안 풀린 의문 비율', legendEdge: '관계',
  relNames: { 원인: '원인', 맞물림: '맞물림', '같은 진실': '같은 진실', 포함: '포함' },
  relOut: { 원인: '원인 →', 맞물림: '맞물림 ↔', '같은 진실': '같은 진실 =', 포함: '포함 ⊃' },
  relIn: { 원인: '← 원인', 맞물림: '맞물림 ↔', '같은 진실': '같은 진실 =', 포함: '⊂ 속함' },
  relHelp: { 원인: '앞 떡밥이 뒤 떡밥의 원인이 된다', 맞물림: '서로 얽혀 함께 풀린다', '같은 진실': '같은 진실의 다른 면', 포함: '앞 떡밥이 뒤 떡밥을 품는다' },
  empty: { unsolved: '안 풀린 의문이 없다', solved: '풀린 의문이 없다', fact: '사실이 없다', all: '이 범위에는 보일 단계가 없다' },
};
/** 떡밥 9개 이상에 걸친 항목은 어디에나 있어 기본으로 숨긴다 */
const COMMON_MIN = 9;
const WEIGHTS = ['뼈대', '보강', '독립'];
const WEIGHT_VAR = { 뼈대: 'var(--thr-core)', 보강: 'var(--thr-support)', 독립: 'var(--thr-side)' };
const STAGE_KEY = { 제기: 'raise', 암시: 'hint', 재언급: 'again', '일부 회수': 'part', 회수: 'solve', '처음 밝혀짐': 'known', 보강: 'recheck', 뒤집힘: 'rev' };
/** 범례에 놓는 순서 */
const LEGEND_Q = ['제기', '암시', '재언급', '일부 회수', '회수'];
const LEGEND_F = ['처음 밝혀짐', '보강', '뒤집힘'];

// 흐름 그림 치수(px)
const LANE_H = 46; // 라벨 한 줄일 때(좁은 폭은 두 줄 — LANE_H2)
const LANE_H2 = 62;
const TRACK_Y = 35;
const TRACK_Y2 = 51;
const NARROW_W = 520;
const PAD_L = 16;
const PAD_R = 14;
const HEAD_MAX = 118;
const COL_MAX = 46;
// 지도 치수(viewBox 단위)
const MAP_W = 330;
const MAP_FS = 11;

const NS = 'http://www.w3.org/2000/svg';
/** SVG 요소 만들기(ui.el의 SVG판) */
function s(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

const keyActivate = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
const clip = (str, n) => {
  const a = [...String(str ?? '')];
  return a.length > n ? `${a.slice(0, n - 1).join('')}…` : a.join('');
};
const shortTitle = (t) => String(t.title).split(' — ')[0];
const rootNo = (id) => Number((/\d+/.exec(String(id)) ?? [0])[0]);
/** 글자 폭 어림(힘 배치 · 지도 라벨 — 브라우저 없이도 같은 값) */
function estWidth(text, fs) {
  let w = 0;
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    w += c > 0x2e80 ? 1 : c === 32 ? 0.35 : c >= 65 && c <= 90 ? 0.68 : 0.56;
  }
  return w * fs;
}

// ── 지도 배치: 결정적 힘 배치(난수 없음) ──
/** 노드마다 띠(lo–hi)가 있다 — 가운데에서 그 거리 안에 머물도록 민다(핵심은 안쪽 띠, 보조는 바깥 띠). 세로를 1.2배 늘린 타원 거리 */
function simulate(nodes, links, W, H, iters = 560) {
  const cx = W / 2;
  const cy = H / 2;
  const ASPECT = 1.2;
  nodes.forEach((d, i) => {
    const a = i * 2.39996;
    const rr = (d.lo + d.hi) / 2 * (0.6 + 0.4 * (((i * 7) % 5) / 4));
    d.x = cx + rr * Math.cos(a);
    d.y = cy + rr * ASPECT * Math.sin(a);
    d.vx = 0;
    d.vy = 0;
  });
  const at = new Map(nodes.map((d, i) => [d.id, i]));
  const ls = links.map((l) => [at.get(l.a), at.get(l.b)]).filter(([a, b]) => a != null && b != null);
  for (let it = 0; it < iters; it++) {
    const alpha = 0.1 + 0.9 * (1 - it / iters) ** 1.4;
    for (const d of nodes) { d.fx = 0; d.fy = 0; }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (i - j) * 0.3; dy = 0.2; d2 = dx * dx + dy * dy; }
        const d = Math.sqrt(d2);
        const ux = dx / d;
        const uy = dy / d;
        const f = 5200 / (d2 + 80);
        a.fx -= ux * f; a.fy -= uy * f; b.fx += ux * f; b.fy += uy * f;
        const min = a.r + b.r + 22;
        if (d < min) { const p = (min - d) * 0.7; a.fx -= ux * p; a.fy -= uy * p; b.fx += ux * p; b.fy += uy * p; }
      }
    }
    for (const [i, j] of ls) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - (52 + a.r + b.r)) * 0.03;
      a.fx += (dx / d) * f; a.fy += (dy / d) * f; b.fx -= (dx / d) * f; b.fy -= (dy / d) * f;
    }
    for (const d of nodes) {
      const dx = d.x - cx;
      const dy = (d.y - cy) / ASPECT;
      const dist = Math.hypot(dx, dy) || 1;
      const out = dist < d.lo ? d.lo - dist : dist > d.hi ? d.hi - dist : 0;
      const f = out * 0.09;
      d.fx += (dx / dist) * f;
      d.fy += (dy / dist) * f * ASPECT;
    }
    for (const d of nodes) {
      d.vx = (d.vx + d.fx) * 0.55;
      d.vy = (d.vy + d.fy) * 0.55;
      d.x += d.vx * alpha;
      d.y += d.vy * alpha;
    }
  }
}

/** 관계가 있는 떡밥의 위치 + 관계 없는 떡밥의 격자 + 라벨 자리 */
function layoutMap(threads, relations) {
  const deg = new Map();
  for (const g of relations) { deg.set(g.from, (deg.get(g.from) ?? 0) + 1); deg.set(g.to, (deg.get(g.to) ?? 0) + 1); }
  const R = { 뼈대: 10.5, 보강: 7.5, 독립: 5.2 };
  const conn = threads.filter((t) => deg.has(t.id));
  const rest = threads.filter((t) => !deg.has(t.id));
  const nodes = conn.map((t) => ({ id: t.id, weight: t.weight, r: R[t.weight] ?? 6, lo: t.weight === '뼈대' ? 20 : 105, hi: t.weight === '뼈대' ? 100 : 170, deg: deg.get(t.id), label: clip(shortTitle(t), 9), short: clip(shortTitle(t), 5) }));
  const bw = 360;
  const bh = 360;
  simulate(nodes, relations.map((g) => ({ a: g.from, b: g.to })), bw, bh);
  // 경계에 맞춰 늘이고 가운데로 — 라벨 여유 가장자리 36
  const minX = Math.min(...nodes.map((d) => d.x - d.r));
  const maxX = Math.max(...nodes.map((d) => d.x + d.r));
  const minY = Math.min(...nodes.map((d) => d.y - d.r));
  const maxY = Math.max(...nodes.map((d) => d.y + d.r));
  const padX = 30;
  const padY = 20;
  const sc = Math.min((MAP_W - 2 * padX) / (maxX - minX), 1.6);
  const forceH = (maxY - minY) * sc + 2 * padY;
  for (const d of nodes) {
    d.x = padX + (d.x - minX) * sc + ((MAP_W - 2 * padX) - (maxX - minX) * sc) / 2;
    d.y = padY + (d.y - minY) * sc;
  }
  // 라벨: 겹치지 않는 자리 하나(오른쪽 → 왼쪽 → 아래 → 위 → 대각선), 안 되면 줄인 이름, 그래도 안 되면 이름 없이(툴팁)
  const boxes = nodes.map((d) => ({ id: d.id, x0: d.x - d.r - 1, y0: d.y - d.r - 1, x1: d.x + d.r + 1, y1: d.y + d.r + 1 }));
  const placed = [];
  const overlap = (a, b) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
  const hit = (b, skip) => placed.some((p) => overlap(b, p)) || boxes.some((p) => p.id !== skip && overlap(b, p));
  const order = nodes.slice().sort((a, b) => WEIGHTS.indexOf(a.weight) - WEIGHTS.indexOf(b.weight) || b.deg - a.deg);
  const h = MAP_FS + 1;
  for (const d of order) {
    d.labelAt = null;
    const texts = [d.label, d.short].filter((t, i, a) => t && a.indexOf(t) === i);
    for (const text of texts) {
      const w = estWidth(text, MAP_FS);
      const g = d.r + 3;
      const cands = [
        { x: d.x + g, y: d.y + h / 3, anchor: 'start', x0: d.x + g, x1: d.x + g + w, y0: d.y - h / 2 - 1, y1: d.y + h / 2 + 1 },
        { x: d.x - g, y: d.y + h / 3, anchor: 'end', x0: d.x - g - w, x1: d.x - g, y0: d.y - h / 2 - 1, y1: d.y + h / 2 + 1 },
        { x: d.x, y: d.y + d.r + h, anchor: 'middle', x0: d.x - w / 2, x1: d.x + w / 2, y0: d.y + d.r + 1, y1: d.y + d.r + h + 2 },
        { x: d.x, y: d.y - d.r - 3, anchor: 'middle', x0: d.x - w / 2, x1: d.x + w / 2, y0: d.y - d.r - h - 2, y1: d.y - d.r },
        { x: d.x + g * 0.7, y: d.y + d.r + h - 2, anchor: 'start', x0: d.x + g * 0.7, x1: d.x + g * 0.7 + w, y0: d.y + d.r * 0.4, y1: d.y + d.r + h },
        { x: d.x - g * 0.7, y: d.y + d.r + h - 2, anchor: 'end', x0: d.x - g * 0.7 - w, x1: d.x - g * 0.7, y0: d.y + d.r * 0.4, y1: d.y + d.r + h },
        { x: d.x + g * 0.7, y: d.y - d.r - 1, anchor: 'start', x0: d.x + g * 0.7, x1: d.x + g * 0.7 + w, y0: d.y - d.r - h, y1: d.y - d.r * 0.4 },
        { x: d.x - g * 0.7, y: d.y - d.r - 1, anchor: 'end', x0: d.x - g * 0.7 - w, x1: d.x - g * 0.7, y0: d.y - d.r - h, y1: d.y - d.r * 0.4 },
      ];
      for (const c of cands) {
        const b = { x0: c.x0 - 1, x1: c.x1 + 1, y0: c.y0, y1: c.y1 };
        if (b.x0 < 2 || b.x1 > MAP_W - 2 || b.y0 < 2) continue;
        if (hit(b, d.id)) continue;
        d.labelAt = { x: c.x, y: c.y, anchor: c.anchor, text };
        placed.push(b);
        break;
      }
      if (d.labelAt) break;
    }
  }
  // 관계 없는 떡밥: 격자
  const per = 12;
  const gx = (MAP_W - 2 * 20) / (per - 1);
  const gridTop = forceH + 34;
  const grid = rest.map((t, i) => ({ id: t.id, weight: t.weight, r: R[t.weight] ?? 5, x: 20 + (i % per) * gx, y: gridTop + Math.floor(i / per) * 22, label: clip(shortTitle(t), 9), deg: 0 }));
  const height = rest.length ? gridTop + Math.ceil(rest.length / per) * 22 : forceH;
  return { nodes, grid, forceH, gridTop: gridTop - 24, height, byId: new Map([...nodes, ...grid].map((d) => [d.id, d])) };
}

// ── 점 모양(단계) ──
/** 가운데가 (0,0)인 모양 — 색은 CSS 클래스(.thr-m-*) */
function markShape(key) {
  switch (key) {
    case 'raise': return [s('circle', { r: 5.4, class: 'thr-m thr-m-raise' })];
    case 'hint': return [s('circle', { r: 3.7, class: 'thr-m thr-m-hint' })];
    case 'again': return [s('path', { d: 'M0,-4.4 L4.4,0 L0,4.4 L-4.4,0 Z', class: 'thr-m thr-m-again' })];
    case 'part': return [s('circle', { r: 5.4, class: 'thr-m thr-m-part' }), s('path', { d: 'M0,-5 A5,5 0 0 0 0,5 Z', class: 'thr-m-part-fill' })];
    case 'solve': return [s('circle', { r: 5.8, class: 'thr-m thr-m-solve' }), s('path', { d: 'M-2.7,0.2 L-0.8,2.3 L2.9,-2.3', class: 'thr-m-glyph' })];
    case 'known': return [s('rect', { x: -4.6, y: -4.6, width: 9.2, height: 9.2, rx: 2, class: 'thr-m thr-m-known' })];
    case 'recheck': return [s('rect', { x: -3.7, y: -3.7, width: 7.4, height: 7.4, rx: 1.6, class: 'thr-m thr-m-recheck' })];
    case 'rev': return [s('circle', { r: 5.8, class: 'thr-m thr-m-rev' }), s('path', { d: 'M-2.4,-2.4 L2.4,2.4 M2.4,-2.4 L-2.4,2.4', class: 'thr-m-glyph' })];
    case 'built': return [s('rect', { x: -3.4, y: -3.4, width: 6.8, height: 6.8, rx: 1.2, transform: 'rotate(45)', class: 'thr-m thr-m-built' })];
    case 'end': return [s('path', { d: 'M0,-6.8 L6.8,0 L0,6.8 L-6.8,0 Z', class: 'thr-m thr-m-end' })];
    case 'merge': return [s('path', { d: 'M0,-8.4 L8.4,0 L0,8.4 L-8.4,0 Z', class: 'thr-m thr-m-merge' })];
    default: return [s('circle', { r: 4, class: 'thr-m thr-m-hint' })];
  }
}
/** 범례 칸 하나 — 모양 + 이름 */
function legendMark(ui, key, label) {
  const svg = s('svg', { width: 16, height: 16, viewBox: '-8 -8 16 16', class: 'thr-lg-svg', 'aria-hidden': 'true' }, markShape(key));
  return ui.el('span', { class: 'legend-item' }, svg, label);
}

/** 배치만 따로 확인할 때(tests · 스크립트) */
export const _layoutMap = layoutMap;

export async function mount(root, ctx) {
  const { state, data, fmt, ui, idx } = ctx;
  const [flow, map] = await Promise.all([data.load('threads-flow'), data.load('threads-map')]);

  // ── 자료 준비 ──
  const threads = idx.threadList.slice().sort((a, b) => WEIGHTS.indexOf(a.weight) - WEIGHTS.indexOf(b.weight) || rootNo(a.id) - rootNo(b.id));
  const byId = idx.threads;
  const relations = idx.relations ?? [];
  const concepts = new Map(map.concepts.map((c) => [c.id, c]));
  const edgesOfThread = new Map();
  const edgesOfConcept = new Map();
  for (const e of map.edges) {
    (edgesOfThread.get(e.j) ?? edgesOfThread.set(e.j, []).get(e.j)).push(e);
    (edgesOfConcept.get(e.target) ?? edgesOfConcept.set(e.target, []).get(e.target)).push(e);
  }
  const pairsOf = new Map();
  for (const p of map.pairs) {
    (pairsOf.get(p.a) ?? pairsOf.set(p.a, []).get(p.a)).push({ other: p.b, records: p.records });
    (pairsOf.get(p.b) ?? pairsOf.set(p.b, []).get(p.b)).push({ other: p.a, records: p.records });
  }
  const startTick = new Map();
  for (const t of threads) {
    const ts = (flow[t.id]?.roots ?? []).map((r) => r.first_tick).filter((x) => x != null);
    startTick.set(t.id, ts.length ? Math.min(...ts) : null);
  }
  const wLabel = (w) => fmt.THREAD_WEIGHT[w]?.label ?? w;
  const when = (tick) => {
    const sh = fmt.tickShort(tick);
    return sh.endsWith('+') ? `${sh.slice(0, -1)} 이후` : `${sh} 시점`;
  };
  const stageLabel = (st) => fmt.ACT[st] ?? st;
  const layout = layoutMap(threads, relations);
  const rec = (id) => idx.records?.get(id) ?? null;

  // 화면 폭(휴대폰 · 좁은 창)은 처음 한 번만 본다 — 리더가 열리고 닫혀도 보기가 바뀌지 않게
  const compact = window.innerWidth < 760;

  // 지금 상태(파라미터 · 컷오프)
  const P = (k) => state.param(meta.id, k);
  const cutoff = () => state.get().t;
  let stats = new Map();
  const computeStats = () => {
    const T = cutoff();
    stats = new Map();
    for (const t of threads) {
      const c = { 열림: 0, 일부: 0, 풀림: 0, 앎: 0, 뒤집힘: 0, 암시만: 0, 아직: 0, q: 0, f: 0 };
      const us = new Set();
      for (const r of flow[t.id]?.roots ?? []) {
        c[fmt.stateAt(r, T)] += 1;
        if (r.kind === 'Q') c.q += 1; else c.f += 1;
        for (const p of r.points) if (T == null || p.t <= T) us.add(p.u);
      }
      c.units = us.size;
      c.started = c.열림 + c.일부 + c.풀림 + c.앎 + c.뒤집힘 > 0;
      c.unsolved = c.열림 + c.일부;
      const den = c.열림 + c.일부 + c.풀림;
      c.ratio = den ? c.unsolved / den : 0;
      stats.set(t.id, c);
    }
  };
  const startedThreads = () => threads.filter((t) => stats.get(t.id)?.started);
  /** 지금 보는 떡밥: 파라미터 → 아니면 J1 → 나온 것 중 첫째 */
  const currentId = () => {
    const j = P('j');
    if (j && byId.has(j)) return j;
    const sel = state.parseSel(state.get().sel);
    if (sel?.type === 'thread' && byId.has(sel.id)) return sel.id;
    if (stats.get('J1')?.started) return 'J1';
    return startedThreads()[0]?.id ?? 'J1';
  };

  // ── 말풍선(한 개를 돌려 쓴다 — 다시 그려도 남지 않는다) ──
  const tips = new WeakMap();
  const tipEl = ui.el('div', { class: 'tooltip thr-tip', role: 'tooltip' });
  tipEl.hidden = true;
  document.body.append(tipEl);
  let tipTarget = null;
  let recordsAsked = false;
  const hideTip = () => { tipTarget = null; tipEl.hidden = true; };
  const showTip = (target) => {
    const make = tips.get(target);
    if (!make) return hideTip();
    const body = make();
    if (!body) return hideTip();
    tipTarget = target;
    ui.clear(tipEl);
    tipEl.append(body);
    tipEl.hidden = false;
    const r = target.getBoundingClientRect();
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = r.bottom + 8 + h > window.innerHeight ? Math.max(8, r.top - h - 8) : r.bottom + 8;
    tipEl.style.left = `${left}px`;
    tipEl.style.top = `${top}px`;
    if (!recordsAsked && !idx.records) { recordsAsked = true; idx.withRecords?.().catch(() => {}); }
  };
  const tipHost = (e) => e.target.closest?.('[data-tip]');
  const wireTips = (host) => {
    host.addEventListener('pointerover', (e) => { const t = tipHost(e); if (t && t !== tipTarget) showTip(t); });
    host.addEventListener('pointerout', (e) => { const t = tipHost(e); if (t && !t.contains(e.relatedTarget)) hideTip(); });
    host.addEventListener('focusin', (e) => { const t = tipHost(e); if (t) showTip(t); });
    host.addEventListener('focusout', hideTip);
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  };
  const tipLine = (...kids) => ui.el('div', { class: 'thr-tip-line' }, ...kids);
  const tipFor = (el, make) => { el.setAttribute('data-tip', ''); tips.set(el, make); };

  // ── 뼈대 DOM ──
  const noteEl = ui.el('div', { class: 'thr-note', role: 'status', 'aria-live': 'polite' });
  root.append(ui.el('div', { class: 'thr-tabhead' }, ui.el('h2', { class: 'sr-only' }, meta.title), noteEl));
  const wrap = ui.el('div', { class: 'thr-wrap' });
  const grid = ui.el('div', { class: 'thr-grid' });
  const side = ui.el('aside', { class: 'thr-side', 'aria-label': LABELS.mapView });
  const flowEl = ui.el('section', { class: 'thr-flow', 'aria-label': meta.title });
  grid.append(flowEl, side);
  wrap.append(grid);
  root.append(wrap);

  // ═════════ 왼쪽: 지도 · 항목 · 목록 ═════════
  const defaultMode = compact ? 'list' : 'rel';
  const modeNow = () => (['rel', 'item', 'list'].includes(P('map')) ? P('map') : defaultMode);
  const modeSeg = ui.segmented({
    label: LABELS.mapView,
    options: [{ value: 'rel', label: LABELS.rel }, { value: 'item', label: LABELS.item }, { value: 'list', label: LABELS.list }],
    value: modeNow(),
    onChange: (v) => state.setParam(meta.id, 'map', v === defaultMode ? null : v),
  });
  const mapLegend = ui.el('div', { class: 'thr-maplegend' });
  const mapHost = ui.el('div', { class: 'thr-maphost' });
  const itemPane = ui.el('div', { class: 'thr-itempane' });
  const listPane = ui.el('div', { class: 'thr-listpane' });
  side.append(ui.el('div', { class: 'thr-side-head' }, modeSeg.el), mapLegend, mapHost, itemPane, listPane);

  // 범례(지도)
  {
    const sw = (w, r) => {
      const svg = s('svg', { width: 2 * r + 4, height: 2 * r + 4, viewBox: `${-r - 2} ${-r - 2} ${2 * r + 4} ${2 * r + 4}`, 'aria-hidden': 'true' }, s('circle', { r, class: 'thr-node-ring', style: { stroke: WEIGHT_VAR[w] } }), s('circle', { r: r * 0.62, style: { fill: WEIGHT_VAR[w] } }));
      return ui.el('span', { class: 'legend-item', title: fmt.THREAD_WEIGHT_HELP[w] }, svg, wLabel(w));
    };
    const edgeSw = (type) => {
      const ln = (cls, y = 8) => s('line', { x1: 2, x2: 24, y1: y, y2: y, class: cls });
      const parts = { 원인: [ln('thr-e thr-e-cause'), s('path', { d: 'M24,8 l-6,-3.2 v6.4 z', class: 'thr-arrow' })], 맞물림: [ln('thr-e thr-e-link')], '같은 진실': [ln('thr-e thr-e-same'), ln('thr-e-same-inner')], 포함: [ln('thr-e thr-e-contain'), s('path', { d: 'M24,8 l-6,-3.2 v6.4 z', class: 'thr-arrow' })] }[type];
      return ui.el('span', { class: 'legend-item', title: LABELS.relHelp[type] }, s('svg', { width: 28, height: 16, viewBox: '0 0 28 16', 'aria-hidden': 'true' }, parts), LABELS.relNames[type]);
    };
    const fillSw = s('svg', { width: 40, height: 16, viewBox: '0 0 40 16', 'aria-hidden': 'true' },
      s('circle', { cx: 8, cy: 8, r: 6, class: 'thr-node-ring', style: { stroke: 'var(--ink-2)' } }),
      s('circle', { cx: 28, cy: 8, r: 6, class: 'thr-node-ring', style: { stroke: 'var(--ink-2)' } }), s('circle', { cx: 28, cy: 8, r: 4.2, style: { fill: 'var(--ink-2)' } }));
    mapLegend.append(
      ui.el('div', { class: 'legend' }, ui.el('span', { class: 'ctl-name' }, LABELS.legendWeight), WEIGHTS.map((w) => sw(w, { 뼈대: 7, 보강: 5.5, 독립: 4 }[w])), ui.el('span', { class: 'legend-item' }, fillSw, LABELS.legendFill)),
      ui.el('div', { class: 'legend' }, ui.el('span', { class: 'ctl-name' }, LABELS.legendEdge), ['원인', '맞물림', '같은 진실', '포함'].map(edgeSw)),
    );
  }

  // 지도 SVG(한 번 만들고, 컷오프 · 선택은 속성만 바꾼다)
  const mapSvg = s('svg', { class: 'thr-map', viewBox: `0 0 ${MAP_W} ${layout.height}`, role: 'group', 'aria-label': LABELS.mapView });
  mapHost.append(mapSvg);
  wireTips(mapHost);
  const gEdges = s('g', { class: 'thr-edges' });
  const gNodes = s('g', { class: 'thr-nodes' });
  const gOverlay = s('g', { class: 'thr-overlay' });
  mapSvg.append(gEdges, gNodes, gOverlay);
  if (layout.grid.length) {
    mapSvg.insertBefore(s('text', { x: 20, y: layout.gridTop + 6, class: 'thr-gridcap' }, LABELS.noRelation(layout.grid.length)), gEdges);
  }
  const nodeEls = new Map();
  const edgeEls = [];
  const selectThread = (j) => {
    state.set({ p: { j } });
    // 좁은 폭(왼쪽이 아래로 쌓일 때)에서는 흐름이 위에 있으니 거기로 올려 준다
    if (flowEl.offsetLeft <= side.offsetLeft + 8) flowEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const nodeTip = (t) => () => {
    const c = stats.get(t.id);
    return ui.el('div', {},
      tipLine(ui.el('strong', {}, t.title)),
      tipLine(`${wLabel(t.weight)} · ${fmt.STATE.열림.label} ${c.열림} · ${fmt.STATE.일부.label} ${c.일부} · ${fmt.STATE.풀림.label} ${c.풀림}`),
      c.f ? tipLine(`${LABELS.f} ${c.f}`) : null);
  };
  const dotFor = (d) => {
    const t = byId.get(d.id);
    const g = s('g', { class: 'thr-node', transform: `translate(${d.x.toFixed(1)},${d.y.toFixed(1)})`, tabindex: 0, role: 'button', 'data-j': d.id, 'aria-label': t.title,
      onClick: () => selectThread(d.id),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThread(d.id); } } });
    const col = WEIGHT_VAR[d.weight];
    g.append(s('circle', { r: d.r + 6, class: 'thr-hit' }), s('circle', { r: d.r + 3.5, class: 'thr-selring' }),
      s('circle', { r: d.r, class: 'thr-node-ring', style: { stroke: col } }), s('circle', { r: 0, class: 'thr-node-fill', style: { fill: col } }));
    if (d.labelAt) g.append(s('text', { x: (d.labelAt.x - d.x).toFixed(1), y: (d.labelAt.y - d.y).toFixed(1), 'text-anchor': d.labelAt.anchor, class: 'thr-node-label' }, d.labelAt.text));
    tipFor(g, nodeTip(t));
    nodeEls.set(d.id, { g, d });
    return g;
  };
  for (const d of [...layout.grid, ...layout.nodes]) gNodes.append(dotFor(d));
  const arrowAt = (x1, y1, x2, y2, r2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tx = x2 - ux * (r2 + 2);
    const ty = y2 - uy * (r2 + 2);
    const px = -uy;
    const py = ux;
    return `M${tx.toFixed(1)},${ty.toFixed(1)} L${(tx - ux * 7 + px * 3.4).toFixed(1)},${(ty - uy * 7 + py * 3.4).toFixed(1)} L${(tx - ux * 7 - px * 3.4).toFixed(1)},${(ty - uy * 7 - py * 3.4).toFixed(1)} Z`;
  };
  for (const g of relations) {
    const a = layout.byId.get(g.from);
    const b = layout.byId.get(g.to);
    if (!a || !b) continue;
    const grp = s('g', { class: 'thr-edge', 'data-g': g.id, 'data-from': g.from, 'data-to': g.to });
    const cls = { 원인: 'thr-e-cause', 맞물림: 'thr-e-link', '같은 진실': 'thr-e-same', 포함: 'thr-e-contain' }[g.type];
    const line = (c) => s('line', { x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1), class: c });
    grp.append(line(`thr-e ${cls}`));
    if (g.type === '같은 진실') grp.append(line('thr-e-same-inner'));
    if (g.type === '원인' || g.type === '포함') grp.append(s('path', { d: arrowAt(a.x, a.y, b.x, b.y, b.r), class: 'thr-arrow' }));
    grp.append(line('thr-e-hit'));
    grp.setAttribute('tabindex', '0');
    grp.setAttribute('role', 'button');
    grp.setAttribute('aria-label', `${shortTitle(byId.get(g.from))} ${LABELS.relNames[g.type]} ${shortTitle(byId.get(g.to))}`);
    if (g.basis?.length) {
      grp.addEventListener('click', () => state.set({ sel: `record:${g.basis[0]}` }));
      grp.addEventListener('keydown', keyActivate(() => state.set({ sel: `record:${g.basis[0]}` })));
    }
    tipFor(grp, () => ui.el('div', {},
      tipLine(ui.el('strong', {}, `${shortTitle(byId.get(g.from))} ${LABELS.relOut[g.type].split(' ')[1]} ${shortTitle(byId.get(g.to))}`)),
      tipLine(`${LABELS.relNames[g.type]} — ${LABELS.relHelp[g.type]}`), tipLine(g.text),
      g.basis?.length ? tipLine(ui.el('span', { class: 'mono' }, g.basis.slice(0, 4).join(' · ')), g.confidence === '추정' ? ` · ${fmt.CONFIDENCE.추정.label}` : '') : null));
    gEdges.append(grp);
    edgeEls.push({ grp, g });
  }

  // 지도 갱신: 컷오프(시작 전 떡밥) · 선택 · 관련 강조 · 항목 겹침
  const refreshMap = () => {
    const T = cutoff();
    const cur = currentId();
    const mode = modeNow();
    const cId = mode === 'item' ? conceptNow() : null;
    const cThreads = new Set(cId ? (edgesOfConcept.get(cId) ?? []).filter((e) => T == null || e.tick == null || e.tick <= T).map((e) => e.j) : []);
    const near = new Set();
    for (const g of relations) { if (g.from === cur) near.add(g.to); if (g.to === cur) near.add(g.from); }
    for (const [id, { g, d }] of nodeEls) {
      const c = stats.get(id);
      const on = c.started;
      g.classList.toggle('is-ghost', !on);
      g.classList.toggle('is-sel', id === cur);
      g.classList.toggle('is-near', on && near.has(id));
      g.classList.toggle('is-concept', on && cThreads.has(id));
      g.classList.toggle('is-dim', on && ((cId && !cThreads.has(id) && id !== cur) || false));
      if (!on) { g.removeAttribute('role'); g.tabIndex = -1; g.setAttribute('aria-hidden', 'true'); g.setAttribute('aria-label', LABELS.ghost); } else { g.setAttribute('role', 'button'); g.tabIndex = 0; g.removeAttribute('aria-hidden'); g.setAttribute('aria-label', byId.get(id).title); }
      const fill = g.querySelector('.thr-node-fill');
      fill.setAttribute('r', (d.r * Math.sqrt(on ? c.ratio : 0)).toFixed(2));
      const ring = g.querySelector('.thr-node-ring');
      ring.setAttribute('r', on ? d.r : 3.2);
      const lab = g.querySelector('.thr-node-label');
      if (lab) lab.style.display = on ? '' : 'none';
    }
    for (const { grp, g } of edgeEls) {
      const aOn = stats.get(g.from)?.started;
      const bOn = stats.get(g.to)?.started;
      const tick = map.relations?.[g.id]?.tick;
      const shown = aOn && bOn && (T == null || tick == null || tick <= T);
      grp.style.display = shown ? '' : 'none';
      grp.classList.toggle('is-hot', shown && (g.from === cur || g.to === cur));
      grp.classList.toggle('is-faint', shown && mode === 'item' && Boolean(cId));
    }
    // 항목 겹침: 항목 노드 + 떡밥으로 가는 선
    ui.clear(gOverlay);
    if (cId && concepts.has(cId) && cThreads.size) {
      const pts = [...cThreads].map((j) => layout.byId.get(j)).filter(Boolean);
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const c = concepts.get(cId);
      for (const p of pts) gOverlay.append(s('line', { x1: cx.toFixed(1), y1: cy.toFixed(1), x2: p.x.toFixed(1), y2: p.y.toFixed(1), class: 'thr-c-edge' }));
      const label = clip(c.name, 12);
      const w = estWidth(label, MAP_FS) + 10;
      const lx = Math.max(w / 2 + 2, Math.min(MAP_W - w / 2 - 2, cx));
      gOverlay.append(s('g', { class: 'thr-concept-node', transform: `translate(${lx.toFixed(1)},${cy.toFixed(1)})` },
        s('rect', { x: -w / 2, y: -9, width: w, height: 18, rx: 4, class: 'thr-concept-box' }), s('text', { y: 4, 'text-anchor': 'middle', class: 'thr-concept-label' }, label)));
    }
  };

  // ── 항목 보기 ──
  let itemShown = 40;
  let itemQuery = '';
  const itemSearch = ui.el('input', { type: 'search', class: 'thr-itemsearch', placeholder: LABELS.itemSearch, 'aria-label': LABELS.itemSearch });
  itemSearch.addEventListener('input', () => { itemQuery = itemSearch.value.trim(); itemShown = 40; refreshItems(); });
  const commonToggle = ui.toggle({ label: LABELS.commonItems, checked: P('common') === '1', onChange: (v) => state.setParam(meta.id, 'common', v ? '1' : null) });
  const itemInfo = ui.el('div', { class: 'thr-iteminfo' });
  const itemList = ui.el('ul', { class: 'thr-itemlist plain' });
  const itemMore = ui.el('button', { type: 'button', class: 'btn', onClick: () => { itemShown += 40; refreshItems(); } }, LABELS.itemMore);
  itemPane.append(ui.el('div', { class: 'thr-itemtools' }, itemSearch, commonToggle), itemInfo, itemList, itemMore);
  const visibleEdges = (cid) => {
    const T = cutoff();
    return (edgesOfConcept.get(cid) ?? []).filter((e) => (T == null || e.tick == null || e.tick <= T) && stats.get(e.j)?.started);
  };
  const chooseItem = (cid) => state.setParam(meta.id, 'c', cid);
  /** 지금 읽은 데까지 둘 이상의 떡밥에 걸친 항목 — 떡밥을 많이 잇는 순 */
  const conceptRows = () => {
    const showCommon = P('common') === '1';
    const rows = map.concepts.map((c) => ({ c, es: visibleEdges(c.id) })).filter(({ c, es }) => es.length >= 2 && (showCommon || c.threads < COMMON_MIN));
    rows.sort((a, b) => b.es.length - a.es.length || b.c.records - a.c.records || a.c.name.localeCompare(b.c.name, 'ko'));
    return rows;
  };
  /** 고른 항목 — 고르지 않았으면 가장 많은 떡밥을 잇는 항목(빈 화면을 두지 않는다) */
  const conceptNow = () => (P('c') && concepts.has(P('c')) ? P('c') : conceptRows()[0]?.c.id ?? null);
  const refreshItems = () => {
    const showCommon = P('common') === '1';
    const cur = currentId();
    const mine = new Set((edgesOfThread.get(cur) ?? []).map((e) => e.target));
    const all = conceptRows();
    const rows = itemQuery ? all.filter(({ c }) => c.name.includes(itemQuery)) : all;
    // 고른 항목은 걸러져도 맨 위에 둔다
    const cid = conceptNow();
    const picked = cid ? { c: concepts.get(cid), es: visibleEdges(cid) } : null;
    ui.clear(itemList);
    const shown = rows.slice(0, itemShown);
    if (picked && !shown.some((r) => r.c.id === cid)) shown.unshift(picked);
    for (const { c, es } of shown) {
      const sel = c.id === cid;
      const li = ui.el('li', {}, ui.el('button', { type: 'button', class: ['thr-itembtn', sel ? 'is-sel' : '', mine.has(c.id) ? 'is-mine' : ''], 'aria-pressed': String(sel), onClick: () => chooseItem(c.id) },
        ui.el('span', { class: 'thr-itemname' }, c.name), ui.el('span', { class: 'thr-itemtype' }, fmt.TARGET_TYPE[c.type] ?? c.type), ui.el('span', { class: 'thr-itemcount' }, LABELS.itemThreads(es.length))));
      itemList.append(li);
    }
    if (!shown.length) itemList.append(ui.el('li', { class: 'empty' }, LABELS.itemNone));
    itemMore.hidden = rows.length <= itemShown;
    // 고른 항목 설명
    ui.clear(itemInfo);
    if (picked) {
      const pairs = (pairsOf.get(cid) ?? []).filter((p) => concepts.has(p.other) && (showCommon || concepts.get(p.other).threads < COMMON_MIN)).sort((a, b) => b.records - a.records).slice(0, 6);
      itemInfo.append(
        ui.el('div', { class: 'thr-iteminfo-head' }, ui.el('strong', {}, picked.c.name), ui.el('span', { class: 'muted' }, ` ${fmt.TARGET_TYPE[picked.c.type] ?? picked.c.type} · ${LABELS.itemThreads(picked.es.length)}`),
          ui.link(`target:${cid}`, LABELS.openDict)),
        pairs.length ? ui.el('div', { class: 'thr-chips' }, ui.el('span', { class: 'ctl-name' }, LABELS.withItems), pairs.map((p) => ui.el('button', { type: 'button', class: 'thr-chip', title: `${p.records}`, onClick: () => chooseItem(p.other) }, concepts.get(p.other).name))) : null);
    }
    commonToggle.set?.(showCommon);
  };

  // ── 목록 보기 ──
  const sortNow = () => (['open', 'start'].includes(P('sort')) ? P('sort') : 'weight');
  const sortSeg = ui.segmented({
    label: LABELS.sortName,
    options: [{ value: 'weight', label: LABELS.sortWeight }, { value: 'open', label: LABELS.sortOpen }, { value: 'start', label: LABELS.sortStart }],
    value: sortNow(),
    onChange: (v) => state.setParam(meta.id, 'sort', v === 'weight' ? null : v),
  });
  const listRows = ui.el('ul', { class: 'thr-listrows plain' });
  listPane.append(ui.el('div', { class: 'thr-listtools' }, ui.el('span', { class: 'ctl-name' }, LABELS.sortName), sortSeg.el), listRows);
  const refreshList = () => {
    sortSeg.set(sortNow());
    const cur = currentId();
    const rows = startedThreads().slice();
    const key = sortNow();
    if (key === 'open') rows.sort((a, b) => stats.get(b.id).unsolved - stats.get(a.id).unsolved || WEIGHTS.indexOf(a.weight) - WEIGHTS.indexOf(b.weight) || rootNo(a.id) - rootNo(b.id));
    else if (key === 'start') rows.sort((a, b) => (startTick.get(a.id) ?? 1e9) - (startTick.get(b.id) ?? 1e9) || rootNo(a.id) - rootNo(b.id));
    ui.clear(listRows);
    for (const t of rows) {
      const c = stats.get(t.id);
      const btn = ui.el('button', { type: 'button', class: ['thr-listrow', t.id === cur ? 'is-sel' : ''], 'aria-pressed': String(t.id === cur), onClick: () => selectThread(t.id) },
        ui.el('i', { class: 'thr-wdot', style: { background: WEIGHT_VAR[t.weight] }, title: `${wLabel(t.weight)} — ${fmt.THREAD_WEIGHT_HELP[t.weight]}`, 'aria-hidden': 'true' }),
        ui.el('span', { class: 'thr-listtitle' }, t.title),
        ui.el('span', { class: 'thr-liststat' }, `${c.q ? `${fmt.STATE.열림.label} ${c.열림} · ${fmt.STATE.일부.label} ${c.일부} · ${fmt.STATE.풀림.label} ${c.풀림}` : `${LABELS.f} ${c.앎 + c.뒤집힘}`} · ${LABELS.stories} ${c.units}`));
      listRows.append(ui.el('li', {}, btn));
    }
    if (!rows.length) listRows.append(ui.el('li', { class: 'empty' }, LABELS.noneStarted));
  };

  const refreshSideMode = () => {
    const mode = modeNow();
    modeSeg.set(mode);
    mapLegend.hidden = mode === 'list';
    mapHost.hidden = mode === 'list';
    itemPane.hidden = mode !== 'item';
    listPane.hidden = mode !== 'list';
    if (mode === 'item') refreshItems();
    if (mode === 'list') refreshList();
  };

  // ═════════ 오른쪽: 흐름 ═════════
  const headEl = ui.el('div', { class: 'thr-head' });
  const controlsEl = ui.el('div', { class: 'thr-controls' });
  const legendEl = ui.el('div', { class: 'thr-legend legend' });
  const chartHost = ui.el('div', { class: 'thr-chart' });
  const chartHead = s('svg', { class: 'thr-svg thr-svg-head', 'aria-hidden': 'true' });
  const chartBody = s('svg', { class: 'thr-svg thr-svg-body', role: 'group', 'aria-label': meta.title });
  const emptyEl = ui.el('div', { class: 'thr-empty' });
  const maskedBar = ui.el('div', { class: 'thr-maskedbar' });
  chartHost.append(ui.el('div', { class: 'thr-chart-headwrap' }, chartHead), chartBody);
  const legendWrap = ui.details(LABELS.legend, legendEl, { open: !compact, class: 'thr-legend-wrap' });
  flowEl.append(headEl, controlsEl, legendWrap, emptyEl, chartHost, maskedBar);
  wireTips(chartHost);

  const axisNow = () => (P('axis') === 'story' ? 'story' : 'pub');
  const filterNow = () => (['unsolved', 'solved', 'fact'].includes(P('f')) ? P('f') : 'all');

  // 범례(흐름)
  const legendExtra = ui.el('span', { class: 'thr-legend-extra' });
  const lineKeyOf = (cls, label) => ui.el('span', { class: 'legend-item thr-lg-line' }, s('svg', { width: 30, height: 12, viewBox: '0 0 30 12', 'aria-hidden': 'true' }, s('line', { x1: 2, x2: 28, y1: 6, y2: 6, class: cls })), label);
  {
    const lineKey = lineKeyOf;
    legendEl.append(
      ui.el('span', { class: 'ctl-name' }, LABELS.q), ...LEGEND_Q.map((st) => legendMark(ui, STAGE_KEY[st], stageLabel(st))),
      ui.el('span', { class: 'ctl-name' }, LABELS.f), ...LEGEND_F.map((st) => legendMark(ui, STAGE_KEY[st], stageLabel(st))),
      lineKey('thr-l thr-l-bold', LABELS.legendBold), lineKey('thr-l thr-l-open', LABELS.legendOpen), legendExtra,
    );
  }

  // 흐름 모델
  let model = null;
  const buildModel = (j) => {
    const T = cutoff();
    const layers = state.get().layers;
    const f = flow[j] ?? { roots: [] };
    const inT = (t) => T == null || t == null || t <= T;
    const layerOk = (u) => { const un = idx.units.get(u); return !un?.layer || layers.includes(un.layer); };
    let total = 0;
    let shown = 0;
    let hiddenL = 0; // 범위(layers) 밖이라 가린 단계
    const lanes = [];
    const maskedLanes = [];
    for (const r of f.roots) {
      total += r.points.length;
      const st = fmt.stateAt(r, T);
      if (st === '아직') continue;
      const inPts = r.points.filter((p) => inT(p.t));
      const pts = inPts.filter((p) => layerOk(p.u));
      hiddenL += inPts.length - pts.length;
      if (!pts.length) continue;
      if (st === '암시만') { maskedLanes.push({ type: 'root', id: r.id, kind: r.kind, text: r.text, state: st, masked: true, root: r, pts }); continue; }
      shown += pts.length;
      lanes.push({ type: 'root', id: r.id, kind: r.kind, text: r.text, state: st, masked: false, root: r, pts });
    }
    if (f.echoes?.length) {
      total += f.echoes.length;
      const inE = f.echoes.filter((e) => inT(e.t));
      const pts = inE.filter((e) => layerOk(e.u)).map((e) => ({ ...e }));
      hiddenL += inE.length - pts.length;
      if (pts.length) { shown += pts.length; lanes.push({ type: 'echo', id: `echo:${j}`, kind: 'E', text: LABELS.echoLane, state: null, pts }); }
    }
    const showMasked = P('hints') === '1';
    if (showMasked) for (const l of maskedLanes) { shown += l.pts.length; lanes.push(l); }
    const counts = { all: lanes.length, unsolved: 0, solved: 0, fact: 0, masked: maskedLanes.length };
    for (const l of lanes) {
      if (l.type !== 'root') continue;
      if (l.kind === 'F') counts.fact += 1;
      else if (l.state === '열림' || l.state === '일부') counts.unsolved += 1;
      else if (l.state === '풀림') counts.solved += 1;
    }
    const filt = filterNow();
    let shownLanes = lanes.filter((l) => (filt === 'all' ? true : l.type === 'root' && (filt === 'fact' ? l.kind === 'F' : filt === 'unsolved' ? l.kind === 'Q' && (l.state === '열림' || l.state === '일부') : l.kind === 'Q' && l.state === '풀림')));
    // 결말 · 함께 맺음은 전부 볼 때만
    if (filt === 'all') {
      for (const c of map.closures) {
        if (!c.threads?.includes(j)) continue;
        total += 1;
        if (!inT(c.end_tick)) continue;
        if (!layerOk(c.end)) { hiddenL += 1; continue; }
        const built = c.built.filter((u) => layerOk(u) && inT(idx.units.get(u)?.tick));
        shown += 1;
        shownLanes.push({ type: 'closure', id: c.id, text: c.text, ctype: c.type, built, end: c.end, state: null, pts: [] });
      }
      for (const m of map.merges) {
        if (!m.threads?.includes(j)) continue;
        total += 1;
        if (!inT(m.end_tick)) continue;
        if (!layerOk(m.end)) { hiddenL += 1; continue; }
        shown += 1;
        shownLanes.push({ type: 'merge', id: m.id, text: m.title, end: m.end, members: m.members, state: null, pts: [] });
      }
    }
    // 열: 줄에 놓인 스토리
    const keys = new Set();
    for (const l of shownLanes) {
      for (const p of l.pts) keys.add(p.u);
      if (l.type === 'closure') { l.built.forEach((u) => keys.add(u)); keys.add(l.end); }
      if (l.type === 'merge') keys.add(l.end);
    }
    const all = [...keys].map((key) => ({ key, unit: idx.units.get(key), chrono: map.chrono?.[key] })).filter((c) => c.unit);
    const axis = axisNow();
    let cols;
    let gapAt = null;
    if (axis === 'story') {
      const known = all.filter((c) => c.chrono?.seq != null).sort((a, b) => a.chrono.seq - b.chrono.seq || a.unit.order - b.unit.order);
      const unknown = all.filter((c) => c.chrono?.seq == null).sort((a, b) => a.unit.order - b.unit.order);
      cols = [...known, ...unknown];
      if (known.length && unknown.length) gapAt = known.length;
    } else {
      cols = all.sort((a, b) => a.unit.order - b.unit.order);
    }
    const colOf = new Map(cols.map((c, i) => [c.key, i]));
    for (const l of shownLanes) {
      const xs = [...l.pts.map((p) => colOf.get(p.u)), ...(l.type === 'closure' ? [...l.built, l.end].map((u) => colOf.get(u)) : []), ...(l.type === 'merge' ? [colOf.get(l.end)] : [])].filter((x) => x != null);
      l.first = xs.length ? Math.min(...xs) : 0;
      l.last = xs.length ? Math.max(...xs) : 0;
    }
    const rank = { root: 0, echo: 1, closure: 2, merge: 3 };
    shownLanes.sort((a, b) => rank[a.type] - rank[b.type] || a.first - b.first || rootNo(a.id) - rootNo(b.id));
    return { j, cols, colOf, gapAt, lanes: shownLanes, total, shown, hidden: total - shown - hiddenL, hiddenL, counts, axis, filt, showMasked };
  };

  // 글자 폭(캔버스) — SVG 글자를 한 줄로 자를 때만 쓴다
  const canvas = document.createElement('canvas').getContext('2d');
  const fontFamily = () => getComputedStyle(root).fontFamily;
  const textWidth = (str, px, weight = 400) => { canvas.font = `${weight} ${px}px ${fontFamily()}`; return canvas.measureText(str).width; };
  const clipTo = (str, maxW, px, weight = 400) => {
    if (maxW <= 0) return '';
    if (textWidth(str, px, weight) <= maxW) return str;
    const a = [...str];
    let lo = 0;
    let hi = a.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textWidth(`${a.slice(0, mid).join('')}…`, px, weight) <= maxW) lo = mid; else hi = mid - 1; }
    return lo ? `${a.slice(0, lo).join('').trimEnd()}…` : '…';
  };
  /** 폭이 다른 줄 여러 개로(첫 줄 폭 · 나머지 줄 폭), 마지막 줄은 넘치면 …로 */
  const wrapTo = (str, widths, px, maxLines) => {
    if (maxLines <= 1) return [clipTo(str, widths[0], px)];
    const out = [];
    let rest = [...str];
    for (let n = 0; rest.length; n++) {
      const w = widths[Math.min(n, widths.length - 1)];
      if (n === maxLines - 1) { out.push(clipTo(rest.join('').trim(), w, px)); break; }
      let lo = 0;
      let hi = rest.length;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textWidth(rest.slice(0, mid).join(''), px) <= w) lo = mid; else hi = mid - 1; }
      if (lo >= rest.length) { out.push(rest.join('')); break; }
      let cut = lo;
      for (let k = lo; k > lo * 0.6; k--) if (rest[k - 1] === ' ') { cut = k; break; }
      out.push(rest.slice(0, cut).join('').trimEnd());
      rest = rest.slice(cut);
      while (rest[0] === ' ') rest.shift();
    }
    return out.length ? out : [''];
  };
  const colLabel = (u) => {
    if (u.kind === 'main') return String(u.title).split(' ')[0];
    return String(u.title).replace(/\s*\(호감도 5편\)$/, '');
  };

  const stateChipFor = (lane) => {
    if (lane.type === 'root') {
      const st = fmt.STATE[lane.state];
      return st ? { text: st.label, color: st.color } : null;
    }
    if (lane.type === 'closure') return { text: lane.ctype === '연작' ? LABELS.closureY : LABELS.closureC, color: 'var(--ink-2)' };
    if (lane.type === 'merge') return { text: fmt.RECORD_KIND.H.label, color: 'var(--ink-2)' };
    return null;
  };

  const pointTip = (lane, p) => () => {
    const u = idx.units.get(p.u);
    const r = rec(p.r);
    const body = ui.el('div', {},
      tipLine(ui.el('strong', {}, stageLabel(p.s)), ` · ${lane.masked ? '' : (lane.kind === 'Q' ? LABELS.q : lane.kind === 'F' ? LABELS.f : '')}`.replace(/ · $/, '')),
      tipLine(`${fmt.unitTitle(p.u)} · ${when(u?.tick)}`),
      p.rel === '앞' && (p.s === '암시' || p.s === '재언급') ? tipLine(ui.el('span', { class: 'muted' }, LABELS.gapFirst)) : null,
      p.bu ? tipLine(ui.el('span', { class: 'thr-tip-bu' }, p.bu === '복선의 답' ? LABELS.hintAnswer : LABELS.long), p.gap ? ` · ${p.gap}` : '') : null,
      p.sc ? tipLine(ui.el('span', { class: 'mono' }, fmt.ref(p.sc, p.ln)), p.c === '추정' ? ` · ${fmt.CONFIDENCE.추정.label}` : '') : null,
      !lane.masked && r ? tipLine(ui.el('span', { class: 'thr-tip-text' }, clip(fmt.recordText(r), 120))) : null,
      !lane.masked && p.a && rec(p.a) ? tipLine(ui.el('span', { class: 'muted' }, `${LABELS.answer}: `), clip(fmt.recordText(rec(p.a)), 90)) : null);
    return body;
  };

  const colTip = (c) => () => {
    const ch = c.chrono;
    return ui.el('div', {},
      tipLine(ui.el('strong', {}, c.unit.title)),
      tipLine(`${fmt.KIND[c.unit.kind]?.label ?? c.unit.kind} · ${when(c.unit.tick)}`),
      ch?.class ? tipLine(`${fmt.CHRONO_CLASS[ch.class] ?? ch.class}${ch.drift ? ` · ${fmt.DRIFT_TITLE}: ${fmt.DRIFT[ch.drift] ?? ch.drift}` : ''}`) : null);
  };

  const openRecord = (id) => state.set({ sel: `record:${id}` });

  /** 흐름 그림 전체(폭이 바뀌거나 컷오프 · 거르개가 바뀔 때) */
  const renderChart = () => {
    hideTip();
    ui.clear(chartHead);
    ui.clear(chartBody);
    if (!model || !model.cols.length || !model.lanes.length) {
      chartHost.hidden = true;
      return;
    }
    chartHost.hidden = false;
    const W = Math.max(260, Math.floor(chartHost.clientWidth || flowEl.clientWidth || 600));
    const nCols = model.cols.length;
    const gapW = model.gapAt != null ? 20 : 0;
    const colW = Math.min(COL_MAX, (W - PAD_L - PAD_R - gapW) / nCols);
    const xOf = (i) => PAD_L + (i + 0.5) * colW + (model.gapAt != null && i >= model.gapAt ? gapW : 0);
    const plotR = W - PAD_R;
    const colTexts = model.cols.map((c) => clipTo(colLabel(c.unit), HEAD_MAX - 22, 11, c.unit.kind === 'main' ? 600 : 400));
    const headH = Math.max(46, Math.min(HEAD_MAX, Math.ceil(Math.max(...colTexts.map((t, i) => textWidth(t, 11, model.cols[i].unit.kind === 'main' ? 600 : 400)))) + 24));
    const nLines = W < NARROW_W ? 2 : 1;
    const laneH = nLines === 2 ? LANE_H2 : LANE_H;
    const trackY = nLines === 2 ? TRACK_Y2 : TRACK_Y;
    const bodyH = model.lanes.length * laneH + 6;
    chartHead.setAttribute('width', W); chartHead.setAttribute('height', headH); chartHead.setAttribute('viewBox', `0 0 ${W} ${headH}`);
    chartBody.setAttribute('width', W); chartBody.setAttribute('height', bodyH); chartBody.setAttribute('viewBox', `0 0 ${W} ${bodyH}`);

    // 머리글: 스토리 이름(세로)
    chartHead.append(s('line', { x1: PAD_L, x2: plotR, y1: headH - 2, y2: headH - 2, class: 'thr-axis' }));
    model.cols.forEach((c, i) => {
      const x = xOf(i);
      const label = colTexts[i];
      const g = s('g', { class: ['thr-colhead', c.unit.kind === 'main' ? 'is-main' : ''], tabindex: 0, role: 'button', 'data-col': i, 'aria-label': c.unit.title,
        onClick: () => state.set({ sel: `unit:${c.key}` }), onKeydown: keyActivate(() => state.set({ sel: `unit:${c.key}` })),
        onPointerenter: () => hiliteCol(i), onPointerleave: () => hiliteCol(null), onFocus: () => hiliteCol(i), onBlur: () => hiliteCol(null) },
      s('rect', { x: x - colW / 2, y: 0, width: colW, height: headH - 4, class: 'thr-hit' }),
      s('line', { x1: x, x2: x, y1: headH - 6, y2: headH - 2, class: 'thr-tick' }),
      s('text', { transform: `translate(${(x + 4).toFixed(1)},${headH - 10}) rotate(-90)`, class: 'thr-colname' }, label));
      tipFor(g, colTip(c));
      chartHead.append(g);
    });
    if (model.gapAt != null) {
      const x0 = xOf(model.gapAt) - colW / 2 - gapW / 2;
      chartHead.append(s('line', { x1: x0, x2: x0, y1: 4, y2: headH - 2, class: 'thr-gapline' }),
        s('text', { x: plotR, y: 10, 'text-anchor': 'end', class: 'thr-gaplabel' }, `${fmt.CHRONO_CLASS.상대} · ${fmt.CHRONO_CLASS.불명}`));
    }

    // 본문
    const gGuide = s('g', { class: 'thr-guides' });
    model.cols.forEach((c, i) => gGuide.append(s('line', { x1: xOf(i), x2: xOf(i), y1: 0, y2: bodyH, class: 'thr-guide' })));
    const hl = s('rect', { y: 0, height: bodyH, width: colW, class: 'thr-colhl', style: { display: 'none' } });
    chartBody.append(hl, gGuide);
    const hiliteCol = (i) => {
      if (i == null) { hl.style.display = 'none'; return; }
      hl.setAttribute('x', (xOf(i) - colW / 2).toFixed(1));
      hl.style.display = '';
    };
    renderChart.hilite = hiliteCol;

    model.lanes.forEach((lane, li) => {
      const y0 = li * laneH;
      const g = s('g', { class: ['thr-lane', `thr-lane-${lane.type}`, lane.state === '열림' || lane.state === '일부' ? 'is-open' : '', lane.masked ? 'is-masked' : ''], transform: `translate(0,${y0})`, 'data-root': lane.id });
      g.append(s('rect', { x: 0, y: 0, width: W, height: laneH, class: 'thr-lane-bg' }), s('line', { x1: 0, x2: W, y1: laneH, y2: laneH, class: 'thr-lane-sep' }));
      if (lane.state === '열림' || lane.state === '일부') g.append(s('rect', { x: 0, y: 4, width: 3, height: laneH - 8, rx: 1.5, class: lane.state === '열림' ? 'thr-lane-bar thr-bar-open' : 'thr-lane-bar thr-bar-part' }));

      // 라벨 줄: [이름표] 문장 ……… [상태]
      const tag = lane.type === 'root' ? (lane.kind === 'Q' ? LABELS.q : LABELS.f) : lane.type === 'merge' ? fmt.RECORD_KIND.H.label : lane.type === 'closure' ? fmt.RECORD_KIND.O.label : null;
      let lx = PAD_L;
      if (tag) {
        const tw = textWidth(tag, 10.5) + 10;
        g.append(s('rect', { x: lx, y: 4, width: tw, height: 16, rx: 8, class: 'thr-tag' }), s('text', { x: lx + tw / 2, y: 15.5, 'text-anchor': 'middle', class: 'thr-tag-text' }, tag));
        lx += tw + 7;
      }
      const chip = stateChipFor(lane);
      let chipW = 0;
      if (chip) {
        chipW = textWidth(chip.text, 11) + 22;
        const cx = plotR - chipW;
        const gc = s('g', { class: 'thr-chip-svg' }, s('circle', { cx: cx + 8, cy: 12, r: 3.8, style: { fill: chip.color } }), s('text', { x: cx + 16, y: 16, class: 'thr-chip-text' }, chip.text));
        g.append(gc);
      }
      const rawText = lane.masked ? (lane.kind === 'Q' ? LABELS.maskedQ : LABELS.maskedF) : lane.text;
      const textLines = wrapTo(rawText, [plotR - lx - chipW - 10, plotR - lx - 6], 12.5, nLines);
      const clipped = textLines.at(-1)?.endsWith('…') && textLines.join('') !== rawText;
      const open = () => (lane.type === 'root' && !lane.masked ? openRecord(lane.id) : lane.type === 'closure' || lane.type === 'merge' ? openRecord(lane.id) : null);
      const interactive = lane.type !== 'echo' && !lane.masked;
      const lg = s('g', { class: ['thr-lane-label', interactive ? 'is-click' : ''], tabindex: interactive ? 0 : null, role: interactive ? 'button' : null, 'aria-label': rawText,
        onClick: interactive ? open : null, onKeydown: interactive ? keyActivate(open) : null },
      s('rect', { x: lx - 2, y: 2, width: Math.max(10, plotR - lx - 6), height: nLines === 2 ? 34 : 20, class: 'thr-hit' }),
      textLines.map((t, k) => s('text', { x: lx, y: 16 + k * 15, class: ['thr-lane-text', lane.masked ? 'is-masked' : ''] }, t)));
      if (clipped) tipFor(lg, () => ui.el('div', {}, tipLine(rawText), lane.type === 'root' ? tipLine(ui.el('span', { class: 'muted' }, fmt.STATE[lane.state]?.label ?? '')) : null));
      g.append(lg);

      // 점 줄
      const track = s('g', { class: 'thr-track', transform: `translate(0,${trackY})` });
      const place = (pts) => {
        const byCol = new Map();
        for (const p of pts) (byCol.get(model.colOf.get(p.u)) ?? byCol.set(model.colOf.get(p.u), []).get(model.colOf.get(p.u))).push(p);
        const xs = new Map();
        for (const [ci, arr] of byCol) {
          const sp = Math.min(8, Math.max(4.5, (colW - 6) / Math.max(1, arr.length - 1)));
          arr.forEach((p, k) => xs.set(p, xOf(ci) + (k - (arr.length - 1) / 2) * (arr.length > 1 ? sp : 0)));
        }
        return xs;
      };
      if (lane.type === 'root' || lane.type === 'echo') {
        const seq = lane.pts.slice();
        const xs = place(seq);
        const lines = s('g', { class: 'thr-lines' });
        for (let k = 1; k < seq.length; k++) {
          const a = xs.get(seq[k - 1]);
          const b = xs.get(seq[k]);
          if (a == null || b == null || a === b) continue;
          lines.append(s('line', { x1: a.toFixed(1), x2: b.toFixed(1), y1: 0, y2: 0, class: b < a ? 'thr-l thr-l-back' : 'thr-l' }));
          if (b < a) lines.append(s('path', { d: `M${b.toFixed(1)},0 l7,-3.4 v6.8 z`, class: 'thr-l-arrow' }));
        }
        // 빌드업 마무리: 복선이 처음 나온 자리(없으면 바로 앞 점)부터 답까지 굵게
        seq.forEach((p, k) => {
          if (!p.bu || k === 0) return;
          const firstHint = p.from ? String(p.from).split(' ')[0].split('@')[0] : null;
          let start = firstHint ? seq.findIndex((q) => q.r === firstHint) : -1;
          if (start < 0 || start >= k) start = k - 1;
          for (let m = start; m < k; m++) {
            const a = xs.get(seq[m]);
            const b = xs.get(seq[m + 1]);
            if (a != null && b != null && a !== b) lines.append(s('line', { x1: a.toFixed(1), x2: b.toFixed(1), y1: 0, y2: 0, class: 'thr-l thr-l-bold' }));
          }
        });
        if (lane.type === 'root' && lane.kind === 'Q' && (lane.state === '열림' || lane.state === '일부')) {
          const right = Math.max(...seq.map((p) => xs.get(p)));
          lines.append(s('line', { x1: right.toFixed(1), x2: plotR, y1: 0, y2: 0, class: ['thr-l thr-l-open', lane.state === '일부' ? 'is-part' : ''] }));
        }
        track.append(lines);
        for (const p of seq) {
          const key = STAGE_KEY[p.s] ?? 'hint';
          const pg = s('g', { class: ['thr-pt', `thr-pt-${key}`, p.bu ? 'has-bu' : ''], transform: `translate(${xs.get(p).toFixed(1)},0)`, tabindex: 0, role: 'button', 'data-r': p.r, 'data-col': model.colOf.get(p.u),
        'aria-label': `${stageLabel(p.s)} · ${fmt.unitTitle(p.u)}`, onClick: () => openRecord(p.r), onKeydown: keyActivate(() => openRecord(p.r)),
        onPointerenter: () => hiliteCol(model.colOf.get(p.u)), onPointerleave: () => hiliteCol(null) },
          s('circle', { r: 12, class: 'thr-hit' }), s('circle', { r: 9, class: 'thr-ring' }), p.bu ? s('circle', { r: 8.2, class: 'thr-bu-ring' }) : null, markShape(key));
          tipFor(pg, pointTip(lane, p));
          track.append(pg);
        }
      } else if (lane.type === 'closure') {
        const cols = [...lane.built, lane.end].map((u) => model.colOf.get(u)).filter((x) => x != null);
        const first = Math.min(...cols);
        const lastX = xOf(model.colOf.get(lane.end));
        track.append(s('line', { x1: xOf(first), x2: lastX, y1: 0, y2: 0, class: 'thr-l thr-l-bold' }));
        const T = (u, key, stage) => {
          const pg = s('g', { class: ['thr-pt', `thr-pt-${key}`], transform: `translate(${xOf(model.colOf.get(u)).toFixed(1)},0)`, tabindex: 0, role: 'button', 'data-r': lane.id, 'aria-label': `${stage} · ${fmt.unitTitle(u)}`,
            onClick: () => openRecord(lane.id), onKeydown: keyActivate(() => openRecord(lane.id)), onPointerenter: () => hiliteCol(model.colOf.get(u)), onPointerleave: () => hiliteCol(null) },
          s('circle', { r: 12, class: 'thr-hit' }), s('circle', { r: 9, class: 'thr-ring' }), markShape(key));
          tipFor(pg, () => ui.el('div', {}, tipLine(ui.el('strong', {}, stage)), tipLine(`${fmt.unitTitle(u)} · ${when(idx.units.get(u)?.tick)}`)));
          return pg;
        };
        for (const u of lane.built) if (u !== lane.end) track.append(T(u, 'built', lane.ctype === '연작' ? '쌓인 이야기' : '쌓인 갈등'));
        track.append(T(lane.end, 'end', lane.ctype === '연작' ? LABELS.closureY : LABELS.closureC));
      } else if (lane.type === 'merge') {
        const ci = model.colOf.get(lane.end);
        const mx = xOf(ci);
        // 멤버 결말 줄의 끝과 세로선(같은 열에 있을 때)
        const ups = model.lanes.map((l, k) => ({ l, k })).filter(({ l }) => l.type === 'closure' && lane.members.includes(l.id) && model.colOf.get(l.end) === ci);
        if (ups.length) track.append(s('line', { x1: mx, x2: mx, y1: (Math.min(...ups.map((u) => u.k)) - li) * laneH, y2: 0, class: 'thr-l thr-l-merge' }));
        const pg = s('g', { class: 'thr-pt thr-pt-merge', transform: `translate(${mx.toFixed(1)},0)`, tabindex: 0, role: 'button', 'data-r': lane.id, 'aria-label': lane.text,
          onClick: () => openRecord(lane.id), onKeydown: keyActivate(() => openRecord(lane.id)), onPointerenter: () => hiliteCol(ci), onPointerleave: () => hiliteCol(null) },
        s('circle', { r: 13, class: 'thr-hit' }), s('circle', { r: 11, class: 'thr-ring' }), markShape('merge'));
        tipFor(pg, () => ui.el('div', {}, tipLine(ui.el('strong', {}, lane.text)), tipLine(`${fmt.unitTitle(lane.end)} · ${when(idx.units.get(lane.end)?.tick)}`)));
        track.append(pg);
      }
      g.append(track);
      chartBody.append(g);
    });
    applySel();
  };

  /** 리더에서 고른 기록을 흐름에서 표시 */
  const applySel = () => {
    for (const n of chartBody.querySelectorAll('.is-sel')) n.classList.remove('is-sel');
    const sel = state.parseSel(state.get().sel);
    if (sel?.type !== 'record') return;
    for (const n of chartBody.querySelectorAll('[data-r], [data-root]')) {
      if (n.getAttribute('data-r') === sel.id || n.getAttribute('data-root') === sel.id) n.classList.add('is-sel');
    }
  };

  // ── 머리: 제목 · 지표 · 이어진 떡밥 · 항목 ──
  const goT = (tick) => state.set({ t: tick });
  const renderHead = () => {
    const j = currentId();
    const th = byId.get(j);
    const c = stats.get(j);
    ui.clear(headEl);
    ui.clear(controlsEl);
    const started = startedThreads();
    // 좁은 폭에서만 보이는 고르개
    const pick = ui.el('select', { class: 'thr-pick', 'aria-label': LABELS.pick, onChange: (e) => state.set({ p: { j: e.target.value } }) },
      started.map((t) => ui.el('option', { value: t.id, selected: t.id === j }, `${wLabel(t.weight)} · ${shortTitle(t)}`)));
    if (!started.length) {
      headEl.append(ui.el('h3', { class: 'thr-title' }, meta.title));
      return;
    }
    if (!c.started) {
      headEl.append(ui.el('div', { class: 'thr-title-row' }, ui.el('h3', { class: 'thr-title' }, LABELS.notStarted), pick));
      return;
    }
    const wchip = ui.chip('plain', th.weight, wLabel(th.weight));
    wchip.style.setProperty('--chip', WEIGHT_VAR[th.weight]);
    wchip.title = fmt.THREAD_WEIGHT_HELP[th.weight];
    headEl.append(ui.el('div', { class: 'thr-title-row' }, ui.el('h3', { class: 'thr-title' }, th.title), wchip, ui.link(`thread:${j}`, LABELS.details, { class: 'thr-detail' }), pick));
    // 지표: 의문 상태 막대 + 사실
    const segs = [['열림', c.열림], ['일부', c.일부], ['풀림', c.풀림]].filter(([, n]) => n > 0);
    const meter = ui.el('div', { class: 'thr-meter', role: 'img', 'aria-label': segs.map(([k, n]) => `${fmt.STATE[k].label} ${n}`).join(' · ') },
      segs.map(([k, n]) => ui.el('span', { class: 'thr-meter-seg', style: { flex: String(n), background: fmt.STATE[k].color }, title: `${fmt.STATE[k].label} ${n}` })));
    const stat = (k, n) => ui.el('span', { class: 'legend-item' }, ui.el('i', { class: 'swatch', style: { background: fmt.STATE[k].color }, 'aria-hidden': 'true' }, ''), `${fmt.STATE[k].label} `, ui.el('strong', {}, n));
    headEl.append(ui.el('div', { class: 'thr-stats' },
      segs.length ? meter : null,
      ui.el('div', { class: 'legend thr-statlegend' }, stat('열림', c.열림), stat('일부', c.일부), stat('풀림', c.풀림),
        c.f ? ui.el('span', { class: 'legend-item muted' }, `${LABELS.f} ${c.앎 + c.뒤집힘}/${c.f}`) : null)));
    // 이어진 떡밥(관계)
    const narrow = compact;
    const fold = (chips, limit) => {
      const rest = chips.slice(limit);
      return [...chips.slice(0, limit), rest.length ? ui.el('details', { class: 'thr-more' }, ui.el('summary', {}, LABELS.moreItems(rest.length)), ui.el('span', { class: 'thr-more-body' }, rest)) : null];
    };
    const T = cutoff();
    const rels = relations.filter((g) => (g.from === j || g.to === j) && stats.get(g.from)?.started && stats.get(g.to)?.started && (T == null || map.relations?.[g.id]?.tick == null || map.relations[g.id].tick <= T));
    if (rels.length) {
      const relChips = rels.map((g) => {
        const out = g.from === j;
        const other = byId.get(out ? g.to : g.from);
        return ui.el('button', { type: 'button', class: 'thr-chip thr-chip-rel', title: `${LABELS.relNames[g.type]} — ${g.text}`, onClick: () => selectThread(other.id) },
          ui.el('span', { class: 'thr-chip-verb' }, (out ? LABELS.relOut : LABELS.relIn)[g.type]), shortTitle(other));
      });
      headEl.append(ui.el('div', { class: 'thr-chips' }, ui.el('span', { class: 'ctl-name' }, LABELS.related), ...fold(relChips, narrow ? 3 : 8)));
    }
    // 다루는 항목
    const showCommon = P('common') === '1';
    const es = (edgesOfThread.get(j) ?? []).filter((e) => (T == null || e.tick == null || e.tick <= T) && concepts.has(e.target) && (showCommon || concepts.get(e.target).threads < COMMON_MIN)).sort((a, b) => b.records - a.records);
    if (es.length) {
      const chip = (e) => ui.el('button', { type: 'button', class: ['thr-chip', e.target === P('c') ? 'is-sel' : ''], title: `${fmt.TARGET_TYPE[concepts.get(e.target).type] ?? ''} · ${e.records}`,
        onClick: () => state.set({ p: { map: 'item', c: e.target } }) }, concepts.get(e.target).name);
      headEl.append(ui.el('div', { class: 'thr-chips' }, ui.el('span', { class: 'ctl-name' }, LABELS.itemsOf), ...fold(es.map(chip), narrow ? 4 : 10)));
    }
  };

  const renderControls = () => {
    ui.clear(controlsEl);
    const j = currentId();
    if (!stats.get(j)?.started) return;
    const c = model?.counts ?? { all: 0, unsolved: 0, solved: 0, fact: 0 };
    const fseg = ui.segmented({
      label: LABELS.filterName,
      options: [
        { value: 'all', label: LABELS.filterAll },
        { value: 'unsolved', label: `${LABELS.filterUnsolved} ${c.unsolved}` },
        { value: 'solved', label: `${LABELS.filterSolved} ${c.solved}` },
        { value: 'fact', label: `${LABELS.filterFact} ${c.fact}` },
      ],
      value: filterNow(),
      onChange: (v) => state.setParam(meta.id, 'f', v === 'all' ? null : v),
    });
    const aseg = ui.segmented({
      label: LABELS.axisName,
      options: [{ value: 'pub', label: LABELS.axisPub }, { value: 'story', label: LABELS.axisStory }],
      value: axisNow(),
      onChange: (v) => state.setParam(meta.id, 'axis', v === 'pub' ? null : v),
    });
    controlsEl.append(ui.el('div', { class: 'thr-ctl' }, ui.el('span', { class: 'ctl-name' }, LABELS.axisName), aseg.el), ui.el('div', { class: 'thr-ctl' }, fseg.el));
  };

  /** 가린 개수 — 스포일러(떡밥 · 이 떡밥의 단계)와 범위 밖(이 떡밥의 단계) */
  const renderNote = () => {
    ui.clear(noteEl);
    const T = cutoff();
    const hiddenThreads = T == null ? 0 : threads.filter((t) => !stats.get(t.id).started).length;
    const hiddenSteps = T == null ? 0 : model?.hidden ?? 0;
    if (hiddenThreads || hiddenSteps) {
      noteEl.append(ui.el('span', { class: 'thr-note-part' },
        ui.el('span', { class: 'thr-note-text' }, `${LABELS.hiddenMemo} `, hiddenThreads ? `${LABELS.hiddenThreads} ${fmt.num(hiddenThreads)}` : null, hiddenThreads && hiddenSteps ? ' · ' : null, hiddenSteps ? `${LABELS.hiddenSteps} ${fmt.num(hiddenSteps)}` : null),
        ui.el('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: null }) }, fmt.TERM.showAll)));
    }
    if (model?.hiddenL) {
      noteEl.append(ui.el('span', { class: 'thr-note-part' },
        ui.el('span', { class: 'thr-note-text' }, `${fmt.TERM.scope} 밖 ${LABELS.hiddenSteps} ${fmt.num(model.hiddenL)}`),
        ui.el('button', { type: 'button', class: 'btn', onClick: () => state.set({ layers: [1, 2, 3] }) }, `${fmt.TERM.scope} ${fmt.SCOPE.at(-1).label}`)));
    }
  };

  /** 흐름 영역 전체를 지금 상태로 */
  const renderFlow = () => {
    const j = currentId();
    const c = stats.get(j);
    model = c?.started ? buildModel(j) : null;
    renderHead();
    renderControls();
    ui.clear(emptyEl);
    emptyEl.hidden = true;
    ui.clear(maskedBar);
    if (model && model.counts.masked) {
      maskedBar.append(ui.el('span', { class: 'muted' }, LABELS.maskedBar(model.counts.masked)), ui.el('button', { type: 'button', class: 'btn', onClick: () => state.setParam(meta.id, 'hints', model.showMasked ? null : '1') }, model.showMasked ? LABELS.maskedHide : LABELS.maskedShow));
    }
    legendWrap.hidden = !model;
    ui.clear(legendExtra);
    if (model) {
      const has = (t) => model.lanes.some((l) => l.type === t);
      if (has('closure')) legendExtra.append(legendMark(ui, 'built', LABELS.legendBuilt), legendMark(ui, 'end', LABELS.legendEnd));
      if (has('merge')) legendExtra.append(legendMark(ui, 'merge', fmt.RECORD_KIND.H.label));
      if (model.axis === 'story') legendExtra.append(lineKeyOf('thr-l thr-l-back', LABELS.legendBack));
    }
    if (!c?.started) {
      emptyEl.hidden = false;
      const any = startedThreads().length > 0;
      const first = startTick.get(j);
      if (!any) {
        const t0 = Math.min(...[...startTick.values()].filter((x) => x != null));
        const n0 = [...startTick.values()].filter((x) => x === t0).length;
        emptyEl.append(ui.el('p', {}, `${LABELS.noneStarted} — ${LABELS.startsCount(fmt.tickShort(t0), n0)}`), ui.el('div', { class: 'thr-empty-actions' },
          ui.el('button', { type: 'button', class: 'btn', onClick: () => goT(t0) }, LABELS.raiseCutoff(fmt.tickShort(t0))),
          ui.el('button', { type: 'button', class: 'btn', onClick: () => state.set({ t: null }) }, fmt.TERM.showAll)));
      } else {
        emptyEl.append(ui.el('p', {}, first != null ? `${LABELS.notStarted} — ${LABELS.startsAt(fmt.tickShort(first))}` : LABELS.notStarted), ui.el('div', { class: 'thr-empty-actions' },
          first != null ? ui.el('button', { type: 'button', class: 'btn', onClick: () => goT(first) }, LABELS.raiseCutoff(fmt.tickShort(first))) : null,
          ui.el('button', { type: 'button', class: 'btn', onClick: () => state.set({ p: { j: startedThreads()[0].id } }) }, LABELS.pick)));
      }
      renderChart();
      return;
    }
    if (!model.lanes.length) {
      emptyEl.hidden = false;
      emptyEl.append(ui.el('p', {}, LABELS.empty[model.filt] ?? LABELS.empty.all), model.filt !== 'all' ? ui.el('div', { class: 'thr-empty-actions' }, ui.el('button', { type: 'button', class: 'btn', onClick: () => state.setParam(meta.id, 'f', null) }, LABELS.filterAll)) : null);
    }
    renderChart();
  };

  // ── 전체 갱신 ──
  const snap = () => ({ j: currentId(), axis: axisNow(), f: filterNow(), c: P('c') ?? '', common: P('common') ?? '', hints: P('hints') ?? '' });
  let last = snap();
  const refreshAll = () => {
    computeStats();
    refreshSideMode();
    refreshMap();
    renderFlow();
    renderNote();
    last = snap();
  };

  // 첫 렌더 — sel=thread:ID로 들어왔으면 그 떡밥을 고른다
  {
    const sel0 = state.parseSel(state.get().sel);
    if (sel0?.type === 'thread' && byId.has(sel0.id) && !P('j')) state.setParam(meta.id, 'j', sel0.id);
  }
  refreshAll();

  // ── 구독: 컷오프 · 범위 · 파라미터 · 리더 선택 ──
  const off = state.subscribe((st, changed) => {
    if (changed.has('sel')) {
      const sel = state.parseSel(st.sel);
      if (sel?.type === 'thread' && byId.has(sel.id) && sel.id !== P('j')) {
        state.setParam(meta.id, 'j', sel.id); // 이 호출이 p 변화로 다시 들어온다
        if (!changed.has('t') && !changed.has('layers')) return;
      }
    }
    if (changed.has('t') || changed.has('layers')) { refreshAll(); return; }
    if (changed.has('sel')) applySel();
    if (changed.has('p')) {
      const now = snap();
      refreshSideMode();
      refreshMap();
      if (now.j !== last.j || now.axis !== last.axis || now.f !== last.f || now.common !== last.common || now.hints !== last.hints) { renderFlow(); renderNote(); } else renderHead();
      last = now;
    }
  });

  // 말풍선에 기록 문장을 싣기 위해 한가한 때 기록 파일(6MB)을 받는다 — 못 받아도 근거 줄만으로 돌아간다
  const idle = window.setTimeout(() => { if (!idx.records && !recordsAsked) { recordsAsked = true; idx.withRecords?.().catch(() => {}); } }, 1500);

  // 폭이 바뀌면 흐름을 다시 그린다(한 프레임에 한 번)
  let lastW = chartHost.clientWidth;
  let raf = 0;
  const ro = new ResizeObserver(() => {
    const w = chartHost.clientWidth;
    if (Math.abs(w - lastW) < 2 || !model) return;
    lastW = w;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderChart);
  });
  ro.observe(chartHost);

  return () => {
    off();
    ro.disconnect();
    cancelAnimationFrame(raf);
    window.clearTimeout(idle);
    tipEl.remove();
  };
}
