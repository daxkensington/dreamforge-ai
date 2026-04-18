import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { UtensilsCrossed, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES = [
  { value: "elegant-fine-dining", label: "Fine Dining" },
  { value: "casual-bistro", label: "Bistro" },
  { value: "rustic-farmhouse", label: "Farmhouse" },
  { value: "modern-minimalist", label: "Minimalist" },
  { value: "vintage-diner", label: "Diner" },
  { value: "asian-contemporary", label: "Asian" },
  { value: "brewpub", label: "Brewpub" },
  { value: "coffeeshop", label: "Coffee Shop" },
] as const;
const FORMATS = [
  { value: "single-page", label: "Single Page" },
  { value: "bi-fold", label: "Bi-fold" },
  { value: "tri-fold", label: "Tri-fold" },
] as const;
type Style = (typeof STYLES)[number]["value"];
type Format = (typeof FORMATS)[number]["value"];

export default function ToolMenuDesign() {
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [sections, setSections] = useState("");
  const [style, setStyle] = useState<Style>("casual-bistro");
  const [format, setFormat] = useState<Format>("single-page");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.menuDesign.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Menu ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!restaurantName.trim() || !cuisine.trim() || !sections.trim()) { toast.error("All fields required"); return; } setResultUrl(null); mutation.mutate({ restaurantName, cuisine, sections, style, format }); };
  const handleReset = () => { setRestaurantName(""); setCuisine(""); setSections(""); setStyle("casual-bistro"); setFormat("single-page"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Menu Designer" description="Restaurant menus — single, bi-fold, or tri-fold print layouts" icon={UtensilsCrossed} gradient="from-emerald-600 to-lime-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Restaurant Name</Label><Input placeholder="Sage & Stone" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Cuisine</Label><Input placeholder="Modern American" value={cuisine} onChange={(e) => setCuisine(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Menu Sections</Label><Textarea placeholder="STARTERS&#10;- Burrata — $14&#10;- Tuna Tartare — $18&#10;&#10;MAINS&#10;- Ribeye — $42..." value={sections} onChange={(e) => setSections(e.target.value)} rows={8} className="font-mono text-xs" /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button key={f.value} onClick={() => setFormat(f.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${format === f.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{f.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Plating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Menu</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4"><UtensilsCrossed className="h-8 w-8 text-emerald-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Menu Designer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Print-ready menus for restaurants, cafes, bars — any format.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /><p className="text-sm text-muted-foreground">Plating menu...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Menu" className="h-auto max-h-[700px] object-contain" /></div>
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
