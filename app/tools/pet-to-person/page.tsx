import type { Metadata } from "next";
import ToolPetToPerson from "@/pages/ToolPetToPerson";

export const metadata: Metadata = {
  title: "Pet-to-Person AI — Humanize Your Pet | DreamForgeX",
  description:
    "Upload a photo of your dog, cat, or other pet and see them as a human. Personality and energy preserved, species translated to human features.",
  alternates: { canonical: "https://dreamforgex.ai/tools/pet-to-person" },
  openGraph: {
    title: "Pet-to-Person AI | DreamForgeX",
    description: "Upload your pet's photo and see them as a human.",
    url: "https://dreamforgex.ai/tools/pet-to-person",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolPetToPerson />;
}
