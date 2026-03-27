import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Video, Loader2, Download, Sparkles, RotateCcw, Camera } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const cameraPresets = [
  { value: "static", label: "Static" },
  { value: "pan-left", label: "Pan Left" },
  { value: "pan-right", label: "Pan Right" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "orbit", label: "Orbit" },
  { value: "dolly-forward", label: "Dolly Forward" },
  { value: "crane-up", label: "Crane Up" },
];

const videoStyles = [
  { value: "cinematic", label: "Cinematic", desc: "Film-quality visuals" },
  { value: "anime", label: "Anime", desc: "Japanese animation" },
  { value: "documentary", label: "Documentary", desc: "Realistic footage" },
  { value: "slow-motion", label: "Slow Motion", desc: "120fps dramatic" },
  { value: "timelapse", label: "Timelapse", desc: "Time compression" },
  { value: "drone", label: "Drone Shot", desc: "Aerial flyover" },
  { value: "handheld", label: "Handheld", desc: "Raw authentic" },
  { value: "commercial", label: "Commercial", desc: "Ad-grade polish" },
];

export default function ToolTextToVideo() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("8");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [style, setStyle] = useState("cinematic");
  const [cameraMovement, setCameraMovement] = useState("static");
  const [resolution, setResolution] = useState("1080p");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const mutation = trpc.video.textToVideo.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.videoUrl) { setVideoUrl(data.videoUrl); toast.success("Video generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  useEffect(() => {
    if (!isProcessing) { setProgress(0); return; }
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 95 ? 95 : prev + (95 / 120)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  return (
    <ToolPageLayout title="Text-to-Video" description="Generate video clips from text with Google Veo 2" icon={Video} gradient="from-cyan-500 to-blue-500">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Describe Your Video</Label>
                  <Textarea placeholder="A drone flying through a neon-lit cyberpunk city at night, reflections on wet streets..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-sm" rows={5} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {videoStyles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`p-2.5 rounded-xl border-2 transition-all text-left ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{s.label}</span>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" />Camera Movement</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {cameraPresets.map((c) => (
                      <button key={c.value} onClick={() => setCameraMovement(c.value)}
                        className={`px-2 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${cameraMovement === c.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground"}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Aspect Ratio</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 Landscape</SelectItem>
                        <SelectItem value="9:16">9:16 Portrait</SelectItem>
                        <SelectItem value="1:1">1:1 Square</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Resolution</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p (Fast)</SelectItem>
                      <SelectItem value="1080p">1080p (Standard)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <p className="text-xs text-cyan-300">Powered by Google Veo 2 — generation takes 1-3 minutes</p>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setVideoUrl(null); const fullPrompt = cameraMovement !== "static" ? `Camera: ${cameraMovement} movement. ${prompt}` : prompt; mutation.mutate({ prompt: fullPrompt, duration: duration as any, aspectRatio: aspectRatio as any, style: style as any }); }}
                    disabled={!prompt.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating... {Math.round(progress)}%</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Video</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setPrompt(""); setVideoUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!videoUrl && !isProcessing ? (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4"><Video className="h-8 w-8 text-cyan-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Video Preview</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe your scene and generate an AI video clip.</p>
                    </motion.div>
                  ) : isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] gap-4">
                      <div className="relative">
                        <Loader2 className="h-16 w-16 animate-spin text-cyan-400" />
                        <Video className="h-6 w-6 text-cyan-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div className="text-center w-full px-12">
                        <p className="text-foreground font-medium">Generating video with Veo 2... {Math.round(progress)}%</p>
                        <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-1000 ease-linear" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">This typically takes 1-3 minutes</p>
                      </div>
                    </motion.div>
                  ) : videoUrl ? (
                    <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <video controls autoPlay loop className="w-full" src={videoUrl} />
                      <div className="p-4 border-t border-border/50 flex items-center justify-between">
                        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">{duration}s · {style} · {resolution}</Badge>
                        <Button variant="outline" size="sm" onClick={() => { const a = document.createElement("a"); a.href = videoUrl; a.download = "dreamforge-video.mp4"; a.click(); }}>
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
