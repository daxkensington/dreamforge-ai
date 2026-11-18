export const VIDEO_TEMPLATE_WORKSPACE_PATH =
  "/tools/text-to-video?from=template";

const storageKey = "dreamforgex:video-template-draft";

export const videoTemplateDimensions = {
  "16:9": [1024, 576],
  "9:16": [576, 1024],
  "1:1": [1024, 1024],
} as const;

export interface VideoTemplateDraft {
  prompt: string;
  aspectRatio: keyof typeof videoTemplateDimensions;
  duration: number;
}

function normalizeDraft(value: unknown): VideoTemplateDraft | null {
  if (!value || typeof value !== "object") return null;
  const { prompt, aspectRatio, duration } =
    value as Partial<VideoTemplateDraft>;
  const text = typeof prompt === "string" ? prompt.trim().slice(0, 2000) : "";
  if (
    text.length < 3 ||
    !aspectRatio ||
    !Object.hasOwn(videoTemplateDimensions, aspectRatio) ||
    duration !== 8
  )
    return null;
  return { prompt: text, aspectRatio, duration };
}

export function saveVideoTemplateDraft(draft: VideoTemplateDraft): boolean {
  const normalized = normalizeDraft(draft);
  if (!normalized) return false;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function takeVideoTemplateDraft(): VideoTemplateDraft | null {
  try {
    const value = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    return value === null ? null : normalizeDraft(JSON.parse(value));
  } catch {
    return null;
  }
}
