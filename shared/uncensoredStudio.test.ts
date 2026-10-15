import { describe, it, expect } from "vitest";
import {
  applyUncensoredPose,
  applyUncensoredCamera,
  applyUncensoredLighting,
  applyUncensoredWardrobe,
  applyUncensoredSetting,
  applyUncensoredVideoMotion,
  applyUncensoredI2vIdentity,
  applyUncensoredVideoIntensity,
  getUncensoredVideoSize,
  getUncensoredVideoAspectFromSize,
  formatUncensoredRecipe,
  getUncensoredPose,
  getUncensoredVideoDuration,
  getUncensoredAspectFromSize,
  uncensoredVideoCredits,
  uncensoredCharacterRef,
  isUncensoredCharacter,
  parseUncensoredCharacterRef,
  clampCharacterStrength,
  DEFAULT_CHARACTER_STRENGTH,
  UNCENSORED_POSES,
  UNCENSORED_CAMERAS,
  UNCENSORED_LIGHTING,
  UNCENSORED_VIDEO_MOTIONS,
  UNCENSORED_SHEET_VIEWS,
  UNCENSORED_IMAGE_COST,
  UNCENSORED_VIDEO_DURATIONS,
  DEFAULT_UNCENSORED_VIDEO_DURATION,
} from "./uncensoredStudio";

describe("uncensored poses", () => {
  it("looks up a known pose and leaves unknown ones alone", () => {
    expect(getUncensoredPose("reclining")?.label).toBe("Reclining");
    expect(getUncensoredPose("not-a-pose")).toBeNull();
    expect(UNCENSORED_POSES.length).toBeGreaterThanOrEqual(5);
  });

  it("appends pose language without replacing the user's scene", () => {
    const out = applyUncensoredPose("red silk dress, balcony at night", "frombehind");
    expect(out.startsWith("red silk dress, balcony at night")).toBe(true);
    expect(out).toMatch(/over the shoulder/i);
  });
});

describe("uncensored named-character marker", () => {
  it("round-trips a generation id and rejects SFW notes", () => {
    const notes = uncensoredCharacterRef(42);
    expect(isUncensoredCharacter(notes)).toBe(true);
    expect(parseUncensoredCharacterRef(notes)).toBe(42);
    expect(isUncensoredCharacter("anime style")).toBe(false);
    expect(parseUncensoredCharacterRef("anime style")).toBeNull();
    expect(parseUncensoredCharacterRef("uncensored:nope")).toBeNull();
  });
});

describe("uncensored camera and lighting", () => {
  it("appends camera and lighting without replacing the scene", () => {
    expect(UNCENSORED_CAMERAS.length).toBeGreaterThanOrEqual(4);
    expect(UNCENSORED_LIGHTING.length).toBeGreaterThanOrEqual(5);
    const withCam = applyUncensoredCamera("red silk dress", "low");
    expect(withCam.startsWith("red silk dress")).toBe(true);
    expect(withCam).toMatch(/low-angle/i);
    const withLight = applyUncensoredLighting("red silk dress", "neon");
    expect(withLight).toMatch(/neon-lit/i);
    expect(applyUncensoredCamera("red silk dress", "nope")).toBe("red silk dress");
  });
});

describe("uncensored character strength", () => {
  it("clamps to the identity-vs-scene window", () => {
    expect(clampCharacterStrength(undefined)).toBe(DEFAULT_CHARACTER_STRENGTH);
    expect(clampCharacterStrength(0.1)).toBe(0.25);
    expect(clampCharacterStrength(0.9)).toBe(0.7);
    expect(clampCharacterStrength(0.5)).toBe(0.5);
  });
});

describe("uncensored aspect from size", () => {
  it("round-trips studio sizes and falls back to portrait", () => {
    expect(getUncensoredAspectFromSize(832, 1216)).toBe("portrait");
    expect(getUncensoredAspectFromSize(1024, 1024)).toBe("square");
    expect(getUncensoredAspectFromSize(1, 1)).toBe("portrait");
  });
});

describe("uncensored wardrobe and setting", () => {
  it("appends clothing and location without replacing the scene", () => {
    const dressed = applyUncensoredWardrobe("same woman looking at camera", "silk");
    expect(dressed.startsWith("same woman looking at camera")).toBe(true);
    expect(dressed).toMatch(/silk/i);
    const placed = applyUncensoredSetting("same woman looking at camera", "balcony");
    expect(placed).toMatch(/balcony/i);
    expect(applyUncensoredWardrobe("same woman", "spacesuit")).toBe("same woman");
  });
});

describe("uncensored character sheet views", () => {
  it("is a four-view turnaround priced cheaper than four locks", () => {
    expect(UNCENSORED_SHEET_VIEWS).toHaveLength(4);
    expect(UNCENSORED_IMAGE_COST.sheet).toBeLessThan(UNCENSORED_IMAGE_COST.character * 4);
    expect(UNCENSORED_SHEET_VIEWS.map((v) => v.id).sort()).toEqual(["front", "full", "profile", "threequarter"].sort());
  });
});

describe("uncensored recipe copy", () => {
  it("includes prompt, controls, and seed", () => {
    const recipe = formatUncensoredRecipe({
      prompt: "red silk dress, balcony at night",
      style: "realistic",
      pose: "reclining",
      wardrobe: "silk",
      setting: "balcony",
      seed: 42,
    });
    expect(recipe).toContain("red silk dress, balcony at night");
    expect(recipe).toContain("seed 42");
    expect(recipe).toContain("silk");
    expect(recipe).toContain("realistic");
  });
});

describe("uncensored video motion", () => {
  it("appends a known motion and ignores unknown ids", () => {
    expect(UNCENSORED_VIDEO_MOTIONS.length).toBeGreaterThanOrEqual(6);
    const out = applyUncensoredVideoMotion("natural motion", "hair");
    expect(out).toMatch(/hair blowing/i);
    expect(applyUncensoredVideoMotion("natural motion", "teleport")).toBe("natural motion");
  });
});

describe("uncensored video duration", () => {
  it("defaults to ~5s and prices 8s at 1.5×", () => {
    expect(getUncensoredVideoDuration(undefined).id).toBe(DEFAULT_UNCENSORED_VIDEO_DURATION);
    expect(getUncensoredVideoDuration("8s").numFrames).toBe(121);
    expect(uncensoredVideoCredits(50, "5s")).toBe(50);
    expect(uncensoredVideoCredits(50, "8s")).toBe(75);
    expect(UNCENSORED_VIDEO_DURATIONS.every((d) => (d.numFrames - 1) % 4 === 0)).toBe(true);
  });

  it("offers a ~10s option within Wan's 121-frame cap", () => {
    const ten = getUncensoredVideoDuration("10s");
    expect(ten.seconds).toBe(10);
    expect(ten.numFrames).toBe(121);
    expect(ten.fps).toBe(12);
    expect(uncensoredVideoCredits(50, "10s")).toBe(75);
  });
});

describe("uncensored I2V identity and HD size", () => {
  it("locks I2V to the first-frame identity", () => {
    const out = applyUncensoredI2vIdentity("hair blowing", true);
    expect(out).toMatch(/first frame/i);
    expect(out).toMatch(/same face/i);
    expect(applyUncensoredI2vIdentity("hair blowing", false)).toBe("hair blowing");
  });

  it("uses 720p for HD portrait", () => {
    expect(getUncensoredVideoSize("portrait", "fast")).toEqual({ w: 480, h: 832 });
    expect(getUncensoredVideoSize("portrait", "hd")).toEqual({ w: 720, h: 1280 });
  });

  it("infers video aspect from a still so I2V does not stretch", () => {
    expect(getUncensoredVideoAspectFromSize(832, 1216)).toBe("portrait");
    expect(getUncensoredVideoAspectFromSize(1216, 832)).toBe("landscape");
    expect(getUncensoredVideoAspectFromSize(1024, 1024)).toBe("square");
  });

  it("applies intensity without replacing the motion prompt", () => {
    const out = applyUncensoredVideoIntensity("natural motion", "energetic");
    expect(out.startsWith("natural motion")).toBe(true);
    expect(out).toMatch(/energetic/i);
  });
});

describe("uncensored studio presets and prompt enhancer", async () => {
  const {
    UNCENSORED_REFINE_PRESETS,
    UNCENSORED_INPAINT_PRESETS,
    UNCENSORED_OUTFIT_PRESETS,
    UNCENSORED_SCENE_RECIPES,
    UNCENSORED_CHARACTER_ARCHETYPES,
    UNCENSORED_VIDEO_CAMERAS,
    UNCENSORED_VIDEO_RECIPES,
    UNCENSORED_ASPECTS,
    UNCENSORED_FRAMINGS,
    UNCENSORED_WARDROBE,
    UNCENSORED_SETTINGS,
    applyUncensoredVideoCamera,
    pickRandomUncensoredSceneRecipe,
    pickRandomUncensoredVideoRecipe,
    enhanceUncensoredPrompt,
  } = await import("./uncensoredStudio");

  it("provides valid refine, inpaint, and outfit presets within slider bounds", () => {
    expect(UNCENSORED_REFINE_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const p of UNCENSORED_REFINE_PRESETS) {
      expect(p.strength).toBeGreaterThanOrEqual(20);
      expect(p.strength).toBeLessThanOrEqual(90);
      expect(p.prompt.length).toBeGreaterThan(10);
    }

    expect(UNCENSORED_INPAINT_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const p of UNCENSORED_INPAINT_PRESETS) {
      expect(p.strength).toBeGreaterThanOrEqual(30);
      expect(p.strength).toBeLessThanOrEqual(85);
      expect(p.prompt.length).toBeGreaterThan(10);
    }

    expect(UNCENSORED_OUTFIT_PRESETS.length).toBeGreaterThanOrEqual(8);
  });

  it("provides 1-click scene recipes whose style, aspect, and director chips all match known studio IDs", () => {
    const validStyles = ["realistic", "cinematic", "fantasy", "anime", "artistic"];
    expect(UNCENSORED_SCENE_RECIPES.length).toBeGreaterThanOrEqual(6);
    for (const r of UNCENSORED_SCENE_RECIPES) {
      expect(r.prompt.length).toBeGreaterThan(30);
      expect(validStyles.includes(r.style)).toBe(true);
      expect(UNCENSORED_ASPECTS.some((a) => a.id === r.aspect)).toBe(true);
      expect(UNCENSORED_FRAMINGS.some((f) => f.id === r.framing)).toBe(true);
      expect(UNCENSORED_POSES.some((p) => p.id === r.pose)).toBe(true);
      expect(UNCENSORED_CAMERAS.some((c) => c.id === r.camera)).toBe(true);
      expect(UNCENSORED_LIGHTING.some((l) => l.id === r.lighting)).toBe(true);
      expect(UNCENSORED_WARDROBE.some((w) => w.id === r.wardrobe)).toBe(true);
      expect(UNCENSORED_SETTINGS.some((s) => s.id === r.setting)).toBe(true);
    }
    const picked = pickRandomUncensoredSceneRecipe("penthouse-boudoir");
    expect(picked.id).not.toBe("penthouse-boudoir");
  });

  it("provides 8 signature character archetypes and 6 video scene recipes with valid studio chips", () => {
    const validStyles = ["realistic", "cinematic", "fantasy", "anime", "artistic"];
    expect(UNCENSORED_POSES).toHaveLength(12);
    expect(UNCENSORED_CHARACTER_ARCHETYPES).toHaveLength(8);
    for (const a of UNCENSORED_CHARACTER_ARCHETYPES) {
      expect(a.prompt.length).toBeGreaterThan(40);
      expect(validStyles.includes(a.style)).toBe(true);
      expect(UNCENSORED_FRAMINGS.some((f) => f.id === a.framing)).toBe(true);
      expect(UNCENSORED_CAMERAS.some((c) => c.id === a.camera)).toBe(true);
      expect(UNCENSORED_LIGHTING.some((l) => l.id === a.lighting)).toBe(true);
      expect(UNCENSORED_WARDROBE.some((w) => w.id === a.wardrobe)).toBe(true);
      expect(UNCENSORED_SETTINGS.some((s) => s.id === a.setting)).toBe(true);
    }

    expect(UNCENSORED_VIDEO_CAMERAS).toHaveLength(6);
    expect(applyUncensoredVideoCamera("slow turn", "slow-push")).toMatch(/push-in/i);
    expect(applyUncensoredVideoCamera("slow turn", "unknown")).toBe("slow turn");

    expect(UNCENSORED_VIDEO_RECIPES).toHaveLength(6);
    for (const vr of UNCENSORED_VIDEO_RECIPES) {
      expect(UNCENSORED_VIDEO_MOTIONS.some((m) => m.id === vr.motion)).toBe(true);
      expect(UNCENSORED_VIDEO_CAMERAS.some((c) => c.id === vr.camera)).toBe(true);
    }
    const pickedVid = pickRandomUncensoredVideoRecipe("boudoir-glance");
    expect(pickedVid.id).not.toBe("boudoir-glance");
  });

  it("enhances short prompts with style-matched camera and lighting cues without duplicating existing terms", () => {
    const enhanced = enhanceUncensoredPrompt("a woman in a red dress", "realistic");
    expect(enhanced.startsWith("a woman in a red dress,")).toBe(true);
    expect(enhanced).toMatch(/85mm/i);
    const secondPass = enhanceUncensoredPrompt(enhanced, "realistic");
    expect(secondPass.length).toBeGreaterThanOrEqual(enhanced.length);
  });
});


