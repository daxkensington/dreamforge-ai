import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Home,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DESIGN_STYLES = [
  { value: "modern", label: "Modern", desc: "Clean & contemporary" },
  { value: "minimalist", label: "Minimalist", desc: "Less is more" },
  { value: "scandinavian", label: "Scandinavian", desc: "Light & cozy" },
  { value: "industrial", label: "Industrial", desc: "Raw & urban" },
  { value: "bohemian", label: "Bohemian", desc: "Eclectic & free" },
  { value: "mid-century", label: "Mid-Century", desc: "Retro elegance" },
  { value: "japanese", label: "Japanese", desc: "Zen & harmony" },
  { value: "art-deco", label: "Art Deco", desc: "Bold & glamorous" },
  { value: "farmhouse", label: "Farmhouse", desc: "Rustic & warm" },
  { value: "luxury", label: "Luxury", desc: "Opulent & premium" },
] as const;

const ROOM_TYPES = [
  { value: "living-room", label: "Living Room" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "office", label: "Office" },
  { value: "dining", label: "Dining Room" },
  { value: "outdoor", label: "Outdoor" },
  { value: "custom", label: "Custom" },
] as const;

type DesignStyle = typeof DESIGN_STYLES[number]["value"];
type RoomType = typeof ROOM_TYPES[number]["value"];

export default function ToolInteriorDesign() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [style, setStyle] = useState<DesignStyle>("modern");
  const [roomType, setRoomType] = useState<RoomType>("living-room");
  const [keepLayout, setKeepLayout] = useState(true);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.interiorDesign.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Room redesigned!");
      } else {
        toast.error(data.error || "Interior design failed");
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

  const handleGenerate = () => {
    if (!imageUrl) { toast.error("Please provide a room image"); return; }
    setResultUrl(null);
    mutation.mutate({ imageUrl, style: style as any, room: roomType as any, keepLayout });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = mutation.isPending;
  const activeStyle = DESIGN_STYLES.find((s) => s.value === style);

  return (
    <ToolPageLayout
      title="Interior Design"
      description="Redesign any room with AI-powered interior styling"
      icon={Home}
      gradient="from-emerald-500 to-teal-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/example-interior-1.jpg" alt="Interior design transformation" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Input */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Room Photo</Label>
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
              </CardContent>
            </Card>

            {/* Room Type */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Room Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROOM_TYPES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRoomType(r.value)}
                      className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        roomType === r.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Design Style */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Design Style</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {DESIGN_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 text-left text-sm transition-all ${
                        style === s.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <span className="font-medium text-xs">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Keep Layout Toggle */}
            <Card className="border-border/50">
              <CardContent className="p-6">
                <button
                  onClick={() => setKeepLayout(!keepLayout)}
                  className="flex items-center justify-between w-full"
                >
                  <div>
                    <Label className="text-sm font-medium cursor-pointer">Keep Layout</Label>
                    <p className="text-xs text-muted-foreground">Preserve the room's existing furniture layout</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${keepLayout ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${keepLayout ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </button>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redesigning...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Redesign Room</>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <Home className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Room Image</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Upload a photo of your room and choose a design style to see the AI transformation.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && (
                            <img loading="lazy" src={imagePreview} alt="Original room" className="w-full h-auto max-h-[350px] object-contain" />
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {resultUrl ? activeStyle?.label || "Redesigned" : "Result"}
                        </Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                                <p className="text-sm text-muted-foreground">Redesigning with {activeStyle?.label}...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Redesigned room" className="w-full h-auto max-h-[350px] object-contain" />
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
