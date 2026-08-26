/**
 * Uncensored pricing ladder — single source of truth for server checkout,
 * client UI fallbacks, and SEO JSON-LD (AggregateOffer).
 *
 * Server (server/_core/btcpay.ts) re-exports these so invoice creation always
 * matches what the landing page and Product schema advertise.
 */
export interface UncensoredPlan {
  id: string;
  label: string;
  priceUsd: number;
  bonusCredits: number;
  durationDays: number;
  tagline: string;
  highlight?: boolean;
}

export const UNCENSORED_PLANS: UncensoredPlan[] = [
  {
    id: "uncensored-day",
    label: "Day Pass",
    priceUsd: 4.99,
    bonusCredits: 60,
    durationDays: 1,
    tagline: "Dip in for 24 hours",
  },
  {
    id: "uncensored-week",
    label: "Week Pass",
    priceUsd: 12,
    bonusCredits: 250,
    durationDays: 7,
    tagline: "A week, no commitment",
  },
  {
    id: "uncensored-30d",
    label: "30-Day Pass",
    priceUsd: 19,
    bonusCredits: 500,
    durationDays: 30,
    tagline: "Best value",
    highlight: true,
  },
];

/**
 * Free uncensored previews per account, lifetime — the taste before the pass.
 *
 * Shared because the marketing pages advertise this number and the router
 * enforces it; two copies would drift, and the one users see is the one that
 * would be wrong.
 */
export const FREE_UNCENSORED_PREVIEWS = 3;

/** The cheapest way in — what the landing pages should lead with. */
export const UNCENSORED_ENTRY_PLAN: UncensoredPlan = UNCENSORED_PLANS.reduce(
  (cheapest, p) => (p.priceUsd < cheapest.priceUsd ? p : cheapest),
  UNCENSORED_PLANS[0],
);

/** Default / back-compat plan = the 30-day anchor. */
export const UNCENSORED_PLAN: UncensoredPlan =
  UNCENSORED_PLANS.find((p) => p.id === "uncensored-30d")!;

export function getUncensoredPlanById(id: string | null | undefined): UncensoredPlan {
  return UNCENSORED_PLANS.find((p) => p.id === id) ?? UNCENSORED_PLAN;
}
