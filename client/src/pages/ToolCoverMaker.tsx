import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BookOpen, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COVER_TYPES = [
  { value: "book", label: "Book" },
  { value: "album", label: "Album" },
  { value: "ebook", label: "eBook" },
  { value: "audiobook", label: "Audiobook" },
  { value: "magazine", label: "Magazine" },
] as const;
const MOODS = ["mysterious", "romantic", "dark", "uplifting", "minimalist", "dramatic", "whimsical", "futuristic"] as const;

type CoverType = (typeof COVER_TYPES)[number]["value"];
type Mood = (typeof MOODS)[number];

export default function ToolCoverMaker() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [coverType, setCoverType] = useState<CoverType>("book");
  const [mood, setMood] = useState<Mood>("dramatic");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.coverMaker.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Cover ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!title.trim() || !genre.trim()) { toast.error("Title and genre are required"); return; }
    setResultUrl(null);
    mutation.mutate({ title, subtitle: subtitle || undefined, author: author || undefined, genre, coverType, mood });
  };
  const handleReset = () => { setTitle(""); setSubtitle(""); setAuthor(""); setGenre(""); setCoverType("book"); setMood("dramatic"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Cover Maker" description="Book, album, eBook, and magazine covers with AI typography" icon={BookOpen} gradient="from-amber-500 to-orange-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Title</Label><Input placeholder="The Silent Echo" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Subtitle (optional)</Label><Input placeholder="A Novel of Lost Worlds" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Author / Artist (optional)</Label><Input placeholder="Jane Doe" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Genre</Label><Input placeholder="Sci-fi thriller" value={genre} onChange={(e) => setGenre(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {COVER_TYPES.map((c) => (
                  <button key={c.value} onClick={() => setCoverType(c.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${coverType === c.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{c.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Mood</Label>
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map((m) => (
                  <button key={m} onClick={() => setMood(m)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${mood === m ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{m}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!title.trim() || !genre.trim() || isProcessing} className="flex-1" size="lg">
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
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"><BookOpen className="h-8 w-8 text-amber-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Cover Maker</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Pro-quality covers with title, author, and genre-aware artwork baked in.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /><p className="text-sm text-muted-foreground">Designing cover...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center">
                      <img loading="lazy" src={resultUrl} alt="Cover" className="h-auto max-h-[600px] object-contain" />
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
