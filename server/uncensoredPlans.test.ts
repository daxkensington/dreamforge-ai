import { describe, it, expect } from "vitest";
import { UNCENSORED_PLANS, UNCENSORED_PLAN, getUncensoredPlanById } from "./_core/btcpay";

describe("uncensored pricing ladder", () => {
  it("exposes the 3 expected SKUs + prices in order", () => {
    expect(UNCENSORED_PLANS.map((p) => p.id)).toEqual([
      "uncensored-day",
      "uncensored-week",
      "uncensored-30d",
    ]);
    expect(UNCENSORED_PLANS.map((p) => p.priceUsd)).toEqual([4.99, 12, 19]);
  });

  it("default/back-compat plan is the 30-day anchor", () => {
    expect(UNCENSORED_PLAN.id).toBe("uncensored-30d");
    expect(UNCENSORED_PLAN.durationDays).toBe(30);
    expect(UNCENSORED_PLAN.bonusCredits).toBe(500);
  });

  it("getUncensoredPlanById resolves real ids and falls back to the anchor", () => {
    expect(getUncensoredPlanById("uncensored-day").priceUsd).toBe(4.99);
    expect(getUncensoredPlanById("uncensored-day").durationDays).toBe(1);
    expect(getUncensoredPlanById("uncensored-week").durationDays).toBe(7);
    expect(getUncensoredPlanById("bogus-plan").id).toBe("uncensored-30d");
    expect(getUncensoredPlanById(null).id).toBe("uncensored-30d");
    expect(getUncensoredPlanById(undefined).id).toBe("uncensored-30d");
  });

  it("every plan has a positive price, duration, and non-negative credits", () => {
    for (const p of UNCENSORED_PLANS) {
      expect(p.priceUsd).toBeGreaterThan(0);
      expect(p.durationDays).toBeGreaterThan(0);
      expect(p.bonusCredits).toBeGreaterThanOrEqual(0);
    }
  });
});
