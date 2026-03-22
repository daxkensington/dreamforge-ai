import { auth } from "../../client/src/lib/auth";
import * as db from "../db";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  user: User | null;
  session: any;
};

export async function createContext(req?: Request): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // Get NextAuth session
    const session = await auth();

    if (session?.user?.email) {
      // Look up or create user in our DB
      const found = await db.getUserByEmail(session.user.email);
      user = found ?? null;

      if (!user && session.user.email) {
        // Auto-create user on first sign-in
        await db.upsertUser({
          openId: session.user.id || session.user.email,
          name: session.user.name || null,
          email: session.user.email,
          loginMethod: (session as any).provider || "oauth",
          lastSignedIn: new Date(),
        });
        const created = await db.getUserByEmail(session.user.email);
        user = created ?? null;
      }
    }
  } catch (error) {
    user = null;
  }

  return { user, session: null };
}
