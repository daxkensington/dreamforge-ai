"use client";
import { Package } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolActionFigure() {
  return (
    <ViralPresetTool
      preset="action-figure"
      title="AI Action Figure Generator"
      description="Turn any photo into a boxed collectible action figure"
      icon={Package}
      gradient="from-amber-500 to-red-500"
      hint="Add details like a character name, fictional powers, or which accessories to include in the blister pack."
      showcase={["/showcase/tool-action-figure.jpg"]}
      examplePrompts={[
        'Name banner: "Captain Storm". Accessories: laser sword, jetpack, golden coin.',
        "Character class: cyberpunk hacker. Include holo-keyboard accessory.",
        "Vintage 80s G.I. Joe styling, includes rifle and green beret accessory.",
      ]}
    />
  );
}
