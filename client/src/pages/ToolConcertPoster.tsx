import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Music, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GENRES = ["rock", "hip-hop", "electronic", "indie", "country", "classical", "jazz", "metal", "folk", "punk", "pop", "reggae"] as const;
const STYLES = ["psychedelic-60s", "punk-cut", "modern-gradient", "minimalist-editorial", "heavy-metal", "festival-colorful", "80s-synthwave", "woodblock-print"] as const;
type Genre = (typeof GENRES)[number];
type Style = (typeof STYLES)[number];

export default function ToolConcertPoster() {
  const [artist, setArtist] = useState("");
  const [genre, setGenre] = useState<Genre>("indie");
  const [details, setDetails] = useState("");
  const [style, setStyle] = useState<Style>("modern-gradient");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.concertPoster.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Poster ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!artist.trim() || !details.trim()) { toast.error("Artist and details required"); return; } setResultUrl(null); mutation.mutate({ artist, genre, details, style }); };
  const handleReset = () => { setArtist(""); setGenre("indie"); setDetails(""); setStyle("modern-gradient"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Concert Poster" description="Gig and tour posters — silkscreen merch quality" icon={Music} gradient="from-fuchsia-600 to-pink-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Artist / Band</Label><Input placeholder="The Black Tusks" value={artist} onChange={(e) => setArtist(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Tour / Show Details</Label><Textarea placeholder="Spring 2026 Tour — Toronto 3/15, NYC 3/18, LA 3/22..." value={details} onChange={(e) => setDetails(e.target.value)} rows={4} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Genre</Label>
              <div className="grid grid-cols-3 gap-2">
                {GENRES.map((g) => (
                  <button key={g} onClick={() => setGenre(g)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${genre === g ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{g}</button>
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
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Silkscreening...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Poster</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-4"><Music className="h-8 w-8 text-fuchsia-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Concert Poster</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">11×17 merch-table quality gig posters, any genre, any style.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" /><p className="text-sm text-muted-foreground">Silkscreening...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Poster" className="h-auto max-h-[700px] object-contain" /></div>
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
