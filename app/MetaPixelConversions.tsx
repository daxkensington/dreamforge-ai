"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

declare global {
  interface Window {
    fbq?: (event: string, name: string, params?: Record<string, unknown>) => void;
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

  // Lead + CompleteRegistration on first sight of an authenticated user
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (typeof window === "undefined" || !window.fbq) return;
    const flagKey = `df_meta_signup_${session.user.id}`;
    if (flagSeen(flagKey)) return;
    window.fbq("track", "Lead");
    window.fbq("track", "CompleteRegistration");
    // First-party mirror of the pixel events — signup_completed is defined in
    // analytics.ts but was never fired. The same localStorage flag keeps it
    // to exactly once per user id.
    track("signup_completed", { userId: session.user.id });
    markSeen(flagKey);
  }, [status, session?.user?.id]);

  // Purchase on Stripe success redirect
  useEffect(() => {
    if (typeof window === "undefined" || !window.fbq) return;
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
  }, []);

  return null;
}
