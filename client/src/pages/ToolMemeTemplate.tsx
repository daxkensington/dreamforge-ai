import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Laugh, Loader2, Download, Sparkles, RotateCcw, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TEMPLATES = [
  { value: "drake", label: "Drake", slots: 2 },
  { value: "distracted-boyfriend", label: "Distracted BF", slots: 3 },
  { value: "two-buttons", label: "Two Buttons", slots: 2 },
  { value: "expanding-brain", label: "Expanding Brain", slots: 4 },
  { value: "change-my-mind", label: "Change My Mind", slots: 1 },
  { value: "is-this-a-pigeon", label: "Is This a Pigeon?", slots: 3 },
  { value: "woman-yelling-at-cat", label: "Woman/Cat", slots: 2 },
  { value: "doge", label: "Doge", slots: 4 },
  { value: "this-is-fine", label: "This Is Fine", slots: 1 },
  { value: "galaxy-brain", label: "Galaxy Brain", slots: 4 },
] as const;

type Template = (typeof TEMPLATES)[number]["value"];

export default function ToolMemeTemplate() {
  const [template, setTemplate] = useState<Template>("drake");
  const [captions, setCaptions] = useState<string[]>(["", ""]);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.memeTemplate.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Meme ready!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedSlots = TEMPLATES.find((t) => t.value === template)?.slots ?? 2;
  const setTemplateAndSlots = (t: Template) => {
    const slots = TEMPLATES.find((x) => x.value === t)?.slots ?? 2;
    setTemplate(t);
    setCaptions(Array(slots).fill(""));
  };
  const updateCaption = (i: number, v: string) => { const next = [...captions]; next[i] = v; setCaptions(next); };
  const addCaption = () => captions.length < 6 && setCaptions([...captions, ""]);
  const removeCaption = () => captions.length > 1 && setCaptions(captions.slice(0, -1));

  const handleGenerate = () => {
    const filtered = captions.filter((c) => c.trim());
    if (!filtered.length) { toast.error("Add at least one caption"); return; }
    setResultUrl(null);
    mutation.mutate({ template, captions: filtered });
  };
  const handleReset = () => { setTemplate("drake"); setCaptions(["", ""]); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Meme Template Filler" description="Drop your captions into classic meme formats" icon={Laugh} gradient="from-yellow-500 to-orange-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button key={t.value} onClick={() => setTemplateAndSlots(t.value)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${template === t.value ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t.label}</button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Suggested captions: {selectedSlots}</p>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between"><Label className="text-sm font-medium">Captions</Label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={removeCaption} disabled={captions.length <= 1}><Minus className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={addCaption} disabled={captions.length >= 6}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              {captions.map((c, i) => (
                <Input key={i} placeholder={`Caption ${i + 1}`} value={c} onChange={(e) => updateCaption(i, e.target.value)} className="text-sm" />
              ))}
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memeing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Meme</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4"><Laugh className="h-8 w-8 text-yellow-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Meme Template Filler</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Pick a classic template, plug in your captions — done.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /><p className="text-sm text-muted-foreground">Memeing...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center">
                      <img loading="lazy" src={resultUrl} alt="Meme" className="h-auto max-h-[500px] object-contain" />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
