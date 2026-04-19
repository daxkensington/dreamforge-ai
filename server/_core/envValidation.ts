/**
 * Startup-time environment validation. Called from instrumentation.ts so it
 * runs once per Node process, before any request hits us.
 *
 * Why this exists: server/_core/env.ts uses `?? ""` fallbacks everywhere to
 * keep Next.js build-time analysis happy. The downside is that missing vars
 * surface as cryptic "Database unavailable" or "STRIPE_SECRET_KEY is not
 * configured" errors at request time — long after the deploy has gone live.
 *
 * This validator runs at boot, lists ALL missing critical vars at once, and
 * either warns (dev) or hard-fails (prod) so the issue is caught at deploy.
 */
import { z } from "zod";

// ─── Required everywhere ──────────────────────────────────────────────────
const requiredSchema = z.object({
  DATABASE_URL: z.string().min(1, "Postgres connection string"),
  JWT_SECRET: z.string().min(16, "Auth/cookie signing secret (≥16 chars)"),
});

// ─── Required in production only ──────────────────────────────────────────
const productionRequiredSchema = z.object({
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "Stripe secret key"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "Stripe webhook signing secret"),
  AUTH_SECRET: z.string().min(16, "NextAuth session secret (≥16 chars)"),
});

// ─── Provider keys — at least ONE must be set ──────────────────────────────
const PROVIDER_KEYS = [
  "OPENAI_API_KEY",
  "GROK_API_KEY",
  "GEMINI_API_KEY",
  "REPLICATE_API_TOKEN",
  "RUNPOD_API_KEY",
  "TOGETHER_API_KEY",
  "CF_AI_TOKEN",
] as const;

export interface EnvValidationResult {
  ok: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Always-required vars.
  const reqResult = requiredSchema.safeParse(process.env);
  if (!reqResult.success) {
    for (const issue of reqResult.error.issues) {
      missing.push(`${issue.path.join(".")} — ${issue.message}`);
    }
  }

  // Production-only required vars.
  if (process.env.NODE_ENV === "production") {
    const prodResult = productionRequiredSchema.safeParse(process.env);
    if (!prodResult.success) {
      for (const issue of prodResult.error.issues) {
        missing.push(`${issue.path.join(".")} — ${issue.message}`);
      }
    }
  }

  // At least one image provider must be configured.
  const providersConfigured = PROVIDER_KEYS.filter((k) => !!process.env[k]);
  if (providersConfigured.length === 0) {
    missing.push(
      `No AI provider keys configured — set at least one of: ${PROVIDER_KEYS.join(", ")}`,
    );
  } else if (providersConfigured.length < 2) {
    // Single-provider deploys have no fallback — degrade gracefully if it fails.
    warnings.push(
      `Only one AI provider configured (${providersConfigured[0]}) — outages will block all image gen.`,
    );
  }

  return { ok: missing.length === 0, missing, warnings };
}

/**
 * Run validation, log results, and in production throw if anything's missing
 * so the deploy fails loudly instead of serving 500s for hours.
 */
export function runEnvValidation(): void {
  const result = validateEnv();

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`[env-validation] WARN: ${w}`);
    }
  }

  if (result.ok) {
    console.log("[env-validation] OK — all required env vars present.");
    return;
  }

  const message = [
    "[env-validation] Missing required environment variables:",
    ...result.missing.map((m) => `  - ${m}`),
  ].join("\n");

  if (process.env.NODE_ENV === "production") {
    // Hard-fail in prod. The deploy is broken and serving 500s would be worse.
    console.error(message);
    throw new Error(`Missing required env vars: ${result.missing.join(", ")}`);
  } else {
    // Warn but don't crash the dev server.
    console.warn(message);
    console.warn(
      "[env-validation] Continuing in dev mode — fix .env.local before pushing to prod.",
    );
  }
}
