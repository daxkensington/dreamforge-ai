import { Wand2, Sparkles, Image, Film, Heart } from "lucide-react";
import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="container py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Wand2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight leading-none">GenesisSynth</span>
                <span className="text-[9px] font-medium text-muted-foreground tracking-widest uppercase leading-none mt-0.5">Lab</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              AI-powered creative studio for generating stunning images and videos.
              Describe your vision, choose your style, and let AI bring it to life.
            </p>
          </div>

          {/* Create */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Create</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/workspace" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Studio
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <Image className="h-3.5 w-3.5" />
                  Gallery
                </Link>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Features</h4>
            <ul className="space-y-2">
              <li className="text-sm text-muted-foreground flex items-center gap-2">
                <Image className="h-3.5 w-3.5" />
                Text to Image
              </li>
              <li className="text-sm text-muted-foreground flex items-center gap-2">
                <Film className="h-3.5 w-3.5" />
                Text to Video
              </li>
              <li className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Image to Video
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} GenesisSynth Lab. All AI-generated content.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> for creators
          </p>
        </div>
      </div>
    </footer>
  );
}
