/**
 * Waits for Next dev to accept HTTP after API health (Playwright webServer gate).
 * @see docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 */
import http from "node:http";

function waitForUrl(url: string, timeoutMs = 300_000): Promise<void> {
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
      const req = http.get(url, (res) => {
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

export default async function globalSetup(): Promise<void> {
  const base =
    process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ??
    "http://operator.admin.localhost:3000";
  // webServer.url gates on /auth/login; warm bookings/new for SMK-P9-07 compile.
  await waitForUrl(`${base}/bookings/new`);
}
