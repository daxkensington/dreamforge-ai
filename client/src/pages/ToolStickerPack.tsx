import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sticker, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = ["kawaii", "cartoon", "chibi", "minimal", "retro", "handdrawn", "3d"] as const;
type Style = (typeof STYLES)[number];

export default function ToolStickerPack() {
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(6);
  const [style, setStyle] = useState<Style>("cartoon");
  const [results, setResults] = useState<{ subject: string; caption: string; url: string }[]>([]);

  const mutation = trpc.tools.stickerPack.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setResults(data.results); toast.success("Sticker pack ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!theme.trim()) { toast.error("Enter a theme"); return; } setResults([]); mutation.mutate({ theme, count, style }); };
  const handleReset = () => { setTheme(""); setCount(6); setStyle("cartoon"); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Sticker Pack Designer" description="6-8 coordinated stickers — Telegram, iMessage, WhatsApp ready" icon={Sticker} gradient="from-teal-400 to-cyan-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Theme</Label>
              <Input placeholder="Grumpy cat moods, startup life..." value={theme} onChange={(e) => setTheme(e.target.value)} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Count</Label>
              <div className="grid grid-cols-6 gap-2">
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <button key={n} onClick={() => setCount(n)} className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${count === n ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{n}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!theme.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Making pack...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Pack</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4"><Sticker className="h-8 w-8 text-teal-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Sticker Pack Designer</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">One cohesive theme, 3-8 die-cut stickers ready for chat apps.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /><p className="text-sm text-muted-foreground">Making pack...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-white border border-border/30 aspect-square"><img loading="lazy" src={r.url} alt={r.subject} className="w-full h-full object-contain" /></div>
                      <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground truncate max-w-[70%]">{r.subject}</span><Button variant="ghost" size="sm" onClick={() => window.open(r.url, "_blank")}><Download className="h-3 w-3" /></Button></div>
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
