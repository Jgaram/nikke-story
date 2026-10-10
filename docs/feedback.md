# 피드백 기록

지시 세션(docs/operations.md)에서 사용자가 준 피드백과 처리 결과. **끝에 덧붙이기만 한다**(여러 세션이 같이 써도 충돌이 적다).
규칙 · 결정이 바뀌면 그 주제 문서(docs/*.md · CLAUDE.md)를 먼저 고치고 여기에는 "→ 어디 반영"만 적는다 — 이 파일은 지금 맞는 규칙을 찾는 곳이 아니다.
한 세션을 넘는 일이 나오면 SESSIONS.md "할 일"에 항목으로 넣고 여기에 그 항목 이름을 적는다.

형식 — 한 건에 2–4줄:

```
## 2026-10-11 인물 탭 — 변화 줄이 작중 순서와 어긋남
- 요청: (사용자 말을 짧게)
- 원인 · 고친 것: … (커밋 abc1234)
- 반영: docs/views.md "5. 인물별 집계" · 남은 일: SESSIONS.md W12
```

---

## 2026-10-10 운용 문서 정리
- 요청: 시각화 피드백 · 다시 읽기가 반복되는 단계라 순서대로 돌리던 문서 방식을 바꾸고, SESSIONS.md · CLAUDE.md를 얇게.
- 고친 것: SESSIONS.md(45만 자) → 남은 일만(7천 자), 끝난 항목은 docs/history/로 그대로 옮김(읽기 순서 원본은 history/reading.md — `tools/records/order.mjs`가 이것과 SESSIONS.md를 이어 읽는다).
  docs/operations.md를 지시 세션 · "다음 일" · 관리자(순차 · 병렬) 셋으로 다시 씀, 동시 세션 규칙 더함. CLAUDE.md는 규칙 요약과 가리키는 줄만 남기고 도구 사용법은 docs/tools.md,
  요청 규칙은 docs/data-sources.md "요청 규칙", git 자세한 것은 docs/operations.md로. TODO.md · docs/open-questions.md도 남은 것만 두고 옛 판은 docs/history/.
- 반영: CLAUDE.md · SESSIONS.md · docs/operations.md · docs/tools.md · docs/data-sources.md · TODO.md · docs/open-questions.md

## 2026-10-10 여기까지 읽음 팝업 · 감상 순서는 전부
- 요청: 상단 "여기까지 읽음"(슬라이더 · 첫 방문 드롭다운 바)을 상단을 누르면 언제든 뜨는 팝업으로. 감상 순서 탭은 읽은 곳과 관계없이 전부 — 안 본 사람의 순서 안내가 되게.
- 정한 것(사용자 선택): 팝업 = 메인 챕터 단추 격자 + 세밀 슬라이더 + 전부 보기(첫 방문이면 저절로 뜸 · "나중에"). 감상 순서는 목록 · 지도 전부(최종 등급) + "여기까지 읽음" 구분 줄, 분류 카드만 스포일러를 접어 가림.
- 반영: docs/views.md "상단 바 · 범위 · 여기까지 읽음 팝업" · 컷오프 규칙 · 감상 순서 표 줄, site/app.js · site/tabs/order.js
