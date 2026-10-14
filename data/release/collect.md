# 증분 수집 리포트

`node tools/blabla/update.mjs` 마지막 실행: 2026-10-14 17:12 UTC. 원문은 싣지 않는다(키 · 개수만).

## 블라링크

- 새 씬 28 — `event_absolute1` 14 · `event_absolute2` 14
- 새 이벤트 1 — `event_absolute1`(씬 28)
- 새 호감도 스토리 5 — 벨로타 : 펌킨 위치
- 앞서 없던 것 중 이번에 받음 0
- 아직 없음 47 — `event_boomtheghost1` 14 · `event_boomtheghost2` 14 · `event_forrest` 15 · `d_nikke_guilty` 1 · `d_nikke_sin` 1 · `d_nikke_quency` 1 · `d_nikke_nihilister` 1

## 금서고

- 사이트 배포 2026-10-12T15:10:36.668Z — 바뀌어 목록을 다시 받았다
- 받은 파일 4 — `event_stories/bitter_spice.txt` · `sub_quests/산해진미.txt` · `lost_relics/니케실험대상자모집.txt` · `lost_relics/지휘관모집공고.txt`
- 매핑에 없는 이벤트 파일 1 — `event_stories/coin_rush_show_down.txt`(COIN RUSH SHOWDOWN) → 매핑에 null로 적고 받았다(블라링크에 없음)

## 금서고 → 블라링크 전환

매핑 null 21건. 후보는 Claude가 두 원문을 대조해 확정하고 매핑의 null을 블라링크 키로 바꾼다(SESSIONS.md N2a).

- 전환 후보:
  - `event_absolute1`(새) ↔ `event_stories/absolute.txt`(ABSOLUTE) — 이름 닮음 1.00 → 원문 대조로 확정(28씬 대 28씬, 대사 79%가 그대로 — 대조군 0.3%).
    기록이 `fl:absolute`로 250곳 넘게 있어 옮기기 전까지 annotations/forbidden-library-pending.json에 두고 블라링크 쪽은 단위로 안 만든다(SESSIONS.md N2a2).
- 매핑에 안 든 블라링크 이벤트(본문 있음) 7 — `event_absolute1` · `event_firstaffection` · `event_fullfoolday` · `event_liarsend` · `event_nonsensered` · `event_outofuniform` · `event_foolburstday`
