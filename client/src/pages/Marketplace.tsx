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

// Trending showcase images (use gallery images NOT on homepage)
const TRENDING_IMAGES = [
  { src: "/showcase/gallery-13.jpg", prompt: "Ethereal spirit wolf in northern lights" },
  { src: "/showcase/gallery-14.jpg", prompt: "Cybernetic butterfly garden at dusk" },
  { src: "/showcase/gallery-15.jpg", prompt: "Ancient temple overgrown with crystals" },
  { src: "/showcase/gallery-16.jpg", prompt: "Neon geisha in rain-soaked Tokyo alley" },
  { src: "/showcase/gallery-17.jpg", prompt: "Floating islands with waterfalls into clouds" },
  { src: "/showcase/gallery-18.jpg", prompt: "Mechanical dragon emerging from volcano" },
  { src: "/showcase/gallery-19.jpg", prompt: "Underwater city with bioluminescent architecture" },
  { src: "/showcase/gallery-20.jpg", prompt: "Cosmic tree of life in deep space nebula" },
];

// Creator spotlight placeholder (shown when no real creators exist yet)
const CREATOR_SPOTLIGHTS: { name: string; specialty: string; sales: string; images: string[] }[] = [];

// What you can sell categories with images
const SELL_CATEGORIES = [
  { type: "Prompts", desc: "Curated prompt collections that produce stunning results", image: "/showcase/tool-promptbuild.jpg", color: "#a78bfa" },
  { type: "Presets", desc: "Style presets and color grades for consistent aesthetics", image: "/showcase/tool-colorgrade.jpg", color: "#60a5fa" },
  { type: "Workflows", desc: "Multi-step generation workflows for complex outputs", image: "/showcase/tool-canvas.jpg", color: "#34d399" },
  { type: "Asset Packs", desc: "Bundled textures, backgrounds, and design elements", image: "/showcase/tool-texture.jpg", color: "#f472b6" },
  { type: "LoRAs", desc: "Fine-tuned model adapters for unique artistic styles", image: "/showcase/tool-style-transfer.jpg", color: "#fbbf24" },
  { type: "Templates", desc: "Ready-to-use project templates for any creative need", image: "/showcase/tool-mockup.jpg", color: "#f97316" },
];

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
          {/* Layered gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/5 via-transparent to-transparent" />
          {/* Animated gradient mesh orbs */}
          <div className="absolute top-10 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] animate-[pulse_6s_ease-in-out_infinite]" />
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCBmaWxsPSJ1cmwoI2dyaWQpIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIi8+PC9zdmc+')] opacity-60" />
          <div className="container relative py-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-6">
                <Store className="h-4 w-4" />
                Creator Marketplace
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Buy and sell{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  AI-generated assets
                </span>
              </h1>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-2">
                Discover premium prompts, presets, workflows, and more from talented creators in the DreamForgeX community.
              </p>
              <h2 className="text-white/50 text-sm mt-2 mb-6">Join thousands of creators buying and selling AI assets</h2>
              {user && (
                <Link href="/marketplace/sell">
                  <Button size="lg" className="gap-2 shadow-lg shadow-cyan-500/20">
                    <Plus className="h-4 w-4" />
                    Sell Your Creations
                  </Button>
                </Link>
              )}
            </motion.div>

            {/* Stats Bar — only show real stats when listings exist, otherwise show launch CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10"
            >
              {total > 0
                ? [
                    { label: "Listings", value: String(total) },
                    { label: "Creators", value: "Growing" },
                    { label: "Asset Types", value: "6" },
                    { label: "Avg Rating", value: "4.8\u2605" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center"
                    >
                      <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                    </div>
                  ))
                : [
                    { label: "Asset Types", value: "6 Categories" },
                    { label: "Revenue Share", value: "85%" },
                    { label: "Payout", value: "Instant" },
                    { label: "Status", value: "Launching Soon" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center"
                    >
                      <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        {stat.value}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                    </div>
                  ))}
            </motion.div>

            {/* Category Pills — hide when all counts are 0 */}
            {categories && categories.length > 0 && categories.some((cat: any) => cat.count > 0) && (
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
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-md"
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

        {/* Trending Creations Strip */}
        {!hasFilters && page === 0 && (
          <div className="py-12 overflow-hidden border-b border-white/5">
            <div className="container mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="flex items-center gap-3"
              >
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-semibold">Trending Creations</h2>
                <span className="text-xs text-muted-foreground">See what the community is creating</span>
              </motion.div>
            </div>
            <div className="relative">
              <div className="flex gap-4 animate-marquee-slow">
                {[...TRENDING_IMAGES, ...TRENDING_IMAGES].map((img, i) => (
                  <div
                    key={i}
                    className="group relative flex-shrink-0 w-64 aspect-[4/3] rounded-xl overflow-hidden"
                  >
                    <img
                      src={img.src}
                      alt={img.prompt}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <p className="text-xs text-white/90 line-clamp-2">{img.prompt}</p>
                    </div>
                    <div className="absolute inset-0 border border-white/0 group-hover:border-cyan-500/40 rounded-xl transition-colors duration-300 group-hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.2)]" />
                  </div>
                ))}
              </div>
            </div>
            <style>{`
              @keyframes marquee-slow {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-marquee-slow {
                animation: marquee-slow 40s linear infinite;
              }
              .animate-marquee-slow:hover {
                animation-play-state: paused;
              }
            `}</style>
          </div>
        )}

        {/* Featured Section */}
        {featured && featured.length > 0 && !hasFilters && page === 0 && (
          <div className="container py-10">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold">Featured Listings</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white uppercase tracking-wider">Hot</span>
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
                    <div className="group rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.15)]">
                      <div className="aspect-video bg-muted/20 relative overflow-hidden">
                        {item.previewImages?.[0] ? (
                          <img
                            src={item.previewImages[0]}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/5 to-purple-900/10">
                            <Package className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 text-xs font-semibold shadow-sm">Featured</Badge>
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                          <span className="text-sm font-semibold text-cyan-400 whitespace-nowrap">
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

        {/* Browse Section — hide search/filters when marketplace is empty */}
        <div className="container py-8">
          {/* Search Bar + Sort — only show when there are listings or active filters */}
          {(total > 0 || hasFilters) && <div className="flex gap-3 mb-6">
            <div className="relative flex-1 border-cyan-500/30 rounded-md focus-within:shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)] transition-shadow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search prompts, presets, workflows..."
                className="pl-10 h-11 border-cyan-500/30"
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
          </div>}

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

          {/* Results Count — hide when empty and no filters */}
          {browseData && (total > 0 || hasFilters) && (
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
            hasFilters ? (
              <div className="text-center py-24">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
                  <Store className="h-8 w-8 text-muted-foreground opacity-30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-2">No listings match your filters</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">Try adjusting your search or filter criteria</p>
                <Button variant="outline" size="sm" onClick={clearFilters} className="bg-transparent">Clear Filters</Button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Coming Soon Hero Banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                  className="relative rounded-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-blue-600/20 to-purple-600/20" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(6,182,212,0.15),_transparent_60%)]" />
                  <div className="relative px-8 py-12 md:py-16 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-sm font-medium mb-4">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                      </span>
                      Launching Soon
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold mb-3">
                      Be a{" "}
                      <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                        Founding Seller
                      </span>
                    </h3>
                    <p className="text-muted-foreground max-w-lg mx-auto mb-6">
                      The DreamForgeX marketplace is opening soon. List your AI-generated prompts, presets, and creative assets now to be featured on launch day.
                    </p>
                    {user ? (
                      <Link href="/marketplace/sell">
                        <Button size="lg" className="gap-2 shadow-lg shadow-cyan-500/25 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 border-0">
                          <Plus className="h-4 w-4" />
                          List Your First Asset
                        </Button>
                      </Link>
                    ) : (
                      <Button size="lg" className="gap-2 shadow-lg shadow-cyan-500/25 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 border-0">
                        <Plus className="h-4 w-4" />
                        Get Started
                      </Button>
                    )}
                  </div>
                </motion.div>

                {/* Sell Categories Showcase Grid */}
                <div>
                  <div className="text-center mb-8">
                    <h3 className="text-xl md:text-2xl font-bold mb-2">
                      What You Can{" "}
                      <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                        Sell
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Six categories of AI-generated assets. Turn your expertise into income.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {SELL_CATEGORIES.map((cat, i) => (
                      <motion.div
                        key={cat.type}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.5 }}
                        className="group relative rounded-2xl overflow-hidden aspect-[3/2] cursor-pointer"
                      >
                        <img
                          src={cat.image}
                          alt={cat.type}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                        <div className="absolute inset-0 border border-white/0 group-hover:border-cyan-500/30 rounded-2xl transition-colors duration-300" />
                        <div className="relative h-full flex flex-col justify-end p-5">
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit mb-2"
                            style={{ backgroundColor: cat.color + "25", color: cat.color }}
                          >
                            {cat.type}
                          </div>
                          <p className="text-sm text-white/80">{cat.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Example Listing Previews */}
                <div>
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold mb-1">Preview: What Listings Will Look Like</h3>
                    <p className="text-xs text-muted-foreground">These could be yours</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { title: "Cinematic Prompt Pack", type: "Prompts", price: "$4.99", image: "/showcase/gallery-13.jpg" },
                      { title: "Neon Cyberpunk Preset", type: "Presets", price: "$2.99", image: "/showcase/gallery-16.jpg" },
                      { title: "Fantasy Art Workflow", type: "Workflows", price: "$9.99", image: "/showcase/gallery-20.jpg" },
                    ].map((sample, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                        className="group rounded-xl bg-white/5 backdrop-blur-sm border border-dashed border-white/20 overflow-hidden hover:border-cyan-500/30 transition-all duration-300"
                      >
                        <div className="aspect-video relative overflow-hidden">
                          <img src={sample.image} alt={sample.title} className="w-full h-full object-cover opacity-50 group-hover:opacity-75 transition-opacity duration-300 grayscale-[30%] group-hover:grayscale-0" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute top-2 left-2">
                            <Badge className="text-[10px] border-0 bg-cyan-500/20 text-cyan-400">{sample.type}</Badge>
                          </div>
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-semibold text-white">{sample.price}</span>
                          </div>
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="text-sm font-medium">{sample.title}</h3>
                          <p className="text-xs text-muted-foreground italic">This could be your listing</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )
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
                        <div className="group rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden hover:border-cyan-500/30 transition-all duration-300 hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.15)]">
                          <div className="aspect-video bg-muted/20 relative overflow-hidden">
                            {item.previewImages?.[0] ? (
                              <img
                                src={item.previewImages[0]}
                                alt={item.title}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/5 to-purple-900/10">
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

        {/* Creator Spotlight */}
        {!hasFilters && page === 0 && (
          <div className="border-t border-white/5 py-16">
            <div className="container">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-center mb-10"
              >
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  Be the First{" "}
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                    Creator
                  </span>
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  The marketplace is brand new — list your prompts, presets, and assets to start earning today
                </p>
              </motion.div>
              <div className="max-w-2xl mx-auto rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-8 text-center">
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {["/showcase/hero-characters-1.jpg", "/showcase/hero-brandkit-1.jpg", "/showcase/hero-marketplace-1.jpg", "/showcase/gallery-strip-1.jpg"].map((img, j) => (
                    <div key={j} className="aspect-square overflow-hidden rounded-lg">
                      <img src={img} alt="AI generated showcase" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
                <h3 className="font-semibold text-lg mb-2">Start Selling Your AI Creations</h3>
                <p className="text-sm text-muted-foreground mb-4">Upload prompts, presets, workflows, asset packs, LoRAs, and templates. Set your price and earn on every sale.</p>
              </div>
            </div>
          </div>
        )}

        {/* What You Can Sell */}
        <div className="border-t border-white/5 py-16">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                What You Can{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Sell
                </span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Turn your AI expertise into income with six different asset types
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SELL_CATEGORIES.map((cat, i) => (
                <motion.div
                  key={cat.type}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="group relative rounded-2xl overflow-hidden aspect-[3/2]"
                >
                  <img
                    src={cat.image}
                    alt={cat.type}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
                  <div className="absolute inset-0 border border-white/0 group-hover:border-cyan-500/30 rounded-2xl transition-colors duration-300" />
                  <div className="relative h-full flex flex-col justify-end p-5">
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit mb-2"
                      style={{ backgroundColor: cat.color + "25", color: cat.color }}
                    >
                      {cat.type}
                    </div>
                    <p className="text-sm text-white/80">{cat.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Sell CTA */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center mt-12"
            >
              <div className="rounded-2xl bg-gradient-to-r from-blue-900/10 via-purple-900/10 to-blue-900/10 border border-white/10 p-8 md:p-12">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">Start Selling Today</h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Turn your AI creations into income. Join the DreamForgeX marketplace and reach thousands of creators.
                </p>
                {user ? (
                  <Link href="/marketplace/sell">
                    <Button size="lg" className="gap-2 shadow-lg shadow-cyan-500/20">
                      <Plus className="h-4 w-4" />
                      List Your First Asset
                    </Button>
                  </Link>
                ) : (
                  <Button size="lg" className="gap-2 shadow-lg shadow-cyan-500/20">
                    <Plus className="h-4 w-4" />
                    Get Started
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
