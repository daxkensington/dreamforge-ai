import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CircleUser, Upload, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const avatarStyles = [
  { value: "3d-render", label: "3D Render", desc: "Pixar-style 3D" },
  { value: "anime", label: "Anime", desc: "Japanese animation" },
  { value: "pixel-art", label: "Pixel Art", desc: "Retro game style" },
  { value: "cartoon", label: "Cartoon", desc: "Bold & fun" },
  { value: "realistic", label: "Realistic", desc: "Photo-realistic" },
  { value: "comic", label: "Comic Book", desc: "Dynamic shading" },
  { value: "chibi", label: "Chibi", desc: "Cute & kawaii" },
  { value: "cyberpunk", label: "Cyberpunk", desc: "Neon futuristic" },
  { value: "fantasy", label: "Fantasy", desc: "Magical RPG" },
  { value: "watercolor", label: "Watercolor", desc: "Painterly art" },
];

export default function ToolAvatar() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("3d-render");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.avatar.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Avatar generated!"); }
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
    <ToolPageLayout title="AI Avatar Generator" description="Create custom avatars in any style" icon={CircleUser} gradient="from-fuchsia-500 to-pink-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Upload Photo (optional)</Label>
                  <Input placeholder="Paste image URL..." value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePreview(e.target.value); }} className="text-sm" />
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Or Describe Your Avatar</Label>
                  <Textarea placeholder="A friendly robot with glowing blue eyes..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" rows={2} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {avatarStyles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`p-2.5 rounded-xl border-2 transition-all text-left ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{s.label}</span>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => {
                    if (!imageUrl && !description.trim()) { toast.error("Upload a photo or describe your avatar"); return; }
                    setResultUrl(null);
                    mutation.mutate({ imageUrl: imageUrl || undefined, description: description || undefined, style: style as any, shape: "circle" });
                  }} disabled={(!imageUrl && !description.trim()) || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Avatar</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setImageUrl(""); setImagePreview(null); setDescription(""); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!resultUrl && !isProcessing ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-20 w-20 rounded-full bg-fuchsia-500/10 flex items-center justify-center mb-4"><CircleUser className="h-10 w-10 text-fuchsia-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Your Avatar Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Upload a photo or describe your avatar to get started.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-fuchsia-400" /><p className="text-muted-foreground">Creating your avatar...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="p-8 flex items-center justify-center">
                        <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-fuchsia-500/30 shadow-2xl shadow-fuchsia-500/20">
                          <img src={resultUrl} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="p-4 border-t border-border/50 flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
