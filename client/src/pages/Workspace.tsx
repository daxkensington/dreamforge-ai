import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Sparkles,
  Wand2,
  Image,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Clock,
  Download,
  ExternalLink,
} from "lucide-react";
import { useState, useMemo } from "react";

export default function Workspace() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(768);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitGenId, setSubmitGenId] = useState<number | null>(null);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitDesc, setSubmitDesc] = useState("");

  const { data: tags } = trpc.tags.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: generations, refetch: refetchGens } = trpc.generation.list.useQuery(
    { limit: 50, offset: 0 },
    { enabled: isAuthenticated }
  );

  const utils = trpc.useUtils();

  const generateMutation = trpc.generation.create.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed") {
        toast.success("Generation completed!");
      } else if (data.status === "failed") {
        toast.error(`Generation failed: ${data.error || "Unknown error"}`);
      }
      refetchGens();
    },
    onError: (err) => toast.error(err.message),
  });

  const enhanceMutation = trpc.generation.enhancePrompt.useMutation({
    onSuccess: (data) => {
      setPrompt(data.enhanced);
      toast.success("Prompt enhanced!");
    },
    onError: () => toast.error("Failed to enhance prompt"),
  });

  const submitMutation = trpc.generation.submitToGallery.useMutation({
    onSuccess: () => {
      toast.success("Submitted for review!");
      setSubmitDialogOpen(false);
      setSubmitTitle("");
      setSubmitDesc("");
      setSubmitGenId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }
    generateMutation.mutate({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      mediaType: "image",
      width,
      height,
      tagIds: selectedTags.length > 0 ? selectedTags : undefined,
    });
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const stableTagIds = useMemo(() => selectedTags, [selectedTags.join(",")]);

  if (authLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid lg:grid-cols-5 gap-8">
            <Skeleton className="h-96 lg:col-span-2" />
            <Skeleton className="h-96 lg:col-span-3" />
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold mb-4">Sign in to Access Workspace</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            The prompt workspace requires authentication. Sign in to begin generating synthetic research media.
          </p>
          <Button onClick={() => (window.location.href = getLoginUrl())} size="lg">
            Sign in
          </Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prompt Workspace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generate 100% synthetic fictional scenes for academic research
            </p>
          </div>
          <DisclaimerBanner compact />
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Prompt Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-primary" />
                  Prompt Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Scene Description</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe a fictional scene... e.g., 'A crystalline dragon perched atop a floating island surrounded by aurora borealis, digital art style'"
                    rows={5}
                    className="mt-1.5 font-mono text-sm"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {prompt.length}/2000
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => enhanceMutation.mutate({ prompt })}
                      disabled={!prompt.trim() || enhanceMutation.isPending}
                      className="text-xs"
                    >
                      {enhanceMutation.isPending ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      Enhance with AI
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="negative">Negative Prompt (optional)</Label>
                  <Textarea
                    id="negative"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Elements to avoid..."
                    rows={2}
                    className="mt-1.5 font-mono text-sm"
                    maxLength={1000}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Width</Label>
                    <Select
                      value={String(width)}
                      onValueChange={(v) => setWidth(Number(v))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512px</SelectItem>
                        <SelectItem value="768">768px</SelectItem>
                        <SelectItem value="1024">1024px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Height</Label>
                    <Select
                      value={String(height)}
                      onValueChange={(v) => setHeight(Number(v))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512px</SelectItem>
                        <SelectItem value="768">768px</SelectItem>
                        <SelectItem value="1024">1024px</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tags */}
                {tags && tags.length > 0 && (
                  <div>
                    <Label>Research Tags</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                          className={`cursor-pointer transition-colors text-xs ${
                            selectedTags.includes(tag.id)
                              ? ""
                              : "bg-transparent hover:bg-accent"
                          }`}
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || generateMutation.isPending}
                  className="w-full font-medium"
                  size="lg"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Synthetic Media
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  Generation History
                  {generations && (
                    <span className="text-xs text-muted-foreground font-normal ml-auto">
                      {generations.length} items
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!generations || generations.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-sm font-medium mb-1">No generations yet</p>
                    <p className="text-xs">Enter a prompt and generate your first synthetic output</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {generations.map((gen) => (
                      <div
                        key={gen.id}
                        className="group rounded-xl border border-border/50 overflow-hidden hover:border-border transition-colors"
                      >
                        {/* Image */}
                        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                          {gen.status === "completed" && gen.imageUrl ? (
                            <img
                              src={gen.imageUrl}
                              alt="Synthetic output"
                              className="w-full h-full object-cover"
                            />
                          ) : gen.status === "generating" ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            </div>
                          ) : gen.status === "failed" ? (
                            <div className="w-full h-full flex flex-col items-center justify-center text-destructive">
                              <XCircle className="h-8 w-8 mb-2" />
                              <span className="text-xs">Failed</span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Clock className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}

                          {/* Overlay actions */}
                          {gen.status === "completed" && gen.imageUrl && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSubmitGenId(gen.id);
                                  setSubmitDialogOpen(true);
                                }}
                                className="text-xs"
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Submit
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                asChild
                                className="text-xs"
                              >
                                <a href={gen.imageUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3">
                          <p className="text-xs text-foreground truncate">{gen.prompt}</p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(gen.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-1">
                              {gen.status === "completed" && (
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                              )}
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {gen.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit to Gallery Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit to Research Gallery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Your submission will be reviewed by a moderator before appearing in the public gallery.
            </p>
            <div>
              <Label htmlFor="submit-title">Title</Label>
              <Input
                id="submit-title"
                value={submitTitle}
                onChange={(e) => setSubmitTitle(e.target.value)}
                placeholder="Give your generation a descriptive title"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="submit-desc">Description (optional)</Label>
              <Textarea
                id="submit-desc"
                value={submitDesc}
                onChange={(e) => setSubmitDesc(e.target.value)}
                placeholder="Describe the research context or artistic intent..."
                rows={3}
                className="mt-1.5"
              />
            </div>
            <DisclaimerBanner compact />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)} className="bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!submitGenId || !submitTitle.trim()) {
                  toast.error("Please enter a title");
                  return;
                }
                submitMutation.mutate({
                  generationId: submitGenId,
                  title: submitTitle.trim(),
                  description: submitDesc.trim() || undefined,
                });
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
