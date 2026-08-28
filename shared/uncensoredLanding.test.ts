/**
 * Honesty guard for the /uncensored SEO silo.
 *
 * These are the site's best-ranking non-brand pages, and they are long-form
 * prose — which is exactly where a claim quietly goes stale. They had drifted
 * twice already: every page advertised a flat "$19 for 30 days" long after a
 * $4.99 day pass existed (hiding the cheapest way in on the pages that rank),
 * four pages offered Litecoin, USDT and Monero when checkout has only ever
 * taken on-chain BTC, and one promised "unlimited" generation against a
 * 500-credit allowance.
 *
 * A buyer who arrives expecting Monero and finds a BTC-only checkout is a lost
 * sale we would never see in any funnel metric, so these are asserted.
 */
import { describe, it, expect } from "vitest";
import { UNCENSORED_LANDINGS, UNCENSORED_LANDING_SLUGS } from "./uncensoredLanding";
import { UNCENSORED_FAQ } from "./uncensoredFaq";
import {
  FREE_UNCENSORED_PREVIEWS,
  UNCENSORED_ENTRY_PLAN,
  UNCENSORED_PLANS,
} from "./uncensoredPlans";

/** Everything a lander says, as one searchable blob. */
function allCopy(slug: string): string {
  const p = UNCENSORED_LANDINGS[slug];
  return [
    p.title,
    p.metaDescription,
    p.h1,
    p.intro,
    ...p.bullets,
    ...p.sampleConcepts,
    ...p.faq.flatMap((f) => [f.q, f.a]),
  ].join(" ");
}

describe("uncensored landing silo", () => {
  it("has entries whose slug matches their key, and a slug list that covers them", () => {
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      expect(UNCENSORED_LANDINGS[slug].slug).toBe(slug);
    }
    expect(UNCENSORED_LANDING_SLUGS.length).toBe(Object.keys(UNCENSORED_LANDINGS).length);
  });

  it("never advertises a coin the checkout cannot take", () => {
    // server/_core/btcpay.ts: "Live payment methods (verified 2026-07-31):
    // BTC-CHAIN only." Lightning/USDC need operator enablement on the store.
    const unsupported = /\b(litecoin|monero|xmr|usdt|tether|dogecoin|ethereum|\bltc\b|\beth\b)\b/i;
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const hit = allCopy(slug).match(unsupported);
      expect(hit ? `${slug}: ${hit[0]}` : null).toBeNull();
    }
  });

  it("does not promise unlimited or unmetered generation", () => {
    // Passes carry a finite credit allowance (60 / 250 / 500).
    // Deliberately NOT matching "no limits": the silo asks "Are there really
    // no limits at all?" as an FAQ question whose answer spells out the legal
    // ones. Flagging that would train us to delete an honest disclosure.
    const overclaim = /\b(unlimited|unmetered)\b/i;
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const hit = allCopy(slug).match(overclaim);
      expect(hit ? `${slug}: ${hit[0]}` : null).toBeNull();
    }
  });

  it("only quotes prices that exist in the shared ladder", () => {
    const valid = new Set(UNCENSORED_PLANS.map((p) => `$${p.priceUsd}`));
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const quoted = allCopy(slug).match(/\$\d+(?:\.\d{2})?/g) ?? [];
      for (const q of quoted) {
        expect(valid.has(q) ? null : `${slug} quotes ${q}, not in the ladder`).toBeNull();
      }
    }
  });

  it("names the cheapest entry price, not just the 30-day anchor", () => {
    // The whole point of the fix: the pages that rank must show the cheap way
    // in. Landers that quote any price must quote the entry price.
    const entry = `$${UNCENSORED_ENTRY_PLAN.priceUsd}`;
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const copy = allCopy(slug);
      if (!/\$\d/.test(copy)) continue;
      expect(copy.includes(entry) ? null : `${slug} quotes a price but never ${entry}`).toBeNull();
    }
  });

  it("states the free-preview count consistently with what the router enforces", () => {
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const copy = allCopy(slug);
      const claims = copy.match(/(\d+)\s+free\s+previews?/gi) ?? [];
      for (const c of claims) {
        const n = Number(c.match(/\d+/)![0]);
        expect(n).toBe(FREE_UNCENSORED_PREVIEWS);
      }
    }
  });

  it("keeps the 18+ / fictional-only compliance posture on every page", () => {
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const copy = allCopy(slug).toLowerCase();
      expect(copy.includes("18+") || copy.includes("18 and over")).toBe(true);
      expect(copy.includes("fictional")).toBe(true);
    }
  });

  it("gives every page the content SEO needs to stand on its own", () => {
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const p = UNCENSORED_LANDINGS[slug];
      expect(p.title.length).toBeGreaterThan(20);
      expect(p.metaDescription.length).toBeGreaterThan(80);
      expect(p.metaDescription.length).toBeLessThanOrEqual(200);
      expect(p.h1.length).toBeGreaterThan(10);
      expect(p.intro.length).toBeGreaterThan(400);
      expect(p.bullets.length).toBeGreaterThanOrEqual(4);
      expect(p.faq.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not tell buyers they must wait for a block confirmation", () => {
    // Checkout settles at 0-conf (see server/_core/btcpay.ts). Telling a
    // buyer to wait for a confirm is the conversion tax we just removed.
    const stale = /once the network confirms|wait(?:ing)? for (?:a )?(?:block )?confirm/i;
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const hit = allCopy(slug).match(stale);
      expect(hit ? `${slug}: ${hit[0]}` : null).toBeNull();
    }
    const faqBlob = UNCENSORED_FAQ.map((f) => `${f.q} ${f.a}`).join(" ");
    expect(faqBlob.match(stale)).toBeNull();
    expect(faqBlob.toLowerCase()).toContain("mempool");
  });

  it("does not duplicate an H1 across pages (thin-content signal)", () => {
    const seen = new Map<string, string>();
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const h1 = UNCENSORED_LANDINGS[slug].h1.toLowerCase().trim();
      expect(seen.has(h1) ? `${slug} duplicates H1 of ${seen.get(h1)}` : null).toBeNull();
      seen.set(h1, slug);
    }
  });
});
