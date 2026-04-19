import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Tools for Twitch Streamers — Overlays, Emotes, Panels, Alerts | DreamForgeX",
  description: "Full channel rebrand in an afternoon — overlays, sub-tier emotes, panel art, schedule graphics, alert stingers. Brand-kit-consistent across the channel.",
  openGraph: {
    title: "AI Tools for Twitch Streamers — DreamForgeX",
    description: "Overlays, emotes, panels, alerts — full channel rebrand in an afternoon.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
