import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, Loader2, Download, ArrowUpCircle, Zap } from "lucide-react";

const DENOISE_LEVELS = [
  { id: "none", label: "None", desc: "No denoising" },
  { id: "light", label: "Light", desc: "Clean minor artifacts" },
  { id: "heavy", label: "Heavy", desc: "Remove significant noise" },
] as const;

export default function ToolVideoUpscaler() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [scaleFactor, setScaleFactor] = useState<"2x" | "4x">("2x");
  const [enhanceDetails, setEnhanceDetails] = useState(true);
  const [denoiseLevel, setDenoiseLevel] = useState<string>("light");
  const fileRef = useRef<HTMLInputElement>(null);

  const upscale = trpc.video.upscaleFrame.useMutation();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpscale = () => {
    if (!imageUrl) return;
    upscale.mutate({
      imageUrl,
      scaleFactor,
      enhanceDetails,
      denoiseLevel: denoiseLevel as any,
    });
  };

  return (
    <ToolPageLayout
      title="Video Upscaler"
      description="Enhance video frame resolution with AI-powered upscaling and denoising"
      icon={ArrowUpCircle}
      gradient="from-emerald-500 to-teal-600"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Input */}
        <div className="space-y-5">
          {/* Upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border/50 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500/50 transition-colors group"
          >
            {imageUrl ? (
              <img loading="lazy" src={imageUrl} alt="Source frame" className="max-h-48 mx-auto rounded-lg object-contain" />
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40 group-hover:text-emerald-400 transition-colors" />
                <p className="text-sm text-muted-foreground">Upload a video frame to upscale</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Supports PNG, JPG, WebP</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>
          {fileName && <p className="text-xs text-muted-foreground text-center">{fileName}</p>}

          {/* Scale Factor */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-2 block">Scale Factor</label>
            <div className="grid grid-cols-2 gap-3">
              {(["2x", "4x"] as const).map((sf) => (
                <button
                  key={sf}
                  onClick={() => setScaleFactor(sf)}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    scaleFactor === sf
                      ? "border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                      : "border-border/40 bg-background/30 hover:border-emerald-500/30"
                  }`}
                >
                  <p className="text-2xl font-bold text-foreground/90">{sf}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sf === "2x" ? "High Resolution (2K)" : "Ultra High Resolution (4K)"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Denoise Level */}
          <div>
            <label className="text-sm font-medium text-foreground/80 mb-2 block">Denoise Level</label>
            <div className="flex gap-2">
              {DENOISE_LEVELS.map((dl) => (
                <button
                  key={dl.id}
                  onClick={() => setDenoiseLevel(dl.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                    denoiseLevel === dl.id
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                      : "bg-background/30 text-muted-foreground border border-border/40 hover:border-emerald-500/30"
                  }`}
                >
                  <p className="font-medium">{dl.label}</p>
                  <p className="text-xs opacity-70">{dl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Enhance Details */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/30">
            <div>
              <p className="text-sm font-medium text-foreground/80">Enhance Details</p>
              <p className="text-xs text-muted-foreground">Sharpen edges and improve texture clarity</p>
            </div>
            <Switch checked={enhanceDetails} onCheckedChange={setEnhanceDetails} />
          </div>

          <Button
            onClick={handleUpscale}
            disabled={!imageUrl || upscale.isPending}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
          >
            {upscale.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Upscaling Frame...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Upscale to {scaleFactor}</>
            )}
          </Button>
        </div>

        {/* Right: Result */}
        <div>
          {upscale.isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
              <p className="mt-4 text-sm">Upscaling to {scaleFactor} resolution...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Enhancing every pixel</p>
            </div>
          )}

          {upscale.data && upscale.data.status === "completed" && upscale.data.url && (
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-border/40">
                <img loading="lazy" src={upscale.data.url} alt="Upscaled frame" className="w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                  {upscale.data.scaleFactor} Upscaled
                </Badge>
                <a href={upscale.data.url} download className="ml-auto">
                  <Button size="sm" variant="outline"><Download className="w-4 h-4 mr-1" /> Download</Button>
                </a>
              </div>
            </div>
          )}

          {upscale.data && upscale.data.status === "failed" && (
            <div className="text-center py-16 text-red-400">
              <p>Upscaling failed. Please try again.</p>
            </div>
          )}

          {!upscale.data && !upscale.isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/40">
              <ArrowUpCircle className="w-16 h-16 mb-4" />
              <p className="text-sm">Upload a frame and choose settings to see the result</p>
            </div>
          )}
        </div>
      </div>
    </ToolPageLayout>
  );
}
