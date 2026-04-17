#!/usr/bin/env node
/**
 * Generate training images for DreamForge LoRA styles using Grok API.
 * Each style gets 50 images from varied prompts.
 *
 * Usage: node generate-training-data.mjs [style-id]
 *        node generate-training-data.mjs              # all styles
 *        node generate-training-data.mjs dreamforge-cinematic
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "../configs/styles.json"), "utf-8"));

const GROK_API_KEY = process.env.GROK_API_KEY;
if (!GROK_API_KEY) {
  console.error("Set GROK_API_KEY in environment");
  process.exit(1);
}

const IMAGES_PER_PROMPT = 5; // 10 prompts × 5 = 50 images per style

async function generateImage(prompt, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-2-image",
          prompt,
          n: 1,
          response_format: "b64_json",
        }),
      });

      if (res.status === 429) {
        console.log("  Rate limited, waiting 30s...");
        await new Promise((r) => setTimeout(r, 30000));
        continue;
      }

      if (!res.ok) {
        // Try alternate model name
        const res2 = await fetch("https://api.x.ai/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GROK_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "grok-imagine-image",
            prompt,
            n: 1,
            response_format: "b64_json",
          }),
        });
        if (!res2.ok) throw new Error(`Grok API error: ${res2.status}`);
        const data = await res2.json();
        return Buffer.from(data.data[0].b64_json, "base64");
      }

      const data = await res.json();
      return Buffer.from(data.data[0].b64_json, "base64");
    } catch (err) {
      if (attempt < retries - 1) {
        console.log(`  Retry ${attempt + 1}/${retries}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
}

async function generateStyle(style) {
  const outDir = path.join(__dirname, "../datasets", style.id);
  fs.mkdirSync(outDir, { recursive: true });

  // Create metadata file
  const metadata = [];
  let imageCount = 0;

  console.log(`\n=== ${style.name} ===`);
  console.log(`Output: ${outDir}`);

  for (let pi = 0; pi < style.prompts.length; pi++) {
    const basePrompt = style.prompts[pi];

    for (let vi = 0; vi < IMAGES_PER_PROMPT; vi++) {
      // Add variation to each prompt
      const variations = [
        "", ", highly detailed, 8K resolution",
        ", award-winning photography", ", masterpiece quality",
        ", ultra sharp, vivid colors",
      ];
      const prompt = `${style.trigger_word} style. ${basePrompt}${variations[vi]}`;
      const filename = `${style.id}_${String(imageCount).padStart(4, "0")}.jpg`;
      const filepath = path.join(outDir, filename);

      // Skip if already generated
      if (fs.existsSync(filepath)) {
        console.log(`  [${imageCount + 1}/50] ${filename} (cached)`);
        imageCount++;
        continue;
      }

      try {
        console.log(`  [${imageCount + 1}/50] Generating: ${prompt.substring(0, 80)}...`);
        const buffer = await generateImage(prompt);
        fs.writeFileSync(filepath, buffer);
        metadata.push({ file: filename, prompt, style: style.id });
        imageCount++;

        // Rate limit: ~2s between requests
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        imageCount++;
      }
    }
  }

  // Write metadata
  fs.writeFileSync(
    path.join(outDir, "metadata.jsonl"),
    metadata.map((m) => JSON.stringify(m)).join("\n") + "\n"
  );

  console.log(`  Done: ${metadata.length} images generated`);
}

async function main() {
  const targetStyle = process.argv[2];
  const styles = targetStyle
    ? CONFIG.styles.filter((s) => s.id === targetStyle)
    : CONFIG.styles;

  if (styles.length === 0) {
    console.error(`Style "${targetStyle}" not found. Available:`, CONFIG.styles.map((s) => s.id));
    process.exit(1);
  }

  for (const style of styles) {
    await generateStyle(style);
  }

  console.log("\nAll done!");
}

main().catch(console.error);
