import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Small Business Owners — Marketing, Ads, Brand, Photos | DreamForgeX",
  description: "Marketing assets your budget doesn't cover: pro product photos, logo + brand kit, flyers, menus, social carousels. One $9-19/month line-item replaces $400-800 of freelancer spend.",
  openGraph: {
    title: "AI Tools for Small Business Owners — DreamForgeX",
    description: "Photos, ads, flyers, menus, brand — all from one subscription.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
