/**
 * 공개 개요(W8)의 입력 묶음 — 단위 하나의 1회독 기록을 개요를 쓰기 좋은 글로 편다. 원문(대사 본문)은 넣지 않는다.
 * docs/annotations.md "공개 개요" — 입력은 1회독 요약 · 씬 한 줄 + 확정 사실 · 의문 · 사건 · 시점 + 대상 메모 + 2회독 바로잡기, 기각된 것은 따로("쓰지 말 것").
 */
import { KIND_LABEL, unitKind } from './model.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);
const READ2_SESSION = /^(?:P|M)\d/;

/**
 * @param {string} key 단위 키
 * @param {{ ds: object, ctx: object, places: { unitPos: Map<string, number> }, units?: Map<string, object> }} env
 *   ds = loadDataset(), ctx = openContext(), places = scenePlaces(), units = 단위 키 → timeline units.csv 행(출시일)
 * @returns {string | null} 단위를 모르면 null
 */
export function buildInput(key, { ds, ctx, places, units = new Map() }) {
  const r = ctx.resolve(key);
  if (!r) return null;
  const kind = unitKind(key);
  const files = ds.files.filter((f) => f.data?.unit === key).sort((a, b) => partStart(a.data?.parts) - partStart(b.data?.parts));
  const names = new Set(files.map((f) => f.name));
  const mine = ds.candidates.filter((c) => names.has(c.file) && c.id && ['facts', 'questions', 'events', 'times'].includes(c.section));
  const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
  const row = units.get(key);
  const title = r.type === 'scene' ? r.title : r.unit?.title ?? key;
  const out = [];
  out.push(`# ${key} — ${title}`);
  out.push(`${KIND_LABEL[kind]} · 읽는 순서 ${places.unitPos.get(key) ?? '?'}번째${row?.date ? ` · 공개 ${row.date}${row.confidence === '추정' ? '(추정)' : ''}` : ''} · ${r.scenes.length}장면`);

  // 장면 — 씬 ID · 제목 · 1회독 씬 한 줄(있으면)
  const sceneLine = new Map();
  for (const x of ds.scenes.filter((x) => names.has(x.file) && x.obj?.scene)) sceneLine.set(x.obj.scene, x.obj.text ?? '');
  out.push('', '## 장면');
  for (const id of r.scenes) {
    const t = ctx.story(id)?.title;
    const line = sceneLine.get(id);
    out.push(`- ${id}${t ? ` 「${t}」` : ''}${line ? ` — ${line}` : ''}`);
  }

  out.push('', '## 1회독 요약 (작업 메모 — 그대로 옮기지 않는다)');
  for (const f of files) out.push(`${f.data?.parts ? `[파트 ${f.data.parts}] ` : ''}${f.data?.summary ?? ''}`);

  const mark = (c) => {
    const m = [];
    if (c.confidence === '추정') m.push(c.section === 'questions' ? '추정' : '추정 — "~라고 말한다"처럼 누가 한 말인지로');
    if (c.fix && READ2_SESSION.test(c.session ?? '')) m.push('2회독에서 더함');
    const fixed = arr(c.reviews).filter((v) => v?.before);
    if (fixed.length) m.push(`2회독에서 고침 — 전: ${fixed.at(-1).before}`);
    return m.length ? ` [${m.join(' · ')}]` : '';
  };
  const live = mine.filter((c) => c.status !== '기각');
  const sec = (label, xs, fn) => {
    if (!xs.length) return;
    out.push('', `## ${label}`, ...xs.map(fn));
  };
  sec('사실', live.filter((c) => c.section === 'facts'), (c) => `- ${c.id} ${c.text}${mark(c)}`);
  sec('의문 (이 단위에서 던짐 — 답은 쓰지 않는다)', live.filter((c) => c.section === 'questions'), (c) => `- ${c.id} ${c.text}${mark(c)}`);
  sec('사건 (앞 의문 · 사실이 여기서 풀림 · 다시 드러남 · 뒤집힘)', live.filter((c) => c.section === 'events'), (c) => {
    const parent = byId.get(c.parent);
    const what = c.act === '회수' ? `회수(${c.obj?.degree ?? '?'})` : c.act;
    return `- ${c.id} ${what}: ${parent ? `「${parent.text}」(${parent.unit})` : c.parent} → ${c.text ?? ''}${c.obj?.answer && byId.get(c.obj.answer) ? ` / 답 ${c.obj.answer}: ${byId.get(c.obj.answer).text}` : ''}${mark(c)}`;
  });
  sec('작중 시점', live.filter((c) => c.section === 'times'), (c) => `- ${c.id} ${c.act ?? ''} — ${c.text}`);
  const targets = ds.targets.filter((t) => names.has(t.file) && t.obj?.target);
  sec('나오는 대상 (그 자리의 이름으로 쓴다)', targets, (t) => `- ${t.obj.target}${t.obj.note ? ` — ${t.obj.note}` : ''}`);
  sec('기각 — 쓰지 말 것', mine.filter((c) => c.status === '기각'), (c) => `- ${c.id} ${c.text} (기각${arr(c.reviews).at(-1)?.note ? `: ${arr(c.reviews).at(-1).note}` : ''})`);
  const slips = files.flatMap((f) => arr(f.data?.slips).filter((x) => typeof x === 'string'));
  sec('설정 오류 추정 (개요는 따르는 쪽으로)', slips, (x) => `- ${x}`);
  return out.join('\n');
}

const partStart = (p) => (p ? Number(String(p).split('-')[0]) : 0);
