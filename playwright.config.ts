import { defineConfig, devices } from "@playwright/test";
import { smokeTarget } from "./shared/smoke-target.mjs";

const target = smokeTarget(process.env.BASE_URL || "https://dreamforgex.ai");

/**
 * Smoke tests run against a deployed URL (prod by default, preview in CI).
 * No webServer config — we never run these against `next dev` because the
 * point is to catch problems that only manifest in the production build.
 */
export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  timeout: 120_000, // includes bounded auth-budget waits, without hiding failed assertions
  expect: { timeout: 10_000 },
  use: {
    baseURL: target.origin,
    // Protected-cookie material must not enter downloadable network traces.
    trace: target.protectedTarget ? "off" : "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 110_000, // includes real request pacing if a page bursts beyond reserved headroom
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
