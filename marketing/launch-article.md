# I Self-Hosted a 9-Model AI Stack on My Own GPUs — Here's the Full Toolchain and What It Cost

For about a year I built on top of hosted inference APIs — Replicate, the BFL Flux API, OpenAI's image endpoints. They're great until you do the math at scale. A Flux Dev image runs about **$0.025** on Replicate. A six-second video clip can run **$0.50–$1.00**. When you're running a creative tool where people generate thousands of images a day, the API bill stops being a rounding error and starts being the whole P&L.

So I moved the open-source half of my model stack onto GPUs I rent directly, on RunPod Serverless. This is the write-up I wish I'd had before I started: the exact models, the GPU choices, the real per-image costs, and the parts that are genuinely *not* worth self-hosting. No hand-waving, no "10x cheaper!" with no numbers.

## What's actually in the stack

Nine model types, all open-weights, all running on infrastructure I control:

- **Flux.1 Dev** — high-quality text-to-image (20 steps)
- **Flux.1 Schnell** — fast text-to-image (4 steps)
- **Flux.1 Pro-tier** — via a Dev pipeline with quality tuning
- **CogVideoX** — text/image-to-video
- **MusicGen** — music generation
- **AudioGen** — sound-effect generation
- **Real-ESRGAN** — 4x upscaling
- **RMBG-2.0** — background removal
- **CatVTON / Bark TTS** — virtual try-on and text-to-speech

The thing I underestimated: most of these are *small*. Real-ESRGAN and RMBG-2.0 run in under 4GB of VRAM and finish in 1–2 seconds. They don't need their own machine. They can ride along on the same GPU that's already loaded for Flux. More on that below, because it's the single biggest cost lever.

## GPU choice: the A40 is the boring correct answer

There's a temptation to reach for an A100 80GB because it benchmarks fastest. Don't, unless you're batching hard. Here's what the numbers actually looked like for Flux on RunPod (active-worker pricing):

| GPU | VRAM | Cost/sec | Flux Dev (20 steps) |
|-----|------|----------|---------------------|
| A100 80GB | 80GB | $0.00060/s | ~10–15s |
| L40S | 48GB | $0.00037/s | ~15–20s |
| **A40** | **48GB** | **$0.00024/s** | **~18s** |
| RTX 4090 | 24GB | $0.00021/s | ~20–30s |
| L4 | 24GB | $0.00013/s | slow for Flux |

The A40 is roughly **60% cheaper per second than the A100** and still has 48GB — enough VRAM to hold Flux *plus* the upscaler *plus* the background remover resident at once. The A100 is faster per image, but not 2.5x faster, so the price-per-image math favors the A40 for everything short of high-volume batch work.

That works out to about **$0.0043 per Flux Dev image** self-hosted (~18s × $0.00024/s) versus **$0.025** on the API. That's the headline: an **~83% cut** on my single highest-volume operation.

## The cost lever nobody tells you about: Flex vs Active workers

This is where most "I self-hosted and it was cheaper" blog posts quietly fall apart. If you keep a GPU running 24/7 (an "active" worker), you pay for every idle second. At low volume that's a disaster — you can easily spend *more* than the API you were trying to escape.

RunPod's **Flex workers** scale to zero. You pay only during actual inference. With FlashBoot, cold starts drop to roughly a second instead of 10–15. The tradeoff is real but small for most workloads.

The break-even points I worked out for my traffic:

- **Flex workers:** profitable past ~3,000 Flux Dev generations/month
- **1 Active A40 (~$620/mo always-on):** needs ~25,000 generations/month to beat the API

My rule: **start on Flex, only pin an active worker once you have sustained traffic that justifies it.** Below ~5,000 generations a month, honestly, just use the APIs and skip the operational overhead. Self-hosting is a scale play, not a hobby flex.

## One endpoint, many models

The architecture decision I'm happiest with: **one serverless endpoint, routed by a `task` field in the request payload.** Same Docker image, same GPU, different code path:

```json
{
  "input": {
    "task": "flux-dev",
    "prompt": "a serene mountain landscape at sunset",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 20,
    "guidance_scale": 7.5
  }
}
```

```json
{
  "input": {
    "task": "rmbg",
    "image_b64": "<base64-encoded-image>"
  }
}
```

Because RMBG-2.0 and Real-ESRGAN are tiny, bundling them onto the Flux GPU makes their marginal cost effectively **upscaling at ~$0.0005/image and background removal at ~$0.0003/image** — versus ~$0.005 each via API. That's a 90%+ cut on operations I was treating as throwaway side features. Once they're free, you start offering them everywhere.

## The honest part: what I did NOT self-host

Self-hosting is not a religion. Some things stay on APIs and that's correct:

- **GPT Image / DALL-E, Grok, Veo 3, Gemini, Claude** — proprietary, not open-weights, can't self-host them at any price. Don't pretend otherwise.
- **Video, mostly.** CogVideoX works, but at 2–5 minutes per clip on an A40 it's the most GPU-hungry thing in the stack (~$0.07–$0.18/video). I keep a hosted video model as primary and run CogVideoX as a fallback/cost-control option, not the default.
- **LLMs.** Running your own 70B for chat features is a money pit compared to per-token API pricing. Use the API.

The pattern: **self-host the open image/audio models where the savings are real and the quality gap is zero, keep the API fallback chain wired up for everything else.** If RunPod has a cold-start spike or an outage, requests fall through to the hosted provider automatically. Self-hosting should lower your costs without lowering your reliability.

## LoRA fine-tuning is almost free, and that's the sleeper feature

Once you control the Flux pipeline, training your own style LoRAs costs **$2–10 each, one-time.** A rank 64–128 LoRA on a single A100 takes 30–90 minutes and gets you ~95% of full fine-tune quality at ~5% of the cost. LoRA weights are 50–200MB and load on top of the base model at inference — no separate endpoint, no extra GPU cost.

That means "house" models become a near-zero-cost differentiator instead of a research project. If you're running open-weights, there's almost no reason *not* to have a few signature styles.

## Where this lives

I built this stack for [DreamForgeX](https://dreamforgex.ai), an all-in-one AI creative studio — 100+ tools across image, video, and audio, 30+ models behind a single credit pool, the self-hosted GPU fleet above doing the heavy lifting on the open models. One pool of credits spends across everything, so you're not juggling five different billing dashboards to make one piece of content.

If you just want to see Flux output without the architecture lecture, there's a [free no-signup demo](https://dreamforgex.ai/demo/text-to-image) — one image a day, no card, no account. It's the same self-hosted pipeline described here. Useful as a sanity check on whether the quality holds up before you go build your own.

## The takeaways

1. **Self-hosting is a scale decision.** Under ~5,000 generations/month, APIs win. Run the numbers before you build anything.
2. **Flex workers, not active workers** — until sustained traffic justifies pinning a GPU.
3. **The A40 (48GB) is the price/performance sweet spot** for Flux-class models.
4. **Bundle the tiny models** (upscale, bg-removal) onto the same GPU. Their marginal cost rounds to zero.
5. **Keep the API fallback chain.** Lower cost, same reliability.
6. **Self-host open weights, rent the proprietary stuff.** Don't fight that line.

If you're building anything that generates media at volume, the open-source half of your stack is probably 80%+ cheaper to run yourself — *if* you get the worker model right. That last clause is where the money is.

---

*Building something similar? I'm happy to go deeper on the RunPod worker setup or the LoRA pipeline — leave a comment.*

**Tags:** machine-learning, ai, gpu, self-hosting, stable-diffusion, devops, mlops