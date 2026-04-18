"""Generate 13 showcase images via Grok Imagine API."""
import json
import os
import pathlib
import subprocess
import sys
import urllib.request
import urllib.error
import ssl

HOME = pathlib.Path.home()
ENV_FILE = HOME / ".claude" / ".env"
OUT_DIR = HOME / "genesis-synth-lab" / "public" / "showcase"
ENDPOINT = "https://api.x.ai/v1/images/generations"
MODEL = "grok-imagine-image"


def load_key() -> str:
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith("GROK_API_KEY="):
            val = line.split("=", 1)[1].strip().strip('"').strip("'")
            return val
    raise SystemExit("GROK_API_KEY not found in " + str(ENV_FILE))


def request_image(key: str, prompt: str) -> str:
    body = json.dumps({"model": MODEL, "prompt": prompt, "n": 1}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # Windows CRL/revoke workaround
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        payload = json.loads(resp.read())
    url = payload.get("data", [{}])[0].get("url")
    if not url:
        raise RuntimeError(f"No url in response: {payload}")
    return url


def download(url: str, out_path: pathlib.Path) -> int:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; dreamforgex-showcase)"},
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        data = resp.read()
    out_path.write_bytes(data)
    return len(data)


def gen(key: str, slug: str, prompt: str) -> None:
    out = OUT_DIR / f"tool-{slug}.jpg"
    print(f"[{slug}] requesting...", flush=True)
    try:
        url = request_image(key, prompt)
    except urllib.error.HTTPError as e:
        print(f"[{slug}] HTTP error {e.code}: {e.read().decode()}", file=sys.stderr)
        return
    print(f"[{slug}] downloading", flush=True)
    size = download(url, out)
    print(f"[{slug}] saved {size:,} bytes -> {out.name}", flush=True)


TASKS = [
    ("pixel-art",
     "Vibrant 16-bit pixel art fantasy scene: heroic knight with glowing sword facing a dragon on a mountain peak at sunset, saturated colors, crisp pixel edges, classic SNES-era game art, dreamy painterly sky"),
    ("coloring-book",
     "Black ink line art drawing of whimsical garden with butterflies, flowers, and a friendly cartoon fox, clean bold outlines on pure white background, printable coloring book page for children, medium complexity"),
    ("tattoo-design",
     "Traditional American tattoo flash art laid on parchment: bold eagle with roses and a dagger, both a black stencil version and full color version side by side, rich saturated reds blues yellows, tattoo artist portfolio page"),
    ("cover-maker",
     "Three floating book covers of different genres — sci-fi thriller, romance, and crime noir — with elegant typography and dramatic studio lighting, publishing art direction, bestseller aesthetic"),
    ("pose-turnaround",
     "Character turnaround reference sheet on studio grid: three consistent views of a female cyberpunk warrior (front, side profile, back) standing in T-pose, clean neutral background, professional concept artist portfolio"),
    ("photo-colorize",
     "Split-image transition: left half vintage 1940s black and white family portrait, right half the same portrait beautifully colorized with natural warm skin tones and authentic period clothing, seamless diagonal merge"),
    ("podcast-cover",
     "Grid of six colorful podcast cover artworks in different genres arranged on dark moody background: true crime, comedy, business, tech, self-help, music — bold typography, podcast art collection"),
    ("listing-photos",
     "E-commerce product photography grid: handmade ceramic mug photographed in five different styles — hero studio shot, detail close-up, lifestyle with coffee, flatlay with props, outdoor — Etsy seller quality"),
    ("real-estate-twilight",
     "Beautiful modern suburban home exterior at twilight hour, glowing warm yellow windows, deep purple-blue gradient sky, landscape path lighting, MLS-quality real estate photography magic hour"),
    ("fashion-lookbook",
     "Editorial fashion lookbook spread: elegant model in coordinated minimalist cream outfit photographed across four scenes — rooftop, studio, street, golden hour meadow — magazine quality, shallow depth of field"),
    ("meme-template",
     "Collage of classic internet meme templates arranged as a grid on a cork board: Drake approval, distracted boyfriend, galaxy brain, this is fine, change my mind — vibrant graphic design, meme culture"),
    ("yt-thumbnails",
     "Stack of four bold YouTube thumbnails fanned out on screen, each with shocked facial expressions and huge punchy text overlays, saturated red and yellow colors, MrBeast-style clickbait composition, 16:9 aspect"),
    ("ig-carousel",
     "Stack of five overlapping square Instagram carousel slides floating on a pastel gradient, clean modern typography, minimalist editorial design with small headlines and supporting copy, content creator aesthetic"),
]


def main() -> None:
    key = load_key()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug, prompt in TASKS:
        try:
            gen(key, slug, prompt)
        except Exception as e:  # noqa: BLE001
            print(f"[{slug}] ERROR: {e}", file=sys.stderr)
    print("done")


if __name__ == "__main__":
    main()
