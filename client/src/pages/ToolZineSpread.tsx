import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Newspaper, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = ["punk-cut-paste", "indie-literary", "art-magazine", "photography-portfolio", "manifesto", "sci-fi-pulp"] as const;
type Style = (typeof STYLES)[number];

export default function ToolZineSpread() {
  const [topic, setTopic] = useState("");
  const [pages, setPages] = useState(4);
  const [style, setStyle] = useState<Style>("indie-literary");
  const [results, setResults] = useState<{ heading: string; body: string; visual: string; url: string }[]>([]);

  const mutation = trpc.tools.zineSpread.useMutation({
    onSuccess: (data) => { if (data.status === "completed") { setResults(data.results); toast.success("Zine ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!topic.trim()) { toast.error("Topic required"); return; } setResults([]); mutation.mutate({ topic, pages, style }); };
  const handleReset = () => { setTopic(""); setPages(4); setStyle("indie-literary"); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Zine Spread Designer" description="Multi-page editorial zine spreads from a single topic" icon={Newspaper} gradient="from-slate-600 to-gray-700">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Topic</Label>
              <Textarea placeholder="DIY music scene in 90s Olympia, Washington..." value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Pages</Label>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} onClick={() => setPages(n)} className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${pages === n ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{n}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Typesetting...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Zine</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-slate-600/10 flex items-center justify-center mb-4"><Newspaper className="h-8 w-8 text-slate-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Zine Spread Designer</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">AI writes the editorial copy and designs every page — DIY zine culture meets AI.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /><p className="text-sm text-muted-foreground">Typesetting zine...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-[3/4]"><img loading="lazy" src={r.url} alt={r.heading} className="w-full h-full object-cover" /></div>
                      <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground truncate max-w-[70%]">{r.heading}</span><Button variant="ghost" size="sm" onClick={() => window.open(r.url, "_blank")}><Download className="h-3 w-3" /></Button></div>
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
