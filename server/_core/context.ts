import { getClientIp } from "./clientIp";
import { auth } from "../../client/src/lib/auth";
import * as db from "../db";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  user: User | null;
  session: any;
  /** Caller IP (best-effort), used for IP-keyed rate limits on public procedures. */
  ip: string | null;
};

export { getClientIp } from "./clientIp";

function extractIp(req?: Request): string | null {
  if (!req) return null;
  return getClientIp(req.headers);
}

export async function createContext(req?: Request): Promise<TrpcContext> {
  let user: User | null = null;
  const ip = extractIp(req);

  try {
    // Get NextAuth session
    const session = await auth();

    if (session?.user?.email) {
      if (!session.user.id || !(await db.hasAuthIdentity(session.user.id, session.user.email))) {
        return { user: null, session: null, ip };
      }
      // Look up or create user in our DB
      const found = await db.getUserByEmail(session.user.email);
      if (found?.loginMethod === "deleted") return { user: null, session: null, ip };
      user = found ?? null;

      if (!user && session.user.email) {
        // Auto-create user on first sign-in
        await db.createUserForAuthIdentity({
          id: session.user.id,
          name: session.user.name || null,
          email: session.user.email,
          provider: (session as any).provider || "oauth",
        });
        const created = await db.getUserByEmail(session.user.email);
        user = created ?? null;
      } else if (user) {
        // Bump lastSignedIn on return visits. Without this the column keeps its
        // account-creation value forever, so every user looks like they never
        // came back. Throttled to 30 min so it isn't a write per request, and
        // isolated so a failed write can never null out an authenticated user.
        const last = user.lastSignedIn ? new Date(user.lastSignedIn).getTime() : 0;
        if (Date.now() - last > 30 * 60 * 1000) {
          try {
            await db.touchUserLastSignIn(user.id);
          } catch {
            // telemetry only — never fail the request over it
          }
        }
      }
    }
  } catch (error) {
    user = null;
  }

  return { user, session: null, ip };
}
