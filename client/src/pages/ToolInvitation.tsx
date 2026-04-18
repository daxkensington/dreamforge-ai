import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EVENTS = ["wedding", "birthday", "babyshower", "graduation", "anniversary", "corporate", "party", "other"] as const;
const STYLES = ["elegant", "playful", "modern", "vintage", "floral", "minimalist", "rustic", "watercolor"] as const;
type Event = (typeof EVENTS)[number];
type Style = (typeof STYLES)[number];

export default function ToolInvitation() {
  const [eventType, setEventType] = useState<Event>("birthday");
  const [headline, setHeadline] = useState("");
  const [details, setDetails] = useState("");
  const [style, setStyle] = useState<Style>("elegant");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.invitation.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Invitation ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!headline.trim() || !details.trim()) { toast.error("Headline and details required"); return; } setResultUrl(null); mutation.mutate({ eventType, headline, details, style }); };
  const handleReset = () => { setEventType("birthday"); setHeadline(""); setDetails(""); setStyle("elegant"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Invitation Designer" description="Weddings, birthdays, showers — print-ready 5x7 invitations" icon={Mail} gradient="from-pink-400 to-purple-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Event Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENTS.map((e) => (
                  <button key={e} onClick={() => setEventType(e)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${eventType === e ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{e.replace("baby", "Baby ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Headline</Label><Input placeholder="Sarah is turning 30!" value={headline} onChange={(e) => setHeadline(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Event Details</Label><Textarea placeholder="Saturday, June 15 at 7pm, The Garden Room, 123 Main St. Dress code: cocktail. RSVP by June 1..." value={details} onChange={(e) => setDetails(e.target.value)} rows={5} /></div>
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
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Designing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Invitation</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4"><Mail className="h-8 w-8 text-pink-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Invitation Designer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">5x7 print-ready invitations with beautiful typography — weddings to birthdays.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-pink-400" /><p className="text-sm text-muted-foreground">Designing invitation...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Invitation" className="h-auto max-h-[700px] object-contain" /></div>
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
