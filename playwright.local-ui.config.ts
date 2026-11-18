import { defineConfig } from "@playwright/test";

// Deliberately restricted to a local server: these tests intercept uploads and
// must never simulate generation or uploads against a deployed environment.
const baseURL = process.env.LOCAL_UI_BASE_URL || "http://127.0.0.1:3018";
const target = new URL(baseURL);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname)) {
  throw new Error("Local UI tests require an HTTP localhost URL");
}

export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  use: { baseURL, browserName: "chromium", channel: "chrome", headless: false },
});
