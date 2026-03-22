function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`Warning: environment variable ${name} is not set`);
  }
  return value ?? "";
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: requireEnv("JWT_SECRET"),
  databaseUrl: requireEnv("DATABASE_URL"),
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: optionalEnv("BUILT_IN_FORGE_API_URL"),
  forgeApiKey: optionalEnv("BUILT_IN_FORGE_API_KEY"),
  openaiApiKey: optionalEnv("OPENAI_API_KEY"),
  stripeSecretKey: optionalEnv("STRIPE_SECRET_KEY"),
  stabilityApiKey: optionalEnv("STABILITY_API_KEY"),
  replicateApiToken: optionalEnv("REPLICATE_API_TOKEN"),
};
