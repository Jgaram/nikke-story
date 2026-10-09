/**
 * X1c — 작중 연대기 ② 좁히기 단서표. 해석이 아니다 — Claude가 좁힘 항목(annotations/chronology.json units)을 정할 때 보는 기계적 신호다.
 * 원문 문장은 담지 않는다(코드 · 대상 ID · 챕터 키 · 줄 수만). 시트는 쓰지 않는다.
 *
 *   codes    시점과 이어진 모습 코드(chronology.json codes)가 이 단위에서 쓰인 것 — 코드(그 코드의 관계) 줄 수
 *   intro    이 단위에 나오는 대상(언급 DB) 가운데 읽는 순서로 처음 나온 단위가 메인 챕터인 것 — 늦은 챕터 순 6개, 대상(줄 수).
 *            메인에서 처음 나왔다고 작중에서 그때 생긴 것은 아니다 — 첫 만남 · 생긴 때인지는 Claude가 원문 기록으로 본다
 *   changes  이 단위에 나오는 인물 가운데 메인 챕터에서 소속 · 신체 · 기억이 바뀐 인물(2회독 인물 변화 D, 기각 뺌) — 인물: 바뀐 챕터들
 *            '아직 안 바뀐 모습'으로 나오면 상한, '바뀐 뒤 모습'이면 하한의 실마리다
 */

const INTRO_TOP = 6;
const CHANGE_ASPECTS = new Set(['소속', '신체', '기억']);
const isMain = (k) => /^ch\d+$/.test(k);
const short = (id) => id.replace(/^[a-z]+:/, '');

/**
 * @param {{ ctx: object, rel: { units: { unit: string, kind: string }[] }, ds: { candidates: object[] }, codes: { code: string, at?: any[] }[] }} input
 * @returns {Map<string, { codes: string, intro: string, changes: string }>} 단위 키 → 단서(메인 챕터는 뺀다)
 */
export function chronoClues({ ctx, rel, ds, codes }) {
  const order = new Map(rel.units.map((u, i) => [u.unit, i]));
  const sceneUnit = new Map();
  for (const u of rel.units) for (const s of ctx.resolve(u.unit)?.scenes ?? []) if (!sceneUnit.has(s)) sceneUnit.set(s, u.unit);
  const add = (m, k, v, n) => {
    if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(v, (m.get(k).get(v) ?? 0) + n);
  };

  // 모습 코드
  const codeAt = new Map(codes.filter((c) => c?.code).map((c) => [c.code, (c.at ?? []).map((r) => `${r[0]} ${r[1]}`).join(' · ')]));
  const codeUse = new Map();
  if (codeAt.size) {
    const q = `SELECT story_id, speaker_id, COUNT(*) n FROM lines WHERE speaker_id IN (${[...codeAt.keys()].map(() => '?').join(',')}) GROUP BY story_id, speaker_id`;
    for (const r of ctx.db.prepare(q).all(...codeAt.keys())) {
      const u = sceneUnit.get(r.story_id);
      if (u) add(codeUse, u, r.speaker_id, r.n);
    }
  }

  // 언급 — 대상이 처음 나온 단위(읽는 순서)
  const per = new Map();
  const first = new Map();
  for (const r of ctx.db.prepare('SELECT story_id, target, SUM(lines) n FROM mentions GROUP BY story_id, target').all()) {
    const u = sceneUnit.get(r.story_id);
    if (!u) continue;
    add(per, u, r.target, r.n);
    if (!first.has(r.target) || order.get(first.get(r.target)) > order.get(u)) first.set(r.target, u);
  }

  // 메인 챕터에서 바뀐 인물
  const changed = new Map();
  for (const c of ds.candidates) {
    if (c.kind !== 'change' || c.status === '기각' || c.obj?.act !== '변화' || !CHANGE_ASPECTS.has(c.obj?.aspect) || !isMain(c.unit)) continue;
    if (!changed.has(c.obj.person)) changed.set(c.obj.person, new Set());
    changed.get(c.obj.person).add(c.unit);
  }

  const out = new Map();
  for (const u of rel.units) {
    if (isMain(u.unit)) continue;
    const ts = per.get(u.unit) ?? new Map();
    const intro = [...ts]
      .filter(([t]) => isMain(first.get(t) ?? ''))
      .map(([t, n]) => [first.get(t), t, n])
      .sort((a, b) => b[0].localeCompare(a[0]) || b[2] - a[2])
      .slice(0, INTRO_TOP)
      .map(([ch, t, n]) => `${ch} ${short(t)}(${n})`);
    const changes = [...ts.keys()]
      .filter((t) => changed.has(t))
      .sort()
      .map((t) => `${short(t)}: ${[...changed.get(t)].sort().join(' ')}`);
    const cs = [...(codeUse.get(u.unit) ?? new Map())].sort().map(([c, n]) => `${c}(${codeAt.get(c) || '—'}) ${n}줄`);
    out.set(u.unit, { codes: cs.join('; '), intro: intro.join(' · '), changes: changes.join('; ') });
  }
  return out;
}
