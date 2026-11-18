export const DEMO_WORKSPACE_PATH = "/workspace?from=demo";

const DEMO_PROMPT_KEY = "dreamforgex-demo-image-prompt";

function normalizedPrompt(value: string | null): string | null {
  const prompt = value?.trim();
  return prompt && prompt.length >= 3 && prompt.length <= 500 ? prompt : null;
}

export function saveDemoImagePrompt(value: string): boolean {
  const prompt = normalizedPrompt(value);
  if (!prompt) return false;
  try {
    window.sessionStorage.setItem(DEMO_PROMPT_KEY, prompt);
    return true;
  } catch {
    return false;
  }
}

export function takeDemoImagePrompt(): string | null {
  try {
    const prompt = window.sessionStorage.getItem(DEMO_PROMPT_KEY);
    window.sessionStorage.removeItem(DEMO_PROMPT_KEY);
    return normalizedPrompt(prompt);
  } catch {
    return null;
  }
}
