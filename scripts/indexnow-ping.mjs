// Ping IndexNow (Bing/Yandex/Naver/Seznam) with every sitemap URL.
// Uses headless Chromium for fetches — the Vercel bot wall 403s plain fetch.
import { chromium } from "@playwright/test";

const KEY = "23c418b9ade7560f";
const HOST = "dreamforgex.ai";

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
})).newPage();

// 1. Verify key file is live
const keyResp = await page.goto(`https://${HOST}/${KEY}.txt`, { waitUntil: "domcontentloaded" });
const keyBody = (await page.evaluate(() => document.body.innerText)).trim();
console.log(`key file: HTTP ${keyResp.status()}, content="${keyBody}" (${keyBody === KEY ? "MATCH" : "MISMATCH"})`);
if (keyResp.status() !== 200 || keyBody !== KEY) { await browser.close(); process.exit(1); }

// 2. Fetch sitemap
await page.goto(`https://${HOST}/sitemap.xml`, { waitUntil: "domcontentloaded" });
const xml = await page.content();
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith("http"));
console.log(`sitemap URLs: ${urls.length}`);
await browser.close();

// 3. Ping IndexNow (api.indexnow.org fans out to all participating engines)
const resp = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log(`IndexNow: HTTP ${resp.status} ${resp.statusText}`);
