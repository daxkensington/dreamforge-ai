import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Gem, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CARD_TYPES = ["creature", "spell", "artifact", "character", "vehicle", "item"] as const;
const RARITIES = ["common", "uncommon", "rare", "mythic", "legendary"] as const;
const THEMES = ["fantasy", "scifi", "cyberpunk", "steampunk", "mythic", "horror", "cute"] as const;
type CardType = (typeof CARD_TYPES)[number];
type Rarity = (typeof RARITIES)[number];
type Theme = (typeof THEMES)[number];

export default function ToolTradingCard() {
  const [name, setName] = useState("");
  const [artDescription, setArtDescription] = useState("");
  const [stats, setStats] = useState("");
  const [cardType, setCardType] = useState<CardType>("creature");
  const [rarity, setRarity] = useState<Rarity>("rare");
  const [theme, setTheme] = useState<Theme>("fantasy");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.tradingCard.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Card ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!name.trim() || !artDescription.trim() || !stats.trim()) { toast.error("Name, art, and stats required"); return; } setResultUrl(null); mutation.mutate({ name, artDescription, stats, cardType, rarity, theme }); };
  const handleReset = () => { setName(""); setArtDescription(""); setStats(""); setCardType("creature"); setRarity("rare"); setTheme("fantasy"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Trading Card Designer" description="TCG-quality cards — any theme, any rarity" icon={Gem} gradient="from-emerald-500 to-blue-600">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Card Name</Label><Input placeholder="Ember Wolf" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Hero Art</Label><Textarea placeholder="Majestic wolf with ember-glowing fur howling atop a cliff at sunset..." value={artDescription} onChange={(e) => setArtDescription(e.target.value)} rows={3} /></div>
              <div className="space-y-2"><Label className="text-sm">Stats / Abilities</Label><Textarea placeholder="ATK 6 / DEF 4 — Burn: deals 2 damage when summoned. Haste." value={stats} onChange={(e) => setStats(e.target.value)} rows={3} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {CARD_TYPES.map((t) => (
                  <button key={t} onClick={() => setCardType(t)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${cardType === t ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Rarity</Label>
              <div className="grid grid-cols-5 gap-2">
                {RARITIES.map((r) => (
                  <button key={r} onClick={() => setRarity(r)} className={`p-2 rounded-lg border-2 text-[10px] font-medium capitalize transition-all ${rarity === r ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{r}</button>
                ))}
              </div>
              <Label className="text-sm font-medium">Theme</Label>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((t) => (
                  <button key={t} onClick={() => setTheme(t)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${theme === t ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{t}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Forging...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Card</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4"><Gem className="h-8 w-8 text-emerald-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Trading Card Designer</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Magic/Pokemon/Hearthstone-level card design for your own TCG.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /><p className="text-sm text-muted-foreground">Forging card...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Trading card" className="h-auto max-h-[600px] object-contain" /></div>
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
