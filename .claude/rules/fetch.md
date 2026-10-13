---
paths:
  - "tools/blabla/**"
  - "tools/forbidden-library/**"
  - "tools/notices/**"
  - "tools/site/portraits.mjs"
---

# 외부에 요청하는 도구 (CLAUDE.md "수집"의 자세한 것)

이 도구들은 블라링크 CDN · 금서고(개인 운영 사이트) · 공식 공지에 요청한다. 돌리거나 고치기 전에 docs/data-sources.md "0. 요청 규칙"을 읽는다. 요점:

- 블라링크 동시 요청 최대 4(`tools/blabla/client.mjs` `MAX_CONCURRENCY` — 올리지 않는다). 금서고는 한 번에 하나, 요청 사이 1초.
- 로컬 캐시(`data/raw/`) 우선 — 다시 받으려면 `--force`를 명시. 재시도는 지수 백오프 3회, 404는 재시도하지 않고 누락으로 기록.
- 전량 수집은 끝났다 — 이후는 인덱스 diff 증분만. 일회성 확인은 새 스크립트 대신 캐시를 읽는다.
- 받은 원문은 `data/raw/`(서브모듈)에 — 원본 레포에 먼저 push(CLAUDE.md "브랜치 규칙").
