"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Loader2, CheckCircle2, Send } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * /takedown — public content-removal report form.
 *
 * Compliance surface: anyone (user or not) can report content that depicts
 * them without consent, infringes their rights, or is illegal. Posts to
 * /api/takedown, which persists a takedown_requests row and returns a ticket
 * id. Deliberately no login wall — the harmed party is usually not a user.
 */
export default function Takedown() {
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim().length < 4) {
      toast.error("Include the link to the content you're reporting.");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Describe the problem in a sentence or two.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          reason: reason.trim(),
          contact: contact.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.ticket) {
        setTicket(data.ticket);
      } else {
        toast.error(data?.error ?? "Could not submit the report — please retry.");
      }
    } catch {
      toast.error("Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/30">
            <ShieldAlert className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Report content
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            If content on DreamForgeX depicts you without your consent, infringes your
            rights, or is illegal, report it here. You do not need an account. Every
            report is reviewed by a human, and content that violates our{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</a>{" "}
            or the law is removed.
          </p>
        </motion.div>

        {ticket ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center"
          >
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-4 text-xl font-semibold">Report received</h2>
            <p className="mt-2 text-muted-foreground">
              Your ticket id is{" "}
              <span className="font-mono font-semibold text-foreground">{ticket}</span>.
              Keep it for reference. If you left contact details, we will use them only
              about this report.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5 rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
            <div>
              <label htmlFor="takedown-url" className="text-sm font-medium">
                Link to the content <span className="text-rose-500">*</span>
              </label>
              <Input
                id="takedown-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://dreamforgex.ai/g/…"
                maxLength={2000}
                required
                className="mt-2"
              />
            </div>
            <div>
              <label htmlFor="takedown-reason" className="text-sm font-medium">
                What is wrong with it <span className="text-rose-500">*</span>
              </label>
              <Textarea
                id="takedown-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. This image depicts me without my consent."
                rows={5}
                maxLength={5000}
                required
                className="mt-2 resize-none"
              />
            </div>
            <div>
              <label htmlFor="takedown-contact" className="text-sm font-medium">
                Contact (optional)
              </label>
              <Input
                id="takedown-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email, so we can follow up about this report"
                maxLength={320}
                className="mt-2"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Submit report</>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Sexual content involving minors is reported to the relevant authorities.
              For anything else, you can also email{" "}
              <a href="mailto:support@dreamforgex.ai" className="underline underline-offset-2">support@dreamforgex.ai</a>.
            </p>
          </form>
        )}
      </div>
    </PageLayout>
  );
}
