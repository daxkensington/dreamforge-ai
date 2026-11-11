"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { track, validGaMeasurementId } from "@/lib/analytics";

const GA_ID = validGaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

/**
 * First-party page views + optional GA4 loader when NEXT_PUBLIC_GA_MEASUREMENT_ID
 * is set to a valid G-XXXX measurement ID. When unset, renders nothing so
 * current production HTML and network requests stay 100% unchanged.
 */
export function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    track("page_view");
  }, [pathname]);

  if (!GA_ID) return null;

  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />;
}
