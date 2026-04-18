import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CreditCard, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const STYLES = ["modern", "minimalist", "bold", "elegant", "creative", "tech", "luxury"] as const;
type Style = (typeof STYLES)[number];

export default function ToolBusinessCard() {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [style, setStyle] = useState<Style>("modern");
  const [results, setResults] = useState<{ frontUrl: string | null; backUrl: string | null } | null>(null);

  const mutation = trpc.tools.businessCard.useMutation({
    onSuccess: (data) => { if (data.status === "completed") { setResults({ frontUrl: data.frontUrl ?? null, backUrl: data.backUrl ?? null }); toast.success("Business card ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!name.trim() || !title.trim() || !contact.trim()) { toast.error("Name, title, and contact required"); return; } setResults(null); mutation.mutate({ name, title, company: company || undefined, contact, style }); };
  const handleReset = () => { setName(""); setTitle(""); setCompany(""); setContact(""); setStyle("modern"); setResults(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Business Card Designer" description="Print-ready 3.5x2 business cards — front and back" icon={CreditCard} gradient="from-slate-400 to-zinc-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Full Name</Label><Input placeholder="Sarah Chen" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Title</Label><Input placeholder="Creative Director" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Company (optional)</Label><Input placeholder="Acme Studio" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Contact</Label><Textarea placeholder="sarah@acme.com, (555) 012-3456, acme.com, @sarahc" value={contact} onChange={(e) => setContact(e.target.value)} rows={3} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-4 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s}</button>
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
                  <div className="h-16 w-16 rounded-2xl bg-slate-500/10 flex items-center justify-center mb-4"><CreditCard className="h-8 w-8 text-slate-400" /></div>
                  <h3 className="text-lg font-medium mb-2">Business Card Designer</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">Front and back designed as a matching set — upload-ready to any print shop.</p>
                </div>
              ) : isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /><p className="text-sm text-muted-foreground">Designing both sides...</p></div>
              ) : results ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {results.frontUrl && (<div className="space-y-2"><div className="text-xs text-muted-foreground uppercase tracking-wider">Front</div><div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={results.frontUrl} alt="Front" className="w-full h-auto max-h-[250px] object-contain" /></div><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => results.frontUrl && window.open(results.frontUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Front</Button></div></div>)}
                  {results.backUrl && (<div className="space-y-2"><div className="text-xs text-muted-foreground uppercase tracking-wider">Back</div><div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={results.backUrl} alt="Back" className="w-full h-auto max-h-[250px] object-contain" /></div><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => results.backUrl && window.open(results.backUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Back</Button></div></div>)}
                </motion.div>
              ) : null}
            </CardContent></Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
