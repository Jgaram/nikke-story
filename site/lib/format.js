/**
 * 표시 라벨 · 색 · 표기. 화면에 보이는 말은 전부 여기 한 곳에서만 정의하고 탭은 `fmt`로 가져다 쓴다(하드코딩 금지).
 * 색은 CSS 변수를 가리키고 값은 style.css 토큰 한 곳에만 있다. 레포 용어 → 화면 말 대응은 라벨 값에만 걸리고, 상수의 키는 그대로다.
 *
 *   KIND[id] · KIND_ORDER           스토리 종류(main · event · side · sub · relic · erelic · episode · elevator) → label · color
 *   GRADE[등급]                      준필수(키 '필수') · 추천(키 '보강') · 참고 · 독립(파란 순서 램프) · 필수(키 '척추') · 메인(잉크)
 *   LAYER[1..3]                     범위(주황 순서 램프) — 핵심 · 넓게 · 전부
 *   SCOPE · scopeOf(layers)         범위 세그먼트 셋(핵심 = {1} · 넓게 = {1,2} · 전부 = {1,2,3}) ↔ state의 layers
 *   STATE[상태]                      의문 · 사실의 "여기까지 읽음" 상태 — 열림 · 일부 · 풀림 · 뒤집힘 · 암시만 · 아직 · 앎
 *   RECORD_KIND[코드]                F · Q · F-k · Q-k · S · I · E · D · U · O · H → label · group(분석 메모 종류)
 *   TARGET_TYPE · CONFIDENCE · THREAD_WEIGHT(핵심 · 보조 · 곁가지)
 *   PRE_LEVEL · PRE_HELP · PRE_WHY · preOf  선행 스토리 칸(키 필수 · 권장 · 선택 — 화면 말은 PRE_LABEL) · 뜻 · 왜 선행인가 · 'CH.30 선행'
 *   CHRONO_CLASS · DRIFT · LINK_TYPE · ACT · CHANGE_ACT · TIME_KIND · TERM    작중 시점 · 출시순 비교 · 관계선 · 떡밥 단계 · 변화 · 시간 단서 · 자주 쓰는 말
 *   *_HELP · help(group, key)       라벨마다 한 줄 정의(툴팁용). group: kind · grade · layer · state · record · confidence · weight · chrono · drift · link · target
 *   use(idx)                        색인을 묶는다 — 아래 함수가 스토리 · 출시 시점 · 대상 이름을 찾을 수 있게(app.js가 부팅 때 한 번)
 *   unitTitle(u | key)              'CH.07 재회' · '라피'(호감도는 종류 칩으로 안다)
 *   tickLabel(tick, { date })       'CH.20과 함께 출시 · 2023-01-12' / 'CH.17 다음 출시 · 2022-11-10' / null → '전부 보기'
 *   tickShort(tick)                 'CH.20' / 'CH.17+'
 *   orgsAt(target, t)               그 자리의 소속(기업 · 스쿼드 마크) — 확정 소속 기록(affs)이 t까지 있으면 그것, 없으면 게임 데이터(orgs). ORG_SOURCE · orgTip(o)
 *   iconAt(target, t)               그 자리의 인물 아이콘 — 메인에서 바뀐 모습(target.icons [[자리, 아이콘]])을 t까지 따른다. t null(전부) = 마지막 모습
 *   placeLabel(place)               작중 시점 표기('ch01–ch02 ~', '@랩쳐_침공') → 'CH.01–CH.02 이후', '랩쳐 침공'
 *   ref(scene)                      'CH.07 재회 · 2장면 「…」'(씬 ID · 줄 번호는 안 보인다)   evidence(ev[]) → 장면들을 ' · '로   sceneName(scene) → '2장면 「…」'(스토리 이름 없이)
 *   targetName(id)                  'person:스노우_화이트' → '스노우 화이트'(사전에 있으면 표준명)
 *   recordText(r) · recordLabel(r)  메모 한 줄 · 종류 라벨(사건은 act까지)
 *   stateAt(r, T)                   사실 · 의문의 T 상태(docs/views.md "공개 축" 규칙)
 *   hiddenLabel(n)                  '스포일러로 가린 N'
 *   TAB · TAB_ORDER · openInTab(tab)   탭 이름 · 한 줄 설명 · '연결 탭에서 보기'
 *   LINK_LEVEL                      연결 강도 1–3 → 약함 · 보통 · 강함
 *   FIRST_VISIT                     여기까지 읽음 팝업의 문구
 *   gradeAt(u, T)                   order.json 단위의 T 시점 등급(T < 출시 시점이면 null) — tools/views/importance.mjs gradeAt과 같다
 *   plain(text)                     분석 문장 속 레포 용어(척추 · 줄기 …)를 화면 말로(조사도 맞춘다). 표시할 때만 — 데이터는 그대로
 *   num(n) · pct(x) · date(s)
 */

// ── 스토리 종류 ──
export const KIND = {
  main: { label: '메인', color: 'var(--kind-main)' },
  event: { label: '이벤트', color: 'var(--kind-event)' },
  episode: { label: '호감도', color: 'var(--kind-episode)' },
  sub: { label: '서브퀘스트', color: 'var(--kind-sub)' },
  relic: { label: '유실물', color: 'var(--kind-relic)' },
  side: { label: '사이드', color: 'var(--kind-side)' },
  erelic: { label: '이벤트 유실물', color: 'var(--kind-erelic)' },
  elevator: { label: '돌발', color: 'var(--kind-elevator)' },
  other: { label: '그 밖', color: 'var(--ink-muted)' },
};
export const KIND_ORDER = ['main', 'event', 'episode', 'sub', 'relic', 'side', 'erelic', 'elevator'];
export const KIND_HELP = {
  main: '메인 스토리 챕터',
  event: '기간 한정 이벤트 스토리',
  episode: '니케마다 호감도로 열리는 개인 스토리',
  sub: '서브퀘스트 메신저 대화',
  relic: '지역에 흩어진 유실물 문서',
  side: '사이드 스토리',
  erelic: '이벤트 속 유실물 문서',
  elevator: '돌발 스토리 — 전초기지 건물 대화(지금은 엘리베이터 첫 스토리만)',
  other: '그 밖의 스토리',
};

// ── 등급 · 범위 ──
export const GRADE = {
  필수: { label: '준필수', color: 'var(--grade-must)', rank: 1 },
  보강: { label: '추천', color: 'var(--grade-support)', rank: 2 },
  참고: { label: '참고', color: 'var(--grade-ref)', rank: 3 },
  독립: { label: '독립', color: 'var(--grade-standalone)', rank: 4 },
  척추: { label: '필수', color: 'var(--grade-spine)', rank: 0 },
  메인: { label: '메인', color: 'var(--grade-main)', rank: 0 },
};
export const GRADE_ORDER = ['메인', '척추', '필수', '보강', '참고', '독립'];
export const GRADE_HELP = {
  필수: '안 읽으면 필수 스토리의 장면 · 인물을 따라갈 수 없다',
  보강: '읽으면 필수 스토리에서 "뭐 있나 보다" 하고 넘긴 빈틈이 채워진다',
  참고: '빈틈은 없지만 세계나 인물을 더 알게 된다',
  독립: '그 스토리 안에서 끝나는 이야기 — 안 읽어도 필수 스토리에 지장 없다',
  척추: '꼭 읽을 스토리 — 메인 챕터와 필수 이벤트 · 사이드. 등급을 매기지 않고 다른 스토리 등급의 기준이 된다',
  메인: '메인 스토리 챕터',
};

export const LAYER = {
  1: { label: '핵심', color: 'var(--layer-1)' },
  2: { label: '넓게', color: 'var(--layer-2)' },
  3: { label: '전부', color: 'var(--layer-3)' },
};
export const LAYER_HELP = {
  1: '핵심 범위 — 메인과 딸린 서브퀘스트 · 유실물, 필수 스토리에 닿는 이벤트',
  2: '넓게 범위부터 보인다 — 핵심에 호감도 · 참고 스토리가 더해진다',
  3: '전부 범위에서만 보인다 — 필수 스토리와 따로 노는 이야기까지',
};
/** 범위 세그먼트 — 값 → state의 layers. 다른 조합이 URL로 들어오면 scopeOf가 'all'로 본다 */
export const SCOPE = [
  { value: 'core', label: '핵심', layers: [1], help: '줄거리의 중심이 되는 스토리만' },
  { value: 'wide', label: '넓게', layers: [1, 2], help: '핵심에 이야기를 풍부하게 하는 스토리까지' },
  { value: 'all', label: '전부', layers: [1, 2, 3], help: '필수 스토리와 따로 노는 이야기까지 모두' },
];
export function scopeOf(layers) {
  const k = [...(layers ?? [])].map(Number).sort((a, b) => a - b).join();
  return k === '1' ? 'core' : k === '1,2' ? 'wide' : 'all';
}

// ── 의문 · 사실의 상태 ──
export const STATE = {
  열림: { label: '미해결', color: 'var(--state-open)' },
  일부: { label: '일부 회수', color: 'var(--state-partial)' },
  풀림: { label: '회수', color: 'var(--state-solved)' },
  뒤집힘: { label: '뒤집힘', color: 'var(--state-reversed)' },
  암시만: { label: '복선만', color: 'var(--state-hint)' },
  아직: { label: '아직 안 나옴', color: 'var(--state-none)' },
  앎: { label: '알려짐', color: 'var(--state-known)' },
};
export const STATE_HELP = {
  열림: '아직 답이 나오지 않은 의문',
  일부: '답의 일부만 밝혀진 의문',
  풀림: '답이 나온 의문',
  뒤집힘: '나중에 사실이 뒤집힌 것',
  암시만: '복선만 나오고 아직 밝혀지지 않았다',
  아직: '아직 나오지 않았다',
  앎: '밝혀져 알려진 사실',
};

// ── 분석 메모 종류 ──
export const RECORD_KIND = {
  F: { label: '사실', group: '기본' },
  Q: { label: '의문', group: '기본' },
  'F-k': { label: '사실', group: '기본' },
  'Q-k': { label: '의문', group: '기본' },
  S: { label: '시간 단서', group: '기본' },
  I: { label: '숨은 등장', group: '심화' },
  E: { label: '복선', group: '심화' },
  D: { label: '변화', group: '심화' },
  U: { label: '세계의 모습', group: '심화' },
  O: { label: '결말', group: '결말' },
  H: { label: '함께 맺음', group: '결말' },
};
export const RECORD_ORDER = Object.keys(RECORD_KIND);
export const RECORD_HELP = {
  F: '원문에서 확인된 사실',
  Q: '원문이 던진 의문 — 풀렸는지 따라간다',
  'F-k': '사실이 밝혀지거나 뒤집힌 지점',
  'Q-k': '의문이 풀린 지점',
  S: '이야기가 언제 일어났는지 알려 주는 단서',
  I: '이름은 안 나왔지만 누구인지 알 수 있는 등장',
  E: '나중에 밝혀질 일을 미리 흘린 복선, 또는 그것을 다시 언급한 장면',
  D: '인물의 성격 · 관계 · 소속 등이 바뀐 지점',
  U: '세계관이 생활 속에서 어떻게 그려지는지',
  O: '오래 쌓인 이야기가 끝나는 지점',
  H: '여러 갈래가 한꺼번에 맺어지는 지점',
};

// ── 떡밥 단계 · 변화 · 시간 단서 ──
/** 의문 · 사실 · 떡밥이 지나는 단계(원본 값 → 화면 말) */
export const ACT = {
  제기: '떡밥 던짐',
  암시: '복선',
  일부: '일부 회수',
  '일부 회수': '일부 회수',
  회수: '회수',
  재언급: '다시 언급',
  드러냄: '밝혀짐',
  뒤집음: '뒤집힘',
  '처음 밝혀짐': '처음 밝혀짐',
  보강: '다시 확인',
  뒤집힘: '뒤집힘',
};
/** 인물 변화(D)의 act */
export const CHANGE_ACT = { 기준: '처음 모습', 변화: '바뀜' };
/** 시간 단서(S)의 종류 */
export const TIME_KIND = { 기준점: '기준', 회상: '회상' };

export const TARGET_TYPE = { person: '인물', place: '장소', org: '조직', concept: '개념', incident: '사건', item: '물건' };
export const TARGET_TYPE_HELP = {
  person: '니케 · 인간 등 등장인물',
  place: '장소 · 지역',
  org: '조직 · 단체',
  concept: '용어 · 설정 · 제도',
  incident: '작중 사건',
  item: '물건 · 장치',
};
export const CONFIDENCE = { 확실: { label: '확실' }, 추정: { label: '추정' } };
export const CONFIDENCE_HELP = { 확실: '원문에서 바로 확인된다', 추정: '정황으로 읽은 해석 — 틀릴 수 있다' };

/** 떡밥(줄기) 중요도: 키는 원본(뼈대 · 보강 · 독립) 그대로 */
export const THREAD_WEIGHT = { 뼈대: { label: '핵심' }, 보강: { label: '보조' }, 독립: { label: '곁가지' } };
export const THREAD_WEIGHT_HELP = {
  뼈대: '필수 스토리를 관통하는 떡밥',
  보강: '필수 스토리 곁에서 이야기를 보태는 떡밥',
  독립: '한 스토리 안에서 끝나는 떡밥',
};

// ── 작중 시점 · 출시순 비교 ──
/** 작중 시점의 확정 정도(키는 원본 그대로) */
export const CHRONO_CLASS = { 판별: '시점 확정', 범위: '대략 범위', 상대: '앞뒤만 앎', 불명: '시점 불명' };
export const CHRONO_CLASS_HELP = {
  판별: '기준과의 관계로 작중 시점이 정해진다',
  범위: '앞뒤 경계만 알아 대략의 범위로 본다',
  상대: '다른 스토리와의 앞뒤만 안다',
  불명: '시점을 알 단서가 없다',
};
/** 출시순과 비교 — 출시 당시 메인과 견준 작중 시점 */
export const DRIFT_TITLE = '출시순과 비교';
export const DRIFT = { 과거: '과거 이야기', 앞: '앞선 이야기', 맞음: '같은 때', 걸침: '걸침', 뒤: '나중 이야기' };
export const DRIFT_ORDER = ['과거', '앞', '맞음', '걸침', '뒤'];
export const DRIFT_HELP = {
  과거: '메인 스토리가 시작되기 전의 이야기',
  앞: '출시 당시 메인이 이미 지나온 시점의 이야기',
  맞음: '출시 당시 메인과 같은 무렵의 이야기',
  걸침: '같은 무렵을 포함하지만 범위가 넓어 앞뒤를 가리기 어렵다',
  뒤: '출시 당시 메인보다 나중 시점의 이야기',
};

// ── 관계선 ──
export const LINK_TYPE = {
  prereq: { label: '선행 스토리' },
  sequel: { label: '다음 편' },
  setup_payoff: { label: '떡밥 → 회수' },
  callback: { label: '다시 언급' },
  reversal: { label: '뒤집힘' },
  character: { label: '같은 인물' },
  keyword: { label: '같은 소재' },
};
export const LINK_TYPE_ORDER = Object.keys(LINK_TYPE);
export const LINK_TYPE_HELP = {
  prereq: '게임이 먼저 보게 하는 스토리',
  sequel: '이어지는 다음 편',
  setup_payoff: '던져 둔 떡밥과 그것을 푼 장면',
  callback: '앞의 일을 다시 꺼낸 장면',
  reversal: '앞의 사실이 뒤집힌 장면',
  character: '같은 인물이 나오는 스토리',
  keyword: '같은 소재 · 용어를 다루는 스토리',
};

/** 연결 강도(세기 1–3) */
export const LINK_LEVEL = { 1: '약함', 2: '보통', 3: '강함' };

/** 선행 스토리(order.json pre — tools/site/export/order.mjs prereqsOf): 칸 · 칸 뜻 · 왜 선행인가 */
export const PRE_LEVEL = ['필수', '권장', '선택']; // 키(order.json pre) — 화면 말은 PRE_LABEL
export const PRE_LABEL = { 필수: '필수', 권장: '권장', 선택: '선택' };
export const PRE_HELP = {
  필수: '먼저 봐야 이 스토리를 따라갈 수 있다 — 앞 편이거나, 이 자리에 준필수로 분류된 스토리',
  권장: '먼저 보면 이 스토리의 장면 · 떡밥이 이어진다 — 이 자리에 추천으로 분류된 스토리이거나 강한 떡밥',
  선택: '이 스토리가 다시 꺼내는 일이 나온다 — 봐 두면 좋지만 안 봐도 된다',
};
export const PRE_WHY = { sequel: '앞 편', judged: '분류에서 짚음', setup_payoff: '떡밥 → 회수', reversal: '뒤집힘', callback: '다시 언급' };
export const preOf = (spineLabel) => `${spineLabel} 선행`; // 'CH.30 선행' — 이 스토리가 그 필수 스토리의 선행이다

// ── 탭 ──
export const TAB = {
  order: { title: '감상 순서', hint: '메인 스토리 사이사이에 꼭 볼 스토리를 끼워 넣은 순서' },
  links: { title: '연결', hint: '스토리 사이의 연결' },
  threads: { title: '떡밥', hint: '복선과 떡밥이 이어지는 흐름' },
  chrono: { title: '연대기', hint: '작중 시간순으로 본 스토리' },
  persons: { title: '인물', hint: '인물별 등장과 변화' },
  world: { title: '세계', hint: '용어 · 장소 · 조직 · 세계의 모습' },
};
export const TAB_ORDER = Object.keys(TAB);
export const openInTab = (tab) => `${TAB[tab]?.title ?? tab} 탭에서 보기`;

/** 여기까지 읽음 팝업(첫 방문이면 저절로 뜬다) */
export const FIRST_VISIT = {
  ask: '어디까지 읽으셨나요?',
  help: '본 데까지 나온 이야기만 보여 스포일러를 막는다. 감상 순서 탭은 이와 관계없이 전부 보인다.',
  mainHead: '메인 스토리',
  mainAria: '메인 스토리 어디까지',
  prev: '이전 챕터',
  next: '다음 챕터',
  exHead: '필수 이벤트 · 사이드',
  exHint: '순서대로 안 봤다면 본 것만 체크',
  exBadge: (n, all) => `+필수 ${n}/${all}`,
  exBadgeHelp: '필수 이벤트 · 사이드를 메인 순서와 다르게 골랐다',
  all: '전부 보기',
  later: '나중에',
  ok: '확인',
  close: '닫기',
  open: '눌러서 바꾸기',
  allHelp: '스포일러를 가리지 않고 모든 시점의 이야기를 본다',
}

/** 자주 쓰는 말 — 탭은 하드코딩하지 말고 여기서 가져다 쓴다 */
export const TERM = {
  site: 'NIKKE 스토리 지도',
  unit: '스토리',
  order: '감상 순서',
  release: '출시 시점',
  cutoff: '여기까지 읽음',
  showAll: '전부 보기',
  scope: '범위',
  spine: '필수',
  gradeAt: '지금 읽은 데까지의 등급',
  judgment: '분류',
  judgmentHistory: '분류가 바뀐 기록',
  basis: '이유',
  lead: '주역',
  origin: '첫 이야기',
  thread: '떡밥',
  note: '분석 메모',
  speaker: '말한 인물',
  togetherScenes: '같이 나온 장면',
  talkScenes: '대화한 장면',
  commonTargets: '자주 나오는 인물',
  link: '연결',
  strength: '연결 강도',
  chronoPlace: '작중 시점',
  inverted: '출시순과 반대',
  piece: '다른 때의 장면',
  evidence: '근거',
  spoiler: '스포일러',
};
export const TERM_HELP = {
  cutoff: '이 시점까지 나온 이야기만 보여 스포일러를 막는다',
  scope: '핵심 · 넓게 · 전부 — 보여 줄 스토리의 범위',
};

const HELP = {
  kind: KIND_HELP,
  grade: GRADE_HELP,
  layer: LAYER_HELP,
  state: STATE_HELP,
  record: RECORD_HELP,
  confidence: CONFIDENCE_HELP,
  weight: THREAD_WEIGHT_HELP,
  chrono: CHRONO_CLASS_HELP,
  drift: DRIFT_HELP,
  link: LINK_TYPE_HELP,
  target: TARGET_TYPE_HELP,
  pre: PRE_HELP,
};
/** 툴팁용 한 줄 정의. 없으면 빈 문자열 */
export const help = (group, key) => HELP[group]?.[key] ?? '';

// ── 색인 묶기 ──
let idx = null;
export function use(i) {
  idx = i;
}

export function unitTitle(u) {
  const unit = typeof u === 'string' ? idx?.units.get(u) : u;
  return unit?.title ?? (typeof u === 'string' ? u : '?');
}

function tickObj(tick) {
  return idx?.ticks.get(Number(tick)) ?? null;
}
const chNum = (key) => (key ? `CH.${String(key).replace(/^ch/, '')}` : null);

/** 인물 아이콘 — 여기까지 읽음(t)까지 메인에서 바뀐 모습만 보인다(사용자, 2026-10-10). 그 뒤 모습은 스포일러라 앞 모습 */
export function iconAt(target, t) {
  if (!target) return null;
  let icon = target.icon ?? null;
  for (const [tick, ic] of target.icons ?? []) if (t == null || tick <= t) icon = ic;
  return icon;
}

/** 소속 출처 — 게임 데이터(실장 니케의 지금 소속)인지 작중 기록인지 */
export const ORG_SOURCE = { game: '게임 데이터 기준 현재 소속', record: '이 자리까지 읽은 스토리 기준 소속' };

/**
 * 그 자리의 소속(docs/views.md "소속 마크") — 확정 소속 기록 T(target.affs, 공개 자리 tick)가 t까지 하나라도 있으면 그것을 차례로 쌓고
 * (소속 · 합류 → 더함, 이탈 → 뺌), 없으면 게임 데이터(target.orgs — 실장 니케의 지금 소속, 스포일러로 보지 않는다). t null(전부) = 기록 전부.
 * @returns {{ type: 'corp'|'squad', name: string, mark?: string, org?: string, role?: string, via?: string, source: 'game'|'record' }[]} 기업이 앞
 */
export function orgsAt(target, t) {
  if (!target) return [];
  const recs = (target.affs ?? []).filter((a) => t == null || (a.tick != null && a.tick <= t));
  if (!recs.length) return (target.orgs ?? []).map((o) => ({ ...o, source: 'game' }));
  const now = new Map();
  for (const a of recs) {
    if (a.act === '이탈') now.delete(a.org);
    else now.set(a.org, a);
  }
  return [...now.values()].map((a) => {
    const o = idx?.targets.get(a.org);
    return { type: o?.kind === '기업' ? 'corp' : 'squad', name: targetName(a.org), mark: o?.mark, org: a.org, role: a.role, source: 'record' };
  }).sort((a, b) => (a.type === 'corp' ? 0 : 1) - (b.type === 'corp' ? 0 : 1));
}
/** 소속 칩 툴팁 — '카운터스 · 게임 데이터 기준 현재 소속' / '갓데스 (스노우 화이트 : 이노센트 데이즈) · …' */
export function orgTip(o) {
  return `${o.name}${o.role ? ` — ${o.role}` : ''}${o.via ? ` (${o.via})` : ''} · ${ORG_SOURCE[o.source] ?? ''}`;
}

export function tickShort(tick) {
  if (tick == null) return '전부';
  const t = tickObj(tick);
  if (!t) return `#${tick}`;
  return t.main ? chNum(t.main) : t.upto ? `${chNum(t.upto)}+` : `#${tick}`;
}

export function tickLabel(tick, { date = true } = {}) {
  if (tick == null) return TERM.showAll;
  const t = tickObj(tick);
  if (!t) return `시점 ${tick}`;
  const head = t.main ? `${chNum(t.main)}과 함께 출시` : t.upto ? `${chNum(t.upto)} 다음 출시` : `시점 ${tick}`;
  return date && t.date ? `${head} · ${t.date}` : head;
}

/** 작중 시점 압축 표기 → 사람이 읽는 말: ch07 → CH.07 · '~' 앞뒤는 이후 · 이전 · 화살표 · '/'는 또는 · '@'는 시대 이름 */
export function placeLabel(place) {
  if (!place) return '';
  return String(place)
    .replace(/ch(\d+)/g, 'CH.$1')
    .replace(/@/g, '')
    .replace(/_/g, ' ')
    .split(/\s*\/\s*/)
    .map((part) => {
      const p = part.trim();
      if (/^~\s*\S/.test(p)) { const x = p.replace(/^~\s*/, ''); return /\s전$/.test(x) ? x : `${x} 이전`; }
      if (/\S\s*~$/.test(p)) return `${p.replace(/\s*~$/, '')} 이후`;
      return p.replace(/\s*~\s*/g, ' → ');
    })
    .join(' 또는 ');
}

/** 장면 표시 — 'CH.14 여행 · 18장면 「에닉」'. 씬 ID · 줄 번호는 화면에 내지 않는다(원문이 없어 확인할 수 없고, ID는 작업용 키) */
export const ref = (scene) => {
  const s = idx?.scenes.get(scene);
  if (!s) return String(scene ?? '');
  const u = idx.units.get(s.unit);
  return `${u ? `${u.title} · ` : ''}${sceneName(scene)}`;
};
/** 그 스토리 안의 장면이면 스토리 이름 없이, 다른 스토리면 붙여서 */
export const refIn = (scene, unit) => (idx?.scenes.get(scene)?.unit === unit ? sceneName(scene) : ref(scene));
/** 스토리 이름을 이미 보일 때 — '18장면 「에닉」' */
export const sceneName = (scene) => {
  const s = idx?.scenes.get(scene);
  return s ? `${s.seq}장면${s.title ? ` 「${s.title}」` : ''}` : String(scene ?? '');
};
export const evidence = (ev) => (Array.isArray(ev) ? [...new Set(ev.map((e) => e.scene))].map((s) => ref(s)).join(' · ') : '');

export const hiddenLabel = (n) => `스포일러로 가린 ${num(n)}`;

/** order.json 단위의 T 시점 등급(tools/views/importance.mjs gradeAt과 같다) — null이면 아직 안 나왔다. T가 없으면(전부 보기) 최종 등급 */
export function gradeAt(u, T) {
  if (T != null && typeof T === 'object') { // state.reading() — 본 스토리 목록 기준
    if (T.all) return u.grade;
    if (!T.seen(u.key)) return null;
    if (u.from_tick && T.t < u.from_tick) return u.before ?? u.grade; // 등급이 오르는 자리는 메인 챕터(t) 기준
    return u.grade;
  }
  if (T == null) return u.grade;
  if (T < u.tick) return null;
  if (u.from_tick && T < u.from_tick) return u.before ?? u.grade;
  return u.grade;
}

/** 분석 문장 속 레포 용어 → 화면 말(표시할 때만 바꾼다 — 데이터는 그대로). 바뀐 말에 맞춰 조사도 고친다: 척추가 → 필수 스토리가. 등급 키 '필수'는 먼저 '준필수'로(필수품 · 필수 교육 같은 낱말은 두고) */
const PLAIN_TERMS = [['뼈대 · 보강 줄기', '핵심 · 보조 떡밥'], ['독립 줄기', '곁가지 떡밥'], ['뼈대 줄기', '핵심 떡밥'], ['보강 줄기', '보조 떡밥'], ['척추', '필수 스토리'], ['줄기', '떡밥'], ['원점', '첫 이야기'], ['단위', '스토리'], ['판정', '분류'], ['후보 목록(시점 기록 · 기록 엣지) 밖에서 더한', '자동으로 찾지 못해 직접 더한']];
const JOSA = [['가', '이', '가'], ['이', '이', '가'], ['는', '은', '는'], ['은', '은', '는'], ['를', '을', '를'], ['을', '을', '를'], ['와', '과', '와'], ['과', '과', '와'], ['로', '으로', '로'], ['으로', '으로', '로']];
const hasFinal = (w) => { const c = [...w].pop().charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 && c % 28 !== 0; };
export const plain = (text) => keysToNames(PLAIN_TERMS.reduce((t, [a, b]) => t.replace(new RegExp(`${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(가|이|는|은|를|을|와|과|으로|로)?`, 'g'), (m, j) => {
  if (!j) return b;
  const pick = JOSA.find((x) => x[0] === j);
  return b + (hasFinal(b) ? pick[1] : pick[2]);
}), String(text ?? '').replace(/(→ |ch\d+ |등급 |부터 )보강(?! 줄기)/g, '$1추천').replace(/(?<!동행 )필수(?!품| 교육| 덕목)/g, '준필수')));
/** 문장 속 작업용 키 → 화면 이름: 메인 챕터 'ch21' → 'CH.21', 그 밖 스토리 키 → 제목, 씬 ID → 장면 표시. 모르는 키는 그대로 */
const KEY_RE = /\b(?:(?:fl|side|sub|relic|erelic|ep|char|sudden):[A-Za-z0-9_]+|d_[a-z0-9_]+|event_[a-z0-9_]+|ch\d{2})\b/g;
function keysToNames(text) {
  if (!idx) return text;
  return text.replace(KEY_RE, (k) => {
    if (/^ch\d{2}$/.test(k)) return idx.units.has(k) ? `CH.${k.slice(2)}` : k;
    if (idx.units.has(k)) return unitTitle(k);
    if (idx.scenes.has(k)) return ref(k);
    return k;
  });
}

export function targetName(id) {
  if (!id) return '';
  const t = idx?.targets.get(id);
  if (t) return t.name;
  return String(id).replace(/^[a-z]+:/, '').replace(/_/g, ' ');
}

export function recordLabel(r) {
  const k = RECORD_KIND[r.kind]?.label ?? r.kind;
  const join = (sub) => (sub ? `${k} · ${sub}` : k);
  switch (r.kind) {
    case 'F-k':
    case 'Q-k':
      if (r.kind === 'Q-k' && r.degree === '일부') return join(ACT.일부);
      return join(ACT[r.act] ?? r.act);
    case 'E':
      return r.act === '재언급' ? join(ACT.재언급) : k;
    case 'D':
      return join(CHANGE_ACT[r.act] ?? r.act);
    case 'S':
      return join(TIME_KIND[r.time_kind] ?? r.time_kind);
    case 'U':
      return join(r.topic);
    case 'O':
      return join(r.type);
    default:
      return k;
  }
}

export function recordText(r) {
  if (!r) return '';
  if (r.kind === 'I') return `${targetName(r.target)} — 이름 없이 등장${r.speaker ? ' · 대사 있음' : ''}`;
  if (r.kind === 'D') {
    const head = `${targetName(r.person)} ${r.aspect ?? ''}${r.with?.length ? ` (${r.with.map(targetName).join(' · ')})` : ''}`.trim();
    if (r.act === '변화') return `${head}: ${r.before ?? '?'} → ${r.after ?? '?'}`;
    return `${head}: ${r.text ?? ''}`;
  }
  if (r.kind === 'Q-k') return r.text ?? `${r.parent} 회수${r.answer ? ` — 답 ${r.answer}` : ''}${r.degree ? ` (${r.degree})` : ''}`;
  if (r.kind === 'F-k') return r.text ?? `${r.parent} ${ACT[r.act] ?? r.act ?? ''}${r.replaced_by ? ` → ${r.replaced_by}` : ''}`;
  if (r.kind === 'H') return r.title ? `${r.title} — ${r.text ?? ''}` : r.text ?? '';
  return r.text ?? '';
}

/**
 * 사실 · 의문의 컷오프 상태. 사실: 앎(처음 밝혀짐 ≤ T) · 뒤집힘(뒤집힘 ≤ T) · 암시만(암시 ≤ T < 처음) · 아직.
 * 의문: 풀림(회수 ≤ T) · 일부(일부 회수 ≤ T) · 열림(제기 ≤ T) · 암시만 · 아직. T가 null이면 끝 상태.
 * T 자리에 state.reading()을 주면 단계마다 그 단계가 일어난 스토리(know_units · hint_units …)를 하나라도 봤는지로 본다.
 */
const STAGE_UNITS = { first_tick: 'know_units', hint_tick: 'hint_units', reversed_tick: 'reversed_units', partial_tick: 'partial_units', solved_tick: 'solved_units' };
export function stateAt(r, T) {
  if (!r || (r.kind !== 'F' && r.kind !== 'Q')) return null;
  const R = T != null && typeof T === 'object' ? T : null;
  if (R?.all) T = null;
  /** 그 단계(칸 이름)가 T 안에 일어났나 */
  const le = (key) => {
    const x = r[key];
    if (x == null) return false;
    if (!R) return T == null || x <= T;
    const us = r[STAGE_UNITS[key]] ?? (key === 'first_tick' && r.unit ? [r.unit] : null);
    return us ? R.seenAny(us) : x <= R.t;
  };
  if (r.kind === 'F') {
    if (le('reversed_tick')) return '뒤집힘';
    if (le('first_tick')) return '앎';
    if (le('hint_tick')) return '암시만';
    return '아직';
  }
  if (le('solved_tick')) return '풀림';
  if (le('partial_tick')) return '일부';
  if (le('first_tick')) return '열림';
  if (le('hint_tick')) return '암시만';
  return '아직';
}

export const num = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('ko-KR'));
export const pct = (x, d = 0) => (x == null ? '' : `${(x * 100).toFixed(d)}%`);
export const date = (s) => s ?? '';
