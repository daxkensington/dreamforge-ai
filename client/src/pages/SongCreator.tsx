// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Music, Mic, Sparkles, Loader2, Play, Pause, Download,
  FileText, ArrowRight, Wand2, Volume2,
} from "lucide-react";

const GENRES = [
  { value: "pop", label: "Pop", emoji: "🎵" },
  { value: "rock", label: "Rock", emoji: "🎸" },
  { value: "hiphop", label: "Hip Hop", emoji: "🎤" },
  { value: "rnb", label: "R&B", emoji: "🎷" },
  { value: "electronic", label: "Electronic", emoji: "🎹" },
  { value: "lofi", label: "Lo-Fi", emoji: "☕" },
  { value: "jazz", label: "Jazz", emoji: "🎺" },
  { value: "indie", label: "Indie", emoji: "🎶" },
  { value: "country", label: "Country", emoji: "🤠" },
  { value: "latin", label: "Latin", emoji: "💃" },
  { value: "soul", label: "Soul", emoji: "❤️" },
  { value: "funk", label: "Funk", emoji: "🕺" },
  { value: "metal", label: "Metal", emoji: "🤘" },
  { value: "classical", label: "Classical", emoji: "🎻" },
];

const MOODS = [
  { value: "happy", label: "Happy" },
  { value: "sad", label: "Sad" },
  { value: "energetic", label: "Energetic" },
  { value: "chill", label: "Chill" },
  { value: "dark", label: "Dark" },
  { value: "romantic", label: "Romantic" },
  { value: "empowering", label: "Empowering" },
  { value: "nostalgic", label: "Nostalgic" },
  { value: "dreamy", label: "Dreamy" },
  { value: "aggressive", label: "Aggressive" },
];

export default function SongCreator() {
  const { user } = useAuth();
  const [step, setStep] = useState<"concept" | "lyrics" | "generate" | "result">("concept");

  // Concept inputs
  const [concept, setConcept] = useState("");
  const [genre, setGenre] = useState("pop");
  const [mood, setMood] = useState("happy");
  const [language, setLanguage] = useState("English");

  // Lyrics
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [suggestedStyle, setSuggestedStyle] = useState("");

  // Song generation
  const [tempo, setTempo] = useState("medium");
  const [vocalStyle, setVocalStyle] = useState("female");

  // Result
  const [songUrl, setSongUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio();
      audioRef.current.addEventListener("ended", () => setIsPlaying(false));
    }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const lyricsMutation = trpc.song.generateLyrics.useMutation({
    onSuccess: (data) => {
      setTitle(data.title);
      setLyrics(data.lyrics);
      setSuggestedStyle(data.suggestedStyle);
      setStep("lyrics");
      toast.success("Lyrics generated!");
    },
    onError: (err) => toast.error(err.message),
  });

  const songMutation = trpc.song.generateSong.useMutation({
    onSuccess: (data) => {
      setSongUrl(data.songUrl);
      setStep("result");
      toast.success("Song created!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerateLyrics = () => {
    if (!concept.trim()) return;
    lyricsMutation.mutate({ concept, genre: genre as any, mood: mood as any, language });
  };

  const handleGenerateSong = () => {
    if (!lyrics.trim()) return;
    songMutation.mutate({
      lyrics,
      genre,
      mood,
      tempo: tempo as any,
      vocalStyle: vocalStyle as any,
      title,
    });
  };

  const togglePlay = () => {
    if (!audioRef.current || !songUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = songUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Music className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">AI Song Creator</h1>
          <p className="text-muted-foreground mb-6">Sign in to create original songs with AI</p>
          <Button asChild className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            <a href={getLoginUrl()}>Sign In to Get Started</a>
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
                <Music className="h-3 w-3" />
                AI Song Creator
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Create{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Original Songs
                </span>
              </h1>
              <p className="text-muted-foreground max-w-md">
                Describe your idea, pick a genre, and AI writes the lyrics and produces a full song with vocals.
              </p>
            </div>
            <div className="flex gap-2">
              {["/showcase/tool-music.jpg", "/showcase/tool-audio.jpg", "/showcase/tool-tts.jpg"].map((img, i) => (
                <div key={i} className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70">
                  <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-8">
            {["concept", "lyrics", "generate", "result"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-cyan-500 text-white" :
                  ["concept", "lyrics", "generate", "result"].indexOf(step) > i ? "bg-cyan-500/20 text-cyan-400" :
                  "bg-white/5 text-white/30"
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${step === s ? "text-cyan-400" : "text-muted-foreground"}`}>
                  {s === "concept" ? "Concept" : s === "lyrics" ? "Lyrics" : s === "generate" ? "Produce" : "Listen"}
                </span>
                {i < 3 && <div className="w-8 h-px bg-white/10" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {/* Step 1: Concept */}
        {step === "concept" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  What's your song about?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Describe your song idea... e.g. 'A summer love story about meeting someone at a beach bonfire, feeling free and alive under the stars'"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  rows={4}
                  className="bg-white/5 border-white/10"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Genre</label>
                    <Select value={genre} onValueChange={setGenre}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.emoji} {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Mood</label>
                    <Select value={mood} onValueChange={setMood}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MOODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Language</label>
                  <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English" className="bg-white/5 border-white/10" />
                </div>

                <Button
                  onClick={handleGenerateLyrics}
                  disabled={!concept.trim() || lyricsMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                >
                  {lyricsMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Writing Lyrics...</>
                  ) : (
                    <><FileText className="h-4 w-4" /> Generate Lyrics</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Lyrics Editor */}
        {step === "lyrics" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-cyan-400" />
                  Edit Your Lyrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Song Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-white/5 border-white/10 text-lg font-bold" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Lyrics (edit freely — use [verse], [chorus], [bridge] tags)</label>
                  <Textarea
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    rows={16}
                    className="bg-white/5 border-white/10 font-mono text-sm"
                  />
                </div>
                {suggestedStyle && (
                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                    <p className="text-xs text-muted-foreground mb-1">AI-suggested style:</p>
                    <p className="text-sm text-cyan-300">{suggestedStyle}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("concept")} className="bg-transparent">
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep("generate")}
                    disabled={!lyrics.trim()}
                    className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                  >
                    <ArrowRight className="h-4 w-4" /> Continue to Production
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Production Settings */}
        {step === "generate" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-cyan-400" />
                  Production Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Tempo</label>
                    <Select value={tempo} onValueChange={setTempo}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Slow (60-80 BPM)</SelectItem>
                        <SelectItem value="medium">Medium (90-120 BPM)</SelectItem>
                        <SelectItem value="fast">Fast (130-170 BPM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Vocal Style</label>
                    <Select value={vocalStyle} onValueChange={setVocalStyle}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male Vocals</SelectItem>
                        <SelectItem value="female">Female Vocals</SelectItem>
                        <SelectItem value="duet">Duet</SelectItem>
                        <SelectItem value="choir">Choir / Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview lyrics */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10 max-h-40 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-2">Lyrics preview:</p>
                  <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono">{lyrics.slice(0, 500)}{lyrics.length > 500 ? "..." : ""}</pre>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep("lyrics")} className="bg-transparent">
                    Back
                  </Button>
                  <Button
                    onClick={handleGenerateSong}
                    disabled={songMutation.isPending}
                    className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                  >
                    {songMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Producing Song... (this may take a minute)</>
                    ) : (
                      <><Music className="h-4 w-4" /> Produce Song</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Result */}
        {step === "result" && songUrl && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-cyan-400" />
                  {title || "Your Song"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Player */}
                <div className="flex items-center gap-4 p-6 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20">
                  <button
                    onClick={togglePlay}
                    className="h-14 w-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center hover:from-cyan-400 hover:to-blue-500 transition-colors shadow-lg shadow-cyan-500/20"
                  >
                    {isPlaying ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 text-white ml-1" />}
                  </button>
                  <div className="flex-1">
                    <p className="font-bold text-lg">{title || "Untitled Song"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-cyan-500/15 text-cyan-400 border-0">{genre}</Badge>
                      <Badge className="bg-purple-500/15 text-purple-400 border-0">{mood}</Badge>
                      <Badge className="bg-blue-500/15 text-blue-400 border-0">{vocalStyle} vocals</Badge>
                    </div>
                  </div>
                </div>

                {/* Audio element for native controls fallback */}
                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" className="bg-transparent gap-2" asChild>
                    <a href={songUrl} download={`${title || "song"}.mp3`}>
                      <Download className="h-4 w-4" /> Download
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-transparent gap-2"
                    onClick={() => {
                      setStep("concept");
                      setConcept("");
                      setLyrics("");
                      setTitle("");
                      setSongUrl("");
                    }}
                  >
                    <Music className="h-4 w-4" /> Create Another
                  </Button>
                  <Button className="flex-1 gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white" asChild>
                    <a href={`/tools/music-video?song=${encodeURIComponent(songUrl)}&title=${encodeURIComponent(title)}`}>
                      <Mic className="h-4 w-4" /> Create Music Video
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
