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
 * Downloads resolve and pin a validated public IP for each HTTPS hop. Node's
 * HTTPS client retains the original hostname for TLS verification and Host,
 * but its socket lookup cannot resolve a different address after validation.
 */

import { TRPCError } from "@trpc/server";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { request } from "node:https";
import type { IncomingMessage } from "node:http";

// Reject up-front when the server advertises a body over this size…
const MAX_DECLARED_BYTES = 20 * 1024 * 1024; // 20MB (Content-Length)
// …and never buffer more than this regardless of what was declared
// (chunked responses have no Content-Length to pre-check).
const MAX_BUFFERED_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 4;
const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/tiff",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);

function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

// ─── IP literal checks ──────────────────────────────────────────────────────
// WHATWG URL parsing already normalizes exotic IPv4 forms (0177.0.0.1,
// 0x7f000001, 2130706433 all become dotted quads) and compresses IPv6, so
// by the time we see a hostname it is in canonical form.

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(p => Number(p));
  if (
    parts.length !== 4 ||
    parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)
  ) {
    return false; // not an IPv4 literal — hostname check handles it
  }
  const [a, b] = parts;
  if (a === 0) return true; // current network / unspecified
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 172 && b! >= 16 && b! <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + cloud metadata (169.254.169.254)
  if (a === 100 && b! >= 64 && b! <= 127) return true; // shared / CGNAT
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
  if (a === 192 && b === 88 && parts[2] === 99) return true; // deprecated relay
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  if (a! >= 224) return true; // multicast / reserved / broadcast
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
  const nums = groups.map(g => parseInt(g, 16));
  if (nums.some(n => Number.isNaN(n) || n < 0 || n > 0xffff)) return false;

  const first = nums[0]!;
  if (first === 0 && nums.slice(1, 7).every(n => n === 0) && nums[7] === 1)
    return true; // ::1
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (v4Tail && nums.slice(0, 6).every(n => n === 0) && nums[6] === 0xffff) {
    // IPv4-mapped (::ffff:x.x.x.x) — judge the embedded address.
    return isPrivateIPv4(v4Tail);
  }
  // IPv4-mapped in compressed form: 80 zero bits, then ffff at group 5, then
  // the embedded IPv4 in the last two groups (::ffff:7f00:1 == 127.0.0.1).
  // WHATWG URL keeps dotted tails verbatim (handled above) but hex tails
  // arrive in this form.
  if (nums.slice(0, 5).every(n => n === 0) && nums[5] === 0xffff) {
    const mapped = v4Tail
      ? v4Tail
      : `${nums[6]! >> 8}.${nums[6]! & 0xff}.${nums[7]! >> 8}.${nums[7]! & 0xff}`;
    return isPrivateIPv4(mapped);
  }
  // Accept only global unicast; exclude tunnelling and documentation ranges.
  if ((first & 0xe000) !== 0x2000) return true;
  if (first === 0x2002) return true; // 6to4 embeds an IPv4 destination
  if (first === 0x2001 && (nums[1] === 0 || nums[1] === 0xdb8)) return true;
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
  if (parsed.username || parsed.password)
    throw badRequest("Image URL credentials are not allowed.");
  if (isBlockedHost(parsed.hostname)) {
    throw badRequest("Image URL host is not allowed.");
  }
  return parsed.toString();
}

/** Read the wire response incrementally; declared length is never trusted. */
async function readCapped(
  resp: IncomingMessage,
  maxBytes: number
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for await (const value of resp) {
      const chunk = Buffer.from(value);
      total += chunk.length;
      if (total > maxBytes) {
        throw badRequest("Image exceeds the maximum allowed size.");
      }
      chunks.push(chunk);
    }
  } finally {
    resp.destroy();
  }
  return Buffer.concat(chunks);
}

async function publicAddress(
  url: URL,
  signal: AbortSignal
): Promise<{ address: string; family: number }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  signal.throwIfAborted();
  let addresses: { address: string; family: number }[];
  if (isIP(host)) {
    addresses = [{ address: host, family: isIP(host) }];
  } else {
    let abort: () => void = () => {};
    try {
      addresses = await Promise.race([
        lookup(host, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => {
          abort = () => reject(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
        }),
      ]);
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw badRequest("Could not resolve image URL host.");
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }
  if (
    !addresses.length ||
    addresses.some(
      ({ address, family }) =>
        (family !== 4 && family !== 6) ||
        isIP(address) !== family ||
        (family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address))
    )
  ) {
    throw badRequest("Image URL host is not allowed.");
  }
  signal.throwIfAborted();
  return addresses[0]!;
}

function pinnedRequest(
  url: URL,
  address: { address: string; family: number },
  signal: AbortSignal
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
      if (options.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    };
    const req = request(
      url,
      {
        method: "GET",
        agent: false,
        signal,
        lookup: pinnedLookup,
        headers: {
          Accept: "image/*, video/mp4, video/webm",
          "Accept-Encoding": "identity",
        },
      },
      resolve
    );
    req.on("error", reject);
    req.end();
  });
}

/** Secure bounded download for image tools and provider video results. */
export async function fetchGuardedMedia(
  rawUrl: string,
  opts: { signal?: AbortSignal; kind: "image" | "video"; maxBytes?: number }
): Promise<{ buffer: Buffer; contentType: string }> {
  const defaultCap =
    opts.kind === "video" ? MAX_VIDEO_BYTES : MAX_BUFFERED_BYTES;
  if (
    opts.maxBytes !== undefined &&
    (!Number.isSafeInteger(opts.maxBytes) || opts.maxBytes <= 0)
  ) {
    throw badRequest("Invalid media size limit.");
  }
  const cap = Math.min(opts.maxBytes ?? defaultCap, defaultCap);
  const declaredCap = Math.min(
    opts.kind === "video" ? MAX_VIDEO_BYTES : MAX_DECLARED_BYTES,
    cap
  );
  const signal = AbortSignal.any([
    AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    ...(opts.signal ? [opts.signal] : []),
  ]);
  let url = new URL(assertSafeImageUrl(rawUrl));
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const address = await publicAddress(url, signal);
    const response = await pinnedRequest(url, address, signal);
    const status = response.statusCode ?? 0;
    if ([301, 302, 303, 307, 308].includes(status)) {
      response.destroy();
      if (hop === MAX_REDIRECTS) throw badRequest("Too many media redirects.");
      if (!response.headers.location)
        throw badRequest("Invalid media redirect.");
      url = new URL(
        assertSafeImageUrl(new URL(response.headers.location, url).toString())
      );
      continue;
    }
    try {
      if (status < 200 || status >= 300)
        throw badRequest(`Could not fetch image (HTTP ${status}).`);
      const contentType = String(response.headers["content-type"] ?? "")
        .split(";")[0]!
        .trim()
        .toLowerCase();
      if (
        !(opts.kind === "video" ? VIDEO_TYPES : IMAGE_TYPES).has(contentType)
      ) {
        throw badRequest(
          `URL did not return an ${opts.kind === "video" ? "allowed video" : "image"}.`
        );
      }
      const declared = Number(response.headers["content-length"] ?? "0");
      if (!Number.isFinite(declared) || declared < 0 || declared > declaredCap)
        throw badRequest("Image exceeds the maximum allowed size.");
      const buffer = await readCapped(response, cap);
      return { buffer, contentType };
    } finally {
      response.destroy();
    }
  }
  throw badRequest("Too many media redirects.");
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
  opts?: { signal?: AbortSignal }
): Promise<{ buffer: Buffer; contentType: string }> {
  return fetchGuardedMedia(rawUrl, { kind: "image", signal: opts?.signal });
}
