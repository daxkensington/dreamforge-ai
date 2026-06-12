#!/bin/bash
# Discover the full set of Python deps audiocraft needs at import time that
# the worker image is missing. Mirrors the Dockerfile's audio-relevant pip
# state, then loops: import → catch ModuleNotFoundError → pip install → retry.
# Prints "EXTRA_DEPS: <list>" at the end.
set -u

# Matched torch pair mirroring the real base image (torch 2.8.0). PyPI stays
# primary so transitive deps (typing-extensions etc.) resolve; the cpu wheel
# index is extra.
pip install --no-cache-dir -q torch==2.8.0 torchaudio==2.8.0 --extra-index-url https://download.pytorch.org/whl/cpu 2>&1 | tail -1

# Mirror the audio-relevant subset of requirements.txt.
pip install --no-cache-dir -q soundfile einops sentencepiece protobuf numpy scipy transformers accelerate safetensors 2>&1 | tail -1
# xformers is in the real image's requirements (resolved against the image's
# torch at build, so coherent there). Latest xformers is ABI-incompatible with
# this container's torch 2.8 — stub it; we only need audiocraft's import
# graph, not working attention kernels.
SP=$(python -c "import site; print(site.getsitepackages()[0])")
mkdir -p "$SP/xformers/ops"
echo "" > "$SP/xformers/__init__.py"
printf 'def memory_efficient_attention(*a, **k):\n    raise RuntimeError("stub")\nclass LowerTriangularMask:\n    pass\n' > "$SP/xformers/ops/__init__.py"
# Mirror the Dockerfile's audiocraft install (torchaudio already present).
pip install --no-cache-dir -q --no-deps audiocraft 2>&1 | tail -1
pip install --no-cache-dir -q lameenc num2words flashy imageio-ffmpeg imageio 2>&1 | tail -1

EXTRAS=()
for i in $(seq 1 15); do
  ERR=$(python -c "from audiocraft.models import MusicGen, AudioGen; print('IMPORT_OK')" 2>&1)
  if echo "$ERR" | grep -q IMPORT_OK; then
    echo "ALL IMPORTS OK after: ${EXTRAS[*]:-none}"
    echo "EXTRA_DEPS: ${EXTRAS[*]:-none}"
    exit 0
  fi
  MOD=$(echo "$ERR" | grep -oP "No module named '\K[^.']+" | head -1)
  if [ -z "$MOD" ]; then
    echo "NON-MODULE ERROR:"; echo "$ERR" | tail -6
    echo "EXTRA_DEPS so far: ${EXTRAS[*]:-none}"
    exit 1
  fi
  PKG=$MOD
  [ "$MOD" = "hydra" ] && PKG="hydra-core"
  [ "$MOD" = "dora" ] && PKG="dora-search"
  echo "missing module: $MOD → installing $PKG"
  # Normal install (no --no-deps) so packages like spacy bring a coherent
  # dependency tree. torch is pinned-satisfied so nothing should upgrade it.
  pip install --no-cache-dir -q "$PKG" 2>&1 | tail -1
  EXTRAS+=("$PKG")
done
echo "EXTRA_DEPS (loop limit): ${EXTRAS[*]}"
