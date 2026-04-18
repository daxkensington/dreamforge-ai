import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Clapperboard, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GENRES = ["action", "horror", "scifi", "drama", "comedy", "thriller", "romance", "fantasy", "documentary", "animation", "noir", "indie"] as const;
type Genre = (typeof GENRES)[number];

export default function ToolMoviePoster() {
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [genre, setGenre] = useState<Genre>("scifi");
  const [synopsis, setSynopsis] = useState("");
  const [credits, setCredits] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.moviePoster.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Poster ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!title.trim() || !synopsis.trim()) { toast.error("Title and synopsis required"); return; } setResultUrl(null); mutation.mutate({ title, tagline: tagline || undefined, genre, synopsis, credits: credits || undefined }); };
  const handleReset = () => { setTitle(""); setTagline(""); setGenre("scifi"); setSynopsis(""); setCredits(""); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Movie Poster" description="Theatrical-quality one-sheets for any genre" icon={Clapperboard} gradient="from-red-600 to-amber-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Title</Label><Input placeholder="Neon Horizon" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Tagline (optional)</Label><Input placeholder="Time forgets. The city doesn't." value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Synopsis / Hero Visual</Label><Textarea placeholder="Lone astronaut stranded on a neon-lit planet with twin moons..." value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={4} /></div>
              <div className="space-y-2"><Label className="text-sm">Billing Block (optional)</Label><Textarea placeholder="Starring... Directed by..." value={credits} onChange={(e) => setCredits(e.target.value)} rows={2} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Genre</Label>
              <div className="grid grid-cols-3 gap-2">
                {GENRES.map((g) => (
                  <button key={g} onClick={() => setGenre(g)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${genre === g ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{g}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Printing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Poster</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4"><Clapperboard className="h-8 w-8 text-red-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Movie Poster</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">24×36 theatrical one-sheet quality — any genre, any story.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-red-400" /><p className="text-sm text-muted-foreground">Printing poster...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Movie poster" className="h-auto max-h-[700px] object-contain" /></div>
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
