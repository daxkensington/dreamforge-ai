import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mic, Loader2, Download, Sparkles, RotateCcw, Play, Volume2 } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const voices = [
  { value: "alloy", label: "Alloy", desc: "Neutral, balanced" },
  { value: "echo", label: "Echo", desc: "Warm, conversational" },
  { value: "fable", label: "Fable", desc: "British, narrative" },
  { value: "onyx", label: "Onyx", desc: "Deep, authoritative" },
  { value: "nova", label: "Nova", desc: "Friendly, energetic" },
  { value: "shimmer", label: "Shimmer", desc: "Clear, expressive" },
];

export default function ToolTextToSpeech() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [speed, setSpeed] = useState(1.0);
  const [model, setModel] = useState("tts-1-hd");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const mutation = trpc.tools.textToSpeech.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.audioUrl) {
        setAudioUrl(data.audioUrl);
        toast.success("Speech generated!");
      } else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const isProcessing = mutation.isPending;
  const charCount = text.length;

  return (
    <ToolPageLayout title="Text-to-Speech" description="Generate natural voiceovers with AI" icon={Mic} gradient="from-sky-500 to-blue-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Text</Label>
                    <span className="text-xs text-muted-foreground">{charCount}/5000</span>
                  </div>
                  <Textarea
                    placeholder="Enter the text you want to convert to speech..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="text-sm min-h-[200px]"
                    maxLength={5000}
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setAudioUrl(null); mutation.mutate({ text, voice: voice as any, speed, model: model as any }); }}
                    disabled={!text.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Speech</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setText(""); setAudioUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* Audio Player */}
            <AnimatePresence>
              {audioUrl && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-border/50 border-sky-500/20 bg-sky-500/5">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                          <Volume2 className="h-5 w-5 text-sky-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Generated Audio</p>
                          <p className="text-xs text-muted-foreground">Voice: {voices.find(v => v.value === voice)?.label} · Speed: {speed}x</p>
                        </div>
                      </div>
                      <audio ref={audioRef} controls className="w-full" src={audioUrl} />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => audioRef.current?.play()}><Play className="h-4 w-4 mr-1" />Play</Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          const a = document.createElement("a");
                          a.href = audioUrl;
                          a.download = "dreamforge-speech.mp3";
                          a.click();
                        }}><Download className="h-4 w-4 mr-1" />Download MP3</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Voice</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {voices.map((v) => (
                      <button key={v.value} onClick={() => setVoice(v.value)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${voice === v.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <div className="h-8 w-8 rounded-full bg-sky-500/10 flex items-center justify-center">
                          <Mic className="h-4 w-4 text-sky-400" />
                        </div>
                        <div>
                          <span className="text-sm font-medium">{v.label}</span>
                          <p className="text-xs text-muted-foreground">{v.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Speed</Label>
                    <Badge variant="secondary">{speed}x</Badge>
                  </div>
                  <Slider value={[speed]} onValueChange={([v]) => setSpeed(Math.round(v * 100) / 100)} min={0.25} max={4.0} step={0.25} />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.25x (Slow)</span><span>1x (Normal)</span><span>4x (Fast)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quality</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tts-1">Standard</SelectItem>
                      <SelectItem value="tts-1-hd">HD (Higher Quality)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
