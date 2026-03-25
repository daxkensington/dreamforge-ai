import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, Loader2, Download, Palette, Film } from "lucide-react";

const VIDEO_STYLES = [
  { id: "anime", label: "Anime", desc: "Japanese cel-shaded animation", color: "from-pink-500 to-rose-500" },
  { id: "noir", label: "Film Noir", desc: "High contrast B&W shadows", color: "from-gray-500 to-zinc-700" },
  { id: "watercolor", label: "Watercolor", desc: "Soft flowing paint washes", color: "from-sky-400 to-cyan-500" },
  { id: "oil-painting", label: "Oil Painting", desc: "Classical brushstroke textures", color: "from-cyan-500 to-blue-600" },
  { id: "pixel-art", label: "Pixel Art", desc: "Retro 16-bit gaming aesthetic", color: "from-green-500 to-emerald-600" },
  { id: "comic-book", label: "Comic Book", desc: "Bold outlines and halftone", color: "from-yellow-500 to-red-500" },
  { id: "claymation", label: "Claymation", desc: "Stop-motion clay texture", color: "from-orange-400 to-cyan-500" },
  { id: "retro-vhs", label: "Retro VHS", desc: "1980s scan lines and glitch", color: "from-purple-500 to-fuchsia-600" },
] as const;

export default function ToolVideoStyleTransfer() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [style, setStyle] = useState<string>("anime");
  const [preserveMotion, setPreserveMotion] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const transfer = trpc.video.styleTransfer.useMutation();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleTransfer = () => {
    if (!imageUrl) return;
    transfer.mutate({
      imageUrl,
      videoStyle: style as any,
      preserveMotion,
    });
  };

  return (
    <ToolPageLayout
      title="Video Style Transfer"
      description="Apply cinematic artistic styles to your video frames"
      icon={Palette}
      gradient="from-violet-500 to-purple-600"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Input */}
        <div className="space-y-5">
          {/* Upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500/50 transition-colors group"
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Source" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40 group-hover:text-violet-400 transition-colors" />
                <p className="text-sm text-muted-foreground">Upload a video frame or image</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
          {fileName && <p className="text-xs text-muted-foreground text-center">{fileName}</p>}

          {/* Style Grid */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-2 block">Video Style</label>
            <div className="grid grid-cols-2 gap-2">
              {VIDEO_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    style === s.id
                      ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                      : "border-border/40 bg-background/30 hover:border-violet-500/30"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${s.color} mb-1.5`} />
                  <p className="text-sm font-medium text-foreground/90">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/30">
            <div>
              <p className="text-sm font-medium text-foreground/80">Preserve Composition</p>
              <p className="text-xs text-muted-foreground">Keep original subject positioning</p>
            </div>
            <Switch checked={preserveMotion} onCheckedChange={setPreserveMotion} />
          </div>

          <Button
            onClick={handleTransfer}
            disabled={!imageUrl || transfer.isPending}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            {transfer.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying Style...</>
            ) : (
              <><Film className="w-4 h-4 mr-2" /> Apply Video Style</>
            )}
          </Button>
        </div>

        {/* Right: Result */}
        <div>
          {transfer.isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-12 h-12 animate-spin text-violet-500" />
              <p className="mt-4 text-sm">Applying {VIDEO_STYLES.find((s) => s.id === style)?.label} style...</p>
            </div>
          )}

          {transfer.data && transfer.data.status === "completed" && transfer.data.url && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-border/40">
                <img src={transfer.data.url} alt="Styled frame" className="w-full" />
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">{transfer.data.style}</Badge>
                <a href={transfer.data.url} download className="ml-auto">
                  <Button size="sm" variant="outline"><Download className="w-4 h-4 mr-1" /> Download</Button>
                </a>
              </div>
            </div>
          )}

          {transfer.data && transfer.data.status === "failed" && (
            <div className="text-center py-16 text-red-400">
              <p>Style transfer failed. Please try again.</p>
            </div>
          )}

          {!transfer.data && !transfer.isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40">
              <Palette className="w-16 h-16 mb-4" />
              <p className="text-sm">Upload an image and choose a style to see the result</p>
            </div>
          )}
        </div>
      </div>
    </ToolPageLayout>
  );
}
