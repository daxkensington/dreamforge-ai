import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShoppingBag, Loader2, Download, Sparkles, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { motion } from "framer-motion";

const STYLES = [
  { value: "lifestyle", label: "Lifestyle" },
  { value: "studio", label: "Studio" },
  { value: "flatlay", label: "Flatlay" },
  { value: "outdoor", label: "Outdoor" },
  { value: "home-decor", label: "Home Decor" },
] as const;

type Style = (typeof STYLES)[number]["value"];

export default function ToolListingPhotos() {
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [style, setStyle] = useState<Style>("lifestyle");
  const [results, setResults] = useState<{ angle: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.listingPhotos.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") { setResults(data.results); toast.success("Listing pack ready!"); }
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
    if (!imageUrl || !productName.trim()) { toast.error("Product image + name required"); return; }
    setResults([]);
    mutation.mutate({ imageUrl, productName, style });
  };
  const handleReset = () => { setImageUrl(""); setPreview(null); setProductName(""); setStyle("lifestyle"); setResults([]); if (fileInputRef.current) fileInputRef.current.value = ""; };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Listing Photo Pack" description="5 pro-grade angles from one product photo — Etsy / Shopify ready" icon={ShoppingBag} gradient="from-orange-500 to-amber-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Product Image</Label>
              <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setPreview(e.target.value); }} />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading..." : "Or Upload Image"}
              </Button>
              {preview && <div className="rounded-lg overflow-hidden border border-border/30"><img loading="lazy" src={preview} alt="preview" className="w-full h-auto max-h-40 object-cover" /></div>}
              <div className="space-y-2"><Label className="text-sm">Product Name</Label><Input placeholder="Handmade ceramic mug" value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Lifestyle Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s.value} onClick={() => setStyle(s.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.label}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!imageUrl || !productName.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Shooting pack...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Pack</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results.length && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4"><ShoppingBag className="h-8 w-8 text-orange-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Listing Photo Pack</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Upload one product shot — get 5 pro angles: hero, detail, in-use, scale, flatlay.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /><p className="text-sm text-muted-foreground">Shooting angles...</p></div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {results.map((r, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-square">
                        <img loading="lazy" src={r.url} alt={r.angle} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{r.angle}</span>
                        <Button variant="ghost" size="sm" onClick={() => window.open(r.url, "_blank")}><Download className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
