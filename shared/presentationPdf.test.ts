import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  createPresentationPdf,
  layoutPresentationPdf,
  wrapPresentationText,
} from "../client/src/lib/presentationPdf";
import type { PresentationSlide } from "./presentation";

const measure = (text: string, size: number) =>
  Array.from(text).length * size * 0.6;
const slide: PresentationSlide = {
  id: "1",
  title: "Full title",
  content: "A content point",
  notes: "Actual speaker notes",
  imagePrompt: "Diagram",
};
describe("complete presentation PDF pagination", () => {
  it("exports every slide and separate speaker notes, with notes optional", () => {
    const pages = layoutPresentationPdf(
      [slide, { ...slide, id: "2", notes: "" }],
      true,
      measure
    );
    expect(pages.map(page => [page.slideIndex, page.notes])).toEqual([
      [0, false],
      [0, true],
      [1, false],
    ]);
    expect(pages[1].lines.map(line => line.text).join(" ")).toContain(
      "Actual speaker notes"
    );
    expect(layoutPresentationPdf([slide], false, measure)).toHaveLength(1);
  });
  it("paginates long titles/content/notes without dropped or clipped lines", () => {
    const input = {
      ...slide,
      title: "Extremely long title ".repeat(40),
      content: "A substantive sentence with details. ".repeat(250),
      notes: "Speaker detail. ".repeat(250),
      imageUrl: "https://example.test/diagram.png",
    };
    const pages = layoutPresentationPdf([input], true, measure);
    expect(pages.length).toBeGreaterThan(10);
    const compact = (value: string) => value.replace(/\s+/g, "");
    for (const notes of [false, true]) {
      const section = pages.filter(page => page.notes === notes);
      expect(
        compact(
          section
            .flatMap(page =>
              page.lines.filter(line => line.title).map(line => line.text)
            )
            .join("")
        )
      ).toBe(compact(input.title));
      expect(
        compact(
          section
            .flatMap(page =>
              page.lines.filter(line => !line.title).map(line => line.text)
            )
            .join("")
        )
      ).toBe(compact(notes ? input.notes : input.content));
    }
    for (const page of pages)
      for (const line of page.lines) {
        expect(line.y + (line.title ? 66 : 46)).toBeLessThanOrEqual(800);
        expect(measure(line.text, line.size)).toBeLessThanOrEqual(
          page.imageUrl ? 720 : 1420
        );
      }
    expect(
      pages
        .filter(page => !page.notes)
        .every(page => page.imageUrl === input.imageUrl)
    ).toBe(true);
    expect(pages.filter(page => page.notes).every(page => !page.imageUrl)).toBe(
      true
    );
  });
  it("wraps long tokens, CJK, combining accents and emoji without splitting graphemes", () => {
    const text = "日本語の文章 😀👨‍👩‍👧‍👦 café e\u0301 " + "A".repeat(120);
    const wrapped = wrapPresentationText(text, 180, 16, measure);
    expect(wrapped.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
    expect(wrapped.some(line => line.includes("👨‍👩‍👧‍👦"))).toBe(true);
    expect(wrapped.some(line => line.startsWith("\u0301"))).toBe(false);
  });
  it("fails explicitly for impractically large exports rather than truncating", () => {
    expect(() =>
      layoutPresentationPdf(
        [{ ...slide, content: "Longword ".repeat(100000) }],
        false,
        measure
      )
    ).toThrow("200 PDF pages");
  });
});

describe("actual jsPDF export assembly and image failures", () => {
  afterEach(() => vi.unstubAllGlobals());
  const png =
    "data:image/png;base64," +
    readFileSync(new URL("../public/icon-192.png", import.meta.url)).toString(
      "base64"
    );
  function mockCanvas() {
    const context = {
      font: "",
      fillStyle: "",
      direction: "",
      textAlign: "",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 16 }),
    };
    vi.stubGlobal("document", {
      fonts: { ready: Promise.resolve() },
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => context,
        toDataURL: () => png,
      }),
    });
    return context;
  }
  it("assembles a valid downloadable PDF with title and notes page", async () => {
    const context = mockCanvas();
    const pdf = await createPresentationPdf({
      title: "Exported deck",
      slides: [slide],
      includeNotes: true,
    });
    expect(pdf.getNumberOfPages()).toBe(2);
    expect(pdf.output()).toContain("/Title (Exported deck)");
    expect(pdf.output()).toMatch(/^%PDF-/);
    expect(context.fillText).toHaveBeenCalledWith(
      "Actual speaker notes",
      90,
      expect.any(Number)
    );
  });
  it("refuses a missing/revoked image and gives a repair action instead of a false complete export", async () => {
    mockCanvas();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(
      createPresentationPdf({
        title: "Deck",
        slides: [{ ...slide, imageUrl: "/img/revoked.png" }],
        includeNotes: true,
      })
    ).rejects.toThrow("Retry or remove that image");
  });
});
