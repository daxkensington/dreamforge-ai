import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  SunMedium,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLOR_GRADES = [
  { value: "cinematic-teal-orange", label: "Teal & Orange", description: "Hollywood blockbuster look", preview: "from-teal-500 to-orange-400" },
  { value: "vintage-film", label: "Vintage Film", description: "Nostalgic analog warmth", preview: "from-amber-600 to-yellow-300" },
  { value: "noir", label: "Film Noir", description: "High contrast B&W drama", preview: "from-gray-800 to-gray-400" },
  { value: "cyberpunk", label: "Cyberpunk", description: "Neon-drenched futurism", preview: "from-purple-600 to-cyan-400" },
  { value: "golden-hour", label: "Golden Hour", description: "Warm sunset glow", preview: "from-orange-400 to-yellow-200" },
  { value: "moonlight", label: "Moonlight", description: "Cool blue night tones", preview: "from-blue-700 to-indigo-400" },
  { value: "pastel-dream", label: "Pastel Dream", description: "Soft muted pastels", preview: "from-pink-300 to-sky-300" },
  { value: "desaturated", label: "Desaturated", description: "Muted editorial look", preview: "from-gray-400 to-slate-500" },
  { value: "cross-process", label: "Cross Process", description: "Experimental color shifts", preview: "from-green-400 to-pink-500" },
  { value: "bleach-bypass", label: "Bleach Bypass", description: "Washed out high-contrast", preview: "from-stone-400 to-zinc-600" },
] as const;

const INTENSITIES = [
  { value: "subtle", label: "Subtle", description: "Light touch" },
  { value: "medium", label: "Medium", description: "Balanced" },
  { value: "strong", label: "Strong", description: "Dramatic" },
] as const;

export default function ToolColorGrading() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [gradeStyle, setGradeStyle] = useState<string>("cinematic-teal-orange");
  const [intensity, setIntensity] = useState<"subtle" | "medium" | "strong">("medium");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const gradeMutation = trpc.tools.colorGrade.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Color grade applied!");
      } else {
        toast.error(data.error || "Color grading failed");
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

  const handleProcess = () => {
    if (!imageUrl) { toast.error("Please provide an image"); return; }
    setResultUrl(null);
    const intensityMap = { subtle: 0.3, medium: 0.6, strong: 0.9 } as const;
    gradeMutation.mutate({ imageUrl, grade: gradeStyle as any, intensity: intensityMap[intensity] });
  };

  const handleReset = () => {
    setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = gradeMutation.isPending;

  return (
    <ToolPageLayout
      title="AI Color Grading"
      description="Apply cinematic color grades and film looks to your images"
      icon={SunMedium}
      gradient="from-orange-500 to-amber-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Source Image</Label>
                <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {uploading ? "Uploading..." : "Or Upload Image"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Color Grade</Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {COLOR_GRADES.map((g) => (
                      <button key={g.value} onClick={() => setGradeStyle(g.value)}
                        className={`flex flex-col items-start p-3 rounded-lg border text-sm transition-all ${gradeStyle === g.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <div className={`h-2 w-full rounded-full bg-gradient-to-r ${g.preview} mb-2`} />
                        <span className="font-medium text-xs">{g.label}</span>
                        <span className="text-[10px] opacity-70">{g.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-3 block">Intensity</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {INTENSITIES.map((i) => (
                      <button key={i.value} onClick={() => setIntensity(i.value)}
                        className={`flex flex-col items-center p-3 rounded-lg border text-sm transition-all ${intensity === i.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"}`}>
                        <span className="font-medium text-xs">{i.label}</span>
                        <span className="text-[10px] opacity-70">{i.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleProcess} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Grading...</> : <><Sparkles className="h-4 w-4 mr-2" />Apply Grade</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!imagePreview && !resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
                      <SunMedium className="h-8 w-8 text-orange-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Upload an image and choose a cinematic color grade to transform its mood.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && <img src={imagePreview} alt="Original" className="w-full h-auto max-h-[350px] object-contain" />}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-orange-500/20 text-orange-400 border-orange-500/30">
                          {resultUrl ? COLOR_GRADES.find(g => g.value === gradeStyle)?.label || "Graded" : "Result"}
                        </Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                                <p className="text-sm text-muted-foreground">Applying color grade...</p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.img key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Graded" className="w-full h-auto max-h-[350px] object-contain" />
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
