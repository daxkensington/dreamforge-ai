// @ts-nocheck
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Download,
  ShoppingCart,
  User,
  Shield,
  Package,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
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

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
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

export default function MarketplaceDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);
  const [expandedImage, setExpandedImage] = useState(false);

  const { data: listing, isLoading, error } = trpc.marketplace.getListingDetail.useQuery(
    { id },
    { enabled: !isNaN(id) && id > 0 }
  );

  const purchaseMutation = trpc.marketplace.purchase.useMutation({
    onSuccess: (data) => {
      if (data.free) {
        toast.success("Asset added to your library!");
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.success("Purchase complete!");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const { data: relatedData } = trpc.marketplace.browse.useQuery(
    {
      type: listing?.type as any,
      limit: 4,
      sort: "popular",
    },
    { enabled: !!listing }
  );

  const relatedListings = (relatedData?.listings ?? []).filter((l: any) => l.id !== id).slice(0, 3);

  const handlePurchase = () => {
    if (!user) {
      toast.error("Please sign in to make a purchase");
      return;
    }
    purchaseMutation.mutate({ listingId: id });
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container py-8 md:py-12 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-3 space-y-4">
              <Skeleton className="aspect-video rounded-xl" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="w-20 h-16 rounded-lg" />
                ))}
              </div>
            </div>
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !listing) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Listing Not Found</h1>
          <p className="text-muted-foreground mb-6">This listing may have been removed or doesn't exist.</p>
          <Link href="/marketplace">
            <Button variant="outline" className="gap-2 bg-transparent">
              <ArrowLeft className="h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </PageLayout>
    );
  }

  const images = listing.previewImages?.length ? listing.previewImages : [];

  return (
    <PageLayout>
      <div className="container py-8 md:py-12 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Link href="/marketplace">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-3">
              <ArrowLeft className="h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="md:col-span-3 space-y-3"
          >
            <div
              className="aspect-video rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden relative cursor-pointer"
              onClick={() => images.length > 0 && setExpandedImage(!expandedImage)}
            >
              {images.length > 0 ? (
                <img
                  src={images[currentImage]}
                  alt={listing.title}
                  className={`w-full h-full object-cover transition-all duration-300 ${expandedImage ? "scale-150" : ""}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-purple-900/10">
                  <Package className="h-16 w-16 text-muted-foreground/20" />
                </div>
              )}

              {/* Image navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage((p) => (p - 1 + images.length) % images.length); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage((p) => (p + 1) % images.length); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-white" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`w-20 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                      currentImage === i ? "border-primary ring-1 ring-primary/30" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    <img src={img} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="pt-4">
              <h3 className="text-sm font-medium mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {listing.description || "No description provided."}
              </p>
            </div>

            {/* Tags */}
            {listing.tags && listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {listing.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="bg-transparent text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>

          {/* Sidebar - Purchase & Seller */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="md:col-span-2 space-y-4"
          >
            {/* Title & Price */}
            <div>
              <Badge
                className="text-xs border-0 mb-3"
                style={{
                  backgroundColor: (TYPE_COLORS[listing.type as ListingType] || "#888") + "30",
                  color: TYPE_COLORS[listing.type as ListingType] || "#888",
                }}
              >
                {TYPE_LABELS[listing.type as ListingType] || listing.type}
              </Badge>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-2">{listing.title}</h1>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-primary">{formatPrice(listing.price)}</span>
                {listing.avgRating > 0 && (
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={listing.avgRating} />
                    <span className="text-sm text-muted-foreground">({listing.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {listing.totalSales || 0} sales
                </span>
              </div>
            </div>

            {/* Purchase Button */}
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 space-y-3">
              <Button
                size="lg"
                className="w-full gap-2 shadow-lg shadow-primary/20"
                onClick={handlePurchase}
                disabled={purchaseMutation.isPending}
              >
                {listing.price === 0 ? (
                  <>
                    <Download className="h-4 w-4" />
                    Download Free
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Buy Now - {formatPrice(listing.price)}
                  </>
                )}
              </Button>
              {listing.price > 0 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Secure checkout powered by Stripe. Instant download after purchase.
                </p>
              )}
            </div>

            {/* Seller Profile */}
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 space-y-3">
              <h3 className="text-sm font-medium">Seller</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{listing.sellerName || "Anonymous"}</span>
                    {listing.sellerVerified && (
                      <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {listing.sellerTotalSales || 0} total sales
                  </p>
                </div>
              </div>
            </div>

            {/* Reviews */}
            {listing.reviews && listing.reviews.length > 0 && (
              <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Reviews ({listing.reviewCount})
                  </h3>
                </div>
                <div className="space-y-3">
                  {listing.reviews.slice(0, 5).map((review: any) => (
                    <div key={review.id} className="border-t border-white/5 pt-3 first:border-0 first:pt-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{review.buyerName || "Anonymous"}</span>
                        <StarRating rating={review.rating} size={10} />
                      </div>
                      {review.comment && (
                        <p className="text-xs text-muted-foreground">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Related Listings */}
        {relatedListings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-16"
          >
            <h2 className="text-lg font-semibold mb-6">Related Listings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {relatedListings.map((item: any) => (
                <Link key={item.id} href={`/marketplace/${item.id}`}>
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
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm text-xs font-semibold text-white">
                          {formatPrice(item.price)}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 space-y-1">
                      <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">by {item.sellerName || "Anonymous"}</span>
                        {item.avgRating > 0 && <StarRating rating={item.avgRating} size={10} />}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
