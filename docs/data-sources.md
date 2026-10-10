# 데이터 소스 조사 기록 (blablalink.com)

조사일: 2026-09-17 / 조사 대상 번들: `assets/nikke/version/default/assets/index-CGPU0lk3.js`

## 0. 요청 규칙 (반드시 지킬 것 — 수집기를 돌리거나 고칠 때)

CLAUDE.md에서 옮겨 왔다(2026-10-10). 공식 공지 요청(`tools/notices/`)도 같은 태도로 한다 — docs/tools.md "출시 순서".

### 블라링크 CDN

스토리 원문은 blablalink의 공개 CDN(`sg-tools-cdn.blablalink.com`)에서 가져온다.
인증이 없다고 해서 마음대로 긁지 않는다.

1. **동시 요청은 최대 4개.** 수집기를 새로 쓰거나 고칠 때도 이 상한을 넘기지 않는다.
   상수는 `tools/blabla/client.mjs`의 `MAX_CONCURRENCY`이며, 이 값을 올리지 말 것.
2. **로컬 캐시를 항상 우선한다.** `data/raw/`에 이미 받은 파일은 다시 받지 않는다.
   재수집이 필요하면 `--force`를 **명시적으로** 줘야 한다.
3. **재시도는 지수 백오프**(1s → 2s → 4s), 최대 3회. 404는 재시도하지 않고
   누락으로 기록한다 — 실제로 없는 씬이 존재한다.
4. **전량 수집은 한 번이면 된다.** 이후에는 인덱스 diff 기반 증분 수집만 한다.
   원본 스냅샷이 원본 레포(`data/raw/` 서브모듈)에 있으므로 새 세션이라고 다시 받지 않는다.
5. 일회성 확인은 스크립트를 새로 짜지 말고 기존 수집기의 캐시를 읽는다.

### 금서고

블라링크에 없는 스토리 — 사이드 스토리 · 서브퀘스트(메신저) · 유실물 · 이벤트 유실물 · 블라링크에 없는 이벤트 — 는
팬 사이트 니갤 금서고(`nikkeforbiddenlibrary.com`)에서 보조로 가져온다(사용자 결정, 2026-09-28).
개인이 운영하는 사이트이므로 CDN보다 더 조심한다.

1. `tools/forbidden-library/fetch.mjs`로만 받는다. 한 번에 하나씩, 요청 사이 1초, 지수 백오프 3회, 404는 기록만 한다.
2. 받아 둔 파일은 `mainChapterVersion`이 바뀌지 않으면 다시 받지 않는다. 목록은 사이트 배포 시각이 바뀔 때만 받는다.
   원본은 `data/raw/forbidden-library/`에 커밋되어 있다.
3. 블라링크에 있는 단위는 받지 않는다. 블라링크에 원문이 새로 들어오면 `annotations/forbidden-library-events.json`에서
   그 파일의 null을 블라링크 이벤트 키로 바꾼다. 그러면 수집과 DB가 블라링크 원문으로 돌아간다(사용자).
4. 사이트의 AI 질의(`/api/ask`)는 쓰지 않는다.
5. 금서고 원문에는 서술 · 독백 구분과 게임 씬 ID가 없다. 결과에 금서고 출처임을 드러낸다.

### 난독화 규칙이 깨지면

사이트가 재배포되면 경로 규칙이 바뀌어 **전면 404**가 날 수 있다.
수집기가 그렇게 알려오면, 새 번들에서 `createNormalObfuscatedPath` / `getDjb2Mod` /
`generateTwoLetterHash` / `generateTwoNumberHash` / `LARGE_PRIMES`를 다시 뽑아
`tools/blabla/obfuscate.mjs`를 갱신한다. 절차는 아래 "1. 경로 난독화 규칙".

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

**결정 (사용자, 2026-09-28): 블라링크에 없는 스토리는 금서고에서 받는다.** 요청 규칙은 위 "0. 요청 규칙".

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
[뜨거운 갤에 금서고 업데이트](https://m.dcinside.com/board/gov/6279614)(2026-10-06): COIN RUSH SHOW DOWN(9/17 이벤트) · 호감도 길티 : 마이티 바니 ·
신 : 스위프트 바니 · 돌발 둘을 더했다 · 다음 업데이트는 LITTLE WITCH TRICK 에필로그가 나온 뒤 사이드 스토리와 함께. 업데이트는 갤러리
`[⭐정보]` 글로 알린다 — 출시에서 금서고에 오르기까지 이벤트는 몇 주 걸린다(COIN RUSH는 9/17 출시 → 10/06).

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
- 금서고 목록 순서는 확인된 15개의 지역 순서와 거의 같다(세르반만 어긋남). 나머지 29개는 처음엔 유보했다가(2026-09-28) 이 순서로
  보간해 끼웠다 — 사용자: "대략 그 위치면 적절"(2026-09-29). **나무위키로 대체됨**(2026-10-10, 아래) — 목록 순서는 시리즈 첫 편의
  자리에 가까울 뿐이고, 편이 여럿인 시리즈(랩칠리언 3~17 · 트레저 헌터 3~16 · 볼트 주니어 9~20 등)는 챕터에 흩어져 있었다.

### 서브퀘스트 지역 — 나무위키 "서브 퀘스트 스토리" (2026-10-10, 사용자가 복사해 준 참고)

나무위키 「승리의 여신: 니케/스토리」의 "8. 서브 퀘스트 스토리" 절은 챕터마다 서브퀘스트 이름을 적은 목록이다(2026년 5월 기준 86개, 2~32챕터).
나무위키는 자동 접근이 안 돼(아래 요청 기록) 사용자가 붙여 넣었고, 원문은 원본 레포 `data/raw/sources/namuwiki-subquests.txt`에 뒀다.

- 짝짓기: 나무위키는 퀘스트 이름(`트레저 헌터가 알려준 장소 조사` · `볼트 주니어 수색`)이고 우리 씬은 발신자 시리즈다. 발신자 이름 · 내용 낱말(촬영 · 사진 · 그네 ·
  고구마 · 탈주 등)과 시리즈 안 순서로 86 ↔ 86을 1:1로 맞췄다. 이름이 다른 발신자: 테트라 커넥트 = 영상 촬영 · 이례의 기록자 = 사진 촬영 ·
  든 셀 = 수상한 메시지 · 미실리스 연구팀 = 볼트 주니어 · 에덴 Notice = 이사벨 · 요한 · 피라 = 라피 · 트윙클 = 아니스 · MMR지킴이 = 에테르 ·
  관짝이 = 그레이브 · 거울 공주 = 신데렐라.
- 결과: 지역 파일의 챕터를 전부 나무위키로 맞췄다(`namu` 필드). 보간 자리 53편 중 40편, 디시 글 하나에 두 편이 묶였던 2편(음악 애호가 둘째 편 11 → 26 ·
  피라 첫 편 27 → 26)이 옮겨졌다.
- 나무위키와 다르게 둔 것: 카페 스위티는 디시 "24지"를 따른다(나무위키는 23챕터에 넷째로 넣었는데 24챕터만 둘이라 옮겨 적은 실수로 봄).
  관짝이 · 거울 공주 첫 편은 지역 31(두 출처 일치)이지만 내용상 CH.32 뒤에 읽는다(R47). 택틱컬틱택은 나무위키에서 26챕터 뒤에 "[25챕터]"로
  따로 붙어 있어 25로 본다(25챕터가 셋이 된다). 챕터마다 셋씩이라는 짜임이 이 판단의 근거다.
- 요청: 목록 1 + 시리즈 글 44 + 파트 글 4(형식 확인) + 스크린샷 1, 한 번에 하나 · 2초 간격.

### 요청 기록

- 조사(2026-09-28): 금서고 페이지 · 번들 · 목록 · 원문 3개 등 8회, 디시인사이드 글 2회, 블라링크 탐침 47회.
- 수집(2026-09-28): 배포 시각 · 목록 + 원문 136파일(누락 0), 한 번에 하나 · 1초 간격. 앱 번들 2회(챕터 정보 확인, 없음).
  나무위키 · 영문 팬 위키 각 1회 → Cloudflare 봇 확인 페이지(403)라 그만뒀다. 나무위키 서브퀘스트 목록은 사용자가 복사해 줬다(2026-10-10, 요청 0).

## 9. 캐릭터 이미지 — 팬 DB 조사 (2026-10-10)

사이트에 게임 이미지를 실어도 되게 바뀌었다(사용자, 2026-10-10 — CLAUDE.md "저작물 취급"). 실장 니케는 블라링크 쪽 데이터로 얻을 수 있고,
문제는 **비실장 NPC**(잉그리드 · 앤더슨 · 슈엔 · 지휘관 · 이벤트 단역 등)다. 아카 니케 채널 "유용한 사이트 모음집"(2026-06-12)이 소개한 니케 DB 두 곳과 나무위키를 봤다.
NPC 이미지는 **128px 아이콘이면 충분**하다(사용자, 2026-10-10).

| | nikke-db | NKAS | 나무위키 |
|---|---|---|---|
| 주소 | `nikke-db.pages.dev`(프런트) → 에셋 `nikke-db-legacy.pages.dev` = GitHub `Nikke-db/Nikke-db.github.io`(공개, 7259파일) | `nkas.pages.dev` · `nkas-l2d.pages.dev` · `nkas-gallery.pages.dev`, 소스 비공개 | `namu.wiki` · 이미지 `i.namu.wiki` |
| 진입 | `git clone --depth 1` 한 번으로 통째(프록시 통과 확인). 인증 · 봇 차단 없음, CORS `*`. **없는 파일도 200(HTML)** — content-type으로 판단 | curl 그대로, CORS `*`. `/data/`가 공개 JSON · 경로 안내 | 대화형 Cloudflare Turnstile — 자동 접근 불가(일부러 뚫지 않는다). 덤프 없음, robots `Disallow: /` 뒤 `/w/` 등만 허용 |
| NPC | c9xx 약 130명. 아이콘 `images/sprite/si_{id}_00_s.png`(128²) 131개 | c900 이상 135명. 전신 · 256×476 · 128² 투명 PNG | 주요 NPC 개별 문서 있음(이미지는 못 봄) |
| 한국어 이름 | `src/utils/json/l2d.json`(nikke-db-vue) 740항목 중 433에 ko — NPC 보강 중 | 영어만 | 한국어 |
| 그 밖 | 스토리 CG 약 324(파일 이름 = 게임 에셋 이름 `EventScene_Chap_45_01_1`), 4컷 한국어판 53, Spine 모델. `characterProfiles.json`은 위키 LLM 요약 → 쓰지 않음 | CG 1035 · 이벤트 씬 목록 115 · OST 890곡 · 챕터 표지 | 챕터 줄거리 · 작중 행적 — 분석 입력 아님 |
| 조건 | 코드 WTFPL, 에셋 LICENSE 없음(시프트업 저작물) | **재배포 · 수정 금지**, 복제 사이트용 핫링크 금지(credits · `/data/`) | 본문 CC BY-NC-SA 2.0 KR, 이미지 권리는 시프트업 |

- **W11에서 바뀜**(2026-10-10): nikke-db 레포에 실장 니케 아이콘(`si_c{resource_id}_00_s.png`)도 다 있어(156/156) 블라링크 쪽을 따로 찾지 않고 **실장 · NPC 모두 nikke-db**에서 받는다. 레포 클론 대신 필요한 아이콘만 `raw.githubusercontent.com`에서 받는다(`tools/site/portraits.mjs`, 동시 4 · 받은 것은 건너뜀). 이름표 `l2d.json`은 `data/normalized/nikke-db/`에 캐시 — docs/views.md "인물 아이콘".
- **정함**: NPC 아이콘은 **nikke-db**에서 — 공개 레포 한 번 받고 이후 증분(CDN 규칙 2 · 4와 같은 태도), 한국어 이름이 있어 이름표와 잇기 쉽다. 큰 그림은 Spine 조각이라 렌더가 필요해 하지 않는다.
- NKAS는 재배포를 명시적으로 막아 다시 올리지 않는다(참고만). 나무위키는 인물 문서 링크 정도.
- 스토리 CG ↔ 씬: 우리 원문에 `EventScene_*`는 호감도 스토리의 6종뿐이라 자동으로 못 잇는다(챕터 번호로 대략만).
- 단역 전부는 어느 쪽에도 없다 — 이미지 없는 인물은 이름만.
- 요청: 아카 글 1(헤드리스) · nikke-db 레포 클론 2 + 샘플 10여 · NKAS 25 남짓 · 나무위키 6(전부 Turnstile) — 한 번에 하나.

## 10. 기업 · 스쿼드 마크 (2026-10-10 조사)

인물에 소속 마크를 함께 보이려고 조사했다(사용자). 데이터 · 이미지 모두 **블라링크**에서 얻는다 — 팬 DB는 쓰지 않는다.

- **소속 데이터**(이미 받은 원문): `nikke_list_v2.json` · `roledata/*-v2-ko.json`의 `corporation` — `ELYSION` · `MISSILIS` · `TETRA` · `PILGRIM` · `ABNORMAL`, 실장 202명 전원.
  `corporation_sub_type: "OVERSPEC"`은 필그림 23명 전원과 기업 니케 4명. 스쿼드는 roledata `squad_detail`(`squad_name` 한국어 · `squad_description` · `resource_id` 아이콘 ID)과 `teammate_list`(같은 스쿼드 니케) — 65종.
  콜라보 스쿼드 14종(NERV · 요르하 · 찻집 리코리코 …)은 아이콘이 모두 `icn_abnormal`. 이름이 `-`인 스쿼드 하나(`icn_777`)가 있다.
- **이미지**(CDN, 수집기와 같은 난독화 — `obfuscatePath(논리 경로)`): 모두 투명 바탕 흰 마크라 어두운 바탕 · 반전이 필요하다.

| 논리 경로 | 크기 | 비고 |
|---|---|---|
| `icon/atlas_common_corp/icn_corp_0N.png` | 128² | 01 엘리시온 · 02 미실리스 · 03 테트라 · 04 필그림 · 05 앱노멀 — 사이트 번들 `icon-*.js`의 대응 |
| `icon/atlas_common_corp/img_logo_{corp 소문자}.png` | 400² | 글자 든 로고 |
| `icon/squad/{squad_detail.resource_id}.png` | 256² (`icn_absolut` 320×160) | 사이트 화면은 안 쓰지만 CDN에 있다. 5종 확인 |

- 사이트 번들의 경로 함수: `ICONS_URL({path,name})` → `/icon/{path}/{name}.png|webp`. 다른 아틀라스는 `atlas_common_class`(클래스 · 원소 · 버스트) · `atlas_common_grade`. 스쿼드 경로는 번들에 없어 추측으로 찾았다(`icon/squad/` — `atlas_common_squad` 등은 404).
- nikke-db에는 `images/manufacturer/icn_corp_{elysion|missilis|pilgrim|tetraline}.png` 4개뿐(앱노멀 · 스쿼드 없음) — 쓰지 않는다.
- **한계**: 게임 데이터는 실장 니케의 **현재** 소속만 준다. 비실장 인물의 소속과 작중 소속 이동은 원문 해석 기록(사실 · 변화 D `소속`)에서 와야 한다.
- 요청: 블라링크 페이지 1 · 번들 6 · CDN 이미지 14(404 5) · nikke-db 파일 목록 1 — 한 번에 하나, 1초 간격.
- **받기**(W12a, 2026-10-10): `node tools/blabla/marks.mjs` — 기업 5 + 스쿼드 아이콘 52(`icn_abnormal`은 콜라보 14종이 같이 씀) = 57개 모두 200, 404 0. `site/img/orgs/`(0.64MB). 동시 4 · 받은 것 건너뜀 · 백오프 3회 · 404 기록.
  게임 코드 → 사전 조직 대응과 기록 형식은 docs/annotations.md "소속 기록", 화면은 docs/views.md "소속 마크".

## 11. 스토리 종류 아이콘 (2026-10-10 조사)

감상 순서의 종류 글자를 그림으로 바꾸려고 찾았다(쓰는 법은 docs/views.md "스토리 종류 아이콘").

- **인게임 종류 아이콘은 어디에도 없다** — nikke-db 레포(UI 아이콘은 기업 · 클래스 · 등급 · 무기뿐, `images/gallery/albums/album_*`는 쥬크박스 앨범 표지) · NKAS `/data/` · Fandom 위키 · 블라링크 CDN 추측 경로 12개(`atlas_field/icn_field_subquest` 등) 모두 404 · 해당 없음.
- **블라링크 웹 번들**의 스토리 화면 탭 아이콘(단색 SVG, `assets/svg/icon-*.svg`): 메인 `icon-story` · 돌발 `icon-encounter`(필름) · 아카이브 `icon-archives`(모래시계). 돌발 필름만 썼다.
- 블라링크 `assets/nikke/version/default/mask-icon.png`(512², 블라블라링크 로고) — 서브퀘스트에 썼다.
- 유실물 필드 마커(주황 역삼각형 + 돋보기)는 nikke.gg가 잘라 둔 그림뿐 — 받아 싣지 않고 같은 모양을 새로 그렸다.
- 돌발 건물 썸네일 `icon/album/outpost/img_album_structure_{건물}.png`(256², `sudden_list.json` `sub_category_thumbnail`)는 건물마다 달라 종류 표시로 안 썼다.
- 요청: blablalink.com 약 35(페이지 · 번들 · SVG · 아이콘) · CDN 15(404 12) · GitHub 클론 2 · NKAS 1 · Fandom API 6 · nikke.gg 3 — 한 번에 하나.
