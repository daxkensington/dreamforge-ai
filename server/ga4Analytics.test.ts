import { describe, expect, it } from "vitest";
import { buildGa4Event, validGaMeasurementId } from "../client/src/lib/analytics";

describe("GA4 readiness and privacy-safe conversion mapping", () => {
  it("validates NEXT_PUBLIC_GA_MEASUREMENT_ID against /^G-[A-Z0-9]+$/", () => {
    expect(validGaMeasurementId("G-DFX1234567")).toBe("G-DFX1234567");
    expect(validGaMeasurementId(" G-ABC999 ")).toBe("G-ABC999");
    for (const bad of ["", undefined, null, "UA-1234-1", "G-lower", "GTM-1234", "G-123;evil"]) {
      expect(validGaMeasurementId(bad)).toBeNull();
    }
  });

  it("strips query strings from page_view URLs", () => {
    expect(
      buildGa4Event("page_view", undefined, {
        origin: "https://dreamforgex.ai",
        pathname: "/pricing",
        search: "?session_id=cs_live_secret&email=test@example.com",
      }),
    ).toEqual({
      name: "page_view",
      params: {
        page_path: "/pricing",
        page_location: "https://dreamforgex.ai/pricing",
      },
    });
  });

  it("maps signup_completed to sign_up without leaking userId", () => {
    expect(buildGa4Event("signup_completed", { userId: "usr_secret_123", email: "user@example.com" })).toEqual({
      name: "sign_up",
      params: {},
    });
  });

  it("maps checkout_completed to purchase with non-PII value/currency/session_id", () => {
    expect(
      buildGa4Event(
        "checkout_completed",
        { kind: "credit_pack", surface: "pricing" },
        {
          origin: "https://dreamforgex.ai",
          pathname: "/pricing",
          search: "?credit_success=true&session_id=cs_live_12345&value=19.99&currency=usd",
        },
      ),
    ).toEqual({
      name: "purchase",
      params: {
        value: 19.99,
        currency: "USD",
        transaction_id: "cs_live_12345",
        item_category: "credit_pack",
        surface: "pricing",
      },
    });
  });
});
