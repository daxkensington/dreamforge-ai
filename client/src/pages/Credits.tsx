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
  Crown,
  Medal,
  Timer,
  Shield,
  Flame,
  Hash,
  AtSign,
  Globe,
  Share2,
  MessageCircle,
  Twitter,
  Lock,
  Unlock,
  Gauge,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
                          : "bg-cyan-500/10"
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
// ─── Social Share Section ────────────────────────────────────────────────────
function SocialShareSection() {
  const { data: shareData, isLoading } = trpc.socialShare.getShareLinks.useQuery();

  if (isLoading || !shareData?.shareLinks) return null;

  const { shareLinks } = shareData;

  const handleShare = (platform: string) => {
    let url = "";
    switch (platform) {
      case "twitter":
        url = shareLinks.twitter;
        break;
      case "whatsapp":
        url = shareLinks.whatsapp;
        break;
      case "telegram":
        url = shareLinks.telegram;
        break;
      case "email":
        url = shareLinks.email;
        break;
    }
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(`Opening ${platform}...`);
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(shareLinks.copyText);
    toast.success("Share message copied to clipboard!");
  };

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Share2 className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <CardTitle className="text-lg">Share & Earn</CardTitle>
            <CardDescription>Spread the word on social media</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-500 transition-all"
            onClick={() => handleShare("twitter")}
          >
            <div className="p-2 rounded-full bg-sky-500/10">
              <Twitter className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Twitter</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-500 transition-all"
            onClick={() => handleShare("whatsapp")}
          >
            <div className="p-2 rounded-full bg-green-500/10">
              <MessageCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">WhatsApp</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-500 transition-all"
            onClick={() => handleShare("telegram")}
          >
            <div className="p-2 rounded-full bg-blue-500/10">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Telegram</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-blue-500/10 hover:border-orange-500/30 hover:text-orange-500 transition-all"
            onClick={() => handleShare("email")}
          >
            <div className="p-2 rounded-full bg-blue-500/10">
              <Mail className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium">Email</span>
          </Button>
        </div>

        <div className="flex gap-2">
          <Input
            readOnly
            value={shareLinks.copyText}
            className="text-xs font-mono"
          />
          <Button variant="outline" size="icon" onClick={handleCopyMessage} title="Copy share message">
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Credit Budget Section ──────────────────────────────────────────────────
function CreditBudgetSection() {
  const { data: budget, isLoading: budgetLoading } = trpc.creditBudget.getBudget.useQuery();
  const { data: usage } = trpc.creditBudget.getBudgetUsage.useQuery();
  const utils = trpc.useUtils();

  const [enabled, setEnabled] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [weeklyLimit, setWeeklyLimit] = useState<string>("");
  const [alertThreshold, setAlertThreshold] = useState(80);

  useEffect(() => {
    if (budget?.budget) {
      setEnabled(budget.budget.enabled);
      setDailyLimit(budget.budget.dailyLimit?.toString() || "");
      setWeeklyLimit(budget.budget.weeklyLimit?.toString() || "");
      setAlertThreshold(budget.budget.alertThreshold);
    }
  }, [budget]);

  const updateBudget = trpc.creditBudget.updateBudget.useMutation({
    onSuccess: () => {
      toast.success("Budget settings saved!");
      utils.creditBudget.getBudget.invalidate();
      utils.creditBudget.getBudgetUsage.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to save budget"),
  });

  const handleSave = () => {
    updateBudget.mutate({
      dailyLimit: dailyLimit ? parseInt(dailyLimit) : null,
      weeklyLimit: weeklyLimit ? parseInt(weeklyLimit) : null,
      alertThreshold,
      enabled,
    });
  };

  if (budgetLoading) {
    return <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />;
  }

  return (
    <div className="space-y-6">
      <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Gauge className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Spending Budget</CardTitle>
                <CardDescription>Set daily and weekly credit limits</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="budget-toggle" className="text-sm">Enabled</Label>
              <Switch
                id="budget-toggle"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Budget Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Daily Limit</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="No limit"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  min={1}
                  max={10000}
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">credits/day</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Weekly Limit</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="No limit"
                  value={weeklyLimit}
                  onChange={(e) => setWeeklyLimit(e.target.value)}
                  min={1}
                  max={50000}
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">credits/week</span>
              </div>
            </div>
          </div>

          {/* Alert Threshold */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Alert at {alertThreshold}% usage</Label>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(parseInt(e.target.value))}
              className="w-full accent-amber-500"
              disabled={!enabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <Button onClick={handleSave} disabled={updateBudget.isPending} className="w-full">
            {updateBudget.isPending ? "Saving..." : "Save Budget Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Budget Email Notifications */}
      <BudgetEmailCard />

      {/* Budget Usage Display */}
      {usage?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage.daily.limit && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Daily: {usage.daily.spent} / {usage.daily.limit} credits</span>
                  <span className={usage.daily.percentage >= 100 ? "text-destructive font-bold" : usage.daily.percentage >= 80 ? "text-amber-500" : "text-muted-foreground"}>
                    {usage.daily.percentage}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usage.daily.percentage >= 100 ? "bg-destructive" : usage.daily.percentage >= 80 ? "bg-cyan-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(usage.daily.percentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {usage.weekly.limit && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Weekly: {usage.weekly.spent} / {usage.weekly.limit} credits</span>
                  <span className={usage.weekly.percentage >= 100 ? "text-destructive font-bold" : usage.weekly.percentage >= 80 ? "text-amber-500" : "text-muted-foreground"}>
                    {usage.weekly.percentage}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usage.weekly.percentage >= 100 ? "bg-destructive" : usage.weekly.percentage >= 80 ? "bg-cyan-500" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(usage.weekly.percentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {usage.alerts && usage.alerts.length > 0 && (
              <div className="space-y-2">
                {usage.alerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-500 bg-cyan-500/10 p-2 rounded-lg">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {alert}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Budget Email Card ─────────────────────────────────────────────────────
function BudgetEmailCard() {
  const { data, isLoading } = trpc.budgetEmail.getSettings.useQuery();
  const utils = trpc.useUtils();

  const updateEmail = trpc.budgetEmail.updateEmailSetting.useMutation({
    onSuccess: () => {
      toast.success("Budget email setting updated!");
      utils.budgetEmail.getSettings.invalidate();
    },
    onError: () => toast.error("Failed to update setting"),
  });

  if (isLoading) return null;

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Mail className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Budget Alert Notifications</CardTitle>
              <CardDescription>Get notified when you approach your spending limits</CardDescription>
            </div>
          </div>
          <Switch
            checked={data?.budgetEmailEnabled ?? true}
            onCheckedChange={(checked) => updateEmail.mutate({ budgetEmailEnabled: checked })}
            disabled={updateEmail.isPending}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>When enabled, you'll receive in-app notifications when:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Your daily spending reaches the alert threshold</li>
            <li>Your weekly spending reaches the alert threshold</li>
            <li>Your daily or weekly budget is fully exhausted</li>
          </ul>
          <p className="text-xs mt-3 text-muted-foreground/70">
            Alerts are sent at most once per day per budget period to avoid notification fatigue.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Achievement Share Button ──────────────────────────────────────────────
function AchievementShareButton({ achievementType }: { achievementType: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = trpc.achievementShare.getShareLinks.useQuery(
    { achievementType },
    { enabled: open }
  );

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="absolute top-1 right-1 p-1 rounded-full bg-background/80 hover:bg-background border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Share achievement"
      >
        <Share2 className="w-3 h-3" />
      </button>
    );
  }

  return (
    <div className="absolute inset-0 bg-background/95 rounded-lg flex flex-col items-center justify-center gap-2 z-10 p-2">
      <div className="text-xs font-medium mb-1">Share</div>
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : data?.shareLinks ? (
        <div className="flex gap-2">
          <a href={data.shareLinks.twitter} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors" title="Twitter">
            <Twitter className="w-3.5 h-3.5 text-blue-500" />
          </a>
          <a href={data.shareLinks.whatsapp} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-full bg-green-500/10 hover:bg-green-500/20 transition-colors" title="WhatsApp">
            <MessageCircle className="w-3.5 h-3.5 text-green-500" />
          </a>
          <a href={data.shareLinks.telegram} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors" title="Telegram">
            <Send className="w-3.5 h-3.5 text-cyan-500" />
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(data.shareLinks!.copyText);
              toast.success("Copied to clipboard!");
            }}
            className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors" title="Copy">
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}
      <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
        Close
      </button>
    </div>
  );
}

// ─── Achievement Section ────────────────────────────────────────────────────
function AchievementSection() {
  const { data, isLoading } = trpc.achievement.getAchievements.useQuery();
  const utils = trpc.useUtils();

  const checkAchievements = trpc.achievement.checkAndUnlock.useMutation({
    onSuccess: (result) => {
      if (result.newlyUnlocked.length > 0) {
        result.newlyUnlocked.forEach((a) => {
          toast.success(`Achievement Unlocked: ${a.name}!`, {
            description: a.description,
            duration: 5000,
          });
        });
        utils.achievement.getAchievements.invalidate();
      } else {
        toast.info("No new achievements to unlock yet. Keep creating!");
      }
    },
    onError: () => toast.error("Failed to check achievements"),
  });

  if (isLoading) {
    return <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />;
  }

  const iconMap: Record<string, any> = {
    Sparkles, Zap, Flame, Crown, Trophy, Users, Heart: Gift, Globe, CreditCard, Image: Star, Settings, Star,
  };

  return (
    <div className="space-y-6">
      {/* Achievement Summary */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Trophy className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Achievements</CardTitle>
                <CardDescription>
                  {data?.totalUnlocked || 0} of {data?.totalAchievements || 0} unlocked
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => checkAchievements.mutate()}
              disabled={checkAchievements.isPending}
            >
              {checkAchievements.isPending ? "Checking..." : "Check Progress"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress Bar */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">
                {data?.totalUnlocked || 0}/{data?.totalAchievements || 0}
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                style={{
                  width: `${data?.totalAchievements ? ((data.totalUnlocked / data.totalAchievements) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Unlocked Achievements */}
          {data?.unlocked && data.unlocked.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Unlock className="w-4 h-4 text-emerald-500" />
                Unlocked
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.unlocked.map((a) => {
                  const IconComp = iconMap[a.icon] || Star;
                  return (
                    <TooltipProvider key={a.type}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative group p-3 rounded-lg border border-border/50 bg-gradient-to-br from-background to-muted/30 text-center hover:shadow-md transition-all cursor-default">
                            <AchievementShareButton achievementType={a.type} />
                            <div
                              className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                              style={{ backgroundColor: `${a.color}20` }}
                            >
                              <IconComp className="w-5 h-5" style={{ color: a.color }} />
                            </div>
                            <div className="text-xs font-medium truncate">{a.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString() : ""}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {data?.locked && data.locked.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Locked
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {data.locked.map((a) => {
                  const IconComp = iconMap[a.icon] || Star;
                  return (
                    <TooltipProvider key={a.type}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-3 rounded-lg border border-border/30 bg-muted/20 text-center opacity-60 hover:opacity-80 transition-all cursor-default">
                            <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center bg-muted/50">
                              <IconComp className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="text-xs font-medium truncate text-muted-foreground">{a.name}</div>
                            {/* Progress bar */}
                            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-muted-foreground/30"
                                style={{ width: `${a.progress}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {a.current}/{a.threshold}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.description}</p>
                          <p className="text-xs mt-1">Progress: {a.current}/{a.threshold} ({a.progress}%)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TierProgressSection() {
  const { data: tierData, isLoading } = trpc.tieredReferral.getTierProgress.useQuery();

  if (isLoading) {
    return <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />;
  }

  if (!tierData) return null;

  const { totalReferrals, currentTier, nextTier, tiers, tierBonusesEarned } = tierData;

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
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

// ─── Leaderboard Section ──────────────────────────────────────────────────
function LeaderboardSection() {
  const { user } = useAuth() as any;
  const { data: leaderboard, isLoading } = trpc.leaderboard.getLeaderboard.useQuery({ limit: 20 });
  const { data: myRank } = trpc.leaderboard.getMyRank.useQuery(undefined, { enabled: !!user });

  if (isLoading) {
    return <div className="h-48 bg-muted/50 animate-pulse rounded-lg" />;
  }

  const rankIcons = [Crown, Medal, Award];
  const rankColors = ["text-cyan-400", "text-gray-400", "text-amber-600"];

  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Crown className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <CardTitle>Referral Leaderboard</CardTitle>
              <CardDescription>
                Top referrers in the DreamForge community
              </CardDescription>
            </div>
          </div>
          {myRank?.rank && (
            <Badge variant="outline" className="gap-1 border-indigo-500/30 text-indigo-400">
              <Hash className="w-3 h-3" />
              Your Rank: {myRank.rank} of {myRank.totalParticipants}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!leaderboard?.entries || leaderboard.entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No referrals yet — be the first!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.entries.map((entry) => {
              const isMe = user && entry.userId === user.id;
              const RankIcon = entry.rank <= 3 ? rankIcons[entry.rank - 1] : null;
              const rankColor = entry.rank <= 3 ? rankColors[entry.rank - 1] : "text-muted-foreground";

              return (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                    isMe
                      ? "bg-primary/10 border border-primary/20 shadow-sm"
                      : entry.rank <= 3
                      ? "bg-muted/60"
                      : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                      entry.rank <= 3 ? "bg-background/80" : ""
                    }`}>
                      {RankIcon ? (
                        <RankIcon className={`w-5 h-5 ${rankColor}`} />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          {entry.rank}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {entry.displayName}
                        {isMe && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            You
                          </Badge>
                        )}
                      </div>
                      {entry.tier && (
                        <div className="text-xs" style={{ color: entry.tier.color }}>
                          {entry.tier.name} Tier
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">
                      {entry.referralCount}
                    </span>
                    <span className="text-xs text-muted-foreground">referrals</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Credit Expiration Warning Section ────────────────────────────────────
function CreditExpirationSection() {
  const { data: expirationSummary } = trpc.creditExpiration.getExpirationSummary.useQuery();
  const { data: expiringCredits } = trpc.creditExpiration.getExpiringCredits.useQuery();

  if (!expirationSummary?.hasExpiringCredits) return null;

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-red-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Timer className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <CardTitle className="text-orange-500">Credits Expiring Soon</CardTitle>
            <CardDescription>
              {expirationSummary.totalExpiringSoon} credits expiring within 7 days
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {expiringCredits?.expiringCredits && expiringCredits.expiringCredits.length > 0 ? (
          <div className="space-y-2">
            {expiringCredits.expiringCredits.map((credit) => (
              <div
                key={credit.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-blue-500/10"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {credit.description || "Bonus credits"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expires in {credit.daysLeft} day{credit.daysLeft !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="border-orange-500/30 text-blue-400">
                  {credit.amount} credits
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Use your credits before they expire!
          </div>
        )}
        <div className="mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <p>Bonus and referral credits expire after 90 days. Purchased credits never expire.</p>
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

// ─── Email Digest Section ─────────────────────────────────────────────────
function EmailDigestSection() {
  const { data: emailPrefs, isLoading } = trpc.emailDigest.getEmailPreferences.useQuery();
  const utils = trpc.useUtils();

  const updateEmailPrefs = trpc.emailDigest.updateEmailPreferences.useMutation({
    onSuccess: () => {
      toast.success("Email digest preferences updated");
      utils.emailDigest.getEmailPreferences.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update email preferences");
    },
  });

  const sendTestEmail = trpc.emailDigest.sendTestEmail.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(data.message || "Test email sent!");
      } else {
        toast.info(data.message || "Could not send test email");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send test email");
    },
  });

  if (isLoading) {
    return <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />;
  }

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <AtSign className="w-6 h-6 text-cyan-500" />
          </div>
          <div>
            <CardTitle>Email Digest Delivery</CardTitle>
            <CardDescription>
              Receive your usage digest via email notification in addition to in-app
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch
              checked={emailPrefs?.emailEnabled ?? false}
              onCheckedChange={(checked) =>
                updateEmailPrefs.mutate({ emailEnabled: checked })
              }
            />
            <Label className="text-sm font-medium">
              {emailPrefs?.emailEnabled ? "Email digest enabled" : "Email digest disabled"}
            </Label>
          </div>
        </div>

        {emailPrefs?.email ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="w-4 h-4" />
            Digests will be sent to: <span className="font-medium text-foreground">{emailPrefs.email}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-amber-500">
            <AlertTriangle className="w-4 h-4" />
            No email address on file. Email digests will be sent as notifications.
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendTestEmail.mutate()}
            disabled={sendTestEmail.isPending}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {sendTestEmail.isPending ? "Sending..." : "Send Test Email"}
          </Button>
        </div>

        <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <p>Email digests include a beautifully formatted HTML summary of your usage stats, top tools, spending trends, and balance. Enable both in-app and email digests for maximum visibility.</p>
        </div>
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

        {/* Credit Expiration Warning */}
        <CreditExpirationSection />

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
            <TabsTrigger value="budget">
              <Gauge className="w-4 h-4 mr-2" />
              Budget
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
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
            <div className="space-y-6">
              <ReferralSection />
              <SocialShareSection />
              <TierProgressSection />
              <LeaderboardSection />
            </div>
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
                                : "bg-blue-500/10"
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
            <div className="space-y-6">
              <DigestSettingsSection />
              <EmailDigestSection />
            </div>
          </TabsContent>

          {/* Budget Tab */}
          <TabsContent value="budget">
            <CreditBudgetSection />
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <AchievementSection />
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
