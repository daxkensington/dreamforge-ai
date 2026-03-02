import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Type,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EFFECTS = [
  { value: "fire", label: "🔥 Fire", color: "from-orange-500 to-red-500" },
  { value: "water", label: "💧 Water", color: "from-blue-400 to-cyan-500" },
  { value: "neon", label: "💜 Neon", color: "from-purple-500 to-pink-500" },
  { value: "gold", label: "✨ Gold", color: "from-yellow-400 to-amber-500" },
  { value: "ice", label: "❄️ Ice", color: "from-sky-300 to-blue-400" },
  { value: "nature", label: "🌿 Nature", color: "from-green-400 to-emerald-500" },
  { value: "galaxy", label: "🌌 Galaxy", color: "from-indigo-500 to-purple-600" },
  { value: "chrome", label: "🪞 Chrome", color: "from-gray-300 to-gray-500" },
  { value: "graffiti", label: "🎨 Graffiti", color: "from-red-400 to-yellow-400" },
  { value: "crystal", label: "💎 Crystal", color: "from-cyan-300 to-violet-400" },
] as const;

const BACKGROUNDS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "transparent", label: "Minimal" },
  { value: "gradient", label: "Gradient" },
] as const;

const FONT_SIZES = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
  { value: "extra-large", label: "XL" },
] as const;

export default function ToolTextEffects() {
  const [text, setText] = useState("");
  const [effectStyle, setEffectStyle] = useState<string>("neon");
  const [backgroundColor, setBackgroundColor] = useState<"dark" | "light" | "transparent" | "gradient">("dark");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large" | "extra-large">("large");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const textMutation = trpc.tools.textEffects.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Text effect generated!");
      } else {
        toast.error(data.error || "Text effect generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!text.trim()) { toast.error("Enter some text"); return; }
    setResultUrl(null);
    textMutation.mutate({
      text: text.trim(),
      effectStyle: effectStyle as any,
      backgroundColor,
      fontSize,
    });
  };

  const handleReset = () => { setText(""); setResultUrl(null); };
  const isProcessing = textMutation.isPending;

  return (
    <ToolPageLayout
      title="AI Text Effects"
      description="Generate stunning stylized text with AI-powered effects"
      icon={Type}
      gradient="from-amber-500 to-orange-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Your Text</Label>
                <Input placeholder="Enter text to stylize..." value={text} onChange={(e) => setText(e.target.value)} maxLength={100} className="text-lg font-semibold" />
                <p className="text-xs text-muted-foreground">{text.length}/100 characters</p>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Effect Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {EFFECTS.map((e) => (
                      <button key={e.value} onClick={() => setEffectStyle(e.value)}
                        className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all ${effectStyle === e.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <div className={`h-3 w-3 rounded-full bg-gradient-to-r ${e.color}`} />
                        <span>{e.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Background</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {BACKGROUNDS.map((b) => (
                      <button key={b.value} onClick={() => setBackgroundColor(b.value)}
                        className={`p-2.5 rounded-lg border text-xs font-medium transition-all ${backgroundColor === b.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Size</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {FONT_SIZES.map((s) => (
                      <button key={s.value} onClick={() => setFontSize(s.value)}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all ${fontSize === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!text.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Text Effect</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                      <Type className="h-8 w-8 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Enter Your Text</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Type some text, pick an effect style, and generate stunning AI typography.</p>
                    {text && (
                      <div className="mt-6 px-6 py-3 rounded-xl bg-muted/30 border border-border/50">
                        <p className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">{text}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="p-6">
                      <Badge className="mb-4 bg-amber-500/20 text-amber-400 border-amber-500/30">
                        {resultUrl ? `${EFFECTS.find(e => e.value === effectStyle)?.label} Effect` : "Generating..."}
                      </Badge>
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[400px] flex items-center justify-center">
                        <AnimatePresence mode="wait">
                          {isProcessing ? (
                            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                              <p className="text-sm text-muted-foreground">Creating text effect...</p>
                            </motion.div>
                          ) : resultUrl ? (
                            <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt={`${text} with ${effectStyle} effect`} className="w-full h-auto max-h-[450px] object-contain" />
                          ) : null}
                        </AnimatePresence>
                      </div>
                    </div>
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />Download
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
