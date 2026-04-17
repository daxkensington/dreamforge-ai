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
_bark_processor = None
_bark_model = None


def get_flux_pipe(model_type="dev"):
    """Load Flux.1 pipeline (Dev or Schnell)."""
    global _flux_pipe
    if _flux_pipe is None or _flux_pipe._model_type != model_type:
        from diffusers import FluxPipeline

        model_id = (
            "black-forest-labs/FLUX.1-dev"
            if model_type == "dev"
            else "black-forest-labs/FLUX.1-schnell"
        )
        print(f"[DreamForge] Loading {model_id}...")
        pipe = FluxPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
        )
        pipe.to("cuda")

        # Optimize with torch.compile for 30-50% speedup
        if hasattr(torch, "compile"):
            try:
                pipe.transformer = torch.compile(pipe.transformer, mode="reduce-overhead")
                print("[DreamForge] torch.compile applied to transformer")
            except Exception as e:
                print(f"[DreamForge] torch.compile skipped: {e}")

        pipe._model_type = model_type
        _flux_pipe = pipe
    return _flux_pipe


def get_flux_img2img_pipe(model_type="dev"):
    """Load Flux.1 img2img pipeline."""
    global _flux_img2img_pipe
    if _flux_img2img_pipe is None or getattr(_flux_img2img_pipe, "_model_type", None) != model_type:
        from diffusers import FluxImg2ImgPipeline

        model_id = (
            "black-forest-labs/FLUX.1-dev"
            if model_type == "dev"
            else "black-forest-labs/FLUX.1-schnell"
        )
        print(f"[DreamForge] Loading Flux img2img ({model_id})...")
        pipe = FluxImg2ImgPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.bfloat16,
        )
        pipe.to("cuda")
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

    # Load LoRA weights if requested (supports HF repo ID or direct URL to .safetensors)
    if lora_id:
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
            else:
                # HuggingFace repo ID
                pipe.load_lora_weights(lora_id)
            pipe.fuse_lora(lora_scale=lora_scale)
            print(f"[DreamForge] LoRA loaded: {lora_id} (scale={lora_scale})")
        except Exception as e:
            print(f"[DreamForge] LoRA load failed ({lora_id}): {e}")

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

    # Unload LoRA after generation to keep base model clean for next request
    if lora_id:
        try:
            pipe.unfuse_lora()
            pipe.unload_lora_weights()
        except Exception:
            pass

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

    pipe = get_flux_img2img_pipe("dev")

    # Load LoRA if requested
    if lora_id:
        try:
            pipe.load_lora_weights(lora_id)
            pipe.fuse_lora(lora_scale=lora_scale)
            print(f"[DreamForge] img2img LoRA loaded: {lora_id}")
        except Exception as e:
            print(f"[DreamForge] img2img LoRA load failed: {e}")

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
    print(f"[DreamForge] Flux img2img completed in {inference_time:.1f}s (seed={seed}, strength={strength})")

    if lora_id:
        try:
            pipe.unfuse_lora()
            pipe.unload_lora_weights()
        except Exception:
            pass

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
        if task in ("flux-dev", "flux-schnell"):
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
