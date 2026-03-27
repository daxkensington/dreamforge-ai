import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Waves, Loader2, Copy, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { value: "nature", label: "Nature", icon: "🌿" },
  { value: "sci-fi", label: "Sci-Fi", icon: "🚀" },
  { value: "horror", label: "Horror", icon: "👻" },
  { value: "comedy", label: "Comedy", icon: "😄" },
  { value: "action", label: "Action", icon: "💥" },
  { value: "ambient", label: "Ambient", icon: "🌙" },
  { value: "ui", label: "UI/UX", icon: "🔔" },
  { value: "musical", label: "Musical", icon: "🎵" },
  { value: "foley", label: "Foley", icon: "🎬" },
  { value: "custom", label: "Custom", icon: "✨" },
];

const durations = [
  { value: "short" as const, label: "Short", desc: "~2 seconds" },
  { value: "medium" as const, label: "Medium", desc: "~5 seconds" },
  { value: "long" as const, label: "Long", desc: "~10 seconds" },
];

export default function ToolSoundEffects() {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [duration, setDuration] = useState<"short" | "medium" | "long">("medium");
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.tools.soundEffects.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.name) { setResult(data); toast.success("Sound effect designed!"); }
      else toast.error(data.error || "Failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Sound Effects Generator" description="Design custom sound effects with AI" icon={Waves} gradient="from-red-500 to-rose-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Describe Your Sound</Label>
                  <Textarea placeholder="e.g., A magical portal opening with whooshing energy..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" rows={3} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Category</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.map((c) => (
                      <button key={c.value} onClick={() => setCategory(c.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${category === c.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-sm">{c.icon}</span>
                        <span className="text-xs font-medium">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Duration</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {durations.map((d) => (
                      <button key={d.value} onClick={() => setDuration(d.value)}
                        className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all ${duration === d.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{d.label}</span>
                        <span className="text-[10px] text-muted-foreground">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResult(null); mutation.mutate({ description, category: category as any, duration }); }} disabled={!description.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Designing...</> : <><Sparkles className="h-4 w-4 mr-2" />Design Sound Effect</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setDescription(""); setResult(null); }}><RotateCcw className="h-4 w-4" /></Button>
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
                      <Loader2 className="h-8 w-8 animate-spin text-red-400" /><p className="text-sm text-muted-foreground">Designing your sound effect...</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">{result.name}</h3>
                          <p className="text-sm text-muted-foreground">{result.category} · {result.duration}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast.success("Copied!"); }}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      </div>

                      <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                        <h4 className="text-sm font-medium mb-2">Technical Specification</h4>
                        <p className="text-sm text-muted-foreground">{result.technicalSpec}</p>
                      </div>

                      {result.layers?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Sound Layers</h4>
                          <div className="grid gap-2">
                            {result.layers.map((layer: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{layer.sound}</p>
                                  <p className="text-xs text-muted-foreground">{layer.frequency}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">{layer.volume}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.recreationSteps?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Recreation Steps</h4>
                          <ol className="space-y-1.5 list-decimal list-inside">
                            {result.recreationSteps.map((step: string, i: number) => (
                              <li key={i} className="text-sm text-muted-foreground">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {result.references?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Reference Sounds</h4>
                          <div className="flex flex-wrap gap-2">
                            {result.references.map((ref: string, i: number) => (
                              <Badge key={i} variant="secondary">{ref}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-16 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4"><Waves className="h-8 w-8 text-red-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Sound Effect Designer</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe any sound effect and get a detailed technical blueprint for creating it.</p>
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
