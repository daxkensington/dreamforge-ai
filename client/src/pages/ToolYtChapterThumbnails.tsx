import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Youtube, Loader2, Download, Sparkles, RotateCcw, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = [
  { value: "bold-face", label: "Bold Face" },
  { value: "tutorial", label: "Tutorial" },
  { value: "vlog", label: "Vlog" },
  { value: "gaming", label: "Gaming" },
  { value: "educational", label: "Educational" },
  { value: "reaction", label: "Reaction" },
  { value: "minimalist", label: "Minimalist" },
] as const;

type Style = (typeof STYLES)[number]["value"];

export default function ToolYtChapterThumbnails() {
  const [videoTitle, setVideoTitle] = useState("");
  const [chapters, setChapters] = useState<string[]>(["", ""]);
  const [style, setStyle] = useState<Style>("bold-face");
  const [results, setResults] = useState<{ chapter: string; url: string }[]>([]);

  const mutation = trpc.tools.ytChapterThumbnails.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setResults(data.results); toast.success("Thumbnails ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateChapter = (i: number, v: string) => { const next = [...chapters]; next[i] = v; setChapters(next); };
  const addChapter = () => chapters.length < 10 && setChapters([...chapters, ""]);
  const removeChapter = () => chapters.length > 2 && setChapters(chapters.slice(0, -1));

  const handleGenerate = () => {
    const filtered = chapters.map((c) => c.trim()).filter(Boolean);
    if (!videoTitle.trim() || filtered.length < 2) { toast.error("Video title + at least 2 chapters"); return; }
    setResults([]);
    mutation.mutate({ videoTitle, chapters: filtered, style });
  };
  const handleReset = () => { setVideoTitle(""); setChapters(["", ""]); setStyle("bold-face"); setResults([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="YouTube Chapter Thumbnails" description="Batch thumbnails per chapter, optimized for CTR" icon={Youtube} gradient="from-red-500 to-red-700">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Video Title</Label><Input placeholder="I built a PC in 24 hours..." value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between"><Label className="text-sm font-medium">Chapters</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={removeChapter} disabled={chapters.length <= 2}><Minus className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={addChapter} disabled={chapters.length >= 10}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              {chapters.map((c, i) => (
                <Input key={i} placeholder={`Chapter ${i + 1}`} value={c} onChange={(e) => updateChapter(i, e.target.value)} className="text-sm" />
              ))}
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Rendering...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Thumbnails</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4"><Youtube className="h-8 w-8 text-red-400" /></div>
                  <h3 className="text-lg font-medium mb-2">YouTube Chapter Thumbnails</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">One thumbnail per chapter — MrBeast-style, tutorial, vlog, gaming, and more.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-red-400" /><p className="text-sm text-muted-foreground">Rendering thumbnails...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-video">
                        <img loading="lazy" src={r.url} alt={r.chapter} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground truncate max-w-[70%]">{r.chapter}</span>
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
