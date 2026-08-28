"use client";

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import PageLayout from "@/components/PageLayout";
import DeleteAccountCard from "@/components/DeleteAccountCard";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

export default function Account() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <PageLayout>
      <div className="container max-w-xl py-12 md:py-16">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your account</h1>
        <p className="mt-2 text-muted-foreground">
          Manage or delete your DreamForgeX account. Deletion is immediate and cannot be undone.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : !isAuthenticated ? (
          <div className="mt-8 rounded-xl border border-border/60 bg-card/40 p-6 text-center">
            <User className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Sign in to delete your account. After you sign in you&apos;ll come straight back here.
            </p>
            <Button className="mt-4" onClick={() => (window.location.href = getLoginUrl("/account"))}>
              Sign in to continue
            </Button>
          </div>
        ) : (
          <div className="mt-8">
            <DeleteAccountCard />
          </div>
        )}
      </div>
    </PageLayout>
  );
}
