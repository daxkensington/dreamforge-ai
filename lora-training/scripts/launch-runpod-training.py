"""Launch a RunPod pod for LoRA training.

Usage:
  python lora-training/scripts/launch-runpod-training.py cinematic

Prereqs:
  - RUNPOD_API_KEY in env (same token used by the serverless endpoint)
  - R2_* env (or HF_TOKEN) for upload destination
  - Training dataset at lora-training/datasets/<style-id>/

This creates a 1x A40 pod (~$0.34/hr on community cloud, training runs
30-90 min so budget ~$0.30-$0.70 per style). The pod self-terminates
via the `pip install awscli && ... && runpodctl stop pod` tail in the
generated docker_args.
"""
import json
import os
import pathlib
import ssl
import sys
import urllib.request

POD_GPU_TYPE_ID = "NVIDIA A40"  # ~$0.34/hr community cloud, 48GB VRAM
POD_IMAGE = "runpod/pytorch:2.3.0-py3.10-cuda12.1-devel-ubuntu22.04"
RUNPOD_GRAPHQL = "https://api.runpod.io/graphql"


def _env(key: str, required: bool = True) -> str | None:
    val = os.environ.get(key, "")
    if required and not val:
        print(f"ERROR: env var {key} required", file=sys.stderr)
        sys.exit(1)
    return val or None


def launch_pod(style_id: str, steps: int = 2000, rank: int = 64) -> dict:
    runpod_key = _env("RUNPOD_API_KEY")
    r2_key = _env("R2_ACCESS_KEY_ID", required=False)
    r2_secret = _env("R2_SECRET_ACCESS_KEY", required=False)
    r2_endpoint = _env("R2_ENDPOINT", required=False)
    r2_bucket = _env("R2_BUCKET_NAME", required=False)
    hf_token = _env("HF_TOKEN", required=False)

    if not ((r2_key and r2_secret and r2_endpoint and r2_bucket) or hf_token):
        print("ERROR: either R2_* (4 vars) or HF_TOKEN required for upload", file=sys.stderr)
        sys.exit(1)

    # Startup script runs inside the pod. It clones training data from
    # GitHub (public repo fork + PR with datasets) — simpler than scp.
    # NB: edit DATASET_URL if you push the training dataset elsewhere.
    startup = f"""#!/bin/bash
set -euo pipefail
cd /workspace
apt-get update -qq && apt-get install -y -qq git wget curl
git clone --depth=1 https://github.com/daxkensington/dreamforge-ai.git
cd dreamforge-ai/lora-training
export HF_TOKEN="{hf_token or ''}"
export R2_ACCESS_KEY_ID="{r2_key or ''}"
export R2_SECRET_ACCESS_KEY="{r2_secret or ''}"
export R2_ENDPOINT="{r2_endpoint or ''}"
export R2_BUCKET_NAME="{r2_bucket or ''}"
bash scripts/train-lora.sh "{style_id}" {rank} {steps}
# Auto-terminate pod when done to stop billing
runpodctl stop pod $RUNPOD_POD_ID || true
"""

    query = """
    mutation podFindAndDeployOnDemand($input: PodFindAndDeployOnDemandInput!) {
        podFindAndDeployOnDemand(input: $input) {
            id
            name
            machine { podHostId }
        }
    }
    """
    variables = {
        "input": {
            "cloudType": "COMMUNITY",
            "gpuCount": 1,
            "volumeInGb": 50,
            "containerDiskInGb": 50,
            "minVcpuCount": 4,
            "minMemoryInGb": 24,
            "gpuTypeId": POD_GPU_TYPE_ID,
            "name": f"dreamforge-lora-{style_id}",
            "imageName": POD_IMAGE,
            "dockerArgs": f"bash -c '{startup}'",
            "ports": "8888/http",
            "volumeMountPath": "/workspace",
            "env": [
                {"key": "STYLE_ID", "value": style_id},
            ],
        }
    }

    body = json.dumps({"query": query, "variables": variables}).encode()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        f"{RUNPOD_GRAPHQL}?api_key={runpod_key}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
        payload = json.loads(r.read())

    if "errors" in payload:
        print("RunPod API error:", json.dumps(payload["errors"], indent=2), file=sys.stderr)
        sys.exit(1)

    pod = payload.get("data", {}).get("podFindAndDeployOnDemand", {})
    print(f"Launched pod: id={pod.get('id')} name={pod.get('name')}")
    print("Watch progress:")
    print(f"  runpodctl get pod {pod.get('id')}")
    print(f"  runpodctl logs {pod.get('id')}")
    print()
    print("Pod self-terminates on completion. ~30-90 min at ~$0.34/hr.")
    return pod


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python launch-runpod-training.py <style-id> [steps] [rank]")
        print("Styles per configs/styles.json: cinematic, anime, fantasy, product, abstract")
        sys.exit(1)
    style = sys.argv[1]
    steps = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
    rank = int(sys.argv[3]) if len(sys.argv) > 3 else 64
    launch_pod(style, steps=steps, rank=rank)
