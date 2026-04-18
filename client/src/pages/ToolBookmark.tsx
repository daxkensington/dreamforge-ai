import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bookmark, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const THEMES = ["literary-classic", "floral-botanical", "fantasy", "minimalist", "watercolor", "dark-academia", "cute-kawaii", "nature"] as const;
type Theme = (typeof THEMES)[number];

export default function ToolBookmark() {
  const [content, setContent] = useState("");
  const [theme, setTheme] = useState<Theme>("literary-classic");
  const [includeQuote, setIncludeQuote] = useState(true);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.bookmark.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Bookmark ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!content.trim()) { toast.error("Content required"); return; } setResultUrl(null); mutation.mutate({ content, theme, includeQuote }); };
  const handleReset = () => { setContent(""); setTheme("literary-classic"); setIncludeQuote(true); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Bookmark Designer" description="Printable bookmarks for readers, Etsy sellers, and book clubs" icon={Bookmark} gradient="from-amber-700 to-stone-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Quote or Book Subject</Label>
              <Textarea placeholder='"Not all those who wander are lost." — Tolkien' value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
              <div className="flex items-center justify-between pt-2">
                <Label className="text-sm">Render as quote text</Label>
                <Switch checked={includeQuote} onCheckedChange={setIncludeQuote} />
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Theme</Label>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button key={t} onClick={() => setTheme(t)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${theme === t ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Printing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Bookmark</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-700/10 flex items-center justify-center mb-4"><Bookmark className="h-8 w-8 text-amber-500" /></div>
                    <h3 className="text-lg font-medium mb-2">Bookmark Designer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">2x6 print-ready bookmarks — quotes, book themes, Etsy-seller quality.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /><p className="text-sm text-muted-foreground">Printing bookmark...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Bookmark" className="h-auto max-h-[700px] object-contain" /></div>
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
