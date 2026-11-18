import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";

const mocks = vi.hoisted(() => ({ debit: vi.fn(), refund: vi.fn(), image: vi.fn(), receipt: vi.fn(), llm: vi.fn(), project: vi.fn(), role: vi.fn(), song: vi.fn(), fetchImage: vi.fn() }));
vi.mock("./stripe", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  deductCredits: mocks.debit,
  refundCredits: mocks.refund,
}));
vi.mock("./_core/imageGeneration", () => ({ generateImage: mocks.image }));
vi.mock("./_core/imageUrlGuard", async (original) => ({
  ...(await original<Record<string, unknown>>()), fetchGuardedImage: mocks.fetchImage,
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("./_core/songGeneration", () => ({ generateSong: mocks.song }));
vi.mock("./rate-limit", async (original) => ({ ...(await original<Record<string, unknown>>()), enforceRateLimit: vi.fn() }));
vi.mock("edge-tts-universal", () => ({ EdgeTTS: class { async synthesize() { throw new Error("speech unavailable"); } } }));
vi.mock("./_core/walletAccounting", async (original) => ({
  ...(await original<Record<string, unknown>>()), hasWalletRefundReceipt: mocks.receipt,
}));
vi.mock("./db", async (original) => ({
  ...(await original<Record<string, unknown>>()), getVideoProject: mocks.project, getUserCollaboratorRole: mocks.role,
}));
vi.mock("./_core/toolStatus", async (original) => ({
  ...(await original<Record<string, unknown>>()), requireToolActive: vi.fn().mockResolvedValue(undefined), logToolFailure: vi.fn(),
}));

import { appRouter } from "./routers";

const caller = () => appRouter.createCaller({ user: { id: 8, openId: "fixture", role: "user" } as never, session: null, ip: "test" });
const cases = [
  { name: "mockup", invoke: () => caller().tools.mockup({ imageUrl: "https://example.com/design.png", mockupType: "mug" }), label: "mockup" },
  { name: "social resize", invoke: () => caller().tools.socialResize({ imageUrl: "https://example.com/design.png", platform: "instagram-post" }), label: "social resize" },
];

describe.each(cases)("$name credit settlement", ({ invoke, label }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 123, purchasedCreditsDebited: 2 });
    mocks.refund.mockResolvedValue({ success: true, refunded: 5 });
    mocks.receipt.mockResolvedValue(false);
    mocks.image.mockResolvedValue({ url: "https://example.com/result.png" });
  });

  it("retains the debit for a completed result", async () => {
    expect((await invoke()).status).toBe("completed");
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("refunds the exact debit with purchased provenance and a debit-bound idempotency key on failure", async () => {
    mocks.image.mockRejectedValue(new Error("provider unavailable"));
    expect((await invoke()).status).toBe("failed");
    expect(mocks.refund).toHaveBeenCalledWith(8, 5, `Refund: ${label} generation failed`, {
      purchasedCredits: 2, operationKey: "legacy-tool-refund:123",
    });
  });

  it("does not generate or refund when the debit is rejected", async () => {
    mocks.debit.mockResolvedValue({ success: false, balance: 0, needed: 5 });
    await expect(invoke()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("tells the customer to contact support when the refund fails", async () => {
    mocks.image.mockRejectedValue(new Error("provider unavailable"));
    mocks.refund.mockRejectedValue(new Error("database unavailable"));
    await expect(invoke()).rejects.toThrow("contact support");
  });

  it("does not issue an untraceable refund when debit provenance is missing", async () => {
    mocks.debit.mockResolvedValue({ success: true, balance: 90 });
    mocks.image.mockRejectedValue(new Error("provider unavailable"));
    await expect(invoke()).rejects.toThrow("contact support");
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it.each(["zero result", "lost acknowledgement"])("accepts %s only with a matching committed receipt", async (kind) => {
    mocks.image.mockRejectedValue(new Error("provider unavailable"));
    if (kind === "zero result") mocks.refund.mockResolvedValue({ success: true, refunded: 0 });
    else mocks.refund.mockRejectedValue(new Error("acknowledgement lost"));
    mocks.receipt.mockResolvedValue(true);
    expect((await invoke()).status).toBe("failed");
    expect(mocks.receipt).toHaveBeenCalledWith(8, 5, 2, "legacy-tool-refund:123");
  });

  it.each(["missing receipt", "unavailable verification"])("reports %s for an unverified zero refund", async (kind) => {
    mocks.image.mockRejectedValue(new Error("provider unavailable"));
    mocks.refund.mockResolvedValue({ success: true, refunded: 0 });
    if (kind === "unavailable verification") mocks.receipt.mockRejectedValue(new Error("db unavailable"));
    await expect(invoke()).rejects.toThrow("contact support");
  });
});

const videoShapes = [
  { name: "storyboard", invoke: () => caller().video.generateStoryboard({ concept: "a story" }) },
  { name: "scene", invoke: () => caller().video.directScene({ narrative: "a story" }) },
  { name: "soundtrack", invoke: () => caller().video.suggestSoundtrack({ concept: "a story" }) },
  { name: "script", invoke: () => caller().video.generateScript({ concept: "a story" }) },
];
const songShapes = [
  { name: "song", invoke: () => caller().song.generateSong({ lyrics: "words", genre: "pop", mood: "happy" }), provider: mocks.song, empty: {} },
];
describe.each(songShapes)("$name synchronous delivery", ({ invoke, provider, empty }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 753, purchasedCreditsDebited: 1 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
  });
  it("refunds before returning a provider error", async () => {
    provider.mockRejectedValue(new Error("provider unavailable"));
    await expect(invoke()).rejects.toThrow("provider unavailable");
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 1, operationKey: "legacy-tool-refund:753",
    });
  });
  it("refunds when a provider returns no URL", async () => {
    provider.mockResolvedValue(empty);
    await expect(invoke()).rejects.toThrow();
    expect(mocks.refund).toHaveBeenCalledTimes(1);
  });
});
describe.each(videoShapes)("$name failure", ({ invoke }) => {
  it("refunds when no text or images are delivered", async () => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 147, purchasedCreditsDebited: 1 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
    mocks.llm.mockRejectedValue(new Error("provider unavailable"));
    expect((await invoke()).status).toBe("failed");
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 1, operationKey: "legacy-tool-refund:147",
    });
  });
});

describe("project refinement credit settlement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 258, purchasedCreditsDebited: 1 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
  });
  it("checks authorization before debiting", async () => {
    mocks.project.mockResolvedValue(null); mocks.role.mockResolvedValue(null);
    await expect(caller().videoProject.refineProject({ projectId: 7, feedback: "Please refine" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.debit).not.toHaveBeenCalled();
  });
  it("refunds when refinement fails", async () => {
    mocks.project.mockResolvedValue({ id: 7, type: "script", data: {} });
    mocks.llm.mockRejectedValue(new Error("provider unavailable"));
    expect((await caller().videoProject.refineProject({ projectId: 7, feedback: "Please refine" })).status).toBe("failed");
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 1, operationKey: "legacy-tool-refund:258",
    });
  });
});

describe("relight and 3D fallback settlement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 369, purchasedCreditsDebited: 1 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider unavailable")));
  });
  it("charges relight when the fallback supplies an image", async () => {
    try {
      mocks.image.mockResolvedValue({ url: "https://example.com/fallback.png" });
      expect((await caller().tools.relight({ imageUrl: "https://example.com/p.png", prompt: "sunlight" })).status).toBe("completed");
      expect(mocks.refund).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it("refunds relight when both providers fail", async () => {
    try {
      mocks.image.mockRejectedValue(new Error("fallback unavailable"));
      expect((await caller().tools.relight({ imageUrl: "https://example.com/p.png", prompt: "sunlight" })).status).toBe("failed");
      expect(mocks.refund).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });
  it.each([false, true])("refunds 3D when all configured providers fail (fallback=%s)", async (fallback) => {
    try {
      vi.stubEnv("REPLICATE_API_TOKEN", fallback ? "fixture-only" : "");
      expect((await caller().tools.generate3D({ imageUrl: "https://example.com/p.png" })).status).toBe("failed");
      expect(mocks.refund).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
});

const flatBatchShapes = [
  { name: "batch process", invoke: () => caller().tools.batchProcess({ tool: "upscale", images: ["https://example.com/a.png", "https://example.com/b.png"] }) },
  { name: "variations", invoke: () => caller().tools.generateVariations({ imageUrl: "https://example.com/a.png", count: 2 }) },
];
describe.each(flatBatchShapes)("$name flat-price delivery", ({ invoke }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 246, purchasedCreditsDebited: 1 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
  });
  it("refunds the full debit when no result is delivered", async () => {
    mocks.image.mockRejectedValue(new Error("provider unavailable"));
    const result = await invoke();
    expect(result.completed).toBe(0);
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 1, operationKey: "legacy-tool-refund:246",
    });
  });
  it("retains the flat charge when a partial result is delivered", async () => {
    mocks.image.mockResolvedValueOnce({ url: "https://example.com/first.png" }).mockRejectedValueOnce(new Error("provider unavailable"));
    const result = await invoke();
    expect(result.completed).toBe(1);
    expect(mocks.refund).not.toHaveBeenCalled();
  });
});

describe("batch prompt item settlement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 85, transactionId: 951, purchasedCreditsDebited: 7 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
  });
  it("refunds only failed items using their proportional debit provenance and unique item keys", async () => {
    mocks.image.mockRejectedValueOnce(new Error("first failed")).mockRejectedValueOnce(new Error("second failed")).mockResolvedValueOnce({ url: "https://example.com/third.png" });
    const result = await caller().tools.batchPrompts({ prompts: ["one", "two", "three"] });
    expect(result.completed).toBe(1);
    expect(mocks.refund).toHaveBeenCalledTimes(2);
    expect(mocks.refund).toHaveBeenNthCalledWith(1, 8, 5, expect.any(String), { purchasedCredits: 0, operationKey: "legacy-tool-refund:951:0" });
    expect(mocks.refund).toHaveBeenNthCalledWith(2, 8, 5, expect.any(String), { purchasedCredits: 2, operationKey: "legacy-tool-refund:951:1" });
  });
  it("keeps successful items visible and flags an unverified item refund", async () => {
    mocks.image.mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce({ url: "https://example.com/good.png" });
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 951, purchasedCreditsDebited: 0 });
    mocks.refund.mockRejectedValue(new Error("database unavailable"));
    mocks.receipt.mockResolvedValue(false);
    const result = await caller().tools.batchPrompts({ prompts: ["one", "two"] });
    expect(result.completed).toBe(1);
    expect(result.results[0].error).toContain("contact support");
    expect(result.results[1].url).toBe("https://example.com/good.png");
  });
});

const otherShapes = [
  { name: "vectorize", invoke: () => caller().tools.vectorize({ imageUrl: "https://example.com/design.png" }) },
  { name: "image caption", free: true, invoke: () => caller().tools.imageCaption({ imageUrl: "https://example.com/design.png" }) },
  { name: "speech", invoke: () => caller().tools.textToSpeech({ text: "hello", model: "edge-tts" }) },
  { name: "audio enhancement", invoke: () => caller().tools.audioEnhance({ description: "voice" }) },
  { name: "sound effects", invoke: () => caller().tools.soundEffects({ description: "rain" }) },
  { name: "music", invoke: () => caller().tools.musicGen({ description: "piano" }) },
  { name: "meme", invoke: () => caller().tools.meme({ concept: "a cat" }) },
];
describe.each(otherShapes)("$name failure result", ({ invoke, free }) => {
  it("refunds the recorded debit when no result is returned", async () => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 345, purchasedCreditsDebited: 1 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
    mocks.image.mockRejectedValue(new Error("image unavailable"));
    mocks.llm.mockRejectedValue(new Error("llm unavailable"));
    expect((await invoke()).status).toBe("failed");
    if (free) {
      expect(mocks.debit).not.toHaveBeenCalled();
      expect(mocks.refund).not.toHaveBeenCalled();
      return;
    }
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 1, operationKey: "legacy-tool-refund:345",
    });
  });
});

it("keeps the vectorize charge when a raster is delivered despite SVG fallback failure", async () => {
  vi.resetAllMocks();
  mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 456, purchasedCreditsDebited: 0 });
  mocks.image.mockResolvedValue({ url: "https://example.com/raster.png" });
  mocks.fetchImage.mockRejectedValue(new Error("SVG fetch unavailable"));
  const result = await caller().tools.vectorize({ imageUrl: "https://example.com/design.png" });
  expect(result).toMatchObject({ status: "completed", url: "https://example.com/raster.png", svgUrl: null });
  expect(mocks.refund).not.toHaveBeenCalled();
});

const multiShapes = [
  { name: "carousel", invoke: () => caller().tools.igCarousel({ topic: "flowers" }), outline: { slides: [{ headline: "one", body: "a", role: "hook" }, { headline: "two", body: "b", role: "cta" }] }, field: "slides" },
  { name: "sticker pack", invoke: () => caller().tools.stickerPack({ theme: "flowers" }), outline: { stickers: [{ subject: "one", caption: "a" }, { subject: "two", caption: "b" }] }, field: "results" },
  { name: "zine", invoke: () => caller().tools.zineSpread({ topic: "flowers" }), outline: { pages: [{ heading: "one", body: "a", visual: "art" }, { heading: "two", body: "b", visual: "art" }] }, field: "results" },
];
describe.each(multiShapes)("$name delivery", ({ invoke, outline, field }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 678, purchasedCreditsDebited: 2 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
    mocks.llm.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(outline) } }] });
  });
  it("charges a completed set", async () => {
    mocks.image.mockResolvedValue({ url: "https://example.com/result.png" });
    expect((await invoke()).status).toBe("completed");
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("refunds when the outline fails before any image", async () => {
    mocks.llm.mockRejectedValue(new Error("outline failed"));
    expect((await invoke()).status).toBe("failed");
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.refund).toHaveBeenCalledTimes(1);
  });
  it("refunds when a later image fails and no partial URLs are delivered", async () => {
    mocks.image.mockResolvedValueOnce({ url: "https://example.com/first.png" }).mockRejectedValueOnce(new Error("second image failed"));
    const result = await invoke();
    expect(result.status).toBe("failed");
    expect(result[field as keyof typeof result]).toEqual([]);
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 2, operationKey: "legacy-tool-refund:678",
    });
  });
});

const directMultiShapes = [
  { name: "comic", invoke: () => caller().tools.comicStrip({ concept: "a cat" }), field: "panels" },
  { name: "tattoo", invoke: () => caller().tools.tattooDesign({ concept: "a cat" }), field: "results" },
  { name: "turnaround", invoke: () => caller().tools.poseTurnaround({ description: "a cat" }), field: "results" },
  { name: "listing photos", invoke: () => caller().tools.listingPhotos({ imageUrl: "https://example.com/p.png", productName: "cup" }), field: "results" },
  { name: "lookbook", invoke: () => caller().tools.fashionLookbook({ garmentDescription: "coat" }), field: "results" },
  { name: "chapters", invoke: () => caller().tools.ytChapterThumbnails({ videoTitle: "video", chapters: ["one", "two"] }), field: "results" },
  { name: "business card", invoke: () => caller().tools.businessCard({ name: "A", title: "B", contact: "C" }), field: "frontUrl" },
  { name: "greeting card", invoke: () => caller().tools.greetingCard({}), field: "frontUrl" },
  { name: "cosplay", invoke: () => caller().tools.cosplayReference({ character: "a cat" }), field: "results" },
];
describe.each(directMultiShapes)("$name multi-result delivery", ({ invoke, field }) => {
  it("refunds if a later image fails and no partial deliverable is returned", async () => {
    vi.resetAllMocks();
    mocks.debit.mockResolvedValue({ success: true, balance: 90, transactionId: 789, purchasedCreditsDebited: 2 });
    mocks.refund.mockImplementation(async (_user: number, amount: number) => ({ success: true, refunded: amount }));
    mocks.llm.mockResolvedValue('["first panel", "second panel"]');
    mocks.image.mockResolvedValueOnce({ url: "https://example.com/first.png" }).mockRejectedValueOnce(new Error("second image failed"));
    const result = await invoke();
    expect(result.status).toBe("failed");
    const delivered = (result as Record<string, unknown>)[field];
    expect(delivered === null || (Array.isArray(delivered) && delivered.length === 0)).toBe(true);
    expect(mocks.refund).toHaveBeenCalledWith(8, mocks.debit.mock.calls[0][1], expect.any(String), {
      purchasedCredits: 2, operationKey: "legacy-tool-refund:789",
    });
  });
});

// These are the single-result operations whose explicit failure response has
// no deliverable. This contract prevents a later route edit silently removing
// refund settlement from any one of them; the router tests above exercise the
// actual success, debit failure, provider failure and refund-failure behavior.
const singleResultRoutes = [
  ["upscale", "super-resolution"], ["styleTransfer", "style-transfer"],
  ["backgroundEdit", "background-edit"], ["inpaint", "text-to-image"],
  ["enhanceFace", "face-enhance"], ["outpaint", "text-to-image"],
  ["eraseObject", "object-remove"], ["textEffects", "text-to-image"],
  ["blendImages", "image-merge"], ["sketchToImage", "sketch-to-image"],
  ["liveCanvasRender", "sketch-to-image"], ["colorGrade", "color-grade"],
  ["photoRestore", "photo-restore"], ["headshot", "headshot"], ["logoMaker", "logo-maker"],
  ["wallpaper", "wallpaper"], ["qrArt", "qr-art"], ["nlEdit", "nl-edit"],
  ["avatar", "avatar"], ["productPhoto", "product-photo"], ["textureGen", "texture-gen"],
  ["panorama", "panorama"], ["hdrEnhance", "color-grade"],
  ["transparentPng", "background-edit"], ["iconGen", "text-to-image"],
  ["depthMap", "depth-map"], ["characterSheet", "character-sheet"],
  ["interiorDesign", "interior-design"], ["thumbnail", "thumbnail"], ["collage", "collage"],
  ["filmGrain", "film-grain"], ["virtualTryOn", "virtual-tryon"],
  ["tshirtDesign", "tshirt-design"], ["pixelArt", "pixel-art"], ["coloringBook", "coloring-book"],
  ["coverMaker", "cover-maker"], ["photoColorize", "photo-colorize"],
  ["podcastCover", "podcast-cover"], ["realEstateTwilight", "real-estate-twilight"],
  ["memeTemplate", "meme-template"], ["recipeCard", "recipe-card"], ["invitation", "invitation"],
  ["petPortrait", "pet-portrait"], ["tarotCard", "tarot-card"], ["moviePoster", "movie-poster"],
  ["tradingCard", "trading-card"], ["menuDesign", "menu-design"], ["emojiCreator", "emoji-creator"],
  ["brandStyleGuide", "brand-style-guide"], ["eventFlyer", "event-flyer"],
  ["certificate", "certificate"], ["bookmark", "bookmark"], ["concertPoster", "concert-poster"],
  ["architectureConcept", "architecture-concept"], ["travelPostcard", "travel-postcard"],
  ["styleTransfer", "video-style-transfer"], ["upscaleFrame", "video-upscaler"],
] as const;

const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const routerFile = ts.createSourceFile("routers.ts", routerSource, ts.ScriptTarget.Latest, true);
describe.each(singleResultRoutes)("%s (%s) failed result contract", (route, tool) => {
  it("settles the matching debit before returning a failed result", () => {
    const file = routerFile;
    const matches: ts.ArrowFunction[] = [];
    const walk = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "tryDeductCredits" &&
          node.arguments[1] && ts.isStringLiteral(node.arguments[1]) && node.arguments[1].text === tool) {
        let fn: ts.Node | undefined = node;
        while (fn && !(ts.isArrowFunction(fn) && ts.isBlock(fn.body))) fn = fn.parent;
        let owner: ts.Node | undefined = fn;
        while (owner && !ts.isPropertyAssignment(owner)) owner = owner.parent;
        if (fn && ts.isArrowFunction(fn) && owner && ts.isPropertyAssignment(owner) && owner.name.getText(file) === route) matches.push(fn);
      }
      ts.forEachChild(node, walk);
    };
    walk(file);
    expect(matches).toHaveLength(1);
    const body = matches[0].body;
    expect(ts.isBlock(body)).toBe(true);
    if (!ts.isBlock(body)) return;
    const debit = body.statements.find(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d =>
      d.name.getText(file) === "deduction" && d.initializer?.getText(file).startsWith("await tryDeductCredits(")));
    const guarded = body.statements.filter(ts.isTryStatement).find(s => s.catchClause?.block.getText(file).includes('status: "failed"'));
    expect(debit).toBeDefined();
    expect(guarded?.catchClause?.block.getText(file)).toContain(`await refundFailedLegacyTool(ctx.user.id, deduction, "${tool}")`);
  });
});
