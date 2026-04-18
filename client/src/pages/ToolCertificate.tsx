import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Award, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES = ["classical-formal", "modern-minimal", "playful-kids", "corporate", "academic", "creative-art"] as const;
type Style = (typeof STYLES)[number];

export default function ToolCertificate() {
  const [recipientName, setRecipientName] = useState("");
  const [awardTitle, setAwardTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [style, setStyle] = useState<Style>("classical-formal");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.certificate.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Certificate ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!recipientName.trim() || !awardTitle.trim() || !issuer.trim()) { toast.error("Recipient, award, and issuer required"); return; } setResultUrl(null); mutation.mutate({ recipientName, awardTitle, issuer, issueDate: issueDate || undefined, style }); };
  const handleReset = () => { setRecipientName(""); setAwardTitle(""); setIssuer(""); setIssueDate(""); setStyle("classical-formal"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Certificate Designer" description="Awards, diplomas, course completion — 11x8.5 print-ready" icon={Award} gradient="from-yellow-500 to-amber-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Recipient Name</Label><Input placeholder="Alex Chen" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Award Title</Label><Input placeholder="Outstanding Achievement in Mathematics" value={awardTitle} onChange={(e) => setAwardTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Issuer</Label><Input placeholder="Woodland Academy" value={issuer} onChange={(e) => setIssuer(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Date (optional)</Label><Input placeholder="June 15, 2026" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Embossing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Certificate</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4"><Award className="h-8 w-8 text-yellow-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Certificate Designer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Diplomas, awards, course completion — ornate borders and seals included.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /><p className="text-sm text-muted-foreground">Embossing certificate...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={resultUrl} alt="Certificate" className="w-full h-auto max-h-[500px] object-contain" /></div>
                    <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-2" />Download</Button></div>
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
