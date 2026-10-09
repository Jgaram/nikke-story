/**
 * 라벨 · 색 · 표기(W1). 색은 CSS 변수를 가리키고 값은 style.css 토큰 한 곳에만 있다.
 *
 *   KIND[id] · KIND_ORDER           단위 종류(main · event · side · sub · relic · erelic · episode · elevator) → label · color
 *   GRADE[등급]                      필수 · 보강 · 참고 · 독립(파란 순서 램프) · 척추 · 메인(잉크)
 *   LAYER[1..3]                     층(주황 순서 램프)
 *   STATE[상태]                      의문 · 사실의 컷오프 상태 — 열림 · 일부 · 풀림 · 뒤집힘 · 암시만 · 아직 · 앎
 *   RECORD_KIND[코드]                F · Q · F-k · Q-k · S · I · E · D · U · O · H → label
 *   TARGET_TYPE · CONFIDENCE · THREAD_WEIGHT
 *   use(idx)                        색인을 묶는다 — 아래 함수가 단위 · 공개 자리 · 대상 이름을 찾을 수 있게(app.js가 부팅 때 한 번)
 *   unitTitle(u | key)              'CH.07 재회' · '라피 (호감도 5편)'
 *   tickLabel(tick, { date })       'CH.20 · 2023-01-12' / 'CH.17 뒤 · 2022-11-10' / null → '전부'
 *   tickShort(tick)                 'CH.20' / 'CH.17+'
 *   ref(scene, line)                'd_main_07_02#12'   evidence(ev[]) → 'd_main_07_02#12-17 · d_main_07_03#8'
 *   targetName(id)                  'person:스노우_화이트' → '스노우 화이트'(사전에 있으면 표준명)
 *   recordText(r) · recordLabel(r)  기록 한 줄 · 종류 라벨(사건은 act까지)
 *   stateAt(r, T)                   사실 · 의문의 컷오프 T 상태(docs/views.md "공개 축" 규칙)
 *   num(n) · pct(x) · date(s)
 */
export const KIND = {
  main: { label: '메인', color: 'var(--kind-main)' },
  event: { label: '이벤트', color: 'var(--kind-event)' },
  episode: { label: '호감도', color: 'var(--kind-episode)' },
  sub: { label: '서브퀘스트', color: 'var(--kind-sub)' },
  relic: { label: '유실물', color: 'var(--kind-relic)' },
  side: { label: '사이드', color: 'var(--kind-side)' },
  erelic: { label: '이벤트 유실물', color: 'var(--kind-erelic)' },
  elevator: { label: '엘리베이터', color: 'var(--kind-elevator)' },
  other: { label: '그 밖', color: 'var(--ink-muted)' },
};
export const KIND_ORDER = ['main', 'event', 'episode', 'sub', 'relic', 'side', 'erelic', 'elevator'];

export const GRADE = {
  필수: { label: '필수', color: 'var(--grade-must)', rank: 1 },
  보강: { label: '보강', color: 'var(--grade-support)', rank: 2 },
  참고: { label: '참고', color: 'var(--grade-ref)', rank: 3 },
  독립: { label: '독립', color: 'var(--grade-standalone)', rank: 4 },
  척추: { label: '척추', color: 'var(--grade-spine)', rank: 0 },
  메인: { label: '메인', color: 'var(--grade-main)', rank: 0 },
};
export const GRADE_ORDER = ['메인', '척추', '필수', '보강', '참고', '독립'];

export const LAYER = {
  1: { label: '1층', color: 'var(--layer-1)' },
  2: { label: '2층', color: 'var(--layer-2)' },
  3: { label: '3층', color: 'var(--layer-3)' },
};

export const STATE = {
  열림: { label: '열림', color: 'var(--state-open)' },
  일부: { label: '일부 회수', color: 'var(--state-partial)' },
  풀림: { label: '풀림', color: 'var(--state-solved)' },
  뒤집힘: { label: '뒤집힘', color: 'var(--state-reversed)' },
  암시만: { label: '암시만', color: 'var(--state-hint)' },
  아직: { label: '아직', color: 'var(--state-none)' },
  앎: { label: '앎', color: 'var(--state-known)' },
};

export const RECORD_KIND = {
  F: { label: '사실', group: '1회독' },
  Q: { label: '의문', group: '1회독' },
  'F-k': { label: '사실 사건', group: '1회독' },
  'Q-k': { label: '의문 사건', group: '1회독' },
  S: { label: '시점', group: '1회독' },
  I: { label: '암시 언급', group: '2회독' },
  E: { label: '떡밥', group: '2회독' },
  D: { label: '인물 변화', group: '2회독' },
  U: { label: '생활상', group: '2회독' },
  O: { label: '마무리', group: '마무리' },
  H: { label: '합류', group: '마무리' },
};
export const RECORD_ORDER = Object.keys(RECORD_KIND);

export const TARGET_TYPE = { person: '인물', place: '장소', org: '조직', concept: '개념', incident: '사건', item: '물건' };
export const CONFIDENCE = { 확실: { label: '확실' }, 추정: { label: '추정' } };
export const THREAD_WEIGHT = { 뼈대: { label: '뼈대' }, 보강: { label: '보강' }, 독립: { label: '독립' } };
export const CHRONO_CLASS = { 판별: '판별', 범위: '범위', 상대: '상대', 불명: '시점 불명' };

let idx = null;
export function use(i) {
  idx = i;
}

export function unitTitle(u) {
  const unit = typeof u === 'string' ? idx?.units.get(u) : u;
  return unit?.title ?? (typeof u === 'string' ? u : '?');
}

function tickObj(tick) {
  return idx?.ticks.get(Number(tick)) ?? null;
}
const chNum = (key) => (key ? `CH.${String(key).replace(/^ch/, '')}` : null);

export function tickShort(tick) {
  if (tick == null) return '전부';
  const t = tickObj(tick);
  if (!t) return `#${tick}`;
  return t.main ? chNum(t.main) : t.upto ? `${chNum(t.upto)}+` : `#${tick}`;
}

export function tickLabel(tick, { date = true } = {}) {
  if (tick == null) return '전부 보기';
  const t = tickObj(tick);
  if (!t) return `공개 자리 ${tick}`;
  const head = t.main ? `${chNum(t.main)}까지` : t.upto ? `${chNum(t.upto)} 뒤` : `자리 ${tick}`;
  return date && t.date ? `${head} · ${t.date}` : head;
}

export const ref = (scene, line) => (line == null ? String(scene ?? '') : `${scene}#${line}`);
export const evidence = (ev) => (Array.isArray(ev) ? ev.map((e) => `${e.scene}#${(e.lines ?? []).join(',')}`).join(' · ') : '');

export function targetName(id) {
  if (!id) return '';
  const t = idx?.targets.get(id);
  if (t) return t.name;
  return String(id).replace(/^[a-z]+:/, '').replace(/_/g, ' ');
}

export function recordLabel(r) {
  const k = RECORD_KIND[r.kind]?.label ?? r.kind;
  if (r.kind === 'F-k' || r.kind === 'Q-k' || r.kind === 'E' || r.kind === 'D') return r.act ? `${k} · ${r.act}` : k;
  if (r.kind === 'S') return r.time_kind ? `${k} · ${r.time_kind}` : k;
  if (r.kind === 'U') return r.topic ? `${k} · ${r.topic}` : k;
  if (r.kind === 'O') return r.type ? `${k} · ${r.type}` : k;
  return k;
}

export function recordText(r) {
  if (!r) return '';
  if (r.kind === 'I') return `${targetName(r.target)}${r.speaker ? ' (이름표로 말함)' : ''} — 이름 없이 나온다`;
  if (r.kind === 'D') {
    const head = `${targetName(r.person)} ${r.aspect ?? ''}${r.with?.length ? ` (${r.with.map(targetName).join(' · ')})` : ''}`.trim();
    if (r.act === '변화') return `${head}: ${r.before ?? '?'} → ${r.after ?? '?'}`;
    return `${head}: ${r.text ?? ''}`;
  }
  if (r.kind === 'Q-k') return r.text ?? `${r.parent} 회수${r.answer ? ` — 답 ${r.answer}` : ''}${r.degree ? ` (${r.degree})` : ''}`;
  if (r.kind === 'F-k') return r.text ?? `${r.parent} ${r.act ?? ''}${r.replaced_by ? ` → ${r.replaced_by}` : ''}`;
  if (r.kind === 'H') return r.title ? `${r.title} — ${r.text ?? ''}` : r.text ?? '';
  return r.text ?? '';
}

/**
 * 사실 · 의문의 컷오프 상태. 사실: 앎(처음 밝혀짐 ≤ T) · 뒤집힘(뒤집힘 ≤ T) · 암시만(암시 ≤ T < 처음) · 아직.
 * 의문: 풀림(회수 ≤ T) · 일부(일부 회수 ≤ T) · 열림(제기 ≤ T) · 암시만 · 아직. T가 null이면 끝 상태.
 */
export function stateAt(r, T) {
  if (!r || (r.kind !== 'F' && r.kind !== 'Q')) return null;
  const le = (x) => x != null && (T == null || x <= T);
  if (r.kind === 'F') {
    if (le(r.reversed_tick)) return '뒤집힘';
    if (le(r.first_tick)) return '앎';
    if (le(r.hint_tick)) return '암시만';
    return '아직';
  }
  if (le(r.solved_tick)) return '풀림';
  if (le(r.partial_tick)) return '일부';
  if (le(r.first_tick)) return '열림';
  if (le(r.hint_tick)) return '암시만';
  return '아직';
}

export const num = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('ko-KR'));
export const pct = (x, d = 0) => (x == null ? '' : `${(x * 100).toFixed(d)}%`);
export const date = (s) => s ?? '';
