import type { Metadata } from "next";
import ToolLegoMini from "@/pages/ToolLegoMini";

export const metadata: Metadata = {
  title: "AI LEGO Minifigure Generator — Turn Yourself Into a LEGO Mini | DreamForgeX",
  description:
    "Upload a photo and generate yourself as a classic LEGO minifigure with custom outfit and accessories.",
  alternates: { canonical: "https://dreamforgex.ai/tools/lego-mini" },
  openGraph: {
    title: "AI LEGO Minifigure Generator | DreamForgeX",
    description: "Turn yourself into a classic LEGO minifigure.",
    url: "https://dreamforgex.ai/tools/lego-mini",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolLegoMini />;
}
