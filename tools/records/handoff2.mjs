/**
 * 2회독 인계 파일 — 2회독 세션(P · M)이 원문 대신 먼저 읽는 것. 기록에서 만들고 손으로 고치지 않는다. 규칙은 docs/annotations.md "2회독 인계 파일".
 *
 * 2회독은 결말을 알고 읽어야 복선이 보이는데, 1회독 사실 전체(약 40만 자)는 못 읽는다. 다음 세션 단위마다 기계적으로 고른다:
 * 그 단위의 1회독 기록과 그 뒤(던진 의문의 답 · 사실이 다시 드러나거나 뒤집힌 곳), 걸친 떡밥 줄기와 그 결말, 원문에 나오는 대상의 앞뒤 사실,
 * 1회독이 넘긴 볼 거리(annotations/watch.json), 2회독 되짚기 메모, 지금까지의 2회독 기록(인물 변화 · 생활상).
 *
 *   먼저 읽을 것 (다음 세션 맞춤 — FIRST_MAX 안쪽)
 *   annotations/read2/HANDOFF.md          진행 위치(층별) · 이 층에서 하는 것 · 다음 번호 · 되짚기 메모 · 떡밥 줄기 한눈에 · 파일 안내
 *   annotations/read2/handoff/next.md     다음 세션 단위마다 — 층 · 등급 · 볼 거리 · 되짚기 · 1회독 기록과 그 뒤 · 걸친 줄기, 끝에 그 줄기들의 결말
 *                                         (FILE_MAX를 넘으면 단위 경계에서 next-1.md · next-2.md …)
 *   annotations/read2/handoff/focus.md    다음 세션 원문 대상의 지금까지 2회독 기록(인물 변화 · 생활상)과 앞뒤 사실 (focus.mjs — 정체 연결로 넓힌다)
 *   필요할 때 여는 것
 *   annotations/read2/handoff/index.md    아래 파일 목록 · 1회독 인계 파일 안내
 *   annotations/read2/handoff/threads.md  떡밥 줄기 전부 — 든 의문(상태 · 답) · 곧바로 든 사실 · 줄기 관계 (넘치면 threads-1.md …)
 *
 * 만든 시각 같은 흔들리는 값은 넣지 않는다 — 같은 기록 · 원문이면 같은 파일이 나와야 검증기가 "오래됐다"를 가릴 수 있다.
 */
import { KIND_LABEL } from '../lib/units.mjs';
import { FILE_MAX, FIRST_MAX, FOCUS_MAX, FOCUS_MIN } from './handoff.mjs';
import { identityRules, pickFacts, sourceTargets } from './focus.mjs';
import { computeLayers } from './layers.mjs';
import { citeOf, compareIds, expandLines, isRecord, nextIds } from './model.mjs';
import { kindOfKey, partsOverlap } from './order.mjs';
import { orderIndex } from './review.mjs';
import { threadMembership } from './threads.mjs';

/** 층마다 하는 것 — docs/history/reading.md P · M 머리말과 같게 둔다 */
export const LAYER_TASKS = {
  1: '암시 언급 · 떡밥 암시와 재언급 · 인물 변화 · 세계 생활상 · 1회독 바로잡기',
  2: '암시 언급 · 떡밥 암시와 재언급 · 인물 변화 · 1회독 바로잡기 · 시점 단서 보강(시점 기록이 없으면 원문 실마리로 `S`를 더한다 — 2회독 기준) — 생활상은 하지 않는다',
  3: '인물 변화 · 줄기에 걸린 암시 · 1회독 바로잡기 · 시점 단서 보강 — 그 밖의 암시 언급은 인물 집계에 쓰일 `???` 정체만',
};
/** 줄기 결말 절에서 줄기 하나에 적는 곧바로 든 사실의 최대 수 — 넘으면 뒤(결말) 쪽을 남기고 threads.md로 보낸다 */
export const THREAD_FACTS_MAX = 8;
/**
 * 먼저 읽을 것이 FIRST_MAX를 넘을 세션(1층의 큰 메인 묶음)에서 줄기 절을 줄이는 차례 — 앞 단계로 안 맞으면 다음 단계.
 * 풀린 의문은 문장 없이 ID와 답만(문장 · 답 사실은 threads.md), 그래도 넘으면 결말 사실을 줄인다. 열린 · 일부 풀린 의문은 늘 문장째
 */
export const THREAD_LEVELS = [
  { factsMax: THREAD_FACTS_MAX, solvedText: true },
  { factsMax: THREAD_FACTS_MAX, solvedText: false },
  { factsMax: 4, solvedText: false },
  { factsMax: 2, solvedText: false },
];
/** 예산을 잴 때 HANDOFF.md 몫으로 잡아 두는 글자 수 */
const HEAD_RESERVE = 6_000;
/** focus.md 머리말 몫(원문 · 상위 대상 줄) */
const FOCUS_HEAD_RESERVE = 2_000;
/** focus.md의 "지금까지 2회독 기록"(인물 변화 · 생활상) 상한 — 넘으면 줄여 적는다(buildState) */
export const STATE_MAX = 8_000;
/** focus.md 앞뒤 사실의 가장 작은 몫 — 지금까지 2회독 기록이 커도 이만큼은 남긴다 */
const FOCUS_FLOOR = 4_000;

const len = (s) => [...s].length;
const fmtN = (n) => n.toLocaleString('ko-KR');
const arr = (x) => (Array.isArray(x) ? x : []);
const mark = (c) => (c.status === '확정' ? ' ✓' : '');
const guess = (c) => (c.confidence === '추정' ? ' (추정)' : '');
const firstCite = (c) => (arr(c.evidence).length ? citeOf(c.evidence[0]) : '');
/** 줄 번호 목록 → `3,5-9,12` */
const spans = (seqs) => {
  const out = [];
  for (let i = 0; i < seqs.length; i++) {
    let j = i;
    while (j + 1 < seqs.length && seqs[j + 1] === seqs[j] + 1) j++;
    out.push(j > i ? `${seqs[i]}-${seqs[j]}` : `${seqs[i]}`);
    i = j;
  }
  return out.join(',');
};
const autoNote = '자동으로 만든 파일이다 — 손으로 고치지 않는다(node tools/records.mjs handoff). 형식 · 규칙은 docs/annotations.md "2회독 인계 파일".';

/**
 * @param {ReturnType<import('./model.mjs').loadDataset>} ds
 * @param {object} ctx openContext()
 * @param {{ items: object[], sessions: object[] }} order 1회독 순서(R — 출시순 한 줄): 앞뒤 · 층 계산
 * @param {{ items: object[], sessions: object[] }} order2 2회독 순서(P · M — 층별): 진행 위치 · 다음 세션
 * @returns {{ files: Map<string, string>, firstTotal: number, firstNames: string[], warnings: string[], next: object|null }}
 *   files: 2회독 인계 디렉터리(annotations/read2) 기준 상대 경로 → 내용
 */
export function buildHandoff2(ds, ctx, order, order2) {
  const warnings = [];
  const files = new Map();
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const rec = live.filter(isRecord);
  const byId = new Map(live.map((c) => [c.id, c]));
  const pos = (c) => orderIndex(order, c.unit, c.parts);
  const sectionRank = { facts: 0, questions: 1, events: 2, times: 3 };
  const byRank = (a, b) => pos(a) - pos(b) || (a.file ?? '').localeCompare(b.file ?? '') || (sectionRank[a.section] ?? 9) - (sectionRank[b.section] ?? 9) || a.index - b.index;
  const facts = rec.filter((c) => c.section === 'facts').sort(byRank);
  const events = rec.filter((c) => c.section === 'events').sort(byRank);
  const eventsOf = new Map();
  for (const e of events) if (e.parent) (eventsOf.get(e.parent) ?? eventsOf.set(e.parent, []).get(e.parent)).push(e);
  const recoveries = (q) => (eventsOf.get(q) ?? []).filter((e) => e.act === '회수');
  const qState = (q) => {
    const rs = recoveries(q);
    return rs.some((e) => e.obj?.degree === '전부') ? '풀림' : rs.length ? '일부' : '열림';
  };
  const where = (c) => {
    const cite = firstCite(c);
    return cite.startsWith(`${c.unit}#`) ? cite : `${c.unit} ${cite}`.trim();
  };
  const textOf = (id) => byId.get(id)?.text ?? '';
  const factLine = (f) => `- ${f.id}${mark(f)}${guess(f)} ${f.text} · ${where(f)}`;

  const member = threadMembership(ds);
  const lay = computeLayers(ds, order);
  const layerOf = (key) => lay.byUnit.get(key)?.layer ?? null;

  // ── 진행 위치 ──
  const done2 = new Set(ds.files2.filter((f) => f.data?.unit).map((f) => `${f.data.unit}@${f.data.parts ?? ''}`));
  const isRead = (it) => done2.has(`${it.key}@${it.parts ?? ''}`);
  const items = order2.items;
  const nextItem = items.find((it) => !isRead(it)) ?? null;
  const sessionItems = nextItem ? items.filter((it) => it.session === nextItem.session) : [];
  const nextItems = sessionItems.filter((it) => !isRead(it));
  const itemLabel = (it) => `${it.key}${it.parts ? ` 파트 ${it.parts}` : ''}`;

  /** 2회독 항목(단위 · 파트)에 드는 1회독 파일 — 파트 묶음이 달라도 겹치면 든다 */
  const read1Files = (it) => ds.files.filter((f) => f.data?.unit === it.key && partsOverlap(f.data.parts, it.parts))
    .sort((a, b) => orderIndex(order, a.data.unit, a.data.parts) - orderIndex(order, b.data.unit, b.data.parts) || a.name.localeCompare(b.name));
  const unitRecords = (it) => {
    const names = new Set(read1Files(it).map((f) => f.name));
    return rec.filter((c) => names.has(c.file)).sort(byRank);
  };
  const threadsOfRecords = (cs) => {
    const ids = new Set();
    for (const c of cs) {
      if (c.kind === 'question' && c.role === 'def' && member.ofQuestion.has(c.id)) ids.add(member.ofQuestion.get(c.id));
      if (c.kind === 'fact' && c.role === 'def') for (const t of member.ofFact.get(c.id) ?? []) ids.add(t);
      if (c.role === 'event' && c.parent) {
        if (member.ofQuestion.has(c.parent)) ids.add(member.ofQuestion.get(c.parent));
        for (const t of member.ofFact.get(c.parent) ?? []) ids.add(t);
      }
    }
    return [...ids].sort(compareIds);
  };
  const aboutThreads = (cs, direct) => {
    const ids = new Set();
    for (const c of cs) if (c.kind === 'fact' && c.role === 'def') for (const t of member.ofFactAbout.get(c.id) ?? []) if (!direct.includes(t)) ids.add(t);
    return [...ids].sort(compareIds);
  };
  const threadTitle = (id) => {
    const t = member.byId.get(id);
    return t ? `${id} ${t.title ?? ''} (${t.weight ?? '?'})` : id;
  };

  // ── next.md — 다음 세션 단위마다 ──
  const shown = new Set(); // next.md에 문장째 나온 사실 — focus.md에서 뺀다
  const sessionThreads = new Map(); // 줄기 → 걸친 단위들
  const watchFor = (it) => ds.watchItems.filter((w) => w.unit === it.key && partsOverlap(w.parts, it.parts) && w.id);
  const openRevisits = ds.revisits.filter((v) => v.id && v.read2 && !ds.revisitDone.some((d) => d.id === v.id));
  const revisitsFor = (it) => openRevisits.filter((v) => arr(v.obj?.where).some((w) => w === it.key || (ctx.resolve(it.key)?.scenes ?? []).includes(w)));
  // 2회독 암시 언급 speaker: true — 그 줄을 말한 사람으로 2회독이 읽어서 정한 것 (`씬\t줄` → 인물)
  const speakerLines = new Map();
  for (const m of live.filter((c) => c.kind === 'mention' && c.obj?.speaker === true && typeof c.obj?.target === 'string')) {
    const ev = arr(m.evidence)[0];
    for (const n of expandLines(ev?.lines ?? []).seqs) {
      const k = `${ev.scene}\t${n}`;
      (speakerLines.get(k) ?? speakerLines.set(k, []).get(k)).push(m.obj.target);
    }
  }
  /**
   * 정체 볼 줄 — 단위의 미상 이름표 줄(`???` · `남자의 목소리` …)을 씬 · 이름표별로. `???`는 매번 다른 사람일 수 있어 기계로 잇지 않는다 —
   * 2회독이 씬 · 줄마다 읽어 암시 언급(speaker: true)으로 적는다. 이미 적은 줄 수를 함께 보인다
   */
  const unknownLines = (it) => {
    const rows = [];
    let total = 0;
    let known = 0;
    for (const scene of ctx.resolve(it.key)?.scenes ?? []) {
      const byLabel = new Map();
      for (const l of ctx.lines(scene)) if (l.speaker_class === '미상') (byLabel.get(l.speaker_name) ?? byLabel.set(l.speaker_name, []).get(l.speaker_name)).push(l.seq);
      for (const [label, seqs] of byLabel) {
        const done = seqs.filter((n) => speakerLines.has(`${scene}\t${n}`)).length;
        total += seqs.length;
        known += done;
        rows.push(`- ${scene} ${label} #${spans(seqs)}${done ? ` — 적음 ${done}/${seqs.length}` : ''}`);
      }
    }
    return { rows, total, known };
  };
  const unitBlocks = [];
  for (const it of nextItems) {
    const r = ctx.resolve(it.key);
    const u = lay.byUnit.get(it.key);
    // 호감도 스토리는 원본 갈래(char) 이름 대신 이 프로젝트 말로
    const kind = it.key.startsWith('char:') ? '호감도 스토리' : r?.unit ? KIND_LABEL[r.unit.source] ?? kindOfKey(it.key) : kindOfKey(it.key);
    const title = r ? (r.type === 'scene' ? r.title : r.unit?.title ?? '') : '';
    const f1 = read1Files(it);
    const sessions1 = [...new Set(f1.map((f) => f.data.session).filter(Boolean))];
    let grade = '';
    if (u && u.kind !== '메인') {
      const j = u.judgment;
      grade = j ? ` · 등급 ${u.grade}${j.confidence === '추정' ? '(추정 — X3가 다시 본다)' : ''} — ${j.id}${u.basis ? ` 근거 ${u.basis}` : ''}` : ' · 등급 없음';
    }
    const out = [`## ${itemLabel(it)} · ${title} — ${kind} · ${u?.layer ? `${u.layer}층` : '층 없음'}${grade} · 1회독 ${sessions1.join(' · ') || '없음'}`];
    const ws = watchFor(it);
    if (ws.length) {
      out.push('볼 거리:');
      for (const w of ws) {
        const o = w.obj;
        const ev = arr(o.evidence).map((e) => (e?.lines ? citeOf(e) : e?.scene)).join(' ');
        const pts = arr(o.points).length ? ` → ${o.points.join(' · ')}` : '';
        const skip = o.kind === '생활상' && u?.layer && u.layer !== 1 ? ' — 이 층은 생활상을 하지 않는다' : '';
        out.push(`- ${o.id} [${o.kind}] ${o.text}${ev ? ` · ${ev}` : ''}${pts} (${o.from})${skip}`);
      }
    }
    const unk = unknownLines(it);
    if (unk.total) {
      out.push(`정체 볼 줄 — 미상 이름표 ${unk.total}줄(2회독이 적은 것 ${unk.known})${it.parts ? ' · 단위 전체(이번 파트 밖 씬도 있다)' : ''}: 누구인지 씬마다 읽어 암시 언급 speaker: true로 적는다`, ...unk.rows);
    }
    const vs = revisitsFor(it);
    if (vs.length) {
      out.push('되짚기 (앞 2회독 세션이 넘긴 것):');
      for (const v of vs) out.push(`- ${v.id} (${v.session ?? ''} ${v.unit}) ${v.obj?.text ?? ''}`);
    }
    const cs = unitRecords(it);
    const n = (k) => cs.filter(k).length;
    const fixes = cs.filter((c) => c.fix).length;
    out.push(`1회독 기록 — 사실 ${n((c) => c.section === 'facts')} · 의문 ${n((c) => c.section === 'questions')} · 사건 ${n((c) => c.section === 'events')} · 시점 ${n((c) => c.section === 'times')}` +
      `${fixes ? ` (바로잡기 ${fixes})` : ''}${sessions1.length ? ` — 요약은 ${sessions1.map((s) => `annotations/read1/handoff/${s}*.md`).join(' · ')}` : ''}`);
    // 시점 단서 보강(C1) — 2 · 3층은 시점 기록이 없는 단위에서 원문 실마리를 찾는다(작중 연대기, docs/views.md 화면 6)
    if (!n((c) => c.section === 'times') && (layerOf(it.key) ?? 1) > 1) out.push('⏱ 시점 기록 없음 — 원문이 실마리(사건 · 챕터와의 앞뒤, 인물의 상태)를 주면 바로잡기로 `S`를 더한다(범위형도 — 2회독 기준 "시점 단서 보강")');
    for (const c of cs) {
      shown.add(c.id);
      if (c.section === 'facts') {
        const tail = [];
        const later = [];
        for (const e of eventsOf.get(c.id) ?? []) {
          const at = e.unit !== c.unit ? e.unit : '같은 단위';
          if (e.act === '드러냄') tail.push(`+${at}(${e.id}${mark(e)})`);
          else if (e.act === '뒤집음') {
            tail.push(`⟲${at}(${e.id}${mark(e)})${e.obj?.replacedBy ? `→${e.obj.replacedBy}` : ''}`);
            const nf = byId.get(e.obj?.replacedBy);
            if (nf && !shown.has(nf.id)) {
              later.push(`  ⟲ ${nf.id}${mark(nf)} ${nf.text} · ${where(nf)}`);
              shown.add(nf.id);
            }
          }
        }
        out.push(`${factLine(c)}${tail.length ? ` · ${tail.join(' · ')}` : ''}`, ...later);
      } else if (c.section === 'questions') {
        out.push(`- ${c.id}${mark(c)}${guess(c)} ${c.text} · ${firstCite(c)} · ${qState(c.id)}`);
        for (const e of recoveries(c.id)) {
          const ans = byId.get(e.obj?.answer);
          out.push(`  → ${e.obj?.degree === '전부' ? '풀림' : '일부'} ${e.obj?.answer ?? '?'}${ans ? mark(ans) : ''} (${e.id}${e.unit !== c.unit ? ` ${e.unit}` : ''}): ${ans?.text ?? ''}`);
          if (ans) shown.add(ans.id);
        }
      } else if (c.section === 'events') {
        const parent = byId.get(c.parent);
        const what = c.act === '회수' ? `${c.parent} 회수(${c.obj?.degree ?? '?'}) → ${c.obj?.answer ?? '?'}` : `${c.parent} ${c.act}${c.obj?.replacedBy ? ` → ${c.obj.replacedBy}` : ''}`;
        out.push(`- ${c.id}${mark(c)}${guess(c)} ${what}${c.text ? ` — ${c.text}` : ''} · ${firstCite(c)}${parent ? ` · (${c.parent}: ${parent.text})` : ''}`);
        if (c.act === '회수' && c.obj?.answer) shown.add(c.obj.answer);
      } else if (c.section === 'times') {
        out.push(`- ${c.id}${mark(c)}${guess(c)} ${c.act} — ${c.text}${c.obj?.ref ? ` (기준 ${[].concat(c.obj.ref).join(' · ')})` : ''} · ${firstCite(c)}`);
      }
    }
    const direct = threadsOfRecords(cs);
    for (const t of direct) (sessionThreads.get(t) ?? sessionThreads.set(t, []).get(t)).push(itemLabel(it));
    const viaAbout = aboutThreads(cs, direct);
    if (direct.length) out.push(`줄기: ${direct.map(threadTitle).join(' · ')} — 결말은 아래 \`## 줄기 J…\` 절`);
    if (viaAbout.length) out.push(`about으로 걸친 줄기: ${viaAbout.join(' · ')} — handoff/threads.md`);
    unitBlocks.push({ label: itemLabel(it), text: out.join('\n') });
  }

  // ── focus.md 앞부분 — 원문 대상과 지금까지의 2회독 기록 (next 예산이 이 크기를 빼야 해서 줄기 절보다 먼저 만든다) ──
  const people = ds.candidates.filter((c) => c.people && c.id).map((c) => c.obj);
  const id = identityRules(ctx, people, speakerLines);
  const keys = [...new Set(nextItems.map((it) => it.key))];
  const hits = keys.length ? sourceTargets(ctx, keys, { identity: true, links: people, speakerLines }) : new Map();
  const targetName = new Map(ctx.db.prepare('SELECT id, name FROM targets').all().map((t) => [t.id, t.name]));
  const tName = (t) => {
    const ms = id.members.get(t);
    return ms ? ms.map((x) => targetName.get(x) ?? x).join(' = ') : targetName.get(t) ?? t;
  };
  // 지금까지의 2회독 기록 — 원문에 나오는 인물의 인물 변화, about이 원문 대상과 겹치는 생활상(생활상은 1층 세션에만 — 2 · 3층은 생활상을 적지 않는다).
  // STATE_MAX를 넘으면 줄여 적는다: 인물 × 측면마다 기준과 마지막 변화만 문장째(사이 변화는 ID), 그래도 넘으면 생활상은 뒤(최근)부터 문장째 · 앞은 ID만,
  // 그래도 넘으면 측면마다 마지막 하나만 짧게, 끝으로 원문 줄 수가 적은 인물부터 한 줄(측면 · 기록 ID)로 (C1 — 1층이 끝나 인물 변화가 쌓였다)
  const inSource = (t) => hits.has(id.canon(t));
  const doLife = nextItems.some((it) => (layerOf(it.key) ?? 1) === 1);
  const changes = live.filter((c) => c.kind === 'change' && inSource(c.obj?.person)).sort(byRank);
  const lifes = doLife ? live.filter((c) => c.kind === 'life' && arr(c.obj?.about).some(inSource)).sort(byRank) : [];
  const read2Line = (c) => `- ${c.id}${mark(c)} [${c.act ?? ''}] ${c.text ?? ''} · ${where(c)}`;
  const byPerson = new Map();
  for (const c of changes) (byPerson.get(id.canon(c.obj.person)) ?? byPerson.set(id.canon(c.obj.person), []).get(id.canon(c.obj.person))).push(c);
  const persons = [...byPerson].sort((a, b) => (hits.get(b[0]) ?? 0) - (hits.get(a[0]) ?? 0) || a[0].localeCompare(b[0]));
  // mode 0 = 전부 · 1 = 인물 × 측면마다 기준과 마지막 변화만 문장째(사이 변화는 ID) · 2 = 1과 같되 한 줄을 짧게(근거 없이 60자)
  // · 3 = 측면마다 마지막 하나만 짧게(40자 — 기준만 있으면 기준, 변화가 있으면 마지막 변화), 앞 기록은 인물마다 ID 한 줄
  // · 4 = 3에 더해 원문 줄 수가 적은 인물 compact명을 한 줄로(측면마다 기록 ID — 기준이 있는 측면을 알 수 있게)
  const cut = (body, n) => {
    const t = [...body];
    return t.length > n ? `${t.slice(0, n - 1).join('')}…` : body;
  };
  const terse = (c, n = 60) => `- ${c.id}${mark(c)} [${c.obj.aspect} ${c.obj.act}] ${cut(c.obj.act === '변화' ? `→ ${c.obj.after ?? ''}` : c.obj.text ?? '', n)}`;
  // 관계는 상대마다 따로 센다(유니 → 미하라 · 유니 → 지휘관)
  const aspectKey = (c) => (c.obj.aspect === '관계' && arr(c.obj.with).length ? `관계(${arr(c.obj.with).map(tName).join(' · ')})` : c.obj.aspect);
  const groupByAspect = (cs) => {
    const m = new Map();
    for (const c of cs) (m.get(aspectKey(c)) ?? m.set(aspectKey(c), []).get(aspectKey(c))).push(c);
    return m;
  };
  /** 기록 ID 목록 — 길면 앞뒤만 */
  const idList = (cs, max = 30) => (cs.length <= max ? cs.map((c) => c.id).join(' · ') : `${cs.slice(0, 10).map((c) => c.id).join(' · ')} … ${cs.slice(-5).map((c) => c.id).join(' · ')}`);
  const MODE_NOTE = ['전부', ' — 줄임: 인물 × 측면마다 기준과 마지막 변화만 문장째, 사이 변화는 ID', ' — 줄임: 인물 × 측면마다 기준과 마지막 변화만 짧게, 사이 변화는 ID',
    ' — 줄임: 측면마다 마지막 하나만 짧게, 앞 기록은 ID', ' — 줄임: 측면마다 마지막 하나만 짧게, 원문 줄 수가 적은 인물은 한 줄(측면 · 기록 ID)'];
  const buildState = (mode, lifeKeep, compact = persons.length) => {
    const body = [];
    if (changes.length) {
      body.push(`## 인물 변화 지금까지 — ${changes.length}건 (원문 인물의 기준 · 변화${mode ? MODE_NOTE[mode] : ' 전부'}${mode ? '(`records.mjs review D…`)' : ''}, 기준이 있는 측면에 기준을 또 세우지 않는다)`);
      persons.forEach(([p, cs], i) => {
        if (!mode) {
          body.push(`### ${tName(p)}`, ...cs.map(read2Line));
          return;
        }
        const byAspect = groupByAspect(cs);
        if (mode === 4 && i >= compact) {
          body.push(`### ${tName(p)} — ${cs.length}건: ${[...byAspect].map(([a, g]) => `${a} ${g.map((c) => c.id).join('·')}`).join(' / ')}`);
          return;
        }
        body.push(`### ${tName(p)}`);
        const older = [];
        for (const [aspect, group] of byAspect) {
          const moves = group.filter((c) => c.obj.act === '변화');
          if (mode >= 3) {
            const last = moves.at(-1) ?? group.at(-1);
            body.push(terse(last, 40));
            older.push(...group.filter((c) => c !== last));
            continue;
          }
          const keep = new Set([...group.filter((c) => c.obj.act !== '변화'), ...moves.slice(-1)]);
          body.push(...group.filter((c) => keep.has(c)).map(mode === 2 ? (c) => terse(c) : read2Line));
          const mid = moves.slice(0, -1);
          if (mid.length) body.push(`- ${aspect} 사이 변화 ${mid.length}: ${mid.map((c) => c.id).join(' · ')}`);
        }
        if (older.length) body.push(`- 앞 기록 ${older.length}: ${idList(older.sort((a, b) => compareIds(a.id, b.id)), 12)}`);
      });
    }
    if (lifes.length) {
      const keep = lifes.slice(Math.max(0, lifes.length - lifeKeep));
      const drop = lifes.slice(0, lifes.length - keep.length);
      body.push(`## 생활상 지금까지 — ${lifes.length}건 (about이 원문 대상과 겹치는 것${drop.length ? ` — 줄임: 앞선 ${drop.length}건은 ID만 ${idList(drop)}` : ''})`, ...keep.map(read2Line));
    }
    return body.join('\n');
  };
  /** cap 안쪽이 될 때까지 줄인다 — 인물 변화를 먼저, 그다음 생활상(뒤(최근)부터 남긴다), 짧은 줄, 측면마다 하나, 끝으로 원문에 적게 나오는 인물부터 한 줄 */
  const fitState = (cap) => {
    let text = buildState(0, lifes.length);
    let k = lifes.length;
    for (const mode of [1, 2, 3]) {
      if (len(text) <= cap) return text;
      k = lifes.length;
      text = buildState(mode, k);
      while (len(text) > cap && k > 0) {
        k = Math.floor(k / 2);
        text = buildState(mode, k);
      }
    }
    for (let n = persons.length - 1; len(text) > cap && n >= 0; n--) text = buildState(4, k, n);
    return text;
  };
  let stateText = fitState(STATE_MAX);

  // 걸친 떡밥 줄기와 그 결말 — 세션에서 한 번씩. 먼저 읽을 것이 FIRST_MAX를 넘을 세션은 줄여 적는다(THREAD_LEVELS 차례로)
  const nextKeySet = new Set(nextItems.map((it) => it.key));
  const shownInUnits = new Set(shown);
  const buildThreads = ({ factsMax, solvedText }) => {
    const blocks = [];
    const ids = new Set();
    for (const id of [...sessionThreads.keys()].sort(compareIds)) {
      const t = member.byId.get(id);
      const out = [`## 줄기 ${threadTitle(id)} — 걸친 단위 ${sessionThreads.get(id).join(' · ')}`];
      if (t.c?.obj?.text) out.push(t.c.obj.text);
      const qs = t.questions.map((q) => byId.get(q)).filter(Boolean).sort(byRank);
      const count = { 열림: 0, 일부: 0, 풀림: 0 };
      for (const q of qs) count[qState(q.id)]++;
      out.push(`의문 ${qs.length} — 열림 ${count.열림} · 일부 ${count.일부} · 풀림 ${count.풀림}:`);
      const solvedShort = [];
      for (const q of qs) {
        const ans = recoveries(q.id).map((e) => e.obj?.answer).filter(Boolean);
        const to = ans.length ? ` → ${[...new Set(ans)].join(' · ')}` : '';
        // 이번 세션 단위에서 던진 의문은 단위 절에 문장 · 답이 다 있다
        if (nextKeySet.has(q.unit)) out.push(`- ${q.id} ${qState(q.id)}${to} · ${q.unit} — 위 단위 절`);
        else if (!solvedText && qState(q.id) === '풀림') solvedShort.push(`${q.id}${to}`);
        else out.push(`- ${q.id} ${qState(q.id)} ${q.text}${to} · ${q.unit}`);
      }
      if (solvedShort.length) out.push(`- 풀린 의문(문장은 handoff/threads.md): ${solvedShort.join(' · ')}`);
      const fs_ = t.facts.map((f) => byId.get(f)).filter(Boolean).sort(byRank);
      const keep = fs_.slice(-factsMax);
      out.push(`결말 — 곧바로 든 사실 ${fs_.length}${fs_.length > keep.length ? ` 가운데 뒤 ${keep.length}(나머지는 handoff/threads.md)` : ''}:`);
      for (const f of keep) {
        out.push(shownInUnits.has(f.id) ? `- ${f.id}${mark(f)} · ${f.unit} — 위 단위 절` : factLine(f));
        ids.add(f.id);
      }
      const rels = live.filter((c) => c.kind === 'relation' && (c.obj?.a === id || c.obj?.b === id)).sort((a, b) => compareIds(a.id, b.id));
      if (rels.length) out.push(`관계: ${rels.map((g) => `${g.id} ${g.obj.a} ${g.obj.type} ${g.obj.b}`).join(' · ')}`);
      blocks.push({ label: `줄기 ${id}`, text: out.join('\n') });
    }
    return { blocks, ids };
  };
  // next 몫 = 먼저 읽을 것 − HANDOFF 몫 − focus(머리말 · 지금까지 2회독 기록 · 사실 최소) — 단위 절은 줄이지 않고 줄기 절만 줄인다
  // focus의 앞뒤 사실 최소 몫 — 지금까지 2회독 기록도 원문 대상의 정보라 그만큼 줄인다(FOCUS_FLOOR까지)
  const focusFactsMin = Math.max(FOCUS_FLOOR, FOCUS_MIN - len(stateText));
  const nextBudget = FIRST_MAX - HEAD_RESERVE - FOCUS_HEAD_RESERVE - len(stateText) - focusFactsMin;
  const unitsSize = unitBlocks.reduce((a, b) => a + len(b.text) + 2, 0) + 1_500;
  let level = 0;
  let built = buildThreads(THREAD_LEVELS[0]);
  while (level + 1 < THREAD_LEVELS.length && unitsSize + built.blocks.reduce((a, b) => a + len(b.text) + 2, 0) > nextBudget) {
    level++;
    built = buildThreads(THREAD_LEVELS[level]);
  }
  const threadBlocks = built.blocks;
  // 줄기 절을 끝까지 줄여도 넘으면 지금까지 2회독 기록을 더 줄인다(단위 절은 줄이지 않는다)
  const nextSize = unitsSize + built.blocks.reduce((a, b) => a + len(b.text) + 2, 0);
  const stateRoom = FIRST_MAX - HEAD_RESERVE - FOCUS_HEAD_RESERVE - FOCUS_FLOOR - nextSize;
  if (len(stateText) > stateRoom) stateText = fitState(Math.max(0, stateRoom));
  if (len(stateText) > Math.max(0, stateRoom)) warnings.push(`2회독 focus.md의 "지금까지 2회독 기록"이 줄여도 ${fmtN(len(stateText))}자 — 먼저 읽을 것 안에 ${fmtN(Math.max(0, stateRoom))}자 자리뿐이다`);
  for (const f of built.ids) shown.add(f);

  const nextHead = (part) => [
    `# 이번 세션 단위 — ${nextItem ? `${nextItem.session} (2회독)` : '2회독 순서 끝'}${part}`,
    '',
    autoNote,
    nextItem
      ? `${nextItem.session}에서 남은 단위 ${nextItems.length}개를 읽는 순서대로. 단위마다 층 · 등급, 볼 거리(1회독이 넘긴 것 — annotations/watch.json), 정체 볼 줄(미상 이름표), 되짚기, 1회독 기록과 그 뒤(의문의 답 · 다시 드러남 \`+\` · 뒤집힘 \`⟲\`), 걸친 줄기.`
      : '2회독 순서가 끝났다.',
    '`✓` 확정 · `(추정)` 1회독 추정 — 바로잡기에서 다시 본다(맞으면 `set … 확정 --confidence 확실`, 틀리면 기각). 원문은 `node tools/read.mjs <키> --num`.',
    '단위 절 뒤에 걸친 떡밥 줄기마다 `## 줄기 J<n>` 절 — 든 의문의 상태 · 답, 결말(곧바로 든 사실의 뒤쪽). 절 찾기: `grep -n "^## " <파일>`.',
    ...(level ? [`줄기 절을 줄였다(먼저 읽을 것 ${fmtN(FIRST_MAX)}자 안쪽으로 — 단계 ${level}: 풀린 의문은 ID와 답만${THREAD_LEVELS[level].factsMax < THREAD_FACTS_MAX ? ` · 결말 사실은 줄기마다 뒤 ${THREAD_LEVELS[level].factsMax}건` : ''}). 줄기 전부는 handoff/threads.md.`] : []),
  ].join('\n');
  const nextChunks = chunked('next', nextHead, [...unitBlocks, ...threadBlocks]);
  const nextNames = nextChunks.map((c) => c.name);


  const sizeOf = (names) => names.reduce((a, p) => a + len(files.get(p)), 0);
  const focusBudget = Math.max(focusFactsMin, Math.min(FOCUS_MAX, FILE_MAX - FOCUS_HEAD_RESERVE - len(stateText), FIRST_MAX - HEAD_RESERVE - FOCUS_HEAD_RESERVE - sizeOf(nextNames) - len(stateText)));
  const firstPos = nextItems.length ? Math.min(...nextItems.map((it) => orderIndex(order, it.key, it.parts))) : 0;
  const pool = facts.filter((f) => !shown.has(f.id));
  const { picked, left } = pickFacts(facts, pool, hits, focusBudget - 3_000, (f) => len(factLine(f)) + 1, { canon: id.canon });
  const groups = new Map();
  for (const p of picked) (groups.get(p.best) ?? groups.set(p.best, []).get(p.best)).push(p.fact);
  const factRank = new Map(facts.map((f, i) => [f, i]));
  const focusBody = [...groups].map(([t, list]) => {
    const sorted = list.sort((a, b) => factRank.get(a) - factRank.get(b));
    const before = sorted.filter((f) => pos(f) < firstPos);
    const after = sorted.filter((f) => pos(f) >= firstPos);
    const split = before.length && after.length ? ['— 이 세션 첫 단위부터 뒤 —'] : [];
    const side = !before.length ? ' · 모두 뒤' : !after.length ? ' · 모두 앞' : '';
    return [`### ${tName(t)} (${t}) · 원문 ${fmtN(hits.get(t))}줄${side}`, ...before.map(factLine), ...split, ...after.map(factLine)].join('\n');
  });
  const focusText = [
    `# 원문 대상 — ${nextItem ? `${nextItem.session} 원문 대상의 2회독 기록 · 앞뒤 사실` : '다음 세션 없음'}`,
    '',
    autoNote,
    nextItem
      ? `${nextItem.session} 원문(${keys.join(' · ')})에서 이름표 · 사전 이름 · 정체 연결로 대상을 뽑았다(기계적 — 코드로 푼 \`???\` 줄 · 정체 연결의 근거 줄 · 2회독 암시 언급 speaker 줄 포함, 같은 인물 무리는 하나로).`
      : '2회독 순서가 끝났다 — 고를 것이 없다.',
    `앞뒤 사실 ${picked.length}건 — next.md에 이미 나온 사실은 뺐다. 원문 대상과 이어지는데 예산(${fmtN(focusBudget)}자)으로 못 담은 사실 ${left}건 — 그 밖은 \`node tools/records.mjs find <이름>\` · annotations/read1/handoff/facts*.md.`,
    '고르는 법: 1회독 focus.md와 같다(사실 점수 = Σ log2(1 + 원문 줄 수) ÷ 그 대상을 다룬 사실 수). 대상 절 안은 출시순 — `— 이 세션 첫 단위부터 뒤 —` 아래(머리줄 `모두 뒤`면 전부)가 이 세션보다 뒤에 기록된 것.',
    ...(hits.size ? [`원문에 많이 나오는 대상(줄 수, 상위 20): ${[...hits].slice(0, 20).map(([t, k]) => `${tName(t)} ${fmtN(k)}`).join(' · ')}`] : []),
    '',
    ...(stateText ? [stateText, ''] : []),
    focusBody.length ? `## 앞뒤 사실\n\n${focusBody.join('\n\n')}` : '(고른 사실 없음)',
  ].join('\n');
  files.set('handoff/focus.md', `${focusText}\n`);
  if (len(focusText) > FILE_MAX) warnings.push(`2회독 handoff/focus.md가 ${fmtN(len(focusText))}자 — 파일 하나 ${fmtN(FILE_MAX)}자를 넘는다(인물 변화 · 생활상 지금까지가 크다)`);

  // ── threads.md — 떡밥 줄기 전부 (필요할 때) ──
  const allThreadBlocks = member.threads.map((t) => {
    const out = [`## ${threadTitle(t.id)}${t.c.status === '확정' ? ' ✓' : ''}`];
    if (t.c?.obj?.text) out.push(t.c.obj.text);
    for (const q of t.questions.map((x) => byId.get(x)).filter(Boolean).sort(byRank)) {
      const ans = recoveries(q.id).map((e) => e.obj?.answer).filter(Boolean);
      out.push(`- ${q.id} ${qState(q.id)} ${q.text}${ans.length ? ` → ${[...new Set(ans)].join(' · ')}` : ''} · ${q.unit}`);
    }
    for (const f of t.facts.map((x) => byId.get(x)).filter(Boolean).sort(byRank)) out.push(factLine(f));
    return out.join('\n');
  });
  const relLines = live.filter((c) => c.kind === 'relation').sort((a, b) => compareIds(a.id, b.id))
    .map((g) => `- ${g.id}${mark(g)} ${g.obj?.a} ${g.obj?.type} ${g.obj?.b} — ${g.obj?.text ?? ''}`);
  const threadNames = chunked('threads', (part) => [`# 떡밥 줄기 전부 — 2회독${part}`, '', autoNote,
    `줄기 ${member.threads.length} · 관계 ${relLines.length}. 줄기마다 든 의문(상태 · 답이 된 사실)과 곧바로 든 사실(답 · 줄기 facts · 뒤집음의 새 사실), 출시순. about으로만 든 사실은 뺐다(docs/annotations.md "떡밥 줄기").`].join('\n'),
  [...allThreadBlocks.map((text, i) => ({ label: member.threads[i].id, text })), ...(relLines.length ? [{ label: '줄기 관계', text: `## 줄기 관계\n${relLines.join('\n')}` }] : [])])
    .map((c) => ({ ...c, what: `떡밥 줄기 ${c.labels[0]}–${c.labels.at(-1)}` }));

  // ── index.md ──
  const index = ['# 2회독 인계 파일 목록 — 필요할 때 여는 것', '', autoNote, '',
    '| 파일 | 내용 | 글자 수 |', '|---|---|---:|',
    ...threadNames.map((c) => `| ${c.name} | ${c.what} — 든 의문 · 곧바로 든 사실${c.labels.includes('줄기 관계') ? ' · 줄기 관계' : ''} | ${fmtN(len(files.get(c.name)))} |`),
    '', '1회독 인계 파일도 그대로 쓴다 — annotations/read1/handoff/index.md: 사실 목록 전체(facts*.md) · 풀린 의문 · 열린 의문(questions*.md) · 1회독 세션 요약(R01*.md …).',
    '찾기: `node tools/records.mjs find <낱말>` · 기록과 근거 줄: `node tools/records.mjs review F12 Q3-2` · 볼 거리 전부: annotations/watch.json.'];
  files.set('handoff/index.md', `${index.join('\n')}\n`);

  // ── HANDOFF.md ──
  const allRead2 = ds.candidates.filter((c) => c.read2 && c.id);
  const fixesAll = ds.candidates.filter((c) => c.fix && c.id).length;
  const nx = nextIds(ds);
  const lastFile = [...ds.files2].filter((f) => f.data?.unit).sort((a, b) =>
    items.findIndex((it) => it.key === a.data.unit && (it.parts ?? null) === (a.data.parts ?? null)) - items.findIndex((it) => it.key === b.data.unit && (it.parts ?? null) === (b.data.parts ?? null))).at(-1) ?? null;
  // 단위 기준으로 센다 — 파트를 나눠 읽는 단위는 파트를 다 읽어야 읽은 것
  const unitKeys = [...new Set(items.map((it) => it.key))];
  const unitRead = (k) => items.filter((it) => it.key === k).every(isRead);
  const byLayer = [1, 2, 3].map((l) => {
    const xs = unitKeys.filter((k) => layerOf(k) === l);
    return `${l}층 ${xs.filter(unitRead).length}/${xs.length}`;
  });
  const noLayer = unitKeys.filter((k) => !layerOf(k));
  const head = ['# 2회독 인계', '', autoNote,
    '2회독 세션(P · M)은 앞 원문 대신 이것을 먼저 읽는다. 기록 형식은 docs/annotations.md "2회독 기록", 얼마나 잘게 · 어디까지 · 한 번 읽고 두 번 훑는 법은 docs/annotations.md "2회독 기준"(P1 — 꼭 먼저 읽는다). 원문을 다시 볼 때는 씬 ID로 `node tools/read.mjs <씬> --num`.', '',
    '## 진행 위치', '',
    `- 읽은 단위 ${unitKeys.filter(unitRead).length}/${unitKeys.length} (${byLayer.join(' · ')}${noLayer.length ? ` · 층 없음 ${noLayer.filter(unitRead).length}/${noLayer.length}` : ''})` +
      (lastFile ? ` · 마지막 기록: ${lastFile.data.session} ${lastFile.data.unit}${lastFile.data.date ? ` (${lastFile.data.date})` : ''}` : ' · 아직 2회독 기록 없음')];
  if (nextItem) {
    const layers = [...new Set(nextItems.map((it) => layerOf(it.key)).filter(Boolean))].sort();
    head.push(`- 다음: **${nextItem.session}** — ${sessionItems.map((it) => (isRead(it) ? `~~${itemLabel(it)}~~` : itemLabel(it))).join(' · ')}`);
    for (const l of layers) head.push(`- ${l}층에서 하는 것: ${LAYER_TASKS[l]} (docs/history/reading.md P · M 머리말)`);
  } else head.push('- 다음: 2회독 순서 끝');
  head.push(`- 2회독 기록 ${allRead2.length} — 확정 ${allRead2.filter((c) => c.status === '확정').length} · 기각 ${allRead2.filter((c) => c.status === '기각').length} · 남음 ${allRead2.filter((c) => c.status === '후보').length}` +
    ` · 바로잡기로 더한 1회독 항목 ${fixesAll} · 볼 거리 ${ds.watchItems.length}`);
  head.push(`- 다음 번호: 암시 언급 ${nx.I} · 떡밥 ${nx.E} · 인물 변화 ${nx.D} · 생활상 ${nx.U} · 되짚기 ${nx.V} | 바로잡기 사실 ${nx.F} · 의문 ${nx.Q} · 시점 ${nx.S} — 사건 번호는 \`node tools/records.mjs next F12\``);
  head.push('', '## 되짚기 메모 — 2회독이 넘긴 것 중 열린 것', '');
  if (openRevisits.length) for (const v of openRevisits) head.push(`- ${v.id} (${v.session ?? ''} ${v.unit}) ${v.obj?.text ?? ''}${arr(v.obj?.where).length ? ` — ${v.obj.where.join(' · ')}` : ''}`);
  else head.push('- 없음');
  head.push('', `## 떡밥 줄기 한눈에 — ${member.threads.length}개 (points에 J<n>로 쓴다 · 자세히는 handoff/threads.md)`, '');
  for (const t of member.threads) {
    const st = { 열림: 0, 일부: 0, 풀림: 0 };
    for (const q of t.questions) st[qState(q)]++;
    head.push(`- ${t.id} ${t.weight ?? '?'} ${t.title ?? ''} — 의문 ${t.questions.length}(열림 ${st.열림} · 일부 ${st.일부} · 풀림 ${st.풀림}) · 사실 ${t.facts.length}`);
  }
  const chunkWhat = (c) => {
    const us = c.labels.filter((l) => !l.startsWith('줄기 '));
    const ts = c.labels.filter((l) => l.startsWith('줄기 '));
    const span = (xs) => (xs.length > 2 ? `${xs[0]} … ${xs.at(-1)} (${xs.length})` : xs.join(' · '));
    return [us.length ? `이번 세션(${nextItem?.session ?? '없음'}) 단위 ${span(us)} — 볼 거리 · 1회독 기록과 그 뒤` : '',
      ts.length ? `걸친 떡밥 줄기 ${span(ts.map((l) => l.slice(3)))}의 결말` : ''].filter(Boolean).join(' · ') || '(없음)';
  };
  const firstFiles = [
    ...nextChunks.map((c) => ({ name: c.name, what: chunkWhat(c) })),
    { name: 'handoff/focus.md', what: `원문 대상의 2회독 기록(인물 변화 ${changes.length} · 생활상 ${lifes.length}) · 앞뒤 사실 ${picked.length}건` },
  ].map((x) => ({ ...x, size: len(files.get(x.name)) }));
  const tail = ['', '## 필요할 때 여는 것', '',
    `handoff/index.md — 떡밥 줄기 전부(${threadNames.length}파일) · 1회독 인계 파일(사실 목록 · 의문 · 1회독 세션 요약). 앞 사실은 \`node tools/records.mjs find <낱말>\`, 직전 2회독 세션의 기록은 \`node tools/records.mjs review <세션> --brief\`.`];
  const table = (selfSize) => {
    const rows = [{ name: 'HANDOFF.md', what: '이 파일', size: selfSize }, ...firstFiles];
    const total = rows.reduce((a, x) => a + x.size, 0);
    return { total, lines: ['', `## 먼저 읽을 것 — 합계 ${fmtN(total)}자`, '', '| 파일 | 내용 | 글자 수 |', '|---|---|---:|', ...rows.map((x) => `| ${x.name} | ${x.what} | ${fmtN(x.size)} |`)] };
  };
  let selfSize = 0;
  let text = '';
  for (let k = 0; k < 4; k++) {
    // 표에 이 파일 크기가 들어가 크기가 바뀔 수 있어 몇 번 맞춘다
    text = `${[...head, ...table(selfSize).lines, ...tail].join('\n')}\n`;
    if (len(text) === selfSize) break;
    selfSize = len(text);
  }
  const firstTotal = table(selfSize).total;
  if (firstTotal > FIRST_MAX) {
    warnings.push(`2회독 먼저 읽을 것이 ${fmtN(firstTotal)}자 — ${fmtN(FIRST_MAX)}자를 넘는다(이번 세션 단위의 1회독 기록이 많다). next.md는 단위 차례대로, focus.md는 앞 절부터 읽는다`);
    text += `\n⚠ 먼저 읽을 것이 ${fmtN(FIRST_MAX)}자를 넘는다 — next.md는 지금 읽는 단위 절만, focus.md는 앞 절(점수 높은 대상)부터 읽는다.\n`;
  }
  files.set('HANDOFF.md', text);
  return { files, firstTotal, firstNames: ['HANDOFF.md', ...firstFiles.map((x) => x.name)], warnings, next: nextItem ? { session: nextItem.session, items: nextItems.map(itemLabel) } : null };

  /**
   * 절 목록({label, text})을 FILE_MAX 안쪽 파일로 나눠 files에 넣는다 — 절 경계에서만 나눈다
   * @returns {{ name: string, labels: string[] }[]}
   */
  function chunked(base, headOf, sections) {
    const chunks = [];
    let cur = [];
    const headSize = len(`${headOf(' (9/9)')}\n\n`);
    let size = headSize;
    for (const sec of sections) {
      if (len(sec.text) + headSize > FILE_MAX) warnings.push(`2회독 handoff/${base}: 절 ${sec.label}이 ${fmtN(len(sec.text))}자 — 파일 하나 ${fmtN(FILE_MAX)}자를 넘는다`);
      if (cur.length && size + len(sec.text) + 2 > FILE_MAX) {
        chunks.push(cur);
        cur = [];
        size = headSize;
      }
      cur.push(sec);
      size += len(sec.text) + 2;
    }
    if (cur.length || !chunks.length) chunks.push(cur);
    const names = chunks.length === 1 ? [`handoff/${base}.md`] : chunks.map((_, i) => `handoff/${base}-${i + 1}.md`);
    return chunks.map((ch, i) => {
      const part = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : '';
      files.set(names[i], `${headOf(part)}\n\n${ch.length ? ch.map((x) => x.text).join('\n\n') : '(없음)'}\n`);
      return { name: names[i], labels: ch.map((x) => x.label) };
    });
  }
}
