import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Smile,
  Upload,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const enhancementLevels = [
  { id: "light" as const, label: "Light", description: "Subtle sharpening and minor improvements", icon: "✨" },
  { id: "moderate" as const, label: "Moderate", description: "Balanced enhancement with skin and eye detail", icon: "🔮" },
  { id: "heavy" as const, label: "Heavy", description: "Intensive restoration and retouching", icon: "💎" },
];

export default function ToolFaceEnhancer() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [enhancementLevel, setEnhancementLevel] = useState<"light" | "moderate" | "heavy">("moderate");
  const [preserveIdentity, setPreserveIdentity] = useState(true);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enhanceMutation = trpc.tools.enhanceFace.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Face enhanced successfully!");
      } else {
        toast.error(data.error || "Enhancement failed");
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

  const handleEnhance = () => {
    if (!imageUrl) { toast.error("Please provide an image URL"); return; }
    setResultUrl(null);
    enhanceMutation.mutate({ imageUrl, enhancementLevel, preserveIdentity });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = enhanceMutation.isPending;

  return (
    <ToolPageLayout
      title="Face Enhancer"
      description="Enhance and restore portrait quality with AI-powered retouching"
      icon={Smile}
      gradient="from-rose-500 to-pink-400"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Portrait Image</Label>
                  <Input
                    placeholder="Paste image URL..."
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }}
                    className="text-sm"
                  />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Or Upload Portrait"}
                  </Button>
                </div>

                {/* Enhancement Level */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Enhancement Level</Label>
                  <div className="space-y-2">
                    {enhancementLevels.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => setEnhancementLevel(level.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          enhancementLevel === level.id
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <span className="text-xl">{level.icon}</span>
                        <div>
                          <p className="text-sm font-semibold">{level.label}</p>
                          <p className="text-[10px] text-muted-foreground">{level.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preserve Identity */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Preserve Identity</Label>
                    <p className="text-xs text-muted-foreground">Keep facial features unchanged</p>
                  </div>
                  <Switch checked={preserveIdentity} onCheckedChange={setPreserveIdentity} />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleEnhance} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enhancing...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Enhance Face</>
                    )}
                  </Button>
                  <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4">
                      <Smile className="h-8 w-8 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Portrait Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload a portrait image to enhance facial details, fix artifacts, and improve quality.</p>
                  </div>
                ) : (
                  <div>
                    {imagePreview && (
                      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                        <div className="p-4">
                          <Badge variant="secondary" className="mb-3">Original</Badge>
                          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                            <img src={imagePreview} alt="Original" className="w-full h-auto max-h-[300px] object-contain" />
                          </div>
                        </div>
                        <div className="p-4">
                          <Badge className="mb-3 bg-rose-500/20 text-rose-400 border-rose-500/30">Enhanced</Badge>
                          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                            <AnimatePresence mode="wait">
                              {isProcessing ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                  <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
                                  <p className="text-sm text-muted-foreground">AI is enhancing the portrait...</p>
                                </motion.div>
                              ) : resultUrl ? (
                                <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                  <img src={resultUrl} alt="Enhanced" className="w-full h-auto max-h-[300px] object-contain" />
                                </motion.div>
                              ) : (
                                <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12">
                                  <ArrowRight className="h-6 w-6 text-muted-foreground/50" />
                                  <p className="text-sm text-muted-foreground">Click "Enhance Face" to improve</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" /> Download Enhanced Portrait
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
