import { Wand2, Heart, Twitter, Github, MessageCircle, Mail, ExternalLink } from "lucide-react";
import { Link } from "wouter";

const footerLinks = {
  create: [
    { label: "Studio", href: "/workspace" },
    { label: "AI Canvas", href: "/tools/canvas" },
    { label: "Video Studio", href: "/video-studio" },
    { label: "Gallery", href: "/gallery" },
    { label: "Marketplace", href: "/marketplace" },
    { label: "Batch Generator", href: "/tools/batch-prompts" },
  ],
  tools: [
    { label: "Text-to-Image", href: "/workspace" },
    { label: "Text-to-Video", href: "/tools/text-to-video" },
    { label: "Image-to-Video", href: "/tools/image-to-video" },
    { label: "AI Headshots", href: "/tools/headshot" },
    { label: "Logo Maker", href: "/tools/logo-maker" },
    { label: "Interior Design", href: "/tools/interior-design" },
    { label: "All 53+ Tools", href: "/tools" },
  ],
  resources: [
    { label: "Pricing", href: "/pricing" },
    { label: "API Documentation", href: "/api-docs" },
    { label: "Prompt Guide", href: "/tools/prompt-builder" },
    { label: "Community Gallery", href: "/gallery" },
    { label: "Character Studio", href: "/tools/character-sheet" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Contact", href: "mailto:support@dreamforge.ai" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "https://twitter.com/dreamforgeai", label: "Twitter" },
  { icon: Github, href: "https://github.com/daxkensington/dreamforge-ai", label: "GitHub" },
  { icon: MessageCircle, href: "#", label: "Discord" },
  { icon: Mail, href: "mailto:support@dreamforge.ai", label: "Email" },
];

const aiModels = ["Grok", "GPT-4o", "DALL-E 3", "Gemini", "Claude", "Veo 2"];

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-black">
      {/* Fire gradient accent line at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-8">
        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
                <Wand2 className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                DreamForge
              </span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6 max-w-xs">
              The all-in-one AI creative studio. 53+ tools for images, video, audio, and design — powered by the world's best AI models.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3 mb-6">
              {socialLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>

            {/* AI Models */}
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Powered by</p>
              <div className="flex flex-wrap gap-1.5">
                {aiModels.map((model) => (
                  <span key={model} className="px-2 py-0.5 text-[10px] rounded-full bg-white/5 border border-white/10 text-white/40">
                    {model}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Create */}
          <div>
            <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-4">Create</h4>
            <ul className="space-y-2.5">
              {footerLinks.create.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/40 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools */}
          <div>
            <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-4">Tools</h4>
            <ul className="space-y-2.5">
              {footerLinks.tools.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/40 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-4">Resources</h4>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-white/40 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("mailto:") ? (
                    <a href={link.href} className="text-sm text-white/40 hover:text-white transition-colors">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-sm text-white/40 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} DreamForge AI. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-xs text-white/30 hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/privacy" className="text-xs text-white/30 hover:text-white/60 transition-colors">Privacy</Link>
            <p className="text-xs text-white/30 flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> for creators
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
