import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Invitation Designer — DreamForgeX",
  description: "Print-ready 5x7 invitations for weddings, birthdays, showers, and events.",
  openGraph: { title: "Invitation Designer — DreamForgeX", description: "AI event invitations with beautiful typography." },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
