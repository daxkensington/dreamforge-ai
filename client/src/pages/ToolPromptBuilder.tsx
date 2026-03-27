import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Wand2,
  Loader2,
  Copy,
  Sparkles,
  RotateCcw,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";

const QUICK_TEMPLATES = [
  { label: "Cinematic Portrait", value: "A cinematic close-up portrait with dramatic lighting, shallow depth of field, film grain, and rich skin tones against a moody blurred background" },
  { label: "Fantasy Landscape", value: "A breathtaking fantasy landscape with towering crystal mountains, floating islands, bioluminescent flora, and a sky with twin moons casting ethereal light over misty valleys" },
  { label: "Product Shot", value: "A premium product photograph on a clean studio surface with soft gradient lighting, subtle reflections, and elegant minimalist composition" },
  { label: "Abstract Art", value: "An abstract composition of flowing organic shapes, vibrant intersecting color fields, dynamic textures, and harmonious geometric patterns" },
  { label: "Anime Character", value: "A detailed anime character illustration with expressive eyes, dynamic pose, flowing hair and clothing, vibrant colors, and a stylized atmospheric background" },
  { label: "Interior Design", value: "A luxurious modern interior space with designer furniture, warm ambient lighting, natural materials, floor-to-ceiling windows, and curated art pieces" },
  { label: "Food Photography", value: "A mouthwatering overhead food photograph with artful plating, fresh garnishes, natural window light, rustic wooden surface, and shallow depth of field" },
  { label: "Logo Design", value: "A professional vector-style logo mark with clean lines, balanced proportions, memorable silhouette, and versatile design suitable for any medium" },
];

const STYLE_OPTIONS = [
  "Photorealistic", "Digital Art", "Oil Painting", "Watercolor", "Anime/Manga",
  "3D Render", "Pixel Art", "Concept Art", "Comic Book", "Minimalist",
  "Surrealist", "Art Deco", "Cyberpunk", "Fantasy", "Steampunk",
];

const MOOD_OPTIONS = [
  "Serene", "Dramatic", "Mysterious", "Joyful", "Melancholic",
  "Epic", "Whimsical", "Dark", "Ethereal", "Nostalgic",
  "Energetic", "Peaceful", "Tense", "Romantic", "Futuristic",
];

const LIGHTING_OPTIONS = [
  "Golden Hour", "Studio Lighting", "Neon Glow", "Moonlight", "Dramatic Shadows",
  "Soft Diffused", "Backlit", "Volumetric", "Candlelight", "Cinematic",
];

const COMPOSITION_OPTIONS = [
  "Close-up Portrait", "Wide Landscape", "Bird's Eye View", "Dutch Angle",
  "Symmetrical", "Rule of Thirds", "Leading Lines", "Framed Subject",
  "Panoramic", "Macro Detail",
];

const COLOR_PALETTE_OPTIONS = [
  "Warm Tones", "Cool Blues", "Monochrome", "Pastel", "Neon/Vibrant",
  "Earth Tones", "Sunset Colors", "Ocean Blues", "Forest Greens", "Jewel Tones",
];

export default function ToolPromptBuilder() {
  const [subject, setSubject] = useState("");
  const [style, setStyle] = useState("");
  const [mood, setMood] = useState("");
  const [lighting, setLighting] = useState("");
  const [composition, setComposition] = useState("");
  const [colorPalette, setColorPalette] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");

  const buildMutation = trpc.tools.buildPrompt.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.prompt) {
        setGeneratedPrompt(data.prompt);
        toast.success("Prompt crafted successfully!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleBuild = () => {
    if (!subject.trim()) {
      toast.error("Please describe your subject");
      return;
    }
    buildMutation.mutate({
      subject,
      style: style || undefined,
      mood: mood || undefined,
      lighting: lighting || undefined,
      composition: composition || undefined,
      colorPalette: colorPalette || undefined,
      additionalDetails: additionalDetails || undefined,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast.success("Prompt copied to clipboard!");
  };

  const handleReset = () => {
    setSubject("");
    setStyle("");
    setMood("");
    setLighting("");
    setComposition("");
    setColorPalette("");
    setAdditionalDetails("");
    setGeneratedPrompt("");
  };

  const isProcessing = buildMutation.isPending;
  const filledFields = [subject, style, mood, lighting, composition, colorPalette, additionalDetails].filter(Boolean).length;

  return (
    <ToolPageLayout
      title="Smart Prompt Builder"
      description="Craft the perfect AI generation prompt with visual controls"
      icon={Wand2}
      gradient="from-cyan-500 to-purple-500"
    >
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/tool-promptbuild.jpg" alt="Prompt building interface" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Controls */}
          <div className="space-y-4">
            {/* Subject — the main required field */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Subject *</Label>
                  <Badge variant="secondary" className="text-xs">Required</Badge>
                </div>
                <Textarea
                  placeholder="Describe what you want to create... (e.g., 'A majestic dragon perched on a crystal mountain')"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Quick Templates</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TEMPLATES.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => setSubject(t.value)}
                        className="text-[10px] px-2.5 py-1 rounded-full border border-cyan-500/30 text-cyan-400/80 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Visual Controls Grid */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Creative Controls</Label>
                  <span className="text-xs text-muted-foreground">{filledFields}/7 fields</span>
                </div>

                {/* Style */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Art Style</Label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Choose a style..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mood */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mood / Atmosphere</Label>
                  <div className="flex flex-wrap gap-2">
                    {MOOD_OPTIONS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMood(mood === m ? "" : m)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          mood === m
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lighting */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Lighting</Label>
                  <Select value={lighting} onValueChange={setLighting}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Choose lighting..." />
                    </SelectTrigger>
                    <SelectContent>
                      {LIGHTING_OPTIONS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Composition */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Composition</Label>
                  <Select value={composition} onValueChange={setComposition}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Choose composition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPOSITION_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Color Palette */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Color Palette</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE_OPTIONS.map((cp) => (
                      <button
                        key={cp}
                        onClick={() => setColorPalette(colorPalette === cp ? "" : cp)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                          colorPalette === cp
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {cp}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Additional Details</Label>
                  <Input
                    placeholder="Any extra details... (e.g., 'intricate armor, glowing runes')"
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleBuild}
                disabled={!subject.trim() || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Crafting Prompt...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Build Prompt
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            <Card className="border-border/50 sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-sm font-medium">Generated Prompt</Label>
                  {generatedPrompt && (
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="text-xs">
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20"
                    >
                      <div className="relative">
                        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
                        <Sparkles className="h-4 w-4 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">AI is crafting your prompt...</p>
                    </motion.div>
                  ) : generatedPrompt ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-6"
                    >
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{generatedPrompt}</p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>{generatedPrompt.split(" ").length} words · Optimized for AI generation</span>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-col gap-3">
                        <Link href="/workspace">
                          <Button className="w-full" variant="default">
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Use in Studio
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            handleCopy();
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy to Clipboard
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
                        <Wand2 className="h-8 w-8 text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Your Prompt Will Appear Here</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Fill in the creative controls on the left, then click "Build Prompt" to generate an optimized AI prompt.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
