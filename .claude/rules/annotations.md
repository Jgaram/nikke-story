---
paths:
  - "annotations/**"
  - "tools/records.mjs"
  - "tools/records/**"
  - "tools/synopsis.mjs"
  - "tools/synopsis/**"
  - "tools/blurbs.mjs"
  - "tools/blurbs/**"
  - "tools/versions.mjs"
  - "tools/versions/**"
---

# 해석이 필요한 기록 (CLAUDE.md "해석이 필요한 기록"의 자세한 것)

암시 언급 · 떡밥 · 진실 공개 · 작중 시점 · 인물 변화 · 생활상 · 사실 · 의문 · 정체 연결 · 빌드업 마무리 · 공개 개요처럼 원문을 해석하는 기록은:

- Claude가 **후보**로 쓰고(근거 씬 ID · 줄 번호, 이유, 확신도) 단위마다 **스스로 검토해 확정 · 기각**한다(`records.mjs set … --by claude`).
  검토하지 않은 후보를 확정값처럼 쓰지 않는다. 형식은 docs/annotations.md.
- 사용자가 어떤 기록을 짚으면 그 뒤의 기준을 고쳐 Claude가 다시 판정한다 — 기록을 사용자 이름(`--by 사용자`)으로 바꾸지 않는다.
- 원문을 읽으면 알 수 있는 질문(이름표가 누구인지 등)은 묻지 않고 읽으며 정한다. 설정 오류로 보이면 기록 `slips`에 한 줄만 남기고 넘어간다.
- 기계적인 기록(이름표로 말함 · 이름 그대로 · 별칭)은 확정 절차 없이 쓴다.
- 판정에 외부 참고 표를 쓰지 않는다(CLAUDE.md "외부 참고 표"). 고친 뒤 다시 뽑기는 docs/operations.md "지시 세션" 4.
