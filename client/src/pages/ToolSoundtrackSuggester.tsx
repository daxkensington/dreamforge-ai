import { useState } from "react";
import { trpc } from "@/lib/trpc";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Loader2, Music, Headphones, Sparkles, Disc3 } from "lucide-react";

const MOODS = [
  { id: "epic", label: "Epic", emoji: "🎬" },
  { id: "calm", label: "Calm", emoji: "🌊" },
  { id: "tense", label: "Tense", emoji: "⚡" },
  { id: "happy", label: "Happy", emoji: "☀️" },
  { id: "sad", label: "Sad", emoji: "🌧️" },
  { id: "mysterious", label: "Mysterious", emoji: "🌙" },
  { id: "energetic", label: "Energetic", emoji: "🔥" },
  { id: "romantic", label: "Romantic", emoji: "💜" },
] as const;

export default function ToolSoundtrackSuggester() {
  const [concept, setConcept] = useState("");
  const [mood, setMood] = useState<string>("epic");
  const [duration, setDuration] = useState(30);

  const suggest = trpc.video.suggestSoundtrack.useMutation();

  const handleSuggest = () => {
    if (!concept.trim()) return;
    suggest.mutate({
      concept: concept.trim(),
      mood: mood as any,
      duration,
    });
  };

  return (
    <ToolPageLayout
      title="Soundtrack Suggester"
      description="AI-powered music and sound design recommendations for your video"
      icon={Music}
      gradient="from-pink-500 to-rose-600"
    >
      <div className="space-y-8">
        {/* Input */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <label className="text-sm font-medium text-foreground/80">Video Concept</label>
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe your video... e.g., 'A time-lapse of a futuristic city being built from the ground up, with flying vehicles and holographic billboards appearing as the city grows'"
              rows={5}
              className="bg-background/50 border-border/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">{concept.length}/2000 characters</p>
          </div>

          <div className="space-y-4">
            {/* Mood */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Mood</label>
              <div className="grid grid-cols-2 gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`px-3 py-2 rounded-lg text-xs text-left transition-all ${
                      mood === m.id
                        ? "bg-pink-500/15 text-pink-300 border border-pink-500/40"
                        : "bg-background/30 text-muted-foreground border border-border/40 hover:border-pink-500/30"
                    }`}
                  >
                    <span className="mr-1">{m.emoji}</span> {m.label}
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
                min={5}
                max={300}
                step={5}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground/60">
                <span>5s</span>
                <span>5:00</span>
              </div>
            </div>

            <Button
              onClick={handleSuggest}
              disabled={!concept.trim() || suggest.isPending}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700"
            >
              {suggest.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Suggest Soundtrack</>
              )}
            </Button>
          </div>
        </div>

        {/* Loading */}
        {suggest.isPending && (
          <div className="flex flex-col items-center py-16">
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-pink-500" />
              <Headphones className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-pink-300" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Composing the perfect soundtrack suggestion...</p>
          </div>
        )}

        {/* Results */}
        {suggest.data && suggest.data.status === "completed" && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Disc3 className="w-5 h-5 text-pink-400" />
                    {suggest.data.primaryGenre}
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {suggest.data.subGenres.map((sg: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{sg}</Badge>
                    ))}
                  </div>
                </div>
                <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/30">{suggest.data.tempo}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{suggest.data.description}</p>
              <p className="text-xs text-pink-400/70 mt-3">Mood Progression: {suggest.data.moodProgression}</p>
            </div>

            {/* Key Instruments */}
            <div className="rounded-xl border border-border/40 bg-card/50 p-6">
              <h4 className="text-sm font-semibold mb-3">Key Instruments</h4>
              <div className="flex flex-wrap gap-2">
                {suggest.data.keyInstruments.map((inst: string, i: number) => (
                  <Badge key={i} variant="outline" className="bg-background/50">🎵 {inst}</Badge>
                ))}
              </div>
            </div>

            {/* Reference Tracks */}
            {suggest.data.referenceTracks.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-card/50 p-6">
                <h4 className="text-sm font-semibold mb-3">Reference Tracks</h4>
                <div className="space-y-3">
                  {suggest.data.referenceTracks.map((track: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-background/30">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground/90">{track.title}</p>
                        <p className="text-xs text-muted-foreground">{track.artist}</p>
                        <p className="text-xs text-pink-400/60 mt-1">{track.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sound Effects */}
            {suggest.data.soundEffects.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-card/50 p-6">
                <h4 className="text-sm font-semibold mb-3">Suggested Sound Effects</h4>
                <div className="flex flex-wrap gap-2">
                  {suggest.data.soundEffects.map((sfx: string, i: number) => (
                    <Badge key={i} variant="outline" className="bg-background/50">🔊 {sfx}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Licensing Notes */}
            {suggest.data.licensingNotes && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-xs text-cyan-300/80">📋 {suggest.data.licensingNotes}</p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {suggest.data && suggest.data.status === "failed" && (
          <div className="text-center py-12 text-red-400">
            <p className="text-sm">Failed to generate soundtrack suggestion. Please try again.</p>
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
