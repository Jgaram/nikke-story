# 읽기 순서 — 출시순 한 줄(1회독) · 층별(2회독)

**도구가 읽는 데이터다.** `tools/records/order.mjs`가 이 파일의 항목 줄과 `#### N층` 머리줄만 읽어 1회독 · 2회독 순서와 층을 얻는다
(기록 검증 · 자리 번호 · 화면 데이터 · 사이트 내보내기). 항목 줄은 2026-10-13 docs/history/reading.md에서 그대로 옮겼다 — 그 항목의 인계 · 경위는 거기 있다.

- 줄 모양(굵은 이름 · 백틱 키 · `chNN–MM` · ` — ` 뒤 분량)을 바꾸지 않는다. 지금 몫은 기준(`tests/fixtures/reading-order.json`)과 같아야 한다 — `tests/reading-order.test.mjs`.
- 신작을 읽을 항목(SESSIONS.md N3)은 같은 모양으로 그 절 끝에 덧붙인다. SESSIONS.md에 두면 도구가 읽지 않는다.
- 이미 있는 순서를 일부러 바꿀 때는 근거를 남기고 `node tools/records/order-snapshot.mjs write`로 기준을 새로 쓴다.
- 서브퀘스트 · 유실물의 실제 자리는 지역 파일(`annotations/subquest-regions.json` · `relic-regions.json`)로 다시 놓는다 — 항목 줄은 그때 읽은 기록 그대로 둔다.

## 1회독 (R · RE) — 출시순 한 줄 (줄거리 층)

- [x] **R01** ch00–02 · `sub:칠리페퍼_00` `sub:테트라_커넥트_00` · ch03 · `sub:세르반_00` · ch04–05 · `sub:중앙_정부_공식__00` · ch06 — 8.0만 자 · 12파트 (2026-09-29)
- [x] **R02** `relic:어느남자의수기` · `sub:콜렉터_00` `sub:콜렉터_01` · `relic:생존가이드1` `relic:통화기록017515` `relic:방주추첨권` · `sub:트레저_헌터_00` `sub:트레저_헌터_01` `sub:트레저_헌터_02` `sub:트레저_헌터_03` `sub:이례의_기록자_00` `sub:랩칠리언_00` `sub:랩칠리언_01` `sub:랩칠리언_02` `sub:랩칠리언_03` `sub:랩칠리언_04` `sub:랩칠리언_05` `sub:랩칠리언_06` `sub:할아범_00` · `relic:갓데스스쿼드리포트` · `sub:고스트_00` `sub:시리얼_00` `sub:시리얼_01` `sub:산해진미_00` `sub:산해진미_01` · `relic:니케실험대상자모집` `relic:통화기록028594` · `sub:세르반_01` `sub:저스틴_00` · `relic:니케실험반대피켓` · ch07 · `sub:중앙_정부_공식__01` `sub:세르반_02` `sub:스페이드_00` `sub:러블리_드림_00` `sub:러블리_드림_01` · `relic:채팅로그_얼리어답터` · `d_ex_elevator_01` — 8.5만 자 · 38파트 · 2022-11-04 (2026-09-29)
- [x] **R03** ch08 · `sub:칠리페퍼_01` `sub:든_셀_00` · `relic:광고팜플렛` `relic:UFO챈.zip` · ch09 · `sub:테디_00` `sub:미실리스_연구팀_00` `sub:미실리스_연구팀_01` `sub:미실리스_연구팀_02` `sub:미실리스_연구팀_03` · `relic:지휘관모집공고` · ch10 · `sub:코리_00` `sub:롬_00` `sub:롬_01` `sub:롬_02` · `relic:어느소녀의수기` · ch11 · `sub:음악_애호가_00` `sub:음악_애호가_01` · `relic:기업-랩쳐음모론` `relic:구시대의플레이리스트` · ch12 · `sub:숲속요정_00` · `relic:어느의사의수기` — 9.2만 자 · 26파트 · 2022-11-04 (2026-09-29)
- [x] **R04** ch13 · `sub:세르반_03` `sub:철도로GO_00` · `relic:여자친구의편지` · ch14 · `sub:칠리페퍼_02` `sub:알콜러버_00` · `relic:기후변화보고서` `relic:인터넷BJ라이브방송녹화분` · ch15 · `relic:종말의서` · ch16 · `sub:방주_난민_00` `sub:방주_난민_01` `sub:방주_난민_02` `sub:방주_난민_03` · `relic:장보기목록` — 9.5만 자 · 18파트 · 2022-11-04 (2026-09-29)
- [x] **R05** `char:180` `char:11` `char:212` `char:232` `char:430` — 9.6만 자 · 6파트 · 2022-11-04 (2026-09-29)
- [x] **R06** `char:20` `char:202` `char:101` `char:72` `char:221` — 8.5만 자 · 5파트 · 2022-11-04 (2026-09-29)
- [x] **R07** `char:10` `char:190` `char:200` `char:82` `char:102` — 9.5만 자 · 6파트 · 2022-11-04 (2026-09-29)
- [x] **R08** `char:130` `char:181` `char:32` `char:61` `char:161` `char:141` — 9.4만 자 · 6파트 · 2022-11-04 (2026-09-29)
- [x] **R09** `char:91` `char:60` `char:431` `char:70` `char:80` `char:71` — 8.5만 자 · 6파트 · 2022-11-04 (2026-09-29)
- [x] **R10** `char:140` `char:220` `char:22` `char:12` — 9.0만 자 · 5파트 · 2022-11-04 (2026-09-29)
- [x] **R11** `char:432` `char:172` `char:191` `char:201` `char:291` `char:241` — 8.9만 자 · 6파트 · 2022-11-04 (2026-09-29)
- [x] **R12** `char:210` `char:90` `char:160` `char:150` `char:171` `char:92` — 8.9만 자 · 7파트 · 2022-11-04 (2026-09-29)
- [x] **R13** `char:231` `char:110` `char:131` `char:30` `char:242` `char:170` — 9.2만 자 · 6파트 · 2022-11-04 (2026-09-29)
- [x] **R14** `char:142` `char:230` `char:222` `char:120` · `event_nocallerid` · `char:352` — 9.2만 자 · 6파트 · 2022-11-04~2022-11-10 (2026-09-30)
- [x] **R15** ch17 · `sub:제니퍼f_00` · `relic:모바일_보이스피싱_광고_모음.zip` `relic:니케제작보고서요약본` · ch18 · `sub:테트라_커넥트_01` `sub:중앙_정부_공식__02` `sub:김작가_00` · `relic:XX중학교가정통신문` · `event_hightechtoy` — 8.8만 자 · 12파트 · 2022-11-24 (2026-09-30)
- [x] **R16** `char:100` · `event_miraclesnow1` · `char:193` `char:203` `char:121` — 9.1만 자 · 7파트 · 2022-11-24~2022-12-15 (2026-09-30)
- [x] **R17** `event_brandnewyear` · `char:260` · ch19 · `sub:데이파라_00` · `relic:데일리아크기사스크랩` · ch20 · `sub:로망티스트_00` · `relic:jonathan_report` · `event_doutsiders` — 9.0만 자 · 10파트 · 2022-12-29~2023-01-12 (2026-09-30)
- [x] **R18** `char:400` `char:401` `char:111` `char:402` `char:112` — 8.5만 자 · 5파트 · 2023-01-12~2023-01-19 (2026-09-30)
- [x] **R19** `event_maidinvalentine` · `char:311` `char:312` `char:800` `char:801` `char:802` · `event_bowwowparadise` — 9.9만 자 · 8파트 · 2023-02-01~2023-03-15 (2026-09-30)
- [x] **R20** `char:381` · `event_cherryblossom` · `char:261` `char:282` · `event_fullfoolday` — 9.1만 자 · 6파트 · 2023-03-15~2023-04-01 (2026-09-30)
- [x] **R21** `event_ltk` · `char:40` · ch21 · `sub:에덴_Notice_00` `sub:에덴_Notice_01` `sub:에덴_Notice_02` · `relic:특이랩쳐보고서-전` `relic:특이랩쳐보고서-후` — 7.9만 자 · 10파트 · 2023-04-13~2023-04-27 (2026-09-30)
- [x] **R22** ch22 · `sub:문구점_00` `sub:중앙정부_트라이앵글_00` `sub:2호_쉘터_관리계정_00` `sub:할아범_01` · `relic:에닉탄핵포스터` · `event_overzone` · `erelic:white_memory` — 10.1만 자 · 11파트(할아범_01을 옮겨 와 조금 넘음 — 멈춤 기준 15만 자 안) · 2023-04-27 (2026-09-30)
- [x] **R23** `char:233` `char:392` · `event_BunnyX777` · `char:270` `char:271` — 9.9만 자 · 6파트 · 2023-04-27~2023-05-25 (2026-09-30)
- [x] **R24** `event_queensorder` · `char:280` — 4.5만 자 · 3파트 · 2023-06-01 (2026-09-30)
- [x] **R25** `event_bluewaterisland` · `char:132` `char:14` — 9.1만 자 · 6파트 · 2023-06-15~2023-06-22 (2026-09-30)
- [x] **R26** `event_nyanyaparadise` · `char:380` · ch23 · `sub:상인연합_달란트_00` `sub:콜렉터_02` · `relic:필그림조우보고서` — 8.1만 자 · 8파트 · 2023-07-06~2023-07-20 (2026-09-30)
- [x] **R27** ch24 · `sub:해결사_카페_스위티_00` · `relic:긴급뉴스대본_FB_3_final_2.pdf` · `event_goldenship` · `char:350` — 8.7만 자 · 8파트 · 2023-07-20 (2026-09-30)
- [x] **R28** `event_seayouagain1` · `char:15` `char:351` — 8.8만 자 · 5파트 · 2023-08-03 (2026-09-30)
- [x] **R29** `char:353` · `event_firstaffection` · `char:810` `char:812` `char:811` · `event_schooloflock` · `char:321` — 8.9만 자 · 8파트 · 2023-08-10~2023-09-21 (2026-09-30)
- [x] **R30** `event_dazzlingcupid` · `char:450` `char:451` · `event_freezeacpu` — 9.0만 자 · 6파트 · 2023-10-05~2023-10-19 (2026-09-30)
- [x] **R31** `char:33` · ch25 · `sub:중앙정부_프로토콜_00` · `relic:마더웨일아종목격보고.wav` · ch26 · `sub:로망티스트_01` `sub:코인_러시_00` · `relic:저주받은보석` — 8.3만 자 · 10파트 · 2023-10-19~2023-11-02 (2026-09-30)
- [x] **R32** `event_redash` · `erelic:red_ash_lost` — 9.7만 자 · 6파트 · 2023-11-02 (2026-09-30)
- [x] **R33** `erelic:red_ash_mini` · `char:470` `char:224` · `event_alonesurvivor` · `char:192` — 8.3만 자 · 6파트 · 2023-11-02~2023-11-23 (2026-09-30)
- [x] **R34** `event_neverland1` · `char:194` `char:62` — 7.6만 자 · 5파트 · 2023-12-07~2023-12-14 (2026-09-30)
- [x] **R35** `event_newyearnewsword` · `char:225` · `event_lionheart` · `char:382` — 8.5만 자 · 6파트 · 2023-12-28~2024-01-11 (2026-09-30)
- [x] **R36** `event_dirtybackyard` · `char:281` · `event_perfectmaid` · `char:313` — 9.1만 자 · 6파트 · 2024-01-25~2024-02-05 (2026-10-01)
- [x] **R37** `char:310` · ch27 · `sub:피라_00` `sub:피라_01` `sub:피라_02` `sub:트윙클_00` · `relic:잘지내라친구` — 6.3만 자 · 8파트 · 2024-02-15~2024-02-22 (2026-10-01)
- [x] **R38** ch28 · `sub:택틱컬틱택_00` `sub:택틱컬틱택_01` `sub:핸섬_커맨더_00` `sub:핸섬_커맨더_01` `sub:MMR지킴이_00` · `relic:조난일지` · `event_boomsday` · `char:500` — 9.0만 자 · 11파트 · 2024-02-22 (2026-10-01)
- [x] **R39** `event_killthelord` · `char:43` `char:822` `char:821` `char:820` · `event_liarsend` — 8.5만 자 · 7파트 · 2024-03-07~2024-04-01 (2026-10-01)
- [x] **R40** `side:second_affection` · `event_onemoretime` · `char:550` — 7.8만 자 · 6파트 · 2024-04-11 (2026-10-01)
- [x] **R41** ch29 · `relic:반드시사수하라` · ch30 · `relic:하모니큐브관찰일지` — 6.5만 자 · 6파트 · 2024-04-25 (2026-10-01)
- [x] **R42** `event_lastkingdom1` · `char:330` `char:361` — 9.7만 자 · 6파트 · 2024-04-25 (2026-10-01)
- [x] **R43** `event_darkhero` · `char:501` — 4.8만 자 · 3파트 · 2024-05-16 (2026-10-01)
- [x] **R44** `event_goldencoinrush1` · `char:314` — 9.4만 자 · 6파트 · 2024-05-30 (2026-10-01)
- [x] **R45** `char:195` · `event_claymore` · `char:551` — 5.9만 자 · 4파트 · 2024-06-06~2024-06-20 (2026-10-01)
- [x] **R46** `event_beautyfullshot1` · `char:284` `char:283` — 7.9만 자 · 6파트 · 2024-07-04~2024-07-11 (2026-10-01)
- [x] **R47** ch31 · `relic:말뚝프로젝트보고서` · ch32 · `sub:관짝이_00` `sub:거울_공주_00` `sub:관짝이_01` `sub:관짝이_02` `sub:거울_공주_01` · `relic:수정지역깊은곳어딘가` — 7.9만 자 · 11파트 · 2024-07-25 (2026-10-01)
- [x] **R48** `event_juveniledays` · `char:391` · `event_colorless` · `char:390` `char:833` `char:830` `char:831` — 9.6만 자 · 9파트 · 2024-07-25~2024-08-29 (2026-10-01)
- [x] **R49** `char:832` · `event_jinxplayer` `event_nonsensered` · `char:272` · `event_phantomthiefvsdetective` — 9.8만 자 · 7파트 · 2024-09-05~2024-10-03 (2026-10-01)
- [x] **R50** `char:403` `char:580` · `side:wordless` · `event_lifeagain` — 9.0만 자 · 6파트 · 2024-10-03~2024-10-17 (2026-10-01)
- [x] **R51** `char:240` · ch33 · `relic:소녀의일기-절망편-` · ch34 · `relic:충격다크매터란무엇인가` — 9.1만 자 · 8파트 · 2024-10-17~2024-10-31 (2026-10-01)
- [x] **R52** `event_oldtales1` · `erelic:old_tales_dialog` `erelic:old_tales_lost` `erelic:old_tales_mini_memory` — 9.6만 자 · 8파트 · 2024-10-31 (2026-10-01)
- [x] **R53** `char:226` `char:511` `char:514` · `event_secretgarden` · `char:411` — 9.2만 자 · 6파트 · 2024-10-31~2024-11-21 (2026-10-01)
- [x] **R54** `event_icedragonsaga1` · `char:183` `char:182` — 9.2만 자 · 6파트 · 2024-12-05~2024-12-12 (2026-10-01)
- [x] **R55** `event_footstepwalkrun1` `event_outofuniform` · `char:16` — 8.6만 자 · 6파트 · 2024-12-26~2025-01-01 (2026-10-01)
- [x] **R56** `event_wisdomspring` · `char:290` · `event_romanticvalentine` · `char:354` — 9.0만 자 · 7파트 · 2025-01-16~2025-01-30 (2026-10-02)
- [x] **R57** `char:355` · ch35 · `relic:알관련전달사항` · ch36 · `relic:할일목록` · `char:836` `char:835` — 9.9만 자 · 10파트 · 2025-02-06~2025-02-20 (2026-10-02)
- [x] **R58** `char:834` · `fl:for_rest`(= `event_forrest` 본문) · `char:412` · `event_newflavor` · `char:520` — 9.2만 자 · 7파트 · 2025-02-27~2025-03-27 (2026-10-02)
- [x] **R59** `event_foolburstday` · `side:mudfish` · `event_trueflavor` — 9.2만 자 · 7파트 · 2025-04-01~2025-04-10 (2026-10-02)
- [x] **R60** `char:521` · ch37 · `relic:주워갈것들메모` · ch38 · `relic:은색액체` — 7.5만 자 · 7파트 · 2025-04-10~2025-04-24 (2026-10-02)
- [x] **R61** `event_unbreakablesphere1` · `erelic:unbreakable_sphere_dialog` `erelic:unbreakable_sphere_lost` — 9.8만 자 · 7파트 · 2025-04-24 (2026-10-02)
- [x] **R62** `char:513` `char:590` `char:162` · `event_arcanearchive` · `char:581` — 9.2만 자 · 6파트 · 2025-04-24~2025-05-15 (2026-10-02)
- [x] **R63** `event_lordforjustice` · `char:41` — 3.8만 자 · 3파트 · 2025-05-29 (2026-10-02)
- [x] **R64** `event_ce006` — 9.3만 자 · 5파트 · 2025-06-12 (2026-10-03)
- [x] **R65** `char:852` `char:850` `char:851` · `event_overthehorizon` · `char:532` — 5.5만 자 · 6파트 · 2025-06-12~2025-07-03 (2026-10-03)
- [x] **R66** `fl:boom_the_ghost`(= `event_boomtheghost1` 본문) · `char:234` `char:502` — 9.3만 자 · 6파트 · 2025-07-17~2025-07-24 (2026-10-03)
- [x] **R67** ch39 · `relic:정갈하게쓴기록` · ch40 · `relic:어떤소녀의그림일기` — 9.7만 자 · 8파트 · 2025-08-07 (2026-10-03)
- [x] **R68** `event_absolute1` · `char:93` `char:95` `char:94` — 9.7만 자 · 7파트 · 2025-08-07~2025-08-21 (2026-10-03)
- [x] **R69** `fl:coins_in_rush` · `char:315` `char:143` — 9.6만 자 · 6파트 · 2025-09-04~2025-09-11 (2026-10-03)
- [x] **R70** `fl:reborn_evil` · `char:840` `char:842` `char:841` — 8.0만 자 · 6파트 · 2025-09-24~2025-10-02 (2026-10-03)
- [x] **R71** `side:eden_spear` · `fl:go_ninja_thief` · `char:23` — 8.1만 자 · 5파트 · 2025-10-16 (2026-10-03)
- [x] **R72** ch41 · `relic:거꾸로적힌기록` — 5.0만 자 · 4파트 · 2025-10-30 (2026-10-03)
- [x] **R73** ch42 · `relic:주의용광로사용법` — 6.7만 자 · 5파트 · 2025-10-30 (2026-10-03)
- [x] **R74** `event_goddessfall1` — 10.0만 자 · 6파트 · 2025-10-30 (2026-10-03)
- [x] **R75** `erelic:goddess_fall_mini` · `char:223` `char:331` `char:262` · `fl:blank_ticket` · `char:74` — 9.0만 자 · 8파트 · 2025-10-30~2025-11-20 (2026-10-03)
- [x] **R76** `fl:terminus_ticket` · `char:75` `char:73` — 7.0만 자 · 5파트 · 2025-12-04~2025-12-11 (2026-10-03)
- [x] **R77** `fl:ark_guardian` · `char:471` — 9.3만 자 · 6파트 · 2025-12-30~2026-01-01 (2026-10-03)
- [x] **R78** `fl:sin_editor` · `char:582` · `fl:fatal_maid` · `char:316` — 8.1만 자 · 6파트 · 2026-01-15~2026-01-29 (2026-10-03)
- [x] **R79** ch43 · `relic:아무한테나말해주는거아니야.wav` — 4.1만 자 · 4파트 · 2026-02-12 (2026-10-03)
- [x] **R80** ch44 · `relic:거인을찾아서` — 7.2만 자 · 6파트 · 2026-02-12 (2026-10-03)
- [x] **R81** `fl:lie_cause_recoil` · `char:860` `char:862` `char:861` — 7.3만 자 · 6파트 · 2026-02-12~2026-02-19 (2026-10-03)
- [x] **R82** `fl:enter_heaven` · `char:113` — 4.9만 자 · 3파트 · 2026-03-05 (2026-10-03)
- [x] **R83** `fl:2x2_love_1ch` 파트 1–6 — 9.8만 자 · 6파트 · 2026-03-19 (2026-10-03)
- [x] **R84** `fl:2x2_love_1ch` 파트 7–9 — 4.9만 자 · 3파트 · 2026-03-19 (2026-10-03)
- [x] **R84b** `fl:2x2_love_1ch` 파트 10–12 — 4.9만 자 · 3파트 · 2026-03-19 (_40부터 — _37–_39는 R84에서 읽었다) (2026-10-03)
- [x] **R85** `fl:2x2_love_2ch` 파트 1–5 — 8.2만 자 · 5파트 · 2026-03-19 (2026-10-03)
- [x] **R86** `fl:2x2_love_2ch` 파트 6–10 · `char:583` — 9.5만 자 · 6파트 · 2026-03-19 (2026-10-03)
- [x] **R87** `side:pretty_star` — 6.6만 자 · 4파트 · 2026-04-09 (2026-10-03)
- [x] **R88** `fl:good_world` · `char:620` — 4.8만 자 · 3파트 · 2026-04-09 (2026-10-03)
- [x] **R89** ch45 · `relic:신에게닿기위한탑` — 5.4만 자 · 4파트 · 2026-04-23 (2026-10-03)
- [x] **R90** ch46 · `relic:궤도엘리베이터음모론` — 6.9만 자 · 5파트 · 2026-04-23 (2026-10-03)
- [x] **R91** `event_staranis1` 파트 1–3 — 5.6만 자 · 3파트 · 2026-04-23 (2026-10-03)
- [x] **R92** `event_staranis1` 파트 4–6 · `char:17` `char:441` `char:18` — 8.6만 자 · 6파트 · 2026-04-23~2026-04-30 (2026-10-03)
- [x] **R93** `fl:b-side_idol` · `char:600` · `fl:bitter_spice` · `char:601` — 7.8만 자 · 6파트 · 2026-05-14~2026-05-28 (2026-10-04)
- [x] **R94** `fl:ark_ranger` · `char:570` — 9.4만 자 · 6파트 · 2026-06-11 (2026-10-04)
- [x] **R95** `fl:wave_to_you` · `char:515` `char:322` — 9.3만 자 · 6파트 · 2026-07-02~2026-07-09 (2026-10-04)
- [x] **R96** `fl:project_matis` — 9.4만 자 · 5파트 · 2026-07-23 (2026-10-04)
- [x] **R97** `char:103` `char:105` · ch47 · `relic:승리를_부르는_그림자` · ch48 · `relic:불길한_소리.wav` — 8.6만 자 · 8파트 · 2026-07-23~2026-08-13 (2026-10-04)
- [x] **R98** `fl:persona_on_frontline` · `char:872` — 9.2만 자 · 6파트 · 2026-08-13 (2026-10-04)
- [x] **R99** `char:870` `char:871` · `fl:great_villain_union` · `char:104` `char:404` `char:405` — 9.1만 자 · 8파트 · 2026-08-13~2026-09-24 (2026-10-04)

## 2회독 (P · M) — 층별 (대사 층)

#### 1층 — 240단위 · 382.9만 자 · 53세션 (P1 · M01–M52 → C1)

- [x] **P1 👤 2회독 파일럿** ch00–01 · `relic:어느남자의수기` · ch02 · `sub:칠리페퍼_00` `sub:콜렉터_00` `sub:콜렉터_01` `sub:테트라_커넥트_00` · `relic:생존가이드1` `relic:통화기록017515` · ch03 · `sub:세르반_00` · `relic:방주추첨권` — 4.6만 자 · 13파트 · 2022-11-04
- [x] **M01** ch04 · `sub:트레저_헌터_00` `sub:트레저_헌터_01` `sub:트레저_헌터_02` `sub:트레저_헌터_03` `sub:이례의_기록자_00` `sub:랩칠리언_00` `sub:랩칠리언_01` `sub:랩칠리언_02` `sub:랩칠리언_03` `sub:랩칠리언_04` `sub:랩칠리언_05` `sub:랩칠리언_06` `sub:할아범_00` · `relic:갓데스스쿼드리포트` · ch05 · `sub:중앙_정부_공식__00` `sub:고스트_00` `sub:시리얼_00` `sub:시리얼_01` `sub:산해진미_00` `sub:산해진미_01` · `relic:니케실험대상자모집` `relic:통화기록028594` · ch06 · `sub:세르반_01` `sub:저스틴_00` · `relic:니케실험반대피켓` — 9.1만 자 · 29파트 · 2022-11-04
- [x] **M02** ch07 · `sub:중앙_정부_공식__01` `sub:세르반_02` `sub:스페이드_00` `sub:러블리_드림_00` `sub:러블리_드림_01` · `relic:채팅로그_얼리어답터` · `d_ex_elevator_01` · ch08 · `sub:칠리페퍼_01` `sub:든_셀_00` · `relic:광고팜플렛` `relic:UFO챈.zip` · ch09 · `sub:테디_00` `sub:미실리스_연구팀_00` `sub:미실리스_연구팀_01` `sub:미실리스_연구팀_02` `sub:미실리스_연구팀_03` · `relic:지휘관모집공고` · ch10 · `sub:코리_00` `sub:롬_00` `sub:롬_01` `sub:롬_02` · `relic:어느소녀의수기` · ch11 · `sub:음악_애호가_00` `sub:음악_애호가_01` · `relic:기업-랩쳐음모론` `relic:구시대의플레이리스트` — 9.9만 자 · 31파트 · 2022-11-04
- [x] **M03** ch12 · `sub:숲속요정_00` · `relic:어느의사의수기` · ch13 · `sub:세르반_03` `sub:철도로GO_00` · `relic:여자친구의편지` · ch14 · `sub:칠리페퍼_02` `sub:알콜러버_00` · `relic:기후변화보고서` `relic:인터넷BJ라이브방송녹화분` · ch15 · `relic:종말의서` — 8.7만 자 · 15파트 · 2022-11-04
- [x] **M04** ch16 · `sub:방주_난민_00` `sub:방주_난민_01` `sub:방주_난민_02` `sub:방주_난민_03` · `relic:장보기목록` · ch17 · `sub:제니퍼f_00` · `relic:모바일_보이스피싱_광고_모음.zip` `relic:니케제작보고서요약본` · ch18 · `sub:테트라_커넥트_01` `sub:중앙_정부_공식__02` `sub:김작가_00` · `relic:XX중학교가정통신문` — 9.9만 자 · 17파트 · 2022-11-04~2022-11-24
- [x] **M05** `event_brandnewyear` · ch19 · `sub:데이파라_00` · `relic:데일리아크기사스크랩` · ch20 · `sub:로망티스트_00` · `relic:jonathan_report` · `event_doutsiders` — 7.7만 자 · 9파트 · 2022-12-29~2023-01-12
- [x] **M06** `event_cherryblossom` · ch21 · `sub:에덴_Notice_00` `sub:에덴_Notice_01` `sub:에덴_Notice_02` · `relic:특이랩쳐보고서-전` `relic:특이랩쳐보고서-후` — 6.6만 자 · 9파트 · 2023-03-30~2023-04-27
- [x] **M07** ch22 · `sub:할아범_01` `sub:문구점_00` `sub:중앙정부_트라이앵글_00` `sub:2호_쉘터_관리계정_00` · `relic:에닉탄핵포스터` — 4.1만 자 · 7파트 · 2023-04-27
- [x] **M08** `event_overzone` · `erelic:white_memory` — 6.1만 자 · 4파트 · 2023-04-27
- [x] **M09** `event_bluewaterisland` — 6.4만 자 · 4파트 · 2023-06-15
- [x] **M10** ch23 · `sub:콜렉터_02` `sub:상인연합_달란트_00` · `relic:필그림조우보고서` · ch24 · `sub:해결사_카페_스위티_00` · `relic:긴급뉴스대본_FB_3_final_2.pdf` — 9.0만 자 · 10파트 · 2023-07-20
- [x] **M11** `event_freezeacpu` · ch25 · `sub:중앙정부_프로토콜_00` · `relic:마더웨일아종목격보고.wav` — 6.3만 자 · 6파트 · 2023-10-19~2023-11-02
- [x] **M12** ch26 · `sub:로망티스트_01` `sub:코인_러시_00` · `relic:저주받은보석` — 3.7만 자 · 5파트 · 2023-11-02
- [x] **M13** `event_redash` · `erelic:red_ash_lost` — 9.7만 자 · 6파트 · 2023-11-02
- [x] **M14** `erelic:red_ash_mini` · `event_newyearnewsword` `event_dirtybackyard` — 7.0만 자 · 5파트 · 2023-11-02~2024-01-25
- [x] **M15** ch27 · `sub:피라_00` `sub:피라_01` `sub:피라_02` `sub:트윙클_00` · `relic:잘지내라친구` · ch28 · `sub:택틱컬틱택_00` `sub:택틱컬틱택_01` `sub:핸섬_커맨더_00` `sub:핸섬_커맨더_01` `sub:MMR지킴이_00` · `relic:조난일지` — 9.7만 자 · 15파트 · 2024-02-22
- [x] **M16** `event_boomsday` `event_killthelord` · `side:second_affection` — 9.0만 자 · 6파트 · 2024-02-22~2024-04-11
- [x] **M17** ch29 · `relic:반드시사수하라` · ch30 · `relic:하모니큐브관찰일지` — 6.5만 자 · 6파트 · 2024-04-25
- [x] **M18** `event_lastkingdom1` — 6.9만 자 · 4파트 · 2024-04-25
- [x] **M19** `event_darkhero` `event_beautyfullshot1` — 9.7만 자 · 6파트 · 2024-05-16~2024-07-04
- [x] **M20** ch31 · `relic:말뚝프로젝트보고서` · ch32 · `sub:관짝이_00` `sub:관짝이_01` `sub:관짝이_02` `sub:거울_공주_00` `sub:거울_공주_01` · `relic:수정지역깊은곳어딘가` — 7.9만 자 · 11파트 · 2024-07-25
- [x] **M21** `side:wordless` · ch33 · `relic:소녀의일기-절망편-` — 5.9만 자 · 5파트 · 2024-10-17~2024-10-31
- [x] **M22** ch34 · `relic:충격다크매터란무엇인가` — 4.3만 자 · 4파트 · 2024-10-31
- [x] **M23** `event_oldtales1` · `erelic:old_tales_dialog` `erelic:old_tales_lost` `erelic:old_tales_mini_memory` — 9.6만 자 · 8파트 · 2024-10-31
- [x] **M24** `event_footstepwalkrun1` `event_wisdomspring` — 8.4만 자 · 6파트 · 2024-12-26~2025-01-16
- [x] **M25** ch35 · `relic:알관련전달사항` · ch36 · `relic:할일목록` — 7.0만 자 · 7파트 · 2025-02-20
- [x] **M26** `event_newflavor` · `side:mudfish` · ch37 · `relic:주워갈것들메모` — 9.8만 자 · 8파트 · 2025-03-27~2025-04-24
- [x] **M27** ch38 · `relic:은색액체` — 3.4만 자 · 3파트 · 2025-04-24
- [x] **M28** `event_unbreakablesphere1` · `erelic:unbreakable_sphere_dialog` `erelic:unbreakable_sphere_lost` — 9.8만 자 · 7파트 · 2025-04-24
- [x] **M29** `event_arcanearchive` `event_lordforjustice` — 6.3만 자 · 4파트 · 2025-05-15~2025-05-29
- [x] **M30** `event_ce006` — 9.3만 자 · 5파트 · 2025-06-12
- [x] **M31** `event_overthehorizon` — 2.8만 자 · 2파트 · 2025-07-03
- [x] **M32** `fl:boom_the_ghost`(= `event_boomtheghost1` 본문) — 7.3만 자 · 4파트 · 2025-07-17
- [x] **M33** ch39 · `relic:정갈하게쓴기록` · ch40 · `relic:어떤소녀의그림일기` — 9.7만 자 · 8파트 · 2025-08-07
- [x] **M34** `event_absolute1` — 6.0만 자 · 4파트 · 2025-08-07
- [x] **M35** `fl:coins_in_rush` — 7.3만 자 · 4파트 · 2025-09-04
- [x] **M36** `fl:reborn_evil` · `side:eden_spear` — 9.4만 자 · 5파트 · 2025-09-24~2025-10-16
- [x] **M37** ch41 · `relic:거꾸로적힌기록` — 5.0만 자 · 4파트 · 2025-10-30
- [x] **M38** ch42 · `relic:주의용광로사용법` — 6.7만 자 · 5파트 · 2025-10-30
- [x] **M39** `event_goddessfall1` — 10.0만 자 · 6파트 · 2025-10-30
- [x] **M40** `erelic:goddess_fall_mini` — 2.7만 자 · 2파트 · 2025-10-30
- [x] **M41** `fl:ark_guardian` — 8.1만 자 · 5파트 · 2025-12-30
- [x] **M42** `fl:sin_editor` · ch43 · `relic:아무한테나말해주는거아니야.wav` — 6.9만 자 · 6파트 · 2026-01-15~2026-02-12
- [x] **M43** ch44 · `relic:거인을찾아서` — 7.2만 자 · 6파트 · 2026-02-12
- [x] **M44** `fl:enter_heaven` — 3.7만 자 · 2파트 · 2026-03-05
- [x] **M45** `side:pretty_star` — 6.6만 자 · 4파트 · 2026-04-09
- [x] **M46** `fl:good_world` · ch45 · `relic:신에게닿기위한탑` — 9.0만 자 · 6파트 · 2026-04-09~2026-04-23
- [x] **M47** ch46 · `relic:궤도엘리베이터음모론` — 6.9만 자 · 5파트 · 2026-04-23
- [x] **M48** `event_staranis1` 파트 1–3 — 5.6만 자 · 3파트 · 2026-04-23
- [x] **M49** `event_staranis1` 파트 4–6 — 5.6만 자 · 3파트 · 2026-04-23
- [x] **M50** `fl:ark_ranger` — 8.1만 자 · 5파트 · 2026-06-11
- [x] **M51** `fl:project_matis` — 9.4만 자 · 5파트 · 2026-07-23
- [x] **M52** ch47 · `relic:승리를_부르는_그림자` · ch48 · `relic:불길한_소리.wav` — 6.4만 자 · 6파트 · 2026-08-13

#### 2층 — 67단위 · 219.3만 자 · 27세션 (M53–M79)

- [x] **M53** `char:180` `char:232` `char:202` `char:72` `char:221` — 7.8만 자 · 5파트 · 2022-11-04
- [x] **M54** `char:10` `char:102` `char:130` `char:140` — 8.5만 자 · 5파트 · 2022-11-04
- [x] **M55** `char:220` `char:12` `char:231` `char:110` — 8.6만 자 · 5파트 · 2022-11-04
- [x] **M56** `char:230` `char:222` · `event_nocallerid` `event_hightechtoy` — 6.4만 자 · 4파트 · 2022-11-04~2022-11-24
- [x] **M57** `event_miraclesnow1` · `char:260` · `event_maidinvalentine` · `char:261` — 8.8만 자 · 6파트 · 2022-12-08~2023-03-30
- [x] **M58** `event_ltk` · `char:233` · `event_queensorder` `event_goldenship` — 9.4만 자 · 7파트 · 2023-04-13~2023-07-20
- [x] **M59** `event_seayouagain1` `event_schooloflock` — 8.9만 자 · 5파트 · 2023-08-03~2023-09-21
- [x] **M60** `event_dazzlingcupid` · `char:470` `char:224` · `event_alonesurvivor` — 8.9만 자 · 6파트 · 2023-10-05~2023-11-23
- [x] **M61** `event_neverland1` · `char:225` · `event_lionheart` — 9.6만 자 · 6파트 · 2023-12-07~2024-01-11
- [x] **M62** `event_perfectmaid` `event_onemoretime` · `char:330` — 8.5만 자 · 6파트 · 2024-02-05~2024-04-25
- [x] **M63** `event_goldencoinrush1` — 8.4만 자 · 5파트 · 2024-05-30
- [x] **M64** `event_claymore` `event_juveniledays` `event_colorless` — 9.3만 자 · 6파트 · 2024-06-20~2024-08-08
- [x] **M65** `event_phantomthiefvsdetective` `event_lifeagain` · `char:226` `char:514` — 9.9만 자 · 6파트 · 2024-10-03~2024-11-07
- [x] **M66** `event_secretgarden` — 3.7만 자 · 2파트 · 2024-11-21
- [x] **M67** `event_icedragonsaga1` — 7.1만 자 · 4파트 · 2024-12-05
- [x] **M68** `event_romanticvalentine` `fl:for_rest`(= `event_forrest` 본문) `event_foolburstday` — 9.9만 자 · 7파트 · 2025-01-30~2025-04-01
- [x] **M69** `char:513` `char:162` `char:852` `char:840` · `fl:go_ninja_thief` — 7.4만 자 · 6파트 · 2025-04-24~2025-10-16
- [x] **M70** `fl:blank_ticket` `fl:terminus_ticket` — 7.8만 자 · 5파트 · 2025-11-20~2025-12-04
- [x] **M71** `fl:fatal_maid` `fl:lie_cause_recoil` — 8.5만 자 · 5파트 · 2026-01-29~2026-02-12
- [x] **M72** `fl:2x2_love_1ch` 파트 1–6 — 9.8만 자 · 6파트 · 2026-03-19
- [x] **M73** `fl:2x2_love_1ch` 파트 7–12 — 9.8만 자 · 6파트 · 2026-03-19
- [x] **M74** `fl:2x2_love_2ch` 파트 1–5 — 8.2만 자 · 5파트 · 2026-03-19
- [x] **M75** `fl:2x2_love_2ch` 파트 6–10 · `char:18` — 9.1만 자 · 6파트 · 2026-03-19~2026-04-30
- [x] **M76** `fl:b-side_idol` `fl:bitter_spice` — 5.5만 자 · 4파트 · 2026-05-14~2026-05-28
- [x] **M77** `fl:wave_to_you` — 7.3만 자 · 4파트 · 2026-07-02
- [x] **M78** `fl:persona_on_frontline` — 8.2만 자 · 5파트 · 2026-08-13
- [x] **M79** `fl:great_villain_union` — 3.9만 자 · 3파트 · 2026-09-03

#### 3층 — 174단위 · 225.8만 자 · 25세션 (M80–M104)

- [x] **M80** `char:11` `char:212` `char:430` `char:20` — 8.3만 자 · 5파트 · 2022-11-04
- [x] **M81** `char:101` `char:190` `char:200` `char:82` `char:181` `char:32` — 9.7만 자 · 6파트 · 2022-11-04
- [x] **M82** `char:61` `char:161` `char:141` `char:91` `char:60` `char:431` — 8.8만 자 · 6파트 · 2022-11-04
- [x] **M83** `char:70` `char:80` `char:71` `char:22` `char:432` `char:172` `char:191` — 9.9만 자 · 7파트 · 2022-11-04
- [x] **M84** `char:201` `char:291` `char:241` `char:210` `char:90` `char:160` — 9.2만 자 · 6파트 · 2022-11-04
- [x] **M85** `char:150` `char:171` `char:92` `char:131` `char:30` `char:242` — 9.0만 자 · 7파트 · 2022-11-04
- [x] **M86** `char:170` `char:142` `char:120` `char:352` `char:100` `char:193` — 9.2만 자 · 6파트 · 2022-11-04~2022-12-08
- [x] **M87** `char:203` `char:121` `char:400` `char:401` `char:111` `char:402` — 9.0만 자 · 6파트 · 2022-12-08~2023-01-12
- [x] **M88** `char:112` `char:311` `char:312` `char:800` `char:801` `char:802` · `event_bowwowparadise` — 10.0만 자 · 8파트 · 2023-01-19~2023-03-15
- [x] **M89** `char:381` `char:282` · `event_fullfoolday` · `char:40` `char:392` — 7.3만 자 · 5파트 · 2023-03-15~2023-04-27
- [x] **M90** `event_BunnyX777` · `char:270` `char:271` `char:280` `char:132` — 9.8만 자 · 6파트 · 2023-05-18~2023-06-15
- [x] **M91** `char:14` · `event_nyanyaparadise` · `char:380` `char:350` `char:15` `char:351` — 9.6만 자 · 7파트 · 2023-06-22~2023-08-03
- [x] **M92** `char:353` · `event_firstaffection` · `char:810` `char:812` `char:811` `char:321` `char:450` `char:451` `char:33` — 9.9만 자 · 9파트 · 2023-08-10~2023-10-19
- [x] **M93** `char:192` `char:194` `char:62` `char:382` `char:281` `char:313` `char:310` — 9.1만 자 · 7파트 · 2023-11-23~2024-02-15
- [x] **M94** `char:500` `char:43` `char:822` `char:821` `char:820` · `event_liarsend` · `char:550` `char:361` — 9.2만 자 · 8파트 · 2024-02-22~2024-04-25
- [x] **M95** `char:501` `char:314` `char:195` `char:551` `char:284` `char:283` `char:391` `char:390` `char:833` `char:830` — 9.7만 자 · 10파트 · 2024-05-16~2024-08-22
- [x] **M96** `char:831` `char:832` · `event_jinxplayer` `event_nonsensered` · `char:272` `char:403` `char:580` — 9.4만 자 · 8파트 · 2024-08-29~2024-10-10
- [x] **M97** `char:240` `char:511` `char:411` `char:183` `char:182` · `event_outofuniform` · `char:16` — 9.2만 자 · 7파트 · 2024-10-17~2025-01-01
- [x] **M98** `char:290` `char:354` `char:355` `char:836` `char:835` `char:834` `char:412` `char:520` — 8.0만 자 · 8파트 · 2025-01-16~2025-03-27
- [x] **M99** `event_trueflavor` · `char:521` `char:590` `char:581` `char:41` `char:850` `char:851` — 9.5만 자 · 8파트 · 2025-04-10~2025-06-19
- [x] **M100** `char:532` `char:234` `char:502` `char:93` `char:95` `char:94` `char:315` `char:143` `char:842` — 9.5만 자 · 9파트 · 2025-07-03~2025-09-24
- [x] **M101** `char:841` `char:23` `char:223` `char:331` `char:262` `char:74` `char:75` `char:73` `char:471` — 8.5만 자 · 9파트 · 2025-10-02~2026-01-01
- [x] **M102** `char:582` `char:316` `char:860` `char:862` `char:861` `char:113` `char:583` `char:620` `char:17` `char:441` — 9.9만 자 · 10파트 · 2026-01-15~2026-04-23
- [x] **M103** `char:600` `char:601` `char:570` `char:515` `char:322` `char:103` `char:105` `char:872` `char:870` — 9.9만 자 · 9파트 · 2026-05-14~2026-08-13
- [x] **M104** `char:871` `char:104` `char:404` `char:405` — 4.2만 자 · 4파트 · 2026-08-20~2026-09-24

## 업데이트 (U) — 패치마다 (1회독 · 2회독 함께)

새 패치의 새 단위(docs/update.md "읽기 항목"). U1이 `- [ ] **U01** <키들> — 패치 YYYY-MM-DD · N만 자 · M파트` 모양으로 이 절 끝에 덧붙이고, U4에서 빠진 칸이 0이면 `[x]`로 바꾼다.
`U`는 1회독 · 2회독 순서에 다 든다 — 기록 파일의 `session`은 U 항목 ID. ` — ` 뒤 `패치 날짜`를 검사기(`tools/update/checklist.mjs`)가 읽는다.
늦게 들어온 단위는 ` — ` 뒤에 ``자리 `키` 앞``을 더 단다 — 줄은 여기(읽은 차례), 출시순 한 줄에서는 그 키 앞에 선다(docs/update.md "늦게 들어온 단위").

- [x] **U01** `fl:coin_rush_show_down` — 패치 2026-09-17 · 자리 `char:404` 앞 · 8만 자 · 5파트
- [ ] **U02** `fl:little_witch_trick` — 패치 2026-10-08 · 5.3만 자 · 3파트
- [ ] **U03** `side:gingerbread_house` `char:63` — 패치 2026-10-08 · 9만 자 · 6파트
