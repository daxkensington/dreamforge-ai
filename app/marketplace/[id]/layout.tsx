/**
 * Per-listing metadata for the marketplace detail route (`/marketplace/<id>`).
 *
 * The page itself is a client component (wouter + tRPC), so metadata has to
 * live here in the layout's `generateMetadata`. Fetches the listing server-
 * side, defensively: any failure falls back to the generic marketplace title
 * instead of throwing (metadata generation must never 500 the page).
 */
import type { Metadata } from "next";
import { getListingById } from "../../../server/dbMarketplace";

const SITE = "https://dreamforgex.ai";
const FALLBACK_OG = `${SITE}/showcase/home-tool-market.jpg`;

interface LayoutProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id: rawId } = await params;
  if (!rawId || /[^0-9]/.test(rawId)) {
    return { title: "Listing — DreamForgeX" };
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { title: "Listing — DreamForgeX" };
  }

  let listing: Awaited<ReturnType<typeof getListingById>> = null;
  try {
    listing = await getListingById(id);
  } catch (err) {
    console.error("[/marketplace/:id] metadata DB lookup failed:", err);
  }

  // Draft/suspended listings shouldn't be indexed under their own title.
  if (!listing || listing.listing.status !== "published") {
    return {
      title: "Listing — DreamForgeX",
      robots: { index: false, follow: true },
    };
  }

  const { listing: item, sellerName } = listing;
  const price = (item.price / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
  const title = `${item.title} — DreamForgeX Marketplace`;
  const description =
    (item.description?.slice(0, 155) ?? "") +
    `${item.description ? "… " : ""}${item.type} by ${sellerName ?? "a DreamForgeX creator"} — ${item.price === 0 ? "Free" : price}.`;
  const url = `${SITE}/marketplace/${item.id}`;
  const previews = Array.isArray(item.previewImages) ? item.previewImages : [];
  const ogImage = typeof previews[0] === "string" ? previews[0] : FALLBACK_OG;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "DreamForgeX",
      images: [{ url: ogImage, width: 1200, height: 1200, alt: item.title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
