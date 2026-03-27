import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Scissors,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
  ImageOff,
  Replace,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SCENE_PRESETS = [
  { label: "Studio White", prompt: "clean white professional studio backdrop with soft lighting" },
  { label: "Nature", prompt: "lush green forest with soft sunlight filtering through trees" },
  { label: "City Skyline", prompt: "modern city skyline at golden hour with dramatic clouds" },
  { label: "Beach Sunset", prompt: "tropical beach at sunset with warm orange and pink sky" },
  { label: "Abstract Gradient", prompt: "smooth abstract gradient background in purple and blue tones" },
  { label: "Office", prompt: "modern minimalist office interior with natural light" },
];

export default function ToolBackground() {
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mode, setMode] = useState<"remove" | "replace">("remove");
  const [replacementPrompt, setReplacementPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgMutation = trpc.tools.backgroundEdit.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success(data.mode === "remove" ? "Background removed!" : "Background replaced!");
      } else {
        toast.error(data.error || "Background editing failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setImageUrl(url);
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = () => {
    if (!imageUrl) {
      toast.error("Please provide an image URL or upload an image");
      return;
    }
    setResultUrl(null);
    bgMutation.mutate({
      imageUrl,
      mode,
      replacementPrompt: mode === "replace" ? replacementPrompt : undefined,
    });
  };

  const handleReset = () => {
    setImageUrl("");
    setImagePreview(null);
    setResultUrl(null);
    setReplacementPrompt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isProcessing = bgMutation.isPending;

  return (
    <ToolPageLayout
      title="Background Editor"
      description="Remove or replace backgrounds with AI"
      icon={Scissors}
      gradient="from-emerald-500 to-teal-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Input */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Source Image</Label>
                <Input
                  placeholder="Paste image URL..."
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setImagePreview(e.target.value);
                  }}
                  className="text-sm"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Uploading..." : "Or Upload Image"}
                </Button>
              </CardContent>
            </Card>

            {/* Mode Selection */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Tabs value={mode} onValueChange={(v) => { setMode(v as "remove" | "replace"); setResultUrl(null); }}>
                  <TabsList className="w-full">
                    <TabsTrigger value="remove" className="flex-1 gap-2">
                      <ImageOff className="h-4 w-4" />
                      Remove
                    </TabsTrigger>
                    <TabsTrigger value="replace" className="flex-1 gap-2">
                      <Replace className="h-4 w-4" />
                      Replace
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="remove" className="mt-4">
                    <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-sm text-muted-foreground">
                        AI will detect the main subject and remove the background, leaving a clean white/transparent result.
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="replace" className="mt-4 space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">New Background</Label>
                      <Textarea
                        placeholder="Describe the new background... (e.g., 'tropical beach at sunset')"
                        value={replacementPrompt}
                        onChange={(e) => setReplacementPrompt(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>

                    {/* Scene Presets */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Quick Presets</Label>
                      <div className="flex flex-wrap gap-2">
                        {SCENE_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => setReplacementPrompt(preset.prompt)}
                            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                              replacementPrompt === preset.prompt
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/50 hover:border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleProcess}
                disabled={!imageUrl || isProcessing || (mode === "replace" && !replacementPrompt)}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {mode === "remove" ? "Remove Background" : "Replace Background"}
                  </>
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
                      <Scissors className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No Image Selected</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Upload an image to remove or replace its background with AI.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-border/50">
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-3">Original</Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                          {imagePreview && (
                            <img loading="lazy" src={imagePreview} alt="Original" className="w-full h-auto max-h-[350px] object-contain" />
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        <Badge className="mb-3 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {resultUrl ? (mode === "remove" ? "Background Removed" : "Background Replaced") : "Result"}
                        </Badge>
                        <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 min-h-[200px] flex items-center justify-center">
                          <AnimatePresence mode="wait">
                            {isProcessing ? (
                              <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center gap-3 py-12"
                              >
                                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                                <p className="text-sm text-muted-foreground">
                                  {mode === "remove" ? "Removing background..." : "Replacing background..."}
                                </p>
                              </motion.div>
                            ) : resultUrl ? (
                              <motion.div
                                key="result"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={mode === "remove" ? "bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%23333%22%2F%3E%3Crect%20x%3D%2210%22%20y%3D%2210%22%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%23333%22%2F%3E%3Crect%20x%3D%2210%22%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%23444%22%2F%3E%3Crect%20y%3D%2210%22%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%23444%22%2F%3E%3C%2Fsvg%3E')]" : ""}
                              >
                                <img loading="lazy" src={resultUrl} alt="Result" className="w-full h-auto max-h-[350px] object-contain" />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="waiting"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-2 py-12"
                              >
                                <Scissors className="h-6 w-6 text-muted-foreground/50" />
                                <p className="text-sm text-muted-foreground">Click to process the image</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {resultUrl && (
                      <div className="p-4 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Result
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
