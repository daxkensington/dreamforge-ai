import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coloring Book Page Generator — DreamForgeX",
  description: "Print-ready line-art coloring pages for kids, adults, and Etsy printables.",
  openGraph: {
    title: "Coloring Book Page Generator — DreamForgeX",
    description: "Print-ready AI coloring book pages.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
