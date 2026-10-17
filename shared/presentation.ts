import { z } from "zod";

export const PRESENTATION_DRAFT_CREDITS = 5;
export const presentationStyle = z.enum([
  "modern",
  "corporate",
  "creative",
  "dark",
  "startup",
  "education",
]);
export const presentationDraftInput = z.object({
  requestId: z.string().uuid(),
  topic: z.string().trim().min(3).max(2000),
  slideCount: z.number().int().min(3).max(20),
  style: presentationStyle,
  audience: z.string().trim().max(300).default(""),
});
export const generatedPresentationSlide = z.object({
  title: z.string().trim().min(1).max(240),
  content: z.string().trim().min(1).max(4000),
  notes: z.string().trim().max(6000),
  imagePrompt: z.string().trim().min(1).max(1500),
});
export const generatedPresentation = z.object({
  title: z.string().trim().min(1).max(240),
  slides: z.array(generatedPresentationSlide).min(3).max(20),
});
export type GeneratedPresentation = z.infer<typeof generatedPresentation>;
export interface PresentationSlide {
  id: string;
  title: string;
  content: string;
  notes: string;
  imagePrompt: string;
  imageUrl?: string;
}
export interface PresentationImageInput {
  prompt: string;
  mediaType: "image";
  width: 768;
  height: 432;
  modelVersion: string;
  uncensored: false;
}
export interface PresentationImageJob {
  userId: number;
  requestId: string;
  input: PresentationImageInput;
  creditCost: number;
  state: "pending" | "uncertain" | "completed" | "failed";
  error?: string;
}

export function isUnresolvedPresentationJob(job?: { state: string }) {
  return job?.state === "pending" || job?.state === "uncertain";
}

/** These tRPC refusals occur before a new reservation; all transport/5xx
 * failures and conflicts keep the original identity for reconciliation. */
export function presentationRequestErrorState(
  error: unknown
): "failed" | "uncertain" {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  return code &&
    [
      "BAD_REQUEST",
      "FORBIDDEN",
      "UNAUTHORIZED",
      "PRECONDITION_FAILED",
      "TOO_MANY_REQUESTS",
    ].includes(code)
    ? "failed"
    : "uncertain";
}

/** Freeze both the payload and price before submission; a retry never re-quotes. */
export function preparePresentationImageJob(
  previous: PresentationImageJob | undefined,
  input: {
    userId: number;
    prompt: string;
    modelId: string;
    creditCost: number;
  },
  uuid: () => string = () => globalThis.crypto.randomUUID()
): PresentationImageJob {
  if (previous && isUnresolvedPresentationJob(previous)) {
    if (previous.userId !== input.userId)
      throw new Error("This image request belongs to another account.");
    return previous;
  }
  if (
    !Number.isSafeInteger(input.userId) ||
    input.userId < 1 ||
    !Number.isSafeInteger(input.creditCost) ||
    input.creditCost < 1 ||
    !input.prompt.trim()
  ) {
    throw new Error(
      "A signed-in account, image prompt and exact model quote are required."
    );
  }
  return {
    userId: input.userId,
    requestId: uuid(),
    input: {
      prompt: input.prompt.trim(),
      mediaType: "image",
      width: 768,
      height: 432,
      modelVersion: input.modelId,
      uncensored: false,
    },
    creditCost: input.creditCost,
    state: "pending",
  };
}

export function settlePresentationImageJob(
  job: PresentationImageJob,
  result: {
    status: string;
    error?: string;
    imageUrl?: string;
    reconciliationRequired?: boolean;
  }
): PresentationImageJob {
  if (result.status === "completed" && result.imageUrl)
    return { ...job, state: "completed", error: undefined };
  if (result.status === "failed")
    return {
      ...job,
      state: "failed",
      error: result.error ?? "Image generation failed.",
    };
  return {
    ...job,
    state: "uncertain",
    error: result.reconciliationRequired
      ? "This request needs review. Retry checks this same request; it will not render again."
      : "Your request is still processing. Retry checks the same request.",
  };
}

const safeImageUrl = z
  .string()
  .max(2000)
  .refine(value => {
    if (value.startsWith("/img/")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Image must use an HTTPS URL or an /img/ path.");
export const savedPresentation = z
  .object({
    version: z.literal(1),
    title: z.string().max(240),
    slides: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          title: z.string().max(4000),
          content: z.string().max(20000),
          notes: z.string().max(20000),
          imagePrompt: z.string().max(1500),
          imageUrl: safeImageUrl.optional(),
        })
      )
      .min(1)
      .max(30),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.slides.map(slide => slide.id)).size !== value.slides.length
    )
      ctx.addIssue({ code: "custom", message: "Slide IDs must be unique." });
  });

const imageJobSchema = z.object({
  userId: z.number().int().positive(),
  requestId: z.string().uuid(),
  input: z.object({
    prompt: z.string().min(1).max(8000),
    mediaType: z.literal("image"),
    width: z.literal(768),
    height: z.literal(432),
    modelVersion: z.string().min(1).max(100),
    uncensored: z.literal(false),
  }),
  creditCost: z.number().int().positive(),
  state: z.enum(["pending", "uncertain", "completed", "failed"]),
  error: z.string().optional(),
});
export const presentationSessionSchema = z.object({
  version: z.literal(1),
  userId: z.number().int().nonnegative(),
  deck: savedPresentation.nullable(),
  jobs: z.record(z.string(), imageJobSchema),
  draftJob: z
    .object({
      input: presentationDraftInput,
      state: z.enum(["pending", "uncertain", "completed", "failed"]),
      error: z.string().optional(),
    })
    .optional(),
  topic: z.string().max(2000),
  audience: z.string().max(300),
  slideCount: z.number().int().min(3).max(20),
  style: presentationStyle,
});
export type PresentationSession = z.infer<typeof presentationSessionSchema>;
export function emptyPresentationSession(userId: number): PresentationSession {
  return {
    version: 1,
    userId,
    deck: null,
    jobs: {},
    topic: "",
    audience: "",
    slideCount: 8,
    style: "modern",
  };
}
export function parsePresentationSession(
  raw: string,
  userId: number
): PresentationSession {
  const value = presentationSessionSchema.parse(JSON.parse(raw));
  if (
    value.userId !== userId ||
    Object.values(value.jobs).some(job => job.userId !== userId)
  )
    throw new Error("Presentation session belongs to another account.");
  return value;
}

export function presentationFilename(title: string, extension: "pdf" | "json") {
  const clean = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .trim();
  const name = Array.from(clean)
    .slice(0, 80)
    .join("")
    .replace(/[. ]+$/g, "");
  return `${name || "presentation"}.${extension}`;
}
