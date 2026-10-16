import NextImage from "next/image";
import { TOOL_SAMPLES } from "@/lib/toolSamples";

/**
 * Sample outputs strip for tool pages — renders the tool's showcase assets
 * (from the auto-generated TOOL_SAMPLES map) so visitors see what the tool
 * makes before signing up. Mounted by ToolPageLayout via usePathname, so
 * every ToolPageLayout-based tool gets samples with zero per-page edits.
 */
export default function ToolSamples({ slug }: { slug: string }) {
  const samples = TOOL_SAMPLES[slug];
  if (!samples || samples.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 mt-10" aria-label="Sample outputs">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Made with this tool
      </h3>
      <div className={`grid gap-3 ${samples.length > 1 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1"}`}>
        {samples.map((src) => (
          <div key={src} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border/40 bg-muted/20">
            <NextImage
              src={src}
              alt="Sample output"
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
