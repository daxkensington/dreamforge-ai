FROM runpod/pytorch:1.0.3-cu1281-torch280-ubuntu2204

WORKDIR /app

# Install system deps (ffmpeg/libav needed for audiocraft)
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 wget git \
    ffmpeg libavcodec-dev libavformat-dev libavutil-dev libswresample-dev \
    libavdevice-dev libavfilter-dev libswscale-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (in stages to avoid resolver conflicts)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# audiocraft is installed --no-deps (its setup pins an ancient torch), so its
# import-time deps must be backfilled by hand. The full set was enumerated
# empirically 2026-06-12 (runpod-worker/find-missing-deps.sh): missing any of
# av/julius/spacy/librosa/torchmetrics kills MusicGen/AudioGen with
# "No module named X" at generation time.
# NOTE (determinism audit): audiocraft, the backfill packages above, and
# hf-transfer below are deliberately left UNPINNED — no version was ever
# specified for them, so there is nothing to freeze to without guessing
# (that would be an upgrade, not a freeze). requirements.txt is the frozen set.
RUN pip install --no-cache-dir --no-deps audiocraft && \
    pip install --no-cache-dir lameenc num2words flashy torchaudio imageio-ffmpeg imageio \
    av julius spacy librosa torchmetrics

# Enable fast parallel HF downloads at runtime (first worker startup)
ENV HF_HUB_ENABLE_HF_TRANSFER=1
RUN pip install --no-cache-dir hf-transfer

# Download Real-ESRGAN weights (small, no HF gating).
# TODO(security): NO integrity verification on this download — the upstream
# Real-ESRGAN v0.1.0 release publishes no adjacent .sha256/checksum file, and
# the .pth is too large to checksum without downloading it (audit rule: never
# add checksums that can't be verified). If upstream ever publishes one, add:
#   echo "<sha256>  /models/RealESRGAN_x4plus.pth" | sha256sum -c
RUN mkdir -p /models && \
    wget -q -O /models/RealESRGAN_x4plus.pth \
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth

# Clone CatVTON (virtual try-on) — need the custom pipeline + masker code.
# Pinned to default-branch commit 7818397f (HEAD as of 2026-09-30) so the build
# can't drift with upstream. Shallow clone + fetch keeps layer caching: once
# upstream advances past the pin, the depth-1 clone grabs the new tip and the
# fetch+checkout rolls it back to the pinned SHA.
RUN git clone --depth 1 https://github.com/Zheng-Chong/CatVTON.git /app/catvton && \
    cd /app/catvton && \
    git fetch --depth 1 origin 7818397f25613beedb3d861a34769f607cfcf3b1 && \
    git checkout 7818397f25613beedb3d861a34769f607cfcf3b1 && \
    rm -rf .git

# Flux + RMBG-2.0 + CatVTON (HF repo zhengchong/CatVTON) + Depth Anything V2
# Small (depth-anything/Depth-Anything-V2-Small-hf, the `depth` task) weights
# are downloaded lazily on first request via huggingface_hub. Those downloads ARE integrity
# checked (the client verifies LFS sha256 at download time) but NOT pinned to a
# repo revision — an upstream repo change will change the weights.
# HF_TOKEN must be set at runtime via RunPod endpoint env vars.

# Copy handler
COPY handler.py .

CMD ["python", "-u", "handler.py"]
