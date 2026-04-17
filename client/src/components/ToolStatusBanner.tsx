"use client";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, XCircle } from "lucide-react";

/**
 * Inline banner for a specific tool page. Reads toolStatus.listPublic
 * (which only returns rows NOT in "active" state) and shows a yellow
 * degraded or red offline banner. Renders nothing when the tool is active.
 *
 * Usage on a tool page:
 *   <ToolStatusBanner toolId="upscale" />
 */
export function ToolStatusBanner({ toolId }: { toolId: string }) {
  const { data } = trpc.toolStatus.listPublic.useQuery(undefined, {
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const row = data?.find((r: any) => r.toolId === toolId);
  if (!row) return null;

  const isOffline = row.status === "offline";
  const color = isOffline
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  const Icon = isOffline ? XCircle : AlertTriangle;
  const label = isOffline ? "Temporarily offline" : "Degraded service";
  const defaultMsg = isOffline
    ? "This tool is paused while we investigate an issue. No credits will be charged."
    : "This tool may be slower or less reliable than usual. You can still submit — your credits are refunded on failure.";

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${color}`} role="status">
      <Icon className="size-4 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="font-medium">{label}</div>
        <p className="text-xs mt-1 opacity-90">{row.message || defaultMsg}</p>
      </div>
    </div>
  );
}
