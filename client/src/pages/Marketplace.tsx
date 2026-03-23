// @ts-nocheck
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Store,
  Star,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowUpDown,
  X,
  Plus,
  TrendingUp,
  Package,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";

const PAGE_SIZE = 24;

type ListingType = "prompt" | "preset" | "workflow" | "asset_pack" | "lora";
type SortOption = "popular" | "new" | "rating" | "price_low" | "price_high";

const TYPE_LABELS: Record<ListingType, string> = {
  prompt: "Prompts",
  preset: "Presets",
  workflow: "Workflows",
  asset_pack: "Asset Packs",
  lora: "LoRAs",
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

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ListingType | "all">("all");
  const [sort, setSort] = useState<SortOption>("popular");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const queryInput = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      search: search || undefined,
      type: type !== "all" ? type : undefined,
      sort,
      minPrice: minPrice ? Math.round(parseFloat(minPrice) * 100) : undefined,
      maxPrice: maxPrice ? Math.round(parseFloat(maxPrice) * 100) : undefined,
    }),
    [page, search, type, sort, minPrice, maxPrice]
  );

  const { data: browseData, isLoading } = trpc.marketplace.browse.useQuery(queryInput);
  const { data: featured } = trpc.marketplace.getFeatured.useQuery({ limit: 6 });
  const { data: categories } = trpc.marketplace.getCategories.useQuery();

  const listings = browseData?.listings ?? [];
  const total = browseData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(0);
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setType("all");
    setSort("popular");
    setSearch("");
    setSearchInput("");
    setMinPrice("");
    setMaxPrice("");
    setPage(0);
  }, []);

  const hasFilters = type !== "all" || search || sort !== "popular" || minPrice || maxPrice;

  return (
    <PageLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <div className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-900/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="container relative py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6">
                <Store className="h-4 w-4" />
                Creator Marketplace
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Buy and sell{" "}
                <span className="bg-gradient-to-r from-primary via-purple-400 to-primary bg-clip-text text-transparent">
                  AI-generated assets
                </span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
                Discover premium prompts, presets, workflows, and more from talented creators in the DreamForge community.
              </p>
              {user && (
                <Link href="/marketplace/sell">
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    Sell Your Creations
                  </Button>
                </Link>
              )}
            </motion.div>

            {/* Category Pills */}
            {categories && categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="flex flex-wrap justify-center gap-3 mt-10"
              >
                {categories.map((cat: any) => (
                  <button
                    key={cat.type}
                    onClick={() => {
                      setType(cat.type as ListingType);
                      setPage(0);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all text-sm ${
                      type === cat.type
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    {TYPE_LABELS[cat.type as ListingType] || cat.type}
                    <span className="text-xs opacity-70">({cat.count})</span>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Featured Section */}
        {featured && featured.length > 0 && !hasFilters && page === 0 && (
          <div className="container py-10">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Featured Listings</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.slice(0, 3).map((item: any, i: number) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                >
                  <Link href={`/marketplace/${item.id}`}>
                    <div className="group rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                      <div className="aspect-video bg-muted/20 relative overflow-hidden">
                        {item.previewImages?.[0] ? (
                          <img
                            src={item.previewImages[0]}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-purple-900/10">
                            <Package className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-primary/90 text-white border-0 text-xs shadow-sm">Featured</Badge>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                          <span className="text-sm font-semibold text-primary whitespace-nowrap">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">by {item.sellerName || "Anonymous"}</span>
                          <div className="flex items-center gap-2">
                            {item.avgRating > 0 && <StarRating rating={item.avgRating} size={10} />}
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Download className="h-3 w-3" />
                              {item.totalSales || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Browse Section */}
        <div className="container py-8">
          {/* Search Bar + Sort */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search prompts, presets, workflows..."
                className="pl-10 h-11"
              />
            </div>
            <Button onClick={handleSearch} className="h-11 px-6">
              Search
            </Button>
            <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(0); }}>
              <SelectTrigger className="h-11 w-44">
                <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="new">Newest</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className={`h-11 gap-2 bg-transparent ${showFilters ? "border-primary text-primary" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {hasFilters && (
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-6"
              >
                <div className="p-5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                      Type
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={type === "all" ? "default" : "outline"}
                        className={`cursor-pointer transition-all text-xs ${type === "all" ? "shadow-sm" : "bg-transparent hover:bg-accent"}`}
                        onClick={() => { setType("all"); setPage(0); }}
                      >
                        All
                      </Badge>
                      {(Object.keys(TYPE_LABELS) as ListingType[]).map((t) => (
                        <Badge
                          key={t}
                          variant={type === t ? "default" : "outline"}
                          className={`cursor-pointer transition-all text-xs ${type === t ? "shadow-sm" : "bg-transparent hover:bg-accent"}`}
                          style={
                            type === t ? { backgroundColor: TYPE_COLORS[t] + "30", borderColor: TYPE_COLORS[t] + "50", color: TYPE_COLORS[t] } : undefined
                          }
                          onClick={() => { setType(t); setPage(0); }}
                        >
                          {TYPE_LABELS[t]}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="w-32">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                        Min Price
                      </label>
                      <Input
                        type="number"
                        placeholder="$0"
                        value={minPrice}
                        onChange={(e) => { setMinPrice(e.target.value); setPage(0); }}
                        className="h-9"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                        Max Price
                      </label>
                      <Input
                        type="number"
                        placeholder="Any"
                        value={maxPrice}
                        onChange={(e) => { setMaxPrice(e.target.value); setPage(0); }}
                        className="h-9"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Filter Chips */}
          {hasFilters && !showFilters && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs text-muted-foreground">Active:</span>
              {search && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Search: &quot;{search}&quot;
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setSearch(""); setSearchInput(""); }} />
                </Badge>
              )}
              {type !== "all" && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Type: {TYPE_LABELS[type]}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setType("all")} />
                </Badge>
              )}
              {(minPrice || maxPrice) && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Price: {minPrice ? `$${minPrice}` : "$0"} - {maxPrice ? `$${maxPrice}` : "Any"}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => { setMinPrice(""); setMaxPrice(""); }} />
                </Badge>
              )}
              <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-2">Clear all</button>
            </div>
          )}

          {/* Results Count */}
          {browseData && (
            <p className="text-sm text-muted-foreground mb-4">
              {total} {total === 1 ? "listing" : "listings"} found
            </p>
          )}

          {/* Listings Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-video rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="text-center py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
                <Store className="h-8 w-8 text-muted-foreground opacity-30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {hasFilters ? "No listings match your filters" : "No listings yet"}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                {hasFilters ? "Try adjusting your search or filter criteria" : "Be the first to list your AI-generated assets"}
              </p>
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="bg-transparent">Clear Filters</Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {listings.map((item: any, i: number) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                    >
                      <Link href={`/marketplace/${item.id}`}>
                        <div className="group rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                          <div className="aspect-video bg-muted/20 relative overflow-hidden">
                            {item.previewImages?.[0] ? (
                              <img
                                src={item.previewImages[0]}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-purple-900/10">
                                <Package className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <Badge
                                className="text-[10px] border-0 shadow-sm"
                                style={{
                                  backgroundColor: (TYPE_COLORS[item.type as ListingType] || "#888") + "30",
                                  color: TYPE_COLORS[item.type as ListingType] || "#888",
                                }}
                              >
                                {TYPE_LABELS[item.type as ListingType] || item.type}
                              </Badge>
                            </div>
                            <div className="absolute top-2 right-2">
                              <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-semibold text-white">
                                {formatPrice(item.price)}
                              </span>
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.description || "No description"}</p>
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-xs text-muted-foreground">by {item.sellerName || "Anonymous"}</span>
                              <div className="flex items-center gap-3">
                                {item.avgRating > 0 && (
                                  <div className="flex items-center gap-1">
                                    <StarRating rating={item.avgRating} size={10} />
                                    <span className="text-[10px] text-muted-foreground">({item.reviewCount})</span>
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Download className="h-3 w-3" />
                                  {item.totalSales || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-10">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="gap-1.5 bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="gap-1.5 bg-transparent"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sell CTA (bottom) */}
        {!user && (
          <div className="container py-16">
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-purple-900/10 to-primary/10 border border-white/10 p-8 md:p-12 text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Start Selling Today</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Turn your AI creations into income. Join the DreamForge marketplace and reach thousands of creators.
              </p>
              <Button size="lg" className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" />
                Get Started
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
