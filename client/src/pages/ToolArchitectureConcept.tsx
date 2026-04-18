import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Building2, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BUILDING_TYPES = ["single-family-home", "apartment", "office-tower", "retail", "restaurant", "hotel", "civic", "industrial", "education", "cultural"] as const;
const STYLES = ["modern-minimalist", "mid-century", "traditional", "brutalist", "biophilic-green", "farmhouse", "mediterranean", "japanese", "scandinavian", "futuristic"] as const;
const VIEWS = ["exterior-hero", "street-view", "aerial", "interior-living", "interior-kitchen", "entry-approach"] as const;
type BT = (typeof BUILDING_TYPES)[number];
type Style = (typeof STYLES)[number];
type View = (typeof VIEWS)[number];

export default function ToolArchitectureConcept() {
  const [buildingType, setBuildingType] = useState<BT>("single-family-home");
  const [style, setStyle] = useState<Style>("modern-minimalist");
  const [setting, setSetting] = useState("");
  const [view, setView] = useState<View>("exterior-hero");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.architectureConcept.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Render ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!setting.trim()) { toast.error("Setting required"); return; } setResultUrl(null); mutation.mutate({ buildingType, style, setting, view }); };
  const handleReset = () => { setBuildingType("single-family-home"); setStyle("modern-minimalist"); setSetting(""); setView("exterior-hero"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Architecture Concept" description="Photorealistic building and interior renders from text" icon={Building2} gradient="from-zinc-500 to-neutral-700">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Building Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {BUILDING_TYPES.map((t) => (
                  <button key={t} onClick={() => setBuildingType(t)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${buildingType === t ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Setting</Label>
              <Textarea placeholder="Hillside overlooking a lake, pine forest, late afternoon" value={setting} onChange={(e) => setSetting(e.target.value)} rows={3} />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace(/-/g, " ")}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">View</Label>
              <div className="grid grid-cols-2 gap-2">
                {VIEWS.map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${view === v ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{v.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rendering...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Render</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-zinc-500/10 flex items-center justify-center mb-4"><Building2 className="h-8 w-8 text-zinc-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Architecture Concept</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Architectural visualization quality — concept, context, client pitch.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /><p className="text-sm text-muted-foreground">Rendering...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={resultUrl} alt="Render" className="w-full h-auto max-h-[500px] object-contain" /></div>
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
