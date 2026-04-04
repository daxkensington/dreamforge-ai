FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 wget \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download Real-ESRGAN weights
RUN mkdir -p /models && \
    wget -q -O /models/RealESRGAN_x4plus.pth \
    https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth

# Pre-download RMBG-2.0 model weights (cached in HuggingFace cache)
RUN python -c "from transformers import AutoModelForImageSegmentation; AutoModelForImageSegmentation.from_pretrained('briaai/RMBG-2.0', trust_remote_code=True)"

# Pre-download Flux Schnell (smaller, always loaded)
# Flux Dev will be downloaded on first use if needed
RUN python -c "from diffusers import FluxPipeline; FluxPipeline.from_pretrained('black-forest-labs/FLUX.1-schnell', torch_dtype='auto')"

# Copy handler
COPY handler.py .

CMD ["python", "-u", "handler.py"]
