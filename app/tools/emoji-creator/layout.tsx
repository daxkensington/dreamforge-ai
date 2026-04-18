import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Emoji Creator — DreamForgeX",
  description: "Custom emojis and emotes for Discord, Slack, Twitch, and iMessage.",
  openGraph: { title: "Emoji Creator — DreamForgeX", description: "AI custom emojis for chat apps." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
