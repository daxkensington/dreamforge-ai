import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Smile, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES = ["apple", "google", "twitter", "pixel", "hand-drawn", "3d", "meme", "retro"] as const;
const VARIANTS = ["discord", "slack", "twitch", "generic"] as const;
type Style = (typeof STYLES)[number];
type Variant = (typeof VARIANTS)[number];

export default function ToolEmojiCreator() {
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<Style>("apple");
  const [variant, setVariant] = useState<Variant>("generic");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.emojiCreator.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Emoji ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!concept.trim()) { toast.error("Describe the emoji"); return; } setResultUrl(null); mutation.mutate({ concept, style, variant }); };
  const handleReset = () => { setConcept(""); setStyle("apple"); setVariant("generic"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Emoji Creator" description="Custom emojis for Discord, Slack, Twitch, and chat apps" icon={Smile} gradient="from-yellow-400 to-orange-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Concept</Label>
              <Input placeholder="Excited cat with party hat" value={concept} onChange={(e) => setConcept(e.target.value)} className="text-sm" />
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-4 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace("-", " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Platform</Label>
              <div className="grid grid-cols-4 gap-2">
                {VARIANTS.map((v) => (
                  <button key={v} onClick={() => setVariant(v)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${variant === v ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{v}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!concept.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Making...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Emoji</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4"><Smile className="h-8 w-8 text-yellow-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Emoji Creator</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">One readable emoji, any style — Discord emotes, Slack reactions, Twitch subs.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /><p className="text-sm text-muted-foreground">Making emoji...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-white border border-border/30 flex justify-center p-4"><img loading="lazy" src={resultUrl} alt="Emoji" className="w-64 h-64 object-contain" /></div>
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
