// @ts-nocheck
import { useState } from "react";
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
  Presentation, Loader2, Download, Sparkles, ArrowRight,
  ArrowLeft, Image, FileText, Wand2, Layout,
} from "lucide-react";

const PRESENTATION_STYLES = [
  { value: "modern", label: "Modern Minimal", desc: "Clean lines, lots of whitespace" },
  { value: "corporate", label: "Corporate Pro", desc: "Professional and polished" },
  { value: "creative", label: "Creative Bold", desc: "Vibrant colors, dynamic layouts" },
  { value: "dark", label: "Dark Cinematic", desc: "Dark backgrounds, dramatic imagery" },
  { value: "startup", label: "Startup Pitch", desc: "Investor deck format" },
  { value: "education", label: "Educational", desc: "Clear diagrams, step-by-step" },
];

interface Slide {
  title: string;
  content: string;
  notes: string;
  imagePrompt: string;
  imageUrl?: string;
}

export default function PresentationBuilder() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState("8");
  const [style, setStyle] = useState("modern");
  const [audience, setAudience] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);

  const storyboardMutation = trpc.video.generateStoryboard.useMutation();

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);

    const prompt = `Create a ${slideCount}-slide presentation about: ${topic}.
Style: ${style}. ${audience ? `Target audience: ${audience}.` : ""}

For each slide, provide:
- A concise title (max 8 words)
- Bullet point content (3-5 key points, keep each under 15 words)
- Speaker notes (2-3 sentences of what to say)
- An image prompt describing a visual for this slide (descriptive, suitable for AI image generation)

Structure: Title slide, content slides, conclusion slide with call-to-action.`;

    storyboardMutation.mutate({
      concept: prompt,
      sceneCount: parseInt(slideCount),
      style: "cinematic",
      aspectRatio: "16:9",
      generateImages: true,
    }, {
      onSuccess: (data) => {
        if (data.status === "completed" && data.scenes) {
          const newSlides = data.scenes.map((scene: any, i: number) => ({
            title: scene.title || `Slide ${i + 1}`,
            content: scene.description || "",
            notes: scene.cameraAngle || "",
            imagePrompt: scene.visualDescription || scene.description || "",
            imageUrl: scene.imageUrl || undefined,
          }));
          setSlides(newSlides);
          setCurrentSlide(0);
          toast.success(`${newSlides.length} slides generated!`);
        }
        setGenerating(false);
      },
      onError: (err) => {
        toast.error(err.message);
        setGenerating(false);
      },
    });
  };

  const generateSlideImage = async (index: number) => {
    if (!slides[index]?.imagePrompt) return;
    setGeneratingImages(true);
    try {
      const result = await fetch("/api/trpc/tools.upscale", { method: "POST" }); // placeholder
      toast.info("Slide image generation launching soon — stay tuned!");
    } catch {
      toast.error("Failed to generate slide image");
    }
    setGeneratingImages(false);
  };


  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
            <Presentation className="h-3 w-3" />
            AI Presentations
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Presentation{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Builder
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            Describe your topic and AI creates a full slide deck with content, speaker notes, and images.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-6xl">
        {slides.length === 0 ? (
          /* Input form */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-cyan-400" />
                  Create Your Presentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">What's it about?</label>
                  <Textarea
                    placeholder="e.g. 'Q4 2026 company performance review with key metrics, challenges, and 2027 roadmap'"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={3}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Number of Slides</label>
                    <Select value={slideCount} onValueChange={setSlideCount}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["5", "8", "10", "12", "15", "20"].map((n) => (
                          <SelectItem key={n} value={n}>{n} slides</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Visual Style</label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESENTATION_STYLES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Target Audience (optional)</label>
                  <Input
                    placeholder="e.g. 'Board of directors', 'University students', 'Sales team'"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="bg-white/5 border-white/10"
                  />
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={!topic.trim() || generating}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                >
                  {generating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Generating Slides...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Generate Presentation</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Slide viewer */
          <div className="space-y-6">
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button variant="outline" className="gap-2 bg-transparent" onClick={() => { setSlides([]); setCurrentSlide(0); }}>
                <ArrowLeft className="h-4 w-4" /> New Presentation
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Slide {currentSlide + 1} of {slides.length}</span>
              </div>
              <Button variant="outline" className="gap-2 bg-transparent" onClick={() => toast.info("PDF export launching soon — stay tuned!")}>
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            </div>

            {/* Slide thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {slides.map((slide, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`flex-shrink-0 w-24 h-14 rounded-lg border text-[8px] p-1.5 text-left overflow-hidden transition-all ${
                    i === currentSlide
                      ? "border-cyan-500 bg-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <p className="font-bold truncate">{slide.title}</p>
                </button>
              ))}
            </div>

            {/* Current slide */}
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Slide preview */}
              <div className="lg:col-span-2">
                <Card className="bg-white/5 border-white/10 overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-12 flex flex-col justify-center">
                    {currentSlide === 0 ? (
                      /* Title slide */
                      <div className="text-center">
                        <h2 className="text-2xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                          {slides[0]?.title}
                        </h2>
                        <p className="text-sm md:text-base text-white/60">{slides[0]?.content?.split("\n")[0]}</p>
                      </div>
                    ) : (
                      /* Content slide */
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold mb-4 text-white">
                          {slides[currentSlide]?.title}
                        </h2>
                        <div className="space-y-2">
                          {slides[currentSlide]?.content?.split("\n").filter(Boolean).map((line, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 flex-shrink-0" />
                              <p className="text-sm text-white/80">{line.replace(/^[-•*]\s*/, "")}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Slide navigation buttons */}
                <div className="flex justify-between mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    disabled={currentSlide === 0}
                    onClick={() => setCurrentSlide((s) => s - 1)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    disabled={currentSlide === slides.length - 1}
                    onClick={() => setCurrentSlide((s) => s + 1)}
                  >
                    Next <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Slide details panel */}
              <div className="space-y-4">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      Speaker Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {slides[currentSlide]?.notes || "No speaker notes for this slide."}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Image className="h-4 w-4 text-cyan-400" />
                      Slide Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {slides[currentSlide]?.imageUrl ? (
                      <img loading="lazy" src={slides[currentSlide].imageUrl} alt="Slide visual" className="w-full rounded-lg" />
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{slides[currentSlide]?.imagePrompt}</p>
                        <Button size="sm" variant="outline" className="w-full bg-transparent text-xs gap-1" onClick={() => generateSlideImage(currentSlide)}>
                          <Sparkles className="h-3 w-3" /> Generate Image
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Layout className="h-4 w-4 text-cyan-400" />
                      Edit Slide
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Input
                      value={slides[currentSlide]?.title || ""}
                      onChange={(e) => {
                        const updated = [...slides];
                        updated[currentSlide] = { ...updated[currentSlide], title: e.target.value };
                        setSlides(updated);
                      }}
                      className="bg-white/5 border-white/10 text-sm"
                      placeholder="Slide title"
                    />
                    <Textarea
                      value={slides[currentSlide]?.content || ""}
                      onChange={(e) => {
                        const updated = [...slides];
                        updated[currentSlide] = { ...updated[currentSlide], content: e.target.value };
                        setSlides(updated);
                      }}
                      className="bg-white/5 border-white/10 text-xs"
                      rows={4}
                      placeholder="Slide content (one point per line)"
                    />
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
