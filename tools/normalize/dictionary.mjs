/**
 * A1 — 분석 범위 표시 · 인물 사전 · 이름표 분류 (T2-6 · T3-2 인물 · 결정 #5).
 * A2 — 비인물 사전: 지역 · 장소 / 조직 · 세력 / 개념 · 설정 / 사건 / 물건 (T3-2) + 범위 안 건수.
 *
 * build.mjs가 부른다. 입력:
 *   annotations/scope.json               분석 범위 — 여기 걸리는 노드는 범위 밖(in_scope = 0)
 *   annotations/dictionary/people.json   인물 대상 중 손으로 정한 것 · 정체 연결 후보
 *   annotations/dictionary/speakers.json 이름표 분류 — 니케 목록(characters)으로 풀리지 않는 이름표 전부
 *   annotations/dictionary/{places,orgs,concepts,incidents,items}.json  비인물 사전 (종류별 한 파일)
 *   characters (data/raw/character/…/nikke_list_v2.json)
 *
 * 대상 ID는 `<종류>:<표준명>`이고 표준명의 공백은 `_`로 바꾼다(`person:스노우_화이트`). 한 번 정한 ID는 바꾸지 않는다.
 * 규칙 · 칸 뜻은 docs/schema.md "대상 ID" · "이름표 분류" · "비인물 사전".
 *
 * 이름표 풀이 순서 (줄마다):
 *   1. 코드 규칙 — (이름표, 이름표 코드)가 speakers.json `codes`에 있으면 그 대상. 화면 이름표(`???` 등)는 speaker_name에 그대로 남는다
 *   2. 이름표 분류 — speakers.json `labels`
 *   3. 니케 목록 — 이름표가 characters의 이름(`라피 : 레드 후드`)이나 그 앞 이름(`라피`)과 같으면 그 니케. 둘 이상에 걸리면 모호 → 미분류
 * 풀리지 않은 줄은 speaker_class가 NULL이다. 범위 안 미분류는 테스트(tests/speakers.test.mjs)가 잡는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCOPE_PATH = path.join(ROOT, 'annotations/scope.json');
export const PEOPLE_PATH = path.join(ROOT, 'annotations/dictionary/people.json');
export const SPEAKERS_PATH = path.join(ROOT, 'annotations/dictionary/speakers.json');

/** 비인물 사전 파일 — 종류(ID 접두) → 파일. 파일 안의 대상 ID는 그 접두로 시작해야 한다 */
export const TERM_FILES = {
  place: 'places.json',
  org: 'orgs.json',
  concept: 'concepts.json',
  incident: 'incidents.json',
  item: 'items.json',
};
export const termPath = (type) => path.join(ROOT, 'annotations/dictionary', TERM_FILES[type]);

/**
 * 대상 이름(target_names.how)의 갈래. `표준명`은 빌드가 붙인다.
 *   니케 목록  니케 목록(characters)의 이름 (A1)
 *   정식 명칭  더 긴 공식 이름 — `미실리스 인더스트리`
 *   약칭       줄인 이름 — `1차 침공`, `미미르 부속고`
 *   별칭       다른 이름 · 부르는 말 — `아크`(방주), `미사일스`(미실리스를 놀려 부름)
 *   표기       띄어쓰기 · 붙여쓰기 · 문장부호만 다른 같은 이름 — `중앙정부`, `전초 기지`
 *   영문       로마자 표기 — `TETRA`, `NIKKE`
 *   이명       별명처럼 붙는 이름 (인물)
 */
export const NAME_HOWS = ['표준명', '니케 목록', '정식 명칭', '약칭', '별칭', '표기', '영문', '이명'];

/** 대상 종류 — ID 접두 → 뜻. 인물은 A1, 나머지는 A2가 채운다 */
export const TARGET_TYPES = {
  person: '인물',
  place: '지역 · 장소',
  org: '조직 · 세력',
  concept: '개념 · 설정',
  incident: '사건',
  item: '물건',
};

/**
 * 이름표 갈래. 니케 · 인물 · 랩쳐는 대상(person:)이 있고, 호칭 · 비인물 · 미상은 대상이 없다. 여럿은 대상이 둘 이상.
 *   니케   characters(게임의 니케 목록)에 있는 인물
 *   인물   그 밖의 이름 있는 인물 — 사람, 목록에 없는 니케, AI, 메신저 대화명, 이름 있는 동물 등
 *   랩쳐   랩쳐 · 헬레틱 (원문에서 그렇게 불린 근거가 있는 것만)
 *   호칭   묘사 · 직함 · 무리 이름 (`양산형 니케`, `기자`, `주황색 머리의 소녀`) — 한 사람을 가리켜도 이름이 아니면 호칭
 *   비인물 사람이 말하는 게 아닌 이름표 (`TV 소리`, `안내 방송`, `시스템`)
 *   미상   정체를 가린 이름표 (`???`, `익숙한 목소리`) — 정체는 2회독 후보
 *   여럿   여럿이 함께 말함 (`블랑&누아르`)
 */
export const SPEAKER_CLASSES = ['니케', '인물', '랩쳐', '호칭', '비인물', '미상', '여럿'];
const NO_TARGET = new Set(['호칭', '비인물', '미상']);
const PERSON_KINDS = new Set(['니케', '인물', '랩쳐']);

/** 대상 ID: 공백을 `_`로. 다른 글자는 그대로 둔다(`person:T.A.L.O.S.`) */
export const targetId = (type, name) => `${type}:${String(name).trim().replace(/\s+/g, '_')}`;
/** 니케 목록 이름의 앞 이름 — `라피 : 레드 후드` → `라피` */
export const baseName = (name) => String(name).split(' : ')[0].trim();

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);

// ── 범위 ─────────────────────────────────────────────────────────────

/**
 * stories에 inScope(1/0)와 scopeNote(범위 밖인 까닭)를 단다.
 * @returns {{ out: Record<string, number> }} 규칙별 범위 밖 노드 수
 */
export function applyScope(stories) {
  const scope = readJson(SCOPE_PATH, { out: [] });
  const out = {};
  for (const st of stories) {
    const rule = scope.out.find((r) => r.source === st.source && !(r.except ?? []).includes(st.id));
    st.inScope = rule ? 0 : 1;
    st.scopeNote = rule ? rule.reason : null;
    if (rule) out[rule.reason] = (out[rule.reason] ?? 0) + 1;
  }
  return { out };
}

// ── 인물 사전 · 이름표 분류 ──────────────────────────────────────────

/**
 * @param {{ characters: {resourceId:number, name:string}[] }} input
 * @returns 대상(targets) · 이름(names) · 이름표 풀이(labels) · 코드 규칙(codes) · 정체 연결 후보(links) · 문제(problems)
 */
export function buildDictionary({ characters }) {
  const people = readJson(PEOPLE_PATH, { persons: [], candidates: [] });
  const speakers = readJson(SPEAKERS_PATH, { labels: {}, codes: [], notes: {} });
  const problems = [];

  const targets = new Map(); // id → { id, type, name, kind, resourceIds, note, origin }
  const names = []; // { targetId, name, how, caution?, excludes? }
  const nameSeen = new Map(); // `${id}\t${name}` → names 행
  const addName = (id, name, how, extra = {}) => {
    const k = `${id}\t${name}`;
    if (nameSeen.has(k)) return Object.assign(nameSeen.get(k), extra);
    const row = { targetId: id, name, how, ...extra };
    nameSeen.set(k, row);
    names.push(row);
    return row;
  };
  const ensure = (id, init) => {
    if (!targets.has(id)) {
      targets.set(id, { id, type: id.split(':')[0], resourceIds: [], note: null, ...init });
      addName(id, init.name, '표준명');
    }
    return targets.get(id);
  };

  // 1) 손으로 정한 인물 — 니케 목록의 동명이인(사쿠라 282/836)처럼 자동으로 묶으면 안 되는 것을 먼저 잡는다
  const claimed = new Map();
  for (const p of people.persons ?? []) {
    if (!PERSON_KINDS.has(p.kind)) problems.push(`people.json ${p.id}: kind는 니케 · 인물 · 랩쳐 중 하나 (${p.kind})`);
    const t = ensure(p.id, { name: p.name, kind: p.kind, origin: '사전' });
    Object.assign(t, { name: p.name, kind: p.kind, note: p.note ?? null, origin: '사전' });
    for (const rid of p.resourceIds ?? []) claimed.set(rid, p.id);
    for (const n of p.names ?? []) addName(p.id, n.name, n.how);
  }

  // 2) 니케 목록 → 니케 인물. 같은 앞 이름(`라피` · `라피 : 레드 후드`)은 한 인물이다
  const byFullName = new Map();
  const byBase = new Map();
  const push = (m, k, v) => (m.get(k) ?? m.set(k, new Set()).get(k)).add(v);
  for (const c of characters) {
    if (!c.name) continue;
    const id = claimed.get(c.resourceId) ?? targetId('person', baseName(c.name));
    const t = ensure(id, { name: baseName(c.name), kind: '니케', origin: '니케 목록' });
    if (t.kind !== '니케') t.kind = '니케';
    t.resourceIds.push(c.resourceId);
    addName(id, c.name, '니케 목록');
    push(byFullName, c.name, id);
    push(byBase, baseName(c.name), id);
  }
  const ridTarget = new Map();
  for (const t of targets.values()) for (const rid of t.resourceIds) ridTarget.set(rid, t.id);

  // 3) 이름표 분류 (speakers.json labels)
  const labels = new Map(); // 이름표 → { cls, targets[], how, note }
  const setLabel = (label, v) => {
    if (labels.has(label)) problems.push(`speakers.json: 이름표 "${label}"가 두 번 나온다`);
    labels.set(label, { ...v, how: '분류', note: speakers.notes?.[label] ?? null });
  };
  const L = speakers.labels ?? {};
  for (const cls of ['인물', '랩쳐']) {
    for (const label of L[cls] ?? []) {
      const id = targetId('person', label);
      const t = ensure(id, { name: label, kind: cls, origin: '이름표' });
      setLabel(label, { cls: t.kind, targets: [id] });
    }
  }
  for (const cls of NO_TARGET) for (const label of L[cls] ?? []) setLabel(label, { cls, targets: [] });
  for (const [label, id] of Object.entries(L['대상'] ?? {})) setLabel(label, { cls: null, targets: [id] });
  for (const [label, ids] of Object.entries(L['여럿'] ?? {})) setLabel(label, { cls: '여럿', targets: ids });
  const unknownGroups = Object.keys(L).filter((k) => !['인물', '랩쳐', ...NO_TARGET, '대상', '여럿'].includes(k));
  if (unknownGroups.length) problems.push(`speakers.json labels: 모르는 갈래 ${unknownGroups.join(', ')}`);

  // 4) 코드 규칙 — 화면 이름표는 그대로 두고 이름표 코드로 대상을 푼다 (`???` + unknown_grave → 그레이브)
  const codes = new Map();
  for (const r of speakers.codes ?? []) codes.set(`${r.label}\t${r.code}`, { ...r });

  // 대상이 있는지 · 갈래 채우기
  const kindOf = (id) => targets.get(id)?.kind ?? null;
  for (const [label, v] of labels) {
    for (const id of v.targets) if (!targets.has(id)) problems.push(`speakers.json: "${label}" → 없는 대상 ${id}`);
    if (v.cls === null) v.cls = kindOf(v.targets[0]);
  }
  for (const r of codes.values()) {
    if (!targets.has(r.to)) problems.push(`speakers.json codes: ${r.label}/${r.code} → 없는 대상 ${r.to}`);
  }

  // 5) 니케 목록 이름 그대로인 이름표는 분류 없이 푼다. 여러 인물에 걸리면(동명이인) 분류에 적어야 한다
  function autoLabel(label) {
    const hit = byFullName.get(label) ?? byBase.get(label);
    if (!hit) return null;
    if (hit.size > 1) return { ambiguous: [...hit] };
    const [id] = hit;
    return { cls: kindOf(id), targets: [id], how: '니케 목록', note: null };
  }

  // 6) 비인물 사전 (A2) — 종류별 파일. 이름마다 검색 규칙(except)과 오탐 주의(caution)를 단다
  const terms = loadTerms();
  problems.push(...terms.problems);
  for (const e of terms.entries) {
    if (targets.has(e.id)) {
      problems.push(`${e.file}: 대상 ${e.id}가 이미 있다`);
      continue;
    }
    targets.set(e.id, {
      id: e.id, type: e.type, name: e.name, kind: e.kind ?? null, resourceIds: [], note: e.note ?? null, origin: '사전',
    });
    for (const n of e.names) addName(e.id, n.name, n.how, { caution: n.caution ?? null, excludes: n.except ?? [] });
  }
  // 같은 표기가 두 대상에 걸리면 자동 기록(언급)이 어느 쪽인지 모른다 — 비인물 이름끼리, 비인물 ↔ 인물 이름 모두 막는다
  const owners = new Map();
  for (const n of names) (owners.get(n.name) ?? owners.set(n.name, new Set()).get(n.name)).add(n.targetId);
  for (const [name, ids] of owners) {
    if (ids.size > 1 && [...ids].some((id) => !id.startsWith('person:'))) {
      problems.push(`사전: 이름 "${name}"가 여러 대상에 걸린다 — ${[...ids].join(', ')}`);
    }
  }

  // 7) 정체 연결 후보 (확정 · 기각은 사용자가 한다 — CLAUDE.md "해석이 필요한 기록은 후보로만")
  const links = (people.candidates ?? []).map((c, i) => {
    for (const id of [c.a, c.b]) {
      // a는 대상 없는 이름표(호칭 · 미상)도 된다 — `이름표:곰…?`
      const label = id?.startsWith('이름표:') ? id.slice('이름표:'.length) : null;
      const ok = label !== null ? labels.has(label) || Boolean(autoLabel(label)) : targets.has(id);
      if (!ok) problems.push(`people.json candidates[${i}]: 없는 ${label !== null ? '이름표' : '대상'} ${id}`);
    }
    if (!['후보', '확정', '기각'].includes(c.status)) problems.push(`people.json candidates[${i}]: 상태 ${c.status}`);
    if (!['확실', '추정'].includes(c.confidence)) problems.push(`people.json candidates[${i}]: 확신도 ${c.confidence}`);
    return { ...c, evidence: c.evidence ?? [] };
  });

  return { targets, names, labels, codes, links, problems, autoLabel, ridTarget, terms: terms.entries };
}

// ── 비인물 사전 (A2) ─────────────────────────────────────────────────

/**
 * 종류별 파일을 읽어 항목을 고르게 편다. 항목 칸(파일 형식은 docs/schema.md "비인물 사전"):
 *   id · name(표준명) · kind(갈래) · note · evidence([{scene, lines}]) · caution · except · names([{name, how, caution, except}]) · wrong([표기])
 * 표준명도 검색 이름이다 — caution · except는 표준명에 붙는 규칙이고, names의 규칙은 그 이름에만 붙는다.
 * @returns {{ entries: object[], problems: string[] }}
 */
export function loadTerms() {
  const entries = [];
  const problems = [];
  for (const [type, file] of Object.entries(TERM_FILES)) {
    const j = readJson(termPath(type), { entries: [] });
    for (const [i, e] of (j.entries ?? []).entries()) {
      const where = `${file} entries[${i}]`;
      if (!e.id || !e.name) {
        problems.push(`${where}: id · name이 있어야 한다`);
        continue;
      }
      if (e.id !== targetId(type, e.name) && !e.idNote) {
        // ID는 표준명에서 만든다. 표준명을 나중에 고쳤으면 ID는 그대로 두고 idNote에 까닭을 적는다
        problems.push(`${where}: ID ${e.id}가 표준명과 다르다 (${targetId(type, e.name)}) — 바꾼 표준명이면 idNote를 적는다`);
      }
      if (!e.id.startsWith(`${type}:`)) problems.push(`${where}: ${file}의 ID는 ${type}:로 시작해야 한다 (${e.id})`);
      const names = [{ name: e.name, how: '표준명', caution: e.caution, except: e.except }];
      for (const n of e.names ?? []) {
        if (!n.name) problems.push(`${where}: 이름 없는 names 칸`);
        else if (!NAME_HOWS.includes(n.how) || ['표준명', '니케 목록'].includes(n.how)) {
          problems.push(`${where}: "${n.name}"의 how "${n.how}" — ${NAME_HOWS.slice(2).join(' · ')} 중 하나`);
        } else names.push(n);
      }
      const seen = new Set();
      for (const n of names) {
        if (seen.has(n.name)) problems.push(`${where}: 이름 "${n.name}"가 두 번 나온다`);
        seen.add(n.name);
        if ([...String(n.name)].length < 2) problems.push(`${where}: 이름 "${n.name}"는 두 글자 이상이어야 한다`);
        for (const x of n.except ?? []) {
          if (!x.includes(n.name)) problems.push(`${where}: "${n.name}"의 except "${x}"에 그 이름이 없다`);
        }
      }
      for (const w of e.wrong ?? []) if (seen.has(w)) problems.push(`${where}: 틀린 표기 "${w}"가 이름에도 있다`);
      entries.push({ ...e, type, file, names });
    }
  }
  return { entries, problems };
}

const WORD_CHAR = /[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]/;
const NON_WORD_RUN = '[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]+';
const LATIN_END = /[0-9A-Za-z]$/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 이름 검색기. 규칙 (docs/schema.md "비인물 사전" · 검색 규칙):
 *   - 이름을 글자 그대로 찾는다(대소문자 구분). 여러 낱말 이름의 띄어쓰기 자리는 한글 · 로마자 · 숫자가 아닌 글자 여럿과도 맞는다
 *     — `아우터… 림`, `[아크 가디언] 작전`, `세븐스, 드워프` (FTS 구 검색과 같은 뜻).
 *   - 낱말 앞에서 시작하는 곳만 — 바로 앞 글자가 한글 · 로마자 · 숫자가 아니어야 한다. 뒤는 조사가 붙으므로 따지지 않는다
 *     (FTS 접두 검색 `"이름"*`과 같은 뜻). 로마자 · 숫자로 끝나는 이름은 뒤 글자도 로마자 · 숫자가 아니어야 한다(`AFX` ≠ `AFXX`).
 *   - except: 그 자리를 덮는 더 긴 표기가 있으면 뺀다(`엘리시온` ↔ `엘리시온 하퍼`, `테트라` ↔ `테트라포드`).
 * @param {{key: any, name: string, excludes?: string[]}[]} list
 * @returns {(text: string) => Set<any>} 대사 한 줄에서 걸린 key들
 */
export function compileNames(list) {
  const byHead = new Map(); // 첫 글자 → 이름들
  for (const x of list) {
    const re = x.name.includes(' ') ? new RegExp(x.name.split(/ +/).map(escapeRe).join(NON_WORD_RUN), 'y') : null;
    const c = { ...x, re };
    (byHead.get(x.name[0]) ?? byHead.set(x.name[0], []).get(x.name[0])).push(c);
  }
  return (text) => {
    const hits = new Set();
    const t = text.replace(/\s+/g, ' ');
    for (let i = 0; i < t.length - 1; i++) {
      const cands = byHead.get(t[i]);
      if (!cands) continue;
      if (i > 0 && WORD_CHAR.test(t[i - 1])) continue;
      for (const x of cands) {
        if (hits.has(x.key)) continue;
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
        if (LATIN_END.test(x.name) && end < t.length && /[0-9A-Za-z]/.test(t[end])) continue;
        const covered = (x.excludes ?? []).some((e) => {
          const j = t.indexOf(e, Math.max(0, end - e.length));
          return j !== -1 && j <= i;
        });
        if (!covered) hits.add(x.key);
      }
    }
    return hits;
  };
}

/**
 * 비인물 대상의 범위 안 건수를 센다 — 이름마다 줄 수, 대상마다 줄 수(이름들의 합집합) · 씬 수.
 * 결과는 dict.targets · dict.names 행에 linesInScope · storiesInScope로 붙는다(인물은 세지 않는다 — B2 몫).
 * @returns {{ zero: object[] }} 범위 안 0건인 이름 (추측한 표기일 수 있다)
 */
export function countTermMentions(lines, stories, dict) {
  const inScope = new Set(stories.filter((s) => s.inScope).map((s) => s.id));
  const termNames = dict.names.filter((n) => !n.targetId.startsWith('person:'));
  const match = compileNames(termNames.map((n) => ({ key: n, name: n.name, excludes: n.excludes })));
  const perTarget = new Map(); // id → { lines, stories:Set }
  for (const n of termNames) {
    n.linesInScope = 0;
    if (!perTarget.has(n.targetId)) perTarget.set(n.targetId, { lines: 0, stories: new Set() });
  }
  for (const l of lines) {
    if (!l.text || !inScope.has(l.storyId)) continue;
    const hits = match(l.text);
    if (!hits.size) continue;
    const ids = new Set();
    for (const n of hits) {
      n.linesInScope++;
      ids.add(n.targetId);
    }
    for (const id of ids) {
      const c = perTarget.get(id);
      c.lines++;
      c.stories.add(l.storyId);
    }
  }
  for (const [id, c] of perTarget) {
    const t = dict.targets.get(id);
    t.linesInScope = c.lines;
    t.storiesInScope = c.stories.size;
  }
  return { zero: termNames.filter((n) => n.linesInScope === 0) };
}

/**
 * 줄마다 이름표를 대상으로 푼다: speakerTarget(대상 ID, 여럿이면 NULL) · speakerClass(갈래) · speakerVia(이름표 | 코드).
 * 이름표 표(speakers)도 만든다 — 이름표마다 갈래 · 대상 · 줄 수(전체 · 범위 안).
 */
export function resolveSpeakers(lines, stories, dict) {
  const inScope = new Map(stories.map((s) => [s.id, s.inScope]));
  const table = new Map(); // 이름표 → 행
  const row = (label) => {
    if (!table.has(label)) {
      const v = dict.labels.get(label) ?? dict.autoLabel(label);
      table.set(label, {
        name: label,
        cls: v?.cls ?? null,
        targets: v?.targets ?? [],
        how: v?.how ?? (v?.ambiguous ? '모호' : null),
        note: v?.note ?? (v?.ambiguous ? `니케 목록에서 여러 인물에 걸림: ${v.ambiguous.join(', ')}` : null),
        lines: 0,
        linesInScope: 0,
        codeLines: 0,
      });
    }
    return table.get(label);
  };
  for (const l of lines) {
    if (!l.speakerName) continue;
    const r = row(l.speakerName);
    r.lines++;
    if (inScope.get(l.storyId)) r.linesInScope++;
    const rule = l.speakerId ? dict.codes.get(`${l.speakerName}\t${l.speakerId}`) : null;
    if (rule) {
      r.codeLines++;
      l.speakerTarget = rule.to;
      l.speakerClass = dict.targets.get(rule.to)?.kind ?? null;
      l.speakerVia = '코드';
    } else if (r.cls) {
      l.speakerTarget = r.targets.length === 1 ? r.targets[0] : null;
      l.speakerClass = r.cls;
      l.speakerVia = '이름표';
    }
  }
  return [...table.values()].sort((a, b) => b.lines - a.lines);
}
