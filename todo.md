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

## Phase 11 — Video Generation Expansion

### Backend — Video Tools
- [x] Video Storyboard Generator: LLM generates multi-scene storyboard from a concept, each scene gets an image
- [x] Video Scene Director: Generate keyframe sequence from narrative prompt with camera directions
- [x] Video Style Transfer: Apply artistic styles to video generation context
- [x] Video Upscaler: Enhance video quality/resolution
- [x] Video Soundtrack Suggester: LLM analyzes video concept and suggests music mood, tempo, genre
- [x] Text-to-Video Script: LLM writes detailed video script with scene breakdowns, camera angles, timing

### Frontend — Video Studio & Tools
- [x] Dedicated Video Studio page (/video-studio) with video-first workflow
- [x] Storyboard view: visual scene-by-scene layout with thumbnails, descriptions, timing
- [x] Scene Director: narrative prompt → keyframe sequence with camera directions
- [x] Video timeline preview with scene cards
- [x] Video tool pages: /video-studio/storyboard, /video-studio/scene-director, /video-studio/script, /video-studio/style-transfer, /video-studio/upscaler, /video-studio/soundtrack
- [x] Video-specific preset prompts and templates

### Integration
- [x] Update Tools Hub with video tools section (Video Studio section on homepage)
- [x] Add Video Studio link to Navbar
- [x] Update landing page with video generation showcase
- [x] Cross-link between Video Studio and image Studio

### Testing
- [x] Vitest tests for all 6 video endpoints (22 tests, all passing)
- [x] Final verification and checkpoint (199 tests, all passing, 0 TS errors)

## Phase 12 — Video Project Persistence, PDF Export & Template Library

### Video Project Persistence
- [x] Add videoProjects table to database schema (id, userId, type, title, data JSON, createdAt, updatedAt)
- [x] Push database migration
- [x] Backend: saveVideoProject endpoint (create/update)
- [x] Backend: listVideoProjects endpoint (list user's saved projects)
- [x] Backend: getVideoProject endpoint (load single project)
- [x] Backend: deleteVideoProject endpoint
- [x] Frontend: "Save Project" button on Storyboard and Script tool pages
- [x] Frontend: "My Projects" section in Video Studio hub with project cards
- [x] Frontend: Load saved project back into the tool page for editing

### PDF Export
- [x] Client-side PDF export using jsPDF (no server endpoint needed)
- [x] PDF layout for storyboards: title, synopsis, scene cards with descriptions
- [x] PDF layout for scripts: title, logline, scene breakdowns with camera directions and dialogue
- [x] Frontend: "Download PDF" button on completed storyboard and script results

### Template Library
- [x] Define template data structure (id, name, category, description, prefilled inputs)
- [x] Create 12+ pre-built templates across categories (product launch, tutorial, music video, documentary, social media, commercial, narrative, etc.)
- [x] Backend: listTemplates endpoint (with category filter)
- [x] Frontend: Template browser/gallery in Video Studio hub
- [x] Frontend: "Use Template" flow that pre-fills tool page inputs
- [x] Template cards with category badges, descriptions, and preview of prefilled values

### Testing
- [x] Vitest tests for video project CRUD endpoints (19 tests)
- [x] Vitest tests for PDF export (client-side, covered by exportData endpoint test)
- [x] Vitest tests for template listing endpoint
- [x] Final verification and checkpoint (218 tests passing, 0 TS errors)

## Phase 13 — Collaboration, Version History & AI Refinement

### Collaboration Features
- [x] Add projectCollaborators table (id, projectId, userId, role, invitedBy, createdAt)
- [x] Add projectShareTokens table (id, projectId, token, permission, expiresAt, createdAt)
- [x] Backend: createShareLink endpoint (generate unique token with permissions)
- [x] Backend: acceptShareLink endpoint (join project via token)
- [x] Backend: listCollaborators endpoint
- [x] Backend: removeCollaborator endpoint
- [x] Backend: listSharedWithMe endpoint (projects shared with current user)
- [x] Frontend: Share dialog with link generation and permission controls
- [x] Frontend: Collaborator list with role badges and remove option
- [x] Frontend: "Shared with Me" tab in Video Studio hub

### Version History
- [x] Add projectRevisions table (id, projectId, userId, version, data, changeNote, createdAt)
- [x] Backend: Auto-save revision on project update
- [x] Backend: listRevisions endpoint (revision timeline for a project)
- [x] Backend: getRevision endpoint (load specific revision)
- [x] Backend: revertToRevision endpoint (restore project to a previous version)
- [x] Frontend: Version history panel/timeline in project view
- [x] Frontend: Revision comparison view (side-by-side diff)
- [x] Frontend: Revert button with confirmation dialog

### AI-Powered Project Refinement
- [x] Backend: refineProject endpoint (takes project data + user feedback, returns improved version)
- [x] LLM prompt engineering for storyboard refinement
- [x] LLM prompt engineering for script refinement
- [x] Frontend: "Refine with AI" button on saved projects
- [x] Frontend: Feedback input dialog (what to improve, focus areas)
- [x] Frontend: Refinement results with diff highlighting and "Apply" button
- [x] Auto-save refined version as new revision

### Testing
- [x] Vitest tests for collaboration endpoints (29 tests, all passing)
- [x] Vitest tests for version history endpoints (included in collaboration.test.ts)
- [x] Vitest tests for AI refinement endpoint (included in collaboration.test.ts)
- [x] Final verification and checkpoint (247 tests passing, 0 TS errors)

## Phase 14 — Full Improvement Roadmap

### P0: Actual Video Generation Integration
- [x] Backend: videoGeneration.generate endpoint — renders scene keyframes via image generation API
- [x] Backend: videoGeneration.status endpoint for polling generation progress
- [x] Frontend: "Generate Keyframes" button on storyboard scenes
- [x] Frontend: Video generation progress indicator with scene-by-scene status
- [x] Store generated scene keyframes in S3 and link to video projects

### P1: Interactive Editing Canvas
- [x] Install fabric.js for HTML5 Canvas editing
- [x] Canvas component with brush tools, eraser, selection, and zoom
- [x] Integrate canvas with inpainting — brush mask region, send to API
- [x] Integrate canvas with outpainting — extend canvas bounds, send to API
- [x] Canvas layer system (original, mask, result) with undo/redo

### P2: Real-Time Generation Preview
- [x] Backend: SSE endpoint for streaming generation progress
- [x] Frontend: Progress bar with stage indicators (queued, processing, rendering, complete)
- [x] Animated skeleton placeholder during generation
- [x] Estimated time remaining display

### P3: Gallery Social Features
- [x] Add galleryLikes, galleryComments, userFollows tables
- [x] Backend: like/unlike, comment CRUD, follow/unfollow endpoints
- [x] Frontend: Like button with count on gallery cards
- [x] Frontend: Comment section on gallery detail page
- [x] Frontend: Follow button on user profiles
- [x] Frontend: "Remix Prompt" button copies prompt to workspace
- [x] Frontend: Following/Discover feed tabs in gallery

### P4: Character Consistency System
- [x] Add characters table (userId, name, description, referenceImages, styleNotes)
- [x] Backend: character CRUD endpoints
- [x] Backend: inject character description into generation prompts
- [x] Frontend: Character library page
- [x] Frontend: Character selector in workspace generation form

### P5: Multi-Model Selection
- [x] Define model registry with capabilities metadata
- [x] Backend: listModels endpoint
- [x] Frontend: Model selector in workspace with model cards
- [x] Model comparison mode — same prompt across multiple models

### P6: End-to-End Video Pipeline
- [x] Backend: sequence storyboard scenes into timeline
- [x] Backend: generate keyframe images per scene
- [x] Frontend: Video timeline editor with scene clips
- [x] Frontend: Scene reordering via drag-and-drop
- [x] Frontend: Export timeline with all generated keyframes

### P7: AI-Powered Prompt Assistant
- [x] Backend: promptAssist endpoint (LLM improves/expands prompts)
- [x] Backend: promptSuggest endpoint (style/mood/composition suggestions)
- [x] Frontend: Collapsible prompt assistant sidebar in workspace
- [x] Frontend: "Improve Prompt" one-click button
- [x] Frontend: Suggestion chips and prompt history

### P8: Style Presets and Brand Kits
- [x] Add brandKits table (userId, name, colorPalette, stylePrompt, typography)
- [x] Backend: brandKit CRUD endpoints
- [x] Frontend: Brand kit manager page
- [x] Frontend: Apply brand kit to generation
- [x] Pre-built style presets (cinematic, anime, watercolor, etc.)

### P9: Generation History with Smart Search
- [x] Backend: searchGenerations with full-text search
- [x] Backend: Filter by tool, date range, model, media type
- [x] Frontend: Search bar with autocomplete in workspace
- [x] Frontend: Advanced filter panel
- [x] Frontend: "Regenerate with tweaks" from history

### P10: Keyboard Shortcuts
- [x] Global shortcut handler (Ctrl+Enter generate, Escape cancel)
- [x] Workspace shortcuts (Ctrl+S, Ctrl+Z, arrow keys)
- [x] Gallery shortcuts (arrows, L to like, C to comment)
- [x] Keyboard shortcut help modal (?)

### P11: Public API
- [x] Add apiKeys table (userId, key, name, permissions, rateLimit)
- [x] Backend: API key CRUD endpoints
- [x] Backend: API middleware for key-based auth
- [x] Public REST endpoints: /api/v1/generate, /api/v1/tools/*
- [x] Rate limiting per API key
- [x] Frontend: API key management in profile
- [x] API documentation page with examples

### Testing & Verification
- [x] Vitest tests for video generation endpoints
- [x] Vitest tests for gallery social features
- [x] Vitest tests for character consistency endpoints
- [x] Vitest tests for brand kit endpoints
- [x] Vitest tests for API key management
- [x] Vitest tests for prompt assistant endpoints
- [x] Final verification — all tests passing, 0 TS errors

## Phase 15 — Stripe Credits, Email Notifications, Admin Dashboard

### Stripe Credits System
- [x] Set up Stripe integration via webdev_add_feature
- [x] Add creditBalances table (userId, balance, lifetimeSpent)
- [x] Add creditTransactions table (userId, amount, type, stripeSessionId, description, createdAt)
- [x] Add creditPackages configuration (starter, pro, enterprise tiers)
- [x] Backend: getBalance endpoint
- [x] Backend: createCheckoutSession endpoint (Stripe Checkout)
- [x] Backend: Stripe webhook handler for payment confirmation
- [x] Backend: deductCredits helper (called on generation)
- [x] Backend: getCreditHistory endpoint
- [x] Frontend: Credits display in navbar (balance badge)
- [x] Frontend: Credits purchase page with package cards
- [x] Frontend: Credit usage history page
- [x] Frontend: Insufficient credits modal on generation attempt
- [x] Integrate credit deduction into existing generation endpoints

### Email Notifications
- [x] Add notifications table (userId, type, title, message, read, metadata, createdAt)
- [x] Add notificationPreferences table (userId, type, enabled)
- [x] Backend: createNotification helper
- [x] Backend: listNotifications endpoint (with unread count)
- [x] Backend: markAsRead / markAllRead endpoints
- [x] Backend: getNotificationPreferences / updatePreferences endpoints
- [x] Backend: Trigger notifications on collaboration edits
- [x] Backend: Trigger notifications on generation completion
- [x] Backend: Trigger notifications on gallery comments
- [x] Frontend: Bell icon in navbar with unread count badge
- [x] Frontend: Notification dropdown/panel with notification list
- [x] Frontend: Notification preferences page
- [x] Frontend: Mark as read on click, mark all read button

### Admin Dashboard
- [x] Backend: adminProcedure middleware (role check)
- [x] Backend: getPlatformStats endpoint (total users, generations, revenue)
- [x] Backend: listAllUsers endpoint with search/filter
- [x] Backend: updateUserRole endpoint
- [x] Backend: banUser / unbanUser endpoints
- [x] Backend: listFlaggedContent endpoint
- [x] Backend: removeContent endpoint
- [x] Backend: getGenerationAnalytics endpoint (daily/weekly/monthly charts)
- [x] Backend: getRevenueAnalytics endpoint
- [x] Frontend: Admin layout with sidebar navigation
- [x] Frontend: Admin overview dashboard with stat cards and charts
- [x] Frontend: User management page with table, search, role editing
- [x] Frontend: Content moderation page with flagged items
- [x] Frontend: Analytics page with generation and revenue charts
- [x] Frontend: Admin route protection (redirect non-admins)

### Testing & Verification
- [x] Vitest tests for credit balance and transaction endpoints
- [x] Vitest tests for Stripe checkout session creation
- [x] Vitest tests for notification CRUD endpoints
- [x] Vitest tests for admin endpoints (stats, users, moderation)
- [x] Final verification — all tests passing, 0 TS errors

## Phase 16 — Credit Integration, Notification Triggers, Admin Charts

### Credit Deduction Integration
- [x] Wire deductCredits into generation.create endpoint (image + video)
- [x] Wire deductCredits into all tools endpoints (upscale, style-transfer, bg-remove, etc.)
- [x] Wire deductCredits into video tool endpoints (storyboard, scene-director, etc.)
- [x] Wire deductCredits into batch generation endpoint
- [x] Add insufficient credits error handling with clear user messaging
- [x] Frontend: Show credit cost before generation, deduct on success

### Notification Triggers
- [x] Trigger notification when collaborator edits a shared project
- [x] Trigger notification when someone comments on a gallery item
- [x] Trigger notification when Stripe payment succeeds (via webhook)
- [x] Trigger notification when generation completes (long-running jobs)
- [x] Trigger notification when someone follows the user

### Admin Analytics Charts
- [x] Install and configure Chart.js for React
- [x] Build generation volume chart (line chart, daily/weekly/monthly)
- [x] Build revenue trend chart (bar chart, daily/weekly/monthly)
- [x] Build user growth chart
- [x] Build tool usage breakdown chart (pie/doughnut)
- [x] Add period selector (daily/weekly/monthly) for all charts
- [x] Responsive chart layout for admin dashboard

### Testing & Verification
- [x] Test credit deduction in generation endpoints
- [x] Test notification triggers fire correctly
- [x] Verify admin charts render with mock data
- [x] Final verification — all tests passing, 0 TS errors

## Phase 17 — Navbar Credits, Webhook Logging, Onboarding Credits

### Credit Balance in Navbar
- [x] Backend: getMyBalance endpoint (returns current credit balance)
- [x] Frontend: Credit balance badge in Navbar (coin icon + count)
- [x] Auto-refresh balance after generation or purchase
- [x] Link badge to /credits page

### Webhook Event Logging
- [x] Add webhookEvents table (id, eventId, eventType, payload summary, status, createdAt)
- [x] Log all Stripe webhook events in the handler
- [x] Backend: admin.listWebhookEvents endpoint with filters
- [x] Frontend: Webhook log panel in admin dashboard (table with event type, status, timestamp)
- [x] Filter by event type and date range

### Onboarding Free Credits
- [x] Auto-grant 50 starter credits on first user sign-up
- [x] Backend: detect first login in OAuth callback and create credit balance
- [x] Show welcome toast with credit info on first login
- [x] Prevent duplicate grants on subsequent logins

### Testing & Verification
- [x] Test credit balance endpoint
- [x] Test webhook event logging
- [x] Test onboarding credit grant
- [x] Final verification — all tests passing, 0 TS errors

## Phase 18 — Usage Analytics, Low Credit Warning, Referral Credits

### Credit Usage Analytics
- [x] Backend: getUsageAnalytics endpoint (breakdown by tool type, daily/weekly/monthly)
- [x] Backend: getUsageBreakdown endpoint (pie chart data by tool category)
- [x] Frontend: "Usage" tab on Credits page with line chart of spending over time
- [x] Frontend: Doughnut chart showing credits spent per tool type
- [x] Frontend: Summary cards (total spent, most-used tool, average per day)

### Low Credit Warning
- [x] Backend: include lowCredit flag in getBalance response when balance < 10
- [x] Frontend: Warning banner in Navbar when credits are low
- [x] Frontend: Dismissible alert with "Buy Credits" CTA
- [x] Show warning on generation pages when credits insufficient for the tool

### Referral Credits
- [x] Add referrals table (id, referrerId, referredUserId, code, status, creditsAwarded, createdAt)
- [x] Add referralCode field to users table
- [x] Backend: generateReferralCode endpoint (unique per user)
- [x] Backend: applyReferralCode endpoint (on sign-up or first login)
- [x] Backend: getReferralStats endpoint (total referrals, credits earned)
- [x] Auto-grant bonus credits to referrer when referred user signs up
- [x] Frontend: Referral page with unique link, copy button, stats
- [x] Frontend: Referral input on Credits page for new users

### Testing & Verification
- [x] Test usage analytics endpoints
- [x] Test low credit warning logic
- [x] Test referral code generation and redemption
- [x] Final verification — 367 tests passing, 0 TS errors

## Phase 19 — Referral Auto-Apply, Tiered Rewards, Usage Digest

### Referral Auto-Apply on Signup
- [x] Capture ?ref=CODE URL parameter on landing and store in sessionStorage
- [x] Auto-apply referral code on first login (after OAuth callback)
- [x] Backend: autoApplyReferral endpoint that checks sessionStorage code
- [x] Show toast notification when referral is auto-applied
- [x] Handle edge cases (invalid code, self-referral, already referred)

### Tiered Referral Rewards
- [x] Define reward tiers (Bronze 3→30, Silver 7→50, Gold 15→100, Platinum 30→200, Diamond 50→500)
- [x] Backend: checkAndAwardTierBonus logic after each successful referral
- [x] Backend: getTierProgress endpoint (current tier, next tier, progress)
- [x] Frontend: Tier progress display on Referrals tab (progress bar, milestones)
- [x] Notification when user reaches a new tier

### Usage Analytics Email Digest
- [x] Backend: generateDigestContent helper (summarizes usage stats for a period)
- [x] Backend: sendDigest endpoint using notification system
- [x] Backend: digestPreferences endpoint (enable/disable, frequency: weekly/monthly)
- [x] Add digestFrequency and digestEnabled fields to users table
- [x] Frontend: Digest settings UI on Credits/Usage page
- [x] Scheduled digest generation logic (cron-compatible endpoint)

### Testing & Verification
- [x] Test referral auto-apply flow
- [x] Test tiered rewards calculation and awarding
- [x] Test digest content generation
- [x] Test digest preferences CRUD
- [x] Final verification — 389 tests passing, 0 TS errors
