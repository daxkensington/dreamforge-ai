import { describe, expect, it } from "vitest";
import { getTrainingCredits, getTrainingImageCredits } from "./training";
describe("custom training quotes", () => {
  it("fixes training step quotes and rejects unquoted provider spend", () => {
    expect(getTrainingCredits(800)).toBe(10000);
    expect(getTrainingCredits(1200)).toBe(15000);
    expect(() => getTrainingCredits(2000)).toThrow();
  });
  it("rounds up fal megapixels, including 1024 square, with bounded aligned dimensions", () => {
    expect(getTrainingImageCredits(1000, 1000)).toBe(210);
    expect(getTrainingImageCredits(1024, 1024)).toBe(420);
    expect(getTrainingImageCredits(512, 768)).toBe(210);
    expect(() => getTrainingImageCredits(1536, 1024)).toThrow();
    expect(() => getTrainingImageCredits(999, 1000)).toThrow();
  });
});
