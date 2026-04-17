import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DreamForgeX",
  description: "What personal data DreamForgeX collects, how we use it, who we share it with, and your rights. We never train models on your private prompts.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
