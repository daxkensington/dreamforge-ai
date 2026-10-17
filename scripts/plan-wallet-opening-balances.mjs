/** Dry-run only. Input: sanitized wallet snapshot JSON and independently reviewed opening balances JSON.
 * No database client, credentials, network, or execution mode exists in this script. */
import { readFile, writeFile } from "node:fs/promises";
const [snapshotPath, reviewsPath, outputPath] = process.argv.slice(2);
if (!snapshotPath || !reviewsPath || !outputPath) throw new Error("Usage: node scripts/plan-wallet-opening-balances.mjs snapshot.json reviews.json plan.json (dry-run only)");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const reviews = JSON.parse(await readFile(reviewsPath, "utf8"));
if (!Array.isArray(snapshot) || !Array.isArray(reviews)) throw new Error("Snapshot and reviews must be arrays.");
const seen = new Set();
const plan = [];
const blocked = [];
const integer = value => Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
for (const wallet of snapshot) {
  if (!integer(wallet.userId) || wallet.userId < 1 || !Number.isSafeInteger(wallet.balance) || !integer(wallet.lifetimeSpent) || !integer(wallet.bonusCredits)) throw new Error("Invalid sanitized wallet snapshot.");
  if (seen.has(wallet.userId)) throw new Error("Duplicate wallet in snapshot.");
  seen.add(wallet.userId);
  if (wallet.walletAccountingVersion === 1) continue;
  if (wallet.walletAccountingVersion !== 0 || typeof wallet.updatedAt !== "string" || !Number.isFinite(Date.parse(wallet.updatedAt))) throw new Error("Accounting version 0 and an exact updatedAt snapshot are required.");
  const matches = reviews.filter(review => review.userId === wallet.userId);
  const review = matches[0];
  if (matches.length !== 1 || !review || review.approved !== true || typeof review.reviewer !== "string" || !review.reviewer.trim()
    || !Array.isArray(review.evidenceTransactionIds) || !review.evidenceTransactionIds.length || !review.evidenceTransactionIds.every(id => integer(id) && id > 0)
    || review.expectedUpdatedAt !== wallet.updatedAt || review.expectedBalance !== wallet.balance || review.expectedLifetimeSpent !== wallet.lifetimeSpent
    || !integer(review.purchasedRemaining) || review.purchasedRemaining > Math.max(wallet.balance, 0)) {
    blocked.push({ userId: wallet.userId, reason: "Independent approved provenance and matching opening snapshot required" });
    continue;
  }
  plan.push({ userId: wallet.userId, reviewer: review.reviewer, evidenceTransactionIds: review.evidenceTransactionIds,
    preservedBalance: wallet.balance, purchasedRemaining: review.purchasedRemaining,
    // Row-count assertions and one transaction are mandatory when an operator executes an approved plan.
    sql: `UPDATE "creditBalances" SET "bonusCredits" = ${review.purchasedRemaining}, "walletAccountingVersion" = 1 WHERE "userId" = ${wallet.userId} AND "walletAccountingVersion" = 0 AND balance = ${wallet.balance} AND "lifetimeSpent" = ${wallet.lifetimeSpent} AND "bonusCredits" = ${wallet.bonusCredits} AND "updatedAt" = ('${new Date(wallet.updatedAt).toISOString()}'::timestamptz AT TIME ZONE 'UTC') RETURNING "userId";` });
}
await writeFile(outputPath, JSON.stringify({ dryRun: true, executionSupported: false, releaseBlocked: blocked.length > 0,
  instructions: "Review provenance independently; approve the exact snapshot and plan, execute separately with row-count assertions in a transaction. Never infer purchased credits from legacy bonusCredits alone. Refresh stale snapshots before execution.", plan, blocked }, null, 2) + "\n");
process.stdout.write(`Dry-run plan written: ${plan.length} reviewed wallets, ${blocked.length} require review. No database accessed.\n`);
