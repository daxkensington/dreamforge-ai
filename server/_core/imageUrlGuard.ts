/**
 * SSRF guard for user-supplied image URLs.
 *
 * tools.upscale / tools.backgroundEdit / video.imageToVideo fetch an
 * arbitrary user-provided URL server-side, and styleTransfer forwards one to
 * providers that fetch it themselves. Without a check, that URL can be
 * http://169.254.169.254/latest/meta-data (cloud credential theft), an
 * internal load-balancer health endpoint, or a 30GB file that OOMs the
 * lambda. `z.string().url()` validates shape only — it permits all of that.
 *
 * Two entry points:
 *   - assertSafeImageUrl(url)  — cheap host/scheme validation; use BEFORE
 *     spending credits or handing the URL to anything that fetches it.
 *   - fetchGuardedImage(url)   — assert + fetch + image content-type check +
 *     response-size caps; use at the actual server-side fetch sites.
 *
 * Honest limitation: arbitrary PUBLIC hosts must stay allowed (these tools
 * legitimately take external user images), so a public hostname whose DNS
 * A record points at 169.254.169.254 (DNS rebinding / attacker-controlled
 * domain) is not caught by host-string checks alone.
 * TODO(security): if arbitrary public hosts stay allowed, close the
 * DNS-rebinding hole with a resolve-time check — resolve the hostname,
 * reject private/loopback/link-local results, and pin that IP for the fetch
 * (e.g. a custom undici dispatcher or lookup wrapper), or route fetches
 * through an egress proxy that enforces the same IP rules.
 */

import { TRPCError } from "@trpc/server";

// Reject up-front when the server advertises a body over this size…
const MAX_DECLARED_BYTES = 20 * 1024 * 1024; // 20MB (Content-Length)
// …and never buffer more than this regardless of what was declared
// (chunked responses have no Content-Length to pre-check).
const MAX_BUFFERED_BYTES = 25 * 1024 * 1024; // 25MB

function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

// ─── IP literal checks ──────────────────────────────────────────────────────
// WHATWG URL parsing already normalizes exotic IPv4 forms (0177.0.0.1,
// 0x7f000001, 2130706433 all become dotted quads) and compresses IPv6, so
// by the time we see a hostname it is in canonical form.

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false; // not an IPv4 literal — hostname check handles it
  }
  const [a, b] = parts;
  if (a === 0 && b === 0 && parts[2] === 0 && parts[3] === 0) return true; // 0.0.0.0
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 172 && b! >= 16 && b! <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata (169.254.169.254)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  // Expand "::" and any embedded IPv4 tail ("::ffff:127.0.0.1") into 8
  // 16-bit groups. Returns null when the input isn't valid IPv6.
  let s = ip.toLowerCase();
  let v4Tail: string | null = null;
  const dotIdx = s.lastIndexOf(".");
  if (dotIdx !== -1) {
    const colonIdx = s.lastIndexOf(":");
    if (colonIdx === -1) return false;
    v4Tail = s.slice(colonIdx + 1);
    s = s.slice(0, colonIdx) + ":0:0";
  }
  const halves = s.split("::");
  if (halves.length > 2) return false;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 2) {
    const zeros = 8 - head.length - tail.length;
    if (zeros < 1) return false;
    for (let i = 0; i < zeros; i++) head.push("0");
  }
  const groups = head.concat(tail);
  if (groups.length !== 8) return false;
  const nums = groups.map((g) => parseInt(g, 16));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return false;

  const first = nums[0]!;
  if (first === 0 && nums.slice(1, 7).every((n) => n === 0) && nums[7] === 1) return true; // ::1
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (v4Tail && nums.slice(0, 6).every((n) => n === 0) && nums[6] === 0xffff) {
    // IPv4-mapped (::ffff:x.x.x.x) — judge the embedded address.
    return isPrivateIPv4(v4Tail);
  }
  // IPv4-mapped in compressed form: 80 zero bits, then ffff at group 5, then
  // the embedded IPv4 in the last two groups (::ffff:7f00:1 == 127.0.0.1).
  // WHATWG URL keeps dotted tails verbatim (handled above) but hex tails
  // arrive in this form.
  if (nums.slice(0, 5).every((n) => n === 0) && nums[5] === 0xffff) {
    const mapped = v4Tail
      ? v4Tail
      : `${nums[6]! >> 8}.${nums[6]! & 0xff}.${nums[7]! >> 8}.${nums[7]! & 0xff}`;
    return isPrivateIPv4(mapped);
  }
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, ""); // ignore trailing root dot
  if (host === "localhost" || host === "localhost.localdomain") return true;
  if (host.startsWith("[") && host.endsWith("]")) {
    return isPrivateIPv6(host.slice(1, -1));
  }
  if (isPrivateIPv4(host)) return true;
  // A host with no dot cannot be a public external host — it's a LAN name,
  // a container short name, or a DNS-search suffix name ("metadata",
  // "internal-service", "postgres"). Block rather than guess.
  if (!host.includes(".")) return true;
  return false;
}

/**
 * Validate a user-supplied image URL before anything fetches it.
 * Throws TRPCError(BAD_REQUEST) on non-https schemes, private/loopback/
 * link-local/metadata hosts (literal IP in any normalized form, localhost,
 * dotless short names). Returns the normalized URL on success.
 */
export function assertSafeImageUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw badRequest("Invalid image URL.");
  }
  if (parsed.protocol !== "https:") {
    // Plain http lets a network attacker tamper with the fetched bytes and
    // mixes insecure traffic into a paid generation pipeline.
    throw badRequest("Image URL must use https.");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw badRequest("Image URL host is not allowed.");
  }
  return parsed.toString();
}

/** Read at most maxBytes from a response body; throw if the stream exceeds it. */
async function readCapped(resp: Response, maxBytes: number): Promise<Buffer> {
  if (!resp.body) {
    // Defensive: undici always exposes a body for these responses.
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > maxBytes) throw badRequest("Image exceeds the maximum allowed size.");
    return buf;
  }
  const reader = resp.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw badRequest("Image exceeds the maximum allowed size.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    // Release the socket whether we finished or threw mid-stream.
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

/**
 * assertSafeImageUrl + fetch + hardening for the actual server-side fetch
 * sites. Enforces:
 *   - response status 2xx
 *   - an image/* content-type (a URL returning text/html is either wrong or
 *     an SSRF canary poking an internal HTTP service — refuse either way)
 *   - declared Content-Length <= 20MB, and never buffers > 25MB of actual
 *     bytes (protects the lambda from memory exhaustion on huge bodies)
 *
 * `opts.signal` lets callers keep their own timeout/abort around the fetch;
 * the signal is attached to the request, so an abort also stops the body
 * read mid-stream.
 */
export async function fetchGuardedImage(
  rawUrl: string,
  opts?: { signal?: AbortSignal },
): Promise<{ buffer: Buffer; contentType: string }> {
  const url = assertSafeImageUrl(rawUrl);
  const resp = await fetch(url, { redirect: "follow", signal: opts?.signal });
  if (!resp.ok) {
    throw badRequest(`Could not fetch image (HTTP ${resp.status}).`);
  }
  const contentType = (resp.headers.get("content-type") || "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw badRequest("Image URL did not return an image.");
  }
  const declared = Number(resp.headers.get("content-length") || "0");
  if (declared > MAX_DECLARED_BYTES) {
    throw badRequest("Image exceeds the maximum allowed size.");
  }
  const buffer = await readCapped(resp, MAX_BUFFERED_BYTES);
  return { buffer, contentType };
}
