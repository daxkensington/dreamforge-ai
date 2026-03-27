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
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SocialPublish } from "@/components/SocialPublish";
import {
  Layout, Loader2, Download, Sparkles, ArrowLeft,
  Image, Type, ShoppingBag, Megaphone, Instagram,
  Youtube, Smartphone, FileText, Briefcase, Mail,
} from "lucide-react";

const TEMPLATE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "social", label: "Social Posts" },
  { id: "stories", label: "Stories" },
  { id: "ads", label: "Ads & Banners" },
  { id: "print", label: "Print" },
  { id: "business", label: "Business" },
  { id: "youtube", label: "YouTube" },
];

const IMAGE_TEMPLATES = [
  // Social Posts
  { id: "ig-post", name: "Instagram Post", desc: "Square post with text overlay", category: "social", aspect: "1:1", size: "1080x1080", icon: Image, color: "from-purple-500 to-pink-500", prompt: "Beautiful social media post design, clean layout, modern typography, branded visual, engaging, professional" },
  { id: "ig-carousel", name: "Instagram Carousel", desc: "Multi-slide carousel post", category: "social", aspect: "1:1", size: "1080x1080", icon: Layout, color: "from-orange-500 to-pink-500", prompt: "Instagram carousel slide design, consistent branding, informative, clean layout, numbered" },
  { id: "fb-post", name: "Facebook Post", desc: "Landscape post with engagement", category: "social", aspect: "16:9", size: "1200x630", icon: Image, color: "from-blue-600 to-blue-500", prompt: "Facebook post graphic, eye-catching visual, clear message, engagement-driving, professional design" },
  { id: "twitter-post", name: "Twitter/X Post", desc: "Wide format with bold text", category: "social", aspect: "16:9", size: "1600x900", icon: Type, color: "from-slate-600 to-slate-500", prompt: "Twitter post graphic, bold typography, clean background, shareable, impactful message" },
  { id: "linkedin-post", name: "LinkedIn Post", desc: "Professional content graphic", category: "social", aspect: "1:1", size: "1080x1080", icon: Briefcase, color: "from-blue-700 to-blue-600", prompt: "Professional LinkedIn post graphic, corporate style, data visualization, thought leadership" },
  { id: "pinterest-pin", name: "Pinterest Pin", desc: "Tall pin format", category: "social", aspect: "2:3", size: "1000x1500", icon: Image, color: "from-red-500 to-red-600", prompt: "Tall Pinterest pin design, visually rich, save-worthy, lifestyle, aspirational, detailed" },

  // Stories
  { id: "ig-story", name: "Instagram Story", desc: "Full-screen story with stickers", category: "stories", aspect: "9:16", size: "1080x1920", icon: Smartphone, color: "from-purple-500 to-orange-400", prompt: "Instagram story design, full screen, bold text, sticker-style elements, gradient background, interactive" },
  { id: "fb-story", name: "Facebook Story", desc: "Mobile-first story", category: "stories", aspect: "9:16", size: "1080x1920", icon: Smartphone, color: "from-blue-500 to-purple-500", prompt: "Facebook story graphic, mobile full screen, simple clear message, vibrant, sharable" },
  { id: "whatsapp-status", name: "WhatsApp Status", desc: "Quick status update", category: "stories", aspect: "9:16", size: "1080x1920", icon: Smartphone, color: "from-green-500 to-emerald-500", prompt: "WhatsApp status image, clean design, personal message, good morning or motivational, warm" },

  // Ads & Banners
  { id: "fb-ad", name: "Facebook Ad", desc: "High-converting ad creative", category: "ads", aspect: "1:1", size: "1080x1080", icon: Megaphone, color: "from-blue-500 to-cyan-500", prompt: "High-converting Facebook ad creative, product showcase, clear CTA button, urgency, professional" },
  { id: "google-display", name: "Google Display Ad", desc: "Leaderboard banner", category: "ads", aspect: "728:90", size: "728x90", icon: Megaphone, color: "from-amber-500 to-yellow-500", prompt: "Google display ad banner, leaderboard format, brand logo, clear offer, CTA button, minimal" },
  { id: "web-banner", name: "Website Banner", desc: "Hero section banner", category: "ads", aspect: "21:9", size: "1920x820", icon: Layout, color: "from-cyan-500 to-blue-500", prompt: "Website hero banner, stunning visual, headline overlay, gradient, modern web design, professional" },
  { id: "email-header", name: "Email Header", desc: "Newsletter banner", category: "ads", aspect: "3:1", size: "600x200", icon: Mail, color: "from-emerald-500 to-teal-500", prompt: "Email newsletter header, clean branded design, company logo placement, professional, warm" },

  // Print
  { id: "business-card", name: "Business Card", desc: "Professional contact card", category: "print", aspect: "3.5:2", size: "1050x600", icon: Briefcase, color: "from-slate-600 to-zinc-500", prompt: "Modern business card design, minimalist, premium feel, contact info layout, elegant typography" },
  { id: "flyer", name: "Event Flyer", desc: "A4 promotional flyer", category: "print", aspect: "1:1.414", size: "2480x3508", icon: FileText, color: "from-violet-500 to-purple-500", prompt: "Event flyer design, eye-catching, date and venue prominent, exciting, professional layout" },
  { id: "poster", name: "Poster", desc: "Large format poster", category: "print", aspect: "2:3", size: "2000x3000", icon: Image, color: "from-red-500 to-orange-500", prompt: "Bold poster design, large impactful imagery, minimal text, gallery quality, artistic" },
  { id: "menu", name: "Restaurant Menu", desc: "Food menu layout", category: "print", aspect: "1:1.414", size: "2480x3508", icon: FileText, color: "from-amber-600 to-orange-500", prompt: "Elegant restaurant menu design, food categories, pricing layout, premium feel, appetizing" },

  // Business
  { id: "invoice", name: "Invoice", desc: "Professional invoice", category: "business", aspect: "1:1.414", size: "2480x3508", icon: FileText, color: "from-blue-500 to-indigo-500", prompt: "Clean professional invoice template, company branding, itemized layout, total highlighted" },
  { id: "proposal-cover", name: "Proposal Cover", desc: "Business proposal cover", category: "business", aspect: "1:1.414", size: "2480x3508", icon: Briefcase, color: "from-cyan-600 to-blue-600", prompt: "Professional business proposal cover page, modern design, company logo, project title, elegant" },
  { id: "certificate", name: "Certificate", desc: "Award or completion cert", category: "business", aspect: "1.414:1", size: "3508x2480", icon: FileText, color: "from-amber-500 to-yellow-500", prompt: "Elegant certificate design, gold accents, formal typography, achievement, border decoration" },

  // YouTube
  { id: "yt-thumbnail", name: "YouTube Thumbnail", desc: "Click-worthy thumbnail", category: "youtube", aspect: "16:9", size: "1280x720", icon: Youtube, color: "from-red-500 to-red-600", prompt: "Eye-catching YouTube thumbnail, bold face reaction, bright colors, large text, high contrast, click-worthy" },
  { id: "yt-banner", name: "Channel Banner", desc: "YouTube channel art", category: "youtube", aspect: "16:9", size: "2560x1440", icon: Youtube, color: "from-red-600 to-red-700", prompt: "YouTube channel banner, branded design, schedule info, social links area, clean professional" },
  { id: "yt-endscreen", name: "End Screen", desc: "Video end screen overlay", category: "youtube", aspect: "16:9", size: "1920x1080", icon: Youtube, color: "from-red-500 to-purple-500", prompt: "YouTube end screen overlay, subscribe button area, video suggestion boxes, clean layout, branded" },
];

export default function ImageTemplates() {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  const template = IMAGE_TEMPLATES.find((t) => t.id === selectedTemplate);
  const filtered = selectedCategory === "all" ? IMAGE_TEMPLATES : IMAGE_TEMPLATES.filter((t) => t.category === selectedCategory);

  const generateMutation = trpc.generation.create.useMutation({
    onSuccess: (data) => {
      if (data?.imageUrl) {
        setResultUrl(data.imageUrl);
        toast.success("Template generated!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!template) return;
    const fullPrompt = `${template.prompt}. ${customText ? `Custom content: ${customText}.` : ""} ${brandName ? `Brand: ${brandName}.` : ""} Size: ${template.size}. High quality, professional design.`;
    generateMutation.mutate({
      prompt: fullPrompt,
      style: "photorealistic",
      aspectRatio: template.aspect,
    });
  };


  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-blue-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-3">
            <Layout className="h-3 w-3" />
            Design Templates
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Image{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Templates
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            {IMAGE_TEMPLATES.length} AI-powered templates for social posts, stories, ads, thumbnails, business cards, and more.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-6xl">
        {!selectedTemplate ? (
          <>
            {/* Category filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                      : "bg-white/5 text-muted-foreground border border-white/10 hover:border-white/20"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mb-4">{filtered.length} templates</p>

            {/* Template grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <button onClick={() => setSelectedTemplate(t.id)} className="w-full text-left group">
                    <Card className="bg-white/5 border-white/10 hover:border-cyan-500/30 transition-all overflow-hidden">
                      <div className={`h-24 bg-gradient-to-br ${t.color} opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center`}>
                        <t.icon className="h-8 w-8 text-white/80" />
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-xs mb-0.5">{t.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                        <Badge className="mt-2 bg-white/10 text-white/60 border-0 text-[9px]">{t.size}</Badge>
                      </CardContent>
                    </Card>
                  </button>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          /* Template editor */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
            <Button variant="outline" className="bg-transparent gap-2" onClick={() => { setSelectedTemplate(null); setResultUrl(""); }}>
              <ArrowLeft className="h-4 w-4" /> Back to Templates
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Settings */}
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${template?.color} flex items-center justify-center`}>
                      {template && <template.icon className="h-6 w-6 text-white" />}
                    </div>
                    <div>
                      <h2 className="font-bold">{template?.name}</h2>
                      <div className="flex gap-2">
                        <Badge className="bg-white/10 border-0 text-[10px]">{template?.size}</Badge>
                        <Badge className="bg-white/10 border-0 text-[10px]">{template?.aspect}</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Your Text / Content</label>
                    <Textarea
                      placeholder="What should this template say? e.g. '50% OFF Summer Sale — This Weekend Only!'"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={3}
                      className="bg-white/5 border-white/10"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Brand Name (optional)</label>
                    <Input
                      placeholder="Your brand or business name"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generateMutation.isPending}
                    className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                  >
                    {generateMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Generate {template?.name}</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Right: Preview */}
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  {resultUrl ? (
                    <div className="space-y-4">
                      <img src={resultUrl} alt={template?.name} className="w-full rounded-lg" />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 gap-2 bg-transparent text-xs" asChild>
                          <a href={resultUrl} download={`${template?.id}.png`}>
                            <Download className="h-3 w-3" /> Download
                          </a>
                        </Button>
                      </div>
                      <SocialPublish contentUrl={resultUrl} contentType="image" title={template?.name} />
                    </div>
                  ) : generateMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mb-3" />
                      <p className="text-sm">Generating your design...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                        <Image className="h-7 w-7 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm text-muted-foreground">Preview will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
