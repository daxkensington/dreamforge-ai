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
  // AI Providers
  get groqApiKey() { return process.env.GROQ_API_KEY ?? ""; },
  get togetherApiKey() { return process.env.TOGETHER_API_KEY ?? ""; },
  get grokApiKey() { return process.env.GROK_API_KEY ?? ""; },
  get anthropicApiKey() { return process.env.ANTHROPIC_API_KEY ?? ""; },
  get geminiApiKey() { return process.env.GEMINI_API_KEY ?? ""; },
  get cfAccountId() { return process.env.CF_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID ?? ""; },
  get cfAiToken() { return process.env.CF_AI_TOKEN ?? ""; },
  get r2AccountId() { return process.env.R2_ACCOUNT_ID ?? ""; },
  get r2AccessKeyId() { return process.env.R2_ACCESS_KEY_ID ?? ""; },
  get r2SecretAccessKey() { return process.env.R2_SECRET_ACCESS_KEY ?? ""; },
  get r2BucketName() { return process.env.R2_BUCKET_NAME ?? "dreamforge-assets"; },
  get r2PublicUrl() { return process.env.R2_PUBLIC_URL ?? ""; },
  // RunPod Self-Hosted
  get runpodApiKey() { return process.env.RUNPOD_API_KEY ?? ""; },
  get runpodFluxEndpointId() { return process.env.RUNPOD_FLUX_ENDPOINT_ID ?? ""; },
  // Video Providers
  get runwayApiKey() { return process.env.RUNWAY_API_KEY ?? ""; },
  get klingAccessKey() { return process.env.KLING_ACCESS_KEY ?? ""; },
  get klingSecretKey() { return process.env.KLING_SECRET_KEY ?? ""; },
};
