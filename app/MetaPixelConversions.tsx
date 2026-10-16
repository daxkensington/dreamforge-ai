"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (event: string, name: string, params?: Record<string, unknown>) => void;
    __dfFbqReady?: boolean;
  }
}

/**
 * Safari with site data blocked THROWS on localStorage access. These run inside
 * useEffect, so an unguarded throw takes out the effect (and, on iOS, has broken
 * whole storefronts before). Guard with try/catch — a `typeof localStorage`
 * check does NOT help against a throwing getter.
 */
function flagSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
function markSeen(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* blocked storage — the pixel may double-count, the page still works */
  }
}

export function MetaPixelConversions() {
  const { data: session, status } = useSession();
  const [pixelReady, setPixelReady] = useState(false);

  // The afterInteractive pixel script can run after these effects, so wait for it.
  useEffect(() => {
    if (typeof window.fbq === "function") {
      setPixelReady(true);
      return;
    }
    const markReady = () => setPixelReady(true);
    window.addEventListener("df:fbq-ready", markReady);
    const interval = window.setInterval(() => {
      if (typeof window.fbq === "function") {
        markReady();
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      }
    }, 250);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 10000);
    return () => {
      window.removeEventListener("df:fbq-ready", markReady);
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);

  // Lead + CompleteRegistration on first sight of an authenticated user
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const id = session.user.id;
    const signupFlagKey = `df_signup_tracked_${id}`;
    const pixelFlagKey = `df_meta_signup_${id}`;
    // Separate flags let first-party signup tracking run without the pixel.
    // The legacy pixel flag also suppresses signups already counted under it.
    if (!flagSeen(signupFlagKey) && !flagSeen(pixelFlagKey)) {
      track("signup_completed", { userId: id });
      markSeen(signupFlagKey);
    }
    if (
      typeof window !== "undefined" &&
      pixelReady &&
      window.fbq &&
      !flagSeen(pixelFlagKey)
    ) {
      window.fbq("track", "Lead");
      window.fbq("track", "CompleteRegistration");
      markSeen(pixelFlagKey);
    }
  }, [status, session?.user?.id, pixelReady]);

  // Purchase on Stripe success redirect
  useEffect(() => {
    if (typeof window === "undefined" || !pixelReady || !window.fbq) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") !== "true") return;
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    const flagKey = `df_meta_purchase_${sessionId}`;
    if (flagSeen(flagKey)) return;
    // Server-side success URLs append value/currency/credits. Parse
    // defensively: a missing or non-numeric value becomes 0, a missing or
    // malformed currency falls back to USD — Purchase still fires (deduped
    // by session_id) so the conversion is never dropped.
    const rawValue = params.get("value");
    const parsedValue = rawValue === null ? Number.NaN : Number(rawValue);
    const value = Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
    const rawCurrency = params.get("currency");
    const currency = rawCurrency && /^[a-z]{3}$/i.test(rawCurrency) ? rawCurrency.toUpperCase() : "USD";
    const credits = params.get("credits");
    window.fbq("track", "Purchase", {
      value,
      currency,
      content_type: "product",
      content_ids: credits ? [credits] : [],
    });
    markSeen(flagKey);
  }, [pixelReady]);

  return null;
}
