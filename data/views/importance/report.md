# 중요도 판정 — 시안 표 (X3)

출처: annotations/read1/ + annotations/layers.json(판정 K) + annotations/spine.json(척추 B) — 규칙 tools/views/importance.mjs · tools/views/layers.mjs 머리말, 기준 docs/importance.md(판정 카드), 형식 docs/annotations.md "중요도 판정".
단위 하나의 판정 · 시안 · 판정 입력: `node tools/records.mjs layers <단위 키> [--summary]`. 공개 자리 하나: `node tools/query.mjs grades <ch20>`. 등급을 뒤집기: `node tools/records.mjs set K… 확정 --by 사용자 --grade … --note "…"`.

- 척추 11(이벤트 8 · 사이드 3 — 채점하지 않는다, 아래 "척추") · 판정 단위 421 — 필수 5 · 보강 47 · 참고 239 · 독립 130 (확신도 추정 201 · 상태 확정 421)
- 기준 시점: 2026-09-24 421
- 기준 바꿈(X3f) 뒤 다시 본 판정 421 · 등급이 바뀐 판정 264 · 메인 자리(from)가 있는 판정 52(자리에 따라 바뀌는 단위 18) · 주역 원점인 단위 2(원점이 정해진 주역 20/20) · **다시 볼 단위 0**

## 척추 — 메인 챕터와 함께 채점하지 않는 기준 (X3f-1b · 1c)

선정 기준 · 계산: data/views/importance/spine.md(`node tools/views/spine.mjs`). 판정 K는 척추에 들기 전 것 — 척추에서 빼면 판정으로 돌아온다. 뒤집기: `set B… 기각 --by 사용자`.

| 자리 | 단위 | 종류 | 문 | 척추 | 판정 K(척추 전) | 층 |
|---:|---|---|---|---|---|---:|
| 203 | `event_overzone` OVER ZONE | 이벤트 | 하프(0.5주년) | B1 | K180 필수 → 척추 | 1 |
| 248 | `event_redash` RED ASH | 이벤트 | 1주년 | B2 | K221 필수 → 척추 | 1 |
| 295 | `event_lastkingdom1` LAST KINGDOM | 이벤트 | 1.5주년 | B3 | K264 필수 → 척추 | 1 |
| 338 | `event_oldtales1` OLD TALES | 이벤트 | 2주년 | B4 | K303 필수 → 척추 | 1 |
| 350 | `event_footstepwalkrun1` FOOTSTEP, WALK, RUN | 이벤트 | 연말 · 신년 | B10 | K315 필수 → 척추 | 1 |
| 370 | `side:mudfish` MUDFISH | 사이드 | 사이드 | B15 | K333 필수 → 척추 | 1 |
| 411 | `side:eden_spear` EDEN SPEAR | 사이드 | 사이드 | B16 | K370 필수 → 척추 | 1 |
| 418 | `event_goddessfall1` GODDESS FALL | 이벤트 | 3주년 | B6 | K375 필수 → 척추 | 1 |
| 428 | `fl:ark_guardian` ARK GUARDIAN | 이벤트 | 신년 | B12 | K385 필수 → 척추 | 1 |
| 447 | `side:pretty_star` PRETTY STAR | 사이드 | 사이드 | B17 | K402 보강 → 척추 | 1 |
| 454 | `event_staranis1` STAR ANIS | 이벤트 | 3.5주년 | B7 | K407 보강 → 척추 | 1 |

## 종류 × 등급

| 종류 | 필수 | 보강 | 참고 | 독립 | 다시 볼 단위 |
|---|---:|---:|---:|---:|---:|
| 서브퀘스트 |  | 6 | 66 | 14 |  |
| 유실물 |  | 5 | 39 | 11 |  |
| 그 밖 |  | 1 |  |  |  |
| 사이드 | 1 | 1 |  |  |  |
| 이벤트 | 1 | 17 | 44 | 13 |  |
| 이벤트 유실물 | 2 | 2 | 5 |  |  |
| 호감도 | 1 | 15 | 85 | 92 |  |
| 합 | 5 | 47 | 239 | 130 | 0 |

## 판정과 시안

- 시안(2회독 포함)과 같은 등급 215 · 판정이 시안보다 높음 11 · 낮음 195 — 시안은 출발점일 뿐이다(규칙 tools/views/layers.mjs 머리말 — 참고 시안은 "메인이 말하지 않은 기록인지"를 보지 못한다).
- 판정 → 시안: 참고 → 시안 참고 149 · 독립 → 시안 참고 94 · 참고 → 시안 보강 68 · 독립 → 시안 독립 32 · 보강 → 시안 보강 30 · 참고 → 시안 필수 17 · 보강 → 시안 필수 12 · 보강 → 시안 참고 5 · 참고 → 시안 독립 5 · 필수 → 시안 필수 4 · 독립 → 시안 보강 3 · 필수 → 시안 참고 1 · 독립 → 시안 필수 1
- 판정 입력(X3f): 줄기에 안 묶인 세계 사실이 있는 단위 322 · 메인 인물 사실 240 · 주역 사연 56 · 생활상 132 · 메인이 딛는 연결 69
- 빌드업 마무리(X3f-1d — 판정 입력 ⑦, 척추가 쌓음): 긴 회수 · 복선의 답이 있는 단위 20 · 마무리 기록(O)이 끝나는 단위 23(확정 23) — data/views/closures/report.md

## 자리에 따라 바뀌는 단위 (X3f ⑤)

| 자리 | 단위 | 판정 | 등급 (그 앞 → 메인 자리) | 공개 자리 → from 자리 |
|---:|---|---|---|---|
| 23 | `sub:랩칠리언_00` 랩칠리언 · 랩칠리언 1 | K16 | 참고 → ch27 보강 | 7 → 65 |
| 28 | `sub:랩칠리언_05` 랩칠리언 · 랩칠리언 6 | K21 | 참고 → ch27 보강 | 7 → 65 |
| 29 | `sub:랩칠리언_06` 랩칠리언 · 랩칠리언 7 | K22 | 참고 → ch27 보강 | 7 → 65 |
| 39 | `sub:세르반_01` 세르반 · 세르반 2 | K32 | 참고 → ch44 보강 | 7 → 138 |
| 49 | `d_ex_elevator_01` 엘리베이터 · 엘리베이터 괴담 | K41 | 참고 → ch30 보강 | 8 → 73 |
| 77 | `sub:세르반_03` 세르반 · 세르반 4 | K63 | 참고 → ch44 보강 | 14 → 138 |
| 100 | `char:101` 드레이크 | K83 | 참고 → ch18 보강 | 17 → 20 |
| 102 | `char:221` 라푼젤 | K85 | 참고 → event_overzone 보강 | 17 → 36 |
| 167 | `relic:데일리아크기사스크랩` 데일리아크 기사 스크랩 | K147 | 참고 → ch20 보강 | 25 → 26 |
| 185 | `event_cherryblossom` CHERRY BLOSSOM | K164 | 참고 → ch21 보강 | 32 → 35 |
| 204 | `erelic:white_memory` WHITE MEMORY | K181 | 보강 → fl:ark_guardian 필수 | 36 → 133 |
| 252 | `char:224` 스노우 화이트 : 이노센트 데이즈 | K225 | 보강 → fl:ark_guardian 필수 | 55 → 133 |
| 262 | `event_dirtybackyard` DIRTY BACKYARD | K235 | 참고 → ch30 보강 | 62 → 73 |
| 288 | `side:second_affection` SECOND AFFECTION | K259 | 보강 → ch48 필수 | 71 → 154 |
| 294 | `relic:하모니큐브관찰일지` 하모니 큐브 관찰 일지 | K263 | 참고 → ch31 보강 | 73 → 80 |
| 381 | `char:590` 모리 | K342 | 참고 → ch42 보강 | 109 → 128 |
| 383 | `event_arcanearchive` ARCANE ARCHIVE | K344 | 참고 → ch44 보강 | 111 → 138 |
| 462 | `fl:ark_ranger` ARK RANGER | K415 | 참고 → ch48 보강 | 148 → 154 |

## 메인 챕터 자리마다 등급

그 챕터까지 읽은 사람에게 그때까지 나온 판정 단위(척추 밖)의 등급(공개 자리 158개 가운데 메인 챕터 자리 — 같은 날은 다 읽은 것으로). "그 앞 등급"은 from 자리 앞이라 아직 낮은 단위 수.

| 챕터 | 자리 | 필수 | 보강 | 참고 | 독립 | 그 앞 등급 |
|---|---:|---:|---:|---:|---:|---:|
| ch00 | 1 |  |  |  |  |  |
| ch01 | 2 |  |  |  |  |  |
| ch02 | 3 |  |  | 2 |  |  |
| ch03 | 4 |  |  | 3 |  |  |
| ch04 | 5 |  |  | 3 |  |  |
| ch05 | 6 |  |  | 4 |  |  |
| ch06 | 7 |  |  | 30 | 4 | 4 |
| ch07 | 8 |  |  | 36 | 5 | 5 |
| ch08 | 9 |  |  | 40 | 5 | 5 |
| ch09 | 10 |  |  | 45 | 6 | 5 |
| ch10 | 11 |  |  | 47 | 9 | 5 |
| ch11 | 12 |  |  | 50 | 10 | 5 |
| ch12 | 13 |  |  | 51 | 11 | 5 |
| ch13 | 14 |  |  | 54 | 11 | 6 |
| ch14 | 15 |  |  | 56 | 13 | 6 |
| ch15 | 16 |  |  | 57 | 13 | 6 |
| ch16 | 17 |  | 5 | 95 | 28 | 8 |
| ch17 | 19 |  | 5 | 100 | 28 | 8 |
| ch18 | 20 |  | 6 | 103 | 30 | 7 |
| ch19 | 25 |  | 6 | 108 | 33 | 8 |
| ch20 | 26 |  | 7 | 114 | 33 | 7 |
| ch21 | 35 |  | 9 | 127 | 38 | 7 |
| ch22 | 36 |  | 11 | 133 | 38 | 7 |
| ch23 | 43 |  | 11 | 141 | 43 | 7 |
| ch24 | 44 |  | 11 | 143 | 45 | 7 |
| ch25 | 54 |  | 11 | 154 | 51 | 7 |
| ch26 | 55 |  | 14 | 158 | 51 | 8 |
| ch27 | 65 |  | 19 | 167 | 56 | 6 |
| ch28 | 66 |  | 20 | 172 | 58 | 6 |
| ch29 | 72 |  | 21 | 175 | 64 | 7 |
| ch30 | 73 |  | 23 | 176 | 64 | 6 |
| ch31 | 80 |  | 26 | 180 | 68 | 5 |
| ch32 | 81 |  | 27 | 185 | 70 | 5 |
| ch33 | 90 |  | 28 | 194 | 76 | 5 |
| ch34 | 91 |  | 30 | 197 | 77 | 5 |
| ch35 | 101 | 1 | 32 | 203 | 82 | 5 |
| ch36 | 102 | 1 | 32 | 204 | 84 | 5 |
| ch37 | 108 | 1 | 32 | 209 | 88 | 5 |
| ch38 | 109 | 1 | 34 | 213 | 88 | 6 |
| ch39 | 118 | 1 | 38 | 218 | 94 | 7 |
| ch40 | 119 | 1 | 40 | 218 | 95 | 7 |
| ch41 | 127 | 1 | 40 | 223 | 102 | 7 |
| ch42 | 128 | 2 | 41 | 224 | 103 | 6 |
| ch43 | 137 | 4 | 39 | 230 | 109 | 4 |
| ch44 | 138 | 4 | 42 | 229 | 111 | 1 |
| ch45 | 143 | 4 | 43 | 234 | 114 | 1 |
| ch46 | 144 | 4 | 43 | 236 | 115 | 1 |
| ch47 | 153 | 4 | 46 | 238 | 124 | 2 |
| ch48 | 154 | 5 | 46 | 239 | 126 |  |

## 다시 볼 묶음 — 기준 바꿈(X3f) 뒤 아직 다시 보지 않은 판정

없다 — 모두 다시 봤다.

| 묶음 | 단위 | 뜻 |
|---|---:|---|

## 감정 기준 후보 (X3g — 판정 입력 ⑧)

결정적 순간 후보가 있는 판정 단위 79(상한 필수 21 · 보강 58) · 후보 — 오름 52(필수로 16 · 보강으로 36) · 이른 자리 4 · 다시 봄 56 · **남음 0** — 후보 표 data/views/importance/emotion.md(공개 자리 순), 기준 docs/importance.md 3절 "결정적 순간".

## 이력 — 등급이 바뀐 판정

- `sub:칠리페퍼_00` K1: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:테트라_커넥트_00` K2: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:세르반_00` K3: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:중앙_정부_공식__00` K4: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:어느남자의수기` K5: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `sub:콜렉터_00` K6: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:콜렉터_01` K7: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:생존가이드1` K8: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `relic:통화기록017515` K9: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `sub:트레저_헌터_01` K12: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:트레저_헌터_03` K14: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:이례의_기록자_00` K15: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:랩칠리언_00` K16: B0b-2 독립 · X3c 그대로 → X3f-6a 보강
- `sub:랩칠리언_01` K17: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:랩칠리언_02` K18: B0b-2 독립 · X3c 그대로 → X3f-7 참고
- `sub:랩칠리언_03` K19: B0b-2 독립 · X3c 그대로 → X3f-7 참고
- `sub:랩칠리언_04` K20: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:랩칠리언_05` K21: B0b-2 독립 · X3c 그대로 → X3f-6a 보강
- `sub:할아범_00` K23: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:갓데스스쿼드리포트` K24: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `sub:고스트_00` K25: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:시리얼_01` K27: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:산해진미_00` K28: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:산해진미_01` K29: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:니케실험대상자모집` K30: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `relic:통화기록028594` K31: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:세르반_01` K32: B0b-2 독립 → X3c 보강 · X3f-4a 그대로
- `sub:저스틴_00` K33: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:니케실험반대피켓` K34: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:중앙_정부_공식__01` K35: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:세르반_02` K36: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:스페이드_00` K37: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:러블리_드림_00` K38: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:채팅로그_얼리어답터` K40: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `d_ex_elevator_01` K41: B0b-2 독립 · X3c 그대로 → X3f-4a 보강
- `sub:칠리페퍼_01` K42: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:든_셀_00` K43: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `relic:광고팜플렛` K44: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `relic:UFO챈.zip` K45: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `sub:테디_00` K46: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:미실리스_연구팀_00` K47: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:미실리스_연구팀_01` K48: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:미실리스_연구팀_03` K50: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:지휘관모집공고` K51: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `sub:롬_00` K53: B0b-2 독립 · X3c 그대로 → X3f-7 참고
- `sub:롬_01` K54: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:음악_애호가_00` K57: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:기업-랩쳐음모론` K59: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `relic:구시대의플레이리스트` K60: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `sub:숲속요정_00` K61: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `sub:세르반_03` K63: B0b-2 독립 · X3c 그대로 → X3f-6a 보강
- `sub:철도로GO_00` K64: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:여자친구의편지` K65: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `sub:칠리페퍼_02` K66: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:기후변화보고서` K68: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `relic:종말의서` K70: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:방주_난민_00` K71: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:방주_난민_01` K72: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:장보기목록` K75: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `char:11` K77: B0b-2 독립 → X3c 보강 → X3f-4a 참고
- `char:232` K79: B0b-2 보강 · X3c 그대로 → X3f-4a 참고 · X3g-3a 그대로
- `char:20` K81: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:202` K82: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:101` K83: B0b-2 독립 → X3c 보강 · X3f-4a 그대로
- `char:72` K84: B0b-2 보강 · X3c 그대로 → X3f-5a 참고 · X3g-3a 그대로
- `char:10` K86: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:190` K87: B0b-2 독립 · X3c 그대로 → X3f-4a 보강
- `char:82` K89: B0b-2 독립 · X3c 그대로 → X3f-6f 참고 · X3g-3a 그대로
- `char:130` K91: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:181` K92: B0b-2 독립 · X3c 그대로 → X3f-6f 보강
- `char:32` K93: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:161` K95: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:141` K96: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:91` K97: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:70` K100: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:140` K103: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:220` K104: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:12` K106: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:172` K108: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:191` K109: B0b-2 독립 · X3c 그대로 → X3f-4a 보강
- `char:201` K110: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:291` K111: B0b-2 독립 → X3c 보강 → X3f-5a 참고
- `char:241` K112: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:210` K113: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:90` K114: B0b-2 독립 · X3c 그대로 → X3f-4a 참고
- `char:150` K116: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:171` K117: B0b-2 독립 · X3c 그대로 → X3f-6f 참고
- `char:92` K118: B0b-2 독립 · X3c 그대로 → X3f-6f 참고 · X3g-3a 그대로
- `char:231` K119: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:110` K120: B0b-2 보강 · X3c 그대로 → X3f-5a 참고 · X3g-3a 그대로
- `char:30` K122: B0b-2 독립 · X3c 그대로 → X3f-6g 참고 · X3g-3a 그대로
- `char:170` K124: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:142` K125: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:230` K126: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:222` K127: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `char:120` K128: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `event_nocallerid` K129: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:352` K130: B0b-2 독립 → X3c 보강 → X3f-4a 참고
- `sub:제니퍼f_00` K131: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:모바일_보이스피싱_광고_모음.zip` K132: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `relic:니케제작보고서요약본` K133: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:테트라_커넥트_01` K134: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `sub:중앙_정부_공식__02` K135: B0b-2 독립 · X3c 그대로 → X3f-7 참고
- `relic:XX중학교가정통신문` K137: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `event_hightechtoy` K138: B0b-2 독립 → X3b 보강 → X3f-5a 참고
- `event_miraclesnow1` K140: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `event_brandnewyear` K144: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:260` K145: B0b-2 보강 · X3c 그대로 → X3f-5a 참고 · X3g-3a 그대로
- `sub:데이파라_00` K146: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:로망티스트_00` K148: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:jonathan_report` K149: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `event_doutsiders` K150: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `char:400` K151: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:401` K152: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:111` K153: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:402` K154: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:112` K155: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `event_maidinvalentine` K156: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:311` K157: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:800` K159: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:802` K161: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `event_bowwowparadise` K162: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:381` K163: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `char:282` K166: B0b-2 독립 · X3c 그대로 → X3f-6g 참고 · X3g-3a 그대로
- `event_ltk` K168: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:40` K169: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `sub:에덴_Notice_01` K171: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:에덴_Notice_02` K172: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `relic:특이랩쳐보고서-후` K174: B0b-2 보강 · X3c 그대로 → X3f-5a 참고
- `sub:문구점_00` K175: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:중앙정부_트라이앵글_00` K176: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:2호_쉘터_관리계정_00` K177: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `sub:할아범_01` K178: B0b-2 보강 · X3c 그대로 → X3f-4a 참고
- `relic:에닉탄핵포스터` K179: B0b-2 독립 → X3c 보강 → X3f-5b 참고
- `erelic:white_memory` K181: B0b-2 보강 · X3c 그대로 → X3f-4b 참고 → X3g-3a 필수
- `char:233` K182: B0b-2 보강 · X3c 그대로 → X3f-5b 참고 · X3g-3a 그대로
- `char:392` K183: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `event_queensorder` K187: B0b-2 독립 · X3c 그대로 → X3f-6d 참고 · X3g-3a 그대로
- `char:280` K188: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `event_bluewaterisland` K189: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `event_nyanyaparadise` K192: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:380` K193: B0b-2 독립 · X3c 그대로 → X3f-6g 참고
- `sub:상인연합_달란트_00` K194: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:콜렉터_02` K195: B0b-2 독립 · X3c 그대로 → X3f-6a 참고
- `relic:필그림조우보고서` K196: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `sub:해결사_카페_스위티_00` K197: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:긴급뉴스대본_FB_3_final_2.pdf` K198: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `event_seayouagain1` K201: B0b-2 독립 · X3c 그대로 → X3f-6d 참고 · X3g-3a 그대로
- `char:351` K203: B0b-2 독립 · X3c 그대로 → X3f-6h 참고
- `char:810` K206: B0b-2 독립 · X3c 그대로 → X3f-6h 참고
- `char:811` K208: B0b-2 독립 · X3c 그대로 → X3f-7 참고
- `event_schooloflock` K209: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `event_dazzlingcupid` K211: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:450` K212: B0b-2 독립 · X3c 그대로 → X3f-6h 참고
- `char:451` K213: B0b-2 독립 · X3c 그대로 → X3f-6h 참고
- `event_freezeacpu` K214: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `sub:중앙정부_프로토콜_00` K216: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:마더웨일아종목격보고.wav` K217: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `sub:로망티스트_01` K218: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:코인_러시_00` K219: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `relic:저주받은보석` K220: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `erelic:red_ash_lost` K222: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `char:224` K225: B0b-2 보강 · X3c 그대로 → X3f-5b 참고 → X3g-3a 필수
- `event_alonesurvivor` K226: B0b-2 독립 · X3c 그대로 → X3f-6d 참고 · X3g-3a 그대로
- `char:192` K227: B0b-2 독립 · X3c 그대로 → X3f-6h 참고 · X3g-3a 그대로
- `event_neverland1` K228: B0b-2 독립 · X3c 그대로 → X3f-6d 참고 · X3g-3a 그대로
- `char:194` K229: B0b-2 독립 · X3c 그대로 → X3f-6h 참고 · X3g-3a 그대로
- `char:225` K232: B0b-2 보강 · X3c 그대로 → X3f-5b 참고 → X3g-3a 보강
- `event_lionheart` K233: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:382` K234: B0b-2 독립 · X3c 그대로 → X3f-6h 참고
- `event_perfectmaid` K237: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `sub:피라_00` K240: B0b-2 독립 · X3c 그대로 → X3f-6b 참고 · X3g-3a 그대로
- `sub:피라_01` K241: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:피라_02` K242: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `relic:잘지내라친구` K244: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `sub:택틱컬틱택_00` K245: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:택틱컬틱택_01` K246: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `sub:핸섬_커맨더_00` K247: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:핸섬_커맨더_01` K248: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `sub:MMR지킴이_00` K249: B0b-2 독립 · X3c 그대로 → X3f-6b 참고
- `event_killthelord` K253: B0b-2 보강 · X3c 그대로 → X3f-5b 참고 · X3g-3a 그대로
- `event_liarsend` K258: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `side:second_affection` K259: B0b-2 보강 · X3c 그대로 · X3f-4b 그대로 → X3g-3a 필수
- `relic:반드시사수하라` K262: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `char:330` K265: B0b-2 보강 · X3c 그대로 → X3f-5b 참고 · X3g-3a 그대로
- `char:361` K266: B0b-2 독립 · X3c 그대로 → X3f-6h 참고
- `event_goldencoinrush1` K269: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `event_claymore` K272: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:551` K273: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `event_beautyfullshot1` K274: B0b-2 보강 · X3c 그대로 → X3f-4b 참고 · X3g-3b 그대로
- `char:283` K276: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `relic:말뚝프로젝트보고서` K277: B0b-2 독립 → X3c 보강 · X3f-4b 그대로
- `sub:관짝이_00` K278: B0b-2 필수 → X3b 보강 · X3f-4b 그대로
- `sub:거울_공주_00` K279: B0b-2 독립 → X3c 보강 → X3f-5b 참고
- `sub:관짝이_01` K280: B0b-2 독립 → X3b 보강 → X3f-5b 참고 · X3g-3b 그대로
- `sub:관짝이_02` K281: B0b-2 필수 → X3b 보강 → X3f-4b 참고
- `sub:거울_공주_01` K282: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `char:391` K285: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `event_colorless` K286: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `char:390` K287: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `char:833` K288: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `char:832` K291: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `event_nonsensered` K293: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `char:580` K297: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `event_lifeagain` K299: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `char:240` K300: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `relic:소녀의일기-절망편-` K301: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `erelic:old_tales_dialog` K304: B0b-2 보강 · X3c 그대로 → X3f-4b 참고 · X3g-3b 그대로
- `erelic:old_tales_mini_memory` K306: B0b-2 보강 · X3c 그대로 → X3f-4b 참고
- `char:226` K307: B0b-2 보강 · X3c 그대로 → X3f-5b 참고 · X3g-3b 그대로 · X3g-3 그대로
- `char:511` K308: B0b-2 독립 → X3c 보강 · X3f-4b 그대로
- `event_secretgarden` K310: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `char:411` K311: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `event_icedragonsaga1` K312: B0b-2 독립 · X3b 그대로 → X3f-4b 보강
- `char:16` K317: B0b-2 독립 · X3c 그대로 → X3f-6i 참고 · X3g-3b 그대로
- `char:290` K319: B0b-2 독립 · X3c 그대로 → X3f-6i 참고 · X3g-3b 그대로
- `event_romanticvalentine` K320: B0b-2 독립 · X3c 그대로 → X3f-6d 참고
- `relic:알관련전달사항` K323: B0b-2 보강 · X3c 그대로 → X3f-4c 참고
- `relic:할일목록` K324: B0b-2 독립 → X3c 보강 → X3f-4c 참고
- `char:834` K327: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `fl:for_rest` K328: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `event_newflavor` K330: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `char:521` K335: B0b-2 독립 · X3c 그대로 → X3f-6i 참고
- `relic:주워갈것들메모` K336: B0b-2 보강 · X3c 그대로 → X3f-4c 참고
- `relic:은색액체` K337: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `erelic:unbreakable_sphere_dialog` K339: B0b-2 독립 · X3c 그대로 → X3f-6c 참고 · X3g-3b 그대로
- `erelic:unbreakable_sphere_lost` K340: B0b-2 보강 · X3c 그대로 → X3f-4c 참고
- `char:590` K342: B0b-2 독립 · X3c 그대로 → X3f-6i 보강
- `char:162` K343: B0b-2 보강 · X3c 그대로 → X3f-4c 참고 · X3g-3b 그대로
- `char:581` K345: B0b-2 독립 · X3c 그대로 → X3f-6i 참고 · X3g-3b 그대로
- `event_lordforjustice` K346: B0b-2 보강 · X3c 그대로 → X3f-4c 참고 → X3g-3b 보강
- `char:852` K349: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `event_overthehorizon` K352: B0b-2 보강 · X3c 그대로 → X3f-4c 참고
- `fl:boom_the_ghost` K354: B0b-2 필수 · X3b 그대로 → X3f-4c 보강 · X3g-3b 그대로
- `relic:어떤소녀의그림일기` K358: B0b-2 독립 → X3c 보강 · X3f-4c 그대로
- `char:95` K361: B0b-2 독립 · X3c 그대로 → X3f-6j 참고 · X3g-3b 그대로
- `fl:coins_in_rush` K363: B0b-2 보강 · X3c 그대로 → X3f-4c 참고
- `fl:reborn_evil` K366: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `char:840` K367: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `char:841` K369: B0b-2 독립 · X3c 그대로 → X3f-6j 참고
- `relic:주의용광로사용법` K374: B0b-2 보강 · X3b 그대로 → X3f-4c 독립
- `erelic:goddess_fall_mini` K376: B0b-2 보강 · X3b 그대로 → X3f-3a 필수
- `char:223` K377: B0b-2 독립 · X3c 그대로 → X3f-6j 참고
- `char:331` K378: B0b-2 독립 · X3c 그대로 → X3f-6j 참고
- `fl:blank_ticket` K380: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `fl:terminus_ticket` K382: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `char:471` K386: B0b-2 독립 · X3c 그대로 → X3f-6j 참고 · X3g-3b 그대로
- `fl:sin_editor` K387: B0b-2 보강 · X3c 그대로 → X3f-4c 참고 · X3g-3b 그대로
- `fl:fatal_maid` K389: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `relic:아무한테나말해주는거아니야.wav` K391: B0b-2 독립 · X3c 그대로 → X3f-6c 참고
- `relic:거인을찾아서` K392: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `fl:lie_cause_recoil` K393: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `char:113` K398: B0b-2 독립 · X3c 그대로 → X3f-6j 참고 · X3g-3b 그대로
- `fl:2x2_love_1ch` K399: B0b-2 독립 · X3c 그대로 → X3f-6e 참고 · X3g-3b 그대로
- `fl:2x2_love_2ch` K400: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `fl:good_world` K403: B0b-2 필수 · X3b 그대로 → X3f-4c 참고 · X3g-3b 그대로
- `relic:신에게닿기위한탑` K405: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `relic:궤도엘리베이터음모론` K406: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `char:17` K408: B0b-2 독립 · X3c 그대로 → X3f-6j 참고 · X3g-3b 그대로
- `fl:bitter_spice` K413: B0b-2 독립 · X3c 그대로 → X3f-4c 보강 · X3g-3b 그대로
- `fl:wave_to_you` K417: B0b-2 독립 · X3b 그대로 → X3f-6d 참고 · X3g-3b 그대로
- `relic:불길한_소리.wav` K424: B0b-2 보강 · X3c 그대로 → X3f-5b 참고
- `fl:persona_on_frontline` K425: B0b-2 독립 · X3c 그대로 → X3f-6e 참고
- `fl:great_villain_union` K429: B0b-2 독립 · X3b 그대로 → X3f-4c 보강

## 다시 볼 묶음 (규칙 — tools/views/importance.mjs 머리말)

- 필수 다시: 지금 필수 — 새 정의와 척추 자리(--from · --before)로.
- 주역 원점: 필수 후보 — 원점(origin)이 아직 없는 주역의 사연(신념 · 기억 · 소속 · 신체 변화, 그 주역을 다룬 사실 2건 이상). 주역마다 원점 단위 하나가 필수(카드 3절 2), 나머지 사연 조각은 보강 · 참고.
- 메인이 딛음: 필수 후보 — 척추(메인 챕터 · 척추 이벤트 · 사이드)가 이 단위의 것을 딛거나 척추 의문을 전부 회수 · 뒤집는다(척추가 그 상황에서 시작하는 단위) · 척추가 쌓은 갈등 · 관계 · 성장이 여기서 끝난다(마무리 기록 — 판정 입력 ⑦).
- 보강 다시: 지금 보강 — 보강(척추가 '뭐 있나 보다'로 넘긴 빈틈) / 참고(열린 줄기의 복선 · 세계 · 곁 일화)로 가른다(카드 3절 4).
- 참고 후보: 지금 독립 — 줄기에 안 묶인 세계 · 척추 인물 사실 · 생활상 · 줄기 인물 변화 · 줄기 암시가 있다. 척추가 말하지 않은 기록이 하나 이상이면 참고(카드 3절 5).
- 독립 그대로: 지금 독립 — 위 입력이 없다. 1회독 요약으로 확인하고 일괄로 다시 봄을 남긴다.
- 기준 바꿈 뒤 검토 기록(세션 X3f · N3, 또는 사용자)이 있으면 다시 봄 — 목록에서 빠진다. 앞 묶음이 이긴다.
