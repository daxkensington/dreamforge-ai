import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../server/db";
import { verifyBTCPayWebhook, getUncensoredPlanById } from "../../../../server/_core/btcpay";
import { cryptoInvoices, creditBalances, creditTransactions, users } from "../../../../drizzle/schema";
import { sendPassActivatedEmail } from "../../../../server/_core/uncensoredEmail";
import { and, eq, sql } from "drizzle-orm";
import { walletRows } from "../../../../server/_core/walletAccounting";

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
      .where(and(eq(cryptoInvoices.invoiceId, event.invoiceId), eq(cryptoInvoices.status, "new")));
    return NextResponse.json({ ok: true });
  }

  if (event.type !== "InvoiceSettled" && event.type !== "InvoiceInvalid") return NextResponse.json({ ok: true });
  const [saved] = await db.select().from(cryptoInvoices).where(eq(cryptoInvoices.invoiceId, event.invoiceId)).limit(1);
  if (!saved) return NextResponse.json({ ok: true, note: "unknown invoice" });
  const plan = getUncensoredPlanById(saved.plan);

  if (event.type === "InvoiceInvalid") {
    const result = walletRows(await db.execute(sql`
      WITH locked AS (SELECT * FROM "cryptoInvoices" WHERE "invoiceId" = ${event.invoiceId} FOR UPDATE),
      invalidated AS (
        UPDATE "cryptoInvoices" i SET status = 'invalid' FROM locked l
        WHERE i.id = l.id AND l.status <> 'invalid' RETURNING i.*, l.status AS previous_status
      ), revoked AS (
        UPDATE users u SET "uncensoredUntil" = GREATEST(now(), COALESCE(u."uncensoredUntil", now()) - make_interval(days => ${plan.durationDays}))
        FROM invalidated i WHERE u.id = i."userId" AND i.previous_status = 'settled' RETURNING u.id
      ), wallet AS (
        UPDATE "creditBalances" cb SET balance = cb.balance - ${plan.bonusCredits},
          "bonusCredits" = CASE WHEN cb."walletAccountingVersion" = 1 THEN GREATEST(0, cb."bonusCredits" - ${plan.bonusCredits}) ELSE cb."bonusCredits" END,
          "updatedAt" = now()
        FROM invalidated i WHERE cb."userId" = i."userId" AND i.previous_status = 'settled' AND EXISTS (SELECT 1 FROM revoked) RETURNING cb."userId"
      ), ledger AS (
        INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
        SELECT "userId", -(${plan.bonusCredits}::integer), 'refund', 'Invalidated Bitcoin pass payment', jsonb_build_object('btcpayInvoiceId', ${event.invoiceId}::text)
        FROM wallet RETURNING id
      ) SELECT id FROM invalidated`));
    return NextResponse.json({ ok: true, reversed: result.length > 0 });
  }

  // Invalid is terminal. A stale signed settlement can never reopen a reversal.
  // Every entitlement, bucket, ledger and invoice state change commits together.
  const result = walletRows(await db.execute(sql`
    WITH locked AS (SELECT * FROM "cryptoInvoices" WHERE "invoiceId" = ${event.invoiceId} FOR UPDATE),
    eligible AS (SELECT * FROM locked WHERE status IN ('new','expired')),
    entitlement AS (
      UPDATE users u SET "uncensoredUntil" = GREATEST(COALESCE(u."uncensoredUntil", now()), now()) + make_interval(days => ${plan.durationDays})
      FROM eligible i WHERE u.id = i."userId" AND COALESCE(u."loginMethod", '') <> 'deleted' RETURNING u.id
    ), wallet AS (
      INSERT INTO "creditBalances" ("userId", balance, "bonusCredits", "lifetimeSpent", "walletAccountingVersion")
      SELECT i."userId", ${plan.bonusCredits}, ${plan.bonusCredits}, 0, 1 FROM eligible i WHERE EXISTS (SELECT 1 FROM entitlement)
      ON CONFLICT ("userId") DO UPDATE SET balance = "creditBalances".balance + EXCLUDED.balance,
        "bonusCredits" = "creditBalances"."bonusCredits" + EXCLUDED."bonusCredits", "updatedAt" = now() RETURNING "userId"
    ), ledger AS (
      INSERT INTO "creditTransactions" ("userId", amount, "txType", description, "txMetadata")
      SELECT "userId", ${plan.bonusCredits}, 'purchase', ${`Uncensored Pass (${plan.durationDays}d) — Bitcoin`},
        jsonb_build_object('btcpayInvoiceId', ${event.invoiceId}::text, 'purchasedCredits', ${plan.bonusCredits}::integer) FROM wallet RETURNING id
    ), settled AS (
      UPDATE "cryptoInvoices" i SET status = 'settled', "settledAt" = now() FROM eligible e
      WHERE i.id = e.id AND EXISTS (SELECT 1 FROM ledger) RETURNING i.*
    ), receipt AS (
      INSERT INTO "webhookEvents" ("eventId", "eventType", "webhookStatus", summary)
      SELECT 'btcpay-settlement:' || "invoiceId", 'internal.btcpay.settlement', 'processed', 'Bitcoin pass granted atomically' FROM settled RETURNING id
    ) SELECT s.* FROM settled s WHERE EXISTS (SELECT 1 FROM receipt)`));
  const invoice = result[0];
  if (!invoice) return NextResponse.json({ ok: true, note: "already handled invoice" });

  // Tell the buyer. On-chain settlement can land minutes after they stopped
  // watching the page; without this the pass was granted into silence and
  // neither real buyer to date ever came back to use it. Never throws — the
  // grant above is already committed and must not be retried by BTCPay.
  try {
    const [buyer] = await db
      .select({ email: users.email, until: users.uncensoredUntil })
      .from(users)
      .where(eq(users.id, invoice.userId))
      .limit(1);
    if (buyer?.email) {
      const until = buyer.until ?? new Date(Date.now() + plan.durationDays * 86_400_000);
      const sent = await sendPassActivatedEmail({ to: buyer.email, plan, until });
      if (!sent) console.warn(`[BTCPay] pass email NOT sent for user ${invoice.userId}`);
    }
  } catch (err: any) {
    console.warn(`[BTCPay] pass email lookup failed: ${err?.message ?? err}`);
  }
  return NextResponse.json({ ok: true });
}
