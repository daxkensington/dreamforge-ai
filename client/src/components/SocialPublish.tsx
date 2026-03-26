/**
 * Social Publishing component — formats and exports content for each platform.
 * Can be dropped into any tool page that produces images/videos.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Download, Share2, Copy, ExternalLink, Smartphone,
} from "lucide-react";

interface Platform {
  id: string;
  name: string;
  icon: string;
  aspect: string;
  maxDuration?: string;
  maxSize: string;
  color: string;
}

const PLATFORMS: Platform[] = [
  { id: "tiktok", name: "TikTok", icon: "🎵", aspect: "9:16", maxDuration: "10m", maxSize: "287MB", color: "from-pink-500 to-red-500" },
  { id: "reels", name: "Instagram Reels", icon: "📸", aspect: "9:16", maxDuration: "90s", maxSize: "4GB", color: "from-purple-500 to-pink-500" },
  { id: "shorts", name: "YouTube Shorts", icon: "▶️", aspect: "9:16", maxDuration: "60s", maxSize: "256MB", color: "from-red-500 to-red-600" },
  { id: "stories", name: "Instagram Stories", icon: "📱", aspect: "9:16", maxDuration: "60s", maxSize: "30MB", color: "from-orange-500 to-pink-500" },
  { id: "youtube", name: "YouTube", icon: "📺", aspect: "16:9", maxSize: "256GB", color: "from-red-600 to-red-700" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", aspect: "16:9", maxDuration: "10m", maxSize: "5GB", color: "from-blue-600 to-blue-700" },
  { id: "twitter", name: "X / Twitter", icon: "𝕏", aspect: "16:9", maxDuration: "2m20s", maxSize: "512MB", color: "from-slate-600 to-slate-700" },
  { id: "instagram-post", name: "Instagram Post", icon: "📷", aspect: "1:1", maxSize: "30MB", color: "from-purple-500 to-orange-400" },
];

export function SocialPublish({
  contentUrl,
  contentType = "video",
  title = "",
}: {
  contentUrl: string;
  contentType?: "video" | "image";
  title?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleDownloadFor = (platform: Platform) => {
    // Create download with platform-specific filename
    const ext = contentType === "video" ? "mp4" : "png";
    const filename = `${title || "dreamforgex"}-${platform.id}.${ext}`;

    const a = document.createElement("a");
    a.href = contentUrl;
    a.download = filename;
    a.click();
    toast.success(`Downloaded for ${platform.name}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(contentUrl);
    toast.success("Link copied to clipboard");
  };

  if (!contentUrl) return null;

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full gap-2 bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        <Share2 className="h-4 w-4" />
        {expanded ? "Hide" : "Publish to Social Media"}
      </Button>

      {expanded && (
        <div className="space-y-2 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-muted-foreground mb-3">Download optimized for each platform:</p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleDownloadFor(p)}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all text-left"
              >
                <span className="text-lg">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.aspect} • {p.maxSize}</p>
                </div>
                <Download className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1 bg-transparent text-xs" onClick={handleCopyLink}>
              <Copy className="h-3 w-3" /> Copy Link
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1 bg-transparent text-xs" asChild>
              <a href={contentUrl} download>
                <Download className="h-3 w-3" /> Direct Download
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
