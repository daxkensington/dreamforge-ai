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
  { value: "reggae", label: "Reggae", emoji: "🇯🇲" },
  { value: "dancehall", label: "Dancehall", emoji: "🔥" },
  { value: "afrobeats", label: "Afrobeats", emoji: "🥁" },
  { value: "electronic", label: "Electronic", emoji: "🎹" },
  { value: "house", label: "House", emoji: "🏠" },
  { value: "techno", label: "Techno", emoji: "⚡" },
  { value: "drill", label: "Drill", emoji: "🔫" },
  { value: "trap", label: "Trap", emoji: "💎" },
  { value: "lofi", label: "Lo-Fi", emoji: "☕" },
  { value: "jazz", label: "Jazz", emoji: "🎺" },
  { value: "blues", label: "Blues", emoji: "🎸" },
  { value: "indie", label: "Indie", emoji: "🎶" },
  { value: "country", label: "Country", emoji: "🤠" },
  { value: "latin", label: "Latin", emoji: "💃" },
  { value: "reggaeton", label: "Reggaeton", emoji: "🌴" },
  { value: "kpop", label: "K-Pop", emoji: "🇰🇷" },
  { value: "soul", label: "Soul", emoji: "❤️" },
  { value: "gospel", label: "Gospel", emoji: "🙏" },
  { value: "funk", label: "Funk", emoji: "🕺" },
  { value: "disco", label: "Disco", emoji: "🪩" },
  { value: "metal", label: "Metal", emoji: "🤘" },
  { value: "punk", label: "Punk", emoji: "💀" },
  { value: "folk", label: "Folk", emoji: "🪕" },
  { value: "classical", label: "Classical", emoji: "🎻" },
  { value: "ambient", label: "Ambient", emoji: "🌌" },
  { value: "phonk", label: "Phonk", emoji: "👹" },
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

const ERAS = [
  { value: "timeless", label: "Timeless" },
  { value: "60s", label: "60s Retro" },
  { value: "70s", label: "70s Classic" },
  { value: "80s", label: "80s Synthwave" },
  { value: "90s", label: "90s" },
  { value: "y2k", label: "Y2K" },
  { value: "modern", label: "Modern" },
  { value: "retro", label: "Retro Analog" },
];

const VOCAL_GENDERS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "duet", label: "Duet" },
  { value: "choir", label: "Choir / Group" },
  { value: "instrumental", label: "Instrumental (no vocals)" },
];

const VOCAL_CHARACTERS = [
  { value: "smooth", label: "Smooth" },
  { value: "powerful", label: "Powerful" },
  { value: "raspy", label: "Raspy" },
  { value: "whisper", label: "Whisper" },
  { value: "belt", label: "Belt" },
  { value: "airy", label: "Airy" },
  { value: "gritty", label: "Gritty" },
  { value: "soulful", label: "Soulful" },
];

const INSTRUMENTS = [
  { value: "piano", label: "Piano" },
  { value: "acoustic-guitar", label: "Acoustic Guitar" },
  { value: "electric-guitar", label: "Electric Guitar" },
  { value: "synth", label: "Synth" },
  { value: "strings", label: "Strings" },
  { value: "brass", label: "Brass" },
  { value: "drums", label: "Drums" },
  { value: "bass", label: "Bass" },
  { value: "saxophone", label: "Saxophone" },
  { value: "violin", label: "Violin" },
  { value: "organ", label: "Organ" },
  { value: "harmonica", label: "Harmonica" },
  { value: "banjo", label: "Banjo" },
  { value: "808s", label: "808s" },
];

const TIME_SIGS = ["4/4", "3/4", "6/8", "7/8", "5/4"];

export default function SongCreator() {
  const { user } = useAuth();
  const [step, setStep] = useState<"concept" | "lyrics" | "generate" | "result">("concept");

  // Concept inputs — multi-select blends (first = primary, rest = accents)
  const [concept, setConcept] = useState("");
  const [genres, setGenres] = useState<string[]>(["pop"]);
  const [moods, setMoods] = useState<string[]>(["happy"]);
  const [language, setLanguage] = useState("English");
  const [era, setEra] = useState<string>("timeless");

  // Lyrics
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [suggestedStyle, setSuggestedStyle] = useState("");

  // Production settings
  const [tempo, setTempo] = useState("medium");
  const [bpm, setBpm] = useState<number | "">("");
  const [vocalGender, setVocalGender] = useState("female");
  const [vocalCharacter, setVocalCharacter] = useState<string>("smooth");
  const [instrumentFocus, setInstrumentFocus] = useState<string[]>([]);
  const [instrumentalOnly, setInstrumentalOnly] = useState(false);
  const [timeSignature, setTimeSignature] = useState("4/4");
  const [songKey, setSongKey] = useState("");
  const [referenceArtists, setReferenceArtists] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Single-value conveniences used in the result badges + lyrics call.
  const primaryGenre = genres[0] ?? "pop";
  const primaryMood = moods[0] ?? "happy";

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
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    lyricsMutation.mutate({
      concept,
      genre: primaryGenre as any,
      genres: genres.length > 1 ? genres : undefined,
      mood: primaryMood as any,
      moods: moods.length > 1 ? moods : undefined,
      language,
      era: era as any,
    });
  };

  const handleGenerateSong = () => {
    if (!lyrics.trim()) return;
    if (!user) {
      window.location.href = getLoginUrl();
      return;
    }
    songMutation.mutate({
      lyrics,
      genre: primaryGenre,
      genres: genres.length > 1 ? genres : undefined,
      mood: primaryMood,
      moods: moods.length > 1 ? moods : undefined,
      tempo: tempo as any,
      bpm: bpm === "" ? undefined : Number(bpm),
      vocalGender: vocalGender as any,
      vocalCharacter: vocalCharacter as any,
      instrumentFocus: instrumentFocus.length ? (instrumentFocus as any) : undefined,
      instrumentalOnly: instrumentalOnly || vocalGender === "instrumental" || undefined,
      era: era as any,
      key: songKey.trim() || undefined,
      timeSignature: timeSignature as any,
      referenceArtists: referenceArtists.trim() || undefined,
      title,
    });
  };

  // Toggle an item in a multi-select array, respecting a max count.
  const toggleInArray = (
    arr: string[],
    setter: (v: string[]) => void,
    value: string,
    max: number,
  ) => {
    if (arr.includes(value)) {
      // Don't allow removing the last one — array must keep at least 1 item.
      if (arr.length <= 1) return;
      setter(arr.filter((v) => v !== value));
    } else if (arr.length < max) {
      setter([...arr, value]);
    } else {
      toast.error(`Max ${max} selections — remove one first`);
    }
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
              {["/showcase/tool-songcreator.jpg", "/showcase/tool-music-video.jpg", "/showcase/tool-captions.jpg"].map((img, i) => (
                <div key={i} className="h-20 w-20 rounded-xl overflow-hidden border border-white/10 opacity-70">
                  <img src={img} alt="AI generated showcase" className="w-full h-full object-cover" loading="lazy" />
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
        {/* Anon signup gate — browse freely, but the first step requires login
             since song-gen is expensive (MiniMax Music 2.5) and lyrics use
             credits too. Shown as a banner, not a blocker, so users can still
             browse the UI + see what's possible. */}
        {!user && step === "concept" && (
          <Card className="bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-purple-500/10 border-cyan-500/30 mb-6">
            <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Music className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="font-semibold mb-0.5">Sign in free to create songs</p>
                  <p className="text-sm text-muted-foreground">
                    Free plan includes 50 credits/day — enough to generate lyrics + one full song. Paid plans unlock unlimited.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  onClick={() => (window.location.href = getLoginUrl())}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white gap-2"
                >
                  Sign in free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="bg-transparent" asChild>
                  <a href="/pricing">See pricing</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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

                {/* Genre — multi-select up to 3 (first = primary, rest blend) */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Genre <span className="opacity-60">— pick up to 3 to blend</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      {genres.length}/3 · primary: <span className="text-cyan-300">{GENRES.find((g) => g.value === primaryGenre)?.label}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 -m-1">
                    {GENRES.map((g) => {
                      const selected = genres.includes(g.value);
                      const isPrimary = selected && g.value === primaryGenre;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => toggleInArray(genres, setGenres, g.value, 3)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            isPrimary
                              ? "bg-cyan-500/30 border-cyan-400 text-white font-medium"
                              : selected
                              ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {g.emoji} {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mood — multi-select up to 2 */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Mood <span className="opacity-60">— blend up to 2</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">{moods.length}/2</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MOODS.map((m) => {
                      const selected = moods.includes(m.value);
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => toggleInArray(moods, setMoods, m.value, 2)}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            selected
                              ? "bg-purple-500/20 border-purple-500/50 text-purple-200"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Era + Language */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Era / Vibe</label>
                    <Select value={era} onValueChange={setEra}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ERAS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Language</label>
                    <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="English" className="bg-white/5 border-white/10" />
                  </div>
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
              <CardContent className="space-y-5">
                {/* Tempo — preset + optional explicit BPM */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Tempo <span className="opacity-60">— or set exact BPM below</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { value: "slow", label: "Slow", sub: "60-80 BPM" },
                      { value: "medium", label: "Medium", sub: "90-120 BPM" },
                      { value: "fast", label: "Fast", sub: "130-170 BPM" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setTempo(t.value); setBpm(""); }}
                        className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                          tempo === t.value && bpm === ""
                            ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <div className="font-medium">{t.label}</div>
                        <div className="text-[10px] opacity-70">{t.sub}</div>
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={40}
                    max={220}
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Or enter exact BPM (40-220)"
                    className="bg-white/5 border-white/10 h-9 text-sm"
                  />
                </div>

                {/* Vocals — gender + character OR instrumental-only */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Vocal Type</label>
                    <Select value={vocalGender} onValueChange={setVocalGender}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOCAL_GENDERS.map((v) => (
                          <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Vocal Character
                    </label>
                    <Select
                      value={vocalCharacter}
                      onValueChange={setVocalCharacter}
                      disabled={vocalGender === "instrumental"}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 disabled:opacity-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOCAL_CHARACTERS.map((v) => (
                          <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Instrument focus — multi-select */}
                <div>
                  <div className="flex items-baseline justify-between mb-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Instruments to feature <span className="opacity-60">— pick up to 6</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground">{instrumentFocus.length}/6</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {INSTRUMENTS.map((i) => {
                      const selected = instrumentFocus.includes(i.value);
                      return (
                        <button
                          key={i.value}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setInstrumentFocus(instrumentFocus.filter((v) => v !== i.value));
                            } else if (instrumentFocus.length < 6) {
                              setInstrumentFocus([...instrumentFocus, i.value]);
                            } else {
                              toast.error("Max 6 instruments — remove one first");
                            }
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            selected
                              ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-200"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {i.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced toggle — key / time sig / reference artists */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {showAdvanced ? "▾ Hide advanced" : "▸ Show advanced (key, time signature, reference artists)"}
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 p-4 rounded-lg bg-white/[0.02] border border-white/10 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Key (optional)</label>
                          <Input
                            value={songKey}
                            onChange={(e) => setSongKey(e.target.value)}
                            placeholder="e.g. C major, A minor"
                            className="bg-white/5 border-white/10 h-9 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Time Signature</label>
                          <Select value={timeSignature} onValueChange={setTimeSignature}>
                            <SelectTrigger className="bg-white/5 border-white/10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_SIGS.map((ts) => (
                                <SelectItem key={ts} value={ts}>{ts}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                          Reference artists (optional)
                        </label>
                        <Input
                          value={referenceArtists}
                          onChange={(e) => setReferenceArtists(e.target.value)}
                          placeholder="e.g. similar to The Weeknd x Daft Punk"
                          maxLength={300}
                          className="bg-white/5 border-white/10 h-9 text-sm"
                        />
                      </div>
                    </div>
                  )}
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
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                      {genres.map((g) => (
                        <Badge key={g} className="bg-cyan-500/15 text-cyan-400 border-0">{g}</Badge>
                      ))}
                      {moods.map((m) => (
                        <Badge key={m} className="bg-purple-500/15 text-purple-400 border-0">{m}</Badge>
                      ))}
                      <Badge className="bg-blue-500/15 text-blue-400 border-0">
                        {vocalGender === "instrumental" ? "instrumental" : `${vocalCharacter} ${vocalGender} vocals`}
                      </Badge>
                      {bpm && <Badge className="bg-emerald-500/15 text-emerald-400 border-0">{bpm} BPM</Badge>}
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
