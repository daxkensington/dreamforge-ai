/**
 * Shared tier definitions — used by both server and client.
 * Single source of truth for what each tier gets.
 */

export type TierName = "free" | "creator" | "pro" | "studio" | "business" | "agency";

/** Legacy tier names that should map to new tiers */
export type LegacyTierName = "enterprise";

export interface TierConfig {
  name: string;
  displayName: string;
  monthlyCredits: number;
  dailyCreditsForFree: number;
  maxImageResolution: number;
  maxVideoResolution: string;
  watermark: boolean;
  commercialRights: boolean;
  /** Which model tier this subscription unlocks (free/standard/quality/premium/ultra) */
  modelAccess: "free" | "standard" | "quality" | "ultra";
  songsPerMonth: number;
  musicVideosPerMonth: number;
  songStems: boolean;
  midiExport: boolean;
  marketplaceBrowse: boolean;
  marketplaceBuy: boolean;
  marketplaceSelling: boolean;
  marketplaceRevShare: number;
  apiAccess: boolean;
  apiRequestsPerHour: number;
  teamSeats: number;
  batchLimit: number;
  brandKits: number;
  creditRollover: number;
  priorityQueue: boolean;
  whiteLabel: boolean;
  customLoras: number;
  dedicatedSupport: boolean;
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    name: "free",
    displayName: "Explorer",
    monthlyCredits: 0,
    dailyCreditsForFree: 50, // 50/day = ~1,500/mo
    maxImageResolution: 1024,
    maxVideoResolution: "480p",
    watermark: true,
    commercialRights: false,
    modelAccess: "free",
    songsPerMonth: 150, // 5/day * 30
    musicVideosPerMonth: 30, // 1/day * 30
    songStems: false,
    midiExport: false,
    marketplaceBrowse: true,
    marketplaceBuy: false,
    marketplaceSelling: false,
    marketplaceRevShare: 0,
    apiAccess: false,
    apiRequestsPerHour: 0,
    teamSeats: 0,
    batchLimit: 0,
    brandKits: 0,
    creditRollover: 0,
    priorityQueue: false,
    whiteLabel: false,
    customLoras: 0,
    dedicatedSupport: false,
  },
  creator: {
    name: "creator",
    displayName: "Creator",
    monthlyCredits: 3000,
    dailyCreditsForFree: 0,
    maxImageResolution: 1536,
    maxVideoResolution: "720p",
    watermark: false,
    commercialRights: true,
    modelAccess: "standard",
    songsPerMonth: 100,
    musicVideosPerMonth: 10,
    songStems: false,
    midiExport: false,
    marketplaceBrowse: true,
    marketplaceBuy: false,
    marketplaceSelling: false,
    marketplaceRevShare: 0,
    apiAccess: false,
    apiRequestsPerHour: 0,
    teamSeats: 0,
    batchLimit: 5,
    brandKits: 1,
    creditRollover: 500,
    priorityQueue: false,
    whiteLabel: false,
    customLoras: 0,
    dedicatedSupport: false,
  },
  pro: {
    name: "pro",
    displayName: "Pro",
    monthlyCredits: 10000,
    dailyCreditsForFree: 0,
    maxImageResolution: 2048,
    maxVideoResolution: "1080p",
    watermark: false,
    commercialRights: true,
    modelAccess: "quality",
    songsPerMonth: -1, // unlimited
    musicVideosPerMonth: -1, // unlimited
    songStems: false,
    midiExport: false,
    marketplaceBrowse: true,
    marketplaceBuy: true,
    marketplaceSelling: false,
    marketplaceRevShare: 0,
    apiAccess: false,
    apiRequestsPerHour: 0,
    teamSeats: 0,
    batchLimit: 15,
    brandKits: 3,
    creditRollover: 3000,
    priorityQueue: true,
    whiteLabel: false,
    customLoras: 0,
    dedicatedSupport: false,
  },
  studio: {
    name: "studio",
    displayName: "Studio",
    monthlyCredits: 30000,
    dailyCreditsForFree: 0,
    maxImageResolution: 4096,
    maxVideoResolution: "4K",
    watermark: false,
    commercialRights: true,
    modelAccess: "ultra",
    songsPerMonth: -1, // unlimited
    musicVideosPerMonth: -1, // unlimited
    songStems: true,
    midiExport: true,
    marketplaceBrowse: true,
    marketplaceBuy: true,
    marketplaceSelling: true,
    marketplaceRevShare: 85,
    apiAccess: false,
    apiRequestsPerHour: 0,
    teamSeats: 3,
    batchLimit: 30,
    brandKits: 10,
    creditRollover: 15000,
    priorityQueue: true,
    whiteLabel: false,
    customLoras: 0,
    dedicatedSupport: false,
  },
  business: {
    name: "business",
    displayName: "Business",
    monthlyCredits: 100000,
    dailyCreditsForFree: 0,
    maxImageResolution: 4096,
    maxVideoResolution: "4K",
    watermark: false,
    commercialRights: true,
    modelAccess: "ultra",
    songsPerMonth: -1,
    musicVideosPerMonth: -1,
    songStems: true,
    midiExport: true,
    marketplaceBrowse: true,
    marketplaceBuy: true,
    marketplaceSelling: true,
    marketplaceRevShare: 90,
    apiAccess: true,
    apiRequestsPerHour: 5000,
    teamSeats: 10,
    batchLimit: 50,
    brandKits: -1, // unlimited
    creditRollover: 50000,
    priorityQueue: true,
    whiteLabel: false,
    customLoras: 0,
    dedicatedSupport: false,
  },
  agency: {
    name: "agency",
    displayName: "Agency",
    monthlyCredits: 300000,
    dailyCreditsForFree: 0,
    maxImageResolution: 4096,
    maxVideoResolution: "4K",
    watermark: false,
    commercialRights: true,
    modelAccess: "ultra",
    songsPerMonth: -1,
    musicVideosPerMonth: -1,
    songStems: true,
    midiExport: true,
    marketplaceBrowse: true,
    marketplaceBuy: true,
    marketplaceSelling: true,
    marketplaceRevShare: 90,
    apiAccess: true,
    apiRequestsPerHour: 20000,
    teamSeats: 25,
    batchLimit: 100,
    brandKits: -1, // unlimited
    creditRollover: 200000,
    priorityQueue: true,
    whiteLabel: true,
    customLoras: 3,
    dedicatedSupport: true,
  },
};

/** Map legacy tier names to new tier names */
const LEGACY_TIER_MAP: Record<string, TierName> = {
  enterprise: "business",
};

/** Get tier config by name, defaults to free. Supports legacy names. */
export function getTierConfig(tier: string): TierConfig {
  const mapped = LEGACY_TIER_MAP[tier] || tier;
  return TIERS[(mapped as TierName)] || TIERS.free;
}

/** Resolve a possibly-legacy tier name to the canonical TierName */
export function resolveTierName(tier: string): TierName {
  const mapped = LEGACY_TIER_MAP[tier] || tier;
  if (mapped in TIERS) return mapped as TierName;
  return "free";
}

/** Check if a feature is available for a tier. */
export function hasFeature(tier: string, feature: keyof TierConfig): boolean {
  const config = getTierConfig(tier);
  const value = config[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return !!value;
}
