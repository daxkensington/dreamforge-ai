import type { Metadata } from "next";
import ToolBarbieBox from "@/pages/ToolBarbieBox";

export const metadata: Metadata = {
  title: "Free AI Barbie Box & Action Figure Generator Online | DreamForgeX",
  description:
    "Upload a photo and generate yourself as a collector-edition fashion doll or action figure in a blister box with custom accessories — free online AI generator.",
  alternates: { canonical: "https://dreamforgex.ai/tools/barbie-box" },
  openGraph: {
    title: "Free AI Barbie Box & Action Figure Generator Online | DreamForgeX",
    description:
      "Upload a photo and generate yourself as a collector-edition fashion doll or action figure in a custom blister box.",
    url: "https://dreamforgex.ai/tools/barbie-box",
    siteName: "DreamForgeX",
  },
};

export default function Page() {
  return <ToolBarbieBox />;
}
