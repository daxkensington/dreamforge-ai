import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
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
  Activity,
  Zap,
  Webhook,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartColors = {
  primary: "oklch(0.7 0.15 250)",
  primaryAlpha: "oklch(0.7 0.15 250 / 0.2)",
  green: "oklch(0.72 0.17 155)",
  greenAlpha: "oklch(0.72 0.17 155 / 0.2)",
  orange: "oklch(0.75 0.15 55)",
  orangeAlpha: "oklch(0.75 0.15 55 / 0.2)",
  purple: "oklch(0.65 0.2 300)",
  purpleAlpha: "oklch(0.65 0.2 300 / 0.2)",
  red: "oklch(0.65 0.2 25)",
  redAlpha: "oklch(0.65 0.2 25 / 0.2)",
  cyan: "oklch(0.75 0.12 200)",
  cyanAlpha: "oklch(0.75 0.12 200 / 0.2)",
  muted: "oklch(0.5 0.02 250 / 0.3)",
  gridLine: "oklch(0.5 0 0 / 0.1)",
  textColor: "oklch(0.7 0 0)",
};

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: chartColors.textColor, font: { size: 12 } },
    },
    tooltip: {
      backgroundColor: "oklch(0.2 0.02 250)",
      titleColor: "#fff",
      bodyColor: "#ddd",
      borderColor: "oklch(0.4 0.02 250)",
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { color: chartColors.gridLine },
      ticks: { color: chartColors.textColor, font: { size: 11 } },
    },
    y: {
      grid: { color: chartColors.gridLine },
      ticks: { color: chartColors.textColor, font: { size: 11 } },
      beginAtZero: true,
    },
  },
};

export default function AdminDashboard() {
  const { user } = useAuth() as any;
  const [userSearch, setUserSearch] = useState("");
  const [moderationFilter, setModerationFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [analyticsPeriod, setAnalyticsPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [webhookPage, setWebhookPage] = useState(1);
  const [webhookStatusFilter, setWebhookStatusFilter] = useState<"processed" | "failed" | "ignored" | undefined>(undefined);
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
    onSuccess: () => { utils.admin.listUsers.invalidate(); toast.success("User role updated"); },
    onError: (err) => toast.error(err.message),
  });

  const reviewContent = trpc.admin.reviewContent.useMutation({
    onSuccess: () => { utils.admin.listFlaggedContent.invalidate(); toast.success("Content reviewed"); },
    onError: (err) => toast.error(err.message),
  });

  const sendNotif = trpc.admin.sendSystemNotification.useMutation({
    onSuccess: () => { toast.success("System notification sent to all users"); setNotifTitle(""); setNotifMessage(""); },
    onError: (err) => toast.error(err.message),
  });

  const { data: webhookData, isLoading: webhooksLoading } = trpc.admin.getWebhookEvents.useQuery(
    { page: webhookPage, limit: 20, status: webhookStatusFilter },
    { enabled: !!user && user.role === "admin" }
  );

  // Chart data for Generation Volume
  const genChartData = useMemo(() => {
    if (!genAnalytics || genAnalytics.length === 0) return null;
    return {
      labels: genAnalytics.map((item: any) => item.period),
      datasets: [
        {
          label: "Generations",
          data: genAnalytics.map((item: any) => item.count),
          backgroundColor: chartColors.primaryAlpha,
          borderColor: chartColors.primary,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: chartColors.primary,
        },
      ],
    };
  }, [genAnalytics]);

  // Chart data for Revenue
  const revChartData = useMemo(() => {
    if (!revAnalytics || revAnalytics.length === 0) return null;
    return {
      labels: revAnalytics.map((item: any) => item.period),
      datasets: [
        {
          label: "Credits Purchased",
          data: revAnalytics.map((item: any) => item.total || 0),
          backgroundColor: chartColors.greenAlpha,
          borderColor: chartColors.green,
          borderWidth: 2,
          borderRadius: 6,
          barPercentage: 0.6,
        },
        {
          label: "Transactions",
          data: revAnalytics.map((item: any) => item.count),
          backgroundColor: chartColors.orangeAlpha,
          borderColor: chartColors.orange,
          borderWidth: 2,
          borderRadius: 6,
          barPercentage: 0.6,
        },
      ],
    };
  }, [revAnalytics]);

  // Doughnut for platform composition
  const compositionData = useMemo(() => {
    if (!stats) return null;
    return {
      labels: ["Users", "Generations", "Gallery Items", "Credits Purchased"],
      datasets: [
        {
          data: [
            stats.totalUsers || 0,
            stats.totalGenerations || 0,
            stats.totalGalleryItems || 0,
            stats.totalRevenue || 0,
          ],
          backgroundColor: [
            chartColors.primary,
            chartColors.purple,
            chartColors.cyan,
            chartColors.green,
          ],
          borderColor: "oklch(0.15 0.02 250)",
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    };
  }, [stats]);

  // Compute trend indicators
  const genTrend = useMemo(() => {
    if (!genAnalytics || genAnalytics.length < 2) return null;
    const latest = genAnalytics[genAnalytics.length - 1]?.count || 0;
    const previous = genAnalytics[genAnalytics.length - 2]?.count || 0;
    if (previous === 0) return { pct: 0, direction: "flat" as const };
    const pct = Math.round(((latest - previous) / previous) * 100);
    return { pct, direction: pct > 0 ? "up" as const : pct < 0 ? "down" as const : "flat" as const };
  }, [genAnalytics]);

  const revTrend = useMemo(() => {
    if (!revAnalytics || revAnalytics.length < 2) return null;
    const latest = revAnalytics[revAnalytics.length - 1]?.total || 0;
    const previous = revAnalytics[revAnalytics.length - 2]?.total || 0;
    if (previous === 0) return { pct: 0, direction: "flat" as const };
    const pct = Math.round(((latest - previous) / previous) * 100);
    return { pct, direction: pct > 0 ? "up" as const : pct < 0 ? "down" as const : "flat" as const };
  }, [revAnalytics]);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto text-destructive mb-2" />
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
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
            <p className="text-muted-foreground">Platform management and analytics</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-l-4 border-l-blue-500">
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
          <Card className="border-l-4 border-l-purple-500">
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
          <Card className="border-l-4 border-l-green-500">
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
          <Card className="border-l-4 border-l-orange-500">
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
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-2" />Analytics</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" />Users</TabsTrigger>
            <TabsTrigger value="moderation"><Shield className="w-4 h-4 mr-2" />Moderation</TabsTrigger>
            <TabsTrigger value="broadcast"><Send className="w-4 h-4 mr-2" />Broadcast</TabsTrigger>
            <TabsTrigger value="webhooks"><Webhook className="w-4 h-4 mr-2" />Webhooks</TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Period Selector */}
              <div className="flex items-center gap-4">
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
                {genTrend && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Gen trend:</span>
                    <Badge variant={genTrend.direction === "up" ? "default" : genTrend.direction === "down" ? "destructive" : "secondary"}>
                      {genTrend.direction === "up" ? "+" : ""}{genTrend.pct}%
                    </Badge>
                  </div>
                )}
              </div>

              {/* Main Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generation Volume - Line Chart */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-primary" />
                          Generation Volume
                        </CardTitle>
                        <CardDescription>Generations per {analyticsPeriod} period</CardDescription>
                      </div>
                      {genTrend && (
                        <div className={`text-sm font-semibold ${genTrend.direction === "up" ? "text-green-500" : genTrend.direction === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                          {genTrend.direction === "up" ? "↑" : genTrend.direction === "down" ? "↓" : "→"} {Math.abs(genTrend.pct)}%
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {genChartData ? (
                        <Line data={genChartData} options={baseChartOptions as any} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No generation data for this period</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue - Bar Chart */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-green-500" />
                          Revenue Analytics
                        </CardTitle>
                        <CardDescription>Credit purchases per {analyticsPeriod} period</CardDescription>
                      </div>
                      {revTrend && (
                        <div className={`text-sm font-semibold ${revTrend.direction === "up" ? "text-green-500" : revTrend.direction === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                          {revTrend.direction === "up" ? "↑" : revTrend.direction === "down" ? "↓" : "→"} {Math.abs(revTrend.pct)}%
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {revChartData ? (
                        <Bar data={revChartData} options={baseChartOptions as any} />
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No revenue data for this period</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Platform Composition - Doughnut */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="w-4 h-4 text-cyan-500" />
                      Platform Composition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      {compositionData ? (
                        <Doughnut
                          data={compositionData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: {
                                position: "bottom" as const,
                                labels: { color: chartColors.textColor, font: { size: 11 }, padding: 12 },
                              },
                              tooltip: {
                                backgroundColor: "oklch(0.2 0.02 250)",
                                titleColor: "#fff",
                                bodyColor: "#ddd",
                                borderColor: "oklch(0.4 0.02 250)",
                                borderWidth: 1,
                                padding: 10,
                                cornerRadius: 8,
                              },
                            },
                            cutout: "60%",
                          }}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          No data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Stats Summary */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="w-4 h-4 text-purple-500" />
                      Period Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="text-xs text-muted-foreground mb-1">Total Generations ({analyticsPeriod})</div>
                        <div className="text-2xl font-bold">
                          {genAnalytics?.reduce((sum: number, item: any) => sum + (item.count || 0), 0) || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="text-xs text-muted-foreground mb-1">Total Credits ({analyticsPeriod})</div>
                        <div className="text-2xl font-bold">
                          {revAnalytics?.reduce((sum: number, item: any) => sum + (item.total || 0), 0) || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="text-xs text-muted-foreground mb-1">Avg Generations / Period</div>
                        <div className="text-2xl font-bold">
                          {genAnalytics && genAnalytics.length > 0
                            ? Math.round(genAnalytics.reduce((sum: number, item: any) => sum + (item.count || 0), 0) / genAnalytics.length)
                            : 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <div className="text-xs text-muted-foreground mb-1">Total Transactions ({analyticsPeriod})</div>
                        <div className="text-2xl font-bold">
                          {revAnalytics?.reduce((sum: number, item: any) => sum + (item.count || 0), 0) || 0}
                        </div>
                      </div>
                    </div>
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
                <CardDescription>Search and manage platform users</CardDescription>
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
                    <div key={u.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {(u.name || "U").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {u.name || "Anonymous"}
                            {u.role === "admin" && (
                              <Badge variant="default" className="text-[10px]">
                                <Crown className="w-3 h-3 mr-1" />Admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {u.email || "No email"} · Joined {new Date(u.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {u.role === "user" ? (
                          <Button variant="outline" size="sm" onClick={() => updateRole.mutate({ userId: u.id, role: "admin" })}>
                            Promote to Admin
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => updateRole.mutate({ userId: u.id, role: "user" })}>
                            Demote to User
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {usersData?.users?.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">No users found</p>
                  )}
                </div>

                {usersData && (
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Showing {usersData.users?.length || 0} of {usersData.total} users
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
                <CardDescription>Review flagged content from the gallery</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-6">
                  {(["pending", "approved", "rejected"] as const).map((s) => (
                    <Button key={s} variant={moderationFilter === s ? "default" : "outline"} size="sm" onClick={() => setModerationFilter(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  {flaggedData?.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <div>
                        <div className="font-medium">{item.title || "Untitled"}</div>
                        <div className="text-sm text-muted-foreground">{item.description || "No description"}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Submitted {new Date(item.createdAt).toLocaleDateString()} · Status:{" "}
                          <Badge variant={item.status === "approved" ? "default" : item.status === "rejected" ? "destructive" : "secondary"}>
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                      {item.status === "pending" && (
                        <div className="flex gap-2">
                          <Button variant="default" size="sm" onClick={() => reviewContent.mutate({ id: item.id, status: "approved" })}>
                            <CheckCircle className="w-4 h-4 mr-1" />Approve
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => reviewContent.mutate({ id: item.id, status: "rejected", reviewNote: "Content policy violation" })}>
                            <XCircle className="w-4 h-4 mr-1" />Reject
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
                <CardDescription>Send a notification to all platform users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Title</label>
                  <Input placeholder="Notification title..." value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Message</label>
                  <textarea
                    className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm resize-y"
                    placeholder="Notification message..."
                    value={notifMessage}
                    onChange={(e) => setNotifMessage(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => sendNotif.mutate({ title: notifTitle, message: notifMessage })}
                  disabled={!notifTitle.trim() || !notifMessage.trim() || sendNotif.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sendNotif.isPending ? "Sending..." : "Send to All Users"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Webhook className="w-5 h-5" />
                      Stripe Webhook Events
                    </CardTitle>
                    <CardDescription>
                      {webhookData?.total || 0} total events logged
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={!webhookStatusFilter ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setWebhookStatusFilter(undefined); setWebhookPage(1); }}
                    >
                      All
                    </Button>
                    <Button
                      variant={webhookStatusFilter === "processed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setWebhookStatusFilter("processed"); setWebhookPage(1); }}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Processed
                    </Button>
                    <Button
                      variant={webhookStatusFilter === "failed" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setWebhookStatusFilter("failed"); setWebhookPage(1); }}
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Failed
                    </Button>
                    <Button
                      variant={webhookStatusFilter === "ignored" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setWebhookStatusFilter("ignored"); setWebhookPage(1); }}
                    >
                      <AlertTriangle className="w-3 h-3 mr-1" /> Ignored
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => utils.admin.getWebhookEvents.invalidate()}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {webhooksLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
                    ))}
                  </div>
                ) : !webhookData?.events?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Webhook className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No webhook events recorded yet</p>
                    <p className="text-sm mt-1">Events will appear here when Stripe sends webhooks</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {webhookData.events.map((event: any) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-md ${
                            event.status === "processed"
                              ? "bg-green-500/10 text-green-500"
                              : event.status === "failed"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}>
                            {event.status === "processed" ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : event.status === "failed" ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <AlertTriangle className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono font-medium truncate">
                                {event.eventType}
                              </span>
                              <Badge
                                variant={
                                  event.status === "processed"
                                    ? "default"
                                    : event.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {event.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground font-mono truncate">
                                {event.stripeEventId}
                              </span>
                              {event.error && (
                                <span className="text-xs text-destructive truncate max-w-[200px]">
                                  {event.error}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(event.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}

                    {/* Pagination */}
                    {webhookData.total > 20 && (
                      <div className="flex items-center justify-between pt-4">
                        <span className="text-sm text-muted-foreground">
                          Page {webhookPage} of {Math.ceil(webhookData.total / 20)}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={webhookPage <= 1}
                            onClick={() => setWebhookPage((p) => p - 1)}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={webhookPage >= Math.ceil(webhookData.total / 20)}
                            onClick={() => setWebhookPage((p) => p + 1)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
