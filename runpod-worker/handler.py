"""
DreamForge RunPod Serverless Handler
=====================================
Single endpoint serving multiple models:
  - Flux.1 Dev/Schnell (image generation)
  - Real-ESRGAN (image upscaling)
  - RMBG-2.0 (background removal)
  - CatVTON (virtual try-on)

Routes to the correct model via the `task` field in the input payload.

Deploy: docker build -t dreamforge-worker . && docker push <your-registry>/dreamforge-worker
Then create a RunPod Serverless endpoint pointing to this image.
"""

import runpod
import torch
import base64
import io
import os
import gc
import time
import sys
from PIL import Image

# ─── Compatibility Shim ────────────────────────────────────────────────────
# torchvision >= 0.20 removed transforms.functional_tensor, but basicsr/
# realesrgan still import it. Create a shim so the import doesn't fail.
import types
import torchvision.transforms
if not hasattr(torchvision.transforms, "functional_tensor"):
    import torchvision.transforms.functional as _F
    torchvision.transforms.functional_tensor = _F
    sys.modules["torchvision.transforms.functional_tensor"] = _F

# ─── Lazy Model Loading ──────────────────────────────────────────────────────
# Models are loaded on first use to minimize cold-start memory.

_flux_pipe = None
_flux_img2img_pipe = None
_esrgan_model = None
_rmbg_model = None
_rmbg_transform = None
_catvton_pipe = None
_catvton_masker = None
_musicgen_model = None
_audiogen_model = None
_cogvideo_pipe = None
_wan_t2v_pipe = None
_wan_i2v_pipe = None
_bark_processor = None
_bark_model = None

# Wan 2.2 TI2V-5B: a single 5B model serves BOTH text-to-video and
# image-to-video at up to 720p24. The "fast" tier — fits a single 48GB GPU with
# model-cpu-offload, ~90s/clip.
WAN_MODEL_ID = os.environ.get("WAN_MODEL_ID", "Wan-AI/Wan2.2-TI2V-5B-Diffusers")

# Wan 2.2 A14B: the "hd" tier for top-quality adult video. Two-expert MoE
# (27B total / 14B active), 480p+720p, uncensored (no built-in content filter).
# Only 14B is active per step, so model-cpu-offload keeps it within 48GB (the
# inactive expert offloads to CPU RAM) — slower than 5B (~4-8min/clip) but a
# large quality jump. Separate T2V / I2V checkpoints.
WAN_HD_T2V_MODEL = os.environ.get("WAN_HD_T2V_MODEL", "Wan-AI/Wan2.2-T2V-A14B-Diffusers")
WAN_HD_I2V_MODEL = os.environ.get("WAN_HD_I2V_MODEL", "Wan-AI/Wan2.2-I2V-A14B-Diffusers")
_wan_hd_t2v_pipe = None
_wan_hd_i2v_pipe = None


def _release_flux_pipes():
    """Drop every Flux pipe and give the VRAM back BEFORE loading another base.

    Dev and Schnell are each ~34GB in bf16, and the worker runs on 48GB cards.
    Rebinding the global only drops the old pipe after the new one is already
    on the GPU, which is exactly when there is no room for it.
    """
    global _flux_pipe, _flux_img2img_pipe
    _flux_pipe = None
    _flux_img2img_pipe = None
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def get_flux_pipe(model_type="dev"):
    """Load Flux.1 pipeline (Dev or Schnell)."""
    global _flux_pipe
    if _flux_pipe is None or _flux_pipe._model_type != model_type:
        from diffusers import FluxPipeline

        _release_flux_pipes()
        model_id = (
            "black-forest-labs/FLUX.1-dev"
            if model_type == "dev"
            else "black-forest-labs/FLUX.1-schnell"
        )
        print(f"[DreamForge] Loading {model_id}...")
        t0 = time.time()
        pipe = FluxPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
        )
        pipe.to("cuda")
        print(f"[DreamForge] {model_id} on GPU in {time.time() - t0:.1f}s")

        # Deliberately NOT torch.compile'd. mode="reduce-overhead" captured a
        # CUDA graph per input shape: measured 2026-09-02 on an A40, the first
        # schnell request after a worker (re)start spent ~45s compiling and
        # every new aspect ratio (the studio offers four) paid it again, to
        # save well under a second on a 4-step render. Each LoRA fuse/unfuse
        # also invalidated the graph. On a bursty serverless endpoint the
        # capture cost dwarfs the per-image win.

        pipe._model_type = model_type
        _flux_pipe = pipe
    return _flux_pipe


def get_flux_img2img_pipe(model_type="dev"):
    """Load Flux.1 img2img pipeline, sharing weights with the text pipe.

    Built from the text-to-image pipe's components rather than a second
    from_pretrained: the two pipelines then hold ONE copy of the transformer,
    text encoders and VAE, so a worker that already serves text-to-image can
    take an img2img job without trying to fit a second ~34GB model next to the
    first. It also means a LoRA fused for one path is fused for the other.
    """
    global _flux_img2img_pipe
    if (
        _flux_img2img_pipe is None
        or getattr(_flux_img2img_pipe, "_model_type", None) != model_type
    ):
        from diffusers import FluxImg2ImgPipeline

        base = get_flux_pipe(model_type)
        pipe = FluxImg2ImgPipeline(**base.components)
        pipe._model_type = model_type
        _flux_img2img_pipe = pipe
    return _flux_img2img_pipe


def get_esrgan_model():
    """Load Real-ESRGAN model."""
    global _esrgan_model
    if _esrgan_model is None:
        from realesrgan import RealESRGANer
        from basicsr.archs.rrdbnet_arch import RRDBNet

        print("[DreamForge] Loading Real-ESRGAN...")
        model = RRDBNet(
            num_in_ch=3, num_out_ch=3, num_feat=64,
            num_block=23, num_grow_ch=32, scale=4,
        )
        _esrgan_model = RealESRGANer(
            scale=4,
            model_path="/models/RealESRGAN_x4plus.pth",
            model=model,
            tile=0,
            tile_pad=10,
            pre_pad=0,
            half=True,
            device="cuda",
        )
    return _esrgan_model


def get_rmbg_model():
    """Load RMBG-2.0 background removal model."""
    global _rmbg_model, _rmbg_transform
    if _rmbg_model is None:
        from transformers import AutoModelForImageSegmentation
        from torchvision import transforms

        print("[DreamForge] Loading RMBG-2.0...")
        _rmbg_model = AutoModelForImageSegmentation.from_pretrained(
            "briaai/RMBG-2.0", trust_remote_code=True,
        )
        _rmbg_model.to("cuda")
        _rmbg_model.eval()

        _rmbg_transform = transforms.Compose([
            transforms.Resize((1024, 1024)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
    return _rmbg_model, _rmbg_transform


def get_bark():
    """Load Bark TTS model for natural speech generation."""
    global _bark_processor, _bark_model
    if _bark_model is None:
        from transformers import AutoProcessor, BarkModel

        print("[DreamForge] Loading Bark TTS...")
        _bark_processor = AutoProcessor.from_pretrained("suno/bark")
        _bark_model = BarkModel.from_pretrained(
            "suno/bark",
            torch_dtype=torch.float16,
        )
        _bark_model.to("cuda")
        print("[DreamForge] Bark TTS loaded")
    return _bark_processor, _bark_model


def get_cogvideo_pipe():
    """Load CogVideoX-5B text-to-video pipeline."""
    global _cogvideo_pipe
    if _cogvideo_pipe is None:
        from diffusers import CogVideoXPipeline

        print("[DreamForge] Loading CogVideoX-5B...")
        _cogvideo_pipe = CogVideoXPipeline.from_pretrained(
            "THUDM/CogVideoX-5b",
            torch_dtype=torch.bfloat16,
        )
        _cogvideo_pipe.enable_model_cpu_offload()
        _cogvideo_pipe.vae.enable_tiling()
        print("[DreamForge] CogVideoX-5B loaded")
    return _cogvideo_pipe


def get_wan_t2v_pipe():
    """Load Wan 2.2 TI2V-5B text-to-video pipeline (lazy, cached)."""
    global _wan_t2v_pipe
    if _wan_t2v_pipe is None:
        from diffusers import WanPipeline, AutoencoderKLWan

        print(f"[DreamForge] Loading Wan 2.2 T2V ({WAN_MODEL_ID})...")
        # Wan ships a bespoke VAE that must stay in fp32 for stable decode.
        vae = AutoencoderKLWan.from_pretrained(
            WAN_MODEL_ID, subfolder="vae", torch_dtype=torch.float32
        )
        _wan_t2v_pipe = WanPipeline.from_pretrained(
            WAN_MODEL_ID, vae=vae, torch_dtype=torch.bfloat16
        )
        # Offload keeps the 5B transformer + VAE within a 48GB budget alongside
        # the other lazily-loaded models on this shared worker.
        _wan_t2v_pipe.enable_model_cpu_offload()
        print("[DreamForge] Wan 2.2 T2V loaded")
    return _wan_t2v_pipe


def get_wan_i2v_pipe():
    """Load Wan 2.2 TI2V-5B image-to-video pipeline (lazy, cached).

    Loaded standalone — NOT via from_pipe(t2v). from_pipe on the TI2V-5B produced
    a pipeline that ran effectively on CPU (a 49-frame clip stalled past 19 min
    vs ~90s for T2V). A clean from_pretrained load with model-cpu-offload mirrors
    the working T2V path. Weights come from the on-disk HF cache the T2V load
    already populated, so this is a fast local re-instantiation, not a re-download.
    """
    global _wan_i2v_pipe
    if _wan_i2v_pipe is None:
        from diffusers import WanImageToVideoPipeline, AutoencoderKLWan

        print(f"[DreamForge] Loading Wan 2.2 I2V ({WAN_MODEL_ID})...")
        vae = AutoencoderKLWan.from_pretrained(
            WAN_MODEL_ID, subfolder="vae", torch_dtype=torch.float32
        )
        _wan_i2v_pipe = WanImageToVideoPipeline.from_pretrained(
            WAN_MODEL_ID, vae=vae, torch_dtype=torch.bfloat16
        )
        _wan_i2v_pipe.enable_model_cpu_offload()
        print("[DreamForge] Wan 2.2 I2V loaded")
    return _wan_i2v_pipe


def _place_hd_pipe(pipe):
    """Put an A14B pipe on the GPU. On an 80GB card the two 14B experts + VAE +
    text encoder (~69GB) fit resident, so keep everything on-GPU (no CPU-offload
    swap) — ~2x faster than enable_model_cpu_offload. Falls back to offload if
    VRAM is smaller than expected (OOM), or force it with WAN_HD_OFFLOAD=1."""
    if os.environ.get("WAN_HD_OFFLOAD", "0") == "1":
        pipe.enable_model_cpu_offload()
        return
    try:
        pipe.to("cuda")
    except Exception as e:
        print(f"[DreamForge] HD full-GPU load failed ({e}); falling back to cpu-offload")
        torch.cuda.empty_cache()
        pipe.enable_model_cpu_offload()


def get_wan_hd_t2v_pipe():
    """Load Wan 2.2 A14B text-to-video (HD tier). Full-GPU on 80GB for speed."""
    global _wan_hd_t2v_pipe
    if _wan_hd_t2v_pipe is None:
        from diffusers import WanPipeline, AutoencoderKLWan

        print(f"[DreamForge] Loading Wan 2.2 HD T2V ({WAN_HD_T2V_MODEL})...")
        vae = AutoencoderKLWan.from_pretrained(WAN_HD_T2V_MODEL, subfolder="vae", torch_dtype=torch.float32)
        _wan_hd_t2v_pipe = WanPipeline.from_pretrained(WAN_HD_T2V_MODEL, vae=vae, torch_dtype=torch.bfloat16)
        _place_hd_pipe(_wan_hd_t2v_pipe)
        print("[DreamForge] Wan 2.2 HD T2V loaded")
    return _wan_hd_t2v_pipe


def get_wan_hd_i2v_pipe():
    """Load Wan 2.2 A14B image-to-video (HD tier) — the top-quality path."""
    global _wan_hd_i2v_pipe
    if _wan_hd_i2v_pipe is None:
        from diffusers import WanImageToVideoPipeline, AutoencoderKLWan

        print(f"[DreamForge] Loading Wan 2.2 HD I2V ({WAN_HD_I2V_MODEL})...")
        vae = AutoencoderKLWan.from_pretrained(WAN_HD_I2V_MODEL, subfolder="vae", torch_dtype=torch.float32)
        _wan_hd_i2v_pipe = WanImageToVideoPipeline.from_pretrained(WAN_HD_I2V_MODEL, vae=vae, torch_dtype=torch.bfloat16)
        _place_hd_pipe(_wan_hd_i2v_pipe)
        print("[DreamForge] Wan 2.2 HD I2V loaded")
    return _wan_hd_i2v_pipe


def get_musicgen(model_size="large"):
    """Load Meta MusicGen model (stereo-large by default)."""
    global _musicgen_model
    if _musicgen_model is None:
        from audiocraft.models import MusicGen

        model_id = f"facebook/musicgen-stereo-{model_size}"
        print(f"[DreamForge] Loading MusicGen ({model_id})...")
        _musicgen_model = MusicGen.get_pretrained(model_id, device="cuda")
        print("[DreamForge] MusicGen loaded")
    return _musicgen_model


def get_audiogen():
    """Load Meta AudioGen model for sound effects."""
    global _audiogen_model
    if _audiogen_model is None:
        from audiocraft.models import AudioGen

        print("[DreamForge] Loading AudioGen...")
        _audiogen_model = AudioGen.get_pretrained("facebook/audiogen-medium", device="cuda")
        print("[DreamForge] AudioGen loaded")
    return _audiogen_model


def get_catvton():
    """Load CatVTON virtual try-on pipeline + auto-masker."""
    global _catvton_pipe, _catvton_masker
    if _catvton_pipe is None:
        sys.path.insert(0, "/app/catvton")
        from model.pipeline import CatVTONPipeline
        from model.cloth_masker import AutoMasker
        from huggingface_hub import snapshot_download

        print("[DreamForge] Loading CatVTON...")
        repo_path = snapshot_download("zhengchong/CatVTON")

        _catvton_pipe = CatVTONPipeline(
            base_ckpt="runwayml/stable-diffusion-inpainting",
            attn_ckpt=repo_path,
            attn_ckpt_version="mix",
            weight_dtype=torch.bfloat16,
            use_tf32=True,
            device="cuda",
        )

        _catvton_masker = AutoMasker(
            densepose_ckpt=os.path.join(repo_path, "DensePose"),
            schp_ckpt=os.path.join(repo_path, "SCHP"),
            device="cuda",
        )
        print("[DreamForge] CatVTON loaded")

    return _catvton_pipe, _catvton_masker


# ─── Task Handlers ───────────────────────────────────────────────────────────

def apply_flux_lora(pipe, lora_id, lora_scale):
    """Fuse a LoRA into a Flux pipe, and KEEP it fused across requests.

    Measured 2026-09-02 on a warm A40 worker: flux-schnell 4 steps at 832x1216
    ran in 4.1s with no LoRA and 59s with the realism LoRA — the per-request
    load → fuse → unfuse → unload dance (plus the torch.compile re-capture it
    forces) was 93% of every uncensored image's wall time. Nearly every request
    asks for the same LoRA, so we remember what is fused on the pipe and only
    swap when a request wants something different (or none).
    """
    # The text and img2img pipes share one transformer (see
    # get_flux_img2img_pipe), so the "what is fused" marker has to live on the
    # shared module — a per-pipe flag would let the second pipe fuse the same
    # LoRA on top of itself.
    owner = pipe.transformer if hasattr(pipe, "transformer") else pipe
    current = getattr(owner, "_dfx_lora", None)
    wanted = (lora_id, float(lora_scale)) if lora_id else None
    if current == wanted:
        return
    if current is not None:
        try:
            pipe.unfuse_lora()
            pipe.unload_lora_weights()
        except Exception as e:
            print(f"[DreamForge] LoRA unload failed ({current[0]}): {e}")
        owner._dfx_lora = None
    if wanted is None:
        return
    try:
        if lora_id.startswith("http://") or lora_id.startswith("https://"):
            # Direct URL — download to temp file and load
            import requests as req_lib
            lora_path = f"/tmp/lora_{hash(lora_id) % 10**8}.safetensors"
            if not os.path.exists(lora_path):
                print(f"[DreamForge] Downloading LoRA from URL: {lora_id}")
                resp = req_lib.get(lora_id, timeout=120)
                resp.raise_for_status()
                with open(lora_path, "wb") as f:
                    f.write(resp.content)
            pipe.load_lora_weights(lora_path)
        elif "::" in lora_id:
            # "repo::weight_file.safetensors" — needed when a repo ships
            # multiple LoRA files (e.g. the schnell-realism v1 + v2.3).
            repo, weight_name = lora_id.split("::", 1)
            pipe.load_lora_weights(repo, weight_name=weight_name)
        else:
            # HuggingFace repo ID (single default LoRA file)
            pipe.load_lora_weights(lora_id)
        pipe.fuse_lora(lora_scale=lora_scale)
        owner._dfx_lora = wanted
        print(f"[DreamForge] LoRA loaded: {lora_id} (scale={lora_scale})")
    except Exception as e:
        print(f"[DreamForge] LoRA load failed ({lora_id}): {e}")
        try:
            pipe.unload_lora_weights()
        except Exception:
            pass
        owner._dfx_lora = None


def handle_warm(job_input):
    """Load a Flux base (and optionally fuse a LoRA) without rendering.

    The app fires this when a signed-in, age-confirmed visitor lands in the
    uncensored studio, so the ~60s weight load happens while they are still
    typing a prompt instead of after they click Generate. Measured 2026-09-03:
    a worker that had been idle 10 minutes answered its next real request in
    129s, of which only ~2s was inference.
    """
    model_type = job_input.get("model", "schnell")
    if model_type not in ("dev", "schnell"):
        raise ValueError(f"Unknown model: {model_type}")
    t0 = time.time()
    pipe = get_flux_pipe(model_type)
    lora_id = job_input.get("lora_id")
    if lora_id:
        apply_flux_lora(pipe, lora_id, job_input.get("lora_scale", 0.8))
    warm_time = time.time() - t0
    print(f"[DreamForge] Warm ({model_type}, lora={'yes' if lora_id else 'no'}) in {warm_time:.1f}s")
    return {"warm": True, "model": model_type, "warm_time": warm_time}


def handle_flux(job_input):
    """Generate image with Flux.1 Dev or Schnell. Supports LoRA + reproducible seeds."""
    task = job_input.get("task", "flux-dev")
    prompt = job_input.get("prompt", "")
    width = job_input.get("width", 1024)
    height = job_input.get("height", 1024)
    steps = job_input.get("num_inference_steps", 20 if task == "flux-dev" else 4)
    guidance = job_input.get("guidance_scale", 7.5 if task == "flux-dev" else 0.0)
    seed = job_input.get("seed")
    lora_id = job_input.get("lora_id")  # HuggingFace LoRA repo ID
    lora_scale = job_input.get("lora_scale", 0.8)

    # Ensure dimensions are multiples of 8
    width = (width // 8) * 8
    height = (height // 8) * 8

    model_type = "dev" if task == "flux-dev" else "schnell"
    pipe = get_flux_pipe(model_type)

    # LoRA stays fused on the pipe between requests — see apply_flux_lora.
    apply_flux_lora(pipe, lora_id, lora_scale)

    # Reproducible seed — use provided seed or generate one
    if seed is None:
        seed = int(time.time()) % 2**32
    generator = torch.Generator("cuda").manual_seed(seed)

    start = time.time()
    result = pipe(
        prompt=prompt,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )
    inference_time = time.time() - start
    print(f"[DreamForge] Flux {model_type} generated in {inference_time:.1f}s (seed={seed})")

    image = result.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"image_b64": image_b64, "inference_time": inference_time, "seed": seed}


def handle_flux_img2img(job_input):
    """Transform an existing image with Flux.1 img2img — real diffusion, not LLM hack."""
    prompt = job_input.get("prompt", "")
    image_b64 = job_input.get("image_b64", "")
    strength = job_input.get("strength", 0.7)
    steps = job_input.get("num_inference_steps", 20)
    guidance = job_input.get("guidance_scale", 7.5)
    seed = job_input.get("seed")
    lora_id = job_input.get("lora_id")
    lora_scale = job_input.get("lora_scale", 0.8)
    # "dev" is the historical default; the uncensored studio sends "schnell"
    # because its realism LoRA is a Schnell LoRA and its text-to-image path
    # already holds Schnell on the worker.
    model_type = job_input.get("model", "dev")
    if model_type not in ("dev", "schnell"):
        raise ValueError(f"Unknown img2img model: {model_type}")

    if not image_b64:
        raise ValueError("image_b64 is required for img2img")
    if not prompt:
        raise ValueError("prompt is required for img2img")

    # Decode input image
    img_bytes = base64.b64decode(image_b64)
    init_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    # Resize to multiples of 8
    w, h = init_image.size
    w = (w // 8) * 8
    h = (h // 8) * 8
    if (w, h) != init_image.size:
        init_image = init_image.resize((w, h), Image.LANCZOS)

    pipe = get_flux_img2img_pipe(model_type)

    # LoRA stays fused on the pipe between requests — see apply_flux_lora.
    # (Also fixes the "repo::weight_name" form, which this path never parsed,
    # so the realism LoRA silently failed to load on every refine.)
    apply_flux_lora(pipe, lora_id, lora_scale)

    if seed is None:
        seed = int(time.time()) % 2**32
    generator = torch.Generator("cuda").manual_seed(seed)

    start = time.time()
    result = pipe(
        prompt=prompt,
        image=init_image,
        strength=max(0.1, min(strength, 1.0)),
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )
    inference_time = time.time() - start
    print(f"[DreamForge] Flux img2img ({model_type}) completed in {inference_time:.1f}s (seed={seed}, strength={strength})")

    output_image = result.images[0]
    buf = io.BytesIO()
    output_image.save(buf, format="PNG")
    out_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"image_b64": out_b64, "inference_time": inference_time, "seed": seed}


def handle_esrgan(job_input):
    """Upscale image with Real-ESRGAN."""
    import numpy as np
    import cv2

    image_b64 = job_input.get("image_b64", "")
    scale = job_input.get("scale", 4)

    if not image_b64:
        raise ValueError("image_b64 is required for upscaling")

    img_bytes = base64.b64decode(image_b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_UNCHANGED)

    if img is None:
        raise ValueError("Failed to decode input image")

    model = get_esrgan_model()

    start = time.time()
    output, _ = model.enhance(img, outscale=scale)
    inference_time = time.time() - start
    print(f"[DreamForge] ESRGAN upscaled {scale}x in {inference_time:.1f}s")

    _, buf = cv2.imencode(".png", output)
    image_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

    return {"image_b64": image_b64, "inference_time": inference_time}


def handle_rmbg(job_input):
    """Remove background with RMBG-2.0."""
    import numpy as np

    image_b64 = job_input.get("image_b64", "")
    if not image_b64:
        raise ValueError("image_b64 is required for background removal")

    img_bytes = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    original_size = image.size

    model, transform = get_rmbg_model()

    start = time.time()
    input_tensor = transform(image).unsqueeze(0).to("cuda")

    with torch.no_grad():
        preds = model(input_tensor)[-1].sigmoid().cpu()

    pred = preds[0].squeeze()
    mask = (pred * 255).byte().numpy()

    # Resize mask back to original image size
    mask_image = Image.fromarray(mask).resize(original_size, Image.BILINEAR)

    # Apply mask as alpha channel
    result = image.copy()
    result.putalpha(mask_image)

    inference_time = time.time() - start
    print(f"[DreamForge] RMBG-2.0 completed in {inference_time:.1f}s")

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"image_b64": image_b64, "inference_time": inference_time}


def handle_bark_tts(job_input):
    """Generate speech with Bark TTS."""
    import scipy.io.wavfile as wavfile

    text = job_input.get("prompt", "")
    voice_preset = job_input.get("voice_preset", "v2/en_speaker_6")

    if not text:
        raise ValueError("prompt (text) is required for TTS")

    processor, model = get_bark()

    start = time.time()
    inputs = processor(text, voice_preset=voice_preset, return_tensors="pt").to("cuda")
    with torch.no_grad():
        audio_array = model.generate(**inputs)
    audio_array = audio_array.cpu().numpy().squeeze()
    inference_time = time.time() - start
    print(f"[DreamForge] Bark TTS generated in {inference_time:.1f}s")

    # Save to WAV buffer
    sample_rate = model.generation_config.sample_rate
    buf = io.BytesIO()
    wavfile.write(buf, rate=sample_rate, data=audio_array)
    audio_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"audio_b64": audio_b64, "inference_time": inference_time}


def handle_cogvideo(job_input):
    """Generate video with CogVideoX-5B."""
    from diffusers.utils import export_to_video

    prompt = job_input.get("prompt", "")
    num_frames = job_input.get("num_frames", 49)  # ~6 seconds at 8fps
    steps = job_input.get("num_inference_steps", 50)
    guidance = job_input.get("guidance_scale", 6.0)
    seed = job_input.get("seed")

    if not prompt:
        raise ValueError("prompt is required for video generation")

    # Clamp frames (CogVideoX supports 49 frames = ~6s at 8fps)
    num_frames = max(17, min(num_frames, 49))

    pipe = get_cogvideo_pipe()

    if seed is None:
        seed = int(time.time()) % 2**32
    generator = torch.Generator("cuda").manual_seed(seed)

    start = time.time()
    video = pipe(
        prompt=prompt,
        num_inference_steps=steps,
        num_frames=num_frames,
        guidance_scale=guidance,
        generator=generator,
    ).frames[0]
    inference_time = time.time() - start
    print(f"[DreamForge] CogVideoX generated {num_frames} frames in {inference_time:.1f}s (seed={seed})")

    # Export to MP4
    video_path = f"/tmp/cogvideo_{int(time.time())}.mp4"
    export_to_video(video, video_path, fps=8)

    # Read and base64 encode
    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")

    # Clean up
    os.remove(video_path)

    return {"video_b64": video_b64, "inference_time": inference_time, "seed": seed, "num_frames": num_frames}


def _load_wan_lora(pipe, lora_id, lora_scale):
    """Load an optional Wan LoRA (HF repo id or direct .safetensors URL)."""
    if not lora_id:
        return
    try:
        if lora_id.startswith("http://") or lora_id.startswith("https://"):
            import requests as req_lib
            lora_path = f"/tmp/wanlora_{hash(lora_id) % 10**8}.safetensors"
            if not os.path.exists(lora_path):
                print(f"[DreamForge] Downloading Wan LoRA: {lora_id}")
                resp = req_lib.get(lora_id, timeout=180)
                resp.raise_for_status()
                with open(lora_path, "wb") as f:
                    f.write(resp.content)
            pipe.load_lora_weights(lora_path)
        else:
            pipe.load_lora_weights(lora_id)
        pipe.fuse_lora(lora_scale=lora_scale)
        print(f"[DreamForge] Wan LoRA loaded: {lora_id} (scale={lora_scale})")
    except Exception as e:
        print(f"[DreamForge] Wan LoRA load failed ({lora_id}): {e}")


def handle_wan(job_input):
    """Generate video with Wan 2.2 TI2V-5B.

    task=wan-t2v  -> text-to-video
    task=wan-i2v  -> image-to-video (animate a source frame passed as image_b64)

    Uncensored path: the app already runs prompt (and source-image) moderation
    before this is ever called; this worker just produces frames.
    """
    from diffusers.utils import export_to_video

    task = job_input.get("task", "wan-t2v")
    tier = job_input.get("tier", "fast")  # "fast" = 5B TI2V, "hd" = A14B
    prompt = job_input.get("prompt", "")
    negative_prompt = job_input.get("negative_prompt") or (
        "低质量, 模糊, 变形, 多余的肢体, blurry, low quality, distorted, deformed, extra limbs, watermark, text"
    )
    width = int(job_input.get("width", 480))
    height = int(job_input.get("height", 832))
    num_frames = int(job_input.get("num_frames", 81))
    steps = int(job_input.get("num_inference_steps", 40))
    guidance = float(job_input.get("guidance_scale", 5.0))
    fps = int(job_input.get("fps", 16))
    seed = job_input.get("seed")
    lora_id = job_input.get("lora_id")
    lora_scale = float(job_input.get("lora_scale", 0.8))

    if not prompt:
        raise ValueError("prompt is required for video generation")

    # Wan wants spatial dims on a 16-grid and num_frames = 4k+1 (4x temporal VAE).
    width = max(320, min(width, 1280)) // 16 * 16
    height = max(320, min(height, 1280)) // 16 * 16
    num_frames = max(49, min(num_frames, 121))
    num_frames = ((num_frames - 1) // 4) * 4 + 1
    fps = max(8, min(fps, 24))

    if seed is None:
        seed = int(time.time()) % 2**32
    generator = torch.Generator("cuda").manual_seed(seed)

    common = dict(
        prompt=prompt,
        negative_prompt=negative_prompt,
        height=height,
        width=width,
        num_frames=num_frames,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )

    start = time.time()
    if task == "wan-i2v":
        image_b64 = job_input.get("image_b64")
        if not image_b64:
            raise ValueError("image_b64 (source frame) is required for wan-i2v")
        src = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
        # Fit the source to the target frame so the first frame lines up.
        src = src.resize((width, height))
        pipe = get_wan_hd_i2v_pipe() if tier == "hd" else get_wan_i2v_pipe()
        _load_wan_lora(pipe, lora_id, lora_scale)
        video = pipe(image=src, **common).frames[0]
    else:
        pipe = get_wan_hd_t2v_pipe() if tier == "hd" else get_wan_t2v_pipe()
        _load_wan_lora(pipe, lora_id, lora_scale)
        video = pipe(**common).frames[0]

    inference_time = time.time() - start
    print(f"[DreamForge] Wan {task} tier={tier} {num_frames}f {width}x{height} in {inference_time:.1f}s (seed={seed})")

    video_path = f"/tmp/wan_{int(time.time())}.mp4"
    export_to_video(video, video_path, fps=fps)
    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")
    os.remove(video_path)

    return {
        "video_b64": video_b64,
        "inference_time": inference_time,
        "seed": seed,
        "num_frames": num_frames,
        "fps": fps,
        "width": width,
        "height": height,
    }


def handle_musicgen(job_input):
    """Generate music with Meta MusicGen."""
    import torchaudio

    prompt = job_input.get("prompt", "")
    duration = job_input.get("duration", 30)
    duration = max(1, min(duration, 120))

    if not prompt:
        raise ValueError("prompt is required for music generation")

    model = get_musicgen()
    model.set_generation_params(duration=duration)

    start = time.time()
    wav = model.generate([prompt])
    inference_time = time.time() - start
    print(f"[DreamForge] MusicGen generated {duration}s audio in {inference_time:.1f}s")

    # Save to WAV buffer
    buf = io.BytesIO()
    torchaudio.save(buf, wav[0].cpu(), sample_rate=model.sample_rate, format="wav")
    audio_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"audio_b64": audio_b64, "inference_time": inference_time, "duration": duration}


def handle_audiogen(job_input):
    """Generate sound effects with Meta AudioGen."""
    import torchaudio

    prompt = job_input.get("prompt", "")
    duration = job_input.get("duration", 5)
    duration = max(1, min(duration, 30))

    if not prompt:
        raise ValueError("prompt is required for SFX generation")

    model = get_audiogen()
    model.set_generation_params(duration=duration)

    start = time.time()
    wav = model.generate([prompt])
    inference_time = time.time() - start
    print(f"[DreamForge] AudioGen generated {duration}s SFX in {inference_time:.1f}s")

    buf = io.BytesIO()
    torchaudio.save(buf, wav[0].cpu(), sample_rate=model.sample_rate, format="wav")
    audio_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"audio_b64": audio_b64, "inference_time": inference_time, "duration": duration}


def handle_tryon(job_input):
    """Virtual try-on with CatVTON — overlay garment onto person."""
    import requests as req_lib
    from torchvision import transforms

    person_url = job_input.get("person_image_url", "")
    garment_url = job_input.get("garment_image_url", "")
    cloth_type = job_input.get("cloth_type", "upper")
    steps = job_input.get("num_inference_steps", 30)
    guidance = job_input.get("guidance_scale", 2.5)

    if not person_url or not garment_url:
        raise ValueError("person_image_url and garment_image_url are required")

    # Download images
    person_img = Image.open(io.BytesIO(req_lib.get(person_url).content)).convert("RGB")
    garment_img = Image.open(io.BytesIO(req_lib.get(garment_url).content)).convert("RGB")

    # Resize to CatVTON's expected resolution (768x1024)
    target_w, target_h = 768, 1024
    person_img = person_img.resize((target_w, target_h), Image.LANCZOS)
    garment_img = garment_img.resize((target_w, target_h), Image.LANCZOS)

    pipeline, masker = get_catvton()

    start = time.time()

    # Generate mask automatically
    mask = masker(person_img, cloth_type)["mask"]

    # Run try-on
    generator = torch.Generator("cuda").manual_seed(int(time.time()) % 2**32)
    result = pipeline(
        image=person_img,
        condition_image=garment_img,
        mask=mask,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )[0]

    inference_time = time.time() - start
    print(f"[DreamForge] CatVTON try-on completed in {inference_time:.1f}s")

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

    return {"image_b64": image_b64, "inference_time": inference_time}


# ─── RunPod Handler ──────────────────────────────────────────────────────────

def handler(job):
    """Main RunPod serverless handler — routes to the correct model."""
    job_input = job.get("input", {})
    task = job_input.get("task", "flux-dev")

    try:
        if task == "warm":
            return handle_warm(job_input)
        elif task in ("flux-dev", "flux-schnell"):
            return handle_flux(job_input)
        elif task == "flux-img2img":
            return handle_flux_img2img(job_input)
        elif task == "esrgan":
            return handle_esrgan(job_input)
        elif task == "rmbg":
            return handle_rmbg(job_input)
        elif task == "tryon":
            return handle_tryon(job_input)
        elif task == "bark-tts":
            return handle_bark_tts(job_input)
        elif task == "cogvideo":
            return handle_cogvideo(job_input)
        elif task in ("wan-t2v", "wan-i2v"):
            return handle_wan(job_input)
        elif task == "musicgen":
            return handle_musicgen(job_input)
        elif task == "audiogen":
            return handle_audiogen(job_input)
        else:
            return {"error": f"Unknown task: {task}"}
    except Exception as e:
        print(f"[DreamForge] Error in {task}: {e}")
        return {"error": str(e)}


runpod.serverless.start({"handler": handler})
