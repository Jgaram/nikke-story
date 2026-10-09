# 데이터 소스 조사 기록 (blablalink.com)

조사일: 2026-09-17 / 조사 대상 번들: `assets/nikke/version/default/assets/index-CGPU0lk3.js`

## 결론

blablalink의 **Shifty's Pad**(`/shiftyspad/scene-list`)가 니케 스토리를 게임과 동일한
카테고리 체계로 서비스한다. 데이터는 API가 아니라 **CDN 위의 정적 JSON**이며,
로그인·토큰·쿠키가 전혀 필요 없다. 다만 **URL 경로가 난독화**되어 있어서
그 규칙을 재현해야 접근할 수 있다. 규칙은 해독했고 동작을 확인했다.

## 1. 경로 난독화 규칙

원본 논리 경로(예: `scene/ko/scene_list.json`)를 다음과 같이 변환한다.

```
base = https://sg-tools-cdn.blablalink.com

마지막 세그먼트(파일명) : md5(전체 논리 경로) + "." + 확장자
그 앞 디렉터리 세그먼트 : twoLetterHash(전체 경로, LARGE_PRIMES[i]) + "-" + twoNumberHash(전체 경로, LARGE_PRIMES[i])

LARGE_PRIMES = [224737, 1000639, 2654435761, 2654435769, 1000621, 4294967291]

djb2(s, seed)          : h = seed; 각 문자마다 h = (h*33 + charCode) & 0xFFFFFFFF   // int32 signed
normalize(s, m)        : ((djb2(s, m) % m) + m) % m
twoLetterHash(s, m)    : r = normalize(s,m); chr(97 + floor(r/26)%26) + chr(97 + r%26)
twoNumberHash(s, m)    : String(normalize(s,m) % 99).padStart(2, "0")
```

검증 예:
`scene/ko/scene_list.json` → `https://sg-tools-cdn.blablalink.com/bn-93/je-48/b9acae699077f9d79a3508a1373bafc0.json` → **200, 253KB**

구현: [`tools/blabla/obfuscate.mjs`](../tools/blabla/obfuscate.mjs)

> 번들에는 `spine` 경로용 별도 규칙(`createSpineAnimationPath`, 파일명만 md5)도 있으나
> 스토리 텍스트에는 쓰이지 않는다.

## 2. 언어 처리

경로 템플릿의 `{lang}` / `{l_lang}`은 로케일로 치환된다.
**한국어는 예외로, 치환 후 문자열에서 `_ko`를 제거한다.**

| 템플릿 | ko | en |
|---|---|---|
| `/scene/{lang}/scene_list_{lang}.json` | `/scene/ko/scene_list.json` | `/scene/en/scene_list_en.json` |

ko / en / ja / zh 모두 응답이 존재한다.

## 3. 사용 가능한 리소스 (전부 200 확인)

### 스토리
| 논리 경로 | 내용 | 규모 |
|---|---|---|
| `/scene/ko/scene_list.json` | 메인 스토리 목록 | 49개 챕터 / **732 씬** |
| `/scene/ko/sudden_list.json` | 돌발(이벤트) 스토리 목록 | 27개 카테고리 / **301 씬** |
| `/archive/ko/archive_list.json` | 아카이브 (이벤트 스토리 본체) | 62 항목 / **1,144 씬** |
| `/scene/ko/scene_detail_{scenario_group_id}.json` | **씬 본문 대사 전체** | 씬당 1파일 |
| `/attractscene/{group_id}-ko.json` | 캐릭터별 호감도 스토리 본문 | 945편 |
| `/roledata/{resource_id}-v2-ko.json` | 캐릭터 상세 — **`attractive_scenario_list`에 호감도 스토리 목록과 선행 조건** | 202명 |
| `/scene/voice_map/{id}.json` | 대사↔음성 매핑 | — |

### 인물 · 기타
| 논리 경로 | 내용 | 규모 |
|---|---|---|
| `/character/ko/nikke_list_v2.json` | 니케 목록 (사이트가 실제로 쓰는 것) | 202 |
| `/character/ko/nikke_list.json` | 니케 목록 (구버전) | 155 |
| `/character/character_id_map.json` | 캐릭터 ID 매핑 | 1,972 |
| `/character/scene_characeter_list_v2.json` | 씬 등장 캐릭터 | 1,625 |
| `/character/ko/character_face_list.json` | 표정 리소스 | 521 |
| `/stage/stage_list.json` | 스테이지 | — |

## 4. 데이터 형태

### `scene_list.json` — 카테고리 → 씬
```jsonc
[{
  "id": 1,
  "category_group_id": 1000,                         // 1000 = 메인 스토리
  "sub_category_name_localkey": { "chapter_name": "추락" },
  "sub_category_id": { "scenes": { "value": [
      { "value": { "id": 1,
                   "scenario_group_id": "d_main_01_01_s",   // ← 씬의 canonical ID
                   "is_hidden": true },
        "scenario_name_localkey": { "scenario_name": "첫 번째 접촉 : A" } }
  ]}}
}]
```

### `scene_detail_d_main_01_01_s.json` — 씬 본문
```jsonc
{
  "id": 1,
  "scene_name": "첫 번째 접촉 : A",
  "scenario_group_id": { "value": "d_main_01_01_s", "records": { "value": [
    { "value": { "id": "d_main_01_01_s_1", "speaker": "marian", "speech_window": "Speech" },
      "quest_name": "BA-01다운!\nBA-01다운!",                       // ← 대사 본문
      "speaker": { "name_localkey": { "character_name": "마리안" } } }
  ]}}
}
```

주의할 점:
- **대사 본문 필드 이름이 `quest_name`이다.** 스키마 오해 유발 지점.
- 모든 값이 `{ value, ... }` 래퍼로 한 겹씩 감싸여 있다. 정규화 필수.
- `scenario_group_id`가 사실상 씬의 안정적 키다. 메인은 `d_main_CC_SS_s`,
  이벤트는 `event_*` 패턴.
- 카테고리 이름은 `sub_category_name_localkey.chapter_name`에 있다.
  `sub_category_name` 같은 필드는 없다 — 잘못 읽으면 이름이 비어 있는 것처럼 보인다.
- 일부 응답(`archive_list.json` 등)에 **BOM**이 붙어 온다. `JSON.parse` 전에 제거해야 한다.

## 5. 수집 규모 (실측)

| 출처 | 씬 수 | 비고 |
|---|---:|---|
| 메인 (`scene_list`) | 732 | 49챕터 |
| 돌발 (`sudden_list`) | 301 | `d_ex_*` 패턴 |
| 아카이브 (`archive_list`) | **1,144** | 겹치는 씬 0개 — 전부 신규 |
| **합계** | **2,177** | 실제 수집 2,134 (43건은 CDN에 없음) |
| 캐릭터별 호감도 스토리 | 945 | 189명 × 5편, 별도 경로 |

**아카이브가 이벤트 스토리 본체다.** `archive_list.json`은 62개 이벤트 항목 안에
씬 목록을 중첩해 품고 있고, 그 1,144개 씬은 메인·돌발과 **하나도 겹치지 않는다**.
아카이브를 빼면 이벤트 스토리 전체가 통째로 빠지므로, 수집 대상에서 제외하면 안 된다.

`scenario_group_id` 패턴 분포:

| 패턴 | 개수 | 뜻 |
|---|---:|---|
| `d_main_#_#` / `_s` / `_e` | 582 | 메인 (s=시작, e=종료 컷신) |
| `d_main_#af_#`, `d_main_#_af_#` | 143 | 메인 후일담 |
| `d_ex_*` | 다수 | 돌발 (`d_ex_gym_01` 등) |
| `event_*` | 다수 | 이벤트 (`event_nocallerid_01_s` 등) |

일부 콜라보 이벤트 씬(예: `event_ce01_*`)은 인덱스에는 있지만 CDN에 파일이 없다.
누락은 정상이며 수집기가 리포트로 남긴다.

## 5-1. 캐릭터별 호감도 스토리 (별도 경로)

니케마다 호감도 레벨로 열리는 개인 스토리 5편. 데이터 이름은 `attractive`, 코드에서는 `episode`(`ep:`).


씬(`scene_detail_*`)과 다른 계통이다. 스키마도 다르다.

```
/roledata/{resource_id}-v2-ko.json
  → attractive_scenario_list[]
      attractive_scenario_group_id  "d_nikke_emma_02"
      scenario_title_locale         "죄의식"
      attractive_level              3
      condition_scenario_group_id   "d_nikke_emma_01"   ← 선행 편

/attractscene/{attractive_scenario_group_id}-ko.json
  → records[] { id, group_id, speech_window, scenario_localkey, set_start_camera, ... }
```

- **대사 본문 필드가 `scenario_localkey`다.** 씬 쪽의 `quest_name`과 다르다.
- `resource_id`가 키다. `nikke_list_v2`의 `id`나 `name_code`로는 404가 난다.
- 189명 × 정확히 5편 = 945편. 그중 **756편에 선행 조건이 붙어 있다.**
- `costume`은 전부 0이고, 애장품에 걸린 시나리오는 없다.

애장품은 `/equip/favorite_rare_map.json`(SSR 21종) + `/equip/{lang}/favorite_{id}.json`으로
이름·설명·스탯만 받을 수 있다. **대사 데이터는 존재하지 않는다.**

카테고리별 커버리지 전체는 [coverage.md](coverage.md) 참고.

## 6. 유의 사항

- 공개 CDN이고 인증이 없지만, **동시 요청 수를 제한하고(≤4) 로컬 캐시를 우선**해
  불필요한 재요청을 하지 않는다.
- 난독화 규칙과 번들 해시(`index-CGPU0lk3.js`)는 사이트 배포 시 바뀔 수 있다.
  수집기는 404가 연속되면 **규칙 재추출이 필요하다고 알려야 한다**(→ TODO T6-2).
- 원문 대사는 저작물이다. 개인 분석 용도로만 보관하고 재배포하지 않는다.

## 7. 공식 공지 (출시 순서, T3-7)

게임 데이터에는 출시일이 없어서, 공개 순서는 공식 공지(패치노트)에서 뽑는다. 방식은 nikke-analysis의
`collect/notices.py`(official)를 Node로 옮겼다. 네이버 라운지는 쓰지 않는다(사용자, 2026-09-28).

- 공식 사이트 nikke-kr.com의 소식은 Level Infinite information-feeds CMS가 JSON POST로 준다.
  `https://na-community.playerinfinite.com/api/gpts.information_feeds_svr.InformationFeedsSvr/{GetLabelList|GetContentByLabel|GetContentInfoById}`,
  헤더 `X-GameId: 16` · `X-AreaId: na` · `X-Source: pc_web` · `X-Language: ko` · `Origin: https://www.nikke-kr.com`가 없으면 빈 답이 온다.
- 칼럼 `official_news`(309) 아래 `NOTICE`(892) · `NEWS`(496). id는 칼럼 이름으로 찾고, 못 찾으면 이 값을 쓴다.
- 2026-09-28 기준 283건(2022-07 ~), 원본 12MB. `data/raw/notices/official/<content_id>.json` + `index.json`.
- 알려진 공백: 2022-12-08 업데이트 공지(MIRACLE SNOW · 네베 · 루피:윈터 쇼퍼 · 앤:미라클 페어리)는 공식 사이트에 없다.
  2023 · 2024 만우절(FULL FOOL DAY · LIAR'S END)도 첫 개방 공지가 없다. `annotations/release-overrides.json`으로 채운다.
  만우절 이벤트는 언제나 4월 1일에 열린다(사용자, 2026-09-28).

## 8. 금서고 — 보조 출처 (니갤 금서고, nikkeforbiddenlibrary.com)

**결정 (사용자, 2026-09-28): 블라링크에 없는 스토리는 금서고에서 받는다.** 요청 규칙은 CLAUDE.md "금서고 요청 규칙".

- 받는 것: 사이드 스토리 5 · 서브퀘스트 44 · 유실물 55 · 이벤트 유실물 9묶음 전부, 이벤트는 블라링크에 원문이 없는 것만
  (23파일 = 22개. BOOM! THE GHOST! · FOR REST는 블라링크 아카이브 목록에는 있는데 원문이 404라 금서고 원문을 쓴다).
- 안 받는 것: 메인 · 돌발 · 호감도 스토리 · 블라링크에 원문이 있는 이벤트(블라링크가 원본이다).
- **블라링크가 이긴다.** 금서고 이벤트 파일 → 블라링크 이벤트 키 매핑은 `annotations/forbidden-library-events.json`.
  블라링크에 원문이 새로 들어오면 null을 그 키로 바꾼다 → 수집기는 그 파일을 건너뛰고 정규화는 블라링크 원문을 쓴다(사용자).

### 운영자가 밝힌 것

니케 마이너 갤러리 글 [니갤 금서고 오픈했습니다.](https://m.dcinside.com/board/gov/5167267)(2026-04-17) ·
[금서고 업데이트했음](https://m.dcinside.com/board/gov/5344857)(2026-05-07):
스토리 떡밥을 찾으려고 만들었다 · **게임에서 직접 본 스토리를 올린다**(블라링크를 거치지 않는다) · 새 스토리는 운영자가 보면
올라가고, 이벤트는 에필로그까지 본 뒤 올린다 · 콜라보는 스텔라 블레이드 이후만 · 호감도 스토리는 조금씩(콜라보 니케 제외) ·
2X2 LOVE는 선택지 분기까지 구현.

### 사이트 구조 (2026-09-28, 사이트 배포 `2026-09-19T03:08:31Z`)

정적 React 앱이고 인증이 없다.

| 경로 | 내용 |
|---|---|
| `/app-version.json` | 사이트 배포 시각. 바뀔 때만 목록을 다시 받는다 |
| `/script-manifest.json` | 전체 목록 4,014항목. 항목 = `{id, title, categoryKey, subTitle, mainChapterFile, mainChapterVersion}` |
| `/scripts/{categoryKey}/{mainChapterFile}?v={mainChapterVersion}` | 원문. 단위(이벤트 · 인물 등)마다 텍스트 파일 하나, CRLF. 버전 해시가 바뀐 파일만 다시 받는다 |
| `/api/ask` | 원문을 근거로 답하는 AI 질의 — 쓰지 않는다 |

카테고리: `main_story`(49파일, 우리와 같음) · `event_stories`(77) · `side_stories`(5) · `sub_quests`(44) · `lost_relics`(55) ·
`event_lost_relics`(9) · `outpost_stories`(27, 돌발과 거의 같음) · `character_episodes`(163, 우리가 30명 많음).
목록 · 앱 코드 어디에도 서브퀘스트 · 유실물의 챕터 정보는 없다(TODO.md 결정 #9).

### 원문 형식과 정규화

`@@@SCRIPT_ID` · `@@@SUB_TITLE`로 하위 챕터가 나뉘고, `이름표: 대사` 줄과 태그(`[CHOICE_START]` · `[OPTION TEXT=…]` ·
`[MESSENGER_START …]` · `[MSG SENDER=…]` · `[NEXT_ROUTE …]`)로 이루어진다. 정규화는 `tools/normalize/library.mjs`,
키 · 창 종류는 [schema.md](schema.md). 요점:

- 이름표 없는 줄은 **서술과 독백이 구분되지 않는다** → `window = Unknown`. 서술로 몰아 넣지 않는다.
  NO CALLER ID 한 편에서 서술 46줄 · 독백 33줄이 구분 없이 합쳐진다. 2회독에서 "지휘관의 인식"과 "객관적 지문"을 가리는 근거가 약하다.
- 선택지 1개짜리 `[OPTION]` = 지휘관이 하는 말(`Self`). 메신저에서는 지휘관이 보낼 말이 `[MSG]` 안의 선택지다.
- 게임 씬 ID가 없다. 키는 금서고 파일 이름 + 파일 안 순서(`fl:absolute_03`), 금서고 ID는 `stories.source_ref`.
- 말줄임표가 `···`(U+00B7 셋)이다. 블라링크는 `…`. 검색할 때 둘 다 본다.
- `ABSOLUTE [ACTION]: END` 같은 연출 명령이 대사 자리에 새어 나와 있다 → `window = Action`(71줄).
- 원문이 깨진 곳 3곳(2026-09-28): `fl:sin_editor_12`(원문 1955줄) · `sub:테트라_커넥트_01`(272 · 276줄)의 `[CHOICE_END]` 빠짐 · 짝 안 맞음,
  2X2 LOVE 1부(원문 6961줄)의 `VALUE="sxp9_t1]`(따옴표 빠짐 — 파서가 받아 준다). 빌드가 줄 번호와 함께 알린다.

### 원문 출처 추정

NO CALLER ID를 우리 원문과 줄 단위로 맞춰 봤다(481줄): 말줄임표를 통일하면 **480줄이 글자까지 같다.**
말줄임표 문자가 다르므로(블라링크 `…` ↔ 금서고 `···`) 블라링크를 변환한 것은 아니고, 연출 명령 줄이 섞인 것으로 보아
게임 클라이언트가 받는 데이터를 뽑는 것으로 보인다(추정, 운영자는 방법을 밝히지 않았다). 정확도는 블라링크보다 한 단계 낮게 본다.

### 커버리지 대조 (2026-09-28)

- 금서고에만 있는 이벤트 22: ABSOLUTE · COINS IN RUSH · REBORN EVIL · GO! NINJA THIEF! · BLANK TICKET · TERMINUS TICKET ·
  ARK GUARDIAN · SIN EDITOR · FATAL MAID · LIE CAUSE RECOIL · ENTER HEAVEN · 2X2 LOVE(1부 · 2부) · GOOD WORLD · B-SIDE IDOL ·
  BITTER SPICE · ARK RANGER · WAVE TO YOU · PROJECT MATIS · PERSONA ON FRONTLINE · GREAT VILLAIN UNION + BOOM! THE GHOST! · FOR REST.
- 양쪽 다 없는 이벤트 7: Re:CIPE FOR YOU · YOU CAN (NOT) EVADE. · SECOND QUEST · YES, MY COMMANDER · CHOCOLATE, PLEASE! ·
  FOOL METAL PANIC! · COIN RUSH SHOWDOWN (스토리 없는 미니게임 이벤트일 수 있다, 확인 안 함).
- 우리한테만 있는 이벤트 6: FIRST AFFECTION · FULL FOOL DAY · LIAR'S END · NONSENSE RED · OUT OF UNIFORM · FOOL BURST DAY.
- 블라링크 탐침: 금서고 이벤트가 블라링크 CDN에 숨어 있는지 `scene_detail_event_{짐작}_prologue`로 46개를 확인했다
  (한 번에 하나, 1초 간격) → 전부 404, 받아 둔 인덱스에도 흔적이 없다. 대조군 `event_staranis1_prologue`는 200.

### 서브퀘스트 지역 — 디시 "서브 퀘스트 모음" (2026-09-28, 사용자가 준 참고)

[승리의 여신 니케 서브 퀘스트 모음](https://m.dcinside.com/board/gov/2521808)(니케 마이너 갤러리, 2025-01-07)은 서브퀘스트 44개의
시리즈 글 목록이다. 시리즈 글마다 파트 글 링크가 있고, **15개는 파트 제목에 지역이 있다**(`02지-칠리페퍼-01`, `22지 서브퀘 A (1)`).
나머지 29개의 파트 글은 메신저 스크린샷뿐이라 지역이 없다(제목 · 본문 모두). N지 = N지역 = CHAPTER.N의 캠페인 필드로 본다.

- 옮긴 결과: `annotations/subquest-regions.json` — 씬마다 챕터 · 확신도 · 근거(시리즈 글 주소 · 파트 제목).
- 디시 파트(상/하 · -1/-2)는 이야기 단위로 묶어 우리 씬 순서에 맞췄다. 관짝이만 디시 두 묶음(31지 · 32지) ↔ 우리 세 편이라 분량으로 맞춘 추정이다.
- 금서고 목록 순서는 확인된 15개의 지역 순서와 거의 같다(세르반만 어긋남) — 금서고 순서가 게임 순서에 가깝다는 방증이다.
  나머지 29개는 처음엔 유보했다가(2026-09-28) 이 순서로 보간해 끼웠다 — 사용자: "대략 그 위치면 적절"(2026-09-29, `basis: 목록 순서`).
- 요청: 목록 1 + 시리즈 글 44 + 파트 글 4(형식 확인) + 스크린샷 1, 한 번에 하나 · 2초 간격.

### 요청 기록

- 조사(2026-09-28): 금서고 페이지 · 번들 · 목록 · 원문 3개 등 8회, 디시인사이드 글 2회, 블라링크 탐침 47회.
- 수집(2026-09-28): 배포 시각 · 목록 + 원문 136파일(누락 0), 한 번에 하나 · 1초 간격. 앱 번들 2회(챕터 정보 확인, 없음).
  나무위키 · 영문 팬 위키 각 1회 → Cloudflare 봇 확인 페이지(403)라 그만뒀다.
