"""Generate long-form SEO copy for each tool page via Grok JSON mode.

Produces a single TypeScript data file at shared/toolSeoCopy.ts that the
ToolSEOBlock component reads. Batches 5 tools per Grok call for efficiency.
"""
import json
import pathlib
import ssl
import sys
import urllib.error
import urllib.request

HOME = pathlib.Path.home()
ROOT = HOME / "genesis-synth-lab"
ENV_FILE = HOME / ".claude" / ".env"
OUT_FILE = ROOT / "shared" / "toolSeoCopy.ts"
TOOLS_DIR = ROOT / "app" / "tools"
ENDPOINT = "https://api.x.ai/v1/chat/completions"
MODEL = "grok-4-fast-reasoning"


def load_key() -> str:
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith("GROK_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("GROK_API_KEY not found")


def enumerate_slugs() -> list[str]:
    return sorted(p.name for p in TOOLS_DIR.iterdir() if p.is_dir())


def slug_to_title(slug: str) -> str:
    return " ".join(w.capitalize() for w in slug.replace("-", " ").split())


SYSTEM_PROMPT = """You write concise, high-quality SEO copy for AI tool pages on DreamForgeX (dreamforgex.ai), an AI creative studio with 100+ tools.

For each tool slug, produce JSON with this EXACT shape:
{
  "title": "display name of the tool, Title Case",
  "intro": "60-100 word paragraph explaining what the tool does, who it's for, and why it matters. Natural prose, not listicle.",
  "howItWorks": ["3 to 5 short step sentences", "...", "..."],
  "useCases": ["5 to 7 concrete use-case bullets", "...", "..."],
  "faq": [{"q":"question","a":"2-3 sentence answer"}, ...3 FAQ items]
}

Rules:
- Write for creators, freelancers, small-business owners.
- Mention realistic outcomes (download size, format, speed).
- NO superlatives like "revolutionary" or "game-changing".
- NO made-up technical specs (don't cite exact model names unless generic).
- Use cases should be specific: "Etsy product listings" not "e-commerce".
- FAQ should answer the actual first-time-user questions: quality, cost, usage rights, limits.
- Keep tone practical and direct.

Output a single JSON object keyed by slug: {"slug1": {...}, "slug2": {...}, ...}"""


def generate_batch(key: str, slugs: list[str]) -> dict:
    user_msg = "Generate SEO copy for these tool slugs:\n" + "\n".join(
        f"- {s} ({slug_to_title(s)})" for s in slugs
    )
    body = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.6,
    }).encode()

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(
        ENDPOINT, data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180, context=ctx) as resp:
        payload = json.loads(resp.read())

    content = payload["choices"][0]["message"]["content"]
    return json.loads(content)


def escape_ts(s: str) -> str:
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def render_ts(copy: dict) -> str:
    lines = [
        "/**",
        " * Long-form SEO copy for each tool page — rendered below the fold by",
        " * ToolSEOBlock. Generated via scripts/gen-tool-seo-copy.py (Grok JSON mode).",
        " */",
        "",
        "export type ToolSeo = {",
        "  title: string;",
        "  intro: string;",
        "  howItWorks: string[];",
        "  useCases: string[];",
        "  faq: Array<{ q: string; a: string }>;",
        "};",
        "",
        "export const TOOL_SEO_COPY: Record<string, ToolSeo> = {",
    ]
    for slug in sorted(copy.keys()):
        entry = copy[slug]
        lines.append(f"  {json.dumps(slug)}: {{")
        lines.append(f"    title: `{escape_ts(entry['title'])}`,")
        lines.append(f"    intro: `{escape_ts(entry['intro'])}`,")
        lines.append("    howItWorks: [")
        for step in entry.get("howItWorks", []):
            lines.append(f"      `{escape_ts(step)}`,")
        lines.append("    ],")
        lines.append("    useCases: [")
        for uc in entry.get("useCases", []):
            lines.append(f"      `{escape_ts(uc)}`,")
        lines.append("    ],")
        lines.append("    faq: [")
        for f in entry.get("faq", []):
            lines.append(f"      {{ q: `{escape_ts(f['q'])}`, a: `{escape_ts(f['a'])}` }},")
        lines.append("    ],")
        lines.append("  },")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    key = load_key()
    slugs = enumerate_slugs()
    print(f"{len(slugs)} slugs to generate SEO copy for", flush=True)

    all_copy: dict = {}
    batch_size = 5
    for i in range(0, len(slugs), batch_size):
        batch = slugs[i : i + batch_size]
        print(f"  [{i//batch_size + 1}/{(len(slugs)+batch_size-1)//batch_size}] {', '.join(batch)}", flush=True)
        try:
            result = generate_batch(key, batch)
            for slug in batch:
                if slug in result:
                    all_copy[slug] = result[slug]
                else:
                    print(f"    WARN: {slug} missing from response", file=sys.stderr)
        except Exception as e:
            print(f"    ERROR on batch: {e}", file=sys.stderr)

        # Save progress after each batch so a crash doesn't lose work
        OUT_FILE.write_text(render_ts(all_copy), encoding="utf-8")

    print(f"Done. Wrote {len(all_copy)} entries to {OUT_FILE}", flush=True)


if __name__ == "__main__":
    main()
