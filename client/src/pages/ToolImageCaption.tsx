import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Upload, Loader2, Copy, Sparkles, RotateCcw } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const captionTypes = [
  { value: "description", label: "Description", desc: "Detailed image description" },
  { value: "alt-text", label: "Alt Text", desc: "Accessibility-ready" },
  { value: "social-caption", label: "Social Caption", desc: "Shareable & engaging" },
  { value: "seo", label: "SEO", desc: "Search-optimized" },
  { value: "creative", label: "Creative", desc: "Story-driven caption" },
];

const platforms = [
  { value: "general", label: "General" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
];

const tones = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "funny", label: "Funny" },
  { value: "poetic", label: "Poetic" },
  { value: "informative", label: "Informative" },
];

export default function ToolImageCaption() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [type, setType] = useState("description");
  const [platform, setPlatform] = useState("general");
  const [tone, setTone] = useState("professional");
  const [caption, setCaption] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.imageCaption.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.caption) { setCaption(data.caption); toast.success("Caption generated!"); }
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
    <ToolPageLayout title="Image Caption Generator" description="Generate descriptions, alt text, and social captions" icon={FileText} gradient="from-teal-500 to-cyan-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Source Image</Label>
                  <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Upload Image"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Caption Type</Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {captionTypes.map((ct) => (
                      <button key={ct.value} onClick={() => setType(ct.value)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${type === ct.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <div>
                          <span className="text-xs font-medium">{ct.label}</span>
                          <p className="text-[10px] text-muted-foreground">{ct.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {type === "social-caption" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{platforms.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{tones.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setCaption(null); mutation.mutate({ imageUrl, type: type as any, platform: platform as any, tone: tone as any }); }} disabled={!imageUrl || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Caption</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setCaption(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {imagePreview && (
              <Card className="border-border/50 overflow-hidden">
                <CardContent className="p-4">
                  <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[300px] object-contain rounded-lg" />
                </CardContent>
              </Card>
            )}

            <Card className="border-border/50">
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-teal-400" /><p className="text-sm text-muted-foreground">Analyzing image...</p>
                    </motion.div>
                  ) : caption ? (
                    <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">{captionTypes.find((ct) => ct.value === type)?.label}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(caption); toast.success("Copied!"); }}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{caption}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-2"><FileText className="h-6 w-6 text-teal-400" /></div>
                      <h3 className="text-sm font-medium">Caption will appear here</h3>
                      <p className="text-xs text-muted-foreground max-w-xs">Upload an image and choose a caption type to get started.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
