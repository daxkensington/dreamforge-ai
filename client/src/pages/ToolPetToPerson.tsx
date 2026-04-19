"use client";
import { Dog } from "lucide-react";
import { ViralPresetTool } from "@/components/ViralPresetTool";

export default function ToolPetToPerson() {
  return (
    <ViralPresetTool
      preset="pet-to-person"
      title="Pet-to-Person Generator"
      description="See your pet as a human — fluffy goldens become warm blondes, sleek black cats become sharp brunettes, and so on"
      icon={Dog}
      gradient="from-emerald-400 to-teal-500"
      hint="Optionally add personality cues — 'always grumpy in the morning', 'loves the beach', etc."
      examplePrompts={[
        "Always playful, loves naps in the sun.",
        "Royal demeanor, slightly judgemental cat energy.",
        "Big goofy puppy who tries to befriend everyone.",
      ]}
    />
  );
}
