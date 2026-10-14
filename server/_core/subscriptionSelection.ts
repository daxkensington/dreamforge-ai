import { desc, sql, type SQL } from "drizzle-orm";
import { userSubscriptions } from "../../drizzle/schema";

/** Eligible paid history wins over a newer incomplete/free row; ties are stable. */
export function currentSubscriptionOrder(): SQL[] {
  return [
    sql`CASE WHEN ${userSubscriptions.status} IN ('active', 'trialing')
      AND ${userSubscriptions.currentPeriodStart} IS NOT NULL AND ${userSubscriptions.currentPeriodEnd} IS NOT NULL
      AND ${userSubscriptions.currentPeriodStart} <= (statement_timestamp() AT TIME ZONE 'UTC')
      AND ${userSubscriptions.currentPeriodEnd} > (statement_timestamp() AT TIME ZONE 'UTC')
      AND EXISTS (SELECT 1 FROM "subscriptionPlans" entitled_plan
        WHERE entitled_plan.id = ${userSubscriptions.planId}
          AND entitled_plan.name IN ('creator', 'pro', 'studio', 'business', 'agency', 'enterprise'))
      THEN 0 ELSE 1 END`,
    desc(userSubscriptions.createdAt), desc(userSubscriptions.id),
  ];
}
