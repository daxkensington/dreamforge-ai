"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DreamForgeX Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500/20 to-blue-500/20 border border-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
        <p className="text-muted-foreground text-sm mb-8">
          An unexpected error occurred. Our team has been notified.
        </p>

        {/* Error digest */}
        {error.digest && (
          <p className="text-xs text-muted-foreground/50 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:from-cyan-600 hover:to-blue-700 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
