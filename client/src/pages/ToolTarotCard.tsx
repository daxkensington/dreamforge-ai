import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Moon, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES = [
  { value: "rider-waite", label: "Rider-Waite" },
  { value: "mystical-modern", label: "Mystical Modern" },
  { value: "art-nouveau", label: "Art Nouveau" },
  { value: "celestial", label: "Celestial" },
  { value: "dark-fantasy", label: "Dark Fantasy" },
  { value: "watercolor-bohemian", label: "Watercolor Boho" },
  { value: "minimalist-geometric", label: "Minimalist" },
] as const;

type Style = (typeof STYLES)[number]["value"];

export default function ToolTarotCard() {
  const [cardName, setCardName] = useState("");
  const [symbolism, setSymbolism] = useState("");
  const [romanNumeral, setRomanNumeral] = useState("");
  const [style, setStyle] = useState<Style>("rider-waite");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.tarotCard.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Card ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!cardName.trim() || !symbolism.trim()) { toast.error("Name and symbolism required"); return; } setResultUrl(null); mutation.mutate({ cardName, symbolism, style, romanNumeral: romanNumeral || undefined }); };
  const handleReset = () => { setCardName(""); setSymbolism(""); setRomanNumeral(""); setStyle("rider-waite"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Tarot Card Designer" description="Major arcana style custom tarot cards" icon={Moon} gradient="from-violet-500 to-indigo-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Card Name</Label><Input placeholder="The Wanderer" value={cardName} onChange={(e) => setCardName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Roman Numeral (optional)</Label><Input placeholder="XIV" value={romanNumeral} onChange={(e) => setRomanNumeral(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Symbolism / Imagery</Label><Textarea placeholder="A hooded figure with staff crossing a stone bridge at twilight, crescent moon, owl companion..." value={symbolism} onChange={(e) => setSymbolism(e.target.value)} rows={5} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Divining...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Card</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4"><Moon className="h-8 w-8 text-violet-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Tarot Card Designer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Custom major arcana–style cards — deck-ready, collectible quality.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /><p className="text-sm text-muted-foreground">Drawing card...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Tarot card" className="h-auto max-h-[700px] object-contain" /></div>
                    <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
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
