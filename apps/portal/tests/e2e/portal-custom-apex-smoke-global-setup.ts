/**
 * Warms custom apex portal routes for SMK-PTL-08.
 * Node fetch uses 127.0.0.1 + Host header (browser uses host-resolver-rules).
 */
import http from "node:http";

const DEFAULT_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const PARTICIPANT_SMOKE_TOUR_ID = "00000000-0000-4000-8000-000000000212";
const CUSTOM_APEX_HOST =
  process.env.SMOKE_PORTAL_CUSTOM_APEX_BASE_URL?.replace(/^https?:\/\//, "").split("/")[0] ??
  "portal.denali.club:3003";

function waitForIngressPath(pathname: string, timeoutMs = 360_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`portal-custom-apex-smoke-global-setup: timeout waiting for ${pathname}`));
        return;
      }
      setTimeout(tick, 2_000);
    };
    const tick = () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: 3003,
          path: pathname,
          method: "GET",
          headers: { host: CUSTOM_APEX_HOST },
        },
        (res) => {
          inFlight = false;
          res.resume();
          if (res.statusCode && res.statusCode < 500) {
            resolve();
            return;
          }
          retry();
        }
      );
      req.on("error", () => {
        inFlight = false;
        retry();
      });
      req.setTimeout(120_000, () => {
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
  await waitForIngressPath(`/catalog/${DEFAULT_SMOKE_TOUR_ID}/register`);
  await waitForIngressPath(`/catalog/${PARTICIPANT_SMOKE_TOUR_ID}/register`);
}
