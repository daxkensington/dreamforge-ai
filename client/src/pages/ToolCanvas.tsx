import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Paintbrush, Loader2, Download, Sparkles, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ToolCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(8);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [style, setStyle] = useState("photorealistic");
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  const styles = [
    { value: "photorealistic", label: "Photo" }, { value: "anime", label: "Anime" },
    { value: "oil-painting", label: "Oil Paint" }, { value: "watercolor", label: "Watercolor" },
    { value: "cyberpunk", label: "Cyberpunk" }, { value: "fantasy", label: "Fantasy" },
    { value: "pixel-art", label: "Pixel Art" }, { value: "comic", label: "Comic" },
  ];

  const colors = ["#ffffff", "#ff0000", "#ff8800", "#ffff00", "#00ff00", "#00ffff", "#0088ff", "#8800ff", "#ff00ff", "#888888", "#000000"];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, 512, 512);
  }, []);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, 512, 512));
    if (historyRef.current.length > 30) historyRef.current.shift();
  }, []);

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prev = historyRef.current.pop();
    if (prev) ctx.putImageData(prev, 0, 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    saveHistory();
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, 512, 512);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = 512 / rect.width;
    const scaleY = 512 / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    saveHistory();
    setIsDrawing(true);
    lastPos.current = getPos(e);
    draw(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (lastPos.current) {
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
    } else {
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => { setIsDrawing(false); lastPos.current = null; };

  // Use sketch-to-image via the existing tools endpoint
  const mutation = trpc.tools.sketchToImage?.useMutation?.({
    onSuccess: (data: any) => {
      if (data.status === "completed" && data.url) { setResultUrl(data.url); toast.success("Image generated from canvas!"); }
      else toast.error(data.error || "Generation failed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const generateFromCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to data URL and upload
    const dataUrl = canvas.toDataURL("image/png");

    setResultUrl(null);
    try {
      // Upload the canvas image
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append("file", blob, "canvas-sketch.png");
      const res = await fetch("/api/upload", { method: "POST", body: formData });

      if (res.ok) {
        const { url } = await res.json();
        const styleMap: Record<string, string> = {
          "photorealistic": "realistic", "anime": "anime", "oil-painting": "oil-painting",
          "watercolor": "watercolor", "cyberpunk": "digital-art", "fantasy": "digital-art",
          "pixel-art": "digital-art", "comic": "digital-art",
        };
        mutation?.mutate({ imageUrl: url, description: prompt || "Transform this sketch into a detailed image", outputStyle: (styleMap[style] || "digital-art") as any });
      } else {
        // Fallback: use the inpaint endpoint with dataUrl
        toast.error("Upload required for canvas generation");
      }
    } catch {
      toast.error("Failed to upload canvas");
    }
  };

  const isProcessing = mutation?.isPending || false;

  return (
    <ToolPageLayout title="AI Canvas" description="Draw and let AI transform your sketches in real-time" icon={Paintbrush} gradient="from-violet-500 to-indigo-400">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Canvas */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary">512 × 512 Canvas</Badge>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={undo}><Undo2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={clearCanvas}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  className="w-full aspect-square rounded-lg cursor-crosshair border border-border/30"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                />
              </CardContent>
            </Card>

            {/* Brush Controls */}
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-6">
                <div className="flex gap-1.5">
                  {colors.map((c) => (
                    <button key={c} onClick={() => setBrushColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${brushColor === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Label className="text-xs whitespace-nowrap">Brush</Label>
                  <Slider value={[brushSize]} onValueChange={([v]) => setBrushSize(v)} min={1} max={40} step={1} className="flex-1" />
                  <span className="text-xs text-muted-foreground w-8">{brushSize}px</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls + Result */}
          <div className="space-y-6">
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Prompt</Label>
                  <Input placeholder="Describe what your sketch represents..." value={prompt} onChange={(e) => setPrompt(e.target.value)} className="text-sm" />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">Output Style</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {styles.map((s) => (
                      <button key={s.value} onClick={() => setStyle(s.value)}
                        className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${style === s.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-border"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={generateFromCanvas} disabled={isProcessing} className="w-full" size="lg">
                  {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate from Canvas</>}
                </Button>
              </CardContent>
            </Card>

            {/* Result */}
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-400" /><p className="text-sm text-muted-foreground">Transforming your sketch...</p>
                    </motion.div>
                  ) : resultUrl ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                      <img loading="lazy" src={resultUrl} alt="Generated" className="w-full" />
                      <div className="p-3 border-t border-border/50 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}><Download className="h-4 w-4 mr-1" />Download</Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-12 text-center">
                      <Paintbrush className="h-8 w-8 text-violet-400 mb-2" />
                      <p className="text-sm text-muted-foreground">Draw on the canvas and generate</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
