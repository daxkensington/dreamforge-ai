import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Film, Upload, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const motionTypes = [
  { value: "subtle", label: "Subtle", desc: "Gentle parallax" },
  { value: "moderate", label: "Moderate", desc: "Natural motion" },
  { value: "dynamic", label: "Dynamic", desc: "Active movement" },
  { value: "cinematic-zoom", label: "Cine Zoom", desc: "Dramatic reveal" },
  { value: "pan-left", label: "Pan Left", desc: "Smooth left pan" },
  { value: "pan-right", label: "Pan Right", desc: "Smooth right pan" },
  { value: "zoom-in", label: "Zoom In", desc: "Focus closer" },
  { value: "zoom-out", label: "Zoom Out", desc: "Reveal scene" },
];

export default function ToolImageToVideo() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("8");
  const [motionType, setMotionType] = useState("moderate");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.video.imageToVideo.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.videoUrl) { setVideoUrl(data.videoUrl); toast.success("Video generated!"); }
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
    <ToolPageLayout title="Image-to-Video" description="Animate still images into video clips with Veo 2" icon={Film} gradient="from-purple-500 to-violet-500">
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
                  <Label className="text-sm font-medium">Motion Description</Label>
                  <Textarea placeholder="Describe the motion — waves crashing, leaves blowing, camera slowly zooming..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-sm" rows={3} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Motion Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {motionTypes.map((m) => (
                      <button key={m.value} onClick={() => setMotionType(m.value)}
                        className={`p-2 rounded-xl border-2 transition-all text-left ${motionType === m.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{m.label}</span>
                        <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 seconds</SelectItem>
                      <SelectItem value="8">8 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setVideoUrl(null); mutation.mutate({ imageUrl, prompt, duration: duration as any, motionType: motionType as any }); }}
                    disabled={!imageUrl || !prompt.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Animating (~2 min)...</> : <><Sparkles className="h-4 w-4 mr-2" />Animate Image</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setImageUrl(""); setImagePreview(null); setVideoUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!videoUrl && !isProcessing ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      {imagePreview ? (
                        <div className="p-4">
                          <Badge variant="secondary" className="mb-3">Source Image</Badge>
                          <img src={imagePreview} alt="Source" className="w-full h-auto max-h-[400px] object-contain rounded-lg" />
                          <p className="text-xs text-muted-foreground text-center mt-3">Describe the motion and click "Animate Image"</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                          <div className="h-16 w-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4"><Film className="h-8 w-8 text-purple-400" /></div>
                          <h3 className="text-lg font-medium mb-2">Bring Images to Life</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">Upload a still image and describe how it should move.</p>
                        </div>
                      )}
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <div className="relative">
                        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />
                        <Film className="h-6 w-6 text-purple-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-foreground font-medium">Animating with Veo 2...</p>
                      <p className="text-sm text-muted-foreground">This takes 1-3 minutes</p>
                    </motion.div>
                  ) : videoUrl ? (
                    <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <video controls autoPlay loop className="w-full" src={videoUrl} />
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => { const a = document.createElement("a"); a.href = videoUrl; a.download = "dreamforge-animated.mp4"; a.click(); }}>
                          <Download className="h-4 w-4 mr-2" />Download
                        </Button>
                      </div>
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
