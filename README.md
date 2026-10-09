# nikke-story

승리의 여신: 니케(NIKKE)의 스토리를 **수집 → 정규화 → 관계 분석 → 시각화**하는 개인용 작업 공간.

- 스토리 원문은 blablalink.com(공식 커뮤니티)의 Shifty's Pad 게임 데이터 CDN에서 가져온다.
- 게임 내 카테고리 체계(메인 / 돌발 / 아카이브 / 호감도 스토리)를 **그대로** 보존한 뒤,
  그 위에 분석 레이어(인물, 키워드, 떡밥, 스토리 간 연결)를 얹는다.
- 분석은 원문과 게임 데이터에서 **독립적으로** 한다. 스토리 연관성 시트(`data/raw/imported/`)는
  참고자료로 연결만 해 두고 입력이나 정답으로 쓰지 않는다 ([docs/reference-table.md](docs/reference-table.md)).
- 분석 범위는 메인 · 이벤트 · 호감도 스토리다. 돌발은 당분간 빼고 엘리베이터 첫 스토리만 넣는다
  (수집 · 정규화는 전부 해 둔다 — [TODO.md](TODO.md) 결정 #5).
- 코드 · 문서 · 분석 기록은 공개한다. 원문(블라링크 · 금서고 · 공지 원본)과 외부 참고 표는 **private 서브모듈**
  `data/raw/`(`Jgaram/nikke-story-raw`)에만 있고, 원문 대사는 재배포하지 않는다(CLAUDE.md "저작물 취급").
  원본 레포 권한이 없으면 코드와 기록은 볼 수 있지만 DB 빌드 · 원문 읽기는 안 된다.
- 받기: `git clone --recurse-submodules https://github.com/Jgaram/nikke-story` (원본 레포 권한이 있을 때).

## 현재 상태

| 단계 | 상태 |
|---|---|
| 데이터 소스 조사 | ✅ 완료 — [docs/data-sources.md](docs/data-sources.md) |
| 수집기 | ✅ 완료 — 씬 2,134개 + 호감도 스토리 965편, 대사 28.8만 줄 · 원본 스냅샷 커밋 (2026-09-28) |
| 카테고리 커버리지 | ✅ 확인 — [docs/coverage.md](docs/coverage.md) |
| 정규화 | ✅ 완료 — 노드 3,210 / 대사 287,882줄 / 엣지 1,158 · [docs/schema.md](docs/schema.md) |
| 분석 범위 · 인물 사전 | ✅ A1 — 범위 표시(`stories.in_scope`) · 범위 안 이름표 859종 전부 분류 · 대상 ID 체계 ([docs/schema.md](docs/schema.md)) · 검사 `node --test` |
| 1회독 준비 | ✅ A3 — 기록 형식 · 검증기 · 리뷰 도구 · 인계 파일 ([docs/annotations.md](docs/annotations.md)) · `node tools/records.mjs` |
| 분석 · 시각화 | ⬜ 미착수 |

## 수집 실행

```bash
node tools/blabla/fetch-index.mjs                     # 카테고리·인물 인덱스
node tools/blabla/fetch-scenes.mjs                    # 씬 본문 2,177개
node tools/blabla/fetch-scenes.mjs --source main      # 메인만
node tools/blabla/fetch-episodes.mjs                  # 캐릭터별 호감도 스토리 965편
node tools/blabla/fetch-scenes.mjs --limit 20         # 맛보기
node tools/notices/fetch.mjs                          # 공식 공지(패치노트) — 새 공지만
node tools/notices/release-order.mjs                  # 공지 → 출시 순서 (data/release/)
```

결과는 `data/raw/`에 논리 경로 그대로 쌓이고, `data/raw/manifest.json`에
URL·수집 시각·바이트·sha256·누락 목록이 기록된다. 이미 받은 파일은 다시 받지 않는다.

`data/raw/`는 **private 서브모듈 `Jgaram/nikke-story-raw`에 커밋되어 있다**(파일 3,345개, 약 112MB). 클론한 뒤에는 수집을 다시 돌리지 않는다.
새 콘텐츠가 나왔을 때 증분 수집만 하고, 받은 변경분을 커밋한다.

**CDN 요청 규칙(동시 요청 ≤4 등)은 [CLAUDE.md](CLAUDE.md)에 있다. 반드시 지킬 것.**

## 정규화 · 질의

`data/nikke.db`는 **자동으로 만들어진다.** 원격 세션은 SessionStart 훅이, 그 밖에는 질의 도구가
DB를 열기 전에 확인해서, DB가 없거나 입력(`data/raw/` · `annotations/`(1회독 기록 `read1/` 빼고) · `tools/normalize/` · `data/release/`)이
바뀌었으면 원본에서 다시 만든다. 네트워크 없이 15초 남짓 걸린다.

```bash
node tools/normalize/ensure-db.mjs  # 필요할 때만 만든다 (--check 상태만 / --force 강제)
                                    #   = build.mjs(원본 → data/normalized/*.json) → build-db.mjs(→ data/nikke.db)

node tools/query.mjs stats                      # 전체 집계
node tools/query.mjs search 니힐리스타           # 대사 전문 검색
node tools/query.mjs story d_main_01_01_s       # 씬 하나의 대사 전문
node tools/query.mjs links ep:d_nikke_emma_03   # 그 노드의 선행·후속 (시트 엣지는 --sheet)
node tools/query.mjs speaker 라피                # 이름표(그 줄을 말한 인물)별 통계 — 갈래 · 대상까지
node tools/query.mjs who 라피                    # 인물 사전: 대상 · 이름 · 이어진 이름표 · 정체 연결 후보
node tools/query.mjs speakers 호칭               # 이름표 분류 목록 (갈래별)
node tools/query.mjs releases event --from 2024-01-01   # 공개 순서(출시 순) — 메인 · 사이드 · 이벤트 · 호감도
node tools/query.mjs appear 마리안                # 대상이 나온 단위 · 씬(출시순) · 처음 등장 (언급 DB)
node tools/query.mjs targets ch07                # 씬 · 단위에 나온 대상, ★ = 처음 등장
node tools/query.mjs signals 아니스 --flags       # 인물 변화 자동 신호 — 이름표 · 존댓말 · 호칭이 바뀐 단위
node tools/query.mjs sql "SELECT ..."           # 임의 읽기 질의
node --test                                     # 검사 — 분석 범위 · 범위 안 이름표 미분류 0 · 사전 무결성 (tests/)
```

`search` · `speaker` · `speakers` · `stats`는 분석 범위 안만 센다(`--all`이면 범위 밖 돌발도 넣는다).

원문은 블라링크 477만 자 + 금서고 148만 자라 한 번에 못 읽는다. 챕터·이벤트·돌발·인물 단위로 뽑아 읽는 도구가 따로 있다
(Claude가 조사할 때 쓰는 출력이다 — 사용법과 표기는 [CLAUDE.md](CLAUDE.md) "원문 읽기"):

```bash
node tools/read.mjs list main           # 목차 — 키 · 씬 수 · 글자 수 · 파트 수
node tools/read.mjs ch07                # CHAPTER.07 전문 (파트당 2만 자 이하, --part N)
node tools/read.mjs ch07 --num          # 줄마다 줄 번호 #N — 1회독 · 2회독은 이것으로 읽고 근거를 `씬#N`으로 적는다
node tools/read.mjs char:10             # 라피 — 다른 곳에서 말한 씬 목록 + 호감도 스토리 전문
node tools/read.mjs char:10 --lines     # 라피가 말한 대사만, 앞 문맥과 함께
node tools/read.mjs side:mudfish        # 금서고 단위 — side:(사이드) · sub:(서브퀘스트) · relic:(유실물) · erelic: · fl:(이벤트)
```

읽으며 남기는 1회독 기록(사실 · 의문 · 시점 후보 — 확정 · 기각은 사용자)은 `annotations/read1/`에 있고 도구가 따로 있다
(형식 · 절차는 [docs/annotations.md](docs/annotations.md)):

```bash
node tools/records.mjs new ch00          # 기록 파일 뼈대
node tools/records.mjs check            # 검증기 — 없는 씬 · 줄, 값 오타, 필수 칸, 기각된 것을 가리키는 참조
node tools/records.mjs review R01       # 후보를 근거 줄 · 앞뒤 문맥과 함께 (--brief · --example)
node tools/records.mjs set F3 F5 확정    # 채팅으로 받은 확정 · 기각 · 보류 반영 (누가 · 언제 남는다)
node tools/records.mjs progress         # 단위별 진행률
node tools/records.mjs handoff          # 인계 파일 (annotations/read1/HANDOFF.md)
```

공개 사이트(W — GitHub Pages, 빌드 도구 없는 정적 사이트. 배치 · 규약은 [docs/views.md](docs/views.md) "파일 배치 · 모듈 규약 · 실행법 (W1)"):

```bash
node tools/site/export.mjs              # data/views/ CSV · DB · 기록 → site/data/*.json (본문 칼럼은 읽지 않고, 40자 넘는 인용은 경고 · 80자는 자른다)
node tools/site/serve.mjs --port 8765   # 로컬 확인용 정적 서버 → http://localhost:8765/
```

블라링크에 없는 스토리(사이드 스토리 · 서브퀘스트 · 유실물 · 이벤트 유실물 · 최근 이벤트)는 팬 사이트 **금서고**에서
보조로 받는다(`tools/forbidden-library/fetch.mjs`, 규칙은 CLAUDE.md "금서고 요청 규칙"). 블라링크에 들어오면 블라링크로 돌아간다.

현재 규모:

| | |
|---|---|
| 노드 | 4,309 (원문 있음 4,223 / 없음 86) — 금서고 136단위 · 1,124씬 포함 |
| 대사 | 374,563줄 (블라링크 287,882 · 금서고 86,681) |
| 관계 엣지 | 1,158 (게임 확정 777 / 추정 16 / 시트 참고 365 — 분석 입력 아님) |
| 시트 참고 연결 | 360행 중 데이터 연결 350 · 시트에만 있는 이름 10(양쪽 다 없는 이벤트 · 콜라보) · 미해석 선행 0건 |
| 분석 범위 | 노드 3,999 · 대사 345,040줄 (범위 밖: 돌발 300씬 — 엘리베이터 첫 스토리만 넣는다 · 시트 참고 노드 10) |
| 인물 사전 | 대상 365 (니케 156 · 인물 200 · 랩쳐 9) · 범위 안 이름표 859종 전부 분류 · 정체 연결 후보 5 |

할 일 전체는 [TODO.md](TODO.md), 세션별 작업 순서는 [SESSIONS.md](SESSIONS.md) 참고.
새 세션에서 "다음 일"이라고 하면 SESSIONS.md의 첫 미완료 항목을 한다.

## 디렉터리

```
.claude/       훅 — 단일 브랜치(main) 강제(규칙은 CLAUDE.md "브랜치 규칙"), 세션 시작 시 DB 자동 생성
docs/          조사 기록, 스키마 정의
tools/normalize/ 정규화 (스키마 → JSON → SQLite)
tools/query.mjs  질의 CLI (검색 · 통계 · 관계)
tools/read.mjs   원문 읽기 CLI — 챕터·이벤트·돌발·인물 단위, 파트 분할, --num 줄 번호
tools/records.mjs 1회독 기록 도구 — 뼈대 · 검증기 · 리뷰 · 진행률 · 인계 파일 (records/에 형식 · 검증 · 리뷰 모듈)
tools/lib/       read.mjs · records.mjs 공유 — 줄 표기(render.mjs) · 단위 키(units.mjs)
tools/forbidden-library/  금서고 수집기 — 블라링크에 없는 스토리 (규칙은 CLAUDE.md "금서고 요청 규칙")
tools/blabla/  blablalink CDN 수집기
               obfuscate.mjs  경로 난독화 해석
               client.mjs     캐시·동시성·재시도·매니페스트
               fetch-index.mjs / fetch-scenes.mjs / fetch-episodes.mjs
tools/notices/ 공식 공지(패치노트) 수집기와 출시 순서 추출 (T3-7)
data/release/  출시 순서 — release-order.csv(날짜 · 순위 · 근거) · report.md(공백 보고)
data/
               raw/         원문 서브모듈 (private Jgaram/nikke-story-raw) — CDN · 금서고 · 공지 원본, imported/ 외부 참고 표
               normalized/  정규화 JSON (git 제외, raw에서 재생성)
               nikke.db     SQLite + FTS5 (git 제외, 117MB)
annotations/   사람이 직접 쓰는 주석 (떡밥, 스토리 간 연결)
               aliases.json  시트 ↔ 데이터 표기 대조표 (참고 연결용)
               scope.json    분석 범위 (결정 #5)
               dictionary/   인물 사전 · 이름표 분류 (A1) · 비인물 사전 (A2)
               read1/        1회독 기록(단위마다 JSON) · 인계 파일 HANDOFF.md (A3, docs/annotations.md)
tests/         검사 — node --test (fixtures/read1/ = 1회독 기록 예시)
web/           시각화 프런트엔드
```
