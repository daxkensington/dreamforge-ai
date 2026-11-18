import { TRPCError } from "@trpc/server";
import { refundCredits } from "../stripe";
import { hasWalletRefundReceipt } from "./walletAccounting";

type ToolDebit = { cost: number; transactionId?: number; purchasedCreditsDebited?: number };

/** Verify a caller-supplied stable refund key, including after a lost acknowledgement. */
export async function refundCreditsVerified(userId: number, amount: number, purchased: number, operationKey: string, reason: string) {
  try {
    const result = await refundCredits(userId, amount, reason, { purchasedCredits: purchased, operationKey });
    if (result.success && result.refunded === amount) return;
  } catch { /* The transaction may have committed despite a lost acknowledgement. */ }
  try {
    if (await hasWalletRefundReceipt(userId, amount, purchased, operationKey)) return;
  } catch { /* Unverified refunds must be reviewed. */ }
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Generation failed. Please contact support to review your credits." });
}

/** Restore the exact debit for a failed synchronous tool result, once per ledger entry. */
export async function refundFailedLegacyTool(userId: number, debit: ToolDebit, tool: string, keyPrefix: "legacy-tool-refund" | "legacy-refund" | "batch-refund" | "usage-refund" = "legacy-tool-refund", itemIndex?: number) {
  if (debit.cost === 0) return;
  if (!Number.isSafeInteger(debit.transactionId) || !debit.transactionId || debit.purchasedCreditsDebited === undefined) {
    console.error("[legacy-tool-refund] Missing debit provenance", { userId, tool, transactionId: debit.transactionId });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Generation failed. Please contact support to review your credits." });
  }
  if (itemIndex !== undefined && (!Number.isSafeInteger(itemIndex) || itemIndex < 0)) throw new Error("Invalid refund item index");
  const operationKey = `${keyPrefix}:${debit.transactionId}${itemIndex === undefined ? "" : `:${itemIndex}`}`;
  try {
    await refundCreditsVerified(userId, debit.cost, debit.purchasedCreditsDebited, operationKey, `Refund: ${tool} generation failed`);
  } catch (err) {
    console.error("[legacy-tool-refund] Refund not verified", { userId, tool, transactionId: debit.transactionId });
    throw err;
  }
}
