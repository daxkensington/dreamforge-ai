import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "./db";
import { walletRows } from "./_core/walletAccounting";
import { getOrCreateBalance } from "./stripe";
import type { TrainingJob } from "../drizzle/schema";
import {
  getTrainingCredits,
  TRAINING_POLICY,
  type TrainingType,
} from "../shared/training";

async function database() {
  const db = await getDb();
  if (!db)
    throw new Error("Training is temporarily unavailable. Please try again.");
  return db;
}
// Use the same eligible-history ordering as subscriptionSelection. Agency is not
// inferred from an old plan name, a canceled subscription, or a missing period.
export const trainingAgencyPredicate = (userId: number) => sql`'agency' = (
  SELECT p.name FROM "userSubscriptions" s JOIN "subscriptionPlans" p ON p.id = s."planId"
  WHERE s."userId" = ${userId} AND s."subStatus" IN ('active','trialing')
    AND s."currentPeriodStart" <= (statement_timestamp() AT TIME ZONE 'UTC')
    AND s."currentPeriodEnd" > (statement_timestamp() AT TIME ZONE 'UTC')
    AND p.name IN ('creator','pro','studio','business','agency','enterprise')
  ORDER BY s."createdAt" DESC, s.id DESC LIMIT 1)`;
export async function isTrainingEligible(userId: number) {
  const db = await database();
  return !!walletRows(
    await db.execute(sql`SELECT id FROM users WHERE id = ${userId}
    AND "loginMethod" IS DISTINCT FROM 'deleted' AND ${trainingAgencyPredicate(userId)}`)
  )[0];
}
export async function getTrainingJob(
  userId: number,
  id: number
): Promise<TrainingJob | undefined> {
  const db = await database();
  return walletRows(
    await db.execute(sql`SELECT t.* FROM "trainingJobs" t JOIN users u ON u.id=t."userId"
    WHERE t.id=${id} AND t."userId"=${userId} AND t."deletedAt" IS NULL AND u."loginMethod" IS DISTINCT FROM 'deleted'`)
  )[0];
}
export async function listTrainingJobs(userId: number): Promise<TrainingJob[]> {
  const db = await database();
  return walletRows(
    await db.execute(sql`SELECT t.* FROM "trainingJobs" t JOIN users u ON u.id=t."userId"
    WHERE t."userId"=${userId} AND t."deletedAt" IS NULL AND u."loginMethod" IS DISTINCT FROM 'deleted'
    ORDER BY CASE WHEN t.state NOT IN ('failed','canceled','deleted','rejected') THEN 0 ELSE 1 END,t.id DESC LIMIT 50`)
  );
}
const validTrainingImages = (
  userId: number,
  imageKeys: string[]
) => sql`SELECT m.key FROM "mediaAssets" m
  JOIN "mediaUploads" upload ON upload.key=m.key AND upload."userId"=m."ownerUserId"
  JOIN users u ON u.id=m."ownerUserId"
  WHERE m.key IN (SELECT jsonb_array_elements_text(${JSON.stringify(imageKeys)}::jsonb))
    AND m."ownerUserId"=${userId} AND m."isPrivate"=true AND m."revokedAt" IS NULL AND m."deletedAt" IS NULL
    AND m."createdAt">now()-interval '24 hours' AND u."loginMethod" IS DISTINCT FROM 'deleted'
    AND upload.purpose='training' AND upload.state='completed' AND upload.size<=${TRAINING_POLICY.uploadMaxBytes}
    AND upload."contentType" IN ('image/jpeg','image/png','image/webp')`;
export async function assertTrainingImages(
  userId: number,
  imageKeys: string[]
) {
  if (
    new Set(imageKeys).size !== imageKeys.length ||
    imageKeys.length < 5 ||
    imageKeys.length > 20
  )
    throw new Error("Choose 5–20 different uploaded images.");
  const db = await database();
  const owned = walletRows(
    await db.execute(validTrainingImages(userId, imageKeys))
  );
  if (owned.length !== imageKeys.length)
    throw new Error(
      "Training images must be your private uploads from the last 24 hours. Upload them again."
    );
}
export async function createTrainingJob(
  userId: number,
  input: {
    requestId: string;
    payloadHash: string;
    name: string;
    type: TrainingType;
    triggerWord: string;
    steps: number;
    imageKeys: string[];
  }
): Promise<TrainingJob> {
  const db = await database();
  const read = async () =>
    walletRows(
      await db.execute(
        sql`SELECT * FROM "trainingJobs" WHERE "userId"=${userId} AND "requestId"=${input.requestId}::uuid`
      )
    )[0] as TrainingJob | undefined;
  const prior = await read();
  if (prior) {
    if (prior.payloadHash !== input.payloadHash || prior.deletedAt)
      throw new Error(
        "This request was already used. Start a new training request."
      );
    return prior;
  }
  await assertTrainingImages(userId, input.imageKeys);
  await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(
      sql`SELECT id FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted' FOR UPDATE`
    ),
    db.execute(sql`INSERT INTO "trainingJobs" ("userId","requestId","payloadHash",name,"trainingType","triggerWord",steps,"imageKeys","executionToken","quotedCredits","expiresAt")
      SELECT ${userId},${input.requestId}::uuid,${input.payloadHash},${input.name},${input.type},${input.triggerWord},${input.steps},${JSON.stringify(input.imageKeys)}::jsonb,${randomUUID()}::uuid,${getTrainingCredits(input.steps)},
        (SELECT min("createdAt")+interval '24 hours' FROM "mediaAssets" WHERE key IN (SELECT jsonb_array_elements_text(${JSON.stringify(input.imageKeys)}::jsonb)))
      WHERE ${trainingAgencyPredicate(userId)} AND EXISTS (SELECT 1 FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted')
        AND (SELECT count(*) FROM (${validTrainingImages(userId, input.imageKeys)}) valid_images)=${input.imageKeys.length}
        AND (SELECT count(*) FROM "trainingJobs" WHERE "userId"=${userId} AND state NOT IN ('failed','canceled','deleted','rejected')) < ${TRAINING_POLICY.savedSlots}
      ON CONFLICT ("userId","requestId") DO NOTHING`),
  ] as any);
  const saved = await read();
  if (!saved) {
    await assertTrainingImages(userId, input.imageKeys);
    throw new Error(
      "An active Agency plan and a free model slot are required. Delete a saved model to free a slot."
    );
  }
  if (saved.payloadHash !== input.payloadHash)
    throw new Error(
      "This request was already used. Start a new training request."
    );
  return saved;
}

export async function claimTrainingPreparation(userId: number, id: number) {
  const db = await database();
  const token = randomUUID();
  const job = walletRows(
    await db.execute(sql`UPDATE "trainingJobs" SET state='preparing',"leaseToken"=${token}::uuid,"leaseUntil"=now()+interval '5 minutes',"errorCode"=NULL,"updatedAt"=now()
    WHERE id=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND "expiresAt">now() AND ${trainingAgencyPredicate(userId)}
      AND (state='draft' OR (state='preparing' AND "leaseUntil"<now())) RETURNING *`)
  )[0] as TrainingJob | undefined;
  return job ? { job, token } : undefined;
}
export async function finishTrainingPreparation(
  userId: number,
  id: number,
  token: string,
  archiveKey: string | null
) {
  const db = await database();
  return (
    walletRows(
      await db.execute(sql`UPDATE "trainingJobs" SET state=${archiveKey ? "ready_to_submit" : "draft"},"archiveKey"=${archiveKey},"leaseToken"=NULL,"leaseUntil"=NULL,
    "errorCode"=${archiveKey ? null : "image_preparation_failed"},"updatedAt"=now() WHERE id=${id} AND "userId"=${userId} AND "leaseToken"=${token}::uuid AND state='preparing' AND "deletedAt" IS NULL RETURNING id`)
    ).length === 1
  );
}

/** The state fence, wallet debit and immutable receipt commit in one statement. */
export async function claimTrainingSubmission(userId: number, id: number) {
  // Preserve the existing verified monthly allowance and daily grant policy.
  await getOrCreateBalance(userId);
  const db = await database();
  const rows = walletRows(
    await db.execute(sql`
    WITH job AS (SELECT * FROM "trainingJobs" WHERE id=${id} AND "userId"=${userId} AND state='ready_to_submit'
      AND "deletedAt" IS NULL AND "debitedAt" IS NULL AND "expiresAt">now() AND ${trainingAgencyPredicate(userId)} FOR UPDATE),
    locked AS (SELECT cb.* FROM "creditBalances" cb WHERE cb."userId"=${userId} AND EXISTS(SELECT 1 FROM job) FOR UPDATE),
    wallet AS (UPDATE "creditBalances" cb SET balance=l.balance-j."quotedCredits",
      "bonusCredits"=CASE WHEN l."walletAccountingVersion"=1 THEN LEAST(l."bonusCredits",GREATEST(l.balance-j."quotedCredits",0)) ELSE l."bonusCredits" END,
      "lifetimeSpent"=l."lifetimeSpent"+j."quotedCredits","updatedAt"=now()
      FROM locked l,job j WHERE cb.id=l.id AND l.balance>=j."quotedCredits"
        AND EXISTS(SELECT 1 FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted')
      RETURNING cb.id,CASE WHEN l."walletAccountingVersion"=1 THEN l."bonusCredits"-cb."bonusCredits" ELSE 0 END AS purchased),
    ledger AS (INSERT INTO "creditTransactions" ("userId",amount,"txType",description,"txMetadata")
      SELECT ${userId},-j."quotedCredits",'usage','Custom model training',jsonb_build_object('trainingJobId',j.id,'requestId',j."requestId",'purchasedCreditsDebited',w.purchased)
      FROM job j CROSS JOIN wallet w RETURNING id),
    claimed AS (UPDATE "trainingJobs" t SET state='submitting',"debitedAt"=now(),"debitTransactionId"=l.id,"purchasedCreditsDebited"=w.purchased,"updatedAt"=now()
      FROM job j,wallet w,ledger l WHERE t.id=j.id RETURNING t.*) SELECT * FROM claimed`)
  );
  return rows[0] as TrainingJob | undefined;
}
export async function updateTrainingJob(
  userId: number,
  id: number,
  allowed: string[],
  values: SQL
) {
  const db = await database();
  return walletRows(
    await db.execute(sql`UPDATE "trainingJobs" SET ${values},"updatedAt"=now() WHERE id=${id} AND "userId"=${userId}
    AND "deletedAt" IS NULL AND state IN (SELECT jsonb_array_elements_text(${JSON.stringify(allowed)}::jsonb)) RETURNING *`)
  )[0] as TrainingJob | undefined;
}
export async function refundTrainingJob(
  userId: number,
  id: number,
  reason: string,
  allowed: string[]
) {
  const db = await database();
  return walletRows(
    await db.execute(sql`
    WITH job AS (SELECT * FROM "trainingJobs" WHERE id=${id} AND "userId"=${userId} AND "deletedAt" IS NULL
      AND "debitedAt" IS NOT NULL AND "refundedAt" IS NULL AND state IN (SELECT jsonb_array_elements_text(${JSON.stringify(allowed)}::jsonb)) FOR UPDATE),
    wallet AS (UPDATE "creditBalances" cb SET balance=cb.balance+j."quotedCredits",
      "bonusCredits"=cb."bonusCredits"+CASE WHEN cb."walletAccountingVersion"=1 THEN j."purchasedCreditsDebited" ELSE 0 END,
      "lifetimeSpent"=GREATEST(0,cb."lifetimeSpent"-j."quotedCredits"),"updatedAt"=now() FROM job j
      WHERE cb."userId"=j."userId" AND EXISTS(SELECT 1 FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted') RETURNING cb.id),
    ledger AS (INSERT INTO "creditTransactions" ("userId",amount,"txType",description,"txMetadata")
      SELECT j."userId",j."quotedCredits",'refund','Custom model training refund',jsonb_build_object('trainingJobId',j.id,'requestId',j."requestId",'purchasedCreditsRestored',j."purchasedCreditsDebited")
      FROM job j CROSS JOIN wallet w RETURNING id),
    refunded AS (UPDATE "trainingJobs" t SET state='failed',"refundedAt"=now(),"errorCode"=${reason},"leaseUntil"=NULL,"leaseToken"=NULL,"updatedAt"=now()
      FROM job j WHERE t.id=j.id AND EXISTS(SELECT 1 FROM ledger) RETURNING t.*) SELECT * FROM refunded`)
  )[0] as TrainingJob | undefined;
}
export async function acquireTrainingPoll(userId: number, id: number) {
  const db = await database(),
    token = randomUUID();
  const job = walletRows(
    await db.execute(sql`UPDATE "trainingJobs" SET "leaseToken"=${token}::uuid,"leaseUntil"=now()+interval '3 minutes'
    WHERE id=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND state IN ('queued','training','cancel_requested')
      AND ("leaseUntil" IS NULL OR "leaseUntil"<now()) RETURNING *`)
  )[0] as TrainingJob | undefined;
  return job ? { job, token } : undefined;
}
export async function releaseTrainingPoll(
  userId: number,
  id: number,
  token: string
) {
  const db = await database();
  await db.execute(
    sql`UPDATE "trainingJobs" SET "leaseToken"=NULL,"leaseUntil"=NULL WHERE id=${id} AND "userId"=${userId} AND "deletedAt" IS NULL AND "leaseToken"=${token}::uuid`
  );
}
export async function deleteTrainingJob(userId: number, id: number) {
  const db = await database();
  const mayDelete = sql`NOT EXISTS(${pendingTrainingImagesSql(userId, id)}) AND EXISTS(SELECT 1 FROM "trainingJobs" target
    WHERE target.id=${id} AND target."userId"=${userId} AND target."deletedAt" IS NULL
      AND target.state NOT IN ('submitting','queued','training','cancel_requested','reconciliation'))`;
  await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(
      sql`SELECT id FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted' FOR UPDATE`
    ),
    db.execute(sql`UPDATE "mediaAssets" SET "revokedAt"=COALESCE("revokedAt",now()),"deleteReason"='training-deleted',"deletedAt"=NULL
      WHERE ${mayDelete} AND "ownerUserId"=${userId} AND key IN (SELECT "archiveKey" FROM "trainingJobs" WHERE id=${id} AND "userId"=${userId}
        UNION SELECT "modelKey" FROM "trainingJobs" WHERE id=${id} AND "userId"=${userId})`),
    db.execute(sql`UPDATE "mediaAssets" m SET "revokedAt"=COALESCE(m."revokedAt",now()),"deleteReason"='training-deleted',"deletedAt"=NULL
      WHERE ${mayDelete} AND m."ownerUserId"=${userId} AND m.key IN (SELECT jsonb_array_elements_text("imageKeys") FROM "trainingJobs" WHERE id=${id} AND "userId"=${userId})
        AND EXISTS(SELECT 1 FROM "mediaUploads" upload WHERE upload.key=m.key AND upload."userId"=${userId} AND upload.purpose='training')
        AND NOT EXISTS(SELECT 1 FROM "trainingJobs" other WHERE other."userId"=${userId} AND other.id<>${id} AND other."deletedAt" IS NULL
          AND other.state NOT IN ('failed','canceled','deleted','rejected') AND other."imageKeys" ? m.key)`),
    trainingDeletionQuery(db, userId, id, mayDelete),
  ] as any);
  if (await getTrainingJob(userId, id))
    throw new Error(
      "Finish or resolve active requests before deleting this model."
    );
}
const pendingTrainingImagesSql = (
  userId: number,
  id: number
) => sql`SELECT g.id FROM generations g JOIN "generationRequests" r ON r."generationId"=g.id AND r."userId"=g."userId"
  WHERE g."userId"=${userId} AND g.status IN ('pending','generating') AND g.metadata->>'trainedModelId'=${String(id)}
    AND r.state IN ('reserved','rendering','reconciliation') LIMIT 1`;
export async function hasPendingTrainingImages(userId: number, id: number) {
  const db = await database();
  return !!walletRows(
    await db.execute(pendingTrainingImagesSql(userId, id))
  )[0];
}
/** Discard form uploads without revoking another saved dataset. */
export async function discardTrainingImages(
  userId: number,
  imageKeys: string[]
) {
  const db = await database();
  const result: any = await db.batch([
    db.execute(sql`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`),
    db.execute(
      sql`SELECT id FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted' FOR UPDATE`
    ),
    db.execute(sql`UPDATE "mediaAssets" m SET "revokedAt"=COALESCE(m."revokedAt",now()),"deletedAt"=NULL,"deleteReason"='training-upload-discarded'
      WHERE m."ownerUserId"=${userId} AND m."isPrivate"=true AND m.key IN (SELECT jsonb_array_elements_text(${JSON.stringify(imageKeys)}::jsonb))
        AND EXISTS(SELECT 1 FROM "mediaUploads" upload WHERE upload.key=m.key AND upload."userId"=${userId} AND upload.purpose='training')
        AND EXISTS(SELECT 1 FROM users WHERE id=${userId} AND "loginMethod" IS DISTINCT FROM 'deleted')
        AND NOT EXISTS(SELECT 1 FROM "trainingJobs" other WHERE other."userId"=${userId} AND other."deletedAt" IS NULL
          AND other.state NOT IN ('failed','canceled','deleted','rejected') AND other."imageKeys" ? m.key) RETURNING m.key`),
  ] as any);
  return { discarded: walletRows(result[result.length - 1]).length };
}
/** Insert into the account deletion transaction after locking users FOR UPDATE. */
export function trainingDeletionQuery(
  db: any,
  userId: number,
  id?: number,
  guard: SQL = sql`true`
) {
  return db.execute(sql`UPDATE "trainingJobs" SET state='deleted',"deletedAt"=now(),name='[deleted]',"triggerWord"='deleted',"imageKeys"='[]'::jsonb,
    "archiveKey"=NULL,"modelKey"=NULL,"providerRequestId"=NULL,"statusUrl"=NULL,"responseUrl"=NULL,"cancelUrl"=NULL,
    "leaseToken"=NULL,"leaseUntil"=NULL,"errorCode"='account-or-model-deleted',"updatedAt"=now()
    WHERE "userId"=${userId} ${id === undefined ? sql`` : sql`AND id=${id}`} AND ${guard} AND "deletedAt" IS NULL`);
}
export function trainingDeletionQueries(db: any, userId: number) {
  return [trainingDeletionQuery(db, userId)];
}
