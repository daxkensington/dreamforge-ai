import type { Metadata } from "next";
import ClientPage from "./ClientPage";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/tools" },
};

export default function Page() {
  return <ClientPage />;
}
