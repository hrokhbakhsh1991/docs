/**
 * PCMS-COOK-01 — Chromium accepts Domain=apex; rejects Domain=.localhost (PSL).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { chromium } from "@playwright/test";

async function withCookieServer(
  setCookie: string,
  run: (port: number) => Promise<void>
): Promise<void> {
  const server = http.createServer((req, res) => {
    if (req.url === "/set") {
      res.writeHead(200, { "Content-Type": "text/plain", "Set-Cookie": setCookie });
      res.end("set");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`cookie=${req.headers.cookie ?? ""}`);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected TCP port");
  }
  try {
    await run(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("PCMS-COOK Chromium Domain acceptance", () => {
  it("PCMS-COOK-CR-01 Domain=denali.club shares portal → marketing", async () => {
    await withCookieServer(
      "atour_mb_session=APEX; Path=/; SameSite=Lax; Max-Age=3600; Domain=denali.club",
      async (port) => {
        const browser = await chromium.launch({
          headless: true,
          args: [
            "--host-resolver-rules=MAP portal.denali.club 127.0.0.1, MAP denali.club 127.0.0.1",
          ],
        });
        try {
          const context = await browser.newContext();
          const portalPage = await context.newPage();
          await portalPage.goto(`http://portal.denali.club:${port}/set`);
          const stored = (await context.cookies()).filter((c) => c.name === "atour_mb_session");
          assert.equal(stored.length, 1);
          assert.equal(stored[0]?.domain.replace(/^\./, ""), "denali.club");

          const marketingPage = await context.newPage();
          const body = await (await marketingPage.goto(`http://denali.club:${port}/`)).text();
          assert.match(body, /atour_mb_session=APEX/);
        } finally {
          await browser.close();
        }
      }
    );
  });

  it("PCMS-COOK-CR-02 Domain=.localhost is rejected; host-only does not reach marketing", async () => {
    await withCookieServer(
      "atour_mb_session=DOT; Path=/; SameSite=Lax; Max-Age=3600; Domain=.localhost",
      async (port) => {
        const browser = await chromium.launch({ headless: true });
        try {
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto(`http://denali.portal.localhost:${port}/set`);
          const stored = (await context.cookies()).filter((c) => c.name === "atour_mb_session");
          assert.equal(stored.length, 0);

          const marketingPage = await context.newPage();
          const body = await (
            await marketingPage.goto(`http://denali.localhost:${port}/`)
          ).text();
          assert.equal(body, "cookie=");
        } finally {
          await browser.close();
        }
      }
    );
  });

  it("PCMS-COOK-CR-03 Domain=denali.localhost shares portal.denali.localhost → denali.localhost", async () => {
    await withCookieServer(
      "atour_mb_session=LOCAL; Path=/; SameSite=Lax; Max-Age=3600; Domain=denali.localhost",
      async (port) => {
        const browser = await chromium.launch({ headless: true });
        try {
          const context = await browser.newContext();
          const portalPage = await context.newPage();
          await portalPage.goto(`http://portal.denali.localhost:${port}/set`);
          const stored = (await context.cookies()).filter((c) => c.name === "atour_mb_session");
          assert.equal(stored.length, 1);
          assert.equal(stored[0]?.domain.replace(/^\./, ""), "denali.localhost");

          const marketingPage = await context.newPage();
          const body = await (
            await marketingPage.goto(`http://denali.localhost:${port}/`)
          ).text();
          assert.match(body, /atour_mb_session=LOCAL/);
        } finally {
          await browser.close();
        }
      }
    );
  });
});
