import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Heart, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const OCCASIONS = ["birthday", "thank-you", "congratulations", "sympathy", "get-well", "holiday", "anniversary", "new-baby", "wedding", "generic"] as const;
const TONES = ["heartfelt", "funny", "formal", "punny", "minimalist", "whimsical"] as const;
type Occasion = (typeof OCCASIONS)[number];
type Tone = (typeof TONES)[number];

export default function ToolGreetingCard() {
  const [occasion, setOccasion] = useState<Occasion>("birthday");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState<Tone>("heartfelt");
  const [customMessage, setCustomMessage] = useState("");
  const [results, setResults] = useState<{ frontUrl: string | null; insideUrl: string | null } | null>(null);

  const mutation = trpc.tools.greetingCard.useMutation({
    onSuccess: (data) => { if (data.status === "completed") { setResults({ frontUrl: data.frontUrl ?? null, insideUrl: data.insideUrl ?? null }); toast.success("Card ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { setResults(null); mutation.mutate({ occasion, recipient: recipient || undefined, tone, customMessage: customMessage || undefined }); };
  const handleReset = () => { setOccasion("birthday"); setRecipient(""); setTone("heartfelt"); setCustomMessage(""); setResults(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Greeting Card" description="Front and inside designed as a matching set" icon={Heart} gradient="from-rose-500 to-pink-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Occasion</Label>
              <div className="grid grid-cols-2 gap-2">
                {OCCASIONS.map((o) => (
                  <button key={o} onClick={() => setOccasion(o)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${occasion === o ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{o.replace("-", " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Recipient (optional)</Label><Input placeholder="Mom, Jesse, My Team..." value={recipient} onChange={(e) => setRecipient(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Custom Message (optional)</Label><Textarea placeholder="You mean the world to me..." value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={3} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Tone</Label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map((t) => (
                  <button key={t} onClick={() => setTone(t)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${tone === t ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Designing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Card</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden"><CardContent className="p-6">
              {!results && !isProcessing ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className="h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4"><Heart className="h-8 w-8 text-rose-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Greeting Card</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Custom front + inside message designed as a matching pair.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /><p className="text-sm text-muted-foreground">Designing card...</p></div>
              ) : results ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.frontUrl && (<div className="space-y-2"><div className="text-xs text-muted-foreground uppercase tracking-wider">Front</div><div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-[5/7]"><img loading="lazy" src={results.frontUrl} alt="Front" className="w-full h-full object-cover" /></div><Button variant="outline" size="sm" className="w-full" onClick={() => results.frontUrl && window.open(results.frontUrl, "_blank")}><Download className="h-3 w-3 mr-1" />Front</Button></div>)}
                  {results.insideUrl && (<div className="space-y-2"><div className="text-xs text-muted-foreground uppercase tracking-wider">Inside</div><div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 aspect-[5/7]"><img loading="lazy" src={results.insideUrl} alt="Inside" className="w-full h-full object-cover" /></div><Button variant="outline" size="sm" className="w-full" onClick={() => results.insideUrl && window.open(results.insideUrl, "_blank")}><Download className="h-3 w-3 mr-1" />Inside</Button></div>)}
                </motion.div>
              ) : null}
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
