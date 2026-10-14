/**
 * 만우절 단위 — docs/decisions.md 결정 #11, 목록은 annotations/april-fools.json.
 * 숫자 집계(등장 수 · 말한 줄 · 등급 판정 · 연결 선 · 흔한 대상의 분모)에서 빼고, 원문 · 기록은 그대로 둔다 — 화면은 '만우절' 표시로 남긴다.
 * 범위 밖(annotations/scope.json, 결정 #5 — stories.in_scope)과 따로다: 범위 밖은 기록 검사 · 자동 기록에서도 빠지지만 만우절은 숫자만 빠진다.
 * 부르는 곳: tools/views/persons.mjs · links.mjs · importance.mjs · signals.mjs · tools/site/export/(공용 단위 · 감상 순서 · 세계).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APRIL_FOOLS_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../annotations/april-fools.json');
/** 화면 · 보고서에 쓰는 표시 */
export const APRIL_FOOLS_LABEL = '만우절';

let cache = null;

/** 만우절 단위 목록(읽기 단위 키 — `event_fullfoolday` …) */
export function aprilFoolUnits() {
  cache ??= new Set(JSON.parse(fs.readFileSync(APRIL_FOOLS_PATH, 'utf8')).units.map((u) => u.unit));
  return cache;
}

/** 읽기 단위 키가 만우절 단위인가 */
export const isAprilFools = (unitKey) => Boolean(unitKey) && aprilFoolUnits().has(unitKey);

/** 씬(스토리 ID)이 만우절 단위의 것인가 — 이벤트 씬 ID는 `<단위 키>_01` · `<단위 키>_end` */
export function isAprilFoolsScene(storyId) {
  if (!storyId) return false;
  for (const u of aprilFoolUnits()) if (storyId === u || storyId.startsWith(`${u}_`)) return true;
  return false;
}
