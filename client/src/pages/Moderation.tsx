import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  Image,
  User,
  Calendar,
  Loader2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useState } from "react";

export default function Moderation() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote] = useState("");

  const { data: stats } = trpc.moderation.stats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const { data: queueData, isLoading, refetch } = trpc.moderation.queue.useQuery(
    { status: activeTab, limit: 50, offset: 0 },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const reviewMutation = trpc.moderation.review.useMutation({
    onSuccess: () => {
      toast.success(reviewAction === "approved" ? "Item approved!" : "Item rejected");
      setReviewDialogOpen(false);
      setReviewNote("");
      setReviewItemId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = queueData?.items ?? [];

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            The moderation queue is only accessible to administrators.
          </p>
          {!isAuthenticated && (
            <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in</Button>
          )}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Moderation Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve community submissions before they go live
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.approved}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.rejected}</p>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="mb-6">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-3.5 w-3.5" />
              Pending
              {stats && stats.pending > 0 && (
                <span className="ml-1 h-5 w-5 rounded-full bg-cyan-500 text-white text-xs flex items-center justify-center">
                  {stats.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-3.5 w-3.5" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-3.5 w-3.5" />
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-24 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">No {activeTab} items</p>
                <p className="text-sm">
                  {activeTab === "pending"
                    ? "All submissions have been reviewed"
                    : `No ${activeTab} submissions yet`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <Card key={item.id} className="border-border/50 bg-card/50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden shrink-0">
                          {item.generation?.imageUrl ? (
                            <img
                              src={item.generation.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-medium text-sm truncate">
                                {item.title || "Untitled"}
                              </h3>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={
                                item.status === "pending"
                                  ? "secondary"
                                  : item.status === "approved"
                                  ? "default"
                                  : "destructive"
                              }
                              className="text-xs shrink-0"
                            >
                              {item.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {item.userName || "Anonymous"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                            {item.generation?.modelVersion && (
                              <span className="font-mono">
                                {item.generation.modelVersion}
                              </span>
                            )}
                          </div>

                          {/* Prompt preview */}
                          {item.generation?.prompt && (
                            <p className="text-[10px] font-mono text-muted-foreground mt-2 truncate bg-muted/50 px-2 py-1 rounded">
                              {item.generation.prompt}
                            </p>
                          )}

                          {/* Review note */}
                          {item.reviewNote && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Note: {item.reviewNote}
                            </p>
                          )}

                          {/* Actions for pending items */}
                          {item.status === "pending" && (
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="default"
                                className="text-xs h-7"
                                onClick={() => {
                                  setReviewItemId(item.id);
                                  setReviewAction("approved");
                                  setReviewDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs h-7"
                                onClick={() => {
                                  setReviewItemId(item.id);
                                  setReviewAction("rejected");
                                  setReviewDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>


      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "Approve Submission" : "Reject Submission"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {reviewAction === "approved"
                ? "This item will be published to the community gallery."
                : "This item will be rejected and will not appear in the gallery."}
            </p>
            <div>
              <label className="text-sm font-medium">Review Note (optional)</label>
              <Textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add a note about your decision..."
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              className="bg-transparent"
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === "approved" ? "default" : "destructive"}
              onClick={() => {
                if (reviewItemId === null) return;
                reviewMutation.mutate({
                  id: reviewItemId,
                  status: reviewAction,
                  note: reviewNote.trim() || undefined,
                });
              }}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : reviewAction === "approved" ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {reviewAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
