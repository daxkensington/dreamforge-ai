// Lazy env access via getters — values are read at runtime, not at import/build time.
// This prevents Next.js build from crashing when env vars aren't set during static analysis.

export const ENV = {
  get appId() { return process.env.NEXT_PUBLIC_APP_ID ?? process.env.VITE_APP_ID ?? ""; },
  get cookieSecret() { return process.env.JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.OAUTH_SERVER_URL ?? ""; },
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.BUILT_IN_FORGE_API_URL ?? ""; },
  get forgeApiKey() { return process.env.BUILT_IN_FORGE_API_KEY ?? ""; },
  get openaiApiKey() { return process.env.OPENAI_API_KEY ?? ""; },
  get stripeSecretKey() { return process.env.STRIPE_SECRET_KEY ?? ""; },
  get stabilityApiKey() { return process.env.STABILITY_API_KEY ?? ""; },
  get replicateApiToken() { return process.env.REPLICATE_API_TOKEN ?? ""; },
};
