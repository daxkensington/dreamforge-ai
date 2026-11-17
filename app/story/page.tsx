import type { Metadata } from "next";
import StoryStudio from "@/pages/StoryStudio";

export const metadata: Metadata = {
  title: "One-Click AI Storyboard & Soundtrack Maker | DreamForgeX",
  description:
    "Type one idea and generate a 4–6 scene illustrated story with a custom AI soundtrack and consistent characters in seconds, powered by 30+ AI models.",
  alternates: { canonical: "https://dreamforgex.ai/story" },
  openGraph: {
    title: "One-Click Story — AI Storyboard + Music | DreamForgeX",
    description: "Idea in, illustrated story with music out — in seconds.",
    url: "https://dreamforgex.ai/story",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <StoryStudio />;
}
