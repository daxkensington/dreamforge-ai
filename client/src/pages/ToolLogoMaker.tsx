import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Hexagon, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const iconTypes = [
  { value: "wordmark", label: "Wordmark" },
  { value: "lettermark", label: "Lettermark" },
  { value: "icon-text", label: "Icon + Text" },
  { value: "emblem", label: "Emblem" },
  { value: "abstract", label: "Abstract Symbol" },
];

const logoStyles = [
  { value: "minimal", label: "Minimal", desc: "Clean & simple" },
  { value: "modern", label: "Modern", desc: "Sleek & professional" },
  { value: "vintage", label: "Vintage", desc: "Classic & heritage" },
  { value: "luxury", label: "Luxury", desc: "Elegant & premium" },
  { value: "playful", label: "Playful", desc: "Fun & colorful" },
  { value: "tech", label: "Tech", desc: "Futuristic & digital" },
  { value: "organic", label: "Organic", desc: "Natural & flowing" },
  { value: "geometric", label: "Geometric", desc: "Abstract shapes" },
  { value: "hand-drawn", label: "Hand-Drawn", desc: "Artisanal craft" },
  { value: "3d", label: "3D", desc: "Glossy & dimensional" },
];

export default function ToolLogoMaker() {
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [style, setStyle] = useState("modern");
  const [colorScheme, setColorScheme] = useState("");
  const [industry, setIndustry] = useState("");
  const [iconDescription, setIconDescription] = useState("");
  const [iconType, setIconType] = useState("icon-text");
  const [generateVariations, setGenerateVariations] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.logoMaker.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Logo generated!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!brandName.trim()) { toast.error("Enter a brand name"); return; }
    setResultUrl(null);
    const iconTypeLabel = iconTypes.find((t) => t.value === iconType)?.label || "Icon + Text";
    mutation.mutate({
      brandName,
      tagline: tagline || undefined,
      style: style as any,
      colorScheme: colorScheme || undefined,
      industry: industry || undefined,
      iconDescription: iconDescription ? `${iconTypeLabel} logo style. ${iconDescription}` : `${iconTypeLabel} logo style.`,
    });
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="AI Logo Maker" description="Generate professional logos for any brand" icon={Hexagon} gradient="from-violet-500 to-purple-400">
      <div className="max-w-5xl mx-auto">
        {/* Example Logos Showcase */}
        <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-muted-foreground mb-3">Example AI-generated logos:</p>
          <div className="grid grid-cols-2 gap-3">
            <img loading="lazy" src="/showcase/example-logo-1.jpg" alt="AI generated logo examples" className="w-full rounded-lg" />
            <img loading="lazy" src="/showcase/example-logo-2.jpg" alt="AI generated logo mockups" className="w-full rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Brand Name *</Label>
                  <Input placeholder="Your brand name..." value={brandName} onChange={(e) => setBrandName(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tagline</Label>
                  <Input placeholder="Optional tagline..." value={tagline} onChange={(e) => setTagline(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Style</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {logoStyles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`p-2.5 rounded-xl border-2 transition-all text-left ${style === s.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>
                        <span className="text-xs font-medium">{s.label}</span>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Industry</Label>
                  <Input placeholder="e.g., Technology, Food, Fashion..." value={industry} onChange={(e) => setIndustry(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Color Scheme</Label>
                  <Input placeholder="e.g., Blue & gold, Earth tones..." value={colorScheme} onChange={(e) => setColorScheme(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Icon Type</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {iconTypes.map((t) => (
                      <button key={t.value} onClick={() => setIconType(t.value)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${iconType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border text-muted-foreground"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Icon Description</Label>
                  <Textarea placeholder="Describe a symbol/icon to include..." value={iconDescription} onChange={(e) => setIconDescription(e.target.value)} className="text-sm" rows={2} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <Label className="text-sm font-medium">Generate 4 Variations</Label>
                    <p className="text-xs text-muted-foreground">Create multiple interpretations</p>
                  </div>
                  <Switch checked={generateVariations} onCheckedChange={setGenerateVariations} />
                </div>
                {generateVariations && (
                  <p className="text-xs text-violet-400 bg-violet-500/10 rounded-lg px-3 py-2 border border-violet-500/20">Will generate 4 different interpretations of your logo concept.</p>
                )}
                <div className="flex gap-3">
                  <Button onClick={handleGenerate} disabled={!brandName.trim() || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Logo</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setBrandName(""); setResultUrl(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                {!resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-violet-400" />
                          <p className="text-muted-foreground">Designing your logo...</p>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="h-16 w-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4 mx-auto"><Hexagon className="h-8 w-8 text-violet-400" /></div>
                          <h3 className="text-lg font-medium mb-2">Your Logo Preview</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">Enter your brand details and generate a professional logo.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div>
                    <div className="p-6 flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
                      <motion.img initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} src={resultUrl} alt="Logo" className="max-w-full max-h-[400px] object-contain" />
                    </div>
                    <div className="p-4 border-t border-border/50 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download Logo</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
