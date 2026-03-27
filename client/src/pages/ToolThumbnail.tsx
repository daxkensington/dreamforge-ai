import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Image,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "twitch", label: "Twitch" },
  { value: "podcast", label: "Podcast" },
  { value: "blog", label: "Blog" },
  { value: "course", label: "Course" },
  { value: "social", label: "Social Media" },
] as const;

const THUMB_STYLES = [
  { value: "bold", label: "Bold", desc: "Big text, high impact" },
  { value: "minimal", label: "Minimal", desc: "Clean & simple" },
  { value: "cinematic", label: "Cinematic", desc: "Movie poster feel" },
  { value: "neon", label: "Neon", desc: "Glowing & vibrant" },
  { value: "gradient", label: "Gradient", desc: "Smooth color blends" },
  { value: "collage", label: "Collage", desc: "Multi-image layout" },
] as const;

type Platform = typeof PLATFORMS[number]["value"];
type ThumbStyle = typeof THUMB_STYLES[number]["value"];

export default function ToolThumbnail() {
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [style, setStyle] = useState<ThumbStyle>("bold");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = trpc.tools.thumbnail.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Thumbnail created!");
      } else {
        toast.error(data.error || "Thumbnail generation failed");
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
    if (!title.trim()) { toast.error("Enter a title for your thumbnail"); return; }
    setResultUrl(null);
    mutation.mutate({
      title,
      platform: platform as any,
      style: style as any,
      imageUrl: imageUrl || undefined,
    });
  };

  const handleReset = () => {
    setTitle(""); setImageUrl(""); setImagePreview(null); setResultUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout
      title="Thumbnail Maker"
      description="Create eye-catching thumbnails for any platform"
      icon={Image}
      gradient="from-red-500 to-pink-400"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Title Text *</Label>
                  <Input
                    placeholder="Your thumbnail title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reference Image (Optional)</Label>
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
                </div>
              </CardContent>
            </Card>

            {/* Platform */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Platform</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPlatform(p.value)}
                      className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all ${
                        platform === p.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Style */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {THUMB_STYLES.map((s) => (
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

            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!title.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Create Thumbnail</>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-red-400" />
                          <p className="text-muted-foreground">Designing your thumbnail...</p>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
                            <Image className="h-8 w-8 text-red-400" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">Thumbnail Preview</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            Enter a title and configure your thumbnail settings to generate.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div>
                    <div className="p-6 flex items-center justify-center bg-muted/20">
                      <motion.img
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={resultUrl}
                        alt="Generated Thumbnail"
                        className="max-w-full max-h-[400px] object-contain rounded-lg"
                      />
                    </div>
                    {imagePreview && (
                      <div className="px-6 py-3 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Reference image used:</p>
                        <img loading="lazy" src={imagePreview} alt="Reference" className="h-16 rounded object-cover" />
                      </div>
                    )}
                    <div className="p-4 border-t border-border/50 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                        <Download className="h-4 w-4 mr-2" />Download Thumbnail
                      </Button>
                    </div>
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
