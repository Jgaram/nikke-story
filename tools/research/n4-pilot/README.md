# N4 파일럿 — 다시 읽기 방법 연구의 입력 생성기 · 지시문 (2026-11-04)

docs/reread-method.md 9절의 파일럿을 다시 돌릴 때 쓴다(모델이 바뀌면 반드시). **실무 도구가 아니다** — 지금 기록을 입력으로 쓰는 연구 코드라 `tools/records/`와 섞지 않는다.

1. `node tools/normalize/ensure-db.mjs` → `node tools/research/n4-pilot/pilot-inputs.mjs <scratchpad 디렉터리>`
   - `A/<단위>/` — `text.md`(원문) · `questions-all.md`(그 자리까지의 열린 의문 전부) · `questions-matched.md`(낱말 겹침 + 줄기 경유) · 기준 사례 순위를 찍는다. 직전 줄거리 `before.md`는 1회독 요약으로 손으로 만든다(2026-11-04에는 ch08 · ch38+ch39 파트 1 · ch47).
   - `C/J<n>.md` — 줄기별 감사 입력, `C/index.json`. 기준 사례 줄기 J27 · J16 · J1 · J2 + 무작위 3.
   - `B/before-chNN.md` — ch08–13의 앞 단위 요약.
2. 에이전트에게 `inst-common.md` + 조건 지시문(`inst-A-P0.md` · `inst-A-P1.md` · `inst-B.md` · `inst-C.md`)과 입력 파일을 주고 출력은 scratchpad `out/`에 받는다. 에이전트는 `annotations/` · `docs/` · `data/`를 열지 않는다(기존 기록이 답을 담고 있다).
3. 채점: 기준 사례(Q10 → `sub:든_셀_00`, Q144 → ch39 파트 2, Q20 · Q63 → ch48 파트 1)를 잡았는지, 갈등 ID가 단위를 넘어 이어지는지, 되돌아보기(hindsight) 수. 결과는 docs/reread-method.md 9절에 덧붙인다.

지시문은 2026-11-04 파일럿 때 것 그대로다 — 다음 파일럿은 docs/reread-method.md 8절(고친 기준)에 맞춰 고쳐 쓴다.
