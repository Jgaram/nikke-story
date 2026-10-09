/**
 * d3 — 브라우저 쪽 유일한 외부 의존성. 버전은 여기 한 곳에만 고정한다(W0 결정 #3).
 * 탭은 CDN 주소를 직접 쓰지 않고 `ctx.d3`(app.js가 이 모듈을 한 번 불러 넘긴다)나 `import * as d3 from '../lib/d3.js'`로 쓴다.
 */
export * from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
