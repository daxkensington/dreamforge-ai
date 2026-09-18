"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

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
    const value = Number(params.get("value")) || 0;
    const currency = params.get("currency") || "usd";
    const credits = params.get("credits");
    window.fbq("track", "Purchase", {
      value,
      currency: currency.toUpperCase(),
      content_type: "product",
      content_ids: credits ? [credits] : [],
    });
    markSeen(flagKey);
  }, []);

  return null;
}
