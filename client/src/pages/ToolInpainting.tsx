import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  PenTool,
  Upload,
  Loader2,
  Download,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ToolInpainting() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [regionDescription, setRegionDescription] = useState("");
  const [preserveStyle, setPreserveStyle] = useState(true);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inpaintMutation = trpc.tools.inpaint.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Image edited successfully!");
      } else {
        toast.error(data.error || "Editing failed");
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

  const handleEdit = () => {
    if (!imageUrl) { toast.error("Please provide an image URL"); return; }
    if (!editPrompt.trim()) { toast.error("Please describe what to edit"); return; }
    setResultUrl(null);
    inpaintMutation.mutate({ imageUrl, editPrompt, regionDescription: regionDescription || undefined, preserveStyle });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    setEditPrompt(""); setRegionDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = inpaintMutation.isPending;

  const editSuggestions = [
    "Add a sunset sky in the background",
    "Replace the hat with a crown",
    "Add snow on the ground",
    "Change the wall color to blue",
    "Add flowers to the garden",
    "Put sunglasses on the character",
  ];

  return (
    <ToolPageLayout
      title="Inpainting Editor"
      description="Edit specific parts of your image with natural language instructions"
      icon={PenTool}
      gradient="from-teal-500 to-cyan-400"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Source Image</Label>
                  <Input
                    placeholder="Paste image URL..."
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }}
                    className="text-sm"
                  />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Or Upload Image"}
                  </Button>
                </div>

                {/* Edit Prompt */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">What to Edit</Label>
                  <Textarea
                    placeholder="Describe the change you want to make..."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {editSuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => setEditPrompt(s)}
                        className="text-[10px] px-2 py-1 rounded-full border border-border/50 text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Region Description */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Region Focus <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    placeholder="e.g., the sky area, the left side, the person's hair..."
                    value={regionDescription}
                    onChange={(e) => setRegionDescription(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Preserve Style */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Preserve Style</Label>
                    <p className="text-xs text-muted-foreground">Keep original art style and lighting</p>
                  </div>
                  <Switch checked={preserveStyle} onCheckedChange={setPreserveStyle} />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleEdit} disabled={!imageUrl || !editPrompt.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Editing...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />Apply Edit</>
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
                    <div className="h-16 w-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4">
                      <PenTool className="h-8 w-8 text-teal-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload an image and describe what you want to change. AI will edit it while preserving the rest.</p>
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
                          <Badge className="mb-3 bg-teal-500/20 text-teal-400 border-teal-500/30">Edited</Badge>
                          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                            <AnimatePresence mode="wait">
                              {isProcessing ? (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                  <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                                  <p className="text-sm text-muted-foreground">AI is editing your image...</p>
                                </motion.div>
                              ) : resultUrl ? (
                                <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                  <img src={resultUrl} alt="Edited" className="w-full h-auto max-h-[300px] object-contain" />
                                </motion.div>
                              ) : (
                                <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12">
                                  <ArrowRight className="h-6 w-6 text-muted-foreground/50" />
                                  <p className="text-sm text-muted-foreground">Describe your edit and click "Apply Edit"</p>
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
                          <Download className="h-4 w-4 mr-2" /> Download Edited Image
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
