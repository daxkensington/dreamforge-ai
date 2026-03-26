/**
 * Shared tier definitions — used by both server and client.
 * Single source of truth for what each tier gets.
 */

export type TierName = "free" | "pro" | "studio" | "enterprise";

export interface TierConfig {
  name: string;
  displayName: string;
  monthlyCredits: number;
  dailyCreditsForFree: number;
  maxImageResolution: number;
  maxVideoResolution: string;
  watermark: boolean;
  commercialRights: boolean;
  premiumModels: boolean;
  songsPerMonth: number;
  musicVideosPerMonth: number;
  songStems: boolean;
  midiExport: boolean;
  marketplaceSelling: boolean;
  marketplaceRevShare: number;
  apiAccess: boolean;
  teamSeats: number;
  batchLimit: number;
  brandKits: number;
  creditRollover: number;
  priorityQueue: boolean;
  whiteLabel: boolean;
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    name: "free",
    displayName: "Explorer",
    monthlyCredits: 0,
    dailyCreditsForFree: 100,
    maxImageResolution: 1024,
    maxVideoResolution: "480p",
    watermark: true,
    commercialRights: false,
    premiumModels: false,
    songsPerMonth: 150, // 5/day * 30
    musicVideosPerMonth: 30, // 1/day * 30
    songStems: false,
    midiExport: false,
    marketplaceSelling: false,
    marketplaceRevShare: 0,
    apiAccess: false,
    teamSeats: 0,
    batchLimit: 0,
    brandKits: 0,
    creditRollover: 0,
    priorityQueue: false,
    whiteLabel: false,
  },
  pro: {
    name: "pro",
    displayName: "Pro",
    monthlyCredits: 5000,
    dailyCreditsForFree: 0,
    maxImageResolution: 2048,
    maxVideoResolution: "1080p",
    watermark: false,
    commercialRights: true,
    premiumModels: true,
    songsPerMonth: 100,
    musicVideosPerMonth: 10,
    songStems: false,
    midiExport: false,
    marketplaceSelling: false,
    marketplaceRevShare: 0,
    apiAccess: false,
    teamSeats: 0,
    batchLimit: 10,
    brandKits: 1,
    creditRollover: 2000,
    priorityQueue: true,
    whiteLabel: false,
  },
  studio: {
    name: "studio",
    displayName: "Studio",
    monthlyCredits: 15000,
    dailyCreditsForFree: 0,
    maxImageResolution: 4096,
    maxVideoResolution: "4K",
    watermark: false,
    commercialRights: true,
    premiumModels: true,
    songsPerMonth: -1, // unlimited
    musicVideosPerMonth: -1, // unlimited
    songStems: true,
    midiExport: true,
    marketplaceSelling: true,
    marketplaceRevShare: 85,
    apiAccess: false,
    teamSeats: 0,
    batchLimit: 20,
    brandKits: 5,
    creditRollover: 10000,
    priorityQueue: true,
    whiteLabel: false,
  },
  enterprise: {
    name: "enterprise",
    displayName: "Enterprise",
    monthlyCredits: 50000,
    dailyCreditsForFree: 0,
    maxImageResolution: 4096,
    maxVideoResolution: "4K",
    watermark: false,
    commercialRights: true,
    premiumModels: true,
    songsPerMonth: -1,
    musicVideosPerMonth: -1,
    songStems: true,
    midiExport: true,
    marketplaceSelling: true,
    marketplaceRevShare: 85,
    apiAccess: true,
    teamSeats: 5,
    batchLimit: 50,
    brandKits: -1, // unlimited
    creditRollover: 30000,
    priorityQueue: true,
    whiteLabel: true,
  },
};

/** Get tier config by name, defaults to free. */
export function getTierConfig(tier: string): TierConfig {
  return TIERS[(tier as TierName)] || TIERS.free;
}

/** Check if a feature is available for a tier. */
export function hasFeature(tier: string, feature: keyof TierConfig): boolean {
  const config = getTierConfig(tier);
  const value = config[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return !!value;
}
