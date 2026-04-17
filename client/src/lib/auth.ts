import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // NextAuth v5 uses AUTH_SECRET; fall back to NEXTAUTH_SECRET for backward compat
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const isAuthenticated = !!auth?.user;
      // Only protect truly private pages — let users browse tools/studio/video
      const isProtected = request.nextUrl.pathname.startsWith("/profile")
        || request.nextUrl.pathname.startsWith("/admin")
        || request.nextUrl.pathname.startsWith("/credits")
        || request.nextUrl.pathname.startsWith("/api-keys")
        || request.nextUrl.pathname.startsWith("/notifications");

      if (isProtected && !isAuthenticated) return false; // redirects to signIn page

      // Admin routes require admin role
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
  },
});
