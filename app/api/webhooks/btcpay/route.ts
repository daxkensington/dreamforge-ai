import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../server/db";
import { verifyBTCPayWebhook, getUncensoredPlanById } from "../../../../server/_core/btcpay";
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
 *  - Invoices are created with speedPolicy HighSpeed, so InvoiceSettled fires
 *    on the mempool broadcast rather than after a confirmation. InvoiceSettled
 *    is still the ONLY event that grants; InvoiceProcessing has no side
 *    effects. The trade is that a settled invoice can later go invalid, so
 *    InvoiceInvalid reverses the grant (atomically, once).
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

  if (event.type === "InvoiceExpired") {
    await db
      .update(cryptoInvoices)
      .set({ status: "expired" })
      .where(and(eq(cryptoInvoices.invoiceId, event.invoiceId), ne(cryptoInvoices.status, "settled")));
    return NextResponse.json({ ok: true });
  }

  if (event.type === "InvoiceInvalid") {
    // Invoices settle at 0-conf (see speedPolicy in server/_core/btcpay.ts), so
    // an already-settled invoice CAN still turn invalid — the broadcast tx was
    // double-spent or never confirmed. That is the whole risk 0-conf takes on,
    // and leaving the entitlement in place is what would make it unbounded.
    // Claim the reversal atomically so a redelivered event can't revoke twice.
    const reversed = await db
      .update(cryptoInvoices)
      .set({ status: "invalid" })
      .where(and(eq(cryptoInvoices.invoiceId, event.invoiceId), eq(cryptoInvoices.status, "settled")))
      .returning();

    const invoice = reversed[0];
    if (invoice) {
      const plan = getUncensoredPlanById(invoice.plan);

      // Give back exactly what was granted. GREATEST(now(), …) floors the
      // result at "expired now" rather than pushing it into the past, and
      // leaves any time the user bought separately untouched.
      await db.execute(sql`
        UPDATE users SET "uncensoredUntil" = GREATEST(
          now(),
          COALESCE("uncensoredUntil", now()) - interval '${sql.raw(String(plan.durationDays))} days')
        WHERE id = ${invoice.userId}`);

      await db.execute(sql`
        UPDATE "creditBalances" SET balance = GREATEST(0, balance - ${plan.bonusCredits})
        WHERE "userId" = ${invoice.userId}`);

      await db.insert(creditTransactions).values({
        userId: invoice.userId,
        amount: -plan.bonusCredits,
        type: "refund",
        description: `Reversed — BTCPay ${invoice.invoiceId} settled at 0-conf but never confirmed`,
      });

      console.warn(
        `[BTCPay] REVERSED ${invoice.invoiceId}: user ${invoice.userId} uncensored -${plan.durationDays}d, -${plan.bonusCredits}cr (0-conf payment went invalid)`,
      );
      return NextResponse.json({ ok: true, reversed: true });
    }

    await db
      .update(cryptoInvoices)
      .set({ status: "invalid" })
      .where(and(eq(cryptoInvoices.invoiceId, event.invoiceId), ne(cryptoInvoices.status, "invalid")));
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

  // Grant the plan that was actually purchased (stored per-invoice), so the
  // pricing ladder credits the right duration + bonus credits.
  const plan = getUncensoredPlanById(invoice.plan);

  // Extend entitlement: stack on top of remaining time if still active.
  await db.execute(sql`
    UPDATE users SET "uncensoredUntil" =
      GREATEST(COALESCE("uncensoredUntil", now()), now()) + interval '${sql.raw(String(plan.durationDays))} days'
    WHERE id = ${invoice.userId}`);

  // Bonus credits
  await db
    .insert(creditBalances)
    .values({ userId: invoice.userId, balance: plan.bonusCredits, lifetimeSpent: 0 })
    .onConflictDoUpdate({
      target: creditBalances.userId,
      set: { balance: sql`${creditBalances.balance} + ${plan.bonusCredits}` },
    });
  await db.insert(creditTransactions).values({
    userId: invoice.userId,
    amount: plan.bonusCredits,
    type: "purchase",
    description: `Uncensored Pass (${plan.durationDays}d) — BTCPay ${invoice.invoiceId}`,
  });

  console.log(`[BTCPay] Settled ${invoice.invoiceId}: user ${invoice.userId} uncensored +${plan.durationDays}d, +${plan.bonusCredits}cr`);
  return NextResponse.json({ ok: true });
}
