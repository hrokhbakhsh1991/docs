/**
 * Client finance list GET — one retry on transient upstream unavailability (502/503).
 * Callers pass AbortSignal from effect cleanup.
 */
export async function fetchFinanceListWithRetry(
  path: string,
  signal: AbortSignal
): Promise<Response> {
  const attempt = async (): Promise<Response> =>
    fetch(path, { cache: "no-store", signal });

  const first = await attempt();
  if (first.ok || (first.status !== 502 && first.status !== 503) || signal.aborted) {
    return first;
  }

  // Drain so the socket/body is not held across the backoff before retry.
  await first.arrayBuffer().catch(() => undefined);

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 300);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
  if (signal.aborted) {
    return first;
  }
  return attempt();
}
