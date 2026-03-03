import { useState } from "react";
import { Link } from "wouter";
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
import {
  Film, Clapperboard, Palette, Maximize, Music, FileText,
  Play, Loader2, ArrowRight, Sparkles, Clock, Camera,
  ChevronRight, Video, Wand2, Layers
} from "lucide-react";

// ─── Storyboard Tab ───────────────────────────────────────────────
function StoryboardTab() {
  const [concept, setConcept] = useState("");
  const [sceneCount, setSceneCount] = useState("4");
  const [style, setStyle] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const storyboard = trpc.video.generateStoryboard.useMutation();

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
                <Sparkles className="w-5 h-5 absolute -top-1 -right-1 text-amber-400 animate-pulse" />
              </div>
              <p className="mt-4 text-sm">Creating your storyboard with AI-generated scene images...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">This may take a minute for {sceneCount} scenes</p>
            </div>
          )}

          {storyboard.data && storyboard.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-4 bg-background/30">
                <h3 className="text-lg font-semibold text-foreground">{storyboard.data.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{storyboard.data.synopsis}</p>
                <div className="flex gap-3 mt-2">
                  <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{storyboard.data.totalDuration}s</Badge>
                  <Badge variant="outline" className="text-xs"><Film className="w-3 h-3 mr-1" />{storyboard.data.scenes?.length} scenes</Badge>
                  <Badge variant="outline" className="text-xs capitalize"><Palette className="w-3 h-3 mr-1" />{storyboard.data.style}</Badge>
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

  const handleDirect = () => {
    if (!narrative.trim()) return;
    director.mutate({
      narrative: narrative.trim(),
      keyframeCount: parseInt(keyframeCount),
      cameraStyle: cameraStyle as any,
      mood: mood as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Scene Narrative</label>
            <Textarea
              placeholder="Describe the scene you want to direct... e.g., 'A lone astronaut walks across a barren Mars landscape toward a glowing structure on the horizon'"
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
                  {[2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} keyframes</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Camera</label>
              <Select value={cameraStyle} onValueChange={setCameraStyle}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="tracking">Tracking</SelectItem>
                  <SelectItem value="crane">Crane</SelectItem>
                  <SelectItem value="handheld">Handheld</SelectItem>
                  <SelectItem value="drone">Drone</SelectItem>
                  <SelectItem value="steadicam">Steadicam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Mood</label>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="epic">Epic</SelectItem>
                <SelectItem value="intimate">Intimate</SelectItem>
                <SelectItem value="tense">Tense</SelectItem>
                <SelectItem value="dreamy">Dreamy</SelectItem>
                <SelectItem value="energetic">Energetic</SelectItem>
                <SelectItem value="melancholic">Melancholic</SelectItem>
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
              <p className="mt-4 text-sm">Directing your scene with keyframe generation...</p>
            </div>
          )}

          {director.data && director.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-4 bg-background/30">
                <h3 className="text-lg font-semibold text-foreground">{director.data.sceneTitle}</h3>
                <p className="text-sm text-muted-foreground mt-1">{director.data.overallDirection}</p>
                <div className="flex gap-3 mt-2">
                  <Badge variant="outline" className="text-xs capitalize"><Camera className="w-3 h-3 mr-1" />{director.data.cameraStyle}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{director.data.mood}</Badge>
                </div>
              </div>

              {/* Keyframe Timeline */}
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-blue-500/50 to-transparent" />
                <div className="space-y-4">
                  {director.data.keyframes?.map((kf: any, i: number) => (
                    <div key={i} className="relative pl-14">
                      <div className="absolute left-4 top-4 w-4 h-4 rounded-full bg-cyan-500 border-2 border-background z-10" />
                      <div className="border border-border/40 rounded-xl overflow-hidden bg-background/20">
                        <div className="flex flex-col sm:flex-row">
                          {kf.imageUrl && (
                            <div className="sm:w-44 h-28 sm:h-auto flex-shrink-0">
                              <img src={kf.imageUrl} alt={`Keyframe ${kf.frameNumber}`} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="p-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Badge className="bg-cyan-500/20 text-cyan-300 text-xs">KF {kf.frameNumber}</Badge>
                              <span className="text-xs text-muted-foreground font-mono">{kf.timestamp}</span>
                            </div>
                            <p className="text-sm text-foreground/90">{kf.composition}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                              <span>📷 {kf.cameraPosition}</span>
                              <span>💡 {kf.lighting}</span>
                              <span>🎬 {kf.movement}</span>
                            </div>
                            {kf.notes && <p className="text-xs text-muted-foreground/60 mt-1 italic">{kf.notes}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!director.data && !director.isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/50">
              <Camera className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">Describe a scene and get AI-directed keyframes with camera instructions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Script Writer Tab ────────────────────────────────────────────
function ScriptWriterTab() {
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState("60");
  const [format, setFormat] = useState("narrative");
  const [tone, setTone] = useState("professional");

  const script = trpc.video.generateScript.useMutation();

  const handleGenerate = () => {
    if (!concept.trim()) return;
    script.mutate({
      concept: concept.trim(),
      duration: parseInt(duration),
      format: format as any,
      tone: tone as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Video Concept</label>
            <Textarea
              placeholder="What's your video about? e.g., 'A product launch video for a new AI-powered design tool that helps creators work 10x faster'"
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
            className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
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
              <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
              <p className="mt-4 text-sm">Writing your video script...</p>
            </div>
          )}

          {script.data && script.data.status === "completed" && (
            <div className="space-y-4">
              <div className="border border-border/50 rounded-xl p-4 bg-background/30">
                <h3 className="text-lg font-semibold text-foreground">{script.data.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 italic">"{script.data.logline}"</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />{script.data.targetDuration}s</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{script.data.format}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{script.data.tone}</Badge>
                  <Badge variant="outline" className="text-xs">{script.data.scenes?.length} scenes</Badge>
                </div>
              </div>

              <div className="space-y-3">
                {script.data.scenes?.map((scene: any, i: number) => (
                  <div key={i} className="border border-border/40 rounded-xl p-4 bg-background/20 hover:border-amber-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-500/20 text-amber-300 text-xs">Scene {scene.sceneNumber}</Badge>
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
                        <span>🔊 {scene.soundDesign}</span>
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
    </div>
  );
}

// ─── Soundtrack Tab ───────────────────────────────────────────────
function SoundtrackTab() {
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState("30");
  const [mood, setMood] = useState("epic");

  const soundtrack = trpc.video.suggestSoundtrack.useMutation();

  const handleSuggest = () => {
    if (!concept.trim()) return;
    soundtrack.mutate({
      concept: concept.trim(),
      duration: parseInt(duration),
      mood: mood as any,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Video Concept</label>
            <Textarea
              placeholder="Describe your video for soundtrack suggestions... e.g., 'An epic drone flyover of mountain peaks at golden hour'"
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
                <div className="flex items-center gap-3 mb-3">
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
                <p className="text-sm text-foreground/80">{soundtrack.data.description}</p>
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

// ─── Main Video Studio Page ───────────────────────────────────────
export default function VideoStudio() {
  const { user } = useAuth();

  if (!user) {
    return (
      <PageLayout>
        <div className="container max-w-4xl py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Video className="w-10 h-10 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Video Studio</h1>
          <p className="text-muted-foreground mb-6">Sign in to access the full video creation suite</p>
          <Button asChild className="bg-gradient-to-r from-violet-600 to-purple-600">
            <a href={getLoginUrl()}>Sign In to Get Started</a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container max-w-7xl py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Video Studio</h1>
              <p className="text-sm text-muted-foreground">AI-powered video creation tools</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/workspace">
              <Badge variant="outline" className="cursor-pointer hover:bg-violet-500/10 transition-colors">
                <Wand2 className="w-3 h-3 mr-1" /> Image Studio
              </Badge>
            </Link>
            <Link href="/tools">
              <Badge variant="outline" className="cursor-pointer hover:bg-violet-500/10 transition-colors">
                <Layers className="w-3 h-3 mr-1" /> All AI Tools
              </Badge>
            </Link>
            <Link href="/tools/video-style-transfer">
              <Badge variant="outline" className="cursor-pointer hover:bg-violet-500/10 transition-colors">
                <Palette className="w-3 h-3 mr-1" /> Video Style Transfer
              </Badge>
            </Link>
            <Link href="/tools/video-upscaler">
              <Badge variant="outline" className="cursor-pointer hover:bg-violet-500/10 transition-colors">
                <Maximize className="w-3 h-3 mr-1" /> Video Upscaler
              </Badge>
            </Link>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="storyboard" className="space-y-6">
          <TabsList className="bg-background/50 border border-border/50 p-1 h-auto flex-wrap">
            <TabsTrigger value="storyboard" className="gap-1.5 data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Clapperboard className="w-4 h-4" /> Storyboard
            </TabsTrigger>
            <TabsTrigger value="director" className="gap-1.5 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Camera className="w-4 h-4" /> Scene Director
            </TabsTrigger>
            <TabsTrigger value="script" className="gap-1.5 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
              <FileText className="w-4 h-4" /> Script Writer
            </TabsTrigger>
            <TabsTrigger value="soundtrack" className="gap-1.5 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">
              <Music className="w-4 h-4" /> Soundtrack
            </TabsTrigger>
          </TabsList>

          <TabsContent value="storyboard"><StoryboardTab /></TabsContent>
          <TabsContent value="director"><SceneDirectorTab /></TabsContent>
          <TabsContent value="script"><ScriptWriterTab /></TabsContent>
          <TabsContent value="soundtrack"><SoundtrackTab /></TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
