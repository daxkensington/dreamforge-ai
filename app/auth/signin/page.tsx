"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Mail } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await signIn("resend", { email, callbackUrl: "/" });
    setEmailSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-zinc-900/80 p-10 shadow-2xl shadow-purple-500/5 backdrop-blur-sm">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Dream<span className="text-purple-400">Forge</span>
          </h1>
          <p className="mt-3 text-sm text-zinc-400">
            Sign in to start creating
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

        {/* OAuth Buttons */}
        <div className="space-y-4">
          {/* Google */}
          <Button
            variant="outline"
            className="w-full justify-center gap-3 border-zinc-700 bg-zinc-800/50 py-6 text-sm font-medium text-zinc-200 hover:border-purple-500/50 hover:bg-zinc-800 hover:text-white"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            <svg className="size-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          {/* GitHub */}
          <Button
            variant="outline"
            className="w-full justify-center gap-3 border-zinc-700 bg-zinc-800/50 py-6 text-sm font-medium text-zinc-200 hover:border-purple-500/50 hover:bg-zinc-800 hover:text-white"
            onClick={() => signIn("github", { callbackUrl: "/" })}
          >
            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </Button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-500">or</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* Email Magic Link */}
        {emailSent ? (
          <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-6 text-center">
            <Mail className="mx-auto mb-3 size-8 text-purple-400" />
            <p className="text-sm font-medium text-white">Check your email</p>
            <p className="mt-1 text-xs text-zinc-400">
              We sent a sign-in link to <span className="text-purple-300">{email}</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              required
            />
            <Button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-purple-600 py-6 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
            >
              <Mail className="mr-2 size-4" />
              {loading ? "Sending..." : "Sign in with Email"}
            </Button>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-zinc-500">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
