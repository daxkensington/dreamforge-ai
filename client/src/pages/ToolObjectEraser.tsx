import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Eraser,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FILL_METHODS = [
  { value: "auto", label: "Auto Fill", description: "AI fills with contextually appropriate content" },
  { value: "blur", label: "Smooth Blur", description: "Fills with blurred surrounding colors" },
  { value: "pattern", label: "Pattern Extend", description: "Extends surrounding textures and patterns" },
] as const;

const QUICK_OBJECTS = [
  "person in the background",
  "text / watermark",
  "power lines / wires",
  "trash / debris",
  "vehicle / car",
  "shadow",
  "logo / branding",
  "fence / barrier",
];

export default function ToolObjectEraser() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [objectDescription, setObjectDescription] = useState("");
  const [fillMethod, setFillMethod] = useState<"auto" | "blur" | "pattern">("auto");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eraseMutation = trpc.tools.eraseObject.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Object removed successfully!");
      } else {
        toast.error(data.error || "Object removal failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
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

  const handleProcess = () => {
    if (!imageUrl) { toast.error("Please provide an image"); return; }
    if (!objectDescription.trim()) { toast.error("Describe what to remove"); return; }
    setResultUrl(null);
    eraseMutation.mutate({ imageUrl, objectDescription, fillMethod });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null); setObjectDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = eraseMutation.isPending;

  return (
    <ToolPageLayout
      title="Object Eraser"
      description="Remove unwanted objects from images cleanly with AI"
      icon={Eraser}
      gradient="from-rose-500 to-pink-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Source Image</Label>
                <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Or Upload Image"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-2 block">What to Remove</Label>
                  <Textarea placeholder="Describe the object to remove... (e.g., 'the person on the left side')" value={objectDescription} onChange={(e) => setObjectDescription(e.target.value)} rows={3} className="text-sm" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Quick Select</Label>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_OBJECTS.map((obj) => (
                      <button key={obj} onClick={() => setObjectDescription(obj)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${objectDescription === obj ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        {obj}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Fill Method</Label>
                  <div className="space-y-2">
                    {FILL_METHODS.map((m) => (
                      <button key={m.value} onClick={() => setFillMethod(m.value)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${fillMethod === m.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <span className="font-medium">{m.label}</span>
                        <span className="text-xs opacity-70">{m.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleProcess} disabled={!imageUrl || !objectDescription.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing...</> : <><Sparkles className="h-4 w-4 mr-2" />Erase Object</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
                      <Eraser className="h-8 w-8 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload an image and describe what to remove.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img loading="lazy" src={imagePreview} alt="Original" className="w-full h-auto max-h-[350px] object-contain" />}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-rose-500/20 text-rose-400 border-rose-500/30">{resultUrl ? "Object Removed" : "Result"}</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
                                <p className="text-sm text-muted-foreground">Erasing object...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Result" className="w-full h-auto max-h-[350px] object-contain" />
                            ) : (
                              <motion.p key="empty" className="text-sm text-muted-foreground py-12">Result will appear here</motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />Download Result
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
