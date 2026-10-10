/**
 * 표시 라벨 · 색 · 표기. 화면에 보이는 말은 전부 여기 한 곳에서만 정의하고 탭은 `fmt`로 가져다 쓴다(하드코딩 금지).
 * 색은 CSS 변수를 가리키고 값은 style.css 토큰 한 곳에만 있다. 레포 용어 → 화면 말 대응은 라벨 값에만 걸리고, 상수의 키는 그대로다.
 *
 *   KIND[id] · KIND_ORDER           스토리 종류(main · event · side · sub · relic · erelic · episode · elevator) → label · color
 *   GRADE[등급]                      준필수(키 '필수') · 추천(키 '보강') · 참고 · 독립 · 필수(키 '척추') · 메인 — 색은 준필수 · 추천 띠만(style.css "등급")
 *   STATE[상태]                      의문 · 사실의 "여기까지 읽음" 상태 — 열림 · 일부 · 풀림 · 뒤집힘 · 암시만 · 아직 · 앎
 *   RECORD_KIND[코드]                F · Q · F-k · Q-k · S · I · E · D · U · O · H → label · group(분석 메모 종류)
 *   TARGET_TYPE · CONFIDENCE · majorThread(무게는 '주요 떡밥' 하나) · THREAD_WEIGHT_HELP
 *   PRE_LEVEL · PRE_HELP · PRE_WHY · preOf  선행 스토리 칸(키 필수 · 권장 · 선택 — 화면 말은 PRE_LABEL) · 뜻 · 왜 선행인가(화면에는 안 싣는다 — 스포일러) · 'CH.30 전까지'
 *   preRev · guideOf(키, ctx)        감상 안내 — 먼저 볼 것(최소 선행) · 기한(감상 순서 줄 · 리더 '언제 읽나')
 *   DRIFT · LINK_TYPE · ACT · CHANGE_ACT · TIME_KIND · TERM    작중 시점 · 출시순 비교 · 관계선 · 떡밥 단계 · 변화 · 시간 단서 · 자주 쓰는 말
 *   *_HELP · help(group, key)       라벨마다 한 줄 정의(툴팁용). group: kind · grade · state · record · confidence · weight · chrono · drift · link · target
 *   use(idx)                        색인을 묶는다 — 아래 함수가 스토리 · 출시 시점 · 대상 이름을 찾을 수 있게(app.js가 부팅 때 한 번)
 *   unitTitle(u | key)              'CH.07 재회' · '라피'(호감도는 종류 칩으로 안다)
 *   tickLabel(tick, { date })       'CH.20 · 2023-01-12' / 'CH.17 이후 · 2022-11-10' / null → '전부 보기'
 *   tickShort(tick)                 'CH.20' / 'CH.17 이후'
 *   orgsAt(target, t, { past })     그 자리의 소속(기업 · 스쿼드 마크) — 공개 자리를 지난 게임 소속(orgs) 위에 t까지의 확정 소속 기록(affs)을 얹는다(past면 전 소속도 뒤에). ORG_SOURCE · orgTip(o)
 *   iconAt(target, t)               그 자리의 인물 아이콘 — 메인에서 바뀐 모습(target.icons [[자리, 아이콘]])을 t까지 따른다. t null(전부) = 마지막 모습
 *   placeLabel(place)               작중 시점 표기('ch01–ch02 ~', '@랩쳐_침공') → 'CH.01–CH.02 이후', '랩쳐 침공'
 *   ref(scene)                      'CH.07 재회 · 2장면 「…」'(씬 ID · 줄 번호는 안 보인다)   evidence(ev[]) → 장면들을 ' · '로   sceneName(scene) → '2장면 「…」'(스토리 이름 없이)
 *   sceneTitle(scene) · sceneLabel(scene)   장면 제목은 그 스토리를 봤을 때만(안 봤으면 '2장면' — 사용자 2026-10-10). useReading(fn)으로 읽음 판정을 묶는다
 *   targetName(id)                  'person:스노우_화이트' → '스노우 화이트'(사전에 있으면 표준명)
 *   met(target, R) · nameAt(target, R) · aliasesAt(target, R) · namesAt(target, R)   그 자리에서 대상이 나왔나 · 부르는 이름(표준명이 아직이면 먼저 나온 다른 이름, 안 나왔으면 null) ·
 *                                   아는 다른 이름 · 찾기에 쓰는 이름 전부(W15b — docs/views.md "새는 곳 막기")
 *   recordText(r) · recordLabel(r)  기록 한 줄(prose를 거친다 — 회수 줄에 문장이 없으면 답의 문장) · 종류 라벨(사건은 act까지)
 *   stateAt(r, T)                   사실 · 의문의 T 상태(docs/views.md "공개 축" 규칙)
 *   TAB · TAB_ORDER · openInTab(tab)   탭 이름 · 한 줄 설명 · '연결 탭에서 보기'
 *   LINK_LEVEL                      세기 1–3 → 약함 · 보통 · 강함
 *   FIRST_VISIT · AI_NOTE           여기까지 읽음 팝업의 문구 · AI 정리 고지(하단 · 팝업 · 리더 줄거리 머리)
 *   gradeAt(u, T)                   order.json 단위의 T 시점 등급(T < 출시 시점이면 null) — tools/views/importance.mjs gradeAt과 같다
 *   prose(text)                     화면에 내는 자유 문장은 모두 이것을 거친다 — 레포 용어 → 화면 말 · 키 → 이름 · 근거 표시(기록 ID · 씬 ID · #줄) 걷기, 못 바꾸면 ''
 *   episodeIcon(unit)              호감도 스토리의 초상 아이콘(감상 순서 줄 · 리더 머리) — 그 니케 판(이격 포함) 그림
 *   reasonText(text)                분류 이유 — prose 뒤 판정 과정 말(잣대 · 문턱 · 등급 이력 · 카드 절 …)이 든 마디를 뺀다(감상 순서 카드 · 리더 분류 칸)
 *   dropClauses(s, bad) 문장 · ' — ' 마디 가운데 bad 정규식에 걸린 마디를 뺀다(분류 이유 · 연대기 추정 이유의 판정 과정 말)
 *   blurbText(b, seen)              팬용 문장(blurbs.json 칸 { text, later?, gate? }) — text, gate를 봤으면(seen(gate)) 뒤에 later까지. 다듬어 쓴 문장이라 prose를 거치지 않는다
 *   versionAt(list, R) · threadAt(j, R)   시점별 판(W15c — versions.json, 떡밥 j.v) — 앞 판들의 at을 다 본 마지막 판 · 그 자리 떡밥 제목 · 요약(판이 없으면 끝까지 봤을 때만 분석용 이름)
 *   threadStarted(j, R) · threadLabel(j, R) · threadLabelOf(id, R) · threadText(j, R) · THREAD_SLOT   떡밥이 나왔나(판 규칙) · 화면 이름(제목이 없으면 자리 글) · 요약(W15d)
 *   threadBundle(j, flow, R)        떡밥 묶음 거르기 — 그 자리에서 이 떡밥과 이어진 줄 아는 의문 · 사실 · 복선만(W15d — docs/views.md "새는 곳 막기")
 *   threadTies(j, flow, R)          그 묶음에서 본 것 — { started, whole, ids(기록), units(스토리), about(대상) } — 리더 · 인물 · 세계 탭이 '이것이 이 떡밥에 드나'를 볼 때
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
  erelic: { label: '이벤트 유실물 / 미니게임', color: 'var(--kind-erelic)' }, // 금서고가 유실물 · 미니게임 · 필드 대화를 한 갈래로 둔다(하위 분류 없음 — 2026-10-10 확인)
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
  erelic: '이벤트에 딸린 유실물 문서 · 미니게임 스토리 · 필드 대화 — 출처(금서고)가 한 갈래로 묶어 두어 함께 보인다',
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
  필수: '안 읽으면 필수 스토리의 장면 · 인물을 따라갈 수 없거나, 주요 인물의 결정적 순간을 놓친다',
  보강: '읽으면 필수 스토리에서 "뭐 있나 보다" 하고 넘긴 빈틈이 채워지거나, 필수 스토리 인물의 결정적 순간을 본다',
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
export const TIME_KIND = { 기준점: '', 회상: '회상' }; // 기준점은 따로 말하지 않는다 — 머리는 '시간 단서'만(W13d)

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
/** 떡밥 무게의 화면 말은 '주요 떡밥' 하나(W13 용어표) — 떡밥 탭 밖(검색 · 리더)에서는 뼈대만 표시하고 나머지는 말하지 않는다 */
export const majorThread = (j) => (j?.weight === '뼈대' ? '주요 떡밥' : '');
export const THREAD_WEIGHT_HELP = {
  뼈대: '필수 스토리를 관통하는 떡밥',
  보강: '필수 스토리 곁에서 이야기를 보태는 떡밥',
  독립: '한 스토리 안에서 끝나는 떡밥',
};

// ── 작중 시점 · 출시순 비교 ──
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

/** 연결 세기(1–3) */
export const LINK_LEVEL = { 1: '약함', 2: '보통', 3: '강함' };

/** 선행 스토리(order.json pre — tools/site/export/order.mjs prereqsOf): 칸 · 칸 뜻 · 왜 선행인가 */
export const PRE_LEVEL = ['필수', '권장', '선택']; // 키(order.json pre) — 화면 말은 PRE_LABEL
export const PRE_LABEL = { 필수: '필수', 권장: '권장', 선택: '선택' };
export const PRE_HELP = {
  필수: '먼저 봐야 이 스토리를 따라갈 수 있다 — 앞 편이거나, 이 자리에 준필수로 분류된 스토리',
  권장: '먼저 보면 이 스토리의 장면 · 떡밥이 이어진다 — 이 자리에 추천으로 분류된 스토리이거나 강한 떡밥',
  선택: '이 스토리가 다시 꺼내는 일이 나온다 — 봐 두면 좋지만 안 봐도 된다',
};
export const PRE_WHY = { sequel: '앞 편', judged: '분류에서 짚음', spine: '메인이 기댐', setup_payoff: '떡밥 → 회수', reversal: '뒤집힘', callback: '다시 언급' };
export const preOf = (spineLabel) => `${spineLabel} 전까지`; // 'CH.30 전까지' — 그 필수 스토리를 보기 전에 보면 좋다(W13b — 전 'CH.30 선행')

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
 * 감상 안내(감상 순서 줄 · 리더 '언제 읽나' — 사용자, 2026-10-10: 처음 보는 사람의 가이드). 판정 자리(from) · 선행(order.json pre)과 그 거꾸로에서 기계적으로 낸다.
 *   ctx: { units: Map(키 → { order }), spine: Set(척추 키), pre, rev: preRev(pre), judged: Map(키 → { grade, from }) }
 *   must  먼저 볼 것(최소 선행) [키] — 판정 자리가 앞인 척추(그 빈틈을 채운다 — 길로틴 → CH.12) + 필수 선행(앞 편 · 척추 이벤트 등 — 메인 챕터는 차례로 본다고 두어 pre에 없다), 읽는 자리 순.
 *         권장 · 선택 선행은 '보면 좋다'라 넣지 않는다(리더 선행 칸에 있다)
 *   due   기한 { key, level } — 뒤에서 이 스토리를 필수 · 권장 선행으로 쓰는 것 가운데: 가장 앞의 척추(판정 자리가 뒤면 그것도 — 준필수 = 필수 · 추천 = 권장),
 *         없으면 가장 앞의 메인 밖 스토리. 선택 선행(다시 언급 등)은 기한이 아니다
 */
export function guideOf(key, { units, spine, pre, rev, judged }) {
  const pos = units.get(key)?.order ?? Infinity;
  const at = (k) => units.get(k)?.order;
  const after = (k) => units.has(k) && at(k) > pos;
  const byOrder = (a, b) => at(a[0]) - at(b[0]);
  const j = judged.get(key);
  const cites = (rev.get(key) ?? []).filter(([x, l]) => l !== '선택' && after(x)).sort(byOrder);
  const spineCites = cites.filter(([x]) => spine.has(x));
  if (j?.from && spine.has(j.from) && after(j.from)) spineCites.push([j.from, j.grade === '필수' ? '필수' : '권장']);
  spineCites.sort(byOrder);
  const pick = spineCites[0] ?? cites[0];
  const due = pick ? { key: pick[0], level: pick[1] } : null;
  const fill = j?.from && j.from !== key && spine.has(j.from) && units.has(j.from) && !after(j.from) ? [j.from] : [];
  const req = (pre?.[key]?.필수 ?? []).map(([a]) => a).filter((a) => units.has(a) && !fill.includes(a));
  const must = [...fill, ...req].sort((a, b) => at(a) - at(b));
  return { must, due };
}

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
  exBadgeHelp: (n, all) => `필수 이벤트 · 사이드 · 준필수 ${all}편 가운데 본 것 ${n}편 — 메인 순서와 다르게 골랐다`,
  semiHead: '준필수',
  all: '전부 보기',
  later: '나중에',
  ok: '확인',
  close: '닫기',
  open: '눌러서 바꾸기',
  allHelp: '스포일러를 가리지 않고 모든 시점의 이야기를 본다',
  latest: '사이트 수록분 끝까지',
  latestShort: '수록분 끝',
  latestHelp: (sub, date) => `이 사이트에 들어온 스토리를 다 봤다(${sub}${date ? ` · ${date}` : ''}) — 인게임 최신보다 늦을 수 있다`,
  confirmTitle: '스포일러 확인',
  confirmMsg: '여기까지 읽음을 이렇게 바꿀까요?',
  confirmFrom: '지금',
  confirmTo: '바꾼 뒤',
  confirmSub: (n) => `지금보다 스토리 ${n}편의 내용이 더 보입니다. 아직 안 본 이야기가 있으면 돌아가세요.`,
  confirmBack: '돌아가기',
  confirmOk: '네, 바꾸기',
};

/** AI 정리 고지(사용자, 2026-10-10) — 하단 첫 줄 · 여기까지 읽음 팝업 아래 · 리더 줄거리 머리(공유 링크로 들어오면 팝업이 안 뜬다) */
export const AI_NOTE = {
  full: '줄거리 · 등급 · 떡밥 · 인물 정리는 모두 AI(Claude)가 스토리 원문을 읽고 정리한 것입니다. 해석이 사람의 생각과 다르거나 틀린 곳이 있을 수 있습니다.',
  tag: 'AI 정리',
};

/** 자주 쓰는 말 — 탭은 하드코딩하지 말고 여기서 가져다 쓴다 */
export const TERM = {
  site: 'NIKKE 스토리 가이드',
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
  commonTargets: '자주 나오는 인물',
  link: '연결',
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
let readingOf = null;
/** 여기까지 읽음 판정(state.reading)을 묶는다 — 장면 제목처럼 format.js 안에서 가려야 하는 것이 쓴다(app.js가 부팅 때 한 번) */
export function useReading(fn) {
  readingOf = fn;
}

export function unitTitle(u) {
  const unit = typeof u === 'string' ? idx?.units.get(u) : u;
  return unit?.title ?? (typeof u === 'string' ? u : '?');
}

function tickObj(tick) {
  return idx?.ticks.get(Number(tick)) ?? null;
}
const chNum = (key) => (key ? `CH.${String(key).replace(/^ch/, '')}` : null);

/** 호감도 스토리의 초상 — 그 스토리의 니케 판 아이콘(units.json face — 이격 · 코스튬도 그 판 그림, 인게임 그대로 · 사용자 2026-10-10). 호감도가 아니면 null */
export function episodeIcon(unit) {
  return unit?.kind === 'episode' ? unit.face ?? null : null;
}
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
 * - 게임 소속은 공개 자리(o.tick — 그 인물의 소속으로 처음 드러난 자리: 출시와 확정 T 가운데 이른 것)를 읽었으면 보인다. tick이 없으면(판정 못 함) 전부 보기에서만.
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
  const title = sceneTitle(scene);
  return s ? `${s.seq}장면${title ? ` 「${title}」` : ''}` : String(scene ?? '');
};
/**
 * 장면 제목 — 그 스토리를 봤을 때만(게임은 읽기 전 장면 제목을 보이지 않는다 — 사용자, 2026-10-10). 안 봤거나 제목이 없으면 null(화면은 '3장면'만).
 * 읽음 판정은 app.js가 useReading(() => state.reading())으로 넘긴다 — 없으면(테스트) 늘 보인다
 */
export function sceneTitle(scene) {
  const s = idx?.scenes.get(scene);
  if (!s?.title) return null;
  const R = readingOf?.();
  return !R || R.all || R.seen(s.unit) ? s.title : null;
}
/** 장면 이름(목록 · 이동 칸) — 봤으면 제목, 아니면 '3장면' */
export const sceneLabel = (scene) => sceneTitle(scene) ?? sceneName(scene);
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


/**
 * 대상(인물 · 항목)이 그 자리에서 나왔나(W15b) — 이름(표준명 · 다른 이름)이 쓰인 스토리(target.meet — 내보내기가 읽는 순서로 자른 것)를 하나라도 봤으면.
 * R = state.reading()(없거나 R.all이면 늘). meet이 없는 대상(이름이 쓰인 곳을 못 찾음)은 읽는 중에는 늘 안 나옴 — 전부 보기에서만.
 */
export function met(target, R) {
  if (!target) return false;
  if (!R || R.all) return true;
  return Array.isArray(target.meet) && R.seenAny(target.meet);
}
const metOrder = (a) => idx?.units.get(a.meet?.[0])?.order ?? 1e9;
/** 다른 이름을 그 자리에서 아나 — 표기 · 영문(meet 없음)은 표준명을 알 때, 판 이름은 그 판의 호감도 스토리, 그 밖은 그 이름이 쓰인 스토리를 봤을 때. 쓰인 곳 없음(never)은 전부 보기에서만 */
const aliasKnown = (target, a, R) => (!R || R.all ? true : a.never ? false : a.meet ? R.seenAny(a.meet) : nameKnown(target, R));
/** 표준명을 그 자리에서 아나 — 대상이 나왔고, 표준명이 늦게 나오면(name_meet) 그곳을 봤을 때 */
const nameKnown = (target, R) => met(target, R) && (!R || R.all || (!target.name_never && (!target.name_meet || R.seenAny(target.name_meet))));
/** 그 자리에서 부르는 이름 — 표준명을 알면 표준명, 아니면 먼저 나온 다른 이름. 대상이 아직 안 나왔으면 null(화면은 '아직 나오지 않은 인물 · 항목') */
export function nameAt(target, R) {
  if (!target || !met(target, R)) return null;
  if (nameKnown(target, R)) return target.name;
  const known = (target.aliases ?? []).filter((a) => a.meet && aliasKnown(target, a, R)).sort((a, b) => metOrder(a) - metOrder(b));
  return known[0]?.name ?? target.name;
}
/**
 * 글 속에 그 자리에서 모르는 대상 이름이 낱말 첫머리로 나오나(W15d) — 결말을 아는 자리에서 쓴 분석 문장(떡밥끼리 관계 설명 등)이
 * 근거 스토리를 봐도 뒤에서야 쓰이는 이름('퀸 인자' 등)을 담을 수 있다. 첫 모르는 이름 또는 null. 규칙은 spoiler-check '대상'과 같다
 * (앞 글자가 낱말 안이면 아님 · 두 글자 이름은 뒤가 낱말 끝 · 조사일 때만 · 아는 더 긴 이름 속이면 아님).
 */
export function unknownNameIn(text, R) {
  const s = String(text ?? '');
  if (!s || !R || R.all || !idx?.targets) return null;
  const targets = [...idx.targets.values()];
  const known = new Set(targets.flatMap((t) => namesAt(t, R)));
  const findWord = (w) => {
    for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) {
      if (i > 0 && /[\p{L}\p{N}]/u.test(s[i - 1])) continue;
      if ([...w].length === 2 && /[\p{L}\p{N}]/u.test(s[i + w.length] ?? '') && !/[은는이가을를의와과도만에께한로으랑야아씨님들]/u.test(s[i + w.length])) continue;
      if ([...known].some((k) => k !== w && k.includes(w) && s.startsWith(k, i - k.indexOf(w)))) continue;
      return true;
    }
    return false;
  };
  for (const t of targets) {
    const names = met(t, R) ? (t.aliases ?? []).map((a) => a.name).filter((n) => [...n].length >= 3) : [t.name];
    for (const n of names) if (n && [...n].length >= 2 && !known.has(n) && findWord(n)) return n;
  }
  return null;
}
/** 떡밥끼리 관계 설명 — 모르는 이름이 들면 ''(관계 종류만 보인다) */
export const relText = (g, R) => (unknownNameIn(g?.text, R) ? '' : prose(g?.text));
/** 그 자리에서 아는 다른 이름({ name, how, … }) — 부르는 이름(nameAt)은 뺀다 */
export function aliasesAt(target, R) {
  if (!target || !met(target, R)) return [];
  const shown = nameAt(target, R);
  return (target.aliases ?? []).filter((a) => a.name !== shown && aliasKnown(target, a, R));
}
/** 찾기 · 검색에 쓰는 이름 — 그 자리에서 아는 이름만(표준명은 알 때만) */
export function namesAt(target, R) {
  if (!target || !met(target, R)) return [];
  return [...new Set([nameAt(target, R), ...(target.aliases ?? []).filter((a) => aliasKnown(target, a, R)).map((a) => a.name)])];
}

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
const PLAIN_TERMS = [['뼈대 · 보강 줄기', '주요 떡밥'], ['독립 줄기', '떡밥'], ['뼈대 줄기', '주요 떡밥'], ['보강 줄기', '떡밥'], ['척추', '필수 스토리', '(?! 신경| 아래|뼈)'], ['줄기', '떡밥'], ['원점', '첫 이야기'], ['단위', '스토리'], ['판정', '분류'], ['후보 목록(시점 기록 · 기록 엣지) 밖에서 더한', '직접 더한']];
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
const SESSION_ID = /(?<![A-Za-z0-9_])[A-Z]\d+[a-z](?:-\d+[a-z]?)?(?![A-Za-z0-9_])/g;
const SCENE_SHORT = /(?<![\p{L}\p{N}_])(?:\d{2}_\d{2}(?:_[se])?|[a-z]{2}_\d{2}|_?\d{2}_[se]|_\d{2})(?:[-–]\d{2})?(?![A-Za-z0-9_])/gu;
const LINE_REF = /\s?(?<!\[)(?:(?<![\p{L}\p{N}_])\d{2}\s*)?#\d{1,4}(?!\d)(?:\s*[-–]\s*\d+)?(?:\s*,\s*#?\d+(?:\s*[-–]\s*\d+)?)*/gu;
const LINE_NO = /(?<!\[)#\d{1,4}(?!\d)/;
const KEY_RE = /(?<![A-Za-z0-9_:])(?:(?:fl|side|sub|relic|erelic|ep|char|sudden):[\p{L}\p{N}_]+|d_[a-z0-9_]+|event_[a-z0-9_]+|ch\d{2}|[가-힣][가-힣A-Za-z0-9]*(?:_[가-힣A-Za-z0-9]+)*_\d{2})/gu;
const KEY_JOSA_RE = new RegExp(`(${KEY_RE.source})(?:(가|이|는|은|를|을|와|과|으로|로)(?![가-힣]))?`, 'gu');
const BARE_EVENT_RE = /(?<![A-Za-z0-9_:/.\-])([a-z][a-z0-9]{2,})(?:(가|이|는|은|를|을|와|과|으로|로)(?![가-힣]))?(?![A-Za-z0-9_])/g;
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
/** 문장 속 떡밥 ID → 「그 자리 제목의 앞 마디」(fmt.threadAt — W15d). 그 자리 제목이 없으면 「떡밥」(분석용 이름은 결말을 아는 자리의 말이다) */
const threadTitle = (id) => {
  const j = idx?.threads?.get(id);
  if (!j) return null;
  const t = threadAt(j, readingOf?.() ?? null)?.title;
  return `「${t ? String(t).split(' — ')[0] : TERM.thread}」`;
};
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
  '(?:이어진|든|묶인|걸친|인물|지휘관|않은) 기록', '기록(?:이)? 없', '기록 · ', '요지', '빈틈이 아니', 'basis', 'find ', '떡밥라', '이해 등급',
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
const atStop = (t, i) => (t[i] === '.' && /[가-힣\d)」』'"]/u.test(t[i - 1] ?? '') && /\s/.test(t[i + 1] ?? '') ? [i + 1, i + 2] : null);
const balanced = (t) => (t.match(/\(/g)?.length ?? 0) === (t.match(/\)/g)?.length ?? 0);
export function reasonText(text) {
  const s = prose(text).replace(/세계 기록/g, '세계').replace(/곁 기록/g, '곁 이야기').replace(JUDGE_PAREN, '')
    // 감정 기준(X3g) 판정의 머리 '감정 — ' · 카드 절(3a · 4a) · 결정적 순간 단계(①–④)도 판정 과정 말이다 — 등급에 넣되 따로 표시하지 않는다(사용자)
    .replace(/^감정 — /, '').replace(/(?<![A-Za-z0-9])[34]a(?::\s*|\s(?=—))/g, '').replace(/\s?\((?:[①-⑧](?:\s*·\s*)?)+\)/g, '');
  return dropClauses(s, JUDGE_WORD);
}
export function blurbText(b, seen) {
  if (!b?.text) return '';
  return b.later && b.gate && seen(b.gate) ? `${b.text} ${b.later}` : b.text;
}
/**
 * 시점별 판(W15c) — 판 목록 [{ at, title, text }](읽는 순서)에서 그 자리에 보일 판: 앞에서부터 at을 본(R.seen) 판이 이어지는 데까지의 마지막 판.
 * 뒤 판은 앞 판들의 내용 위에 쓰므로 체크 칸 스토리(척추 이벤트 · 사이드 · 준필수)를 안 고른 독자는 그 at의 판 앞에서 멈춘다.
 * 전부 보기(R.all · R 없음)면 마지막 판. 첫 판(at = 떡밥이 처음 나온 스토리)을 안 봤으면 null — 떡밥이 아직 안 나왔다.
 */
export function versionAt(list, R) {
  if (!Array.isArray(list) || !list.length) return null;
  if (!R || R.all) return list.at(-1);
  let pick = null;
  for (const v of list) {
    if (!R.seen(v.at)) break;
    pick = v;
  }
  return pick;
}
/**
 * 떡밥이 그 자리에서 나왔나(W15d) — 판(j.v)이 있으면 첫 판(at = 떡밥이 처음 나온 스토리)을 봤나(versionAt — 판 규칙과 같게),
 * 없으면 첫 스토리(first_unit)를 봤나. 전부 보기(R.all · R 없음)면 늘. 첫 스토리가 스토리 목록에 없으면(옛 자료) 나온 것으로.
 */
export function threadStarted(j, R) {
  if (!j) return false;
  if (!R || R.all) return true;
  if (Array.isArray(j.v) && j.v.length) return versionAt(j.v, R) != null;
  if (!j.first_unit || (idx && !idx.units?.has(j.first_unit))) return true;
  return R.seen(j.first_unit);
}
/**
 * 떡밥의 그 자리 제목 · 요약 — { title, text, at, of, started, whole }(at = 고른 판의 자리, of = 판 수,
 * started = 떡밥이 나왔나(threadStarted), whole = 떡밥 전체를 아는 자리 — 전부 보기, 또는 마지막 스토리를 봤고 판이 없거나 마지막 판까지 보임).
 * 판(j.v)이 있으면 versionAt, 없으면(아직 안 씀 · 낡아서 빠짐) 분석용 이름(j.title · j.text)은 결말을 아는 자리에서 쓴 것이라 전부 보기이거나 떡밥의 마지막 스토리를 봤을 때만.
 * 보일 글이 없으면 title · text가 null — 화면은 threadLabel(자리 글: '아직 나오지 않은 떡밥' · '제목을 아직 정리하지 않은 떡밥')을 쓴다(W15d).
 */
export function threadAt(j, R) {
  if (!j) return null;
  const list = Array.isArray(j.v) ? j.v : [];
  const all = !R || R.all;
  const lastSeen = all || Boolean(j.last_unit && R.seen(j.last_unit));
  const v = versionAt(list, R);
  if (v) return { title: v.title, text: v.text, at: v.at, of: list.length, started: true, whole: all || (lastSeen && v === list.at(-1)) };
  if (!list.length && lastSeen) return { title: j.title, text: j.text, at: null, of: 0, started: true, whole: true };
  return { title: null, text: null, at: null, of: list.length, started: threadStarted(j, R), whole: false };
}
/** 떡밥 자리 글(W15d) — 아직 안 나옴 · 나왔는데 그 자리 제목(판)이 아직 없음 */
export const THREAD_SLOT = { notYet: '아직 나오지 않은 떡밥', untitled: '제목을 아직 정리하지 않은 떡밥' };
/** 화면에 내는 떡밥 이름 — 그 자리 제목(threadAt), 없으면 자리 글. 목록 · 칩 · 링크 · 리더 머리가 모두 이것을 쓴다 */
export function threadLabel(j, R) {
  const a = threadAt(j, R);
  if (!a) return THREAD_SLOT.notYet;
  return a.title ?? (a.started ? THREAD_SLOT.untitled : THREAD_SLOT.notYet);
}
/** 떡밥 ID로 — 이름 칸(링크 · 칩)에 */
export const threadLabelOf = (id, R) => (idx?.threads?.get(id) ? threadLabel(idx.threads.get(id), R) : THREAD_SLOT.notYet);
/** 떡밥 요약 — 그 자리 판의 text(prose를 거친다), 없으면 '' */
export const threadText = (j, R) => prose(threadAt(j, R)?.text ?? '') || '';

/**
 * 떡밥 묶음 거르기(W15d — docs/views.md "새는 곳 막기") — 떡밥 줄기에 든 의문 · 사실(threads-flow roots) · 떡밥 전체 복선(echoes) 가운데
 * 그 자리 독자가 '이 떡밥과 이어진 것'으로 알 수 있는 것만. 묶음 자체가 스포일러다(마리안 떡밥 아래의 CH.05 '병원의 소녀' — 둘이 이어질지 모른다는 물음은 CH.13에서 선다).
 * 이어진 줄 아는 기록(데이터로만 — 기록하지 않는다):
 *   ① 떡밥 전체를 아는 자리(threadAt whole — 전부 보기 · 마지막 스토리를 보고 마지막 판까지)면 전부
 *   ② 떡밥이 처음 나온 스토리(first_unit)에서 나온 뿌리 — 떡밥은 그것으로 시작한다(첫 판이 그 자리의 의문 꼴)
 *   ③ 지금 보이는 제목(그 자리 판)에 이름이 든 대상(그 자리에서 아는 이름 — namesAt)을 다루는 기록(about), 또는 문장에 그 이름이 든 기록
 *      — 판의 제목은 '그 자리 독자가 이 떡밥을 무엇이라 부르나'라, 그 대상을 다루는 기록은 이 떡밥 아래에 있어도 묶음이 새지 않는다
 *   ④ ①–③으로 이어진 뿌리와 본 단계에서 답(a)으로 이어진 뿌리(의문의 회수 · 일부 회수가 그 사실 — 양쪽으로, 다 퍼질 때까지)
 * 떡밥이 아직 안 나왔으면 아무것도. 판이 없는 떡밥은 제목이 null이라 ②④만(덜 아는 쪽 — 새지 않는다).
 * f = threads-flow.json의 그 떡밥 { roots[], echoes[] }(roots · echoes에 about — 내보내기 W15d). → { roots, echoes, whole }
 */
export function threadBundle(j, f, R) {
  const roots = f?.roots ?? [];
  const echoes = f?.echoes ?? [];
  const at = threadAt(j, R);
  if (!at || at.whole) return { roots, echoes, whole: true };
  if (!at.started) return { roots: [], echoes: [], whole: false };
  const title = at.title ?? '';
  const faceIds = new Set();
  const faceNames = new Set();
  if (title) {
    const cand = new Set([...(j.owners ?? []), ...(j.about ?? []), ...roots.flatMap((r) => r.about ?? []), ...echoes.flatMap((e) => e.about ?? [])]);
    for (const id of cand) {
      const t = idx?.targets?.get(id);
      if (!t) continue;
      const ns = namesAt(t, R).filter((n) => n && [...n].length >= 2 && title.includes(n));
      if (ns.length) { faceIds.add(id); ns.forEach((n) => faceNames.add(n)); }
    }
  }
  const onFace = (x) => (x.about ?? []).some((a) => faceIds.has(a)) || [...faceNames].some((n) => String(x.text ?? '').includes(n));
  const ids = new Set(roots.map((r) => r.id));
  const tied = new Set(roots.filter((r) => (j.first_unit && r.unit === j.first_unit) || onFace(r)).map((r) => r.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const r of roots) {
      for (const p of r.points ?? []) {
        if (!p.a || !ids.has(p.a) || !p.u || !R.seen(p.u)) continue;
        if (tied.has(r.id) !== tied.has(p.a)) { tied.add(r.id); tied.add(p.a); grew = true; }
      }
    }
  }
  return { roots: roots.filter((r) => tied.has(r.id)), echoes: echoes.filter(onFace), whole: false };
}
/**
 * 묶음에서 그 자리 독자가 본 것만 모은 것(W15d) — 리더 기록 · 스토리 패널, 인물 · 세계 탭이 '이 기록 · 스토리 · 대상이 이 떡밥에 든다'를 볼 때.
 * { started, whole, ids(아는 뿌리 · 그 본 단계 줄 · 본 복선의 기록 ID), units(그 단계 · 복선의 스토리), about(아는 뿌리가 다루는 대상) }.
 * 아직 모르는 뿌리(아직 · 암시만)의 복선은 넣지 않는다 — 그 장면이 이 떡밥의 복선이라는 것은 뿌리가 나와야 안다.
 */
export function threadTies(j, f, R) {
  const started = threadStarted(j, R);
  const b = started ? threadBundle(j, f, R) : { roots: [], echoes: [], whole: false };
  const seen = (u) => !R || R.all || (u && R.seen(u));
  const known = b.roots.filter((r) => !['아직', '암시만'].includes(stateAt(r, R ?? null)));
  const pts = known.flatMap((r) => (r.points ?? []).filter((p) => seen(p.u)));
  const echoes = b.echoes.filter((e) => seen(e.u));
  return {
    started, whole: started && b.whole,
    ids: new Set([...known.map((r) => r.id), ...pts.map((p) => p.r), ...echoes.map((e) => e.r)]),
    units: new Set([...pts.map((p) => p.u), ...echoes.map((e) => e.u)]),
    about: new Set(known.flatMap((r) => r.about ?? [])),
  };
}
/** 문장 · ' — ' 마디(괄호 밖) 가운데 bad에 걸린 마디를 뺀다 — 이미 prose를 거친 문장에. 한글 6자 못 되게 남은 문장도 뺀다 */
export function dropClauses(s, bad) {
  const out = [];
  for (const sen of splitOutside(String(s ?? ''), atStop).map((x) => x.trim())) {
    const period = /\.$/.test(sen);
    const kept = splitOutside(sen.replace(/\.$/, ''), atDash).map((c) => c.trim()).filter((c) => c && balanced(c) && !bad.test(c));
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
  s = s.replace(/^(?:[\s·,]*(?:[\p{L}\p{N}_:]*#\d{1,4}(?!\d)(?:\s*[-–]\s*\d+)?|\d{2}_[se]|[a-z]{2}_\d{2}))+[\s.]*(?:—\s*)?/u, '');
  // ① 레포 용어(조사 맞춤) — 등급 키 보강 · 필수를 먼저
  s = s.replace(/(→ |ch\d+ |등급 |부터 )보강(?! 줄기)/g, '$1추천').replace(/(?<!동행 |준)필수(?=\(|[.,]|\s[—→]|$|에서 (?:옮|내려)|로 (?:올|내려))/g, '준필수');
  for (const [a, b, not = ''] of PLAIN_TERMS) s = s.replace(new RegExp(`${escRe(a)}${JOSA_RE}${not}`, 'g'), (m, j) => withJosa(b, j));
  // ③ 괄호 — 근거 표시만 든 괄호는 통째로, 섞인 괄호는 근거 표시만 뺀다. 남은 말이 조사로 시작하면(‘S169와 같은 때’) 괄호째 뺀다
  s = s.replace(/\s?\(([^()]*)\)/g, (m, inner) => {
    const touched = [REC_ID, SESSION_ID, SCENE_SHORT].some((re) => has(re, inner)) || LINE_NO.test(inner) || [...inner.matchAll(KEY_RE)].some((k) => isSceneKey(nameOfKeyHead(k[0])));
    if (!touched) return m;
    const rest = stripPointers(inner);
    if (!rest || /^(와|과|의|는|은|이|가|을|를|로|으로|에서|에|도|처럼|보다)(\s|$)/.test(rest) || !/[\p{L}\p{N}]/u.test(rest)) return '';
    return `${m.startsWith(' ') ? ' ' : ''}(${rest})`;
  });
  // 줄 번호 → 뺀다(조사가 붙은 줄 번호 '#22를'은 문장의 한 자리라 못 뺀다), 떡밥 ID → 「제목」, 키 → 이름(조사 맞춤)
  if (/(?<!\[)#\d{1,4}(?:[-–]\d+)?(?:가|이|는|은|를|을|와|과|의|로|으로|에서|에)(?![\p{L}])/u.test(s)) return '';
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
  s = s.replace(BARE_EVENT_RE, (m, w, j) => (idx?.units?.has(`event_${w}`) ? withJosa(unitTitle(`event_${w}`), j) : m));
  s = s.replace(/(CH\.\d{2}) af(?![A-Za-z0-9_])/g, '$1 뒷이야기').replace(/^af(?= —)/, '뒷이야기')
    .replace(/(?:이|가) 말한 줄 \d+줄 가운데 \d+줄이/g, '의 대사 거의 다가').replace(/말한 줄 \d+줄(?:이|은)? 모두/g, '대사가 모두');
  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.)])/g, '$1').replace(/\(\s+/g, '(').replace(/\(\s*\)/g, '')
    .replace(/(?:\s*·)+\s*(?=[·,.)]|$)/g, '').replace(/^[\s·,.;:—–-]+/, '').trim();
  // ④ 남은 작업 흔적이 있으면 낼 수 없다
  if ([REC_ID, SESSION_ID, SCENE_SHORT, KEY_RE].some((re) => has(re, s)) || /(?<![A-Za-z0-9_])(?:person|place|org|concept|incident|item):/.test(s)) return '';
  if (WORK_WORD.test(s) || LINE_NO.test(s)) return '';
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
