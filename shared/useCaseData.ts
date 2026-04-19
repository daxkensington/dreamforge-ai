/**
 * Use-case landing page data. Each entry becomes /for/<slug>.
 * Targets buyer-intent queries ("AI tools for etsy sellers", etc.) that
 * individual tool pages can't rank for.
 */

export type UseCaseTool = { slug: string; why: string };

export type UseCase = {
  slug: string;
  audience: string;        // "Etsy sellers", "podcasters"
  title: string;           // H1, 50-70 chars
  tagline: string;         // subtitle, 100-150 chars
  intro: string;           // 2 paragraphs, 120-180 words
  painPoints: string[];    // 3-4 common pains
  tools: UseCaseTool[];    // 6-10 curated tools + why each helps
  outcome: string;         // 60-80 word "here's what you can ship in a day" closer
};

export const USE_CASES: Record<string, UseCase> = {
  "etsy-sellers": {
    slug: "etsy-sellers",
    audience: "Etsy sellers",
    title: "AI tools for Etsy sellers — listing photos, mockups, stickers, printables",
    tagline: "Stop paying for 5 different apps. DreamForgeX bundles every creator tool an Etsy seller needs into one subscription — commercial-use included.",
    intro: "Running an Etsy shop means doing your own photography, mockups, product listings, seasonal printables, and social assets. The usual answer is a stack of single-purpose tools that each cost $10-30/month and still don't talk to each other. DreamForgeX gives you the whole production line in one workspace. Upload one product shot, get five pro-angle listing photos. Type one line, get print-ready sticker packs, wall-art posters, and coloring pages ready for Gelato or Printful. Every output is yours commercially — no attribution needed.",
    painPoints: [
      "Amateur-looking product photos hurting conversion",
      "Paying $120+/year for Remove.bg, Placeit, Canva Pro, and Midjourney — separately",
      "Running out of seasonal printable ideas",
      "Needing a logo, brand colors, and consistent style across a shop",
    ],
    tools: [
      { slug: "listing-photos", why: "Turn one product photo into 5 pro angles — hero, detail, lifestyle, scale, flatlay. Same product, instant listing pack." },
      { slug: "product-photo", why: "Generate clean studio shots when you don't have a photo yet." },
      { slug: "background", why: "Clean transparent PNGs for Printful / Printify / Gelato uploads." },
      { slug: "mockup", why: "Place any design on t-shirts, mugs, phone cases, tote bags for mockups." },
      { slug: "sticker-pack", why: "Coordinated 3-8 sticker packs for Telegram packs or vinyl prints." },
      { slug: "coloring-book", why: "Printable line-art pages — high-volume Etsy category." },
      { slug: "bookmark", why: "2x6 literary bookmarks ready to print and ship." },
      { slug: "logo-maker", why: "Shop logo + variations for social, thumbnails, packaging." },
      { slug: "brand-style-guide", why: "Color palette + typography + logo as a one-page reference." },
    ],
    outcome: "In an afternoon you can: refresh 10 listings with pro photos, ship 3 new printable products, design a coordinated sticker pack, and finalize a shop brand. All commercially usable, all downloaded in minutes.",
  },

  "podcasters": {
    slug: "podcasters",
    audience: "podcasters",
    title: "AI tools for podcasters — cover art, episode thumbnails, voiceover, audio cleanup",
    tagline: "Everything a podcaster needs to produce, brand, and promote episodes — cover art, show notes, audio polish, promo clips — in one tool.",
    intro: "A podcast isn't one job. It's cover art for every directory (Spotify, Apple, YouTube), thumbnails for each episode, show notes, promo videos, audio cleanup, and a voiceover when your guest bails. DreamForgeX handles the production stack in one place. Pick a genre, get a Spotify-grid-optimized 3000×3000 cover. Paste your chapter list, get 10 episode thumbnails. Drop a noisy recording in, get a clean export. Generate a host voiceover for intros. Cover, thumbnails, audio, and promo in under an hour — not three subscriptions and a weekend.",
    painPoints: [
      "Cover art that looks generic and gets skipped in Spotify's grid",
      "Writing show notes manually for every episode",
      "Episode thumbnails that take longer than editing the episode",
      "Audio with background hum you can't fix in free tools",
    ],
    tools: [
      { slug: "podcast-cover", why: "3000×3000 square optimized for Spotify + Apple thumbnail visibility." },
      { slug: "yt-thumbnails", why: "Batch per-episode YouTube thumbnails from your chapter list." },
      { slug: "audio-enhance", why: "Clean background noise, normalize levels, pro-grade polish." },
      { slug: "text-to-speech", why: "Host-quality voiceover when you need filler or intros without a record." },
      { slug: "sound-effects", why: "Custom SFX for intros, transitions, brand stingers." },
      { slug: "caption-writer", why: "Auto-draft show notes + social captions from your episode summary." },
      { slug: "clip-maker", why: "Pull the most-shareable 30-60 sec clips from a full episode." },
      { slug: "social-templates", why: "TikTok / Reels / Shorts promo templates for each episode." },
    ],
    outcome: "One episode-day workflow: record → enhance audio → batch thumbnail per chapter → draft show notes + captions → export viral clips for TikTok. All done in under an hour, all commercially yours.",
  },

  "real-estate-agents": {
    slug: "real-estate-agents",
    audience: "real estate agents",
    title: "AI tools for real estate — twilight exteriors, staging, MLS-ready photos, flyers",
    tagline: "Turn ordinary listing photos into MLS-showstoppers. Twilight exteriors, interior staging, marketing flyers, and open-house invites — all from the photos you already have.",
    intro: "Listing photos sell homes. But the best-selling shots — twilight exteriors with glowing windows, staged interiors that tell a story, polished marketing flyers — usually require a separate photographer, a staging company, and a graphic designer. DreamForgeX turns the listing photos you shot yourself into that quality tier. Upload a daytime exterior, get a twilight magic-hour version. Upload an empty room, get it virtually staged in 10 styles. Type the address and open-house time, get a print-ready flyer. Sell homes faster without the production budget.",
    painPoints: [
      "Daytime exteriors that don't drive click-throughs on Zillow / MLS",
      "Empty listings that feel cold to buyers",
      "Paying a marketing designer $100+ per flyer",
      "Needing professional headshots for the bio on every listing",
    ],
    tools: [
      { slug: "real-estate-twilight", why: "Daytime exterior → golden hour / twilight with glowing window lights. The MLS hero shot." },
      { slug: "interior-design", why: "Virtually stage any empty room in 10 styles — modern, farmhouse, luxury, etc." },
      { slug: "relight", why: "Brighten dim interior photos without re-shooting." },
      { slug: "hdr-enhance", why: "Balance blown-out windows and dark interiors in a single shot." },
      { slug: "photo-restore", why: "Rescue older archive photos for historic listings." },
      { slug: "event-flyer", why: "Open-house + price-drop flyers in minutes, any design style." },
      { slug: "invitation", why: "Open-house invitations that feel like events, not junk mail." },
      { slug: "headshot", why: "Professional agent headshots from any photo — LinkedIn, bio, listings." },
      { slug: "business-card", why: "Matching front + back card design aligned with your brand." },
    ],
    outcome: "New listing workflow: shoot the home once, generate 3 twilight hero shots + 6 virtually staged rooms + an open-house flyer + a matching invitation. Under an hour start to finish, professional throughout.",
  },

  "cosplayers": {
    slug: "cosplayers",
    audience: "cosplayers",
    title: "AI tools for cosplayers — costume references, pose sheets, prop concepts",
    tagline: "Plan your next build faster. Multi-angle reference sheets, prop breakdowns, and stitched-together concept art for costumes you're actually going to make.",
    intro: "Great cosplay starts with great reference. But finding a clean multi-angle breakdown of a fan-made character, or sketching out a variation of an existing one, usually means hours of screenshotting and patchwork. DreamForgeX gives you a proper concept-artist workflow. Describe the character, get consistent front / side / back views with seams, fabric textures, and accessory detail visible. Plan weapons separately. Render a face / makeup-only reference for the final pass. Built for people actually sewing and stitching, not just dreaming.",
    painPoints: [
      "Single-angle reference screenshots missing the back / side",
      "No good way to plan prop or weapon detail separately",
      "Makeup references that don't match the costume lighting",
      "Losing an hour compositing reference sheets by hand",
    ],
    tools: [
      { slug: "cosplay-reference", why: "Multi-view costume breakdown with seams, fabric, accessories visible — front / 3-quarter / side / back." },
      { slug: "pose-turnaround", why: "Turnaround reference for a custom character design in any style." },
      { slug: "character-sheet", why: "Full character concept sheet — expression, costume, silhouette." },
      { slug: "tattoo-design", why: "Temporary tattoo / body art design for character details." },
      { slug: "meme-template", why: "In-character meme shots for social — drives convention clout." },
      { slug: "sticker-pack", why: "Die-cut stickers of your cosplay for convention tables." },
    ],
    outcome: "Before your next build: generate a 3-view costume reference, a prop / weapon breakdown, a makeup close-up, and a few promo stickers for your convention table. Ready to hand to your seamstress the same day.",
  },

  "indie-devs": {
    slug: "indie-devs",
    audience: "indie game developers",
    title: "AI tools for indie game devs — pixel art, character design, textures, trading cards",
    tagline: "Ship a game without hiring an artist. Pixel sprites, character turnarounds, tileable textures, 3D model concepts, and trading-card art — game-ready assets on demand.",
    intro: "Most indie devs aren't blocked by engine complexity — they're blocked by art. DreamForgeX lets a solo dev build the visual pipeline for a real game. Generate game-ready pixel sprites in 8/16/32-bit with palette presets. Design consistent character turnarounds for your protagonist. Export tileable seamless textures for environments. Prototype 3D models for Unity or Godot. Design trading cards if you're building a TCG. All commercial-use, no attribution, no royalties.",
    painPoints: [
      "Placeholder art that kills prototype demos",
      "Inconsistent character art between scenes",
      "Paying per-asset rates on fiverr that blow your dev budget",
      "Spending weeks on texture work that's not your strength",
    ],
    tools: [
      { slug: "pixel-art", why: "Game-ready 8/16/32-bit sprites + tilesets with palette presets (Gameboy, NES, SNES, PICO-8, C64)." },
      { slug: "character-sheet", why: "Consistent character design across scenes, expressions, poses." },
      { slug: "pose-turnaround", why: "Front / side / back / three-quarter views for 3D reference or sprite rotation." },
      { slug: "3d-generator", why: "Image-to-3D GLB model for Unity, Godot, or Unreal import." },
      { slug: "texture", why: "Tileable seamless textures — stone, wood, grass, cyberpunk panels." },
      { slug: "trading-card", why: "Custom TCG card frames if you're building a card-game mode." },
      { slug: "icon-gen", why: "App icons, ability icons, inventory icons — consistent style." },
      { slug: "music-gen", why: "Soundtrack loops + stingers for a prototype without licensing." },
      { slug: "sound-effects", why: "UI beeps, combat SFX, ambient layers — all you need for a vertical slice." },
    ],
    outcome: "Vertical slice in a week: protagonist character sheet + 4 NPC turnarounds + tileable environment textures + 10 item icons + a soundtrack loop + 3 combat SFX. A playable demo with a coherent visual identity, built solo.",
  },

  "authors": {
    slug: "authors",
    audience: "authors and self-publishers",
    title: "AI tools for authors — book covers, author headshots, bookmarks, launch assets",
    tagline: "Self-publish like a traditional house. Professional covers, author photos, bookmarks, launch invitations, and promo graphics — the whole book-launch kit in one place.",
    intro: "Self-publishing rewards authors who can produce their own marketing assets. A generic cover buys you $0. A pro cover, matching bookmarks, a polished headshot, launch-party invites, and social graphics buy you a chance. DreamForgeX is the whole kit. Type a title and genre, get three cover comps. Upload any photo, get a LinkedIn-ready author headshot. Design a bookmark to include with every Amazon order or hand out at book fairs. Plan a launch.",
    painPoints: [
      "Generic book cover templates that signal 'self-published' from a mile away",
      "Author headshot that doesn't match the book's tone",
      "Running a launch party with zero design support",
      "Wanting printable bookmarks / swag but not knowing where to start",
    ],
    tools: [
      { slug: "cover-maker", why: "Book, eBook, audiobook, magazine covers with genre-appropriate artwork + typography." },
      { slug: "headshot", why: "Author photo that matches your book's tone — corporate, creative, literary." },
      { slug: "bookmark", why: "2×6 printable bookmarks — insert in every shipped copy or hand out at events." },
      { slug: "invitation", why: "Book launch party invitation in elegant, playful, vintage, or minimalist." },
      { slug: "thumbnail", why: "BookTok / Instagram promo thumbnails optimized for click-through." },
      { slug: "tarot-card", why: "Character concept cards or promo decks for fantasy releases." },
      { slug: "zine-spread", why: "Multi-page magazine-style teaser spread for launch week." },
      { slug: "blog-writer", why: "Long-form blog posts about your book for author website SEO." },
      { slug: "ad-copy", why: "Facebook / Amazon ad copy that doesn't read like a blurb generator." },
    ],
    outcome: "Launch-week kit: 3 cover comps + author headshot + matching bookmark + launch invitation + 5 BookTok thumbnails + a blog post announcement. Your whole marketing package, ready to print.",
  },

  "restaurants": {
    slug: "restaurants",
    audience: "restaurant owners",
    title: "AI tools for restaurants — menus, recipe cards, event flyers, food photography",
    tagline: "Run a tighter restaurant marketing shop. Print-ready menus, share-worthy recipe cards, food photography, event flyers, and branded assets — no external designer required.",
    intro: "A restaurant marketing budget is always tight. Menus need redesigns every seasonal rotation. Recipe cards sell on Instagram and drive Pinterest traffic. Food photos sell the dish before the customer arrives. Event flyers fill slow nights. DreamForgeX handles the whole visual side of a restaurant without a designer on retainer. Paste your updated menu sections, get a bi-fold or tri-fold print-ready layout. Describe your signature dish, get Pinterest-ready recipe cards. Hosting a wine night? A flyer in a minute.",
    painPoints: [
      "Menu updates that cost $150 each from a designer",
      "Social posts using generic Canva templates that look like every other restaurant",
      "Slow Tuesdays with nothing to promote",
      "Recipe cards that take hours in Photoshop",
    ],
    tools: [
      { slug: "menu-design", why: "Print-ready menus in 8 styles × 3 formats (single, bi-fold, tri-fold)." },
      { slug: "recipe-card", why: "Pinterest-ready recipe cards with hero food photo + ingredients + steps." },
      { slug: "product-photo", why: "Studio-quality food photography when you don't have a photographer." },
      { slug: "event-flyer", why: "Promote wine nights, chef's specials, live-music events in minutes." },
      { slug: "invitation", why: "Private-event / catered-event invitations for VIP or corporate clients." },
      { slug: "social-templates", why: "TikTok / Reels / Shorts templates for dish-of-the-day posts." },
      { slug: "logo-maker", why: "Restaurant logo refresh or sub-brand (kids menu, brunch, specials)." },
      { slug: "caption-writer", why: "Caption + hashtag sets for Instagram and Google Business Profile posts." },
    ],
    outcome: "Weekly rhythm: Monday redesigns the specials menu, Wednesday publishes 3 recipe cards to Pinterest, Thursday drops an event flyer for Friday's live music. Professional output, zero external design cost.",
  },

  "tattoo-artists": {
    slug: "tattoo-artists",
    audience: "tattoo artists",
    title: "AI tools for tattoo artists — stencil + color concepts, flash sheets, shop branding",
    tagline: "Faster concept-to-consult workflow. Stencil and full-color variants for client consultations, flash sheet generation, and shop branding — all in one place.",
    intro: "Every tattoo starts with a conversation. But the gap between 'client idea' and 'stencil I can work from' is where most shops lose hours per week. DreamForgeX compresses that gap. Client says 'wolf with roses'? In 30 seconds you have a traditional flash version in both stencil (black only, transfer-ready) and full-color to show them what the finished piece will look like. Their input refines the prompt, you iterate, and the stencil goes onto the table. Plus: shop branding, social posts, and merch design.",
    painPoints: [
      "Consults that drag because the client can't visualize what they want",
      "Hours spent drafting stencil variations for every concept",
      "Missing Instagram / TikTok posting cadence because designing takes all day",
      "Needing merch / stickers / shop cards but no design skills",
    ],
    tools: [
      { slug: "tattoo-design", why: "Stencil + full-color variants in 10 styles (traditional, blackwork, fineline, realism, watercolor) — placement-aware." },
      { slug: "style-transfer", why: "Convert any reference image into traditional, Japanese, or blackwork style." },
      { slug: "sketch-to-image", why: "Quick rough sketch → polished flash concept in seconds." },
      { slug: "pose-turnaround", why: "Visualize how a body piece flows across the forearm / ribcage / back." },
      { slug: "logo-maker", why: "Shop logo + sub-brand (apprentice work, guest-spots, merch line)." },
      { slug: "sticker-pack", why: "Die-cut stickers for convention tables and walk-in promos." },
      { slug: "tshirt-designer", why: "DTG-ready shop merch designs." },
      { slug: "business-card", why: "Matching card design tied to shop brand." },
    ],
    outcome: "Consult-day workflow: client describes the idea → generate stencil + color version → iterate 2-3 times → print the stencil. Previously 45 min of back-and-forth, now 5. Your calendar opens up.",
  },
};

export const USE_CASE_SLUGS = Object.keys(USE_CASES);
