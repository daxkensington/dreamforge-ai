import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;
const THEMES = [
  { value: "animals", label: "Animals" },
  { value: "mandala", label: "Mandala" },
  { value: "fantasy", label: "Fantasy" },
  { value: "nature", label: "Nature" },
  { value: "vehicles", label: "Vehicles" },
  { value: "characters", label: "Characters" },
  { value: "seasonal", label: "Seasonal" },
  { value: "custom", label: "Custom" },
] as const;

type Difficulty = (typeof DIFFICULTIES)[number]["value"];
type Theme = (typeof THEMES)[number]["value"];

export default function ToolColoringBook() {
  const [concept, setConcept] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [theme, setTheme] = useState<Theme>("custom");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.coloringBook.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Coloring page ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!concept.trim()) { toast.error("Describe your coloring page"); return; }
    setResultUrl(null);
    mutation.mutate({ concept, difficulty, theme });
  };
  const handleReset = () => { setConcept(""); setDifficulty("medium"); setTheme("custom"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Coloring Book Page" description="Printable line-art pages for kids and adult coloring books" icon={Pencil} gradient="from-slate-500 to-zinc-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Scene / Subject</Label>
              <Input placeholder="A dragon napping on a mountain..." value={concept} onChange={(e) => setConcept(e.target.value)} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Difficulty</Label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => (
                  <button key={d.value} onClick={() => setDifficulty(d.value)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${difficulty === d.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{d.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Theme</Label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button key={t.value} onClick={() => setTheme(t.value)} className={`p-3 rounded-lg border-2 text-xs font-medium transition-all ${theme === t.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!concept.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Drawing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Page</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mb-4"><Pencil className="h-8 w-8 text-slate-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Coloring Book Page</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Describe any scene and get a print-ready line-art page — kids, adults, Etsy printables.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /><p className="text-sm text-muted-foreground">Drawing lines...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-white border border-border/30">
                      <img loading="lazy" src={resultUrl} alt="Coloring page" className="w-full h-auto max-h-[600px] object-contain" />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
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
