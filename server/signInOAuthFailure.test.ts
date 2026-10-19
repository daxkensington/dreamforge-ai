import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { DEFAULT_POST_LOGIN } from "../shared/returnTo";

const rendered = vi.hoisted(() => ({ buttons: [] as { label: string; onClick?: () => unknown }[] }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/components/ui/input", () => ({ Input: "input" }));
vi.mock("@/components/ui/button", () => ({
  Button: (props: React.PropsWithChildren<{ onClick?: () => unknown; type?: "button" | "submit" | "reset" }>) => {
    rendered.buttons.push({
      label: React.Children.toArray(props.children).filter(child => typeof child === "string").join("").trim(),
      onClick: props.onClick,
    });
    return React.createElement("button", { onClick: props.onClick, type: props.type }, props.children);
  },
}));

import SignInPage from "../app/auth/signin/page";

beforeEach(() => {
  vi.clearAllMocks();
  rendered.buttons.length = 0;
  vi.stubGlobal("React", React);
});
afterEach(() => vi.unstubAllGlobals());

function renderProviderButton(provider: "google" | "github") {
  renderToStaticMarkup(React.createElement(SignInPage));
  const button = rendered.buttons.find(row => row.label === `Continue with ${provider === "google" ? "Google" : "GitHub"}`);
  expect(button?.onClick).toBeTypeOf("function");
  return button!.onClick!;
}

describe.each(["google", "github"] as const)("actual %s sign-in button", provider => {
  it("handles a rejected sign-in request with a fixed retry message and permits another attempt", async () => {
    vi.mocked(signIn).mockImplementation(() => {
      const request = Promise.reject(new TypeError("synthetic-detail-not-for-display"));
      // Keep the pre-fix reproduction from creating a global unhandled test
      // rejection; the actual button still must produce its own safe message.
      void request.catch(() => undefined);
      return request;
    });
    const click = renderProviderButton(provider);
    await Promise.resolve(click());
    expect(signIn).toHaveBeenCalledExactlyOnceWith(provider, { callbackUrl: DEFAULT_POST_LOGIN });
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Sign-in could not start. Check your connection and try again.");
    vi.mocked(signIn).mockResolvedValue(undefined);
    await Promise.resolve(click());
    expect(signIn).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("preserves the provider, callback and analytics arguments on a successful request", async () => {
    vi.mocked(signIn).mockResolvedValue(undefined);
    await Promise.resolve(renderProviderButton(provider)());
    expect(signIn).toHaveBeenCalledExactlyOnceWith(provider, { callbackUrl: DEFAULT_POST_LOGIN });
    expect(track).toHaveBeenCalledExactlyOnceWith("signup_started", { method: provider });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("uses the existing callback sanitizer at click time", async () => {
    vi.mocked(signIn).mockResolvedValue(undefined);
    const click = renderProviderButton(provider);
    for (const [next, expected] of [["/tools/text-effects", "/tools/text-effects"], ["https://attacker.example/", DEFAULT_POST_LOGIN]]) {
      vi.stubGlobal("window", { location: { search: "?next=" + encodeURIComponent(next) } });
      await Promise.resolve(click());
      expect(signIn).toHaveBeenLastCalledWith(provider, { callbackUrl: expected });
    }
    expect(toast.error).not.toHaveBeenCalled();
  });
});
