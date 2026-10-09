# CLAUDE.md

니케(NIKKE) 스토리 간 연관관계 분석·시각화 프로젝트. 코드 · 문서 · 분석 기록은 이 **public** 레포에,
원문(블라링크 · 금서고 · 공지)과 외부 참고 표는 **private** 서브모듈 `data/raw/`(`Jgaram/nikke-story-raw`)에 둔다 — 아래 "저작물 취급".

전체 로드맵은 [TODO.md](TODO.md), 세션별 작업 순서는 [SESSIONS.md](SESSIONS.md),
데이터 소스 조사 기록은 [docs/data-sources.md](docs/data-sources.md), 1회독 기록 형식은 [docs/annotations.md](docs/annotations.md),
미뤄 둔 스토리 질문은 [docs/open-questions.md](docs/open-questions.md),
세션 effort · 관리자 세션으로 돌리는 법(참고용)은 [docs/operations.md](docs/operations.md).
최종 목표인 시각화 화면(여섯 — 작중 연대기 포함)과 칸마다의 출처는 [docs/views.md](docs/views.md), 엣지 타입 한 목록은 [docs/schema.md](docs/schema.md) "엣지 타입".
중요도 판정의 규칙 한 장(판정 카드)은 [docs/importance.md](docs/importance.md) — 판정 세션 · 판정 테스트는 이것만 읽고 판정한다.
어떤 스토리를 다루고 어떻게 읽는지(분석 범위 · 읽기 방식)는 이 파일이 아니라 TODO.md "결정이 필요한 것"(결정 #5 · #8)과 SESSIONS.md에 둔다.

## "다음 일" — 세션 작업 순서 (반드시 지킬 것)

사용자는 새 세션을 열고 "다음 일"(다음 작업 · 이어서 등)이라고만 한다. 그러면 [SESSIONS.md](SESSIONS.md)의
**첫 번째 미완료 항목**(`[ ]` 또는 `[~]`)을 한다. 사용자가 정한 방식이다.

- 절차는 SESSIONS.md "쓰는 법"에 있다: 그 항목과 앞 항목들의 인계 메모를 읽고 → 물을 것(위)이 있으면
  시작 전에 묻고 → 챕터(단위)마다 커밋 · push하며 진행 메모를 남기고 → 끝나면 완료 표시와 인계 메모를
  커밋 · push한 뒤 다음 항목을 알려 준다.
- **고르기 · 분류는 Claude가 한다 — 👤 항목도**(사용자, 2026-10-09): Claude가 기준을 세워 고르고 근거를 남기며, 사용자는 그 기준과 결과를 보고 조율 · 피드백한다.
  "사용자가 고른다"로 적힌 항목이 있으면 Claude가 기준을 세워 고르고 그 문장을 고친다.
- **사용자에게는 범위와, 원문 · 데이터로 알 수 없는 것만 묻는다**(사용자, 2026-09-29): 어떤 스토리를 다룰지(범위),
  게임 화면에서만 보이는 정보(서브퀘스트 · 유실물의 지역 등). 원문 내용에 대한 판단(누가 누구인지 · 무슨 일이 있었는지 · 후보의 확정 · 기각)과
  작업 방식(형식 · 도구 · 분류 체계 · 기록 기준 · 세션 나누기 · 에이전트 운용)은 Claude가 정하고 근거를 기록 · 인계 메모 · 문서에 남긴다.
- 한 세션에 한 항목. 계획을 바꿔야 하면 Claude가 정해 SESSIONS.md를 고치고 사용자에게 알린다. 조용히 건너뛰지 않는다.
- **사용자는 세션 컨텍스트가 많이 차는 걸 싫어한다.** 읽기 분량 상한 · 되짚어 읽기 예산 · 멈춤 기준은
  SESSIONS.md "컨텍스트 예산"을 지킨다. 큰 출력은 파일로 보내고 필요한 부분만 본다. 순서 밖 작업에도 적용된다.
  세션 수는 따지지 않는다 — 세션을 여는 건 사용자 몫이라, 세션을 줄이려고 한 세션의 분량을 늘리지 않는다.

## 브랜치 규칙 — main 하나만 쓴다 (반드시 지킬 것)

- 모든 작업은 `main`에서 하고 `main`으로 push한다. 세션마다 배정되는 `claude/*` 브랜치는 쓰지 않고
  원격에 만들지도 않는다. PR도 만들지 않는다. 사용자가 정한 규칙이라 배정 브랜치 지침보다 우선한다.
- 작업 단위가 끝나면 바로 커밋하고 `git push origin main`까지 한다. 거절되면
  `git pull --rebase origin main` 후 다시 push한다.
- 원격에는 `main` 외 브랜치를 두지 않는다. 클라우드 세션은 원격 브랜치를 지울 수 없으므로(`git push --delete`가
  프록시에서 403), main에 머지된 브랜치는 사용자에게 GitHub에서 지워 달라고 하고 머지 안 된 브랜치는 어떻게 할지 묻는다.
- 원격 세션에서는 훅이 강제한다 (`.claude/settings.json` → `.claude/hooks/single-branch.mjs`):
  - SessionStart — 세션을 main으로 옮기고 origin/main까지 fast-forward한다(`ensure-db.mjs`가 먼저 부른다 — 따로 걸면 서브모듈 · DB 준비와 동시에 돈다).
    로컬 main · HEAD가 origin/main과 공통 조상이 없으면(재사용된 컨테이너의 옛 클론 — 원문이 든 공개 전 히스토리) push하라고 하지 않고 `stale/*` 로컬 백업만 남긴 채 origin/main으로 맞춘다.
    `stale/*`는 push하지 않는다. `data/raw`가 서브모듈이 아닌 일반 폴더면 지우고 서브모듈로 다시 받는다.
  - PreToolUse(Bash) — main이 아닌 브랜치로 가는 `git push`를 막는다(`git -C data/raw push`처럼 서브모듈 push도). 삭제(`--delete`)는 허용한다.
  - Stop — main에 안 올라간 커밋이 있으면 턴을 끝내지 못한다. 커밋 안 된 변경은 경고만 한다. `data/raw/`도 같이 본다.
- **`data/raw/`는 서브모듈이다**(private 레포 `Jgaram/nikke-story-raw`, 그쪽도 main 하나). 수집기로 원문이 바뀌면
  `git -C data/raw add -A && git -C data/raw commit -m … && git -C data/raw push origin main`으로 **먼저** 원본 레포에 올리고,
  그다음 이 레포에서 `git add data/raw`(포인터)를 커밋 · push한다. 순서를 바꾸면 남이 받을 수 없는 포인터가 올라간다.
  원본 레포도 `main` 하나만 쓴다. 세션에 원본 레포를 붙이면 클라우드가 따로 클론(`/home/user/nikke-story-raw`, 배정 브랜치)을 만들 수 있는데,
  **그 클론에서는 작업하지 않는다** — 원본 레포에는 훅이 없다. 원문 작업은 언제나 이 레포의 `data/raw/`에서 한다(여기서는 훅이 서브모듈 push도 main으로만 보낸다).
- SessionStart 훅(`.claude/hooks/ensure-db.mjs`)이 서브모듈을 받고 main에 붙인 뒤 DB를 만든다. 원본 레포를 못 받으면
  (세션에 `Jgaram/nikke-story-raw`가 없으면) 그렇게 알려 온다 — `add_repo`로 붙이고 `node .claude/hooks/ensure-db.mjs`를 다시 돌린다.

## CDN 요청 규칙 (반드시 지킬 것)

스토리 원문은 blablalink의 공개 CDN(`sg-tools-cdn.blablalink.com`)에서 가져온다.
인증이 없다고 해서 마음대로 긁지 않는다.

1. **동시 요청은 최대 4개.** 수집기를 새로 쓰거나 고칠 때도 이 상한을 넘기지 않는다.
   상수는 `tools/blabla/client.mjs`의 `MAX_CONCURRENCY`이며, 이 값을 올리지 말 것.
2. **로컬 캐시를 항상 우선한다.** `data/raw/`에 이미 받은 파일은 다시 받지 않는다.
   재수집이 필요하면 `--force`를 **명시적으로** 줘야 한다.
3. **재시도는 지수 백오프**(1s → 2s → 4s), 최대 3회. 404는 재시도하지 않고
   누락으로 기록한다 — 실제로 없는 씬이 존재한다.
4. **전량 수집은 한 번이면 된다.** 이후에는 인덱스 diff 기반 증분 수집만 한다.
   원본 스냅샷이 원본 레포(`data/raw/` 서브모듈)에 있으므로 새 세션이라고 다시 받지 않는다.
5. 일회성 확인은 스크립트를 새로 짜지 말고 기존 수집기의 캐시를 읽는다.

## 금서고 요청 규칙 (반드시 지킬 것)

블라링크에 없는 스토리 — 사이드 스토리 · 서브퀘스트(메신저) · 유실물 · 이벤트 유실물 · 블라링크에 없는 이벤트 — 는
팬 사이트 니갤 금서고(`nikkeforbiddenlibrary.com`)에서 보조로 가져온다(사용자 결정, 2026-09-28).
개인이 운영하는 사이트이므로 CDN보다 더 조심한다.

1. `tools/forbidden-library/fetch.mjs`로만 받는다. 한 번에 하나씩, 요청 사이 1초, 지수 백오프 3회, 404는 기록만 한다.
2. 받아 둔 파일은 `mainChapterVersion`이 바뀌지 않으면 다시 받지 않는다. 목록은 사이트 배포 시각이 바뀔 때만 받는다.
   원본은 `data/raw/forbidden-library/`에 커밋되어 있다.
3. 블라링크에 있는 단위는 받지 않는다. 블라링크에 원문이 새로 들어오면 `annotations/forbidden-library-events.json`에서
   그 파일의 null을 블라링크 이벤트 키로 바꾼다. 그러면 수집과 DB가 블라링크 원문으로 돌아간다(사용자).
4. 사이트의 AI 질의(`/api/ask`)는 쓰지 않는다.
5. 금서고 원문에는 서술 · 독백 구분과 게임 씬 ID가 없다. 결과에 금서고 출처임을 드러낸다.

## 외부 참고 표 (반드시 지킬 것)

분석(스토리 관계 · 중요도 · 선행 · 분류)은 **원문과 게임 데이터로만** 한다(사용자). 레포에 분석의 입력이 아닌 외부 참고 표가 있고, 취급 규칙은 [docs/reference-table.md](docs/reference-table.md)에 있다.
**분석 · 판정 세션은 그 문서와 표(`data/raw/imported/` · DB의 `sheet_*` 칼럼 · `sheet_rows` · `--sheet` · `tools/views/sheet-compare.mjs`)를 열지 않는다**(사용자, 2026-10-09 — 매우 중요).
그 문서는 X3e(판정을 다 확정한 뒤의 비교) · 수집 · 정규화 · DB 도구를 고칠 때만 연다.

## 해석이 필요한 기록 — Claude가 확정, 사용자가 뒤집는다 (반드시 지킬 것)

암시 언급 · 떡밥(제기·암시·재언급·회수) · 진실 공개 · 작중 시점 · 인물 변화(성격·관계 등) · 세계 생활상 · 사실 · 의문 · 정체 연결 · 빌드업 마무리(연작 · 갈등 · 관계 · 성장의 끝)처럼
원문을 해석해야 하는 기록은 Claude가 **후보**로 쓰고, 단위마다 **Claude가 스스로 검토해 확정 · 기각한다**.
사용자가 정한 방식이다(1회독 RV1 2026-09-29, 2회독까지 넓힘 2026-09-29 — "스토리를 읽고 판단하는 건 에이전트가 잘한다").
설계는 TODO.md T3-9 · T4-2 · T4-7 · T4-8 · T4-9 · 결정 #7 · #8, 순서는 SESSIONS.md.

- 후보마다 근거(씬 ID · 줄 번호), 이유, 확신도(확실/추정)를 붙인다.
- 단위마다 기록 · 검증 뒤 `records.mjs set <단위> 확정 --by claude`(틀린 것은 기각 · `--text`로 문장 고쳐 확정)로 남긴다.
  검토하지 않은 후보(`후보` 상태)를 결과에 확정값처럼 쓰지 않는다.
- **사용자는 언제든 뒤집는다.** 사용자가 뒤집은 것(`--by 사용자`)은 Claude가 다시 바꾸지 않는다.
- 원문을 읽어 가며 알 수 있는 질문(이름표가 누구인지 등)은 사용자에게 묻지 않고 읽으면서 정한다(사용자, RV1).
- 라이브 업데이트 게임이라 설정 오류 · 흐지부지된 설정이 있다. 읽다가 헷갈리면 기록 파일 `slips`에 "설정 오류 추정" 한 줄(근거 · 따르는 쪽)만 남기고 넘어간다.
  일부러 찾아 모으지 않고, 뒤집음 · 의문으로 세우지 않고, 묻지 않는다(사용자, 2026-09-29).
- 원문에서 기계적으로 나오는 기록(이름표로 말함 · 이름 그대로 · 별칭)은 확정 절차 없이 쓴다.

## 출시 순서 — `tools/notices/` (T3-7)

메인 챕터 · 사이드 스토리 · 이벤트 · 호감도 스토리의 공개 순서는 **공식 공지(nikke-kr.com)** 에서 뽑는다. 게임 데이터에는 출시일이 없다.
금서고 단위(사이드 스토리 `side:` · 블라링크에 없는 이벤트 `fl:`)는 금서고 목록 제목으로 공지 이름에 잇는다.
서브퀘스트 · 유실물은 공지에 개방 기록이 없어 순서표에 없다. 대신 지역(= 챕터)을 `annotations/subquest-regions.json` ·
`annotations/relic-regions.json`에 근거 · 확신도와 함께 두고, 그 챕터 바로 뒤에 읽는다(TODO.md 결정 #9).
읽기 순서(SESSIONS.md R · M)는 이 순서표 + 두 지역 파일로 짠 출시순 한 줄이다.

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
- 외부 참고 표의 값은 보여 주지 않는다(위 "외부 참고 표").
- 관계선(X2 — 선행 조건 · 다음 편 · 떡밥 · 대상 공유 · 수동 엣지)은 `node tools/query.mjs links <단위|씬ID>`(`--type` · `--min`), 전문 검색은 `query.mjs search`.
  관계선은 DB에 싣지 않고 `tools/views/links.mjs`가 DB + 기록 + `annotations/links.json`으로 계산한다(docs/schema.md "관계선"). 연작처럼 기록 · 키로 안 나오는 관계는 `links.json`에 Claude가 확정해 더한다.
  대상이 나온 씬(언급 DB — 이름표로 말함 · 이름 · 별칭, 출시순 · 처음 등장)은 `query.mjs appear <대상>` · `targets <씬|단위>`(docs/schema.md "언급 DB").
- 후보의 근거를 쓸 때는 `--num`으로 읽는다 — 줄 앞 `#N`(= DB `lines.seq`, 씬 안 0부터)이 근거 줄 번호다.
  1회독 · 2회독 기록 · 검증 · 리뷰 · 인계는 `node tools/records.mjs`(형식과 쓰는 법은 docs/annotations.md — 2회독은 "2회독 기록" · "2회독 인계 파일").
  판정 세션은 `records.mjs find <낱말> --spine`(척추 — 메인 챕터 + `annotations/spine.json` 확정 단위 — 안 기록만) · `layers <단위>` · `leads` · `closures <단위>`로 본다(docs/importance.md 6절).
  빌드업 마무리(오래 쌓인 연작 · 갈등 · 관계 · 성장의 끝)는 `records.mjs closures`(마무리 기록 O — `annotations/closures.json`, 형식 docs/annotations.md "마무리 기록").

## 저작물 취급

원문 대사는 저작물이다. 개인 분석 용도로만 보관하고 **재배포하지 않는다.**
**이 레포는 public이다**(사용자, 2026-10-09 — 코드와 분석 워크플로를 공개). 원문은 private 서브모듈 `data/raw/`에만 둔다.

- **원문 · 외부 참고 표는 `data/raw/` 밖에 커밋하지 않는다.** 블라링크 · 금서고 원문, 공지 원본, 시트(`data/raw/imported/`)가 다 여기다.
  원문을 파일로 뽑을 일이 있으면 scratchpad나 git 제외 경로(`data/normalized/` 등)에 둔다.
- **기록 · 문서 속 원문 인용은 짧게** — 근거는 씬 ID · 줄 번호로 대고, 따옴표 인용은 40자 미만(분석의 부속). 2026-10-09 공개 때 잰 최장 인용은 38자.
  `node tools/check-quotes.mjs`가 원문과 40자 이상 겹치는 커밋 대상 파일을 찾는다(테스트 `tests/quotes.test.mjs`도 같은 검사).
- **push 전 훅이 막는다** (`.claude/hooks/no-raw-public.mjs`): origin에 없는 커밋에 원문과 40자 이상 겹치는 파일 · `data/raw/` 안 파일 · `data/normalized/` · DB · 5MB 넘는 파일이 있으면 `git push`를 거절한다.
  나중 커밋으로 지워도 히스토리에 남아 공개되므로, push 전이면 그 커밋을 고쳐서 뺀다. GitHub MCP로 이 레포에 파일을 바로 쓰는 것도 막는다(검사를 건너뛰므로). 레포 안에 원문이 있는 것 자체는 괜찮다 — 공개만 막는다.
- `nikke-story-raw`의 public 전환, 원문을 다른 remote · 레포 밖에 게시하는 것(gist, 공개 페이지 등)은 모두 재배포다.

**공개 사이트(W, 2026-10-09)** 도 이 규칙 안에서 한다: 이 레포의 GitHub Pages로 `site/`(HTML · JS · 내보낸 JSON)를 올리고,
대사 본문(블라링크 · 금서고) · 이미지는 싣지 않는다. 근거 인용은 한 줄 80자 · 출처 표시. 내보내기(`tools/site/export.mjs`)는 본문 칼럼을 읽지 않는다.
규칙 전체는 docs/views.md "사이트 구성 (W0)" "공개 규칙".

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

## 난독화 규칙이 깨지면

사이트가 재배포되면 경로 규칙이 바뀌어 **전면 404**가 날 수 있다.
수집기가 그렇게 알려오면, 새 번들에서 `createNormalObfuscatedPath` / `getDjb2Mod` /
`generateTwoLetterHash` / `generateTwoNumberHash` / `LARGE_PRIMES`를 다시 뽑아
`tools/blabla/obfuscate.mjs`를 갱신한다. 절차는 docs/data-sources.md에 있다.

## 코드 규약

- Node 22+, ESM(`.mjs`), 외부 의존성 없이 표준 라이브러리만 사용한다.
- 주석과 사용자 대상 출력은 한국어로 쓴다.
