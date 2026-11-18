import type { Metadata } from "next";
import ClientPage from "./ClientPage";

export const metadata: Metadata = {
  title: "AI Tools Directory",
  description:
    "Explore DreamForgeX tools for image generation, photo editing, video, music, audio, and design. Search the directory or browse by category.",
  alternates: { canonical: "https://dreamforgex.ai/tools" },
};

export default function Page() {
  return <ClientPage />;
}
