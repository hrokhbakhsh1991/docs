import dns from "node:dns";
import http from "node:http";

import type { FullConfig } from "@playwright/test";

/** Prefer IPv4 when both A and AAAA exist — smoke binds 127.0.0.1 only. */
dns.setDefaultResultOrder("ipv4first");

function waitForUrl(url: string, timeoutMs = 300_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let inFlight = false;

  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error(`location-qa-global-setup: timeout waiting for ${url}`));
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

async function globalSetup(_config: FullConfig): Promise<void> {
  await waitForUrl("http://127.0.0.1:3000/auth/login");
}

export default globalSetup;
