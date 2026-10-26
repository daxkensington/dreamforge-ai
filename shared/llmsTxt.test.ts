import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "./creditCosts";
import { FREE_UNCENSORED_PREVIEWS, UNCENSORED_PLANS } from "./uncensoredPlans";

/**
 * /llms.txt and /llms-full.txt are what ChatGPT and the other answer engines
 * read before they describe us. In Oct 2026 ChatGPT was the #3 referrer and its
 * visitors signed up at ~15x the site average — and both files quoted pass
 * bonuses, credit packs and subscription plans that matched nothing in the code.
 * This pins every number in them to the tables the app actually bills from.
 */
const read = (name: string) => readFileSync(path.resolve(__dirname, "..", "public", name), "utf8");
const files = { "llms.txt": read("llms.txt"), "llms-full.txt": read("llms-full.txt") };
const usd = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

describe.each(Object.entries(files))("%s matches the billing tables", (_name, text) => {
  it("states the real number of free uncensored previews", () => {
    expect(text).toMatch(new RegExp(`${FREE_UNCENSORED_PREVIEWS} free[^.\\n]{0,40}previews`, "i"));
    for (const n of [1, 2, 4, 5]) expect(text).not.toMatch(new RegExp(`\\b${n} free (uncensored |watermarked )?previews`, "i"));
  });

  it("quotes each Uncensored Pass at its Bitcoin price, credit price and bonus", () => {
    for (const plan of UNCENSORED_PLANS) {
      // "$12" and "$12.00" are both fine; "$12.50" is not.
      expect(text).toMatch(new RegExp("`\\" + money(plan.priceUsd) + (Number.isInteger(plan.priceUsd) ? "(?:\\.00)?" : "") + "`"));
      expect(text).toContain(`\`${plan.creditPrice.toLocaleString("en-US")} Credits\``);
      expect(text).toContain(`\`+${plan.bonusCredits}\``);
    }
    // Every "+N" bonus mentioned must be a real one.
    const bonuses = [...text.matchAll(/`\+([\d,]+)`/g)].map(m => Number(m[1].replace(/,/g, "")));
    const real = new Set(UNCENSORED_PLANS.map(p => p.bonusCredits));
    for (const b of bonuses) expect(real.has(b), `+${b} is not a pass bonus`).toBe(true);
  });

  it("quotes only credit packs that exist, at their real prices", () => {
    for (const pack of CREDIT_PACKS) {
      expect(text).toContain(`${pack.credits.toLocaleString("en-US")} Credits`);
      expect(text).toContain(`$${usd(pack.price)}`);
    }
    // Any "<N> Credits ... $<X>" pairing on one line must be a real pack or a pass credit price.
    const realCredits = new Set<number>([...CREDIT_PACKS.map(p => p.credits), ...UNCENSORED_PLANS.map(p => p.creditPrice)]);
    for (const m of text.matchAll(/`?([\d,]{3,})`? Credits`?\s*(?:\(|for|pack for)\s*`?\$/g)) {
      const n = Number(m[1].replace(/,/g, ""));
      expect(realCredits.has(n), `"${m[0]}" names a credit amount that is not sold`).toBe(true);
    }
  });

  it("quotes each subscription plan at its real monthly and yearly price", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      if (plan.price === 0) continue;
      expect(text).toContain(`${plan.displayName}`);
      expect(text).toContain(`$${usd(plan.price)}/mo`);
      expect(text).toContain(`$${usd(plan.yearlyPrice).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}/yr`);
      expect(text).toContain(`${plan.monthlyCredits.toLocaleString("en-US")} monthly credits`.replace(" monthly credits", ""));
    }
    for (const stale of ["Starter", "$12/mo", "$29/mo", "$23/mo", "$63/mo", "15 daily login credits"]) {
      expect(text, `stale plan copy "${stale}" is back`).not.toContain(stale);
    }
  });
});
