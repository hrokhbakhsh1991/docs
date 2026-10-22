export type AbortTimeout = {
  readonly signal: AbortSignal;
  readonly timedOut: () => boolean;
  readonly dispose: () => void;
};

/** Creates a request signal with a bounded deadline and explicit cleanup. */
export function createAbortTimeout(timeoutMs: number): AbortTimeout {
  const controller = new AbortController();
  let didTimeOut = false;
  const timer = setTimeout(() => {
    didTimeOut = true;
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => didTimeOut,
    dispose: () => {
      clearTimeout(timer);
      if (!controller.signal.aborted) {
        controller.abort();
      }
    },
  };
}
