# CLAUDE.md

니케(NIKKE) 스토리 간 연관관계 분석 · 시각화. 코드 · 문서 · 기록은 이 **public** 레포에, 원문 · 외부 참고 표는 **private** 서브모듈
`data/raw/`(`Jgaram/nikke-story-raw`)에 둔다. 공개 사이트는 `site/`(GitHub Pages).

## 어디에 무엇이

- 남은 일 [SESSIONS.md](SESSIONS.md) · 운용 · 기록 남기는 법 [docs/operations.md](docs/operations.md) · 결정 [docs/decisions.md](docs/decisions.md) · 지난 일 · 피드백 [docs/history/](docs/history/)(월별)
- 도구 docs/tools.md · 데이터 소스 docs/data-sources.md · 기록 형식 docs/annotations.md · 화면 docs/views.md · DB docs/schema.md · 중요도 docs/importance.md
- 경로별 규칙 `.claude/rules/` — 그 파일을 Read · Edit하면 붙는다. Bash로만 다룰 때는 직접 연다.
- 긴 문서는 통째로 읽지 않는다 — `grep -n`으로 절을 찾아 그 부분만. 큰 출력은 파일로(사용자는 컨텍스트가 차는 걸 싫어한다).

## 일하는 법

- **"다음 일"** = SESSIONS.md 첫 미완료 항목. 다른 일을 직접 시키면 그 일(docs/operations.md "지시 세션").
- **사용자에게는 범위와, 원문 · 데이터로 알 수 없는 것만 묻는다.** 해석 · 방식 · 고르기 · 분류는 Claude가 기준을 세워 정하고 근거를 남긴다.
- **실무는 100% Claude** — 사용자는 기준에 피드백만 준다. 사람의 주관을 기록에 직접 넣지 않는다(2026-10-10). 피드백은 기준 문서를 고쳐 다시 판정.
- 계획을 바꾸면 SESSIONS.md를 고치고 알린다. 정한 규칙은 주제 문서에, 기록에는 "→ 어디 반영"만. 끝난 항목은 지우고 월별 기록으로(테스트가 막는다).

## 브랜치 규칙

`main` 하나 — 커밋하면 `git push origin main`(거절되면 `pull --rebase` 뒤 다시). 배정된 `claude/*` 브랜치 · PR은 안 쓴다(사용자 규칙이라 배정 지침보다 우선).
`data/raw/`가 바뀌면 원본 레포에 먼저 push하고 포인터를 커밋한다. `/home/user/nikke-story-raw` 클론에서는 작업하지 않는다. 훅이 강제 — docs/operations.md "git · 브랜치".

## 원문 서브모듈

SessionStart가 원본을 못 받았다고 하면 **다른 일보다 먼저** `add_repo`로 붙이고 `node .claude/hooks/ensure-db.mjs`(문서만 고쳐도 — 끝에 테스트를 돌린다).
테스트의 "원문 없음" 실패를 원래 있던 실패로 넘기지 않는다.

## 저작물 취급

원문 대사는 저작물 — 개인 분석용, 재배포 금지(원본 레포 public 전환 · gist · 공개 페이지도). `data/raw/` 밖에 커밋하지 않는다(뽑아 둘 것은 scratchpad · `data/normalized/`).
인용은 씬 ID · 줄 번호, 따옴표는 40자 미만(`node tools/check-quotes.mjs`). push 전 훅이 막고, 히스토리에 남으면 공개라 push 전에 그 커밋을 고친다.
GitHub MCP로 이 레포에 파일을 쓰지 않는다(검사를 건너뛴다). 공개 사이트 규칙은 `.claude/rules/site.md`.

## 외부 참고 표

분석 · 판정은 **원문과 게임 데이터로만**. 분석 · 판정 세션은 docs/reference-table.md · `data/raw/imported/` · DB `sheet_*` · `sheet_rows` · `--sheet` ·
`tools/views/sheet-compare.mjs`를 **열지 않는다** — 판정을 다 확정한 뒤의 비교(X3e) · 수집 · 정규화 · DB 도구를 고칠 때만.

## 해석이 필요한 기록

떡밥 · 진실 공개 · 작중 시점 · 인물 변화 · 정체 연결 · 공개 개요처럼 원문을 해석하는 기록은 **후보로 쓰고 Claude가 스스로 확정 · 기각**한다.
쓰기 전에 `.claude/rules/annotations.md`를 본다.

## 수집

블라링크 CDN · 금서고 · 공지에 요청하는 도구를 돌리거나 고치기 전에 docs/data-sources.md "0. 요청 규칙"을 읽는다.

## 용어 · 코드 규약

- **이름표** = 대사창에 뜨는, 그 줄을 말한 인물. **"화자"라는 말은 쓰지 않는다**. 서술은 `Narration`(3인칭) · `Monologue`(지휘관 독백), 지휘관이 소리 내 하는 말은 `Self`.
- Node 22+, ESM(`.mjs`), 표준 라이브러리만. 주석 · 사용자 대상 출력은 한국어. 테스트 `node --test tests/*.test.mjs`.
