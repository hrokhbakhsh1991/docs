/**
 * Warms marketing + portal after Playwright webServer health gate.
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
import http from "node:http";

function waitForUrl(url: string, timeoutMs = 300_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`urban-e2e-global-setup: timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 1_500);
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
  await Promise.all([
    waitForUrl("http://127.0.0.1:3002/health"),
    waitForUrl("http://127.0.0.1:3003/health"),
  ]);
}
