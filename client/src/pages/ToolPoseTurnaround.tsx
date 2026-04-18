import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { RotateCw, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = ["anime", "realistic", "comic", "3d-render", "sketch", "painterly"] as const;
type Style = (typeof STYLES)[number];

export default function ToolPoseTurnaround() {
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<Style>("realistic");
  const [views, setViews] = useState(3);
  const [results, setResults] = useState<{ view: string; url: string }[]>([]);

  const mutation = trpc.tools.poseTurnaround.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setResults(data.results); toast.success("Turnaround ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!description.trim()) { toast.error("Describe your character"); return; }
    setResults([]);
    mutation.mutate({ description, style, views });
  };
  const handleReset = () => { setDescription(""); setStyle("realistic"); setViews(3); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Pose Turnaround" description="Multi-view character reference sheets for artists" icon={RotateCw} gradient="from-indigo-500 to-violet-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Character Description</Label>
              <Textarea placeholder="Young elf warrior in silver armor with green cloak, long black hair, dual daggers..." value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace("-", " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Number of Views</Label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map((n) => (
                  <button key={n} onClick={() => setViews(n)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${views === n ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{n}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!description.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rendering views...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Turnaround</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4"><RotateCw className="h-8 w-8 text-indigo-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Pose Turnaround</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Consistent character across front, side, and back views — a drawing reference you can actually use.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-indigo-400" /><p className="text-sm text-muted-foreground">Drawing views...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {results.map((r) => (
                    <div key={r.view} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                        <img loading="lazy" src={r.url} alt={r.view} className="w-full h-auto object-contain" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground capitalize">{r.view}</span>
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
