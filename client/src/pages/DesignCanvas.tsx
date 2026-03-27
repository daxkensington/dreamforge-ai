// @ts-nocheck
import { useState, useRef } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { SocialPublish } from "@/components/SocialPublish";
import {
  Layout, Type, Image, Square, Circle, Trash2, Download,
  Plus, Sparkles, Move, ZoomIn, ZoomOut, Undo, Redo,
  AlignCenter, Layers, Palette, Upload, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface CanvasElement {
  id: string;
  type: "image" | "text" | "shape" | "ai-generated";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string; // URL for image, text content for text, shape type for shape
  style?: {
    fontSize?: number;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    borderRadius?: number;
    opacity?: number;
  };
}

const CANVAS_SIZES = [
  { label: "Instagram Post", width: 1080, height: 1080, aspect: "1:1" },
  { label: "Instagram Story", width: 1080, height: 1920, aspect: "9:16" },
  { label: "Facebook Post", width: 1200, height: 630, aspect: "16:9" },
  { label: "YouTube Thumbnail", width: 1280, height: 720, aspect: "16:9" },
  { label: "Twitter Post", width: 1600, height: 900, aspect: "16:9" },
  { label: "LinkedIn Post", width: 1200, height: 627, aspect: "16:9" },
  { label: "Poster (A3)", width: 2480, height: 3508, aspect: "A3" },
  { label: "Business Card", width: 1050, height: 600, aspect: "3.5:2" },
  { label: "Custom", width: 1920, height: 1080, aspect: "custom" },
];

export default function DesignCanvas() {
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES[0]);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [zoom, setZoom] = useState(0.5);
  const [bgColor, setBgColor] = useState("#000000");
  const [showSidebar, setShowSidebar] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  const generateMutation = trpc.generation.create.useMutation({
    onSuccess: (data) => {
      if (data?.imageUrl) {
        addElement("ai-generated", data.imageUrl);
        toast.success("AI element added to canvas!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const addElement = (type: CanvasElement["type"], content: string = "") => {
    const id = `el-${Date.now()}`;
    const defaults: Record<string, Partial<CanvasElement>> = {
      text: { width: 300, height: 60, content: "Double-click to edit", style: { fontSize: 24, fontWeight: "bold", color: "#ffffff" } },
      image: { width: 200, height: 200, content },
      "ai-generated": { width: 300, height: 300, content },
      shape: { width: 150, height: 150, content: "rectangle", style: { backgroundColor: "#3b82f6", borderRadius: 0, opacity: 0.8 } },
    };
    const def = defaults[type] || {};
    setElements((prev) => [...prev, {
      id, type,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: def.width || 200,
      height: def.height || 200,
      content: content || def.content || "",
      style: def.style,
    }]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => addElement("image", reader.result as string);
    reader.readAsDataURL(file);
  };

  const generateAiElement = () => {
    if (!aiPrompt.trim()) return;
    generateMutation.mutate({ prompt: aiPrompt, style: "photorealistic", aspectRatio: "1:1" });
  };

  const selectedElement = elements.find((el) => el.id === selectedId);

  return (
    <PageLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-transparent to-purple-900/10" />
        <div className="container relative py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-2">
                <Layout className="h-3 w-3" /> Design Canvas
              </div>
              <h1 className="text-2xl font-bold">
                AI Design{" "}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">Canvas</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Select value={canvasSize.label} onValueChange={(v) => setCanvasSize(CANVAS_SIZES.find((s) => s.label === v) || CANVAS_SIZES[0])}>
                <SelectTrigger className="w-44 h-8 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANVAS_SIZES.map((s) => <SelectItem key={s.label} value={s.label}>{s.label} ({s.width}×{s.height})</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-transparent" onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}>
                  <ZoomOut className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-transparent" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
                  <ZoomIn className="h-3 w-3" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="h-8 gap-1 bg-transparent text-xs" onClick={() => toast.info("Export coming soon!")}>
                <Download className="h-3 w-3" /> Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-12rem)]">
        {/* Sidebar */}
        <div className="w-64 border-r border-white/5 bg-black/50 p-4 space-y-4 overflow-y-auto">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Add Elements</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-16 flex-col gap-1 bg-white/5 border-white/10 text-xs" onClick={() => addElement("text")}>
                <Type className="h-4 w-4" /> Text
              </Button>
              <label>
                <div className="h-16 flex flex-col items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 text-xs cursor-pointer hover:bg-white/10 transition-colors">
                  <Upload className="h-4 w-4" /> Image
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
              <Button variant="outline" size="sm" className="h-16 flex-col gap-1 bg-white/5 border-white/10 text-xs" onClick={() => addElement("shape")}>
                <Square className="h-4 w-4" /> Shape
              </Button>
              <Button variant="outline" size="sm" className="h-16 flex-col gap-1 bg-white/5 border-white/10 text-xs" onClick={() => addElement("shape", "circle")}>
                <Circle className="h-4 w-4" /> Circle
              </Button>
            </div>
          </div>

          {/* AI Generate */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">AI Generate</p>
            <Input placeholder="Describe an element..." value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} className="text-xs bg-white/5 border-white/10 mb-2" />
            <Button size="sm" className="w-full gap-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs" onClick={generateAiElement} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Generate
            </Button>
          </div>

          {/* Background */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Background</p>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
              <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="text-xs font-mono bg-white/5 border-white/10" />
            </div>
          </div>

          {/* Selected Element Properties */}
          {selectedElement && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Selected: {selectedElement.type}</p>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Width</label>
                    <Input type="number" value={selectedElement.width} onChange={(e) => setElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, width: Number(e.target.value) } : el))} className="h-7 text-xs bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Height</label>
                    <Input type="number" value={selectedElement.height} onChange={(e) => setElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, height: Number(e.target.value) } : el))} className="h-7 text-xs bg-white/5 border-white/10" />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-1 bg-transparent text-xs text-destructive" onClick={deleteSelected}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          )}

          {/* Layers */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              <Layers className="h-3 w-3 inline mr-1" /> Layers ({elements.length})
            </p>
            <div className="space-y-1">
              {elements.map((el, i) => (
                <button
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  className={`w-full flex items-center gap-2 p-1.5 rounded text-[10px] ${selectedId === el.id ? "bg-cyan-500/15 text-cyan-400" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}
                >
                  {el.type === "text" ? <Type className="h-2.5 w-2.5" /> : el.type === "shape" ? <Square className="h-2.5 w-2.5" /> : <Image className="h-2.5 w-2.5" />}
                  <span className="truncate flex-1 text-left">{el.type === "text" ? el.content.slice(0, 20) : `${el.type} ${i + 1}`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-zinc-950/50 flex items-center justify-center p-8">
          <div
            ref={canvasRef}
            className="relative border border-white/10 shadow-2xl"
            style={{
              width: canvasSize.width * zoom,
              height: canvasSize.height * zoom,
              backgroundColor: bgColor,
              transform: `scale(1)`,
            }}
            onClick={(e) => {
              if (e.target === canvasRef.current) setSelectedId(null);
            }}
          >
            {elements.map((el) => (
              <div
                key={el.id}
                className={`absolute cursor-move select-none ${selectedId === el.id ? "ring-2 ring-cyan-500" : ""}`}
                style={{
                  left: el.x * zoom,
                  top: el.y * zoom,
                  width: el.width * zoom,
                  height: el.height * zoom,
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                draggable
                onDragEnd={(e) => {
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setElements((prev) => prev.map((item) =>
                    item.id === el.id ? { ...item, x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom } : item
                  ));
                }}
              >
                {el.type === "text" ? (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="w-full h-full flex items-center justify-center outline-none"
                    style={{
                      fontSize: (el.style?.fontSize || 24) * zoom,
                      fontWeight: el.style?.fontWeight || "bold",
                      color: el.style?.color || "#ffffff",
                    }}
                    onBlur={(e) => {
                      setElements((prev) => prev.map((item) =>
                        item.id === el.id ? { ...item, content: e.currentTarget.textContent || "" } : item
                      ));
                    }}
                  >
                    {el.content}
                  </div>
                ) : el.type === "shape" ? (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: el.style?.backgroundColor || "#3b82f6",
                      borderRadius: el.content === "circle" ? "50%" : (el.style?.borderRadius || 0),
                      opacity: el.style?.opacity || 0.8,
                    }}
                  />
                ) : (
                  <img loading="lazy" src={el.content} alt="Canvas element" className="w-full h-full object-cover" draggable={false} />
                )}
              </div>
            ))}

            {elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30">
                <Layout className="h-12 w-12 mb-2" />
                <p className="text-sm">Add elements from the sidebar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
