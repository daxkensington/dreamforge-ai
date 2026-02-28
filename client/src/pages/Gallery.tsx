import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  Search,
  Image,
  Eye,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";

const PAGE_SIZE = 24;

export default function Gallery() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const stableTagSlugs = useMemo(() => selectedTags, [selectedTags.join(",")]);

  const { data: tags } = trpc.tags.list.useQuery();
  const { data: galleryData, isLoading } = trpc.gallery.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    tagSlugs: stableTagSlugs.length > 0 ? stableTagSlugs : undefined,
    search: search || undefined,
  });

  const items = galleryData?.items ?? [];
  const total = galleryData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(0);
  };

  const toggleTag = (slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
    setPage(0);
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSearch("");
    setSearchInput("");
    setPage(0);
  };

  const hasFilters = selectedTags.length > 0 || search;

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Research Gallery
          </h1>
          <p className="text-muted-foreground text-sm">
            Browse approved synthetic outputs with advanced taxonomic tagging for academic study.
            All content is 100% mathematically generated.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="space-y-4 mb-8">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search prompts, titles, descriptions..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} variant="secondary">
              Search
            </Button>
            <Button
              variant="outline"
              className="bg-transparent"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {hasFilters && (
                <span className="ml-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {selectedTags.length + (search ? 1 : 0)}
                </span>
              )}
            </Button>
          </div>

          {/* Tag Filters */}
          {showFilters && tags && (
            <div className="p-4 rounded-xl border border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Filter by Tags</span>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                    <X className="h-3 w-3 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.slug) ? "default" : "outline"}
                    className={`cursor-pointer transition-colors text-xs ${
                      selectedTags.includes(tag.slug)
                        ? ""
                        : "bg-transparent hover:bg-accent"
                    }`}
                    onClick={() => toggleTag(tag.slug)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Active filters display */}
          {hasFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Active:</span>
              {search && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Search: "{search}"
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => {
                      setSearch("");
                      setSearchInput("");
                    }}
                  />
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
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "result" : "results"}
          </p>
        </div>

        {/* Gallery Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Image className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">No items found</p>
            <p className="text-sm">
              {hasFilters
                ? "Try adjusting your search or filters"
                : "The gallery is empty. Be the first to contribute!"}
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 bg-transparent">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
              >
                <Link
                  href={`/gallery/${item.id}`}
                  className="group block rounded-xl border border-border/50 overflow-hidden hover:border-border hover:shadow-lg transition-all duration-300"
                >
                  <div className="aspect-[3/4] bg-muted relative overflow-hidden">
                    {item.generation?.imageUrl ? (
                      <img
                        src={item.generation.imageUrl}
                        alt={item.title || "Synthetic output"}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-3 left-3 right-3">
                        <div className="flex items-center gap-2 text-white/80 text-xs">
                          <Eye className="h-3 w-3" />
                          {item.viewCount ?? 0}
                          <span className="ml-auto">{item.generation?.modelVersion}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium truncate">
                      {item.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        by {item.userName || "Anonymous"}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
                          >
                            {tag.name}
                          </span>
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            +{item.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-4">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Bottom Disclaimer */}
        <div className="mt-12">
          <DisclaimerBanner />
        </div>
      </div>
    </PageLayout>
  );
}
