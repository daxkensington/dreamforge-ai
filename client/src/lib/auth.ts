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
import { getUserByEmail } from "../../../server/db";

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
            // The middleware in-memory limiter on /api/auth is only a
            // best-effort pre-filter (per-isolate on serverless). This is the
            // real chokepoint: it runs on the Node runtime immediately before
            // an email goes out, so magic-link bombing is capped in Postgres
            // per email address and per IP. Enforcement here, sending below.
            async sendVerificationRequest({ identifier: email, url, provider, request }) {
              const { enforceIpRateLimit } = await import("../../../server/rate-limit");
              const { getClientIp } = await import("../../../server/_core/context");
              const ip = request ? getClientIp(request.headers) : null;
              await enforceIpRateLimit(
                "auth.magiclink:email",
                email.toLowerCase(),
                5,
                60 * 60 * 1000,
                "Too many sign-in emails — please wait about an hour and try again.",
              );
              if (ip) {
                await enforceIpRateLimit(
                  "auth.magiclink:ip",
                  ip,
                  20,
                  60 * 60 * 1000,
                  "Too many sign-in emails from this connection — please try again later.",
                );
              }

              const host = new URL(url).host;
              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${provider.apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: provider.from,
                  to: email,
                  subject: `Sign in to ${host}`,
                  html: `<p>Click the link below to sign in to ${host}:</p><p><a href="${url}">Sign in to ${host}</a></p><p>If you did not request this email, you can ignore it.</p>`,
                  text: `Sign in to ${host}:\n${url}\n\nIf you did not request this email, you can ignore it.`,
                }),
              });
              if (!res.ok) {
                throw new Error("Resend error: " + (await res.text()));
              }
            },
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
        // authUsers (the NextAuth adapter table) has no role column — the
        // app-level users table does. The middleware /admin check reads
        // token.role, which used to be hardcoded from a nonexistent column
        // and locked every admin out. Look the role up from the app user.
        // Role changes still require re-login: the token is only rebuilt at
        // sign-in, same trade-off as before.
        try {
          const appUser = user.email ? await getUserByEmail(user.email) : null;
          token.role = appUser?.role ?? "user";
        } catch {
          token.role = "user";
        }
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
