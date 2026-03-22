/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// ─── Multi-Model Generation Types ──────────────────────────────────────────

/** Provider identifiers for AI generation services. */
export type AIProvider = "forge" | "stability" | "openai" | "replicate" | "local";

/** Subscription tier levels. */
export type UserTier = "free" | "creator" | "pro" | "studio";

/** Media generation type. */
export type GenerationMediaType = "image" | "video" | "audio";

/** Model definition exposed to the client for model selection UI. */
export interface AIModelInfo {
  id: string;
  name: string;
  provider: AIProvider;
  type: GenerationMediaType;
  capabilities: string[];
  maxResolution: { width: number; height: number };
  creditCost: { base: number; hd?: number; ultra?: number };
  isAvailable: boolean;
  tier: UserTier;
}

/** Request payload for multi-model generation from the client. */
export interface MultiModelGenerationInput {
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  width?: number;
  height?: number;
  steps?: number;
  quality?: "standard" | "hd" | "ultra";
  options?: Record<string, unknown>;
}

/** Result returned to the client after generation completes. */
export interface MultiModelGenerationResult {
  id: string;
  url: string;
  model: string;
  provider: string;
  creditCost: number;
  metadata: Record<string, unknown>;
}

// ─── Audio Generation Types ──────────────────────────────────────────────────

/** Audio generation type categories. */
export type AudioType = "sfx" | "music" | "voiceover" | "ambient";

/** Audio generation status. */
export type AudioStatus = "queued" | "generating" | "complete" | "failed";

/** Audio preset category. */
export type AudioPresetCategory = "cinematic" | "electronic" | "ambient" | "nature" | "urban" | "dramatic";

/** Options for audio generation requests. */
export interface AudioGenerationOptions {
  tempo?: number;
  mood?: string;
  style?: string;
  voiceId?: string;
  syncToVideo?: string;
}

/** Audio generation input from the client. */
export interface AudioGenerationInput {
  type: AudioType;
  prompt: string;
  duration: number;
  options?: AudioGenerationOptions;
  projectId?: number;
}

/** Audio generation record as returned to the client. */
export interface AudioGenerationView {
  id: number;
  type: AudioType;
  prompt: string;
  duration: number;
  model: string;
  status: AudioStatus;
  audioUrl: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  projectId: number | null;
  createdAt: Date;
}

/** Audio preset as returned to the client. */
export interface AudioPresetView {
  id: number;
  name: string;
  category: AudioPresetCategory;
  settings: Record<string, unknown>;
  isDefault: boolean;
  createdAt: Date;
}

/** Result of merging audio + video. */
export interface AudioVideoMergeResult {
  mergedUrl: string;
  status: "complete";
}

// ─── Marketplace Types ──────────────────────────────────────────────────────

export type MarketplaceListingType = "prompt" | "preset" | "workflow" | "asset_pack" | "lora";
export type MarketplaceListingStatus = "draft" | "published" | "suspended";
export type PayoutStatus = "pending" | "paid" | "failed";
export type MarketplaceSortOption = "popular" | "new" | "rating" | "price_low" | "price_high";

export interface MarketplaceCategory {
  type: MarketplaceListingType;
  label: string;
  description: string;
  count: number;
}

export interface MarketplaceListingCard {
  id: number;
  title: string;
  description: string | null;
  type: MarketplaceListingType;
  price: number;
  previewImages: string[];
  tags: string[];
  downloads: number;
  rating: number; // stored as rating * 100 (e.g. 450 = 4.50)
  ratingCount: number;
  sellerName: string | null;
  isFeatured: boolean;
  createdAt: Date;
}

export interface MarketplaceListingDetail extends MarketplaceListingCard {
  sellerId: number;
  promptData: unknown;
  status: MarketplaceListingStatus;
  sellerProfile: {
    id: number;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    totalSales: number;
    isVerified: boolean;
  } | null;
  reviews: MarketplaceReviewView[];
}

export interface MarketplaceReviewView {
  id: number;
  buyerId: number;
  buyerName: string | null;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

export interface MarketplacePurchaseView {
  id: number;
  listingId: number;
  listingTitle: string;
  listingType: MarketplaceListingType;
  sellerName: string | null;
  price: number;
  platformFee: number;
  sellerPayout: number;
  createdAt: Date;
}

export interface SellerDashboardView {
  profile: {
    id: number;
    displayName: string;
    totalSales: number;
    totalEarnings: number;
    payoutBalance: number;
    isVerified: boolean;
    stripeConnectId: string | null;
  } | null;
  recentSales: Array<{
    id: number;
    listingTitle: string;
    buyerName: string | null;
    price: number;
    sellerPayout: number;
    createdAt: Date;
  }>;
  listings: Array<{
    id: number;
    title: string;
    type: MarketplaceListingType;
    price: number;
    downloads: number;
    rating: number;
    status: MarketplaceListingStatus;
  }>;
  payouts: Array<{
    id: number;
    amount: number;
    status: PayoutStatus;
    createdAt: Date;
  }>;
}

export interface TopSellerView {
  id: number;
  userId: number;
  displayName: string;
  userName: string | null;
  avatarUrl: string | null;
  totalSales: number;
  totalEarnings: number;
  isVerified: boolean;
}
