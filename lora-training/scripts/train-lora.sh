#!/bin/bash
# Train a DreamForge LoRA style on a RunPod GPU pod
# Usage: ./train-lora.sh <style-id> [rank] [steps]
#
# Prerequisites:
#   - RunPod pod with A100 or A40 GPU
#   - ai-toolkit installed: pip install ai-toolkit
#   - HF_TOKEN set for uploading weights
#   - Training images in /workspace/datasets/<style-id>/

set -euo pipefail

STYLE_ID="${1:?Usage: ./train-lora.sh <style-id>}"
RANK="${2:-64}"
STEPS="${3:-2000}"
LR="1e-4"
RESOLUTION="1024"
BASE_MODEL="black-forest-labs/FLUX.1-dev"
OUTPUT_DIR="/workspace/output/${STYLE_ID}"
DATASET_DIR="/workspace/datasets/${STYLE_ID}"

echo "=== DreamForge LoRA Training ==="
echo "Style: ${STYLE_ID}"
echo "Rank: ${RANK}"
echo "Steps: ${STEPS}"
echo "Resolution: ${RESOLUTION}"
echo "Base model: ${BASE_MODEL}"
echo "Dataset: ${DATASET_DIR}"
echo "Output: ${OUTPUT_DIR}"
echo ""

# Check dataset exists
if [ ! -d "${DATASET_DIR}" ]; then
  echo "ERROR: Dataset directory not found: ${DATASET_DIR}"
  exit 1
fi

IMAGE_COUNT=$(find "${DATASET_DIR}" -name "*.jpg" -o -name "*.png" | wc -l)
echo "Found ${IMAGE_COUNT} training images"

if [ "${IMAGE_COUNT}" -lt 10 ]; then
  echo "ERROR: Need at least 10 training images, found ${IMAGE_COUNT}"
  exit 1
fi

# Install ai-toolkit if not present
if ! python -c "import toolkit" 2>/dev/null; then
  echo "Installing ai-toolkit..."
  pip install git+https://github.com/ostris/ai-toolkit.git --quiet
fi

# Create training config
mkdir -p "${OUTPUT_DIR}"
cat > "${OUTPUT_DIR}/config.yaml" << EOF
job: extension
config:
  name: "${STYLE_ID}"
  process:
    - type: sd_trainer
      training_folder: "${OUTPUT_DIR}"
      device: cuda:0
      network:
        type: lora
        linear: ${RANK}
        linear_alpha: ${RANK}
      save:
        dtype: float16
        save_every: 500
        max_step_saves_to_keep: 2
      datasets:
        - folder_path: "${DATASET_DIR}"
          caption_ext: txt
          caption_dropout_rate: 0.05
          resolution: ${RESOLUTION}
          batch_size: 1
          shuffle: true
      train:
        batch_size: 1
        steps: ${STEPS}
        gradient_accumulation_steps: 1
        train_unet: true
        train_text_encoder: false
        gradient_checkpointing: true
        noise_scheduler: flowmatch
        optimizer: adamw8bit
        lr: ${LR}
        ema_decay: 0.99
        dtype: bf16
      model:
        name_or_path: "${BASE_MODEL}"
        is_flux: true
        quantize: true
      sample:
        sampler: flowmatch
        sample_every: 500
        width: ${RESOLUTION}
        height: ${RESOLUTION}
        prompts:
          - "${STYLE_ID} style, a majestic landscape with dramatic lighting"
          - "${STYLE_ID} style, a detailed portrait with expressive features"
          - "${STYLE_ID} style, an abstract composition with bold colors"
        neg: ""
        seed: 42
        walk_seed: true
        guidance_scale: 4
        sample_steps: 20
EOF

# Auto-caption images if no .txt files exist
TXT_COUNT=$(find "${DATASET_DIR}" -name "*.txt" | wc -l)
if [ "${TXT_COUNT}" -lt "${IMAGE_COUNT}" ]; then
  echo "Auto-captioning ${IMAGE_COUNT} images..."
  python -c "
import os, json
dataset_dir = '${DATASET_DIR}'
# Use metadata.jsonl if available
meta_path = os.path.join(dataset_dir, 'metadata.jsonl')
if os.path.exists(meta_path):
    with open(meta_path) as f:
        for line in f:
            entry = json.loads(line.strip())
            txt_path = os.path.join(dataset_dir, entry['file'].rsplit('.', 1)[0] + '.txt')
            with open(txt_path, 'w') as tf:
                tf.write(entry['prompt'])
    print(f'Captioned from metadata.jsonl')
else:
    # Fallback: use filenames
    for img in sorted(os.listdir(dataset_dir)):
        if img.endswith(('.jpg', '.png')):
            txt = os.path.join(dataset_dir, img.rsplit('.', 1)[0] + '.txt')
            if not os.path.exists(txt):
                with open(txt, 'w') as f:
                    f.write('${STYLE_ID} style image')
    print('Captioned with fallback')
"
fi

echo ""
echo "Starting training..."
echo "This will take approximately 30-90 minutes."
echo ""

# Run training
python -m toolkit.job "${OUTPUT_DIR}/config.yaml"

echo ""
echo "=== Training Complete ==="
echo "LoRA weights saved to: ${OUTPUT_DIR}"
echo ""

# Upload to HuggingFace if HF_TOKEN is set (write scope required)
if [ -n "${HF_TOKEN:-}" ]; then
  HF_REPO="daxkensington/${STYLE_ID}"
  echo "Uploading to HuggingFace: ${HF_REPO}"
  python -c "
from huggingface_hub import HfApi
import os
api = HfApi()
try:
    api.create_repo('${HF_REPO}', repo_type='model', exist_ok=True)
except: pass
output_dir = '${OUTPUT_DIR}'
for f in os.listdir(output_dir):
    if f.endswith('.safetensors'):
        api.upload_file(
            path_or_fileobj=os.path.join(output_dir, f),
            path_in_repo=f,
            repo_id='${HF_REPO}',
        )
        print(f'Uploaded: {f}')
print('Done!')
"
  echo "Uploaded to: https://huggingface.co/${HF_REPO}"
elif [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_ACCESS_KEY:-}" ] && [ -n "${R2_ENDPOINT:-}" ] && [ -n "${R2_BUCKET_NAME:-}" ]; then
  # Alternate path: upload to Cloudflare R2 (S3-compatible).
  # The RunPod handler loads LoRAs from direct URLs — R2 public URLs work.
  echo "Uploading to R2 bucket: ${R2_BUCKET_NAME}/lora/${STYLE_ID}/"
  if ! command -v aws &> /dev/null; then
    pip install awscli --quiet
  fi
  export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
  export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
  for f in $(find "${OUTPUT_DIR}" -name "*.safetensors" -type f); do
    FILENAME=$(basename "$f")
    aws s3 cp "$f" "s3://${R2_BUCKET_NAME}/lora/${STYLE_ID}/${FILENAME}" \
      --endpoint-url "${R2_ENDPOINT}" \
      --checksum-algorithm CRC32
    echo "Uploaded: ${FILENAME}"
  done
  R2_PUBLIC="${R2_PUBLIC_URL:-https://cdn.dreamforgex.ai}"
  echo ""
  echo "LoRA weights available at: ${R2_PUBLIC}/lora/${STYLE_ID}/<filename>.safetensors"
  echo "Wire into handler: pass lora_url=\"${R2_PUBLIC}/lora/${STYLE_ID}/...\" to flux task"
else
  echo "Neither HF_TOKEN nor R2_* env set — leaving LoRA on pod disk"
  echo "Manual upload options:"
  echo "  HF:  huggingface-cli upload daxkensington/${STYLE_ID} ${OUTPUT_DIR}/"
  echo "  R2:  export R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_ENDPOINT=... R2_BUCKET_NAME=... and re-run"
fi
