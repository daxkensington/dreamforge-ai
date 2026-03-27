import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShoppingBag, Upload, Loader2, Download, ArrowRight, Sparkles, RotateCcw } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const scenes = [
  { value: "studio-white", label: "Studio White" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "flat-lay", label: "Flat Lay" },
  { value: "outdoor", label: "Outdoor" },
  { value: "luxury", label: "Luxury" },
  { value: "minimal", label: "Minimal" },
  { value: "holiday", label: "Holiday" },
  { value: "tech", label: "Tech" },
  { value: "food", label: "Food" },
  { value: "fashion", label: "Fashion" },
];

const lightings = [
  { value: "studio", label: "Studio" },
  { value: "natural", label: "Natural" },
  { value: "dramatic", label: "Dramatic" },
  { value: "soft", label: "Soft" },
  { value: "backlit", label: "Backlit" },
];

export default function ToolProductPhoto() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scene, setScene] = useState("studio-white");
  const [lighting, setLighting] = useState("studio");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.productPhoto.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Product photo generated!"); }
      else toast.error(data.error || "Generation failed");
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
      else toast.info("Using local preview — enter an image URL for best results");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="AI Product Photos" description="Create professional e-commerce product photography" icon={ShoppingBag} gradient="from-blue-500 to-red-400">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/tool-product.jpg" alt="Product photography" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Product Image</Label>
                  <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Upload Product"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Scene</Label>
                  <Select value={scene} onValueChange={setScene}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{scenes.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Lighting</Label>
                  <Select value={lighting} onValueChange={setLighting}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{lightings.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResultUrl(null); mutation.mutate({ imageUrl, scene: scene as any, lighting: lighting as any }); }} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Photo</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setImageUrl(""); setImagePreview(null); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4"><ShoppingBag className="h-8 w-8 text-blue-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Upload Your Product</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Transform any product photo into professional e-commerce imagery.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img loading="lazy" src={imagePreview} alt="Original" className="w-full h-auto max-h-[300px] object-contain" />}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-blue-500/20 text-blue-400 border-cyan-500/30">{resultUrl ? "Product Shot" : "Result"}</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-400" /><p className="text-sm text-muted-foreground">Creating product shot...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                <img loading="lazy" src={resultUrl} alt="Product" className="w-full h-auto max-h-[300px] object-contain" />
                              </motion.div>
                            ) : (
                              <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12">
                                <ArrowRight className="h-6 w-6 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">Click "Generate Photo" to create</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
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
