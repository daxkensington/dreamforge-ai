import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Flame, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = ["traditional", "neo-traditional", "blackwork", "fineline", "realism", "watercolor", "tribal", "japanese", "geometric", "minimalist"] as const;
const PLACEMENTS = ["arm", "forearm", "back", "chest", "leg", "wrist", "neck", "ribcage", "any"] as const;
const VARIANTS = [
  { value: "stencil", label: "Stencil" },
  { value: "color", label: "Color" },
  { value: "both", label: "Both" },
] as const;

type Style = (typeof STYLES)[number];
type Placement = (typeof PLACEMENTS)[number];
type Variant = (typeof VARIANTS)[number]["value"];

export default function ToolTattooDesign() {
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<Style>("traditional");
  const [placement, setPlacement] = useState<Placement>("any");
  const [variant, setVariant] = useState<Variant>("both");
  const [results, setResults] = useState<{ type: string; url: string }[]>([]);

  const mutation = trpc.tools.tattooDesign.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setResults(data.results); toast.success("Tattoo design ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!concept.trim()) { toast.error("Describe your tattoo concept"); return; }
    setResults([]);
    mutation.mutate({ concept, style, placement, variant });
  };
  const handleReset = () => { setConcept(""); setStyle("traditional"); setPlacement("any"); setVariant("both"); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Tattoo Designer" description="Stencil and full-color tattoo concepts — placement-aware" icon={Flame} gradient="from-red-600 to-orange-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Concept</Label>
              <Input placeholder="Wolf howling at moon with roses..." value={concept} onChange={(e) => setConcept(e.target.value)} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace("-", " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Placement</Label>
              <div className="grid grid-cols-3 gap-2">
                {PLACEMENTS.map((p) => (
                  <button key={p} onClick={() => setPlacement(p)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${placement === p ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{p}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Variant</Label>
              <div className="grid grid-cols-3 gap-2">
                {VARIANTS.map((v) => (
                  <button key={v.value} onClick={() => setVariant(v.value)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${variant === v.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{v.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!concept.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Inking...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4"><Flame className="h-8 w-8 text-red-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Tattoo Designer</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Describe your idea — get stencil + color versions in your chosen style.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-red-400" /><p className="text-sm text-muted-foreground">Inking design...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.map((r) => (
                    <div key={r.type} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-white border border-border/30">
                        <img loading="lazy" src={r.url} alt={r.type} className="w-full h-auto object-contain" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground capitalize">{r.type}</span>
                        <Button variant="outline" size="sm" onClick={() => window.open(r.url, "_blank")}><Download className="h-3 w-3 mr-1" />Save</Button>
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
