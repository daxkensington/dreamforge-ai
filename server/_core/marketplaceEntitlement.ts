import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { subscriptionPlans, userSubscriptions } from "../../drizzle/schema";
import { getEffectiveSubscriptionTier } from "../../shared/subscriptionEntitlement";
import { getTierConfig } from "../../shared/tiers";
import { getDb } from "../db";
import { currentSubscriptionOrder } from "./subscriptionSelection";

/** Use the same saved-period entitlement and subscription ordering as generation. */
async function marketplacePlan(userId: number) {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Could not verify marketplace access. Please try again.",
    });
  const [subscription] = await db
    .select({
      planName: subscriptionPlans.name,
      status: userSubscriptions.status,
      currentPeriodStart: userSubscriptions.currentPeriodStart,
      currentPeriodEnd: userSubscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: userSubscriptions.cancelAtPeriodEnd,
    })
    .from(userSubscriptions)
    .innerJoin(
      subscriptionPlans,
      eq(subscriptionPlans.id, userSubscriptions.planId)
    )
    .where(eq(userSubscriptions.userId, userId))
    .orderBy(...currentSubscriptionOrder())
    .limit(1);
  return getTierConfig(getEffectiveSubscriptionTier(subscription));
}

export async function requireMarketplaceBuying(userId: number): Promise<void> {
  if (!(await marketplacePlan(userId)).marketplaceBuy) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Paid marketplace purchases require a Pro subscription or higher.",
    });
  }
}

export async function requireMarketplaceSelling(userId: number): Promise<void> {
  if (!(await marketplacePlan(userId)).marketplaceSelling) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Marketplace selling requires a Studio subscription or higher.",
    });
  }
}
