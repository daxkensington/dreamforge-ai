import { neon } from "@neondatabase/serverless";

// One-shot: ship the uncensored-video tool OFF until the Wan GPU worker is live.
// Flip back on with: UPDATE tool_status SET status='active' WHERE "toolId"='uncensored-video';
const sql = neon(process.env.DATABASE_URL);
const status = process.argv[2] || "offline";
const message =
  status === "offline"
    ? "Launching soon — GPU worker provisioning."
    : null;

await sql`
  INSERT INTO tool_status ("toolId", status, message, "updatedAt")
  VALUES ('uncensored-video', ${status}, ${message}, now())
  ON CONFLICT ("toolId") DO UPDATE
    SET status = EXCLUDED.status, message = EXCLUDED.message, "updatedAt" = now()`;

const rows = await sql`SELECT "toolId", status, message FROM tool_status WHERE "toolId" = 'uncensored-video'`;
console.log("kill-switch:", JSON.stringify(rows[0]));
