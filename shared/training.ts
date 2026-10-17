/** Public, server-enforced quotes. Agency includes three saved slots; training uses credits. */
export const TRAINING_POLICY = {
  minImages: 5,
  maxImages: 20,
  savedSlots: 3,
  uploadMaxBytes: 10 * 1024 * 1024,
  inputLifetimeHours: 24,
  standardCredits: 10_000,
  detailedCredits: 15_000,
  maxModelBytes: 256 * 1024 * 1024,
} as const;
export type TrainingType = "face" | "style" | "product" | "object";
export function getTrainingCredits(steps: number): number {
  if (steps === 800) return TRAINING_POLICY.standardCredits;
  if (steps === 1200) return TRAINING_POLICY.detailedCredits;
  throw new Error("Choose 800 or 1,200 training steps.");
}
/** fal flux-lora: $0.035/MP, rounded up. 1,024 square is TWO billable MP. */
export function getTrainingImageCredits(width: number, height: number): number {
  if (
    ![width, height].every(
      n => Number.isSafeInteger(n) && n >= 256 && n <= 1024 && n % 8 === 0
    )
  ) {
    throw new Error(
      "Custom model images need dimensions from 256 to 1,024 in multiples of eight."
    );
  }
  return Math.ceil((width * height) / 1_000_000) * 210;
}
export const TRAINING_STATE_LABELS: Record<string, string> = {
  draft: "Ready to prepare",
  preparing: "Preparing images",
  ready_to_submit: "Ready to train",
  submitting: "Sending training request",
  queued: "Queued",
  training: "Training",
  succeeded: "Ready to use",
  failed: "Failed — credits returned",
  canceled: "Canceled",
  cancel_requested: "Cancellation requested",
  reconciliation: "Needs review — credits held",
  rejected: "Not enough credits",
  deleted: "Deleted",
};
