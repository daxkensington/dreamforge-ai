import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or secret" },
      { status: 400 }
    );
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
    const event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle events
    switch (event.type) {
      case "checkout.session.completed":
        console.log(
          "[Stripe] Checkout completed:",
          event.data.object.id
        );
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        console.log("[Stripe] Subscription event:", event.type);
        break;
      case "invoice.payment_succeeded":
        console.log(
          "[Stripe] Payment succeeded:",
          event.data.object.id
        );
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
