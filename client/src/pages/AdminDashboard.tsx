import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BarChart3,
  Users,
  Image,
  DollarSign,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Send,
  TrendingUp,
  AlertTriangle,
  Crown,
  Eye,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth() as any;
  const [userSearch, setUserSearch] = useState("");
  const [moderationFilter, setModerationFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const utils = trpc.useUtils();

  const { data: stats } = trpc.admin.getPlatformStats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: usersData } = trpc.admin.listUsers.useQuery(
    { search: userSearch || undefined },
    { enabled: !!user && user.role === "admin" }
  );

  const { data: flaggedData } = trpc.admin.listFlaggedContent.useQuery(
    { status: moderationFilter },
    { enabled: !!user && user.role === "admin" }
  );

  const { data: genAnalytics } = trpc.admin.getGenerationAnalytics.useQuery(
    { period: analyticsPeriod },
    { enabled: !!user && user.role === "admin" }
  );

  const { data: revAnalytics } = trpc.admin.getRevenueAnalytics.useQuery(
    { period: analyticsPeriod },
    { enabled: !!user && user.role === "admin" }
  );

  const updateRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
      toast.success("User role updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewContent = trpc.admin.reviewContent.useMutation({
    onSuccess: () => {
      utils.admin.listFlaggedContent.invalidate();
      toast.success("Content reviewed");
    },
    onError: (err) => toast.error(err.message),
  });

  const sendNotif = trpc.admin.sendSystemNotification.useMutation({
    onSuccess: () => {
      toast.success("System notification sent to all users");
      setNotifTitle("");
      setNotifMessage("");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-destructive mb-2" />
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              You need admin privileges to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-xl bg-primary/10">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Platform management and analytics
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Users</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Image className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalGenerations || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Generations</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalRevenue || 0}</div>
                  <div className="text-xs text-muted-foreground">Credits Purchased</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Eye className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.totalGalleryItems || 0}</div>
                  <div className="text-xs text-muted-foreground">Gallery Items</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="moderation">
              <Shield className="w-4 h-4 mr-2" />
              Moderation
            </TabsTrigger>
            <TabsTrigger value="broadcast">
              <Send className="w-4 h-4 mr-2" />
              Broadcast
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              <div className="flex gap-2">
                {(["daily", "weekly", "monthly"] as const).map((p) => (
                  <Button
                    key={p}
                    variant={analyticsPeriod === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAnalyticsPeriod(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Generation Volume
                    </CardTitle>
                    <CardDescription>
                      Generations per {analyticsPeriod} period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {genAnalytics && genAnalytics.length > 0 ? (
                      <div className="space-y-2">
                        {genAnalytics.map((item: any) => (
                          <div
                            key={item.period}
                            className="flex items-center justify-between p-2 rounded bg-muted/50"
                          >
                            <span className="text-sm font-mono">
                              {item.period}
                            </span>
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2 bg-primary rounded-full"
                                style={{
                                  width: `${Math.min(
                                    (item.count /
                                      Math.max(
                                        ...genAnalytics.map((g: any) => g.count)
                                      )) *
                                      120,
                                    120
                                  )}px`,
                                }}
                              />
                              <span className="text-sm font-bold w-12 text-right">
                                {item.count}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No data for this period
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Revenue
                    </CardTitle>
                    <CardDescription>
                      Credit purchases per {analyticsPeriod} period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revAnalytics && revAnalytics.length > 0 ? (
                      <div className="space-y-2">
                        {revAnalytics.map((item: any) => (
                          <div
                            key={item.period}
                            className="flex items-center justify-between p-2 rounded bg-muted/50"
                          >
                            <span className="text-sm font-mono">
                              {item.period}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">
                                {item.count} txns
                              </span>
                              <Badge variant="secondary">
                                {item.total} credits
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No revenue data for this period
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Search and manage platform users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by name..."
                      className="pl-10"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {usersData?.users?.map((u: any) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {(u.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {u.name || "Anonymous"}
                            {u.role === "admin" && (
                              <Badge variant="default" className="text-[10px]">
                                <Crown className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.email || "No email"} · Joined{" "}
                            {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {u.role === "user" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateRole.mutate({
                                userId: u.id,
                                role: "admin",
                              })
                            }
                          >
                            Promote to Admin
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateRole.mutate({
                                userId: u.id,
                                role: "user",
                              })
                            }
                          >
                            Demote to User
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {usersData?.users?.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">
                      No users found
                    </p>
                  )}
                </div>

                {usersData && (
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Showing {usersData.users?.length || 0} of {usersData.total}{" "}
                    users
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Moderation Tab */}
          <TabsContent value="moderation">
            <Card>
              <CardHeader>
                <CardTitle>Content Moderation</CardTitle>
                <CardDescription>
                  Review flagged content from the gallery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  {(["pending", "approved", "rejected"] as const).map((s) => (
                    <Button
                      key={s}
                      variant={moderationFilter === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setModerationFilter(s)}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  {flaggedData?.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                    >
                      <div>
                        <div className="font-medium">
                          {item.title || "Untitled"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.description || "No description"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Submitted{" "}
                          {new Date(item.createdAt).toLocaleDateString()} ·
                          Status:{" "}
                          <Badge
                            variant={
                              item.status === "approved"
                                ? "default"
                                : item.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                      {item.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              reviewContent.mutate({
                                id: item.id,
                                status: "approved",
                              })
                            }
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              reviewContent.mutate({
                                id: item.id,
                                status: "rejected",
                                reviewNote: "Content policy violation",
                              })
                            }
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {flaggedData?.items?.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No {moderationFilter} items</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Broadcast Tab */}
          <TabsContent value="broadcast">
            <Card>
              <CardHeader>
                <CardTitle>System Broadcast</CardTitle>
                <CardDescription>
                  Send a notification to all platform users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Title
                  </label>
                  <Input
                    placeholder="Notification title..."
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Message
                  </label>
                  <textarea
                    className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm resize-y"
                    placeholder="Notification message..."
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() =>
                    sendNotif.mutate({
                      title: notifTitle,
                      message: notifMessage,
                    })
                  }
                  disabled={
                    !notifTitle.trim() ||
                    !notifMessage.trim() ||
                    sendNotif.isPending
                  }
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendNotif.isPending
                    ? "Sending..."
                    : "Send to All Users"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
