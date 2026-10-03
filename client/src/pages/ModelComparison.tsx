import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Image, Layers } from "lucide-react";
import { Link } from "wouter";

export default function ModelComparison() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [modelSelection, setModelSelection] = useState<string[] | null>(null);

  const models = trpc.models.list.useQuery();
  const compareMut = trpc.models.compare.useMutation();
  const selectedModels = modelSelection === null
    ? (models.data ?? []).slice(0, 2).map(model => model.id)
    : modelSelection.filter(id => models.data?.some(model => model.id === id));
  const trimmedPrompt = prompt.trim();

  function setModelChecked(id: string, checked: boolean) {
    setModelSelection(prev => {
      const current = prev === null
        ? (models.data ?? []).slice(0, 2).map(model => model.id)
        : prev.filter(modelId => models.data?.some(model => model.id === modelId));
      if (!checked) return current.filter(modelId => modelId !== id);
      if (!models.data?.some(model => model.id === id) || current.includes(id) || current.length >= 4) return current;
      return [...current, id];
    });
  }

  const speedIcons: Record<string, string> = { fastest: "⚡⚡⚡", fast: "⚡⚡", medium: "⚡", slow: "🐢" };

  if (!user) {
    return (
      <div className="container py-20 text-center">
        <Layers className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-3xl font-bold mb-4">Model Comparison</h1>
        <p className="text-muted-foreground mb-6">Compare outputs across different AI models.</p>
        <a href={getLoginUrl()}><Button size="lg">Sign In</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/workspace"><Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div>
          <h1 className="text-3xl font-bold">Model Comparison</h1>
          <p className="text-muted-foreground">Generate the same prompt across multiple models to compare results</p>
        </div>
      </div>

      {/* Model Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Select Models (2-4)</CardTitle>
          <CardDescription>Choose which models to compare</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {models.data?.map(model => (
              <div
                key={model.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  selectedModels.includes(model.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={selectedModels.includes(model.id)}
                  onCheckedChange={checked => setModelChecked(model.id, checked === true)}
                  aria-label={`Compare ${model.name}`}
                  disabled={!selectedModels.includes(model.id) && selectedModels.length >= 4}
                />
                <div>
                  <h4 className="font-medium text-sm">{model.name}</h4>
                  <p className="text-xs text-muted-foreground">{model.description}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{speedIcons[model.speed]} {model.speed}</Badge>
                    <Badge variant="outline" className="text-xs">{model.quality}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Input */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Textarea
            placeholder="Enter a prompt to compare across models..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="mb-3"
          />
          <Button
            onClick={() => {
              if (!trimmedPrompt || selectedModels.length < 2 || compareMut.isPending) return;
              compareMut.mutate({ prompt: trimmedPrompt, modelIds: selectedModels });
            }}
            disabled={!trimmedPrompt || selectedModels.length < 2 || compareMut.isPending}
            className="w-full"
          >
            {compareMut.isPending ? "Generating..." : `Compare ${selectedModels.length} Models`}
          </Button>
          {compareMut.isError && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {compareMut.error.message || "Unable to compare models. Please try again."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {compareMut.isPending && (
        <div className="grid grid-cols-2 gap-4">
          {selectedModels.map(id => (
            <Card key={id}>
              <CardContent className="pt-6">
                <Skeleton className="aspect-square w-full mb-3" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {compareMut.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {compareMut.data.map(result => {
            const model = models.data?.find(m => m.id === result.modelId);
            return (
              <Card key={result.modelId} className={result.error ? "border-destructive/50" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{model?.name || result.modelId}</CardTitle>
                  {model && <CardDescription className="text-xs">{model.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {result.error ? (
                    <div className="aspect-square bg-destructive/10 rounded-lg flex items-center justify-center">
                      <p className="text-sm text-destructive">{result.error}</p>
                    </div>
                  ) : result.url ? (
                    <img loading="lazy" src={result.url} alt={`${model?.name} output`} className="w-full rounded-lg" />
                  ) : (
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                      <Image className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
