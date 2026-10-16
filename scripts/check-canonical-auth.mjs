import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const CANONICAL_AUTH_PATHS = Object.freeze([
  'middleware.ts', 'client/src/lib/auth.ts', 'app/auth/signin/page.tsx', 'shared/returnTo.ts',
]);
const repo = 'https://api.github.com/repos/daxkensington/dreamforge-ai';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function gitBlobId(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/** Public immutable source metadata only. No token, cookies, or app requests. */
export async function checkCanonicalAuth({ fetcher = fetch, readSource = path => fs.readFile(new URL('../' + path, import.meta.url)) } = {}) {
  const read = async path => {
    const response = await fetcher(repo + path, {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DreamForge-canonical-auth-smoke', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Canonical auth public source metadata unavailable');
    try { return await response.json(); } catch { throw new Error('Canonical auth public source metadata malformed'); }
  };
  const ref = await read('/git/ref/heads/main');
  if (ref.ref !== 'refs/heads/main' || ref.object?.type !== 'commit' || !sha(ref.object.sha)) throw new Error('Canonical auth main revision malformed');
  const revision = ref.object.sha;
  const commit = await read('/git/commits/' + revision);
  if (commit.sha !== revision || !sha(commit.tree?.sha)) throw new Error('Canonical auth immutable commit malformed');
  const tree = await read('/git/trees/' + commit.tree.sha + '?recursive=1');
  if (tree.sha !== commit.tree.sha || tree.truncated !== false || !Array.isArray(tree.tree)) throw new Error('Canonical auth immutable source tree incomplete');
  const pins = [];
  for (const path of CANONICAL_AUTH_PATHS) {
    const matches = tree.tree.filter(row => row.path === path);
    if (matches.length !== 1 || matches[0].type !== 'blob' || !['100644', '100755'].includes(matches[0].mode) || !sha(matches[0].sha)) throw new Error('Canonical auth required source file missing');
    const bytes = await readSource(path);
    // Windows checkouts may use CRLF; Git stores the tracked text with LF.
    const raw = gitBlobId(bytes), normalized = gitBlobId(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')));
    if (matches[0].sha !== raw && matches[0].sha !== normalized) throw new Error('Canonical auth source differs from the staged candidate');
    pins.push({ path, gitBlob: matches[0].sha });
  }
  const finalRef = await read('/git/ref/heads/main');
  if (finalRef.ref !== 'refs/heads/main' || finalRef.object?.type !== 'commit' || finalRef.object?.sha !== revision) throw new Error('Canonical auth main changed during preflight');
  return { canonicalOrigin: 'https://dreamforgex.ai', canonicalMainRevision: revision, canonicalMainAuthSourceMatchesCandidate: true, pins };
}
