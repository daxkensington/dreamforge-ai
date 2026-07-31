# DreamForgeX — Operator Batch (the 3-hour fork)

**Status:** Product + checkout live. Revenue bottleneck is **distribution + payment rails**, not code.  
**Last code pass:** 2026-07-31  
**Live:** https://dreamforgex.ai · health OK · providers all-healthy · BTCPay invoices create OK  

Do this batch end-to-end, or park the product. Drifting burns attention.

---

## 0. Verified live (no action)

| Check | Result 2026-07-31 |
|---|---|
| `/api/health` | ok (db + env) |
| Providers | runpod / replicate / fal / runway healthy |
| BTCPay invoice create | OK on store DreamForgeX (`btc.paymohawk.com`) |
| Payment methods | **BTC-CHAIN only** (Lightning / USDC not enabled) |
| Default invoice expiry | 60 min store default → **code now requests 180 min** |
| Free uncensored previews | 3 / user after free sign-in + age confirm (no card) |
| SaaSHub directory | Submitted (await claim login) |

---

## 1. Payments (45 min) — highest conversion leverage

### 1a. Enable Lightning on BTCPay (do this first)

On-chain-only is a conversion tax (fees, wait, mobile wallet friction). Lightning kills all three for $4.99–$19 tickets.

1. Log into https://btc.paymohawk.com as store admin.
2. **DreamForgeX** store → Settings → **Lightning** → connect a node:
   - Preferred: **Phoenix / Voltage / Ride The Lightning** (or existing PayMohawk LN if shared).
   - Or internal BTCPay Lightning (LND/CLN) if already on the host.
3. Payment methods → ensure **BTC-Lightning** is enabled for the store.
4. Create a $4.99 test invoice → confirm QR offers **Lightning + on-chain**.
5. Pay a **$0.01–$1 LN test** from Phoenix/Wallet of Satoshi → confirm webhook settles → user gets pass.

### 1b. USDC / stablecoin (optional, +30 min)

BTCPay does not ship USDC natively. Options:

| Option | Effort | Notes |
|---|---|---|
| **BTCPay plugins** (USDT/USDC via third-party) | Medium | Check current plugin store for supported chains |
| **NOWPayments / CoinGate** second rail | Medium | Add server env + checkout branch; keep BTCPay as primary |
| Skip | 0 | Stick to BTC + Lightning; crypto-native buyers already have BTC |

**Recommendation:** Lightning first. USDC only if you see "I only have USDC" support tickets.

### 1c. Card rails for uncensored? (CCBill / Segpay)

Only if you want mainstream cards on adult SKUs.

1. Apply CCBill **and** Segpay (adult-friendly). Expect 1–3 weeks + reserve.
2. Do **not** put uncensored SKUs on Stripe (AUP termination risk). Stripe stays SFW-only.
3. After approval: new `createCardCheckout` path parallel to BTCPay; same entitlement grant.

---

## 2. Accounts (60 min) — unlock distribution packs

Create once; paste assets from `marketing/uncensored-distribution.md` and `marketing/`.

| Account | Why | Notes |
|---|---|---|
| **X / Twitter** `@dreamforgex` | NSFW-capable creator account | Enable adult content creator settings; aged handle preferred |
| **Civitai** | Crypto-native adult AI crowd | Bio + link `dreamforgex.ai/uncensored`; upload SFW model cards if you have them |
| **Discord** (own server) | Durable home base | `#showcase` `#prompts` `#support`; invite in bio |
| **AllMyLinks / Hoo.be** | Link-in-bio that allows adult | **Never** Linktree/Carrd (ban adult) |
| **Reddit** aged NSFW account | Supplementary only | 30+ days + real comments before any link post |
| **Google** (for TAAFT submit) | Directory | Same Google used for SaaSHub claim |
| **dev.to / Medium / Hashnode** | Launch article | Publish `marketing/launch-article.md` |

---

## 3. Distribution execute (60–90 min)

### SFW channels (directories + article) — build domain authority

Paste pack: `marketing/directory-pack.md` + `marketing/launch-article.md`

Priority order:
1. Claim/manage SaaSHub listing (speeds approval)
2. TAAFT free submit (Google login) or monthly indie X thread
3. AlternativeTo (register now if not done — 1-week wait)
4. AIxploria, Insidr, easywithai, DropYourAI (free forms)
5. Publish launch article on dev.to (canonical) → cross-post Medium/Hashnode
6. IndexNow already scripted: `node scripts/indexnow-ping.mjs`

**Never mention uncensored/18+ on SFW directories or Meta.**

### NSFW channels — conversion traffic

Paste pack: `marketing/uncensored-distribution.md`

1. Civitai profile + one value post (crypto-rail angle)
2. Own Discord invite + first showcase
3. 1–2 Discord foreign servers (`#self-promo` only, value-first)
4. X: 3 posts from the pack (hook = 3 free previews)
5. Reddit **last**, value-first, disclose maker, no spam

Compliance every time: **18+ · AI-generated · fictional only · no real people · no minors**.

---

## 4. Email reactivation (10 min)

Existing ~34 users never bought. Script is ready:

```bash
cd genesis-synth-lab
npx vercel env pull .env.local --environment=production --yes
node scripts/uncensored-winback.mjs --dry-run   # review list
node scripts/uncensored-winback.mjs --send      # deliver via Resend
```

Subject: free previews + $4.99 day pass. Idempotent tag `uncensored-winback-2026-07`.

---

## 5. SEO / Indexing (15 min)

```bash
node scripts/indexnow-ping.mjs          # Bing/Yandex/etc
node scripts/health-check.mjs           # includes /uncensored + demo
# GSC: request indexing for /uncensored and top /uncensored/* landers if still "Discovered"
```

---

## 6. Definition of done (90-day clock starts when you finish §1–§4)

| Day | Gate |
|---|---|
| D0 | Lightning live + accounts exist + winback sent + 5+ directory/social posts |
| D14 | ≥1 settled crypto invoice OR park decision review |
| D60 | ≥10 paid uncensored orders → keep investing; else park features, leave free tier |

---

## 7. What engineering already shipped (you don't need to re-do)

- Free 3-preview conversion hook + age gate + moderation
- Pricing ladder $4.99 / $12 / $19 + stacked entitlement webhook
- Inline BTCPay iframe checkout (no popup blocker)
- Invoice expiry **180 min** + MediumSpeed (1-conf) settle policy
- AggregateOffer JSON-LD for full price range
- FAQ honesty: free account required, no card
- Uptime probes cover `/uncensored` + demo
- Winback + IndexNow + this runbook

---

## 8. Park criteria (if you choose not to run the batch)

- Stop RunPod cold-start spend if idle (keep kill-switches)
- Leave site up: free SFW demo + free tier
- No new features until distribution resumes
- Document park date in portfolio audit

**Wrong answer:** neither batch nor park.
