import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { QrCode, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const qrStyles = [
  { value: "cyberpunk", label: "Cyberpunk", color: "from-cyan-500 to-blue-600" },
  { value: "nature", label: "Nature", color: "from-green-500 to-emerald-600" },
  { value: "galaxy", label: "Galaxy", color: "from-purple-500 to-indigo-600" },
  { value: "steampunk", label: "Steampunk", color: "from-cyan-500 to-blue-600" },
  { value: "watercolor", label: "Watercolor", color: "from-pink-500 to-rose-600" },
  { value: "pixel-art", label: "Pixel Art", color: "from-red-500 to-blue-500" },
  { value: "neon", label: "Neon", color: "from-fuchsia-500 to-pink-600" },
  { value: "vintage", label: "Vintage", color: "from-yellow-600 to-amber-700" },
  { value: "minimal", label: "Minimal", color: "from-gray-500 to-slate-600" },
  { value: "abstract", label: "Abstract", color: "from-violet-500 to-purple-600" },
];

export default function ToolQrArt() {
  const [url, setUrl] = useState("");
  const [style, setStyle] = useState("cyberpunk");
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.qrArt.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("QR art generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="QR Code Art" description="Generate stunning artistic QR codes" icon={QrCode} gradient="from-cyan-500 to-blue-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">URL or Text *</Label>
                  <Input placeholder="https://yoursite.com" value={url} onChange={(e) => setUrl(e.target.value)} className="text-sm" />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Art Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {qrStyles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`p-2.5 rounded-xl border-2 transition-all text-left ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <div className={`h-2 w-8 rounded-full bg-gradient-to-r ${s.color} mb-1.5`} />
                        <span className="text-xs font-medium">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Custom Details</Label>
                  <Textarea placeholder="Additional art direction (optional)..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-sm" rows={2} />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ url, style: style as any, prompt: prompt || undefined }); }} disabled={!url.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate QR Art</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setUrl(""); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
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
                      <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4"><QrCode className="h-8 w-8 text-cyan-400" /></div>
                      <h3 className="text-lg font-medium mb-2">QR Code Art Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Enter a URL and choose an art style to create a beautiful QR code.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-cyan-400" /><p className="text-muted-foreground">Creating artistic QR code...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="p-6 flex items-center justify-center"><img loading="lazy" src={resultUrl} alt="QR Art" className="max-w-full max-h-[400px] object-contain rounded-lg" /></div>
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
