/**
 * BTCPay Server client (shared PayMohawk instance at btc.paymohawk.com).
 *
 * Crypto rail for the Uncensored tier ONLY. Stripe handles every SFW plan;
 * adult-content revenue must never touch Stripe (AUP termination risk), so
 * the uncensored entitlement is sold exclusively through BTCPay invoices.
 *
 * Store "DreamForgeX" provisioned 2026-06-12 via Greenfield API.
 * Ported from the golden-climax integration (HMAC verify pattern).
 */
import crypto from "crypto";

export const UNCENSORED_PLAN = {
  id: "uncensored-30d",
  label: "Uncensored Pass — 30 days",
  priceUsd: 19,
  bonusCredits: 500,
  durationDays: 30,
} as const;

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
}): Promise<BTCPayInvoice> {
  const url = process.env.BTCPAY_URL;
  const apiKey = process.env.BTCPAY_API_KEY;
  const storeId = process.env.BTCPAY_STORE_ID;
  if (!url || !apiKey || !storeId) {
    throw new Error("BTCPay Server credentials not configured");
  }

  const body = {
    amount: UNCENSORED_PLAN.priceUsd.toFixed(2),
    currency: "USD",
    metadata: {
      userId: String(params.userId),
      plan: UNCENSORED_PLAN.id,
      buyerEmail: params.email ?? undefined,
    },
    checkout: {
      redirectURL: params.redirectUrl,
      redirectAutomatically: true,
      defaultLanguage: "en",
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
