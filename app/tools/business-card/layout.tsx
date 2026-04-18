import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Business Card Designer — DreamForgeX",
  description: "Print-ready 3.5x2 business cards with matching front and back designs.",
  openGraph: { title: "Business Card Designer — DreamForgeX", description: "Pro business card design with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
