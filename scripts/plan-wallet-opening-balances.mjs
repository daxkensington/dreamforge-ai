/** Dry-run only. Input: sanitized wallet snapshot JSON and independently reviewed opening balances JSON.
 * No database client, credentials, network, or execution mode exists in this script. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const [snapshotPath, reviewsPath, outputPath] = args;
if (args.length !== 3 || args.some(value => !value))
  throw new Error(
    "Usage: node scripts/plan-wallet-opening-balances.mjs snapshot.json reviews.json plan.json (dry-run only; no execution mode)"
  );
const normalizedPath = value =>
  process.platform === "win32"
    ? path.resolve(value).toLowerCase()
    : path.resolve(value);
if (
  [snapshotPath, reviewsPath].some(
    value => normalizedPath(value) === normalizedPath(outputPath)
  )
)
  throw new Error("The output must not overwrite either input evidence file.");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const reviews = JSON.parse(await readFile(reviewsPath, "utf8"));
if (!Array.isArray(snapshot) || !Array.isArray(reviews))
  throw new Error("Snapshot and reviews must be arrays.");
const seen = new Set();
const plan = [];
const blocked = [];
const excluded = [];
const alreadyCurrent = [];
const integer = value =>
  Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
const text = (value, max = 512) =>
  typeof value === "string" &&
  value.length <= max &&
  value.trim().length > 0 &&
  value.trim() === value;
const utcTimestamp = value => {
  if (
    typeof value !== "string" ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)
  )
    return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 19) === value.slice(0, 19)
  );
};
const timestampKey = value =>
  `${value.slice(0, 19)}.${(value.split(".")[1]?.slice(0, -1) ?? "").padEnd(6, "0")}Z`;
const uniquePositiveIds = value =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 10_000 &&
  value.every(id => integer(id) && id > 0) &&
  new Set(value).size === value.length;
const uniqueReferences = value =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= 20 &&
  value.every(ref => text(ref)) &&
  new Set(value).size === value.length;

for (const wallet of snapshot) {
  if (
    !wallet ||
    typeof wallet !== "object" ||
    !integer(wallet.userId) ||
    wallet.userId < 1 ||
    !Number.isSafeInteger(wallet.balance) ||
    wallet.balance < -2_147_483_648 ||
    wallet.balance > 2_147_483_647 ||
    !integer(wallet.lifetimeSpent) ||
    !integer(wallet.bonusCredits)
  )
    throw new Error("Invalid sanitized wallet snapshot.");
  if (seen.has(wallet.userId)) throw new Error("Duplicate wallet in snapshot.");
  seen.add(wallet.userId);
  if (wallet.ownerState !== "live" && wallet.ownerState !== "deleted") {
    blocked.push({
      userId: wallet.userId,
      reason:
        "Explicit joined ownerState evidence (live or deleted) is required",
    });
    continue;
  }
  if (wallet.ownerState === "deleted") {
    excluded.push({
      userId: wallet.userId,
      ownerState: "deleted",
      preservedBalance: wallet.balance,
      reason:
        "Deleted owner: preserve account and financial fences; no wallet update planned",
    });
    continue;
  }
  if (wallet.walletAccountingVersion === 1) {
    alreadyCurrent.push({
      userId: wallet.userId,
      ownerState: "live",
      reason: "Wallet is already accounting version 1; no update planned",
    });
    continue;
  }
  if (wallet.walletAccountingVersion !== 0 || !utcTimestamp(wallet.updatedAt))
    throw new Error(
      "Accounting version 0 and an exact UTC updatedAt snapshot (up to six fractional digits) are required."
    );
  const matches = reviews.filter(
    review => review && review.userId === wallet.userId
  );
  const review = matches[0];
  if (
    matches.length !== 1 ||
    !review ||
    review.approved !== true ||
    !text(review.reviewer, 128) ||
    review.expectedUpdatedAt !== wallet.updatedAt ||
    review.expectedBalance !== wallet.balance ||
    review.expectedBonusCredits !== wallet.bonusCredits ||
    review.expectedLifetimeSpent !== wallet.lifetimeSpent ||
    !integer(review.purchasedRemaining) ||
    review.purchasedRemaining > Math.max(wallet.balance, 0)
  ) {
    blocked.push({
      userId: wallet.userId,
      reason:
        "Independent approved provenance and matching opening snapshot required",
    });
    continue;
  }
  let evidenceMode, evidenceGuard, absenceEvidence;
  if (Object.hasOwn(review, "absenceEvidence")) {
    const evidence = review.absenceEvidence;
    if (
      review.purchasedRemaining !== 0 ||
      !Array.isArray(review.evidenceTransactionIds) ||
      review.evidenceTransactionIds.length !== 0 ||
      wallet.ledgerRowCount !== 0 ||
      !text(wallet.ledgerEvidenceId) ||
      !utcTimestamp(wallet.ledgerVerifiedAt) ||
      timestampKey(wallet.ledgerVerifiedAt) < timestampKey(wallet.updatedAt) ||
      !evidence ||
      evidence.kind !== "reviewed-zero-purchased-without-ledger" ||
      evidence.ledgerRowCount !== 0 ||
      evidence.ledgerEvidenceId !== wallet.ledgerEvidenceId ||
      evidence.ledgerVerifiedAt !== wallet.ledgerVerifiedAt ||
      evidence.zeroRemainingPurchasedApproved !== true ||
      !text(evidence.rationale, 2000) ||
      !uniqueReferences(evidence.independentEvidenceRefs) ||
      !evidence.independentEvidenceRefs.some(
        ref => ref !== wallet.ledgerEvidenceId
      )
    ) {
      blocked.push({
        userId: wallet.userId,
        reason:
          "Absence review requires exact captured zero-ledger evidence, independent zero-purchased approval and supporting references; absence alone is not payment evidence",
      });
      continue;
    }
    evidenceMode = "reviewed-absence";
    absenceEvidence = {
      kind: evidence.kind,
      ledgerRowCount: 0,
      ledgerEvidenceId: evidence.ledgerEvidenceId,
      ledgerVerifiedAt: evidence.ledgerVerifiedAt,
      zeroRemainingPurchasedApproved: true,
      rationale: evidence.rationale,
      independentEvidenceRefs: [...evidence.independentEvidenceRefs],
    };
    evidenceGuard = `NOT EXISTS (SELECT 1 FROM "creditTransactions" evidence WHERE evidence."userId" = cb."userId")`;
  } else {
    if (
      !uniquePositiveIds(review.evidenceTransactionIds) ||
      (Object.hasOwn(wallet, "ledgerRowCount") &&
        (!integer(wallet.ledgerRowCount) ||
          wallet.ledgerRowCount < review.evidenceTransactionIds.length))
    ) {
      blocked.push({
        userId: wallet.userId,
        reason:
          "A nonempty unique list of positive transaction evidence IDs is required; use a separately approved absence review only for a verified zero-ledger wallet",
      });
      continue;
    }
    evidenceMode = "transaction-ledger";
    evidenceGuard = `(SELECT count(*) FROM "creditTransactions" evidence WHERE evidence."userId" = cb."userId" AND evidence.id IN (${review.evidenceTransactionIds.join(", ")})) = ${review.evidenceTransactionIds.length}`;
  }
  plan.push({
    userId: wallet.userId,
    reviewer: review.reviewer,
    evidenceMode,
    evidenceTransactionIds: [...review.evidenceTransactionIds],
    ...(absenceEvidence ? { absenceEvidence } : {}),
    expectedSnapshot: {
      ownerState: "live",
      walletAccountingVersion: 0,
      balance: wallet.balance,
      bonusCredits: wallet.bonusCredits,
      lifetimeSpent: wallet.lifetimeSpent,
      updatedAt: wallet.updatedAt,
    },
    preservedBalance: wallet.balance,
    purchasedRemaining: review.purchasedRemaining,
    // These are reviewable statements, never executed by this program. The live
    // owner lock closes the deletion race even before migration16's triggers.
    // Preserve timestamp microseconds: converting through Date would truncate them.
    sql: `WITH live_owner AS MATERIALIZED (SELECT id FROM users WHERE id = ${wallet.userId} AND "loginMethod" IS DISTINCT FROM 'deleted' FOR SHARE) UPDATE "creditBalances" cb SET "bonusCredits" = ${review.purchasedRemaining}, "walletAccountingVersion" = 1 WHERE cb."userId" = ${wallet.userId} AND cb."walletAccountingVersion" = 0 AND cb.balance = ${wallet.balance} AND cb."lifetimeSpent" = ${wallet.lifetimeSpent} AND cb."bonusCredits" = ${wallet.bonusCredits} AND cb."updatedAt" = ('${wallet.updatedAt}'::timestamptz AT TIME ZONE 'UTC') AND EXISTS (SELECT 1 FROM live_owner) AND ${evidenceGuard} RETURNING cb."userId";`,
  });
}
await writeFile(
  outputPath,
  JSON.stringify(
    {
      dryRun: true,
      executionSupported: false,
      releaseBlocked: blocked.length > 0,
      instructions:
        "This file is not production execution approval. Independently review provenance and cohort completeness; missing ledger is not proof of unpaid status. Keep deleted owners excluded. Quiesce legacy wallet-affecting writes through compatible application cutover, refresh stale snapshots and ledger evidence, and obtain separate approval before one transaction with an exact one-row assertion per approved live wallet. Preserve all balances, lifetime totals and immutable ledger rows.",
      plan,
      blocked,
      excluded,
      alreadyCurrent,
    },
    null,
    2
  ) + "\n",
  { flag: "wx" }
);
process.stdout.write(
  `Dry-run plan written: ${plan.length} reviewed wallets, ${blocked.length} require review, ${excluded.length} deleted owners excluded. No database accessed or SQL executed.\n`
);
