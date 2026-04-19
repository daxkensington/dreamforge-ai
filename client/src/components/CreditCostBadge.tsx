import { Coins } from "lucide-react";
import { TOOL_CREDIT_COSTS, TOOL_SLUG_ALIASES } from "@shared/creditCosts";
import { cn } from "@/lib/utils";

interface CreditCostBadgeProps {
  /** Explicit credit cost. Wins over toolKey when both provided. */
  costCredits?: number;
  /** Tool key from shared/creditCosts.ts (e.g., "pixel-art"). */
  toolKey?: string;
  /** Optional class overrides for caller layout. */
  className?: string;
  /** Slightly larger variant for prominent placement. */
  size?: "sm" | "md";
}

/**
 * Inline pill that shows how many credits a single generation costs.
 * Renders nothing if no cost is known — safer to be silent than wrong.
 */
export function CreditCostBadge({
  costCredits,
  toolKey,
  className,
  size = "sm",
}: CreditCostBadgeProps) {
  const resolvedKey = toolKey
    ? (TOOL_SLUG_ALIASES[toolKey] ?? toolKey)
    : undefined;
  const cost =
    costCredits !== undefined
      ? costCredits
      : resolvedKey
        ? TOOL_CREDIT_COSTS[resolvedKey]
        : undefined;
  if (cost === undefined || cost === null) return null;

  const label = cost === 0 ? "Free" : `${cost} credit${cost === 1 ? "" : "s"}`;
  const isFree = cost === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium tracking-tight",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        isFree
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300",
        className,
      )}
      title={isFree ? "Free — no credits used" : `Each generation uses ${cost} credit${cost === 1 ? "" : "s"}`}
      data-credit-cost={cost}
    >
      <Coins className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      <span>{label}</span>
    </span>
  );
}
