import DisclaimerBanner from "@/components/DisclaimerBanner";
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
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Image,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Film,
  Sparkles,
  ArrowUpDown,
  Download,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const PAGE_SIZE = 24;

type SortOption = "newest" | "oldest" | "most_viewed";

export default function Gallery() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [modelVersion, setModelVersion] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const { data: tags } = trpc.tags.list.useQuery();

  const queryInput = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      search: search || undefined,
      tagSlugs: selectedTags.length > 0 ? selectedTags : undefined,
      modelVersion: modelVersion || undefined,
      sort,
    }),
    [page, search, selectedTags.join(","), modelVersion, sort]
  );

  const { data: galleryData, isLoading } = trpc.gallery.list.useQuery(queryInput);

  const items = galleryData?.items ?? [];
  const total = galleryData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(0);
  }, [searchInput]);

  const toggleTag = useCallback((slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedTags([]);
    setModelVersion("");
    setSearch("");
    setSearchInput("");
    setSort("newest");
    setPage(0);
  }, []);

  const hasFilters = selectedTags.length > 0 || search || modelVersion || sort !== "newest";

  const tagsByCategory = useMemo(() => {
    if (!tags) return {};
    const grouped: Record<string, typeof tags> = {};
    for (const tag of tags) {
      const cat = tag.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(tag);
    }
    return grouped;
  }, [tags]);

  const toggleSelectItem = (id: number) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkExport = async () => {
    if (selectedItems.length === 0) {
      toast.info("Select items to export by clicking on them");
      return;
    }
    setIsExporting(true);
    try {
      // Download images individually and create a simple export
      const exportData = items
        .filter((item) => selectedItems.includes(item.id))
        .map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          imageUrl: item.generation?.imageUrl,
          prompt: item.generation?.prompt,
          model: item.generation?.modelVersion,
          mediaType: item.generation?.mediaType,
          dimensions: `${item.generation?.width}x${item.generation?.height}`,
          tags: item.tags?.map((t: any) => t.name),
          creator: item.userName,
        }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `genesis-synth-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported metadata for ${selectedItems.length} items`);
      setSelectedItems([]);
    } catch {
      toast.error("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Community Gallery
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover stunning AI-generated art from our creator community
              {galleryData && <span className="ml-1">({total} items)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && (
              <Button
                size="sm"
                onClick={handleBulkExport}
                disabled={isExporting}
                className="gap-1.5"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export {selectedItems.length} items
              </Button>
            )}
            <DisclaimerBanner compact />
          </div>
        </div>

        {/* Search Bar + Sort */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search prompts, titles, descriptions..."
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
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="most_viewed">Most Viewed</SelectItem>
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
                {selectedTags.length + (search ? 1 : 0) + (modelVersion ? 1 : 0)}
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
              <div className="p-5 rounded-xl border border-border/50 bg-card/50 space-y-4">
                {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                  <div key={category}>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block capitalize">
                      {category}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categoryTags.map((tag) => (
                        <Badge
                          key={tag.slug}
                          variant={selectedTags.includes(tag.slug) ? "default" : "outline"}
                          className={`cursor-pointer transition-all text-xs ${
                            selectedTags.includes(tag.slug) ? "shadow-sm" : "bg-transparent hover:bg-accent"
                          }`}
                          style={
                            selectedTags.includes(tag.slug) && tag.color
                              ? { backgroundColor: tag.color + "30", borderColor: tag.color + "50", color: tag.color }
                              : undefined
                          }
                          onClick={() => toggleTag(tag.slug)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex items-end gap-4 pt-2">
                  <div className="w-48">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                      Model Version
                    </label>
                    <Select value={modelVersion || "all"} onValueChange={(v) => { setModelVersion(v === "all" ? "" : v); setPage(0); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All models" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Models</SelectItem>
                        <SelectItem value="built-in-v1">Built-in v1</SelectItem>
                        <SelectItem value="stable-diffusion-xl">SDXL</SelectItem>
                        <SelectItem value="stable-diffusion-3">SD 3</SelectItem>
                        <SelectItem value="animatediff-v2">AnimateDiff v2</SelectItem>
                        <SelectItem value="animatediff-lightning">AnimateDiff Lightning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                      Clear all filters
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Filter Chips (when panel is hidden) */}
        {hasFilters && !showFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs text-muted-foreground">Active:</span>
            {search && (
              <Badge variant="secondary" className="text-xs gap-1">
                Search: "{search}"
                <X className="h-3 w-3 cursor-pointer" onClick={() => { setSearch(""); setSearchInput(""); }} />
              </Badge>
            )}
            {selectedTags.map((slug) => {
              const tag = tags?.find((t) => t.slug === slug);
              return (
                <Badge key={slug} variant="secondary" className="text-xs gap-1">
                  {tag?.name || slug}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleTag(slug)} />
                </Badge>
              );
            })}
            {modelVersion && (
              <Badge variant="secondary" className="text-xs gap-1">
                Model: {modelVersion}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setModelVersion("")} />
              </Badge>
            )}
            {sort !== "newest" && (
              <Badge variant="secondary" className="text-xs gap-1">
                Sort: {sort.replace("_", " ")}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSort("newest")} />
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-2">Clear all</button>
          </div>
        )}

        {/* Selection hint */}
        {items.length > 0 && selectedItems.length === 0 && (
          <p className="text-[10px] text-muted-foreground mb-4 flex items-center gap-1.5">
            <Download className="h-3 w-3" />
            Click items to select them for bulk metadata export
          </p>
        )}

        {/* Gallery Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[3/4] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mx-auto mb-4">
              <Image className="h-8 w-8 text-muted-foreground opacity-30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {hasFilters ? "No results match your filters" : "No gallery items yet"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
              {hasFilters ? "Try adjusting your search or filter criteria" : "Be the first to share your AI creations with the community"}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="bg-transparent">Clear Filters</Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {items.map((item, i) => {
                  const isSelected = selectedItems.includes(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                    >
                      <div
                        className={`group rounded-xl border overflow-hidden hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer relative ${
                          isSelected ? "border-primary ring-2 ring-primary/30" : "border-border/50"
                        }`}
                        onClick={(e) => {
                          if (e.shiftKey || e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            toggleSelectItem(item.id);
                          }
                        }}
                      >
                        {/* Selection checkbox */}
                        <button
                          className={`absolute top-2 right-2 z-10 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-black/30 border-white/40 text-transparent opacity-0 group-hover:opacity-100"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleSelectItem(item.id);
                          }}
                        >
                          {isSelected && <span className="text-xs font-bold">✓</span>}
                        </button>

                        <Link href={`/gallery/${item.id}`}>
                          <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
                            {item.generation?.imageUrl ? (
                              <img
                                src={item.generation.imageUrl}
                                alt={item.title || "AI artwork"}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Image className="h-8 w-8 text-muted-foreground opacity-30" />
                              </div>
                            )}

                            {item.generation?.mediaType === "video" && (
                              <div className="absolute top-2 left-2 video-badge px-2 py-0.5 rounded-md flex items-center gap-1">
                                <Film className="h-3 w-3 text-white" />
                                <span className="text-[10px] text-white font-medium">
                                  {item.generation?.duration || 4}s
                                </span>
                              </div>
                            )}

                            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm">
                              <Eye className="h-3 w-3 text-white/80" />
                              <span className="text-[10px] text-white/80">{item.viewCount ?? 0}</span>
                            </div>

                            {item.featured && (
                              <div className="absolute top-2 right-10 px-2 py-0.5 rounded-md bg-primary/80 backdrop-blur-sm">
                                <span className="text-[10px] text-white font-medium">Featured</span>
                              </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <div className="absolute bottom-3 left-3 right-3">
                                <span className="text-[10px] text-white/70 font-mono">{item.generation?.modelVersion}</span>
                              </div>
                            </div>
                          </div>

                          <div className="p-3 space-y-2">
                            <h3 className="text-sm font-medium line-clamp-1">{item.title || "Untitled"}</h3>
                            <p className="text-xs text-muted-foreground line-clamp-1">by {item.userName || "Anonymous"}</p>
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {item.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag.slug}
                                    className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/50 text-muted-foreground"
                                    style={tag.color ? { borderColor: tag.color + "40", color: tag.color } : undefined}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {item.tags.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground">+{item.tags.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

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

        <div className="mt-12">
          <DisclaimerBanner />
        </div>
      </div>
    </PageLayout>
  );
}
