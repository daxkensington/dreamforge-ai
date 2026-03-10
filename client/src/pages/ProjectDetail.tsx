import { useState, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { exportStoryboardPdf, exportScriptPdf } from "@/lib/pdfExport";
import {
  ArrowLeft,
  Share2,
  Users,
  History,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Trash2,
  RotateCcw,
  Download,
  Eye,
  Edit3,
  Clock,
  User,
  Link2,
  Shield,
  AlertTriangle,
  Clapperboard,
  FileText,
  Camera,
  Music,
  ChevronRight,
  GitBranch,
  Wand2,
  ArrowRight,
  X,
} from "lucide-react";

// ─── Share Dialog ─────────────────────────────────────────────────
function ShareDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [permission, setPermission] = useState<"viewer" | "editor">("viewer");
  const [expiresInHours, setExpiresInHours] = useState("168"); // 7 days
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const createLink = trpc.videoProject.createShareLink.useMutation({
    onSuccess: () => {
      utils.videoProject.listShareTokens.invalidate({ projectId });
      toast.success("Share link created!");
    },
    onError: () => toast.error("Failed to create share link"),
  });

  const { data: tokens, isLoading: tokensLoading } =
    trpc.videoProject.listShareTokens.useQuery({ projectId }, { enabled: open });

  const { data: collaborators, isLoading: collabLoading } =
    trpc.videoProject.listCollaborators.useQuery(
      { projectId },
      { enabled: open }
    );

  const deactivateToken = trpc.videoProject.deactivateShareToken.useMutation({
    onSuccess: () => {
      utils.videoProject.listShareTokens.invalidate({ projectId });
      toast.success("Share link deactivated");
    },
  });

  const removeCollab = trpc.videoProject.removeCollaborator.useMutation({
    onSuccess: () => {
      utils.videoProject.listCollaborators.invalidate({ projectId });
      toast.success("Collaborator removed");
    },
  });

  const handleCreate = () => {
    createLink.mutate({
      projectId,
      permission,
      expiresInHours: parseInt(expiresInHours),
    });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/video-studio/join/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
    toast.success("Link copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-violet-400" /> Share Project
          </DialogTitle>
          <DialogDescription>
            Create invite links to share this project with collaborators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new link */}
          <div className="border border-border/50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-foreground">
              Create Share Link
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Permission
                </label>
                <Select
                  value={permission}
                  onValueChange={(v) =>
                    setPermission(v as "viewer" | "editor")
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3 h-3" /> Viewer
                      </span>
                    </SelectItem>
                    <SelectItem value="editor">
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="w-3 h-3" /> Editor
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Expires In
                </label>
                <Select
                  value={expiresInHours}
                  onValueChange={setExpiresInHours}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="72">3 days</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createLink.isPending}
              size="sm"
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600"
            >
              {createLink.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Generate Link
            </Button>
          </div>

          {/* Active links */}
          {tokensLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : tokens && tokens.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">
                Active Links
              </h4>
              {tokens.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3 border border-border/40 rounded-lg bg-background/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      className={`text-xs ${t.permission === "editor" ? "text-amber-400 border-amber-500/40" : "text-blue-400 border-blue-500/40"}`}
                    >
                      {t.permission === "editor" ? (
                        <Edit3 className="w-3 h-3 mr-1" />
                      ) : (
                        <Eye className="w-3 h-3 mr-1" />
                      )}
                      {t.permission}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.useCount} uses
                    </span>
                    {t.expiresAt && (
                      <span className="text-xs text-muted-foreground/60">
                        Expires{" "}
                        {new Date(t.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => copyLink(t.token)}
                    >
                      {copiedToken === t.token ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={() => deactivateToken.mutate({ tokenId: t.id })}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Collaborators */}
          {collabLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : collaborators && collaborators.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" /> Collaborators (
                {collaborators.length})
              </h4>
              {collaborators.map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border border-border/40 rounded-lg bg-background/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {c.userName || "Unknown User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.userEmail || `User #${c.userId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${c.role === "editor" ? "text-amber-400" : "text-blue-400"}`}
                    >
                      {c.role}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={() =>
                        removeCollab.mutate({
                          collaboratorId: c.id,
                          projectId,
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground/60 text-xs">
              No collaborators yet. Share a link to invite people.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Version History Panel ────────────────────────────────────────
function VersionHistoryPanel({
  projectId,
  currentData,
  isOwner,
}: {
  projectId: number;
  currentData: any;
  isOwner: boolean;
}) {
  const [selectedRevision, setSelectedRevision] = useState<any>(null);
  const [compareMode, setCompareMode] = useState(false);
  const utils = trpc.useUtils();

  const { data: revisions, isLoading } =
    trpc.videoProject.listRevisions.useQuery({ projectId });

  const revert = trpc.videoProject.revertToRevision.useMutation({
    onSuccess: (data) => {
      utils.videoProject.get.invalidate({ id: projectId });
      utils.videoProject.listRevisions.invalidate({ projectId });
      toast.success(`Reverted to version ${data.revertedToVersion}`);
      setSelectedRevision(null);
    },
    onError: () => toast.error("Failed to revert"),
  });

  const getRevision = trpc.videoProject.getRevision.useQuery(
    { revisionId: selectedRevision?.id ?? 0, projectId },
    { enabled: !!selectedRevision }
  );

  const sourceColors: Record<string, string> = {
    manual: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    "ai-refinement": "text-purple-400 bg-purple-500/10 border-purple-500/30",
    revert: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    template: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  };

  const sourceIcons: Record<string, React.ReactNode> = {
    manual: <Edit3 className="w-3 h-3" />,
    "ai-refinement": <Sparkles className="w-3 h-3" />,
    revert: <RotateCcw className="w-3 h-3" />,
    template: <FileText className="w-3 h-3" />,
  };

  // Simple diff: count changes in JSON keys
  const computeDiff = (oldData: any, newData: any): string => {
    if (!oldData || !newData) return "No comparison available";
    const oldStr = JSON.stringify(oldData, null, 2);
    const newStr = JSON.stringify(newData, null, 2);
    if (oldStr === newStr) return "No changes";
    const oldLines = oldStr.split("\n");
    const newLines = newStr.split("\n");
    const changed = Math.abs(oldLines.length - newLines.length);
    return `~${Math.max(changed, 1)} lines changed`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <History className="w-4 h-4 text-violet-400" /> Version History
        </h3>
        <Badge variant="outline" className="text-xs">
          {revisions?.length || 0} revisions
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      ) : revisions && revisions.length > 0 ? (
        <div className="space-y-1">
          {revisions.map((rev: any, idx: number) => (
            <div
              key={rev.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                selectedRevision?.id === rev.id
                  ? "border-violet-500/50 bg-violet-500/5"
                  : "border-border/30 bg-background/20 hover:border-border/60"
              }`}
              onClick={() =>
                setSelectedRevision(
                  selectedRevision?.id === rev.id ? null : rev
                )
              }
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center gap-1 self-stretch">
                <div
                  className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    idx === 0
                      ? "border-violet-400 bg-violet-400"
                      : "border-border bg-background"
                  }`}
                />
                {idx < revisions.length - 1 && (
                  <div className="w-px flex-1 bg-border/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-foreground/80">
                    v{rev.version}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${sourceColors[rev.source] || ""}`}
                  >
                    {sourceIcons[rev.source]} {rev.source}
                  </Badge>
                  {idx === 0 && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-violet-500/20 text-violet-300">
                      Latest
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {rev.changeNote || "No description"}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/60">
                  <span>{rev.userName || "Unknown"}</span>
                  <span>
                    {new Date(rev.createdAt).toLocaleDateString()}{" "}
                    {new Date(rev.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {isOwner && idx > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-violet-400 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Revert to version ${rev.version}? Current data will be saved as a new revision.`
                      )
                    ) {
                      revert.mutate({
                        revisionId: rev.id,
                        projectId,
                      });
                    }
                  }}
                  disabled={revert.isPending}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Revert
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-border/40 rounded-xl">
          <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            No revisions yet. Save changes to start tracking history.
          </p>
        </div>
      )}

      {/* Revision detail view */}
      {selectedRevision && getRevision.data && (
        <div className="border border-violet-500/30 rounded-xl p-4 bg-violet-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              Version {selectedRevision.version} Details
            </h4>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setCompareMode(!compareMode)}
            >
              <GitBranch className="w-3 h-3 mr-1" />{" "}
              {compareMode ? "Hide Diff" : "Compare with Current"}
            </Button>
          </div>

          {compareMode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Version {selectedRevision.version}
                </p>
                <pre className="text-[10px] text-muted-foreground bg-background/50 rounded-lg p-3 max-h-60 overflow-auto font-mono">
                  {JSON.stringify(getRevision.data.data, null, 2).slice(
                    0,
                    2000
                  )}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Current
                </p>
                <pre className="text-[10px] text-muted-foreground bg-background/50 rounded-lg p-3 max-h-60 overflow-auto font-mono">
                  {JSON.stringify(currentData, null, 2).slice(0, 2000)}
                </pre>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {computeDiff(getRevision.data.data, currentData)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AI Refinement Panel ──────────────────────────────────────────
function AIRefinementPanel({
  projectId,
  projectType,
}: {
  projectId: number;
  projectType: string;
}) {
  const [feedback, setFeedback] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const utils = trpc.useUtils();

  const refine = trpc.videoProject.refineProject.useMutation({
    onSuccess: () => setShowResults(true),
    onError: () => toast.error("Refinement failed. Please try again."),
  });

  const applyRefinement = trpc.videoProject.applyRefinement.useMutation({
    onSuccess: () => {
      utils.videoProject.get.invalidate({ id: projectId });
      utils.videoProject.listRevisions.invalidate({ projectId });
      toast.success("Refinement applied and saved as new version!");
      setShowResults(false);
      setFeedback("");
      setFocusAreas([]);
    },
    onError: () => toast.error("Failed to apply refinement"),
  });

  const focusOptions =
    projectType === "storyboard"
      ? [
          "Visual composition",
          "Scene transitions",
          "Pacing",
          "Camera work",
          "Narrative flow",
          "Mood consistency",
          "Color palette",
        ]
      : projectType === "script"
        ? [
            "Dialogue quality",
            "Scene descriptions",
            "Pacing",
            "Character development",
            "Narration",
            "Production notes",
            "Sound design",
          ]
        : [
            "Overall quality",
            "Detail level",
            "Consistency",
            "Creativity",
            "Technical accuracy",
          ];

  const toggleFocus = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">
          AI Refinement
        </h3>
      </div>

      {!showResults ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground/80 mb-1.5 block">
              What would you like to improve?
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g., 'Make the transitions smoother', 'Add more dramatic tension in scene 3', 'Improve the camera work descriptions'..."
              className="min-h-[100px] bg-background/50 border-border/50 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground/80 mb-2 block">
              Focus Areas (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {focusOptions.map((area) => (
                <button
                  key={area}
                  onClick={() => toggleFocus(area)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                    focusAreas.includes(area)
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-background/30 text-muted-foreground border border-border/40 hover:border-amber-500/30"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() =>
              refine.mutate({
                projectId,
                feedback,
                focusAreas: focusAreas.length > 0 ? focusAreas : undefined,
              })
            }
            disabled={feedback.trim().length < 5 || refine.isPending}
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          >
            {refine.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Refining
                with AI...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" /> Refine with AI
              </>
            )}
          </Button>

          {refine.isPending && (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground animate-pulse">
                AI is analyzing your project and generating improvements...
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">
                This may take 10-30 seconds
              </p>
            </div>
          )}
        </div>
      ) : refine.data ? (
        <div className="space-y-4">
          {refine.data.status === "completed" ? (
            <>
              <div className="border border-emerald-500/30 rounded-xl p-4 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-medium text-foreground">
                    Refinement Complete
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI has generated an improved version of your{" "}
                  {refine.data.projectType}. Review the changes below and apply
                  them to update your project.
                </p>
              </div>

              {/* Side-by-side preview */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Original
                  </p>
                  <pre className="text-[10px] text-muted-foreground bg-background/50 rounded-lg p-3 max-h-80 overflow-auto font-mono border border-border/30">
                    {JSON.stringify(refine.data.originalData, null, 2).slice(
                      0,
                      3000
                    )}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-1">
                    Refined
                  </p>
                  <pre className="text-[10px] text-amber-300/80 bg-amber-500/5 rounded-lg p-3 max-h-80 overflow-auto font-mono border border-amber-500/20">
                    {JSON.stringify(refine.data.refinedData, null, 2).slice(
                      0,
                      3000
                    )}
                  </pre>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    applyRefinement.mutate({
                      projectId,
                      refinedData: refine.data!.refinedData,
                    })
                  }
                  disabled={applyRefinement.isPending}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600"
                >
                  {applyRefinement.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Apply Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowResults(false);
                  }}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" /> Discard
                </Button>
              </div>
            </>
          ) : (
            <div className="border border-red-500/30 rounded-xl p-4 bg-red-500/5 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-400" />
              <p className="text-sm text-foreground">Refinement Failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                The AI was unable to refine this project. Please try again with
                different feedback.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowResults(false)}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── Project Content Viewer ───────────────────────────────────────
function ProjectContentViewer({
  project,
}: {
  project: any;
}) {
  const data = project.data as any;
  const typeIcons: Record<string, React.ReactNode> = {
    storyboard: <Clapperboard className="w-5 h-5 text-violet-400" />,
    script: <FileText className="w-5 h-5 text-amber-400" />,
    "scene-direction": <Camera className="w-5 h-5 text-cyan-400" />,
    soundtrack: <Music className="w-5 h-5 text-emerald-400" />,
  };

  const handleExportPdf = () => {
    if (project.type === "storyboard" && data?.scenes) {
      exportStoryboardPdf({
        title: data.title || project.title,
        synopsis: data.synopsis || "",
        totalDuration: data.totalDuration || "N/A",
        style: data.style || "cinematic",
        scenes: data.scenes,
      });
      toast.success("PDF downloaded");
    } else if (project.type === "script" && data?.scenes) {
      exportScriptPdf({
        title: data.title || project.title,
        logline: data.logline || "",
        targetDuration: data.targetDuration || "N/A",
        format: data.format || "narrative",
        tone: data.tone || "professional",
        scenes: data.scenes,
        equipmentNeeded: data.equipmentNeeded || [],
      });
      toast.success("PDF downloaded");
    } else {
      toast.info("PDF export is available for storyboards and scripts");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {typeIcons[project.type]}
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {project.title}
            </h3>
            {project.description && (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportPdf}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Export PDF
        </Button>
      </div>

      {/* Storyboard content */}
      {project.type === "storyboard" && data?.scenes && (
        <div className="space-y-3">
          {data.synopsis && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-violet-500/40 pl-3">
              {data.synopsis}
            </p>
          )}
          {data.scenes.map((scene: any, i: number) => (
            <div
              key={i}
              className="border border-border/40 rounded-xl overflow-hidden bg-background/20 hover:border-violet-500/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row">
                {scene.imageUrl && (
                  <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                    <img
                      src={scene.imageUrl}
                      alt={`Scene ${scene.sceneNumber}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-violet-500/20 text-violet-300 text-xs">
                      Scene {scene.sceneNumber}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {scene.duration}s
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90">
                    {scene.visualDescription}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                    <span>
                      <Camera className="w-3 h-3 inline mr-1" />
                      {scene.cameraAngle}
                    </span>
                    <span>{scene.cameraMovement}</span>
                    <span className="italic">{scene.mood}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Script content */}
      {project.type === "script" && data?.scenes && (
        <div className="space-y-3">
          {data.logline && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-amber-500/40 pl-3">
              "{data.logline}"
            </p>
          )}
          {data.scenes.map((scene: any, i: number) => (
            <div
              key={i}
              className="border border-border/40 rounded-xl p-4 bg-background/20 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-amber-500/20 text-amber-300 text-xs">
                  Scene {scene.sceneNumber}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">
                  {scene.startTime} — {scene.endTime}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-foreground/90">
                  {scene.visualDescription}
                </p>
                {scene.cameraDirection && (
                  <p className="text-xs text-muted-foreground">
                    <Camera className="w-3 h-3 inline mr-1" />
                    {scene.cameraDirection}
                  </p>
                )}
                {scene.narration && (
                  <p className="text-xs text-muted-foreground italic">
                    "{scene.narration}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scene direction content */}
      {project.type === "scene-direction" && data?.keyframes && (
        <div className="space-y-3">
          {data.overallDirection && (
            <p className="text-sm text-muted-foreground italic border-l-2 border-cyan-500/40 pl-3">
              {data.overallDirection}
            </p>
          )}
          {data.keyframes.map((kf: any, i: number) => (
            <div
              key={i}
              className="border border-border/40 rounded-xl overflow-hidden bg-background/20 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row">
                {kf.imageUrl && (
                  <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                    <img
                      src={kf.imageUrl}
                      alt={`Keyframe ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-cyan-500/20 text-cyan-300 text-xs">
                      KF {kf.keyframeNumber}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {kf.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90">
                    {kf.visualDescription}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                    <span>{kf.cameraPosition}</span>
                    <span>{kf.cameraMovement}</span>
                    <span>{kf.lighting}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Soundtrack content */}
      {project.type === "soundtrack" && data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.primaryGenre && (
              <div className="border border-border/40 rounded-lg p-3 bg-background/20">
                <p className="text-xs text-muted-foreground">Genre</p>
                <p className="text-sm font-medium text-foreground">
                  {data.primaryGenre}
                </p>
              </div>
            )}
            {data.bpm && (
              <div className="border border-border/40 rounded-lg p-3 bg-background/20">
                <p className="text-xs text-muted-foreground">BPM</p>
                <p className="text-sm font-medium text-foreground">
                  {data.bpm}
                </p>
              </div>
            )}
            {data.keySignature && (
              <div className="border border-border/40 rounded-lg p-3 bg-background/20">
                <p className="text-xs text-muted-foreground">Key</p>
                <p className="text-sm font-medium text-foreground">
                  {data.keySignature}
                </p>
              </div>
            )}
          </div>
          {data.referenceTracks?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground/80">
                Reference Tracks
              </h4>
              {data.referenceTracks.map((track: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 border border-border/40 rounded-lg bg-background/20"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {track.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {track.artist}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {track.reason}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback: raw JSON */}
      {!data?.scenes && !data?.keyframes && !data?.primaryGenre && (
        <pre className="text-xs text-muted-foreground bg-background/50 rounded-lg p-4 max-h-96 overflow-auto font-mono">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main Project Detail Page ─────────────────────────────────────
export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const projectId = parseInt(params.id || "0");

  // Try to load as owner first
  const {
    data: ownProject,
    isLoading: ownLoading,
    error: ownError,
  } = trpc.videoProject.get.useQuery(
    { id: projectId },
    { enabled: !!user && projectId > 0, retry: false }
  );

  // If not owner, try shared access
  const {
    data: sharedProject,
    isLoading: sharedLoading,
  } = trpc.videoProject.getShared.useQuery(
    { id: projectId },
    { enabled: !!user && projectId > 0 && !!ownError, retry: false }
  );

  const project = ownProject || sharedProject;
  const isLoading = ownLoading || (!!ownError && sharedLoading);
  const isOwner = !!ownProject;
  const accessRole = sharedProject?.accessRole || (isOwner ? "owner" : null);

  if (!user) {
    return (
      <PageLayout>
        <div className="container max-w-4xl py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Sign in to view this project
          </h1>
          <Button
            asChild
            className="bg-gradient-to-r from-violet-600 to-purple-600"
          >
            <a href={getLoginUrl()}>Sign In</a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container max-w-7xl py-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!project) {
    return (
      <PageLayout>
        <div className="container max-w-4xl py-20 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Project Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            This project doesn't exist or you don't have access.
          </p>
          <Button variant="outline" onClick={() => navigate("/video-studio")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Video Studio
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container max-w-7xl py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/video-studio")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {project.title}
                </h1>
                <Badge variant="outline" className="text-xs capitalize">
                  {project.type?.replace("-", " ")}
                </Badge>
                {accessRole && accessRole !== "owner" && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${accessRole === "editor" ? "text-amber-400 border-amber-500/40" : "text-blue-400 border-blue-500/40"}`}
                  >
                    <Shield className="w-3 h-3 mr-1" /> {accessRole}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Last updated{" "}
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShareOpen(true)}
              >
                <Share2 className="w-4 h-4 mr-1.5" /> Share
              </Button>
            )}
          </div>
        </div>

        {/* Main content with sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="content" className="space-y-4">
              <TabsList className="bg-background/50 border border-border/50 p-1">
                <TabsTrigger
                  value="content"
                  className="gap-1.5 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300"
                >
                  <Eye className="w-3.5 h-3.5" /> Content
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="gap-1.5 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300"
                >
                  <History className="w-3.5 h-3.5" /> History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content">
                <ProjectContentViewer project={project} />
              </TabsContent>

              <TabsContent value="history">
                <VersionHistoryPanel
                  projectId={projectId}
                  currentData={project.data}
                  isOwner={isOwner}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project info card */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Project Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground capitalize">
                    {project.type?.replace("-", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-foreground">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span className="text-foreground">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Access</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] capitalize"
                  >
                    {accessRole || "owner"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* AI Refinement */}
            {(isOwner || accessRole === "editor") && (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="pt-6">
                  <AIRefinementPanel
                    projectId={projectId}
                    projectType={project.type}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      {isOwner && (
        <ShareDialog
          projectId={projectId}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
    </PageLayout>
  );
}
