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
    a: "Yes. Uncensored generations run on open-source models (Flux & Wan 2.1 Video) on our own GPUs with no content filter, so prompts the standard SFW models reject just work. It never routes through Cloudflare, OpenAI, Stability, or Grok, which prohibit this content. Illegal content (CSAM, real-person deepfakes) is still refused.",
  },
  {
    q: "Can I try it free?",
    a: "Yes. After a free sign-in (Google or GitHub — no card, no payment info), you get 3 watermarked uncensored previews. Confirm you're 18+, generate, then upgrade only if you like the output. Free previews are private and never enter the public gallery.",
  },
  {
    q: "How do I pay? Can I use Visa, Mastercard, Apple Pay, or Bitcoin?",
    a: "Yes — both! You can unlock in 1 click with Visa, Mastercard, Apple Pay, or Google Pay by purchasing a standard DreamForgeX credit pack ($4.99 / $14.99 / $19.99 via Stripe) — your Uncensored Pass activates automatically on return and any leftover credits stay in your Studio balance. Or you can pay anonymously with Bitcoin (Lightning settles instantly, and an on-chain QR payment unlocks when seen in the mempool, not after a block confirmation) from $4.99 and receive up to +500 bonus Studio credits.",
  },
  {
    q: "How does Card / Apple Pay checkout work vs. Bitcoin?",
    a: "When you choose Card / Apple Pay, Stripe bills for a standard DreamForgeX compute credit pack (`DREAMFORGEX AI CREDITS`) and our platform automatically redeems the required credits (400 / 1,200 / 2,000 cr) to unlock your pass while keeping your leftover credits in your wallet. When you choose Bitcoin, you pay through our self-hosted BTCPay invoice with zero card or bank statement footprint plus bonus credits.",
  },
  {
    q: "Are my uncensored generations private?",
    a: "Yes. Anything you make in uncensored mode is kept private by default in your personal Vault — it can never enter the public gallery or be exposed on a public share link.",
  },
  {
    q: "What do the passes include?",
    a: "Every pass unlocks all 7 Uncensored Pro Studio tools (Image Studio + Face Lock, 5–10s Video, 4-View Character Sheet, Virtual Outfit Swap, Brush Inpaint, Refine & Relight, and Private Vault). Day Pass: 24 hours (400 credits / $4.99 card pack, or $4.99 BTC + 60 bonus credits). Week Pass: 7 days (1,200 credits / $14.99 card pack, or $12 BTC + 250 bonus credits). 30-Day Pass (best value): 30 days (2,000 credits / $19.99 card pack, or $19 BTC + 500 bonus credits). All passes are one-time with no auto-renew.",
  },
  {
    q: "Is any illegal content allowed?",
    a: "No. All content is AI-generated and fictional, and external photo uploads are disabled so real individuals can never be depicted. No real people, no celebrities, no minors — ever. You are responsible for complying with the laws of your own jurisdiction.",
  },
];
