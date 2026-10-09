/**
 * 인계 파일 — 다음 읽기 세션이 원문 대신 읽는 것. 기록 파일에서 만들고 손으로 고치지 않는다.
 *
 *   먼저 읽을 것 (다음 항목 맞춤 — 1회독 끝까지 합계가 대략 일정하게, FIRST_MAX 안쪽)
 *   annotations/read1/HANDOFF.md            진행 위치 · 다음 번호 · 되짚기 메모 · 파일 안내
 *   annotations/read1/handoff/questions.md  열린 의문 · 일부 풀린 의문 전부 (2만 자를 넘으면 questions-1.md …)
 *   annotations/read1/handoff/recent.md     직전 세션의 사실 전부 (다음 세션이 진행 중이면 그 앞 세션 것까지)
 *   annotations/read1/handoff/focus.md      다음 항목 원문에 나오는 대상(이름표 · 사전 이름)의 앞 사실 — focus.mjs
 *   필요할 때 여는 것
 *   annotations/read1/handoff/index.md      필요할 때 여는 파일 목록 (세션마다 늘어 HANDOFF.md에서 뺐다)
 *   annotations/read1/handoff/facts.md      사실 목록 전체 (기각 뺌)
 *   annotations/read1/handoff/questions-solved.md  풀린 의문
 *   annotations/read1/handoff/<세션>.md     세션(R01 …)마다 단위 요약 · 씬 한 줄 · 그 단위의 기록
 *
 * 파일이 FILE_MAX를 넘으면 절(세션 · 단위) 경계에서 facts-1.md · facts-2.md …, R01-1.md …로 나눈다.
 * 만든 시각 같은 흔들리는 값은 넣지 않는다 — 같은 기록 · 원문이면 같은 파일이 나와야 검증기가 "오래됐다"를 가릴 수 있다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { KIND_LABEL } from '../lib/units.mjs';
import { citeOf, isRecord, nextIds } from './model.mjs';
import { orderIndex } from './review.mjs';
import { kindTally } from './order.mjs';
import { pickFacts, sourceTargets } from './focus.mjs';

/** 목록 · 요약 파일 하나의 상한(글자) */
export const FILE_MAX = 20_000;
/** 세션을 시작할 때 늘 읽는 것(HANDOFF.md + 사실 · 의문 목록)의 상한 — SESSIONS.md "컨텍스트 예산" */
export const FIRST_MAX = 60_000;
/** focus.md에 담는 사실의 글자 예산 — 위아래 한도. 실제 예산은 FIRST_MAX에서 다른 "먼저 읽을 것"을 뺀 만큼(이 범위 안) */
export const FOCUS_MAX = 20_000;
export const FOCUS_MIN = 8_000;
/** 예산을 잴 때 HANDOFF.md 몫으로 잡아 두는 글자 수 (표 · 절 머리 포함) */
const HEAD_RESERVE = 3_000;

const len = (s) => [...s].length;
const fmtN = (n) => n.toLocaleString('ko-KR');
const mark = (c) => (c.status === '확정' ? ' ✓' : '');
const firstCite = (c) => (Array.isArray(c.evidence) && c.evidence.length ? citeOf(c.evidence[0]) : '');
/** 단위와 첫 근거 — 단위가 곧 그 씬이면(sub:…_00) 한 번만 */
const where = (c) => {
  const cite = firstCite(c);
  return cite.startsWith(`${c.unit}#`) ? cite : `${c.unit} ${cite}`.trim();
};

/**
 * @returns {{ files: Map<string, string>, firstTotal: number, firstNames: string[], warnings: string[] }} files: 인계 디렉터리 기준 상대 경로 → 내용, firstNames: 먼저 읽을 것
 */
export function buildHandoff(ds, ctx, order) {
  const warnings = [];
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각' && isRecord(c));
  const rank = (c) => [orderIndex(order, c.unit, c.parts), c.file ?? '', { facts: 0, questions: 1, events: 2, times: 3 }[c.section] ?? 9, c.index];
  const byRank = (a, b) => {
    const x = rank(a);
    const y = rank(b);
    return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2] - y[2] || x[3] - y[3];
  };
  const facts = live.filter((c) => c.section === 'facts').sort(byRank);
  const questions = live.filter((c) => c.section === 'questions').sort(byRank);
  const events = live.filter((c) => c.section === 'events').sort(byRank);
  const eventsOf = (id) => events.filter((e) => e.parent === id);
  const answersOf = (id) => events.filter((e) => e.act === '회수' && e.obj?.answer === id);

  const sessionRank = new Map(order.sessions.map((s, i) => [s.id, i]));
  const sessionOf = (c) => c.session ?? '(세션 없음)';
  const groupBySession = (list) => {
    const m = new Map();
    for (const c of list) (m.get(sessionOf(c)) ?? m.set(sessionOf(c), []).get(sessionOf(c))).push(c);
    return [...m].sort(([a], [b]) => (sessionRank.get(a) ?? 1e9) - (sessionRank.get(b) ?? 1e9) || a.localeCompare(b));
  };

  // ── 사실 목록 ──
  const factLine = (f) => {
    const tail = [];
    for (const e of eventsOf(f.id)) {
      const where = e.unit !== f.unit ? e.unit : '같은 단위';
      if (e.act === '드러냄') tail.push(`+${where}(${e.id}${mark(e)})`);
      else if (e.act === '뒤집음') tail.push(`⟲${where}(${e.id}${mark(e)})${e.obj?.replacedBy ? `→${e.obj.replacedBy}` : ''}`);
    }
    const solved = answersOf(f.id).map((e) => e.parent);
    if (solved.length) tail.push(`푼 의문 ${[...new Set(solved)].join(' ')}`);
    return `- ${f.id}${mark(f)} ${f.text} · ${where(f)}${tail.length ? ` · ${tail.join(' · ')}` : ''}`;
  };
  const factSections = groupBySession(facts).map(([s, list]) => ({ head: `## ${s}`, lines: list.map(factLine) }));

  // ── 의문 목록 ──
  const qState = (q) => {
    const ans = eventsOf(q.id).filter((e) => e.act === '회수');
    if (ans.some((e) => e.obj?.degree === '전부')) return { state: '풀림', ans };
    if (ans.length) return { state: '일부', ans };
    return { state: '열림', ans };
  };
  const qLine = (q) => {
    const { ans } = qState(q);
    const tail = ans.map((e) => `${e.obj?.degree === '전부' ? '풀림' : '일부'} → ${e.obj?.answer}${mark(e)} (${e.id}${e.unit !== q.unit ? ` ${e.unit}` : ''})`);
    return `- ${q.id}${mark(q)} ${q.text} · ${where(q)}${tail.length ? ` · ${tail.join(' · ')}` : ''}`;
  };
  const qCount = { 열림: 0, 일부: 0, 풀림: 0 };
  const qSections = []; // 열림 · 일부 — 먼저 읽는다
  const solvedSections = []; // 풀림 — 필요할 때
  for (const [state, title] of [['열림', '열린 의문'], ['일부', '일부 풀린 의문'], ['풀림', '풀린 의문']]) {
    const list = questions.filter((q) => qState(q).state === state);
    qCount[state] = list.length;
    for (const [s, xs] of groupBySession(list)) (state === '풀림' ? solvedSections : qSections).push({ head: `## ${title} — ${s}`, lines: xs.map(qLine) });
  }

  const files = new Map();
  const rejected = ds.candidates.filter((c) => c.id && c.status === '기각' && isRecord(c)).length;
  const listFiles = (base, title, intro, sections) => {
    const chunks = [];
    let cur = [];
    // 머리말(제목 · (k/n) · 소개) 몫을 먼저 잡아 파일 하나가 FILE_MAX를 넘지 않게 한다
    const head = len(`# ${title} (99/99)\n\n${intro}\n\n`); // (k/n)은 두 자리까지 잡는다 — facts가 33파일이 되자 (9/9)로는 2자 넘쳤다(C1)
    let size = head;
    for (const sec of sections) {
      const text = [sec.head, ...sec.lines].join('\n');
      if (cur.length && size + len(text) > FILE_MAX) {
        chunks.push(cur);
        cur = [];
        size = head;
      }
      cur.push(text);
      size += len(text) + 2;
    }
    if (cur.length || !chunks.length) chunks.push(cur);
    const names = chunks.length === 1 ? [`handoff/${base}.md`] : chunks.map((_, i) => `handoff/${base}-${i + 1}.md`);
    chunks.forEach((ch, i) => {
      const part = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      const body = ch.length ? ch.join('\n\n') : '(아직 없음)';
      files.set(names[i], `# ${title}${part}\n\n${intro}\n\n${body}\n`);
    });
    return names;
  };
  const autoNote = '자동으로 만든 파일이다 — 손으로 고치지 않는다(node tools/records.mjs handoff). 형식 · 규칙은 docs/annotations.md.';
  const factNames = listFiles('facts', '사실 목록 — 1회독', [
    autoNote,
    `사실 ${facts.length}건 (${rejected ? `기각된 후보 ${rejected}건은 뺐다 — 사실 · 의문 · 사건 · 시점 합계` : '기각 없음'}). \`✓\` 확정 · 표시 없음 = 후보. 줄 끝: 처음 기록한 단위와 근거.`,
    '뒤 기록: `+단위(F12-2)` 다시 드러냄 · `⟲단위(F12-3)→F30` 뒤집음(→ 새 사실) · `푼 의문 Q3` 이 사실이 답이 된 의문.',
  ].join('\n'), factSections);
  const qNames = listFiles('questions', '의문 목록 — 1회독 (열림 · 일부 풀림)', [
    autoNote,
    `의문 ${questions.length}건 — 열림 ${qCount.열림} · 일부 풀림 ${qCount.일부} · 풀림 ${qCount.풀림} (기각 뺌). \`✓\` 확정. 풀린 의문은 questions-solved.md(필요할 때).`,
    '`일부 → F7 (Q3-2 단위)`: 회수 기록과 답이 된 사실. 새로 풀리는 것을 보면 events에 회수를 적는다.',
  ].join('\n'), qSections);
  const solvedNames = listFiles('questions-solved', '풀린 의문 — 1회독', [
    autoNote,
    `풀린 의문 ${qCount.풀림}건. \`풀림 → F7 (Q3-2 단위)\`: 회수 기록과 답이 된 사실.`,
  ].join('\n'), solvedSections);

  // ── 진행 위치 — 다음 항목 · 직전 세션 ──
  const fileOf = new Set(ds.files.filter((f) => f.data?.unit).map((f) => `${f.data.unit}@${f.data.parts ?? ''}`));
  const isRead = (it) => fileOf.has(`${it.key}@${it.parts ?? ''}`);
  const items = order.items;
  const readItems = items.filter(isRead);
  const nextItem = items.find((it) => !isRead(it)) ?? null;
  const nextKeys = nextItem ? items.filter((it) => it.session === nextItem.session && !isRead(it)).map((it) => it.key) : [];
  const unitFiles = ds.files.filter((f) => f.data?.unit).sort((a, b) =>
    orderIndex(order, a.data.unit, a.data.parts) - orderIndex(order, b.data.unit, b.data.parts) || a.name.localeCompare(b.name));
  const lastFile = unitFiles.filter((f) => orderIndex(order, f.data.unit, f.data.parts) < Number.MAX_SAFE_INTEGER - 1).at(-1) ?? unitFiles.at(-1) ?? null;
  // 직전 세션 = 마지막 기록의 세션. 그 세션이 곧 다음 세션이면(진행 중) 그 앞 세션도
  const recent = [];
  if (lastFile) {
    const last = sessionOf(lastFile.data);
    recent.push(last);
    if (nextItem && last === nextItem.session) {
      const before = groupBySession(facts).map(([x]) => x).filter((x) => (sessionRank.get(x) ?? 1e9) < (sessionRank.get(last) ?? 1e9)).at(-1);
      if (before) recent.unshift(before);
    }
  }
  const isRecent = (c) => recent.includes(sessionOf(c));
  const recentFacts = facts.filter(isRecent);
  const recentNames = listFiles('recent', `직전 세션 사실 — ${recent.join(' · ') || '없음'}`, [
    autoNote,
    `직전 세션(${recent.join(' · ') || '없음'})의 사실 ${recentFacts.length}건 전부. 표기는 facts.md와 같다.`,
  ].join('\n'), groupBySession(recentFacts).map(([s, list]) => ({ head: `## ${s}`, lines: list.map(factLine) })));

  // ── 이번 항목 맞춤 — 다음 항목 원문에 나오는 대상의 앞 사실 (focus.mjs) ──
  const sizeOf = (names) => names.reduce((a, p) => a + len(files.get(p)), 0);
  const focusBudget = Math.max(FOCUS_MIN, Math.min(FOCUS_MAX, FIRST_MAX - HEAD_RESERVE - sizeOf(qNames) - sizeOf(recentNames)));
  const hits = nextKeys.length ? sourceTargets(ctx, nextKeys) : new Map();
  const targetName = new Map(ctx.db.prepare('SELECT id, name FROM targets').all().map((t) => [t.id, t.name]));
  const tName = (id) => targetName.get(id) ?? id;
  // 머리말 · 절 머리 몫을 빼고 사실 줄에 예산을 준다
  const { picked, left } = pickFacts(facts, facts.filter((f) => !isRecent(f)), hits, focusBudget - 2_500, (f) => len(factLine(f)) + 1);
  const groups = new Map();
  for (const p of picked) (groups.get(p.best) ?? groups.set(p.best, []).get(p.best)).push(p.fact);
  const factRank = new Map(facts.map((f, i) => [f, i]));
  const focusBody = [...groups].map(([t, list]) =>
    [`## ${tName(t)} (${t}) · 원문 ${fmtN(hits.get(t))}줄`, ...list.sort((a, b) => factRank.get(a) - factRank.get(b)).map(factLine)].join('\n'));
  const focusText = [
    `# 이번 항목 맞춤 — ${nextItem ? `${nextItem.session} 원문 대상의 앞 사실` : '다음 항목 없음'}`,
    '',
    autoNote,
    nextItem
      ? `${nextItem.session} 원문(${nextKeys.join(' · ')})에서 이름표 · 사전 이름으로 대상을 뽑고(기계적), 그 대상을 다룬 앞 사실을 골랐다. 직전 세션 사실은 recent.md에 있어 뺐다.`
      : '1회독 순서가 끝났다 — 고를 사실이 없다.',
    `고른 사실 ${picked.length}건 · 원문 대상과 이어지는데 예산(${fmtN(focusBudget)}자)으로 못 담은 사실 ${left}건 — 그 밖은 \`node tools/records.mjs find <이름>\` · facts.md.`,
    '고르는 법: 사실 점수 = Σ(about 대상 중 원문에 나온 것) log2(1 + 원문 줄 수) ÷ 그 대상을 다룬 사실 수. 점수 순으로 담고, 가장 크게 이바지한 대상 절에 읽은 순서로 적는다(절은 점수 높은 순).',
    ...(hits.size ? [`원문에 많이 나오는 대상(줄 수, 상위 20): ${[...hits].slice(0, 20).map(([t, k]) => `${tName(t)} ${fmtN(k)}`).join(' · ')}`] : []),
    '',
    focusBody.length ? focusBody.join('\n\n') : '(고른 사실 없음)',
  ].join('\n');
  files.set('handoff/focus.md', `${focusText}\n`);
  if (len(focusText) > FILE_MAX) warnings.push(`handoff/focus.md가 ${fmtN(len(focusText))}자 — 파일 하나 ${fmtN(FILE_MAX)}자를 넘는다`);

  // ── 세션별 단위 요약 — 파일 하나가 FILE_MAX를 넘으면 단위 경계에서 R01-1.md · R01-2.md …로 나눈다 ──
  const sessionFiles = new Map();
  for (const f of unitFiles) {
    const s = f.data.session ?? '(세션 없음)';
    (sessionFiles.get(s) ?? sessionFiles.set(s, []).get(s)).push(f);
  }
  const closedBy = new Map(ds.revisitDone.map((r) => [r.id, r]));
  const sessionNames = [];
  const sessionsSorted = [...sessionFiles].sort(([a], [b]) => (sessionRank.get(a) ?? 1e9) - (sessionRank.get(b) ?? 1e9) || a.localeCompare(b));
  const unitLabel = (f) => f.data.unit + (f.data.parts ? ` 파트 ${f.data.parts}` : '');
  for (const [s, fs_] of sessionsSorted) {
    const intro = `${autoNote}\n단위 요약 · 씬 한 줄은 작업 메모다 — 결과로 쓰지 않는다. 기각된 후보는 뺐다.`;
    const chunks = [];
    let cur = [];
    let size = 0;
    for (const f of fs_) {
      const block = unitBlock(f);
      if (len(block) > FILE_MAX) warnings.push(`${s} ${unitLabel(f)}의 단위 요약이 ${fmtN(len(block))}자 — 단위 하나가 ${fmtN(FILE_MAX)}자를 넘는다(요약을 줄인다)`);
      if (cur.length && size + len(block) > FILE_MAX - 400) {
        chunks.push(cur);
        cur = [];
        size = 0;
      }
      cur.push({ f, block });
      size += len(block) + 2;
    }
    if (cur.length) chunks.push(cur);
    const base = `handoff/${s.replace(/[^\w가-힣-]/g, '_')}`;
    chunks.forEach((ch, i) => {
      const name = chunks.length === 1 ? `${base}.md` : `${base}-${i + 1}.md`;
      const part = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      const text = `# ${s} — 1회독 단위 요약${part}\n\n${intro}\n\n${ch.map((x) => x.block).join('\n\n')}\n`;
      files.set(name, text);
      sessionNames.push({ name, session: s, units: ch.map((x) => unitLabel(x.f)), size: len(text) });
    });
  }

  function unitBlock(f) {
    const d = f.data;
    const r = ctx.resolve(d.unit);
    const kind = r?.unit ? KIND_LABEL[r.unit.source] ?? '' : '';
    const title = r ? (r.type === 'scene' ? r.title : r.unit?.title ?? '') : '';
    const out = [`## ${d.unit}${d.parts ? ` 파트 ${d.parts}` : ''} · ${title}${kind ? ` — ${kind}` : ''} · ${d.session ?? ''} · ${d.date ?? ''} (${d.by ?? '?'})`];
    out.push(`요약: ${d.summary ?? ''}`);
    const mine = live.filter((c) => c.file === f.name);
    const scenes = ds.scenes.filter((x) => x.file === f.name && x.obj?.scene);
    if (scenes.length) out.push('씬:', ...scenes.map((x) => `- ${x.obj.scene} ${x.obj.text ?? ''}`));
    const list = (label, xs, fn) => {
      if (xs.length) out.push(`${label}:`, ...xs.map(fn));
    };
    list('사실', mine.filter((c) => c.section === 'facts'), (c) => `- ${c.id}${mark(c)} ${c.text} · ${firstCite(c)}`);
    list('의문', mine.filter((c) => c.section === 'questions'), (c) => `- ${c.id}${mark(c)} ${c.text} · ${firstCite(c)}`);
    list('사건', mine.filter((c) => c.section === 'events'), (c) => {
      const what = c.act === '회수' ? `${c.parent} 회수(${c.obj?.degree ?? '?'}) → ${c.obj?.answer ?? '?'}` : `${c.parent} ${c.act}${c.obj?.replacedBy ? ` → ${c.obj.replacedBy}` : ''}`;
      return `- ${c.id}${mark(c)} ${what}${c.text ? ` — ${c.text}` : ''} · ${firstCite(c)}`;
    });
    list('시점', mine.filter((c) => c.section === 'times'), (c) => `- ${c.id}${mark(c)} ${c.act} — ${c.text}${c.obj?.ref ? ` (기준 ${[].concat(c.obj.ref).join(' · ')})` : ''} · ${firstCite(c)}`);
    list('새 대상', ds.targets.filter((t) => t.file === f.name && t.obj?.target), (t) => `- ${t.obj.target}${t.obj.new ? ' (사전에 더함)' : ''} — ${t.obj.note ?? ''} · ${Array.isArray(t.obj.evidence) && t.obj.evidence[0] ? citeOf(t.obj.evidence[0]) : ''}`);
    list('되짚기', ds.revisits.filter((v) => v.file === f.name && v.id), (v) => `- ${v.id} ${v.obj.text ?? ''}${closedBy.has(v.id) ? ` — 닫힘(${closedBy.get(v.id).unit}: ${closedBy.get(v.id).obj?.note ?? ''})` : ''}`);
    list('설정 오류 추정', Array.isArray(d.slips) ? d.slips.filter((x) => typeof x === 'string') : [], (x) => `- ${x}`);
    list('닫은 되짚기', ds.revisitDone.filter((v) => v.file === f.name && v.id), (v) => `- ${v.id} ${v.obj?.note ?? ''}`);
    return out.join('\n');
  }

  // ── HANDOFF.md ──
  const n = nextIds(ds);
  const all = ds.candidates.filter((c) => c.id && isRecord(c));
  const done = all.filter((c) => c.status === '확정' || c.status === '기각').length;
  const links = ds.candidates.filter((c) => c.people && c.id);
  // 2회독 파일의 되짚기 메모는 2회독 인계(B1b)가 다룬다
  const openRevisits = ds.revisits.filter((v) => v.id && !v.read2 && !closedBy.has(v.id));

  const firstFiles = [
    ...qNames.map((p) => ({ name: p, what: `의문 — 열림 ${qCount.열림} · 일부 풀림 ${qCount.일부}` })),
    ...recentNames.map((p) => ({ name: p, what: `직전 세션(${recent.join(' · ') || '없음'}) 사실 ${recentFacts.length}건` })),
    { name: 'handoff/focus.md', what: `이번 항목(${nextItem?.session ?? '없음'}) 원문 대상의 앞 사실 ${picked.length}건` },
  ].map((x) => ({ ...x, size: len(files.get(x.name)) }));
  const head = [];
  head.push('# 1회독 인계', '', autoNote, '읽기 세션(R)은 앞 원문 대신 이것을 먼저 읽는다. 원문을 다시 봐야 하면 씬 ID로 `node tools/read.mjs <씬> --num`.', '');
  head.push('## 진행 위치', '');
  head.push(`- 읽은 단위 ${readItems.length}/${items.length} (${kindTally(items, isRead)})` +
    (lastFile ? ` · 마지막 기록: ${lastFile.data.session} ${lastFile.data.unit}${lastFile.data.date ? ` (${lastFile.data.date})` : ''}` : ' · 아직 기록 없음'));
  if (nextItem) {
    const its = items.filter((it) => it.session === nextItem.session);
    head.push(`- 다음: **${nextItem.session}** — ${its.map((it) => `${isRead(it) ? '~~' : ''}${it.key}${it.parts ? ` 파트 ${it.parts}` : ''}${isRead(it) ? '~~' : ''}`).join(' · ')}`);
  } else head.push('- 다음: 1회독 순서 끝');
  head.push(`- 후보 ${all.length} — 확정 ${all.filter((c) => c.status === '확정').length} · 기각 ${all.filter((c) => c.status === '기각').length} · 남음 ${all.length - done}` +
    (all.length ? ` (검토 ${Math.round((100 * done) / all.length)}%)` : '') +
    (links.length ? ` · 정체 연결(people.json) ${links.length} — 남음 ${links.filter((c) => c.status === '후보').length}` : ''));
  head.push(`- 다음 번호: 사실 ${n.F} · 의문 ${n.Q} · 시점 ${n.S} · 되짚기 ${n.V} · 정체 연결 ${n.L} — 사건 번호(F12-2)는 사실 · 의문마다 따로: \`node tools/records.mjs next F12\``);
  head.push('', '## 되짚기 메모 — 열린 것', '');
  if (openRevisits.length) for (const v of openRevisits) head.push(`- ${v.id} (${v.session ?? ''} ${v.unit}) ${v.obj.text ?? ''}${v.obj.where?.length ? ` — ${v.obj.where.join(' · ')}` : ''}`);
  else head.push('- 없음');
  // 필요할 때 여는 파일의 표는 세션마다 늘므로 handoff/index.md에 둔다 — HANDOFF.md에는 직전 세션 요약만
  const sessionsIn = (p) => {
    const ss = [...new Set([...files.get(p).matchAll(/^## (\S+)$/gm)].map((m) => m[1]))];
    return ss.length > 1 ? `${ss[0]}–${ss.at(-1)}` : ss[0] ?? '';
  };
  const summaryRow = (x) => {
    const u = x.units.length > 2 ? `${x.units[0]} … ${x.units.at(-1)} (${x.units.length}단위)` : x.units.join(' · ');
    return `| ${x.name} | 단위 요약 — ${u} | ${fmtN(x.size)} |`;
  };
  const index = ['# 인계 파일 목록 — 필요할 때 여는 것', '', autoNote,
    '목록에서 찾기: `node tools/records.mjs find <낱말>`. 세션 요약은 `grep -n "^## " <파일>`로 단위 절을 찾아 그 부분만 읽는다.', '',
    '| 파일 | 내용 | 글자 수 |', '|---|---|---:|'];
  for (const p of factNames) index.push(`| ${p} | 사실 목록${factNames.length > 1 ? ` ${sessionsIn(p)}` : ` 전체 ${facts.length}건`} | ${fmtN(len(files.get(p)))} |`);
  for (const p of solvedNames) index.push(`| ${p} | 풀린 의문 ${qCount.풀림}건 | ${fmtN(len(files.get(p)))} |`);
  for (const x of sessionNames) index.push(summaryRow(x));
  files.set('handoff/index.md', `${index.join('\n')}\n`);
  const tail = [];
  tail.push('', '## 필요할 때 여는 것', '');
  tail.push(`전체 목록은 handoff/index.md — 사실 목록 전체(${factNames.length}파일) · 풀린 의문 · 세션 요약(${sessionNames.length}파일). 앞 사실은 \`node tools/records.mjs find <낱말>\`.`);
  const recentSummaries = sessionNames.filter((x) => recent.includes(x.session));
  if (recentSummaries.length) tail.push('', '| 파일 | 내용 | 글자 수 |', '|---|---|---:|', ...recentSummaries.map(summaryRow));
  // 먼저 읽을 것 표는 이 파일 크기를 넣어야 해서 마지막에 채운다
  const table = (selfSize) => {
    const rows = [{ name: 'HANDOFF.md', what: '이 파일', size: selfSize }, ...firstFiles];
    const total = rows.reduce((a, r) => a + r.size, 0);
    return {
      total,
      lines: ['', `## 먼저 읽을 것 — 합계 ${fmtN(total)}자`, '', '| 파일 | 내용 | 글자 수 |', '|---|---|---:|', ...rows.map((r) => `| ${r.name} | ${r.what} | ${fmtN(r.size)} |`)],
    };
  };
  let selfSize = 0;
  let text = '';
  for (let k = 0; k < 4; k++) {
    // 표에 이 파일 크기가 들어가 크기가 바뀔 수 있어 몇 번 맞춘다
    const t = table(selfSize);
    text = `${[...head, ...t.lines, ...tail].join('\n')}\n`;
    if (len(text) === selfSize) break;
    selfSize = len(text);
  }
  const firstTotal = table(selfSize).total;
  if (firstTotal > FIRST_MAX) {
    warnings.push(`먼저 읽을 것이 ${fmtN(firstTotal)}자 — ${fmtN(FIRST_MAX)}자를 넘는다(열린 의문 · 직전 세션 사실이 크다). 의문 목록을 줄이는 방법을 정한다`);
    text += `\n⚠ 먼저 읽을 것이 ${fmtN(FIRST_MAX)}자를 넘는다 — focus.md는 앞 절(점수 높은 대상)부터 읽는다.\n`;
  }
  files.set('HANDOFF.md', text);
  return { files, firstTotal, firstNames: ['HANDOFF.md', ...firstFiles.map((x) => x.name)], warnings };
}

/** 디스크의 인계 파일과 비교 — 다른 파일(없음 · 내용 다름 · 남은 옛 파일) 목록 */
export function staleHandoff(built, outDir) {
  const stale = [];
  for (const [rel, content] of built.files) {
    const p = path.join(outDir, rel);
    if (!fs.existsSync(p)) stale.push(`${rel} (없음)`);
    else if (fs.readFileSync(p, 'utf8') !== content) stale.push(rel);
  }
  const dir = path.join(outDir, 'handoff');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.md') && !built.files.has(`handoff/${f}`)) stale.push(`handoff/${f} (옛 파일)`);
  }
  return stale;
}

/** 인계 파일을 쓴다. handoff/의 옛 .md는 지운다 */
export function writeHandoff(built, outDir) {
  fs.mkdirSync(path.join(outDir, 'handoff'), { recursive: true });
  const dir = path.join(outDir, 'handoff');
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.md') && !built.files.has(`handoff/${f}`)) fs.rmSync(path.join(dir, f));
  const written = [];
  for (const [rel, content] of built.files) {
    const p = path.join(outDir, rel);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== content) {
      fs.writeFileSync(p, content);
      written.push(rel);
    }
  }
  return written;
}
