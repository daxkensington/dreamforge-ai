// One-off: generate the 29 missing public/showcase/tool-<slug>.jpg through the
// platform's OWN provider chain (same createCaller path the eval harness uses)
// — the Grok key used by the older gen-showcases.py scripts is dead (403).
// Run: npx tsx scripts/gen-showcases-runpod.mjs
// Idempotent: skips slugs whose file already exists (>10KB).
import { config } from "dotenv";
import { writeFile } from "fs/promises";
import { existsSync, statSync } from "fs";
import postgres from "postgres";

config({ path: ".env.local" });

const PROMPTS = {
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
};

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
let [user] = await sql`select id from users where email = 'eval@dreamforgex.ai'`;
if (!user) [user] = await sql`insert into users ("openId", name, email, "loginMethod") values ('eval-internal', 'Eval Harness', 'eval@dreamforgex.ai', 'internal') returning id`;
await sql`insert into "creditBalances" ("userId", balance) values (${user.id}, 5000) on conflict ("userId") do update set balance = "creditBalances".balance + 5000`;
await sql`insert into "creditTransactions" ("userId", amount, "txType", description) values (${user.id}, 5000, 'bonus', 'showcase generation grant')`;

const { appRouter } = await import("../server/routers.ts");
const caller = appRouter.createCaller({ user: { id: user.id, role: "user", email: "eval@dreamforgex.ai" }, session: null, ip: "127.0.0.1" });

let done = 0, skipped = 0, failed = 0;
for (const [slug, prompt] of Object.entries(PROMPTS)) {
  const out = `public/showcase/tool-${slug}.jpg`;
  if (existsSync(out) && statSync(out).size > 10_000) { skipped++; continue; }
  try {
    const res = await caller.generation.create({ prompt, modelVersion: "auto", mediaType: "image", width: 1024, height: 1024 });
    const imageUrl = res.imageUrl;
    if (res.status !== "completed" || !imageUrl) throw new Error(res.error ?? "generation failed");
    const buf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
    await writeFile(out, buf);
    console.log(`[OK] ${slug} ${buf.length.toLocaleString()} bytes`);
    done++;
  } catch (e) {
    console.log(`[FAIL] ${slug}: ${String(e.message ?? e).slice(0, 140)}`);
    failed++;
  }
}
console.log(`done=${done} skipped=${skipped} failed=${failed}`);
await sql.end();
