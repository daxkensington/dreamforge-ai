import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../server/db";
import { verifyBTCPayWebhook, UNCENSORED_PLAN } from "../../../../server/_core/btcpay";
import { cryptoInvoices, creditBalances, creditTransactions } from "../../../../drizzle/schema";
import { and, eq, ne, sql } from "drizzle-orm";

export const maxDuration = 30;
export const runtime = "nodejs";

/**
 * BTCPay webhook — settles uncensored-tier invoices.
 *
 * Security model (ported from the golden-climax integration):
 *  - HMAC (BTCPay-Sig) verified against the RAW body before any parsing.
 *  - Settlement is claimed atomically: UPDATE ... WHERE status != 'settled'
 *    returning the row — a replayed/duplicate event can never double-grant.
 *  - 0-conf events (InvoiceProcessing) cause no side effects; only
 *    InvoiceSettled grants the entitlement.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("btcpay-sig");
  if (!sig || !verifyBTCPayWebhook(body, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; invoiceId?: string };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  if (!event.invoiceId) return NextResponse.json({ ok: true });

  const db = await getDb();
  // No DB → fail loud so BTCPay retries (it retries for hours); silently
  // 200-ing would drop the settlement and the user would pay without access.
  if (!db) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  if (event.type === "InvoiceExpired" || event.type === "InvoiceInvalid") {
    await db
      .update(cryptoInvoices)
      .set({ status: event.type === "InvoiceExpired" ? "expired" : "invalid" })
      .where(and(eq(cryptoInvoices.invoiceId, event.invoiceId), ne(cryptoInvoices.status, "settled")));
    return NextResponse.json({ ok: true });
  }

  if (event.type !== "InvoiceSettled") {
    // InvoiceCreated / InvoiceProcessing / InvoiceReceivedPayment — no side effects.
    return NextResponse.json({ ok: true });
  }

  // Atomic claim — flips new→settled exactly once.
  const claimed = await db
    .update(cryptoInvoices)
    .set({ status: "settled", settledAt: new Date() })
    .where(and(eq(cryptoInvoices.invoiceId, event.invoiceId), ne(cryptoInvoices.status, "settled")))
    .returning();
  const invoice = claimed[0];
  if (!invoice) return NextResponse.json({ ok: true, note: "already settled or unknown invoice" });

  // Extend entitlement: stack on top of remaining time if still active.
  await db.execute(sql`
    UPDATE users SET "uncensoredUntil" =
      GREATEST(COALESCE("uncensoredUntil", now()), now()) + interval '${sql.raw(String(UNCENSORED_PLAN.durationDays))} days'
    WHERE id = ${invoice.userId}`);

  // Bonus credits
  await db
    .insert(creditBalances)
    .values({ userId: invoice.userId, balance: UNCENSORED_PLAN.bonusCredits, lifetimeSpent: 0 })
    .onConflictDoUpdate({
      target: creditBalances.userId,
      set: { balance: sql`${creditBalances.balance} + ${UNCENSORED_PLAN.bonusCredits}` },
    });
  await db.insert(creditTransactions).values({
    userId: invoice.userId,
    amount: UNCENSORED_PLAN.bonusCredits,
    type: "purchase",
    description: `Uncensored Pass (${UNCENSORED_PLAN.durationDays}d) — BTCPay ${invoice.invoiceId}`,
  });

  console.log(`[BTCPay] Settled ${invoice.invoiceId}: user ${invoice.userId} uncensored +${UNCENSORED_PLAN.durationDays}d, +${UNCENSORED_PLAN.bonusCredits}cr`);
  return NextResponse.json({ ok: true });
}
