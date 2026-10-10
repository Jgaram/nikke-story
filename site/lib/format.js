/**
 * 표시 라벨 · 색 · 표기. 화면에 보이는 말은 전부 여기 한 곳에서만 정의하고 탭은 `fmt`로 가져다 쓴다(하드코딩 금지).
 * 색은 CSS 변수를 가리키고 값은 style.css 토큰 한 곳에만 있다. 레포 용어 → 화면 말 대응은 라벨 값에만 걸리고, 상수의 키는 그대로다.
 *
 *   KIND[id] · KIND_ORDER           스토리 종류(main · event · side · sub · relic · erelic · episode · elevator) → label · color
 *   GRADE[등급]                      준필수(키 '필수') · 추천(키 '보강') · 참고 · 독립 · 필수(키 '척추') · 메인 — 색은 준필수 · 추천 띠만(style.css "등급")
 *   STATE[상태]                      의문 · 사실의 "여기까지 읽음" 상태 — 열림 · 일부 · 풀림 · 뒤집힘 · 암시만 · 아직 · 앎
 *   RECORD_KIND[코드]                F · Q · F-k · Q-k · S · I · E · D · U · O · H → label · group(분석 메모 종류)
 *   TARGET_TYPE · CONFIDENCE · THREAD_WEIGHT(핵심 · 보조 · 곁가지)
 *   PRE_LEVEL · PRE_HELP · PRE_WHY · preOf  선행 스토리 칸(키 필수 · 권장 · 선택 — 화면 말은 PRE_LABEL) · 뜻 · 왜 선행인가 · 'CH.30 전까지'
 *   CHRONO_CLASS · DRIFT · LINK_TYPE · ACT · CHANGE_ACT · TIME_KIND · TERM    작중 시점 · 출시순 비교 · 관계선 · 떡밥 단계 · 변화 · 시간 단서 · 자주 쓰는 말
 *   *_HELP · help(group, key)       라벨마다 한 줄 정의(툴팁용). group: kind · grade · state · record · confidence · weight · chrono · drift · link · target
 *   use(idx)                        색인을 묶는다 — 아래 함수가 스토리 · 출시 시점 · 대상 이름을 찾을 수 있게(app.js가 부팅 때 한 번)
 *   unitTitle(u | key)              'CH.07 재회' · '라피'(호감도는 종류 칩으로 안다)
 *   tickLabel(tick, { date })       'CH.20 · 2023-01-12' / 'CH.17 이후 · 2022-11-10' / null → '전부 보기'
 *   tickShort(tick)                 'CH.20' / 'CH.17 이후'
 *   orgsAt(target, t, { past })     그 자리의 소속(기업 · 스쿼드 마크) — 공개 자리를 지난 게임 소속(orgs) 위에 t까지의 확정 소속 기록(affs)을 얹는다(past면 전 소속도 뒤에). ORG_SOURCE · orgTip(o)
 *   iconAt(target, t)               그 자리의 인물 아이콘 — 메인에서 바뀐 모습(target.icons [[자리, 아이콘]])을 t까지 따른다. t null(전부) = 마지막 모습
 *   placeLabel(place)               작중 시점 표기('ch01–ch02 ~', '@랩쳐_침공') → 'CH.01–CH.02 이후', '랩쳐 침공'
 *   ref(scene)                      'CH.07 재회 · 2장면 「…」'(씬 ID · 줄 번호는 안 보인다)   evidence(ev[]) → 장면들을 ' · '로   sceneName(scene) → '2장면 「…」'(스토리 이름 없이)
 *   targetName(id)                  'person:스노우_화이트' → '스노우 화이트'(사전에 있으면 표준명)
 *   recordText(r) · recordLabel(r)  기록 한 줄(prose를 거친다 — 회수 줄에 문장이 없으면 답의 문장) · 종류 라벨(사건은 act까지)
 *   stateAt(r, T)                   사실 · 의문의 T 상태(docs/views.md "공개 축" 규칙)
 *   hiddenLabel(n)                  '스포일러로 가린 N'
 *   TAB · TAB_ORDER · openInTab(tab)   탭 이름 · 한 줄 설명 · '연결 탭에서 보기'
 *   LINK_LEVEL                      연결 강도 1–3 → 약함 · 보통 · 강함
 *   FIRST_VISIT · AI_NOTE           여기까지 읽음 팝업의 문구 · AI 정리 고지(하단 · 팝업 · 리더 줄거리 머리)
 *   gradeAt(u, T)                   order.json 단위의 T 시점 등급(T < 출시 시점이면 null) — tools/views/importance.mjs gradeAt과 같다
 *   prose(text)                     화면에 내는 자유 문장은 모두 이것을 거친다 — 레포 용어 → 화면 말 · 키 → 이름 · 근거 표시(기록 ID · 씬 ID · #줄) 걷기, 못 바꾸면 ''
 *   reasonText(text)                분류 이유 — prose 뒤 판정 과정 말(잣대 · 문턱 · 등급 이력 · 카드 절 …)이 든 마디를 뺀다(감상 순서 카드 · 리더 분류 칸)
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

// ── 등급 ──
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
  O: '오래 이어진 이야기의 결말',
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
export const THREAD_WEIGHT = { 뼈대: { label: '주요' }, 보강: { label: '보조' }, 독립: { label: '곁가지' } };
/** 떡밥 무게의 화면 말은 '주요 떡밥' 하나(W13 용어표) — 떡밥 탭 밖(검색 · 리더)에서는 뼈대만 표시하고 나머지는 말하지 않는다 */
export const majorThread = (j) => (j?.weight === '뼈대' ? '주요 떡밥' : '');
export const THREAD_WEIGHT_HELP = {
  뼈대: '필수 스토리를 관통하는 떡밥',
  보강: '필수 스토리 곁에서 이야기를 보태는 떡밥',
  독립: '한 스토리 안에서 끝나는 떡밥',
};

// ── 작중 시점 · 출시순 비교 ──
/** 작중 시점의 확정 정도(키는 원본 그대로) */
export const CHRONO_CLASS = { 판별: '시점 확정', 범위: '대략 범위', 상대: '앞뒤만 앎', 불명: '시점 불명' };
export const CHRONO_CLASS_HELP = {
  판별: '기준과의 관계로 작중 순이 정해진다',
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
export const preOf = (spineLabel) => `${spineLabel} 전까지`; // 'CH.30 전까지' — 그 필수 스토리를 보기 전에 보면 좋다(W13b — 전 'CH.30 선행')

// ── 탭 ──
export const TAB = {
  order: { title: '감상 순서', hint: '메인 스토리 사이사이에 꼭 볼 스토리를 끼워 넣은 순서' },
  links: { title: '연결', hint: '스토리 사이의 연결' },
  threads: { title: '떡밥', hint: '복선과 떡밥이 이어지는 흐름' },
  chrono: { title: '연대기', hint: '작중 순으로 본 스토리' },
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
  exBadge: (n) => `+${n}편`,
  exBadgeHelp: (n, all) => `필수 이벤트 · 사이드 ${all}편 가운데 본 것 ${n}편 — 메인 순서와 다르게 골랐다`,
  all: '전부 보기',
  later: '나중에',
  ok: '확인',
  close: '닫기',
  open: '눌러서 바꾸기',
  allHelp: '스포일러를 가리지 않고 모든 시점의 이야기를 본다',
};

/** AI 정리 고지(사용자, 2026-10-10) — 하단 첫 줄 · 여기까지 읽음 팝업 아래 · 리더 줄거리 머리(공유 링크로 들어오면 팝업이 안 뜬다) */
export const AI_NOTE = {
  full: '줄거리 · 등급 · 떡밥 · 인물 정리는 모두 AI(Claude)가 스토리 원문을 읽고 정리한 것입니다. 해석이 사람의 생각과 다르거나 틀린 곳이 있을 수 있습니다.',
  tag: 'AI 정리',
};

/** 자주 쓰는 말 — 탭은 하드코딩하지 말고 여기서 가져다 쓴다 */
export const TERM = {
  site: 'NIKKE 스토리 지도',
  unit: '스토리',
  order: '감상 순서',
  release: '출시 시점',
  cutoff: '여기까지 읽음',
  showAll: '전부 보기',
  spine: '필수',
  gradeAt: '지금 읽은 데까지의 등급',
  judgment: '분류',
  judgmentHistory: '분류가 바뀐 기록',
  basis: '이유',
  lead: '주역',
  origin: '첫 이야기',
  thread: '떡밥',
  speaker: '말한 인물',
  togetherScenes: '같이 나온 장면',
  talkScenes: '대화한 장면',
  commonTargets: '자주 나오는 인물',
  link: '연결',
  strength: '연결 강도',
  chronoPlace: '작중 순',
  inverted: '출시순과 반대',
  piece: '다른 때의 장면',
  evidence: '근거',
  spoiler: '스포일러',
};
export const TERM_HELP = {
  cutoff: '이 시점까지 나온 이야기만 보여 스포일러를 막는다',
};

const HELP = {
  kind: KIND_HELP,
  grade: GRADE_HELP,
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
export const ORG_SOURCE = { game: '게임 속 지금 소속', record: '읽은 데까지 드러난 소속' };

/**
 * 그 자리의 소속(docs/views.md "소속 마크") — 게임 소속(target.orgs — 실장 니케의 지금 소속)과 확정 소속 기록 T(target.affs)를 합친다(W12d).
 * - 게임 소속은 공개 자리(o.tick — 그 인물의 소속으로 처음 드러난 자리, 0 = 원문에 이름이 없어 늘)를 읽었으면 보인다. tick이 없으면(판정 못 함) 전부 보기에서만.
 * - 기록은 t까지를 공개 순으로 쌓는다(소속 · 합류 → 들어 있음, 이탈 → 나감). 기록이 나가게 한 조직은 게임 소속이어도 뺀다.
 * - 기록이 다루지 않는 게임 소속은 그대로 두고, 기록만 있는 조직을 그 위에 더한다. t null(전부) = 게임 소속 전부 + 기록 전부.
 * - past(W12e): 전 소속을 뒤에 더한다(past: true) — t까지의 '지난 소속' 기록과, 마지막 기록이 이탈인 조직. 지금 소속(다른 판 포함)과 같은 조직은 빼서 한 번만.
 * @returns {{ type: 'corp'|'squad', name: string, mark?: string, org?: string, role?: string, via?: string, from?: string, source: 'game'|'record', past?: true, act?: string, unit?: string }[]} 기업이 앞(지금 → 전 소속)
 */
export function orgsAt(target, t, { past = false } = {}) {
  if (!target) return [];
  const all = t == null;
  const now = new Map(); // org → 마지막 기록(이탈이면 나감) — 지난 소속은 지금 소속 계산에 안 든다
  const ago = new Map(); // org → 전 소속 기록(지난 소속 · 이탈)
  const roleOf = new Map(); // org → 마지막으로 적힌 자리(이탈한 조직의 전 소속 칩에)
  for (const a of target.affs ?? []) {
    if (!(all || (a.tick != null && a.tick <= t))) continue;
    if (a.role) roleOf.set(a.org, a.role);
    if (a.act === '지난 소속') { if (!ago.has(a.org)) ago.set(a.org, a); continue; }
    now.set(a.org, a);
    if (a.act === '이탈') ago.set(a.org, a);
  }
  // 이야기 기준 지난 소속인 게임 소속(다른 판의 갓데스 등 — 지난 소속 기록이 있고 지금 다시 들어가지 않음)은 지금 칩이 아니라 전 소속 칩으로
  const pastAll = new Map((target.affs ?? []).filter((a) => a.act === '지난 소속').map((a) => [a.org, a]));
  const out = [];
  const shown = new Set();
  for (const o of target.orgs ?? []) {
    if (!all && !(o.tick != null && o.tick <= t)) continue;
    const rec = o.org ? now.get(o.org) : null;
    if (rec?.act === '이탈') continue;
    if (o.org && pastAll.has(o.org) && rec?.act !== '소속' && rec?.act !== '합류') { if (!ago.has(o.org)) ago.set(o.org, pastAll.get(o.org)); continue; }
    const { tick, ...rest } = o;
    out.push({ ...rest, role: rec?.role, source: 'game' });
    shown.add(o.org ?? o.name);
  }
  const recordChip = (a, extra = {}) => {
    const o = idx?.targets.get(a.org);
    return { type: o?.kind === '기업' ? 'corp' : 'squad', name: targetName(a.org), mark: o?.mark, org: a.org, role: a.role, from: a.from ? targetName(a.from) : undefined, source: 'record', ...extra };
  };
  for (const a of now.values()) {
    if (a.act === '이탈' || shown.has(a.org)) continue;
    out.push(recordChip(a));
    shown.add(a.org);
  }
  const byType = (a, b) => (a.type === 'corp' ? 0 : 1) - (b.type === 'corp' ? 0 : 1);
  const clean = (list) => list.map((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))).sort(byType);
  const res = clean(out);
  if (!past) return res;
  const gone = [];
  for (const [org, a] of ago) {
    if (shown.has(org) || now.get(org)?.act === '소속' || now.get(org)?.act === '합류') continue; // 다시 들어갔거나 지금 소속(다른 판 포함)이면 한 번만
    gone.push(recordChip(a, { role: a.role ?? roleOf.get(org), past: true, act: a.act, unit: a.unit }));
  }
  return [...res, ...clean(gone)];
}
/** 소속 칩 툴팁 — '카운터스 · 게임 속 지금 소속' / '갓데스 (스노우 화이트 : 이노센트 데이즈) · …' / '전 소속: 갓데스 — 지휘관 · 드러난 곳 CH.43 …' */
export function orgTip(o) {
  if (o.past) {
    const kind = idx?.units.get(o.unit)?.kind === 'episode' ? ' 호감도' : ''; // 툴팁에는 종류 칩이 없다
    const where = o.unit ? ` · ${o.act === '이탈' ? '나간 곳' : '드러난 곳'} ${unitTitle(o.unit)}${kind}` : '';
    return `전 소속: ${o.name}${o.role ? ` — ${o.role}` : ''}${where}${o.from ? ` (${withJosa(o.from, '과')} 같은 인물)` : ''}`;
  }
  return `${o.name}${o.role ? ` — ${o.role}` : ''}${o.via ? ` (${o.via})` : ''} · ${ORG_SOURCE[o.source] ?? ''}${o.from ? ` (${withJosa(o.from, '과')} 같은 인물)` : ''}`;
}

/** 공개 자리 → 'CH.20'(메인이 나온 자리) · 'CH.17 이후'(메인 사이 자리). 모르는 자리는 빈 말 — 자리 번호(#12)는 화면에 내지 않는다 */
export function tickShort(tick) {
  if (tick == null) return '전부';
  const t = tickObj(tick);
  if (!t) return '';
  return t.main ? chNum(t.main) : t.upto ? `${chNum(t.upto)} 이후` : '';
}

export function tickLabel(tick, { date = true } = {}) {
  if (tick == null) return TERM.showAll;
  const t = tickObj(tick);
  if (!t) return '';
  const head = tickShort(tick);
  return date && t.date ? [head, t.date].filter(Boolean).join(' · ') : head;
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

/**
 * 지금 읽은 자리에서 알 수 있는 같은 인물(정체 연결) — 밝혀지는 단위(same_as_unit)를 읽었으면 보이고, 아니면 있다는 것 자체를 뺀다.
 * R = state.reading()(없거나 R.all이면 전부). 밝혀지는 단위가 없는 연결은 읽는 중에는 늘 뺀다.
 */
export function sameAsKnown(t, R) {
  const ids = t?.same_as ?? [];
  if (!R || R.all) return ids;
  return ids.filter((_, i) => { const u = t.same_as_unit?.[i]; return u ? R.seen(u) : false; });
}

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

/**
 * 화면에 내는 자유 문장은 모두 이 함수를 거친다(W13a — docs/views.md "화면 문구는 간결하게"): 분석 문장 · 추정 이유 · 설정 오류 메모 · 사전 설명 · 연결 메모 · 기록 문장.
 * ① 레포 용어 → 화면 말(척추가 → 필수 스토리가, 조사도 맞춘다 · 등급 키 '필수'는 '준필수'로) ② 스토리 · 씬 키 → 이름, 떡밥 ID(J12) → 「떡밥 제목」
 * ③ 근거 표시를 걷는다 — 기록 ID · 씬 ID · 줄 번호(#12)만 든 괄호는 통째로, 다른 말과 섞인 괄호는 그것만 뺀다. '(R64 …에서 더함)' 같은 작업 출처도.
 * ④ 그래도 작업 흔적(본문 속 기록 ID · 못 바꾼 키 · 회독 · 세션 이름)이 남으면 바꿀 수 없는 문장이라 ''를 돌려준다 — 부르는 쪽은 빈 문장을 내지 않는다.
 * 표시할 때만 바꾼다 — 데이터는 그대로. 링크(sel) · URL에는 키가 그대로 쓰인다.
 */
const PLAIN_TERMS = [['뼈대 · 보강 줄기', '주요 떡밥'], ['독립 줄기', '떡밥'], ['뼈대 줄기', '주요 떡밥'], ['보강 줄기', '떡밥'], ['척추', '필수 스토리'], ['줄기', '떡밥'], ['원점', '첫 이야기'], ['단위', '스토리'], ['판정', '분류'], ['후보 목록(시점 기록 · 기록 엣지) 밖에서 더한', '직접 더한']];
const JOSA = [['가', '이', '가'], ['이', '이', '가'], ['는', '은', '는'], ['은', '은', '는'], ['를', '을', '를'], ['을', '을', '를'], ['와', '과', '와'], ['과', '과', '와'], ['로', '으로', '로'], ['으로', '으로', '로']];
const JOSA_RE = '(가|이|는|은|를|을|와|과|으로|로)?';
/** 끝 글자의 받침 — 0 없음, 8 ㄹ, 그 밖 있음. 한글이 아니면(숫자 · 기호) 0 */
const DIGIT_FINAL = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0]; // 영 일 이 삼 사 오 육 칠 팔 구
const finalOf = (w) => {
  const ch = [...String(w).replace(/[」』)\]'"]+$/u, '')].pop() ?? '';
  if (/\d/.test(ch)) return DIGIT_FINAL[Number(ch)];
  const c = ch.charCodeAt(0) - 0xac00;
  return c >= 0 && c < 11172 ? c % 28 : 0;
};
/** 바꾼 낱말 뒤 조사를 받침에 맞춘다 — withJosa('필수 스토리', '가') → '필수 스토리가' */
const withJosa = (word, j) => {
  if (!j) return word;
  const pick = JOSA.find((x) => x[0] === j);
  if (!pick) return word + j;
  const f = finalOf(word);
  if (j === '로' || j === '으로') return word + (f && f !== 8 ? '으로' : '로');
  return word + (f ? pick[1] : pick[2]);
};
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 작업 흔적 낱말 — 기록 ID(F12 · Q3-2 · J5 · R64 …, 'E2 크리스탈'은 작중 이름) · 세션 이름(B0b-2) · 씬 줄임(05_s · af_06 · _03) · 줄 번호(#12-15, '[#000000]'은 작중 이름) · 스토리 · 씬 키 */
const REC_ID = /(?<![A-Za-z0-9_:[\-.])(?:[FQSIEDUOHTR]\d+(?:-\d+)?|J\d+)(?![A-Za-z0-9_\-]| 크리스탈)/g;
const SESSION_ID = /(?<![A-Za-z0-9_])[A-Z]\d+[a-z](?:-\d+)?(?![A-Za-z0-9_])/g;
const SCENE_SHORT = /(?<![\p{L}\p{N}_])(?:[a-z]{2}_\d{2}|_?\d{2}_[se]|_\d{2})(?:[-–]\d{2})?(?![A-Za-z0-9_])/gu;
const LINE_REF = /\s?(?<!\[)(?:(?<![\p{L}\p{N}_])\d{2}\s*)?#\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*#?\d+(?:\s*[-–]\s*\d+)?)*/gu;
const KEY_RE = /(?<![A-Za-z0-9_:])(?:(?:fl|side|sub|relic|erelic|ep|char|sudden):[\p{L}\p{N}_]+|d_[a-z0-9_]+|event_[a-z0-9_]+|ch\d{2}|[가-힣][가-힣A-Za-z0-9]*(?:_[가-힣A-Za-z0-9]+)*_\d{2})/gu;
const KEY_JOSA_RE = new RegExp(`(${KEY_RE.source})(?:(가|이|는|은|를|을|와|과|으로|로)(?![가-힣]))?`, 'gu');
const WORK_WORD = /[12]회독|에서 더함|원문 없음/;
/** 키 하나 → [화면 이름, 남은 꼬리]. 키 정규식은 뒤의 한글 조사까지 먹을 수 있어(sub:할아범_00의) 아는 키 가운데 가장 긴 앞부분을 쓴다. 모르면 null */
const BARE_PREFIX = ['', 'sub:', 'relic:', 'erelic:', 'side:', 'fl:'];
function nameOfKey(k) {
  if (!idx) return null;
  for (let n = k.length; n > 2; n--) {
    const cut = k.slice(0, n);
    const head = (k.includes(':') ? [cut, cut.replace(/^ep:/, '')] : BARE_PREFIX.map((p) => p + cut)).find((x) => idx.units?.has(x) || idx.scenes?.has(x)) ?? cut;
    if (/^ch\d{2}$/.test(head)) return idx.units?.has(head) ? [`CH.${head.slice(2)}`, k.slice(n)] : null;
    // 스토리 키 뒤 '_05' · '_03_e'는 그 스토리의 씬 번호(씬 목록에 없는 판) — 스토리 이름만 남긴다
    const tail = (t) => (idx.units?.has(head) ? t.replace(/^_\d+(?:_[se])?(?![A-Za-z0-9])/, '') : t);
    if (idx.units?.has(head)) return [unitTitle(head), tail(k.slice(n))];
    if (idx.scenes?.has(head)) return [ref(head), k.slice(n)];
  }
  return null;
}
/** 전역 정규식으로 있나만 본다(lastIndex를 남기지 않는다) */
const has = (re, str) => { re.lastIndex = 0; const hit = re.test(str); re.lastIndex = 0; return hit; };
/** 키 정규식이 먹은 말에서 아는 키 부분만 */
const nameOfKeyHead = (k) => { const hit = nameOfKey(k); return hit ? k.slice(0, k.length - hit[1].length) : k; };
const isSceneKey = (k) => Boolean(idx?.scenes?.has(k)) && !idx?.units?.has(k);
const threadTitle = (id) => { const j = idx?.threads?.get(id); return j ? `「${String(j.title).split(' — ')[0]}」` : null; };
/** 괄호 속이 근거 표시뿐인가 — 기록 ID · 씬 ID · 씬 줄임 · 줄 번호와 구분자만 */
function stripPointers(inner) {
  let s = inner.replace(LINE_REF, ' ').replace(REC_ID, ' ').replace(SESSION_ID, ' ').replace(SCENE_SHORT, ' ');
  s = s.replace(KEY_RE, (k) => (isSceneKey(nameOfKeyHead(k)) ? ` ${nameOfKey(k)[1]}` : k));
  return s.replace(/\s*([·,/~]|와|과)\s*(?=[·,/~]|$)/g, '').replace(/^\s*[·,/~]\s*/, '').replace(/\s{2,}/g, ' ').trim();
}
export function prose(text) {
  const src = String(text ?? '');
  if (!src.trim()) return '';
  // 문장마다 바꾸고, 못 바꾸는 문장만 뺀다(‘…CH.15. 1회독도 같은 근거로 …’ → 앞 문장만). 'V.T.C.'처럼 글자 뒤 마침표는 문장 끝이 아니다
  const parts = src.split(/(?<=[가-힣)」』'"]\.)\s+/u).map((x) => proseOne(x) || proseClauses(x, /\.$/.test(x))).filter(Boolean);
  return parts.join(' ');
}
/**
 * 분류 이유(order.json reason) — prose를 거친 뒤 판정 과정 말이 든 마디를 뺀다(W13b — 팬이 묻는 것만, docs/views.md "화면 문구는 간결하게").
 * 이유 문장은 판정 기록이라 '이 스토리에 무엇이 있나' 마디와 '그래서 이 등급' 마디가 섞여 있다. 뒤쪽(잣대 · 문턱 · about · 판정 카드 절 · 빌드업 ·
 * 기록 묶음 말 · '앞은 참고' 같은 등급 이력 · 남은 판정 ID K12 · Z4)만 ' — ' 마디 · 문장 단위로 걷고, 그런 말만 든 괄호는 괄호째 걷는다. 다 빠지면 ''.
 */
const G_WORD = '(?:준필수|추천|참고|독립|보강)';
const JUDGE_WORD = new RegExp([
  'about', '문턱', '잣대', '카드 ?\\d', '\\d절', '빌드업', '나온 때부터', '편마다', '규칙:', '(?<![A-Za-z0-9_])[KZ]\\d+',
  '(?:이어진|든|묶인|걸친|인물|지휘관|않은) 기록', '기록(?:이)? 없', '기록 · ', '요지', '빈틈이 아니', 'basis', 'find ', '떡밥라',
  `${G_WORD}(?:이|가)? 아님`, `앞은 [^—]*${G_WORD}`, `(?:^|\\s)${G_WORD}$`,
].join('|'));
const JUDGE_PAREN = new RegExp(`\\s?\\((?:[^()]*(?:about|카드|잣대|문턱|떡밥 밖|· 떡밥|${G_WORD})[^()]*|(?:[KZ]\\d+(?:\\s*·\\s*)?)+)\\)`, 'g');
/** 괄호 밖에서만 가른다 — at(s, i)가 참인 자리에서 [끊을 앞 끝, 다음 시작]을 돌려준다. 괄호 안의 ' — ' · 마침표(물음 · 인용 풀이)는 가르지 않는다 */
function splitOutside(text, at) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) { const cut = at(text, i); if (cut) { out.push(text.slice(from, cut[0])); from = cut[1]; } }
  }
  out.push(text.slice(from));
  return out;
}
const atDash = (t, i) => (t[i] === '—' && t[i - 1] === ' ' && t[i + 1] === ' ' ? [i - 1, i + 2] : null);
const atStop = (t, i) => (t[i] === '.' && /[가-힣)」』'"]/u.test(t[i - 1] ?? '') && /\s/.test(t[i + 1] ?? '') ? [i + 1, i + 2] : null);
const balanced = (t) => (t.match(/\(/g)?.length ?? 0) === (t.match(/\)/g)?.length ?? 0);
export function reasonText(text) {
  const s = prose(text).replace(/세계 기록/g, '세계').replace(/곁 기록/g, '곁 이야기').replace(JUDGE_PAREN, '');
  const out = [];
  for (const sen of splitOutside(s, atStop).map((x) => x.trim())) {
    const period = /\.$/.test(sen);
    const kept = splitOutside(sen.replace(/\.$/, ''), atDash).map((c) => c.trim()).filter((c) => c && balanced(c) && !JUDGE_WORD.test(c));
    const t = kept.join(' — ').replace(/\s{2,}/g, ' ').replace(/^[\s·,;:—–-]+|[\s·,;:—–-]+$/g, '').trim();
    if ([...t.replace(/[^가-힣]/g, '')].length < 6) continue;
    out.push(period ? `${t}.` : t);
  }
  return out.join(' ');
}
/** 문장을 통째로 못 바꾸면 ' — ' 마디마다 — 바꿀 수 있는 마디만 남긴다('S169와 같은 때 — 콜라보 이벤트 … 동안' → 뒤 마디) */
function proseClauses(text, period = false) {
  const parts = String(text).split(/\s+—\s+/);
  let out = parts.length > 1 ? parts.map(proseOne).filter(Boolean).join(' — ') : '';
  if (period && out && !/[.?!]$/.test(out)) out += '.';
  return [...out.replace(/[^가-힣]/g, '')].length >= 6 ? out : ''; // '추정'만 남으면 내지 않는다
}
function proseOne(text) {
  let s = String(text ?? '');
  if (!s.trim()) return '';
  // 작업 출처 · 원문 위치
  s = s.replace(/\s*\([^()]*에서 더함[^()]*\)/g, '').replace(/^[^()—]*에서 더함\s*—\s*/, '').replace(/\s*\(원문 없음\)/g, '');
  // 문장 앞 근거 머리('01_e#40 — …' · '#50 · #58. …' · "01#42 라피 '…'")
  s = s.replace(/^(?:[\s·,]*(?:[\p{L}\p{N}_:]*#\d+(?:\s*[-–]\s*\d+)?|\d{2}_[se]|[a-z]{2}_\d{2}))+[\s.]*(?:—\s*)?/u, '');
  // ① 레포 용어(조사 맞춤) — 등급 키 보강 · 필수를 먼저
  s = s.replace(/(→ |ch\d+ |등급 |부터 )보강(?! 줄기)/g, '$1추천').replace(/(?<!동행 )필수(?!품| 교육| 덕목)/g, '준필수');
  for (const [a, b] of PLAIN_TERMS) s = s.replace(new RegExp(`${escRe(a)}${JOSA_RE}`, 'g'), (m, j) => withJosa(b, j));
  // ③ 괄호 — 근거 표시만 든 괄호는 통째로, 섞인 괄호는 근거 표시만 뺀다. 남은 말이 조사로 시작하면(‘S169와 같은 때’) 괄호째 뺀다
  s = s.replace(/\s?\(([^()]*)\)/g, (m, inner) => {
    const touched = [REC_ID, SESSION_ID, SCENE_SHORT].some((re) => has(re, inner)) || /#\d/.test(inner) || [...inner.matchAll(KEY_RE)].some((k) => isSceneKey(nameOfKeyHead(k[0])));
    if (!touched) return m;
    const rest = stripPointers(inner);
    if (!rest || /^(와|과|의|는|은|이|가|을|를|로|으로|에서|에|도|처럼|보다)(\s|$)/.test(rest) || !/[\p{L}\p{N}]/u.test(rest)) return '';
    return `${m.startsWith(' ') ? ' ' : ''}(${rest})`;
  });
  // 줄 번호 → 뺀다(조사가 붙은 줄 번호 '#22를'은 문장의 한 자리라 못 뺀다), 떡밥 ID → 「제목」, 키 → 이름(조사 맞춤)
  if (/(?<!\[)#\d+(?:[-–]\d+)?(?:가|이|는|은|를|을|와|과|의|로|으로|에서|에)(?![\p{L}])/u.test(s)) return '';
  s = s.replace(LINE_REF, '');
  s = s.replace(/(?<![A-Za-z0-9_])J(\d+)(?![A-Za-z0-9_])(가|이|는|은|를|을|와|과|으로|로)?/g, (m, n, j) => { const t = threadTitle(`J${n}`); return t ? withJosa(t, j) : m; });
  // 항목 키(person:세르반 · concept:NIMPH) → 이름 — 사전에 있는 가장 긴 앞부분
  s = s.replace(/(?<![A-Za-z0-9_])(?:person|place|org|concept|incident|item):[\p{L}\p{N}_.\-]+/gu, (k) => {
    for (let n = k.length; n > 3; n--) if (idx?.targets?.has(k.slice(0, n))) return targetName(k.slice(0, n)) + k.slice(n);
    return k;
  });
  s = s.replace(KEY_JOSA_RE, (m, k, j0) => {
    const hit = nameOfKey(k);
    if (!hit) return m;
    const [name, tail] = hit;
    const j = tail ? /^(가|이|는|은|를|을|와|과|으로|로)(?![\p{L}])/u.exec(tail)?.[1] : j0;
    if (!j) return name + tail + (j0 ?? '');
    return withJosa(name, j) + (tail ? tail.slice(j.length) + (j0 ?? '') : '');
  });
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.)])/g, '$1').replace(/\(\s+/g, '(').replace(/\(\s*\)/g, '')
    .replace(/(?:\s*·)+\s*(?=[·,.)]|$)/g, '').replace(/^[\s·,.;:—–-]+/, '').trim();
  // ④ 남은 작업 흔적이 있으면 낼 수 없다
  if ([REC_ID, SESSION_ID, SCENE_SHORT, KEY_RE].some((re) => has(re, s)) || /(?<![A-Za-z0-9_])(?:person|place|org|concept|incident|item):/.test(s)) return '';
  if (WORK_WORD.test(s) || /(?<!\[)#\d/.test(s)) return '';
  return s;
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
    if (r.act === '변화') return `${head}: ${prose(r.before) || '?'} → ${prose(r.after) || '?'}`;
    return `${head}: ${prose(r.text)}`;
  }
  // 회수 · 밝혀짐 줄에 문장이 없으면 답(사실)의 문장, 그것도 없으면 이유 문장 — ID('Q4 회수 — 답 F34')를 문장 자리에 두지 않는다
  if ((r.kind === 'Q-k' || r.kind === 'F-k') && !r.text) {
    const ans = idx?.records?.get(r.answer ?? r.replaced_by);
    return (ans?.text && prose(ans.text)) || prose(r.reason);
  }
  if (r.kind === 'H') return r.title ? `${prose(r.title)} — ${prose(r.text)}` : prose(r.text);
  return prose(r.text);
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
