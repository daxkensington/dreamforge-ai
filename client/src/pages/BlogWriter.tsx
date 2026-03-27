// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FileText, Loader2, Copy, Sparkles, Download, BookOpen } from "lucide-react";

export default function BlogWriter() {
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("informative");
  const [length, setLength] = useState("medium");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<{ title: string; content: string; meta: string } | null>(null);

  const generateMutation = trpc.video.generateStoryboard.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.scenes) {
        const title = data.title || data.scenes[0]?.title || "Untitled Blog Post";
        const content = data.scenes.map((s: any) => `## ${s.title}\n\n${s.description}`).join("\n\n");
        const meta = data.synopsis || data.scenes[0]?.description?.slice(0, 160) || "";
        setResult({ title, content, meta });
        toast.success("Blog post generated!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!topic.trim()) return;
    const wordCount = length === "short" ? "500-800" : length === "long" ? "2000-3000" : "1000-1500";
    generateMutation.mutate({
      concept: `Write a ${wordCount} word blog post about: ${topic}. Tone: ${tone}. ${keywords ? `SEO keywords: ${keywords}.` : ""}
      Structure with clear H2 sections. Each scene = one section with a heading (title) and content (description).
      First scene should be the introduction. Last scene should be the conclusion with a call-to-action.
      Include practical examples, data points, and actionable takeaways.`,
      sceneCount: length === "short" ? 4 : length === "long" ? 8 : 6,
      style: "cinematic",
      aspectRatio: "16:9",
    });
  };

  const copyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(`# ${result.title}\n\n${result.content}`);
    toast.success("Blog post copied to clipboard!");
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([`# ${result.title}\n\n${result.content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded as Markdown!");
  };


  return (
    <PageLayout>
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/10" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-3">
            <BookOpen className="h-3 w-3" /> AI Writing
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Blog{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Writer</span>
          </h1>
          <p className="text-muted-foreground max-w-md">Describe your topic and AI writes a full SEO-optimized blog post with sections, examples, and meta description.</p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {!result ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-4">
                <Textarea placeholder="What should this blog post be about? e.g. '10 ways AI is changing content creation in 2026'" value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} className="bg-white/5 border-white/10" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Tone</label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="informative">Informative</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="persuasive">Persuasive</SelectItem>
                        <SelectItem value="storytelling">Storytelling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Length</label>
                    <Select value={length} onValueChange={setLength}>
                      <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (500-800 words)</SelectItem>
                        <SelectItem value="medium">Medium (1000-1500 words)</SelectItem>
                        <SelectItem value="long">Long (2000-3000 words)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Input placeholder="SEO keywords (optional, comma-separated)" value={keywords} onChange={(e) => setKeywords(e.target.value)} className="bg-white/5 border-white/10" />
                <Button onClick={handleGenerate} disabled={!topic.trim() || generateMutation.isPending} className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                  {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing...</> : <><Sparkles className="h-4 w-4" /> Generate Blog Post</>}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" className="bg-transparent" onClick={() => setResult(null)}>New Post</Button>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-1 bg-transparent text-xs" onClick={copyAll}><Copy className="h-3 w-3" /> Copy</Button>
                <Button variant="outline" className="gap-1 bg-transparent text-xs" onClick={downloadMarkdown}><Download className="h-3 w-3" /> Markdown</Button>
              </div>
            </div>
            {/* Tone adjustment */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Adjust tone:</span>
              {["More Professional", "More Casual", "More Technical", "More Simple", "Shorter", "Longer"].map((adj) => (
                <Button key={adj} variant="outline" size="sm" className="bg-transparent text-[10px] h-6 px-2"
                  onClick={() => { setTone(adj.toLowerCase().replace("more ", "")); setResult(null); handleGenerate(); }}
                >
                  {adj}
                </Button>
              ))}
            </div>
            {result.meta && (
              <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                <p className="text-[10px] text-muted-foreground mb-1">SEO Meta Description:</p>
                <p className="text-xs text-cyan-300">{result.meta}</p>
              </div>
            )}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8 prose prose-invert prose-sm max-w-none">
                <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">{result.title}</h1>
                {result.content.split("\n\n").map((block, i) => {
                  if (block.startsWith("## ")) return <h2 key={i} className="text-lg font-bold mt-6 mb-3">{block.replace("## ", "")}</h2>;
                  return <p key={i} className="text-sm text-white/80 leading-relaxed mb-3">{block}</p>;
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
