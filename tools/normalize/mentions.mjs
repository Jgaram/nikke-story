/**
 * B2 — 언급 DB 자동 줄 (T3-9 · T3-1 · T3-3): 어느 씬의 어느 줄에 어떤 대상이 어떻게 나오나.
 *
 * build.mjs가 부른다. 범위 안(stories.in_scope = 1) 줄만 본다. 방식(how):
 *   speaks  이름표로 말함 — lines.speaker_target(이름표 · 코드로 푼 줄), 여럿 이름표는 그 대상들 모두.
 *           지휘관은 이름표가 없다: Self · MessengerSelf 창(지휘관이 하는 말)이 person:지휘관의 speaks다(via 창).
 *           `???`처럼 미상 이름표는 누구에게도 잇지 않는다 — 정체는 2회독 암시 언급(I, speaker: true)이 씬 · 줄마다 적는다.
 *   named   이름 그대로 — 사전 이름 중 표준명 · 니케 목록 · 정식 명칭 · 표기 · 영문
 *   alias   다른 이름 — 약칭 · 별칭 · 이명
 * 한 줄(행) = 같은 (씬, 대상, 방식, 경로 via)가 이어진 줄 덩어리(seq가 붙어 있는 것) 하나. name은 덩어리에 나온 이름표 · 이름들(` · `로 잇는다).
 *
 * 이름 찾기 (규칙은 docs/schema.md "언급 DB"):
 *   - 비인물 이름은 사전 건수와 같은 규칙(dictionary.mjs compileNames — 낱말 앞에서 시작, except)이다. 합성어(방주민)도 언급으로 친다.
 *   - 인물 이름은 더 좁힌다: 낱말 앞에서 시작하고, 이름 뒤 낱말 나머지가 비었거나 꼬리(호칭 접미 · 조사 · 서술격 어미 — PERSON_TAIL)여야 한다.
 *     `진짜` · `신경`처럼 이름으로 시작하는 다른 낱말을 뺀다. 한 자리에 여러 이름이 걸리면 가장 긴 이름만(`그레이브` ⊃ `그레이`),
 *     더 긴 비인물 이름 안에 든 인물 이름도 뺀다.
 *   - 두 인물이 같은 이름을 나누면(`사쿠라` — TETRA · 콜라보) 그 단위에서 말하는 쪽 하나에 잇는다. 둘 다거나 아무도 안 말하면 뺀다.
 *   - 표본 정밀도(annotations/dictionary/mention-precision.json)로 이름마다 쓰는 법을 정한다(MENTION_MODES): `all` 어디서나 · `unit` 그 인물이
 *     이름표로 말하는 단위 안에서만(흔한 낱말과 겹치지만 자기 단위에서는 맞는 이름 — `나가` · `파워`) · `off` 자동에서 뺀다(건수는 센다).
 *     `except`(인물 이름만)는 그 자리를 덮는 더 긴 표기를 뺀다 — `볼트` ↔ `볼트 주니어`(다른 로봇).
 *   - 창 Action(새어 나온 연출 명령) · Route(분기 표시) · Input(닉네임 입력)은 보지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileNames } from './dictionary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PRECISION_PATH = path.join(ROOT, 'annotations/dictionary/mention-precision.json');

export const COMMANDER = 'person:지휘관';
/** 지휘관이 하는 말 — 이름표 없이 이 창으로 나온다 */
export const SELF_WINDOWS = new Set(['Self', 'MessengerSelf']);
/** 이름을 찾지 않는 창 */
export const SKIP_WINDOWS = new Set(['Action', 'Route', 'Input']);
/** target_names.how → 방식. 나머지(약칭 · 별칭 · 이명)는 alias */
export const NAMED_HOWS = new Set(['표준명', '니케 목록', '정식 명칭', '표기', '영문']);
export const howOfName = (nameHow) => (NAMED_HOWS.has(nameHow) ? 'named' : 'alias');

const opt = (xs) => `(?:${[...xs].sort((a, b) => b.length - a.length).join('|')})`;
/** 호칭 접미 · 복수 · 파생(-답다) — `라피님` `아니스 씨`는 띄어 써서 따로 안 봐도 된다 */
const TAIL_SUFFIX = ['님', '씨', '양', '군', '쨩', '짱', '선배', '선배님', '언니', '누나', '오빠', '형', '형님', '들', '님들',
  '답지', '답다', '답네', '답게', '답고', '다운', '다워'];
/** 조사 (한 번 더 붙는 보조사는 TAIL_PARTICLE2) */
const TAIL_PARTICLE = ['이', '가', '은', '는', '을', '를', '의', '에', '에게', '에게서', '에게로', '에겐', '한테', '한테서', '한텐', '께', '께서', '께선',
  '와', '과', '랑', '이랑', '하고', '도', '만', '만큼', '뿐', '뿐만', '로', '으로', '로서', '으로서', '로써', '로부터', '으로부터', '에서',
  '처럼', '같이', '같은', '보다', '보단', '부터', '까지', '마저', '조차', '밖에', '이나', '나', '이든', '든', '이라도', '라도',
  '야말로', '이야말로', '이며', '며', '이자', '요', '이요', '아', '야', '여', '이여', '이시여', '시여', '더러', '보고'];
const TAIL_PARTICLE2 = ['는', '도', '만', '의', '요', '은', '이', '가', '을', '를', '로', '나'];
/** 서술격(이다) 어미 — 앞에 `이`가 붙을 수 있다(`라피였어` · `진이었어`) */
const TAIL_COPULA = ['다', '야', '에요', '예요', '요', '여', '었다', '었어', '었지', '였다', '였어', '였지', '였구나', '었구나', '였나', '었나', '였던', '었던',
  '였을', '었을', '였군요', '었네', '잖아', '잖아요', '지', '지만', '죠', '고', '고요', '라', '라고', '라고요', '라는', '라면', '라서', '라니', '란', '란다',
  '랍니다', '래', '래요', '면', '니까', '니까요', '니', '냐', '네', '네요', '시네요', '시니까', '거든', '거든요', '던', '던가', '인데', '인데요',
  '구나', '군', '군요', '로군', '가', '가요', '인가', '인가요', '입니다', '입니까', '이에요', '일', '일까', '일지', '일지도', '일까요', '인지', '인지도',
  '인걸', '인걸요', '인', '이었다', '이었어', '이었지', '이었던', '십니다', '세요', '시죠', '신가요', '셨군요', '시고', '신'];
/** 이름 뒤 낱말 나머지가 이것과 통째로 맞으면 그 이름이다 */
export const PERSON_TAIL = new RegExp(
  `^${opt(TAIL_SUFFIX)}?(?:${opt(TAIL_PARTICLE)}${opt(TAIL_PARTICLE2)}?|이?${opt(TAIL_COPULA)})?$`,
);

const WORD = /[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]/;
const NON_WORD_RUN = '[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 인물 이름 검색기 — 낱말 앞 + 꼬리 규칙 + 가장 긴 이름. blockers(비인물 이름)가 더 길게 덮으면 뺀다.
 * @param {{key: any, name: string, excludes?: string[]}[]} list 인물 이름 (excludes = 그 자리를 덮으면 뺄 더 긴 표기)
 * @param {string[]} blockers 비인물 이름 (덮는지만 본다)
 * @returns {(text: string) => { hits: Set<any>, tailMiss: Map<any, string[]> }} 걸린 key들 · 꼬리 규칙에 걸려 빠진 나머지(정밀도 표본용)
 */
export function compilePersonNames(list, blockers = []) {
  const all = [
    ...list.map((x) => ({ ...x, person: true })),
    ...blockers.map((name) => ({ key: null, name, person: false })),
  ].map((x) => ({ ...x, re: x.name.includes(' ') ? new RegExp(x.name.split(/ +/).map(escapeRe).join(NON_WORD_RUN), 'y') : null }));
  const byHead = new Map();
  for (const x of all) (byHead.get(x.name[0]) ?? byHead.set(x.name[0], []).get(x.name[0])).push(x);
  return (text) => {
    const t = text.replace(/\s+/g, ' ');
    const spans = []; // { x, i, end }
    for (let i = 0; i < t.length; i++) {
      const cands = byHead.get(t[i]);
      if (!cands) continue;
      if (i > 0 && WORD.test(t[i - 1])) continue;
      for (const x of cands) {
        let end;
        if (x.re) {
          x.re.lastIndex = i;
          const m = x.re.exec(t);
          if (!m) continue;
          end = i + m[0].length;
        } else {
          if (!t.startsWith(x.name, i)) continue;
          end = i + x.name.length;
        }
        spans.push({ x, i, end });
      }
    }
    const hits = new Set();
    const tailMiss = new Map();
    for (const s of spans) {
      if (!s.x.person) continue;
      // 더 긴 이름(인물 · 비인물)이 이 자리를 덮으면 뺀다
      if (spans.some((o) => o !== s && o.i <= s.i && o.end >= s.end && o.end - o.i > s.end - s.i)) continue;
      // except: 그 자리를 덮는 더 긴 표기 (`볼트 주니어`)
      if ((s.x.excludes ?? []).some((e) => {
        const j = t.indexOf(e, Math.max(0, s.end - e.length));
        return j !== -1 && j <= s.i;
      })) continue;
      let j = s.end;
      while (j < t.length && WORD.test(t[j])) j++;
      const rest = t.slice(s.end, j);
      if (PERSON_TAIL.test(rest)) hits.add(s.x.key);
      else (tailMiss.get(s.x.key) ?? tailMiss.set(s.x.key, []).get(s.x.key)).push(rest);
    }
    return { hits, tailMiss };
  };
}

/** 이름을 자동 줄에 쓰는 법 — 표본 정밀도 파일의 auto 칸 */
export const MENTION_MODES = ['all', 'unit', 'off'];
/** 정밀도 기준 — 표본 정밀도가 이 밑이면 unit(말하는 단위 안 표본이 이 이상일 때) 또는 off */
export const PRECISION_FLOOR = 0.8;

/** 표본 정밀도 파일 — 이름마다 { target, name, sample, correct, auto, unit?, except?, note, by, date } */
export function loadPrecision(file = PRECISION_PATH) {
  if (!fs.existsSync(file)) return { names: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * 범위 안 줄에서 언급 DB 자동 줄을 만든다.
 * @param {object[]} lines 정규화 줄 (resolveSpeakers를 거친 것 — speakerTarget · speakerClass)
 * @param {object[]} stories inScope가 달린 노드
 * @param {object} dict buildDictionary 결과 (names 행에 linesInScope를 단다 — 인물 이름은 여기서 센다)
 * @param {object[]} speakerTable resolveSpeakers 결과 (여럿 이름표의 대상들)
 * @returns {{ rows: object[], problems: string[], stats: object }}
 */
export function buildMentions(lines, stories, dict, speakerTable, precision = loadPrecision()) {
  const inScope = new Set(stories.filter((s) => s.inScope).map((s) => s.id));
  const groupTargets = new Map(speakerTable.filter((r) => r.cls === '여럿').map((r) => [r.name, r.targets]));
  const problems = [];

  // 표본 정밀도 — (대상, 이름) → 판정
  const prec = new Map();
  const nameKey = (target, name) => `${target}\t${name}`;
  for (const p of precision.names ?? []) {
    const k = nameKey(p.target, p.name);
    if (prec.has(k)) problems.push(`mention-precision.json: ${p.target} "${p.name}"가 두 번 나온다`);
    prec.set(k, p);
  }
  const nameRows = new Map(dict.names.map((n) => [nameKey(n.targetId, n.name), n]));
  for (const k of prec.keys()) if (!nameRows.has(k)) problems.push(`mention-precision.json: 사전에 없는 이름 ${k.replace('\t', ' ')}`);
  for (const n of dict.names) {
    const p = prec.get(nameKey(n.targetId, n.name));
    n.mentionMode = p?.auto ?? 'all';
    if (!MENTION_MODES.includes(n.mentionMode)) {
      problems.push(`mention-precision.json: ${n.targetId} "${n.name}"의 auto "${p.auto}" — ${MENTION_MODES.join(' · ')} 중 하나`);
      n.mentionMode = 'all';
    }
    n.precision = p ? `${p.correct}/${p.sample}${p.unit ? ` · 단위 ${p.unit.correct}/${p.unit.sample}` : ''}` : null;
    if (p?.except?.length) {
      if (!n.targetId.startsWith('person:')) problems.push(`mention-precision.json: except는 인물 이름에만 — ${n.targetId} "${n.name}"(비인물은 사전 파일의 except)`);
      for (const x of p.except) if (!x.includes(n.name)) problems.push(`mention-precision.json: ${n.targetId} "${n.name}"의 except "${x}"에 그 이름이 없다`);
      n.excludes = [...(n.excludes ?? []), ...p.except];
    }
  }

  const personNames = dict.names.filter((n) => n.targetId.startsWith('person:'));
  const termNames = dict.names.filter((n) => !n.targetId.startsWith('person:'));
  const matchPerson = compilePersonNames(personNames.map((n) => ({ key: n, name: n.name, excludes: n.excludes })), termNames.map((n) => n.name));
  const matchTerm = compileNames(termNames.map((n) => ({ key: n, name: n.name, excludes: n.excludes })));
  for (const n of personNames) n.linesInScope = 0;

  // 단위(카테고리)에서 말하는 대상 — 같은 이름을 나누는 인물 가르기 · unit 이름이 쓴다
  const catOf = new Map(stories.map((s) => [s.id, s.categoryId]));
  const speakersOf = (l) => {
    if (l.speakerTarget) return [l.speakerTarget];
    if (l.speakerClass === '여럿') return groupTargets.get(l.speakerName) ?? [];
    if (!l.speakerName && SELF_WINDOWS.has(l.window)) return [COMMANDER];
    return [];
  };
  const speaksIn = new Map();
  for (const l of lines) {
    if (!inScope.has(l.storyId)) continue;
    for (const t of speakersOf(l)) {
      const c = catOf.get(l.storyId);
      (speaksIn.get(c) ?? speaksIn.set(c, new Set()).get(c)).add(t);
    }
  }
  const owners = new Map();
  for (const n of personNames) (owners.get(n.name) ?? owners.set(n.name, []).get(n.name)).push(n.targetId);
  const shared = new Set([...owners].filter(([, ids]) => new Set(ids).size > 1).map(([name]) => name));

  // 덩어리 잇기: (씬, 대상, 방식, 이름) → 열린 덩어리
  const rows = [];
  const open = new Map();
  let curStory = null;
  const close = (r) => rows.push({ ...r, name: r.names.size ? [...r.names].join(' · ') : null, names: undefined });
  const flushAll = () => {
    for (const r of open.values()) close(r);
    open.clear();
  };
  const add = (l, target, how, name, via) => {
    const k = `${target}\t${how}\t${via}`;
    const r = open.get(k);
    if (r && r.seqTo >= l.seq - 1) {
      if (r.seqTo < l.seq) {
        r.seqTo = l.seq;
        r.lines++;
      }
      if (name) r.names.add(name);
      return;
    }
    if (r) close(r);
    open.set(k, { storyId: l.storyId, seqFrom: l.seq, seqTo: l.seq, target, how, via, lines: 1, names: new Set(name ? [name] : []) });
  };
  const perTarget = new Map(); // 인물 이름 언급 — 대상 → { lines, stories }
  let tailMisses = 0;

  for (const l of lines) {
    if (!inScope.has(l.storyId)) continue;
    if (l.storyId !== curStory) {
      flushAll();
      curStory = l.storyId;
    }
    // speaks
    const via = l.speakerTarget ? (l.speakerVia ?? '이름표') : l.speakerClass === '여럿' ? '이름표' : '창';
    for (const t of speakersOf(l)) add(l, t, 'speaks', l.speakerName ?? null, via);
    // named · alias
    if (!l.text || SKIP_WINDOWS.has(l.window)) continue;
    const { hits, tailMiss } = matchPerson(l.text);
    for (const v of tailMiss.values()) tailMisses += v.length;
    const here = speaksIn.get(catOf.get(l.storyId)) ?? new Set();
    for (const n of hits) {
      if (shared.has(n.name)) {
        const pick = owners.get(n.name).filter((id) => here.has(id));
        if (pick.length !== 1 || pick[0] !== n.targetId) {
          hits.delete(n);
          continue;
        }
      }
      n.linesInScope++; // 이름의 건수 — 쓰는 법(unit · off)과 상관없이 걸린 줄
      if (n.mentionMode === 'unit' && !here.has(n.targetId)) hits.delete(n);
    }
    for (const n of [...hits, ...matchTerm(l.text)]) {
      if (n.targetId.startsWith('person:')) {
        if (n.mentionMode !== 'off') {
          const c = perTarget.get(n.targetId) ?? perTarget.set(n.targetId, { lines: new Set(), stories: new Set() }).get(n.targetId);
          c.lines.add(`${l.storyId}\t${l.seq}`);
          c.stories.add(l.storyId);
        }
      }
      if (n.mentionMode === 'off') continue;
      add(l, n.targetId, howOfName(n.how), n.name, '이름');
    }
  }
  flushAll();

  // 인물 대상 건수 — 자동으로 쓰는 이름이 나온 줄 · 씬 (비인물은 countTermMentions가 이미 셌다)
  for (const t of dict.targets.values()) {
    if (t.type !== 'person') continue;
    const c = perTarget.get(t.id);
    t.linesInScope = c?.lines.size ?? 0;
    t.storiesInScope = c?.stories.size ?? 0;
  }

  const byHow = {};
  for (const r of rows) byHow[r.how] = (byHow[r.how] ?? 0) + r.lines;
  const excluded = dict.names.filter((n) => n.mentionMode === 'off');
  return { rows, problems, stats: { byHow, tailMisses, excluded } };
}
