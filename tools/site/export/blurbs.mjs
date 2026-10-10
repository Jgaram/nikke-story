/**
 * 팬용 문장(W14) → site/data/blurbs.json — 리더 분류 칸 '이유' · 연대기 카드 '추정한 이유'에 판정 문장 대신 뜨는 한두 문장.
 * 규칙은 docs/annotations.md "팬용 문장", 도구는 tools/blurbs.mjs.
 *
 * 입력: annotations/blurbs/<단위>.json + 이번 내보내기의 order.json · chrono.json · units.json(ctx.made — 판정 지문을 잰다).
 * 싣는 것: 칸마다 확정했고 · 확정한 뒤 고치지 않았고 · 판정이 그대로인(낡지 않은) 것만. 원문 없이 되는 검사(checkBlurb)에 오류가 있는 칸은 빼고 경고한다.
 *   빠진 칸은 화면이 지금처럼 거른 판정 문장(fmt.reasonText · dropClauses)을 보인다. 원문 겹침 · 스포일러 이름은 `node tools/blurbs.mjs check`가 본다.
 *
 * blurbs.json = [{ key, why?: { text, later?, gate? }, when?: { text, later?, gate? } }] — 읽는 순서대로
 *   later는 화면이 여기까지 읽음이 gate(뒤 스토리 단위 키)를 지났을 때만(전부 보기면 늘) text 뒤에 붙인다.
 */
import { compact, publishText } from '../lib.mjs';
import { BLURB_DIR, PARTS, checkBlurb, loadBlurbs, sourcesFrom, srcHash, stateOf } from '../../blurbs/model.mjs';

export const name = 'blurbs';

export async function run(ctx) {
  const { units: siteUnits } = ctx.common;
  const order = new Map(siteUnits.map((u) => [u.key, u.order]));
  const sources = sourcesFrom({ order: ctx.made['order.json'], chrono: ctx.made['chrono.json'], units: ctx.made['units.json'] ?? siteUnits });
  const set = loadBlurbs(ctx.blurbDir ?? BLURB_DIR); // 테스트는 ctx.blurbDir로 다른 디렉터리를 준다
  for (const p of set.problems) ctx.warn({ where: `blurbs/${p.file}`, msg: p.msg });
  const out = [];
  const skipped = { changed: 0, stale: 0 };
  for (const { file, data: b } of set.list) {
    const key = b?.unit;
    const where = `blurbs/${file}`;
    if (!order.has(key)) {
      ctx.warn({ where, msg: `사이트에 없는 단위 — ${key}` });
      continue;
    }
    const { errors } = checkBlurb(b, sources);
    const item = { key };
    for (const part of Object.keys(PARTS)) {
      const e = b[part];
      if (!e) continue;
      const st = stateOf(e, srcHash(part, sources[part].get(key)));
      if (e.status === '확정' && st.changed) skipped.changed++;
      if (e.status === '확정' && !st.changed && st.stale) skipped.stale++;
      if (!st.ok) continue;
      const errs = errors.filter((m) => m.startsWith(`${part}:`));
      if (errs.length) {
        ctx.warn({ where, msg: `확정했지만 검사 오류가 있어 뺐다 — ${errs[0]}` });
        continue;
      }
      item[part] = compact({
        text: publishText(e.text.trim(), `${where} ${part}`, ctx.warn),
        later: e.later?.trim() ? publishText(e.later.trim(), `${where} ${part}.later`, ctx.warn) : null,
        gate: e.later?.trim() ? e.gate : null,
      });
    }
    if (Object.keys(item).length > 1) out.push(item);
  }
  out.sort((a, b) => order.get(a.key) - order.get(b.key));
  if (skipped.changed) ctx.warn({ where: 'blurbs', msg: `확정한 뒤 고친 칸 ${skipped.changed}개를 뺐다 — node tools/blurbs.mjs check` });
  if (skipped.stale) ctx.warn({ where: 'blurbs', msg: `판정이 바뀐(낡은) 칸 ${skipped.stale}개를 뺐다 — 화면은 거른 판정 문장 · node tools/blurbs.mjs check` });
  return { files: { 'blurbs.json': out } };
}
