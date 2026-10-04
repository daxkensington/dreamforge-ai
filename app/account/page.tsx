import type { Metadata } from "next";
import Account from "@/pages/Account";

export const metadata: Metadata = {
  title: "Delete your account — DreamForgeX",
  description:
    "Sign in to permanently delete your DreamForgeX account and associated personal data.",
  // Noindex: this is a utility page for signed-in users deleting their
  // account — nothing a search user should ever land on.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Account />;
}
