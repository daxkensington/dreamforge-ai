"use client";
import { Heart } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolChibiFigure() {
  return (
    <ViralPresetTool
      preset="chibi-figure"
      title="AI Chibi Figure Generator"
      description="Turn any photo into an adorable anime chibi collectible"
      icon={Heart}
      gradient="from-pink-400 to-rose-500"
      hint="Add cute accessories, hairstyle tweaks, or color palette directions."
      showcase={["/showcase/tool-chibi-figure.jpg"]}
      examplePrompts={[
        "Holding a tiny coffee cup. Pastel pink background with sparkles.",
        "Magical girl version with a star wand and tiny floating hearts.",
        "Cat-ear headband, oversized hoodie, soft lavender backdrop.",
      ]}
    />
  );
}
