import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/greeting-card" },
  title: "Greeting Card Designer — DreamForgeX",
  description: "Birthday, thank-you, sympathy, holiday greeting cards — front and inside as a matching set.",
  openGraph: { title: "Greeting Card Designer — DreamForgeX", description: "AI-designed greeting cards." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
