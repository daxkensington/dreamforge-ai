"use client";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

/**
 * Sitewide banner — shows when ANY tool is currently degraded or offline.
 * Mounted in the tools layout so every tool page carries the warning.
 * Dismissible per-session so it doesn't nag on every navigation, but
 * re-appears when new statuses flip or the page is reloaded.
 */
export function GlobalToolStatusBanner() {
  const { data } = trpc.toolStatus.listPublic.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const offline = useMemo(() => (data ?? []).filter((r: any) => r.status === "offline"), [data]);
  const degraded = useMemo(() => (data ?? []).filter((r: any) => r.status === "degraded"), [data]);

  const signature = useMemo(
    () => (data ?? []).map((r: any) => `${r.toolId}:${r.status}`).join("|"),
    [data],
  );

  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!signature || (offline.length === 0 && degraded.length === 0)) return null;
  if (dismissed === signature) return null;

  const primary = offline.length > 0 ? offline[0] : degraded[0];
  const isOffline = primary.status === "offline";
  const color = isOffline
    ? "bg-red-500/15 border-red-500/40 text-red-100"
    : "bg-yellow-500/15 border-yellow-500/40 text-yellow-100";
  const Icon = isOffline ? XCircle : AlertTriangle;

  const others = offline.length + degraded.length - 1;
  const otherText = others > 0 ? ` · +${others} more` : "";

  return (
    <div className={`border-b ${color} px-4 py-2`}>
      <div className="container mx-auto flex items-center gap-3 text-sm">
        <Icon className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">
            {isOffline ? "Tool offline: " : "Tool degraded: "}
            <code className="font-mono text-xs">{primary.toolId}</code>
          </span>
          {primary.message && <span className="opacity-90"> — {primary.message}</span>}
          <span className="opacity-75">{otherText}</span>
        </div>
        <button
          onClick={() => setDismissed(signature)}
          className="text-xs opacity-70 hover:opacity-100 shrink-0"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
