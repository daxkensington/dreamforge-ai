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
RUN pip install --no-cache-dir --no-deps audiocraft && \
    pip install --no-cache-dir lameenc num2words flashy torchaudio

# Enable fast parallel HF downloads at runtime (first worker startup)
ENV HF_HUB_ENABLE_HF_TRANSFER=1
RUN pip install --no-cache-dir hf-transfer

# Download Real-ESRGAN weights (small, no HF gating)
RUN mkdir -p /models && \
    wget -q -O /models/RealESRGAN_x4plus.pth \
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth

# Clone CatVTON (virtual try-on) — need the custom pipeline + masker code
RUN git clone --depth 1 https://github.com/Zheng-Chong/CatVTON.git /app/catvton && \
    rm -rf /app/catvton/.git

# Flux + RMBG-2.0 + CatVTON weights are downloaded lazily on first request.
# HF_TOKEN must be set at runtime via RunPod endpoint env vars.

# Copy handler
COPY handler.py .

CMD ["python", "-u", "handler.py"]
