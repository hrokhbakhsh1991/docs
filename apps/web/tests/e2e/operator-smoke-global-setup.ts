/**
 * Waits for Next dev to accept HTTP after API health (Playwright webServer gate).
 * @see docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 */
import http from "node:http";

function waitForUrl(
  url: string,
  options?: { readonly headers?: Record<string, string> },
  timeoutMs = 300_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`operator-smoke-global-setup: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 2_000);
    };
    const tick = () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      const req = http.get(url, { headers: options?.headers }, (res) => {
        inFlight = false;
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", () => {
        inFlight = false;
        retry();
      });
      req.setTimeout(60_000, () => {
        req.destroy();
        inFlight = false;
        retry();
      });
    };
    tick();
  });
}

function warmPostRoute(
  url: string,
  options?: { readonly headers?: Record<string, string> },
  timeoutMs = 300_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`operator-smoke-global-setup: timeout warming ${url}`));
        return;
      }
      setTimeout(tick, 2_000);
    };
    const tick = () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      const req = http.request(url, { method: "POST", headers: options?.headers }, (res) => {
        inFlight = false;
        res.resume();
        // No session is intentionally supplied: 401 is enough to compile the BFF route
        // without mutating a booking, while 5xx means Next has not warmed it successfully.
        if (res.statusCode !== undefined && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", () => {
        inFlight = false;
        retry();
      });
      req.setTimeout(60_000, () => {
        req.destroy();
        inFlight = false;
        retry();
      });
      req.end();
    };
    tick();
  });
}

export default async function globalSetup(): Promise<void> {
  const configuredBase = process.env.PLAYWRIGHT_BASE_URL?.trim();
  const base = configuredBase?.replace(/\/$/, "") ?? "http://127.0.0.1:3000";
  const options =
    configuredBase === undefined
      ? { headers: { host: "admin.operator.localhost:3000" } }
      : undefined;
  // webServer.url gates on /auth/login; warm bookings/new for SMK-P9-07 compile.
  await waitForUrl(`${base}/bookings/new`, options);
  // Compile the mutating BFF route before UI scenarios so cold Next dev startup is not
  // mistaken for a broken approve action (the unauthenticated response is non-mutating).
  await warmPostRoute(`${base}/api/bookings/00000000-0000-4000-8000-000000000311/approve`, options);
}
