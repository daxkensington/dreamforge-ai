// Opens facebook.com/dreamforgex in the user's authenticated chrome-debug-profile.
// Usage: `node scripts/fb-open-composer.mjs 2` opens with Day 2 content copied to clipboard.
// Then you paste (Ctrl+V) into the composer, drag the attachment image, and post.
//
// Prerequisite: chrome-debug-profile must be running on port 9222.
// Launch first with:
//   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%USERPROFILE%\chrome-debug-profile

import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_FILE = resolve(__dirname, "..", "marketing", "fb-day2-5-drops.md");

const day = parseInt(process.argv[2] || "2", 10);
if (!Number.isFinite(day) || day < 2 || day > 6) {
  console.error("Usage: node scripts/fb-open-composer.mjs <day 2-6>");
  process.exit(1);
}

const markdown = readFileSync(POSTS_FILE, "utf8");
const dayPattern = new RegExp(`## Day ${day} —.*?\\n([\\s\\S]*?)(?=\\n---|$)`);
const match = markdown.match(dayPattern);
if (!match) {
  console.error(`Could not find Day ${day} in ${POSTS_FILE}`);
  process.exit(1);
}

const rawBody = match[1].trim();
const attachMatch = rawBody.match(/\*\*Attach:\*\*\s*(.+)/);
const postBody = rawBody.replace(/\n\*\*Attach:\*\*[\s\S]*$/, "").trim();

console.log(`\n=== FB Day ${day} Post ===\n`);
console.log(postBody);
if (attachMatch) console.log(`\nAttach: ${attachMatch[1]}`);
console.log(`\n=== Opening facebook.com/dreamforgex ===\n`);

let browser;
try {
  browser = await chromium.connectOverCDP("http://localhost:9222");
} catch (err) {
  console.error("Couldn't connect to chrome-debug-profile on port 9222.");
  console.error("Launch it first:");
  console.error(`  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%USERPROFILE%\\chrome-debug-profile`);
  console.error(`\nError: ${err.message}`);
  process.exit(2);
}

const context = browser.contexts()[0];
const page = await context.newPage();
await page.goto("https://www.facebook.com/dreamforgex", { waitUntil: "domcontentloaded" });

// Copy post body to clipboard via browser API
await page.evaluate((text) => navigator.clipboard.writeText(text), postBody);

console.log("✓ Post copied to clipboard");
console.log("→ Click the composer, paste (Ctrl+V), drag the attachment, click Publish");
console.log("→ Tab stays open for you");

// Don't close the browser — leave tab open for user
await browser.close(); // close CDP connection, tab stays in user's Chrome
