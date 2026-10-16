import type { Metadata } from "next";
import ClientPage from "./ClientPage";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/marketplace" },
};

export default function Page() {
  return <ClientPage />;
}
