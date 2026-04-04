"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount.
 * Placed in the provider tree so it runs once on app load.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // SW registration failed — silently ignore (e.g. localhost without HTTPS)
      });
  }, []);

  return null;
}
