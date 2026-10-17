/** Serial, cancellable debounce for automatic billable canvas submissions. */
export function createLiveCanvasScheduler<T>(options: {
  submit: (input: T) => Promise<unknown>;
  onError: (error: unknown) => void;
  delayMs?: number;
}) {
  let enabled = false;
  let inFlight = false;
  let latest: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const arm = () => { clearTimer(); timer = setTimeout(flush, options.delayMs ?? 700); };
  const flush = () => {
    timer = undefined;
    if (!enabled || inFlight || latest === null) return;
    const input = latest.value;
    latest = null;
    inFlight = true;
    void Promise.resolve().then(() => options.submit(input)).catch(options.onError).finally(() => {
      inFlight = false;
      if (enabled && latest !== null) arm();
    });
  };
  return {
    setEnabled(next: boolean) {
      enabled = next;
      if (!next) { clearTimer(); latest = null; }
    },
    schedule(input: T) {
      if (!enabled) return;
      latest = { value: input };
      arm();
    },
  };
}
