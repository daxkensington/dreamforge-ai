import { Wand2, Heart, Twitter, Mail, ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

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
    { label: "AI Song Creator", href: "/tools/song-creator" },
    { label: "Music Video Studio", href: "/tools/music-video" },
    { label: "Text-to-Video", href: "/tools/text-to-video" },
    { label: "AI Headshots", href: "/tools/headshot" },
    { label: "Logo Maker", href: "/tools/logo-maker" },
    { label: "All 100+ Tools", href: "/tools" },
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
    { label: "Contact", href: "mailto:support@dreamforgex.ai" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "https://x.com/dreamforgex_ai", label: "Twitter" },
  { icon: Mail, href: "mailto:support@dreamforgex.ai", label: "Email" },
];

const aiModels = ["Grok", "Flux Pro", "DALL-E 3", "Gemini", "Veo 3", "Claude", "Seedream", "Runway", "Kling", "fal.ai", "Groq"];

const galleryStrip = [
  "/showcase/gallery-strip-1.jpg", "/showcase/gallery-strip-2.jpg", "/showcase/gallery-strip-3.jpg",
  "/showcase/gallery-strip-4.jpg", "/showcase/gallery-15.jpg", "/showcase/tool-interior.jpg",
  "/showcase/gallery-16.jpg", "/showcase/hero-marketplace-1.jpg", "/showcase/hero-marketplace-2.jpg",
  "/showcase/gallery-18.jpg", "/showcase/hero-brandkit-1.jpg", "/showcase/hero-characters-1.jpg",
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="relative border-t border-white/5 bg-black">
      {/* Fire gradient accent line at top with glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent blur-sm" />

      {/* Mini Gallery Strip */}
      <div className="overflow-hidden py-6">
        <div className="flex gap-3 animate-footer-marquee">
          {[...galleryStrip, ...galleryStrip].map((img, i) => (
            <div key={i} className="flex-shrink-0 h-20 w-28 rounded-lg overflow-hidden opacity-60 hover:opacity-100 transition-opacity duration-300">
              <img src={img} alt="AI generated showcase" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
        <style>{`
          @keyframes footer-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-footer-marquee {
            animation: footer-marquee 50s linear infinite;
          }
          .animate-footer-marquee:hover {
            animation-play-state: paused;
          }
        `}</style>
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-8">
        {/* Main grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/logo.png" alt="DreamForgeX" className="h-9 w-9 rounded-xl" />
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
                DreamForgeX
              </span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6 max-w-xs">
              The all-in-one AI creative studio. 100+ tools for images, video, audio, and design — powered by the world's best AI models.
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

            {/* Newsletter */}
            <div className="mt-6">
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Stay Updated</p>
              {subscribed ? (
                <p className="text-xs text-emerald-400">Thanks for subscribing!</p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (email.trim()) setSubscribed(true);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/40 transition-colors"
                    required
                  />
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:from-cyan-600 hover:to-blue-700 transition-colors flex items-center gap-1"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </form>
              )}
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

        {/* Product Hunt Badge */}
        <div className="border-t border-white/5 pt-6 flex justify-center">
          <a href="https://www.producthunt.com/products/dreamforgex?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-dreamforgex" target="_blank" rel="noopener noreferrer">
            <img alt="DreamForgeX on Product Hunt" width="250" height="54" src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1116609&theme=dark&t=1775446426701" />
          </a>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-6 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} DreamForgeX AI. All rights reserved.
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
