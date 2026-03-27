// @ts-nocheck
import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Brain, Upload, Loader2, Sparkles, Image, User,
  Package, Palette, CheckCircle, Clock, AlertTriangle,
} from "lucide-react";

const TRAINING_TYPES = [
  { value: "face", label: "Face / Character", desc: "Consistent portraits of a person or character", icon: User, images: "10-15 photos recommended" },
  { value: "style", label: "Art Style", desc: "Reproduce a specific artistic style", icon: Palette, images: "15-20 samples recommended" },
  { value: "product", label: "Product", desc: "Consistent product renders from any angle", icon: Package, images: "8-15 photos recommended" },
  { value: "object", label: "Object / Pet", desc: "Any specific object, pet, or item", icon: Image, images: "10-15 photos recommended" },
];

export default function ModelTraining() {
  const [name, setName] = useState("");
  const [type, setType] = useState("face");
  const [triggerWord, setTriggerWord] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [training, setTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string].slice(0, 20));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleStartTraining = () => {
    if (images.length < 5) { toast.error("Upload at least 5 images"); return; }
    if (!name.trim()) { toast.error("Give your model a name"); return; }
    if (!triggerWord.trim()) { toast.error("Set a trigger word"); return; }
    setTraining(true);
    setTrainingStatus("starting");
    // In production, this would call the tRPC endpoint
    setTimeout(() => setTrainingStatus("processing"), 2000);
    toast.success("Training started! This typically takes 15-30 minutes.");
  };

  const selectedType = TRAINING_TYPES.find((t) => t.value === type);

  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
        <div className="container relative py-10 md:py-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium mb-3">
            <Brain className="h-3 w-3" />
            Custom AI Models
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Train Your{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              Own Model
            </span>
          </h1>
          <p className="text-muted-foreground max-w-md">
            Upload 5-20 images of a face, style, or product. AI trains a custom model that generates consistent images of your subject.
          </p>
        </div>
      </div>

      <div className="container py-8 max-w-4xl">
        {!training ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Training Type */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  What are you training?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TRAINING_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`p-4 rounded-xl text-left transition-all ${
                        type === t.value
                          ? "bg-cyan-500/15 border border-cyan-500/30"
                          : "bg-white/5 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <t.icon className={`h-6 w-6 mb-2 ${type === t.value ? "text-cyan-400" : "text-muted-foreground"}`} />
                      <p className="text-xs font-medium">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Model Details */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Model Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Character" className="bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Trigger Word</label>
                    <Input value={triggerWord} onChange={(e) => setTriggerWord(e.target.value)} placeholder="MYCHAR" className="bg-white/5 border-white/10" />
                    <p className="text-[10px] text-muted-foreground mt-1">Use this word in prompts to activate your model</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Image Upload */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-5 w-5 text-cyan-400" />
                  Training Images
                  <Badge className="bg-cyan-500/15 text-cyan-400 border-0 ml-auto">{images.length}/20</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">{selectedType?.images}. Various angles, lighting, and backgrounds work best.</p>

                {images.length > 0 && (
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {images.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10">
                        <img loading="lazy" src={img} alt={`Training image ${i+1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/30 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload images (5-20)</span>
                  <span className="text-[10px] text-muted-foreground">JPG, PNG — best at 512x512 or larger</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>

                <Button
                  onClick={handleStartTraining}
                  disabled={images.length < 5 || !name.trim() || !triggerWord.trim()}
                  className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white"
                >
                  <Brain className="h-4 w-4" />
                  Start Training ({images.length < 5 ? `need ${5 - images.length} more images` : "ready"})
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Training Progress */
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto text-center py-12">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
              {trainingStatus === "processing" ? (
                <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
              ) : trainingStatus === "succeeded" ? (
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              ) : (
                <Clock className="h-10 w-10 text-cyan-400" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {trainingStatus === "succeeded" ? "Training Complete!" : "Training in Progress..."}
            </h2>
            <p className="text-muted-foreground mb-4">
              {trainingStatus === "processing"
                ? `Training "${name}" model with ${images.length} images. This typically takes 15-30 minutes.`
                : trainingStatus === "succeeded"
                  ? `Your "${name}" model is ready! Use "${triggerWord}" in your prompts.`
                  : "Preparing training environment..."}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-cyan-500/15 text-cyan-400 border-0">{type}</Badge>
              <Badge className="bg-purple-500/15 text-purple-400 border-0">{images.length} images</Badge>
              <Badge className="bg-blue-500/15 text-blue-400 border-0">trigger: {triggerWord}</Badge>
            </div>
            {trainingStatus === "succeeded" && (
              <Button className="mt-6 gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white" asChild>
                <a href={`/workspace?prompt=${encodeURIComponent(triggerWord + " ")}`}>
                  <Sparkles className="h-4 w-4" /> Generate with {name}
                </a>
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </PageLayout>
  );
}
