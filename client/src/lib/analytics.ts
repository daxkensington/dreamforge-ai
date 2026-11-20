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
  // The tRPC call returned a Stripe URL and the browser was sent there. The gap
  // checkout_started -> checkout_redirected is our side failing; the gap
  // checkout_redirected -> checkout_completed is the buyer leaving Stripe.
  | "checkout_redirected"
  // Stripe sent the buyer back via cancel_url (the Back arrow on the hosted page).
  | "checkout_canceled"
  | "checkout_frame_blocked"
  | "checkout_completed";

const ANON_KEY = "dfx_anon_id";
const ATTR_KEY = "dfx_first_touch";
const GA_ID_PATTERN = /^G-[A-Z0-9]+$/;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __dfxGaConfiguredId?: string;
  }
}

export function validGaMeasurementId(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim() ?? "";
  return GA_ID_PATTERN.test(trimmed) ? trimmed : null;
}

export type GaEventPayload = {
  name: "page_view" | "sign_up" | "begin_checkout" | "purchase";
  params: Record<string, string | number>;
};

/**
 * Maps internal funnel events to GA4 standard events while stripping PII/userIds
 * and query strings. Exported for unit testing.
 */
export function buildGa4Event(
  event: TrackedEvent,
  props?: Record<string, unknown>,
  loc?: { origin?: string; pathname?: string; search?: string },
): GaEventPayload | null {
  if (event === "page_view") {
    const pathname = (loc?.pathname || "/").slice(0, 512);
    const origin = loc?.origin || "";
    return {
      name: "page_view",
      params: {
        page_path: pathname,
        ...(origin ? { page_location: `${origin}${pathname}` } : {}),
      },
    };
  }
  if (event === "signup_completed") {
    // Deliberately omit props.userId so internal account IDs never go to GA4.
    return { name: "sign_up", params: {} };
  }
  if (event === "checkout_started") {
    const params: Record<string, string | number> = {};
    if (typeof props?.kind === "string" && /^[a-z0-9_-]{1,32}$/i.test(props.kind)) {
      params.item_category = props.kind;
    }
    if (typeof props?.surface === "string" && /^[a-z0-9_-]{1,32}$/i.test(props.surface)) {
      params.surface = props.surface;
    }
    return { name: "begin_checkout", params };
  }
  if (event === "checkout_completed") {
    const searchParams = new URLSearchParams(loc?.search ?? "");
    const rawValue = typeof props?.value === "number" ? props.value : Number(searchParams.get("value") ?? "NaN");
    const value = Number.isFinite(rawValue) && rawValue >= 0 ? rawValue : 0;
    const rawCurrency =
      typeof props?.currency === "string" ? props.currency : (searchParams.get("currency") ?? "USD");
    const currency = /^[a-z]{3}$/i.test(rawCurrency) ? rawCurrency.toUpperCase() : "USD";
    const rawSessionId =
      typeof props?.transactionId === "string" ? props.transactionId : (searchParams.get("session_id") ?? "");
    const params: Record<string, string | number> = { value, currency };
    if (/^[A-Za-z0-9_-]{4,128}$/.test(rawSessionId)) {
      params.transaction_id = rawSessionId;
    }
    if (typeof props?.kind === "string" && /^[a-z0-9_-]{1,32}$/i.test(props.kind)) {
      params.item_category = props.kind;
    }
    if (typeof props?.surface === "string" && /^[a-z0-9_-]{1,32}$/i.test(props.surface)) {
      params.surface = props.surface;
    }
    return { name: "purchase", params };
  }
  return null;
}

function forwardToGa4(event: TrackedEvent, props?: Record<string, unknown>): void {
  const gaId = validGaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  if (!gaId || typeof window === "undefined") return;
  const mapped = buildGa4Event(event, props, window.location);
  if (!mapped) return;
  if (mapped.name === "purchase" && typeof mapped.params.transaction_id === "string") {
    const dedupeKey = `dfx_ga4_purchase_${mapped.params.transaction_id}`;
    if (safeGet(dedupeKey) !== null) return;
    safeSet(dedupeKey, "1");
  }
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  if (window.__dfxGaConfiguredId !== gaId) {
    window.gtag("js", new Date());
    window.gtag("config", gaId, { send_page_view: false });
    window.__dfxGaConfiguredId = gaId;
  }
  window.gtag("event", mapped.name, mapped.params);
}

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
    forwardToGa4(event, props);
  } catch {
    /* never let GA4 forwarding break first-party measurement or the page */
  }
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
