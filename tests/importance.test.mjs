/**
 * X3 중요도 판정 — 판정 입력에 2회독을 얹은 시안(tools/views/layers.mjs) · 다시 볼 묶음 · 이력 · 자리별 등급(tools/views/importance.mjs) · records.mjs layers ·
 * 주역 명단 초안(tools/views/leads.mjs — X3f) · 감정 재료 ⑧(X3g — 결정적 순간 후보).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { openDb } from '../tools/normalize/ensure-db.mjs';
import { openContext } from '../tools/records/context.mjs';
import { ROOT, loadDataset, spineUnits } from '../tools/records/model.mjs';
import { loadOrder, loadReadLayers } from '../tools/records/order.mjs';
import { read2Edges } from '../tools/records/read2.mjs';
import { buildRead1Views } from '../tools/views/read1.mjs';
import { EMOTION_ASPECTS, EMOTION_CLOSURES, EMOTION_GRADE, emptySignal, layerSignals, mainText } from '../tools/views/layers.mjs';
import { RECHECK_GROUPS, buildImportance, emotionCheck, gradeAt, gradeHistory, recheckReasons, renderEmotionReport } from '../tools/views/importance.mjs';
import { buildLeads, leadSignals, renderLeadsReport } from '../tools/views/leads.mjs';
import { GRADES } from '../tools/records/model.mjs';

const db = await openDb();
const ctx = await openContext(db);
test.after(() => db.close());
const order = loadOrder();
const ds = loadDataset();
const node = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 << 20 });

test('이력 — 검토 기록의 before에서 등급을 거꾸로 편다', () => {
  const obj = {
    grade: '필수',
    reviews: [
      { decision: '확정', by: 'claude', session: 'B0b-2' },
      { decision: '확정', by: 'claude', session: 'X3b', before: '등급 독립 · 근거 J35' },
      { decision: '확정', by: 'claude', session: 'X3c', note: '그대로' },
      { decision: '확정', by: '사용자', date: '2026-10-09', before: '등급 보강' },
    ],
  };
  assert.equal(gradeHistory(obj), 'B0b-2 독립 → X3b 보강 · X3c 그대로 → 사용자 필수');
  assert.equal(gradeHistory({ grade: '독립', reviews: [{ session: 'B0b-2' }] }), 'B0b-2 독립');
  assert.equal(gradeHistory({ grade: '보강' }), '보강', '검토 기록이 없으면 등급만');
});

test('다시 볼 묶음(X3f) — 지금 등급 · 주역 사연 · 메인이 딛음 · 참고의 문턱', () => {
  const s = (o) => ({ ...emptySignal('char:10'), ...o });
  const main = (o) => ({ src: 1, dir: 'in', act: null, record: 'Q9-2', own: 'Q9-2', type: 'setup_payoff', degree: '일부', mainUnit: 'ch10', threads: [], weights: {}, ...o });
  const lead = { person: 'person:라피', facts: ['F1', 'F2'], deep: [] };
  assert.deepEqual(recheckReasons('필수', s({})), ['필수 다시']);
  assert.deepEqual(recheckReasons('보강', s({ leads: [lead] })), ['주역 원점', '보강 다시']);
  assert.deepEqual(recheckReasons('보강', s({ leads: [lead] }), { origins: new Set(['person:라피']) }), ['보강 다시'], '원점이 정해진 주역의 사연 조각은 등급의 묶음으로');
  assert.deepEqual(recheckReasons('독립', s({ main: [main({ dir: 'out' })] })), ['메인이 딛음', '참고 후보']);
  assert.deepEqual(recheckReasons('독립', s({ main: [main({ degree: '전부' })] })), ['메인이 딛음', '참고 후보']);
  assert.deepEqual(recheckReasons('독립', s({ main: [main({ src: 2, dir: 'in', act: '재언급' })] })), ['독립 그대로'], '메인 것을 다시 꺼내기만 한 것은 입력이 아니다');
  assert.deepEqual(recheckReasons('독립', s({ loose: { world: ['F1'], main: [] } })), ['참고 후보']);
  assert.deepEqual(recheckReasons('독립', s({ life: { '방주 사회': 1 } })), ['참고 후보']);
  assert.deepEqual(recheckReasons('독립', s({ echo: [{ record: 'E2', thread: 'J1', weight: '보강', act: '암시' }] })), ['참고 후보']);
  assert.deepEqual(recheckReasons('독립', s({ echo: [{ record: 'E2', thread: 'J1', weight: '독립', act: '암시' }] })), ['독립 그대로']);
  assert.deepEqual(recheckReasons('독립', s({})), ['독립 그대로']);
  assert.deepEqual(RECHECK_GROUPS.map(([g]) => g), ['필수 다시', '주역 원점', '메인이 딛음', '보강 다시', '참고 후보', '독립 그대로'], '앞 묶음이 이긴다');
});

test('자리별 등급(X3f ⑤) — 나오기 전 없음 · 메인 자리 앞은 before · 그 뒤는 등급, 내려가지 않는다', () => {
  const u = { grade: '필수', pos: 10, from_pos: 30, before: '참고' };
  assert.deepEqual([gradeAt(u, 9), gradeAt(u, 10), gradeAt(u, 29), gradeAt(u, 30), gradeAt(u, 158)], [null, '참고', '참고', '필수', '필수']);
  assert.equal(gradeAt({ ...u, before: '' }, 20), '필수', 'before가 없으면 등급');
  assert.equal(gradeAt({ grade: '보강', pos: 40, from_pos: '', before: '' }, 40), '보강', '메인 자리가 단위보다 앞이면 나온 때부터 등급');
});

test('2회독 메인 연결 — 방향과 단위의 기록', () => {
  const views = buildRead1Views(ds, ctx, order);
  const r2 = read2Edges(ds, ctx, order);
  const sig = layerSignals(ds, views, r2);
  const sig1 = layerSignals(ds, views);
  // char:90 엠마 — 메인 ch15의 암시(E102)가 이 단위의 사실(F622)로 드러난다(C1 인계: '지휘관의 동기' 보강감)
  const m = sig.get('char:90').main.find((x) => x.record === 'E102');
  assert.deepEqual([m.src, m.dir, m.act, m.own, m.mainUnit], [2, 'in', '암시', 'F622', 'ch15']);
  assert.match(mainText(m), /메인 ch15이 흘린 것\(E102\)의 답 F622이 여기서 드러남/);
  assert.deepEqual([sig.get('char:90').draft.grade, sig.get('char:90').draft1.grade], ['보강', '참고'], '1회독만이면 줄기에 안 묶인 사실(F622 · F623)로 참고 시안');
  assert.deepEqual(sig.get('char:90').loose, { world: ['F623'], main: ['F622', 'F623'] });
  // 주역 사연(X3f) — 아니스의 과거(event_staranis1 — 지금은 척추라 메인 챕터만 기준으로 둔 sig0에서): 아니스를 다룬 사실 · 신념 · 기억 · 소속 · 신체 변화
  const sig0 = layerSignals(ds, views, r2, { spine: new Set() });
  const an = sig0.get('event_staranis1').leads.find((x) => x.person === 'person:아니스');
  assert.ok(an && an.facts.length >= 10 && an.deep.length >= 5, JSON.stringify(an));
  assert.equal(sig1.get('char:90')?.main.some((x) => x.src === 2) ?? false, false, '2회독 엣지를 안 주면 1회독만(B0b-2와 같다)');
  // 모든 2회독 연결은 척추 밖 단위에 붙고 척추(메인 챕터 · 척추 이벤트 · 사이드)를 가리킨다, 방향은 떡밥이 어디 있느냐로 정해진다(X3f-1c)
  const spine = spineUnits(ds);
  const inSpine = (u) => /^ch\d/.test(u) || spine.has(u);
  assert.ok(spine.size >= 11 && [...spine].every((u) => !sig.has(u)), '척추 단위는 판정 입력을 모으지 않는다');
  for (const s of sig.values()) {
    assert.ok(!inSpine(s.unit), s.unit);
    for (const x of s.main.filter((y) => y.src === 2)) {
      assert.ok(inSpine(x.mainUnit), `${s.unit} ${x.record} → ${x.mainUnit}`);
      assert.ok(['in', 'out'].includes(x.dir) && ['암시', '재언급'].includes(x.act), `${s.unit} ${x.record}`);
    }
  }
  // 척추 이벤트와 이어진 기록은 메인 챕터와 같은 무게 — BOOM! THE GHOST!는 OVER ZONE(척추)의 것을 다시 꺼낸다
  assert.ok(sig.get('fl:boom_the_ghost').main.some((x) => x.mainUnit === 'event_overzone'), '척추 이벤트 연결');
  assert.match(mainText(sig.get('fl:boom_the_ghost').main.find((x) => x.mainUnit === 'event_overzone')), /척추 event_overzone의 것을 여기서 다시 꺼냄/);
  // 척추를 빈 집합으로 주면 메인 챕터만 기준(척추 선정 계산) — 척추 단위도 판정 입력을 얻는다
  assert.ok(sig0.has('event_redash') && sig0.get('event_redash').main.every((x) => /^ch\d/.test(x.mainUnit)));
  // ⑥ 뒤 척추 의문 — 이 단위보다 뒤의 척추 의문 가운데 사실 about이 겹치는 것(읽는 순서로 뒤)
  const later = sig.get('fl:boom_the_ghost').later;
  assert.ok(later.length && later.every((q) => inSpine(q.unit) && q.about.length), JSON.stringify(later.slice(0, 2)));
});

test('중요도 시안 표 — 메인 밖 판정 전부 · 기준 시점 · 다시 볼 묶음 · 읽은 층 · 자리별 등급', () => {
  const v = buildImportance(ds, ctx, order, { readLayers: loadReadLayers() });
  const judged = ds.candidates.filter((c) => c.kind === 'layer' && c.status !== '기각').length;
  const spine = spineUnits(ds);
  assert.equal(v.units.length + v.spine.length, judged, '판정 하나에 줄 하나 — 척추 단위는 spine 목록으로');
  assert.equal(v.spine.length, spine.size, '척추(X3f-1b) — 이벤트 8 · 사이드 3');
  assert.ok(v.units.every((u) => !/^ch\d/.test(u.unit) && !spine.has(u.unit)), '메인 · 척추는 채점하지 않는다');
  assert.ok(v.spine.every((u) => spine.has(u.unit) && u.judgment && u.spine && u.layer === 1), '척추 단위는 판정 K를 "척추" 표시로 남기고 1층');
  assert.ok(v.units.every((u) => /^\d{4}-\d{2}-\d{2}$/.test(u.asof)), '확정 판정은 모두 기준 시점이 있다');
  assert.ok(v.units.every((u) => u.layer === u.read_layer), '층은 2회독에서 읽은 층 그대로');
  assert.ok(v.pending.every((u) => u.recheck && !u.rechecked));
  assert.ok(v.units.every((u) => RECHECK_GROUPS.some(([g]) => u.recheck.startsWith(g))), '판정마다 묶음이 하나 있다(기준 바꿈 — 432 모두 다시 본다)');
  const k = (unit) => v.units.find((u) => u.unit === unit);
  assert.match(k('char:90').recheck, /메인이 딛음/, '메인 ch15의 복선(E102)의 답이 여기 — 필수 후보로 본다');
  assert.match(k('event_wisdomspring').recheck, /^필수 다시/);
  assert.equal(k('event_overzone'), undefined, '척추 단위는 다시 볼 묶음에 없다');
  assert.ok(v.units.every((u) => u.pos > 0), '모든 단위에 공개 자리');
  assert.ok(v.units.every((u) => !u.from_pos || u.from_pos > u.pos), 'from 자리는 단위보다 뒤일 때만');
  assert.ok(v.units.every((u) => (u.grade_path !== u.grade) === Boolean(u.from_pos && u.before && u.before !== u.grade)));
  // 메인 챕터 자리마다 — 그때까지 나온 단위 수와 등급 수의 합이 같다
  for (const c of v.chapters) {
    const out = v.units.filter((u) => u.pos <= c.tick).length;
    assert.equal(GRADES.reduce((a, g) => a + c.counts[g], 0), out, c.key);
  }
  assert.equal(v.chapters.length, 49);
});

test('주역 명단 초안(X3f ① · X3f-1c) — 척추 축 · 같은 인물 합침 · 줄기의 주인 · 명단과 견줌', () => {
  const sig = leadSignals(ds, ctx, order);
  assert.equal(sig.chapters.length, 49 + spineUnits(ds).size, '축 = 메인 챕터 49 + 척추 이벤트 · 사이드');
  assert.ok(sig.chapters.includes('event_redash') && sig.chapters.indexOf('event_redash') > sig.chapters.indexOf('ch26'), '척추 단위는 읽는 순서 자리에');
  const p = (x) => sig.persons.get(`person:${x}`);
  assert.ok(sig.chapters.every((ch) => p('지휘관').byCh.get(ch).hit), '지휘관은 늘 걸린다');
  assert.deepEqual([p('라피').draft.from, p('라피').draft.scope], ['ch00', '전체']);
  // 사용자 예(2026-10-09): 도로시 ch19 · 레비아탄 ch32 · 니힐리스타 ch20부터
  assert.deepEqual([p('도로시').draft.from, p('레비아탄').draft.from, p('니힐리스타').draft.from], ['ch19', 'ch32', 'ch20']);
  assert.equal(p('니힐리스타').draft.scope, '구간');
  // 줄기 기록에 이름만 걸린 자리는 잇기만 하고 from이 되지 않는다(레비아탄 ch31)
  assert.deepEqual([p('레비아탄').byCh.get('ch31').hit, p('레비아탄').byCh.get('ch31').center], [true, false]);
  assert.ok(p('레비아탄').draft.records.includes('J10') && p('레비아탄').role.includes('J10의 주인'));
  // 같은 인물 합침 — 신데렐라 = 아나키오르 = 거울 공주, 마리안 = 모더니아, 세이렌 = 리틀 머메이드(대표는 뼈대 줄기 about에 먼저 나온 ID)
  assert.ok(p('신데렐라').members.includes('person:아나키오르') && !sig.persons.has('person:아나키오르'));
  assert.ok(p('마리안').members.includes('person:모더니아') && p('세이렌').members.includes('person:리틀_머메이드'));
  assert.ok(p('라피').members.includes('person:피라'), '뼈대 about에 없으면 말한 줄이 많은 쪽이 대표');
  // 주역 풀 = 줄기의 주인 + 카운터스 · 지휘관 — 풀 밖은 초안이 없다
  assert.ok(sig.pool.has('person:지휘관') && sig.pool.has('person:아니스') && !sig.pool.has('person:베히모스'));
  assert.equal(p('베히모스').draft, null);
  assert.ok(sig.threads.every((t) => t.listed && t.owners.length <= 2), '뼈대 줄기마다 주인 항목(1–2명)');
  const v = buildLeads(ds, ctx, order);
  assert.deepEqual([v.missing, v.revive, v.extra], [[], [], []], '풀과 명단이 같다');
  assert.equal(v.leads.filter((c) => c.status !== '기각').length, v.pool.size);
  assert.ok(v.leads.filter((c) => c.status !== '기각').every((c) => sig.chapters.includes(c.obj.from)), 'from은 축의 자리');
  const rep = renderLeadsReport(v);
  assert.ok(rep.split('\n').filter((l) => l.startsWith('| Z')).every((l) => [...l.matchAll(/`([^`]*)`/g)].every((m) => !m[1].includes('|'))), '표 안 띠에는 | 를 쓰지 않는다');
  assert.match(rep, /\| 신데렐라 \(= 거울_공주 · 아나키오르\) \|/);
});

test('감정 재료 ⑧(X3g) — 주요 인물 · 척추 인물의 변화 D · 마무리 O만, 지휘관과의 관계 빼고, 같은 인물 합침', () => {
  const sig = layerSignals(ds, buildRead1Views(ds, ctx, order), read2Edges(ds, ctx, order));
  const byId = new Map(ds.candidates.filter((c) => c.id).map((c) => [c.id, c]));
  const spine = spineUnits(ds);
  const all = [...sig.values()].flatMap((s) => s.emotion.moments.map((m) => ({ ...m, unit: s.unit })));
  assert.ok(all.length > 50, `${all.length}`);
  for (const m of all) {
    assert.ok(!/^ch\d/.test(m.unit) && !spine.has(m.unit), `${m.record} — 척추 단위는 모으지 않는다`);
    assert.equal(m.grade, EMOTION_GRADE[m.cls], `${m.record} — 주요 인물 필수 · 척추 인물 보강`);
    if (m.type === 'D') {
      const c = byId.get(m.record);
      assert.ok(c.kind === 'change' && c.act === '변화' && c.unit === m.unit && EMOTION_ASPECTS.includes(c.obj.aspect), `${m.record} — 이 단위의 변화 D(성격 빼고)`);
      assert.ok(!(c.obj.aspect === '관계' && [c.obj.person, ...(c.obj.with ?? [])].includes('person:지휘관')), `${m.record} — 지휘관과의 관계는 뺀다`);
      assert.equal(m.basis, m.record);
    } else {
      const c = byId.get(m.record);
      assert.ok(c.kind === 'closure' && c.status === '확정' && c.obj.end === m.unit && EMOTION_CLOSURES.includes(c.obj.type), `${m.record} — 여기서 끝나는 확정 O(연작 빼고)`);
      assert.ok(c.obj.type === '성장' || !c.obj.about.includes('person:지휘관'), `${m.record} — 지휘관과의 관계 · 갈등 마무리는 뺀다`);
      assert.equal(m.spineBuilt, true, `${m.record} — 척추 밖에서만 쌓인 O는 뺀다(X3g-2, 닫는 D로 본다)`);
    }
  }
  // 주요 인물 = annotations/majors.json 확정 항목(X3g-1b — 주역 명단과 따로)
  const majors = new Map(ds.candidates.filter((c) => c.kind === 'major' && c.status === '확정').map((c) => [c.obj.person, c.obj.from]));
  assert.ok(majors.size >= 1);
  for (const m of all.filter((x) => x.cls === '주요 인물')) assert.equal(m.from, majors.get(m.major), `${m.record} — from은 주요 인물의 from`);
  // 지휘관 자신의 변화(신념 · 기억)는 명단대로(지금 주요 인물)
  assert.ok(all.some((m) => m.person === 'person:지휘관' && m.cls === '주요 인물' && m.aspect !== '관계'));
  // 주역이어도 주요 인물이 아니면 보강까지 — 같은 인물: 릴리바이스의 변화는 릴리스와 합쳐 센 척추 인물의 것
  assert.ok(all.some((m) => m.person === 'person:릴리바이스' && m.cls === '척추 인물' && m.grade === '보강'));
  // 사이드 SECOND AFFECTION — 마리안(주요 인물, ch48)의 소속 변화 D418 · 척추가 쌓은 성장의 끝 O12(닫는 기록 D417)
  const sa = sig.get('side:second_affection').emotion;
  assert.equal(sa.grade, '필수');
  const d418 = sa.moments.find((m) => m.record === 'D418');
  assert.deepEqual([d418.cls, d418.aspect, d418.from], ['주요 인물', '소속', majors.get('person:마리안')]);
  assert.ok(d418.same.length && d418.same.every((x) => /^D\d+@/.test(x)), '척추의 같은 줄 단서');
  const o12 = sa.moments.find((m) => m.record === 'O12');
  assert.deepEqual([o12.type, o12.basis, o12.spineBuilt], ['O', 'D417', true]);
  // 척추 밖에서만 쌓인 O(아르카나 성장 O205 — 호감도 · 이벤트에서만 쌓임)는 빠지고 닫는 D2210만 남는다
  const arc = sig.get('char:583').emotion.moments.map((m) => m.record);
  assert.ok(arc.includes('D2210') && !arc.includes('O205'), arc.join(' '));
  assert.deepEqual(emptySignal('char:1').emotion, { moments: [], grade: null, from: null });
  assert.equal(layerSignals(ds, buildRead1Views(ds, ctx, order)).get('side:second_affection').emotion.moments.length, 0, '2회독 없이는 모으지 않는다');
});

test('감정 기준 후보(X3g) — 오름 · 이른 자리, 후보 표', () => {
  assert.equal(emotionCheck({ grade: '참고', pos: 10, from_pos: '' }, '필수', 30), '오름');
  assert.equal(emotionCheck({ grade: '필수', pos: 10, from_pos: '' }, '보강', ''), '', '상한이 낮으면 후보가 아니다');
  assert.equal(emotionCheck({ grade: '보강', pos: 10, from_pos: 40 }, '보강', 20), '이른 자리');
  assert.equal(emotionCheck({ grade: '보강', pos: 10, from_pos: 40 }, '보강', ''), '이른 자리', '감정 쪽은 나온 때부터');
  assert.equal(emotionCheck({ grade: '보강', pos: 10, from_pos: '' }, '보강', 20), '', '지금 등급이 나온 때부터면 더 이를 수 없다');
  assert.equal(emotionCheck({ grade: '참고', pos: 10, from_pos: '' }, null, ''), '');
  const v = buildImportance(ds, ctx, order, { readLayers: loadReadLayers() });
  assert.ok(v.emotion.length > 50 && v.emotion.every((u) => u.emotion && u.moments.length), '결정적 순간 후보가 있는 단위');
  for (const u of v.units) assert.equal(u.emotion_check, emotionCheck(u, u.emotion || null, u.emotion_from_pos), u.unit);
  assert.ok(v.units.some((u) => u.emotion_check === '오름'));
  const rep = renderEmotionReport(v);
  const rows = rep.split('\n').filter((l) => /^\| \d+ \| `/.test(l));
  assert.equal(rows.length, v.units.filter((u) => u.emotion_check).length, '후보마다 한 줄');
  const pos = rows.map((l) => Number(l.split('|')[1]));
  assert.deepEqual(pos, [...pos].sort((a, b) => a - b), '공개 자리 순');
});

test('records.mjs layers — 판정 · 시안 · 2회독 입력을 함께 보인다', () => {
  const r = node(['tools/records.mjs', 'layers', 'char:90']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /판정 K\d+ (필수|보강|참고|독립)/);
  assert.match(r.stdout, /시안 보강 · 근거 F622 — 2회독 암시.*\(2회독 없이: 참고\)/);
  assert.match(r.stdout, /줄기에 안 묶인 사실: 세계 1\(F623\) · 메인 인물 2\(F622,F623\)/);
  const sum = node(['tools/records.mjs', 'layers', 'char:90', '--summary']);
  assert.match(sum.stdout, /요약\(1회독\): \S/);
  const leads = node(['tools/records.mjs', 'leads', '레비아탄']);
  assert.equal(leads.status, 0, leads.stderr);
  assert.match(leads.stdout, /■ person:레비아탄 \(= 레비\) — Z\d+ 확정 · ch32부터 · 메인 전체/);
  assert.match(leads.stdout, /\| ch32 \| \d+ \(\d+%\) \|/);
  const grades = node(['tools/query.mjs', 'grades', 'ch20']);
  assert.equal(grades.status, 0, grades.stderr);
  assert.match(grades.stdout, /공개 자리 \d+\/\d+ .* 메인 ch20까지/);
  assert.match(grades.stdout, /나온 메인 밖 단위 \d+\/\d+: 필수 \d+ · 보강 \d+ · 참고 \d+ · 독립 \d+/);
  assert.match(r.stdout, /척추 연결 2회독: in 암시 E102→F622@ch15/);
  const sp = node(['tools/records.mjs', 'layers', 'event_redash']);
  assert.match(sp.stdout, /^■ event_redash \[이벤트\] 척추 — 채점하지 않는다/, '척추 단위는 머리에 알린다');
  const sa = node(['tools/records.mjs', 'layers', 'side:second_affection']);
  assert.match(sa.stdout, /감정 재료\(X3g — 결정적 순간 후보.*\): 상한 필수 · [\w:]+부터/);
  assert.match(sa.stdout, /D418 마리안 소속(\([^)]*\))? \[주요 인물 → 필수 · [\w:]+부터\]: .* \| 척추 같은 줄 D\d+@/);
  const r1 = node(['tools/records.mjs', 'layers', 'char:90', '--read1']);
  assert.match(r1.stdout, /시안 참고 · 근거 F622 — 줄기에 안 묶인 기록/, '--read1이면 1회독만(2회독 메인 연결이 빠져 참고 시안)');
});
