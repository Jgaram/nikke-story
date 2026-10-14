# 관계선 — 스토리 사이 엣지 (X2)

다시 뽑기: `node tools/views/links.mjs`(`draft.mjs`가 같이 부른다). 기록: `annotations/read1/` · `annotations/read2/` · `annotations/links.json`, 자동: DB edges · 언급 DB.
규칙은 tools/views/links.mjs 머리말, 타입은 docs/schema.md "엣지 타입", 화면은 docs/views.md 화면 2. 조회 `node tools/query.mjs links <씬|단위>`.

## 요약

| 타입 | game-condition | auto | record | manual | 씬 엣지 | 단위 쌍 | 후보 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `prereq` 선행 조건 | 756 | 16 | 0 | 0 | 772 | 0 | 0 |
| `sequel` 다음 편 | 0 | 100 | 0 | 28 | 128 | 128 | 0 |
| `setup_payoff` 떡밥 → 회수 | 0 | 0 | 1280 | 0 | 1280 | 523 | 0 |
| `callback` 다시 드러냄 · 재언급 | 0 | 0 | 838 | 0 | 838 | 557 | 0 |
| `reversal` 뒤집힘 | 0 | 0 | 8 | 0 | 8 | 7 | 0 |
| `character` 같은 인물 | 21 | 1651 | 0 | 0 | 1672 | 1098 | 0 |
| `keyword` 같은 대상 | 0 | 1612 | 0 | 0 | 1612 | 1105 | 0 |

- 씬 엣지 6310 · 단위 쌍(타입별) 3418 · 같은 단위 안 1283(단위 그래프에서 뺌 — 호감도 스토리 조건은 모두 한 인물 안) · 읽기 단위 밖 끝점 21(애장품 `fav:` 등) · 만우절 단위와 다른 단위 사이라 뺀 엣지 1(결정 #11).
- 확정 전 후보로 만든 엣지 0 — 기록 · 수동 엣지가 모두 확정이다.
- 세기: 3 = 2278 · 2 = 3087 · 1 = 945 — 3 게임 조건 · 다음 편 · 확실한 기록, 2 추정 기록 · 대상 공유, 1 흔한 대상 공유.

## 고립 — 이어진 단위가 없는 단위

| 엣지 | 고립 | 종류별 |
|---|---:|---|
| 기록만(1회독 + 2회독) | 156/482 | 서브퀘스트 34 · 유실물 19 · 이벤트 9 · 호감도 94 |
| + 다음 편(sequel) | 131/482 | 서브퀘스트 12 · 유실물 18 · 이벤트 7 · 호감도 94 |
| + 대상 공유(character · keyword) = 전부 | 5/482 | 유실물 3 · 이벤트 1 · 호감도 1 |
| 세기 2 이상만 | 21/482 | 서브퀘스트 6 · 유실물 10 · 이벤트 1 · 호감도 4 |

전부를 넣어도 고립: `relic:채팅로그_얼리어답터` · `relic:광고팜플렛` · `relic:지휘관모집공고` · `char:811` · `event_foolburstday`.

세기 2 이상으로 고립(흔한 대상만 나눔): `relic:어느남자의수기` · `relic:생존가이드1` · `relic:통화기록017515` · `sub:고스트_00` · `sub:코리_00` · `relic:채팅로그_얼리어답터` · `relic:광고팜플렛` · `relic:지휘관모집공고` · `sub:김작가_00` · `relic:어느소녀의수기` · `sub:스페이드_00` · `sub:테디_00` · `char:432` · `relic:니케제작보고서요약본` · `sub:알콜러버_00` · `relic:필그림조우보고서` · `char:15` · `char:811` · `char:16` · `event_foolburstday` · `relic:거인을찾아서`.

## 대상 공유 — 중심 · 사슬

- 중심(단위 × 대상) 3781 — 기록 1339 · 이름 736 · 기록+이름 710 · 기록+말함 671 · 말함 325. 대상 545(인물 327 · 비인물 218), 두 단위 이상 383.
- 흔한 대상(중심인 단위 48 넘음 — 읽기 단위의 10%, 세기 1 · note '흔한 대상') 8: 니케 186 · 방주 171 · 랩쳐 140 · 지상 129 · 아니스 119 · 라피 85 · 중앙_정부 67 · 네온 56.
- 그 밖 두 단위 이상에서 중심인 대상 375(세기 2) — 사슬 엣지 2291. 한 단위에서만 중심인 대상 162은 엣지가 없다.

## 개념 · 떡밥 지도 (화면 4)

- 줄기 ↔ 대상(비인물) 332 — 줄기 53 · 대상 129, 줄기 자신의 about 49. `thread-targets.csv`.
- 대상 ↔ 대상(같은 기록의 about에 2번 이상) 494쌍 — 많이 함께 나온 쌍: 중앙_정부 · 방주 29 / 갓데스 · 방주 25 / 중앙_정부 · 아우터_림 24 / 이그조틱 · 아우터_림 20 / 니케 · 방주 19 / 방주 · 에덴 19 / 엔터_헤븐 · 아우터_림 18 / 방주 · 아우터_림 17. `target-pairs.csv`.

## 메인과 이어진 기록 (화면 1 판정 입력 ①)

- 메인 밖 433 가운데 메인과 기록 엣지로 이어진 단위 127 — 서브퀘스트 20 · 유실물 39 · 사이드 5 · 이벤트 34 · 호감도 29. `units.csv` `main_in` · `main_out` · `main_units`(X3 판정 입력).

## 종류 → 종류 (단위 쌍)

- 기록: 메인 → 메인 279 · 메인 → 이벤트 140 · 이벤트 → 이벤트 120 · 호감도 → 이벤트 88 · 이벤트 → 메인 79 · 메인 → 유실물 45 · 이벤트 → 호감도 38 · 메인 → 사이드 25 · 메인 → 호감도 24 · 서브퀘스트 → 서브퀘스트 24
- 다음 편: 메인 → 메인 48 · 서브퀘스트 → 서브퀘스트 42 · 이벤트 → 이벤트 23 · 이벤트 → 유실물 9 · 사이드 → 이벤트 4 · 유실물 → 유실물 1 · 사이드 → 사이드 1
- 대상 공유 2+: 이벤트 → 이벤트 204 · 메인 → 메인 202 · 이벤트 → 호감도 164 · 호감도 → 이벤트 161 · 메인 → 이벤트 138 · 호감도 → 호감도 115 · 이벤트 → 메인 101 · 호감도 → 메인 86 · 메인 → 호감도 58 · 서브퀘스트 → 서브퀘스트 58

## 이어진 단위가 많은 메인 밖 단위

| 자리 | 단위 | 종류 | 세기 2+ 이웃 | 기록 이웃 | 대상 공유 이웃 | 중심 대상 |
|---:|---|---|---:|---:|---:|---|
| 350 | `event_footstepwalkrun1` | 이벤트 | 45 | 25 | 30 | incident:1차_지상_탈환전 org:스컬_헤드 person:리오 person:웬디 item:초거대_코어 person:D.E.E.P. |
| 338 | `event_oldtales1` | 이벤트 | 40 | 24 | 28 | concept:콜링_시그널 item:유리_구두 concept:페어리_테일 incident:아크_가디언_작전 org:인류연합군 person:미러 |
| 418 | `event_goddessfall1` | 이벤트 | 40 | 28 | 23 | item:네이키드_킹 item:에덴의_창 concept:릴리스의_바디 concept:스톰_브링어 concept:퀸_인자 org:인헤르트 |
| 428 | `fl:ark_guardian` | 이벤트 | 40 | 25 | 26 | concept:머신_메사이어 concept:스톰_브링어 person:프리시아 place:리페어_센터 place:승리의_날개_호 incident:아크_가디언_작전 |
| 200 | `event_overzone` | 이벤트 | 37 | 25 | 21 | person:피나 incident:아크_가디언_작전 person:오스왈드 concept:사고_전환 concept:에블라_입자 person:릴리바이스 |
| 377 | `event_unbreakablesphere1` | 이벤트 | 32 | 16 | 27 | item:AA_필러 org:인큐베이터 concept:은색_액체 concept:콜링_시그널 person:글러트니 person:모리 |
| 400 | `event_absolute1` | 이벤트 | 30 | 9 | 26 | concept:프레데터 person:미친개 person:솔져_E.G. person:솔져_F.A. org:스카우팅 concept:블랙스미스 |
| 300 | `event_goldencoinrush1` | 이벤트 | 29 | 6 | 29 | org:프리마돈나 person:볼륨 person:폴크방 org:777 org:달란트 org:메이드_포_유 |
| 411 | `side:eden_spear` | 사이드 | 28 | 20 | 19 | item:아틀라스_케이지 item:에덴의_창 concept:릴리스의_바디 org:인헤르트 org:파이오니아 person:나유타 |
| 454 | `event_staranis1` | 이벤트 | 28 | 18 | 14 | person:ELYSION_Line._0 person:MISSILIS_Line._0 person:리스 person:요요 place:아크리온_홀 concept:스마일_박스 |
| 467 | `fl:project_matis` | 이벤트 | 28 | 12 | 19 | concept:하베스터 person:라라 person:엔메 item:이터널_라이프 person:샛별 incident:2차_지상_탈환전 |
| 251 | `event_redash` | 이벤트 | 27 | 22 | 21 | concept:적합자 concept:콜드_슬립 concept:울트라 person:프리시아 item:유리_구두 concept:페어리_테일 |

## 수동 엣지 (annotations/links.json)

- 실린 것 28 — sequel 2: 21 · sequel 3: 7 · 지운 자동 엣지 0 · 못 맞춘 drop 0.
  - Y3 `event_maidinvalentine` → `event_romanticvalentine` (세기 2)
  - Y5 `event_fullfoolday` → `event_liarsend` (세기 2)
  - Y6 `event_ltk` → `event_killthelord` (세기 2)
  - Y10 `event_bluewaterisland` → `event_seayouagain1` (세기 3)
  - Y13 `event_schooloflock` → `event_colorless` (세기 3)
  - Y18 `event_redash` → `event_oldtales1` (세기 2)
  - Y21 `event_dirtybackyard` → `event_killthelord` (세기 2)
  - Y23 `event_boomsday` → `event_darkhero` (세기 2)
  - Y24 `event_killthelord` → `event_lordforjustice` (세기 2)
  - Y25 `side:second_affection` → `event_lastkingdom1` (세기 2)
  - Y26 `event_onemoretime` → `event_claymore` (세기 2)
  - Y27 `event_lastkingdom1` → `event_goddessfall1` (세기 2)
  - Y28 `event_darkhero` → `event_icedragonsaga1` (세기 2)
  - Y33 `event_colorless` → `fl:wave_to_you` (세기 2)
  - Y34 `event_phantomthiefvsdetective` → `fl:go_ninja_thief` (세기 2)
  - Y35 `side:wordless` → `side:mudfish` (세기 2)
  - Y40 `event_newflavor` → `event_trueflavor` (세기 3)
  - Y41 `side:mudfish` → `event_unbreakablesphere1` (세기 2)
  - Y45 `event_lordforjustice` → `fl:reborn_evil` (세기 2)
  - Y48 `fl:coins_in_rush` → `fl:fatal_maid` (세기 2)
  - Y50 `side:eden_spear` → `event_goddessfall1` (세기 3)
  - Y51 `event_goddessfall1` → `fl:ark_guardian` (세기 3)
  - Y52 `fl:blank_ticket` → `fl:terminus_ticket` (세기 3)
  - Y53 `fl:fatal_maid` → `fl:persona_on_frontline` (세기 2)
  - Y54 `fl:2x2_love_1ch` → `fl:2x2_love_2ch` (세기 3)
  - Y55 `side:pretty_star` → `event_staranis1` (세기 2)
  - Y56 `event_staranis1` → `fl:b-side_idol` (세기 2)
  - Y57 `fl:b-side_idol` → `fl:bitter_spice` (세기 2)
