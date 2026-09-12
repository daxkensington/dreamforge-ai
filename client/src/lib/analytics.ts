/**
 * First-party funnel tracking.
 *
 * Deliberately not a React hook so it can be called from anywhere — event
 * handlers, mutation callbacks, plain modules. Every path is wrapped: a
 * measurement failure must never surface to the visitor being measured.
 */

export type TrackedEvent =
  | "page_view"
  | "signup_started"
  | "signup_completed"
  | "studio_opened"
  | "generation_started"
  | "generation_completed"
  | "paywall_viewed"
  | "checkout_started"
  | "checkout_completed";

const ANON_KEY = "dfx_anon_id";
const ATTR_KEY = "dfx_first_touch";

/**
 * Safari with storage blocked THROWS on property access, so `typeof
 * localStorage` is not a usable guard — only try/catch is.
 */
function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage — tracking degrades, page does not */
  }
}

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

/** Stable per-browser id so a visitor can be followed across the signup boundary. */
export function getAnonId(): string {
  let id = safeGet(ANON_KEY);
  if (!id) {
    id = randomId();
    safeSet(ANON_KEY, id);
  }
  return id;
}

type FirstTouch = {
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

/**
 * Where this visitor originally came from. Captured once and kept, because by
 * the time someone signs up or pays, `document.referrer` is long gone.
 */
export function getFirstTouch(): FirstTouch {
  const stored = safeGet(ATTR_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as FirstTouch;
    } catch {
      /* fall through and recapture */
    }
  }
  const params = new URLSearchParams(window.location.search);
  const touch: FirstTouch = {};
  const ref = document.referrer;
  if (ref && !ref.includes(window.location.host)) touch.referrer = ref.slice(0, 512);
  const src = params.get("utm_source");
  const med = params.get("utm_medium");
  const camp = params.get("utm_campaign");
  if (src) touch.utmSource = src.slice(0, 128);
  if (med) touch.utmMedium = med.slice(0, 128);
  if (camp) touch.utmCampaign = camp.slice(0, 128);
  safeSet(ATTR_KEY, JSON.stringify(touch));
  return touch;
}

/** Fire-and-forget. Never rejects, never blocks rendering. */
export function track(event: TrackedEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const touch = getFirstTouch();
    const body = JSON.stringify({
      json: {
        anonId: getAnonId(),
        event,
        path: window.location.pathname.slice(0, 512),
        ...touch,
        ...(props ? { props } : {}),
      },
    });
    void fetch("/api/trpc/analytics.track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let measurement break the page */
  }
}
