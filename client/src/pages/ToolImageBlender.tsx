import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Blend,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
  Plus,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BLEND_MODES = [
  { value: "merge", label: "Seamless Merge", description: "Blend elements from both images naturally" },
  { value: "double-exposure", label: "Double Exposure", description: "Cinematic film overlay effect" },
  { value: "collage", label: "Art Collage", description: "Creative arrangement of both images" },
  { value: "morph", label: "Surreal Morph", description: "Dreamlike hybrid of both subjects" },
  { value: "dreamscape", label: "Dreamscape", description: "Fantastical otherworldly combination" },
] as const;

export default function ToolImageBlender() {
  const [imageUrl1, setImageUrl1] = useState("");
  const [imageUrl2, setImageUrl2] = useState("");
  const [preview1, setPreview1] = useState<string | null>(null);
  const [preview2, setPreview2] = useState<string | null>(null);
  const [blendMode, setBlendMode] = useState<"merge" | "double-exposure" | "collage" | "morph" | "dreamscape">("merge");
  const [blendStrength, setBlendStrength] = useState(0.5);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading1, setUploading1] = useState(false);
  const [uploading2, setUploading2] = useState(false);
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const blendMutation = trpc.tools.blendImages.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Images blended successfully!");
      } else {
        toast.error(data.error || "Blending failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleUpload = async (file: File, slot: 1 | 2) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    const setUploading = slot === 1 ? setUploading1 : setUploading2;
    const setPreview = slot === 1 ? setPreview1 : setPreview2;
    const setUrl = slot === 1 ? setImageUrl1 : setImageUrl2;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) { const { url } = await res.json(); setUrl(url); }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleProcess = () => {
    if (!imageUrl1 || !imageUrl2) { toast.error("Please provide both images"); return; }
    setResultUrl(null);
    blendMutation.mutate({ imageUrl1, imageUrl2, blendMode, blendStrength });
  };

  const handleReset = () => {
    setImageUrl1(""); setImageUrl2(""); setPreview1(null); setPreview2(null); setResultUrl(null);
    if (fileRef1.current) fileRef1.current.value = "";
    if (fileRef2.current) fileRef2.current.value = "";
  };

  const isProcessing = blendMutation.isPending;

  const ImageSlot = ({ slot, url, preview, uploading: isUploading, fileRef: ref }: {
    slot: 1 | 2; url: string; preview: string | null; uploading: boolean; fileRef: React.RefObject<HTMLInputElement | null>;
  }) => (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <Label className="text-sm font-medium">Image {slot}</Label>
        <Input placeholder="Paste image URL..." value={url} onChange={(e) => { (slot === 1 ? setImageUrl1 : setImageUrl2)(e.target.value); (slot === 1 ? setPreview1 : setPreview2)(e.target.value); }} className="text-sm" />
        <input ref={ref} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], slot)} className="hidden" />
        <Button variant="outline" size="sm" className="w-full" onClick={() => ref.current?.click()} disabled={isUploading}>
          {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {isUploading ? "Uploading..." : "Upload"}
        </Button>
        {preview && (
          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
            <img loading="lazy" src={preview} alt={`Image ${slot}`} className="w-full h-32 object-cover" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <ToolPageLayout
      title="Image Blender"
      description="Blend and mashup two images into one creative output"
      icon={Blend}
      gradient="from-fuchsia-500 to-violet-500"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <ImageSlot slot={1} url={imageUrl1} preview={preview1} uploading={uploading1} fileRef={fileRef1} />
              <div className="flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-fuchsia-400" />
                </div>
              </div>
              <ImageSlot slot={2} url={imageUrl2} preview={preview2} uploading={uploading2} fileRef={fileRef2} />
            </div>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Blend Mode</Label>
                  <div className="space-y-2">
                    {BLEND_MODES.map((m) => (
                      <button key={m.value} onClick={() => setBlendMode(m.value)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-sm transition-all ${blendMode === m.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <span className="font-medium">{m.label}</span>
                        <span className="text-xs opacity-70 max-w-[140px] text-right">{m.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Blend Strength: {Math.round(blendStrength * 100)}%</Label>
                  <input type="range" min="10" max="100" value={blendStrength * 100} onChange={(e) => setBlendStrength(Number(e.target.value) / 100)}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Subtle</span><span>Intense</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleProcess} disabled={!imageUrl1 || !imageUrl2 || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Blending...</> : <><Sparkles className="h-4 w-4 mr-2" />Blend Images</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center mb-4">
                      <Blend className="h-8 w-8 text-fuchsia-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Upload Two Images</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload two images and choose a blend mode to create a unique mashup.</p>
                  </div>
                ) : (
                  <div className="p-6">
                    <Badge className="mb-4 bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30">
                      {resultUrl ? `${BLEND_MODES.find(m => m.value === blendMode)?.label}` : "Blending..."}
                    </Badge>
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[400px] flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        {isProcessing ? (
                          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
                            <p className="text-sm text-muted-foreground">Blending images...</p>
                          </motion.div>
                        ) : resultUrl ? (
                          <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Blended result" className="w-full h-auto max-h-[450px] object-contain" />
                        ) : null}
                      </AnimatePresence>
                    </div>
                    {resultUrl && (
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />Download
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
