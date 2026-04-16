import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LayoutGrid,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PANEL_COUNTS = [2, 3, 4, 5, 6];

const STYLES = [
  { value: "manga" as const, label: "Manga" },
  { value: "western" as const, label: "Western" },
  { value: "cartoon" as const, label: "Cartoon" },
  { value: "noir" as const, label: "Noir" },
];

type ComicStyle = "manga" | "western" | "cartoon" | "noir";

interface ComicPanel {
  description: string;
  imageUrl: string;
}

export default function ToolComicStrip() {
  const [concept, setConcept] = useState("");
  const [panels, setPanels] = useState(4);
  const [style, setStyle] = useState<ComicStyle>("cartoon");
  const [resultPanels, setResultPanels] = useState<ComicPanel[] | null>(null);

  const comicMutation = trpc.tools.comicStrip.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.panels) {
        setResultPanels(data.panels);
        toast.success("Comic strip generated!");
      } else {
        toast.error(data.error || "Comic generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!concept.trim()) {
      toast.error("Please describe your comic story");
      return;
    }
    setResultPanels(null);
    comicMutation.mutate({ concept, panels, style });
  };

  const handleReset = () => {
    setConcept("");
    setPanels(4);
    setStyle("cartoon");
    setResultPanels(null);
  };

  const isProcessing = comicMutation.isPending;

  return (
    <ToolPageLayout
      title="Comic Strip Generator"
      description="Create multi-panel comic strips from a concept"
      icon={LayoutGrid}
      gradient="from-red-500 to-orange-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Concept */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Story Concept</Label>
                <Textarea
                  placeholder="Describe your comic story..."
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* Panel Count */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Number of Panels</Label>
                <div className="flex gap-2">
                  {PANEL_COUNTS.map((count) => (
                    <button
                      key={count}
                      onClick={() => setPanels(count)}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        panels === count
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Style */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Art Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((s) => (
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
                    Generating Comic...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Comic Strip
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
                  {!resultPanels && !isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                        <LayoutGrid className="h-8 w-8 text-red-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Comic Strip Generator</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Describe a story concept to generate a multi-panel comic strip.
                      </p>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-[500px]">
                      <Loader2 className="h-8 w-8 animate-spin text-red-400" />
                      <p className="text-sm text-muted-foreground">Creating your comic strip...</p>
                    </div>
                  ) : resultPanels ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 space-y-4"
                    >
                      <div className={`grid gap-3 ${
                        resultPanels.length <= 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3"
                      }`}>
                        {resultPanels.map((panel, i) => (
                          <div key={i} className="rounded-lg overflow-hidden border border-border/30 bg-muted/30">
                            <img
                              loading="lazy"
                              src={panel.imageUrl}
                              alt={`Panel ${i + 1}`}
                              className="w-full h-auto object-cover aspect-square"
                            />
                            <div className="p-2">
                              <p className="text-xs text-muted-foreground">{panel.description}</p>
                            </div>
                          </div>
                        ))}
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
