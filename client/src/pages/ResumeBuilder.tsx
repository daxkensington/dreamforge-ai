// @ts-nocheck
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FileText, Loader2, Download, Sparkles, Copy, Briefcase, GraduationCap, Award } from "lucide-react";

const RESUME_STYLES = [
  { value: "modern", label: "Modern Minimal" },
  { value: "professional", label: "Corporate Professional" },
  { value: "creative", label: "Creative Designer" },
  { value: "tech", label: "Tech / Developer" },
  { value: "executive", label: "Executive" },
  { value: "academic", label: "Academic / Research" },
];

export default function ResumeBuilder() {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");
  const [style, setStyle] = useState("modern");
  const [result, setResult] = useState<string | null>(null);

  const generateMutation = trpc.video.generateStoryboard.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.scenes) {
        const sections = data.scenes.map((s: any) => `### ${s.title}\n${s.description}`).join("\n\n");
        const resume = `# ${name}\n**${title}**\n\n${sections}`;
        setResult(resume);
        toast.success("Resume generated!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!name.trim() || !experience.trim()) return;
    generateMutation.mutate({
      concept: `Generate a professional ${style} resume for:
Name: ${name}
Title: ${title}
Experience: ${experience}
Education: ${education}
Skills: ${skills}

Create sections: Summary, Experience (with bullet points and achievements), Education, Skills, Certifications.
Each scene = one resume section. Title = section header. Description = section content with proper formatting.
Use action verbs, quantify achievements, and tailor for ATS compatibility.`,
      sceneCount: 6,
      style: "cinematic",
      aspectRatio: "16:9",
    });
  };

  const copyResume = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success("Resume copied to clipboard!");
  };

  const downloadResume = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-resume.md`;
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
            <Briefcase className="h-3 w-3" /> AI Resume
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Resume{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Builder</span>
          </h1>
          <p className="text-muted-foreground max-w-md">Describe your experience and AI creates a professional, ATS-optimized resume.</p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {!result ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Full Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" className="bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Job Title</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Software Engineer" className="bg-white/5 border-white/10" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Experience</label>
                  <Textarea value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Describe your work experience... companies, roles, achievements, years" rows={4} className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Education</label>
                  <Textarea value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Degrees, institutions, certifications..." rows={2} className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Key Skills</label>
                  <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Python, Project Management, Data Analysis..." className="bg-white/5 border-white/10" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Resume Style</label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESUME_STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleGenerate} disabled={!name.trim() || !experience.trim() || generateMutation.isPending} className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white">
                  {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Resume</>}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" className="bg-transparent" onClick={() => setResult(null)}>New Resume</Button>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-1 bg-transparent text-xs" onClick={copyResume}><Copy className="h-3 w-3" /> Copy</Button>
                <Button variant="outline" className="gap-1 bg-transparent text-xs" onClick={downloadResume}><Download className="h-3 w-3" /> Download</Button>
              </div>
            </div>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8 prose prose-invert prose-sm max-w-none">
                {result.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold mb-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">{line.replace("# ", "")}</h1>;
                  if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-bold mt-6 mb-2 text-cyan-400">{line.replace("### ", "")}</h3>;
                  if (line.startsWith("**")) return <p key={i} className="text-sm text-white/60 mb-4">{line.replace(/\*\*/g, "")}</p>;
                  if (line.startsWith("- ")) return <li key={i} className="text-sm text-white/80 ml-4">{line.replace("- ", "")}</li>;
                  if (line.trim()) return <p key={i} className="text-sm text-white/80 leading-relaxed">{line}</p>;
                  return <br key={i} />;
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
