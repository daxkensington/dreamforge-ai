import PageLayout from "@/components/PageLayout";
import { motion } from "framer-motion";
import { Shield, Lock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const LAST_UPDATED = "April 17, 2026";

const sections = [
  {
    title: "1. Who we are",
    body: [
      "DreamForgeX (\"we\", \"us\") operates the Service at dreamforgex.ai. This Privacy Policy explains what personal information we collect, why we collect it, and what we do with it.",
      "Contact: support@dreamforgex.ai.",
    ],
  },
  {
    title: "2. Information you give us",
    body: [
      "Account data: email address, display name, password hash (or OAuth identifier), and profile preferences.",
      "Billing data: when you subscribe or buy credit packs, our payment processor (Stripe) collects payment-card information directly. We never see your full card number; we only receive a token, the last 4 digits, billing country, and the amount.",
      "Generation inputs: the prompts, reference images, and parameters you submit. These are stored against your account so you can revisit them.",
      "Marketplace listings and gallery submissions: any content you publish to public surfaces.",
      "Support messages: anything you send us by email or in-app chat.",
    ],
  },
  {
    title: "3. Information we collect automatically",
    body: [
      "Usage data: pages visited, tools used, generation counts, errors encountered, browser type, device type, IP address, and approximate location (country + region) derived from IP.",
      "Cookies and similar technologies: a session cookie to keep you logged in, plus first-party analytics to understand which features are used. We do not use third-party advertising cookies.",
      "Crash and performance telemetry via Sentry to diagnose errors. Stack traces and request metadata are collected; we strip prompt content and personal data from these reports.",
    ],
  },
  {
    title: "4. How we use your information",
    body: [
      "To provide the Service: authenticate you, render the workspace, run generations, store your history, send you receipts.",
      "To bill you: process subscriptions, credit-pack purchases, and marketplace payouts.",
      "To improve the Service: aggregate usage analytics, debug issues, prioritize features.",
      "To communicate: account notices, security alerts, billing receipts, and (only if you opt in) product announcements.",
      "To enforce our Terms: detect fraud, abuse, and content that violates our Acceptable Use Policy.",
    ],
  },
  {
    title: "5. AI model training",
    body: [
      "We do not train any AI model on your private prompts or your private generations. Period.",
      "Content you voluntarily submit to the public Gallery may be used to improve our search and tagging systems, but is not used to train generative models without your explicit, separate opt-in.",
      "Third-party model providers we route requests to (e.g. OpenAI, Google, xAI, Black Forest Labs, Runway) operate under their own data-use policies. We send them only what is necessary to fulfill your request and prefer providers that contractually agree not to train on inference traffic.",
    ],
  },
  {
    title: "6. Sharing your information",
    body: [
      "We share personal data only with:",
      "• Infrastructure providers we use to operate the Service (Vercel for hosting, Neon and Drizzle for the database, Cloudflare for edge and CDN, Sentry for error reporting, Stripe for billing, RunPod for GPU inference). Each is bound by a data-processing agreement.",
      "• Third-party AI model providers, when you submit a generation that runs on their model. Only the prompt, parameters, and any reference media are shared — never your account email, billing data, or other generations.",
      "• Law enforcement, when required by valid legal process or when necessary to prevent imminent harm.",
      "We do not sell personal data. We do not share data with advertisers.",
    ],
  },
  {
    title: "7. Data retention",
    body: [
      "Account data is retained while your account is active and for up to 90 days after deletion to handle billing reconciliation and abuse investigation.",
      "Generation history is retained while your account is active. You can delete individual generations at any time from your profile.",
      "Server logs are retained for 30 days. Sentry error reports are retained for 90 days.",
      "Billing records are retained as required by tax law (typically 7 years).",
    ],
  },
  {
    title: "8. Your rights",
    body: [
      "Depending on your jurisdiction, you may have the right to:",
      "• Access the personal data we hold about you;",
      "• Correct inaccurate data;",
      "• Delete your account and associated data (subject to legal retention requirements);",
      "• Export your data in a machine-readable format;",
      "• Object to or restrict processing for certain purposes;",
      "• Withdraw consent for optional processing (e.g. marketing).",
      "To exercise any of these rights, email support@dreamforgex.ai. We respond within 30 days.",
    ],
  },
  {
    title: "9. Security",
    body: [
      "Passwords are hashed with industry-standard algorithms (we never store plaintext). All traffic is served over TLS. Database backups are encrypted at rest. Access to production systems is limited and logged.",
      "No system is perfectly secure. If a breach affecting your data occurs, we will notify you and the relevant regulators within the timelines required by applicable law.",
    ],
  },
  {
    title: "10. International transfers",
    body: [
      "DreamForgeX is operated from Canada. Our infrastructure providers operate globally; your data may be processed in Canada, the United States, or the EU depending on the service. Where required, we rely on Standard Contractual Clauses or equivalent safeguards.",
    ],
  },
  {
    title: "11. Children",
    body: [
      "DreamForgeX is not directed at children under 18. We do not knowingly collect personal data from children. If you believe a child has provided us personal data, email support@dreamforgex.ai and we will delete it.",
    ],
  },
  {
    title: "12. Changes to this policy",
    body: [
      "We may update this Privacy Policy from time to time. Material changes will be announced by email or in-app notice at least 14 days before they take effect. The \"last updated\" date at the top of this page reflects the current version.",
    ],
  },
  {
    title: "13. Contact",
    body: [
      "Privacy questions, data requests, or complaints? Email support@dreamforgex.ai.",
    ],
  },
];

export default function Privacy() {
  return (
    <PageLayout>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-black" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 mb-8"
          >
            <Shield className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white/90">Legal</span>
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4"
          >
            Privacy Policy
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
            className="text-white/60"
          >
            Last updated: {LAST_UPDATED}
          </motion.p>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="space-y-10">
            {sections.map((s, i) => (
              <motion.div
                key={s.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
              >
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                  {s.title}
                </h2>
                <div className="space-y-3 text-white/70 leading-relaxed pl-8">
                  {s.body.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 pt-10 border-t border-white/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <p className="text-sm text-white/50">
              See also: <Link href="/terms" className="text-cyan-400 hover:text-cyan-300">Terms of Service</Link>
            </p>
            <Button asChild variant="outline" className="bg-transparent border-white/20 hover:bg-white/10 gap-2">
              <Link href="/">
                Back to home <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
