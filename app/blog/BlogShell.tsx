"use client";

import PageLayout from "@/components/PageLayout";

/**
 * Client boundary for the site chrome only. Blog content is passed in as
 * children from a server component, so the article text stays in the server-
 * rendered HTML where crawlers can read it.
 */
export function BlogShell({ children }: { children: React.ReactNode }) {
  return <PageLayout>{children}</PageLayout>;
}
