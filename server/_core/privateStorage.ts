import { createHash } from "node:crypto";
import { ENV } from "./env";

const unavailable = () => new Error("Private media is temporarily unavailable. Please try again later.");
export interface PrivateStorageConfig { bucket: string; accountId: string; accessKeyId: string; secretAccessKey: string }
/** Configuration only: deletion may remove private bytes even during a domain
 * audit outage. Reads, writes and signatures must also pass the live audit. */
export function privateStorageConfig(): PrivateStorageConfig {
  const bucket = ENV.r2PrivateBucketName, accountId = ENV.r2AccountId;
  if (!/^[a-f0-9]{32}$/i.test(accountId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || bucket === ENV.r2BucketName ||
    ![ENV.r2PrivateAccessKeyId, ENV.r2PrivateSecretAccessKey, ENV.r2PrivateReadToken].every(value => value.length > 0 && value.length <= 4096 && value.trim() === value) ||
    ENV.r2PrivateAccessKeyId === ENV.r2AccessKeyId || ENV.r2PrivateSecretAccessKey === ENV.r2SecretAccessKey) throw unavailable();
  return { bucket, accountId, accessKeyId: ENV.r2PrivateAccessKeyId, secretAccessKey: ENV.r2PrivateSecretAccessKey };
}
export function privateStorageConfigured(): boolean { try { privateStorageConfig(); return true; } catch { return false; } }

type Audit = { fingerprint: string; expires: number; allowed: boolean; pending?: Promise<void> };
let audit: Audit | undefined;
async function readSettings(path: string, token: string): Promise<any> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
    method: "GET", headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store",
  });
  if (!response.ok) { await response.body?.cancel(); throw unavailable(); }
  const reader = response.body?.getReader(); if (!reader) throw unavailable();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
      if (bytes > 64 * 1024) { await reader.cancel(); throw unavailable(); } chunks.push(part.value); }
  } finally { reader.releaseLock(); }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (value?.success !== true || !value.result || (value.result_info?.total_pages ?? 1) > 1) throw unavailable();
  return value.result;
}
/** Only Cloudflare's fixed management origin is contacted. S3 credentials
 * cannot establish whether managed/custom public aliases expose a bucket. */
export async function assertPrivateStorage(): Promise<PrivateStorageConfig> {
  const config = privateStorageConfig(), token = ENV.r2PrivateReadToken;
  const fingerprint = createHash("sha256").update(JSON.stringify([config, token])).digest("hex");
  if (audit?.fingerprint === fingerprint) {
    if (audit.pending) { await audit.pending; return config; }
    if (audit.expires > Date.now()) { if (!audit.allowed) throw unavailable(); return config; }
  }
  const current: Audit = { fingerprint, expires: 0, allowed: false }; audit = current;
  current.pending = (async () => {
    try {
      const base = `accounts/${config.accountId}/r2/buckets/${config.bucket}/domains`;
      const [managed, custom] = await Promise.all([readSettings(`${base}/managed`, token), readSettings(`${base}/custom`, token)]);
      if (managed.enabled !== false || !Array.isArray(custom.domains) || custom.domains.some((domain: any) => domain?.enabled !== false)) throw unavailable();
      current.allowed = true; current.expires = Date.now() + 30_000;
    } catch {
      current.allowed = false; current.expires = Date.now() + 5000; throw unavailable();
    } finally { current.pending = undefined; }
  })();
  await current.pending; return config;
}
export async function privateStorageAvailable(): Promise<boolean> { try { await assertPrivateStorage(); return true; } catch { return false; } }
