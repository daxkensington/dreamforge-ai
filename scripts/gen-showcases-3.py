"""Generate showcase images for the 29 tools missing public/showcase/tool-<slug>.jpg.
Same pattern as gen-showcases.py (Grok Imagine API). Run: python scripts/gen-showcases-3.py
Idempotent: skips slugs whose file already exists.
"""
import json
import pathlib
import ssl
import sys
import urllib.error
import urllib.request

HOME = pathlib.Path.home()
OUT_DIR = HOME / "genesis-synth-lab" / "public" / "showcase"
ENDPOINT = "https://api.x.ai/v1/images/generations"
MODEL = "grok-imagine-image"

PROMPTS = {
    "3d-generator": "A photorealistic product render of a cute low-poly 3D printed dragon figurine on a studio pedestal, soft studio lighting, 3D asset preview aesthetic, turntable presentation",
    "ad-copy": "Elegant magazine advertisement layout for a luxury watch on dark marble, bold serif headline, premium branding mockup, professional advertising design, dramatic lighting",
    "batch-prompts": "A neat grid collage of nine diverse AI-generated images (landscape, portrait, robot, food, space, city, animal, abstract, product) arranged 3x3 on a dark UI background, creative studio workflow aesthetic",
    "blog-writer": "Cozy modern desk with laptop showing a beautifully formatted blog article, coffee cup, notebook with pen, warm ambient light, content creation lifestyle photography",
    "caption-writer": "Smartphone mockup displaying an Instagram post of a golden retriever puppy with a witty caption and heart icons, social media marketing aesthetic, bright cheerful colors",
    "character-sheet": "Professional anime character design reference sheet showing front, side and back views of a young heroine with blue hair and a red scarf, turnaround layout on white background, animation production art",
    "color-palette": "Elegant color palette presentation card with five harmonious paint swatches in teal, coral, cream, navy and gold, color theory mood board with hex codes, graphic design branding aesthetic",
    "comic-strip": "A colorful 4-panel comic strip page featuring a superhero cat saving a city, dynamic action poses, speech bubbles, halftone shading, vibrant comic book art style",
    "depth-map": "The same street scene shown twice side by side: left in full color photography, right as a grayscale depth map where near objects are white and far objects fade to black, technical visualization aesthetic",
    "design-canvas": "Overhead view of a digital design workspace with a graphics tablet showing an in-progress fantasy landscape painting, stylus, color picker UI visible, digital artist studio vibe",
    "film-grain": "Nostalgic 35mm film photograph of a roadside diner at dusk with visible film grain texture, warm halation around neon signs, analog photography aesthetic, Kodak Portra tones",
    "hdr-enhance": "Breathtaking HDR landscape photograph of a mountain valley at sunrise, rich detail in both shadowed foreground rocks and bright cloud highlights, vivid expanded tonal range, professional nature photography",
    "icon-gen": "A grid of nine modern app icons on rounded squares (rocket, camera, music note, chat bubble, heart, folder, star, globe, lightning), flat design style with gradient accents, iOS app icon aesthetic",
    "image-blender": "Surreal double-exposure artwork blending a wolf silhouette with a starry night forest inside it, dreamlike mashup composition, artistic blending, gallery-quality digital art",
    "image-caption": "A framed gallery photograph of a bustling farmers market with an elegant museum-style description plaque beneath it, curation and accessibility aesthetic, warm documentary photography",
    "image-to-prompt": "Creative concept visualization of imagination becoming reality: a pencil sketch of a castle on paper morphing into a fully rendered fantasy castle rising off the page, magical transformation art",
    "image-to-video": "Film still showing motion blur light trails of a dancer in a dark studio, cinematic 24fps motion feel, anamorphic lens flare, video production aesthetic, storyboard frame markers at edges",
    "logo-animator": "Modern minimalist logo of a phoenix with subtle motion trail frames suggesting animation frames around it, brand identity presentation on dark background, motion design studio aesthetic",
    "music-gen": "Abstract visualization of music: flowing neon sound waves and glowing equalizer bars over a cosmic purple background, album cover art style, synesthesia-inspired digital art",
    "photo-restore": "A split view of an old damaged sepia photograph from the 1950s family picnic: left half torn and faded with scratches, right half beautifully restored in full color, photo restoration comparison",
    "product-photo": "Professional e-commerce product photography of wireless earbuds on a white pedestal with soft shadow, studio lighting, clean minimal background, Amazon listing quality",
    "prompt-builder": "Futuristic AI control panel interface with glowing sliders, style chips, and mood dials being adjusted by a hand, creative prompt engineering dashboard aesthetic, sci-fi UI design",
    "social-resize": "The same vibrant travel photo of Santorini shown resized across phone, tablet, and desktop mockups, responsive social media design presentation, modern marketing layout",
    "templates": "A collection of professional design templates floating in 3D space: resume, flyer, business card, Instagram post, each with placeholder layouts, creative template marketplace aesthetic",
    "train-model": "Futuristic AI training visualization: a glowing neural network core learning a painterly portrait style with progress rings and style samples orbiting it, high-tech ML aesthetic",
    "transparent-png": "Product cutout collage on a transparent checkerboard background: a red sneaker, a succulent plant, a coffee mug, and headphones with crisp clean edges, e-commerce asset aesthetic",
    "tshirt-designer": "A black t-shirt mockup on a wooden hanger featuring a bold geometric mountain sunset graphic print in orange and teal, print-on-demand product photography, apparel branding",
    "vectorize": "Side-by-side comparison of a detailed photo of a hummingbird and its clean flat vector illustration counterpart with bold color regions and crisp paths, vectorization process visualization",
    "virtual-tryon": "Fashion e-commerce virtual try-on visualization: a woman viewing herself in an augmented reality mirror wearing a digital floral dress overlay, modern retail technology aesthetic",
}


def load_key() -> str:
    for candidate in (HOME / ".claude" / ".env", HOME / "genesis-synth-lab" / ".env.local"):
        if candidate.exists():
            for line in candidate.read_text().splitlines():
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
    with urllib.request.urlopen(req, timeout=180, context=ctx) as resp:
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
    with urllib.request.urlopen(req, timeout=180, context=ctx) as resp:
        data = resp.read()
    out_path.write_bytes(data)
    return len(data)


def main() -> None:
    key = load_key()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    done = skipped = failed = 0
    for slug, prompt in PROMPTS.items():
        out = OUT_DIR / f"tool-{slug}.jpg"
        if out.exists() and out.stat().st_size > 10_000:
            skipped += 1
            continue
        try:
            url = request_image(key, prompt)
            size = download(url, out)
            print(f"[OK] {slug} {size:,} bytes", flush=True)
            done += 1
        except (urllib.error.HTTPError, RuntimeError, OSError) as e:
            print(f"[FAIL] {slug}: {e}", flush=True)
            failed += 1
    print(f"done={done} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
