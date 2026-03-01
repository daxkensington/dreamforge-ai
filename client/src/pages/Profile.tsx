import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  User,
  Building2,
  Image,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Film,
  Calendar,
  BarChart3,
  TrendingUp,
  Zap,
  Eye,
  GalleryHorizontal,
  Wand2,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";

// ─── Quota Progress Bar ─────────────────────────────────────────────────────

function QuotaBar({
  label,
  used,
  limit,
  color,
}: {
  label: string;
  used: number;
  limit: number;
  color: string;
}) {
  const pct = Math.min((used / limit) * 100, 100);
  const isNearLimit = pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono text-xs ${isNearLimit ? "text-amber-400" : "text-foreground"}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color} ${isNearLimit ? "animate-pulse" : ""}`}
        />
      </div>
    </div>
  );
}

// ─── Mini Activity Chart (CSS-based sparkline) ──────────────────────────────

function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  // Fill in missing days for last 30 days
  const days: { date: string; count: number }[] = [];
  const dataMap = new Map(data.map((d) => [d.date, d.count]));
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    days.push({ date: key, count: dataMap.get(key) ?? 0 });
  }
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-[3px] h-24">
      {days.map((day, i) => {
        const height = Math.max((day.count / maxCount) * 100, 4);
        const isToday = i === days.length - 1;
        return (
          <motion.div
            key={day.date}
            initial={{ height: 0 }}
            animate={{ height: `${height}%` }}
            transition={{ duration: 0.5, delay: i * 0.015 }}
            className="group relative flex-1 min-w-0 cursor-pointer"
          >
            <div
              className={`w-full h-full rounded-sm transition-colors ${
                isToday
                  ? "bg-primary"
                  : day.count > 0
                  ? "bg-primary/50 hover:bg-primary/70"
                  : "bg-muted/30 hover:bg-muted/50"
              }`}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border border-border whitespace-nowrap">
                <div className="font-medium">{day.count} generation{day.count !== 1 ? "s" : ""}</div>
                <div className="text-muted-foreground">
                  {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Model Usage Bars ───────────────────────────────────────────────────────

function ModelUsageBars({ data }: { data: { model: string; count: number }[] }) {
  if (!data.length) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No model usage data yet
      </div>
    );
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const colors = [
    "bg-primary",
    "bg-violet-500",
    "bg-fuchsia-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
  ];

  return (
    <div className="space-y-3">
      {data.slice(0, 6).map((item, i) => {
        const pct = (item.count / maxCount) * 100;
        return (
          <div key={item.model} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-muted-foreground truncate max-w-[60%]">
                {item.model}
              </span>
              <span className="text-xs font-medium">{item.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className={`h-full rounded-full ${colors[i % colors.length]}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Profile Component ─────────────────────────────────────────────────

export default function Profile() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [institution, setInstitution] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "profile">("dashboard");

  const { data: usageStats, isLoading: statsLoading } = trpc.user.getUsageStats.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const { data: timeline, isLoading: timelineLoading } = trpc.user.getActivityTimeline.useQuery(
    { limit: 20, offset: 0 },
    { enabled: isAuthenticated }
  );

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => toast.success("Profile updated"),
    onError: (err: any) => toast.error(err.message),
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBio((user as any).bio || "");
      setInstitution((user as any).institution || "");
    }
  }, [user]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to view your profile and analytics.</p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in</Button>
        </div>
      </PageLayout>
    );
  }

  const statCards = usageStats
    ? [
        {
          label: "Total Creations",
          value: usageStats.totalGenerations,
          icon: Sparkles,
          color: "text-primary",
          bg: "bg-primary/10",
        },
        {
          label: "Completed",
          value: usageStats.completedGenerations,
          icon: CheckCircle,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        },
        {
          label: "Images",
          value: usageStats.images,
          icon: Image,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
        },
        {
          label: "Videos",
          value: usageStats.videos,
          icon: Film,
          color: "text-fuchsia-500",
          bg: "bg-fuchsia-500/10",
        },
        {
          label: "Animations",
          value: usageStats.animations,
          icon: Zap,
          color: "text-amber-500",
          bg: "bg-amber-500/10",
        },
        {
          label: "Gallery Views",
          value: usageStats.totalViews,
          icon: Eye,
          color: "text-cyan-500",
          bg: "bg-cyan-500/10",
        },
      ]
    : [];

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              {user?.name || "Creator"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Member since{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                  })
                : "—"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-transparent capitalize">
              {user?.role} · Free Plan
            </Badge>
            <Button asChild variant="outline" size="sm" className="bg-transparent hidden sm:flex">
              <Link href="/pricing">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Upgrade
              </Link>
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 mb-8 p-1 bg-muted/30 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "profile"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Profile
          </button>
        </div>

        {/* ═══ Dashboard Tab ═══ */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Stats Grid */}
            {statsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {statCards.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-2xl font-bold leading-none">{stat.value}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{stat.label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Main Dashboard Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Quota + Models */}
              <div className="space-y-6">
                {/* Monthly Quota */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Monthly Quota
                        <Badge variant="outline" className="bg-transparent text-[10px] ml-auto">
                          Free Plan
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statsLoading ? (
                        <div className="space-y-4">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-8" />
                          ))}
                        </div>
                      ) : usageStats ? (
                        <>
                          <QuotaBar
                            label="Image Generations"
                            used={usageStats.quota.images.used}
                            limit={usageStats.quota.images.limit}
                            color="bg-blue-500"
                          />
                          <QuotaBar
                            label="Video Generations"
                            used={usageStats.quota.videos.used}
                            limit={usageStats.quota.videos.limit}
                            color="bg-fuchsia-500"
                          />
                          <QuotaBar
                            label="Animations"
                            used={usageStats.quota.animations.used}
                            limit={usageStats.quota.animations.limit}
                            color="bg-amber-500"
                          />
                          <QuotaBar
                            label="Gallery Submissions"
                            used={usageStats.quota.gallerySubmissions.used}
                            limit={usageStats.quota.gallerySubmissions.limit}
                            color="bg-emerald-500"
                          />
                          <Button asChild variant="outline" size="sm" className="w-full bg-transparent mt-2">
                            <Link href="/pricing">
                              Need more? Upgrade to Pro
                              <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Link>
                          </Button>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Model Breakdown */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-violet-500" />
                        Model Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {statsLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-6" />
                          ))}
                        </div>
                      ) : usageStats ? (
                        <ModelUsageBars data={usageStats.modelUsage} />
                      ) : null}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Right Column: Activity Chart + Timeline */}
              <div className="lg:col-span-2 space-y-6">
                {/* Activity Chart */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          Activity — Last 30 Days
                        </CardTitle>
                        {usageStats && (
                          <span className="text-xs text-muted-foreground">
                            {usageStats.dailyActivity.reduce((sum, d) => sum + d.count, 0)} total
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {statsLoading ? (
                        <Skeleton className="h-24 w-full" />
                      ) : usageStats ? (
                        <ActivityChart data={usageStats.dailyActivity} />
                      ) : null}
                      {/* Day labels */}
                      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                        <span>30 days ago</span>
                        <span>Today</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Recent Activity Timeline */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="border-border/50 bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          Recent Activity
                        </CardTitle>
                        <Button asChild variant="outline" size="sm" className="bg-transparent text-xs h-7">
                          <Link href="/workspace">Go to Studio</Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {timelineLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : !timeline || timeline.items.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Image className="h-8 w-8 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">No creations yet</p>
                          <Button asChild variant="link" size="sm" className="mt-2">
                            <Link href="/workspace">Create your first artwork</Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {timeline.items.map((gen: any) => (
                            <div
                              key={gen.id}
                              className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors group"
                            >
                              {gen.imageUrl ? (
                                <img
                                  src={gen.imageUrl}
                                  alt=""
                                  className="h-12 w-12 rounded-lg object-cover bg-muted shrink-0"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                  {gen.mediaType === "video" ? (
                                    <Film className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <Image className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate leading-tight">{gen.prompt}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-2.5 w-2.5" />
                                    {new Date(gen.createdAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <Badge variant="outline" className="bg-transparent text-[9px] h-4 px-1.5 capitalize">
                                    {gen.mediaType}
                                  </Badge>
                                  {gen.parentGenerationId && (
                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px] h-4 px-1.5">
                                      Animated
                                    </Badge>
                                  )}
                                  <span className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
                                    {gen.modelVersion}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0">
                                {gen.status === "completed" && (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                )}
                                {gen.status === "failed" && (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                {(gen.status === "generating" || gen.status === "pending") && (
                                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                )}
                              </div>
                            </div>
                          ))}
                          {timeline.total > 20 && (
                            <p className="text-center text-xs text-muted-foreground pt-2">
                              Showing 20 of {timeline.total} total creations
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Profile Tab ═══ */}
        {activeTab === "profile" && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Profile Form */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Profile Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="institution" className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      About
                    </Label>
                    <Input
                      id="institution"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g., Digital artist, 3D designer"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself and what you create..."
                      rows={4}
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    onClick={() => updateProfile.mutate({ name, bio, institution })}
                    disabled={updateProfile.isPending}
                    className="w-full"
                  >
                    {updateProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Profile
                  </Button>
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card className="border-border/50 bg-card/50 mt-4">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-mono text-xs">{user?.email || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <Badge variant="outline" className="bg-transparent text-xs capitalize">
                      {user?.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <Badge variant="outline" className="bg-transparent text-xs">
                      Free
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Joined</span>
                    <span className="text-xs">
                      {user?.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Stats Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2"
            >
              <Card className="border-border/50 bg-card/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Quick Stats
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-transparent text-xs"
                      onClick={() => setActiveTab("dashboard")}
                    >
                      View Full Dashboard
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : usageStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {statCards.map((stat, i) => (
                        <div
                          key={stat.label}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30"
                        >
                          <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                          </div>
                          <div>
                            <p className="text-xl font-bold leading-none">{stat.value}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No data available yet. Start creating to see your stats.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Card className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
                  <Link href="/workspace">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Studio</p>
                        <p className="text-xs text-muted-foreground">Create new artwork</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </CardContent>
                  </Link>
                </Card>
                <Card className="border-border/50 bg-card/50 hover:bg-card/80 transition-colors">
                  <Link href="/gallery">
                    <CardContent className="pt-4 pb-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                        <GalleryHorizontal className="h-5 w-5 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Gallery</p>
                        <p className="text-xs text-muted-foreground">Browse community art</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </CardContent>
                  </Link>
                </Card>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
