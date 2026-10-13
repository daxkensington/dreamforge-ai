import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { OUTPUT, ownPath, singleRange, sha, validateAssets } from './contract.mjs';
const mime = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' }[path.extname(file)]);
export function loadResources(root) {
  const directory = ownPath(root, OUTPUT + '/site');
  const buildProof = JSON.parse(fs.readFileSync(ownPath(root, OUTPUT + '/BUILD-PROOF.json')));
  const manifest = validateAssets(JSON.parse(fs.readFileSync(ownPath(root, 'scripts/diagnostics/static-media/assets/manifest.json'))));
  const resources = new Map();
  for (const resource of manifest.files) {
    assert(/^\/(?:_next\/static\/(?:css|media)\/|showcase\/|video\/)/.test(resource.url));
    const buffer = fs.readFileSync(ownPath(directory, resource.url.slice(1)));
    assert.equal(sha(buffer), resource.sha256); assert.equal(buffer.length, resource.bytes);
    resources.set(resource.url, { buffer, mime: mime(resource.url) });
  }
  for (const file of ['client.js', 'present.html', 'absent.html']) {
    const buffer = fs.readFileSync(ownPath(directory, file));
    assert.equal(sha(buffer), buildProof.generated.find(row => row.file === 'site/' + file)?.sha256);
    resources.set('/' + file, { buffer, mime: mime(file) });
  }
  for (const row of buildProof.sourcePins) assert.equal(sha(fs.readFileSync(ownPath(root, row.file))), row.sha256);
  for (const row of buildProof.generated) assert.equal(sha(fs.readFileSync(ownPath(root, OUTPUT + '/' + row.file))), row.sha256);
  assert([...resources.values()].every(r => typeof r.mime === 'string'));
  return resources;
}
export function resourceResponse(method, rawPath, range, sourcePresent, resources) {
  const empty = status => ({ status, headers: { 'Content-Length': '0' }, body: Buffer.alloc(0) });
  if (!['GET', 'HEAD'].includes(method)) return empty(405);
  if (typeof rawPath !== 'string' || !rawPath.startsWith('/') || /[\\\0?#]/.test(rawPath) || rawPath.startsWith('//')) return empty(400);
  let pathname; try { pathname = decodeURIComponent(rawPath); } catch { return empty(400); }
  if (/[\\\0]/.test(pathname) || pathname.split('/').some(p => p === '.' || p === '..') || pathname.includes('//')) return empty(400);
  if (pathname.startsWith('/api')) return empty(404);
  // Root variants are selected by server configuration, never by client parameters.
  const key = pathname === '/' ? sourcePresent ? '/present.html' : '/absent.html' : pathname;
  if (['/present.html', '/absent.html'].includes(pathname)) return empty(404);
  const resource = resources.get(key); if (!resource) return empty(404);
  const response = key === '/video/hero-bg.mp4' ? singleRange(range, resource.buffer.length) : { status: 200, start: 0, end: resource.buffer.length - 1, length: resource.buffer.length };
  const headers = { 'Content-Type': resource.mime, 'Content-Length': String(response.length), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': pathname === '/' ? 'no-store' : 'public, max-age=3600' };
  if (key === '/video/hero-bg.mp4') {
    headers['Accept-Ranges'] = 'bytes';
    if (response.status === 206) headers['Content-Range'] = `bytes ${response.start}-${response.end}/${resource.buffer.length}`;
    if (response.status === 416) headers['Content-Range'] = `bytes */${resource.buffer.length}`;
  }
  return { status: response.status, headers, body: method === 'HEAD' || response.status === 416 ? Buffer.alloc(0) : resource.buffer.subarray(response.start, response.end + 1) };
}
export async function startServers(root) {
  const resources = loadResources(root);
  const servers = [];
  try {
    for (const sourcePresent of [true, false]) {
      const server = http.createServer((request, response) => {
        try { const result = resourceResponse(request.method, request.url, request.headers.range, sourcePresent, resources); response.writeHead(result.status, result.headers); response.end(result.body); }
        catch { response.writeHead(500, { 'Content-Length': '0' }); response.end(); }
      });
      servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    }
    const origins = servers.map(server => 'http://127.0.0.1:' + server.address().port);
    assert(origins[0] !== origins[1]);
    return { present: origins[0], absent: origins[1], close: async () => { for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } } };
  } catch (error) { for (const server of servers) { server.closeAllConnections(); if (server.listening) server.close(); } throw error; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--preview']);
  const servers = await startServers(process.cwd());
  console.log(JSON.stringify({ kind: 'STATIC_REDUCTION_CHROME_PREVIEW_ONLY', sourcePresent: servers.present, sourceAbsent: servers.absent, pid: process.pid, browserLaunched: false, full58Acceptance: false }));
  let closed = false;
  const close = async () => { if (closed) return; closed = true; await servers.close(); process.exit(0); };
  process.on('SIGINT', close); process.on('SIGTERM', close);
}
