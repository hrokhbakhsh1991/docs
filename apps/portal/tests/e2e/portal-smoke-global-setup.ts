/**
 * Warms portal registration routes after smoke servers start.
 * Next dev first compile of /catalog/[tourId]/register can exceed 90s; without
 * warmup Playwright navigationTimeout (120s) races compile and flakes SMK-PTL-*.
 * @see docs/phase-11/subphases/11.18-portal-e2e-smoke.md
 */
import http from "node:http";

const DEFAULT_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const PARTICIPANT_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000212";
const TRANSPORT_BUS_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000213";
const TRANSPORT_SHARED_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000214";

/** Compile public-auth BFF routes before tests — avoids Next dev HMR reload mid-OTP. */
async function warmPublicAuthBffRoutes(base: string): Promise<void> {
  const routes = [
    "/api/public-auth/phone-preflight",
    "/api/public-auth/request-otp",
    "/api/public-auth/verify-otp",
    "/api/public-auth/register-complete",
    "/api/catalog/registrations",
    "/api/catalog/pricing-preview",
  ] as const;
  for (const path of routes) {
    await new Promise<void>((resolve, reject) => {
      const url = new URL(`${base}${path}`);
      const body = JSON.stringify({ phone: "+15550009999" });
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === "https:" ? 443 : 80),
          path: url.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            host: url.host,
          },
        },
        (res) => {
          res.resume();
          resolve();
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

function waitForUrl(url: string, timeoutMs = 600_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`portal-smoke-global-setup: timeout waiting for ${url}`));
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
      req.setTimeout(120_000, () => {
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
    process.env.PORTAL_INTERNAL_URL?.replace(/\/$/, "") ??
    process.env.SMOKE_PORTAL_BASE_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:3003";

  await waitForUrl(`${base}/catalog/${DEFAULT_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${PARTICIPANT_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${TRANSPORT_BUS_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${TRANSPORT_SHARED_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/me/profile`);
  await waitForUrl(`${base}/me/registrations`);
  await warmPublicAuthBffRoutes(base);
}
