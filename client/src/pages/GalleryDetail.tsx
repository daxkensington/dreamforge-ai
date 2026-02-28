import DisclaimerBanner from "@/components/DisclaimerBanner";
import PageLayout from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  ExternalLink,
  Copy,
} from "lucide-react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { toast } from "sonner";

export default function GalleryDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data: item, isLoading, error } = trpc.gallery.get.useQuery(
    { id },
    { enabled: !isNaN(id) }
  );

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
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link href="/gallery">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Gallery
          </Link>
        </Button>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Image */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border/50 overflow-hidden bg-muted">
              {gen?.imageUrl ? (
                <img
                  src={gen.imageUrl}
                  alt={item.title || "Synthetic output"}
                  className="w-full h-auto"
                />
              ) : (
                <div className="aspect-[3/4] flex items-center justify-center">
                  <Image className="h-16 w-16 text-muted-foreground opacity-30" />
                </div>
              )}
            </div>
            <DisclaimerBanner compact />
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-6">
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

            {/* Meta */}
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Researcher:</span>
                  <span className="font-medium">{item.userName || "Anonymous"}</span>
                </div>
                {item.userInstitution && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Institution:</span>
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
                  <span className="font-medium">
                    {gen?.width || "?"}x{gen?.height || "?"}px
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Views:</span>
                  <span className="font-medium">{item.viewCount ?? 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Research Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="bg-transparent text-xs"
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
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {gen?.imageUrl && (
                <Button asChild variant="outline" className="flex-1 bg-transparent">
                  <a href={gen.imageUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Full Resolution
                  </a>
                </Button>
              )}
              {gen?.imageUrl && (
                <Button asChild variant="outline" className="flex-1 bg-transparent">
                  <a href={gen.imageUrl} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              )}
            </div>

            <Separator />
            <DisclaimerBanner />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
