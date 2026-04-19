"use client";
import ComparisonPage from "@/pages/ComparisonPage";
import { COMPARISONS } from "../../../shared/comparisonData";
export default function Page() {
  return <ComparisonPage data={COMPARISONS.leonardo} />;
}
