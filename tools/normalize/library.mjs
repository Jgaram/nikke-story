/**
 * 금서고(nikkeforbiddenlibrary.com) 원문 → 정규화 행 (categories · stories · lines).
 *
 * 블라링크에 없는 스토리의 보조 출처다(CLAUDE.md "금서고 요청 규칙", docs/data-sources.md "금서고").
 * 원문은 사이트 자체 형식의 텍스트이고, 하위 챕터 하나를 씬 하나로 본다:
 *
 *   @@@SCRIPT_ID: …  /  @@@SUB_TITLE: …     하위 챕터의 시작
 *   [SCENE START] … [SCENE END]
 *   이름표: 대사                              이름표 없는 줄은 서술 · 독백 구분이 없다 → window 'Unknown'
 *   [CHOICE_START (ID="…")] [OPTION TEXT="…" (VALUE="…")] 응답 [OPTION_END] … [CHOICE_END]
 *                                            선택지가 1개뿐이면 지휘관이 하는 말(Self)이다
 *   [MESSENGER_START TITLE="…" PARTICIPANTS="…"] [MSG SENDER="…" (IS_SENDER="true")] 본문 [MSG_END] … [MESSENGER_END]
 *   [NEXT_ROUTE IF_CHOICE="…" OPTION="…" TARGET="…"]   고른 선택지에 따라 다음 하위 챕터가 갈린다(2X2 LOVE)
 *
 * 키: 단위 = <접두>:<파일 이름>, 씬 = <단위 키>_<NN>(파일 안 순서).
 *   fl:(블라링크에 없는 이벤트) · side:(사이드 스토리) · sub:(서브퀘스트) · relic:(유실물) · erelic:(이벤트 유실물)
 * source는 모두 `fl-`로 시작한다 — 결과에서 금서고 출처가 드러나게 한다.
 *
 * 창 종류(window): 이름표 있는 줄 Speech · 이름표 없는 줄 Unknown · 유실물 본문 Document ·
 *   지휘관 Self · 선택지 Choice · 메신저 Messenger / MessengerSelf(지휘관이 보냄) / MessengerStart(대화방 머리) ·
 *   분기 Route · 연출 명령이 새어 나온 줄 Action(`ABSOLUTE [ACTION]: END`). jump_to는 블라링크와 같다: 선택지는 그 응답 첫 줄로, 응답 끝 줄은 합류 지점으로 뛴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LIBRARY_DIR = path.join(ROOT, 'data/raw/forbidden-library');
const EVENTS_MAP_PATH = path.join(ROOT, 'annotations/forbidden-library-events.json');

/** 금서고 카테고리 → 우리 키 접두 · source. 순서가 목차 순서다 */
export const LIBRARY_KINDS = {
  event_stories: { prefix: 'fl', source: 'fl-event' },
  side_stories: { prefix: 'side', source: 'fl-side' },
  sub_quests: { prefix: 'sub', source: 'fl-subquest' },
  lost_relics: { prefix: 'relic', source: 'fl-relic', document: true },
  event_lost_relics: { prefix: 'erelic', source: 'fl-eventrelic' },
};

const RE = {
  head: /^@@@(SCRIPT_ID|SUB_TITLE):\s*(.*)$/,
  skip: /^\[(SCENE START|SCENE END|NEXT_SUBCHAPTER_BUTTON\b[^\]]*)\]$/,
  route: /^\[NEXT_ROUTE IF_CHOICE="([^"]*)" OPTION="([^"]*)" TARGET="([^"]*)"\]$/,
  choiceStart: /^\[CHOICE_START(?:\s+ID="([^"]*)")?\]$/,
  // VALUE의 닫는 따옴표가 빠진 원문이 있다(2X2 LOVE `VALUE="sxp9_t1]`)
  option: /^\[OPTION TEXT="(.*?)"(?:\s+VALUE="([^"\]]*)"?)?\]$/,
  messengerStart: /^\[MESSENGER_START TITLE="(.*?)"(?:\s+PARTICIPANTS="(.*?)")?\]$/,
  // 시스템 알림(`[MSG SENDER="SYSTEM" IS_SYSTEM="true"]` — "…님이 대화방을 나갔습니다")은 보낸 사람이 SYSTEM인 메시지로 둔다
  msg: /^\[MSG SENDER="(.*?)"(?:\s+IS_SENDER="(true|false)")?(?:\s+IS_SYSTEM="(?:true|false)")?\]$/,
};

/** 파일 이름 → 키에 쓰는 이름. `.txt`를 떼고(`거인을찾아서.txt.txt`처럼 겹친 것도) 공백은 `_`로 */
export const stemOf = (file) => file.replace(/(\.txt)+$/i, '').replace(/\s+/g, '_');

/**
 * `이름표: 대사`를 가른다. 이름표 뒤 콜론 앞에는 공백이 없다 — `결과 : 성공` 같은 문서 칸은 이름표가 아니다.
 * 이명(`라피 : 레드 후드: 대사`)은 공백 없는 첫 콜론에서 자르므로 이름표에 그대로 남는다.
 */
export function splitName(t) {
  const i = t.search(/\S: /);
  if (i < 0) return null;
  const name = t.slice(0, i + 1);
  if (name.length > 30 || /^[\s*\-–—·•"'“‘(\[<>~#ㄴ]/.test(name)) return null;
  return { name, text: t.slice(i + 3).trim() };
}

/** 파일 → 하위 챕터들 { scriptId, title, rows: [{ raw, n(파일 줄 번호) }] } */
function splitSubchapters(text) {
  const subs = [];
  let cur = null;
  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, i) => {
    const m = raw.match(RE.head);
    if (m) {
      if (m[1] === 'SCRIPT_ID') subs.push((cur = { scriptId: m[2].trim(), title: null, rows: [] }));
      else if (cur) cur.title = m[2].trim();
      return;
    }
    if (cur) cur.rows.push({ raw, n: i + 1 });
  });
  return subs;
}

/** 하위 챕터의 줄들 → 항목 트리. 형식이 깨진 곳은 notes에 (파일 줄 번호와 함께) 남기고 되도록 이어 간다 */
function parseItems(rows, noteAt) {
  let lineNo = 0;
  const note = (msg) => noteAt(`${msg} (원문 ${lineNo}줄)`);
  const root = { type: 'root', items: [] };
  const stack = [root];
  const add = (item) => {
    if (stack.at(-1).type === 'choice') {
      // 선택지 안, OPTION 밖에 무엇이 오면 [CHOICE_END]가 빠진 것이다(원문에 가끔 있다). 선택지를 닫고 잇는다
      note('[CHOICE_END] 빠짐 — 선택지를 닫음');
      stack.pop();
    }
    stack.at(-1).items.push(item);
  };
  const popTo = (type) => {
    const i = stack.findLastIndex((x) => x.type === type);
    if (i <= 0) return note(`짝 없는 ${type} 끝`);
    if (i !== stack.length - 1) note(`${type} 안에 닫히지 않은 ${stack.at(-1).type}`);
    stack.length = i;
  };
  for (const { raw, n } of rows) {
    lineNo = n;
    const t = raw.trim();
    if (!t) continue; // 빈 줄은 형식용
    const top = stack.at(-1);
    let m;
    if (RE.skip.test(t)) continue;
    if ((m = t.match(RE.route))) add({ type: 'route', choice: m[1], value: m[2], target: m[3] });
    else if ((m = t.match(RE.choiceStart))) {
      const c = { type: 'choice', id: m[1] ?? null, options: [] };
      add(c);
      stack.push(c);
    } else if (t === '[CHOICE_END]') popTo('choice');
    else if ((m = t.match(RE.option))) {
      let c = top;
      if (c.type !== 'choice') {
        // [CHOICE_START]가 빠졌다 — 선택지를 새로 연다
        note('[CHOICE_START] 빠짐 — 선택지를 엶');
        c = { type: 'choice', id: null, options: [] };
        add(c);
        stack.push(c);
      }
      const o = { type: 'option', text: m[1], value: m[2] ?? null, items: [] };
      c.options.push(o);
      stack.push(o);
    } else if (t === '[OPTION_END]') popTo('option');
    else if ((m = t.match(RE.messengerStart))) {
      const g = { type: 'messenger', title: m[1], participants: m[2] ?? null, items: [] };
      add(g);
      stack.push(g);
    } else if (t === '[MESSENGER_END]') popTo('messenger');
    else if ((m = t.match(RE.msg))) {
      // 메시지 안에 선택지가 들 수 있다 — 지휘관이 보낼 말을 고르고, 응답 메시지는 OPTION 안에 있다
      const g = { type: 'msg', sender: m[1], self: m[2] === 'true', items: [] };
      add(g);
      stack.push(g);
    } else if (t === '[MSG_END]') popTo('msg');
    else add({ type: 'text', raw });
  }
  if (stack.length > 1) note(`닫히지 않은 ${stack.slice(1).map((x) => x.type).join(' > ')}`);
  return root.items;
}

/**
 * 항목 트리 → 줄. 다음에 놓이는 줄이 pending(합류 지점을 기다리는 줄)의 jump_to가 된다.
 * 여러 개인 선택지는 블라링크처럼 선택지 줄을 먼저 늘어놓고 응답을 차례로 붙인다.
 */
function emitLines(items, { document, storyIdOf, note }) {
  const out = [];
  let pending = [];
  const put = (line) => {
    const seq = out.length;
    for (const p of pending) p.jumpTo = seq;
    pending = [];
    out.push({ seq, speakerId: null, speakerName: null, jumpTo: null, ...line });
    return out.at(-1);
  };
  /** list를 줄로 낸다. self = 지휘관이 보내는 메시지 안(선택지 1개짜리가 MessengerSelf가 된다) */
  const emit = (list, { self = false } = {}) => {
    for (const it of list) {
      if (it.type === 'text') {
        if (document) {
          put({ window: 'Document', text: it.raw.replace(/\s+$/, '') });
        } else if (/\[ACTION\]\s*:/.test(it.raw)) {
          // `제목 [ACTION]: END`처럼 연출 명령이 대사 자리에 새어 나온 줄 — 이름표가 아니다
          put({ window: 'Action', text: it.raw.trim() });
        } else {
          const t = it.raw.trim();
          const named = splitName(t);
          put(named ? { window: 'Speech', speakerName: named.name, text: named.text } : { window: 'Unknown', text: t });
        }
      } else if (it.type === 'msg') {
        // 이어진 본문 줄은 메시지 하나로 묶고, 선택지는 그 자리에서 낸다
        let buf = [];
        const flush = () => {
          if (!buf.length) return;
          const text = buf.join('\n');
          put(it.self ? { window: 'MessengerSelf', text } : { window: 'Messenger', speakerName: it.sender, text });
          buf = [];
        };
        for (const x of it.items) {
          if (x.type === 'text') buf.push(x.raw.trim());
          else {
            flush();
            emit([x], { self: it.self });
          }
        }
        flush();
      } else if (it.type === 'messenger') {
        put({ window: 'MessengerStart', text: it.participants ? `${it.title} (${it.participants})` : it.title });
        emit(it.items);
      } else if (it.type === 'route') {
        const target = storyIdOf(it.target);
        if (!target) note(`분기 대상을 못 찾음: ${it.target}`);
        put({ window: 'Route', text: `${it.choice}=${it.value} → ${target ?? it.target}` });
      } else if (it.type === 'choice') {
        const [only] = it.options;
        if (it.options.length === 1 && !only.value && !it.id) {
          // 선택지 1개 = 지휘관이 하는 말(메신저 안이면 보내는 메시지). 붙은 응답은 그대로 이어진다
          put({ window: self ? 'MessengerSelf' : 'Self', text: only.text });
          emit(only.items);
          continue;
        }
        if (!it.options.length) {
          note('선택지 없는 CHOICE');
          continue;
        }
        const optionLines = it.options.map((o) => {
          const tag = o.value ? ` 〔${it.id ? `${it.id}=` : ''}${o.value}〕` : '';
          return put({ window: 'Choice', text: `${o.text}${tag}` });
        });
        const toMerge = [];
        it.options.forEach((o, i) => {
          const start = out.length;
          emit(o.items);
          if (out.length === start) {
            toMerge.push(optionLines[i]); // 응답 없는 선택지는 바로 합류 지점으로
            return;
          }
          optionLines[i].jumpTo = start;
          if (i < it.options.length - 1) {
            // 마지막이 아닌 응답의 끝(과 그 안에서 합류를 기다리던 줄)은 뒤 응답들을 건너뛰어 합류 지점으로
            toMerge.push(...pending, out.at(-1));
            pending = [];
          }
        });
        pending.push(...toMerge);
      }
    }
  };
  emit(items);
  return out;
}

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

/**
 * 금서고 원문을 읽는다.
 * @param {(eventKey: string) => boolean} blablaHasText 블라링크 아카이브에 그 이벤트의 원문이 있는가.
 *   있으면 금서고 것을 쓰지 않는다 — 블라링크가 이긴다(사용자, 2026-09-28).
 */
export function readLibrary({ blablaHasText }) {
  const manifest = readJson(path.join(LIBRARY_DIR, 'script-manifest.json'), []);
  const eventsMap = readJson(EVENTS_MAP_PATH, {});
  const categories = [];
  const stories = [];
  const lines = [];
  const notes = [];
  const skipped = [];

  // 매니페스트 순서대로 파일을 모은다 — 사이트 목차 순서가 단위 순서다
  const files = new Map();
  for (const it of manifest) {
    const key = `${it.categoryKey}/${it.mainChapterFile}`;
    if (!files.has(key)) files.set(key, { key, category: it.categoryKey, file: it.mainChapterFile, title: it.title });
  }
  const orderOf = {};
  for (const f of files.values()) {
    const kind = LIBRARY_KINDS[f.category];
    if (!kind) continue;
    const full = path.join(LIBRARY_DIR, 'scripts', f.category, f.file);
    if (!fs.existsSync(full)) continue; // 받지 않은 파일(블라링크에 있는 단위 등)
    const gameKey = f.category === 'event_stories' ? eventsMap[f.key] ?? null : null;
    if (gameKey && blablaHasText(gameKey)) {
      skipped.push(`${f.key} → ${gameKey}`);
      continue;
    }

    const categoryId = `${kind.prefix}:${stemOf(f.file)}`;
    orderOf[kind.source] = (orderOf[kind.source] ?? -1) + 1;
    categories.push({ id: categoryId, source: kind.source, name: f.title, gameKey, orderIndex: orderOf[kind.source] });

    const subs = splitSubchapters(fs.readFileSync(full, 'utf8'));
    const width = subs.length > 100 ? 3 : 2;
    const idOf = new Map(subs.map((s, i) => [s.scriptId, `${categoryId}_${String(i).padStart(width, '0')}`]));
    subs.forEach((s, i) => {
      const id = idOf.get(s.scriptId);
      const note = (msg) => notes.push(`${id}: ${msg}`);
      const body = emitLines(parseItems(s.rows, note), { document: kind.document, storyIdOf: (sid) => idOf.get(sid), note });
      stories.push({
        id,
        kind: 'scene',
        source: kind.source,
        categoryId,
        title: s.title,
        orderIndex: i,
        isHidden: false,
        hasText: body.length ? 1 : 0,
        lineCount: body.length,
        sourceRef: s.scriptId,
      });
      for (const l of body) lines.push({ storyId: id, ...l });
    });
  }
  return { categories, stories, lines, notes, skipped };
}
