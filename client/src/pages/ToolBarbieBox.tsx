"use client";
import { Sparkles } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolBarbieBox() {
  return (
    <ViralPresetTool
      preset="barbie-box"
      title="AI Barbie Box Generator"
      description="Turn any photo into a collector-edition fashion doll in a pink window box"
      icon={Sparkles}
      gradient="from-pink-400 to-rose-500"
      hint="Optionally add doll details — hair color tweak, signature outfit, or which accessories to include."
      examplePrompts={[
        'Career edition: "Dream Veterinarian". Accessories: stethoscope, puppy.',
        "Beach edition, pastel yellow bikini, surfboard accessory.",
        "Holiday collector edition, sparkly red gown, reindeer plush.",
      ]}
    />
  );
}
