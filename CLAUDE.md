# CLAUDE.md

니케(NIKKE) 스토리 간 연관관계 분석 · 시각화 프로젝트. 코드 · 문서 · 기록은 이 **public** 레포에, 원문(블라링크 · 금서고 · 공지)과
외부 참고 표는 **private** 서브모듈 `data/raw/`(`Jgaram/nikke-story-raw`)에 둔다. 공개 사이트는 `site/`(GitHub Pages).

## 어디에 무엇이

- 남은 일: [SESSIONS.md](SESSIONS.md) · 운용(지시 세션 · "다음 일" · 관리자 · 동시 세션 · 컨텍스트 예산 · git): [docs/operations.md](docs/operations.md) · 피드백 기록: [docs/feedback.md](docs/feedback.md)
- 도구 사용법(`read.mjs` · `query.mjs` · 출시 순서 · 데이터 함정): [docs/tools.md](docs/tools.md) · 데이터 소스 · 요청 규칙: [docs/data-sources.md](docs/data-sources.md)
- 기록 형식: [docs/annotations.md](docs/annotations.md) · 화면 · 사이트: [docs/views.md](docs/views.md) · DB · 엣지 타입: [docs/schema.md](docs/schema.md) · 중요도 판정 카드: [docs/importance.md](docs/importance.md)
- 로드맵 · 결정(범위 · 읽기 방식 등): [TODO.md](TODO.md) · 지난 세션 기록: [docs/history/](docs/history/)
- 긴 문서는 통째로 읽지 않는다 — `grep -n`으로 절을 찾아 그 부분만.

## 일하는 법

- 사용자가 **"다음 일"**이라고 하면 SESSIONS.md의 첫 미완료 항목을 한다. 다른 일을 직접 시키면 그 일을 한다(docs/operations.md "지시 세션").
- **사용자에게는 범위와, 원문 · 데이터로 알 수 없는 것(게임 화면에서만 보이는 정보 등)만 묻는다.** 원문 해석 · 작업 방식 · 고르기 · 분류는
  Claude가 기준을 세워 정하고 근거를 남긴다. 사용자는 그 기준과 결과를 보고 조율한다.
- **실무는 100% Claude가 한다** — 사용자는 기준에 피드백을 줄 뿐, 개별 기록 · 판정 · 문장을 직접 정하지 않는다. 사람의 주관을 기록에
  직접 넣지 않는 것이 원칙이다(사용자, 2026-10-10). 피드백을 받으면 기준 문서를 고치고 그 기준으로 다시 판정한다.
- 계획을 바꾸면 SESSIONS.md를 고치고 알린다. 조용히 건너뛰지 않는다.
- **컨텍스트를 아낀다** — 사용자는 세션 컨텍스트가 많이 차는 걸 싫어한다. 큰 출력은 파일로 보내고 필요한 부분만 본다(docs/operations.md "컨텍스트 예산").
- 정한 규칙 · 결정은 주제 문서에 반영한다. 인계 메모 · 피드백 기록에는 "→ 어디 반영"만 적는다.

## 브랜치 규칙 (반드시 지킬 것)

- `main` 하나만 쓴다. 작업 단위가 끝나면 커밋하고 `git push origin main`(거절되면 `git pull --rebase origin main` 뒤 다시).
  세션에 배정된 `claude/*` 브랜치와 PR은 쓰지 않는다 — 사용자 규칙이라 배정 브랜치 지침보다 우선한다.
- `data/raw/`(서브모듈)가 바뀌면 원본 레포에 **먼저** push하고 그다음 포인터를 커밋한다. 따로 클론된 `/home/user/nikke-story-raw`에서는 작업하지 않는다.
- 훅이 강제한다. 자세한 것은 docs/operations.md "git · 브랜치".

## 원문 서브모듈 (반드시 지킬 것)

- SessionStart가 원본 레포를 못 받았다고 하면 **다른 일보다 먼저** `add_repo`로 `Jgaram/nikke-story-raw`를 붙이고 `node .claude/hooks/ensure-db.mjs`.
  사이트 · 문서만 고치는 일이어도 끝에 테스트를 돌리므로 붙인다.
- 테스트가 "원문 없음"으로 실패하면 붙이고 다시 돌린다. 원문 없이 난 실패를 "원래 있던 실패"로 넘기지 않는다.

## 저작물 취급 (반드시 지킬 것)

원문 대사는 저작물이다. 개인 분석용으로만 두고 재배포하지 않는다.

- 원문 · 외부 참고 표는 `data/raw/` 밖에 커밋하지 않는다. 뽑아 둘 일이 있으면 scratchpad나 git 제외 경로(`data/normalized/` 등)에.
- 기록 · 문서 속 인용은 짧게 — 근거는 씬 ID · 줄 번호, 따옴표 인용은 40자 미만(`node tools/check-quotes.mjs`).
  push 전 훅(`no-raw-public.mjs`)이 원문과 40자 이상 겹치는 파일 · `data/raw/` 안 파일 · DB · 5MB 넘는 파일을 막는다.
  히스토리에 남으면 공개되므로 push 전 그 커밋을 고쳐서 뺀다. GitHub MCP로 이 레포에 파일을 바로 쓰지 않는다(검사를 건너뛴다).
- 원본 레포의 public 전환, 원문을 다른 곳(gist · 공개 페이지 등)에 올리는 것은 재배포다.
- 공개 사이트에는 대사 본문 전문을 싣지 않는다. 게임 이미지는 실어도 된다(시프트업이 요청하면 내린다). 스토리별 줄거리는
  확정한 공개 개요(`annotations/synopsis/`)만 싣는다. 자세히 docs/views.md "공개 규칙".

## 외부 참고 표 (반드시 지킬 것)

분석(스토리 관계 · 중요도 · 선행 · 분류)은 **원문과 게임 데이터로만** 한다. **분석 · 판정 세션은 외부 참고 표를 열지 않는다** —
[docs/reference-table.md](docs/reference-table.md) · `data/raw/imported/` · DB의 `sheet_*` 칼럼 · `sheet_rows` · `--sheet` · `tools/views/sheet-compare.mjs`.
그 문서는 X3e(판정을 다 확정한 뒤의 비교) · 수집 · 정규화 · DB 도구를 고칠 때만 연다.

## 해석이 필요한 기록 (반드시 지킬 것)

암시 언급 · 떡밥 · 진실 공개 · 작중 시점 · 인물 변화 · 생활상 · 사실 · 의문 · 정체 연결 · 빌드업 마무리 · 공개 개요처럼 원문을 해석하는 기록은:

- Claude가 **후보**로 쓰고(근거 씬 ID · 줄 번호, 이유, 확신도) 단위마다 **스스로 검토해 확정 · 기각**한다(`records.mjs set … --by claude`).
  검토하지 않은 후보를 확정값처럼 쓰지 않는다. 형식은 docs/annotations.md.
- 사용자가 어떤 기록을 짚으면 그 뒤의 기준을 고쳐 Claude가 다시 판정한다 — 기록을 사용자 이름(`--by 사용자`)으로 바꾸지 않는다.
- 원문을 읽으면 알 수 있는 질문(이름표가 누구인지 등)은 묻지 않고 읽으며 정한다. 설정 오류로 보이면 기록 `slips`에 한 줄만 남기고 넘어간다.
- 기계적인 기록(이름표로 말함 · 이름 그대로 · 별칭)은 확정 절차 없이 쓴다.

## 수집 (반드시 지킬 것)

블라링크 CDN · 금서고 · 공지에 요청하는 도구를 돌리거나 고치기 전에 docs/data-sources.md "0. 요청 규칙"을 읽는다.

## 용어 · 코드 규약

- **이름표**: 대사창에 뜨는, 그 줄을 말한 인물 이름. **"화자"라는 말은 쓰지 않는다**(서술자로 읽힌다). 서술은 3인칭(`Narration`)이거나
  지휘관 1인칭 독백(`Monologue`)이고, 지휘관이 소리 내 하는 말은 `Self`다.
- Node 22+, ESM(`.mjs`), 외부 의존성 없이 표준 라이브러리만. 주석과 사용자 대상 출력은 한국어. 테스트는 `node --test tests/*.test.mjs`.
