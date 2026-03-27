import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Monitor, Loader2, Download, Sparkles, RotateCcw, Smartphone, Tablet } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const resolutions = [
  { value: "phone" as const, label: "Phone", icon: Smartphone, desc: "9:16 portrait" },
  { value: "tablet" as const, label: "Tablet", icon: Tablet, desc: "4:3" },
  { value: "desktop" as const, label: "Desktop", icon: Monitor, desc: "16:9 HD" },
  { value: "ultrawide" as const, label: "Ultrawide", icon: Monitor, desc: "21:9" },
  { value: "4k" as const, label: "4K", icon: Monitor, desc: "3840×2160" },
];

const styles = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "abstract", label: "Abstract" },
  { value: "minimal", label: "Minimal" },
  { value: "nature", label: "Nature" },
  { value: "space", label: "Space" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "anime", label: "Anime" },
  { value: "watercolor", label: "Watercolor" },
  { value: "geometric", label: "Geometric" },
  { value: "dark", label: "Dark" },
];

export default function ToolWallpaper() {
  const [prompt, setPrompt] = useState("");
  const [resolution, setResolution] = useState<"phone" | "tablet" | "desktop" | "ultrawide" | "4k">("desktop");
  const [style, setStyle] = useState("photorealistic");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.wallpaper.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Wallpaper generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Wallpaper Generator" description="Create stunning custom wallpapers for any device" icon={Monitor} gradient="from-indigo-500 to-blue-400">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-muted-foreground mb-3">Example output:</p>
          <img loading="lazy" src="/showcase/example-wallpaper-1.jpg" alt="AI generated wallpapers" className="w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Describe Your Wallpaper</Label>
                  <Textarea placeholder="A serene mountain lake at sunset with aurora borealis..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-sm" rows={4} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Device</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {resolutions.map((r) => (
                      <button key={r.value} onClick={() => setResolution(r.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${resolution === r.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <r.icon className="h-4 w-4" />
                        <span className="text-xs font-medium">{r.label}</span>
                        <span className="text-[10px] text-muted-foreground">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Style</Label>
                  <div className="flex flex-wrap gap-2">
                    {styles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ prompt, resolution, style: style as any }); }} disabled={!prompt.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Wallpaper</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setPrompt(""); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
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
                      <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4"><Monitor className="h-8 w-8 text-indigo-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Wallpaper Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe your perfect wallpaper and we'll generate it.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />
                      <p className="text-muted-foreground">Creating your wallpaper...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <img loading="lazy" src={resultUrl} alt="Wallpaper" className="w-full h-auto" />
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download Wallpaper</Button>
                      </div>
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
