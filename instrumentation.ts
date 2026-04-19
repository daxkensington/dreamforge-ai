import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    // Validate critical env vars at boot — prod throws if any are missing,
    // dev warns. Catches "deploy went out missing STRIPE_SECRET_KEY" before
    // a real user hits a checkout flow.
    const { runEnvValidation } = await import("./server/_core/envValidation");
    runEnvValidation();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};

