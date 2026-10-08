import type { Metadata } from "next";
import ClientPage from "./ClientPage";

export const metadata: Metadata = {
  alternates: { canonical: "https://dreamforgex.ai/gallery" },
};

export default function Page() {
  return <ClientPage />;
}
