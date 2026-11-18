export const DEMO_PROMPT_LIMIT = 500;

const DEMO_PATH = "/demo/text-to-image";
const DRAFT_FIELD = "draft";

function normalizeDraft(value: string) {
  return value.trim().slice(0, DEMO_PROMPT_LIMIT);
}

export function galleryDemoHref(prompt: string) {
  const draft = normalizeDraft(prompt);
  // Only published gallery prompts use this link. A fragment stays in the browser.
  return draft.length >= 3
    ? `${DEMO_PATH}#${new URLSearchParams({ [DRAFT_FIELD]: draft })}`
    : DEMO_PATH;
}

export function readGalleryDemoDraft(hash: string) {
  const params = new URLSearchParams(hash.slice(1));
  const draft = normalizeDraft(params.get(DRAFT_FIELD) ?? "");
  return draft.length >= 3 ? draft : null;
}
