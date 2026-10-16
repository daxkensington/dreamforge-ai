import { resolveTierName, TIERS, type TierName } from "./tiers";

export interface SubscriptionEntitlementInput {
  planName?: string | null;
  status?: string | null;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
}

export interface SubscriptionEntitlement {
  tier: TierName;
  /** The verified saved interval's exclusive end, for client expiration timers. */
  expiresAt: number | null;
}

function timestamp(value: Date | string | null | undefined): number | null {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  // Serialized dates must carry a timezone; ambiguous local dates cannot grant access.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const calendarDay = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * Paid access requires an eligible status and a real, currently valid saved period.
 * Scheduling cancellation preserves access until that period ends. Missing dates
 * never imply lifetime access, and this helper never creates replacement dates.
 */
export function getSubscriptionEntitlement(
  input: SubscriptionEntitlementInput | null | undefined,
  now: Date | number = Date.now(),
): SubscriptionEntitlement {
  const free: SubscriptionEntitlement = { tier: "free", expiresAt: null };
  if (!input || (input.status !== "active" && input.status !== "trialing")) return free;
  const tier = resolveTierName(input.planName ?? "free");
  if (tier === "free" || !Object.hasOwn(TIERS, tier)) return free;
  const currentTime = now instanceof Date ? now.getTime() : now;
  const start = timestamp(input.currentPeriodStart);
  const end = timestamp(input.currentPeriodEnd);
  if (!Number.isFinite(currentTime) || start === null || end === null || start > currentTime || end <= currentTime || end <= start) {
    return free;
  }
  return { tier, expiresAt: end };
}

export function getEffectiveSubscriptionTier(
  input: SubscriptionEntitlementInput | null | undefined,
  now: Date | number = Date.now(),
): TierName {
  return getSubscriptionEntitlement(input, now).tier;
}
