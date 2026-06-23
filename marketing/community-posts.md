# DreamForgeX — Community & Reddit Distribution Pack

A field guide for sharing DreamForgeX in AI/creator communities **without getting banned or downvoted into oblivion**. Everything here is 100% SFW. Do **not** mention the Uncensored/18+ tier in any of these channels — Reddit, Discord, and directories below all ban adult content and will permaban for it.

**Golden rules before you post anywhere:**
1. **9:1 rule.** For every 1 post that mentions DreamForgeX, make ~9 genuine non-promo contributions in that community first. Comment on others' work, answer questions, share prompts. Cold accounts that show up only to drop a link get auto-filtered and reported.
2. **Always disclose.** Add "Full disclosure: I built this / I work on this." Communities reward honesty and permaban stealth marketing.
3. **Lead with value, not the link.** A tip, a free thing they can try with no signup, or a real comparison. The link is a footnote, not the headline.
4. **Read the sidebar/rules the day you post.** Rules change and mods are strict. When in doubt, use the weekly "self-promo" / "show & tell" megathread instead of a standalone post.
5. **Use the free no-signup demo as the hook** — `https://dreamforgex.ai/demo/text-to-image` (1 image/day, no card, no account). "Try it, no signup" is far more clickable and rule-safe than "sign up at my site."

---

## Community Map (~10 targets)

| Community | Rough audience | Self-promo rules / risk | How to play it |
|---|---|---|---|
| **r/StableDiffusion** | ~2M+; the hub for open-source / local image gen, very tool-savvy | Direct "check out my product" promo gets removed; deeply allergic to closed SaaS being passed off as cool. They respect **self-hosted/open models**. | **High value, high risk.** Lead with the self-hosted Flux/CogVideoX angle and a genuine comparison or workflow. Disclose. Never spammy. |
| **r/comfyui** | Node-based SD power users; technical | Strict-ish; tolerates tools when framed as workflow/utility, not ads | Only post if you have a real ComfyUI-relevant angle (e.g. self-hosted backend). Otherwise skip. |
| **r/LocalLLaMA** | Local-model / self-hosting crowd; cares about not being locked into big-cloud APIs | Self-promo OK if **under ~10%** of your activity; they sniff out marketers fast | The "we run our own GPU fleet" story resonates here. Be technical and humble. |
| **r/aiArt** | ~670K; AI image/art enthusiasts, more casual than r/SD | Showcase-friendly, but link-only "my tool" posts get flagged | Post output + prompt as art; mention the tool in a comment or P.S., not the title. |
| **r/MediaSynthesis** | ~45K; synthetic media (image/audio/video) generalists | Moderately promo-tolerant for genuinely novel tools | Good fit for the "one credit pool across image+video+audio" angle. |
| **r/artificial** | Large, general AI news/discussion | Promo tolerated only if it's a real discussion contribution, not an ad | Use for a discussion post (e.g. self-hosting vs. API economics), tool as example. |
| **r/SideProject** | ~300K; indie makers, founders | **Self-promo welcomed** — that's the point. But needs a story, not a bare link. Engage with others' projects. | One of your safest standalone "I built this" posts. Tell the build story. |
| **r/IMadeThis** | ~33K; explicitly for showing what you made | **Self-promo allowed by design** | Low-risk place to post a build/showcase. Smaller reach. |
| **r/SaaS** | Founders/SaaS operators | Promo **only** in the weekly "Show & Tell Saturday" thread | Drop a value-framed comment in that thread; never a standalone ad. |
| **AI-creator Discords** (e.g. tool-agnostic "AI creators" servers, Learn Prompting) | Image/video/audio AI creators, beginners→pros | Many have a dedicated **#self-promo / #showcase** channel — use ONLY that channel | Post output in showcase, link in self-promo channel, be active in chat first. |

**Avoid / handle with extreme care:**
- **r/InternetIsBeautiful** — bans anything with a signup. The *demo* technically needs no signup, but mods are strict; high removal risk. Skip unless you're confident.
- **Midjourney / Stability official Discords** — promoting a competing product = instant ban. Participate as a community member only; do not pitch.
- **r/ChatGPT** — huge but heavy promo filtering and off-topic for image/video. Low ROI.
- **Any subreddit during a "no self-promo" week or without a megathread** — wait for the thread.

---

## Post Draft 1 — r/StableDiffusion / r/LocalLLaMA (self-hosting angle, value-first)

**Format:** discussion + genuine info. Disclose clearly. This is the highest-trust audience, so the value has to be real.

> **Title:** We put Flux, CogVideoX, MusicGen and RMBG-2.0 on our own RunPod GPUs instead of renting cloud APIs — here's what we learned about cost and control
>
> **Body:**
>
> Full disclosure up front: I work on DreamForgeX, so I'm biased — but I wanted to share the actual engineering tradeoffs because this sub is one of the few places that cares about *not* being locked into someone else's API.
>
> We made a deliberate choice to **self-host** the open models (Flux Pro/Dev/Schnell, CogVideoX for video, MusicGen + AudioGen for audio, CatVTON, Bark TTS, Real-ESRGAN upscaling, RMBG-2.0 for background removal) on our own RunPod GPU fleet rather than just reselling closed APIs.
>
> A few things that surprised us:
> - **Background removal (RMBG-2.0) self-hosted is shockingly good and cheap** vs. paid remove-bg APIs. If you only take one thing from this post, try RMBG-2.0 locally — it's a quality jump over the older U2Net stuff.
> - **Real-ESRGAN as a final pass** beats most "AI upscaler" SaaS for the price (i.e. free if you have the GPU). Schnell-draft → ESRGAN upscale is a great fast pipeline.
> - **MusicGen/AudioGen** are underrated for placeholder scoring; self-hosting means no per-generation API tax.
> - The hard part isn't the models, it's **keeping a warm GPU pool** so cold starts don't wreck the experience. That's most of the work.
>
> If you want to A/B our hosted Flux output against your local setup without installing anything, there's a no-signup demo (1 free image/day, no card): https://dreamforgex.ai/demo/text-to-image — genuinely curious how it stacks up against your local Flux on the same prompt.
>
> Happy to answer anything about the self-hosting side in the comments.

*Tips: Post mid-week, daytime US/EU. Reply to every comment. If a mod removes it, don't repost — message them and ask where it belongs. Do NOT cross-post the identical text to both subs same day; space them out and tweak the intro.*

---

## Post Draft 2 — r/SideProject / r/IMadeThis (build story, makers love this)

**Format:** "I built this" with a real story. These subs *want* this — just give them narrative + something to try.

> **Title:** I got tired of paying for 6 different AI tools, so I built one studio with a single credit pool across 30+ models
>
> **Body:**
>
> Maker disclosure: this is my project (DreamForgeX), sharing the build because this sub gets the "death by a thousand subscriptions" problem.
>
> The itch: I was paying separately for an image generator, a video tool, an upscaler, a background remover, a TTS tool, and a music generator — six logins, six bills, six credit systems, and credits I'd already paid for evaporating because I switched tools mid-project.
>
> So I built an all-in-one creative studio: **100+ tools across image, video, and audio, 30+ models, one credit pool.** Use credits on a Flux image, then a CogVideoX clip, then MusicGen for a soundtrack — same balance, no per-tool subscription.
>
> The part I'm actually proud of (and the hardest): a bunch of the models are **self-hosted on our own RunPod GPUs** instead of just being API resells — Flux, CogVideoX, MusicGen/AudioGen, Real-ESRGAN, RMBG-2.0, Bark, CatVTON. That's what makes the single-credit-pool economics work.
>
> If you want to kick the tires with zero commitment, there's a **no-signup demo — 1 free image/day, no card, no account:** https://dreamforgex.ai/demo/text-to-image. Free signup bumps you to 50 credits if you want to try the video/audio stuff.
>
> Honest question for this sub: for an all-in-one tool, do you prefer one credit pool (simple, what I built) or per-feature pricing (predictable)? Genuinely deciding how to evolve the pricing and would value the room's take.

*Tips: The ending question drives comments, which drives ranking. Reply to everyone. On r/IMadeThis the same post works; trim the question if it feels too "founder-y." Engage with 3-4 other projects in the sub before and after posting.*

---

## Post Draft 3 — r/aiArt / r/MediaSynthesis (showcase-first, link in P.S.)

**Format:** Lead with the *art and a usable tip*. The tool is a footnote. This is how you survive showcase-strict subs.

> **Title:** A 3-step "draft fast, then upscale" workflow that fixed my blurry AI images (prompt + settings inside)
>
> **Body:**
>
> Sharing a workflow that finally got me crisp results instead of the usual soft/mushy AI look. Works with basically any Flux-style setup, not specific to one tool:
>
> 1. **Draft cheap and fast** with a Schnell-type fast model to lock in composition — don't waste your best model on exploration. Iterate the prompt here.
> 2. **Re-roll the winner on a higher-quality model** (Flux Dev/Pro tier) once the composition is right.
> 3. **Final pass through Real-ESRGAN upscaling**, then RMBG-2.0 if you need a clean cutout for compositing. This last step is what makes it look "finished" instead of "AI."
>
> Prompt I used for the attached image: *[paste your real prompt + key settings here — this is the value, don't skip it]*
>
> The draft→quality→upscale loop is the single biggest quality jump I've found, and it's faster than brute-forcing your best model from the start.
>
> P.S. — full disclosure, I build DreamForgeX, which is where I run this pipeline (image + upscale + bg-removal in one place, self-hosted models). If you just want to try the image step with no signup it's here: https://dreamforgex.ai/demo/text-to-image (1/day, no card). But honestly the workflow above works on whatever you already use — that's the point of the post.

*Tips: **You must attach a real generated image** for this to work in showcase subs — text-only reads as an ad. Put the genuine prompt in. Keep the P.S. short. If the sub has a "no tool links in body" rule, move the link to your first comment instead.*

---

## Quick do/don't recap

- **Do** rotate communities and space posts days apart — don't blast the same text everywhere in one afternoon (that's the #1 ban trigger).
- **Do** put the **no-signup demo** link forward over the signup page — it's friendlier and rule-safer.
- **Do** disclose, every time.
- **Don't** ever mention the 18+/Uncensored tier in any of these channels — instant permaban and brand damage.
- **Don't** post in official competitor Discords (Midjourney/Stability) — participate only.
- **Don't** repost after a removal — message the mod and ask where it belongs.
