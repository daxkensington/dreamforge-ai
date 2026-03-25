import { useState } from "react";
import { trpc } from "@/lib/trpc";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { exportStoryboardPdf } from "@/lib/pdfExport";
import { Loader2, Download, LayoutGrid, Clapperboard, Sparkles, Save } from "lucide-react";

const STYLES = [
  { id: "cinematic", label: "Cinematic" },
  { id: "anime", label: "Anime" },
  { id: "documentary", label: "Documentary" },
  { id: "music-video", label: "Music Video" },
  { id: "commercial", label: "Commercial" },
  { id: "abstract", label: "Abstract" },
] as const;

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;
const SCENE_COUNTS = [2, 3, 4, 5, 6, 8] as const;

export default function ToolStoryboard() {
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<string>("cinematic");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [sceneCount, setSceneCount] = useState<number>(4);
  const [generateImages, setGenerateImages] = useState(true);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");

  const storyboard = trpc.video.generateStoryboard.useMutation();
  const saveProject = trpc.videoProject.save.useMutation();

  const handleGenerate = () => {
    if (!concept.trim()) return;
    storyboard.mutate({
      concept: concept.trim(),
      sceneCount,
      aspectRatio: aspectRatio as any,
      style: style as any,
      generateImages,
    });
  };

  const handleSave = () => {
    if (!storyboard.data || storyboard.data.status !== "completed") return;
    saveProject.mutate({
      type: "storyboard",
      title: saveTitle || storyboard.data.title || "Untitled Storyboard",
      description: storyboard.data.synopsis || concept.slice(0, 200),
      data: storyboard.data,
    }, {
      onSuccess: () => {
        toast.success("Storyboard saved to My Projects");
        setSaveDialogOpen(false);
        setSaveTitle("");
      },
      onError: () => toast.error("Failed to save storyboard"),
    });
  };

  const handleExportPdf = () => {
    if (!storyboard.data || storyboard.data.status !== "completed") return;
    exportStoryboardPdf({
      title: storyboard.data.title,
      synopsis: storyboard.data.synopsis,
      totalDuration: storyboard.data.totalDuration,
      style,
      scenes: storyboard.data.scenes,
    });
    toast.success("PDF downloaded");
  };

  return (
    <ToolPageLayout
      title="AI Storyboard Generator"
      description="Turn your concept into a visual storyboard with AI-generated scene frames"
      icon={LayoutGrid}
      gradient="from-cyan-500 to-blue-600"
    >
      <div className="space-y-8">
        {/* Input Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <label className="text-sm font-medium text-foreground/80">Story Concept</label>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe your video concept... e.g., 'A lone astronaut discovers an ancient alien garden on Mars, with bioluminescent plants that respond to human touch'"
              rows={5}
              className="bg-background/50 border-border/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">{concept.length}/2000 characters</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Style</label>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                      style === s.id
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Aspect Ratio</label>
              <div className="flex gap-2">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                      aspectRatio === ar
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Scenes</label>
              <div className="flex gap-2">
                {SCENE_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSceneCount(n)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      sceneCount === n
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/30">
              <div>
                <p className="text-sm font-medium text-foreground/80">Generate Scene Images</p>
                <p className="text-xs text-muted-foreground">AI-generate a frame for each scene</p>
              </div>
              <Switch checked={generateImages} onCheckedChange={setGenerateImages} />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!concept.trim() || storyboard.isPending}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {storyboard.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Storyboard...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Storyboard</>
              )}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {storyboard.isPending && (
          <div className="flex flex-col items-center py-16">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-cyan-500" />
              <Clapperboard className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-300" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Creating your storyboard with {sceneCount} scenes...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">This may take a moment{generateImages ? " (generating images for each scene)" : ""}</p>
          </div>
        )}

        {/* Results */}
        {storyboard.data && storyboard.data.status === "completed" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-lg font-semibold">{storyboard.data.title || "Your Storyboard"}</h3>
                <p className="text-sm text-muted-foreground">{storyboard.data.synopsis || `${storyboard.data.scenes.length} scenes generated`}</p>
              </div>
              <div className="flex gap-2 items-center">
                <Button size="sm" variant="outline" onClick={() => { setSaveTitle(storyboard.data?.title || ""); setSaveDialogOpen(true); }}>
                  <Save className="w-3.5 h-3.5 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportPdf}>
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
                <Badge variant="outline" className="capitalize">{style}</Badge>
                {storyboard.data.totalDuration > 0 && (
                  <Badge variant="outline">{storyboard.data.totalDuration}s total</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storyboard.data.scenes.map((scene: any, i: number) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/40 bg-card/50 overflow-hidden group hover:border-cyan-500/30 transition-colors"
                >
                  {scene.imageUrl ? (
                    <div className="relative aspect-video bg-black/20">
                      <img src={scene.imageUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-black/60 text-white border-0 text-xs">Scene {i + 1}</Badge>
                      </div>
                      <a
                        href={scene.imageUrl}
                        download={`storyboard-scene-${i + 1}.png`}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Button size="icon" variant="ghost" className="h-7 w-7 bg-black/50 hover:bg-black/70">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted/20 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Scene {i + 1}</p>
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground/90 line-clamp-2">{scene.visualDescription}</p>
                    {scene.cameraAngle && (
                      <p className="text-xs text-cyan-400/70">📷 {scene.cameraAngle}</p>
                    )}
                    {scene.cameraMovement && (
                      <p className="text-xs text-muted-foreground">🎬 {scene.cameraMovement}</p>
                    )}
                    {scene.mood && (
                      <p className="text-xs text-muted-foreground/70">🎭 {scene.mood}</p>
                    )}
                    {scene.duration > 0 && (
                      <p className="text-xs text-muted-foreground/60">⏱ {scene.duration}s</p>
                    )}
                    {scene.transition && (
                      <p className="text-xs text-violet-400/60">→ {scene.transition}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {storyboard.data && storyboard.data.status === "failed" && (
          <div className="text-center py-12 text-red-400">
            <p className="text-sm">Failed to generate storyboard. Please try again.</p>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Storyboard</DialogTitle>
            <DialogDescription>Save this storyboard to your projects for later editing and export.</DialogDescription>
          </DialogHeader>
          <Input
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            placeholder="Project title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveProject.isPending}>
              {saveProject.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ToolPageLayout>
  );
}
