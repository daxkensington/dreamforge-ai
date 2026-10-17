/** Only these create-endpoint failures are known to happen before a claim.
 * Authentication expiry and throttling also affect retries of claimed work. */
export function isUnclaimedOperationError(code: string | undefined): boolean {
  return ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "PRECONDITION_FAILED"].includes(code ?? "");
}
export function isCurrentOperation(identity: { userId: number; requestId: string } | null, requestId: string | undefined, actorId: number | undefined): boolean {
  return Boolean(identity && identity.userId === actorId && identity.requestId === requestId);
}
