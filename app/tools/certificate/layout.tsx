import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/certificate" },
  title: "Certificate Designer — DreamForgeX",
  description: "Awards, diplomas, and course completion certificates — 11x8.5 print-ready.",
  openGraph: { title: "Certificate Designer — DreamForgeX", description: "Print-ready certificates with AI." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
