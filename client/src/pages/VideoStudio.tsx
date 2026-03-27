import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { exportStoryboardPdf, exportScriptPdf } from "@/lib/pdfExport";
import {
  Film, Clapperboard, Palette, Maximize, Music, FileText,
  Play, Loader2, ArrowRight, Sparkles, Clock, Camera,
  ChevronRight, Video, Wand2, Layers, Save, FolderOpen,
  Download, Trash2, BookOpen, LayoutTemplate, Plus, Search,
  Rocket, GraduationCap, Mic, Smartphone, Clapperboard as Clap,
  Waves, Users
} from "lucide-react";

// ─── Storyboard Tab ───────────────────────────────────────────────
function StoryboardTab() {
  const [concept, setConcept] = useState("");
  const [sceneCount, setSceneCount] = useState("4");
  const [style, setStyle] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");

  const storyboard = trpc.video.generateStoryboard.useMutation();
  const saveProject = trpc.videoProject.save.useMutation();

  const handleGenerate = () => {
    if (!concept.trim()) return;
    storyboard.mutate({
      concept: concept.trim(),
      sceneCount: parseInt(sceneCount),
      style: style as any,
      aspectRatio: aspectRatio as any,
      generateImages: true,
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Video Concept</label>
            <Textarea
              placeholder="Describe your video idea... e.g., 'A time-lapse of a city transforming from dawn to dusk, showing the energy of urban life'"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="min-h-[120px] bg-background/50 border-border/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Scenes</label>
              <Select value={sceneCount} onValueChange={setSceneCount}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} scenes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Aspect Ratio</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 Landscape</SelectItem>
                  <SelectItem value="9:16">9:16 Portrait</SelectItem>
                  <SelectItem value="1:1">1:1 Square</SelectItem>
                  <SelectItem value="4:3">4:3 Classic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Visual Style</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cinematic">Cinematic</SelectItem>
                <SelectItem value="anime">Anime</SelectItem>
                <SelectItem value="documentary">Documentary</SelectItem>
                <SelectItem value="music-video">Music Video</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="abstract">Abstract</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!concept.trim() || storyboard.isPending}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {storyboard.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Storyboard...</>
            ) : (
              <><Clapperboard className="w-4 h-4 mr-2" /> Generate Storyboard</>
            )}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {storyboard.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-violet-500" />
                <Sparkles className="w-5 h-5 absolute -top-1 -right-1 text-cyan-400 animate-pulse" />
              </div>
              <p className="mt-4 text-sm">Creating your storyboard with AI-generated scene images...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">This may take a minute for {sceneCount} scenes</p>
            </div>
          )}

          {storyboard.data && storyboard.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-4 bg-background/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{storyboard.data.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{storyboard.data.synopsis}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setSaveTitle(storyboard.data?.title || ""); setSaveDialogOpen(true); }}>
                      <Save className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportPdf}>
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{storyboard.data.totalDuration}s</Badge>
                  <Badge variant="outline" className="text-xs"><Film className="w-3 h-3 mr-1" />{storyboard.data.scenes?.length} scenes</Badge>
                  <Badge variant="outline" className="text-xs capitalize"><Palette className="w-3 h-3 mr-1" />{style}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                {storyboard.data.scenes?.map((scene: any, i: number) => (
                  <div key={i} className="border border-border/40 rounded-xl overflow-hidden bg-background/20 hover:border-violet-500/30 transition-colors">
                    <div className="flex flex-col sm:flex-row">
                      {scene.imageUrl && (
                        <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                          <img src={scene.imageUrl} alt={`Scene ${scene.sceneNumber}`} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-violet-500/20 text-violet-300 text-xs">Scene {scene.sceneNumber}</Badge>
                          <span className="text-xs text-muted-foreground">{scene.duration}s</span>
                          <Badge variant="outline" className="text-xs">{scene.transition}</Badge>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{scene.visualDescription}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{scene.cameraAngle}</span>
                          <span>•</span>
                          <span>{scene.cameraMovement}</span>
                          <span>•</span>
                          <span className="italic">{scene.mood}</span>
                        </div>
                        {scene.narration && <p className="text-xs text-muted-foreground/70 mt-2 italic">"{scene.narration}"</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {storyboard.data && storyboard.data.status === "failed" && (
            <div className="text-center py-12 text-red-400">
              <p>Failed to generate storyboard. Please try again.</p>
            </div>
          )}

          {!storyboard.data && !storyboard.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
              <Clapperboard className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">Describe your video concept and generate a visual storyboard</p>
              <p className="text-xs mt-1">Each scene gets an AI-generated preview image</p>
            </div>
          )}
        </div>
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
    </div>
  );
}

// ─── Scene Director Tab ───────────────────────────────────────────
function SceneDirectorTab() {
  const [narrative, setNarrative] = useState("");
  const [keyframeCount, setKeyframeCount] = useState("4");
  const [cameraStyle, setCameraStyle] = useState("tracking");
  const [mood, setMood] = useState("epic");

  const director = trpc.video.directScene.useMutation();
  const saveProject = trpc.videoProject.save.useMutation();

  const handleDirect = () => {
    if (!narrative.trim()) return;
    director.mutate({
      narrative: narrative.trim(),
      keyframeCount: parseInt(keyframeCount),
      cameraStyle: cameraStyle as any,
      mood: mood as any,
    });
  };

  const handleSave = () => {
    if (!director.data || director.data.status !== "completed") return;
    saveProject.mutate({
      type: "scene-direction",
      title: director.data.sceneTitle || "Scene Direction",
      description: narrative.slice(0, 200),
      data: director.data,
    }, {
      onSuccess: () => toast.success("Scene direction saved to My Projects"),
      onError: () => toast.error("Failed to save"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Scene Narrative</label>
            <Textarea
              placeholder="Describe the scene you want to direct..."
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="min-h-[120px] bg-background/50 border-border/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Keyframes</label>
              <Select value={keyframeCount} onValueChange={setKeyframeCount}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} keyframes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Mood</label>
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["epic", "intimate", "tense", "dreamy", "energetic", "melancholic", "mysterious", "playful"].map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Camera Style</label>
            <Select value={cameraStyle} onValueChange={setCameraStyle}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["tracking", "static", "handheld", "crane", "drone", "steadicam", "pov", "dolly"].map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleDirect}
            disabled={!narrative.trim() || director.isPending}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          >
            {director.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Directing Scene...</>
            ) : (
              <><Camera className="w-4 h-4 mr-2" /> Direct Scene</>
            )}
          </Button>
        </div>

        <div className="lg:col-span-2">
          {director.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
              <p className="mt-4 text-sm">Creating keyframe sequence with camera directions...</p>
            </div>
          )}

          {director.data && director.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-4 bg-background/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{director.data.sceneTitle}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{director.data.overallDirection}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSave} disabled={saveProject.isPending}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {director.data.keyframes?.map((kf: any, i: number) => (
                  <div key={i} className="border border-border/40 rounded-xl overflow-hidden bg-background/20 hover:border-cyan-500/30 transition-colors">
                    <div className="flex flex-col sm:flex-row">
                      {kf.imageUrl && (
                        <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                          <img src={kf.imageUrl} alt={`Keyframe ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-cyan-500/20 text-cyan-300 text-xs">KF {kf.keyframeNumber}</Badge>
                          <span className="text-xs text-muted-foreground">{kf.timestamp}</span>
                        </div>
                        <p className="text-sm text-foreground/90">{kf.visualDescription}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                          <span><Camera className="w-3 h-3 inline mr-1" />{kf.cameraPosition}</span>
                          <span>•</span>
                          <span>{kf.cameraMovement}</span>
                          <span>•</span>
                          <span>{kf.lighting}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!director.data && !director.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
              <Camera className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">Describe a scene and get AI-directed keyframes with camera work</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Script Writer Tab ───────────────────────────────────────────
function ScriptWriterTab() {
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState("60");
  const [format, setFormat] = useState("narrative");
  const [tone, setTone] = useState("professional");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");

  const script = trpc.video.generateScript.useMutation();
  const saveProject = trpc.videoProject.save.useMutation();

  const handleGenerate = () => {
    if (!concept.trim()) return;
    script.mutate({
      concept: concept.trim(),
      duration: parseInt(duration),
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Video Concept</label>
            <Textarea
              placeholder="What's your video about?"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="min-h-[120px] bg-background/50 border-border/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Duration</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15s (Short)</SelectItem>
                  <SelectItem value="30">30s (Reel)</SelectItem>
                  <SelectItem value="60">60s (Standard)</SelectItem>
                  <SelectItem value="120">2min (Extended)</SelectItem>
                  <SelectItem value="300">5min (Long)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrative">Narrative</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                  <SelectItem value="music-video">Music Video</SelectItem>
                  <SelectItem value="documentary">Documentary</SelectItem>
                  <SelectItem value="social-media">Social Media</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Tone</label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="dramatic">Dramatic</SelectItem>
                <SelectItem value="humorous">Humorous</SelectItem>
                <SelectItem value="inspirational">Inspirational</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!concept.trim() || script.isPending}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800"
          >
            {script.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Writing Script...</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" /> Generate Script</>
            )}
          </Button>
        </div>

        <div className="lg:col-span-2">
          {script.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-12 h-12 animate-spin text-cyan-500" />
              <p className="mt-4 text-sm">Writing your video script...</p>
            </div>
          )}

          {script.data && script.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-4 bg-background/30">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{script.data.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 italic">"{script.data.logline}"</p>
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
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{script.data.targetDuration}s</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{script.data.format}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{script.data.tone}</Badge>
                  <Badge variant="outline" className="text-xs">{script.data.scenes?.length} scenes</Badge>
                </div>
              </div>

              <div className="space-y-3">
                {script.data.scenes?.map((scene: any, i: number) => (
                  <div key={i} className="border border-border/40 rounded-xl p-4 bg-background/20 hover:border-cyan-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-cyan-500/20 text-cyan-300 text-xs">Scene {scene.sceneNumber}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{scene.startTime} — {scene.endTime}</span>
                      <Badge variant="outline" className="text-xs">{scene.location}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Visual</span>
                        <p className="text-sm text-foreground/90">{scene.visualDescription}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Camera</span>
                        <p className="text-sm text-muted-foreground">{scene.cameraDirection}</p>
                      </div>
                      {scene.narration && (
                        <div>
                          <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Narration</span>
                          <p className="text-sm text-muted-foreground italic">"{scene.narration}"</p>
                        </div>
                      )}
                      {scene.dialogue && (
                        <div>
                          <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider">Dialogue</span>
                          <p className="text-sm text-muted-foreground">{scene.dialogue}</p>
                        </div>
                      )}
                      <div className="flex gap-4 text-xs text-muted-foreground/60">
                        {scene.soundDesign && <span>🔊 {scene.soundDesign}</span>}
                        {scene.productionNotes && <span>📝 {scene.productionNotes}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {script.data.equipmentNeeded?.length > 0 && (
                <div className="border border-border/40 rounded-xl p-4 bg-background/20">
                  <h4 className="text-sm font-medium text-foreground/80 mb-2">Equipment Needed</h4>
                  <div className="flex flex-wrap gap-2">
                    {script.data.equipmentNeeded.map((eq: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{eq}</Badge>
                    ))}
                  </div>
                  {script.data.productionBudget && (
                    <p className="text-xs text-muted-foreground mt-2">Budget estimate: {script.data.productionBudget}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!script.data && !script.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
              <FileText className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">Describe your video concept and get a professional script</p>
              <p className="text-xs mt-1">Includes scene breakdowns, camera directions, and narration</p>
            </div>
          )}
        </div>
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
    </div>
  );
}

// ─── Soundtrack Tab ───────────────────────────────────────────────
function SoundtrackTab() {
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState("30");
  const [mood, setMood] = useState("epic");

  const soundtrack = trpc.video.suggestSoundtrack.useMutation();
  const saveProject = trpc.videoProject.save.useMutation();

  const handleSuggest = () => {
    if (!concept.trim()) return;
    soundtrack.mutate({
      concept: concept.trim(),
      duration: parseInt(duration),
      mood: mood as any,
    });
  };

  const handleSave = () => {
    if (!soundtrack.data || soundtrack.data.status !== "completed") return;
    saveProject.mutate({
      type: "soundtrack",
      title: `Soundtrack: ${soundtrack.data.primaryGenre || "Suggestion"}`,
      description: concept.slice(0, 200),
      data: soundtrack.data,
    }, {
      onSuccess: () => toast.success("Soundtrack suggestion saved to My Projects"),
      onError: () => toast.error("Failed to save"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Video Concept</label>
            <Textarea
              placeholder="Describe your video for soundtrack suggestions..."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="min-h-[100px] bg-background/50 border-border/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Duration</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                  <SelectItem value="120">2min</SelectItem>
                  <SelectItem value="300">5min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Mood</label>
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="calm">Calm</SelectItem>
                  <SelectItem value="tense">Tense</SelectItem>
                  <SelectItem value="happy">Happy</SelectItem>
                  <SelectItem value="sad">Sad</SelectItem>
                  <SelectItem value="mysterious">Mysterious</SelectItem>
                  <SelectItem value="energetic">Energetic</SelectItem>
                  <SelectItem value="romantic">Romantic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleSuggest}
            disabled={!concept.trim() || soundtrack.isPending}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            {soundtrack.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
            ) : (
              <><Music className="w-4 h-4 mr-2" /> Suggest Soundtrack</>
            )}
          </Button>
        </div>

        <div className="lg:col-span-2">
          {soundtrack.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
              <p className="mt-4 text-sm">Analyzing your video concept for soundtrack suggestions...</p>
            </div>
          )}

          {soundtrack.data && soundtrack.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-5 bg-background/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                      <Music className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{soundtrack.data.primaryGenre}</h3>
                      <div className="flex gap-2 mt-0.5">
                        {soundtrack.data.subGenres?.map((g: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{g}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSave} disabled={saveProject.isPending}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Save
                  </Button>
                </div>
                <p className="text-sm text-foreground/80 mt-3">{soundtrack.data.description}</p>
                <div className="flex gap-3 mt-3">
                  <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">🎵 {soundtrack.data.tempo}</Badge>
                  <Badge className="bg-emerald-500/20 text-emerald-300 text-xs capitalize">{soundtrack.data.mood} mood</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-border/40 rounded-xl p-4 bg-background/20">
                  <h4 className="text-sm font-medium text-foreground/80 mb-2">Key Instruments</h4>
                  <div className="flex flex-wrap gap-2">
                    {soundtrack.data.keyInstruments?.map((inst: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{inst}</Badge>
                    ))}
                  </div>
                </div>
                <div className="border border-border/40 rounded-xl p-4 bg-background/20">
                  <h4 className="text-sm font-medium text-foreground/80 mb-2">Sound Effects</h4>
                  <div className="flex flex-wrap gap-2">
                    {soundtrack.data.soundEffects?.map((sfx: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{sfx}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-border/40 rounded-xl p-4 bg-background/20">
                <h4 className="text-sm font-medium text-foreground/80 mb-2">Mood Progression</h4>
                <p className="text-sm text-muted-foreground">{soundtrack.data.moodProgression}</p>
              </div>

              {soundtrack.data.referenceTracks?.length > 0 && (
                <div className="border border-border/40 rounded-xl p-4 bg-background/20">
                  <h4 className="text-sm font-medium text-foreground/80 mb-3">Reference Tracks</h4>
                  <div className="space-y-2">
                    {soundtrack.data.referenceTracks.map((track: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-background/40 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground/90">{track.title}</p>
                          <p className="text-xs text-muted-foreground">{track.artist}</p>
                          <p className="text-xs text-muted-foreground/60 mt-0.5">{track.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {soundtrack.data.licensingNotes && (
                <p className="text-xs text-muted-foreground/60 italic">{soundtrack.data.licensingNotes}</p>
              )}
            </div>
          )}

          {!soundtrack.data && !soundtrack.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
              <Music className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">Get AI-powered soundtrack suggestions for your video</p>
              <p className="text-xs mt-1">Includes genre, instruments, tempo, and reference tracks</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Projects Section ─────────────────────────────────────────
function MyProjectsSection() {
  const [, navigate] = useLocation();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"mine" | "shared">("mine");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.videoProject.list.useQuery(
    typeFilter === "all" ? undefined : { type: typeFilter as any }
  );

  const { data: sharedProjects, isLoading: sharedLoading } = trpc.videoProject.sharedWithMe.useQuery(
    undefined, { enabled: viewMode === "shared" }
  );

  const deleteProject = trpc.videoProject.delete.useMutation({
    onSuccess: () => {
      utils.videoProject.list.invalidate();
      toast.success("Project deleted");
    },
    onError: () => toast.error("Failed to delete project"),
  });

  const typeIcons: Record<string, React.ReactNode> = {
    storyboard: <Clapperboard className="w-4 h-4" />,
    script: <FileText className="w-4 h-4" />,
    "scene-direction": <Camera className="w-4 h-4" />,
    soundtrack: <Music className="w-4 h-4" />,
  };

  const typeColors: Record<string, string> = {
    storyboard: "text-violet-400 bg-violet-500/10",
    script: "text-cyan-400 bg-cyan-500/10",
    "scene-direction": "text-cyan-400 bg-cyan-500/10",
    soundtrack: "text-emerald-400 bg-emerald-500/10",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-violet-400" /> Projects
          </h3>
          <div className="flex gap-1 bg-background/30 rounded-lg p-0.5 border border-border/40">
            <button
              onClick={() => setViewMode("mine")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                viewMode === "mine" ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Projects
            </button>
            <button
              onClick={() => setViewMode("shared")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                viewMode === "shared" ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Shared with Me
            </button>
          </div>
        </div>
        {viewMode === "mine" && (
          <div className="flex gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "storyboard", label: "Storyboards" },
              { id: "script", label: "Scripts" },
              { id: "scene-direction", label: "Scenes" },
              { id: "soundtrack", label: "Soundtracks" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1 text-xs rounded-full transition-all ${
                  typeFilter === f.id
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                    : "bg-background/30 text-muted-foreground border border-border/40 hover:border-violet-500/30"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* My Projects View */}
      {viewMode === "mine" && (
        <>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          )}

          {data && data.projects.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No saved projects yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Generate a storyboard or script and save it here</p>
            </div>
          )}

          {data && data.projects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.projects.map((project: any) => (
                <div
                  key={project.id}
                  className="border border-border/40 rounded-xl bg-card/50 p-4 hover:border-violet-500/30 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/video-studio/project/${project.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[project.type] || "bg-muted"}`}>
                      {typeIcons[project.type]}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                      onClick={(e) => { e.stopPropagation(); deleteProject.mutate({ id: project.id }); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground line-clamp-1">{project.title}</h4>
                  {project.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className="text-xs capitalize">{project.type.replace("-", " ")}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {data && data.total > 20 && (
            <p className="text-xs text-center text-muted-foreground">Showing {data.projects.length} of {data.total} projects</p>
          )}
        </>
      )}

      {/* Shared with Me View */}
      {viewMode === "shared" && (
        <>
          {sharedLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          )}

          {sharedProjects && sharedProjects.length === 0 && (
            <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
              <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No shared projects yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Projects shared with you via invite links will appear here</p>
            </div>
          )}

          {sharedProjects && sharedProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sharedProjects.map((sp: any) => (
                <div
                  key={sp.collaboratorId}
                  className="border border-border/40 rounded-xl bg-card/50 p-4 hover:border-violet-500/30 transition-colors group cursor-pointer"
                  onClick={() => navigate(`/video-studio/project/${sp.projectId}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${typeColors[sp.projectType] || "bg-muted"}`}>
                      {typeIcons[sp.projectType]}
                    </div>
                    <Badge variant="outline" className={`text-xs ${
                      sp.role === "editor" ? "text-cyan-400 border-cyan-500/40" : "text-blue-400 border-blue-500/40"
                    }`}>
                      {sp.role}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground line-clamp-1">{sp.projectTitle}</h4>
                  <p className="text-xs text-muted-foreground mt-1">by {sp.ownerName || "Unknown"}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className="text-xs capitalize">{sp.projectType?.replace("-", " ")}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(sp.updatedAt).toLocaleDateString()}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Template Browser Section ────────────────────────────────────
function TemplateBrowserSection() {
  const [, navigate] = useLocation();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: templates, isLoading } = trpc.videoProject.templates.useQuery(
    categoryFilter === "all" ? {} : { category: categoryFilter }
  );

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(
      (t: any) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const categoryIcons: Record<string, React.ReactNode> = {
    commercial: <Rocket className="w-3.5 h-3.5" />,
    education: <GraduationCap className="w-3.5 h-3.5" />,
    entertainment: <Music className="w-3.5 h-3.5" />,
    social: <Smartphone className="w-3.5 h-3.5" />,
    narrative: <Film className="w-3.5 h-3.5" />,
    atmosphere: <Waves className="w-3.5 h-3.5" />,
  };

  const toolTypeMap: Record<string, string> = {
    storyboard: "storyboard",
    script: "script",
    "scene-direction": "director",
    soundtrack: "soundtrack",
  };

  const handleUseTemplate = (template: any) => {
    // Navigate to the Video Studio and switch to the correct tab
    // We'll use URL search params to pass template data
    const tab = toolTypeMap[template.toolType] || "storyboard";
    toast.success(`Template "${template.name}" loaded! Switch to the ${tab} tab to see it.`);
    // Store template in sessionStorage for the tab to pick up
    sessionStorage.setItem("videoTemplate", JSON.stringify(template));
    navigate("/video-studio");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-cyan-400" /> Template Library
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="h-8 pl-8 w-48 text-xs bg-background/50"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { id: "all", label: "All" },
          { id: "commercial", label: "Commercial" },
          { id: "education", label: "Education" },
          { id: "entertainment", label: "Entertainment" },
          { id: "social", label: "Social" },
          { id: "narrative", label: "Narrative" },
          { id: "atmosphere", label: "Atmosphere" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={`px-3 py-1 text-xs rounded-full transition-all flex items-center gap-1 ${
              categoryFilter === cat.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
            }`}
          >
            {cat.id !== "all" && categoryIcons[cat.id]}
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      )}

      {filteredTemplates.length === 0 && !isLoading && (
        <div className="text-center py-12 border border-dashed border-border/40 rounded-xl">
          <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No templates match your search</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template: any) => (
          <div
            key={template.id}
            className="border border-border/40 rounded-xl bg-card/50 p-4 hover:border-cyan-500/30 transition-all group cursor-pointer"
            onClick={() => handleUseTemplate(template)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-2xl">{template.icon}</div>
              <Badge variant="outline" className="text-xs capitalize">{template.category}</Badge>
            </div>
            <h4 className="text-sm font-semibold text-foreground">{template.name}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="text-xs capitalize">{template.toolType.replace("-", " ")}</Badge>
              <span className="text-xs text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                Use Template <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Video Studio Page ───────────────────────────────────────
export default function VideoStudio() {
  const { user } = useAuth();

  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5 mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="container max-w-7xl relative py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
                <Film className="h-3 w-3" />
                AI Video Production
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Video{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Studio
                </span>
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Storyboards, scripts, scene direction, soundtracks — everything you need to produce AI-powered video content.
              </p>
            </div>
            <div className="flex gap-2">
              {["/showcase/tool-t2v.jpg", "/showcase/tool-video.jpg", "/showcase/home-tool-video.jpg"].map((img, i) => (
                <div key={i} className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70">
                  <img src={img} alt="AI generated showcase" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-2 mt-6">
            <Link href="/workspace">
              <Badge variant="outline" className="cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-colors">
                <Wand2 className="w-3 h-3 mr-1" /> Image Studio
              </Badge>
            </Link>
            <Link href="/tools">
              <Badge variant="outline" className="cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-colors">
                <Layers className="w-3 h-3 mr-1" /> All AI Tools
              </Badge>
            </Link>
            <Link href="/video-studio/style-transfer">
              <Badge variant="outline" className="cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-colors">
                <Palette className="w-3 h-3 mr-1" /> Video Style Transfer
              </Badge>
            </Link>
            <Link href="/video-studio/upscaler">
              <Badge variant="outline" className="cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-colors">
                <Maximize className="w-3 h-3 mr-1" /> Video Upscaler
              </Badge>
            </Link>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl py-8">

        {/* Main Tabs */}
        <Tabs defaultValue="storyboard" className="space-y-6">
          <TabsList className="bg-background/50 border border-border/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="storyboard" className="gap-1.5 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Clapperboard className="w-4 h-4" /> Storyboard
            </TabsTrigger>
            <TabsTrigger value="director" className="gap-1.5 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Camera className="w-4 h-4" /> Scene Director
            </TabsTrigger>
            <TabsTrigger value="script" className="gap-1.5 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <FileText className="w-4 h-4" /> Script Writer
            </TabsTrigger>
            <TabsTrigger value="soundtrack" className="gap-1.5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">
              <Music className="w-4 h-4" /> Soundtrack
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <FolderOpen className="w-4 h-4" /> My Projects
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <LayoutTemplate className="w-4 h-4" /> Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="storyboard"><StoryboardTab /></TabsContent>
          <TabsContent value="director"><SceneDirectorTab /></TabsContent>
          <TabsContent value="script"><ScriptWriterTab /></TabsContent>
          <TabsContent value="soundtrack"><SoundtrackTab /></TabsContent>
          <TabsContent value="projects"><MyProjectsSection /></TabsContent>
          <TabsContent value="templates"><TemplateBrowserSection /></TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
