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
