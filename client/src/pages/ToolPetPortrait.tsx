import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Cat, Loader2, Download, Sparkles, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SPECIES = ["dog", "cat", "bird", "rabbit", "horse", "reptile", "other"] as const;
const STYLES = [
  { value: "royal-renaissance", label: "Royal Renaissance" },
  { value: "fantasy-knight", label: "Fantasy Knight" },
  { value: "space-captain", label: "Space Captain" },
  { value: "victorian", label: "Victorian" },
  { value: "steampunk", label: "Steampunk" },
  { value: "oil-painting", label: "Oil Painting" },
  { value: "watercolor", label: "Watercolor" },
  { value: "pop-art", label: "Pop Art" },
] as const;

type Species = (typeof SPECIES)[number];
type Style = (typeof STYLES)[number]["value"];

export default function ToolPetPortrait() {
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [species, setSpecies] = useState<Species>("dog");
  const [style, setStyle] = useState<Style>("royal-renaissance");
  const [petName, setPetName] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.petPortrait.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Portrait ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setUploading(true);
    try {
      const reader = new FileReader(); reader.onload = () => setPreview(reader.result as string); reader.readAsDataURL(file);
      const formData = new FormData(); formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) { const { url } = await res.json(); setImageUrl(url); }
      else toast.info("Using local preview — paste an image URL for best results");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };
  const handleGenerate = () => { if (!imageUrl) { toast.error("Upload a pet photo"); return; } setResultUrl(null); mutation.mutate({ imageUrl, species, style, petName: petName || undefined }); };
  const handleReset = () => { setImageUrl(""); setPreview(null); setSpecies("dog"); setStyle("royal-renaissance"); setPetName(""); setResultUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Pet Portrait" description="Royal, fantasy, and artistic portraits of your pet" icon={Cat} gradient="from-purple-500 to-pink-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Pet Photo</Label>
              <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); }} />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}{uploading ? "Uploading..." : "Or Upload Image"}</Button>
              {preview && <div className="rounded-lg overflow-hidden border border-border/30"><img loading="lazy" src={preview} alt="preview" className="w-full h-auto max-h-40 object-cover" /></div>}
              <div className="space-y-2"><Label className="text-sm">Pet Name (optional)</Label><Input placeholder="Biscuit" value={petName} onChange={(e) => setPetName(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Species</Label>
              <div className="grid grid-cols-4 gap-2">
                {SPECIES.map((s) => (
                  <button key={s} onClick={() => setSpecies(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${species === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Portrait Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Painting...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Portrait</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4"><Cat className="h-8 w-8 text-purple-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Pet Portrait</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Royal robes, knight armor, space captains — turn your pet into a masterpiece.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-purple-400" /><p className="text-sm text-muted-foreground">Painting portrait...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={resultUrl} alt="Pet portrait" className="w-full h-auto max-h-[600px] object-contain" /></div>
                    <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
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
