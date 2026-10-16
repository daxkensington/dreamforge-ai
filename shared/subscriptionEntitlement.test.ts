import { describe, expect, it } from "vitest";
import { getEffectiveSubscriptionTier, getSubscriptionEntitlement } from "./subscriptionEntitlement";

const now = new Date("2026-10-13T12:00:00.000Z");
const valid = {
  planName: "pro", status: "active",
  currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
};

describe("effective subscription entitlement", () => {
  it.each(["active", "trialing"])("grants %s access only within the saved current interval", status => {
    expect(getSubscriptionEntitlement({ ...valid, status }, now)).toEqual({
      tier: "pro", expiresAt: valid.currentPeriodEnd.getTime(),
    });
  });

  it("retains an active cancellation-at-period-end until the actual exclusive end", () => {
    const subscription = { ...valid, cancelAtPeriodEnd: true };
    expect(getEffectiveSubscriptionTier(subscription, now)).toBe("pro");
    expect(getEffectiveSubscriptionTier(subscription, valid.currentPeriodEnd)).toBe("free");
  });

  it.each(["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused", "unknown", null, undefined])
    ("denies paid access for status %s even with a future saved end", status => {
      expect(getSubscriptionEntitlement({ ...valid, status }, now)).toEqual({ tier: "free", expiresAt: null });
    });

  it.each([null, undefined, new Date(Number.NaN), "", "not a date", "2026-11-01", "2026-11-01T00:00:00", "2026-02-30T00:00:00Z"])
    ("does not invent a missing or invalid end (%s)", currentPeriodEnd => {
      expect(getEffectiveSubscriptionTier({ ...valid, currentPeriodEnd }, now)).toBe("free");
    });

  it.each([null, undefined, new Date(Number.NaN), "not a date"])
    ("does not invent a missing or invalid start (%s)", currentPeriodStart => {
      expect(getEffectiveSubscriptionTier({ ...valid, currentPeriodStart }, now)).toBe("free");
    });

  it("rejects expired, future-starting and inverted intervals", () => {
    expect(getEffectiveSubscriptionTier({ ...valid, currentPeriodEnd: now }, now)).toBe("free");
    expect(getEffectiveSubscriptionTier({ ...valid, currentPeriodStart: "2026-10-14T00:00:00Z" }, now)).toBe("free");
    expect(getEffectiveSubscriptionTier({ ...valid, currentPeriodStart: valid.currentPeriodEnd }, now)).toBe("free");
  });

  it("accepts explicit ISO timezone serialization and an inclusive start", () => {
    const subscription = {
      ...valid,
      currentPeriodStart: "2026-10-13T07:00:00-05:00",
      currentPeriodEnd: "2026-11-01T00:00:00.000Z",
    };
    expect(getEffectiveSubscriptionTier(subscription, now.getTime())).toBe("pro");
  });

  it("preserves the implemented enterprise tier alias while rejecting unknown plans", () => {
    expect(getEffectiveSubscriptionTier({ ...valid, planName: "enterprise" }, now)).toBe("business");
    for (const planName of ["lifetime", "manual", "future-plan", "constructor", "free", null]) {
      expect(getEffectiveSubscriptionTier({ ...valid, planName }, now)).toBe("free");
    }
  });

  it("denies absent subscriptions or an invalid clock", () => {
    expect(getEffectiveSubscriptionTier(null, now)).toBe("free");
    expect(getEffectiveSubscriptionTier(undefined, now)).toBe("free");
    expect(getEffectiveSubscriptionTier(valid, Number.NaN)).toBe("free");
  });
});
