import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Calendar,
  Download,
  Eye,
  Image,
  Layers,
  User,
  Building2,
  Cpu,
  Maximize,
  Film,
  FileJson,
  Copy,
  CheckCircle,
} from "lucide-react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";

export default function GalleryDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [copied, setCopied] = useState(false);

  const { data: item, isLoading, error } = trpc.gallery.get.useQuery(
    { id },
    { enabled: !isNaN(id) }
  );

  const copyMetadata = () => {
    if (!item) return;
    const gen = item.generation;
    const metadata = {
      id: item.id,
      title: item.title,
      description: item.description,
      prompt: gen?.prompt,
      negativePrompt: gen?.negativePrompt,
      model: gen?.modelVersion,
      mediaType: gen?.mediaType,
      dimensions: `${gen?.width}x${gen?.height}`,
      tags: item.tags?.map((t: any) => ({ name: t.name, slug: t.slug, category: t.category })),
      creator: item.userName,
      createdAt: item.createdAt,
    };
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopied(true);
    toast.success("Metadata copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsset = async () => {
    if (!item) return;
    const gen = item.generation;
    if (!gen?.imageUrl) return;
    try {
      const response = await fetch(gen.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dreamforge-${item.id}.${gen.mediaType === "video" ? "mp4" : "png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch {
      toast.error("Download failed");
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container py-12">
          <Skeleton className="h-6 w-32 mb-8" />
          <div className="grid lg:grid-cols-5 gap-8">
            <Skeleton className="aspect-[3/4] lg:col-span-3 rounded-xl" />
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !item) {
    return (
      <PageLayout>
        <div className="container py-24 text-center">
          <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This gallery item may have been removed or doesn't exist.
          </p>
          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/gallery">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Gallery
            </Link>
          </Button>
        </div>
      </PageLayout>
    );
  }

  const gen = item.generation;

  return (
    <PageLayout>
      <div className="container py-8 md:py-12">
        {/* Back button */}
        <Link href="/gallery">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to Gallery
          </button>
        </Link>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Image / Video */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-3"
          >
            <div className="rounded-2xl overflow-hidden border border-border/50 bg-muted/30 relative group">
              {gen?.imageUrl ? (
                <>
                  <img
                    src={gen.imageUrl}
                    alt={item.title || "AI artwork"}
                    className="w-full h-auto"
                  />
                  {gen.mediaType === "video" && (
                    <div className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center gap-1.5 shadow-lg">
                      <Film className="h-4 w-4 text-white" />
                      <span className="text-xs text-white font-medium">4s Video Clip</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1.5 bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 border-0"
                      onClick={() => window.open(gen.imageUrl || "", "_blank")}
                    >
                      <Maximize className="h-3 w-3" />
                      Full Size
                    </Button>
                  </div>
                </>
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center">
                  <Image className="h-16 w-16 text-muted-foreground opacity-30" />
                </div>
              )}
            </div>

          </motion.div>

          {/* Details Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Title */}
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                {item.title || "Untitled"}
              </h1>
              {item.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>

            {/* Metadata Card */}
            <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Creator:</span>
                <span className="font-medium">{item.userName || "Anonymous"}</span>
              </div>
              {item.userInstitution && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Bio:</span>
                  <span className="font-medium">{item.userInstitution}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Created:</span>
                <span className="font-medium">
                  {new Date(gen?.createdAt || item.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Model:</span>
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                  {gen?.modelVersion || "unknown"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Maximize className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Dimensions:</span>
                <span className="font-medium">{gen?.width || "?"}x{gen?.height || "?"}px</span>
              </div>
              {gen?.mediaType === "video" && gen?.duration && (
                <div className="flex items-center gap-3 text-sm">
                  <Film className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">{gen.duration}s</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Views:</span>
                <span className="font-medium">{item.viewCount ?? 0}</span>
              </div>
            </div>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag: any) => (
                    <Badge
                      key={tag.id || tag.slug}
                      variant="outline"
                      className="bg-transparent text-xs"
                      style={tag.color ? { borderColor: tag.color + "50", color: tag.color } : undefined}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            {gen?.prompt && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Generation Prompt</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      navigator.clipboard.writeText(gen.prompt);
                      toast.success("Prompt copied!");
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {gen.prompt}
                  </p>
                </div>
                {gen.negativePrompt && (
                  <>
                    <h4 className="text-xs font-medium text-muted-foreground mt-3 mb-1">Negative Prompt</h4>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                      <p className="text-xs font-mono text-muted-foreground/70 leading-relaxed whitespace-pre-wrap">
                        {gen.negativePrompt}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button onClick={downloadAsset} className="w-full gap-2" disabled={!gen?.imageUrl}>
                <Download className="h-4 w-4" />
                Download {gen?.mediaType === "video" ? "Video" : "Image"}
              </Button>
              <Button variant="outline" onClick={copyMetadata} className="w-full gap-2 bg-transparent">
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <FileJson className="h-4 w-4" />}
                {copied ? "Copied!" : "Export Metadata (JSON)"}
              </Button>
            </div>

          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
