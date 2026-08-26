/**
 * BTCPay Server client (shared PayMohawk instance at btc.paymohawk.com).
 *
 * Crypto rail for the Uncensored tier ONLY. Stripe handles every SFW plan;
 * adult-content revenue must never touch Stripe (AUP termination risk), so
 * the uncensored entitlement is sold exclusively through BTCPay invoices.
 *
 * Store "DreamForgeX" provisioned 2026-06-12 via Greenfield API.
 * Ported from the golden-climax integration (HMAC verify pattern).
 *
 * Live payment methods (verified 2026-07-31): BTC-CHAIN only.
 * Lightning / USDC require operator enablement on the BTCPay store —
 * see marketing/OPERATOR-BATCH.md.
 */
import crypto from "crypto";
import {
  UNCENSORED_PLAN,
  UNCENSORED_PLANS,
  getUncensoredPlanById,
  type UncensoredPlan,
} from "../../shared/uncensoredPlans";

export type { UncensoredPlan };
export { UNCENSORED_PLAN, UNCENSORED_PLANS, getUncensoredPlanById };

// On-chain BTC confirmations can take >60 min under congestion. Store default
// is 60 min; we extend so impulse day-pass buyers don't lose the invoice mid-mempool.
const INVOICE_EXPIRATION_MINUTES = 180;
const INVOICE_MONITORING_MINUTES = 24 * 60;

export function isBtcpayConfigured(): boolean {
  return !!(process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID);
}

export interface BTCPayInvoice {
  invoiceId: string;
  checkoutLink: string;
}

export async function createUncensoredInvoice(params: {
  userId: number;
  email: string | null;
  redirectUrl: string;
  planId?: string;
}): Promise<BTCPayInvoice> {
  const url = process.env.BTCPAY_URL;
  const apiKey = process.env.BTCPAY_API_KEY;
  const storeId = process.env.BTCPAY_STORE_ID;
  if (!url || !apiKey || !storeId) {
    throw new Error("BTCPay Server credentials not configured");
  }

  const plan = getUncensoredPlanById(params.planId);
  const body = {
    amount: plan.priceUsd.toFixed(2),
    currency: "USD",
    metadata: {
      userId: String(params.userId),
      plan: plan.id,
      buyerEmail: params.email ?? undefined,
    },
    checkout: {
      redirectURL: params.redirectUrl,
      redirectAutomatically: true,
      defaultLanguage: "en",
      // On-chain BTC needs headroom; Lightning (when enabled) settles instantly
      // but still benefits from a long window if the buyer pauses mid-flow.
      expirationMinutes: INVOICE_EXPIRATION_MINUTES,
      monitoringExpiration: INVOICE_MONITORING_MINUTES,
      // Settle at 0-conf (mempool), not after a block.
      //
      // Measured on the two real settlements to date (2026-08-06 $12,
      // 2026-08-15 $4.99): both buyers broadcast within 28s–4min of the
      // invoice opening — this audience holds BTC and pays immediately — then
      // sat through a 7m09s / 6m45s dead wait for the first confirmation
      // before access unlocked. That wait is p50; under congestion the tail
      // runs past an hour. For an instant-delivery digital good it is the
      // single largest source of drop-off, and it is pure loss: the money is
      // already broadcast.
      //
      // Double-spend exposure is bounded ($4.99–$19 of generation credit) and
      // no longer silent: the InvoiceInvalid branch of the webhook now revokes
      // the entitlement and the bonus credits if the payment never confirms.
      speedPolicy: "HighSpeed",
    },
    receipt: { enabled: true, showQR: true, showPayments: true },
  };

  const response = await fetch(`${url}/api/v1/stores/${storeId}/invoices`, {
    method: "POST",
    headers: { Authorization: `token ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error(`[BTCPay] Invoice creation failed (${response.status}):`, errText);
    throw new Error(`BTCPay invoice creation failed: ${response.status}`);
  }
  const invoice = await response.json();
  return { invoiceId: invoice.id as string, checkoutLink: invoice.checkoutLink as string };
}

/** Verify the BTCPay-Sig HMAC header against the raw request body. */
export function verifyBTCPayWebhook(body: string, signature: string): boolean {
  const secret = process.env.BTCPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expectedSig = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(body)
    .digest("hex");

  // BTCPay sends signature as "sha256=XXXX".
  const cleanSig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  // timingSafeEqual throws on length mismatch — a malformed header must be a
  // clean 401, not a 500.
  const expectedBuf = Buffer.from(expectedSig, "hex");
  const actualBuf = Buffer.from(cleanSig, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
