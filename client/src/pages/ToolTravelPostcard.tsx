import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plane, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ERAS = ["1920s", "1950s", "1970s", "modern", "retrofuturist"] as const;
const STYLES = ["illustrated", "photographic", "watercolor", "linocut", "art-deco"] as const;
type Era = (typeof ERAS)[number];
type Style = (typeof STYLES)[number];

export default function ToolTravelPostcard() {
  const [location, setLocation] = useState("");
  const [tagline, setTagline] = useState("");
  const [era, setEra] = useState<Era>("1950s");
  const [style, setStyle] = useState<Style>("illustrated");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.travelPostcard.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Postcard ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!location.trim()) { toast.error("Location required"); return; } setResultUrl(null); mutation.mutate({ location, era, style, tagline: tagline || undefined }); };
  const handleReset = () => { setLocation(""); setTagline(""); setEra("1950s"); setStyle("illustrated"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Travel Postcard" description="Vintage-style travel postcards — any destination, any era" icon={Plane} gradient="from-sky-500 to-teal-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Location</Label><Input placeholder="Mount Fuji, Japan" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Tagline (optional)</Label><Input placeholder="Greetings from Tokyo!" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Era</Label>
              <div className="grid grid-cols-5 gap-2">
                {ERAS.map((e) => (
                  <button key={e} onClick={() => setEra(e)} className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${era === e ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{e}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Printing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Postcard</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-4"><Plane className="h-8 w-8 text-sky-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Travel Postcard</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">6×4 vintage travel postcards — collectible, shareable, Etsy-ready.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-sky-400" /><p className="text-sm text-muted-foreground">Printing postcard...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30"><img loading="lazy" src={resultUrl} alt="Postcard" className="w-full h-auto max-h-[500px] object-contain" /></div>
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
