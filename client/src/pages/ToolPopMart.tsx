"use client";
import { Gem } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolPopMart() {
  return (
    <ViralPresetTool
      preset="pop-mart"
      title="AI POP Mart Blind Box Generator"
      description="Turn any photo into a designer-toy art figure in a POP Mart-style blind box"
      icon={Gem}
      gradient="from-fuchsia-500 to-violet-600"
      hint="Optionally specify series theme, hidden rare chase variant, or blind-box illustration style."
      examplePrompts={[
        'Series: "Cosmic Dreams". Chase variant has glow-in-the-dark hair.',
        "Forest spirits series, holding a tiny acorn.",
        "Cyberpunk edition, neon-pink-and-teal palette.",
      ]}
    />
  );
}
