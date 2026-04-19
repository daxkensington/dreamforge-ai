"use client";
import { Cat } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolJellycatPlush() {
  return (
    <ViralPresetTool
      preset="jellycat-plush"
      title="AI Jellycat Plush Generator"
      description="Turn any photo into an ultra-soft squishy Jellycat-style plush toy"
      icon={Cat}
      gradient="from-amber-300 to-pink-400"
      hint="Optionally describe pastel color palette, accessories, or plushy texture details."
      examplePrompts={[
        "Dusty sage green fur, tiny embroidered daisy on the chest.",
        "Cream-colored bunny variant, pastel rainbow bowtie.",
        "Strawberry-themed, soft red with seed-stitch freckles.",
      ]}
    />
  );
}
