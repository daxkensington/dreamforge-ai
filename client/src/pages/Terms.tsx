import PageLayout from "@/components/PageLayout";
import { motion } from "framer-motion";
import { FileText, Scale, ArrowRight } from "lucide-react";
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
    title: "1. Acceptance of Terms",
    body: [
      "By creating an account or using DreamForgeX (\"the Service\"), you agree to these Terms of Service. If you do not agree, do not use the Service.",
      "These Terms apply to dreamforgex.ai, all subdomains, the API, mobile clients, and any service we operate under the DreamForgeX name.",
    ],
  },
  {
    title: "2. Eligibility",
    body: [
      "You must be at least 18 years old to use DreamForgeX. By using the Service you represent that you meet this requirement and that your use does not violate any law in your jurisdiction.",
    ],
  },
  {
    title: "3. Your Account",
    body: [
      "You are responsible for safeguarding your login credentials and for all activity on your account. You must notify us immediately of any unauthorized use.",
      "We may suspend or terminate accounts that violate these Terms, our Acceptable Use Policy, or applicable law.",
    ],
  },
  {
    title: "4. Credits, Plans, and Payment",
    body: [
      "DreamForgeX uses a credit-based system. Free plans receive a daily credit allowance; paid plans receive a monthly allowance plus optional credit packs.",
      "Credits are consumed when you generate content. Different models cost different amounts; the cost is shown before you generate.",
      "Subscriptions renew automatically until canceled. Credits do not roll over between billing periods unless explicitly stated. Credit packs purchased separately do not expire for 12 months from purchase.",
      "All payments are non-refundable except where required by law or where we, in our sole discretion, issue a goodwill refund.",
    ],
  },
  {
    title: "5. Ownership of Generated Content",
    body: [
      "Subject to your compliance with these Terms and to the rights of the underlying model providers, you own the content you generate on paid plans and may use it for commercial purposes.",
      "Free-plan generations are watermarked and licensed for personal, non-commercial use only.",
      "We do not claim ownership of your prompts or your generations. We do not train models on your private generations.",
      "You grant DreamForgeX a non-exclusive, worldwide license to host, store, and display your content solely as needed to operate the Service. Content you submit to the public Gallery is additionally licensed to other users for non-commercial viewing within the Service.",
    ],
  },
  {
    title: "6. Acceptable Use",
    body: [
      "You may not use DreamForgeX to generate, distribute, or attempt to generate content that:",
      "• depicts sexual content involving minors (CSAM) — this results in immediate termination and a report to the relevant authorities;",
      "• depicts a real, identifiable person in a sexual, violent, or defamatory context without their explicit consent;",
      "• is intended to harass, threaten, defraud, or impersonate any person or organization;",
      "• promotes terrorism, mass violence, or illegal activity;",
      "• infringes a third party's intellectual property, trademark, or right of publicity;",
      "• circumvents safety filters, rate limits, or technical protections on the Service.",
      "We use automated and human moderation. Violations may result in content removal, account suspension, account termination, forfeiture of unused credits, and referral to law enforcement.",
    ],
  },
  {
    title: "7. Third-Party Models and Providers",
    body: [
      "DreamForgeX integrates models operated by third parties (including but not limited to Black Forest Labs, OpenAI, Google, xAI, Runway, Kling, Anthropic, fal.ai, Sync Labs). When you use these models, you also agree to the applicable provider's terms.",
      "We may add, remove, or change providers at any time. If a provider becomes unavailable, we may substitute a comparable model or refund credits at our discretion.",
    ],
  },
  {
    title: "8. API and Programmatic Access",
    body: [
      "API keys are tied to your account and credit balance. You are responsible for any usage incurred by your keys. Keep them secret.",
      "API usage is subject to rate limits documented at /api-docs. We may throttle, suspend, or revoke keys that abuse the Service.",
    ],
  },
  {
    title: "9. Marketplace",
    body: [
      "Sellers retain ownership of the prompts, presets, and workflows they list. Sellers grant buyers a perpetual, non-exclusive license for personal and commercial use unless otherwise stated.",
      "DreamForgeX takes a transparent platform fee on each sale, disclosed at listing time. Payouts are made on a rolling basis subject to our payout policy.",
      "We reserve the right to remove listings that violate these Terms, infringe IP, or are misrepresented.",
    ],
  },
  {
    title: "10. Service Availability",
    body: [
      "We aim for high availability but do not guarantee uninterrupted service. Outages can occur due to infrastructure, third-party providers, or maintenance.",
      "When a provider or feature is degraded, we display a status banner. Credits consumed on failed generations are automatically refunded.",
    ],
  },
  {
    title: "11. Disclaimer of Warranties",
    body: [
      "DreamForgeX is provided \"as is\" and \"as available\" without warranty of any kind, express or implied, including but not limited to merchantability, fitness for a particular purpose, and non-infringement.",
      "AI-generated content can be inaccurate, biased, or offensive. You are solely responsible for reviewing outputs before relying on them.",
    ],
  },
  {
    title: "12. Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, DreamForgeX and its operators are not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.",
      "Our total liability for any claim arising out of or relating to these Terms or the Service is limited to the greater of (a) the amount you paid us in the 12 months preceding the claim, or (b) USD $100.",
    ],
  },
  {
    title: "13. Indemnification",
    body: [
      "You agree to indemnify and hold harmless DreamForgeX, its operators, contractors, and affiliates from any claim, loss, or expense arising from your use of the Service, your content, or your violation of these Terms.",
    ],
  },
  {
    title: "14. Termination",
    body: [
      "You may close your account at any time from your profile page. We may suspend or terminate accounts that violate these Terms, with or without notice.",
      "On termination, your access to the Service ends and any unused credits are forfeit unless termination was without cause.",
    ],
  },
  {
    title: "15. Changes to These Terms",
    body: [
      "We may update these Terms from time to time. Material changes will be announced by email or in-app notice at least 14 days before they take effect. Continued use after the effective date constitutes acceptance.",
    ],
  },
  {
    title: "16. Governing Law",
    body: [
      "These Terms are governed by the laws of the Province of Ontario, Canada, without regard to its conflict-of-laws principles. Any dispute will be resolved in the courts located in Ontario, Canada.",
    ],
  },
  {
    title: "17. Contact",
    body: [
      "Questions about these Terms? Email support@dreamforgex.ai.",
    ],
  },
];

export default function Terms() {
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
            <Scale className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white/90">Legal</span>
          </motion.div>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
            className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4"
          >
            Terms of Service
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
                  <FileText className="h-5 w-5 text-cyan-400 flex-shrink-0" />
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
              See also: <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</Link>
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
