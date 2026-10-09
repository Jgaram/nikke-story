/**
 * 씬 리더 패널(W1) — 오른쪽 aside. 어느 탭에서든 노드 · 선 · 기록을 누르면 `state.set({ sel })`로 열린다.
 * 원문 전문은 없다(공개 규칙) — 메타 · 기록 · 근거 `씬#줄` · 설정 오류 추정 메모 · 관계선(W3)만.
 *
 *   init({ root, state, data, fmt, ui })   app.js가 부팅 때 한 번
 *   open(sel)                              sel = state의 sel 형식(unit: · scene: · record: · person: · target: · thread: · tick:)
 *   close() · isOpen()
 *
 * 컷오프보다 뒤의 기록은 지우지 않고 가린다 — 흐리게 + "컷오프 뒤 — 스포일러" 펼치기.
 * 패널 안 링크는 모두 ui.link(sel) → state.set({ sel })이라 뒤로 가기가 된다.
 */
let root = null;
let state = null;
let data = null;
let fmt = null;
let ui = null;
let current = null;

export function init(deps) {
  ({ root, state, data, fmt, ui } = deps);
  root.setAttribute('aria-label', '리더 패널');
}
export const isOpen = () => Boolean(current);

export function close() {
  current = null;
  root.hidden = true;
  ui.clear(root);
  document.body.classList.remove('reader-open');
}

export async function open(sel) {
  const parsed = state.parseSel(sel);
  if (!parsed) return close();
  current = sel;
  root.hidden = false;
  document.body.classList.add('reader-open');
  ui.clear(root);
  root.append(head('불러오는 중…'), ui.spinner());
  try {
    const idx = await data.index();
    if (needsRecords(parsed.type)) {
      if (!idx.hasRecords) {
        await idx.withRecords();
      }
    }
    if (current !== sel) return; // 그새 다른 것을 골랐다
    ui.clear(root);
    const render = RENDER[parsed.type];
    if (!render) {
      root.append(head('모르는 선택'), ui.empty(`선택 형식을 모른다: ${sel}`));
      return;
    }
    render(parsed.id, idx);
    root.scrollTop = 0;
    root.querySelector('.reader-close')?.focus({ preventScroll: true });
  } catch (err) {
    ui.clear(root);
    root.append(head('오류'), ui.notice(err.message, 'error'));
  }
}

const needsRecords = (type) => ['scene', 'record', 'unit', 'person', 'target', 'thread'].includes(type);

function head(title, chips = []) {
  return ui.el('header', { class: 'reader-head' },
    ui.el('div', { class: 'reader-title' }, ui.el('h2', {}, title), chips.length ? ui.el('div', { class: 'chips' }, chips) : null),
    ui.el('button', { type: 'button', class: 'btn reader-close', 'aria-label': '리더 닫기', title: '닫기 (Esc)', onClick: () => state.set({ sel: '' }) }, '×'));
}
const row = (k, v) => (v == null || v === '' ? null : ui.el('div', { class: 'kv' }, ui.el('dt', {}, k), ui.el('dd', {}, v)));
const kv = (rows) => ui.el('dl', { class: 'kvs' }, rows);
const T = () => state.get().t;

/** 기록 한 줄 — 종류 칩 · 확신도 · 문장 · 근거 링크. 컷오프 뒤면 흐리게 */
function recordLine(r, { showUnit = false } = {}) {
  const hidden = !state.visible(r.tick);
  const st = fmt.stateAt(r, T());
  return ui.el('li', { class: ['record-line', hidden ? 'after-cutoff' : ''] },
    ui.el('div', { class: 'chips' },
      ui.chip('record', r.kind, fmt.recordLabel(r)),
      r.confidence === '추정' ? ui.chip('confidence', '추정') : null,
      st && st !== '앎' ? ui.chip('state', st) : null,
      r.user ? ui.chip('plain', 'user', '사용자 확정') : null),
    ui.el('div', { class: 'record-text' }, ui.link(`record:${r.id}`, r.id, { class: 'mono' }), ' ', fmt.recordText(r)),
    ui.el('div', { class: 'record-ref' },
      showUnit && r.unit ? [ui.link(`unit:${r.unit}`, fmt.unitTitle(r.unit)), ' · '] : null,
      r.evidence?.length ? r.evidence.map((e, i) => [i ? ' · ' : null, ui.link(`scene:${e.scene}`, `${e.scene}#${(e.lines ?? []).join(',')}`, { class: 'mono' })]) : null));
}

/** 기록 목록을 컷오프 앞 · 뒤로 갈라 그린다 — 뒤는 details 안 */
function recordList(records, opts = {}) {
  if (!records?.length) return ui.empty('기록 없음');
  const t = T();
  const order = (r) => (fmt.RECORD_ORDER.indexOf(r.kind) + 1 || 99);
  const sorted = [...records].sort((a, b) => order(a) - order(b) || (a.line ?? 0) - (b.line ?? 0) || String(a.id).localeCompare(String(b.id)));
  const before = sorted.filter((r) => state.visible(r.tick, t));
  const after = sorted.filter((r) => !state.visible(r.tick, t));
  return ui.el('div', { class: 'record-lists' },
    before.length ? ui.el('ul', { class: 'records' }, before.map((r) => recordLine(r, opts))) : ui.empty('컷오프 안의 기록 없음'),
    after.length ? ui.details(`컷오프 뒤 — 스포일러 ${after.length}건 펼치기`, ui.el('ul', { class: 'records' }, after.map((r) => recordLine(r, opts))), { class: 'spoiler' }) : null);
}

const countByKind = (records) => {
  const m = new Map();
  for (const r of records ?? []) m.set(r.kind, (m.get(r.kind) ?? 0) + 1);
  return [...m].sort((a, b) => fmt.RECORD_ORDER.indexOf(a[0]) - fmt.RECORD_ORDER.indexOf(b[0])).map(([k, n]) => `${fmt.RECORD_KIND[k]?.label ?? k} ${n}`).join(' · ');
};

const RENDER = {
  unit(key, idx) {
    const u = idx.units.get(key);
    if (!u) return root.append(head('없는 단위'), ui.empty(`단위를 모른다: ${key}`));
    const hidden = !state.visible(u.tick);
    root.append(head(u.title, [ui.chip('kind', u.kind), u.grade && u.grade !== '메인' ? ui.chip('grade', u.grade) : null, u.layer ? ui.chip('layer', u.layer) : null]));
    if (hidden) root.append(ui.notice(`컷오프(${fmt.tickLabel(T(), { date: false })}) 뒤에 공개된 단위다 — 아래는 스포일러일 수 있다`, 'warn'));
    const scenes = idx.scenesOf.get(key) ?? [];
    const recs = idx.recordsOfUnit.get(key) ?? [];
    root.append(ui.panel('메타', kv([
      row('키', ui.el('code', {}, key)),
      row('읽는 자리', `${u.order} / ${idx.unitList.length}`),
      row('공개 자리', u.tick != null ? `${u.tick} · ${fmt.tickLabel(u.tick)}${u.date_confidence === '추정' ? ' (추정)' : ''}` : null),
      row('공개일 출처', u.via === '딸림' ? '딸린 챕터 · 이벤트의 자리' : u.via),
      row('작중 자리', u.chrono ? `${fmt.CHRONO_CLASS[u.chrono.class] ?? u.chrono.class}${u.chrono.place ? ` · ${u.chrono.place}` : ''}${u.chrono.drift ? ` · 출시순과 ${u.chrono.drift}` : ''}` : null),
      row('글자 수', u.chars != null ? fmt.num(u.chars) : null),
      row('씬 · 줄', `${u.scenes}씬 · ${fmt.num(u.lines)}줄`),
      row('출처', u.library ? '금서고(팬 사이트) 원문 — 서술 · 독백 구분과 게임 씬 ID가 없다' : '블라링크'),
      row('대신함', u.replaces ? `블라링크 ${u.replaces}(본문 없음)를 이 금서고 원문으로 읽는다` : null),
      row('판정', u.judgment ? ui.el('code', {}, u.judgment) : null),
    ])));
    root.append(ui.panel(`씬 ${scenes.length}`, scenes.length ? ui.el('ol', { class: 'scene-list' }, scenes.map((s) =>
      ui.el('li', {}, ui.link(`scene:${s.id}`, `${s.seq}. ${s.title ?? s.id}`), ui.el('span', { class: 'muted' }, ` ${s.lines}줄${s.part ? ` · ${s.part}` : ''}${s.level ? ` · 호감도 ${s.level}` : ''} · ${(idx.recordsOf.get(s.id) ?? []).length}기록`)))) : ui.empty('씬 없음')));
    root.append(ui.panel(`기록 ${recs.length}`, [ui.el('p', { class: 'muted' }, countByKind(recs) || '없음'), recs.length > 80 ? ui.el('p', { class: 'muted' }, '씬을 골라 보면 그 씬의 기록만 나온다') : recordList(recs)]));
    slipsPanel(idx.slipsOf.get(key));
    root.append(ui.panel('관계선', ui.el('p', { class: 'muted' }, '관계선(선행 · 다음 편 · 떡밥 · 대상 공유)은 W3 연결 탭이 그린다')));
  },

  scene(id, idx) {
    const s = idx.scenes.get(id);
    if (!s) return root.append(head('없는 씬'), ui.empty(`씬을 모른다: ${id}`));
    const u = idx.units.get(s.unit);
    const recs = idx.recordsOf.get(id) ?? [];
    root.append(head(s.title ?? id, [u ? ui.chip('kind', u.kind) : null]));
    const siblings = idx.scenesOf.get(s.unit) ?? [];
    const prev = siblings[s.seq - 2];
    const next = siblings[s.seq];
    root.append(ui.panel('메타', kv([
      row('씬 ID', ui.el('code', {}, id)),
      row('단위', u ? ui.link(`unit:${u.key}`, u.title) : s.unit),
      row('순서', `${s.seq} / ${siblings.length}${s.part ? ` · ${s.part}` : ''}${s.level ? ` · 호감도 ${s.level}` : ''}`),
      row('줄 수', `${fmt.num(s.lines)}줄${s.has_text === 0 ? ' (본문 없음)' : ''}`),
      row('공개 자리', u?.tick != null ? fmt.tickLabel(u.tick) : null),
      row('이동', ui.el('span', { class: 'nav' }, prev ? ui.link(`scene:${prev.id}`, `← ${prev.title ?? prev.id}`) : null, prev && next ? ' · ' : null, next ? ui.link(`scene:${next.id}`, `${next.title ?? next.id} →`) : null)),
    ])));
    root.append(ui.panel(`기록 ${recs.length}`, recordList(recs)));
    slipsPanel((idx.slipsOf.get(s.unit) ?? []).filter((x) => !x.scenes?.length || x.scenes.includes(id)));
    root.append(ui.panel('관계선', ui.el('p', { class: 'muted' }, '이 씬이 끼는 관계선은 W3 연결 탭이 그린다')));
  },

  record(id, idx) {
    const r = idx.records?.get(id);
    if (!r) return root.append(head('없는 기록'), ui.empty(`기록을 모른다: ${id}`));
    const hidden = !state.visible(r.tick);
    const st = fmt.stateAt(r, T());
    root.append(head(`${r.id}`, [ui.chip('record', r.kind, fmt.recordLabel(r)), r.confidence ? ui.chip('confidence', r.confidence) : null, st ? ui.chip('state', st) : null, r.user ? ui.chip('plain', 'user', '사용자 확정') : null]));
    const body = ui.el('div', {});
    body.append(ui.el('p', { class: 'record-full' }, fmt.recordText(r)));
    if (r.kind === 'D' && r.act === '변화') body.append(kv([row('전', r.before), row('후', r.after), row('계기', r.trigger), row('시점', r.time ? ui.link(`record:${r.time}`, r.time) : null)]));
    if (r.kind === 'S') body.append(kv([row('관계', Array.isArray(r.at) ? r.at.map((a) => (Array.isArray(a) ? a.join(' ') : String(a))).join(' · ') : null), row('기준', r.ref), row('대상', r.subject), row('연도', r.years)]));
    if (r.kind === 'Q-k' || r.kind === 'F-k') body.append(kv([row('뿌리', r.parent ? ui.link(`record:${r.parent}`, r.parent) : null), row('답', r.answer ? ui.link(`record:${r.answer}`, r.answer) : null), row('정도', r.degree), row('새 사실', r.replaced_by ? ui.link(`record:${r.replaced_by}`, r.replaced_by) : null)]));
    if (r.kind === 'F' || r.kind === 'Q') {
      body.append(kv([
        row('처음', r.first_tick != null ? fmt.tickLabel(r.first_tick) : null),
        row('암시', r.hint_tick != null ? fmt.tickLabel(r.hint_tick) : null),
        row('일부 회수', r.partial_tick != null ? fmt.tickLabel(r.partial_tick) : null),
        row('회수', r.solved_tick != null ? fmt.tickLabel(r.solved_tick) : null),
        row('뒤집힘', r.reversed_tick != null ? `${fmt.tickLabel(r.reversed_tick)}${r.replaced_by ? ' → ' : ''}` : null),
        row('끝 상태', r.state),
      ]));
    }
    if (r.kind === 'O') body.append(kv([row('사슬', r.chain), row('쌓인 곳', r.built?.map((b, i) => [i ? ' · ' : null, /^[A-Z]\d/.test(b) ? ui.link(`record:${b}`, b) : ui.link(`unit:${b}`, fmt.unitTitle(b))])), row('끝', r.end ? ui.link(`unit:${r.end}`, fmt.unitTitle(r.end)) : null), row('닫는 기록', r.closing?.map((c, i) => [i ? ' · ' : null, ui.link(`record:${c}`, c)]))]));
    if (r.kind === 'H') body.append(kv([row('끝', r.end ? ui.link(`unit:${r.end}`, fmt.unitTitle(r.end)) : null), row('함께 끝남', r.members?.map((c, i) => [i ? ' · ' : null, ui.link(`record:${c}`, c)]))]));
    if (r.points?.length) body.append(kv([row('가리킴', r.points.map((p, i) => [i ? ' · ' : null, ui.link(`record:${p}`, p)]))]));
    body.append(ui.panel('근거', r.evidence?.length ? ui.el('ul', { class: 'plain' }, r.evidence.map((e) => ui.el('li', {}, ui.link(`scene:${e.scene}`, `${e.scene}#${(e.lines ?? []).join(',')}`, { class: 'mono' }), ' ', ui.el('span', { class: 'muted' }, idx.scenes.get(e.scene)?.title ?? '')))) : ui.empty('근거 씬 없음')));
    if (r.reason) body.append(ui.panel('왜 이렇게 읽었나', ui.el('p', { class: 'reason' }, r.reason)));
    if (r.about?.length) body.append(ui.panel('대상', ui.el('p', {}, r.about.map((a, i) => [i ? ' · ' : null, ui.link(`${a.startsWith('person:') ? 'person' : 'target'}:${a}`, fmt.targetName(a))]))));
    if (r.threads?.length) body.append(ui.panel('줄기', ui.el('p', {}, r.threads.map((j, i) => [i ? ' · ' : null, ui.link(`thread:${j}`, `${j} ${idx.threads.get(j)?.title ?? ''}`)]))));
    const rootId = r.parent ?? ((r.kind === 'F' || r.kind === 'Q') ? r.id : null);
    if (rootId) {
      const rootRec = idx.records.get(rootId);
      const events = idx.eventsOf.get(rootId) ?? [];
      const others = [rootRec, ...events].filter((x) => x && x.id !== r.id);
      if (others.length) body.append(ui.panel('같은 뿌리', recordList(others, { showUnit: true })));
    }
    body.append(ui.panel('어디', kv([row('단위', r.unit ? ui.link(`unit:${r.unit}`, fmt.unitTitle(r.unit)) : null), row('씬', r.scene ? ui.link(`scene:${r.scene}`, r.scene) : null), row('공개 자리', r.tick != null ? fmt.tickLabel(r.tick) : null), row('읽는 자리', r.order)])));
    if (hidden) root.append(ui.notice(`컷오프(${fmt.tickLabel(T(), { date: false })}) 뒤의 기록이다`, 'warn'), ui.details('컷오프 뒤 — 스포일러 펼치기', body, { class: 'spoiler' }));
    else root.append(body);
  },

  person(id, idx) {
    return RENDER.target(id, idx);
  },
  target(id, idx) {
    const t = idx.targets.get(id);
    if (!t) return root.append(head('없는 대상'), ui.empty(`대상을 모른다: ${id}`));
    root.append(head(t.name, [ui.chip('plain', t.type, fmt.TARGET_TYPE[t.type] ?? t.type), t.kind ? ui.chip('plain', t.kind, t.kind) : null]));
    const recs = idx.recordsAbout.get(id) ?? [];
    const units = new Set(recs.map((r) => r.unit).filter(Boolean));
    root.append(ui.panel('사전', kv([
      row('ID', ui.el('code', {}, id)),
      row('다른 이름', t.aliases?.length ? t.aliases.map((a) => `${a.name}(${a.how})`).join(' · ') : null),
      row('같은 인물 · 대상', t.same_as?.length ? t.same_as.map((s, i) => [i ? ' · ' : null, ui.link(`${s.startsWith('person:') ? 'person' : 'target'}:${s}`, fmt.targetName(s))]) : null),
      row('메모', t.note),
      row('나온 곳', t.stories ? `${fmt.num(t.stories)}씬 · ${fmt.num(t.lines)}줄 (이름 기준)` : null),
      row('기록', recs.length ? `${recs.length}건 · ${units.size}단위` : null),
    ])));
    root.append(ui.panel(`이 대상의 기록 ${recs.length}`, recs.length > 200 ? [ui.el('p', { class: 'muted' }, `${countByKind(recs)} — 많아서 인물 탭(W5) · 세계 탭(W7)에서 본다. 여기서는 앞 200건`), recordList(recs.slice(0, 200), { showUnit: true })] : recordList(recs, { showUnit: true })));
  },

  thread(id, idx) {
    const j = idx.threads.get(id);
    if (!j) return root.append(head('없는 줄기'), ui.empty(`줄기를 모른다: ${id}`));
    root.append(head(`${j.id} ${j.title}`, [ui.chip('plain', j.weight, j.weight), j.confidence === '추정' ? ui.chip('confidence', '추정') : null]));
    root.append(ui.panel('줄기', [
      ui.el('p', {}, j.text),
      kv([
        row('의문', `${j.questions?.length ?? 0} (열림 ${j.open ?? 0} · 일부 ${j.partial ?? 0} · 풀림 ${j.solved ?? 0})`),
        row('사실', j.facts?.length ?? 0),
        row('단위', j.units != null ? `${j.units} — ${j.first_unit ? fmt.unitTitle(j.first_unit) : ''} → ${j.last_unit ? fmt.unitTitle(j.last_unit) : ''}` : null),
        row('대상', j.about?.map((a, i) => [i ? ' · ' : null, ui.link(`${a.startsWith('person:') ? 'person' : 'target'}:${a}`, fmt.targetName(a))])),
        row('주인', j.owners?.map((a, i) => [i ? ' · ' : null, ui.link(`person:${a}`, fmt.targetName(a))])),
      ]),
    ]));
    const qs = (j.questions ?? []).map((q) => idx.records?.get(q)).filter(Boolean);
    const fs = (j.facts ?? []).map((f) => idx.records?.get(f)).filter(Boolean);
    root.append(ui.panel(`의문 ${qs.length}`, recordList(qs, { showUnit: true })));
    root.append(ui.panel(`사실 ${fs.length}`, recordList(fs, { showUnit: true })));
    const rels = idx.relations.filter((g) => g.from === id || g.to === id);
    root.append(ui.panel(`줄기 관계 ${rels.length}`, rels.length ? ui.el('ul', { class: 'plain' }, rels.map((g) => {
      const other = g.from === id ? g.to : g.from;
      return ui.el('li', {}, ui.chip('plain', g.type, g.type), ' ', ui.link(`thread:${other}`, `${other} ${idx.threads.get(other)?.title ?? ''}`), g.text ? ui.el('div', { class: 'muted' }, g.text) : null);
    })) : ui.empty('없음')));
  },

  tick(id, idx) {
    const t = idx.ticks.get(Number(id));
    if (!t) return root.append(head('없는 자리'), ui.empty(`공개 자리를 모른다: ${id}`));
    root.append(head(fmt.tickLabel(t.tick)));
    root.append(ui.panel(`이 자리에 공개된 단위 ${t.units.length}`, ui.el('ul', { class: 'plain' }, t.units.map((k) => {
      const u = idx.units.get(k);
      return ui.el('li', {}, u ? [ui.chip('kind', u.kind), ' ', ui.link(`unit:${k}`, u.title)] : k);
    }))));
  },
};

function slipsPanel(slips) {
  if (!slips?.length) return;
  root.append(ui.panel(`설정 오류 추정 ${slips.length}`, ui.el('ul', { class: 'plain' }, slips.map((s) => ui.el('li', { class: 'slip' }, s.text)))));
}
