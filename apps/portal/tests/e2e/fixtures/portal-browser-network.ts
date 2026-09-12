/**
 * Real browser network helpers for BQC loading/error states (no page.route mocks).
 */
import type { CDPSession, Page } from "@playwright/test";

async function openCdpSession(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  return client;
}

export async function withEmulatedSlowNetwork(
  page: Page,
  run: () => Promise<void>,
): Promise<void> {
  const client = await openCdpSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: 8_192,
    uploadThroughput: 8_192,
    latency: 2_000,
  });
  try {
    await run();
  } finally {
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
    await client.detach().catch(() => undefined);
  }
}

export async function withFirstMatchingRequestFailed(
  page: Page,
  urlIncludes: string,
  run: () => Promise<void>,
): Promise<void> {
  const client = await openCdpSession(page);
  let intercept = true;

  await client.send("Fetch.enable", {
    patterns: [{ urlPattern: "*api/me/notifications*", requestStage: "Request" }],
  });

  client.on("Fetch.requestPaused", (event: { requestId: string; request: { url: string } }) => {
    void (async () => {
      const { requestId, request } = event;
      try {
        if (
          intercept &&
          request.url.includes(urlIncludes) &&
          !request.url.includes("/unread-count")
        ) {
          intercept = false;
          await client.send("Fetch.failRequest", {
            requestId,
            errorReason: "ConnectionAborted",
          });
          return;
        }
        await client.send("Fetch.continueRequest", { requestId });
      } catch {
        try {
          await client.send("Fetch.continueRequest", { requestId });
        } catch {
          // Request may already be handled.
        }
      }
    })();
  });

  try {
    await run();
  } finally {
    await client.send("Fetch.disable").catch(() => undefined);
    await client.detach().catch(() => undefined);
  }
}

export async function withPausedMatchingRequest(
  page: Page,
  urlIncludes: string,
  runWhilePaused: () => Promise<void>,
  trigger: () => Promise<void>,
): Promise<void> {
  const client = await openCdpSession(page);
  let pausedRequestId: string | null = null;

  await client.send("Fetch.enable", {
    patterns: [{ urlPattern: "*api/me/notifications*", requestStage: "Request" }],
  });

  client.on("Fetch.requestPaused", (event: { requestId: string; request: { url: string } }) => {
    void (async () => {
      const { requestId, request } = event;
      try {
        if (
          pausedRequestId === null &&
          request.url.includes(urlIncludes) &&
          !request.url.includes("/unread-count")
        ) {
          pausedRequestId = requestId;
          return;
        }
        await client.send("Fetch.continueRequest", { requestId });
      } catch {
        try {
          await client.send("Fetch.continueRequest", { requestId });
        } catch {
          // Request may already be handled.
        }
      }
    })();
  });

  try {
    await trigger();
    await waitForNotificationsPanelState(page, "loading", 25_000);
    await runWhilePaused();
    if (pausedRequestId !== null) {
      await client.send("Fetch.continueRequest", { requestId: pausedRequestId });
      pausedRequestId = null;
    }
  } finally {
    await client.send("Fetch.disable").catch(() => undefined);
    await client.detach().catch(() => undefined);
  }
}

export async function waitForNotificationsPanelState(
  page: Page,
  state: "loading" | "ready" | "error",
  timeoutMs = 20_000,
): Promise<void> {
  await page.waitForFunction(
    (expectedState) => {
      const panel = document.querySelector("[data-portal-member-notifications-panel]");
      return panel?.getAttribute("data-portal-member-notifications-state") === expectedState;
    },
    state,
    { timeout: timeoutMs },
  );
}
