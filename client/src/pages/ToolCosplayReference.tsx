import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Wand2, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const FOCUS = [
  { value: "full-costume", label: "Full Costume" },
  { value: "weapon-props", label: "Weapon / Props" },
  { value: "hair-makeup", label: "Hair & Makeup" },
  { value: "accessories-detail", label: "Accessories" },
] as const;
type Focus = (typeof FOCUS)[number]["value"];

export default function ToolCosplayReference() {
  const [character, setCharacter] = useState("");
  const [views, setViews] = useState(3);
  const [focus, setFocus] = useState<Focus>("full-costume");
  const [results, setResults] = useState<{ view: string; url: string }[]>([]);

  const mutation = trpc.tools.cosplayReference.useMutation({
    onSuccess: (data) => { if (data.status === "completed") { setResults(data.results); toast.success("Reference ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!character.trim()) { toast.error("Describe the character"); return; } setResults([]); mutation.mutate({ character, views, focus }); };
  const handleReset = () => { setCharacter(""); setViews(3); setFocus("full-costume"); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Cosplay Reference" description="Multi-view costume reference sheets for cosplayers and costumers" icon={Wand2} gradient="from-purple-500 to-pink-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Character Description</Label>
              <Textarea placeholder="Cyberpunk street samurai, black hooded leather jacket with neon circuit embroidery, mirrored visor, katana at hip..." value={character} onChange={(e) => setCharacter(e.target.value)} rows={5} />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Focus</Label>
              <div className="grid grid-cols-2 gap-2">
                {FOCUS.map((f) => (
                  <button key={f.value} onClick={() => setFocus(f.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${focus === f.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{f.label}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Views</Label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map((n) => (
                  <button key={n} onClick={() => setViews(n)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${views === n ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{n}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Breakdown...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Reference</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4"><Wand2 className="h-8 w-8 text-purple-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Cosplay Reference</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Buildable costume references with seams, textures, accessories visible.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /><p className="text-sm text-muted-foreground">Drawing reference...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-[3/4]"><img loading="lazy" src={r.url} alt={r.view} className="w-full h-full object-cover" /></div>
                      <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground capitalize">{r.view}</span><Button variant="ghost" size="sm" onClick={() => window.open(r.url, "_blank")}><Download className="h-3 w-3" /></Button></div>
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
