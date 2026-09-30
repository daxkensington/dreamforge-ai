// One-off gallery inspection (read-only). Usage: node scripts/db-gallery-inspect.mjs <envFile>
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const envFile = process.argv[2];
config({ path: envFile });
const url = process.env.DATABASE_URL;
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }

const sql = neon(url);
const rows = await sql`
  SELECT g.id, g."generationId", g."userId", g.title, g.description,
         g.featured, g."viewCount", g."approvedAt", g."createdAt",
         gen."mediaType" AS gen_type, gen.status AS gen_status, gen."imageUrl" AS gen_url
  FROM "galleryItems" g
  LEFT JOIN generations gen ON gen.id = g."generationId"
  ORDER BY g.id`;
console.log(JSON.stringify(rows, null, 2));
