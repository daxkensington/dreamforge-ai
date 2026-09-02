/**
 * "Your Uncensored Pass is active" — the one email the crypto rail sends.
 *
 * Why: the two real buyers to date (2026-08-06, 2026-08-15) each waited 7–11
 * minutes for their on-chain payment to be seen, and neither ever generated a
 * single image afterwards. The webhook granted the pass and the credits, but
 * nothing told the buyer — a closed tab meant the only way back was retyping
 * the URL. This is the receipt + the door.
 *
 * Deliberately plain: no image, no marketing, the product named once. Sent
 * through Resend's REST API with the same key/from the magic-link sign-in
 * uses, so there is no second mail configuration to drift.
 */
import type { UncensoredPlan } from "../../shared/uncensoredPlans";

export const STUDIO_URL = "https://dreamforgex.ai/uncensored";

export function isPassEmailConfigured(): boolean {
  return !!(process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS || "DreamForgeX <noreply@dreamforgex.ai>";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildPassActivatedEmail(params: { plan: UncensoredPlan; until: Date }): {
  subject: string;
  text: string;
  html: string;
} {
  const { plan, until } = params;
  const untilText = until.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const subject = "Your Uncensored Pass is active";
  const lines = [
    `Payment received — your ${plan.label} is live.`,
    ``,
    `Open the studio: ${STUDIO_URL}`,
    ``,
    `Active until ${untilText}.`,
    `${plan.bonusCredits} credits were added to your balance.`,
    `Everything you make there is private: never in the gallery, never on a share link.`,
    ``,
    `If you were mid-checkout when the payment was seen, the studio unlocks as soon as you open the link — no need to pay again.`,
    ``,
    `Questions: reply to this email.`,
  ];
  const text = lines.join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<p style="font-size:16px">Payment received — your <strong>${escapeHtml(plan.label)}</strong> is live.</p>
<p><a href="${STUDIO_URL}" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Open the studio</a></p>
<p style="color:#444">Active until ${escapeHtml(untilText)}.<br>${plan.bonusCredits} credits were added to your balance.<br>Everything you make there is private: never in the gallery, never on a share link.</p>
<p style="color:#444">If you were mid-checkout when the payment was seen, the studio unlocks as soon as you open the link — no need to pay again.</p>
<p style="color:#888;font-size:13px">Questions: reply to this email.<br><a href="${STUDIO_URL}" style="color:#888">${STUDIO_URL}</a></p>
</body></html>`;
  return { subject, text, html };
}

/**
 * Send the activation email. Never throws — the webhook has already granted
 * the pass, and a mail failure must not make BTCPay retry a settlement.
 * Returns true when Resend accepted the message.
 */
export async function sendPassActivatedEmail(params: {
  to: string;
  plan: UncensoredPlan;
  until: Date;
}): Promise<boolean> {
  const apiKey = process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const { subject, text, html } = buildPassActivatedEmail(params);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      // Resend sits behind Cloudflare, which 403s some default client UAs
      // (error 1010 seen with python-urllib). Name ourselves.
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": "dreamforgex-webhook/1.0" },
      body: JSON.stringify({ from: fromAddress(), to: params.to, subject, text, html }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[BTCPay] pass email not accepted (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[BTCPay] pass email failed: ${err?.message ?? err}`);
    return false;
  }
}
