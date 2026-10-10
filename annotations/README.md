# 주석 레이어

자동 추출로는 판정할 수 없는 것들 — 스토리의 중요도, 떡밥이 풀렸는지,
사람이 나눈 유형 구분 — 을 여기에 손으로 쓴다.
`data/`는 재수집하면 덮어써지지만 이 디렉터리는 그렇지 않다.

## imported/story-relations-sheet.csv — 참고자료

직접 정리해 온 스토리 연관성 시트의 스냅샷 (368행).
출처: Google Sheets, Last Update 2026-08-17.

**참고자료일 뿐이다.** 이 프로젝트의 분석은 원문과 게임 데이터에서 독립적으로 하고,
이 시트의 값을 입력이나 정답으로 쓰지 않는다. DB에는 결과와 비교해 보려고 연결만 해 둔다
(docs/reference-table.md). 시트와 데이터가 다르면 데이터를 따르고, 시트를 고칠 일은 없다.

| 칼럼 | 뜻 |
|---|---|
| 출시일 | 공개 순서의 기준 |
| 유형 | 메인 / 에피소드 / 이벤트 / 퀘스트 / 사이드 / 애장품 |
| 접근성 | 일반 / 한정 / 아카이브O / 아카이브X |
| 중요도 | ★ ~ ★★★, 콜라보, 만우절 |
| 추천 선행 스토리 | `◆◆◆`(필수) ~ `◆`(권장) 세기로 표시된 선행 조건 |

시트에는 게임 데이터에 없는 것이 세 가지 있다. 모두 **시트 작성자의 판단**이라 비교용으로만 본다:

1. **유형 구분** — 데이터상 이벤트·퀘스트·사이드는 모두 아카이브에 섞여 있다.
2. **중요도** — 게임 데이터에 중요도 개념이 없다. 우리 중요도는 원문 근거로 따로 매긴다(T3-6).
3. **선행 스토리** — 호감도 스토리는 게임이 `condition_scenario_group_id`로 들고 있다.
   메인·이벤트 범위의 선행 관계는 원문에서 우리가 새로 찾는다(T3-5).

또한 `접근성` 칼럼이 수집 가능 여부를 그대로 예측한다
(`아카이브O` = 수집 가능, `아카이브X` = 불가). 자세한 대조는 [../docs/coverage.md](../docs/coverage.md).

시트에서 빠진 카테고리는 **돌발**(전초기지 건물별 대화 301씬)과 **서브퀘스트**다.
돌발은 데이터가 이미 있고, 서브퀘스트는 소재 조사가 필요하다.

## release-overrides.json — 출시 순서 손 보정

공식 공지로 날짜를 얻을 수 없는 단위의 출시일(T3-7). `tools/notices/release-order.mjs`가 읽어
`data/release/release-order.csv`에 `basis=손 보정`으로 넣는다. 줄마다 근거(`source`)와 확신도를 단다.
시트는 근거로 쓰지 않는다. 공지로 날짜가 나오게 되면 그 줄은 지운다(`data/release/report.md` "손 보정"에 보인다).

## scope.json — 분석 범위

TODO.md 결정 #5를 적은 것. 여기 걸리는 노드(돌발 — `d_ex_elevator_01` 빼고, 시트 참고 노드)는 `stories.in_scope = 0`이 되고
통계 · 자동 기록 · 후보 · 이름표 분류 검사에서 빠진다. 읽기(`read.mjs`)는 그대로 된다. 자세한 것은 [../docs/schema.md](../docs/schema.md) "분석 범위".

## dictionary/ — 인물 사전 · 이름표 분류 (A1) · 비인물 사전 (A2)

| 파일 | 내용 |
|---|---|
| `dictionary/speakers.json` | 이름표 분류. 니케 목록 이름 그대로가 아닌 이름표를 전부 갈래(인물 · 랩쳐 · 호칭 · 비인물 · 미상 · 대상 · 여럿)에 넣는다. `codes`는 이름표 코드로 푸는 규칙(`???` + `unknown_grave` → 그레이브), `notes`는 판단 근거 |
| `dictionary/people.json` | 인물 대상 중 손으로 정한 것(동명이인 · 이름표 없는 주인공 · 메모)과 정체 연결 후보(`candidates` — 확정 · 기각은 Claude) |
| `dictionary/places.json` | 비인물 사전 — 지역 · 장소(탈것 포함) `place:` |
| `dictionary/orgs.json` | 비인물 사전 — 조직 · 세력(기업 · 정부 · 스쿼드 · 단체) `org:` |
| `dictionary/concepts.json` | 비인물 사전 — 개념 · 설정(존재 · 등급 · 랩쳐 종류 · 기술 …) `concept:` |
| `dictionary/incidents.json` | 비인물 사전 — 사건(전쟁 · 작전 · 테러) `incident:` |
| `dictionary/items.json` | 비인물 사전 — 물건(장치 · 무기 · 문서) `item:` |

니케는 니케 목록에서 자동으로 만들어지므로 적지 않는다. 대상 ID · 갈래 뜻 · 푸는 순서는 [../docs/schema.md](../docs/schema.md)
"대상 ID" · "이름표 분류". 새 이름표가 생기면 빌드가 `⚠ 범위 안 미분류 이름표`를 띄우고 `node --test`가 실패한다 — speakers.json에 적는다.
비인물 사전은 항목마다 표준명 · 별칭 · 약칭 · 표기와 검색 규칙(`except`) · 오탐 주의(`caution`)를 적고, 빌드가 범위 안 건수를 센다
(`node tools/query.mjs terms`). 표기는 반드시 실측으로 넣는다 — 범위 안 0건인 이름은 빌드가 ⚠를 띄우고 `node --test`가 실패한다.
형식 · 검색 규칙 · 넣는 기준은 [../docs/schema.md](../docs/schema.md) "비인물 사전".

## read1/ — 1회독 기록 (A3)

읽기 세션(R)이 읽기 단위마다 JSON 하나(`<키>.json`, `:`는 `.`)로 남기는 기록 — 단위 요약(작업 메모) · 밝혀진 사실(`F`) · 던져진 의문(`Q`) ·
회수 · 뒤집음(`F12-2`) · 작중 시점(`S`) · 새 대상(사전 ID) · 되짚기 메모(`V`). 해석이 필요한 기록은 **후보**로 쓰고 Claude가 단위마다 확정 · 기각한다(사용자는 기준에 피드백) —
상태는 리뷰 도구(`node tools/records.mjs set`)만 바꾼다. `HANDOFF.md` · `handoff/`는 다음 읽기 세션이 원문 대신 읽는 인계 파일로,
`node tools/records.mjs handoff`가 만든다(손으로 고치지 않는다). 이 디렉터리는 DB 빌드 입력이 아니다.
형식 · 규칙 · 절차는 [../docs/annotations.md](../docs/annotations.md). 예시는 `tests/fixtures/read1/`(실제 기록과 섞지 않는다).
정체 연결 후보는 `dictionary/people.json`의 `candidates`에 `L<n>` ID로 있고 같은 리뷰 도구로 확정 · 기각한다.

## 떡밥 줄기 · 층 판정 · 2회독 (B0b · B1)

```
threads.json      떡밥 줄기(J) · 줄기 관계(G) — 같은 수수께끼를 다루는 의문 · 사실의 묶음 (B0b-1)
layers.json       층 판정(K) — 메인 밖 단위의 등급(필수 · 보강 · 참고 · 독립) · 근거 한 건 · 메인 자리(from · before), 2회독 층은 계산 (B0b-2 · X3f)
leads.json        주역 명단(Z) — 메인 주역 · 주역이 되는 챕터 · 범위 · 원점 (X3f). 초안 tools/views/leads.mjs → data/views/leads/
read2/            2회독 기록 <키>.json(암시 언급 I · 떡밥 E · 인물 변화 D · 생활상 U, B1a) · 2회독 인계 HANDOFF.md · handoff/ (B1b)
watch.json        2회독 볼 거리(W) — 1회독이 '2회독 몫'으로 넘긴 것, 작업 메모 (B1b)
links.json        수동 엣지(Y) — 기록에서 안 나오는 관계 · 자동 엣지 지우기 (T4-3 · T4-4). X2: 이벤트 · 사이드 연작 다음 편 57(확정 28 · 기각 29)
```

모두 DB 빌드 입력이 아니다 — 기록 도구(`node tools/records.mjs`)가 바로 읽는다. 해석이 필요한 것(J · G · K · Z · I · E · D · U · Y)은 후보로 쓰고 Claude가 확정한다(사용자는 기준에 피드백).
2회독 인계 파일(`read2/HANDOFF.md` · `handoff/`)은 `node tools/records.mjs handoff`가 만든다(손으로 고치지 않는다). 형식 · 규칙은 [../docs/annotations.md](../docs/annotations.md).

떡밥 · 진실 공개 레지스트리(T4-2)는 따로 두지 않고 1회독의 사실 · 의문 · 회수(`read1/`)에서 시작한다. 기계가 읽는 표는 JSON이다(T4-1).
