import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Sparkles, Wand2, Copy, ArrowRight, Lightbulb } from "lucide-react";

interface PromptAssistantProps {
  currentPrompt: string;
  onApplyPrompt: (prompt: string) => void;
}

export default function PromptAssistant({ currentPrompt, onApplyPrompt }: PromptAssistantProps) {
  const [style, setStyle] = useState("");
  const [mood, setMood] = useState("");
  const [category, setCategory] = useState<"style" | "mood" | "composition" | "lighting" | "color" | "subject">("style");

  const improveMut = trpc.promptAssist.improve.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const suggestions = trpc.promptAssist.suggest.useQuery(
    { context: currentPrompt || undefined, category },
    { enabled: false }
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> AI Assistant
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Prompt Assistant
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Improve Current Prompt */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Wand2 className="w-4 h-4" /> Improve Prompt
            </h3>
            <p className="text-xs text-muted-foreground">
              {currentPrompt ? "Enhance your current prompt with professional details." : "Enter a prompt in the workspace first."}
            </p>
            <div className="flex gap-2">
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Style" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cinematic">Cinematic</SelectItem>
                  <SelectItem value="anime">Anime</SelectItem>
                  <SelectItem value="photorealistic">Photo</SelectItem>
                  <SelectItem value="watercolor">Watercolor</SelectItem>
                  <SelectItem value="digital-art">Digital Art</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Mood" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dramatic">Dramatic</SelectItem>
                  <SelectItem value="serene">Serene</SelectItem>
                  <SelectItem value="mysterious">Mysterious</SelectItem>
                  <SelectItem value="joyful">Joyful</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              size="sm"
              onClick={() => improveMut.mutate({ prompt: currentPrompt, style: style || undefined, mood: mood || undefined })}
              disabled={!currentPrompt || improveMut.isPending}
            >
              {improveMut.isPending ? "Improving..." : "Improve Prompt"}
            </Button>

            {improveMut.data && (
              <Card className="border-primary/20">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm">{improveMut.data.improved}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => { onApplyPrompt(improveMut.data.improved); toast.success("Prompt applied"); }}>
                      <ArrowRight className="w-3 h-3 mr-1" /> Apply
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(improveMut.data.improved); toast.success("Copied"); }}>
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                  {improveMut.data.suggestions?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Tips:</p>
                      {improveMut.data.suggestions.map((tip: string, i: number) => (
                        <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                          <Lightbulb className="w-3 h-3 mt-0.5 shrink-0 text-yellow-500" /> {tip}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Prompt Suggestions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Suggestions
            </h3>
            <div className="flex gap-1 flex-wrap">
              {(["style", "mood", "composition", "lighting", "color", "subject"] as const).map(cat => (
                <Badge
                  key={cat}
                  variant={category === cat ? "default" : "outline"}
                  className="cursor-pointer capitalize"
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => suggestions.refetch()} disabled={suggestions.isFetching}>
              {suggestions.isFetching ? "Loading..." : "Get Suggestions"}
            </Button>

            {suggestions.data?.suggestions?.map((s: any, i: number) => (
              <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { onApplyPrompt(s.prompt); toast.success("Prompt applied"); }}>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm">{s.prompt}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.preview}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0 capitalize">{s.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
