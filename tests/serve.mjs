#!/usr/bin/env node
/**
 * serve.mjs — serve out/ the way Vercel does, for local testing.
 *
 * Applies vercel.json's headers (including the Content-Security-Policy),
 * redirects and rewrites, serves filesystem paths first, and answers
 * anything unknown with 404.html and status 404, so a test sees the same
 * page a visitor would. Zero dependencies.
 *
 *   node tests/serve.mjs [port]          (default 4173, serves ./out)
 *   import { startServer } from './serve.mjs'   (used by tests/mobile.mjs)
 */
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = join(ROOT, 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

// vercel.json route sources use path-to-regexp syntax (":slug", ":path*").
const toRegExp = (src) => new RegExp('^' + src.replace(/:(\w+)\*/g, '(.*)').replace(/:(\w+)/g, '([^/]+)') + '$');

function fileFor(pathname) {
  let p;
  try { p = normalize(join(OUT, decodeURIComponent(pathname))); } catch { return null; }
  if (!p.startsWith(resolve(OUT))) return null;
  if (!existsSync(p)) return null;
  const st = statSync(p);
  if (st.isFile()) return p;
  if (st.isDirectory() && existsSync(join(p, 'index.html'))) return join(p, 'index.html');
  return null;
}

export function startServer(port = 4173) {
  if (!existsSync(join(OUT, 'index.html'))) {
    throw new Error('out/ is empty: run `npm run preflight` (or node .github/scripts/stage-output.mjs) first');
  }
  const cfg = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const headerRules = (cfg.headers || []).map(h => ({ re: toRegExp(h.source), headers: h.headers }));
  const redirects = (cfg.redirects || []).map(r => ({ re: toRegExp(r.source), dest: r.destination, permanent: r.permanent }));
  const rewrites = (cfg.rewrites || []).map(r => ({ re: toRegExp(r.source), dest: r.destination }));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    for (const r of redirects) {
      if (r.re.test(pathname)) { res.writeHead(r.permanent ? 308 : 307, { Location: r.dest }); return res.end(); }
    }
    let file = fileFor(pathname);
    if (!file) for (const r of rewrites) if (r.re.test(pathname)) { file = fileFor(r.dest); break; }
    const headers = {};
    for (const h of headerRules) if (h.re.test(pathname)) for (const kv of h.headers) headers[kv.key] = kv.value;
    headers['Cache-Control'] = 'no-store'; // never let a test see a stale file
    if (!file) {
      const nf = fileFor('/404.html');
      res.writeHead(404, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(nf ? readFileSync(nf) : 'Not found');
    }
    headers['Content-Type'] = headers['Content-Type'] || MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, headers);
    res.end(readFileSync(file));
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, () => ok(server));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.argv[2] || 4173);
  startServer(port).then(() => console.log(`serving out/ on http://localhost:${port}`));
}
