import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const resolvedRedirectPath = redirectPath ?? (redirectOnUnauthenticated ? getLoginUrl() : "/");
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
    await nextAuthSignOut({ callbackUrl: "/" });
  }, [utils]);

  const state = useMemo(() => {
    // User data is kept in React state only; session persistence is handled
    // by the server via httpOnly cookies — no localStorage needed.
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === resolvedRedirectPath) return;

    window.location.href = resolvedRedirectPath
  }, [
    redirectOnUnauthenticated,
    resolvedRedirectPath,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
