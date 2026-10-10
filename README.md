# nikke-story

승리의 여신: 니케(NIKKE)의 스토리를 **수집 → 정규화 → 읽기 · 기록 → 관계 분석 → 시각화**하는 팬 프로젝트.
결과는 공개 사이트 **<https://jgaram.github.io/nikke-story/>** 로 본다 — 감상 순서 · 연결 · 떡밥 · 인물 · 연대기 · 세계 여섯 탭.

- 스토리 원문은 blablalink.com(공식 커뮤니티)의 게임 데이터 CDN에서, 블라링크에 없는 스토리(사이드 · 서브퀘스트 · 유실물 ·
  일부 이벤트)는 팬 사이트 **금서고**에서 보조로, 출시 순서는 공식 공지(패치노트)에서 가져온다 — [docs/data-sources.md](docs/data-sources.md).
- 게임 내 카테고리 체계(메인 / 돌발 / 아카이브 / 호감도 스토리)를 **그대로** 보존한 뒤, 그 위에 분석 레이어
  (인물 · 사전 · 떡밥 · 인물 변화 · 작중 시점 · 스토리 간 연결 · 중요도)를 얹는다.
- 분석은 **원문과 게임 데이터로만** 한다. 해석이 필요한 기록은 Claude가 후보로 쓰고 근거(씬 ID · 줄 번호)와 함께 스스로 검토해
  확정 · 기각하며, 사용자는 그 기준과 결과를 보고 조율한다(CLAUDE.md "해석이 필요한 기록"). 외부 연관성 시트는 판정을 다 끝낸 뒤
  비교용으로만 쓴다([docs/reference-table.md](docs/reference-table.md)).
- 분석 범위는 메인 · 이벤트 · 사이드 · 서브퀘스트 · 유실물 · 호감도 스토리다. 돌발은 엘리베이터 첫 스토리만 넣는다
  (수집 · 정규화는 전부 해 둔다 — [TODO.md](TODO.md) 결정 #5).
- 코드 · 문서 · 분석 기록은 공개한다. 원문(블라링크 · 금서고 · 공지 원본)과 외부 참고 표는 **private 서브모듈**
  `data/raw/`(`Jgaram/nikke-story-raw`)에만 있고, 원문 대사는 재배포하지 않는다(CLAUDE.md "저작물 취급").
  원본 레포 권한이 없으면 코드 · 기록 · 사이트는 볼 수 있지만 DB 빌드 · 원문 읽기는 안 된다.

## 현재 상태

| 단계 | 상태 |
|---|---|
| 수집 · 정규화 | ✅ 블라링크 씬 2,134 + 호감도 965편 · 금서고 136단위 · 공지 → 출시 순서. [docs/schema.md](docs/schema.md) · [docs/coverage.md](docs/coverage.md) |
| 인물 · 사전 | ✅ 대상 386(인물 216 · 니케 159 · 랩쳐 11) · 이름표 859종 전부 분류 · 비인물 사전 234(조직 · 개념 · 장소 · 물건 · 사건) · 소속 기록 |
| 1회독 | ✅ 단위마다 사실 2,906 · 의문 372 · 사건 399 · 시점 394 — [docs/annotations.md](docs/annotations.md) |
| 2회독 | ✅ 암시 언급 688 · 떡밥 1,630 · 인물 변화 2,234 · 생활상 449, 떡밥 줄기 60 |
| 분석 (X) | ✅ 공개 자리 · 진실 공개 단계 · 작중 연대기 · 중요도 등급(척추 · 필수 …) · 스토리 간 연결 · 인물별 집계 · 결말 — [docs/importance.md](docs/importance.md) · [docs/views.md](docs/views.md) |
| 공개 개요 | ✅ 481단위의 한 줄 소개 · 줄거리 · 씬 한 줄 (`annotations/synopsis/`) |
| 사이트 (W) | ✅ 여섯 탭 · 스포일러 컷오프(여기까지 읽음) · 씬 리더 패널 · 인물 아이콘 · 소속 마크 · 팬 사이트답게 다듬기(W13) |
| 진행 중 | W14 팬용 문장(분류 이유 · 연대기 추정 이유) — [SESSIONS.md](SESSIONS.md) |

남은 일은 [SESSIONS.md](SESSIONS.md), 남은 로드맵 · 유효한 결정은 [TODO.md](TODO.md), 운용(지시 세션 · "다음 일" · 관리자)은 [docs/operations.md](docs/operations.md),
지난 세션 기록은 [docs/history/](docs/history/). 새 세션에서 "다음 일"이라고 하면 SESSIONS.md의 첫 미완료 항목을 하고, 다른 일을 시키면 그 일을 한다.

## 받기

```bash
git clone --recurse-submodules https://github.com/Jgaram/nikke-story   # 원본 레포 권한이 있을 때
node --test tests/*.test.mjs                                          # 검사 (원문이 없으면 일부가 "원문 없음"으로 실패한다)
```

Node 22+만 있으면 된다 — 외부 의존성 · 빌드 단계가 없다. `data/nikke.db`는 **자동으로 만들어진다**: 원격 세션은 SessionStart 훅이,
그 밖에는 질의 도구가 DB를 열기 전에 확인해서, 없거나 입력(`data/raw/` · `annotations/` · `tools/normalize/` · `data/release/`)이
바뀌었으면 원본에서 다시 만든다(네트워크 없이 수십 초). 손으로는 `node tools/normalize/ensure-db.mjs`(`--check` 상태만 · `--force` 강제).

## 도구

자세한 사용법 · 표기 · 데이터 함정은 [docs/tools.md](docs/tools.md). 각 도구 맨 위 주석에도 명령 목록이 있다.

**수집** — 요청 규칙(동시 요청 ≤4 등)은 [docs/data-sources.md](docs/data-sources.md) "0. 요청 규칙". 반드시 먼저 읽는다.
원문은 서브모듈에 커밋되어 있으니 클론한 뒤 다시 돌리지 않는다. 신작이 나왔을 때 증분만 받는다(SESSIONS.md N).

```bash
node tools/blabla/fetch-index.mjs         # 카테고리 · 인물 인덱스
node tools/blabla/fetch-scenes.mjs        # 씬 본문 (--source main · --limit 20)
node tools/blabla/fetch-episodes.mjs      # 호감도 스토리
node tools/forbidden-library/fetch.mjs    # 금서고 — 블라링크에 없는 스토리
node tools/notices/fetch.mjs              # 공식 공지 — 새 공지만
node tools/notices/release-order.mjs      # 공지 → 출시 순서 (data/release/)
node tools/blabla/marks.mjs               # 기업 · 스쿼드 마크 → site/img/orgs/
node tools/site/portraits.mjs             # 인물 아이콘 → site/img/people/
```

**질의 · 원문 읽기**

```bash
node tools/query.mjs stats                  # 전체 집계 (search · speaker · speakers · stats는 범위 안만, --all이면 돌발까지)
node tools/query.mjs search 니힐리스타       # 대사 전문 검색
node tools/query.mjs who 라피                # 인물 사전 — 대상 · 이름 · 이어진 이름표 · 정체 연결
node tools/query.mjs person 라피             # 인물별 집계 — 등장 · 함께 나온 인물 · 사실 · 의문 · 변화 · 결말
node tools/query.mjs releases event         # 공개 순서(출시순)
node tools/query.mjs known ch20             # 그 공개 자리까지 아는 사실 · 의문 (스포일러 컷오프)
node tools/query.mjs chrono event_redash    # 작중 연대기 — 작중 자리 · 출시순과 어긋남
node tools/query.mjs grades ch38            # 그 자리까지 나온 메인 밖 단위의 등급
node tools/query.mjs sql "SELECT ..."       # 임의 읽기 질의 (그 밖: story · links · terms · appear · targets · signals …)

node tools/read.mjs list main               # 목차 — 키 · 씬 수 · 글자 수 · 파트 수
node tools/read.mjs ch07 --num              # 챕터 전문, 줄마다 #N (기록 근거는 `씬#N`) — 파트당 2만 자, --part N
node tools/read.mjs char:10                 # 인물 단위 — 호감도 스토리 + 다른 곳에서 말한 씬
node tools/read.mjs side:mudfish            # 금서고 단위 — side: · sub: · relic: · erelic: · fl:
```

**기록 · 분석** — 형식 · 절차는 [docs/annotations.md](docs/annotations.md), 화면에 무엇이 어떻게 가는지는 [docs/views.md](docs/views.md).

```bash
node tools/records.mjs check                # 검증기 — 없는 씬 · 줄, 값 오타, 필수 칸, 기각된 것을 가리키는 참조
node tools/records.mjs review ch07          # 후보를 근거 줄 · 앞뒤 문맥과 함께
node tools/records.mjs set F3 확정 --by claude   # 확정 · 기각 · 보류 (누가 · 언제 남는다. 사용자가 뒤집은 것은 다시 안 바꾼다)
node tools/records.mjs progress [--read2]   # 단위별 진행률 (그 밖: new · next · find · handoff · layers …)
node tools/views/draft.mjs                  # 기록 → 분석 시안 data/views/ (연대기 · 중요도 · 연결 · 인물 · 결말 … 같이 뽑는다)
node tools/synopsis.mjs check --all         # 공개 개요 검사 (new · set · progress)
node tools/blurbs.mjs progress              # 팬용 문장(분류 이유 · 연대기 추정 이유) (new · check · set)
node tools/versions.mjs progress            # 시점별 판(떡밥 제목 · 요약을 읽은 자리마다) (new · check · set)
```

**사이트** — 빌드 도구 없는 정적 사이트(HTML + ES 모듈, CDN d3 하나). `site/`가 바뀌어 main에 올라가면 Actions가 Pages로 배포한다.
배치 · 규약은 [docs/views.md](docs/views.md) "파일 배치 · 모듈 규약 · 실행법".

```bash
node tools/site/export.mjs              # data/views/ · DB · 기록 → site/data/*.json (대사 본문 칼럼은 읽지 않는다)
node tools/site/serve.mjs --port 8765   # 로컬 확인 → http://localhost:8765/
node tools/check-quotes.mjs             # 공개될 파일에서 원문과 40자 이상 겹치는 곳 (push 전 훅도 같은 검사를 한다)
```

## 현재 규모

| | |
|---|---|
| 노드 | 4,309 — 블라링크 씬 · 호감도 · 금서고 136단위 1,124씬 (원문 없음 86) |
| 대사 | 374,563줄 (블라링크 287,882 · 금서고 86,681) |
| 분석 범위 | 노드 3,999 · 대사 345,040줄 (범위 밖: 돌발 300씬 · 시트 비교용 노드 10) |
| 관계 엣지 | 1,158 (게임 확정 777 · 추정 16 · 시트 참고 365 — 분석 입력 아님) |
| 인물 · 사전 | 대상 386 · 이름표 859종 · 비인물 사전 234 |
| 기록 | 1회독 사실 · 의문 · 사건 · 시점 4,071 · 2회독 5,001 · 떡밥 줄기 60 · 공개 개요 481단위 |

## 디렉터리

```
.claude/        훅 — 단일 브랜치(main) 강제 · 원문 검사(push 전) · 세션 시작 시 서브모듈 · DB 준비
.github/        Pages 배포 워크플로 (site/만 올린다)
docs/           문서 — 운용 · 도구 · 데이터 소스 · 기록 형식 · 화면 · 스키마 · 중요도, history/ = 지난 세션 기록
annotations/    우리가 쓴 기록 (공개)
                read1/ · read2/   1회독 · 2회독 기록 (단위마다 JSON) · 인계 파일
                synopsis/         공개 개요 · blurbs/ 팬용 문장 · versions/ 시점별 판
                dictionary/       인물 사전 · 이름표 분류 · 비인물 사전(조직 · 개념 · 장소 · 물건 · 사건)
                threads · spine · layers · links · leads · majors · closures · chronology · affiliations · portraits …
                scope.json (분석 범위) · aliases.json (시트 ↔ 데이터 표기 대조)
data/
                raw/         원문 서브모듈 (private Jgaram/nikke-story-raw) — CDN · 금서고 · 공지 원본, imported/ 외부 참고 표
                release/     출시 순서 (release-order.csv · report.md)
                views/       분석 시안 — 연대기 · 중요도 · 연결 · 인물 · 결말 … (커밋)
                normalized/  정규화 JSON (git 제외, raw에서 재생성)
                nikke.db     SQLite + FTS5 (git 제외)
tools/
                blabla/ · forbidden-library/ · notices/   수집기 (블라링크 CDN · 금서고 · 공지)
                normalize/   정규화 (원본 → JSON → SQLite)
                query.mjs · read.mjs                      질의 · 원문 읽기 CLI
                records.mjs + records/                    1회독 · 2회독 기록 도구
                views/       분석 시안 계산 (draft.mjs가 묶어 부른다)
                synopsis.mjs · blurbs.mjs · versions.mjs  공개 개요 · 팬용 문장 · 시점별 판 도구
                site/        사이트 내보내기 · 인물 아이콘 · 로컬 서버
                lib/         공유 모듈 — 줄 표기 · 단위 키 · 언급
site/           공개 사이트 (GitHub Pages) — index.html · app.js · tabs/ 탭별 모듈 · data/ 내보낸 JSON · img/
tests/          검사 — node --test tests/*.test.mjs
```

## 라이선스

이 레포의 코드 · 문서 · 분석 기록은 [CC0 1.0](LICENSE) — 허락 · 출처 표기 없이 마음대로 써도 된다.
단 니케의 대사 · 이미지(`site/img/` 등) · 캐릭터 · 명칭 · 설정은 SHIFT UP 저작물이라 포함하지 않는다.
비공식 팬 프로젝트이며 SHIFT UP과 관계없다.
