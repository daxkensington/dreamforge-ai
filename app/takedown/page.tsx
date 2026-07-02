import type { Metadata } from "next";
import Takedown from "@/pages/Takedown";

export const metadata: Metadata = {
  title: "Report Content / Takedown Request — DreamForgeX",
  description:
    "Report content on DreamForgeX that depicts you without consent, infringes your rights, or is illegal. No account needed — every report is reviewed by a human.",
  alternates: { canonical: "https://dreamforgex.ai/takedown" },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <Takedown />;
}
