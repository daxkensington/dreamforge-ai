/**
 * Style Presets — save, load, and share generation style configurations.
 * Inspired by Midjourney's --sref style reference codes.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bookmark, Copy, Share2, Sparkles, ChevronDown } from "lucide-react";

export interface StylePreset {
  id: string;
  name: string;
  code: string; // shareable 6-char code
  promptSuffix: string; // appended to user's prompt
  model: string;
  creativity: number;
  resemblance: number;
  negativePrompt: string;
  tags: string[];
}

// Built-in community presets
const BUILT_IN_PRESETS: StylePreset[] = [
  {
    id: "cinematic-epic",
    name: "Cinematic Epic",
    code: "CIN001",
    promptSuffix: "cinematic lighting, shallow depth of field, film grain, dramatic shadows, Arri Alexa, anamorphic lens flare",
    model: "auto",
    creativity: 70,
    resemblance: 80,
    negativePrompt: "cartoon, anime, low quality",
    tags: ["cinematic", "dramatic", "film"],
  },
  {
    id: "anime-clean",
    name: "Clean Anime",
    code: "ANI001",
    promptSuffix: "anime style, cel-shaded, vibrant colors, clean lines, studio Ghibli inspired, beautiful lighting",
    model: "auto",
    creativity: 60,
    resemblance: 70,
    negativePrompt: "photorealistic, 3D render, blurry",
    tags: ["anime", "illustration", "colorful"],
  },
  {
    id: "cyberpunk-neon",
    name: "Cyberpunk Neon",
    code: "CYB001",
    promptSuffix: "cyberpunk, neon lights, rain-soaked streets, holographic displays, dark atmosphere, blade runner inspired",
    model: "auto",
    creativity: 80,
    resemblance: 60,
    negativePrompt: "bright daylight, pastoral, cartoon",
    tags: ["cyberpunk", "neon", "dark", "sci-fi"],
  },
  {
    id: "watercolor-soft",
    name: "Soft Watercolor",
    code: "WAT001",
    promptSuffix: "watercolor painting, soft edges, color bleeding, textured paper, delicate brushstrokes, artistic",
    model: "auto",
    creativity: 75,
    resemblance: 65,
    negativePrompt: "photorealistic, sharp lines, digital",
    tags: ["watercolor", "art", "soft", "painting"],
  },
  {
    id: "product-studio",
    name: "Studio Product",
    code: "PRD001",
    promptSuffix: "professional product photography, white background, soft studio lighting, high-end commercial, sharp focus",
    model: "auto",
    creativity: 30,
    resemblance: 95,
    negativePrompt: "lifestyle, outdoor, blurry, low quality",
    tags: ["product", "commercial", "clean"],
  },
  {
    id: "dark-fantasy",
    name: "Dark Fantasy",
    code: "DRK001",
    promptSuffix: "dark fantasy art, gothic atmosphere, dramatic lighting, detailed textures, concept art quality, epic scale",
    model: "auto",
    creativity: 85,
    resemblance: 55,
    negativePrompt: "cute, cartoon, bright cheerful",
    tags: ["fantasy", "dark", "epic", "gothic"],
  },
  {
    id: "vintage-film",
    name: "Vintage Film",
    code: "VIN001",
    promptSuffix: "vintage film photography, Kodak Portra 400, film grain, warm tones, nostalgic, analog camera",
    model: "auto",
    creativity: 50,
    resemblance: 85,
    negativePrompt: "digital, modern, clean, sharp",
    tags: ["vintage", "film", "retro", "warm"],
  },
  {
    id: "minimal-flat",
    name: "Minimal Flat",
    code: "MIN001",
    promptSuffix: "minimalist design, flat illustration, clean vector art, limited color palette, geometric shapes, modern",
    model: "auto",
    creativity: 40,
    resemblance: 80,
    negativePrompt: "photorealistic, complex, detailed, 3D",
    tags: ["minimal", "flat", "vector", "modern"],
  },
  {
    id: "portrait-magazine",
    name: "Magazine Portrait",
    code: "MAG001",
    promptSuffix: "professional portrait, magazine cover quality, beauty lighting, retouched skin, sharp eyes, editorial",
    model: "auto",
    creativity: 45,
    resemblance: 90,
    negativePrompt: "casual, snapshot, low quality",
    tags: ["portrait", "editorial", "beauty"],
  },
  {
    id: "3d-render",
    name: "3D Render",
    code: "3DR001",
    promptSuffix: "3D render, octane render, global illumination, volumetric lighting, hyper-realistic materials, ray tracing",
    model: "auto",
    creativity: 65,
    resemblance: 75,
    negativePrompt: "2D, flat, painting, sketch",
    tags: ["3D", "render", "octane", "realistic"],
  },
];

interface StylePresetsProps {
  onApply: (preset: StylePreset) => void;
  compact?: boolean;
}

export function StylePresets({ onApply, compact = false }: StylePresetsProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const filtered = search
    ? BUILT_IN_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.includes(search.toLowerCase()))
      )
    : BUILT_IN_PRESETS;

  const applyByCode = () => {
    const preset = BUILT_IN_PRESETS.find((p) => p.code === codeInput.toUpperCase());
    if (preset) {
      onApply(preset);
      toast.success(`Applied style: ${preset.name}`);
      setCodeInput("");
    } else {
      toast.error("Style code not found");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Style code ${code} copied!`);
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bookmark className="h-3 w-3" />
          <span>Style Presets ({BUILT_IN_PRESETS.length})</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        {expanded && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              <Input
                placeholder="Enter style code..."
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyByCode()}
                className="h-7 text-xs bg-white/5 border-white/10"
              />
              <Button size="sm" className="h-7 text-[10px] px-2" onClick={applyByCode}>Apply</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUILT_IN_PRESETS.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onApply(p); toast.success(`Applied: ${p.name}`); }}
                  className="px-2 py-1 rounded text-[10px] bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search styles or enter code..."
          value={search || codeInput}
          onChange={(e) => { setSearch(e.target.value); setCodeInput(e.target.value); }}
          onKeyDown={(e) => e.key === "Enter" && applyByCode()}
          className="h-8 text-xs bg-white/5 border-white/10 flex-1"
        />
        <Button size="sm" className="h-8 text-xs gap-1" onClick={applyByCode}>
          <Sparkles className="h-3 w-3" /> Apply Code
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => { onApply(p); toast.success(`Applied: ${p.name}`); }}
            className="p-2.5 rounded-lg text-left bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{p.name}</span>
              <button onClick={(e) => { e.stopPropagation(); copyCode(p.code); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Copy className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {p.tags.map((t) => (
                <Badge key={t} className="bg-white/5 text-white/50 border-0 text-[8px] px-1 py-0">{t}</Badge>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1 font-mono">{p.code}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export { BUILT_IN_PRESETS };
