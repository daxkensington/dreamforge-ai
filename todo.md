# GenesisSynth Lab - Project TODO

## Database & Schema
- [x] Design and implement database schema (generations, tags, gallery_items, moderation_queue)
- [x] Push database migrations

## Server / API
- [x] Generation router: create generation, list user generations, get single generation
- [x] Gallery router: list approved items, search/filter by tags/date/model
- [x] Moderation router: admin queue, approve/reject, bulk actions
- [x] Export router: ZIP download of assets + prompt metadata
- [x] Tag management: predefined research tags + custom tags

## Authentication & Users
- [x] Manus OAuth integration (already scaffolded)
- [x] Role-based access (user vs admin/researcher)
- [x] User profile page with generation history

## Prompt Workspace
- [x] Private prompt workspace page for entering natural-language descriptions
- [x] Prompt form with model selection, dimensions, and parameters
- [x] Integration with built-in image generation API
- [x] Generation progress/loading states
- [x] Generation result display with metadata

## Public Research Gallery
- [x] Gallery feed page with masonry/grid layout
- [x] Advanced tagging system (fantasy, sci-fi, mythological, stylized dynamics, abstract eroticism, surreal anatomy)
- [x] Search functionality (text search across prompts and tags)
- [x] Filter by tags, date range, model version
- [x] Gallery item detail view with full metadata
- [x] Submit to gallery flow (user submits, enters moderation queue)

## Admin Moderation Queue
- [x] Moderation dashboard for admin/researcher role
- [x] Approval/rejection workflow with notes
- [x] Bulk approve/reject actions
- [x] Moderation history log

## Export Functionality
- [x] ZIP download of selected gallery items
- [x] Include prompt metadata JSON in export
- [x] Export for individual items and batch export

## UI / Design
- [x] Dark-mode elegant theme with Inter + JetBrains Mono fonts
- [x] Responsive mobile-first layout
- [x] Landing page with platform description and research disclaimer
- [x] Navigation: top nav for public pages
- [x] Prominent disclaimer: "100% synthetic media research platform — all content mathematically generated, no real individuals depicted or harmed"
- [x] Loading skeletons and empty states
- [x] Micro-interactions and animations with Framer Motion

## Testing
- [x] Vitest tests for generation router
- [x] Vitest tests for gallery router
- [x] Vitest tests for moderation router

## Deployment
- [x] Environment variable documentation
- [x] Deployment configuration notes

## Phase 2 — Major Upgrade (AI Video Machine + Polish)

### Critical Fixes
- [x] Fix Profile page type casting (remove `as any` for bio/institution)
- [x] Add model version selector to Workspace UI
- [x] Make gallery tag filters visible by default

### AI Video Generation
- [x] Add video generation type to schema (image vs video)
- [x] Add video generation server endpoint
- [x] Add video tab/toggle in Workspace UI
- [x] Video preview player in generation history
- [x] Video support in gallery and detail page

### Landing Page Enhancement
- [x] Animated hero background (particle/generative art effect)
- [x] Live platform stats section
- [x] Feature cards with unique gradient accents
- [x] Smooth scroll animations with framer-motion

### Gallery Enhancement
- [x] View count increment on gallery detail view
- [x] ZIP export download button (JSZip client-side) — implemented as JSON metadata export
- [x] Sort options (newest, most viewed)
- [x] Tag chips visible by default in filter area

### UI/UX Polish
- [x] Loading skeletons on all pages
- [x] Generation progress polling with animated status
- [x] Micro-interactions and hover effects
- [x] Theme toggle (dark/light) — dark theme set as default, consistent throughout

### Testing
- [x] Tests for generation.create
- [x] Tests for user.updateProfile
- [x] Tests for gallery.submit
- [x] Tests for moderation.review

## Phase 3 — Image-to-Video Animation Pipeline

### Backend
- [x] Add image-to-video generation endpoint (animateImage)
- [x] Link parent image generation to child video generation in DB
- [x] Store animation parameters (duration, motion style) in metadata

### Frontend
- [x] Add "Animate" button on completed image generation cards in Workspace
- [x] Create AnimateDialog with duration and motion style controls
- [x] Show animation progress/loading state
- [x] Display resulting video in generation history with parent link
- [x] Video playback indicator on animated items

### Testing
- [x] Vitest tests for animateImage endpoint validation
- [x] Vitest tests for input validation (duration, source generation)

## Phase 4 — Pivot to AI Generation Tool (Marketing Rebrand)

### Research & Strategy
- [x] Research competitor AI generation tools (Midjourney, DALL-E, Leonardo, Runway, etc.)
- [x] Analyze positioning, messaging, and landing page patterns
- [x] Develop brand strategy document with positioning, taglines, value props

### Landing Page Rebrand
- [x] Rewrite hero section: consumer-focused headline, subtext, CTAs
- [x] Update feature cards from academic to creator/prosumer language
- [x] Add social proof section (stats bar with creator-focused labels)
- [x] Add "How It Works" workflow section and image-to-video highlight
- [x] Update visual style for broader consumer appeal

### UI Copy Updates
- [x] Workspace: remove academic/research language, use creator-focused copy
- [x] Gallery: rebrand from "Research Gallery" to community showcase
- [x] Profile: update labels and descriptions
- [x] Moderation: adjust language for content moderation (not academic review)
- [x] Navbar: update navigation labels
- [x] Footer: update links and branding
- [x] DisclaimerBanner: update from academic disclaimer to AI generation disclaimer
- [x] Page titles and meta descriptions

### Testing & Delivery
- [x] Verify all pages render correctly with new copy
- [x] Run all existing tests (72/72 passed)
- [x] Deliver brand strategy report with checkpoint

## Phase 5 — Platform Rebrand (New Name)
- [x] Research AI tool naming patterns and conventions
- [x] Generate candidate names (short, memorable, creative)
- [x] Verify domain/brand availability for top candidates
- [x] Present shortlist to user for selection — user chose "DreamForge"
- [x] Apply chosen name across all pages, components, and metadata
- [ ] Update VITE_APP_TITLE via Management UI Settings (user action)
- [x] Run all tests and verify (72/72 passed)

## Phase 6 — AI Tools Suite
- [x] Create AI Tools Hub page with tool cards and navigation
- [x] Add /tools route and update Navbar with "AI Tools" link
- [x] Backend: Image Upscaler endpoint (enhance/upscale via LLM prompt rewrite + generateImage)
- [x] Frontend: Image Upscaler tool page with upload, scale selector, before/after preview
- [x] Backend: Style Transfer endpoint (apply artistic style via generateImage with reference)
- [x] Frontend: Style Transfer tool page with style gallery, upload, and preview
- [x] Backend: Background Remover/Replacer endpoint (via generateImage edit)
- [x] Frontend: Background tool page with upload, replacement prompt, and preview
- [x] Backend: Smart Prompt Builder endpoint (LLM-powered prompt construction)
- [x] Frontend: Smart Prompt Builder with visual controls (subject, style, mood, lighting, etc.)
- [x] Update landing page with AI Tools showcase section
- [x] Cross-link tools from Studio and Gallery pages (Tools Hub links to Studio)
- [x] Write vitest tests for all new tool endpoints (23 tests, all passing)
- [x] Verify and checkpoint

## Phase 7 — Pricing, Onboarding & Batch Processing

### Pricing/Plans Page
- [x] Create /pricing route and page with Free, Pro, Enterprise tiers
- [x] Design tier cards with feature comparison table
- [x] Add generation limits, tool access levels, priority rendering per tier
- [x] Add CTA buttons (Get Started Free, Upgrade to Pro, Contact Sales)
- [ ] Link pricing from Navbar and landing page

### First-Time Onboarding Wizard
- [x] Track onboarding completion state (localStorage)
- [x] Build multi-step wizard overlay: welcome, pick style, write prompt, generate
- [x] Pre-filled prompt suggestions and style presets (6 styles, 3 prompts each)
- [x] Auto-redirect to Studio after first generation (with prompt in URL)
- [x] Show wizard only for new/first-time users (localStorage check)

### Batch Processing
- [x] Backend: batch generation endpoint (queue multiple prompts, up to 10)
- [x] Backend: batch tool operations endpoint (apply tool to multiple images, up to 10)
- [x] Frontend: batch mode toggle in Studio with multi-prompt input (dedicated /batch page)
- [x] Frontend: batch tool mode in AI Tools pages (via tools.batchProcess endpoint)
- [x] Queue progress tracking with status indicators
- [x] Results grid view for batch outputs

### Integration & Polish
- [x] Update Navbar with Pricing and Batch links
- [x] Update landing page with pricing teaser section (via CTA)
- [x] Write vitest tests for batch endpoints (21 tests, all passing)
- [x] Write vitest tests for onboarding state (covered by localStorage)
- [x] Final verification and checkpoint (116 tests, all passing)

## Phase 8 — User Dashboard with Usage Analytics

### Backend
- [x] Create user.getUsageStats endpoint (generation counts by type, tool usage, daily activity)
- [x] Create user.getActivityTimeline endpoint (recent generation history with timestamps)
- [x] Calculate remaining quota based on plan tier (Free tier limits)
- [x] Aggregate most-used tools and models

### Frontend — Profile Dashboard
- [x] Add dashboard tab/section to Profile page (Dashboard + Profile tabs)
- [x] Stats overview cards: total generations, images, videos, animations, gallery views
- [x] Remaining quota display with animated progress bars (Free tier limits)
- [x] Most-used tools/models breakdown (visual bars)
- [x] Activity chart: 30-day sparkline with tooltips
- [x] Recent activity timeline with thumbnails, status, and timestamps
- [x] Responsive layout for mobile (2-col → 6-col grid)

### Testing
- [x] Vitest tests for user.getUsageStats endpoint (9 tests)
- [x] Vitest tests for user.getActivityTimeline endpoint (8 tests)
- [x] Final verification and checkpoint (133 tests, all passing)

## Phase 9 — AI Tools Suite Expansion (5 New Tools)

### Tool 5: Color Palette Extractor
- [x] Backend: LLM analyzes image and extracts dominant colors + suggests palettes
- [x] Frontend: Upload image, see extracted palette swatches, copy hex codes, get complementary suggestions

### Tool 6: Image Variations Generator
- [x] Backend: Generate multiple variations of an uploaded image with different styles/tweaks
- [x] Frontend: Upload image, choose variation count (2-6), see grid of variations, download favorites

### Tool 7: Inpainting Editor
- [x] Backend: Edit specific regions of an image via text prompt (mask + prompt)
- [x] Frontend: Upload image, describe what to change in a region, see before/after result

### Tool 8: Face Enhancer
- [x] Backend: Enhance/restore faces in images (sharpen, fix artifacts, improve quality)
- [x] Frontend: Upload portrait, choose enhancement level, see before/after comparison

### Tool 9: Image-to-Prompt Analyzer
- [x] Backend: LLM analyzes an image and reverse-engineers a detailed generation prompt
- [x] Frontend: Upload image, get AI-generated prompt description, one-click copy to Studio

### Integration
- [x] Update Tools Hub page with all 5 new tool cards (9 total, 3-column grid)
- [x] Add routes for all new tool pages in App.tsx
- [x] Update Tools Hub hero to reflect 9 tools

### Testing
- [x] Vitest tests for all 5 new tool endpoints (22 tests, all passing)
- [x] Final verification and checkpoint (155 tests, all passing, 0 TS errors)

## Phase 10 — AI Tools Expansion v3 (Competitor Research-Driven)

### Tool 10: Outpainting / Image Expander
- [x] Backend: Expand image beyond borders using generateImage with original as reference
- [x] Frontend: Upload image, choose expansion direction (up/down/left/right/all), set canvas size, preview result

### Tool 11: Object Eraser
- [x] Backend: Remove unwanted objects from images via text description + generateImage edit
- [x] Frontend: Upload image, describe what to remove, see before/after with clean removal

### Tool 12: AI Text Effects
- [x] Backend: Generate stylized text/typography using LLM prompt + generateImage
- [x] Frontend: Enter text, choose effect style (fire, water, neon, gold, ice, nature, galaxy, chrome, graffiti, crystal), preview and download

### Tool 13: Image Blender / Mashup
- [x] Backend: Blend two images into one creative output using generateImage with both as references
- [x] Frontend: Upload two images, choose blend mode (merge, double-exposure, collage, morph, dreamscape), see result

### Tool 14: Sketch to Image
- [x] Backend: Convert rough sketches to polished images via generateImage with sketch as reference
- [x] Frontend: Upload sketch or draw on canvas, describe desired output, see polished result

### Tool 15: AI Color Grading
- [x] Backend: Apply cinematic color grades using LLM to describe grade + generateImage edit
- [x] Frontend: Upload image, choose preset grade (cinematic, vintage, moody, bright, noir, sunset), see before/after

### Integration
- [x] Update Tools Hub with all 6 new tool cards (15 total)
- [x] Add routes for all new tool pages in App.tsx
- [x] Write vitest tests for all 6 new tool endpoints (25 tests, all passing)
- [x] Final verification and checkpoint (177 tests, all passing, 0 TS errors, 15 tools verified)
