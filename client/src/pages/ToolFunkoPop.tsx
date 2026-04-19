"use client";
import { Box } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolFunkoPop() {
  return (
    <ViralPresetTool
      preset="funko-pop"
      title="AI Funko Pop Generator"
      description="Turn yourself into a Funko Pop! window-box vinyl figure"
      icon={Box}
      gradient="from-orange-500 to-pink-500"
      hint="Optionally specify the character series name, exclusive sticker text, or pop number."
      examplePrompts={[
        'Series: "Office Heroes". Pop #042. Exclusive Comic-Con 2026 sticker.',
        "Hold a tiny coffee cup accessory. Sticker says CHASE EXCLUSIVE.",
        "Holiday variant — Santa hat, snowy backdrop printed on box.",
      ]}
    />
  );
}
