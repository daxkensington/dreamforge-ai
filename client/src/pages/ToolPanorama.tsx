import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ScanLine, Upload, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const directions = [
  { value: "horizontal" as const, label: "Horizontal", desc: "Wide panoramic" },
  { value: "vertical" as const, label: "Vertical", desc: "Tall extension" },
  { value: "360" as const, label: "360°", desc: "Full wrap-around" },
];

const expansions = [
  { value: "2x" as const, label: "2×" },
  { value: "3x" as const, label: "3×" },
  { value: "4x" as const, label: "4×" },
];

export default function ToolPanorama() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [direction, setDirection] = useState<"horizontal" | "vertical" | "360">("horizontal");
  const [expansion, setExpansion] = useState<"2x" | "3x" | "4x">("3x");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.panorama.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Panorama created!"); }
      else toast.error(data.error || "Failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) { const { url } = await res.json(); setImageUrl(url); }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Panorama Generator" description="Extend images into sweeping panoramic views" icon={ScanLine} gradient="from-sky-500 to-indigo-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Source Image</Label>
                  <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Upload Image"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Direction</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {directions.map((d) => (
                      <button key={d.value} onClick={() => setDirection(d.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${direction === d.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{d.label}</span>
                        <span className="text-[10px] text-muted-foreground">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Expansion</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {expansions.map((e) => (
                      <button key={e.value} onClick={() => setExpansion(e.value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center font-bold ${expansion === e.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ imageUrl, direction, expansionFactor: expansion }); }}
                    disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Expanding...</> : <><Sparkles className="h-4 w-4 mr-2" />Create Panorama</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setImageUrl(""); setImagePreview(null); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!resultUrl && !isProcessing && !imagePreview ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-4"><ScanLine className="h-8 w-8 text-sky-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Panorama Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Upload an image to extend it into a panoramic view.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-sky-400" /><p className="text-muted-foreground">Extending your image...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <div className="p-4 overflow-x-auto"><img src={resultUrl} alt="Panorama" className="max-h-[400px] rounded-lg" /></div>
                      <div className="p-4 border-t border-border/50 flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
                    </motion.div>
                  ) : imagePreview ? (
                    <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                      <Badge variant="secondary" className="mb-3">Source Image</Badge>
                      <img src={imagePreview} alt="Source" className="w-full max-h-[400px] object-contain rounded-lg" />
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
