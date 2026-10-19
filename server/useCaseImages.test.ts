import { existsSync } from "node:fs";
import path from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { USE_CASES } from "../shared/useCaseData";

vi.mock("@/components/PageLayout", () => ({ default: "div" }));
vi.mock("@/components/ui/button", () => ({ Button: "button" }));
vi.mock("@/components/ui/card", () => ({ Card: "div", CardContent: "div" }));
vi.mock("wouter", () => ({ Link: "a" }));
vi.mock("framer-motion", () => ({ motion: { div: "div" } }));

import UseCasePage from "../client/src/pages/UseCasePage";

// Vitest compiles this JSX-preserving project with the classic React runtime.
beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());

function imageSources(html: string) {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
}

describe("use-case showcase images", () => {
  it("renders the published text-effects image instead of the nonexistent slug-derived path", () => {
    const html = renderToStaticMarkup(createElement(UseCasePage, { useCase: USE_CASES.musicians }));
    expect(imageSources(html)).toContain("/showcase/example-texteffect-1.jpg");
    expect(imageSources(html)).not.toContain("/showcase/tool-text-effects.jpg");
  });

  it.each(Object.values(USE_CASES))("renders existing local assets for $slug tool cards", (useCase) => {
    const sources = imageSources(renderToStaticMarkup(createElement(UseCasePage, { useCase })));
    expect(sources).toHaveLength(useCase.tools.length);
    for (const src of sources) {
      expect(src).toMatch(/^\/showcase\/[\w-]+\.jpg$/);
      expect(existsSync(path.resolve(import.meta.dirname, "../public", src.slice(1))), src).toBe(true);
    }
  });

  it("uses the existing gallery fallback when a future tool has no published sample", () => {
    const useCase = { ...USE_CASES.musicians, tools: [{ slug: "future-unmapped-tool", why: "A future tool" }] };
    const sources = imageSources(renderToStaticMarkup(createElement(UseCasePage, { useCase })));
    expect(sources).toEqual(["/showcase/gallery-4.jpg"]);
  });
});
