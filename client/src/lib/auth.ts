import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM_ADDRESS || "DreamForge <noreply@dreamforge.ai>",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const isAuthenticated = !!auth?.user;
      const isProtected = request.nextUrl.pathname.startsWith("/workspace")
        || request.nextUrl.pathname.startsWith("/profile")
        || request.nextUrl.pathname.startsWith("/admin")
        || request.nextUrl.pathname.startsWith("/credits")
        || request.nextUrl.pathname.startsWith("/api-keys")
        || request.nextUrl.pathname.startsWith("/batch")
        || request.nextUrl.pathname.startsWith("/characters")
        || request.nextUrl.pathname.startsWith("/video-studio")
        || request.nextUrl.pathname.startsWith("/brand-kits")
        || request.nextUrl.pathname.startsWith("/notifications");

      if (isProtected && !isAuthenticated) return false; // redirects to signIn page
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.provider = account?.provider;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session as any).provider = token.provider;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
