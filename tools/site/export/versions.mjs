/**
 * 시점별 판(W15c) → site/data/versions.json — 떡밥 제목 · 요약(W15c · W15d), 사전 설명(W15e)을 여기까지 읽음마다 따로 보인다. 규칙은 docs/annotations.md "시점별 판",
 * 도구는 tools/versions.mjs, 화면은 fmt.threadAt · fmt.noteAt(data.js가 떡밥 j.v · 대상 t.v로 붙인다).
 *
 * 입력: annotations/versions/<대상>.json + 이번 내보내기의 units.json · threads.json · threads-flow.json · targets.json · records*.json(ctx.made — 판 지문 · 이름 검사).
 * 싣는 것: 판마다 확정했고 · 확정한 뒤 고치지 않았고 · 흐름이 그대로인(낡지 않은) · 검사 오류가 없는 것만. 빠진 판은 화면이 그 앞 판을 보인다
 *   (덜 아는 쪽이라 새지 않는다). 원문 겹침 · DB 이름 경고는 `node tools/versions.mjs check`가 본다.
 *
 * versions.json = { threads: { <줄기 ID>: [{ at, title, text, need? }] }, targets: { <대상 ID>: [{ at, text, need? }] } } — 판은 읽는 순서대로.
 *   side · until = 곁 판(W15f — 체크 칸 스토리에서만 드러난 것, 안 본 독자는 건너뜀 · 본 독자는 until 본판까지 이것). need = [[스토리 키, …], …] 판을 보려면 묶음마다 하나라도 봐야 하는 스토리(W15f — versionNeed: 체크 칸 스토리에서만 먼저 쓰인 이름 등). 없으면 칸 없음
 */
import { publishText } from '../lib.mjs';
import { VERSION_DIR, isDict, loadVersions, publishable, sourcesFrom, threadId, versionNeed } from '../../versions/model.mjs';

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
    // need — 판을 보려면 봐야 하는 스토리 묶음(체크 칸 스토리에서만 먼저 쓰인 이름 · 안 본 스토리 이름, W15f). 화면 fmt.versionAt이 못 채우면 그 앞 판에서 멈춘다
    // 그 판을 보는 독자가 늘 본 at — 앞 본판들 + 이 판(곁 판은 안 본 독자가 건너뛰므로 다른 곁 판의 at은 넣지 않는다)
    const chainOf = (i) => [...list.slice(0, i).filter((x) => !x.side).map((x) => x.at), list[i].at];
    const needOf = (v, i) => { const need = versionNeed([v.title, v.text], chainOf(i), C); return need ? { need } : {}; };
    const sideOf = (v) => (v.side ? { side: true, ...(v.until ? { until: v.until } : {}) } : {});
    if (dict) targets[f.subject] = list.map((v, i) => ({ at: v.at, text: text(v), ...sideOf(v), ...needOf(v, i) }));
    else threads[id] = list.map((v, i) => ({ at: v.at, title: publishText(v.title, `${where} ${v.at} title`, ctx.warn), text: text(v), ...sideOf(v), ...needOf(v, i) }));
  }
  if (dropped > 0) ctx.warn({ where: 'versions', msg: `확정했지만 낡았거나 고쳤거나 오류가 있는 판 ${dropped}개를 뺐다 — 화면은 그 앞 판 · node tools/versions.mjs check` });
  const order = (id) => Number(id.slice(1));
  return { files: { 'versions.json': {
    threads: Object.fromEntries(Object.entries(threads).sort((a, b) => order(a[0]) - order(b[0]))),
    targets: Object.fromEntries(Object.entries(targets).sort((a, b) => a[0].localeCompare(b[0]))),
  } } };
}
