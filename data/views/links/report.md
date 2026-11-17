# 관계선 — 스토리 사이 엣지 (X2)

다시 뽑기: `node tools/views/links.mjs`(`draft.mjs`가 같이 부른다). 기록: `annotations/read1/` · `annotations/read2/` · `annotations/links.json`, 자동: DB edges · 언급 DB.
규칙은 tools/views/links.mjs 머리말, 타입은 docs/schema.md "엣지 타입", 화면은 docs/views.md 화면 2. 조회 `node tools/query.mjs links <씬|단위>`.

## 요약

| 타입 | game-condition | auto | record | manual | 씬 엣지 | 단위 쌍 | 후보 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `prereq` 선행 조건 | 772 | 16 | 0 | 0 | 788 | 0 | 0 |
| `sequel` 다음 편 | 0 | 102 | 0 | 30 | 132 | 132 | 0 |
| `setup_payoff` 떡밥 → 회수 | 0 | 0 | 1372 | 0 | 1372 | 566 | 0 |
| `callback` 다시 드러냄 · 재언급 | 0 | 0 | 956 | 0 | 956 | 616 | 0 |
| `reversal` 뒤집힘 | 0 | 0 | 9 | 0 | 9 | 7 | 0 |
| `character` 같은 인물 | 21 | 1754 | 0 | 0 | 1775 | 1148 | 0 |
| `keyword` 같은 대상 | 0 | 1712 | 0 | 0 | 1712 | 1152 | 0 |

- 씬 엣지 6744 · 단위 쌍(타입별) 3621 · 같은 단위 안 1331(단위 그래프에서 뺌 — 호감도 스토리 조건은 모두 한 인물 안) · 읽기 단위 밖 끝점 21(애장품 `fav:` 등) · 만우절 단위와 다른 단위 사이라 뺀 엣지 1(결정 #11).
- 확정 전 후보로 만든 엣지 0 — 기록 · 수동 엣지가 모두 확정이다.
- 세기: 3 = 2438 · 2 = 3336 · 1 = 970 — 3 게임 조건 · 다음 편 · 확실한 기록, 2 추정 기록 · 대상 공유, 1 흔한 대상 공유.

## 고립 — 이어진 단위가 없는 단위

| 엣지 | 고립 | 종류별 |
|---|---:|---|
| 기록만(1회독 + 2회독) | 157/496 | 서브퀘스트 34 · 유실물 20 · 이벤트 8 · 호감도 95 |
| + 다음 편(sequel) | 132/496 | 서브퀘스트 12 · 유실물 19 · 이벤트 6 · 호감도 95 |
| + 대상 공유(character · keyword) = 전부 | 5/496 | 유실물 3 · 이벤트 1 · 호감도 1 |
| 세기 2 이상만 | 21/496 | 서브퀘스트 6 · 유실물 10 · 이벤트 1 · 호감도 4 |

전부를 넣어도 고립: `relic:채팅로그_얼리어답터` · `relic:광고팜플렛` · `relic:지휘관모집공고` · `char:811` · `event_foolburstday`.

세기 2 이상으로 고립(흔한 대상만 나눔): `relic:어느남자의수기` · `relic:생존가이드1` · `relic:통화기록017515` · `sub:고스트_00` · `sub:코리_00` · `relic:채팅로그_얼리어답터` · `relic:광고팜플렛` · `relic:지휘관모집공고` · `sub:김작가_00` · `relic:어느소녀의수기` · `sub:스페이드_00` · `sub:테디_00` · `char:432` · `relic:니케제작보고서요약본` · `sub:알콜러버_00` · `relic:필그림조우보고서` · `char:15` · `char:811` · `char:16` · `event_foolburstday` · `relic:거인을찾아서`.

## 대상 공유 — 중심 · 사슬

- 중심(단위 × 대상) 3998 — 기록 1434 · 이름 786 · 기록+이름 758 · 기록+말함 693 · 말함 327. 대상 562(인물 336 · 비인물 226), 두 단위 이상 391.
- 흔한 대상(중심인 단위 49 넘음 — 읽기 단위의 10%, 세기 1 · note '흔한 대상') 8: 니케 190 · 방주 176 · 랩쳐 145 · 지상 134 · 아니스 121 · 라피 87 · 중앙_정부 68 · 네온 57.
- 그 밖 두 단위 이상에서 중심인 대상 383(세기 2) — 사슬 엣지 2466. 한 단위에서만 중심인 대상 171은 엣지가 없다.

## 개념 · 떡밥 지도 (화면 4)

- 줄기 ↔ 대상(비인물) 366 — 줄기 56 · 대상 137, 줄기 자신의 about 52. `thread-targets.csv`.
- 대상 ↔ 대상(같은 기록의 about에 2번 이상) 514쌍 — 많이 함께 나온 쌍: 중앙_정부 · 방주 29 / 갓데스 · 방주 26 / 중앙_정부 · 아우터_림 24 / 이그조틱 · 아우터_림 20 / 니케 · 방주 19 / 방주 · 에덴 19 / 엔터_헤븐 · 아우터_림 18 / 방주 · 아우터_림 17. `target-pairs.csv`.

## 메인과 이어진 기록 (화면 1 판정 입력 ①)

- 메인 밖 445 가운데 메인과 기록 엣지로 이어진 단위 137 — 서브퀘스트 21 · 유실물 42 · 사이드 6 · 이벤트 36 · 호감도 32. `units.csv` `main_in` · `main_out` · `main_units`(X3 판정 입력).

## 종류 → 종류 (단위 쌍)

- 기록: 메인 → 메인 298 · 메인 → 이벤트 159 · 이벤트 → 이벤트 128 · 호감도 → 이벤트 94 · 이벤트 → 메인 90 · 메인 → 유실물 51 · 이벤트 → 호감도 40 · 메인 → 호감도 29 · 메인 → 사이드 26 · 유실물 → 메인 26
- 다음 편: 메인 → 메인 50 · 서브퀘스트 → 서브퀘스트 42 · 이벤트 → 이벤트 23 · 이벤트 → 유실물 9 · 사이드 → 이벤트 4 · 이벤트 → 사이드 2 · 유실물 → 유실물 1 · 사이드 → 사이드 1
- 대상 공유 2+: 메인 → 메인 220 · 이벤트 → 이벤트 209 · 호감도 → 이벤트 167 · 이벤트 → 호감도 167 · 메인 → 이벤트 140 · 호감도 → 호감도 117 · 이벤트 → 메인 113 · 호감도 → 메인 92 · 메인 → 호감도 63 · 서브퀘스트 → 서브퀘스트 58

## 이어진 단위가 많은 메인 밖 단위

| 자리 | 단위 | 종류 | 세기 2+ 이웃 | 기록 이웃 | 대상 공유 이웃 | 중심 대상 |
|---:|---|---|---:|---:|---:|---|
| 350 | `event_footstepwalkrun1` | 이벤트 | 46 | 26 | 30 | incident:1차_지상_탈환전 org:스컬_헤드 person:리오 person:웬디 item:초거대_코어 person:D.E.E.P. |
| 418 | `event_goddessfall1` | 이벤트 | 45 | 33 | 25 | item:네이키드_킹 concept:릴리스의_바디 concept:스톰_브링어 item:에덴의_창 person:T.A.L.O.S. person:릴리스 |
| 428 | `event_arkguardian1` | 이벤트 | 43 | 27 | 28 | concept:머신_메사이어 concept:스톰_브링어 person:프리시아 place:리페어_센터 incident:아크_가디언_작전 person:오스왈드 |
| 338 | `event_oldtales1` | 이벤트 | 42 | 26 | 28 | concept:콜링_시그널 concept:페어리_테일 incident:아크_가디언_작전 item:유리_구두 org:인류연합군 person:오스왈드 |
| 200 | `event_overzone` | 이벤트 | 37 | 25 | 21 | person:피나 incident:아크_가디언_작전 person:오스왈드 concept:사고_전환 concept:에블라_입자 concept:퍼펙트 |
| 491 | `fl:maria-n` | 이벤트 | 36 | 31 | 11 | person:1호 person:2호 person:3호 person:5호 person:에바 person:에블라 |
| 377 | `event_unbreakablesphere1` | 이벤트 | 33 | 17 | 27 | item:AA_필러 org:인큐베이터 concept:은색_액체 concept:콜링_시그널 person:모리 concept:E2_크리스탈 |
| 400 | `event_absolute1` | 이벤트 | 32 | 9 | 28 | concept:프레데터 person:미친개 person:솔져_E.G. person:솔져_F.A. org:스카우팅 person:델타 |
| 295 | `event_lastkingdom1` | 이벤트 | 30 | 17 | 21 | concept:하이퍼_푸드 item:네이키드_킹 person:T.A.L.O.S. person:킬로 place:크라운_왕국 person:모더니아 |
| 300 | `event_goldencoinrush1` | 이벤트 | 29 | 6 | 29 | org:프리마돈나 person:볼륨 person:폴크방 org:777 org:달란트 org:메이드_포_유 |
| 411 | `side:eden_spear` | 사이드 | 29 | 21 | 19 | item:아틀라스_케이지 concept:릴리스의_바디 item:에덴의_창 org:인헤르트 org:파이오니아 person:나유타 |
| 454 | `event_staranis1` | 이벤트 | 29 | 18 | 15 | person:ELYSION_Line._0 person:MISSILIS_Line._0 person:리스 person:요요 place:아크리온_홀 concept:스마일_박스 |

## 수동 엣지 (annotations/links.json)

- 실린 것 30 — sequel 2: 22 · sequel 3: 8 · 지운 자동 엣지 0 · 못 맞춘 drop 0.
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
  - Y34 `event_phantomthiefvsdetective` → `event_goninjathief` (세기 2)
  - Y35 `side:wordless` → `side:mudfish` (세기 2)
  - Y59 `event_oldtales1` → `side:gingerbread_house` (세기 2)
  - Y40 `event_newflavor` → `event_trueflavor` (세기 3)
  - Y41 `side:mudfish` → `event_unbreakablesphere1` (세기 2)
  - Y45 `event_lordforjustice` → `fl:reborn_evil` (세기 2)
  - Y48 `fl:coins_in_rush` → `fl:fatal_maid` (세기 2)
  - Y50 `side:eden_spear` → `event_goddessfall1` (세기 3)
  - Y51 `event_goddessfall1` → `event_arkguardian1` (세기 3)
  - Y52 `fl:blank_ticket` → `fl:terminus_ticket` (세기 3)
  - Y53 `fl:fatal_maid` → `fl:persona_on_frontline` (세기 2)
  - Y54 `fl:2x2_love_1ch` → `fl:2x2_love_2ch` (세기 3)
  - Y55 `side:pretty_star` → `event_staranis1` (세기 2)
  - Y56 `event_staranis1` → `fl:b-side_idol` (세기 2)
  - Y57 `fl:b-side_idol` → `fl:bitter_spice` (세기 2)
  - Y58 `fl:wave_to_you` → `side:gingerbread_house` (세기 3)
