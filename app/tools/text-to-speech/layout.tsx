import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Text to Speech — DreamForgeX",
  description: "Convert text to natural speech with 400+ free voices",
  openGraph: {
    title: "AI Text to Speech — DreamForgeX",
    description: "Convert text to natural speech with 400+ free voices",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
