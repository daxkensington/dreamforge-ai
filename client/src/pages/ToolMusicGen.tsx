import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Music, Loader2, Copy, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const genres = [
  { value: "ambient", label: "Ambient", icon: "🌙" },
  { value: "electronic", label: "Electronic", icon: "🎛️" },
  { value: "cinematic", label: "Cinematic", icon: "🎬" },
  { value: "lo-fi", label: "Lo-Fi", icon: "📻" },
  { value: "jazz", label: "Jazz", icon: "🎷" },
  { value: "classical", label: "Classical", icon: "🎻" },
  { value: "rock", label: "Rock", icon: "🎸" },
  { value: "hip-hop", label: "Hip-Hop", icon: "🎤" },
  { value: "pop", label: "Pop", icon: "🎵" },
  { value: "world", label: "World", icon: "🌍" },
  { value: "custom", label: "Custom", icon: "✨" },
];

const moods = [
  { value: "happy", label: "Happy", icon: "😊" },
  { value: "sad", label: "Sad", icon: "😢" },
  { value: "epic", label: "Epic", icon: "⚔️" },
  { value: "relaxed", label: "Relaxed", icon: "😌" },
  { value: "tense", label: "Tense", icon: "😰" },
  { value: "mysterious", label: "Mysterious", icon: "🔮" },
  { value: "romantic", label: "Romantic", icon: "💕" },
  { value: "energetic", label: "Energetic", icon: "⚡" },
  { value: "dark", label: "Dark", icon: "🌑" },
  { value: "hopeful", label: "Hopeful", icon: "🌅" },
];

const durations = [
  { value: "15" as const, label: "15s", desc: "Short loop" },
  { value: "30" as const, label: "30s", desc: "Quick piece" },
  { value: "60" as const, label: "60s", desc: "Full section" },
  { value: "120" as const, label: "120s", desc: "Extended" },
];

export default function ToolMusicGen() {
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("ambient");
  const [mood, setMood] = useState("relaxed");
  const [duration, setDuration] = useState<"15" | "30" | "60" | "120">("30");
  const [instruments, setInstruments] = useState("");
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.tools.musicGen.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.title) { setResult(data); toast.success("Music composition generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="AI Music Generator" description="Compose original music with AI" icon={Music} gradient="from-pink-500 to-purple-400">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-[10px] text-muted-foreground mb-2">Example output:</p>
          <img loading="lazy" src="/showcase/tool-music.jpg" alt="AI music composition" className="w-full rounded-lg max-h-48 object-cover" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Describe Your Music</Label>
                  <Textarea placeholder="e.g., A dreamy sunset soundtrack with gentle piano and soft synth pads..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm" rows={3} />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Genre</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {genres.map((g) => (
                      <button key={g.value} onClick={() => setGenre(g.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${genre === g.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-sm">{g.icon}</span>
                        <span className="text-xs font-medium">{g.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Mood</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {moods.map((m) => (
                      <button key={m.value} onClick={() => setMood(m.value)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left ${mood === m.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-sm">{m.icon}</span>
                        <span className="text-xs font-medium">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Duration</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {durations.map((d) => (
                      <button key={d.value} onClick={() => setDuration(d.value)}
                        className={`flex flex-col items-center gap-0.5 p-3 rounded-xl border-2 transition-all ${duration === d.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{d.label}</span>
                        <span className="text-[10px] text-muted-foreground">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Instruments (optional)</Label>
                  <Input placeholder="e.g., piano, strings, synth pad..." value={instruments} onChange={(e) => setInstruments(e.target.value)} className="text-sm" />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResult(null); mutation.mutate({ description, genre: genre as any, mood: mood as any, duration, instruments: instruments || undefined }); }} disabled={!description.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Composing...</> : <><Sparkles className="h-4 w-4 mr-2" />Compose Music</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setDescription(""); setInstruments(""); setResult(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50">
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-400" /><p className="text-sm text-muted-foreground">Composing your music...</p>
                    </motion.div>
                  ) : result ? (
                    <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold">{result.title}</h3>
                          <p className="text-sm text-muted-foreground">{result.bpm} BPM · Key of {result.key} · {duration}s</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(result, null, 2)); toast.success("Copied!"); }}>
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      </div>

                      {result.sections?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Sections</h4>
                          <div className="grid gap-2">
                            {result.sections.map((section: any, i: number) => (
                              <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{section.name}</p>
                                  <p className="text-xs text-muted-foreground">{section.description}</p>
                                </div>
                                <Badge variant="secondary" className="text-xs">{section.duration || section.bars}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.mixNotes && (
                        <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                          <h4 className="text-sm font-medium mb-2">Mix Notes</h4>
                          <p className="text-sm text-muted-foreground">{result.mixNotes}</p>
                        </div>
                      )}

                      {result.references?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">References</h4>
                          <div className="flex flex-wrap gap-2">
                            {result.references.map((ref: string, i: number) => (
                              <Badge key={i} variant="secondary">{ref}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-16 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4"><Music className="h-8 w-8 text-pink-400" /></div>
                      <h3 className="text-lg font-medium mb-2">AI Music Composer</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Describe the music you want and get a detailed composition blueprint with structure, instruments, and mix notes.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
