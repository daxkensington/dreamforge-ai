# DreamForgeX — Uncensored-Tier Distribution Pack (NSFW channels)

Ready-to-publish assets for the uncensored pivot, STAGED for when accounts exist.
All legal, 18+, fictional-only, no real people/minors. Lead with value + the
"3 free previews, no card" hook. Generated 2026-06-24.

> Needs from operator: aged/ID-verified accounts per channel (Reddit, Discord,
> X Adult Content Creator, Civitai, AllMyLinks). I cannot create/verify these.
> Once they exist, these are paste-ready.



---

# Reddit + Community (NSFW-tolerant) Distribution Pack — DreamForgeX

> **Compliance frame for everything below (do not deviate):** 18+ only, AI-generated, fictional-only. No real people, no celebrities, no minors, no "undress/nudify" of real individuals. Every draft leads with a genuine tip and the no-friction hook ("3 free previews, no card"), discloses that you build the tool, and respects each community's self-promo norms. Do NOT post explicit content — describe the *capability*, link to the landing page, let the tool speak.

---

## PART 1 — Target Communities (8 real, currently-active, NSFW-AI-tolerant)

Reddit periodically nukes NSFW Stable Diffusion subs with little warning (this is a documented, recurring pattern — it happened to the original wave of SD-NSFW subs and the moderation goalposts move constantly). **Treat Reddit as supplementary, never load-bearing.** Discords and dedicated platforms are the durable distribution layer. Build the Discord/forum presence in parallel and do not let any single channel be a single point of failure.

| # | Community | Platform | Audience | Self-promo rules / risk |
|---|-----------|----------|----------|-------------------------|
| 1 | **r/unstable_diffusion** | Reddit | The flagship NSFW-SD audience — model/output sharing, prompt craft, uncensored generation. Highest-intent crowd for an uncensored tool. | Tool/self-promo *tolerated* but must be value-first and non-spammy; raw ads get removed. **High nuke risk** — Reddit has purged NSFW-SD subs before. Read current pinned rules each time; flair as NSFW; never post images of real people. |
| 2 | **r/sdnsfw** | Reddit | NSFW Stable Diffusion practitioners; workflow + checkpoint discussion. | Self-promo gray-area; contribute genuine value first. Same volatility/nuke risk as #1. Disclose authorship. |
| 3 | **r/aiartNSFW / r/AIGenArt (NSFW flair)** | Reddit | Broader AI-art crowd posting NSFW under flair; mixed skill level, discovery-friendly. | Promo allowed if framed as "I made a tool, here's a tip" + NSFW-flaired. Lower hostility than purist SD subs, but also lower intent. |
| 4 | **r/sdforall** | Reddit | "Open Stable Diffusion" community — explicitly pro-open-models, anti-censorship ethos. Receptive to an *uncensored, self-hosted* angle. | Self-promo OK when on-mission (open/uncensored tooling). Don't over-post. Best fit for the "no filter + self-hosted GPU, no provider bans" wedge. |
| 5 | **r/WaifuDiffusion / anime-NSFW SD subs** | Reddit | Anime/illustration NSFW generators (Pony/Illustrious/SDXL fine-tune crowd). | Tool sharing tolerated if you speak their model language. Keep it craft-first; avoid "buy now." |
| 6 | **Unstable Diffusion Discord** | Discord | The original NSFW-AI hub; thousands of generators and model tinkerers. Highest concentration of paying-intent users off-Reddit. | Has dedicated channels; most servers gate promo to a `#self-promo`/`#showcase` channel only. **Post only in the designated channel**, follow age-gate/NSFW rules, never DM-spam. Durable (not subject to Reddit's purges). |
| 7 | **"AI Render Den" / 21+ AI-art Discords (DISBOARD `ai-art`/`nsfwart` tags)** | Discord | 21+ AI-art communities with explicit SFW+NSFW channels, prompt-sharing, and events. Creator-centric, "no bot spam" culture. | Promo restricted to advertise/showcase channels; some require a contribution history first. Read pinned rules; respect "no bot spam." Find current active ones via DISBOARD `ai-art?nsfw=1` and `nsfwart` tags. |
| 8 | **CivitAI on-site + r/CivitaiArchives community** | CivitAI / Reddit | Post-card-ban CivitAI users — already crypto-native (CivitAI itself went crypto-only for adult features). Primed for "anonymous crypto payment." | CivitAI articles/posts allow tool mentions in context; the migration moment is your wedge ("card processors keep dropping adult AI — here's a crypto-paid, no-filter option"). Stay on-platform-policy; link out tastefully. |

**Operator note on account hygiene:** Use a dedicated, aged, NSFW-flagged Reddit account with real comment history *before* posting links — fresh accounts dropping links in NSFW-SD subs are auto-removed/shadowbanned. Same for Discord: be a member who talks for a few days before posting in `#self-promo`. Mirror every Reddit asset into at least two Discords so a sub purge never zeroes you out.

---

## PART 2 — Post Drafts (value-first, disclosed, native tone)

### Draft A — for r/sdforall or r/unstable_diffusion (the "open/uncensored" crowd)

**Title:** A tip for getting clean full-body anatomy out of SDXL fine-tunes (and why I stopped fighting hosted filters)

**Body:**
> One thing that fixed most of my "mangled anatomy / cropped at the worst moment" outputs: stop relying on a single mega-prompt and split it. Lock the framing and body pose in the positive prompt first (full body, specific camera distance, "full figure visible"), then push *everything* you don't want into the negative — including the stuff your sampler tends to hallucinate at the frame edges. Add a light hi-res fix pass at ~0.4 denoise instead of cranking resolution cold. Pony/Illustrious-lineage checkpoints respond way better to this than to one giant wall of tags.
>
> Disclosure so I'm not being sneaky: I got tired of hosted tools rejecting prompts that are completely legal fictional content, so I built my own — **DreamForgeX**. It's 18+, fictional-only, self-hosted on my own GPUs (so there's no provider yanking the model out from under it), and there's genuinely **no content filter** on legal fictional prompts. It's private by default, and you can pay anonymously with crypto if you ever upgrade.
>
> If you just want to test whether your prompt that "the other tools" keep refusing will actually run: there are **3 free previews, no card, no signup wall** — at dreamforgex.ai/uncensored. Even if you never pay, the prompt-splitting tip above works in any SDXL setup. Happy to answer workflow questions in the comments.

---

### Draft B — for r/CivitaiArchives / CivitAI-migration crowd (the crypto-native angle)

**Title:** PSA for anyone who got burned by the card-processor situation: crypto-paid, no-filter options exist now

**Body:**
> Quick context for folks who missed it: adult AI imagery is treated as "high-risk" by basically every card processor in 2026, which is why platforms keep abruptly losing payments and flipping to crypto overnight. If you've had a tool die on you mid-project, it's almost never the model's fault — it's the payment rail and the hosting provider getting cold feet.
>
> The practical takeaway: if uptime matters to you, favor tools that (a) run on their own GPUs instead of renting a provider that can ban them, and (b) accept crypto so a card processor can't pull the plug. That combination is what actually survives.
>
> Disclosure — I build one of these, **DreamForgeX**, specifically because I was tired of the rug-pulls. It's 18+, fictional-only (no real people, period), self-hosted, **no content filter on legal prompts**, private by default, and you can pay anonymously in crypto. There's a free taste — **3 previews, no card** — at dreamforgex.ai/uncensored if you want to see whether it handles the prompts that keep getting refused elsewhere.
>
> Not trying to dunk on anyone's favorite platform — just sharing the "own-GPU + crypto = doesn't disappear" heuristic, which is true regardless of which tool you pick.

---

### Draft C — for a Discord `#self-promo` / `#showcase` channel (short, native, low-friction)

> Built a tool for the exact problem this server complains about constantly: legal fictional prompts getting refused by hosted generators. **DreamForgeX** — 18+, fictional-only, **no content filter**, runs on my own GPUs (no provider bans), private by default, crypto-pay if you upgrade.
>
> Quick tip even if you never touch it: when a face comes out "off," it's usually the negative prompt doing too much — try pulling generic descriptors *out* of the negative and let the checkpoint cook; over-stuffed negatives flatten faces.
>
> Free to try the claim: **3 previews, no card, no signup** → dreamforgex.ai/uncensored. (I made it — feedback welcome, roast the outputs.)

---

### Draft D (optional, anime/illustration variant) — for r/WaifuDiffusion-style subs

**Title:** Getting consistent character anatomy across a set without ControlNet gymnastics

**Body:**
> If you're generating a character set and the proportions drift between images, the cheapest fix isn't ControlNet — it's locking a tight seed range + identical resolution + identical positive-prompt *ordering*, then only varying the action/pose tokens at the end of the prompt. Token order matters more than people admit on Pony/Illustrious-lineage models. Saves a ton of inpainting.
>
> Disclosure: I run **DreamForgeX** (18+, fictional-only, uncensored-on-legal-prompts, self-hosted, private, crypto-optional). If you want to test a prompt other tools keep refusing without committing anything, there are **3 free previews, no card** at dreamforgex.ai/uncensored. The seed/ordering tip works anywhere though — drop your set workflow below and I'll compare notes.


**Usage:** WHERE/HOW TO POST: All drafts are staged for the operator to publish manually AFTER creating accounts — do not auto-post. (1) Reddit: needs a dedicated, AGED Reddit account with genuine comment history and NSFW content enabled in profile settings; fresh accounts dropping links into NSFW-SD subs are auto-removed/shadowbanned. Always flair posts NSFW and re-read each sub's current pinned rules before posting (rules and even sub existence change frequently). (2) Discord: requires creating an account and JOINING each server, then posting ONLY in the designated #self-promo / #showcase / advertise channel after being an active member for a few days — never DM-spam, never post in general channels. Find current active servers via DISBOARD ai-art?nsfw=1 and nsfwart tags. (3) CivitAI: post on-platform articles/comments within their policy; link out tastefully.

LOGIN/ACCOUNTS NEEDED: dedicated NSFW Reddit account (aged + karma), Discord account joined to each target server, optional CivitAI account. None of these exist yet per the brief — operator must create them first. Recommend storing credentials in Vaultwarden.

RISK NOTES: (1) REDDIT IS VOLATILE — Reddit has repeatedly purged NSFW Stable Diffusion subreddits with no warning; treat Reddit as SUPPLEMENTARY, not load-bearing. Mirror every asset into 2+ Discords so a sub purge never zeroes the channel. (2) COMPLIANCE IS NON-NEGOTIABLE — every draft already states 18+, AI-generated, fictional-only, no real people/minors. Do not edit those lines out. Never respond to or fulfill any community request involving real-person likeness, celebrities, or minors; that ends the account and creates legal exposure. (3) SELF-PROMO — every draft discloses "I build this" because these communities punish stealth marketing harder than honest promotion. (4) Lead with the tip + "3 free previews, no card" hook, never "buy now." (5) Rotate which sub/server gets which draft; do not cross-post identical text simultaneously (spam filters + mod fatigue). (6) Payment processors treat adult AI as high-risk — the crypto angle in Draft B is both a selling point AND a reason to keep card rails out of any NSFW-channel messaging.


---

# X/Twitter Pack + Social Cadence (DreamForgeX)

> Compliance baseline applied to everything below: 18+ only, 100% AI-generated, fictional characters only, no real/identifiable people, no celebrities, no minors. All copy is tasteful (describes the capability, never explicit). Do not attach explicit media; use stylized/SFW key art or text-only. Pricing aligned to the live ladder: free taste = 3 previews (no card); paid passes $4.99 / $12 / $19; the $19 tier = 30-day Uncensored Pass.

---

## 1) Profile Bio (160 char max)

**Primary (148 chars):**
```
Uncensored AI image generator. No content filter. Self-hosted GPUs, private by default, pay in crypto. 100% AI, fictional, 18+. 3 free previews, no card.
```

**Alt A (139 chars):**
```
The AI art tool with no filter. Prompts other generators reject just render. Private. Crypto-paid. AI-only, 18+. Try 3 free previews, no card ↓
```

**Alt B (134 chars):**
```
No-filter AI image generator on our own GPUs. Private by default. Anonymous crypto. 100% AI · fictional · 18+. 3 free previews, no card.
```

**Profile fields**
- Display name: `DreamForgeX 🔞`
- Location field: `AI-generated · fictional only`
- Website: `https://dreamforgex.ai/uncensored`
- Pinned link / link-in-bio: same URL

---

## 2) Pinned Post

**Pinned (main):**
```
Pasted a prompt into Midjourney or DALL·E and hit "this violates our content policy"?

DreamForgeX has no content filter. Prompts other tools reject just render.

· Self-hosted GPUs — no provider AUP, no bans
· Private by default — never a public feed
· Pay in crypto — no card, no name
· 100% AI · fictional · 18+

3 free previews, no card → dreamforgex.ai/uncensored
```

**Pinned (alt, shorter):**
```
No content filter. No public gallery. No card.

DreamForgeX runs uncensored open-source Flux on GPUs we own — so the mature, artistic prompts mainstream tools reject just render. Private by default, paid anonymously in crypto.

100% AI · fictional · 18+
3 free previews, no card → dreamforgex.ai/uncensored
```

---

## 3) 10-Post Content Cadence

Suggested order interleaves the four buckets (capability teaser / wedge / free-taste / "tools that ban this vs us"). Post 1–2x/day max; rotate buckets so the feed doesn't read as one pitch on repeat. Every post is text-first or paired with stylized SFW key art.

**Post 1 — Wedge (no filter):**
```
Most AI art tools run a hidden safety checker that silently rewrites or rejects anything mature or edgy.

We run the raw open-source Flux models with that checker off.

You describe the image you actually want. It renders.

100% AI · fictional · 18+
dreamforgex.ai/uncensored
```

**Post 2 — Capability teaser (range):**
```
Film-noir chiaroscuro. Dark-fantasy succubus queens. Cyberpunk latex pinups. Classical oil-painting figure studies.

The whole mature-but-artistic range mainstream generators flatten or refuse.

All fictional. All AI. All yours, privately.

dreamforgex.ai/uncensored 🔞
```

**Post 3 — Free-taste hook:**
```
You shouldn't have to enter a card to find out if a tool actually works.

3 free previews. No card, no commitment.

If the prompt that got rejected everywhere else finally renders — then talk to us about a pass.

dreamforgex.ai/uncensored
```

**Post 4 — Tools-that-ban-this vs us (Midjourney):**
```
Midjourney's ToS bans adult content outright. There's no toggle, no "mature mode," no unlock hidden in the dashboard. It never will.

That's not a workaround problem. It's a wrong-tool problem.

DreamForgeX has no filter by design. 100% AI · fictional · 18+
dreamforgex.ai/uncensored
```

**Post 5 — Wedge (private):**
```
Privacy here isn't a toggle. It's the default.

· No public feed
· No community "explore" page
· Never used to train a model
· Just your own private workspace

What you make stays yours. 100% AI · 18+
dreamforgex.ai/uncensored
```

**Post 6 — Wedge (crypto):**
```
No card on file. No billing name. No "AI image" line item on a statement.

Pay anonymously in crypto — BTC, LTC, USDT, or Monero for max privacy.

Discreet from payment to generation.

100% AI · fictional · 18+
dreamforgex.ai/uncensored
```

**Post 7 — Capability teaser (self-hosted = no bans):**
```
The reason we can skip the filter: we own the GPUs.

No rented cloud compute, no third-party acceptable-use policy quietly overruling your prompt, no account bans handed down from upstream.

Just open-source Flux, running raw.

dreamforgex.ai/uncensored 🔞
```

**Post 8 — Tools-that-ban-this vs us (Civitai/card networks):**
```
Every card-dependent AI art platform eventually runs the same playbook: lose the processor → pull the adult content to stay solvent.

We don't depend on Visa or Mastercard's content rules. Crypto in, lights stay on.

100% AI · fictional · 18+
dreamforgex.ai/uncensored
```

**Post 9 — Free-taste hook (re-angle):**
```
The pitch is simple: try the prompt that keeps getting blocked.

3 free previews, no card. If it renders the way you described — clean, mature, fictional, fully AI — you'll know.

dreamforgex.ai/uncensored 🔞
```

**Post 10 — Capability teaser (anime/fantasy niche):**
```
Anime and fantasy creators get hit hardest by silent prompt-rewrites.

Anime-tuned + Flux checkpoints, uncensored, on our GPUs. Cel shading, painterly splash art, dark-fantasy worlds — your original characters, your way.

Fictional originals only · AI · 18+
dreamforgex.ai/uncensored
```

---

## 4) Ad-safe vs Organic-only note

**Treat ALL of the above as ORGANIC-only.** X paid ads run through ad-policy review that is far stricter than the ACC organic standard.

- **Ad-safe (paid promote candidates):** none of the explicit-adjacent angles. If you ever run paid, strip the 🔞, drop "uncensored/no filter/NSFW," and promote only the *neutral* wedge: "private, self-hosted AI image generator · pay with crypto · 3 free previews, no card." Even then, X frequently disallows adult-brand ads outright — assume paid promotion of this account will be rejected and don't budget on it.
- **Organic-safe (the cadence above):** fine under the **Adult Content Creator (ACC) enrollment** — requires verified government ID + selfie and toggling your account to mark adult media. Until ACC is approved, post text-only versions and remove the 🔞 from the bio (the emoji + adult framing pre-ACC risks a label/lock).
- **Media rule:** never post explicit media even organically without ACC; mark adult media as sensitive once enrolled. Key art should be stylized/suggestive-at-most, never explicit.
- **Link rule:** keep the link in posts (not just bio) only after the account is in good standing; brand-new adult accounts dropping the same link every post can trip spam heuristics. Vary CTA wording (done above) and don't post identical text twice.
- **Disclosure:** "I build this" is implicit (it's the brand account), so no separate maker-disclosure needed on X — that norm is for community subs/forums, not a first-party brand handle.

---

## 5) 3-Line Teaser (other adult-allowed microblogs)

For Bluesky (adult labels enabled), Sharesome, or similar adult-tolerant microblogs:

```
No content filter. The mature, artistic prompts Midjourney and DALL·E reject just render — on GPUs we own, private by default, paid anonymously in crypto.
100% AI-generated · fictional characters only · 18+.
3 free previews, no card → dreamforgex.ai/uncensored
```


**Usage:** WHERE/HOW TO POST: All assets are for the @DreamForgeX X/Twitter account (operator must create it) plus adult-tolerant microblogs (Bluesky with adult labels, Sharesome, etc.). The bio/pinned/cadence are X-specific; the 3-line teaser is for other microblogs.

ACCOUNT/LOGIN NEEDED: (1) An X account dedicated to the brand. (2) Adult Content Creator (ACC) enrollment BEFORE posting any of this with the 🔞 framing or any media — ACC requires verified government ID + selfie and marking the account/media as adult. Until ACC is approved, post text-only and drop the 🔞 from the bio to avoid an early label/lock. (3) For Bluesky/Sharesome, enable each platform's adult content labels on the profile.

RISK NOTES: 
- Treat everything as ORGANIC-only. X paid ads almost certainly reject adult-brand promotion; do not budget on paid reach. A neutral "private AI generator, crypto, free previews" variant is the only thing that might pass ad review, and even that is unreliable.
- Pricing: copy uses the live ladder — free 3 previews (no card) as the hook, $19/30-day Uncensored Pass as the top tier. The landing files (shared/uncensoredLanding.ts) describe the Pass as $19/30 days; the brief's $4.99/$12 lower tiers are reflected only as "passes" generically, so confirm the exact tier labels on the live checkout before quoting specific lower prices in any post.
- Compliance is load-bearing: never attach explicit media, never imply real people/celebrities/minors, never use "undress/nudify" framing. Keep the 18+/AI/fictional disclaimers in posts that show or imply mature capability.
- Anti-spam: vary CTA wording (already varied across the 10 posts), cap at 1–2 posts/day, and don't repeat identical text — brand-new adult accounts repeating one link get flagged fast.
- Relevant source file (positioning + claims to stay consistent with): C:\Users\ianwe\genesis-synth-lab\shared\uncensoredLanding.ts


---

# NSFW Directories + Link-in-Bio + Civitai Pack

## DreamForgeX — Distribution Pack: NSFW Directories, Link-in-Bio, Civitai

All copy below is tasteful/professional. It describes the *capability* (uncensored, fictional-only, 18+), never explicit content. Compliance line is baked into every asset: **18+ only · AI-generated · fictional characters only · no real people, no minors.**

---

### PART 1 — TARGET DIRECTORY LIST (~8 NSFW-tolerant submission targets)

| # | Directory | Submit URL | Free / Paid | Notes |
|---|-----------|-----------|-------------|-------|
| 1 | **AI Haven** (self-billed "#1 uncensored AI directory") | https://aihaven.com/contribute/ | Standard listing free-ish + paid **Featured** tier | Reviews in 3–5 days (1–2 for Featured). They actually sign up & test the tool — make the 3-free-previews flow obvious. Strongest single target. |
| 2 | **There's An AI For That (TAAFT)** | https://theresanaiforthat.com/submit / launch page | Paid one-off submit; **free** via their monthly indie X thread + occasional free pick | Huge traffic, lists NSFW. Full refund if rejected. Use the "free taste" hook to pass editorial. |
| 3 | **Artificin** (NSFW AI catalog) | https://artificin.com (use site "Submit / Add tool" / contact) | Free listing | Category-driven NSFW directory (image gen, companions). Good for the /uncensored silo backlink. |
| 4 | **pandorasbox.ai** | https://pandorasbox.ai/nsfw (contact / submit form) | Free + featured | Adult-AI reviews + tool collection; the "futurepedia of adult AI." High topical relevance. |
| 5 | **AIapps — AI NSFW category** | https://www.aiapps.com/categories/ai-nsfw/ (submit a tool) | Free + paid feature | Curated, editor + community rated. Submit to the AI-NSFW category specifically. |
| 6 | **Toolify.ai** | https://www.toolify.ai/submit | Free + paid fast-track | General but NSFW-tolerant; strong SEO. List under adult/uncensored category. |
| 7 | **Promptus.ai (uncensored generator hub)** | https://www.promptus.ai (contact/submit) | Free | Aggregates uncensored generators; relevant adjacency + backlink. |
| 8 | **Face-Swap.ai / NSFW AI Tools hub** | https://www.face-swap.ai/en/nsfw-ai-tools (contact/submit) | Free | NSFW tools aggregator; good for the no-filter angle. |

**Operator note on each:** verify the live "submit/add/contribute" link before pasting (forms move). For any that gate behind email, send the *medium* description below + the landing URL `https://dreamforgex.ai/uncensored`. Decline any directory that hosts or implies real-person/undress content for those specific cross-links — keep DreamForgeX's listing in the fictional/uncensored-generation lane only.

---

### PART 2 — PASTE-READY LISTING BLOCK (drop into any directory form)

**Name:** DreamForgeX

**Category (primary):** Uncensored / NSFW AI Image Generator
**Category (secondary):** AI Art Generator · Privacy-First AI · Crypto-Paid AI Tools

**Tagline (≤60 chars):**
`Uncensored AI image generator. No filter. 3 free previews.`

**Tags:**
`uncensored-ai`, `nsfw-ai`, `no-filter`, `ai-image-generator`, `self-hosted`, `private`, `crypto-payment`, `anonymous`, `18-plus`, `ai-art`, `fictional`, `no-signup-trial`

**Short description (~100 chars):**
`Uncensored 18+ AI image generator. Prompts other tools reject just work. 3 free previews, no card.`

**Medium description (~250 chars):**
`DreamForgeX is an uncensored, 18+ AI image generator for fictional art. Prompts that mainstream tools silently reject just work here — self-hosted GPUs mean no provider bans, and generations stay private by default. Pay anonymously with crypto. Try 3 free previews, no card. AI-generated, fictional characters only.`

**Long description (~500 chars):**
`DreamForgeX is an uncensored, 18+ AI image generator built for adult fictional art — the kind of prompts mainstream generators silently reject or downgrade. Because it runs on self-hosted GPUs instead of third-party APIs, there are no provider content bans and no surprise account suspensions. Privacy is the default: generations aren't mined or resold, and you can pay anonymously with crypto — no card, no identity trail. Test the engine first with 3 free previews (no signup, no card), then unlock a one-time pass from $4.99. Strictly AI-generated, fictional characters only — no real people, no minors, no illegal content. Explore the uncensored gallery and prompt guides at dreamforgex.ai/uncensored.`

**Primary URL:** `https://dreamforgex.ai/uncensored`
**Pricing line:** `Free: 3 previews (no card). Passes: $4.99 / $12 / $19.`
**Maker disclosure (where the form asks):** `Submitted by the maker.`

---

### PART 3 — LINK-IN-BIO PAGE COPY (AllMyLinks-style; adult-safe)

> Use **AllMyLinks** (or another adult-tolerant bio host like Hoo.be/Bio.fm). **Do NOT use Linktree or Carrd** — both ban adult content and will delist the page.

**Display name:** DreamForgeX
**Handle:** @dreamforgex
**Avatar/banner alt-text:** "DreamForgeX — uncensored AI art studio (AI-generated, fictional)"

**Bio (header):**
`Uncensored AI image generator · 18+ · No content filter · Private by default · Pay with crypto. AI-generated, fictional characters only. 3 free previews, no card.`

**Links (in order):**
1. `Try it free — 3 previews, no card` → https://dreamforgex.ai/uncensored
2. `Uncensored gallery & styles` → https://dreamforgex.ai/uncensored
3. `Prompt guides (what other tools reject)` → https://dreamforgex.ai/uncensored
4. `Pricing — passes from $4.99 (crypto)` → https://dreamforgex.ai/uncensored
5. `Civitai profile` → (paste your Civitai URL once created)
6. `How privacy & crypto payment work` → https://dreamforgex.ai/uncensored

**Footer / compliance block (pin at bottom):**
`18+ only. All images are AI-generated depictions of fictional characters. No real people, no minors, no illegal content. By visiting you confirm you are of legal age in your jurisdiction.`

---

### PART 4 — CIVITAI PROFILE + MODEL/RESOURCE DESCRIPTION BLURB

> Civitai allows third-party links and lists external tools, but **monetization features are restricted on anything depicting real people** — keep everything fictional and you're clear. Put the link in your profile bio and in resource descriptions; don't spam it in DMs (links there don't hyperlink anyway).

**Civitai profile bio (~short):**
`Building DreamForgeX — an uncensored, self-hosted 18+ AI image generator for fictional art. No content filter, private by default, anonymous crypto checkout. 3 free previews, no card → dreamforgex.ai/uncensored. AI-generated, fictional only — no real people, no minors.`

**Civitai model / resource description blurb (attach to anything you upload):**
`Generated with DreamForgeX — a self-hosted, uncensored 18+ AI image generator for fictional characters. If you like this style and want to run prompts mainstream tools reject, you can try the engine free (3 previews, no card) and pay anonymously with crypto: dreamforgex.ai/uncensored.

Compliance: all outputs are AI-generated depictions of fictional characters only. No real people, no celebrity likenesses, no minors, no illegal content. 18+.`

**Civitai "About / links" field:**
`Website: https://dreamforgex.ai/uncensored — uncensored AI image generation, self-hosted, crypto-paid, private.`

**Usage:** WHERE/HOW TO POST: (1) Directories — submit the Part 2 block via each "Submit/Add/Contribute" link in Part 1. Strongest first: AI Haven (aihaven.com/contribute), TAAFT (free via their monthly indie X thread to avoid the paid fee), pandorasbox.ai, Artificin, AIapps NSFW category, Toolify, Promptus, Face-Swap.ai. Always paste the medium description + https://dreamforgex.ai/uncensored. Verify each live submit URL first — adult-directory forms move/rotate. (2) Link-in-bio — create the page on AllMyLinks (or Hoo.be/Bio.fm); NEVER Linktree or Carrd (they ban adult and will delete it). (3) Civitai — set bio + add the resource blurb to any upload; link in profile/about fields, not DMs.

ACCOUNTS/LOGINS NEEDED (operator must create, staged): AllMyLinks account; Civitai account; email for directory submissions (use a dedicated address, e.g. the DreamForgeX support inbox, not a personal one — submissions get newsletter/upsell mail). TAAFT free route needs an X/Twitter account to catch their monthly indie thread; paid route needs a card. Featured tiers on AI Haven / AIapps / Toolify are paid — decide budget before submitting.

RISK NOTES: Keep DreamForgeX strictly in the fictional/uncensored-generation lane — do NOT let the listing appear on or cross-link with undress/nudify/real-person/celebrity pages some of these directories also host (Civitai restricts monetization on real-person content; payment processors and app stores ban real-person undress outright). The 18+/AI-generated/fictional-only/no-minors compliance line is included in every asset and must stay attached. Lead with the free-taste hook ("3 free previews, no card"), not "buy now," per the platform self-promo norms. Disclose maker status where forms/Civitai expect it ("Submitted by the maker"). Re-confirm dreamforgex.ai/uncensored is the correct live landing path before mass-submitting, since the URL is hardcoded across every asset.

SOURCES: aihaven.com/contribute, theresanaiforthat.com (launch/get-featured + free monthly thread), artificin.com/ai-tools/nsfw, pandorasbox.ai/nsfw, aiapps.com/categories/ai-nsfw, toolify.ai, promptus.ai, face-swap.ai/en/nsfw-ai-tools, civitai.com/content/tos + civitai.com/safety.
