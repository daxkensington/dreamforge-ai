import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const characterStyles = [
  { value: "anime", label: "Anime", icon: "🌸" },
  { value: "realistic", label: "Realistic", icon: "📷" },
  { value: "cartoon", label: "Cartoon", icon: "🎨" },
  { value: "comic", label: "Comic", icon: "💥" },
  { value: "pixel-art", label: "Pixel Art", icon: "👾" },
  { value: "3d-render", label: "3D Render", icon: "🧊" },
  { value: "fantasy", label: "Fantasy", icon: "🧙" },
  { value: "sci-fi", label: "Sci-Fi", icon: "🚀" },
];

const viewOptions = [
  { value: "turnaround", label: "Turnaround", desc: "360° character rotation" },
  { value: "expressions", label: "Expressions", desc: "Emotion sheet" },
  { value: "poses", label: "Poses", desc: "Action & pose variety" },
  { value: "full-sheet", label: "Full Sheet", desc: "Complete reference" },
];

export default function ToolCharacterSheet() {
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("anime");
  const [views, setViews] = useState("full-sheet");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.characterSheet.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Character sheet generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Character Sheet Generator" description="Create detailed character reference sheets" icon={Users} gradient="from-violet-500 to-purple-500">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Character Description</Label>
                  <Textarea placeholder="e.g., A cyberpunk elf warrior with silver hair, glowing blue eyes, wearing dark armor with neon accents..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" rows={4} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Art Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {characterStyles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-sm">{s.icon}</span>
                        <span className="text-xs font-medium">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Sheet Type</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {viewOptions.map((v) => (
                      <button key={v.value} onClick={() => setViews(v.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${views === v.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <div>
                          <span className="text-xs font-medium">{v.label}</span>
                          <p className="text-[10px] text-muted-foreground">{v.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ description, style: style as any, views: views as any }); }} disabled={!description.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Sheet</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setDescription(""); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!resultUrl && !isProcessing ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4"><Users className="h-8 w-8 text-red-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Character Sheet Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe your character and choose a style to generate a complete reference sheet.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-red-400" /><p className="text-muted-foreground">Creating your character sheet...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="p-4">
                        <Badge className="mb-3 bg-red-500/20 text-red-400 border-red-500/30">Character Sheet</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          <img loading="lazy" src={resultUrl} alt="Character Sheet" className="w-full h-auto object-contain" />
                        </div>
                      </div>
                      <div className="p-4 border-t border-border/50 flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
