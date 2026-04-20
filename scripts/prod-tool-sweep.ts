/**
 * End-to-end sweep of representative tools against prod DB + prod providers.
 * Runs via: dotenv -e .env.test npx tsx scripts/prod-tool-sweep.ts
 *
 * Uses appRouter.createCaller with a synthetic authed ctx so we bypass
 * NextAuth entirely but still exercise the real provider calls + R2 upload
 * + DB inserts.
 *
 * Each test is cheap enough to skip on failure without blocking others,
 * and the final report lists pass/fail/url for every representative so
 * we know which tool families actually work on prod.
 */

// Load env BEFORE any imports that read process.env at module-init time.
// @ts-ignore — tsx resolves TS extensions; tsc strict doesn't.
import { config } from "dotenv";
config({ path: ".env.test" });

// @ts-ignore — this is run via `npx tsx` which handles .ts extensions.
import { appRouter } from "../server/routers.ts";
import type { TrpcContext } from "../server/_core/context";
import { getDb } from "../server/db";

// Synthetic authed ctx — kaiah.dev is user id 1, the only real user.
async function makeCtx(): Promise<TrpcContext> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { users } = await import("../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  const [user] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
  if (!user) throw new Error("User 1 not found");
  return { user, session: null, ip: "127.0.0.1" };
}

interface TestResult {
  group: string;
  name: string;
  ok: boolean;
  outputUrl?: string | null;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(
  group: string,
  name: string,
  fn: () => Promise<any>,
  extractUrl: (r: any) => string | null = (r) => r?.url ?? r?.songUrl ?? r?.audioUrl ?? null,
): Promise<void> {
  const start = Date.now();
  process.stdout.write(`[${group}] ${name}... `);
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    const url = extractUrl(result);
    const status = result?.status;
    const ok = status === "completed" || (status === undefined && url) || status === "success";
    if (ok) {
      console.log(`✓ (${Math.round(durationMs / 100) / 10}s)${url ? ` → ${url.slice(0, 80)}...` : ""}`);
    } else {
      console.log(`✗ status=${status ?? "?"} error=${String(result?.error ?? "no url").slice(0, 100)}`);
    }
    results.push({ group, name, ok, outputUrl: url, error: ok ? undefined : String(result?.error ?? "no url"), durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.log(`✗ THROWN: ${err.message?.slice(0, 120) ?? String(err)}`);
    results.push({ group, name, ok: false, error: err.message ?? String(err), durationMs });
  }
}

async function main() {
  const ctx = await makeCtx();
  const caller = appRouter.createCaller(ctx);
  console.log(`Running as user id=${ctx.user!.id} (${ctx.user!.email})\n`);

  // ─── Image chain (the one we already fixed) ───────────────────────────
  await runTest("image-chain", "demo.generate (public)", async () => {
    const publicCaller = appRouter.createCaller({ user: null, session: null, ip: "127.0.0.1" });
    return publicCaller.demo.generate({ prompt: "a golden retriever in a garden, photorealistic" });
  });

  await runTest("image-chain", "generation.create (workspace)", () =>
    caller.generation.create({
      prompt: "a mountain lake at sunset, cinematic",
      modelVersion: "auto",
    } as any),
  );

  // ─── Image-to-image tools ─────────────────────────────────────────────
  const SEED_IMG = "https://dreamforge-assets.0924af90bc51d76932fb709c8536f1e6.r2.cloudflarestorage.com/generations/qwKxrYxrSHt_vfoJ.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=830584081ea5ceeeb3bc56f1cc4f01e6%2F20260419%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20260419T085658Z&X-Amz-Expires=604800&X-Amz-Signature=a613fe8c45ccab9db0f4cc450df3d71976d8fb6963d39ee3209a45c73ba77fac&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject";

  await runTest("img2img", "tools.upscale", () =>
    (caller as any).tools.upscale({
      imageUrl: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=512",
      scaleFactor: "2x",
      enhanceDetails: true,
    }),
  );

  await runTest("img2img", "tools.backgroundEdit (remove)", () =>
    (caller as any).tools.backgroundEdit({
      imageUrl: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=512",
      mode: "remove",
    }),
  );

  // ─── LLM path (extracts text output, not url) ────────────────────────
  await runTest(
    "llm",
    "generation.enhancePrompt",
    () => (caller as any).generation.enhancePrompt({ prompt: "cat" }),
    (r) => (r?.enhanced ? `text:${r.enhanced.slice(0, 60)}` : null),
  );

  // ─── Audio path (music gen uses MiniMax via Replicate) ────────────────
  await runTest(
    "audio",
    "audio.generate music (10s)",
    () => (caller as any).audio.generate({
      type: "music",
      prompt: "upbeat lofi hiphop beat with mellow piano",
      duration: 10,
    }),
    (r) => r?.id ? `queued audioGen id=${r.id}` : null,
  );

  // ─── Video path (text-to-video, expensive — 40+ credits) ──────────────
  await runTest(
    "video",
    "video.textToVideo (3s, auto model)",
    () => (caller as any).video.textToVideo({
      prompt: "a cat walking in a garden",
      duration: 3,
      aspectRatio: "16:9",
      style: "cinematic",
      model: "auto",
    }),
  );

  // ─── Viral preset (exercises viral.transform) ─────────────────────────
  await runTest("viral", "viral.transform action-figure", () =>
    caller.viral.transform({
      preset: "action-figure",
      imageUrl: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=512",
      note: "adventurer with flashlight",
    } as any),
  );

  // ─── Composite tool (storyboard runs LLM + per-scene img gen) ─────────
  await runTest("composite", "video.generateStoryboard (3 scenes)", () =>
    (caller as any).video.generateStoryboard({
      concept: "A cat explores a mysterious forest at dusk",
      sceneCount: 3,
      aspectRatio: "16:9",
      style: "cinematic",
      generateImages: true,
    }),
    // Returns scenes array; pass if first scene has imageUrl
    (r) => r?.scenes?.[0]?.imageUrl ?? null,
  );

  // ─── Summary ──────────────────────────────────────────────────────────
  console.log("\n═══ SUMMARY ═══");
  const byGroup = new Map<string, { pass: number; fail: number }>();
  for (const r of results) {
    const g = byGroup.get(r.group) ?? { pass: 0, fail: 0 };
    if (r.ok) g.pass++; else g.fail++;
    byGroup.set(r.group, g);
  }
  for (const [group, counts] of byGroup) {
    const total = counts.pass + counts.fail;
    console.log(`  ${group.padEnd(14)} ${counts.pass}/${total} passing`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\n❌ FAILURES (${failed.length}):`);
    for (const f of failed) {
      console.log(`  ${f.group}/${f.name}: ${f.error?.slice(0, 200)}`);
    }
    process.exit(1);
  } else {
    console.log(`\n✅ All ${results.length} tests passed.`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(2);
});
