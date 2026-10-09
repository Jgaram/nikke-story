# 척추 선정 — 계산 (X3f-1b · 1c)

출처: annotations/read1/(판정 B — annotations/spine.json) — 규칙 tools/views/spine.mjs 머리말, 뜻 docs/importance.md 1절, 처음 고른 기록 data/views/importance/spine-candidates.md.
척추 = 문 ∧ (ⓐ 뼈대 기록 ≥ 3 ∨ ⓒ 긴 회수 ≥ 2(제기 뒤 20칸 이상) · 복선의 답 ≥ 5) ∧ ⓑ 메인 연결 ≥ 3. 뒤집기: `node tools/records.mjs set B… 확정|기각 --by 사용자 --note "…"`, 기준은 spine.json criteria.

- 척추 11(이벤트 8 · 사이드 3) · 문 안이지만 미달 6 · 계산과 어긋남 0

## 문 안 단위

| ID | 단위 | 문 | ⓐ 뼈대 | ⓒ 긴 회수 · 복선의 답 | ⓑ 메인 in · out | 계산 | 판정 | 어긋남 | 이유 |
|---|---|---|---:|---:|---:|---|---|---|---|
| B8 | `event_brandnewyear` BRAND NEW YEAR | 신년 | 1 (J1×1) | 0 · 0 | 1 (0 · 1) | 미달 | 빼고 판정 |  | 문 신년 · ⓐ 1(J1×1) · ⓒ 0 · 0 · ⓑ 1 — 일상극(신년 선상 파티), 마리안 줄기 한 조각 |
| B1 | `event_overzone` OVER ZONE | 하프(0.5주년) | 9 (J6×5 J7×3 J16×1) | 1 · 1 | 11 (2 · 9) | 넘음 | **척추** |  | 문 하프 · ⓐ 뼈대 9(J6×5 J7×3 J16×1) · ⓒ 1 · 1 · ⓑ 메인 연결 11 — 갓데스 스쿼드와 방주의 배신(J6) · 도로시의 복수(J7)를 움직이고 메인 ch39 · ch46 · ch48이 딛는다 |
| B2 | `event_redash` RED ASH | 1주년 | 8 (J2×3 J6×2 J9×3) | 0 · 5 | 9 (4 · 5) | 넘음 | **척추** |  | 문 1주년 · ⓐ 8(J9×3 J2×3 J6×2) · ⓒ 0 · 5 · ⓑ 9 — 1차 침공기: 랩쳐의 기원(J9) · 라피와 레드 후드(J2) · J6. 메인 ch26의 물음을 풀고 ch31 · ch32 · ch34가 딛는다 |
| B9 | `event_newyearnewsword` NEW YEAR, NEW SWORD | 연말 · 신년 | 0 | 1 · 1 | 5 (0 · 5) | 미달 | 빼고 판정 |  | 문 연말 · 신년 · ⓐ 0 · ⓒ 1 · 1 · ⓑ 5 — ⓐ · ⓒ 미달: 홍련의 1차 침공기 회상을 메인 ch46–48이 다시 꺼내지만 뼈대 기록도 마무리도 없다. 판정이 "메인이 설명 없이 전제하는가"로 본다 |
| B13 | `side:second_affection` SECOND AFFECTION | 사이드 | 2 (J1×2) | 0 · 0 | 0 (0 · 0) | 미달 | 빼고 판정 |  | 문 사이드 · ⓐ 2 · ⓒ 0 · 0 · ⓑ 0 — ⓐ · ⓑ 미달: 크라운 왕국에서 자란 마리안. LAST KINGDOM(척추)의 앞편으로 판정한다(카드 5절) |
| B3 | `event_lastkingdom1` LAST KINGDOM | 1.5주년 | 6 (J1×5 J15×1) | 0 · 4 | 5 (1 · 4) | 넘음 | **척추** |  | 문 1.5주년 · ⓐ 6(J1×5 J15×1) · ⓒ 0 · 4 · ⓑ 5 — 마리안이 여왕으로 받들어지는 J1의 장면. 메인 ch46–47은 그 결과만 전제한다 |
| B14 | `side:wordless` WORDLESS | 사이드 | 0 | 0 · 1 | 2 (1 · 1) | 미달 | 빼고 판정 |  | 문 사이드 · ⓐ 0 · ⓒ 0 · 1 · ⓑ 2 — ⓐ · ⓑ 미달: 유니 · 미하라의 이야기. MUDFISH(척추)의 앞편으로 판정한다(카드 5절) |
| B4 | `event_oldtales1` OLD TALES | 2주년 | 6 (J12×6) | 0 · 3 | 16 (7 · 9) | 넘음 | **척추** |  | 문 2주년 · ⓐ 6(J12×6) · ⓒ 0 · 3 · ⓑ 16 — 2세대 페어리 테일(J12)의 원점. 메인 ch32 · ch34의 물음을 풀고 ch35 · ch36 · ch48이 딛는다 |
| B10 | `event_footstepwalkrun1` FOOTSTEP, WALK, RUN | 연말 · 신년 | 14 (J2×11 J18×1 J19×2) | 3 · 2 | 22 (10 · 12) | 넘음 | **척추** |  | 문 연말 · 신년 · ⓐ 14(J2×11 J19×2 J18×1) · ⓒ 3 · 2 · ⓑ 22 — 라피와 레드 후드(J2)의 과거. 메인 일곱 챕터의 물음을 풀고(오래 묵은 것 셋) 여섯 챕터가 딛는다 |
| B11 | `event_outofuniform` OUT OF UNIFORM | 신년 | 0 | 0 · 0 | 0 (0 · 0) | 미달 | 빼고 판정 |  | 문 신년 · ⓐ 0 · ⓒ 0 · 0 · ⓑ 0 — 일상극(새해 축제). 1회독 요약 "새 의문 · 큰 사실 없음" |
| B15 | `side:mudfish` MUDFISH | 사이드 | 4 (J10×2 J12×2) | 0 · 2 | 11 (5 · 6) | 넘음 | **척추** |  | 문 사이드 · ⓐ 4(J10×2 J12×2) · ⓒ 0 · 2 · ⓑ 11 — 세이렌과 레비(포비스트 J10 · 2세대 페어리 테일 J12). 메인 ch38 '미안해 세이렌'이 전제하고 ch42가 딛는다 |
| B5 | `event_unbreakablesphere1` UNBREAKABLE SPHERE | 2.5주년 | 7 (J12×6 J18×1) | 0 · 2 | 2 (1 · 1) | 미달 | 빼고 판정 |  | 문 2.5주년 · ⓐ 7(J12×6 J18×1) · ⓒ 0 · 2 · ⓑ 2 — ⓑ 미달: J12를 움직이지만 메인과 이어진 기록이 둘(ch36 · ch42)뿐. 앞편 MUDFISH(척추)의 뒷이야기로 판정한다(카드 5절) |
| B16 | `side:eden_spear` EDEN SPEAR | 사이드 | 15 (J1×1 J8×6 J12×2 J13×3 J15×3) | 0 · 2 | 11 (9 · 2) | 넘음 | **척추** |  | 문 사이드 · ⓐ 15(J8×6 J13×3 J15×3 J12×2 J1×1) · ⓒ 0 · 2 · ⓑ 11 — ch22–ch39의 에덴 쪽(J8 · J13 · J15 · J12). GODDESS FALL(척추)이 곧바로 이어받는 같은 사건의 앞부분 |
| B6 | `event_goddessfall1` GODDESS FALL | 3주년 | 26 (J1×4 J3×5 J7×4 J8×2 J12×1 J13×10) | 1 · 8 | 29 (15 · 14) | 넘음 | **척추** |  | 문 3주년 · ⓐ 26(J13×10 J3×5 J1×4 J7×4 J8×2 J12×1) · ⓒ 1 · 8 · ⓑ 29 — 퀸(J13) · 지휘관의 정체(J3) · 마리안(J1) · 도로시(J7). 메인 아홉 챕터의 물음을 풀고 네 챕터가 딛는다 |
| B12 | `fl:ark_guardian` ARK GUARDIAN | 신년 | 19 (J4×3 J5×7 J6×7 J8×1 J15×1) | 4 · 6 | 26 (10 · 16) | 넘음 | **척추** |  | 문 신년 · ⓐ 19(J6×7 J5×7 J4×3 J15×1 J8×1) · ⓒ 4 · 6 · ⓑ 26 — 아크 가디언 작전: J6 · 엔더슨(J5) · 언체인드(J4). 오래 묵은 의문 넷을 풀고 메인 다섯 챕터가 딛는다. 금서고 원문 |
| B17 | `side:pretty_star` PRETTY STAR | 사이드 | 4 (J6×4) | 1 · 5 | 10 (7 · 3) | 넘음 | **척추** |  | 문 사이드 · ⓐ 4(J6×4) · ⓒ 1 · 5 · ⓑ 10 — 프리티(프리시아)와 오스왈드: 갓데스와 방주의 배신(J6). 메인 ch33 · ch34의 물음을 풀고 ch45가 딛는다. STAR ANIS(척추)의 앞편 |
| B7 | `event_staranis1` STAR ANIS | 3.5주년 | 0 | 3 · 9 | 18 (18 · 0) | 넘음 | **척추** |  | 문 3.5주년 · ⓐ 0(보강 줄기 J24 — 아니스의 과거) · ⓒ 3 · 9 · ⓑ 18 — 뼈대 줄기는 아니지만 빌드업 마무리가 메인 밖 1위: 오래 묵은 아니스 의문 셋을 풀고 아홉 단위가 흘린 복선이 여기서 답을 얻는다 |

## 문 밖에서 기준을 넘는 것 — 문을 빼면 들어올 이벤트 · 사이드 (척추가 아니다 — 판정 단위로 필수 · 보강을 받는다)

| 단위 | ⓐ 뼈대 | ⓒ 긴 회수 · 복선의 답 | ⓑ 메인 연결 |
|---|---:|---:|---:|
| `event_boomsday` BOOMS DAY | 3 | 0 · 0 | 6 |
| `event_darkhero` D.ARK HERO | 4 | 0 · 3 | 4 |
| `event_wisdomspring` WISDOM SPRING | 5 | 0 · 2 | 11 |
| `event_lordforjustice` LORD, FOR JUSTICE | 0 | 0 · 6 | 3 |
| `fl:boom_the_ghost` BOOM! THE GHOST! | 6 | 0 · 1 | 13 |
| `fl:ark_ranger` ARK RANGER | 3 | 0 · 2 | 4 |
| `fl:project_matis` PROJECT MATIS | 1 | 1 · 5 | 4 |

## 기준을 바꾸면 달라지는 것 — 조율할 손잡이

- ⓑ를 빼면(문 + ⓐ 또는 ⓒ만): `event_unbreakablesphere1`(들어옴)
- ⓐ · ⓒ를 빼면(문 + ⓑ만): `event_newyearnewsword`(들어옴)
- ⓒ를 빼면(문 + ⓐ + ⓑ): `event_staranis1`(빠짐)
- 문 안을 통째로 넣으면(기준 없이): `event_brandnewyear`(들어옴) · `event_newyearnewsword`(들어옴) · `side:second_affection`(들어옴) · `side:wordless`(들어옴) · `event_outofuniform`(들어옴) · `event_unbreakablesphere1`(들어옴)
- 문을 빼면(기준만): 위 "문 밖에서 기준을 넘는 것" 7이 더 들어온다 — 지금 필수 대부분이 척추로 올라가 척추와 필수가 겹친다. 그래서 문을 뒀다.

## ⓒ 빌드업 마무리 — 척추 단위마다 긴 회수 · 복선의 답 (X3f-1d가 판정 입력 · 화면에 띄운다)

- `event_overzone` — 긴 회수 1: Q33(relic:갓데스스쿼드리포트, 29칸 뒤 Q33-3) · 복선의 답 1: F914(← E1272@char:220)
- `event_redash` — 긴 회수 0 · 복선의 답 5: F1142(← E38@relic:갓데스스쿼드리포트) · F1148(← E39@relic:갓데스스쿼드리포트) · F1161(← E206@erelic:white_memory) · F1163(← E194@event_overzone) · F1172(← E192@event_overzone)
- `event_newyearnewsword` — 긴 회수 1: Q90(char:222, 42칸 뒤 Q90-3) · 복선의 답 1: F1238(← E1284@char:222 E282@event_redash 외 1)
- `event_lastkingdom1` — 긴 회수 0 · 복선의 답 4: F1435(← E202@event_overzone) · F1436(← E365@side:second_affection) · F1438(← E364@side:second_affection) · F1452(← E1297@char:260)
- `side:wordless` — 긴 회수 0 · 복선의 답 1: F1618(← E24@ch04)
- `event_oldtales1` — 긴 회수 0 · 복선의 답 3: F1669(← E309@erelic:red_ash_mini) · F1675(← E455@ch32) · F1681(← E1248@char:180)
- `event_footstepwalkrun1` — 긴 회수 3: Q2(ch01, 94칸 뒤 Q2-2) · Q145(ch24, 52칸 뒤 Q145-3) · Q171(ch28, 30칸 뒤 Q171-4) · 복선의 답 2: F1763(← E18@ch03 E301@event_redash) · F1765(← E11@ch02 E497@ch34)
- `side:mudfish` — 긴 회수 0 · 복선의 답 2: F1847(← E512@ch34) · F1849(← E493@ch34 E526@event_oldtales1 외 1)
- `event_unbreakablesphere1` — 긴 회수 0 · 복선의 답 2: F1884(← E645@side:mudfish) · F1903(← E1616@char:511 E1398@char:514)
- `side:eden_spear` — 긴 회수 0 · 복선의 답 2: F2163(← E1302@char:261) · F2166(← E148@ch20)
- `event_goddessfall1` — 긴 회수 1: Q132(erelic:white_memory, 92칸 뒤 Q132-3) · 복선의 답 8: F2260(← E815@ch40) · F2268(← E1301@char:261) · F2271(← E412@event_lastkingdom1) · F2277(← E366@side:second_affection) · F2290(← E361@side:second_affection) · F2297(← E1286@char:222) · F2300(← E413@event_lastkingdom1) · F2307(← E398@event_lastkingdom1)
- `fl:ark_guardian` — 긴 회수 4: Q83(char:221, 116칸 뒤 Q83-3) · Q104(ch19, 108칸 뒤 Q104-2) · Q131(erelic:white_memory, 97칸 뒤 Q131-2) · Q159(erelic:red_ash_lost, 78칸 뒤 Q159-2) · 복선의 답 6: F2358(← E293@event_redash E297@event_redash) · F2364(← E119@ch17) · F2368(← E1309@char:233) · F2369(← E778@event_overthehorizon) · F2373(← E26@ch04 E1256@char:72 외 6) · F2375(← E123@ch17 E198@event_overzone)
- `side:pretty_star` — 긴 회수 1: Q247(event_arcanearchive, 31칸 뒤 Q247-2) · 복선의 답 5: F2543(← E295@event_redash) · F2546(← E479@ch33) · F2552(← E480@ch33) · F2556(← E1276@char:12 E479@ch33 외 1) · F2558(← E1602@char:800 E205@erelic:white_memory 외 3)
- `event_staranis1` — 긴 회수 3: Q19(ch04, 139칸 뒤 Q19-4) · Q43(ch08, 135칸 뒤 Q43-4) · Q269(ch39, 26칸 뒤 Q269-3) · 복선의 답 9: F2674(← E1054@side:pretty_star) · F2679(← E1062@side:pretty_star) · F2690(← E61@sub:러블리_드림_00 E901@ch41) · F2694(← E1050@side:pretty_star) · F2698(← E630@ch36 E900@ch41) · F2700(← E1058@side:pretty_star) · F2701(← E898@ch41 E1049@side:pretty_star) · F2705(← E503@ch34 E576@event_footstepwalkrun1 외 6) · F2708(← E666@ch38)
