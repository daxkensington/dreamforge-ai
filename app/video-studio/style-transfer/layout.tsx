import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "AI Video Style Transfer & Cinematic Looks | DreamForgeX",
  description: "Apply cinematic artistic styles to your video frames with AI style transfer — regrade footage to match a reference look or art style.",
  alternates: { canonical: "https://dreamforgex.ai/video-studio/style-transfer" },
  openGraph: {
    title: "Video Style Transfer — DreamForgeX",
    description: "Apply cinematic artistic styles to your video frames.",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
