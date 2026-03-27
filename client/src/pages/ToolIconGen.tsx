import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AppWindow, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const iconStyles = [
  { value: "flat", label: "Flat" }, { value: "3d", label: "3D" }, { value: "outline", label: "Outline" },
  { value: "filled", label: "Filled" }, { value: "glassmorphism", label: "Glass" }, { value: "gradient", label: "Gradient" },
  { value: "pixel", label: "Pixel" }, { value: "hand-drawn", label: "Drawn" }, { value: "ios", label: "iOS" },
  { value: "material", label: "Material" },
];

const sizes = ["16", "32", "64", "128", "256", "512"];

export default function ToolIconGen() {
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("flat");
  const [size, setSize] = useState("512");
  const [colorScheme, setColorScheme] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.iconGen.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Icon generated!"); }
      else toast.error(data.error || "Failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Icon Generator" description="Create icons and favicons with AI" icon={AppWindow} gradient="from-pink-500 to-rose-400">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/tool-icon.jpg" alt="AI icon generation" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Icon Description</Label>
                  <Textarea placeholder="A lightning bolt inside a shield, representing security..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" rows={3} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Style</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {iconStyles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Size</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map((s) => (
                      <button key={s} onClick={() => setSize(s)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${size === s ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                        {s}px
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color Scheme</Label>
                  <Input placeholder="e.g., Blue and white, Red gradient..." value={colorScheme} onChange={(e) => setColorScheme(e.target.value)} className="text-sm" />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ description, style: style as any, size: size as any, colorScheme: colorScheme || undefined }); }}
                    disabled={!description.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Icon</>}
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
                      <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4"><AppWindow className="h-8 w-8 text-pink-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Icon Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe your icon and choose a style to generate.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-pink-400" /><p className="text-muted-foreground">Designing your icon...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="p-8 flex flex-col items-center gap-6">
                        <div className="p-4 rounded-2xl bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                          <img loading="lazy" src={resultUrl} alt="Icon" className="w-48 h-48 object-contain" />
                        </div>
                        <div className="flex gap-4 items-end">
                          {["16", "32", "64"].map((s) => (
                            <div key={s} className="flex flex-col items-center gap-1">
                              <img loading="lazy" src={resultUrl} alt={`${s}px`} style={{ width: `${parseInt(s)}px`, height: `${parseInt(s)}px` }} className="object-contain" />
                              <span className="text-[10px] text-muted-foreground">{s}px</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button>
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
