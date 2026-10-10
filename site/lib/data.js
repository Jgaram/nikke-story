/**
 * 데이터 로딩(W1) — site/data/<name>.json을 받아 메모리에 두고, ID → 객체 Map 색인을 한 번만 만든다.
 *
 *   load(name)                      fetch + 캐시. 실패하면 한국어 메시지의 Error(앱이 띄운다)
 *   loadRecords()                   records.json(1회독) + records2.json(2회독 · 마무리)을 합친 배열(캐시)
 *   index({ records })              색인(아래). records: true면 기록 색인까지 기다린다. 기록이 없으면 idx.withRecords()로 뒤에 받는다
 *
 * idx = {
 *   manifest, unitList, units(key → unit), tickList, ticks(tick → tick), scenes(id → scene), scenesOf(unit → scene[]),
 *   tickOf(unitKey) → tick, unitOf(sceneId) → unit, mainTicks(메인 챕터만 — 슬라이더 눈금),
 *   targets(id → target), targetList, threads(id → thread — 시점별 판이 있으면 v[], W15c), threadList, relations, slips, slipsOf(unit → slip[]),
 *   hasRecords, records(id → record) | null, recordList, recordsOf(scene → record[]), recordsOfUnit(unit → record[]),
 *   eventsOf(root → event[]), recordsOfThread(J → record[]), recordsAbout(target → record[]), withRecords() → Promise<idx>
 * }
 * 파일 모양은 docs/views.md "파일 배치 · 모듈 규약 · 실행법 (W1)".
 */
const BASE = './data/';
const cache = new Map();

export async function load(name) {
  if (cache.has(name)) return cache.get(name);
  const p = (async () => {
    let res;
    try {
      res = await fetch(`${BASE}${name}.json`, { cache: 'no-cache' });
    } catch (err) {
      throw new Error(`${name}.json을 받지 못했다 — ${err.message}`);
    }
    if (!res.ok) throw new Error(`${name}.json을 받지 못했다 (HTTP ${res.status})`);
    try {
      return await res.json();
    } catch {
      throw new Error(`${name}.json이 JSON이 아니다`);
    }
  })();
  cache.set(name, p);
  p.catch(() => cache.delete(name));
  return p;
}

export async function loadRecords() {
  if (cache.has('records:all')) return cache.get('records:all');
  const p = Promise.all([load('records'), load('records2')]).then(([a, b]) => [...a, ...b]);
  cache.set('records:all', p);
  p.catch(() => cache.delete('records:all'));
  return p;
}

const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);

let idx = null;
let idxPromise = null;

function buildCore({ manifest, units, ticks, scenes, targets, threads, slips, versions = null }) {
  const unitMap = new Map(units.map((u) => [u.key, u]));
  const tickMap = new Map(ticks.map((t) => [t.tick, t]));
  const sceneMap = new Map(scenes.map((s) => [s.id, s]));
  const scenesOf = new Map();
  for (const s of scenes) push(scenesOf, s.unit, s);
  const slipsOf = new Map();
  for (const s of slips) push(slipsOf, s.unit, s);
  const targetMap = new Map(targets.map((t) => [t.id, t]));
  const threadMap = new Map(threads.threads.map((j) => [j.id, j]));
  // 시점별 판(W15c — versions.json) — 떡밥마다 j.v = [{ at, title, text }](읽는 순서). 고르는 것은 fmt.threadAt
  for (const [id, list] of Object.entries(versions?.threads ?? {})) if (threadMap.has(id)) threadMap.get(id).v = list;
  // 사전 설명 판(W15e) — 대상마다 t.v = [{ at, text }]. 고르는 것은 fmt.noteAt
  for (const [id, list] of Object.entries(versions?.targets ?? {})) if (targetMap.has(id)) targetMap.get(id).v = list;
  const mainTicks = ticks.filter((t) => t.main);
  return {
    manifest,
    unitList: units,
    units: unitMap,
    tickList: ticks,
    ticks: tickMap,
    mainTicks,
    scenes: sceneMap,
    scenesOf,
    tickOf: (key) => unitMap.get(key)?.tick ?? null,
    unitOf: (sceneId) => unitMap.get(sceneMap.get(sceneId)?.unit) ?? null,
    targets: targetMap,
    targetList: targets,
    threads: threadMap,
    threadList: threads.threads,
    relations: threads.relations,
    slips,
    slipsOf,
    hasRecords: false,
    records: null,
    recordList: [],
    recordsOf: new Map(),
    recordsOfUnit: new Map(),
    eventsOf: new Map(),
    recordsOfThread: new Map(),
    recordsAbout: new Map(),
  };
}

function addRecords(core, list) {
  const records = new Map(list.map((r) => [r.id, r]));
  const recordsOf = new Map();
  const recordsOfUnit = new Map();
  const eventsOf = new Map();
  const recordsOfThread = new Map();
  const recordsAbout = new Map();
  for (const r of list) {
    if (r.scene) push(recordsOf, r.scene, r);
    if (r.unit) push(recordsOfUnit, r.unit, r);
    if (r.parent) push(eventsOf, r.parent, r);
    for (const j of r.threads ?? []) push(recordsOfThread, j, r);
    for (const a of r.about ?? []) push(recordsAbout, a, r);
  }
  Object.assign(core, { hasRecords: true, records, recordList: list, recordsOf, recordsOfUnit, eventsOf, recordsOfThread, recordsAbout });
  return core;
}

export async function index({ records = false } = {}) {
  if (!idxPromise) {
    idxPromise = (async () => {
      const [manifest, units, ticks, scenes, targets, threads, slips, versions] = await Promise.all([
        load('manifest').catch(() => null), load('units'), load('ticks'), load('scenes'), load('targets'), load('threads'), load('slips').catch(() => []), load('versions').catch(() => null),
      ]);
      idx = buildCore({ manifest, units, ticks, scenes, targets, threads, slips, versions });
      let recordsPromise = null;
      idx.withRecords = () => {
        if (!recordsPromise) {
          recordsPromise = loadRecords().then((list) => addRecords(idx, list));
          recordsPromise.catch(() => { recordsPromise = null; });
        }
        return recordsPromise;
      };
      return idx;
    })();
  }
  const core = await idxPromise;
  if (records && !core.hasRecords) await core.withRecords();
  return core;
}
