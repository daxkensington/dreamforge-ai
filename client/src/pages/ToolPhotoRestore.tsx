import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ImagePlus,
  Upload,
  Loader2,
  Download,
  ArrowRight,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const restoreTypes = [
  { value: "full" as const, label: "Full Restore", desc: "Complete restoration" },
  { value: "old-photo" as const, label: "Old Photo", desc: "Fix aging artifacts" },
  { value: "damaged" as const, label: "Damaged", desc: "Repair tears & scratches" },
  { value: "faded" as const, label: "Faded", desc: "Restore vibrancy" },
  { value: "colorize" as const, label: "Colorize", desc: "Add color to B&W" },
];

export default function ToolPhotoRestore() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [restoreType, setRestoreType] = useState<"old-photo" | "damaged" | "faded" | "colorize" | "full">("full");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.photoRestore.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Photo restored successfully!");
      } else {
        toast.error(data.error || "Restoration failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setImageUrl(url);
      } else {
        toast.info("Using local preview — enter an image URL for best results");
      }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleRestore = () => {
    if (!imageUrl) { toast.error("Please provide an image"); return; }
    setResultUrl(null);
    mutation.mutate({ imageUrl, restoreType });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="AI Photo Restorer" description="Restore old, damaged, and faded photos with AI" icon={ImagePlus} gradient="from-amber-500 to-orange-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Source Image</Label>
                  <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Or Upload Image"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Restoration Type</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {restoreTypes.map((rt) => (
                      <button key={rt.value} onClick={() => setRestoreType(rt.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${restoreType === rt.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <div>
                          <span className="text-sm font-medium">{rt.label}</span>
                          <p className="text-xs text-muted-foreground">{rt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleRestore} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restoring...</> : <><Sparkles className="h-4 w-4 mr-2" />Restore Photo</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"><ImagePlus className="h-8 w-8 text-amber-400" /></div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload an old or damaged photo to restore it with AI.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img src={imagePreview} alt="Original" className="w-full h-auto max-h-[300px] object-contain" />}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-amber-500/20 text-amber-400 border-amber-500/30">{resultUrl ? "Restored" : "Result"}</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-amber-400" /><p className="text-sm text-muted-foreground">AI is restoring your photo...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                <img src={resultUrl} alt="Restored" className="w-full h-auto max-h-[300px] object-contain" />
                              </motion.div>
                            ) : (
                              <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12">
                                <ArrowRight className="h-6 w-6 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">Click "Restore Photo" to begin</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download Restored Photo</Button>
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
