/**
 * Language switcher dropdown for the Navbar.
 * Persists selection to localStorage and updates document lang attribute.
 */
import { useState, useEffect } from "react";
import { LANGUAGES, getPreferredLanguage, setLanguage, type LangCode } from "@/lib/i18n";
import { Globe } from "lucide-react";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<LangCode>("en");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLang(getPreferredLanguage());
  }, []);

  const handleChange = (code: LangCode) => {
    setLang(code);
    setLanguage(code);
    setOpen(false);
    // Trigger Google Translate if available, otherwise rely on our i18n strings
    if (code !== "en" && typeof window !== "undefined") {
      // Add Google Translate meta tag dynamically
      const existing = document.querySelector('meta[name="google"]');
      if (!existing) {
        const meta = document.createElement("meta");
        meta.name = "google";
        meta.content = "notranslate";
        document.head.appendChild(meta);
      }
    }
    window.location.reload(); // Reload to apply language changes
  };

  const current = LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-8 px-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-xs"
        aria-label="Change language"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="hidden sm:inline">{current?.flag}</span>
        <span className="hidden md:inline text-muted-foreground">{current?.code.toUpperCase()}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 max-h-80 overflow-y-auto rounded-xl bg-black/95 backdrop-blur-xl border border-white/10 shadow-2xl p-1">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleChange(l.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                  lang === l.code
                    ? "bg-cyan-500/15 text-cyan-400"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <span className="flex-1 text-left">{l.name}</span>
                {lang === l.code && <span className="text-cyan-400 text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
