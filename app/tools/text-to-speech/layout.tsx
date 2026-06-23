import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bark TTS Voice Generator — Free Online AI | DreamForgeX",
  description: "Convert text to natural speech with Bark TTS, self-hosted on our own GPUs, plus 400+ free voices. Free online AI text-to-speech, no install.",
  openGraph: {
    title: "Bark TTS Voice Generator — Free Online AI | DreamForgeX",
    description: "Convert text to natural speech with Bark TTS, self-hosted on our own GPUs, plus 400+ free voices. Free online AI text-to-speech, no install.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
