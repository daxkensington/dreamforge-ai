import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveCanvasScheduler } from "./liveCanvasScheduler";

describe("automatic canvas submission lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("coalesces strokes and never submits after pause before the debounce", async () => {
    const submit = vi.fn(async (_input: string) => {});
    const scheduler = createLiveCanvasScheduler({ submit, onError: vi.fn() });
    scheduler.schedule("disabled");
    scheduler.setEnabled(true);
    scheduler.schedule("first");
    await vi.advanceTimersByTimeAsync(400);
    scheduler.schedule("latest");
    await vi.advanceTimersByTimeAsync(699);
    expect(submit).not.toHaveBeenCalled();
    scheduler.setEnabled(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(submit).not.toHaveBeenCalled();
    scheduler.setEnabled(true);
    scheduler.schedule("after resume");
    await vi.advanceTimersByTimeAsync(700);
    expect(submit).toHaveBeenCalledExactlyOnceWith("after resume");
  });
  it("serializes work and retains the newest stroke while a render is pending", async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const submit = vi.fn().mockImplementationOnce(() => pending).mockResolvedValue(undefined);
    const scheduler = createLiveCanvasScheduler<string>({ submit, onError: vi.fn() });
    scheduler.setEnabled(true);
    scheduler.schedule("one");
    await vi.advanceTimersByTimeAsync(700);
    scheduler.schedule("two");
    scheduler.schedule("three");
    await vi.advanceTimersByTimeAsync(1400);
    expect(submit).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(700);
    expect(submit.mock.calls.map(call => call[0])).toEqual(["one", "three"]);
  });
  it("clears queued work on unmount-style cleanup even when a request is in flight", async () => {
    let finish!: () => void;
    const submit = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const scheduler = createLiveCanvasScheduler<string>({ submit, onError: vi.fn() });
    scheduler.setEnabled(true);
    scheduler.schedule("one");
    await vi.advanceTimersByTimeAsync(700);
    scheduler.schedule("queued");
    scheduler.setEnabled(false);
    finish();
    await vi.advanceTimersByTimeAsync(2000);
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("reports a failure and allows the next stroke to recover", async () => {
    const error = new Error("Insufficient credits");
    const submit = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const onError = vi.fn();
    const scheduler = createLiveCanvasScheduler<string>({ submit, onError });
    scheduler.setEnabled(true);
    scheduler.schedule("failed");
    await vi.advanceTimersByTimeAsync(700);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    scheduler.schedule("retry");
    await vi.advanceTimersByTimeAsync(700);
    expect(submit).toHaveBeenCalledTimes(2);
  });
});
