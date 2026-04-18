import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Palette, Loader2, Download, Sparkles, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ERAS = [
  { value: "auto", label: "Auto Detect" },
  { value: "victorian", label: "Victorian" },
  { value: "1920s", label: "1920s" },
  { value: "1940s", label: "1940s" },
  { value: "1960s", label: "1960s" },
  { value: "1980s", label: "1980s" },
  { value: "modern", label: "Modern" },
] as const;
const INTENSITIES = [
  { value: "subtle", label: "Subtle" },
  { value: "natural", label: "Natural" },
  { value: "vivid", label: "Vivid" },
] as const;

type Era = (typeof ERAS)[number]["value"];
type Intensity = (typeof INTENSITIES)[number]["value"];

export default function ToolPhotoColorize() {
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [era, setEra] = useState<Era>("auto");
  const [intensity, setIntensity] = useState<Intensity>("natural");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.photoColorize.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Colorized!"); }
      else toast.error(data.error || "Colorization failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) { const { url } = await res.json(); setImageUrl(url); }
      else toast.info("Using local preview — paste an image URL for best results");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleGenerate = () => {
    if (!imageUrl) { toast.error("Provide a B&W photo"); return; }
    setResultUrl(null);
    mutation.mutate({ imageUrl, era, intensity });
  };
  const handleReset = () => { setImageUrl(""); setPreview(null); setEra("auto"); setIntensity("natural"); setResultUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Old Photo Colorizer" description="Era-aware B&W photo colorization" icon={Palette} gradient="from-rose-500 to-pink-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">B&W Photo</Label>
              <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); }} />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading..." : "Or Upload Image"}
              </Button>
              {preview && <div className="rounded-lg overflow-hidden border border-border/30"><img loading="lazy" src={preview} alt="preview" className="w-full h-auto max-h-40 object-cover" /></div>}
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Era</Label>
              <div className="grid grid-cols-2 gap-2">
                {ERAS.map((e) => (
                  <button key={e.value} onClick={() => setEra(e.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${era === e.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{e.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Color Intensity</Label>
              <div className="grid grid-cols-3 gap-2">
                {INTENSITIES.map((i) => (
                  <button key={i.value} onClick={() => setIntensity(i.value)} className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${intensity === i.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{i.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Colorizing...</> : <><Sparkles className="h-4 w-4 mr-2" />Colorize</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4"><Palette className="h-8 w-8 text-rose-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Old Photo Colorizer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Bring family archives to life with era-accurate colors.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /><p className="text-sm text-muted-foreground">Adding color...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                      <img loading="lazy" src={resultUrl} alt="Colorized" className="w-full h-auto max-h-[500px] object-contain" />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
