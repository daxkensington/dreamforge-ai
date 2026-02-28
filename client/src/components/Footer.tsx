import { FlaskConical, Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50">
      <div className="container py-8">
        {/* Disclaimer Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 mb-6">
          <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">100% synthetic media research platform</span>{" "}
            — all content mathematically generated, no real individuals depicted or harmed.
            This platform is designed exclusively for academic research into generative AI models,
            synthetic content analysis, and peer-reviewed study of computational creativity.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">GenesisSynth Lab</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Academic Research Platform · All outputs are 100% synthetic · No tracking · No ads
          </p>
        </div>
      </div>
    </footer>
  );
}
