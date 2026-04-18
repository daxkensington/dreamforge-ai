"use client";

import { usePathname } from "next/navigation";
import { TOOL_SEO_COPY } from "../../../shared/toolSeoCopy";

// Reads the current /tools/<slug> pathname, looks up structured copy, and
// renders a below-fold SEO section. Returns null if no copy is present, so
// tools without entries are unaffected.
export function ToolSEOBlock() {
  const pathname = usePathname() || "";
  const match = pathname.match(/^\/tools\/([^/?#]+)/);
  const slug = match?.[1];
  if (!slug) return null;

  const entry = TOOL_SEO_COPY[slug];
  if (!entry) return null;

  return (
    <section className="border-t border-border/30 bg-gradient-to-b from-transparent to-background/50">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Intro */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            What is {entry.title}?
          </h2>
          <p className="text-base leading-relaxed text-foreground/75">{entry.intro}</p>
        </div>

        {/* How it works */}
        {entry.howItWorks.length > 0 && (
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">How it works</h2>
            <ol className="space-y-4">
              {entry.howItWorks.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed text-foreground/80">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Use cases */}
        {entry.useCases.length > 0 && (
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Popular use cases</h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {entry.useCases.map((uc, i) => (
                <li key={i} className="flex gap-3 p-4 rounded-xl border border-border/30 bg-card/30">
                  <span className="size-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                  <span className="text-sm leading-relaxed text-foreground/80">{uc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FAQ */}
        {entry.faq.length > 0 && (
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Frequently asked questions</h2>
            <div className="space-y-4">
              {entry.faq.map((item, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-border/30 bg-card/30 overflow-hidden"
                >
                  <summary className="cursor-pointer list-none p-5 font-medium flex items-center justify-between gap-4 hover:bg-card/50 transition-colors">
                    <span>{item.q}</span>
                    <span className="flex-shrink-0 text-foreground/40 transition-transform group-open:rotate-45 text-xl leading-none">
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-sm leading-relaxed text-foreground/75">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
