"""Generate showcase images for wave 3 — 10 new tools."""
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
    ("emoji-creator",
     "Nine custom Discord/Slack-style emojis arranged in a 3x3 grid on deep purple gradient background: excited cat, partying dog, celebrating face, fire flame, sparkle heart, rainbow, thinking face, 100 points, shushing. Rich colors, chat app sticker aesthetic, rounded forms"),
    ("brand-style-guide",
     "Designer's brand style guide reference sheet pinned to wall: logo mark prominently centered, five color palette swatches with hex codes, typography pairing samples (serif headline and sans body), pattern texture element, minimalist Swiss design system aesthetic"),
    ("event-flyer",
     "Stack of colorful event promotional flyers on coffee shop bulletin board: rock concert flyer on top with bold graphic typography, underneath visible edges of club night and art show flyers, modern grunge poster aesthetic, event promotion vibe"),
    ("certificate",
     "Elegant certificate of achievement laid on dark wood desk with fountain pen and gold seal: classical formal design with ornate border, calligraphy title, ribbon banner, award ceremony aesthetic, diploma quality"),
    ("bookmark",
     "Three beautiful book bookmarks fanned out on open classic novel with decorative tassels: literary classic floral design one, fantasy dark academia one, watercolor nature one, readable quote text, Etsy seller aesthetic"),
    ("zine-spread",
     "Open indie zine lying on cluttered desk with scissors glue tape: collage cut-paste aesthetic, handwritten headlines, photocopied feel, two-page spread visible, DIY punk zine culture, editorial layout"),
    ("concert-poster",
     "Stack of silkscreen concert posters on merch table: psychedelic rock gig poster on top with bold typography and illustrated figure, visible edges of other indie and metal show posters underneath, poster art collection merch vibe"),
    ("architecture-concept",
     "Photorealistic architectural concept rendering: modern minimalist single-family home on hillside overlooking pine forest at golden hour, large glass walls, warm interior lights, landscape design, Archdaily magazine quality"),
    ("cosplay-reference",
     "Cosplay costume reference sheet pinned to corkboard: three-view character turnaround of cyberpunk street samurai character showing front side and back views with visible seams, fabric details, weapon accessories, costumer's reference"),
    ("travel-postcard",
     "Stack of vintage travel postcards laid on old map: illustrated 1950s-style postcards of Mount Fuji, Paris, New York, and tropical beach, with Greetings From headlines, vintage color palettes, collectible travel memorabilia aesthetic"),
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
