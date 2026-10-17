import { createHash, randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { getDb } from "../db";
import { userSubscriptions, subscriptionPlans } from "../../drizzle/schema";
import { currentSubscriptionOrder } from "./subscriptionSelection";
import { storageGetObjectBounded, storagePut } from "../storage";
import { ENV } from "./env";
import {
  getMediaAsset,
  normalizeStorageKey,
  storageKeyFromUrl,
} from "./mediaLifecycle";
import { withStorageOwner } from "./storageContext";
import { fetchGuardedMedia } from "./imageUrlGuard";
import { videoContainerType } from "./videoGateway";
import { checkPrompt, isSexualPrompt } from "./promptModeration";
import { requireToolActive } from "./toolStatus";
import { assertPrivateStorage } from "./privateStorage";
import { walletRows } from "./walletAccounting";
import { getEffectiveSubscriptionTier } from "../../shared/subscriptionEntitlement";
import { hasWorkspaceModelAccess } from "../../shared/workspaceModelSelection";
import { IMAGE_ANIMATION_POLICY as POLICY } from "../../shared/imageAnimation";
import {
  beginGenerationRequest,
  claimGenerationRequest,
  completeGenerationRequest,
  failGenerationRequestAndRefund,
  markGenerationReconciliation,
  type GenerationRequestOwner,
  type GenerationRequestRecord,
} from "./generationBilling";
import {
  pendingGenerationResponse,
  replayGenerationResponse,
} from "./generationRequest";

export interface AnimationInput {
  requestId: string;
  generationId: number;
  prompt: string;
  expectedCreditCost: number;
}
export interface AnimationReceipt {
  providerRequestId: string;
  statusUrl: string;
  responseUrl: string;
}
export interface AnimationStored {
  request: GenerationRequestRecord;
  owner: GenerationRequestOwner;
  metadata: Record<string, any> | null;
}
export class KnownAnimationFailure extends Error {}
const KIND = "image-animation";
const MODEL_ROOT = "fal-ai/wan-25-preview";
const SOURCE_LIMIT = 16 * 1024 * 1024;
const pending = (
  requestId: string,
  request?: GenerationRequestRecord,
  review?: boolean
) => ({
  ...pendingGenerationResponse(requestId, "video", request),
  retryAfterMs: 5000,
  creditCost: request?.quotedCredits ?? POLICY.creditCost,
  reconciliationRequired: review ?? request?.state === "reconciliation",
});
export function hashAnimationInput(input: AnimationInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        kind: KIND,
        generationId: input.generationId,
        prompt: input.prompt.trim(),
        modelId: POLICY.modelId,
        duration: POLICY.duration,
        resolution: POLICY.resolution,
      })
    )
    .digest("hex");
}

/** Queue URLs are capabilities only on Fal's exact queue origin/model/request.
 * Never forward the API key to arbitrary provider-returned URLs or redirects. */
export function validateAnimationReceipt(value: unknown): AnimationReceipt {
  const receipt = value as {
    request_id?: unknown;
    status_url?: unknown;
    response_url?: unknown;
  };
  if (
    !receipt ||
    typeof receipt.request_id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(receipt.request_id)
  )
    throw new Error("Animation submission outcome needs review.");
  const id = receipt.request_id;
  const safe = (raw: unknown, status: boolean) => {
    if (typeof raw !== "string")
      throw new Error("Animation submission receipt is incomplete.");
    const url = new URL(raw);
    const roots = [MODEL_ROOT, POLICY.modelId].map(
      model => `/${model}/requests/${id}`
    );
    const paths = roots.flatMap(root =>
      status ? [`${root}/status`] : [root, `${root}/response`]
    );
    if (
      url.origin !== "https://queue.fal.run" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !paths.includes(url.pathname)
    )
      throw new Error("Animation receipt URL is not allowed.");
    return url.toString();
  };
  return {
    providerRequestId: id,
    statusUrl: safe(receipt.status_url, true),
    responseUrl: safe(receipt.response_url, false),
  };
}
async function boundedJson(response: Response): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty animation provider response.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.length;
    if (bytes > 128 * 1024) {
      await reader.cancel();
      throw new Error("Animation provider response is too large.");
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function falHeaders() {
  if (!ENV.falApiKey)
    throw new Error("Animation provider configuration is unavailable.");
  return {
    Authorization: `Key ${ENV.falApiKey}`,
    "Content-Type": "application/json",
  };
}
export async function submitImageAnimation(
  dataUri: string,
  prompt: string
): Promise<AnimationReceipt> {
  const response = await fetch(`https://queue.fal.run/${POLICY.modelId}`, {
    method: "POST",
    headers: falHeaders(),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      image_url: dataUri,
      prompt,
      duration: "5",
      resolution: "480p",
      enable_safety_checker: true,
      enable_prompt_expansion: false,
    }),
  });
  if (!response.ok) {
    if ([400, 401, 402, 403, 404, 422, 429].includes(response.status))
      throw new KnownAnimationFailure(
        "The animation provider rejected this request. Reserved credits were returned."
      );
    throw new Error(
      "Could not confirm animation submission. Do not submit another request."
    );
  }
  return validateAnimationReceipt(await boundedJson(response));
}
type ProviderPoll =
  | { state: "pending" }
  | { state: "failed" }
  | { state: "completed"; videoUrl: string };
export async function pollImageAnimation(
  receipt: AnimationReceipt
): Promise<ProviderPoll> {
  // Revalidate persisted data as well as the original submit response.
  validateAnimationReceipt({
    request_id: receipt.providerRequestId,
    status_url: receipt.statusUrl,
    response_url: receipt.responseUrl,
  });
  const options = {
    headers: falHeaders(),
    redirect: "error" as const,
    signal: AbortSignal.timeout(15_000),
  };
  const statusResponse = await fetch(receipt.statusUrl, options);
  if (!statusResponse.ok)
    throw new Error("Animation status is temporarily unavailable.");
  const status = await boundedJson(statusResponse);
  if (status.request_id && status.request_id !== receipt.providerRequestId)
    throw new Error("Animation status receipt does not match.");
  if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS")
    return { state: "pending" };
  if (status.status !== "COMPLETED")
    throw new Error("Animation status could not be confirmed.");
  // Fal documents errors as COMPLETED with error/error_type, not as success.
  if (status.error || status.error_type) return { state: "failed" };
  const resultResponse = await fetch(receipt.responseUrl, {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
  if (resultResponse.status === 422) return { state: "failed" };
  if (!resultResponse.ok)
    throw new Error("Animation result is temporarily unavailable.");
  const result = await boundedJson(resultResponse);
  if (result.error || !result.video || typeof result.video.url !== "string")
    return { state: "failed" };
  return { state: "completed", videoUrl: result.video.url };
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Animation database unavailable.");
  return db;
}
async function execute(
  query: Parameters<Awaited<ReturnType<typeof database>>["execute"]>[0]
) {
  return walletRows(await (await database()).execute(query));
}
const activeOwner = sql`u."loginMethod" IS DISTINCT FROM 'deleted'`;

export async function readAnimationRequest(
  userId: number,
  requestId: string
): Promise<AnimationStored | null> {
  const [row] =
    await execute(sql`/* animation:read */ SELECT r.*, g.metadata FROM "generationRequests" r
    JOIN users u ON u.id = r."userId" LEFT JOIN generations g ON g.id = r."generationId" AND g."userId" = r."userId"
    WHERE r."userId" = ${userId} AND r."requestId" = ${requestId}::uuid AND ${activeOwner}
      AND COALESCE(r."errorCode", '') <> 'account-deleted'`);
  if (!row) return null;
  const request: GenerationRequestRecord = {
    id: Number(row.id),
    userId: Number(row.userId),
    requestId: String(row.requestId),
    payloadHash: String(row.payloadHash),
    generationId: row.generationId == null ? null : Number(row.generationId),
    quotedCredits: Number(row.quotedCredits),
    state: row.state as GenerationRequestRecord["state"],
    result: row.result ?? null,
    errorCode: row.errorCode ?? null,
    debitedAt: row.debitedAt ?? null,
    refundedAt: row.refundedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return {
    request,
    owner: {
      userId,
      requestId,
      payloadHash: request.payloadHash,
      id: request.id,
      executionToken: String(row.executionToken),
    },
    metadata: row.metadata ?? null,
  };
}
async function animationTier(userId: number) {
  const db = await database();
  const [subscription] = await db
    .select({
      planName: subscriptionPlans.name,
      status: userSubscriptions.status,
      currentPeriodStart: userSubscriptions.currentPeriodStart,
      currentPeriodEnd: userSubscriptions.currentPeriodEnd,
    })
    .from(userSubscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(userSubscriptions.planId, subscriptionPlans.id)
    )
    .where(eq(userSubscriptions.userId, userId))
    .orderBy(...currentSubscriptionOrder())
    .limit(1);
  return getEffectiveSubscriptionTier(subscription);
}
export async function prepareAnimationSource(
  userId: number,
  generationId: number
) {
  const [source] =
    await execute(sql`/* animation:source */ SELECT g.id, g."fileKey", g."imageUrl", g.prompt FROM generations g JOIN users u ON u.id = g."userId"
    WHERE g.id = ${generationId} AND g."userId" = ${userId} AND g.status = 'completed' AND g."mediaType" = 'image' AND ${activeOwner}`);
  if (!source)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Choose a completed image from your own generations.",
    });
  const key = source.fileKey || storageKeyFromUrl(source.imageUrl ?? "");
  if (!key)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This image has no owned storage object. Generate a new image first.",
    });
  const asset = await getMediaAsset(key);
  if (
    !asset ||
    asset.ownerUserId !== userId ||
    asset.revokedAt ||
    asset.ownerDeleted
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This image is no longer available for animation.",
    });
  const object = await storageGetObjectBounded(key, SOURCE_LIMIT);
  if (!object)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "The source image is no longer stored.",
    });
  let prepared;
  try {
    prepared = await sharp(Buffer.from(object.bytes), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize({
        width: 1024,
        height: 1024,
        fit: "inside",
        withoutEnlargement: false,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
    if (prepared.info.width < 360 || prepared.info.height < 360) {
      prepared = await sharp(prepared.data)
        .extend({
          top: 0,
          left: 0,
          right: Math.max(0, 360 - prepared.info.width),
          bottom: Math.max(0, 360 - prepared.info.height),
          background: "#ffffff",
        })
        .jpeg({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
    }
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This source could not be decoded as an image. Use a different image.",
    });
  }
  if (prepared.data.length > 10 * 1024 * 1024)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The prepared image exceeds the animation input limit.",
    });
  return {
    key: String(key),
    prompt: String(source.prompt),
    dataUri: `data:image/jpeg;base64,${prepared.data.toString("base64")}`,
    width: prepared.info.width,
    height: prepared.info.height,
  };
}
type PreparedSource = Awaited<ReturnType<typeof prepareAnimationSource>>;

/** This free import accepts only a completed, owned animation upload. */
export async function registerUploadedAnimationSource(
  userId: number,
  rawKey: string
) {
  const key = normalizeStorageKey(rawKey);
  const [upload] =
    await execute(sql`/* animation:import-read */ SELECT m.* FROM "mediaUploads" m
    JOIN users u ON u.id = m."userId" JOIN "mediaAssets" a ON a.key = m.key AND a."ownerUserId" = m."userId"
    WHERE m.key = ${key} AND m."userId" = ${userId} AND m.purpose = 'animation' AND m.state = 'completed'
      AND m."contentType" IN ('image/png','image/jpeg','image/webp','image/avif') AND m.size <= 10485760
      AND a."revokedAt" IS NULL AND a."isPrivate" = true AND ${activeOwner}`);
  if (!upload)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Finish uploading an image in this animation tool first.",
    });
  const object = await storageGetObjectBounded(key, 10 * 1024 * 1024);
  if (!object)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "The uploaded image is no longer stored.",
    });
  let info: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    info = await sharp(Buffer.from(object.bytes), {
      limitInputPixels: 40_000_000,
      animated: false,
    }).metadata();
    const formats: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpeg",
      "image/webp": "webp",
      "image/avif": "heif",
    };
    if (
      !info.width ||
      !info.height ||
      info.format !== formats[upload.contentType] ||
      (upload.contentType === "image/avif" && info.compression !== "av1")
    )
      throw new Error("Image type mismatch");
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This upload could not be decoded as its declared image type. Upload a PNG, JPEG or WebP image.",
    });
  }
  const db = await database();
  // Separate READ COMMITTED statements get a fresh snapshot after waiting for
  // the owner lock, so simultaneous imports cannot insert duplicate rows.
  const results = await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(sql`SELECT pg_advisory_xact_lock(72820, ${userId})`),
    db.execute(sql`/* animation:import-create */ INSERT INTO generations ("userId", prompt, "modelVersion", "mediaType", width, height, status, "fileKey", "imageUrl", metadata)
      SELECT m."userId", 'Uploaded image for animation', 'user-upload', 'image', ${info.width}, ${info.height}, 'completed', m.key, ${`/api/media/${key}`}, jsonb_build_object('sourceImport','animation','uploadId',m.id)
      FROM "mediaUploads" m JOIN users u ON u.id = m."userId" JOIN "mediaAssets" a ON a.key = m.key AND a."ownerUserId" = m."userId"
      WHERE m.key = ${key} AND m."userId" = ${userId} AND m.purpose = 'animation' AND m.state = 'completed'
        AND a."revokedAt" IS NULL AND a."isPrivate" = true AND ${activeOwner}
        AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."userId" = m."userId" AND g."fileKey" = m.key AND g."modelVersion" = 'user-upload' AND g.metadata->>'sourceImport' = 'animation') FOR SHARE OF u RETURNING id`),
    db.execute(sql`/* animation:import-result */ SELECT g.id AS "generationId", g."imageUrl" FROM generations g
      JOIN users u ON u.id = g."userId" JOIN "mediaAssets" a ON a.key = g."fileKey" AND a."ownerUserId" = g."userId"
      WHERE g."userId" = ${userId} AND g."fileKey" = ${key} AND g."modelVersion" = 'user-upload' AND g.metadata->>'sourceImport' = 'animation'
        AND a."revokedAt" IS NULL AND a."isPrivate" = true AND ${activeOwner} ORDER BY g.id LIMIT 1`),
  ] as any);
  const [generation] = walletRows(results[3]);
  if (!generation)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This uploaded image is no longer available.",
    });
  return {
    generationId: Number(generation.generationId),
    imageUrl: String(generation.imageUrl),
  };
}
async function createAnimationOutput(
  owner: GenerationRequestOwner,
  input: AnimationInput,
  source: PreparedSource
) {
  const metadata = {
    tool: KIND,
    billingRequestId: owner.requestId,
    sourceGenerationId: input.generationId,
  };
  const [row] =
    await execute(sql`/* animation:create */ INSERT INTO generations ("userId", prompt, "modelVersion", "mediaType", width, height, duration, status, "parentGenerationId", metadata)
    SELECT ${owner.userId}, ${input.prompt}, ${POLICY.modelId}, 'video', ${source.width}, ${source.height}, 5, 'generating', g.id, ${JSON.stringify(metadata)}::text::jsonb
    FROM generations g JOIN users u ON u.id = g."userId" JOIN "mediaAssets" a ON a.key = ${source.key}
    JOIN "generationRequests" r ON r.id = ${owner.id} AND r."userId" = g."userId" AND r."executionToken" = ${owner.executionToken}::uuid
    WHERE g.id = ${input.generationId} AND g."userId" = ${owner.userId} AND g.status = 'completed' AND g."mediaType" = 'image'
      AND a."ownerUserId" = g."userId" AND a."revokedAt" IS NULL AND ${activeOwner} AND r.state = 'reserved' AND COALESCE(r."errorCode", '') <> 'account-deleted'
    RETURNING id`);
  if (!row)
    throw new KnownAnimationFailure(
      "This source image is no longer available. Reserved credits were returned."
    );
  return Number(row.id);
}
async function saveAnimationReceipt(
  owner: GenerationRequestOwner,
  receipt: AnimationReceipt
) {
  const rows =
    await execute(sql`/* animation:receipt */ UPDATE generations g SET metadata = jsonb_set(g.metadata, '{animationReceipt}', ${JSON.stringify(receipt)}::text::jsonb), "updatedAt" = now()
    FROM "generationRequests" r, users u WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId} AND r."executionToken" = ${owner.executionToken}::uuid
      AND g.id = r."generationId" AND g."userId" = r."userId" AND u.id = r."userId" AND ${activeOwner}
      AND r.state IN ('rendering','reconciliation') AND COALESCE(r."errorCode", '') <> 'account-deleted'
      AND g.status IN ('pending','generating') AND g.metadata->>'tool' = ${KIND} RETURNING g.id`);
  return rows.length === 1;
}
async function acquireAnimationPoll(
  owner: GenerationRequestOwner,
  token: string
) {
  return (
    (
      await execute(sql`/* animation:poll-lease */ UPDATE generations g SET metadata = g.metadata || jsonb_build_object('animationPollToken', ${token}::text, 'animationPollUntil', extract(epoch from now()) + 90), "updatedAt" = now()
    FROM "generationRequests" r, users u WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId} AND r."executionToken" = ${owner.executionToken}::uuid
      AND g.id = r."generationId" AND g."userId" = r."userId" AND u.id = r."userId" AND ${activeOwner} AND g.status IN ('pending','generating')
      AND r.state IN ('rendering','reconciliation') AND COALESCE(r."errorCode", '') <> 'account-deleted'
      AND g.metadata->>'tool' = ${KIND} AND COALESCE((g.metadata->>'animationPollUntil')::numeric, 0) < extract(epoch from now()) RETURNING g.id`)
    ).length === 1
  );
}
async function releaseAnimationPoll(
  owner: GenerationRequestOwner,
  token: string
) {
  await execute(sql`/* animation:release-poll */ UPDATE generations SET metadata = metadata - 'animationPollToken' - 'animationPollUntil'
    WHERE id = (SELECT "generationId" FROM "generationRequests" WHERE id = ${owner.id} AND "userId" = ${owner.userId})
      AND "userId" = ${owner.userId} AND metadata->>'animationPollToken' = ${token}`);
}
async function rememberAnimationFailure(owner: GenerationRequestOwner) {
  await execute(sql`/* animation:known-failure */ WITH marked AS (
    UPDATE "generationRequests" r SET "errorCode" = 'animation-known-failure', "updatedAt" = now()
    WHERE r.id = ${owner.id} AND r."userId" = ${owner.userId} AND r."executionToken" = ${owner.executionToken}::uuid
      AND r.state IN ('reserved','rendering','reconciliation') AND COALESCE(r."errorCode", '') <> 'account-deleted'
      AND EXISTS (SELECT 1 FROM users u WHERE u.id = r."userId" AND ${activeOwner}) RETURNING r."generationId", r."userId"
    ) UPDATE generations g SET metadata = g.metadata || '{"animationKnownFailure":true}'::jsonb
      FROM marked m WHERE g.id = m."generationId" AND g."userId" = m."userId" AND g.status IN ('pending','generating')`);
}
export async function materializeAnimation(
  userId: number,
  requestId: string,
  videoUrl: string
) {
  let buffer: Buffer;
  try {
    ({ buffer } = await fetchGuardedMedia(videoUrl, {
      kind: "video",
      maxBytes: 100 * 1024 * 1024,
    }));
  } catch (error) {
    if (
      error instanceof TRPCError &&
      error.code === "BAD_REQUEST" &&
      /allowed video|host is not allowed|URL must use https|URL credentials/.test(
        error.message
      )
    )
      throw new KnownAnimationFailure(
        "The completed animation did not provide a supported video. Reserved credits were returned."
      );
    throw error;
  }
  let contentType;
  try {
    contentType = videoContainerType(buffer);
  } catch {
    throw new KnownAnimationFailure(
      "The animation provider returned an invalid video. Reserved credits were returned."
    );
  }
  if (contentType !== "video/mp4")
    throw new KnownAnimationFailure(
      "The animation provider did not return the required MP4 video. Reserved credits were returned."
    );
  return withStorageOwner(userId, () =>
    storagePut(`animation/${userId}/${requestId}.mp4`, buffer, contentType, {
      isPrivate: true,
    })
  );
}

export interface AnimationDependencies {
  configured(): boolean;
  tier(userId: number): Promise<string>;
  source: typeof prepareAnimationSource;
  read: typeof readAnimationRequest;
  claim: typeof claimGenerationRequest;
  createOutput: typeof createAnimationOutput;
  begin: typeof beginGenerationRequest;
  receipt: typeof saveAnimationReceipt;
  lease: typeof acquireAnimationPoll;
  release: typeof releaseAnimationPoll;
  rememberFailure: typeof rememberAnimationFailure;
  submit: typeof submitImageAnimation;
  poll: typeof pollImageAnimation;
  materialize: typeof materializeAnimation;
  complete: typeof completeGenerationRequest;
  fail: typeof failGenerationRequestAndRefund;
  reconcile: typeof markGenerationReconciliation;
  active(): Promise<void>;
}
export function createImageAnimationService(deps: AnimationDependencies) {
  async function fail(stored: Pick<AnimationStored, "owner" | "request">) {
    const settled = await deps.fail(stored.owner, {
      confirmedFailure: true,
      errorCode: "animation-failed",
      errorMessage:
        "Animation did not produce a video. Reserved credits were returned.",
      generationId: stored.request.generationId ?? undefined,
      result: {
        tool: KIND,
        requestId: stored.owner.requestId,
        status: "failed",
        mediaType: "video",
        creditCost: 0,
        refundedCredits: stored.request.quotedCredits,
        error:
          "Animation did not produce a video. Reserved credits were returned.",
      },
    });
    return settled.kind === "refunded" || settled.kind === "replay"
      ? replayGenerationResponse(
          settled.request,
          stored.owner.payloadHash,
          "video"
        )
      : pending(stored.owner.requestId, stored.request, false);
  }
  async function status(userId: number, requestId: string) {
    const stored = await deps.read(userId, requestId);
    if (
      !stored ||
      (stored.request.generationId !== null &&
        stored.metadata?.tool !== KIND) ||
      (stored.request.generationId === null &&
        stored.request.result &&
        stored.request.result.tool !== KIND)
    )
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Animation request not found.",
      });
    const { request, owner, metadata } = stored;
    if (["completed", "refunded", "rejected"].includes(request.state))
      return replayGenerationResponse(request, request.payloadHash, "video");
    if (request.errorCode === "animation-known-failure") {
      try {
        return await fail(stored);
      } catch {
        return pending(requestId, request, false);
      }
    }
    if (!request.generationId || !metadata?.animationReceipt)
      return pending(requestId, request, true);
    const token = randomUUID();
    if (!(await deps.lease(owner, token)))
      return pending(requestId, request, false);
    try {
      if (metadata.animationKnownFailure) return await fail(stored);
      const result = await deps.poll(metadata.animationReceipt);
      if (result.state === "pending") return pending(requestId, request, false);
      if (result.state === "failed") {
        await deps.rememberFailure(owner);
        return await fail(stored);
      }
      const output = await deps.materialize(userId, requestId, result.videoUrl);
      const provenance = {
        modelId: POLICY.modelId,
        provider: "fal.ai",
        providerRequestId: metadata.animationReceipt.providerRequestId,
        sourceGenerationId: metadata.sourceGenerationId,
        duration: 5,
        resolution: "480p",
        contentType: "video/mp4",
      };
      const response = {
        id: request.generationId,
        status: "completed" as const,
        requestId,
        mediaType: "video" as const,
        imageUrl: output.url,
        modelId: POLICY.modelId,
        creditCost: request.quotedCredits,
        newAchievements: [],
        provenance,
      };
      const completed = await deps.complete(owner, {
        result: response,
        imageUrl: output.url,
        thumbnailUrl: "",
        metadata: {
          tool: KIND,
          billingRequestId: requestId,
          sourceGenerationId: metadata.sourceGenerationId,
          provenance,
          fileKey: output.key,
        },
      });
      return completed.kind === "completed" || completed.kind === "replay"
        ? replayGenerationResponse(
            completed.request,
            request.payloadHash,
            "video"
          )
        : pending(requestId, request, false);
    } catch (error) {
      if (error instanceof KnownAnimationFailure) {
        try {
          await deps.rememberFailure(owner);
          return await fail(stored);
        } catch {
          /* Saved receipt/known failure permits safe future status recovery. */
        }
      }
      return pending(requestId, request, false);
    } finally {
      await deps.release(owner, token).catch(() => undefined);
    }
  }
  async function start(userId: number, input: AnimationInput) {
    const payloadHash = hashAnimationInput(input);
    const prior = await deps.read(userId, input.requestId);
    if (prior) {
      if (prior.request.payloadHash !== payloadHash)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "This request ID belongs to another operation. Keep its original input.",
        });
      return status(userId, input.requestId);
    }
    if (!deps.configured())
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message:
          "Image animation is currently unavailable. No credits charged.",
      });
    if (input.expectedCreditCost !== POLICY.creditCost)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "The animation quote changed. Review the current price before starting. No credits charged.",
      });
    if (!hasWorkspaceModelAccess(await deps.tier(userId), POLICY.requiredTier))
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Image animation requires Creator or higher. No credits charged.",
      });
    await deps.active();
    const source = await deps.source(userId, input.generationId);
    const verdict = checkPrompt(`${input.prompt}\n${source.prompt}`, {
      strictMinors: false,
    });
    if (!verdict.allowed)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: verdict.userMessage,
      });
    if (isSexualPrompt(input.prompt, source.prompt))
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Image animation supports standard, non-explicit images and motion prompts.",
      });
    const claim = await deps.claim({
      userId,
      requestId: input.requestId,
      payloadHash,
      credits: POLICY.creditCost,
      rejectedResult: {
        tool: KIND,
        requestId: input.requestId,
        mediaType: "video",
        status: "failed",
        creditCost: 0,
        error: "Insufficient credits for image animation.",
      },
    });
    if (claim.kind === "conflict")
      throw new TRPCError({
        code: "CONFLICT",
        message: "This request ID belongs to another operation.",
      });
    if (claim.kind === "replay")
      return replayGenerationResponse(claim.request, payloadHash, "video");
    if (claim.kind !== "owned")
      return pending(input.requestId, undefined, true);
    const { owner } = claim;
    let generationId: number | undefined;
    let invoked = false;
    try {
      generationId = await deps.createOutput(owner, input, source);
      const begun = await deps.begin(owner, generationId);
      if (begun.kind !== "begun")
        return pending(
          input.requestId,
          begun.kind === "replay" ? begun.request : undefined,
          true
        );
      invoked = true;
      const receipt = await deps.submit(source.dataUri, input.prompt.trim());
      try {
        if (!(await deps.receipt(owner, receipt)))
          return pending(input.requestId, begun.request, true);
      } catch {
        const recovered = await deps
          .read(userId, input.requestId)
          .catch(() => null);
        if (!recovered?.metadata?.animationReceipt)
          throw new Error("Animation receipt persistence needs review.");
      }
      return pending(input.requestId, begun.request);
    } catch (error) {
      if (!invoked || error instanceof KnownAnimationFailure) {
        try {
          await deps.rememberFailure(owner);
          return await fail({
            owner,
            request: { ...claim.request, generationId: generationId ?? null },
          });
        } catch {
          /* Retrying the same identity must not invoke again. */
        }
        await deps
          .reconcile(owner, {
            errorCode: "animation-known-failure",
            generationId,
          })
          .catch(() => undefined);
        return pending(
          input.requestId,
          { ...claim.request, generationId: generationId ?? null },
          true
        );
      }
      await deps
        .reconcile(owner, {
          errorCode: "animation-outcome-uncertain",
          generationId,
        })
        .catch(() => undefined);
      return pending(
        input.requestId,
        { ...claim.request, generationId: generationId ?? null },
        true
      );
    }
  }
  return { start, status };
}

export const imageAnimationService = createImageAnimationService({
  configured: () => !!ENV.falApiKey,
  tier: animationTier,
  source: prepareAnimationSource,
  read: readAnimationRequest,
  claim: claimGenerationRequest,
  createOutput: createAnimationOutput,
  begin: beginGenerationRequest,
  receipt: saveAnimationReceipt,
  lease: acquireAnimationPoll,
  release: releaseAnimationPoll,
  rememberFailure: rememberAnimationFailure,
  submit: submitImageAnimation,
  poll: pollImageAnimation,
  materialize: materializeAnimation,
  complete: completeGenerationRequest,
  fail: failGenerationRequestAndRefund,
  reconcile: markGenerationReconciliation,
  active: async () => {
    await assertPrivateStorage();
    await requireToolActive("animate");
  },
});

/** Resume a bounded number of saved receipts after the browser has closed.
 * This path can only poll/copy/refund; it never submits provider work. */
export async function sweepImageAnimations(limit = 2) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2)
    throw new Error("Animation recovery is limited to one or two requests.");
  const candidates =
    await execute(sql`/* animation:recovery-candidates */ SELECT r."userId", r."requestId" FROM "generationRequests" r
    JOIN users u ON u.id = r."userId" LEFT JOIN generations g ON g.id = r."generationId" AND g."userId" = r."userId"
    WHERE r.state IN ('reserved','rendering','reconciliation') AND COALESCE(r."errorCode", '') <> 'account-deleted' AND ${activeOwner}
      AND ((g.metadata->>'tool' = ${KIND} AND g.metadata->'animationReceipt' IS NOT NULL) OR r."errorCode" = 'animation-known-failure')
    ORDER BY COALESCE(g."updatedAt", r."updatedAt") ASC LIMIT ${limit}`);
  const report = { checked: 0, completed: 0, failed: 0, pending: 0, errors: 0 };
  for (const row of candidates) {
    report.checked++;
    try {
      const result = await imageAnimationService.status(
        Number(row.userId),
        String(row.requestId)
      );
      if (result.status === "completed") report.completed++;
      else if (result.status === "failed") report.failed++;
      else report.pending++;
    } catch {
      report.errors++;
    }
  }
  return report;
}
