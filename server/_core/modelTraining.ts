/** Owned, durable fal LoRA lifecycle. No fallback or retry after a submission may have executed. */
import { createHash, randomUUID } from "node:crypto";
import JSZip from "jszip";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { ENV } from "./env";
import {
  assertPrivateStorage,
  privateStorageConfigured,
} from "./privateStorage";
import {
  storageGetObjectBounded,
  storageGetSigned,
  storagePut,
} from "../storage";
import { withStorageOwner } from "./storageContext";
import { normalizeStorageKey, mediaRevocationQueries } from "./mediaLifecycle";
import { getDb } from "../db";
import { walletRows } from "./walletAccounting";
import { fetchGuardedImage } from "./imageUrlGuard";
import {
  getTrainingImageCredits,
  TRAINING_POLICY,
} from "../../shared/training";
import * as jobs from "../dbTraining";
import type { TrainingJob } from "../../drizzle/schema";
import {
  completeGenerationRequest,
  failGenerationRequestAndRefund,
  readGenerationRequest,
  type GenerationRequestOwner,
} from "./generationBilling";
import {
  pendingGenerationResponse,
  replayGenerationResponse,
} from "./generationRequest";

export const FAL_TRAINER = "fal-ai/flux-lora-fast-training";
const ACTIVE = ["queued", "training", "cancel_requested"];
class TrainingRejected extends Error {}
class InvalidModelResult extends Error {}
export class ConfirmedTrainingImageFailure extends Error {}
export class TrainingImageOutcomeUncertain extends Error {
  readonly reconciliationRequired = true;
  constructor(readonly providerRequestId?: string) {
    super(
      "The custom image outcome could not be confirmed. This request needs review and will not run again automatically."
    );
  }
}
export function isConfirmedTrainingImageFailure(error: unknown) {
  return error instanceof ConfirmedTrainingImageFailure;
}
export type TrainingImageReceipt = {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  acceptedAt: string;
};
function trainingImageQueueUrl(
  value: unknown,
  requestId: string,
  suffix: string
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestId))
    throw new Error("Invalid image receipt.");
  const u = new URL(String(value));
  if (
    u.origin !== "https://queue.fal.run" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !u.pathname.startsWith("/fal-ai/flux-lora/requests/") ||
    !u.pathname.endsWith(`/requests/${requestId}${suffix}`)
  )
    throw new Error("Invalid image receipt.");
  return u.toString();
}
export function trainingProviderAvailable() {
  return !!ENV.falApiKey && privateStorageConfigured();
}
export function validateTrainingQueueUrl(
  value: unknown,
  requestId: string,
  suffix: string
) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId))
    throw new Error("Invalid training receipt.");
  const u = new URL(value);
  // fal returns queue URLs; never send our Authorization header to a CDN/redirect.
  if (
    u.origin !== "https://queue.fal.run" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !u.pathname.endsWith(`/requests/${requestId}${suffix}`) ||
    !u.pathname.startsWith("/fal-ai/flux-lora-fast-training/")
  )
    throw new Error("Invalid training receipt.");
  return u.toString();
}
async function readBounded(response: Response, maxBytes: number) {
  if (Number(response.headers.get("content-length") || 0) > maxBytes) {
    await response.body?.cancel();
    throw new Error("Provider response is too large.");
  }
  if (!response.body) throw new Error("Empty provider response.");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Provider response is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks);
}
async function queueRequest(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
    headers: {
      Authorization: `Key ${ENV.falApiKey}`,
      "Content-Type": "application/json",
      "X-Fal-No-Retry": "1",
      "X-Fal-Request-Start-Timeout": "1800",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (
      method === "POST" &&
      [400, 401, 403, 404, 422, 429].includes(response.status)
    )
      throw new TrainingRejected(
        "Training was not accepted. Your credits were returned."
      );
    throw new Error(
      "The training service is temporarily unavailable. Refresh the job to check again."
    );
  }
  if (method === "PUT") {
    await response.body?.cancel();
    return { cancellation_requested: true };
  }
  return JSON.parse((await readBounded(response, 512 * 1024)).toString("utf8"));
}
function assertUniqueJsonKeys(source: string) {
  const stack: Array<{ object: boolean; keyNext: boolean; keys: Set<string> }> =
    [];
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      const start = i++;
      for (; i < source.length; i++) {
        if (source[i] === "\\") {
          i++;
          continue;
        }
        if (source[i] === '"') break;
      }
      const top = stack.at(-1);
      if (top?.object && top.keyNext) {
        const key = JSON.parse(source.slice(start, i + 1));
        if (top.keys.has(key))
          throw new InvalidModelResult("Duplicate model header field.");
        top.keys.add(key);
        top.keyNext = false;
      }
    } else if (char === "{" || char === "[")
      stack.push({
        object: char === "{",
        keyNext: char === "{",
        keys: new Set(),
      });
    else if (char === "}" || char === "]") stack.pop();
    else if (char === "," && stack.at(-1)?.object) stack.at(-1)!.keyNext = true;
  }
}
export function validateSafetensors(buffer: Buffer) {
  if (buffer.length < 10) throw new InvalidModelResult("Invalid model file.");
  const headerLength = Number(buffer.readBigUInt64LE(0));
  if (
    !Number.isSafeInteger(headerLength) ||
    headerLength < 2 ||
    headerLength > 8 * 1024 * 1024 ||
    headerLength + 8 >= buffer.length ||
    buffer[8] !== 0x7b
  )
    throw new InvalidModelResult("Invalid model file.");
  let header: any;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      buffer.subarray(8, 8 + headerLength)
    );
    header = JSON.parse(text);
    assertUniqueJsonKeys(text);
  } catch {
    throw new InvalidModelResult("Invalid model file.");
  }
  if (!header || typeof header !== "object" || Array.isArray(header))
    throw new InvalidModelResult("Invalid model file.");
  const bytesByType: Record<string, number> = {
    F64: 8,
    F32: 4,
    F16: 2,
    BF16: 2,
    I64: 8,
    I32: 4,
    I16: 2,
    I8: 1,
    U64: 8,
    U32: 4,
    U16: 2,
    U8: 1,
    BOOL: 1,
    F8_E4M3: 1,
    F8_E5M2: 1,
  };
  const ranges: Array<[number, number]> = [];
  let tensors = 0;
  for (const [key, value] of Object.entries(header)) {
    if (key === "__metadata__") {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !Object.values(value).every(item => typeof item === "string")
      )
        throw new InvalidModelResult("Invalid model metadata.");
      continue;
    }
    const v = value as any;
    if (
      !v ||
      ![
        "F64",
        "F32",
        "F16",
        "BF16",
        "I64",
        "I32",
        "I16",
        "I8",
        "U64",
        "U32",
        "U16",
        "U8",
        "BOOL",
        "F8_E4M3",
        "F8_E5M2",
      ].includes(v.dtype) ||
      !Array.isArray(v.shape) ||
      v.shape.length > 12 ||
      !v.shape.every((n: any) => Number.isSafeInteger(n) && n >= 0) ||
      !Array.isArray(v.data_offsets) ||
      v.data_offsets.length !== 2 ||
      !v.data_offsets.every((n: any) => Number.isSafeInteger(n) && n >= 0) ||
      v.data_offsets[0] > v.data_offsets[1] ||
      v.data_offsets[1] > buffer.length - headerLength - 8
    )
      throw new InvalidModelResult("Invalid model file.");
    const elements = v.shape.reduce((size: number, n: number) => size * n, 1),
      byteLength = elements * bytesByType[v.dtype];
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength !== v.data_offsets[1] - v.data_offsets[0]
    )
      throw new InvalidModelResult("Invalid tensor size.");
    ranges.push([v.data_offsets[0], v.data_offsets[1]]);
    tensors++;
  }
  if (!tensors)
    throw new InvalidModelResult("The result contains no model weights.");
  let end = 0;
  for (const [begin, nextEnd] of ranges.sort(
    (a, b) => a[0] - b[0] || a[1] - b[1]
  )) {
    if (begin !== end) throw new InvalidModelResult("Invalid tensor layout.");
    end = nextEnd;
  }
  if (end !== buffer.length - headerLength - 8)
    throw new InvalidModelResult("Invalid model data length.");
}
export async function fetchTrainingWeights(value: unknown) {
  if (typeof value !== "string")
    throw new Error("Training returned no model file.");
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.port ||
    u.username ||
    u.password ||
    !(u.hostname === "fal.media" || u.hostname.endsWith(".fal.media"))
  )
    throw new Error("Training returned an unsupported model location.");
  const response = await fetch(u, {
    redirect: "error",
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      "Model download is temporarily unavailable. Refresh this job to retry."
    );
  }
  const bytes = await readBounded(response, TRAINING_POLICY.maxModelBytes);
  validateSafetensors(bytes);
  return bytes;
}
export function publicTrainingJob(job: TrainingJob) {
  return {
    id: Number(job.id),
    requestId: job.requestId,
    name: job.name,
    type: job.trainingType,
    triggerWord: job.triggerWord,
    steps: Number(job.steps),
    imageCount: Array.isArray(job.imageKeys) ? job.imageKeys.length : 0,
    state: job.state,
    quotedCredits: Number(job.quotedCredits),
    charged: !!job.debitedAt,
    refunded: !!job.refundedAt,
    queuePosition: job.queuePosition,
    errorCode: job.errorCode,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    reconciliationRequired: job.state === "reconciliation",
    canDownload: job.state === "succeeded" && !!job.modelKey,
  };
}
async function requireJob(userId: number, id: number) {
  const job = await jobs.getTrainingJob(userId, id);
  if (!job) throw new Error("Training job not found.");
  return job;
}
async function revokeTrainingKey(userId: number, key: string) {
  const db = await getDb();
  if (!db) return;
  const queries = mediaRevocationQueries(db, [key], "training-unused", userId);
  if (queries.length) await db.batch(queries as any);
}
export async function prepareOwnedTraining(userId: number, id: number) {
  await assertPrivateStorage();
  const claim = await jobs.claimTrainingPreparation(userId, id);
  if (!claim) {
    const current = await requireJob(userId, id);
    if (
      ["draft", "preparing"].includes(current.state) &&
      new Date(current.expiresAt).getTime() <= Date.now()
    )
      throw new Error(
        "This dataset expired. Delete it and upload fresh training images."
      );
    return publicTrainingJob(current);
  }
  const { job, token } = claim;
  let archiveKey: string | undefined;
  try {
    await jobs.assertTrainingImages(userId, job.imageKeys);
    const zip = new JSZip(),
      hashes = new Set<string>();
    let total = 0;
    for (let i = 0; i < job.imageKeys.length; i++) {
      const image = await storageGetObjectBounded(
        normalizeStorageKey(job.imageKeys[i]),
        TRAINING_POLICY.uploadMaxBytes
      );
      if (!image)
        throw new Error(
          "An uploaded image is missing. Upload a fresh dataset."
        );
      const decoder = sharp(image.bytes, {
        limitInputPixels: 32_000_000,
        animated: false,
        failOn: "error",
      });
      const meta = await decoder.metadata();
      if (
        !["jpeg", "png", "webp"].includes(meta.format || "") ||
        (meta.pages ?? 1) > 1
      )
        throw new Error("Use still JPEG, PNG or WebP images.");
      const bytes = await decoder
        .rotate()
        .resize({
          width: 1024,
          height: 1024,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();
      const hash = createHash("sha256").update(bytes).digest("hex");
      if (hashes.has(hash))
        throw new Error(
          "Choose different photos: duplicate images do not improve training."
        );
      hashes.add(hash);
      total += bytes.length;
      if (total > 64 * 1024 * 1024)
        throw new Error(
          "The dataset is too large. Use fewer or smaller images."
        );
      zip.file(`image_${String(i + 1).padStart(2, "0")}.jpg`, bytes);
    }
    const archive = await zip.generateAsync({
      type: "nodebuffer",
      compression: "STORE",
    });
    archiveKey = `training/datasets/${id}/${randomUUID()}.zip`;
    await withStorageOwner(userId, () =>
      storagePut(archiveKey!, archive, "application/zip", { isPrivate: true })
    );
    try {
      if (
        !(await jobs.finishTrainingPreparation(userId, id, token, archiveKey))
      )
        await revokeTrainingKey(userId, archiveKey);
    } catch (error) {
      const recovered = await jobs.getTrainingJob(userId, id);
      if (
        recovered?.archiveKey !== archiveKey ||
        recovered.state !== "ready_to_submit"
      )
        throw error;
    }
    return publicTrainingJob(await requireJob(userId, id));
  } catch (error) {
    if (archiveKey)
      await revokeTrainingKey(userId, archiveKey).catch(() => undefined);
    await jobs
      .finishTrainingPreparation(userId, id, token, null)
      .catch(() => undefined);
    throw error;
  }
}
export async function submitOwnedTraining(userId: number, id: number) {
  const before = await requireJob(userId, id);
  if (before.state !== "ready_to_submit") return publicTrainingJob(before);
  if (!trainingProviderAvailable())
    throw new Error(
      "Custom training is temporarily unavailable. No credits were charged."
    );
  await assertPrivateStorage();
  await jobs.assertTrainingImages(userId, before.imageKeys);
  if (!before.archiveKey) throw new Error("Prepare the images first.");
  // Signing/configuration failures precede the debit and cannot incur provider cost.
  const archiveUrl = await storageGetSigned(before.archiveKey, 3600);
  let claim: TrainingJob | undefined;
  try {
    claim = await jobs.claimTrainingSubmission(userId, id);
  } catch {
    // A lost DB acknowledgment is never authorization to invoke the provider.
    return publicTrainingJob(await requireJob(userId, id));
  }
  if (!claim) {
    const current = await requireJob(userId, id);
    if (current.state === "ready_to_submit")
      throw new Error(
        "Check your Agency plan, dataset expiry and credit balance before trying again."
      );
    return publicTrainingJob(current);
  }
  try {
    // Recheck both user/plan and durable cancellation fence immediately before the paid POST.
    const current = await requireJob(userId, id);
    if (
      current.state !== "submitting" ||
      !(await jobs.isTrainingEligible(userId))
    ) {
      await jobs.refundTrainingJob(userId, id, "not_submitted", [
        "submitting",
        "reconciliation",
      ]);
      return publicTrainingJob(await requireJob(userId, id));
    }
    await jobs.assertTrainingImages(userId, claim.imageKeys);
  } catch (error) {
    await jobs
      .refundTrainingJob(userId, id, "not_submitted", [
        "submitting",
        "reconciliation",
      ])
      .catch(() => undefined);
    throw error;
  }
  try {
    const receipt = await queueRequest(
      `https://queue.fal.run/${FAL_TRAINER}`,
      "POST",
      {
        images_data_url: archiveUrl,
        trigger_word: claim.triggerWord,
        steps: claim.steps,
        is_style: claim.trainingType === "style",
        create_masks: claim.trainingType === "face",
        data_archive_format: "zip",
        is_input_format_already_preprocessed: false,
      }
    );
    const requestId = receipt.request_id;
    const statusUrl = validateTrainingQueueUrl(
      receipt.status_url,
      requestId,
      "/status"
    );
    const responseUrl = validateTrainingQueueUrl(
      receipt.response_url,
      requestId,
      ""
    );
    const cancelUrl = validateTrainingQueueUrl(
      receipt.cancel_url,
      requestId,
      "/cancel"
    );
    try {
      await jobs.updateTrainingJob(
        userId,
        id,
        ["submitting", "reconciliation"],
        sql`state=CASE WHEN "errorCode"='cancel_during_submission' THEN 'cancel_requested' ELSE 'queued' END,"providerRequestId"=${requestId},"statusUrl"=${statusUrl},"responseUrl"=${responseUrl},"cancelUrl"=${cancelUrl},"providerState"='IN_QUEUE',"errorCode"=NULL`
      );
    } catch {
      // Persist the same receipt again, never a second paid POST. Unique receipt is a second fence.
      await jobs
        .updateTrainingJob(
          userId,
          id,
          ["submitting", "reconciliation"],
          sql`state=CASE WHEN "errorCode"='cancel_during_submission' THEN 'cancel_requested' ELSE 'queued' END,"providerRequestId"=${requestId},"statusUrl"=${statusUrl},"responseUrl"=${responseUrl},"cancelUrl"=${cancelUrl},"providerState"='IN_QUEUE',"errorCode"=NULL`
        )
        .catch(() => {
          console.warn("[training] Accepted request needs receipt recovery", {
            trainingJobId: id,
            providerRequestId: requestId,
          });
        });
    }
    const saved = await jobs.getTrainingJob(userId, id);
    if (saved?.state === "cancel_requested")
      await queueRequest(cancelUrl, "PUT").catch(() => undefined);
  } catch (error) {
    if (error instanceof TrainingRejected)
      await jobs.refundTrainingJob(userId, id, "provider_rejected", [
        "submitting",
      ]);
    else
      await jobs
        .updateTrainingJob(
          userId,
          id,
          ["submitting"],
          sql`state='reconciliation',"errorCode"='submission_outcome_uncertain'`
        )
        .catch(() => undefined);
  }
  return publicTrainingJob(await requireJob(userId, id));
}
export async function refreshOwnedTraining(userId: number, id: number) {
  let job = await requireJob(userId, id);
  if (
    job.state === "submitting" &&
    Date.now() - new Date(job.updatedAt).getTime() > 90_000
  ) {
    await jobs.updateTrainingJob(
      userId,
      id,
      ["submitting"],
      sql`state='reconciliation',"errorCode"='submission_outcome_uncertain'`
    );
    return publicTrainingJob(await requireJob(userId, id));
  }
  if (!ACTIVE.includes(job.state) || !trainingProviderAvailable())
    return publicTrainingJob(job);
  const lease = await jobs.acquireTrainingPoll(userId, id);
  if (!lease) return publicTrainingJob(await requireJob(userId, id));
  job = lease.job;
  let modelKey: string | undefined;
  try {
    const status = await queueRequest(
      validateTrainingQueueUrl(job.statusUrl, job.providerRequestId!, "/status")
    );
    if (status.status === "COMPLETED" && status.error) {
      await jobs.refundTrainingJob(userId, id, "provider_failed", ACTIVE);
    } else if (status.status === "COMPLETED") {
      const result = await queueRequest(
        validateTrainingQueueUrl(job.responseUrl, job.providerRequestId!, "")
      );
      if (result.error || !result.diffusers_lora_file?.url) {
        await jobs.refundTrainingJob(
          userId,
          id,
          "provider_invalid_result",
          ACTIVE
        );
      } else {
        const weights = await fetchTrainingWeights(
          result.diffusers_lora_file.url
        );
        modelKey = `training/models/${id}/${randomUUID()}.safetensors`;
        await withStorageOwner(userId, () =>
          storagePut(modelKey!, weights, "application/octet-stream", {
            isPrivate: true,
          })
        );
        const saved = await jobs.updateTrainingJob(
          userId,
          id,
          ACTIVE,
          sql`state='succeeded',"providerState"='COMPLETED',"modelKey"=${modelKey},"queuePosition"=NULL,"errorCode"=NULL`
        );
        if (!saved) await revokeTrainingKey(userId, modelKey);
      }
    } else if (status.status === "FAILED") {
      await jobs.refundTrainingJob(userId, id, "provider_failed", ACTIVE);
    } else if (
      status.status === "IN_QUEUE" ||
      status.status === "IN_PROGRESS"
    ) {
      const state =
        job.state === "cancel_requested"
          ? "cancel_requested"
          : status.status === "IN_QUEUE"
            ? "queued"
            : "training";
      const position =
        Number.isSafeInteger(status.queue_position) &&
        status.queue_position >= 0
          ? status.queue_position
          : null;
      await jobs.updateTrainingJob(
        userId,
        id,
        ACTIVE,
        sql`state=${state},"providerState"=${status.status},"queuePosition"=${position},"errorCode"=NULL`
      );
    } else throw new Error("Training status is temporarily unavailable.");
  } catch (error) {
    // Lost DB acknowledgment must not revoke an artifact that did commit.
    const recovered = await jobs
      .getTrainingJob(userId, id)
      .catch(() => undefined);
    if (
      modelKey &&
      !(recovered?.state === "succeeded" && recovered.modelKey === modelKey)
    )
      await revokeTrainingKey(userId, modelKey).catch(() => undefined);
    if (error instanceof InvalidModelResult)
      await jobs.refundTrainingJob(
        userId,
        id,
        "provider_invalid_model",
        ACTIVE
      );
    // A known receipt remains safely pollable; neither resubmit nor refund a timeout.
    else
      await jobs
        .updateTrainingJob(
          userId,
          id,
          ACTIVE,
          sql`"errorCode"='status_or_download_retry'`
        )
        .catch(() => undefined);
  } finally {
    await jobs
      .releaseTrainingPoll(userId, id, lease.token)
      .catch(() => undefined);
  }
  return publicTrainingJob(await requireJob(userId, id));
}
export async function cancelOwnedTraining(userId: number, id: number) {
  const job = await requireJob(userId, id);
  if (["draft", "preparing", "ready_to_submit"].includes(job.state)) {
    await jobs.updateTrainingJob(
      userId,
      id,
      ["draft", "preparing", "ready_to_submit"],
      sql`state='canceled',"leaseToken"=NULL,"leaseUntil"=NULL`
    );
    if (job.archiveKey) await revokeTrainingKey(userId, job.archiveKey);
  } else if (
    ACTIVE.includes(job.state) &&
    job.providerRequestId &&
    job.cancelUrl
  ) {
    await jobs.updateTrainingJob(
      userId,
      id,
      ACTIVE,
      sql`state='cancel_requested'`
    );
    try {
      await queueRequest(
        validateTrainingQueueUrl(
          job.cancelUrl,
          job.providerRequestId,
          "/cancel"
        ),
        "PUT"
      );
    } catch {
      await jobs.updateTrainingJob(
        userId,
        id,
        ["cancel_requested"],
        sql`"errorCode"='cancel_not_confirmed'`
      );
    }
    // fal 202 only requests cancellation; the request may already be running.
  } else if (job.state === "submitting") {
    await jobs.updateTrainingJob(
      userId,
      id,
      ["submitting"],
      sql`state='reconciliation',"errorCode"='cancel_during_submission'`
    );
  }
  return publicTrainingJob(await requireJob(userId, id));
}
export async function getOwnedModelDownload(userId: number, id: number) {
  const job = await requireJob(userId, id);
  if (job.state !== "succeeded" || !job.modelKey)
    throw new Error("The trained model is not ready.");
  await assertModelAsset(userId, job.modelKey);
  return {
    url: await storageGetSigned(job.modelKey, 300),
    filename: `${job.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.safetensors`,
    expiresIn: 300,
  };
}
async function assertModelAsset(userId: number, key: string) {
  const db = await getDb();
  if (!db) throw new Error("Model unavailable.");
  if (
    !walletRows(
      await db.execute(sql`SELECT key FROM "mediaAssets" WHERE key=${key} AND "ownerUserId"=${userId}
    AND "isPrivate"=true AND "revokedAt" IS NULL AND "deletedAt" IS NULL`)
    )[0]
  )
    throw new Error("This model has been deleted.");
}
export async function resolveOwnedTrainingModel(userId: number, id: number) {
  const job = await requireJob(userId, id);
  if (!(await jobs.isTrainingEligible(userId)))
    throw new Error("An active Agency plan is required to use a custom model.");
  if (job.state !== "succeeded" || !job.modelKey)
    throw new Error("This custom model is not ready.");
  await assertModelAsset(userId, job.modelKey);
  if (!trainingProviderAvailable())
    throw new Error("Custom model generation is temporarily unavailable.");
  await assertPrivateStorage();
  return {
    id: job.id,
    name: job.name,
    triggerWord: job.triggerWord,
    widthLimit: 1024,
    creditCost: getTrainingImageCredits(1024, 1024),
  };
}
export async function executeOwnedTrainingImage(input: {
  userId: number;
  trainedModelId: number;
  prompt: string;
  width: number;
  height: number;
  onProviderAccepted?: (receipt: TrainingImageReceipt) => Promise<void>;
}) {
  let job: TrainingJob, modelUrl: string;
  try {
    getTrainingImageCredits(input.width, input.height);
    await resolveOwnedTrainingModel(input.userId, input.trainedModelId);
    job = await requireJob(input.userId, input.trainedModelId);
    modelUrl = await storageGetSigned(job.modelKey!, 3600);
  } catch {
    throw new ConfirmedTrainingImageFailure(
      "The custom model is no longer available. No image was submitted."
    );
    await assertPrivateStorage();
  }
  // Root's generation request owns the debit/refund. This helper only invokes the provider once.
  let receipt: any;
  try {
    receipt = await queueRequest(
      "https://queue.fal.run/fal-ai/flux-lora",
      "POST",
      {
        prompt: input.prompt.includes(job.triggerWord)
          ? input.prompt
          : `${job.triggerWord} ${input.prompt}`,
        loras: [{ path: modelUrl, scale: 1 }],
        image_size: { width: input.width, height: input.height },
        num_images: 1,
        num_inference_steps: 28,
        guidance_scale: 7.5,
        enable_safety_checker: true,
        output_format: "jpeg",
      }
    );
  } catch (error) {
    if (error instanceof TrainingRejected)
      throw new ConfirmedTrainingImageFailure(
        "Custom image request was not accepted."
      );
    throw new TrainingImageOutcomeUncertain();
  }
  try {
    const statusUrl = trainingImageQueueUrl(
        receipt.status_url,
        receipt.request_id,
        "/status"
      ),
      resultUrl = trainingImageQueueUrl(
        receipt.response_url,
        receipt.request_id,
        ""
      );
    await input.onProviderAccepted?.({
      requestId: String(receipt.request_id),
      statusUrl,
      responseUrl: resultUrl,
      acceptedAt: new Date().toISOString(),
    });
    const pollDeadline = Date.now() + 90_000;
    for (let i = 0; i < 45 && Date.now() < pollDeadline; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const status = await queueRequest(statusUrl);
      if (status.status === "COMPLETED") {
        if (status.error)
          throw new ConfirmedTrainingImageFailure(
            "Custom model could not produce this image."
          );
        const result = await queueRequest(resultUrl);
        if (
          status.error ||
          result.error ||
          result.has_nsfw_concepts?.[0] ||
          !result.images?.[0]?.url
        )
          throw new ConfirmedTrainingImageFailure(
            "Custom model could not produce this image."
          );
        // Recheck ownership/deletion before saving a late provider response.
        const current = await requireJob(input.userId, input.trainedModelId);
        if (current.state !== "succeeded" || !current.modelKey)
          throw new Error("Custom model has been deleted.");
        await assertModelAsset(input.userId, current.modelKey);
        const image = await fetchGuardedImage(result.images[0].url, {
          signal: AbortSignal.timeout(30_000),
        });
        const key = `generations/custom/${randomUUID()}.jpg`;
        const saved = await withStorageOwner(input.userId, () =>
          storagePut(key, image.buffer, image.contentType, { isPrivate: true })
        );
        return { url: saved.url, key: saved.key };
      }
      if (status.status === "FAILED")
        throw new ConfirmedTrainingImageFailure(
          "Custom model could not produce this image."
        );
    }
    throw new TrainingImageOutcomeUncertain(String(receipt.request_id));
  } catch (error) {
    if (
      error instanceof ConfirmedTrainingImageFailure ||
      error instanceof TrainingImageOutcomeUncertain
    )
      throw error;
    throw new TrainingImageOutcomeUncertain(String(receipt.request_id));
  }
}

/** Poll an accepted custom image after a disconnect/cold start, without a new debit or POST. */
export async function recoverOwnedTrainingImage(
  userId: number,
  requestId: string
) {
  const prior = await readGenerationRequest({ userId, requestId });
  if (!prior) throw new Error("Image request not found.");
  if (["completed", "rejected", "refunded"].includes(prior.state))
    return replayGenerationResponse(prior, prior.payloadHash, "image");
  const db = await getDb();
  if (!db) throw new Error("Image status is temporarily unavailable.");
  const row = walletRows(
    await db.execute(sql`SELECT r.*,g.metadata,g.width,g.height FROM "generationRequests" r
    JOIN generations g ON g.id=r."generationId" AND g."userId"=r."userId" JOIN users u ON u.id=r."userId"
    WHERE r."userId"=${userId} AND r."requestId"=${requestId}::uuid AND r.state IN ('rendering','reconciliation')
      AND COALESCE(r."errorCode",'')<>'account-deleted' AND u."loginMethod" IS DISTINCT FROM 'deleted'
      AND g.status='generating' AND g."mediaType"='image' AND lower(g.metadata->>'billingRequestId')=r."requestId"::text`)
  )[0];
  if (!row) throw new Error("Image request is no longer available.");
  const receipt = row.metadata?.customTrainingReceipt as
    TrainingImageReceipt | undefined;
  const trainedModelId = Number(row.metadata?.trainedModelId);
  if (!receipt || !Number.isSafeInteger(trainedModelId) || trainedModelId < 1)
    return pendingGenerationResponse(requestId, "image", prior);
  const statusUrl = trainingImageQueueUrl(
      receipt.statusUrl,
      receipt.requestId,
      "/status"
    ),
    responseUrl = trainingImageQueueUrl(
      receipt.responseUrl,
      receipt.requestId,
      ""
    );
  // The original invocation owns the first two minutes. A reconciled invocation
  // has already returned and may be recovered immediately.
  if (
    row.state === "rendering" &&
    Date.now() - Date.parse(receipt.acceptedAt) < 120_000
  )
    return pendingGenerationResponse(requestId, "image", prior);
  const token = randomUUID();
  const lease = walletRows(
    await db.execute(sql`UPDATE generations g SET metadata=g.metadata||jsonb_build_object('customTrainingRecoveryToken',${token}::text,'customTrainingRecoveryUntil',now()+interval '3 minutes')
    WHERE g.id=${Number(row.generationId)} AND g."userId"=${userId} AND g.status='generating'
      AND (g.metadata->>'customTrainingRecoveryUntil' IS NULL OR (g.metadata->>'customTrainingRecoveryUntil')::timestamp<now())
      AND EXISTS(SELECT 1 FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted') RETURNING id`)
  );
  if (!lease.length)
    return pendingGenerationResponse(requestId, "image", prior);
  const owner: GenerationRequestOwner = {
    id: Number(row.id),
    userId,
    requestId,
    payloadHash: row.payloadHash,
    executionToken: row.executionToken,
  };
  let savedKey: string | undefined, savedUrl: string | undefined;
  try {
    const status = await queueRequest(statusUrl);
    if (status.status === "COMPLETED" || status.status === "FAILED") {
      const result =
        status.error || status.status === "FAILED"
          ? { error: true }
          : await queueRequest(responseUrl);
      if (
        result.error ||
        result.has_nsfw_concepts?.[0] ||
        !result.images?.[0]?.url
      ) {
        const failed = await failGenerationRequestAndRefund(owner, {
          confirmedFailure: true,
          errorCode: "custom-image-provider-failed",
          errorMessage: "The custom model could not produce this image.",
          generationId: Number(row.generationId),
        });
        if (failed.kind === "refunded" || failed.kind === "replay")
          return replayGenerationResponse(
            failed.request,
            owner.payloadHash,
            "image"
          );
      } else {
        const model = await requireJob(userId, trainedModelId);
        if (model.state !== "succeeded" || !model.modelKey)
          throw new Error("Custom model was deleted.");
        await assertModelAsset(userId, model.modelKey);
        const image = await fetchGuardedImage(result.images[0].url, {
          signal: AbortSignal.timeout(30_000),
        });
        savedKey = `generations/custom/${randomUUID()}.jpg`;
        const saved = await withStorageOwner(userId, () =>
          storagePut(savedKey!, image.buffer, image.contentType, {
            isPrivate: true,
          })
        );
        savedUrl = saved.url;
        const metadata = { ...row.metadata };
        delete metadata.customTrainingRecoveryToken;
        delete metadata.customTrainingRecoveryUntil;
        const resultPayload = {
          id: Number(row.generationId),
          status: "completed",
          requestId,
          mediaType: "image",
          imageUrl: saved.url,
          newAchievements: [],
          modelId: `custom-trained:${trainedModelId}`,
          creditCost: Number(row.quotedCredits),
        };
        const complete = await completeGenerationRequest(owner, {
          result: resultPayload,
          imageUrl: saved.url,
          thumbnailUrl: saved.url,
          metadata,
        });
        if (complete.kind === "completed" || complete.kind === "replay") {
          const response = replayGenerationResponse(
            complete.request,
            owner.payloadHash,
            "image"
          );
          if (
            response.status === "completed" &&
            response.imageUrl !== saved.url
          )
            await revokeTrainingKey(userId, saved.key);
          return response;
        }
      }
    }
  } catch {
    /* The persisted receipt remains safely pollable after transient failures. */
  } finally {
    try {
      await db.execute(sql`UPDATE generations SET metadata=(metadata-'customTrainingRecoveryToken'-'customTrainingRecoveryUntil')||jsonb_build_object('customTrainingLastCheckedAt',now())
      WHERE id=${Number(row.generationId)} AND "userId"=${userId} AND metadata->>'customTrainingRecoveryToken'=${token}
        AND EXISTS(SELECT 1 FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted')`);
    } catch {
      /* A recovery lease expires safely. */
    }
  }
  const recovered = await readGenerationRequest({ userId, requestId });
  if (
    savedKey &&
    !(
      recovered?.state === "completed" &&
      recovered.result?.imageUrl === savedUrl
    )
  )
    await revokeTrainingKey(userId, savedKey).catch(() => undefined);
  return recovered
    ? replayGenerationResponse(recovered, prior.payloadHash, "image")
    : pendingGenerationResponse(requestId, "image", prior);
}

/** Cron performs GET-only recovery; it cannot create another paid provider job. */
export async function sweepOwnedTrainingJobs() {
  const db = await getDb();
  if (!db) throw new Error("Training recovery database unavailable.");
  const expired = walletRows(
    await db.execute(sql`UPDATE "trainingJobs" t SET state='canceled',"errorCode"='dataset_expired',"leaseToken"=NULL,"leaseUntil"=NULL,"updatedAt"=now()
    WHERE t.id IN (SELECT id FROM "trainingJobs" WHERE state IN ('draft','preparing','ready_to_submit') AND "expiresAt"<now() AND "debitedAt" IS NULL LIMIT 20)
      AND EXISTS(SELECT 1 FROM users WHERE id=t."userId" AND "loginMethod" IS DISTINCT FROM 'deleted') RETURNING t."userId",t."archiveKey"`)
  );
  for (const job of expired)
    if (job.archiveKey)
      await revokeTrainingKey(Number(job.userId), job.archiveKey).catch(
        () => undefined
      );
  const training = walletRows(
    await db.execute(sql`SELECT t.id,t."userId" FROM "trainingJobs" t JOIN users u ON u.id=t."userId"
    WHERE t.state IN ('queued','training','cancel_requested','submitting') AND t."deletedAt" IS NULL
      AND (t."leaseUntil" IS NULL OR t."leaseUntil"<now()) AND u."loginMethod" IS DISTINCT FROM 'deleted'
    ORDER BY t."updatedAt" ASC LIMIT 1`)
  );
  const images = walletRows(
    await db.execute(sql`SELECT r."requestId",r."userId" FROM "generationRequests" r
    JOIN generations g ON g.id=r."generationId" AND g."userId"=r."userId" JOIN users u ON u.id=r."userId"
    WHERE r.state IN ('rendering','reconciliation') AND COALESCE(r."errorCode",'')<>'account-deleted'
      AND g.status='generating' AND g.metadata->>'trainedModelId' IS NOT NULL AND g.metadata->'customTrainingReceipt' IS NOT NULL
      AND u."loginMethod" IS DISTINCT FROM 'deleted'
    ORDER BY COALESCE((g.metadata->>'customTrainingLastCheckedAt')::timestamp,g."createdAt") ASC LIMIT 1`)
  );
  const work = [
    ...training.map(job =>
      refreshOwnedTraining(Number(job.userId), Number(job.id))
    ),
    ...images.map(image =>
      recoverOwnedTrainingImage(Number(image.userId), image.requestId)
    ),
  ];
  const results = await Promise.allSettled(work);
  return {
    expired: expired.length,
    polled: results.length,
    errors: results.filter(result => result.status === "rejected").length,
  };
}
