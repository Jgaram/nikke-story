/**
 * 공개 개요(W8) → site/data/synopsis.json — 스토리별 한 줄 소개 · 줄거리 · 씬 한 줄. 규칙은 docs/annotations.md "공개 개요".
 *
 * 입력: annotations/synopsis/<단위>.json 만. 1회독 `summary` · `scenes`(작업 메모)는 읽지 않는다(docs/views.md "공개 규칙").
 * 싣는 것: 확정했고 확정한 뒤 고치지 않은 개요(지문이 맞는 것)만. 원문 없이 되는 검사(칸 · 길이 · 금지 꼴)에 오류가 있으면 빼고 경고한다.
 *   원문 겹침 · 스포일러 경고는 `node tools/synopsis.mjs check`가 본다(내보낸 뒤 check-quotes가 40자 겹침을 다시 본다).
 *
 * synopsis.json = [{ key, logline, synopsis, scenes?: { <씬 ID>: 한 줄 } }] — 읽는 순서대로
 *   개요가 하나도 없어도 빈 배열로 쓴다 — 사이트는 칸을 그리지 않는다(W9가 채우는 대로 늘어난다).
 */
import { compact, publishText } from '../lib.mjs';
import { checkSynopsis, loadSynopses, stateOf } from '../../synopsis/model.mjs';

export const name = 'synopsis';

export async function run(ctx) {
  const { units: siteUnits, scenesOf } = ctx.common;
  const known = new Set(siteUnits.map((u) => u.key));
  const set = loadSynopses(ctx.synopsisDir); // 테스트는 ctx.synopsisDir로 다른 디렉터리를 준다
  for (const p of set.problems) ctx.warn({ where: `synopsis/${p.file}`, msg: p.msg });
  const order = new Map(siteUnits.map((u) => [u.key, u.order]));
  const out = [];
  let changed = 0;
  for (const { file, data: s } of set.list) {
    const key = s?.unit;
    const where = `synopsis/${file}`;
    if (!known.has(key)) {
      ctx.warn({ where, msg: `사이트에 없는 단위 — ${key}` });
      continue;
    }
    const st = stateOf(s);
    if (st.changed) changed++;
    if (!st.ok) continue;
    const { errors } = checkSynopsis(s, { scenes: (scenesOf.get(key) ?? []).map((x) => x.id) });
    if (errors.length) {
      ctx.warn({ where, msg: `확정했지만 검사 오류가 있어 뺐다 — ${errors[0]}` });
      continue;
    }
    const scenes = {};
    for (const x of s.scenes ?? []) if (x?.text?.trim()) scenes[x.scene] = publishText(x.text.trim(), `${where} ${x.scene}`, ctx.warn);
    out.push(compact({
      key,
      logline: publishText(s.logline.trim(), `${where} logline`, ctx.warn),
      synopsis: publishText(s.synopsis.trim(), `${where} synopsis`, ctx.warn),
      scenes: Object.keys(scenes).length ? scenes : null,
    }));
  }
  out.sort((a, b) => order.get(a.key) - order.get(b.key));
  if (changed) ctx.warn({ where: 'synopsis', msg: `확정한 뒤 고친 개요 ${changed}개를 뺐다 — node tools/synopsis.mjs check` });
  return { files: { 'synopsis.json': out } };
}
