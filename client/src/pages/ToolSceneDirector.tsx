import { useState } from "react";
import { trpc } from "@/lib/trpc";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Camera, Clapperboard, Sparkles } from "lucide-react";

const CAMERA_STYLES = [
  { id: "static", label: "Static", desc: "Fixed camera position" },
  { id: "tracking", label: "Tracking", desc: "Follows the subject" },
  { id: "crane", label: "Crane", desc: "Sweeping overhead shots" },
  { id: "handheld", label: "Handheld", desc: "Raw, intimate feel" },
  { id: "drone", label: "Drone", desc: "Aerial perspectives" },
  { id: "steadicam", label: "Steadicam", desc: "Smooth gliding motion" },
] as const;

const MOODS = [
  { id: "epic", label: "Epic", color: "from-amber-500 to-red-500" },
  { id: "intimate", label: "Intimate", color: "from-rose-400 to-pink-500" },
  { id: "tense", label: "Tense", color: "from-red-600 to-orange-600" },
  { id: "dreamy", label: "Dreamy", color: "from-violet-400 to-purple-500" },
  { id: "energetic", label: "Energetic", color: "from-yellow-400 to-orange-500" },
  { id: "melancholic", label: "Melancholic", color: "from-blue-500 to-indigo-600" },
] as const;

const KEYFRAME_COUNTS = [2, 3, 4, 5, 6] as const;

export default function ToolSceneDirector() {
  const [narrative, setNarrative] = useState("");
  const [cameraStyle, setCameraStyle] = useState<string>("tracking");
  const [mood, setMood] = useState<string>("epic");
  const [keyframeCount, setKeyframeCount] = useState<number>(4);

  const director = trpc.video.directScene.useMutation();

  const handleDirect = () => {
    if (!narrative.trim()) return;
    director.mutate({
      narrative: narrative.trim(),
      keyframeCount,
      cameraStyle: cameraStyle as any,
      mood: mood as any,
    });
  };

  return (
    <ToolPageLayout
      title="Scene Director"
      description="AI-powered scene composition with keyframe generation and camera direction"
      icon={Camera}
      gradient="from-cyan-500 to-blue-600"
    >
      <div className="space-y-8">
        {/* Input */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <label className="text-sm font-medium text-foreground/80">Scene Narrative</label>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Describe the scene you want to direct... e.g., 'A warrior stands at the edge of a cliff overlooking a vast battlefield at sunset, wind blowing through their cape as they raise a glowing sword'"
              rows={5}
              className="bg-background/50 border-border/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">{narrative.length}/2000 characters</p>
          </div>

          <div className="space-y-4">
            {/* Camera Style */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Camera Style</label>
              <div className="space-y-1.5">
                {CAMERA_STYLES.map((cs) => (
                  <button
                    key={cs.id}
                    onClick={() => setCameraStyle(cs.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      cameraStyle === cs.id
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
                    }`}
                  >
                    <span className="font-medium">{cs.label}</span>
                    <span className="text-xs ml-2 opacity-70">{cs.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Mood</label>
              <div className="grid grid-cols-3 gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`px-2 py-2 rounded-lg text-xs text-center transition-all ${
                      mood === m.id
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Keyframes */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Keyframes</label>
              <div className="flex gap-2">
                {KEYFRAME_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setKeyframeCount(n)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      keyframeCount === n
                        ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-cyan-500/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleDirect}
              disabled={!narrative.trim() || director.isPending}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {director.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Directing Scene...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Direct Scene</>
              )}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {director.isPending && (
          <div className="flex flex-col items-center py-16">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-cyan-500" />
              <Clapperboard className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-300" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Composing {keyframeCount} keyframes with {cameraStyle} camera...</p>
          </div>
        )}

        {/* Results */}
        {director.data && director.data.status === "completed" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{director.data.sceneTitle || "Scene Direction"}</h3>
                <p className="text-sm text-muted-foreground">{director.data.overallDirection}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">{cameraStyle}</Badge>
                <Badge variant="outline" className="capitalize">{mood}</Badge>
              </div>
            </div>

            {/* Keyframes Timeline */}
            <div className="space-y-4">
              {director.data.keyframes.map((kf: any, i: number) => (
                <div
                  key={i}
                  className="flex gap-4 rounded-xl border border-border/40 bg-card/50 overflow-hidden group hover:border-cyan-500/30 transition-colors"
                >
                  {/* Image */}
                  <div className="w-48 md:w-64 shrink-0">
                    {kf.imageUrl ? (
                      <div className="relative aspect-video">
                        <img src={kf.imageUrl} alt={`Keyframe ${kf.frameNumber}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-black/60 text-white border-0 text-xs">KF {kf.frameNumber}</Badge>
                        </div>
                        <a
                          href={kf.imageUrl}
                          download={`keyframe-${kf.frameNumber}.png`}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Button size="icon" variant="ghost" className="h-7 w-7 bg-black/50 hover:bg-black/70">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted/20 flex items-center justify-center">
                        <p className="text-xs text-muted-foreground">KF {kf.frameNumber}</p>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="py-3 pr-4 space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{kf.timestamp}</Badge>
                    </div>
                    <p className="text-sm text-foreground/90">{kf.composition}</p>
                    <p className="text-xs text-cyan-400/70">📷 {kf.cameraPosition}</p>
                    <p className="text-xs text-muted-foreground">💡 {kf.lighting}</p>
                    <p className="text-xs text-muted-foreground/70">🎬 {kf.movement}</p>
                    {kf.notes && (
                      <p className="text-xs text-muted-foreground/50 italic">{kf.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {director.data && director.data.status === "failed" && (
          <div className="text-center py-12 text-red-400">
            <p className="text-sm">Failed to direct scene. Please try again.</p>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
