/**
 * 이번 항목 맞춤 — 다음 읽기 항목의 원문에 나오는 대상을 기계적으로 뽑고, 그 대상을 다룬 앞 사실을 고른다.
 * 인계 파일(handoff.mjs)의 handoff/focus.md가 쓴다. 규칙은 docs/annotations.md "인계 파일".
 *
 *   대상 뽑기 — 원문 한 줄마다: 이름표 → 대상(DB speakers.targets) ∪ 대사 속 사전 이름(DB target_names, 오탐 주의 이름 · 한 글자 이름은 뺀다).
 *              검색 규칙은 사전 검색기(compileNames — 낱말 앞 · 더 긴 표기 뺌)와 같다. 대상마다 걸린 줄 수를 센다.
 *   사실 고르기 — 사실 점수 = Σ(사실의 about 대상 중 원문에 나온 것) log2(1 + 줄 수) / 그 대상을 다룬 사실 수.
 *              지휘관 · 니케처럼 사실이 많은 대상은 한 사실에 주는 몫이 작고, 이번 원문의 주인공처럼 드문 대상은 크다.
 *              점수 순으로 예산(글자)이 찰 때까지 담는다. 같은 점수는 읽은 순서.
 *   2회독(identity) — 줄의 speaker_target(이름표 코드로 푼 `???` 줄 포함)도 쓰고, 정체 연결(people.json L<n>)로 넓힌다(docs/annotations.md "2회독 인계 파일"):
 *              `이름표:X = B`는 그 연결의 근거 씬 안에서만 X 줄을 B로(`노인` · `여학생` 같은 이름표는 씬마다 다른 사람일 수 있다),
 *              2회독 암시 언급 `speaker: true` 줄은 그 인물로. 그 밖의 `???` · 미상 이름표 줄은 누구로도 치지 않는다 — 매번 다른 사람이라
 *              정체는 2회독이 씬 · 줄마다 읽어서 정한다(연결의 근거 줄도 정체를 보여 줄 뿐 그 인물이 말한 줄이라는 보장이 없다).
 *              `A = B`(이명 · 숨은 정체)는 같은 인물 무리를 대상 하나로 친다 —
 *              줄마다 무리의 대표 하나로 세고(canon), 사실의 about도 대표로 바꿔 센다. 이명마다 따로 세면 사실이 적은 이명이 점수 앞자리를 차지한다.
 * 같은 원문 · 같은 기록이면 같은 결과다(정렬 끝까지 결정적).
 */
import { compileNames } from '../normalize/dictionary.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);

/**
 * @param {object} ctx openContext()
 * @param {string[]} keys 읽기 키(단위 · 씬)
 * @param {{ identity?: boolean, links?: object[], speakerLines?: Map<string, string[]> }} [opts] 2회독 — identity: 위 규칙으로 넓힌다.
 *   links: 정체 연결 후보 객체(people.json candidates, 기각은 뺀다) · speakerLines: `씬\t줄` → 그 줄을 말한 인물(2회독 암시 언급 speaker: true)
 * @returns {Map<string, number>} 대상 ID → 걸린 줄 수 (많은 순, 같으면 ID 순)
 */
export function sourceTargets(ctx, keys, { identity = false, links = [], speakerLines = null } = {}) {
  const all = (sql) => ctx.db.prepare(sql).all();
  const bySpeaker = new Map();
  for (const s of all('SELECT name, targets FROM speakers WHERE targets IS NOT NULL')) {
    const ts = JSON.parse(s.targets);
    if (ts.length) bySpeaker.set(s.name, ts);
  }
  const names = all('SELECT target_id, name, excludes FROM target_names WHERE caution IS NULL ORDER BY target_id, name')
    .filter((n) => [...n.name].length >= 2)
    .map((n) => ({ key: n.target_id, name: n.name, excludes: JSON.parse(n.excludes ?? '[]') }));
  const match = compileNames(names);
  const id = identity ? identityRules(ctx, links, speakerLines) : null;
  const count = new Map();
  const seen = new Set();
  for (const key of keys) {
    for (const scene of ctx.resolve(key)?.scenes ?? []) {
      if (seen.has(scene)) continue;
      seen.add(scene);
      for (const l of ctx.lines(scene)) {
        const hit = new Set(l.text ? match(l.text) : []);
        for (const t of bySpeaker.get(l.speaker_name) ?? []) hit.add(t);
        if (id) {
          if (l.speaker_target) hit.add(l.speaker_target);
          for (const x of id.byLabel.get(l.speaker_name) ?? []) if (x.scenes.has(scene)) hit.add(x.b);
          for (const t of id.byLine.get(`${scene}\t${l.seq}`) ?? []) hit.add(t);
        }
        for (const t of id ? new Set([...hit].map(id.canon)) : hit) count.set(t, (count.get(t) ?? 0) + 1);
      }
    }
  }
  return new Map([...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/**
 * 정체 연결에서 대상 뽑기 규칙을 만든다 (2회독)
 * @returns {{ byLabel: Map<string, {b: string, scenes: Set<string>}[]>, byLine: Map<string, string[]>, canon: (t: string) => string, members: Map<string, string[]> }}
 *   byLabel: 이름표 → 그 이름표가 가리키는 인물과 근거 씬 · byLine: `씬\t줄` → 그 줄을 말한 인물(2회독 암시 언급 speaker: true만) ·
 *   canon: 대상 → 같은 인물 무리의 대표(연결의 b 쪽 — 숨은 정체 · 본명. 무리가 없으면 자기) · members: 대표 → 무리(대표 먼저)
 */
export function identityRules(ctx, links = [], speakerLines = null) {
  const byLabel = new Map();
  const byLine = new Map();
  const parent = new Map();
  const find = (x) => {
    while (parent.has(x) && parent.get(x) !== x) x = parent.get(x);
    return x;
  };
  const union = (a, b) => {
    for (const x of [a, b]) if (!parent.has(x)) parent.set(x, x);
    const [ra, rb] = [find(a), find(b)].sort();
    if (ra !== rb) parent.set(rb, ra);
  };
  const addLine = (key, t) => {
    const xs = byLine.get(key) ?? byLine.set(key, []).get(key);
    if (!xs.includes(t)) xs.push(t);
  };
  for (const l of links) {
    if (!l || l.status === '기각' || l.type !== 'same_as' || typeof l.a !== 'string' || !ctx.targetIds.has(l.b)) continue;
    const label = l.a.startsWith('이름표:') ? l.a.slice(4) : null;
    if (label) {
      const scenes = new Set(arr(l.evidence).map((e) => e?.scene).filter((x) => typeof x === 'string'));
      (byLabel.get(label) ?? byLabel.set(label, []).get(label)).push({ b: l.b, scenes });
    } else if (ctx.targetIds.has(l.a)) union(l.a, l.b);
  }
  for (const [k, ts] of speakerLines ?? []) for (const t of ts) addLine(k, t);
  // 대표 = 무리에서 연결의 a(이명 쪽)로 나온 적 없는 것 — 여럿이면 이름 순 첫째
  const aliases = new Set(links.filter((l) => l && l.status !== '기각' && l.type === 'same_as' && ctx.targetIds.has(l.a)).map((l) => l.a));
  const groups = new Map();
  for (const x of [...parent.keys()].sort()) {
    const r = find(x);
    (groups.get(r) ?? groups.set(r, []).get(r)).push(x);
  }
  const rep = new Map();
  const members = new Map();
  for (const ms of groups.values()) {
    const head = ms.find((x) => !aliases.has(x)) ?? ms[0];
    members.set(head, [head, ...ms.filter((x) => x !== head)]);
    for (const x of ms) rep.set(x, head);
  }
  return { byLabel, byLine, canon: (t) => rep.get(t) ?? t, members };
}

const aboutRaw = (c) => (Array.isArray(c.obj?.about) ? c.obj.about.filter((x) => typeof x === 'string') : []);

/**
 * @param {object[]} facts 사실 후보 (읽은 순서로 정렬된 것)
 * @param {object[]} pool 고를 사실 (facts의 부분집합)
 * @param {Map<string, number>} hits sourceTargets() 결과
 * @param {number} budget 글자 예산
 * @param {(c: object) => number} size 사실 한 줄의 글자 수
 * @param {{ canon?: (t: string) => string }} [opts] 2회독 — about을 같은 인물 무리의 대표로 바꿔 센다(hits도 대표로 센 것을 준다)
 * @returns {{ picked: {fact: object, score: number, best: string}[], total: number, left: number }} picked는 점수 순. left = 원문 대상과 이어지는데 예산으로 못 담은 사실 수
 */
export function pickFacts(facts, pool, hits, budget, size, { canon = null } = {}) {
  const aboutOf = canon ? (c) => [...new Set(aboutRaw(c).map(canon))] : aboutRaw;
  const nFacts = new Map();
  for (const f of facts) for (const t of new Set(aboutOf(f))) nFacts.set(t, (nFacts.get(t) ?? 0) + 1);
  const rank = new Map(facts.map((f, i) => [f, i]));
  const scored = [];
  for (const f of pool) {
    let score = 0;
    let best = null;
    let bestPart = 0;
    for (const t of [...new Set(aboutOf(f))].sort()) {
      const h = hits.get(t);
      if (!h) continue;
      const part = Math.log2(1 + h) / nFacts.get(t);
      score += part;
      if (part > bestPart) {
        best = t;
        bestPart = part;
      }
    }
    if (score > 0) scored.push({ fact: f, score, best });
  }
  scored.sort((a, b) => b.score - a.score || rank.get(a.fact) - rank.get(b.fact));
  const picked = [];
  let total = 0;
  for (const s of scored) {
    const n = size(s.fact);
    if (total + n > budget) break;
    picked.push(s);
    total += n;
  }
  return { picked, total, left: scored.length - picked.length };
}
