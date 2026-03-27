// @ts-nocheck
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Video, Music, Upload, Loader2, Play, Download, Camera,
  Sparkles, Image, Film, Share2, Smartphone,
} from "lucide-react";
import { Link } from "wouter";

const VIDEO_STYLES = [
  { value: "cinematic", label: "Cinematic", desc: "Hollywood-grade visuals", emoji: "🎬" },
  { value: "animated", label: "Animated", desc: "Stylized animation", emoji: "🎨" },
  { value: "psychedelic", label: "Psychedelic", desc: "Trippy visual effects", emoji: "🌈" },
  { value: "performance", label: "Performance", desc: "Stage/concert style", emoji: "🎤" },
  { value: "lyric-video", label: "Lyric Video", desc: "Animated lyrics on screen", emoji: "📝" },
  { value: "abstract", label: "Abstract", desc: "Abstract visual art", emoji: "🔮" },
  { value: "retro", label: "Retro", desc: "VHS/vintage aesthetic", emoji: "📼" },
];

export default function MusicVideoStudio() {
  const { user } = useAuth();

  // Get song info from URL params (if coming from Song Creator)
  const [songUrl, setSongUrl] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [resultVideoUrl, setResultVideoUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("song")) setSongUrl(params.get("song")!);
    if (params.get("title")) setSongTitle(params.get("title")!);
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const videoMutation = trpc.song.generateMusicVideo.useMutation({
    onSuccess: (data) => {
      if (data.videoUrl) {
        setResultVideoUrl(data.videoUrl);
        toast.success("Music video generated!");
      } else {
        toast.error("Video generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!songUrl || !concept.trim()) return;
    videoMutation.mutate({
      songUrl,
      photoUrl: photoDataUrl || undefined,
      concept,
      style: style as any,
      aspectRatio: aspectRatio as any,
    });
  };


  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-3">
                <Film className="h-3 w-3" />
                Music Video Studio
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Create{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Music Videos
                </span>
              </h1>
              <p className="text-muted-foreground max-w-md">
                Upload your photo, add your song, and AI creates a music video starring you. Export for TikTok, Reels, or YouTube.
              </p>
            </div>
            <div className="flex gap-2">
              {["/showcase/tool-music-video.jpg", "/showcase/tool-songcreator.jpg", "/showcase/tool-social-templates.jpg"].map((img, i) => (
                <div key={i} className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70">
                  <img src={img} alt="AI generated showcase" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Inputs */}
          <div className="space-y-6">
            {/* Song Selection */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Music className="h-5 w-5 text-cyan-400" />
                  Your Song
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {songUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                      <Music className="h-5 w-5 text-cyan-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{songTitle || "Uploaded Song"}</p>
                        <audio src={songUrl} controls className="w-full mt-2 h-8" />
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={() => { setSongUrl(""); setSongTitle(""); }}>
                      Change Song
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Paste song URL or upload..."
                      value={songUrl}
                      onChange={(e) => setSongUrl(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                    <div className="text-center text-xs text-muted-foreground">or</div>
                    <Link href="/tools/song-creator">
                      <Button variant="outline" className="w-full gap-2 bg-transparent">
                        <Sparkles className="h-4 w-4" /> Create a Song with AI First
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Photo Upload */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Camera className="h-5 w-5 text-cyan-400" />
                  Your Photo (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {photoDataUrl ? (
                  <div className="space-y-3">
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10">
                      <img loading="lazy" src={photoDataUrl} alt="Your photo" className="w-full h-full object-cover" />
                    </div>
                    <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setPhotoDataUrl("")}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 p-8 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/30 transition-colors">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload your photo to star in the video</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </CardContent>
            </Card>

            {/* Video Settings */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-5 w-5 text-cyan-400" />
                  Video Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Video Concept</label>
                  <Textarea
                    placeholder="Describe your music video... e.g. 'Walking through neon-lit city streets at night, rain reflections, cinematic mood'"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Visual Style</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VIDEO_STYLES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setStyle(s.value)}
                        className={`p-3 rounded-lg text-left transition-all ${
                          style === s.value
                            ? "bg-cyan-500/15 border border-cyan-500/30"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        <span className="text-lg">{s.emoji}</span>
                        <p className="text-xs font-medium mt-1">{s.label}</p>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Format</label>
                  <div className="flex gap-2">
                    {[
                      { value: "9:16", label: "TikTok / Reels", icon: Smartphone },
                      { value: "16:9", label: "YouTube", icon: Film },
                      { value: "1:1", label: "Instagram", icon: Image },
                    ].map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setAspectRatio(f.value)}
                        className={`flex-1 p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${
                          aspectRatio === f.value
                            ? "bg-cyan-500/15 border border-cyan-500/30"
                            : "bg-white/5 border border-white/10 hover:border-white/20"
                        }`}
                      >
                        <f.icon className="h-4 w-4" />
                        <span className="text-[10px] font-medium">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!songUrl || !concept.trim() || videoMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                >
                  {videoMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating Music Video...</>
                  ) : (
                    <><Film className="h-4 w-4" /> Generate Music Video</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right: Preview / Result */}
          <div>
            <Card className="bg-white/5 border-white/10 sticky top-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-5 w-5 text-cyan-400" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {resultVideoUrl ? (
                  <div className="space-y-4">
                    <div className={`rounded-xl overflow-hidden bg-black ${aspectRatio === "9:16" ? "aspect-[9/16] max-w-[300px] mx-auto" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video"}`}>
                      <video src={resultVideoUrl} controls className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 gap-2 bg-transparent" asChild>
                        <a href={resultVideoUrl} download="music-video.mp4">
                          <Download className="h-4 w-4" /> Download
                        </a>
                      </Button>
                      <Button variant="outline" className="gap-2 bg-transparent" onClick={() => toast.info("Share coming soon!")}>
                        <Share2 className="h-4 w-4" /> Share
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-cyan-500/15 text-cyan-400 border-0">{style}</Badge>
                      <Badge className="bg-purple-500/15 text-purple-400 border-0">{aspectRatio}</Badge>
                      {photoDataUrl && <Badge className="bg-blue-500/15 text-blue-400 border-0">Your Photo</Badge>}
                    </div>
                  </div>
                ) : videoMutation.isPending ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-12 w-12 animate-spin text-cyan-500 mb-4" />
                    <p className="text-sm font-medium">Creating your music video...</p>
                    <p className="text-xs text-muted-foreground mt-1">This may take 1-2 minutes</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                      <Film className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-sm text-muted-foreground">Your music video will appear here</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Add a song and describe your video concept</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
