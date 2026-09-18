import type { Metadata } from "next";
export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/resume-builder" },
  title: "AI Resume Builder — DreamForgeX",
  description: "Create professional, ATS-optimized resumes with AI. Describe your experience and get a polished resume in seconds.",
  openGraph: { title: "AI Resume Builder — DreamForgeX", description: "Create professional resumes with AI" },
};
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
