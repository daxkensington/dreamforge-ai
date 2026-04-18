import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Megaphone, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TYPES = ["concert", "club-night", "conference", "workshop", "sale", "grand-opening", "fundraiser", "sports", "food", "art-show", "other"] as const;
const STYLES = ["bold-graphic", "minimal-elegant", "vintage-retro", "neon-club", "watercolor-indie", "corporate-clean", "handdrawn", "typographic"] as const;
type EType = (typeof TYPES)[number];
type Style = (typeof STYLES)[number];

export default function ToolEventFlyer() {
  const [eventName, setEventName] = useState("");
  const [eventType, setEventType] = useState<EType>("other");
  const [details, setDetails] = useState("");
  const [style, setStyle] = useState<Style>("bold-graphic");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.eventFlyer.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Flyer ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!eventName.trim() || !details.trim()) { toast.error("Event name and details required"); return; } setResultUrl(null); mutation.mutate({ eventName, eventType, details, style }); };
  const handleReset = () => { setEventName(""); setEventType("other"); setDetails(""); setStyle("bold-graphic"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Event Flyer" description="Concerts, clubs, conferences, sales — 8.5x11 promotional flyers" icon={Megaphone} gradient="from-orange-500 to-red-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Event Name</Label><Input placeholder="Summer Jam 2026" value={eventName} onChange={(e) => setEventName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Details</Label><Textarea placeholder="Saturday July 4, 2026. 8pm doors, 9pm show. The Warehouse, 321 2nd St. $25 advance / $35 door. 21+. Tickets: tinyurl.com/..." value={details} onChange={(e) => setDetails(e.target.value)} rows={5} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setEventType(t)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${eventType === t ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t.replace("-", " ")}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s.replace(/-/g, " ")}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Printing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Flyer</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4"><Megaphone className="h-8 w-8 text-orange-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Event Flyer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Eye-catching promo flyers from across a room — concerts, clubs, sales, any event.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /><p className="text-sm text-muted-foreground">Designing flyer...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Flyer" className="h-auto max-h-[700px] object-contain" /></div>
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
