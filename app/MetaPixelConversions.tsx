"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";

declare global {
  interface Window {
    fbq?: (event: string, name: string, params?: Record<string, unknown>) => void;
  }
}

export function MetaPixelConversions() {
  const { data: session, status } = useSession();

  // Lead + CompleteRegistration on first sight of an authenticated user
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    if (typeof window === "undefined" || !window.fbq) return;
    const flagKey = `df_meta_signup_${session.user.id}`;
    if (localStorage.getItem(flagKey)) return;
    window.fbq("track", "Lead");
    window.fbq("track", "CompleteRegistration");
    localStorage.setItem(flagKey, "1");
  }, [status, session?.user?.id]);

  // Purchase on Stripe success redirect
  useEffect(() => {
    if (typeof window === "undefined" || !window.fbq) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") !== "true") return;
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    const flagKey = `df_meta_purchase_${sessionId}`;
    if (localStorage.getItem(flagKey)) return;
    const value = Number(params.get("value")) || 0;
    const currency = params.get("currency") || "usd";
    const credits = params.get("credits");
    window.fbq("track", "Purchase", {
      value,
      currency: currency.toUpperCase(),
      content_type: "product",
      content_ids: credits ? [credits] : [],
    });
    localStorage.setItem(flagKey, "1");
  }, []);

  return null;
}
