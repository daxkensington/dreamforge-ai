import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "../../../../server/db";
import {
  getStripeClient,
  processStripeEvent,
  type StripeEventResult,
} from "./handler";

// Stripe retries webhooks for up to 3 days if we don't 200 in time, so
// failing fast is better than letting an event hang. 30s is plenty for
// the heaviest handler (charge.refunded does ~3 DB queries + notify).
export const maxDuration = 30;
export const runtime = "nodejs";

/**
 * Thin transport wrapper: verify signature → construct event → claim +
 * process (see handler.ts) → ack. All event handling lives in
 * processStripeEvent, which is unit-tested in server/webhook.test.ts.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Reject test events in production
  if (event.id.startsWith("evt_test_")) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[Stripe Webhook] Rejecting test event in production:", event.id);
      return NextResponse.json(
        { error: "Test events not allowed in production" },
        { status: 403 }
      );
    }
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return NextResponse.json({ verified: true });
  }

  const db = await getDb();

  let result: StripeEventResult;
  try {
    result = await processStripeEvent(event, db);
  } catch (err: any) {
    console.error("[Stripe Webhook] Unhandled webhook error:", err?.message || err);
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    result === "duplicate" ? { received: true, duplicate: true } : { received: true }
  );
}
