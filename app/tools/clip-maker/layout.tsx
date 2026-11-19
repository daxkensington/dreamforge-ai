import type { Metadata } from "next";

const title = "Clip Maker — Trim Videos in Your Browser | DreamForgeX";
const description =
  "Trim a video and download a landscape, portrait, or square clip up to 60 seconds long. Free to use in your browser without an account.";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools/clip-maker" },
  title,
  description,
  openGraph: {
    title,
    description,
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
