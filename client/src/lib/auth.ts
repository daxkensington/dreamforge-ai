import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  authUsers,
  authAccounts,
  authSessions,
  verificationTokens,
} from "../../../drizzle/schema";

// Auth-dedicated Drizzle client. Initialized once at module load — safe because
// DATABASE_URL is always set in prod and this file is only imported server-side.
const authDb = process.env.DATABASE_URL
  ? drizzle(neon(process.env.DATABASE_URL))
  : null;

const adapter = authDb
  ? DrizzleAdapter(authDb, {
      usersTable: authUsers,
      accountsTable: authAccounts,
      sessionsTable: authSessions,
      verificationTokensTable: verificationTokens,
    })
  : undefined;

const resendKey = process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_ADDRESS || "noreply@dreamforgex.ai";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    ...(resendKey
      ? [
          Resend({
            apiKey: resendKey,
            from: resendFrom,
          }),
        ]
      : []),
  ],
  // JWT session strategy — even with an adapter, we keep tokens so the rest of
  // the app's context bridge (server/_core/context.ts) keeps working unchanged.
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const isAuthenticated = !!auth?.user;
      const isProtected = request.nextUrl.pathname.startsWith("/profile")
        || request.nextUrl.pathname.startsWith("/admin")
        || request.nextUrl.pathname.startsWith("/credits")
        || request.nextUrl.pathname.startsWith("/api-keys")
        || request.nextUrl.pathname.startsWith("/notifications");

      if (isProtected && !isAuthenticated) return false;

      if (request.nextUrl.pathname.startsWith("/admin")) {
        const token = auth as any;
        const role = token?.user?.role || token?.role;
        if (role !== "admin") {
          return Response.redirect(new URL("/", request.nextUrl.origin));
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.provider = account?.provider;
        token.email = user.email;
        token.role = (user as any).role || "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session as any).provider = token.provider;
        (session as any).role = token.role || "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
  },
});
