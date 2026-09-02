/**
 * The pass-activation email: the only thing that tells a buyer their on-chain
 * payment landed after they stopped watching the page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPassActivatedEmail, sendPassActivatedEmail, STUDIO_URL } from "./_core/uncensoredEmail";
import { UNCENSORED_PLANS, getUncensoredPlanById } from "../shared/uncensoredPlans";

const until = new Date("2026-09-09T11:41:00.000Z");

describe("buildPassActivatedEmail", () => {
  it("names the plan bought, the studio link, the expiry and the credits — nothing else to sell", () => {
    for (const plan of UNCENSORED_PLANS) {
      const m = buildPassActivatedEmail({ plan, until });
      expect(m.subject).toBe("Your Uncensored Pass is active");
      expect(m.text).toContain(plan.label);
      expect(m.text).toContain(STUDIO_URL);
      expect(m.text).toContain("2026-09-09 11:41 UTC");
      expect(m.text).toContain(`${plan.bonusCredits} credits`);
      expect(m.html).toContain(`href="${STUDIO_URL}"`);
      // no upsell, no other plan mentioned
      for (const other of UNCENSORED_PLANS) {
        // "30-Day Pass" legitimately contains "Day Pass"; only flag a label that
        // appears on its own.
        if (other.id === plan.id || plan.label.includes(other.label)) continue;
        expect(m.text).not.toContain(other.label);
      }
      expect(m.text).not.toMatch(/\$\d/);
    }
  });

  it("tells a buyer who closed the tab mid-checkout that they must NOT pay again", () => {
    const m = buildPassActivatedEmail({ plan: getUncensoredPlanById("uncensored-day"), until });
    expect(m.text).toMatch(/no need to pay again/i);
  });
});

describe("sendPassActivatedEmail", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_ADDRESS = "DreamForgeX <noreply@dreamforgex.ai>";
    delete process.env.AUTH_RESEND_KEY;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  });

  it("posts to Resend with the configured from, the buyer, and both bodies", async () => {
    const calls: any[] = [];
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    }) as any;
    const ok = await sendPassActivatedEmail({ to: "buyer@example.com", plan: getUncensoredPlanById("uncensored-week"), until });
    expect(ok).toBe(true);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].auth).toBe("Bearer re_test");
    expect(calls[0].body).toMatchObject({ from: "DreamForgeX <noreply@dreamforgex.ai>", to: "buyer@example.com", subject: "Your Uncensored Pass is active" });
    expect(calls[0].body.text).toContain("Week Pass");
    expect(calls[0].body.html).toContain("Week Pass");
  });

  it("never throws — a rejected send or a network error just returns false", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 422 })) as any;
    await expect(sendPassActivatedEmail({ to: "b@example.com", plan: UNCENSORED_PLANS[0], until })).resolves.toBe(false);
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNRESET");
    }) as any;
    await expect(sendPassActivatedEmail({ to: "b@example.com", plan: UNCENSORED_PLANS[0], until })).resolves.toBe(false);
  });

  it("returns false without touching the network when no key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const f = vi.fn();
    globalThis.fetch = f as any;
    await expect(sendPassActivatedEmail({ to: "b@example.com", plan: UNCENSORED_PLANS[0], until })).resolves.toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
