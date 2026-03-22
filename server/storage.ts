import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";

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
  contentType: string = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const finalKey = key.startsWith("/") ? key.slice(1) : key;

  await getS3().send(
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: finalKey,
      Body: typeof data === "string" ? Buffer.from(data, "base64") : data,
      ContentType: contentType,
    })
  );

  const url = ENV.r2PublicUrl
    ? `${ENV.r2PublicUrl}/${finalKey}`
    : await getSignedUrl(getS3(), new GetObjectCommand({ Bucket: BUCKET(), Key: finalKey }), { expiresIn: 3600 * 24 * 7 });

  return { key: finalKey, url };
}

/**
 * Get a download URL for a stored file
 * @param key - Storage key
 * @returns Public or signed URL
 */
export async function storageGet(key: string): Promise<string> {
  const finalKey = key.startsWith("/") ? key.slice(1) : key;

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
  const finalKey = key.startsWith("/") ? key.slice(1) : key;

  await getS3().send(
    new DeleteObjectCommand({
      Bucket: BUCKET(),
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
  expiresIn: number = 3600
): Promise<string> {
  return getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: BUCKET(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}
