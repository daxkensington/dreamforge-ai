import type { Metadata } from "next";
import ToolPopMart from "@/pages/ToolPopMart";

export const metadata: Metadata = {
  title: "AI POP Mart Blind Box Generator — Turn Yourself Into a Designer Art Toy | DreamForgeX",
  description:
    "Upload a photo and generate a designer-toy vinyl figure in the POP Mart / Labubu aesthetic, complete with illustrated blind-box packaging.",
  alternates: { canonical: "https://dreamforgex.ai/tools/pop-mart" },
  openGraph: {
    title: "AI POP Mart Blind Box Generator | DreamForgeX",
    description: "Turn any photo into a designer art toy with collector-edition box.",
    url: "https://dreamforgex.ai/tools/pop-mart",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolPopMart />;
}
