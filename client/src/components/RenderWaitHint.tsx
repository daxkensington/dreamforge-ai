"use client";

import { useEffect, useState } from "react";

/** Per-click idempotency key — a transport retry re-sends the same body. */
export function newRequestId(): string {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Honest wait copy for a GPU render. Wall time is dominated by the worker
 * waking up (weights load on a fresh container); a bare spinner gave no clue
 * whether a minute was normal, and people who gave up never saw the image the
 * job still produced.
 */
export default function RenderWaitHint({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  return (
    <p className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
      Rendering on our own GPU · {secs}s. Usually under a minute; a couple of minutes if the GPU is waking up.
      You can leave this tab — it&apos;s saved to your library when it&apos;s done.
    </p>
  );
}
