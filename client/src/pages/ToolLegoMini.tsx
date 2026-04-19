"use client";
import { Blocks } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolLegoMini() {
  return (
    <ViralPresetTool
      preset="lego-mini"
      title="AI LEGO Minifigure Generator"
      description="Turn yourself into a classic LEGO minifigure"
      icon={Blocks}
      gradient="from-yellow-400 to-red-500"
      hint="Add details about outfit, accessories (sword, briefcase, etc.), or hair piece."
      showcase={["/showcase/tool-lego-mini.jpg"]}
      examplePrompts={[
        "Wearing a chef hat and apron, holding a tiny pizza.",
        "Astronaut with helmet and small jetpack accessory.",
        "Pirate captain with eyepatch and hook hand.",
      ]}
    />
  );
}
