import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ChefHat, Loader2, Download, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STYLES = ["rustic", "modern", "magazine", "handwritten", "minimalist", "vintage"] as const;
type Style = (typeof STYLES)[number];

export default function ToolRecipeCard() {
  const [dishName, setDishName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [style, setStyle] = useState<Style>("rustic");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = trpc.tools.recipeCard.useMutation({
    onSuccess: (data) => { if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Recipe card ready!"); } else toast.error(data.error || "Generation failed"); },
    onError: (err) => toast.error(err.message),
  });
  const handleGenerate = () => { if (!dishName.trim() || !ingredients.trim() || !steps.trim()) { toast.error("Dish, ingredients, and steps required"); return; } setResultUrl(null); mutation.mutate({ dishName, ingredients, steps, cuisine: cuisine || undefined, style }); };
  const handleReset = () => { setDishName(""); setIngredients(""); setSteps(""); setCuisine(""); setStyle("rustic"); setResultUrl(null); };
  const isProcessing = mutation.isPending;

  return (
    <ToolPageLayout title="Recipe Card" description="Pinterest-ready recipe cards with hero food photo and structured layout" icon={ChefHat} gradient="from-amber-500 to-rose-500">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <div className="space-y-2"><Label className="text-sm">Dish Name</Label><Input placeholder="Brown Butter Banana Bread" value={dishName} onChange={(e) => setDishName(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Cuisine (optional)</Label><Input placeholder="Southern American" value={cuisine} onChange={(e) => setCuisine(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-sm">Ingredients</Label><Textarea placeholder="3 ripe bananas, 1/2 cup butter..." value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} /></div>
              <div className="space-y-2"><Label className="text-sm">Steps</Label><Textarea placeholder="1. Preheat oven to 350°F..." value={steps} onChange={(e) => setSteps(e.target.value)} rows={5} /></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-6 space-y-4">
              <Label className="text-sm font-medium">Design Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={`p-2 rounded-lg border-2 text-xs font-medium capitalize transition-all ${style === s ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}>{s}</button>
                ))}
              </div>
            </CardContent></Card>
            <div className="flex gap-3">
              <Button onClick={handleGenerate} disabled={isProcessing} className="flex-1" size="lg">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Plating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Card</>}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24"><CardContent className="p-0">
              <AnimatePresence mode="wait">
                {!resultUrl && !isProcessing ? (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                    <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"><ChefHat className="h-8 w-8 text-amber-400" /></div>
                    <h3 className="text-lg font-medium mb-2">Recipe Card</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">Share-ready recipe cards with hero photo, ingredients list, and steps.</p>
                  </div>
                ) : isProcessing ? (
                  <div className="flex flex-col items-center justify-center gap-3 h-[500px]"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /><p className="text-sm text-muted-foreground">Plating recipe...</p></div>
                ) : resultUrl ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-4">
                    <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex justify-center"><img loading="lazy" src={resultUrl} alt="Recipe card" className="h-auto max-h-[700px] object-contain" /></div>
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
