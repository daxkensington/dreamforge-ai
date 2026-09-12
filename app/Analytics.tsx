"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * First-party page views. The Meta Pixel already fires PageView, but it is
 * ad-attribution: blocked for a large share of visitors and not queryable, so
 * it cannot answer "where in the funnel do people stop".
 */
export function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    track("page_view");
  }, [pathname]);

  return null;
}
