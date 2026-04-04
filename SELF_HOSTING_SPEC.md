# DreamForge Self-Hosted AI Models — Technical Specification

**Date:** April 3, 2026
**Platform:** RunPod Serverless
**Goal:** Reduce per-generation costs by 50-70% and enable a fine-tuned "DreamForge Model"

---

## 1. Flux.1 Image Generation (Primary Target)

### GPU Requirements
- **Minimum:** 24 GB VRAM (RTX 4090, L4, A5000)
- **Recommended:** 48 GB VRAM (A40, A6000, L40S) for full-precision Flux.1-dev
- **Optimal:** 80 GB A100 for batch processing and fastest inference

### Inference Speed
| GPU | Flux.1 Schnell (4 steps) | Flux.1 Dev (20 steps) |
|-----|--------------------------|----------------------|
| A100 80GB | ~2-3 sec/image | ~10-15 sec/image |
| L40S 48GB | ~4-5 sec/image | ~15-20 sec/image |
| 4090 24GB | ~5-8 sec/image | ~20-30 sec/image |

With `torch.compile` optimization, these times can be cut by 30-50%.

### RunPod Serverless Cost (per second)
| GPU | Flex Worker | Active Worker | Hourly Equiv (Active) |
|-----|-------------|---------------|-----------------------|
| A100 80GB | $0.00076/s | $0.00060/s | $2.16/hr |
| L40S 48GB | $0.00053/s | $0.00037/s | $1.33/hr |
| A40 48GB | $0.00034/s | $0.00024/s | $0.86/hr |
| 4090 24GB | $0.00031/s | $0.00021/s | $0.76/hr |
| L4 24GB | $0.00019/s | $0.00013/s | $0.47/hr |

### Projected Cost Per Image (Self-Hosted)
Using an **A40** (48GB, good balance of cost/performance):
- Flux Schnell: ~5 sec x $0.00024/s = **$0.0012/image**
- Flux Dev: ~18 sec x $0.00024/s = **$0.0043/image**

### Current API Cost Per Image (Replicate/BFL)
- Flux 1.1 Pro: **$0.055/image**
- Flux Schnell (Replicate): **$0.003/image**
- Flux Dev (Replicate): **$0.025/image**

### Savings
| Model | API Cost | Self-Hosted | Savings |
|-------|----------|-------------|---------|
| Flux Dev | $0.025 | $0.0043 | **83%** |
| Flux Schnell | $0.003 | $0.0012 | **60%** |
| Flux Pro | $0.055 | $0.005 (dev equivalent) | **91%** |

---

## 2. Other Models to Self-Host

### Real-ESRGAN (Image Upscaling)
- **GPU:** Runs on any GPU with 4+ GB VRAM; even a 16GB A4000 is overkill
- **CPU:** Possible but slow (~13-20 sec vs ~1-2 sec on GPU)
- **Recommendation:** Bundle on the same serverless endpoint as Flux (share the GPU)
- **Self-hosted cost:** Effectively free if sharing GPU idle time; ~$0.0005/image standalone
- **Current Replicate cost:** ~$0.005-0.01/image
- **Savings:** ~90%

### RMBG-2.0 (Background Removal)
- **CPU:** Yes, runs on CPU in 8-20 seconds depending on hardware
- **GPU:** ~1-2 seconds on any modern GPU
- **VRAM:** Under 4 GB
- **Recommendation:** Can run on CPU for low volume, or bundle with Flux GPU endpoint
- **Self-hosted cost:** ~$0.0003/image (GPU), near-zero on CPU
- **Current cost:** ~$0.005/image via API
- **Savings:** ~95%

### MusicGen (Audio Generation)
- **GPU:** 16 GB VRAM minimum for medium model (1.5B params); A100 recommended for large (3.3B)
- **Inference:** ~10-15 sec for 10 sec of audio on A100; ~35 sec on T4
- **Recommendation:** Self-host medium model on A40 (48GB) or L40S
- **Self-hosted cost:** ~$0.004/generation (15 sec on A40)
- **Current Replicate cost:** ~$0.02-0.05/generation
- **Savings:** ~80-90%

### CogVideoX (Video Generation)
- **GPU:** 12-16 GB VRAM for 5B model (quantized); 24-48 GB for full precision
- **Inference:** 2-5 minutes per 6-second clip on A100
- **Self-hosted cost:** ~$0.07-0.18/video (2-5 min on A40)
- **Current Replicate cost:** ~$0.50-1.00/video
- **Savings:** ~75-85%
- **Note:** Video gen is the most GPU-intensive. Consider keeping Veo 3 (Gemini API) as primary and self-hosting CogVideoX as fallback only.

---

## 3. Cost Comparison Summary

### Per-Generation Costs
| Task | Current (API) | Self-Hosted (RunPod) | Savings |
|------|---------------|----------------------|---------|
| Image (Flux Dev) | $0.025 | $0.004 | 84% |
| Image (Flux Schnell) | $0.003 | $0.001 | 67% |
| Image (DALL-E 3) | $0.040 | N/A (keep API) | -- |
| Upscale (Real-ESRGAN) | $0.005 | $0.0005 | 90% |
| BG Removal (RMBG-2.0) | $0.005 | $0.0003 | 94% |
| Audio (MusicGen) | $0.030 | $0.004 | 87% |
| Video (CogVideoX) | $0.750 | $0.120 | 84% |
| Video (Veo 3) | Gemini API | Keep API | -- |

### Monthly Cost Projections (Active Worker)

**Scenario A: Low volume (1,000 generations/month)**
- Current API cost: ~$40/month
- Self-hosted: ~$50-100/month (idle GPU time dominates)
- Verdict: NOT worth it. Use APIs.

**Scenario B: Medium volume (10,000 generations/month)**
- Current API cost: ~$300-400/month
- Self-hosted (1 active A40 worker): ~$620/month (24/7) or ~$100-150/month (flex, no idle)
- Verdict: Worth it with FLEX workers (no active workers). Break-even around 5,000-8,000 generations/month.

**Scenario C: High volume (50,000+ generations/month)**
- Current API cost: ~$1,500-2,000/month
- Self-hosted (1-2 active A40 workers): ~$620-1,240/month
- Verdict: STRONGLY worth it. 40-60% savings.

### Break-Even Analysis
- **Flex workers (pay only during inference):** Break-even at ~3,000 Flux Dev generations/month
- **1 Active A40 worker ($620/mo):** Break-even at ~25,000 Flux Dev generations/month
- **Recommendation:** Start with FLEX workers only. Switch to active workers when consistent traffic justifies it.

---

## 4. Fine-Tuning a "DreamForge Model"

### LoRA vs Full Fine-Tune

| Approach | GPU | Time | Cost | Quality |
|----------|-----|------|------|---------|
| LoRA (rank 16-64) | 1x A100 or 1x 4090 | 30-60 min | $1-5 | Good for style transfer |
| LoRA (rank 128+) | 1x A100 | 1-2 hrs | $3-10 | Near full fine-tune quality |
| Full Fine-Tune | 2x A100 80GB | 8-24 hrs | $35-100 | Best quality, risky overfitting |

**Recommendation:** LoRA (rank 64-128) is the clear winner for ROI. 95% of the quality at 5% of the cost.

### Training Data Collection Strategy
1. **Community generations:** Opt-in toggle for users to contribute their best generations to the training pool (with consent/ToS)
2. **Curated datasets:** License high-quality image datasets (Unsplash, curated art collections)
3. **Style-specific LoRAs:** Train multiple LoRAs for different styles (photorealistic, anime, oil painting, etc.)
4. **Target dataset size:** 500-5,000 high-quality images per LoRA style
5. **Data pipeline:** Store metadata (prompt, settings, user rating) alongside images in R2

### Training Process
1. Prepare dataset: curate images, generate captions with BLIP-2 or CogVLM
2. Spin up RunPod pod (1x A100 80GB, ~$2.16/hr)
3. Use SimpleTuner or ai-toolkit for Flux LoRA training
4. Train for 1,000-3,000 steps (30-90 min)
5. Export LoRA weights, upload to R2
6. Load LoRA at inference time on the serverless endpoint

### Estimated Training Costs
- Per LoRA style: **$2-10** (one-time)
- Initial 5 styles: **$10-50** (one-time)
- Monthly retraining with new data: **$20-50/month**

### Serving the Fine-Tuned Model
- LoRA weights are small (50-200 MB) and load on top of base Flux model
- Can dynamically swap LoRAs at inference time (no separate endpoint needed)
- No additional GPU cost beyond base Flux inference

---

## 5. Implementation Plan

### Phase 1: Quick Wins (Week 1-2) — Best ROI First

**Deploy Flux.1 on RunPod Serverless**
- GPU: A40 48GB (best price/performance for Flux)
- Mode: Flex workers only (0 active workers, scale to 3 max)
- Expected savings: 80%+ on image generation
- Setup: Docker container with Flux + torch.compile optimization
- Cold start: ~10-15 sec first request, then instant with FlashBoot

**Bundle Real-ESRGAN + RMBG-2.0 on same endpoint**
- Both models are tiny; they fit alongside Flux on the same GPU
- Single endpoint handles: image gen, upscaling, background removal
- Near-zero marginal cost

**Keep on APIs (for now):**
- DALL-E 3 / GPT Image (OpenAI lock-in, not self-hostable)
- Grok image gen (xAI, not self-hostable)
- Veo 3 (Google, not self-hostable)
- Gemini Flash, Claude, GPT-4o-mini (LLMs, keep on API)

**Estimated monthly cost:** $50-150/mo for RunPod (depending on volume)
**Estimated monthly savings:** $100-300/mo vs current API spend

### Phase 2: Audio + Video (Month 2-3)

**Deploy MusicGen on RunPod Serverless**
- GPU: A40 or L4 (medium model fits on 24GB)
- Replaces Replicate MusicGen calls
- Savings: ~85% on audio generation

**Evaluate CogVideoX deployment**
- Only if video generation volume justifies it (video is expensive)
- Keep Veo 3 as primary, CogVideoX as self-hosted fallback
- May not be worth it until 500+ video generations/month

**Estimated additional monthly cost:** $30-80/mo
**Estimated additional savings:** $50-200/mo

### Phase 3: DreamForge Model (Month 3-4)

**Train initial LoRA styles:**
1. "DreamForge Cinematic" — photorealistic, dramatic lighting
2. "DreamForge Anime" — high-quality anime/manga style
3. "DreamForge Abstract" — artistic, painterly
4. "DreamForge Product" — clean product photography
5. "DreamForge Fantasy" — fantasy art, D&D style

**Marketing value:** "Generate with our exclusive DreamForge models" — major differentiator
**Cost:** $10-50 one-time training, negligible serving cost

**Community LoRA marketplace:**
- Users can train and share their own LoRAs
- Revenue share model (creator gets 70%, platform gets 30%)
- Stored in R2, loaded dynamically at inference time

---

## 6. Architecture Overview

```
User Request
    |
    v
DreamForge API (Vercel)
    |
    ├── Self-Hosted (RunPod Serverless)
    |   ├── Flux.1 Dev/Schnell (image gen)
    |   ├── Flux + LoRA (DreamForge styles)
    |   ├── Real-ESRGAN (upscaling)
    |   ├── RMBG-2.0 (bg removal)
    |   ├── MusicGen (audio gen)
    |   └── CogVideoX (video gen, Phase 2)
    |
    └── External APIs (keep)
        ├── Grok (xAI) — image gen
        ├── OpenAI — DALL-E/GPT Image, TTS, GPT-4o
        ├── Google — Veo 3, Gemini Flash
        ├── Anthropic — Claude
        └── Stability AI — SD3 (fallback)
```

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cold starts on serverless | 10-15 sec delay | Use FlashBoot; keep 1 active worker during peak hours |
| RunPod outage | All self-hosted models down | Fallback to Replicate/API automatically (already have the integrations) |
| GPU availability | Cannot scale | Use multiple GPU types (A40 + L40S + 4090 all work) |
| Model quality regression | Bad user experience | A/B test self-hosted vs API; keep API as fallback |
| LoRA overfitting | Poor generation quality | Conservative training (low learning rate, early stopping) |

---

## 8. Key Recommendations

1. **Start with Flex workers, not Active workers.** You only pay during inference. At low-medium volume, this is 3-5x cheaper than keeping a GPU running 24/7.

2. **A40 is the sweet spot GPU.** At $0.00024/s (active) it is 60% cheaper than A100 while having enough VRAM (48GB) for all target models.

3. **Bundle models on one endpoint.** Flux + Real-ESRGAN + RMBG-2.0 can share one GPU. Route requests to the right model via the request payload.

4. **Keep the API fallback chain.** Self-hosting should reduce costs, not reduce reliability. If RunPod is slow or down, fall back to Replicate/API seamlessly.

5. **LoRA fine-tuning is nearly free.** At $2-10 per style, there is no reason not to have exclusive "DreamForge" models. This is a marketing differentiator with almost zero cost.

6. **Do NOT self-host LLMs or proprietary models.** GPT-4o, Claude, Gemini, and Grok are API-only. Focus self-hosting on open-source image/audio/video models where the savings are real.

---

## Sources

- [RunPod Serverless Pricing](https://docs.runpod.io/serverless/pricing)
- [RunPod GPU Pricing](https://www.runpod.io/pricing)
- [Deploying Flux.1 on RunPod](https://www.runpod.io/articles/guides/deploying-flux-1-for-high-resolution-image-generation-with-gpu-infrastructure)
- [FlashBoot: 1-Second Cold Start](https://www.runpod.io/blog/introducing-flashboot-serverless-cold-start)
- [How to Train a Flux LoRA for $1](https://medium.com/@geronimo7/how-to-train-a-flux1-lora-for-1-dfd1800afce5)
- [Multi-GPU Flux Fine-Tuning on RunPod](https://dev.to/furkangozukara/multi-gpu-flux-full-fine-tuning-experiments-and-requirements-on-runpod-and-conclusions-2g61)
- [Training Flux LoRA with FluxGym on RunPod](https://www.nextdiffusion.ai/tutorials/how-to-train-a-flux-lora-with-fluxgym-on-runpod)
- [Flux.1 Schnell Benchmark (SaladCloud)](https://blog.salad.com/flux1-schnell/)
- [Run Flux 3x Faster (Modal)](https://modal.com/blog/flux-3x-faster)
- [Replicate Pricing](https://replicate.com/pricing)
- [AI Image API Pricing Comparison 2026](https://blog.laozhang.ai/en/posts/ai-image-generation-api-comparison-2026)
- [Stability AI Pricing](https://platform.stability.ai/pricing)
- [RMBG-2.0 (HuggingFace)](https://huggingface.co/briaai/RMBG-2.0)
- [MusicGen Documentation](https://github.com/facebookresearch/audiocraft/blob/main/docs/MUSICGEN.md)
- [CogVideoX on RunPod](https://www.runpod.io/articles/guides/creating-high-quality-videos-with-cogvideox)
- [Best GPU for Flux (JarvisLabs)](https://jarvislabs.ai/ai-faqs/best-gpu-for-flux)
