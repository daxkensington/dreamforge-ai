import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AudioLines, Loader2, Copy, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const enhancements = [
  { value: "full" as const, label: "Full Enhancement", desc: "Noise removal + clarity + normalization", icon: "🎛️" },
  { value: "noise-removal" as const, label: "Noise Removal", desc: "Remove background noise", icon: "🔇" },
  { value: "clarity" as const, label: "Clarity Boost", desc: "Enhance vocal clarity", icon: "🎙️" },
  { value: "volume-normalize" as const, label: "Normalize", desc: "Consistent volume levels", icon: "📊" },
  { value: "bass-boost" as const, label: "Bass Boost", desc: "Richer low frequencies", icon: "🔊" },
  { value: "vocal-isolate" as const, label: "Vocal Isolation", desc: "Separate vocals from music", icon: "🎤" },
];

export default function ToolAudioEnhance() {
  const [description, setDescription] = useState("");
  const [enhancement, setEnhancement] = useState<"noise-removal" | "clarity" | "volume-normalize" | "bass-boost" | "vocal-isolate" | "full">("full");
  const [recommendations, setRecommendations] = useState<string | null>(null);

  const mutation = trpc.tools.audioEnhance.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.recommendations) { setRecommendations(data.recommendations); toast.success("Enhancement guide ready!"); }
      else toast.error(data.error || "Failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Audio Enhancer" description="AI-powered audio enhancement recommendations" icon={AudioLines} gradient="from-yellow-500 to-cyan-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Describe Your Audio</Label>
                  <Textarea placeholder="e.g., Podcast recording in a noisy room with echo, recorded on phone mic..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" rows={4} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Enhancement Type</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {enhancements.map((e) => (
                      <button key={e.value} onClick={() => setEnhancement(e.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${enhancement === e.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-lg">{e.icon}</span>
                        <div>
                          <span className="text-sm font-medium">{e.label}</span>
                          <p className="text-xs text-muted-foreground">{e.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setRecommendations(null); mutation.mutate({ description, enhancement }); }} disabled={!description.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" />Get Enhancement Guide</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setDescription(""); setRecommendations(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-yellow-400" /><p className="text-sm text-muted-foreground">Analyzing audio and generating guide...</p>
                    </motion.div>
                  ) : recommendations ? (
                    <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Enhancement Guide</Badge>
                        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(recommendations); toast.success("Copied!"); }}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/30 max-h-[500px] overflow-y-auto">
                        <div className="prose prose-sm prose-invert max-w-none">
                          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{recommendations}</pre>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-16 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4"><AudioLines className="h-8 w-8 text-yellow-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Enhancement Guide</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe your audio and get professional enhancement recommendations.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
