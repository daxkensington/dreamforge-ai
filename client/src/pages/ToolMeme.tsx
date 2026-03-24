import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Laugh, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const MEME_STYLES = [
  { value: "classic", label: "Classic", desc: "Traditional meme format" },
  { value: "modern", label: "Modern", desc: "Clean contemporary style" },
  { value: "surreal", label: "Surreal", desc: "Absurd & bizarre humor" },
  { value: "wholesome", label: "Wholesome", desc: "Feel-good & positive" },
  { value: "dark-humor", label: "Dark Humor", desc: "Edgy comedy" },
  { value: "reaction", label: "Reaction", desc: "Reaction image memes" },
  { value: "drake", label: "Drake", desc: "Drake approve/disapprove" },
  { value: "expanding-brain", label: "Expanding Brain", desc: "Escalating intelligence" },
  { value: "custom", label: "Custom", desc: "Freeform AI creation" },
] as const;

type MemeStyle = typeof MEME_STYLES[number]["value"];

export default function ToolMeme() {
  const [concept, setConcept] = useState("");
  const [style, setStyle] = useState<MemeStyle>("classic");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [topText, setTopText] = useState<string | null>(null);
  const [bottomText, setBottomText] = useState<string | null>(null);

  const mutation = trpc.tools.meme.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        setTopText(data.topText || null);
        setBottomText(data.bottomText || null);
        toast.success("Meme generated!");
      } else {
        toast.error(data.error || "Meme generation failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!concept.trim()) { toast.error("Enter a meme concept"); return; }
    setResultUrl(null);
    setTopText(null);
    setBottomText(null);
    mutation.mutate({ concept, style: style as any });
  };

  const handleReset = () => {
    setConcept("");
    setResultUrl(null);
    setTopText(null);
    setBottomText(null);
  };

  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout
      title="Meme Generator"
      description="Generate hilarious memes with AI"
      icon={Laugh}
      gradient="from-yellow-500 to-green-400"
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Meme Concept *</Label>
                  <Textarea
                    placeholder="Describe your meme idea... e.g., 'When you finally fix a bug but 3 new ones appear'"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    className="text-sm"
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Meme Style</Label>
                <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {MEME_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={`flex flex-col items-start p-3 rounded-lg border-2 text-left text-sm transition-all ${
                        style === s.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      <span className="font-medium text-xs">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={!concept.trim() || isProcessing} className="flex-1" size="lg">
                {isProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Generate Meme</>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                {!resultUrl ? (
                  <div className="flex flex-col items-center justify-center h-[600px] text-center p-8">
                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
                          <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
                          <p className="text-muted-foreground">Crafting your meme...</p>
                        </motion.div>
                      ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4 mx-auto">
                            <Laugh className="h-8 w-8 text-yellow-400" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">Your Meme Preview</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            Describe your meme concept and pick a style to generate.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div>
                    <div className="p-6 flex items-center justify-center bg-muted/20">
                      <motion.img
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={resultUrl}
                        alt="Generated Meme"
                        className="max-w-full max-h-[400px] object-contain rounded-lg"
                      />
                    </div>
                    {(topText || bottomText) && (
                      <div className="px-6 py-4 space-y-1 border-t border-border/50">
                        {topText && (
                          <p className="text-sm"><span className="font-medium text-muted-foreground">Top:</span> {topText}</p>
                        )}
                        {bottomText && (
                          <p className="text-sm"><span className="font-medium text-muted-foreground">Bottom:</span> {bottomText}</p>
                        )}
                      </div>
                    )}
                    <div className="p-4 border-t border-border/50 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                        <Download className="h-4 w-4 mr-2" />Download Meme
                      </Button>
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
