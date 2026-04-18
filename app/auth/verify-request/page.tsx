import { Mail } from "lucide-react";

export const metadata = {
  title: "Check your email — DreamForgeX",
  description: "We've sent you a magic sign-in link.",
};

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-zinc-900/80 p-10 text-center shadow-2xl shadow-purple-500/5 backdrop-blur-sm">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-purple-500/10">
          <Mail className="size-8 text-purple-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Check your email</h1>
          <p className="text-sm text-zinc-400">
            We sent a magic sign-in link to your inbox. Click it to finish signing in.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-left text-xs text-zinc-500">
          <p>The link is valid for 24 hours. If it doesn't arrive within a minute, check your spam folder — or return to the sign-in page and try again.</p>
        </div>
      </div>
    </div>
  );
}
