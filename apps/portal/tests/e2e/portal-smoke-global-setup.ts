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

/** Compile portal BFF routes before tests — avoids Next dev HMR reload mid-flow. */
async function warmPortalBffRoute(
  base: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: object
): Promise<void> {
  let lastError: unknown = new Error(`warm-up failed for ${method} ${path}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const url = new URL(`${base}${path}`);
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const headers: Record<string, string> = { host: url.host };
        if (payload !== undefined) {
          headers["Content-Type"] = "application/json";
          headers["Content-Length"] = String(Buffer.byteLength(payload));
        }
        const req = http.request(
          {
            hostname:
              url.hostname === "localhost" || url.hostname.endsWith(".localhost")
                ? "127.0.0.1"
                : url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method,
            headers,
          },
          (res) => {
            res.resume();
            resolve();
          }
        );
        req.on("error", reject);
        req.setTimeout(120_000, () => {
          req.destroy(new Error(`warm-up timeout for ${method} ${path}`));
        });
        if (payload !== undefined) {
          req.write(payload);
        }
        req.end();
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }
  throw lastError;
}

async function warmPortalBffPostRoute(base: string, path: string, body: object): Promise<void> {
  await warmPortalBffRoute(base, path, "POST", body);
}

async function warmPublicAuthBffRoutes(base: string): Promise<void> {
  const routes = [
    ["/api/public-auth/phone-preflight", { phone: "+15550009999" }],
    ["/api/public-auth/request-otp", { phone: "+15550009999" }],
    ["/api/public-auth/verify-otp", { phone: "+15550009999", otp: "1234", challenge_id: "warmup" }],
    ["/api/public-auth/register-complete", { phone: "+15550009999" }],
    ["/api/public-auth/logout", {}],
    ["/api/catalog/registrations", { phone: "+15550009999" }],
    ["/api/catalog/pricing-preview", { phone: "+15550009999" }],
    ["/api/me/mobile/request-otp", { phone: "+15550009999" }],
    ["/api/me/mobile/verify", { phone: "+15550009999", otp: "1234" }],
  ] as const;
  for (const [path, body] of routes) {
    await warmPortalBffPostRoute(base, path, body);
  }
}

function waitForUrl(url: string, timeoutMs = 600_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;
  const target = new URL(url);
  const connectHostname =
    target.hostname === "localhost" || target.hostname.endsWith(".localhost")
      ? "127.0.0.1"
      : target.hostname;
  const requestOptions = {
    hostname: connectHostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    path: `${target.pathname}${target.search}`,
    headers: { host: target.host },
  };

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
      const req = http.get(requestOptions, (res) => {
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
  await waitForUrl(`${base}/api/me/registrations`);
  await warmPublicAuthBffRoutes(base);

  const warmupRegistrationId = "00000000-0000-4000-8000-000000000299";
  const meBffRoutes = [
    ["GET", "/api/me/profile"],
    ["GET", "/api/me/entitlements"],
    ["GET", "/api/me/home"],
    ["GET", "/api/me/notifications"],
    ["PATCH", "/api/me/profile", { displayName: "Warmup" }],
    ["GET", `/api/me/registrations/${warmupRegistrationId}`],
    ["GET", `/api/me/registrations/${warmupRegistrationId}/receipt`],
    ["GET", `/me/registrations/${warmupRegistrationId}`],
  ] as const;
  for (const [method, path, body] of meBffRoutes) {
    await warmPortalBffRoute(base, path, method, body as object | undefined);
  }
}
