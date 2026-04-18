import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Instagram, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = [
  { value: "educational", label: "Educational" },
  { value: "listicle", label: "Listicle" },
  { value: "storytelling", label: "Storytelling" },
  { value: "quote-pack", label: "Quote Pack" },
  { value: "before-after", label: "Before / After" },
  { value: "tips", label: "Tips" },
  { value: "minimalist-editorial", label: "Minimalist" },
] as const;

type Style = (typeof STYLES)[number]["value"];

export default function ToolIgCarousel() {
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState(7);
  const [brandColor, setBrandColor] = useState("");
  const [style, setStyle] = useState<Style>("educational");
  const [slides, setSlides] = useState<{ headline: string; body: string; role: string; url: string }[]>([]);

  const mutation = trpc.tools.igCarousel.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setSlides(data.slides); toast.success("Carousel ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Enter a topic"); return; }
    setSlides([]);
    mutation.mutate({ topic, slideCount, brandColor: brandColor || undefined, style });
  };
  const handleReset = () => { setTopic(""); setSlideCount(7); setBrandColor(""); setStyle("educational"); setSlides([]); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Instagram Carousel" description="Branded multi-slide carousels from any topic" icon={Instagram} gradient="from-pink-500 via-purple-500 to-orange-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Topic</Label>
              <Textarea placeholder="5 mistakes new freelancers make..." value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Slides</Label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 5, 7, 10].map((n) => (
                  <button key={n} onClick={() => setSlideCount(n)} className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${slideCount === n ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{n}</button>
                ))}
              </div>
              <div className="space-y-2"><Label className="text-sm">Brand Color (optional)</Label><Input placeholder="#0099ff or 'emerald green'" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} /></div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!topic.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Designing slides...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Carousel</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!slides.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4"><Instagram className="h-8 w-8 text-pink-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Instagram Carousel</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Hook slide, value slides, CTA — AI writes the copy and designs every frame.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-pink-400" /><p className="text-sm text-muted-foreground">Designing slides...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {slides.map((s, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-square relative">
                        <img loading="lazy" src={s.url} alt={s.headline} className="w-full h-full object-cover" />
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] uppercase">{idx + 1}/{slides.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground truncate max-w-[70%]">{s.headline}</span>
                        <Button variant="ghost" size="sm" onClick={() => window.open(s.url, "_blank")}><Download className="h-3 w-3" /></Button>
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
