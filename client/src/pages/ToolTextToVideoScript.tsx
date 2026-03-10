import { useState } from "react";
import { trpc } from "@/lib/trpc";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { exportScriptPdf } from "@/lib/pdfExport";
import { Loader2, FileText, Clapperboard, Sparkles, Clock, MapPin, Camera as CameraIcon, Volume2, StickyNote, Save, Download } from "lucide-react";

const FORMATS = [
  { id: "narrative", label: "Narrative", desc: "Story-driven film" },
  { id: "commercial", label: "Commercial", desc: "Product/brand ad" },
  { id: "tutorial", label: "Tutorial", desc: "How-to guide" },
  { id: "music-video", label: "Music Video", desc: "Visual music piece" },
  { id: "documentary", label: "Documentary", desc: "Factual exploration" },
  { id: "social-media", label: "Social Media", desc: "Short-form content" },
] as const;

const TONES = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "dramatic", label: "Dramatic" },
  { id: "humorous", label: "Humorous" },
  { id: "inspirational", label: "Inspirational" },
] as const;

export default function ToolTextToVideoScript() {
  const [concept, setConcept] = useState("");
  const [format, setFormat] = useState<string>("narrative");
  const [tone, setTone] = useState<string>("professional");
  const [duration, setDuration] = useState(60);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");

  const script = trpc.video.generateScript.useMutation();
  const saveProject = trpc.videoProject.save.useMutation();

  const handleGenerate = () => {
    if (!concept.trim()) return;
    script.mutate({
      concept: concept.trim(),
      duration,
      format: format as any,
      tone: tone as any,
    });
  };

  const handleSave = () => {
    if (!script.data || script.data.status !== "completed") return;
    saveProject.mutate({
      type: "script",
      title: saveTitle || script.data.title || "Untitled Script",
      description: script.data.logline || concept.slice(0, 200),
      data: script.data,
    }, {
      onSuccess: () => {
        toast.success("Script saved to My Projects");
        setSaveDialogOpen(false);
        setSaveTitle("");
      },
      onError: () => toast.error("Failed to save script"),
    });
  };

  const handleExportPdf = () => {
    if (!script.data || script.data.status !== "completed") return;
    exportScriptPdf({
      title: script.data.title,
      logline: script.data.logline,
      targetDuration: script.data.targetDuration,
      format: script.data.format,
      tone: script.data.tone,
      productionBudget: script.data.productionBudget,
      equipmentNeeded: script.data.equipmentNeeded,
      scenes: script.data.scenes,
    });
    toast.success("PDF downloaded");
  };

  return (
    <ToolPageLayout
      title="Text-to-Video Script"
      description="Convert your concept into a professional, production-ready video script"
      icon={FileText}
      gradient="from-indigo-500 to-violet-600"
    >
      <div className="space-y-8">
        {/* Input */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <label className="text-sm font-medium text-foreground/80">Video Concept</label>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe what your video should be about... e.g., 'A product launch video for a revolutionary AI-powered camera that can capture moments before they happen, showcasing its features in a sleek, futuristic setting'"
              rows={5}
              className="bg-background/50 border-border/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">{concept.length}/2000 characters</p>
          </div>

          <div className="space-y-4">
            {/* Format */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Format</label>
              <div className="space-y-1.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      format === f.id
                        ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-indigo-500/30"
                    }`}
                  >
                    <span className="font-medium">{f.label}</span>
                    <span className="text-xs ml-2 opacity-70">{f.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Tone</label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                      tone === t.id
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-indigo-500/30"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">
                Duration: {duration}s ({Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")})
              </label>
              <Slider
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                min={10}
                max={300}
                step={5}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground/60">
                <span>10s</span>
                <span>5:00</span>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!concept.trim() || script.isPending}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700"
            >
              {script.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Writing Script...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Script</>
              )}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {script.isPending && (
          <div className="flex flex-col items-center py-16">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
              <Clapperboard className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-300" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Writing your {format} script...</p>
          </div>
        )}

        {/* Results */}
        {script.data && script.data.status === "completed" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-xl font-bold mb-2">{script.data.title}</h3>
                  <p className="text-sm text-muted-foreground italic mb-4">{script.data.logline}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => { setSaveTitle(script.data?.title || ""); setSaveDialogOpen(true); }}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportPdf}>
                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{script.data.format}</Badge>
                <Badge variant="outline" className="capitalize">{script.data.tone}</Badge>
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {script.data.targetDuration}s
                </Badge>
              </div>
            </div>

            {/* Scenes */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground/80">Scene Breakdown</h4>
              {script.data.scenes.map((scene: any, i: number) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/40 bg-card/50 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30">
                        Scene {scene.sceneNumber}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {scene.startTime} — {scene.endTime}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="w-3 h-3 mr-1" />
                      {scene.location}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-2">
                    <CameraIcon className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground/90">{scene.visualDescription}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clapperboard className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{scene.cameraDirection}</p>
                  </div>

                  {scene.narration && (
                    <div className="flex items-start gap-2">
                      <Volume2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-300/80 italic">"{scene.narration}"</p>
                    </div>
                  )}

                  {scene.dialogue && (
                    <div className="pl-6 border-l-2 border-violet-500/30">
                      <p className="text-xs text-violet-300/80">{scene.dialogue}</p>
                    </div>
                  )}

                  {scene.soundDesign && (
                    <p className="text-xs text-muted-foreground/60">🔊 {scene.soundDesign}</p>
                  )}

                  {scene.productionNotes && (
                    <div className="flex items-start gap-2 bg-background/30 rounded-lg p-2">
                      <StickyNote className="w-3.5 h-3.5 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground/70">{scene.productionNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Production Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {script.data.productionBudget && (
                <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                  <h4 className="text-sm font-semibold mb-2">Budget Estimate</h4>
                  <p className="text-xs text-muted-foreground">{script.data.productionBudget}</p>
                </div>
              )}
              {script.data.equipmentNeeded && script.data.equipmentNeeded.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-card/50 p-4">
                  <h4 className="text-sm font-semibold mb-2">Equipment Needed</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {script.data.equipmentNeeded.map((eq: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs bg-background/50">{eq}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {script.data && script.data.status === "failed" && (
          <div className="text-center py-12 text-red-400">
            <p className="text-sm">Failed to generate script. Please try again.</p>
          </div>
        )}
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Script</DialogTitle>
            <DialogDescription>Save this script to your projects for later editing and export.</DialogDescription>
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
