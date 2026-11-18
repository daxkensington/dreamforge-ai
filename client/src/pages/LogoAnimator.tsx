import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ToolImageToVideo from "./ToolImageToVideo";

const ANIMATION_STYLES = [
  {
    value: "particle-reveal",
    label: "Particle Reveal",
    description: "Glowing particles converge into the logo.",
  },
  {
    value: "glitch",
    label: "Glitch Effect",
    description: "Brief digital distortion resolves into a clean logo reveal.",
  },
  {
    value: "liquid-morph",
    label: "Liquid Morph",
    description: "Flowing liquid chrome settles into the logo shape.",
  },
  {
    value: "neon-glow",
    label: "Neon Glow",
    description: "Neon outlines flicker on and illuminate the logo.",
  },
  {
    value: "3d-rotate",
    label: "3D Rotation",
    description: "The logo rotates slowly with reflective lighting.",
  },
  {
    value: "smoke-reveal",
    label: "Smoke Reveal",
    description: "Atmospheric smoke parts to reveal the logo.",
  },
  {
    value: "shatter",
    label: "Shatter & Reform",
    description: "Fragments reassemble into the original logo.",
  },
  {
    value: "minimal-fade",
    label: "Minimal Fade",
    description: "The logo fades in with a subtle scale change.",
  },
] as const;

export default function LogoAnimator() {
  const [brandName, setBrandName] = useState("");
  const [style, setStyle] = useState<(typeof ANIMATION_STYLES)[number]>(
    ANIMATION_STYLES[0]
  );
  const brand = brandName.trim();
  const motionPrompt = [
    brand
      ? `Create a short animated intro for the uploaded ${brand} logo.`
      : "Create a short animated intro for the uploaded logo.",
    style.description,
    "Finish on the original logo. Preserve its design, colors and lettering.",
  ].join(" ");

  return (
    <ToolImageToVideo
      logo={{
        motionPrompt,
        controls: (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo-brand-name">Brand name (optional)</Label>
              <Input
                id="logo-brand-name"
                value={brandName}
                maxLength={100}
                onChange={event => setBrandName(event.target.value)}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Animation style</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {ANIMATION_STYLES.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === style.value}
                    onClick={() => setStyle(option)}
                    className="rounded-lg border border-border px-3 py-2 text-left hover:bg-accent focus-visible:outline focus-visible:outline-2 aria-pressed:border-primary aria-pressed:bg-primary/10"
                  >
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        ),
      }}
    />
  );
}
