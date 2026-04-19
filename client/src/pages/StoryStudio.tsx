"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Wand2,
  BookOpen,
  Music,
  Download,
  Volume2,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShareButton } from "@/components/ShareButton";

type Scene = {
  sceneNumber: number;
  narration: string;
  visual: string;
  mood: string;
  imageUrl: string | null;
};

type Story = {
  title: string;
  synopsis: string;
  mood: string;
  scenes: Scene[];
  audioGenerationId: number | null;
};

const STYLES = [
  { value: "cinematic", label: "Cinematic" },
  { value: "anime", label: "Anime" },
  { value: "watercolor", label: "Watercolor" },
  { value: "comic", label: "Comic Book" },
  { value: "noir", label: "Film Noir" },
  { value: "dreamlike", label: "Dreamlike" },
] as const;

const STARTERS = [
  "A lighthouse keeper discovers their lighthouse can speak — and it has secrets to share.",
  "An astronaut wakes up alone on Mars to find their crew has left a single mysterious note.",
  "A retired chef opens a tiny restaurant that only serves people in their dreams.",
  "A street magician's tricks start working a little too well.",
  "Two strangers on a delayed flight invent the perfect heist — purely as a thought experiment.",
];

export default function StoryStudio() {
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("cinematic");
  const [sceneCount, setSceneCount] = useState(4);
  const [withMusic, setWithMusic] = useState(true);
  const [story, setStory] = useState<Story | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicStatus, setMusicStatus] = useState<"idle" | "pending" | "ready" | "failed">("idle");

  const create = trpc.story.create.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") {
        setStory(data as Story);
        if (data.audioGenerationId) setMusicStatus("pending");
        toast.success("Story ready!");
      } else {
        toast.error("Story generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  // Poll the audio status while music is generating.
  const audioQuery = trpc.story.getAudioStatus.useQuery(
    { audioGenerationId: story?.audioGenerationId ?? 0 },
    {
      enabled: !!story?.audioGenerationId && musicStatus === "pending",
      refetchInterval: 4000,
    },
  );

  useEffect(() => {
    if (!audioQuery.data) return;
    // audio_status enum uses "complete" (not "completed") — schema mismatch
    // with the generation table is intentional, so don't unify them.
    if (audioQuery.data.status === "complete" && audioQuery.data.audioUrl) {
      setMusicUrl(audioQuery.data.audioUrl);
      setMusicStatus("ready");
    } else if (audioQuery.data.status === "failed") {
      setMusicStatus("failed");
    }
  }, [audioQuery.data]);

  const isLoading = create.isPending;

  const handleGenerate = () => {
    const trimmed = idea.trim();
    if (trimmed.length < 10) {
      toast.error("Tell us a bit more — at least 10 characters.");
      return;
    }
    setStory(null);
    setMusicUrl(null);
    setMusicStatus("idle");
    create.mutate({
      idea: trimmed,
      style,
      sceneCount,
      aspectRatio: "16:9",
      withMusic,
    });
  };

  const cost = 5 + sceneCount * 5 + (withMusic ? 6 : 0);

  return (
    <PageLayout>
      <div className="container max-w-6xl py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-300 text-xs font-medium mb-4">
            <Sparkles className="h-3 w-3" /> One-Click Story
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Idea in. Illustrated story out.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Type one sentence. Get a 4-6 scene story with matching art and a
            custom soundtrack — in under a minute.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Your story idea
                  </Label>
                  <Textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder={STARTERS[0]}
                    rows={4}
                    className="resize-none"
                    maxLength={1000}
                    disabled={isLoading}
                  />
                  <div className="mt-2 space-y-1">
                    {STARTERS.slice(1).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setIdea(s)}
                        disabled={isLoading}
                        className="block w-full text-left text-[11px] px-2 py-1 rounded hover:bg-accent text-muted-foreground transition-colors disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Style</Label>
                    <Select value={style} onValueChange={(v: any) => setStyle(v)} disabled={isLoading}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1 block">Scenes</Label>
                    <Select
                      value={String(sceneCount)}
                      onValueChange={(v) => setSceneCount(Number(v))}
                      disabled={isLoading}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} scenes</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <label className="flex items-center justify-between text-sm cursor-pointer rounded-md p-2 hover:bg-accent/50">
                  <span className="flex items-center gap-2">
                    <Music className="h-4 w-4 text-cyan-400" />
                    Add custom soundtrack
                  </span>
                  <Switch
                    checked={withMusic}
                    onCheckedChange={setWithMusic}
                    disabled={isLoading}
                  />
                </label>

                <Button
                  onClick={handleGenerate}
                  disabled={isLoading || idea.trim().length < 10}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building your story…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Create story · {cost} credits
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Storyboard + {sceneCount} images{withMusic ? " + 30s music" : ""}.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Output */}
          <div className="lg:col-span-3">
            {!story && !isLoading && (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Your story will appear here.</p>
                </CardContent>
              </Card>
            )}

            {isLoading && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-cyan-400" />
                  <p className="font-medium mb-1">Building your story…</p>
                  <p className="text-sm text-muted-foreground">
                    Storyboard → images → music. ~30-60 seconds.
                  </p>
                </CardContent>
              </Card>
            )}

            {story && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold mb-1">{story.title}</h2>
                  <p className="text-sm text-muted-foreground">{story.synopsis}</p>
                </div>

                {/* Music player */}
                {story.audioGenerationId && (
                  <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                        <Volume2 className="h-5 w-5 text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {musicStatus === "pending" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Composing soundtrack…
                          </div>
                        )}
                        {musicStatus === "ready" && musicUrl && (
                          <audio src={musicUrl} controls className="w-full h-10" />
                        )}
                        {musicStatus === "failed" && (
                          <p className="text-sm text-amber-300">
                            Soundtrack generation failed. Story scenes are unaffected.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Scenes */}
                <div className="space-y-4">
                  {story.scenes.map((scene) => (
                    <motion.div
                      key={scene.sceneNumber}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: scene.sceneNumber * 0.05 }}
                    >
                      <Card>
                        <CardContent className="p-0 overflow-hidden">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                            <div className="md:col-span-1 aspect-video md:aspect-square bg-card/40 relative">
                              {scene.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={scene.imageUrl}
                                  alt={`Scene ${scene.sceneNumber}`}
                                  className="absolute inset-0 w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                                  Image failed
                                </div>
                              )}
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur text-white text-[11px] font-mono">
                                Scene {scene.sceneNumber}
                              </div>
                            </div>
                            <div className="md:col-span-2 p-5">
                              <p className="text-base leading-relaxed mb-2">{scene.narration}</p>
                              <p className="text-xs text-muted-foreground italic">
                                {scene.mood}
                              </p>
                              {scene.imageUrl && (
                                <a
                                  href={scene.imageUrl}
                                  download={`scene-${scene.sceneNumber}.png`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mt-3 transition-colors"
                                >
                                  <Download className="h-3 w-3" /> Download scene
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
