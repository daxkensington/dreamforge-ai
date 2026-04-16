import ToolPageLayout from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Shirt,
  Upload,
  Loader2,
  Download,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CLOTH_TYPES = [
  { value: "upper" as const, label: "Upper Body" },
  { value: "lower" as const, label: "Lower Body" },
  { value: "overall" as const, label: "Full Outfit" },
];

type ClothType = "upper" | "lower" | "overall";

export default function ToolVirtualTryOn() {
  const [personImageUrl, setPersonImageUrl] = useState("");
  const [garmentImageUrl, setGarmentImageUrl] = useState("");
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [clothType, setClothType] = useState<ClothType>("upper");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [uploadingGarment, setUploadingGarment] = useState(false);
  const personFileRef = useRef<HTMLInputElement>(null);
  const garmentFileRef = useRef<HTMLInputElement>(null);

  const tryOnMutation = trpc.tools.virtualTryOn.useMutation({
    onSuccess: (data) => {
      if (data.status === "completed" && data.url) {
        setResultUrl(data.url);
        toast.success("Virtual try-on complete!");
      } else {
        toast.error(data.error || "Try-on failed");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "person" | "garment"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const setUploading = target === "person" ? setUploadingPerson : setUploadingGarment;
    const setPreview = target === "person" ? setPersonPreview : setGarmentPreview;
    const setUrl = target === "person" ? setPersonImageUrl : setGarmentImageUrl;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setUrl(url);
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = () => {
    if (!personImageUrl || !garmentImageUrl) {
      toast.error("Please provide both a person photo and a garment photo");
      return;
    }
    setResultUrl(null);
    tryOnMutation.mutate({ personImageUrl, garmentImageUrl, clothType });
  };

  const handleReset = () => {
    setPersonImageUrl("");
    setGarmentImageUrl("");
    setPersonPreview(null);
    setGarmentPreview(null);
    setResultUrl(null);
    if (personFileRef.current) personFileRef.current.value = "";
    if (garmentFileRef.current) garmentFileRef.current.value = "";
  };

  const isProcessing = tryOnMutation.isPending;

  return (
    <ToolPageLayout
      title="Virtual Try-On"
      description="See how any garment looks on you with AI"
      icon={Shirt}
      gradient="from-pink-500 to-rose-400"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Controls Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Person Image */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Person Photo</Label>
                <Input
                  placeholder="Paste person image URL..."
                  value={personImageUrl}
                  onChange={(e) => {
                    setPersonImageUrl(e.target.value);
                    setPersonPreview(e.target.value);
                  }}
                  className="text-sm"
                />
                <input
                  ref={personFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "person")}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => personFileRef.current?.click()}
                  disabled={uploadingPerson}
                >
                  {uploadingPerson ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploadingPerson ? "Uploading..." : "Upload Person Photo"}
                </Button>
                {personPreview && (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img loading="lazy" src={personPreview} alt="Person" className="w-full h-40 object-cover" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Garment Image */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Garment Photo</Label>
                <Input
                  placeholder="Paste garment image URL..."
                  value={garmentImageUrl}
                  onChange={(e) => {
                    setGarmentImageUrl(e.target.value);
                    setGarmentPreview(e.target.value);
                  }}
                  className="text-sm"
                />
                <input
                  ref={garmentFileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "garment")}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => garmentFileRef.current?.click()}
                  disabled={uploadingGarment}
                >
                  {uploadingGarment ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploadingGarment ? "Uploading..." : "Upload Garment Photo"}
                </Button>
                {garmentPreview && (
                  <div className="rounded-lg overflow-hidden border border-border/30">
                    <img loading="lazy" src={garmentPreview} alt="Garment" className="w-full h-40 object-cover" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cloth Type */}
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-4">
                <Label className="text-sm font-medium">Cloth Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CLOTH_TYPES.map((ct) => (
                    <button
                      key={ct.value}
                      onClick={() => setClothType(ct.value)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        clothType === ct.value
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-border"
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!personImageUrl || !garmentImageUrl || isProcessing}
                className="flex-1"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Try On
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-3">
            <Card className="border-border/50 overflow-hidden sticky top-24">
              <CardContent className="p-0">
                <AnimatePresence mode="wait">
                  {!resultUrl && !isProcessing ? (
                    <div className="flex flex-col items-center justify-center h-[500px] text-center p-8">
                      <div className="h-16 w-16 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4">
                        <Shirt className="h-8 w-8 text-pink-400" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">Virtual Try-On</h3>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Upload a person photo and a garment photo to see how it looks.
                      </p>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex flex-col items-center justify-center gap-3 h-[500px]">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
                      <p className="text-sm text-muted-foreground">Generating try-on result...</p>
                    </div>
                  ) : resultUrl ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4"
                    >
                      <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/30">
                        <img loading="lazy" src={resultUrl} alt="Try-on result" className="w-full h-auto max-h-[450px] object-contain" />
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(resultUrl, "_blank")}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Result
                        </Button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ToolPageLayout>
  );
}
