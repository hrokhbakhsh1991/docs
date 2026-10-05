/**
 * Warms portal registration routes after smoke servers start.
 * Next dev first compile of /catalog/[tourId]/register can exceed 90s; without
 * warmup Playwright navigationTimeout (120s) races compile and flakes SMK-PTL-*.
 * @see docs/phase-11/subphases/11.18-portal-e2e-smoke.md
 */
import http from "node:http";

const OPERATOR_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const DENALI_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000220";
const PARTICIPANT_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000212";
const TRANSPORT_BUS_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000213";
const TRANSPORT_BUS_OCCUPANCY_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000215";
const TRANSPORT_BUS_DRIVER_ONLY_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000216";
const TRANSPORT_SHARED_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000214";

/** PW_EXTERNAL_SERVERS + VPS_IP: .localhost/.club hosts resolve to remote staging, not loopback. */
function resolveConnectHostname(hostname: string): string {
  const vpsIp = process.env.VPS_IP?.trim();
  if (
    process.env.PW_EXTERNAL_SERVERS === "1" &&
    vpsIp !== undefined &&
    vpsIp.length > 0 &&
    (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".club"))
  ) {
    return vpsIp;
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return "127.0.0.1";
  }
  return hostname;
}

/** Compile portal BFF routes before tests — avoids Next dev HMR reload mid-flow. */
async function warmPortalBffRoute(
  base: string,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: object
): Promise<Record<string, unknown> | null> {
  let lastError: unknown = new Error(`warm-up failed for ${method} ${path}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const responseBody = await new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const url = new URL(`${base}${path}`);
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const headers: Record<string, string> = { host: url.host };
        if (payload !== undefined) {
          headers["Content-Type"] = "application/json";
          headers["Content-Length"] = String(Buffer.byteLength(payload));
        }
        const req = http.request(
          {
            hostname: resolveConnectHostname(url.hostname),
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method,
            headers,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer | string) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            res.on("end", () => {
              try {
                const text = Buffer.concat(chunks).toString("utf8").trim();
                resolve(text.length === 0 ? null : (JSON.parse(text) as Record<string, unknown>));
              } catch {
                resolve(null);
              }
            });
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
      return responseBody;
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }
  throw lastError;
}

async function warmPortalBffPostRoute(
  base: string,
  path: string,
  body: object
): Promise<Record<string, unknown> | null> {
  return warmPortalBffRoute(base, path, "POST", body);
}

async function warmPublicAuthBffRoutes(base: string): Promise<void> {
  const routes = [
    ["/api/public-auth/phone-preflight", { phone: "+15550009999" }],
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

  // Verify the route with the challenge issued by request-otp. A fabricated
  // challenge only creates a misleading 400 in the smoke logs and does not
  // warm the real success path.
  const requestOtp = await warmPortalBffPostRoute(base, "/api/public-auth/request-otp", {
    phone: "+15550009999",
  });
  if (typeof requestOtp?.challenge_id === "string") {
    await warmPortalBffPostRoute(base, "/api/public-auth/verify-otp", {
      phone: "+15550009999",
      otp: "1234",
      challenge_id: requestOtp.challenge_id,
    });
  }
}

function waitForUrl(url: string, timeoutMs = 600_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;
  const target = new URL(url);
  const connectHostname = resolveConnectHostname(target.hostname);
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
    process.env.SMOKE_PORTAL_BASE_URL?.replace(/\/$/, "") ??
    process.env.PORTAL_INTERNAL_URL?.replace(/\/$/, "") ??
    // Warm the same host that Playwright uses. Using 127.0.0.1 here bypasses
    // host-based tenant resolution and leaves authenticated BFF routes cold.
    "http://portal.operator.localhost:3003";

  const defaultSmokeTourId = base.includes("denali")
    ? DENALI_SMOKE_TOUR_ID
    : OPERATOR_SMOKE_TOUR_ID;
  await waitForUrl(`${base}/catalog/${defaultSmokeTourId}/register`);
  await waitForUrl(`${base}/catalog/${PARTICIPANT_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${TRANSPORT_BUS_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${TRANSPORT_BUS_OCCUPANCY_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${TRANSPORT_BUS_DRIVER_ONLY_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/catalog/${TRANSPORT_SHARED_SMOKE_TOUR_ID}/register`);
  await waitForUrl(`${base}/me/profile`);
  await waitForUrl(`${base}/me/registrations`);
  await waitForUrl(`${base}/api/me/registrations`);
  await warmPublicAuthBffRoutes(base);

  // Compile both steps of the authenticated mobile-change flow before the
  // slower member-page warmups. Otherwise Next dev can serialize these route
  // compilations behind the profile page and hold the browser fetch.
  await warmPortalBffPostRoute(base, "/api/me/mobile/request-otp", {
    phone: "+15550009999",
  });
  await warmPortalBffPostRoute(base, "/api/me/mobile/verify", {
    phone: "+15550009999",
    otp: "1234",
    challenge_id: "warmup",
  });

  const warmupRegistrationId = "00000000-0000-4000-8000-000000000299";
  const meBffRoutes = [
    ["GET", "/api/me/profile"],
    ["GET", "/api/me/entitlements"],
    ["GET", "/api/me/home"],
    ["GET", "/api/me/notifications"],
    ["GET", "/api/me/tickets"],
    ["POST", "/api/me/tickets", { categoryCode: "general", subject: "Warmup", body: "Warmup" }],
    ["PATCH", "/api/me/profile", { displayName: "Warmup" }],
    ["GET", `/api/me/registrations/${warmupRegistrationId}`],
    ["GET", `/api/me/registrations/${warmupRegistrationId}/receipt`],
    ["GET", `/me/registrations/${warmupRegistrationId}`],
  ] as const;
  for (const [method, path, body] of meBffRoutes) {
    await warmPortalBffRoute(base, path, method, body as object | undefined);
  }
}
