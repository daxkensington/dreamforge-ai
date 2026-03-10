import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Coins,
  CreditCard,
  Sparkles,
  Zap,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  Star,
  TrendingUp,
  BarChart3,
  PieChart,
  Gift,
  Copy,
  Users,
  AlertTriangle,
  X,
  ExternalLink,
  Trophy,
  Target,
  Mail,
  Settings,
  Send,
  ChevronRight,
  Award,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ─── Usage Chart Component (Canvas-based) ───────────────────────────────────
function UsageDonutChart({
  data,
}: {
  data: { tool: string; credits: number; percentage: number }[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const colors = useMemo(
    () => [
      "#8b5cf6",
      "#06b6d4",
      "#f59e0b",
      "#ef4444",
      "#22c55e",
      "#ec4899",
      "#3b82f6",
      "#f97316",
      "#14b8a6",
      "#a855f7",
      "#64748b",
      "#84cc16",
    ],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = 90;
    const innerR = 55;
    const total = data.reduce((s, d) => s + d.credits, 0);

    let startAngle = -Math.PI / 2;

    data.forEach((item, i) => {
      const sliceAngle = (item.credits / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Center hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 1, 0, 2 * Math.PI);
    ctx.fillStyle = "hsl(var(--background))";
    ctx.fill();

    // Center text
    ctx.fillStyle = "hsl(var(--foreground))";
    ctx.font = "bold 24px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(total.toString(), cx, cy - 8);
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = "hsl(var(--muted-foreground))";
    ctx.fillText("credits used", cx, cy + 12);
  }, [data, colors]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No usage data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {data.slice(0, 8).map((item, i) => (
          <div key={item.tool} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: colors[i % colors.length] }}
            />
            <span className="truncate text-muted-foreground capitalize">
              {item.tool.replace(/-/g, " ")}
            </span>
            <span className="ml-auto font-medium">{item.credits}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Spending Timeline Bar Chart ────────────────────────────────────────────
function SpendingTimeline({
  data,
}: {
  data: { period: string; spent: number; count: number }[];
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No spending data yet
      </div>
    );
  }

  const maxSpent = Math.max(...data.map((d) => d.spent), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-[160px]">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end gap-1"
          >
            <span className="text-[10px] text-muted-foreground font-medium">
              {d.spent}
            </span>
            <div
              className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
              style={{
                height: `${Math.max((d.spent / maxSpent) * 140, 2)}px`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[9px] text-muted-foreground truncate"
          >
            {d.period.length > 7 ? d.period.slice(5) : d.period}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Low Credit Warning Banner ──────────────────────────────────────────────
function LowCreditBanner({
  balance,
  onDismiss,
}: {
  balance: number;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-6 relative overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-destructive">Low Credit Balance</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You have only <strong className="text-foreground">{balance}</strong>{" "}
            credits remaining. Some tools require up to 5 credits per use.
            Purchase more credits to keep creating.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="destructive" asChild>
              <a href="#packages">
                <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                Buy Credits
              </a>
            </Button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Referral Section ───────────────────────────────────────────────────────
function ReferralSection() {
  const [referralInput, setReferralInput] = useState("");

  const { data: myReferral, isLoading: referralLoading } =
    trpc.referral.getMyReferral.useQuery();
  const { data: constants } = trpc.referral.getConstants.useQuery();

  const utils = trpc.useUtils();

  const applyCode = trpc.referral.applyCode.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setReferralInput("");
      utils.credits.getBalance.invalidate();
      utils.referral.getMyReferral.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply referral code");
    },
  });

  const handleCopyLink = () => {
    if (!myReferral?.code) return;
    const link = `${window.location.origin}?ref=${myReferral.code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied to clipboard!");
  };

  const handleCopyCode = () => {
    if (!myReferral?.code) return;
    navigator.clipboard.writeText(myReferral.code);
    toast.success("Referral code copied!");
  };

  if (referralLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />
        <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Referral Link */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>Invite Friends, Earn Credits</CardTitle>
              <CardDescription>
                Share your referral link and both you and your friend earn bonus
                credits
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bonus Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="text-xs text-muted-foreground mb-1">
                You receive
              </div>
              <div className="text-2xl font-bold text-primary">
                +{constants?.referrerBonus || 25}
              </div>
              <div className="text-xs text-muted-foreground">credits</div>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/50">
              <div className="text-xs text-muted-foreground mb-1">
                Friend receives
              </div>
              <div className="text-2xl font-bold text-emerald-500">
                +{constants?.referredBonus || 15}
              </div>
              <div className="text-xs text-muted-foreground">credits</div>
            </div>
          </div>

          {/* Referral Code & Link */}
          {myReferral?.code && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Your Referral Code
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-2.5 rounded-lg bg-muted/50 border border-border font-mono text-lg font-bold tracking-widest text-center">
                    {myReferral.code}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    title="Copy code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Referral Link
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}?ref=${myReferral.code}`}
                    className="text-sm font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Stats */}
      {myReferral?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold">
                {myReferral.stats.totalReferrals}
              </div>
              <div className="text-xs text-muted-foreground">
                Total Referrals
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">
                {myReferral.stats.completedReferrals}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-amber-500">
                {myReferral.stats.pendingReferrals}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-primary">
                +{myReferral.stats.totalCreditsEarned}
              </div>
              <div className="text-xs text-muted-foreground">
                Credits Earned
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral History */}
      {myReferral?.referrals && myReferral.referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myReferral.referrals.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        ref.status === "completed"
                          ? "bg-emerald-500/10"
                          : "bg-amber-500/10"
                      }`}
                    >
                      <Users
                        className={`w-4 h-4 ${
                          ref.status === "completed"
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {ref.status}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      ref.status === "completed" ? "default" : "secondary"
                    }
                  >
                    +{ref.creditsAwarded} credits
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tiered Rewards Progress */}
      <TierProgressSection />

      {/* Apply Referral Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Have a Referral Code?</CardTitle>
          <CardDescription>
            Enter a friend's referral code to earn bonus credits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter referral code (e.g., A1B2C3D4)"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={32}
            />
            <Button
              onClick={() => applyCode.mutate({ code: referralInput })}
              disabled={!referralInput || applyCode.isPending}
            >
              {applyCode.isPending ? "Applying..." : "Apply"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tier Progress Section ─────────────────────────────────────────────────
function TierProgressSection() {
  const { data: tierData, isLoading } = trpc.tieredReferral.getTierProgress.useQuery();

  if (isLoading) {
    return <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />;
  }

  if (!tierData) return null;

  const { totalReferrals, currentTier, nextTier, tiers, tierBonusesEarned } = tierData;

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <CardTitle>Referral Tiers</CardTitle>
            <CardDescription>
              Unlock milestone bonuses as you refer more friends
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold">{totalReferrals}</div>
            <div className="text-xs text-muted-foreground">Total Referrals</div>
          </div>
          {currentTier && (
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" style={{ color: currentTier.color }} />
              <div>
                <div className="font-semibold" style={{ color: currentTier.color }}>
                  {currentTier.name} Tier
                </div>
                <div className="text-xs text-muted-foreground">
                  +{tierBonusesEarned} bonus credits earned
                </div>
              </div>
            </div>
          )}
          {!currentTier && (
            <div className="text-sm text-muted-foreground">
              Refer {nextTier?.threshold || 3} friends to unlock your first tier!
            </div>
          )}
        </div>

        {/* Progress to Next Tier */}
        {nextTier && (
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                Progress to <span className="font-medium" style={{ color: nextTier.color }}>{nextTier.name}</span>
              </span>
              <span className="font-medium">
                {totalReferrals} / {nextTier.threshold}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((totalReferrals / nextTier.threshold) * 100, 100)}%`,
                  backgroundColor: nextTier.color,
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {nextTier.threshold - totalReferrals} more referral{nextTier.threshold - totalReferrals !== 1 ? "s" : ""} to earn <strong>+{nextTier.bonus} credits</strong>
            </div>
          </div>
        )}

        {/* All Tiers */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground mb-2">All Tiers</div>
          <div className="grid gap-2">
            {tiers.map((tier) => {
              const isReached = totalReferrals >= tier.threshold;
              const isCurrent = currentTier?.name === tier.name;
              return (
                <div
                  key={tier.name}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? "border-2 bg-background/80 shadow-sm"
                      : isReached
                      ? "bg-muted/30 border-border/50"
                      : "bg-muted/10 border-border/30 opacity-60"
                  }`}
                  style={isCurrent ? { borderColor: tier.color } : {}}
                >
                  <div className="flex items-center gap-3">
                    <Award
                      className="w-5 h-5"
                      style={{ color: isReached ? tier.color : "hsl(var(--muted-foreground))" }}
                    />
                    <div>
                      <div className="text-sm font-medium" style={isReached ? { color: tier.color } : {}}>
                        {tier.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tier.threshold} referrals
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isReached ? "default" : "secondary"}
                      className="text-xs"
                    >
                      +{tier.bonus} credits
                    </Badge>
                    {isReached && (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Digest Settings Section ───────────────────────────────────────────────
function DigestSettingsSection() {
  const { data: prefs, isLoading } = trpc.digest.getPreferences.useQuery();
  const utils = trpc.useUtils();

  const updatePrefs = trpc.digest.updatePreferences.useMutation({
    onSuccess: () => {
      toast.success("Digest preferences updated");
      utils.digest.getPreferences.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update preferences");
    },
  });

  const sendNow = trpc.digest.sendNow.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || "Digest sent!");
      } else {
        toast.info(data.message || "No usage data to report");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send digest");
    },
  });

  const { data: preview, isLoading: previewLoading } = trpc.digest.generatePreview.useQuery(
    { period: prefs?.frequency || "weekly" },
    { enabled: !!prefs }
  );

  if (isLoading) {
    return <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Mail className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <CardTitle>Usage Digest</CardTitle>
            <CardDescription>
              Get periodic summaries of your credit usage and activity
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle & Frequency */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={prefs?.enabled ?? false}
              onCheckedChange={(checked) =>
                updatePrefs.mutate({
                  enabled: checked,
                  frequency: prefs?.frequency || "weekly",
                })
              }
            />
            <Label className="text-sm font-medium">
              {prefs?.enabled ? "Digest enabled" : "Digest disabled"}
            </Label>
          </div>
          <Select
            value={prefs?.frequency || "weekly"}
            onValueChange={(v) =>
              updatePrefs.mutate({
                enabled: prefs?.enabled ?? false,
                frequency: v as "weekly" | "monthly",
              })
            }
          >
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Last Sent */}
        {prefs?.lastSentAt && (
          <div className="text-xs text-muted-foreground">
            Last digest sent: {new Date(prefs.lastSentAt).toLocaleString()}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Digest Preview
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-lg font-bold">{preview.totalSpent}</div>
                <div className="text-xs text-muted-foreground">Credits Used</div>
              </div>
              <div>
                <div className="text-lg font-bold">{preview.totalGenerations}</div>
                <div className="text-xs text-muted-foreground">Generations</div>
              </div>
              <div>
                <div className="text-lg font-bold">{preview.avgPerDay}</div>
                <div className="text-xs text-muted-foreground">Avg/Day</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${preview.comparedToPrevious.spentChange >= 0 ? "text-amber-500" : "text-emerald-500"}`}>
                  {preview.comparedToPrevious.spentChange >= 0 ? "+" : ""}{preview.comparedToPrevious.spentChange}%
                </div>
                <div className="text-xs text-muted-foreground">vs Previous</div>
              </div>
            </div>
            {preview.topTools.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Top Tools</div>
                {preview.topTools.slice(0, 3).map((t) => (
                  <div key={t.tool} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{t.tool.replace(/-/g, " ")}</span>
                    <span className="text-muted-foreground">{t.credits} credits ({t.count} uses)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Send Now Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => sendNow.mutate()}
          disabled={sendNow.isPending}
          className="gap-2"
        >
          <Send className="w-4 h-4" />
          {sendNow.isPending ? "Sending..." : "Send Digest Now"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Usage Analytics Section ────────────────────────────────────────────────
function UsageAnalyticsSection() {
  const [toolPeriod, setToolPeriod] = useState<"7d" | "30d" | "90d" | "all">(
    "30d"
  );
  const [timelinePeriod, setTimelinePeriod] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");

  const { data: usageByTool, isLoading: toolLoading } =
    trpc.usageAnalytics.getUsageByTool.useQuery({ period: toolPeriod });
  const { data: timeline, isLoading: timelineLoading } =
    trpc.usageAnalytics.getSpendingTimeline.useQuery({
      period: timelinePeriod,
    });
  const { data: summary } = trpc.usageAnalytics.getSummary.useQuery();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">
                Total Spent
              </div>
              <div className="text-2xl font-bold">{summary.totalSpent}</div>
              <div className="text-xs text-muted-foreground">credits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">
                Purchased
              </div>
              <div className="text-2xl font-bold text-emerald-500">
                {summary.totalPurchased}
              </div>
              <div className="text-xs text-muted-foreground">credits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">
                Bonuses
              </div>
              <div className="text-2xl font-bold text-primary">
                {summary.totalBonuses}
              </div>
              <div className="text-xs text-muted-foreground">credits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">
                Avg / Day
              </div>
              <div className="text-2xl font-bold">{summary.avgPerDay}</div>
              <div className="text-xs text-muted-foreground">credits</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-muted-foreground mb-1">
                Top Tool
              </div>
              <div className="text-lg font-bold capitalize truncate">
                {summary.mostUsedTool
                  ? summary.mostUsedTool.replace(/-/g, " ")
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">most used</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool Breakdown (Donut) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Usage by Tool
              </CardTitle>
              <Select
                value={toolPeriod}
                onValueChange={(v) =>
                  setToolPeriod(v as "7d" | "30d" | "90d" | "all")
                }
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {toolLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground text-sm">
                  Loading...
                </div>
              </div>
            ) : (
              <UsageDonutChart data={usageByTool?.tools || []} />
            )}
          </CardContent>
        </Card>

        {/* Spending Timeline (Bar Chart) */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Spending Over Time
              </CardTitle>
              <Select
                value={timelinePeriod}
                onValueChange={(v) =>
                  setTimelinePeriod(v as "daily" | "weekly" | "monthly")
                }
              >
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground text-sm">
                  Loading...
                </div>
              </div>
            ) : (
              <SpendingTimeline data={timeline || []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Tools Table */}
      {usageByTool?.tools && usageByTool.tools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Tool Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usageByTool.tools.map((tool) => (
                <div
                  key={tool.tool}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium capitalize">
                        {tool.tool.replace(/-/g, " ")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {tool.credits} credits ({tool.count} uses)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${tool.percentage}%` }}
                      />
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {tool.percentage}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Credits Page ──────────────────────────────────────────────────────
export default function Credits() {
  const { user, isLoading: authLoading } = useAuth() as any;
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showLowCreditBanner, setShowLowCreditBanner] = useState(true);

  const { data: balance } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: enhancedBalance } =
    trpc.enhancedCredits.getBalanceWithWarning.useQuery(undefined, {
      enabled: !!user,
    });
  const { data: packages } = trpc.credits.getPackages.useQuery();
  const { data: costs } = trpc.credits.getCosts.useQuery();
  const { data: history } = trpc.credits.getHistory.useQuery(undefined, {
    enabled: !!user,
  });

  const checkout = trpc.credits.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.success("Redirecting to Stripe checkout...");
        window.open(data.url, "_blank");
      }
      setPurchasingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Checkout failed");
      setPurchasingId(null);
    },
  });

  const handlePurchase = (packageId: string) => {
    if (!user) return;
    setPurchasingId(packageId);
    checkout.mutate({
      packageId,
      origin: window.location.origin,
    });
  };



  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Coins className="w-12 h-12 mx-auto text-primary mb-2" />
            <CardTitle>Sign in to manage credits</CardTitle>
            <CardDescription>
              Purchase generation credits to use DreamForge tools
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const packageIcons = [Zap, Star, Sparkles, Building2];
  const isLowCredit = enhancedBalance?.isLow ?? false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-12">
        {/* Low Credit Warning Banner */}
        {isLowCredit && showLowCreditBanner && (
          <LowCreditBanner
            balance={enhancedBalance?.balance ?? 0}
            onDismiss={() => setShowLowCreditBanner(false)}
          />
        )}

        {/* Balance Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-primary/10">
              <Coins className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Credits</h1>
              <p className="text-muted-foreground">
                Purchase, track, and manage your generation credits
              </p>
            </div>
          </div>

          {balance && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card
                className={`bg-gradient-to-br ${
                  isLowCredit
                    ? "from-destructive/5 to-destructive/10 border-destructive/20"
                    : "from-primary/5 to-primary/10 border-primary/20"
                }`}
              >
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    Available Balance
                  </div>
                  <div
                    className={`text-4xl font-bold ${
                      isLowCredit ? "text-destructive" : "text-primary"
                    }`}
                  >
                    {balance.balance}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    credits
                    {isLowCredit && (
                      <span className="text-destructive ml-1">
                        — Running low!
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    Lifetime Used
                  </div>
                  <div className="text-4xl font-bold">
                    {balance.lifetimeSpent}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    credits spent
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground mb-1">
                    Estimated Remaining
                  </div>
                  <div className="text-4xl font-bold">~{balance.balance}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    image generations
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="packages">
              <CreditCard className="w-4 h-4 mr-2" />
              Buy Credits
            </TabsTrigger>
            <TabsTrigger value="usage">
              <BarChart3 className="w-4 h-4 mr-2" />
              Usage Analytics
            </TabsTrigger>
            <TabsTrigger value="referrals">
              <Gift className="w-4 h-4 mr-2" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="digest">
              <Mail className="w-4 h-4 mr-2" />
              Digest
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <TrendingUp className="w-4 h-4 mr-2" />
              Credit Costs
            </TabsTrigger>
          </TabsList>

          {/* Packages Tab */}
          <TabsContent value="packages" id="packages">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {packages?.map((pkg, i) => {
                const Icon = packageIcons[i] || Zap;
                return (
                  <Card
                    key={pkg.id}
                    className={`relative overflow-hidden transition-all hover:shadow-lg ${
                      pkg.popular
                        ? "border-primary shadow-primary/10 shadow-md"
                        : ""
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className="p-2 w-fit rounded-lg bg-primary/10 mb-2">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      <CardDescription>{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-4">
                        <span className="text-4xl font-bold">
                          {pkg.priceDisplay}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>
                            <strong>{pkg.credits}</strong> credits
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{pkg.perCredit} per credit</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>Never expires</span>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={pkg.popular ? "default" : "outline"}
                        onClick={() => handlePurchase(pkg.id)}
                        disabled={purchasingId === pkg.id}
                      >
                        {purchasingId === pkg.id ? (
                          "Processing..."
                        ) : (
                          <>
                            Buy Now
                            <ArrowUpRight className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Payments are processed securely via Stripe. Test with card number
              4242 4242 4242 4242.
            </p>
          </TabsContent>

          {/* Usage Analytics Tab */}
          <TabsContent value="usage">
            <UsageAnalyticsSection />
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals">
            <ReferralSection />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  Your credit purchases and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!history || history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No transactions yet</p>
                    <p className="text-sm">
                      Purchase credits to start generating
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              tx.amount > 0
                                ? "bg-green-500/10"
                                : "bg-orange-500/10"
                            }`}
                          >
                            {tx.amount > 0 ? (
                              <ArrowUpRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {tx.description}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`font-bold ${
                            tx.amount > 0 ? "text-green-500" : "text-orange-500"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Digest Tab */}
          <TabsContent value="digest">
            <DigestSettingsSection />
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>Credit Costs per Tool</CardTitle>
                <CardDescription>
                  How many credits each tool uses per generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {costs && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(costs).map(([tool, cost]) => (
                      <div
                        key={tool}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <span className="text-sm capitalize">
                          {tool.replace(/-/g, " ")}
                        </span>
                        <Badge variant={cost === 0 ? "secondary" : "default"}>
                          {cost === 0
                            ? "Free"
                            : `${cost} credit${cost > 1 ? "s" : ""}`}
                        </Badge>
                      </div>
                    ))}
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
