import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Layers, Loader2, Download, Sparkles, RotateCcw, Plus, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ToolBatchPrompts() {
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [style, setStyle] = useState("");
  const [results, setResults] = useState<Array<{ prompt: string; url: string | null; status: string }> | null>(null);

  const mutation = trpc.tools.batchPrompts.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      toast.success(`${data.completed}/${data.total} images generated!`);
    },
    onError: (err) => toast.error(err.message),
  });

  const addPrompt = () => { if (prompts.length < 20) setPrompts([...prompts, ""]); };
  const removePrompt = (i: number) => { if (prompts.length > 1) setPrompts(prompts.filter((_, idx) => idx !== i)); };
  const updatePrompt = (i: number, val: string) => { const p = [...prompts]; p[i] = val; setPrompts(p); };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 20);
      if (lines.length > 0) { setPrompts(lines); toast.success(`Loaded ${lines.length} prompts from CSV`); }
    };
    reader.readAsText(file);
  };

  const validPrompts = prompts.filter((p) => p.trim());
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Batch Image Generator" description="Generate multiple images from a list of prompts" icon={Layers} gradient="from-blue-500 to-cyan-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Prompts ({validPrompts.length}/20)</Label>
                  <div className="flex gap-2">
                    <label className="cursor-pointer">
                      <input type="file" accept=".csv,.txt" onChange={handleCSV} className="hidden" />
                      <Badge variant="secondary" className="cursor-pointer hover:bg-muted">Import CSV</Badge>
                    </label>
                    <Button variant="ghost" size="sm" onClick={addPrompt} disabled={prompts.length >= 20}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {prompts.map((p, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-xs text-muted-foreground mt-2.5 w-6 text-right">{i + 1}.</span>
                      <Textarea placeholder={`Prompt ${i + 1}...`} value={p} onChange={(e) => updatePrompt(i, e.target.value)} className="text-sm flex-1" rows={1} />
                      {prompts.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removePrompt(i)} className="mt-0.5"><X className="h-3 w-3" /></Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Global Style (optional)</Label>
                  <Input placeholder="e.g., photorealistic, cinematic lighting..." value={style} onChange={(e) => setStyle(e.target.value)} className="text-sm" />
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => { setResults(null); mutation.mutate({ prompts: validPrompts, style: style || undefined }); }}
                    disabled={validPrompts.length === 0 || isProcessing} className="flex-1" size="lg">
                    {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating {validPrompts.length} images...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate All ({validPrompts.length})</>}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { setPrompts([""]); setResults(null); }}><RotateCcw className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="border-border/50">
              <CardContent className="p-6">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 py-16">
                      <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                      <p className="text-foreground font-medium">Generating {validPrompts.length} images...</p>
                      <p className="text-sm text-muted-foreground">This may take a few minutes</p>
                    </motion.div>
                  ) : results ? (
                    <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium">Results</h3>
                        <Badge className="bg-blue-500/20 text-blue-400 border-cyan-500/30">
                          {results.filter((r) => r.status === "completed").length}/{results.length} completed
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                        {results.map((r, i) => (
                          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                            className="rounded-lg overflow-hidden border border-border/30">
                            {r.url ? (
                              <div className="relative group cursor-pointer" onClick={() => window.open(r.url!, "_blank")}>
                                <img loading="lazy" src={r.url} alt={r.prompt} className="w-full aspect-square object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                  <Download className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <div className="aspect-square bg-muted/30 flex items-center justify-center">
                                <p className="text-xs text-muted-foreground p-2 text-center">Failed</p>
                              </div>
                            )}
                            <div className="p-2"><p className="text-[10px] text-muted-foreground truncate">{r.prompt}</p></div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-16 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4"><Layers className="h-8 w-8 text-blue-400" /></div>
                      <h3 className="text-lg font-medium mb-2">Batch Results</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">Add multiple prompts and generate all images at once. Import from CSV for bulk workflows.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
