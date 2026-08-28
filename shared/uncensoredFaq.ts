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
    a: "Yes. Uncensored generations run on open-source models (Flux Schnell) on our own GPUs with no content filter, so prompts the standard SFW models reject just work. It never routes through Cloudflare, OpenAI, Stability, or Grok, which prohibit this content. Illegal content (CSAM, real-person deepfakes) is still refused.",
  },
  {
    q: "Can I try it free?",
    a: "Yes. After a free sign-in (Google or GitHub — no card, no payment info), you get 3 watermarked uncensored previews. Confirm you're 18+, generate, then upgrade only if you like the output. Free previews are private and never enter the public gallery.",
  },
  {
    q: "How do I pay? Do I need a credit card?",
    a: "No card. You pay anonymously with Bitcoin through a self-hosted BTCPay invoice (QR or address). Passes start at $4.99 for a day, $12 for a week, or $19 for 30 days — each a one-time payment with no auto-renew. Invoices stay open 3 hours. Your pass unlocks as soon as the payment is seen (mempool), not after a block confirmation.",
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
    q: "What do the passes include?",
    a: "Day Pass ($4.99): 24 hours + 60 bonus credits. Week Pass ($12): 7 days + 250 credits. 30-Day Pass ($19, best value): 30 days + 500 credits. All are one-time — nothing recurring. Time stacks if you renew while still active.",
  },
  {
    q: "Is any illegal content allowed?",
    a: "No. All content is AI-generated and fictional. No real people, no celebrities, no minors — ever. You are responsible for complying with the laws of your own jurisdiction.",
  },
];
