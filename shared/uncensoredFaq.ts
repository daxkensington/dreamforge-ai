/**
 * Uncensored-tier FAQ — single source of truth.
 *
 * Rendered visibly on /uncensored (client/src/pages/Uncensored.tsx) AND emitted
 * as FAQPage JSON-LD on app/uncensored/page.tsx. Keep both driven from here so
 * the structured data Google sees always matches the on-page copy.
 */
export interface UncensoredFaqItem {
  q: string;
  a: string;
}

export const UNCENSORED_FAQ: UncensoredFaqItem[] = [
  {
    q: "Is the uncensored mode really unfiltered?",
    a: "Yes. Uncensored generations run on open-source models (Flux Schnell) on our own GPUs with no content filter, so prompts the standard SFW models reject just work. It never routes through Cloudflare, OpenAI, Stability, or Grok, which prohibit this content.",
  },
  {
    q: "How do I pay? Do I need a credit card?",
    a: "No card and no account with us beyond a sign-in. You pay anonymously with Bitcoin through a BTCPay invoice — it takes a few minutes. Passes start at $4.99 for a day, $12 for a week, or $19 for 30 days, each a one-time payment with no auto-renew.",
  },
  {
    q: "Why crypto only and not a card?",
    a: "Card networks and processors like Stripe prohibit adult content in their terms. Paying with crypto is what keeps this tier available, and it keeps your billing private and discreet.",
  },
  {
    q: "Are my uncensored generations private?",
    a: "Yes. Anything you make in uncensored mode is kept private by default — it can never enter the public gallery or be exposed on a public share link.",
  },
  {
    q: "What does the $19 Uncensored Pass include?",
    a: "Thirty days of uncensored image generation plus 500 bonus credits. It is a one-time payment — nothing recurring, and it simply expires after 30 days unless you renew it yourself.",
  },
  {
    q: "Is any illegal content allowed?",
    a: "No. All content is AI-generated and fictional, and no real individuals are depicted. You are responsible for complying with the laws of your own jurisdiction.",
  },
];
