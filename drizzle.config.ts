import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn(
    "[drizzle.config] DATABASE_URL is not set — falling back to a placeholder URL. " +
      "This is fine for `drizzle-kit generate`/`check`, but push/migrate need a real database.",
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString ?? "postgresql://user:pass@localhost:5432/db",
  },
});
