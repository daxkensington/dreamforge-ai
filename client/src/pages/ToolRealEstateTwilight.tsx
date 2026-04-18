import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Home, Loader2, Download, Sparkles, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MODES = [
  { value: "golden-hour", label: "Golden Hour" },
  { value: "twilight", label: "Twilight" },
  { value: "blue-hour", label: "Blue Hour" },
  { value: "dusk", label: "Dusk" },
] as const;

type Mode = (typeof MODES)[number]["value"];

export default function ToolRealEstateTwilight() {
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("twilight");
  const [addLights, setAddLights] = useState(true);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.realEstateTwilight.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Twilight shot ready!"); }
      else toast.error(data.error || "Generation failed");
    },
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

  const handleGenerate = () => {
    if (!imageUrl) { toast.error("Upload a daytime exterior"); return; }
    setResultUrl(null);
    mutation.mutate({ imageUrl, mode, addLights });
  };
  const handleReset = () => { setImageUrl(""); setPreview(null); setMode("twilight"); setAddLights(true); setResultUrl(null); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Real Estate Twilight" description="Daytime exteriors → golden-hour / twilight MLS shots" icon={Home} gradient="from-amber-600 to-yellow-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Daytime Exterior</Label>
              <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); }} />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading..." : "Or Upload Image"}
              </Button>
              {preview && <div className="rounded-lg overflow-hidden border border-border/30"><img loading="lazy" src={preview} alt="preview" className="w-full h-auto max-h-40 object-cover" /></div>}
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Lighting Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button key={m.value} onClick={() => setMode(m.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${mode === m.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{m.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1"><Label className="text-sm font-medium">Turn lights on</Label><p className="text-xs text-muted-foreground">Glowing windows + path lighting</p></div>
              <Switch checked={addLights} onCheckedChange={setAddLights} />
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Relighting...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Twilight</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"><Home className="h-8 w-8 text-amber-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Real Estate Twilight</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Turn any daytime listing photo into a magic-hour shot that gets clicks.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /><p className="text-sm text-muted-foreground">Relighting scene...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                      <img loading="lazy" src={resultUrl} alt="Twilight" className="w-full h-auto max-h-[500px] object-contain" />
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
