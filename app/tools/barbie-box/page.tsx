import type { Metadata } from "next";
import ToolBarbieBox from "@/pages/ToolBarbieBox";

export const metadata: Metadata = {
  title: "AI Barbie Box Generator — Turn Yourself Into a Fashion Doll | DreamForgeX",
  description:
    "Upload a photo and generate yourself as a collector-edition fashion doll in a pink window box with custom accessories and series name.",
  alternates: { canonical: "https://dreamforgex.ai/tools/barbie-box" },
  openGraph: {
    title: "AI Barbie Box Generator | DreamForgeX",
    description: "Upload a photo and become a collector-edition fashion doll.",
    url: "https://dreamforgex.ai/tools/barbie-box",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolBarbieBox />;
}
