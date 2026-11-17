import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BLOG_POSTS } from "./blogPosts";
import { UNCENSORED_LANDINGS, UNCENSORED_LANDING_SLUGS } from "./uncensoredLanding";
import {
  formatSeoDescription,
  formatSeoTitle,
  MAX_SEO_DESCRIPTION_CHARS,
  MAX_SEO_TITLE_CHARS,
} from "./seoMeta";

const ROOT = path.resolve(__dirname, "..");

function extractStaticMeta(filePath: string): {
  dynamic?: boolean;
  title?: string;
  description?: string;
} {
  if (!fs.existsSync(filePath)) return {};
  const src = fs.readFileSync(filePath, "utf8");
  if (src.includes("generateMetadata")) return { dynamic: true };
  const metaIdx = src.indexOf("export const metadata");
  if (metaIdx === -1) return {};
  const chunk = src.slice(metaIdx);
  const ogIdx = chunk.search(/\b(openGraph|twitter|appleWebApp)\s*:/);
  const top = ogIdx !== -1 ? chunk.slice(0, ogIdx) : chunk;
  const tm = top.match(/\btitle\s*:\s*([\s\S]*?),\r?\n/);
  const dm = top.match(/\bdescription\s*:\s*([\s\S]*?),\r?\n/);
  return {
    title: tm ? Function(`return (${tm[1]})`)() : undefined,
    description: dm ? Function(`return (${dm[1]})`)() : undefined,
  };
}

function findPages(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "api" || e.name === "img") continue;
      out.push(...findPages(p));
    } else if (e.name === "page.tsx") {
      out.push(p);
    }
  }
  return out;
}

describe("SERP title & meta-description length budgets + IndexNow key", () => {
  it("ships the exact 32-char lowercase hex IndexNow verification key in public/", () => {
    const expectedKey = "d4f8e2a19b3c47e0856a12d9f3c4e5b6";
    expect(expectedKey).toMatch(/^[0-9a-f]{32}$/);
    const content = fs.readFileSync(path.join(ROOT, "public", `${expectedKey}.txt`), "utf8").trim();
    expect(content).toBe(expectedKey);
  });

  it("truncates dynamic titles and descriptions cleanly within SERP budgets", () => {
    const shortTitle = "AI Prompts, LoRAs & Workflows Marketplace | DreamForgeX";
    expect(formatSeoTitle(shortTitle)).toBe(shortTitle);
    expect(formatSeoTitle(shortTitle).length).toBeLessThanOrEqual(MAX_SEO_TITLE_CHARS);

    const longListing =
      "Cinematic 85mm Cyberpunk Portrait LoRA Pack with 40 Studio Lighting Presets and Workflow | DreamForgeX";
    const formattedTitle = formatSeoTitle(longListing);
    expect(formattedTitle.length).toBeLessThanOrEqual(MAX_SEO_TITLE_CHARS);
    expect(formattedTitle.endsWith(" | DreamForgeX")).toBe(true);

    const longDesc =
      "lora by StudioCreator — $9.99. Includes 40 hand-tuned cinematic cyberpunk portrait presets, high-frequency skin detail weights, neon rim-light LUTs, and one-click ComfyUI workflow templates for instant commercial production.";
    const formattedDesc = formatSeoDescription(longDesc);
    expect(formattedDesc.length).toBeLessThanOrEqual(MAX_SEO_DESCRIPTION_CHARS);
  });

  it("keeps every blog post metaTitle <= 60c and description <= 158c", () => {
    for (const post of BLOG_POSTS) {
      expect(
        post.metaTitle.length,
        `/blog/${post.slug} metaTitle (${post.metaTitle.length}c): ${post.metaTitle}`,
      ).toBeLessThanOrEqual(MAX_SEO_TITLE_CHARS);
      expect(
        post.description.length,
        `/blog/${post.slug} description (${post.description.length}c): ${post.description}`,
      ).toBeLessThanOrEqual(MAX_SEO_DESCRIPTION_CHARS);
    }
  });

  it("keeps every /uncensored/[slug] title <= 60c and metaDescription <= 158c", () => {
    for (const slug of UNCENSORED_LANDING_SLUGS) {
      const page = UNCENSORED_LANDINGS[slug];
      expect(
        page.title.length,
        `/uncensored/${slug} title (${page.title.length}c): ${page.title}`,
      ).toBeLessThanOrEqual(MAX_SEO_TITLE_CHARS);
      expect(
        page.metaDescription.length,
        `/uncensored/${slug} metaDescription (${page.metaDescription.length}c): ${page.metaDescription}`,
      ).toBeLessThanOrEqual(MAX_SEO_DESCRIPTION_CHARS);
    }
  });

  it("keeps every static Next.js route (/tools/*, /marketplace, /uncensored, /for/*, /vs/*, /video-studio/*) within <= 60c title & <= 158c description", () => {
    const appDir = path.join(ROOT, "app");
    const pages = findPages(appDir);
    expect(pages.length).toBeGreaterThan(150);

    for (const pagePath of pages) {
      const relDir = path.relative(appDir, path.dirname(pagePath)).replace(/\\/g, "/");
      const route = relDir ? `/${relDir}` : "/";
      const parts = relDir ? relDir.split("/") : [];
      const chain = [path.join(appDir, "layout.tsx")];
      let cur = appDir;
      for (const part of parts) {
        cur = path.join(cur, part);
        const lay = path.join(cur, "layout.tsx");
        if (fs.existsSync(lay)) chain.push(lay);
      }
      chain.push(pagePath);

      let effTitle: string | undefined;
      let effDesc: string | undefined;
      let isDynamic = false;

      for (const f of chain) {
        const m = extractStaticMeta(f);
        if (m.dynamic) isDynamic = true;
        if (m.title !== undefined) effTitle = m.title;
        if (m.description !== undefined) effDesc = m.description;
      }

      if (isDynamic) continue;

      expect(effTitle, `${route} missing title`).toBeTruthy();
      expect(
        effTitle!.length,
        `${route} title (${effTitle!.length}c > ${MAX_SEO_TITLE_CHARS}c): ${effTitle}`,
      ).toBeLessThanOrEqual(MAX_SEO_TITLE_CHARS);

      expect(effDesc, `${route} missing description`).toBeTruthy();
      expect(
        effDesc!.length,
        `${route} description (${effDesc!.length}c > ${MAX_SEO_DESCRIPTION_CHARS}c): ${effDesc}`,
      ).toBeLessThanOrEqual(MAX_SEO_DESCRIPTION_CHARS);
    }
  });
});
