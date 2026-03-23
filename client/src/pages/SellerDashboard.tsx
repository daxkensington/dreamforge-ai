// @ts-nocheck
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Package,
  Plus,
  Eye,
  Edit3,
  Trash2,
  Upload,
  Wallet,
  BarChart3,
  Star,
  ShoppingBag,
  Download,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type ListingType = "prompt" | "preset" | "workflow" | "asset_pack" | "lora";

const TYPE_LABELS: Record<ListingType, string> = {
  prompt: "Prompt",
  preset: "Preset",
  workflow: "Workflow",
  asset_pack: "Asset Pack",
  lora: "LoRA",
};

const TYPE_COLORS: Record<ListingType, string> = {
  prompt: "#a78bfa",
  preset: "#60a5fa",
  workflow: "#34d399",
  asset_pack: "#f472b6",
  lora: "#fbbf24",
};

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function SellerDashboard() {
  const [payoutAmount, setPayoutAmount] = useState("");

  const { data: dashboard, isLoading: dashLoading } = trpc.marketplace.getSellerDashboard.useQuery();
  const { data: myListings, isLoading: listingsLoading, refetch: refetchListings } = trpc.marketplace.getMyListings.useQuery({
    limit: 50,
  });

  const publishMutation = trpc.marketplace.publishListing.useMutation({
    onSuccess: () => {
      toast.success("Listing published!");
      refetchListings();
    },
    onError: (err) => toast.error(err.message),
  });

  const payoutMutation = trpc.marketplace.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Payout requested successfully!");
      setPayoutAmount("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handlePayout = () => {
    const amount = Math.round(parseFloat(payoutAmount) * 100);
    if (isNaN(amount) || amount < 500) {
      toast.error("Minimum payout is $5.00");
      return;
    }
    payoutMutation.mutate({ amount });
  };

  const profile = dashboard?.profile;
  const recentSales = dashboard?.recentSales ?? [];
  const listings = myListings?.listings ?? [];
  const isLoading = dashLoading || listingsLoading;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              Seller Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your listings, track sales, and request payouts
            </p>
          </div>
          <Link href="/marketplace">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Eye className="h-4 w-4" />
              View Marketplace
            </Button>
          </Link>
        </motion.div>

        {/* Earnings Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          ) : (
            <>
              <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Earned</span>
                  <DollarSign className="h-4 w-4 text-green-400" />
                </div>
                <p className="text-2xl font-bold">{formatDollars(profile?.totalEarnings ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Lifetime earnings</p>
              </div>
              <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Available Balance</span>
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <p className="text-2xl font-bold text-primary">{formatDollars(profile?.payoutBalance ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">Ready for payout</p>
              </div>
              <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Sales</span>
                  <TrendingUp className="h-4 w-4 text-yellow-400" />
                </div>
                <p className="text-2xl font-bold">{profile?.totalSales ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Items sold</p>
              </div>
            </>
          )}
        </motion.div>

        {/* Payout Request */}
        {profile && profile.payoutBalance >= 500 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5"
          >
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Request Payout
            </h3>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  type="number"
                  min="5"
                  step="0.01"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder="5.00"
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-background border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button
                onClick={handlePayout}
                disabled={payoutMutation.isPending}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Request Payout
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Minimum payout: $5.00. Available balance: {formatDollars(profile.payoutBalance)}
            </p>
          </motion.div>
        )}

        {/* Sales Chart Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sales Overview
            </h3>
            <Badge variant="outline" className="bg-transparent text-xs">Last 30 days</Badge>
          </div>
          {recentSales.length > 0 ? (
            <div className="space-y-2">
              {recentSales.slice(0, 8).map((sale: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Download className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sale.listingTitle || "Listing"}</p>
                      <p className="text-[10px] text-muted-foreground">{sale.buyerName || "Buyer"}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-green-400 whitespace-nowrap">
                    +{formatDollars(sale.price ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No sales data yet</p>
              <p className="text-xs text-muted-foreground">Sales will appear here once you start selling</p>
            </div>
          )}
        </motion.div>

        {/* My Listings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              My Listings ({listings.length})
            </h3>
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" />
              Create New Listing
            </Button>
          </div>

          {listingsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-16 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <Package className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">No listings yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create your first listing to start selling</p>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" />
                Create New Listing
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((item: any) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden"
                >
                  <div className="aspect-video bg-muted/20 relative overflow-hidden">
                    {item.previewImages?.[0] ? (
                      <img
                        src={item.previewImages[0]}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-purple-900/10">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge
                        className="text-[10px] border-0"
                        style={{
                          backgroundColor: (TYPE_COLORS[item.type as ListingType] || "#888") + "30",
                          color: TYPE_COLORS[item.type as ListingType] || "#888",
                        }}
                      >
                        {TYPE_LABELS[item.type as ListingType] || item.type}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge
                        variant={item.status === "published" ? "default" : "secondary"}
                        className={`text-[10px] ${item.status === "published" ? "bg-green-500/20 text-green-400 border-0" : "bg-yellow-500/20 text-yellow-400 border-0"}`}
                      >
                        {item.status === "published" ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium line-clamp-1">{item.title}</h4>
                      <span className="text-sm font-semibold text-primary whitespace-nowrap">
                        {formatPrice(item.price)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {item.totalSales || 0} sales
                      </span>
                      {item.avgRating > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                          {item.avgRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {item.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 bg-transparent flex-1"
                          onClick={() => publishMutation.mutate({ id: item.id })}
                          disabled={publishMutation.isPending}
                        >
                          <Upload className="h-3 w-3" />
                          Publish
                        </Button>
                      )}
                      <Link href={`/marketplace/${item.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-transparent">
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Payouts History */}
        {dashboard?.payouts && dashboard.payouts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-5"
          >
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Payout History
            </h3>
            <div className="space-y-2">
              {dashboard.payouts.map((payout: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-sm">{formatDollars(payout.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] border-0 ${
                      payout.status === "completed"
                        ? "bg-green-500/20 text-green-400"
                        : payout.status === "pending"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {payout.status}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
