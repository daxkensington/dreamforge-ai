"use client";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  degraded: "Degraded",
  offline: "Offline",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/10 text-green-400 border-green-500/30",
  degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  offline: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function ToolStatusAdmin() {
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading, refetch } = trpc.toolStatus.listAdmin.useQuery();
  const [newToolId, setNewToolId] = useState("");

  const [providerHealth, setProviderHealth] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const setStatus = trpc.toolStatus.set.useMutation({
    onSuccess: () => {
      utils.toolStatus.listAdmin.invalidate();
      utils.toolStatus.listPublic.invalidate();
      toast.success("Tool status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const clearStatus = trpc.toolStatus.clear.useMutation({
    onSuccess: () => {
      utils.toolStatus.listAdmin.invalidate();
      utils.toolStatus.listPublic.invalidate();
      toast.success("Override cleared — tool is active");
    },
  });

  async function refreshProviders() {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/status/providers");
      setProviderHealth(await res.json());
    } catch (e: any) {
      toast.error("Failed to fetch provider health");
    } finally {
      setLoadingHealth(false);
    }
  }

  const sorted = useMemo(() => {
    const weight: Record<string, number> = { offline: 0, degraded: 1, active: 2 };
    return [...rows].sort((a, b) => (weight[a.status] ?? 9) - (weight[b.status] ?? 9));
  }, [rows]);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tool Kill-Switch</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Mark a tool as <strong>offline</strong> to block new generations (users keep credits) or
          <strong> degraded</strong> to warn users before they submit.
        </p>
      </div>

      {/* Provider health snapshot */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Provider Health</CardTitle>
          <Button size="sm" variant="outline" onClick={refreshProviders} disabled={loadingHealth}>
            <RefreshCw className={`size-3.5 mr-2 ${loadingHealth ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {!providerHealth ? (
            <p className="text-sm text-zinc-500">Click Refresh to probe RunPod, Replicate, fal.ai, Runway, Kling.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {providerHealth.checks?.map((c: any) => {
                const state = !c.configured ? "unconfigured" : c.ok ? "ok" : "down";
                const color =
                  state === "ok"
                    ? "border-green-500/40 bg-green-500/5"
                    : state === "down"
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-zinc-700 bg-zinc-900/30";
                return (
                  <div key={c.name} className={`rounded border px-3 py-2 ${color}`}>
                    <div className="flex items-center gap-2">
                      {state === "ok" && <CheckCircle2 className="size-4 text-green-400" />}
                      {state === "down" && <XCircle className="size-4 text-red-400" />}
                      {state === "unconfigured" && <AlertTriangle className="size-4 text-zinc-500" />}
                      <span className="text-sm font-medium capitalize">{c.name}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {!c.configured ? "not configured" : c.ok ? `${c.latencyMs}ms` : c.error ?? "down"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current overrides */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Overrides</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No overrides — every tool is in its default <Badge variant="outline">active</Badge> state.
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((row: any) => (
                <div key={row.toolId} className="flex items-center gap-3 border border-zinc-800 rounded p-3">
                  <code className="text-sm font-mono text-zinc-200 min-w-[140px]">{row.toolId}</code>
                  <span className={`px-2 py-0.5 text-xs rounded border ${STATUS_COLOR[row.status]}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                  <span className="text-xs text-zinc-500 flex-1 truncate">{row.message || ""}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => clearStatus.mutate({ toolId: row.toolId })}
                  >
                    Reset
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/edit override */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Set Override</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Tool ID (e.g. text-to-image, upscale, text-to-video)"
              value={newToolId}
              onChange={(e) => setNewToolId(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                newToolId &&
                setStatus.mutate({
                  toolId: newToolId.trim(),
                  status: "degraded",
                  message: "Slower than usual — try again or pick a different model.",
                })
              }
              className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
            >
              Mark Degraded
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                newToolId &&
                setStatus.mutate({
                  toolId: newToolId.trim(),
                  status: "offline",
                  message: "Tool is temporarily offline — no credits will be charged.",
                })
              }
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              Mark Offline
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                newToolId &&
                setStatus.mutate({
                  toolId: newToolId.trim(),
                  status: "active",
                  message: null as any,
                })
              }
              className="border-green-500/40 text-green-400 hover:bg-green-500/10"
            >
              Mark Active
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Changes propagate within 30 seconds of the next request (cache TTL). Offline tools return an error
            before credits are debited; degraded tools run normally but the UI surfaces a banner.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
