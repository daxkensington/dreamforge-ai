import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Shirt, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const SEASONS = ["spring", "summer", "fall", "winter", "resort", "any"] as const;
const VIBES = ["editorial", "streetwear", "luxury", "minimalist", "vintage", "athleisure", "bohemian"] as const;

type Season = (typeof SEASONS)[number];
type Vibe = (typeof VIBES)[number];

export default function ToolFashionLookbook() {
  const [garmentDescription, setGarmentDescription] = useState("");
  const [season, setSeason] = useState<Season>("any");
  const [sceneCount, setSceneCount] = useState(4);
  const [vibe, setVibe] = useState<Vibe>("editorial");
  const [results, setResults] = useState<{ scene: string; url: string }[]>([]);

  const mutation = trpc.tools.fashionLookbook.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setResults(data.results); toast.success("Lookbook ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!garmentDescription.trim()) { toast.error("Describe the garment"); return; }
    setResults([]);
    mutation.mutate({ garmentDescription, season, sceneCount, vibe });
  };
  const handleReset = () => { setGarmentDescription(""); setSeason("any"); setSceneCount(4); setVibe("editorial"); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Fashion Lookbook" description="Multi-scene editorial lookbook from one garment description" icon={Shirt} gradient="from-pink-500 to-rose-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Garment Description</Label>
              <Textarea placeholder="Oversized tailored blazer in cream wool, wide-leg trousers, minimal gold jewelry..." value={garmentDescription} onChange={(e) => setGarmentDescription(e.target.value)} rows={5} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Vibe</Label>
              <div className="grid grid-cols-2 gap-2">
                {VIBES.map((v) => (
                  <button key={v} onClick={() => setVibe(v)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${vibe === v ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{v}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Season</Label>
              <div className="grid grid-cols-3 gap-2">
                {SEASONS.map((s) => (
                  <button key={s} onClick={() => setSeason(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${season === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Scenes</Label>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} onClick={() => setSceneCount(n)} className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${sceneCount === n ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{n}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!garmentDescription.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Shooting...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Lookbook</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4"><Shirt className="h-8 w-8 text-pink-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Fashion Lookbook</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Editorial-quality scenes from one outfit description — studio, street, golden-hour.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-pink-400" /><p className="text-sm text-muted-foreground">Shooting scenes...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-[3/4]">
                        <img loading="lazy" src={r.url} alt={r.scene} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground truncate max-w-[70%]">{r.scene.split(",")[0]}</span>
                        <Button variant="ghost" size="sm" onClick={() => window.open(r.url, "_blank")}><Download className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
