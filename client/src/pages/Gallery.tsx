import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageLayout from "@/components/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { galleryDemoHref } from "@/lib/galleryDemoHref";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Film,
  Image,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import styles from "./Gallery.module.css";

const PAGE_SIZE = 24;

const showcaseImages = [
  {
    src: "/showcase/gallery-1.jpg",
    title: "Underwater cathedral",
    prompt: "Bioluminescent underwater cathedral with jellyfish stained glass",
  },
  {
    src: "/showcase/gallery-2.jpg",
    title: "Neon rain",
    prompt: "Cyberpunk samurai in neon rain, holographic katana",
  },
  {
    src: "/showcase/gallery-3.jpg",
    title: "Forest library",
    prompt: "Enchanted forest library where trees are bookshelves",
  },
  {
    src: "/showcase/gallery-4.jpg",
    title: "Crystal phoenix",
    prompt: "Crystalline phoenix emerging from a supernova",
  },
  {
    src: "/showcase/gallery-5.jpg",
    title: "Clockwork android",
    prompt: "Android woman with clockwork face, art nouveau",
  },
  {
    src: "/showcase/gallery-6.jpg",
    title: "Alien monuments",
    prompt: "Alien landscape with geometric monuments at sunset",
  },
];

const modelOptions = [
  ["built-in-v1", "Built-in v1"],
  ["stable-diffusion-xl", "SDXL"],
  ["stable-diffusion-3", "SD 3"],
  ["animatediff-v2", "AnimateDiff v2"],
  ["animatediff-lightning", "AnimateDiff Lightning"],
] as const;

const sortOptions = {
  newest: "Newest first",
  oldest: "Oldest first",
  most_viewed: "Most viewed",
} as const;

type SortOption = keyof typeof sortOptions;
type GalleryItem =
  inferRouterOutputs<AppRouter>["gallery"]["list"]["items"][number];

function itemMetadata(item: GalleryItem) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    imageUrl: item.generation?.imageUrl,
    prompt: item.generation?.prompt,
    model: item.generation?.modelVersion,
    mediaType: item.generation?.mediaType,
    dimensions: `${item.generation?.width}x${item.generation?.height}`,
    tags: item.tags?.map(tag => tag.name),
    creator: item.userName,
  };
}

export default function Gallery() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [modelVersion, setModelVersion] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState(
    () => new Map<number, ReturnType<typeof itemMetadata>>()
  );

  const { data: tags } = trpc.tags.list.useQuery();
  const gallery = trpc.gallery.list.useQuery({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    search: search || undefined,
    tagSlugs: selectedTags.length ? selectedTags : undefined,
    modelVersion: modelVersion || undefined,
    sort,
  });
  const items = gallery.data?.items ?? [];
  const total = gallery.data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = Boolean(
    search || selectedTags.length || modelVersion || sort !== "newest"
  );
  const filterCount = selectedTags.length + (modelVersion ? 1 : 0);

  const tagsByCategory = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof tags>>();
    for (const tag of tags ?? []) {
      const category = tag.category || "other";
      const group = groups.get(category);
      if (group) group.push(tag);
      else groups.set(category, [tag]);
    }
    return Array.from(groups);
  }, [tags]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(0);
  }

  function toggleTag(slug: string) {
    setSelectedTags(prev =>
      prev.includes(slug) ? prev.filter(tag => tag !== slug) : [...prev, slug]
    );
    setPage(0);
  }

  function clearFilters() {
    setSelectedTags([]);
    setModelVersion("");
    setSearch("");
    setSearchInput("");
    setSort("newest");
    setPage(0);
  }

  function toggleSelectItem(item: GalleryItem) {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, itemMetadata(item));
      return next;
    });
  }

  function handleBulkExport() {
    if (!selectedItems.size) return;
    try {
      const json = JSON.stringify(Array.from(selectedItems.values()), null, 2);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `dreamforge-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(
        `Exported metadata for ${selectedItems.size} ${selectedItems.size === 1 ? "item" : "items"}`
      );
      setSelectedItems(new Map());
    } catch {
      toast.error("Export failed");
    }
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    document
      .getElementById("community-results")
      ?.scrollIntoView({ block: "start" });
  }

  return (
    <PageLayout>
      <div className={styles.page}>
        <header className={styles.hero}>
          <img
            src="/showcase/gallery-1.jpg"
            alt=""
            aria-hidden="true"
            className={styles.heroArt}
          />
          <div className={styles.container}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>DreamForgeX Showcase</p>
              <h1>
                Community <em>Gallery</em>
              </h1>
              <p>
                Explore AI art from DreamForgeX and the community. Pick an image
                and adapt its prompt to make something of your own.
              </p>
              <div className={styles.heroActions}>
                <a href="#featured-showcase" className={styles.primary}>
                  Explore the showcase{" "}
                  <ArrowDown size={16} aria-hidden="true" />
                </a>
                <a href="#community-work" className={styles.secondary}>
                  Browse community work
                </a>
              </div>
            </div>
          </div>
        </header>

        <div className={styles.container}>
          <section
            id="featured-showcase"
            className={styles.section}
            aria-labelledby="featured-showcase-title"
          >
            <div className={styles.sectionHead}>
              <h2 id="featured-showcase-title">Featured showcase</h2>
              <p>
                Start with a DreamForgeX example and edit its prompt in the free
                demo.
              </p>
            </div>
            <div className={styles.galleryGrid}>
              {showcaseImages.map(image => (
                <article key={image.src} className={styles.showcaseCard}>
                  <div className={styles.showcaseMedia}>
                    <img
                      src={image.src}
                      alt={image.title}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className={styles.showcaseBody}>
                    <h3>{image.title}</h3>
                    <p>{image.prompt}</p>
                    <a
                      className={styles.promptLink}
                      href={galleryDemoHref(image.prompt)}
                      aria-label={`Try this prompt: ${image.title}`}
                    >
                      Try this prompt{" "}
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            id="community-work"
            className={styles.community}
            aria-labelledby="community-work-title"
          >
            <div className={styles.sectionHead}>
              <h2 id="community-work-title">Community work</h2>
            </div>
            <div className={styles.toolbar}>
              <form
                className={styles.search}
                role="search"
                onSubmit={handleSearch}
              >
                <label className={styles.searchField}>
                  <Search size={17} aria-hidden="true" />
                  <span className="sr-only">Search community work</span>
                  <input
                    type="search"
                    value={searchInput}
                    onChange={event => setSearchInput(event.target.value)}
                    placeholder="Search prompts, titles, descriptions"
                  />
                </label>
                <button type="submit" className={styles.primary}>
                  Search
                </button>
              </form>
              <div className={styles.toolbarActions}>
                <select
                  aria-label="Sort community work"
                  value={sort}
                  onChange={event => {
                    setSort(event.target.value as SortOption);
                    setPage(0);
                  }}
                >
                  {Object.entries(sortOptions).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.secondary}
                  aria-expanded={showFilters}
                  aria-controls="gallery-filters"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal size={16} aria-hidden="true" />
                  Filters{filterCount > 0 ? ` (${filterCount})` : ""}
                </button>
              </div>
            </div>

            <div
              id="gallery-filters"
              className={styles.filterPanel}
              hidden={!showFilters}
            >
              {tagsByCategory.map(([category, categoryTags]) => (
                <div key={category} className={styles.filterGroup}>
                  <p>{category}</p>
                  <div className={styles.filterChips}>
                    {categoryTags.map(tag => (
                      <button
                        key={tag.slug}
                        type="button"
                        className={styles.chip}
                        aria-pressed={selectedTags.includes(tag.slug)}
                        onClick={() => toggleTag(tag.slug)}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <label className={styles.filterGroup}>
                <span>Model version</span>
                <select
                  value={modelVersion}
                  onChange={event => {
                    setModelVersion(event.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">All models</option>
                  {modelOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div id="community-results" className={styles.summary}>
              <p role="status">
                {gallery.isLoading
                  ? "Loading community work…"
                  : gallery.isError
                    ? "Community work is temporarily unavailable."
                    : `${total} ${total === 1 ? "result" : "results"}${search ? ` for “${search}”` : ""}`}
              </p>
              <div>
                {hasFilters && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
                {selectedItems.size > 0 && (
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={handleBulkExport}
                  >
                    <Download size={16} aria-hidden="true" /> Export{" "}
                    {selectedItems.size} selected
                  </button>
                )}
              </div>
            </div>

            {gallery.isLoading ? (
              <div className={styles.communityGrid} aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton className="aspect-square rounded-xl" key={i} />
                ))}
              </div>
            ) : gallery.isError ? (
              <div className={styles.empty}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void gallery.refetch()}
                >
                  Retry community work
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className={styles.empty}>
                <Image size={30} aria-hidden="true" />
                <p>
                  {hasFilters
                    ? "No work matches those filters."
                    : "No community work has been shared yet."}
                </p>
              </div>
            ) : (
              <div className={styles.communityGrid}>
                {items.map(item => {
                  const title = item.title || "Untitled artwork";
                  const generation = item.generation;

                  return (
                    <article key={item.id} className={styles.communityCard}>
                      <Link
                        href={`/gallery/${item.id}`}
                        onClick={event => {
                          if (
                            !event.shiftKey &&
                            !event.ctrlKey &&
                            !event.metaKey
                          )
                            return;
                          event.preventDefault();
                          toggleSelectItem(item);
                        }}
                      >
                        <div className={styles.communityMedia}>
                          {generation?.imageUrl ? (
                            <img
                              src={generation.imageUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <Image size={30} aria-hidden="true" />
                          )}
                          {generation?.mediaType === "video" && (
                            <span className={styles.mediaBadge}>
                              <Film size={14} aria-hidden="true" />{" "}
                              {generation.duration || 4}s video
                            </span>
                          )}
                          <span className={styles.viewBadge}>
                            <Eye size={14} aria-hidden="true" />{" "}
                            {item.viewCount ?? 0} views
                          </span>
                        </div>
                        <div className={styles.communityBody}>
                          <h3>{title}</h3>
                          <p>By {item.userName || "Anonymous"}</p>
                          <div className={styles.badges}>
                            {item.featured && <span>Featured</span>}
                            {generation?.modelVersion && (
                              <span>{generation.modelVersion}</span>
                            )}
                            {item.tags?.slice(0, 3).map(tag => (
                              <span key={tag.slug}>{tag.name}</span>
                            ))}
                            {item.tags && item.tags.length > 3 && (
                              <span>+{item.tags.length - 3}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        className={styles.selection}
                        aria-label={`Select ${title} for metadata export`}
                        aria-pressed={selectedItems.has(item.id)}
                        onClick={() => toggleSelectItem(item)}
                      >
                        {selectedItems.has(item.id) && (
                          <Check size={15} aria-hidden="true" />
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <nav
                className={styles.pagination}
                aria-label="Community work pages"
              >
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => changePage(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> Previous
                </button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => changePage(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next <ChevronRight size={16} aria-hidden="true" />
                </button>
              </nav>
            )}
          </section>

          <div className={styles.disclaimer}>
            <DisclaimerBanner />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
