import type { Metadata } from "next";
import Account from "@/pages/Account";

export const metadata: Metadata = {
  title: "Delete your account — DreamForgeX",
  description:
    "Sign in to permanently delete your DreamForgeX account and associated personal data.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return <Account />;
}
