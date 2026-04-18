import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Palette, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const VIBES = ["modern-minimalist", "luxury", "playful", "bold-industrial", "organic-natural", "tech-startup", "heritage-vintage", "edgy-punk"] as const;
type Vibe = (typeof VIBES)[number];

export default function ToolBrandStyleGuide() {
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [tagline, setTagline] = useState("");
  const [vibe, setVibe] = useState<Vibe>("modern-minimalist");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.brandStyleGuide.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Style guide ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!brandName.trim() || !industry.trim()) { toast.error("Brand name and industry required"); return; } setResultUrl(null); mutation.mutate({ brandName, industry, vibe, tagline: tagline || undefined }); };
  const handleReset = () => { setBrandName(""); setIndustry(""); setTagline(""); setVibe("modern-minimalist"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Brand Style Guide" description="Logo, color palette, typography — full brand system on one page" icon={Palette} gradient="from-fuchsia-500 to-rose-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Brand Name</Label><Input placeholder="Forge & Oak" value={brandName} onChange={(e) => setBrandName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Industry</Label><Input placeholder="Artisan furniture" value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Tagline (optional)</Label><Input placeholder="Made to last generations" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Vibe</Label>
              <div className="grid grid-cols-2 gap-2">
                {VIBES.map((v) => (
                  <button key={v} onClick={() => setVibe(v)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${vibe === v ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{v.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Designing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Guide</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-4"><Palette className="h-8 w-8 text-fuchsia-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Brand Style Guide</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Logo mark, color swatches, typography pairings, pattern — all on one designer-ready page.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" /><p className="text-sm text-muted-foreground">Designing system...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={resultUrl} alt="Style guide" className="w-full h-auto max-h-[700px] object-contain" /></div>
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
