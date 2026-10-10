# 도구 · 데이터 다루기

CLAUDE.md에서 옮겨 온 도구 사용법이다(2026-10-10). 필요한 절만 `grep -n`으로 찾아 읽는다.
기록 도구(`records.mjs` · `synopsis.mjs`)의 형식과 쓰는 법은 docs/annotations.md, 사이트 도구는 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".

## 원문 읽기 — `tools/read.mjs`

원문은 블라링크 약 477만 자 + 금서고 약 148만 자라 한 번에 못 읽는다(파트로 나누면 700개 남짓). 스토리를 조사할 때는 단위로 뽑아 읽는다.
출력은 Claude가 읽는 용도다. 모든 항목에 키가 붙어 있고, 그 키를 그대로 다시 넣으면 된다.

용어 — 사용자와 말할 때도 이렇게 쓴다. **"화자"라는 말은 쓰지 않는다**(서술자로 읽힌다):
- **이름표**: 대사창에 뜨는, 그 줄을 말한 인물 이름(`lines.speaker_name`). 서술자가 아니다.
  이 게임의 서술은 3인칭(`Narration`)이거나 지휘관 1인칭 독백(`Monologue`)이고, 지휘관이 소리 내 하는 말은 `Self`다.
- **호감도 스토리**: 니케마다 호감도 레벨로 열리는 개인 스토리 5편(193명 × 5 = 965편).
  데이터·코드에서는 `episode`(`ep:` 접두, 원본 `attractscene`).

```bash
node tools/read.mjs list                  # 종류별 요약 → list main|event|sudden|char 로 목차
node tools/read.mjs ch07                  # 메인 챕터 (chapter 7, chapter 재회도 된다)
node tools/read.mjs event_nocallerid      # 이벤트 (event nocallerid도 된다)
node tools/read.mjs sudden:22             # 돌발 = 전초기지 건물별 대화
node tools/read.mjs char:10               # 인물: 다른 곳에서 말한 씬 목록(단위·씬 ID·줄 수) + 호감도 스토리 전문
node tools/read.mjs char:마리안            # 호감도 스토리가 없는 인물은 이름표로
node tools/read.mjs char:10 --lines       # 그 인물이 말한 대사만, 앞 문맥 1줄과 함께 (--context N)
node tools/read.mjs d_main_07_01          # 씬 하나 + 이전/다음 씬 키
node tools/read.mjs ch44 --part 2         # 긴 단위는 파트로 나뉜다. 머리말에 `파트 1/5`, 꼬리말에 다음 명령
node tools/read.mjs side:mudfish          # 금서고 단위: side:(사이드) · sub:(서브퀘스트) · relic:(유실물) · erelic:(이벤트 유실물) · fl:(이벤트)
```

- 한 파트는 **2만 자 이하**(≈ 2만 토큰, 2026-09 실측 한국어 1자 ≈ 1토큰)라 Bash 출력 한도(3만 자) 안에서 잘리지 않는다.
  씬 경계에서 고르게 나누고, 같은 데이터면 `--part N`은 늘 같은 곳이다.
- 표기: `이름: 대사`(이름표) · `지휘관:` 플레이어 대사 · `(독백)` 지휘관 1인칭 서술 · `* ` 3인칭 서술·효과음 · `▷` 선택지.
  `→#N`은 같은 씬 N번 줄로 이동(선택지는 그 응답, 그 밖은 분기 끝 → 합류), `#N`은 이동 도착 줄이다.
- 금서고 단위(`list side|sub|relic|erelic`, `list event`의 `fl:`)는 표기가 더 있다: `~ ` 서술·독백 구분 없는 줄 ·
  `> ` 문서(유실물) · `✉` 메신저 · `⇒` 고른 선택지에 따라 이어지는 씬 · `[연출]` 연출 명령 줄.
  씬 키(`side:mudfish_03`)는 금서고 파일 안 순서이고 게임 씬 ID가 아니다. 블라링크 이벤트가 본문 없이 금서고로 대신될 때는
  (`event_forrest` → `fl:for_rest`) 머리말에 안내가 나온다.
- 인물은 **이름표**로 찾는다 — 그 인물이 **말한** 씬만 잡힌다. 서술 속에만 나오거나 이름이 불리기만 한 장면은 안 잡힌다.
  이명(`라피 : 레드 후드`)·익명(`???`)은 이름표가 다를 수 있으니 머리말의 "비슷한 이름표"를 보고 `--speaker`로 바꾼다.
- 외부 참고 표의 값은 보여 주지 않는다(CLAUDE.md "외부 참고 표").
- 관계선(X2 — 선행 조건 · 다음 편 · 떡밥 · 대상 공유 · 수동 엣지)은 `node tools/query.mjs links <단위|씬ID>`(`--type` · `--min`), 전문 검색은 `query.mjs search`.
  관계선은 DB에 싣지 않고 `tools/views/links.mjs`가 DB + 기록 + `annotations/links.json`으로 계산한다(docs/schema.md "관계선"). 연작처럼 기록 · 키로 안 나오는 관계는 `links.json`에 Claude가 확정해 더한다.
  대상이 나온 씬(언급 DB — 이름표로 말함 · 이름 · 별칭, 출시순 · 처음 등장)은 `query.mjs appear <대상>` · `targets <씬|단위>`(docs/schema.md "언급 DB").
- 후보의 근거를 쓸 때는 `--num`으로 읽는다 — 줄 앞 `#N`(= DB `lines.seq`, 씬 안 0부터)이 근거 줄 번호다.
  1회독 · 2회독 기록 · 검증 · 리뷰 · 인계는 `node tools/records.mjs`(형식과 쓰는 법은 docs/annotations.md — 2회독은 "2회독 기록" · "2회독 인계 파일").
  판정 세션은 `records.mjs find <낱말> --spine`(척추 — 메인 챕터 + `annotations/spine.json` 확정 단위 — 안 기록만) · `layers <단위>` · `leads` · `closures <단위>`로 본다(docs/importance.md 6절).
  빌드업 마무리(오래 쌓인 연작 · 갈등 · 관계 · 성장의 끝)는 `records.mjs closures`(마무리 기록 O — `annotations/closures.json`, 형식 docs/annotations.md "마무리 기록").
- 사이트에 싣는 스토리별 공개 개요는 `node tools/synopsis.mjs`(`progress W9a` · `new <단위 …>` · `check` · `set … 확정`, 형식 docs/annotations.md "공개 개요").

## 출시 순서 · 질의 — `tools/notices/` · `tools/query.mjs` (T3-7)

메인 챕터 · 사이드 스토리 · 이벤트 · 호감도 스토리의 공개 순서는 **공식 공지(nikke-kr.com)** 에서 뽑는다. 게임 데이터에는 출시일이 없다.
금서고 단위(사이드 스토리 `side:` · 블라링크에 없는 이벤트 `fl:`)는 금서고 목록 제목으로 공지 이름에 잇는다.
서브퀘스트 · 유실물은 공지에 개방 기록이 없어 순서표에 없다. 대신 지역(= 챕터)을 `annotations/subquest-regions.json` ·
`annotations/relic-regions.json`에 근거 · 확신도와 함께 두고, 그 챕터 바로 뒤에 읽는다(TODO.md 결정 #9).
읽기 순서(docs/history/reading.md R · M)는 이 순서표 + 두 지역 파일로 짠 출시순 한 줄이다.

```bash
node tools/notices/fetch.mjs            # 새 공지 · 제목이 바뀐 공지 · 최근 45일 공지만 받는다 (--force 전부)
node tools/notices/release-order.mjs    # → data/release/release-order.csv · report.md (커밋한다)
node tools/query.mjs releases [main|side|event|episode] [--from 날짜] [--to 날짜]
node tools/query.mjs known ch20         # 컷오프(X1a) — 그 공개 자리까지 아는 사실 · 의문 (숫자 = 공개 자리, 날짜 = 그날까지, --thread · --about · --list)
node tools/query.mjs chrono event_redash # 작중 연대기(X1b) — 단위의 작중 자리(판별 · 범위 · 상대 · 불명) · 시점 기록 관계 · 출시순과 어긋남 (ch20 · @방주_밀봉 = 그 점 무렵)
node tools/query.mjs chrono person:라피    # 인물 변화의 작중 시점(X1d) — 2회독 기준 · 변화를 작중 순서로, 뒤바뀜 표시
node tools/query.mjs grades ch38           # 중요도 컷오프(X3f) — 그 자리까지 나온 메인 밖 단위의 그 자리 등급(필수 · 보강 · 참고 · 독립, --list)
node tools/query.mjs person 라피             # 인물별 집계(X3d) — 등장(자동 + 암시 언급) · 함께 나온 인물 · 사실 · 의문 · 줄기 · 변화 · 마무리 (--list 기록 ID)
```

- 공지 요청도 CDN 규칙과 같은 태도로: 한 번에 하나, 요청 사이 1초, 지수 백오프 3회. 받은 공지는 다시 받지 않는다.
- 같은 날 = 같은 순위. 이벤트는 한 줄(첫 개방일), 파트 개방일은 `parts` 칸에 참고로. 호감도 스토리 = 니케 첫 모집일.
- 공개 자리 · 진실 공개 단계 · 이벤트 메타데이터 · 작중 자리는 `data/views/timeline/`(`tools/views/timeline.mjs`, `draft.mjs`가 같이 부른다 — 규칙 docs/views.md "공개 축" · tools/views/chrono.mjs).
  작중 자리는 시점 기록의 `at`(관계 · 기준)과 시대 기준점(`annotations/chronology.json`)으로 계산한다 — 새 시점 기록에는 `at`을 같이 쓴다(docs/annotations.md "작중 연대기").
  시점 기록이 없거나 모자란 단위는 같은 파일의 좁힘 항목(`units` — 관계 · 근거 · 이유 · 확신도, 한쪽만 아는 조각은 `piece`)과 모습 코드 표(`codes`)로 좁힌다(X1c, 같은 문서 "좁힘").
  같은 날 = 같은 자리, 같은 날 메인 챕터만 차례로, 서브퀘스트 · 유실물은 딸린 챕터의 자리.
  작중 자리를 공개 자리와 견준 어긋남 · 작중 순서(화면 6 시안 `chrono.md`) · 인물 변화의 작중 시점 · 공개 단계의 작중 축은 계산이다(X1d — `tools/views/chrono-order.mjs`). 기록을 고치면 다시 뽑힌다.
- 공지에 도입 기록이 없는 니케는 "출시 로스터(추정)"로 출시일에 둔다. 공지로 날짜를 못 얻는 단위는
  `annotations/release-overrides.json`에 **근거를 달아** 손 보정한다(근거는 원문 · 공지 · 게임 데이터).
- 새로 못 찾은 것 · 스토리 데이터에 없는 이벤트 · 못 읽은 인물 이름은 `data/release/report.md`에 뜬다.
  공지 표기가 다른 콜라보 이름은 `tools/notices/aliases.json`에 잇는다.

## 데이터 다룰 때 함정

- **대사 본문 필드 이름이 `quest_name`이다.** `scene_name`이나 `text`가 아니다.
  호감도 스토리(`attractscene`)는 `scenario_localkey`가 본문이고 이름표는 `speaker_detail.name_localkey`다.
- 원본 `speaker` 칸(이름표 코드)에 창 종류(`Self`/`Monologue`/`Narration`/`Choice`)가 들어 있기도 하다. 사람이 아니다.
  **`Self`는 지휘관(플레이어)이 하는 말, `Monologue`는 지휘관 1인칭 독백, `Narration`은 3인칭 서술이다.**
  정규화에서 `speaker_id`는 비우고 `window`로 구분한다.
- 원본 JSON은 모든 값이 `{ value: ... }` 래퍼로 한 겹씩 감싸여 있다. 정규화 없이 쓰지 말 것.
- 씬의 안정적 키는 `scenario_group_id`(예: `d_main_01_01_s`, `event_nocallerid_01_s`).
  숫자 `id`는 카테고리마다 중복된다.
- **챕터 번호를 ID에서 읽지 말 것.** `main:N`의 N은 챕터 번호가 아니고(`main:8` = CHAPTER.07, `main:76` = CHAPTER.48),
  씬 ID도 어긋난다(CHAPTER.00과 CHAPTER.01이 둘 다 `d_main_01_*`). 번호는 `categories.locale_key`
  (`chapter_name_07`)에서 온다. `read.mjs`의 `ch07` 키는 이 번호를 쓴다.
- 한국어는 경로 치환 예외가 있다 — `{lang}` 치환 후 `_ko`를 제거한다.
  `formatLangPath()`가 처리하므로 경로를 직접 조립하지 말 것.
- 인덱스에 있는데 CDN에 없는 씬이 있다(일부 콜라보 이벤트). 누락은 정상이며 리포트로 남긴다.
