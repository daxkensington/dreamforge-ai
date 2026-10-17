import { describe, expect, it } from "vitest";
import { isCurrentOperation, isUnclaimedOperationError } from "./operationIdentity";
describe("operation UI identity lifecycle", () => {
  it("retains a possibly claimed request through rate limiting, auth expiry and uncertain transport", () => {
    for (const code of ["TOO_MANY_REQUESTS", "UNAUTHORIZED", "SERVICE_UNAVAILABLE", "INTERNAL_SERVER_ERROR", "CONFLICT", undefined]) expect(isUnclaimedOperationError(code)).toBe(false);
    for (const code of ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "PRECONDITION_FAILED"]) expect(isUnclaimedOperationError(code)).toBe(true);
  });
  it("ignores stale callbacks after account or request changes", () => {
    const current = { userId: 2, requestId: "new" };
    expect(isCurrentOperation(current,"new",2)).toBe(true);
    expect(isCurrentOperation(current,"new",1)).toBe(false);
    expect(isCurrentOperation(current,"old",2)).toBe(false);
    expect(isCurrentOperation(null,"new",2)).toBe(false);
  });
});
