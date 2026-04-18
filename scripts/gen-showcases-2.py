"""Generate showcase images for Phase 29.2 — 10 new tools."""
import json
import pathlib
import ssl
import sys
import urllib.error
import urllib.request

HOME = pathlib.Path.home()
ENV_FILE = HOME / ".claude" / ".env"
OUT_DIR = HOME / "genesis-synth-lab" / "public" / "showcase"
ENDPOINT = "https://api.x.ai/v1/images/generations"
MODEL = "grok-imagine-image"


def load_key() -> str:
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith("GROK_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GROK_API_KEY not found")


def request_image(key: str, prompt: str) -> str:
    body = json.dumps({"model": MODEL, "prompt": prompt, "n": 1}).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=120, context=ctx) as resp:
        payload = json.loads(resp.read())
    url = payload.get("data", [{}])[0].get("url")
    if not url:
        raise RuntimeError(f"No url in response: {payload}")
    return url


def download(url: str, out_path: pathlib.Path) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; dreamforgex-showcase)"})
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
    print(f"[{slug}] saved {size:,} bytes", flush=True)


TASKS = [
    ("sticker-pack",
     "Six colorful die-cut chat stickers arranged on a cork bulletin board — cute cartoon animals, food items, and expressions with thick white borders, Telegram and iMessage sticker aesthetic, vibrant and cheerful"),
    ("recipe-card",
     "Pinterest-style recipe card on wooden kitchen counter: hero food photograph of freshly baked banana bread at top, handwritten title 'Brown Butter Banana Bread', ingredients list and step numbers, rustic food blog aesthetic"),
    ("invitation",
     "Elegant wedding invitation card on marble table with greenery: floral watercolor borders, calligraphy title, delicate typography, cream cardstock, wedding stationery photography"),
    ("business-card",
     "Stack of premium business cards fanned out on dark wooden desk with fountain pen: modern minimalist design, foil gold accents, high-end stationery photography, professional brand identity"),
    ("pet-portrait",
     "Royal Renaissance oil painting portrait of a golden retriever wearing ermine robes and a jeweled crown, sitting on an ornate throne, dramatic chiaroscuro lighting, museum-quality brushwork, noble pet"),
    ("tarot-card",
     "Mystical tarot card on velvet cloth: The Moon card, Rider-Waite inspired style with ornate gold border, crescent moon, wolf and dog howling, crayfish in water, decorative numeral XVIII, arcane symbolism"),
    ("movie-poster",
     "Theatrical movie poster mockup: bold sci-fi film one-sheet with lone astronaut silhouetted against twin moons on neon-lit alien planet, huge title typography, cinematic composition, 24x36 theatrical print"),
    ("trading-card",
     "Premium trading card game card floating in dark space with holographic foil effect: fantasy dragon creature with glowing embers, ornate legendary-rarity gold border, stats block, Magic the Gathering / Pokemon card quality"),
    ("menu-design",
     "Elegant restaurant menu laid on bistro table with wine glass: modern minimalist design with italicized restaurant name, sections for starters mains desserts with prices, fine dining aesthetic, print-ready typography"),
    ("greeting-card",
     "Stack of greeting cards on marble surface: birthday card open showing illustrated front with balloons and handwritten inside message, pastel watercolor florals, premium stationery photography"),
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
