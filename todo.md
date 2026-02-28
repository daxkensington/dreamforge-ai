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
