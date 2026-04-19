import type { Metadata } from "next";
import DemoTextToImage from "@/pages/DemoTextToImage";

export const metadata: Metadata = {
  title: "Try AI Image Generation Free — No Signup | DreamForgeX",
  description:
    "Generate one AI image free, no account required. Test DreamForgeX's text-to-image quality before signing up. Powered by Flux + 30+ AI models.",
  alternates: { canonical: "https://dreamforgex.ai/demo/text-to-image" },
  openGraph: {
    title: "Try AI Image Generation Free — No Signup | DreamForgeX",
    description: "Generate one AI image free, no account required.",
    url: "https://dreamforgex.ai/demo/text-to-image",
    siteName: "DreamForgeX",
    images: ["/showcase/gallery-1.jpg"],
  },
};

export default function Page() {
  return <DemoTextToImage />;
}
