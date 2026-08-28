import { describe, it, expect } from "vitest";
import {
  applyUncensoredPose,
  getUncensoredPose,
  getUncensoredVideoDuration,
  uncensoredVideoCredits,
  uncensoredCharacterRef,
  isUncensoredCharacter,
  parseUncensoredCharacterRef,
  UNCENSORED_POSES,
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

describe("uncensored video duration", () => {
  it("defaults to ~5s and prices 8s at 1.5×", () => {
    expect(getUncensoredVideoDuration(undefined).id).toBe(DEFAULT_UNCENSORED_VIDEO_DURATION);
    expect(getUncensoredVideoDuration("8s").numFrames).toBe(121);
    expect(uncensoredVideoCredits(50, "5s")).toBe(50);
    expect(uncensoredVideoCredits(50, "8s")).toBe(75);
    expect(UNCENSORED_VIDEO_DURATIONS.every((d) => (d.numFrames - 1) % 4 === 0)).toBe(true);
  });
});
