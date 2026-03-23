export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/workspace/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/credits/:path*",
    "/api-keys/:path*",
    "/batch/:path*",
    "/characters/:path*",
    "/video-studio/:path*",
    "/brand-kits/:path*",
    "/notifications/:path*",
  ],
};
