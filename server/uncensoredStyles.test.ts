import { describe, it, expect, afterEach } from "vitest";
import { applyUncensoredStyle, getUncensoredStyle } from "../shared/uncensoredStyles";
import { resolveUncensoredLora } from "./_core/uncensoredStyleLora";

describe("uncensored image styles", () => {
  it("applies the requested style's suffix + keeps the fictional-content clause", () => {
    const out = applyUncensoredStyle("a woman on a beach", "anime");
    expect(out).toContain("a woman on a beach");
    expect(out).toContain("anime");
    expect(out).toContain("no real people depicted");
  });

  it("falls back to the default (realistic) style for unknown/empty ids", () => {
    expect(getUncensoredStyle("nope").id).toBe("realistic");
    expect(getUncensoredStyle(undefined).id).toBe("realistic");
    expect(applyUncensoredStyle("x", null)).toContain("photorealistic");
  });
});

describe("uncensored style LoRA resolution (env-driven)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("returns undefined when no LoRA env is set (prompt-engineering only)", () => {
    delete process.env.UNCENSORED_LORA_REALISTIC;
    delete process.env.UNCENSORED_LORA_DEFAULT;
    expect(resolveUncensoredLora("realistic")).toBeUndefined();
  });

  it("prefers a style-specific LoRA, then the default", () => {
    process.env.UNCENSORED_LORA_DEFAULT = "org/default-lora";
    process.env.UNCENSORED_LORA_ANIME = "org/anime-lora";
    expect(resolveUncensoredLora("anime")).toBe("org/anime-lora");
    expect(resolveUncensoredLora("realistic")).toBe("org/default-lora");
  });
});
