import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RMBG-2.0 Background Remover — Free Online AI | DreamForgeX",
  description: "Remove or replace image backgrounds instantly with RMBG-2.0, self-hosted on our own GPUs. Free online, clean cutouts, transparent PNG export.",
  openGraph: {
    title: "RMBG-2.0 Background Remover — Free Online AI | DreamForgeX",
    description: "Remove or replace image backgrounds instantly with RMBG-2.0, self-hosted on our own GPUs. Free online, clean cutouts, transparent PNG export.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
