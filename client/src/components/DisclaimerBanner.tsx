import { Sparkles } from "lucide-react";

export default function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/10">
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          All content is AI-generated. No real individuals are depicted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-1">
          AI-Generated Content
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All images and videos on this platform are created by AI. No real individuals
          are depicted. Please use generated content responsibly and in accordance with
          applicable laws and guidelines.
        </p>
      </div>
    </div>
  );
}
