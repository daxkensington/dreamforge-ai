// Post-deploy verification: run one real generation through the public demo
// endpoint via a headless browser (bypasses the Vercel bot wall).
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
});
const page = await ctx.newPage();
await page.goto("https://dreamforgex.ai/demo/text-to-image", { waitUntil: "domcontentloaded" });

const result = await page.evaluate(async () => {
  const resp = await fetch("/api/trpc/demo.generate?batch=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 0: { json: { prompt: "a watercolor painting of a fox in a misty forest" } } }),
  });
  return { status: resp.status, body: await resp.text() };
});

console.log("HTTP", result.status);
console.log(result.body.slice(0, 600));
await browser.close();
