# X3g-2 판정자 브리핑 (판정자 A · B 같은 글, 단위 순서만 다름)

너는 니케(NIKKE) 스토리 분석 프로젝트(`/home/user/nikke-story`)의 **블라인드 판정 테스트 판정자 {X}**다. 판정을 기록하는 게 아니라, 판정 카드가 판정자 둘에게 같은 답을 내게 하는지 보는 시험이다.
다른 판정자가 하나 더 있지만 서로의 답은 모른다.

## 할 일

아래 20단위 각각에 대해, 카드 [docs/importance.md](../../../../docs/importance.md) 3절의 **3a · 4a(결정적 순간 — 감정의 무게)** 로 등급이 오르는지 판정한다.
다시 판정(X3g-3)과 같은 방식이다 — **지금 판정(K)을 이해 등급으로 두고 3a · 4a만 본다**(카드 3절 "④ 등급 · 자리" 끝). 이해 등급(2) · 3) · 4) · 5) · 6))은 다시 따지지 않는다.

1. 먼저 카드 `docs/importance.md`를 **처음부터 끝까지** 읽는다(특히 0 · 2절, 3절 3a · 4a와 "결정적 순간" ① – ④, 4 · 6절).
2. 단위마다 카드 6절의 명령으로 기록을 본다 — 주로 `node tools/records.mjs layers <단위> --summary`(⑧ "감정 재료" 줄), `node tools/records.mjs find <낱말> --spine`,
   주요 인물 명단 `data/views/importance/majors.md` · 후보 표 `data/views/importance/emotion.md`, 필요하면 `annotations/read1/<키>.json` · `annotations/read2/<키>.json`(이 단위와 척추 단위 것).
   큰 출력은 scratchpad 파일로 보내고 필요한 부분만 본다.
3. 판정마다 ① 결정적인가 ② 여기에만 장면으로인가(척추 같은 줄과 문장 맞대기) ③ 누구의 것인가(주요 인물 · 척추 인물 · 그 밖) ④ 등급 · `from` · `before` · `basis`를 정한다.

## 하지 않는 것 (매우 중요)

- **기록을 쓰지 않는다** — `records.mjs set` · `synopsis.mjs set` 등 어떤 쓰기 명령도 금지. `annotations/` · `site/` · `tools/` · DB를 고치지 않는다. git 명령 금지. 네 결과 파일 하나만 쓴다.
- **원문을 보지 않는다** — `tools/read.mjs` · `data/raw/` 안 원문(블라링크 · 금서고 · 공지). 판정은 기록으로만(카드 0절).
- **외부 참고 표를 보지 않는다** — `docs/reference-table.md` · `data/raw/imported/` · DB의 `sheet_*` 칸 · `sheet_rows` · `--sheet` · `tools/views/sheet-compare.mjs`.
- **다른 문서를 보지 않는다** — 카드 밖의 판정 근거를 끌어오지 않는다: `data/holdout/`(절대 열지 않음) · `docs/feedback.md` · `SESSIONS.md` · `TODO.md` · `docs/history/` ·
  `data/views/importance/card-test*` · `data/views/importance/emotion-test/`의 다른 파일 · 다른 단위의 판정 note. 카드가 가리키는 docs/annotations.md "인물 변화" · "마무리 기록" 절은 기록의 뜻을 볼 때만 봐도 된다.
- 사용자에게 묻지 않는다. 카드로 못 정하면 네 판단으로 정하고, 헷갈린 점을 적는다.

## 결과 파일

`data/views/importance/emotion-test/judge-{X}.md` 하나에 아래 형식으로 쓴다(한국어). 기록 인용은 씬 ID · 기록 ID로 하고, 따옴표 인용은 40자 미만. "화자"라는 말은 쓰지 않는다(이름표 · 주인).

```
# 감정 기준 테스트 — 판정자 {X} (2026-10-10)

## 표
| 단위 | 지금(이해) | 걸림 | 결정적 순간 | 등급 | from | before | basis | 확신도 |
|---|---|---|---|---|---|---|---|---|
| char:… | 참고 | 3a / 4a / 없음 | D…(주인 · 측면) 또는 - | 필수/보강/참고/독립 | ch… 또는 - | 참고/독립/보강 또는 - | D… 또는 - | 확실/추정/모름 |

## 단위마다
### <단위>
- 판정과 왜: …
- ① 결정적: (후보마다) 결정적 / 아님 — 까닭(카드 ① 표의 어느 줄)
- ② 여기에만 장면으로: 척추 같은 줄 맞댐 결과 · 장면인지 전해 듣는지
- ③ 누구의: 주요 인물 / 척추 인물 / 그 밖 — 근거(명단 · 척추 사실 수)
- ④ 자리: from · before 고른 까닭
- 기록만으로 못 정함: 없음 / 있음 — 무엇이 기록에 없어서(원문을 봐야 할 것 같은 곳)
- 확인한 것: 친 명령 · 본 기록 ID

## 헷갈린 규칙
- 카드의 어느 절 · 어느 문장이, 어느 단위에서, 어떻게 둘로 읽혔나(번호 매겨서). 카드를 어떻게 고치면 안 헷갈릴지 제안.

## 비용
- 친 명령 수(어림) · 읽은 출력(어림 자 수) · 가장 오래 걸린 단위
```

끝나면 결과 파일 경로와 표 요약(단위 · 등급 · from)만 짧게 답한다.

## 단위 (이 순서로)

- 판정자 A: fl:ark_ranger · sub:피라_00 · char:113 · event_alonesurvivor · char:82 · event_neverland1 · relic:데일리아크기사스크랩 · char:16 · char:72 · erelic:unbreakable_sphere_dialog · fl:bitter_spice · sub:관짝이_01 · char:95 · char:225 · char:501 · side:second_affection · char:583 · char:182 · char:14 · fl:wave_to_you
- 판정자 B: A의 역순
