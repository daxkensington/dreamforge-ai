# Google Search Console — Indexing Request Batches

Submit via Search Console → URL Inspection → Request Indexing, one URL at a time.
GSC limits to ~10-12 requests/day, so this is split into batches.

**Property:** `https://dreamforgex.ai` (verified via Google site owner OAuth)

---

## Batch 1 — Day 2 (image editing tools)

1. https://dreamforgex.ai/tools/inpainting
2. https://dreamforgex.ai/tools/outpainting
3. https://dreamforgex.ai/tools/face-enhancer
4. https://dreamforgex.ai/tools/color-grading
5. https://dreamforgex.ai/tools/style-transfer
6. https://dreamforgex.ai/tools/object-eraser
7. https://dreamforgex.ai/tools/image-blender
8. https://dreamforgex.ai/tools/variations
9. https://dreamforgex.ai/tools/photo-restore
10. https://dreamforgex.ai/tools/photo-colorize

---

## Batch 2 — Day 3 (creative generation)

1. https://dreamforgex.ai/tools/avatar
2. https://dreamforgex.ai/tools/wallpaper
3. https://dreamforgex.ai/tools/qr-art
4. https://dreamforgex.ai/tools/product-photo
5. https://dreamforgex.ai/tools/text-effects
6. https://dreamforgex.ai/tools/sketch-to-image
7. https://dreamforgex.ai/tools/vectorize
8. https://dreamforgex.ai/tools/texture
9. https://dreamforgex.ai/tools/icon-gen
10. https://dreamforgex.ai/tools/thumbnail

---

## Batch 3 — Day 4 (video + workflow)

1. https://dreamforgex.ai/tools/text-to-video
2. https://dreamforgex.ai/tools/image-to-video
3. https://dreamforgex.ai/tools/music-video
4. https://dreamforgex.ai/tools/social-templates
5. https://dreamforgex.ai/tools/clip-maker
6. https://dreamforgex.ai/tools/presentations
7. https://dreamforgex.ai/tools/batch-prompts
8. https://dreamforgex.ai/tools/social-resize
9. https://dreamforgex.ai/tools/prompt-builder
10. https://dreamforgex.ai/video-studio

---

## Batch 4 — Day 5 (33 new tools — highest-value 10)

1. https://dreamforgex.ai/tools/pixel-art
2. https://dreamforgex.ai/tools/coloring-book
3. https://dreamforgex.ai/tools/tattoo-design
4. https://dreamforgex.ai/tools/pet-portrait
5. https://dreamforgex.ai/tools/pose-turnaround
6. https://dreamforgex.ai/tools/listing-photos
7. https://dreamforgex.ai/tools/real-estate-twilight
8. https://dreamforgex.ai/tools/yt-thumbnails
9. https://dreamforgex.ai/tools/ig-carousel
10. https://dreamforgex.ai/tools/brand-style-guide

---

## Batch 5 — Day 6 (remaining new tools)

1. https://dreamforgex.ai/tools/cover-maker
2. https://dreamforgex.ai/tools/podcast-cover
3. https://dreamforgex.ai/tools/fashion-lookbook
4. https://dreamforgex.ai/tools/meme-template
5. https://dreamforgex.ai/tools/sticker-pack
6. https://dreamforgex.ai/tools/recipe-card
7. https://dreamforgex.ai/tools/invitation
8. https://dreamforgex.ai/tools/business-card
9. https://dreamforgex.ai/tools/tarot-card
10. https://dreamforgex.ai/tools/movie-poster

---

## Batch 6 — Day 7 (final drop)

1. https://dreamforgex.ai/tools/trading-card
2. https://dreamforgex.ai/tools/menu-design
3. https://dreamforgex.ai/tools/greeting-card
4. https://dreamforgex.ai/tools/emoji-creator
5. https://dreamforgex.ai/tools/event-flyer
6. https://dreamforgex.ai/tools/certificate
7. https://dreamforgex.ai/tools/bookmark
8. https://dreamforgex.ai/tools/zine-spread
9. https://dreamforgex.ai/tools/concert-poster
10. https://dreamforgex.ai/tools/architecture-concept
11. https://dreamforgex.ai/tools/cosplay-reference
12. https://dreamforgex.ai/tools/travel-postcard

---

## Gotchas

- **GSC Puppeteer automation is broken** (Chrome 147 synthetic-event block, 2026-04-15). Manual submission only.
- **Vercel bot wall** blocks Node fetch against these URLs — verify pages load live in a real browser first.
- Sitemap at `https://dreamforgex.ai/sitemap.xml` will carry them too; crawler should discover organically within days even without manual submit.
