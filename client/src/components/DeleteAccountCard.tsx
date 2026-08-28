"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Self-serve account deletion. Confirmation is typed DELETE so a misclick
 * cannot wipe the account. After success we sign out — the Auth.js session
 * is already dead server-side.
 */
export default function DeleteAccountCard() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);

  const del = trpc.user.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Your account has been deleted.");
      await logout();
      window.location.href = "/";
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card id="delete-account" className="border-destructive/40 bg-destructive/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />
          Delete account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Permanently delete your DreamForgeX account, generations, gallery posts, and
          billing access. This cannot be undone. Stripe subscriptions are cancelled.
          We keep anonymised billing records as required by tax law.
        </p>
        {!open ? (
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-background/50 p-4">
            <p className="text-sm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="font-mono"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={understood} onCheckedChange={(v) => setUnderstood(!!v)} />
              I understand this cannot be undone.
            </label>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={typed !== "DELETE" || !understood || del.isPending}
                onClick={() => del.mutate({ confirmation: "DELETE" })}
              >
                {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Permanently delete
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                  setUnderstood(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
