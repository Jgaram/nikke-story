/**
 * 떡밥 줄기 소속 (B0b) — annotations/threads.json과 1회독 기록에서 기계적으로 편다. 형식 · 규칙은 docs/annotations.md "떡밥 줄기".
 *
 * 줄기 파일에 적는 것은 의문(questions)과, 의문에 안 걸린 사실 가운데 줄기에 꼭 넣을 것(facts)과, 줄기가 다루는 대상(about)뿐이다.
 * 나머지는 여기서 계산한다(같은 기록이면 같은 결과):
 *   - 의문: 줄기의 questions. 의문 하나는 줄기 하나에만 든다(검증기).
 *   - 사건: 소속 의문의 회수(Q<n>-k), 소속 사실의 드러냄 · 뒤집음(F<n>-k).
 *   - 사실(곧바로): 소속 의문의 답(answer) + 줄기의 facts + 뒤집음의 새 사실(replacedBy). 한 사실이 두 줄기의 답이면 둘 다에 든다.
 *   - 사실(about으로): 사실 정의의 about이 줄기 about과 겹치는 것 — 곧바로 든 사실은 뺀다. 화면 3에서 흐리게, 층 나누기에서는 참고로만 쓴다.
 * 기각된 기록 · 줄기는 뺀다. 후보는 넣되 상태를 그대로 둔다(확정값처럼 쓰는 쪽이 거른다).
 */
import { compareIds, isRecord } from './model.mjs';

const arr = (x) => (Array.isArray(x) ? x : []);

/**
 * @param {ReturnType<import('./model.mjs').loadDataset>} ds
 * @returns {{ threads: object[], byId: Map<string, object>, ofQuestion: Map<string, string>, ofFact: Map<string, string[]>, ofFactAbout: Map<string, string[]> }}
 *   threads[i] = { id, c, weight, title, questions, events, facts, aboutFacts } — 배열은 ID 순
 */
export function threadMembership(ds) {
  const live = ds.candidates.filter((c) => c.id && c.status !== '기각');
  const rec = new Map(live.filter(isRecord).map((c) => [c.id, c]));
  const eventsOf = new Map();
  for (const c of rec.values()) if (c.role === 'event' && c.parent) (eventsOf.get(c.parent) ?? eventsOf.set(c.parent, []).get(c.parent)).push(c);
  const factDefs = [...rec.values()].filter((c) => c.kind === 'fact' && c.role === 'def');
  const threads = [];
  const ofQuestion = new Map();
  const ofFact = new Map();
  const ofFactAbout = new Map();
  const add = (m, k, v) => {
    const xs = m.get(k) ?? m.set(k, []).get(k);
    if (!xs.includes(v)) xs.push(v);
  };
  for (const c of live.filter((x) => x.kind === 'thread').sort((a, b) => compareIds(a.id, b.id))) {
    const o = c.obj ?? {};
    const questions = arr(o.questions).filter((q) => rec.get(q)?.kind === 'question' && rec.get(q).role === 'def');
    const facts = new Set(arr(o.facts).filter((f) => rec.get(f)?.kind === 'fact' && rec.get(f).role === 'def'));
    const events = [];
    for (const q of questions) {
      ofQuestion.set(q, c.id);
      for (const e of eventsOf.get(q) ?? []) {
        events.push(e.id);
        if (typeof e.obj?.answer === 'string' && rec.has(e.obj.answer)) facts.add(e.obj.answer);
      }
    }
    // 뒤집음의 새 사실도 같은 줄기다 — 새 사실이 또 뒤집힐 수 있어 끝까지 따라간다
    const queue = [...facts];
    while (queue.length) {
      const f = queue.shift();
      for (const e of eventsOf.get(f) ?? []) {
        events.push(e.id);
        const nf = e.obj?.replacedBy;
        if (typeof nf === 'string' && rec.has(nf) && !facts.has(nf)) {
          facts.add(nf);
          queue.push(nf);
        }
      }
    }
    for (const f of facts) add(ofFact, f, c.id);
    const keys = new Set(arr(o.about));
    const aboutFacts = keys.size
      ? factDefs.filter((f) => !facts.has(f.id) && arr(f.obj?.about).some((t) => keys.has(t))).map((f) => f.id)
      : [];
    for (const f of aboutFacts) add(ofFactAbout, f, c.id);
    threads.push({
      id: c.id, c, weight: o.weight ?? null, title: o.title ?? null,
      questions: [...questions].sort(compareIds), events: [...new Set(events)].sort(compareIds),
      facts: [...facts].sort(compareIds), aboutFacts: aboutFacts.sort(compareIds),
    });
  }
  return { threads, byId: new Map(threads.map((t) => [t.id, t])), ofQuestion, ofFact, ofFactAbout };
}
