/**
 * 로컬 확인용 정적 서버(W1) — 표준 http만. 빌드 단계가 없으니 site/를 그대로 낸다.
 *
 *   node tools/site/serve.mjs                   # http://localhost:8765/ (root = site/)
 *   node tools/site/serve.mjs --port 9000 --root site
 *
 * MIME · no-cache · 404. 디렉터리는 index.html. 루트 밖 경로(..)는 막는다. Ctrl+C로 끝낸다.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/** 요청 하나를 처리한다 — 테스트에서 서버 없이 부를 수 있게 따로 둔다 */
export function handle(root, req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403, { 'Content-Type': MIME['.txt'] });
    res.end('403 루트 밖 경로\n');
    return;
  }
  let stat = null;
  try {
    stat = fs.statSync(file);
  } catch {
    res.writeHead(404, { 'Content-Type': MIME['.txt'] });
    res.end(`404 없음: ${rel}\n`);
    return;
  }
  if (stat.isDirectory()) {
    res.writeHead(302, { Location: `${url.pathname}/` });
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

/** 서버를 띄운다. 돌려주는 서버의 close()로 끝낸다 */
export function serve({ port = 8765, root = path.join(ROOT, 'site'), host = '127.0.0.1' } = {}) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => handle(base, req, res));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '8765' }, root: { type: 'string', default: 'site' }, host: { type: 'string', default: '127.0.0.1' } } });
  const root = path.resolve(ROOT, values.root);
  serve({ port: Number(values.port), root, host: values.host })
    .then((s) => {
      const { port } = s.address();
      console.log(`정적 서버: http://${values.host === '0.0.0.0' ? 'localhost' : values.host}:${port}/  (root ${path.relative(ROOT, root) || root}/, Ctrl+C로 끝낸다)`);
    })
    .catch((err) => {
      console.error(`서버를 못 띄웠다: ${err.message}`);
      process.exit(1);
    });
}
