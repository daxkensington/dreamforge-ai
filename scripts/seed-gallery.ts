/**
 * Seed the public gallery with curated SFW showcase creations so /explore + the
 * sitemap have real, indexable content on day one (the growth loop can't
 * compound from an empty gallery). Runs the exact prod pipeline: generateImage
 * → generation record → auto-published gallery item.
 *
 *   npx tsx scripts/seed-gallery.ts
 *
 * Requires prod env (DATABASE_URL, RUNPOD_*, FAL_API_KEY, R2_*). Idempotent per
 * prompt via a stable title (skips if that title already exists in the gallery).
 */
import { generateImage } from "../server/_core/imageGeneration";
import { createGeneration, publishGalleryItem, getDb } from "../server/db";
import { users, galleryItems } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const SEEDS: { title: string; prompt: string }[] = [
  { title: "Neon Rain Cyberpunk Alley", prompt: "a lone figure with a glowing umbrella in a neon-soaked cyberpunk alley at night, rain, reflections, cinematic, ultra detailed, 8k" },
  { title: "Bioluminescent Forest", prompt: "a magical bioluminescent forest at night, glowing mushrooms and fireflies, misty, ethereal fantasy landscape, highly detailed digital painting" },
  { title: "Snow Leopard Portrait", prompt: "a majestic snow leopard portrait, piercing eyes, falling snow, dramatic natural light, wildlife photography, razor sharp detail" },
  { title: "Floating Sky Islands", prompt: "floating islands with waterfalls in a golden sunset sky, airships in the distance, epic fantasy concept art, volumetric light" },
  { title: "Retro Sci-Fi Diner", prompt: "a 1950s retro-futuristic diner on an alien planet, chrome and neon, two moons in the sky, warm cinematic lighting, detailed" },
  { title: "Kyoto Autumn Street", prompt: "a quiet Kyoto street in autumn, red maple leaves, traditional wooden houses, soft morning light, photorealistic, serene" },
  { title: "Cosmic Whale", prompt: "a giant translucent cosmic whale swimming through a nebula of stars and galaxies, surreal, dreamlike, vibrant colors, digital art" },
  { title: "Steampunk Airship City", prompt: "a sprawling steampunk city of brass gears and airships above the clouds, intricate detail, warm golden hour light, concept art" },
  { title: "Underwater Coral Palace", prompt: "an ornate coral palace deep underwater, rays of sunlight, schools of colorful fish, fantasy, luminous, highly detailed" },
  { title: "Desert Nomad at Dusk", prompt: "a cloaked desert nomad leading a caravan across golden dunes at dusk, long shadows, cinematic wide shot, epic scale" },
  { title: "Crystal Cave Explorer", prompt: "an explorer with a lantern inside a vast glowing crystal cave, blue and purple gemstones, awe, atmospheric, detailed" },
  { title: "Cherry Blossom Samurai", prompt: "a samurai standing beneath falling cherry blossoms at dawn, mist, painterly, dramatic composition, fine art" },
  { title: "Northern Lights Cabin", prompt: "a cozy log cabin under vivid green and purple northern lights, snowy pines, warm window glow, ultra realistic landscape photo" },
  { title: "Mechanical Hummingbird", prompt: "an intricate clockwork mechanical hummingbird made of gold and gears, macro detail, studio lighting, hyperrealistic" },
  { title: "Lighthouse Storm", prompt: "a lighthouse braving a dramatic ocean storm, huge crashing waves, moody sky, cinematic, powerful, detailed digital painting" },
  { title: "Vaporwave Mountain Sunrise", prompt: "a synthwave vaporwave mountain landscape at sunrise, gradient pink and teal sky, retro grid, sun, clean vector aesthetic" },
];

async function ensureStudioUser(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const email = "studio@dreamforgex.ai";
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db.insert(users).values({ email, name: "DreamForgeX Studio", openId: "dreamforge-studio-seed", loginMethod: "system" } as any).returning({ id: users.id });
  return inserted[0].id;
}

async function titleExists(title: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db.select({ id: galleryItems.id }).from(galleryItems).where(eq(galleryItems.title, title)).limit(1);
  return !!rows[0];
}

async function main() {
  const userId = await ensureStudioUser();
  console.log(`[seed] studio userId=${userId}, ${SEEDS.length} prompts`);
  const publishedIds: number[] = [];

  for (const seed of SEEDS) {
    if (await titleExists(seed.title)) {
      console.log(`[seed] skip (exists): ${seed.title}`);
      continue;
    }
    try {
      const { url } = await generateImage({ prompt: seed.prompt, model: "auto", size: "1024x1024", userTier: "pro" });
      if (!url) throw new Error("no url");
      const genId = await createGeneration({
        userId,
        prompt: seed.prompt,
        negativePrompt: null,
        mediaType: "image",
        width: 1024,
        height: 1024,
        status: "completed",
        modelVersion: "dreamforge-showcase",
        imageUrl: url,
        thumbnailUrl: url,
        metadata: { showcase: true },
      });
      await publishGalleryItem({ generationId: genId, userId, title: seed.title, description: seed.prompt });
      publishedIds.push(genId);
      console.log(`[seed] ✓ ${seed.title} → /g/${genId}`);
    } catch (e: any) {
      console.warn(`[seed] ✗ ${seed.title}: ${e?.message}`);
    }
  }

  console.log(`[seed] done. published ${publishedIds.length} → share URLs:`);
  publishedIds.forEach((id) => console.log(`  https://dreamforgex.ai/g/${id}`));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
