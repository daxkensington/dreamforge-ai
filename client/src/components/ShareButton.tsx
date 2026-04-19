"use client";

import { useState } from "react";
import { Share2, Check, Copy, Twitter, Facebook, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface ShareButtonProps {
  /** Generation id — assembles `/g/<id>` */
  generationId: number;
  /** Plain text seed for the share message. */
  shareText?: string;
  /** Optional caller styling. */
  className?: string;
  /** Compact icon-only mode for crowded toolbars. */
  iconOnly?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
}

/**
 * Drop-in share button for any generation. Surfaces a popover with a
 * copy-link primary action plus X / Facebook / WhatsApp share intents.
 *
 * Always points at the public `/g/<id>` route (server-rendered with full OG).
 */
export function ShareButton({
  generationId,
  shareText = "Check out this AI creation from DreamForgeX:",
  className,
  iconOnly = false,
  variant = "outline",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/g/${generationId}`
      : `https://dreamforgex.ai/g/${generationId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={variant} size="sm" className={className} aria-label="Share">
          <Share2 className="h-4 w-4" />
          {!iconOnly && <span className="ml-2">Share</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-xs text-muted-foreground mb-2 px-1">Share this generation</p>
        <button
          type="button"
          onClick={handleCopy}
          className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors"
        >
          <span className="truncate text-muted-foreground font-mono text-xs">
            {url.replace(/^https?:\/\//, "")}
          </span>
          {copied ? (
            <Check className="h-4 w-4 text-emerald-400 shrink-0 ml-2" />
          ) : (
            <Copy className="h-4 w-4 shrink-0 ml-2" />
          )}
        </button>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <a href={xUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="w-full" aria-label="Share to X">
              <Twitter className="h-4 w-4" />
            </Button>
          </a>
          <a href={fbUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="w-full" aria-label="Share to Facebook">
              <Facebook className="h-4 w-4" />
            </Button>
          </a>
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="w-full" aria-label="Share to WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
