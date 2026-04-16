import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Shirt,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DESIGN_STYLES = [
  { value: "minimalist" as const, label: "Minimalist" },
  { value: "vintage" as const, label: "Vintage" },
  { value: "graffiti" as const, label: "Graffiti" },
  { value: "illustrative" as const, label: "Illustrative" },
  { value: "typography" as const, label: "Typography" },
  { value: "abstract" as const, label: "Abstract" },
];

const COLOR_SCHEMES = [
  { value: "full-color" as const, label: "Full Color" },
  { value: "monochrome" as const, label: "Monochrome" },
  { value: "limited-palette" as const, label: "Limited Palette" },
];

type DesignStyle = "minimalist" | "vintage" | "graffiti" | "illustrative" | "typography" | "abstract";
type ColorScheme = "full-color" | "monochrome" | "limited-palette";

export default function ToolTshirtDesigner() {
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<DesignStyle>("minimalist");
  const [colorScheme, setColorScheme] = useState<ColorScheme>("full-color");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const tshirtMutation = trpc.tools.tshirtDesign.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("T-shirt design generated!");
      } else {
        toast.error(data.error || "Design generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!concept.trim()) {
      toast.error("Please describe your t-shirt design");
      return;
    }
    setResultUrl(null);
    tshirtMutation.mutate({ concept, style, colorScheme });
  };

  const handleReset = () => {
    setConcept("");
    setStyle("minimalist");
    setColorScheme("full-color");
    setResultUrl(null);
  };

  const isProcessing = tshirtMutation.isPending;

  return (
    <ToolPageLayout
      title="T-Shirt Designer"
      description="Generate print-ready t-shirt designs with AI"
      icon={Shirt}
      gradient="from-emerald-500 to-green-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Concept */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Design Concept</Label>
                <Input
                  placeholder="Describe your t-shirt design..."
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="text-sm"
                />
              </CardContent>
            </Card>

            {/* Design Style */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Design Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DESIGN_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        style === s.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Color Scheme */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Color Scheme</Label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_SCHEMES.map((cs) => (
                    <button
                      key={cs.value}
                      onClick={() => setColorScheme(cs.value)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        colorScheme === cs.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {cs.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!concept.trim() || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Designing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Design
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!resultUrl && !isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                        <Shirt className="h-8 w-8 text-emerald-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">T-Shirt Designer</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Describe your design concept and choose a style to generate a print-ready t-shirt graphic.
                      </p>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-[500px]">
                      <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                      <p className="text-sm text-muted-foreground">Generating your design...</p>
                    </div>
                  ) : resultUrl ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 space-y-4"
                    >
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                        <img loading="lazy" src={resultUrl} alt="T-shirt design" className="w-full h-auto max-h-[450px] object-contain" />
                      </div>
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Design
                        </Button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
