import type { Metadata } from "next";
import ToolFunkoPop from "@/pages/ToolFunkoPop";

export const metadata: Metadata = {
  title: "AI Funko Pop Generator — Turn Yourself Into a Vinyl Figure | DreamForgeX",
  description:
    "Upload a photo and generate yourself as a Funko Pop! window-box vinyl figure with custom name, accessories, and packaging.",
  alternates: { canonical: "https://dreamforgex.ai/tools/funko-pop" },
  openGraph: {
    title: "AI Funko Pop Generator | DreamForgeX",
    description: "Upload a photo and become a Funko Pop! vinyl figure.",
    url: "https://dreamforgex.ai/tools/funko-pop",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolFunkoPop />;
}
