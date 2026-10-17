import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { storageOwner } from "./_core/storageContext";
import { confirmMediaUpload, getMediaAsset, normalizeStorageKey, registerMediaAsset } from "./_core/mediaLifecycle";
import { assertPrivateStorage, privateStorageConfig, type PrivateStorageConfig } from "./_core/privateStorage";

// Lazy S3 client for R2
let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${ENV.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ENV.r2AccessKeyId,
        secretAccessKey: ENV.r2SecretAccessKey,
      },
    });
  }
  return _s3;
}

const BUCKET = () => ENV.r2BucketName;
let privateClient: { fingerprint: string; client: S3Client } | undefined;
function getPrivateS3(config: PrivateStorageConfig): S3Client {
  const fingerprint = createHash("sha256").update(JSON.stringify(config)).digest("hex");
  if (privateClient?.fingerprint !== fingerprint) privateClient = { fingerprint, client: new S3Client({ region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }) };
  return privateClient.client;
}
async function objectLocation(key: string, deleting = false) {
  const asset = await getMediaAsset(key);
  if (asset?.isPrivate) {
    // Deletion removes exposure even if public-access auditing is unavailable.
    const config = deleting ? privateStorageConfig() : await assertPrivateStorage();
    return { client: getPrivateS3(config), bucket: config.bucket, asset };
  }
  return { client: getS3(), bucket: BUCKET(), asset };
}
const assertReadable = (asset: Awaited<ReturnType<typeof getMediaAsset>>) => {
  if (asset?.revokedAt || asset?.ownerDeleted) throw new Error("This media is no longer available.");
};

/**
 * Upload a file to R2
 * @param key - Storage key (path), e.g., "generations/abc123.png"
 * @param data - File data as Buffer or Uint8Array
 * @param contentType - MIME type
 * @returns Object with key and public URL
 */
export async function storagePut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string = "application/octet-stream",
  options: { isPrivate?: boolean } = {}
): Promise<{ key: string; url: string }> {
  const finalKey = normalizeStorageKey(key);
  if (options.isPrivate && !storageOwner()) throw new Error("Private media requires an owner.");
  const config = options.isPrivate ? await assertPrivateStorage() : undefined;
  const client = config ? getPrivateS3(config) : getS3(), bucket = config?.bucket ?? BUCKET();
  await registerMediaAsset(finalKey, storageOwner(), options.isPrivate === true);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: finalKey,
        Body: typeof data === "string" ? Buffer.from(data, "base64") : data,
        ContentType: contentType,
      })
    );
  } catch (error: any) {
    console.error(`[Storage] R2 upload failed for key "${finalKey}":`, error.message || error);
    throw new Error(`Failed to upload file to storage: ${error.message || "Unknown R2 error"}`);
  }

  await confirmMediaUpload(finalKey);
  const url = options.isPrivate ? `/api/media/${finalKey}` : ENV.r2PublicUrl
    ? `${ENV.r2PublicUrl}/${finalKey}`
    : await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: finalKey }), { expiresIn: 3600 * 24 * 7 });

  return { key: finalKey, url };
}

/** Internal bounded read. Callers must authorize the registered key first. */
export async function storageGetObjectBounded(key: string, maxBytes: number): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 256 * 1024 * 1024) throw new Error("Invalid object size limit.");
  let body: any;
  try {
    const finalKey = normalizeStorageKey(key), location = await objectLocation(finalKey); assertReadable(location.asset);
    const response = await location.client.send(new GetObjectCommand({ Bucket: location.bucket, Key: finalKey }));
    body = response.Body;
    if (!body) throw new Error("Empty storage response.");
    if ((response.ContentLength ?? 0) > maxBytes) throw new Error("Object exceeds size limit.");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      total += chunk.byteLength;
      if (total > maxBytes) throw new Error("Object exceeds size limit.");
      chunks.push(Buffer.from(chunk));
    }
    return { bytes: Buffer.concat(chunks), contentType: response.ContentType ?? "application/octet-stream" };
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NoSuchKey") return null;
    throw error;
  } finally { body?.destroy?.(); }
}

/** Fresh private provider/download URL; never fall back to a public alias. */
export async function storageGetSigned(key: string, expiresIn = 3600): Promise<string> {
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 3600) throw new Error("Invalid download expiry.");
  const finalKey = normalizeStorageKey(key);
  const location = await objectLocation(finalKey); assertReadable(location.asset);
  return getSignedUrl(location.client, new GetObjectCommand({ Bucket: location.bucket, Key: finalKey }), { expiresIn });
}

/**
 * Fetch an object's bytes + content type for proxy serving (the /img route).
 * Returns null if the key doesn't exist. Buffers fully — fine for images/short
 * clips; the /img route checks revocation and disables shared caching.
 */
export async function storageGetObject(
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const finalKey = normalizeStorageKey(key);
  try {
    const location = await objectLocation(finalKey); assertReadable(location.asset);
    const res = await location.client.send(new GetObjectCommand({ Bucket: location.bucket, Key: finalKey }));
    const bytes = await res.Body!.transformToByteArray();
    return { bytes, contentType: res.ContentType ?? "application/octet-stream" };
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey") return null;
    console.error(`[Storage] R2 get failed for "${finalKey}":`, err?.message ?? err);
    return null;
  }
}

/**
 * Get a download URL for a stored file
 * @param key - Storage key
 * @returns Public or signed URL
 */
export async function storageGet(key: string): Promise<string> {
  const finalKey = normalizeStorageKey(key), asset = await getMediaAsset(finalKey); assertReadable(asset);
  if (asset?.isPrivate) throw new Error("Private media cannot use public download aliases.");

  if (ENV.r2PublicUrl) {
    return `${ENV.r2PublicUrl}/${finalKey}`;
  }

  return getSignedUrl(
    getS3(),
    new GetObjectCommand({ Bucket: BUCKET(), Key: finalKey }),
    { expiresIn: 3600 * 24 } // 24 hour signed URL
  );
}

/**
 * Delete a file from storage
 * @param key - Storage key
 */
export async function storageDelete(key: string): Promise<void> {
  const finalKey = normalizeStorageKey(key), location = await objectLocation(finalKey, true);

  await location.client.send(
    new DeleteObjectCommand({
      Bucket: location.bucket,
      Key: finalKey,
    })
  );
}

/**
 * Generate a unique storage key for a file
 * @param prefix - Path prefix, e.g., "generations", "audio", "marketplace"
 * @param extension - File extension, e.g., "png", "mp4", "mp3"
 * @returns Unique key like "generations/abc123def456.png"
 */
export function generateStorageKey(prefix: string, extension: string): string {
  return `${prefix}/${nanoid(16)}.${extension}`;
}

/**
 * Get a presigned upload URL (for direct client uploads)
 * @param key - Storage key
 * @param contentType - MIME type
 * @param expiresIn - URL expiry in seconds (default 1 hour)
 * @returns Presigned URL for PUT
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600,
  maxSizeBytes: number = 50 * 1024 * 1024 // 50MB default
): Promise<string> {
  const finalKey = normalizeStorageKey(key), asset = await getMediaAsset(finalKey);
  if (asset?.isPrivate) throw new Error("Private media cannot use public upload aliases.");
  assertReadable(asset);
  return getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: finalKey,
      ContentType: contentType,
      ContentLength: maxSizeBytes,
    }),
    {
      expiresIn,
      signableHeaders: new Set(["content-length"]),
    }
  );
}
