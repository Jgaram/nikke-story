/**
 * 1회독 기록 — 형식 · 읽기 · 번호. 규칙은 docs/annotations.md.
 *
 * 기록 파일은 읽기 단위(읽기 순서 항목에 적힌 키) 하나에 하나: annotations/read1/<키>.json (`:`는 `.`으로).
 * 해석이 필요한 기록(사실 · 의문 · 회수 · 시점 · 정체 연결)은 후보다 — 확정 · 기각은 사용자가 하고, 리뷰 도구가 반영한다(CLAUDE.md).
 *
 * 후보 ID (전체에서 하나, 바꾸지 않는다):
 *   F<n>    사실 — 정의 + 처음 기록한 드러냄        F<n>-<k>  그 사실의 뒤 기록(드러냄 · 뒤집음), k는 2부터
 *   Q<n>    의문 — 정의 + 제기                      Q<n>-<k>  그 의문의 회수
 *   S<n>    작중 시점(기준점 · 회상)                V<n>      되짚기 메모(후보 아님)
 *   L<n>    정체 연결 — annotations/dictionary/people.json candidates (A1 형식에 id를 붙인 것)
 *   J<n>    떡밥 줄기 — annotations/threads.json threads (B0b): 같은 수수께끼를 다루는 의문 · 사실의 묶음
 *   G<n>    줄기 관계 — annotations/threads.json relations (B0b): 원인 · 포함 · 같은 진실 · 맞물림
 *   K<n>    층 판정 — annotations/layers.json units (B0b-2): 메인 밖 단위 하나의 등급(필수 · 보강 · 참고 · 독립 — X3f)과 그 근거 한 건. 층은 계산(tools/records/layers.mjs)
 *   Z<n>    주역 — annotations/leads.json leads (X3f): 메인 주역 명단의 한 사람 — 주역이 되는 메인 챕터(from)와 범위(arcs). 초안은 tools/views/leads.mjs
 *   B<n>    척추 — annotations/spine.json spine (X3f-1b · 1c): 메인 챕터와 함께 채점하지 않는 기준 단위(이벤트 · 사이드). 확정 = 척추, 기각 = 문 안이지만 미달. 계산은 tools/views/spine.mjs
 *   O<n>    마무리 — annotations/closures.json closures (X3f-1d): 오래 쌓인 연작 · 갈등 · 관계 · 성장이 끝난 자리(end)와 쌓인 자리(built — 기록 ID · 단위 키). 사슬 초안은 tools/views/closures.mjs
 *   H<n>    합류 — annotations/closures.json merges (X3f-1g): 한 결판(end)에서 함께 끝난 마무리 기록 O 둘 이상(members)을 한 이야기의 끝으로 묶는다
 *
 * 2회독 기록(B1a — 대사 층)은 annotations/read2/<키>.json, 단위 하나에 하나. 1회독과 같은 데이터셋에 실려 F · Q · S · J를 가리킨다:
 *   I<n>    암시 언급 — 이름 없이 대상을 가리키는 줄(`???` 이름표의 정체 포함). 언급 DB(T3-9) implied 한 줄
 *   E<n>    떡밥 — 1회독 사실 · 의문 · 줄기를 미리 흘림(암시) · 다시 꺼냄(재언급). 엣지 setup_payoff · callback
 *   D<n>    인물 변화 — 인물 · 측면의 처음 모습(기준)과 바뀜(변화: 전 → 후 · 계기 씬)
 *   U<n>    세계 생활상 — 주제별로 이 세상 사람들이 사는 모습
 *   T<n>    소속 — annotations/affiliations.json affiliations: 실장 니케 밖 인물의 소속과 작중 소속 이동(합류 · 이탈). 실장 니케의 지금 소속은 게임 데이터(기록 아님)
 *   Y<n>    수동 엣지 — annotations/links.json edges (T4-3): 기록에서 안 나오는 스토리 사이 관계, 자동 엣지를 뒤집기도 한다(T4-4)
 *   W<n>    2회독 볼 거리 — annotations/watch.json items (B1b): 1회독이 '2회독 몫'으로 넘긴 것. 작업 메모라 후보가 아니다(되짚기 메모처럼)
 * 1회독 바로잡기(놓친 회수 · 사실 등)는 2회독 파일이 아니라 그 단위의 1회독 파일에 1회독 형식으로, 항목에 session(P1 · M03 …)을 달아 적는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/** 실제 1회독 기록 */
export const READ1_DIR = path.join(ROOT, 'annotations/read1');
/** 예시(테스트 고정 파일) — 진행률 · 인계 파일에 섞이지 않는다 */
export const EXAMPLE_DIR = path.join(ROOT, 'tests/fixtures/read1');
export const PEOPLE_PATH = path.join(ROOT, 'annotations/dictionary/people.json');
/** 떡밥 줄기 · 줄기 관계 (B0b) — 1회독 기록 디렉터리 밖에 하나 */
export const THREADS_PATH = path.join(ROOT, 'annotations/threads.json');
/** 층 판정 (B0b-2) — 메인 밖 단위마다 하나 */
export const LAYERS_PATH = path.join(ROOT, 'annotations/layers.json');
/** 주역 명단 (X3f) — 하나. 예시 디렉터리에서는 `_leads.json` */
export const LEADS_PATH = path.join(ROOT, 'annotations/leads.json');
/** 척추 (X3f-1b · 1c) — 메인 챕터와 함께 채점하지 않는 기준 단위(이벤트 · 사이드). 예시 디렉터리에서는 `_spine.json` */
export const SPINE_PATH = path.join(ROOT, 'annotations/spine.json');
/** 마무리 기록 (X3f-1d) — 하나. 예시 디렉터리에서는 `_closures.json` */
export const CLOSURES_PATH = path.join(ROOT, 'annotations/closures.json');
/** 2회독 기록 (B1a) — 읽기 단위마다 하나. 예시는 tests/fixtures/read2 (1회독 예시 디렉터리의 형제) */
export const READ2_DIR = path.join(ROOT, 'annotations/read2');
/** 수동 엣지 (T4-3) — 하나. 예시 디렉터리에서는 `_links.json` */
export const LINKS_PATH = path.join(ROOT, 'annotations/links.json');
/** 소속 기록 — 하나. 예시 디렉터리에서는 `_affiliations.json`. 형식은 docs/annotations.md "소속 기록" */
export const AFFILIATIONS_PATH = path.join(ROOT, 'annotations/affiliations.json');
/** 2회독 볼 거리 (B1b) — 하나. 예시 디렉터리에서는 `_watch.json` */
export const WATCH_PATH = path.join(ROOT, 'annotations/watch.json');
/** 작중 연대기 — 시대 기준점(X1b). 예시 디렉터리는 그 안의 `_chronology.json` */
export const CHRONOLOGY_PATH = path.join(ROOT, 'annotations/chronology.json');

export const STATUSES = ['후보', '확정', '기각'];
export const CONFIDENCES = ['확실', '추정'];
/** 리뷰 결정 — 보류는 상태를 바꾸지 않고(후보 그대로) 기록만 남긴다. 후보는 되돌리기 */
export const DECISIONS = ['확정', '기각', '보류', '후보'];
export const FACT_ACTS = ['드러냄', '뒤집음'];
export const QUESTION_ACTS = ['회수'];
export const DEGREES = ['전부', '일부'];
export const TIME_KINDS = ['기준점', '회상'];
/** 시점 기록 at의 관계(X1b) — [관계, 기준, 간격?]. 뜻은 tools/views/chrono.mjs 머리말 */
export const TIME_RELS = ['직후', '뒤', '직전', '전', '동시', '중', '무렵'];
/** 시점 기록 subject — 단위(그 단위의 지금) · 구간(이 기록의 근거 장면) · 시대 기준점(@…) */
export const TIME_SUBJECTS = ['단위', '구간'];
/** 줄기 중요도 — 메인 · 세계관을 이해하는 데 얼마나 무거운가 (docs/annotations.md "떡밥 줄기") */
export const THREAD_WEIGHTS = ['뼈대', '보강', '독립'];
/** 줄기 관계 — 원인 · 포함은 a → b 방향, 같은 진실 · 맞물림은 방향 없음 */
export const RELATION_TYPES = ['원인', '포함', '같은 진실', '맞물림'];
/** 단위 등급 — "이 단위를 안 보고 메인을 읽으면 어떤가", 가장 묵직한 한 건으로 (docs/views.md 화면 1). 무거운 것부터 — 참고는 X3f(사용자, 2026-10-09) */
export const GRADES = ['필수', '보강', '참고', '독립'];
/** 메인 자리(--from)를 적는 등급 — 그 앞 자리의 등급(--before)은 이보다 가볍다 (X3f ⑤) */
export const FROM_GRADES = ['필수', '보강'];
/** 2회독 층 — 1층부터 읽는다 (docs/history/reading.md P · M) */
export const LAYERS = [1, 2, 3];
/** 떡밥 기록(E) — 암시: 드러나기(회수되기) 전에 흘림 · 재언급: 드러난(제기된) 뒤에 다시 꺼냄 */
export const ECHO_ACTS = ['암시', '재언급'];
/** 인물 변화(D) — 기준: 그 측면의 처음 모습 · 변화: 전 → 후 */
export const CHANGE_ACTS = ['기준', '변화'];
/** 인물 변화의 측면 (T4-8): 성격·태도 / 관계(지휘관 · 다른 인물) / 소속·지위 / 신체·상태 / 목표·신념 / 기억·정체 */
/** 소속 기록(T)의 act — 소속: 그 자리에서 드러난(처음부터의) 소속 · 합류: 그 자리에서 들어감 · 이탈: 그 자리에서 나감 */
export const AFFIL_ACTS = ['소속', '합류', '이탈'];
export const ASPECTS = ['성격', '관계', '소속', '신체', '신념', '기억'];
/** 세계 생활상(U)의 주제 (T4-9) — 읽으면서 늘린다. 늘릴 때는 여기와 docs/annotations.md "2회독 기록"에 더한다 */
export const LIFE_TOPICS = ['방주 사회', '지상', '구시대', '전초기지', '기업 · 조직', '일상 · 문화', '경제', '기술'];
/** 볼 거리(W)의 종류 — 2회독 기록 종류의 이름(KINDS label): 무엇으로 적을 거리인가 */
export const WATCH_KINDS = ['언급', '떡밥', '변화', '생활상'];
/** 엣지 타입 — docs/schema.md "엣지 타입" 한 목록 (T3-4) */
/** 마무리 기록의 종류 (X3f-1d) — (나) 연작 · 갈등의 결판, (다) 인물 관계 · 성장의 끝 */
export const CLOSURE_TYPES = ['연작', '갈등', '관계', '성장'];
export const EDGE_TYPES = ['prereq', 'sequel', 'setup_payoff', 'callback', 'reversal', 'character', 'keyword'];

/** 후보 종류 — 리뷰 도구의 `--kind`와 출력 이름 */
export const KINDS = {
  fact: { label: '사실', prefix: 'F' },
  question: { label: '의문', prefix: 'Q' },
  time: { label: '시점', prefix: 'S' },
  link: { label: '정체', prefix: 'L' },
  thread: { label: '줄기', prefix: 'J' },
  relation: { label: '줄기 관계', prefix: 'G' },
  layer: { label: '층', prefix: 'K' },
  lead: { label: '주역', prefix: 'Z' },
  spine: { label: '척추', prefix: 'B' },
  closure: { label: '마무리', prefix: 'O' },
  merge: { label: '합류', prefix: 'H' },
  mention: { label: '언급', prefix: 'I' },
  echo: { label: '떡밥', prefix: 'E' },
  change: { label: '변화', prefix: 'D' },
  life: { label: '생활상', prefix: 'U' },
  edge: { label: '엣지', prefix: 'Y' },
  affil: { label: '소속', prefix: 'T' },
};
export const KIND_BY_LABEL = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [v.label, k]));

export const ID = {
  def: /^([FQS])(\d+)$/,
  event: /^([FQ])(\d+)-(\d+)$/,
  link: /^L(\d+)$/,
  revisit: /^V(\d+)$/,
  thread: /^J(\d+)$/,
  relation: /^G(\d+)$/,
  layer: /^K(\d+)$/,
  lead: /^Z(\d+)$/,
  spine: /^B(\d+)$/,
  closure: /^O(\d+)$/,
  merge: /^H(\d+)$/,
  mention: /^I(\d+)$/,
  echo: /^E(\d+)$/,
  change: /^D(\d+)$/,
  life: /^U(\d+)$/,
  edge: /^Y(\d+)$/,
  affil: /^T(\d+)$/,
  watch: /^W(\d+)$/,
};
/** 한 글자 접두 + 번호인 ID의 종류 — 범위 고르기(I3..I9) · 다음 번호에 쓴다 */
export const SINGLE_PREFIX = { L: 'link', J: 'thread', G: 'relation', K: 'layer', Z: 'lead', B: 'spine', O: 'closure', H: 'merge', I: 'mention', E: 'echo', D: 'change', U: 'life', Y: 'edge', T: 'affil' };

/** 파일 · 항목에 쓸 수 있는 칸. 모르는 칸은 경고한다(오타 잡기) */
export const FIELDS = {
  file: ['_comment', 'unit', 'parts', 'session', 'by', 'date', 'summary', 'scenes', 'facts', 'questions', 'events', 'times', 'targets', 'revisit', 'revisitDone', 'slips', 'note'],
  // session: 2회독 바로잡기로 더한 항목만 — 그 2회독 세션(P1 · M03 …)
  fact: ['id', 'text', 'evidence', 'reason', 'confidence', 'status', 'by', 'session', 'about', 'note', 'reviews'],
  question: ['id', 'text', 'evidence', 'reason', 'confidence', 'status', 'by', 'session', 'about', 'note', 'reviews'],
  factEvent: ['id', 'act', 'text', 'evidence', 'reason', 'confidence', 'status', 'by', 'session', 'replacedBy', 'note', 'reviews'],
  questionEvent: ['id', 'act', 'answer', 'degree', 'text', 'evidence', 'reason', 'confidence', 'status', 'by', 'session', 'note', 'reviews'],
  time: ['id', 'kind', 'text', 'ref', 'subject', 'at', 'years', 'evidence', 'reason', 'confidence', 'status', 'by', 'session', 'note', 'reviews'],
  target: ['target', 'evidence', 'note', 'new'],
  scene: ['scene', 'text'],
  revisit: ['id', 'text', 'where'],
  revisitDone: ['id', 'note'],
  review: ['decision', 'by', 'date', 'session', 'note', 'before'],
  link: ['id', 'type', 'a', 'b', 'status', 'confidence', 'reason', 'evidence', 'by', 'note', 'reviews'],
  threadsFile: ['_comment', 'session', 'by', 'date', 'note', 'threads', 'relations'],
  thread: ['id', 'title', 'text', 'weight', 'questions', 'facts', 'about', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  relation: ['id', 'type', 'a', 'b', 'text', 'evidence', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  layersFile: ['_comment', 'session', 'by', 'date', 'note', 'units'],
  // from · before: 메인이 이 단위를 딛기 시작하는 챕터와 그 앞 자리의 등급(X3f ⑤)
  layer: ['id', 'unit', 'grade', 'basis', 'from', 'before', 'layer', 'reason', 'confidence', 'asof', 'status', 'by', 'note', 'reviews'],
  // 주역 명단 (X3f) — arcs: 아크 범위(표시 · 근거용, 없으면 메인 전체) · records: 근거 기록(뼈대 줄기 · 인물 변화 · 사실 ID)
  // origin: 주역 조항의 원점 — 정체 · 동기의 원점 사건이 처음 · 가장 온전히 나오는 메인 밖 단위 키, 메인 밖에 없으면 "메인"(X3f ①)
  // threads: 뼈대 줄기마다 줄기의 주인(owners — 그 줄기가 정체를 묻는 1–2명) · counters: 카운터스(지휘관 포함) — 주역 = 주인 + 카운터스(X3f-1c)
  leadsFile: ['_comment', 'session', 'by', 'date', 'note', 'threads', 'counters', 'leads'],
  leadThread: ['thread', 'owners', 'reason', 'confidence', 'by', 'note'],
  lead: ['id', 'person', 'from', 'arcs', 'origin', 'records', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  // 척추 (X3f-1b · 1c) — 문(주년 · 반주년 · 연말 · 신년 공지, 사이드) 안 단위마다 하나: 확정 = 척추, 기각 = 문 안이지만 기준 미달(판정 단위로 남는다)
  // gate: 문(공지가 소개한 말 — 1주년 · 신년 · 사이드) · notice: 공지 근거(게시일 · 제목 · 말), 사이드는 없다
  spineFile: ['_comment', 'session', 'by', 'date', 'note', 'criteria', 'spine'],
  spine: ['id', 'unit', 'gate', 'notice', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  // 마무리 기록 (X3f-1d) — type: 연작 · 갈등 · 관계 · 성장 · chain: 사슬 초안 키(tools/views/closures.mjs — 손으로 더한 것은 없다) ·
  // built: 쌓인 자리(기록 ID — 사실 · 의문 · 사건 · 인물 변화 · 떡밥 …, 또는 단위 키 — 연작의 앞 편) · end: 끝난 단위 키 · closing: 끝난 단위의 닫는 기록 ID
  closuresFile: ['_comment', 'session', 'by', 'date', 'note', 'closures', 'merges'],
  closure: ['id', 'type', 'chain', 'about', 'text', 'built', 'end', 'closing', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  // 합류 기록 (X3f-1g) — 한 결판에서 함께 끝난 마무리 기록(members — O ID 둘 이상, 모두 끝이 end)을 한 이야기의 끝으로 묶는다 · title: 결판 이름
  merge: ['id', 'title', 'end', 'members', 'text', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  // 2회독 (B1a). pass: P1 비교용 — 1 = 네 측면을 한 번에 뽑을 때, 2 = 측면 하나씩 다시 훑어 더한 것
  // revisit · revisitDone: 1회독과 같다(V 번호도 함께) — 아직 2회독하지 않은 단위에 넘길 것은 그 단위 키를 where에 적는다
  file2: ['_comment', 'unit', 'parts', 'session', 'by', 'date', 'note', 'mentions', 'echoes', 'changes', 'life', 'revisit', 'revisitDone', 'slips'],
  mention: ['id', 'target', 'speaker', 'evidence', 'reason', 'confidence', 'status', 'by', 'pass', 'note', 'reviews'],
  echo: ['id', 'act', 'points', 'text', 'about', 'evidence', 'reason', 'confidence', 'status', 'by', 'pass', 'note', 'reviews'],
  change: ['id', 'person', 'aspect', 'act', 'text', 'before', 'after', 'with', 'trigger', 'time', 'points', 'evidence', 'reason', 'confidence', 'status', 'by', 'pass', 'note', 'reviews'],
  life: ['id', 'topic', 'text', 'about', 'points', 'evidence', 'reason', 'confidence', 'status', 'by', 'pass', 'note', 'reviews'],
  // 수동 엣지 (T4-3 · T4-4)
  linksFile: ['_comment', 'session', 'by', 'date', 'note', 'edges'],
  edge: ['id', 'type', 'from', 'to', 'strength', 'drop', 'records', 'evidence', 'reason', 'confidence', 'status', 'by', 'note', 'reviews'],
  // 소속 기록 — game: 게임 코드 → org ID(corporations · squads, 원문에 이름이 없으면 null) · affiliations: 해석 기록(T)
  // act: 소속(처음부터 · 그 자리에서 드러난 소속) · 합류 · 이탈 · role: 그 조직 안 자리(짧게) · records: 근거 기록(인물 변화 D 등)
  affiliationsFile: ['_comment', 'session', 'by', 'date', 'note', 'game', 'affiliations'],
  affil: ['id', 'person', 'org', 'act', 'role', 'records', 'evidence', 'reason', 'confidence', 'status', 'by', 'session', 'note', 'reviews'],
  // 2회독 볼 거리 (B1b) — 작업 메모. parts: 나눠 읽는 단위의 파트(1회독 파트 — 2회독 파트와 겹치는 항목에 붙는다)
  watchFile: ['_comment', 'session', 'by', 'date', 'note', 'items'],
  watch: ['id', 'unit', 'parts', 'kind', 'text', 'evidence', 'points', 'from', 'note'],
};
/** 2회독 파일의 기록 칸 → 종류 */
export const READ2_SECTIONS = { mentions: 'mention', echoes: 'echo', changes: 'change', life: 'life' };

/** 1회독 읽기 단위 기록(사실 · 의문 · 사건 · 시점, 2회독 바로잡기 포함)인가 — 정체 연결 · 줄기 · 층 판정 · 주역 · 2회독 기록 · 수동 엣지가 아니다 */
export const isRecord = (c) => !c.people && !c.threads && !c.layers && !c.leads && !c.spine && !c.closures && !c.read2 && !c.links && !c.affil;

/** 단위 키 → 파일 이름. 파트를 나눠 읽는 단위는 첫 파트를 붙인다(event_staranis1.p4.json) */
export function fileNameFor(unit, parts = null) {
  const base = String(unit).replace(/[:/\\?*"<>|]/g, '.');
  return `${base}${parts ? `.p${String(parts).split('-')[0]}` : ''}.json`;
}

/** 오늘 날짜 YYYY-MM-DD (로컬 시각) */
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 근거 ────────────────────────────────────────────────────────────

/**
 * 근거 줄 표기를 펼친다. lines = [12, 13, "20-25"] — 숫자는 한 줄, "a-b"는 a부터 b까지(둘 다 포함).
 * @returns {{ seqs: number[], problems: string[] }}
 */
export function expandLines(lines) {
  const seqs = [];
  const problems = [];
  if (!Array.isArray(lines) || !lines.length) return { seqs, problems: ['lines가 비었다 (줄 번호 배열)'] };
  for (const x of lines) {
    if (Number.isInteger(x) && x >= 0) seqs.push(x);
    else if (typeof x === 'string' && /^\d+-\d+$/.test(x)) {
      const [a, b] = x.split('-').map(Number);
      if (a > b) problems.push(`범위 ${x}: 앞이 뒤보다 크다`);
      else if (b - a > 400) problems.push(`범위 ${x}: 너무 길다(400줄 넘음) — 씬을 나눠 적는다`);
      else for (let n = a; n <= b; n++) seqs.push(n);
    } else problems.push(`줄 번호 ${JSON.stringify(x)}: 0 이상 정수나 "a-b" 문자열이어야 한다`);
  }
  return { seqs: [...new Set(seqs)].sort((p, q) => p - q), problems };
}

/** 근거 한 덩어리를 `씬#12,20-25`로 */
export const citeOf = (ev) => `${ev?.scene ?? '?'}#${(ev?.lines ?? []).join(',')}`;
export const citeAll = (evidence) => (Array.isArray(evidence) ? evidence.map(citeOf).join(' ') : '');

// ── 데이터셋 읽기 ───────────────────────────────────────────────────

const readText = (p) => fs.readFileSync(p, 'utf8');

/** 레포 안이면 레포 기준 상대 경로, 밖이면 절대 경로 */
export function displayPath(p) {
  const r = path.relative(ROOT, p);
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? r : r === '' ? '.' : path.resolve(p);
}

/**
 * 2회독 기록 디렉터리 — 실제 기록이면 annotations/read2, 이름이 read1인 다른 디렉터리면 그 형제 read2(예시 tests/fixtures/read2), 그 밖은 없음
 */
export function read2DirFor(dir) {
  if (path.resolve(dir) === path.resolve(READ1_DIR)) return READ2_DIR;
  return path.basename(path.resolve(dir)) === 'read1' ? path.join(path.dirname(path.resolve(dir)), 'read2') : null;
}

/** 디렉터리의 기록 파일(*.json, 이름이 `_`로 시작하면 뺌). prefix는 표시 이름 앞에 붙인다(2회독 파일은 `read2/`) */
function readRecordFiles(dir, problems, prefix = '') {
  const files = [];
  if (!dir || !fs.existsSync(dir)) return files;
  for (const base of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).sort()) {
    const name = `${prefix}${base}`;
    const p = path.join(dir, base);
    const text = readText(p);
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (err) {
      problems.push({ file: name, msg: `JSON이 깨졌다 — ${err.message}` });
    }
    if (data !== null && (typeof data !== 'object' || Array.isArray(data))) {
      problems.push({ file: name, msg: '파일 전체가 객체({ … })여야 한다' });
      data = null;
    }
    files.push({ name, base, path: p, text, data });
  }
  return files;
}

/**
 * 데이터셋 = 기록 디렉터리의 *.json(이름이 `_`로 시작하면 뺌) + 정체 연결 후보(people.json) + 떡밥 줄기(threads.json) + 층 판정(layers.json) + 주역 명단(leads.json)
 * + 2회독 기록(read2 디렉터리 — files2) + 수동 엣지(links.json) + 2회독 볼 거리(watch.json — watch · watchItems, 후보가 아니다).
 * @param {{ dir?: string, people?: string|null, threads?: string|null, layers?: string|null, leads?: string|null, read2?: string|null, links?: string|null, watch?: string|null }} [opts]
 *   people: 기본 디렉터리면 annotations/dictionary/people.json, 다른 디렉터리면 그 안의 `_people.json`(있을 때만).
 *   threads · layers · leads · links · watch도 같다 — annotations/threads.json · `_threads.json`, annotations/layers.json · `_layers.json`, annotations/leads.json · `_leads.json`, annotations/links.json · `_links.json`,
 *   annotations/watch.json · `_watch.json`.
 *   read2: 2회독 기록 디렉터리(기본 read2DirFor(dir)). 2회독 파일 이름은 `read2/<파일>`로 보인다
 */
export function loadDataset({ dir = READ1_DIR, people, threads, layers, leads, spine, closures, read2, links, watch, affiliations } = {}) {
  const problems = [];
  const files = readRecordFiles(dir, problems);
  const dir2 = read2 !== undefined ? read2 : read2DirFor(dir);
  const files2 = readRecordFiles(dir2, problems, 'read2/');
  const isMain = path.resolve(dir) === path.resolve(READ1_DIR);
  const side = (p) => {
    if (!p || !fs.existsSync(p)) return null;
    const text = readText(p);
    try {
      return { name: displayPath(p), path: p, text, data: JSON.parse(text) };
    } catch (err) {
      problems.push({ file: displayPath(p), msg: `JSON이 깨졌다 — ${err.message}` });
      return null;
    }
  };
  const peopleFile = side(people !== undefined ? people : isMain ? PEOPLE_PATH : path.join(dir, '_people.json'));
  const threadsFile = side(threads !== undefined ? threads : isMain ? THREADS_PATH : path.join(dir, '_threads.json'));
  const layersFile = side(layers !== undefined ? layers : isMain ? LAYERS_PATH : path.join(dir, '_layers.json'));
  const leadsFile = side(leads !== undefined ? leads : isMain ? LEADS_PATH : path.join(dir, '_leads.json'));
  const spineFile = side(spine !== undefined ? spine : isMain ? SPINE_PATH : path.join(dir, '_spine.json'));
  const linksFile = side(links !== undefined ? links : isMain ? LINKS_PATH : path.join(dir, '_links.json'));
  const watchFile = side(watch !== undefined ? watch : isMain ? WATCH_PATH : path.join(dir, '_watch.json'));
  const closuresFile = side(closures !== undefined ? closures : isMain ? CLOSURES_PATH : path.join(dir, '_closures.json'));
  const affilFile = side(affiliations !== undefined ? affiliations : isMain ? AFFILIATIONS_PATH : path.join(dir, '_affiliations.json'));
  const base = collect(files, peopleFile, threadsFile, layersFile, leadsFile, spineFile);
  collect2(files2, linksFile, base);
  collectClosures(closuresFile, base);
  collectAffiliations(affilFile, base);
  // 볼 거리는 후보가 아니라 작업 메모다 — 후보 목록 밖에 따로 둔다
  const watchItems = watchFile?.data && typeof watchFile.data === 'object'
    ? arr(watchFile.data.items).map((o, i) => ({ file: watchFile.name, index: i, obj: o, id: o?.id ?? null, unit: o?.unit ?? null, parts: o?.parts ?? null }))
    : [];
  return { dir, dir2, files, files2, people: peopleFile, threads: threadsFile, layers: layersFile, leads: leadsFile, spine: spineFile, closures: closuresFile, links: linksFile, affiliations: affilFile, watch: watchFile, watchItems, problems, ...base };
}

/** 소속 기록 — act는 소속 · 합류 · 이탈, text는 "인물 → 조직". 단위에 딸리지 않는다(근거 씬은 evidence) */
function collectAffiliations(file, { candidates }) {
  if (!file?.data || typeof file.data !== 'object') return;
  const d = file.data;
  arr(d.affiliations).forEach((o, i) =>
    candidates.push({ file: file.name, unit: null, parts: null, session: (typeof o?.session === 'string' && o.session) || d.session || null, fileBy: d.by ?? null, affil: true,
      kind: 'affil', role: 'affil', act: o?.act ?? null, parent: null, id: o?.id ?? null,
      text: `${o?.person ?? '?'} → ${o?.org ?? '?'}${o?.role ? ` (${o.role})` : ''}`,
      evidence: o?.evidence, reason: o?.reason, confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews),
      note: o?.note ?? null, section: 'affiliations', index: i, obj: o }));
}

const arr = (x) => (Array.isArray(x) ? x : []);
const idNum = (id) => {
  const m = String(id ?? '').match(/(\d+)(?:-(\d+))?$/);
  return m ? [Number(m[1]), Number(m[2] ?? 1)] : [Infinity, 0];
};
export const compareIds = (a, b) => {
  const [x1, x2] = idNum(a);
  const [y1, y2] = idNum(b);
  return String(a)[0].localeCompare(String(b)[0]) || x1 - y1 || x2 - y2;
};

/**
 * 파일들을 후보 목록으로 편다. 후보 = { id, kind, role(def|event|link), act, text, parent, evidence, status, … , file, unit, session, obj }
 * obj는 파일 속 원래 객체(고쳐 쓸 때 쓴다).
 */
function collect(files, peopleFile, threadsFile, layersFile, leadsFile, spineFile = null) {
  const candidates = [];
  const targets = [];
  const revisits = [];
  const revisitDone = [];
  const scenes = [];
  for (const f of files) {
    const d = f.data;
    if (!d) continue;
    const base = { file: f.name, unit: d.unit ?? null, parts: d.parts ?? null, session: d.session ?? null, fileBy: d.by ?? null };
    // 2회독 바로잡기로 더한 항목은 자기 session(P1 · M03 …)을 단다 — 세션으로 고르기 · 리뷰 묶음이 그것을 따른다
    const push = (obj, extra, section, index) =>
      candidates.push({ ...base, ...extra, session: (typeof obj?.session === 'string' && obj.session) || base.session, fix: typeof obj?.session === 'string',
        id: obj?.id ?? null, text: obj?.text ?? null, evidence: obj?.evidence, reason: obj?.reason,
        confidence: obj?.confidence, status: obj?.status, by: obj?.by ?? d.by ?? null, reviews: arr(obj?.reviews), note: obj?.note ?? null,
        section, index, obj });
    arr(d.facts).forEach((o, i) => push(o, { kind: 'fact', role: 'def', act: '드러냄', parent: null }, 'facts', i));
    arr(d.questions).forEach((o, i) => push(o, { kind: 'question', role: 'def', act: '제기', parent: null }, 'questions', i));
    arr(d.events).forEach((o, i) => {
      const m = String(o?.id ?? '').match(ID.event);
      const kind = m?.[1] === 'Q' ? 'question' : m?.[1] === 'F' ? 'fact' : o?.act === '회수' ? 'question' : 'fact';
      push(o, { kind, role: 'event', act: o?.act ?? null, parent: m ? `${m[1]}${m[2]}` : null }, 'events', i);
    });
    arr(d.times).forEach((o, i) => push(o, { kind: 'time', role: 'def', act: o?.kind ?? null, parent: null }, 'times', i));
    arr(d.targets).forEach((o, i) => targets.push({ ...base, index: i, obj: o }));
    arr(d.revisit).forEach((o, i) => revisits.push({ ...base, index: i, obj: o, id: o?.id ?? null }));
    arr(d.revisitDone).forEach((o, i) => revisitDone.push({ ...base, index: i, obj: o, id: o?.id ?? null }));
    arr(d.scenes).forEach((o, i) => scenes.push({ ...base, index: i, obj: o }));
  }
  if (peopleFile?.data) {
    arr(peopleFile.data.candidates).forEach((o, i) => {
      candidates.push({
        file: peopleFile.name, unit: null, parts: null, session: null, fileBy: null, people: true,
        kind: 'link', role: 'link', act: o?.type === 'same_as' ? '같은 인물' : o?.type ?? null, parent: null,
        id: o?.id ?? null, text: `${o?.a ?? '?'} = ${o?.b ?? '?'}`, evidence: o?.evidence, reason: o?.reason, confidence: o?.confidence,
        status: o?.status, by: o?.by ?? null, reviews: arr(o?.reviews), note: o?.note ?? null, section: 'candidates', index: i, obj: o,
      });
    });
  }
  if (threadsFile?.data && typeof threadsFile.data === 'object') {
    const d = threadsFile.data;
    const base = { file: threadsFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, threads: true };
    const push = (o, i, kind, section, act, text) =>
      candidates.push({ ...base, kind, role: kind, act, parent: null, id: o?.id ?? null, text, evidence: undefined, reason: o?.reason,
        confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews), note: o?.note ?? null,
        section, index: i, obj: o });
    arr(d.threads).forEach((o, i) => push(o, i, 'thread', 'threads', o?.weight ?? null, o?.title ?? null));
    arr(d.relations).forEach((o, i) => push(o, i, 'relation', 'relations', o?.type ?? null, `${o?.a ?? '?'} ${o?.type ?? '?'} ${o?.b ?? '?'}${o?.text ? ` — ${o.text}` : ''}`));
  }
  // 층 판정 — unit은 판정하는 단위(layerUnit)이고, 후보의 unit(그 단위의 기록 파일)은 비운다: 단위 키로 고르면 1회독 기록만 잡힌다
  if (layersFile?.data && typeof layersFile.data === 'object') {
    const d = layersFile.data;
    arr(d.units).forEach((o, i) =>
      candidates.push({ file: layersFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, layers: true,
        kind: 'layer', role: 'layer', act: o?.grade ?? null, parent: null, id: o?.id ?? null, text: o?.unit ?? null, layerUnit: o?.unit ?? null,
        evidence: undefined, reason: o?.reason, confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews),
        note: o?.note ?? null, section: 'units', index: i, obj: o }));
  }
  // 주역 명단 — act는 범위(전체 · 아크), text는 인물과 주역이 되는 챕터
  if (leadsFile?.data && typeof leadsFile.data === 'object') {
    const d = leadsFile.data;
    arr(d.leads).forEach((o, i) =>
      candidates.push({ file: leadsFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, leads: true,
        kind: 'lead', role: 'lead', act: arr(o?.arcs).length ? '아크' : '전체', parent: null, id: o?.id ?? null,
        text: `${o?.person ?? '?'} ${o?.from ?? '?'}부터${arr(o?.arcs).length ? ` (${arr(o.arcs).join(' · ')})` : ''}`,
        evidence: undefined, reason: o?.reason, confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews),
        note: o?.note ?? null, section: 'leads', index: i, obj: o }));
  }
  // 척추 — act는 문(gate), text는 단위 키. spineUnit으로 단위를 든다(unit은 비운다 — 층 판정과 같다)
  if (spineFile?.data && typeof spineFile.data === 'object') {
    const d = spineFile.data;
    arr(d.spine).forEach((o, i) =>
      candidates.push({ file: spineFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, spine: true,
        kind: 'spine', role: 'spine', act: o?.gate ?? null, parent: null, id: o?.id ?? null, text: o?.unit ?? null, spineUnit: o?.unit ?? null,
        evidence: undefined, reason: o?.reason, confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews),
        note: o?.note ?? null, section: 'spine', index: i, obj: o }));
  }
  return { candidates, targets, revisits, revisitDone, scenes };
}

/** 마무리 기록(X3f-1d) — act는 종류(type), text는 문장, closureEnd로 끝난 단위를 든다(unit은 비운다 — 층 판정과 같다) */
function collectClosures(closuresFile, { candidates }) {
  if (!closuresFile?.data || typeof closuresFile.data !== 'object') return;
  const d = closuresFile.data;
  arr(d.closures).forEach((o, i) =>
    candidates.push({ file: closuresFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, closures: true,
      kind: 'closure', role: 'closure', act: o?.type ?? null, parent: null, id: o?.id ?? null, text: o?.text ?? null, closureEnd: o?.end ?? null,
      evidence: undefined, reason: o?.reason, confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews),
      note: o?.note ?? null, section: 'closures', index: i, obj: o }));
  // 합류 기록(X3f-1g) — act는 결판 이름(title), closureEnd는 함께 끝난 단위
  arr(d.merges).forEach((o, i) =>
    candidates.push({ file: closuresFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, closures: true,
      kind: 'merge', role: 'merge', act: o?.title ?? null, parent: null, id: o?.id ?? null, text: o?.text ?? null, closureEnd: o?.end ?? null,
      evidence: undefined, reason: o?.reason, confidence: o?.confidence, status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews),
      note: o?.note ?? null, section: 'merges', index: i, obj: o }));
}

/** 2회독 기록 한 줄의 표시 문장 — 리뷰 · 찾기 · 인계에 쓴다 */
function read2Text(kind, o) {
  if (kind === 'mention') return `${o?.target ?? '?'}${o?.speaker ? ' (말함)' : ''}`;
  if (kind === 'echo') return o?.text ?? null;
  if (kind === 'change') {
    const head = `${o?.person ?? '?'} ${o?.aspect ?? '?'}${Array.isArray(o?.with) && o.with.length ? `(${o.with.join(' · ')})` : ''}`;
    return o?.act === '변화' ? `${head}: ${o?.before ?? '?'} → ${o?.after ?? '?'}` : `${head}: ${o?.text ?? '?'}`;
  }
  if (kind === 'life') return o?.text ?? null;
  return null;
}

/** 2회독 파일 · 수동 엣지를 후보 목록에 더한다 — 후보 모양은 1회독과 같고 read2 · links 표시가 붙는다. 되짚기 메모도 1회독 목록에 read2 표시로 */
function collect2(files2, linksFile, { candidates, revisits, revisitDone }) {
  for (const f of files2) {
    const d = f.data;
    if (!d) continue;
    const base = { file: f.name, unit: d.unit ?? null, parts: d.parts ?? null, session: d.session ?? null, fileBy: d.by ?? null, read2: true };
    arr(d.revisit).forEach((o, i) => revisits.push({ ...base, index: i, obj: o, id: o?.id ?? null }));
    arr(d.revisitDone).forEach((o, i) => revisitDone.push({ ...base, index: i, obj: o, id: o?.id ?? null }));
    for (const [section, kind] of Object.entries(READ2_SECTIONS)) {
      arr(d[section]).forEach((o, i) =>
        candidates.push({ ...base, kind, role: kind, act: kind === 'mention' ? (o?.speaker ? '말함' : '언급') : kind === 'life' ? o?.topic ?? null : o?.act ?? null,
          parent: null, id: o?.id ?? null, text: read2Text(kind, o), evidence: o?.evidence, reason: o?.reason, confidence: o?.confidence,
          status: o?.status, by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews), note: o?.note ?? null, section, index: i, obj: o }));
    }
  }
  if (linksFile?.data && typeof linksFile.data === 'object') {
    const d = linksFile.data;
    arr(d.edges).forEach((o, i) =>
      candidates.push({ file: linksFile.name, unit: null, parts: null, session: d.session ?? null, fileBy: d.by ?? null, links: true,
        kind: 'edge', role: 'edge', act: o?.drop ? `${o?.type ?? '?'} 지움` : o?.type ?? null, parent: null, id: o?.id ?? null,
        text: `${o?.from ?? '?'} → ${o?.to ?? '?'}`, evidence: o?.evidence, reason: o?.reason, confidence: o?.confidence, status: o?.status,
        by: o?.by ?? d.by ?? null, reviews: arr(o?.reviews), note: o?.note ?? null, section: 'edges', index: i, obj: o }));
  }
}

/** 다음에 쓸 번호 — 데이터셋 전체(기각 포함)에서 가장 큰 번호 + 1. 사건 번호는 사실 · 의문마다 따로 */
export function nextIds(ds) {
  const max = { F: 0, Q: 0, S: 0, V: 0, L: 0, J: 0, G: 0, K: 0, Z: 0, B: 0, O: 0, H: 0, I: 0, E: 0, D: 0, U: 0, Y: 0, T: 0, W: 0 };
  const events = new Map();
  const bump = (p, n) => {
    if (n > max[p]) max[p] = n;
  };
  for (const c of ds.candidates) {
    const id = String(c.id ?? '');
    let m;
    if ((m = id.match(ID.def))) bump(m[1], Number(m[2]));
    else if ((m = id.match(ID.event))) {
      const k = `${m[1]}${m[2]}`;
      events.set(k, Math.max(events.get(k) ?? 1, Number(m[3])));
    } else if ((m = id.match(/^([LJGKZBOHIEDUYT])(\d+)$/))) bump(m[1], Number(m[2]));
  }
  for (const r of ds.revisits) {
    const m = String(r.id ?? '').match(ID.revisit);
    if (m) bump('V', Number(m[1]));
  }
  for (const w of ds.watchItems ?? []) {
    const m = String(w.id ?? '').match(ID.watch);
    if (m) bump('W', Number(m[1]));
  }
  return {
    ...Object.fromEntries(Object.entries(max).map(([p, n]) => [p, `${p}${n + 1}`])),
    /** 사실 · 의문 하나의 다음 사건 번호 */
    eventOf: (parent) => `${parent}-${(events.get(parent) ?? 1) + 1}`,
  };
}

/** 리뷰 기록을 차례로 적용한 상태 — 보류는 바꾸지 않는다 */
export function statusFromReviews(reviews, initial = '후보') {
  let s = initial;
  for (const r of arr(reviews)) if (r && STATUSES.includes(r.decision)) s = r.decision;
  return s;
}

/** 마지막 리뷰가 보류면 true — 리뷰 도구가 먼저 보여 준다 */
export const isDeferred = (c) => c.status === '후보' && arr(c.reviews).at(-1)?.decision === '보류';

/**
 * 척추 집합(X3f-1b · 1c) — annotations/spine.json에서 확정된 단위 키. 메인 챕터는 kindOfKey로 따로 본다(tools/records/order.mjs)
 * @param {ReturnType<typeof loadDataset>} ds
 * @returns {Set<string>}
 */
export function spineUnits(ds) {
  return new Set(ds.candidates.filter((c) => c.kind === 'spine' && c.status === '확정' && c.spineUnit).map((c) => c.spineUnit));
}

/**
 * 같은 인물 묶음(X3f-1c) — 확정된 정체 연결(people.json same_as) 가운데 인물(person:) 쌍을 묶는다. 대표는 부르는 쪽이 고른다(tools/views/leads.mjs)
 * @param {ReturnType<typeof loadDataset>} ds
 * @returns {Map<string, string[]>} 인물 → 같은 인물 전부(자기 포함, ID 순)
 */
export function sameAsGroups(ds) {
  const parent = new Map();
  const find = (x) => {
    while (parent.has(x) && parent.get(x) !== x) x = parent.get(x);
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (!parent.has(ra)) parent.set(ra, ra);
    if (!parent.has(rb)) parent.set(rb, rb);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const c of ds.candidates) {
    if (c.kind !== 'link' || c.status !== '확정' || c.obj?.type !== 'same_as') continue;
    const [a, b] = [c.obj.a, c.obj.b];
    if (typeof a === 'string' && typeof b === 'string' && a.startsWith('person:') && b.startsWith('person:')) union(a, b);
  }
  const members = new Map();
  for (const x of parent.keys()) (members.get(find(x)) ?? members.set(find(x), []).get(find(x))).push(x);
  const out = new Map();
  for (const xs of members.values()) {
    xs.sort();
    for (const x of xs) out.set(x, xs);
  }
  return out;
}

