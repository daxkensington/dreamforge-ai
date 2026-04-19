import type { Metadata } from "next";
import ToolActionFigure from "@/pages/ToolActionFigure";

export const metadata: Metadata = {
  title: "AI Action Figure Generator — Turn Yourself Into a Boxed Toy | DreamForgeX",
  description:
    "Upload a photo and generate a custom action figure inside collectible blister-pack toy packaging. The viral 2026 trend, in seconds.",
  alternates: { canonical: "https://dreamforgex.ai/tools/action-figure" },
  openGraph: {
    title: "AI Action Figure Generator | DreamForgeX",
    description: "Upload a photo and become a boxed collectible action figure.",
    url: "https://dreamforgex.ai/tools/action-figure",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolActionFigure />;
}
