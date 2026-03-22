/**
 * Wouter compatibility shim for Next.js migration.
 *
 * Maps wouter's API to Next.js equivalents so existing imports
 * (aliased via tsconfig "paths") keep working without touching 20+ files.
 */
"use client";

import { usePathname, useRouter, useParams as useNextParams } from "next/navigation";
import { useCallback, useMemo } from "react";

// Re-export Next.js Link directly — both wouter and Next.js use the `href` prop.
export { default as Link } from "next/link";

/**
 * wouter's useLocation returns [pathname, navigate].
 * - pathname is a string
 * - navigate(path) pushes a new route
 */
export function useLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const pathname = usePathname();
  const router = useRouter();

  const navigate = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      if (options?.replace) {
        router.replace(to);
      } else {
        router.push(to);
      }
    },
    [router],
  );

  return useMemo(() => [pathname, navigate], [pathname, navigate]);
}

/**
 * wouter's useParams returns an object of matched route params.
 * Next.js useParams returns the same shape, but values can be string | string[].
 * We cast to a plain Record<string, string> to match wouter's typing.
 */
export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  const params = useNextParams();
  return params as unknown as T;
}

/**
 * wouter's useRoute is not used in this codebase, but we export a stub
 * that always returns [true, params] so any stray imports don't break.
 */
export function useRoute(_pattern?: string): [boolean, Record<string, string>] {
  const params = useNextParams();
  return [true, params as unknown as Record<string, string>];
}

/**
 * wouter's Route and Switch are client-side routing primitives that
 * are replaced by Next.js App Router file-based routing.
 * These no-ops prevent import errors in files that still reference them.
 */
export function Route({ children }: { children?: React.ReactNode }) {
  return children ?? null;
}

export function Switch({ children }: { children?: React.ReactNode }) {
  return children ?? null;
}
