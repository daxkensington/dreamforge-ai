// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Smartphone, Film, Loader2, Play, Download, Upload, Sparkles,
  TrendingUp, ShoppingBag, MessageSquare, Music, Timer, Camera,
  Zap, ArrowRight, Video,
} from "lucide-react";

const TEMPLATES = [
  {
    id: "dance-trend",
    name: "Dance Trend",
    desc: "Trending dance video with your photo",
    icon: Music,
    color: "from-pink-500 to-rose-500",
    platform: "TikTok",
    aspect: "9:16",
    prompt: "Person dancing to a trending beat, dynamic camera angles, colorful lighting, high energy, viral dance trend style",
  },
  {
    id: "product-showcase",
    name: "Product Showcase",
    desc: "Cinematic product reveal with effects",
    icon: ShoppingBag,
    color: "from-cyan-500 to-blue-500",
    platform: "Reels",
    aspect: "9:16",
    prompt: "Cinematic product showcase, dramatic lighting, slow reveal, premium feel, floating product with particle effects",
  },
  {
    id: "talking-head",
    name: "Talking Head",
    desc: "Professional talking-head style video",
    icon: MessageSquare,
    color: "from-violet-500 to-purple-500",
    platform: "YouTube Shorts",
    aspect: "9:16",
    prompt: "Professional talking head video, clean background, good lighting, confident speaker, engaging and dynamic",
  },
  {
    id: "before-after",
    name: "Before & After",
    desc: "Dramatic transformation reveal",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
    platform: "Reels",
    aspect: "9:16",
    prompt: "Dramatic before and after transformation, split screen transition, smooth morph effect, satisfying reveal",
  },
  {
    id: "countdown",
    name: "Top 5 Countdown",
    desc: "Countdown list with transitions",
    icon: Timer,
    color: "from-emerald-500 to-teal-500",
    platform: "TikTok",
    aspect: "9:16",
    prompt: "Dynamic countdown video, bold numbers, energetic transitions between items, engaging pacing, trending format",
  },
  {
    id: "aesthetic-montage",
    name: "Aesthetic Montage",
    desc: "Dreamy montage with music sync",
    icon: Camera,
    color: "from-blue-500 to-indigo-500",
    platform: "Reels",
    aspect: "9:16",
    prompt: "Aesthetic montage video, dreamy color grading, smooth transitions, cinematic slow motion, mood-driven visuals",
  },
  {
    id: "tutorial-hook",
    name: "Tutorial Hook",
    desc: "Attention-grabbing tutorial opener",
    icon: Sparkles,
    color: "from-rose-500 to-pink-500",
    platform: "TikTok",
    aspect: "9:16",
    prompt: "Eye-catching tutorial intro, bold text overlays, step-by-step format, clean graphics, professional editing",
  },
  {
    id: "cinematic-intro",
    name: "Cinematic Intro",
    desc: "Epic movie-trailer style intro",
    icon: Film,
    color: "from-slate-500 to-zinc-500",
    platform: "YouTube",
    aspect: "16:9",
    prompt: "Epic cinematic intro, dramatic music, lens flares, dark moody atmosphere, text reveal with particles, movie trailer quality",
  },
  // ─── Business & Marketing ──────────────
  { id: "startup-pitch", name: "Startup Pitch", desc: "60-second startup pitch video", icon: Zap, color: "from-blue-600 to-cyan-500", platform: "LinkedIn", aspect: "16:9", prompt: "Professional startup pitch video, clean office background, confident presenter, key metrics and growth charts, investor-ready" },
  { id: "testimonial", name: "Customer Testimonial", desc: "Authentic customer review style", icon: MessageSquare, color: "from-emerald-500 to-green-500", platform: "Reels", aspect: "9:16", prompt: "Authentic customer testimonial, natural setting, genuine emotion, positive review, trust-building social proof" },
  { id: "sale-announcement", name: "Flash Sale", desc: "Urgent limited-time offer promo", icon: Timer, color: "from-red-500 to-orange-500", platform: "Stories", aspect: "9:16", prompt: "Urgent flash sale announcement, bold countdown timer, exciting deal reveal, scarcity urgency, vibrant colors, call to action" },
  { id: "brand-story", name: "Brand Story", desc: "Tell your brand origin story", icon: Film, color: "from-purple-600 to-indigo-500", platform: "YouTube", aspect: "16:9", prompt: "Emotional brand story video, founder journey, humble beginnings to success, cinematic storytelling, inspiring music" },
  { id: "behind-scenes", name: "Behind the Scenes", desc: "Raw authentic workspace footage", icon: Camera, color: "from-amber-600 to-yellow-500", platform: "TikTok", aspect: "9:16", prompt: "Authentic behind the scenes, raw workspace footage, creative process revealed, casual authentic vibe" },
  { id: "unboxing", name: "Unboxing", desc: "Satisfying product unboxing reveal", icon: ShoppingBag, color: "from-pink-500 to-rose-500", platform: "TikTok", aspect: "9:16", prompt: "Satisfying unboxing experience, premium packaging, slow reveal, ASMR-like quality, product details closeup" },
  // ─── Food & Lifestyle ──────────────
  { id: "recipe-reel", name: "Recipe Reel", desc: "Viral overhead cooking video", icon: Sparkles, color: "from-orange-500 to-amber-500", platform: "Reels", aspect: "9:16", prompt: "Overhead cooking video, ingredients laid out beautifully, step by step preparation, sizzling closeups, final plating reveal" },
  { id: "restaurant-promo", name: "Restaurant Promo", desc: "Mouthwatering food showcase", icon: Camera, color: "from-red-600 to-orange-500", platform: "TikTok", aspect: "9:16", prompt: "Mouthwatering food showcase, steam rising from dishes, slow motion pours, restaurant ambiance, warm lighting" },
  { id: "fitness-motivation", name: "Fitness Motivation", desc: "High-energy workout montage", icon: Zap, color: "from-green-500 to-emerald-500", platform: "Reels", aspect: "9:16", prompt: "High energy fitness montage, dramatic workout clips, sweat and determination, motivational, powerful music sync" },
  { id: "morning-routine", name: "Morning Routine", desc: "Aesthetic daily routine vlog", icon: Timer, color: "from-sky-500 to-blue-400", platform: "TikTok", aspect: "9:16", prompt: "Aesthetic morning routine, golden hour lighting, minimalist home, healthy breakfast, calm productive vibes" },
  // ─── Travel & Adventure ──────────────
  { id: "travel-montage", name: "Travel Montage", desc: "Wanderlust adventure compilation", icon: Camera, color: "from-teal-500 to-cyan-500", platform: "Reels", aspect: "9:16", prompt: "Epic travel montage, stunning landscapes, adventure moments, drone aerials, golden hour, wanderlust" },
  { id: "hotel-tour", name: "Hotel Tour", desc: "Luxury hotel room walkthrough", icon: Film, color: "from-amber-500 to-yellow-500", platform: "TikTok", aspect: "9:16", prompt: "Luxury hotel room tour, smooth walking camera, reveal each room, pool and amenities, premium vacation vibes" },
  { id: "city-guide", name: "City Guide", desc: "Quick city highlights reel", icon: Sparkles, color: "from-indigo-500 to-violet-500", platform: "Reels", aspect: "9:16", prompt: "Fast-paced city guide, iconic landmarks, street food, nightlife, hidden gems, local culture, energetic editing" },
  // ─── Real Estate ──────────────
  { id: "property-tour", name: "Property Tour", desc: "Real estate walkthrough video", icon: Film, color: "from-emerald-600 to-teal-500", platform: "Reels", aspect: "9:16", prompt: "Professional property tour, smooth drone exterior, walking interior tour, spacious rooms, natural light, premium home" },
  { id: "listing-ad", name: "Listing Ad", desc: "Quick property listing showcase", icon: ShoppingBag, color: "from-blue-600 to-indigo-500", platform: "Stories", aspect: "9:16", prompt: "Eye-catching property listing, key features highlighted, price reveal, modern home, call to action for viewing" },
  // ─── Education ──────────────
  { id: "explainer", name: "Explainer Video", desc: "Educational concept breakdown", icon: MessageSquare, color: "from-cyan-500 to-blue-500", platform: "YouTube Shorts", aspect: "9:16", prompt: "Engaging educational explainer, clear visual diagrams, step by step breakdown, animated graphics, easy to understand" },
  { id: "study-tips", name: "Study Tips", desc: "Quick study hack video", icon: Sparkles, color: "from-violet-500 to-purple-500", platform: "TikTok", aspect: "9:16", prompt: "Quick study tips video, aesthetic desk setup, productivity hacks, note-taking closeups, motivational student life" },
  // ─── Music & Entertainment ──────────────
  { id: "album-promo", name: "Album Promo", desc: "New music release announcement", icon: Music, color: "from-fuchsia-500 to-pink-500", platform: "Reels", aspect: "9:16", prompt: "Dynamic album promo, cover art reveal, audio visualizer effects, artist silhouette, neon lighting, hype energy" },
  { id: "concert-recap", name: "Concert Recap", desc: "Epic live performance highlights", icon: Music, color: "from-red-500 to-purple-500", platform: "TikTok", aspect: "9:16", prompt: "Epic concert recap, crowd energy, stage lighting, performer closeups, bass drops synced to cuts, festival vibes" },
  { id: "lyric-video", name: "Lyrics Visualizer", desc: "Animated lyrics on screen", icon: Music, color: "from-blue-500 to-purple-500", platform: "YouTube", aspect: "16:9", prompt: "Stylized lyric video, animated text flowing on screen, atmospheric background, synced to beat, kinetic typography" },
  // ─── Fashion & Beauty ──────────────
  { id: "ootd", name: "OOTD", desc: "Outfit of the day showcase", icon: Sparkles, color: "from-pink-500 to-fuchsia-500", platform: "TikTok", aspect: "9:16", prompt: "Outfit of the day showcase, stylish transitions between looks, mirror selfie angles, street style, fashion forward" },
  { id: "makeup-tutorial", name: "Makeup Tutorial", desc: "Beauty transformation timelapse", icon: Camera, color: "from-rose-500 to-pink-500", platform: "Reels", aspect: "9:16", prompt: "Makeup transformation timelapse, close up application shots, before and after reveal, beauty products, glam finish" },
  { id: "haul", name: "Shopping Haul", desc: "Try-on haul with reactions", icon: ShoppingBag, color: "from-violet-500 to-fuchsia-500", platform: "TikTok", aspect: "9:16", prompt: "Shopping haul video, excited unboxing, try-on transitions, honest reactions, aesthetic flatlay shots" },
  // ─── Gaming ──────────────
  { id: "game-highlight", name: "Game Highlight", desc: "Epic gaming moment clip", icon: Zap, color: "from-green-500 to-cyan-500", platform: "YouTube Shorts", aspect: "9:16", prompt: "Epic gaming highlight clip, screen recording style, clutch play moment, reaction cam overlay, victory celebration" },
  { id: "game-review", name: "Game Review", desc: "Quick game review format", icon: MessageSquare, color: "from-purple-500 to-indigo-500", platform: "TikTok", aspect: "9:16", prompt: "Quick game review, gameplay footage, pros and cons overlay, rating reveal, engaging commentary style" },
  // ─── Seasonal & Holiday ──────────────
  { id: "new-year", name: "New Year Countdown", desc: "NYE celebration video", icon: Timer, color: "from-yellow-500 to-amber-500", platform: "Reels", aspect: "9:16", prompt: "New Year countdown, fireworks, champagne toast, party atmosphere, glitter confetti, celebration energy, midnight" },
  { id: "valentines", name: "Valentine's Day", desc: "Romantic love story video", icon: Sparkles, color: "from-red-500 to-pink-500", platform: "TikTok", aspect: "9:16", prompt: "Romantic Valentine's video, rose petals, candlelit dinner, love story montage, heartfelt moments, soft focus" },
  { id: "halloween", name: "Halloween", desc: "Spooky transformation clip", icon: Zap, color: "from-orange-600 to-red-600", platform: "TikTok", aspect: "9:16", prompt: "Spooky Halloween transformation, costume reveal, eerie lighting, fog effects, jump scare ending, creative makeup" },
  { id: "christmas", name: "Christmas", desc: "Festive holiday celebration", icon: Sparkles, color: "from-red-500 to-green-500", platform: "Reels", aspect: "9:16", prompt: "Festive Christmas video, decorating tree, cozy fireplace, gift unwrapping, snow falling, warm holiday atmosphere" },
  // ─── Motivation & Quotes ──────────────
  { id: "motivation-quote", name: "Motivation Quote", desc: "Inspirational quote with visuals", icon: Zap, color: "from-amber-500 to-red-500", platform: "Reels", aspect: "9:16", prompt: "Inspirational quote video, powerful typography, dramatic nature backdrop, motivational, cinematic slow motion" },
  { id: "day-in-life", name: "Day in My Life", desc: "Lifestyle daily vlog format", icon: Camera, color: "from-sky-500 to-indigo-500", platform: "TikTok", aspect: "9:16", prompt: "Day in my life vlog, casual authentic moments, productive workflow, meals, evening wind down, aesthetic editing" },
  // ─── Professional ──────────────
  { id: "portfolio-reel", name: "Portfolio Reel", desc: "Creative work showcase", icon: Film, color: "from-slate-500 to-zinc-500", platform: "LinkedIn", aspect: "16:9", prompt: "Professional portfolio reel, best work samples, smooth transitions, clean typography, minimalist design, impressive" },
  { id: "job-post", name: "We're Hiring", desc: "Job opening announcement", icon: MessageSquare, color: "from-blue-500 to-cyan-500", platform: "LinkedIn", aspect: "1:1", prompt: "Eye-catching job posting video, company culture shots, team moments, benefits highlights, modern office, apply now CTA" },
  { id: "event-promo", name: "Event Promo", desc: "Upcoming event announcement", icon: Timer, color: "from-fuchsia-500 to-purple-500", platform: "Stories", aspect: "9:16", prompt: "Exciting event promo, date countdown, venue preview, speaker lineup, ticket urgency, vibrant energy" },
  // ─── Pet & Animal ──────────────
  { id: "pet-intro", name: "Meet My Pet", desc: "Adorable pet introduction", icon: Sparkles, color: "from-amber-500 to-orange-400", platform: "TikTok", aspect: "9:16", prompt: "Adorable pet introduction, cute close ups, playful moments, personality showcase, funny reactions, heartwarming" },
  // ─── Tech & Product ──────────────
  { id: "app-demo", name: "App Demo", desc: "Mobile app walkthrough", icon: Smartphone, color: "from-cyan-500 to-blue-600", platform: "YouTube Shorts", aspect: "9:16", prompt: "Sleek app demo, screen recording with hand, key features highlighted, smooth UI transitions, modern design" },
  { id: "tech-review", name: "Tech Review", desc: "Quick gadget review", icon: Zap, color: "from-zinc-500 to-slate-500", platform: "YouTube Shorts", aspect: "9:16", prompt: "Quick tech review, product closeups, specs overlay, comparison shots, verdict reveal, clean minimal aesthetic" },
  // ─── Meme & Viral ──────────────
  { id: "meme-reaction", name: "Meme Reaction", desc: "Trending meme format video", icon: Sparkles, color: "from-yellow-500 to-green-500", platform: "TikTok", aspect: "9:16", prompt: "Viral meme format, unexpected twist ending, relatable scenario, comedic timing, trending sound sync" },
  { id: "storytime", name: "Storytime", desc: "Dramatic personal story format", icon: MessageSquare, color: "from-purple-600 to-pink-500", platform: "TikTok", aspect: "9:16", prompt: "Dramatic storytime, engaging narrator, suspenseful pacing, emotional reveals, captivating hook opening" },
  { id: "get-ready", name: "Get Ready With Me", desc: "GRWM preparation montage", icon: Camera, color: "from-pink-400 to-rose-500", platform: "TikTok", aspect: "9:16", prompt: "Get ready with me, morning prep routine, skincare to outfit, mirror shots, aesthetic transitions, chatty vibe" },
];

export default function SocialTemplates() {
  const { user } = useAuth();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [customPrompt, setCustomPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const categories = [
    { value: "all", label: "All Templates" },
    { value: "trending", label: "Trending" },
    { value: "business", label: "Business" },
    { value: "food", label: "Food & Lifestyle" },
    { value: "travel", label: "Travel" },
    { value: "realestate", label: "Real Estate" },
    { value: "education", label: "Education" },
    { value: "music", label: "Music" },
    { value: "fashion", label: "Fashion" },
    { value: "gaming", label: "Gaming" },
    { value: "holiday", label: "Seasonal" },
    { value: "professional", label: "Professional" },
    { value: "viral", label: "Viral & Meme" },
  ];

  const categoryMap: Record<string, string[]> = {
    trending: ["dance-trend", "before-after", "countdown", "tutorial-hook", "aesthetic-montage", "meme-reaction", "storytime", "get-ready"],
    business: ["startup-pitch", "testimonial", "sale-announcement", "brand-story", "behind-scenes", "unboxing", "product-showcase"],
    food: ["recipe-reel", "restaurant-promo", "fitness-motivation", "morning-routine"],
    travel: ["travel-montage", "hotel-tour", "city-guide"],
    realestate: ["property-tour", "listing-ad"],
    education: ["explainer", "study-tips"],
    music: ["album-promo", "concert-recap", "lyric-video"],
    fashion: ["ootd", "makeup-tutorial", "haul"],
    gaming: ["game-highlight", "game-review"],
    holiday: ["new-year", "valentines", "halloween", "christmas"],
    professional: ["portfolio-reel", "job-post", "event-promo", "talking-head", "cinematic-intro"],
    viral: ["meme-reaction", "storytime", "get-ready", "day-in-life", "motivation-quote", "pet-intro"],
  };

  const filteredTemplates = selectedCategory === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => categoryMap[selectedCategory]?.includes(t.id));

  const template = TEMPLATES.find((t) => t.id === selectedTemplate);

  const videoMutation = trpc.tools.textToVideo.useMutation({
    onSuccess: (data) => {
      if (data.videoUrl) {
        setResultUrl(data.videoUrl);
        toast.success("Video generated!");
      } else {
        toast.error(data.error || "Generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!template) return;
    const prompt = customPrompt
      ? `${template.prompt}. Additional details: ${customPrompt}`
      : template.prompt;

    videoMutation.mutate({
      prompt,
      duration: "8",
      aspectRatio: template.aspect as any,
      style: "cinematic",
    });
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="container py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Social Video Templates</h1>
          <p className="text-muted-foreground mb-6">Sign in to create viral social media videos</p>
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
        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/15 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-medium mb-3">
            <TrendingUp className="h-3 w-3" />
            Trending Templates
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Social Video{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Templates
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            50+ one-click video templates for TikTok, Reels, Shorts, LinkedIn, and more. Pick a category, customize, generate.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-6xl">
        {!selectedTemplate ? (
          <>
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedCategory === cat.value
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "bg-white/5 text-muted-foreground border border-white/10 hover:border-white/20"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-4">{filteredTemplates.length} templates</p>
          {/* Template Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTemplates.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <button
                  onClick={() => setSelectedTemplate(t.id)}
                  className="w-full text-left group"
                >
                  <Card className="bg-white/5 border-white/10 hover:border-cyan-500/30 transition-all duration-300 overflow-hidden">
                    <div className={`h-32 bg-gradient-to-br ${t.color} opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                      <t.icon className="h-12 w-12 text-white/80" />
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm">{t.name}</h3>
                        <Badge className="bg-white/10 text-white/60 border-0 text-[10px]">{t.platform}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            ))}
          </div>
          </>
        ) : (
          /* Template Editor */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
            <Button variant="outline" className="bg-transparent gap-2" onClick={() => { setSelectedTemplate(null); setResultUrl(""); }}>
              <ArrowRight className="h-4 w-4 rotate-180" /> Back to Templates
            </Button>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-6">
                {/* Template header */}
                <div className="flex items-center gap-4">
                  <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${template?.color} flex items-center justify-center`}>
                    {template && <template.icon className="h-7 w-7 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{template?.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-white/10 border-0 text-xs">{template?.platform}</Badge>
                      <Badge className="bg-white/10 border-0 text-xs">{template?.aspect}</Badge>
                    </div>
                  </div>
                </div>

                {/* Custom prompt */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Customize (Optional)</label>
                  <Textarea
                    placeholder="Add custom details... e.g. 'Use neon lighting and a city background'"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                {/* Generate */}
                <Button
                  onClick={handleGenerate}
                  disabled={videoMutation.isPending}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                >
                  {videoMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating Video...</>
                  ) : (
                    <><Video className="h-4 w-4" /> Generate {template?.name} Video</>
                  )}
                </Button>

                {/* Result */}
                {resultUrl && (
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className={`rounded-xl overflow-hidden bg-black ${template?.aspect === "9:16" ? "aspect-[9/16] max-w-[280px] mx-auto" : template?.aspect === "1:1" ? "aspect-square max-w-[400px] mx-auto" : "aspect-video"}`}>
                      <video src={resultUrl} controls className="w-full h-full object-contain" />
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" className="gap-2 bg-transparent" asChild>
                        <a href={resultUrl} download={`${template?.id}-video.mp4`}>
                          <Download className="h-4 w-4" /> Download
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
