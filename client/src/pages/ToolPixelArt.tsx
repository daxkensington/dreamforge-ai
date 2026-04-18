import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Gamepad2, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BIT_STYLES = [
  { value: "8-bit", label: "8-Bit" },
  { value: "16-bit", label: "16-Bit" },
  { value: "32-bit", label: "32-Bit" },
] as const;
const SUBJECTS = [
  { value: "character", label: "Character" },
  { value: "item", label: "Item" },
  { value: "environment", label: "Environment" },
  { value: "tileset", label: "Tileset" },
  { value: "sprite-sheet", label: "Sprite Sheet" },
] as const;
const PALETTES = [
  { value: "gameboy", label: "Game Boy" },
  { value: "nes", label: "NES" },
  { value: "snes", label: "SNES" },
  { value: "pico-8", label: "PICO-8" },
  { value: "c64", label: "C64" },
  { value: "full-color", label: "Full Color" },
] as const;

type BitStyle = (typeof BIT_STYLES)[number]["value"];
type Subject = (typeof SUBJECTS)[number]["value"];
type Palette = (typeof PALETTES)[number]["value"];

export default function ToolPixelArt() {
  const [concept, setConcept] = useState("");
  const [bitStyle, setBitStyle] = useState<BitStyle>("16-bit");
  const [subject, setSubject] = useState<Subject>("character");
  const [palette, setPalette] = useState<Palette>("full-color");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.pixelArt.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Pixel art ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!concept.trim()) { toast.error("Describe your pixel art"); return; }
    setResultUrl(null);
    mutation.mutate({ concept, bitStyle, subject, palette });
  };
  const handleReset = () => { setConcept(""); setBitStyle("16-bit"); setSubject("character"); setPalette("full-color"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Pixel Art Generator" description="Game-ready 8/16/32-bit pixel art sprites and scenes" icon={Gamepad2} gradient="from-lime-500 to-green-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Concept</Label>
              <Input placeholder="Hero knight with golden sword..." value={concept} onChange={(e) => setConcept(e.target.value)} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Bit Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {BIT_STYLES.map((s) => (
                  <button key={s.value} onClick={() => setBitStyle(s.value)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${bitStyle === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Subject</Label>
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((s) => (
                  <button key={s.value} onClick={() => setSubject(s.value)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${subject === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Palette</Label>
              <div className="grid grid-cols-3 gap-2">
                {PALETTES.map((p) => (
                  <button key={p.value} onClick={() => setPalette(p.value)} className={`p-3 rounded-lg border-2 text-xs font-medium transition-all ${palette === p.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{p.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!concept.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rendering...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-lime-500/10 flex items-center justify-center mb-4"><Gamepad2 className="h-8 w-8 text-lime-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Pixel Art Generator</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Describe any character, item, or scene and get a game-ready pixel art render.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-lime-400" /><p className="text-sm text-muted-foreground">Rendering pixels...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                      <img loading="lazy" src={resultUrl} alt="Pixel art" className="w-full h-auto max-h-[450px] object-contain image-rendering-pixelated" style={{ imageRendering: "pixelated" }} />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
