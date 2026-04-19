/**
 * Competitor comparison page data. Each entry becomes /vs/<slug>.
 *
 * Targets high-buying-intent searches: "midjourney alternative",
 * "leonardo vs ___", "runway alternative free trial". These keywords
 * outrank generic tool pages by intent, and we have factual ground to
 * stand on (multi-modal breadth, public API, social/gamification, niche
 * tools competitors don't ship).
 *
 * Claims must be factually accurate — pricing reflects competitor pricing
 * pages as of 2026-04-19. Update if competitors reprice.
 */

export type ComparisonRow = {
  feature: string;
  /** Short cell text, can include newline for "yes (with caveat)". */
  competitor: string;
  /** Same shape; ✓ / ✗ markers + brief detail. */
  dreamforgex: string;
};

export type Comparison = {
  slug: string;
  competitorName: string;
  competitorTagline: string;     // their positioning (one line)
  ourAngle: string;               // why DFX is a credible alternative (one line)
  heroSubtext: string;            // 2 sentences for hero copy
  introParagraphs: string[];      // 2-3 paragraphs for SEO body copy
  pricingSummary: string;         // one sentence summarising their pricing
  comparisonRows: ComparisonRow[]; // 8-12 features
  whyDfxWins: string[];           // 4-6 bullet differentiators
  whereTheyWin: string[];         // 1-3 honest concessions (builds trust + SEO)
  ctaCopy: string;                // 1 sentence above CTA buttons
};

export const COMPARISONS: Record<string, Comparison> = {
  midjourney: {
    slug: "midjourney",
    competitorName: "Midjourney",
    competitorTagline: "Aesthetic-first AI image generation, Discord-native and now web-based.",
    ourAngle: "Same image quality from the same underlying models — plus video, audio, 100+ tools, and a public API. No Discord required.",
    heroSubtext:
      "Midjourney is famous for its aesthetic quality, but it's image-only, has no free tier, no public API, and historically required Discord to use. DreamForgeX gives you Flux, Imagen, DALL-E and more in one workspace, plus video, music, virtual try-on and 100+ named tools — at a $9 starting price.",
    introParagraphs: [
      "Midjourney built its reputation on signature painterly output and a tight community on Discord. As of v8, the web app is more capable, and v8.1 brought back image prompts and a Prompt Shortener. Subscriptions start at $10/mo (Basic) and run up to $120/mo (Mega), with no free trial since 2023.",
      "If you came here looking for a Midjourney alternative, you're usually looking for one of: a free way to try, a clean web UI without Discord, a public API, or features Midjourney doesn't ship — like image-to-video, music generation, or per-tool workflows for headshots, logos, product photos, and Funko-style figures. DreamForgeX covers all of those.",
    ],
    pricingSummary:
      "Midjourney: Basic $10/mo, Standard $30/mo, Pro $60/mo, Mega $120/mo. No free tier.",
    comparisonRows: [
      { feature: "Free tier", competitor: "✗ None", dreamforgex: "✓ 50 credits/day forever" },
      { feature: "Try without signup", competitor: "✗", dreamforgex: "✓ /demo/text-to-image" },
      { feature: "Cheapest paid tier", competitor: "$10/mo", dreamforgex: "$9/mo" },
      { feature: "Web UI (no Discord)", competitor: "✓ (recent)", dreamforgex: "✓ from day 1" },
      { feature: "Image generation", competitor: "✓ Signature aesthetic", dreamforgex: "✓ Flux + Imagen + DALL-E + more" },
      { feature: "Video generation", competitor: "Limited (21s in v8)", dreamforgex: "✓ Veo 3, Kling, Runway, Sora" },
      { feature: "Audio / music gen", competitor: "✗", dreamforgex: "✓ MusicGen + AudioGen" },
      { feature: "Virtual try-on", competitor: "✗", dreamforgex: "✓ CatVTON" },
      { feature: "Public REST API", competitor: "✗", dreamforgex: "✓" },
      { feature: "100+ named tools", competitor: "✗ general gen only", dreamforgex: "✓ headshot / logo / Funko / etc." },
      { feature: "Marketplace + monetization", competitor: "✗", dreamforgex: "✓ Sell prompts/presets" },
      { feature: "Commercial license at base", competitor: "Standard tier+", dreamforgex: "✓ from $9 tier" },
    ],
    whyDfxWins: [
      "Image gen quality matches MJ on the latest Flux / Imagen models — the moat is shrinking fast.",
      "Public REST API lets you embed DFX into your own apps; Midjourney has none.",
      "Video, music, and niche tools (action figure, virtual try-on, etc.) all in the same credit pool.",
      "Real free tier — 50 credits/day forever, no card required.",
      "Try-before-buy demo with no signup at /demo/text-to-image.",
    ],
    whereTheyWin: [
      "Midjourney's signature aesthetic is still iconic — if you love their look specifically, no model fully replicates it.",
      "The MJ Discord community is mature and offers real-time critique you won't get on DFX.",
    ],
    ctaCopy: "Try DreamForgeX free for one image — no signup, no card.",
  },

  leonardo: {
    slug: "leonardo",
    competitorName: "Leonardo.Ai",
    competitorTagline: "Multi-model AI creative suite with realtime canvas.",
    ourAngle: "Same multi-model breadth, plus video gen, music, niche workflow tools, and a public API — at a tighter price.",
    heroSubtext:
      "Leonardo.Ai pioneered the multi-model canvas approach with Phoenix, Alchemy, and Flow. DreamForgeX takes that further with video gen, audio, character consistency, virtual try-on, and 100+ named tools — plus a public REST API Leonardo doesn't offer.",
    introParagraphs: [
      "Leonardo.Ai is a strong multi-model platform with a polished canvas, brand kits, and a generous 150-token-per-day free tier. Paid plans run $12 (Apprentice) → $30 (Artisan) → $60 (Maestro) per month. Their proprietary Phoenix model handles prompt adherence well, and Flow handles short-form video.",
      "DreamForgeX's pitch: same multi-model orchestration (Flux, DALL-E, Imagen, plus self-hosted Flux on RunPod for cost), but with deeper video (Veo 3, Kling, Sora), full audio generation (MusicGen, voiceover), niche tools (action figures, comics, virtual try-on, T-shirt designer), and a public REST API for embedding in your own products.",
    ],
    pricingSummary:
      "Leonardo: Free 150/day, Apprentice $12, Artisan $30, Maestro $60/mo.",
    comparisonRows: [
      { feature: "Free tier", competitor: "✓ 150 tokens/day", dreamforgex: "✓ 50 credits/day + try-without-signup" },
      { feature: "Cheapest paid tier", competitor: "$12/mo", dreamforgex: "$9/mo" },
      { feature: "Multi-model canvas", competitor: "✓ Phoenix / FLUX", dreamforgex: "✓ Flux / Imagen / DALL-E" },
      { feature: "Video generation", competitor: "✓ Flow (short)", dreamforgex: "✓ Veo 3, Kling, Sora, Runway" },
      { feature: "Audio / music gen", competitor: "✗", dreamforgex: "✓ MusicGen + AudioGen + TTS" },
      { feature: "Virtual try-on", competitor: "✗", dreamforgex: "✓ CatVTON (self-hosted)" },
      { feature: "Character consistency", competitor: "✓ Limited", dreamforgex: "✓ Character library" },
      { feature: "Public REST API", competitor: "✗", dreamforgex: "✓" },
      { feature: "Niche workflow tools", competitor: "✗", dreamforgex: "✓ 100+ (Funko, comics, etc.)" },
      { feature: "Marketplace", competitor: "✗", dreamforgex: "✓" },
    ],
    whyDfxWins: [
      "Audio generation (music, sound effects, TTS) lives alongside images and video.",
      "Self-hosted Flux on RunPod = lower per-generation cost we pass on to you.",
      "Public API for embedding in your own apps — Leonardo gates this.",
      "Branded niche tools (action figure / Funko / pet-to-person / comic strip) for trending viral content.",
    ],
    whereTheyWin: [
      "Leonardo's Phoenix is a solid in-house foundation model with strong prompt adherence.",
      "Their LoRA / fine-tune UX is more developed than ours today.",
    ],
    ctaCopy: "Generate one image free — no card, no signup.",
  },

  runway: {
    slug: "runway",
    competitorName: "Runway",
    competitorTagline: "Pro-grade AI video editing — Gen-4.5, Aleph, Act-Two motion capture.",
    ourAngle: "Same Gen-4-class video output, plus image gen, audio, and 100+ tools — at consumer pricing.",
    heroSubtext:
      "Runway leads the pack on professional AI video editing with Gen-4.5 and Aleph. DreamForgeX wraps the same generation chain (Veo 3, Kling, Runway, Sora) with image gen, audio, and 100+ named tools — at a starting tier of $9/mo instead of Runway's $12.",
    introParagraphs: [
      "Runway built the strongest professional AI video toolkit available — Gen-4.5 for high-fidelity gen, Aleph for in-context video editing via prompt, Act-Two for smartphone-driven motion capture. Plans run Free 125-credit → Standard $12 → Pro $28 → Unlimited $76 per month.",
      "If you came looking for a Runway alternative, the usual reasons are: lower entry price, broader toolkit (image + audio in the same workspace), or a public API. DreamForgeX gives you all three, while still routing to Runway's models when they're the right call.",
    ],
    pricingSummary:
      "Runway: Free 125 credits, Standard $12 (625), Pro $28 (2,250), Unlimited $76/mo.",
    comparisonRows: [
      { feature: "Free tier", competitor: "✓ 125 one-time credits", dreamforgex: "✓ 50 credits/day forever" },
      { feature: "Cheapest paid tier", competitor: "$12/mo", dreamforgex: "$9/mo" },
      { feature: "Image generation", competitor: "Limited", dreamforgex: "✓ Flux / Imagen / DALL-E" },
      { feature: "Video generation", competitor: "✓ Gen-4.5, Aleph", dreamforgex: "✓ Veo 3, Kling, Sora, Runway" },
      { feature: "Audio / music gen", competitor: "Limited", dreamforgex: "✓ MusicGen + voiceover" },
      { feature: "Niche tools (logos, headshots, etc.)", competitor: "✗", dreamforgex: "✓ 100+" },
      { feature: "Public REST API", competitor: "✓ Enterprise", dreamforgex: "✓ from $9 tier" },
      { feature: "Marketplace", competitor: "✗", dreamforgex: "✓" },
    ],
    whyDfxWins: [
      "Image, video, and audio in one credit pool — no juggling subscriptions.",
      "Public REST API available from the $9 tier instead of enterprise-only.",
      "100+ named tools wrap the underlying models with use-case-tuned prompts.",
      "Lower entry price ($9 vs $12) for users who don't need Runway's pro video editor depth.",
    ],
    whereTheyWin: [
      "Aleph (prompt-driven edits to existing video) is genuinely best-in-class.",
      "Act-Two motion capture from a smartphone video is Runway's exclusive frontier.",
      "If you're a pro video editor, Runway's UI is more depth-focused than DFX's.",
    ],
    ctaCopy: "Try image gen free — no signup. Then upgrade for Runway-class video.",
  },

  ideogram: {
    slug: "ideogram",
    competitorName: "Ideogram",
    competitorTagline: "Best-in-class AI typography and text-in-image rendering.",
    ourAngle: "We route text-heavy prompts through Ideogram-class models too — and add video, audio, and 100+ tools.",
    heroSubtext:
      "Ideogram is the best image model for accurate text rendering — logos, posters, packaging, comic panels with legible captions. DreamForgeX uses similar text-specialist routing and adds the rest of the creative stack: video, audio, virtual try-on, comic strips.",
    introParagraphs: [
      "Ideogram 3.0 set the bar for typography-in-image — claimed ~95% text-in-image accuracy, Magic Prompt for autocomplete, and a Canvas with Magic Fill / Extend. Pricing: Basic $8, Plus $20, Pro $60 per month, with credits that expire monthly.",
      "If you need text-on-image (logos, posters, packaging, ad creative), Ideogram is genuinely strong. DreamForgeX also routes text-heavy prompts through specialist models (Ideogram, Nano Banana Pro), and on top of that ships full image gen, video, audio, character consistency, virtual try-on, and 100+ named tools — all in one credit pool.",
    ],
    pricingSummary:
      "Ideogram: Basic $8, Plus $20, Pro $60/mo. Credits expire monthly.",
    comparisonRows: [
      { feature: "Free tier", competitor: "✓ Limited", dreamforgex: "✓ 50 credits/day + try-without-signup" },
      { feature: "Cheapest paid tier", competitor: "$8/mo", dreamforgex: "$9/mo" },
      { feature: "Text-in-image quality", competitor: "✓ Class-leading", dreamforgex: "✓ Routes via Ideogram-class models" },
      { feature: "Image gen breadth", competitor: "Image-only", dreamforgex: "✓ Flux / Imagen / DALL-E + more" },
      { feature: "Video generation", competitor: "✗", dreamforgex: "✓ Veo 3, Kling, Sora" },
      { feature: "Audio / music gen", competitor: "✗", dreamforgex: "✓ MusicGen + voiceover" },
      { feature: "Credit expiration", competitor: "Monthly", dreamforgex: "Rollover up to plan limit" },
      { feature: "Public REST API", competitor: "Limited", dreamforgex: "✓" },
      { feature: "Niche workflow tools", competitor: "✗", dreamforgex: "✓ 100+" },
    ],
    whyDfxWins: [
      "Text-in-image AND video, audio, virtual try-on — Ideogram is image-only.",
      "Credits roll over instead of evaporating monthly.",
      "Public API + marketplace for embedding and monetization.",
    ],
    whereTheyWin: [
      "If you only need text-on-image and nothing else, Ideogram's specialist focus is a strength.",
      "Their Style Reference library has more presets than ours today.",
    ],
    ctaCopy: "Try DreamForgeX free — see the difference one credit pool makes.",
  },

  krea: {
    slug: "krea",
    competitorName: "Krea.ai",
    competitorTagline: "Real-time AI canvas with sub-50ms feedback.",
    ourAngle: "Same multi-model breadth (60+ models) plus a public API and full audio/video stack.",
    heroSubtext:
      "Krea pioneered the real-time AI canvas with Krea Realtime 14B and is one of the most aggressive multi-model aggregators. DreamForgeX matches the multi-model breadth and adds full audio gen, niche workflow tools, and a public REST API.",
    introParagraphs: [
      "Krea built one of the slickest real-time generation experiences out there — sub-50ms canvas feedback, voice-mode prompting, and a Nodes workflow builder. Pricing: Free 100/day, Basic $9, Pro $35, Max $70, Business $200+/mo. Real-time canvas is genuinely their #1 differentiator.",
      "DreamForgeX won't pretend to match real-time canvas latency yet — that's on the roadmap. What we do match: the multi-model breadth (we route through Flux, Imagen, DALL-E, Veo, Kling, Sora, Ideogram), and we go further on public API access, audio generation, and named workflow tools (action figure, virtual try-on, comic strip, etc.).",
    ],
    pricingSummary:
      "Krea: Free 100/day, Basic $9, Pro $35, Max $70, Business $200+/mo.",
    comparisonRows: [
      { feature: "Free tier", competitor: "✓ 100/day", dreamforgex: "✓ 50/day + try-without-signup" },
      { feature: "Cheapest paid tier", competitor: "$9/mo", dreamforgex: "$9/mo" },
      { feature: "Real-time canvas", competitor: "✓ Sub-50ms", dreamforgex: "On roadmap (T3)" },
      { feature: "Multi-model image gen", competitor: "✓ 60+", dreamforgex: "✓ 30+ across all media" },
      { feature: "Video generation", competitor: "✓ Realtime first-frames", dreamforgex: "✓ Veo 3, Kling, Sora" },
      { feature: "Audio / music gen", competitor: "Limited", dreamforgex: "✓ MusicGen + AudioGen + voiceover" },
      { feature: "Public REST API", competitor: "Limited", dreamforgex: "✓ from $9 tier" },
      { feature: "Niche workflow tools", competitor: "✗", dreamforgex: "✓ 100+" },
      { feature: "Marketplace", competitor: "✗", dreamforgex: "✓" },
    ],
    whyDfxWins: [
      "Full audio gen pipeline (music, voice, SFX) — Krea is mostly image+video.",
      "Public REST API on the $9 tier for embedding in your own products.",
      "100+ branded niche tools that turn one prompt into a finished, on-brief output.",
    ],
    whereTheyWin: [
      "Real-time canvas latency is genuinely best-in-class — we'll match it on the Tier 3 roadmap.",
      "Krea's Nodes workflow builder is more mature than anything we ship today.",
      "Their voice-mode canvas is an interesting interface bet that's worth trying.",
    ],
    ctaCopy: "Try DreamForgeX free — same pricing, broader media stack.",
  },
};
