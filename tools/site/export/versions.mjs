/**
 * 시점별 판(W15c) → site/data/versions.json — 떡밥 제목 · 요약(W15c · W15d), 사전 설명(W15e)을 여기까지 읽음마다 따로 보인다. 규칙은 docs/annotations.md "시점별 판",
 * 도구는 tools/versions.mjs, 화면은 fmt.threadAt · fmt.noteAt(data.js가 떡밥 j.v · 대상 t.v로 붙인다).
 *
 * 입력: annotations/versions/<대상>.json + 이번 내보내기의 units.json · threads.json · threads-flow.json · targets.json · records*.json(ctx.made — 판 지문 · 이름 검사).
 * 싣는 것: 판마다 확정했고 · 확정한 뒤 고치지 않았고 · 흐름이 그대로인(낡지 않은) · 검사 오류가 없는 것만. 빠진 판은 화면이 그 앞 판을 보인다
 *   (덜 아는 쪽이라 새지 않는다). 원문 겹침 · DB 이름 경고는 `node tools/versions.mjs check`가 본다.
 *
 * versions.json = { threads: { <줄기 ID>: [{ at, title, text }] }, targets: { <대상 ID>: [{ at, text }] } } — 판은 읽는 순서대로
 */
import { publishText } from '../lib.mjs';
import { VERSION_DIR, isDict, loadVersions, publishable, sourcesFrom, threadId } from '../../versions/model.mjs';

export const name = 'versions';

export async function run(ctx) {
  const C = sourcesFrom({
    units: ctx.made['units.json'] ?? ctx.common.units, threads: ctx.made['threads.json'], flow: ctx.made['threads-flow.json'], targets: ctx.made['targets.json'],
    records: [...(ctx.made['records.json'] ?? []), ...(ctx.made['records2.json'] ?? [])],
  });
  const set = loadVersions(ctx.versionDir ?? VERSION_DIR); // 테스트는 ctx.versionDir로 다른 디렉터리를 준다
  for (const p of set.problems) ctx.warn({ where: `versions/${p.file}`, msg: p.msg });
  const threads = {};
  const targets = {};
  let dropped = 0;
  for (const { file, data: f } of set.list) {
    const id = threadId(f?.subject);
    const dict = isDict(f?.subject);
    if (!id && !dict) continue;
    const where = `versions/${file}`;
    const { list, errors } = publishable(f, C);
    const confirmed = (f.versions ?? []).filter((v) => v?.status === '확정').length;
    if (errors.length && confirmed) ctx.warn({ where, msg: `검사 오류가 있는 판은 뺐다 — ${errors[0]}` });
    dropped += confirmed - list.length;
    const text = (v) => publishText(v.text, `${where} ${v.at} text`, ctx.warn);
    if (!list.length) continue;
    if (dict) targets[f.subject] = list.map((v) => ({ at: v.at, text: text(v) }));
    else threads[id] = list.map((v) => ({ at: v.at, title: publishText(v.title, `${where} ${v.at} title`, ctx.warn), text: text(v) }));
  }
  if (dropped > 0) ctx.warn({ where: 'versions', msg: `확정했지만 낡았거나 고쳤거나 오류가 있는 판 ${dropped}개를 뺐다 — 화면은 그 앞 판 · node tools/versions.mjs check` });
  const order = (id) => Number(id.slice(1));
  return { files: { 'versions.json': {
    threads: Object.fromEntries(Object.entries(threads).sort((a, b) => order(a[0]) - order(b[0]))),
    targets: Object.fromEntries(Object.entries(targets).sort((a, b) => a[0].localeCompare(b[0]))),
  } } };
}
