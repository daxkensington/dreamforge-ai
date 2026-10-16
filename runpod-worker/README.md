# DreamForge RunPod Worker

Self-hosted AI models on RunPod Serverless for 50-90% cost savings.

## Models Bundled
- **Flux.1 Dev** — High-quality image generation (20 steps, ~15-20s on A40)
- **Flux.1 Schnell** — Fast image generation (4 steps, ~5s on A40)
- **Real-ESRGAN** — 4x image upscaling (~1-2s)
- **RMBG-2.0** — Background removal (~1-2s)
- **Depth Anything V2 Small** — Monocular depth estimation (grayscale / colored / normal map)
- **VTracer** — Raster to SVG vectorization

## Deployment

### 1. Build & Push Docker Image
```bash
docker build -t your-registry/dreamforge-worker:latest .
docker push your-registry/dreamforge-worker:latest
```

### 2. Create RunPod Serverless Endpoint
1. Go to [RunPod Console](https://www.runpod.io/console/serverless)
2. Create new Endpoint
3. Settings:
   - **Docker Image:** `your-registry/dreamforge-worker:latest`
   - **GPU:** A40 48GB (recommended) or L40S 48GB
   - **Workers:** 0 min, 3 max (Flex mode — pay only during inference)
   - **Idle Timeout:** 5 seconds
   - **FlashBoot:** Enabled (1-second cold starts)

### 3. Configure DreamForge
Add to your Vercel environment variables:
```
RUNPOD_API_KEY=your-runpod-api-key
RUNPOD_FLUX_ENDPOINT_ID=your-endpoint-id
```

## API Format

All tasks use the same endpoint. Route via the `task` field:

### Tasks

| Task | Inputs | Outputs |
|------|--------|---------|
| `depth` | `image_b64`, `variant` (`"grayscale"` \| `"colored"` \| `"normal"`), optional `colormap` (`"jet"` \| `"rainbow"` \| `"hot"`, default `"jet"`) | `image_b64`, `inference_time` |
| `vtracer` | `image_b64`, optional `color_precision` (server color count 2..32, default 16), `mode` (`"color"` \| `"binary"`, default `"color"`), `filter_speckle` (default 4), `corner_threshold` (default 60) | `svg`, `inference_time` |

`depth` returns a PNG: 8-bit grayscale (near=white, far=black), a cv2-colored
depth map, or a derived normal map depending on `variant`. `vtracer` returns
the full SVG document as text.

The worker image must be **rebuilt and redeployed** for these tasks to exist —
the GitHub workflow `runpod-worker-build.yml` builds and pushes the image.

### Image Generation
```json
{
  "input": {
    "task": "flux-dev",
    "prompt": "A serene mountain landscape at sunset",
    "width": 1024,
    "height": 1024,
    "num_inference_steps": 20,
    "guidance_scale": 7.5
  }
}
```

### Image-to-Image
```json
{
  "input": {
    "task": "flux-img2img",
    "image_b64": "<base64-encoded-image>",
    "prompt": "same person, red evening dress, studio lighting",
    "strength": 0.5,
    "num_inference_steps": 10,
    "model": "schnell",
    "lora_id": "hugovntr/flux-schnell-realism::schnell-realism_v2.3.safetensors"
  }
}
```
`model` is `"dev"` (default) or `"schnell"`. The img2img pipe is built from the
text-to-image pipe's components, so it shares the loaded weights: a worker holds
ONE Flux base at a time (Dev and Schnell are ~34GB each in bf16 on 48GB cards), and
asking for the other base unloads the first. Send the base your LoRA was trained for.

### Image Upscaling
```json
{
  "input": {
    "task": "esrgan",
    "image_b64": "<base64-encoded-image>",
    "scale": 4
  }
}
```

### Background Removal
```json
{
  "input": {
    "task": "rmbg",
    "image_b64": "<base64-encoded-image>"
  }
}
```

## Cost Comparison

| Task | API Cost | Self-Hosted | Savings |
|------|----------|-------------|---------|
| Image (Flux Dev) | $0.025 | $0.004 | 84% |
| Image (Flux Schnell) | $0.003 | $0.001 | 67% |
| Upscale (ESRGAN) | $0.005 | $0.0005 | 90% |
| BG Removal (RMBG) | $0.005 | $0.0003 | 94% |
