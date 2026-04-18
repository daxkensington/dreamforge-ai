import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mic, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GENRES = ["true-crime", "comedy", "business", "tech", "self-help", "news", "interview", "education", "health", "spirituality", "sports", "music", "other"] as const;
const VIBES = ["bold", "minimalist", "vintage", "dark", "playful", "professional", "artistic"] as const;

type Genre = (typeof GENRES)[number];
type Vibe = (typeof VIBES)[number];

export default function ToolPodcastCover() {
  const [podcastName, setPodcastName] = useState("");
  const [tagline, setTagline] = useState("");
  const [hostName, setHostName] = useState("");
  const [genre, setGenre] = useState<Genre>("other");
  const [vibe, setVibe] = useState<Vibe>("bold");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.podcastCover.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Cover ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!podcastName.trim()) { toast.error("Podcast name required"); return; }
    setResultUrl(null);
    mutation.mutate({ podcastName, tagline: tagline || undefined, hostName: hostName || undefined, genre, vibe });
  };
  const handleReset = () => { setPodcastName(""); setTagline(""); setHostName(""); setGenre("other"); setVibe("bold"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Podcast Cover Art" description="Spotify / Apple-ready square artwork with genre-aware design" icon={Mic} gradient="from-fuchsia-500 to-purple-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Podcast Name</Label><Input placeholder="The Midnight Hour" value={podcastName} onChange={(e) => setPodcastName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Tagline (optional)</Label><Input placeholder="Stories that keep you up" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Host (optional)</Label><Input placeholder="Alex Chen" value={hostName} onChange={(e) => setHostName(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Genre</Label>
              <div className="grid grid-cols-2 gap-2">
                {GENRES.map((g) => (
                  <button key={g} onClick={() => setGenre(g)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${genre === g ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{g.replace("-", " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Vibe</Label>
              <div className="grid grid-cols-3 gap-2">
                {VIBES.map((v) => (
                  <button key={v} onClick={() => setVibe(v)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${vibe === v ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{v}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!podcastName.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Designing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Cover</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-4"><Mic className="h-8 w-8 text-fuchsia-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Podcast Cover Art</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Legible at thumbnail size — optimized for Spotify & Apple Podcasts grids.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" /><p className="text-sm text-muted-foreground">Designing cover...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center">
                      <img loading="lazy" src={resultUrl} alt="Podcast cover" className="w-full max-w-md h-auto aspect-square object-cover" />
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
