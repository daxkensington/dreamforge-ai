FROM runpod/pytorch:1.0.3-cu1281-torch280-ubuntu2204

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Enable fast parallel HF downloads at runtime (first worker startup)
ENV HF_HUB_ENABLE_HF_TRANSFER=1
RUN pip install --no-cache-dir hf-transfer

# Download Real-ESRGAN weights (small, no HF gating)
RUN mkdir -p /models && \
    wget -q -O /models/RealESRGAN_x4plus.pth \
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth

# Flux + RMBG-2.0 are downloaded lazily on first request — HF_TOKEN must be set
# at runtime via RunPod endpoint env vars. RunPod's network to HF CDN is far
# faster than pre-baking weights into the image.

# Copy handler
COPY handler.py .

CMD ["python", "-u", "handler.py"]
